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
