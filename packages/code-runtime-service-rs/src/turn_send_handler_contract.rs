use super::*;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum TurnExecutionMode {
    Runtime,
    LocalCli,
    Hybrid,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum RequestedCollaborationMode {
    Standard,
    Chat,
    Plan,
}

const TURN_SEND_ALLOWED_FIELDS: &[&str] = &[
    "workspaceId",
    "threadId",
    "requestId",
    "content",
    "contextPrefix",
    "provider",
    "modelId",
    "reasonEffort",
    "serviceTier",
    "missionMode",
    "executionProfileId",
    "preferredBackendIds",
    "accessMode",
    "executionMode",
    "codexBin",
    "codexArgs",
    "queue",
    "attachments",
    "collaborationMode",
    "autoDrive",
    "autonomyRequest",
];

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[allow(dead_code)]
struct TurnSendAttachmentRequest {
    id: String,
    name: String,
    mime_type: String,
    size: u64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct TurnSendCollaborationModeSettingsRequest {
    id: Option<String>,
    #[serde(rename = "developerInstructions")]
    _developer_instructions: Option<String>,
    #[serde(rename = "model")]
    _model: Option<String>,
    #[serde(rename = "reasoningEffort")]
    _reasoning_effort: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct TurnSendCollaborationModeObjectRequest {
    mode: Option<String>,
    settings: Option<TurnSendCollaborationModeSettingsRequest>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(untagged)]
pub(super) enum TurnSendCollaborationModeRequest {
    String(String),
    Object(TurnSendCollaborationModeObjectRequest),
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[allow(dead_code)]
pub(super) struct TurnSendPayloadRequest {
    pub(super) workspace_id: String,
    pub(super) thread_id: Option<String>,
    pub(super) request_id: Option<String>,
    pub(super) content: String,
    pub(super) context_prefix: Option<String>,
    pub(super) provider: Option<String>,
    pub(super) model_id: Option<String>,
    pub(super) reason_effort: Option<String>,
    pub(super) service_tier: Option<String>,
    #[serde(default)]
    mission_mode: Option<String>,
    pub(super) execution_profile_id: Option<String>,
    pub(super) preferred_backend_ids: Option<Vec<String>>,
    pub(super) access_mode: String,
    pub(super) execution_mode: String,
    pub(super) codex_bin: Option<String>,
    pub(super) codex_args: Option<Vec<String>>,
    queue: bool,
    attachments: Vec<TurnSendAttachmentRequest>,
    pub(super) collaboration_mode: Option<TurnSendCollaborationModeRequest>,
    auto_drive: Option<AgentTaskAutoDriveState>,
    autonomy_request: Option<Value>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct TurnSendRequestEnvelope {
    pub(super) payload: TurnSendPayloadRequest,
}

fn reject_legacy_turn_send_nested_aliases(
    payload: &serde_json::Map<String, Value>,
) -> Result<(), RpcError> {
    let mut legacy_alias_fields = Vec::new();
    if payload.contains_key("collaboration_mode") {
        legacy_alias_fields.push("collaboration_mode".to_string());
    }
    if let Some(Value::Object(mode)) = payload.get("collaborationMode") {
        if mode.contains_key("modeId") {
            legacy_alias_fields.push("collaborationMode.modeId".to_string());
        }
        if mode.contains_key("mode_id") {
            legacy_alias_fields.push("collaborationMode.mode_id".to_string());
        }
    }
    if legacy_alias_fields.is_empty() {
        return Ok(());
    }
    Err(RpcError::invalid_params(format!(
        "turnSend payload no longer accepts legacy alias fields: {}.",
        legacy_alias_fields.join(", ")
    )))
}

pub(super) fn validate_turn_send_payload_shape(
    payload: &serde_json::Map<String, Value>,
) -> Result<(), RpcError> {
    crate::agent_policy::reject_legacy_alias_fields(
        &Value::Object(payload.clone()),
        "turnSend payload",
    )?;
    reject_legacy_turn_send_nested_aliases(payload)?;
    crate::agent_policy::reject_unknown_object_fields(
        payload,
        TURN_SEND_ALLOWED_FIELDS,
        "turnSend payload",
    )
}

pub(super) fn parse_requested_collaboration_mode(
    collaboration_mode: Option<&TurnSendCollaborationModeRequest>,
) -> RequestedCollaborationMode {
    let normalized = collaboration_mode
        .and_then(|mode| match mode {
            TurnSendCollaborationModeRequest::String(value) => Some(value.as_str()),
            TurnSendCollaborationModeRequest::Object(mode) => mode.mode.as_deref().or_else(|| {
                mode.settings
                    .as_ref()
                    .and_then(|settings| settings.id.as_deref())
            }),
        })
        .map(str::trim)
        .map(str::to_ascii_lowercase)
        .unwrap_or_default();
    if normalized == "plan" {
        RequestedCollaborationMode::Plan
    } else if matches!(normalized.as_str(), "default" | "code" | "chat") {
        RequestedCollaborationMode::Chat
    } else {
        RequestedCollaborationMode::Standard
    }
}

impl RequestedCollaborationMode {
    pub(super) fn suppress_runtime_plan_delta(self) -> bool {
        matches!(self, Self::Chat)
    }
}

impl TurnExecutionMode {
    pub(super) fn as_str(self) -> &'static str {
        match self {
            Self::Runtime => "runtime",
            Self::LocalCli => "local-cli",
            Self::Hybrid => "hybrid",
        }
    }

    pub(super) fn local_exec_preferred(self) -> bool {
        matches!(self, Self::LocalCli)
    }
}

pub(super) fn parse_turn_execution_mode(
    raw_value: Option<&str>,
) -> Result<TurnExecutionMode, RpcError> {
    let Some(raw_value) = raw_value else {
        return Ok(TurnExecutionMode::Runtime);
    };
    let normalized = raw_value.trim().to_ascii_lowercase().replace('_', "-");
    match normalized.as_str() {
        "runtime" => Ok(TurnExecutionMode::Runtime),
        "local-cli" => Ok(TurnExecutionMode::LocalCli),
        "hybrid" => Ok(TurnExecutionMode::Hybrid),
        _ => Err(RpcError::invalid_params(format!(
            "Unsupported execution mode `{raw_value}`. Expected one of: runtime, local-cli, hybrid."
        ))),
    }
}

pub(super) fn parse_turn_send_request(params: &Value) -> Result<TurnSendRequestEnvelope, RpcError> {
    let params_object = as_object(params)?;
    let payload = params_object
        .get("payload")
        .and_then(Value::as_object)
        .ok_or_else(|| RpcError::invalid_params("Missing turn payload."))?;
    validate_turn_send_payload_shape(payload)?;

    let mut parsed: TurnSendRequestEnvelope = serde_json::from_value(params.clone())
        .map_err(|error| RpcError::invalid_params(format!("Invalid turn payload: {error}")))?;
    parsed.payload.workspace_id = parsed.payload.workspace_id.trim().to_string();
    if parsed.payload.workspace_id.is_empty() {
        return Err(RpcError::invalid_params("workspaceId is required."));
    }
    parsed.payload.content = parsed.payload.content.trim().to_string();
    if parsed.payload.content.is_empty() {
        return Err(RpcError::invalid_params("content is required."));
    }
    parsed.payload.thread_id = trim_optional_string(parsed.payload.thread_id);
    parsed.payload.request_id = trim_optional_string(parsed.payload.request_id);
    parsed.payload.context_prefix = trim_optional_string(parsed.payload.context_prefix);
    parsed.payload.provider = trim_optional_string(parsed.payload.provider);
    parsed.payload.model_id = trim_optional_string(parsed.payload.model_id);
    parsed.payload.reason_effort = trim_optional_string(parsed.payload.reason_effort);
    parsed.payload.service_tier = trim_optional_string(parsed.payload.service_tier);
    parsed.payload.execution_profile_id = trim_optional_string(parsed.payload.execution_profile_id);
    parsed.payload.codex_bin = trim_optional_string(parsed.payload.codex_bin);
    parsed.payload.codex_args = parsed.payload.codex_args.map(|values| {
        values
            .into_iter()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .collect::<Vec<_>>()
    });
    parsed.payload.preferred_backend_ids = parsed.payload.preferred_backend_ids.map(|values| {
        values
            .into_iter()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .collect::<Vec<_>>()
    });
    parsed.payload.attachments = parsed
        .payload
        .attachments
        .into_iter()
        .filter_map(|mut attachment| {
            attachment.id = attachment.id.trim().to_string();
            attachment.name = attachment.name.trim().to_string();
            attachment.mime_type = attachment.mime_type.trim().to_string();
            if attachment.id.is_empty()
                || attachment.name.is_empty()
                || attachment.mime_type.is_empty()
            {
                return None;
            }
            Some(attachment)
        })
        .collect::<Vec<_>>();
    Ok(parsed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, Value};

    fn parse_collaboration_mode(value: Value) -> Option<TurnSendCollaborationModeRequest> {
        serde_json::from_value(value).ok()
    }

    #[test]
    fn parse_turn_execution_mode_defaults_to_runtime() {
        let parsed = parse_turn_execution_mode(None).expect("default execution mode");
        assert_eq!(parsed, TurnExecutionMode::Runtime);
    }

    #[test]
    fn parse_turn_execution_mode_accepts_canonical_values() {
        let parsed = parse_turn_execution_mode(Some("local-cli")).expect("local cli mode");
        assert_eq!(parsed, TurnExecutionMode::LocalCli);

        let parsed = parse_turn_execution_mode(Some("hybrid")).expect("hybrid mode");
        assert_eq!(parsed, TurnExecutionMode::Hybrid);
    }

    #[test]
    fn parse_turn_execution_mode_rejects_unknown_value() {
        let error = parse_turn_execution_mode(Some("distributed"))
            .expect_err("unsupported execution mode must fail");
        assert_eq!(error.code.as_str(), "INVALID_PARAMS");
        assert!(error.message.contains("Unsupported execution mode"));
    }

    #[test]
    fn parse_turn_execution_mode_rejects_legacy_local_aliases() {
        for legacy_value in ["local", "localcli"] {
            let error = parse_turn_execution_mode(Some(legacy_value))
                .expect_err("legacy local alias should fail");
            assert_eq!(error.code.as_str(), "INVALID_PARAMS");
            assert!(error.message.contains("Unsupported execution mode"));
        }
    }

    #[test]
    fn execution_mode_string_values_are_stable() {
        let pairs = [
            (TurnExecutionMode::Runtime, "runtime"),
            (TurnExecutionMode::LocalCli, "local-cli"),
            (TurnExecutionMode::Hybrid, "hybrid"),
        ];
        for (mode, expected) in pairs {
            assert_eq!(mode.as_str(), expected);
        }
    }

    #[test]
    fn parse_requested_collaboration_mode_prefers_plan_mode() {
        let payload = json!({
            "collaborationMode": {
                "mode": "plan",
                "settings": {
                    "id": "plan"
                }
            }
        });
        assert_eq!(
            parse_requested_collaboration_mode(
                parse_collaboration_mode(payload["collaborationMode"].clone()).as_ref()
            ),
            RequestedCollaborationMode::Plan
        );
    }

    #[test]
    fn parse_requested_collaboration_mode_detects_explicit_chat_mode() {
        let payload = json!({
            "collaborationMode": {
                "mode": "default",
                "settings": {
                    "id": "default"
                }
            }
        });
        assert_eq!(
            parse_requested_collaboration_mode(
                parse_collaboration_mode(payload["collaborationMode"].clone()).as_ref()
            ),
            RequestedCollaborationMode::Chat
        );
    }

    #[test]
    fn parse_requested_collaboration_mode_accepts_string_aliases() {
        let payload = json!({
            "collaborationMode": "chat"
        });
        assert_eq!(
            parse_requested_collaboration_mode(
                parse_collaboration_mode(payload["collaborationMode"].clone()).as_ref()
            ),
            RequestedCollaborationMode::Chat
        );
    }

    #[test]
    fn parse_requested_collaboration_mode_defaults_to_standard_when_missing() {
        assert_eq!(
            parse_requested_collaboration_mode(None),
            RequestedCollaborationMode::Standard
        );
    }

    #[test]
    fn parse_turn_send_request_accepts_canonical_hot_path_payload() {
        let parsed = parse_turn_send_request(&json!({
            "payload": {
                "workspaceId": "ws-1",
                "threadId": null,
                "requestId": "req-1",
                "content": "Inspect the runtime boundary",
                "contextPrefix": "context",
                "provider": "openai",
                "modelId": "gpt-5.4",
                "reasonEffort": "high",
                "serviceTier": "default",
                "preferredBackendIds": ["backend-a"],
                "accessMode": "on-request",
                "executionMode": "runtime",
                "queue": false,
                "attachments": []
            }
        }))
        .expect("canonical payload should parse");

        assert_eq!(parsed.payload.workspace_id, "ws-1");
        assert_eq!(parsed.payload.request_id.as_deref(), Some("req-1"));
        assert_eq!(
            parsed.payload.preferred_backend_ids.as_deref(),
            Some(vec!["backend-a".to_string()].as_slice())
        );
    }

    #[test]
    fn parse_turn_send_request_rejects_snake_case_hot_path_payload() {
        let error = parse_turn_send_request(&json!({
            "payload": {
                "workspace_id": "ws-1",
                "thread_id": null,
                "request_id": "req-1",
                "content": "Inspect the runtime boundary",
                "preferred_backend_ids": ["backend-a"],
                "access_mode": "on-request",
                "execution_mode": "runtime",
                "queue": false,
                "attachments": []
            }
        }))
        .expect_err("snake_case payload should fail");

        assert_eq!(error.code.as_str(), "INVALID_PARAMS");
        assert!(
            error.message.contains("legacy alias fields"),
            "unexpected message: {}",
            error.message
        );
    }

    #[test]
    fn validate_turn_send_payload_shape_rejects_legacy_alias_fields() {
        let payload = serde_json::Map::from_iter([
            ("workspaceId".to_string(), json!("ws-1")),
            ("threadId".to_string(), Value::Null),
            (
                "content".to_string(),
                json!("Inspect runtime contract drift."),
            ),
            ("request_id".to_string(), json!("req-legacy-1")),
        ]);

        let error =
            validate_turn_send_payload_shape(&payload).expect_err("legacy alias should fail");
        assert_eq!(error.code.as_str(), "INVALID_PARAMS");
        assert!(
            error.message.contains("legacy alias fields"),
            "unexpected message: {}",
            error.message
        );
    }

    #[test]
    fn validate_turn_send_payload_shape_rejects_legacy_collaboration_mode_aliases() {
        let payload = serde_json::Map::from_iter([
            ("workspaceId".to_string(), json!("ws-1")),
            ("threadId".to_string(), Value::Null),
            (
                "content".to_string(),
                json!("Inspect runtime contract drift."),
            ),
            ("collaboration_mode".to_string(), json!("plan")),
        ]);
        let error = validate_turn_send_payload_shape(&payload)
            .expect_err("legacy top-level alias should fail");
        assert_eq!(error.code.as_str(), "INVALID_PARAMS");
        assert!(error.message.contains("legacy alias"));

        let payload = serde_json::Map::from_iter([
            ("workspaceId".to_string(), json!("ws-1")),
            ("threadId".to_string(), Value::Null),
            (
                "content".to_string(),
                json!("Inspect runtime contract drift."),
            ),
            (
                "collaborationMode".to_string(),
                json!({
                    "mode_id": "plan",
                    "settings": { "id": "plan" }
                }),
            ),
        ]);
        let error = validate_turn_send_payload_shape(&payload)
            .expect_err("legacy nested alias should fail");
        assert_eq!(error.code.as_str(), "INVALID_PARAMS");
        assert!(error.message.contains("legacy alias"));
    }

    #[test]
    fn validate_turn_send_payload_shape_rejects_unknown_fields() {
        let payload = serde_json::Map::from_iter([
            ("workspaceId".to_string(), json!("ws-1")),
            ("threadId".to_string(), Value::Null),
            (
                "content".to_string(),
                json!("Inspect runtime contract drift."),
            ),
            ("unexpectedFlag".to_string(), json!(true)),
        ]);

        let error =
            validate_turn_send_payload_shape(&payload).expect_err("unknown field should fail");
        assert_eq!(error.code.as_str(), "INVALID_PARAMS");
        assert!(
            error.message.contains("unsupported fields"),
            "unexpected message: {}",
            error.message
        );
    }
}
