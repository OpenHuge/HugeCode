    #[test]
    fn rpc_method_registry_is_unique_and_non_conflicting() {
        let mut methods = HashSet::new();

        for entry in RPC_METHOD_REGISTRY {
            assert!(methods.insert(entry.method));
        }
    }

    #[test]
    fn rpc_method_registry_resolves_canonical_names_only() {
        for entry in RPC_METHOD_REGISTRY {
            assert_eq!(resolve_rpc_method(entry.method), Some(entry.method));
            let legacy_candidate = entry.method.trim_start_matches("code_");
            if legacy_candidate != entry.method {
                assert_eq!(resolve_rpc_method(legacy_candidate), None);
            }
        }
    }

    #[test]
    fn rpc_method_registry_resolves_native_namespace_aliases() {
        for entry in RPC_METHOD_REGISTRY {
            let Some(suffix) = entry.method.strip_prefix("code_") else {
                continue;
            };
            let native_method = format!("native_{suffix}");
            assert_eq!(resolve_rpc_method(&native_method), Some(entry.method));
        }
    }

    #[test]
    fn rpc_method_capabilities_advertise_canonical_methods_only() {
        let methods = list_rpc_method_capabilities();

        assert!(methods.iter().all(|method| method.starts_with("code_")));
        assert!(methods.iter().any(|method| method == "code_oauth_pool_apply"));
        assert!(methods
            .iter()
            .any(|method| method == "code_runtime_run_start_v2"));
        assert!(methods
            .iter()
            .any(|method| method == "code_runtime_run_checkpoint_approval"));
        assert!(methods
            .iter()
            .any(|method| method == "code_oauth_primary_account_set"));
        assert!(!methods.iter().any(|method| method == "oauth_pool_apply"));
        assert!(!methods.iter().any(|method| method == "runtime_run_start"));
        assert!(!methods
            .iter()
            .any(|method| method == "runtime_run_checkpoint_approval"));
        assert!(!methods
            .iter()
            .any(|method| method == "oauth_primary_account_set"));
    }

    #[tokio::test]
    async fn rpc_method_registry_entries_are_dispatch_covered() {
        let app = test_router();
        for entry in RPC_METHOD_REGISTRY {
            if matches!(
                entry.method,
                "code_workspace_pick_directory"
                    | "code_codex_exec_run_v1"
                    | "code_codex_cloud_tasks_list_v1"
                    | "code_codex_config_path_get_v1"
                    | "code_codex_doctor_v1"
                    | "code_codex_update_v1"
                    | "code_mcp_server_status_list_v1"
                    | "code_runtime_diagnostics_export_v1"
            ) {
                // This method intentionally opens a native folder picker dialog and can block
                // indefinitely in headless CI or unattended test runs. The gated methods above
                // intentionally resolve as METHOD_NOT_FOUND until their opt-in env flags are set.
                continue;
            }
            let params = match entry.method {
                // Keep this dispatch-coverage test deterministic and fast by skipping
                // external usage refresh side effects.
                "code_oauth_accounts_list" => json!({ "usageRefresh": "off" }),
                "code_runtime_invocation_dispatch_v1" => {
                    json!({ "invocationId": "runtime:test", "dryRun": true })
                }
                _ => json!({}),
            };
            let request = Request::builder()
                .method("POST")
                .uri("/rpc")
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "method": entry.method,
                        "params": params
                    })
                    .to_string(),
                ))
                .expect("build request");

            let response = tokio::time::timeout(Duration::from_secs(5), app.clone().oneshot(request))
                .await
                .unwrap_or_else(|_| panic!("registered method `{}` timed out in dispatch", entry.method))
                .expect("rpc response");
            assert_eq!(response.status(), StatusCode::OK);
            let bytes = axum::body::to_bytes(response.into_body(), 8 * 1024 * 1024)
                .await
                .expect("read body");
            let payload: Value = serde_json::from_slice(&bytes).expect("parse json");

            if payload["ok"] == Value::Bool(false) {
                assert_ne!(
                    payload["error"]["code"],
                    Value::String("METHOD_NOT_FOUND".to_string()),
                    "registered method `{}` unexpectedly resolved as METHOD_NOT_FOUND",
                    entry.method
                );
                let error_message = payload["error"]["message"]
                    .as_str()
                    .unwrap_or_default()
                    .to_string();
                assert_ne!(
                    error_message, "Unhandled RPC method after registry resolution.",
                    "registered method `{}` is missing a dispatch arm in handle_rpc",
                    entry.method
                );
            }
        }
    }

    #[tokio::test]
    async fn rpc_health_returns_ok() {
        let app = test_router();
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(r#"{"method":"code_health","params":{}}"#))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(payload["result"]["status"], Value::String("ok".to_string()));
    }

    #[tokio::test]
    async fn rpc_capabilities_returns_method_catalog() {
        let app = test_router();
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{"method":"code_rpc_capabilities","params":{}}"#,
            ))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        let spec_path = Path::new(env!("CARGO_MANIFEST_DIR")).join(format!(
            "../../docs/runtime/spec/code-runtime-rpc-spec.{CODE_RUNTIME_RPC_CONTRACT_VERSION}.json"
        ));
        let frozen_spec_raw = fs::read_to_string(&spec_path).unwrap_or_else(|error| {
            panic!(
                "failed to read frozen rpc spec at {}: {error}",
                spec_path.display()
            )
        });
        let frozen_spec: Value =
            serde_json::from_str(frozen_spec_raw.as_str()).expect("parse frozen rpc spec");
        let actual_payload = payload["result"]
            .as_object()
            .expect("rpc response should include result object");
        let frozen_payload = frozen_spec["rpc"]
            .as_object()
            .expect("frozen rpc spec should include rpc object");

        for field in [
            "methodSetHash",
            "methods",
            "features",
            "contractVersion",
            "freezeEffectiveAt",
        ] {
            let actual = actual_payload
                .get(field)
                .unwrap_or_else(|| panic!("rpc response missing `{field}`"));
            let expected = frozen_payload
                .get(field)
                .unwrap_or_else(|| panic!("frozen rpc spec missing `{field}`"));
            assert_eq!(
                actual, expected,
                "rpc capabilities field `{field}` drifted from frozen spec"
            );
        }

        for field in ["errorCodes", "transports"] {
            let actual = actual_payload
                .get(field)
                .unwrap_or_else(|| panic!("rpc response missing `{field}`"));
            let expected = frozen_payload
                .get(field)
                .unwrap_or_else(|| panic!("frozen rpc spec missing `{field}`"));
            assert_eq!(
                actual, expected,
                "rpc capabilities field `{field}` drifted from frozen spec"
            );
        }

        assert_eq!(
            actual_payload["capabilities"]["rpc"]["invocationPolicies"]["code_turn_send"]["completionMode"],
            Value::String("events".to_string())
        );
        assert_eq!(
            actual_payload["capabilities"]["rpc"]["invocationPolicies"]["code_turn_send"]["ackTimeoutMs"],
            Value::Number(60_000u64.into())
        );
    }

    #[tokio::test]
    async fn native_rpc_capabilities_returns_native_method_namespace() {
        let app = test_router();
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{"method":"native_rpc_capabilities","params":{}}"#,
            ))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));

        let methods = payload["result"]["methods"]
            .as_array()
            .expect("native capabilities methods should be an array");
        assert!(!methods.is_empty());
        assert!(
            methods
                .iter()
                .all(|entry| entry.as_str().is_some_and(|method| method.starts_with("native_"))),
            "all methods should use native_ namespace"
        );
        assert!(
            methods.iter().any(
                |entry| entry.as_str() == Some("native_management_snapshot")
            ),
            "native capabilities should include native-only methods"
        );
        assert!(
            methods
                .iter()
                .any(|entry| entry.as_str() == Some("native_review_comments_list")),
            "native capabilities should include review comment methods"
        );
        let method_set_hash = payload["result"]["methodSetHash"]
            .as_str()
            .expect("methodSetHash should be present")
            .to_string();
        let method_strings = methods
            .iter()
            .map(|entry| {
                entry
                    .as_str()
                    .expect("method should be a string")
                    .to_string()
            })
            .collect::<Vec<_>>();
        assert_eq!(
            method_set_hash,
            hash_rpc_method_capabilities(method_strings.as_slice())
        );
        assert_eq!(
            payload["result"]["namespace"],
            Value::String("native".to_string())
        );
        assert_eq!(
            payload["result"]["eventMethods"],
            json!(["native_state_fabric_updated"])
        );
        assert_eq!(
            payload["result"]["capabilities"]["voice"]["vad"],
            Value::Bool(true)
        );
        assert_eq!(
            payload["result"]["capabilities"]["nativeCapabilitySchemaVersion"],
            Value::String("v2".to_string())
        );
        assert_eq!(
            payload["result"]["capabilities"]["fallback"]["threadLive"],
            Value::String("polling".to_string())
        );
        assert_eq!(
            payload["result"]["capabilities"]["uiLayers"]["reviewPanel"],
            Value::Bool(true)
        );
        assert_eq!(
            payload["result"]["capabilities"]["uiLayers"]["utilityPanel"],
            Value::Bool(true)
        );
        assert_eq!(
            payload["result"]["capabilities"]["tooling"]["plugins"],
            Value::Bool(false)
        );
        assert_eq!(
            payload["result"]["capabilities"]["tooling"]["skills"],
            Value::Bool(false)
        );
    }

    #[tokio::test]
    async fn native_management_snapshot_projects_unified_extension_catalog() {
        let app = test_router();

        let install_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_extension_install_v2",
                "params": {
                    "extensionId": "plugin-a",
                    "displayName": "Plugin A",
                    "name": "Plugin A",
                    "version": "1.0.0",
                    "kind": "host",
                    "distribution": "workspace",
                    "transport": "host-native",
                    "enabled": true,
                    "config": {}
                }
            }),
        )
        .await;
        assert_eq!(install_payload["ok"], Value::Bool(true));
        assert_eq!(
            install_payload["result"]["extensionId"],
            Value::String("plugin-a".to_string())
        );

        let snapshot_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "native_management_snapshot",
                "params": {}
            }),
        )
        .await;
        assert_eq!(snapshot_payload["ok"], Value::Bool(true));
        assert_eq!(
            snapshot_payload["result"]["plugins"].as_array().map(Vec::len),
            Some(1)
        );
        assert_eq!(
            snapshot_payload["result"]["plugins"][0]["extensionId"],
            Value::String("plugin-a".to_string())
        );
        let skills = snapshot_payload["result"]["skills"]
            .as_array()
            .expect("native management snapshot should include a skills array");
        assert!(skills.iter().all(|entry| {
            entry["kind"] == Value::String("instruction".to_string())
                && entry["extensionId"] != Value::String("plugin-a".to_string())
        }));
    }

    #[tokio::test]
    async fn extension_catalog_ignores_legacy_native_plugin_rows() {
        let db_path = temp_sqlite_db_path("runtime-legacy-plugin-catalog");
        cleanup_sqlite_db(db_path.as_path());
        let native_state_store =
            crate::native_state_store::NativeStateStore::new(db_path.to_path_buf());
        native_state_store.initialize_blocking();
        native_state_store
            .upsert_entity(
                crate::native_state_store::TABLE_NATIVE_PLUGINS,
                "plugin-a",
                Some(true),
                json!({
                    "name": "Plugin A",
                    "version": "1.0.0",
                    "publisher": "legacy-native"
                }),
            )
            .await
            .expect("insert legacy plugin row");

        let app = test_router_with_native_state_db_path(test_service_config(), db_path.as_path());
        let payload = send_rpc_request(
            app,
            json!({
                "method": "code_extension_catalog_list_v2",
                "params": {}
            }),
        )
        .await;

        assert_eq!(payload["ok"], Value::Bool(true));
        let extensions = payload["result"]
            .as_array()
            .expect("extension catalog response should be an array");
        assert!(
            !extensions
                .iter()
                .any(|entry| entry["extensionId"] == Value::String("plugin-a".to_string())),
            "legacy native plugin rows should not backfill the extension catalog"
        );

        cleanup_sqlite_db(db_path.as_path());
    }

    #[tokio::test]
    async fn native_only_tool_methods_validate_params_for_enabled_mutation() {
        let app = test_router();
        let payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "native_tool_set_enabled",
                "params": {
                    "toolId": "tool-a"
                }
            }),
        )
        .await;

        assert_eq!(payload["ok"], Value::Bool(false));
        assert_eq!(
            payload["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );
    }

    #[tokio::test]
    async fn native_review_comment_methods_support_crud_and_resolution_flow() {
        let app = test_router();

        let upsert_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "native_review_comment_upsert",
                "params": {
                    "workspaceId": "workspace-local",
                    "threadId": "thread-local",
                    "changeId": "src/main.rs",
                    "filePath": "src/main.rs",
                    "line": 42,
                    "side": "new",
                    "body": "Please extract this branch into a helper.",
                }
            }),
        )
        .await;
        assert_eq!(upsert_payload["ok"], Value::Bool(true));
        let comment_id = upsert_payload["result"]["id"]
            .as_str()
            .expect("upsert should return comment id")
            .to_string();

        let list_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "native_review_comments_list",
                "params": {
                    "workspaceId": "workspace-local",
                    "threadId": "thread-local",
                    "changeId": "src/main.rs",
                }
            }),
        )
        .await;
        assert_eq!(list_payload["ok"], Value::Bool(true));
        assert_eq!(list_payload["result"].as_array().map(Vec::len), Some(1));
        assert_eq!(
            list_payload["result"][0]["id"],
            Value::String(comment_id.clone())
        );

        let resolve_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "native_review_comment_set_resolved",
                "params": {
                    "commentId": comment_id,
                    "resolved": true
                }
            }),
        )
        .await;
        assert_eq!(resolve_payload["ok"], Value::Bool(true));
        assert_eq!(resolve_payload["result"]["resolved"], Value::Bool(true));
        assert!(resolve_payload["result"]["resolvedAt"].as_u64().is_some());

        let remove_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "native_review_comment_remove",
                "params": {
                    "commentId": resolve_payload["result"]["id"]
                }
            }),
        )
        .await;
        assert_eq!(remove_payload["ok"], Value::Bool(true));
        assert_eq!(remove_payload["result"], Value::Bool(true));
    }

    #[test]
    fn native_runtime_update_scope_mapping_covers_management_voice_and_workflow() {
        assert_eq!(
            runtime_update_scope_for_method("native_theme_set_active"),
            Some(&["themes", "settings"][..])
        );
        assert_eq!(
            runtime_update_scope_for_method("native_schedule_run_now"),
            Some(&["schedules", "workflow"][..])
        );
        assert_eq!(
            runtime_update_scope_for_method("native_voice_hotkey_set"),
            Some(&["voice", "settings"][..])
        );
        assert_eq!(
            runtime_update_scope_for_method("native_review_comment_set_resolved"),
            Some(&["review"][..])
        );
    }

    #[test]
    fn native_state_fabric_updated_reason_uses_native_method_name() {
        assert_eq!(
            crate::native_runtime::runtime_updated_reason_for_request(
                "native_settings_set",
                "code_settings_set"
            ),
            "native_settings_set".to_string()
        );
        assert_eq!(
            crate::native_runtime::runtime_updated_reason_for_request(
                "native_theme_set_active",
                "native_theme_set_active"
            ),
            "native_theme_set_active".to_string()
        );
    }

    #[tokio::test]
    async fn native_rpc_batch_preserves_requested_method_names_and_native_capabilities() {
        let app = test_router();
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{"method":"native_rpc_batch","params":{"requests":[{"method":"native_rpc_capabilities","params":{}}]}}"#,
            ))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(
            payload["result"]["responses"][0]["method"],
            Value::String("native_rpc_capabilities".to_string())
        );
        assert_eq!(
            payload["result"]["responses"][0]["result"]["namespace"],
            Value::String("native".to_string())
        );
    }

    #[tokio::test]
    async fn runtime_backend_registry_rpc_supports_crud_and_state_transitions() {
        let app = test_router();

        let upsert_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_backend_upsert",
                "params": {
                    "backendId": "worker-us-east-1a",
                    "displayName": "US East Worker",
                    "capabilities": ["plan", "code"],
                    "maxConcurrency": 8,
                    "costTier": "standard",
                    "latencyClass": "regional",
                    "rolloutState": "ramping",
                    "status": "active",
                    "backendClass": "primary",
                    "specializations": ["cpu"],
                    "connectivity": {
                        "mode": "overlay",
                        "overlay": "tailscale",
                        "endpoint": "worker-us-east-1a.tailnet:4732",
                        "reachability": "reachable"
                    },
                    "lease": {
                        "status": "active",
                        "scope": "node",
                        "holderId": "desktop-primary"
                    }
                }
            }),
        )
        .await;
        assert_eq!(upsert_payload["ok"], Value::Bool(true));
        assert_eq!(
            upsert_payload["result"]["backendId"],
            Value::String("worker-us-east-1a".to_string())
        );
        assert_eq!(
            upsert_payload["result"]["status"],
            Value::String("active".to_string())
        );
        assert_eq!(upsert_payload["result"]["healthy"], Value::Bool(true));
        assert_eq!(upsert_payload["result"]["failures"], Value::Number(0.into()));
        assert_eq!(upsert_payload["result"]["queueDepth"], Value::Number(0.into()));
        assert_eq!(
            upsert_payload["result"]["backendClass"],
            Value::String("primary".to_string())
        );
        assert_eq!(
            upsert_payload["result"]["connectivity"]["overlay"],
            Value::String("tailscale".to_string())
        );
        assert_eq!(
            upsert_payload["result"]["lease"]["holderId"],
            Value::String("desktop-primary".to_string())
        );

        let list_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_backends_list",
                "params": {}
            }),
        )
        .await;
        assert_eq!(list_payload["ok"], Value::Bool(true));
        assert_eq!(list_payload["result"].as_array().map(Vec::len), Some(1));
        assert_eq!(
            list_payload["result"][0]["backendId"],
            Value::String("worker-us-east-1a".to_string())
        );
        assert_eq!(
            list_payload["result"][0]["diagnostics"]["availability"],
            Value::String("available".to_string())
        );

        let set_state_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_backend_set_state",
                "params": {
                    "backendId": "worker-us-east-1a",
                    "status": "draining",
                    "rolloutState": "current"
                }
            }),
        )
        .await;
        assert_eq!(set_state_payload["ok"], Value::Bool(true));
        assert_eq!(
            set_state_payload["result"]["status"],
            Value::String("draining".to_string())
        );
        assert_eq!(
            set_state_payload["result"]["rolloutState"],
            Value::String("current".to_string())
        );
        assert_eq!(set_state_payload["result"]["healthy"], Value::Bool(false));

        let remove_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_backend_remove",
                "params": {
                    "backendId": "worker-us-east-1a"
                }
            }),
        )
        .await;
        assert_eq!(remove_payload["ok"], Value::Bool(true));
        assert_eq!(remove_payload["result"], Value::Bool(true));
    }

    #[tokio::test]
    async fn runtime_backend_registry_persists_native_backends_across_restart() {
        let db_path = temp_sqlite_db_path("runtime-backends-persist");
        cleanup_sqlite_db(db_path.as_path());

        {
            let app = test_router_with_native_state_db_path(test_service_config(), db_path.as_path());
            let upsert_payload = send_rpc_request(
                app,
                json!({
                    "method": "code_runtime_backend_upsert",
                    "params": {
                        "backendId": "worker-persisted",
                        "displayName": "Persisted Worker",
                        "capabilities": ["code"],
                        "maxConcurrency": 4,
                        "costTier": "standard",
                        "latencyClass": "regional",
                        "rolloutState": "current",
                        "status": "active",
                        "backendClass": "burst",
                        "connectivity": {
                            "mode": "overlay",
                            "overlay": "tailscale",
                            "endpoint": "worker-persisted.tailnet:4732",
                            "reachability": "reachable"
                        }
                    }
                }),
            )
            .await;
            assert_eq!(upsert_payload["ok"], Value::Bool(true));
        }

        {
            let app = test_router_with_native_state_db_path(test_service_config(), db_path.as_path());
            let list_payload = send_rpc_request(
                app.clone(),
                json!({
                    "method": "code_runtime_backends_list",
                    "params": {}
                }),
            )
            .await;
            assert_eq!(list_payload["ok"], Value::Bool(true));
            assert_eq!(
                list_payload["result"]
                    .as_array()
                    .is_some_and(|entries| entries.iter().any(|entry| entry["backendId"] == "worker-persisted")),
                true
            );

            let remove_payload = send_rpc_request(
                app,
                json!({
                    "method": "code_runtime_backend_remove",
                    "params": {
                        "backendId": "worker-persisted"
                    }
                }),
            )
            .await;
            assert_eq!(remove_payload["ok"], Value::Bool(true));
            assert_eq!(remove_payload["result"], Value::Bool(true));
        }

        {
            let app = test_router_with_native_state_db_path(test_service_config(), db_path.as_path());
            let list_payload = send_rpc_request(
                app,
                json!({
                    "method": "code_runtime_backends_list",
                    "params": {}
                }),
            )
            .await;
            assert_eq!(list_payload["ok"], Value::Bool(true));
            assert_eq!(
                list_payload["result"]
                    .as_array()
                    .is_some_and(|entries| entries.iter().any(|entry| entry["backendId"] == "worker-persisted")),
                false
            );
        }

        cleanup_sqlite_db(db_path.as_path());
    }

    #[tokio::test]
    async fn runtime_backend_set_state_validates_lifecycle_transitions() {
        let app = test_router();
        let _ = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_backend_upsert",
                "params": {
                    "backendId": "worker-transition",
                    "displayName": "Transition Worker",
                    "capabilities": ["code"],
                    "maxConcurrency": 4,
                    "costTier": "standard",
                    "latencyClass": "regional",
                    "rolloutState": "drained",
                    "status": "active"
                }
            }),
        )
        .await;

        let invalid_transition = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_backend_set_state",
                "params": {
                    "backendId": "worker-transition",
                    "rolloutState": "current"
                }
            }),
        )
        .await;
        assert_eq!(invalid_transition["ok"], Value::Bool(false));
        assert_eq!(
            invalid_transition["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );

        let forced_transition = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_backend_set_state",
                "params": {
                    "backendId": "worker-transition",
                    "rolloutState": "current",
                    "force": true
                }
            }),
        )
        .await;
        assert_eq!(forced_transition["ok"], Value::Bool(true));
        assert_eq!(
            forced_transition["result"]["rolloutState"],
            Value::String("current".to_string())
        );
    }

    #[tokio::test]
    async fn acp_integration_rpc_projects_backend_and_routes_state_changes() {
        let app = test_router();

        let upsert_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_acp_integration_upsert",
                "params": {
                    "integrationId": "agent-a",
                    "displayName": "ACP Agent A",
                    "state": "active",
                    "backendClass": "specialized",
                    "specializations": ["gpu", "vision"],
                    "transportConfig": {
                        "transport": "stdio",
                        "command": "/bin/sh",
                        "args": ["-lc", "true"]
                    },
                    "capabilities": ["general"],
                    "maxConcurrency": 1,
                    "costTier": "standard",
                    "latencyClass": "standard"
                }
            }),
        )
        .await;
        assert_eq!(upsert_payload["ok"], Value::Bool(true));
        assert_eq!(
            upsert_payload["result"]["integrationId"],
            Value::String("agent-a".to_string())
        );
        assert_eq!(
            upsert_payload["result"]["backendId"],
            Value::String("acp:agent-a".to_string())
        );
        assert_eq!(
            upsert_payload["result"]["transport"],
            Value::String("stdio".to_string())
        );
        assert_eq!(
            upsert_payload["result"]["backendClass"],
            Value::String("specialized".to_string())
        );

        let list_integrations_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_acp_integrations_list",
                "params": {}
            }),
        )
        .await;
        assert_eq!(list_integrations_payload["ok"], Value::Bool(true));
        assert_eq!(list_integrations_payload["result"].as_array().map(Vec::len), Some(1));

        let list_backends_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_backends_list",
                "params": {}
            }),
        )
        .await;
        assert_eq!(list_backends_payload["ok"], Value::Bool(true));
        assert_eq!(
            list_backends_payload["result"][0]["backendKind"],
            Value::String("acp".to_string())
        );
        assert_eq!(
            list_backends_payload["result"][0]["origin"],
            Value::String("acp-projection".to_string())
        );
        assert_eq!(
            list_backends_payload["result"][0]["integrationId"],
            Value::String("agent-a".to_string())
        );
        assert_eq!(
            list_backends_payload["result"][0]["backendClass"],
            Value::String("specialized".to_string())
        );

        let invalid_backend_mutation_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_backend_set_state",
                "params": {
                    "backendId": "acp:agent-a",
                    "status": "disabled"
                }
            }),
        )
        .await;
        assert_eq!(invalid_backend_mutation_payload["ok"], Value::Bool(false));
        assert_eq!(
            invalid_backend_mutation_payload["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );

        let set_state_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_acp_integration_set_state",
                "params": {
                    "integrationId": "agent-a",
                    "state": "disabled"
                }
            }),
        )
        .await;
        assert_eq!(set_state_payload["ok"], Value::Bool(true));
        assert_eq!(
            set_state_payload["result"]["state"],
            Value::String("disabled".to_string())
        );

        let remove_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_acp_integration_remove",
                "params": {
                    "integrationId": "agent-a"
                }
            }),
        )
        .await;
        assert_eq!(remove_payload["ok"], Value::Bool(true));
        assert_eq!(remove_payload["result"], Value::Bool(true));
    }
