use super::*;

fn describe_step_activity(step: &AgentTaskStepSummary) -> Option<String> {
    let message = step.message.trim();
    if !message.is_empty() {
        return Some(message.to_string());
    }
    let kind = step.kind.trim();
    if !kind.is_empty() {
        return Some(format!("{kind} step {}", step.index + 1));
    }
    None
}

fn build_operator_blocker(summary: &AgentTaskSummary, run_state: &str) -> Option<String> {
    if summary.pending_approval_id.is_some() || summary.status == "awaiting_approval" {
        return trim_to_option(summary.error_message.as_deref())
            .or_else(|| Some("Run is waiting for an operator approval decision.".to_string()));
    }
    if run_state == "paused" {
        return Some("Run is paused and waiting for resume.".to_string());
    }
    if matches!(run_state, "failed" | "cancelled") {
        return trim_to_option(summary.error_message.as_deref())
            .or_else(|| Some("Run needs operator follow-up before it can continue.".to_string()));
    }
    None
}

fn build_operator_recent_events(runtime: &AgentTaskRuntime, run_state: &str) -> Vec<Value> {
    let summary = &runtime.summary;
    let mut events = summary
        .steps
        .iter()
        .rev()
        .take(4)
        .filter_map(|step| {
            let detail = describe_step_activity(step)?;
            let (kind, label) = if step.status == "completed" {
                ("tool_finish", format!("{} completed", step.kind))
            } else if step.status == "queued" {
                ("tool_start", format!("{} queued", step.kind))
            } else {
                (
                    "status_transition",
                    format!("{} {}", step.kind, step.status),
                )
            };
            Some(json!({
                "kind": kind,
                "label": label,
                "detail": detail,
                "at": step.completed_at.or(Some(step.updated_at)).or(step.started_at),
            }))
        })
        .collect::<Vec<_>>();

    if summary.pending_approval_id.is_some() || summary.status == "awaiting_approval" {
        events.push(json!({
            "kind": "approval_wait",
            "label": "Approval wait",
            "detail": "Runtime paused for an operator decision.",
            "at": summary.updated_at,
        }));
    }
    if runtime.recovered {
        events.push(json!({
            "kind": "recovered",
            "label": "Recovered from checkpoint",
            "detail": runtime
                .checkpoint_id
                .as_ref()
                .map(|checkpoint_id| format!("Checkpoint {checkpoint_id}"))
                .unwrap_or_else(|| "Checkpoint preserved.".to_string()),
            "at": summary.updated_at,
        }));
    }
    if matches!(run_state, "failed" | "cancelled" | "paused") {
        events.push(json!({
            "kind": "blocked",
            "label": format!("Run {}", run_state.replace('_', " ")),
            "detail": build_operator_blocker(summary, run_state),
            "at": summary.updated_at,
        }));
    }

    events.sort_by(|left, right| {
        let left_at = left.get("at").and_then(Value::as_u64).unwrap_or_default();
        let right_at = right.get("at").and_then(Value::as_u64).unwrap_or_default();
        right_at.cmp(&left_at)
    });
    events.truncate(5);
    events
}

pub(super) fn build_run_operator_snapshot(
    runtime: &AgentTaskRuntime,
    run_state: &str,
    execution_profile: &Value,
    routing: &Value,
    workspace_root: Option<&str>,
) -> Value {
    let summary = &runtime.summary;
    let current_step = summary
        .current_step
        .and_then(|index| summary.steps.get(index));
    let current_activity = current_step
        .and_then(describe_step_activity)
        .or_else(|| summary.steps.iter().rev().find_map(describe_step_activity));
    let runtime_label = match execution_profile
        .get("executionMode")
        .and_then(Value::as_str)
    {
        Some("local_interactive") => Some("local interactive"),
        Some("local_background") => Some("local background"),
        Some("desktop_sandbox") => Some("desktop sandbox"),
        Some("remote_sandbox") => Some("remote sandbox"),
        _ => None,
    };
    let provider = trim_to_option(
        summary
            .routed_provider
            .as_deref()
            .or(summary.provider.as_deref()),
    );
    let model_id = trim_to_option(
        summary
            .routed_model_id
            .as_deref()
            .or(summary.model_id.as_deref()),
    );
    let backend_id = routing
        .get("backendId")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
        .or_else(|| trim_to_option(summary.backend_id.as_deref()));
    let blocker = build_operator_blocker(summary, run_state);
    let recent_events = build_operator_recent_events(runtime, run_state);
    let snapshot_summary = match (current_activity.as_deref(), backend_id.as_deref()) {
        (Some(activity), Some(backend_id)) => format!("{activity} on {backend_id}."),
        (Some(activity), None) => activity.to_string(),
        (None, _) => format!("Run is {}.", run_state.replace('_', " ")),
    };

    json!({
        "summary": snapshot_summary,
        "runtimeLabel": runtime_label,
        "provider": provider,
        "modelId": model_id,
        "reasoningEffort": summary.reason_effort.clone(),
        "backendId": backend_id.clone(),
        "machineId": Value::Null,
        "machineSummary": if backend_id.is_some() {
            Value::String("Backend known, machine not published.".to_string())
        } else {
            Value::String("Machine binding unavailable.".to_string())
        },
        "workspaceRoot": workspace_root,
        "currentActivity": current_activity,
        "blocker": blocker,
        "recentEvents": recent_events,
    })
}

fn build_workspace_evidence_bucket(
    kind: &str,
    label: &str,
    summary: String,
    items: Vec<Value>,
    missing_reason: &str,
) -> Value {
    let missing_reason = if items.is_empty() {
        Value::String(missing_reason.to_string())
    } else {
        Value::Null
    };
    json!({
        "kind": kind,
        "label": label,
        "summary": summary,
        "items": items,
        "missingReason": missing_reason,
    })
}

pub(super) fn build_workspace_evidence(
    changed_paths: &[String],
    artifacts: &[Value],
    validations: &[Value],
    mission_brief: Option<&Value>,
    publish_handoff: Option<&Value>,
    relaunch_context: Option<&Value>,
) -> Value {
    let changed_file_items = changed_paths
        .iter()
        .map(|path| {
            json!({
                "id": path,
                "label": path,
                "detail": "Runtime-recorded changed path",
                "uri": Value::Null,
            })
        })
        .collect::<Vec<_>>();
    let diff_items = artifacts
        .iter()
        .filter(|artifact| artifact.get("kind").and_then(Value::as_str) == Some("diff"))
        .map(|artifact| {
            json!({
                "id": artifact.get("id").cloned().unwrap_or(Value::Null),
                "label": artifact.get("label").cloned().unwrap_or(Value::String("Diff".to_string())),
                "detail": "diff",
                "uri": artifact.get("uri").cloned().unwrap_or(Value::Null),
            })
        })
        .collect::<Vec<_>>();
    let mut validation_items = validations
        .iter()
        .map(|validation| {
            json!({
                "id": validation.get("id").cloned().unwrap_or(Value::Null),
                "label": validation.get("label").cloned().unwrap_or(Value::String("Validation".to_string())),
                "detail": validation.get("summary").cloned().unwrap_or(Value::Null),
                "uri": Value::Null,
            })
        })
        .collect::<Vec<_>>();
    validation_items.extend(
        artifacts
            .iter()
            .filter(|artifact| artifact.get("kind").and_then(Value::as_str) == Some("validation"))
            .map(|artifact| {
                json!({
                    "id": artifact.get("id").cloned().unwrap_or(Value::Null),
                    "label": artifact.get("label").cloned().unwrap_or(Value::String("Validation artifact".to_string())),
                    "detail": "validation artifact",
                    "uri": artifact.get("uri").cloned().unwrap_or(Value::Null),
                })
            }),
    );
    let command_items = artifacts
        .iter()
        .filter(|artifact| artifact.get("kind").and_then(Value::as_str) == Some("command"))
        .map(|artifact| {
            json!({
                "id": artifact.get("id").cloned().unwrap_or(Value::Null),
                "label": artifact.get("label").cloned().unwrap_or(Value::String("Command".to_string())),
                "detail": "command trace",
                "uri": artifact.get("uri").cloned().unwrap_or(Value::Null),
            })
        })
        .collect::<Vec<_>>();
    let log_items = artifacts
        .iter()
        .filter(|artifact| artifact.get("kind").and_then(Value::as_str) == Some("log"))
        .map(|artifact| {
            json!({
                "id": artifact.get("id").cloned().unwrap_or(Value::Null),
                "label": artifact.get("label").cloned().unwrap_or(Value::String("Log".to_string())),
                "detail": "runtime log",
                "uri": artifact.get("uri").cloned().unwrap_or(Value::Null),
            })
        })
        .collect::<Vec<_>>();
    let note_items = [
        mission_brief
            .and_then(|brief| brief.get("objective").and_then(Value::as_str))
            .map(|objective| {
                json!({
                    "id": "mission-brief",
                    "label": "Mission brief",
                    "detail": objective,
                    "uri": Value::Null,
                })
            }),
        publish_handoff.map(|handoff| {
            json!({
                "id": "publish-handoff",
                "label": "Publish handoff",
                "detail": handoff
                    .get("summary")
                    .cloned()
                    .or_else(|| handoff.get("reviewTitle").cloned())
                    .unwrap_or(Value::Null),
                "uri": Value::Null,
            })
        }),
        relaunch_context
            .and_then(|context| context.get("summary").and_then(Value::as_str))
            .map(|summary| {
                json!({
                    "id": "relaunch-context",
                    "label": "Relaunch context",
                    "detail": summary,
                    "uri": Value::Null,
                })
            }),
    ]
    .into_iter()
    .flatten()
    .collect::<Vec<_>>();

    json!({
        "summary": "Runtime published inspectable workspace evidence for this run.",
        "buckets": [
            build_workspace_evidence_bucket(
                "changedFiles",
                "Changed files",
                if changed_file_items.is_empty() {
                    "No changed files were published.".to_string()
                } else {
                    format!("{} file{} recorded.", changed_file_items.len(), if changed_file_items.len() == 1 { "" } else { "s" })
                },
                changed_file_items,
                "Runtime did not publish changed-file evidence.",
            ),
            build_workspace_evidence_bucket(
                "diffs",
                "Diffs",
                if diff_items.is_empty() {
                    "No diff artifact was published.".to_string()
                } else {
                    format!("{} diff artifact{} linked.", diff_items.len(), if diff_items.len() == 1 { "" } else { "s" })
                },
                diff_items,
                "Runtime did not publish diff evidence.",
            ),
            build_workspace_evidence_bucket(
                "validations",
                "Validations",
                if validation_items.is_empty() {
                    "No validation evidence was published.".to_string()
                } else {
                    format!("{} validation item{} published.", validation_items.len(), if validation_items.len() == 1 { "" } else { "s" })
                },
                validation_items,
                "Runtime did not publish validation evidence.",
            ),
            build_workspace_evidence_bucket(
                "commands",
                "Commands",
                if command_items.is_empty() {
                    "No command evidence was published.".to_string()
                } else {
                    format!("{} command artifact{} linked.", command_items.len(), if command_items.len() == 1 { "" } else { "s" })
                },
                command_items,
                "Runtime did not publish command evidence.",
            ),
            build_workspace_evidence_bucket(
                "logs",
                "Logs",
                if log_items.is_empty() {
                    "No log evidence was published.".to_string()
                } else {
                    format!("{} log artifact{} linked.", log_items.len(), if log_items.len() == 1 { "" } else { "s" })
                },
                log_items,
                "Runtime did not publish runtime logs.",
            ),
            build_workspace_evidence_bucket(
                "memoryOrNotes",
                "Memory and notes",
                if note_items.is_empty() {
                    "No memory or notes were published.".to_string()
                } else {
                    format!("{} runtime note{} attached.", note_items.len(), if note_items.len() == 1 { "" } else { "s" })
                },
                note_items,
                "Runtime did not publish memory, notes, or handoff annotations.",
            ),
        ],
    })
}

pub(super) fn build_task_accountability(
    run: Option<&MissionRunProjection>,
    created_at: Option<u64>,
) -> Option<Value> {
    let run = run?;
    let review_decision = run.review_decision.as_ref();
    let lifecycle = if review_decision
        .and_then(|decision| decision.get("status"))
        .and_then(Value::as_str)
        == Some("accepted")
    {
        "done"
    } else if run.state == "review_ready" {
        "in_review"
    } else if matches!(run.state.as_str(), "queued" | "preparing") {
        "claimed"
    } else {
        "executing"
    };
    let lifecycle_updated_at = if lifecycle == "done" {
        review_decision
            .and_then(|decision| decision.get("decidedAt"))
            .and_then(Value::as_u64)
            .or(run.finished_at)
            .or(Some(run.updated_at))
    } else if lifecycle == "in_review" {
        run.finished_at.or(Some(run.updated_at))
    } else if lifecycle == "claimed" {
        created_at.or(Some(run.updated_at))
    } else {
        Some(run.updated_at)
    };

    Some(json!({
        "lifecycle": lifecycle,
        "claimedBy": "local-operator",
        "claimedAt": created_at,
        "lifecycleUpdatedAt": lifecycle_updated_at,
    }))
}
