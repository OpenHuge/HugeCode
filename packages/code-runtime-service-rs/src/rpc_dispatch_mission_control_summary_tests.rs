use super::*;
use std::sync::Arc;

use crate::{
    build_app_context, create_initial_state, native_state_store, publish_runtime_updated_event,
    ServiceConfig, DEFAULT_AGENT_MAX_CONCURRENT_TASKS, DEFAULT_AGENT_TASK_HISTORY_LIMIT,
    DEFAULT_ANTHROPIC_ENDPOINT, DEFAULT_ANTHROPIC_VERSION, DEFAULT_DISCOVERY_BROWSE_INTERVAL_MS,
    DEFAULT_DISCOVERY_SERVICE_TYPE, DEFAULT_DISCOVERY_STALE_TTL_MS, DEFAULT_GEMINI_ENDPOINT,
    DEFAULT_LIVE_SKILLS_NETWORK_BASE_URL, DEFAULT_LIVE_SKILLS_NETWORK_CACHE_TTL_MS,
    DEFAULT_LIVE_SKILLS_NETWORK_TIMEOUT_MS, DEFAULT_OAUTH_LOOPBACK_CALLBACK_PORT,
    DEFAULT_OPENAI_COMPAT_MODEL_CACHE_TTL_MS, DEFAULT_OPENAI_MAX_RETRIES,
    DEFAULT_OPENAI_RETRY_BASE_MS, DEFAULT_OPENAI_TIMEOUT_MS, DEFAULT_RUNTIME_WS_MAX_CONNECTIONS,
    DEFAULT_RUNTIME_WS_MAX_FRAME_SIZE_BYTES, DEFAULT_RUNTIME_WS_MAX_MESSAGE_SIZE_BYTES,
    DEFAULT_RUNTIME_WS_MAX_WRITE_BUFFER_SIZE_BYTES, DEFAULT_RUNTIME_WS_WRITE_BUFFER_SIZE_BYTES,
    DEFAULT_SANDBOX_NETWORK_ACCESS,
};

fn mission_control_summary_test_config() -> ServiceConfig {
    ServiceConfig {
        default_model_id: "gpt-5.4".to_string(),
        openai_api_key: Some("test-openai-key".to_string()),
        openai_endpoint: "https://api.openai.com/v1/responses".to_string(),
        openai_compat_base_url: None,
        openai_compat_api_key: None,
        anthropic_api_key: None,
        anthropic_endpoint: DEFAULT_ANTHROPIC_ENDPOINT.to_string(),
        anthropic_version: DEFAULT_ANTHROPIC_VERSION.to_string(),
        gemini_api_key: None,
        gemini_endpoint: DEFAULT_GEMINI_ENDPOINT.to_string(),
        openai_timeout_ms: DEFAULT_OPENAI_TIMEOUT_MS,
        openai_max_retries: DEFAULT_OPENAI_MAX_RETRIES,
        openai_retry_base_ms: DEFAULT_OPENAI_RETRY_BASE_MS,
        openai_compat_model_cache_ttl_ms: DEFAULT_OPENAI_COMPAT_MODEL_CACHE_TTL_MS,
        live_skills_network_enabled: false,
        live_skills_network_base_url: DEFAULT_LIVE_SKILLS_NETWORK_BASE_URL.to_string(),
        live_skills_network_timeout_ms: DEFAULT_LIVE_SKILLS_NETWORK_TIMEOUT_MS,
        live_skills_network_cache_ttl_ms: DEFAULT_LIVE_SKILLS_NETWORK_CACHE_TTL_MS,
        sandbox_enabled: false,
        sandbox_network_access: DEFAULT_SANDBOX_NETWORK_ACCESS.to_string(),
        sandbox_allowed_hosts: Vec::new(),
        oauth_pool_db_path: ":memory:".to_string(),
        oauth_secret_key: None,
        oauth_public_base_url: None,
        oauth_loopback_callback_port: DEFAULT_OAUTH_LOOPBACK_CALLBACK_PORT,
        runtime_auth_token: None,
        agent_max_concurrent_tasks: DEFAULT_AGENT_MAX_CONCURRENT_TASKS,
        agent_task_history_limit: DEFAULT_AGENT_TASK_HISTORY_LIMIT,
        distributed_enabled: false,
        distributed_redis_url: None,
        distributed_lane_count: 1,
        distributed_worker_concurrency: 1,
        distributed_claim_idle_ms: 500,
        discovery_enabled: false,
        discovery_service_type: DEFAULT_DISCOVERY_SERVICE_TYPE.to_string(),
        discovery_browse_interval_ms: DEFAULT_DISCOVERY_BROWSE_INTERVAL_MS,
        discovery_stale_ttl_ms: DEFAULT_DISCOVERY_STALE_TTL_MS,
        runtime_backend_id: "mission-control-summary-test".to_string(),
        runtime_backend_capabilities: vec!["code".to_string()],
        runtime_port: 8788,
        ws_write_buffer_size_bytes: DEFAULT_RUNTIME_WS_WRITE_BUFFER_SIZE_BYTES,
        ws_max_write_buffer_size_bytes: DEFAULT_RUNTIME_WS_MAX_WRITE_BUFFER_SIZE_BYTES,
        ws_max_frame_size_bytes: DEFAULT_RUNTIME_WS_MAX_FRAME_SIZE_BYTES,
        ws_max_message_size_bytes: DEFAULT_RUNTIME_WS_MAX_MESSAGE_SIZE_BYTES,
        ws_max_connections: DEFAULT_RUNTIME_WS_MAX_CONNECTIONS,
        provider_extensions: Vec::new(),
    }
}

fn mission_control_summary_test_context() -> AppContext {
    build_app_context(
        create_initial_state("gpt-5.4"),
        mission_control_summary_test_config(),
        Arc::new(native_state_store::NativeStateStore::from_env_or_default()),
    )
}

#[tokio::test]
async fn mission_control_summary_reuses_cached_value_per_workspace_until_runtime_revision_changes() {
    let ctx = mission_control_summary_test_context();
    let first_revision = ctx
        .runtime_update_revision
        .load(std::sync::atomic::Ordering::Relaxed);
    let cache_key = RuntimeRevisionCacheKey::MissionControlSummary {
        workspace_id: Some("workspace-1".to_string()),
    };
    let first = handle_mission_control_summary_v1(
        &ctx,
        &json!({ "activeWorkspaceId": "workspace-1" }),
    )
    .await
    .expect("first summary");
    let second = handle_mission_control_summary_v1(
        &ctx,
        &json!({ "activeWorkspaceId": "workspace-1" }),
    )
    .await
    .expect("second summary");

    assert_eq!(
        first, second,
        "same revision and workspace should reuse cached mission control summary"
    );
    assert!(
        crate::read_runtime_revision_cached_json_value(&ctx, &cache_key, first_revision).is_some(),
        "summary request should populate the workspace-scoped cache entry"
    );

    publish_runtime_updated_event(&ctx, &["agents"], "mission-control-summary-cache-bust", None);
    let second_revision = ctx
        .runtime_update_revision
        .load(std::sync::atomic::Ordering::Relaxed);
    assert_ne!(first_revision, second_revision, "runtime revision should advance after publish");
    assert!(
        crate::read_runtime_revision_cached_json_value(&ctx, &cache_key, second_revision).is_none(),
        "cache should be invalidated when the runtime revision changes"
    );

    let third = handle_mission_control_summary_v1(
        &ctx,
        &json!({ "activeWorkspaceId": "workspace-1" }),
    )
    .await
    .expect("third summary");

    assert_eq!(
        third, second,
        "cache invalidation should rebuild the same deterministic summary payload"
    );
    assert!(
        crate::read_runtime_revision_cached_json_value(&ctx, &cache_key, second_revision).is_some(),
        "summary cache should repopulate after the rebuilt request"
    );
}
