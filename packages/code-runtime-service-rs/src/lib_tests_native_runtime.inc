#[tokio::test]
async fn native_unknown_rpc_method_returns_method_not_found() {
    let app = test_router();
    let payload = send_rpc_request(
        app,
        json!({
            "method": "native_nonexistent_method",
            "params": {}
        }),
    )
    .await;

    assert_eq!(payload["ok"], Value::Bool(false));
    assert_eq!(
        payload["error"]["code"],
        Value::String("METHOD_NOT_FOUND".to_string())
    );
}

#[tokio::test]
async fn native_legacy_plugin_and_skill_methods_return_method_not_found() {
    let app = test_router();
    for method in [
        "native_plugins_list",
        "native_plugin_install",
        "native_plugin_uninstall",
        "native_plugin_update",
        "native_plugin_set_enabled",
        "native_skills_list",
        "native_skill_get",
        "native_skill_upsert",
        "native_skill_remove",
        "native_skill_set_enabled",
    ] {
        let payload = send_rpc_request(
            app.clone(),
            json!({
                "method": method,
                "params": {}
            }),
        )
        .await;

        assert_eq!(payload["ok"], Value::Bool(false), "expected failure for `{method}`");
        assert_eq!(
            payload["error"]["code"],
            Value::String("METHOD_NOT_FOUND".to_string()),
            "expected method not found for `{method}`"
        );
    }
}

#[tokio::test]
async fn native_tool_secret_methods_support_secret_lifecycle() {
    let app = test_router();

    let upsert_tool_payload = send_rpc_request(
        app.clone(),
        json!({
            "method": "native_tool_policy_upsert",
            "params": {
                "toolId": "tool-a",
                "tool": {
                    "name": "Tool A",
                    "version": "1.0.0",
                    "policy": "workspace-write"
                }
            }
        }),
    )
    .await;
    assert_eq!(upsert_tool_payload["ok"], Value::Bool(true));

    let secret_upsert_payload = send_rpc_request(
        app.clone(),
        json!({
            "method": "native_tool_secret_upsert",
            "params": {
                "toolId": "tool-a",
                "secretKey": "OPENAI_API_KEY",
                "secretRef": "secret://openai/api-key"
            }
        }),
    )
    .await;
    assert_eq!(secret_upsert_payload["ok"], Value::Bool(true));

    let list_payload = send_rpc_request(
        app.clone(),
        json!({
            "method": "native_tools_list",
            "params": {
                "toolId": "tool-a"
            }
        }),
    )
    .await;
    assert_eq!(list_payload["ok"], Value::Bool(true));
    assert_eq!(list_payload["result"].as_array().map(Vec::len), Some(1));
    assert_eq!(
        list_payload["result"][0]["secrets"].as_array().map(Vec::len),
        Some(1)
    );
    assert_eq!(
        list_payload["result"][0]["secrets"][0]["secretKey"],
        Value::String("OPENAI_API_KEY".to_string())
    );

    let secret_remove_payload = send_rpc_request(
        app.clone(),
        json!({
            "method": "native_tool_secret_remove",
            "params": {
                "toolId": "tool-a",
                "secretKey": "OPENAI_API_KEY"
            }
        }),
    )
    .await;
    assert_eq!(secret_remove_payload["ok"], Value::Bool(true));
    assert_eq!(secret_remove_payload["result"], Value::Bool(true));

    let list_after_remove = send_rpc_request(
        app,
        json!({
            "method": "native_tools_list",
            "params": {
                "toolId": "tool-a"
            }
        }),
    )
    .await;
    assert_eq!(list_after_remove["ok"], Value::Bool(true));
    assert_eq!(
        list_after_remove["result"][0]["secrets"],
        Value::Array(Vec::new())
    );
}

#[tokio::test]
async fn native_schedule_create_run_cancel_derives_runtime_summary_fields() {
    let app = test_router();

    let create_payload = send_rpc_request(
        app.clone(),
        json!({
            "method": "native_schedule_create",
            "params": {
                "scheduleId": "schedule-night-operator",
                "schedule": {
                    "name": "Night Operator",
                    "workspaceId": "workspace-1",
                    "prompt": "Inspect the latest runtime schedule state.",
                    "cadenceLabel": "Weekdays at 23:00",
                    "autonomyProfile": "night_operator",
                    "enabled": true
                }
            }
        }),
    )
    .await;

    assert_eq!(create_payload["ok"], Value::Bool(true));
    assert_eq!(
        create_payload["result"]["status"],
        Value::String("idle".to_string())
    );
    assert_eq!(
        create_payload["result"]["triggerSourceLabel"],
        Value::String("schedule".to_string())
    );
    assert_eq!(
        create_payload["result"]["lastOutcomeLabel"],
        Value::String("Awaiting next run".to_string())
    );
    assert!(
        create_payload["result"]["nextRunAtMs"]
            .as_u64()
            .is_some_and(|value| value > 0)
    );
    assert_eq!(
        create_payload["result"]["nextRunAtMs"],
        create_payload["result"]["nextRunAt"]
    );

    let run_payload = send_rpc_request(
        app.clone(),
        json!({
            "method": "native_schedule_run_now",
            "params": {
                "scheduleId": "schedule-night-operator"
            }
        }),
    )
    .await;

    assert_eq!(run_payload["ok"], Value::Bool(true));
    assert_eq!(
        run_payload["result"]["status"],
        Value::String("running".to_string())
    );
    assert_eq!(
        run_payload["result"]["lastOutcomeLabel"],
        Value::String("Running".to_string())
    );
    assert!(
        run_payload["result"]["lastRunAtMs"]
            .as_u64()
            .is_some_and(|value| value > 0)
    );
    assert!(run_payload["result"]["nextRunAtMs"].is_null());

    let cancel_payload = send_rpc_request(
        app,
        json!({
            "method": "native_schedule_cancel_run",
            "params": {
                "scheduleId": "schedule-night-operator"
            }
        }),
    )
    .await;

    assert_eq!(cancel_payload["ok"], Value::Bool(true));
    assert_eq!(
        cancel_payload["result"]["status"],
        Value::String("idle".to_string())
    );
    assert_eq!(
        cancel_payload["result"]["lastOutcomeLabel"],
        Value::String("No workspace is available for core live skills.".to_string())
    );
    assert!(
        cancel_payload["result"]["nextRunAtMs"]
            .as_u64()
            .is_some_and(|value| value > 0)
    );
    assert!(cancel_payload["result"]["currentTaskId"].is_null());
}

#[tokio::test]
async fn native_schedule_update_normalizes_blocked_and_paused_states() {
    let app = test_router();

    let create_payload = send_rpc_request(
        app.clone(),
        json!({
            "method": "native_schedule_create",
            "params": {
                "scheduleId": "schedule-review-pack",
                "schedule": {
                    "name": "Review Pack Sweep",
                    "cron": "0 6 * * *"
                }
            }
        }),
    )
    .await;
    assert_eq!(create_payload["ok"], Value::Bool(true));

    let blocked_payload = send_rpc_request(
        app.clone(),
        json!({
            "method": "native_schedule_update",
            "params": {
                "scheduleId": "schedule-review-pack",
                "schedule": {
                    "blockingReason": "Waiting for validation results."
                }
            }
        }),
    )
    .await;

    assert_eq!(blocked_payload["ok"], Value::Bool(true));
    assert_eq!(
        blocked_payload["result"]["status"],
        Value::String("blocked".to_string())
    );
    assert_eq!(
        blocked_payload["result"]["lastOutcomeLabel"],
        Value::String("Waiting for validation results.".to_string())
    );
    assert!(blocked_payload["result"]["nextRunAtMs"].is_null());

    let paused_payload = send_rpc_request(
        app,
        json!({
            "method": "native_schedule_update",
            "params": {
                "scheduleId": "schedule-review-pack",
                "schedule": {
                    "enabled": false,
                    "blockingReason": null
                }
            }
        }),
    )
    .await;

    assert_eq!(paused_payload["ok"], Value::Bool(true));
    assert_eq!(
        paused_payload["result"]["status"],
        Value::String("paused".to_string())
    );
    assert_eq!(
        paused_payload["result"]["lastOutcomeLabel"],
        Value::String("Paused".to_string())
    );
    assert!(paused_payload["result"]["nextRunAtMs"].is_null());
}

#[tokio::test]
async fn native_schedule_run_now_launches_task_when_schedule_has_workspace_context() {
    let app = test_router();

    let create_payload = send_rpc_request(
        app.clone(),
        json!({
            "method": "native_schedule_create",
            "params": {
                "scheduleId": "schedule-review-pack-launch",
                "schedule": {
                    "name": "Night Operator Review Sweep",
                    "workspaceId": "workspace-1",
                    "prompt": "Summarize the latest runtime truth changes.",
                    "accessMode": "on-request",
                    "enabled": true
                }
            }
        }),
    )
    .await;
    assert_eq!(create_payload["ok"], Value::Bool(true));

    let run_payload = send_rpc_request(
        app.clone(),
        json!({
            "method": "native_schedule_run_now",
            "params": {
                "scheduleId": "schedule-review-pack-launch"
            }
        }),
    )
    .await;

    assert_eq!(run_payload["ok"], Value::Bool(true));
    let task_id = run_payload["result"]["currentTaskId"]
        .as_str()
        .expect("scheduled run task id")
        .to_string();
    let run_id = run_payload["result"]["currentRunId"]
        .as_str()
        .expect("scheduled run id")
        .to_string();
    assert_eq!(run_payload["result"]["lastTriggeredTaskId"], json!(task_id));
    assert_eq!(run_payload["result"]["lastTriggeredRunId"], json!(run_id));
    assert!(
        run_payload["result"]["lastTriggeredAt"]
            .as_u64()
            .is_some_and(|value| value > 0)
    );

    let task_payload = send_rpc_request(
        app,
        json!({
            "method": "code_runtime_run_subscribe",
            "params": {
                "taskId": task_id
            }
        }),
    )
    .await;

    assert_eq!(task_payload["ok"], Value::Bool(true));
    assert_eq!(task_payload["result"]["taskId"], json!(task_id));
    assert_eq!(
        task_payload["result"]["title"],
        Value::String("Night Operator Review Sweep".to_string())
    );
    assert_eq!(task_payload["result"]["runSummary"]["id"], json!(run_id));
    assert_eq!(
        task_payload["result"]["missionLinkage"]["workspaceId"],
        Value::String("workspace-1".to_string())
    );
}

#[test]
fn native_schedule_run_now_rejects_second_active_launch() {
    let error = crate::rpc_dispatch_native_schedules::reject_active_schedule_task(
        "schedule-active-task-guard",
        "agent-task-active",
        "awaiting_approval",
    )
    .expect_err("non-terminal task should block schedule relaunch");

    assert_eq!(error.code_str(), "INVALID_PARAMS");
    assert!(error.message().contains("already has an active task"));
}

#[tokio::test]
async fn native_schedule_run_now_rejects_workspace_override_mismatch() {
    let app = test_router();

    let create_payload = send_rpc_request(
        app.clone(),
        json!({
            "method": "native_schedule_create",
            "params": {
                "scheduleId": "schedule-workspace-guard",
                "schedule": {
                    "name": "Night Operator Workspace Guard",
                    "workspaceId": "workspace-1",
                    "prompt": "Use the persisted schedule workspace.",
                    "enabled": true
                }
            }
        }),
    )
    .await;
    assert_eq!(create_payload["ok"], Value::Bool(true));

    let run_payload = send_rpc_request(
        app,
        json!({
            "method": "native_schedule_run_now",
            "params": {
                "scheduleId": "schedule-workspace-guard",
                "workspaceId": "workspace-2"
            }
        }),
    )
    .await;

    assert_eq!(run_payload["ok"], Value::Bool(false));
    assert_eq!(
        run_payload["error"]["code"],
        Value::String("INVALID_PARAMS".to_string())
    );
}

#[tokio::test]
async fn native_schedules_list_projects_runtime_lineage_for_triggered_task() {
    let app = test_router();

    let create_payload = send_rpc_request(
        app.clone(),
        json!({
            "method": "native_schedule_create",
            "params": {
                "scheduleId": "schedule-review-pack-lineage",
                "schedule": {
                    "name": "Night Operator Runtime Truth",
                    "workspaceId": "workspace-1",
                    "prompt": "Project schedule lineage into the runtime summary.",
                    "accessMode": "on-request",
                    "enabled": true
                }
            }
        }),
    )
    .await;
    assert_eq!(create_payload["ok"], Value::Bool(true));

    let run_payload = send_rpc_request(
        app.clone(),
        json!({
            "method": "native_schedule_run_now",
            "params": {
                "scheduleId": "schedule-review-pack-lineage"
            }
        }),
    )
    .await;
    assert_eq!(run_payload["ok"], Value::Bool(true));
    let task_id = run_payload["result"]["currentTaskId"]
        .as_str()
        .expect("scheduled run task id")
        .to_string();

    let list_payload = send_rpc_request(
        app,
        json!({
            "method": "native_schedules_list",
            "params": {}
        }),
    )
    .await;

    assert_eq!(list_payload["ok"], Value::Bool(true));
    let schedule_entry = list_payload["result"]
        .as_array()
        .and_then(|entries| {
            entries
                .iter()
                .find(|entry| entry["id"] == Value::String("schedule-review-pack-lineage".to_string()))
        })
        .expect("projected schedule entry");
    assert_eq!(schedule_entry["lastTriggeredTaskId"], json!(task_id));
    assert_eq!(
        schedule_entry["missionLinkage"]["workspaceId"],
        Value::String("workspace-1".to_string())
    );
    assert_eq!(schedule_entry["taskSource"]["kind"], json!("schedule"));
    assert_eq!(
        schedule_entry["reviewActionability"]["state"].as_str().is_some(),
        true
    );
}

#[tokio::test]
async fn native_schedules_list_preserves_persisted_workspace_after_workspace_update() {
    let app = test_router();

    let create_payload = send_rpc_request(
        app.clone(),
        json!({
            "method": "native_schedule_create",
            "params": {
                "scheduleId": "schedule-workspace-projection",
                "schedule": {
                    "name": "Night Operator Workspace Projection",
                    "workspaceId": "workspace-1",
                    "prompt": "Project runtime lineage without clobbering the schedule workspace.",
                    "enabled": true
                }
            }
        }),
    )
    .await;
    assert_eq!(create_payload["ok"], Value::Bool(true));

    let run_payload = send_rpc_request(
        app.clone(),
        json!({
            "method": "native_schedule_run_now",
            "params": {
                "scheduleId": "schedule-workspace-projection"
            }
        }),
    )
    .await;
    assert_eq!(run_payload["ok"], Value::Bool(true));

    let update_payload = send_rpc_request(
        app.clone(),
        json!({
            "method": "native_schedule_update",
            "params": {
                "scheduleId": "schedule-workspace-projection",
                "schedule": {
                    "workspaceId": "workspace-2"
                }
            }
        }),
    )
    .await;
    assert_eq!(update_payload["ok"], Value::Bool(true));

    let list_payload = send_rpc_request(
        app,
        json!({
            "method": "native_schedules_list",
            "params": {}
        }),
    )
    .await;

    assert_eq!(list_payload["ok"], Value::Bool(true));
    let schedule_entry = list_payload["result"]
        .as_array()
        .and_then(|entries| {
            entries
                .iter()
                .find(|entry| entry["id"] == Value::String("schedule-workspace-projection".to_string()))
        })
        .expect("projected schedule entry");
    assert_eq!(
        schedule_entry["workspaceId"],
        Value::String("workspace-2".to_string())
    );
    assert_eq!(
        schedule_entry["missionLinkage"]["workspaceId"],
        Value::String("workspace-1".to_string())
    );
}

#[tokio::test]
async fn native_schedule_cancel_run_clears_active_task_linkage() {
    let app = test_router();

    let create_payload = send_rpc_request(
        app.clone(),
        json!({
            "method": "native_schedule_create",
            "params": {
                "scheduleId": "schedule-review-pack-cancel",
                "schedule": {
                    "name": "Night Operator Cancel Sweep",
                    "workspaceId": "workspace-1",
                    "prompt": "Interrupt the scheduled review run.",
                    "accessMode": "on-request",
                    "enabled": true
                }
            }
        }),
    )
    .await;
    assert_eq!(create_payload["ok"], Value::Bool(true));

    let run_payload = send_rpc_request(
        app.clone(),
        json!({
            "method": "native_schedule_run_now",
            "params": {
                "scheduleId": "schedule-review-pack-cancel"
            }
        }),
    )
    .await;
    assert_eq!(run_payload["ok"], Value::Bool(true));
    let task_id = run_payload["result"]["currentTaskId"]
        .as_str()
        .expect("scheduled run task id")
        .to_string();

    let cancel_payload = send_rpc_request(
        app.clone(),
        json!({
            "method": "native_schedule_cancel_run",
            "params": {
                "scheduleId": "schedule-review-pack-cancel"
            }
        }),
    )
    .await;
    assert_eq!(cancel_payload["ok"], Value::Bool(true));
    assert_eq!(cancel_payload["result"]["status"], json!("idle"));
    assert_eq!(
        cancel_payload["result"]["lastOutcomeLabel"],
        json!("No workspace is available for core live skills.")
    );
    assert!(cancel_payload["result"]["currentTaskId"].is_null());
    assert!(cancel_payload["result"]["currentRunId"].is_null());

    let task_payload = send_rpc_request(
        app,
        json!({
            "method": "code_runtime_run_subscribe",
            "params": {
                "taskId": task_id
            }
        }),
    )
    .await;

    assert_eq!(task_payload["ok"], Value::Bool(true));
    assert_eq!(task_payload["result"]["taskId"], json!(task_id));
    assert_eq!(task_payload["result"]["status"], json!("failed"));
}

#[tokio::test]
async fn native_schedule_cancel_run_projects_terminal_task_state_when_interrupt_not_accepted() {
    let app = test_router();

    let create_payload = send_rpc_request(
        app.clone(),
        json!({
            "method": "native_schedule_create",
            "params": {
                "scheduleId": "schedule-terminal-cancel-guard",
                "schedule": {
                    "name": "Night Operator Terminal Cancel Guard",
                    "workspaceId": "workspace-1",
                    "prompt": "Finish before the cancel request lands.",
                    "enabled": true
                }
            }
        }),
    )
    .await;
    assert_eq!(create_payload["ok"], Value::Bool(true));

    let run_payload = send_rpc_request(
        app.clone(),
        json!({
            "method": "native_schedule_run_now",
            "params": {
                "scheduleId": "schedule-terminal-cancel-guard"
            }
        }),
    )
    .await;
    assert_eq!(run_payload["ok"], Value::Bool(true));
    let task_id = run_payload["result"]["currentTaskId"]
        .as_str()
        .expect("scheduled run task id")
        .to_string();

    let _ = wait_for_agent_task_terminal_status(
        app.clone(),
        task_id.as_str(),
        &["completed", "failed"],
    )
    .await;

    let cancel_payload = send_rpc_request(
        app,
        json!({
            "method": "native_schedule_cancel_run",
            "params": {
                "scheduleId": "schedule-terminal-cancel-guard"
            }
        }),
    )
    .await;

    assert_eq!(cancel_payload["ok"], Value::Bool(true));
    assert_eq!(cancel_payload["result"]["status"], json!("idle"));
    assert!(cancel_payload["result"]["currentTaskId"].is_null());
    assert!(cancel_payload["result"]["currentRunId"].is_null());
    let last_outcome = cancel_payload["result"]["lastOutcomeLabel"]
        .as_str()
        .unwrap_or_default();
    assert!(matches!(
        last_outcome,
        "Completed" | "Review pack ready" | "No workspace is available for core live skills."
    ));
}

#[tokio::test]
async fn native_schedule_run_now_requires_launch_context() {
    let app = test_router();

    let create_payload = send_rpc_request(
        app.clone(),
        json!({
            "method": "native_schedule_create",
            "params": {
                "scheduleId": "schedule-missing-context",
                "schedule": {
                    "name": "Missing context schedule",
                    "enabled": true
                }
            }
        }),
    )
    .await;
    assert_eq!(create_payload["ok"], Value::Bool(true));

    let run_payload = send_rpc_request(
        app,
        json!({
            "method": "native_schedule_run_now",
            "params": {
                "scheduleId": "schedule-missing-context"
            }
        }),
    )
    .await;

    assert_eq!(run_payload["ok"], Value::Bool(false));
    assert_eq!(
        run_payload["error"]["code"],
        Value::String("INVALID_PARAMS".to_string())
    );
}

#[tokio::test]
async fn native_providers_snapshot_returns_catalog_and_oauth_entities() {
    let app = test_router();

    let account_upsert = send_rpc_request(
        app.clone(),
        json!({
            "method": "native_oauth_account_upsert",
            "params": {
                "accountId": "acct-codex-1",
                "provider": "codex",
                "displayName": "Codex Account 1",
                "metadata": {
                    "apiKey": "codex-test-key"
                }
            }
        }),
    )
    .await;
    assert_eq!(account_upsert["ok"], Value::Bool(true));

    let pool_apply = send_rpc_request(
        app.clone(),
        json!({
            "method": "native_oauth_pool_apply",
            "params": {
                "pool": {
                    "poolId": "pool-codex",
                    "provider": "codex",
                    "name": "Codex Pool",
                    "strategy": "round_robin",
                    "stickyMode": "cache_first",
                    "enabled": true,
                    "metadata": {}
                },
                "members": [
                    {
                        "accountId": "acct-codex-1",
                        "weight": 1,
                        "priority": 0,
                        "position": 0,
                        "enabled": true
                    }
                ]
            }
        }),
    )
    .await;
    assert_eq!(pool_apply["ok"], Value::Bool(true));

    let snapshot_payload = send_rpc_request(
        app.clone(),
        json!({
            "method": "native_providers_snapshot",
            "params": {}
        }),
    )
    .await;
    assert_eq!(snapshot_payload["ok"], Value::Bool(true));
    assert!(
        snapshot_payload["result"]["providers"]
            .as_array()
            .is_some_and(|entries| !entries.is_empty())
    );
    assert_eq!(
        snapshot_payload["result"]["accounts"][0]["accountId"],
        Value::String("acct-codex-1".to_string())
    );
    assert_eq!(
        snapshot_payload["result"]["poolMembersByPoolId"]["pool-codex"]
            .as_array()
            .map(Vec::len),
        Some(1)
    );
}

#[tokio::test]
async fn native_providers_connection_probe_validates_and_returns_selection() {
    let app = test_router();

    let invalid_probe = send_rpc_request(
        app.clone(),
        json!({
            "method": "native_providers_connection_probe",
            "params": {}
        }),
    )
    .await;
    assert_eq!(invalid_probe["ok"], Value::Bool(false));
    assert_eq!(
        invalid_probe["error"]["code"],
        Value::String("INVALID_PARAMS".to_string())
    );

    let account_upsert = send_rpc_request(
        app.clone(),
        json!({
            "method": "native_oauth_account_upsert",
            "params": {
                "accountId": "acct-codex-probe",
                "provider": "codex",
                "displayName": "Codex Probe Account",
                "metadata": {
                    "apiKey": "probe-test-key"
                }
            }
        }),
    )
    .await;
    assert_eq!(account_upsert["ok"], Value::Bool(true));

    let pool_apply = send_rpc_request(
        app.clone(),
        json!({
            "method": "native_oauth_pool_apply",
            "params": {
                "pool": {
                    "poolId": "pool-codex-probe",
                    "provider": "codex",
                    "name": "Codex Probe Pool",
                    "strategy": "round_robin",
                    "stickyMode": "cache_first",
                    "enabled": true,
                    "metadata": {}
                },
                "members": [
                    {
                        "accountId": "acct-codex-probe",
                        "enabled": true
                    }
                ]
            }
        }),
    )
    .await;
    assert_eq!(pool_apply["ok"], Value::Bool(true));

    let probe_payload = send_rpc_request(
        app,
        json!({
            "method": "native_providers_connection_probe",
            "params": {
                "provider": "codex",
                "poolId": "pool-codex-probe"
            }
        }),
    )
    .await;
    assert_eq!(probe_payload["ok"], Value::Bool(true));
    assert_eq!(probe_payload["result"]["available"], Value::Bool(true));
    assert_eq!(
        probe_payload["result"]["poolId"],
        Value::String("pool-codex-probe".to_string())
    );
    assert_eq!(
        probe_payload["result"]["selection"]["account"]["accountId"],
        Value::String("acct-codex-probe".to_string())
    );
}

#[tokio::test]
async fn native_state_store_migrations_and_crud_are_idempotent() {
    use crate::native_state_store::{
        NativeStateStore, TABLE_NATIVE_PLUGINS, TABLE_NATIVE_VOICE_CONFIG,
    };

    let db_path = temp_sqlite_db_path("native-runtime-state-store");
    cleanup_sqlite_db(db_path.as_path());

    let store = NativeStateStore::new(db_path.clone());
    store.initialize_blocking();
    store.initialize_blocking();

    let health = store.health_snapshot().await;
    assert!(health.ready);
    assert_eq!(health.schema_version, 1);
    assert_eq!(health.path, db_path.display().to_string());

    let voice = store
        .list_setting_values(TABLE_NATIVE_VOICE_CONFIG)
        .await
        .expect("read seeded voice settings");
    assert_eq!(
        voice["hotkey"],
        Value::String("command+shift+v".to_string())
    );
    assert_eq!(voice["vad"]["enabled"], Value::Bool(true));
    assert_eq!(voice["vad"]["silenceHoldMs"], Value::Number(700.into()));

    let first_upsert = store
        .upsert_entity(
            TABLE_NATIVE_PLUGINS,
            "plugin-a",
            Some(true),
            json!({
                "name": "Plugin A",
                "version": "1.0.0"
            }),
        )
        .await
        .expect("insert plugin row");
    assert_eq!(first_upsert["id"], Value::String("plugin-a".to_string()));
    assert_eq!(first_upsert["enabled"], Value::Bool(true));

    let second_upsert = store
        .upsert_entity(
            TABLE_NATIVE_PLUGINS,
            "plugin-a",
            Some(false),
            json!({
                "name": "Plugin A",
                "version": "1.1.0"
            }),
        )
        .await
        .expect("update plugin row");
    assert_eq!(second_upsert["version"], Value::String("1.1.0".to_string()));
    assert_eq!(second_upsert["enabled"], Value::Bool(false));

    let listed = store
        .list_entities(TABLE_NATIVE_PLUGINS)
        .await
        .expect("list plugins");
    assert_eq!(listed.len(), 1);
    assert_eq!(
        listed[0]["version"],
        Value::String("1.1.0".to_string())
    );

    let removed = store
        .remove_entity(TABLE_NATIVE_PLUGINS, "plugin-a")
        .await
        .expect("remove plugin row");
    assert!(removed);
    let removed_again = store
        .remove_entity(TABLE_NATIVE_PLUGINS, "plugin-a")
        .await
        .expect("remove plugin row twice");
    assert!(!removed_again);

    cleanup_sqlite_db(db_path.as_path());
}

#[test]
fn native_runtime_update_scope_matrix_covers_native_mutation_methods() {
    let expectations: &[(&str, &[&str])] = &[
        ("native_tool_policy_upsert", &["tools"]),
        ("native_tool_set_enabled", &["tools"]),
        ("native_tool_secret_upsert", &["tools"]),
        ("native_tool_secret_remove", &["tools"]),
        ("native_theme_upsert", &["themes", "settings"]),
        ("native_theme_remove", &["themes", "settings"]),
        ("native_theme_set_active", &["themes", "settings"]),
        ("native_schedule_create", &["schedules", "workflow"]),
        ("native_schedule_update", &["schedules", "workflow"]),
        ("native_schedule_delete", &["schedules", "workflow"]),
        ("native_schedule_run_now", &["schedules", "workflow"]),
        ("native_schedule_cancel_run", &["schedules", "workflow"]),
        ("native_watcher_create", &["watchers", "workflow"]),
        ("native_watcher_update", &["watchers", "workflow"]),
        ("native_watcher_delete", &["watchers", "workflow"]),
        ("native_watcher_set_enabled", &["watchers", "workflow"]),
        ("native_server_config_set", &["server", "settings"]),
        ("native_settings_set", &["settings"]),
        ("native_voice_config_set", &["voice", "settings"]),
        ("native_voice_hotkey_set", &["voice", "settings"]),
        ("native_review_comment_upsert", &["review"]),
        ("native_review_comment_remove", &["review"]),
        ("native_review_comment_set_resolved", &["review"]),
        (
            "native_providers_snapshot",
            &["providers", "models", "bootstrap"],
        ),
        (
            "native_providers_connection_probe",
            &["providers", "models", "bootstrap"],
        ),
    ];

    for (method, expected_scope) in expectations {
        assert_eq!(
            runtime_update_scope_for_method(method),
            Some(*expected_scope),
            "scope mismatch for native runtime updated method `{method}`"
        );
    }
}

#[test]
fn native_runtime_update_scope_matrix_keeps_read_only_methods_outside_runtime_updated() {
    let read_only_methods = [
        "native_management_snapshot",
        "native_review_comments_list",
        "native_tools_list",
        "native_themes_list",
        "native_schedules_list",
        "native_watchers_list",
        "native_insights_summary",
        "native_insights_timeseries",
        "native_insights_events",
        "native_server_status",
        "native_server_config_get",
        "native_settings_get",
        "native_voice_config_get",
    ];

    for method in read_only_methods {
        assert_eq!(
            runtime_update_scope_for_method(method),
            None,
            "read-only method should not emit runtime.updated: `{method}`"
        );
    }
}

#[test]
fn native_state_fabric_updated_reason_matrix_covers_alias_and_native_only_paths() {
    let expectations = [
        (
            "native_workspace_create",
            "code_workspace_create",
            "native_workspace_create",
        ),
        (
            "native_thread_create",
            "code_thread_create",
            "native_thread_create",
        ),
        (
            "native_tool_secret_upsert",
            "native_tool_secret_upsert",
            "native_tool_secret_upsert",
        ),
        ("code_workspace_create", "code_workspace_create", "code_workspace_create"),
    ];

    for (requested_method, canonical_method, expected_reason) in expectations {
        assert_eq!(
            crate::native_runtime::runtime_updated_reason_for_request(
                requested_method,
                canonical_method
            ),
            expected_reason.to_string(),
            "reason mismatch for requested=`{requested_method}` canonical=`{canonical_method}`"
        );
    }
}

#[test]
fn native_rpc_capabilities_v2_method_set_hash_is_stable() {
    let methods = list_native_rpc_method_capabilities();
    assert_eq!(
        hash_rpc_method_capabilities(methods.as_slice()),
        "1acbdc0d0d645852"
    );
}

#[tokio::test]
async fn native_rpc_capabilities_method_sets_keep_alias_and_native_only_disjoint() {
    let app = test_router();
    let payload = send_rpc_request(
        app,
        json!({
            "method": "native_rpc_capabilities",
            "params": {}
        }),
    )
    .await;

    assert_eq!(payload["ok"], Value::Bool(true));
    let alias_methods = payload["result"]["methodSets"]["aliasNativeMethods"]
        .as_array()
        .expect("aliasNativeMethods should be an array");
    let native_only_methods = payload["result"]["methodSets"]["nativeOnlyMethods"]
        .as_array()
        .expect("nativeOnlyMethods should be an array");
    assert!(!native_only_methods.is_empty());

    let alias_set = alias_methods
        .iter()
        .filter_map(Value::as_str)
        .collect::<std::collections::BTreeSet<_>>();
    for method in native_only_methods.iter().filter_map(Value::as_str) {
        assert!(
            !alias_set.contains(method),
            "native-only method should not be present in alias set: {method}"
        );
    }
}

#[tokio::test]
async fn native_rpc_capabilities_method_sets_match_runtime_registries() {
    let app = test_router();
    let payload = send_rpc_request(
        app,
        json!({
            "method": "native_rpc_capabilities",
            "params": {}
        }),
    )
    .await;

    assert_eq!(payload["ok"], Value::Bool(true));

    let mut alias_methods = payload["result"]["methodSets"]["aliasNativeMethods"]
        .as_array()
        .expect("aliasNativeMethods should be an array")
        .iter()
        .map(|entry| {
            entry
                .as_str()
                .expect("alias method should be a string")
                .to_string()
        })
        .collect::<Vec<_>>();
    alias_methods.sort_unstable();

    let mut expected_alias_methods = crate::native_runtime::map_rpc_methods_to_native_namespace(
        list_rpc_method_capabilities().as_slice(),
    );
    expected_alias_methods.sort_unstable();
    expected_alias_methods.dedup();
    assert_eq!(alias_methods, expected_alias_methods);

    let mut native_only_methods = payload["result"]["methodSets"]["nativeOnlyMethods"]
        .as_array()
        .expect("nativeOnlyMethods should be an array")
        .iter()
        .map(|entry| {
            entry
                .as_str()
                .expect("native-only method should be a string")
                .to_string()
        })
        .collect::<Vec<_>>();
    native_only_methods.sort_unstable();

    let mut expected_native_only_methods = crate::native_runtime::NATIVE_ONLY_RPC_METHODS
        .iter()
        .map(|entry| (*entry).to_string())
        .collect::<Vec<_>>();
    expected_native_only_methods.sort_unstable();
    assert_eq!(native_only_methods, expected_native_only_methods);
}
