pub(crate) async fn handle_live_skill_execute(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    handle_live_skill_execute_with_cancel(ctx, params, None).await
}

pub(crate) async fn handle_live_skill_execute_with_cancel(
    ctx: &AppContext,
    params: &Value,
    cancellation: Option<CancellationToken>,
) -> Result<Value, RpcError> {
    let parsed: LiveSkillExecuteParams =
        serde_json::from_value(params.clone()).map_err(|error| {
            RpcError::invalid_params(format!("Invalid live skill request payload: {error}"))
        })?;

    let skill_id = parsed.skill_id.trim().to_string();
    let Some(canonical_skill_id) = canonicalize_live_skill_id(skill_id.as_str()) else {
        return Err(RpcError::invalid_params(format!(
            "Unknown live skill `{skill_id}`. Supported skills: {BUILTIN_LIVE_NETWORK_SKILL_ID}, {BUILTIN_LIVE_RESEARCH_ORCHESTRATOR_SKILL_ID}, {BUILTIN_LIVE_CORE_TREE_SKILL_ID}, {BUILTIN_LIVE_CORE_GREP_SKILL_ID}, {BUILTIN_LIVE_CORE_READ_SKILL_ID}, {BUILTIN_LIVE_CORE_WRITE_SKILL_ID}, {BUILTIN_LIVE_CORE_EDIT_SKILL_ID}, {BUILTIN_LIVE_CORE_BASH_SKILL_ID}, {BUILTIN_LIVE_CORE_JS_REPL_SKILL_ID}, {BUILTIN_LIVE_CORE_JS_REPL_RESET_SKILL_ID}, {BUILTIN_LIVE_CORE_DIAGNOSTICS_SKILL_ID}, {BUILTIN_LIVE_CORE_COMPUTER_OBSERVE_SKILL_ID}."
        )));
    };

    let input = parsed.input;
    let options = parsed.options.unwrap_or_default();
    let live_skill_context = parsed.context.clone();
    let access_mode_hint = parsed
        .context
        .as_ref()
        .and_then(|context| context.access_mode.as_deref());
    if canonical_skill_id == BUILTIN_LIVE_CORE_BASH_SKILL_ID {
        let Some(command) = resolve_core_shell_command(input.as_str(), &options) else {
            return Err(RpcError::invalid_params(
                "command is required for core-bash.".to_string(),
            ));
        };
        validate_core_shell_command(command).map_err(RpcError::invalid_params)?;
    }
    if canonical_skill_id == BUILTIN_LIVE_RESEARCH_ORCHESTRATOR_SKILL_ID {
        return handle_research_orchestrator_live_skill_execute(
            ctx,
            canonical_skill_id,
            input.as_str(),
            &options,
            live_skill_context.as_ref(),
        )
        .await;
    }
    if canonical_skill_id != BUILTIN_LIVE_NETWORK_SKILL_ID {
        return handle_core_live_skill_execute(
            ctx,
            &ctx.config,
            &ctx.state,
            &ctx.live_skill_execution_counters,
            &ctx.live_skill_js_repl_sessions,
            canonical_skill_id,
            input.as_str(),
            &options,
            live_skill_context.as_ref(),
            access_mode_hint,
            cancellation,
        )
        .await;
    }

    let query = options.query.clone().unwrap_or_else(|| input.clone());
    let result = execute_live_skill_network_analysis(
        &ctx.client,
        &ctx.config,
        &ctx.live_skill_network_cache,
        canonical_skill_id,
        query.as_str(),
        &options,
        live_skill_context.as_ref(),
    )
    .await?;

    Ok(json!(result))
}

type LiveSkillAliasEntry = (&'static str, &'static [&'static str]);

const LIVE_SKILL_ALIAS_REGISTRY: &[LiveSkillAliasEntry] = &[
    (
        BUILTIN_LIVE_NETWORK_SKILL_ID,
        &["network-analysis", "network_analysis"],
    ),
    (
        BUILTIN_LIVE_RESEARCH_ORCHESTRATOR_SKILL_ID,
        &["research-orchestrator", "research_orchestrator", "research"],
    ),
    (
        BUILTIN_LIVE_CORE_TREE_SKILL_ID,
        &["core-tree", "tree", "file-tree", "file_tree", "ls"],
    ),
    (
        BUILTIN_LIVE_CORE_GREP_SKILL_ID,
        &["core-grep", "grep", "rg", "search", "file-search", "file_search"],
    ),
    (
        BUILTIN_LIVE_CORE_READ_SKILL_ID,
        &["core-read", "read", "file-read", "file_read", "read-file", "read_file"],
    ),
    (
        BUILTIN_LIVE_CORE_WRITE_SKILL_ID,
        &["core-write", "write", "file-write", "file_write", "write-file", "write_file"],
    ),
    (
        BUILTIN_LIVE_CORE_EDIT_SKILL_ID,
        &["core-edit", "edit", "file-edit", "file_edit", "edit-file", "edit_file"],
    ),
    (
        BUILTIN_LIVE_CORE_BASH_SKILL_ID,
        &["core-bash", "bash", "shell", "shell-command", "shell_command"],
    ),
    (
        BUILTIN_LIVE_CORE_JS_REPL_SKILL_ID,
        &["core-js-repl", "js-repl", "js_repl", "javascript-repl", "javascript_repl"],
    ),
    (
        BUILTIN_LIVE_CORE_JS_REPL_RESET_SKILL_ID,
        &[
            "core-js-repl-reset",
            "js-repl-reset",
            "js_repl_reset",
            "javascript-repl-reset",
            "javascript_repl_reset",
            "reset-js-repl",
            "reset_js_repl",
        ],
    ),
    (
        BUILTIN_LIVE_CORE_DIAGNOSTICS_SKILL_ID,
        &[
            "core-diagnostics",
            "diagnostics",
            "workspace-diagnostics",
            "workspace_diagnostics",
        ],
    ),
    (
        BUILTIN_LIVE_CORE_COMPUTER_OBSERVE_SKILL_ID,
        &[
            "core-computer-observe",
            "computer-observe",
            "computer_observe",
            "observe-computer",
            "observe-computer-screen",
        ],
    ),
];

static LIVE_SKILL_CANONICAL_IDS_BY_ALIAS: LazyLock<HashMap<&'static str, &'static str>> =
    LazyLock::new(|| {
        let mut registry = HashMap::new();
        for (canonical_skill_id, aliases) in LIVE_SKILL_ALIAS_REGISTRY {
            for alias in *aliases {
                registry.insert(*alias, *canonical_skill_id);
            }
        }
        registry
    });

pub(crate) fn live_skill_aliases(canonical_skill_id: &str) -> &'static [&'static str] {
    LIVE_SKILL_ALIAS_REGISTRY
        .iter()
        .find_map(|(registered_skill_id, aliases)| {
            (*registered_skill_id == canonical_skill_id).then_some(*aliases)
        })
        .unwrap_or(&[])
}

fn canonicalize_live_skill_id(skill_id: &str) -> Option<&'static str> {
    let normalized = skill_id.trim().to_ascii_lowercase();
    LIVE_SKILL_CANONICAL_IDS_BY_ALIAS
        .get(normalized.as_str())
        .copied()
}

async fn handle_core_live_skill_execute(
    ctx: &AppContext,
    config: &ServiceConfig,
    state: &SharedRuntimeState,
    counters: &LiveSkillExecutionCounters,
    js_repl_sessions: &LiveSkillCoreJsReplSessionStore,
    canonical_skill_id: &str,
    input: &str,
    options: &LiveSkillExecuteOptions,
    context: Option<&LiveSkillExecuteContext>,
    access_mode_hint: Option<&str>,
    cancellation: Option<CancellationToken>,
) -> Result<Value, RpcError> {
    let tool_name = core_live_skill_guardrail_tool_name(canonical_skill_id);
    let scope = core_live_skill_execution_scope(canonical_skill_id);
    let started_at = now_ms();
    let workspace_id_hint = options.workspace_id.clone();
    let payload_bytes = core_live_skill_payload_bytes(canonical_skill_id, input, options);

    record_core_live_skill_phase_event(
        ctx,
        tool_name,
        scope,
        crate::runtime_tool_metrics::RuntimeToolExecutionEventPhase::Attempted,
        started_at,
        context,
        workspace_id_hint.as_deref(),
    )
    .await;

    let guardrail_request = crate::runtime_tool_guardrails::RuntimeToolGuardrailEvaluateRequest {
        tool_name: tool_name.to_string(),
        scope,
        workspace_id: workspace_id_hint.clone(),
        payload_bytes,
        at: Some(started_at),
        request_id: context.and_then(|value| value.request_id.clone()),
        trace_id: context.and_then(|value| value.trace_id.clone()),
        span_id: context.and_then(|value| value.span_id.clone()),
        parent_span_id: context.and_then(|value| value.parent_span_id.clone()),
        planner_step_key: context.and_then(|value| value.planner_step_key.clone()),
        attempt: context.and_then(|value| value.attempt),
        capability_profile:
            crate::runtime_tool_guardrails::RuntimeToolGuardrailCapabilityProfile::default(),
    };
    let guardrail_result = {
        let mut guardrails = ctx.runtime_tool_guardrails.lock().await;
        guardrails.evaluate(&guardrail_request)
    };
    let guardrail_result = match guardrail_result {
        Ok(result) => result,
        Err(error) => {
            let mut guardrails = ctx.runtime_tool_guardrails.lock().await;
            let _ = guardrails.mark_channel_failure(
                "runtime tool guardrail evaluate failed",
                CORE_RUNTIME_METRICS_UNHEALTHY_ERROR_CODE,
            );
            let failure = core_failed_result_with_error_code(
                canonical_skill_id,
                format!("Runtime tool guardrail evaluate failed: {error}"),
                CORE_RUNTIME_METRICS_UNHEALTHY_ERROR_CODE,
                json!({
                    "workspaceId": workspace_id_hint.clone(),
                    "toolName": tool_name,
                    "scope": scope.as_str(),
                    "payloadBytes": payload_bytes,
                }),
            );
            record_core_live_skill_outcome(
                ctx,
                tool_name,
                scope,
                &failure,
                started_at,
                Some(now_ms().saturating_sub(started_at)),
                context,
                failure_workspace_id(&failure, workspace_id_hint.as_deref()).as_deref(),
            )
            .await;
            return Ok(json!(failure));
        }
    };
    if !guardrail_result.allowed {
        let error_code = guardrail_result
            .error_code
            .as_deref()
            .unwrap_or(CORE_VALIDATION_REQUEST_BLOCKED_ERROR_CODE);
        let failure = core_failed_result_with_error_code(
            canonical_skill_id,
            guardrail_result.message.unwrap_or_else(|| {
                format!("Tool `{tool_name}` blocked by runtime guardrail.")
            }),
            error_code,
            json!({
                "workspaceId": workspace_id_hint.clone(),
                "toolName": tool_name,
                "scope": scope.as_str(),
                "payloadBytes": payload_bytes,
            }),
        );
        record_core_live_skill_outcome(
            ctx,
            tool_name,
            scope,
            &failure,
            started_at,
            Some(now_ms().saturating_sub(started_at)),
            context,
            failure_workspace_id(&failure, workspace_id_hint.as_deref()).as_deref(),
        )
        .await;
        return Ok(json!(failure));
    }

    record_core_live_skill_phase_event(
        ctx,
        tool_name,
        scope,
        crate::runtime_tool_metrics::RuntimeToolExecutionEventPhase::Started,
        started_at,
        context,
        workspace_id_hint.as_deref(),
    )
    .await;

    let result = if canonical_skill_id == BUILTIN_LIVE_CORE_GREP_SKILL_ID {
        if let Some(pattern) = resolve_core_grep_pattern(input, options) {
            match validate_core_grep_pattern(pattern) {
                Ok(()) => {
                    let resolved = resolve_workspace_scope(state, options.workspace_id.as_deref()).await;
                    execute_core_grep_skill(resolved.as_ref(), input, options, canonical_skill_id).await
                }
                Err(error) => core_failed_result_with_error_code(
                    canonical_skill_id,
                    error,
                    CORE_VALIDATION_COMMAND_RESTRICTED_ERROR_CODE,
                    json!({ "workspaceId": workspace_id_hint.clone() }),
                ),
            }
        } else {
            let resolved = resolve_workspace_scope(state, options.workspace_id.as_deref()).await;
            execute_core_grep_skill(resolved.as_ref(), input, options, canonical_skill_id).await
        }
    } else if canonical_skill_id == BUILTIN_LIVE_CORE_BASH_SKILL_ID {
        if let Some(command) = resolve_core_shell_command(input, options) {
            match validate_core_shell_command(command) {
                Ok(()) => {
                    let resolved = resolve_workspace_scope(state, options.workspace_id.as_deref()).await;
                    execute_core_bash_skill_with_cancel(
                        config,
                        counters,
                        resolved.as_ref(),
                        input,
                        options,
                        canonical_skill_id,
                        access_mode_hint,
                        cancellation.clone(),
                    )
                    .await
                }
                Err(error) => core_failed_result_with_error_code(
                    canonical_skill_id,
                    error,
                    CORE_VALIDATION_COMMAND_RESTRICTED_ERROR_CODE,
                    json!({ "workspaceId": workspace_id_hint.clone() }),
                ),
            }
        } else {
            core_failed_result_with_error_code(
                canonical_skill_id,
                "command is required for core-bash.".to_string(),
                CORE_VALIDATION_COMMAND_RESTRICTED_ERROR_CODE,
                json!({ "workspaceId": workspace_id_hint.clone() }),
            )
        }
    } else {
        let resolved = resolve_workspace_scope(state, options.workspace_id.as_deref()).await;
        match canonical_skill_id {
            BUILTIN_LIVE_CORE_TREE_SKILL_ID => {
                execute_core_tree_skill(resolved.as_ref(), input, options, canonical_skill_id).await
            }
            BUILTIN_LIVE_CORE_READ_SKILL_ID => {
                execute_core_read_skill(resolved.as_ref(), input, options, canonical_skill_id).await
            }
            BUILTIN_LIVE_CORE_WRITE_SKILL_ID => {
                execute_core_write_skill(resolved.as_ref(), input, options, canonical_skill_id).await
            }
            BUILTIN_LIVE_CORE_EDIT_SKILL_ID => {
                execute_core_edit_skill(resolved.as_ref(), input, options, canonical_skill_id).await
            }
            BUILTIN_LIVE_CORE_JS_REPL_SKILL_ID => {
                execute_core_js_repl_skill_with_cancel(
                    ctx,
                    config,
                    counters,
                    js_repl_sessions,
                    resolved.as_ref(),
                    input,
                    options,
                    canonical_skill_id,
                    access_mode_hint,
                    cancellation,
                )
                .await
            }
            BUILTIN_LIVE_CORE_JS_REPL_RESET_SKILL_ID => {
                execute_core_js_repl_reset_skill(
                    js_repl_sessions,
                    resolved.as_ref(),
                    canonical_skill_id,
                )
                .await
            }
            BUILTIN_LIVE_CORE_DIAGNOSTICS_SKILL_ID => {
                execute_core_diagnostics_skill(resolved.as_ref(), options, canonical_skill_id).await
            }
            BUILTIN_LIVE_CORE_COMPUTER_OBSERVE_SKILL_ID => {
                execute_core_computer_observe_skill(
                    resolved.as_ref(),
                    input,
                    options,
                    canonical_skill_id,
                )
                .await
            }
            _ => core_failed_result(
                canonical_skill_id,
                format!("Unsupported core skill `{canonical_skill_id}`."),
                Value::Null,
            ),
        }
    };

    record_core_live_skill_outcome(
        ctx,
        tool_name,
        scope,
        &result,
        now_ms(),
        Some(now_ms().saturating_sub(started_at)),
        context,
        failure_workspace_id(&result, workspace_id_hint.as_deref()).as_deref(),
    )
    .await;
    Ok(json!(result))
}

#[derive(Debug, Clone)]
struct WorkspaceScope {
    workspace_id: String,
    workspace_path: PathBuf,
}

async fn resolve_workspace_scope(
    state: &SharedRuntimeState,
    requested_workspace_id: Option<&str>,
) -> Result<WorkspaceScope, String> {
    let state_guard = state.read().await;
    let workspace = if let Some(workspace_id) = requested_workspace_id {
        state_guard
            .workspaces
            .iter()
            .find(|entry| entry.id == workspace_id)
    } else {
        state_guard.workspaces.first()
    };
    let Some(workspace) = workspace else {
        return Err("No workspace is available for core live skills.".to_string());
    };

    Ok(WorkspaceScope {
        workspace_id: workspace.id.clone(),
        workspace_path: PathBuf::from(workspace.path.clone()),
    })
}

fn core_completed_result(
    skill_id: &str,
    message: String,
    output: String,
    metadata: Value,
) -> LiveSkillExecutionResult {
    LiveSkillExecutionResult {
        run_id: new_id("live-skill-run"),
        skill_id: skill_id.to_string(),
        status: "completed".to_string(),
        message,
        output,
        network: None,
        artifacts: vec![],
        metadata,
    }
}

fn core_failed_result(
    skill_id: &str,
    message: String,
    metadata: Value,
) -> LiveSkillExecutionResult {
    LiveSkillExecutionResult {
        run_id: new_id("live-skill-run"),
        skill_id: skill_id.to_string(),
        status: "failed".to_string(),
        message,
        output: String::new(),
        network: None,
        artifacts: vec![],
        metadata,
    }
}

const CORE_VALIDATION_PATH_ERROR_CODE: &str = "runtime.validation.path.outside_workspace";
const CORE_VALIDATION_PAYLOAD_TOO_LARGE_ERROR_CODE: &str = "runtime.validation.payload.too_large";
const CORE_VALIDATION_COMMAND_RESTRICTED_ERROR_CODE: &str = "runtime.validation.command.restricted";
const CORE_VALIDATION_REQUEST_BLOCKED_ERROR_CODE: &str = "runtime.validation.request.blocked";
const CORE_RUNTIME_METRICS_UNHEALTHY_ERROR_CODE: &str = "runtime.validation.metrics_unhealthy";
const CORE_SANDBOX_UNAVAILABLE_ERROR_CODE: &str = "runtime.sandbox.unavailable";
const CORE_READ_FILE_NOT_FOUND_ERROR_CODE: &str = "runtime.read.file_not_found";
const CORE_RUNTIME_COMMAND_TIMEOUT_ERROR_CODE: &str = "runtime.exec.timeout";
const CORE_RUNTIME_COMMAND_CANCELLED_ERROR_CODE: &str = "runtime.exec.cancelled";
const CORE_RUNTIME_COMMAND_UNAVAILABLE_ERROR_CODE: &str = "runtime.exec.command_unavailable";
const CORE_RUNTIME_PERMISSION_DENIED_ERROR_CODE: &str = "runtime.exec.permission_denied";
const CORE_RUNTIME_COMMAND_FAILED_ERROR_CODE: &str = "runtime.exec.failed";

fn attach_error_code(metadata: Value, error_code: &str) -> Value {
    match metadata {
        Value::Object(mut object) => {
            object.insert(
                "errorCode".to_string(),
                Value::String(error_code.to_string()),
            );
            Value::Object(object)
        }
        _ => json!({ "errorCode": error_code }),
    }
}

fn core_failed_result_with_error_code(
    skill_id: &str,
    message: String,
    error_code: &str,
    metadata: Value,
) -> LiveSkillExecutionResult {
    core_failed_result(skill_id, message, attach_error_code(metadata, error_code))
}

fn core_live_skill_guardrail_tool_name(canonical_skill_id: &str) -> &str {
    match canonical_skill_id {
        BUILTIN_LIVE_CORE_TREE_SKILL_ID => "inspect-workspace-tree",
        BUILTIN_LIVE_CORE_GREP_SKILL_ID => "search-workspace",
        BUILTIN_LIVE_CORE_READ_SKILL_ID => "read-workspace-file",
        BUILTIN_LIVE_CORE_WRITE_SKILL_ID => "write-workspace-file",
        BUILTIN_LIVE_CORE_EDIT_SKILL_ID => "edit-workspace-file",
        BUILTIN_LIVE_CORE_BASH_SKILL_ID => "execute-workspace-command",
        BUILTIN_LIVE_CORE_JS_REPL_SKILL_ID => "execute-runtime-js-repl",
        BUILTIN_LIVE_CORE_JS_REPL_RESET_SKILL_ID => "reset-runtime-js-repl",
        BUILTIN_LIVE_CORE_DIAGNOSTICS_SKILL_ID => "inspect-workspace-diagnostics",
        BUILTIN_LIVE_CORE_COMPUTER_OBSERVE_SKILL_ID => "inspect-runtime-computer",
        _ => canonical_skill_id,
    }
}

fn core_live_skill_execution_scope(
    canonical_skill_id: &str,
) -> crate::runtime_tool_metrics::RuntimeToolExecutionScope {
    match canonical_skill_id {
        BUILTIN_LIVE_CORE_WRITE_SKILL_ID | BUILTIN_LIVE_CORE_EDIT_SKILL_ID => {
            crate::runtime_tool_metrics::RuntimeToolExecutionScope::Write
        }
        BUILTIN_LIVE_CORE_COMPUTER_OBSERVE_SKILL_ID => {
            crate::runtime_tool_metrics::RuntimeToolExecutionScope::ComputerObserve
        }
        _ => crate::runtime_tool_metrics::RuntimeToolExecutionScope::Runtime,
    }
}

fn core_live_skill_payload_bytes(
    canonical_skill_id: &str,
    input: &str,
    options: &LiveSkillExecuteOptions,
) -> u64 {
    serde_json::to_vec(&json!({
        "skillId": canonical_skill_id,
        "input": input,
        "options": options,
    }))
    .ok()
    .map(|bytes| bytes.len())
    .and_then(|len| u64::try_from(len).ok())
    .unwrap_or(0)
}

fn live_skill_result_error_code(result: &LiveSkillExecutionResult) -> Option<String> {
    result
        .metadata
        .as_object()
        .and_then(|object| object.get("errorCode"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn failure_workspace_id(
    result: &LiveSkillExecutionResult,
    fallback_workspace_id: Option<&str>,
) -> Option<String> {
    result
        .metadata
        .as_object()
        .and_then(|object| object.get("workspaceId"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .or_else(|| fallback_workspace_id.map(str::to_string))
}

fn classify_core_live_skill_execution_outcome(
    result: &LiveSkillExecutionResult,
) -> (
    crate::runtime_tool_metrics::RuntimeToolExecutionStatus,
    Option<String>,
) {
    if result.status == "completed" {
        return (crate::runtime_tool_metrics::RuntimeToolExecutionStatus::Success, None);
    }

    let error_code = live_skill_result_error_code(result);
    let normalized_message = result.message.trim().to_ascii_lowercase();
    let status = match error_code.as_deref() {
        Some(CORE_VALIDATION_REQUEST_BLOCKED_ERROR_CODE) => {
            crate::runtime_tool_metrics::RuntimeToolExecutionStatus::Blocked
        }
        Some(code) if code.starts_with("runtime.validation.") => {
            crate::runtime_tool_metrics::RuntimeToolExecutionStatus::ValidationFailed
        }
        Some(CORE_RUNTIME_COMMAND_TIMEOUT_ERROR_CODE) => {
            crate::runtime_tool_metrics::RuntimeToolExecutionStatus::Timeout
        }
        Some(CORE_RUNTIME_COMMAND_CANCELLED_ERROR_CODE) => {
            crate::runtime_tool_metrics::RuntimeToolExecutionStatus::RuntimeFailed
        }
        _ if normalized_message.contains("timed out") => {
            crate::runtime_tool_metrics::RuntimeToolExecutionStatus::Timeout
        }
        _ => crate::runtime_tool_metrics::RuntimeToolExecutionStatus::RuntimeFailed,
    };

    (status, error_code)
}

async fn record_core_live_skill_phase_event(
    ctx: &AppContext,
    tool_name: &str,
    scope: crate::runtime_tool_metrics::RuntimeToolExecutionScope,
    phase: crate::runtime_tool_metrics::RuntimeToolExecutionEventPhase,
    at: u64,
    context: Option<&LiveSkillExecuteContext>,
    workspace_id: Option<&str>,
) {
    let event = crate::runtime_tool_metrics::RuntimeToolExecutionEvent {
        tool_name: tool_name.to_string(),
        scope,
        phase,
        at,
        status: None,
        error_code: None,
        duration_ms: None,
        trace_id: context.and_then(|value| value.trace_id.clone()),
        span_id: context.and_then(|value| value.span_id.clone()),
        parent_span_id: context.and_then(|value| value.parent_span_id.clone()),
        attempt: context.and_then(|value| value.attempt),
        request_id: context.and_then(|value| value.request_id.clone()),
        planner_step_key: context.and_then(|value| value.planner_step_key.clone()),
        workspace_id: workspace_id.map(str::to_string),
    };
    let mut metrics = ctx.runtime_tool_metrics.lock().await;
    if let Err(error) = metrics.record_events([event].as_slice()) {
        drop(metrics);
        let mut guardrails = ctx.runtime_tool_guardrails.lock().await;
        let _ = guardrails.mark_channel_failure(
            "runtime tool metrics record failed",
            CORE_RUNTIME_METRICS_UNHEALTHY_ERROR_CODE,
        );
        tracing::warn!(
            error = error.as_str(),
            tool_name,
            "record core live skill phase event failed"
        );
    }
}

async fn record_core_live_skill_outcome(
    ctx: &AppContext,
    tool_name: &str,
    scope: crate::runtime_tool_metrics::RuntimeToolExecutionScope,
    result: &LiveSkillExecutionResult,
    at: u64,
    duration_ms: Option<u64>,
    context: Option<&LiveSkillExecuteContext>,
    workspace_id: Option<&str>,
) {
    let (status, error_code) = classify_core_live_skill_execution_outcome(result);
    let event = crate::runtime_tool_metrics::RuntimeToolExecutionEvent {
        tool_name: tool_name.to_string(),
        scope,
        phase: crate::runtime_tool_metrics::RuntimeToolExecutionEventPhase::Completed,
        at,
        status: Some(status),
        error_code: error_code.clone(),
        duration_ms,
        trace_id: context.and_then(|value| value.trace_id.clone()),
        span_id: context.and_then(|value| value.span_id.clone()),
        parent_span_id: context.and_then(|value| value.parent_span_id.clone()),
        attempt: context.and_then(|value| value.attempt),
        request_id: context.and_then(|value| value.request_id.clone()),
        planner_step_key: context.and_then(|value| value.planner_step_key.clone()),
        workspace_id: workspace_id.map(str::to_string),
    };
    {
        let mut metrics = ctx.runtime_tool_metrics.lock().await;
        if let Err(error) = metrics.record_events([event].as_slice()) {
            drop(metrics);
            let mut guardrails = ctx.runtime_tool_guardrails.lock().await;
            let _ = guardrails.mark_channel_failure(
                "runtime tool metrics record failed",
                CORE_RUNTIME_METRICS_UNHEALTHY_ERROR_CODE,
            );
            tracing::warn!(
                error = error.as_str(),
                tool_name,
                "record core live skill completion event failed"
            );
        }
    }

    let outcome_event = crate::runtime_tool_guardrails::RuntimeToolGuardrailOutcomeEvent {
        tool_name: tool_name.to_string(),
        scope,
        status,
        at,
        workspace_id: workspace_id.map(str::to_string),
        duration_ms,
        error_code,
        request_id: context.and_then(|value| value.request_id.clone()),
        trace_id: context.and_then(|value| value.trace_id.clone()),
        span_id: context.and_then(|value| value.span_id.clone()),
        parent_span_id: context.and_then(|value| value.parent_span_id.clone()),
        planner_step_key: context.and_then(|value| value.planner_step_key.clone()),
        attempt: context.and_then(|value| value.attempt),
    };
    let mut guardrails = ctx.runtime_tool_guardrails.lock().await;
    if let Err(error) = guardrails.record_outcome(&outcome_event) {
        let _ = guardrails.mark_channel_failure(
            "runtime tool guardrail outcome persistence failed",
            CORE_RUNTIME_METRICS_UNHEALTHY_ERROR_CODE,
        );
        tracing::warn!(
            error = error.as_str(),
            tool_name,
            "record core live skill guardrail outcome failed"
        );
    }
}

fn resolve_core_target_path(workspace_path: &Path, candidate: &str) -> Result<PathBuf, String> {
    let normalized = candidate.trim();
    if normalized.is_empty() {
        return Err("path is required for this core skill.".to_string());
    }

    let source = Path::new(normalized);
    if source.is_absolute() {
        return Err("absolute path is not allowed; use workspace-relative path.".to_string());
    }

    let mut sanitized = PathBuf::new();
    for component in source.components() {
        match component {
            Component::CurDir => {}
            Component::Normal(segment) => sanitized.push(segment),
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err("path traversal is not allowed.".to_string())
            }
        }
    }

    if sanitized.as_os_str().is_empty() {
        return Err("path is required for this core skill.".to_string());
    }

    Ok(workspace_path.join(sanitized))
}

fn truncate_shell_output(value: &str) -> String {
    truncate_with_ellipsis(value, MAX_CORE_SHELL_OUTPUT_CHARS)
}

async fn read_file_bytes_off_thread(path: &Path) -> Result<Vec<u8>, String> {
    let path = path.to_path_buf();
    tokio::task::spawn_blocking(move || fs::read(path))
        .await
        .map_err(|error| format!("file read task failed: {error}"))?
        .map_err(|error| error.to_string())
}

async fn read_file_to_string_off_thread(path: &Path) -> Result<String, String> {
    let path = path.to_path_buf();
    tokio::task::spawn_blocking(move || fs::read_to_string(path))
        .await
        .map_err(|error| format!("file read task failed: {error}"))?
        .map_err(|error| error.to_string())
}

async fn write_file_off_thread(path: &Path, content: Vec<u8>) -> Result<(), String> {
    let path = path.to_path_buf();
    tokio::task::spawn_blocking(move || fs::write(path, content))
        .await
        .map_err(|error| format!("file write task failed: {error}"))?
        .map_err(|error| error.to_string())
}

async fn create_dir_all_off_thread(path: &Path) -> Result<(), String> {
    let path = path.to_path_buf();
    tokio::task::spawn_blocking(move || fs::create_dir_all(path))
        .await
        .map_err(|error| format!("directory task failed: {error}"))?
        .map_err(|error| error.to_string())
}

async fn read_metadata_off_thread(path: &Path) -> Result<fs::Metadata, String> {
    let path = path.to_path_buf();
    tokio::task::spawn_blocking(move || fs::metadata(path))
        .await
        .map_err(|error| format!("metadata task failed: {error}"))?
        .map_err(|error| error.to_string())
}

async fn read_dir_snapshot_off_thread(path: &Path) -> Result<Vec<(PathBuf, bool)>, String> {
    let path = path.to_path_buf();
    tokio::task::spawn_blocking(move || {
        let mut entries = Vec::new();
        let read_dir = fs::read_dir(path).map_err(|error| error.to_string())?;
        for entry_result in read_dir {
            let entry = entry_result.map_err(|error| error.to_string())?;
            let file_type = entry.file_type().map_err(|error| error.to_string())?;
            entries.push((entry.path(), file_type.is_dir()));
        }
        entries.sort_by(|left, right| left.0.cmp(&right.0));
        Ok::<Vec<(PathBuf, bool)>, String>(entries)
    })
    .await
    .map_err(|error| format!("directory read task failed: {error}"))?
}

async fn execute_core_tree_skill(
    resolved_scope: Result<&WorkspaceScope, &String>,
    input: &str,
    options: &LiveSkillExecuteOptions,
    skill_id: &str,
) -> LiveSkillExecutionResult {
    let scope = match resolved_scope {
        Ok(scope) => scope,
        Err(error) => return core_failed_result(skill_id, error.clone(), Value::Null),
    };

    let raw_input = input.trim();
    let candidate_path = options.path.as_deref().or_else(|| {
        if raw_input.is_empty() {
            None
        } else {
            Some(raw_input)
        }
    });
    let target = match candidate_path {
        Some(".") | None => scope.workspace_path.clone(),
        Some(path) => match resolve_core_target_path(scope.workspace_path.as_path(), path) {
            Ok(target) => target,
            Err(error) => {
                return core_failed_result_with_error_code(
                    skill_id,
                    error,
                    CORE_VALIDATION_PATH_ERROR_CODE,
                    json!({ "workspaceId": scope.workspace_id }),
                )
            }
        },
    };

    let target_metadata = match read_metadata_off_thread(target.as_path()).await {
        Ok(metadata) => metadata,
        Err(error) => {
            return core_failed_result(
                skill_id,
                format!("Failed to inspect `{}`: {error}", target.display()),
                json!({ "workspaceId": scope.workspace_id }),
            )
        }
    };

    let max_entries = normalize_optional_usize(
        options.max_results,
        DEFAULT_CORE_TREE_MAX_ENTRIES,
        1,
        MAX_CORE_TREE_MAX_ENTRIES,
    );
    let max_depth = normalize_optional_usize(
        options.max_depth,
        DEFAULT_CORE_TREE_MAX_DEPTH,
        0,
        MAX_CORE_TREE_MAX_DEPTH,
    );
    let include_hidden = options.include_hidden.unwrap_or(false);
    let query = options
        .query
        .as_ref()
        .map(|value| value.trim().to_ascii_lowercase())
        .filter(|value| !value.is_empty());

    let mut queue = VecDeque::from([(target.clone(), 0usize)]);
    let mut listed = Vec::new();
    let mut dirs_scanned = 0usize;
    let mut files_scanned = 0usize;
    let mut truncated = false;

    while let Some((current, depth)) = queue.pop_front() {
        let relative = current
            .strip_prefix(scope.workspace_path.as_path())
            .unwrap_or(current.as_path())
            .display()
            .to_string();
        let line = if relative.is_empty() || relative == "." {
            "./".to_string()
        } else if current.is_dir() {
            format!("{relative}/")
        } else {
            relative
        };

        let matched = match query.as_ref() {
            Some(pattern) => line.to_ascii_lowercase().contains(pattern),
            None => true,
        };
        if matched {
            listed.push(line);
            if listed.len() >= max_entries {
                truncated = true;
                break;
            }
        }

        if current.is_file() {
            files_scanned += 1;
            continue;
        }
        if !current.is_dir() {
            continue;
        }
        dirs_scanned += 1;
        if depth >= max_depth {
            continue;
        }

        let children = match read_dir_snapshot_off_thread(current.as_path()).await {
            Ok(children) => children,
            Err(error) => {
                return core_failed_result(
                    skill_id,
                    format!("Failed to list `{}`: {error}", current.display()),
                    json!({ "workspaceId": scope.workspace_id }),
                );
            }
        };
        for (child_path, _child_is_dir) in children {
            if !include_hidden {
                let hidden = child_path
                    .file_name()
                    .and_then(|value| value.to_str())
                    .map(|value| value.starts_with('.'))
                    .unwrap_or(false);
                if hidden {
                    continue;
                }
            }
            queue.push_back((child_path, depth + 1));
        }
    }

    let output = listed.join("\n");
    let message = if target_metadata.is_file() {
        format!("Listed file `{}`.", target.display())
    } else if truncated {
        format!(
            "Listed first {} path(s) under `{}` (truncated).",
            listed.len(),
            target.display()
        )
    } else {
        format!(
            "Listed {} path(s) under `{}`.",
            listed.len(),
            target.display()
        )
    };

    core_completed_result(
        skill_id,
        message,
        output,
        json!({
            "workspaceId": scope.workspace_id,
            "path": target.display().to_string(),
            "maxDepth": max_depth,
            "maxEntries": max_entries,
            "includeHidden": include_hidden,
            "query": query,
            "dirsScanned": dirs_scanned,
            "filesScanned": files_scanned,
            "listedCount": listed.len(),
            "truncated": truncated,
        }),
    )
}

async fn execute_core_read_skill(
    resolved_scope: Result<&WorkspaceScope, &String>,
    input: &str,
    options: &LiveSkillExecuteOptions,
    skill_id: &str,
) -> LiveSkillExecutionResult {
    let scope = match resolved_scope {
        Ok(scope) => scope,
        Err(error) => return core_failed_result(skill_id, error.clone(), Value::Null),
    };
    let candidate_path = options
        .path
        .as_deref()
        .or_else(|| {
            let trimmed = input.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed)
            }
        })
        .unwrap_or_default();
    let target = match resolve_core_target_path(scope.workspace_path.as_path(), candidate_path) {
        Ok(target) => target,
        Err(error) => {
            return core_failed_result_with_error_code(
                skill_id,
                error,
                CORE_VALIDATION_PATH_ERROR_CODE,
                json!({ "workspaceId": scope.workspace_id }),
            )
        }
    };
    if !target.exists() {
        return core_failed_result_with_error_code(
            skill_id,
            format!("File `{}` does not exist.", target.display()),
            CORE_READ_FILE_NOT_FOUND_ERROR_CODE,
            json!({
                "workspaceId": scope.workspace_id,
                "path": target.display().to_string(),
            }),
        );
    }
    let payload = match read_file_bytes_off_thread(target.as_path()).await {
        Ok(payload) => payload,
        Err(error) => {
            return core_failed_result(
                skill_id,
                format!("Failed to read `{}`: {error}", target.display()),
                json!({ "workspaceId": scope.workspace_id }),
            )
        }
    };
    if payload.len() > MAX_CORE_FILE_BYTES {
        return core_failed_result_with_error_code(
            skill_id,
            format!(
                "File `{}` exceeds max readable size {} bytes.",
                target.display(),
                MAX_CORE_FILE_BYTES
            ),
            CORE_VALIDATION_PAYLOAD_TOO_LARGE_ERROR_CODE,
            json!({ "workspaceId": scope.workspace_id }),
        );
    }
    let content = String::from_utf8_lossy(payload.as_slice()).to_string();
    core_completed_result(
        skill_id,
        format!("Read `{}`.", target.display()),
        content.clone(),
        json!({
            "workspaceId": scope.workspace_id,
            "path": target.display().to_string(),
            "bytes": payload.len(),
            "truncated": false
        }),
    )
}

async fn execute_core_write_skill(
    resolved_scope: Result<&WorkspaceScope, &String>,
    input: &str,
    options: &LiveSkillExecuteOptions,
    skill_id: &str,
) -> LiveSkillExecutionResult {
    let scope = match resolved_scope {
        Ok(scope) => scope,
        Err(error) => return core_failed_result(skill_id, error.clone(), Value::Null),
    };
    let candidate_path = options.path.as_deref().unwrap_or_default();
    let target = match resolve_core_target_path(scope.workspace_path.as_path(), candidate_path) {
        Ok(target) => target,
        Err(error) => {
            return core_failed_result_with_error_code(
                skill_id,
                error,
                CORE_VALIDATION_PATH_ERROR_CODE,
                json!({ "workspaceId": scope.workspace_id }),
            )
        }
    };

    let content = options
        .content
        .as_deref()
        .map(str::to_string)
        .unwrap_or_else(|| input.to_string());
    if content.as_bytes().len() > MAX_CORE_FILE_BYTES {
        return core_failed_result_with_error_code(
            skill_id,
            format!(
                "Write content exceeds max size {} bytes.",
                MAX_CORE_FILE_BYTES
            ),
            CORE_VALIDATION_PAYLOAD_TOO_LARGE_ERROR_CODE,
            json!({ "workspaceId": scope.workspace_id }),
        );
    }

    if let Some(parent) = target.parent() {
        if let Err(error) = create_dir_all_off_thread(parent).await {
            return core_failed_result(
                skill_id,
                format!(
                    "Failed to prepare parent directory for `{}`: {error}",
                    target.display()
                ),
                json!({ "workspaceId": scope.workspace_id }),
            );
        }
    }

    if let Err(error) = write_file_off_thread(target.as_path(), content.as_bytes().to_vec()).await {
        return core_failed_result(
            skill_id,
            format!("Failed to write `{}`: {error}", target.display()),
            json!({ "workspaceId": scope.workspace_id }),
        );
    }

    core_completed_result(
        skill_id,
        format!("Wrote `{}`.", target.display()),
        String::new(),
        json!({
            "workspaceId": scope.workspace_id,
            "path": target.display().to_string(),
            "bytes": content.as_bytes().len()
        }),
    )
}

async fn execute_core_edit_skill(
    resolved_scope: Result<&WorkspaceScope, &String>,
    input: &str,
    options: &LiveSkillExecuteOptions,
    skill_id: &str,
) -> LiveSkillExecutionResult {
    let scope = match resolved_scope {
        Ok(scope) => scope,
        Err(error) => return core_failed_result(skill_id, error.clone(), Value::Null),
    };
    let candidate_path = options.path.as_deref().unwrap_or_default();
    let target = match resolve_core_target_path(scope.workspace_path.as_path(), candidate_path) {
        Ok(target) => target,
        Err(error) => {
            return core_failed_result_with_error_code(
                skill_id,
                error,
                CORE_VALIDATION_PATH_ERROR_CODE,
                json!({ "workspaceId": scope.workspace_id }),
            )
        }
    };

    let find = options.find.as_deref().unwrap_or_default();
    let replace = options
        .replace
        .as_deref()
        .or_else(|| {
            let trimmed = input.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed)
            }
        })
        .unwrap_or_default();
    if find.trim().is_empty() {
        return core_failed_result(
            skill_id,
            "Field `find` must not be empty for core-edit.".to_string(),
            json!({ "workspaceId": scope.workspace_id }),
        );
    }

    let original = match read_file_to_string_off_thread(target.as_path()).await {
        Ok(content) => content,
        Err(error) => {
            return core_failed_result(
                skill_id,
                format!("Failed to read `{}` for edit: {error}", target.display()),
                json!({ "workspaceId": scope.workspace_id }),
            )
        }
    };
    let replacements = original.matches(find).count();
    if replacements == 0 {
        return core_failed_result(
            skill_id,
            format!("No matches found for `{find}` in `{}`.", target.display()),
            json!({ "workspaceId": scope.workspace_id }),
        );
    }
    let next = original.replace(find, replace);
    if next.as_bytes().len() > MAX_CORE_FILE_BYTES {
        return core_failed_result_with_error_code(
            skill_id,
            format!(
                "Edited content exceeds max size {} bytes.",
                MAX_CORE_FILE_BYTES
            ),
            CORE_VALIDATION_PAYLOAD_TOO_LARGE_ERROR_CODE,
            json!({ "workspaceId": scope.workspace_id }),
        );
    }
    if let Err(error) = write_file_off_thread(target.as_path(), next.as_bytes().to_vec()).await {
        return core_failed_result(
            skill_id,
            format!(
                "Failed to write edited content to `{}`: {error}",
                target.display()
            ),
            json!({ "workspaceId": scope.workspace_id }),
        );
    }

    core_completed_result(
        skill_id,
        format!(
            "Edited `{}` with {} replacement(s).",
            target.display(),
            replacements
        ),
        String::new(),
        json!({
            "workspaceId": scope.workspace_id,
            "path": target.display().to_string(),
            "replacements": replacements
        }),
    )
}
