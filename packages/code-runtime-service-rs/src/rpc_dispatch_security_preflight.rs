use super::*;

fn extract_command_from_params(params: &serde_json::Map<String, Value>) -> Option<String> {
    read_optional_string(params, "command")
        .or_else(|| {
            params
                .get("input")
                .and_then(Value::as_object)
                .and_then(|input| input.get("command"))
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
        })
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

pub(super) async fn handle_security_preflight_v1(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = read_optional_string(params, "workspaceId")
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let tool_name = read_optional_string(params, "toolName")
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let command = extract_command_from_params(params);
    let check_package_advisory = read_optional_bool(params, "checkPackageAdvisory").unwrap_or(true);
    let check_exec_policy_requested = read_optional_bool(params, "checkExecPolicy").unwrap_or(true);
    let check_exec_policy =
        check_exec_policy_requested && security_preflight::security_preflight_exec_policy_enabled();
    let exec_policy_rules = params
        .get("execPolicyRules")
        .and_then(Value::as_array)
        .map(|entries| {
            entries
                .iter()
                .filter_map(Value::as_str)
                .map(str::trim)
                .filter(|entry| !entry.is_empty())
                .map(ToOwned::to_owned)
                .collect::<Vec<_>>()
        })
        .filter(|entries| !entries.is_empty());

    let decision = security_preflight::evaluate_security_preflight(
        ctx,
        workspace_id.as_deref(),
        tool_name.as_deref(),
        command.as_deref(),
        check_package_advisory,
        check_exec_policy,
        exec_policy_rules.as_deref(),
    )
    .await;

    if decision.action != "allow" {
        publish_turn_event(
            ctx,
            TURN_EVENT_SECURITY_PREFLIGHT_BLOCKED,
            json!({
                "workspaceId": workspace_id,
                "toolName": tool_name,
                "command": command,
                "reason": decision.reason,
                "action": decision.action,
                "blockedAt": now_ms(),
            }),
            None,
        );
    }

    Ok(json!(decision))
}
