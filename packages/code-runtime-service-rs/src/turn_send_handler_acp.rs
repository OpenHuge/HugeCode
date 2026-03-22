use super::*;

#[derive(Clone)]
pub(super) struct TurnSendTaskInput {
    pub(super) workspace_id: String,
    pub(super) thread_id: String,
    pub(super) turn_id: String,
    pub(super) request_id: Option<String>,
    pub(super) provider_content: String,
    pub(super) local_exec_content: String,
    pub(super) routed_provider_route: TurnProviderRoute,
    pub(super) model_id: String,
    pub(super) reason_effort: Option<String>,
    pub(super) service_tier: Option<String>,
    pub(super) access_mode: String,
    pub(super) execution_mode: TurnExecutionMode,
    pub(super) workspace_path_for_turn: String,
    pub(super) requested_codex_bin: Option<String>,
    pub(super) requested_codex_args: Vec<String>,
    pub(super) oauth_compat_base_url: Option<String>,
    pub(super) oauth_api_key: Option<String>,
    pub(super) extension_api_key: Option<String>,
    pub(super) oauth_fallback_api_key: Option<String>,
    pub(super) oauth_local_codex_id_token: Option<String>,
    pub(super) oauth_local_codex_refresh_token: Option<String>,
    pub(super) oauth_persist_local_codex_auth_updates: bool,
    pub(super) oauth_credential_source: Option<String>,
    pub(super) oauth_auth_mode: Option<String>,
    pub(super) oauth_external_account_id: Option<String>,
    pub(super) oauth_account_id: Option<String>,
    pub(super) collaboration_mode: RequestedCollaborationMode,
    pub(super) acp_backend_id: Option<String>,
}

pub(super) async fn resolve_requested_acp_backend_id(
    ctx: &AppContext,
    preferred_backend_ids: &[String],
) -> Option<String> {
    for backend_id in preferred_backend_ids {
        if crate::acp_runtime::resolve_execution_integration(ctx, backend_id)
            .await
            .is_some()
        {
            return Some(backend_id.clone());
        }
    }
    None
}

pub(super) async fn try_complete_turn_send_via_acp(
    ctx: &AppContext,
    task: &TurnSendTaskInput,
    turn_interrupt_waiter: Arc<Notify>,
) -> bool {
    let Some(acp_backend_id) = task.acp_backend_id.as_deref() else {
        return false;
    };
    let completion = match crate::acp_runtime::ensure_session_for_turn(
        ctx,
        acp_backend_id,
        task.workspace_id.as_str(),
        task.thread_id.as_str(),
        task.workspace_path_for_turn.as_str(),
        task.access_mode.as_str(),
        task.turn_id.as_str(),
    )
    .await
    {
        Ok((diagnostics, mut receiver)) => {
            let mut streamed_parts = Vec::new();
            let prompt_future = crate::acp_runtime::prompt_session(
                ctx,
                diagnostics.session_id.as_str(),
                task.provider_content.as_str(),
            );
            tokio::pin!(prompt_future);
            loop {
                tokio::select! {
                    _ = turn_interrupt_waiter.notified() => {
                        let _ = crate::acp_runtime::cancel_session_by_turn(ctx, task.turn_id.as_str()).await;
                        break Err(RpcError::internal("Turn interrupted by operator."));
                    }
                    event = receiver.recv() => {
                        match event {
                            Ok(crate::acp_runtime::AcpSessionEvent::SessionUpdate(payload))
                            | Ok(crate::acp_runtime::AcpSessionEvent::AvailableCommandsUpdate(payload)) => {
                                if let Some(delta) = crate::acp_runtime::extract_session_update_text(&payload) {
                                    streamed_parts.push(delta.clone());
                                    publish_turn_event(
                                        ctx,
                                        TURN_EVENT_DELTA,
                                        json!({
                                            "turnId": task.turn_id,
                                            "delta": delta,
                                        }),
                                        task.request_id.as_deref(),
                                    );
                                }
                            }
                            Err(_) => {}
                        }
                    }
                    result = &mut prompt_future => {
                        loop {
                            match receiver.try_recv() {
                                Ok(crate::acp_runtime::AcpSessionEvent::SessionUpdate(payload))
                                | Ok(crate::acp_runtime::AcpSessionEvent::AvailableCommandsUpdate(payload)) => {
                                    if let Some(delta) = crate::acp_runtime::extract_session_update_text(&payload) {
                                        streamed_parts.push(delta.clone());
                                        publish_turn_event(
                                            ctx,
                                            TURN_EVENT_DELTA,
                                            json!({
                                                "turnId": task.turn_id,
                                                "delta": delta,
                                            }),
                                            task.request_id.as_deref(),
                                        );
                                    }
                                }
                                Err(tokio::sync::broadcast::error::TryRecvError::Empty)
                                | Err(tokio::sync::broadcast::error::TryRecvError::Closed) => break,
                                Err(tokio::sync::broadcast::error::TryRecvError::Lagged(_)) => continue,
                            }
                        }
                        break result
                            .map(|outcome| {
                                if crate::acp_runtime::prompt_outcome_was_cancelled(&outcome) {
                                    Err(RpcError::internal("Turn interrupted by operator."))
                                } else {
                                    Ok(crate::acp_runtime::resolve_prompt_outcome_text(&outcome, &streamed_parts))
                                }
                            })
                            .map_err(RpcError::internal)
                            .and_then(|result| result);
                    }
                }
            }
        }
        Err(error) => Err(RpcError::internal(error)),
    };
    super::clear_turn_interrupt_waiter(ctx, task.turn_id.as_str()).await;
    {
        let mut state = ctx.state.write().await;
        if let Some(threads) = state.workspace_threads.get_mut(task.workspace_id.as_str()) {
            if let Some(thread) = threads.iter_mut().find(|entry| entry.id == task.thread_id) {
                let now = now_ms();
                thread.running = false;
                thread.updated_at = now;
                thread.last_activity_at = Some(now);
                match completion.as_ref() {
                    Ok(_) => thread.status = Some("completed".to_string()),
                    Err(_) => thread.status = Some("failed".to_string()),
                }
            }
        }
    }
    match completion {
        Ok(message) => {
            publish_turn_event(
                ctx,
                TURN_EVENT_COMPLETED,
                json!({
                    "turnId": task.turn_id,
                    "output": message.as_str(),
                    "accessMode": task.access_mode,
                    "executionMode": "acp",
                    "routedProvider": "acp",
                    "message": {
                        "role": "assistant",
                        "content": message.as_str(),
                    },
                }),
                task.request_id.as_deref(),
            );
        }
        Err(error) => {
            publish_turn_event(
                ctx,
                TURN_EVENT_FAILED,
                json!({
                    "turnId": task.turn_id,
                    "error": {
                        "code": resolve_turn_failure_code(error.message.as_str()),
                        "message": error.message,
                    },
                }),
                task.request_id.as_deref(),
            );
        }
    }
    crate::acp_runtime::release_turn_session_binding(ctx, task.turn_id.as_str()).await;
    publish_thread_live_update_events(
        ctx,
        task.workspace_id.as_str(),
        task.thread_id.as_str(),
        Some("code_turn_send"),
    )
    .await;
    true
}
