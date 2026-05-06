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
