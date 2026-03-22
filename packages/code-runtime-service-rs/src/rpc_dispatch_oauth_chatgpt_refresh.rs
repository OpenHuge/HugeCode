use super::*;

pub(super) async fn handle_oauth_chatgpt_auth_tokens_refresh(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let reason = read_optional_string(params, "reason")
        .unwrap_or_else(|| "unauthorized".to_string())
        .to_ascii_lowercase();
    if reason != "unauthorized" {
        return Err(RpcError::invalid_params(format!(
            "Unsupported reason `{reason}` for code_oauth_chatgpt_auth_tokens_refresh."
        )));
    }

    let previous_account_id = read_optional_string(params, "previousAccountId")
        .or_else(|| read_optional_string(params, "previous_account_id"));
    // Prefer the canonical ChatGPT workspace field and only fall back to the
    // legacy workspaceId alias for older callers.
    let session_id = read_optional_string(params, "sessionId")
        .or_else(|| read_optional_string(params, "session_id"));
    let workspace_id = read_optional_string(params, "chatgptWorkspaceId")
        .or_else(|| read_optional_string(params, "chatgpt_workspace_id"))
        .or_else(|| read_optional_string(params, "workspaceId"))
        .or_else(|| read_optional_string(params, "workspace_id"));

    let refreshed = resolve_chatgpt_auth_tokens_refresh_response(
        ctx,
        session_id.as_deref(),
        previous_account_id.as_deref(),
        workspace_id.as_deref(),
    )
    .await
    .map_err(RpcError::internal)?;

    let payload = refreshed.map(|entry| {
        json!({
            "accessToken": entry.access_token,
            "chatgptAccountId": entry.chatgpt_account_id,
            "chatgptPlanType": entry.chatgpt_plan_type,
            "sourceAccountId": entry.source_account_id,
        })
    });

    Ok(payload.unwrap_or(Value::Null))
}
