use super::*;
use crate::{
    instruction_skills, native_state_store::TABLE_NATIVE_SKILLS,
    rpc_dispatch::workspace_git_dispatch::resolve_workspace_path,
};

fn read_first_non_empty_string(
    params: &serde_json::Map<String, Value>,
    keys: &[&str],
) -> Option<String> {
    for key in keys {
        if let Some(value) = read_optional_string(params, key) {
            return Some(value);
        }
    }
    None
}

pub(crate) async fn list_native_skills(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_root = match read_optional_string(params, "workspaceId") {
        Some(workspace_id) => Some(resolve_workspace_path(ctx, workspace_id.as_str()).await?),
        None => None,
    };
    let overlays = ctx
        .native_state_store
        .list_entities(TABLE_NATIVE_SKILLS)
        .await
        .map_err(RpcError::internal)?;
    let roots = instruction_skills::resolve_instruction_skill_roots(workspace_root);
    Ok(json!(instruction_skills::list_instruction_skill_summaries(
        &roots,
        overlays.as_slice(),
    )))
}

pub(crate) async fn get_native_skill(ctx: &AppContext, params: &Value) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let skill_id = read_first_non_empty_string(params, &["skillId", "id"])
        .ok_or_else(|| RpcError::invalid_params("Missing required string field: skillId"))?;
    let workspace_root = match read_optional_string(params, "workspaceId") {
        Some(workspace_id) => Some(resolve_workspace_path(ctx, workspace_id.as_str()).await?),
        None => None,
    };
    let overlays = ctx
        .native_state_store
        .list_entities(TABLE_NATIVE_SKILLS)
        .await
        .map_err(RpcError::internal)?;
    let roots = instruction_skills::resolve_instruction_skill_roots(workspace_root);
    instruction_skills::get_instruction_skill(&roots, overlays.as_slice(), skill_id.as_str())
        .map(|value| json!(value))
        .ok_or_else(|| RpcError::invalid_params(format!("skill `{skill_id}` not found")))
}

pub(crate) async fn set_native_skill_enabled(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let skill_id = read_first_non_empty_string(params, &["skillId", "id"])
        .ok_or_else(|| RpcError::invalid_params("Missing required string field: skillId"))?;
    let enabled = read_optional_bool(params, "enabled")
        .ok_or_else(|| RpcError::invalid_params("Missing required boolean field: enabled"))?;

    match ctx
        .native_state_store
        .set_entity_enabled(TABLE_NATIVE_SKILLS, skill_id.as_str(), enabled)
        .await
    {
        Ok(value) => Ok(value),
        Err(error) if error.contains("not found") => {
            let workspace_root = match read_optional_string(params, "workspaceId") {
                Some(workspace_id) => {
                    Some(resolve_workspace_path(ctx, workspace_id.as_str()).await?)
                }
                None => None,
            };
            let overlays = ctx
                .native_state_store
                .list_entities(TABLE_NATIVE_SKILLS)
                .await
                .map_err(RpcError::internal)?;
            let roots = instruction_skills::resolve_instruction_skill_roots(workspace_root);
            let summary =
                instruction_skills::list_instruction_skill_summaries(&roots, overlays.as_slice())
                    .into_iter()
                    .find(|entry| entry.id == skill_id)
                    .ok_or_else(|| {
                        RpcError::invalid_params(format!("skill `{skill_id}` not found"))
                    })?;
            ctx.native_state_store
                .upsert_entity(
                    TABLE_NATIVE_SKILLS,
                    skill_id.as_str(),
                    Some(enabled),
                    json!(summary),
                )
                .await
                .map_err(RpcError::internal)
        }
        Err(error) => Err(RpcError::internal(error)),
    }
}
