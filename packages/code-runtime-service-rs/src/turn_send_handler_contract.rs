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
    payload: &serde_json::Map<String, Value>,
) -> RequestedCollaborationMode {
    let collaboration_mode = payload.get("collaborationMode");
    let normalized = collaboration_mode
        .and_then(|mode| match mode {
            Value::String(value) => Some(value.as_str()),
            Value::Object(mode) => mode.get("mode").and_then(Value::as_str).or_else(|| {
                mode.get("settings")
                    .and_then(Value::as_object)
                    .and_then(|settings| settings.get("id"))
                    .and_then(Value::as_str)
            }),
            _ => None,
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
    payload: &serde_json::Map<String, Value>,
) -> Result<TurnExecutionMode, RpcError> {
    let raw_value = read_optional_string(payload, "executionMode");
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

#[cfg(test)]
mod tests {
    use super::{
        parse_requested_collaboration_mode, parse_turn_execution_mode,
        validate_turn_send_payload_shape, RequestedCollaborationMode, TurnExecutionMode,
    };
    use serde_json::{json, Value};

    #[test]
    fn parse_turn_execution_mode_defaults_to_runtime() {
        let payload = serde_json::Map::new();
        let parsed = parse_turn_execution_mode(&payload).expect("default execution mode");
        assert_eq!(parsed, TurnExecutionMode::Runtime);
    }

    #[test]
    fn parse_turn_execution_mode_accepts_canonical_values() {
        let payload = json!({"executionMode": "local-cli"});
        let parsed = parse_turn_execution_mode(payload.as_object().expect("payload object"))
            .expect("local cli mode");
        assert_eq!(parsed, TurnExecutionMode::LocalCli);

        let payload = json!({"executionMode": "hybrid"});
        let parsed = parse_turn_execution_mode(payload.as_object().expect("payload object"))
            .expect("hybrid mode");
        assert_eq!(parsed, TurnExecutionMode::Hybrid);
    }

    #[test]
    fn parse_turn_execution_mode_rejects_unknown_value() {
        let payload = json!({"executionMode": "distributed"});
        let error = parse_turn_execution_mode(payload.as_object().expect("payload object"))
            .expect_err("unsupported execution mode must fail");
        assert_eq!(error.code.as_str(), "INVALID_PARAMS");
        assert!(error.message.contains("Unsupported execution mode"));
    }

    #[test]
    fn parse_turn_execution_mode_rejects_legacy_local_aliases() {
        for legacy_value in ["local", "localcli"] {
            let payload = json!({ "executionMode": legacy_value });
            let error = parse_turn_execution_mode(payload.as_object().expect("payload object"))
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
    fn parse_turn_execution_mode_ignores_non_string_values() {
        let payload =
            serde_json::Map::from_iter([("executionMode".to_string(), Value::Bool(true))]);
        let parsed = parse_turn_execution_mode(&payload).expect("non-string falls back to default");
        assert_eq!(parsed, TurnExecutionMode::Runtime);
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
        let payload = payload.as_object().expect("payload object");
        assert_eq!(
            parse_requested_collaboration_mode(payload),
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
        let payload = payload.as_object().expect("payload object");
        assert_eq!(
            parse_requested_collaboration_mode(payload),
            RequestedCollaborationMode::Chat
        );
    }

    #[test]
    fn parse_requested_collaboration_mode_accepts_string_aliases() {
        let payload = json!({
            "collaborationMode": "chat"
        });
        let payload = payload.as_object().expect("payload object");
        assert_eq!(
            parse_requested_collaboration_mode(payload),
            RequestedCollaborationMode::Chat
        );
    }

    #[test]
    fn parse_requested_collaboration_mode_defaults_to_standard_when_missing() {
        let payload = serde_json::Map::new();
        assert_eq!(
            parse_requested_collaboration_mode(&payload),
            RequestedCollaborationMode::Standard
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
