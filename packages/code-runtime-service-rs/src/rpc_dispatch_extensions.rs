use super::*;
use crate::{instruction_skills, rpc_dispatch::workspace_git_dispatch::resolve_workspace_path};
#[path = "rpc_dispatch_extensions_support.rs"]
mod support;
#[cfg(test)]
use support::instruction_skill_overlay_from_spec;
use support::{
    default_registry_sources, ensure_extension_seed_records_imported,
    extension_record_input_from_spec, instruction_skill_overlays_from_store,
    instruction_skill_record_input_from_overlay, normalize_ui_apps_from_value,
    optional_string_array, optional_workspace_id, string_array_from_object, string_from_object,
};

const INSTRUCTION_SKILL_BODY_RESOURCE_ID: &str = "body";
const INSTRUCTION_SKILL_FRONTMATTER_RESOURCE_ID: &str = "frontmatter";
const INSTRUCTION_SKILL_SUPPORTING_FILES_RESOURCE_ID: &str = "supporting-files";
const INSTRUCTION_SKILL_SUPPORTING_FILE_PREFIX: &str = "supporting-file:";

fn instruction_skill_to_catalog(
    skill: instruction_skills::DiscoveredInstructionSkillSummary,
    workspace_id: Option<&str>,
) -> extensions_runtime::RuntimeExtensionSpecPayload {
    let instruction_skills::DiscoveredInstructionSkillSummary {
        id,
        name,
        description,
        scope,
        source_family,
        entry_path,
        source_root,
        enabled,
        aliases,
        shadowed_by,
    } = skill;
    let now = now_ms();
    let distribution = if scope == "workspace" {
        "workspace"
    } else {
        "bundled"
    };
    extensions_runtime::RuntimeExtensionSpecPayload {
        extension_id: id.clone(),
        version: "1.0.0".to_string(),
        display_name: name.clone(),
        publisher: source_family.clone(),
        summary: description.clone(),
        kind: "instruction".to_string(),
        distribution: distribution.to_string(),
        name,
        transport: "repo-manifest".to_string(),
        lifecycle_state: if enabled {
            "enabled".to_string()
        } else {
            "installed".to_string()
        },
        enabled,
        workspace_id: workspace_id.map(str::to_string),
        capabilities: vec!["instructions".to_string()],
        permissions: Vec::new(),
        ui_apps: Vec::new(),
        provenance: json!({
            "sourceId": "workspace-skill",
            "scope": scope,
            "sourceFamily": source_family,
            "entryPath": entry_path,
            "sourceRoot": source_root,
            "aliases": aliases,
            "shadowedBy": shadowed_by,
        }),
        config: json!({
            "scope": scope,
            "sourceFamily": source_family,
            "entryPath": entry_path,
            "sourceRoot": source_root,
        }),
        installed_at: now,
        updated_at: now,
    }
}

fn instruction_skill_resource_payload(
    extension_id: &str,
    skill: &instruction_skills::ResolvedInstructionSkill,
    resource_id: &str,
) -> Result<extensions_runtime::RuntimeExtensionResourceReadResponsePayload, RpcError> {
    match resource_id {
        INSTRUCTION_SKILL_BODY_RESOURCE_ID => Ok(
            extensions_runtime::RuntimeExtensionResourceReadResponsePayload {
                extension_id: extension_id.to_string(),
                resource_id: resource_id.to_string(),
                content_type: "text/markdown".to_string(),
                content: skill.body.clone(),
                metadata: Some(json!({
                    "source": "instruction-skill",
                    "entryPath": skill.entry_path,
                    "sourceRoot": skill.source_root,
                })),
            },
        ),
        INSTRUCTION_SKILL_FRONTMATTER_RESOURCE_ID => Ok(
            extensions_runtime::RuntimeExtensionResourceReadResponsePayload {
                extension_id: extension_id.to_string(),
                resource_id: resource_id.to_string(),
                content_type: "application/json".to_string(),
                content: serde_json::to_string(&skill.frontmatter)
                    .unwrap_or_else(|_| "{}".to_string()),
                metadata: Some(json!({
                    "source": "instruction-skill",
                    "entryPath": skill.entry_path,
                })),
            },
        ),
        INSTRUCTION_SKILL_SUPPORTING_FILES_RESOURCE_ID => Ok(
            extensions_runtime::RuntimeExtensionResourceReadResponsePayload {
                extension_id: extension_id.to_string(),
                resource_id: resource_id.to_string(),
                content_type: "application/json".to_string(),
                content: serde_json::to_string(&skill.supporting_files)
                    .unwrap_or_else(|_| "[]".to_string()),
                metadata: Some(json!({
                    "source": "instruction-skill",
                    "count": skill.supporting_files.len(),
                })),
            },
        ),
        candidate if candidate.starts_with(INSTRUCTION_SKILL_SUPPORTING_FILE_PREFIX) => {
            let requested_path = candidate
                .trim_start_matches(INSTRUCTION_SKILL_SUPPORTING_FILE_PREFIX)
                .trim();
            let Some(file) = skill
                .supporting_files
                .iter()
                .find(|entry| entry.path == requested_path)
            else {
                return Err(RpcError::invalid_params(format!(
                    "instruction skill `{extension_id}` does not expose supporting file `{requested_path}`"
                )));
            };
            Ok(
                extensions_runtime::RuntimeExtensionResourceReadResponsePayload {
                    extension_id: extension_id.to_string(),
                    resource_id: resource_id.to_string(),
                    content_type: "text/plain".to_string(),
                    content: file.content.clone(),
                    metadata: Some(json!({
                        "source": "instruction-skill",
                        "path": file.path,
                    })),
                },
            )
        }
        _ => Err(RpcError::invalid_params(format!(
            "instruction skill `{extension_id}` does not expose resource `{resource_id}`"
        ))),
    }
}

async fn read_instruction_skill_resource(
    ctx: &AppContext,
    workspace_id: Option<&str>,
    extension_id: &str,
    resource_id: &str,
) -> Result<Option<extensions_runtime::RuntimeExtensionResourceReadResponsePayload>, RpcError> {
    let workspace_root = match workspace_id {
        Some(workspace_id) => Some(resolve_workspace_path(ctx, workspace_id).await?),
        None => None,
    };
    let skill_overlays = instruction_skill_overlays_from_store(ctx, workspace_id).await?;
    let roots = instruction_skills::resolve_instruction_skill_roots(workspace_root);
    let Some(skill) =
        instruction_skills::get_instruction_skill(&roots, skill_overlays.as_slice(), extension_id)
    else {
        return Ok(None);
    };
    instruction_skill_resource_payload(extension_id, &skill, resource_id).map(Some)
}

pub(crate) async fn list_extension_catalog(
    ctx: &AppContext,
    workspace_id: Option<&str>,
    include_disabled: bool,
) -> Result<Vec<extensions_runtime::RuntimeExtensionSpecPayload>, RpcError> {
    ensure_extension_seed_records_imported(ctx).await?;
    let workspace_root = match workspace_id {
        Some(workspace_id) => Some(resolve_workspace_path(ctx, workspace_id).await?),
        None => None,
    };
    let mut entries = ctx.extensions_store.read().await.list_visible(workspace_id);

    let skill_overlays = instruction_skill_overlays_from_store(ctx, workspace_id).await?;
    let roots = instruction_skills::resolve_instruction_skill_roots(workspace_root);
    entries.extend(
        instruction_skills::list_instruction_skill_summaries(&roots, skill_overlays.as_slice())
            .into_iter()
            .map(|entry| instruction_skill_to_catalog(entry, workspace_id)),
    );

    let mut deduped = HashMap::<String, extensions_runtime::RuntimeExtensionSpecPayload>::new();
    for entry in entries {
        deduped.entry(entry.extension_id.clone()).or_insert(entry);
    }
    let mut entries = deduped.into_values().collect::<Vec<_>>();
    if !include_disabled {
        entries.retain(|entry| entry.enabled);
    }
    entries.sort_by(|left, right| {
        right
            .updated_at
            .cmp(&left.updated_at)
            .then_with(|| left.extension_id.cmp(&right.extension_id))
    });
    Ok(entries)
}

fn catalog_entry_by_id(
    entries: Vec<extensions_runtime::RuntimeExtensionSpecPayload>,
    extension_id: &str,
) -> Option<extensions_runtime::RuntimeExtensionSpecPayload> {
    entries
        .into_iter()
        .find(|entry| entry.extension_id == extension_id.trim())
}

fn request_targets_instruction_extension(
    params: &serde_json::Map<String, Value>,
    existing: Option<&extensions_runtime::RuntimeExtensionSpecPayload>,
) -> bool {
    if existing.is_some_and(|entry| entry.kind == "instruction") {
        return true;
    }
    if read_optional_string(params, "kind").is_some_and(|kind| kind == "instruction") {
        return true;
    }
    optional_string_array(params, "capabilities")
        .iter()
        .any(|capability| capability == "instructions")
}

fn build_instruction_skill_overlay_payload(
    extension_id: &str,
    params: &serde_json::Map<String, Value>,
    existing: Option<&extensions_runtime::RuntimeExtensionSpecPayload>,
) -> Value {
    let request_provenance = params.get("provenance").and_then(Value::as_object);
    let request_config = params.get("config").and_then(Value::as_object);
    let existing_provenance = existing.and_then(|entry| entry.provenance.as_object());

    let name = read_optional_string(params, "displayName")
        .or_else(|| read_optional_string(params, "name"))
        .or_else(|| existing.map(|entry| entry.display_name.clone()))
        .unwrap_or_else(|| extension_id.to_string());
    let description = read_optional_string(params, "summary")
        .or_else(|| existing.map(|entry| entry.summary.clone()))
        .unwrap_or_default();
    let scope = string_from_object(request_provenance, &["scope"])
        .or_else(|| string_from_object(request_config, &["scope"]))
        .or_else(|| string_from_object(existing_provenance, &["scope"]))
        .unwrap_or_else(|| {
            if existing.is_some_and(|entry| entry.distribution == "workspace") {
                "workspace".to_string()
            } else {
                "global".to_string()
            }
        });
    let source_family = string_from_object(request_provenance, &["sourceFamily", "source_family"])
        .or_else(|| string_from_object(request_config, &["sourceFamily", "source_family"]))
        .or_else(|| string_from_object(existing_provenance, &["sourceFamily", "source_family"]))
        .or_else(|| existing.map(|entry| entry.publisher.clone()))
        .unwrap_or_else(|| "native".to_string());
    let entry_path = string_from_object(request_provenance, &["entryPath", "entry_path"])
        .or_else(|| string_from_object(request_config, &["entryPath", "entry_path"]))
        .or_else(|| string_from_object(existing_provenance, &["entryPath", "entry_path"]))
        .unwrap_or_default();
    let source_root = string_from_object(request_provenance, &["sourceRoot", "source_root"])
        .or_else(|| string_from_object(request_config, &["sourceRoot", "source_root"]))
        .or_else(|| string_from_object(existing_provenance, &["sourceRoot", "source_root"]))
        .unwrap_or_default();
    let aliases = {
        let values = string_array_from_object(request_provenance, &["aliases"]);
        if !values.is_empty() {
            values
        } else {
            let values = string_array_from_object(request_config, &["aliases"]);
            if !values.is_empty() {
                values
            } else {
                string_array_from_object(existing_provenance, &["aliases"])
            }
        }
    };
    let shadowed_by = string_from_object(request_provenance, &["shadowedBy", "shadowed_by"])
        .or_else(|| string_from_object(existing_provenance, &["shadowedBy", "shadowed_by"]));
    let enabled = read_optional_bool(params, "enabled")
        .or_else(|| existing.map(|entry| entry.enabled))
        .unwrap_or(true);

    json!({
        "id": extension_id,
        "name": name,
        "description": description,
        "version": read_optional_string(params, "version")
            .or_else(|| existing.map(|entry| entry.version.clone()))
            .unwrap_or_else(|| "v1".to_string()),
        "scope": scope,
        "sourceFamily": source_family,
        "entryPath": entry_path,
        "sourceRoot": source_root,
        "enabled": enabled,
        "aliases": aliases,
        "shadowedBy": shadowed_by,
    })
}

async fn upsert_instruction_skill_overlay(
    ctx: &AppContext,
    params: &serde_json::Map<String, Value>,
    existing: Option<&extensions_runtime::RuntimeExtensionSpecPayload>,
) -> Result<extensions_runtime::RuntimeExtensionSpecPayload, RpcError> {
    let extension_id = read_required_string(params, "extensionId")?;
    let Some(existing) = existing else {
        return Err(RpcError::invalid_params(format!(
            "instruction extension `{extension_id}` must come from a workspace or bundled skill source before it can be managed through the extension lifecycle"
        )));
    };
    let payload = build_instruction_skill_overlay_payload(extension_id, params, Some(existing));
    let input = instruction_skill_record_input_from_overlay(&payload).ok_or_else(|| {
        RpcError::internal(format!(
            "instruction extension `{extension_id}` produced an invalid overlay payload"
        ))
    })?;
    let spec = {
        let mut store = ctx.extensions_store.write().await;
        store.upsert_record(input)
    };
    Ok(spec)
}

fn extension_record_input_from_params(
    params: &serde_json::Map<String, Value>,
) -> Result<extensions_runtime::RuntimeExtensionRecordInput, RpcError> {
    let extension_id = read_required_string(params, "extensionId")?.to_string();
    let display_name = read_optional_string(params, "displayName")
        .or_else(|| read_optional_string(params, "name"));
    let transport = read_optional_string(params, "transport").unwrap_or("frontend".to_string());
    let enabled = params
        .get("enabled")
        .and_then(Value::as_bool)
        .unwrap_or(true);
    Ok(extensions_runtime::RuntimeExtensionRecordInput {
        extension_id,
        version: read_optional_string(params, "version"),
        display_name,
        publisher: read_optional_string(params, "publisher"),
        summary: read_optional_string(params, "summary"),
        kind: read_optional_string(params, "kind"),
        distribution: read_optional_string(params, "distribution"),
        transport,
        lifecycle_state: read_optional_string(params, "lifecycleState"),
        enabled,
        workspace_id: optional_workspace_id(params),
        capabilities: optional_string_array(params, "capabilities"),
        permissions: optional_string_array(params, "permissions"),
        ui_apps: normalize_ui_apps_from_value(
            params.get("uiApps").or_else(|| params.get("ui_apps")),
        ),
        provenance: params.get("provenance").cloned(),
        config: params.get("config").cloned(),
    })
}

fn publish_extension_updated_event(
    ctx: &AppContext,
    action: &str,
    spec: &extensions_runtime::RuntimeExtensionSpecPayload,
) {
    publish_turn_event(
        ctx,
        TURN_EVENT_EXTENSION_UPDATED,
        json!({
            "extensionId": spec.extension_id,
            "workspaceId": spec.workspace_id,
            "action": action,
            "updatedAt": spec.updated_at,
        }),
        None,
    );
}

pub(crate) async fn handle_extension_catalog_list_v2(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = optional_workspace_id(params);
    let include_disabled = params
        .get("includeDisabled")
        .and_then(Value::as_bool)
        .unwrap_or(true);
    let kinds = optional_string_array(params, "kinds");
    let mut entries =
        list_extension_catalog(ctx, workspace_id.as_deref(), include_disabled).await?;
    if !kinds.is_empty() {
        entries.retain(|entry| kinds.iter().any(|kind| kind == &entry.kind));
    }
    Ok(json!(entries))
}

pub(crate) async fn handle_extension_get_v2(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = optional_workspace_id(params);
    let extension_id = read_required_string(params, "extensionId")?;
    Ok(json!(catalog_entry_by_id(
        list_extension_catalog(ctx, workspace_id.as_deref(), true).await?,
        extension_id,
    )))
}

pub(crate) async fn handle_extension_install_v2(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = optional_workspace_id(params);
    let extension_id = read_required_string(params, "extensionId")?;
    let existing = catalog_entry_by_id(
        list_extension_catalog(ctx, workspace_id.as_deref(), true).await?,
        extension_id,
    );
    if request_targets_instruction_extension(params, existing.as_ref()) {
        let spec = upsert_instruction_skill_overlay(ctx, params, existing.as_ref()).await?;
        publish_extension_updated_event(ctx, "installed", &spec);
        return Ok(json!(spec));
    }
    let input = extension_record_input_from_params(params)?;
    let spec = {
        let mut store = ctx.extensions_store.write().await;
        store.upsert_record(input)
    };
    publish_extension_updated_event(ctx, "installed", &spec);
    Ok(json!(spec))
}

pub(crate) async fn handle_extension_update_v2(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = optional_workspace_id(params);
    let extension_id = read_required_string(params, "extensionId")?;
    let existing = catalog_entry_by_id(
        list_extension_catalog(ctx, workspace_id.as_deref(), true).await?,
        extension_id,
    );
    if request_targets_instruction_extension(params, existing.as_ref()) {
        let spec = upsert_instruction_skill_overlay(ctx, params, existing.as_ref()).await?;
        publish_extension_updated_event(ctx, "updated", &spec);
        return Ok(json!(spec));
    }
    let input = extension_record_input_from_params(params)?;
    let spec = {
        let mut store = ctx.extensions_store.write().await;
        store.upsert_record(input)
    };
    publish_extension_updated_event(ctx, "updated", &spec);
    Ok(json!(spec))
}

pub(crate) async fn handle_extension_set_state_v2(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = optional_workspace_id(params);
    let extension_id = read_required_string(params, "extensionId")?;
    let enabled = read_optional_bool(params, "enabled")
        .ok_or_else(|| RpcError::invalid_params("Missing required boolean field: enabled"))?;
    ensure_extension_seed_records_imported(ctx).await?;

    let store_updated = {
        let mut store = ctx.extensions_store.write().await;
        store.set_enabled(workspace_id.as_deref(), extension_id, enabled)
    };
    if let Some(spec) = store_updated {
        publish_extension_updated_event(ctx, "updated", &spec);
        return Ok(json!(spec));
    }

    let existing = catalog_entry_by_id(
        list_extension_catalog(ctx, workspace_id.as_deref(), true).await?,
        extension_id,
    )
    .ok_or_else(|| RpcError::invalid_params(format!("extension `{extension_id}` was not found")))?;
    let mut input = extension_record_input_from_spec(&existing);
    input.enabled = enabled;
    input.lifecycle_state = Some(if enabled {
        "enabled".to_string()
    } else {
        "installed".to_string()
    });
    let spec = {
        let mut store = ctx.extensions_store.write().await;
        store.upsert_record(input)
    };
    publish_extension_updated_event(ctx, "updated", &spec);
    Ok(json!(spec))
}

pub(crate) async fn handle_extension_remove_v2(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = optional_workspace_id(params);
    let extension_id = read_required_string(params, "extensionId")?;
    ensure_extension_seed_records_imported(ctx).await?;

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

pub(crate) async fn handle_extension_registry_search_v2(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = optional_workspace_id(params);
    let query = read_optional_string(params, "query")
        .as_deref()
        .map(str::trim)
        .unwrap_or("")
        .to_ascii_lowercase();
    let kinds = optional_string_array(params, "kinds");
    let mut results = list_extension_catalog(ctx, workspace_id.as_deref(), true).await?;
    if !query.is_empty() {
        results.retain(|entry| {
            entry
                .extension_id
                .to_ascii_lowercase()
                .contains(query.as_str())
                || entry
                    .display_name
                    .to_ascii_lowercase()
                    .contains(query.as_str())
                || entry.summary.to_ascii_lowercase().contains(query.as_str())
        });
    }
    if !kinds.is_empty() {
        results.retain(|entry| kinds.iter().any(|kind| kind == &entry.kind));
    }
    Ok(json!({
        "query": query,
        "results": results,
        "sources": default_registry_sources(),
    }))
}

pub(crate) async fn handle_extension_registry_sources_v2(
    _ctx: &AppContext,
    _params: &Value,
) -> Result<Value, RpcError> {
    Ok(json!(default_registry_sources()))
}

pub(crate) async fn handle_extension_permissions_evaluate_v2(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = optional_workspace_id(params);
    let extension_id = read_required_string(params, "extensionId")?;
    let spec = catalog_entry_by_id(
        list_extension_catalog(ctx, workspace_id.as_deref(), true).await?,
        extension_id,
    )
    .ok_or_else(|| RpcError::invalid_params(format!("extension `{extension_id}` was not found")))?;
    let decision = if spec.lifecycle_state == "blocked" {
        "deny"
    } else if spec.permissions.is_empty() {
        "allow"
    } else {
        "ask"
    };
    let warnings = if spec.permissions.is_empty() {
        Vec::new()
    } else {
        vec!["Extension requests non-empty permissions.".to_string()]
    };
    Ok(json!({
        "extensionId": spec.extension_id,
        "permissions": spec.permissions,
        "decision": decision,
        "warnings": warnings,
    }))
}

pub(crate) async fn handle_extension_health_read_v2(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = optional_workspace_id(params);
    let extension_id = read_required_string(params, "extensionId")?;
    let spec = catalog_entry_by_id(
        list_extension_catalog(ctx, workspace_id.as_deref(), true).await?,
        extension_id,
    )
    .ok_or_else(|| RpcError::invalid_params(format!("extension `{extension_id}` was not found")))?;
    let healthy = spec.enabled && !matches!(spec.lifecycle_state.as_str(), "blocked" | "degraded");
    let warnings = match spec.lifecycle_state.as_str() {
        "blocked" => vec![
            "Extension is blocked by missing readiness or permission requirements.".to_string(),
        ],
        "degraded" => vec!["Extension is degraded and should be inspected before use.".to_string()],
        _ => Vec::new(),
    };
    Ok(json!({
        "extensionId": spec.extension_id,
        "lifecycleState": spec.lifecycle_state,
        "healthy": healthy,
        "warnings": warnings,
        "checkedAt": now_ms(),
    }))
}

pub(crate) async fn handle_extension_tools_list_v2(
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

pub(crate) async fn handle_extension_tool_invoke_v2(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = optional_workspace_id(params);
    let extension_id = read_required_string(params, "extensionId")?;
    let tool_name = read_required_string(params, "toolName")?;
    let input = match params.get("input") {
        Some(Value::Object(record)) => Some(record),
        Some(Value::Null) | None => None,
        Some(_) => {
            return Err(RpcError::invalid_params(
                "Field `input` must be a JSON object when provided.",
            ));
        }
    };
    ensure_extension_seed_records_imported(ctx).await?;
    let store = ctx.extensions_store.read().await;
    let Some(result) =
        store.invoke_tool(workspace_id.as_deref(), extension_id, tool_name, input)?
    else {
        return Err(RpcError::invalid_params(format!(
            "extension `{extension_id}` was not found"
        )));
    };
    Ok(result)
}

pub(crate) async fn handle_extension_resource_read_v2(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = optional_workspace_id(params);
    let extension_id = read_required_string(params, "extensionId")?;
    let resource_id = read_required_string(params, "resourceId")?;
    if let Some(resource) =
        read_instruction_skill_resource(ctx, workspace_id.as_deref(), extension_id, resource_id)
            .await?
    {
        return Ok(json!(resource));
    }
    let store = ctx.extensions_store.read().await;
    let Some(resource) = store.read_resource(workspace_id.as_deref(), extension_id, resource_id)
    else {
        return Err(RpcError::invalid_params(format!(
            "extension `{extension_id}` was not found"
        )));
    };
    Ok(json!(resource))
}

#[cfg(test)]
#[path = "rpc_dispatch_extensions_tests.rs"]
mod tests;
