use super::*;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum RuntimePolicyMode {
    Strict,
    Balanced,
    Aggressive,
}

impl RuntimePolicyMode {
    fn as_str(self) -> &'static str {
        match self {
            Self::Strict => "strict",
            Self::Balanced => "balanced",
            Self::Aggressive => "aggressive",
        }
    }
}

fn parse_runtime_policy_mode(value: &str) -> Option<RuntimePolicyMode> {
    match value.trim().to_ascii_lowercase().as_str() {
        "strict" => Some(RuntimePolicyMode::Strict),
        "balanced" => Some(RuntimePolicyMode::Balanced),
        "aggressive" => Some(RuntimePolicyMode::Aggressive),
        _ => None,
    }
}

fn read_runtime_policy_mode_from_state(mode: &str) -> RuntimePolicyMode {
    parse_runtime_policy_mode(mode).unwrap_or(RuntimePolicyMode::Strict)
}

fn parse_runtime_tool_scope(
    value: Option<&str>,
) -> runtime_tool_metrics::RuntimeToolExecutionScope {
    match value
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .unwrap_or("runtime")
    {
        "write" => runtime_tool_metrics::RuntimeToolExecutionScope::Write,
        "computer_observe" => runtime_tool_metrics::RuntimeToolExecutionScope::ComputerObserve,
        _ => runtime_tool_metrics::RuntimeToolExecutionScope::Runtime,
    }
}

fn classify_tool_risk_level(
    tool_name: &str,
    scope: runtime_tool_metrics::RuntimeToolExecutionScope,
) -> &'static str {
    let normalized = tool_name.trim().to_ascii_lowercase();
    if normalized.contains("rm ")
        || normalized.contains("rm -")
        || normalized.contains("chmod")
        || normalized.contains("chown")
        || normalized.contains("revert")
        || normalized.contains("commit")
    {
        return "critical";
    }
    match scope {
        runtime_tool_metrics::RuntimeToolExecutionScope::Write => "high",
        runtime_tool_metrics::RuntimeToolExecutionScope::ComputerObserve => "medium",
        runtime_tool_metrics::RuntimeToolExecutionScope::Runtime => {
            if normalized.contains("bash")
                || normalized.contains("shell")
                || normalized.contains("exec")
                || normalized.contains("js_repl")
                || normalized.contains("js-repl")
                || normalized.contains("javascript")
            {
                "high"
            } else {
                "low"
            }
        }
    }
}

fn resolve_preflight_action(mode: RuntimePolicyMode, risk_level: &str) -> (&'static str, bool) {
    match mode {
        RuntimePolicyMode::Strict => match risk_level {
            "low" => ("allow", false),
            "medium" | "high" => ("require_approval", true),
            _ => ("deny", false),
        },
        RuntimePolicyMode::Balanced => match risk_level {
            "low" | "medium" => ("allow", false),
            "high" => ("require_approval", true),
            _ => ("deny", false),
        },
        RuntimePolicyMode::Aggressive => match risk_level {
            "critical" => ("require_approval", true),
            _ => ("allow", false),
        },
    }
}

fn payload_bytes_from_params(params: &serde_json::Map<String, Value>) -> u64 {
    if let Some(bytes) = read_optional_u64(params, "payloadBytes") {
        return bytes;
    }
    params
        .get("payload")
        .and_then(|payload| serde_json::to_vec(payload).ok())
        .map(|bytes| bytes.len())
        .and_then(|len| u64::try_from(len).ok())
        .unwrap_or(0)
}

fn runtime_policy_mode_label(mode: RuntimePolicyMode) -> &'static str {
    match mode {
        RuntimePolicyMode::Strict => "Strict",
        RuntimePolicyMode::Balanced => "Balanced",
        RuntimePolicyMode::Aggressive => "Aggressive",
    }
}

fn runtime_policy_computer_observe_enabled() -> bool {
    match std::env::var("KU0_ENABLE_COMPUTER_OBSERVE") {
        Ok(value) => matches!(
            value.trim().to_ascii_lowercase().as_str(),
            "1" | "true" | "yes" | "on"
        ),
        Err(_) => false,
    }
}

fn build_runtime_policy_capability(
    capability_id: &str,
    label: &str,
    readiness: &str,
    effect: &str,
    active_constraint: bool,
    summary: String,
    detail: Option<String>,
) -> Value {
    json!({
        "capabilityId": capability_id,
        "label": label,
        "readiness": readiness,
        "effect": effect,
        "activeConstraint": active_constraint,
        "summary": summary,
        "detail": detail,
    })
}

fn build_runtime_policy_state(
    mode: RuntimePolicyMode,
    guardrails: &runtime_tool_guardrails::RuntimeToolGuardrailStateSnapshot,
    network_enabled: bool,
    computer_observe_enabled: bool,
) -> Value {
    let channel_detail = guardrails
        .channel_health
        .reason
        .as_ref()
        .map(|reason| reason.trim().to_string())
        .filter(|reason| !reason.is_empty());
    let guardrail_channel = match guardrails.channel_health.status {
        runtime_tool_domain::RuntimeToolExecutionChannelHealthStatus::Healthy => {
            build_runtime_policy_capability(
                "guardrail_channel",
                "Guardrail channel",
                "ready",
                "allow",
                false,
                "Runtime guardrail channel is healthy.".to_string(),
                channel_detail,
            )
        }
        runtime_tool_domain::RuntimeToolExecutionChannelHealthStatus::Degraded => {
            build_runtime_policy_capability(
                "guardrail_channel",
                "Guardrail channel",
                "attention",
                "restricted",
                true,
                "Runtime guardrail channel is degraded and may constrain policy enforcement."
                    .to_string(),
                channel_detail,
            )
        }
        runtime_tool_domain::RuntimeToolExecutionChannelHealthStatus::Unavailable => {
            build_runtime_policy_capability(
                "guardrail_channel",
                "Guardrail channel",
                "blocked",
                "blocked",
                true,
                "Runtime guardrail channel is unavailable; policy-backed preflight is blocked."
                    .to_string(),
                channel_detail,
            )
        }
    };

    let tool_preflight = match mode {
        RuntimePolicyMode::Strict => build_runtime_policy_capability(
            "tool_preflight",
            "Tool preflight",
            "attention",
            "approval",
            true,
            "Strict mode gates medium and high-risk actions and denies critical tools."
                .to_string(),
            Some("Operator approval is required before risky tool execution can continue.".to_string()),
        ),
        RuntimePolicyMode::Balanced => build_runtime_policy_capability(
            "tool_preflight",
            "Tool preflight",
            "ready",
            "approval",
            false,
            "Balanced mode allows standard execution and escalates only high-risk actions."
                .to_string(),
            Some("Critical actions remain denied and high-risk actions still require approval.".to_string()),
        ),
        RuntimePolicyMode::Aggressive => build_runtime_policy_capability(
            "tool_preflight",
            "Tool preflight",
            "ready",
            "allow",
            false,
            "Aggressive mode keeps runtime execution open for most tools.".to_string(),
            Some("Only critical actions still require approval.".to_string()),
        ),
    };

    let network_analysis = if network_enabled {
        build_runtime_policy_capability(
            "network_analysis",
            "Network analysis",
            "ready",
            "allow",
            false,
            "Network-backed analysis is available to the runtime.".to_string(),
            None,
        )
    } else {
        build_runtime_policy_capability(
            "network_analysis",
            "Network analysis",
            "attention",
            "blocked",
            true,
            "Network-backed analysis is disabled by runtime policy.".to_string(),
            Some("Enable live-skills network access to restore remote search and fetch paths.".to_string()),
        )
    };

    let research_orchestration = if network_enabled {
        build_runtime_policy_capability(
            "research_orchestration",
            "Research orchestration",
            "ready",
            "allow",
            false,
            "Research orchestration can request network-backed evidence collection.".to_string(),
            None,
        )
    } else {
        build_runtime_policy_capability(
            "research_orchestration",
            "Research orchestration",
            "attention",
            "blocked",
            true,
            "Research orchestration is disabled because network access is blocked by policy."
                .to_string(),
            Some("Mission Control should treat research follow-up as unavailable until policy changes.".to_string()),
        )
    };

    let computer_observe = if computer_observe_enabled {
        build_runtime_policy_capability(
            "computer_observe",
            "Computer observe",
            "ready",
            "allow",
            false,
            "Computer observe is available in read-only mode.".to_string(),
            None,
        )
    } else {
        build_runtime_policy_capability(
            "computer_observe",
            "Computer observe",
            "attention",
            "blocked",
            true,
            "Computer observe is disabled by runtime policy.".to_string(),
            Some("Set KU0_ENABLE_COMPUTER_OBSERVE to restore read-only observation support.".to_string()),
        )
    };

    let capabilities = vec![
        guardrail_channel,
        tool_preflight,
        network_analysis,
        research_orchestration,
        computer_observe,
    ];
    let active_constraint_count = capabilities
        .iter()
        .filter(|entry| {
            entry.get("activeConstraint")
                .and_then(Value::as_bool)
                .unwrap_or(false)
        })
        .count();
    let blocked_capability_count = capabilities
        .iter()
        .filter(|entry| entry.get("effect").and_then(Value::as_str) == Some("blocked"))
        .count();
    let readiness = if capabilities
        .iter()
        .any(|entry| entry.get("readiness").and_then(Value::as_str) == Some("blocked"))
    {
        "blocked"
    } else if active_constraint_count > 0 {
        "attention"
    } else {
        "ready"
    };
    let mode_label = runtime_policy_mode_label(mode);
    let summary = match readiness {
        "blocked" => format!(
            "Runtime policy is blocked in {mode_label} mode. Repair the guardrail channel before continuing."
        ),
        "attention" => format!(
            "Runtime policy is active in {mode_label} mode with {active_constraint_count} operator-visible constraint{}.",
            if active_constraint_count == 1 { "" } else { "s" }
        ),
        _ => format!(
            "Runtime policy is ready in {mode_label} mode for standard mission control operations."
        ),
    };

    json!({
        "readiness": readiness,
        "summary": summary,
        "activeConstraintCount": active_constraint_count,
        "blockedCapabilityCount": blocked_capability_count,
        "capabilities": capabilities,
    })
}

pub(super) async fn handle_runtime_tool_preflight_v2(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let tool_name = read_required_string(params, "toolName")?;
    let scope = parse_runtime_tool_scope(read_optional_string(params, "scope").as_deref());
    let payload_bytes = payload_bytes_from_params(params);
    let workspace_id = read_optional_string(params, "workspaceId");
    let policy_mode = {
        let state = ctx.state.read().await;
        read_runtime_policy_mode_from_state(state.runtime_policy_mode.as_str())
    };
    let risk_level = classify_tool_risk_level(tool_name, scope);
    let (mut action, mut requires_approval) = resolve_preflight_action(policy_mode, risk_level);
    let mut guardrail_result: Option<runtime_tool_guardrails::RuntimeToolGuardrailEvaluateResult> =
        None;
    let mut error_code: Option<String> = None;
    let mut message: Option<String> = None;

    if action != "deny" {
        let request = runtime_tool_guardrails::RuntimeToolGuardrailEvaluateRequest {
            tool_name: tool_name.to_string(),
            scope,
            workspace_id,
            payload_bytes,
            at: read_optional_u64(params, "at"),
            request_id: read_optional_string(params, "requestId"),
            trace_id: read_optional_string(params, "traceId"),
            span_id: read_optional_string(params, "spanId"),
            parent_span_id: read_optional_string(params, "parentSpanId"),
            planner_step_key: read_optional_string(params, "plannerStepKey"),
            attempt: read_optional_u64(params, "attempt")
                .and_then(|value| u32::try_from(value).ok()),
            capability_profile:
                runtime_tool_guardrails::RuntimeToolGuardrailCapabilityProfile::default(),
        };
        let mut guardrails = ctx.runtime_tool_guardrails.lock().await;
        let evaluated = guardrails.evaluate(&request).map_err(RpcError::internal)?;
        if !evaluated.allowed {
            action = "deny";
            requires_approval = false;
            error_code = evaluated.error_code.clone();
            message = evaluated.message.clone();
        }
        guardrail_result = Some(evaluated);
    } else {
        error_code = Some("runtime.policy.denied".to_string());
        message = Some("Tool preflight denied by strict runtime policy.".to_string());
    }

    Ok(json!({
        "action": action,
        "riskLevel": risk_level,
        "requiresApproval": requires_approval,
        "policyMode": policy_mode.as_str(),
        "errorCode": error_code,
        "message": message,
        "guardrail": guardrail_result,
    }))
}

pub(super) async fn handle_action_required_submit_v2(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let request_id = read_required_string(params, "requestId")?;
    let status = read_required_string(params, "status")?
        .trim()
        .to_ascii_lowercase();
    let kind = read_optional_string(params, "kind")
        .unwrap_or_else(|| "approval".to_string())
        .trim()
        .to_ascii_lowercase();
    if kind == "review_decision" {
        let decision = match status.as_str() {
            "approved" => ("accepted", "Accepted in review"),
            "rejected" => ("rejected", "Rejected in review"),
            "submitted" => {
                return Err(RpcError::invalid_params(
                    "status=submitted is not a terminal review decision.",
                ))
            }
            _ => {
                return Err(RpcError::invalid_params(
                    "review_decision status must be approved or rejected.",
                ))
            }
        };
        let task_id = request_id
            .strip_prefix("review-pack:")
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| {
                RpcError::invalid_params(
                    "review_decision requestId must target a review-pack:<task-id>.",
                )
            })?
            .to_string();
        let reason = read_optional_string(params, "reason")
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| {
                if decision.0 == "accepted" {
                    "Result accepted from the review surface.".to_string()
                } else {
                    "Result rejected from the review surface.".to_string()
                }
            });
        let mut store = ctx.agent_tasks.write().await;
        let Some(task) = store.tasks.get_mut(task_id.as_str()) else {
            return Err(RpcError::invalid_params(
                "review-pack target was not found.",
            ));
        };
        if !matches!(
            task.summary.status.as_str(),
            "completed" | "failed" | "cancelled" | "interrupted"
        ) {
            return Err(RpcError::invalid_params(
                "review-pack target is not in a terminal review state.",
            ));
        }
        if let Some(existing) = task.summary.review_decision.as_ref() {
            if existing.status != decision.0 {
                return Err(RpcError::invalid_params(
                    "review decision has already been recorded for this pack.",
                ));
            }
        }
        task.summary.review_decision = Some(ReviewDecisionSummary {
            status: decision.0.to_string(),
            review_pack_id: request_id.to_string(),
            label: decision.1.to_string(),
            summary: reason,
            decided_at: Some(now_ms()),
        });
        task.summary.updated_at = now_ms();
        let summary_snapshot = task.summary.clone();
        let checkpoint_id = checkpoint_agent_task_runtime(ctx, task, "review_decision");
        if let Some(checkpoint_id_value) = checkpoint_id {
            task.checkpoint_id = Some(checkpoint_id_value);
        }
        drop(store);

        if ctx.distributed_config.enabled {
            if let Err(error) = persist_distributed_task_summary(ctx, &summary_snapshot).await {
                warn!(
                    error = error.as_str(),
                    task_id = summary_snapshot.task_id.as_str(),
                    "failed to persist distributed task summary after review decision"
                );
                set_distributed_dispatch_error(ctx, DISTRIBUTED_ERROR_SOURCE_STATE_SYNC, error)
                    .await;
            } else {
                clear_distributed_dispatch_error(ctx, DISTRIBUTED_ERROR_SOURCE_STATE_SYNC).await;
            }
        }

        return Ok(json!(status));
    }
    if kind != "approval" {
        return Err(RpcError::invalid_params(
            "Only approval and review_decision action-required submissions are supported.",
        ));
    }
    let decision = match status.as_str() {
        "approved" => "approved",
        "rejected" | "timeout" | "cancelled" | "error" => "rejected",
        "submitted" => {
            return Err(RpcError::invalid_params(
                "status=submitted is not a terminal submission decision.",
            ))
        }
        _ => {
            return Err(RpcError::invalid_params(
                "status must be one of submitted|approved|rejected|timeout|cancelled|error.",
            ))
        }
    };
    let reason = read_optional_string(params, "reason");
    handle_agent_approval_decision(
        ctx,
        &json!({
            "approvalId": request_id,
            "decision": decision,
            "reason": reason,
        }),
    )
    .await?;
    Ok(json!(status))
}

pub(super) async fn handle_action_required_get_v2(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let request_id = read_required_string(params, "requestId")?;
    let store = ctx.agent_tasks.read().await;
    let task_id = store.approval_index.get(request_id).cloned();
    let Some(task_id) = task_id else {
        return Ok(Value::Null);
    };
    let Some(task) = store.tasks.get(task_id.as_str()) else {
        return Ok(Value::Null);
    };
    let Some(pending) = task
        .summary
        .pending_approval
        .as_ref()
        .filter(|entry| entry.approval_id == request_id)
    else {
        return Ok(Value::Null);
    };
    let status = match pending.decision.as_deref() {
        Some("approved") => "approved",
        Some("rejected") => "rejected",
        Some("timeout") => "timeout",
        Some("cancelled") => "cancelled",
        Some("error") => "error",
        _ => "submitted",
    };
    Ok(json!({
        "requestId": pending.approval_id,
        "kind": "approval",
        "status": status,
        "action": pending.action,
        "reason": pending.reason,
        "input": pending.input,
        "createdAt": pending.created_at,
        "decidedAt": pending.decided_at,
        "decisionReason": pending.decision_reason,
    }))
}

fn map_tool_execution_outcome_to_status(
    value: &str,
) -> Result<runtime_tool_metrics::RuntimeToolExecutionStatus, RpcError> {
    match value.trim().to_ascii_lowercase().as_str() {
        "success" => Ok(runtime_tool_metrics::RuntimeToolExecutionStatus::Success),
        "failed" | "interrupted" => {
            Ok(runtime_tool_metrics::RuntimeToolExecutionStatus::RuntimeFailed)
        }
        "timeout" => Ok(runtime_tool_metrics::RuntimeToolExecutionStatus::Timeout),
        "guardrail_blocked" => Ok(runtime_tool_metrics::RuntimeToolExecutionStatus::Blocked),
        _ => Err(RpcError::invalid_params(
            "outcome must be one of success|failed|interrupted|timeout|guardrail_blocked.",
        )),
    }
}

pub(super) async fn handle_runtime_tool_outcome_record_v2(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let tool_name = read_required_string(params, "toolName")?.to_string();
    let scope = parse_runtime_tool_scope(read_optional_string(params, "scope").as_deref());
    let at = read_optional_u64(params, "at").unwrap_or_else(now_ms);
    let status = map_tool_execution_outcome_to_status(read_required_string(params, "outcome")?)?;
    let workspace_id = read_optional_string(params, "workspaceId");
    let request_id = read_optional_string(params, "requestId");
    let trace_id = read_optional_string(params, "traceId");
    let span_id = read_optional_string(params, "spanId");
    let parent_span_id = read_optional_string(params, "parentSpanId");
    let planner_step_key = read_optional_string(params, "plannerStepKey");
    let attempt = read_optional_u64(params, "attempt").and_then(|value| u32::try_from(value).ok());
    let duration_ms = read_optional_u64(params, "durationMs");
    let error_code = read_optional_string(params, "errorCode");

    let completed_event = runtime_tool_metrics::RuntimeToolExecutionEvent {
        tool_name: tool_name.clone(),
        scope,
        phase: runtime_tool_metrics::RuntimeToolExecutionEventPhase::Completed,
        at,
        status: Some(status),
        error_code: error_code.clone(),
        duration_ms,
        trace_id: trace_id.clone(),
        span_id: span_id.clone(),
        parent_span_id: parent_span_id.clone(),
        attempt,
        request_id: request_id.clone(),
        planner_step_key: planner_step_key.clone(),
        workspace_id: workspace_id.clone(),
    };
    {
        let mut metrics = ctx.runtime_tool_metrics.lock().await;
        metrics
            .record_events([completed_event].as_slice())
            .map_err(RpcError::internal)?;
    }
    let outcome_event = runtime_tool_guardrails::RuntimeToolGuardrailOutcomeEvent {
        tool_name,
        scope,
        status,
        at,
        workspace_id,
        duration_ms,
        error_code,
        request_id,
        trace_id,
        span_id,
        parent_span_id,
        planner_step_key,
        attempt,
    };
    {
        let mut guardrails = ctx.runtime_tool_guardrails.lock().await;
        guardrails
            .record_outcome(&outcome_event)
            .map_err(RpcError::internal)?;
    }
    Ok(json!(true))
}

pub(super) async fn handle_runtime_policy_get_v2(ctx: &AppContext) -> Result<Value, RpcError> {
    let state = ctx.state.read().await;
    let mode = read_runtime_policy_mode_from_state(state.runtime_policy_mode.as_str());
    let updated_at = state.runtime_policy_updated_at;
    drop(state);
    let guardrail_snapshot = {
        let guardrails = ctx.runtime_tool_guardrails.lock().await;
        guardrails.read_snapshot()
    };
    Ok(json!({
        "mode": mode.as_str(),
        "updatedAt": updated_at,
        "state": build_runtime_policy_state(
            mode,
            &guardrail_snapshot,
            ctx.config.live_skills_network_enabled,
            runtime_policy_computer_observe_enabled(),
        ),
    }))
}

pub(super) async fn handle_runtime_policy_set_v2(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let requested_mode = read_required_string(params, "mode")?;
    let mode = parse_runtime_policy_mode(requested_mode).ok_or_else(|| {
        RpcError::invalid_params("mode must be one of strict|balanced|aggressive.")
    })?;
    let updated_at = now_ms();
    {
        let mut state = ctx.state.write().await;
        state.runtime_policy_mode = mode.as_str().to_string();
        state.runtime_policy_updated_at = updated_at;
    }
    let guardrail_snapshot = {
        let guardrails = ctx.runtime_tool_guardrails.lock().await;
        guardrails.read_snapshot()
    };
    Ok(json!({
        "mode": mode.as_str(),
        "updatedAt": updated_at,
        "state": build_runtime_policy_state(
            mode,
            &guardrail_snapshot,
            ctx.config.live_skills_network_enabled,
            runtime_policy_computer_observe_enabled(),
        ),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        build_app_context, create_initial_state, native_state_store, ServiceConfig,
        DEFAULT_AGENT_MAX_CONCURRENT_TASKS, DEFAULT_AGENT_TASK_HISTORY_LIMIT,
        DEFAULT_ANTHROPIC_ENDPOINT, DEFAULT_ANTHROPIC_VERSION,
        DEFAULT_DISCOVERY_BROWSE_INTERVAL_MS, DEFAULT_DISCOVERY_SERVICE_TYPE,
        DEFAULT_DISCOVERY_STALE_TTL_MS, DEFAULT_GEMINI_ENDPOINT,
        DEFAULT_LIVE_SKILLS_NETWORK_BASE_URL, DEFAULT_LIVE_SKILLS_NETWORK_CACHE_TTL_MS,
        DEFAULT_LIVE_SKILLS_NETWORK_TIMEOUT_MS, DEFAULT_OAUTH_LOOPBACK_CALLBACK_PORT,
        DEFAULT_OPENAI_COMPAT_MODEL_CACHE_TTL_MS, DEFAULT_OPENAI_MAX_RETRIES,
        DEFAULT_OPENAI_RETRY_BASE_MS, DEFAULT_OPENAI_TIMEOUT_MS,
        DEFAULT_RUNTIME_WS_MAX_CONNECTIONS, DEFAULT_RUNTIME_WS_MAX_FRAME_SIZE_BYTES,
        DEFAULT_RUNTIME_WS_MAX_MESSAGE_SIZE_BYTES, DEFAULT_RUNTIME_WS_MAX_WRITE_BUFFER_SIZE_BYTES,
        DEFAULT_RUNTIME_WS_WRITE_BUFFER_SIZE_BYTES, DEFAULT_SANDBOX_NETWORK_ACCESS,
    };
    use std::sync::Arc;

    fn runtime_policy_test_config() -> ServiceConfig {
        ServiceConfig {
            default_model_id: "gpt-5.4".to_string(),
            openai_api_key: Some("test-openai-key".to_string()),
            openai_endpoint: "https://api.openai.com/v1/responses".to_string(),
            openai_compat_base_url: None,
            openai_compat_api_key: None,
            anthropic_api_key: None,
            anthropic_endpoint: DEFAULT_ANTHROPIC_ENDPOINT.to_string(),
            anthropic_version: DEFAULT_ANTHROPIC_VERSION.to_string(),
            gemini_api_key: None,
            gemini_endpoint: DEFAULT_GEMINI_ENDPOINT.to_string(),
            openai_timeout_ms: DEFAULT_OPENAI_TIMEOUT_MS,
            openai_max_retries: DEFAULT_OPENAI_MAX_RETRIES,
            openai_retry_base_ms: DEFAULT_OPENAI_RETRY_BASE_MS,
            openai_compat_model_cache_ttl_ms: DEFAULT_OPENAI_COMPAT_MODEL_CACHE_TTL_MS,
            live_skills_network_enabled: false,
            live_skills_network_base_url: DEFAULT_LIVE_SKILLS_NETWORK_BASE_URL.to_string(),
            live_skills_network_timeout_ms: DEFAULT_LIVE_SKILLS_NETWORK_TIMEOUT_MS,
            live_skills_network_cache_ttl_ms: DEFAULT_LIVE_SKILLS_NETWORK_CACHE_TTL_MS,
            sandbox_enabled: false,
            sandbox_network_access: DEFAULT_SANDBOX_NETWORK_ACCESS.to_string(),
            sandbox_allowed_hosts: Vec::new(),
            oauth_pool_db_path: ":memory:".to_string(),
            oauth_secret_key: None,
            oauth_public_base_url: None,
            oauth_loopback_callback_port: DEFAULT_OAUTH_LOOPBACK_CALLBACK_PORT,
            runtime_auth_token: None,
            agent_max_concurrent_tasks: DEFAULT_AGENT_MAX_CONCURRENT_TASKS,
            agent_task_history_limit: DEFAULT_AGENT_TASK_HISTORY_LIMIT,
            distributed_enabled: false,
            distributed_redis_url: None,
            distributed_lane_count: 1,
            distributed_worker_concurrency: 1,
            distributed_claim_idle_ms: 500,
            discovery_enabled: false,
            discovery_service_type: DEFAULT_DISCOVERY_SERVICE_TYPE.to_string(),
            discovery_browse_interval_ms: DEFAULT_DISCOVERY_BROWSE_INTERVAL_MS,
            discovery_stale_ttl_ms: DEFAULT_DISCOVERY_STALE_TTL_MS,
            runtime_backend_id: "runtime-policy-test".to_string(),
            runtime_backend_capabilities: vec!["code".to_string()],
            runtime_port: 8788,
            ws_write_buffer_size_bytes: DEFAULT_RUNTIME_WS_WRITE_BUFFER_SIZE_BYTES,
            ws_max_write_buffer_size_bytes: DEFAULT_RUNTIME_WS_MAX_WRITE_BUFFER_SIZE_BYTES,
            ws_max_frame_size_bytes: DEFAULT_RUNTIME_WS_MAX_FRAME_SIZE_BYTES,
            ws_max_message_size_bytes: DEFAULT_RUNTIME_WS_MAX_MESSAGE_SIZE_BYTES,
            ws_max_connections: DEFAULT_RUNTIME_WS_MAX_CONNECTIONS,
            provider_extension_seeds: Vec::new(),
        }
    }

    fn runtime_policy_test_context() -> AppContext {
        build_app_context(
            create_initial_state("gpt-5.4"),
            runtime_policy_test_config(),
            Arc::new(native_state_store::NativeStateStore::from_env_or_default()),
        )
    }

    #[test]
    fn build_runtime_policy_state_marks_optional_policy_blocks_as_attention() {
        let guardrails =
            runtime_tool_guardrails::RuntimeToolGuardrailStore::isolated_for_test(500)
                .read_snapshot();

        let state = build_runtime_policy_state(RuntimePolicyMode::Strict, &guardrails, false, false);

        assert_eq!(state.get("readiness").and_then(Value::as_str), Some("attention"));
        assert_eq!(
            state
                .get("activeConstraintCount")
                .and_then(Value::as_u64),
            Some(4)
        );
        assert_eq!(
            state
                .get("blockedCapabilityCount")
                .and_then(Value::as_u64),
            Some(3)
        );
        let capabilities = state
            .get("capabilities")
            .and_then(Value::as_array)
            .expect("policy capabilities");
        assert!(capabilities.iter().any(|entry| {
            entry.get("capabilityId").and_then(Value::as_str) == Some("network_analysis")
                && entry.get("effect").and_then(Value::as_str) == Some("blocked")
        }));
    }

    #[tokio::test]
    async fn runtime_policy_get_returns_standard_policy_state_payload() {
        let ctx = runtime_policy_test_context();

        let response = handle_runtime_policy_get_v2(&ctx)
            .await
            .expect("runtime policy get");

        assert_eq!(response.get("mode").and_then(Value::as_str), Some("strict"));
        let state = response.get("state").expect("policy state");
        assert_eq!(state.get("readiness").and_then(Value::as_str), Some("attention"));
        assert!(state
            .get("summary")
            .and_then(Value::as_str)
            .expect("summary")
            .contains("Strict"));
        assert!(state
            .get("capabilities")
            .and_then(Value::as_array)
            .map(|entries| !entries.is_empty())
            .unwrap_or(false));
    }

    #[tokio::test]
    async fn runtime_policy_set_returns_updated_mode_and_state_payload() {
        let ctx = runtime_policy_test_context();

        let response = handle_runtime_policy_set_v2(&ctx, &json!({ "mode": "aggressive" }))
            .await
            .expect("runtime policy set");

        assert_eq!(response.get("mode").and_then(Value::as_str), Some("aggressive"));
        assert!(response.get("updatedAt").and_then(Value::as_u64).is_some());
        let state = response.get("state").expect("policy state");
        assert_eq!(state.get("readiness").and_then(Value::as_str), Some("attention"));
        assert!(state
            .get("summary")
            .and_then(Value::as_str)
            .expect("summary")
            .contains("Aggressive"));
    }
}
