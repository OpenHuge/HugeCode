    #[tokio::test]
    async fn rpc_providers_catalog_returns_alias_metadata() {
        let app = test_router();
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{"method":"code_providers_catalog","params":{}}"#,
            ))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));

        let result = payload["result"]
            .as_array()
            .expect("providers catalog should be an array");
        assert!(result.iter().all(|entry| {
            entry["registryVersion"] == Value::String(CODE_RUNTIME_RPC_CONTRACT_VERSION.to_string())
        }));
        assert!(result.iter().any(|entry| {
            entry["providerId"] == Value::String("google".to_string())
                && entry["pool"] == Value::String("gemini".to_string())
                && entry["oauthProviderId"] == Value::String("gemini".to_string())
                && entry["capabilityMatrix"]["supportedReasoningEfforts"]
                    == json!(["low", "medium", "high"])
                && entry["aliases"].as_array().is_some_and(|aliases| {
                    aliases.contains(&Value::String("antigravity".to_string()))
                })
        }));
        assert!(result.iter().any(|entry| {
            entry["providerId"] == Value::String("claude_code_local".to_string())
                && entry["pool"] == Value::Null
                && entry["oauthProviderId"] == Value::Null
                && entry["capabilityMatrix"]["supportsTools"]
                    == Value::String("supported".to_string())
                && entry["supportsOpenaiCompat"] == Value::Bool(false)
        }));
    }

    #[cfg(target_os = "macos")]
    #[tokio::test]
    async fn rpc_providers_catalog_keeps_local_claude_available_when_install_and_auth_are_ready() {
        let _guard = local_claude_exec_env_lock()
            .lock()
            .expect("local claude exec env lock poisoned");
        let previous_override = std::env::var_os(CODE_RUNTIME_LOCAL_CLAUDE_EXEC_PATH_ENV);
        let temp = TempDir::new().expect("create temp dir");
        let script_path = temp.path().join("fake-claude.sh");
        let script = r#"#!/bin/sh
if [ "$1" = "-v" ] || [ "$1" = "--version" ]; then
  printf 'claude 2.1.81\n'
  exit 0
fi

if [ "$1" = "auth" ] && [ "$2" = "status" ] && [ "$3" = "--json" ]; then
  printf '{"loggedIn":true,"authMethod":"oauth_token","apiProvider":"firstParty"}\n'
  exit 0
fi

if [ "$1" = "--print" ]; then
  sleep 6
  printf '%s\n' '{"type":"system","subtype":"init","session_id":"session-123","apiKeySource":"none","model":"claude-sonnet-4-5"}'
  exit 0
fi

printf 'unexpected args: %s\n' "$*" >&2
exit 1
"#;
        fs::write(&script_path, script).expect("write fake claude script");
        let mut permissions = fs::metadata(&script_path)
            .expect("fake claude metadata")
            .permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&script_path, permissions).expect("set fake claude permissions");

        unsafe {
            std::env::set_var(
                CODE_RUNTIME_LOCAL_CLAUDE_EXEC_PATH_ENV,
                script_path.as_os_str(),
            );
        }
        reset_local_claude_exec_binary_cache();

        let app = test_router();
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{"method":"code_providers_catalog","params":{}}"#,
            ))
            .expect("build request");
        let response = app.oneshot(request).await.expect("rpc response");

        unsafe {
            match previous_override {
                Some(value) => std::env::set_var(CODE_RUNTIME_LOCAL_CLAUDE_EXEC_PATH_ENV, value),
                None => std::env::remove_var(CODE_RUNTIME_LOCAL_CLAUDE_EXEC_PATH_ENV),
            }
        }
        reset_local_claude_exec_binary_cache();

        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        let providers = payload["result"]
            .as_array()
            .expect("providers catalog should be an array");
        let local_claude = providers
            .iter()
            .find(|entry| entry["providerId"] == Value::String("claude_code_local".to_string()))
            .expect("local claude provider entry should exist");
        assert_eq!(local_claude["available"], Value::Bool(true));
    }

    #[tokio::test]
    async fn rpc_providers_catalog_does_not_use_accounts_outside_strict_pool() {
        let (account_base_url, account_handle) =
            spawn_openai_compat_mock_server(vec!["claude-sonnet-4-5"], Some("oauth-route-key"))
                .await;
        let app = test_router();

        let upsert_account = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(format!(
                r#"{{
                  "method":"code_oauth_account_upsert",
                  "params":{{
                    "accountId":"claude-catalog-strict-only",
                    "provider":"claude_code",
                    "status":"enabled",
                    "metadata":{{"apiKey":"oauth-route-key","compatBaseUrl":"{}"}}
                  }}
                }}"#,
                account_base_url
            )))
            .expect("build upsert request");
        let upsert_response = app
            .clone()
            .oneshot(upsert_account)
            .await
            .expect("upsert response");
        assert_eq!(upsert_response.status(), StatusCode::OK);

        let remove_pool = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_remove",
                  "params":{"poolId":"pool-claude"}
                }"#,
            ))
            .expect("build remove pool request");
        let remove_pool_response = app
            .clone()
            .oneshot(remove_pool)
            .await
            .expect("remove pool response");
        assert_eq!(remove_pool_response.status(), StatusCode::OK);

        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{"method":"code_providers_catalog","params":{}}"#,
            ))
            .expect("build providers catalog request");
        let response = app
            .oneshot(request)
            .await
            .expect("providers catalog response");
        account_handle.abort();
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read providers catalog body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse providers catalog json");
        assert_eq!(payload["ok"], Value::Bool(true));
        let providers = payload["result"]
            .as_array()
            .expect("providers catalog should be an array");
        let anthropic = providers
            .iter()
            .find(|entry| entry["providerId"] == Value::String("anthropic".to_string()))
            .expect("anthropic provider entry should exist");
        assert_eq!(anthropic["available"], Value::Bool(false));
    }

    #[tokio::test]
    async fn rpc_providers_catalog_marks_disabled_pool_as_unavailable() {
        let app = test_router();

        let upsert_account = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{
                    "accountId":"claude-disabled-pool-a1",
                    "provider":"claude_code",
                    "status":"enabled",
                    "metadata":{"apiKey":"oauth-route-key"}
                  }
                }"#,
            ))
            .expect("build upsert request");
        let upsert_response = app
            .clone()
            .oneshot(upsert_account)
            .await
            .expect("upsert response");
        assert_eq!(upsert_response.status(), StatusCode::OK);

        let disable_pool = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_upsert",
                  "params":{
                    "poolId":"pool-claude",
                    "provider":"claude_code",
                    "name":"Claude Pool",
                    "enabled":false
                  }
                }"#,
            ))
            .expect("build disable pool request");
        let disable_pool_response = app
            .clone()
            .oneshot(disable_pool)
            .await
            .expect("disable pool response");
        assert_eq!(disable_pool_response.status(), StatusCode::OK);

        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{"method":"code_providers_catalog","params":{}}"#,
            ))
            .expect("build providers catalog request");
        let response = app
            .oneshot(request)
            .await
            .expect("providers catalog response");
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read providers catalog body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse providers catalog json");
        assert_eq!(payload["ok"], Value::Bool(true));
        let providers = payload["result"]
            .as_array()
            .expect("providers catalog should be an array");
        let anthropic = providers
            .iter()
            .find(|entry| entry["providerId"] == Value::String("anthropic".to_string()))
            .expect("anthropic provider entry should exist");
        assert_eq!(anthropic["available"], Value::Bool(false));
    }

    #[tokio::test]
    async fn rpc_providers_catalog_includes_configured_extension_provider() {
        let (base_url, handle) =
            spawn_openai_compat_mock_server(vec!["deepseek-chat"], Some("deepseek-key")).await;
        let mut config = test_service_config();
        config.provider_extension_seeds =
            vec![test_extension_provider(base_url.as_str(), "deepseek-key")];
        let app = test_router_with_config(config);

        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{"method":"code_providers_catalog","params":{}}"#,
            ))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
        handle.abort();
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        let providers = payload["result"]
            .as_array()
            .expect("providers catalog should be an array");
        assert!(providers.iter().any(|entry| {
            entry["providerId"] == Value::String("deepseek".to_string())
                && entry["pool"] == Value::String("deepseek".to_string())
                && entry["defaultModelId"] == Value::String("deepseek-chat".to_string())
                && entry["aliases"]
                    .as_array()
                    .is_some_and(|aliases| aliases.contains(&Value::String("ds".to_string())))
        }));
    }

    #[tokio::test]
    async fn rpc_providers_catalog_reflects_extension_disable_state() {
        let (base_url, handle) =
            spawn_openai_compat_mock_server(vec!["deepseek-chat"], Some("deepseek-key")).await;
        let mut config = test_service_config();
        config.provider_extension_seeds =
            vec![test_extension_provider(base_url.as_str(), "deepseek-key")];
        let app = test_router_with_config(config);

        let disable_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_extension_set_state_v2",
                "params": {
                    "extensionId": "deepseek",
                    "enabled": false
                }
            }),
        )
        .await;
        assert_eq!(disable_payload["ok"], Value::Bool(true));

        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{"method":"code_providers_catalog","params":{}}"#,
            ))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
        handle.abort();
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        let providers = payload["result"]
            .as_array()
            .expect("providers catalog should be an array");
        let deepseek = providers
            .iter()
            .find(|entry| entry["providerId"] == Value::String("deepseek".to_string()))
            .expect("deepseek provider entry should exist");
        assert_eq!(deepseek["available"], Value::Bool(false));
    }

    #[tokio::test]
    async fn rpc_providers_catalog_reflects_extension_metadata_updates() {
        let (base_url, handle) =
            spawn_openai_compat_mock_server(vec!["deepseek-v2-chat"], Some("deepseek-key")).await;
        let mut config = test_service_config();
        config.provider_extension_seeds =
            vec![test_extension_provider(base_url.as_str(), "deepseek-key")];
        let app = test_router_with_config(config);

        let update_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_extension_update_v2",
                "params": {
                    "extensionId": "deepseek",
                    "kind": "provider",
                    "transport": "openai-compatible",
                    "config": {
                        "pool": "deepseek-v2",
                        "aliases": ["deepseek", "ds-v2"],
                        "defaultModelId": "deepseek-v2-chat",
                        "compatBaseUrl": base_url,
                        "apiKeyEnv": ""
                    },
                    "provenance": {
                        "aliases": ["deepseek", "ds-v2"],
                        "pool": "deepseek-v2",
                        "defaultModelId": "deepseek-v2-chat",
                        "compatBaseUrl": base_url
                    }
                }
            }),
        )
        .await;
        assert_eq!(update_payload["ok"], Value::Bool(true));

        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{"method":"code_providers_catalog","params":{}}"#,
            ))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
        handle.abort();
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        let providers = payload["result"]
            .as_array()
            .expect("providers catalog should be an array");
        assert!(providers.iter().any(|entry| {
            entry["providerId"] == Value::String("deepseek".to_string())
                && entry["pool"] == Value::String("deepseek-v2".to_string())
                && entry["defaultModelId"] == Value::String("deepseek-v2-chat".to_string())
                && entry["aliases"]
                    .as_array()
                    .is_some_and(|aliases| aliases.contains(&Value::String("ds-v2".to_string())))
        }));
    }
