use super::*;

fn make_runtime_truth_step_summary(
    index: usize,
    kind: &str,
    metadata: Value,
) -> AgentTaskStepSummary {
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
fn build_operator_snapshot_workspace_evidence_and_accountability_from_runtime_truth() {
    let runtime = AgentTaskRuntime {
        summary: AgentTaskSummary {
            task_id: "run-operator".to_string(),
            workspace_id: "ws-1".to_string(),
            thread_id: Some("thread-operator".to_string()),
            request_id: Some("request-1".to_string()),
            title: Some("Inspect operator state".to_string()),
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
            mission_brief: Some(AgentTaskMissionBriefRecord {
                objective: "Land runtime-owned operator snapshot".to_string(),
                done_definition: Some(vec!["Review surface uses runtime truth.".to_string()]),
                constraints: None,
                risk_level: None,
                required_capabilities: None,
                max_subtasks: None,
                preferred_backend_ids: None,
                permission_summary: None,
                evaluation_plan: None,
                scenario_profile: None,
                plan_version: None,
                plan_summary: None,
                current_milestone_id: None,
                estimated_duration_minutes: None,
                estimated_worker_runs: None,
                parallelism_hint: None,
                clarification_questions: None,
                milestones: None,
                validation_lanes: None,
                skill_plan: None,
            }),
            relaunch_context: None,
            auto_drive: None,
            backend_id: Some("backend-1".to_string()),
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
            context_boundary: None,
            context_projection: None,
            compaction_summary: None,
            steps: vec![
                make_runtime_truth_step_summary(
                    0,
                    "edit",
                    json!({
                        "safety": {
                            "path": "apps/code/src/features/review/utils/reviewPackSurfaceModel.ts",
                        }
                    }),
                ),
                make_runtime_truth_step_summary(
                    1,
                    "bash",
                    json!({
                        "command": "pnpm validate:fast",
                    }),
                ),
                make_runtime_truth_step_summary(
                    2,
                    "diagnostics",
                    json!({
                        "note": "All checks passed",
                    }),
                ),
            ],
        },
        steps_input: Vec::new(),
        interrupt_requested: false,
        checkpoint_id: Some("checkpoint-operator".to_string()),
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
    let run = project_runtime_task_to_run(
        &runtime,
        &HashMap::from([(backend.backend_id.clone(), backend)]),
        &HashMap::new(),
        &HashMap::from([("ws-1".to_string(), "/tmp/workspace".to_string())]),
    );
    let run_value = serde_json::to_value(&run).expect("serialize run");
    assert_eq!(run_value["operatorSnapshot"]["modelId"], json!("gpt-5.3-codex"));
    assert_eq!(run_value["operatorSnapshot"]["reasoningEffort"], json!("high"));
    assert_eq!(run_value["operatorSnapshot"]["backendId"], json!("backend-1"));
    assert_eq!(run_value["operatorSnapshot"]["workspaceRoot"], json!("/tmp/workspace"));
    assert_eq!(run_value["workspaceEvidence"]["buckets"][0]["kind"], json!("changedFiles"));
    assert_eq!(run_value["workspaceEvidence"]["buckets"][5]["kind"], json!("memoryOrNotes"));
    assert_eq!(run_value["executionGraph"]["graphId"], json!("graph-run-operator"));
    assert_eq!(
        run_value["executionGraph"]["nodes"][0]["resolvedBackendId"],
        json!("backend-1")
    );
    assert_eq!(
        run_value["executionGraph"]["nodes"][0]["preferredBackendIds"],
        json!(["backend-1"])
    );
    assert_eq!(
        run_value["executionGraph"]["nodes"][0]["placementLifecycleState"],
        json!("confirmed")
    );
    assert_eq!(
        run_value["executionGraph"]["nodes"][0]["checkpoint"]["checkpointId"],
        json!("checkpoint-operator")
    );

    let thread = ThreadSummary {
        id: "thread-operator".to_string(),
        workspace_id: "ws-1".to_string(),
        title: "Inspect operator state".to_string(),
        unread: false,
        running: false,
        created_at: 1,
        updated_at: 10,
        provider: "openai".to_string(),
        model_id: Some("gpt-5.3-codex".to_string()),
        status: None,
        archived: false,
        last_activity_at: Some(10),
        agent_role: None,
        agent_nickname: None,
    };
    let task = project_thread_to_task(&thread, Some(&run));
    let task_value = serde_json::to_value(task).expect("serialize task");
    assert_eq!(task_value["accountability"]["lifecycle"], json!("in_review"));
    assert_eq!(task_value["accountability"]["claimedBy"], json!("local-operator"));
    assert_eq!(task_value["executionGraph"]["graphId"], json!("graph-run-operator"));
    assert_eq!(
        task_value["executionGraph"]["nodes"][0]["reviewActionability"]["state"],
        run_value["reviewActionability"]["state"]
    );
    assert_eq!(run_value["missionLinkage"]["recoveryPath"], json!("thread"));
    assert_eq!(run_value["reviewActionability"]["degradedReasons"], json!([]));
    assert_eq!(run_value["takeoverBundle"]["pathKind"], json!("review"));
    assert_eq!(run_value["takeoverBundle"]["primaryAction"], json!("open_review_pack"));
}
