use super::*;

fn optional_workspace_id(params: &serde_json::Map<String, Value>) -> Option<String> {
    read_optional_string(params, "workspaceId")
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

pub(super) async fn handle_extensions_list_v1(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = optional_workspace_id(params);
    let store = ctx.extensions_store.read().await;
    Ok(json!(store.list(workspace_id.as_deref())))
}

pub(super) async fn handle_extension_install_v1(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = optional_workspace_id(params);
    let extension_id = read_required_string(params, "extensionId")?;
    let name = read_required_string(params, "name")?;
    let transport = read_required_string(params, "transport")?;
    let enabled = params
        .get("enabled")
        .and_then(Value::as_bool)
        .unwrap_or(true);
    let config = params.get("config").cloned();

    let spec = {
        let mut store = ctx.extensions_store.write().await;
        store.upsert(
            workspace_id.as_deref(),
            extension_id,
            name,
            transport,
            enabled,
            config,
        )
    };

    publish_turn_event(
        ctx,
        TURN_EVENT_EXTENSION_UPDATED,
        json!({
            "extensionId": spec.extension_id,
            "workspaceId": spec.workspace_id,
            "action": "installed",
            "updatedAt": spec.updated_at,
        }),
        None,
    );

    Ok(json!(spec))
}

pub(super) async fn handle_extension_remove_v1(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = optional_workspace_id(params);
    let extension_id = read_required_string(params, "extensionId")?;

    let removed = {
        let mut store = ctx.extensions_store.write().await;
        store.remove(workspace_id.as_deref(), extension_id)
    };

    if removed {
        publish_turn_event(
            ctx,
            TURN_EVENT_EXTENSION_UPDATED,
            json!({
                "extensionId": extension_id,
                "workspaceId": workspace_id,
                "action": "removed",
                "updatedAt": now_ms(),
            }),
            None,
        );
    }

    Ok(json!(removed))
}

pub(super) async fn handle_extension_tools_list_v1(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = optional_workspace_id(params);
    let extension_id = read_required_string(params, "extensionId")?;
    let store = ctx.extensions_store.read().await;
    let Some(tools) = store.tools(workspace_id.as_deref(), extension_id) else {
        return Err(RpcError::invalid_params(format!(
            "extension `{extension_id}` was not found"
        )));
    };
    Ok(json!(tools))
}

pub(super) async fn handle_extension_resource_read_v1(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = optional_workspace_id(params);
    let extension_id = read_required_string(params, "extensionId")?;
    let resource_id = read_required_string(params, "resourceId")?;
    let store = ctx.extensions_store.read().await;
    let Some(resource) = store.read_resource(workspace_id.as_deref(), extension_id, resource_id)
    else {
        return Err(RpcError::invalid_params(format!(
            "extension `{extension_id}` was not found"
        )));
    };
    Ok(json!(resource))
}

pub(super) async fn handle_extensions_config_v1(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = optional_workspace_id(params);
    let store = ctx.extensions_store.read().await;
    let extensions = store.list(workspace_id.as_deref());
    let warnings = if extensions.is_empty() {
        vec!["No runtime extensions are currently installed.".to_string()]
    } else {
        Vec::new()
    };
    Ok(json!(
        extensions_runtime::RuntimeExtensionsConfigResponsePayload {
            extensions,
            warnings,
        }
    ))
}
