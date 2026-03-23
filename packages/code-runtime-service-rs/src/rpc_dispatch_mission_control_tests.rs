use super::*;
use std::fs;
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

fn mission_control_test_config() -> ServiceConfig {
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
        runtime_backend_id: "mission-control-test".to_string(),
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

fn mission_control_test_context() -> AppContext {
    build_app_context(
        create_initial_state("gpt-5.4"),
        mission_control_test_config(),
        Arc::new(native_state_store::NativeStateStore::from_env_or_default()),
    )
}

fn make_step_summary(index: usize, kind: &str, metadata: Value) -> AgentTaskStepSummary {
    AgentTaskStepSummary {
        index,
        kind: kind.to_string(),
        role: "coder".to_string(),
        status: "completed".to_string(),
        message: "ok".to_string(),
        run_id: None,
        output: None,
        metadata,
        started_at: Some(1),
        updated_at: 2,
        completed_at: Some(3),
        error_code: None,
        error_message: None,
        approval_id: None,
    }
}
#[test]
fn rpc_dispatch_mission_control_tests_build_runtime_execution_graph_summary_uses_task_id_and_first_step_kind()
 {
    let summary = AgentTaskSummary {
        task_id: "task-1".to_string(),
        workspace_id: "ws-1".to_string(),
        thread_id: None,
        request_id: None,
        title: Some("Build a runtime graph".to_string()),
        task_source: None,
        validation_preset_id: None,
        status: "running".to_string(),
        access_mode: "full-access".to_string(),
        execution_profile_id: None,
        review_profile_id: None,
        agent_profile: "delegate".to_string(),
        provider: None,
        model_id: None,
        reason_effort: None,
        routed_provider: None,
        routed_model_id: None,
        routed_pool: None,
        routed_source: None,
        current_step: Some(0),
        created_at: 1,
        updated_at: 1,
        started_at: Some(1),
        completed_at: None,
        error_code: None,
        error_message: None,
        pending_approval_id: None,
        pending_approval: None,
        review_decision: None,
        mission_brief: None,
        relaunch_context: None,
        auto_drive: None,
        acp_integration_id: None,
        acp_session_id: None,
        acp_config_options: None,
        acp_available_commands: None,
        preferred_backend_ids: None,
        placement_fallback_reason_code: None,
        resume_backend_id: None,
        placement_score_breakdown: None,
        root_task_id: None,
        parent_task_id: None,
        child_task_ids: None,
        distributed_status: None,
        backend_id: Some("backend-1".to_string()),
        steps: vec![make_step_summary(0, "plan", json!({}))],
    };

    let graph = build_runtime_execution_graph_summary(&summary);

    assert_eq!(graph.graph_id, "graph-task-1");
    assert_eq!(graph.nodes[0].kind, "plan");
    assert_eq!(
        graph.nodes[0].resolved_backend_id.as_deref(),
        Some("backend-1")
    );
}

#[tokio::test]
async fn mission_control_snapshot_reuses_cached_value_until_runtime_revision_changes() {
    let ctx = mission_control_test_context();
    let first = handle_mission_control_snapshot_v1(&ctx, &json!({}))
        .await
        .expect("first snapshot");
    let second = handle_mission_control_snapshot_v1(&ctx, &json!({}))
        .await
        .expect("second snapshot");

    assert_eq!(
        first.get("generatedAt"),
        second.get("generatedAt"),
        "same revision should reuse cached mission control snapshot"
    );

    tokio::time::sleep(tokio::time::Duration::from_millis(2)).await;
    publish_runtime_updated_event(&ctx, &["agents"], "mission-control-cache-bust", None);

    let third = handle_mission_control_snapshot_v1(&ctx, &json!({}))
        .await
        .expect("third snapshot");
    assert_ne!(
        second.get("generatedAt"),
        third.get("generatedAt"),
        "new runtime revision should rebuild mission control snapshot"
    );
}

#[test]
fn derive_run_changed_paths_prefers_runtime_step_metadata() {
    let summary = AgentTaskSummary {
        task_id: "run-1".to_string(),
        workspace_id: "ws-1".to_string(),
        thread_id: Some("thread-1".to_string()),
        request_id: None,
        title: Some("Review runtime payload".to_string()),
        task_source: None,
        validation_preset_id: None,
        status: "completed".to_string(),
        access_mode: "full-access".to_string(),
        execution_profile_id: None,
        review_profile_id: None,
        agent_profile: "delegate".to_string(),
        provider: Some("openai".to_string()),
        model_id: Some("gpt-5.3-codex".to_string()),
        reason_effort: Some("high".to_string()),
        routed_provider: Some("openai".to_string()),
        routed_model_id: Some("gpt-5.3-codex".to_string()),
        routed_pool: Some("codex".to_string()),
        routed_source: Some("workspace-default".to_string()),
        current_step: Some(2),
        created_at: 1,
        updated_at: 10,
        started_at: Some(2),
        completed_at: Some(10),
        error_code: None,
        error_message: None,
        pending_approval_id: None,
        pending_approval: None,
        review_decision: None,
        mission_brief: None,
        relaunch_context: None,
        auto_drive: None,
        backend_id: None,
        acp_integration_id: None,
        acp_session_id: None,
        acp_config_options: None,
        acp_available_commands: None,
        preferred_backend_ids: None,
        placement_fallback_reason_code: None,
        resume_backend_id: None,
        placement_score_breakdown: None,
        root_task_id: None,
        parent_task_id: None,
        child_task_ids: None,
        distributed_status: None,
        steps: vec![
            make_step_summary(
                0,
                "edit",
                json!({
                    "safety": {
                        "path": "apps/code/src/features/review/utils/reviewPackSurfaceModel.ts",
                    }
                }),
            ),
            make_step_summary(
                1,
                "write",
                json!({
                    "approval": {
                        "scopeKind": "file-target",
                        "scopeTarget": "packages/code-runtime-host-contract/src/hypeCodeMissionControl.ts",
                    }
                }),
            ),
            make_step_summary(2, "diagnostics", json!({})),
        ],
    };

    assert_eq!(
        derive_run_changed_paths(&summary),
        vec![
            "apps/code/src/features/review/utils/reviewPackSurfaceModel.ts".to_string(),
            "packages/code-runtime-host-contract/src/hypeCodeMissionControl.ts".to_string(),
        ]
    );
}
#[test]
fn build_placement_evidence_derives_health_summary_and_attention_reasons() {
    let summary = AgentTaskSummary {
        task_id: "run-placement".to_string(),
        workspace_id: "ws-1".to_string(),
        thread_id: Some("thread-1".to_string()),
        request_id: None,
        title: Some("Placement health mission".to_string()),
        task_source: None,
        validation_preset_id: None,
        status: "running".to_string(),
        access_mode: "full-access".to_string(),
        execution_profile_id: None,
        review_profile_id: None,
        agent_profile: "delegate".to_string(),
        provider: Some("openai".to_string()),
        model_id: Some("gpt-5.3-codex".to_string()),
        reason_effort: Some("high".to_string()),
        routed_provider: Some("openai".to_string()),
        routed_model_id: Some("gpt-5.3-codex".to_string()),
        routed_pool: Some("codex".to_string()),
        routed_source: Some("workspace-default".to_string()),
        current_step: Some(0),
        created_at: 1,
        updated_at: 10,
        started_at: Some(2),
        completed_at: None,
        error_code: None,
        error_message: None,
        pending_approval_id: None,
        pending_approval: None,
        review_decision: None,
        mission_brief: None,
        relaunch_context: None,
        auto_drive: None,
        backend_id: Some("backend-1".to_string()),
        acp_integration_id: None,
        acp_session_id: None,
        acp_config_options: None,
        acp_available_commands: None,
        preferred_backend_ids: Some(vec!["backend-preferred".to_string()]),
        placement_fallback_reason_code: None,
        resume_backend_id: None,
        placement_score_breakdown: None,
        root_task_id: None,
        parent_task_id: None,
        child_task_ids: None,
        distributed_status: None,
        steps: vec![make_step_summary(0, "read", json!({}))],
    };
    let routing = json!({
        "backendId": "backend-1",
        "health": "attention",
    });
    let execution_profile = json!({
        "routingStrategy": "workspace_default",
    });
    let backend = RuntimeBackendSummary {
        backend_id: "backend-1".to_string(),
        display_name: "Primary Backend".to_string(),
        capabilities: vec!["code".to_string()],
        max_concurrency: 4,
        cost_tier: "standard".to_string(),
        latency_class: "interactive".to_string(),
        rollout_state: "current".to_string(),
        status: "draining".to_string(),
        healthy: true,
        queue_depth: 2,
        running_tasks: 4,
        health_score: 0.61,
        failures: 3,
        created_at: 1,
        updated_at: 10,
        last_heartbeat_at: 10,
        heartbeat_interval_ms: None,
        backend_class: None,
        specializations: None,
        policy: Some(default_runtime_backend_policy_profile()),
        connectivity: None,
        lease: None,
        readiness: None,
        backend_kind: Some("native".to_string()),
        integration_id: None,
        transport: Some("stdio".to_string()),
        origin: Some("runtime-native".to_string()),
        contract: None,
    };

    let placement = build_placement_evidence(
        &summary,
        &routing,
        &execution_profile,
        &HashMap::from([(backend.backend_id.clone(), backend)]),
    )
    .expect("placement evidence");

    assert_eq!(placement["healthSummary"], json!("placement_attention"));
    assert_eq!(
        placement["attentionReasons"],
        json!([
            "fallback_backend_selected",
            "backend_draining",
            "backend_queue_depth",
            "backend_at_capacity",
            "backend_failures_detected",
        ])
    );
}

#[test]
fn build_placement_evidence_includes_runtime_fallback_reason_and_score_breakdown() {
    let summary = AgentTaskSummary {
        task_id: "run-placement-fallback".to_string(),
        workspace_id: "ws-1".to_string(),
        thread_id: Some("thread-1".to_string()),
        request_id: None,
        title: Some("Placement fallback mission".to_string()),
        task_source: None,
        validation_preset_id: None,
        status: "running".to_string(),
        access_mode: "full-access".to_string(),
        execution_profile_id: None,
        review_profile_id: None,
        agent_profile: "delegate".to_string(),
        provider: Some("openai".to_string()),
        model_id: Some("gpt-5.3-codex".to_string()),
        reason_effort: Some("high".to_string()),
        routed_provider: Some("openai".to_string()),
        routed_model_id: Some("gpt-5.3-codex".to_string()),
        routed_pool: Some("codex".to_string()),
        routed_source: Some("workspace-default".to_string()),
        current_step: Some(0),
        created_at: 1,
        updated_at: 10,
        started_at: Some(2),
        completed_at: None,
        error_code: None,
        error_message: None,
        pending_approval_id: None,
        pending_approval: None,
        review_decision: None,
        mission_brief: None,
        relaunch_context: None,
        auto_drive: None,
        backend_id: Some("backend-fallback".to_string()),
        acp_integration_id: None,
        acp_session_id: None,
        acp_config_options: None,
        acp_available_commands: None,
        preferred_backend_ids: Some(vec!["backend-preferred".to_string()]),
        placement_fallback_reason_code: Some("resume_backend_unavailable".to_string()),
        resume_backend_id: Some("backend-resume".to_string()),
        placement_score_breakdown: Some(json!([
            {
                "backendId": "backend-fallback",
                "totalScore": 1510,
                "explicitPreferenceScore": 0,
                "resumeAffinityScore": 0,
                "readinessScore": 180,
                "latencyScore": 60,
                "capacityScore": 100,
                "queuePenalty": -15,
                "failurePenalty": 0,
                "healthScore": 85,
                "reasons": ["placement_ready", "latency:interactive", "slots_available"]
            },
            {
                "backendId": "backend-preferred",
                "totalScore": 1180,
                "explicitPreferenceScore": 1000,
                "resumeAffinityScore": 0,
                "readinessScore": 60,
                "latencyScore": 35,
                "capacityScore": 25,
                "queuePenalty": -30,
                "failurePenalty": -20,
                "healthScore": 110,
                "reasons": ["explicit_preference", "placement_attention"]
            }
        ])),
        root_task_id: None,
        parent_task_id: None,
        child_task_ids: None,
        distributed_status: None,
        steps: vec![make_step_summary(0, "read", json!({}))],
    };
    let routing = json!({
        "backendId": "backend-fallback",
        "health": "attention",
    });
    let execution_profile = json!({
        "routingStrategy": "workspace_default",
    });
    let backend = RuntimeBackendSummary {
        backend_id: "backend-fallback".to_string(),
        display_name: "Fallback Backend".to_string(),
        capabilities: vec!["code".to_string()],
        max_concurrency: 4,
        cost_tier: "standard".to_string(),
        latency_class: "interactive".to_string(),
        rollout_state: "current".to_string(),
        status: "healthy".to_string(),
        healthy: true,
        queue_depth: 1,
        running_tasks: 1,
        health_score: 0.85,
        failures: 0,
        created_at: 1,
        updated_at: 10,
        last_heartbeat_at: 10,
        heartbeat_interval_ms: None,
        backend_class: None,
        specializations: None,
        policy: Some(default_runtime_backend_policy_profile()),
        connectivity: None,
        lease: None,
        readiness: None,
        backend_kind: Some("native".to_string()),
        integration_id: None,
        transport: Some("stdio".to_string()),
        origin: Some("runtime-native".to_string()),
        contract: None,
    };

    let placement = build_placement_evidence(
        &summary,
        &routing,
        &execution_profile,
        &HashMap::from([(backend.backend_id.clone(), backend)]),
    )
    .expect("placement evidence");

    assert_eq!(
        placement["fallbackReasonCode"],
        json!("resume_backend_unavailable")
    );
    assert_eq!(placement["resumeBackendId"], json!("backend-resume"));
    assert_eq!(placement["scoreBreakdown"][0]["backendId"], json!("backend-fallback"));
    assert_eq!(placement["scoreBreakdown"][0]["totalScore"], json!(1510));
}
#[test]
fn build_review_pack_emits_file_changes_and_evidence_refs() {
    let review_pack = build_review_pack(&MissionRunProjection {
        id: "run-1".to_string(),
        task_id: "thread-1".to_string(),
        workspace_id: "ws-1".to_string(),
        state: "review_ready".to_string(),
        task_source: None,
        title: Some("Review runtime payload".to_string()),
        summary: Some("Review pack ready.".to_string()),
        started_at: Some(2),
        finished_at: Some(10),
        updated_at: 10,
        current_step_index: Some(2),
        pending_intervention: None,
        auto_drive: None,
        execution_profile: None,
        profile_readiness: None,
        routing: None,
        approval: None,
        review_decision: Some(json!({
            "status": "pending",
            "reviewPackId": "review-pack:run-1",
            "label": "Decision pending",
            "summary": "Accept or reject this result from the review surface.",
            "decidedAt": Value::Null,
        })),
        intervention: None,
        operator_state: None,
        next_action: None,
        warnings: Vec::new(),
        validations: vec![json!({
            "id": "run-1:validation:2",
            "label": "Check 3",
            "outcome": "passed",
            "summary": "passed",
        })],
        artifacts: vec![
            json!({
                "id": "diff:run-1",
                "label": "Workspace diff",
                "kind": "diff",
                "uri": "mission-control://runs/run-1/diff",
            }),
            json!({
                "id": "trace:trace-1",
                "label": "Trace trace-1",
                "kind": "log",
                "uri": "trace://trace-1",
            }),
            json!({
                "id": "run-1:artifact:2",
                "label": "Diagnostics 3",
                "kind": "validation",
                "uri": "validation://run-1/2",
            }),
            json!({
                "id": "run-1:command:3",
                "label": "Command 4",
                "kind": "command",
                "uri": "command://run-1/3",
            }),
        ],
        changed_paths: vec![
            "apps/code/src/features/review/utils/reviewPackSurfaceModel.ts".to_string(),
            "packages/code-runtime-host-contract/src/hypeCodeMissionControl.ts".to_string(),
        ],
        completion_reason: Some("Run completed.".to_string()),
        review_pack_id: Some("review-pack:run-1".to_string()),
        lineage: None,
        ledger: Some(json!({
            "traceId": "trace-1",
            "checkpointId": "checkpoint-1",
            "recovered": false,
            "stepCount": 3,
            "completedStepCount": 3,
            "warningCount": 0,
            "validationCount": 1,
            "artifactCount": 3,
            "evidenceState": "confirmed",
            "backendId": Value::Null,
            "routeLabel": Value::Null,
            "completionReason": "Run completed.",
            "lastProgressAt": 10,
        })),
        mission_linkage: Some(json!({
            "workspaceId": "ws-1",
            "taskId": "thread-1",
            "runId": "run-1",
            "reviewPackId": "review-pack:run-1",
            "checkpointId": "checkpoint-1",
            "traceId": "trace-1",
            "threadId": "thread-1",
            "requestId": Value::Null,
            "missionTaskId": "thread-1",
            "taskEntityKind": "thread",
            "recoveryPath": "thread",
            "navigationTarget": {
                "kind": "thread",
                "workspaceId": "ws-1",
                "threadId": "thread-1",
            },
            "summary": "Runtime preserved mission thread linkage for run run-1; operator recovery should follow thread thread-1.",
        })),
        review_actionability: Some(json!({
            "state": "ready",
            "summary": "Runtime confirms review decisions and follow-up controls are actionable.",
            "degradedReasons": [],
            "actions": [
                {"action": "accept_result", "enabled": true, "supported": true, "reason": Value::Null},
                {"action": "reject_result", "enabled": true, "supported": true, "reason": Value::Null}
            ],
        })),
        execution_graph: None,
        takeover_bundle: None,
        governance: None,
        checkpoint: Some(json!({
            "state": "completed",
            "lifecycleState": "completed",
            "checkpointId": "checkpoint-1",
            "traceId": "trace-1",
            "recovered": false,
            "updatedAt": 10,
            "resumeReady": false,
            "recoveredAt": Value::Null,
            "summary": "Checkpoint checkpoint-1 is the latest runtime recovery marker.",
        })),
        placement: None,
        operator_snapshot: None,
        workspace_evidence: Some(json!({
            "summary": "Runtime published inspectable workspace evidence for this run.",
            "buckets": [
                {
                    "kind": "changedFiles",
                    "label": "Changed files",
                    "summary": "2 files recorded.",
                    "items": [
                        {
                            "id": "apps/code/src/features/review/utils/reviewPackSurfaceModel.ts",
                            "label": "apps/code/src/features/review/utils/reviewPackSurfaceModel.ts",
                            "detail": "Runtime-recorded changed path",
                            "uri": Value::Null,
                        }
                    ],
                    "missingReason": Value::Null,
                }
            ],
        })),
        mission_brief: None,
        relaunch_context: None,
        sub_agents: Vec::new(),
        publish_handoff: None,
    });

    let review_pack_value = serde_json::to_value(review_pack).expect("serialize review pack");
    assert_eq!(review_pack_value["fileChanges"]["totalCount"], json!(2));
    assert_eq!(
        review_pack_value["fileChanges"]["paths"],
        json!([
            "apps/code/src/features/review/utils/reviewPackSurfaceModel.ts",
            "packages/code-runtime-host-contract/src/hypeCodeMissionControl.ts",
        ])
    );
    assert_eq!(
        review_pack_value["evidenceRefs"]["traceId"],
        json!("trace-1")
    );
    assert_eq!(
        review_pack_value["evidenceRefs"]["checkpointId"],
        json!("checkpoint-1")
    );
    assert_eq!(
        review_pack_value["checkpoint"]["checkpointId"],
        json!("checkpoint-1")
    );
    assert_eq!(
        review_pack_value["evidenceRefs"]["diffArtifactIds"],
        json!(["diff:run-1"])
    );
    assert_eq!(
        review_pack_value["evidenceRefs"]["validationArtifactIds"],
        json!(["run-1:artifact:2"])
    );
    assert_eq!(
        review_pack_value["evidenceRefs"]["logArtifactIds"],
        json!(["trace:trace-1"])
    );
    assert_eq!(
        review_pack_value["evidenceRefs"]["commandArtifactIds"],
        json!(["run-1:command:3"])
    );
    assert_eq!(
        review_pack_value["workspaceEvidence"]["summary"],
        json!("Runtime published inspectable workspace evidence for this run.")
    );
    assert_eq!(
        review_pack_value["missionLinkage"]["recoveryPath"],
        json!("thread")
    );
    assert_eq!(review_pack_value["actionability"]["state"], json!("ready"));
}
#[test]
fn build_review_pack_marks_incomplete_evidence_and_resumable_checkpoint_runs() {
    let review_pack = build_review_pack(&MissionRunProjection {
        id: "run-recovered".to_string(),
        task_id: "thread-1".to_string(),
        workspace_id: "ws-1".to_string(),
        state: "cancelled".to_string(),
        task_source: None,
        title: Some("Recovered review".to_string()),
        summary: Some("Awaiting follow-up review.".to_string()),
        started_at: Some(2),
        finished_at: Some(10),
        updated_at: 10,
        current_step_index: None,
        pending_intervention: None,
        auto_drive: None,
        execution_profile: None,
        profile_readiness: None,
        routing: None,
        approval: None,
        review_decision: None,
        intervention: None,
        operator_state: None,
        next_action: None,
        warnings: Vec::new(),
        validations: Vec::new(),
        artifacts: Vec::new(),
        changed_paths: Vec::new(),
        completion_reason: Some("Runtime recovered the run from a checkpoint.".to_string()),
        review_pack_id: Some("review-pack:run-recovered".to_string()),
        lineage: None,
        ledger: Some(json!({
            "traceId": "trace-recovered",
            "checkpointId": "checkpoint-recovered",
            "recovered": true,
            "stepCount": 1,
            "completedStepCount": 0,
            "warningCount": 0,
            "validationCount": 0,
            "artifactCount": 0,
            "evidenceState": "incomplete",
            "backendId": Value::Null,
            "routeLabel": Value::Null,
            "completionReason": "Runtime recovered the run from a checkpoint.",
            "lastProgressAt": 9,
        })),
        mission_linkage: Some(json!({
            "workspaceId": "ws-1",
            "taskId": "thread-1",
            "runId": "run-recovered",
            "reviewPackId": "review-pack:run-recovered",
            "checkpointId": "checkpoint-recovered",
            "traceId": "trace-recovered",
            "threadId": "thread-1",
            "requestId": Value::Null,
            "missionTaskId": "thread-1",
            "taskEntityKind": "thread",
            "recoveryPath": "thread",
            "navigationTarget": {
                "kind": "thread",
                "workspaceId": "ws-1",
                "threadId": "thread-1",
            },
            "summary": "Runtime preserved mission thread linkage for run run-recovered; operator recovery should follow thread thread-1.",
        })),
        review_actionability: Some(json!({
            "state": "degraded",
            "summary": "Runtime still allows operator decisions, but the published evidence set is incomplete.",
            "degradedReasons": ["runtime_evidence_incomplete", "validation_outcome_unknown"],
            "actions": [
                {"action": "accept_result", "enabled": true, "supported": true, "reason": Value::Null},
                {"action": "reject_result", "enabled": true, "supported": true, "reason": Value::Null}
            ],
        })),
        execution_graph: None,
        takeover_bundle: None,
        governance: None,
        checkpoint: Some(json!({
            "state": "interrupted",
            "lifecycleState": "interrupted",
            "checkpointId": "checkpoint-recovered",
            "traceId": "trace-recovered",
            "recovered": true,
            "updatedAt": 10,
            "resumeReady": true,
            "recoveredAt": 10,
            "summary": "Runtime recovered the run from a checkpoint. Resume to continue.",
        })),
        placement: None,
        operator_snapshot: None,
        workspace_evidence: None,
        mission_brief: None,
        relaunch_context: None,
        sub_agents: Vec::new(),
        publish_handoff: None,
    });

    let review_pack_value =
        serde_json::to_value(review_pack).expect("serialize recovered review pack");
    assert_eq!(review_pack_value["reviewStatus"], json!("action_required"));
    assert_eq!(review_pack_value["evidenceState"], json!("incomplete"));
    assert_eq!(
        review_pack_value["evidenceRefs"]["checkpointId"],
        json!("checkpoint-recovered")
    );
    assert_eq!(review_pack_value["checkpoint"]["recovered"], json!(true));
    assert_eq!(
        review_pack_value["actionability"]["degradedReasons"],
        json!(["runtime_evidence_incomplete", "validation_outcome_unknown"])
    );
}
#[test]
fn build_review_pack_includes_relaunch_metadata_and_sub_agents() {
    let review_pack = build_review_pack(&MissionRunProjection {
        id: "run-relaunch".to_string(),
        task_id: "thread-1".to_string(),
        workspace_id: "ws-1".to_string(),
        state: "failed".to_string(),
        task_source: None,
        title: Some("Needs relaunch".to_string()),
        summary: Some("Runtime needs follow-up".to_string()),
        started_at: Some(1),
        finished_at: Some(5),
        updated_at: 6,
        current_step_index: None,
        pending_intervention: None,
        auto_drive: None,
        execution_profile: None,
        profile_readiness: None,
        routing: None,
        approval: None,
        review_decision: None,
        intervention: Some(json!({
            "actions": [
                {
                    "action": "retry",
                    "label": "Retry",
                    "enabled": true,
                    "supported": true,
                    "reason": Value::Null,
                },
                {
                    "action": "continue_with_clarification",
                    "label": "Clarify",
                    "enabled": false,
                    "supported": true,
                    "reason": "Need operator notes",
                },
                {
                    "action": "escalate_to_pair_mode",
                    "label": "Escalate to pair mode",
                    "enabled": true,
                    "supported": true,
                    "reason": Value::Null,
                }
            ],
            "primaryAction": "retry",
        })),
        operator_state: None,
        next_action: None,
        warnings: Vec::new(),
        validations: Vec::new(),
        artifacts: Vec::new(),
        changed_paths: Vec::new(),
        completion_reason: Some("Runtime reported failure".to_string()),
        review_pack_id: Some("review-pack:run-relaunch".to_string()),
        lineage: None,
        ledger: None,
        mission_linkage: Some(json!({
            "workspaceId": "ws-1",
            "taskId": "thread-1",
            "runId": "run-relaunch",
            "reviewPackId": "review-pack:run-relaunch",
            "checkpointId": Value::Null,
            "traceId": Value::Null,
            "threadId": "thread-1",
            "requestId": Value::Null,
            "missionTaskId": "thread-1",
            "taskEntityKind": "thread",
            "recoveryPath": "thread",
            "navigationTarget": {
                "kind": "thread",
                "workspaceId": "ws-1",
                "threadId": "thread-1",
            },
            "summary": "Runtime preserved mission thread linkage for run run-relaunch; operator recovery should follow thread thread-1.",
        })),
        review_actionability: Some(json!({
            "state": "degraded",
            "summary": "Runtime still allows operator decisions, but the published evidence set is incomplete.",
            "degradedReasons": ["runtime_evidence_incomplete", "validation_outcome_unknown"],
            "actions": [
                {"action": "accept_result", "enabled": true, "supported": true, "reason": Value::Null},
                {"action": "reject_result", "enabled": true, "supported": true, "reason": Value::Null},
                {"action": "retry", "enabled": true, "supported": true, "reason": Value::Null}
            ],
        })),
        execution_graph: None,
        takeover_bundle: None,
        governance: None,
        checkpoint: None,
        placement: None,
        operator_snapshot: None,
        workspace_evidence: None,
        mission_brief: None,
        relaunch_context: Some(json!({
            "sourceTaskId": "thread-1",
            "sourceRunId": "run-prev",
            "sourceReviewPackId": "review-pack:run-prev",
            "summary": "Retry after validation failure",
            "failureClass": "validation_failed",
            "recommendedActions": ["retry", "switch_profile_and_retry"],
        })),
        sub_agents: vec![MissionRunSubAgentSummary {
            session_id: "sub-run".to_string(),
            parent_run_id: Some("run-relaunch".to_string()),
            scope_profile: Some("review".to_string()),
            status: "awaiting_approval".to_string(),
            approval_state: Some(MissionRunSubAgentApprovalState {
                status: "pending".to_string(),
                approval_id: Some("approval-1".to_string()),
                action: Some("continue_with_clarification".to_string()),
                reason: Some("Need operator approval".to_string()),
                at: Some(5),
            }),
            checkpoint_state: None,
            executor_linkage: None,
            execution_node: None,
            execution_edge: None,
            takeover_bundle: None,
            summary: Some("Sub-agent waiting".to_string()),
            timed_out_reason: None,
            interrupted_reason: None,
        }],
        publish_handoff: Some(json!({
            "jsonPath": ".hugecode/runs/run-relaunch/publish/handoff.json",
            "markdownPath": ".hugecode/runs/run-relaunch/publish/handoff.md",
            "reason": "publish",
            "branchName": "autodrive/relaunch-run",
            "reviewTitle": "feat(autodrive): relaunch",
            "details": [
                "Commit message: feat: relaunch",
                "Validation: failed",
            ],
        })),
    });

    let review_pack_value = serde_json::to_value(review_pack).expect("serialize relaunch pack");
    assert_eq!(
        review_pack_value["failureClass"],
        json!("validation_failed")
    );
    assert_eq!(
        review_pack_value["relaunchOptions"]["sourceRunId"],
        json!("run-prev")
    );
    assert_eq!(
        review_pack_value["relaunchOptions"]["recommendedActions"],
        json!(["retry", "switch_profile_and_retry", "escalate_to_pair_mode"])
    );
    assert_eq!(
        review_pack_value["relaunchOptions"]["primaryAction"],
        json!("retry")
    );
    assert_eq!(
        review_pack_value["relaunchOptions"]["availableActions"][1]["action"],
        json!("continue_with_clarification")
    );
    assert_eq!(
        review_pack_value["relaunchOptions"]["availableActions"][1]["reason"],
        json!("Need operator notes")
    );
    assert_eq!(
        review_pack_value["subAgentSummary"][0]["sessionId"],
        json!("sub-run")
    );
    assert_eq!(
        review_pack_value["publishHandoff"]["jsonPath"],
        json!(".hugecode/runs/run-relaunch/publish/handoff.json")
    );
    assert_eq!(
        review_pack_value["publishHandoff"]["branchName"],
        json!("autodrive/relaunch-run")
    );
    assert_eq!(
        review_pack_value["publishHandoff"]["reviewTitle"],
        json!("feat(autodrive): relaunch")
    );
    assert_eq!(
        review_pack_value["actionability"]["actions"][2]["action"],
        json!("retry")
    );
}
#[test]
fn project_runtime_task_to_run_appends_sub_agent_executor_nodes() {
    let now = now_ms();
    let runtime = AgentTaskRuntime {
        summary: AgentTaskSummary {
            task_id: "run-parent".to_string(),
            workspace_id: "ws-1".to_string(),
            thread_id: Some("thread-parent".to_string()),
            request_id: Some("request-parent".to_string()),
            title: Some("Parent run".to_string()),
            task_source: None,
            validation_preset_id: None,
            status: "running".to_string(),
            access_mode: "full-access".to_string(),
            execution_profile_id: None,
            review_profile_id: None,
            agent_profile: "delegate".to_string(),
            provider: Some("openai".to_string()),
            model_id: Some("gpt-5.3-codex".to_string()),
            reason_effort: Some("high".to_string()),
            routed_provider: Some("openai".to_string()),
            routed_model_id: Some("gpt-5.3-codex".to_string()),
            routed_pool: Some("codex".to_string()),
            routed_source: Some("workspace-default".to_string()),
            current_step: Some(0),
            created_at: now,
            updated_at: now,
            started_at: Some(now),
            completed_at: None,
            error_code: None,
            error_message: None,
            pending_approval_id: None,
            pending_approval: None,
            review_decision: None,
            mission_brief: None,
            relaunch_context: None,
            auto_drive: None,
            acp_integration_id: None,
            acp_session_id: None,
            acp_config_options: None,
            acp_available_commands: None,
            preferred_backend_ids: Some(vec!["backend-1".to_string()]),
            placement_fallback_reason_code: None,
            resume_backend_id: None,
            placement_score_breakdown: None,
            root_task_id: None,
            parent_task_id: None,
            child_task_ids: None,
            distributed_status: None,
            backend_id: Some("backend-1".to_string()),
            steps: vec![make_step_summary(0, "plan", json!({}))],
        },
        steps_input: Vec::new(),
        interrupt_requested: false,
        review_actionability: None,
        execution_graph: None,
        takeover_bundle: None,
        recovered: false,
        checkpoint_id: Some("checkpoint-parent".to_string()),
        last_tool_signature: None,
        consecutive_tool_signature_count: 0,
        interrupt_waiter: std::sync::Arc::new(tokio::sync::Notify::new()),
        approval_waiter: std::sync::Arc::new(tokio::sync::Notify::new()),
    };
    let backend = RuntimeBackendSummary {
        backend_id: "backend-1".to_string(),
        display_name: "Primary Backend".to_string(),
        capabilities: vec!["code".to_string()],
        max_concurrency: 4,
        cost_tier: "standard".to_string(),
        latency_class: "interactive".to_string(),
        rollout_state: "current".to_string(),
        status: "healthy".to_string(),
        healthy: true,
        queue_depth: 0,
        running_tasks: 1,
        health_score: 1.0,
        failures: 0,
        created_at: 1,
        updated_at: 10,
        last_heartbeat_at: 10,
        heartbeat_interval_ms: None,
        backend_class: None,
        specializations: None,
        policy: Some(default_runtime_backend_policy_profile()),
        connectivity: None,
        lease: None,
        readiness: None,
        backend_kind: Some("native".to_string()),
        integration_id: None,
        transport: Some("stdio".to_string()),
        origin: Some("runtime-native".to_string()),
        contract: None,
    };
    let sub_agents_by_run = HashMap::from([(
        "run-parent".to_string(),
        vec![MissionRunSubAgentSummary {
            session_id: "sub-agent-1".to_string(),
            parent_run_id: Some("run-parent".to_string()),
            scope_profile: Some("review".to_string()),
            status: "awaiting_approval".to_string(),
            approval_state: None,
            checkpoint_state: Some(SubAgentCheckpointState {
                state: "checkpointed".to_string(),
                lifecycle_state: "awaiting_approval".to_string(),
                checkpoint_id: Some("checkpoint-sub-agent-1".to_string()),
                trace_id: "sub-agent:sub-agent-1".to_string(),
                recovered: false,
                updated_at: now,
                resume_ready: Some(true),
                recovered_at: None,
                summary: Some("Sub-agent checkpoint ready.".to_string()),
            }),
            executor_linkage: Some(json!({
                "executorKind": "sub_agent",
                "sessionId": "sub-agent-1",
                "parentRunId": "run-parent",
                "taskId": "run-parent",
            })),
            execution_node: None,
            execution_edge: None,
            takeover_bundle: None,
            summary: Some("Sub-agent waiting on review.".to_string()),
            timed_out_reason: None,
            interrupted_reason: None,
        }],
    )]);

    let run = project_runtime_task_to_run(
        &runtime,
        &HashMap::from([(backend.backend_id.clone(), backend)]),
        &sub_agents_by_run,
        &HashMap::from([("ws-1".to_string(), "/tmp/workspace".to_string())]),
    );
    let run_value = serde_json::to_value(run).expect("serialize run");

    assert_eq!(
        run_value["executionGraph"]["nodes"][1]["kind"],
        json!("review")
    );
    assert_eq!(
        run_value["executionGraph"]["nodes"][1]["executorKind"],
        json!("sub_agent")
    );
    assert_eq!(
        run_value["executionGraph"]["nodes"][1]["executorSessionId"],
        json!("sub-agent-1")
    );
    assert_eq!(
        run_value["executionGraph"]["nodes"][1]["checkpoint"]["checkpointId"],
        json!("checkpoint-sub-agent-1")
    );
    assert_eq!(
        run_value["executionGraph"]["edges"][0]["kind"],
        json!("delegates_to")
    );
}

#[test]
fn build_publish_handoff_reference_reads_structured_handoff_metadata() {
    let temp_dir = tempfile::tempdir().expect("create temp dir");
    let run_id = "run-handoff";
    let publish_dir = temp_dir
        .path()
        .join(".hugecode")
        .join("runs")
        .join(run_id)
        .join("publish");
    fs::create_dir_all(&publish_dir).expect("create publish dir");
    fs::write(
        publish_dir.join("handoff.json"),
        serde_json::to_vec(&json!({
            "publish": {
                "branchName": "autodrive/run-handoff",
                "commitMessage": "feat: ship handoff",
                "summary": "Push candidate published.",
            },
            "validation": {
                "summary": "pnpm validate passed",
            },
            "reviewDraft": {
                "title": "feat(autodrive): ship handoff",
            },
            "operatorCommands": [
                "gh pr create --head autodrive/run-handoff"
            ],
            "evidence": {
                "changedFiles": ["apps/code/src/features/review/components/ReviewPackSurface.tsx"]
            }
        }))
        .expect("serialize handoff"),
    )
    .expect("write handoff");

    let handoff = build_publish_handoff_reference(
        run_id,
        Some(&AgentTaskAutoDriveState {
            enabled: Some(true),
            destination: AgentTaskAutoDriveDestination {
                title: "Ship handoff".to_string(),
                desired_end_state: vec!["Done".to_string()],
                done_definition: None,
                hard_boundaries: None,
                route_preference: None,
            },
            budget: None,
            risk_policy: None,
            context_policy: None,
            decision_policy: None,
            scenario_profile: None,
            decision_trace: None,
            outcome_feedback: None,
            autonomy_state: None,
            navigation: None,
            recovery: None,
            stop: Some(AgentTaskAutoDriveStopState {
                reason: "completed".to_string(),
                summary: Some("AutoDrive produced a publish handoff.".to_string()),
                at: Some(42),
            }),
        }),
        Some(temp_dir.path().to_string_lossy().as_ref()),
    )
    .expect("handoff metadata");

    assert_eq!(handoff["branchName"], json!("autodrive/run-handoff"));
    assert_eq!(
        handoff["reviewTitle"],
        json!("feat(autodrive): ship handoff")
    );
    assert_eq!(
        handoff["details"][0],
        json!("Commit message: feat: ship handoff")
    );
    assert_eq!(
        handoff["details"][1],
        json!("Validation: pnpm validate passed")
    );
}

#[test]
fn build_governance_summary_blocks_when_sub_agent_awaits_approval() {
    let governance = build_governance_summary(
        "running",
        &json!({
            "status": "not_required",
            "summary": "No pending approval",
        }),
        None,
        &json!({
            "actions": [
                {
                    "action": "retry",
                    "enabled": true,
                    "supported": true,
                }
            ],
            "primaryAction": "retry",
        }),
        &json!({
            "action": "cancel",
            "detail": "Run is still active.",
        }),
        None,
        &[MissionRunSubAgentSummary {
            session_id: "sub-agent-approval".to_string(),
            parent_run_id: Some("run-parent".to_string()),
            scope_profile: Some("review".to_string()),
            status: "awaiting_approval".to_string(),
            approval_state: Some(MissionRunSubAgentApprovalState {
                status: "pending_decision".to_string(),
                approval_id: Some("approval-1".to_string()),
                action: Some("continue_with_clarification".to_string()),
                reason: Some("Need operator approval".to_string()),
                at: Some(5),
            }),
            checkpoint_state: None,
            executor_linkage: None,
            execution_node: None,
            execution_edge: None,
            takeover_bundle: None,
            summary: Some("Sub-agent is waiting for approval.".to_string()),
            timed_out_reason: None,
            interrupted_reason: None,
        }],
    );

    assert_eq!(governance["state"], json!("awaiting_approval"));
    assert_eq!(governance["blocking"], json!(true));
    assert_eq!(
        governance["summary"],
        json!("Sub-agent is waiting for approval.")
    );
}
