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
        "935b0f75bcd9c0a1"
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
