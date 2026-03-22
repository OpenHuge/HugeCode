use super::*;
use crate::runtime_checkpoint::build_agent_task_checkpoint_state_payload;

pub(crate) fn derive_review_validation_outcome(validations: &[Value]) -> String {
    if validations.is_empty() {
        return "unknown".to_string();
    }
    let outcomes = validations
        .iter()
        .filter_map(|validation| validation.get("outcome").and_then(Value::as_str))
        .collect::<Vec<_>>();
    if outcomes.iter().any(|outcome| *outcome == "failed") {
        return "failed".to_string();
    }
    if outcomes.iter().any(|outcome| *outcome == "warning") {
        return "warning".to_string();
    }
    if !outcomes.is_empty() && outcomes.iter().all(|outcome| *outcome == "skipped") {
        return "skipped".to_string();
    }
    "passed".to_string()
}

pub(crate) fn derive_review_evidence_state(
    validations: &[Value],
    warnings: &[String],
    artifacts: &[Value],
) -> &'static str {
    if validations.is_empty() && warnings.is_empty() && artifacts.is_empty() {
        "incomplete"
    } else {
        "confirmed"
    }
}

pub(crate) fn build_run_ledger(
    runtime: &AgentTaskRuntime,
    warnings: &[String],
    validations: &[Value],
    artifacts: &[Value],
    routing: &Value,
    completion_reason: Option<&str>,
) -> Value {
    let summary = &runtime.summary;
    let checkpoint = build_agent_task_checkpoint_state_payload(
        summary,
        runtime.recovered,
        runtime.checkpoint_id.as_deref(),
    );
    let evidence_state = derive_review_evidence_state(validations, warnings, artifacts);
    json!({
        "traceId": checkpoint.get("traceId").cloned().unwrap_or(Value::Null),
        "checkpointId": checkpoint.get("checkpointId").cloned().unwrap_or(Value::Null),
        "recovered": checkpoint.get("recovered").cloned().unwrap_or(Value::Bool(runtime.recovered)),
        "stepCount": summary.steps.len(),
        "completedStepCount": summary
            .steps
            .iter()
            .filter(|step| step.status == "completed")
            .count(),
        "warningCount": warnings.len(),
        "validationCount": validations.len(),
        "artifactCount": artifacts.len(),
        "evidenceState": evidence_state,
        "backendId": routing
            .get("backendId")
            .cloned()
            .unwrap_or_else(|| summary.backend_id.clone().map(Value::String).unwrap_or(Value::Null)),
        "routeLabel": routing.get("routeLabel").cloned().unwrap_or(Value::Null),
        "completionReason": completion_reason,
        "lastProgressAt": summary
            .auto_drive
            .as_ref()
            .and_then(|entry| entry.navigation.as_ref())
            .and_then(|entry| entry.last_progress_at)
            .or(Some(summary.updated_at)),
    })
}

pub(crate) fn build_runtime_mission_linkage_summary(
    workspace_id: &str,
    run_id: &str,
    mission_task_id: &str,
    thread_id: Option<&str>,
    request_id: Option<&str>,
    review_pack_id: Option<&str>,
    checkpoint_id: Option<&str>,
    trace_id: Option<&str>,
) -> Value {
    let thread_id = trim_to_option(thread_id);
    let request_id = trim_to_option(request_id);
    let review_pack_id = trim_to_option(review_pack_id);
    let checkpoint_id = trim_to_option(checkpoint_id);
    let trace_id = trim_to_option(trace_id);
    let (task_entity_kind, recovery_path, navigation_target, summary) = if let Some(thread_id) =
        thread_id.clone()
    {
        (
            "thread",
            "thread",
            json!({
                "kind": "thread",
                "workspaceId": workspace_id,
                "threadId": thread_id,
            }),
            format!(
                "Runtime preserved mission thread linkage for run {run_id}; operator recovery should follow thread {thread_id}."
            ),
        )
    } else {
        (
            "run",
            "run",
            json!({
                "kind": "run",
                "workspaceId": workspace_id,
                "taskId": mission_task_id,
                "runId": run_id,
                "reviewPackId": review_pack_id,
                "checkpointId": checkpoint_id,
                "traceId": trace_id,
            }),
            format!(
                "Runtime did not retain a mission thread id for run {run_id}; recovery falls back to runtime run, checkpoint, and review-pack linkage."
            ),
        )
    };

    json!({
        "workspaceId": workspace_id,
        "taskId": mission_task_id,
        "runId": run_id,
        "reviewPackId": review_pack_id,
        "checkpointId": checkpoint_id,
        "traceId": trace_id,
        "threadId": thread_id,
        "requestId": request_id,
        "missionTaskId": mission_task_id,
        "taskEntityKind": task_entity_kind,
        "recoveryPath": recovery_path,
        "navigationTarget": navigation_target,
        "summary": summary,
    })
}

fn build_review_action_availability(
    action: &str,
    enabled: bool,
    supported: bool,
    reason: Option<String>,
) -> Value {
    json!({
        "action": action,
        "enabled": enabled,
        "supported": supported,
        "reason": reason,
    })
}

pub(crate) fn build_runtime_review_actionability_summary(
    run_state: &str,
    review_decision: Option<&Value>,
    intervention: &Value,
    next_action: &Value,
    evidence_state: &str,
    validation_outcome: &str,
    placement: Option<&Value>,
    mission_linkage: &Value,
) -> Value {
    let review_status = review_decision
        .and_then(|entry| entry.get("status"))
        .and_then(Value::as_str)
        .unwrap_or("pending");
    let terminal_reviewable = matches!(run_state, "review_ready" | "failed" | "cancelled");
    let review_final = matches!(review_status, "accepted" | "rejected");
    let pending_review = terminal_reviewable && !review_final;
    let thread_available = mission_linkage
        .get("threadId")
        .and_then(Value::as_str)
        .is_some();

    let mut degraded_reasons = Vec::new();
    if !terminal_reviewable {
        push_unique_text(&mut degraded_reasons, Some("run_not_review_ready"));
    }
    if review_final {
        push_unique_text(&mut degraded_reasons, Some("review_decision_recorded"));
    }
    if evidence_state == "incomplete" {
        push_unique_text(&mut degraded_reasons, Some("runtime_evidence_incomplete"));
    }
    if validation_outcome == "unknown" {
        push_unique_text(&mut degraded_reasons, Some("validation_outcome_unknown"));
    }
    if !thread_available {
        push_unique_text(&mut degraded_reasons, Some("thread_link_recovered_via_run"));
    }
    if let Some(placement) = placement {
        let lifecycle_state = placement.get("lifecycleState").and_then(Value::as_str);
        let health_summary = placement.get("healthSummary").and_then(Value::as_str);
        if matches!(
            lifecycle_state,
            Some("requested" | "unresolved" | "resolved")
        ) {
            push_unique_text(&mut degraded_reasons, Some("placement_unconfirmed"));
        }
        if health_summary == Some("placement_blocked") {
            push_unique_text(&mut degraded_reasons, Some("placement_operability_blocked"));
        }
    }

    let mut actions = vec![
        build_review_action_availability(
            "accept_result",
            pending_review,
            terminal_reviewable,
            if !terminal_reviewable {
                Some("Run has not reached a reviewable terminal state.".to_string())
            } else if review_final {
                Some("Runtime already recorded the final review decision.".to_string())
            } else {
                None
            },
        ),
        build_review_action_availability(
            "reject_result",
            pending_review,
            terminal_reviewable,
            if !terminal_reviewable {
                Some("Run has not reached a reviewable terminal state.".to_string())
            } else if review_final {
                Some("Runtime already recorded the final review decision.".to_string())
            } else {
                None
            },
        ),
    ];
    if let Some(entries) = intervention.get("actions").and_then(Value::as_array) {
        for entry in entries {
            let Some(action) = entry.get("action").and_then(Value::as_str) else {
                continue;
            };
            if !matches!(
                action,
                "retry"
                    | "continue_with_clarification"
                    | "narrow_scope"
                    | "relax_validation"
                    | "switch_profile_and_retry"
                    | "escalate_to_pair_mode"
            ) {
                continue;
            }
            actions.push(build_review_action_availability(
                action,
                entry
                    .get("enabled")
                    .and_then(Value::as_bool)
                    .unwrap_or(false),
                entry
                    .get("supported")
                    .and_then(Value::as_bool)
                    .unwrap_or(false),
                trim_to_option(entry.get("reason").and_then(Value::as_str)),
            ));
        }
    }

    let enabled_follow_up = actions.iter().any(|entry| {
        entry.get("action").and_then(Value::as_str) != Some("accept_result")
            && entry.get("action").and_then(Value::as_str) != Some("reject_result")
            && entry.get("enabled").and_then(Value::as_bool) == Some(true)
            && entry.get("supported").and_then(Value::as_bool) == Some(true)
    });
    let state = if !terminal_reviewable && !enabled_follow_up {
        "blocked"
    } else if review_final && !enabled_follow_up {
        "blocked"
    } else if degraded_reasons.is_empty() {
        "ready"
    } else {
        "degraded"
    };
    let summary = if state == "ready" {
        "Runtime confirms review decisions and follow-up controls are actionable.".to_string()
    } else if !terminal_reviewable {
        next_action
            .get("detail")
            .and_then(Value::as_str)
            .map(ToOwned::to_owned)
            .unwrap_or_else(|| {
                "Runtime has not yet produced a reviewable terminal result for this run."
                    .to_string()
            })
    } else if review_final && !enabled_follow_up {
        review_decision
            .and_then(|entry| entry.get("summary"))
            .and_then(Value::as_str)
            .map(ToOwned::to_owned)
            .unwrap_or_else(|| {
                "Runtime already recorded the final review decision for this result.".to_string()
            })
    } else if evidence_state == "incomplete" {
        "Runtime still allows operator decisions, but the published evidence set is incomplete."
            .to_string()
    } else {
        "Runtime preserved review actions, but degraded linkage or placement evidence still needs attention."
            .to_string()
    };

    json!({
        "state": state,
        "summary": summary,
        "degradedReasons": degraded_reasons,
        "actions": actions,
    })
}
