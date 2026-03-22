use super::*;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeExtensionSpecPayload {
    pub(crate) extension_id: String,
    pub(crate) name: String,
    pub(crate) transport: String,
    pub(crate) enabled: bool,
    pub(crate) workspace_id: Option<String>,
    pub(crate) config: Value,
    pub(crate) installed_at: u64,
    pub(crate) updated_at: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeExtensionToolSummaryPayload {
    extension_id: String,
    tool_name: String,
    description: String,
    input_schema: Option<Value>,
    read_only: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeExtensionResourceReadResponsePayload {
    extension_id: String,
    resource_id: String,
    content_type: String,
    content: String,
    metadata: Option<Value>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeExtensionsConfigResponsePayload {
    pub(crate) extensions: Vec<RuntimeExtensionSpecPayload>,
    pub(crate) warnings: Vec<String>,
}

#[derive(Clone, Debug)]
struct RuntimeExtensionSpecRecord {
    extension_id: String,
    name: String,
    transport: String,
    enabled: bool,
    workspace_id: Option<String>,
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
            name: self.name.clone(),
            transport: self.transport.clone(),
            enabled: self.enabled,
            workspace_id: self.workspace_id.clone(),
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

    pub(crate) fn upsert(
        &mut self,
        workspace_id: Option<&str>,
        extension_id: &str,
        name: &str,
        transport: &str,
        enabled: bool,
        config: Option<Value>,
    ) -> RuntimeExtensionSpecPayload {
        let workspace_id = normalize_workspace_id(workspace_id);
        let key = extension_store_key(workspace_id.as_deref(), extension_id);
        let now = now_ms();
        let entry = self
            .entries
            .entry(key)
            .or_insert_with(|| RuntimeExtensionSpecRecord {
                extension_id: extension_id.to_string(),
                name: name.to_string(),
                transport: transport.to_string(),
                enabled,
                workspace_id: workspace_id.clone(),
                config: Value::Object(serde_json::Map::new()),
                installed_at: now,
                updated_at: now,
            });
        entry.name = name.to_string();
        entry.transport = transport.to_string();
        entry.enabled = enabled;
        entry.workspace_id = workspace_id;
        entry.config = normalize_extension_config(config);
        entry.updated_at = now;
        entry.to_payload()
    }

    pub(crate) fn remove(&mut self, workspace_id: Option<&str>, extension_id: &str) -> bool {
        let workspace_id = normalize_workspace_id(workspace_id);
        let key = extension_store_key(workspace_id.as_deref(), extension_id);
        self.entries.remove(&key).is_some()
    }

    pub(crate) fn tools(
        &self,
        workspace_id: Option<&str>,
        extension_id: &str,
    ) -> Option<Vec<RuntimeExtensionToolSummaryPayload>> {
        let workspace_id = normalize_workspace_id(workspace_id);
        let key = extension_store_key(workspace_id.as_deref(), extension_id);
        self.entries
            .get(key.as_str())
            .map(|entry| parse_tools_from_config(extension_id, &entry.config))
    }

    pub(crate) fn read_resource(
        &self,
        workspace_id: Option<&str>,
        extension_id: &str,
        resource_id: &str,
    ) -> Option<RuntimeExtensionResourceReadResponsePayload> {
        let workspace_id = normalize_workspace_id(workspace_id);
        let key = extension_store_key(workspace_id.as_deref(), extension_id);
        self.entries
            .get(key.as_str())
            .map(|entry| parse_resource_from_config(extension_id, resource_id, &entry.config))
    }
}
