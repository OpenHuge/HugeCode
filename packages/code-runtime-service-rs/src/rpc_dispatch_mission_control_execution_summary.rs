use super::*;

fn json_string_field<'a>(value: Option<&'a Value>, key: &str) -> Option<&'a str> {
    value
        .and_then(|entry| entry.get(key))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
}

fn run_has_blocking_signal(run: &MissionRunProjection) -> bool {
    matches!(
        run.state.as_str(),
        "paused" | "needs_input" | "failed" | "cancelled"
    ) || json_string_field(run.approval.as_ref(), "status") == Some("pending_decision")
        || json_string_field(run.review_actionability.as_ref(), "state") == Some("blocked")
        || run
            .operator_snapshot
            .as_ref()
            .and_then(|snapshot| snapshot.get("blocker"))
            .is_some_and(|value| !value.is_null())
}

fn run_has_reroute_signal(run: &MissionRunProjection) -> bool {
    json_string_field(run.placement.as_ref(), "resolutionSource") == Some("runtime_fallback")
        || json_string_field(run.placement.as_ref(), "lifecycleState") == Some("fallback")
        || run
            .wake_reason
            .as_deref()
            .is_some_and(|value| value.contains("reroute") || value.contains("fallback"))
        || run.next_eligible_action.as_deref() == Some("reroute")
}

fn run_review_status_hint(run: &MissionRunProjection, evidence_state: &str) -> Option<&'static str> {
    if run.state != "review_ready" {
        return None;
    }
    if run_has_blocking_signal(run) {
        return Some("action_required");
    }
    if matches!(evidence_state, "incomplete" | "missing") {
        return Some("incomplete_evidence");
    }
    Some("ready")
}

pub(crate) fn build_runtime_execution_lifecycle_summary_for_run(
    run: &MissionRunProjection,
) -> Value {
    let blocked = run_has_blocking_signal(run);
    let rerouted = run_has_reroute_signal(run);
    let validated =
        !run.validations.is_empty() || matches!(run.state.as_str(), "validating" | "review_ready");
    let ready_for_review = run.state == "review_ready";
    let stage = if blocked {
        "blocked"
    } else if ready_for_review {
        "completed"
    } else if rerouted {
        "rerouted"
    } else if matches!(run.state.as_str(), "queued" | "preparing") {
        "before_execute"
    } else if run.state == "validating" {
        "validated"
    } else if run.state == "running" && !run.artifacts.is_empty() {
        "tool_completed"
    } else if run.state == "running" && run.current_step_index.is_some() {
        "tool_started"
    } else if run.state == "running" {
        "started"
    } else if validated {
        "after_execute"
    } else {
        "started"
    };
    let summary = if blocked {
        run.governance
            .as_ref()
            .and_then(|value| value.get("summary"))
            .and_then(Value::as_str)
            .map(ToOwned::to_owned)
            .or_else(|| run.wake_reason.clone())
            .unwrap_or_else(|| {
                "Runtime blocked this run until an operator resolves the current gate."
                    .to_string()
            })
    } else {
        match stage {
            "completed" => "Runtime completed execution and published review-ready state.".to_string(),
            "rerouted" => "Runtime rerouted this run onto a fallback backend.".to_string(),
            "validated" => {
                "Runtime finished validation and is publishing the latest execution evidence."
                    .to_string()
            }
            "tool_completed" => {
                "Runtime completed the latest tool step and refreshed execution evidence."
                    .to_string()
            }
            "tool_started" => "Runtime started the current tool step.".to_string(),
            "before_execute" => {
                "Runtime queued this run and has not started tool execution yet.".to_string()
            }
            "after_execute" => {
                "Runtime preserved the finished execution state for review and handoff."
                    .to_string()
            }
            _ => "Runtime started execution for this run.".to_string(),
        }
    };

    json!({
        "stage": stage,
        "summary": summary,
        "blocked": blocked,
        "rerouted": rerouted,
        "validated": validated,
        "readyForReview": ready_for_review,
        "updatedAt": run.updated_at,
    })
}

pub(crate) fn build_runtime_execution_evidence_summary_for_run(
    run: &MissionRunProjection,
) -> Value {
    let validation_count = run.validations.len();
    let artifact_count = run.artifacts.len();
    let warning_count = run.warnings.len();
    let changed_path_count = run.changed_paths.len();
    let checkpoint_trace_id = json_string_field(run.checkpoint.as_ref(), "traceId");
    let checkpoint_id = json_string_field(run.checkpoint.as_ref(), "checkpointId");
    let state = if run.state == "review_ready"
        && (validation_count > 0
            || artifact_count > 0
            || warning_count > 0
            || changed_path_count > 0)
    {
        "ready_for_review"
    } else if validation_count == 0
        && artifact_count == 0
        && warning_count == 0
        && changed_path_count == 0
    {
        "missing"
    } else if matches!(run.state.as_str(), "review_ready" | "validating") {
        "incomplete"
    } else {
        "confirmed"
    };
    let review_status = run_review_status_hint(run, state);
    let summary = match state {
        "ready_for_review" => "Runtime evidence is ready for operator review.".to_string(),
        "missing" => "Runtime has not published validation or artifact evidence yet.".to_string(),
        "incomplete" => "Runtime evidence is incomplete and needs another validation pass."
            .to_string(),
        _ => "Runtime published execution evidence for the current run.".to_string(),
    };

    json!({
        "state": state,
        "summary": summary,
        "validationCount": validation_count,
        "artifactCount": artifact_count,
        "warningCount": warning_count,
        "changedPathCount": changed_path_count,
        "authoritativeTraceId": checkpoint_trace_id,
        "authoritativeCheckpointId": checkpoint_id,
        "reviewStatus": review_status,
    })
}

pub(crate) fn build_runtime_execution_lifecycle_summary_for_review_pack(
    review_pack: &MissionReviewPackProjection,
    run: Option<&MissionRunProjection>,
) -> Value {
    let blocked = review_pack.review_status == "action_required"
        || run.is_some_and(run_has_blocking_signal);
    let rerouted = run.is_some_and(run_has_reroute_signal);
    let validated =
        review_pack.validation_outcome != "unknown" || !review_pack.validations.is_empty();
    let ready_for_review = review_pack.review_status == "ready";
    let stage = if blocked {
        "blocked"
    } else if ready_for_review {
        "after_execute"
    } else if rerouted {
        "rerouted"
    } else if validated {
        "validated"
    } else {
        "after_execute"
    };
    let summary = match stage {
        "blocked" => review_pack
            .recommended_next_action
            .clone()
            .unwrap_or_else(|| "Review follow-up is blocked until an operator resolves the current gate.".to_string()),
        "rerouted" => "Runtime rerouted this run before publishing the review pack.".to_string(),
        "validated" => {
            "Runtime finished validation and preserved the resulting evidence for review."
                .to_string()
        }
        _ if ready_for_review => {
            "Runtime preserved the finished execution state for review.".to_string()
        }
        _ => "Runtime published a review-facing execution summary.".to_string(),
    };
    json!({
        "stage": stage,
        "summary": summary,
        "blocked": blocked,
        "rerouted": rerouted,
        "validated": validated,
        "readyForReview": ready_for_review,
        "updatedAt": review_pack.created_at,
    })
}

pub(crate) fn build_runtime_execution_evidence_summary_for_review_pack(
    review_pack: &MissionReviewPackProjection,
) -> Value {
    let validation_count = review_pack.validations.len();
    let artifact_count = review_pack.artifacts.len();
    let warning_count = review_pack.warnings.len();
    let changed_path_count = review_pack
        .file_changes
        .as_ref()
        .and_then(|value| value.get("totalCount"))
        .and_then(Value::as_u64)
        .unwrap_or(0);
    let trace_id = json_string_field(review_pack.evidence_refs.as_ref(), "traceId");
    let checkpoint_id = json_string_field(review_pack.evidence_refs.as_ref(), "checkpointId");
    let state = if review_pack.review_status == "ready" {
        "ready_for_review"
    } else if review_pack.review_status == "incomplete_evidence"
        || review_pack.evidence_state == "incomplete"
    {
        "incomplete"
    } else if validation_count == 0
        && artifact_count == 0
        && warning_count == 0
        && changed_path_count == 0
    {
        "missing"
    } else {
        "confirmed"
    };
    let summary = match state {
        "ready_for_review" => "Runtime evidence is ready for operator review.".to_string(),
        "incomplete" => "Validation evidence is incomplete and needs another pass.".to_string(),
        "missing" => "Review evidence has not been published yet.".to_string(),
        _ => "Runtime published review evidence for this run.".to_string(),
    };
    json!({
        "state": state,
        "summary": summary,
        "validationCount": validation_count,
        "artifactCount": artifact_count,
        "warningCount": warning_count,
        "changedPathCount": changed_path_count,
        "authoritativeTraceId": trace_id,
        "authoritativeCheckpointId": checkpoint_id,
        "reviewStatus": review_pack.review_status,
    })
}

fn lifecycle_summary_priority(summary: &Value) -> u8 {
    match summary.get("stage").and_then(Value::as_str) {
        Some("blocked") => 5,
        Some("rerouted") => 4,
        Some("completed" | "after_execute") => 3,
        Some("validated" | "tool_completed") => 2,
        Some("tool_started" | "started") => 1,
        _ => 0,
    }
}

fn evidence_summary_priority(summary: &Value) -> u8 {
    match summary.get("state").and_then(Value::as_str) {
        Some("incomplete") => 4,
        Some("ready_for_review") => 3,
        Some("confirmed") => 2,
        Some("missing") => 1,
        _ => 0,
    }
}

pub(crate) fn build_runtime_execution_lifecycle_summary_for_snapshot(
    runs: &[MissionRunProjection],
    review_packs: &[MissionReviewPackProjection],
) -> Option<Value> {
    let mut candidates = runs
        .iter()
        .map(build_runtime_execution_lifecycle_summary_for_run)
        .collect::<Vec<_>>();
    candidates.extend(review_packs.iter().map(|review_pack| {
        let run = runs.iter().find(|run| run.id == review_pack.run_id);
        build_runtime_execution_lifecycle_summary_for_review_pack(review_pack, run)
    }));
    candidates.into_iter().max_by_key(lifecycle_summary_priority)
}

pub(crate) fn build_runtime_execution_evidence_summary_for_snapshot(
    runs: &[MissionRunProjection],
    review_packs: &[MissionReviewPackProjection],
) -> Option<Value> {
    let mut candidates = runs
        .iter()
        .map(build_runtime_execution_evidence_summary_for_run)
        .collect::<Vec<_>>();
    candidates.extend(
        review_packs
            .iter()
            .map(build_runtime_execution_evidence_summary_for_review_pack),
    );
    candidates.into_iter().max_by_key(evidence_summary_priority)
}
