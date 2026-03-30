use super::*;
use crate::provider_query::query_provider_with_delta;
use crate::turn_failure_codes::resolve_turn_failure_code;

#[path = "turn_send_handler_acp.rs"]
mod acp;
#[path = "turn_send_handler_contract.rs"]
mod contract;
mod delta_stream;
#[path = "turn_send_handler_support.rs"]
mod support;

use acp::{TurnSendTaskInput, resolve_requested_acp_backend_id, try_complete_turn_send_via_acp};
use contract::{
    RequestedCollaborationMode, TurnExecutionMode, parse_requested_collaboration_mode,
    parse_turn_execution_mode, parse_turn_send_request,
};
use delta_stream::{
    TurnDeltaCoalescer, TurnDeltaCoalescerConfig, TurnDeltaPipeline, TurnDeltaPipelineConfig,
};
use support::{clear_turn_interrupt_waiter, register_turn_interrupt_waiter};

#[derive(Clone, Debug, Default)]
struct TurnQueryOutcome {
    message: provider_requests::ProviderQueryResult,
    local_claude_session_id: Option<String>,
    local_claude_recovered_from_stale_resume: bool,
}

fn build_turn_contents(content: &str, context_prefix: Option<&str>) -> (String, String) {
    let provider_content = match context_prefix {
        Some(prefix) => format!("{prefix}\n\n{content}"),
        None => content.to_string(),
    };
    let local_exec_content = content.to_string();
    (provider_content, local_exec_content)
}

fn extension_provider_unavailable_error(extension: &RuntimeResolvedProviderExtension) -> RpcError {
    if extension.api_key.is_none() {
        RpcError::invalid_params("Selected extension provider is not configured with API key.")
    } else {
        RpcError::invalid_params("Selected extension provider is disabled.")
    }
}

async fn query_provider_with_local_exec_fallback(
    ctx: &AppContext,
    routed_provider_route: &TurnProviderRoute,
    workspace_id: &str,
    thread_id: &str,
    turn_id: &str,
    workspace_path_for_turn: &str,
    content: &str,
    access_mode: &str,
    codex_bin_override: Option<&str>,
    codex_args: &[String],
    model_id: &str,
    requested_model_id: Option<&str>,
    reason_effort: Option<&str>,
    service_tier: Option<&str>,
    compat_base_url_override: Option<&str>,
    api_key_override: Option<&str>,
    extension_api_key: Option<&str>,
    fallback_api_key_override: Option<&str>,
    local_codex_id_token_override: Option<&str>,
    local_codex_refresh_token_override: Option<&str>,
    persist_local_codex_auth_updates: bool,
    oauth_credential_source_override: Option<&str>,
    oauth_auth_mode_override: Option<&str>,
    oauth_external_account_id_override: Option<&str>,
    collaboration_mode_is_plan: bool,
    error_prefix: Option<&str>,
    delta_callback: Option<provider_requests::ProviderDeltaCallback>,
) -> Result<TurnQueryOutcome, String> {
    if routed_provider_route.is_core_claude_code_local() {
        let result = query_local_claude_exec_turn(
            LocalClaudeExecTurnInput {
                workspace_path: workspace_path_for_turn.to_string(),
                prompt: content.to_string(),
                model_id: requested_model_id
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(ToOwned::to_owned),
                access_mode: access_mode.to_string(),
                collaboration_mode_is_plan,
            },
            delta_callback,
        )
        .await?;
        return Ok(TurnQueryOutcome {
            message: provider_requests::ProviderQueryResult {
                output: result.output,
                response_model_id: result.response_model_id,
            },
            local_claude_session_id: result.session_id,
            local_claude_recovered_from_stale_resume: result.recovered_from_stale_resume,
        });
    }

    let query_provider_direct = || async {
        query_provider_with_delta(
            &ctx.client,
            &ctx.config,
            routed_provider_route,
            compat_base_url_override,
            api_key_override.or(extension_api_key),
            fallback_api_key_override,
            local_codex_id_token_override,
            local_codex_refresh_token_override,
            persist_local_codex_auth_updates,
            oauth_credential_source_override,
            oauth_auth_mode_override,
            oauth_external_account_id_override,
            content,
            model_id,
            reason_effort,
            service_tier,
            delta_callback.clone(),
        )
        .await
        .map(|message| TurnQueryOutcome {
            message,
            local_claude_session_id: None,
            local_claude_recovered_from_stale_resume: false,
        })
    };

    if !matches!(
        routed_provider_route,
        TurnProviderRoute::Core(RuntimeProvider::OpenAI)
    ) {
        return query_provider_direct().await.map_err(|provider_error| {
            if let Some(prefix) = error_prefix {
                format!("{prefix} (provider fallback failed: {provider_error})")
            } else {
                provider_error
            }
        });
    }

    match query_local_codex_exec_turn(
        workspace_path_for_turn,
        content,
        access_mode,
        codex_bin_override,
        codex_args,
    )
    .await
    {
        Ok(message) => Ok(TurnQueryOutcome {
            message: provider_requests::ProviderQueryResult::from_output(message),
            local_claude_session_id: None,
            local_claude_recovered_from_stale_resume: false,
        }),
        Err(local_exec_error) => {
            warn!(
                workspace_id = workspace_id,
                thread_id = thread_id,
                turn_id = turn_id,
                error = local_exec_error.as_str(),
                "local codex exec turn failed; falling back to provider query"
            );
            query_provider_direct().await.map_err(|provider_error| {
                if let Some(prefix) = error_prefix {
                    format!(
                        "{prefix} (local codex exec fallback failed: {local_exec_error}) (provider fallback failed: {provider_error})"
                    )
                } else {
                    format!(
                        "{local_exec_error} (provider fallback after local codex exec failed: {provider_error})"
                    )
                }
            })
        }
    }
}

async fn complete_turn_send(
    ctx: AppContext,
    task: TurnSendTaskInput,
    turn_interrupt_waiter: Arc<Notify>,
) {
    if try_complete_turn_send_via_acp(&ctx, &task, turn_interrupt_waiter.clone()).await {
        return;
    }

    let local_exec_preferred = task.execution_mode.local_exec_preferred();
    let use_runtime_plan_flow = should_use_provider_runtime_plan_flow(
        task.access_mode.as_str(),
        local_exec_preferred,
        &task.routed_provider_route,
    );
    let turn_delta_pipeline = if use_runtime_plan_flow {
        None
    } else {
        let turn_delta_coalescer = Arc::new(TurnDeltaCoalescer::new(
            ctx.clone(),
            task.turn_id.clone(),
            task.request_id.clone(),
            TurnDeltaCoalescerConfig::from_env(),
        ));
        Some(Arc::new(TurnDeltaPipeline::new(
            ctx.clone(),
            turn_delta_coalescer,
            TurnDeltaPipelineConfig::from_env(),
        )))
    };
    let stream_delta_callback = if use_runtime_plan_flow {
        None
    } else {
        let turn_delta_pipeline = turn_delta_pipeline
            .as_ref()
            .cloned()
            .expect("turn delta pipeline");
        Some(Arc::new(move |delta: String| {
            turn_delta_pipeline.ingest(delta);
        }) as provider_requests::ProviderDeltaCallback)
    };

    let completion = tokio::select! {
        _ = turn_interrupt_waiter.notified() => {
            Err(RpcError::internal("Turn interrupted by operator."))
        }
        result = async {
            if task.collaboration_mode == RequestedCollaborationMode::Plan {
                if task.routed_provider_route.is_core_claude_code_local() {
                    return query_provider_with_local_exec_fallback(
                        &ctx,
                        &task.routed_provider_route,
                        task.workspace_id.as_str(),
                        task.thread_id.as_str(),
                        task.turn_id.as_str(),
                        task.workspace_path_for_turn.as_str(),
                        task.local_exec_content.as_str(),
                        task.access_mode.as_str(),
                        task.requested_codex_bin.as_deref(),
                        task.requested_codex_args.as_slice(),
                        task.model_id.as_str(),
                        task.requested_model_id.as_deref(),
                        task.reason_effort.as_deref(),
                        task.service_tier.as_deref(),
                        task.oauth_compat_base_url.as_deref(),
                        task.oauth_api_key.as_deref(),
                        task.extension_api_key.as_deref(),
                        task.oauth_fallback_api_key.as_deref(),
                        task.oauth_local_codex_id_token.as_deref(),
                        task.oauth_local_codex_refresh_token.as_deref(),
                        task.oauth_persist_local_codex_auth_updates,
                        task.oauth_credential_source.as_deref(),
                        task.oauth_auth_mode.as_deref(),
                        task.oauth_external_account_id.as_deref(),
                        true,
                        None,
                        stream_delta_callback.clone(),
                    )
                    .await
                    .map_err(RpcError::internal);
                }
                return query_provider_via_runtime_plan_only(
                    &ctx,
                    &task.routed_provider_route,
                    task.access_mode.as_str(),
                    task.thread_id.as_str(),
                    task.workspace_path_for_turn.as_str(),
                    task.turn_id.as_str(),
                    task.request_id.as_deref(),
                    task.provider_content.as_str(),
                    task.model_id.as_str(),
                    task.reason_effort.as_deref(),
                    task.service_tier.as_deref(),
                    task.oauth_compat_base_url.as_deref(),
                    task.oauth_api_key
                        .as_deref()
                        .or(task.extension_api_key.as_deref()),
                    task.oauth_fallback_api_key.as_deref(),
                    task.oauth_local_codex_id_token.as_deref(),
                    task.oauth_local_codex_refresh_token.as_deref(),
                    task.oauth_persist_local_codex_auth_updates,
                    task.oauth_credential_source.as_deref(),
                    task.oauth_auth_mode.as_deref(),
                    task.oauth_external_account_id.as_deref(),
                )
                .await
                .map(|message| TurnQueryOutcome {
                    message,
                    local_claude_session_id: None,
                    local_claude_recovered_from_stale_resume: false,
                })
                .map_err(RpcError::internal);
            }
            match task.execution_mode {
                TurnExecutionMode::LocalCli => {
                    query_provider_with_local_exec_fallback(
                        &ctx,
                        &task.routed_provider_route,
                        task.workspace_id.as_str(),
                        task.thread_id.as_str(),
                        task.turn_id.as_str(),
                        task.workspace_path_for_turn.as_str(),
                        task.local_exec_content.as_str(),
                        task.access_mode.as_str(),
                        task.requested_codex_bin.as_deref(),
                        task.requested_codex_args.as_slice(),
                        task.model_id.as_str(),
                        task.requested_model_id.as_deref(),
                        task.reason_effort.as_deref(),
                        task.service_tier.as_deref(),
                        task.oauth_compat_base_url.as_deref(),
                        task.oauth_api_key.as_deref(),
                        task.extension_api_key.as_deref(),
                        task.oauth_fallback_api_key.as_deref(),
                        task.oauth_local_codex_id_token.as_deref(),
                        task.oauth_local_codex_refresh_token.as_deref(),
                        task.oauth_persist_local_codex_auth_updates,
                        task.oauth_credential_source.as_deref(),
                        task.oauth_auth_mode.as_deref(),
                        task.oauth_external_account_id.as_deref(),
                        false,
                        None,
                        stream_delta_callback.clone(),
                    )
                    .await
                }
                TurnExecutionMode::Runtime => {
                    if task.routed_provider_route.is_core_claude_code_local() {
                        query_provider_with_local_exec_fallback(
                            &ctx,
                            &task.routed_provider_route,
                            task.workspace_id.as_str(),
                            task.thread_id.as_str(),
                            task.turn_id.as_str(),
                            task.workspace_path_for_turn.as_str(),
                            task.local_exec_content.as_str(),
                            task.access_mode.as_str(),
                            task.requested_codex_bin.as_deref(),
                            task.requested_codex_args.as_slice(),
                            task.model_id.as_str(),
                            task.requested_model_id.as_deref(),
                            task.reason_effort.as_deref(),
                            task.service_tier.as_deref(),
                            task.oauth_compat_base_url.as_deref(),
                            task.oauth_api_key.as_deref(),
                            task.extension_api_key.as_deref(),
                            task.oauth_fallback_api_key.as_deref(),
                            task.oauth_local_codex_id_token.as_deref(),
                            task.oauth_local_codex_refresh_token.as_deref(),
                            task.oauth_persist_local_codex_auth_updates,
                            task.oauth_credential_source.as_deref(),
                            task.oauth_auth_mode.as_deref(),
                            task.oauth_external_account_id.as_deref(),
                            false,
                            None,
                            stream_delta_callback.clone(),
                        )
                        .await
                    } else if use_runtime_plan_flow {
                        query_provider_via_runtime_plan(
                            &ctx,
                            &task.routed_provider_route,
                            task.collaboration_mode.suppress_runtime_plan_delta(),
                            task.access_mode.as_str(),
                            task.workspace_id.as_str(),
                            task.thread_id.as_str(),
                            task.workspace_path_for_turn.as_str(),
                            task.turn_id.as_str(),
                            task.request_id.as_deref(),
                            task.provider_content.as_str(),
                            task.model_id.as_str(),
                            task.reason_effort.as_deref(),
                            task.service_tier.as_deref(),
                            task.oauth_compat_base_url.as_deref(),
                            task.oauth_api_key
                                .as_deref()
                                .or(task.extension_api_key.as_deref()),
                            task.oauth_fallback_api_key.as_deref(),
                            task.oauth_local_codex_id_token.as_deref(),
                            task.oauth_local_codex_refresh_token.as_deref(),
                            task.oauth_persist_local_codex_auth_updates,
                            task.oauth_credential_source.as_deref(),
                            task.oauth_auth_mode.as_deref(),
                            task.oauth_external_account_id.as_deref(),
                        )
                        .await
                        .map(|message| TurnQueryOutcome {
                            message,
                            local_claude_session_id: None,
                            local_claude_recovered_from_stale_resume: false,
                        })
                    } else {
                        query_provider_with_delta(
                            &ctx.client,
                            &ctx.config,
                            &task.routed_provider_route,
                            task.oauth_compat_base_url.as_deref(),
                            task.oauth_api_key
                                .as_deref()
                                .or(task.extension_api_key.as_deref()),
                            task.oauth_fallback_api_key.as_deref(),
                            task.oauth_local_codex_id_token.as_deref(),
                            task.oauth_local_codex_refresh_token.as_deref(),
                            task.oauth_persist_local_codex_auth_updates,
                            task.oauth_credential_source.as_deref(),
                            task.oauth_auth_mode.as_deref(),
                            task.oauth_external_account_id.as_deref(),
                            task.provider_content.as_str(),
                            task.model_id.as_str(),
                            task.reason_effort.as_deref(),
                            task.service_tier.as_deref(),
                            stream_delta_callback.clone(),
                        )
                        .await
                        .map(|message| TurnQueryOutcome {
                            message,
                            local_claude_session_id: None,
                            local_claude_recovered_from_stale_resume: false,
                        })
                    }
                }
                TurnExecutionMode::Hybrid => {
                    if task.routed_provider_route.is_core_claude_code_local() {
                        query_provider_with_local_exec_fallback(
                            &ctx,
                            &task.routed_provider_route,
                            task.workspace_id.as_str(),
                            task.thread_id.as_str(),
                            task.turn_id.as_str(),
                            task.workspace_path_for_turn.as_str(),
                            task.local_exec_content.as_str(),
                            task.access_mode.as_str(),
                            task.requested_codex_bin.as_deref(),
                            task.requested_codex_args.as_slice(),
                            task.model_id.as_str(),
                            task.requested_model_id.as_deref(),
                            task.reason_effort.as_deref(),
                            task.service_tier.as_deref(),
                            task.oauth_compat_base_url.as_deref(),
                            task.oauth_api_key.as_deref(),
                            task.extension_api_key.as_deref(),
                            task.oauth_fallback_api_key.as_deref(),
                            task.oauth_local_codex_id_token.as_deref(),
                            task.oauth_local_codex_refresh_token.as_deref(),
                            task.oauth_persist_local_codex_auth_updates,
                            task.oauth_credential_source.as_deref(),
                            task.oauth_auth_mode.as_deref(),
                            task.oauth_external_account_id.as_deref(),
                            false,
                            None,
                            stream_delta_callback.clone(),
                        )
                        .await
                    } else if use_runtime_plan_flow {
                        match query_provider_via_runtime_plan(
                            &ctx,
                            &task.routed_provider_route,
                            task.collaboration_mode.suppress_runtime_plan_delta(),
                            task.access_mode.as_str(),
                            task.workspace_id.as_str(),
                            task.thread_id.as_str(),
                            task.workspace_path_for_turn.as_str(),
                            task.turn_id.as_str(),
                            task.request_id.as_deref(),
                            task.provider_content.as_str(),
                            task.model_id.as_str(),
                            task.reason_effort.as_deref(),
                            task.service_tier.as_deref(),
                            task.oauth_compat_base_url.as_deref(),
                            task.oauth_api_key
                                .as_deref()
                                .or(task.extension_api_key.as_deref()),
                            task.oauth_fallback_api_key.as_deref(),
                            task.oauth_local_codex_id_token.as_deref(),
                            task.oauth_local_codex_refresh_token.as_deref(),
                            task.oauth_persist_local_codex_auth_updates,
                            task.oauth_credential_source.as_deref(),
                            task.oauth_auth_mode.as_deref(),
                            task.oauth_external_account_id.as_deref(),
                        )
                        .await
                        {
                            Ok(message) => Ok(TurnQueryOutcome {
                                message,
                                local_claude_session_id: None,
                                local_claude_recovered_from_stale_resume: false,
                            }),
                            Err(runtime_plan_error) => {
                                warn!(
                                    workspace_id = task.workspace_id.as_str(),
                                    thread_id = task.thread_id.as_str(),
                                    turn_id = task.turn_id.as_str(),
                                    error = runtime_plan_error.as_str(),
                                    "runtime plan failed in hybrid mode; falling back to local execution chain"
                                );
                                query_provider_with_local_exec_fallback(
                                    &ctx,
                                    &task.routed_provider_route,
                                    task.workspace_id.as_str(),
                                    task.thread_id.as_str(),
                                    task.turn_id.as_str(),
                                    task.workspace_path_for_turn.as_str(),
                                    task.local_exec_content.as_str(),
                                    task.access_mode.as_str(),
                                    task.requested_codex_bin.as_deref(),
                                    task.requested_codex_args.as_slice(),
                                    task.model_id.as_str(),
                                    task.requested_model_id.as_deref(),
                                    task.reason_effort.as_deref(),
                                    task.service_tier.as_deref(),
                                    task.oauth_compat_base_url.as_deref(),
                                    task.oauth_api_key.as_deref(),
                                    task.extension_api_key.as_deref(),
                                    task.oauth_fallback_api_key.as_deref(),
                                    task.oauth_local_codex_id_token.as_deref(),
                                    task.oauth_local_codex_refresh_token.as_deref(),
                                    task.oauth_persist_local_codex_auth_updates,
                                    task.oauth_credential_source.as_deref(),
                                    task.oauth_auth_mode.as_deref(),
                                    task.oauth_external_account_id.as_deref(),
                                    false,
                                    Some(runtime_plan_error.as_str()),
                                    stream_delta_callback.clone(),
                                )
                                .await
                            }
                        }
                    } else {
                        query_provider_with_local_exec_fallback(
                            &ctx,
                            &task.routed_provider_route,
                            task.workspace_id.as_str(),
                            task.thread_id.as_str(),
                            task.turn_id.as_str(),
                            task.workspace_path_for_turn.as_str(),
                            task.local_exec_content.as_str(),
                            task.access_mode.as_str(),
                            task.requested_codex_bin.as_deref(),
                            task.requested_codex_args.as_slice(),
                            task.model_id.as_str(),
                            task.requested_model_id.as_deref(),
                            task.reason_effort.as_deref(),
                            task.service_tier.as_deref(),
                            task.oauth_compat_base_url.as_deref(),
                            task.oauth_api_key.as_deref(),
                            task.extension_api_key.as_deref(),
                            task.oauth_fallback_api_key.as_deref(),
                            task.oauth_local_codex_id_token.as_deref(),
                            task.oauth_local_codex_refresh_token.as_deref(),
                            task.oauth_persist_local_codex_auth_updates,
                            task.oauth_credential_source.as_deref(),
                            task.oauth_auth_mode.as_deref(),
                            task.oauth_external_account_id.as_deref(),
                            false,
                            None,
                            stream_delta_callback.clone(),
                        )
                        .await
                    }
                }
            }
            .map_err(RpcError::internal)
        } => result
    };
    clear_turn_interrupt_waiter(&ctx, task.turn_id.as_str()).await;
    let completion_response_model_id = completion
        .as_ref()
        .ok()
        .and_then(|outcome| outcome.message.response_model_id.clone());

    {
        let mut state = ctx.state.write().await;
        if let Some(threads) = state.workspace_threads.get_mut(task.workspace_id.as_str()) {
            if let Some(existing) = threads.iter_mut().find(|entry| entry.id == task.thread_id) {
                let updated_at = now_ms();
                existing.running = false;
                existing.updated_at = updated_at;
                existing.provider = task.routed_provider_route.routed_provider().to_string();
                existing.model_id = completion_response_model_id
                    .clone()
                    .or_else(|| task.display_model_id.clone());
                existing.status = Some("idle".to_string());
                existing.last_activity_at = Some(updated_at);
            }
        }
    }
    publish_thread_live_update_events(
        &ctx,
        task.workspace_id.as_str(),
        task.thread_id.as_str(),
        Some("code_turn_send"),
    )
    .await;
    match completion {
        Ok(outcome) => {
            let provider_result = if use_runtime_plan_flow {
                outcome.message.clone()
            } else {
                maybe_recover_provider_local_access_refusal(
                    &ctx,
                    outcome.message,
                    task.collaboration_mode.suppress_runtime_plan_delta(),
                    task.access_mode.as_str(),
                    local_exec_preferred,
                    &task.routed_provider_route,
                    task.workspace_id.as_str(),
                    task.thread_id.as_str(),
                    task.workspace_path_for_turn.as_str(),
                    task.turn_id.as_str(),
                    task.request_id.as_deref(),
                    task.provider_content.as_str(),
                    task.model_id.as_str(),
                    task.reason_effort.as_deref(),
                    task.service_tier.as_deref(),
                    task.oauth_compat_base_url.as_deref(),
                    task.oauth_api_key
                        .as_deref()
                        .or(task.extension_api_key.as_deref()),
                    task.oauth_fallback_api_key.as_deref(),
                    task.oauth_local_codex_id_token.as_deref(),
                    task.oauth_local_codex_refresh_token.as_deref(),
                    task.oauth_persist_local_codex_auth_updates,
                    task.oauth_credential_source.as_deref(),
                    task.oauth_auth_mode.as_deref(),
                    task.oauth_external_account_id.as_deref(),
                )
                .await
            };
            let response_model_id = provider_result.response_model_id.clone();
            let completion_message = provider_result.output;
            maybe_report_oauth_account_outcome(
                &ctx,
                task.oauth_account_id.as_deref(),
                task.model_id.as_str(),
                None,
            );
            if let Some(session_id) = outcome
                .local_claude_session_id
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
            {
                if outcome.local_claude_recovered_from_stale_resume {
                    let _ = clear_local_claude_thread_session(
                        &ctx,
                        task.workspace_id.as_str(),
                        task.thread_id.as_str(),
                    )
                    .await;
                }
                if let Err(error) = persist_local_claude_thread_session(
                    &ctx,
                    task.workspace_id.as_str(),
                    task.thread_id.as_str(),
                    session_id,
                )
                .await
                {
                    warn!(
                        workspace_id = task.workspace_id.as_str(),
                        thread_id = task.thread_id.as_str(),
                        error = error.as_str(),
                        "failed to persist local Claude thread session"
                    );
                }
            } else if outcome.local_claude_recovered_from_stale_resume {
                let _ = clear_local_claude_thread_session(
                    &ctx,
                    task.workspace_id.as_str(),
                    task.thread_id.as_str(),
                )
                .await;
            }
            if let Some(turn_delta_pipeline) = turn_delta_pipeline.as_ref() {
                turn_delta_pipeline.flush_final().await;
            }
            let streamed_delta_emitted = turn_delta_pipeline
                .as_ref()
                .map(|turn_delta_pipeline| turn_delta_pipeline.streamed_delta_emitted())
                .unwrap_or(false);
            if !streamed_delta_emitted && !completion_message.trim().is_empty() {
                publish_turn_event(
                    &ctx,
                    TURN_EVENT_DELTA,
                    json!({
                        "turnId": task.turn_id,
                        "delta": completion_message.as_str(),
                    }),
                    task.request_id.as_deref(),
                );
            }
            publish_turn_event(
                &ctx,
                TURN_EVENT_COMPLETED,
                json!({
                    "turnId": task.turn_id,
                    "output": completion_message.as_str(),
                    "responseModelId": response_model_id,
                    "accessMode": task.access_mode,
                    "routedProvider": task.routed_provider_route.routed_provider(),
                    "routedModelId": task.display_model_id,
                    "routedPool": task.routed_provider_route.routed_pool(),
                    "executionMode": task.execution_mode.as_str(),
                    "recoveredFromStaleResume": outcome.local_claude_recovered_from_stale_resume,
                }),
                task.request_id.as_deref(),
            );
        }
        Err(error) => {
            let failure_message = error.message;
            let failure_code = resolve_turn_failure_code(failure_message.as_str());
            if let Some(turn_delta_pipeline) = turn_delta_pipeline.as_ref() {
                turn_delta_pipeline.flush_final().await;
            }
            if task.routed_provider_route.is_core_claude_code_local() {
                let _ = clear_local_claude_thread_session(
                    &ctx,
                    task.workspace_id.as_str(),
                    task.thread_id.as_str(),
                )
                .await;
            }
            if failure_message.contains("STREAM_SSE_FRAME_LIMIT")
                || failure_message.contains("STREAM_DELTA_OVERFLOW")
            {
                crate::runtime_tool_safety_counters::record_runtime_tool_safety_counter_best_effort(
                    &ctx,
                    runtime_tool_metrics::RuntimeToolSafetyCounter::StreamGuardrailTripped,
                    "increment stream-guardrail-tripped runtime tool metric failed",
                );
            }
            maybe_report_oauth_account_outcome(
                &ctx,
                task.oauth_account_id.as_deref(),
                task.model_id.as_str(),
                Some(failure_message.as_str()),
            );
            publish_turn_event(
                &ctx,
                TURN_EVENT_FAILED,
                json!({
                    "turnId": task.turn_id,
                    "error": {
                        "code": failure_code,
                        "message": failure_message.as_str(),
                    },
                    "accessMode": task.access_mode,
                    "routedProvider": task.routed_provider_route.routed_provider(),
                    "executionMode": task.execution_mode.as_str(),
                }),
                task.request_id.as_deref(),
            );
        }
    }
}

pub(super) async fn handle_turn_send(ctx: &AppContext, params: &Value) -> Result<Value, RpcError> {
    let request = parse_turn_send_request(params)?;
    let payload = request.payload;

    let workspace_id = payload.workspace_id.as_str();
    let content = payload.content.as_str();
    let context_prefix = payload.context_prefix.clone();
    let (provider_content, local_exec_content) =
        build_turn_contents(content, context_prefix.as_deref());
    let provider_hint = payload.provider.clone();
    let provider_hint_core = provider_hint
        .as_deref()
        .and_then(|provider| parse_runtime_provider(Some(provider)));
    #[rustfmt::skip]
    let provider_hint_known_extension = match provider_hint.as_deref() { Some(provider) => resolve_known_provider_extension_by_alias(ctx, provider).await, None => None };
    #[rustfmt::skip]
    let provider_hint_extension = match provider_hint.as_deref() { Some(provider) => resolve_active_provider_extension_by_alias(ctx, provider).await, None => None };
    let requested_model_id = payload.model_id.clone();
    #[rustfmt::skip]
    let model_hint_known_extension = match requested_model_id.as_deref() { Some(model_id) => resolve_known_provider_extension_by_model_id(ctx, model_id).await, None => None };
    #[rustfmt::skip]
    let model_hint_extension = match requested_model_id.as_deref() { Some(model_id) => resolve_active_provider_extension_by_model_id(ctx, model_id).await, None => None };
    if let Some(provider_value) = provider_hint.as_deref() {
        if provider_hint_core.is_none() && provider_hint_known_extension.is_none() {
            let active_extensions = active_provider_extensions(ctx).await;
            let supported = RuntimeProvider::specs()
                .iter()
                .map(|spec| format!("{} ({})", spec.routed_provider, spec.aliases.join("/")))
                .chain(active_extensions.iter().map(|extension| {
                    format!(
                        "{} ({})",
                        extension.provider_id,
                        extension.aliases.join("/")
                    )
                }))
                .collect::<Vec<_>>()
                .join(", ");
            return Err(RpcError::invalid_params(format!(
                "Unsupported turn provider `{provider_value}`. Supported providers: {supported}."
            )));
        }
    }
    if let Some(extension) = provider_hint_known_extension.as_ref() {
        if provider_hint_extension.is_none() {
            return Err(extension_provider_unavailable_error(extension));
        }
    }
    if provider_hint.is_none() {
        if let Some(extension) = model_hint_known_extension.as_ref() {
            if model_hint_extension.is_none() {
                return Err(extension_provider_unavailable_error(extension));
            }
        }
    }
    if let (Some(provider_value), Some(extension_provider)) =
        (provider_hint.as_deref(), model_hint_extension.as_ref())
    {
        if provider_hint_extension.is_none() {
            return Err(RpcError::invalid_params(format!(
                "Turn provider `{provider_value}` does not match extension model `{}` (provider `{}`).",
                requested_model_id.as_deref().unwrap_or_default(),
                extension_provider.provider_id
            )));
        }
    }
    if let (Some(provider_value), Some(model_id_value)) =
        (provider_hint.as_deref(), requested_model_id.as_deref())
    {
        let provider_from_hint = provider_hint_core;
        let provider_from_model = detect_provider_from_model_id(Some(model_id_value));
        if let (Some(hint_provider), Some(model_provider)) =
            (provider_from_hint, provider_from_model)
        {
            let local_claude_match = hint_provider == RuntimeProvider::ClaudeCodeLocal
                && model_provider == RuntimeProvider::Anthropic;
            if hint_provider != model_provider && !local_claude_match {
                return Err(RpcError::invalid_params(format!(
                    "Turn provider `{provider_value}` does not match model `{model_id_value}`."
                )));
            }
        }
    }
    let routed_provider_route = if let Some(extension) = provider_hint_extension {
        TurnProviderRoute::Extension(extension)
    } else if let Some(extension) = model_hint_extension {
        TurnProviderRoute::Extension(extension)
    } else {
        TurnProviderRoute::Core(infer_provider(
            provider_hint.as_deref(),
            requested_model_id
                .as_deref()
                .or(Some(ctx.config.default_model_id.as_str())),
        ))
    };
    let requested_thread_id = payload.thread_id.clone();
    let thread_id = requested_thread_id
        .clone()
        .unwrap_or_else(|| new_id("thread"));
    let oauth_routing = match &routed_provider_route {
        TurnProviderRoute::Core(routed_provider) => {
            if *routed_provider == RuntimeProvider::ClaudeCodeLocal {
                None
            } else {
                refresh_local_codex_cli_account_for_turn(ctx, *routed_provider);
                let model_hint_for_routing = requested_model_id
                    .as_deref()
                    .unwrap_or("<provider-default>");
                resolve_oauth_routing_credentials(
                    ctx,
                    *routed_provider,
                    requested_thread_id.as_deref(),
                    model_hint_for_routing,
                )
            }
        }
        TurnProviderRoute::Extension(_) => None,
    };
    let requested_model_id_for_task = requested_model_id.clone();
    let model_id_raw = if let Some(requested) = requested_model_id {
        requested
    } else if provider_hint.is_some() {
        match &routed_provider_route {
            TurnProviderRoute::Core(routed_provider) => resolve_provider_default_model_id(
                ctx,
                *routed_provider,
                oauth_routing
                    .as_ref()
                    .and_then(|entry| entry.compat_base_url.as_deref()),
                oauth_routing.as_ref().map(|entry| entry.api_key.as_str()),
            )
            .await
            .unwrap_or_else(|| routed_provider.default_model_id().to_string()),
            TurnProviderRoute::Extension(extension) => extension.default_model_id.clone(),
        }
    } else {
        ctx.config.default_model_id.clone()
    };
    let model_id = normalize_model_id(model_id_raw.as_str());
    let display_model_id = if routed_provider_route.is_core_claude_code_local()
        && requested_model_id_for_task.is_none()
    {
        None
    } else {
        Some(model_id.clone())
    };
    let reason_effort = payload.reason_effort.clone();
    let service_tier = payload.service_tier.clone();
    let access_mode = normalize_access_mode(Some(payload.access_mode.as_str()))?;
    let request_id = payload.request_id.clone();
    let collaboration_mode =
        parse_requested_collaboration_mode(payload.collaboration_mode.as_ref());
    let preferred_backend_ids = payload.preferred_backend_ids.clone().unwrap_or_default();
    let requested_codex_bin = payload.codex_bin.clone();
    let requested_codex_args = payload.codex_args.clone().unwrap_or_default();
    let oauth_api_key = oauth_routing
        .as_ref()
        .map(|credentials| credentials.api_key.as_str());
    let oauth_account_id = oauth_routing
        .as_ref()
        .map(|credentials| credentials.account_id.as_str());
    let oauth_fallback_api_key = oauth_routing
        .as_ref()
        .and_then(|credentials| credentials.fallback_api_key.as_deref());
    #[rustfmt::skip]
    let (oauth_local_codex_id_token, oauth_local_codex_refresh_token) = oauth_routing.as_ref().map_or((None, None), |credentials| (credentials.local_codex_id_token.as_deref(), credentials.local_codex_refresh_token.as_deref()));
    #[rustfmt::skip]
    let (oauth_persist_local_codex_auth_updates, oauth_credential_source, oauth_auth_mode, oauth_external_account_id) = oauth_routing.as_ref().map_or((false, None, None, None), |credentials| (credentials.persist_local_codex_auth_updates, credentials.credential_source.as_deref(), credentials.auth_mode.as_deref(), credentials.external_account_id.as_deref()));
    let oauth_compat_base_url = match &routed_provider_route {
        TurnProviderRoute::Core(_) => oauth_routing
            .as_ref()
            .and_then(|credentials| credentials.compat_base_url.as_deref()),
        TurnProviderRoute::Extension(extension) => Some(extension.compat_base_url.as_str()),
    };
    let extension_api_key = match &routed_provider_route {
        TurnProviderRoute::Extension(extension) => extension.api_key.as_deref(),
        TurnProviderRoute::Core(_) => None,
    };
    if matches!(routed_provider_route, TurnProviderRoute::Extension(_))
        && extension_api_key.is_none()
    {
        return Err(RpcError::invalid_params(
            "Selected extension provider is not configured with API key.",
        ));
    }
    let routed_source = if oauth_api_key.is_some() {
        "oauth-account"
    } else if routed_provider_route.is_core_claude_code_local() {
        "workspace-default"
    } else if routed_provider_route.is_core_openai() {
        "local-codex"
    } else if matches!(routed_provider_route, TurnProviderRoute::Extension(_)) {
        "workspace-default"
    } else {
        "fallback"
    };
    let turn_id = new_id("turn");

    let workspace_path_for_turn = {
        let mut state = ctx.state.write().await;
        ensure_workspace(&mut state, workspace_id, &ctx.config.default_model_id);
        let workspace_path = state
            .workspaces
            .iter()
            .find(|workspace| workspace.id == workspace_id)
            .map(|workspace| workspace.path.clone())
            .unwrap_or_else(resolve_default_workspace_path);
        let now = now_ms();
        let threads = state
            .workspace_threads
            .entry(workspace_id.to_string())
            .or_default();
        if let Some(existing) = threads.iter_mut().find(|entry| entry.id == thread_id) {
            existing.running = true;
            existing.updated_at = now;
            existing.provider = routed_provider_route.routed_provider().to_string();
            existing.model_id = display_model_id.clone();
            existing.status = Some("active".to_string());
            existing.last_activity_at = Some(now);
            existing.archived = false;
        } else {
            threads.insert(
                0,
                ThreadSummary {
                    id: thread_id.clone(),
                    workspace_id: workspace_id.to_string(),
                    title: derive_title(content),
                    unread: false,
                    running: true,
                    created_at: now,
                    updated_at: now,
                    provider: routed_provider_route.routed_provider().to_string(),
                    model_id: display_model_id.clone(),
                    status: Some("active".to_string()),
                    archived: false,
                    last_activity_at: Some(now),
                    agent_role: None,
                    agent_nickname: None,
                },
            );
        }
        workspace_path
    };
    publish_thread_live_update_events(
        ctx,
        workspace_id,
        thread_id.as_str(),
        Some("code_turn_send"),
    )
    .await;

    let execution_mode = parse_turn_execution_mode(Some(payload.execution_mode.as_str()))?;
    let acp_backend_id =
        resolve_requested_acp_backend_id(ctx, preferred_backend_ids.as_slice()).await;
    let routed_source_response = if acp_backend_id.is_some() {
        "acp-backend".to_string()
    } else {
        routed_source.to_string()
    };
    let response_backend_id = acp_backend_id.clone();
    let turn_interrupt_waiter = register_turn_interrupt_waiter(ctx, turn_id.as_str()).await;
    publish_turn_event(
        ctx,
        TURN_EVENT_STARTED,
        json!({
            "turnId": turn_id,
        }),
        request_id.as_deref(),
    );
    let _ = ctx.task_supervisor.spawn_abortable(
        RuntimeTaskDomain::Runtime,
        format!("turn.send.{turn_id}"),
        complete_turn_send(
            ctx.clone(),
            TurnSendTaskInput {
                workspace_id: workspace_id.to_string(),
                thread_id: thread_id.clone(),
                turn_id: turn_id.clone(),
                request_id: request_id.clone(),
                provider_content,
                local_exec_content,
                routed_provider_route: routed_provider_route.clone(),
                model_id: model_id.clone(),
                display_model_id: display_model_id.clone(),
                requested_model_id: requested_model_id_for_task,
                reason_effort,
                service_tier,
                access_mode,
                execution_mode,
                workspace_path_for_turn,
                requested_codex_bin,
                requested_codex_args,
                oauth_compat_base_url: oauth_compat_base_url.map(str::to_string),
                oauth_api_key: oauth_api_key.map(str::to_string),
                extension_api_key: extension_api_key.map(str::to_string),
                oauth_fallback_api_key: oauth_fallback_api_key.map(str::to_string),
                oauth_local_codex_id_token: oauth_local_codex_id_token.map(str::to_string),
                oauth_local_codex_refresh_token: oauth_local_codex_refresh_token
                    .map(str::to_string),
                oauth_persist_local_codex_auth_updates,
                oauth_credential_source: oauth_credential_source.map(str::to_string),
                oauth_auth_mode: oauth_auth_mode.map(str::to_string),
                oauth_external_account_id: oauth_external_account_id.map(str::to_string),
                oauth_account_id: oauth_account_id.map(str::to_string),
                collaboration_mode,
                acp_backend_id,
            },
            turn_interrupt_waiter,
        ),
    );

    Ok(json!({
        "accepted": true,
        "turnId": turn_id,
        "threadId": thread_id,
        "routedProvider": routed_provider_route.routed_provider(),
        "routedModelId": display_model_id,
        "routedPool": if routed_provider_route.is_core_claude_code_local() {
            Value::Null
        } else {
            Value::String(routed_provider_route.routed_pool().to_string())
        },
        "routedSource": routed_source_response,
        "backendId": response_backend_id,
        "message": "Turn accepted."
    }))
}

fn maybe_report_oauth_account_outcome(
    ctx: &AppContext,
    account_id: Option<&str>,
    model_id: &str,
    failure_message: Option<&str>,
) {
    let Some(account_id) = account_id.map(str::trim).filter(|entry| !entry.is_empty()) else {
        return;
    };

    let report_input = if let Some(failure_message) = failure_message {
        let error_code = classify_oauth_account_failure_error_code(failure_message);
        let Some(error_code) = error_code else {
            return;
        };
        OAuthRateLimitReportInput {
            account_id: account_id.to_string(),
            model_id: Some(model_id.to_string()),
            success: false,
            retry_after_sec: None,
            reset_at: None,
            error_code: Some(error_code.to_string()),
            error_message: Some(failure_message.to_string()),
        }
    } else {
        OAuthRateLimitReportInput {
            account_id: account_id.to_string(),
            model_id: Some(model_id.to_string()),
            success: true,
            retry_after_sec: None,
            reset_at: None,
            error_code: None,
            error_message: None,
        }
    };

    if let Err(error) = ctx.oauth_pool.report_rate_limit(report_input) {
        warn!(
            account_id,
            model_id,
            error = error.as_str(),
            "failed to update oauth account health report after turn outcome"
        );
    }
}

fn classify_oauth_account_failure_error_code(message: &str) -> Option<&'static str> {
    let normalized = message.trim().to_ascii_lowercase();
    if normalized.is_empty() {
        return None;
    }
    let contains_any = |needles: &[&str]| needles.iter().any(|needle| normalized.contains(*needle));
    if normalized.contains("invalid_grant") {
        return Some("invalid_grant");
    }
    if contains_any(&[
        "policy violation",
        "content policy",
        "safety violation",
        "terms violation",
        "abuse",
        "validation required",
        "verification required",
        "verify your identity",
        "captcha",
        "recaptcha",
        "challenge required",
        "risk control",
        "risk detected",
        "suspicious activity",
        "unusual activity",
        "security check",
        "security verification",
        "风控",
        "风险控制",
        "高风险",
        "需要验证",
        "验证码",
        "可疑活动",
        "异常活动",
        "安全校验",
        "安全验证",
    ]) {
        return Some("policy_violation");
    }
    if contains_any(&[
        "account suspended",
        "account deactivated",
        "organization is deactivated",
        "forbidden",
        "access denied",
        "permission denied",
        "insufficient permissions",
        "http 403",
        "status code 403",
        "403 forbidden",
        "account frozen",
        "account banned",
        "service banned",
        "permanently blocked",
        "封禁",
        "冻结",
        "停用",
        "禁用",
        "已被封",
    ]) {
        return Some("account_suspended");
    }
    if normalized.contains("rate limit")
        || normalized.contains("too many requests")
        || normalized.contains("throttle")
        || normalized.contains("quota")
        || normalized.contains("resource_exhausted")
        || normalized.contains("quota exceeded")
        || normalized.contains("exceeded your current quota")
        || normalized.contains("429")
        || normalized.contains("slow down")
        || normalized.contains("too frequent")
        || normalized.contains("请求频率过高")
        || normalized.contains("配额已用尽")
        || normalized.contains("请求过于频繁")
    {
        return Some("rate_limit_exceeded");
    }
    None
}

#[cfg(test)]
mod tests {
    use super::{build_turn_contents, classify_oauth_account_failure_error_code};

    #[test]
    fn build_turn_contents_keeps_raw_content_without_prefix() {
        let (provider_content, local_exec_content) = build_turn_contents("hello", None);
        assert_eq!(provider_content, "hello");
        assert_eq!(local_exec_content, "hello");
    }

    #[test]
    fn build_turn_contents_prefixes_provider_content_but_keeps_local_exec_raw() {
        let context_prefix = "[ATLAS_CONTEXT v1]\n1. plan: noop\n[/ATLAS_CONTEXT]";
        let (provider_content, local_exec_content) =
            build_turn_contents("show current workspace info", Some(context_prefix));
        assert_eq!(
            provider_content,
            "[ATLAS_CONTEXT v1]\n1. plan: noop\n[/ATLAS_CONTEXT]\n\nshow current workspace info"
        );
        assert_eq!(local_exec_content, "show current workspace info");
    }

    #[test]
    fn classify_oauth_failure_code_detects_resource_exhausted_as_rate_limit() {
        let code = classify_oauth_account_failure_error_code(
            "google returned RESOURCE_EXHAUSTED: quota exceeded for this request",
        );
        assert_eq!(code, Some("rate_limit_exceeded"));
    }

    #[test]
    fn classify_oauth_failure_code_detects_challenge_required_as_policy_violation() {
        let code = classify_oauth_account_failure_error_code(
            "reCAPTCHA challenge required because of suspicious activity",
        );
        assert_eq!(code, Some("policy_violation"));
    }

    #[test]
    fn classify_oauth_failure_code_detects_permission_denied_as_account_suspended() {
        let code = classify_oauth_account_failure_error_code(
            "HTTP 403 Forbidden: permission denied for current account",
        );
        assert_eq!(code, Some("account_suspended"));
    }

    #[test]
    fn classify_oauth_failure_code_prioritizes_policy_over_rate_limit_when_both_present() {
        let code = classify_oauth_account_failure_error_code(
            "429 too many requests after captcha challenge required",
        );
        assert_eq!(code, Some("policy_violation"));
    }
}
