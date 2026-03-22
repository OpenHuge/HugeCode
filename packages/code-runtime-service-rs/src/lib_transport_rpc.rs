fn rpc_response_from_error(error: RpcError) -> RpcResponse {
    RpcResponse {
        ok: false,
        result: None,
        error: Some(RpcErrorPayload {
            code: error.code.as_str().to_string(),
            message: error.message,
        }),
    }
}

async fn execute_rpc_request(
    ctx: &AppContext,
    requested_method: &str,
    params: &Value,
    request_id: &str,
) -> RpcResponse {
    let started_at = Instant::now();
    let requested_method = requested_method.trim();
    let (method, is_native_only) =
        if let Some(native_method) = crate::native_runtime::resolve_native_only_rpc_method(requested_method) {
            (native_method, true)
        } else {
            match resolve_rpc_method(requested_method) {
                Some(method) => (method, false),
                None => {
                    let error = RpcError::method_not_found(requested_method);
                    warn!(
                        request_id,
                        method = requested_method,
                        latency_ms = started_at.elapsed().as_millis() as u64,
                        error = error.message.as_str(),
                        "rpc request failed"
                    );
                    return rpc_response_from_error(error);
                }
            }
        };
    let runtime_updated_reason =
        crate::native_runtime::runtime_updated_reason_for_request(requested_method, method);

    if method == "code_rpc_capabilities" {
        let result = rpc_capabilities_payload_for_requested_method(requested_method);
        info!(
            request_id,
            method = requested_method,
            latency_ms = started_at.elapsed().as_millis() as u64,
            "rpc request completed"
        );
        return RpcResponse {
            ok: true,
            result: Some(result),
            error: None,
        };
    }

    let rpc_result = if is_native_only {
        handle_native_rpc(ctx, method, params).await
    } else {
        handle_rpc(ctx, method, params).await
    };

    match rpc_result {
        Ok(result) => {
            if let Some(scope) = runtime_update_scope_for_method(method) {
                let (event_at_ms, diagnostics) =
                    prepare_runtime_updated_diagnostics_payload_for_emit(
                        ctx, None, None, None, None,
                    )
                    .await;
                publish_runtime_updated_event_at(
                    ctx,
                    scope,
                    runtime_updated_reason.as_str(),
                    Some(diagnostics),
                    event_at_ms,
                );
            }
            info!(
                request_id,
                method,
                latency_ms = started_at.elapsed().as_millis() as u64,
                "rpc request completed"
            );
            RpcResponse {
                ok: true,
                result: Some(result),
                error: None,
            }
        }
        Err(error) => {
            warn!(
                request_id,
                method,
                latency_ms = started_at.elapsed().as_millis() as u64,
                error = error.message.as_str(),
                "rpc request failed"
            );
            rpc_response_from_error(error)
        }
    }
}

async fn send_ws_json(socket: &mut WebSocket, payload: &Value) -> Result<(), axum::Error> {
    let serialized = serde_json::to_string(payload).map_err(|error| {
        axum::Error::new(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            format!("failed to serialize websocket payload: {error}"),
        ))
    })?;
    send_ws_text(socket, serialized).await
}

async fn send_ws_text(socket: &mut WebSocket, payload: String) -> Result<(), axum::Error> {
    socket.send(Message::Text(payload.into())).await
}

struct WsConnectionDiagnosticsGuard {
    runtime_diagnostics: Arc<RuntimeDiagnosticsState>,
}

impl WsConnectionDiagnosticsGuard {
    fn new(runtime_diagnostics: Arc<RuntimeDiagnosticsState>) -> Self {
        runtime_diagnostics.record_ws_connection_opened();
        Self {
            runtime_diagnostics,
        }
    }
}

impl Drop for WsConnectionDiagnosticsGuard {
    fn drop(&mut self) {
        self.runtime_diagnostics.record_ws_connection_closed();
    }
}

#[derive(Clone, Debug)]
struct WsKernelProjectionSubscription {
    id: Option<String>,
    scopes: Vec<String>,
    last_revision: u64,
}

enum WsMessageOutcome {
    Handled,
    KernelProjectionSubscribed(WsKernelProjectionSubscription),
}

async fn send_ws_runtime_event(
    socket: &mut WebSocket,
    event: Value,
    event_id: Option<u64>,
) -> Result<(), axum::Error> {
    let mut payload = serde_json::Map::from_iter([
        (
            "type".to_string(),
            Value::String("runtime.event".to_string()),
        ),
        ("event".to_string(), event),
    ]);
    if let Some(event_id) = event_id {
        payload.insert("eventId".to_string(), Value::Number(event_id.into()));
    }
    send_ws_json(socket, &Value::Object(payload)).await
}

async fn send_ws_runtime_event_frame(
    socket: &mut WebSocket,
    frame: &TurnEventFrame,
) -> Result<(), axum::Error> {
    // Replay/live frames already carry canonical JSON envelopes in `payload_json`.
    let mut payload = String::with_capacity(frame.payload_json.len() + 64);
    payload.push_str("{\"type\":\"runtime.event\",\"eventId\":");
    let _ = write!(&mut payload, "{}", frame.id);
    payload.push_str(",\"event\":");
    payload.push_str(frame.payload_json.as_ref());
    payload.push('}');
    send_ws_text(socket, payload).await
}

async fn send_ws_kernel_projection_delta(
    socket: &mut WebSocket,
    delta: &Value,
) -> Result<(), axum::Error> {
    send_ws_json(
        socket,
        &json!({
            "type": "kernel.projection.delta",
            "delta": delta,
        }),
    )
    .await
}

async fn send_ws_transport_ready(socket: &mut WebSocket) -> Result<(), axum::Error> {
    send_ws_json(
        socket,
        &json!({
            "type": "transport.ready",
            "contractVersion": CODE_RUNTIME_RPC_CONTRACT_VERSION,
            "freezeEffectiveAt": CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT,
            "transport": {
                "endpointPath": CODE_RUNTIME_RPC_TRANSPORT_WS_PATH,
                "protocol": CODE_RUNTIME_RPC_TRANSPORT_WS_PROTOCOL,
            },
            "transports": rpc_transport_catalog_payload(),
        }),
    )
    .await
}

async fn send_ws_protocol_error(
    socket: &mut WebSocket,
    id: Option<&str>,
    code: &str,
    message: &str,
) -> Result<(), axum::Error> {
    send_ws_json(
        socket,
        &json!({
            "type": "error",
            "id": id,
            "error": {
                "code": code,
                "message": message,
            },
        }),
    )
    .await
}

async fn handle_ws_text_message(
    ctx: &AppContext,
    socket: &mut WebSocket,
    text: &str,
) -> Result<WsMessageOutcome, axum::Error> {
    let parsed = match serde_json::from_str::<WsClientMessage>(text) {
        Ok(message) => message,
        Err(_) => {
            ctx.runtime_diagnostics.record_ws_protocol_error();
            send_ws_protocol_error(
                socket,
                None,
                "INVALID_MESSAGE",
                "WebSocket payload must be valid JSON.",
            )
            .await?;
            return Ok(WsMessageOutcome::Handled);
        }
    };
    match parsed.message_type.as_str() {
        "ping" => {
            send_ws_json(
                socket,
                &json!({
                    "type": "pong",
                    "id": parsed.id,
                    "timestamp": now_ms(),
                }),
            )
            .await?;
            Ok(WsMessageOutcome::Handled)
        }
        "rpc.request" => {
            let method = parsed
                .method
                .as_deref()
                .map(str::trim)
                .filter(|entry| !entry.is_empty());
            let Some(method) = method else {
                ctx.runtime_diagnostics.record_ws_protocol_error();
                send_ws_protocol_error(
                    socket,
                    parsed.id.as_deref(),
                    "INVALID_MESSAGE",
                    "rpc.request requires a non-empty `method`.",
                )
                .await?;
                return Ok(WsMessageOutcome::Handled);
            };
            let response_id = parsed.id.unwrap_or_else(|| new_id("ws-rpc"));
            let response =
                execute_rpc_request(ctx, method, &parsed.params, response_id.as_str()).await;
            let payload = if response.ok {
                json!({
                    "type": "rpc.response",
                    "id": response_id,
                    "ok": true,
                    "result": response.result,
                })
            } else {
                json!({
                    "type": "rpc.response",
                    "id": response_id,
                    "ok": false,
                    "error": response.error,
                })
            };
            send_ws_json(socket, &payload).await?;
            Ok(WsMessageOutcome::Handled)
        }
        "kernel.projection.subscribe" => {
            let params = match as_object(&parsed.params) {
                Ok(params) => params,
                Err(error) => {
                    ctx.runtime_diagnostics.record_ws_protocol_error();
                    send_ws_protocol_error(
                        socket,
                        parsed.id.as_deref(),
                        error.code_str(),
                        error.message(),
                    )
                    .await?;
                    return Ok(WsMessageOutcome::Handled);
                }
            };
            let scopes = match params.get("scopes").and_then(Value::as_array) {
                Some(scopes) => scopes
                    .iter()
                    .filter_map(Value::as_str)
                    .map(str::trim)
                    .filter(|scope| !scope.is_empty())
                    .map(ToOwned::to_owned)
                    .collect::<Vec<_>>(),
                None => Vec::new(),
            };
            let last_revision = params
                .get("lastRevision")
                .or_else(|| params.get("last_revision"))
                .and_then(Value::as_u64)
                .unwrap_or(0);
            let subscription = WsKernelProjectionSubscription {
                id: parsed.id,
                scopes,
                last_revision,
            };
            Ok(WsMessageOutcome::KernelProjectionSubscribed(subscription))
        }
        _ => {
            ctx.runtime_diagnostics.record_ws_protocol_error();
            send_ws_protocol_error(
                socket,
                parsed.id.as_deref(),
                "INVALID_MESSAGE",
                "Unsupported websocket message type.",
            )
            .await?;
            Ok(WsMessageOutcome::Handled)
        }
    }
}

async fn ws_connection_handler(
    ctx: AppContext,
    mut socket: WebSocket,
    query: WsRuntimeQuery,
    _ws_connection_slot: OwnedSemaphorePermit,
) {
    let _connection_guard = WsConnectionDiagnosticsGuard::new(ctx.runtime_diagnostics.clone());
    if send_ws_transport_ready(&mut socket).await.is_err() {
        return;
    }

    let replay_resolution =
        resolve_turn_event_replay_frames_for_last_event_id(&ctx, query.last_event_id);
    let replay_high_watermark = replay_resolution
        .frames
        .last()
        .map(|frame| frame.id)
        .unwrap_or(0);
    if let Some(replay_gap) = replay_resolution.replay_gap {
        ctx.runtime_diagnostics.record_ws_replay_gap();
        let replay_gap_event = build_runtime_stream_resync_event_envelope(
            ctx.runtime_update_revision
                .load(Ordering::Relaxed)
                .to_string(),
            EVENT_STREAM_RESYNC_REASON_REPLAY_GAP,
            Some(json!({
                "replayGapLastEventId": replay_gap.requested_last_event_id,
                "replayGapOldestEventId": replay_gap.oldest_available_event_id,
            })),
        );
        if send_ws_runtime_event(&mut socket, replay_gap_event, None)
            .await
            .is_err()
        {
            return;
        }
    }
    for frame in replay_resolution.frames {
        if send_ws_runtime_event_frame(&mut socket, &frame)
            .await
            .is_err()
        {
            return;
        }
    }

    let mut event_stream = BroadcastStream::new(ctx.turn_events.subscribe());
    let mut emitted_lag_resync_event = false;
    let mut kernel_projection_subscription: Option<WsKernelProjectionSubscription> = None;
    loop {
        tokio::select! {
            incoming = socket.recv() => {
                let Some(incoming) = incoming else {
                    break;
                };
                let message = match incoming {
                    Ok(message) => message,
                    Err(error) => {
                        ctx.runtime_diagnostics.record_ws_receive_error();
                        warn!(error = %error, "websocket receive failure");
                        break;
                    }
                };
                match message {
                    Message::Text(text) => {
                        let outcome = match handle_ws_text_message(&ctx, &mut socket, text.as_ref()).await {
                            Ok(outcome) => outcome,
                            Err(_) => break,
                        };
                        if let WsMessageOutcome::KernelProjectionSubscribed(mut subscription) = outcome {
                            if subscription.scopes.is_empty() {
                                subscription.scopes = vec![String::from("mission_control")];
                            }
                            let current_revision = ctx.runtime_update_revision.load(Ordering::Relaxed);
                            if send_ws_json(
                                &mut socket,
                                &json!({
                                    "type": "kernel.projection.subscribed",
                                    "id": subscription.id,
                                    "ok": true,
                                    "revision": current_revision,
                                    "scopes": subscription.scopes.clone(),
                                }),
                            ).await.is_err() {
                                break;
                            }
                            if let Ok(Some(delta)) = build_kernel_projection_delta_v3(
                                &ctx,
                                &subscription.scopes,
                                subscription.last_revision,
                                None,
                            ).await {
                                subscription.last_revision = current_revision;
                                if send_ws_kernel_projection_delta(&mut socket, &delta).await.is_err() {
                                    break;
                                }
                            }
                            kernel_projection_subscription = Some(subscription);
                        }
                    }
                    Message::Binary(_) => {
                        ctx.runtime_diagnostics.record_ws_protocol_error();
                        if send_ws_protocol_error(
                            &mut socket,
                            None,
                            "INVALID_MESSAGE",
                            "Binary websocket frames are unsupported.",
                        )
                        .await
                        .is_err()
                        {
                            break;
                        }
                    }
                    Message::Ping(payload) => {
                        if socket.send(Message::Pong(payload)).await.is_err() {
                            break;
                        }
                    }
                    Message::Pong(_) => {}
                    Message::Close(_) => break,
                }
            }
            event_result = event_stream.next() => {
                let Some(event_result) = event_result else {
                    break;
                };
                match event_result {
                    Ok(frame) => {
                        if frame.id <= replay_high_watermark {
                            continue;
                        }
                        if send_ws_runtime_event_frame(&mut socket, &frame).await.is_err() {
                            break;
                        }
                        if let Some(subscription) = kernel_projection_subscription.as_mut() {
                            match build_kernel_projection_delta_v3(
                                &ctx,
                                &subscription.scopes,
                                subscription.last_revision,
                                None,
                            ).await {
                                Ok(Some(delta)) => {
                                    subscription.last_revision = delta
                                        .get("revision")
                                        .and_then(Value::as_u64)
                                        .unwrap_or(subscription.last_revision);
                                    if send_ws_kernel_projection_delta(&mut socket, &delta).await.is_err() {
                                        break;
                                    }
                                }
                                Ok(None) => {}
                                Err(_) => break,
                            }
                        }
                    }
                    Err(BroadcastStreamRecvError::Lagged(skipped)) => {
                        ctx.runtime_diagnostics
                            .record_ws_event_stream_lagged(skipped as u64);
                        if emitted_lag_resync_event {
                            continue;
                        }
                        warn!(
                            skipped,
                            "runtime websocket event stream lagged; emitting resync signal"
                        );
                        emitted_lag_resync_event = true;
                        let lagged_event = build_runtime_stream_resync_event_envelope(
                            ctx.runtime_update_revision
                                .load(Ordering::Relaxed)
                                .to_string(),
                            EVENT_STREAM_RESYNC_REASON_LAGGED,
                            Some(json!({
                                "streamLaggedDroppedEvents": skipped,
                            })),
                        );
                        if send_ws_runtime_event(&mut socket, lagged_event, None).await.is_err() {
                            break;
                        }
                        if let Some(frame) =
                            crate::latest_runtime_state_fabric_event_frame(&ctx)
                        {
                            if send_ws_runtime_event_frame(&mut socket, &frame)
                                .await
                                .is_err()
                            {
                                break;
                            }
                        }
                        if let Some(subscription) = kernel_projection_subscription.as_mut() {
                            match build_kernel_projection_delta_v3(
                                &ctx,
                                &subscription.scopes,
                                subscription.last_revision,
                                Some("subscriber_lagged"),
                            ).await {
                                Ok(Some(delta)) => {
                                    subscription.last_revision = delta
                                        .get("revision")
                                        .and_then(Value::as_u64)
                                        .unwrap_or(subscription.last_revision);
                                    if send_ws_kernel_projection_delta(&mut socket, &delta).await.is_err() {
                                        break;
                                    }
                                }
                                Ok(None) => {}
                                Err(_) => break,
                            }
                        }
                    }
                }
            }
        }
    }
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(ctx): State<AppContext>,
    Query(query): Query<WsRuntimeQuery>,
) -> impl IntoResponse {
    let ws_connection_slot = match ctx.ws_connection_slots.clone().try_acquire_owned() {
        Ok(slot) => slot,
        Err(_) => {
            ctx.runtime_diagnostics.record_ws_connection_rejected();
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                [
                    (
                        RETRY_AFTER,
                        HeaderValue::from_static(WS_CONNECTION_LIMIT_RETRY_AFTER_SECONDS),
                    ),
                    (
                        CACHE_CONTROL,
                        HeaderValue::from_static(WS_CONNECTION_LIMIT_CACHE_CONTROL),
                    ),
                ],
                Json(json!({
                    "app": "code-runtime-service-rs",
                    "status": "unavailable",
                    "error": {
                        "code": "WS_CONNECTION_LIMIT_REACHED",
                        "message": "Runtime websocket capacity reached. Retry shortly.",
                    },
                    "details": {
                        "maxConnections": resolve_ws_max_connections(&ctx.config),
                        "availableSlots": ctx.ws_connection_slots.available_permits(),
                    },
                })),
            )
                .into_response();
        }
    };
    let runtime_diagnostics = ctx.runtime_diagnostics.clone();
    let ws_limits = resolve_ws_transport_limits(&ctx.config);
    ws.protocols([CODE_RUNTIME_RPC_TRANSPORT_WS_PROTOCOL])
        .write_buffer_size(ws_limits.write_buffer_size_bytes)
        .max_write_buffer_size(ws_limits.max_write_buffer_size_bytes)
        .max_frame_size(ws_limits.max_frame_size_bytes)
        .max_message_size(ws_limits.max_message_size_bytes)
        .on_failed_upgrade(move |error| {
            runtime_diagnostics.record_ws_upgrade_failure();
            warn!(error = %error, "runtime websocket upgrade failed");
        })
        .on_upgrade(move |socket| ws_connection_handler(ctx, socket, query, ws_connection_slot))
}

async fn rpc_handler(
    State(ctx): State<AppContext>,
    Json(request): Json<RpcRequest>,
) -> impl IntoResponse {
    let request_id = new_id("rpc");
    let response = execute_rpc_request(
        &ctx,
        request.method.as_str(),
        &request.params,
        request_id.as_str(),
    )
    .await;
    (StatusCode::OK, Json(response))
}

fn new_id(prefix: &str) -> String {
    format!("{prefix}-{}", Uuid::new_v4())
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}
