    #[tokio::test]
    async fn distributed_task_graph_local_summary_candidates_filter_to_requested_root() {
        let mut store = AgentTaskStore::default();

        let mut root_runtime = mock_agent_task_runtime("task-root", AgentTaskStatus::Queued);
        root_runtime.summary.root_task_id = Some("task-root".to_string());
        store
            .tasks
            .insert("task-root".to_string(), root_runtime);

        let mut child_runtime = mock_agent_task_runtime("task-child", AgentTaskStatus::Running);
        child_runtime.summary.root_task_id = Some("task-root".to_string());
        child_runtime.summary.parent_task_id = Some("task-root".to_string());
        store
            .tasks
            .insert("task-child".to_string(), child_runtime);

        let mut sibling_runtime = mock_agent_task_runtime("task-sibling", AgentTaskStatus::Queued);
        sibling_runtime.summary.root_task_id = Some("task-root".to_string());
        sibling_runtime.summary.parent_task_id = Some("task-root".to_string());
        store
            .tasks
            .insert("task-sibling".to_string(), sibling_runtime);

        let mut other_root_runtime =
            mock_agent_task_runtime("task-other-root", AgentTaskStatus::Queued);
        other_root_runtime.summary.root_task_id = Some("task-other-root".to_string());
        store
            .tasks
            .insert("task-other-root".to_string(), other_root_runtime);

        let mut other_child_runtime =
            mock_agent_task_runtime("task-other-child", AgentTaskStatus::Queued);
        other_child_runtime.summary.root_task_id = Some("task-other-root".to_string());
        other_child_runtime.summary.parent_task_id = Some("task-other-root".to_string());
        store
            .tasks
            .insert("task-other-child".to_string(), other_child_runtime);

        let mut task_ids = crate::rpc_dispatch::collect_local_distributed_task_graph_summary_candidates(
            &store,
            "task-child",
            "task-root",
        )
        .into_iter()
        .map(|summary| summary.task_id)
        .collect::<Vec<_>>();
        task_ids.sort();

        assert_eq!(
            task_ids,
            vec![
                "task-child".to_string(),
                "task-root".to_string(),
                "task-sibling".to_string()
            ]
        );
    }

    #[tokio::test]
    async fn distributed_task_graph_local_summary_candidates_include_children_for_missing_root() {
        let mut store = AgentTaskStore::default();

        let mut child_runtime = mock_agent_task_runtime("task-child", AgentTaskStatus::Running);
        child_runtime.summary.root_task_id = Some("task-root".to_string());
        child_runtime.summary.parent_task_id = Some("task-root".to_string());
        store
            .tasks
            .insert("task-child".to_string(), child_runtime);

        let mut other_child_runtime =
            mock_agent_task_runtime("task-other-child", AgentTaskStatus::Queued);
        other_child_runtime.summary.root_task_id = Some("task-other-root".to_string());
        other_child_runtime.summary.parent_task_id = Some("task-other-root".to_string());
        store
            .tasks
            .insert("task-other-child".to_string(), other_child_runtime);

        let task_ids = crate::rpc_dispatch::collect_local_distributed_task_graph_summary_candidates(
            &store,
            "task-root",
            "task-root",
        )
        .into_iter()
        .map(|summary| summary.task_id)
        .collect::<Vec<_>>();

        assert_eq!(task_ids, vec!["task-child".to_string()]);
    }

    #[tokio::test]
    async fn distributed_task_graph_local_summary_candidates_project_graph_fields() {
        let mut store = AgentTaskStore::default();
        let now = now_ms();

        let mut runtime = mock_agent_task_runtime("task-root", AgentTaskStatus::Running);
        runtime.summary.root_task_id = Some("task-root".to_string());
        runtime.summary.parent_task_id = Some("task-parent".to_string());
        runtime.summary.backend_id = Some("worker-graph".to_string());
        runtime.summary.access_mode = "on-request".to_string();
        runtime.summary.routed_provider = Some("openai".to_string());
        runtime.summary.error_message = Some("worker unavailable".to_string());
        runtime.summary.steps = vec![AgentTaskStepSummary {
            index: 0,
            kind: "read".to_string(),
            role: "code".to_string(),
            status: "running".to_string(),
            message: "step".to_string(),
            run_id: None,
            output: None,
            metadata: Value::Null,
            started_at: None,
            updated_at: now,
            completed_at: None,
            error_code: None,
            error_message: None,
            approval_id: None,
        }];
        store.tasks.insert("task-root".to_string(), runtime);

        let candidates =
            crate::rpc_dispatch::collect_local_distributed_task_graph_summary_candidates(
                &store,
                "task-root",
                "task-root",
            );
        let candidate = candidates.first().expect("local graph candidate");

        assert_eq!(candidate.task_id, "task-root");
        assert_eq!(candidate.root_task_id, "task-root");
        assert_eq!(candidate.node.parent_task_id.as_deref(), Some("task-parent"));
        assert_eq!(candidate.node.role, "code");
        assert_eq!(candidate.node.backend_id.as_deref(), Some("worker-graph"));
        assert_eq!(candidate.node.status, "running");
        assert_eq!(candidate.node.attempt, 1);
        assert_eq!(candidate.access_mode.as_deref(), Some("on-request"));
        assert_eq!(candidate.routed_provider.as_deref(), Some("openai"));
        assert_eq!(candidate.execution_mode, "runtime");
        assert_eq!(candidate.reason.as_deref(), Some("worker unavailable"));
    }

    #[tokio::test]
    async fn distributed_task_graph_rpc_returns_known_and_missing_task_snapshots() {
        let app = test_router();
        let workspace_id = format!("workspace-graph-{}", rand::random::<u64>());

        let missing_graph_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_distributed_task_graph",
                "params": {
                    "taskId": "task-missing"
                }
            }),
        )
        .await;
        assert_eq!(missing_graph_payload["ok"], Value::Bool(true));
        assert_eq!(
            missing_graph_payload["result"]["taskId"],
            Value::String("task-missing".to_string())
        );
        assert_eq!(
            missing_graph_payload["result"]["rootTaskId"],
            Value::String("task-missing".to_string())
        );
        assert_eq!(
            missing_graph_payload["result"]["nodes"]
                .as_array()
                .map(Vec::len),
            Some(0)
        );
        let _ = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_backend_upsert",
                "params": {
                    "backendId": "worker-graph",
                    "displayName": "Graph Worker",
                    "capabilities": ["plan", "code"],
                    "maxConcurrency": 8,
                    "costTier": "standard",
                    "latencyClass": "regional",
                    "rolloutState": "current",
                    "status": "active"
                }
            }),
        )
        .await;

        let started_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_start_v2",
                "params": {
                    "workspaceId": workspace_id,
                    "threadId": null,
                    "accessMode": "on-request",
                    "executionMode": "distributed",
                    "requiredCapabilities": ["code"],
                    "steps": [
                        {
                            "kind": "read",
                            "input": "summarize graph test"
                        }
                    ]
                }
            }),
        )
        .await;
        assert_eq!(started_payload["ok"], Value::Bool(true));
        let task_id = runtime_run_task_id(&started_payload);

        let graph_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_distributed_task_graph",
                "params": {
                    "taskId": task_id
                }
            }),
        )
        .await;
        assert_eq!(graph_payload["ok"], Value::Bool(true));
        assert_eq!(
            graph_payload["result"]["taskId"],
            Value::String(task_id.clone())
        );
        assert_eq!(
            graph_payload["result"]["rootTaskId"],
            Value::String(task_id.clone())
        );
        assert_eq!(
            graph_payload["result"]["nodes"]
                .as_array()
                .map(|entries| !entries.is_empty()),
            Some(true)
        );
        let root_node = graph_payload["result"]["nodes"][0].clone();
        assert_eq!(
            root_node["backendId"],
            Value::String("worker-graph".to_string())
        );
        assert_eq!(
            graph_payload["result"]["summary"]["accessMode"],
            Value::String("on-request".to_string())
        );
        assert!(
            graph_payload["result"]["summary"]["executionMode"].is_string(),
            "distributed graph summary executionMode should be string"
        );
        assert!(
            graph_payload["result"]["summary"]["queueDepth"].is_number(),
            "distributed graph summary queueDepth should be numeric"
        );
        assert!(
            graph_payload["result"]["summary"]["routingHealth"]["summary"]["backendsTotal"]
                .is_number(),
            "distributed graph summary routingHealth summary should be numeric"
        );
        assert_eq!(
            graph_payload["result"]["summary"]["routingHealth"]["backends"]
                .as_array()
                .map(|entries| !entries.is_empty()),
            Some(true)
        );
        assert_eq!(
            graph_payload["result"]["summary"]["workspaceSummaryLimit"],
            Value::Number(128.into())
        );

        let clamped_limit_graph_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_distributed_task_graph",
                "params": {
                    "taskId": task_id,
                    "limit": 50_000
                }
            }),
        )
        .await;
        assert_eq!(clamped_limit_graph_payload["ok"], Value::Bool(true));
        assert_eq!(
            clamped_limit_graph_payload["result"]["summary"]["workspaceSummaryLimit"],
            Value::Number(512.into())
        );

        let diagnostics_skipped_graph_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_distributed_task_graph",
                "params": {
                    "taskId": task_id,
                    "includeDiagnostics": false
                }
            }),
        )
        .await;
        assert_eq!(diagnostics_skipped_graph_payload["ok"], Value::Bool(true));
        assert_eq!(
            diagnostics_skipped_graph_payload["result"]["summary"]["queueDepth"],
            Value::Null
        );
        assert_eq!(
            diagnostics_skipped_graph_payload["result"]["summary"]["placementFailuresTotal"],
            Value::Null
        );
        assert_eq!(
            diagnostics_skipped_graph_payload["result"]["summary"]["routingHealth"],
            Value::Null
        );
    }
