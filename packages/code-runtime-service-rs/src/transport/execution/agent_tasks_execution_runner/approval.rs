use super::runtime_autonomy::metadata::apply_tool_inspector_metadata;
use super::runtime_autonomy::{
    fail_agent_task_with_tool_inspector_denial, inspect_tool_with_inspectors,
    tool_inspector_metadata, ToolInspectorDecision, ToolInspectorMetadata,
};
use super::*;

fn step_has_approved_scope(
    step_summary: &AgentTaskStepSummary,
    scope_key: &str,
    require_completed_status: bool,
) -> bool {
    if require_completed_status && step_summary.status != AgentTaskStatus::Completed.as_str() {
        return false;
    }
    let Some(approval) = step_summary
        .metadata
        .get("approval")
        .and_then(Value::as_object)
    else {
        return false;
    };
    approval.get("decision").and_then(Value::as_str) == Some("approved")
        && approval.get("scopeKey").and_then(Value::as_str) == Some(scope_key)
}

fn task_has_prior_approved_scope(
    step_summaries: &[AgentTaskStepSummary],
    step_index: usize,
    scope_key: &str,
) -> bool {
    step_summaries
        .iter()
        .take(step_index)
        .any(|summary| step_has_approved_scope(summary, scope_key, true))
}

fn apply_approval_scope_metadata(
    metadata: &mut Value,
    scope: Option<&AgentStepApprovalScope>,
    decision: &str,
    reused: bool,
    required: bool,
    request_reason: Option<&str>,
    request_source: Option<&str>,
    resolution_status: Option<&str>,
    resolution_reason: Option<&str>,
    resolution_action: Option<&str>,
) {
    let Some(metadata_object) = metadata.as_object_mut() else {
        return;
    };
    let mut approval = metadata_object
        .get("approval")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    approval.insert("decision".to_string(), Value::String(decision.to_string()));
    approval.insert("reused".to_string(), Value::Bool(reused));
    approval.insert("required".to_string(), Value::Bool(required));
    if let Some(scope) = scope {
        approval.insert(
            "scopeKind".to_string(),
            Value::String(scope.kind.to_string()),
        );
        approval.insert("scopeKey".to_string(), Value::String(scope.key.clone()));
        approval.insert(
            "scopeTarget".to_string(),
            Value::String(scope.target.clone()),
        );
    }
    if let Some(request_reason) = request_reason.filter(|value| !value.trim().is_empty()) {
        approval.insert(
            "requestReason".to_string(),
            Value::String(request_reason.to_string()),
        );
    }
    if let Some(request_source) = request_source.filter(|value| !value.trim().is_empty()) {
        approval.insert(
            "requestSource".to_string(),
            Value::String(request_source.to_string()),
        );
    }
    if let Some(resolution_status) = resolution_status.filter(|value| !value.trim().is_empty()) {
        approval.insert(
            "resolutionStatus".to_string(),
            Value::String(resolution_status.to_string()),
        );
    }
    if let Some(resolution_reason) = resolution_reason.filter(|value| !value.trim().is_empty()) {
        approval.insert(
            "resolutionReason".to_string(),
            Value::String(resolution_reason.to_string()),
        );
    }
    if let Some(resolution_action) = resolution_action.filter(|value| !value.trim().is_empty()) {
        approval.insert(
            "resolutionAction".to_string(),
            Value::String(resolution_action.to_string()),
        );
    }
    metadata_object.insert("approval".to_string(), Value::Object(approval));
}

pub(super) async fn handle_step_inspector_and_approval(
    ctx: &AppContext,
    task_id: &str,
    step_index: usize,
    step: &AgentTaskStepInput,
    workspace_id: &str,
    request_id: Option<&str>,
    access_mode: &str,
    agent_profile: &str,
    trace_id: &str,
    tool_call_id: &str,
    tool_scope: runtime_tool_metrics::RuntimeToolExecutionScope,
    tool_attempt: Option<u32>,
    task_recovered: bool,
) -> Option<ToolInspectorMetadata> {
    let mut requires_approval =
        resolve_agent_step_requires_approval(step, access_mode, agent_profile);
    let inspector_decision = inspect_tool_with_inspectors(ctx, task_id, step, workspace_id).await;
    let step_inspector_metadata = tool_inspector_metadata(&inspector_decision);
    let mut approval_reason_override: Option<String> = None;
    let approval_scope = step.kind.approval_scope(
        Some(workspace_id),
        step.path.as_deref(),
        step.command.as_deref(),
        step.input.as_deref(),
    );

    match inspector_decision {
        ToolInspectorDecision::Allow => {}
        ToolInspectorDecision::RequireApproval { reason, .. } => {
            requires_approval = true;
            approval_reason_override = Some(reason);
        }
        ToolInspectorDecision::Deny {
            error_code,
            message,
            rule_id,
        } => {
            fail_agent_task_with_tool_inspector_denial(
                ctx,
                task_id,
                step_index,
                step.kind,
                workspace_id,
                request_id,
                trace_id,
                tool_call_id,
                tool_scope,
                tool_attempt,
                task_recovered,
                error_code.as_str(),
                message.as_str(),
                rule_id.as_deref(),
            )
            .await;
            return None;
        }
    }

    if !requires_approval {
        return Some(step_inspector_metadata);
    }

    let approval_reason = approval_reason_override
        .clone()
        .or_else(|| step.approval_reason.clone())
        .unwrap_or_else(|| "Destructive operation requires approval.".to_string());
    let approval_request_source = if approval_reason_override.is_some() {
        "inspector"
    } else if step.requires_approval.is_some() {
        "explicit_override"
    } else {
        "capability_default"
    };

    let reuse_prior_approval = if let Some(scope) = approval_scope.as_ref() {
        let store = ctx.agent_tasks.read().await;
        let Some(task) = store.tasks.get(task_id) else {
            return None;
        };
        task_has_prior_approved_scope(
            task.summary.steps.as_slice(),
            step_index,
            scope.key.as_str(),
        )
    } else {
        false
    };
    if reuse_prior_approval {
        let mut store = ctx.agent_tasks.write().await;
        let task = store.tasks.get_mut(task_id)?;
        if let Some(step_summary) = task.summary.steps.get_mut(step_index) {
            let mut step_metadata = step_summary.metadata.clone();
            apply_tool_inspector_metadata(&mut step_metadata, &step_inspector_metadata);
            apply_approval_scope_metadata(
                &mut step_metadata,
                approval_scope.as_ref(),
                "approved",
                true,
                true,
                Some(approval_reason.as_str()),
                Some(approval_request_source),
                Some("approved"),
                Some("Reused prior approved scope in this task."),
                Some(step.kind.as_str()),
            );
            step_summary.metadata = step_metadata;
        }
        return Some(step_inspector_metadata);
    }

    let approval_id = new_id("approval");
    let index_task_id = {
        let mut store = ctx.agent_tasks.write().await;
        let Some(task) = store.tasks.get_mut(task_id) else {
            return None;
        };
        let now = now_ms();
        task.summary.status = AgentTaskStatus::AwaitingApproval.as_str().to_string();
        task.summary.current_step = Some(step_index);
        task.summary.pending_approval_id = Some(approval_id.clone());
        task.summary.pending_approval = Some(PendingApprovalSummary {
            approval_id: approval_id.clone(),
            step_index,
            action: step.kind.as_str().to_string(),
            reason: approval_reason.clone(),
            input: json!({
                "kind": step.kind.as_str(),
                "path": step.path,
                "command": step.command,
                "approvalScopeKind": approval_scope.as_ref().map(|scope| scope.kind),
                "approvalScopeKey": approval_scope.as_ref().map(|scope| scope.key.as_str()),
                "approvalScopeTarget": approval_scope.as_ref().map(|scope| scope.target.as_str()),
            }),
            created_at: now,
            decision: None,
            decision_reason: None,
            decided_at: None,
        });
        if let Some(step_summary) = task.summary.steps.get_mut(step_index) {
            step_summary.status = AgentTaskStatus::AwaitingApproval.as_str().to_string();
            step_summary.approval_id = Some(approval_id.clone());
            step_summary.updated_at = now;
            step_summary.message = "Waiting for approval.".to_string();
            let mut step_metadata = step_summary.metadata.clone();
            apply_tool_inspector_metadata(&mut step_metadata, &step_inspector_metadata);
            apply_approval_scope_metadata(
                &mut step_metadata,
                approval_scope.as_ref(),
                "pending",
                false,
                true,
                Some(approval_reason.as_str()),
                Some(approval_request_source),
                None,
                None,
                None,
            );
            step_summary.metadata = step_metadata;
        }
        task.summary.task_id.clone()
    };
    {
        let mut store = ctx.agent_tasks.write().await;
        store
            .approval_index
            .insert(approval_id.clone(), index_task_id);
    }
    let _ = checkpoint_agent_task_runtime_state(
        ctx,
        task_id,
        AgentTaskStatus::AwaitingApproval.as_str(),
    )
    .await;

    publish_turn_event(
        ctx,
        TURN_EVENT_APPROVAL_REQUIRED,
        json!({
            "approvalId": approval_id,
            "turnId": task_id,
            "agentProfile": agent_profile,
            "reason": approval_reason,
            "action": step.kind.as_str(),
            "approval": {
                "required": true,
                "requestReason": approval_reason,
                "requestSource": approval_request_source,
                "scopeKind": approval_scope.as_ref().map(|scope| scope.kind),
                "scopeKey": approval_scope.as_ref().map(|scope| scope.key.as_str()),
                "scopeTarget": approval_scope.as_ref().map(|scope| scope.target.as_str()),
            },
            "input": {
                "path": step.path,
                "command": step.command,
                "approvalScopeKind": approval_scope.as_ref().map(|scope| scope.kind),
                "approvalScopeKey": approval_scope.as_ref().map(|scope| scope.key.as_str()),
                "approvalScopeTarget": approval_scope.as_ref().map(|scope| scope.target.as_str()),
            },
            "inspector": {
                "decision": step_inspector_metadata.decision,
                "reason": step_inspector_metadata.reason,
                "ruleId": step_inspector_metadata.rule_id,
            },
            "inspectorDecision": step_inspector_metadata.decision,
            "inspectorReason": step_inspector_metadata.reason,
            "ruleId": step_inspector_metadata.rule_id,
        }),
        request_id,
    );

    let decision = match wait_for_agent_task_approval(ctx, task_id, approval_id.as_str()).await {
        Ok(outcome) => outcome,
        Err(error) => {
            warn!(
                task_id,
                approval_id = approval_id.as_str(),
                error = error.message.as_str(),
                "agent approval wait failed"
            );
            AgentApprovalWaitOutcome::Error
        }
    };

    let mut interrupt_message_for_event: Option<String> = None;
    let (
        approval_resolution_status,
        approval_resolution_reason,
        approval_resolution_action,
        emit_events,
        should_continue_execution,
        increment_timeout_metric,
        terminalization_noop_source,
    ) = {
        let mut store = ctx.agent_tasks.write().await;
        store.approval_index.remove(approval_id.as_str());
        let Some(task) = store.tasks.get_mut(task_id) else {
            return None;
        };
        let mut emit_events = true;
        let mut should_continue_execution = false;
        let mut increment_timeout_metric = false;
        let mut terminalization_noop_source: Option<&'static str> = None;
        let mut approval_resolution_status: Option<&'static str> = None;
        let mut approval_resolution_reason = task
            .summary
            .pending_approval
            .as_ref()
            .and_then(|pending| pending.decision_reason.clone())
            .filter(|reason| !reason.trim().is_empty());
        let approval_resolution_action = task
            .summary
            .pending_approval
            .as_ref()
            .map(|pending| pending.action.clone())
            .filter(|action| !action.trim().is_empty());
        task.summary.pending_approval_id = None;
        task.summary.pending_approval = None;

        let already_terminal = terminalization_cas_enabled()
            && is_agent_task_terminal_status(task.summary.status.as_str());
        if already_terminal {
            emit_events = false;
            approval_resolution_status = None;
            task.summary.updated_at = now_ms();
            terminalization_noop_source = Some("approval_wait_already_terminal");
        } else {
            match decision {
                AgentApprovalWaitOutcome::Approved => {
                    approval_resolution_status = Some("approved");
                    task.summary.status = AgentTaskStatus::Running.as_str().to_string();
                    task.summary.updated_at = now_ms();
                    should_continue_execution = true;
                    if let Some(step_summary) = task.summary.steps.get_mut(step_index) {
                        let mut step_metadata = step_summary.metadata.clone();
                        apply_tool_inspector_metadata(&mut step_metadata, &step_inspector_metadata);
                        apply_approval_scope_metadata(
                            &mut step_metadata,
                            approval_scope.as_ref(),
                            "approved",
                            false,
                            true,
                            Some(approval_reason.as_str()),
                            Some(approval_request_source),
                            Some("approved"),
                            approval_resolution_reason.as_deref(),
                            approval_resolution_action.as_deref(),
                        );
                        step_summary.metadata = step_metadata;
                    }
                }
                AgentApprovalWaitOutcome::Rejected => {
                    approval_resolution_status = Some("rejected");
                    if approval_resolution_reason.is_none() {
                        approval_resolution_reason =
                            Some("Approval rejected by operator.".to_string());
                    }
                    let finalized = try_finalize_agent_task_runtime(task, |task| {
                        task.summary.status = AgentTaskStatus::Failed.as_str().to_string();
                        task.summary.error_code = Some("APPROVAL_REJECTED".to_string());
                        task.summary.error_message =
                            Some("Approval rejected by operator.".to_string());
                        task.summary.completed_at = Some(now_ms());
                        task.summary.updated_at = now_ms();
                        if let Some(step_summary) = task.summary.steps.get_mut(step_index) {
                            step_summary.status = AgentTaskStatus::Failed.as_str().to_string();
                            step_summary.error_code = Some("APPROVAL_REJECTED".to_string());
                            step_summary.error_message =
                                Some("Approval rejected by operator.".to_string());
                            step_summary.updated_at = now_ms();
                            let mut step_metadata = step_summary.metadata.clone();
                            apply_tool_inspector_metadata(
                                &mut step_metadata,
                                &step_inspector_metadata,
                            );
                            apply_approval_scope_metadata(
                                &mut step_metadata,
                                approval_scope.as_ref(),
                                "rejected",
                                false,
                                true,
                                Some(approval_reason.as_str()),
                                Some(approval_request_source),
                                Some("rejected"),
                                approval_resolution_reason.as_deref(),
                                approval_resolution_action.as_deref(),
                            );
                            step_summary.metadata = step_metadata;
                        }
                    });
                    if !finalized {
                        emit_events = false;
                        approval_resolution_status = None;
                        terminalization_noop_source = Some("approval_wait_rejected");
                    }
                }
                AgentApprovalWaitOutcome::Interrupted => {
                    let interrupt_message = task
                        .summary
                        .error_message
                        .clone()
                        .filter(|message| !message.trim().is_empty())
                        .unwrap_or_else(|| "Task interrupted while awaiting approval.".to_string());
                    let finalized = try_finalize_agent_task_runtime(task, |task| {
                        task.summary.status = AgentTaskStatus::Interrupted.as_str().to_string();
                        task.summary.error_code = Some("TASK_INTERRUPTED".to_string());
                        task.summary.error_message = Some(interrupt_message.clone());
                        task.summary.completed_at = Some(now_ms());
                        task.summary.updated_at = now_ms();
                        if let Some(step_summary) = task.summary.steps.get_mut(step_index) {
                            step_summary.status = AgentTaskStatus::Interrupted.as_str().to_string();
                            step_summary.error_code = Some("TASK_INTERRUPTED".to_string());
                            step_summary.error_message = Some(interrupt_message.clone());
                            step_summary.updated_at = now_ms();
                            let mut step_metadata = step_summary.metadata.clone();
                            apply_tool_inspector_metadata(
                                &mut step_metadata,
                                &step_inspector_metadata,
                            );
                            apply_approval_scope_metadata(
                                &mut step_metadata,
                                approval_scope.as_ref(),
                                "interrupted",
                                false,
                                true,
                                Some(approval_reason.as_str()),
                                Some(approval_request_source),
                                Some("interrupted"),
                                approval_resolution_reason.as_deref(),
                                approval_resolution_action.as_deref(),
                            );
                            step_summary.metadata = step_metadata;
                        }
                    });
                    if finalized {
                        interrupt_message_for_event = Some(interrupt_message);
                    } else {
                        emit_events = false;
                        terminalization_noop_source = Some("approval_wait_interrupted");
                    }
                }
                AgentApprovalWaitOutcome::Error => {
                    approval_resolution_status = Some("error");
                    if approval_resolution_reason.is_none() {
                        approval_resolution_reason =
                            Some("Approval channel failed while waiting for decision.".to_string());
                    }
                    let finalized = try_finalize_agent_task_runtime(task, |task| {
                        task.summary.status = AgentTaskStatus::Failed.as_str().to_string();
                        task.summary.error_code = Some("APPROVAL_UNAVAILABLE".to_string());
                        task.summary.error_message =
                            Some("Approval channel failed while waiting for decision.".to_string());
                        task.summary.completed_at = Some(now_ms());
                        task.summary.updated_at = now_ms();
                        if let Some(step_summary) = task.summary.steps.get_mut(step_index) {
                            step_summary.status = AgentTaskStatus::Failed.as_str().to_string();
                            step_summary.error_code = Some("APPROVAL_UNAVAILABLE".to_string());
                            step_summary.error_message = Some(
                                "Approval channel failed while waiting for decision.".to_string(),
                            );
                            step_summary.updated_at = now_ms();
                            let mut step_metadata = step_summary.metadata.clone();
                            apply_tool_inspector_metadata(
                                &mut step_metadata,
                                &step_inspector_metadata,
                            );
                            apply_approval_scope_metadata(
                                &mut step_metadata,
                                approval_scope.as_ref(),
                                "error",
                                false,
                                true,
                                Some(approval_reason.as_str()),
                                Some(approval_request_source),
                                Some("error"),
                                approval_resolution_reason.as_deref(),
                                approval_resolution_action.as_deref(),
                            );
                            step_summary.metadata = step_metadata;
                        }
                    });
                    if !finalized {
                        emit_events = false;
                        approval_resolution_status = None;
                        terminalization_noop_source = Some("approval_wait_error");
                    }
                }
                AgentApprovalWaitOutcome::TimedOut => {
                    approval_resolution_status = Some("error");
                    if approval_resolution_reason.is_none() {
                        approval_resolution_reason = Some(
                            "Approval wait timed out before a decision was recorded.".to_string(),
                        );
                    }
                    let finalized = try_finalize_agent_task_runtime(task, |task| {
                        task.summary.status = AgentTaskStatus::Failed.as_str().to_string();
                        task.summary.error_code = Some("APPROVAL_TIMEOUT".to_string());
                        task.summary.error_message = Some(
                            "Approval wait timed out before a decision was recorded.".to_string(),
                        );
                        task.summary.completed_at = Some(now_ms());
                        task.summary.updated_at = now_ms();
                        if let Some(step_summary) = task.summary.steps.get_mut(step_index) {
                            step_summary.status = AgentTaskStatus::Failed.as_str().to_string();
                            step_summary.error_code = Some("APPROVAL_TIMEOUT".to_string());
                            step_summary.error_message = Some(
                                "Approval wait timed out before a decision was recorded."
                                    .to_string(),
                            );
                            step_summary.updated_at = now_ms();
                            let mut step_metadata = step_summary.metadata.clone();
                            apply_tool_inspector_metadata(
                                &mut step_metadata,
                                &step_inspector_metadata,
                            );
                            apply_approval_scope_metadata(
                                &mut step_metadata,
                                approval_scope.as_ref(),
                                "timeout",
                                false,
                                true,
                                Some(approval_reason.as_str()),
                                Some(approval_request_source),
                                Some("error"),
                                approval_resolution_reason.as_deref(),
                                approval_resolution_action.as_deref(),
                            );
                            step_summary.metadata = step_metadata;
                        }
                    });
                    if finalized {
                        increment_timeout_metric = true;
                    } else {
                        emit_events = false;
                        approval_resolution_status = None;
                        terminalization_noop_source = Some("approval_wait_timeout");
                    }
                }
            }
        }

        (
            approval_resolution_status,
            approval_resolution_reason,
            approval_resolution_action,
            emit_events,
            should_continue_execution,
            increment_timeout_metric,
            terminalization_noop_source,
        )
    };

    if let Some(source) = terminalization_noop_source {
        increment_terminalization_cas_noop_metric(ctx, task_id, source).await;
    }

    if increment_timeout_metric {
        let _ = crate::runtime_tool_safety_counters::record_runtime_tool_safety_counter(
            ctx,
            runtime_tool_metrics::RuntimeToolSafetyCounter::ApprovalTimeout,
            "increment approval-timeout runtime tool metric failed",
        )
        .await;
    }

    if finalize_approval_wait_outcome(
        ctx,
        task_id,
        approval_id.as_str(),
        &decision,
        emit_events,
        approval_resolution_status,
        approval_resolution_reason,
        approval_resolution_action,
        interrupt_message_for_event,
        request_id,
    )
    .await
    {
        return None;
    }

    if !should_continue_execution {
        return None;
    }

    if matches!(decision, AgentApprovalWaitOutcome::Approved)
        && step.kind == AgentStepKind::Bash
        && step_inspector_metadata
            .rule_id
            .as_deref()
            .map(|value| value.contains("security.preflight.review"))
            .unwrap_or(false)
    {
        let _ = security_preflight::remember_approved_security_preflight_permission(
            ctx,
            Some(workspace_id),
            Some("bash"),
            step.command.as_deref(),
            Some("Operator approved this command in a prior review."),
        )
        .await;
    }

    Some(step_inspector_metadata)
}
