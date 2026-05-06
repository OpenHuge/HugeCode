    #[test]
    fn agent_task_start_runs_core_steps_with_full_access() {
        run_async_test_on_large_stack(async move {
        let app = test_router();
        let workspace_id = format!("workspace-web-{}", rand::random::<u64>());
        let workspace_path = PathBuf::from(format!("/tmp/{workspace_id}"));
        let target_path = workspace_path.join("agent-task/full-access.txt");
        let _ = fs::remove_dir_all(workspace_path.as_path());
        let workspace_create = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_workspace_create",
                "params": {
                    "path": workspace_path.display().to_string(),
                    "displayName": "Agent Full Access Workspace"
                }
            }),
        )
        .await;
        assert_eq!(workspace_create["ok"], Value::Bool(true));
        let workspace_runtime_id = workspace_create["result"]["id"]
            .as_str()
            .expect("workspace runtime id")
            .to_string();
        fs::create_dir_all(
            target_path
                .parent()
                .expect("target path parent for full-access"),
        )
        .expect("create target parent");
        fs::write(target_path.as_path(), "before agent task").expect("seed target file");

        let start_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_start_v2",
                "params": {
                    "workspaceId": workspace_runtime_id,
                    "accessMode": "full-access",
                    "steps": [
                        {
                            "kind": "read",
                            "path": "agent-task/full-access.txt"
                        },
                        {
                            "kind": "write",
                            "path": "agent-task/full-access.txt",
                            "content": "hello from agent task"
                        },
                        {
                            "kind": "read",
                            "path": "agent-task/full-access.txt"
                        }
                    ]
                }
            }),
        )
        .await;

        assert_eq!(start_payload["ok"], Value::Bool(true));
        let task_id = runtime_run_task_id(&start_payload);

        let status_payload =
            wait_for_agent_task_terminal_status(app.clone(), task_id.as_str(), &["completed"])
                .await;
        assert_eq!(status_payload["ok"], Value::Bool(true));
        assert_eq!(
            status_payload["result"]["status"],
            Value::String("completed".to_string())
        );
        assert_eq!(
            status_payload["result"]["steps"][0]["status"],
            Value::String("completed".to_string())
        );
        assert_eq!(
            status_payload["result"]["steps"][1]["status"],
            Value::String("completed".to_string())
        );
        assert_eq!(
            status_payload["result"]["steps"][2]["status"],
            Value::String("completed".to_string())
        );
        assert_eq!(
            fs::read_to_string(target_path.as_path()).expect("read final full-access file"),
            "hello from agent task"
        );

        let _ = fs::remove_dir_all(workspace_path.as_path());
        });
    }

    #[tokio::test]
    async fn runtime_run_start_v2_requires_approved_plan_version() {
        let app = test_router();
        let start_payload = send_rpc_request_raw(
            app.clone(),
            json!({
                "method": "code_runtime_run_start_v2",
                "params": {
                    "workspaceId": "workspace-web",
                    "accessMode": "full-access",
                    "steps": [{
                        "kind": "read",
                        "path": "AGENTS.md"
                    }]
                }
            }),
        )
        .await;

        assert_eq!(start_payload["ok"], Value::Bool(false));
        assert_eq!(
            start_payload["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );
        assert!(
            start_payload["error"]["message"]
                .as_str()
                .is_some_and(|message| message.contains("approvedPlanVersion is required")),
            "unexpected error payload: {start_payload}"
        );
    }

    #[test]
    fn agent_task_write_requires_prior_read_of_same_path() {
        run_async_test_on_large_stack(async move {
            let app = test_router();
            let workspace_id = format!("workspace-web-{}", rand::random::<u64>());
            let workspace_path = PathBuf::from(format!("/tmp/{workspace_id}"));
            let _ = fs::remove_dir_all(workspace_path.as_path());

            let start_payload = send_rpc_request(
                app.clone(),
                json!({
                    "method": "code_runtime_run_start_v2",
                    "params": {
                        "workspaceId": workspace_id,
                        "accessMode": "full-access",
                        "steps": [
                            {
                                "kind": "write",
                                "path": "agent-task/no-read-write.txt",
                                "content": "mutation without read",
                                "requiresApproval": false
                            }
                        ]
                    }
                }),
            )
            .await;
            assert_eq!(start_payload["ok"], Value::Bool(true));
            let task_id = runtime_run_task_id(&start_payload);

            let failed_payload =
                wait_for_agent_task_terminal_status(app.clone(), task_id.as_str(), &["failed"])
                    .await;
            assert_eq!(
                failed_payload["result"]["errorCode"],
                Value::String("STEP_REQUIRES_FRESH_READ".to_string())
            );
            assert_eq!(
                failed_payload["result"]["steps"][0]["errorCode"],
                Value::String("STEP_REQUIRES_FRESH_READ".to_string())
            );
            assert_eq!(
                failed_payload["result"]["steps"][0]["metadata"]["path"],
                Value::String("agent-task/no-read-write.txt".to_string())
            );
            assert_eq!(
                failed_payload["result"]["steps"][0]["metadata"]["requiresFreshRead"],
                Value::Bool(false)
            );
            assert!(!workspace_path.join("agent-task/no-read-write.txt").exists());

            let _ = fs::remove_dir_all(workspace_path.as_path());
        });
    }

    #[test]
    fn agent_task_edit_requires_prior_read_of_same_path() {
        run_async_test_on_large_stack(async move {
            let app = test_router();
            let workspace_id = format!("workspace-web-{}", rand::random::<u64>());
            let workspace_path = PathBuf::from(format!("/tmp/{workspace_id}"));
            let target_path = workspace_path.join("agent-task/no-read-edit.txt");
            let _ = fs::remove_dir_all(workspace_path.as_path());
            let workspace_create = send_rpc_request(
                app.clone(),
                json!({
                    "method": "code_workspace_create",
                    "params": {
                        "path": workspace_path.display().to_string(),
                        "displayName": "Agent Edit Without Read Workspace"
                    }
                }),
            )
            .await;
            assert_eq!(workspace_create["ok"], Value::Bool(true));
            let workspace_runtime_id = workspace_create["result"]["id"]
                .as_str()
                .expect("workspace runtime id")
                .to_string();
            fs::create_dir_all(
                target_path
                    .parent()
                    .expect("target path parent for edit-without-read"),
            )
            .expect("create target parent");
            fs::write(target_path.as_path(), "before edit").expect("seed target file");

            let start_payload = send_rpc_request(
                app.clone(),
                json!({
                    "method": "code_runtime_run_start_v2",
                    "params": {
                        "workspaceId": workspace_runtime_id,
                        "accessMode": "full-access",
                        "steps": [
                            {
                                "kind": "edit",
                                "path": "agent-task/no-read-edit.txt",
                                "find": "before",
                                "replace": "after",
                                "requiresApproval": false
                            }
                        ]
                    }
                }),
            )
            .await;
            assert_eq!(start_payload["ok"], Value::Bool(true));
            let task_id = runtime_run_task_id(&start_payload);

            let failed_payload =
                wait_for_agent_task_terminal_status(app.clone(), task_id.as_str(), &["failed"])
                    .await;
            assert_eq!(
                failed_payload["result"]["errorCode"],
                Value::String("STEP_REQUIRES_FRESH_READ".to_string())
            );
            assert_eq!(
                failed_payload["result"]["steps"][0]["metadata"]["requiresFreshRead"],
                Value::Bool(false)
            );
            assert_eq!(
                fs::read_to_string(target_path.as_path()).expect("read unmodified target"),
                "before edit"
            );

            let _ = fs::remove_dir_all(workspace_path.as_path());
        });
    }

    #[test]
    fn agent_task_mutation_sequence_succeeds_after_fresh_read() {
        run_async_test_on_large_stack(async move {
        let app = test_router();
        let workspace_id = format!("workspace-web-{}", rand::random::<u64>());
        let workspace_path = PathBuf::from(format!("/tmp/{workspace_id}"));
        let target_path = workspace_path.join("agent-task/fresh-read-success.txt");
        let _ = fs::remove_dir_all(workspace_path.as_path());
        let workspace_create = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_workspace_create",
                "params": {
                    "path": workspace_path.display().to_string(),
                    "displayName": "Agent Fresh Read Workspace"
                }
            }),
        )
        .await;
        assert_eq!(workspace_create["ok"], Value::Bool(true));
        let workspace_runtime_id = workspace_create["result"]["id"]
            .as_str()
            .expect("workspace runtime id")
            .to_string();
        fs::create_dir_all(
            target_path
                .parent()
                .expect("target path parent for fresh-read-success"),
        )
        .expect("create target parent");
        fs::write(target_path.as_path(), "phase-one").expect("seed target file");

        let start_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_start_v2",
                "params": {
                    "workspaceId": workspace_runtime_id,
                    "accessMode": "full-access",
                    "steps": [
                        {
                            "kind": "read",
                            "path": "agent-task/fresh-read-success.txt"
                        },
                        {
                            "kind": "write",
                            "path": "agent-task/fresh-read-success.txt",
                            "content": "phase-two",
                            "requiresApproval": false
                        },
                        {
                            "kind": "read",
                            "path": "agent-task/fresh-read-success.txt"
                        },
                        {
                            "kind": "edit",
                            "path": "agent-task/fresh-read-success.txt",
                            "find": "phase-two",
                            "replace": "phase-three",
                            "requiresApproval": false
                        }
                    ]
                }
            }),
        )
        .await;
        assert_eq!(start_payload["ok"], Value::Bool(true));
        let task_id = runtime_run_task_id(&start_payload);

        let status_payload =
            wait_for_agent_task_terminal_status(app.clone(), task_id.as_str(), &["completed"])
                .await;
        assert_eq!(
            status_payload["result"]["status"],
            Value::String("completed".to_string())
        );
        assert_eq!(
            fs::read_to_string(target_path.as_path()).expect("read final target"),
            "phase-three"
        );

        let _ = fs::remove_dir_all(workspace_path.as_path());
        });
    }

    #[test]
    fn agent_task_edit_after_write_requires_fresh_read() {
        run_async_test_on_large_stack(async move {
        let app = test_router();
        let workspace_id = format!("workspace-web-{}", rand::random::<u64>());
        let workspace_path = PathBuf::from(format!("/tmp/{workspace_id}"));
        let target_path = workspace_path.join("agent-task/stale-read-edit.txt");
        let _ = fs::remove_dir_all(workspace_path.as_path());
        let workspace_create = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_workspace_create",
                "params": {
                    "path": workspace_path.display().to_string(),
                    "displayName": "Agent Stale Read Workspace"
                }
            }),
        )
        .await;
        assert_eq!(workspace_create["ok"], Value::Bool(true));
        let workspace_runtime_id = workspace_create["result"]["id"]
            .as_str()
            .expect("workspace runtime id")
            .to_string();
        fs::create_dir_all(
            target_path
                .parent()
                .expect("target path parent for stale-read-edit"),
        )
        .expect("create target parent");
        fs::write(target_path.as_path(), "phase-one").expect("seed target file");

        let start_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_start_v2",
                "params": {
                    "workspaceId": workspace_runtime_id,
                    "accessMode": "full-access",
                    "steps": [
                        {
                            "kind": "read",
                            "path": "agent-task/stale-read-edit.txt"
                        },
                        {
                            "kind": "write",
                            "path": "agent-task/stale-read-edit.txt",
                            "content": "phase-two",
                            "requiresApproval": false
                        },
                        {
                            "kind": "edit",
                            "path": "agent-task/stale-read-edit.txt",
                            "find": "phase-two",
                            "replace": "phase-three",
                            "requiresApproval": false
                        }
                    ]
                }
            }),
        )
        .await;
        assert_eq!(start_payload["ok"], Value::Bool(true));
        let task_id = runtime_run_task_id(&start_payload);

        let failed_payload =
            wait_for_agent_task_terminal_status(app.clone(), task_id.as_str(), &["failed"]).await;
        assert_eq!(
            failed_payload["result"]["errorCode"],
            Value::String("STEP_REQUIRES_FRESH_READ".to_string())
        );
        assert_eq!(
            failed_payload["result"]["steps"][2]["errorCode"],
            Value::String("STEP_REQUIRES_FRESH_READ".to_string())
        );
        assert_eq!(
            failed_payload["result"]["steps"][2]["metadata"]["requiresFreshRead"],
            Value::Bool(true)
        );
        assert_eq!(
            fs::read_to_string(target_path.as_path()).expect("read final target"),
            "phase-two"
        );

        let _ = fs::remove_dir_all(workspace_path.as_path());
        });
    }

    #[cfg(unix)]
    #[test]
    fn agent_task_start_reuses_active_request_id() {
        run_async_test_on_large_stack(async move {
        let app = test_router();
        let first_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_start_v2",
                "params": {
                    "workspaceId": "workspace-web",
                    "requestId": "request-dedupe-1",
                    "accessMode": "full-access",
                    "steps": [
                        {
                            "kind": "bash",
                            "command": "sleep 0.8 && echo dedupe-first",
                            "requiresApproval": false
                        }
                    ]
                }
            }),
        )
        .await;
        assert_eq!(first_payload["ok"], Value::Bool(true));
        let first_task_id = runtime_run_task_id(&first_payload);

        let second_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_start_v2",
                "params": {
                    "workspaceId": "workspace-web",
                    "requestId": "request-dedupe-1",
                    "accessMode": "full-access",
                    "steps": [
                        {
                            "kind": "bash",
                            "command": "echo dedupe-second",
                            "requiresApproval": false
                        }
                    ]
                }
            }),
        )
        .await;
        assert_eq!(second_payload["ok"], Value::Bool(true));
        assert_eq!(
            runtime_run_record(&second_payload)["taskId"],
            Value::String(first_task_id.clone())
        );

        let terminal_payload =
            wait_for_agent_task_terminal_status(app.clone(), first_task_id.as_str(), &["completed"])
                .await;
        assert_eq!(
            terminal_payload["result"]["status"],
            Value::String("completed".to_string())
        );
        });
    }

    #[test]
    fn agent_task_requires_approval_and_rejects_when_denied() {
        run_async_test_on_large_stack(async move {
        let app = test_router();
        let workspace_id = format!("workspace-web-{}", rand::random::<u64>());
        let workspace_path = PathBuf::from(format!("/tmp/{workspace_id}"));
        let target_path = workspace_path.join("agent-task/needs-approval.txt");
        let _ = fs::remove_dir_all(workspace_path.as_path());
        let workspace_create = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_workspace_create",
                "params": {
                    "path": workspace_path.display().to_string(),
                    "displayName": "Agent Approval Workspace"
                }
            }),
        )
        .await;
        assert_eq!(workspace_create["ok"], Value::Bool(true));
        let workspace_runtime_id = workspace_create["result"]["id"]
            .as_str()
            .expect("workspace runtime id")
            .to_string();
        fs::create_dir_all(
            target_path
                .parent()
                .expect("target path parent for approval test"),
        )
        .expect("create target parent");
        fs::write(target_path.as_path(), "before approval").expect("seed target file");

        let start_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_start_v2",
                "params": {
                    "workspaceId": workspace_runtime_id,
                    "steps": [
                        {
                            "kind": "read",
                            "path": "agent-task/needs-approval.txt"
                        },
                        {
                            "kind": "write",
                            "path": "agent-task/needs-approval.txt",
                            "content": "should not be written"
                        }
                    ]
                }
            }),
        )
        .await;

        assert_eq!(start_payload["ok"], Value::Bool(true));
        let task_id = runtime_run_task_id(&start_payload);

        let awaiting_payload = wait_for_agent_task_terminal_status(
            app.clone(),
            task_id.as_str(),
            &["awaiting_approval"],
        )
        .await;
        let approval_id = awaiting_payload["result"]["pendingApprovalId"]
            .as_str()
            .expect("approval id")
            .to_string();

        let approval_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_checkpoint_approval",
                "params": {
                    "approvalId": approval_id,
                    "decision": "rejected",
                    "reason": "blocked in test"
                }
            }),
        )
        .await;
        assert_eq!(approval_payload["ok"], Value::Bool(true));
        assert_eq!(approval_payload["result"]["recorded"], Value::Bool(true));

        let failed_payload =
            wait_for_agent_task_terminal_status(app.clone(), task_id.as_str(), &["failed"]).await;
        assert_eq!(
            failed_payload["result"]["errorCode"],
            Value::String("APPROVAL_REJECTED".to_string())
        );
        assert_eq!(
            fs::read_to_string(target_path.as_path()).expect("read approval target"),
            "before approval"
        );

        let _ = fs::remove_dir_all(workspace_path.as_path());
        });
    }

    #[test]
    fn agent_task_reuses_file_target_approval_after_fresh_read() {
        run_async_test_on_large_stack(async move {
        let app = test_router();
        let workspace_id = format!("workspace-web-{}", rand::random::<u64>());
        let workspace_path = PathBuf::from(format!("/tmp/{workspace_id}"));
        let target_path = workspace_path.join("agent-task/reuse-scope.txt");
        let _ = fs::remove_dir_all(workspace_path.as_path());
        let workspace_create = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_workspace_create",
                "params": {
                    "path": workspace_path.display().to_string(),
                    "displayName": "Agent Approval Scope Reuse Workspace"
                }
            }),
        )
        .await;
        assert_eq!(workspace_create["ok"], Value::Bool(true));
        let workspace_runtime_id = workspace_create["result"]["id"]
            .as_str()
            .expect("workspace runtime id")
            .to_string();
        fs::create_dir_all(
            target_path
                .parent()
                .expect("target path parent for scope reuse test"),
        )
        .expect("create scope reuse parent");
        fs::write(target_path.as_path(), "before approval").expect("seed scope reuse target");

        let start_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_start_v2",
                "params": {
                    "workspaceId": workspace_runtime_id,
                    "steps": [
                        {
                            "kind": "read",
                            "path": "agent-task/reuse-scope.txt"
                        },
                        {
                            "kind": "edit",
                            "path": "agent-task/reuse-scope.txt",
                            "find": "before approval",
                            "replace": "after first approval"
                        },
                        {
                            "kind": "read",
                            "path": "agent-task/reuse-scope.txt"
                        },
                        {
                            "kind": "edit",
                            "path": "agent-task/reuse-scope.txt",
                            "find": "after first approval",
                            "replace": "after reused approval"
                        }
                    ]
                }
            }),
        )
        .await;
        assert_eq!(start_payload["ok"], Value::Bool(true));
        let task_id = runtime_run_task_id(&start_payload);

        let awaiting_payload = wait_for_agent_task_terminal_status(
            app.clone(),
            task_id.as_str(),
            &["awaiting_approval"],
        )
        .await;
        let approval_id = awaiting_payload["result"]["pendingApprovalId"]
            .as_str()
            .expect("approval id")
            .to_string();

        let approval_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_checkpoint_approval",
                "params": {
                    "approvalId": approval_id,
                    "decision": "approved",
                    "reason": "allow same file edits"
                }
            }),
        )
        .await;
        assert_eq!(approval_payload["ok"], Value::Bool(true));
        assert_eq!(approval_payload["result"]["recorded"], Value::Bool(true));

        let completed_payload =
            wait_for_agent_task_terminal_status(app.clone(), task_id.as_str(), &["completed"])
                .await;
        assert_eq!(
            completed_payload["result"]["status"],
            Value::String("completed".to_string())
        );
        assert_eq!(
            fs::read_to_string(target_path.as_path()).expect("read scope reuse target"),
            "after reused approval"
        );
        assert!(
            completed_payload["result"]["steps"][1]["approvalId"]
                .as_str()
                .is_some()
        );
        assert_eq!(completed_payload["result"]["steps"][3]["approvalId"], Value::Null);
        assert_eq!(
            completed_payload["result"]["steps"][1]["metadata"]["approval"]["scopeKind"],
            Value::String("file-target".to_string())
        );
        assert_eq!(
            completed_payload["result"]["steps"][1]["metadata"]["approval"]["requestSource"],
            Value::String("capability_default".to_string())
        );
        assert_eq!(
            completed_payload["result"]["steps"][1]["metadata"]["approval"]["requestReason"],
            Value::String("Destructive operation requires approval.".to_string())
        );
        assert_eq!(
            completed_payload["result"]["steps"][1]["metadata"]["approval"]["resolutionStatus"],
            Value::String("approved".to_string())
        );
        assert_eq!(
            completed_payload["result"]["steps"][1]["metadata"]["approval"]["resolutionReason"],
            Value::String("allow same file edits".to_string())
        );
        assert_eq!(
            completed_payload["result"]["steps"][1]["metadata"]["approval"]["resolutionAction"],
            Value::String("edit".to_string())
        );
        assert_eq!(
            completed_payload["result"]["steps"][1]["metadata"]["inspector"]["decision"],
            Value::String("allow".to_string())
        );
        assert_eq!(
            completed_payload["result"]["steps"][3]["metadata"]["approval"]["reused"],
            Value::Bool(true)
        );
        assert_eq!(
            completed_payload["result"]["steps"][1]["metadata"]["approval"]["scopeKey"],
            completed_payload["result"]["steps"][3]["metadata"]["approval"]["scopeKey"]
        );

        let _ = fs::remove_dir_all(workspace_path.as_path());
        });
    }

    #[test]
    fn agent_task_file_target_approval_does_not_cross_paths() {
        run_async_test_on_large_stack(async move {
        let app = test_router();
        let workspace_id = format!("workspace-web-{}", rand::random::<u64>());
        let workspace_path = PathBuf::from(format!("/tmp/{workspace_id}"));
        let first_target_path = workspace_path.join("agent-task/first-scope.txt");
        let second_target_path = workspace_path.join("agent-task/second-scope.txt");
        let _ = fs::remove_dir_all(workspace_path.as_path());
        let workspace_create = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_workspace_create",
                "params": {
                    "path": workspace_path.display().to_string(),
                    "displayName": "Agent Approval Scope Isolation Workspace"
                }
            }),
        )
        .await;
        assert_eq!(workspace_create["ok"], Value::Bool(true));
        let workspace_runtime_id = workspace_create["result"]["id"]
            .as_str()
            .expect("workspace runtime id")
            .to_string();
        fs::create_dir_all(
            first_target_path
                .parent()
                .expect("target path parent for scope isolation test"),
        )
        .expect("create scope isolation parent");
        fs::write(first_target_path.as_path(), "first before").expect("seed first target");
        fs::write(second_target_path.as_path(), "second before").expect("seed second target");

        let start_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_start_v2",
                "params": {
                    "workspaceId": workspace_runtime_id,
                    "steps": [
                        {
                            "kind": "read",
                            "path": "agent-task/first-scope.txt"
                        },
                        {
                            "kind": "edit",
                            "path": "agent-task/first-scope.txt",
                            "find": "first before",
                            "replace": "first after"
                        },
                        {
                            "kind": "read",
                            "path": "agent-task/second-scope.txt"
                        },
                        {
                            "kind": "edit",
                            "path": "agent-task/second-scope.txt",
                            "find": "second before",
                            "replace": "second after"
                        }
                    ]
                }
            }),
        )
        .await;
        assert_eq!(start_payload["ok"], Value::Bool(true));
        let task_id = runtime_run_task_id(&start_payload);

        let first_awaiting = wait_for_agent_task_terminal_status(
            app.clone(),
            task_id.as_str(),
            &["awaiting_approval"],
        )
        .await;
        let first_approval_id = first_awaiting["result"]["pendingApprovalId"]
            .as_str()
            .expect("first approval id")
            .to_string();

        let first_approval_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_checkpoint_approval",
                "params": {
                    "approvalId": first_approval_id,
                    "decision": "approved",
                    "reason": "allow first file edit"
                }
            }),
        )
        .await;
        assert_eq!(first_approval_payload["ok"], Value::Bool(true));
        assert_eq!(first_approval_payload["result"]["recorded"], Value::Bool(true));

        let second_awaiting = tokio::time::timeout(Duration::from_secs(3), async {
            loop {
                let status_payload = send_rpc_request(
                    app.clone(),
                    json!({
                        "method": "code_runtime_run_subscribe_v2",
                        "params": {
                            "runId": task_id,
                        }
                    }),
                )
                .await;
                let run_record = runtime_run_record(&status_payload);
                let status = run_record["status"].as_str().unwrap_or_default();
                let pending_approval_id = run_record["pendingApprovalId"]
                    .as_str()
                    .unwrap_or_default();
                if status == "awaiting_approval"
                    && !pending_approval_id.is_empty()
                    && pending_approval_id != first_approval_id
                {
                    return normalize_runtime_run_payload(status_payload);
                }
                tokio::time::sleep(Duration::from_millis(25)).await;
            }
        })
        .await
        .expect("second approval should appear");
        let second_approval_id = second_awaiting["result"]["pendingApprovalId"]
            .as_str()
            .expect("second approval id")
            .to_string();
        assert_ne!(first_approval_id, second_approval_id);

        let second_approval_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_checkpoint_approval",
                "params": {
                    "approvalId": second_approval_id,
                    "decision": "approved",
                    "reason": "allow second file edit"
                }
            }),
        )
        .await;
        assert_eq!(second_approval_payload["ok"], Value::Bool(true));
        assert_eq!(second_approval_payload["result"]["recorded"], Value::Bool(true));

        let completed_payload =
            wait_for_agent_task_terminal_status(app.clone(), task_id.as_str(), &["completed"])
                .await;
        assert_eq!(
            completed_payload["result"]["status"],
            Value::String("completed".to_string())
        );
        assert_eq!(
            completed_payload["result"]["steps"][3]["metadata"]["approval"]["reused"],
            Value::Bool(false)
        );
        assert_ne!(
            completed_payload["result"]["steps"][1]["metadata"]["approval"]["scopeKey"],
            completed_payload["result"]["steps"][3]["metadata"]["approval"]["scopeKey"]
        );

        let _ = fs::remove_dir_all(workspace_path.as_path());
        });
    }

    #[test]
    fn agent_task_reuses_safe_bash_prefix_approval_within_same_task() {
        run_async_test_on_large_stack(async move {
        let app = test_router();
        let workspace_id = format!("workspace-web-{}", rand::random::<u64>());
        let workspace_path = PathBuf::from(format!("/tmp/{workspace_id}"));
        let first_target_path = workspace_path.join("agent-task/bash-first.txt");
        let second_target_path = workspace_path.join("agent-task/bash-second.txt");
        let _ = fs::remove_dir_all(workspace_path.as_path());
        let workspace_create = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_workspace_create",
                "params": {
                    "path": workspace_path.display().to_string(),
                    "displayName": "Agent Bash Approval Scope Reuse Workspace"
                }
            }),
        )
        .await;
        assert_eq!(workspace_create["ok"], Value::Bool(true));
        let workspace_runtime_id = workspace_create["result"]["id"]
            .as_str()
            .expect("workspace runtime id")
            .to_string();
        fs::create_dir_all(
            first_target_path
                .parent()
                .expect("target path parent for bash scope reuse test"),
        )
        .expect("create bash scope reuse parent");
        fs::write(first_target_path.as_path(), "bash first line").expect("seed first bash file");
        fs::write(second_target_path.as_path(), "bash second line")
            .expect("seed second bash file");

        let start_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_start_v2",
                "params": {
                    "workspaceId": workspace_runtime_id,
                    "steps": [
                        {
                            "kind": "bash",
                            "command": "cat agent-task/bash-first.txt"
                        },
                        {
                            "kind": "bash",
                            "command": "cat agent-task/bash-second.txt"
                        }
                    ]
                }
            }),
        )
        .await;
        assert_eq!(start_payload["ok"], Value::Bool(true));
        let task_id = runtime_run_task_id(&start_payload);

        let awaiting_payload = wait_for_agent_task_terminal_status(
            app.clone(),
            task_id.as_str(),
            &["awaiting_approval"],
        )
        .await;
        let approval_id = awaiting_payload["result"]["pendingApprovalId"]
            .as_str()
            .expect("approval id")
            .to_string();

        let approval_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_checkpoint_approval",
                "params": {
                    "approvalId": approval_id,
                    "decision": "approved",
                    "reason": "allow safe cat commands"
                }
            }),
        )
        .await;
        assert_eq!(approval_payload["ok"], Value::Bool(true));
        assert_eq!(approval_payload["result"]["recorded"], Value::Bool(true));

        let completed_payload =
            wait_for_agent_task_terminal_status(app.clone(), task_id.as_str(), &["completed"])
                .await;
        assert_eq!(
            completed_payload["result"]["status"],
            Value::String("completed".to_string())
        );
        assert!(
            completed_payload["result"]["steps"][0]["approvalId"]
                .as_str()
                .is_some()
        );
        assert_eq!(completed_payload["result"]["steps"][1]["approvalId"], Value::Null);
        assert_eq!(
            completed_payload["result"]["steps"][0]["metadata"]["approval"]["scopeKind"],
            Value::String("command-prefix".to_string())
        );
        assert_eq!(
            completed_payload["result"]["steps"][1]["metadata"]["approval"]["reused"],
            Value::Bool(true)
        );
        assert_eq!(
            completed_payload["result"]["steps"][0]["metadata"]["approval"]["scopeKey"],
            completed_payload["result"]["steps"][1]["metadata"]["approval"]["scopeKey"]
        );
        assert_eq!(
            completed_payload["result"]["steps"][0]["metadata"]["approval"]["scopeTarget"],
            Value::String("cat".to_string())
        );
        assert_eq!(
            completed_payload["result"]["steps"][1]["output"],
            Value::String("bash second line".to_string())
        );

        let _ = fs::remove_dir_all(workspace_path.as_path());
        });
    }

    #[test]
    fn agent_task_safe_bash_scope_does_not_cross_prefix_or_risky_commands() {
        run_async_test_on_large_stack(async move {
        let app = test_router();
        let workspace_id = format!("workspace-web-{}", rand::random::<u64>());
        let workspace_path = PathBuf::from(format!("/tmp/{workspace_id}"));
        let first_target_path = workspace_path.join("agent-task/bash-first.txt");
        let second_target_path = workspace_path.join("agent-task/bash-second.txt");
        let touch_target_path = workspace_path.join("agent-task/touch-created.txt");
        let _ = fs::remove_dir_all(workspace_path.as_path());
        let workspace_create = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_workspace_create",
                "params": {
                    "path": workspace_path.display().to_string(),
                    "displayName": "Agent Bash Approval Scope Isolation Workspace"
                }
            }),
        )
        .await;
        assert_eq!(workspace_create["ok"], Value::Bool(true));
        let workspace_runtime_id = workspace_create["result"]["id"]
            .as_str()
            .expect("workspace runtime id")
            .to_string();
        fs::create_dir_all(
            first_target_path
                .parent()
                .expect("target path parent for bash scope isolation test"),
        )
        .expect("create bash scope isolation parent");
        fs::write(first_target_path.as_path(), "bash first line").expect("seed first bash file");
        fs::write(second_target_path.as_path(), "bash second line")
            .expect("seed second bash file");

        let start_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_start_v2",
                "params": {
                    "workspaceId": workspace_runtime_id,
                    "steps": [
                        {
                            "kind": "bash",
                            "command": "cat agent-task/bash-first.txt"
                        },
                        {
                            "kind": "bash",
                            "command": "head -n 1 agent-task/bash-second.txt"
                        },
                        {
                            "kind": "bash",
                            "command": "touch agent-task/touch-created.txt"
                        }
                    ]
                }
            }),
        )
        .await;
        assert_eq!(start_payload["ok"], Value::Bool(true));
        let task_id = runtime_run_task_id(&start_payload);

        let first_awaiting = wait_for_agent_task_terminal_status(
            app.clone(),
            task_id.as_str(),
            &["awaiting_approval"],
        )
        .await;
        let first_approval_id = first_awaiting["result"]["pendingApprovalId"]
            .as_str()
            .expect("first approval id")
            .to_string();

        let first_approval_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_checkpoint_approval",
                "params": {
                    "approvalId": first_approval_id,
                    "decision": "approved",
                    "reason": "allow first safe bash command"
                }
            }),
        )
        .await;
        assert_eq!(first_approval_payload["ok"], Value::Bool(true));
        assert_eq!(first_approval_payload["result"]["recorded"], Value::Bool(true));

        let second_awaiting = tokio::time::timeout(Duration::from_secs(3), async {
            loop {
                let status_payload = send_rpc_request(
                    app.clone(),
                    json!({
                        "method": "code_runtime_run_subscribe_v2",
                        "params": {
                            "runId": task_id,
                        }
                    }),
                )
                .await;
                let run_record = runtime_run_record(&status_payload);
                let status = run_record["status"].as_str().unwrap_or_default();
                let pending_approval_id = run_record["pendingApprovalId"]
                    .as_str()
                    .unwrap_or_default();
                if status == "awaiting_approval"
                    && !pending_approval_id.is_empty()
                    && pending_approval_id != first_approval_id
                {
                    return normalize_runtime_run_payload(status_payload);
                }
                tokio::time::sleep(Duration::from_millis(25)).await;
            }
        })
        .await
        .expect("second approval should appear");
        let second_approval_id = second_awaiting["result"]["pendingApprovalId"]
            .as_str()
            .expect("second approval id")
            .to_string();

        let second_approval_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_checkpoint_approval",
                "params": {
                    "approvalId": second_approval_id,
                    "decision": "approved",
                    "reason": "allow second safe bash command"
                }
            }),
        )
        .await;
        assert_eq!(second_approval_payload["ok"], Value::Bool(true));
        assert_eq!(second_approval_payload["result"]["recorded"], Value::Bool(true));

        let third_awaiting = tokio::time::timeout(Duration::from_secs(3), async {
            loop {
                let status_payload = send_rpc_request(
                    app.clone(),
                    json!({
                        "method": "code_runtime_run_subscribe_v2",
                        "params": {
                            "runId": task_id,
                        }
                    }),
                )
                .await;
                let run_record = runtime_run_record(&status_payload);
                let status = run_record["status"].as_str().unwrap_or_default();
                let pending_approval_id = run_record["pendingApprovalId"]
                    .as_str()
                    .unwrap_or_default();
                if status == "awaiting_approval"
                    && !pending_approval_id.is_empty()
                    && pending_approval_id != first_approval_id
                    && pending_approval_id != second_approval_id
                {
                    return normalize_runtime_run_payload(status_payload);
                }
                tokio::time::sleep(Duration::from_millis(25)).await;
            }
        })
        .await
        .expect("third approval should appear");
        let third_approval_id = third_awaiting["result"]["pendingApprovalId"]
            .as_str()
            .expect("third approval id")
            .to_string();
        assert_ne!(second_approval_id, third_approval_id);

        let third_approval_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_checkpoint_approval",
                "params": {
                    "approvalId": third_approval_id,
                    "decision": "approved",
                    "reason": "allow risky touch command explicitly"
                }
            }),
        )
        .await;
        assert_eq!(third_approval_payload["ok"], Value::Bool(true));
        assert_eq!(third_approval_payload["result"]["recorded"], Value::Bool(true));

        let completed_payload =
            wait_for_agent_task_terminal_status(app.clone(), task_id.as_str(), &["completed"])
                .await;
        assert_eq!(
            completed_payload["result"]["status"],
            Value::String("completed".to_string())
        );
        assert_ne!(
            completed_payload["result"]["steps"][0]["metadata"]["approval"]["scopeKey"],
            completed_payload["result"]["steps"][1]["metadata"]["approval"]["scopeKey"]
        );
        assert_eq!(
            completed_payload["result"]["steps"][2]["metadata"]["approval"]["scopeKind"],
            Value::Null
        );
        assert_eq!(
            completed_payload["result"]["steps"][2]["metadata"]["approval"]["reused"],
            Value::Bool(false)
        );
        assert!(touch_target_path.exists());

        let _ = fs::remove_dir_all(workspace_path.as_path());
        });
    }

    #[tokio::test]
    async fn agent_task_start_rejects_snake_case_payload_fields() {
        let app = test_router();
        let start_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_start_v2",
                "params": {
                    "workspace_id": "workspace-web",
                    "access_mode": "full-access",
                    "steps": [
                        {
                            "kind": "bash",
                            "command": "echo agent-step",
                            "timeout_ms": 2_000,
                            "requires_approval": false
                        }
                    ]
                }
            }),
        )
        .await;

        assert_eq!(start_payload["ok"], Value::Bool(false));
        assert_eq!(
            start_payload["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );
    }

    #[cfg(unix)]
    #[test]
    fn agent_task_step_timeout_fails_task() {
        run_async_test_on_large_stack(async move {
        let app = test_router();
        let start_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_start_v2",
                "params": {
                    "workspaceId": "workspace-web",
                    "accessMode": "full-access",
                    "steps": [
                        {
                            "kind": "bash",
                            "command": "sleep 1.0 && echo too-slow",
                            "timeoutMs": 50,
                            "requiresApproval": false
                        }
                    ]
                }
            }),
        )
        .await;

        assert_eq!(start_payload["ok"], Value::Bool(true));
        let task_id = runtime_run_task_id(&start_payload);

        let status_payload =
            wait_for_agent_task_terminal_status(app.clone(), task_id.as_str(), &["failed"]).await;
        assert_eq!(status_payload["ok"], Value::Bool(true));
        assert_eq!(
            status_payload["result"]["status"],
            Value::String("failed".to_string())
        );
        assert_ne!(
            status_payload["result"]["steps"][0]["status"],
            Value::String("completed".to_string())
        );
        });
    }

    #[test]
    fn agent_task_start_distributed_selects_backend_by_capability() {
        run_async_test_on_large_stack(async move {
        let app = test_router();
        let _ = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_backend_upsert",
                "params": {
                    "backendId": "worker-plan",
                    "displayName": "Planner Worker",
                    "capabilities": ["plan"],
                    "maxConcurrency": 4,
                    "costTier": "standard",
                    "latencyClass": "regional",
                    "rolloutState": "current",
                    "status": "active"
                }
            }),
        )
        .await;
        let _ = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_backend_upsert",
                "params": {
                    "backendId": "worker-code",
                    "displayName": "Coder Worker",
                    "capabilities": ["code", "verify"],
                    "maxConcurrency": 8,
                    "costTier": "standard",
                    "latencyClass": "regional",
                    "rolloutState": "current",
                    "status": "active"
                }
            }),
        )
        .await;

        let start_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_start_v2",
                "params": {
                    "workspaceId": "workspace-web",
                    "executionMode": "distributed",
                    "requiredCapabilities": ["code"],
                    "steps": [
                        {
                            "kind": "read",
                            "input": "distributed placement test"
                        }
                    ]
                }
            }),
        )
        .await;
        assert_eq!(start_payload["ok"], Value::Bool(true));
        assert_eq!(
            start_payload["result"]["missionRun"]["operatorSnapshot"]["backendId"],
            Value::String("worker-code".to_string())
        );
        });
    }

    #[test]
    fn agent_task_start_distributed_prefers_preferred_backends_and_falls_back() {
        run_async_test_on_large_stack(async move {
        let app = test_router();
        let _ = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_backend_upsert",
                "params": {
                    "backendId": "worker-a",
                    "displayName": "Worker A",
                    "capabilities": ["code"],
                    "maxConcurrency": 4,
                    "costTier": "standard",
                    "latencyClass": "regional",
                    "rolloutState": "current",
                    "status": "active"
                }
            }),
        )
        .await;
        let _ = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_backend_upsert",
                "params": {
                    "backendId": "worker-b",
                    "displayName": "Worker B",
                    "capabilities": ["code"],
                    "maxConcurrency": 4,
                    "costTier": "standard",
                    "latencyClass": "regional",
                    "rolloutState": "current",
                    "status": "active"
                }
            }),
        )
        .await;

        let preferred_start = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_start_v2",
                "params": {
                    "workspaceId": "workspace-web",
                    "executionMode": "distributed",
                    "requiredCapabilities": ["code"],
                    "preferredBackendIds": ["worker-b"],
                    "steps": [
                        {
                            "kind": "read",
                            "input": "preferred placement test"
                        }
                    ]
                }
            }),
        )
        .await;
        assert_eq!(preferred_start["ok"], Value::Bool(true));
        assert_eq!(
            preferred_start["result"]["missionRun"]["operatorSnapshot"]["backendId"],
            Value::String("worker-b".to_string())
        );

        let fallback_start = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_start_v2",
                "params": {
                    "workspaceId": "workspace-web",
                    "executionMode": "distributed",
                    "requiredCapabilities": ["code"],
                    "preferredBackendIds": ["worker-unknown"],
                    "steps": [
                        {
                            "kind": "read",
                            "input": "fallback placement test"
                        }
                    ]
                }
            }),
        )
        .await;
        assert_eq!(fallback_start["ok"], Value::Bool(true));
        assert_eq!(
            fallback_start["result"]["missionRun"]["operatorSnapshot"]["backendId"],
            Value::String("worker-a".to_string())
        );
        });
    }

    #[test]
    fn agent_task_start_enriches_autodrive_mission_brief_from_workspace_context() {
        run_async_test_on_large_stack(async move {
        let app = test_router();
        let workspace_id = format!("workspace-web-{}", rand::random::<u64>());
        let workspace_path = PathBuf::from(format!("/tmp/{workspace_id}"));
        let _ = fs::remove_dir_all(workspace_path.as_path());
        fs::create_dir_all(workspace_path.join(".hugecode")).expect("create contract dir");
        fs::create_dir_all(workspace_path.join(".codex")).expect("create codex dir");
        fs::create_dir_all(workspace_path.join("tests")).expect("create tests dir");
        fs::create_dir_all(workspace_path.join("fixtures")).expect("create fixtures dir");
        fs::write(
            workspace_path.join("AGENTS.md"),
            "# Agent Rules\n- Run validate:fast before signoff.\n- Keep runtime-first boundaries.\n",
        )
        .expect("write AGENTS.md");
        fs::write(
            workspace_path.join(".codex/e2e-map.json"),
            json!({
                "default": "test:e2e:smoke"
            })
            .to_string(),
        )
        .expect("write e2e map");
        fs::write(
            workspace_path.join("package.json"),
            json!({
                "name": "autodrive-launch-fixture",
                "private": true,
                "scripts": {
                    "test": "pnpm test",
                    "test:component": "pnpm test:component",
                    "test:e2e:smoke": "pnpm test:e2e:smoke",
                    "validate:fast": "pnpm validate:fast",
                    "validate": "pnpm validate",
                    "preflight:codex": "pnpm preflight:codex"
                }
            })
            .to_string(),
        )
        .expect("write package json");
        fs::write(
            workspace_path.join(".hugecode/repository-execution-contract.json"),
            json!({
                "version": 1,
                "defaults": {
                    "executionProfileId": "balanced-delegate",
                    "validationPresetId": "standard"
                },
                "validationPresets": [
                    { "id": "standard", "label": "Standard" }
                ],
                "reviewProfiles": []
            })
            .to_string(),
        )
        .expect("write repository execution contract");

        let workspace_create = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_workspace_create",
                "params": {
                    "path": workspace_path.display().to_string(),
                    "displayName": "AutoDrive Launch Workspace"
                }
            }),
        )
        .await;
        assert_eq!(workspace_create["ok"], Value::Bool(true));
        let workspace_runtime_id = workspace_create["result"]["id"]
            .as_str()
            .expect("workspace runtime id")
            .to_string();

        let peer_workspace_id = format!("workspace-peer-{}", rand::random::<u64>());
        let peer_workspace_path = PathBuf::from(format!("/tmp/{peer_workspace_id}"));
        let _ = fs::remove_dir_all(peer_workspace_path.as_path());
        fs::create_dir_all(peer_workspace_path.as_path()).expect("create peer workspace");
        let peer_workspace_create = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_workspace_create",
                "params": {
                    "path": peer_workspace_path.display().to_string(),
                    "displayName": "Peer Workspace"
                }
            }),
        )
        .await;
        assert_eq!(peer_workspace_create["ok"], Value::Bool(true));

        let prepare_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_prepare_v2",
                "params": {
                    "workspaceId": workspace_runtime_id,
                    "title": "Ship runtime truth",
                    "taskSource": {
                        "kind": "autodrive",
                        "label": "AutoDrive Mission Control",
                        "shortLabel": "AutoDrive",
                        "externalId": "autodrive:workspace-runtime"
                    },
                    "autoDrive": {
                        "enabled": true,
                        "destination": {
                            "title": "Ship runtime truth",
                            "desiredEndState": ["Runtime-backed controls"],
                            "doneDefinition": {
                                "arrivalCriteria": ["Controls use runtime truth"],
                                "requiredValidation": ["Validation"],
                                "waypointIndicators": ["Progress"]
                            },
                            "hardBoundaries": ["Do not widen scope"],
                            "routePreference": "balanced"
                        },
                        "riskPolicy": {
                            "allowValidationCommands": true,
                            "allowNetworkAnalysis": true,
                            "minimumConfidence": "medium"
                        }
                    },
                    "steps": [
                        {
                            "kind": "read",
                            "input": "AutoDrive destination: Ship runtime truth"
                        }
                    ]
                }
            }),
        )
        .await;

        assert_eq!(prepare_payload["ok"], Value::Bool(true));
        assert_eq!(
            prepare_payload["result"]["runIntent"]["taskSource"]["kind"],
            Value::String("autodrive".to_string())
        );
        assert_eq!(
            prepare_payload["result"]["runIntent"]["executionProfileId"],
            Value::String("balanced-delegate".to_string())
        );
        assert_eq!(
            prepare_payload["result"]["runIntent"]["validationPresetId"],
            Value::String("standard".to_string())
        );
        assert_eq!(
            prepare_payload["result"]["contextPlane"]["workingSetPolicy"]["retentionMode"],
            Value::String("window_and_memory".to_string())
        );
        assert_eq!(
            prepare_payload["result"]["toolingPlane"]["sandboxRef"]["toolPosture"],
            Value::String("workspace_safe".to_string())
        );
        assert_eq!(
            prepare_payload["result"]["toolingPlane"]["sandboxRef"]["approvalSensitivity"],
            Value::String("standard".to_string())
        );
        assert!(
            prepare_payload["result"]["toolingPlane"]["capabilityCatalog"]["capabilities"]
                .as_array()
                .expect("tooling plane capabilities")
                .iter()
                .any(|entry| entry.get("id").and_then(Value::as_str) == Some("runtime.tooling"))
        );
        assert_eq!(
            prepare_payload["result"]["toolingPlane"]["invocationCatalogRef"]["execution"]["bindings"][0]["bindingKind"],
            Value::String("runtime_run".to_string())
        );
        assert!(
            prepare_payload["result"]["contextPlane"]["artifactRefs"]
                .as_array()
                .expect("context plane artifact refs")
                .iter()
                .any(|entry| {
                    entry.get("id").and_then(Value::as_str)
                        == Some("validation-plan:standard")
                })
        );
        assert!(
            prepare_payload["result"]["evalPlane"]["evalCases"]
                .as_array()
                .expect("eval plane cases")
                .iter()
                .any(|entry| {
                    entry.get("id").and_then(Value::as_str)
                        == Some("launch:balanced-delegate")
                })
        );
        assert_eq!(
            prepare_payload["result"]["evalPlane"]["modelReleasePlaybook"]
                .as_array()
                .map(Vec::len),
            Some(3)
        );
        assert_eq!(
            prepare_payload["result"]["validationPlan"]["commands"],
            json!(["pnpm validate:fast", "pnpm test:component"])
        );
        assert_eq!(
            prepare_payload["result"]["validationPlan"]["required"],
            Value::Bool(true)
        );
        assert!(prepare_payload["result"]["executionEligibility"]["eligible"].is_boolean());
        assert!(prepare_payload["result"]["executionEligibility"]["summary"].is_string());
        assert!(prepare_payload["result"]["executionEligibility"]["wakeState"].is_string());
        assert!(prepare_payload["result"]["wakePolicySummary"]["summary"].is_string());
        assert!(prepare_payload["result"]["plan"]["planVersion"].is_string());
        assert!(prepare_payload["result"]["autonomyProfile"].is_string());
        assert!(prepare_payload["result"]["wakePolicy"]["mode"].is_string());
        assert!(prepare_payload["result"]["intentSnapshot"]["primaryGoal"].is_string());
        assert!(prepare_payload["result"]["opportunityQueue"]["selectionSummary"].is_string());
        assert!(prepare_payload["result"]["researchTrace"]["mode"].is_string());
        assert_eq!(
            prepare_payload["result"]["reviewFocus"].as_array().map(Vec::len),
            Some(3)
        );
        assert!(prepare_payload["result"]["guidanceStack"]["summary"].is_string());
        assert!(prepare_payload["result"]["delegationContract"].is_object());
        assert!(prepare_payload["result"]["delegationContract"]["summary"].is_string());
        assert_eq!(
            prepare_payload["result"]["delegationPlan"]["fanOutReady"],
            Value::Bool(true)
        );
        assert_eq!(
            prepare_payload["result"]["delegationPlan"]["reviewRequired"],
            Value::Bool(true)
        );
        assert_eq!(
            prepare_payload["result"]["delegationPlan"]["batches"][0]["strategy"],
            Value::String("parallel".to_string())
        );
        assert_eq!(
            prepare_payload["result"]["auxiliaryExecutionPolicy"]["enabled"],
            Value::Bool(true)
        );
        assert!(
            prepare_payload["result"]["auxiliaryExecutionPolicy"]["routes"]
                .as_array()
                .expect("auxiliary routes")
                .iter()
                .any(|entry| {
                    entry.get("task").and_then(Value::as_str) == Some("context_compaction")
                })
        );
        assert!(
            prepare_payload["result"]["reviewFocus"]
                .as_array()
                .expect("review focus")
                .iter()
                .any(|entry| {
                    let text = entry.as_str().unwrap_or_default();
                    text.contains("validation")
                })
        );

        let _ = fs::remove_dir_all(workspace_path.as_path());
        let _ = fs::remove_dir_all(peer_workspace_path.as_path());
        });
    }

    #[tokio::test]
    async fn mission_control_snapshot_reports_confirmed_requested_backend_placement() {
        let app = test_router();
        let _ = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_backend_upsert",
                "params": {
                    "backendId": "worker-b",
                    "displayName": "Worker B",
                    "capabilities": ["code"],
                    "maxConcurrency": 4,
                    "costTier": "standard",
                    "latencyClass": "regional",
                    "rolloutState": "current",
                    "status": "active"
                }
            }),
        )
        .await;

        let _ = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_start_v2",
                "params": {
                    "workspaceId": "workspace-web",
                    "title": "Preferred placement mission",
                    "executionMode": "distributed",
                    "requiredCapabilities": ["code"],
                    "preferredBackendIds": ["worker-b"],
                    "steps": [
                        {
                            "kind": "read",
                            "input": "preferred placement mission"
                        }
                    ]
                }
            }),
        )
        .await;

        let snapshot = send_large_rpc_request(
            app.clone(),
            json!({
                "method": "code_mission_control_snapshot_v1",
                "params": {}
            }),
        )
        .await;
        assert_eq!(snapshot["ok"], Value::Bool(true));
        let runs = snapshot["result"]["runs"]
            .as_array()
            .expect("mission control runs array");
        let run = runs
            .iter()
            .find(|entry| entry["title"] == Value::String("Preferred placement mission".to_string()))
            .expect("preferred placement run");
        assert_eq!(
            run["placement"]["resolutionSource"],
            Value::String("explicit_preference".to_string())
        );
        assert_eq!(
            run["placement"]["lifecycleState"],
            Value::String("confirmed".to_string())
        );
        assert_eq!(run["placement"]["readiness"], Value::String("ready".to_string()));
        assert_eq!(
            run["placement"]["summary"],
            Value::String("Runtime confirmed the requested backend worker-b.".to_string())
        );
        assert_eq!(
            run["placement"]["healthSummary"],
            Value::String("placement_ready".to_string())
        );
        assert_eq!(run["placement"]["attentionReasons"], json!([]));
    }

    #[tokio::test]
    async fn runtime_run_start_v2_materializes_parallel_safe_sub_agent_lanes() {
        let app = test_router();
        let backend_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_backend_upsert",
                "params": {
                    "backendId": "worker-code",
                    "displayName": "Worker Code",
                    "capabilities": ["code"],
                    "maxConcurrency": 4,
                    "costTier": "standard",
                    "latencyClass": "regional",
                    "rolloutState": "current",
                    "status": "active"
                }
            }),
        )
        .await;
        assert_eq!(backend_payload["ok"], Value::Bool(true));

        let prepare_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_prepare_v2",
                "params": {
                    "workspaceId": "workspace-web",
                    "title": "Parallel safe delegation mission",
                    "executionMode": "distributed",
                    "executionProfileId": "balanced-delegate",
                    "preferredBackendIds": ["worker-code"],
                    "requiredCapabilities": ["code"],
                    "steps": [
                        {
                            "kind": "read",
                            "input": "Inspect the runtime sub-agent contract."
                        },
                        {
                            "kind": "diagnostics",
                            "input": "Validate the mission-control boundary.",
                            "requiresApproval": true,
                            "approvalReason": "delegated diagnostics needs approval"
                        }
                    ]
                }
            }),
        )
        .await;

        assert_eq!(prepare_payload["ok"], Value::Bool(true));
        let approved_plan_version = prepare_payload["result"]["plan"]["planVersion"]
            .as_str()
            .expect("prepare plan version")
            .to_string();

        let start_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_start_v2",
                "params": {
                    "workspaceId": "workspace-web",
                    "title": "Parallel safe delegation mission",
                    "executionMode": "distributed",
                    "executionProfileId": "balanced-delegate",
                    "approvedPlanVersion": approved_plan_version,
                    "preferredBackendIds": ["worker-code"],
                    "requiredCapabilities": ["code"],
                    "steps": [
                        {
                            "kind": "read",
                            "input": "Inspect the runtime sub-agent contract."
                        },
                        {
                            "kind": "diagnostics",
                            "input": "Validate the mission-control boundary.",
                            "requiresApproval": true,
                            "approvalReason": "delegated diagnostics needs approval"
                        }
                    ]
                }
            }),
        )
        .await;

        assert_eq!(start_payload["ok"], Value::Bool(true), "payload: {start_payload:#}");
        let run_id = start_payload["result"]["run"]["taskId"]
            .as_str()
            .expect("runtime run id")
            .to_string();
        let sub_agents = start_payload["result"]["missionRun"]["subAgents"]
            .as_array()
            .expect("mission run sub agents");
        assert_eq!(sub_agents.len(), 2);
        assert!(sub_agents.iter().any(|entry| {
            entry["scopeProfile"] == Value::String("research".to_string())
                && entry["parentRunId"] == Value::String(run_id.clone())
                && entry["sessionId"].as_str().is_some_and(|value| !value.trim().is_empty())
        }));
        let review_session_id = sub_agents
            .iter()
            .find(|entry| {
                entry["scopeProfile"] == Value::String("review".to_string())
                    && entry["parentRunId"] == Value::String(run_id.clone())
                    && entry["sessionId"].as_str().is_some_and(|value| !value.trim().is_empty())
            })
            .and_then(|entry| entry["sessionId"].as_str())
            .expect("review delegated session id")
            .to_string();
        let review_task_id = tokio::time::timeout(Duration::from_secs(3), async {
            loop {
                let status_payload = send_rpc_request(
                    app.clone(),
                    json!({
                        "method":"code_sub_agent_status",
                        "params":{
                            "sessionId": review_session_id,
                        }
                    }),
                )
                .await;
                if let Some(task_id) = status_payload["result"]["lastTaskId"]
                    .as_str()
                    .filter(|value| !value.trim().is_empty())
                {
                    break task_id.to_string();
                }
                tokio::time::sleep(Duration::from_millis(25)).await;
            }
        })
        .await
        .expect("review delegated session should publish a child task id");
        let review_task_payload = wait_for_agent_task_terminal_status(
            app.clone(),
            review_task_id.as_str(),
            &["awaiting_approval"],
        )
        .await;
        assert_eq!(
            review_task_payload["result"]["status"],
            Value::String("awaiting_approval".to_string())
        );
        assert!(review_task_payload["result"]["pendingApprovalId"]
            .as_str()
            .is_some_and(|value| !value.trim().is_empty()));
        assert_eq!(
            review_task_payload["result"]["steps"][0]["metadata"]["approval"]["requestSource"],
            Value::String("explicit_override".to_string())
        );
        assert!(sub_agents.iter().any(|entry| {
            entry["scopeProfile"] == Value::String("review".to_string())
                && entry["parentRunId"] == Value::String(run_id.clone())
                && entry["sessionId"].as_str().is_some_and(|value| !value.trim().is_empty())
        }));
    }

    #[tokio::test]
    async fn mission_control_snapshot_reports_runtime_fallback_placement() {
        let app = test_router();
        let _ = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_backend_upsert",
                "params": {
                    "backendId": "worker-a",
                    "displayName": "Worker A",
                    "capabilities": ["code"],
                    "maxConcurrency": 4,
                    "costTier": "standard",
                    "latencyClass": "regional",
                    "rolloutState": "current",
                    "status": "active"
                }
            }),
        )
        .await;

        let _ = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_start_v2",
                "params": {
                    "workspaceId": "workspace-web",
                    "title": "Fallback placement mission",
                    "executionMode": "distributed",
                    "requiredCapabilities": ["code"],
                    "preferredBackendIds": ["worker-missing"],
                    "steps": [
                        {
                            "kind": "read",
                            "input": "fallback placement mission"
                        }
                    ]
                }
            }),
        )
        .await;

        let snapshot = send_large_rpc_request(
            app.clone(),
            json!({
                "method": "code_mission_control_snapshot_v1",
                "params": {}
            }),
        )
        .await;
        assert_eq!(snapshot["ok"], Value::Bool(true));
        let runs = snapshot["result"]["runs"]
            .as_array()
            .expect("mission control runs array");
        let run = runs
            .iter()
            .find(|entry| entry["title"] == Value::String("Fallback placement mission".to_string()))
            .expect("fallback placement run");
        assert_eq!(
            run["placement"]["resolutionSource"],
            Value::String("runtime_fallback".to_string())
        );
        assert_eq!(
            run["placement"]["lifecycleState"],
            Value::String("fallback".to_string())
        );
        assert_eq!(
            run["placement"]["summary"],
            Value::String("Runtime confirmed fallback placement on backend worker-a.".to_string())
        );
        assert_eq!(
            run["placement"]["healthSummary"],
            Value::String("placement_attention".to_string())
        );
        assert_eq!(
            run["placement"]["attentionReasons"],
            json!(["fallback_backend_selected"])
        );
    }

    #[tokio::test]
    async fn mission_control_snapshot_reports_unresolved_single_runtime_placement() {
        let app = test_router();

        let _ = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_start_v2",
                "params": {
                    "workspaceId": "workspace-web",
                    "title": "Unresolved placement mission",
                    "executionMode": "single",
                    "steps": [
                        {
                            "kind": "read",
                            "input": "unresolved placement mission"
                        }
                    ]
                }
            }),
        )
        .await;

        let snapshot = send_large_rpc_request(
            app.clone(),
            json!({
                "method": "code_mission_control_snapshot_v1",
                "params": {}
            }),
        )
        .await;
        assert_eq!(snapshot["ok"], Value::Bool(true));
        let runs = snapshot["result"]["runs"]
            .as_array()
            .expect("mission control runs array");
        let run = runs
            .iter()
            .find(|entry| {
                entry["title"] == Value::String("Unresolved placement mission".to_string())
            })
            .expect("unresolved placement run");
        assert_eq!(
            run["placement"]["lifecycleState"],
            Value::String("unresolved".to_string())
        );
        assert_eq!(
            run["placement"]["readiness"],
            Value::String("attention".to_string())
        );
        assert_eq!(
            run["placement"]["summary"],
            Value::String("Placement is unresolved.".to_string())
        );
        assert_eq!(
            run["placement"]["healthSummary"],
            Value::String("placement_attention".to_string())
        );
        assert_eq!(
            run["placement"]["attentionReasons"],
            json!(["placement_unresolved", "routing_metadata_missing"])
        );
    }

    #[tokio::test]
    async fn diagnostics_export_includes_routing_health_section() {
        let _guard = diagnostics_export::RUNTIME_DIAGNOSTICS_EXPORT_ENV_TEST_LOCK
            .lock()
            .expect("lock diagnostics export env");
        let previous = std::env::var("CODE_RUNTIME_DIAGNOSTICS_EXPORT_ENABLED").ok();
        std::env::set_var("CODE_RUNTIME_DIAGNOSTICS_EXPORT_ENABLED", "1");

        let app = test_router();
        let _ = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_backend_upsert",
                "params": {
                    "backendId": "worker-routing-health",
                    "displayName": "Worker Routing Health",
                    "capabilities": ["code"],
                    "maxConcurrency": 4,
                    "costTier": "standard",
                    "latencyClass": "regional",
                    "rolloutState": "current",
                    "status": "active"
                }
            }),
        )
        .await;

        let export_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_diagnostics_export_v1",
                "params": {
                    "includeZipBase64": false
                }
            }),
        )
        .await;

        match previous {
            Some(previous) => std::env::set_var("CODE_RUNTIME_DIAGNOSTICS_EXPORT_ENABLED", previous),
            None => std::env::remove_var("CODE_RUNTIME_DIAGNOSTICS_EXPORT_ENABLED"),
        }

        assert_eq!(export_payload["ok"], Value::Bool(true));
        let sections = export_payload["result"]["sections"]
            .as_array()
            .expect("diagnostics export sections");
        assert!(sections.iter().any(|entry| {
            entry == &Value::String("runtime/routing-health.json".to_string())
        }));
        assert!(sections.iter().any(|entry| {
            entry == &Value::String("runtime/checkpoint-review-evidence.json".to_string())
        }));
        assert!(sections.iter().any(|entry| {
            entry == &Value::String("runtime/sub-agent-session-evidence.json".to_string())
        }));
    }

    #[tokio::test]
    async fn diagnostics_export_embeds_takeover_bundle_for_task_and_sub_agent_evidence() {
        use base64::Engine as _;

        let _guard = diagnostics_export::RUNTIME_DIAGNOSTICS_EXPORT_ENV_TEST_LOCK
            .lock()
            .expect("lock diagnostics export env");
        let previous = std::env::var("CODE_RUNTIME_DIAGNOSTICS_EXPORT_ENABLED").ok();
        std::env::set_var("CODE_RUNTIME_DIAGNOSTICS_EXPORT_ENABLED", "1");

        let app = test_router();
        let started_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_start_v2",
                "params": {
                    "workspaceId": "workspace-web",
                    "threadId": null,
                    "accessMode": "on-request",
                    "executionMode": "single",
                    "steps": [
                        {
                            "kind": "read",
                            "input": "summarize runtime takeover bundle diagnostics"
                        }
                    ]
                }
            }),
        )
        .await;
        assert_eq!(started_payload["ok"], Value::Bool(true));
        let spawn_payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_sub_agent_spawn",
                "params":{
                    "workspaceId":"workspace-test",
                    "title":"diagnostics worker",
                    "accessMode":"read-only",
                    "scopeProfile":"review",
                    "parentRunId":"runtime-parent-run"
                }
            }),
        )
        .await;
        assert_eq!(spawn_payload["ok"], Value::Bool(true));
        assert!(
            spawn_payload["result"]["sessionId"]
                .as_str()
                .is_some_and(|value| !value.is_empty())
        );

        let export_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_diagnostics_export_v1",
                "params": {
                    "includeZipBase64": true
                }
            }),
        )
        .await;

        match previous {
            Some(previous) => std::env::set_var("CODE_RUNTIME_DIAGNOSTICS_EXPORT_ENABLED", previous),
            None => std::env::remove_var("CODE_RUNTIME_DIAGNOSTICS_EXPORT_ENABLED"),
        }

        assert_eq!(export_payload["ok"], Value::Bool(true));
        let zip_base64 = export_payload["result"]["zipBase64"]
            .as_str()
            .expect("diagnostics export zip");
        let zip_bytes = base64::engine::general_purpose::STANDARD
            .decode(zip_base64)
            .expect("decode diagnostics zip");
        let mut archive =
            zip::ZipArchive::new(std::io::Cursor::new(zip_bytes)).expect("open diagnostics zip");

        let checkpoint_evidence = {
            let mut file = archive
                .by_name("runtime/checkpoint-review-evidence.json")
                .expect("checkpoint evidence file");
            let mut raw = String::new();
            std::io::Read::read_to_string(&mut file, &mut raw).expect("read checkpoint evidence");
            serde_json::from_str::<Value>(&raw).expect("parse checkpoint evidence")
        };
        let task_entry = checkpoint_evidence
            .as_array()
            .and_then(|entries| {
                entries
                    .iter()
                    .find(|entry| entry["takeoverBundle"].is_object() && entry["taskId"].is_string())
            })
            .expect("checkpoint evidence task entry");
        assert!(task_entry["takeoverBundle"]["pathKind"].is_string());
        assert!(task_entry["takeoverBundle"]["primaryAction"].is_string());

        let sub_agent_evidence = {
            let mut file = archive
                .by_name("runtime/sub-agent-session-evidence.json")
                .expect("sub-agent evidence file");
            let mut raw = String::new();
            std::io::Read::read_to_string(&mut file, &mut raw).expect("read sub-agent evidence");
            serde_json::from_str::<Value>(&raw).expect("parse sub-agent evidence")
        };
        let sub_agent_entry = sub_agent_evidence
            .as_array()
            .and_then(|entries| {
                entries.iter().find(|entry| {
                    entry["takeoverBundle"]["target"]["kind"]
                        == Value::String("sub_agent_session".to_string())
                })
            })
            .expect("sub-agent evidence entry");
        assert_eq!(
            sub_agent_entry["takeoverBundle"]["target"]["kind"],
            Value::String("sub_agent_session".to_string())
        );
    }

    #[test]
    fn agent_task_start_distributed_rejects_when_no_eligible_backend() {
        run_async_test_on_large_stack(async move {
        let app = test_router();
        let _ = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_backend_upsert",
                "params": {
                    "backendId": "worker-disabled",
                    "displayName": "Disabled Worker",
                    "capabilities": ["code"],
                    "maxConcurrency": 4,
                    "costTier": "standard",
                    "latencyClass": "regional",
                    "rolloutState": "drained",
                    "status": "disabled"
                }
            }),
        )
        .await;
        let start_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_start_v2",
                "params": {
                    "workspaceId": "workspace-web",
                    "executionMode": "distributed",
                    "requiredCapabilities": ["code"],
                    "steps": [
                        {
                            "kind": "read",
                            "input": "no backend available"
                        }
                    ]
                }
            }),
        )
        .await;

        assert_eq!(start_payload["ok"], Value::Bool(false));
        assert_eq!(
            start_payload["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );
        });
    }

    #[test]
    fn agent_task_start_rejects_mutation_steps_in_read_only_mode() {
        run_async_test_on_large_stack(async move {
        let app = test_router();
        let payload = send_rpc_request(
            app,
            json!({
                "method": "code_runtime_run_start_v2",
                "params": {
                    "workspaceId": "workspace-web",
                    "accessMode": "read-only",
                    "steps": [
                        {
                            "kind": "write",
                            "path": "agent-task/read-only.txt",
                            "content": "should fail"
                        }
                    ]
                }
            }),
        )
        .await;

        assert_eq!(payload["ok"], Value::Bool(false));
        assert_eq!(
            payload["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );
        });
    }

    #[test]
    fn agent_task_start_rejects_bash_step_for_architect_profile() {
        run_async_test_on_large_stack(async move {
        let app = test_router();
        let payload = send_rpc_request(
            app,
            json!({
                "method": "code_runtime_run_start_v2",
                "params": {
                    "workspaceId": "workspace-web",
                    "agentProfile": "architect",
                    "steps": [
                        {
                            "kind": "bash",
                            "command": "echo should-fail"
                        }
                    ]
                }
            }),
        )
        .await;

        assert_eq!(payload["ok"], Value::Bool(false));
        assert_eq!(
            payload["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );
        });
    }

    #[test]
    fn agent_task_interrupt_marks_pending_task() {
        run_async_test_on_large_stack(async move {
        let app = test_router();
        let workspace_id = format!("workspace-web-{}", rand::random::<u64>());
        let workspace_path = PathBuf::from(format!("/tmp/{workspace_id}"));
        let target_path = workspace_path.join("agent-task/interrupt.txt");
        let _ = fs::remove_dir_all(workspace_path.as_path());
        let workspace_create = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_workspace_create",
                "params": {
                    "path": workspace_path.display().to_string(),
                    "displayName": "Agent Interrupt Workspace"
                }
            }),
        )
        .await;
        assert_eq!(workspace_create["ok"], Value::Bool(true));
        let workspace_runtime_id = workspace_create["result"]["id"]
            .as_str()
            .expect("workspace runtime id")
            .to_string();
        fs::create_dir_all(
            target_path
                .parent()
                .expect("target path parent for interrupt test"),
        )
        .expect("create target parent");
        fs::write(target_path.as_path(), "before interrupt").expect("seed target file");

        let start_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_start_v2",
                "params": {
                    "workspaceId": workspace_runtime_id,
                    "steps": [
                        {
                            "kind": "read",
                            "path": "agent-task/interrupt.txt"
                        },
                        {
                            "kind": "write",
                            "path": "agent-task/interrupt.txt",
                            "content": "interrupt me"
                        }
                    ]
                }
            }),
        )
        .await;

        assert_eq!(start_payload["ok"], Value::Bool(true));
        let task_id = runtime_run_task_id(&start_payload);

        let _ = wait_for_agent_task_terminal_status(
            app.clone(),
            task_id.as_str(),
            &["awaiting_approval"],
        )
        .await;

        let interrupt_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_cancel_v2",
                "params": {
                    "taskId": task_id,
                    "reason": "interrupt-from-test"
                }
            }),
        )
        .await;
        assert_eq!(interrupt_payload["ok"], Value::Bool(true));
        assert_eq!(interrupt_payload["result"]["accepted"], Value::Bool(true));

        let interrupted_payload =
            wait_for_agent_task_terminal_status(app.clone(), task_id.as_str(), &["interrupted"])
                .await;
        assert_eq!(
            interrupted_payload["result"]["status"],
            Value::String("interrupted".to_string())
        );
        assert_eq!(
            interrupted_payload["result"]["errorCode"],
            Value::String("TASK_INTERRUPTED".to_string())
        );
        assert_eq!(
            interrupted_payload["result"]["errorMessage"],
            Value::String("interrupt-from-test".to_string())
        );

        let _ = fs::remove_dir_all(workspace_path.as_path());
        });
    }

    #[test]
    fn agent_task_interrupt_returns_not_accepted_for_terminal_task() {
        run_async_test_on_large_stack(async move {
        let app = test_router();
        let start_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_start_v2",
                "params": {
                    "workspaceId": "workspace-web",
                    "accessMode": "full-access",
                    "steps": [
                        {
                            "kind": "bash",
                            "command": "echo done",
                            "requiresApproval": false
                        }
                    ]
                }
            }),
        )
        .await;

        assert_eq!(start_payload["ok"], Value::Bool(true));
        let task_id = runtime_run_task_id(&start_payload);

        let _ = wait_for_agent_task_terminal_status(app.clone(), task_id.as_str(), &["completed"])
            .await;

        let interrupt_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_cancel_v2",
                "params": {
                    "taskId": task_id,
                }
            }),
        )
        .await;
        assert_eq!(interrupt_payload["ok"], Value::Bool(true));
        assert_eq!(interrupt_payload["result"]["accepted"], Value::Bool(false));
        });
    }

    #[test]
    fn agent_task_resume_rejects_non_recovery_interrupted_task() {
        run_async_test_on_large_stack(async move {
        let app = test_router();
        let workspace_id = format!("workspace-web-{}", rand::random::<u64>());
        let workspace_path = PathBuf::from(format!("/tmp/{workspace_id}"));
        let target_path = workspace_path.join("agent-task/non-recovery-interrupt.txt");
        let _ = fs::remove_dir_all(workspace_path.as_path());
        let workspace_create = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_workspace_create",
                "params": {
                    "path": workspace_path.display().to_string(),
                    "displayName": "Agent Non Recovery Workspace"
                }
            }),
        )
        .await;
        assert_eq!(workspace_create["ok"], Value::Bool(true));
        let workspace_runtime_id = workspace_create["result"]["id"]
            .as_str()
            .expect("workspace runtime id")
            .to_string();
        fs::create_dir_all(
            target_path
                .parent()
                .expect("target path parent for non-recovery interrupt test"),
        )
        .expect("create target parent");
        fs::write(target_path.as_path(), "before interrupt").expect("seed target file");

        let start_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_start_v2",
                "params": {
                    "workspaceId": workspace_runtime_id,
                    "steps": [
                        {
                            "kind": "read",
                            "path": "agent-task/non-recovery-interrupt.txt"
                        },
                        {
                            "kind": "write",
                            "path": "agent-task/non-recovery-interrupt.txt",
                            "content": "interrupt and keep terminal"
                        }
                    ]
                }
            }),
        )
        .await;
        assert_eq!(start_payload["ok"], Value::Bool(true));
        let task_id = runtime_run_task_id(&start_payload);

        let _ = wait_for_agent_task_terminal_status(
            app.clone(),
            task_id.as_str(),
            &["awaiting_approval"],
        )
        .await;
        let interrupt_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_cancel_v2",
                "params": {
                    "taskId": task_id,
                    "reason": "interrupt-non-recovery",
                }
            }),
        )
        .await;
        assert_eq!(interrupt_payload["ok"], Value::Bool(true));
        assert_eq!(interrupt_payload["result"]["accepted"], Value::Bool(true));

        let resume_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_resume_v2",
                "params": {
                    "taskId": task_id,
                }
            }),
        )
        .await;
        assert_eq!(resume_payload["ok"], Value::Bool(true));
        assert_eq!(
            runtime_run_record(&resume_payload)["status"],
            Value::String("interrupted".to_string())
        );
        assert_eq!(
            runtime_run_record(&resume_payload)["recovered"],
            Value::Bool(false)
        );
        assert_eq!(
            runtime_run_record(&resume_payload)["errorCode"],
            Value::String("TASK_INTERRUPTED".to_string())
        );

        let _ = fs::remove_dir_all(workspace_path.as_path());
        });
    }

    #[test]
    fn agent_task_resume_accepts_recovered_snapshot_and_exposes_recovered_flag() {
        run_async_test_on_large_stack(async move {
        let workspace_id = "workspace-web";
        let task_id = format!("agent-task-resume-{}", rand::random::<u64>());
        let now = now_ms();

        let mut recovered_runtime =
            mock_agent_task_runtime(task_id.as_str(), AgentTaskStatus::Running);
        recovered_runtime.summary.workspace_id = workspace_id.to_string();
        recovered_runtime.summary.current_step = Some(0);
        recovered_runtime.summary.started_at = Some(now.saturating_sub(250));
        recovered_runtime.summary.updated_at = now;
        recovered_runtime.steps_input = vec![AgentTaskStepInput {
            kind: AgentStepKind::Read,
            input: Some("resume from durability snapshot".to_string()),
            path: Some("README.md".to_string()),
            paths: None,
            content: None,
            find: None,
            replace: None,
            command: None,
            severities: None,
            max_items: None,
            timeout_ms: None,
            requires_approval: None,
            approval_reason: None,
        }];
        recovered_runtime.summary.steps = recovered_runtime
            .steps_input
            .iter()
            .enumerate()
            .map(|(index, step)| crate::agent_policy::create_agent_step_summary(index, step))
            .collect();
        let seeded_snapshot = json!({
            "version": 1,
            "checkpointId": "checkpoint-seed",
            "traceId": format!("agent-task:{task_id}"),
            "lifecycleState": "running",
            "taskId": task_id,
            "workspaceId": workspace_id,
            "status": "running",
            "summary": recovered_runtime.summary,
            "stepsInput": recovered_runtime.steps_input,
            "interruptRequested": false,
            "recovered": false,
            "updatedAt": now
        });

        let oauth_pool_db_path = temp_sqlite_db_path("oauth-pool-agent-resume");
        let durability_db_path = oauth_pool_db_path
            .parent()
            .expect("oauth pool db parent")
            .join("agent-task-durability.sqlite3");
        seed_agent_task_runtime_snapshot(
            durability_db_path.as_path(),
            task_id.as_str(),
            workspace_id,
            now,
            &seeded_snapshot,
        );

        let mut config = test_service_config();
        config.oauth_pool_db_path = oauth_pool_db_path.to_string_lossy().to_string();
        let app = test_router_with_config(config);

        let recovered_status = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_subscribe_v2",
                "params": {
                    "runId": task_id,
                }
            }),
        )
        .await;
        assert_eq!(recovered_status["ok"], Value::Bool(true));
        assert_eq!(
            runtime_run_record(&recovered_status)["status"],
            Value::String("interrupted".to_string())
        );
        assert_eq!(
            runtime_run_record(&recovered_status)["errorCode"],
            Value::String("RUNTIME_RESTART_RECOVERY".to_string())
        );
        assert_eq!(
            runtime_run_record(&recovered_status)["recovered"],
            Value::Bool(true)
        );
        assert_eq!(
            runtime_run_record(&recovered_status)["checkpointId"],
            Value::String("checkpoint-seed".to_string())
        );
        assert_eq!(
            runtime_run_record(&recovered_status)["traceId"],
            Value::String(format!("agent-task:{task_id}"))
        );

        let list_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_runs_list",
                "params": {
                    "workspaceId": workspace_id,
                    "limit": 5
                }
            }),
        )
        .await;
        assert_eq!(list_payload["ok"], Value::Bool(true));
        let listed_recovered = list_payload["result"][0]["recovered"]
            .as_bool()
            .expect("list payload should include recovered flag");
        assert!(listed_recovered);
        assert_eq!(
            list_payload["result"][0]["checkpointId"],
            Value::String("checkpoint-seed".to_string())
        );
        assert_eq!(
            list_payload["result"][0]["traceId"],
            Value::String(format!("agent-task:{task_id}"))
        );

        let resume_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_resume_v2",
                "params": {
                    "taskId": task_id,
                }
            }),
        )
        .await;
        assert_eq!(resume_payload["ok"], Value::Bool(true));
        assert_ne!(
            runtime_run_record(&resume_payload)["status"],
            Value::String("interrupted".to_string())
        );
        assert_eq!(
            runtime_run_record(&resume_payload)["recovered"],
            Value::Bool(true)
        );
        assert_eq!(
            runtime_run_record(&resume_payload)["traceId"],
            Value::String(format!("agent-task:{task_id}"))
        );
        let resume_checkpoint_id = runtime_run_record(&resume_payload)["checkpointId"]
            .as_str()
            .expect("resume payload should include checkpoint id");
        assert!(!resume_checkpoint_id.trim().is_empty());

        let resumed_status = wait_for_agent_task_terminal_status(
            app.clone(),
            task_id.as_str(),
            &["queued", "running", "completed", "failed", "awaiting_approval"],
        )
        .await;
        let resumed_status_value = resumed_status["result"]["status"]
            .as_str()
            .expect("resumed status should be string");
        assert_ne!(resumed_status_value, "interrupted");
        assert_eq!(resumed_status["result"]["recovered"], Value::Bool(true));
        assert_eq!(
            resumed_status["result"]["traceId"],
            Value::String(format!("agent-task:{task_id}"))
        );
        let resumed_checkpoint_id = resumed_status["result"]["checkpointId"]
            .as_str()
            .expect("resumed status should include checkpoint id");
        assert!(!resumed_checkpoint_id.trim().is_empty());
        assert_ne!(
            resumed_status["result"]["errorCode"],
            Value::String("RUNTIME_RESTART_RECOVERY".to_string())
        );

        cleanup_sqlite_db(oauth_pool_db_path.as_path());
        cleanup_sqlite_db(durability_db_path.as_path());
        });
    }

    #[cfg(unix)]
    #[test]
    fn agent_task_interrupt_during_running_step_remains_interrupted() {
        run_async_test_on_large_stack(async move {
            let app = test_router();
            let start_payload = send_rpc_request(
                app.clone(),
                json!({
                    "method": "code_runtime_run_start_v2",
                    "params": {
                        "workspaceId": "workspace-web",
                        "accessMode": "full-access",
                        "steps": [
                            {
                                "kind": "bash",
                                "command": "sleep 1.2 && echo first-step",
                                "requiresApproval": false
                            },
                            {
                                "kind": "bash",
                                "command": "echo second-step",
                                "requiresApproval": false
                            }
                        ]
                    }
                }),
            )
            .await;
            assert_eq!(start_payload["ok"], Value::Bool(true));
            let task_id = runtime_run_task_id(&start_payload);

            let _ = wait_for_agent_task_terminal_status(
                app.clone(),
                task_id.as_str(),
                &["running"],
            )
            .await;

            let interrupt_payload = send_rpc_request(
                app.clone(),
                json!({
                    "method": "code_runtime_run_cancel_v2",
                    "params": {
                        "taskId": task_id,
                        "reason": "interrupt-while-running",
                    }
                }),
            )
            .await;
            assert_eq!(interrupt_payload["ok"], Value::Bool(true));
            assert_eq!(interrupt_payload["result"]["accepted"], Value::Bool(true));

            let terminal_payload =
                wait_for_agent_task_terminal_status(app.clone(), task_id.as_str(), &["interrupted"])
                    .await;
            assert_eq!(
                terminal_payload["result"]["status"],
                Value::String("interrupted".to_string())
            );
            assert_eq!(
                terminal_payload["result"]["errorCode"],
                Value::String("TASK_INTERRUPTED".to_string())
            );
            assert_eq!(
                terminal_payload["result"]["errorMessage"],
                Value::String("interrupt-while-running".to_string())
            );
            let settled_payload = tokio::time::timeout(Duration::from_secs(2), async {
                loop {
                    let payload = send_rpc_request(
                        app.clone(),
                        json!({
                            "method": "code_runtime_run_subscribe_v2",
                            "params": {
                                "runId": task_id,
                            }
                        }),
                    )
                    .await;
                    if runtime_run_record(&payload)["steps"][0]["status"]
                        == Value::String("interrupted".to_string())
                    {
                        break normalize_runtime_run_payload(payload);
                    }
                    tokio::time::sleep(Duration::from_millis(25)).await;
                }
            })
            .await
            .expect("wait for first step interruption to settle");
            assert_eq!(
                settled_payload["result"]["steps"][0]["status"],
                Value::String("interrupted".to_string())
            );
            assert_eq!(
                settled_payload["result"]["steps"][0]["errorCode"],
                Value::String("TASK_INTERRUPTED".to_string())
            );
            assert_ne!(
                settled_payload["result"]["steps"][1]["status"],
                Value::String("completed".to_string())
            );
        });
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn agent_tasks_with_same_workspace_are_serialized() {
        let app = test_router();
        let first_start = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_start_v2",
                "params": {
                    "workspaceId": "workspace-web",
                    "accessMode": "full-access",
                    "steps": [
                        {
                            "kind": "bash",
                            "command": "sleep 0.35 && echo first-task",
                            "requiresApproval": false
                        }
                    ]
                }
            }),
        )
        .await;
        assert_eq!(first_start["ok"], Value::Bool(true));
        let first_task_id = runtime_run_task_id(&first_start);

        let second_start = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_start_v2",
                "params": {
                    "workspaceId": "workspace-web",
                    "accessMode": "full-access",
                    "steps": [
                        {
                            "kind": "bash",
                            "command": "echo second-task",
                            "requiresApproval": false
                        }
                    ]
                }
            }),
        )
        .await;
        assert_eq!(second_start["ok"], Value::Bool(true));
        let second_task_id = runtime_run_task_id(&second_start);

        tokio::time::sleep(Duration::from_millis(60)).await;
        let second_status_while_first_running = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_subscribe_v2",
                "params": {
                    "runId": second_task_id,
                }
            }),
        )
        .await;
        assert_eq!(
            runtime_run_record(&second_status_while_first_running)["status"],
            Value::String("queued".to_string())
        );

        let first_terminal = wait_for_agent_task_terminal_status(
            app.clone(),
            first_task_id.as_str(),
            &["completed"],
        )
        .await;
        assert_eq!(
            first_terminal["result"]["status"],
            Value::String("completed".to_string())
        );

        let second_terminal = wait_for_agent_task_terminal_status(
            app.clone(),
            second_task_id.as_str(),
            &["completed"],
        )
        .await;
        assert_eq!(
            second_terminal["result"]["status"],
            Value::String("completed".to_string())
        );

        let ready_request = Request::builder()
            .method("GET")
            .uri("/ready")
            .body(Body::empty())
            .expect("build ready request");
        let ready_response = app.oneshot(ready_request).await.expect("ready response");
        let ready_bytes = axum::body::to_bytes(ready_response.into_body(), 1024 * 1024)
            .await
            .expect("read ready body");
        let ready_payload: Value = serde_json::from_slice(&ready_bytes).expect("parse ready json");
        assert!(
            ready_payload["runtimeDiagnostics"]["agentWorkspaceLockWaitMsTotal"]
                .as_u64()
                .unwrap_or(0)
                >= 1
        );
    }

    #[cfg(unix)]
    #[test]
    fn agent_tasks_respect_global_concurrency_limit() {
        run_async_test_on_large_stack(async move {
        let mut config = test_service_config();
        config.agent_max_concurrent_tasks = 1;
        let app = test_router_with_config(config);

        let first_workspace_path = PathBuf::from("/tmp/agent-global-limit-workspace-a");
        let first_target_path = first_workspace_path.join("agent-task/global-limit-blocker.txt");
        let _ = fs::remove_dir_all(first_workspace_path.as_path());
        let first_workspace_create = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_workspace_create",
                "params": {
                    "path": first_workspace_path.display().to_string(),
                    "displayName": "Agent Global Limit Workspace A"
                }
            }),
        )
        .await;
        assert_eq!(first_workspace_create["ok"], Value::Bool(true));
        let first_workspace_id = first_workspace_create["result"]["id"]
            .as_str()
            .expect("first workspace id")
            .to_string();
        fs::create_dir_all(
            first_target_path
                .parent()
                .expect("global limit target parent"),
        )
        .expect("create global limit target parent");
        fs::write(first_target_path.as_path(), "before approval").expect("seed global limit file");

        let second_workspace_path = PathBuf::from("/tmp/agent-global-limit-workspace");
        let _ = fs::remove_dir_all(second_workspace_path.as_path());
        let workspace_create = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_workspace_create",
                "params": {
                    "path": second_workspace_path.display().to_string(),
                    "displayName": "Agent Global Limit Workspace"
                }
            }),
        )
        .await;
        assert_eq!(workspace_create["ok"], Value::Bool(true));
        let second_workspace_id = workspace_create["result"]["id"]
            .as_str()
            .expect("second workspace id")
            .to_string();

        let first_start = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_start_v2",
                "params": {
                    "workspaceId": first_workspace_id,
                    "steps": [
                        {
                            "kind": "read",
                            "path": "agent-task/global-limit-blocker.txt"
                        },
                        {
                            "kind": "write",
                            "path": "agent-task/global-limit-blocker.txt",
                            "content": "block second task"
                        }
                    ]
                }
            }),
        )
        .await;
        assert_eq!(first_start["ok"], Value::Bool(true));
        let first_task_id = runtime_run_task_id(&first_start);

        let second_start = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_start_v2",
                "params": {
                    "workspaceId": second_workspace_id,
                    "accessMode": "full-access",
                    "steps": [
                        {
                            "kind": "bash",
                            "command": "echo second-task",
                            "requiresApproval": false
                        }
                    ]
                }
            }),
        )
        .await;
        assert_eq!(second_start["ok"], Value::Bool(true));
        let second_task_id = runtime_run_task_id(&second_start);

        let first_awaiting = wait_for_agent_task_terminal_status(
            app.clone(),
            first_task_id.as_str(),
            &["awaiting_approval"],
        )
        .await;
        let approval_id = first_awaiting["result"]["pendingApprovalId"]
            .as_str()
            .expect("approval id")
            .to_string();

        tokio::time::sleep(Duration::from_millis(50)).await;
        let second_status_while_first_running = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_subscribe_v2",
                "params": {
                    "runId": second_task_id,
                }
            }),
        )
        .await;
        assert_eq!(
            runtime_run_record(&second_status_while_first_running)["status"],
            Value::String("queued".to_string())
        );

        let reject_approval = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_checkpoint_approval",
                "params": {
                    "approvalId": approval_id,
                    "decision": "rejected"
                }
            }),
        )
        .await;
        assert_eq!(reject_approval["ok"], Value::Bool(true));

        let first_terminal =
            wait_for_agent_task_terminal_status(app.clone(), first_task_id.as_str(), &["failed"])
                .await;
        assert_eq!(
            first_terminal["result"]["errorCode"],
            Value::String("APPROVAL_REJECTED".to_string())
        );
        let second_terminal = wait_for_agent_task_terminal_status(
            app.clone(),
            second_task_id.as_str(),
            &["completed"],
        )
        .await;
        assert_eq!(
            second_terminal["result"]["status"],
            Value::String("completed".to_string())
        );

        let ready_request = Request::builder()
            .method("GET")
            .uri("/ready")
            .body(Body::empty())
            .expect("build ready request");
        let ready_response = app.oneshot(ready_request).await.expect("ready response");
        let ready_bytes = axum::body::to_bytes(ready_response.into_body(), 1024 * 1024)
            .await
            .expect("read ready body");
        let ready_payload: Value = serde_json::from_slice(&ready_bytes).expect("parse ready json");
        assert!(
            ready_payload["runtimeDiagnostics"]["agentExecutionSlotWaitMsTotal"]
                .as_u64()
                .unwrap_or(0)
                >= 1
        );
        assert!(
            ready_payload["runtimeDiagnostics"]["agentTasksStartedTotal"]
                .as_u64()
                .unwrap_or(0)
                >= 2
        );
        assert!(
            ready_payload["runtimeDiagnostics"]["agentWorkspaceLocksTotal"]
                .as_u64()
                .unwrap_or(0)
                >= 1
        );

        let _ = fs::remove_dir_all(first_workspace_path.as_path());
        let _ = fs::remove_dir_all(second_workspace_path.as_path());
        });
    }

