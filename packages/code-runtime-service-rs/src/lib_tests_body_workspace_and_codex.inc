    #[tokio::test]
    async fn rpc_health_canonical_returns_ok() {
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
    async fn rpc_cli_sessions_list_returns_array() {
        let app = test_router();
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{"method":"code_cli_sessions_list","params":{}}"#,
            ))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        assert!(payload["result"].is_array());
    }

    #[tokio::test]
    async fn rpc_terminal_input_raw_accepts_canonical_method_and_snake_case_fields() {
        let app = test_router();

        let open_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_terminal_open",
                "params": {
                    "workspaceId": "workspace-web"
                }
            }),
        )
        .await;
        assert_eq!(open_payload["ok"], Value::Bool(true));
        let session_id = open_payload["result"]["id"]
            .as_str()
            .expect("terminal open should return session id")
            .to_string();

        let canonical_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                json!({
                    "method": "code_terminal_input_raw",
                    "params": {
                        "sessionId": session_id,
                        "input": if cfg!(target_os = "windows") {
                            "echo runtime-terminal-canonical\r\n"
                        } else {
                            "echo runtime-terminal-canonical\n"
                        }
                    }
                })
                .to_string(),
            ))
            .expect("build canonical request");
        let canonical_response = app
            .clone()
            .oneshot(canonical_request)
            .await
            .expect("canonical rpc response");
        let canonical_bytes = axum::body::to_bytes(canonical_response.into_body(), 1024 * 1024)
            .await
            .expect("read canonical body");
        let canonical_payload: Value =
            serde_json::from_slice(&canonical_bytes).expect("parse canonical json");
        assert_eq!(canonical_payload["ok"], Value::Bool(true));
        assert_eq!(canonical_payload["result"], Value::Bool(true));

        let alias_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                json!({
                    "method": "code_terminal_input_raw",
                    "params": {
                        "session_id": session_id,
                        "input": if cfg!(target_os = "windows") {
                            "echo runtime-terminal-alias\r\n"
                        } else {
                            "echo runtime-terminal-alias\n"
                        }
                    }
                })
                .to_string(),
            ))
            .expect("build snake_case request");
        let alias_response = app
            .oneshot(alias_request)
            .await
            .expect("snake_case rpc response");
        let alias_bytes = axum::body::to_bytes(alias_response.into_body(), 1024 * 1024)
            .await
            .expect("read snake_case body");
        let alias_payload: Value =
            serde_json::from_slice(&alias_bytes).expect("parse snake_case json");
        assert_eq!(alias_payload["ok"], Value::Bool(true));
        assert_eq!(alias_payload["result"], Value::Bool(true));
    }

    #[tokio::test]
    async fn rpc_terminal_open_status_and_read_use_real_runtime_terminal() {
        let app = test_router();

        let status_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_terminal_status",
                "params": {}
            }),
        )
        .await;
        assert_eq!(status_payload["ok"], Value::Bool(true));
        assert_eq!(
            status_payload["result"]["state"],
            Value::String("ready".to_string())
        );
        assert!(status_payload["result"].get("available").is_none());

        let open_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_terminal_open",
                "params": {
                    "workspaceId": "workspace-web"
                }
            }),
        )
        .await;
        assert_eq!(open_payload["ok"], Value::Bool(true));
        assert_eq!(
            open_payload["result"]["state"],
            Value::String("created".to_string())
        );
        assert!(open_payload["result"].get("active").is_none());
        let open_lines = open_payload["result"]["lines"]
            .as_array()
            .expect("terminal open should return lines");
        assert!(open_lines.iter().all(|line| {
            line.as_str()
                .is_some_and(|value| value != "Terminal is not available in code-runtime-service-rs.")
        }));

        let session_id = open_payload["result"]["id"]
            .as_str()
            .expect("terminal open should return session id")
            .to_string();
        let marker = "runtime-terminal-read-marker";

        let mut saw_marker = false;
        let mut last_lines = Vec::new();
        let command = format!("echo {marker}");

        for attempt in 0..3 {
            let input_payload = send_rpc_request(
                app.clone(),
                json!({
                    "method": "code_terminal_write",
                    "params": {
                        "sessionId": session_id,
                        "input": command,
                    }
                }),
            )
            .await;

            assert_eq!(input_payload["ok"], Value::Bool(true));

            for _ in 0..80 {
                let read_payload = send_rpc_request(
                    app.clone(),
                    json!({
                        "method": "code_terminal_read",
                        "params": {
                            "sessionId": session_id
                        }
                    }),
                )
                .await;
                assert_eq!(read_payload["ok"], Value::Bool(true));
                let Some(lines) = read_payload["result"]["lines"].as_array() else {
                    tokio::time::sleep(Duration::from_millis(50)).await;
                    continue;
                };
                last_lines = lines
                    .iter()
                    .filter_map(Value::as_str)
                    .map(ToString::to_string)
                    .collect::<Vec<_>>();
                if lines
                    .iter()
                    .any(|line| line.as_str().is_some_and(|value| value.contains(marker)))
                {
                    saw_marker = true;
                    break;
                }
                tokio::time::sleep(Duration::from_millis(50)).await;
            }

            if saw_marker || attempt == 2 {
                break;
            }

            tokio::time::sleep(Duration::from_millis(150)).await;
        }

        assert!(
            saw_marker,
            "expected terminal read to include marker output; last lines: {:?}",
            last_lines
        );
    }

    #[tokio::test]
    async fn workspace_create_then_list() {
        let app = test_router();
        let create = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{"method":"code_workspace_create","params":{"path":"/tmp/demo","displayName":"Demo"}}"#,
            ))
            .expect("build create request");
        let _ = app.clone().oneshot(create).await.expect("create workspace");

        let list = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{"method":"code_workspaces_list","params":{}}"#,
            ))
            .expect("build list request");

        let response = app.oneshot(list).await.expect("list workspace");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        let workspaces = payload["result"].as_array().expect("workspace array");
        assert!(workspaces
            .iter()
            .any(|entry| entry["displayName"] == "Demo"));
    }

    #[tokio::test]
    async fn workspace_create_accepts_canonical_method_and_snake_case_payload() {
        let app = test_router();
        let create = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{"method":"code_workspace_create","params":{"path":"/tmp/demo-alias","display_name":"Demo Alias"}}"#,
            ))
            .expect("build create request");
        let _ = app.clone().oneshot(create).await.expect("create workspace");

        let list = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{"method":"code_workspaces_list","params":{}}"#,
            ))
            .expect("build list request");

        let response = app.oneshot(list).await.expect("list workspace");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        let workspaces = payload["result"].as_array().expect("workspace array");
        assert!(workspaces
            .iter()
            .any(|entry| entry["displayName"] == "Demo Alias"));
    }

    #[tokio::test]
    async fn workspace_create_reuses_existing_workspace_for_duplicate_path() {
        let app = test_router();
        let first = send_rpc_request(
            app.clone(),
            json!({
              "method": "code_workspace_create",
              "params": {
                "path": "/tmp/runtime-duplicate-demo",
                "displayName": "Duplicate Demo"
              }
            }),
        )
        .await;
        assert_eq!(first["ok"], Value::Bool(true));

        let second = send_rpc_request(
            app.clone(),
            json!({
              "method": "code_workspace_create",
              "params": {
                "path": "/tmp/runtime-duplicate-demo/",
                "displayName": "Duplicate Demo Again"
              }
            }),
        )
        .await;
        assert_eq!(second["ok"], Value::Bool(true));
        assert_eq!(first["result"]["id"], second["result"]["id"]);

        let list_payload = send_rpc_request(
            app,
            json!({
              "method": "code_workspaces_list",
              "params": {}
            }),
        )
        .await;
        let duplicate_matches = list_payload["result"]
            .as_array()
            .map(|entries| {
                entries
                    .iter()
                    .filter(|entry| entry["path"] == "/tmp/runtime-duplicate-demo")
                    .count()
            })
            .unwrap_or_default();
        assert_eq!(duplicate_matches, 1, "workspace list should dedupe duplicate paths");
    }

    #[tokio::test]
    async fn workspace_mutations_persist_across_runtime_restart() {
        let db_path = temp_sqlite_db_path("runtime-workspaces-persist");
        cleanup_sqlite_db(db_path.as_path());

        let created_workspace_id = {
            let app = test_router_with_native_state_db_path(test_service_config(), db_path.as_path());
            let create_payload = send_rpc_request(
                app,
                json!({
                  "method": "code_workspace_create",
                  "params": {
                    "path": "/tmp/runtime-persist-demo",
                    "displayName": "Persisted Demo"
                  }
                }),
            )
            .await;
            assert_eq!(create_payload["ok"], Value::Bool(true));
            create_payload["result"]["id"]
                .as_str()
                .expect("workspace id")
                .to_string()
        };

        {
            let app = test_router_with_native_state_db_path(test_service_config(), db_path.as_path());
            let list_payload = send_rpc_request(
                app.clone(),
                json!({
                  "method": "code_workspaces_list",
                  "params": {}
                }),
            )
            .await;
            let persisted_workspace = list_payload["result"]
                .as_array()
                .and_then(|entries| entries.iter().find(|entry| entry["id"] == created_workspace_id))
                .expect("workspace should survive restart");
            assert_eq!(
                persisted_workspace["displayName"],
                Value::String("Persisted Demo".to_string())
            );

            let rename_payload = send_rpc_request(
                app,
                json!({
                  "method": "code_workspace_rename",
                  "params": {
                    "workspaceId": created_workspace_id,
                    "displayName": "Persisted Demo Renamed"
                  }
                }),
            )
            .await;
            assert_eq!(rename_payload["ok"], Value::Bool(true));
        }

        {
            let app = test_router_with_native_state_db_path(test_service_config(), db_path.as_path());
            let list_payload = send_rpc_request(
                app.clone(),
                json!({
                  "method": "code_workspaces_list",
                  "params": {}
                }),
            )
            .await;
            let renamed_workspace = list_payload["result"]
                .as_array()
                .and_then(|entries| entries.iter().find(|entry| entry["id"] == created_workspace_id))
                .expect("renamed workspace should survive restart");
            assert_eq!(
                renamed_workspace["displayName"],
                Value::String("Persisted Demo Renamed".to_string())
            );

            let remove_payload = send_rpc_request(
                app,
                json!({
                  "method": "code_workspace_remove",
                  "params": {
                    "workspaceId": created_workspace_id
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
                  "method": "code_workspaces_list",
                  "params": {}
                }),
            )
            .await;
            let still_exists = list_payload["result"]
                .as_array()
                .is_some_and(|entries| entries.iter().any(|entry| entry["id"] == created_workspace_id));
            assert!(!still_exists, "workspace remove should survive restart");
        }

        cleanup_sqlite_db(db_path.as_path());
    }

    #[tokio::test]
    async fn workspace_hydration_dedupes_persisted_duplicate_paths() {
        let db_path = temp_sqlite_db_path("runtime-workspaces-dedupe");
        cleanup_sqlite_db(db_path.as_path());
        let native_state_store =
            crate::native_state_store::NativeStateStore::new(db_path.to_path_buf());
        native_state_store.initialize_blocking();
        native_state_store
            .upsert_setting_value_blocking(
                crate::native_state_store::TABLE_NATIVE_RUNTIME_STATE_KV,
                RUNTIME_WORKSPACES_STATE_KEY,
                json!([
                    {
                        "id": "workspace-dup-a",
                        "path": "/tmp/runtime-dedupe-demo",
                        "displayName": "Duplicate A",
                        "connected": true
                    },
                    {
                        "id": "workspace-dup-b",
                        "path": "/tmp/runtime-dedupe-demo/",
                        "displayName": "Duplicate B",
                        "connected": true
                    }
                ]),
            )
            .expect("seed duplicate workspaces");

        let app = test_router_with_native_state_db_path(test_service_config(), db_path.as_path());
        let list_payload = send_rpc_request(
            app,
            json!({
              "method": "code_workspaces_list",
              "params": {}
            }),
        )
        .await;
        let deduped_entries = list_payload["result"]
            .as_array()
            .expect("workspace array");
        let duplicate_matches = deduped_entries
            .iter()
            .filter(|entry| {
                let path = entry["path"].as_str().unwrap_or_default();
                path == "/tmp/runtime-dedupe-demo" || path == "/tmp/runtime-dedupe-demo/"
            })
            .count();
        assert_eq!(duplicate_matches, 1, "hydration should drop duplicate workspace paths");

        cleanup_sqlite_db(db_path.as_path());
    }

    #[tokio::test]
    async fn workspace_hydration_refreshes_default_web_workspace_path_from_env() {
        static DEFAULT_WORKSPACE_ENV_LOCK: std::sync::LazyLock<std::sync::Mutex<()>> =
            std::sync::LazyLock::new(|| std::sync::Mutex::new(()));

        let _guard = DEFAULT_WORKSPACE_ENV_LOCK
            .lock()
            .expect("default workspace env lock poisoned");
        let previous = std::env::var_os("CODE_RUNTIME_SERVICE_DEFAULT_WORKSPACE_PATH");
        let expected_path = std::env::temp_dir().join(format!(
            "runtime-default-web-workspace-{}",
            rand::random::<u64>()
        ));

        unsafe {
            std::env::set_var(
                "CODE_RUNTIME_SERVICE_DEFAULT_WORKSPACE_PATH",
                expected_path.as_os_str(),
            );
        }

        let db_path = temp_sqlite_db_path("runtime-workspaces-default-refresh");
        cleanup_sqlite_db(db_path.as_path());
        let native_state_store =
            crate::native_state_store::NativeStateStore::new(db_path.to_path_buf());
        native_state_store.initialize_blocking();
        native_state_store
            .upsert_setting_value_blocking(
                crate::native_state_store::TABLE_NATIVE_RUNTIME_STATE_KV,
                RUNTIME_WORKSPACES_STATE_KEY,
                json!([
                    {
                        "id": "workspace-web",
                        "path": "/tmp/stale-default-workspace",
                        "displayName": "Web Workspace",
                        "connected": true
                    },
                    {
                        "id": "workspace-demo",
                        "path": "/tmp/runtime-demo",
                        "displayName": "Demo",
                        "connected": true
                    }
                ]),
            )
            .expect("seed stale default workspace");

        let app = test_router_with_native_state_db_path(test_service_config(), db_path.as_path());
        let list_payload = send_rpc_request(
            app,
            json!({
              "method": "code_workspaces_list",
              "params": {}
            }),
        )
        .await;
        let entries = list_payload["result"]
            .as_array()
            .expect("workspace array");
        let web_workspace = entries
            .iter()
            .find(|entry| entry["id"] == "workspace-web")
            .expect("web workspace should exist");
        assert_eq!(
            web_workspace["path"].as_str().unwrap_or_default(),
            expected_path.to_string_lossy()
        );

        unsafe {
            match previous {
                Some(value) => {
                    std::env::set_var("CODE_RUNTIME_SERVICE_DEFAULT_WORKSPACE_PATH", value)
                }
                None => std::env::remove_var("CODE_RUNTIME_SERVICE_DEFAULT_WORKSPACE_PATH"),
            }
        }
        cleanup_sqlite_db(db_path.as_path());
    }

    #[tokio::test]
    #[ignore = "manual codex capability simulation; requires CODEX_CAPABILITY_SIM_TEST=1"]
    async fn codex_simulated_project_crud_upgrade_flow_is_supported() {
        if std::env::var("CODEX_CAPABILITY_SIM_TEST").ok().as_deref() != Some("1") {
            eprintln!(
                "skip codex simulated project CRUD+upgrade flow: set CODEX_CAPABILITY_SIM_TEST=1 to run"
            );
            return;
        }

        let workspace_root = std::env::temp_dir().join(format!(
            "code-runtime-codex-crud-upgrade-{}",
            rand::random::<u64>()
        ));
        std::fs::create_dir_all(workspace_root.as_path()).expect("create workspace root");

        let app = test_router();
        let create_payload = send_rpc_request(
            app.clone(),
            json!({
              "method": "code_workspace_create",
              "params": {
                "path": workspace_root.to_string_lossy().to_string(),
                "displayName": "Codex CRUD Demo"
              }
            }),
        )
        .await;
        assert_eq!(create_payload["ok"], Value::Bool(true));
        let workspace_id = create_payload["result"]["id"]
            .as_str()
            .expect("workspace id")
            .to_string();

        let list_after_create = send_rpc_request(
            app.clone(),
            json!({
              "method": "code_workspaces_list",
              "params": {}
            }),
        )
        .await;
        let created_workspace = list_after_create["result"]
            .as_array()
            .and_then(|entries| entries.iter().find(|entry| entry["id"] == workspace_id))
            .expect("created workspace should exist");
        assert_eq!(
            created_workspace["displayName"],
            Value::String("Codex CRUD Demo".to_string())
        );

        let write_payload = send_rpc_request(
            app.clone(),
            json!({
              "method": "code_live_skill_execute",
              "params": {
                "skillId": "core-write",
                "input": "",
                "options": {
                  "workspaceId": workspace_id,
                  "path": "demo/package.json",
                  "content": "{\"name\":\"codex-demo\",\"version\":\"0.1.0\"}"
                }
              }
            }),
        )
        .await;
        assert_eq!(write_payload["ok"], Value::Bool(true));
        assert_eq!(
            write_payload["result"]["status"],
            Value::String("completed".to_string())
        );

        let edit_payload = send_rpc_request(
            app.clone(),
            json!({
              "method": "code_live_skill_execute",
              "params": {
                "skillId": "core-edit",
                "input": "",
                "options": {
                  "workspaceId": workspace_id,
                  "path": "demo/package.json",
                  "find": "\"version\":\"0.1.0\"",
                  "replace": "\"version\":\"0.2.0\",\"description\":\"upgraded-by-codex\""
                }
              }
            }),
        )
        .await;
        assert_eq!(edit_payload["ok"], Value::Bool(true));
        assert_eq!(
            edit_payload["result"]["status"],
            Value::String("completed".to_string())
        );

        let read_payload = send_rpc_request(
            app.clone(),
            json!({
              "method": "code_live_skill_execute",
              "params": {
                "skillId": "core-read",
                "input": "",
                "options": {
                  "workspaceId": workspace_id,
                  "path": "demo/package.json"
                }
              }
            }),
        )
        .await;
        assert_eq!(read_payload["ok"], Value::Bool(true));
        let package_json_output = read_payload["result"]["output"]
            .as_str()
            .expect("package json output");
        assert!(package_json_output.contains("\"version\":\"0.2.0\""));
        assert!(package_json_output.contains("\"description\":\"upgraded-by-codex\""));

        let rename_payload = send_rpc_request(
            app.clone(),
            json!({
              "method": "code_workspace_rename",
              "params": {
                "workspaceId": workspace_id,
                "displayName": "Codex CRUD Demo v2"
              }
            }),
        )
        .await;
        assert_eq!(rename_payload["ok"], Value::Bool(true));
        assert_eq!(
            rename_payload["result"]["displayName"],
            Value::String("Codex CRUD Demo v2".to_string())
        );

        let remove_payload = send_rpc_request(
            app.clone(),
            json!({
              "method": "code_workspace_remove",
              "params": {
                "workspaceId": workspace_id
              }
            }),
        )
        .await;
        assert_eq!(remove_payload["ok"], Value::Bool(true));
        assert_eq!(remove_payload["result"], Value::Bool(true));

        let list_after_remove = send_rpc_request(
            app,
            json!({
              "method": "code_workspaces_list",
              "params": {}
            }),
        )
        .await;
        let still_exists = list_after_remove["result"]
            .as_array()
            .is_some_and(|entries| entries.iter().any(|entry| entry["id"] == workspace_id));
        assert!(!still_exists, "workspace should be removed after delete");

        let _ = std::fs::remove_dir_all(workspace_root);
    }

    #[tokio::test]
    #[ignore = "manual real codex agent test; requires CODEX_REAL_AGENT_TEST=1 and token budget acknowledgement"]
    async fn codex_real_agent_project_crud_upgrade_flow_is_supported() {
        if std::env::var("CODEX_REAL_AGENT_TEST").ok().as_deref() != Some("1") {
            eprintln!("skip real codex agent flow: set CODEX_REAL_AGENT_TEST=1 to run");
            return;
        }
        if std::env::var("CODEX_REAL_AGENT_TEST_ACK").ok().as_deref() != Some("I_ACCEPT_TOKEN_COST")
        {
            eprintln!(
                "skip real codex agent flow: set CODEX_REAL_AGENT_TEST_ACK=I_ACCEPT_TOKEN_COST"
            );
            return;
        }

        let workspace_root = std::env::temp_dir().join(format!(
            "code-runtime-codex-real-agent-{}",
            rand::random::<u64>()
        ));
        std::fs::create_dir_all(workspace_root.as_path()).expect("create real-agent workspace");

        let prompt = [
            "In this directory, complete all steps in order:",
            "1. Create demo/package.json with JSON: {\"name\":\"codex-real-demo\",\"version\":\"0.1.0\"}.",
            "2. Upgrade that file so final JSON contains version 0.2.0 and description upgraded-by-real-codex.",
            "3. Create demo/tmp.txt with any text, then delete demo/tmp.txt.",
            "4. Do not modify files outside demo/.",
            "Return a short completion summary.",
        ]
        .join(" ");
        let output = tokio::process::Command::new("codex")
            .arg("exec")
            .arg("--ephemeral")
            .arg("--skip-git-repo-check")
            .arg("--dangerously-bypass-approvals-and-sandbox")
            .arg("-C")
            .arg(workspace_root.as_path())
            .arg(prompt)
            .output()
            .await
            .expect("run real codex agent");

        let stdout = String::from_utf8_lossy(output.stdout.as_slice()).to_string();
        let stderr = String::from_utf8_lossy(output.stderr.as_slice()).to_string();
        assert!(
            output.status.success(),
            "real codex agent command failed: status={:?}, stdout={}, stderr={}",
            output.status.code(),
            stdout,
            stderr
        );

        let package_path = workspace_root.join("demo").join("package.json");
        let package_content =
            std::fs::read_to_string(package_path.as_path()).expect("read real-agent package.json");
        assert!(
            package_content.contains("\"version\":\"0.2.0\"")
                || package_content.contains("\"version\": \"0.2.0\""),
            "expected upgraded version in package.json, got: {}",
            package_content
        );
        assert!(
            package_content.contains("upgraded-by-real-codex"),
            "expected upgraded-by-real-codex marker in package.json, got: {}",
            package_content
        );

        let tmp_path = workspace_root.join("demo").join("tmp.txt");
        assert!(
            !tmp_path.exists(),
            "expected demo/tmp.txt to be deleted by real codex agent"
        );

        let _ = std::fs::remove_dir_all(workspace_root);
    }

    #[tokio::test]
    async fn unsupported_method_returns_method_not_found_error_code() {
        let app = test_router();
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{"method":"code_unknown_method","params":{}}"#,
            ))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(false));
        assert_eq!(
            payload["error"]["code"],
            Value::String("METHOD_NOT_FOUND".to_string())
        );
    }

    #[tokio::test]
    async fn turn_send_rejects_snake_case_payload_fields() {
        let app = test_router();
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_turn_send",
                  "params":{
                    "payload":{
                      "workspace_id":"workspace-web",
                      "thread_id":"thread-legacy",
                      "content":"Ping",
                      "model_id":"gpt-5.3-codex",
                      "reason_effort":"high",
                      "access_mode":"on-request",
                      "execution_mode":"runtime",
                      "queue": false,
                      "attachments":[]
                    }
                  }
                }"#,
            ))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(false));
        assert_eq!(
            payload["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );
    }

