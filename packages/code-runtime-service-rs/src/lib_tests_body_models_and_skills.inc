    #[tokio::test]
    async fn models_pool_includes_codex_claude_and_gemini_entries() {
        let app = test_router();
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(r#"{"method":"code_models_pool","params":{}}"#))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        let models = payload["result"].as_array().expect("models array");
        assert!(models
            .iter()
            .any(|entry| entry["provider"] == Value::String("openai".to_string())));
        assert!(models
            .iter()
            .any(|entry| entry["provider"] == Value::String("anthropic".to_string())));
        assert!(models
            .iter()
            .any(|entry| entry["provider"] == Value::String("google".to_string())));
    }

    #[tokio::test]
    async fn models_pool_includes_extension_default_model() {
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
            .body(Body::from(r#"{"method":"code_models_pool","params":{}}"#))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
        handle.abort();
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        let models = payload["result"]
            .as_array()
            .expect("models pool should be an array");
        assert!(models.iter().any(|entry| {
            entry["provider"] == Value::String("deepseek".to_string())
                && entry["pool"] == Value::String("deepseek".to_string())
                && entry["id"] == Value::String("deepseek-chat".to_string())
        }));
    }

    #[tokio::test]
    async fn models_pool_marks_local_codex_default_model_available_when_cache_contains_it() {
        let _guard = crate::local_codex_exec_path::local_codex_exec_env_lock()
            .lock()
            .expect("local codex env lock poisoned");
        let previous_cache_path = std::env::var_os("CODE_RUNTIME_LOCAL_CODEX_MODELS_CACHE_PATH");
        let cache_path = std::env::temp_dir().join(format!(
            "code-runtime-models-cache-{}.json",
            uuid::Uuid::new_v4()
        ));
        fs::write(
            cache_path.as_path(),
            r#"{
  "models": [
    { "slug": "gpt-5.5", "visibility": "list", "supported_in_api": true }
  ]
}"#,
        )
        .expect("write local codex models cache");

        unsafe {
            std::env::set_var(
                "CODE_RUNTIME_LOCAL_CODEX_MODELS_CACHE_PATH",
                cache_path.as_os_str(),
            );
        }

        let app = test_router();
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(r#"{"method":"code_models_pool","params":{}}"#))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");

        let _ = fs::remove_file(cache_path.as_path());
        unsafe {
            match previous_cache_path {
                Some(value) => std::env::set_var("CODE_RUNTIME_LOCAL_CODEX_MODELS_CACHE_PATH", value),
                None => std::env::remove_var("CODE_RUNTIME_LOCAL_CODEX_MODELS_CACHE_PATH"),
            }
        }

        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        let models = payload["result"].as_array().expect("models array");
        assert!(models.iter().any(|entry| {
            entry["id"] == Value::String("gpt-5.5".to_string())
                && entry["provider"] == Value::String("openai".to_string())
                && entry["available"] == Value::Bool(true)
                && entry["source"] == Value::String("local-codex".to_string())
        }));
    }

    #[tokio::test]
    async fn models_pool_includes_discovered_openai_compat_models() {
        let (compat_base_url, compat_handle) = spawn_openai_compat_mock_server(
            vec!["gpt-4.1-mini", "claude-3-7-sonnet-latest", "gemini-3-flash"],
            Some("compat-test-key"),
        )
        .await;
        let config = test_service_config_with_openai_compat(compat_base_url.as_str());
        let app = test_router_with_config(config);
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(r#"{"method":"code_models_pool","params":{}}"#))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
        compat_handle.abort();
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        let models = payload["result"].as_array().expect("models array");
        assert!(models.iter().any(|entry| {
            entry["id"] == Value::String("gpt-4.1-mini".to_string())
                && entry["provider"] == Value::String("openai".to_string())
        }));
        assert!(models.iter().any(|entry| {
            entry["id"] == Value::String("claude-3-7-sonnet-latest".to_string())
                && entry["provider"] == Value::String("anthropic".to_string())
        }));
        assert!(models.iter().any(|entry| {
            entry["id"] == Value::String("gemini-3-flash".to_string())
                && entry["provider"] == Value::String("google".to_string())
        }));
    }

    #[tokio::test]
    async fn models_pool_discovers_compat_models_with_oauth_account_key_only() {
        let (compat_base_url, compat_handle) = spawn_openai_compat_mock_server(
            vec!["gpt-4.1-mini", "claude-3-7-sonnet-latest", "gemini-3-flash"],
            Some("oauth-compat-key"),
        )
        .await;
        let config = test_service_config_with_openai_compat_oauth_only(compat_base_url.as_str());
        let app = test_router_with_config(config);

        let upsert_account = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{
                    "accountId":"claude-oauth-discovery",
                    "provider":"claude_code",
                    "status":"enabled",
                    "metadata":{"apiKey":"oauth-compat-key"}
                  }
                }"#,
            ))
            .expect("build upsert account request");
        let upsert_response = app
            .clone()
            .oneshot(upsert_account)
            .await
            .expect("oauth account upsert response");
        assert_eq!(upsert_response.status(), StatusCode::OK);

        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(r#"{"method":"code_models_pool","params":{}}"#))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
        compat_handle.abort();
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        let models = payload["result"].as_array().expect("models array");
        assert!(models.iter().any(|entry| {
            entry["id"] == Value::String("claude-3-7-sonnet-latest".to_string())
                && entry["provider"] == Value::String("anthropic".to_string())
        }));
        assert!(models.iter().any(|entry| {
            entry["id"] == Value::String("gemini-3-flash".to_string())
                && entry["provider"] == Value::String("google".to_string())
        }));
    }

    #[tokio::test]
    async fn models_pool_prefers_oauth_account_key_before_configured_compat_key() {
        let (compat_base_url, models_counter, compat_handle) =
            spawn_openai_compat_mock_server_with_counter(
                vec!["gpt-4.1-mini", "claude-3-7-sonnet-latest", "gemini-3-flash"],
                Some("oauth-compat-key"),
                None,
            )
            .await;
        let mut config = test_service_config_with_openai_compat(compat_base_url.as_str());
        config.openai_compat_api_key = Some("config-compat-key".to_string());
        let app = test_router_with_config(config);

        let upsert_account = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{
                    "accountId":"claude-oauth-priority",
                    "provider":"claude_code",
                    "status":"enabled",
                    "metadata":{"apiKey":"oauth-compat-key"}
                  }
                }"#,
            ))
            .expect("build upsert account request");
        let upsert_response = app
            .clone()
            .oneshot(upsert_account)
            .await
            .expect("oauth account upsert response");
        assert_eq!(upsert_response.status(), StatusCode::OK);

        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(r#"{"method":"code_models_pool","params":{}}"#))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
        compat_handle.abort();
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(models_counter.load(AtomicOrdering::Relaxed), 1);
        let models = payload["result"].as_array().expect("models array");
        assert!(models.iter().any(|entry| {
            entry["id"] == Value::String("claude-3-7-sonnet-latest".to_string())
                && entry["provider"] == Value::String("anthropic".to_string())
        }));
    }

    #[tokio::test]
    async fn models_pool_without_compat_credentials_skips_catalog_fetch() {
        let (compat_base_url, models_counter, compat_handle) =
            spawn_openai_compat_mock_server_with_counter(
                vec!["gpt-4.1-mini", "claude-3-7-sonnet-latest"],
                None,
                None,
            )
            .await;
        let config = test_service_config_with_openai_compat_oauth_only(compat_base_url.as_str());
        let app = test_router_with_config(config);
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(r#"{"method":"code_models_pool","params":{}}"#))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
        compat_handle.abort();
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(models_counter.load(AtomicOrdering::Relaxed), 0);
        let models = payload["result"].as_array().expect("models array");
        assert!(!models.iter().any(|entry| {
            entry["id"] == Value::String("claude-3-7-sonnet-latest".to_string())
        }));
    }

    #[tokio::test]
    async fn models_pool_uses_stale_compat_catalog_when_refresh_fails() {
        let (compat_base_url, compat_handle) = spawn_openai_compat_mock_server(
            vec!["gpt-4.1-mini", "claude-3-7-sonnet-latest", "gemini-3-flash"],
            Some("compat-test-key"),
        )
        .await;
        let mut config = test_service_config_with_openai_compat(compat_base_url.as_str());
        config.openai_compat_model_cache_ttl_ms = 20;
        let app = test_router_with_config(config);

        let first_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(r#"{"method":"code_models_pool","params":{}}"#))
            .expect("build first request");
        let first_response = app
            .clone()
            .oneshot(first_request)
            .await
            .expect("first rpc response");
        assert_eq!(first_response.status(), StatusCode::OK);
        let first_bytes = axum::body::to_bytes(first_response.into_body(), 1024 * 1024)
            .await
            .expect("read first body");
        let first_payload: Value = serde_json::from_slice(&first_bytes).expect("parse first json");
        let first_models = first_payload["result"]
            .as_array()
            .expect("first models array");
        assert!(first_models
            .iter()
            .any(|entry| entry["id"] == Value::String("gemini-3-flash".to_string())));

        tokio::time::sleep(std::time::Duration::from_millis(8)).await;
        compat_handle.abort();
        tokio::time::sleep(std::time::Duration::from_millis(8)).await;

        let second_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(r#"{"method":"code_models_pool","params":{}}"#))
            .expect("build second request");
        let second_response = app
            .oneshot(second_request)
            .await
            .expect("second rpc response");
        assert_eq!(second_response.status(), StatusCode::OK);
        let second_bytes = axum::body::to_bytes(second_response.into_body(), 1024 * 1024)
            .await
            .expect("read second body");
        let second_payload: Value =
            serde_json::from_slice(&second_bytes).expect("parse second json");
        assert_eq!(second_payload["ok"], Value::Bool(true));
        let second_models = second_payload["result"]
            .as_array()
            .expect("second models array");
        assert!(second_models
            .iter()
            .any(|entry| entry["id"] == Value::String("gemini-3-flash".to_string())));
    }

    #[tokio::test]
    async fn compat_model_catalog_refresh_is_singleflight_per_base_url() {
        let (compat_base_url, models_counter, compat_handle) =
            spawn_openai_compat_mock_server_with_counter(
                vec!["gpt-4.1-mini", "claude-3-7-sonnet-latest", "gemini-3-flash"],
                Some("compat-test-key"),
                Some(Duration::from_millis(40)),
            )
            .await;
        let mut config = test_service_config_with_openai_compat(compat_base_url.as_str());
        config.openai_compat_model_cache_ttl_ms = 1;
        let app = test_router_with_config(config);

        let warm_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(r#"{"method":"code_models_pool","params":{}}"#))
            .expect("build warm request");
        let warm_response = app
            .clone()
            .oneshot(warm_request)
            .await
            .expect("warm rpc response");
        assert_eq!(warm_response.status(), StatusCode::OK);

        tokio::time::sleep(Duration::from_millis(30)).await;

        let refresh_request_a = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(r#"{"method":"code_models_pool","params":{}}"#))
            .expect("build refresh request a");
        let refresh_request_b = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(r#"{"method":"code_models_pool","params":{}}"#))
            .expect("build refresh request b");

        let (response_a, response_b) = tokio::join!(
            app.clone().oneshot(refresh_request_a),
            app.clone().oneshot(refresh_request_b)
        );
        let response_a = response_a.expect("refresh response a");
        let response_b = response_b.expect("refresh response b");
        assert_eq!(response_a.status(), StatusCode::OK);
        assert_eq!(response_b.status(), StatusCode::OK);

        let models_calls = models_counter.load(AtomicOrdering::Relaxed);
        compat_handle.abort();
        assert_eq!(models_calls, 2);
    }

    #[tokio::test]
    async fn compat_model_catalog_refresh_is_singleflight_under_high_contention() {
        let (compat_base_url, models_counter, compat_handle) =
            spawn_openai_compat_mock_server_with_counter(
                vec!["gpt-4.1-mini", "claude-3-7-sonnet-latest", "gemini-3-flash"],
                Some("compat-test-key"),
                Some(Duration::from_millis(60)),
            )
            .await;
        let mut config = test_service_config_with_openai_compat(compat_base_url.as_str());
        config.openai_compat_model_cache_ttl_ms = 1;
        let app = test_router_with_config(config);

        let warm_payload = send_rpc_request(
            app.clone(),
            json!({"method":"code_models_pool","params":{}}),
        )
        .await;
        assert_eq!(warm_payload["ok"], Value::Bool(true));

        tokio::time::sleep(Duration::from_millis(30)).await;

        let mut join_set = tokio::task::JoinSet::new();
        for _ in 0..8 {
            let app = app.clone();
            join_set.spawn(async move {
                send_rpc_request(app, json!({"method":"code_models_pool","params":{}})).await
            });
        }
        while let Some(result) = join_set.join_next().await {
            let payload = result.expect("join refresh request");
            assert_eq!(payload["ok"], Value::Bool(true));
        }

        let models_calls = models_counter.load(AtomicOrdering::Relaxed);
        compat_handle.abort();
        assert_eq!(models_calls, 2);
    }

    #[tokio::test]
    async fn compat_model_catalog_refresh_serves_stale_while_refresh_is_inflight() {
        // Keep a wide margin between the in-flight refresh latency and the stale-read timeout.
        // The original assertion window was too tight for loaded CI runners even when stale
        // reads behaved correctly, so use a wider deterministic envelope here.
        let (compat_base_url, models_counter, compat_handle) =
            spawn_openai_compat_mock_server_with_counter(
                vec!["gpt-4.1-mini", "claude-3-7-sonnet-latest", "gemini-3-flash"],
                Some("compat-test-key"),
                Some(Duration::from_millis(300)),
            )
            .await;
        let mut config = test_service_config_with_openai_compat(compat_base_url.as_str());
        config.openai_compat_model_cache_ttl_ms = 1;
        let app = test_router_with_config(config);

        let warm_payload = send_rpc_request(
            app.clone(),
            json!({"method":"code_models_pool","params":{}}),
        )
        .await;
        assert_eq!(warm_payload["ok"], Value::Bool(true));
        assert_eq!(models_counter.load(AtomicOrdering::Relaxed), 1);

        tokio::time::sleep(Duration::from_millis(30)).await;

        let refresh_app = app.clone();
        let refresh_request = tokio::spawn(async move {
            send_rpc_request(
                refresh_app,
                json!({"method":"code_models_pool","params":{}}),
            )
            .await
        });

        tokio::time::timeout(Duration::from_millis(200), async {
            loop {
                if models_counter.load(AtomicOrdering::Relaxed) >= 2 {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(2)).await;
            }
        })
        .await
        .expect("refresh request should start before stale read");

        let stale_payload = tokio::time::timeout(
            Duration::from_millis(180),
            send_rpc_request(
                app.clone(),
                json!({"method":"code_models_pool","params":{}}),
            ),
        )
        .await
        .expect("stale read should not wait on in-flight refresh");
        assert_eq!(stale_payload["ok"], Value::Bool(true));
        assert_eq!(
            models_counter.load(AtomicOrdering::Relaxed),
            2,
            "stale read should reuse the cached catalog while the refresh is still blocked"
        );

        let refreshed_payload = refresh_request.await.expect("join refresh request");
        assert_eq!(refreshed_payload["ok"], Value::Bool(true));

        let models_calls = models_counter.load(AtomicOrdering::Relaxed);
        compat_handle.abort();
        assert_eq!(models_calls, 2);
    }

    #[tokio::test]
    async fn compat_model_catalog_refresh_uses_error_cooldown_when_upstream_fails() {
        let (compat_base_url, models_counter, compat_handle) =
            spawn_openai_compat_models_error_server(Some("compat-test-key")).await;
        let config = test_service_config_with_openai_compat(compat_base_url.as_str());
        let app = test_router_with_config(config);

        let first_payload = send_rpc_request(
            app.clone(),
            json!({"method":"code_models_pool","params":{}}),
        )
        .await;
        assert_eq!(first_payload["ok"], Value::Bool(true));

        let second_payload = send_rpc_request(
            app.clone(),
            json!({"method":"code_models_pool","params":{}}),
        )
        .await;
        assert_eq!(second_payload["ok"], Value::Bool(true));

        assert_eq!(
            models_counter.load(AtomicOrdering::Relaxed),
            1,
            "second request should reuse recent failure without another upstream fetch"
        );
        let ready_after_cooldown_hit = Request::builder()
            .method("GET")
            .uri("/ready")
            .body(Body::empty())
            .expect("build ready request after cooldown hit");
        let ready_response = app
            .clone()
            .oneshot(ready_after_cooldown_hit)
            .await
            .expect("ready response after cooldown hit");
        let ready_bytes = axum::body::to_bytes(ready_response.into_body(), 1024 * 1024)
            .await
            .expect("read ready body after cooldown hit");
        let ready_payload: Value =
            serde_json::from_slice(&ready_bytes).expect("parse ready payload after cooldown hit");
        assert_eq!(
            ready_payload["runtimeDiagnostics"]["compatModelCatalogFetchFailuresTotal"],
            Value::Number(serde_json::Number::from(1))
        );
        assert_eq!(
            ready_payload["runtimeDiagnostics"]["compatModelCatalogErrorCooldownHitsTotal"],
            Value::Number(serde_json::Number::from(1))
        );

        tokio::time::sleep(Duration::from_millis(
            OPENAI_COMPAT_MODEL_CATALOG_ERROR_COOLDOWN_MS + 50,
        ))
        .await;
        let third_payload = send_rpc_request(
            app.clone(),
            json!({"method":"code_models_pool","params":{}}),
        )
        .await;
        assert_eq!(third_payload["ok"], Value::Bool(true));
        assert_eq!(
            models_counter.load(AtomicOrdering::Relaxed),
            2,
            "refresh should retry after cooldown elapses"
        );
        let ready_after_retry = Request::builder()
            .method("GET")
            .uri("/ready")
            .body(Body::empty())
            .expect("build ready request after retry");
        let ready_response = app
            .oneshot(ready_after_retry)
            .await
            .expect("ready response after retry");
        let ready_bytes = axum::body::to_bytes(ready_response.into_body(), 1024 * 1024)
            .await
            .expect("read ready body after retry");
        let ready_payload: Value =
            serde_json::from_slice(&ready_bytes).expect("parse ready payload after retry");
        assert_eq!(
            ready_payload["runtimeDiagnostics"]["compatModelCatalogFetchFailuresTotal"],
            Value::Number(serde_json::Number::from(2))
        );
        assert_eq!(
            ready_payload["runtimeDiagnostics"]["compatModelCatalogErrorCooldownHitsTotal"],
            Value::Number(serde_json::Number::from(1))
        );

        compat_handle.abort();
    }

    #[tokio::test]
    async fn live_skills_list_returns_builtin_network_analysis_skill() {
        let app = test_router();
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{"method":"code_live_skills_list","params":{}}"#,
            ))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        let skills = payload["result"].as_array().expect("skills array");
        assert_eq!(skills.len(), 12);
        let skill_ids = skills
            .iter()
            .filter_map(|entry| entry["id"].as_str().map(str::to_string))
            .collect::<Vec<_>>();
        assert_eq!(
            skill_ids,
            vec![
                "network-analysis".to_string(),
                "research-orchestrator".to_string(),
                "core-tree".to_string(),
                "core-grep".to_string(),
                "core-read".to_string(),
                "core-write".to_string(),
                "core-edit".to_string(),
                "core-bash".to_string(),
                "core-js-repl".to_string(),
                "core-js-repl-reset".to_string(),
                "core-diagnostics".to_string(),
                "core-computer-observe".to_string(),
            ]
        );

        let skills_by_id = skills
            .iter()
            .filter_map(|entry| entry["id"].as_str().map(|id| (id.to_string(), entry)))
            .collect::<HashMap<_, _>>();
        let network = skills_by_id
            .get("network-analysis")
            .expect("network-analysis skill");
        assert_eq!(
            network["kind"],
            Value::String("network_analysis".to_string())
        );
        assert_eq!(network["source"], Value::String("builtin".to_string()));
        assert_eq!(network["enabled"], Value::Bool(true));
        assert_eq!(network["supportsNetwork"], Value::Bool(true));
        assert_eq!(network["permissions"], json!(["network"]));
        assert!(network["tags"]
            .as_array()
            .is_some_and(|tags| tags.contains(&Value::String("analysis".to_string()))));
        assert!(network["aliases"]
            .as_array()
            .is_some_and(|aliases| aliases.contains(&Value::String("network_analysis".to_string()))));

        let research = skills_by_id
            .get("research-orchestrator")
            .expect("research-orchestrator skill");
        assert_eq!(
            research["kind"],
            Value::String("research_orchestration".to_string())
        );
        assert_eq!(research["source"], Value::String("builtin".to_string()));
        assert_eq!(research["enabled"], Value::Bool(true));
        assert_eq!(research["supportsNetwork"], Value::Bool(true));
        assert_eq!(research["permissions"], json!(["network"]));
        assert!(research["tags"]
            .as_array()
            .is_some_and(|tags| tags.contains(&Value::String("research".to_string()))));
        assert!(research["aliases"]
            .as_array()
            .is_some_and(|aliases| aliases.contains(&Value::String("research".to_string()))));

        for core_skill_id in [
            "core-tree",
            "core-grep",
            "core-read",
            "core-write",
            "core-edit",
            "core-bash",
            "core-js-repl",
            "core-js-repl-reset",
            "core-diagnostics",
            "core-computer-observe",
        ] {
            let core = skills_by_id.get(core_skill_id).expect("core skill");
            assert_eq!(core["source"], Value::String("builtin".to_string()));
            assert_eq!(core["enabled"], Value::Bool(true));
            assert_eq!(core["supportsNetwork"], Value::Bool(false));
            assert!(core["permissions"].as_array().is_some_and(|permissions| !permissions.is_empty()));
            assert!(core["tags"]
                .as_array()
                .is_some_and(|tags| tags.contains(&Value::String("core".to_string()))));
            assert!(core["aliases"].as_array().is_some_and(|aliases| !aliases.is_empty()));
        }
    }

    #[tokio::test]
    async fn kernel_capabilities_list_publishes_host_binder_slots() {
        let app = test_router();
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{"method":"code_kernel_capabilities_list_v2","params":{}}"#,
            ))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        let capabilities = payload["result"].as_array().expect("capabilities array");
        let capabilities_by_id = capabilities
            .iter()
            .filter_map(|entry| entry["id"].as_str().map(|id| (id.to_string(), entry)))
            .collect::<HashMap<_, _>>();

        let wasi = capabilities_by_id.get("host:wasi").expect("wasi host capability");
        assert_eq!(wasi["kind"], Value::String("host".to_string()));
        assert_eq!(wasi["enabled"], Value::Bool(false));
        assert_eq!(wasi["health"], Value::String("blocked".to_string()));
        assert_eq!(wasi["metadata"]["pluginSource"], Value::String("wasi_host".to_string()));
        assert_eq!(wasi["metadata"]["bindingState"], Value::String("unbound".to_string()));
        assert_eq!(wasi["metadata"]["contractFormat"], Value::String("wit".to_string()));
        assert_eq!(
            wasi["metadata"]["worldId"],
            Value::String("hugecode:runtime/plugin-host".to_string())
        );
        assert_eq!(
            wasi["metadata"]["contractSurfaces"][0]["kind"],
            Value::String("world".to_string())
        );
        assert_eq!(
            wasi["metadata"]["contractSurfaces"][1]["direction"],
            Value::String("import".to_string())
        );

        let rpc = capabilities_by_id.get("host:rpc").expect("rpc host capability");
        assert_eq!(rpc["kind"], Value::String("host".to_string()));
        assert_eq!(rpc["enabled"], Value::Bool(false));
        assert_eq!(rpc["health"], Value::String("blocked".to_string()));
        assert_eq!(rpc["metadata"]["pluginSource"], Value::String("rpc_host".to_string()));
        assert_eq!(rpc["metadata"]["bindingState"], Value::String("unbound".to_string()));
        assert_eq!(rpc["metadata"]["contractFormat"], Value::String("rpc".to_string()));
        assert_eq!(
            rpc["metadata"]["contractSurfaces"][0]["kind"],
            Value::String("procedure_set".to_string())
        );
    }

    #[tokio::test]
    async fn live_skill_execute_network_analysis_returns_results() {
        let (base_url, handle) = spawn_live_skills_network_mock_server().await;
        let mut config = test_service_config();
        config.live_skills_network_base_url = base_url;
        config.live_skills_network_timeout_ms = 3_000;
        let app = test_router_with_config(config);
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_live_skill_execute",
                  "params":{
                    "skillId":"network-analysis",
                    "input":"rust async runtime",
                    "options":{
                      "query":"rust async runtime",
                      "maxResults":2,
                      "maxCharsPerResult":240
                    }
                  }
                }"#,
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
        assert_eq!(
            payload["result"]["status"],
            Value::String("completed".to_string()),
            "payload: {payload:#}"
        );
        assert!(payload["result"]["network"]["items"].is_array());
        assert_eq!(
            payload["result"]["network"]["items"][0]["title"],
            Value::String("Rust async runtime guide".to_string())
        );
        assert_eq!(
            payload["result"]["network"]["items"][0]["domain"],
            Value::String("example.com".to_string())
        );
        assert!(payload["result"]["network"]["items"][0]["dedupeKey"]
            .as_str()
            .unwrap_or_default()
            .contains("example.com"));
        assert!(payload["result"]["network"]["items"][0]["fetchedAt"]
            .as_u64()
            .unwrap_or(0)
            > 0);
        assert_eq!(
            payload["result"]["metadata"]["providerDiagnostics"]["strategy"],
            Value::String("search-only".to_string())
        );
        assert_eq!(
            payload["result"]["metadata"]["providerDiagnostics"]["policySource"],
            Value::String("runtime_default".to_string())
        );
        assert_eq!(
            payload["result"]["metadata"]["providerDiagnostics"]["callerProvider"],
            Value::String("unknown".to_string())
        );
        assert!(payload["result"]["metadata"]["providerDiagnostics"]["callerModelId"].is_null());
        assert_eq!(
            payload["result"]["metadata"]["profileUsed"],
            Value::String("research".to_string())
        );
        assert_eq!(payload["result"]["metadata"]["approvalEvents"], json!([]));
        assert_eq!(
            payload["result"]["metadata"]["checkpointState"]["state"],
            Value::String("completed".to_string())
        );
        assert_eq!(
            payload["result"]["metadata"]["compactionSummary"]["triggered"],
            Value::Bool(false)
        );
        assert!(payload["result"]["metadata"]["evalTags"]
            .as_array()
            .is_some_and(|tags| tags.contains(&Value::String("skill:network-analysis".to_string()))));
    }

    #[tokio::test]
    async fn live_skill_execute_network_analysis_fetches_page_content_when_requested() {
        let (base_url, handle) = spawn_live_skills_network_mock_server().await;
        let mut config = test_service_config();
        config.live_skills_network_base_url = base_url;
        config.live_skills_network_timeout_ms = 3_000;
        let app = test_router_with_config(config);
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_live_skill_execute",
                  "params":{
                    "skillId":"network-analysis",
                    "input":"rust async runtime",
                    "options":{
                      "query":"rust async runtime",
                      "maxResults":2,
                      "maxCharsPerResult":240,
                      "fetchPageContent":true
                    }
                  }
                }"#,
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
        assert_eq!(
            payload["result"]["status"],
            Value::String("completed".to_string())
        );
        assert!(payload["result"]["network"]["items"][0]["content"]
            .as_str()
            .unwrap_or_default()
            .contains("Rust async runtime deep page content"));
        assert_eq!(
            payload["result"]["metadata"]["providerDiagnostics"]["strategy"],
            Value::String("search+content".to_string())
        );
        assert_eq!(
            payload["result"]["metadata"]["providerDiagnostics"]["policySource"],
            Value::String("explicit_request".to_string())
        );
        assert_eq!(
            payload["result"]["metadata"]["providerDiagnostics"]["callerProvider"],
            Value::String("unknown".to_string())
        );
        assert!(payload["result"]["metadata"]["providerDiagnostics"]["callerModelId"].is_null());
    }

    #[tokio::test]
    async fn live_skill_execute_network_analysis_uses_caller_context_provider_defaults() {
        let (base_url, handle) = spawn_live_skills_network_mock_server().await;
        let mut config = test_service_config();
        config.live_skills_network_base_url = base_url;
        config.live_skills_network_timeout_ms = 3_000;
        let app = test_router_with_config(config);
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_live_skill_execute",
                  "params":{
                    "skillId":"network-analysis",
                    "input":"rust async runtime",
                    "context":{
                      "provider":"openai",
                      "modelId":"gpt-5.4"
                    },
                    "options":{
                      "query":"rust async runtime",
                      "maxResults":2,
                      "maxCharsPerResult":240
                    }
                  }
                }"#,
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
        assert_eq!(
            payload["result"]["metadata"]["providerDiagnostics"]["strategy"],
            Value::String("search+content".to_string())
        );
        assert_eq!(
            payload["result"]["metadata"]["providerDiagnostics"]["policySource"],
            Value::String("caller_context".to_string())
        );
        assert_eq!(
            payload["result"]["metadata"]["providerDiagnostics"]["callerProvider"],
            Value::String("openai".to_string())
        );
        assert_eq!(
            payload["result"]["metadata"]["providerDiagnostics"]["callerModelId"],
            Value::String("gpt-5.4".to_string())
        );
        assert!(payload["result"]["network"]["items"][0]["content"]
            .as_str()
            .unwrap_or_default()
            .contains("Rust async runtime deep page content"));
    }

    #[tokio::test]
    async fn live_skill_execute_research_orchestrator_returns_aggregated_metadata() {
        let (base_url, handle) = spawn_live_skills_network_mock_server().await;
        let mut config = test_service_config();
        config.live_skills_network_base_url = base_url;
        config.live_skills_network_timeout_ms = 3_000;
        let app = test_router_with_config(config);
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_live_skill_execute",
                  "params":{
                    "skillId":"research-orchestrator",
                    "input":"latest rust async runtime trends",
                    "options":{
                      "subQueries":[
                        "latest rust async runtime trends",
                        "tokio runtime architecture updates"
                      ],
                      "maxParallel":4,
                      "maxResults":2,
                      "maxCharsPerResult":240,
                      "fetchPageContent":true,
                      "preferDomains":["tokio.rs","example.com"]
                    }
                  }
                }"#,
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
        assert_eq!(
            payload["result"]["status"],
            Value::String("completed".to_string())
        );
        assert_eq!(
            payload["result"]["metadata"]["researchRun"]["goal"],
            Value::String("latest rust async runtime trends".to_string())
        );
        assert_eq!(
            payload["result"]["metadata"]["profileUsed"],
            Value::String("research".to_string())
        );
        assert_eq!(payload["result"]["metadata"]["approvalEvents"], json!([]));
        assert_eq!(
            payload["result"]["metadata"]["checkpointState"]["state"],
            Value::String("completed".to_string())
        );
        assert_eq!(
            payload["result"]["metadata"]["compactionSummary"]["triggered"],
            Value::Bool(false)
        );
        assert!(payload["result"]["metadata"]["evalTags"]
            .as_array()
            .is_some_and(|tags| tags.contains(&Value::String("skill:research-orchestrator".to_string()))));
        assert_eq!(
            payload["result"]["metadata"]["researchRun"]["subQueries"]
                .as_array()
                .map(Vec::len),
            Some(2)
        );
        assert_eq!(
            payload["result"]["metadata"]["researchRun"]["sessions"]
                .as_array()
                .map(Vec::len),
            Some(2)
        );
        assert_eq!(
            payload["result"]["metadata"]["researchRun"]["profileUsed"],
            Value::String("research".to_string())
        );
        assert_eq!(
            payload["result"]["metadata"]["researchRun"]["checkpointState"]["state"],
            Value::String("completed".to_string())
        );
        assert_eq!(
            payload["result"]["metadata"]["researchRun"]["compactionSummary"]["triggered"],
            Value::Bool(false)
        );
        assert_eq!(
            payload["result"]["metadata"]["researchRun"]["approvalEvents"],
            json!([])
        );
        assert_eq!(
            payload["result"]["metadata"]["researchRun"]["providerDiagnostics"]["requestedMaxParallel"],
            Value::Number(4_u64.into())
        );
        assert_eq!(
            payload["result"]["metadata"]["researchRun"]["providerDiagnostics"]["effectiveMaxParallel"],
            Value::Number(2_u64.into())
        );
        assert!(payload["result"]["metadata"]["researchRun"]["evalTags"]
            .as_array()
            .is_some_and(|tags| tags.iter().any(|tag| tag == "skill:research-orchestrator")));
        assert!(payload["result"]["metadata"]["researchRun"]["providerDiagnostics"]["reasonCodes"]
            .as_array()
            .is_some_and(|codes| codes.contains(&Value::String("research-search-content".to_string()))));
        assert!(payload["result"]["metadata"]["researchRun"]["providerDiagnostics"]["reasonCodes"]
            .as_array()
            .is_some_and(|codes| codes.contains(&Value::String("content-fetch-capped-parallelism".to_string()))));
        assert_eq!(
            payload["result"]["metadata"]["researchRun"]["providerDiagnostics"]["policySource"],
            Value::String("explicit_request".to_string())
        );
        assert_eq!(
            payload["result"]["metadata"]["researchRun"]["providerDiagnostics"]["callerProvider"],
            Value::String("unknown".to_string())
        );
        assert!(payload["result"]["metadata"]["researchRun"]["providerDiagnostics"]["callerModelId"].is_null());
        assert!(payload["result"]["metadata"]["researchRun"]["citations"]
            .as_array()
            .is_some_and(|citations| !citations.is_empty()));
        assert!(payload["result"]["output"]
            .as_str()
            .unwrap_or_default()
            .contains("Research summary"));
    }

    #[tokio::test]
    async fn live_skill_execute_research_orchestrator_uses_caller_context_provider_defaults() {
        let (base_url, handle) = spawn_live_skills_network_mock_server().await;
        let mut config = test_service_config();
        config.live_skills_network_base_url = base_url;
        config.live_skills_network_timeout_ms = 3_000;
        let app = test_router_with_config(config);
        let payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_live_skill_execute",
                "params":{
                    "skillId":"research-orchestrator",
                    "input":"latest rust async runtime trends",
                    "context":{
                        "provider":"anthropic",
                        "modelId":"claude-3-7-sonnet"
                    },
                    "options":{
                        "subQueries":[
                            "latest rust async runtime trends",
                            "tokio runtime architecture updates"
                        ],
                        "maxParallel":4,
                        "maxResults":2,
                        "maxCharsPerResult":240
                    }
                }
            }),
        )
        .await;
        handle.abort();
        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(
            payload["result"]["metadata"]["researchRun"]["providerDiagnostics"]["policySource"],
            Value::String("caller_context".to_string())
        );
        assert_eq!(
            payload["result"]["metadata"]["researchRun"]["providerDiagnostics"]["callerProvider"],
            Value::String("anthropic".to_string())
        );
        assert_eq!(
            payload["result"]["metadata"]["researchRun"]["providerDiagnostics"]["callerModelId"],
            Value::String("claude-3-7-sonnet".to_string())
        );
        assert!(payload["result"]["metadata"]["researchRun"]["providerDiagnostics"]["reasonCodes"]
            .as_array()
            .is_some_and(|codes| codes.contains(&Value::String("research-search-only".to_string()))));
        assert_eq!(
            payload["result"]["metadata"]["researchRun"]["providerDiagnostics"]["effectiveMaxParallel"],
            Value::Number(4_u64.into())
        );
    }

    #[tokio::test]
    async fn live_skill_execute_research_orchestrator_preserves_parallelism_for_search_only_strategy() {
        let (base_url, handle) = spawn_live_skills_network_mock_server().await;
        let mut config = test_service_config();
        config.live_skills_network_base_url = base_url;
        config.live_skills_network_timeout_ms = 3_000;
        let app = test_router_with_config(config);
        let payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_live_skill_execute",
                "params":{
                    "skillId":"research-orchestrator",
                    "input":"latest rust async runtime trends",
                    "options":{
                        "subQueries":[
                            "latest rust async runtime trends",
                            "tokio runtime architecture updates"
                        ],
                        "maxParallel":4,
                        "maxResults":2,
                        "maxCharsPerResult":240,
                        "fetchPageContent":false
                    }
                }
            }),
        )
        .await;
        handle.abort();
        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(
            payload["result"]["metadata"]["researchRun"]["providerDiagnostics"]["requestedMaxParallel"],
            Value::Number(4_u64.into())
        );
        assert_eq!(
            payload["result"]["metadata"]["researchRun"]["providerDiagnostics"]["effectiveMaxParallel"],
            Value::Number(4_u64.into())
        );
        assert!(payload["result"]["metadata"]["researchRun"]["providerDiagnostics"]["reasonCodes"]
            .as_array()
            .is_some_and(|codes| codes.contains(&Value::String("research-search-only".to_string()))));
    }

    #[tokio::test]
    async fn live_skill_execute_research_orchestrator_persists_child_sessions() {
        let (base_url, handle) = spawn_live_skills_network_mock_server().await;
        let mut config = test_service_config();
        config.live_skills_network_base_url = base_url;
        config.live_skills_network_timeout_ms = 3_000;
        let app = test_router_with_config(config);
        let payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_live_skill_execute",
                "params":{
                    "skillId":"research-orchestrator",
                    "input":"latest rust async runtime trends",
                    "options":{
                        "subQueries":[
                            "latest rust async runtime trends",
                            "tokio runtime architecture updates"
                        ],
                        "maxParallel":2,
                        "maxResults":2,
                        "maxCharsPerResult":240,
                        "fetchPageContent":true
                    }
                }
            }),
        )
        .await;
        handle.abort();
        assert_eq!(payload["ok"], Value::Bool(true));
        let run_id = payload["result"]["runId"]
            .as_str()
            .expect("research run id")
            .to_string();
        let session_ids = payload["result"]["metadata"]["researchRun"]["sessions"]
            .as_array()
            .expect("research sessions")
            .iter()
            .filter_map(|session| session["sessionId"].as_str().map(str::to_string))
            .collect::<Vec<_>>();
        assert_eq!(session_ids.len(), 2);

        for session_id in session_ids {
            let status_payload = send_rpc_request(
                app.clone(),
                json!({
                    "method":"code_sub_agent_status",
                    "params":{
                        "sessionId": session_id,
                    }
                }),
            )
            .await;
            assert_eq!(status_payload["ok"], Value::Bool(true));
            assert_eq!(
                status_payload["result"]["scopeProfile"],
                Value::String("research".to_string())
            );
            assert_eq!(
                status_payload["result"]["parentRunId"],
                Value::String(run_id.clone())
            );
            assert_eq!(
                status_payload["result"]["status"],
                Value::String("completed".to_string())
            );
            assert!(
                status_payload["result"]["checkpointId"]
                    .as_str()
                    .is_some_and(|value| !value.trim().is_empty())
            );
            assert!(
                status_payload["result"]["traceId"]
                    .as_str()
                    .is_some_and(|value| value.contains("sub-agent"))
            );
            assert_eq!(status_payload["result"]["recovered"], Value::Bool(false));
            assert_eq!(
                status_payload["result"]["checkpointState"]["state"],
                Value::String("completed".to_string())
            );
            assert!(status_payload["result"]["compactionSummary"].is_null());
            assert!(status_payload["result"]["evalTags"]
                .as_array()
                .is_some_and(|tags| tags.contains(&Value::String("scope:research".to_string()))));
            let last_task_id = status_payload["result"]["lastTaskId"]
                .as_str()
                .expect("research child last task id")
                .to_string();
            assert!(status_payload["result"]["activeTaskId"].is_null());

            let wait_payload = send_rpc_request(
                app.clone(),
                json!({
                    "method":"code_sub_agent_wait",
                    "params":{
                        "sessionId": session_id,
                        "timeoutMs": 1_000,
                    }
                }),
            )
            .await;
            assert_eq!(wait_payload["ok"], Value::Bool(true));
            assert_eq!(wait_payload["result"]["done"], Value::Bool(true));
            assert_eq!(wait_payload["result"]["timedOut"], Value::Bool(false));
            assert_eq!(
                wait_payload["result"]["task"]["taskId"],
                Value::String(last_task_id)
            );
            assert_eq!(
                wait_payload["result"]["task"]["status"],
                Value::String("completed".to_string())
            );
            assert_eq!(
                wait_payload["result"]["session"]["status"],
                Value::String("completed".to_string())
            );
            assert_eq!(
                wait_payload["result"]["session"]["checkpointState"]["state"],
                Value::String("completed".to_string())
            );
        }
    }

    #[tokio::test]
    async fn live_skill_execute_research_orchestrator_tracks_failed_child_sessions() {
        let (base_url, handle) = spawn_live_skills_network_mock_server_with_failures(vec![
            "fail-child-research".to_string(),
        ])
        .await;
        let mut config = test_service_config();
        config.live_skills_network_base_url = base_url;
        config.live_skills_network_timeout_ms = 3_000;
        let app = test_router_with_config(config);
        let payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_live_skill_execute",
                "params":{
                    "skillId":"research-orchestrator",
                    "input":"latest rust async runtime trends",
                    "options":{
                        "subQueries":[
                            "latest rust async runtime trends",
                            "fail-child-research"
                        ],
                        "maxParallel":2,
                        "maxResults":2,
                        "maxCharsPerResult":240,
                        "fetchPageContent":true
                    }
                }
            }),
        )
        .await;
        handle.abort();
        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(
            payload["result"]["metadata"]["researchRun"]["providerDiagnostics"]["childFailureCount"],
            Value::Number(1_u64.into())
        );

        let run_id = payload["result"]["runId"]
            .as_str()
            .expect("research run id")
            .to_string();
        let sessions = payload["result"]["metadata"]["researchRun"]["sessions"]
            .as_array()
            .expect("research sessions");
        assert_eq!(sessions.len(), 2);

        let completed_session = sessions
            .iter()
            .find(|session| session["status"] == Value::String("completed".to_string()))
            .expect("completed session");
        let failed_session = sessions
            .iter()
            .find(|session| session["status"] == Value::String("failed".to_string()))
            .expect("failed session");

        assert_eq!(
            failed_session["parentRunId"],
            Value::String(run_id.clone())
        );
        let failed_session_id = failed_session["sessionId"]
            .as_str()
            .expect("failed session id")
            .to_string();
        let failed_last_task_id = failed_session["lastTaskId"]
            .as_str()
            .expect("failed last task id")
            .to_string();
        let completed_session_id = completed_session["sessionId"]
            .as_str()
            .expect("completed session id")
            .to_string();

        let failed_wait_payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_sub_agent_wait",
                "params":{
                    "sessionId": failed_session_id,
                    "timeoutMs": 1_000,
                }
            }),
        )
        .await;
        assert_eq!(failed_wait_payload["ok"], Value::Bool(true));
        assert_eq!(failed_wait_payload["result"]["done"], Value::Bool(true));
        assert_eq!(failed_wait_payload["result"]["timedOut"], Value::Bool(false));
        assert_eq!(
            failed_wait_payload["result"]["task"]["taskId"],
            Value::String(failed_last_task_id)
        );
        assert_eq!(
            failed_wait_payload["result"]["task"]["status"],
            Value::String("failed".to_string())
        );
        assert_eq!(
            failed_wait_payload["result"]["session"]["status"],
            Value::String("failed".to_string())
        );

        let completed_status_payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_sub_agent_status",
                "params":{
                    "sessionId": completed_session_id,
                }
            }),
        )
        .await;
        assert_eq!(completed_status_payload["ok"], Value::Bool(true));
        assert_eq!(
            completed_status_payload["result"]["status"],
            Value::String("completed".to_string())
        );
    }

    #[tokio::test]
    async fn live_skill_execute_research_orchestrator_interrupts_child_session_after_wait_timeout() {
        let (base_url, handle) = spawn_live_skills_network_mock_server_with_delay(650).await;
        let mut config = test_service_config();
        config.live_skills_network_base_url = base_url;
        config.live_skills_network_timeout_ms = 3_000;
        let app = test_router_with_config(config);
        let payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_live_skill_execute",
                "params":{
                    "skillId":"research-orchestrator",
                    "input":"latest rust async runtime trends",
                    "options":{
                        "subQueries":[
                            "latest rust async runtime trends"
                        ],
                        "maxParallel":1,
                        "maxResults":2,
                        "maxCharsPerResult":240,
                        "fetchPageContent":true,
                        "timeoutMs":700
                    }
                }
            }),
        )
        .await;
        handle.abort();
        assert_eq!(payload["ok"], Value::Bool(true), "payload: {payload:#}");
        assert_eq!(
            payload["result"]["status"],
            Value::String("failed".to_string())
        );
        assert_eq!(
            payload["result"]["metadata"]["researchRun"]["providerDiagnostics"]["childFailureCount"],
            Value::Number(1_u64.into())
        );
        let sessions = payload["result"]["metadata"]["researchRun"]["sessions"]
            .as_array()
            .expect("research sessions");
        assert_eq!(sessions.len(), 1);
        assert_eq!(
            sessions[0]["status"],
            Value::String("interrupted".to_string())
        );
        assert_eq!(
            sessions[0]["checkpointState"]["state"],
            Value::String("interrupted".to_string())
        );
    }

    #[tokio::test]
    async fn sub_agent_spawn_persists_research_scope_metadata() {
        let app = test_router();
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_sub_agent_spawn",
                  "params":{
                    "workspaceId":"workspace-test",
                    "title":"research worker",
                    "accessMode":"read-only",
                    "scopeProfile":"research",
                    "allowedSkillIds":["network-analysis","core-read"],
                    "allowNetwork":true,
                    "workspaceReadPaths":["docs","packages/code-runtime-service-rs/src"],
                    "parentRunId":"research-run-1"
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
        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(
            payload["result"]["scopeProfile"],
            Value::String("research".to_string())
        );
        assert_eq!(payload["result"]["allowNetwork"], Value::Bool(true));
        assert_eq!(
            payload["result"]["parentRunId"],
            Value::String("research-run-1".to_string())
        );
        assert_eq!(
            payload["result"]["allowedSkillIds"],
            json!(["network-analysis", "core-read"])
        );
        assert_eq!(
            payload["result"]["workspaceReadPaths"],
            json!(["docs", "packages/code-runtime-service-rs/src"])
        );
    }

    #[tokio::test]
    async fn sub_agent_spawn_applies_review_scope_defaults_and_metadata() {
        let app = test_router();
        let payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_sub_agent_spawn",
                "params":{
                    "workspaceId":"workspace-test",
                    "title":"review worker",
                    "accessMode":"read-only",
                    "scopeProfile":"review"
                }
            }),
        )
        .await;

        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(
            payload["result"]["scopeProfile"],
            Value::String("review".to_string())
        );
        assert_eq!(
            payload["result"]["accessMode"],
            Value::String("read-only".to_string())
        );
        assert_eq!(payload["result"]["allowNetwork"], Value::Bool(false));
        assert_eq!(
            payload["result"]["checkpointState"]["state"],
            Value::String("queued".to_string())
        );
        assert_eq!(
            payload["result"]["profileDescriptor"]["profile"],
            Value::String("review".to_string())
        );
        assert_eq!(
            payload["result"]["profileDescriptor"]["readOnly"],
            Value::Bool(true)
        );
        assert_eq!(
            payload["result"]["profileDescriptor"]["allowNetwork"],
            Value::Bool(false)
        );
        assert_eq!(
            payload["result"]["allowedSkillIds"],
            json!(["core-read", "core-grep", "core-tree"])
        );
        assert!(payload["result"]["checkpointId"]
            .as_str()
            .is_some_and(|value| !value.trim().is_empty()));
        assert_eq!(
            payload["result"]["traceId"],
            Value::String(format!(
                "sub-agent:{}",
                payload["result"]["sessionId"]
                    .as_str()
                    .expect("review sub-agent session id")
            ))
        );
        assert_eq!(payload["result"]["recovered"], Value::Bool(false));
        assert_eq!(
            payload["result"]["approvalEvents"],
            json!([])
        );
        assert!(payload["result"]["compactionSummary"].is_null());
        assert!(payload["result"]["evalTags"]
            .as_array()
            .is_some_and(|tags| tags.iter().any(|tag| tag == "scope:review")));
    }

    #[tokio::test]
    async fn sub_agent_wait_times_out_for_idle_session_instead_of_completing() {
        let app = test_router();
        let spawn_payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_sub_agent_spawn",
                "params":{
                    "workspaceId":"workspace-test",
                    "title":"review worker",
                    "accessMode":"read-only",
                    "scopeProfile":"review"
                }
            }),
        )
        .await;

        assert_eq!(spawn_payload["ok"], Value::Bool(true));
        assert_eq!(
            spawn_payload["result"]["status"],
            Value::String("idle".to_string())
        );

        let wait_payload = send_rpc_request(
            app,
            json!({
                "method":"code_sub_agent_wait",
                "params":{
                    "sessionId": spawn_payload["result"]["sessionId"],
                    "timeoutMs": 50,
                    "pollIntervalMs": 25
                }
            }),
        )
        .await;

        assert_eq!(wait_payload["ok"], Value::Bool(true), "payload: {wait_payload:#}");
        assert_eq!(wait_payload["result"]["done"], Value::Bool(false));
        assert_eq!(wait_payload["result"]["timedOut"], Value::Bool(true));
        assert_eq!(wait_payload["result"]["task"], Value::Null);
        assert_eq!(
            wait_payload["result"]["session"]["status"],
            Value::String("idle".to_string())
        );
        assert_eq!(
            wait_payload["result"]["session"]["checkpointState"]["state"],
            Value::String("queued".to_string())
        );
    }

    #[tokio::test]
    async fn sub_agent_send_maps_review_scope_to_review_agent_profile() {
        let app = test_router();
        let spawn_payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_sub_agent_spawn",
                "params":{
                    "workspaceId":"workspace-test",
                    "title":"review worker",
                    "accessMode":"read-only",
                    "scopeProfile":"review"
                }
            }),
        )
        .await;
        assert_eq!(spawn_payload["ok"], Value::Bool(true));
        let session_id = spawn_payload["result"]["sessionId"]
            .as_str()
            .expect("review session id")
            .to_string();

        let send_payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_sub_agent_send",
                "params":{
                    "sessionId": session_id,
                    "instruction":"Review the runtime profile metadata implementation."
                }
            }),
        )
        .await;

        assert_eq!(send_payload["ok"], Value::Bool(true));
        assert_eq!(
            send_payload["result"]["task"]["agentProfile"],
            Value::String("review".to_string())
        );
        assert_eq!(
            send_payload["result"]["session"]["scopeProfile"],
            Value::String("review".to_string())
        );
        assert_eq!(
            send_payload["result"]["session"]["checkpointState"]["state"],
            Value::String("running".to_string())
        );
        assert_eq!(
            send_payload["result"]["session"]["profileDescriptor"]["profile"],
            Value::String("review".to_string())
        );
    }

    #[tokio::test]
    async fn sub_agent_review_session_tracks_approval_events_and_terminal_failure() {
        let app = test_router();
        let spawn_payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_sub_agent_spawn",
                "params":{
                    "workspaceId":"workspace-test",
                    "title":"review worker",
                    "accessMode":"read-only",
                    "scopeProfile":"review"
                }
            }),
        )
        .await;
        assert_eq!(spawn_payload["ok"], Value::Bool(true));
        let session_id = spawn_payload["result"]["sessionId"]
            .as_str()
            .expect("review session id")
            .to_string();

        let send_payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_sub_agent_send",
                "params":{
                    "sessionId": session_id,
                    "instruction":"Review the runtime profile metadata implementation.",
                    "requiresApproval": true,
                    "approvalReason": "review-safe audit"
                }
            }),
        )
        .await;
        assert_eq!(send_payload["ok"], Value::Bool(true));
        let task_id = send_payload["result"]["task"]["taskId"]
            .as_str()
            .expect("review task id")
            .to_string();

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

        let awaiting_session_payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_sub_agent_wait",
                "params":{
                    "sessionId": send_payload["result"]["session"]["sessionId"],
                    "timeoutMs": 50,
                    "pollIntervalMs": 25,
                }
            }),
        )
        .await;
        assert_eq!(awaiting_session_payload["ok"], Value::Bool(true));
        assert_eq!(awaiting_session_payload["result"]["done"], Value::Bool(false));
        assert_eq!(awaiting_session_payload["result"]["timedOut"], Value::Bool(true));
        assert_eq!(
            awaiting_session_payload["result"]["session"]["checkpointState"]["state"],
            Value::String("awaiting_approval".to_string())
        );
        assert!(awaiting_session_payload["result"]["session"]["approvalEvents"]
            .as_array()
            .is_some_and(|events| !events.is_empty()));

        let approval_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_checkpoint_approval",
                "params": {
                    "approvalId": approval_id,
                    "decision": "rejected",
                    "reason": "blocked in review test"
                }
            }),
        )
        .await;
        assert_eq!(approval_payload["ok"], Value::Bool(true));

        let wait_payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_sub_agent_wait",
                "params":{
                    "sessionId": send_payload["result"]["session"]["sessionId"],
                    "timeoutMs": 1_000,
                }
            }),
        )
        .await;
        assert_eq!(wait_payload["ok"], Value::Bool(true));
        assert_eq!(wait_payload["result"]["done"], Value::Bool(true));
        assert_eq!(
            wait_payload["result"]["session"]["status"],
            Value::String("failed".to_string())
        );
        assert_eq!(
            wait_payload["result"]["session"]["checkpointState"]["state"],
            Value::String("failed".to_string())
        );
        assert!(wait_payload["result"]["session"]["approvalEvents"]
            .as_array()
            .is_some_and(|events| {
                events.iter().any(|event| {
                    event["status"] == Value::String("rejected".to_string())
                })
        }));
    }

    #[tokio::test]
    async fn rpc_hugerouter_commercial_service_read_reports_not_connected_without_route_token() {
        let app = test_router();
        let payload = send_rpc_request(
            app,
            json!({"method":"code_hugerouter_commercial_service_read","params":{}}),
        )
        .await;

        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(
            payload["result"]["connection"]["status"],
            Value::String("not_connected".to_string())
        );
        assert_eq!(
            payload["result"]["routeToken"]["status"],
            Value::String("not_issued".to_string())
        );
        assert!(payload["result"]["availablePlans"]
            .as_array()
            .is_some_and(|plans| !plans.is_empty()));
    }

    #[tokio::test]
    async fn rpc_hugerouter_commercial_service_read_projects_configured_route_token() {
        let mut config = test_service_config_with_openai_compat("https://router.example.com/v1");
        config.openai_compat_api_key = Some("hgrt_runtime_secret_1234".to_string());
        let app = test_router_with_config(config);
        let payload = send_rpc_request(
            app,
            json!({"method":"code_hugerouter_commercial_service_read","params":{}}),
        )
        .await;

        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(
            payload["result"]["connection"]["status"],
            Value::String("connected".to_string())
        );
        assert_eq!(
            payload["result"]["connection"]["routeBaseUrl"],
            Value::String("https://router.example.com/v1".to_string())
        );
        assert_eq!(
            payload["result"]["routeToken"]["status"],
            Value::String("active".to_string())
        );
        assert_eq!(
            payload["result"]["routeToken"]["lastFour"],
            Value::String("1234".to_string())
        );
        assert!(!payload.to_string().contains("hgrt_runtime_secret_1234"));
    }

    #[tokio::test]
    async fn rpc_hugerouter_route_token_issue_returns_redacted_runtime_managed_token() {
        let mut config = test_service_config_with_openai_compat("https://router.example.com/v1");
        config.openai_compat_api_key = Some("hgrt_runtime_secret_abcd".to_string());
        let app = test_router_with_config(config);
        let payload = send_rpc_request(
            app,
            json!({
                "method":"code_hugerouter_route_token_issue",
                "params":{
                    "envKey":"HUGEROUTER_ROUTE_TOKEN",
                    "scopes":["route:codex","provider:hugerouter-commercial"]
                }
            }),
        )
        .await;

        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(
            payload["result"]["token"],
            Value::String("runtime_managed_route_token_redacted".to_string())
        );
        assert_eq!(
            payload["result"]["summary"]["status"],
            Value::String("active".to_string())
        );
        assert_eq!(
            payload["result"]["summary"]["lastFour"],
            Value::String("abcd".to_string())
        );
        assert!(!payload.to_string().contains("hgrt_runtime_secret_abcd"));
    }

    #[tokio::test]
    async fn rpc_hugerouter_route_token_issue_rejects_missing_runtime_token() {
        let app = test_router();
        let payload = send_rpc_request(
            app,
            json!({"method":"code_hugerouter_route_token_issue","params":{}}),
        )
        .await;

        assert_eq!(payload["ok"], Value::Bool(false));
        assert_eq!(
            payload["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );
    }

    #[tokio::test]
    async fn sub_agent_spawn_rejects_review_scope_unsafe_overrides() {
        let app = test_router();
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_sub_agent_spawn",
                  "params":{
                    "workspaceId":"workspace-test",
                    "title":"review worker",
                    "accessMode":"full-access",
                    "scopeProfile":"review",
                    "allowedSkillIds":["core-read","core-bash","core-write"],
                    "allowNetwork":true,
                    "workspaceReadPaths":["docs","packages/code-runtime-service-rs/src"],
                    "parentRunId":"review-run-1"
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
        assert_eq!(payload["ok"], Value::Bool(false), "payload: {payload:#}");
        assert!(payload["error"]["message"]
            .as_str()
            .is_some_and(|message| message.contains("scope profile `review`")));
    }

    #[tokio::test]
    async fn live_skill_execute_network_analysis_accepts_query_without_input() {
        let (base_url, handle) = spawn_live_skills_network_mock_server().await;
        let mut config = test_service_config();
        config.live_skills_network_base_url = base_url;
        config.live_skills_network_timeout_ms = 3_000;
        let app = test_router_with_config(config);
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_live_skill_execute",
                  "params":{
                    "skillId":"network-analysis",
                    "options":{
                      "query":"rust async runtime",
                      "maxResults":2,
                      "maxCharsPerResult":240
                    }
                  }
                }"#,
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
        assert_eq!(
            payload["result"]["status"],
            Value::String("completed".to_string())
        );
    }

    #[tokio::test]
    async fn live_skill_execute_returns_blocked_when_network_is_disabled() {
        let mut config = test_service_config();
        config.live_skills_network_enabled = false;
        let app = test_router_with_config(config);
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_live_skill_execute",
                  "params":{
                    "skillId":"network-analysis",
                    "input":"rust async runtime"
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
        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(
            payload["result"]["status"],
            Value::String("blocked".to_string())
        );
        assert_eq!(payload["result"]["network"], Value::Null);
    }

    #[tokio::test]
    async fn live_skill_execute_second_run_reports_cache_hit() {
        let (base_url, handle) = spawn_live_skills_network_mock_server().await;
        let mut config = test_service_config();
        config.live_skills_network_base_url = base_url;
        config.live_skills_network_timeout_ms = 3_000;
        config.live_skills_network_cache_ttl_ms = 60_000;
        let app = test_router_with_config(config);

        let request_body = r#"{
          "method":"code_live_skill_execute",
          "params":{
            "skillId":"network-analysis",
            "input":"rust async runtime",
            "options":{
              "query":"rust async runtime",
              "maxResults":2,
              "maxCharsPerResult":240
            }
          }
        }"#;

        let first_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(request_body))
            .expect("build first request");
        let first_response = app
            .clone()
            .oneshot(first_request)
            .await
            .expect("first rpc response");
        assert_eq!(first_response.status(), StatusCode::OK);
        let first_bytes = axum::body::to_bytes(first_response.into_body(), 1024 * 1024)
            .await
            .expect("read first body");
        let first_payload: Value = serde_json::from_slice(&first_bytes).expect("parse first json");
        assert_eq!(first_payload["ok"], Value::Bool(true));
        assert_eq!(
            first_payload["result"]["metadata"]["cacheHit"],
            Value::Bool(false)
        );

        let second_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(request_body))
            .expect("build second request");
        let second_response = app
            .clone()
            .oneshot(second_request)
            .await
            .expect("second rpc response");
        assert_eq!(second_response.status(), StatusCode::OK);
        let second_bytes = axum::body::to_bytes(second_response.into_body(), 1024 * 1024)
            .await
            .expect("read second body");
        let second_payload: Value =
            serde_json::from_slice(&second_bytes).expect("parse second json");
        assert_eq!(second_payload["ok"], Value::Bool(true));
        assert_eq!(
            second_payload["result"]["metadata"]["cacheHit"],
            Value::Bool(true)
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
            ready_payload["runtimeDiagnostics"]["liveSkillNetworkCacheEntries"]
                .as_u64()
                .unwrap_or(0)
                >= 1
        );
        handle.abort();
    }

    #[tokio::test]
    async fn live_skill_execute_rejects_unknown_skill_id() {
        let app = test_router();
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_live_skill_execute",
                  "params":{
                    "skillId":"unknown-skill",
                    "input":"hello"
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

    #[tokio::test]
    async fn live_skill_execute_rejects_oversized_network_query() {
        let app = test_router();
        let oversized_query = "x".repeat(2_049);
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(format!(
                r#"{{
                  "method":"code_live_skill_execute",
                  "params":{{
                    "skillId":"network-analysis",
                    "options":{{"query":"{oversized_query}"}}
                  }}
                }}"#
            )))
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
        assert!(payload["error"]["message"]
            .as_str()
            .unwrap_or_default()
            .contains("Live skill query must be <= 2048 characters."));
    }

    #[tokio::test]
    async fn live_skill_execute_rejects_oversized_core_bash_command() {
        let app = test_router();
        let oversized_command = "x".repeat(8_193);
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(format!(
                r#"{{
                  "method":"code_live_skill_execute",
                  "params":{{
                    "skillId":"core-bash",
                    "options":{{"command":"{oversized_command}"}}
                  }}
                }}"#
            )))
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
        assert!(payload["error"]["message"]
            .as_str()
            .unwrap_or_default()
            .contains("command must be <= 8192 characters."));
    }

    #[tokio::test]
    async fn live_skill_execute_rejects_oversized_core_bash_input_fallback() {
        let app = test_router();
        let oversized_command = "x".repeat(8_193);
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(format!(
                r#"{{
                  "method":"code_live_skill_execute",
                  "params":{{
                    "skillId":"core-bash",
                    "input":"{oversized_command}",
                    "options":{{}}
                  }}
                }}"#
            )))
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
        assert!(payload["error"]["message"]
            .as_str()
            .unwrap_or_default()
            .contains("command must be <= 8192 characters."));
    }

    #[tokio::test]
    async fn live_skill_execute_core_bash_prefers_options_command_over_input() {
        let workspace_root = std::env::temp_dir().join(format!(
            "code-runtime-core-bash-preferred-command-{}",
            rand::random::<u64>()
        ));
        std::fs::create_dir_all(workspace_root.as_path()).expect("create workspace root");

        let app = test_router();

        let create_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(format!(
                r#"{{
                  "method":"code_workspace_create",
                  "params":{{"path":"{}","displayName":"Core Bash Preferred Command Workspace"}}
                }}"#,
                workspace_root.display()
            )))
            .expect("build workspace create request");
        let create_response = app
            .clone()
            .oneshot(create_request)
            .await
            .expect("workspace create response");
        let create_bytes = axum::body::to_bytes(create_response.into_body(), 1024 * 1024)
            .await
            .expect("read workspace create body");
        let create_payload: Value =
            serde_json::from_slice(&create_bytes).expect("parse workspace create payload");
        assert_eq!(create_payload["ok"], Value::Bool(true));
        let workspace_id = create_payload["result"]["id"]
            .as_str()
            .expect("workspace id")
            .to_string();

        let oversized_input = "x".repeat(8_193);
        let bash_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(format!(
                r#"{{
                  "method":"code_live_skill_execute",
                  "params":{{
                    "skillId":"core-bash",
                    "input":"{oversized_input}",
                    "options":{{"workspaceId":"{}","command":"echo preferred-command"}}
                  }}
                }}"#,
                workspace_id
            )))
            .expect("build bash request");
        let bash_response = app
            .clone()
            .oneshot(bash_request)
            .await
            .expect("bash response");
        let bash_bytes = axum::body::to_bytes(bash_response.into_body(), 1024 * 1024)
            .await
            .expect("read bash body");
        let bash_payload: Value = serde_json::from_slice(&bash_bytes).expect("parse bash payload");
        assert_eq!(bash_payload["ok"], Value::Bool(true));
        assert_eq!(
            bash_payload["result"]["status"],
            Value::String("completed".to_string())
        );
        let bash_output = bash_payload["result"]["output"]
            .as_str()
            .unwrap_or_default()
            .to_ascii_lowercase();
        assert!(bash_output.contains("preferred-command"));

        let _ = std::fs::remove_dir_all(workspace_root);
    }

    #[tokio::test]
    async fn live_skill_execute_core_bash_uses_input_when_options_command_is_blank() {
        let workspace_root = std::env::temp_dir().join(format!(
            "code-runtime-core-bash-blank-command-fallback-{}",
            rand::random::<u64>()
        ));
        std::fs::create_dir_all(workspace_root.as_path()).expect("create workspace root");

        let app = test_router();

        let create_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(format!(
                r#"{{
                  "method":"code_workspace_create",
                  "params":{{"path":"{}","displayName":"Core Bash Blank Command Fallback Workspace"}}
                }}"#,
                workspace_root.display()
            )))
            .expect("build workspace create request");
        let create_response = app
            .clone()
            .oneshot(create_request)
            .await
            .expect("workspace create response");
        let create_bytes = axum::body::to_bytes(create_response.into_body(), 1024 * 1024)
            .await
            .expect("read workspace create body");
        let create_payload: Value =
            serde_json::from_slice(&create_bytes).expect("parse workspace create payload");
        assert_eq!(create_payload["ok"], Value::Bool(true));
        let workspace_id = create_payload["result"]["id"]
            .as_str()
            .expect("workspace id")
            .to_string();

        let bash_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(format!(
                r#"{{
                  "method":"code_live_skill_execute",
                  "params":{{
                    "skillId":"core-bash",
                    "input":"echo fallback-from-input",
                    "options":{{"workspaceId":"{}","command":"   "}}
                  }}
                }}"#,
                workspace_id
            )))
            .expect("build bash request");
        let bash_response = app
            .clone()
            .oneshot(bash_request)
            .await
            .expect("bash response");
        let bash_bytes = axum::body::to_bytes(bash_response.into_body(), 1024 * 1024)
            .await
            .expect("read bash body");
        let bash_payload: Value = serde_json::from_slice(&bash_bytes).expect("parse bash payload");
        assert_eq!(bash_payload["ok"], Value::Bool(true));
        assert_eq!(
            bash_payload["result"]["status"],
            Value::String("completed".to_string())
        );
        let bash_output = bash_payload["result"]["output"]
            .as_str()
            .unwrap_or_default()
            .to_ascii_lowercase();
        assert!(bash_output.contains("fallback-from-input"));

        let _ = std::fs::remove_dir_all(workspace_root);
    }

    #[tokio::test]
    async fn live_skill_execute_core_read_write_edit_bash_roundtrip() {
        let workspace_root =
            std::env::temp_dir().join(format!("code-runtime-core-skill-{}", rand::random::<u64>()));
        std::fs::create_dir_all(workspace_root.as_path()).expect("create workspace root");

        let app = test_router();

        let create_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(format!(
                r#"{{
                  "method":"code_workspace_create",
                  "params":{{"path":"{}","displayName":"Core Skills Workspace"}}
                }}"#,
                workspace_root.display()
            )))
            .expect("build workspace create request");
        let create_response = app
            .clone()
            .oneshot(create_request)
            .await
            .expect("workspace create response");
        let create_bytes = axum::body::to_bytes(create_response.into_body(), 1024 * 1024)
            .await
            .expect("read workspace create body");
        let create_payload: Value =
            serde_json::from_slice(&create_bytes).expect("parse workspace create payload");
        assert_eq!(create_payload["ok"], Value::Bool(true));
        let workspace_id = create_payload["result"]["id"]
            .as_str()
            .expect("workspace id")
            .to_string();

        let write_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(format!(
                r#"{{
                  "method":"code_live_skill_execute",
                  "params":{{
                    "skillId":"core-write",
                    "input":"Hello runtime",
                    "options":{{"workspaceId":"{}","path":"notes/hello.txt","content":"Hello runtime"}}
                  }}
                }}"#,
                workspace_id
            )))
            .expect("build write request");
        let write_response = app
            .clone()
            .oneshot(write_request)
            .await
            .expect("write response");
        let write_bytes = axum::body::to_bytes(write_response.into_body(), 1024 * 1024)
            .await
            .expect("read write body");
        let write_payload: Value =
            serde_json::from_slice(&write_bytes).expect("parse write payload");
        assert_eq!(write_payload["ok"], Value::Bool(true));
        assert_eq!(
            write_payload["result"]["status"],
            Value::String("completed".to_string())
        );

        let edit_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(format!(
                r#"{{
                  "method":"code_live_skill_execute",
                  "params":{{
                    "skillId":"core-edit",
                    "input":"",
                    "options":{{"workspaceId":"{}","path":"notes/hello.txt","find":"runtime","replace":"agents"}}
                  }}
                }}"#,
                workspace_id
            )))
            .expect("build edit request");
        let edit_response = app
            .clone()
            .oneshot(edit_request)
            .await
            .expect("edit response");
        let edit_bytes = axum::body::to_bytes(edit_response.into_body(), 1024 * 1024)
            .await
            .expect("read edit body");
        let edit_payload: Value = serde_json::from_slice(&edit_bytes).expect("parse edit payload");
        assert_eq!(edit_payload["ok"], Value::Bool(true));
        assert_eq!(
            edit_payload["result"]["status"],
            Value::String("completed".to_string())
        );

        let read_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(format!(
                r#"{{
                  "method":"code_live_skill_execute",
                  "params":{{
                    "skillId":"core-read",
                    "input":"",
                    "options":{{"workspaceId":"{}","path":"notes/hello.txt"}}
                  }}
                }}"#,
                workspace_id
            )))
            .expect("build read request");
        let read_response = app
            .clone()
            .oneshot(read_request)
            .await
            .expect("read response");
        let read_bytes = axum::body::to_bytes(read_response.into_body(), 1024 * 1024)
            .await
            .expect("read body bytes");
        let read_payload: Value = serde_json::from_slice(&read_bytes).expect("parse read payload");
        assert_eq!(read_payload["ok"], Value::Bool(true));
        assert_eq!(
            read_payload["result"]["status"],
            Value::String("completed".to_string())
        );
        assert_eq!(
            read_payload["result"]["output"],
            Value::String("Hello agents".to_string())
        );

        let bash_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(format!(
                r#"{{
                  "method":"code_live_skill_execute",
                  "params":{{
                    "skillId":"core-bash",
                    "input":"echo core-bash-ok",
                    "options":{{"workspaceId":"{}"}}
                  }}
                }}"#,
                workspace_id
            )))
            .expect("build bash request");
        let bash_response = app
            .clone()
            .oneshot(bash_request)
            .await
            .expect("bash response");
        let bash_bytes = axum::body::to_bytes(bash_response.into_body(), 1024 * 1024)
            .await
            .expect("read bash body");
        let bash_payload: Value = serde_json::from_slice(&bash_bytes).expect("parse bash payload");
        assert_eq!(bash_payload["ok"], Value::Bool(true));
        assert_eq!(
            bash_payload["result"]["status"],
            Value::String("completed".to_string())
        );
        let bash_output = bash_payload["result"]["output"]
            .as_str()
            .unwrap_or_default()
            .to_ascii_lowercase();
        assert!(bash_output.contains("core-bash-ok"));

        let _ = std::fs::remove_dir_all(workspace_root);
    }

    #[tokio::test]
    async fn live_skill_execute_core_write_and_read_accept_missing_input() {
        let workspace_root = std::env::temp_dir().join(format!(
            "code-runtime-core-skill-missing-input-{}",
            rand::random::<u64>()
        ));
        std::fs::create_dir_all(workspace_root.as_path()).expect("create workspace root");

        let app = test_router();

        let create_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(format!(
                r#"{{
                  "method":"code_workspace_create",
                  "params":{{"path":"{}","displayName":"Core Missing Input Workspace"}}
                }}"#,
                workspace_root.display()
            )))
            .expect("build workspace create request");
        let create_response = app
            .clone()
            .oneshot(create_request)
            .await
            .expect("workspace create response");
        let create_bytes = axum::body::to_bytes(create_response.into_body(), 1024 * 1024)
            .await
            .expect("read workspace create body");
        let create_payload: Value =
            serde_json::from_slice(&create_bytes).expect("parse workspace create payload");
        assert_eq!(create_payload["ok"], Value::Bool(true));
        let workspace_id = create_payload["result"]["id"]
            .as_str()
            .expect("workspace id")
            .to_string();

        let write_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(format!(
                r#"{{
                  "method":"code_live_skill_execute",
                  "params":{{
                    "skillId":"core-write",
                    "options":{{"workspaceId":"{}","path":"notes/no-input.txt","content":"from-options"}}
                  }}
                }}"#,
                workspace_id
            )))
            .expect("build write request");
        let write_response = app
            .clone()
            .oneshot(write_request)
            .await
            .expect("write response");
        let write_bytes = axum::body::to_bytes(write_response.into_body(), 1024 * 1024)
            .await
            .expect("read write body");
        let write_payload: Value =
            serde_json::from_slice(&write_bytes).expect("parse write payload");
        assert_eq!(write_payload["ok"], Value::Bool(true));
        assert_eq!(
            write_payload["result"]["status"],
            Value::String("completed".to_string())
        );

        let read_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(format!(
                r#"{{
                  "method":"code_live_skill_execute",
                  "params":{{
                    "skillId":"core-read",
                    "options":{{"workspaceId":"{}","path":"notes/no-input.txt"}}
                  }}
                }}"#,
                workspace_id
            )))
            .expect("build read request");
        let read_response = app
            .clone()
            .oneshot(read_request)
            .await
            .expect("read response");
        let read_bytes = axum::body::to_bytes(read_response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let read_payload: Value = serde_json::from_slice(&read_bytes).expect("parse read payload");
        assert_eq!(read_payload["ok"], Value::Bool(true));
        assert_eq!(
            read_payload["result"]["output"],
            Value::String("from-options".to_string())
        );

        let _ = std::fs::remove_dir_all(workspace_root);
    }

    #[tokio::test]
    async fn prompt_library_crud_and_move_roundtrip() {
        let app = test_router();

        let workspace_create_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{"method":"code_workspace_create","params":{"path":"/tmp/prompts","displayName":"Prompt Workspace"}}"#,
            ))
            .expect("build workspace create request");
        let workspace_create_response = app
            .clone()
            .oneshot(workspace_create_request)
            .await
            .expect("workspace create response");
        let workspace_create_bytes =
            axum::body::to_bytes(workspace_create_response.into_body(), 1024 * 1024)
                .await
                .expect("read workspace create body");
        let workspace_create_payload: Value = serde_json::from_slice(&workspace_create_bytes)
            .expect("parse workspace create payload");
        assert_eq!(workspace_create_payload["ok"], Value::Bool(true));
        let workspace_id = workspace_create_payload["result"]["id"]
            .as_str()
            .expect("workspace id")
            .to_string();

        let create_global_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_prompt_library_create",
                  "params":{
                    "scope":"global",
                    "title":"Global Prompt",
                    "description":"desc-global",
                    "content":"content-global"
                  }
                }"#,
            ))
            .expect("build create global request");
        let create_global_response = app
            .clone()
            .oneshot(create_global_request)
            .await
            .expect("create global response");
        let create_global_bytes =
            axum::body::to_bytes(create_global_response.into_body(), 1024 * 1024)
                .await
                .expect("read create global body");
        let create_global_payload: Value =
            serde_json::from_slice(&create_global_bytes).expect("parse create global payload");
        assert_eq!(create_global_payload["ok"], Value::Bool(true));
        let global_prompt_id = create_global_payload["result"]["id"]
            .as_str()
            .expect("global prompt id")
            .to_string();
        assert_eq!(
            create_global_payload["result"]["scope"],
            Value::String("global".to_string())
        );

        let create_workspace_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(format!(
                r#"{{
                  "method":"code_prompt_library_create",
                  "params":{{
                    "workspaceId":"{}",
                    "scope":"workspace",
                    "title":"Workspace Prompt",
                    "description":"desc-workspace",
                    "content":"content-workspace"
                  }}
                }}"#,
                workspace_id
            )))
            .expect("build create workspace request");
        let create_workspace_response = app
            .clone()
            .oneshot(create_workspace_request)
            .await
            .expect("create workspace response");
        let create_workspace_bytes =
            axum::body::to_bytes(create_workspace_response.into_body(), 1024 * 1024)
                .await
                .expect("read create workspace body");
        let create_workspace_payload: Value = serde_json::from_slice(&create_workspace_bytes)
            .expect("parse create workspace payload");
        assert_eq!(create_workspace_payload["ok"], Value::Bool(true));
        let workspace_prompt_id = create_workspace_payload["result"]["id"]
            .as_str()
            .expect("workspace prompt id")
            .to_string();
        assert_eq!(
            create_workspace_payload["result"]["scope"],
            Value::String("workspace".to_string())
        );

        let list_default_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{"method":"code_prompt_library_list","params":{}}"#,
            ))
            .expect("build list default request");
        let list_default_response = app
            .clone()
            .oneshot(list_default_request)
            .await
            .expect("list default response");
        let list_default_bytes =
            axum::body::to_bytes(list_default_response.into_body(), 1024 * 1024)
                .await
                .expect("read list default body");
        let list_default_payload: Value =
            serde_json::from_slice(&list_default_bytes).expect("parse list default payload");
        assert_eq!(list_default_payload["ok"], Value::Bool(true));
        let default_prompts = list_default_payload["result"]
            .as_array()
            .expect("default prompts array");
        assert_eq!(default_prompts.len(), 1);
        assert_eq!(
            default_prompts[0]["id"],
            Value::String(global_prompt_id.clone())
        );

        let list_workspace_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(format!(
                r#"{{"method":"code_prompt_library_list","params":{{"workspaceId":"{}"}}}}"#,
                workspace_id
            )))
            .expect("build list workspace request");
        let list_workspace_response = app
            .clone()
            .oneshot(list_workspace_request)
            .await
            .expect("list workspace response");
        let list_workspace_bytes =
            axum::body::to_bytes(list_workspace_response.into_body(), 1024 * 1024)
                .await
                .expect("read list workspace body");
        let list_workspace_payload: Value =
            serde_json::from_slice(&list_workspace_bytes).expect("parse list workspace payload");
        assert_eq!(list_workspace_payload["ok"], Value::Bool(true));
        let workspace_prompts = list_workspace_payload["result"]
            .as_array()
            .expect("workspace prompts array");
        assert_eq!(workspace_prompts.len(), 2);
        assert!(workspace_prompts
            .iter()
            .any(|entry| entry["id"] == Value::String(global_prompt_id.clone())));
        assert!(workspace_prompts
            .iter()
            .any(|entry| entry["id"] == Value::String(workspace_prompt_id.clone())));

        let update_workspace_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(format!(
                r#"{{
                  "method":"code_prompt_library_update",
                  "params":{{
                    "promptId":"{}",
                    "title":"Workspace Prompt Updated",
                    "description":"updated-desc",
                    "content":"updated-content"
                  }}
                }}"#,
                workspace_prompt_id
            )))
            .expect("build update workspace request");
        let update_workspace_response = app
            .clone()
            .oneshot(update_workspace_request)
            .await
            .expect("update workspace response");
        let update_workspace_bytes =
            axum::body::to_bytes(update_workspace_response.into_body(), 1024 * 1024)
                .await
                .expect("read update workspace body");
        let update_workspace_payload: Value = serde_json::from_slice(&update_workspace_bytes)
            .expect("parse update workspace payload");
        assert_eq!(update_workspace_payload["ok"], Value::Bool(true));
        assert_eq!(
            update_workspace_payload["result"]["title"],
            Value::String("Workspace Prompt Updated".to_string())
        );

        let move_workspace_to_global_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(format!(
                r#"{{
                  "method":"code_prompt_library_move",
                  "params":{{
                    "promptId":"{}",
                    "targetScope":"global"
                  }}
                }}"#,
                workspace_prompt_id
            )))
            .expect("build move request");
        let move_workspace_to_global_response = app
            .clone()
            .oneshot(move_workspace_to_global_request)
            .await
            .expect("move response");
        let move_workspace_to_global_bytes =
            axum::body::to_bytes(move_workspace_to_global_response.into_body(), 1024 * 1024)
                .await
                .expect("read move body");
        let move_workspace_to_global_payload: Value =
            serde_json::from_slice(&move_workspace_to_global_bytes).expect("parse move payload");
        assert_eq!(move_workspace_to_global_payload["ok"], Value::Bool(true));
        assert_eq!(
            move_workspace_to_global_payload["result"]["scope"],
            Value::String("global".to_string())
        );

        let delete_global_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(format!(
                r#"{{
                  "method":"code_prompt_library_delete",
                  "params":{{"promptId":"{}"}}
                }}"#,
                global_prompt_id
            )))
            .expect("build delete request");
        let delete_global_response = app
            .oneshot(delete_global_request)
            .await
            .expect("delete response");
        let delete_global_bytes =
            axum::body::to_bytes(delete_global_response.into_body(), 1024 * 1024)
                .await
                .expect("read delete body");
        let delete_global_payload: Value =
            serde_json::from_slice(&delete_global_bytes).expect("parse delete payload");
        assert_eq!(delete_global_payload["ok"], Value::Bool(true));
        assert_eq!(delete_global_payload["result"], Value::Bool(true));
    }

