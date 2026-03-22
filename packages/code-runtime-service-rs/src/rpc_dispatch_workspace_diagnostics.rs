use super::*;

use crate::workspace_diagnostics::{list_workspace_diagnostics, WorkspaceDiagnosticsListRequest};

pub(super) async fn handle_workspace_diagnostics_list_v1(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let request: WorkspaceDiagnosticsListRequest =
        serde_json::from_value(params.clone()).map_err(|error| {
            RpcError::invalid_params(format!("Invalid workspace diagnostics payload: {error}"))
        })?;

    let workspace_path =
        super::workspace_git_dispatch::resolve_workspace_path(ctx, request.workspace_id.as_str())
            .await?;
    let response = list_workspace_diagnostics(
        request.workspace_id.as_str(),
        workspace_path.as_path(),
        &request,
    )
    .await;
    Ok(json!(response))
}
