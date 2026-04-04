use super::*;
use std::sync::{atomic::Ordering, Arc};

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

fn kernel_projection_test_config() -> ServiceConfig {
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
        runtime_backend_id: "kernel-projection-test".to_string(),
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

fn kernel_projection_test_context() -> AppContext {
    build_app_context(
        create_initial_state("gpt-5.4"),
        kernel_projection_test_config(),
        Arc::new(native_state_store::NativeStateStore::from_env_or_default()),
    )
}

fn sample_agent_task_summary() -> AgentTaskSummary {
    AgentTaskSummary {
        task_id: "task-1".to_string(),
        workspace_id: "ws-1".to_string(),
        thread_id: Some("thread-1".to_string()),
        request_id: Some("request-1".to_string()),
        title: Some("Kernel runtime task".to_string()),
        task_source: None,
        status: "running".to_string(),
        access_mode: "on-request".to_string(),
        execution_profile_id: None,
        review_profile_id: None,
        agent_profile: "delegate".to_string(),
        provider: Some("openai".to_string()),
        model_id: Some("gpt-5.4".to_string()),
        reason_effort: Some("high".to_string()),
        routed_provider: Some("openai".to_string()),
        routed_model_id: Some("gpt-5.4".to_string()),
        routed_pool: Some("codex".to_string()),
        routed_source: Some("workspace-default".to_string()),
        current_step: Some(1),
        created_at: 1,
        updated_at: 2,
        started_at: Some(1),
        completed_at: None,
        error_code: None,
        error_message: None,
        pending_approval_id: None,
        pending_approval: None,
        validation_preset_id: None,
        review_decision: None,
        mission_brief: None,
        relaunch_context: None,
        auto_drive: None,
        backend_id: Some("backend-a".to_string()),
        acp_integration_id: None,
        acp_session_id: None,
        acp_config_options: None,
        acp_available_commands: None,
        preferred_backend_ids: Some(vec!["backend-a".to_string()]),
        placement_fallback_reason_code: None,
        resume_backend_id: None,
        placement_score_breakdown: None,
        root_task_id: None,
        parent_task_id: None,
        child_task_ids: None,
        distributed_status: Some("running".to_string()),
        context_boundary: None,
        context_projection: None,
        compaction_summary: None,
        steps: Vec::new(),
    }
}

fn sample_agent_task_runtime() -> AgentTaskRuntime {
    AgentTaskRuntime {
        summary: sample_agent_task_summary(),
        steps_input: Vec::new(),
        interrupt_requested: false,
        checkpoint_id: Some("checkpoint-1".to_string()),
        review_actionability: Some(json!({ "state": "ready", "summary": "Resume is available." })),
        execution_graph: None,
        takeover_bundle: Some(json!({
            "state": "ready",
            "pathKind": "resume",
            "primaryAction": "resume_run",
            "summary": "Resume from checkpoint.",
            "recommendedAction": "Resume the run.",
            "missionLinkage": {
                "recoveryPath": "run",
            },
            "publishHandoff": {
                "branchName": "kernel/task-1",
            },
        })),
        recovered: false,
        last_tool_signature: None,
        consecutive_tool_signature_count: 0,
        interrupt_waiter: Arc::new(Notify::new()),
        approval_waiter: Arc::new(Notify::new()),
    }
}

#[test]
fn kernel_job_projection_uses_orthogonal_execution_profile() {
    let runtime = AgentTaskRuntime {
        summary: sample_agent_task_summary(),
        steps_input: Vec::new(),
        interrupt_requested: false,
        checkpoint_id: Some("checkpoint-1".to_string()),
        review_actionability: Some(json!({ "state": "ready", "summary": "Resume is available." })),
        execution_graph: None,
        takeover_bundle: Some(json!({
            "state": "ready",
            "pathKind": "resume",
            "primaryAction": "resume_run",
            "summary": "Resume from checkpoint.",
            "recommendedAction": "Resume the run.",
            "missionLinkage": {
                "recoveryPath": "run",
            },
            "publishHandoff": {
                "branchName": "kernel/task-1",
            },
        })),
        recovered: false,
        last_tool_signature: None,
        consecutive_tool_signature_count: 0,
        interrupt_waiter: Arc::new(Notify::new()),
        approval_waiter: Arc::new(Notify::new()),
    };

    let payload = kernel_job_payload(&runtime);
    assert_eq!(payload["executionProfile"]["placement"], json!("remote"));
    assert_eq!(payload["executionProfile"]["interactivity"], json!("interactive"));
    assert_eq!(payload["executionProfile"]["isolation"], json!("container_sandbox"));
    assert_eq!(payload["continuation"]["checkpointId"], json!("checkpoint-1"));
    assert_eq!(
        payload["continuation"]["publishHandoff"]["branchName"],
        json!("kernel/task-1")
    );
    assert_eq!(payload["continuation"]["takeover"]["pathKind"], json!("resume"));
}

#[test]
fn kernel_session_projection_preserves_terminal_lines() {
    let mut session = TerminalSessionRecord::new(
        "terminal-1".to_string(),
        "ws-1".to_string(),
        1,
        None,
        TerminalSessionState::Created,
    );
    session.lines = vec!["echo hi".to_string(), "hi".to_string()];
    let payload = kernel_session_payload(&session);
    assert_eq!(payload["kind"], json!("pty"));
    assert_eq!(payload["workspaceId"], json!("ws-1"));
    assert_eq!(payload["executionProfile"]["placement"], json!("local"));
    assert_eq!(payload["lines"], json!(["echo hi", "hi"]));
}

#[test]
fn kernel_extension_bundle_detects_declared_surfaces() {
    let payload =
        kernel_extension_bundle_payload(&extensions_runtime::RuntimeExtensionSpecPayload {
            extension_id: "ext-1".to_string(),
            version: "1.0.0".to_string(),
            display_name: "Kernel Extension".to_string(),
            publisher: "HugeCode".to_string(),
            summary: "Kernel projection test extension".to_string(),
            kind: "mcp".to_string(),
            distribution: "workspace".to_string(),
            name: "Kernel Extension".to_string(),
            transport: "mcp-http".to_string(),
            lifecycle_state: "enabled".to_string(),
            enabled: true,
            workspace_id: Some("ws-1".to_string()),
            capabilities: vec!["tools".to_string(), "resources".to_string(), "hooks".to_string()],
            permissions: vec![],
            ui_apps: vec![],
            provenance: json!({ "sourceId": "workspace" }),
            config: json!({
                "tools": [{ "toolName": "search" }],
                "resources": {
                    "doc": "hello"
                },
                "hooks": ["preInvoke"],
            }),
            installed_at: 1,
            updated_at: 2,
        });
    assert_eq!(payload["toolCount"], json!(1));
    assert_eq!(payload["resourceCount"], json!(1));
    assert_eq!(payload["surfaces"], json!(["tools", "resources", "hooks"]));
}

#[tokio::test]
async fn kernel_projection_bootstrap_reuses_cached_slices_until_revision_changes() {
    let ctx = kernel_projection_test_context();

    let first = handle_kernel_projection_bootstrap_v3(
        &ctx,
        &json!({
            "scopes": ["jobs", "mission_control", "continuity"],
        }),
    )
    .await
    .expect("first bootstrap");
    let second = handle_kernel_projection_bootstrap_v3(
        &ctx,
        &json!({
            "scopes": ["jobs", "mission_control", "continuity"],
        }),
    )
    .await
    .expect("second bootstrap");

    assert_eq!(first, second);
    assert_eq!(first["revision"], json!(0));
    let initial_jobs_len = first["slices"]["jobs"].as_array().map(Vec::len).unwrap_or(0);
    let initial_recoverable_count = first["slices"]["continuity"]["summary"]
        ["recoverableRunCount"]
        .as_u64()
        .unwrap_or(0);

    {
        let mut store = ctx.agent_tasks.write().await;
        store.order.push_back("task-1".to_string());
        store
            .tasks
            .insert("task-1".to_string(), sample_agent_task_runtime());
    }
    ctx.runtime_update_revision.fetch_add(1, Ordering::Relaxed);

    let third = handle_kernel_projection_bootstrap_v3(
        &ctx,
        &json!({
            "scopes": ["jobs", "continuity"],
        }),
    )
    .await
    .expect("third bootstrap");

    assert_eq!(third["revision"], json!(1));
    assert_eq!(
        third["slices"]["jobs"].as_array().map(Vec::len),
        Some(initial_jobs_len + 1)
    );
    assert_eq!(
        third["slices"]["continuity"]["summary"]["recoverableRunCount"],
        json!(initial_recoverable_count + 1)
    );
    assert!(third["slices"]["continuity"]["items"][0]["takeoverBundle"].is_object());
}

#[tokio::test]
async fn kernel_projection_delta_emits_resync_required_ops() {
    let ctx = kernel_projection_test_context();
    let delta = build_kernel_projection_delta_v3(
        &ctx,
        &[String::from("jobs"), String::from("mission_control")],
        0,
        Some("subscriber_lagged"),
    )
    .await
    .expect("build resync delta")
    .expect("delta payload");

    assert_eq!(delta["ops"].as_array().map(Vec::len), Some(2));
    assert_eq!(delta["ops"][0]["type"], json!("resync_required"));
    assert_eq!(delta["ops"][0]["reason"], json!("subscriber_lagged"));
    assert_eq!(delta["ops"][1]["scope"], json!("mission_control"));
}

#[tokio::test]
async fn kernel_projection_bootstrap_rejects_unknown_or_legacy_fields() {
    let ctx = kernel_projection_test_context();

    let error = handle_kernel_projection_bootstrap_v3(
        &ctx,
        &json!({
            "scopes": ["jobs"],
            "last_revision": 7,
        }),
    )
    .await
    .expect_err("legacy bootstrap fields should be rejected");

    assert_eq!(error.code.as_str(), "INVALID_PARAMS");
    assert!(
        error.message.contains("legacy alias fields")
            || error.message.contains("unsupported fields")
            || error.message.contains("Unknown kernel projection bootstrap"),
        "unexpected message: {}",
        error.message
    );
}

#[tokio::test]
async fn kernel_jobs_compat_handler_populates_projection_slice_cache() {
    let ctx = kernel_projection_test_context();
    let jobs = handle_kernel_jobs_list_v2(&ctx, &json!({}))
        .await
        .expect("jobs projection");
    let revision = ctx.runtime_update_revision.load(Ordering::Relaxed);

    let cached = crate::read_runtime_revision_cached_json_value(
        &ctx,
        &RuntimeRevisionCacheKey::KernelProjectionJobsSlice,
        revision,
    );

    assert_eq!(cached, Some(jobs));
}

#[tokio::test]
async fn kernel_sessions_list_rejects_snake_case_workspace_field() {
    let ctx = kernel_projection_test_context();
    let error = handle_kernel_sessions_list_v2(
        &ctx,
        &json!({
            "workspace_id": "ws-1",
        }),
    )
    .await
    .expect_err("snake_case sessions request must fail");

    assert_eq!(error.code.as_str(), "INVALID_PARAMS");
    assert!(error.message.contains("Invalid kernel sessions request"));
}

#[tokio::test]
async fn kernel_context_snapshot_rejects_snake_case_fields() {
    let ctx = kernel_projection_test_context();
    let error = handle_kernel_context_snapshot_v2(
        &ctx,
        &json!({
            "kind": "workspace",
            "workspace_id": "ws-1",
        }),
    )
    .await
    .expect_err("snake_case context request must fail");

    assert_eq!(error.code.as_str(), "INVALID_PARAMS");
    assert!(error.message.contains("Invalid kernel context snapshot request"));
}

#[tokio::test]
async fn kernel_policies_evaluate_rejects_legacy_capability_alias() {
    let ctx = kernel_projection_test_context();
    let error = handle_kernel_policies_evaluate_v2(
        &ctx,
        &json!({
            "capabilityId": "kernel.exec",
        }),
    )
    .await
    .expect_err("legacy capability alias must fail");

    assert_eq!(error.code.as_str(), "INVALID_PARAMS");
    assert!(error.message.contains("Invalid kernel policies request"));
}
