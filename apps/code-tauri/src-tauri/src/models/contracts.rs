use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSummary {
    pub id: String,
    pub path: String,
    pub display_name: String,
    pub connected: bool,
    pub default_model_id: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThreadSummary {
    pub id: String,
    pub workspace_id: String,
    pub title: String,
    pub unread: bool,
    pub running: bool,
    pub created_at: u64,
    pub updated_at: u64,
    pub provider: String,
    pub model_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    pub archived: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_activity_at: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_role: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_nickname: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThreadLiveSubscribeRequest {
    #[serde(alias = "workspace_id")]
    pub workspace_id: String,
    #[serde(alias = "thread_id")]
    pub thread_id: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThreadLiveSubscribeResult {
    pub subscription_id: String,
    pub heartbeat_interval_ms: u64,
    pub transport_mode: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThreadLiveUnsubscribeRequest {
    #[serde(alias = "subscription_id")]
    pub subscription_id: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThreadLiveUnsubscribeResult {
    pub ok: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelPoolEntry {
    pub id: String,
    pub display_name: String,
    pub provider: String,
    pub pool: String,
    pub source: String,
    pub available: bool,
    pub supports_reasoning: bool,
    pub supports_vision: bool,
    pub reasoning_efforts: Vec<String>,
    pub capabilities: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeProviderCatalogEntry {
    pub provider_id: String,
    pub display_name: String,
    pub pool: Option<String>,
    pub oauth_provider_id: Option<String>,
    pub aliases: Vec<String>,
    pub default_model_id: Option<String>,
    pub available: bool,
    pub supports_native: bool,
    pub supports_openai_compat: bool,
    pub registry_version: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteStatus {
    pub connected: bool,
    pub mode: String,
    pub endpoint: Option<String>,
    pub latency_ms: Option<u64>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsSummary {
    pub default_model_strategy: String,
    pub remote_enabled: bool,
    pub default_reason_effort: String,
    pub default_access_mode: String,
    pub max_active_turn_lanes: u32,
    pub active_turn_lanes: u32,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum TerminalStatusState {
    Ready,
    Uninitialized,
    Unsupported,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalStatus {
    pub state: TerminalStatusState,
    pub message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum TerminalSessionState {
    Created,
    Exited,
    IoFailed,
    Unsupported,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSessionSummary {
    pub id: String,
    pub workspace_id: String,
    pub state: TerminalSessionState,
    pub created_at: u64,
    pub updated_at: u64,
    pub lines: Vec<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TurnSendAttachment {
    pub id: String,
    pub name: String,
    #[serde(alias = "mime_type")]
    pub mime_type: String,
    pub size: u64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TurnSendRequest {
    #[serde(alias = "workspace_id")]
    pub workspace_id: String,
    #[serde(alias = "thread_id")]
    pub thread_id: Option<String>,
    #[serde(alias = "request_id")]
    pub request_id: Option<String>,
    pub content: String,
    #[serde(alias = "context_prefix")]
    pub context_prefix: Option<String>,
    pub provider: Option<String>,
    #[serde(alias = "model_id")]
    pub model_id: Option<String>,
    #[serde(alias = "reason_effort")]
    pub reason_effort: Option<String>,
    #[serde(alias = "service_tier")]
    pub service_tier: Option<String>,
    #[serde(alias = "mission_mode")]
    pub mission_mode: Option<String>,
    #[serde(alias = "execution_profile_id")]
    pub execution_profile_id: Option<String>,
    #[serde(alias = "preferred_backend_ids")]
    pub preferred_backend_ids: Option<Vec<String>>,
    #[serde(alias = "execution_mode")]
    pub execution_mode: Option<String>,
    #[serde(alias = "codex_bin")]
    pub codex_bin: Option<String>,
    #[serde(alias = "codex_args")]
    pub codex_args: Option<Vec<String>>,
    #[serde(alias = "access_mode")]
    pub access_mode: String,
    pub queue: bool,
    pub attachments: Vec<TurnSendAttachment>,
    #[serde(alias = "collaboration_mode")]
    pub collaboration_mode: Option<serde_json::Value>,
    #[serde(alias = "auto_drive")]
    pub auto_drive: Option<serde_json::Value>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TurnInterruptRequest {
    #[serde(alias = "turn_id")]
    pub turn_id: Option<String>,
    pub reason: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TurnAck {
    pub accepted: bool,
    pub turn_id: Option<String>,
    pub thread_id: Option<String>,
    pub routed_provider: Option<String>,
    pub routed_model_id: Option<String>,
    pub routed_pool: Option<String>,
    pub routed_source: Option<String>,
    pub message: String,
}

#[cfg(test)]
mod tests {
    use super::{
        ThreadLiveSubscribeRequest, ThreadLiveUnsubscribeRequest, TurnInterruptRequest,
        TurnSendRequest,
    };
    use serde_json::json;

    #[test]
    fn turn_send_request_accepts_snake_case_payload() {
        let payload = json!({
            "workspace_id": "workspace-tauri",
            "thread_id": "thread-1",
            "request_id": "req-1",
            "content": "Ping",
            "context_prefix": "ctx",
            "provider": "openai",
            "model_id": "gpt-5.3-codex",
            "reason_effort": "high",
            "mission_mode": "delegate",
            "execution_profile_id": "balanced-delegate",
            "preferred_backend_ids": ["backend-a", "backend-b"],
            "execution_mode": "foreground",
            "codex_bin": "/opt/codex",
            "codex_args": ["--profile", "desktop"],
            "access_mode": "on-request",
            "queue": false,
            "attachments": [],
            "auto_drive": {
                "enabled": true
            }
        });

        let request: TurnSendRequest = serde_json::from_value(payload).expect("parse turn payload");
        assert_eq!(request.workspace_id, "workspace-tauri");
        assert_eq!(request.thread_id.as_deref(), Some("thread-1"));
        assert_eq!(request.request_id.as_deref(), Some("req-1"));
        assert_eq!(request.context_prefix.as_deref(), Some("ctx"));
        assert_eq!(request.provider.as_deref(), Some("openai"));
        assert_eq!(request.model_id.as_deref(), Some("gpt-5.3-codex"));
        assert_eq!(request.reason_effort.as_deref(), Some("high"));
        assert_eq!(request.mission_mode.as_deref(), Some("delegate"));
        assert_eq!(
            request.execution_profile_id.as_deref(),
            Some("balanced-delegate")
        );
        assert_eq!(
            request.preferred_backend_ids,
            Some(vec!["backend-a".to_string(), "backend-b".to_string()])
        );
        assert_eq!(request.execution_mode.as_deref(), Some("foreground"));
        assert_eq!(request.codex_bin.as_deref(), Some("/opt/codex"));
        assert_eq!(
            request.codex_args,
            Some(vec!["--profile".to_string(), "desktop".to_string()])
        );
        assert_eq!(request.access_mode, "on-request");
        assert_eq!(
            request.auto_drive,
            Some(json!({
                "enabled": true
            }))
        );
    }

    #[test]
    fn turn_interrupt_request_accepts_snake_case_payload() {
        let payload = json!({
            "turn_id": "turn-1",
            "reason": "user-stop"
        });

        let request: TurnInterruptRequest =
            serde_json::from_value(payload).expect("parse interrupt payload");
        assert_eq!(request.turn_id.as_deref(), Some("turn-1"));
        assert_eq!(request.reason.as_deref(), Some("user-stop"));
    }

    #[test]
    fn thread_live_subscribe_request_accepts_snake_case_payload() {
        let payload = json!({
            "workspace_id": "workspace-tauri",
            "thread_id": "thread-1"
        });
        let request: ThreadLiveSubscribeRequest =
            serde_json::from_value(payload).expect("parse thread live subscribe payload");
        assert_eq!(request.workspace_id, "workspace-tauri");
        assert_eq!(request.thread_id, "thread-1");
    }

    #[test]
    fn thread_live_unsubscribe_request_accepts_snake_case_payload() {
        let payload = json!({
            "subscription_id": "sub-1"
        });
        let request: ThreadLiveUnsubscribeRequest =
            serde_json::from_value(payload).expect("parse thread live unsubscribe payload");
        assert_eq!(request.subscription_id, "sub-1");
    }
}
