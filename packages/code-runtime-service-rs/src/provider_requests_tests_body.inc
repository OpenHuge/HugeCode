    use super::*;
    use crate::{
        ServiceConfig, DEFAULT_DISCOVERY_BROWSE_INTERVAL_MS, DEFAULT_DISCOVERY_SERVICE_TYPE,
        DEFAULT_DISCOVERY_STALE_TTL_MS, DEFAULT_SANDBOX_NETWORK_ACCESS,
    };
    use axum::http::StatusCode as AxumStatusCode;
    use axum::{
        response::IntoResponse,
        routing::{get, post},
        Json, Router,
    };
    use reqwest::header::{HeaderMap, HeaderValue, RETRY_AFTER};
    use reqwest::StatusCode;
    use serde_json::json;
    use std::sync::{
        atomic::{AtomicUsize, Ordering},
        Arc, Mutex,
    };
    use std::time::{Duration, SystemTime};
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::task::JoinHandle;

    fn test_service_config() -> ServiceConfig {
        ServiceConfig {
            default_model_id: "gpt-5.3-codex".to_string(),
            openai_api_key: None,
            openai_endpoint: "https://api.openai.com/v1/responses".to_string(),
            openai_compat_base_url: None,
            openai_compat_api_key: None,
            anthropic_api_key: None,
            anthropic_endpoint: "https://api.anthropic.com/v1/messages".to_string(),
            anthropic_version: "2023-06-01".to_string(),
            gemini_api_key: None,
            gemini_endpoint: "https://generativelanguage.googleapis.com/v1beta/models".to_string(),
            openai_timeout_ms: 5_000,
            openai_max_retries: 2,
            openai_retry_base_ms: 1,
            openai_compat_model_cache_ttl_ms: 300_000,
            live_skills_network_enabled: true,
            live_skills_network_base_url: "https://r.jina.ai/http://r.jina.ai/http://".to_string(),
            live_skills_network_timeout_ms: 5_000,
            live_skills_network_cache_ttl_ms: 300_000,
            sandbox_enabled: false,
            sandbox_network_access: DEFAULT_SANDBOX_NETWORK_ACCESS.to_string(),
            sandbox_allowed_hosts: Vec::new(),
            oauth_pool_db_path: ":memory:".to_string(),
            oauth_secret_key: Some("AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=".to_string()),
            oauth_public_base_url: None,
            oauth_loopback_callback_port: 1455,
            runtime_auth_token: None,
            agent_max_concurrent_tasks: 2,
            agent_task_history_limit: 64,
            distributed_enabled: false,
            distributed_redis_url: None,
            distributed_lane_count: 1,
            distributed_worker_concurrency: 1,
            distributed_claim_idle_ms: 30_000,
            discovery_enabled: false,
            discovery_service_type: DEFAULT_DISCOVERY_SERVICE_TYPE.to_string(),
            discovery_browse_interval_ms: DEFAULT_DISCOVERY_BROWSE_INTERVAL_MS,
            discovery_stale_ttl_ms: DEFAULT_DISCOVERY_STALE_TTL_MS,
            runtime_backend_id: "runtime-test".to_string(),
            runtime_backend_capabilities: vec!["code".to_string()],
            runtime_port: 8788,
            ws_write_buffer_size_bytes: 256 * 1024,
            ws_max_write_buffer_size_bytes: 16 * 1024 * 1024,
            ws_max_frame_size_bytes: 8 * 1024 * 1024,
            ws_max_message_size_bytes: 8 * 1024 * 1024,
            ws_max_connections: 256,
            provider_extensions: Vec::new(),
        }
    }

    async fn spawn_openai_compat_retry_test_server(
        response_script: Arc<dyn Fn(usize) -> axum::response::Response + Send + Sync>,
    ) -> (String, Arc<AtomicUsize>, JoinHandle<()>) {
        let attempts = Arc::new(AtomicUsize::new(0));
        let app = Router::new().route(
            "/v1/chat/completions",
            post({
                let attempts = attempts.clone();
                let response_script = response_script.clone();
                move || {
                    let attempts = attempts.clone();
                    let response_script = response_script.clone();
                    async move {
                        let attempt = attempts.fetch_add(1, Ordering::SeqCst);
                        response_script(attempt)
                    }
                }
            }),
        );

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind openai-compat retry test server");
        let address = listener
            .local_addr()
            .expect("resolve openai-compat retry test server address");
        let handle = tokio::spawn(async move {
            let _ = axum::serve(listener, app).await;
        });
        (format!("http://{address}/v1"), attempts, handle)
    }

    async fn spawn_openai_compat_payload_capture_test_server(
        captured_payload: Arc<Mutex<Vec<Value>>>,
    ) -> (String, JoinHandle<()>) {
        let app = Router::new().route(
            "/v1/chat/completions",
            post(move |Json(payload): Json<Value>| {
                let captured_payload = captured_payload.clone();
                async move {
                    captured_payload
                        .lock()
                        .expect("lock compat payload capture")
                        .push(payload);
                    (
                        AxumStatusCode::OK,
                        Json(json!({
                            "choices": [{
                                "message": { "content": "ok:captured" }
                            }]
                        })),
                    )
                }
            }),
        );

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind openai-compat payload capture test server");
        let address = listener
            .local_addr()
            .expect("resolve openai-compat payload capture test server address");
        let handle = tokio::spawn(async move {
            let _ = axum::serve(listener, app).await;
        });
        (format!("http://{address}/v1"), handle)
    }

    async fn spawn_chatgpt_codex_sse_test_server(
        expected_access_token: &'static str,
        expected_account_id: Option<&'static str>,
    ) -> (String, Arc<AtomicUsize>, JoinHandle<()>) {
        let requests = Arc::new(AtomicUsize::new(0));
        let app = Router::new().route(
            "/backend-api/codex/responses",
            post({
                let requests = requests.clone();
                move |headers: axum::http::HeaderMap, Json(payload): Json<Value>| {
                    let requests = requests.clone();
                    async move {
                        requests.fetch_add(1, Ordering::SeqCst);
                        let authorization = headers
                            .get("authorization")
                            .and_then(|value| value.to_str().ok())
                            .unwrap_or_default()
                            .to_string();
                        if authorization != format!("Bearer {expected_access_token}") {
                            return (
                                AxumStatusCode::UNAUTHORIZED,
                                Json(json!({ "detail": "Unauthorized" })),
                            )
                                .into_response();
                        }
                        if let Some(expected_account_id) = expected_account_id {
                            let account_id = headers
                                .get("chatgpt-account-id")
                                .and_then(|value| value.to_str().ok());
                            if account_id != Some(expected_account_id) {
                                return (
                                    AxumStatusCode::BAD_REQUEST,
                                    Json(json!({ "detail": "Missing ChatGPT-Account-Id" })),
                                )
                                    .into_response();
                            }
                        }

                        if payload.get("stream").and_then(Value::as_bool) != Some(true) {
                            return (
                                AxumStatusCode::BAD_REQUEST,
                                Json(json!({ "detail": "Stream must be set to true" })),
                            )
                                .into_response();
                        }
                        if payload.get("store").and_then(Value::as_bool) != Some(false) {
                            return (
                                AxumStatusCode::BAD_REQUEST,
                                Json(json!({ "detail": "Store must be set to false" })),
                            )
                                .into_response();
                        }
                        if !payload
                            .get("input")
                            .and_then(Value::as_array)
                            .is_some_and(|entries| !entries.is_empty())
                        {
                            return (
                                AxumStatusCode::BAD_REQUEST,
                                Json(json!({ "detail": "Input must be a list" })),
                            )
                                .into_response();
                        }

                        (
                            AxumStatusCode::OK,
                            [("content-type", "text/event-stream")],
                            concat!(
                                "event: response.created\n",
                                "data: {\"type\":\"response.created\",\"response\":{\"model\":\"gpt-5.4-2026-03-01\"}}\n\n",
                                "event: response.output_text.delta\n",
                                "data: {\"type\":\"response.output_text.delta\",\"delta\":\"po\"}\n\n",
                                "event: response.output_text.delta\n",
                                "data: {\"type\":\"response.output_text.delta\",\"delta\":\"ng\"}\n\n",
                                "event: response.output_text.done\n",
                                "data: {\"type\":\"response.output_text.done\",\"text\":\"pong\"}\n\n"
                            ),
                        )
                            .into_response()
                    }
                }
            }),
        );

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind chatgpt codex sse test server");
        let address = listener
            .local_addr()
            .expect("resolve chatgpt codex sse test server address");
        let handle = tokio::spawn(async move {
            let _ = axum::serve(listener, app).await;
        });
        (
            format!("http://{address}/backend-api/codex/responses"),
            requests,
            handle,
        )
    }

    async fn spawn_chatgpt_codex_decode_retry_test_server(
        expected_access_token: &'static str,
    ) -> (String, Arc<AtomicUsize>, JoinHandle<()>) {
        let requests = Arc::new(AtomicUsize::new(0));
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind chatgpt codex decode retry test server");
        let address = listener
            .local_addr()
            .expect("resolve chatgpt codex decode retry test server address");
        let requests_for_server = requests.clone();
        let handle = tokio::spawn(async move {
            loop {
                let Ok((mut socket, _peer)) = listener.accept().await else {
                    break;
                };
                let attempt = requests_for_server.fetch_add(1, Ordering::SeqCst);
                let mut request_buf = [0_u8; 4096];
                let Ok(read) = socket.read(&mut request_buf).await else {
                    break;
                };
                if read == 0 {
                    break;
                }
                let request_text = String::from_utf8_lossy(&request_buf[..read]);
                let request_text_lower = request_text.to_ascii_lowercase();
                let expected_auth = format!("authorization: bearer {}", expected_access_token)
                    .to_ascii_lowercase();
                if !request_text_lower.contains(expected_auth.as_str()) {
                    let _ = socket
                        .write_all(
                            b"HTTP/1.1 401 Unauthorized\r\ncontent-length: 0\r\nconnection: close\r\n\r\n",
                        )
                        .await;
                    let _ = socket.shutdown().await;
                    continue;
                }

                if attempt == 0 {
                    let truncated_body = b"event: response.output_text.delta\n\
                                           data: {\"type\":\"response.output_text.delta\",\"delta\":\"po\"}\n\n";
                    let declared_length = truncated_body.len() + 32;
                    let head = format!(
                        "HTTP/1.1 200 OK\r\ncontent-type: text/event-stream\r\ncontent-length: {declared_length}\r\nconnection: close\r\n\r\n"
                    );
                    let _ = socket.write_all(head.as_bytes()).await;
                    let _ = socket.write_all(truncated_body).await;
                    let _ = socket.shutdown().await;
                    continue;
                }

                let body = concat!(
                    "event: response.output_text.delta\n",
                    "data: {\"type\":\"response.output_text.delta\",\"delta\":\"po\"}\n\n",
                    "event: response.output_text.done\n",
                    "data: {\"type\":\"response.output_text.done\",\"text\":\"pong\"}\n\n"
                );
                let head = format!(
                    "HTTP/1.1 200 OK\r\ncontent-type: text/event-stream\r\ncontent-length: {}\r\nconnection: close\r\n\r\n",
                    body.len()
                );
                let _ = socket.write_all(head.as_bytes()).await;
                let _ = socket.write_all(body.as_bytes()).await;
                let _ = socket.shutdown().await;
            }
        });
        (
            format!("http://{address}/backend-api/codex/responses"),
            requests,
            handle,
        )
    }

    async fn spawn_openai_decode_retry_test_server(
        expected_api_key: &'static str,
    ) -> (String, Arc<AtomicUsize>, JoinHandle<()>) {
        let requests = Arc::new(AtomicUsize::new(0));
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind openai decode retry test server");
        let address = listener
            .local_addr()
            .expect("resolve openai decode retry test server address");
        let requests_for_server = requests.clone();
        let handle = tokio::spawn(async move {
            loop {
                let Ok((mut socket, _peer)) = listener.accept().await else {
                    break;
                };
                let attempt = requests_for_server.fetch_add(1, Ordering::SeqCst);
                let mut request_buf = [0_u8; 4096];
                let Ok(read) = socket.read(&mut request_buf).await else {
                    break;
                };
                if read == 0 {
                    break;
                }

                let request_text = String::from_utf8_lossy(&request_buf[..read]).to_ascii_lowercase();
                let expected_auth =
                    format!("authorization: bearer {}", expected_api_key).to_ascii_lowercase();
                if !request_text.contains(expected_auth.as_str()) {
                    let _ = socket
                        .write_all(
                            b"HTTP/1.1 401 Unauthorized\r\ncontent-length: 0\r\nconnection: close\r\n\r\n",
                        )
                        .await;
                    let _ = socket.shutdown().await;
                    continue;
                }

                if attempt == 0 {
                    let truncated_body = b"{\"output_text\":\"partial";
                    let declared_length = truncated_body.len() + 16;
                    let head = format!(
                        "HTTP/1.1 200 OK\r\ncontent-type: application/json\r\ncontent-length: {declared_length}\r\nconnection: close\r\n\r\n"
                    );
                    let _ = socket.write_all(head.as_bytes()).await;
                    let _ = socket.write_all(truncated_body).await;
                    let _ = socket.shutdown().await;
                    continue;
                }

                let body = "{\"output_text\":\"ok:recovered\",\"model\":\"gpt-5.4-2026-03-01\"}";
                let head = format!(
                    "HTTP/1.1 200 OK\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n",
                    body.len()
                );
                let _ = socket.write_all(head.as_bytes()).await;
                let _ = socket.write_all(body.as_bytes()).await;
                let _ = socket.shutdown().await;
            }
        });

        (format!("http://{address}/v1/responses"), requests, handle)
    }

    async fn spawn_openai_payload_capture_test_server(
        captured_payload: Arc<Mutex<Vec<Value>>>,
    ) -> (String, JoinHandle<()>) {
        let app = Router::new().route(
            "/v1/responses",
            post(move |Json(payload): Json<Value>| {
                let captured_payload = captured_payload.clone();
                async move {
                    captured_payload
                        .lock()
                        .expect("lock openai payload capture")
                        .push(payload);
                    (
                        AxumStatusCode::OK,
                        Json(json!({
                            "output_text": "ok:captured",
                            "model": "gpt-5.4-2026-03-01"
                        })),
                    )
                }
            }),
        );

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind openai payload capture test server");
        let address = listener
            .local_addr()
            .expect("resolve openai payload capture test server address");
        let handle = tokio::spawn(async move {
            let _ = axum::serve(listener, app).await;
        });
        (format!("http://{address}/v1/responses"), handle)
    }

    async fn spawn_chatgpt_codex_incomplete_stream_retry_test_server(
        expected_access_token: &'static str,
    ) -> (String, Arc<AtomicUsize>, JoinHandle<()>) {
        let requests = Arc::new(AtomicUsize::new(0));
        let app = Router::new().route(
            "/backend-api/codex/responses",
            post({
                let requests = requests.clone();
                move |headers: axum::http::HeaderMap, Json(payload): Json<Value>| {
                    let requests = requests.clone();
                    async move {
                        let attempt = requests.fetch_add(1, Ordering::SeqCst);
                        let authorization = headers
                            .get("authorization")
                            .and_then(|value| value.to_str().ok())
                            .unwrap_or_default()
                            .to_string();
                        if authorization != format!("Bearer {expected_access_token}") {
                            return (
                                AxumStatusCode::UNAUTHORIZED,
                                Json(json!({ "detail": "Unauthorized" })),
                            )
                                .into_response();
                        }
                        if payload.get("stream").and_then(Value::as_bool) != Some(true) {
                            return (
                                AxumStatusCode::BAD_REQUEST,
                                Json(json!({ "detail": "Stream must be set to true" })),
                            )
                                .into_response();
                        }

                        if attempt == 0 {
                            return (
                                AxumStatusCode::OK,
                                [("content-type", "text/event-stream")],
                                concat!(
                                    "event: response.output_text.delta\n",
                                    "data: {\"type\":\"response.output_text.delta\",\"delta\":\"po\"}\n\n"
                                ),
                            )
                                .into_response();
                        }

                        (
                            AxumStatusCode::OK,
                            [("content-type", "text/event-stream")],
                            concat!(
                                "event: response.output_text.delta\n",
                                "data: {\"type\":\"response.output_text.delta\",\"delta\":\"po\"}\n\n",
                                "event: response.output_text.done\n",
                                "data: {\"type\":\"response.output_text.done\",\"text\":\"pong\"}\n\n"
                            ),
                        )
                            .into_response()
                    }
                }
            }),
        );

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind chatgpt codex incomplete stream retry test server");
        let address = listener
            .local_addr()
            .expect("resolve chatgpt codex incomplete stream retry test server address");
        let handle = tokio::spawn(async move {
            let _ = axum::serve(listener, app).await;
        });
        (
            format!("http://{address}/backend-api/codex/responses"),
            requests,
            handle,
        )
    }

    async fn spawn_chatgpt_codex_created_only_retry_test_server(
        expected_access_token: &'static str,
    ) -> (String, Arc<AtomicUsize>, JoinHandle<()>) {
        let requests = Arc::new(AtomicUsize::new(0));
        let app = Router::new().route(
            "/backend-api/codex/responses",
            post({
                let requests = requests.clone();
                move |headers: axum::http::HeaderMap, Json(payload): Json<Value>| {
                    let requests = requests.clone();
                    async move {
                        let attempt = requests.fetch_add(1, Ordering::SeqCst);
                        let authorization = headers
                            .get("authorization")
                            .and_then(|value| value.to_str().ok())
                            .unwrap_or_default()
                            .to_string();
                        if authorization != format!("Bearer {expected_access_token}") {
                            return (
                                AxumStatusCode::UNAUTHORIZED,
                                Json(json!({ "detail": "Unauthorized" })),
                            )
                                .into_response();
                        }
                        if payload.get("stream").and_then(Value::as_bool) != Some(true) {
                            return (
                                AxumStatusCode::BAD_REQUEST,
                                Json(json!({ "detail": "Stream must be set to true" })),
                            )
                                .into_response();
                        }

                        if attempt == 0 {
                            return (
                                AxumStatusCode::OK,
                                [("content-type", "text/event-stream")],
                                concat!(
                                    "event: response.created\n",
                                    "data: {\"type\":\"response.created\"}\n\n"
                                ),
                            )
                                .into_response();
                        }

                        (
                            AxumStatusCode::OK,
                            [("content-type", "text/event-stream")],
                            concat!(
                                "event: response.output_text.delta\n",
                                "data: {\"type\":\"response.output_text.delta\",\"delta\":\"po\"}\n\n",
                                "event: response.output_text.done\n",
                                "data: {\"type\":\"response.output_text.done\",\"text\":\"pong\"}\n\n"
                            ),
                        )
                            .into_response()
                    }
                }
            }),
        );

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind chatgpt codex created-only retry test server");
        let address = listener
            .local_addr()
            .expect("resolve chatgpt codex created-only retry test server address");
        let handle = tokio::spawn(async move {
            let _ = axum::serve(listener, app).await;
        });
        (
            format!("http://{address}/backend-api/codex/responses"),
            requests,
            handle,
        )
    }

    async fn spawn_chatgpt_codex_status_error_test_server() -> (String, JoinHandle<()>) {
        let app = Router::new().route(
            "/backend-api/codex/responses",
            post(|| async {
                (
                    AxumStatusCode::BAD_REQUEST,
                    Json(json!({ "detail": "Stream must be set to true" })),
                )
            }),
        );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind chatgpt codex status test server");
        let address = listener
            .local_addr()
            .expect("resolve chatgpt codex status test server address");
        let handle = tokio::spawn(async move {
            let _ = axum::serve(listener, app).await;
        });
        (
            format!("http://{address}/backend-api/codex/responses"),
            handle,
        )
    }

    async fn spawn_chatgpt_codex_payload_capture_test_server(
        captured_payload: Arc<Mutex<Vec<Value>>>,
    ) -> (String, JoinHandle<()>) {
        let app = Router::new().route(
            "/backend-api/codex/responses",
            post(move |Json(payload): Json<Value>| {
                let captured_payload = captured_payload.clone();
                async move {
                    captured_payload
                        .lock()
                        .expect("lock chatgpt payload capture")
                        .push(payload);
                        (
                            AxumStatusCode::OK,
                            [("content-type", "text/event-stream")],
                            concat!(
                                "event: response.output_text.done\n",
                                "data: {\"type\":\"response.output_text.done\",\"text\":\"ok:captured\",\"response\":{\"model\":\"gpt-5.4-2026-03-01\"}}\n\n"
                            ),
                        )
                }
            }),
        );

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind chatgpt payload capture test server");
        let address = listener
            .local_addr()
            .expect("resolve chatgpt payload capture test server address");
        let handle = tokio::spawn(async move {
            let _ = axum::serve(listener, app).await;
        });
        (
            format!("http://{address}/backend-api/codex/responses"),
            handle,
        )
    }

    async fn spawn_chatgpt_codex_usage_test_server(
        expected_access_token: &'static str,
        expected_account_id: Option<&'static str>,
    ) -> (String, Arc<AtomicUsize>, JoinHandle<()>) {
        let requests = Arc::new(AtomicUsize::new(0));
        let app = Router::new().route(
            "/backend-api/wham/usage",
            post({
                let requests = requests.clone();
                move || {
                    let requests = requests.clone();
                    async move {
                        requests.fetch_add(1, Ordering::SeqCst);
                        (
                            AxumStatusCode::METHOD_NOT_ALLOWED,
                            Json(json!({ "detail": "Method not allowed" })),
                        )
                    }
                }
            }),
        );
        let app = app.route(
            "/backend-api/wham/usage",
            get({
                let requests = requests.clone();
                move |headers: axum::http::HeaderMap| {
                    let requests = requests.clone();
                    async move {
                        requests.fetch_add(1, Ordering::SeqCst);
                        let authorization = headers
                            .get("authorization")
                            .and_then(|value| value.to_str().ok())
                            .unwrap_or_default()
                            .to_string();
                        if authorization != format!("Bearer {expected_access_token}") {
                            return (
                                AxumStatusCode::UNAUTHORIZED,
                                Json(json!({ "detail": "Unauthorized" })),
                            )
                                .into_response();
                        }
                        if let Some(expected_account_id) = expected_account_id {
                            let account_id = headers
                                .get("chatgpt-account-id")
                                .and_then(|value| value.to_str().ok());
                            if account_id != Some(expected_account_id) {
                                return (
                                    AxumStatusCode::BAD_REQUEST,
                                    Json(json!({ "detail": "Missing ChatGPT-Account-Id" })),
                                )
                                    .into_response();
                            }
                        }
                        (
                            AxumStatusCode::OK,
                            Json(json!({
                                "plan_type": "free",
                                "rate_limit": {
                                    "primary_window": {
                                        "used_percent": 12.5,
                                        "limit_window_seconds": 7200,
                                        "reset_after_seconds": 1800
                                    }
                                }
                            })),
                        )
                            .into_response()
                    }
                }
            }),
        );

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind chatgpt codex usage test server");
        let address = listener
            .local_addr()
            .expect("resolve chatgpt codex usage test server address");
        let handle = tokio::spawn(async move {
            let _ = axum::serve(listener, app).await;
        });
        (
            format!("http://{address}/backend-api/wham/usage"),
            requests,
            handle,
        )
    }

    async fn spawn_chatgpt_codex_usage_status_error_test_server() -> (String, JoinHandle<()>) {
        let app = Router::new().route(
            "/backend-api/wham/usage",
            get(|| async {
                (
                    AxumStatusCode::BAD_REQUEST,
                    Json(json!({ "detail": "Invalid token for usage fetch" })),
                )
            }),
        );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind chatgpt codex usage status test server");
        let address = listener
            .local_addr()
            .expect("resolve chatgpt codex usage status test server address");
        let handle = tokio::spawn(async move {
            let _ = axum::serve(listener, app).await;
        });
        (format!("http://{address}/backend-api/wham/usage"), handle)
    }

    #[test]
    fn retry_after_ms_from_headers_parses_seconds() {
        let mut headers = HeaderMap::new();
        headers.insert(RETRY_AFTER, HeaderValue::from_static("3"));
        assert_eq!(retry_after_ms_from_headers(&headers), Some(3_000));
    }

    #[tokio::test]
    async fn query_openai_retries_body_decode_errors() {
        let (endpoint, requests, server_handle) =
            spawn_openai_decode_retry_test_server("openai-test-key").await;
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .expect("build test client");
        let mut config = test_service_config();
        config.openai_endpoint = endpoint;
        config.openai_max_retries = 1;
        config.openai_retry_base_ms = 1;

        let response = query_openai(
            &client,
            &config,
            Some("openai-test-key"),
            "hello",
            "gpt-5",
            None,
            None,
        )
        .await
        .expect("openai request should retry body decode failure");

        assert_eq!(response.output, "ok:recovered");
        assert_eq!(response.response_model_id.as_deref(), Some("gpt-5.4-2026-03-01"));
        assert_eq!(requests.load(Ordering::SeqCst), 2);
        server_handle.abort();
    }

    #[tokio::test]
    async fn query_openai_maps_fast_service_tier_to_priority_request_body() {
        let captured_payload = Arc::new(Mutex::new(Vec::<Value>::new()));
        let (endpoint, server_handle) =
            spawn_openai_payload_capture_test_server(captured_payload.clone()).await;
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .expect("build test client");
        let mut config = test_service_config();
        config.openai_endpoint = endpoint;

        let response = query_openai(
            &client,
            &config,
            Some("openai-test-key"),
            "hello",
            "gpt-5",
            Some("high"),
            Some("fast"),
        )
        .await
        .expect("openai request should succeed");

        assert_eq!(response.output, "ok:captured");
        assert_eq!(response.response_model_id.as_deref(), Some("gpt-5.4-2026-03-01"));
        let payloads = captured_payload.lock().expect("lock openai payloads");
        assert_eq!(payloads.len(), 1);
        assert_eq!(payloads[0]["service_tier"], json!("priority"));
        assert_eq!(payloads[0]["reasoning"]["effort"], json!("high"));
        server_handle.abort();
    }

    #[tokio::test]
    async fn query_openai_compat_chat_retries_on_non_json_server_error() {
        let (base_url, attempts, server_handle) =
            spawn_openai_compat_retry_test_server(Arc::new(|attempt| {
                if attempt == 0 {
                    return (
                        AxumStatusCode::BAD_GATEWAY,
                        "upstream gateway temporarily unavailable",
                    )
                        .into_response();
                }
                (
                    AxumStatusCode::OK,
                    Json(json!({
                        "choices": [{
                            "message": { "content": "ok:recovered" }
                        }]
                    })),
                )
                    .into_response()
            }))
            .await;

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .expect("build test client");
        let mut config = test_service_config();
        config.openai_max_retries = 1;
        config.openai_retry_base_ms = 1;

        let result = query_openai_compat_chat(
            &client,
            &config,
            base_url.as_str(),
            "compat-test-key",
            "hello",
            "gpt-5.3-codex",
            None,
            None,
        )
        .await
        .expect("request should recover after retry");

        assert_eq!(result.output, "ok:recovered");
        assert_eq!(result.response_model_id, None);
        assert_eq!(attempts.load(Ordering::SeqCst), 2);
        server_handle.abort();
    }

    #[tokio::test]
    async fn query_openai_compat_chat_does_not_retry_non_retryable_non_json_status() {
        let (base_url, attempts, server_handle) =
            spawn_openai_compat_retry_test_server(Arc::new(|_attempt| {
                (
                    AxumStatusCode::BAD_REQUEST,
                    "invalid payload format for provider",
                )
                    .into_response()
            }))
            .await;

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .expect("build test client");
        let mut config = test_service_config();
        config.openai_max_retries = 3;
        config.openai_retry_base_ms = 1;

        let error = query_openai_compat_chat(
            &client,
            &config,
            base_url.as_str(),
            "compat-test-key",
            "hello",
            "gpt-5.3-codex",
            None,
            None,
        )
        .await
        .expect_err("non-retryable status should fail immediately");

        assert!(error.contains("status 400"));
        assert!(error.contains("invalid payload format"));
        assert_eq!(attempts.load(Ordering::SeqCst), 1);
        server_handle.abort();
    }

    #[tokio::test]
    async fn query_openai_compat_chat_maps_fast_service_tier_to_priority_request_body() {
        let captured_payload = Arc::new(Mutex::new(Vec::<Value>::new()));
        let (base_url, server_handle) =
            spawn_openai_compat_payload_capture_test_server(captured_payload.clone()).await;
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .expect("build test client");
        let config = test_service_config();

        let result = query_openai_compat_chat(
            &client,
            &config,
            base_url.as_str(),
            "compat-test-key",
            "hello",
            "gpt-5.3-codex",
            Some("high"),
            Some("fast"),
        )
        .await
        .expect("compat request should succeed");

        assert_eq!(result.output, "ok:captured");
        assert_eq!(result.response_model_id, None);
        let payloads = captured_payload.lock().expect("lock compat payloads");
        assert_eq!(payloads.len(), 1);
        assert_eq!(payloads[0]["service_tier"], json!("priority"));
        assert_eq!(payloads[0]["reasoning"]["effort"], json!("high"));
        server_handle.abort();
    }

    #[tokio::test]
    async fn query_chatgpt_codex_responses_parses_sse_output_text() {
        let (endpoint, requests, server_handle) =
            spawn_chatgpt_codex_sse_test_server("chatgpt-access-token", Some("acct-123")).await;

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .expect("build test client");
        let mut config = test_service_config();
        config.openai_max_retries = 0;

        let response = query_chatgpt_codex_responses_with_endpoint(
            &client,
            &config,
            endpoint.as_str(),
            "chatgpt-access-token",
            "Say pong",
            "gpt-5",
            Some("high"),
            None,
            Some("acct-123"),
            None,
        )
        .await
        .expect("chatgpt codex stream should return output text");

        assert_eq!(response.output, "pong");
        assert_eq!(response.response_model_id.as_deref(), Some("gpt-5.4-2026-03-01"));
        assert_eq!(requests.load(Ordering::SeqCst), 1);
        server_handle.abort();
    }

    #[tokio::test]
    async fn query_chatgpt_codex_responses_maps_fast_service_tier_to_chatgpt_request_body() {
        let captured_payload = Arc::new(Mutex::new(Vec::<Value>::new()));
        let (endpoint, server_handle) =
            spawn_chatgpt_codex_payload_capture_test_server(captured_payload.clone()).await;
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .expect("build test client");
        let config = test_service_config();

        let response = query_chatgpt_codex_responses_with_endpoint(
            &client,
            &config,
            endpoint.as_str(),
            "chatgpt-access-token",
            "Say pong",
            "gpt-5",
            Some("high"),
            Some("fast"),
            None,
            None,
        )
        .await
        .expect("chatgpt codex request should succeed");

        assert_eq!(response.output, "ok:captured");
        assert_eq!(response.response_model_id.as_deref(), Some("gpt-5.4-2026-03-01"));
        let payloads = captured_payload.lock().expect("lock chatgpt payloads");
        assert_eq!(payloads.len(), 1);
        assert_eq!(payloads[0]["serviceTier"], json!("fast"));
        assert_eq!(payloads[0]["reasoning"]["effort"], json!("high"));
        server_handle.abort();
    }

    #[tokio::test]
    async fn query_chatgpt_codex_responses_emits_incremental_delta_callbacks() {
        let (endpoint, _requests, server_handle) =
            spawn_chatgpt_codex_sse_test_server("chatgpt-access-token", None).await;

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .expect("build test client");
        let mut config = test_service_config();
        config.openai_max_retries = 0;

        let deltas = Arc::new(Mutex::new(Vec::<String>::new()));
        let delta_sink = deltas.clone();
        let callback = Arc::new(move |delta: String| {
            if let Ok(mut guard) = delta_sink.lock() {
                guard.push(delta);
            }
        }) as ProviderDeltaCallback;
        let response = query_chatgpt_codex_responses_with_endpoint(
            &client,
            &config,
            endpoint.as_str(),
            "chatgpt-access-token",
            "Say pong",
            "gpt-5",
            None,
            None,
            None,
            Some(callback),
        )
        .await
        .expect("chatgpt codex stream should emit deltas and complete");

        assert_eq!(response.output, "pong");
        assert_eq!(response.response_model_id.as_deref(), Some("gpt-5.4-2026-03-01"));
        let observed = deltas.lock().expect("lock delta sink").clone();
        assert_eq!(observed, vec!["po".to_string(), "ng".to_string()]);
        server_handle.abort();
    }

    #[tokio::test]
    async fn query_chatgpt_codex_responses_surfaces_status_errors() {
        let (endpoint, server_handle) = spawn_chatgpt_codex_status_error_test_server().await;

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .expect("build test client");
        let mut config = test_service_config();
        config.openai_max_retries = 0;

        let error = query_chatgpt_codex_responses_with_endpoint(
            &client,
            &config,
            endpoint.as_str(),
            "chatgpt-access-token",
            "Say pong",
            "gpt-5",
            None,
            None,
            None,
            None,
        )
        .await
        .expect_err("chatgpt codex upstream error should bubble up");

        assert!(error.contains("Stream must be set to true"));
        server_handle.abort();
    }

    #[tokio::test]
    async fn query_chatgpt_codex_responses_retries_stream_decode_errors() {
        let (endpoint, requests, server_handle) =
            spawn_chatgpt_codex_decode_retry_test_server("chatgpt-access-token").await;

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .expect("build test client");
        let mut config = test_service_config();
        config.openai_max_retries = 1;
        config.openai_retry_base_ms = 1;

        let response = query_chatgpt_codex_responses_with_endpoint(
            &client,
            &config,
            endpoint.as_str(),
            "chatgpt-access-token",
            "Say pong",
            "gpt-5",
            None,
            None,
            None,
            None,
        )
        .await
        .expect("chatgpt codex stream decode errors should retry and recover");

        assert_eq!(response.output, "pong");
        assert_eq!(requests.load(Ordering::SeqCst), 2);
        server_handle.abort();
    }

    #[tokio::test]
    async fn query_chatgpt_codex_responses_retries_incomplete_stream_without_done() {
        let (endpoint, requests, server_handle) =
            spawn_chatgpt_codex_incomplete_stream_retry_test_server("chatgpt-access-token").await;

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .expect("build test client");
        let mut config = test_service_config();
        config.openai_max_retries = 1;
        config.openai_retry_base_ms = 1;

        let response = query_chatgpt_codex_responses_with_endpoint(
            &client,
            &config,
            endpoint.as_str(),
            "chatgpt-access-token",
            "Say pong",
            "gpt-5",
            None,
            None,
            None,
            None,
        )
        .await
        .expect("chatgpt codex stream should retry incomplete stream output");

        assert_eq!(response.output, "pong");
        assert_eq!(requests.load(Ordering::SeqCst), 2);
        server_handle.abort();
    }

    #[tokio::test]
    async fn query_chatgpt_codex_responses_errors_when_done_event_missing_after_retry_budget() {
        let (endpoint, requests, server_handle) =
            spawn_chatgpt_codex_incomplete_stream_retry_test_server("chatgpt-access-token").await;

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .expect("build test client");
        let mut config = test_service_config();
        config.openai_max_retries = 0;
        config.openai_retry_base_ms = 1;

        let error = query_chatgpt_codex_responses_with_endpoint(
            &client,
            &config,
            endpoint.as_str(),
            "chatgpt-access-token",
            "Say pong",
            "gpt-5",
            None,
            None,
            None,
            None,
        )
        .await
        .expect_err("missing done event should fail after retry budget");

        assert!(error.contains("response.output_text.done"));
        assert_eq!(requests.load(Ordering::SeqCst), 1);
        server_handle.abort();
    }

    #[tokio::test]
    async fn query_chatgpt_codex_responses_retries_created_only_stream_without_done() {
        let (endpoint, requests, server_handle) =
            spawn_chatgpt_codex_created_only_retry_test_server("chatgpt-access-token").await;

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .expect("build test client");
        let mut config = test_service_config();
        config.openai_max_retries = 1;
        config.openai_retry_base_ms = 1;

        let response = query_chatgpt_codex_responses_with_endpoint(
            &client,
            &config,
            endpoint.as_str(),
            "chatgpt-access-token",
            "Say pong",
            "gpt-5",
            None,
            None,
            None,
            None,
        )
        .await
        .expect("created-only stream should retry and recover");

        assert_eq!(response.output, "pong");
        assert_eq!(requests.load(Ordering::SeqCst), 2);
        server_handle.abort();
    }

    #[tokio::test]
    async fn query_chatgpt_codex_usage_returns_json_payload() {
        let (endpoint, requests, server_handle) =
            spawn_chatgpt_codex_usage_test_server("chatgpt-access-token", Some("acct-123")).await;

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .expect("build test client");
        let mut config = test_service_config();
        config.openai_max_retries = 0;

        let payload = query_chatgpt_codex_usage_with_endpoint(
            &client,
            &config,
            endpoint.as_str(),
            "chatgpt-access-token",
            Some("acct-123"),
        )
        .await
        .expect("usage request should parse JSON payload");

        assert_eq!(
            payload.get("plan_type").and_then(Value::as_str),
            Some("free")
        );
        assert_eq!(requests.load(Ordering::SeqCst), 1);
        server_handle.abort();
    }

    #[tokio::test]
    async fn query_chatgpt_codex_usage_surfaces_status_errors() {
        let (endpoint, server_handle) = spawn_chatgpt_codex_usage_status_error_test_server().await;

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .expect("build test client");
        let mut config = test_service_config();
        config.openai_max_retries = 0;

        let error = query_chatgpt_codex_usage_with_endpoint(
            &client,
            &config,
            endpoint.as_str(),
            "chatgpt-access-token",
            None,
        )
        .await
        .expect_err("usage upstream error should bubble up");

        assert!(error.contains("Invalid token for usage fetch"));
        server_handle.abort();
    }

    #[test]
    fn retry_after_ms_from_headers_ignores_invalid_value() {
        let mut headers = HeaderMap::new();
        headers.insert(RETRY_AFTER, HeaderValue::from_static("invalid"));
        assert_eq!(retry_after_ms_from_headers(&headers), None);
    }

    #[test]
    fn retry_after_ms_from_headers_parses_http_date() {
        let mut headers = HeaderMap::new();
        headers.insert(
            RETRY_AFTER,
            HeaderValue::from_static("Sun, 06 Nov 2095 08:49:37 GMT"),
        );
        assert!(
            retry_after_ms_from_headers(&headers).is_some(),
            "expected http-date Retry-After to be parsed"
        );
    }

    #[test]
    fn retry_after_ms_from_headers_normalizes_past_http_date_to_zero() {
        let mut headers = HeaderMap::new();
        headers.insert(
            RETRY_AFTER,
            HeaderValue::from_static("Sun, 06 Nov 1994 08:49:37 GMT"),
        );
        assert_eq!(retry_after_ms_from_headers(&headers), Some(0));
    }

    #[test]
    fn parse_retry_after_ms_supports_http_date_delta() {
        let now = httpdate::parse_http_date("Sun, 06 Nov 1994 08:49:30 GMT")
            .expect("valid now reference");
        assert_eq!(
            parse_retry_after_ms("Sun, 06 Nov 1994 08:49:37 GMT", now),
            Some(7_000)
        );
    }

    #[test]
    fn parse_retry_after_ms_rejects_empty_value() {
        assert_eq!(parse_retry_after_ms("", SystemTime::now()), None);
    }

    #[test]
    fn build_upstream_error_message_prefers_json_error_message() {
        let payload = serde_json::json!({
            "error": {
                "message": "rate limit exceeded"
            }
        });
        let message = build_upstream_error_message(
            Some(&payload),
            b"ignored",
            StatusCode::TOO_MANY_REQUESTS,
            "OpenAI request failed.",
        );
        assert_eq!(message, "rate limit exceeded");
    }

    #[test]
    fn build_upstream_error_message_uses_body_snippet_when_json_missing() {
        let message = build_upstream_error_message(
            None,
            b"  upstream   temporarily    unavailable  ",
            StatusCode::BAD_GATEWAY,
            "OpenAI request failed.",
        );
        assert_eq!(
            message,
            "OpenAI request failed. (status 502): upstream temporarily unavailable"
        );
    }

    #[test]
    fn build_upstream_error_message_falls_back_when_body_blank() {
        let message = build_upstream_error_message(
            None,
            b"   ",
            StatusCode::INTERNAL_SERVER_ERROR,
            "OpenAI request failed.",
        );
        assert_eq!(message, "OpenAI request failed.");
    }

    #[test]
    fn normalize_error_body_snippet_truncates_oversized_input() {
        let oversized = "x".repeat(UPSTREAM_ERROR_BODY_SNIPPET_MAX_CHARS + 64);
        let snippet = normalize_error_body_snippet(oversized.as_bytes())
            .expect("oversized body should produce a normalized snippet");
        assert_eq!(
            snippet.chars().count(),
            UPSTREAM_ERROR_BODY_SNIPPET_MAX_CHARS
        );
        assert!(snippet.ends_with("..."));
    }

    #[test]
    fn normalize_error_body_snippet_handles_non_utf8_bytes() {
        let snippet = normalize_error_body_snippet(&[0x66, 0x6f, 0x80, 0x20, 0x62, 0x61, 0x72])
            .expect("non-utf8 body should still produce snippet");
        assert!(snippet.contains("fo"));
        assert!(snippet.contains("bar"));
    }

    #[test]
    fn retry_backoff_ms_uses_base_backoff_plus_jitter_budget() {
        let base_ms = 100;
        let delay = retry_backoff_ms(base_ms, 2, None, 10_000);
        // attempt=2 => base backoff is 100 * 4 = 400, jitter budget is 20%.
        assert!((400..=480).contains(&delay));
    }

    #[test]
    fn retry_backoff_ms_respects_retry_after_floor() {
        let delay = retry_backoff_ms(100, 0, Some(10_000), 20_000);
        assert!(delay >= 10_000);
    }

    #[test]
    fn retry_backoff_ms_caps_retry_after_to_max_delay() {
        let delay = retry_backoff_ms(100, 0, Some(60_000), 5_000);
        assert_eq!(delay, 5_000);
    }
