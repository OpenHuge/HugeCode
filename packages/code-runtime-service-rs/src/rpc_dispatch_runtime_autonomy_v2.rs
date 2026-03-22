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
    Ok(json!({
        "mode": mode.as_str(),
        "updatedAt": state.runtime_policy_updated_at,
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
    Ok(json!({
        "mode": mode.as_str(),
        "updatedAt": updated_at,
    }))
}
