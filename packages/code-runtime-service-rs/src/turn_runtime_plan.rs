use super::{
    is_full_access_mode, live_skills, publish_turn_event, query_provider,
    turn_runtime_plan_validation::{
        build_runtime_planner_lint_fallback, planner_diagnostics_payload,
        publish_runtime_planner_diagnostics, with_planner_diagnostics_metadata,
        RuntimePlannerDiagnosticsReport,
    },
    AppContext, RuntimeProvider, TurnProviderRoute, TURN_EVENT_DELTA,
    TURN_EVENT_ITEM_MCP_TOOL_CALL_PROGRESS, TURN_EVENT_TOOL_CALLING, TURN_EVENT_TOOL_RESULT,
};
use crate::provider_query::query_provider_runtime_tool_call;
use crate::AgentStepKind;
use serde_json::{json, Value};
use tracing::warn;

#[path = "turn_runtime_plan_direct_execution.rs"]
mod direct_execution;
#[path = "turn_runtime_plan_execution_graph.rs"]
mod execution_graph;
#[path = "turn_runtime_plan_failure_recovery.rs"]
mod failure_recovery;
#[path = "turn_runtime_plan_output.rs"]
mod output_helpers;
#[path = "turn_runtime_plan_planner.rs"]
mod planner;
#[path = "turn_runtime_plan_search.rs"]
mod search_helpers;

use direct_execution::{
    maybe_retry_direct_execution_legacy_plan, maybe_retry_direct_execution_tool_plan,
    request_requires_direct_runtime_execution, should_emit_provider_runtime_plan_delta,
};
use execution_graph::{
    build_provider_runtime_execution_waves, ScheduledProviderRuntimeStep,
    PROVIDER_RUNTIME_PLAN_MAX_PARALLEL_WAVE_WIDTH,
};
use failure_recovery::{
    execute_provider_runtime_plan_with_legacy_recovery,
    execute_provider_runtime_plan_with_tool_recovery,
};
use output_helpers::build_provider_runtime_plan_review_body;
use output_helpers::{
    build_provider_runtime_final_results_json, build_provider_runtime_plan_delta,
    compact_provider_runtime_step_output,
};
use planner::{
    assistant_message_indicates_local_access_refusal, build_provider_runtime_execution_fallback,
    build_provider_runtime_final_prompt, build_provider_runtime_plan_prompt,
    build_provider_runtime_plan_review_prompt, build_provider_runtime_step_payload,
    build_runtime_planner_diagnostics, enforce_provider_runtime_plan_step_constraints,
    merge_json_object_fields, parse_provider_runtime_plan_response,
    parse_provider_runtime_plan_tool_arguments, ProviderRuntimePlanResponse, ProviderRuntimeStep,
    ProviderRuntimeStepResult, PROVIDER_RUNTIME_PLAN_MAX_STEPS,
};

pub(super) fn request_requires_sub_agent_orchestration(message: &str) -> bool {
    planner::request_requires_sub_agent_orchestration(message)
}

#[cfg(test)]
fn extract_first_code_block_with_languages(
    message: &str,
    allowed_languages: &[&str],
) -> Option<String> {
    planner::extract_first_code_block_with_languages(message, allowed_languages)
}

const PROVIDER_RUNTIME_STEP_OUTPUT_PREVIEW_MAX_BYTES: usize = 256 * 1024;
const PROVIDER_RUNTIME_FINAL_PROMPT_STEP_OUTPUT_MAX_BYTES: usize = 12 * 1024;
const PROVIDER_RUNTIME_RECOVERABLE_READ_NOT_FOUND_ERROR_CODE: &str = "runtime.read.file_not_found";

fn normalize_provider_runtime_final_response(
    turn_id: &str,
    final_message: String,
    step_results: &[ProviderRuntimeStepResult],
) -> String {
    let trimmed = final_message.trim();
    if !trimmed.is_empty() {
        return trimmed.to_string();
    }
    warn!(
        turn_id = turn_id,
        "runtime final response was blank after successful step execution; falling back to execution summary"
    );
    build_provider_runtime_execution_fallback(step_results)
}

fn is_recoverable_provider_runtime_step_failure(result: &ProviderRuntimeStepResult) -> bool {
    !result.ok
        && result.kind == AgentStepKind::Read.as_str()
        && result.error_code.as_deref()
            == Some(PROVIDER_RUNTIME_RECOVERABLE_READ_NOT_FOUND_ERROR_CODE)
}

fn provider_runtime_step_reports_no_matches(result: &ProviderRuntimeStepResult) -> bool {
    result.kind == AgentStepKind::Bash.as_str()
        && result.ok
        && result
            .metadata
            .get("noMatches")
            .and_then(Value::as_bool)
            .unwrap_or(false)
}

fn provider_runtime_results_have_blocking_failure(
    step_results: &[ProviderRuntimeStepResult],
) -> bool {
    step_results
        .iter()
        .any(|result| !result.ok && !is_recoverable_provider_runtime_step_failure(result))
}

fn should_stop_after_provider_runtime_step(
    steps: &[ProviderRuntimeStep],
    index: usize,
    result: &ProviderRuntimeStepResult,
) -> bool {
    if !result.ok {
        return !is_recoverable_provider_runtime_step_failure(result);
    }
    provider_runtime_step_reports_no_matches(result)
        && steps
            .iter()
            .skip(index + 1)
            .all(|step| step.kind == AgentStepKind::Read)
}

fn build_provider_runtime_batch_id(turn_id: &str, batch_attempt: u64, wave_index: usize) -> String {
    let wave_suffix = format!(":wave-{}", wave_index + 1);
    if batch_attempt <= 1 {
        format!("{turn_id}:runtime-plan-batch{wave_suffix}")
    } else {
        format!("{turn_id}:runtime-plan-batch:attempt-{batch_attempt}{wave_suffix}")
    }
}

#[rustfmt::skip]
fn build_provider_runtime_tool_call_id(turn_id: &str, batch_attempt: u64, index: usize) -> String {
    if batch_attempt <= 1 {
        format!("{turn_id}:runtime-plan:{}", index + 1)
    } else {
        format!("{turn_id}:runtime-plan:attempt-{batch_attempt}:{}", index + 1)
    }
}

fn build_provider_runtime_step_arguments(
    scheduled_step: &ScheduledProviderRuntimeStep,
    batch_id: &str,
    batch_attempt: u64,
    planner_diagnostics: Option<&Value>,
) -> Value {
    let step = &scheduled_step.step;
    let mut arguments = serde_json::Map::from_iter([
        ("batchId".to_string(), Value::String(batch_id.to_string())),
        ("attempt".to_string(), Value::Number(batch_attempt.into())),
        (
            "taskKey".to_string(),
            Value::String(scheduled_step.task_key.clone()),
        ),
        (
            "dependsOn".to_string(),
            Value::Array(
                scheduled_step
                    .depends_on
                    .iter()
                    .cloned()
                    .map(Value::String)
                    .collect(),
            ),
        ),
        (
            "waveIndex".to_string(),
            Value::Number((scheduled_step.wave_index as u64).into()),
        ),
        (
            "parallelSafe".to_string(),
            Value::Bool(
                matches!(step.kind, AgentStepKind::Read | AgentStepKind::Diagnostics)
                    && !step.requires_approval.unwrap_or(false),
            ),
        ),
    ]);
    if let Some(path) = step.path.as_deref() {
        arguments.insert("path".to_string(), Value::String(path.to_string()));
    }
    if let Some(paths) = step.paths.as_ref() {
        arguments.insert(
            "paths".to_string(),
            Value::Array(paths.iter().cloned().map(Value::String).collect()),
        );
    }
    if let Some(command) = step.command.as_deref() {
        arguments.insert("command".to_string(), Value::String(command.to_string()));
    }
    if let Some(input) = step.input.as_deref() {
        arguments.insert("input".to_string(), Value::String(input.to_string()));
    }
    if let Some(timeout_ms) = step.timeout_ms {
        arguments.insert("timeoutMs".to_string(), Value::Number(timeout_ms.into()));
    }
    if let Some(max_items) = step.max_items {
        arguments.insert("maxItems".to_string(), Value::Number(max_items.into()));
    }
    if let Some(diagnostics) = planner_diagnostics {
        arguments.insert("plannerDiagnostics".to_string(), diagnostics.clone());
    }
    Value::Object(arguments)
}

fn build_provider_runtime_execution_metadata(
    scheduled_step: &ScheduledProviderRuntimeStep,
) -> Value {
    json!({
        "plannerStepKey": scheduled_step.task_key,
        "plannerDependsOn": scheduled_step.depends_on,
        "plannerWaveIndex": scheduled_step.wave_index,
        "parallelSafe": matches!(
            scheduled_step.step.kind,
            AgentStepKind::Read | AgentStepKind::Diagnostics
        ) && !scheduled_step.step.requires_approval.unwrap_or(false),
    })
}

async fn execute_provider_runtime_plan_step(
    ctx: &AppContext,
    workspace_id: &str,
    thread_id: &str,
    access_mode: &str,
    turn_id: &str,
    request_id: Option<&str>,
    scheduled_step: &ScheduledProviderRuntimeStep,
    planner_diagnostics: Option<&Value>,
    batch_attempt: u64,
) -> ProviderRuntimeStepResult {
    let batch_id =
        build_provider_runtime_batch_id(turn_id, batch_attempt, scheduled_step.wave_index);
    let tool_call_id =
        build_provider_runtime_tool_call_id(turn_id, batch_attempt, scheduled_step.index);
    let step_arguments = build_provider_runtime_step_arguments(
        scheduled_step,
        batch_id.as_str(),
        batch_attempt,
        planner_diagnostics,
    );
    let execution_metadata = build_provider_runtime_execution_metadata(scheduled_step);

    publish_turn_event(
        ctx,
        TURN_EVENT_TOOL_CALLING,
        json!({
            "threadId": thread_id,
            "turnId": turn_id,
            "itemId": tool_call_id,
            "item": {
                "id": tool_call_id,
                "type": "mcpToolCall",
                "server": "runtime",
                "tool": scheduled_step.step.kind.as_str(),
                "arguments": step_arguments.clone(),
                "status": "inProgress",
            },
        }),
        request_id,
    );

    let mut step_payload =
        build_provider_runtime_step_payload(workspace_id, &scheduled_step.step, access_mode);
    if let Some(context) = step_payload
        .get_mut("context")
        .and_then(Value::as_object_mut)
    {
        context.insert("attempt".to_string(), Value::Number(batch_attempt.into()));
        context.insert(
            "plannerStepKey".to_string(),
            Value::String(scheduled_step.task_key.clone()),
        );
        context.insert("batchId".to_string(), Value::String(batch_id.clone()));
        if let Some(request_id) = request_id {
            context.insert(
                "requestId".to_string(),
                Value::String(request_id.to_string()),
            );
        }
    }

    let executed = live_skills::handle_live_skill_execute(ctx, &step_payload).await;
    let result = match executed {
        Ok(payload) => {
            let status = payload
                .get("status")
                .and_then(Value::as_str)
                .unwrap_or("failed");
            let ok = status == "completed";
            let message = payload
                .get("message")
                .and_then(Value::as_str)
                .unwrap_or("Runtime step completed.")
                .to_string();
            let (output, output_compaction_metadata) = payload
                .get("output")
                .and_then(Value::as_str)
                .map(|entry| compact_provider_runtime_step_output(tool_call_id.as_str(), entry))
                .unwrap_or_else(|| {
                    (
                        None,
                        json!({
                            "compactionApplied": false,
                        }),
                    )
                });
            let mut metadata = with_planner_diagnostics_metadata(
                payload
                    .get("metadata")
                    .cloned()
                    .unwrap_or_else(|| json!({})),
                planner_diagnostics,
            );
            let runtime_error_code = metadata
                .get("errorCode")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned);
            merge_json_object_fields(&mut metadata, execution_metadata.clone());
            merge_json_object_fields(&mut metadata, output_compaction_metadata);
            ProviderRuntimeStepResult {
                index: scheduled_step.index,
                kind: scheduled_step.step.kind.as_str().to_string(),
                ok,
                message: message.clone(),
                output,
                metadata,
                error_code: if ok {
                    None
                } else {
                    runtime_error_code.or_else(|| Some("STEP_EXECUTION_FAILED".to_string()))
                },
            }
        }
        Err(error) => {
            let mut metadata = with_planner_diagnostics_metadata(json!({}), planner_diagnostics);
            merge_json_object_fields(&mut metadata, execution_metadata);
            ProviderRuntimeStepResult {
                index: scheduled_step.index,
                kind: scheduled_step.step.kind.as_str().to_string(),
                ok: false,
                message: error.message.clone(),
                output: None,
                metadata,
                error_code: Some(error.code.as_str().to_string()),
            }
        }
    };

    if !result.message.trim().is_empty() {
        publish_turn_event(
            ctx,
            TURN_EVENT_ITEM_MCP_TOOL_CALL_PROGRESS,
            json!({
                "threadId": thread_id,
                "turnId": turn_id,
                "itemId": tool_call_id,
                "message": result.message.clone(),
            }),
            request_id,
        );
    }

    publish_turn_event(
        ctx,
        TURN_EVENT_TOOL_RESULT,
        json!({
            "threadId": thread_id,
            "turnId": turn_id,
            "itemId": tool_call_id,
            "item": {
                "id": tool_call_id,
                "type": "mcpToolCall",
                "server": "runtime",
                "tool": scheduled_step.step.kind.as_str(),
                "arguments": step_arguments,
                "status": if result.ok { "completed" } else { "failed" },
                "result": if result.ok {
                    result.output.clone().unwrap_or_default()
                } else {
                    String::new()
                },
                "error": if result.ok {
                    String::new()
                } else {
                    result.message.clone()
                },
                "metadata": result.metadata.clone(),
            }
        }),
        request_id,
    );

    result
}

async fn execute_provider_runtime_plan_steps(
    ctx: &AppContext,
    workspace_id: &str,
    thread_id: &str,
    access_mode: &str,
    turn_id: &str,
    request_id: Option<&str>,
    steps: &[ProviderRuntimeStep],
    planner_report: Option<&RuntimePlannerDiagnosticsReport>,
    batch_attempt: u64,
) -> Vec<ProviderRuntimeStepResult> {
    let planner_diagnostics = planner_report
        .filter(|report| !report.is_empty())
        .map(planner_diagnostics_payload);
    let mut results = Vec::new();
    let execution_waves = build_provider_runtime_execution_waves(
        steps
            .iter()
            .take(PROVIDER_RUNTIME_PLAN_MAX_STEPS)
            .cloned()
            .collect::<Vec<_>>()
            .as_slice(),
    );
    for wave in execution_waves {
        if wave.is_empty() {
            continue;
        }
        let mut wave_results = Vec::new();
        for chunk in wave.chunks(PROVIDER_RUNTIME_PLAN_MAX_PARALLEL_WAVE_WIDTH) {
            let handles = chunk
                .iter()
                .cloned()
                .map(|scheduled_step| {
                    let ctx = ctx.clone();
                    let workspace_id = workspace_id.to_string();
                    let thread_id = thread_id.to_string();
                    let access_mode = access_mode.to_string();
                    let turn_id = turn_id.to_string();
                    let request_id = request_id.map(str::to_string);
                    let planner_diagnostics = planner_diagnostics.clone();
                    let step_for_panic = scheduled_step.clone();
                    let handle = ctx.task_supervisor.clone().spawn_abortable(
                        RuntimeTaskDomain::Flow,
                        format!(
                            "turn.runtime-plan.{}.{}.{}",
                            turn_id, scheduled_step.wave_index, scheduled_step.index
                        ),
                        async move {
                            execute_provider_runtime_plan_step(
                                &ctx,
                                workspace_id.as_str(),
                                thread_id.as_str(),
                                access_mode.as_str(),
                                turn_id.as_str(),
                                request_id.as_deref(),
                                &scheduled_step,
                                planner_diagnostics.as_ref(),
                                batch_attempt,
                            )
                            .await
                        },
                    );
                    (step_for_panic, handle)
                })
                .collect::<Vec<_>>();
            for (scheduled_step, mut handle) in handles {
                match handle.wait().await {
                    Ok(result) => wave_results.push(result),
                    Err(error) => {
                        let batch_id = build_provider_runtime_batch_id(
                            turn_id,
                            batch_attempt,
                            scheduled_step.wave_index,
                        );
                        let tool_call_id = build_provider_runtime_tool_call_id(
                            turn_id,
                            batch_attempt,
                            scheduled_step.index,
                        );
                        let step_arguments = build_provider_runtime_step_arguments(
                            &scheduled_step,
                            batch_id.as_str(),
                            batch_attempt,
                            planner_diagnostics.as_ref(),
                        );
                        let result = ProviderRuntimeStepResult {
                            index: scheduled_step.index,
                            kind: scheduled_step.step.kind.as_str().to_string(),
                            ok: false,
                            message: format!(
                                "Runtime step task crashed before completion: {error}"
                            ),
                            output: None,
                            metadata: with_planner_diagnostics_metadata(
                                build_provider_runtime_execution_metadata(&scheduled_step),
                                planner_diagnostics.as_ref(),
                            ),
                            error_code: Some("STEP_EXECUTION_FAILED".to_string()),
                        };
                        publish_turn_event(
                            ctx,
                            TURN_EVENT_TOOL_RESULT,
                            json!({
                                "threadId": thread_id,
                                "turnId": turn_id,
                                "itemId": tool_call_id,
                                "item": {
                                    "id": tool_call_id,
                                    "type": "mcpToolCall",
                                    "server": "runtime",
                                    "tool": scheduled_step.step.kind.as_str(),
                                    "arguments": step_arguments,
                                    "status": "failed",
                                    "result": String::new(),
                                    "error": result.message.clone(),
                                    "metadata": result.metadata.clone(),
                                }
                            }),
                            request_id,
                        );
                        wave_results.push(result);
                    }
                }
            }
        }
        wave_results.sort_by_key(|result| result.index);
        let should_stop = wave_results
            .iter()
            .any(|result| should_stop_after_provider_runtime_step(steps, result.index, result));
        results.extend(wave_results);
        if should_stop || provider_runtime_results_have_blocking_failure(results.as_slice()) {
            break;
        }
    }
    results
}

#[rustfmt::skip]
pub(super) fn should_use_provider_runtime_plan_flow(
    access_mode: &str,
    local_exec_enabled: bool,
    provider_route: &TurnProviderRoute,
) -> bool {
    !local_exec_enabled && is_full_access_mode(access_mode) && matches!(provider_route, TurnProviderRoute::Core(RuntimeProvider::OpenAI))
}

fn publish_provider_runtime_plan_item(
    ctx: &AppContext,
    thread_id: &str,
    turn_id: &str,
    request_id: Option<&str>,
    plan: &ProviderRuntimePlanResponse,
) -> bool {
    let Some(body) = build_provider_runtime_plan_review_body(plan) else {
        return false;
    };
    let item_id = format!("{turn_id}:plan");
    publish_turn_event(
        ctx,
        TURN_EVENT_TOOL_CALLING,
        json!({
            "threadId": thread_id,
            "turnId": turn_id,
            "itemId": item_id,
            "item": {
                "id": item_id,
                "type": "plan",
                "status": "inProgress",
            },
        }),
        request_id,
    );
    publish_turn_event(
        ctx,
        TURN_EVENT_TOOL_RESULT,
        json!({
            "threadId": thread_id,
            "turnId": turn_id,
            "itemId": item_id,
            "item": {
                "id": item_id,
                "type": "plan",
                "status": "completed",
                "text": body,
            },
        }),
        request_id,
    );
    true
}

#[allow(clippy::too_many_arguments)]
pub(super) async fn query_provider_via_runtime_plan_only(
    ctx: &AppContext,
    provider_route: &TurnProviderRoute,
    access_mode: &str,
    thread_id: &str,
    workspace_path: &str,
    turn_id: &str,
    request_id: Option<&str>,
    content: &str,
    model_id: &str,
    reason_effort: Option<&str>,
    service_tier: Option<&str>,
    compat_base_url_override: Option<&str>,
    api_key_override: Option<&str>,
    fallback_api_key_override: Option<&str>,
    local_codex_id_token_override: Option<&str>,
    local_codex_refresh_token_override: Option<&str>,
    persist_local_codex_auth_updates: bool,
    oauth_credential_source_override: Option<&str>,
    oauth_auth_mode_override: Option<&str>,
    oauth_external_account_id_override: Option<&str>,
) -> Result<crate::provider_requests::ProviderQueryResult, String> {
    let structured_planner_prompt =
        build_provider_runtime_plan_review_prompt(content, workspace_path);
    match query_provider_runtime_tool_call(
        &ctx.client,
        &ctx.config,
        provider_route,
        compat_base_url_override,
        api_key_override,
        fallback_api_key_override,
        oauth_credential_source_override,
        oauth_auth_mode_override,
        structured_planner_prompt.as_str(),
        model_id,
        reason_effort,
        service_tier,
    )
    .await
    {
        Ok(selection) => {
            if let Some(arguments) = selection.tool_arguments.as_deref() {
                if let Some(parsed_from_tool) =
                    parse_provider_runtime_plan_tool_arguments(arguments)
                {
                    let constrained = maybe_retry_direct_execution_tool_plan(
                        ctx,
                        provider_route,
                        access_mode,
                        workspace_path,
                        content,
                        model_id,
                        reason_effort,
                        service_tier,
                        compat_base_url_override,
                        api_key_override,
                        fallback_api_key_override,
                        oauth_credential_source_override,
                        oauth_auth_mode_override,
                        enforce_provider_runtime_plan_step_constraints(content, parsed_from_tool),
                    )
                    .await;
                    let planner_diagnostics =
                        build_runtime_planner_diagnostics(content, access_mode, &constrained);
                    publish_runtime_planner_diagnostics(
                        ctx,
                        turn_id,
                        request_id,
                        &planner_diagnostics,
                    );
                    if planner_diagnostics.has_fatal {
                        return Ok(crate::provider_requests::ProviderQueryResult::from_output(
                            build_runtime_planner_lint_fallback(&planner_diagnostics),
                        ));
                    }
                    if publish_provider_runtime_plan_item(
                        ctx,
                        thread_id,
                        turn_id,
                        request_id,
                        &constrained,
                    ) {
                        return Ok(crate::provider_requests::ProviderQueryResult::from_output(
                            String::new(),
                        ));
                    }
                    if let Some(final_message) = constrained
                        .final_message
                        .as_deref()
                        .map(str::trim)
                        .filter(|entry| !entry.is_empty())
                    {
                        return Ok(crate::provider_requests::ProviderQueryResult::from_output(
                            final_message.to_string(),
                        ));
                    }
                }
            } else if let Some(text) = selection.assistant_text {
                let trimmed = text.trim();
                if !trimmed.is_empty() {
                    return Ok(crate::provider_requests::ProviderQueryResult::from_output(
                        trimmed.to_string(),
                    ));
                }
            }
        }
        Err(error) => {
            warn!(
                turn_id = turn_id,
                error = error.as_str(),
                "runtime tool-call planner unavailable; falling back to legacy runtime planner"
            );
        }
    }

    let planner_prompt = build_provider_runtime_plan_review_prompt(content, workspace_path);
    let planner_response = query_provider(
        &ctx.client,
        &ctx.config,
        provider_route,
        compat_base_url_override,
        api_key_override,
        fallback_api_key_override,
        local_codex_id_token_override,
        local_codex_refresh_token_override,
        persist_local_codex_auth_updates,
        oauth_credential_source_override,
        oauth_auth_mode_override,
        oauth_external_account_id_override,
        planner_prompt.as_str(),
        model_id,
        reason_effort,
        service_tier,
    )
    .await?;

    let Some(parsed_plan) = parse_provider_runtime_plan_response(planner_response.output.as_str())
    else {
        return Ok(planner_response);
    };
    let plan = maybe_retry_direct_execution_legacy_plan(
        ctx,
        provider_route,
        access_mode,
        workspace_path,
        content,
        model_id,
        reason_effort,
        service_tier,
        compat_base_url_override,
        api_key_override,
        fallback_api_key_override,
        local_codex_id_token_override,
        local_codex_refresh_token_override,
        persist_local_codex_auth_updates,
        oauth_credential_source_override,
        oauth_auth_mode_override,
        oauth_external_account_id_override,
        enforce_provider_runtime_plan_step_constraints(content, parsed_plan),
    )
    .await;
    let planner_diagnostics = build_runtime_planner_diagnostics(content, access_mode, &plan);
    publish_runtime_planner_diagnostics(ctx, turn_id, request_id, &planner_diagnostics);
    if planner_diagnostics.has_fatal {
        return Ok(crate::provider_requests::ProviderQueryResult::from_output(
            build_runtime_planner_lint_fallback(&planner_diagnostics),
        ));
    }
    if publish_provider_runtime_plan_item(ctx, thread_id, turn_id, request_id, &plan) {
        return Ok(crate::provider_requests::ProviderQueryResult::from_output(
            String::new(),
        ));
    }
    if let Some(final_message) = plan
        .final_message
        .as_deref()
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
    {
        return Ok(crate::provider_requests::ProviderQueryResult::from_output(
            final_message.to_string(),
        ));
    }
    Ok(planner_response)
}

pub(super) async fn query_provider_via_runtime_plan(
    ctx: &AppContext,
    provider_route: &TurnProviderRoute,
    suppress_plan_delta: bool,
    access_mode: &str,
    workspace_id: &str,
    thread_id: &str,
    workspace_path: &str,
    turn_id: &str,
    request_id: Option<&str>,
    content: &str,
    model_id: &str,
    reason_effort: Option<&str>,
    service_tier: Option<&str>,
    compat_base_url_override: Option<&str>,
    api_key_override: Option<&str>,
    fallback_api_key_override: Option<&str>,
    local_codex_id_token_override: Option<&str>,
    local_codex_refresh_token_override: Option<&str>,
    persist_local_codex_auth_updates: bool,
    oauth_credential_source_override: Option<&str>,
    oauth_auth_mode_override: Option<&str>,
    oauth_external_account_id_override: Option<&str>,
) -> Result<crate::provider_requests::ProviderQueryResult, String> {
    let structured_planner_prompt = build_provider_runtime_plan_prompt(content, workspace_path);
    let should_force_direct_execution =
        is_full_access_mode(access_mode) && request_requires_direct_runtime_execution(content);
    match query_provider_runtime_tool_call(
        &ctx.client,
        &ctx.config,
        provider_route,
        compat_base_url_override,
        api_key_override,
        fallback_api_key_override,
        oauth_credential_source_override,
        oauth_auth_mode_override,
        structured_planner_prompt.as_str(),
        model_id,
        reason_effort,
        service_tier,
    )
    .await
    {
        Ok(selection) => {
            if let Some(arguments) = selection.tool_arguments.as_deref() {
                if let Some(parsed_from_tool) =
                    parse_provider_runtime_plan_tool_arguments(arguments)
                {
                    let constrained = maybe_retry_direct_execution_tool_plan(
                        ctx,
                        provider_route,
                        access_mode,
                        workspace_path,
                        content,
                        model_id,
                        reason_effort,
                        service_tier,
                        compat_base_url_override,
                        api_key_override,
                        fallback_api_key_override,
                        oauth_credential_source_override,
                        oauth_auth_mode_override,
                        enforce_provider_runtime_plan_step_constraints(content, parsed_from_tool),
                    )
                    .await;
                    let planner_diagnostics =
                        build_runtime_planner_diagnostics(content, access_mode, &constrained);
                    publish_runtime_planner_diagnostics(
                        ctx,
                        turn_id,
                        request_id,
                        &planner_diagnostics,
                    );
                    if planner_diagnostics.has_fatal {
                        return Ok(crate::provider_requests::ProviderQueryResult::from_output(
                            build_runtime_planner_lint_fallback(&planner_diagnostics),
                        ));
                    }
                    if constrained.steps.is_empty() {
                        if let Some(final_message) = constrained
                            .final_message
                            .as_deref()
                            .map(str::trim)
                            .filter(|entry| !entry.is_empty())
                        {
                            return Ok(crate::provider_requests::ProviderQueryResult::from_output(
                                final_message.to_string(),
                            ));
                        }
                    } else {
                        let execution_outcome = execute_provider_runtime_plan_with_tool_recovery(
                            ctx,
                            provider_route,
                            suppress_plan_delta,
                            access_mode,
                            workspace_id,
                            thread_id,
                            workspace_path,
                            turn_id,
                            request_id,
                            content,
                            model_id,
                            reason_effort,
                            service_tier,
                            compat_base_url_override,
                            api_key_override,
                            fallback_api_key_override,
                            oauth_credential_source_override,
                            oauth_auth_mode_override,
                            constrained.clone(),
                            planner_diagnostics.clone(),
                        )
                        .await;
                        if execution_outcome.unresolved_blocking_failure {
                            return Ok(crate::provider_requests::ProviderQueryResult::from_output(
                                build_provider_runtime_execution_fallback(
                                    execution_outcome.step_results.as_slice(),
                                ),
                            ));
                        }
                        let final_results_json = build_provider_runtime_final_results_json(
                            execution_outcome.step_results.as_slice(),
                        );
                        let final_prompt = build_provider_runtime_final_prompt(
                            content,
                            &execution_outcome.final_plan,
                            final_results_json.as_str(),
                        );
                        match query_provider(
                            &ctx.client,
                            &ctx.config,
                            provider_route,
                            compat_base_url_override,
                            api_key_override,
                            fallback_api_key_override,
                            local_codex_id_token_override,
                            local_codex_refresh_token_override,
                            persist_local_codex_auth_updates,
                            oauth_credential_source_override,
                            oauth_auth_mode_override,
                            oauth_external_account_id_override,
                            final_prompt.as_str(),
                            model_id,
                            reason_effort,
                            service_tier,
                        )
                        .await
                        {
                            Ok(final_message) => {
                                return Ok(crate::provider_requests::ProviderQueryResult {
                                    output: normalize_provider_runtime_final_response(
                                        turn_id,
                                        final_message.output,
                                        execution_outcome.step_results.as_slice(),
                                    ),
                                    response_model_id: final_message.response_model_id,
                                });
                            }
                            Err(error) => {
                                warn!(
                                    turn_id = turn_id,
                                    error = error.as_str(),
                                    "runtime tool-call final response request failed; returning execution fallback"
                                );
                                return Ok(crate::provider_requests::ProviderQueryResult::from_output(
                                    build_provider_runtime_execution_fallback(
                                        execution_outcome.step_results.as_slice(),
                                    ),
                                ));
                            }
                        }
                    }
                } else {
                    warn!(
                        turn_id = turn_id,
                        "runtime tool-call orchestration returned unparsable tool arguments; falling back to legacy runtime planner"
                    );
                }
            } else if let Some(text) = selection.assistant_text {
                let trimmed = text.trim();
                if !trimmed.is_empty() && !should_force_direct_execution {
                    return Ok(crate::provider_requests::ProviderQueryResult::from_output(
                        trimmed.to_string(),
                    ));
                }
            }
        }
        Err(error) => {
            warn!(
                turn_id = turn_id,
                error = error.as_str(),
                "runtime tool-call orchestration unavailable; falling back to legacy runtime planner"
            );
        }
    }

    let planner_prompt = build_provider_runtime_plan_prompt(content, workspace_path);
    let planner_response = query_provider(
        &ctx.client,
        &ctx.config,
        provider_route,
        compat_base_url_override,
        api_key_override,
        fallback_api_key_override,
        local_codex_id_token_override,
        local_codex_refresh_token_override,
        persist_local_codex_auth_updates,
        oauth_credential_source_override,
        oauth_auth_mode_override,
        oauth_external_account_id_override,
        planner_prompt.as_str(),
        model_id,
        reason_effort,
        service_tier,
    )
    .await?;

    let Some(parsed_plan) = parse_provider_runtime_plan_response(planner_response.output.as_str())
    else {
        return query_provider(
            &ctx.client,
            &ctx.config,
            provider_route,
            compat_base_url_override,
            api_key_override,
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
        )
        .await;
    };
    let original_step_count = parsed_plan.steps.len();
    let plan = maybe_retry_direct_execution_legacy_plan(
        ctx,
        provider_route,
        access_mode,
        workspace_path,
        content,
        model_id,
        reason_effort,
        service_tier,
        compat_base_url_override,
        api_key_override,
        fallback_api_key_override,
        local_codex_id_token_override,
        local_codex_refresh_token_override,
        persist_local_codex_auth_updates,
        oauth_credential_source_override,
        oauth_auth_mode_override,
        oauth_external_account_id_override,
        enforce_provider_runtime_plan_step_constraints(content, parsed_plan),
    )
    .await;
    let filtered_step_count = plan.steps.len();
    if filtered_step_count < original_step_count {
        warn!(
            turn_id = turn_id,
            removed_steps = original_step_count.saturating_sub(filtered_step_count),
            "runtime planner emitted disallowed bash steps for a sub-agent-orchestrated request; filtered before execution"
        );
    }
    let planner_diagnostics = build_runtime_planner_diagnostics(content, access_mode, &plan);
    publish_runtime_planner_diagnostics(ctx, turn_id, request_id, &planner_diagnostics);
    if planner_diagnostics.has_fatal {
        return Ok(crate::provider_requests::ProviderQueryResult::from_output(
            build_runtime_planner_lint_fallback(&planner_diagnostics),
        ));
    }

    if plan.steps.is_empty() {
        if let Some(final_message) = plan
            .final_message
            .as_deref()
            .map(str::trim)
            .filter(|entry| !entry.is_empty())
        {
            return Ok(crate::provider_requests::ProviderQueryResult::from_output(
                final_message.to_string(),
            ));
        }
        return query_provider(
            &ctx.client,
            &ctx.config,
            provider_route,
            compat_base_url_override,
            api_key_override,
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
        )
        .await;
    }

    let execution_outcome = execute_provider_runtime_plan_with_legacy_recovery(
        ctx,
        provider_route,
        suppress_plan_delta,
        access_mode,
        workspace_id,
        thread_id,
        workspace_path,
        turn_id,
        request_id,
        content,
        model_id,
        reason_effort,
        service_tier,
        compat_base_url_override,
        api_key_override,
        fallback_api_key_override,
        local_codex_id_token_override,
        local_codex_refresh_token_override,
        persist_local_codex_auth_updates,
        oauth_credential_source_override,
        oauth_auth_mode_override,
        oauth_external_account_id_override,
        plan.clone(),
        planner_diagnostics.clone(),
    )
    .await;
    if execution_outcome.unresolved_blocking_failure {
        return Ok(crate::provider_requests::ProviderQueryResult::from_output(
            build_provider_runtime_execution_fallback(execution_outcome.step_results.as_slice()),
        ));
    }
    let final_results_json =
        build_provider_runtime_final_results_json(execution_outcome.step_results.as_slice());
    let final_prompt = build_provider_runtime_final_prompt(
        content,
        &execution_outcome.final_plan,
        final_results_json.as_str(),
    );
    match query_provider(
        &ctx.client,
        &ctx.config,
        provider_route,
        compat_base_url_override,
        api_key_override,
        fallback_api_key_override,
        local_codex_id_token_override,
        local_codex_refresh_token_override,
        persist_local_codex_auth_updates,
        oauth_credential_source_override,
        oauth_auth_mode_override,
        oauth_external_account_id_override,
        final_prompt.as_str(),
        model_id,
        reason_effort,
        service_tier,
    )
    .await
    {
        Ok(final_message) => Ok(crate::provider_requests::ProviderQueryResult {
            output: normalize_provider_runtime_final_response(
                turn_id,
                final_message.output,
                execution_outcome.step_results.as_slice(),
            ),
            response_model_id: final_message.response_model_id,
        }),
        Err(error) => {
            warn!(
                turn_id = turn_id,
                error = error.as_str(),
                "runtime plan final response request failed; returning execution fallback"
            );
            Ok(crate::provider_requests::ProviderQueryResult::from_output(
                build_provider_runtime_execution_fallback(execution_outcome.step_results.as_slice()),
            ))
        }
    }
}

pub(super) async fn maybe_recover_provider_local_access_refusal(
    ctx: &AppContext,
    response: crate::provider_requests::ProviderQueryResult,
    suppress_plan_delta: bool,
    access_mode: &str,
    local_exec_enabled: bool,
    provider_route: &TurnProviderRoute,
    workspace_id: &str,
    thread_id: &str,
    workspace_path: &str,
    turn_id: &str,
    request_id: Option<&str>,
    content: &str,
    model_id: &str,
    reason_effort: Option<&str>,
    service_tier: Option<&str>,
    compat_base_url_override: Option<&str>,
    api_key_override: Option<&str>,
    fallback_api_key_override: Option<&str>,
    local_codex_id_token_override: Option<&str>,
    local_codex_refresh_token_override: Option<&str>,
    persist_local_codex_auth_updates: bool,
    oauth_credential_source_override: Option<&str>,
    oauth_auth_mode_override: Option<&str>,
    oauth_external_account_id_override: Option<&str>,
) -> crate::provider_requests::ProviderQueryResult {
    if !assistant_message_indicates_local_access_refusal(response.output.as_str()) {
        return response;
    }
    if !should_use_provider_runtime_plan_flow(access_mode, local_exec_enabled, provider_route) {
        warn!(
            turn_id = turn_id,
            access_mode = access_mode,
            local_exec_enabled = local_exec_enabled,
            routed_provider = provider_route.routed_provider(),
            "provider response indicated local access refusal but runtime refusal recovery is disabled"
        );
        return response;
    }

    match query_provider_via_runtime_plan(
        ctx,
        provider_route,
        suppress_plan_delta,
        access_mode,
        workspace_id,
        thread_id,
        workspace_path,
        turn_id,
        request_id,
        content,
        model_id,
        reason_effort,
        service_tier,
        compat_base_url_override,
        api_key_override,
        fallback_api_key_override,
        local_codex_id_token_override,
        local_codex_refresh_token_override,
        persist_local_codex_auth_updates,
        oauth_credential_source_override,
        oauth_auth_mode_override,
        oauth_external_account_id_override,
    )
    .await
    {
        Ok(recovered_response) => recovered_response,
        Err(error) => {
            warn!(
                turn_id = turn_id,
                error = error.as_str(),
                "runtime refusal recovery flow failed"
            );
            response
        }
    }
}

#[cfg(test)]
#[path = "turn_runtime_plan_tests.rs"]
mod tests;

#[cfg(test)]
#[path = "turn_runtime_plan_prompt_tests.rs"]
mod prompt_tests;
use crate::RuntimeTaskDomain;
