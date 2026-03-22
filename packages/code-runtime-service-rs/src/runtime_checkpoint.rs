use crate::agent_task_durability::agent_task_trace_id;
use crate::*;

pub(crate) fn is_runtime_recovery_error_code(error_code: Option<&str>) -> bool {
    matches!(
        error_code.map(|value| value.trim().to_ascii_lowercase()),
        Some(value)
            if matches!(
                value.as_str(),
                "runtime_restart_recovery"
                    | "runtime.restart.recovery"
                    | "runtime.task.interrupt.recoverable"
                    | "runtime.task.interrupt.recovery"
            )
    )
}

pub(crate) fn resolve_runtime_checkpoint_resume_ready(
    status: &str,
    recovered: bool,
    error_code: Option<&str>,
) -> bool {
    status == "paused"
        || (status == "interrupted" && (recovered || is_runtime_recovery_error_code(error_code)))
}

pub(crate) fn build_runtime_checkpoint_summary(
    status: &str,
    checkpoint_id: Option<&str>,
    recovered: bool,
    resume_ready: bool,
) -> Option<String> {
    if recovered {
        return Some(
            "Runtime recovered the run from a checkpoint. Resume to continue.".to_string(),
        );
    }
    if resume_ready && status == "paused" {
        return Some("Run is paused and can continue from its latest checkpoint.".to_string());
    }
    if resume_ready {
        return Some("Run was interrupted and can resume from a checkpoint.".to_string());
    }
    checkpoint_id.map(|value| format!("Checkpoint {value} is the latest runtime recovery marker."))
}

fn normalize_runtime_checkpoint_state(status: &str) -> &str {
    match status {
        "paused" => "running",
        "cancelled" => "interrupted",
        other => other,
    }
}

pub(crate) fn build_runtime_checkpoint_projection(
    state: &str,
    lifecycle_state: Option<&str>,
    checkpoint_id: Option<&str>,
    trace_id: Option<&str>,
    recovered: bool,
    updated_at: Option<u64>,
    resume_ready: Option<bool>,
    recovered_at: Option<u64>,
    summary: Option<String>,
) -> Value {
    json!({
        "state": state,
        "lifecycleState": lifecycle_state,
        "checkpointId": checkpoint_id,
        "traceId": trace_id,
        "recovered": recovered,
        "updatedAt": updated_at,
        "resumeReady": resume_ready,
        "recoveredAt": recovered_at,
        "summary": summary,
    })
}

pub(crate) fn build_agent_task_checkpoint_state_payload(
    summary: &AgentTaskSummary,
    recovered: bool,
    checkpoint_id: Option<&str>,
) -> Value {
    let resume_ready = resolve_runtime_checkpoint_resume_ready(
        summary.status.as_str(),
        recovered,
        summary.error_code.as_deref(),
    );
    let trace_id = agent_task_trace_id(summary.task_id.as_str());
    build_runtime_checkpoint_projection(
        normalize_runtime_checkpoint_state(summary.status.as_str()),
        Some(summary.status.as_str()),
        checkpoint_id,
        Some(trace_id.as_str()),
        recovered,
        Some(summary.updated_at),
        Some(resume_ready),
        recovered.then_some(summary.updated_at),
        build_runtime_checkpoint_summary(
            summary.status.as_str(),
            checkpoint_id,
            recovered,
            resume_ready,
        ),
    )
}
