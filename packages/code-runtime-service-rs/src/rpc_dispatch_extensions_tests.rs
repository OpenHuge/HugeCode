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

fn extension_dispatch_test_config() -> ServiceConfig {
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
        runtime_backend_id: "extension-dispatch-test".to_string(),
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

fn extension_dispatch_test_context() -> AppContext {
    build_app_context(
        create_initial_state("gpt-5.4"),
        extension_dispatch_test_config(),
        Arc::new(native_state_store::NativeStateStore::from_env_or_default()),
    )
}

fn resolved_instruction_skill_fixture() -> instruction_skills::ResolvedInstructionSkill {
    instruction_skills::ResolvedInstructionSkill {
        id: "workspace.agents.review".to_string(),
        name: "review".to_string(),
        description: "Review the current changeset".to_string(),
        scope: "workspace".to_string(),
        source_family: "agents".to_string(),
        source_root: "/repo/.agents/skills".to_string(),
        entry_path: "/repo/.agents/skills/review/SKILL.md".to_string(),
        enabled: true,
        aliases: vec!["review".to_string(), "agents:review".to_string()],
        shadowed_by: None,
        frontmatter: json!({
            "name": "review",
            "description": "Review the current changeset",
        }),
        body: "Review carefully".to_string(),
        supporting_files: vec![instruction_skills::ResolvedInstructionSkillFile {
            path: "checklist.md".to_string(),
            content: "- item".to_string(),
        }],
    }
}

#[test]
fn instruction_skill_resource_payload_exposes_body_frontmatter_and_supporting_files() {
    let skill = resolved_instruction_skill_fixture();

    let body = instruction_skill_resource_payload(
        skill.id.as_str(),
        &skill,
        INSTRUCTION_SKILL_BODY_RESOURCE_ID,
    )
    .expect("body resource");
    assert_eq!(body.content_type, "text/markdown");
    assert_eq!(body.content, "Review carefully");

    let frontmatter = instruction_skill_resource_payload(
        skill.id.as_str(),
        &skill,
        INSTRUCTION_SKILL_FRONTMATTER_RESOURCE_ID,
    )
    .expect("frontmatter resource");
    assert_eq!(frontmatter.content_type, "application/json");
    assert!(frontmatter.content.contains("\"name\":\"review\""));

    let supporting_files = instruction_skill_resource_payload(
        skill.id.as_str(),
        &skill,
        INSTRUCTION_SKILL_SUPPORTING_FILES_RESOURCE_ID,
    )
    .expect("supporting files resource");
    assert_eq!(supporting_files.content_type, "application/json");
    assert!(supporting_files.content.contains("checklist.md"));

    let supporting_file = instruction_skill_resource_payload(
        skill.id.as_str(),
        &skill,
        "supporting-file:checklist.md",
    )
    .expect("supporting file resource");
    assert_eq!(supporting_file.content_type, "text/plain");
    assert_eq!(supporting_file.content, "- item");
}

#[test]
fn instruction_skill_resource_payload_rejects_unknown_resource_ids() {
    let skill = resolved_instruction_skill_fixture();
    let error = instruction_skill_resource_payload(skill.id.as_str(), &skill, "unknown")
        .expect_err("unknown resource should fail");
    assert_eq!(error.code_str(), "INVALID_PARAMS");
    assert!(
        error.message.contains("does not expose resource"),
        "unexpected error message: {}",
        error.message
    );
}

#[test]
fn request_targets_instruction_extension_prefers_existing_catalog_kind() {
    let params = serde_json::Map::new();
    let existing = extensions_runtime::RuntimeExtensionSpecPayload {
        extension_id: "workspace.agents.review".to_string(),
        version: "1.0.0".to_string(),
        display_name: "review".to_string(),
        publisher: "agents".to_string(),
        summary: "Review the current changeset".to_string(),
        kind: "instruction".to_string(),
        distribution: "workspace".to_string(),
        name: "review".to_string(),
        transport: "repo-manifest".to_string(),
        lifecycle_state: "enabled".to_string(),
        enabled: true,
        workspace_id: Some("ws-1".to_string()),
        capabilities: vec!["instructions".to_string()],
        permissions: Vec::new(),
        ui_apps: Vec::new(),
        provenance: json!({
            "scope": "workspace",
            "sourceFamily": "agents",
        }),
        config: json!({}),
        installed_at: 1,
        updated_at: 1,
    };
    assert!(request_targets_instruction_extension(
        &params,
        Some(&existing)
    ));
}

#[test]
fn build_instruction_skill_overlay_payload_uses_existing_catalog_defaults() {
    let params = serde_json::Map::new();
    let existing = extensions_runtime::RuntimeExtensionSpecPayload {
        extension_id: "workspace.agents.review".to_string(),
        version: "1.2.3".to_string(),
        display_name: "review".to_string(),
        publisher: "agents".to_string(),
        summary: "Review the current changeset".to_string(),
        kind: "instruction".to_string(),
        distribution: "workspace".to_string(),
        name: "review".to_string(),
        transport: "repo-manifest".to_string(),
        lifecycle_state: "enabled".to_string(),
        enabled: true,
        workspace_id: Some("ws-1".to_string()),
        capabilities: vec!["instructions".to_string()],
        permissions: Vec::new(),
        ui_apps: Vec::new(),
        provenance: json!({
            "scope": "workspace",
            "sourceFamily": "agents",
            "entryPath": "/repo/.agents/skills/review/SKILL.md",
            "sourceRoot": "/repo/.agents/skills",
            "aliases": ["review", "agents:review"],
            "shadowedBy": null,
        }),
        config: json!({}),
        installed_at: 1,
        updated_at: 1,
    };
    let payload = build_instruction_skill_overlay_payload(
        existing.extension_id.as_str(),
        &params,
        Some(&existing),
    );
    assert_eq!(
        payload["id"],
        Value::String("workspace.agents.review".to_string())
    );
    assert_eq!(payload["name"], Value::String("review".to_string()));
    assert_eq!(payload["scope"], Value::String("workspace".to_string()));
    assert_eq!(payload["sourceFamily"], Value::String("agents".to_string()));
    assert_eq!(
        payload["aliases"],
        Value::Array(vec![
            Value::String("review".to_string()),
            Value::String("agents:review".to_string()),
        ])
    );
}

#[test]
fn instruction_skill_overlay_round_trips_through_extension_store_record_input() {
    let existing = extensions_runtime::RuntimeExtensionSpecPayload {
        extension_id: "workspace.agents.review".to_string(),
        version: "1.2.3".to_string(),
        display_name: "review".to_string(),
        publisher: "agents".to_string(),
        summary: "Review the current changeset".to_string(),
        kind: "instruction".to_string(),
        distribution: "workspace".to_string(),
        name: "review".to_string(),
        transport: "repo-manifest".to_string(),
        lifecycle_state: "enabled".to_string(),
        enabled: true,
        workspace_id: None,
        capabilities: vec!["instructions".to_string()],
        permissions: Vec::new(),
        ui_apps: Vec::new(),
        provenance: json!({
            "scope": "workspace",
            "sourceFamily": "agents",
            "entryPath": "/repo/.agents/skills/review/SKILL.md",
            "sourceRoot": "/repo/.agents/skills",
            "aliases": ["review", "agents:review"],
            "shadowedBy": null,
        }),
        config: json!({
            "scope": "workspace",
            "sourceFamily": "agents",
            "entryPath": "/repo/.agents/skills/review/SKILL.md",
            "sourceRoot": "/repo/.agents/skills",
        }),
        installed_at: 1,
        updated_at: 1,
    };

    let overlay = instruction_skill_overlay_from_spec(&existing).expect("instruction overlay");
    let record_input = instruction_skill_record_input_from_overlay(&overlay)
        .expect("record input from instruction overlay");
    assert_eq!(record_input.extension_id, "workspace.agents.review");
    assert_eq!(record_input.kind.as_deref(), Some("instruction"));
    assert_eq!(record_input.transport, "repo-manifest");
    assert_eq!(record_input.display_name.as_deref(), Some("review"));
    assert_eq!(record_input.publisher.as_deref(), Some("agents"));
    assert_eq!(record_input.capabilities, vec!["instructions".to_string()]);
    assert_eq!(
        record_input
            .provenance
            .as_ref()
            .and_then(|value| value.get("entryPath"))
            .and_then(Value::as_str),
        Some("/repo/.agents/skills/review/SKILL.md")
    );
}

#[tokio::test]
async fn extension_tool_invoke_returns_configured_output_with_runtime_metadata() {
    let ctx = extension_dispatch_test_context();
    {
        let mut store = ctx.extensions_store.write().await;
        store.upsert_record(extensions_runtime::RuntimeExtensionRecordInput {
            extension_id: "ext.review".to_string(),
            version: Some("1.0.0".to_string()),
            display_name: Some("Review Extension".to_string()),
            publisher: Some("HugeCode".to_string()),
            summary: Some("Projection-backed review extension".to_string()),
            kind: Some("mcp".to_string()),
            distribution: Some("workspace".to_string()),
            transport: "mcp-http".to_string(),
            lifecycle_state: Some("enabled".to_string()),
            enabled: true,
            workspace_id: Some("ws-1".to_string()),
            capabilities: vec!["tools".to_string()],
            permissions: Vec::new(),
            ui_apps: Vec::new(),
            provenance: Some(json!({ "sourceId": "workspace" })),
            config: Some(json!({
                "tools": [{
                    "toolName": "ext.review.search",
                    "description": "Search review artifacts.",
                    "readOnly": true,
                    "result": {
                        "matches": ["note-1", "note-2"],
                    },
                }],
            })),
        });
    }

    let payload = handle_extension_tool_invoke_v2(
        &ctx,
        &json!({
            "workspaceId": "ws-1",
            "extensionId": "ext.review",
            "toolName": "ext.review.search",
            "input": {
                "query": "risk"
            },
        }),
    )
    .await
    .expect("tool invocation should succeed");

    assert_eq!(payload["extensionId"], json!("ext.review"));
    assert_eq!(payload["toolName"], json!("ext.review.search"));
    assert_eq!(payload["transport"], json!("mcp-http"));
    assert_eq!(payload["readOnly"], json!(true));
    assert_eq!(payload["input"]["query"], json!("risk"));
    assert_eq!(payload["output"]["matches"], json!(["note-1", "note-2"]));
    assert_eq!(payload["metadata"]["configuredOutput"], json!(true));
}

#[tokio::test]
async fn extension_tool_invoke_rejects_disabled_extensions_and_unknown_tools() {
    let ctx = extension_dispatch_test_context();
    {
        let mut store = ctx.extensions_store.write().await;
        store.upsert_record(extensions_runtime::RuntimeExtensionRecordInput {
            extension_id: "ext.blocked".to_string(),
            version: Some("1.0.0".to_string()),
            display_name: Some("Blocked Extension".to_string()),
            publisher: Some("HugeCode".to_string()),
            summary: Some("Disabled runtime extension".to_string()),
            kind: Some("host".to_string()),
            distribution: Some("workspace".to_string()),
            transport: "host-native".to_string(),
            lifecycle_state: Some("installed".to_string()),
            enabled: false,
            workspace_id: Some("ws-1".to_string()),
            capabilities: vec!["tools".to_string()],
            permissions: Vec::new(),
            ui_apps: Vec::new(),
            provenance: Some(json!({})),
            config: Some(json!({
                "tools": [{
                    "toolName": "ext.blocked.run",
                }],
            })),
        });
        store.upsert_record(extensions_runtime::RuntimeExtensionRecordInput {
            extension_id: "ext.enabled".to_string(),
            version: Some("1.0.0".to_string()),
            display_name: Some("Enabled Extension".to_string()),
            publisher: Some("HugeCode".to_string()),
            summary: Some("Enabled runtime extension".to_string()),
            kind: Some("host".to_string()),
            distribution: Some("workspace".to_string()),
            transport: "host-native".to_string(),
            lifecycle_state: Some("enabled".to_string()),
            enabled: true,
            workspace_id: Some("ws-1".to_string()),
            capabilities: vec!["tools".to_string()],
            permissions: Vec::new(),
            ui_apps: Vec::new(),
            provenance: Some(json!({})),
            config: Some(json!({
                "tools": [{
                    "toolName": "ext.enabled.run",
                }],
            })),
        });
    }

    let disabled_error = handle_extension_tool_invoke_v2(
        &ctx,
        &json!({
            "workspaceId": "ws-1",
            "extensionId": "ext.blocked",
            "toolName": "ext.blocked.run",
        }),
    )
    .await
    .expect_err("disabled extension should fail");
    assert_eq!(disabled_error.code_str(), "INVALID_PARAMS");
    assert!(disabled_error.message.contains("disabled"));

    let missing_tool_error = handle_extension_tool_invoke_v2(
        &ctx,
        &json!({
            "workspaceId": "ws-1",
            "extensionId": "ext.enabled",
            "toolName": "ext.enabled.unknown",
        }),
    )
    .await
    .expect_err("unknown tool should fail");
    assert_eq!(missing_tool_error.code_str(), "INVALID_PARAMS");
    assert!(missing_tool_error.message.contains("does not expose tool"));
}
