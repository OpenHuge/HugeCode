use super::super::{RuntimeBackend, DEFAULT_MAX_ACTIVE_TURN_LANES};
use crate::accounts::OAuthAccountRegistry;
use crate::models::{ResolverContext, TurnSendAttachment, TurnSendRequest};
use crate::remote::RemoteRuntime;
use serde_json::json;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

static TEST_STATE_COUNTER: AtomicU64 = AtomicU64::new(0);

macro_rules! turn_send_request {
    ($($field:tt)*) => {
        TurnSendRequest {
            mission_mode: None,
            execution_profile_id: None,
            preferred_backend_ids: None,
            service_tier: None,
            auto_drive: None,
            $($field)*
        }
    };
}

fn test_state_path(suffix: &str) -> PathBuf {
    let pid = std::process::id();
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    let seq = TEST_STATE_COUNTER.fetch_add(1, Ordering::Relaxed);

    std::env::temp_dir().join(format!(
        "code-tauri-runtime-state-{suffix}-{pid}-{nanos}-{seq}.json"
    ))
}

fn backend_with_local_and_oauth() -> RuntimeBackend {
    RuntimeBackend::new_with_state_path_for_tests(
        ResolverContext::new(OAuthAccountRegistry::seeded(), true),
        RemoteRuntime::local(),
        test_state_path("turn-send-options"),
        DEFAULT_MAX_ACTIVE_TURN_LANES,
    )
}

fn backend_with_context(resolver_context: ResolverContext) -> RuntimeBackend {
    RuntimeBackend::new_with_state_path_for_tests(
        resolver_context,
        RemoteRuntime::local(),
        test_state_path("turn-send-options-context"),
        DEFAULT_MAX_ACTIVE_TURN_LANES,
    )
}

fn base_turn_send_request() -> TurnSendRequest {
    turn_send_request! {
        workspace_id: "workspace-local".to_string(),
        thread_id: None,
        request_id: None,
        content: "Inspect runtime parity".to_string(),
        context_prefix: None,
        provider: None,
        model_id: Some("gpt-5.3-codex".to_string()),
        reason_effort: Some("high".to_string()),
        execution_mode: None,
        codex_bin: None,
        codex_args: None,
        access_mode: "on-request".to_string(),
        queue: false,
        attachments: vec![],
        collaboration_mode: None,
    }
}

#[test]
fn send_turn_rejects_context_prefix_until_desktop_backend_supports_it() {
    let backend = backend_with_local_and_oauth();
    let mut request = base_turn_send_request();
    request.context_prefix = Some("[ATLAS_CONTEXT v1]\nplan: noop".to_string());

    let ack = backend.send_turn(request);

    assert!(!ack.accepted);
    assert!(ack.message.contains("INVALID_PARAMS"));
    assert!(ack.message.contains("contextPrefix"));
}

#[test]
fn send_turn_rejects_unknown_provider_with_invalid_params_message() {
    let backend = backend_with_local_and_oauth();
    let mut request = base_turn_send_request();
    request.provider = Some("foo-ai".to_string());
    request.model_id = None;

    let ack = backend.send_turn(request);

    assert!(!ack.accepted);
    assert!(ack.message.contains("INVALID_PARAMS"));
    assert!(ack.message.contains("unsupported provider"));
}

#[test]
fn send_turn_rejects_provider_model_mismatch_with_invalid_params_message() {
    let backend = backend_with_local_and_oauth();
    let mut request = base_turn_send_request();
    request.provider = Some("openai".to_string());
    request.model_id = Some("claude-sonnet-4.5".to_string());

    let ack = backend.send_turn(request);

    assert!(!ack.accepted);
    assert!(ack.message.contains("INVALID_PARAMS"));
    assert!(ack.message.contains("mismatch"));
}

#[test]
fn send_turn_rejects_empty_workspace_id_with_invalid_params_message() {
    let backend = backend_with_local_and_oauth();
    let mut request = base_turn_send_request();
    request.workspace_id = "   ".to_string();

    let ack = backend.send_turn(request);

    assert!(!ack.accepted);
    assert!(ack.message.contains("INVALID_PARAMS"));
    assert!(ack.message.contains("workspaceId"));
}

#[test]
fn send_turn_rejects_local_cli_execution_mode_with_explicit_error() {
    let backend = backend_with_local_and_oauth();
    let mut request = base_turn_send_request();
    request.execution_mode = Some("local-cli".to_string());

    let ack = backend.send_turn(request);

    assert!(!ack.accepted);
    assert!(ack.message.contains("INVALID_PARAMS"));
    assert!(ack.message.contains("executionMode"));
    assert!(ack.message.contains("local-cli"));
}

#[test]
fn send_turn_rejects_codex_overrides_until_desktop_backend_supports_them() {
    let backend = backend_with_local_and_oauth();
    let mut request = base_turn_send_request();
    request.codex_bin = Some("/opt/codex".to_string());
    request.codex_args = Some(vec!["--profile".to_string(), "desktop".to_string()]);

    let ack = backend.send_turn(request);

    assert!(!ack.accepted);
    assert!(ack.message.contains("INVALID_PARAMS"));
    assert!(ack.message.contains("codexBin/codexArgs"));
}

#[test]
fn send_turn_rejects_invalid_access_mode_with_explicit_error() {
    let backend = backend_with_local_and_oauth();
    let mut request = base_turn_send_request();
    request.access_mode = "danger-zone".to_string();

    let ack = backend.send_turn(request);

    assert!(!ack.accepted);
    assert!(ack.message.contains("INVALID_PARAMS"));
    assert!(ack.message.contains("accessMode"));
}

#[test]
fn send_turn_rejects_invalid_reason_effort_with_explicit_error() {
    let backend = backend_with_local_and_oauth();
    let mut request = base_turn_send_request();
    request.reason_effort = Some("turbo".to_string());

    let ack = backend.send_turn(request);

    assert!(!ack.accepted);
    assert!(ack.message.contains("INVALID_PARAMS"));
    assert!(ack.message.contains("reasonEffort"));
}

#[test]
fn send_turn_accepts_plan_collaboration_mode_without_unsupported_settings() {
    let backend = backend_with_local_and_oauth();
    let mut request = base_turn_send_request();
    request.collaboration_mode = Some(json!({
        "mode": "plan",
        "settings": {
            "id": "plan",
            "developer_instructions": null
        }
    }));

    let ack = backend.send_turn(request);

    assert!(ack.accepted);
    assert!(ack.message.contains("collaboration mode: plan"));
}

#[test]
fn send_turn_rejects_unsupported_collaboration_settings_with_explicit_error() {
    let backend = backend_with_local_and_oauth();
    let mut request = base_turn_send_request();
    request.collaboration_mode = Some(json!({
        "mode": "plan",
        "settings": {
            "id": "plan",
            "developer_instructions": "Return a full plan first.",
            "model": "gpt-5.3-codex",
            "reasoning_effort": "high"
        }
    }));

    let ack = backend.send_turn(request);

    assert!(!ack.accepted);
    assert!(ack.message.contains("INVALID_PARAMS"));
    assert!(ack.message.contains("collaborationMode.settings"));
    assert!(ack.message.contains("developer_instructions"));
    assert!(ack.message.contains("model"));
    assert!(ack.message.contains("reasoning_effort"));
}

#[test]
fn send_turn_marks_attachments_as_metadata_only_in_ack_message() {
    let backend = backend_with_local_and_oauth();
    let mut request = base_turn_send_request();
    request.attachments = vec![TurnSendAttachment {
        id: "attachment-1".to_string(),
        name: "screenshot.png".to_string(),
        mime_type: "image/png".to_string(),
        size: 4096,
    }];

    let ack = backend.send_turn(request);

    assert!(ack.accepted);
    assert!(ack.message.contains("attachment handling: metadata-only"));
}

#[test]
fn send_turn_routes_explicit_codex_requests_via_oauth_pool_when_local_is_unavailable() {
    let backend = backend_with_context(ResolverContext::new(
        OAuthAccountRegistry::from_active_providers(["openai", "anthropic"]),
        false,
    ));

    let ack = backend.send_turn(turn_send_request! {
        workspace_id: "workspace-local".to_string(),
        thread_id: None,
        request_id: None,
        context_prefix: None,
        content: "Fix provider routing mismatch".to_string(),
        provider: None,
        model_id: Some("gpt-5.3-codex".to_string()),
        reason_effort: Some("high".to_string()),
        execution_mode: None,
        codex_bin: None,
        codex_args: None,
        access_mode: "on-request".to_string(),
        queue: false,
        attachments: vec![],
        collaboration_mode: None,
    });

    assert!(ack.accepted);
    assert_eq!(ack.routed_provider.as_deref(), Some("openai"));
    assert_eq!(ack.routed_model_id.as_deref(), Some("gpt-5.4"));
    assert_eq!(ack.routed_pool.as_deref(), Some("codex"));
    assert_eq!(ack.routed_source.as_deref(), Some("oauth-account"));
    assert!(ack.message.contains("source: oauth-account"));
}
