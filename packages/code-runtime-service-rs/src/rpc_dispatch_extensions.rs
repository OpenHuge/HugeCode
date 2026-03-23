use super::*;
use crate::{
    instruction_skills,
    native_state_store::{TABLE_NATIVE_PLUGINS, TABLE_NATIVE_SKILLS},
    rpc_dispatch::workspace_git_dispatch::resolve_workspace_path,
    rpc_dispatch_native_skills::set_native_skill_enabled,
};

const INSTRUCTION_SKILL_BODY_RESOURCE_ID: &str = "body";
const INSTRUCTION_SKILL_FRONTMATTER_RESOURCE_ID: &str = "frontmatter";
const INSTRUCTION_SKILL_SUPPORTING_FILES_RESOURCE_ID: &str = "supporting-files";
const INSTRUCTION_SKILL_SUPPORTING_FILE_PREFIX: &str = "supporting-file:";

fn optional_string_array_from_value(value: Option<&Value>) -> Vec<String> {
    value
        .and_then(Value::as_array)
        .map(|entries| {
            entries
                .iter()
                .filter_map(Value::as_str)
                .map(str::trim)
                .filter(|entry| !entry.is_empty())
                .map(ToString::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

fn string_from_object(record: Option<&serde_json::Map<String, Value>>, keys: &[&str]) -> Option<String> {
    let record = record?;
    for key in keys {
        let value = record
            .get(*key)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|entry| !entry.is_empty());
        if let Some(value) = value {
            return Some(value.to_string());
        }
    }
    None
}

fn string_array_from_object(record: Option<&serde_json::Map<String, Value>>, keys: &[&str]) -> Vec<String> {
    let record = match record {
        Some(record) => record,
        None => return Vec::new(),
    };
    for key in keys {
        let values = optional_string_array_from_value(record.get(*key));
        if !values.is_empty() {
            return values;
        }
    }
    Vec::new()
}

fn optional_workspace_id(params: &serde_json::Map<String, Value>) -> Option<String> {
    read_optional_string(params, "workspaceId")
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn optional_string_array(params: &serde_json::Map<String, Value>, key: &str) -> Vec<String> {
    params
        .get(key)
        .and_then(Value::as_array)
        .map(|entries| {
            entries
                .iter()
                .filter_map(Value::as_str)
                .map(|entry| entry.trim().to_string())
                .filter(|entry| !entry.is_empty())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

fn normalize_ui_apps_from_value(value: Option<&Value>) -> Vec<extensions_runtime::RuntimeExtensionUiAppPayload> {
    value
        .and_then(Value::as_array)
        .map(|entries| {
            entries
                .iter()
                .filter_map(Value::as_object)
                .filter_map(|entry| {
                    let app_id = entry
                        .get("appId")
                        .or_else(|| entry.get("app_id"))
                        .and_then(Value::as_str)
                        .map(str::trim)
                        .filter(|value| !value.is_empty())?
                        .to_string();
                    let route = entry
                        .get("route")
                        .and_then(Value::as_str)
                        .map(str::trim)
                        .filter(|value| !value.is_empty())?
                        .to_string();
                    Some(extensions_runtime::RuntimeExtensionUiAppPayload {
                        app_id,
                        title: entry
                            .get("title")
                            .and_then(Value::as_str)
                            .map(str::trim)
                            .filter(|value| !value.is_empty())
                            .unwrap_or(route.as_str())
                            .to_string(),
                        route,
                        description: entry
                            .get("description")
                            .and_then(Value::as_str)
                            .map(str::to_string),
                        icon: entry.get("icon").and_then(Value::as_str).map(str::to_string),
                    })
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

fn default_registry_sources() -> Vec<extensions_runtime::RuntimeExtensionRegistrySourcePayload> {
    vec![
        extensions_runtime::RuntimeExtensionRegistrySourcePayload {
            source_id: "workspace".to_string(),
            display_name: "Workspace Extensions".to_string(),
            kind: "workspace".to_string(),
            url: None,
            public: false,
            install_supported: true,
            search_supported: true,
        },
        extensions_runtime::RuntimeExtensionRegistrySourcePayload {
            source_id: "hugecode-private-registry".to_string(),
            display_name: "HugeCode Private Registry".to_string(),
            kind: "private-registry".to_string(),
            url: Some("https://registry.hugecode.local".to_string()),
            public: false,
            install_supported: true,
            search_supported: true,
        },
        extensions_runtime::RuntimeExtensionRegistrySourcePayload {
            source_id: "mcp-registry".to_string(),
            display_name: "MCP Registry".to_string(),
            kind: "public-registry".to_string(),
            url: Some("https://registry.modelcontextprotocol.io".to_string()),
            public: true,
            install_supported: true,
            search_supported: true,
        },
    ]
}

fn provider_extension_to_catalog(
    extension: &RuntimeProviderExtension,
    workspace_id: Option<&str>,
) -> extensions_runtime::RuntimeExtensionSpecPayload {
    let now = now_ms();
    extensions_runtime::RuntimeExtensionSpecPayload {
        extension_id: extension.provider_id.clone(),
        version: "1.0.0".to_string(),
        display_name: extension.display_name.clone(),
        publisher: "workspace-provider".to_string(),
        summary: format!("Provider extension for {}", extension.display_name),
        kind: "provider".to_string(),
        distribution: if workspace_id.is_some() {
            "workspace".to_string()
        } else {
            "private-registry".to_string()
        },
        name: extension.display_name.clone(),
        transport: "openai-compatible".to_string(),
        lifecycle_state: if extension.api_key.is_some() {
            "enabled".to_string()
        } else {
            "blocked".to_string()
        },
        enabled: extension.api_key.is_some(),
        workspace_id: workspace_id.map(str::to_string),
        capabilities: vec!["models".to_string(), "provider-routing".to_string()],
        permissions: if extension.api_key_env.is_empty() {
            vec![]
        } else {
            vec![format!("secret:{}", extension.api_key_env)]
        },
        ui_apps: Vec::new(),
        provenance: json!({
            "sourceId": "workspace-provider",
            "aliases": extension.aliases,
            "pool": extension.pool,
            "defaultModelId": extension.default_model_id,
            "compatBaseUrl": extension.compat_base_url,
        }),
        config: json!({
            "pool": extension.pool,
            "aliases": extension.aliases,
            "defaultModelId": extension.default_model_id,
            "compatBaseUrl": extension.compat_base_url,
            "apiKeyEnv": extension.api_key_env,
        }),
        installed_at: now,
        updated_at: now,
    }
}

fn native_plugin_to_catalog(
    plugin: &Value,
    workspace_id: Option<&str>,
) -> Option<extensions_runtime::RuntimeExtensionSpecPayload> {
    let object = plugin.as_object()?;
    let extension_id = object
        .get("pluginId")
        .or_else(|| object.get("id"))
        .and_then(Value::as_str)?
        .trim()
        .to_string();
    let display_name = object
        .get("name")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(extension_id.as_str())
        .to_string();
    let enabled = object.get("enabled").and_then(Value::as_bool).unwrap_or(true);
    Some(extensions_runtime::RuntimeExtensionSpecPayload {
        extension_id,
        version: object
            .get("version")
            .and_then(Value::as_str)
            .unwrap_or("1.0.0")
            .to_string(),
        display_name: display_name.clone(),
        publisher: object
            .get("publisher")
            .and_then(Value::as_str)
            .unwrap_or("native")
            .to_string(),
        summary: object
            .get("description")
            .or_else(|| object.get("summary"))
            .and_then(Value::as_str)
            .unwrap_or("Host-native extension")
            .to_string(),
        kind: "host".to_string(),
        distribution: "workspace".to_string(),
        name: display_name,
        transport: "host-native".to_string(),
        lifecycle_state: if enabled {
            "enabled".to_string()
        } else {
            "installed".to_string()
        },
        enabled,
        workspace_id: workspace_id.map(str::to_string),
        capabilities: optional_string_array_from_object(object, "capabilities"),
        permissions: optional_string_array_from_object(object, "permissions"),
        ui_apps: normalize_ui_apps_from_value(object.get("uiApps").or_else(|| object.get("ui_apps"))),
        provenance: json!({
            "sourceId": "native-plugin",
        }),
        config: Value::Object(object.clone()),
        installed_at: object
            .get("updatedAt")
            .and_then(Value::as_u64)
            .unwrap_or_else(now_ms),
        updated_at: object
            .get("updatedAt")
            .and_then(Value::as_u64)
            .unwrap_or_else(now_ms),
    })
}

fn optional_string_array_from_object(
    record: &serde_json::Map<String, Value>,
    key: &str,
) -> Vec<String> {
    record
        .get(key)
        .and_then(Value::as_array)
        .map(|entries| {
            entries
                .iter()
                .filter_map(Value::as_str)
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

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
                content: serde_json::to_string(&skill.frontmatter).unwrap_or_else(|_| "{}".to_string()),
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
                content: serde_json::to_string(&skill.supporting_files).unwrap_or_else(|_| "[]".to_string()),
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
            Ok(extensions_runtime::RuntimeExtensionResourceReadResponsePayload {
                extension_id: extension_id.to_string(),
                resource_id: resource_id.to_string(),
                content_type: "text/plain".to_string(),
                content: file.content.clone(),
                metadata: Some(json!({
                    "source": "instruction-skill",
                    "path": file.path,
                })),
            })
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
    let skill_overlays = ctx
        .native_state_store
        .list_entities(TABLE_NATIVE_SKILLS)
        .await
        .map_err(RpcError::internal)?;
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
    let workspace_root = match workspace_id {
        Some(workspace_id) => Some(resolve_workspace_path(ctx, workspace_id).await?),
        None => None,
    };
    let mut entries = ctx.extensions_store.read().await.list(workspace_id);

    let native_plugins = ctx
        .native_state_store
        .list_entities(TABLE_NATIVE_PLUGINS)
        .await
        .map_err(RpcError::internal)?;
    entries.extend(
        native_plugins
            .iter()
            .filter_map(|entry| native_plugin_to_catalog(entry, workspace_id)),
    );

    let skill_overlays = ctx
        .native_state_store
        .list_entities(TABLE_NATIVE_SKILLS)
        .await
        .map_err(RpcError::internal)?;
    let roots = instruction_skills::resolve_instruction_skill_roots(workspace_root);
    entries.extend(
        instruction_skills::list_instruction_skill_summaries(&roots, skill_overlays.as_slice())
            .into_iter()
            .map(|entry| instruction_skill_to_catalog(entry, workspace_id)),
    );

    entries.extend(
        ctx.config
            .provider_extensions
            .iter()
            .map(|entry| provider_extension_to_catalog(entry, workspace_id)),
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
    let workspace_id = optional_workspace_id(params);
    let extension_id = read_required_string(params, "extensionId")?;
    let Some(existing) = existing else {
        return Err(RpcError::invalid_params(format!(
            "instruction extension `{extension_id}` must come from a workspace or bundled skill source before it can be managed through the extension lifecycle"
        )));
    };
    let payload = build_instruction_skill_overlay_payload(extension_id, params, Some(existing));
    let enabled = payload.get("enabled").and_then(Value::as_bool);
    ctx.native_state_store
        .upsert_entity(TABLE_NATIVE_SKILLS, extension_id, enabled, payload)
        .await
        .map_err(RpcError::internal)?;
    let entries = list_extension_catalog(ctx, workspace_id.as_deref(), true).await?;
    catalog_entry_by_id(entries, extension_id).ok_or_else(|| {
        RpcError::internal(format!(
            "instruction extension `{extension_id}` was updated but could not be reloaded from the catalog"
        ))
    })
}

fn extension_record_input_from_params(
    params: &serde_json::Map<String, Value>,
) -> Result<extensions_runtime::RuntimeExtensionRecordInput, RpcError> {
    let extension_id = read_required_string(params, "extensionId")?.to_string();
    let display_name =
        read_optional_string(params, "displayName").or_else(|| read_optional_string(params, "name"));
    let transport = read_optional_string(params, "transport").unwrap_or("frontend".to_string());
    let enabled = params.get("enabled").and_then(Value::as_bool).unwrap_or(true);
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
        ui_apps: normalize_ui_apps_from_value(params.get("uiApps").or_else(|| params.get("ui_apps"))),
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

pub(super) async fn handle_extension_catalog_list_v2(
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
    let mut entries = list_extension_catalog(ctx, workspace_id.as_deref(), include_disabled).await?;
    if !kinds.is_empty() {
        entries.retain(|entry| kinds.iter().any(|kind| kind == &entry.kind));
    }
    Ok(json!(entries))
}

pub(super) async fn handle_extension_get_v2(
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

pub(super) async fn handle_extension_install_v2(
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

pub(super) async fn handle_extension_update_v2(
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

pub(super) async fn handle_extension_set_state_v2(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = optional_workspace_id(params);
    let extension_id = read_required_string(params, "extensionId")?;
    let enabled = read_optional_bool(params, "enabled")
        .ok_or_else(|| RpcError::invalid_params("Missing required boolean field: enabled"))?;

    let store_updated = {
        let mut store = ctx.extensions_store.write().await;
        store.set_enabled(workspace_id.as_deref(), extension_id, enabled)
    };
    if let Some(spec) = store_updated {
        publish_extension_updated_event(ctx, "updated", &spec);
        return Ok(json!(spec));
    }

    if let Ok(payload) = ctx
        .native_state_store
        .set_entity_enabled(TABLE_NATIVE_PLUGINS, extension_id, enabled)
        .await
    {
        if let Some(spec) = native_plugin_to_catalog(&payload, workspace_id.as_deref()) {
            publish_extension_updated_event(ctx, "updated", &spec);
            return Ok(json!(spec));
        }
    }

    let _ = set_native_skill_enabled(ctx, &Value::Object(params.clone())).await?;
    let entries = list_extension_catalog(ctx, workspace_id.as_deref(), true).await?;
    Ok(json!(catalog_entry_by_id(entries, extension_id)))
}

pub(super) async fn handle_extension_remove_v2(
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

    let removed = if existing.as_ref().is_some_and(|entry| entry.kind == "instruction") {
        ctx.native_state_store
            .remove_entity(TABLE_NATIVE_SKILLS, extension_id)
            .await
            .unwrap_or(false)
    } else {
        let store_removed = {
            let mut store = ctx.extensions_store.write().await;
            store.remove(workspace_id.as_deref(), extension_id)
        };
        let native_plugin_removed = ctx
            .native_state_store
            .remove_entity(TABLE_NATIVE_PLUGINS, extension_id)
            .await
            .unwrap_or(false);
        let native_skill_removed = ctx
            .native_state_store
            .remove_entity(TABLE_NATIVE_SKILLS, extension_id)
            .await
            .unwrap_or(false);
        store_removed || native_plugin_removed || native_skill_removed
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

pub(super) async fn handle_extension_registry_search_v2(
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
            entry.extension_id.to_ascii_lowercase().contains(query.as_str())
                || entry.display_name.to_ascii_lowercase().contains(query.as_str())
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

pub(super) async fn handle_extension_registry_sources_v2(
    _ctx: &AppContext,
    _params: &Value,
) -> Result<Value, RpcError> {
    Ok(json!(default_registry_sources()))
}

pub(super) async fn handle_extension_permissions_evaluate_v2(
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

pub(super) async fn handle_extension_health_read_v2(
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
        "blocked" => vec!["Extension is blocked by missing readiness or permission requirements.".to_string()],
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

pub(super) async fn handle_extension_ui_apps_list_v2(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = optional_workspace_id(params);
    let extension_id = read_optional_string(params, "extensionId");
    let entries = list_extension_catalog(ctx, workspace_id.as_deref(), true).await?;
    let apps = if let Some(ref extension_id) = extension_id {
        catalog_entry_by_id(entries, extension_id.as_str())
            .map(|entry| entry.ui_apps)
            .unwrap_or_default()
    } else {
        entries
            .into_iter()
            .flat_map(|entry| entry.ui_apps)
            .collect::<Vec<_>>()
    };
    Ok(json!({
        "workspaceId": workspace_id,
        "extensionId": extension_id,
        "apps": apps,
    }))
}

pub(super) async fn handle_extension_tools_list_v2(
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

pub(super) async fn handle_extension_resource_read_v2(
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
