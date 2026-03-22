use super::*;

pub(crate) fn build_task_execution_profile(summary: &AgentTaskSummary) -> Value {
    let (mode, _, autonomy) =
        map_access_mode_to_task_mode(summary.access_mode.as_str(), summary.agent_profile.as_str());
    let execution_mode = if summary.backend_id.is_some() || summary.distributed_status.is_some() {
        Some("distributed")
    } else {
        Some("single")
    };
    let profile_id = summary
        .execution_profile_id
        .as_deref()
        .unwrap_or_else(|| match mode.as_deref() {
            Some("ask") => "operator-review",
            Some("delegate") => "autonomous-delegate",
            Some("pair") => "balanced-delegate",
            _ => "runtime-unclassified",
        });
    let (
        name,
        description,
        supervision_label,
        tool_posture,
        approval_sensitivity,
        identity_source,
    ) = match profile_id {
        "operator-review" => (
            "Operator Review",
            "Runtime-native review-first execution profile.",
            "Review each mutation before execution",
            "read_only",
            "heightened",
            "runtime_repository_execution_contract",
        ),
        "balanced-delegate" => (
            "Balanced Delegate",
            "Runtime-native bounded delegation profile.",
            "Approve writes and intervene when blocked",
            "workspace_safe",
            "standard",
            "runtime_repository_execution_contract",
        ),
        "autonomous-delegate" => (
            "Autonomous Delegate",
            "Runtime-native high-autonomy delegation profile.",
            "Checkpointed autonomy with targeted intervention",
            "workspace_extended",
            "low_friction",
            "runtime_repository_execution_contract",
        ),
        _ => (
            "Runtime Task",
            "Derived from runtime agent profile and access mode.",
            match autonomy.as_str() {
                "operator_review" => "Review each mutation before execution",
                "autonomous_delegate" => "Checkpointed autonomy with targeted intervention",
                _ => "Approve writes and intervene when blocked",
            },
            match summary.access_mode.as_str() {
                "read-only" => "read_only",
                "full-access" => "workspace_extended",
                _ => "workspace_safe",
            },
            match summary.access_mode.as_str() {
                "read-only" => "heightened",
                "full-access" => "low_friction",
                _ => "standard",
            },
            "runtime_agent_task",
        ),
    };
    json!({
        "id": profile_id,
        "name": name,
        "description": description,
        "executionMode": execution_mode,
        "autonomy": autonomy,
        "supervisionLabel": supervision_label,
        "accessMode": summary.access_mode,
        "routingStrategy": "workspace_default",
        "toolPosture": tool_posture,
        "approvalSensitivity": approval_sensitivity,
        "identitySource": identity_source,
        "validationPresetId": summary.validation_preset_id.as_ref().map_or(Value::Null, |value| Value::String(value.clone())),
    })
}

pub(super) fn build_execution_profile(runtime: &AgentTaskRuntime) -> Value {
    build_task_execution_profile(&runtime.summary)
}
