use super::*;

pub(super) fn optional_string_array_from_value(value: Option<&Value>) -> Vec<String> {
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

pub(super) fn string_from_object(
    record: Option<&serde_json::Map<String, Value>>,
    keys: &[&str],
) -> Option<String> {
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

pub(super) fn string_array_from_object(
    record: Option<&serde_json::Map<String, Value>>,
    keys: &[&str],
) -> Vec<String> {
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

pub(super) fn optional_workspace_id(params: &serde_json::Map<String, Value>) -> Option<String> {
    read_optional_string(params, "workspaceId")
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

pub(super) fn optional_string_array(
    params: &serde_json::Map<String, Value>,
    key: &str,
) -> Vec<String> {
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

pub(super) fn normalize_ui_apps_from_value(
    value: Option<&Value>,
) -> Vec<extensions_runtime::RuntimeExtensionUiAppPayload> {
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
                        icon: entry
                            .get("icon")
                            .and_then(Value::as_str)
                            .map(str::to_string),
                    })
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

pub(super) fn default_registry_sources(
) -> Vec<extensions_runtime::RuntimeExtensionRegistrySourcePayload> {
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

pub(super) fn provider_extension_to_catalog(
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

pub(super) fn extension_record_input_from_spec(
    spec: &extensions_runtime::RuntimeExtensionSpecPayload,
) -> extensions_runtime::RuntimeExtensionRecordInput {
    extensions_runtime::RuntimeExtensionRecordInput {
        extension_id: spec.extension_id.clone(),
        version: Some(spec.version.clone()),
        display_name: Some(spec.display_name.clone()),
        publisher: Some(spec.publisher.clone()),
        summary: Some(spec.summary.clone()),
        kind: Some(spec.kind.clone()),
        distribution: Some(spec.distribution.clone()),
        transport: spec.transport.clone(),
        lifecycle_state: Some(spec.lifecycle_state.clone()),
        enabled: spec.enabled,
        workspace_id: spec.workspace_id.clone(),
        capabilities: spec.capabilities.clone(),
        permissions: spec.permissions.clone(),
        ui_apps: spec.ui_apps.clone(),
        provenance: Some(spec.provenance.clone()),
        config: Some(spec.config.clone()),
    }
}

pub(super) fn instruction_skill_overlay_from_spec(
    spec: &extensions_runtime::RuntimeExtensionSpecPayload,
) -> Option<Value> {
    if spec.kind != "instruction" {
        return None;
    }
    let provenance = spec.provenance.as_object();
    let config = spec.config.as_object();
    let scope = string_from_object(provenance, &["scope"])
        .or_else(|| string_from_object(config, &["scope"]))
        .unwrap_or_else(|| {
            if spec.distribution == "workspace" {
                "workspace".to_string()
            } else {
                "global".to_string()
            }
        });
    let source_family = string_from_object(provenance, &["sourceFamily", "source_family"])
        .or_else(|| string_from_object(config, &["sourceFamily", "source_family"]))
        .unwrap_or_else(|| spec.publisher.clone());
    let entry_path = string_from_object(provenance, &["entryPath", "entry_path"])
        .or_else(|| string_from_object(config, &["entryPath", "entry_path"]))
        .unwrap_or_default();
    let source_root = string_from_object(provenance, &["sourceRoot", "source_root"])
        .or_else(|| string_from_object(config, &["sourceRoot", "source_root"]))
        .unwrap_or_default();
    let aliases = string_array_from_object(provenance, &["aliases"]);
    let shadowed_by = string_from_object(provenance, &["shadowedBy", "shadowed_by"]);
    Some(json!({
        "id": spec.extension_id,
        "name": spec.display_name,
        "description": spec.summary,
        "version": spec.version,
        "scope": scope,
        "sourceFamily": source_family,
        "entryPath": entry_path,
        "sourceRoot": source_root,
        "enabled": spec.enabled,
        "aliases": aliases,
        "shadowedBy": shadowed_by,
    }))
}

pub(super) fn instruction_skill_record_input_from_overlay(
    overlay: &Value,
) -> Option<extensions_runtime::RuntimeExtensionRecordInput> {
    let object = overlay.as_object()?;
    let extension_id = object.get("id")?.as_str()?.trim();
    if extension_id.is_empty() {
        return None;
    }
    let enabled = object
        .get("enabled")
        .and_then(Value::as_bool)
        .unwrap_or(true);
    let scope = object
        .get("scope")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("global");
    let source_family = object
        .get("sourceFamily")
        .or_else(|| object.get("source_family"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("native");
    let entry_path = object
        .get("entryPath")
        .or_else(|| object.get("entry_path"))
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let source_root = object
        .get("sourceRoot")
        .or_else(|| object.get("source_root"))
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let aliases = object
        .get("aliases")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(ToString::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let shadowed_by = object
        .get("shadowedBy")
        .or_else(|| object.get("shadowed_by"))
        .and_then(Value::as_str);
    let display_name = object
        .get("name")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(extension_id)
        .to_string();
    let summary = object
        .get("description")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let distribution = if scope == "workspace" {
        "workspace"
    } else {
        "bundled"
    };
    Some(extensions_runtime::RuntimeExtensionRecordInput {
        extension_id: extension_id.to_string(),
        version: object
            .get("version")
            .and_then(Value::as_str)
            .map(ToString::to_string),
        display_name: Some(display_name),
        publisher: Some(source_family.to_string()),
        summary: Some(summary),
        kind: Some("instruction".to_string()),
        distribution: Some(distribution.to_string()),
        transport: "repo-manifest".to_string(),
        lifecycle_state: Some(if enabled {
            "enabled".to_string()
        } else {
            "installed".to_string()
        }),
        enabled,
        workspace_id: None,
        capabilities: vec!["instructions".to_string()],
        permissions: Vec::new(),
        ui_apps: Vec::new(),
        provenance: Some(json!({
            "sourceId": "workspace-skill",
            "scope": scope,
            "sourceFamily": source_family,
            "entryPath": entry_path,
            "sourceRoot": source_root,
            "aliases": aliases,
            "shadowedBy": shadowed_by,
        })),
        config: Some(json!({
            "scope": scope,
            "sourceFamily": source_family,
            "entryPath": entry_path,
            "sourceRoot": source_root,
        })),
    })
}

fn provider_extension_record_input(
    extension: &RuntimeProviderExtension,
) -> extensions_runtime::RuntimeExtensionRecordInput {
    let spec = provider_extension_to_catalog(extension, None);
    extension_record_input_from_spec(&spec)
}

pub(super) async fn ensure_extension_seed_records_imported(
    ctx: &AppContext,
) -> Result<(), RpcError> {
    let legacy_skill_overlays = ctx
        .native_state_store
        .list_entities(crate::native_state_store::TABLE_NATIVE_SKILLS)
        .await
        .map_err(RpcError::internal)?;

    let existing_ids = {
        let store = ctx.extensions_store.read().await;
        store
            .list(None)
            .into_iter()
            .map(|entry| entry.extension_id)
            .collect::<HashSet<_>>()
    };

    let mut inputs = Vec::new();
    for overlay in legacy_skill_overlays.iter() {
        let Some(input) = instruction_skill_record_input_from_overlay(overlay) else {
            continue;
        };
        if !existing_ids.contains(input.extension_id.as_str()) {
            inputs.push(input);
        }
    }
    for extension in &ctx.config.provider_extension_seeds {
        let input = provider_extension_record_input(extension);
        if !existing_ids.contains(input.extension_id.as_str()) {
            inputs.push(input);
        }
    }

    if inputs.is_empty() {
        return Ok(());
    }

    let mut store = ctx.extensions_store.write().await;
    for input in inputs {
        store.upsert_record(input);
    }
    Ok(())
}

pub(super) async fn instruction_skill_overlays_from_store(
    ctx: &AppContext,
    workspace_id: Option<&str>,
) -> Result<Vec<Value>, RpcError> {
    ensure_extension_seed_records_imported(ctx).await?;
    let store = ctx.extensions_store.read().await;
    Ok(store
        .list_visible(workspace_id)
        .into_iter()
        .filter_map(|entry| instruction_skill_overlay_from_spec(&entry))
        .collect::<Vec<_>>())
}
