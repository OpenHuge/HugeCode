use super::*;
use std::sync::Arc;

use crate::{
    build_app_context, create_initial_state, native_state_store, ServiceConfig,
    DEFAULT_AGENT_MAX_CONCURRENT_TASKS, DEFAULT_AGENT_TASK_HISTORY_LIMIT,
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

fn runtime_composition_test_config() -> ServiceConfig {
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
        runtime_backend_id: "runtime-composition-test".to_string(),
        runtime_backend_capabilities: vec!["code".to_string()],
        runtime_port: 8788,
        ws_write_buffer_size_bytes: DEFAULT_RUNTIME_WS_WRITE_BUFFER_SIZE_BYTES,
        ws_max_write_buffer_size_bytes: DEFAULT_RUNTIME_WS_MAX_WRITE_BUFFER_SIZE_BYTES,
        ws_max_frame_size_bytes: DEFAULT_RUNTIME_WS_MAX_FRAME_SIZE_BYTES,
        ws_max_message_size_bytes: DEFAULT_RUNTIME_WS_MAX_MESSAGE_SIZE_BYTES,
        ws_max_connections: DEFAULT_RUNTIME_WS_MAX_CONNECTIONS,
        provider_extension_seeds: Vec::new(),
    }
}

fn runtime_composition_test_context() -> AppContext {
    build_app_context(
        create_initial_state("gpt-5.4"),
        runtime_composition_test_config(),
        Arc::new(native_state_store::NativeStateStore::from_env_or_default()),
    )
}

fn sample_runtime_composition_publish_payload(
    authority_revision: u64,
    publisher_session_id: &str,
) -> Value {
    json!({
        "workspaceId": "ws-1",
        "profiles": [
            {
                "id": "workspace-default",
                "name": "Workspace Default",
                "scope": "workspace",
                "enabled": true,
                "pluginSelectors": [],
                "trustPolicy": {
                    "requireVerifiedSignatures": false,
                    "allowDevOverrides": true,
                    "blockedPublishers": [],
                },
                "routePolicy": {
                    "preferredRoutePluginIds": [],
                    "resolvedRoutePluginId": null,
                },
                "backendPolicy": {
                    "preferredBackendIds": [],
                    "resolvedBackendId": null,
                },
                "observabilityPolicy": {
                    "captureCompositionTraces": false,
                    "explainSelectionReasons": true,
                },
            }
        ],
        "snapshot": {
            "activeProfile": {
                "id": "workspace-default",
                "name": "Workspace Default",
                "scope": "workspace",
                "enabled": true,
                "pluginSelectors": [],
                "trustPolicy": {
                    "requireVerifiedSignatures": false,
                    "allowDevOverrides": true,
                    "blockedPublishers": [],
                },
                "routePolicy": {
                    "preferredRoutePluginIds": [],
                    "resolvedRoutePluginId": null,
                },
                "backendPolicy": {
                    "preferredBackendIds": [],
                    "resolvedBackendId": null,
                },
                "observabilityPolicy": {
                    "captureCompositionTraces": false,
                    "explainSelectionReasons": true,
                },
            },
            "authorityState": "unavailable",
            "freshnessState": "unavailable",
            "authorityRevision": null,
            "lastAcceptedRevision": null,
            "lastPublishAttemptAt": null,
            "publishedAt": null,
            "publisherSessionId": null,
            "provenance": {
                "activeProfileId": "workspace-default",
                "activeProfileName": "Workspace Default",
                "appliedLayerOrder": ["built_in", "user", "workspace", "launch_override"],
                "selectorDecisions": {},
            },
            "pluginEntries": [],
            "selectedRouteCandidates": [],
            "selectedBackendCandidates": [],
            "blockedPlugins": [],
            "trustDecisions": [],
        },
        "authorityRevision": authority_revision,
        "publishedAt": 123,
        "publisherSessionId": publisher_session_id,
    })
}

#[tokio::test]
async fn rpc_dispatch_runtime_composition_tests_publish_and_read_back_authority_snapshot() {
    let ctx = runtime_composition_test_context();

    let publish = handle_runtime_composition_snapshot_publish_v1(
        &ctx,
        &sample_runtime_composition_publish_payload(1, "session-a"),
    )
    .await
    .expect("publish composition snapshot");
    assert_eq!(publish["authorityState"], Value::String("published".to_string()));
    assert_eq!(publish["freshnessState"], Value::String("current".to_string()));
    assert_eq!(publish["authorityRevision"], Value::from(1_u64));
    assert_eq!(publish["lastAcceptedRevision"], Value::from(1_u64));
    assert_eq!(publish["lastPublishAttemptAt"], Value::from(123_u64));

    let listed = handle_runtime_composition_profile_list_v2(&ctx, &json!({ "workspaceId": "ws-1" }))
        .await
        .expect("list profiles");
    assert_eq!(
        listed,
        json!([
            {
                "id": "workspace-default",
                "name": "Workspace Default",
                "scope": "workspace",
                "enabled": true,
                "active": true,
            }
        ])
    );

    let profile = handle_runtime_composition_profile_get_v2(
        &ctx,
        &json!({
            "workspaceId": "ws-1",
            "profileId": "workspace-default",
        }),
    )
    .await
    .expect("get profile");
    assert_eq!(profile["id"], Value::String("workspace-default".to_string()));

    let resolved =
        handle_runtime_composition_profile_resolve_v2(&ctx, &json!({ "workspaceId": "ws-1" }))
            .await
            .expect("resolve composition snapshot");
    assert_eq!(resolved["authorityState"], Value::String("published".to_string()));
    assert_eq!(resolved["freshnessState"], Value::String("current".to_string()));
    assert_eq!(resolved["authorityRevision"], Value::from(1_u64));
    assert_eq!(resolved["lastAcceptedRevision"], Value::from(1_u64));
    assert_eq!(resolved["lastPublishAttemptAt"], Value::from(123_u64));
    assert_eq!(
        resolved["publisherSessionId"],
        Value::String("session-a".to_string())
    );
}

#[tokio::test]
async fn rpc_dispatch_runtime_composition_tests_rejects_stale_same_session_revision() {
    let ctx = runtime_composition_test_context();

    handle_runtime_composition_snapshot_publish_v1(
        &ctx,
        &sample_runtime_composition_publish_payload(2, "session-a"),
    )
    .await
    .expect("publish authoritative composition snapshot");

    let stale = handle_runtime_composition_snapshot_publish_v1(
        &ctx,
        &sample_runtime_composition_publish_payload(1, "session-a"),
    )
    .await
    .expect("stale response");
    assert_eq!(stale["authorityState"], Value::String("stale".to_string()));
    assert_eq!(stale["freshnessState"], Value::String("stale".to_string()));
    assert_eq!(stale["authorityRevision"], Value::from(2_u64));
    assert_eq!(stale["lastAcceptedRevision"], Value::from(2_u64));
    assert_eq!(stale["lastPublishAttemptAt"], Value::from(123_u64));

    let resolved =
        handle_runtime_composition_profile_resolve_v2(&ctx, &json!({ "workspaceId": "ws-1" }))
            .await
            .expect("resolve current snapshot");
    assert_eq!(resolved["authorityState"], Value::String("stale".to_string()));
    assert_eq!(resolved["authorityRevision"], Value::from(2_u64));
    assert_eq!(resolved["freshnessState"], Value::String("stale".to_string()));
    assert_eq!(resolved["lastAcceptedRevision"], Value::from(2_u64));
    assert_eq!(resolved["lastPublishAttemptAt"], Value::from(123_u64));

    let replaced = handle_runtime_composition_snapshot_publish_v1(
        &ctx,
        &sample_runtime_composition_publish_payload(1, "session-b"),
    )
    .await
    .expect("publish from new session");
    assert_eq!(replaced["authorityState"], Value::String("published".to_string()));
    assert_eq!(replaced["freshnessState"], Value::String("current".to_string()));
    assert_eq!(replaced["authorityRevision"], Value::from(1_u64));
    assert_eq!(replaced["lastAcceptedRevision"], Value::from(1_u64));
}
