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
