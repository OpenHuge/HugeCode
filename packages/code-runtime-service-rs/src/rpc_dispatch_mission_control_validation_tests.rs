use super::*;

#[test]
fn build_task_execution_profile_uses_validation_preset_id_when_available() {
    let summary = AgentTaskSummary {
        task_id: "task-profile".to_string(),
        workspace_id: "ws-1".to_string(),
        thread_id: None,
        request_id: None,
        title: Some("Profile with validation".to_string()),
        task_source: None,
        validation_preset_id: Some("standard".to_string()),
        status: "running".to_string(),
        access_mode: "on-request".to_string(),
        execution_profile_id: Some("balanced-delegate".to_string()),
        review_profile_id: None,
        agent_profile: "delegate".to_string(),
        provider: None,
        model_id: None,
        reason_effort: None,
        routed_provider: None,
        routed_model_id: None,
        routed_pool: None,
        routed_source: None,
        current_step: None,
        created_at: 1,
        updated_at: 1,
        started_at: None,
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
        backend_id: None,
        steps: vec![],
    };

    let execution_profile = build_task_execution_profile(&summary);

    assert_eq!(
        execution_profile["validationPresetId"],
        Value::String("standard".to_string())
    );
}

#[test]
fn project_runtime_task_to_run_recovers_linkage_without_thread_id() {
    let now = now_ms();
    let runtime = AgentTaskRuntime {
        summary: AgentTaskSummary {
            task_id: "run-threadless".to_string(),
            workspace_id: "ws-1".to_string(),
            thread_id: None,
            request_id: Some("request-threadless".to_string()),
            title: Some("Threadless run".to_string()),
            task_source: None,
            validation_preset_id: Some("standard".to_string()),
            status: "completed".to_string(),
            access_mode: "full-access".to_string(),
            execution_profile_id: Some("autonomous-delegate".to_string()),
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
            completed_at: Some(now),
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
            steps: vec![],
        },
        steps_input: Vec::new(),
        interrupt_requested: false,
        checkpoint_id: Some("checkpoint-threadless".to_string()),
        review_actionability: None,
        execution_graph: None,
        takeover_bundle: None,
        recovered: false,
        last_tool_signature: None,
        consecutive_tool_signature_count: 0,
        interrupt_waiter: std::sync::Arc::new(tokio::sync::Notify::new()),
        approval_waiter: std::sync::Arc::new(tokio::sync::Notify::new()),
    };

    let run =
        project_runtime_task_to_run(&runtime, &HashMap::new(), &HashMap::new(), &HashMap::new());
    let run_value = serde_json::to_value(&run).expect("serialize run");
    assert_eq!(run_value["missionLinkage"]["recoveryPath"], json!("run"));
    assert_eq!(
        run_value["missionLinkage"]["navigationTarget"]["kind"],
        json!("run")
    );
    assert_eq!(
        run_value["reviewActionability"]["degradedReasons"],
        json!([
            "validation_outcome_unknown",
            "thread_link_recovered_via_run",
            "placement_unconfirmed"
        ])
    );
    assert_eq!(
        run_value["executionGraph"]["nodes"][0]["placementLifecycleState"],
        json!("unresolved")
    );
    assert_eq!(
        run_value["executionGraph"]["nodes"][0]["checkpoint"]["checkpointId"],
        json!("checkpoint-threadless")
    );
    assert_eq!(run_value["takeoverBundle"]["pathKind"], json!("review"));
    assert_eq!(
        run_value["takeoverBundle"]["target"]["kind"],
        json!("review_pack")
    );
}
