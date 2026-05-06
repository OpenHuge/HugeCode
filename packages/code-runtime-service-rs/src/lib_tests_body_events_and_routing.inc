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

