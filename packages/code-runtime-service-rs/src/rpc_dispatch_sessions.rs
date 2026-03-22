use super::*;
use crate::native_state_store::TABLE_NATIVE_RUNTIME_STATE_KV;

const THREAD_SNAPSHOTS_RUNTIME_STATE_KEY: &str = "thread_snapshots_v1";

pub(super) async fn handle_session_export_v1(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = read_required_string(params, "workspaceId")?;
    let thread_id = read_required_string(params, "threadId")?;
    let include_agent_tasks = params
        .get("includeAgentTasks")
        .and_then(Value::as_bool)
        .unwrap_or(true);

    let response = session_portability::export_session_snapshot(
        ctx,
        workspace_id,
        thread_id,
        include_agent_tasks,
    )
    .await?;

    publish_turn_event(
        ctx,
        TURN_EVENT_SESSION_PORTABILITY_UPDATED,
        json!({
            "workspaceId": workspace_id,
            "threadId": thread_id,
            "operation": "export",
            "schemaVersion": session_portability::SESSION_PORTABILITY_SCHEMA_VERSION,
            "updatedAt": now_ms(),
        }),
        None,
    );

    Ok(json!(response))
}

pub(super) async fn handle_session_import_v1(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = read_required_string(params, "workspaceId")?;
    let snapshot = params
        .get("snapshot")
        .filter(|value| value.is_object())
        .cloned()
        .ok_or_else(|| RpcError::invalid_params("`snapshot` must be an object."))?;
    let thread_id = read_optional_string(params, "threadId");

    let response = session_portability::import_session_snapshot(
        ctx,
        workspace_id,
        snapshot,
        thread_id.as_deref(),
    )
    .await?;

    publish_turn_event(
        ctx,
        TURN_EVENT_SESSION_PORTABILITY_UPDATED,
        json!({
            "workspaceId": response.workspace_id,
            "threadId": response.thread_id,
            "operation": "import",
            "schemaVersion": session_portability::SESSION_PORTABILITY_SCHEMA_VERSION,
            "updatedAt": now_ms(),
        }),
        None,
    );

    Ok(json!(response))
}

pub(super) async fn handle_session_delete_v1(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = read_required_string(params, "workspaceId")?;
    let thread_id = read_required_string(params, "threadId")?;
    let deleted =
        session_portability::delete_session_snapshot(ctx, workspace_id, thread_id).await?;

    if deleted {
        publish_turn_event(
            ctx,
            TURN_EVENT_SESSION_PORTABILITY_UPDATED,
            json!({
                "workspaceId": workspace_id,
                "threadId": thread_id,
                "operation": "delete",
                "schemaVersion": session_portability::SESSION_PORTABILITY_SCHEMA_VERSION,
                "updatedAt": now_ms(),
            }),
            None,
        );
    }

    Ok(json!(deleted))
}

pub(super) async fn handle_thread_snapshots_get_v1(ctx: &AppContext) -> Result<Value, RpcError> {
    let snapshots = ctx
        .native_state_store
        .get_setting_value(
            TABLE_NATIVE_RUNTIME_STATE_KV,
            THREAD_SNAPSHOTS_RUNTIME_STATE_KEY,
        )
        .await
        .map_err(RpcError::internal)?
        .unwrap_or_else(|| Value::Object(serde_json::Map::new()));

    let updated_at = ctx
        .native_state_store
        .get_setting_value(
            TABLE_NATIVE_RUNTIME_STATE_KV,
            format!("{THREAD_SNAPSHOTS_RUNTIME_STATE_KEY}:updated_at").as_str(),
        )
        .await
        .map_err(RpcError::internal)?
        .and_then(|value| value.as_u64());

    Ok(json!({
        "snapshots": snapshots,
        "updatedAt": updated_at,
    }))
}

pub(super) async fn handle_thread_snapshots_set_v1(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let snapshots = params
        .get("snapshots")
        .filter(|value| value.is_object())
        .cloned()
        .ok_or_else(|| RpcError::invalid_params("`snapshots` must be an object."))?;
    let updated_at = now_ms();

    ctx.native_state_store
        .upsert_setting_value(
            TABLE_NATIVE_RUNTIME_STATE_KV,
            THREAD_SNAPSHOTS_RUNTIME_STATE_KEY,
            snapshots.clone(),
        )
        .await
        .map_err(RpcError::internal)?;
    ctx.native_state_store
        .upsert_setting_value(
            TABLE_NATIVE_RUNTIME_STATE_KV,
            format!("{THREAD_SNAPSHOTS_RUNTIME_STATE_KEY}:updated_at").as_str(),
            Value::Number(serde_json::Number::from(updated_at)),
        )
        .await
        .map_err(RpcError::internal)?;

    let snapshot_count = snapshots.as_object().map_or(0, serde_json::Map::len);
    Ok(json!({
        "snapshotCount": snapshot_count,
        "updatedAt": updated_at,
    }))
}
