use super::*;

fn make_graph_test_step_summary(index: usize, kind: &str, metadata: Value) -> AgentTaskStepSummary {
    AgentTaskStepSummary {
        index,
        kind: kind.to_string(),
        role: "assistant".to_string(),
        status: "completed".to_string(),
        message: format!("{kind} step"),
        run_id: None,
        output: None,
        metadata,
        started_at: Some(1),
        updated_at: 1,
        completed_at: Some(1),
        error_code: None,
        error_message: None,
        approval_id: None,
    }
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
            steps: vec![make_graph_test_step_summary(0, "plan", json!({}))],
        },
        steps_input: Vec::new(),
        interrupt_requested: false,
        checkpoint_id: Some("checkpoint-parent".to_string()),
        review_actionability: None,
        execution_graph: None,
        takeover_bundle: None,
        recovered: false,
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

    assert_eq!(run_value["executionGraph"]["nodes"][1]["kind"], json!("review"));
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
    assert_eq!(run_value["executionGraph"]["edges"][0]["kind"], json!("delegates_to"));
}
