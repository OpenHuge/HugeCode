use super::*;

const RPC_BATCH_MAX_REQUESTS: usize = 64;
const RPC_BATCH_READ_ONLY_METHODS: &[&str] = &[
    "code_rpc_capabilities",
    "code_health",
    "code_settings_summary",
    "code_app_settings_get",
    "code_text_file_read_v1",
    "code_remote_status",
    "code_terminal_status",
    "code_models_pool",
    "code_providers_catalog",
    "code_hugerouter_commercial_service_read",
    "code_workspaces_list",
    "code_bootstrap_snapshot",
];

pub(super) fn health_response_payload() -> Value {
    json!({
        "app": "code-runtime-service-rs",
        "version": env!("CARGO_PKG_VERSION"),
        "status": "ok"
    })
}

pub(super) fn settings_summary_payload() -> Value {
    json!({
        "defaultModelStrategy": "unified-auto-routing",
        "remoteEnabled": true,
        "defaultReasonEffort": "high",
        "defaultAccessMode": "on-request"
    })
}

pub(super) fn remote_status_payload() -> Value {
    json!({
        "connected": true,
        "mode": "local",
        "endpoint": "code-runtime-service-rs",
        "latencyMs": Value::Null
    })
}

pub(super) async fn terminal_status_payload(ctx: &AppContext) -> Value {
    crate::terminal_runtime::terminal_status_payload(ctx).await
}

pub(super) async fn handle_bootstrap_snapshot(ctx: &AppContext) -> Result<Value, RpcError> {
    let models = build_models_pool(ctx).await;
    let workspaces = {
        let state = ctx.state.read().await;
        state.workspaces.clone()
    };

    Ok(json!({
        "health": health_response_payload(),
        "settings": settings_summary_payload(),
        "remote": remote_status_payload(),
        "terminal": terminal_status_payload(ctx).await,
        "models": models,
        "workspaces": workspaces,
    }))
}

pub(super) async fn handle_rpc_batch(ctx: &AppContext, params: &Value) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let requests = params
        .get("requests")
        .and_then(Value::as_array)
        .ok_or_else(|| RpcError::invalid_params("`requests` must be an array."))?;
    if requests.len() > RPC_BATCH_MAX_REQUESTS {
        return Err(RpcError::invalid_params(format!(
            "`requests` must contain at most {RPC_BATCH_MAX_REQUESTS} item(s)."
        )));
    }

    let mut responses = Vec::with_capacity(requests.len());
    for request in requests {
        let request_object = request
            .as_object()
            .ok_or_else(|| RpcError::invalid_params("Each batch request must be an object."))?;
        let method = request_object
            .get("method")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| {
                RpcError::invalid_params("Each batch request requires a non-empty `method`.")
            })?;

        let Some(resolved_method) = resolve_rpc_method(method) else {
            return Err(RpcError::invalid_params(format!(
                "Unsupported batch method `{method}`."
            )));
        };
        if !is_read_only_batch_method(resolved_method) {
            return Err(RpcError::invalid_params(format!(
                "Method `{resolved_method}` is not allowed in `code_rpc_batch`."
            )));
        }

        let request_params = request_object
            .get("params")
            .cloned()
            .unwrap_or_else(|| Value::Object(serde_json::Map::new()));
        if !request_params.is_null() && !request_params.is_object() {
            return Err(RpcError::invalid_params(format!(
                "Batch method `{resolved_method}` requires object `params`."
            )));
        }

        match handle_read_only_batch_method(ctx, resolved_method, method, &request_params).await {
            Ok(result) => responses.push(json!({
                "method": method,
                "ok": true,
                "result": result,
            })),
            Err(error) => responses.push(json!({
                "method": method,
                "ok": false,
                "error": {
                    "code": error.code.as_str(),
                    "message": error.message,
                },
            })),
        }
    }

    Ok(json!({ "responses": responses }))
}

fn is_read_only_batch_method(method: &str) -> bool {
    RPC_BATCH_READ_ONLY_METHODS.contains(&method)
}

async fn handle_read_only_batch_method(
    ctx: &AppContext,
    method: &str,
    requested_method: &str,
    params: &Value,
) -> Result<Value, RpcError> {
    match method {
        "code_rpc_capabilities" => Ok(rpc_capabilities_payload_for_requested_method(
            requested_method,
        )),
        "code_health" => Ok(health_response_payload()),
        "code_settings_summary" => Ok(settings_summary_payload()),
        "code_app_settings_get" => super::app_settings_dispatch::handle_app_settings_get(ctx).await,
        "code_text_file_read_v1" => super::text_files_dispatch::handle_text_file_read_v1(ctx, params).await,
        "code_remote_status" => Ok(remote_status_payload()),
        "code_terminal_status" => Ok(terminal_status_payload(ctx).await),
        "code_models_pool" => Ok(json!(build_models_pool(ctx).await)),
        "code_providers_catalog" => Ok(json!(build_providers_catalog(ctx).await)),
        "code_hugerouter_commercial_service_read" => {
            super::hugerouter_commercial_dispatch::handle_hugerouter_commercial_service_read(ctx)
                .await
        }
        "code_workspaces_list" => {
            let state = ctx.state.read().await;
            Ok(json!(state.workspaces))
        }
        "code_bootstrap_snapshot" => handle_bootstrap_snapshot(ctx).await,
        _ => Err(RpcError::invalid_params(format!(
            "Unsupported batch method `{method}`."
        ))),
    }
}
