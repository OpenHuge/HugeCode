use super::*;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeExtensionUiAppPayload {
    pub(crate) app_id: String,
    pub(crate) title: String,
    pub(crate) route: String,
    pub(crate) description: Option<String>,
    pub(crate) icon: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeExtensionRegistrySourcePayload {
    pub(crate) source_id: String,
    pub(crate) display_name: String,
    pub(crate) kind: String,
    pub(crate) url: Option<String>,
    pub(crate) public: bool,
    pub(crate) install_supported: bool,
    pub(crate) search_supported: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeExtensionSpecPayload {
    pub(crate) extension_id: String,
    pub(crate) version: String,
    pub(crate) display_name: String,
    pub(crate) publisher: String,
    pub(crate) summary: String,
    pub(crate) kind: String,
    pub(crate) distribution: String,
    pub(crate) name: String,
    pub(crate) transport: String,
    pub(crate) lifecycle_state: String,
    pub(crate) enabled: bool,
    pub(crate) workspace_id: Option<String>,
    pub(crate) capabilities: Vec<String>,
    pub(crate) permissions: Vec<String>,
    pub(crate) ui_apps: Vec<RuntimeExtensionUiAppPayload>,
    pub(crate) provenance: Value,
    pub(crate) config: Value,
    pub(crate) installed_at: u64,
    pub(crate) updated_at: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeExtensionToolSummaryPayload {
    pub(crate) extension_id: String,
    pub(crate) tool_name: String,
    pub(crate) description: String,
    pub(crate) input_schema: Option<Value>,
    pub(crate) read_only: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeExtensionResourceReadResponsePayload {
    pub(crate) extension_id: String,
    pub(crate) resource_id: String,
    pub(crate) content_type: String,
    pub(crate) content: String,
    pub(crate) metadata: Option<Value>,
}

#[derive(Clone, Debug)]
pub(crate) struct RuntimeExtensionRecordInput {
    pub(crate) extension_id: String,
    pub(crate) version: Option<String>,
    pub(crate) display_name: Option<String>,
    pub(crate) publisher: Option<String>,
    pub(crate) summary: Option<String>,
    pub(crate) kind: Option<String>,
    pub(crate) distribution: Option<String>,
    pub(crate) transport: String,
    pub(crate) lifecycle_state: Option<String>,
    pub(crate) enabled: bool,
    pub(crate) workspace_id: Option<String>,
    pub(crate) capabilities: Vec<String>,
    pub(crate) permissions: Vec<String>,
    pub(crate) ui_apps: Vec<RuntimeExtensionUiAppPayload>,
    pub(crate) provenance: Option<Value>,
    pub(crate) config: Option<Value>,
}

#[derive(Clone, Debug)]
struct RuntimeExtensionSpecRecord {
    extension_id: String,
    version: String,
    display_name: String,
    publisher: String,
    summary: String,
    kind: String,
    distribution: String,
    transport: String,
    lifecycle_state: String,
    enabled: bool,
    workspace_id: Option<String>,
    capabilities: Vec<String>,
    permissions: Vec<String>,
    ui_apps: Vec<RuntimeExtensionUiAppPayload>,
    provenance: Value,
    config: Value,
    installed_at: u64,
    updated_at: u64,
}

#[derive(Default)]
pub(crate) struct RuntimeExtensionStore {
    entries: HashMap<String, RuntimeExtensionSpecRecord>,
}

fn normalize_workspace_id(workspace_id: Option<&str>) -> Option<String> {
    workspace_id
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn extension_store_key(workspace_id: Option<&str>, extension_id: &str) -> String {
    let namespace = workspace_id
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("_global");
    format!("{namespace}::{extension_id}")
}

fn normalize_extension_config(config: Option<Value>) -> Value {
    match config {
        Some(Value::Object(_)) => config.unwrap_or(Value::Object(serde_json::Map::new())),
        _ => Value::Object(serde_json::Map::new()),
    }
}

fn sanitize_string_list(values: &[String]) -> Vec<String> {
    let mut normalized = values
        .iter()
        .map(|entry| entry.trim().to_string())
        .filter(|entry| !entry.is_empty())
        .collect::<Vec<_>>();
    normalized.sort_unstable();
    normalized.dedup();
    normalized
}

fn read_string_list_from_value(value: Option<&Value>) -> Vec<String> {
    let mut values = value
        .and_then(Value::as_array)
        .map(|entries| {
            entries
                .iter()
                .filter_map(Value::as_str)
                .map(|entry| entry.trim().to_string())
                .filter(|entry| !entry.is_empty())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    values.sort_unstable();
    values.dedup();
    values
}

fn read_non_empty_string_field(config: &Value, key: &str) -> Option<String> {
    config
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(str::to_string)
}

fn infer_extension_kind(transport: &str, config: &Value) -> String {
    if let Some(value) = read_non_empty_string_field(config, "kind") {
        return value;
    }
    match transport {
        "repo-manifest" => "instruction".to_string(),
        "mcp-stdio" | "mcp-http" => "mcp".to_string(),
        "host-native" => "host".to_string(),
        "openai-compatible" => "provider".to_string(),
        _ => "bundle".to_string(),
    }
}

fn infer_extension_distribution(workspace_id: Option<&str>, config: &Value) -> String {
    if let Some(value) = read_non_empty_string_field(config, "distribution") {
        return value;
    }
    if workspace_id.is_some() {
        "workspace".to_string()
    } else {
        "bundled".to_string()
    }
}

fn infer_lifecycle_state(enabled: bool, config: &Value) -> String {
    if let Some(value) = read_non_empty_string_field(config, "lifecycleState") {
        return value;
    }
    if enabled {
        "enabled".to_string()
    } else {
        "installed".to_string()
    }
}

fn infer_capabilities(extension_id: &str, kind: &str, config: &Value) -> Vec<String> {
    let explicit = read_string_list_from_value(config.get("capabilities"));
    if !explicit.is_empty() {
        return explicit;
    }
    let mut values = Vec::new();
    if !parse_tools_from_config(extension_id, config).is_empty() {
        values.push("tools".to_string());
    }
    if config
        .get("resources")
        .and_then(Value::as_object)
        .is_some_and(|resources| !resources.is_empty())
    {
        values.push("resources".to_string());
    }
    if !read_ui_apps_from_config(config).is_empty() {
        values.push("ui-apps".to_string());
    }
    if kind == "instruction" {
        values.push("instructions".to_string());
    }
    if kind == "provider" {
        values.push("models".to_string());
    }
    sanitize_string_list(&values)
}

fn read_ui_apps_from_config(config: &Value) -> Vec<RuntimeExtensionUiAppPayload> {
    let Some(entries) = config
        .get("uiApps")
        .or_else(|| config.get("ui_apps"))
        .and_then(Value::as_array)
    else {
        return Vec::new();
    };
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
            let title = entry
                .get("title")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .unwrap_or(app_id.as_str())
                .to_string();
            let route = entry
                .get("route")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())?
                .to_string();
            Some(RuntimeExtensionUiAppPayload {
                app_id,
                title,
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
        .collect()
}

fn parse_tools_from_config(
    extension_id: &str,
    config: &Value,
) -> Vec<RuntimeExtensionToolSummaryPayload> {
    let parsed = config
        .get("tools")
        .and_then(Value::as_array)
        .map(|tools| {
            tools
                .iter()
                .filter_map(|tool| {
                    let object = tool.as_object()?;
                    let tool_name = object
                        .get("toolName")
                        .or_else(|| object.get("name"))
                        .and_then(Value::as_str)
                        .map(str::trim)
                        .filter(|value| !value.is_empty())?
                        .to_string();
                    let description = object
                        .get("description")
                        .and_then(Value::as_str)
                        .unwrap_or("Runtime extension tool")
                        .to_string();
                    let input_schema = object
                        .get("inputSchema")
                        .or_else(|| object.get("input_schema"))
                        .filter(|value| value.is_object())
                        .cloned();
                    let read_only = object
                        .get("readOnly")
                        .or_else(|| object.get("read_only"))
                        .and_then(Value::as_bool)
                        .unwrap_or(false);
                    Some(RuntimeExtensionToolSummaryPayload {
                        extension_id: extension_id.to_string(),
                        tool_name,
                        description,
                        input_schema,
                        read_only,
                    })
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    if parsed.is_empty() {
        return vec![RuntimeExtensionToolSummaryPayload {
            extension_id: extension_id.to_string(),
            tool_name: format!("{extension_id}.run"),
            description: "Default runtime extension tool".to_string(),
            input_schema: None,
            read_only: false,
        }];
    }

    parsed
}

fn parse_resource_from_config(
    extension_id: &str,
    resource_id: &str,
    config: &Value,
) -> RuntimeExtensionResourceReadResponsePayload {
    let resource_entry = config
        .get("resources")
        .and_then(Value::as_object)
        .and_then(|resources| resources.get(resource_id));

    match resource_entry {
        Some(Value::String(content)) => RuntimeExtensionResourceReadResponsePayload {
            extension_id: extension_id.to_string(),
            resource_id: resource_id.to_string(),
            content_type: "text/plain".to_string(),
            content: content.clone(),
            metadata: None,
        },
        Some(Value::Object(entry)) => {
            let content_type = entry
                .get("contentType")
                .or_else(|| entry.get("content_type"))
                .and_then(Value::as_str)
                .unwrap_or("text/plain")
                .to_string();
            let content = entry
                .get("content")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
                .or_else(|| serde_json::to_string(entry).ok())
                .unwrap_or_default();
            let metadata = entry
                .get("metadata")
                .filter(|value| value.is_object())
                .cloned();
            RuntimeExtensionResourceReadResponsePayload {
                extension_id: extension_id.to_string(),
                resource_id: resource_id.to_string(),
                content_type,
                content,
                metadata,
            }
        }
        _ => RuntimeExtensionResourceReadResponsePayload {
            extension_id: extension_id.to_string(),
            resource_id: resource_id.to_string(),
            content_type: "text/markdown".to_string(),
            content: format!(
                "# Resource not configured\n\n- extensionId: `{extension_id}`\n- resourceId: `{resource_id}`"
            ),
            metadata: Some(json!({
                "fallback": true,
            })),
        },
    }
}

impl RuntimeExtensionSpecRecord {
    fn to_payload(&self) -> RuntimeExtensionSpecPayload {
        RuntimeExtensionSpecPayload {
            extension_id: self.extension_id.clone(),
            version: self.version.clone(),
            display_name: self.display_name.clone(),
            publisher: self.publisher.clone(),
            summary: self.summary.clone(),
            kind: self.kind.clone(),
            distribution: self.distribution.clone(),
            name: self.display_name.clone(),
            transport: self.transport.clone(),
            lifecycle_state: self.lifecycle_state.clone(),
            enabled: self.enabled,
            workspace_id: self.workspace_id.clone(),
            capabilities: self.capabilities.clone(),
            permissions: self.permissions.clone(),
            ui_apps: self.ui_apps.clone(),
            provenance: self.provenance.clone(),
            config: self.config.clone(),
            installed_at: self.installed_at,
            updated_at: self.updated_at,
        }
    }
}

impl RuntimeExtensionStore {
    pub(crate) fn list(&self, workspace_id: Option<&str>) -> Vec<RuntimeExtensionSpecPayload> {
        let workspace_id = normalize_workspace_id(workspace_id);
        let mut extensions = self
            .entries
            .values()
            .filter(|entry| entry.workspace_id == workspace_id)
            .map(RuntimeExtensionSpecRecord::to_payload)
            .collect::<Vec<_>>();
        extensions.sort_by(|left, right| {
            right
                .updated_at
                .cmp(&left.updated_at)
                .then_with(|| left.extension_id.cmp(&right.extension_id))
        });
        extensions
    }

    pub(crate) fn list_visible(
        &self,
        workspace_id: Option<&str>,
    ) -> Vec<RuntimeExtensionSpecPayload> {
        let mut extensions = Vec::new();
        let mut seen = HashSet::new();

        if let Some(workspace_id) = normalize_workspace_id(workspace_id) {
            let mut workspace_entries = self
                .entries
                .values()
                .filter(|entry| entry.workspace_id.as_deref() == Some(workspace_id.as_str()))
                .map(RuntimeExtensionSpecRecord::to_payload)
                .collect::<Vec<_>>();
            workspace_entries.sort_by(|left, right| {
                right
                    .updated_at
                    .cmp(&left.updated_at)
                    .then_with(|| left.extension_id.cmp(&right.extension_id))
            });
            for entry in workspace_entries {
                seen.insert(entry.extension_id.clone());
                extensions.push(entry);
            }
        }

        let mut global_entries = self
            .entries
            .values()
            .filter(|entry| entry.workspace_id.is_none())
            .map(RuntimeExtensionSpecRecord::to_payload)
            .filter(|entry| seen.insert(entry.extension_id.clone()))
            .collect::<Vec<_>>();
        global_entries.sort_by(|left, right| {
            right
                .updated_at
                .cmp(&left.updated_at)
                .then_with(|| left.extension_id.cmp(&right.extension_id))
        });
        extensions.extend(global_entries);
        extensions
    }

    fn record_for_lookup(
        &self,
        workspace_id: Option<&str>,
        extension_id: &str,
    ) -> Option<&RuntimeExtensionSpecRecord> {
        let workspace_id = normalize_workspace_id(workspace_id);
        if let Some(workspace_id) = workspace_id.as_deref() {
            let workspace_key = extension_store_key(Some(workspace_id), extension_id);
            if let Some(entry) = self.entries.get(workspace_key.as_str()) {
                return Some(entry);
            }
        }
        let global_key = extension_store_key(None, extension_id);
        self.entries.get(global_key.as_str())
    }

    #[cfg(test)]
    pub(crate) fn get(
        &self,
        workspace_id: Option<&str>,
        extension_id: &str,
    ) -> Option<RuntimeExtensionSpecPayload> {
        self.record_for_lookup(workspace_id, extension_id)
            .map(RuntimeExtensionSpecRecord::to_payload)
    }

    pub(crate) fn upsert_record(
        &mut self,
        input: RuntimeExtensionRecordInput,
    ) -> RuntimeExtensionSpecPayload {
        let workspace_id = normalize_workspace_id(input.workspace_id.as_deref());
        let key = extension_store_key(workspace_id.as_deref(), input.extension_id.as_str());
        let now = now_ms();
        let normalized_config = normalize_extension_config(input.config);
        let entry = self
            .entries
            .entry(key)
            .or_insert_with(|| RuntimeExtensionSpecRecord {
                extension_id: input.extension_id.clone(),
                version: "0.1.0".to_string(),
                display_name: input
                    .display_name
                    .clone()
                    .unwrap_or_else(|| input.extension_id.clone()),
                publisher: input
                    .publisher
                    .clone()
                    .unwrap_or_else(|| "HugeCode".to_string()),
                summary: input
                    .summary
                    .clone()
                    .unwrap_or_else(|| "Runtime extension".to_string()),
                kind: input.kind.clone().unwrap_or_else(|| {
                    infer_extension_kind(input.transport.as_str(), &normalized_config)
                }),
                distribution: input.distribution.clone().unwrap_or_else(|| {
                    infer_extension_distribution(workspace_id.as_deref(), &normalized_config)
                }),
                transport: input.transport.clone(),
                lifecycle_state: input
                    .lifecycle_state
                    .clone()
                    .unwrap_or_else(|| infer_lifecycle_state(input.enabled, &normalized_config)),
                enabled: input.enabled,
                workspace_id: workspace_id.clone(),
                capabilities: if input.capabilities.is_empty() {
                    infer_capabilities(input.extension_id.as_str(), "bundle", &normalized_config)
                } else {
                    sanitize_string_list(&input.capabilities)
                },
                permissions: if input.permissions.is_empty() {
                    read_string_list_from_value(normalized_config.get("permissions"))
                } else {
                    sanitize_string_list(&input.permissions)
                },
                ui_apps: if input.ui_apps.is_empty() {
                    read_ui_apps_from_config(&normalized_config)
                } else {
                    input.ui_apps.clone()
                },
                provenance: input
                    .provenance
                    .clone()
                    .filter(Value::is_object)
                    .unwrap_or_else(|| json!({})),
                config: normalized_config.clone(),
                installed_at: now,
                updated_at: now,
            });

        entry.extension_id = input.extension_id;
        entry.version = input
            .version
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| entry.version.clone());
        entry.display_name = input
            .display_name
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| entry.display_name.clone());
        entry.publisher = input
            .publisher
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| entry.publisher.clone());
        entry.summary = input
            .summary
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| entry.summary.clone());
        entry.kind = input
            .kind
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| infer_extension_kind(input.transport.as_str(), &normalized_config));
        entry.distribution = input
            .distribution
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| {
                infer_extension_distribution(workspace_id.as_deref(), &normalized_config)
            });
        entry.transport = input.transport;
        entry.lifecycle_state = input
            .lifecycle_state
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| infer_lifecycle_state(input.enabled, &normalized_config));
        entry.enabled = input.enabled;
        entry.workspace_id = workspace_id;
        entry.capabilities = if input.capabilities.is_empty() {
            infer_capabilities(
                entry.extension_id.as_str(),
                entry.kind.as_str(),
                &normalized_config,
            )
        } else {
            sanitize_string_list(&input.capabilities)
        };
        entry.permissions = if input.permissions.is_empty() {
            read_string_list_from_value(normalized_config.get("permissions"))
        } else {
            sanitize_string_list(&input.permissions)
        };
        entry.ui_apps = if input.ui_apps.is_empty() {
            read_ui_apps_from_config(&normalized_config)
        } else {
            input.ui_apps
        };
        entry.provenance = input
            .provenance
            .filter(Value::is_object)
            .unwrap_or_else(|| entry.provenance.clone());
        entry.config = normalized_config;
        entry.updated_at = now;
        entry.to_payload()
    }

    pub(crate) fn set_enabled(
        &mut self,
        workspace_id: Option<&str>,
        extension_id: &str,
        enabled: bool,
    ) -> Option<RuntimeExtensionSpecPayload> {
        let workspace_id = normalize_workspace_id(workspace_id);
        let mut key = extension_store_key(workspace_id.as_deref(), extension_id);
        if !self.entries.contains_key(key.as_str()) && workspace_id.is_some() {
            key = extension_store_key(None, extension_id);
        }
        let entry = self.entries.get_mut(key.as_str())?;
        entry.enabled = enabled;
        entry.lifecycle_state = if enabled {
            "enabled".to_string()
        } else {
            "installed".to_string()
        };
        entry.updated_at = now_ms();
        Some(entry.to_payload())
    }

    pub(crate) fn remove(&mut self, workspace_id: Option<&str>, extension_id: &str) -> bool {
        let workspace_id = normalize_workspace_id(workspace_id);
        let key = extension_store_key(workspace_id.as_deref(), extension_id);
        if self.entries.remove(&key).is_some() {
            return true;
        }
        if workspace_id.is_some() {
            let global_key = extension_store_key(None, extension_id);
            return self.entries.remove(&global_key).is_some();
        }
        false
    }

    pub(crate) fn tools(
        &self,
        workspace_id: Option<&str>,
        extension_id: &str,
    ) -> Option<Vec<RuntimeExtensionToolSummaryPayload>> {
        self.record_for_lookup(workspace_id, extension_id)
            .map(|entry| parse_tools_from_config(extension_id, &entry.config))
    }

    pub(crate) fn read_resource(
        &self,
        workspace_id: Option<&str>,
        extension_id: &str,
        resource_id: &str,
    ) -> Option<RuntimeExtensionResourceReadResponsePayload> {
        self.record_for_lookup(workspace_id, extension_id)
            .map(|entry| parse_resource_from_config(extension_id, resource_id, &entry.config))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn record_input(
        extension_id: &str,
        workspace_id: Option<&str>,
        display_name: &str,
    ) -> RuntimeExtensionRecordInput {
        RuntimeExtensionRecordInput {
            extension_id: extension_id.to_string(),
            version: Some("1.0.0".to_string()),
            display_name: Some(display_name.to_string()),
            publisher: Some("HugeCode".to_string()),
            summary: Some("Runtime extension".to_string()),
            kind: Some("host".to_string()),
            distribution: Some("workspace".to_string()),
            transport: "host-native".to_string(),
            lifecycle_state: Some("enabled".to_string()),
            enabled: true,
            workspace_id: workspace_id.map(ToString::to_string),
            capabilities: vec!["tools".to_string()],
            permissions: Vec::new(),
            ui_apps: Vec::new(),
            provenance: Some(json!({})),
            config: Some(json!({})),
        }
    }

    #[test]
    fn list_visible_prefers_workspace_entries_and_includes_global_fallbacks() {
        let mut store = RuntimeExtensionStore::default();
        store.upsert_record(record_input("plugin-a", None, "Global Plugin A"));
        store.upsert_record(record_input("plugin-b", None, "Global Plugin B"));
        store.upsert_record(record_input("plugin-a", Some("ws-1"), "Workspace Plugin A"));

        let visible = store.list_visible(Some("ws-1"));
        assert_eq!(visible.len(), 2);
        assert_eq!(visible[0].extension_id, "plugin-a");
        assert_eq!(visible[0].display_name, "Workspace Plugin A");
        assert_eq!(visible[1].extension_id, "plugin-b");
        assert_eq!(visible[1].display_name, "Global Plugin B");

        let resolved = store
            .get(Some("ws-1"), "plugin-b")
            .expect("global fallback should resolve");
        assert_eq!(resolved.display_name, "Global Plugin B");
    }

    #[test]
    fn set_enabled_and_remove_fall_back_to_global_scope() {
        let mut store = RuntimeExtensionStore::default();
        store.upsert_record(record_input("plugin-a", None, "Global Plugin A"));

        let updated = store
            .set_enabled(Some("ws-1"), "plugin-a", false)
            .expect("global record should be updated from workspace lookup");
        assert!(!updated.enabled);
        assert_eq!(updated.lifecycle_state, "installed");

        assert!(store.remove(Some("ws-1"), "plugin-a"));
        assert!(store.get(None, "plugin-a").is_none());
    }
}
