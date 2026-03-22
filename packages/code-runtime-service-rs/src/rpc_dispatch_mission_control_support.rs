use super::*;
use crate::runtime_checkpoint::build_agent_task_checkpoint_state_payload;
#[path = "rpc_dispatch_mission_control_review.rs"]
mod review;

pub(crate) use review::{
    build_run_ledger, build_runtime_mission_linkage_summary,
    build_runtime_review_actionability_summary, derive_review_evidence_state,
    derive_review_validation_outcome,
};

pub(super) fn collect_workspace_roots(
    workspaces: &[MissionWorkspaceProjection],
) -> HashMap<String, String> {
    workspaces
        .iter()
        .map(|workspace| (workspace.id.clone(), workspace.root_path.clone()))
        .collect::<HashMap<_, _>>()
}

pub(super) fn build_governance_summary(
    run_state: &str,
    approval: &Value,
    review_decision: Option<&Value>,
    intervention: &Value,
    next_action: &Value,
    completion_reason: Option<&str>,
    sub_agents: &[MissionRunSubAgentSummary],
) -> Value {
    let mut available_actions = Vec::new();
    if let Some(actions) = intervention.get("actions").and_then(Value::as_array) {
        for action in actions {
            let enabled = action
                .get("enabled")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            let supported = action
                .get("supported")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            if enabled && supported {
                push_unique_action(
                    &mut available_actions,
                    action.get("action").and_then(Value::as_str),
                );
            }
        }
    }
    let review_status = review_decision
        .and_then(|entry| entry.get("status"))
        .and_then(Value::as_str);
    if review_status == Some("pending") {
        push_unique_action(&mut available_actions, Some("review_result"));
        push_unique_action(&mut available_actions, Some("accept_result"));
        push_unique_action(&mut available_actions, Some("reject_result"));
    }
    let next_action_value = next_action.get("action").and_then(Value::as_str);
    let primary_action = intervention.get("primaryAction").and_then(Value::as_str);
    if review_status == Some("accepted") {
        return json!({
            "state": "completed",
            "label": "Governance complete",
            "summary": review_decision
                .and_then(|entry| entry.get("summary"))
                .cloned()
                .unwrap_or_else(|| Value::String("Result accepted in review.".to_string())),
            "blocking": false,
            "suggestedAction": Value::Null,
            "availableActions": Vec::<String>::new(),
        });
    }
    if let Some(sub_agent) = sub_agents.iter().find(|summary| {
        summary.status == "awaiting_approval"
            || summary
                .approval_state
                .as_ref()
                .is_some_and(|approval| approval.status == "pending_decision")
    }) {
        return json!({
            "state": "awaiting_approval",
            "label": "Sub-agent awaiting approval",
            "summary": sub_agent.summary.clone().unwrap_or_else(|| {
                format!(
                    "Sub-agent {} is waiting for approval before the parent run can continue.",
                    sub_agent.session_id
                )
            }),
            "blocking": true,
            "suggestedAction": "continue_with_clarification",
            "availableActions": available_actions,
        });
    }
    if let Some(sub_agent) = sub_agents
        .iter()
        .find(|summary| summary.timed_out_reason.is_some())
    {
        return json!({
            "state": "action_required",
            "label": "Sub-agent timed out",
            "summary": sub_agent
                .timed_out_reason
                .clone()
                .or_else(|| sub_agent.summary.clone())
                .unwrap_or_else(|| {
                    format!(
                        "Sub-agent {} timed out and blocked the parent run.",
                        sub_agent.session_id
                    )
                }),
            "blocking": true,
            "suggestedAction": "retry",
            "availableActions": available_actions,
        });
    }
    if let Some(sub_agent) = sub_agents.iter().find(|summary| {
        matches!(
            summary.status.as_str(),
            "failed" | "cancelled" | "interrupted"
        )
    }) {
        return json!({
            "state": "action_required",
            "label": "Sub-agent requires operator action",
            "summary": sub_agent
                .interrupted_reason
                .clone()
                .or_else(|| sub_agent.summary.clone())
                .unwrap_or_else(|| {
                    format!(
                        "Sub-agent {} requires operator intervention before the parent run should continue.",
                        sub_agent.session_id
                    )
                }),
            "blocking": true,
            "suggestedAction": "retry",
            "availableActions": available_actions,
        });
    }
    if approval.get("status").and_then(Value::as_str) == Some("pending_decision") {
        return json!({
            "state": "awaiting_approval",
            "label": "Awaiting approval",
            "summary": approval.get("summary").cloned().unwrap_or(Value::Null),
            "blocking": true,
            "suggestedAction": if next_action_value == Some("review") {
                Value::String("review_result".to_string())
            } else {
                next_action_value
                    .map(|value| Value::String(value.to_string()))
                    .unwrap_or(Value::Null)
            },
            "availableActions": available_actions,
        });
    }
    if run_state == "review_ready" && review_status == Some("pending") {
        return json!({
            "state": "awaiting_review",
            "label": "Awaiting review decision",
            "summary": review_decision
                .and_then(|entry| entry.get("summary"))
                .cloned()
                .unwrap_or_else(|| Value::String("Accept or reject this result from the review surface.".to_string())),
            "blocking": true,
            "suggestedAction": "review_result",
            "availableActions": available_actions,
        });
    }
    if review_status == Some("rejected")
        || matches!(run_state, "failed" | "cancelled" | "paused" | "needs_input")
    {
        return json!({
            "state": "action_required",
            "label": "Operator action required",
            "summary": review_decision
                .and_then(|entry| entry.get("summary"))
                .cloned()
                .unwrap_or_else(|| {
                    next_action.get("detail").cloned().unwrap_or_else(|| {
                        completion_reason
                            .map(|value| Value::String(value.to_string()))
                            .unwrap_or_else(|| {
                                Value::String("This run needs explicit operator intervention before it should continue.".to_string())
                            })
                    })
                }),
            "blocking": true,
            "suggestedAction": if review_status == Some("rejected") {
                primary_action
                    .map(|value| Value::String(value.to_string()))
                    .unwrap_or_else(|| Value::String("review_result".to_string()))
            } else if next_action_value == Some("review") {
                Value::String("review_result".to_string())
            } else {
                next_action_value
                    .map(|value| Value::String(value.to_string()))
                    .unwrap_or(Value::Null)
            },
            "availableActions": available_actions,
        });
    }
    json!({
        "state": "in_progress",
        "label": "Runtime-governed execution",
        "summary": next_action
            .get("detail")
            .cloned()
            .unwrap_or_else(|| Value::String("The runtime is still executing this run and can surface an intervention when needed.".to_string())),
        "blocking": false,
        "suggestedAction": if next_action_value == Some("review") {
            Value::String("review_result".to_string())
        } else {
            next_action_value
                .map(|value| Value::String(value.to_string()))
                .unwrap_or(Value::Null)
        },
        "availableActions": available_actions,
    })
}

pub(crate) fn derive_run_validations(summary: &AgentTaskSummary) -> Vec<Value> {
    summary
        .steps
        .iter()
        .filter(|step| step.kind == "diagnostics")
        .map(|step| {
            let outcome = if step.status == "failed"
                || step.error_code.is_some()
                || step.error_message.is_some()
            {
                "failed"
            } else if step.status == "completed" {
                "passed"
            } else if matches!(step.status.as_str(), "queued" | "cancelled" | "interrupted") {
                "skipped"
            } else {
                "unknown"
            };
            let summary_text = trim_to_option(step.error_message.as_deref())
                .or_else(|| trim_to_option(step.output.as_deref()))
                .unwrap_or_else(|| {
                    let message = step.message.trim();
                    if message.is_empty() {
                        "Diagnostics step completed without recorded detail.".to_string()
                    } else {
                        message.to_string()
                    }
                });
            json!({
                "id": format!("{}:validation:{}", summary.task_id, step.index),
                "label": format!("Check {}", step.index + 1),
                "outcome": outcome,
                "summary": summary_text,
                "startedAt": step.started_at,
                "finishedAt": step.completed_at,
            })
        })
        .collect()
}

pub(crate) fn derive_run_artifacts(runtime: &AgentTaskRuntime) -> Vec<Value> {
    let summary = &runtime.summary;
    let mut artifacts = Vec::new();
    let checkpoint = build_agent_task_checkpoint_state_payload(
        summary,
        runtime.recovered,
        runtime.checkpoint_id.as_deref(),
    );
    let fallback_trace_id = agent_task_trace_id(summary.task_id.as_str());
    let trace_id = checkpoint
        .get("traceId")
        .and_then(Value::as_str)
        .unwrap_or(fallback_trace_id.as_str())
        .to_string();
    if summary
        .steps
        .iter()
        .any(|step| matches!(step.kind.as_str(), "write" | "edit"))
    {
        artifacts.push(json!({
            "id": format!("diff:{}", summary.task_id),
            "label": "Workspace diff",
            "kind": "diff",
            "uri": format!("mission-control://runs/{}/diff", summary.task_id),
        }));
    }
    if let Some(checkpoint_id) = checkpoint.get("checkpointId").and_then(Value::as_str) {
        artifacts.push(json!({
            "id": format!("checkpoint:{checkpoint_id}"),
            "label": format!("Checkpoint {checkpoint_id}"),
            "kind": "evidence",
            "uri": format!("checkpoint://{checkpoint_id}"),
        }));
    }
    artifacts.push(json!({
        "id": format!("trace:{trace_id}"),
        "label": format!("Trace {trace_id}"),
        "kind": "log",
        "uri": format!("trace://{trace_id}"),
    }));
    for step in summary
        .steps
        .iter()
        .filter(|step| step.kind == "diagnostics")
    {
        artifacts.push(json!({
            "id": format!("{}:artifact:{}", summary.task_id, step.index),
            "label": format!("Diagnostics {}", step.index + 1),
            "kind": "validation",
            "uri": format!("validation://{}/{}", summary.task_id, step.index),
        }));
    }
    for step in summary
        .steps
        .iter()
        .filter(|step| matches!(step.kind.as_str(), "bash" | "js_repl"))
    {
        artifacts.push(json!({
            "id": format!("{}:command:{}", summary.task_id, step.index),
            "label": format!("Command {}", step.index + 1),
            "kind": "command",
            "uri": format!("command://{}/{}", summary.task_id, step.index),
        }));
    }
    artifacts
}

pub(super) fn derive_run_changed_paths(summary: &AgentTaskSummary) -> Vec<String> {
    let mut changed_paths = Vec::new();
    for step in summary
        .steps
        .iter()
        .filter(|step| matches!(step.kind.as_str(), "write" | "edit"))
    {
        let path = step
            .metadata
            .get("safety")
            .and_then(Value::as_object)
            .and_then(|entry| entry.get("path"))
            .and_then(Value::as_str)
            .or_else(|| {
                step.metadata
                    .get("approval")
                    .and_then(Value::as_object)
                    .and_then(|entry| {
                        let scope_kind = entry.get("scopeKind").and_then(Value::as_str);
                        let scope_target = entry.get("scopeTarget").and_then(Value::as_str);
                        (scope_kind == Some("file-target"))
                            .then_some(scope_target)
                            .flatten()
                    })
            });
        push_unique_text(&mut changed_paths, path);
    }
    changed_paths
}

pub(crate) fn derive_run_warnings(runtime: &AgentTaskRuntime) -> Vec<String> {
    let summary = &runtime.summary;
    let mut warnings = Vec::new();
    push_unique_text(&mut warnings, summary.error_message.as_deref());
    if summary.status == "awaiting_approval" {
        push_unique_text(&mut warnings, Some("Run is waiting on operator input."));
    }
    if summary.status == "interrupted" && is_recoverable_runtime_task(runtime) {
        push_unique_text(
            &mut warnings,
            Some("Run was interrupted and can resume from a checkpoint."),
        );
    }
    if summary.status == "paused" {
        push_unique_text(&mut warnings, Some("Run is paused and waiting to resume."));
    }
    for step in &summary.steps {
        push_unique_text(&mut warnings, step.error_message.as_deref());
    }
    warnings
}

pub(super) fn derive_completion_reason(
    runtime: &AgentTaskRuntime,
    run_state: &str,
) -> Option<String> {
    let summary = &runtime.summary;
    if let Some(error_message) = trim_to_option(summary.error_message.as_deref()) {
        return Some(error_message);
    }
    match run_state {
        "review_ready" => Some("Run completed.".to_string()),
        "failed" => Some("Run failed.".to_string()),
        "cancelled" => Some(if is_recoverable_runtime_task(runtime) {
            "Run was interrupted but can resume from a checkpoint.".to_string()
        } else {
            "Run was cancelled.".to_string()
        }),
        _ => None,
    }
}

fn build_takeover_target_from_mission_linkage(mission_linkage: Option<&Value>) -> Option<Value> {
    let navigation_target = mission_linkage?.get("navigationTarget")?;
    let kind = navigation_target.get("kind").and_then(Value::as_str)?;
    match kind {
        "thread" | "run" => Some(navigation_target.clone()),
        _ => None,
    }
}

fn build_review_pack_takeover_target(
    mission_linkage: Option<&Value>,
    review_pack_id: Option<&str>,
) -> Option<Value> {
    let review_pack_id = review_pack_id?;
    let mission_linkage = mission_linkage?;
    Some(json!({
        "kind": "review_pack",
        "workspaceId": mission_linkage.get("workspaceId").and_then(Value::as_str),
        "taskId": mission_linkage.get("taskId").and_then(Value::as_str),
        "runId": mission_linkage.get("runId").and_then(Value::as_str),
        "reviewPackId": review_pack_id,
        "checkpointId": mission_linkage.get("checkpointId").and_then(Value::as_str),
        "traceId": mission_linkage.get("traceId").and_then(Value::as_str),
    }))
}

pub(crate) fn build_runtime_takeover_bundle(
    run_state: &str,
    approval: &Value,
    next_action: &Value,
    checkpoint: &Value,
    mission_linkage: Option<&Value>,
    review_pack_id: Option<&str>,
    publish_handoff: Option<&Value>,
    review_actionability: Option<&Value>,
) -> Value {
    let checkpoint_summary = checkpoint
        .get("summary")
        .and_then(Value::as_str)
        .unwrap_or("Runtime published checkpoint truth for this run.");
    let checkpoint_id = checkpoint.get("checkpointId").and_then(Value::as_str);
    let trace_id = checkpoint.get("traceId").and_then(Value::as_str);
    let approval_pending =
        approval.get("status").and_then(Value::as_str) == Some("pending_decision");
    let review_state = review_actionability
        .and_then(|entry| entry.get("state"))
        .and_then(Value::as_str)
        .unwrap_or("attention");
    let review_summary = review_actionability
        .and_then(|entry| entry.get("summary"))
        .and_then(Value::as_str)
        .unwrap_or("Review follow-up requires operator attention.");
    let resume_ready = checkpoint.get("resumeReady").and_then(Value::as_bool) == Some(true);
    let recovered = checkpoint.get("recovered").and_then(Value::as_bool) == Some(true);
    let lifecycle_state = checkpoint.get("lifecycleState").and_then(Value::as_str);
    let workflow_state = checkpoint.get("state").and_then(Value::as_str);
    let next_action_name = next_action.get("action").and_then(Value::as_str);
    let looks_recoverable = recovered
        || lifecycle_state == Some("paused")
        || lifecycle_state == Some("interrupted")
        || workflow_state == Some("interrupted")
        || next_action_name == Some("resume");
    let mission_target = build_takeover_target_from_mission_linkage(mission_linkage);
    let has_handoff = publish_handoff.is_some() || mission_target.is_some();
    let handoff_summary = publish_handoff
        .and_then(|entry| entry.get("summary"))
        .and_then(Value::as_str)
        .or_else(|| {
            mission_linkage
                .and_then(|entry| entry.get("summary"))
                .and_then(Value::as_str)
        })
        .unwrap_or("Runtime published a canonical handoff path for this run.");

    if approval_pending {
        let summary = approval
            .get("summary")
            .and_then(Value::as_str)
            .unwrap_or("Run is waiting for operator approval before it can continue.");
        return json!({
            "state": "blocked",
            "pathKind": "approval",
            "primaryAction": "approve",
            "summary": summary,
            "blockingReason": summary,
            "recommendedAction": "Resolve the pending runtime approval before attempting takeover.",
            "target": mission_target,
            "checkpointId": checkpoint_id,
            "traceId": trace_id,
            "reviewPackId": review_pack_id,
            "publishHandoff": publish_handoff.cloned(),
            "reviewActionability": review_actionability.cloned(),
        });
    }

    if run_state == "review_ready" && review_actionability.is_some() {
        let (state, blocking_reason, recommended_action) = match review_state {
            "blocked" => (
                "blocked",
                Some(review_summary),
                "Open Review Pack and resolve the runtime-blocked follow-up before continuing.",
            ),
            "degraded" => (
                "attention",
                None,
                "Open Review Pack and inspect the degraded runtime follow-up guidance before continuing.",
            ),
            _ => (
                "ready",
                None,
                "Continue from Review Pack using the runtime-published follow-up actions.",
            ),
        };
        return json!({
            "state": state,
            "pathKind": "review",
            "primaryAction": "open_review_pack",
            "summary": review_summary,
            "blockingReason": blocking_reason,
            "recommendedAction": recommended_action,
            "target": build_review_pack_takeover_target(mission_linkage, review_pack_id),
            "checkpointId": checkpoint_id,
            "traceId": trace_id,
            "reviewPackId": review_pack_id,
            "publishHandoff": publish_handoff.cloned(),
            "reviewActionability": review_actionability.cloned(),
        });
    }

    if resume_ready {
        return json!({
            "state": "ready",
            "pathKind": "resume",
            "primaryAction": "resume",
            "summary": checkpoint_summary,
            "blockingReason": Value::Null,
            "recommendedAction": "Resume this run from its runtime-published checkpoint.",
            "target": mission_target,
            "checkpointId": checkpoint_id,
            "traceId": trace_id,
            "reviewPackId": review_pack_id,
            "publishHandoff": publish_handoff.cloned(),
            "reviewActionability": review_actionability.cloned(),
        });
    }

    if has_handoff {
        return json!({
            "state": "ready",
            "pathKind": "handoff",
            "primaryAction": "open_handoff",
            "summary": handoff_summary,
            "blockingReason": Value::Null,
            "recommendedAction": "Use the runtime-published handoff or navigation target instead of rebuilding recovery locally.",
            "target": mission_target,
            "checkpointId": checkpoint_id,
            "traceId": trace_id,
            "reviewPackId": review_pack_id,
            "publishHandoff": publish_handoff.cloned(),
            "reviewActionability": review_actionability.cloned(),
        });
    }

    if looks_recoverable {
        return json!({
            "state": "blocked",
            "pathKind": "missing",
            "primaryAction": "inspect_runtime",
            "summary": checkpoint_summary,
            "blockingReason": "This run looks recoverable, but runtime did not publish a canonical continue path.",
            "recommendedAction": "Inspect runtime continuity truth and restore a canonical resume or handoff path before continuing.",
            "target": Value::Null,
            "checkpointId": checkpoint_id,
            "traceId": trace_id,
            "reviewPackId": review_pack_id,
            "publishHandoff": publish_handoff.cloned(),
            "reviewActionability": review_actionability.cloned(),
        });
    }

    json!({
        "state": "attention",
        "pathKind": "missing",
        "primaryAction": "inspect_runtime",
        "summary": "Runtime has not published a canonical takeover path yet.",
        "blockingReason": Value::Null,
        "recommendedAction": "Inspect runtime continuity truth before relying on local continuation heuristics.",
        "target": Value::Null,
        "checkpointId": checkpoint_id,
        "traceId": trace_id,
        "reviewPackId": review_pack_id,
        "publishHandoff": publish_handoff.cloned(),
        "reviewActionability": review_actionability.cloned(),
    })
}

pub(crate) fn build_runtime_sub_agent_takeover_bundle(summary: &SubAgentSessionSummary) -> Value {
    let checkpoint_state = summary.checkpoint_state.as_ref();
    let checkpoint_summary = checkpoint_state
        .and_then(|entry| entry.summary.as_deref())
        .or(summary.error_message.as_deref())
        .unwrap_or("Runtime published sub-agent continuation truth.");
    let checkpoint_id = checkpoint_state
        .and_then(|entry| entry.checkpoint_id.as_deref())
        .or(summary.checkpoint_id.as_deref());
    let trace_id = checkpoint_state
        .map(|entry| entry.trace_id.as_str())
        .or(summary.trace_id.as_deref());
    let target = json!({
        "kind": "sub_agent_session",
        "workspaceId": summary.workspace_id,
        "sessionId": summary.session_id,
        "parentRunId": summary.parent_run_id,
        "threadId": summary.thread_id,
        "activeTaskId": summary.active_task_id,
        "lastTaskId": summary.last_task_id,
        "checkpointId": checkpoint_id,
        "traceId": trace_id,
    });
    let pending_approval = summary
        .approval_events
        .as_ref()
        .and_then(|entries| entries.last())
        .is_some_and(|event| event.status == "requested");
    if pending_approval {
        let approval_summary = summary
            .approval_events
            .as_ref()
            .and_then(|entries| entries.last())
            .and_then(|event| event.reason.as_deref())
            .unwrap_or("Sub-agent session is waiting for operator approval.");
        return json!({
            "state": "blocked",
            "pathKind": "approval",
            "primaryAction": "approve",
            "summary": approval_summary,
            "blockingReason": approval_summary,
            "recommendedAction": "Resolve the pending sub-agent approval before continuing this session.",
            "target": target,
            "checkpointId": checkpoint_id,
            "traceId": trace_id,
            "reviewPackId": Value::Null,
            "publishHandoff": Value::Null,
            "reviewActionability": Value::Null,
        });
    }

    let resume_ready = checkpoint_state.is_some_and(|entry| entry.resume_ready == Some(true))
        || summary.recovered == Some(true);
    if resume_ready {
        return json!({
            "state": "ready",
            "pathKind": "resume",
            "primaryAction": "resume",
            "summary": checkpoint_summary,
            "blockingReason": Value::Null,
            "recommendedAction": "Resume this sub-agent session from its runtime-published checkpoint.",
            "target": target,
            "checkpointId": checkpoint_id,
            "traceId": trace_id,
            "reviewPackId": Value::Null,
            "publishHandoff": Value::Null,
            "reviewActionability": Value::Null,
        });
    }

    if trim_to_option(summary.parent_run_id.as_deref()).is_some()
        || trim_to_option(summary.thread_id.as_deref()).is_some()
    {
        return json!({
            "state": "ready",
            "pathKind": "handoff",
            "primaryAction": "open_sub_agent_session",
            "summary": "Use the runtime sub-agent session handle to continue supervision or takeover.",
            "blockingReason": Value::Null,
            "recommendedAction": "Continue through the runtime sub-agent session handle instead of rebuilding session state locally.",
            "target": target,
            "checkpointId": checkpoint_id,
            "traceId": trace_id,
            "reviewPackId": Value::Null,
            "publishHandoff": Value::Null,
            "reviewActionability": Value::Null,
        });
    }

    json!({
        "state": "blocked",
        "pathKind": "missing",
        "primaryAction": "inspect_runtime",
        "summary": checkpoint_summary,
        "blockingReason": "Runtime did not publish a canonical continuation path for this sub-agent session.",
        "recommendedAction": "Inspect runtime session truth before attempting takeover of this sub-agent.",
        "target": target,
        "checkpointId": checkpoint_id,
        "traceId": trace_id,
        "reviewPackId": Value::Null,
        "publishHandoff": Value::Null,
        "reviewActionability": Value::Null,
    })
}

fn normalize_backend_ids(values: Option<&Vec<String>>) -> Vec<String> {
    values
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .map(|entry| entry.trim().to_string())
        .filter(|entry| !entry.is_empty())
        .fold(Vec::new(), |mut unique, entry| {
            if !unique.iter().any(|existing| existing == &entry) {
                unique.push(entry);
            }
            unique
        })
}

fn resolve_placement_source(
    resolved_backend_id: Option<&str>,
    requested_backend_ids: &[String],
    routing_strategy: Option<&str>,
) -> &'static str {
    if resolved_backend_id.is_none() {
        return "unresolved";
    }
    if !requested_backend_ids.is_empty() {
        return if requested_backend_ids
            .iter()
            .any(|entry| Some(entry.as_str()) == resolved_backend_id)
        {
            "explicit_preference"
        } else {
            "runtime_fallback"
        };
    }
    if routing_strategy == Some("provider_route") {
        return "provider_route";
    }
    "workspace_default"
}

fn resolve_placement_lifecycle_state(
    resolved_backend_id: Option<&str>,
    requested_backend_ids: &[String],
    backend_contract: &Value,
    routing_health: Option<&str>,
) -> &'static str {
    if resolved_backend_id.is_none() {
        return if requested_backend_ids.is_empty() {
            "unresolved"
        } else {
            "requested"
        };
    }
    if !requested_backend_ids.is_empty()
        && !requested_backend_ids
            .iter()
            .any(|entry| Some(entry.as_str()) == resolved_backend_id)
    {
        return "fallback";
    }
    if !backend_contract.is_null() || routing_health.is_some() {
        return "confirmed";
    }
    "resolved"
}

fn build_placement_summary(
    resolved_backend_id: Option<&str>,
    resolution_source: &str,
    lifecycle_state: &str,
    routing_health: Option<&str>,
) -> (&'static str, String) {
    let readiness_rationale = routing_health
        .filter(|health| *health != "ready")
        .map(|health| format!(" Routing readiness is currently {health}."))
        .unwrap_or_default();

    match (resolved_backend_id, resolution_source, lifecycle_state) {
        (_, _, "requested") => (
            "placement_requested",
            "Mission Control recorded backend intent, but runtime has not confirmed a concrete backend yet.".to_string(),
        ),
        (_, _, "unresolved") => (
            "placement_unresolved",
            format!(
                "Runtime has not recorded a concrete backend placement for this run yet.{readiness_rationale}"
            ),
        ),
        (Some(backend_id), _, "resolved") => (
            "placement_resolved",
            format!(
                "Runtime selected {backend_id}, but placement metadata is incomplete.{readiness_rationale}"
            ),
        ),
        (Some(backend_id), _, "fallback") => (
            "placement_fallback_confirmed",
            format!(
                "Runtime selected {backend_id} instead of the requested backend set, which indicates fallback placement.{readiness_rationale}"
            ),
        ),
        (Some(backend_id), "explicit_preference", "confirmed") => (
            "placement_confirmed_requested",
            format!(
                "Mission Control requested {backend_id} and runtime confirmed that placement.{readiness_rationale}"
            ),
        ),
        (Some(_backend_id), "provider_route", "confirmed") => (
            "placement_confirmed_provider_route",
            format!(
                "Execution profile routing used provider-level placement rather than an explicit backend preference.{readiness_rationale}"
            ),
        ),
        (Some(_backend_id), "workspace_default", "confirmed") => (
            "placement_confirmed_workspace_default",
            format!(
                "No explicit backend preference was recorded, so runtime used the default workspace backend.{readiness_rationale}"
            ),
        ),
        (Some(backend_id), _, _) => (
            "placement_confirmed",
            format!("Runtime recorded {backend_id} as the backend for this run.{readiness_rationale}"),
        ),
        _ => (
            "placement_unresolved",
            format!(
                "Runtime has not recorded a concrete backend placement for this run yet.{readiness_rationale}"
            ),
        ),
    }
}

fn collect_placement_attention_reasons(
    lifecycle_state: &str,
    resolved_backend_id: Option<&str>,
    routing_health: Option<&str>,
    backend: Option<&RuntimeBackendSummary>,
    backend_contract: &Value,
) -> Vec<String> {
    let mut reasons = Vec::new();

    match lifecycle_state {
        "requested" => push_unique_text(&mut reasons, Some("awaiting_backend_confirmation")),
        "unresolved" => push_unique_text(&mut reasons, Some("placement_unresolved")),
        "resolved" => push_unique_text(&mut reasons, Some("placement_metadata_incomplete")),
        "fallback" => push_unique_text(&mut reasons, Some("fallback_backend_selected")),
        _ => {}
    }

    if resolved_backend_id.is_some() && backend.is_none() && backend_contract.is_null() {
        push_unique_text(&mut reasons, Some("backend_metadata_missing"));
    }

    if let Some(backend) = backend {
        let operability = assess_runtime_backend_operability(backend, backend.running_tasks);
        if !backend.healthy {
            push_unique_text(&mut reasons, Some("backend_unhealthy"));
        }
        match backend.status.as_str() {
            "disabled" => push_unique_text(&mut reasons, Some("backend_disabled")),
            "draining" => push_unique_text(&mut reasons, Some("backend_draining")),
            _ => {}
        }
        if !matches!(backend.rollout_state.as_str(), "current" | "ramping") {
            push_unique_text(&mut reasons, Some("backend_rollout_inactive"));
        }
        if backend.queue_depth > 0 {
            push_unique_text(&mut reasons, Some("backend_queue_depth"));
        }
        if backend.max_concurrency > 0 && backend.running_tasks >= backend.max_concurrency {
            push_unique_text(&mut reasons, Some("backend_at_capacity"));
        }
        if backend.failures > 0 {
            push_unique_text(&mut reasons, Some("backend_failures_detected"));
        }
        match operability.reachability.as_deref() {
            Some("degraded") => {
                push_unique_text(&mut reasons, Some("backend_connectivity_degraded"))
            }
            Some("unreachable") => {
                push_unique_text(&mut reasons, Some("backend_connectivity_unreachable"))
            }
            _ => {}
        }
        match operability.lease_status.as_deref() {
            Some("expiring") => push_unique_text(&mut reasons, Some("backend_lease_expiring")),
            Some("expired") => push_unique_text(&mut reasons, Some("backend_lease_expired")),
            Some("released") => push_unique_text(&mut reasons, Some("backend_lease_released")),
            _ => {}
        }
        if operability.heartbeat_state == "stale" {
            push_unique_text(&mut reasons, Some("backend_heartbeat_stale"));
        }
        match operability.readiness_state.as_deref() {
            Some("attention") => {
                push_unique_text(&mut reasons, Some("backend_readiness_attention"))
            }
            Some("blocked") => push_unique_text(&mut reasons, Some("backend_readiness_blocked")),
            _ => {}
        }
    } else if resolved_backend_id.is_none() {
        match routing_health {
            Some("attention") => push_unique_text(&mut reasons, Some("routing_metadata_missing")),
            Some("blocked") => push_unique_text(&mut reasons, Some("routing_unavailable")),
            _ => {}
        }
    }

    reasons
}

fn derive_placement_health_summary(
    routing_health: Option<&str>,
    attention_reasons: &[String],
) -> &'static str {
    if routing_health == Some("blocked") {
        "placement_blocked"
    } else if attention_reasons.is_empty() {
        "placement_ready"
    } else {
        "placement_attention"
    }
}

pub(crate) fn build_placement_evidence(
    summary: &AgentTaskSummary,
    routing: &Value,
    execution_profile: &Value,
    backend_summaries: &HashMap<String, RuntimeBackendSummary>,
) -> Option<Value> {
    let requested_backend_ids = normalize_backend_ids(summary.preferred_backend_ids.as_ref());
    let routing_health = routing.get("health").and_then(Value::as_str);
    let resolved_backend_id = routing
        .get("backendId")
        .and_then(Value::as_str)
        .or(summary.backend_id.as_deref());
    let resolution_source = resolve_placement_source(
        resolved_backend_id,
        requested_backend_ids.as_slice(),
        execution_profile
            .get("routingStrategy")
            .and_then(Value::as_str),
    );
    let backend = resolved_backend_id.and_then(|backend_id| backend_summaries.get(backend_id));
    let backend_contract = backend
        .map(|backend| {
            backend
                .contract
                .clone()
                .unwrap_or_else(|| build_runtime_backend_contract(backend))
        })
        .unwrap_or(Value::Null);
    let lifecycle_state = resolve_placement_lifecycle_state(
        resolved_backend_id,
        requested_backend_ids.as_slice(),
        &backend_contract,
        routing_health,
    );
    if lifecycle_state == "unresolved"
        && requested_backend_ids.is_empty()
        && backend_contract.is_null()
        && routing_health.is_none()
    {
        return None;
    }
    let (summary_key, rationale) = build_placement_summary(
        resolved_backend_id,
        resolution_source,
        lifecycle_state,
        routing_health,
    );
    let attention_reasons = collect_placement_attention_reasons(
        lifecycle_state,
        resolved_backend_id,
        routing_health,
        backend,
        &backend_contract,
    );
    let health_summary = derive_placement_health_summary(routing_health, &attention_reasons);
    let fallback_reason_code = trim_to_option(summary.placement_fallback_reason_code.as_deref());
    let resume_backend_id = trim_to_option(summary.resume_backend_id.as_deref());
    let score_breakdown = summary
        .placement_score_breakdown
        .as_ref()
        .filter(|value| value.is_array())
        .cloned()
        .unwrap_or(Value::Null);
    let summary_text = match (summary_key, resolved_backend_id) {
        ("placement_requested", _) => {
            "Requested backend placement is waiting for runtime confirmation.".to_string()
        }
        ("placement_resolved", Some(backend_id)) => {
            format!(
                "Runtime resolved backend {backend_id}, but confirmation details are incomplete."
            )
        }
        ("placement_confirmed_requested", Some(backend_id)) => {
            format!("Runtime confirmed the requested backend {backend_id}.")
        }
        ("placement_fallback_confirmed", Some(backend_id)) => {
            format!("Runtime confirmed fallback placement on backend {backend_id}.")
        }
        ("placement_confirmed_provider_route", Some(backend_id)) => {
            format!("Runtime confirmed provider-routed placement on backend {backend_id}.")
        }
        ("placement_confirmed_workspace_default", Some(backend_id)) => {
            format!("Runtime confirmed workspace-default placement on backend {backend_id}.")
        }
        ("placement_confirmed", Some(backend_id)) => {
            format!("Runtime confirmed backend placement on {backend_id}.")
        }
        _ => "Placement is unresolved.".to_string(),
    };
    Some(json!({
        "resolvedBackendId": resolved_backend_id,
        "requestedBackendIds": requested_backend_ids,
        "resolutionSource": resolution_source,
        "lifecycleState": lifecycle_state,
        "readiness": routing_health,
        "healthSummary": health_summary,
        "attentionReasons": attention_reasons,
        "summary": summary_text,
        "rationale": rationale,
        "fallbackReasonCode": fallback_reason_code,
        "resumeBackendId": resume_backend_id,
        "scoreBreakdown": score_breakdown,
        "backendContract": backend_contract,
    }))
}

pub(crate) fn build_task_routing(
    summary: &AgentTaskSummary,
    backend: Option<&RuntimeBackendSummary>,
) -> Value {
    let provider = trim_to_option(
        summary
            .routed_provider
            .as_deref()
            .or(summary.provider.as_deref()),
    );
    let pool = trim_to_option(summary.routed_pool.as_deref());
    let backend_label = backend.and_then(|entry| trim_to_option(Some(entry.display_name.as_str())));
    let route_label = match (
        backend_label.as_deref(),
        provider.as_deref(),
        pool.as_deref(),
    ) {
        (Some(backend_label), Some(provider), Some(pool)) => {
            format!("{backend_label} / {provider} / {pool}")
        }
        (Some(backend_label), Some(provider), None) => format!("{backend_label} / {provider}"),
        (Some(backend_label), None, _) => backend_label.to_string(),
        (None, Some(provider), Some(pool)) => format!("{provider} / {pool}"),
        (None, Some(provider), None) => provider.to_string(),
        (None, None, _) => "Route pending".to_string(),
    };
    let (health, route_hint, backend_operability) = match backend {
        Some(backend) => {
            let operability = build_runtime_backend_operability_value(backend, backend.running_tasks);
            let health = operability
                .get("state")
                .and_then(Value::as_str)
                .unwrap_or("attention")
                .to_string();
            let hint = operability
                .get("summary")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
                .or_else(|| {
                    Some(format!(
                        "Placed on backend {} with operability state {}.",
                        backend.display_name, health
                    ))
                });
            (health, hint, Some(operability))
        }
        None if provider.is_some() => (
            "attention".to_string(),
            Some(
                "Runtime snapshot records the chosen route, but no concrete backend placement metadata was attached."
                    .to_string(),
            ),
            None,
        ),
        None => (
            "blocked".to_string(),
            Some("Runtime snapshot has not recorded routing metadata yet.".to_string()),
            None,
        ),
    };
    let requested_backend_ids = normalize_backend_ids(summary.preferred_backend_ids.as_ref());
    let resolution_source = resolve_placement_source(
        summary.backend_id.as_deref(),
        requested_backend_ids.as_slice(),
        Some("workspace_default"),
    );
    let lifecycle_state = match summary.backend_id.as_deref() {
        None => {
            if requested_backend_ids.is_empty() {
                "unresolved"
            } else {
                "requested"
            }
        }
        Some(resolved_backend_id)
            if !requested_backend_ids.is_empty()
                && !requested_backend_ids
                    .iter()
                    .any(|entry| entry.as_str() == resolved_backend_id) =>
        {
            "fallback"
        }
        Some(_) if backend.is_some() => "confirmed",
        Some(_) => "resolved",
    };

    json!({
        "backendId": summary.backend_id,
        "provider": provider,
        "providerLabel": provider,
        "pool": pool,
        "routeLabel": route_label,
        "routeHint": route_hint,
        "health": health,
        "backendOperability": backend_operability,
        "resolutionSource": resolution_source,
        "lifecycleState": lifecycle_state,
        "enabledAccountCount": 0,
        "readyAccountCount": 0,
        "enabledPoolCount": 0,
    })
}

pub(super) fn build_routing(
    runtime: &AgentTaskRuntime,
    backend: Option<&RuntimeBackendSummary>,
) -> Value {
    build_task_routing(&runtime.summary, backend)
}

pub(crate) fn build_profile_readiness(routing: &Value) -> Value {
    let route_hint = routing
        .get("routeHint")
        .and_then(Value::as_str)
        .unwrap_or("Routing readiness is not yet confirmed by runtime snapshot.");
    let health = routing
        .get("health")
        .and_then(Value::as_str)
        .unwrap_or("attention");
    let summary = match health {
        "ready" => "Profile is ready for delegated execution.",
        "attention" => route_hint,
        _ => route_hint,
    };
    let issues = if health == "ready" {
        Vec::<String>::new()
    } else {
        vec![route_hint.to_string()]
    };
    json!({
        "ready": health == "ready",
        "health": health,
        "summary": summary,
        "issues": issues,
    })
}

pub(super) fn build_review_pack_assumptions(
    run: &MissionRunProjection,
    review_status: &str,
) -> Vec<String> {
    let mut assumptions = Vec::new();
    push_unique_text(
        &mut assumptions,
        run.title
            .as_deref()
            .or(run.summary.as_deref())
            .map(|title| format!("Objective carried into review: {title}."))
            .as_deref(),
    );
    push_unique_text(
        &mut assumptions,
        run.execution_profile
            .as_ref()
            .and_then(|profile| profile.get("name"))
            .and_then(Value::as_str)
            .map(|name| {
                format!(
                    "Review assumes the \"{name}\" execution profile guardrails were enforced during execution."
                )
            })
            .as_deref(),
    );
    if review_status == "incomplete_evidence" {
        push_unique_text(
            &mut assumptions,
            Some(
                "Acceptance should be treated as provisional until missing evidence is re-collected or reviewed elsewhere.",
            ),
        );
    }
    assumptions
}

pub(super) fn build_review_pack_reproduction_guidance(run: &MissionRunProjection) -> Vec<String> {
    let mut guidance = Vec::new();
    for validation in &run.validations {
        let label = validation.get("label").and_then(Value::as_str);
        let summary = validation.get("summary").and_then(Value::as_str);
        match (label, summary) {
            (Some(label), Some(summary)) => {
                let value = format!("Re-run {label}: {summary}");
                if !guidance.iter().any(|entry| entry == &value) {
                    guidance.push(value);
                }
            }
            (Some(label), None) => {
                let value = format!("Re-run {label}.");
                if !guidance.iter().any(|entry| entry == &value) {
                    guidance.push(value);
                }
            }
            _ => {}
        }
    }
    if guidance.is_empty() {
        let checks = run
            .validations
            .iter()
            .filter_map(|validation| validation.get("label").and_then(Value::as_str))
            .collect::<Vec<_>>();
        if !checks.is_empty() {
            let value = format!("Re-run recorded checks: {}.", checks.join(", "));
            if !guidance.iter().any(|entry| entry == &value) {
                guidance.push(value);
            }
        }
    }
    for artifact in &run.artifacts {
        let kind = artifact.get("kind").and_then(Value::as_str);
        let label = artifact.get("label").and_then(Value::as_str);
        let uri = artifact.get("uri").and_then(Value::as_str);
        if matches!(kind, Some("validation" | "log" | "command")) {
            if let (Some(label), Some(uri)) = (label, uri) {
                let value = format!("Inspect {label} at {uri}.");
                if !guidance.iter().any(|entry| entry == &value) {
                    guidance.push(value);
                }
            }
        }
    }
    guidance
}

pub(super) fn build_review_pack_rollback_guidance(
    run: &MissionRunProjection,
    task_id: &str,
) -> Vec<String> {
    let mut guidance = Vec::new();
    let diff_labels = run
        .artifacts
        .iter()
        .filter(|artifact| artifact.get("kind").and_then(Value::as_str) == Some("diff"))
        .filter_map(|artifact| artifact.get("label").and_then(Value::as_str))
        .collect::<Vec<_>>();
    if !diff_labels.is_empty() {
        let value = format!(
            "Use {} as the rollback reference before reverting affected files.",
            diff_labels.join(", ")
        );
        if !guidance.iter().any(|entry| entry == &value) {
            guidance.push(value);
        }
    }
    if task_id.starts_with(RUNTIME_TASK_ENTITY_PREFIX) {
        push_unique_text(
            &mut guidance,
            Some(
                "Open the mission detail to retry, narrow scope, or reroute instead of making an untracked follow-up edit.",
            ),
        );
    }
    guidance
}

pub(super) fn build_review_pack_backend_audit(run: &MissionRunProjection) -> Value {
    let mut details = Vec::new();
    if let Some(routing) = run.routing.as_ref() {
        if let Some(value) = routing.get("providerLabel").and_then(Value::as_str) {
            let detail = format!("Provider: {value}");
            if !details.iter().any(|entry| entry == &detail) {
                details.push(detail);
            }
        }
        if let Some(value) = routing.get("pool").and_then(Value::as_str) {
            let detail = format!("Pool: {value}");
            if !details.iter().any(|entry| entry == &detail) {
                details.push(detail);
            }
        }
        if let Some(value) = routing.get("health").and_then(Value::as_str) {
            let detail = format!("Routing health: {value}");
            if !details.iter().any(|entry| entry == &detail) {
                details.push(detail);
            }
        }
        push_unique_text(
            &mut details,
            routing.get("routeHint").and_then(Value::as_str),
        );
    }

    json!({
        "summary": run
            .routing
            .as_ref()
            .and_then(|routing| routing.get("routeLabel"))
            .cloned()
            .or_else(|| {
                run.execution_profile
                    .as_ref()
                    .and_then(|profile| profile.get("name"))
                    .and_then(Value::as_str)
                    .map(|name| Value::String(format!("Executed with {name}")))
            })
            .unwrap_or_else(|| Value::String("Routing information unavailable".to_string())),
        "details": details,
        "missingReason": if details.is_empty() {
            Value::String("The runtime did not publish backend audit details for this review pack.".to_string())
        } else {
            Value::Null
        },
    })
}

pub(super) fn build_review_pack_file_changes(changed_paths: &[String]) -> Value {
    let total_count = changed_paths.len();
    json!({
        "paths": changed_paths,
        "totalCount": total_count,
        "summary": if total_count > 0 {
            format!("{total_count} runtime-recorded file change{}", if total_count == 1 { "" } else { "s" })
        } else {
            "Runtime file changes unavailable".to_string()
        },
        "missingReason": if total_count > 0 {
            Value::Null
        } else {
            Value::String("The runtime did not record explicit file-target mutations for this review pack.".to_string())
        },
    })
}

pub(super) fn build_review_pack_evidence_refs(run: &MissionRunProjection) -> Value {
    let trace_id = run
        .checkpoint
        .as_ref()
        .and_then(|checkpoint| checkpoint.get("traceId"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
        .or_else(|| {
            run.ledger
                .as_ref()
                .and_then(|ledger| ledger.get("traceId"))
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
        })
        .or_else(|| {
            run.artifacts.iter().find_map(|artifact| {
                artifact
                    .get("id")
                    .and_then(Value::as_str)
                    .and_then(|value| value.strip_prefix("trace:"))
                    .map(ToOwned::to_owned)
            })
        });
    let checkpoint_id = run
        .checkpoint
        .as_ref()
        .and_then(|checkpoint| checkpoint.get("checkpointId"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
        .or_else(|| {
            run.ledger
                .as_ref()
                .and_then(|ledger| ledger.get("checkpointId"))
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
        })
        .or_else(|| {
            run.artifacts.iter().find_map(|artifact| {
                artifact
                    .get("id")
                    .and_then(Value::as_str)
                    .and_then(|value| value.strip_prefix("checkpoint:"))
                    .map(ToOwned::to_owned)
            })
        });
    let diff_artifact_ids = run
        .artifacts
        .iter()
        .filter(|artifact| artifact.get("kind").and_then(Value::as_str) == Some("diff"))
        .filter_map(|artifact| artifact.get("id").and_then(Value::as_str))
        .map(ToOwned::to_owned)
        .collect::<Vec<_>>();
    let validation_artifact_ids = run
        .artifacts
        .iter()
        .filter(|artifact| artifact.get("kind").and_then(Value::as_str) == Some("validation"))
        .filter_map(|artifact| artifact.get("id").and_then(Value::as_str))
        .map(ToOwned::to_owned)
        .collect::<Vec<_>>();
    let log_artifact_ids = run
        .artifacts
        .iter()
        .filter(|artifact| artifact.get("kind").and_then(Value::as_str) == Some("log"))
        .filter_map(|artifact| artifact.get("id").and_then(Value::as_str))
        .map(ToOwned::to_owned)
        .collect::<Vec<_>>();
    let command_artifact_ids = run
        .artifacts
        .iter()
        .filter(|artifact| artifact.get("kind").and_then(Value::as_str) == Some("command"))
        .filter_map(|artifact| artifact.get("id").and_then(Value::as_str))
        .map(ToOwned::to_owned)
        .collect::<Vec<_>>();

    json!({
        "traceId": trace_id,
        "checkpointId": checkpoint_id,
        "diffArtifactIds": diff_artifact_ids,
        "validationArtifactIds": validation_artifact_ids,
        "logArtifactIds": log_artifact_ids,
        "commandArtifactIds": command_artifact_ids,
    })
}
