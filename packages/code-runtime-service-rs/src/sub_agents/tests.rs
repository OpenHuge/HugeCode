use super::profiles::{
    map_sub_agent_status_to_workflow_state, normalize_sub_agent_scope_profile,
    resolve_sub_agent_profile_defaults, SubAgentApprovalEvent, SubAgentCheckpointState,
};
use super::{
    is_sub_agent_session_counted_as_active, is_sub_agent_session_terminal_status,
    is_sub_agent_task_timeout_due, map_agent_task_status_to_sub_agent_status,
    parse_sub_agent_max_task_ms, sub_agent_item_status_from_session_status,
    sub_agent_session_stale_ttl_ms, sync_sub_agent_executor_linkage,
    sync_sub_agent_runtime_execution_graph, SubAgentSessionRuntime, SubAgentSessionStore,
    SubAgentSessionSummary, DEFAULT_SUB_AGENT_MAX_TASK_MS, DEFAULT_SUB_AGENT_SESSION_HISTORY_LIMIT,
    MAX_SUB_AGENT_MAX_TASK_MS,
};
use crate::{
    rpc_dispatch::mission_control_dispatch::build_runtime_sub_agent_takeover_bundle, ServiceConfig,
    DEFAULT_DISCOVERY_BROWSE_INTERVAL_MS, DEFAULT_DISCOVERY_SERVICE_TYPE,
    DEFAULT_DISCOVERY_STALE_TTL_MS, DEFAULT_SANDBOX_NETWORK_ACCESS,
};
use serde_json::Value;
use std::collections::{HashMap, VecDeque};

fn test_sub_agent_summary() -> SubAgentSessionSummary {
    SubAgentSessionSummary {
        session_id: "session-1".to_string(),
        workspace_id: "workspace-1".to_string(),
        thread_id: None,
        title: None,
        status: "running".to_string(),
        access_mode: "read-only".to_string(),
        scope_profile: Some("general".to_string()),
        profile_descriptor: None,
        reason_effort: None,
        provider: None,
        model_id: None,
        allowed_skill_ids: None,
        allow_network: None,
        workspace_read_paths: None,
        parent_run_id: None,
        active_task_id: None,
        active_task_started_at: None,
        last_task_id: None,
        executor_linkage: None,
        created_at: 1,
        updated_at: 1,
        closed_at: None,
        checkpoint_id: None,
        trace_id: Some("sub-agent:session-1".to_string()),
        recovered: Some(false),
        checkpoint_state: None,
        context_boundary: None,
        context_projection: None,
        takeover_bundle: None,
        approval_events: Some(Vec::new()),
        compaction_summary: None,
        eval_tags: Some(vec!["scope:general".to_string()]),
        error_code: None,
        error_message: None,
    }
}

#[test]
fn map_agent_task_status_to_sub_agent_status_handles_terminal_and_running_states() {
    assert_eq!(
        map_agent_task_status_to_sub_agent_status("queued"),
        "running"
    );
    assert_eq!(
        map_agent_task_status_to_sub_agent_status("running"),
        "running"
    );
    assert_eq!(
        map_agent_task_status_to_sub_agent_status("awaiting_approval"),
        "awaiting_approval"
    );
    assert_eq!(
        map_agent_task_status_to_sub_agent_status("completed"),
        "completed"
    );
    assert_eq!(
        map_agent_task_status_to_sub_agent_status("failed"),
        "failed"
    );
    assert_eq!(
        map_agent_task_status_to_sub_agent_status("cancelled"),
        "cancelled"
    );
    assert_eq!(
        map_agent_task_status_to_sub_agent_status("interrupted"),
        "interrupted"
    );
}

#[test]
fn sub_agent_session_terminal_status_excludes_idle_but_keeps_closed() {
    assert!(!is_sub_agent_session_terminal_status("idle"));
    assert!(is_sub_agent_session_terminal_status("closed"));
    assert!(!is_sub_agent_session_terminal_status("running"));
}

#[test]
fn sub_agent_item_status_keeps_idle_sessions_in_progress() {
    assert_eq!(
        sub_agent_item_status_from_session_status("idle"),
        "inProgress"
    );
    assert_eq!(
        sub_agent_item_status_from_session_status("running"),
        "inProgress"
    );
    assert_eq!(
        sub_agent_item_status_from_session_status("completed"),
        "completed"
    );
}

#[test]
fn sub_agent_session_active_capacity_excludes_terminal_states() {
    let mut runtime = SubAgentSessionRuntime {
        summary: test_sub_agent_summary(),
        execution_node: None,
        execution_edge: None,
        closed: false,
    };
    assert!(is_sub_agent_session_counted_as_active(&runtime));

    runtime.summary.status = "completed".to_string();
    assert!(!is_sub_agent_session_counted_as_active(&runtime));

    runtime.summary.status = "failed".to_string();
    assert!(!is_sub_agent_session_counted_as_active(&runtime));

    runtime.summary.status = "awaiting_approval".to_string();
    assert!(is_sub_agent_session_counted_as_active(&runtime));

    runtime.closed = true;
    assert!(!is_sub_agent_session_counted_as_active(&runtime));
}

#[test]
fn sync_sub_agent_runtime_execution_graph_persists_executor_topology() {
    let mut summary = test_sub_agent_summary();
    summary.parent_run_id = Some("run-parent".to_string());
    summary.checkpoint_id = Some("checkpoint-1".to_string());
    summary.checkpoint_state = Some(SubAgentCheckpointState {
        state: "running".to_string(),
        lifecycle_state: "task_status_sync".to_string(),
        checkpoint_id: Some("checkpoint-1".to_string()),
        trace_id: "sub-agent:session-1".to_string(),
        recovered: false,
        updated_at: 1,
        resume_ready: Some(true),
        recovered_at: None,
        summary: Some("Checkpointed sub-agent".to_string()),
    });
    sync_sub_agent_executor_linkage(&mut summary);
    let mut runtime = SubAgentSessionRuntime {
        summary,
        execution_node: None,
        execution_edge: None,
        closed: false,
    };

    sync_sub_agent_runtime_execution_graph(&mut runtime);

    let node = runtime.execution_node.expect("execution node");
    let edge = runtime.execution_edge.expect("execution edge");
    assert_eq!(node.id, "graph-run-parent:sub-agent:session-1");
    assert_eq!(node.executor_session_id.as_deref(), Some("session-1"));
    assert_eq!(
        node.checkpoint
            .as_ref()
            .and_then(|value| value.get("checkpointId")),
        Some(&Value::String("checkpoint-1".to_string()))
    );
    assert_eq!(edge.from_node_id, "graph-run-parent:root");
    assert_eq!(edge.to_node_id, "graph-run-parent:sub-agent:session-1");
}

#[test]
fn normalize_sub_agent_scope_profile_defaults_to_general_and_accepts_review() {
    assert_eq!(
        normalize_sub_agent_scope_profile(None).expect("default scope"),
        Some("general".to_string())
    );
    assert_eq!(
        normalize_sub_agent_scope_profile(Some("review")).expect("review scope"),
        Some("review".to_string())
    );
}

#[test]
fn resolve_review_profile_defaults_disallows_network() {
    let error = resolve_sub_agent_profile_defaults(
        "read-only".to_string(),
        "review".to_string(),
        None,
        Some(true),
        None,
    )
    .expect_err("review profile should reject network");
    assert!(error.message.contains("does not allow network access"));
}

#[test]
fn resolve_review_profile_defaults_applies_read_only_descriptor() {
    let (access_mode, allowed_skill_ids, allow_network, workspace_read_paths, descriptor) =
        resolve_sub_agent_profile_defaults(
            "read-only".to_string(),
            "review".to_string(),
            None,
            None,
            Some(vec!["docs".to_string(), "src".to_string()]),
        )
        .expect("review defaults");
    assert_eq!(access_mode, "read-only");
    assert_eq!(allow_network, Some(false));
    assert_eq!(
        allowed_skill_ids,
        Some(vec![
            "core-read".to_string(),
            "core-grep".to_string(),
            "core-tree".to_string(),
        ])
    );
    assert_eq!(
        workspace_read_paths,
        Some(vec!["docs".to_string(), "src".to_string()])
    );
    assert_eq!(descriptor.profile, "review");
    assert!(descriptor.read_only);
    assert_eq!(descriptor.approval_mode, "read_only_safe");
}

#[test]
fn map_sub_agent_status_to_workflow_state_marks_timeouts() {
    assert_eq!(
        map_sub_agent_status_to_workflow_state("idle", None),
        "queued"
    );
    assert_eq!(
        map_sub_agent_status_to_workflow_state("failed", Some("APPROVAL_TIMEOUT")),
        "timed_out"
    );
    assert_eq!(
        map_sub_agent_status_to_workflow_state("interrupted", Some("TASK_INTERRUPTED")),
        "interrupted"
    );
}

#[test]
fn sub_agent_executor_linkage_tracks_current_task_and_falls_back_to_last_task() {
    let mut summary = test_sub_agent_summary();
    summary.parent_run_id = Some("run-1".to_string());
    summary.thread_id = Some("thread-1".to_string());
    summary.active_task_id = Some("task-active".to_string());
    summary.active_task_started_at = Some(123);
    summary.last_task_id = Some("task-last".to_string());
    sync_sub_agent_executor_linkage(&mut summary);

    let linkage = summary.executor_linkage.as_ref().expect("executor linkage");
    assert_eq!(linkage.executor_kind, "sub_agent");
    assert_eq!(linkage.session_id, "session-1");
    assert_eq!(linkage.workspace_id, "workspace-1");
    assert_eq!(linkage.task_id.as_deref(), Some("task-active"));
    assert_eq!(linkage.active_task_id.as_deref(), Some("task-active"));
    assert_eq!(linkage.last_task_id.as_deref(), Some("task-last"));
    assert_eq!(linkage.thread_id.as_deref(), Some("thread-1"));
    assert_eq!(linkage.parent_run_id.as_deref(), Some("run-1"));
    assert_eq!(linkage.trace_id.as_deref(), Some("sub-agent:session-1"));
    assert_eq!(linkage.active_task_started_at, Some(123));
    assert_eq!(linkage.status, "running");

    summary.active_task_id = None;
    summary.active_task_started_at = None;
    summary.status = "completed".to_string();
    sync_sub_agent_executor_linkage(&mut summary);

    let linkage = summary
        .executor_linkage
        .as_ref()
        .expect("executor linkage after fallback");
    assert_eq!(linkage.task_id.as_deref(), Some("task-last"));
    assert_eq!(linkage.active_task_id, None);
    assert_eq!(linkage.status, "completed");
}

#[test]
fn sub_agent_executor_linkage_round_trips_through_serialization() {
    let mut summary = test_sub_agent_summary();
    summary.active_task_id = Some("task-1".to_string());
    summary.last_task_id = Some("task-1".to_string());
    sync_sub_agent_executor_linkage(&mut summary);

    let encoded = serde_json::to_string(&summary).expect("serialize summary");
    let decoded: SubAgentSessionSummary =
        serde_json::from_str(&encoded).expect("deserialize summary");

    assert_eq!(decoded.executor_linkage, summary.executor_linkage);
}

#[test]
fn sub_agent_session_stale_ttl_has_floor() {
    let config = ServiceConfig {
        default_model_id: "x".to_string(),
        openai_api_key: None,
        openai_endpoint: "https://api.openai.com/v1/responses".to_string(),
        openai_compat_base_url: None,
        openai_compat_api_key: None,
        anthropic_api_key: None,
        anthropic_endpoint: "https://api.anthropic.com/v1/messages".to_string(),
        anthropic_version: "2023-06-01".to_string(),
        gemini_api_key: None,
        gemini_endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/".to_string(),
        openai_timeout_ms: 1_000,
        openai_max_retries: 0,
        openai_retry_base_ms: 10,
        openai_compat_model_cache_ttl_ms: 1000,
        live_skills_network_enabled: true,
        live_skills_network_base_url: "https://s.jina.ai".to_string(),
        live_skills_network_timeout_ms: 10_000,
        live_skills_network_cache_ttl_ms: 10_000,
        sandbox_enabled: false,
        sandbox_network_access: DEFAULT_SANDBOX_NETWORK_ACCESS.to_string(),
        sandbox_allowed_hosts: Vec::new(),
        oauth_pool_db_path: ":memory:".to_string(),
        oauth_secret_key: None,
        oauth_public_base_url: None,
        oauth_loopback_callback_port: 1455,
        runtime_auth_token: None,
        agent_max_concurrent_tasks: 1,
        agent_task_history_limit: DEFAULT_SUB_AGENT_SESSION_HISTORY_LIMIT,
        distributed_enabled: false,
        distributed_redis_url: None,
        distributed_lane_count: 1,
        distributed_worker_concurrency: 1,
        distributed_claim_idle_ms: 1000,
        discovery_enabled: false,
        discovery_service_type: DEFAULT_DISCOVERY_SERVICE_TYPE.to_string(),
        discovery_browse_interval_ms: DEFAULT_DISCOVERY_BROWSE_INTERVAL_MS,
        discovery_stale_ttl_ms: DEFAULT_DISCOVERY_STALE_TTL_MS,
        runtime_backend_id: "runtime-test".to_string(),
        runtime_backend_capabilities: vec!["code".to_string()],
        runtime_port: 8788,
        ws_write_buffer_size_bytes: 1024,
        ws_max_write_buffer_size_bytes: 1024,
        ws_max_frame_size_bytes: 1024,
        ws_max_message_size_bytes: 1024,
        ws_max_connections: 1,
        provider_extension_seeds: Vec::new(),
    };
    assert!(sub_agent_session_stale_ttl_ms(&config) >= 60_000);
    let _ = SubAgentSessionStore {
        sessions: HashMap::new(),
        order: VecDeque::new(),
    };
}

#[test]
fn sub_agent_takeover_bundle_prefers_pending_approval() {
    let mut summary = test_sub_agent_summary();
    summary.parent_run_id = Some("run-1".to_string());
    summary.approval_events = Some(vec![SubAgentApprovalEvent {
        status: "requested".to_string(),
        approval_id: Some("approval-1".to_string()),
        step_index: Some(0),
        at: Some(10),
        action: Some("approve".to_string()),
        reason: Some("Need permission to continue".to_string()),
    }]);

    let bundle = build_runtime_sub_agent_takeover_bundle(&summary);

    assert_eq!(bundle["pathKind"], Value::String("approval".to_string()));
    assert_eq!(
        bundle["primaryAction"],
        Value::String("approve".to_string())
    );
    assert_eq!(
        bundle["target"]["kind"],
        Value::String("sub_agent_session".to_string())
    );
}

#[test]
fn sub_agent_takeover_bundle_marks_resume_ready_sessions() {
    let mut summary = test_sub_agent_summary();
    summary.parent_run_id = Some("run-1".to_string());
    summary.recovered = Some(true);
    summary.checkpoint_state = Some(SubAgentCheckpointState {
        state: "paused".to_string(),
        checkpoint_id: Some("checkpoint-1".to_string()),
        lifecycle_state: "paused".to_string(),
        summary: Some("Resume is available.".to_string()),
        trace_id: "trace-1".to_string(),
        recovered: true,
        updated_at: 10,
        resume_ready: Some(true),
        recovered_at: Some(10),
    });

    let bundle = build_runtime_sub_agent_takeover_bundle(&summary);

    assert_eq!(bundle["pathKind"], Value::String("resume".to_string()));
    assert_eq!(bundle["primaryAction"], Value::String("resume".to_string()));
    assert_eq!(
        bundle["checkpointId"],
        Value::String("checkpoint-1".to_string())
    );
}

#[test]
fn sub_agent_takeover_bundle_falls_back_to_handoff_from_session_handle() {
    let mut summary = test_sub_agent_summary();
    summary.thread_id = Some("thread-1".to_string());
    summary.parent_run_id = Some("run-1".to_string());

    let bundle = build_runtime_sub_agent_takeover_bundle(&summary);

    assert_eq!(bundle["pathKind"], Value::String("handoff".to_string()));
    assert_eq!(
        bundle["primaryAction"],
        Value::String("open_sub_agent_session".to_string())
    );
    assert_eq!(
        bundle["target"]["kind"],
        Value::String("sub_agent_session".to_string())
    );
}

#[test]
fn parse_sub_agent_max_task_ms_uses_default_and_clamps() {
    assert_eq!(
        parse_sub_agent_max_task_ms(None),
        DEFAULT_SUB_AGENT_MAX_TASK_MS
    );
    assert_eq!(
        parse_sub_agent_max_task_ms(Some("not-a-number")),
        DEFAULT_SUB_AGENT_MAX_TASK_MS
    );
    assert_eq!(parse_sub_agent_max_task_ms(Some("0")), 1);
    assert_eq!(
        parse_sub_agent_max_task_ms(Some("999999999")),
        MAX_SUB_AGENT_MAX_TASK_MS
    );
}

#[test]
fn sub_agent_task_timeout_due_requires_active_task_and_elapsed_budget() {
    let mut summary = test_sub_agent_summary();
    assert!(!is_sub_agent_task_timeout_due(&summary, 1_000, 500));

    summary.active_task_id = Some("task-1".to_string());
    assert!(!is_sub_agent_task_timeout_due(&summary, 1_000, 500));

    summary.active_task_started_at = Some(600);
    assert!(!is_sub_agent_task_timeout_due(&summary, 1_099, 500));
    assert!(is_sub_agent_task_timeout_due(&summary, 1_100, 500));
}
