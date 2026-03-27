use super::*;
use crate::workspace_picker::handle_workspace_pick_directory;
#[path = "../../rpc_dispatch_app_settings.rs"]
mod app_settings_dispatch;
#[path = "../../rpc_dispatch_bootstrap_batch.rs"]
mod bootstrap_batch;
#[path = "../../rpc_dispatch_browser_debug.rs"]
mod browser_debug_dispatch;
#[path = "../../rpc_dispatch_codex.rs"]
mod codex_dispatch;
#[path = "../../rpc_dispatch_diagnostics_export.rs"]
mod diagnostics_export_dispatch;
#[path = "../../rpc_dispatch_kernel.rs"]
mod kernel_dispatch;
#[path = "../../rpc_dispatch_mission_control.rs"]
pub(crate) mod mission_control_dispatch;
#[path = "../../rpc_dispatch_oauth_chatgpt_refresh.rs"]
mod oauth_chatgpt_refresh;
#[path = "../../rpc_dispatch_runtime_autonomy_v2.rs"]
mod runtime_autonomy_v2_dispatch;
#[path = "../../rpc_dispatch_runtime_backends.rs"]
mod runtime_backends_dispatch;
#[path = "../../rpc_dispatch_runtime_backends_native_store.rs"]
mod runtime_backends_native_store;
#[path = "../../rpc_dispatch_runtime_kernel_v2.rs"]
mod runtime_kernel_v2_dispatch;
#[path = "../../rpc_dispatch_runtime_kernel_v2_plan.rs"]
mod runtime_kernel_v2_plan;
#[path = "../../rpc_dispatch_runtime_tool_guardrails.rs"]
mod runtime_tool_guardrails_dispatch;
#[path = "../../rpc_dispatch_runtime_tool_metrics.rs"]
mod runtime_tool_metrics_dispatch;
#[path = "../../rpc_dispatch_security_preflight.rs"]
mod security_preflight_dispatch;
#[path = "../../rpc_dispatch_sessions.rs"]
mod sessions_dispatch;
#[path = "../../rpc_dispatch_task_sources.rs"]
mod task_sources_dispatch;
#[path = "../../rpc_dispatch_text_files.rs"]
mod text_files_dispatch;
#[path = "../../rpc_dispatch_thread_live.rs"]
mod thread_live;
#[path = "../../rpc_dispatch_workspace_diagnostics.rs"]
mod workspace_diagnostics_dispatch;
#[path = "../../rpc_dispatch_workspace_git.rs"]
pub(crate) mod workspace_git_dispatch;
#[path = "../../rpc_dispatch_workspace_patch.rs"]
mod workspace_patch_dispatch;
mod workspace_prompt;
use crate::acp_client_adapter::{
    handle_acp_integration_probe, handle_acp_integration_remove, handle_acp_integration_set_state,
    handle_acp_integration_upsert, handle_acp_integrations_list,
};
use crate::codex_oauth_handlers::{
    cancel_codex_oauth, start_codex_oauth, CodexOauthCancelInput, CodexOauthStartInput,
};
use crate::terminal_runtime::{
    handle_terminal_close, handle_terminal_input_raw, handle_terminal_interrupt,
    handle_terminal_open, handle_terminal_read, handle_terminal_resize, handle_terminal_write,
};
use app_settings_dispatch::{handle_app_settings_get, handle_app_settings_update};
use bootstrap_batch::{
    handle_bootstrap_snapshot, handle_rpc_batch, health_response_payload, remote_status_payload,
    settings_summary_payload, terminal_status_payload,
};
use browser_debug_dispatch::{handle_browser_debug_run_v1, handle_browser_debug_status_v1};
use codex_dispatch::handle_codex_rpc_method;
pub(crate) use crate::rpc_dispatch_extensions as extensions_dispatch;
use diagnostics_export_dispatch::handle_runtime_diagnostics_export_v1;
use extensions_dispatch::{
    handle_extension_catalog_list_v2, handle_extension_get_v2, handle_extension_health_read_v2,
    handle_extension_install_v2,
    handle_extension_permissions_evaluate_v2, handle_extension_registry_search_v2,
    handle_extension_registry_sources_v2, handle_extension_remove_v2,
    handle_extension_resource_read_v2, handle_extension_set_state_v2,
    handle_extension_tools_list_v2, handle_extension_update_v2,
};
use kernel_dispatch::{
    handle_kernel_capabilities_list_v2, handle_kernel_context_snapshot_v2,
    handle_kernel_extensions_list_v2, handle_kernel_job_callback_register_v3,
    handle_kernel_job_callback_remove_v3, handle_kernel_job_get_v3,
    handle_kernel_job_subscribe_v3, handle_kernel_jobs_list_v2,
    handle_kernel_policies_evaluate_v2, handle_kernel_projection_bootstrap_v3,
    handle_kernel_sessions_list_v2, read_kernel_job_payload_by_id,
};
pub(crate) use kernel_dispatch::build_kernel_projection_delta_v3;
use mission_control_dispatch::{
    handle_mission_control_snapshot_v1, handle_mission_control_summary_v1,
};
use oauth_chatgpt_refresh::handle_oauth_chatgpt_auth_tokens_refresh;
use runtime_autonomy_v2_dispatch::{
    handle_action_required_get_v2, handle_action_required_submit_v2, handle_runtime_policy_get_v2,
    handle_runtime_policy_set_v2, handle_runtime_tool_outcome_record_v2,
    handle_runtime_tool_preflight_v2,
};
pub(crate) use runtime_backends_dispatch::{
    assess_runtime_backend_operability, build_runtime_backend_operability_value,
    RuntimeBackendOperabilityAssessment,
};
use runtime_backends_dispatch::{
    handle_distributed_task_graph, handle_runtime_backend_remove, handle_runtime_backend_set_state,
    handle_runtime_backend_upsert, handle_runtime_backends_list,
};
pub(crate) use runtime_kernel_v2_dispatch::{
    handle_runtime_review_get_v2, handle_runtime_run_get_v2, handle_runtime_run_intervene_v2,
    handle_runtime_run_prepare_v2, handle_runtime_run_resume_v2,
    handle_runtime_run_start_v2, handle_runtime_run_subscribe_v2,
};
pub(crate) use runtime_backends_native_store::{
    hydrate_runtime_backends_from_native_store, persist_runtime_backends_to_native_store,
};
use runtime_tool_guardrails_dispatch::{
    handle_runtime_tool_guardrail_evaluate, handle_runtime_tool_guardrail_read,
    handle_runtime_tool_guardrail_record_outcome,
};
use runtime_tool_metrics_dispatch::{
    handle_runtime_tool_metrics_read, handle_runtime_tool_metrics_record,
    handle_runtime_tool_metrics_reset,
};
use security_preflight_dispatch::handle_security_preflight_v1;
use sessions_dispatch::{
    handle_session_delete_v1, handle_session_export_v1, handle_session_import_v1,
    handle_thread_snapshots_get_v1, handle_thread_snapshots_set_v1,
};
use task_sources_dispatch::{
    handle_task_source_get_v1, handle_task_source_ingest_v1, handle_task_source_list_v1,
    handle_task_source_reconcile_v1,
};
use text_files_dispatch::{handle_text_file_read_v1, handle_text_file_write_v1};
use thread_live::{
    detach_thread_live_subscriptions_for_workspace, handle_thread_archive, handle_thread_create,
    handle_thread_live_subscribe, handle_thread_live_unsubscribe, handle_thread_resume,
    handle_threads_list,
};
use workspace_diagnostics_dispatch::handle_workspace_diagnostics_list_v1;
use workspace_git_dispatch::{
    handle_git_branch_checkout, handle_git_branch_create, handle_git_branches_list,
    handle_git_changes_list, handle_git_commit, handle_git_diff_read, handle_git_log,
    handle_git_revert_change, handle_git_stage_all, handle_git_stage_change,
    handle_git_unstage_change, handle_workspace_file_read, handle_workspace_files_list,
};
use workspace_patch_dispatch::handle_workspace_patch_apply_v1;
use workspace_prompt::handle_workspace_prompt_rpc;
#[rustfmt::skip]
const CODEX_DISPATCH_METHOD_MARKERS: &[&str] = &["code_codex_exec_run_v1","code_codex_cloud_tasks_list_v1","code_codex_config_path_get_v1","code_codex_doctor_v1","code_codex_update_v1","code_collaboration_modes_list_v1","code_mcp_server_status_list_v1"];

pub(crate) async fn handle_rpc(
    ctx: &AppContext,
    method: &str,
    params: &Value,
) -> Result<Value, RpcError> {
    if CODEX_DISPATCH_METHOD_MARKERS.contains(&method) {
        return handle_codex_rpc_method(method, ctx, params).await;
    }
    match method {
        "code_rpc_capabilities" => Ok(rpc_capabilities_payload()),
        "code_health" => Ok(health_response_payload()),
        "code_settings_summary" => Ok(settings_summary_payload()),
        "code_app_settings_get" => handle_app_settings_get(ctx).await,
        "code_app_settings_update" => handle_app_settings_update(ctx, params).await,
        "code_text_file_read_v1" => handle_text_file_read_v1(ctx, params).await,
        "code_text_file_write_v1" => handle_text_file_write_v1(ctx, params).await,
        "code_remote_status" => Ok(remote_status_payload()),
        "code_terminal_status" => Ok(terminal_status_payload(ctx).await),
        "code_models_pool" => Ok(json!(build_models_pool(ctx).await)),
        "code_providers_catalog" => Ok(json!(build_providers_catalog(ctx).await)),
        "code_mission_control_snapshot_v1" => handle_mission_control_snapshot_v1(ctx, params).await,
        "code_mission_control_summary_v1" => handle_mission_control_summary_v1(ctx, params).await,
        "code_bootstrap_snapshot" => handle_bootstrap_snapshot(ctx).await,
        "code_rpc_batch" => handle_rpc_batch(ctx, params).await,
        _ => {
            if let Some(result) = handle_workspace_prompt_rpc(ctx, method, params).await? {
                return Ok(result);
            }
            match method {
        "code_threads_list" => handle_threads_list(ctx, params).await,
        "code_thread_create" => handle_thread_create(ctx, params).await,
        "code_thread_resume" => handle_thread_resume(ctx, params).await,
        "code_thread_archive" => handle_thread_archive(ctx, params).await,
        "code_thread_live_subscribe" => handle_thread_live_subscribe(ctx, params).await,
        "code_thread_live_unsubscribe" => handle_thread_live_unsubscribe(ctx, params).await,
        "code_turn_send" => handle_turn_send(ctx, params).await,
        "code_turn_interrupt" => handle_turn_interrupt(ctx, params).await,
        "code_task_source_ingest_v1" => handle_task_source_ingest_v1(ctx, params).await,
        "code_task_source_get_v1" => handle_task_source_get_v1(ctx, params).await,
        "code_task_source_list_v1" => handle_task_source_list_v1(ctx, params).await,
        "code_task_source_reconcile_v1" => handle_task_source_reconcile_v1(ctx, params).await,
        "code_runtime_run_prepare_v2" => handle_runtime_run_prepare_v2(ctx, params).await,
        "code_runtime_run_start_v2" => handle_runtime_run_start_v2(ctx, params).await,
        // Legacy runtime-run compatibility surface.
        "code_runtime_run_start" => handle_agent_task_start(ctx, params).await,
        "code_runtime_run_cancel" => handle_agent_task_interrupt(ctx, params).await,
        "code_runtime_run_resume" => handle_agent_task_resume(ctx, params).await,
        "code_runtime_run_resume_v2" => handle_runtime_run_resume_v2(ctx, params).await,
        "code_runtime_run_intervene" => handle_agent_task_intervene(ctx, params).await,
        "code_runtime_run_intervene_v2" => handle_runtime_run_intervene_v2(ctx, params).await,
        "code_runtime_run_subscribe" => handle_agent_task_status(ctx, params).await,
        "code_runtime_run_get_v2" => handle_runtime_run_get_v2(ctx, params).await,
        "code_runtime_run_subscribe_v2" => handle_runtime_run_subscribe_v2(ctx, params).await,
        "code_runtime_review_get_v2" => handle_runtime_review_get_v2(ctx, params).await,
        "code_runtime_runs_list" => handle_agent_tasks_list(ctx, params).await,
        // Kernel-job compatibility surface.
        "code_kernel_job_start_v3" => {
            let response = handle_agent_task_start(ctx, params).await?;
            let job_id = response
                .get("taskId")
                .or_else(|| response.get("runId"))
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .ok_or_else(|| RpcError::internal("kernel job start missing taskId"))?;
            Ok(read_kernel_job_payload_by_id(ctx, job_id)
                .await
                .unwrap_or(response))
        }
        "code_kernel_job_get_v3" => handle_kernel_job_get_v3(ctx, params).await,
        "code_kernel_job_cancel_v3" => handle_agent_task_interrupt(ctx, params).await,
        "code_kernel_job_resume_v3" => handle_agent_task_resume(ctx, params).await,
        "code_kernel_job_intervene_v3" => handle_agent_task_intervene(ctx, params).await,
        "code_kernel_job_subscribe_v3" => handle_kernel_job_subscribe_v3(ctx, params).await,
        "code_kernel_job_callback_register_v3" => {
            handle_kernel_job_callback_register_v3(ctx, params).await
        }
        "code_kernel_job_callback_remove_v3" => {
            handle_kernel_job_callback_remove_v3(ctx, params).await
        }
        "code_sub_agent_spawn" => handle_sub_agent_spawn(ctx, params).await,
        "code_sub_agent_send" => handle_sub_agent_send(ctx, params).await,
        "code_sub_agent_wait" => handle_sub_agent_wait(ctx, params).await,
        "code_sub_agent_status" => handle_sub_agent_status(ctx, params).await,
        "code_sub_agent_interrupt" => handle_sub_agent_interrupt(ctx, params).await,
        "code_sub_agent_close" => handle_sub_agent_close(ctx, params).await,
        "code_runtime_run_checkpoint_approval" => handle_agent_approval_decision(ctx, params).await,
        "code_runtime_tool_preflight_v2" => handle_runtime_tool_preflight_v2(ctx, params).await,
        "code_action_required_submit_v2" => handle_action_required_submit_v2(ctx, params).await,
        "code_action_required_get_v2" => handle_action_required_get_v2(ctx, params).await,
        "code_runtime_tool_outcome_record_v2" => {
            handle_runtime_tool_outcome_record_v2(ctx, params).await
        }
        "code_runtime_policy_get_v2" => handle_runtime_policy_get_v2(ctx).await,
        "code_runtime_policy_set_v2" => handle_runtime_policy_set_v2(ctx, params).await,
        "code_kernel_capabilities_list_v2" => handle_kernel_capabilities_list_v2(ctx).await,
        "code_kernel_sessions_list_v2" => handle_kernel_sessions_list_v2(ctx, params).await,
        "code_kernel_jobs_list_v2" => handle_kernel_jobs_list_v2(ctx, params).await,
        "code_kernel_context_snapshot_v2" => handle_kernel_context_snapshot_v2(ctx, params).await,
        "code_kernel_extensions_list_v2" => handle_kernel_extensions_list_v2(ctx, params).await,
        "code_kernel_policies_evaluate_v2" => {
            handle_kernel_policies_evaluate_v2(ctx, params).await
        }
        "code_kernel_projection_bootstrap_v3" => {
            handle_kernel_projection_bootstrap_v3(ctx, params).await
        }
        "code_runtime_backends_list" => handle_runtime_backends_list(ctx).await,
        "code_runtime_backend_upsert" => handle_runtime_backend_upsert(ctx, params).await,
        "code_runtime_backend_remove" => handle_runtime_backend_remove(ctx, params).await,
        "code_runtime_backend_set_state" => handle_runtime_backend_set_state(ctx, params).await,
        "code_acp_integrations_list" => handle_acp_integrations_list(ctx).await,
        "code_acp_integration_upsert" => handle_acp_integration_upsert(ctx, params).await,
        "code_acp_integration_remove" => handle_acp_integration_remove(ctx, params).await,
        "code_acp_integration_set_state" => handle_acp_integration_set_state(ctx, params).await,
        "code_acp_integration_probe" => handle_acp_integration_probe(ctx, params).await,
        "code_distributed_task_graph" => handle_distributed_task_graph(ctx, params).await,
        "code_runtime_tool_metrics_record" => handle_runtime_tool_metrics_record(ctx, params).await,
        "code_runtime_tool_metrics_read" => handle_runtime_tool_metrics_read(ctx, params).await,
        "code_runtime_tool_metrics_reset" => handle_runtime_tool_metrics_reset(ctx).await,
        "code_runtime_tool_guardrail_evaluate" => {
            handle_runtime_tool_guardrail_evaluate(ctx, params).await
        }
        "code_runtime_tool_guardrail_record_outcome" => {
            handle_runtime_tool_guardrail_record_outcome(ctx, params).await
        }
        "code_runtime_tool_guardrail_read" => handle_runtime_tool_guardrail_read(ctx).await,
        "code_terminal_open" => {
            let params = as_object(params)?;
            let workspace_id = read_optional_string(params, "workspaceId")
                .unwrap_or_else(|| "workspace-web".to_string());
            handle_terminal_open(ctx, &workspace_id).await
        }
        "code_terminal_write" => {
            let params = as_object(params)?;
            let session_id =
                read_optional_string(params, "sessionId").unwrap_or_else(|| new_id("terminal"));
            let input = read_optional_string(params, "input").unwrap_or_default();
            handle_terminal_write(ctx, &session_id, &input).await
        }
        "code_terminal_read" => {
            let params = as_object(params)?;
            let session_id =
                read_optional_string(params, "sessionId").unwrap_or_else(|| new_id("terminal"));
            handle_terminal_read(ctx, &session_id).await
        }
        "code_terminal_input_raw" => {
            let params = as_object(params)?;
            let session_id =
                read_optional_string(params, "sessionId").unwrap_or_else(|| new_id("terminal"));
            let input = read_optional_string(params, "input").unwrap_or_default();
            handle_terminal_input_raw(ctx, &session_id, &input).await
        }
        "code_terminal_stream_start" | "code_terminal_stream_stop" => Ok(json!(true)),
        "code_terminal_interrupt" => {
            let params = as_object(params)?;
            let session_id =
                read_optional_string(params, "sessionId").unwrap_or_else(|| new_id("terminal"));
            handle_terminal_interrupt(ctx, &session_id).await
        }
        "code_terminal_resize" => {
            let params = as_object(params)?;
            let session_id =
                read_optional_string(params, "sessionId").unwrap_or_else(|| new_id("terminal"));
            let rows = read_optional_u64(params, "rows")
                .and_then(|value| u16::try_from(value).ok())
                .unwrap_or(0);
            let cols = read_optional_u64(params, "cols")
                .and_then(|value| u16::try_from(value).ok())
                .unwrap_or(0);
            handle_terminal_resize(ctx, &session_id, rows, cols).await
        }
        "code_terminal_close" => {
            let params = as_object(params)?;
            let session_id =
                read_optional_string(params, "sessionId").unwrap_or_else(|| new_id("terminal"));
            handle_terminal_close(ctx, &session_id).await
        }
        "code_cli_sessions_list" => {
            let sessions =
                tokio::task::spawn_blocking(|| list_local_cli_sessions(MAX_LOCAL_CLI_SESSIONS))
                    .await
                    .map_err(|error| {
                        RpcError::internal(format!(
                            "failed to join cli sessions listing task: {error}"
                        ))
                    })?;
            Ok(json!(sessions))
        }
        "code_oauth_accounts_list" => {
            let params = as_object(params)?;
            let provider = parse_optional_oauth_provider(params, "provider")?;
            let usage_refresh_mode = match read_optional_string(params, "usageRefresh")
                .as_deref()
                .map(str::to_ascii_lowercase)
            {
                Some(mode) if mode == "auto" => ServiceCodexUsageRefreshMode::Auto,
                Some(mode) if mode == "force" => ServiceCodexUsageRefreshMode::Force,
                Some(mode) if mode == "off" => ServiceCodexUsageRefreshMode::Off,
                Some(mode) => {
                    return Err(RpcError::invalid_params(format!(
                        "Unsupported usageRefresh mode: {mode}. Expected auto, force, or off."
                    )));
                }
                None => ServiceCodexUsageRefreshMode::Auto,
            };
            if provider.is_none() || provider.as_deref() == Some("codex") {
                if should_attempt_local_codex_sync(
                    now_ms(),
                    ctx.local_codex_sync_last_attempt_ms.as_ref(),
                    LOCAL_CODEX_CLI_SYNC_MIN_INTERVAL_MS,
                ) {
                    if let Err(error) = sync_local_codex_cli_account(ctx.oauth_pool.as_ref()) {
                        ctx.runtime_diagnostics.record_local_codex_sync_failure();
                        warn!(
                            error = error.as_str(),
                            provider_filter = provider.as_deref().unwrap_or("*"),
                            "failed to refresh local codex cli auth account during oauth account list"
                        );
                    }
                }
            }
            let mut accounts = ctx
                .oauth_pool
                .list_accounts(provider.as_deref())
                .map_err(RpcError::internal)?;
            if provider.is_none() || provider.as_deref() == Some("codex") {
                let mut refreshed_profile_any = false;
                for account in accounts
                    .iter()
                    .filter(|account| account.provider == "codex" && account.status == "enabled")
                    .cloned()
                    .collect::<Vec<_>>()
                {
                    match refresh_codex_account_profile_for_account(ctx, &account).await {
                        Ok(true) => refreshed_profile_any = true,
                        Ok(false) => {}
                        Err(error) => {
                            warn!(
                                error = error.as_str(),
                                account_id = account.account_id.as_str(),
                                "failed to refresh codex account profile snapshot"
                            );
                        }
                    }
                }
                if refreshed_profile_any {
                    accounts = ctx
                        .oauth_pool
                        .list_accounts(provider.as_deref())
                        .map_err(RpcError::internal)?;
                }

                let now = now_ms();
                let should_attempt_usage_refresh = match usage_refresh_mode {
                    ServiceCodexUsageRefreshMode::Off => false,
                    ServiceCodexUsageRefreshMode::Force => true,
                    ServiceCodexUsageRefreshMode::Auto => should_attempt_local_codex_sync(
                        now,
                        ctx.service_codex_usage_refresh_last_attempt_ms.as_ref(),
                        SERVICE_CODEX_USAGE_REFRESH_MIN_INTERVAL_MS,
                    ),
                };
                if should_attempt_usage_refresh {
                    let refresh_targets = {
                        let mut attempt_by_account_ms = ctx
                            .service_codex_usage_refresh_attempt_by_account_ms
                            .write()
                            .await;
                        select_service_codex_usage_refresh_accounts(
                            &accounts,
                            now,
                            usage_refresh_mode,
                            &mut attempt_by_account_ms,
                        )
                    };
                    let mut refreshed_any = false;
                    for account in refresh_targets {
                        match refresh_service_codex_oauth_usage_for_account(ctx, &account).await {
                            Ok(true) => refreshed_any = true,
                            Ok(false) => {}
                            Err(error) => {
                                warn!(
                                    error = error.as_str(),
                                    account_id = account.account_id.as_str(),
                                    "failed to refresh service codex oauth usage snapshot"
                                );
                            }
                        }
                    }
                    if refreshed_any {
                        accounts = ctx
                            .oauth_pool
                            .list_accounts(provider.as_deref())
                            .map_err(RpcError::internal)?;
                    }
                }
            }
            let redacted = accounts
                .into_iter()
                .map(redact_oauth_account_summary)
                .collect::<Vec<_>>();
            Ok(json!(redacted))
        }
        "code_oauth_account_upsert" => {
            let params = as_object(params)?;
            let input = parse_oauth_account_upsert_input(params, &ctx.runtime_diagnostics)?;
            let account = ctx
                .oauth_pool
                .upsert_account(input)
                .map_err(map_oauth_account_upsert_error)?;
            Ok(json!(redact_oauth_account_summary(account)))
        }
        "code_oauth_account_remove" => {
            let params = as_object(params)?;
            let account_id = read_required_string(params, "accountId")?;
            let removed = ctx
                .oauth_pool
                .remove_account(account_id)
                .map_err(RpcError::internal)?;
            Ok(json!(removed))
        }
        "code_oauth_primary_account_get" => {
            let params = as_object(params)?;
            let provider = parse_optional_oauth_provider(params, "provider")?.ok_or_else(|| {
                RpcError::invalid_params("Missing required string field: provider")
            })?;
            let mut summary = ctx
                .oauth_pool
                .get_primary_account(provider.as_str())
                .map_err(RpcError::internal)?;
            summary.account = summary.account.map(redact_oauth_account_summary);
            Ok(json!(summary))
        }
        "code_oauth_primary_account_set" => {
            let params = as_object(params)?;
            let input = parse_oauth_primary_account_set_input(params)?;
            let mut summary = ctx
                .oauth_pool
                .set_primary_account(input)
                .map_err(map_oauth_pool_mutation_error)?;
            summary.account = summary.account.map(redact_oauth_account_summary);
            Ok(json!(summary))
        }
        "code_oauth_pools_list" => {
            let params = as_object(params)?;
            let provider = parse_optional_oauth_provider(params, "provider")?;
            let pools = ctx
                .oauth_pool
                .list_pools(provider.as_deref())
                .map_err(RpcError::internal)?;
            Ok(json!(pools))
        }
        "code_oauth_pool_upsert" => {
            let params = as_object(params)?;
            let input = parse_oauth_pool_upsert_input(params)?;
            let pool = ctx
                .oauth_pool
                .upsert_pool(input)
                .map_err(map_oauth_pool_mutation_error)?;
            Ok(json!(pool))
        }
        "code_oauth_pool_remove" => {
            let params = as_object(params)?;
            let pool_id = read_required_string(params, "poolId")?;
            let removed = ctx
                .oauth_pool
                .remove_pool(pool_id)
                .map_err(RpcError::internal)?;
            Ok(json!(removed))
        }
        "code_oauth_pool_members_list" => {
            let params = as_object(params)?;
            let pool_id = read_required_string(params, "poolId")?;
            let members = ctx
                .oauth_pool
                .list_pool_members(pool_id)
                .map_err(RpcError::internal)?;
            Ok(json!(members))
        }
        "code_oauth_pool_apply" => {
            let params = as_object(params)?;
            let input = parse_oauth_pool_apply_input(params)?;
            let applied = ctx
                .oauth_pool
                .apply_pool(input)
                .map_err(map_oauth_pool_mutation_error)?;
            Ok(json!(applied))
        }
        "code_oauth_pool_members_replace" => {
            let params = as_object(params)?;
            let pool_id = read_required_string(params, "poolId")?;
            let members = parse_oauth_pool_member_inputs(params)?;
            let replaced = ctx
                .oauth_pool
                .replace_pool_members(pool_id, members.as_slice())
                .map_err(map_oauth_pool_mutation_error)?;
            Ok(json!(replaced))
        }
        "code_oauth_pool_select" => {
            let params = as_object(params)?;
            let pool_id = read_required_string(params, "poolId")?;
            let input = OAuthPoolSelectionInput {
                pool_id: pool_id.to_string(),
                session_id: read_optional_string(params, "sessionId"),
                // Prefer the explicit ChatGPT workspace field; keep the legacy
                // workspaceId alias only for backward compatibility.
                workspace_id: read_optional_string(params, "chatgptWorkspaceId")
                    .or_else(|| read_optional_string(params, "chatgpt_workspace_id"))
                    .or_else(|| read_optional_string(params, "workspaceId"))
                    .or_else(|| read_optional_string(params, "workspace_id")),
                model_id: read_optional_string(params, "modelId"),
            };
            let selection = ctx
                .oauth_pool
                .select_pool_account(input)
                .map_err(RpcError::internal)?;
            let selection = match selection {
                Some(mut entry) => {
                    match refresh_codex_account_profile_for_account(ctx, &entry.account).await {
                        Ok(true) => {
                            if let Ok(accounts) = ctx
                                .oauth_pool
                                .list_accounts(Some(entry.account.provider.as_str()))
                            {
                                if let Some(refreshed_account) = accounts
                                    .into_iter()
                                    .find(|account| account.account_id == entry.account.account_id)
                                {
                                    entry.account = refreshed_account;
                                }
                            }
                        }
                        Ok(false) => {}
                        Err(error) => {
                            warn!(
                                error = error.as_str(),
                                account_id = entry.account.account_id.as_str(),
                                "failed to refresh codex account profile for pool selection"
                            );
                        }
                    }
                    Some(entry)
                }
                None => None,
            };
            let redacted_selection = selection.map(|mut entry| {
                entry.account = redact_oauth_account_summary(entry.account);
                entry
            });
            Ok(json!(redacted_selection))
        }
        "code_oauth_pool_account_bind" => {
            let params = as_object(params)?;
            let pool_id = read_required_string(params, "poolId")?;
            let session_id = read_required_string(params, "sessionId")?;
            let account_id = read_required_string(params, "accountId")?;
            let input = OAuthPoolAccountBindInput {
                pool_id: pool_id.to_string(),
                session_id: session_id.to_string(),
                account_id: account_id.to_string(),
                workspace_id: read_optional_string(params, "chatgptWorkspaceId")
                    .or_else(|| read_optional_string(params, "chatgpt_workspace_id"))
                    .or_else(|| read_optional_string(params, "workspaceId"))
                    .or_else(|| read_optional_string(params, "workspace_id")),
            };
            let selection = ctx
                .oauth_pool
                .bind_pool_account(input)
                .map_err(map_oauth_pool_mutation_error)?;
            let redacted_selection = selection.map(|mut entry| {
                entry.account = redact_oauth_account_summary(entry.account);
                entry
            });
            Ok(json!(redacted_selection))
        }
        "code_oauth_rate_limit_report" => {
            let params = as_object(params)?;
            let input = parse_oauth_rate_limit_report_input(params)?;
            let recorded = ctx
                .oauth_pool
                .report_rate_limit(input)
                .map_err(RpcError::internal)?;
            Ok(json!(recorded))
        }
        "code_oauth_chatgpt_auth_tokens_refresh" => {
            handle_oauth_chatgpt_auth_tokens_refresh(ctx, params).await
        }
        "code_oauth_codex_login_start" => {
            let params = as_object(params)?;
            let input = CodexOauthStartInput {
                workspace_id: read_optional_string(params, "workspaceId")
                    .or_else(|| read_optional_string(params, "workspace_id")),
            };
            start_codex_oauth(ctx, input, None)
                .await
                .map(|result| json!(result))
                .map_err(RpcError::invalid_params)
        }
        "code_oauth_codex_login_cancel" => {
            let params = as_object(params)?;
            let input = CodexOauthCancelInput {
                workspace_id: read_optional_string(params, "workspaceId")
                    .or_else(|| read_optional_string(params, "workspace_id")),
            };
            Ok(json!(cancel_codex_oauth(ctx, input).await))
        }
        "code_oauth_codex_accounts_import_from_cockpit_tools" => {
            let _params = as_object(params)?;
            let result = import_cockpit_tools_codex_accounts(ctx.oauth_pool.as_ref())
                .map_err(RpcError::internal)?;
            Ok(json!(result))
        }
        "code_live_skills_list" => Ok(json!(live_skills::list_live_skills(&ctx.config))),
        "code_live_skill_execute" => live_skills::handle_live_skill_execute(ctx, params).await,
        "code_extension_catalog_list_v2" => handle_extension_catalog_list_v2(ctx, params).await,
        "code_extension_get_v2" => handle_extension_get_v2(ctx, params).await,
        "code_extension_install_v2" => handle_extension_install_v2(ctx, params).await,
        "code_extension_update_v2" => handle_extension_update_v2(ctx, params).await,
        "code_extension_set_state_v2" => handle_extension_set_state_v2(ctx, params).await,
        "code_extension_remove_v2" => handle_extension_remove_v2(ctx, params).await,
        "code_extension_registry_search_v2" => handle_extension_registry_search_v2(ctx, params).await,
        "code_extension_registry_sources_v2" => handle_extension_registry_sources_v2(ctx, params).await,
        "code_extension_permissions_evaluate_v2" => {
            handle_extension_permissions_evaluate_v2(ctx, params).await
        }
        "code_extension_health_read_v2" => handle_extension_health_read_v2(ctx, params).await,
        "code_extension_tools_list_v2" => handle_extension_tools_list_v2(ctx, params).await,
        "code_extension_resource_read_v2" => handle_extension_resource_read_v2(ctx, params).await,
        "code_session_export_v1" => handle_session_export_v1(ctx, params).await,
        "code_session_import_v1" => handle_session_import_v1(ctx, params).await,
        "code_session_delete_v1" => handle_session_delete_v1(ctx, params).await,
        "code_thread_snapshots_get_v1" => handle_thread_snapshots_get_v1(ctx).await,
        "code_thread_snapshots_set_v1" => handle_thread_snapshots_set_v1(ctx, params).await,
        "code_security_preflight_v1" => handle_security_preflight_v1(ctx, params).await,
        "code_runtime_diagnostics_export_v1" => {
            handle_runtime_diagnostics_export_v1(ctx, params).await
        }
                _ => Err(RpcError::internal(
                    "Unhandled RPC method after registry resolution.",
                )),
            }
        }
    }
}

pub(crate) async fn invoke_workspace_diagnostics_list_v1(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    handle_workspace_diagnostics_list_v1(ctx, params).await
}

pub(crate) async fn invoke_workspace_patch_apply_v1(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    handle_workspace_patch_apply_v1(ctx, params).await
}

pub(crate) async fn invoke_browser_debug_status_v1(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    handle_browser_debug_status_v1(ctx, params).await
}

pub(crate) async fn invoke_browser_debug_run_v1(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    handle_browser_debug_run_v1(ctx, params).await
}

#[cfg(test)]
pub(crate) fn collect_local_distributed_task_graph_summary_candidates(
    store: &AgentTaskStore,
    requested_task_id: &str,
    root_task_id: &str,
) -> Vec<runtime_backends_dispatch::LocalDistributedTaskGraphSummaryCandidate> {
    runtime_backends_dispatch::collect_local_distributed_task_graph_summary_candidates(
        store,
        requested_task_id,
        root_task_id,
    )
}

async fn handle_turn_interrupt(ctx: &AppContext, params: &Value) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let turn_id = read_optional_string(params, "turnId");
    if let Some(turn_id) = turn_id
        .as_deref()
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
    {
        let _ = crate::acp_runtime::cancel_session_by_turn(ctx, turn_id).await;
        if let Some(waiter) = ctx
            .turn_interrupt_waiters
            .read()
            .await
            .get(turn_id)
            .cloned()
        {
            waiter.notify_waiters();
            return Ok(json!(true));
        }
        return Ok(json!(false));
    }
    let waiters = ctx
        .turn_interrupt_waiters
        .read()
        .await
        .values()
        .cloned()
        .collect::<Vec<_>>();
    for waiter in &waiters {
        waiter.notify_waiters();
    }
    Ok(json!(!waiters.is_empty()))
}
