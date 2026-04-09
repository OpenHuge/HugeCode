    use super::*;
    use axum::{
        body::Body,
        http::Request,
        routing::{get, post},
        Json, Router,
    };
    use futures_util::SinkExt;
    use rusqlite::{params, Connection};
    use std::{
        collections::{HashMap, HashSet},
        ffi::OsString,
        fs,
        path::{Path, PathBuf},
        sync::{
            atomic::{AtomicUsize, Ordering as AtomicOrdering},
            Arc,
        },
        time::{Duration, Instant},
    };
    use tokio_tungstenite::{
        connect_async,
        tungstenite::{client::IntoClientRequest, Message as TungsteniteMessage},
        MaybeTlsStream, WebSocketStream,
    };
    use tower::ServiceExt;
    #[cfg(target_os = "macos")]
    use {
        super::local_claude_exec_path::{
            local_claude_exec_env_lock, reset_local_claude_exec_binary_cache,
            CODE_RUNTIME_LOCAL_CLAUDE_EXEC_PATH_ENV,
        },
        std::os::unix::fs::PermissionsExt,
        tempfile::TempDir,
    };

    fn test_sqlite_db_path(prefix: &str) -> String {
        let dir = std::env::temp_dir().join(format!(
            "code-runtime-service-rs-tests-{prefix}-{}-{}",
            std::process::id(),
            rand::random::<u64>()
        ));
        fs::create_dir_all(dir.as_path()).expect("create test sqlite parent directory");
        dir.join("state.sqlite3").display().to_string()
    }

    fn test_service_config() -> ServiceConfig {
        ServiceConfig {
            default_model_id: "gpt-5.3-codex".to_string(),
            openai_api_key: None,
            openai_endpoint: "https://api.openai.com/v1/responses".to_string(),
            openai_compat_base_url: None,
            openai_compat_api_key: None,
            anthropic_api_key: None,
            anthropic_endpoint: DEFAULT_ANTHROPIC_ENDPOINT.to_string(),
            anthropic_version: DEFAULT_ANTHROPIC_VERSION.to_string(),
            gemini_api_key: None,
            gemini_endpoint: DEFAULT_GEMINI_ENDPOINT.to_string(),
            openai_timeout_ms: DEFAULT_OPENAI_TIMEOUT_MS,
            openai_max_retries: DEFAULT_OPENAI_MAX_RETRIES,
            openai_retry_base_ms: DEFAULT_OPENAI_RETRY_BASE_MS,
            openai_compat_model_cache_ttl_ms: DEFAULT_OPENAI_COMPAT_MODEL_CACHE_TTL_MS,
            live_skills_network_enabled: true,
            live_skills_network_base_url: DEFAULT_LIVE_SKILLS_NETWORK_BASE_URL.to_string(),
            live_skills_network_timeout_ms: DEFAULT_LIVE_SKILLS_NETWORK_TIMEOUT_MS,
            live_skills_network_cache_ttl_ms: DEFAULT_LIVE_SKILLS_NETWORK_CACHE_TTL_MS,
            sandbox_enabled: false,
            sandbox_network_access: DEFAULT_SANDBOX_NETWORK_ACCESS.to_string(),
            sandbox_allowed_hosts: Vec::new(),
            oauth_pool_db_path: test_sqlite_db_path("oauth-pool"),
            oauth_secret_key: Some("AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=".to_string()),
            oauth_public_base_url: None,
            oauth_loopback_callback_port: DEFAULT_OAUTH_LOOPBACK_CALLBACK_PORT,
            runtime_auth_token: None,
            agent_max_concurrent_tasks: DEFAULT_AGENT_MAX_CONCURRENT_TASKS,
            agent_task_history_limit: DEFAULT_AGENT_TASK_HISTORY_LIMIT,
            distributed_enabled: false,
            distributed_redis_url: None,
            distributed_lane_count: DEFAULT_DISTRIBUTED_LANE_COUNT,
            distributed_worker_concurrency: DEFAULT_DISTRIBUTED_WORKER_CONCURRENCY,
            distributed_claim_idle_ms: DEFAULT_DISTRIBUTED_CLAIM_IDLE_MS,
            discovery_enabled: false,
            discovery_service_type: DEFAULT_DISCOVERY_SERVICE_TYPE.to_string(),
            discovery_browse_interval_ms: DEFAULT_DISCOVERY_BROWSE_INTERVAL_MS,
            discovery_stale_ttl_ms: DEFAULT_DISCOVERY_STALE_TTL_MS,
            runtime_backend_id: "runtime-test".to_string(),
            runtime_backend_capabilities: vec!["code".to_string()],
            runtime_port: 8788,
            ws_write_buffer_size_bytes: DEFAULT_RUNTIME_WS_WRITE_BUFFER_SIZE_BYTES,
            ws_max_write_buffer_size_bytes: DEFAULT_RUNTIME_WS_MAX_WRITE_BUFFER_SIZE_BYTES,
            ws_max_frame_size_bytes: DEFAULT_RUNTIME_WS_MAX_FRAME_SIZE_BYTES,
            ws_max_message_size_bytes: DEFAULT_RUNTIME_WS_MAX_MESSAGE_SIZE_BYTES,
            ws_max_connections: DEFAULT_RUNTIME_WS_MAX_CONNECTIONS,
            provider_extension_seeds: Vec::new(),
        }
    }

    fn test_service_config_with_openai_compat(base_url: &str) -> ServiceConfig {
        let mut config = test_service_config();
        config.openai_compat_base_url = Some(base_url.to_string());
        config.openai_compat_api_key = Some("compat-test-key".to_string());
        config
    }

    fn test_service_config_with_openai_compat_oauth_only(base_url: &str) -> ServiceConfig {
        let mut config = test_service_config_with_openai_compat(base_url);
        config.openai_compat_api_key = None;
        config.openai_api_key = None;
        config.anthropic_api_key = None;
        config.gemini_api_key = None;
        config
    }

    fn test_service_config_with_runtime_auth_token(token: &str) -> ServiceConfig {
        let mut config = test_service_config();
        config.runtime_auth_token = Some(token.to_string());
        config
    }

    fn test_extension_provider(base_url: &str, api_key: &str) -> RuntimeProviderExtension {
        RuntimeProviderExtension {
            provider_id: "deepseek".to_string(),
            display_name: "DeepSeek".to_string(),
            pool: "deepseek".to_string(),
            default_model_id: "deepseek-chat".to_string(),
            compat_base_url: base_url.to_string(),
            aliases: vec!["deepseek".to_string(), "ds".to_string()],
            api_key_env: "DEEPSEEK_API_KEY".to_string(),
            api_key: Some(api_key.to_string()),
        }
    }

    fn test_router() -> Router {
        test_router_with_config(test_service_config())
    }

    fn test_router_with_config(config: ServiceConfig) -> Router {
        let state = create_initial_state("gpt-5.3-codex");
        build_router(state, config)
    }

    fn reserve_loopback_port() -> u16 {
        let listener = std::net::TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, 0))
            .expect("reserve loopback callback port");
        let port = listener
            .local_addr()
            .expect("read reserved loopback callback port")
            .port();
        drop(listener);
        port
    }

    async fn wait_for_loopback_port_availability(port: u16, expected_available: bool) {
        for _ in 0..80 {
            match std::net::TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, port)) {
                Ok(listener) => {
                    drop(listener);
                    if expected_available {
                        return;
                    }
                }
                Err(_) if !expected_available => return,
                Err(_) => {}
            }
            tokio::time::sleep(Duration::from_millis(25)).await;
        }
        panic!(
            "loopback callback port {port} did not reach expected availability={expected_available}"
        );
    }

    fn test_router_with_native_state_db_path(
        config: ServiceConfig,
        db_path: &Path,
    ) -> Router {
        let state = create_initial_state("gpt-5.3-codex");
        let native_state_store =
            Arc::new(crate::native_state_store::NativeStateStore::new(db_path.to_path_buf()));
        build_router_with_native_state_store(state, config, native_state_store)
    }

    struct TestEnvVarGuard {
        key: &'static str,
        previous: Option<OsString>,
    }

    impl TestEnvVarGuard {
        fn set(key: &'static str, value: &str) -> Self {
            let previous = std::env::var_os(key);
            unsafe {
                std::env::set_var(key, value);
            }
            Self { key, previous }
        }
    }

    impl Drop for TestEnvVarGuard {
        fn drop(&mut self) {
            unsafe {
                match self.previous.as_ref() {
                    Some(value) => std::env::set_var(self.key, value),
                    None => std::env::remove_var(self.key),
                }
            }
        }
    }

    async fn send_rpc_request_raw(app: Router, payload: Value) -> Value {
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(payload.to_string()))
            .expect("build rpc request");
        let response = app.oneshot(request).await.expect("rpc response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read rpc body");
        serde_json::from_slice(&bytes).expect("parse rpc json")
    }

    async fn send_rpc_request(app: Router, mut payload: Value) -> Value {
        if payload.get("method").and_then(Value::as_str) == Some("code_runtime_run_start_v2") {
            let Some(params) = payload.get_mut("params").and_then(Value::as_object_mut) else {
                return send_rpc_request_raw(app, payload).await;
            };
            if !params.contains_key("approvedPlanVersion") {
                let prepare_payload = json!({
                    "method": "code_runtime_run_prepare_v2",
                    "params": Value::Object(params.clone()),
                });
                let prepare_response = send_rpc_request_raw(app.clone(), prepare_payload).await;
                if let Some(plan_version) = prepare_response["result"]["plan"]["planVersion"].as_str()
                {
                    params.insert(
                        "approvedPlanVersion".to_string(),
                        Value::String(plan_version.to_string()),
                    );
                }
            }
        }
        send_rpc_request_raw(app, payload).await
    }

    async fn send_runtime_service_rpc_request_raw(
        client: &reqwest::Client,
        service_base_url: &str,
        payload: Value,
    ) -> (reqwest::StatusCode, Value) {
        let response = client
            .post(format!("{service_base_url}/rpc"))
            .json(&payload)
            .send()
            .await
            .expect("send runtime service rpc request");
        let status = response.status();
        let payload = response
            .json::<Value>()
            .await
            .expect("parse runtime service rpc response");
        (status, payload)
    }

    async fn send_runtime_service_rpc_request(
        client: &reqwest::Client,
        service_base_url: &str,
        mut payload: Value,
    ) -> (reqwest::StatusCode, Value) {
        if payload.get("method").and_then(Value::as_str) == Some("code_runtime_run_start_v2") {
            let Some(params) = payload.get_mut("params").and_then(Value::as_object_mut) else {
                return send_runtime_service_rpc_request_raw(client, service_base_url, payload)
                    .await;
            };
            if !params.contains_key("approvedPlanVersion") {
                let prepare_payload = json!({
                    "method": "code_runtime_run_prepare_v2",
                    "params": Value::Object(params.clone()),
                });
                let (_, prepare_response) =
                    send_runtime_service_rpc_request_raw(client, service_base_url, prepare_payload)
                        .await;
                if let Some(plan_version) = prepare_response["result"]["plan"]["planVersion"]
                    .as_str()
                {
                    params.insert(
                        "approvedPlanVersion".to_string(),
                        Value::String(plan_version.to_string()),
                    );
                }
            }
        }
        send_runtime_service_rpc_request_raw(client, service_base_url, payload).await
    }

    async fn send_large_rpc_request(app: Router, payload: Value) -> Value {
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(payload.to_string()))
            .expect("build rpc request");
        let response = app.oneshot(request).await.expect("rpc response");
        let bytes = axum::body::to_bytes(response.into_body(), 8 * 1024 * 1024)
            .await
            .expect("read rpc body");
        serde_json::from_slice(&bytes).expect("parse rpc json")
    }

    #[derive(Debug, serde::Deserialize)]
    struct RuntimeEvalScenarioFixture {
        id: String,
        policy: String,
        kind: String,
        description: String,
        input: Option<String>,
        options: Option<Value>,
        instruction: Option<String>,
        requires_approval: Option<bool>,
        approval_reason: Option<String>,
        approval_decision: Option<String>,
        wait_timeout_ms: Option<u64>,
        expectations: RuntimeEvalScenarioExpectations,
    }

    #[derive(Debug, serde::Deserialize)]
    struct RuntimeEvalScenarioExpectations {
        status: String,
        scope_profile: String,
        checkpoint_state: String,
        profile_used: Option<String>,
        eval_tags: Vec<String>,
        research_session_count: Option<usize>,
        allow_network: Option<bool>,
        allowed_skill_ids: Option<Vec<String>>,
        approval_state: Option<String>,
    }

    fn runtime_eval_fixture_path(name: &str) -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("testdata/runtime-evals")
            .join(format!("{name}.json"))
    }

    fn load_runtime_eval_scenario_fixture(name: &str) -> RuntimeEvalScenarioFixture {
        let path = runtime_eval_fixture_path(name);
        let raw = fs::read_to_string(&path)
            .unwrap_or_else(|error| panic!("read runtime eval fixture {path:?}: {error}"));
        serde_json::from_str(&raw)
            .unwrap_or_else(|error| panic!("parse runtime eval fixture {path:?}: {error}"))
    }

    fn assert_eval_tags_include(actual: &Value, expected: &[String]) {
        let tags = actual
            .as_array()
            .unwrap_or_else(|| panic!("expected eval tags array, got {actual:#}"));
        for tag in expected {
            assert!(
                tags.contains(&Value::String(tag.clone())),
                "missing eval tag `{tag}` in {tags:#?}"
            );
        }
    }

    #[tokio::test]
    async fn runtime_auth_token_rejects_unauthorized_rpc_events_and_ws_routes() {
        let app = test_router_with_config(test_service_config_with_runtime_auth_token(
            "test-runtime-auth-token",
        ));

        let unauthorized_rpc_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                json!({
                    "method":"code_health",
                    "params": {}
                })
                .to_string(),
            ))
            .expect("build unauthorized rpc request");
        let unauthorized_rpc_response = app
            .clone()
            .oneshot(unauthorized_rpc_request)
            .await
            .expect("unauthorized rpc response");
        assert_eq!(unauthorized_rpc_response.status(), StatusCode::UNAUTHORIZED);
        let unauthorized_rpc_bytes =
            axum::body::to_bytes(unauthorized_rpc_response.into_body(), 1024 * 1024)
                .await
                .expect("read unauthorized rpc body");
        let unauthorized_rpc_payload: Value = serde_json::from_slice(&unauthorized_rpc_bytes)
            .expect("parse unauthorized rpc payload");
        assert_eq!(
            unauthorized_rpc_payload["error"]["code"],
            Value::String("UNAUTHORIZED".to_string())
        );

        let authorized_rpc_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .header("x-code-runtime-auth-token", "test-runtime-auth-token")
            .body(Body::from(
                json!({
                    "method":"code_health",
                    "params": {}
                })
                .to_string(),
            ))
            .expect("build authorized rpc request");
        let authorized_rpc_response = app
            .clone()
            .oneshot(authorized_rpc_request)
            .await
            .expect("authorized rpc response");
        assert_eq!(authorized_rpc_response.status(), StatusCode::OK);

        let bearer_rpc_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .header("authorization", "Bearer test-runtime-auth-token")
            .body(Body::from(
                json!({
                    "method":"code_health",
                    "params": {}
                })
                .to_string(),
            ))
            .expect("build bearer rpc request");
        let bearer_rpc_response = app
            .clone()
            .oneshot(bearer_rpc_request)
            .await
            .expect("bearer rpc response");
        assert_eq!(bearer_rpc_response.status(), StatusCode::OK);

        let unauthorized_events_request = Request::builder()
            .method("GET")
            .uri("/events")
            .body(Body::empty())
            .expect("build unauthorized events request");
        let unauthorized_events_response = app
            .clone()
            .oneshot(unauthorized_events_request)
            .await
            .expect("unauthorized events response");
        assert_eq!(
            unauthorized_events_response.status(),
            StatusCode::UNAUTHORIZED
        );

        let authorized_events_request = Request::builder()
            .method("GET")
            .uri("/events?token=test-runtime-auth-token")
            .body(Body::empty())
            .expect("build authorized events request");
        let authorized_events_response = app
            .clone()
            .oneshot(authorized_events_request)
            .await
            .expect("authorized events response");
        assert_eq!(authorized_events_response.status(), StatusCode::OK);

        let unauthorized_ws_request = Request::builder()
            .method("GET")
            .uri("/ws")
            .body(Body::empty())
            .expect("build unauthorized ws request");
        let unauthorized_ws_response = app
            .clone()
            .oneshot(unauthorized_ws_request)
            .await
            .expect("unauthorized ws response");
        assert_eq!(unauthorized_ws_response.status(), StatusCode::UNAUTHORIZED);

        let authorized_ws_request = Request::builder()
            .method("GET")
            .uri("/ws?token=test-runtime-auth-token")
            .body(Body::empty())
            .expect("build authorized ws request");
        let authorized_ws_response = app
            .clone()
            .oneshot(authorized_ws_request)
            .await
            .expect("authorized ws response");
        assert_ne!(authorized_ws_response.status(), StatusCode::UNAUTHORIZED);

        let health_request = Request::builder()
            .method("GET")
            .uri("/health")
            .body(Body::empty())
            .expect("build health request");
        let health_response = app
            .clone()
            .oneshot(health_request)
            .await
            .expect("health response");
        assert_eq!(health_response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn codex_oauth_start_returns_authorize_url_and_callback_rejects_missing_code() {
        let app = test_router();
        let start_request = Request::builder()
            .method("POST")
            .uri(CODE_RUNTIME_OAUTH_CODEX_START_PATH)
            .header("host", "127.0.0.1:8788")
            .header("content-type", "application/json")
            .body(Body::from(r#"{"workspaceId":"ws-oauth-1"}"#))
            .expect("build oauth start request");
        let start_response = app
            .clone()
            .oneshot(start_request)
            .await
            .expect("oauth start response");
        assert_eq!(start_response.status(), StatusCode::OK);
        let start_body = axum::body::to_bytes(start_response.into_body(), 1024 * 1024)
            .await
            .expect("read oauth start response");
        let start_payload: Value =
            serde_json::from_slice(&start_body).expect("parse oauth start payload");
        let auth_url = start_payload
            .get("authUrl")
            .and_then(Value::as_str)
            .expect("oauth start authUrl");
        let parsed_url = reqwest::Url::parse(auth_url).expect("parse authorize url");
        assert!(parsed_url.as_str().contains("/oauth/authorize"));
        assert!(
            auth_url.contains(
                "scope=openid%20profile%20email%20offline_access%20api.connectors.read%20api.connectors.invoke"
            ),
            "authorize url should include connector scopes using percent encoding"
        );
        assert!(
            !auth_url.contains("openid+profile+email+offline_access"),
            "authorize url should not use form '+' encoding"
        );
        let state = parsed_url
            .query_pairs()
            .find(|(key, _)| key == "state")
            .map(|(_, value)| value.to_string())
            .expect("state query param");
        let redirect_uri = parsed_url
            .query_pairs()
            .find(|(key, _)| key == "redirect_uri")
            .map(|(_, value)| value.to_string())
            .expect("redirect_uri query param");
        assert_eq!(redirect_uri, "http://localhost:1455/auth/callback");
        let originator = parsed_url
            .query_pairs()
            .find(|(key, _)| key == "originator")
            .map(|(_, value)| value.to_string())
            .expect("originator query param");
        assert_eq!(originator, CODEX_OAUTH_ORIGINATOR);
        assert_eq!(originator, "hypecode");
        assert!(
            parsed_url
                .query_pairs()
                .find(|(key, _)| key == "allowed_workspace_id")
                .is_none(),
            "authorize url should not include allowed_workspace_id by default"
        );

        let callback_request = Request::builder()
            .method("GET")
            .uri(format!(
                "{CODE_RUNTIME_OAUTH_CODEX_CALLBACK_PATH}?state={state}"
            ))
            .body(Body::empty())
            .expect("build oauth callback request");
        let callback_response = app
            .clone()
            .oneshot(callback_request)
            .await
            .expect("oauth callback response");
        assert_eq!(callback_response.status(), StatusCode::BAD_REQUEST);
        let callback_body = axum::body::to_bytes(callback_response.into_body(), 1024 * 1024)
            .await
            .expect("read oauth callback response");
        let callback_html = String::from_utf8_lossy(&callback_body);
        assert!(callback_html.contains("Missing OAuth authorization code"));
        assert!(
            !callback_html.contains("window.close"),
            "error callback html should remain open for debugging"
        );
    }

    #[tokio::test]
    async fn codex_oauth_loopback_listener_binds_on_demand_and_releases_on_cancel() {
        let mut config = test_service_config();
        let loopback_port = reserve_loopback_port();
        config.oauth_loopback_callback_port = loopback_port;
        let app = test_router_with_config(config);

        wait_for_loopback_port_availability(loopback_port, true).await;

        let start_request = Request::builder()
            .method("POST")
            .uri(CODE_RUNTIME_OAUTH_CODEX_START_PATH)
            .header("host", "127.0.0.1:8788")
            .header("content-type", "application/json")
            .body(Body::from(r#"{"workspaceId":"ws-oauth-bind-on-demand"}"#))
            .expect("build oauth start request");
        let start_response = app
            .clone()
            .oneshot(start_request)
            .await
            .expect("oauth start response");
        assert_eq!(start_response.status(), StatusCode::OK);

        wait_for_loopback_port_availability(loopback_port, false).await;

        let cancel_request = Request::builder()
            .method("POST")
            .uri(CODE_RUNTIME_OAUTH_CODEX_CANCEL_PATH)
            .header("content-type", "application/json")
            .body(Body::from(r#"{"workspaceId":"ws-oauth-bind-on-demand"}"#))
            .expect("build oauth cancel request");
        let cancel_response = app
            .clone()
            .oneshot(cancel_request)
            .await
            .expect("oauth cancel response");
        assert_eq!(cancel_response.status(), StatusCode::OK);

        wait_for_loopback_port_availability(loopback_port, true).await;
    }

    #[tokio::test]
    async fn codex_oauth_loopback_listener_releases_after_callback_failure() {
        let mut config = test_service_config();
        let loopback_port = reserve_loopback_port();
        config.oauth_loopback_callback_port = loopback_port;
        let app = test_router_with_config(config);

        let start_request = Request::builder()
            .method("POST")
            .uri(CODE_RUNTIME_OAUTH_CODEX_START_PATH)
            .header("host", "127.0.0.1:8788")
            .header("content-type", "application/json")
            .body(Body::from(r#"{"workspaceId":"ws-oauth-release-after-callback"}"#))
            .expect("build oauth start request");
        let start_response = app
            .clone()
            .oneshot(start_request)
            .await
            .expect("oauth start response");
        assert_eq!(start_response.status(), StatusCode::OK);
        let start_body = axum::body::to_bytes(start_response.into_body(), 1024 * 1024)
            .await
            .expect("read oauth start response");
        let start_payload: Value =
            serde_json::from_slice(&start_body).expect("parse oauth start payload");
        let auth_url = start_payload
            .get("authUrl")
            .and_then(Value::as_str)
            .expect("oauth start authUrl");
        let state = reqwest::Url::parse(auth_url)
            .expect("parse authorize url")
            .query_pairs()
            .find(|(key, _)| key == "state")
            .map(|(_, value)| value.to_string())
            .expect("state query param");

        wait_for_loopback_port_availability(loopback_port, false).await;

        let callback_request = Request::builder()
            .method("GET")
            .uri(format!(
                "{CODE_RUNTIME_OAUTH_CODEX_CALLBACK_PATH}?state={state}"
            ))
            .body(Body::empty())
            .expect("build oauth callback request");
        let callback_response = app
            .clone()
            .oneshot(callback_request)
            .await
            .expect("oauth callback response");
        assert_eq!(callback_response.status(), StatusCode::BAD_REQUEST);

        wait_for_loopback_port_availability(loopback_port, true).await;
    }

    #[tokio::test]
    async fn codex_oauth_cancel_revokes_pending_workspace_attempt() {
        let app = test_router();
        let start_request = Request::builder()
            .method("POST")
            .uri(CODE_RUNTIME_OAUTH_CODEX_START_PATH)
            .header("host", "127.0.0.1:8788")
            .header("content-type", "application/json")
            .body(Body::from(r#"{"workspaceId":"ws-oauth-cancel"}"#))
            .expect("build oauth start request");
        let start_response = app
            .clone()
            .oneshot(start_request)
            .await
            .expect("oauth start response");
        let start_body = axum::body::to_bytes(start_response.into_body(), 1024 * 1024)
            .await
            .expect("read oauth start response");
        let start_payload: Value =
            serde_json::from_slice(&start_body).expect("parse oauth start payload");
        let auth_url = start_payload
            .get("authUrl")
            .and_then(Value::as_str)
            .expect("oauth start authUrl");
        let state = reqwest::Url::parse(auth_url)
            .expect("parse authorize url")
            .query_pairs()
            .find(|(key, _)| key == "state")
            .map(|(_, value)| value.to_string())
            .expect("state query param");

        let cancel_request = Request::builder()
            .method("POST")
            .uri(CODE_RUNTIME_OAUTH_CODEX_CANCEL_PATH)
            .header("content-type", "application/json")
            .body(Body::from(r#"{"workspaceId":"ws-oauth-cancel"}"#))
            .expect("build oauth cancel request");
        let cancel_response = app
            .clone()
            .oneshot(cancel_request)
            .await
            .expect("oauth cancel response");
        assert_eq!(cancel_response.status(), StatusCode::OK);
        let cancel_body = axum::body::to_bytes(cancel_response.into_body(), 1024 * 1024)
            .await
            .expect("read oauth cancel response");
        let cancel_payload: Value =
            serde_json::from_slice(&cancel_body).expect("parse oauth cancel payload");
        assert_eq!(
            cancel_payload.get("canceled").and_then(Value::as_bool),
            Some(true)
        );

        let callback_request = Request::builder()
            .method("GET")
            .uri(format!(
                "{CODE_RUNTIME_OAUTH_CODEX_CALLBACK_PATH}?state={state}&code=test-code"
            ))
            .body(Body::empty())
            .expect("build oauth callback request");
        let callback_response = app
            .clone()
            .oneshot(callback_request)
            .await
            .expect("oauth callback response");
        assert_eq!(callback_response.status(), StatusCode::BAD_REQUEST);
        let callback_body = axum::body::to_bytes(callback_response.into_body(), 1024 * 1024)
            .await
            .expect("read oauth callback response");
        let callback_html = String::from_utf8_lossy(&callback_body);
        assert!(callback_html.contains("no longer valid"));
    }

    #[tokio::test]
    async fn codex_oauth_start_uses_public_base_url_when_configured() {
        let mut config = test_service_config();
        config.oauth_public_base_url = Some("https://runtime.example.com".to_string());
        let app = test_router_with_config(config);

        let start_request = Request::builder()
            .method("POST")
            .uri(CODE_RUNTIME_OAUTH_CODEX_START_PATH)
            .header("content-type", "application/json")
            .body(Body::from(r#"{"workspaceId":"ws-oauth-public"}"#))
            .expect("build oauth start request");
        let start_response = app
            .clone()
            .oneshot(start_request)
            .await
            .expect("oauth start response");
        assert_eq!(start_response.status(), StatusCode::OK);
        let start_body = axum::body::to_bytes(start_response.into_body(), 1024 * 1024)
            .await
            .expect("read oauth start response");
        let start_payload: Value =
            serde_json::from_slice(&start_body).expect("parse oauth start payload");
        let auth_url = start_payload
            .get("authUrl")
            .and_then(Value::as_str)
            .expect("oauth start authUrl");
        let redirect_uri = reqwest::Url::parse(auth_url)
            .expect("parse authorize url")
            .query_pairs()
            .find(|(key, _)| key == "redirect_uri")
            .map(|(_, value)| value.to_string())
            .expect("redirect_uri query param");

        assert_eq!(redirect_uri, "https://runtime.example.com/auth/callback");
    }

    #[test]
    fn codex_oauth_token_response_parses_access_token_field() {
        let parsed: codex_oauth_handlers::CodexOauthTokenResponse = serde_json::from_value(json!({
            "id_token": "id-token",
            "refresh_token": "refresh-token",
            "access_token": "access-token"
        }))
        .expect("parse codex oauth token response");
        assert_eq!(parsed.id_token.as_deref(), Some("id-token"));
        assert_eq!(parsed.refresh_token.as_deref(), Some("refresh-token"));
        assert_eq!(parsed.access_token.as_deref(), Some("access-token"));
    }

    #[test]
    fn take_pending_codex_oauth_login_returns_expired_entry_for_expired_state() {
        let now = 10_000_u64;
        let mut pending = HashMap::new();
        pending.insert(
            "state-expired".to_string(),
            codex_oauth_handlers::PendingCodexOauthLogin {
                login_id: "login-expired".to_string(),
                workspace_id: "ws-expired".to_string(),
                redirect_uri: "http://127.0.0.1:8788/auth/callback".to_string(),
                code_verifier: "verifier".to_string(),
                post_message_origin: None,
                expires_at_ms: now.saturating_sub(1),
            },
        );

        let lookup =
            codex_oauth_handlers::take_pending_codex_oauth_login(&mut pending, "state-expired", now);
        match lookup {
            codex_oauth_handlers::PendingCodexOauthLoginLookup::Expired(entry) => {
                assert_eq!(entry.login_id, "login-expired");
                assert_eq!(entry.workspace_id, "ws-expired");
            }
            codex_oauth_handlers::PendingCodexOauthLoginLookup::Found(_) => {
                panic!("expired login unexpectedly returned as active")
            }
            codex_oauth_handlers::PendingCodexOauthLoginLookup::Missing => {
                panic!("expired login unexpectedly returned as missing")
            }
        }
        assert!(pending.is_empty());
    }

    #[test]
    fn oauth_result_html_posts_popup_message_and_only_autocloses_on_success() {
        let success_html =
            codex_oauth_handlers::build_oauth_result_html(
                "Codex OAuth sign-in complete",
                "ok",
                true,
                Some("login-1"),
                Some("https://app.example.test"),
            )
            .0;
        assert!(success_html.contains("fastcode:oauth:codex"));
        assert!(success_html.contains("success: true"));
        assert!(success_html.contains("loginId: \"login-1\""));
        assert!(success_html.contains("\"https://app.example.test\""));
        assert!(!success_html.contains(", \"*\""));
        assert!(success_html.contains("window.close"));

        let failure_html =
            codex_oauth_handlers::build_oauth_result_html(
                "Codex OAuth sign-in failed",
                "failed",
                false,
                Some("login-1"),
                Some("https://app.example.test"),
            )
            .0;
        assert!(failure_html.contains("fastcode:oauth:codex"));
        assert!(failure_html.contains("success: false"));
        assert!(failure_html.contains("loginId: \"login-1\""));
        assert!(!failure_html.contains(", \"*\""));
        assert!(!failure_html.contains("window.close"));
    }

    #[test]
    fn take_pending_codex_oauth_login_prunes_expired_entries_on_missing_lookup() {
        let now = 20_000_u64;
        let mut pending = HashMap::new();
        pending.insert(
            "state-expired".to_string(),
            codex_oauth_handlers::PendingCodexOauthLogin {
                login_id: "login-expired".to_string(),
                workspace_id: "ws-expired".to_string(),
                redirect_uri: "http://127.0.0.1:8788/auth/callback".to_string(),
                code_verifier: "verifier-expired".to_string(),
                post_message_origin: None,
                expires_at_ms: now.saturating_sub(1),
            },
        );
        pending.insert(
            "state-active".to_string(),
            codex_oauth_handlers::PendingCodexOauthLogin {
                login_id: "login-active".to_string(),
                workspace_id: "ws-active".to_string(),
                redirect_uri: "http://127.0.0.1:8788/auth/callback".to_string(),
                code_verifier: "verifier-active".to_string(),
                post_message_origin: None,
                expires_at_ms: now.saturating_add(30_000),
            },
        );

        let lookup =
            codex_oauth_handlers::take_pending_codex_oauth_login(&mut pending, "state-missing", now);
        assert!(matches!(
            lookup,
            codex_oauth_handlers::PendingCodexOauthLoginLookup::Missing
        ));
        assert!(!pending.contains_key("state-expired"));
        assert!(pending.contains_key("state-active"));
    }

    #[test]
    fn generate_codex_pkce_verifier_matches_codex_cli_length_profile() {
        let verifier = codex_oauth_handlers::generate_codex_pkce_verifier();
        assert_eq!(
            verifier.len(),
            86,
            "64 random bytes should produce an 86-char URL-safe verifier"
        );
        assert!(
            verifier
                .chars()
                .all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_'),
            "verifier should be URL-safe base64 without padding"
        );
    }

    async fn fetch_ready_payload(service_base_url: &str, client: &reqwest::Client) -> Value {
        let response = client
            .get(format!("{service_base_url}/ready"))
            .send()
            .await
            .expect("send ready request");
        assert!(matches!(
            response.status(),
            reqwest::StatusCode::OK | reqwest::StatusCode::SERVICE_UNAVAILABLE
        ));
        response.json().await.expect("parse ready payload")
    }

    async fn open_runtime_ws_with_response(
        service_base_url: &str,
        query: Option<&str>,
        offered_protocol: Option<&str>,
    ) -> (
        WebSocketStream<MaybeTlsStream<tokio::net::TcpStream>>,
        tokio_tungstenite::tungstenite::handshake::client::Response,
    ) {
        let mut ws_url = service_base_url.replacen("http://", "ws://", 1);
        ws_url.push_str(CODE_RUNTIME_RPC_TRANSPORT_WS_PATH);
        if let Some(query) = query {
            ws_url.push('?');
            ws_url.push_str(query);
        }
        let mut request = ws_url
            .into_client_request()
            .expect("build runtime ws request");
        if let Some(protocol) = offered_protocol {
            request.headers_mut().insert(
                "Sec-WebSocket-Protocol",
                protocol.parse().expect("parse offered ws protocol"),
            );
        }
        let (socket, response) = connect_async(request).await.expect("connect runtime ws");
        assert_eq!(response.status(), reqwest::StatusCode::SWITCHING_PROTOCOLS);
        (socket, response)
    }

    async fn open_runtime_ws(
        service_base_url: &str,
        query: Option<&str>,
    ) -> WebSocketStream<MaybeTlsStream<tokio::net::TcpStream>> {
        let (socket, _) = open_runtime_ws_with_response(service_base_url, query, None).await;
        socket
    }

    async fn read_ws_json(
        socket: &mut WebSocketStream<MaybeTlsStream<tokio::net::TcpStream>>,
    ) -> Value {
        for _ in 0..64 {
            let message = futures_util::StreamExt::next(socket)
                .await
                .expect("websocket stream should stay open")
                .expect("websocket message should be valid");
            match message {
                TungsteniteMessage::Text(text) => {
                    let parsed: Value =
                        serde_json::from_str(text.as_ref()).expect("parse websocket json message");
                    return parsed;
                }
                TungsteniteMessage::Binary(_) => continue,
                TungsteniteMessage::Ping(payload) => {
                    socket
                        .send(TungsteniteMessage::Pong(payload))
                        .await
                        .expect("reply websocket pong");
                }
                TungsteniteMessage::Pong(_) => continue,
                TungsteniteMessage::Close(frame) => {
                    panic!("websocket closed unexpectedly: {frame:?}");
                }
                TungsteniteMessage::Frame(_) => continue,
            }
        }
        panic!("timed out waiting for websocket text message");
    }

    async fn wait_for_agent_task_terminal_status(
        app: Router,
        task_id: &str,
        expected_statuses: &[&str],
    ) -> Value {
        let mut last_status = String::new();
        for _ in 0..120 {
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
            let status = payload["result"]["status"]
                .as_str()
                .or_else(|| payload["result"]["run"]["status"].as_str())
                .or_else(|| payload["result"]["missionRun"]["status"].as_str())
                .unwrap_or_default();
            last_status = status.to_string();
            if expected_statuses.contains(&status) {
                return normalize_runtime_run_payload(payload);
            }
            tokio::time::sleep(Duration::from_millis(25)).await;
        }

        panic!(
            "timed out waiting for agent task terminal status; last status: {last_status}"
        );
    }

    fn normalize_runtime_run_payload(payload: Value) -> Value {
        let Value::Object(mut root) = payload else {
            return payload;
        };
        let Some(result) = root.remove("result") else {
            return Value::Object(root);
        };
        let Value::Object(mut result_object) = result else {
            root.insert("result".to_string(), result);
            return Value::Object(root);
        };
        if let Some(run) = result_object.remove("run") {
            root.insert("result".to_string(), run);
            return Value::Object(root);
        }
        root.insert("result".to_string(), Value::Object(result_object));
        Value::Object(root)
    }

    fn runtime_run_record(payload: &Value) -> &Value {
        payload
            .get("result")
            .and_then(|result| result.get("run"))
            .unwrap_or(&payload["result"])
    }

    fn runtime_run_task_id(payload: &Value) -> String {
        runtime_run_record(payload)
            .get("taskId")
            .and_then(Value::as_str)
            .or_else(|| payload["result"]["missionRun"]["id"].as_str())
            .expect("task id")
            .to_string()
    }

    fn run_async_test_on_large_stack<F>(future: F)
    where
        F: std::future::Future<Output = ()> + Send + 'static,
    {
        let join_result = std::thread::Builder::new()
            .stack_size(32 * 1024 * 1024)
            .spawn(move || {
                let runtime = tokio::runtime::Builder::new_current_thread()
                    .enable_all()
                    .build()
                    .expect("build current-thread tokio runtime");
                runtime.block_on(future);
            })
            .expect("spawn large-stack test thread")
            .join();
        if let Err(error) = join_result {
            std::panic::resume_unwind(error);
        }
    }

    fn run_async_test_on_large_stack_local<B, F>(build_future: B)
    where
        B: FnOnce() -> F + Send + 'static,
        F: std::future::Future<Output = ()> + 'static,
    {
        let join_result = std::thread::Builder::new()
            .stack_size(32 * 1024 * 1024)
            .spawn(move || {
                let runtime = tokio::runtime::Builder::new_current_thread()
                    .enable_all()
                    .build()
                    .expect("build current-thread tokio runtime");
                runtime.block_on(build_future());
            })
            .expect("spawn large-stack local test thread")
            .join();
        if let Err(error) = join_result {
            std::panic::resume_unwind(error);
        }
    }

    fn temp_sqlite_db_path(prefix: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!("{prefix}-{}.db", rand::random::<u64>()))
    }

    fn cleanup_sqlite_db(path: &Path) {
        let _ = fs::remove_file(path);
        let wal = Path::new(&format!("{}-wal", path.to_string_lossy())).to_path_buf();
        let shm = Path::new(&format!("{}-shm", path.to_string_lossy())).to_path_buf();
        let _ = fs::remove_file(wal);
        let _ = fs::remove_file(shm);
    }

    fn seed_agent_task_runtime_snapshot(
        durability_db_path: &Path,
        task_id: &str,
        workspace_id: &str,
        updated_at: u64,
        snapshot: &Value,
    ) {
        let conn = Connection::open(durability_db_path).unwrap_or_else(|error| {
            panic!(
                "open durability sqlite `{}` failed: {error}",
                durability_db_path.display()
            )
        });
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS agent_task_runtime_snapshots (
                task_id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                updated_at INTEGER NOT NULL,
                checkpoint_id TEXT NOT NULL,
                payload TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_agent_task_runtime_snapshots_updated
                ON agent_task_runtime_snapshots(updated_at DESC);
            ",
        )
        .expect("create durability sqlite schema");
        conn.execute(
            "
            INSERT OR REPLACE INTO agent_task_runtime_snapshots (
                task_id,
                workspace_id,
                updated_at,
                checkpoint_id,
                payload
            ) VALUES (?1, ?2, ?3, ?4, ?5)
            ",
            params![
                task_id,
                workspace_id,
                updated_at as i64,
                "checkpoint-seed",
                snapshot.to_string()
            ],
        )
        .expect("insert durability snapshot seed row");
    }

    fn mock_agent_task_runtime(task_id: &str, status: AgentTaskStatus) -> AgentTaskRuntime {
        let now = now_ms();
        AgentTaskRuntime {
            summary: AgentTaskSummary {
                task_id: task_id.to_string(),
                workspace_id: "workspace-1".to_string(),
                thread_id: None,
                request_id: None,
                title: None,
                task_source: None,
                validation_preset_id: None,
                status: status.as_str().to_string(),
                access_mode: "workspace-write".to_string(),
                execution_profile_id: None,
                review_profile_id: None,
                agent_profile: "code".to_string(),
                provider: None,
                model_id: None,
                reason_effort: None,
                routed_provider: None,
                routed_model_id: None,
                routed_pool: None,
                routed_source: None,
                current_step: None,
                created_at: now,
                updated_at: now,
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
                context_boundary: None,
                context_projection: None,
                compaction_summary: None,
                steps: Vec::new(),
            },
            steps_input: Vec::new(),
            interrupt_requested: false,
            checkpoint_id: None,
            review_actionability: None,
            execution_graph: None,
            takeover_bundle: None,
            recovered: false,
            last_tool_signature: None,
            consecutive_tool_signature_count: 0,
            interrupt_waiter: Arc::new(Notify::new()),
            approval_waiter: Arc::new(Notify::new()),
        }
    }

    #[test]
    fn ensure_agent_task_capacity_evicts_oldest_terminal_task() {
        let mut store = AgentTaskStore::default();
        store.order.push_back("task-1".to_string());
        store.order.push_back("task-2".to_string());
        store.order.push_back("task-3".to_string());
        store.tasks.insert(
            "task-1".to_string(),
            mock_agent_task_runtime("task-1", AgentTaskStatus::Running),
        );
        store.tasks.insert(
            "task-2".to_string(),
            mock_agent_task_runtime("task-2", AgentTaskStatus::Completed),
        );
        store.tasks.insert(
            "task-3".to_string(),
            mock_agent_task_runtime("task-3", AgentTaskStatus::Queued),
        );

        assert!(ensure_agent_task_capacity(&mut store, 3));
        assert_eq!(store.order.len(), 2);
        assert_eq!(
            store.order.iter().cloned().collect::<Vec<_>>(),
            vec!["task-1".to_string(), "task-3".to_string()]
        );
        assert!(store.tasks.contains_key("task-1"));
        assert!(!store.tasks.contains_key("task-2"));
        assert!(store.tasks.contains_key("task-3"));
    }

    #[test]
    fn ensure_agent_task_capacity_rejects_when_only_active_tasks_exist() {
        let mut store = AgentTaskStore::default();
        store.order.push_back("task-1".to_string());
        store.order.push_back("task-2".to_string());
        store.order.push_back("task-3".to_string());
        store.tasks.insert(
            "task-1".to_string(),
            mock_agent_task_runtime("task-1", AgentTaskStatus::Queued),
        );
        store.tasks.insert(
            "task-2".to_string(),
            mock_agent_task_runtime("task-2", AgentTaskStatus::Running),
        );
        store.tasks.insert(
            "task-3".to_string(),
            mock_agent_task_runtime("task-3", AgentTaskStatus::AwaitingApproval),
        );

        assert!(!ensure_agent_task_capacity(&mut store, 3));
        assert_eq!(store.order.len(), 3);
        assert!(store.tasks.contains_key("task-1"));
        assert!(store.tasks.contains_key("task-2"));
        assert!(store.tasks.contains_key("task-3"));
    }

    #[test]
    fn derive_openai_compat_base_url_from_responses_endpoint_strips_terminal_path() {
        let derived = derive_openai_compat_base_url_from_responses_endpoint(
            "https://api.openai.com/v1/responses",
        );
        assert_eq!(derived.as_deref(), Some("https://api.openai.com/v1"));
    }

    #[test]
    fn derive_openai_compat_base_url_from_responses_endpoint_ignores_query_and_fragment() {
        let derived = derive_openai_compat_base_url_from_responses_endpoint(
            "https://proxy.example.dev/v1/responses?source=web#anchor",
        );
        assert_eq!(derived.as_deref(), Some("https://proxy.example.dev/v1"));
    }

    #[test]
    fn should_fallback_from_responses_to_chat_completions_accepts_scope_errors() {
        assert!(should_fallback_from_responses_to_chat_completions(
            "Missing scopes: api.responses.write"
        ));
        assert!(should_fallback_from_responses_to_chat_completions(
            "Forbidden: insufficient permissions. Missing scopes: responses.write."
        ));
    }

    #[test]
    fn should_fallback_from_responses_to_chat_completions_rejects_non_scope_errors() {
        assert!(!should_fallback_from_responses_to_chat_completions(
            "429 rate_limited: try again later"
        ));
        assert!(!should_fallback_from_responses_to_chat_completions(
            "Forbidden: no organization access"
        ));
    }

    #[test]
    fn should_route_oauth_via_chatgpt_codex_backend_detects_chatgpt_tokens() {
        assert!(should_route_oauth_via_chatgpt_codex_backend(
            Some("access_token"),
            None
        ));
        assert!(should_route_oauth_via_chatgpt_codex_backend(
            Some("access_token_fallback"),
            None
        ));
        assert!(should_route_oauth_via_chatgpt_codex_backend(
            None,
            Some("chatgpt")
        ));
        assert!(!should_route_oauth_via_chatgpt_codex_backend(
            Some("openai_api_key"),
            None
        ));
    }

    #[test]
    fn build_rate_limits_snapshot_from_chatgpt_usage_payload_maps_windows() {
        let payload = json!({
            "plan_type": "free",
            "rate_limit": {
                "primary_window": {
                    "used_percent": 12.5,
                    "limit_window_seconds": 7200,
                    "reset_after_seconds": 1800
                },
                "secondary_window": {
                    "used_percent": 3,
                    "limit_window_seconds": 86400,
                    "reset_at": 1_900_000_000
                }
            },
            "credits": {
                "has_credits": false,
                "unlimited": true,
                "balance": "n/a"
            }
        });

        let snapshot = build_rate_limits_snapshot_from_chatgpt_usage_payload(&payload, 1_000_000)
            .expect("expected normalized rate limit snapshot");
        assert_eq!(snapshot["planType"], Value::String("free".to_string()));
        assert_eq!(snapshot["primary"]["usedPercent"], json!(12.5));
        assert_eq!(snapshot["primary"]["windowDurationMins"], json!(120.0));
        assert_eq!(snapshot["primary"]["resetsAt"], json!(2_800_000u64));
        assert_eq!(snapshot["secondary"]["usedPercent"], json!(3.0));
        assert_eq!(snapshot["secondary"]["windowDurationMins"], json!(1_440.0));
        assert_eq!(
            snapshot["secondary"]["resetsAt"],
            json!(1_900_000_000_000u64)
        );
        assert_eq!(snapshot["credits"]["hasCredits"], Value::Bool(false));
        assert_eq!(snapshot["credits"]["unlimited"], Value::Bool(true));
        assert_eq!(
            snapshot["credits"]["balance"],
            Value::String("n/a".to_string())
        );
    }

    #[test]
    fn build_rate_limits_snapshot_from_chatgpt_usage_payload_returns_none_without_rate_data() {
        let payload = json!({
            "user_id": "user-123",
            "promo": {}
        });
        assert!(build_rate_limits_snapshot_from_chatgpt_usage_payload(&payload, 1_000).is_none());
    }

    #[test]
    fn turn_event_replay_buffer_enforces_payload_byte_budget() {
        let mut buffer = TurnEventReplayBuffer::new();
        let frame_payload_len = buffer.max_frame_bytes.saturating_sub(8).max(1024);
        let payload = Arc::<str>::from("x".repeat(frame_payload_len));
        let mut latest_id = 0u64;
        for index in 0..32u64 {
            latest_id = index + 1;
            let _ = buffer.push(TurnEventFrame {
                id: latest_id,
                payload_json: payload.clone(),
            });
        }

        assert!(buffer.total_payload_bytes <= TURN_EVENTS_REPLAY_MAX_BYTES);
        assert!(buffer.frames.len() <= TURN_EVENTS_REPLAY_BUFFER);
        assert_eq!(buffer.frames.back().map(|frame| frame.id), Some(latest_id));
    }

    #[test]
    fn turn_event_replay_buffer_drops_oversized_frame() {
        let mut buffer = TurnEventReplayBuffer::new();
        let huge = Arc::<str>::from("x".repeat(buffer.max_frame_bytes + 1024));

        let latest = TurnEventFrame {
            id: 1,
            payload_json: huge.clone(),
        };
        assert!(!buffer.push(latest.clone()));
        assert_eq!(buffer.frames.len(), 0);
        assert_eq!(buffer.total_payload_bytes, 0);
    }

    #[test]
    fn turn_event_replay_buffer_transient_frames_do_not_enter_replay_store() {
        let mut buffer = TurnEventReplayBuffer::new();

        let first = TurnEventFrame {
            id: 1,
            payload_json: Arc::<str>::from("persistent-1"),
        };
        buffer.push(first.clone());
        let second = TurnEventFrame {
            id: 3,
            payload_json: Arc::<str>::from("persistent-2"),
        };
        buffer.push(second.clone());

        assert_eq!(first.id, 1);
        assert_eq!(second.id, 3);
        assert_eq!(buffer.frames.len(), 2);
        assert_eq!(buffer.frames.front().map(|frame| frame.id), Some(1));
        assert_eq!(buffer.frames.back().map(|frame| frame.id), Some(3));
        assert_eq!(
            buffer.total_payload_bytes,
            "persistent-1".len() + "persistent-2".len()
        );
    }

    #[test]
    fn prune_compat_model_catalog_cache_drops_expired_entries() {
        let now = Instant::now();
        let mut cache = HashMap::from([
            (
                "expired".to_string(),
                CachedCompatModelCatalog {
                    catalog: CompatModelCatalog::default(),
                    fetched_at: now - Duration::from_secs(20),
                },
            ),
            (
                "fresh".to_string(),
                CachedCompatModelCatalog {
                    catalog: CompatModelCatalog::default(),
                    fetched_at: now - Duration::from_secs(1),
                },
            ),
        ]);

        prune_compat_model_catalog_cache(&mut cache, now, Duration::from_secs(5), 8);

        assert!(!cache.contains_key("expired"));
        assert!(cache.contains_key("fresh"));
    }

    #[test]
    fn prune_compat_model_catalog_cache_evicts_oldest_when_full() {
        let now = Instant::now();
        let mut cache = HashMap::from([
            (
                "oldest".to_string(),
                CachedCompatModelCatalog {
                    catalog: CompatModelCatalog::default(),
                    fetched_at: now - Duration::from_secs(5),
                },
            ),
            (
                "newer-a".to_string(),
                CachedCompatModelCatalog {
                    catalog: CompatModelCatalog::default(),
                    fetched_at: now - Duration::from_secs(3),
                },
            ),
            (
                "newer-b".to_string(),
                CachedCompatModelCatalog {
                    catalog: CompatModelCatalog::default(),
                    fetched_at: now - Duration::from_secs(1),
                },
            ),
        ]);

        prune_compat_model_catalog_cache(&mut cache, now, Duration::from_secs(30), 3);

        assert!(!cache.contains_key("oldest"));
        assert!(cache.contains_key("newer-a"));
        assert!(cache.contains_key("newer-b"));
        assert_eq!(cache.len(), 2);
    }

    #[test]
    fn prune_stale_agent_workspace_locks_removes_unreferenced_entries() {
        let stale_lock = Arc::new(AsyncMutex::new(()));
        let active_lock = Arc::new(AsyncMutex::new(()));
        let _active_reference = active_lock.clone();
        let mut locks = HashMap::from([
            ("stale-workspace".to_string(), stale_lock),
            ("active-workspace".to_string(), active_lock),
        ]);

        prune_stale_agent_workspace_locks(&mut locks);

        assert!(!locks.contains_key("stale-workspace"));
        assert!(locks.contains_key("active-workspace"));
    }

    #[test]
    fn prune_stale_compat_model_catalog_refresh_locks_removes_unreferenced_entries() {
        let stale_lock = Arc::new(AsyncMutex::new(()));
        let active_lock = Arc::new(AsyncMutex::new(()));
        let _active_reference = active_lock.clone();
        let mut locks = HashMap::from([
            (
                CompatModelCatalogCacheKey {
                    base_url: "https://stale.example/v1".to_string(),
                    api_key_fingerprint: 1,
                },
                stale_lock,
            ),
            (
                CompatModelCatalogCacheKey {
                    base_url: "https://active.example/v1".to_string(),
                    api_key_fingerprint: 2,
                },
                active_lock,
            ),
        ]);

        prune_stale_compat_model_catalog_refresh_locks(&mut locks);

        assert!(!locks.contains_key(&CompatModelCatalogCacheKey {
            base_url: "https://stale.example/v1".to_string(),
            api_key_fingerprint: 1,
        }));
        assert!(locks.contains_key(&CompatModelCatalogCacheKey {
            base_url: "https://active.example/v1".to_string(),
            api_key_fingerprint: 2,
        }));
    }

    #[test]
    fn parse_provider_extension_seeds_parses_valid_payload() {
        let parsed = parse_provider_extension_seeds(Some(
            r#"[{
                "providerId":"deepseek",
                "displayName":"DeepSeek",
                "pool":"deepseek",
                "defaultModelId":"deepseek-chat",
                "compatBaseUrl":"https://api.deepseek.com/v1",
                "aliases":["ds"],
                "apiKey":"deepseek-key"
            }]"#,
        ))
        .expect("parse extension payload");

        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].provider_id, "deepseek");
        assert_eq!(parsed[0].pool, "deepseek");
        assert!(parsed[0].aliases.contains(&"deepseek".to_string()));
        assert!(parsed[0].aliases.contains(&"ds".to_string()));
        assert_eq!(parsed[0].api_key.as_deref(), Some("deepseek-key"));
    }

    #[test]
    fn parse_provider_extension_seeds_rejects_core_alias_collisions() {
        let result = parse_provider_extension_seeds(Some(
            r#"[{
                "providerId":"openai",
                "displayName":"Invalid",
                "pool":"invalid",
                "defaultModelId":"invalid-model",
                "compatBaseUrl":"https://example.com/v1"
            }]"#,
        ));
        assert!(result.is_err());
    }

    #[test]
    fn parse_provider_extension_seeds_rejects_extension_alias_collisions() {
        let result = parse_provider_extension_seeds(Some(
            r#"[{
                "providerId":"deepseek",
                "displayName":"DeepSeek",
                "pool":"deepseek",
                "defaultModelId":"deepseek-chat",
                "compatBaseUrl":"https://api.deepseek.com/v1",
                "aliases":["ds"],
                "apiKey":"deepseek-key"
            },{
                "providerId":"moonshot",
                "displayName":"Moonshot",
                "pool":"moonshot",
                "defaultModelId":"moonshot-v1-8k",
                "compatBaseUrl":"https://api.moonshot.ai/v1",
                "aliases":["ds"],
                "apiKey":"moonshot-key"
            }]"#,
        ));
        assert!(result.is_err());
        let error = result.expect_err("should reject duplicated alias");
        assert!(error.contains("collides"));
    }

    async fn spawn_openai_compat_mock_server_with_options(
        model_ids: Vec<&str>,
        expected_api_key: Option<&str>,
        models_request_counter: Option<Arc<AtomicUsize>>,
        models_response_delay: Option<Duration>,
    ) -> (String, tokio::task::JoinHandle<()>) {
        let model_entries = model_ids
            .into_iter()
            .map(|id| json!({ "id": id, "object": "model" }))
            .collect::<Vec<_>>();
        let expected_api_key = expected_api_key.map(str::to_string);
        let models_request_counter = models_request_counter.clone();
        let app = Router::new()
            .route(
                "/v1/models",
                get({
                    let model_entries = model_entries.clone();
                    let expected_api_key = expected_api_key.clone();
                    let models_request_counter = models_request_counter.clone();
                    let models_response_delay = models_response_delay;
                    move |headers: axum::http::HeaderMap| {
                        let model_entries = model_entries.clone();
                        let expected_api_key = expected_api_key.clone();
                        let models_request_counter = models_request_counter.clone();
                        let models_response_delay = models_response_delay;
                        async move {
                            if let Some(counter) = models_request_counter.as_ref() {
                                counter.fetch_add(1, AtomicOrdering::Relaxed);
                            }
                            if let Some(delay) = models_response_delay {
                                tokio::time::sleep(delay).await;
                            }
                            if let Some(expected) = expected_api_key.as_deref() {
                                let expected_header = format!("Bearer {expected}");
                                let actual_header = headers
                                    .get("authorization")
                                    .and_then(|value| value.to_str().ok());
                                if actual_header != Some(expected_header.as_str()) {
                                    return (
                                        StatusCode::UNAUTHORIZED,
                                        Json(json!({
                                            "error": { "message": "Unauthorized for models." }
                                        })),
                                    );
                                }
                            }
                            (
                                StatusCode::OK,
                                Json(json!({ "object": "list", "data": model_entries })),
                            )
                        }
                    }
                }),
            )
            .route(
                "/v1/chat/completions",
                post({
                    let expected_api_key = expected_api_key.clone();
                    move |headers: axum::http::HeaderMap, Json(payload): Json<Value>| {
                        let expected_api_key = expected_api_key.clone();
                        async move {
                            if let Some(expected) = expected_api_key.as_deref() {
                                let expected_header = format!("Bearer {expected}");
                                let actual_header = headers
                                    .get("authorization")
                                    .and_then(|value| value.to_str().ok());
                                if actual_header != Some(expected_header.as_str()) {
                                    return (
                                        StatusCode::UNAUTHORIZED,
                                        Json(json!({
                                            "error": { "message": "Unauthorized for chat completions." }
                                        })),
                                    );
                                }
                            }
                            let model_id = payload
                                .get("model")
                                .and_then(Value::as_str)
                                .unwrap_or("unknown-model");
                            (
                                StatusCode::OK,
                                Json(json!({
                                    "id": "chatcmpl-test",
                                    "object": "chat.completion",
                                    "model": model_id,
                                    "choices": [{
                                        "index": 0,
                                        "message": {
                                            "role": "assistant",
                                            "content": format!("ok:{model_id}")
                                        }
                                    }]
                                })),
                            )
                        }
                    }
                }),
            );

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind mock openai-compat listener");
        let address = listener
            .local_addr()
            .expect("resolve mock openai-compat listener address");
        let handle = tokio::spawn(async move {
            let _ = axum::serve(listener, app).await;
        });

        (format!("http://{address}/v1"), handle)
    }

    async fn spawn_openai_compat_mock_server(
        model_ids: Vec<&str>,
        expected_api_key: Option<&str>,
    ) -> (String, tokio::task::JoinHandle<()>) {
        spawn_openai_compat_mock_server_with_options(model_ids, expected_api_key, None, None).await
    }

    async fn spawn_codex_oauth_refresh_mock_server(
        expected_refresh_token: &str,
        access_token: &str,
        refreshed_refresh_token: Option<&str>,
    ) -> (String, Arc<AtomicUsize>, tokio::task::JoinHandle<()>) {
        let request_count = Arc::new(AtomicUsize::new(0));
        let request_count_for_handler = request_count.clone();
        let expected_refresh_token = expected_refresh_token.to_string();
        let access_token = access_token.to_string();
        let refreshed_refresh_token = refreshed_refresh_token.map(ToOwned::to_owned);

        let app = Router::new().route(
            "/oauth/token",
            post(move |Json(payload): Json<Value>| {
                let request_count = request_count_for_handler.clone();
                let expected_refresh_token = expected_refresh_token.clone();
                let access_token = access_token.clone();
                let refreshed_refresh_token = refreshed_refresh_token.clone();
                async move {
                    request_count.fetch_add(1, AtomicOrdering::SeqCst);
                    assert_eq!(
                        payload["grant_type"],
                        Value::String("refresh_token".to_string())
                    );
                    assert_eq!(
                        payload["client_id"],
                        Value::String(CODEX_OAUTH_CLIENT_ID.to_string())
                    );
                    assert_eq!(
                        payload["refresh_token"],
                        Value::String(expected_refresh_token)
                    );

                    let mut response = serde_json::Map::new();
                    response.insert("access_token".to_string(), Value::String(access_token));
                    if let Some(refreshed_refresh_token) = refreshed_refresh_token {
                        response.insert(
                            "refresh_token".to_string(),
                            Value::String(refreshed_refresh_token),
                        );
                    }
                    Json(Value::Object(response))
                }
            }),
        );

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind mock codex oauth listener");
        let address = listener
            .local_addr()
            .expect("resolve mock codex oauth listener address");
        let handle = tokio::spawn(async move {
            let _ = axum::serve(listener, app).await;
        });

        (format!("http://{address}"), request_count, handle)
    }

    async fn spawn_openai_compat_mock_server_with_counter(
        model_ids: Vec<&str>,
        expected_api_key: Option<&str>,
        models_response_delay: Option<Duration>,
    ) -> (String, Arc<AtomicUsize>, tokio::task::JoinHandle<()>) {
        let counter = Arc::new(AtomicUsize::new(0));
        let (base_url, handle) = spawn_openai_compat_mock_server_with_options(
            model_ids,
            expected_api_key,
            Some(counter.clone()),
            models_response_delay,
        )
        .await;
        (base_url, counter, handle)
    }

    async fn spawn_openai_compat_runtime_plan_mock_server(
        expected_api_key: Option<&str>,
    ) -> (String, tokio::task::JoinHandle<()>) {
        spawn_openai_compat_runtime_plan_mock_server_with_delays(expected_api_key, None, None).await
    }

    async fn spawn_openai_compat_runtime_plan_mock_server_with_counter(
        expected_api_key: Option<&str>,
    ) -> (String, Arc<AtomicUsize>, tokio::task::JoinHandle<()>) {
        let counter = Arc::new(AtomicUsize::new(0));
        let (base_url, handle) = spawn_openai_compat_runtime_plan_mock_server_with_delays_and_counter(
            expected_api_key,
            None,
            None,
            Some(counter.clone()),
        )
        .await;
        (base_url, counter, handle)
    }

    async fn spawn_openai_compat_runtime_plan_mock_server_with_delays(
        expected_api_key: Option<&str>,
        planner_response_delay: Option<Duration>,
        final_response_delay: Option<Duration>,
    ) -> (String, tokio::task::JoinHandle<()>) {
        spawn_openai_compat_runtime_plan_mock_server_with_delays_and_counter(
            expected_api_key,
            planner_response_delay,
            final_response_delay,
            None,
        )
        .await
    }

    async fn spawn_openai_compat_runtime_plan_mock_server_with_delays_and_counter(
        expected_api_key: Option<&str>,
        planner_response_delay: Option<Duration>,
        final_response_delay: Option<Duration>,
        chat_request_counter: Option<Arc<AtomicUsize>>,
    ) -> (String, tokio::task::JoinHandle<()>) {
        let expected_api_key = expected_api_key.map(str::to_string);
        let app = Router::new()
            .route(
                "/v1/models",
                get({
                    let expected_api_key = expected_api_key.clone();
                    move |headers: axum::http::HeaderMap| {
                        let expected_api_key = expected_api_key.clone();
                        async move {
                            if let Some(expected) = expected_api_key.as_deref() {
                                let expected_header = format!("Bearer {expected}");
                                let actual_header = headers
                                    .get("authorization")
                                    .and_then(|value| value.to_str().ok());
                                if actual_header != Some(expected_header.as_str()) {
                                    return (
                                        StatusCode::UNAUTHORIZED,
                                        Json(json!({
                                            "error": { "message": "Unauthorized for models." }
                                        })),
                                    );
                                }
                            }
                            (
                                StatusCode::OK,
                                Json(json!({
                                    "object":"list",
                                    "data":[{"id":"gpt-5.3-codex","object":"model"}]
                                })),
                            )
                        }
                    }
                }),
            )
            .route(
                "/v1/chat/completions",
                post({
                    let expected_api_key = expected_api_key.clone();
                    let planner_response_delay = planner_response_delay;
                    let final_response_delay = final_response_delay;
                    let chat_request_counter = chat_request_counter.clone();
                    move |headers: axum::http::HeaderMap, Json(payload): Json<Value>| {
                        let expected_api_key = expected_api_key.clone();
                        let planner_response_delay = planner_response_delay;
                        let final_response_delay = final_response_delay;
                        let chat_request_counter = chat_request_counter.clone();
                        async move {
                            if let Some(counter) = chat_request_counter.as_ref() {
                                counter.fetch_add(1, AtomicOrdering::Relaxed);
                            }
                            if let Some(expected) = expected_api_key.as_deref() {
                                let expected_header = format!("Bearer {expected}");
                                let actual_header = headers
                                    .get("authorization")
                                    .and_then(|value| value.to_str().ok());
                                if actual_header != Some(expected_header.as_str()) {
                                    return (
                                        StatusCode::UNAUTHORIZED,
                                        Json(json!({
                                            "error": { "message": "Unauthorized for chat completions." }
                                        })),
                                    );
                                }
                            }

                            let content = payload
                                .get("messages")
                                .and_then(Value::as_array)
                                .and_then(|messages| messages.first())
                                .and_then(|message| message.get("content"))
                                .and_then(Value::as_str)
                                .unwrap_or_default();
                            let model_id = payload
                                .get("model")
                                .and_then(Value::as_str)
                                .unwrap_or("unknown-model");
                            let (assistant_content, response_model_id) =
                                if content.contains("Return STRICT JSON only (no markdown).") {
                                    if let Some(delay) = planner_response_delay {
                                        tokio::time::sleep(delay).await;
                                    }
                                    if content.contains("force runtime step failure") {
                                        (
                                            json!({
                                                "plan": ["run failing command"],
                                                "steps": [
                                                    {
                                                        "kind": "bash",
                                                        "command": "exit 7"
                                                    }
                                                ]
                                            })
                                            .to_string(),
                                            model_id.to_string(),
                                        )
                                    } else {
                                        (
                                            json!({
                                                "plan": [
                                                    "create runtime plan proof file",
                                                    "list workspace files"
                                                ],
                                                "steps": [
                                                    {
                                                        "kind": "write",
                                                        "path": "runtime-plan-events.txt",
                                                        "content": "runtime-plan-content"
                                                    },
                                                    {
                                                        "kind": "bash",
                                                        "command": "echo runtime-plan-proof"
                                                    }
                                                ]
                                            })
                                            .to_string(),
                                            model_id.to_string(),
                                        )
                                    }
                                } else if content.contains("Runtime execution results JSON:") {
                                    if let Some(delay) = final_response_delay {
                                        tokio::time::sleep(delay).await;
                                    }
                                    (
                                        "runtime plan executed".to_string(),
                                        "gpt-5.4-2026-03-01".to_string(),
                                    )
                                } else {
                                    (
                                        "unexpected prompt branch".to_string(),
                                        model_id.to_string(),
                                    )
                                };
                            (
                                StatusCode::OK,
                                Json(json!({
                                    "id": "chatcmpl-runtime-plan",
                                    "object": "chat.completion",
                                    "model": response_model_id,
                                    "choices": [{
                                        "index": 0,
                                        "message": {
                                            "role": "assistant",
                                            "content": assistant_content
                                        }
                                    }]
                                })),
                            )
                        }
                    }
                }),
            );

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind runtime-plan mock listener");
        let address = listener
            .local_addr()
            .expect("resolve runtime-plan mock listener address");
        let handle = tokio::spawn(async move {
            let _ = axum::serve(listener, app).await;
        });

        (format!("http://{address}/v1"), handle)
    }

    async fn spawn_openai_compat_models_error_server(
        expected_api_key: Option<&str>,
    ) -> (String, Arc<AtomicUsize>, tokio::task::JoinHandle<()>) {
        let models_counter = Arc::new(AtomicUsize::new(0));
        let expected_api_key = expected_api_key.map(str::to_string);
        let app = Router::new().route(
            "/v1/models",
            get({
                let expected_api_key = expected_api_key.clone();
                let models_counter = models_counter.clone();
                move |headers: axum::http::HeaderMap| {
                    let expected_api_key = expected_api_key.clone();
                    let models_counter = models_counter.clone();
                    async move {
                        models_counter.fetch_add(1, AtomicOrdering::Relaxed);
                        if let Some(expected) = expected_api_key.as_deref() {
                            let expected_header = format!("Bearer {expected}");
                            let actual_header = headers
                                .get("authorization")
                                .and_then(|value| value.to_str().ok());
                            if actual_header != Some(expected_header.as_str()) {
                                return (
                                    StatusCode::UNAUTHORIZED,
                                    Json(json!({
                                        "error": { "message": "Unauthorized for models." }
                                    })),
                                );
                            }
                        }
                        (
                            StatusCode::BAD_GATEWAY,
                            Json(json!({
                                "error": { "message": "upstream models unavailable" }
                            })),
                        )
                    }
                }
            }),
        );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind mock openai-compat error listener");
        let address = listener
            .local_addr()
            .expect("resolve mock openai-compat error listener address");
        let handle = tokio::spawn(async move {
            let _ = axum::serve(listener, app).await;
        });
        (format!("http://{address}/v1"), models_counter, handle)
    }

    async fn spawn_openai_scope_fallback_mock_server(
        expected_api_key: Option<&str>,
    ) -> (
        String,
        Arc<AtomicUsize>,
        Arc<AtomicUsize>,
        tokio::task::JoinHandle<()>,
    ) {
        let responses_counter = Arc::new(AtomicUsize::new(0));
        let chat_counter = Arc::new(AtomicUsize::new(0));
        let expected_api_key = expected_api_key.map(str::to_string);
        let app = Router::new()
            .route(
                "/v1/responses",
                post({
                    let responses_counter = responses_counter.clone();
                    let expected_api_key = expected_api_key.clone();
                    move |headers: axum::http::HeaderMap| {
                        let responses_counter = responses_counter.clone();
                        let expected_api_key = expected_api_key.clone();
                        async move {
                            responses_counter.fetch_add(1, AtomicOrdering::Relaxed);
                            if let Some(expected) = expected_api_key.as_deref() {
                                let expected_header = format!("Bearer {expected}");
                                let actual_header = headers
                                    .get("authorization")
                                    .and_then(|value| value.to_str().ok());
                                if actual_header != Some(expected_header.as_str()) {
                                    return (
                                        StatusCode::UNAUTHORIZED,
                                        Json(json!({
                                            "error": { "message": "Unauthorized for responses." }
                                        })),
                                    );
                                }
                            }
                            (
                                StatusCode::FORBIDDEN,
                                Json(json!({
                                    "error": {
                                        "message": "You have insufficient permissions for this operation. Missing scopes: api.responses.write."
                                    }
                                })),
                            )
                        }
                    }
                }),
            )
            .route(
                "/v1/chat/completions",
                post({
                    let chat_counter = chat_counter.clone();
                    let expected_api_key = expected_api_key.clone();
                    move |headers: axum::http::HeaderMap, Json(payload): Json<Value>| {
                        let chat_counter = chat_counter.clone();
                        let expected_api_key = expected_api_key.clone();
                        async move {
                            chat_counter.fetch_add(1, AtomicOrdering::Relaxed);
                            if let Some(expected) = expected_api_key.as_deref() {
                                let expected_header = format!("Bearer {expected}");
                                let actual_header = headers
                                    .get("authorization")
                                    .and_then(|value| value.to_str().ok());
                                if actual_header != Some(expected_header.as_str()) {
                                    return (
                                        StatusCode::UNAUTHORIZED,
                                        Json(json!({
                                            "error": { "message": "Unauthorized for chat completions." }
                                        })),
                                    );
                                }
                            }
                            let model_id = payload
                                .get("model")
                                .and_then(Value::as_str)
                                .unwrap_or("unknown-model");
                            (
                                StatusCode::OK,
                                Json(json!({
                                    "id": "chatcmpl-fallback",
                                    "object": "chat.completion",
                                    "choices": [{
                                        "index": 0,
                                        "message": {
                                            "role": "assistant",
                                            "content": format!("ok:{model_id}")
                                        }
                                    }]
                                })),
                            )
                        }
                    }
                }),
            );

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind scope fallback mock listener");
        let address = listener
            .local_addr()
            .expect("resolve scope fallback mock listener address");
        let handle = tokio::spawn(async move {
            let _ = axum::serve(listener, app).await;
        });
        (
            format!("http://{address}/v1"),
            responses_counter,
            chat_counter,
            handle,
        )
    }

    async fn spawn_openai_scope_fallback_reasoning_sensitive_mock_server(
        expected_api_key: Option<&str>,
    ) -> (
        String,
        Arc<AtomicUsize>,
        Arc<AtomicUsize>,
        tokio::task::JoinHandle<()>,
    ) {
        let responses_counter = Arc::new(AtomicUsize::new(0));
        let chat_counter = Arc::new(AtomicUsize::new(0));
        let expected_api_key = expected_api_key.map(str::to_string);
        let app = Router::new()
            .route(
                "/v1/responses",
                post({
                    let responses_counter = responses_counter.clone();
                    let expected_api_key = expected_api_key.clone();
                    move |headers: axum::http::HeaderMap| {
                        let responses_counter = responses_counter.clone();
                        let expected_api_key = expected_api_key.clone();
                        async move {
                            responses_counter.fetch_add(1, AtomicOrdering::Relaxed);
                            if let Some(expected) = expected_api_key.as_deref() {
                                let expected_header = format!("Bearer {expected}");
                                let actual_header = headers
                                    .get("authorization")
                                    .and_then(|value| value.to_str().ok());
                                if actual_header != Some(expected_header.as_str()) {
                                    return (
                                        StatusCode::UNAUTHORIZED,
                                        Json(json!({
                                            "error": { "message": "Unauthorized for responses." }
                                        })),
                                    );
                                }
                            }
                            (
                                StatusCode::FORBIDDEN,
                                Json(json!({
                                    "error": {
                                        "message": "You have insufficient permissions for this operation. Missing scopes: api.responses.write."
                                    }
                                })),
                            )
                        }
                    }
                }),
            )
            .route(
                "/v1/chat/completions",
                post({
                    let chat_counter = chat_counter.clone();
                    let expected_api_key = expected_api_key.clone();
                    move |headers: axum::http::HeaderMap, Json(payload): Json<Value>| {
                        let chat_counter = chat_counter.clone();
                        let expected_api_key = expected_api_key.clone();
                        async move {
                            chat_counter.fetch_add(1, AtomicOrdering::Relaxed);
                            if let Some(expected) = expected_api_key.as_deref() {
                                let expected_header = format!("Bearer {expected}");
                                let actual_header = headers
                                    .get("authorization")
                                    .and_then(|value| value.to_str().ok());
                                if actual_header != Some(expected_header.as_str()) {
                                    return (
                                        StatusCode::UNAUTHORIZED,
                                        Json(json!({
                                            "error": { "message": "Unauthorized for chat completions." }
                                        })),
                                    );
                                }
                            }
                            if payload.get("reasoning").is_some() {
                                return (
                                    StatusCode::INTERNAL_SERVER_ERROR,
                                    Json(json!({
                                        "error": { "message": "Internal server error" }
                                    })),
                                );
                            }
                            let model_id = payload
                                .get("model")
                                .and_then(Value::as_str)
                                .unwrap_or("unknown-model");
                            (
                                StatusCode::OK,
                                Json(json!({
                                    "id": "chatcmpl-fallback-no-reasoning",
                                    "object": "chat.completion",
                                    "choices": [{
                                        "index": 0,
                                        "message": {
                                            "role": "assistant",
                                            "content": format!("ok:{model_id}")
                                        }
                                    }]
                                })),
                            )
                        }
                    }
                }),
            );

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind reasoning-sensitive scope fallback mock listener");
        let address = listener
            .local_addr()
            .expect("resolve reasoning-sensitive scope fallback mock listener address");
        let handle = tokio::spawn(async move {
            let _ = axum::serve(listener, app).await;
        });
        (
            format!("http://{address}/v1"),
            responses_counter,
            chat_counter,
            handle,
        )
    }

    async fn spawn_openai_scope_fallback_dual_credential_mock_server(
        primary_api_key: &str,
        alternate_api_key: &str,
    ) -> (
        String,
        Arc<AtomicUsize>,
        Arc<AtomicUsize>,
        Arc<AtomicUsize>,
        tokio::task::JoinHandle<()>,
    ) {
        let primary_responses_counter = Arc::new(AtomicUsize::new(0));
        let alternate_responses_counter = Arc::new(AtomicUsize::new(0));
        let chat_counter = Arc::new(AtomicUsize::new(0));
        let primary_api_key = primary_api_key.to_string();
        let alternate_api_key = alternate_api_key.to_string();
        let app = Router::new()
            .route(
                "/v1/responses",
                post({
                    let primary_responses_counter = primary_responses_counter.clone();
                    let alternate_responses_counter = alternate_responses_counter.clone();
                    let primary_api_key = primary_api_key.clone();
                    let alternate_api_key = alternate_api_key.clone();
                    move |headers: axum::http::HeaderMap, Json(payload): Json<Value>| {
                        let primary_responses_counter = primary_responses_counter.clone();
                        let alternate_responses_counter = alternate_responses_counter.clone();
                        let primary_api_key = primary_api_key.clone();
                        let alternate_api_key = alternate_api_key.clone();
                        async move {
                            let authorization = headers
                                .get("authorization")
                                .and_then(|value| value.to_str().ok())
                                .unwrap_or_default()
                                .to_string();
                            if authorization == format!("Bearer {primary_api_key}") {
                                primary_responses_counter.fetch_add(1, AtomicOrdering::Relaxed);
                                return (
                                    StatusCode::FORBIDDEN,
                                    Json(json!({
                                        "error": {
                                            "message": "You have insufficient permissions for this operation. Missing scopes: api.responses.write."
                                        }
                                    })),
                                );
                            }
                            if authorization == format!("Bearer {alternate_api_key}") {
                                alternate_responses_counter
                                    .fetch_add(1, AtomicOrdering::Relaxed);
                                let model_id = payload
                                    .get("model")
                                    .and_then(Value::as_str)
                                    .unwrap_or("unknown-model");
                                return (
                                    StatusCode::OK,
                                    Json(json!({
                                        "id": "resp-alt-success",
                                        "object": "response",
                                        "output_text": format!("ok:{model_id}:alternate")
                                    })),
                                );
                            }
                            (
                                StatusCode::UNAUTHORIZED,
                                Json(json!({
                                    "error": { "message": "Unauthorized for responses." }
                                })),
                            )
                        }
                    }
                }),
            )
            .route(
                "/v1/chat/completions",
                post({
                    let chat_counter = chat_counter.clone();
                    move || {
                        let chat_counter = chat_counter.clone();
                        async move {
                            chat_counter.fetch_add(1, AtomicOrdering::Relaxed);
                            (
                                StatusCode::INTERNAL_SERVER_ERROR,
                                Json(json!({
                                    "error": { "message": "Internal server error" }
                                })),
                            )
                        }
                    }
                }),
            );

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind dual credential fallback mock listener");
        let address = listener
            .local_addr()
            .expect("resolve dual credential fallback mock listener address");
        let handle = tokio::spawn(async move {
            let _ = axum::serve(listener, app).await;
        });
        (
            format!("http://{address}/v1"),
            primary_responses_counter,
            alternate_responses_counter,
            chat_counter,
            handle,
        )
    }

    async fn spawn_live_skills_network_mock_server_with_failures(
        failing_queries: Vec<String>,
    ) -> (String, tokio::task::JoinHandle<()>) {
        let app = Router::new().route(
            "/{query}",
            get(move |axum::extract::Path(query): axum::extract::Path<String>| {
                let failing_queries = failing_queries.clone();
                async move {
                    if !query.starts_with("http://")
                        && !query.starts_with("https://")
                        && failing_queries.iter().any(|candidate| query.contains(candidate))
                    {
                        return (
                            StatusCode::INTERNAL_SERVER_ERROR,
                            "mocked live-skills failure".to_string(),
                        );
                    }
                    let body = if query.starts_with("http://") || query.starts_with("https://") {
                        if query.contains("example.com/rust-async") {
                            "Rust async runtime deep page content published 2026-02-01"
                                .to_string()
                        } else if query.contains("tokio.rs/tokio/tutorial") {
                            "Tokio tutorial page content updated 2026-01-15".to_string()
                        } else {
                            format!("Fetched page content for {query}")
                        }
                    } else if query.contains("tokio.rs/tokio/tutorial") {
                        "Tokio tutorial page content updated 2026-01-15".to_string()
                    } else {
                        format!(
                            "- [Rust async runtime guide](https://example.com/rust-async) {query} architecture deep dive\n- [Tokio tutorial](https://tokio.rs/tokio/tutorial) tokio runtime patterns"
                        )
                    };
                    (StatusCode::OK, body)
                }
            }),
        );

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind live-skills mock listener");
        let address = listener
            .local_addr()
            .expect("resolve live-skills mock listener address");
        let handle = tokio::spawn(async move {
            let _ = axum::serve(listener, app).await;
        });

        (format!("http://{address}"), handle)
    }

    async fn spawn_live_skills_network_mock_server_with_delay(
        response_delay_ms: u64,
    ) -> (String, tokio::task::JoinHandle<()>) {
        let app = Router::new().route(
            "/{query}",
            get(move |axum::extract::Path(query): axum::extract::Path<String>| {
                async move {
                    tokio::time::sleep(Duration::from_millis(response_delay_ms)).await;
                    let body = if query.starts_with("http://") || query.starts_with("https://") {
                        if query.contains("example.com/rust-async") {
                            "Rust async runtime deep page content published 2026-02-01"
                                .to_string()
                        } else if query.contains("tokio.rs/tokio/tutorial") {
                            "Tokio tutorial page content updated 2026-01-15".to_string()
                        } else {
                            format!("Fetched page content for {query}")
                        }
                    } else {
                        format!(
                            "- [Rust async runtime guide](https://example.com/rust-async) {query} architecture deep dive\n- [Tokio tutorial](https://tokio.rs/tokio/tutorial) tokio runtime patterns"
                        )
                    };
                    (StatusCode::OK, body)
                }
            }),
        );

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind delayed live-skills mock listener");
        let address = listener
            .local_addr()
            .expect("resolve delayed live-skills mock listener address");
        let handle = tokio::spawn(async move {
            let _ = axum::serve(listener, app).await;
        });

        (format!("http://{address}"), handle)
    }

    async fn spawn_live_skills_network_mock_server() -> (String, tokio::task::JoinHandle<()>) {
        spawn_live_skills_network_mock_server_with_failures(Vec::new()).await
    }

    async fn spawn_runtime_service_server(
        config: ServiceConfig,
    ) -> (String, tokio::task::JoinHandle<()>) {
        let app = test_router_with_config(config);
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind runtime service listener");
        let address = listener
            .local_addr()
            .expect("resolve runtime service listener address");
        let handle = tokio::spawn(async move {
            let _ = axum::serve(listener, app).await;
        });
        (format!("http://{address}"), handle)
    }

    fn find_sse_frame_boundary(buffer: &str) -> Option<(usize, usize)> {
        if let Some(index) = buffer.find("\r\n\r\n") {
            return Some((index, 4));
        }
        buffer.find("\n\n").map(|index| (index, 2))
    }

    fn parse_sse_json_frame(frame: &str) -> Option<Value> {
        let data_lines = frame
            .lines()
            .filter_map(|line| line.strip_prefix("data:").map(str::trim_start))
            .collect::<Vec<_>>();
        if data_lines.is_empty() {
            return None;
        }
        serde_json::from_str::<Value>(data_lines.join("\n").as_str()).ok()
    }

    async fn read_sse_events(
        response: &mut reqwest::Response,
        expected_count: usize,
    ) -> Vec<Value> {
        let mut events = Vec::with_capacity(expected_count);
        let mut buffer = String::new();

        while events.len() < expected_count {
            let chunk = tokio::time::timeout(Duration::from_secs(5), response.chunk())
                .await
                .expect("timed out waiting for SSE event chunk")
                .expect("read SSE event chunk")
                .expect("SSE stream closed before expected events were received");
            buffer.push_str(
                std::str::from_utf8(chunk.as_ref()).expect("SSE event chunk should be UTF-8"),
            );

            while let Some((frame_end, delimiter_len)) = find_sse_frame_boundary(buffer.as_str()) {
                let frame = buffer[..frame_end].to_string();
                buffer = buffer[(frame_end + delimiter_len)..].to_string();
                if let Some(parsed) = parse_sse_json_frame(frame.as_str()) {
                    events.push(parsed);
                    if events.len() >= expected_count {
                        break;
                    }
                }
            }
        }

        events
    }

    async fn read_sse_events_until(
        response: &mut reqwest::Response,
        target_description: &str,
        mut stop_when: impl FnMut(&[Value]) -> bool,
    ) -> Vec<Value> {
        let mut events = Vec::new();
        let mut buffer = String::new();
        let deadline = Instant::now() + Duration::from_secs(15);

        loop {
            if stop_when(events.as_slice()) {
                return events;
            }
            if Instant::now() >= deadline {
                let observed_kinds = events
                    .iter()
                    .map(|event| {
                        event["kind"]
                            .as_str()
                            .unwrap_or("<unknown>")
                            .to_string()
                    })
                    .collect::<Vec<_>>();
                panic!(
                    "timed out waiting for {target_description} SSE events; observed kinds: {:?}",
                    observed_kinds
                );
            }
            let timeout_window = std::cmp::min(
                Duration::from_secs(5),
                deadline.saturating_duration_since(Instant::now()),
            );
            let chunk = match tokio::time::timeout(timeout_window, response.chunk()).await {
                Ok(chunk_result) => chunk_result
                    .expect("read SSE event chunk")
                    .expect("SSE stream closed before expected SSE events were received"),
                Err(_) => continue,
            };
            buffer.push_str(
                std::str::from_utf8(chunk.as_ref()).expect("SSE event chunk should be UTF-8"),
            );

            while let Some((frame_end, delimiter_len)) = find_sse_frame_boundary(buffer.as_str()) {
                let frame = buffer[..frame_end].to_string();
                buffer = buffer[(frame_end + delimiter_len)..].to_string();
                let Some(parsed) = parse_sse_json_frame(frame.as_str()) else {
                    continue;
                };
                events.push(parsed);
                if stop_when(events.as_slice()) {
                    return events;
                }
                if events.len() >= 64 {
                    panic!("received too many SSE events before {target_description}");
                }
            }
        }
    }

    async fn read_sse_events_until_turn_completed(
        response: &mut reqwest::Response,
        turn_id: &str,
    ) -> Vec<Value> {
        let target_turn_id = Value::String(turn_id.to_string());
        read_sse_events_until(response, "target turn.completed", move |events| {
            events.iter().any(|event| {
                event["kind"] == Value::String("turn.completed".to_string())
                    && event["payload"]["turnId"] == target_turn_id
            })
        })
        .await
    }

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
        let prepare_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_prepare_v2",
                "params": {
                    "workspaceId": "workspace-web",
                    "title": "Parallel safe delegation mission",
                    "executionProfileId": "balanced-delegate",
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
                    "executionProfileId": "balanced-delegate",
                    "approvedPlanVersion": approved_plan_version,
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
    { "slug": "gpt-5.4", "visibility": "list", "supported_in_api": true }
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
            entry["id"] == Value::String("gpt-5.4".to_string())
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

    #[tokio::test]
    async fn events_route_streams_started_delta_and_completed_for_successful_turn_send() {
        let (compat_base_url, compat_handle) =
            spawn_openai_compat_mock_server(vec!["gpt-5.3-codex"], Some("compat-test-key")).await;
        let config = test_service_config_with_openai_compat(compat_base_url.as_str());
        let (service_base_url, service_handle) = spawn_runtime_service_server(config).await;
        let client = reqwest::Client::new();

        let mut events_response = client
            .get(format!("{service_base_url}/events"))
            .send()
            .await
            .expect("open SSE events stream");
        assert_eq!(events_response.status(), reqwest::StatusCode::OK);
        let content_type = events_response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .unwrap_or_default();
        assert!(content_type.contains("text/event-stream"));

        let turn_request = json!({
            "method": "code_turn_send",
            "params": {
                "payload": {
                    "workspaceId": "workspace-web",
                    "threadId": "thread-events-success",
                    "requestId": "request-events-success",
                    "content": "Stream this turn",
                    "provider": "openai",
                    "modelId": "gpt-5.3-codex",
                    "reasonEffort": "high",
                    "accessMode": "on-request",
                    "executionMode": "runtime",
                    "queue": false,
                    "attachments": [],
                }
            }
        });
        let turn_response = client
            .post(format!("{service_base_url}/rpc"))
            .json(&turn_request)
            .send()
            .await
            .expect("send turn request");
        assert_eq!(turn_response.status(), reqwest::StatusCode::OK);
        let turn_payload: Value = turn_response.json().await.expect("parse turn response");
        assert_eq!(turn_payload["ok"], Value::Bool(true));
        assert_eq!(turn_payload["result"]["accepted"], Value::Bool(true));
        assert_eq!(
            turn_payload["result"]["message"],
            Value::String("Turn accepted.".to_string())
        );
        let turn_id = turn_payload["result"]["turnId"]
            .as_str()
            .expect("turn id in response")
            .to_string();

        let events =
            read_sse_events_until_turn_completed(&mut events_response, turn_id.as_str()).await;
        let turn_events = events
            .iter()
            .filter(|event| event["payload"]["turnId"] == Value::String(turn_id.clone()))
            .cloned()
            .collect::<Vec<_>>();
        assert_eq!(
            turn_events.first().expect("turn.started event")["kind"],
            Value::String("turn.started".to_string())
        );
        assert!(turn_events.iter().any(|event| {
            event["kind"] == Value::String("item.agentMessage.delta".to_string())
                && event["payload"]["delta"] == Value::String("ok:gpt-5.3-codex".to_string())
        }));
        assert_eq!(
            turn_events.last().expect("turn.completed event")["kind"],
            Value::String("turn.completed".to_string())
        );
        assert_eq!(
            turn_events.first().expect("turn.started event")["requestId"],
            Value::String("request-events-success".to_string())
        );
        assert_eq!(
            turn_events.last().expect("turn.completed event")["requestId"],
            Value::String("request-events-success".to_string())
        );
        assert_eq!(
            turn_events.first().expect("turn.started event")["payload"]["turnId"],
            Value::String(turn_id.clone())
        );
        assert_eq!(
            turn_events.last().expect("turn.completed event")["payload"]["turnId"],
            Value::String(turn_id)
        );
        assert_eq!(
            turn_events.last().expect("turn.completed event")["payload"]["output"],
            Value::String("ok:gpt-5.3-codex".to_string())
        );
        assert_eq!(
            turn_events.last().expect("turn.completed event")["payload"]["responseModelId"],
            Value::String("gpt-5.3-codex".to_string())
        );
        for event in &turn_events {
            let emitted_at = event["emittedAt"]
                .as_str()
                .expect("event should include emittedAt");
            assert!(emitted_at.contains('T'));
            assert!(emitted_at.ends_with('Z') || emitted_at.contains('+'));
        }

        compat_handle.abort();
        service_handle.abort();
    }

    #[tokio::test]
    async fn turn_send_rpc_returns_ack_before_provider_completion() {
        let provider_request_started = Arc::new(tokio::sync::Notify::new());
        let allow_provider_response = Arc::new(tokio::sync::Notify::new());
        let provider_request_started_handle = Arc::clone(&provider_request_started);
        let allow_provider_response_handle = Arc::clone(&allow_provider_response);
        let delayed_provider = Router::new()
            .route(
                "/v1/models",
                get(|| async {
                    (
                        StatusCode::OK,
                        Json(json!({
                            "object": "list",
                            "data": [{ "id": "gpt-5.3-codex", "object": "model" }],
                        })),
                    )
                }),
            )
            .route(
                "/v1/chat/completions",
                post(move |Json(payload): Json<Value>| {
                    let provider_request_started = Arc::clone(&provider_request_started_handle);
                    let allow_provider_response = Arc::clone(&allow_provider_response_handle);
                    async move {
                        provider_request_started.notify_one();
                        allow_provider_response.notified().await;
                    let model_id = payload
                        .get("model")
                        .and_then(Value::as_str)
                        .unwrap_or("unknown-model");
                        (
                            StatusCode::OK,
                            Json(json!({
                                "id": "chatcmpl-test-delayed",
                                "object": "chat.completion",
                                "choices": [{
                                    "index": 0,
                                    "message": {
                                        "role": "assistant",
                                        "content": format!("ok:{model_id}")
                                    }
                                }]
                            })),
                        )
                    }
                }),
            );
        let delayed_provider_listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind delayed compat listener");
        let delayed_provider_address = delayed_provider_listener
            .local_addr()
            .expect("resolve delayed compat listener address");
        let delayed_provider_handle = tokio::spawn(async move {
            let _ = axum::serve(delayed_provider_listener, delayed_provider).await;
        });

        let compat_base_url = format!("http://{delayed_provider_address}/v1");
        let config = test_service_config_with_openai_compat(compat_base_url.as_str());
        let (service_base_url, service_handle) = spawn_runtime_service_server(config).await;
        let client = reqwest::Client::new();

        let mut events_response = client
            .get(format!("{service_base_url}/events"))
            .send()
            .await
            .expect("open delayed turn events stream");
        assert_eq!(events_response.status(), reqwest::StatusCode::OK);

        let turn_request = json!({
            "method": "code_turn_send",
            "params": {
                "payload": {
                    "workspaceId": "workspace-web",
                    "threadId": "thread-events-fast-ack",
                    "requestId": "request-events-fast-ack",
                    "content": "Return the ack before provider completion",
                    "provider": "openai",
                    "modelId": "gpt-5.3-codex",
                    "reasonEffort": "high",
                    "accessMode": "on-request",
                    "executionMode": "runtime",
                    "queue": false,
                    "attachments": [],
                }
            }
        });

        let turn_request_task = tokio::spawn({
            let client = client.clone();
            let service_base_url = service_base_url.clone();
            let turn_request = turn_request.clone();
            async move {
                client
                    .post(format!("{service_base_url}/rpc"))
                    .json(&turn_request)
                    .send()
                    .await
            }
        });

        tokio::time::timeout(Duration::from_secs(2), provider_request_started.notified())
            .await
            .expect("provider request should start before waiting on the rpc ack");

        let turn_response = tokio::time::timeout(Duration::from_secs(1), turn_request_task)
            .await
            .expect("turn ack should return before provider completion")
            .expect("join delayed turn request task")
            .expect("send delayed turn request");
        assert_eq!(turn_response.status(), reqwest::StatusCode::OK);
        let turn_payload: Value = turn_response
            .json()
            .await
            .expect("parse delayed turn response");
        assert_eq!(turn_payload["ok"], Value::Bool(true));
        assert_eq!(turn_payload["result"]["accepted"], Value::Bool(true));
        let turn_id = turn_payload["result"]["turnId"]
            .as_str()
            .expect("delayed turn id")
            .to_string();
        assert_eq!(
            turn_payload["result"]["message"],
            Value::String("Turn accepted.".to_string())
        );

        let readiness_while_running: Value = client
            .get(format!("{service_base_url}/readiness"))
            .send()
            .await
            .expect("read readiness while delayed turn is running")
            .json()
            .await
            .expect("parse readiness while delayed turn is running");
        assert!(
            readiness_while_running["runtimeDiagnostics"]["observability"]["activeRuntimeTasks"]
                .as_u64()
                .unwrap_or(0)
                > 0,
            "turn send root task should be tracked by the runtime task supervisor"
        );

        allow_provider_response.notify_one();

        let events = read_sse_events_until_turn_completed(&mut events_response, turn_id.as_str()).await;
        let turn_events = events
            .iter()
            .filter(|event| event["payload"]["turnId"] == Value::String(turn_id.clone()))
            .collect::<Vec<_>>();
        assert!(turn_events
            .iter()
            .any(|event| event["kind"] == Value::String("turn.started".to_string())));
        assert!(turn_events.iter().any(|event| {
            event["kind"] == Value::String("item.agentMessage.delta".to_string())
                && event["payload"]["delta"] == Value::String("ok:gpt-5.3-codex".to_string())
        }));
        assert_eq!(
            turn_events
                .last()
                .expect("turn events should include completion")["kind"],
            Value::String("turn.completed".to_string())
        );
        assert_eq!(
            turn_events
                .last()
                .expect("turn events should include completion")["payload"]["output"],
            Value::String("ok:gpt-5.3-codex".to_string())
        );

        delayed_provider_handle.abort();
        service_handle.abort();
    }

    #[tokio::test]
    async fn events_route_streams_tool_events_for_full_access_runtime_plan_turn_send() {
        let workspace_path = PathBuf::from(format!(
            "/tmp/workspace-runtime-plan-events-{}",
            rand::random::<u64>()
        ));
        let _ = fs::remove_dir_all(workspace_path.as_path());
        fs::create_dir_all(workspace_path.as_path()).expect("create runtime-plan workspace");

        let (compat_base_url, compat_handle) =
            spawn_openai_compat_runtime_plan_mock_server(Some("compat-test-key")).await;
        let config = test_service_config_with_openai_compat(compat_base_url.as_str());
        let (service_base_url, service_handle) = spawn_runtime_service_server(config).await;
        let client = reqwest::Client::new();

        let workspace_create = client
            .post(format!("{service_base_url}/rpc"))
            .json(&json!({
                "method": "code_workspace_create",
                "params": {
                    "path": workspace_path.display().to_string(),
                    "displayName": "Runtime Plan Events",
                }
            }))
            .send()
            .await
            .expect("create workspace");
        assert_eq!(workspace_create.status(), reqwest::StatusCode::OK);
        let workspace_create_payload: Value = workspace_create
            .json()
            .await
            .expect("parse workspace create response");
        let workspace_id = workspace_create_payload["result"]["id"]
            .as_str()
            .expect("workspace id")
            .to_string();

        let mut events_response = client
            .get(format!("{service_base_url}/events"))
            .send()
            .await
            .expect("open SSE events stream");
        assert_eq!(events_response.status(), reqwest::StatusCode::OK);

        let turn_request = json!({
            "method": "code_turn_send",
            "params": {
                "payload": {
                    "workspaceId": workspace_id,
                    "threadId": "thread-runtime-plan-events",
                    "requestId": "request-runtime-plan-events",
                    "content": "create and list files",
                    "provider": "openai",
                    "modelId": "gpt-5.3-codex",
                    "reasonEffort": "high",
                    "accessMode": "full-access",
                    "executionMode": "runtime",
                    "queue": false,
                    "attachments": [],
                }
            }
        });
        let turn_response = client
            .post(format!("{service_base_url}/rpc"))
            .json(&turn_request)
            .send()
            .await
            .expect("send turn request");
        assert_eq!(turn_response.status(), reqwest::StatusCode::OK);
        let turn_payload: Value = turn_response.json().await.expect("parse turn response");
        assert_eq!(turn_payload["ok"], Value::Bool(true));
        assert_eq!(turn_payload["result"]["accepted"], Value::Bool(true));
        let turn_id = turn_payload["result"]["turnId"]
            .as_str()
            .expect("turn id")
            .to_string();

        let events =
            read_sse_events_until_turn_completed(&mut events_response, turn_id.as_str()).await;
        let turn_events = events
            .iter()
            .filter(|event| event["payload"]["turnId"] == Value::String(turn_id.clone()))
            .collect::<Vec<_>>();
        assert!(turn_events.iter().any(|event| event["kind"]
            == Value::String("item.started".to_string())
            && event["payload"]["item"]["tool"] == Value::String("write".to_string())));
        assert!(turn_events.iter().any(|event| event["kind"]
            == Value::String("item.started".to_string())
            && event["payload"]["item"]["tool"] == Value::String("bash".to_string())));
        assert!(turn_events.iter().any(|event| {
            event["kind"] == Value::String("item.completed".to_string())
                && event["payload"]["item"]["status"] == Value::String("completed".to_string())
        }));
        let tool_result_with_metadata = turn_events
            .iter()
            .find(|event| {
                event["kind"] == Value::String("item.completed".to_string())
                    && event["payload"]["item"]["tool"] == Value::String("write".to_string())
            })
            .expect("runtime-plan write tool result event");
        assert_eq!(tool_result_with_metadata["payload"]["item"]["metadata"]["workspaceId"], Value::String(
            workspace_id.clone()
        ));
        assert_eq!(
            tool_result_with_metadata["payload"]["item"]["metadata"]["path"],
            Value::String(workspace_path.join("runtime-plan-events.txt").display().to_string())
        );
        assert!(tool_result_with_metadata["payload"]["item"]["metadata"]["bytes"]
            .as_u64()
            .is_some());
        assert!(turn_events
            .iter()
            .any(|event| event["kind"] == Value::String("turn.completed".to_string())));

        let proof_path = workspace_path.join("runtime-plan-events.txt");
        let proof_content =
            fs::read_to_string(proof_path.as_path()).expect("read runtime-plan proof file");
        assert_eq!(proof_content, "runtime-plan-content");

        let _ = fs::remove_dir_all(workspace_path.as_path());
        compat_handle.abort();
        service_handle.abort();
    }

    #[tokio::test]
    async fn refusal_recovery_keeps_runtime_plan_response_model_metadata() {
        let workspace_path = PathBuf::from(format!(
            "/tmp/workspace-runtime-plan-refusal-recovery-{}",
            rand::random::<u64>()
        ));
        let _ = fs::remove_dir_all(workspace_path.as_path());
        fs::create_dir_all(workspace_path.as_path()).expect("create refusal recovery workspace");

        let (compat_base_url, compat_handle) =
            spawn_openai_compat_runtime_plan_mock_server(Some("compat-test-key")).await;
        let config = test_service_config_with_openai_compat(compat_base_url.as_str());
        let state = create_initial_state("gpt-5.3-codex");
        let native_state_store = Arc::new(crate::native_state_store::NativeStateStore::new(
            workspace_path.join("native-state.sqlite3"),
        ));
        let ctx = build_app_context(state, config, native_state_store);

        let recovered = maybe_recover_provider_local_access_refusal(
            &ctx,
            crate::provider_requests::ProviderQueryResult {
                output: "I cannot directly access your local computer.".to_string(),
                response_model_id: Some("gpt-5.3-codex".to_string()),
            },
            false,
            "full-access",
            false,
            &TurnProviderRoute::Core(RuntimeProvider::OpenAI),
            "workspace-web",
            "thread-runtime-plan-recovery",
            workspace_path.to_string_lossy().as_ref(),
            "turn-runtime-plan-recovery",
            Some("request-runtime-plan-recovery"),
            "create and list files",
            "gpt-5.3-codex",
            Some("high"),
            None,
            Some(compat_base_url.as_str()),
            Some("compat-test-key"),
            None,
            None,
            None,
            false,
            None,
            None,
            None,
        )
        .await;

        assert_eq!(recovered.output, "runtime plan executed".to_string());
        assert_eq!(
            recovered.response_model_id,
            Some("gpt-5.4-2026-03-01".to_string())
        );

        let _ = fs::remove_dir_all(workspace_path.as_path());
        compat_handle.abort();
    }

    #[tokio::test]
    async fn turn_interrupt_cancels_runtime_plan_turn_and_emits_failed_event() {
        let workspace_id = format!("workspace-runtime-plan-interrupt-{}", rand::random::<u64>());
        let workspace_path = PathBuf::from(format!("/tmp/{workspace_id}"));
        let _ = fs::remove_dir_all(workspace_path.as_path());

        let (compat_base_url, compat_handle) = spawn_openai_compat_runtime_plan_mock_server_with_delays(
            Some("compat-test-key"),
            None,
            Some(Duration::from_secs(8)),
        )
        .await;
        let config = test_service_config_with_openai_compat(compat_base_url.as_str());
        let (service_base_url, service_handle) = spawn_runtime_service_server(config).await;
        let client = reqwest::Client::new();

        let mut events_response = client
            .get(format!("{service_base_url}/events"))
            .send()
            .await
            .expect("open SSE events stream");
        assert_eq!(events_response.status(), reqwest::StatusCode::OK);

        let turn_request = json!({
            "method": "code_turn_send",
            "params": {
                "payload": {
                    "workspaceId": workspace_id,
                    "threadId": "thread-runtime-plan-interrupt",
                    "requestId": "request-runtime-plan-interrupt",
                    "content": "create and list files",
                    "provider": "openai",
                    "modelId": "gpt-5.3-codex",
                    "reasonEffort": "high",
                    "accessMode": "full-access",
                    "executionMode": "runtime",
                    "queue": false,
                    "attachments": [],
                }
            }
        });
        let service_base_url_for_turn = service_base_url.clone();
        let client_for_turn = client.clone();
        let turn_started_at = Instant::now();
        let turn_task = tokio::spawn(async move {
            let response = client_for_turn
                .post(format!("{service_base_url_for_turn}/rpc"))
                .json(&turn_request)
                .send()
                .await
                .expect("send interruptible turn request");
            assert_eq!(response.status(), reqwest::StatusCode::OK);
            response
                .json::<Value>()
                .await
                .expect("parse interruptible turn response")
        });

        let turn_id = loop {
            let event = read_sse_events(&mut events_response, 1)
                .await
                .into_iter()
                .next()
                .expect("sse turn.started event");
            if event["kind"] == Value::String("turn.started".to_string())
                && event["requestId"]
                    == Value::String("request-runtime-plan-interrupt".to_string())
            {
                break event["payload"]["turnId"]
                    .as_str()
                    .expect("turn id from started event")
                    .to_string();
            }
        };

        let interrupt_request = json!({
            "method": "code_turn_interrupt",
            "params": {
                "turnId": turn_id.clone(),
                "reason": "stop-runtime-plan"
            }
        });
        let interrupt_response = client
            .post(format!("{service_base_url}/rpc"))
            .json(&interrupt_request)
            .send()
            .await
            .expect("send turn interrupt request");
        assert_eq!(interrupt_response.status(), reqwest::StatusCode::OK);
        let interrupt_payload: Value = interrupt_response
            .json()
            .await
            .expect("parse turn interrupt response");
        assert_eq!(interrupt_payload["ok"], Value::Bool(true));
        assert_eq!(interrupt_payload["result"], Value::Bool(true));

        let turn_payload = tokio::time::timeout(Duration::from_secs(4), turn_task)
            .await
            .expect("timed out waiting for interrupted turn response")
            .expect("turn task join");
        assert_eq!(turn_payload["ok"], Value::Bool(true));
        assert_eq!(turn_payload["result"]["accepted"], Value::Bool(true));
        assert_eq!(
            turn_payload["result"]["message"],
            Value::String("Turn accepted.".to_string())
        );
        assert!(turn_started_at.elapsed() < Duration::from_secs(7));

        let failed_event = loop {
            let event = read_sse_events(&mut events_response, 1)
                .await
                .into_iter()
                .next()
                .expect("sse event");
            if event["kind"] == Value::String("turn.failed".to_string())
                && event["payload"]["turnId"] == Value::String(turn_id.clone())
            {
                break event;
            }
        };
        assert_eq!(
            failed_event["payload"]["error"]["code"],
            Value::String("TASK_INTERRUPTED".to_string())
        );

        let _ = fs::remove_dir_all(workspace_path.as_path());
        compat_handle.abort();
        service_handle.abort();
    }

    #[tokio::test]
    async fn runtime_plan_skips_final_provider_query_when_step_fails() {
        let workspace_id = format!("workspace-runtime-plan-fail-fast-{}", rand::random::<u64>());
        let workspace_path = PathBuf::from(format!("/tmp/{workspace_id}"));
        let _ = fs::remove_dir_all(workspace_path.as_path());

        let (compat_base_url, chat_counter, compat_handle) =
            spawn_openai_compat_runtime_plan_mock_server_with_counter(Some("compat-test-key"))
                .await;
        let config = test_service_config_with_openai_compat(compat_base_url.as_str());
        let (service_base_url, service_handle) = spawn_runtime_service_server(config).await;
        let client = reqwest::Client::new();
        let mut events_response = client
            .get(format!("{service_base_url}/events"))
            .send()
            .await
            .expect("open fail-fast SSE events stream");
        assert_eq!(events_response.status(), reqwest::StatusCode::OK);

        let turn_request = json!({
            "method": "code_turn_send",
            "params": {
                "payload": {
                    "workspaceId": workspace_id,
                    "threadId": "thread-runtime-plan-fail-fast",
                    "requestId": "request-runtime-plan-fail-fast",
                    "content": "force runtime step failure",
                    "provider": "openai",
                    "modelId": "gpt-5.3-codex",
                    "reasonEffort": "high",
                    "accessMode": "full-access",
                    "executionMode": "runtime",
                    "queue": false,
                    "attachments": [],
                }
            }
        });
        let turn_response = client
            .post(format!("{service_base_url}/rpc"))
            .json(&turn_request)
            .send()
            .await
            .expect("send runtime-plan fail-fast turn request");
        assert_eq!(turn_response.status(), reqwest::StatusCode::OK);
        let turn_payload: Value = turn_response
            .json()
            .await
            .expect("parse runtime-plan fail-fast turn response");
        assert_eq!(turn_payload["ok"], Value::Bool(true));
        assert_eq!(turn_payload["result"]["accepted"], Value::Bool(true));
        let turn_id = turn_payload["result"]["turnId"]
            .as_str()
            .expect("runtime-plan fail-fast turn id")
            .to_string();
        assert_eq!(
            turn_payload["result"]["message"],
            Value::String("Turn accepted.".to_string())
        );
        let terminal_events =
            read_sse_events_until(&mut events_response, "runtime-plan fail-fast terminal event", |events| {
                events.iter().any(|event| {
                    (event["kind"] == Value::String("turn.failed".to_string())
                        || event["kind"] == Value::String("turn.completed".to_string()))
                        && event["payload"]["turnId"] == Value::String(turn_id.clone())
                })
            })
            .await;
        let terminal_event = terminal_events
            .iter()
            .find(|event| {
                (event["kind"] == Value::String("turn.failed".to_string())
                    || event["kind"] == Value::String("turn.completed".to_string()))
                    && event["payload"]["turnId"] == Value::String(turn_id.clone())
            })
            .expect("runtime-plan fail-fast terminal event");
        assert!(
            terminal_event["payload"]["output"]
                .as_str()
                .or_else(|| terminal_event["payload"]["error"]["message"].as_str())
                .is_some_and(|message| !message.trim().is_empty())
        );
        assert_eq!(chat_counter.load(AtomicOrdering::Relaxed), 1);

        let _ = fs::remove_dir_all(workspace_path.as_path());
        compat_handle.abort();
        service_handle.abort();
    }

    #[tokio::test]
    async fn events_route_replays_buffered_events_after_last_event_id() {
        let (compat_base_url, compat_handle) =
            spawn_openai_compat_mock_server(vec!["gpt-5.3-codex"], Some("compat-test-key")).await;
        let config = test_service_config_with_openai_compat(compat_base_url.as_str());
        let (service_base_url, service_handle) = spawn_runtime_service_server(config).await;
        let client = reqwest::Client::new();

        let turn_request = json!({
            "method": "code_turn_send",
            "params": {
                "payload": {
                    "workspaceId": "workspace-web",
                    "threadId": "thread-events-replay",
                    "requestId": "request-events-replay",
                    "content": "Replay this turn",
                    "provider": "openai",
                    "modelId": "gpt-5.3-codex",
                    "reasonEffort": "high",
                    "accessMode": "on-request",
                    "executionMode": "runtime",
                    "queue": false,
                    "attachments": [],
                }
            }
        });
        let turn_response = client
            .post(format!("{service_base_url}/rpc"))
            .json(&turn_request)
            .send()
            .await
            .expect("send turn request");
        assert_eq!(turn_response.status(), reqwest::StatusCode::OK);
        let turn_payload: Value = turn_response.json().await.expect("parse turn response");
        assert_eq!(turn_payload["ok"], Value::Bool(true));
        assert_eq!(turn_payload["result"]["accepted"], Value::Bool(true));

        let mut replay_response = client
            .get(format!("{service_base_url}/events"))
            .header("Last-Event-ID", "1")
            .send()
            .await
            .expect("open SSE replay stream");
        assert_eq!(replay_response.status(), reqwest::StatusCode::OK);

        let replayed = read_sse_events(&mut replay_response, 3)
            .await
            .into_iter()
            .filter(|event| event["kind"] != Value::String("runtime.updated".to_string()))
            .collect::<Vec<_>>();
        assert_eq!(replayed.len(), 2);
        assert_eq!(replayed[0]["kind"], Value::String("item.agentMessage.delta".to_string()));
        assert_eq!(
            replayed[1]["kind"],
            Value::String("turn.completed".to_string())
        );
        assert_eq!(
            replayed[0]["requestId"],
            Value::String("request-events-replay".to_string())
        );
        assert_eq!(
            replayed[1]["requestId"],
            Value::String("request-events-replay".to_string())
        );

        compat_handle.abort();
        service_handle.abort();
    }

    #[tokio::test]
    async fn events_route_replay_then_live_stream_keeps_order_without_duplicates() {
        let (compat_base_url, compat_handle) =
            spawn_openai_compat_mock_server(vec!["gpt-5.3-codex"], Some("compat-test-key")).await;
        let config = test_service_config_with_openai_compat(compat_base_url.as_str());
        let (service_base_url, service_handle) = spawn_runtime_service_server(config).await;
        let client = reqwest::Client::new();

        let first_turn_request = json!({
            "method": "code_turn_send",
            "params": {
                "payload": {
                    "workspaceId": "workspace-web",
                    "threadId": "thread-events-replay-live",
                    "requestId": "request-events-replay-live-1",
                    "content": "First replay seed",
                    "provider": "openai",
                    "modelId": "gpt-5.3-codex",
                    "reasonEffort": "high",
                    "accessMode": "on-request",
                    "executionMode": "runtime",
                    "queue": false,
                    "attachments": [],
                }
            }
        });
        let first_turn_response = client
            .post(format!("{service_base_url}/rpc"))
            .json(&first_turn_request)
            .send()
            .await
            .expect("send first turn request");
        assert_eq!(first_turn_response.status(), reqwest::StatusCode::OK);

        let mut replay_response = client
            .get(format!("{service_base_url}/events"))
            .header("Last-Event-ID", "1")
            .send()
            .await
            .expect("open replay+live SSE stream");
        assert_eq!(replay_response.status(), reqwest::StatusCode::OK);

        let second_turn_request = json!({
            "method": "code_turn_send",
            "params": {
                "payload": {
                    "workspaceId": "workspace-web",
                    "threadId": "thread-events-replay-live",
                    "requestId": "request-events-replay-live-2",
                    "content": "Second live turn",
                    "provider": "openai",
                    "modelId": "gpt-5.3-codex",
                    "reasonEffort": "high",
                    "accessMode": "on-request",
                    "executionMode": "runtime",
                    "queue": false,
                    "attachments": [],
                }
            }
        });
        let second_turn_response = client
            .post(format!("{service_base_url}/rpc"))
            .json(&second_turn_request)
            .send()
            .await
            .expect("send second turn request");
        assert_eq!(second_turn_response.status(), reqwest::StatusCode::OK);
        let second_turn_payload: Value = second_turn_response
            .json()
            .await
            .expect("parse second turn response");
        let second_turn_id = second_turn_payload["result"]["turnId"]
            .as_str()
            .expect("second turn id")
            .to_string();

        let events = read_sse_events(&mut replay_response, 7).await;
        let turn_events = events
            .into_iter()
            .filter(|event| event["kind"] != Value::String("runtime.updated".to_string()))
            .collect::<Vec<_>>();
        assert!(turn_events.len() >= 5);
        assert_eq!(
            turn_events[0]["kind"],
            Value::String("item.agentMessage.delta".to_string())
        );
        assert_eq!(
            turn_events[1]["kind"],
            Value::String("turn.completed".to_string())
        );
        assert_eq!(
            turn_events[2]["kind"],
            Value::String("turn.started".to_string())
        );
        assert_eq!(
            turn_events[3]["kind"],
            Value::String("item.agentMessage.delta".to_string())
        );
        assert_eq!(
            turn_events[4]["kind"],
            Value::String("turn.completed".to_string())
        );
        assert_eq!(
            turn_events[2]["payload"]["turnId"],
            Value::String(second_turn_id.clone())
        );
        assert_eq!(
            turn_events[3]["payload"]["turnId"],
            Value::String(second_turn_id.clone())
        );
        assert_eq!(
            turn_events[4]["payload"]["turnId"],
            Value::String(second_turn_id)
        );

        compat_handle.abort();
        service_handle.abort();
    }

    #[tokio::test]
    async fn events_route_emits_resync_runtime_updated_when_replay_gap_detected() {
        let app = test_router();
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind runtime service listener");
        let address = listener
            .local_addr()
            .expect("resolve runtime service listener address");
        let handle = tokio::spawn(async move {
            let _ = axum::serve(listener, app).await;
        });
        let service_base_url = format!("http://{address}");
        let client = reqwest::Client::new();

        for index in 0..(TURN_EVENTS_REPLAY_BUFFER + 16) {
            let request = json!({
                "method": "code_workspace_create",
                "params": {
                    "path": format!("/tmp/runtime-replay-gap-{index}"),
                    "displayName": format!("Replay Gap {index}"),
                }
            });
            let response = client
                .post(format!("{service_base_url}/rpc"))
                .json(&request)
                .send()
                .await
                .expect("send workspace create request");
            assert_eq!(response.status(), reqwest::StatusCode::OK);
        }

        let mut replay_response = client
            .get(format!("{service_base_url}/events"))
            .header("Last-Event-ID", "1")
            .send()
            .await
            .expect("open SSE replay stream");
        assert_eq!(replay_response.status(), reqwest::StatusCode::OK);

        let replay_events = read_sse_events(&mut replay_response, 1).await;
        assert_eq!(
            replay_events[0]["kind"],
            Value::String("runtime.updated".to_string())
        );
        assert_eq!(
            replay_events[0]["payload"]["reason"],
            Value::String(EVENT_STREAM_RESYNC_REASON_REPLAY_GAP.to_string())
        );
        assert_eq!(
            replay_events[0]["payload"]["scope"],
            json!(EVENT_STREAM_RESYNC_SCOPE)
        );
        assert_eq!(
            replay_events[0]["payload"]["replayGapLastEventId"],
            Value::Number(1.into())
        );
        assert!(replay_events[0]["payload"]["replayGapOldestEventId"]
            .as_u64()
            .is_some_and(|id| id > 1));

        handle.abort();
    }

    #[test]
    fn runtime_stream_resync_envelope_preserves_runtime_updated_contract() {
        let envelope = build_runtime_stream_resync_event_envelope(
            "42".to_string(),
            EVENT_STREAM_RESYNC_REASON_LAGGED,
            Some(json!({
                "streamLaggedDroppedEvents": 9,
            })),
        );

        assert_eq!(
            envelope["kind"],
            Value::String("runtime.updated".to_string())
        );
        assert_eq!(
            envelope["payload"]["revision"],
            Value::String("42".to_string())
        );
        assert_eq!(
            envelope["payload"]["scope"],
            json!(EVENT_STREAM_RESYNC_SCOPE)
        );
        assert_eq!(
            envelope["payload"]["reason"],
            Value::String(EVENT_STREAM_RESYNC_REASON_LAGGED.to_string())
        );
        assert_eq!(
            envelope["payload"]["streamLaggedDroppedEvents"],
            Value::Number(9.into())
        );
        assert!(envelope["emittedAt"].as_str().is_some());
    }

    #[tokio::test]
    async fn events_route_emits_runtime_updated_for_mutating_rpc_methods() {
        let app = test_router();
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind runtime service listener");
        let address = listener
            .local_addr()
            .expect("resolve runtime service listener address");
        let handle = tokio::spawn(async move {
            let _ = axum::serve(listener, app).await;
        });
        let service_base_url = format!("http://{address}");
        let client = reqwest::Client::new();

        let mut events_response = client
            .get(format!("{service_base_url}/events"))
            .send()
            .await
            .expect("open SSE events stream");
        assert_eq!(events_response.status(), reqwest::StatusCode::OK);

        let workspace_create_request = json!({
            "method": "code_workspace_create",
            "params": {
                "path": "/tmp/runtime-updated",
                "displayName": "Runtime Updated"
            }
        });
        let workspace_create_response = client
            .post(format!("{service_base_url}/rpc"))
            .json(&workspace_create_request)
            .send()
            .await
            .expect("send workspace create request");
        assert_eq!(workspace_create_response.status(), reqwest::StatusCode::OK);

        let first_update = read_sse_events(&mut events_response, 1).await;
        assert_eq!(
            first_update[0]["kind"],
            Value::String("runtime.updated".to_string())
        );
        assert_eq!(
            first_update[0]["method"],
            Value::String("native_state_fabric_updated".to_string())
        );
        assert_eq!(
            first_update[0]["payload"]["reason"],
            Value::String("code_workspace_create".to_string())
        );
        assert_eq!(
            first_update[0]["payload"]["revision"],
            Value::String("1".to_string())
        );
        assert_eq!(
            first_update[0]["payload"]["scope"],
            json!(["workspaces", "bootstrap"])
        );
        let emitted_at = first_update[0]["emittedAt"]
            .as_str()
            .expect("runtime.updated should include emittedAt");
        assert!(emitted_at.contains('T'));

        let thread_create_request = json!({
            "method": "code_thread_create",
            "params": {
                "workspaceId": "workspace-web",
                "title": "Live Updated Thread"
            }
        });
        let thread_create_response = client
            .post(format!("{service_base_url}/rpc"))
            .json(&thread_create_request)
            .send()
            .await
            .expect("send thread create request");
        assert_eq!(thread_create_response.status(), reqwest::StatusCode::OK);

        let second_update = read_sse_events(&mut events_response, 1).await;
        assert_eq!(
            second_update[0]["kind"],
            Value::String("runtime.updated".to_string())
        );
        assert_eq!(
            second_update[0]["payload"]["reason"],
            Value::String("code_thread_create".to_string())
        );
        assert_eq!(
            second_update[0]["payload"]["revision"],
            Value::String("2".to_string())
        );
        assert_eq!(
            second_update[0]["payload"]["scope"],
            json!(["threads", "bootstrap"])
        );

        handle.abort();
    }

    #[tokio::test]
    async fn native_rpc_requests_emit_runtime_updated_with_native_reason() {
        let app = test_router();
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind runtime service listener");
        let address = listener
            .local_addr()
            .expect("resolve runtime service listener address");
        let handle = tokio::spawn(async move {
            let _ = axum::serve(listener, app).await;
        });
        let service_base_url = format!("http://{address}");
        let client = reqwest::Client::new();

        let mut events_response = client
            .get(format!("{service_base_url}/events"))
            .send()
            .await
            .expect("open SSE events stream");
        assert_eq!(events_response.status(), reqwest::StatusCode::OK);

        let request = json!({
            "method": "native_workspace_create",
            "params": {
                "path": "/tmp/runtime-updated-native",
                "displayName": "Runtime Updated Native"
            }
        });
        let response = client
            .post(format!("{service_base_url}/rpc"))
            .json(&request)
            .send()
            .await
            .expect("send workspace create request");
        assert_eq!(response.status(), reqwest::StatusCode::OK);

        let first_update = read_sse_events(&mut events_response, 1).await;
        assert_eq!(
            first_update[0]["kind"],
            Value::String("runtime.updated".to_string())
        );
        assert_eq!(
            first_update[0]["payload"]["reason"],
            Value::String("native_workspace_create".to_string())
        );

        handle.abort();
    }

    #[test]
    fn runtime_update_scope_avoids_bootstrap_for_turn_mutations() {
        assert_eq!(
            runtime_update_scope_for_method("code_turn_send"),
            Some(&["threads"] as &[&str])
        );
        assert_eq!(
            runtime_update_scope_for_method("code_turn_interrupt"),
            Some(&["threads"] as &[&str])
        );
        assert_eq!(
            runtime_update_scope_for_method("code_thread_live_subscribe"),
            Some(&["threads"] as &[&str])
        );
        assert_eq!(
            runtime_update_scope_for_method("code_thread_live_unsubscribe"),
            Some(&["threads"] as &[&str])
        );
        assert_eq!(
            runtime_update_scope_for_method("code_prompt_library_move"),
            Some(&["prompts", "bootstrap"] as &[&str])
        );
        assert_eq!(
            runtime_update_scope_for_method("code_runtime_backend_set_state"),
            Some(&["agents", "bootstrap"] as &[&str])
        );
        assert_eq!(
            runtime_update_scope_for_method("code_oauth_primary_account_set"),
            Some(&["oauth", "providers", "models", "bootstrap"] as &[&str])
        );
        assert_eq!(runtime_update_scope_for_method("code_distributed_task_graph"), None);
    }

    #[tokio::test]
    async fn thread_live_subscription_emits_heartbeat_and_detached_events() {
        let (service_base_url, handle) = spawn_runtime_service_server(test_service_config()).await;
        let client = reqwest::Client::new();

        let create_thread_response = client
            .post(format!("{service_base_url}/rpc"))
            .json(&json!({
                "method": "code_thread_create",
                "params": {
                    "workspaceId": "workspace-web",
                    "title": "Thread Live Contract"
                }
            }))
            .send()
            .await
            .expect("send thread create request");
        assert_eq!(create_thread_response.status(), reqwest::StatusCode::OK);
        let create_thread_payload: Value = create_thread_response
            .json()
            .await
            .expect("parse thread create payload");
        assert_eq!(create_thread_payload["ok"], Value::Bool(true));
        let thread_id = create_thread_payload["result"]["id"]
            .as_str()
            .expect("thread id should be present")
            .to_string();

        let mut events_response = client
            .get(format!("{service_base_url}/events"))
            .send()
            .await
            .expect("open SSE events stream");
        assert_eq!(events_response.status(), reqwest::StatusCode::OK);

        let subscribe_response = client
            .post(format!("{service_base_url}/rpc"))
            .json(&json!({
                "method": "code_thread_live_subscribe",
                "params": {
                    "workspaceId": "workspace-web",
                    "threadId": thread_id,
                }
            }))
            .send()
            .await
            .expect("send thread live subscribe request");
        assert_eq!(subscribe_response.status(), reqwest::StatusCode::OK);
        let subscribe_payload: Value = subscribe_response
            .json()
            .await
            .expect("parse thread live subscribe payload");
        assert_eq!(subscribe_payload["ok"], Value::Bool(true));
        let subscription_id = subscribe_payload["result"]["subscriptionId"]
            .as_str()
            .expect("subscription id should be present")
            .to_string();
        assert_eq!(
            subscribe_payload["result"]["heartbeatIntervalMs"],
            Value::Number(10_000.into())
        );
        assert_eq!(
            subscribe_payload["result"]["transportMode"],
            Value::String("push".to_string())
        );
        assert!(
            subscribe_payload["result"].get("contextRevision").is_none(),
            "legacy contextRevision should be removed from thread live subscriptions"
        );

        let subscribe_event = read_sse_events(&mut events_response, 1).await;
        assert_eq!(
            subscribe_event[0]["method"],
            Value::String("native_state_fabric_updated".to_string())
        );
        assert_eq!(
            subscribe_event[0]["payload"]["changeKind"],
            Value::String("threadLiveHeartbeatObserved".to_string())
        );
        assert_eq!(
            subscribe_event[0]["payload"]["subscriptionId"],
            Value::String(subscription_id.clone())
        );

        let unsubscribe_response = client
            .post(format!("{service_base_url}/rpc"))
            .json(&json!({
                "method": "code_thread_live_unsubscribe",
                "params": {
                    "subscriptionId": subscription_id,
                }
            }))
            .send()
            .await
            .expect("send thread live unsubscribe request");
        assert_eq!(unsubscribe_response.status(), reqwest::StatusCode::OK);
        let unsubscribe_payload: Value = unsubscribe_response
            .json()
            .await
            .expect("parse thread live unsubscribe payload");
        assert_eq!(unsubscribe_payload["ok"], Value::Bool(true));
        assert_eq!(unsubscribe_payload["result"]["ok"], Value::Bool(true));

        let mut detached_event: Option<Value> = None;
        for _ in 0..4 {
            let next_event = read_sse_events(&mut events_response, 1).await;
            if next_event[0]["method"]
                == Value::String("native_state_fabric_updated".to_string())
                && next_event[0]["payload"]["changeKind"]
                    == Value::String("threadLiveDetached".to_string())
            {
                detached_event = Some(next_event[0].clone());
                break;
            }
        }

        let detached_event =
            detached_event.expect("native_state_fabric_updated detached event should be emitted");
        assert_eq!(
            detached_event["payload"]["reason"],
            Value::String("code_thread_live_unsubscribe".to_string())
        );

        handle.abort();
    }

    #[tokio::test]
    async fn events_route_streams_started_and_failed_for_unsuccessful_turn_send() {
        let (service_base_url, service_handle) =
            spawn_runtime_service_server(test_service_config()).await;
        let client = reqwest::Client::new();

        let mut events_response = client
            .get(format!("{service_base_url}/events"))
            .send()
            .await
            .expect("open SSE events stream");
        assert_eq!(events_response.status(), reqwest::StatusCode::OK);

        let turn_request = json!({
            "method": "code_turn_send",
            "params": {
                "payload": {
                    "workspaceId": "workspace-web",
                    "threadId": "thread-events-failure",
                    "requestId": "request-events-failure",
                    "content": "This should fail without provider key",
                    "provider": "openai",
                    "modelId": "gpt-5.3-codex",
                    "reasonEffort": "high",
                    "accessMode": "on-request",
                    "executionMode": "runtime",
                    "queue": false,
                    "attachments": [],
                }
            }
        });
        let turn_response = client
            .post(format!("{service_base_url}/rpc"))
            .json(&turn_request)
            .send()
            .await
            .expect("send turn request");
        assert_eq!(turn_response.status(), reqwest::StatusCode::OK);
        let turn_payload: Value = turn_response.json().await.expect("parse turn response");
        assert_eq!(turn_payload["ok"], Value::Bool(true));
        assert_eq!(turn_payload["result"]["accepted"], Value::Bool(true));
        assert_eq!(
            turn_payload["result"]["message"],
            Value::String("Turn accepted.".to_string())
        );
        let turn_id = turn_payload["result"]["turnId"]
            .as_str()
            .expect("turn id in response")
            .to_string();

        let events = read_sse_events_until(&mut events_response, "turn failure events", |events| {
            events.iter().any(|event| {
                event["kind"] == Value::String("turn.failed".to_string())
                    && event["payload"]["turnId"] == Value::String(turn_id.clone())
            })
        })
        .await;
        let turn_events = events
            .iter()
            .filter(|event| event["payload"]["turnId"] == Value::String(turn_id.clone()))
            .collect::<Vec<_>>();
        assert_eq!(
            turn_events.first().expect("turn.started event")["kind"],
            Value::String("turn.started".to_string())
        );
        assert_eq!(
            turn_events.last().expect("turn.failed event")["kind"],
            Value::String("turn.failed".to_string())
        );
        assert_eq!(
            turn_events.first().expect("turn.started event")["requestId"],
            Value::String("request-events-failure".to_string())
        );
        assert_eq!(
            turn_events.last().expect("turn.failed event")["requestId"],
            Value::String("request-events-failure".to_string())
        );
        assert_eq!(
            turn_events.first().expect("turn.started event")["payload"]["turnId"],
            Value::String(turn_id.clone())
        );
        assert_eq!(
            turn_events.last().expect("turn.failed event")["payload"]["turnId"],
            Value::String(turn_id)
        );
        assert_eq!(
            turn_events.last().expect("turn.failed event")["payload"]["error"]["code"],
            Value::String("TURN_EXECUTION_FAILED".to_string())
        );
        assert!(turn_events.last().expect("turn.failed event")["payload"]["error"]["message"]
            .as_str()
            .is_some_and(|message| !message.trim().is_empty()));

        service_handle.abort();
    }

    #[tokio::test]
    async fn events_route_streams_agent_task_tool_flow() {
        let (service_base_url, service_handle) =
            spawn_runtime_service_server(test_service_config()).await;
        let client = reqwest::Client::new();

        let mut events_response = client
            .get(format!("{service_base_url}/events"))
            .send()
            .await
            .expect("open SSE events stream");
        assert_eq!(events_response.status(), reqwest::StatusCode::OK);

        let start_request = json!({
            "method": "code_runtime_run_start_v2",
            "params": {
                "workspaceId": "workspace-web",
                "requestId": "request-agent-events",
                "accessMode": "full-access",
                "executionMode": "single",
                "steps": [
                    {
                        "kind": "bash",
                        "command": "echo runtime-agent-events",
                        "requiresApproval": false,
                    }
                ]
            }
        });
        let (start_status, start_payload) =
            send_runtime_service_rpc_request(&client, service_base_url.as_str(), start_request)
                .await;
        assert_eq!(start_status, reqwest::StatusCode::OK);
        assert_eq!(start_payload["ok"], Value::Bool(true));
        let task_id = runtime_run_task_id(&start_payload);

        let events =
            read_sse_events_until_turn_completed(&mut events_response, task_id.as_str()).await;
        let mut kinds = events
            .iter()
            .filter_map(|event| event["kind"].as_str())
            .collect::<Vec<_>>();
        kinds.sort_unstable();
        assert!(kinds.contains(&"runtime.updated"));
        assert!(kinds.contains(&"turn.started"));
        assert!(kinds.contains(&"item.agentMessage.delta"));
        assert!(kinds.contains(&"item.started"));
        assert!(kinds.contains(&"item.completed"));
        assert!(kinds.contains(&"turn.completed"));

        let task_events = events
            .iter()
            .filter(|event| event["payload"]["turnId"] == Value::String(task_id.clone()))
            .collect::<Vec<_>>();
        assert!(!task_events.is_empty());
        let completed_item_event = task_events
            .iter()
            .find(|event| {
                event["kind"] == Value::String("item.completed".to_string())
                    && event["payload"]["item"]["status"]
                        == Value::String("completed".to_string())
            })
            .expect("completed item event");
        assert_eq!(
            completed_item_event["payload"]["item"]["metadata"]["toolCapabilities"]["skillId"],
            Value::String("core-bash".to_string())
        );
        assert_eq!(
            completed_item_event["payload"]["item"]["metadata"]["inspector"]["decision"],
            Value::String("allow".to_string())
        );
        assert_eq!(
            completed_item_event["payload"]["item"]["arguments"]["metadata"]["inspector"]
                ["decision"],
            Value::String("allow".to_string())
        );
        assert!(task_events.iter().all(|event| {
            event["requestId"] == Value::String("request-agent-events".to_string())
        }));

        service_handle.abort();
    }

    #[tokio::test]
    async fn events_route_streams_agent_task_step_heartbeat_delta_for_long_running_step() {
        let (service_base_url, service_handle) =
            spawn_runtime_service_server(test_service_config()).await;
        let client = reqwest::Client::new();

        let mut events_response = client
            .get(format!("{service_base_url}/events"))
            .send()
            .await
            .expect("open SSE events stream");
        assert_eq!(events_response.status(), reqwest::StatusCode::OK);

        let start_request = json!({
            "method": "code_runtime_run_start_v2",
            "params": {
                "workspaceId": "workspace-web",
                "requestId": "request-agent-heartbeat",
                "accessMode": "full-access",
                "executionMode": "single",
                "steps": [
                    {
                        "kind": "bash",
                        "command": "sleep 2 && echo runtime-agent-heartbeat",
                        "requiresApproval": false,
                    }
                ]
            }
        });
        let (start_status, start_payload) =
            send_runtime_service_rpc_request(&client, service_base_url.as_str(), start_request)
                .await;
        assert_eq!(start_status, reqwest::StatusCode::OK);
        assert_eq!(start_payload["ok"], Value::Bool(true));
        let task_id = runtime_run_task_id(&start_payload);

        let events = read_sse_events_until_turn_completed(&mut events_response, task_id.as_str()).await;
        let task_events = events
            .iter()
            .filter(|event| event["payload"]["turnId"] == Value::String(task_id.clone()))
            .collect::<Vec<_>>();
        assert!(!task_events.is_empty());
        assert!(task_events.iter().all(|event| {
            event["requestId"] == Value::String("request-agent-heartbeat".to_string())
        }));
        assert!(task_events.iter().any(|event| {
            event["kind"] == Value::String("item.started".to_string())
        }));
        assert!(task_events.iter().any(|event| {
            event["kind"] == Value::String("item.completed".to_string())
                && event["payload"]["item"]["status"] == Value::String("completed".to_string())
        }));
        assert!(task_events.iter().any(|event| {
            event["kind"] == Value::String("turn.completed".to_string())
        }));
        assert!(task_events.iter().any(|event| {
            event["kind"] == Value::String("item.agentMessage.delta".to_string())
                && event["payload"]["delta"]
                    .as_str()
                    .map(|entry| entry.contains("still running"))
                    .unwrap_or(false)
        }));

        service_handle.abort();
    }

    #[tokio::test]
    async fn events_route_streams_approval_required_and_interrupted_for_agent_task() {
        let (service_base_url, service_handle) =
            spawn_runtime_service_server(test_service_config()).await;
        let client = reqwest::Client::new();
        let workspace_id = format!("workspace-web-{}", rand::random::<u64>());
        let workspace_path = PathBuf::from(format!("/tmp/{workspace_id}"));
        let target_path = workspace_path.join("agent-task/approval-interrupt.txt");
        let _ = fs::remove_dir_all(workspace_path.as_path());

        let workspace_create_request = json!({
            "method": "code_workspace_create",
            "params": {
                "path": workspace_path.display().to_string(),
                "displayName": "Agent SSE Approval Workspace"
            }
        });
        let workspace_create_response = client
            .post(format!("{service_base_url}/rpc"))
            .json(&workspace_create_request)
            .send()
            .await
            .expect("create workspace for approval interrupt");
        assert_eq!(workspace_create_response.status(), reqwest::StatusCode::OK);
        let workspace_create_payload: Value = workspace_create_response
            .json()
            .await
            .expect("parse workspace create response");
        assert_eq!(workspace_create_payload["ok"], Value::Bool(true));
        let workspace_runtime_id = workspace_create_payload["result"]["id"]
            .as_str()
            .expect("workspace runtime id")
            .to_string();
        fs::create_dir_all(
            target_path
                .parent()
                .expect("approval interrupt target parent"),
        )
        .expect("create approval interrupt target parent");
        fs::write(target_path.as_path(), "before interrupt").expect("seed approval interrupt file");

        let mut events_response = client
            .get(format!("{service_base_url}/events"))
            .send()
            .await
            .expect("open SSE events stream");
        assert_eq!(events_response.status(), reqwest::StatusCode::OK);
        tokio::time::sleep(Duration::from_millis(50)).await;

        let start_request = json!({
            "method": "code_runtime_run_start_v2",
            "params": {
                "workspaceId": workspace_runtime_id,
                "requestId": "request-agent-approval-interrupt",
                "executionMode": "single",
                "steps": [
                    {
                        "kind": "read",
                        "path": "agent-task/approval-interrupt.txt",
                    },
                    {
                        "kind": "write",
                        "path": "agent-task/approval-interrupt.txt",
                        "content": "blocked",
                    }
                ]
            }
        });
        let (start_status, start_payload) =
            send_runtime_service_rpc_request(&client, service_base_url.as_str(), start_request)
                .await;
        assert_eq!(start_status, reqwest::StatusCode::OK);
        assert_eq!(start_payload["ok"], Value::Bool(true));
        let task_id = runtime_run_task_id(&start_payload);

        let mut awaiting_approval_payload: Option<Value> = None;
        for _ in 0..120 {
            let status_response = client
                .post(format!("{service_base_url}/rpc"))
                .json(&json!({
                    "method": "code_runtime_run_subscribe_v2",
                    "params": {
                        "runId": task_id.as_str(),
                    }
                }))
                .send()
                .await
                .expect("send agent task status request");
            assert_eq!(status_response.status(), reqwest::StatusCode::OK);
            let status_payload: Value = status_response
                .json()
                .await
                .expect("parse agent task status response");
            assert_eq!(status_payload["ok"], Value::Bool(true));
            if runtime_run_record(&status_payload)["status"]
                == Value::String("awaiting_approval".to_string())
            {
                awaiting_approval_payload = Some(normalize_runtime_run_payload(status_payload));
                break;
            }
            tokio::time::sleep(Duration::from_millis(25)).await;
        }
        let awaiting_approval_payload = awaiting_approval_payload
            .expect("task should enter awaiting_approval status before interrupt");
        assert!(
            awaiting_approval_payload["result"]["pendingApprovalId"]
                .as_str()
                .is_some()
        );
        assert_eq!(
            awaiting_approval_payload["result"]["requestId"],
            Value::String("request-agent-approval-interrupt".to_string())
        );
        let task_id_value = Value::String(task_id.clone());

        let interrupt_request = json!({
            "method": "code_runtime_run_cancel_v2",
            "params": {
                "taskId": task_id,
                "reason": "interrupt-test",
            }
        });
        let interrupt_response = client
            .post(format!("{service_base_url}/rpc"))
            .json(&interrupt_request)
            .send()
            .await
            .expect("send interrupt request");
        assert_eq!(interrupt_response.status(), reqwest::StatusCode::OK);
        let interrupt_payload: Value = interrupt_response
            .json()
            .await
            .expect("parse interrupt response");
        assert_eq!(interrupt_payload["ok"], Value::Bool(true));
        assert_eq!(interrupt_payload["result"]["accepted"], Value::Bool(true));

        let runtime_updated_kind = Value::String("runtime.updated".to_string());
        let interrupt_reason_key = Value::String("code_runtime_run_cancel_v2".to_string());
        let turn_failed_kind = Value::String("turn.failed".to_string());
        let interrupted_code = Value::String("TASK_INTERRUPTED".to_string());
        let interrupted_message = Value::String("interrupt-test".to_string());
        let second_events = read_sse_events_until(
            &mut events_response,
            "agent task interruption events",
            {
                let task_id_value = task_id_value.clone();
                let runtime_updated_kind = runtime_updated_kind.clone();
                let interrupt_reason_key = interrupt_reason_key.clone();
                let turn_failed_kind = turn_failed_kind.clone();
                let interrupted_code = interrupted_code.clone();
                let interrupted_message = interrupted_message.clone();
                move |events| {
                    let has_runtime_updated = events.iter().any(|event| {
                        event["kind"] == runtime_updated_kind
                            && event["payload"]["reason"] == interrupt_reason_key
                    });
                    let has_turn_failed_code = events.iter().any(|event| {
                        event["kind"] == turn_failed_kind
                            && event["payload"]["turnId"] == task_id_value
                            && event["payload"]["error"]["code"] == interrupted_code
                    });
                    let has_turn_failed_message = events.iter().any(|event| {
                        event["kind"] == turn_failed_kind
                            && event["payload"]["turnId"] == task_id_value
                            && event["payload"]["error"]["message"] == interrupted_message
                    });
                    has_runtime_updated && has_turn_failed_code && has_turn_failed_message
                }
            },
        )
        .await;
        assert!(second_events.iter().any(|event| {
            event["kind"] == runtime_updated_kind
                && event["payload"]["reason"] == interrupt_reason_key
        }));
        assert!(second_events.iter().any(|event| {
            event["kind"] == turn_failed_kind
                && event["payload"]["turnId"] == task_id_value
                && event["payload"]["error"]["code"] == interrupted_code
        }));
        assert!(second_events.iter().any(|event| {
            event["kind"] == turn_failed_kind
                && event["payload"]["turnId"] == task_id_value
                && event["payload"]["error"]["message"] == interrupted_message
        }));
        let approval_required_event = second_events
            .iter()
            .find(|event| {
                event["kind"] == Value::String("approval.required".to_string())
                    && event["payload"]["turnId"] == task_id_value
            })
            .expect("approval.required event");
        assert_eq!(
            approval_required_event["payload"]["approval"]["requestSource"],
            Value::String("capability_default".to_string())
        );
        assert_eq!(
            approval_required_event["payload"]["approval"]["scopeKind"],
            Value::String("file-target".to_string())
        );
        assert_eq!(
            approval_required_event["payload"]["approval"]["scopeTarget"],
            Value::String("agent-task/approval-interrupt.txt".to_string())
        );
        assert_eq!(
            approval_required_event["payload"]["inspector"]["decision"],
            Value::String("allow".to_string())
        );

        let _ = fs::remove_dir_all(workspace_path.as_path());
        service_handle.abort();
    }

    #[tokio::test]
    async fn events_route_streams_approval_resolved_for_agent_task_rejection() {
        let (service_base_url, service_handle) =
            spawn_runtime_service_server(test_service_config()).await;
        let client = reqwest::Client::new();
        let workspace_id = format!("workspace-web-{}", rand::random::<u64>());
        let workspace_path = PathBuf::from(format!("/tmp/{workspace_id}"));
        let target_path = workspace_path.join("agent-task/approval-reject.txt");
        let _ = fs::remove_dir_all(workspace_path.as_path());

        let workspace_create_request = json!({
            "method": "code_workspace_create",
            "params": {
                "path": workspace_path.display().to_string(),
                "displayName": "Agent SSE Approval Rejection Workspace"
            }
        });
        let workspace_create_response = client
            .post(format!("{service_base_url}/rpc"))
            .json(&workspace_create_request)
            .send()
            .await
            .expect("create workspace for approval rejection");
        assert_eq!(workspace_create_response.status(), reqwest::StatusCode::OK);
        let workspace_create_payload: Value = workspace_create_response
            .json()
            .await
            .expect("parse workspace create response");
        assert_eq!(workspace_create_payload["ok"], Value::Bool(true));
        let workspace_runtime_id = workspace_create_payload["result"]["id"]
            .as_str()
            .expect("workspace runtime id")
            .to_string();
        fs::create_dir_all(
            target_path
                .parent()
                .expect("approval rejection target parent"),
        )
        .expect("create approval rejection target parent");
        fs::write(target_path.as_path(), "before rejection").expect("seed approval rejection file");

        let mut events_response = client
            .get(format!("{service_base_url}/events"))
            .send()
            .await
            .expect("open SSE events stream");
        assert_eq!(events_response.status(), reqwest::StatusCode::OK);
        tokio::time::sleep(Duration::from_millis(50)).await;

        let start_request = json!({
            "method": "code_runtime_run_start_v2",
            "params": {
                "workspaceId": workspace_runtime_id,
                "requestId": "request-agent-approval-reject",
                "executionMode": "single",
                "steps": [
                    {
                        "kind": "read",
                        "path": "agent-task/approval-reject.txt",
                    },
                    {
                        "kind": "write",
                        "path": "agent-task/approval-reject.txt",
                        "content": "blocked",
                    }
                ]
            }
        });
        let (start_status, start_payload) =
            send_runtime_service_rpc_request(&client, service_base_url.as_str(), start_request)
                .await;
        assert_eq!(start_status, reqwest::StatusCode::OK);
        assert_eq!(start_payload["ok"], Value::Bool(true));
        let task_id = runtime_run_task_id(&start_payload);

        let mut approval_id: Option<String> = None;
        for _ in 0..120 {
            let status_response = client
                .post(format!("{service_base_url}/rpc"))
                .json(&json!({
                    "method": "code_runtime_run_subscribe_v2",
                    "params": {
                        "runId": task_id.as_str(),
                    }
                }))
                .send()
                .await
                .expect("send agent task status request");
            assert_eq!(status_response.status(), reqwest::StatusCode::OK);
            let status_payload: Value = status_response
                .json()
                .await
                .expect("parse agent task status response");
            assert_eq!(status_payload["ok"], Value::Bool(true));
            let run_record = runtime_run_record(&status_payload);
            if run_record["status"] == Value::String("awaiting_approval".to_string()) {
                approval_id = run_record["pendingApprovalId"]
                    .as_str()
                    .map(ToOwned::to_owned);
                break;
            }
            tokio::time::sleep(Duration::from_millis(25)).await;
        }
        let approval_id = approval_id.expect("task should enter awaiting_approval status");

        let approval_decision_response = client
            .post(format!("{service_base_url}/rpc"))
            .json(&json!({
                "method": "code_runtime_run_checkpoint_approval",
                "params": {
                    "approvalId": approval_id,
                    "decision": "rejected",
                    "reason": "blocked in event test",
                }
            }))
            .send()
            .await
            .expect("send approval decision");
        assert_eq!(approval_decision_response.status(), reqwest::StatusCode::OK);
        let approval_decision_payload: Value = approval_decision_response
            .json()
            .await
            .expect("parse approval decision response");
        assert_eq!(approval_decision_payload["ok"], Value::Bool(true));

        let task_id_value = Value::String(task_id.clone());
        let lifecycle_events = read_sse_events_until(
            &mut events_response,
            "agent approval rejection lifecycle events",
            {
                let task_id_value = task_id_value.clone();
                move |events| {
                    let has_approval_resolved = events.iter().any(|event| {
                        event["kind"] == Value::String("approval.resolved".to_string())
                            && event["payload"]["turnId"] == task_id_value
                    });
                    let has_turn_failed = events.iter().any(|event| {
                        event["kind"] == Value::String("turn.failed".to_string())
                            && event["payload"]["turnId"] == task_id_value
                            && event["payload"]["error"]["code"]
                                == Value::String("APPROVAL_REJECTED".to_string())
                    });
                    has_approval_resolved && has_turn_failed
                }
            },
        )
        .await;

        let approval_resolved_event = lifecycle_events
            .iter()
            .find(|event| {
                event["kind"] == Value::String("approval.resolved".to_string())
                    && event["payload"]["turnId"] == task_id_value
            })
            .expect("approval.resolved event");
        assert_eq!(
            approval_resolved_event["payload"]["approval"]["resolutionStatus"],
            Value::String("rejected".to_string())
        );
        assert_eq!(
            approval_resolved_event["payload"]["approval"]["resolutionReason"],
            Value::String("blocked in event test".to_string())
        );
        assert_eq!(
            approval_resolved_event["payload"]["approval"]["resolutionAction"],
            Value::String("write".to_string())
        );
        assert_eq!(
            approval_resolved_event["payload"]["approval"]["decision"],
            Value::String("rejected".to_string())
        );

        let _ = fs::remove_dir_all(workspace_path.as_path());
        service_handle.abort();
    }

    #[tokio::test]
    async fn ws_route_executes_rpc_requests_and_returns_structured_method_not_found() {
        let (service_base_url, service_handle) =
            spawn_runtime_service_server(test_service_config()).await;
        let mut socket = open_runtime_ws(service_base_url.as_str(), None).await;

        let ready = read_ws_json(&mut socket).await;
        assert_eq!(ready["type"], Value::String("transport.ready".to_string()));
        assert_eq!(
            ready["transport"]["endpointPath"],
            Value::String(CODE_RUNTIME_RPC_TRANSPORT_WS_PATH.to_string())
        );
        assert_eq!(
            ready["transports"]["rpc"]["endpointPath"],
            Value::String(CODE_RUNTIME_RPC_TRANSPORT_RPC_PATH.to_string())
        );
        assert_eq!(
            ready["transports"]["events"]["endpointPath"],
            Value::String(CODE_RUNTIME_RPC_TRANSPORT_EVENTS_PATH.to_string())
        );

        socket
            .send(TungsteniteMessage::Text(
                json!({
                    "type": "rpc.request",
                    "id": "ws-health",
                    "method": "code_health",
                    "params": {},
                })
                .to_string()
                .into(),
            ))
            .await
            .expect("send websocket health request");
        let health_response = read_ws_json(&mut socket).await;
        assert_eq!(
            health_response["type"],
            Value::String("rpc.response".to_string())
        );
        assert_eq!(
            health_response["id"],
            Value::String("ws-health".to_string())
        );
        assert_eq!(health_response["ok"], Value::Bool(true));
        assert_eq!(
            health_response["result"]["status"],
            Value::String("ok".to_string())
        );

        socket
            .send(TungsteniteMessage::Text(
                json!({
                    "type": "rpc.request",
                    "id": "ws-unknown",
                    "method": "code_unknown_method",
                    "params": {},
                })
                .to_string()
                .into(),
            ))
            .await
            .expect("send websocket unknown method request");
        let unknown_response = read_ws_json(&mut socket).await;
        assert_eq!(
            unknown_response["type"],
            Value::String("rpc.response".to_string())
        );
        assert_eq!(
            unknown_response["id"],
            Value::String("ws-unknown".to_string())
        );
        assert_eq!(unknown_response["ok"], Value::Bool(false));
        assert_eq!(
            unknown_response["error"]["code"],
            Value::String("METHOD_NOT_FOUND".to_string())
        );

        service_handle.abort();
    }

    #[tokio::test]
    async fn ws_route_negotiates_runtime_protocol_when_offered() {
        let (service_base_url, service_handle) =
            spawn_runtime_service_server(test_service_config()).await;
        let (_socket, response) = open_runtime_ws_with_response(
            service_base_url.as_str(),
            None,
            Some(CODE_RUNTIME_RPC_TRANSPORT_WS_PROTOCOL),
        )
        .await;
        let protocol_header = response
            .headers()
            .get("sec-websocket-protocol")
            .and_then(|value| value.to_str().ok());
        assert_eq!(
            protocol_header,
            Some(CODE_RUNTIME_RPC_TRANSPORT_WS_PROTOCOL)
        );

        service_handle.abort();
    }

    #[tokio::test]
    async fn ws_route_streams_turn_events_for_turn_send() {
        let (compat_base_url, compat_handle) =
            spawn_openai_compat_mock_server(vec!["gpt-5.3-codex"], Some("compat-test-key")).await;
        let config = test_service_config_with_openai_compat(compat_base_url.as_str());
        let (service_base_url, service_handle) = spawn_runtime_service_server(config).await;
        let mut socket = open_runtime_ws(service_base_url.as_str(), None).await;
        let _ = read_ws_json(&mut socket).await;

        socket
            .send(TungsteniteMessage::Text(
                json!({
                    "type": "rpc.request",
                    "id": "ws-turn-send",
                    "method": "code_turn_send",
                    "params": {
                        "payload": {
                            "workspaceId": "workspace-web",
                            "threadId": "thread-ws-events",
                            "requestId": "request-ws-events",
                            "content": "Stream websocket turn",
                            "provider": "openai",
                            "modelId": "gpt-5.3-codex",
                            "reasonEffort": "high",
                            "accessMode": "on-request",
                            "executionMode": "runtime",
                            "queue": false,
                            "attachments": [],
                        }
                    }
                })
                .to_string()
                .into(),
            ))
            .await
            .expect("send websocket turn request");

        let mut saw_response = false;
        let mut saw_started = false;
        let mut saw_delta = false;
        let mut saw_completed = false;

        for _ in 0..16 {
            let message = read_ws_json(&mut socket).await;
            match message["type"].as_str() {
                Some("rpc.response") => {
                    if message["id"] == Value::String("ws-turn-send".to_string()) {
                        assert_eq!(message["ok"], Value::Bool(true));
                        assert_eq!(message["result"]["accepted"], Value::Bool(true));
                        saw_response = true;
                    }
                }
                Some("runtime.event") => {
                    let kind = message["event"]["kind"].as_str().unwrap_or_default();
                    if kind == "turn.started" {
                        saw_started = true;
                        assert_eq!(
                            message["event"]["requestId"],
                            Value::String("request-ws-events".to_string())
                        );
                    } else if kind == "item.agentMessage.delta" {
                        saw_delta = true;
                        assert_eq!(
                            message["event"]["requestId"],
                            Value::String("request-ws-events".to_string())
                        );
                    } else if kind == "turn.completed" {
                        saw_completed = true;
                        assert_eq!(
                            message["event"]["requestId"],
                            Value::String("request-ws-events".to_string())
                        );
                    }
                }
                _ => {}
            }
            if saw_response && saw_started && saw_delta && saw_completed {
                break;
            }
        }

        assert!(saw_response);
        assert!(saw_started);
        assert!(saw_delta);
        assert!(saw_completed);

        compat_handle.abort();
        service_handle.abort();
    }

    #[tokio::test]
    async fn ws_route_replays_events_from_last_event_id_query() {
        let (compat_base_url, compat_handle) =
            spawn_openai_compat_mock_server(vec!["gpt-5.3-codex"], Some("compat-test-key")).await;
        let config = test_service_config_with_openai_compat(compat_base_url.as_str());
        let (service_base_url, service_handle) = spawn_runtime_service_server(config).await;
        let client = reqwest::Client::new();

        let turn_request = json!({
            "method": "code_turn_send",
            "params": {
                "payload": {
                    "workspaceId": "workspace-web",
                    "threadId": "thread-ws-replay",
                    "requestId": "request-ws-replay",
                    "content": "Replay websocket turn",
                    "provider": "openai",
                    "modelId": "gpt-5.3-codex",
                    "reasonEffort": "high",
                    "accessMode": "on-request",
                    "executionMode": "runtime",
                    "queue": false,
                    "attachments": [],
                }
            }
        });
        let turn_response = client
            .post(format!("{service_base_url}/rpc"))
            .json(&turn_request)
            .send()
            .await
            .expect("send turn request");
        assert_eq!(turn_response.status(), reqwest::StatusCode::OK);
        let turn_payload: Value = turn_response.json().await.expect("parse turn response");
        assert_eq!(turn_payload["ok"], Value::Bool(true));
        assert_eq!(turn_payload["result"]["accepted"], Value::Bool(true));

        let mut socket = open_runtime_ws(service_base_url.as_str(), Some("lastEventId=1")).await;
        let _ = read_ws_json(&mut socket).await;

        let mut saw_delta = false;
        let mut saw_completed = false;
        for _ in 0..12 {
            let message = read_ws_json(&mut socket).await;
            if message["type"] != Value::String("runtime.event".to_string()) {
                continue;
            }
            assert!(message["eventId"]
                .as_u64()
                .is_some_and(|event_id| event_id > 1));
            let kind = message["event"]["kind"].as_str().unwrap_or_default();
            if kind == "item.agentMessage.delta" {
                saw_delta = true;
            }
            if kind == "turn.completed" {
                saw_completed = true;
            }
            if saw_delta && saw_completed {
                break;
            }
        }

        assert!(saw_delta);
        assert!(saw_completed);

        compat_handle.abort();
        service_handle.abort();
    }

    #[tokio::test]
    async fn ws_route_replies_to_ping_messages() {
        let (service_base_url, service_handle) =
            spawn_runtime_service_server(test_service_config()).await;
        let mut socket = open_runtime_ws(service_base_url.as_str(), None).await;
        let _ = read_ws_json(&mut socket).await;

        socket
            .send(TungsteniteMessage::Text(
                json!({
                    "type": "ping",
                    "id": "ws-ping",
                })
                .to_string()
                .into(),
            ))
            .await
            .expect("send websocket ping request");
        let pong = read_ws_json(&mut socket).await;
        assert_eq!(pong["type"], Value::String("pong".to_string()));
        assert_eq!(pong["id"], Value::String("ws-ping".to_string()));
        assert!(pong["timestamp"].as_u64().is_some());

        service_handle.abort();
    }

    #[tokio::test]
    async fn ws_route_updates_readiness_diagnostics_for_connection_lifecycle() {
        let (service_base_url, service_handle) =
            spawn_runtime_service_server(test_service_config()).await;
        let client = reqwest::Client::new();
        let baseline = fetch_ready_payload(service_base_url.as_str(), &client).await;
        let baseline_opened = baseline["runtimeDiagnostics"]["wsConnectionsOpenedTotal"]
            .as_u64()
            .unwrap_or(0);
        let baseline_closed = baseline["runtimeDiagnostics"]["wsConnectionsClosedTotal"]
            .as_u64()
            .unwrap_or(0);
        let baseline_protocol_errors = baseline["runtimeDiagnostics"]["wsProtocolErrorsTotal"]
            .as_u64()
            .unwrap_or(0);

        let mut socket = open_runtime_ws(service_base_url.as_str(), None).await;
        let _ = read_ws_json(&mut socket).await;
        socket
            .send(TungsteniteMessage::Text("not-json".to_string().into()))
            .await
            .expect("send invalid websocket json message");
        let protocol_error = read_ws_json(&mut socket).await;
        assert_eq!(protocol_error["type"], Value::String("error".to_string()));
        socket.close(None).await.expect("close websocket");

        let mut after = fetch_ready_payload(service_base_url.as_str(), &client).await;
        for _ in 0..20 {
            if after["runtimeDiagnostics"]["wsConnectionsActive"] == Value::Number(0.into()) {
                break;
            }
            tokio::time::sleep(Duration::from_millis(25)).await;
            after = fetch_ready_payload(service_base_url.as_str(), &client).await;
        }

        assert!(
            after["runtimeDiagnostics"]["wsConnectionsOpenedTotal"]
                .as_u64()
                .unwrap_or(0)
                > baseline_opened
        );
        assert!(
            after["runtimeDiagnostics"]["wsConnectionsClosedTotal"]
                .as_u64()
                .unwrap_or(0)
                > baseline_closed
        );
        assert_eq!(
            after["runtimeDiagnostics"]["wsConnectionsActive"],
            Value::Number(0.into())
        );
        assert!(
            after["runtimeDiagnostics"]["wsProtocolErrorsTotal"]
                .as_u64()
                .unwrap_or(0)
                > baseline_protocol_errors
        );

        service_handle.abort();
    }

    #[tokio::test]
    async fn ws_route_enforces_connection_capacity_limits() {
        let mut config = test_service_config();
        config.ws_max_connections = 1;
        let (service_base_url, service_handle) = spawn_runtime_service_server(config).await;
        let client = reqwest::Client::new();
        let baseline = fetch_ready_payload(service_base_url.as_str(), &client).await;
        let baseline_rejected = baseline["runtimeDiagnostics"]["wsConnectionsRejectedTotal"]
            .as_u64()
            .unwrap_or(0);

        let mut first_socket = open_runtime_ws(service_base_url.as_str(), None).await;
        let _ = read_ws_json(&mut first_socket).await;

        let mut while_active = fetch_ready_payload(service_base_url.as_str(), &client).await;
        for _ in 0..20 {
            if while_active["runtimeDiagnostics"]["wsConnectionSlotsAvailable"]
                == Value::Number(0.into())
            {
                break;
            }
            tokio::time::sleep(Duration::from_millis(25)).await;
            while_active = fetch_ready_payload(service_base_url.as_str(), &client).await;
        }
        assert_eq!(
            while_active["runtimeDiagnostics"]["wsConnectionSlotsMax"],
            Value::Number(1.into())
        );
        assert_eq!(
            while_active["runtimeDiagnostics"]["wsConnectionSlotsAvailable"],
            Value::Number(0.into())
        );

        let mut ws_url = service_base_url.replacen("http://", "ws://", 1);
        ws_url.push_str(CODE_RUNTIME_RPC_TRANSPORT_WS_PATH);
        let request = ws_url
            .into_client_request()
            .expect("build second runtime ws request");
        let second_attempt = connect_async(request).await;
        match second_attempt {
            Err(tokio_tungstenite::tungstenite::Error::Http(response)) => {
                assert_eq!(response.status(), reqwest::StatusCode::SERVICE_UNAVAILABLE);
            }
            Ok((_socket, response)) => {
                panic!(
                    "expected websocket capacity rejection, got upgrade status {}",
                    response.status()
                );
            }
            Err(other) => {
                panic!("expected websocket HTTP rejection, got {other:?}");
            }
        }

        let rejection_response = client
            .get(format!(
                "{service_base_url}{CODE_RUNTIME_RPC_TRANSPORT_WS_PATH}"
            ))
            .header("Connection", "Upgrade")
            .header("Upgrade", "websocket")
            .header("Sec-WebSocket-Version", "13")
            .header("Sec-WebSocket-Key", "dGhlIHNhbXBsZSBub25jZQ==")
            .send()
            .await
            .expect("send websocket capacity rejection probe");
        assert_eq!(
            rejection_response.status(),
            reqwest::StatusCode::SERVICE_UNAVAILABLE
        );
        assert_eq!(
            rejection_response
                .headers()
                .get("retry-after")
                .and_then(|value| value.to_str().ok()),
            Some(WS_CONNECTION_LIMIT_RETRY_AFTER_SECONDS)
        );
        assert_eq!(
            rejection_response
                .headers()
                .get("cache-control")
                .and_then(|value| value.to_str().ok()),
            Some(WS_CONNECTION_LIMIT_CACHE_CONTROL)
        );
        let rejection_payload: Value = rejection_response
            .json()
            .await
            .expect("parse ws rejection payload");
        assert_eq!(
            rejection_payload["error"]["code"],
            Value::String("WS_CONNECTION_LIMIT_REACHED".to_string())
        );
        assert_eq!(
            rejection_payload["details"]["maxConnections"],
            Value::Number(1.into())
        );
        assert_eq!(
            rejection_payload["details"]["availableSlots"],
            Value::Number(0.into())
        );

        let after_rejection = fetch_ready_payload(service_base_url.as_str(), &client).await;
        assert!(
            after_rejection["runtimeDiagnostics"]["wsConnectionsRejectedTotal"]
                .as_u64()
                .unwrap_or(0)
                > baseline_rejected
        );

        first_socket
            .close(None)
            .await
            .expect("close first websocket");

        let mut after_close = fetch_ready_payload(service_base_url.as_str(), &client).await;
        for _ in 0..20 {
            if after_close["runtimeDiagnostics"]["wsConnectionsActive"] == Value::Number(0.into())
                && after_close["runtimeDiagnostics"]["wsConnectionSlotsAvailable"]
                    == Value::Number(1.into())
            {
                break;
            }
            tokio::time::sleep(Duration::from_millis(25)).await;
            after_close = fetch_ready_payload(service_base_url.as_str(), &client).await;
        }
        assert_eq!(
            after_close["runtimeDiagnostics"]["wsConnectionsActive"],
            Value::Number(0.into())
        );
        assert_eq!(
            after_close["runtimeDiagnostics"]["wsConnectionSlotsAvailable"],
            Value::Number(1.into())
        );

        service_handle.abort();
    }

    #[tokio::test]
    async fn ws_route_rejects_invalid_json_messages() {
        let (service_base_url, service_handle) =
            spawn_runtime_service_server(test_service_config()).await;
        let mut socket = open_runtime_ws(service_base_url.as_str(), None).await;
        let _ = read_ws_json(&mut socket).await;

        socket
            .send(TungsteniteMessage::Text("not-json".to_string().into()))
            .await
            .expect("send invalid websocket json message");
        let error = read_ws_json(&mut socket).await;
        assert_eq!(error["type"], Value::String("error".to_string()));
        assert_eq!(
            error["error"]["code"],
            Value::String("INVALID_MESSAGE".to_string())
        );
        assert_eq!(
            error["error"]["message"],
            Value::String("WebSocket payload must be valid JSON.".to_string())
        );

        service_handle.abort();
    }

    #[tokio::test]
    async fn ws_route_enforces_max_message_size() {
        let (service_base_url, service_handle) =
            spawn_runtime_service_server(test_service_config()).await;
        let mut socket = open_runtime_ws(service_base_url.as_str(), None).await;
        let _ = read_ws_json(&mut socket).await;

        let oversized_id = "x".repeat(DEFAULT_RUNTIME_WS_MAX_MESSAGE_SIZE_BYTES + 256);
        let oversized_payload = json!({
            "type": "ping",
            "id": oversized_id,
        })
        .to_string();

        let send_result = socket
            .send(TungsteniteMessage::Text(oversized_payload.into()))
            .await;
        if send_result.is_err() {
            service_handle.abort();
            return;
        }

        let maybe_message = tokio::time::timeout(
            Duration::from_secs(5),
            futures_util::StreamExt::next(&mut socket),
        )
        .await
        .expect("receive websocket close/error after oversized payload");
        match maybe_message {
            Some(Ok(TungsteniteMessage::Close(_))) | Some(Err(_)) => {}
            Some(Ok(other)) => {
                panic!("expected websocket close after oversized payload, got {other:?}");
            }
            None => {}
        }

        service_handle.abort();
    }

    #[tokio::test]
    async fn turn_send_routes_claude_model_to_anthropic_provider() {
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
                      "workspaceId":"workspace-web",
                      "threadId":"thread-claude",
                      "content":"Ping Claude",
                      "modelId":"claude-sonnet-4-5",
                      "reasonEffort":"high",
                      "accessMode":"on-request",
                      "executionMode": "runtime",
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
        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(
            payload["result"]["routedProvider"],
            Value::String("anthropic".to_string())
        );
        assert_eq!(
            payload["result"]["routedPool"],
            Value::String("claude".to_string())
        );
    }

    #[tokio::test]
    async fn turn_send_accepts_explicit_local_claude_provider() {
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
                      "workspaceId":"workspace-web",
                      "threadId":"thread-claude-local",
                      "content":"Ping local Claude",
                      "provider":"claude_code_local",
                      "modelId":"claude-sonnet-4-5",
                      "reasonEffort":"high",
                      "accessMode":"on-request",
                      "executionMode": "runtime",
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
        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(
            payload["result"]["routedProvider"],
            Value::String("claude_code_local".to_string())
        );
        assert_eq!(payload["result"]["routedPool"], Value::Null);
    }

    #[tokio::test]
    async fn turn_send_routes_provider_hint_without_model_id() {
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
                      "workspaceId":"workspace-web",
                      "threadId":"thread-gemini",
                      "content":"Ping Gemini",
                      "provider":"google",
                      "reasonEffort":"high",
                      "accessMode":"on-request",
                      "executionMode": "runtime",
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
        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(
            payload["result"]["routedProvider"],
            Value::String("google".to_string())
        );
        assert_eq!(
            payload["result"]["routedModelId"],
            Value::String("gemini-3.1-pro".to_string())
        );
    }

    #[tokio::test]
    async fn turn_send_routes_antigravity_provider_hint_as_google_pool() {
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
                      "workspaceId":"workspace-web",
                      "threadId":"thread-antigravity",
                      "content":"Ping Gemini",
                      "provider":"antigravity",
                      "reasonEffort":"high",
                      "accessMode":"on-request",
                      "executionMode": "runtime",
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
        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(
            payload["result"]["routedProvider"],
            Value::String("google".to_string())
        );
        assert_eq!(
            payload["result"]["routedPool"],
            Value::String("gemini".to_string())
        );
        assert_eq!(
            payload["result"]["routedModelId"],
            Value::String("gemini-3.1-pro".to_string())
        );
    }

    #[tokio::test]
    async fn turn_send_falls_back_to_chat_completions_when_responses_scope_missing() {
        let (openai_base_url, responses_counter, chat_counter, openai_handle) =
            spawn_openai_scope_fallback_mock_server(Some("local-codex-token")).await;
        let mut config = test_service_config();
        config.openai_api_key = Some("local-codex-token".to_string());
        config.openai_endpoint = format!("{openai_base_url}/responses");
        let app = test_router_with_config(config);
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_turn_send",
                  "params":{
                    "payload":{
                      "workspaceId":"workspace-web",
                      "threadId":"thread-openai-scope-fallback",
                      "content":"Ping OpenAI",
                      "modelId":"gpt-5.3-codex",
                      "reasonEffort":"high",
                      "accessMode":"on-request",
                      "executionMode": "runtime",
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
        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(payload["result"]["accepted"], Value::Bool(true));
        assert_eq!(
            payload["result"]["routedProvider"],
            Value::String("openai".to_string())
        );
        assert_eq!(
            payload["result"]["message"],
            Value::String("Turn accepted.".to_string())
        );
        for _ in 0..20 {
            if responses_counter.load(AtomicOrdering::Relaxed) >= 1
                && chat_counter.load(AtomicOrdering::Relaxed) >= 1
            {
                break;
            }
            tokio::time::sleep(Duration::from_millis(25)).await;
        }
        openai_handle.abort();
        assert_eq!(responses_counter.load(AtomicOrdering::Relaxed), 1);
        assert_eq!(chat_counter.load(AtomicOrdering::Relaxed), 1);
    }

    #[tokio::test]
    async fn turn_send_scope_fallback_omits_reasoning_field_for_chat_completions() {
        let (openai_base_url, responses_counter, chat_counter, openai_handle) =
            spawn_openai_scope_fallback_reasoning_sensitive_mock_server(Some("local-codex-token"))
                .await;
        let mut config = test_service_config();
        config.openai_api_key = Some("local-codex-token".to_string());
        config.openai_endpoint = format!("{openai_base_url}/responses");
        let app = test_router_with_config(config);
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_turn_send",
                  "params":{
                    "payload":{
                      "workspaceId":"workspace-web",
                      "threadId":"thread-openai-scope-fallback-reasoning",
                      "content":"Ping OpenAI",
                      "modelId":"gpt-5.3-codex",
                      "reasonEffort":"high",
                      "accessMode":"on-request",
                      "executionMode": "runtime",
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
        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(payload["result"]["accepted"], Value::Bool(true));
        assert_eq!(
            payload["result"]["message"],
            Value::String("Turn accepted.".to_string())
        );
        for _ in 0..20 {
            if responses_counter.load(AtomicOrdering::Relaxed) >= 1
                && chat_counter.load(AtomicOrdering::Relaxed) >= 1
            {
                break;
            }
            tokio::time::sleep(Duration::from_millis(25)).await;
        }
        openai_handle.abort();
        assert_eq!(responses_counter.load(AtomicOrdering::Relaxed), 1);
        assert_eq!(chat_counter.load(AtomicOrdering::Relaxed), 1);
    }

    #[tokio::test]
    async fn query_provider_uses_alternate_credential_when_scope_missing_and_chat_fallback_fails() {
        let (
            openai_base_url,
            primary_responses_counter,
            alternate_responses_counter,
            chat_counter,
            openai_handle,
        ) = spawn_openai_scope_fallback_dual_credential_mock_server(
            "local-codex-primary",
            "local-codex-alternate",
        )
        .await;
        let mut config = test_service_config();
        config.openai_api_key = Some("local-codex-primary".to_string());
        config.openai_endpoint = format!("{openai_base_url}/responses");
        let client = reqwest::Client::builder()
            .timeout(openai_http_timeout(&config))
            .build()
            .expect("build reqwest client");

        let result = query_provider(
            &client,
            &config,
            &TurnProviderRoute::Core(RuntimeProvider::OpenAI),
            None,
            Some("local-codex-primary"),
            Some("local-codex-alternate"),
            None,
            None,
            false,
            None,
            None,
            None,
            "Ping OpenAI",
            "gpt-5.3-codex",
            Some("high"),
            None,
        )
        .await;

        openai_handle.abort();
        assert_eq!(
            result,
            Ok(crate::provider_requests::ProviderQueryResult {
                output: "ok:gpt-5.3-codex:alternate".to_string(),
                response_model_id: None,
            })
        );
        assert_eq!(primary_responses_counter.load(AtomicOrdering::Relaxed), 1);
        assert_eq!(alternate_responses_counter.load(AtomicOrdering::Relaxed), 1);
        assert_eq!(chat_counter.load(AtomicOrdering::Relaxed), 0);
    }

    #[tokio::test]
    async fn turn_send_provider_only_prefers_compat_discovered_default_model() {
        let (compat_base_url, compat_handle) = spawn_openai_compat_mock_server(
            vec!["claude-3-7-sonnet-latest", "gemini-3-flash", "gpt-4.1-mini"],
            Some("compat-test-key"),
        )
        .await;
        let config = test_service_config_with_openai_compat(compat_base_url.as_str());
        let app = test_router_with_config(config);
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_turn_send",
                  "params":{
                    "payload":{
                      "workspaceId":"workspace-web",
                      "threadId":"thread-compat-claude-provider-only",
                      "content":"Ping Claude",
                      "provider":"anthropic",
                      "reasonEffort":"high",
                      "accessMode":"on-request",
                      "executionMode": "runtime",
                      "queue": false,
                      "attachments":[]
                    }
                  }
                }"#,
            ))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
        compat_handle.abort();
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(payload["result"]["accepted"], Value::Bool(true));
        assert_eq!(
            payload["result"]["routedProvider"],
            Value::String("anthropic".to_string())
        );
        assert_eq!(
            payload["result"]["routedModelId"],
            Value::String("claude-3-7-sonnet-latest".to_string())
        );
        assert_eq!(
            payload["result"]["message"],
            Value::String("Turn accepted.".to_string())
        );
    }

    #[tokio::test]
    async fn turn_send_provider_only_prefers_compat_default_with_oauth_key_only() {
        let (compat_base_url, compat_handle) = spawn_openai_compat_mock_server(
            vec!["claude-3-7-sonnet-latest", "gemini-3-flash", "gpt-4.1-mini"],
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
                    "accountId":"claude-oauth-routing",
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
            .body(Body::from(
                r#"{
                  "method":"code_turn_send",
                  "params":{
                    "payload":{
                      "workspaceId":"workspace-web",
                      "threadId":"thread-compat-claude-oauth-provider-only",
                      "content":"Ping Claude",
                      "provider":"anthropic",
                      "reasonEffort":"high",
                      "accessMode":"on-request",
                      "executionMode": "runtime",
                      "queue": false,
                      "attachments":[]
                    }
                  }
                }"#,
            ))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
        compat_handle.abort();
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(payload["result"]["accepted"], Value::Bool(true));
        assert_eq!(
            payload["result"]["routedProvider"],
            Value::String("anthropic".to_string())
        );
        assert_eq!(
            payload["result"]["routedModelId"],
            Value::String("claude-3-7-sonnet-latest".to_string())
        );
        assert_eq!(
            payload["result"]["message"],
            Value::String("Turn accepted.".to_string())
        );
    }

    #[tokio::test]
    async fn turn_send_provider_only_supports_account_level_compat_base_url() {
        let (account_base_url, account_handle) = spawn_openai_compat_mock_server(
            vec!["claude-3-7-sonnet-latest", "gemini-3-flash"],
            Some("oauth-route-key"),
        )
        .await;
        let config = test_service_config();
        let app = test_router_with_config(config);

        let upsert_account = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(format!(
                r#"{{
                  "method":"code_oauth_account_upsert",
                  "params":{{
                    "accountId":"claude-oauth-route",
                    "provider":"claude_code",
                    "status":"enabled",
                    "metadata":{{"apiKey":"oauth-route-key","compatBaseUrl":"{}"}}
                  }}
                }}"#,
                account_base_url
            )))
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
            .body(Body::from(
                r#"{
                  "method":"code_turn_send",
                  "params":{
                    "payload":{
                      "workspaceId":"workspace-web",
                      "threadId":"thread-compat-account-route",
                      "content":"Ping Claude",
                      "provider":"anthropic",
                      "reasonEffort":"high",
                      "accessMode":"on-request",
                      "executionMode": "runtime",
                      "queue": false,
                      "attachments":[]
                    }
                  }
                }"#,
            ))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
        account_handle.abort();
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(payload["result"]["accepted"], Value::Bool(true));
        assert_eq!(
            payload["result"]["routedProvider"],
            Value::String("anthropic".to_string())
        );
        assert_eq!(
            payload["result"]["routedSource"],
            Value::String("oauth-account".to_string())
        );
        assert_eq!(
            payload["result"]["routedModelId"],
            Value::String("claude-3-7-sonnet-latest".to_string())
        );
        assert_eq!(
            payload["result"]["message"],
            Value::String("Turn accepted.".to_string())
        );
    }

    #[tokio::test]
    async fn turn_send_provider_only_requires_strict_pool_selection() {
        let (account_base_url, account_handle) = spawn_openai_compat_mock_server(
            vec!["claude-3-7-sonnet-latest", "gemini-3-flash"],
            Some("oauth-route-key"),
        )
        .await;
        let config = test_service_config();
        let app = test_router_with_config(config);

        let upsert_account = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(format!(
                r#"{{
                  "method":"code_oauth_account_upsert",
                  "params":{{
                    "accountId":"claude-oauth-strict-routing",
                    "provider":"claude_code",
                    "status":"enabled",
                    "metadata":{{"apiKey":"oauth-route-key","compatBaseUrl":"{}"}}
                  }}
                }}"#,
                account_base_url
            )))
            .expect("build upsert account request");
        let upsert_response = app
            .clone()
            .oneshot(upsert_account)
            .await
            .expect("oauth account upsert response");
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
                r#"{
                  "method":"code_turn_send",
                  "params":{
                    "payload":{
                      "workspaceId":"workspace-web",
                      "threadId":"thread-strict-pool-required",
                      "content":"Ping Claude",
                      "provider":"anthropic",
                      "reasonEffort":"high",
                      "accessMode":"on-request",
                      "executionMode": "runtime",
                      "queue": false,
                      "attachments":[]
                    }
                  }
                }"#,
            ))
            .expect("build request");
        let response = app.clone().oneshot(request).await.expect("rpc response");
        account_handle.abort();
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(payload["result"]["accepted"], Value::Bool(true));
        assert_eq!(
            payload["result"]["message"],
            Value::String("Turn accepted.".to_string())
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
            ready_payload["runtimeDiagnostics"]["oauthRoutingPoolNotFoundTotal"]
                .as_u64()
                .unwrap_or(0)
                >= 1
        );
    }

    #[tokio::test]
    async fn turn_send_provider_only_default_model_resolution_uses_strict_pool_credentials() {
        let (global_base_url, global_handle) =
            spawn_openai_compat_mock_server(vec!["claude-3-haiku-latest"], Some("compat-test-key"))
                .await;
        let (account_base_url, account_handle) =
            spawn_openai_compat_mock_server(vec!["claude-opus-4-6"], Some("oauth-route-key")).await;
        let config = test_service_config_with_openai_compat(global_base_url.as_str());
        let app = test_router_with_config(config);

        let upsert_account = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(format!(
                r#"{{
                  "method":"code_oauth_account_upsert",
                  "params":{{
                    "accountId":"claude-oauth-default-model-hint",
                    "provider":"claude_code",
                    "status":"enabled",
                    "metadata":{{"apiKey":"oauth-route-key","compatBaseUrl":"{}"}}
                  }}
                }}"#,
                account_base_url
            )))
            .expect("build upsert account request");
        let upsert_response = app
            .clone()
            .oneshot(upsert_account)
            .await
            .expect("oauth account upsert response");
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
                r#"{
                  "method":"code_turn_send",
                  "params":{
                    "payload":{
                      "workspaceId":"workspace-web",
                      "threadId":"thread-strict-default-model",
                      "content":"Ping Claude",
                      "provider":"anthropic",
                      "reasonEffort":"high",
                      "accessMode":"on-request",
                      "executionMode": "runtime",
                      "queue": false,
                      "attachments":[]
                    }
                  }
                }"#,
            ))
            .expect("build request");
        let response = app.clone().oneshot(request).await.expect("rpc response");
        account_handle.abort();
        global_handle.abort();
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(payload["result"]["accepted"], Value::Bool(true));
        assert_eq!(
            payload["result"]["routedModelId"],
            Value::String("claude-3-haiku-latest".to_string())
        );
        assert_eq!(
            payload["result"]["message"],
            Value::String("Turn accepted.".to_string())
        );
    }

    #[tokio::test]
    async fn compat_model_catalog_cache_is_scoped_by_base_url() {
        let (global_base_url, global_handle) = spawn_openai_compat_mock_server(
            vec!["claude-sonnet-4-5", "gemini-3-flash", "gpt-4.1-mini"],
            Some("compat-global-key"),
        )
        .await;
        let (account_base_url, account_handle) = spawn_openai_compat_mock_server(
            vec!["claude-opus-4-6-thinking", "gemini-3-flash"],
            Some("oauth-route-key"),
        )
        .await;

        let mut config = test_service_config_with_openai_compat(global_base_url.as_str());
        config.openai_compat_api_key = Some("compat-global-key".to_string());
        let app = test_router_with_config(config);

        let upsert_enabled = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(format!(
                r#"{{
                  "method":"code_oauth_account_upsert",
                  "params":{{
                    "accountId":"claude-cache-route",
                    "provider":"claude_code",
                    "status":"enabled",
                    "metadata":{{"apiKey":"oauth-route-key","compatBaseUrl":"{}"}}
                  }}
                }}"#,
                account_base_url
            )))
            .expect("build enabled account request");
        let enabled_response = app
            .clone()
            .oneshot(upsert_enabled)
            .await
            .expect("enable account response");
        assert_eq!(enabled_response.status(), StatusCode::OK);

        let first_turn = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_turn_send",
                  "params":{
                    "payload":{
                      "workspaceId":"workspace-web",
                      "threadId":"thread-cache-account-route",
                      "content":"Ping account route",
                      "provider":"anthropic",
                      "reasonEffort":"high",
                      "accessMode":"on-request",
                      "executionMode": "runtime",
                      "queue": false,
                      "attachments":[]
                    }
                  }
                }"#,
            ))
            .expect("build account route request");
        let first_response = app
            .clone()
            .oneshot(first_turn)
            .await
            .expect("first turn response");
        assert_eq!(first_response.status(), StatusCode::OK);
        let first_bytes = axum::body::to_bytes(first_response.into_body(), 1024 * 1024)
            .await
            .expect("read first response body");
        let first_payload: Value = serde_json::from_slice(&first_bytes).expect("parse first json");
        assert_eq!(first_payload["ok"], Value::Bool(true));
        assert_eq!(
            first_payload["result"]["routedModelId"],
            Value::String("claude-opus-4-6-thinking".to_string())
        );

        let upsert_disabled = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(format!(
                r#"{{
                  "method":"code_oauth_account_upsert",
                  "params":{{
                    "accountId":"claude-cache-route",
                    "provider":"claude_code",
                    "status":"disabled",
                    "metadata":{{"apiKey":"oauth-route-key","compatBaseUrl":"{}"}}
                  }}
                }}"#,
                account_base_url
            )))
            .expect("build disabled account request");
        let disabled_response = app
            .clone()
            .oneshot(upsert_disabled)
            .await
            .expect("disable account response");
        assert_eq!(disabled_response.status(), StatusCode::OK);

        let second_turn = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_turn_send",
                  "params":{
                    "payload":{
                      "workspaceId":"workspace-web",
                      "threadId":"thread-cache-global-route",
                      "content":"Ping global route",
                      "provider":"anthropic",
                      "reasonEffort":"high",
                      "accessMode":"on-request",
                      "executionMode": "runtime",
                      "queue": false,
                      "attachments":[]
                    }
                  }
                }"#,
            ))
            .expect("build global route request");
        let second_response = app
            .clone()
            .oneshot(second_turn)
            .await
            .expect("second turn response");
        assert_eq!(second_response.status(), StatusCode::OK);
        let second_bytes = axum::body::to_bytes(second_response.into_body(), 1024 * 1024)
            .await
            .expect("read second response body");
        let second_payload: Value =
            serde_json::from_slice(&second_bytes).expect("parse second json");
        assert_eq!(second_payload["ok"], Value::Bool(true));
        assert_eq!(
            second_payload["result"]["routedModelId"],
            Value::String("claude-sonnet-4-5".to_string())
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
            ready_payload["runtimeDiagnostics"]["compatModelCatalogCacheEntries"]
                .as_u64()
                .unwrap_or(0)
                >= 2
        );
        global_handle.abort();
        account_handle.abort();
    }

    #[tokio::test]
    async fn compat_model_catalog_cache_is_scoped_by_api_key_for_same_base_url() {
        let (compat_base_url, models_counter, compat_handle) =
            spawn_openai_compat_mock_server_with_counter(
                vec!["claude-sonnet-4-5", "gemini-3-flash", "gpt-4.1-mini"],
                None,
                None,
            )
            .await;
        let mut config = test_service_config_with_openai_compat(compat_base_url.as_str());
        config.openai_compat_api_key = Some("compat-global-key".to_string());
        let app = test_router_with_config(config);

        let upsert_enabled = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(format!(
                r#"{{
                  "method":"code_oauth_account_upsert",
                  "params":{{
                    "accountId":"claude-same-base-cache-route",
                    "provider":"claude_code",
                    "status":"enabled",
                    "metadata":{{"apiKey":"oauth-route-key","compatBaseUrl":"{}"}}
                  }}
                }}"#,
                compat_base_url
            )))
            .expect("build enabled account request");
        let enabled_response = app
            .clone()
            .oneshot(upsert_enabled)
            .await
            .expect("enable account response");
        assert_eq!(enabled_response.status(), StatusCode::OK);

        let first_turn = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_turn_send",
                  "params":{
                    "payload":{
                      "workspaceId":"workspace-web",
                      "threadId":"thread-cache-oauth-key",
                      "content":"Ping oauth key route",
                      "provider":"anthropic",
                      "reasonEffort":"high",
                      "accessMode":"on-request",
                      "executionMode": "runtime",
                      "queue": false,
                      "attachments":[]
                    }
                  }
                }"#,
            ))
            .expect("build first turn request");
        let first_response = app
            .clone()
            .oneshot(first_turn)
            .await
            .expect("first turn response");
        assert_eq!(first_response.status(), StatusCode::OK);
        let first_bytes = axum::body::to_bytes(first_response.into_body(), 1024 * 1024)
            .await
            .expect("read first response body");
        let first_payload: Value = serde_json::from_slice(&first_bytes).expect("parse first json");
        assert_eq!(first_payload["ok"], Value::Bool(true));
        assert_eq!(first_payload["result"]["accepted"], Value::Bool(true));

        let upsert_disabled = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(format!(
                r#"{{
                  "method":"code_oauth_account_upsert",
                  "params":{{
                    "accountId":"claude-same-base-cache-route",
                    "provider":"claude_code",
                    "status":"disabled",
                    "metadata":{{"apiKey":"oauth-route-key","compatBaseUrl":"{}"}}
                  }}
                }}"#,
                compat_base_url
            )))
            .expect("build disabled account request");
        let disabled_response = app
            .clone()
            .oneshot(upsert_disabled)
            .await
            .expect("disable account response");
        assert_eq!(disabled_response.status(), StatusCode::OK);

        let second_turn = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_turn_send",
                  "params":{
                    "payload":{
                      "workspaceId":"workspace-web",
                      "threadId":"thread-cache-global-key",
                      "content":"Ping global key route",
                      "provider":"anthropic",
                      "reasonEffort":"high",
                      "accessMode":"on-request",
                      "executionMode": "runtime",
                      "queue": false,
                      "attachments":[]
                    }
                  }
                }"#,
            ))
            .expect("build second turn request");
        let second_response = app
            .clone()
            .oneshot(second_turn)
            .await
            .expect("second turn response");
        assert_eq!(second_response.status(), StatusCode::OK);
        let second_bytes = axum::body::to_bytes(second_response.into_body(), 1024 * 1024)
            .await
            .expect("read second response body");
        let second_payload: Value =
            serde_json::from_slice(&second_bytes).expect("parse second json");
        assert_eq!(second_payload["ok"], Value::Bool(true));
        assert_eq!(second_payload["result"]["accepted"], Value::Bool(true));

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
            ready_payload["runtimeDiagnostics"]["compatModelCatalogCacheEntries"]
                .as_u64()
                .unwrap_or(0)
                >= 2
        );

        let models_calls = models_counter.load(AtomicOrdering::Relaxed);
        compat_handle.abort();
        assert_eq!(models_calls, 2);
    }

    #[tokio::test]
    async fn turn_send_provider_only_prefers_non_experimental_gemini_model() {
        let (compat_base_url, compat_handle) = spawn_openai_compat_mock_server(
            vec![
                "gemini-2.0-flash-exp",
                "gemini-2.5-flash",
                "gemini-3-flash",
                "claude-sonnet-4-5",
            ],
            Some("compat-test-key"),
        )
        .await;
        let config = test_service_config_with_openai_compat(compat_base_url.as_str());
        let app = test_router_with_config(config);
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_turn_send",
                  "params":{
                    "payload":{
                      "workspaceId":"workspace-web",
                      "threadId":"thread-compat-gemini-provider-only",
                      "content":"Ping Gemini",
                      "provider":"google",
                      "reasonEffort":"high",
                      "accessMode":"on-request",
                      "executionMode": "runtime",
                      "queue": false,
                      "attachments":[]
                    }
                  }
                }"#,
            ))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
        compat_handle.abort();
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(payload["result"]["accepted"], Value::Bool(true));
        assert_eq!(
            payload["result"]["routedProvider"],
            Value::String("google".to_string())
        );
        assert_eq!(
            payload["result"]["routedModelId"],
            Value::String("gemini-3-flash".to_string())
        );
        assert_eq!(
            payload["result"]["message"],
            Value::String("Turn accepted.".to_string())
        );
    }

    #[tokio::test]
    async fn turn_send_provider_only_prefers_stable_defaults_from_realistic_gateway_catalog() {
        let (compat_base_url, compat_handle) = spawn_openai_compat_mock_server(
            vec![
                "gpt-5.3-codex",
                "claude-opus-4-6-thinking",
                "claude-opus-4-6-20260201",
                "claude-sonnet-4-5",
                "gemini-2.5-pro-exp",
                "gemini-2.5-pro",
                "gemini-3-flash",
            ],
            Some("compat-test-key"),
        )
        .await;
        let config = test_service_config_with_openai_compat(compat_base_url.as_str());
        let app = test_router_with_config(config);

        let claude_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_turn_send",
                  "params":{
                    "payload":{
                      "workspaceId":"workspace-web",
                      "threadId":"thread-compat-claude-realistic-catalog",
                      "content":"Ping Claude",
                      "provider":"anthropic",
                      "reasonEffort":"high",
                      "accessMode":"on-request",
                      "executionMode": "runtime",
                      "queue": false,
                      "attachments":[]
                    }
                  }
                }"#,
            ))
            .expect("build claude request");
        let claude_response = app
            .clone()
            .oneshot(claude_request)
            .await
            .expect("claude response");
        assert_eq!(claude_response.status(), StatusCode::OK);
        let claude_bytes = axum::body::to_bytes(claude_response.into_body(), 1024 * 1024)
            .await
            .expect("read claude body");
        let claude_payload: Value = serde_json::from_slice(&claude_bytes).expect("parse claude");
        assert_eq!(claude_payload["ok"], Value::Bool(true));
        assert_eq!(
            claude_payload["result"]["routedModelId"],
            Value::String("claude-sonnet-4-5".to_string())
        );
        assert_eq!(
            claude_payload["result"]["message"],
            Value::String("Turn accepted.".to_string())
        );

        let gemini_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_turn_send",
                  "params":{
                    "payload":{
                      "workspaceId":"workspace-web",
                      "threadId":"thread-compat-gemini-realistic-catalog",
                      "content":"Ping Gemini",
                      "provider":"google",
                      "reasonEffort":"high",
                      "accessMode":"on-request",
                      "executionMode": "runtime",
                      "queue": false,
                      "attachments":[]
                    }
                  }
                }"#,
            ))
            .expect("build gemini request");
        let gemini_response = app.oneshot(gemini_request).await.expect("gemini response");
        compat_handle.abort();
        assert_eq!(gemini_response.status(), StatusCode::OK);
        let gemini_bytes = axum::body::to_bytes(gemini_response.into_body(), 1024 * 1024)
            .await
            .expect("read gemini body");
        let gemini_payload: Value = serde_json::from_slice(&gemini_bytes).expect("parse gemini");
        assert_eq!(gemini_payload["ok"], Value::Bool(true));
        assert_eq!(
            gemini_payload["result"]["routedModelId"],
            Value::String("gemini-2.5-pro".to_string())
        );
        assert_eq!(
            gemini_payload["result"]["message"],
            Value::String("Turn accepted.".to_string())
        );
    }

    #[tokio::test]
    async fn turn_send_compat_routing_prefers_compat_api_key_over_provider_key() {
        let (compat_base_url, compat_handle) = spawn_openai_compat_mock_server(
            vec!["claude-sonnet-4-5", "gemini-3-flash", "gpt-4.1-mini"],
            Some("compat-test-key"),
        )
        .await;
        let mut config = test_service_config_with_openai_compat(compat_base_url.as_str());
        config.anthropic_api_key = Some("anthropic-should-not-be-used".to_string());
        let app = test_router_with_config(config);
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_turn_send",
                  "params":{
                    "payload":{
                      "workspaceId":"workspace-web",
                      "threadId":"thread-compat-key-priority",
                      "content":"Ping Claude",
                      "modelId":"claude-sonnet-4-5",
                      "provider":"anthropic",
                      "reasonEffort":"high",
                      "accessMode":"on-request",
                      "executionMode": "runtime",
                      "queue": false,
                      "attachments":[]
                    }
                  }
                }"#,
            ))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
        compat_handle.abort();
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(payload["result"]["accepted"], Value::Bool(true));
        assert_eq!(
            payload["result"]["message"],
            Value::String("Turn accepted.".to_string())
        );
    }

    #[tokio::test]
    async fn turn_send_rejects_unknown_provider_hint() {
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
                      "workspaceId":"workspace-web",
                      "threadId":"thread-unknown-provider",
                      "content":"Ping",
                      "provider":"unknown-provider",
                      "modelId":"gpt-5.3-codex",
                      "reasonEffort":"high",
                      "accessMode":"on-request",
                      "executionMode": "runtime",
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

    #[tokio::test]
    async fn turn_send_routes_extension_provider_via_openai_compat() {
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
                r#"{
                  "method":"code_turn_send",
                  "params":{
                    "payload":{
                      "workspaceId":"workspace-web",
                      "threadId":"thread-extension-provider",
                      "content":"Ping extension",
                      "provider":"deepseek",
                      "reasonEffort":"high",
                      "accessMode":"on-request",
                      "executionMode": "runtime",
                      "queue": false,
                      "attachments":[]
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
        assert_eq!(payload["result"]["accepted"], Value::Bool(true));
        assert_eq!(
            payload["result"]["routedProvider"],
            Value::String("deepseek".to_string())
        );
        assert_eq!(
            payload["result"]["routedPool"],
            Value::String("deepseek".to_string())
        );
        assert_eq!(
            payload["result"]["routedModelId"],
            Value::String("deepseek-chat".to_string())
        );
        assert_eq!(
            payload["result"]["message"],
            Value::String("Turn accepted.".to_string())
        );
    }

    #[tokio::test]
    async fn turn_send_model_only_routes_extension_provider_via_model_hint() {
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
                r#"{
                  "method":"code_turn_send",
                  "params":{
                    "payload":{
                      "workspaceId":"workspace-web",
                      "threadId":"thread-extension-model-hint",
                      "content":"Ping extension by model",
                      "modelId":"deepseek-chat",
                      "reasonEffort":"high",
                      "accessMode":"on-request",
                      "executionMode": "runtime",
                      "queue": false,
                      "attachments":[]
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
            payload["result"]["routedProvider"],
            Value::String("deepseek".to_string())
        );
    }

    #[tokio::test]
    async fn turn_send_rejects_core_provider_hint_for_extension_model() {
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
                r#"{
                  "method":"code_turn_send",
                  "params":{
                    "payload":{
                      "workspaceId":"workspace-web",
                      "threadId":"thread-extension-mismatch",
                      "content":"Ping mismatch",
                      "provider":"openai",
                      "modelId":"deepseek-chat",
                      "reasonEffort":"high",
                      "accessMode":"on-request",
                      "executionMode": "runtime",
                      "queue": false,
                      "attachments":[]
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
        assert_eq!(payload["ok"], Value::Bool(false));
        assert_eq!(
            payload["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );
    }

    #[tokio::test]
    async fn turn_send_extension_provider_without_api_key_fails_fast() {
        let (base_url, handle) = spawn_openai_compat_mock_server(vec!["deepseek-chat"], None).await;
        let mut config = test_service_config();
        let mut extension = test_extension_provider(base_url.as_str(), "deepseek-key");
        extension.api_key = None;
        extension.api_key_env = "DEEPSEEK_API_KEY".to_string();
        config.provider_extension_seeds = vec![extension];
        let app = test_router_with_config(config);
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_turn_send",
                  "params":{
                    "payload":{
                      "workspaceId":"workspace-web",
                      "threadId":"thread-extension-missing-key",
                      "content":"Ping extension without key",
                      "provider":"deepseek",
                      "reasonEffort":"high",
                      "accessMode":"on-request",
                      "executionMode": "runtime",
                      "queue": false,
                      "attachments":[]
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
        assert_eq!(payload["ok"], Value::Bool(false));
        assert_eq!(
            payload["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );
        assert!(
            payload["error"]["message"]
                .as_str()
                .is_some_and(|message| {
                    message.contains("Selected extension provider is not configured with API key.")
                }),
            "unexpected error message: {}",
            payload["error"]["message"]
        );
    }

    #[tokio::test]
    async fn turn_send_routes_extension_provider_via_updated_extension_alias() {
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
                r#"{
                  "method":"code_turn_send",
                  "params":{
                    "payload":{
                      "workspaceId":"workspace-web",
                      "threadId":"thread-extension-provider-updated-alias",
                      "content":"Ping updated extension alias",
                      "provider":"ds-v2",
                      "reasonEffort":"high",
                      "accessMode":"on-request",
                      "executionMode": "runtime",
                      "queue": false,
                      "attachments":[]
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
        assert_eq!(payload["result"]["accepted"], Value::Bool(true));
        assert_eq!(
            payload["result"]["routedProvider"],
            Value::String("deepseek".to_string())
        );
        assert_eq!(
            payload["result"]["routedPool"],
            Value::String("deepseek-v2".to_string())
        );
        assert_eq!(
            payload["result"]["routedModelId"],
            Value::String("deepseek-v2-chat".to_string())
        );
    }

    #[tokio::test]
    async fn turn_send_rejects_provider_model_mismatch() {
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
                      "workspaceId":"workspace-web",
                      "threadId":"thread-provider-model-mismatch",
                      "content":"Ping",
                      "provider":"openai",
                      "modelId":"claude-sonnet-4-5",
                      "reasonEffort":"high",
                      "accessMode":"on-request",
                      "executionMode": "runtime",
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

    #[tokio::test]
    async fn turn_send_rejects_disabled_extension_provider() {
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
                r#"{
                  "method":"code_turn_send",
                  "params":{
                    "payload":{
                      "workspaceId":"workspace-web",
                      "threadId":"thread-extension-disabled-provider",
                      "content":"Ping disabled extension",
                      "provider":"deepseek",
                      "reasonEffort":"high",
                      "accessMode":"on-request",
                      "executionMode": "runtime",
                      "queue": false,
                      "attachments":[]
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
        assert_eq!(payload["ok"], Value::Bool(false));
        assert_eq!(
            payload["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );
    }

    #[tokio::test]
    async fn oauth_account_upsert_and_list_support_canonical_and_snake_case_payloads() {
        let app = test_router();
        let upsert = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{
                    "account_id":"codex-a1",
                    "provider":"codex",
                    "display_name":"Codex A1",
                    "route_config":{
                      "compat_base_url":"https://compat.example.com/v1/",
                      "proxy_id":"proxy-east",
                      "priority":7,
                      "concurrency_limit":3,
                      "schedulable":false
                    },
                    "routing_state":{
                      "credential_ready":false,
                      "last_routing_error":"upstream timeout",
                      "rate_limited_until":123,
                      "overloaded_until":456,
                      "temp_unschedulable_until":789,
                      "temp_unschedulable_reason":"manual drain"
                    },
                    "metadata":{
                      "api_key":"secret-codex-token"
                    }
                  }
                }"#,
            ))
            .expect("build upsert request");
        let upsert_response = app.clone().oneshot(upsert).await.expect("upsert response");
        let upsert_bytes = axum::body::to_bytes(upsert_response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let upsert_payload: Value = serde_json::from_slice(&upsert_bytes).expect("parse json");
        assert_eq!(upsert_payload["ok"], Value::Bool(true));
        assert_eq!(
            upsert_payload["result"]["accountId"],
            Value::String("codex-a1".to_string())
        );
        assert_eq!(
            upsert_payload["result"]["metadata"]["apiKeyConfigured"],
            Value::Bool(true)
        );
        assert_eq!(
            upsert_payload["result"]["metadata"]["compatBaseUrl"],
            Value::String("https://compat.example.com/v1".to_string())
        );
        assert_eq!(
            upsert_payload["result"]["routeConfig"]["proxyId"],
            Value::String("proxy-east".to_string())
        );
        assert_eq!(
            upsert_payload["result"]["routeConfig"]["schedulable"],
            Value::Bool(false)
        );
        assert_eq!(
            upsert_payload["result"]["routingState"]["tempUnschedulableReason"],
            Value::String("manual drain".to_string())
        );
        assert!(upsert_payload["result"]["metadata"]["apiKey"].is_null());
        assert!(upsert_payload["result"]["metadata"]["api_key"].is_null());

        let list = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{"method":"code_oauth_accounts_list","params":{"provider":"codex"}}"#,
            ))
            .expect("build list request");

        let response = app.oneshot(list).await.expect("list response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        let accounts = payload["result"].as_array().expect("accounts array");
        let account = accounts
            .iter()
            .find(|entry| entry["accountId"] == Value::String("codex-a1".to_string()))
            .expect("codex account");
        assert_eq!(account["metadata"]["apiKeyConfigured"], Value::Bool(true));
        assert_eq!(
            account["metadata"]["compatBaseUrl"],
            Value::String("https://compat.example.com/v1".to_string())
        );
        assert_eq!(
            account["routeConfig"]["priority"],
            Value::Number(serde_json::Number::from(7))
        );
        assert_eq!(
            account["routingState"]["credentialReady"],
            Value::Bool(false)
        );
        assert!(account["metadata"]["apiKey"].is_null());
        assert!(account["metadata"]["api_key"].is_null());
    }

    #[tokio::test]
    async fn oauth_account_upsert_and_list_accept_antigravity_provider_alias() {
        let app = test_router();
        let upsert = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{
                    "accountId":"gemini-anti-gravity-a1",
                    "provider":"anti-gravity",
                    "displayName":"Gemini Anti Gravity A1",
                    "metadata":{"api_key":"secret-gemini-token"}
                  }
                }"#,
            ))
            .expect("build upsert request");

        let upsert_response = app.clone().oneshot(upsert).await.expect("upsert response");
        let upsert_bytes = axum::body::to_bytes(upsert_response.into_body(), 1024 * 1024)
            .await
            .expect("read upsert body");
        let upsert_payload: Value = serde_json::from_slice(&upsert_bytes).expect("parse upsert");
        assert_eq!(upsert_payload["ok"], Value::Bool(true));
        assert_eq!(
            upsert_payload["result"]["provider"],
            Value::String("gemini".to_string())
        );

        let list = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{"method":"code_oauth_accounts_list","params":{"provider":"google"}}"#,
            ))
            .expect("build list request");

        let response = app.oneshot(list).await.expect("list response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read list body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse list");
        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(
            payload["result"][0]["provider"],
            Value::String("gemini".to_string())
        );
    }

    #[tokio::test]
    async fn oauth_account_upsert_and_list_support_chatgpt_workspace_memberships() {
        let app = test_router();
        let upsert = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{
                    "accountId":"codex-workspaces-a1",
                    "provider":"codex",
                    "chatgpt_workspaces":[
                      {
                        "workspace_id":"org-default",
                        "title":"Default Org",
                        "role":"owner",
                        "is_default":true
                      },
                      {
                        "workspace_id":"org-shared",
                        "title":"Shared Org",
                        "role":"member",
                        "is_default":false
                      }
                    ],
                    "default_chatgpt_workspace_id":"org-default",
                    "metadata":{
                      "api_key":"secret-codex-token"
                    }
                  }
                }"#,
            ))
            .expect("build upsert request");
        let upsert_response = app.clone().oneshot(upsert).await.expect("upsert response");
        let upsert_bytes = axum::body::to_bytes(upsert_response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let upsert_payload: Value = serde_json::from_slice(&upsert_bytes).expect("parse json");
        assert_eq!(upsert_payload["ok"], Value::Bool(true));
        assert_eq!(
            upsert_payload["result"]["defaultChatgptWorkspaceId"],
            Value::String("org-default".to_string())
        );
        assert_eq!(
            upsert_payload["result"]["chatgptWorkspaces"][0]["workspaceId"],
            Value::String("org-default".to_string())
        );

        let list = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{"method":"code_oauth_accounts_list","params":{"provider":"codex"}}"#,
            ))
            .expect("build list request");
        let response = app.oneshot(list).await.expect("list response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        let accounts = payload["result"].as_array().expect("accounts array");
        let account = accounts
            .iter()
            .find(|entry| entry["accountId"] == Value::String("codex-workspaces-a1".to_string()))
            .expect("workspace aware account");
        assert_eq!(
            account["defaultChatgptWorkspaceId"],
            Value::String("org-default".to_string())
        );
        assert_eq!(
            account["chatgptWorkspaces"][1]["workspaceId"],
            Value::String("org-shared".to_string())
        );
    }

    #[tokio::test]
    async fn oauth_account_upsert_rejects_non_object_metadata() {
        let app = test_router();
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{
                    "accountId":"codex-invalid-metadata",
                    "provider":"codex",
                    "metadata":"not-an-object"
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
        let message = payload["error"]["message"].as_str().unwrap_or_default();
        assert!(message.contains("metadata"));
    }

    #[tokio::test]
    async fn oauth_account_upsert_rejects_reserved_encrypted_metadata_field() {
        let app = test_router();
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{
                    "accountId":"codex-reserved-encrypted-key",
                    "provider":"codex",
                    "metadata":{"apiKeyEncryptedV1":"tampered-ciphertext"}
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
        let message = payload["error"]["message"].as_str().unwrap_or_default();
        assert!(message.contains("apiKeyEncryptedV1"));
        assert!(message.contains("reserved"));
    }

    #[tokio::test]
    async fn oauth_account_upsert_reserved_metadata_rejection_updates_runtime_diagnostics() {
        let app = test_router();
        let upsert_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{
                    "accountId":"codex-reserved-encrypted-key",
                    "provider":"codex",
                    "metadata":{"apiKeyEncryptedV1":"tampered-ciphertext"}
                  }
                }"#,
            ))
            .expect("build upsert request");
        let upsert_response = app
            .clone()
            .oneshot(upsert_request)
            .await
            .expect("upsert response");
        assert_eq!(upsert_response.status(), StatusCode::OK);

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
        assert_eq!(
            ready_payload["runtimeDiagnostics"]["oauthReservedMetadataRejectionsTotal"],
            Value::Number(serde_json::Number::from(1))
        );
    }

    #[tokio::test]
    async fn oauth_account_upsert_requires_oauth_secret_key_for_api_key_storage() {
        let mut config = test_service_config();
        config.oauth_secret_key = None;
        let app = test_router_with_config(config);

        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{
                    "accountId":"codex-missing-secret-key",
                    "provider":"codex",
                    "metadata":{"apiKey":"raw-key"}
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
        let message = payload["error"]["message"].as_str().unwrap_or_default();
        assert!(message.contains("OAUTH_SECRET_KEY"));
    }

    #[tokio::test]
    async fn oauth_account_upsert_without_metadata_preserves_existing_credentials() {
        let (compat_base_url, compat_handle) =
            spawn_openai_compat_mock_server(vec!["gpt-5.3-codex"], Some("oauth-preserved-key"))
                .await;
        let config = test_service_config_with_openai_compat_oauth_only(compat_base_url.as_str());
        let app = test_router_with_config(config);

        let first_upsert = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{
                    "accountId":"codex-preserved",
                    "provider":"codex",
                    "metadata":{"apiKey":"oauth-preserved-key"}
                  }
                }"#,
            ))
            .expect("build first upsert request");
        let first_upsert_response = app
            .clone()
            .oneshot(first_upsert)
            .await
            .expect("first upsert response");
        assert_eq!(first_upsert_response.status(), StatusCode::OK);

        let second_upsert = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{
                    "accountId":"codex-preserved",
                    "provider":"codex",
                    "displayName":"Codex Preserved"
                  }
                }"#,
            ))
            .expect("build second upsert request");
        let second_upsert_response = app
            .clone()
            .oneshot(second_upsert)
            .await
            .expect("second upsert response");
        let second_bytes = axum::body::to_bytes(second_upsert_response.into_body(), 1024 * 1024)
            .await
            .expect("read second upsert body");
        let second_payload: Value =
            serde_json::from_slice(&second_bytes).expect("parse second upsert json");
        assert_eq!(second_payload["ok"], Value::Bool(true));
        assert_eq!(
            second_payload["result"]["metadata"]["apiKeyConfigured"],
            Value::Bool(true)
        );

        let turn_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_turn_send",
                  "params":{
                    "payload":{
                      "workspaceId":"workspace-web",
                      "threadId":"thread-preserved-account-metadata",
                      "content":"Ping preserved key",
                      "provider":"openai",
                      "reasonEffort":"high",
                      "accessMode":"on-request",
                      "executionMode": "runtime",
                      "queue": false,
                      "attachments":[]
                    }
                  }
                }"#,
            ))
            .expect("build turn request");
        let turn_response = app.oneshot(turn_request).await.expect("turn response");
        compat_handle.abort();
        assert_eq!(turn_response.status(), StatusCode::OK);
        let turn_bytes = axum::body::to_bytes(turn_response.into_body(), 1024 * 1024)
            .await
            .expect("read turn body");
        let turn_payload: Value = serde_json::from_slice(&turn_bytes).expect("parse turn json");
        assert_eq!(turn_payload["ok"], Value::Bool(true));
        assert_eq!(turn_payload["result"]["accepted"], Value::Bool(true));
        assert_eq!(
            turn_payload["result"]["routedSource"],
            Value::String("oauth-account".to_string())
        );
    }

    #[tokio::test]
    async fn oauth_primary_account_get_and_set_return_redacted_account_summary() {
        let app = test_router();
        let upsert_payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_oauth_account_upsert",
                "params":{
                    "accountId":"codex-primary-rpc-a1",
                    "provider":"codex",
                    "status":"enabled",
                    "metadata":{"apiKey":"codex-primary-rpc-a1-key"}
                }
            }),
        )
        .await;
        assert_eq!(upsert_payload["ok"], Value::Bool(true));

        let set_payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_oauth_primary_account_set",
                "params":{
                    "provider":"codex",
                    "accountId":"codex-primary-rpc-a1"
                }
            }),
        )
        .await;
        assert_eq!(set_payload["ok"], Value::Bool(true));
        assert_eq!(
            set_payload["result"]["accountId"],
            Value::String("codex-primary-rpc-a1".to_string())
        );
        assert_eq!(
            set_payload["result"]["routeAccountId"],
            Value::String("codex-primary-rpc-a1".to_string())
        );
        assert_eq!(set_payload["result"]["inSync"], Value::Bool(true));
        assert_eq!(
            set_payload["result"]["account"]["metadata"]["apiKeyConfigured"],
            Value::Bool(true)
        );
        assert!(set_payload["result"]["account"]["metadata"]["apiKey"].is_null());

        let get_payload = send_rpc_request(
            app,
            json!({
                "method":"code_oauth_primary_account_get",
                "params":{"provider":"codex"}
            }),
        )
        .await;
        assert_eq!(get_payload["ok"], Value::Bool(true));
        assert_eq!(
            get_payload["result"]["accountId"],
            Value::String("codex-primary-rpc-a1".to_string())
        );
        assert_eq!(
            get_payload["result"]["routeAccountId"],
            Value::String("codex-primary-rpc-a1".to_string())
        );
        assert_eq!(get_payload["result"]["inSync"], Value::Bool(true));
        assert_eq!(
            get_payload["result"]["account"]["metadata"]["apiKeyConfigured"],
            Value::Bool(true)
        );
        assert!(get_payload["result"]["account"]["metadata"]["apiKey"].is_null());
    }

    #[tokio::test]
    async fn oauth_primary_account_reconciles_to_fallback_after_primary_account_remove() {
        let app = test_router();
        for account_id in ["codex-primary-remove-a1", "codex-primary-remove-a2"] {
            let upsert_payload = send_rpc_request(
                app.clone(),
                json!({
                    "method":"code_oauth_account_upsert",
                    "params":{
                        "accountId":account_id,
                        "provider":"codex",
                        "status":"enabled",
                        "metadata":{"apiKey":format!("{account_id}-key")}
                    }
                }),
            )
            .await;
            assert_eq!(upsert_payload["ok"], Value::Bool(true));
        }

        let set_payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_oauth_primary_account_set",
                "params":{
                    "provider":"codex",
                    "accountId":"codex-primary-remove-a1"
                }
            }),
        )
        .await;
        assert_eq!(set_payload["ok"], Value::Bool(true));

        let remove_payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_oauth_account_remove",
                "params":{"accountId":"codex-primary-remove-a1"}
            }),
        )
        .await;
        assert_eq!(remove_payload["ok"], Value::Bool(true));
        assert_eq!(remove_payload["result"], Value::Bool(true));

        let get_payload = send_rpc_request(
            app,
            json!({
                "method":"code_oauth_primary_account_get",
                "params":{"provider":"codex"}
            }),
        )
        .await;
        assert_eq!(get_payload["ok"], Value::Bool(true));
        assert_eq!(
            get_payload["result"]["accountId"],
            Value::String("codex-primary-remove-a2".to_string())
        );
        assert_eq!(
            get_payload["result"]["routeAccountId"],
            Value::String("codex-primary-remove-a2".to_string())
        );
        assert_eq!(get_payload["result"]["inSync"], Value::Bool(true));
    }

    #[tokio::test]
    async fn oauth_primary_account_reconciles_to_fallback_after_primary_account_disabled() {
        let app = test_router();
        for account_id in ["codex-primary-disable-a1", "codex-primary-disable-a2"] {
            let upsert_payload = send_rpc_request(
                app.clone(),
                json!({
                    "method":"code_oauth_account_upsert",
                    "params":{
                        "accountId":account_id,
                        "provider":"codex",
                        "status":"enabled",
                        "metadata":{"apiKey":format!("{account_id}-key")}
                    }
                }),
            )
            .await;
            assert_eq!(upsert_payload["ok"], Value::Bool(true));
        }

        let set_payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_oauth_primary_account_set",
                "params":{
                    "provider":"codex",
                    "accountId":"codex-primary-disable-a1"
                }
            }),
        )
        .await;
        assert_eq!(set_payload["ok"], Value::Bool(true));

        let disable_payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_oauth_account_upsert",
                "params":{
                    "accountId":"codex-primary-disable-a1",
                    "provider":"codex",
                    "status":"disabled",
                    "disabledReason":"manual"
                }
            }),
        )
        .await;
        assert_eq!(disable_payload["ok"], Value::Bool(true));

        let get_payload = send_rpc_request(
            app,
            json!({
                "method":"code_oauth_primary_account_get",
                "params":{"provider":"codex"}
            }),
        )
        .await;
        assert_eq!(get_payload["ok"], Value::Bool(true));
        assert_eq!(
            get_payload["result"]["accountId"],
            Value::String("codex-primary-disable-a2".to_string())
        );
        assert_eq!(
            get_payload["result"]["routeAccountId"],
            Value::String("codex-primary-disable-a2".to_string())
        );
        assert_eq!(get_payload["result"]["inSync"], Value::Bool(true));
    }

    #[tokio::test]
    async fn oauth_primary_account_clears_when_last_candidate_becomes_invalid() {
        let app = test_router();
        let upsert_payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_oauth_account_upsert",
                "params":{
                    "accountId":"codex-primary-clear-last-a1",
                    "provider":"codex",
                    "status":"enabled",
                    "metadata":{"apiKey":"codex-primary-clear-last-a1-key"}
                }
            }),
        )
        .await;
        assert_eq!(upsert_payload["ok"], Value::Bool(true));

        let set_payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_oauth_primary_account_set",
                "params":{
                    "provider":"codex",
                    "accountId":"codex-primary-clear-last-a1"
                }
            }),
        )
        .await;
        assert_eq!(set_payload["ok"], Value::Bool(true));

        let disable_payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_oauth_account_upsert",
                "params":{
                    "accountId":"codex-primary-clear-last-a1",
                    "provider":"codex",
                    "status":"disabled",
                    "disabledReason":"manual"
                }
            }),
        )
        .await;
        assert_eq!(disable_payload["ok"], Value::Bool(true));

        let get_payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_oauth_primary_account_get",
                "params":{"provider":"codex"}
            }),
        )
        .await;
        assert_eq!(get_payload["ok"], Value::Bool(true));
        assert!(get_payload["result"]["accountId"].is_null());
        assert!(get_payload["result"]["account"].is_null());
        assert!(get_payload["result"]["routeAccountId"].is_null());
        assert_eq!(get_payload["result"]["inSync"], Value::Bool(true));

        let pools_payload = send_rpc_request(
            app,
            json!({
                "method":"code_oauth_pools_list",
                "params":{"provider":"codex"}
            }),
        )
        .await;
        assert_eq!(pools_payload["ok"], Value::Bool(true));
        let pool = pools_payload["result"]
            .as_array()
            .and_then(|entries| {
                entries
                    .iter()
                    .find(|entry| entry["poolId"] == Value::String("pool-codex".to_string()))
            })
            .expect("codex default pool");
        assert!(pool["preferredAccountId"].is_null());
    }

    #[tokio::test]
    async fn oauth_rate_limit_invalid_grant_disables_account() {
        let app = test_router();

        let upsert = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{"accountId":"claude-a1","provider":"claude_code"}
                }"#,
            ))
            .expect("build upsert request");
        let _ = app.clone().oneshot(upsert).await.expect("upsert response");

        let report = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_rate_limit_report",
                  "params":{
                    "accountId":"claude-a1",
                    "modelId":"claude-sonnet-4.5",
                    "success":false,
                    "errorCode":"invalid_grant"
                  }
                }"#,
            ))
            .expect("build report request");
        let report_response = app.clone().oneshot(report).await.expect("report response");
        let report_bytes = axum::body::to_bytes(report_response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let report_payload: Value = serde_json::from_slice(&report_bytes).expect("parse json");
        assert_eq!(report_payload["ok"], Value::Bool(true));
        assert_eq!(report_payload["result"], Value::Bool(true));

        let list = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{"method":"code_oauth_accounts_list","params":{"provider":"claude_code"}}"#,
            ))
            .expect("build list request");

        let response = app.oneshot(list).await.expect("list response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        let account = payload["result"]
            .as_array()
            .and_then(|accounts| accounts.first())
            .expect("account");
        assert_eq!(account["status"], Value::String("disabled".to_string()));
        assert_eq!(
            account["disabledReason"],
            Value::String("oauth_invalid_grant".to_string())
        );
    }

    #[tokio::test]
    async fn oauth_accounts_list_rejects_unsupported_provider_filter() {
        let app = test_router();
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{"method":"code_oauth_accounts_list","params":{"provider":"unknown_vendor"}}"#,
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
    async fn oauth_accounts_list_rejects_unsupported_usage_refresh_mode() {
        let app = test_router();
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{"method":"code_oauth_accounts_list","params":{"usageRefresh":"fastest"}}"#,
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
    async fn oauth_chatgpt_auth_tokens_refresh_returns_token_payload_when_account_has_access_token() {
        let app = test_router();
        let upsert = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{
                    "accountId":"codex-refresh-a1",
                    "provider":"codex",
                    "externalAccountId":"chatgpt-account-1",
                    "metadata":{
                      "apiKey":"chatgpt-access-token-1",
                      "chatgptAccountId":"chatgpt-account-1",
                      "chatgptPlanType":"pro"
                    }
                  }
                }"#,
            ))
            .expect("build upsert request");
        let _ = app.clone().oneshot(upsert).await.expect("upsert response");

        let refresh = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_chatgpt_auth_tokens_refresh",
                  "params":{"reason":"unauthorized","previousAccountId":"chatgpt-account-1"}
                }"#,
            ))
            .expect("build refresh request");

        let response = app.oneshot(refresh).await.expect("refresh response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(
            payload["result"]["accessToken"],
            Value::String("chatgpt-access-token-1".to_string())
        );
        assert_eq!(
            payload["result"]["chatgptAccountId"],
            Value::String("chatgpt-account-1".to_string())
        );
        assert_eq!(
            payload["result"]["chatgptPlanType"],
            Value::String("pro".to_string())
        );
        assert_eq!(
            payload["result"]["sourceAccountId"],
            Value::String("codex-refresh-a1".to_string())
        );
    }

    #[tokio::test]
    async fn oauth_chatgpt_auth_tokens_refresh_prefers_refresh_token_over_stale_access_token_for_unauthorized(
    ) {
        static CODEX_OAUTH_ISSUER_ENV_LOCK: std::sync::LazyLock<std::sync::Mutex<()>> =
            std::sync::LazyLock::new(|| std::sync::Mutex::new(()));

        let _guard = CODEX_OAUTH_ISSUER_ENV_LOCK
            .lock()
            .expect("codex oauth issuer env lock poisoned");
        let (issuer_base_url, refresh_requests, handle) = spawn_codex_oauth_refresh_mock_server(
            "refresh-token-1",
            "chatgpt-access-token-refreshed",
            Some("refresh-token-2"),
        )
        .await;
        let _issuer_guard =
            TestEnvVarGuard::set(CODE_RUNTIME_CODEX_OAUTH_ISSUER_ENV, issuer_base_url.as_str());

        let app = test_router();
        let upsert = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{
                    "accountId":"codex-refresh-stale-a1",
                    "provider":"codex",
                    "externalAccountId":"chatgpt-account-stale-1",
                    "metadata":{
                      "apiKey":"chatgpt-access-token-stale",
                      "refreshToken":"refresh-token-1",
                      "refreshTokenAvailable":true,
                      "chatgptAccountId":"chatgpt-account-stale-1",
                      "chatgptPlanType":"pro"
                    }
                  }
                }"#,
            ))
            .expect("build upsert request");
        let _ = app.clone().oneshot(upsert).await.expect("upsert response");

        let refresh = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_chatgpt_auth_tokens_refresh",
                  "params":{"reason":"unauthorized","previousAccountId":"chatgpt-account-stale-1"}
                }"#,
            ))
            .expect("build refresh request");

        let response = app.oneshot(refresh).await.expect("refresh response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(
            payload["result"]["accessToken"],
            Value::String("chatgpt-access-token-refreshed".to_string())
        );
        assert_eq!(
            payload["result"]["chatgptAccountId"],
            Value::String("chatgpt-account-stale-1".to_string())
        );
        assert_eq!(
            payload["result"]["chatgptPlanType"],
            Value::String("pro".to_string())
        );
        assert_eq!(
            refresh_requests.load(AtomicOrdering::SeqCst),
            1,
            "unauthorized refresh should exchange refreshToken even when a stale access token is present"
        );

        handle.abort();
    }

    #[tokio::test]
    async fn oauth_chatgpt_auth_tokens_refresh_returns_null_when_account_credentials_are_missing() {
        let app = test_router();
        let upsert = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{
                    "accountId":"codex-refresh-no-credential",
                    "provider":"codex",
                    "externalAccountId":"chatgpt-account-2",
                    "metadata":{"chatgptAccountId":"chatgpt-account-2"}
                  }
                }"#,
            ))
            .expect("build upsert request");
        let _ = app.clone().oneshot(upsert).await.expect("upsert response");

        let refresh = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_chatgpt_auth_tokens_refresh",
                  "params":{"reason":"unauthorized","previousAccountId":"chatgpt-account-2"}
                }"#,
            ))
            .expect("build refresh request");

        let response = app.oneshot(refresh).await.expect("refresh response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        assert!(payload["result"].is_null());
    }

    #[tokio::test]
    async fn oauth_chatgpt_auth_tokens_refresh_rejects_unsupported_reason() {
        let app = test_router();
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_chatgpt_auth_tokens_refresh",
                  "params":{"reason":"expired"}
                }"#,
            ))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
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
    async fn oauth_pool_members_replace_rejects_cross_provider_accounts() {
        let app = test_router();

        let upsert_account = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{"accountId":"codex-a1","provider":"codex"}
                }"#,
            ))
            .expect("build upsert account request");
        let _ = app
            .clone()
            .oneshot(upsert_account)
            .await
            .expect("upsert account response");

        let upsert_pool = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_upsert",
                  "params":{"poolId":"pool-claude-risk","provider":"claude_code","name":"Claude Risk Pool"}
                }"#,
            ))
            .expect("build upsert pool request");
        let _ = app
            .clone()
            .oneshot(upsert_pool)
            .await
            .expect("upsert pool response");

        let replace_members = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_members_replace",
                  "params":{"poolId":"pool-claude-risk","members":[{"accountId":"codex-a1"}]}
                }"#,
            ))
            .expect("build replace members request");

        let response = app
            .oneshot(replace_members)
            .await
            .expect("replace members response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(false));
        assert_eq!(
            payload["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );
        let error_message = payload["error"]["message"].as_str().unwrap_or_default();
        assert!(error_message.contains("does not match pool provider"));
    }

    #[tokio::test]
    async fn oauth_pool_members_replace_rejects_duplicate_account_ids() {
        let app = test_router();

        let upsert_account = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{
                    "accountId":"codex-dup-a1",
                    "provider":"codex",
                    "status":"enabled",
                    "metadata":{"apiKey":"codex-dup-key"}
                  }
                }"#,
            ))
            .expect("build upsert account request");
        let _ = app
            .clone()
            .oneshot(upsert_account)
            .await
            .expect("upsert account response");

        let upsert_pool = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_upsert",
                  "params":{"poolId":"pool-codex-dup-risk","provider":"codex","name":"Codex Dup Risk Pool"}
                }"#,
            ))
            .expect("build upsert pool request");
        let _ = app
            .clone()
            .oneshot(upsert_pool)
            .await
            .expect("upsert pool response");

        let replace_members = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_members_replace",
                  "params":{
                    "poolId":"pool-codex-dup-risk",
                    "members":[{"accountId":"codex-dup-a1"},{"accountId":"codex-dup-a1"}]
                  }
                }"#,
            ))
            .expect("build replace members request");

        let response = app
            .oneshot(replace_members)
            .await
            .expect("replace members response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(false));
        assert_eq!(
            payload["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );
        let error_message = payload["error"]["message"].as_str().unwrap_or_default();
        assert!(error_message.contains("duplicates"));
    }

    #[tokio::test]
    async fn oauth_pool_members_replace_rejects_missing_account_as_invalid_params() {
        let app = test_router();

        let upsert_pool = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_upsert",
                  "params":{"poolId":"pool-codex-missing-member","provider":"codex","name":"Codex Missing Member Pool"}
                }"#,
            ))
            .expect("build upsert pool request");
        let _ = app
            .clone()
            .oneshot(upsert_pool)
            .await
            .expect("upsert pool response");

        let replace_members = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_members_replace",
                  "params":{"poolId":"pool-codex-missing-member","members":[{"accountId":"codex-missing-a1"}]}
                }"#,
            ))
            .expect("build replace members request");

        let response = app
            .oneshot(replace_members)
            .await
            .expect("replace members response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(false));
        assert_eq!(
            payload["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );
        let error_message = payload["error"]["message"].as_str().unwrap_or_default();
        assert!(error_message.contains("does not exist"));
    }

    #[tokio::test]
    async fn oauth_pool_members_replace_rejects_missing_pool_as_invalid_params() {
        let app = test_router();

        let replace_members = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_members_replace",
                  "params":{"poolId":"pool-risk-missing","members":[{"accountId":"codex-any-a1"}]}
                }"#,
            ))
            .expect("build replace members request");

        let response = app
            .oneshot(replace_members)
            .await
            .expect("replace members response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(false));
        assert_eq!(
            payload["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );
        let error_message = payload["error"]["message"].as_str().unwrap_or_default();
        assert!(error_message.contains("Pool `pool-risk-missing` does not exist"));
    }

    #[tokio::test]
    async fn oauth_pool_members_replace_rejects_out_of_range_weight_as_invalid_params() {
        let app = test_router();

        let upsert_account = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{
                    "accountId":"codex-risk-weight-a1",
                    "provider":"codex",
                    "status":"enabled",
                    "metadata":{"apiKey":"codex-risk-weight-key"}
                  }
                }"#,
            ))
            .expect("build upsert account request");
        let _ = app
            .clone()
            .oneshot(upsert_account)
            .await
            .expect("upsert account response");

        let replace_members = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_members_replace",
                  "params":{"poolId":"pool-codex","members":[{"accountId":"codex-risk-weight-a1","weight":0}]}
                }"#,
            ))
            .expect("build replace members request");

        let response = app
            .oneshot(replace_members)
            .await
            .expect("replace members response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(false));
        assert_eq!(
            payload["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );
        let error_message = payload["error"]["message"].as_str().unwrap_or_default();
        assert!(error_message.contains("weight"));
        assert!(error_message.contains("between 1 and 20"));
    }

    #[tokio::test]
    async fn oauth_pool_apply_upserts_pool_and_members_atomically_with_canonical_method() {
        let app = test_router();

        let upsert_account_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_oauth_account_upsert",
                "params": {
                    "accountId": "codex-apply-a1",
                    "provider": "codex",
                    "status": "enabled",
                    "metadata": {"apiKey":"codex-apply-a1-key"}
                }
            }),
        )
        .await;
        assert_eq!(upsert_account_payload["ok"], Value::Bool(true));

        let apply_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_oauth_pool_apply",
                "params": {
                    "pool": {
                        "poolId": "pool-codex-apply",
                        "provider": "codex",
                        "name": "Codex Apply Pool",
                        "strategy": "p2c",
                        "stickyMode": "balance",
                        "enabled": true,
                        "metadata": {"source":"test"}
                    },
                    "members": [
                        {
                            "accountId": "codex-apply-a1",
                            "weight": 3,
                            "priority": 1,
                            "position": 0,
                            "enabled": true
                        }
                    ]
                }
            }),
        )
        .await;
        assert_eq!(apply_payload["ok"], Value::Bool(true));
        assert_eq!(
            apply_payload["result"]["pool"]["poolId"],
            Value::String("pool-codex-apply".to_string())
        );
        assert_eq!(
            apply_payload["result"]["pool"]["strategy"],
            Value::String("p2c".to_string())
        );
        assert_eq!(
            apply_payload["result"]["members"][0]["accountId"],
            Value::String("codex-apply-a1".to_string())
        );
        assert_eq!(
            apply_payload["result"]["members"][0]["weight"],
            Value::Number(3.into())
        );

    }

    #[tokio::test]
    async fn oauth_pool_apply_rejects_pool_version_mismatch() {
        let app = test_router();

        let initial_apply = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_oauth_pool_apply",
                "params": {
                    "pool": {
                        "poolId": "pool-codex-versioned",
                        "provider": "codex",
                        "name": "Versioned Pool"
                    },
                    "members": []
                }
            }),
        )
        .await;
        assert_eq!(initial_apply["ok"], Value::Bool(true));
        let updated_at = initial_apply["result"]["pool"]["updatedAt"]
            .as_u64()
            .expect("updatedAt");

        let conflict_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_oauth_pool_apply",
                "params": {
                    "pool": {
                        "poolId": "pool-codex-versioned",
                        "provider": "codex",
                        "name": "Versioned Pool Updated"
                    },
                    "members": [],
                    "expectedUpdatedAt": updated_at.saturating_sub(1)
                }
            }),
        )
        .await;
        assert_eq!(conflict_payload["ok"], Value::Bool(false));
        assert_eq!(
            conflict_payload["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );
        let message = conflict_payload["error"]["message"]
            .as_str()
            .unwrap_or_default();
        assert!(message.starts_with("POOL_VERSION_MISMATCH:"));
    }

    #[test]
    fn map_oauth_account_upsert_error_uses_typed_error_code() {
        let invalid = map_oauth_account_upsert_error(OAuthPoolMutationError::invalid_input(
            "metadata `apiKeyEncryptedV1` is reserved and cannot be set directly.",
        ));
        assert_eq!(invalid.code.as_str(), "INVALID_PARAMS");
        assert_eq!(
            invalid.message,
            "metadata `apiKeyEncryptedV1` is reserved and cannot be set directly."
        );

        let internal = map_oauth_account_upsert_error(OAuthPoolMutationError::internal(
            "Begin upsert_account transaction: database locked",
        ));
        assert_eq!(internal.code.as_str(), "INTERNAL_ERROR");
        assert_eq!(
            internal.message,
            "Begin upsert_account transaction: database locked"
        );
    }

    #[test]
    fn map_oauth_pool_mutation_error_uses_typed_error_code() {
        let invalid = map_oauth_pool_mutation_error(OAuthPoolMutationError::invalid_input(
            "Pool member account `codex-a1` does not exist",
        ));
        assert_eq!(invalid.code.as_str(), "INVALID_PARAMS");
        assert_eq!(
            invalid.message,
            "Pool member account `codex-a1` does not exist"
        );

        let internal = map_oauth_pool_mutation_error(OAuthPoolMutationError::internal(
            "database locked while writing oauth pool members",
        ));
        assert_eq!(internal.code.as_str(), "INTERNAL_ERROR");
        assert_eq!(
            internal.message,
            "database locked while writing oauth pool members"
        );
    }

    #[tokio::test]
    async fn oauth_pool_select_skips_disabled_account_and_uses_sticky_binding() {
        let app = test_router();

        let upsert_enabled = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{
                    "accountId":"codex-enabled",
                    "provider":"codex",
                    "status":"enabled",
                    "metadata":{"apiKey":"codex-enabled-key"}
                  }
                }"#,
            ))
            .expect("build upsert enabled request");
        let _ = app
            .clone()
            .oneshot(upsert_enabled)
            .await
            .expect("upsert enabled response");

        let upsert_disabled = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{"accountId":"codex-disabled","provider":"codex","status":"disabled"}
                }"#,
            ))
            .expect("build upsert disabled request");
        let _ = app
            .clone()
            .oneshot(upsert_disabled)
            .await
            .expect("upsert disabled response");

        let upsert_pool = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_upsert",
                  "params":{"poolId":"pool-codex-sticky","provider":"codex","name":"Codex Sticky Pool","strategy":"round_robin"}
                }"#,
            ))
            .expect("build upsert pool request");
        let _ = app
            .clone()
            .oneshot(upsert_pool)
            .await
            .expect("upsert pool response");

        let replace_members = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_members_replace",
                  "params":{
                    "poolId":"pool-codex-sticky",
                    "members":[
                      {"accountId":"codex-disabled","enabled":true},
                      {"accountId":"codex-enabled","enabled":true}
                    ]
                  }
                }"#,
            ))
            .expect("build replace members request");
        let _ = app
            .clone()
            .oneshot(replace_members)
            .await
            .expect("replace members response");

        let select_first = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_select",
                  "params":{"poolId":"pool-codex-sticky","sessionId":"session-sticky"}
                }"#,
            ))
            .expect("build select first request");
        let select_first_response = app
            .clone()
            .oneshot(select_first)
            .await
            .expect("select first response");
        let first_bytes = axum::body::to_bytes(select_first_response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let first_payload: Value = serde_json::from_slice(&first_bytes).expect("parse json");
        assert_eq!(first_payload["ok"], Value::Bool(true));
        assert_eq!(
            first_payload["result"]["account"]["accountId"],
            Value::String("codex-enabled".to_string())
        );

        let select_second = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_select",
                  "params":{"poolId":"pool-codex-sticky","sessionId":"session-sticky"}
                }"#,
            ))
            .expect("build select second request");
        let select_second_response = app
            .clone()
            .oneshot(select_second)
            .await
            .expect("select second response");
        let second_bytes = axum::body::to_bytes(select_second_response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let second_payload: Value = serde_json::from_slice(&second_bytes).expect("parse json");
        assert_eq!(second_payload["ok"], Value::Bool(true));
        assert_eq!(
            second_payload["result"]["reason"],
            Value::String("sticky_binding".to_string())
        );
        assert_eq!(
            second_payload["result"]["account"]["accountId"],
            Value::String("codex-enabled".to_string())
        );
    }

    #[tokio::test]
    async fn oauth_pool_select_filters_by_chatgpt_workspace_id_over_rpc() {
        let app = test_router();

        for (account_id, workspace_id) in [("codex-org-a", "org-a"), ("codex-org-b", "org-b")] {
            let upsert = Request::builder()
                .method("POST")
                .uri("/rpc")
                .header("content-type", "application/json")
                .body(Body::from(format!(
                    r#"{{
                      "method":"code_oauth_account_upsert",
                      "params":{{
                        "accountId":"{account_id}",
                        "provider":"codex",
                        "status":"enabled",
                        "metadata":{{
                          "apiKey":"{account_id}-key",
                          "chatgptWorkspaces":[{{"workspaceId":"{workspace_id}","title":"{workspace_id}","isDefault":true}}]
                        }}
                      }}
                    }}"#
                )))
                .expect("build upsert request");
            let _ = app.clone().oneshot(upsert).await.expect("upsert response");
        }

        let select = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_select",
                  "params":{
                    "poolId":"pool-codex",
                    "sessionId":"session-workspace-filter",
                    "chatgptWorkspaceId":"org-b"
                  }
                }"#,
            ))
            .expect("build select request");
        let response = app.oneshot(select).await.expect("select response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(
            payload["result"]["account"]["accountId"],
            Value::String("codex-org-b".to_string())
        );
        assert_eq!(
            payload["result"]["account"]["defaultChatgptWorkspaceId"],
            Value::String("org-b".to_string())
        );
    }

    #[tokio::test]
    async fn oauth_pool_account_bind_creates_project_workspace_override_over_preferred_route() {
        let app = test_router();

        for account_id in ["codex-bind-a1", "codex-bind-a2"] {
            let upsert = Request::builder()
                .method("POST")
                .uri("/rpc")
                .header("content-type", "application/json")
                .body(Body::from(format!(
                    r#"{{
                      "method":"code_oauth_account_upsert",
                      "params":{{
                        "accountId":"{account_id}",
                        "provider":"codex",
                        "status":"enabled",
                        "metadata":{{"apiKey":"{account_id}-key"}}
                      }}
                    }}"#
                )))
                .expect("build upsert request");
            let _ = app.clone().oneshot(upsert).await.expect("upsert response");
        }

        let preferred_pool = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_upsert",
                  "params":{
                    "poolId":"pool-codex",
                    "provider":"codex",
                    "name":"Codex Pool",
                    "strategy":"round_robin",
                    "stickyMode":"balance",
                    "preferredAccountId":"codex-bind-a1",
                    "enabled":true
                  }
                }"#,
            ))
            .expect("build pool upsert request");
        let _ = app
            .clone()
            .oneshot(preferred_pool)
            .await
            .expect("preferred pool response");

        let bind = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_account_bind",
                  "params":{
                    "poolId":"pool-codex",
                    "sessionId":"project-ws-bind-rpc-1",
                    "accountId":"codex-bind-a2"
                  }
                }"#,
            ))
            .expect("build bind request");
        let bind_response = app.clone().oneshot(bind).await.expect("bind response");
        let bind_bytes = axum::body::to_bytes(bind_response.into_body(), 1024 * 1024)
            .await
            .expect("read bind body");
        let bind_payload: Value = serde_json::from_slice(&bind_bytes).expect("parse bind json");
        assert_eq!(bind_payload["ok"], Value::Bool(true));
        assert_eq!(
            bind_payload["result"]["account"]["accountId"],
            Value::String("codex-bind-a2".to_string())
        );
        assert_eq!(
            bind_payload["result"]["reason"],
            Value::String("manual_binding".to_string())
        );

        let select = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_select",
                  "params":{
                    "poolId":"pool-codex",
                    "sessionId":"project-ws-bind-rpc-1"
                  }
                }"#,
            ))
            .expect("build select request");
        let select_response = app.oneshot(select).await.expect("select response");
        let select_bytes = axum::body::to_bytes(select_response.into_body(), 1024 * 1024)
            .await
            .expect("read select body");
        let select_payload: Value = serde_json::from_slice(&select_bytes).expect("parse select json");
        assert_eq!(select_payload["ok"], Value::Bool(true));
        assert_eq!(
            select_payload["result"]["account"]["accountId"],
            Value::String("codex-bind-a2".to_string())
        );
        assert_eq!(
            select_payload["result"]["reason"],
            Value::String("manual_binding".to_string())
        );
    }

    #[tokio::test]
    async fn oauth_pool_select_prefers_explicit_chatgpt_workspace_id_over_legacy_workspace_id() {
        let app = test_router();

        for (account_id, workspace_id) in [("codex-org-a", "org-a"), ("codex-org-b", "org-b")] {
            let upsert = Request::builder()
                .method("POST")
                .uri("/rpc")
                .header("content-type", "application/json")
                .body(Body::from(format!(
                    r#"{{
                      "method":"code_oauth_account_upsert",
                      "params":{{
                        "accountId":"{account_id}",
                        "provider":"codex",
                        "status":"enabled",
                        "metadata":{{
                          "apiKey":"{account_id}-key",
                          "chatgptWorkspaces":[{{"workspaceId":"{workspace_id}","title":"{workspace_id}","isDefault":true}}]
                        }}
                      }}
                    }}"#
                )))
                .expect("build upsert request");
            let _ = app.clone().oneshot(upsert).await.expect("upsert response");
        }

        let select = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_select",
                  "params":{
                    "poolId":"pool-codex",
                    "sessionId":"session-workspace-priority",
                    "chatgptWorkspaceId":"org-b",
                    "workspaceId":"org-a"
                  }
                }"#,
            ))
            .expect("build select request");
        let response = app.oneshot(select).await.expect("select response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(
            payload["result"]["account"]["accountId"],
            Value::String("codex-org-b".to_string())
        );
    }

    #[tokio::test]
    async fn oauth_chatgpt_auth_tokens_refresh_prefers_explicit_chatgpt_workspace_id() {
        let app = test_router();

        for (account_id, external_account_id, workspace_id, token) in [
            (
                "codex-refresh-org-a",
                "chatgpt-account-org-a",
                "org-a",
                "chatgpt-access-token-org-a",
            ),
            (
                "codex-refresh-org-b",
                "chatgpt-account-org-b",
                "org-b",
                "chatgpt-access-token-org-b",
            ),
        ] {
            let upsert = Request::builder()
                .method("POST")
                .uri("/rpc")
                .header("content-type", "application/json")
                .body(Body::from(format!(
                    r#"{{
                      "method":"code_oauth_account_upsert",
                      "params":{{
                        "accountId":"{account_id}",
                        "provider":"codex",
                        "externalAccountId":"{external_account_id}",
                        "status":"enabled",
                        "metadata":{{
                          "apiKey":"{token}",
                          "chatgptAccountId":"{external_account_id}",
                          "chatgptWorkspaces":[{{"workspaceId":"{workspace_id}","title":"{workspace_id}","isDefault":true}}]
                        }}
                      }}
                    }}"#
                )))
                .expect("build upsert request");
            let _ = app.clone().oneshot(upsert).await.expect("upsert response");
        }

        let refresh = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_chatgpt_auth_tokens_refresh",
                  "params":{
                    "reason":"unauthorized",
                    "chatgptWorkspaceId":"org-b"
                  }
                }"#,
            ))
            .expect("build refresh request");

        let response = app.oneshot(refresh).await.expect("refresh response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(
            payload["result"]["accessToken"],
            Value::String("chatgpt-access-token-org-b".to_string())
        );
        assert_eq!(
            payload["result"]["chatgptAccountId"],
            Value::String("chatgpt-account-org-b".to_string())
        );
        assert_eq!(
            payload["result"]["sourceAccountId"],
            Value::String("codex-refresh-org-b".to_string())
        );
    }

    #[tokio::test]
    async fn oauth_chatgpt_auth_tokens_refresh_reuses_workspace_aware_session_binding() {
        let app = test_router();

        for (account_id, external_account_id, workspace_id, token) in [
            (
                "codex-refresh-bound-a",
                "chatgpt-account-bound-a",
                "org-a",
                "chatgpt-access-token-bound-a",
            ),
            (
                "codex-refresh-bound-b",
                "chatgpt-account-bound-b",
                "org-b",
                "chatgpt-access-token-bound-b",
            ),
        ] {
            let upsert = Request::builder()
                .method("POST")
                .uri("/rpc")
                .header("content-type", "application/json")
                .body(Body::from(format!(
                    r#"{{
                      "method":"code_oauth_account_upsert",
                      "params":{{
                        "accountId":"{account_id}",
                        "provider":"codex",
                        "externalAccountId":"{external_account_id}",
                        "status":"enabled",
                        "metadata":{{
                          "apiKey":"{token}",
                          "chatgptAccountId":"{external_account_id}",
                          "chatgptWorkspaces":[{{"workspaceId":"{workspace_id}","title":"{workspace_id}","isDefault":true}}]
                        }}
                      }}
                    }}"#
                )))
                .expect("build upsert request");
            let _ = app.clone().oneshot(upsert).await.expect("upsert response");
        }

        let select = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_select",
                  "params":{
                    "poolId":"pool-codex",
                    "sessionId":"session-refresh-bound-1",
                    "chatgptWorkspaceId":"org-b"
                  }
                }"#,
            ))
            .expect("build select request");
        let select_response = app.clone().oneshot(select).await.expect("select response");
        let select_bytes = axum::body::to_bytes(select_response.into_body(), 1024 * 1024)
            .await
            .expect("read select body");
        let select_payload: Value = serde_json::from_slice(&select_bytes).expect("parse select");
        assert_eq!(
            select_payload["result"]["account"]["accountId"],
            Value::String("codex-refresh-bound-b".to_string())
        );

        let refresh = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_chatgpt_auth_tokens_refresh",
                  "params":{
                    "reason":"unauthorized",
                    "sessionId":"session-refresh-bound-1",
                    "chatgptWorkspaceId":"org-b",
                    "previousAccountId":"chatgpt-account-bound-a"
                  }
                }"#,
            ))
            .expect("build refresh request");

        let response = app.oneshot(refresh).await.expect("refresh response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(
            payload["result"]["accessToken"],
            Value::String("chatgpt-access-token-bound-b".to_string())
        );
        assert_eq!(
            payload["result"]["chatgptAccountId"],
            Value::String("chatgpt-account-bound-b".to_string())
        );
        assert_eq!(
            payload["result"]["sourceAccountId"],
            Value::String("codex-refresh-bound-b".to_string())
        );
    }

    #[tokio::test]
    async fn oauth_chatgpt_auth_tokens_refresh_prefers_explicit_chatgpt_workspace_id_over_legacy_workspace_id(
    ) {
        let app = test_router();

        for (account_id, external_account_id, workspace_id, token) in [
            (
                "codex-refresh-org-a",
                "chatgpt-account-org-a",
                "org-a",
                "chatgpt-access-token-org-a",
            ),
            (
                "codex-refresh-org-b",
                "chatgpt-account-org-b",
                "org-b",
                "chatgpt-access-token-org-b",
            ),
        ] {
            let upsert = Request::builder()
                .method("POST")
                .uri("/rpc")
                .header("content-type", "application/json")
                .body(Body::from(format!(
                    r#"{{
                      "method":"code_oauth_account_upsert",
                      "params":{{
                        "accountId":"{account_id}",
                        "provider":"codex",
                        "externalAccountId":"{external_account_id}",
                        "status":"enabled",
                        "metadata":{{
                          "apiKey":"{token}",
                          "chatgptAccountId":"{external_account_id}",
                          "chatgptWorkspaces":[{{"workspaceId":"{workspace_id}","title":"{workspace_id}","isDefault":true}}]
                        }}
                      }}
                    }}"#
                )))
                .expect("build upsert request");
            let _ = app.clone().oneshot(upsert).await.expect("upsert response");
        }

        let refresh = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_chatgpt_auth_tokens_refresh",
                  "params":{
                    "reason":"unauthorized",
                    "chatgptWorkspaceId":"org-b",
                    "workspaceId":"org-a"
                  }
                }"#,
            ))
            .expect("build refresh request");

        let response = app.oneshot(refresh).await.expect("refresh response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(
            payload["result"]["accessToken"],
            Value::String("chatgpt-access-token-org-b".to_string())
        );
        assert_eq!(
            payload["result"]["sourceAccountId"],
            Value::String("codex-refresh-org-b".to_string())
        );
    }

    #[tokio::test]
    async fn oauth_account_upsert_rejects_invalid_status() {
        let app = test_router();
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{"accountId":"codex-a1","provider":"codex","status":"paused"}
                }"#,
            ))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
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
    async fn oauth_pool_upsert_rejects_invalid_strategy_and_sticky_mode() {
        let app = test_router();
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_upsert",
                  "params":{
                    "poolId":"pool-risk-invalid",
                    "provider":"codex",
                    "name":"Risk Invalid",
                    "strategy":"weighted_random",
                    "stickyMode":"memory_optimized"
                  }
                }"#,
            ))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
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
    async fn oauth_pool_upsert_rejects_non_object_metadata() {
        let app = test_router();
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_upsert",
                  "params":{
                    "poolId":"pool-invalid-metadata",
                    "provider":"codex",
                    "name":"Invalid Metadata Pool",
                    "metadata":"not-an-object"
                  }
                }"#,
            ))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(false));
        assert_eq!(
            payload["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );
        let message = payload["error"]["message"].as_str().unwrap_or_default();
        assert!(message.contains("metadata"));
        assert!(message.contains("JSON object"));
    }

    #[tokio::test]
    async fn oauth_pool_upsert_rejects_missing_preferred_account() {
        let app = test_router();
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_upsert",
                  "params":{
                    "poolId":"pool-missing-preferred",
                    "provider":"codex",
                    "name":"Missing Preferred",
                    "preferredAccountId":"codex-missing-a1"
                  }
                }"#,
            ))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(false));
        assert_eq!(
            payload["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );
        let message = payload["error"]["message"].as_str().unwrap_or_default();
        assert!(message.contains("Preferred account"));
        assert!(message.contains("does not exist"));
    }

    #[tokio::test]
    async fn oauth_pool_upsert_rejects_preferred_account_provider_mismatch() {
        let app = test_router();
        let upsert_account = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{
                    "accountId":"codex-preferred-a1",
                    "provider":"codex",
                    "status":"enabled",
                    "metadata":{"apiKey":"codex-preferred-key"}
                  }
                }"#,
            ))
            .expect("build upsert account request");
        let _ = app
            .clone()
            .oneshot(upsert_account)
            .await
            .expect("upsert account response");

        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_upsert",
                  "params":{
                    "poolId":"pool-claude-preferred-mismatch",
                    "provider":"claude_code",
                    "name":"Preferred Mismatch",
                    "preferredAccountId":"codex-preferred-a1"
                  }
                }"#,
            ))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(false));
        assert_eq!(
            payload["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );
        let message = payload["error"]["message"].as_str().unwrap_or_default();
        assert!(message.contains("Preferred account"));
        assert!(message.contains("does not match pool provider"));
    }

    #[tokio::test]
    async fn readiness_returns_service_unavailable_when_openai_key_is_missing() {
        let app = test_router();
        let request = Request::builder()
            .method("GET")
            .uri("/ready")
            .body(Body::empty())
            .expect("build request");

        let response = app.oneshot(request).await.expect("ready response");
        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
    }

    #[tokio::test]
    async fn readiness_returns_ok_when_required_openai_config_is_present() {
        let mut config = test_service_config();
        config.openai_api_key = Some("test-key".to_string());
        let app = test_router_with_config(config);
        let request = Request::builder()
            .method("GET")
            .uri("/ready")
            .body(Body::empty())
            .expect("build request");

        let response = app.oneshot(request).await.expect("ready response");
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn readiness_returns_ok_when_compat_mode_is_configured_for_default_provider() {
        let mut config = test_service_config_with_openai_compat("http://127.0.0.1:8045/v1");
        config.default_model_id = "claude-sonnet-4-5".to_string();
        config.anthropic_api_key = None;
        let app = test_router_with_config(config);
        let request = Request::builder()
            .method("GET")
            .uri("/ready")
            .body(Body::empty())
            .expect("build request");

        let response = app.oneshot(request).await.expect("ready response");
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn readiness_includes_oauth_pool_diagnostics_snapshot() {
        let mut config = test_service_config();
        config.openai_api_key = Some("test-key".to_string());
        let app = test_router_with_config(config);
        let request = Request::builder()
            .method("GET")
            .uri("/ready")
            .body(Body::empty())
            .expect("build request");

        let response = app.oneshot(request).await.expect("ready response");
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse ready payload");
        assert_eq!(
            payload["oauthPool"]["accountsTotal"],
            Value::Number(serde_json::Number::from(0))
        );
        assert_eq!(
            payload["oauthPool"]["poolsTotal"],
            Value::Number(serde_json::Number::from(3))
        );
        assert_eq!(
            payload["oauthPool"]["oauthSecretKeyConfigured"],
            Value::Bool(true)
        );
        assert_eq!(
            payload["oauthPool"]["roundRobinCursorEntries"],
            Value::Number(serde_json::Number::from(0))
        );
        assert_eq!(
            payload["runtimeDiagnostics"]["oauthRoutingFailuresTotal"],
            Value::Number(serde_json::Number::from(0))
        );
        assert_eq!(
            payload["runtimeDiagnostics"]["oauthReservedMetadataRejectionsTotal"],
            Value::Number(serde_json::Number::from(0))
        );
        assert_eq!(
            payload["runtimeDiagnostics"]["compatModelCatalogRefreshLocksTotal"],
            Value::Number(serde_json::Number::from(0))
        );
        assert_eq!(
            payload["runtimeDiagnostics"]["compatModelCatalogFailureCacheEntries"],
            Value::Number(serde_json::Number::from(0))
        );
        assert_eq!(
            payload["runtimeDiagnostics"]["compatModelCatalogFetchFailuresTotal"],
            Value::Number(serde_json::Number::from(0))
        );
        assert_eq!(
            payload["runtimeDiagnostics"]["compatModelCatalogErrorCooldownHitsTotal"],
            Value::Number(serde_json::Number::from(0))
        );
        assert!(payload.get("oauthPoolError").is_none());
    }

    #[tokio::test]
    async fn readiness_reports_oauth_pool_bootstrap_fallback_error() {
        let mut config = test_service_config();
        config.openai_api_key = Some("test-key".to_string());
        let missing_parent = format!(
            "/tmp/code-runtime-oauth-missing-parent-{}",
            uuid::Uuid::new_v4()
        );
        config.oauth_pool_db_path = format!("{missing_parent}/oauth-pool.db");
        let app = test_router_with_config(config);
        let request = Request::builder()
            .method("GET")
            .uri("/ready")
            .body(Body::empty())
            .expect("build ready request");

        let response = app.oneshot(request).await.expect("ready response");
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read ready body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse ready payload");
        let oauth_pool_error = payload["oauthPoolError"]
            .as_str()
            .expect("oauth pool bootstrap fallback error");
        assert!(oauth_pool_error.contains("Falling back to in-memory oauth pool."));
        assert_eq!(
            payload["oauthPool"]["poolsTotal"],
            Value::Number(serde_json::Number::from(3))
        );
    }

    #[tokio::test]
    async fn readiness_reports_oauth_pool_secret_key_fallback_without_key() {
        let mut config = test_service_config();
        config.openai_api_key = Some("test-key".to_string());
        config.oauth_secret_key = Some("invalid-base64-secret".to_string());
        let app = test_router_with_config(config);
        let request = Request::builder()
            .method("GET")
            .uri("/ready")
            .body(Body::empty())
            .expect("build ready request");

        let response = app.oneshot(request).await.expect("ready response");
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read ready body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse ready payload");
        let oauth_pool_error = payload["oauthPoolError"]
            .as_str()
            .expect("oauth pool fallback error");
        assert!(oauth_pool_error.contains("without secret key"));
        assert_eq!(
            payload["oauthPool"]["oauthSecretKeyConfigured"],
            Value::Bool(false)
        );
    }

    #[tokio::test]
    async fn readiness_reports_compat_model_catalog_failure_cache_entries() {
        let (compat_base_url, _models_counter, compat_handle) =
            spawn_openai_compat_models_error_server(Some("compat-test-key")).await;
        let mut config = test_service_config_with_openai_compat(compat_base_url.as_str());
        config.openai_api_key = Some("test-key".to_string());
        let app = test_router_with_config(config);

        let models_pool_payload = send_rpc_request(
            app.clone(),
            json!({"method":"code_models_pool","params":{}}),
        )
        .await;
        assert_eq!(models_pool_payload["ok"], Value::Bool(true));

        let request = Request::builder()
            .method("GET")
            .uri("/ready")
            .body(Body::empty())
            .expect("build ready request");
        let response = app.oneshot(request).await.expect("ready response");
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read ready body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse ready payload");
        assert_eq!(
            payload["runtimeDiagnostics"]["compatModelCatalogFailureCacheEntries"],
            Value::Number(serde_json::Number::from(1))
        );
        assert_eq!(
            payload["runtimeDiagnostics"]["compatModelCatalogFetchFailuresTotal"],
            Value::Number(serde_json::Number::from(1))
        );
        assert_eq!(
            payload["runtimeDiagnostics"]["compatModelCatalogErrorCooldownHitsTotal"],
            Value::Number(serde_json::Number::from(0))
        );

        compat_handle.abort();
    }

    #[tokio::test]
    async fn readiness_prunes_expired_compat_model_catalog_failure_cache_entries() {
        let (compat_base_url, _models_counter, compat_handle) =
            spawn_openai_compat_models_error_server(Some("compat-test-key")).await;
        let mut config = test_service_config_with_openai_compat(compat_base_url.as_str());
        config.openai_api_key = Some("test-key".to_string());
        let app = test_router_with_config(config);

        let _ = send_rpc_request(
            app.clone(),
            json!({"method":"code_models_pool","params":{}}),
        )
        .await;

        let ready_before = Request::builder()
            .method("GET")
            .uri("/ready")
            .body(Body::empty())
            .expect("build ready request before prune");
        let response_before = app
            .clone()
            .oneshot(ready_before)
            .await
            .expect("ready response before prune");
        let bytes_before = axum::body::to_bytes(response_before.into_body(), 1024 * 1024)
            .await
            .expect("read ready body before prune");
        let payload_before: Value =
            serde_json::from_slice(&bytes_before).expect("parse ready payload before prune");
        assert_eq!(
            payload_before["runtimeDiagnostics"]["compatModelCatalogFailureCacheEntries"],
            Value::Number(serde_json::Number::from(1))
        );

        tokio::time::sleep(Duration::from_millis(
            OPENAI_COMPAT_MODEL_CATALOG_ERROR_COOLDOWN_MS + 50,
        ))
        .await;

        let ready_after = Request::builder()
            .method("GET")
            .uri("/ready")
            .body(Body::empty())
            .expect("build ready request after prune");
        let response_after = app
            .oneshot(ready_after)
            .await
            .expect("ready response after prune");
        let bytes_after = axum::body::to_bytes(response_after.into_body(), 1024 * 1024)
            .await
            .expect("read ready body after prune");
        let payload_after: Value =
            serde_json::from_slice(&bytes_after).expect("parse ready payload after prune");
        assert_eq!(
            payload_after["runtimeDiagnostics"]["compatModelCatalogFailureCacheEntries"],
            Value::Number(serde_json::Number::from(0))
        );

        compat_handle.abort();
    }

    #[tokio::test]
    async fn turn_send_oauth_routing_failure_updates_runtime_diagnostics() {
        let app = test_router();
        let turn_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_turn_send",
                  "params":{
                    "payload":{
                      "workspaceId":"workspace-web",
                      "threadId":"thread-routing-failure-metrics",
                      "content":"Ping routing diagnostics",
                      "provider":"openai",
                      "reasonEffort":"high",
                      "accessMode":"on-request",
                      "executionMode": "runtime",
                      "queue": false,
                      "attachments":[]
                    }
                  }
                }"#,
            ))
            .expect("build turn request");

        let turn_response = app
            .clone()
            .oneshot(turn_request)
            .await
            .expect("turn response");
        assert_eq!(turn_response.status(), StatusCode::OK);

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

        let failures_total = ready_payload["runtimeDiagnostics"]["oauthRoutingFailuresTotal"]
            .as_u64()
            .unwrap_or(0);
        let pool_exhausted_total = ready_payload["runtimeDiagnostics"]
            ["oauthRoutingPoolExhaustedTotal"]
            .as_u64()
            .unwrap_or(0);
        assert!(failures_total >= 1);
        assert!(pool_exhausted_total >= 1);
    }

    #[tokio::test]
    async fn turn_send_oauth_auth_missing_updates_runtime_diagnostics() {
        let app = test_router();
        let upsert_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{
                    "accountId":"codex-auth-missing-service",
                    "provider":"codex",
                    "metadata":{}
                  }
                }"#,
            ))
            .expect("build upsert request");
        let upsert_response = app
            .clone()
            .oneshot(upsert_request)
            .await
            .expect("upsert response");
        assert_eq!(upsert_response.status(), StatusCode::OK);

        let replace_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_members_replace",
                  "params":{
                    "poolId":"pool-codex",
                    "members":[{"accountId":"codex-auth-missing-service","weight":1,"priority":0,"position":0,"enabled":true}]
                  }
                }"#,
            ))
            .expect("build members replace request");
        let replace_response = app
            .clone()
            .oneshot(replace_request)
            .await
            .expect("members replace response");
        assert_eq!(replace_response.status(), StatusCode::OK);

        let turn_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_turn_send",
                  "params":{
                    "payload":{
                      "workspaceId":"workspace-web",
                      "threadId":"thread-auth-missing-metrics",
                      "content":"Ping auth missing diagnostics",
                      "provider":"openai",
                      "reasonEffort":"high",
                      "accessMode":"on-request",
                      "executionMode": "runtime",
                      "queue": false,
                      "attachments":[]
                    }
                  }
                }"#,
            ))
            .expect("build turn request");
        let turn_response = app
            .clone()
            .oneshot(turn_request)
            .await
            .expect("turn response");
        assert_eq!(turn_response.status(), StatusCode::OK);

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
            ready_payload["runtimeDiagnostics"]["oauthRoutingAuthMissingTotal"]
                .as_u64()
                .unwrap_or(0)
                >= 1
        );
    }

    #[tokio::test]
    async fn turn_send_oauth_decrypt_failed_updates_runtime_diagnostics() {
        const WRONG_SECRET_KEY_B64: &str = "AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=";
        let db_path = temp_sqlite_db_path("code-runtime-oauth-decrypt-failed");
        let db_path_string = db_path.to_string_lossy().to_string();
        let seeded_store = OAuthPoolStore::open(
            db_path_string.as_str(),
            Some("AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE="),
        )
        .expect("open seed oauth store");
        seeded_store
            .upsert_account(OAuthAccountUpsertInput {
                account_id: "codex-decrypt-failed-service".to_string(),
                provider: "codex".to_string(),
                external_account_id: None,
                email: None,
                display_name: Some("Codex Decrypt Failed".to_string()),
                status: Some("enabled".to_string()),
                disabled_reason: None,
                metadata: Some(json!({
                    "apiKey":"decrypt-failed-key"
                })),
            })
            .expect("seed oauth account");
        seeded_store
            .replace_pool_members(
                "pool-codex",
                &[OAuthPoolMemberInput {
                    account_id: "codex-decrypt-failed-service".to_string(),
                    weight: Some(1),
                    priority: Some(0),
                    position: Some(0),
                    enabled: Some(true),
                }],
            )
            .expect("seed pool members");
        drop(seeded_store);

        let mut config = test_service_config();
        config.oauth_pool_db_path = db_path_string;
        config.oauth_secret_key = Some(WRONG_SECRET_KEY_B64.to_string());
        let app = test_router_with_config(config);

        let turn_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_turn_send",
                  "params":{
                    "payload":{
                      "workspaceId":"workspace-web",
                      "threadId":"thread-decrypt-failed-metrics",
                      "content":"Ping decrypt failed diagnostics",
                      "provider":"openai",
                      "reasonEffort":"high",
                      "accessMode":"on-request",
                      "executionMode": "runtime",
                      "queue": false,
                      "attachments":[]
                    }
                  }
                }"#,
            ))
            .expect("build turn request");
        let turn_response = app
            .clone()
            .oneshot(turn_request)
            .await
            .expect("turn response");
        assert_eq!(turn_response.status(), StatusCode::OK);

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
            ready_payload["runtimeDiagnostics"]["oauthRoutingDecryptFailedTotal"]
                .as_u64()
                .unwrap_or(0)
                >= 1
        );

        cleanup_sqlite_db(db_path.as_path());
    }

    #[test]
    fn validate_service_config_reports_endpoint_errors_without_provider_key_warnings() {
        let mut config = test_service_config();
        config.openai_endpoint = "not-a-url".to_string();

        let validation = validate_service_config(&config);
        assert!(validation
            .errors
            .iter()
            .any(|entry| entry.contains("CODE_RUNTIME_SERVICE_OPENAI_ENDPOINT")));
        assert!(!validation
            .warnings
            .iter()
            .any(|entry| entry.contains("OPENAI_API_KEY")));
    }

    #[test]
    fn validate_service_config_oauth_first_mode_avoids_startup_provider_warnings() {
        let mut config = test_service_config();
        config.default_model_id = DEFAULT_GEMINI_MODEL_ID.to_string();

        let validation = validate_service_config(&config);
        assert!(validation.errors.is_empty());
        assert!(!validation
            .warnings
            .iter()
            .any(|entry| entry.contains("OPENAI_API_KEY")));
        assert!(!validation
            .warnings
            .iter()
            .any(|entry| entry.contains("ANTHROPIC_API_KEY")));
        assert!(!validation
            .warnings
            .iter()
            .any(|entry| entry.contains("GEMINI_API_KEY")));
        assert!(!validation
            .warnings
            .iter()
            .any(|entry| entry.contains("Default model provider is not fully configured")));
    }

    #[test]
    fn validate_service_config_compat_mode_avoids_provider_key_warnings() {
        let mut config = test_service_config_with_openai_compat("http://127.0.0.1:8045/v1");
        config.default_model_id = "claude-sonnet-4-5".to_string();
        config.anthropic_api_key = None;
        config.gemini_api_key = None;
        config.openai_api_key = None;

        let validation = validate_service_config(&config);
        assert!(validation.errors.is_empty());
        assert!(!validation
            .warnings
            .iter()
            .any(|entry| entry.contains("OPENAI_API_KEY")));
        assert!(!validation
            .warnings
            .iter()
            .any(|entry| entry.contains("ANTHROPIC_API_KEY")));
        assert!(!validation
            .warnings
            .iter()
            .any(|entry| entry.contains("GEMINI_API_KEY")));
        assert!(!validation
            .warnings
            .iter()
            .any(|entry| entry.contains("Default model provider is not fully configured")));
    }

    #[test]
    fn validate_service_config_compat_oauth_only_avoids_provider_and_compat_warnings() {
        let mut config =
            test_service_config_with_openai_compat_oauth_only("http://127.0.0.1:8045/v1");
        config.default_model_id = "claude-sonnet-4-5".to_string();

        let validation = validate_service_config(&config);
        assert!(validation.errors.is_empty());
        assert!(!validation
            .warnings
            .iter()
            .any(|entry| entry.contains("OPENAI_API_KEY")));
        assert!(!validation
            .warnings
            .iter()
            .any(|entry| entry.contains("ANTHROPIC_API_KEY")));
        assert!(!validation
            .warnings
            .iter()
            .any(|entry| entry.contains("GEMINI_API_KEY")));
        assert!(!validation
            .warnings
            .iter()
            .any(|entry| entry.contains("OpenAI-compat mode is enabled but no compatible API key is configured")));
        assert!(!validation
            .warnings
            .iter()
            .any(|entry| entry.contains("Default model provider is not fully configured")));
    }

    #[test]
    fn validate_service_config_warns_for_zero_openai_timeout_and_retry_base() {
        let mut config = test_service_config();
        config.openai_timeout_ms = 0;
        config.openai_retry_base_ms = 0;

        let validation = validate_service_config(&config);
        assert!(validation.errors.is_empty());
        assert!(validation
            .warnings
            .iter()
            .any(|entry| entry.contains("CODE_RUNTIME_SERVICE_OPENAI_TIMEOUT_MS")));
        assert!(validation
            .warnings
            .iter()
            .any(|entry| entry.contains("CODE_RUNTIME_SERVICE_OPENAI_RETRY_BASE_MS")));
    }

    #[test]
    fn validate_service_config_warns_for_invalid_ws_transport_limits() {
        let mut config = test_service_config();
        config.ws_write_buffer_size_bytes = 0;
        config.ws_max_write_buffer_size_bytes = 0;
        config.ws_max_frame_size_bytes = 0;
        config.ws_max_message_size_bytes = 0;

        let validation = validate_service_config(&config);
        assert!(validation.errors.is_empty());
        assert!(validation
            .warnings
            .iter()
            .any(|entry| { entry.contains("CODE_RUNTIME_SERVICE_WS_WRITE_BUFFER_SIZE_BYTES") }));
        assert!(validation.warnings.iter().any(|entry| {
            entry.contains("CODE_RUNTIME_SERVICE_WS_MAX_WRITE_BUFFER_SIZE_BYTES")
        }));
        assert!(validation
            .warnings
            .iter()
            .any(|entry| { entry.contains("CODE_RUNTIME_SERVICE_WS_MAX_FRAME_SIZE_BYTES") }));
        assert!(validation
            .warnings
            .iter()
            .any(|entry| { entry.contains("CODE_RUNTIME_SERVICE_WS_MAX_MESSAGE_SIZE_BYTES") }));
    }

    #[test]
    fn validate_service_config_warns_for_inconsistent_ws_transport_limits() {
        let mut config = test_service_config();
        config.ws_write_buffer_size_bytes = 128 * 1024;
        config.ws_max_write_buffer_size_bytes = 64 * 1024;
        config.ws_max_frame_size_bytes = 2 * 1024 * 1024;
        config.ws_max_message_size_bytes = 1 * 1024 * 1024;

        let validation = validate_service_config(&config);
        assert!(validation.errors.is_empty());
        assert!(validation.warnings.iter().any(|entry| {
            entry.contains("CODE_RUNTIME_SERVICE_WS_MAX_WRITE_BUFFER_SIZE_BYTES")
                && entry.contains("backpressure headroom")
        }));
        assert!(validation.warnings.iter().any(|entry| {
            entry.contains("CODE_RUNTIME_SERVICE_WS_MAX_MESSAGE_SIZE_BYTES")
                && entry.contains("protocol consistency")
        }));
    }

    #[test]
    fn validate_service_config_warns_for_oversized_ws_transport_limits() {
        let mut config = test_service_config();
        config.ws_max_write_buffer_size_bytes = MAX_RUNTIME_WS_MAX_WRITE_BUFFER_SIZE_BYTES_HARD + 1;
        config.ws_max_frame_size_bytes = MAX_RUNTIME_WS_MAX_FRAME_SIZE_BYTES_HARD + 1;
        config.ws_max_message_size_bytes = MAX_RUNTIME_WS_MAX_MESSAGE_SIZE_BYTES_HARD + 1;

        let validation = validate_service_config(&config);
        assert!(validation.errors.is_empty());
        assert!(validation
            .warnings
            .iter()
            .any(|entry| entry.contains("CODE_RUNTIME_SERVICE_WS_MAX_WRITE_BUFFER_SIZE_BYTES")));
        assert!(validation
            .warnings
            .iter()
            .any(|entry| entry.contains("CODE_RUNTIME_SERVICE_WS_MAX_FRAME_SIZE_BYTES")));
        assert!(validation
            .warnings
            .iter()
            .any(|entry| entry.contains("CODE_RUNTIME_SERVICE_WS_MAX_MESSAGE_SIZE_BYTES")));
    }

    #[test]
    fn validate_service_config_warns_for_invalid_ws_connection_limit() {
        let mut config = test_service_config();
        config.ws_max_connections = 0;

        let validation = validate_service_config(&config);
        assert!(validation.errors.is_empty());
        assert!(validation
            .warnings
            .iter()
            .any(|entry| entry.contains("CODE_RUNTIME_SERVICE_WS_MAX_CONNECTIONS")));
    }

    #[test]
    fn validate_service_config_warns_for_oversized_ws_connection_limit() {
        let mut config = test_service_config();
        config.ws_max_connections = MAX_RUNTIME_WS_MAX_CONNECTIONS_HARD + 1;

        let validation = validate_service_config(&config);
        assert!(validation.errors.is_empty());
        assert!(validation
            .warnings
            .iter()
            .any(|entry| entry.contains("CODE_RUNTIME_SERVICE_WS_MAX_CONNECTIONS")));
    }

    #[test]
    fn resolve_ws_transport_limits_clamps_invalid_values() {
        let mut config = test_service_config();
        config.ws_write_buffer_size_bytes = 0;
        config.ws_max_write_buffer_size_bytes = 0;
        config.ws_max_frame_size_bytes = 0;
        config.ws_max_message_size_bytes = 0;

        let limits = resolve_ws_transport_limits(&config);
        assert_eq!(limits.write_buffer_size_bytes, 1);
        assert_eq!(limits.max_write_buffer_size_bytes, 2);
        assert_eq!(limits.max_frame_size_bytes, 1);
        assert_eq!(limits.max_message_size_bytes, 1);
    }

    #[test]
    fn resolve_ws_transport_limits_clamps_oversized_values_to_hard_caps() {
        let mut config = test_service_config();
        config.ws_write_buffer_size_bytes = usize::MAX;
        config.ws_max_write_buffer_size_bytes = usize::MAX;
        config.ws_max_frame_size_bytes = usize::MAX;
        config.ws_max_message_size_bytes = usize::MAX;

        let limits = resolve_ws_transport_limits(&config);
        assert_eq!(
            limits.write_buffer_size_bytes,
            MAX_RUNTIME_WS_WRITE_BUFFER_SIZE_BYTES_HARD
        );
        assert_eq!(
            limits.max_write_buffer_size_bytes,
            MAX_RUNTIME_WS_MAX_WRITE_BUFFER_SIZE_BYTES_HARD
        );
        assert_eq!(
            limits.max_frame_size_bytes,
            MAX_RUNTIME_WS_MAX_FRAME_SIZE_BYTES_HARD
        );
        assert_eq!(
            limits.max_message_size_bytes,
            MAX_RUNTIME_WS_MAX_MESSAGE_SIZE_BYTES_HARD
        );
    }

    #[test]
    fn resolve_ws_max_connections_clamps_invalid_values() {
        let mut config = test_service_config();
        config.ws_max_connections = 0;
        assert_eq!(resolve_ws_max_connections(&config), 1);
    }

    #[test]
    fn resolve_ws_max_connections_clamps_oversized_values() {
        let mut config = test_service_config();
        config.ws_max_connections = usize::MAX;
        assert_eq!(
            resolve_ws_max_connections(&config),
            MAX_RUNTIME_WS_MAX_CONNECTIONS_HARD
        );
    }

    #[test]
    fn validate_service_config_warns_for_excessive_openai_retry_budget() {
        let mut config = test_service_config();
        config.openai_max_retries = 12;

        let validation = validate_service_config(&config);
        assert!(validation.errors.is_empty());
        assert!(validation
            .warnings
            .iter()
            .any(|entry| entry.contains("CODE_RUNTIME_SERVICE_OPENAI_MAX_RETRIES")));
    }

    #[test]
    fn validate_service_config_warns_for_zero_openai_compat_model_cache_ttl() {
        let mut config = test_service_config();
        config.openai_compat_model_cache_ttl_ms = 0;

        let validation = validate_service_config(&config);
        assert!(validation.errors.is_empty());
        assert!(validation.warnings.iter().any(|entry| {
            entry.contains("CODE_RUNTIME_SERVICE_OPENAI_COMPAT_MODEL_CACHE_TTL_MS")
        }));
    }

    #[test]
    fn validate_service_config_warns_for_low_openai_compat_model_cache_ttl() {
        let mut config = test_service_config();
        config.openai_compat_model_cache_ttl_ms =
            MIN_RECOMMENDED_OPENAI_COMPAT_MODEL_CACHE_TTL_MS - 1;

        let validation = validate_service_config(&config);
        assert!(validation.errors.is_empty());
        assert!(validation.warnings.iter().any(|entry| {
            entry.contains("CODE_RUNTIME_SERVICE_OPENAI_COMPAT_MODEL_CACHE_TTL_MS")
                && entry.contains("routing jitter")
        }));
    }

    #[test]
    fn openai_http_timeout_clamps_zero_to_one_millisecond() {
        let mut config = test_service_config();
        config.openai_timeout_ms = 0;
        assert_eq!(openai_http_timeout(&config), Duration::from_millis(1));
    }

    #[test]
    fn openai_http_timeout_preserves_positive_timeout() {
        let mut config = test_service_config();
        config.openai_timeout_ms = 2_500;
        assert_eq!(openai_http_timeout(&config), Duration::from_millis(2_500));
    }

    #[test]
    fn validate_service_config_accepts_complete_valid_configuration() {
        let mut config = test_service_config();
        config.openai_api_key = Some("test-key".to_string());
        config.anthropic_api_key = Some("test-key".to_string());
        config.gemini_api_key = Some("test-key".to_string());

        let validation = validate_service_config(&config);
        assert!(validation.errors.is_empty());
        assert!(validation.warnings.is_empty());
    }

    #[test]
    fn validate_service_config_warns_for_missing_oauth_pool_parent_directory() {
        let mut config = test_service_config();
        config.oauth_pool_db_path = format!(
            "{}/missing-parent-{}/oauth-pool.db",
            std::env::temp_dir().display(),
            rand::random::<u64>()
        );

        let validation = validate_service_config(&config);
        assert!(validation.errors.is_empty());
        assert!(validation
            .warnings
            .iter()
            .any(|entry| entry.contains("CODE_RUNTIME_SERVICE_OAUTH_POOL_DB parent directory")));
    }

    #[test]
    fn validate_service_config_warns_for_invalid_oauth_secret_key() {
        let mut config = test_service_config();
        config.oauth_secret_key = Some("invalid-base64-secret".to_string());

        let validation = validate_service_config(&config);
        assert!(validation.errors.is_empty());
        assert!(validation.warnings.iter().any(|entry| {
            entry.contains("CODE_RUNTIME_SERVICE_OAUTH_SECRET_KEY is invalid")
                && entry.contains("fall back without secret key")
        }));
    }

    #[test]
    fn validate_service_config_rejects_invalid_oauth_public_base_url() {
        let mut config = test_service_config();
        config.oauth_public_base_url = Some("://bad-url".to_string());

        let validation = validate_service_config(&config);
        assert!(validation.errors.iter().any(|entry| {
            entry.contains("CODE_RUNTIME_SERVICE_OAUTH_PUBLIC_BASE_URL is invalid")
        }));
    }

    #[test]
    fn validate_service_config_rejects_zero_agent_concurrency_limit() {
        let mut config = test_service_config();
        config.agent_max_concurrent_tasks = 0;

        let validation = validate_service_config(&config);
        assert!(validation
            .errors
            .iter()
            .any(|entry| { entry.contains("CODE_RUNTIME_SERVICE_AGENT_MAX_CONCURRENT_TASKS") }));
    }

    #[test]
    fn validate_service_config_rejects_agent_concurrency_limit_above_maximum() {
        let mut config = test_service_config();
        config.agent_max_concurrent_tasks = MAX_AGENT_MAX_CONCURRENT_TASKS + 1;

        let validation = validate_service_config(&config);
        assert!(validation
            .errors
            .iter()
            .any(|entry| { entry.contains("CODE_RUNTIME_SERVICE_AGENT_MAX_CONCURRENT_TASKS") }));
    }

    #[test]
    fn validate_service_config_rejects_zero_agent_task_history_limit() {
        let mut config = test_service_config();
        config.agent_task_history_limit = 0;

        let validation = validate_service_config(&config);
        assert!(validation
            .errors
            .iter()
            .any(|entry| { entry.contains("CODE_RUNTIME_SERVICE_AGENT_TASK_HISTORY_LIMIT") }));
    }

    #[test]
    fn validate_service_config_rejects_agent_task_history_limit_above_maximum() {
        let mut config = test_service_config();
        config.agent_task_history_limit = MAX_AGENT_TASK_HISTORY_LIMIT + 1;

        let validation = validate_service_config(&config);
        assert!(validation
            .errors
            .iter()
            .any(|entry| { entry.contains("CODE_RUNTIME_SERVICE_AGENT_TASK_HISTORY_LIMIT") }));
    }

    #[test]
    fn validate_service_config_rejects_agent_history_limit_below_concurrency_limit() {
        let mut config = test_service_config();
        config.agent_max_concurrent_tasks = 16;
        config.agent_task_history_limit = 8;

        let validation = validate_service_config(&config);
        assert!(validation.errors.iter().any(|entry| {
            entry.contains("CODE_RUNTIME_SERVICE_AGENT_TASK_HISTORY_LIMIT")
                && entry.contains("CODE_RUNTIME_SERVICE_AGENT_MAX_CONCURRENT_TASKS")
        }));
    }

    #[tokio::test]
    async fn readiness_includes_distributed_snapshot_defaults() {
        let app = test_router();
        let request = Request::builder()
            .method("GET")
            .uri("/ready")
            .body(Body::empty())
            .expect("build ready request");
        let response = app.oneshot(request).await.expect("ready response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read ready body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse ready payload");
        assert_eq!(payload["distributed"]["enabled"], Value::Bool(false));
        assert_eq!(payload["distributed"]["redisConnected"], Value::Bool(true));
        assert_eq!(
            payload["distributed"]["invalidCommandEntries"],
            Value::Number(0.into())
        );
    }

    #[tokio::test]
    async fn readiness_reports_distributed_mode_when_enabled() {
        let mut config = test_service_config();
        config.distributed_enabled = true;
        config.distributed_redis_url = Some("redis://127.0.0.1:1/0".to_string());
        let app = test_router_with_config(config);
        let request = Request::builder()
            .method("GET")
            .uri("/ready")
            .body(Body::empty())
            .expect("build ready request");
        let response = app.oneshot(request).await.expect("ready response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read ready body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse ready payload");
        assert_eq!(payload["distributed"]["enabled"], Value::Bool(true));
        assert_eq!(payload["distributed"]["redisConnected"], Value::Bool(false));
        assert_eq!(
            payload["distributed"]["invalidCommandEntries"],
            Value::Number(0.into())
        );
    }

    #[tokio::test]
    async fn readiness_reports_backend_pool_observability_counters() {
        let app = test_router();
        for (backend_id, status) in [
            ("worker-active", "active"),
            ("worker-draining", "draining"),
            ("worker-disabled", "disabled"),
        ] {
            let payload = send_rpc_request(
                app.clone(),
                json!({
                    "method": "code_runtime_backend_upsert",
                    "params": {
                        "backendId": backend_id,
                        "displayName": backend_id,
                        "capabilities": ["code"],
                        "maxConcurrency": 4,
                        "costTier": "standard",
                        "latencyClass": "regional",
                        "rolloutState": "current",
                        "status": status
                    }
                }),
            )
            .await;
            assert_eq!(payload["ok"], Value::Bool(true));
        }

        let request = Request::builder()
            .method("GET")
            .uri("/ready")
            .body(Body::empty())
            .expect("build ready request");
        let response = app.oneshot(request).await.expect("ready response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read ready body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse ready payload");
        assert_eq!(payload["distributed"]["backendsTotal"], Value::Number(3.into()));
        assert_eq!(
            payload["distributed"]["backendsHealthy"],
            Value::Number(1.into())
        );
        assert_eq!(
            payload["distributed"]["backendsDraining"],
            Value::Number(1.into())
        );
        assert_eq!(
            payload["distributed"]["placementFailuresTotal"],
            Value::Number(0.into())
        );
    }

    #[tokio::test]
    async fn readiness_tracks_backend_placement_failures_total() {
        let app = test_router();
        let start_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_start_v2",
                "params": {
                    "workspaceId": "workspace-web",
                    "executionMode": "distributed",
                    "requiredCapabilities": ["code"],
                    "steps": [
                        { "kind": "read", "input": "trigger distributed placement failure" }
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

        let request = Request::builder()
            .method("GET")
            .uri("/ready")
            .body(Body::empty())
            .expect("build ready request");
        let response = app.oneshot(request).await.expect("ready response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read ready body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse ready payload");
        let failures_total = payload["distributed"]["placementFailuresTotal"]
            .as_u64()
            .unwrap_or(0);
        assert!(failures_total >= 1);
    }

    #[tokio::test]
    async fn readiness_aggregates_distributed_dispatch_errors_by_source() {
        let mut config = test_service_config();
        config.distributed_enabled = true;
        let temp_dir = tempfile::tempdir().expect("temp native state dir");
        let native_state_store = Arc::new(crate::native_state_store::NativeStateStore::new(
            temp_dir.path().join("native-state.sqlite"),
        ));
        let ctx = build_app_context(
            create_initial_state("gpt-5.3-codex"),
            config,
            native_state_store,
        );

        set_distributed_dispatch_error(
            &ctx,
            DISTRIBUTED_ERROR_SOURCE_STATE_SYNC,
            "failed to persist distributed task summary",
        )
        .await;
        set_distributed_dispatch_error(
            &ctx,
            DISTRIBUTED_ERROR_SOURCE_BOOTSTRAP,
            "failed to construct redis bootstrap client",
        )
        .await;

        let snapshot = build_cached_distributed_readiness_snapshot(&ctx).await;
        let dispatch_error = snapshot
            .last_dispatch_error
            .as_deref()
            .expect("dispatch error");
        let bootstrap_index = dispatch_error
            .find("bootstrap:")
            .expect("bootstrap source present");
        let state_sync_index = dispatch_error
            .find("state-sync:")
            .expect("state-sync source present");
        assert!(dispatch_error.contains(" | "));
        assert!(bootstrap_index < state_sync_index);
    }

    #[test]
    fn compute_pending_task_metrics_ignores_terminal_states() {
        let now = 20_000u64;
        let (pending, oldest) = compute_pending_task_metrics(
            [
                ("queued", 10_000u64),
                ("running", 11_000u64),
                ("awaiting_approval", 12_000u64),
                ("completed", 1_000u64),
                ("failed", 2_000u64),
                ("cancelled", 3_000u64),
                ("interrupted", 4_000u64),
            ],
            now,
        );
        assert_eq!(pending, 3);
        assert_eq!(oldest, Some(10_000));
    }

    #[test]
    fn normalize_distributed_dispatch_error_message_keeps_short_message() {
        let message = "enqueue: upstream timeout".to_string();
        let normalized = normalize_distributed_dispatch_error_message(message.clone());
        assert_eq!(normalized, message);
    }

    #[test]
    fn normalize_distributed_dispatch_error_message_truncates_oversized_message() {
        let message = "x".repeat(MAX_DISTRIBUTED_DISPATCH_ERROR_CHARS + 128);
        let normalized = normalize_distributed_dispatch_error_message(message);
        assert_eq!(
            normalized.chars().count(),
            MAX_DISTRIBUTED_DISPATCH_ERROR_CHARS
        );
        assert!(normalized.ends_with('…'));
    }

    #[test]
    fn normalize_distributed_dispatch_error_message_collapses_whitespace() {
        let message = " enqueue:\n\tupstream   timeout \r\n".to_string();
        let normalized = normalize_distributed_dispatch_error_message(message);
        assert_eq!(normalized, "enqueue: upstream timeout");
    }

    #[test]
    fn normalize_distributed_dispatch_error_message_falls_back_for_empty_input() {
        let message = " \n\t\r ".to_string();
        let normalized = normalize_distributed_dispatch_error_message(message);
        assert_eq!(normalized, "unknown distributed dispatch error");
    }

    #[test]
    fn truncate_chars_with_ellipsis_handles_small_limits() {
        assert_eq!(truncate_chars_with_ellipsis("abc", 0), "");
        assert_eq!(truncate_chars_with_ellipsis("abc", 1), "…");
        assert_eq!(truncate_chars_with_ellipsis("abc", 2), "a…");
    }

    #[test]
    fn truncate_chars_with_ellipsis_keeps_short_strings() {
        assert_eq!(truncate_chars_with_ellipsis("abc", 8), "abc");
    }

    #[test]
    fn normalize_distributed_dispatch_error_source_keeps_known_sources() {
        assert_eq!(
            normalize_distributed_dispatch_error_source(DISTRIBUTED_ERROR_SOURCE_BOOTSTRAP),
            DISTRIBUTED_ERROR_SOURCE_BOOTSTRAP
        );
        assert_eq!(
            normalize_distributed_dispatch_error_source(DISTRIBUTED_ERROR_SOURCE_STATE_SYNC),
            DISTRIBUTED_ERROR_SOURCE_STATE_SYNC
        );
        assert_eq!(
            normalize_distributed_dispatch_error_source(DISTRIBUTED_ERROR_SOURCE_BACKEND_REGISTRY),
            DISTRIBUTED_ERROR_SOURCE_BACKEND_REGISTRY
        );
        assert_eq!(
            normalize_distributed_dispatch_error_source(DISTRIBUTED_ERROR_SOURCE_WORKER),
            DISTRIBUTED_ERROR_SOURCE_WORKER
        );
        assert_eq!(
            normalize_distributed_dispatch_error_source(DISTRIBUTED_ERROR_SOURCE_DISCOVERY),
            DISTRIBUTED_ERROR_SOURCE_DISCOVERY
        );
        assert_eq!(
            normalize_distributed_dispatch_error_source(DISTRIBUTED_ERROR_SOURCE_ENQUEUE),
            DISTRIBUTED_ERROR_SOURCE_ENQUEUE
        );
    }

    #[test]
    fn normalize_distributed_dispatch_error_source_maps_unknown_to_bucket() {
        assert_eq!(
            normalize_distributed_dispatch_error_source("dynamic-source"),
            DISTRIBUTED_ERROR_SOURCE_UNKNOWN
        );
    }

    #[test]
    fn resolve_cached_distributed_readiness_snapshot_hits_within_ttl() {
        let now = Instant::now();
        let snapshot = distributed::diagnostics::DistributedReadinessSnapshot {
            enabled: true,
            redis_connected: false,
            lane_count: 2,
            worker_count: 4,
            backends_total: 6,
            backends_healthy: 5,
            backends_draining: 1,
            placement_failures_total: 3,
            pending_entries: 9,
            invalid_command_entries: 2,
            oldest_pending_ms: Some(1200),
            last_dispatch_error: Some("worker: timeout".to_string()),
        };
        let cached = CachedDistributedReadinessSnapshot {
            snapshot: snapshot.clone(),
            fetched_at: now - Duration::from_millis(300),
        };

        let resolved = resolve_cached_distributed_readiness_snapshot(Some(&cached), now)
            .expect("snapshot should be served from cache");
        assert_eq!(resolved.enabled, snapshot.enabled);
        assert_eq!(resolved.pending_entries, snapshot.pending_entries);
        assert_eq!(
            resolved.last_dispatch_error.as_deref(),
            snapshot.last_dispatch_error.as_deref()
        );
    }

    #[test]
    fn resolve_cached_distributed_readiness_snapshot_expires_after_ttl() {
        let now = Instant::now();
        let cached = CachedDistributedReadinessSnapshot {
            snapshot: distributed::diagnostics::DistributedReadinessSnapshot {
                enabled: true,
                redis_connected: true,
                lane_count: 1,
                worker_count: 1,
                backends_total: 1,
                backends_healthy: 1,
                backends_draining: 0,
                placement_failures_total: 0,
                pending_entries: 1,
                invalid_command_entries: 0,
                oldest_pending_ms: Some(10),
                last_dispatch_error: None,
            },
            fetched_at: now - Duration::from_millis(700),
        };

        assert!(resolve_cached_distributed_readiness_snapshot(Some(&cached), now).is_none());
    }

    #[test]
    fn merge_optional_errors_combines_inputs() {
        assert_eq!(merge_optional_errors(None, None), None);
        assert_eq!(
            merge_optional_errors(Some("first"), None),
            Some("first".to_string())
        );
        assert_eq!(
            merge_optional_errors(None, Some("second")),
            Some("second".to_string())
        );
        assert_eq!(
            merge_optional_errors(Some("first"), Some("second")),
            Some("first | second".to_string())
        );
    }

    #[test]
    fn initialize_oauth_pool_fails_closed_without_panic_when_all_backends_fail() {
        let config = test_service_config();
        let (store, bootstrap_error) =
            initialize_oauth_pool_with_opener(&config, |_path, _secret_key| {
                Err("forced oauth bootstrap failure".to_string())
            });
        let bootstrap_error = bootstrap_error.expect("bootstrap error should be present");
        assert!(bootstrap_error.contains("forced oauth bootstrap failure"));

        let diagnostics_error = store
            .diagnostics()
            .expect_err("unavailable oauth pool should fail closed");
        assert!(diagnostics_error.contains("OAuth pool store unavailable"));
        assert!(diagnostics_error.contains("forced oauth bootstrap failure"));
    }

    #[test]
    fn distributed_enqueue_mode_uses_strict_for_start_and_unknown_kinds() {
        assert_eq!(
            distributed_enqueue_mode_for_kind(distributed::queue::COMMAND_KIND_TASK_START),
            DistributedCommandEnqueueMode::Strict
        );
        assert_eq!(
            distributed_enqueue_mode_for_kind("task.unknown"),
            DistributedCommandEnqueueMode::Strict
        );
    }

    #[test]
    fn distributed_enqueue_mode_uses_best_effort_for_control_plane_commands() {
        assert_eq!(
            distributed_enqueue_mode_for_kind(distributed::queue::COMMAND_KIND_TASK_INTERRUPT),
            DistributedCommandEnqueueMode::BestEffort
        );
        assert_eq!(
            distributed_enqueue_mode_for_kind(distributed::queue::COMMAND_KIND_APPROVAL_DECISION),
            DistributedCommandEnqueueMode::BestEffort
        );
    }

    #[test]
    fn supported_distributed_command_kind_matches_contract() {
        assert!(is_supported_distributed_command_kind(
            distributed::queue::COMMAND_KIND_TASK_START
        ));
        assert!(is_supported_distributed_command_kind(
            distributed::queue::COMMAND_KIND_TASK_INTERRUPT
        ));
        assert!(is_supported_distributed_command_kind(
            distributed::queue::COMMAND_KIND_APPROVAL_DECISION
        ));
        assert!(!is_supported_distributed_command_kind("task.unknown"));
    }

    #[test]
    fn reclaim_loop_schedule_uses_fixed_interval() {
        assert!(should_reclaim_distributed_pending(0, 0));
        assert!(!should_reclaim_distributed_pending(1, 0));
        assert!(!should_reclaim_distributed_pending(
            DISTRIBUTED_WORKER_RECLAIM_INTERVAL_LOOPS.saturating_sub(1),
            0,
        ));
        assert!(should_reclaim_distributed_pending(
            DISTRIBUTED_WORKER_RECLAIM_INTERVAL_LOOPS,
            0
        ));
    }

    #[test]
    fn distributed_worker_read_blocking_enabled_for_single_lane() {
        assert_eq!(
            resolve_distributed_worker_read_block_ms(1),
            DISTRIBUTED_WORKER_POLL_INTERVAL_MS
        );
    }

    #[test]
    fn distributed_worker_read_blocking_disabled_for_multi_lane() {
        assert_eq!(resolve_distributed_worker_read_block_ms(0), 0);
        assert_eq!(resolve_distributed_worker_read_block_ms(2), 0);
    }

    #[test]
    fn distributed_worker_idle_polling_sleeps_between_iterations() {
        assert!(should_sleep_after_distributed_worker_iteration(0, false));
    }

    #[test]
    fn distributed_worker_active_polling_yields_without_forced_sleep() {
        assert!(!should_sleep_after_distributed_worker_iteration(0, true));
        assert!(!should_sleep_after_distributed_worker_iteration(
            DISTRIBUTED_WORKER_POLL_INTERVAL_MS,
            true
        ));
    }

    #[test]
    fn reclaim_loop_schedule_staggers_by_worker_index() {
        let interval = DISTRIBUTED_WORKER_RECLAIM_INTERVAL_LOOPS;
        assert!(should_reclaim_distributed_pending(0, 0));
        assert!(should_reclaim_distributed_pending(
            interval.saturating_sub(1),
            1
        ));
        assert!(should_reclaim_distributed_pending(
            interval.saturating_sub(2),
            2
        ));
        assert!(should_reclaim_distributed_pending(interval, 0));
        assert!(should_reclaim_distributed_pending(
            interval.saturating_mul(2),
            0
        ));
    }

    #[tokio::test]
    async fn distributed_task_start_fails_closed_without_redis_client() {
        let mut config = test_service_config();
        config.distributed_enabled = true;
        // `redis::Client::open` fails for this value, simulating broken bootstrap.
        config.distributed_redis_url = Some("://invalid-redis-url".to_string());
        let app = test_router_with_config(config);
        let workspace_id = format!("workspace-web-{}", rand::random::<u64>());

        let start_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_start_v2",
                "params": {
                    "workspaceId": workspace_id,
                    "steps": [
                        { "kind": "read", "path": "README.md" }
                    ]
                }
            }),
        )
        .await;
        assert_eq!(start_payload["ok"], Value::Bool(false));
        assert_eq!(
            start_payload["error"]["code"],
            Value::String("INTERNAL_ERROR".to_string())
        );

        let list_payload = send_rpc_request(
            app,
            json!({
                "method": "code_runtime_runs_list",
                "params": { "workspaceId": workspace_id }
            }),
        )
        .await;
        assert_eq!(list_payload["ok"], Value::Bool(true));
        assert_eq!(
            list_payload["result"].as_array().map(|items| items.len()),
            Some(0)
        );
    }

    #[test]
    fn validate_service_config_rejects_distributed_mode_without_redis_url() {
        let mut config = test_service_config();
        config.distributed_enabled = true;
        config.distributed_redis_url = None;

        let validation = validate_service_config(&config);
        assert!(validation
            .errors
            .iter()
            .any(|entry| entry.contains("CODE_RUNTIME_SERVICE_DISTRIBUTED_REDIS_URL")));
    }

    #[test]
    fn validate_service_config_rejects_invalid_distributed_limits() {
        let mut config = test_service_config();
        config.distributed_enabled = true;
        config.distributed_redis_url = Some("redis://127.0.0.1:6379/0".to_string());
        config.distributed_lane_count = 0;
        config.distributed_worker_concurrency = 0;
        config.distributed_claim_idle_ms = 0;

        let validation = validate_service_config(&config);
        assert!(validation
            .errors
            .iter()
            .any(|entry| entry.contains("CODE_RUNTIME_SERVICE_DISTRIBUTED_LANE_COUNT")));
        assert!(validation.errors.iter().any(|entry| {
            entry.contains("CODE_RUNTIME_SERVICE_DISTRIBUTED_WORKER_CONCURRENCY")
        }));
        assert!(validation
            .errors
            .iter()
            .any(|entry| entry.contains("CODE_RUNTIME_SERVICE_DISTRIBUTED_CLAIM_IDLE_MS")));
    }

    #[test]
    fn parse_local_codex_cli_auth_profile_prefers_openai_api_key_and_extracts_id_token_fields() {
        let id_token_payload = json!({
            "email": "user@example.com",
            "sub": "subject-123",
            "https://api.openai.com/auth": {
                "chatgpt_account_id": "chatgpt-account-123",
                "chatgpt_plan_type": "pro"
            }
        });
        let id_token = format!(
            "header.{}.signature",
            URL_SAFE_NO_PAD.encode(id_token_payload.to_string())
        );
        let payload = json!({
            "auth_mode": "chatgpt",
            "last_refresh": "2026-02-12T14:35:04.312445Z",
            "OPENAI_API_KEY": "sk-local-key",
            "tokens": {
                "access_token": "access-token-fallback",
                "refresh_token": "refresh-token-1",
                "account_id": "tokens-account-1",
                "id_token": id_token
            }
        });

        let profile = parse_local_codex_cli_auth_profile_from_value(&payload)
            .expect("profile should parse from valid auth payload");
        assert_eq!(
            profile.external_account_id.as_deref(),
            Some("tokens-account-1")
        );
        assert_eq!(profile.email.as_deref(), Some("user@example.com"));
        assert_eq!(profile.auth_mode.as_deref(), Some("chatgpt"));
        assert_eq!(profile.plan_type.as_deref(), Some("pro"));
        assert_eq!(
            profile.last_refresh.as_deref(),
            Some("2026-02-12T14:35:04.312445Z")
        );
        assert_eq!(profile.openai_api_key.as_deref(), Some("sk-local-key"));
        assert!(profile.id_token.as_deref().is_some());
        assert_eq!(
            profile.access_token.as_deref(),
            Some("access-token-fallback")
        );
        assert_eq!(profile.refresh_token.as_deref(), Some("refresh-token-1"));
        assert_eq!(profile.api_credential.as_deref(), Some("sk-local-key"));
        assert_eq!(
            profile.api_credential_source.as_deref(),
            Some("openai_api_key")
        );
    }

    #[test]
    fn parse_local_codex_cli_auth_profile_falls_back_to_access_token() {
        let payload = json!({
            "auth_mode": "chatgpt",
            "OPENAI_API_KEY": null,
            "tokens": {
                "access_token": "access-token-only",
                "refresh_token": "refresh-token-only",
                "account_id": "tokens-account-2"
            }
        });

        let profile = parse_local_codex_cli_auth_profile_from_value(&payload)
            .expect("profile should parse when access token is present");
        assert_eq!(
            profile.external_account_id.as_deref(),
            Some("tokens-account-2")
        );
        assert_eq!(profile.email, None);
        assert_eq!(profile.openai_api_key, None);
        assert_eq!(profile.id_token, None);
        assert_eq!(profile.access_token.as_deref(), Some("access-token-only"));
        assert_eq!(profile.refresh_token.as_deref(), Some("refresh-token-only"));
        assert_eq!(profile.api_credential.as_deref(), Some("access-token-only"));
        assert_eq!(
            profile.api_credential_source.as_deref(),
            Some("access_token")
        );
    }

    #[test]
    fn should_attempt_local_codex_sync_applies_min_interval_throttle() {
        let last_attempt_ms = AtomicU64::new(0);
        assert!(should_attempt_local_codex_sync(
            1_000,
            &last_attempt_ms,
            LOCAL_CODEX_CLI_SYNC_MIN_INTERVAL_MS,
        ));
        assert!(!should_attempt_local_codex_sync(
            1_001,
            &last_attempt_ms,
            LOCAL_CODEX_CLI_SYNC_MIN_INTERVAL_MS,
        ));
        assert!(!should_attempt_local_codex_sync(
            5_999,
            &last_attempt_ms,
            LOCAL_CODEX_CLI_SYNC_MIN_INTERVAL_MS,
        ));
        assert!(should_attempt_local_codex_sync(
            6_000,
            &last_attempt_ms,
            LOCAL_CODEX_CLI_SYNC_MIN_INTERVAL_MS,
        ));
    }

    #[test]
    fn should_attempt_local_codex_sync_does_not_advance_timestamp_while_throttled() {
        let last_attempt_ms = AtomicU64::new(10_000);
        assert!(!should_attempt_local_codex_sync(
            10_500,
            &last_attempt_ms,
            LOCAL_CODEX_CLI_SYNC_MIN_INTERVAL_MS,
        ));
        assert_eq!(last_attempt_ms.load(AtomicOrdering::Relaxed), 10_000);

        assert!(!should_attempt_local_codex_sync(
            14_999,
            &last_attempt_ms,
            LOCAL_CODEX_CLI_SYNC_MIN_INTERVAL_MS,
        ));
        assert_eq!(last_attempt_ms.load(AtomicOrdering::Relaxed), 10_000);
    }

    #[test]
    fn should_attempt_local_codex_sync_handles_clock_rollback_without_opening_throttle() {
        let last_attempt_ms = AtomicU64::new(20_000);
        assert!(!should_attempt_local_codex_sync(
            19_000,
            &last_attempt_ms,
            LOCAL_CODEX_CLI_SYNC_MIN_INTERVAL_MS,
        ));
        assert_eq!(last_attempt_ms.load(AtomicOrdering::Relaxed), 20_000);

        assert!(should_attempt_local_codex_sync(
            25_000,
            &last_attempt_ms,
            LOCAL_CODEX_CLI_SYNC_MIN_INTERVAL_MS,
        ));
        assert_eq!(last_attempt_ms.load(AtomicOrdering::Relaxed), 25_000);
    }

    #[test]
    fn load_local_codex_cli_auth_profile_from_path_invalidates_cache_when_file_changes() {
        let root = std::env::temp_dir().join(format!(
            "code-runtime-local-codex-auth-cache-{}",
            rand::random::<u64>()
        ));
        let codex_dir = root.join(".codex");
        let auth_path = codex_dir.join("auth.json");
        std::fs::create_dir_all(codex_dir.as_path()).expect("create codex auth dir");
        let cache = Mutex::new(LocalCodexCliAuthProfileCache::default());

        std::fs::write(
            auth_path.as_path(),
            r#"{"auth_mode":"chatgpt","OPENAI_API_KEY":"api-key-a","tokens":{"account_id":"account-a"}}"#,
        )
        .expect("write initial auth profile");
        let first = load_local_codex_cli_auth_profile_from_path(auth_path.as_path(), &cache)
            .expect("load initial profile");
        assert_eq!(first.api_credential.as_deref(), Some("api-key-a"));
        assert_eq!(first.external_account_id.as_deref(), Some("account-a"));

        let second = load_local_codex_cli_auth_profile_from_path(auth_path.as_path(), &cache)
            .expect("reuse cached profile");
        assert_eq!(second.api_credential.as_deref(), Some("api-key-a"));

        std::fs::write(
            auth_path.as_path(),
            r#"{"auth_mode":"chatgpt","OPENAI_API_KEY":"api-key-bb","tokens":{"account_id":"account-bb"}}"#,
        )
        .expect("write updated auth profile");
        let refreshed = load_local_codex_cli_auth_profile_from_path(auth_path.as_path(), &cache)
            .expect("reload changed profile");
        assert_eq!(refreshed.api_credential.as_deref(), Some("api-key-bb"));
        assert_eq!(refreshed.external_account_id.as_deref(), Some("account-bb"));

        std::fs::remove_file(auth_path.as_path()).expect("remove auth profile");
        let missing = load_local_codex_cli_auth_profile_from_path(auth_path.as_path(), &cache);
        assert!(missing.is_none());

        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn parse_oauth_account_upsert_input_strips_local_cli_reserved_metadata_keys() {
        let params = json!({
            "accountId": LOCAL_CODEX_CLI_ACCOUNT_ID,
            "provider": "codex",
            "metadata": {
                "source": LOCAL_CODEX_CLI_ACCOUNT_SOURCE,
                "localCliManaged": true,
                "credentialAvailable": true,
                "credentialSource": "access_token",
                "note": "keep-me"
            }
        });
        let params = params
            .as_object()
            .cloned()
            .expect("params should be object");
        let diagnostics = RuntimeDiagnosticsState::default();

        let input =
            parse_oauth_account_upsert_input(&params, &diagnostics).expect("parse upsert payload");
        let metadata = input
            .metadata
            .as_ref()
            .and_then(Value::as_object)
            .expect("metadata object");
        assert!(metadata.get("source").is_none());
        assert!(metadata.get("localCliManaged").is_none());
        assert!(metadata.get("credentialAvailable").is_none());
        assert!(metadata.get("credentialSource").is_none());
        assert_eq!(
            metadata.get("note"),
            Some(&Value::String("keep-me".to_string()))
        );
    }

    #[test]
    fn runtime_diagnostics_tracks_local_codex_sync_failures() {
        let diagnostics = RuntimeDiagnosticsState::default();
        diagnostics.record_local_codex_sync_failure();
        diagnostics.record_local_codex_sync_failure();

        let snapshot = diagnostics.snapshot();
        assert_eq!(snapshot.local_codex_sync_failures_total, 2);
    }

    #[test]
    fn runtime_diagnostics_tracks_sse_event_stream_lagged_metrics() {
        let diagnostics = RuntimeDiagnosticsState::default();
        diagnostics.record_sse_event_stream_lagged(3);
        diagnostics.record_sse_event_stream_lagged(5);

        let snapshot = diagnostics.snapshot();
        assert_eq!(snapshot.sse_event_stream_lagged_total, 2);
        assert_eq!(snapshot.sse_event_stream_lagged_dropped_total, 8);
    }

    #[test]
    fn sync_local_codex_cli_account_from_profile_upserts_into_codex_pool() {
        let store = OAuthPoolStore::open(
            ":memory:",
            Some("AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE="),
        )
        .expect("open oauth pool store");
        let profile = LocalCodexCliAuthProfile {
            external_account_id: Some("local-account-1".to_string()),
            email: Some("local@example.com".to_string()),
            auth_mode: Some("chatgpt".to_string()),
            plan_type: Some("plus".to_string()),
            chatgpt_workspaces: None,
            default_chatgpt_workspace_id: None,
            last_refresh: Some("2026-02-12T15:00:00.000Z".to_string()),
            id_token: None,
            openai_api_key: None,
            access_token: Some("local-access-token".to_string()),
            refresh_token: None,
            api_credential: Some("local-access-token".to_string()),
            api_credential_source: Some("access_token".to_string()),
        };

        sync_local_codex_cli_account_from_profile(&store, profile)
            .expect("sync local codex account");

        let account = store
            .list_accounts(Some("codex"))
            .expect("list codex accounts")
            .into_iter()
            .find(|entry| entry.account_id == LOCAL_CODEX_CLI_ACCOUNT_ID)
            .expect("synced local codex account");
        assert_eq!(account.provider, "codex");
        assert_eq!(account.email.as_deref(), Some("local@example.com"));
        assert_eq!(
            account.external_account_id.as_deref(),
            Some("local-account-1")
        );
        assert_eq!(
            account.metadata["source"],
            Value::String(LOCAL_CODEX_CLI_ACCOUNT_SOURCE.to_string())
        );
        assert_eq!(
            account.metadata["planType"],
            Value::String("plus".to_string())
        );
        assert_eq!(
            store
                .resolve_api_key_from_metadata(&account.metadata)
                .expect("resolve api key")
                .as_deref(),
            Some("local-access-token")
        );

        let selected = store
            .select_pool_account(OAuthPoolSelectionInput {
                pool_id: "pool-codex".to_string(),
                session_id: Some("session-local-sync".to_string()),
                workspace_id: None,
                model_id: Some("gpt-5.3-codex".to_string()),
            })
            .expect("select codex pool account")
            .expect("pool selection should return synced account");
        assert_eq!(selected.account.account_id, LOCAL_CODEX_CLI_ACCOUNT_ID);
    }

    #[test]
    fn sync_local_codex_cli_account_without_secret_uses_profile_credential_fallback() {
        let store = OAuthPoolStore::open(":memory:", None).expect("open oauth pool store");
        let profile = LocalCodexCliAuthProfile {
            external_account_id: Some("local-account-no-secret".to_string()),
            email: Some("local-no-secret@example.com".to_string()),
            auth_mode: Some("chatgpt".to_string()),
            plan_type: Some("plus".to_string()),
            chatgpt_workspaces: None,
            default_chatgpt_workspace_id: None,
            last_refresh: Some("2026-02-12T15:30:00.000Z".to_string()),
            id_token: None,
            openai_api_key: None,
            access_token: Some("local-no-secret-token".to_string()),
            refresh_token: None,
            api_credential: Some("local-no-secret-token".to_string()),
            api_credential_source: Some("access_token".to_string()),
        };

        sync_local_codex_cli_account_from_profile(&store, profile.clone())
            .expect("sync local codex account without secret");

        let account = store
            .list_accounts(Some("codex"))
            .expect("list codex accounts")
            .into_iter()
            .find(|entry| entry.account_id == LOCAL_CODEX_CLI_ACCOUNT_ID)
            .expect("synced local codex account");
        assert_eq!(account.metadata["credentialAvailable"], Value::Bool(true));
        assert_eq!(
            account.metadata["credentialSource"],
            Value::String("access_token".to_string())
        );
        assert!(account.metadata.get("apiKey").is_none());
        assert_eq!(
            store
                .resolve_api_key_from_metadata(&account.metadata)
                .expect("resolve api key from metadata"),
            None
        );

        let resolved = resolve_oauth_api_key_for_account(&store, &account, Some(&profile))
            .expect("resolve oauth key with local profile fallback");
        assert_eq!(resolved.as_deref(), Some("local-no-secret-token"));

        let (selection, miss_reason) = store
            .select_pool_account_with_reason(OAuthPoolSelectionInput {
                pool_id: "pool-codex".to_string(),
                session_id: Some("session-local-no-secret".to_string()),
                workspace_id: None,
                model_id: Some("gpt-5.3-codex".to_string()),
            })
            .expect("select codex pool account with local profile fallback");
        assert_eq!(miss_reason, None);
        let selected = selection.expect("pool selection should keep local codex account routable");
        assert_eq!(selected.account.account_id, LOCAL_CODEX_CLI_ACCOUNT_ID);
    }

    #[test]
    fn sync_local_codex_cli_account_without_profile_disables_unusable_local_account() {
        let store = OAuthPoolStore::open(":memory:", None).expect("open oauth pool store");
        store
            .upsert_account(OAuthAccountUpsertInput {
                account_id: LOCAL_CODEX_CLI_ACCOUNT_ID.to_string(),
                provider: "codex".to_string(),
                external_account_id: Some("local-account".to_string()),
                email: Some("local@example.com".to_string()),
                display_name: Some("Local Codex CLI".to_string()),
                status: Some("enabled".to_string()),
                disabled_reason: None,
                metadata: Some(json!({
                    "source": LOCAL_CODEX_CLI_ACCOUNT_SOURCE,
                    "localCliManaged": true,
                    "credentialAvailable": true,
                    "credentialSource": "access_token"
                })),
            })
            .expect("seed local codex account");

        sync_local_codex_cli_account_without_profile(&store)
            .expect("reconcile local codex account without profile");

        let account = store
            .list_accounts(Some("codex"))
            .expect("list codex accounts")
            .into_iter()
            .find(|entry| entry.account_id == LOCAL_CODEX_CLI_ACCOUNT_ID)
            .expect("local codex account remains present");
        assert_eq!(account.status, "disabled");
        assert_eq!(
            account.disabled_reason.as_deref(),
            Some(LOCAL_CODEX_CLI_DISABLED_REASON_PROFILE_MISSING)
        );
        assert_eq!(account.metadata["credentialAvailable"], Value::Bool(false));
        assert!(account.metadata.get("credentialSource").is_none());
    }

    #[test]
    fn sync_local_codex_cli_account_without_profile_preserves_manual_disable_reason() {
        let store = OAuthPoolStore::open(":memory:", None).expect("open oauth pool store");
        store
            .upsert_account(OAuthAccountUpsertInput {
                account_id: LOCAL_CODEX_CLI_ACCOUNT_ID.to_string(),
                provider: "codex".to_string(),
                external_account_id: Some("local-account".to_string()),
                email: Some("local@example.com".to_string()),
                display_name: Some("Local Codex CLI".to_string()),
                status: Some("disabled".to_string()),
                disabled_reason: Some("manual_toggle".to_string()),
                metadata: Some(json!({
                    "source": LOCAL_CODEX_CLI_ACCOUNT_SOURCE,
                    "localCliManaged": true,
                    "credentialAvailable": false
                })),
            })
            .expect("seed disabled local codex account");

        sync_local_codex_cli_account_without_profile(&store)
            .expect("reconcile local codex account without profile");

        let account = store
            .list_accounts(Some("codex"))
            .expect("list codex accounts")
            .into_iter()
            .find(|entry| entry.account_id == LOCAL_CODEX_CLI_ACCOUNT_ID)
            .expect("local codex account remains present");
        assert_eq!(account.status, "disabled");
        assert_eq!(account.disabled_reason.as_deref(), Some("manual_toggle"));
    }

    #[test]
    fn sync_local_codex_cli_account_from_profile_reenables_auto_disabled_account() {
        let store = OAuthPoolStore::open(":memory:", None).expect("open oauth pool store");
        store
            .upsert_account(OAuthAccountUpsertInput {
                account_id: LOCAL_CODEX_CLI_ACCOUNT_ID.to_string(),
                provider: "codex".to_string(),
                external_account_id: Some("local-account".to_string()),
                email: Some("local@example.com".to_string()),
                display_name: Some("Local Codex CLI".to_string()),
                status: Some("disabled".to_string()),
                disabled_reason: Some(LOCAL_CODEX_CLI_DISABLED_REASON_PROFILE_MISSING.to_string()),
                metadata: Some(json!({
                    "source": LOCAL_CODEX_CLI_ACCOUNT_SOURCE,
                    "localCliManaged": true,
                    "credentialAvailable": false
                })),
            })
            .expect("seed auto-disabled local codex account");
        let profile = LocalCodexCliAuthProfile {
            external_account_id: Some("local-account".to_string()),
            email: Some("local@example.com".to_string()),
            auth_mode: Some("chatgpt".to_string()),
            plan_type: Some("plus".to_string()),
            chatgpt_workspaces: None,
            default_chatgpt_workspace_id: None,
            last_refresh: Some("2026-02-12T15:45:00.000Z".to_string()),
            id_token: None,
            openai_api_key: None,
            access_token: Some("local-refresh-token".to_string()),
            refresh_token: None,
            api_credential: Some("local-refresh-token".to_string()),
            api_credential_source: Some("access_token".to_string()),
        };

        sync_local_codex_cli_account_from_profile(&store, profile)
            .expect("sync local codex account from profile");

        let account = store
            .list_accounts(Some("codex"))
            .expect("list codex accounts")
            .into_iter()
            .find(|entry| entry.account_id == LOCAL_CODEX_CLI_ACCOUNT_ID)
            .expect("local codex account remains present");
        assert_eq!(account.status, "enabled");
        assert_eq!(account.disabled_reason, None);
        assert_eq!(account.metadata["credentialAvailable"], Value::Bool(true));
    }

    #[test]
    fn sync_local_codex_cli_account_from_profile_disables_when_credential_missing() {
        let store = OAuthPoolStore::open(":memory:", None).expect("open oauth pool store");
        let profile = LocalCodexCliAuthProfile {
            external_account_id: Some("local-account".to_string()),
            email: Some("local@example.com".to_string()),
            auth_mode: Some("chatgpt".to_string()),
            plan_type: Some("plus".to_string()),
            chatgpt_workspaces: None,
            default_chatgpt_workspace_id: None,
            last_refresh: Some("2026-02-12T16:00:00.000Z".to_string()),
            id_token: None,
            openai_api_key: None,
            access_token: None,
            refresh_token: None,
            api_credential: None,
            api_credential_source: None,
        };

        sync_local_codex_cli_account_from_profile(&store, profile)
            .expect("sync local codex account without credential");

        let account = store
            .list_accounts(Some("codex"))
            .expect("list codex accounts")
            .into_iter()
            .find(|entry| entry.account_id == LOCAL_CODEX_CLI_ACCOUNT_ID)
            .expect("local codex account exists");
        assert_eq!(account.status, "disabled");
        assert_eq!(
            account.disabled_reason.as_deref(),
            Some(LOCAL_CODEX_CLI_DISABLED_REASON_CREDENTIAL_MISSING)
        );
        assert_eq!(account.metadata["credentialAvailable"], Value::Bool(false));
    }

    #[test]
    fn resolve_oauth_api_key_for_local_codex_account_recovers_from_decrypt_error_with_profile_fallback(
    ) {
        let store = OAuthPoolStore::open(":memory:", None).expect("open oauth pool store");
        let profile = LocalCodexCliAuthProfile {
            api_credential: Some("local-fallback-token".to_string()),
            ..Default::default()
        };
        let account = oauth_pool::OAuthAccountSummary {
            account_id: LOCAL_CODEX_CLI_ACCOUNT_ID.to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Local Codex CLI".to_string()),
            status: "enabled".to_string(),
            disabled_reason: None,
            route_config: None,
            routing_state: None,
            chatgpt_workspaces: None,
            default_chatgpt_workspace_id: None,
            metadata: json!({
                "source": LOCAL_CODEX_CLI_ACCOUNT_SOURCE,
                "localCliManaged": true,
                "apiKeyEncryptedV1": "tampered-ciphertext"
            }),
            created_at: 0,
            updated_at: 0,
        };

        let resolved = resolve_oauth_api_key_for_account(&store, &account, Some(&profile))
            .expect("fallback should recover from decrypt error");
        assert_eq!(resolved.as_deref(), Some("local-fallback-token"));
    }

    #[test]
    fn resolve_oauth_api_key_for_non_local_account_keeps_decrypt_error() {
        let store = OAuthPoolStore::open(":memory:", None).expect("open oauth pool store");
        let profile = LocalCodexCliAuthProfile {
            api_credential: Some("local-fallback-token".to_string()),
            ..Default::default()
        };
        let account = oauth_pool::OAuthAccountSummary {
            account_id: "codex-non-local".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Non Local".to_string()),
            status: "enabled".to_string(),
            disabled_reason: None,
            route_config: None,
            routing_state: None,
            chatgpt_workspaces: None,
            default_chatgpt_workspace_id: None,
            metadata: json!({
                "source": "manual",
                "apiKeyEncryptedV1": "tampered-ciphertext"
            }),
            created_at: 0,
            updated_at: 0,
        };

        let error = resolve_oauth_api_key_for_account(&store, &account, Some(&profile))
            .expect_err("non-local account should preserve decrypt error");
        assert!(error.contains("CODE_RUNTIME_SERVICE_OAUTH_SECRET_KEY"));
    }

    #[test]
    fn resolve_oauth_api_key_for_reserved_id_without_local_markers_does_not_fallback() {
        let store = OAuthPoolStore::open(":memory:", None).expect("open oauth pool store");
        let profile = LocalCodexCliAuthProfile {
            api_credential: Some("local-fallback-token".to_string()),
            ..Default::default()
        };
        let account = oauth_pool::OAuthAccountSummary {
            account_id: LOCAL_CODEX_CLI_ACCOUNT_ID.to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Local Codex CLI".to_string()),
            status: "enabled".to_string(),
            disabled_reason: None,
            route_config: None,
            routing_state: None,
            chatgpt_workspaces: None,
            default_chatgpt_workspace_id: None,
            metadata: json!({
                "source": "manual"
            }),
            created_at: 0,
            updated_at: 0,
        };

        let resolved = resolve_oauth_api_key_for_account(&store, &account, Some(&profile))
            .expect("non-managed local id should not fail resolution");
        assert_eq!(resolved, None);
    }

    #[test]
    fn redact_oauth_account_metadata_marks_local_cli_credential_as_configured() {
        let metadata = json!({
            "source": LOCAL_CODEX_CLI_ACCOUNT_SOURCE,
            "localCliManaged": true,
            "credentialAvailable": true,
            "credentialSource": "access_token",
            "note": "visible"
        });

        let redacted = redact_oauth_account_metadata(&metadata);
        assert_eq!(redacted["apiKeyConfigured"], Value::Bool(true));
        assert_eq!(
            redacted["source"],
            Value::String(LOCAL_CODEX_CLI_ACCOUNT_SOURCE.to_string())
        );
        assert_eq!(redacted["localCliManaged"], Value::Bool(true));
        assert_eq!(redacted["credentialAvailable"], Value::Bool(true));
        assert_eq!(
            redacted["credentialSource"],
            Value::String("access_token".to_string())
        );
        assert_eq!(redacted["note"], Value::String("visible".to_string()));
        assert!(redacted["apiKey"].is_null());
        assert!(redacted["api_key"].is_null());
    }

    #[test]
    fn redact_oauth_account_metadata_marks_refresh_token_available() {
        let metadata = json!({
            "source": SERVICE_CODEX_OAUTH_ACCOUNT_SOURCE,
            "refreshToken": "refresh-token-secret",
            "refreshTokenEncryptedV1": "v1:test:test",
            "note": "visible"
        });

        let redacted = redact_oauth_account_metadata(&metadata);
        assert_eq!(redacted["refreshTokenAvailable"], Value::Bool(true));
        assert_eq!(redacted["note"], Value::String("visible".to_string()));
        assert!(redacted["refreshToken"].is_null());
        assert!(redacted["refresh_token"].is_null());
        assert!(redacted["refreshTokenEncryptedV1"].is_null());
    }

    #[test]
    fn should_refresh_service_codex_oauth_usage_checks_staleness() {
        let stale_account = oauth_pool::OAuthAccountSummary {
            account_id: "codex-service-stale".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: None,
            status: "enabled".to_string(),
            disabled_reason: None,
            route_config: None,
            routing_state: None,
            chatgpt_workspaces: None,
            default_chatgpt_workspace_id: None,
            metadata: json!({
                "source": SERVICE_CODEX_OAUTH_ACCOUNT_SOURCE,
                "usageCheckedAt": 1_000
            }),
            created_at: 0,
            updated_at: 0,
        };
        let fresh_account = oauth_pool::OAuthAccountSummary {
            metadata: json!({
                "source": SERVICE_CODEX_OAUTH_ACCOUNT_SOURCE,
                "usageCheckedAt": 100_000
            }),
            ..stale_account.clone()
        };
        let manual_account = oauth_pool::OAuthAccountSummary {
            metadata: json!({
                "source": "manual",
                "usageCheckedAt": 1_000
            }),
            ..stale_account.clone()
        };

        assert!(should_refresh_service_codex_oauth_usage(
            &stale_account,
            1_000 + SERVICE_CODEX_USAGE_STALE_AFTER_MS + 1
        ));
        assert!(!should_refresh_service_codex_oauth_usage(
            &fresh_account,
            100_000 + SERVICE_CODEX_USAGE_STALE_AFTER_MS - 1
        ));
        assert!(!should_refresh_service_codex_oauth_usage(
            &manual_account,
            1_000 + SERVICE_CODEX_USAGE_STALE_AFTER_MS + 1
        ));
    }

    #[test]
    fn select_service_codex_usage_refresh_accounts_auto_skips_backoffed_account() {
        let base_account = oauth_pool::OAuthAccountSummary {
            account_id: "codex-service-a".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: None,
            status: "enabled".to_string(),
            disabled_reason: None,
            route_config: None,
            routing_state: None,
            chatgpt_workspaces: None,
            default_chatgpt_workspace_id: None,
            metadata: json!({
                "source": SERVICE_CODEX_OAUTH_ACCOUNT_SOURCE,
                "usageCheckedAt": 1_000
            }),
            created_at: 0,
            updated_at: 0,
        };
        let account_b = oauth_pool::OAuthAccountSummary {
            account_id: "codex-service-b".to_string(),
            metadata: json!({
                "source": SERVICE_CODEX_OAUTH_ACCOUNT_SOURCE,
                "usageCheckedAt": 2_000
            }),
            ..base_account.clone()
        };
        let now = 2_000 + SERVICE_CODEX_USAGE_STALE_AFTER_MS + 1;
        let mut attempts = HashMap::new();
        attempts.insert(
            "codex-service-a".to_string(),
            now.saturating_sub(SERVICE_CODEX_USAGE_REFRESH_RETRY_BACKOFF_MS - 1),
        );

        let selected = select_service_codex_usage_refresh_accounts(
            &[base_account, account_b.clone()],
            now,
            ServiceCodexUsageRefreshMode::Auto,
            &mut attempts,
        );

        assert_eq!(selected.len(), 1);
        assert_eq!(selected[0].account_id, "codex-service-b");
        assert_eq!(attempts.get("codex-service-b"), Some(&now));
    }

    #[test]
    fn select_service_codex_usage_refresh_accounts_force_refreshes_multiple_accounts() {
        let make_account = |id: &str, checked_at: u64| oauth_pool::OAuthAccountSummary {
            account_id: id.to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: None,
            status: "enabled".to_string(),
            disabled_reason: None,
            route_config: None,
            routing_state: None,
            chatgpt_workspaces: None,
            default_chatgpt_workspace_id: None,
            metadata: json!({
                "source": SERVICE_CODEX_OAUTH_ACCOUNT_SOURCE,
                "usageCheckedAt": checked_at
            }),
            created_at: 0,
            updated_at: 0,
        };
        let now = 200_000;
        let mut attempts = HashMap::new();
        let selected = select_service_codex_usage_refresh_accounts(
            &[
                make_account("codex-service-a", 10_000),
                make_account("codex-service-b", 20_000),
                make_account("codex-service-c", 30_000),
                make_account("codex-service-d", 40_000),
            ],
            now,
            ServiceCodexUsageRefreshMode::Force,
            &mut attempts,
        );

        assert_eq!(selected.len(), SERVICE_CODEX_USAGE_FORCE_REFRESH_MAX_ACCOUNTS);
        assert_eq!(selected[0].account_id, "codex-service-a");
        assert_eq!(selected[1].account_id, "codex-service-b");
        assert_eq!(selected[2].account_id, "codex-service-c");
        assert_eq!(attempts.get("codex-service-a"), Some(&now));
        assert_eq!(attempts.get("codex-service-b"), Some(&now));
        assert_eq!(attempts.get("codex-service-c"), Some(&now));
    }

    #[test]
    fn classify_oauth_api_key_resolution_error_maps_reason_codes() {
        assert_eq!(
            classify_oauth_api_key_resolution_error(
                "Decrypt oauth api key: authentication failure"
            ),
            "decrypt_failed"
        );
        assert_eq!(
            classify_oauth_api_key_resolution_error(
                "Encrypted OAuth account API keys are present but CODE_RUNTIME_SERVICE_OAUTH_SECRET_KEY is not configured."
            ),
            "decrypt_failed"
        );
        assert_eq!(
            classify_oauth_api_key_resolution_error("metadata `apiKey` must be a string"),
            "auth_missing"
        );
    }

    #[test]
    fn parse_chatgpt_account_profile_from_payload_prefers_matching_external_account_id() {
        let account = oauth_pool::OAuthAccountSummary {
            account_id: "codex-local-cli".to_string(),
            provider: "codex".to_string(),
            external_account_id: Some("account-2".to_string()),
            email: Some("iappsky@gmail.com".to_string()),
            display_name: Some("iappsky@gmail.com".to_string()),
            status: "enabled".to_string(),
            disabled_reason: None,
            route_config: None,
            routing_state: None,
            chatgpt_workspaces: Some(vec![oauth_pool::OAuthAccountChatgptWorkspace {
                workspace_id: "org-personal".to_string(),
                title: Some("Personal".to_string()),
                role: Some("owner".to_string()),
                is_default: true,
            }]),
            default_chatgpt_workspace_id: Some("org-personal".to_string()),
            metadata: json!({ "authMode": "chatgpt" }),
            created_at: 0,
            updated_at: 0,
        };
        let payload = json!({
            "accounts": [
                {
                    "id": "account-1",
                    "name": "wrong-workspace",
                    "structure": "workspace"
                },
                {
                    "id": "account-2",
                    "name": "lewiszlewisl1983",
                    "structure": "workspace"
                }
            ],
            "default_account_id": "account-1",
            "account_ordering": ["account-1", "account-2"]
        });

        let parsed = parse_chatgpt_account_profile_from_payload(&payload, &account);

        assert_eq!(
            parsed,
            Some(("lewiszlewisl1983".to_string(), Some("workspace".to_string())))
        );
    }

    #[test]
    fn parse_chatgpt_account_profile_from_payload_falls_back_to_account_ordering() {
        let account = oauth_pool::OAuthAccountSummary {
            account_id: "codex-local-cli".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: Some("iappsky@gmail.com".to_string()),
            display_name: Some("iappsky@gmail.com".to_string()),
            status: "enabled".to_string(),
            disabled_reason: None,
            route_config: None,
            routing_state: None,
            chatgpt_workspaces: Some(vec![oauth_pool::OAuthAccountChatgptWorkspace {
                workspace_id: "org-personal".to_string(),
                title: Some("Personal".to_string()),
                role: Some("owner".to_string()),
                is_default: true,
            }]),
            default_chatgpt_workspace_id: Some("org-personal".to_string()),
            metadata: json!({ "authMode": "chatgpt" }),
            created_at: 0,
            updated_at: 0,
        };
        let payload = json!({
            "accounts": [
                {
                    "id": "account-1",
                    "name": "fallback-workspace",
                    "structure": "workspace"
                },
                {
                    "id": "account-2",
                    "name": "ignored-workspace",
                    "structure": "workspace"
                }
            ],
            "default_account_id": "account-1",
            "account_ordering": ["account-1", "account-2"]
        });

        let parsed = parse_chatgpt_account_profile_from_payload(&payload, &account);

        assert_eq!(
            parsed,
            Some(("fallback-workspace".to_string(), Some("workspace".to_string())))
        );
    }

    #[tokio::test]
    async fn runtime_eval_fixture_research_multi_repo_analysis_executes_and_matches_expectations() {
        let fixture = load_runtime_eval_scenario_fixture("research-multi-repo-analysis");
        assert_eq!(fixture.id, "research-multi-repo-analysis");
        assert_eq!(fixture.policy, "always_passes");
        assert_eq!(fixture.kind, "research_orchestrator");
        assert!(
            fixture
                .description
                .contains("Bounded multi-repo research"),
            "unexpected fixture description: {}",
            fixture.description
        );
        let (base_url, handle) = spawn_live_skills_network_mock_server().await;
        let mut config = test_service_config();
        config.live_skills_network_base_url = base_url;
        config.live_skills_network_timeout_ms = 3_000;
        let app = test_router_with_config(config);
        let payload = send_rpc_request(
            app,
            json!({
                "method":"code_live_skill_execute",
                "params":{
                    "skillId":"research-orchestrator",
                    "input": fixture.input.clone().expect("fixture input"),
                    "options": fixture.options.clone().expect("fixture options")
                }
            }),
        )
        .await;
        handle.abort();

        assert_eq!(payload["ok"], Value::Bool(true), "payload: {payload:#}");
        assert_eq!(
            payload["result"]["status"],
            Value::String(fixture.expectations.status.clone())
        );
        assert_eq!(
            payload["result"]["metadata"]["profileUsed"],
            Value::String(
                fixture
                    .expectations
                    .profile_used
                    .clone()
                    .expect("research profile used expectation")
            )
        );
        assert_eq!(
            payload["result"]["metadata"]["checkpointState"]["state"],
            Value::String(fixture.expectations.checkpoint_state.clone())
        );
        assert_eq!(
            payload["result"]["metadata"]["researchRun"]["profileUsed"],
            Value::String(fixture.expectations.scope_profile.clone())
        );
        assert_eq!(
            payload["result"]["metadata"]["researchRun"]["sessions"]
                .as_array()
                .map(Vec::len),
            fixture.expectations.research_session_count
        );
        assert!(payload["result"]["metadata"]["researchRun"]["citations"]
            .as_array()
            .is_some_and(|citations| !citations.is_empty()));
        assert_eval_tags_include(
            &payload["result"]["metadata"]["evalTags"],
            &fixture.expectations.eval_tags,
        );
    }

    #[tokio::test]
    async fn runtime_eval_fixture_review_bounded_delegation_executes_and_matches_expectations() {
        let fixture = load_runtime_eval_scenario_fixture("review-bounded-delegation");
        assert_eq!(fixture.id, "review-bounded-delegation");
        assert_eq!(fixture.policy, "always_passes");
        assert_eq!(fixture.kind, "review_sub_agent");
        assert!(
            fixture
                .description
                .contains("Review delegation should remain read-only"),
            "unexpected fixture description: {}",
            fixture.description
        );
        let app = test_router();
        let spawn_payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_sub_agent_spawn",
                "params":{
                    "workspaceId":"workspace-test",
                    "title":"runtime eval review worker",
                    "accessMode":"read-only",
                    "scopeProfile": fixture.expectations.scope_profile.clone(),
                }
            }),
        )
        .await;
        assert_eq!(spawn_payload["ok"], Value::Bool(true), "payload: {spawn_payload:#}");
        assert_eq!(
            spawn_payload["result"]["allowNetwork"],
            Value::Bool(
                fixture
                    .expectations
                    .allow_network
                    .expect("review allowNetwork expectation")
            )
        );
        assert_eq!(
            spawn_payload["result"]["allowedSkillIds"],
            json!(
                fixture
                    .expectations
                    .allowed_skill_ids
                    .clone()
                    .expect("review allowedSkillIds expectation")
            )
        );
        assert_eval_tags_include(
            &spawn_payload["result"]["evalTags"],
            &fixture.expectations.eval_tags,
        );

        let session_id = spawn_payload["result"]["sessionId"]
            .as_str()
            .expect("review eval session id")
            .to_string();
        let send_payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_sub_agent_send",
                "params":{
                    "sessionId": session_id,
                    "instruction": fixture
                        .instruction
                        .clone()
                        .expect("review instruction"),
                    "requiresApproval": fixture.requires_approval.unwrap_or(false),
                    "approvalReason": fixture.approval_reason.clone(),
                }
            }),
        )
        .await;
        assert_eq!(send_payload["ok"], Value::Bool(true), "payload: {send_payload:#}");
        let task_id = send_payload["result"]["task"]["taskId"]
            .as_str()
            .expect("review eval task id")
            .to_string();
        let approval_state = fixture
            .expectations
            .approval_state
            .clone()
            .expect("review approval state expectation");

        let awaiting_payload = wait_for_agent_task_terminal_status(
            app.clone(),
            task_id.as_str(),
            &[approval_state.as_str()],
        )
        .await;
        let approval_id = awaiting_payload["result"]["pendingApprovalId"]
            .as_str()
            .expect("review eval approval id")
            .to_string();

        let pending_wait_payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_sub_agent_wait",
                "params":{
                    "sessionId": send_payload["result"]["session"]["sessionId"],
                    "timeoutMs": fixture.wait_timeout_ms.unwrap_or(50),
                    "pollIntervalMs": 25,
                }
            }),
        )
        .await;
        assert_eq!(pending_wait_payload["ok"], Value::Bool(true));
        assert_eq!(pending_wait_payload["result"]["done"], Value::Bool(false));
        assert_eq!(pending_wait_payload["result"]["timedOut"], Value::Bool(true));
        assert_eq!(
            pending_wait_payload["result"]["session"]["checkpointState"]["state"],
            Value::String(approval_state)
        );

        let approval_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_checkpoint_approval",
                "params": {
                    "approvalId": approval_id,
                    "decision": fixture
                        .approval_decision
                        .clone()
                        .expect("review approval decision"),
                    "reason": "runtime eval fixture rejection"
                }
            }),
        )
        .await;
        assert_eq!(approval_payload["ok"], Value::Bool(true));

        let wait_payload = send_rpc_request(
            app,
            json!({
                "method":"code_sub_agent_wait",
                "params":{
                    "sessionId": send_payload["result"]["session"]["sessionId"],
                    "timeoutMs": 1_000,
                }
            }),
        )
        .await;
        assert_eq!(wait_payload["ok"], Value::Bool(true), "payload: {wait_payload:#}");
        assert_eq!(wait_payload["result"]["done"], Value::Bool(true));
        assert_eq!(
            wait_payload["result"]["session"]["status"],
            Value::String(fixture.expectations.status.clone())
        );
        assert_eq!(
            wait_payload["result"]["session"]["checkpointState"]["state"],
            Value::String(fixture.expectations.checkpoint_state.clone())
        );
        assert_eval_tags_include(
            &wait_payload["result"]["session"]["evalTags"],
            &fixture.expectations.eval_tags,
        );
    }
