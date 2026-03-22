use super::*;
use crate::runtime_helpers::normalize_agent_task_relaunch_context;

fn resolve_intervention_profile(
    current_access_mode: &str,
    current_agent_profile: &str,
    action: AgentTaskInterventionAction,
    execution_profile_id: Option<&str>,
) -> Result<(String, String), RpcError> {
    let requested_profile = execution_profile_id
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .or_else(|| match action {
            AgentTaskInterventionAction::EscalateToPairMode => Some("balanced-delegate"),
            _ => None,
        });
    match requested_profile {
        Some("operator-review") => Ok(("read-only".to_string(), "review".to_string())),
        Some("balanced-delegate") => Ok(("on-request".to_string(), "code".to_string())),
        Some("autonomous-delegate") => Ok(("full-access".to_string(), "code".to_string())),
        Some(other) => Err(RpcError::invalid_params(format!(
            "Unsupported execution profile `{other}` for task intervention."
        ))),
        None => Ok((
            current_access_mode.to_string(),
            current_agent_profile.to_string(),
        )),
    }
}

fn build_intervention_instruction(request: &AgentTaskInterventionRequest) -> Option<String> {
    let default_instruction = match request.action {
        AgentTaskInterventionAction::Retry => "Retry the task from the previous mission brief.",
        AgentTaskInterventionAction::ContinueWithClarification => {
            "Continue with additional operator clarification."
        }
        AgentTaskInterventionAction::NarrowScope => {
            "Narrow scope and focus only on the highest-signal path."
        }
        AgentTaskInterventionAction::RelaxValidation => {
            "Relax validation scope while preserving correctness."
        }
        AgentTaskInterventionAction::SwitchProfileAndRetry => {
            "Retry with the requested execution profile."
        }
        AgentTaskInterventionAction::EscalateToPairMode => {
            "Escalate to pair mode and wait for tighter operator guidance."
        }
        AgentTaskInterventionAction::Pause
        | AgentTaskInterventionAction::Resume
        | AgentTaskInterventionAction::Cancel => return None,
    };

    let patch = request
        .instruction_patch
        .as_deref()
        .unwrap_or(default_instruction);
    Some(format!(
        "[Mission Control Intervention: {}]\n{}",
        request.action.as_str(),
        patch
    ))
}

fn build_child_steps_from_intervention(
    runtime: &AgentTaskRuntime,
    request: &AgentTaskInterventionRequest,
) -> Result<Vec<AgentTaskStepInput>, RpcError> {
    let mut steps = runtime.steps_input.clone();
    if steps.is_empty() {
        return Err(RpcError::invalid_params(
            "Intervention requires a replayable task brief.",
        ));
    }
    if let Some(instruction) = build_intervention_instruction(request) {
        if let Some(first_step) = steps.first_mut() {
            first_step.input = Some(match trim_optional_string(first_step.input.clone()) {
                Some(existing) => format!("{existing}\n\n{instruction}"),
                None => instruction,
            });
        }
    }
    Ok(steps)
}

pub(super) fn is_agent_task_resumable(summary: &AgentTaskSummary) -> bool {
    matches!(summary.status.as_str(), "paused") || is_agent_task_recovery_interrupted(summary)
}

fn infer_execution_mode_for_summary(summary: &AgentTaskSummary) -> String {
    if summary.backend_id.is_some() || summary.distributed_status.is_some() {
        "distributed".to_string()
    } else {
        "single".to_string()
    }
}

fn build_intervention_ack(
    accepted: bool,
    action: AgentTaskInterventionAction,
    task_id: String,
    status: Option<String>,
    outcome: String,
    spawned_task_id: Option<String>,
    checkpoint_id: Option<String>,
) -> Value {
    json!({
        "accepted": accepted,
        "action": action.as_str(),
        "taskId": task_id,
        "status": status,
        "outcome": outcome,
        "spawnedTaskId": spawned_task_id,
        "checkpointId": checkpoint_id,
    })
}

pub(crate) async fn handle_agent_task_intervene(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let request = parse_agent_task_intervention_request(params)?;
    match request.action {
        AgentTaskInterventionAction::Pause => {
            let (response, summary_snapshot) = {
                let mut store = ctx.agent_tasks.write().await;
                let Some(task) = store.tasks.get_mut(request.task_id.as_str()) else {
                    return Ok(build_intervention_ack(
                        false,
                        request.action,
                        request.task_id,
                        None,
                        "task_not_found".to_string(),
                        None,
                        None,
                    ));
                };
                if task.summary.status == AgentTaskStatus::Paused.as_str() {
                    return Ok(build_intervention_ack(
                        false,
                        request.action,
                        task.summary.task_id.clone(),
                        Some(task.summary.status.clone()),
                        "already_paused".to_string(),
                        None,
                        task.checkpoint_id.clone(),
                    ));
                }
                if task.summary.status != AgentTaskStatus::Running.as_str() {
                    return Ok(build_intervention_ack(
                        false,
                        request.action,
                        task.summary.task_id.clone(),
                        Some(task.summary.status.clone()),
                        "pause_requires_running_task".to_string(),
                        None,
                        task.checkpoint_id.clone(),
                    ));
                }

                let paused_at = now_ms();
                let pause_message = request
                    .reason
                    .clone()
                    .unwrap_or_else(|| "Task paused by operator.".to_string());
                let current_step = task.summary.current_step;
                task.summary.status = AgentTaskStatus::Paused.as_str().to_string();
                task.summary.error_code = Some("TASK_PAUSED".to_string());
                task.summary.error_message = Some(pause_message.clone());
                task.summary.current_step = None;
                task.summary.completed_at = Some(paused_at);
                task.summary.updated_at = paused_at;
                set_auto_drive_stop_state(
                    &mut task.summary.auto_drive,
                    "paused",
                    Some(pause_message.clone()),
                );
                if let Some(step_index) = current_step {
                    if let Some(step_summary) = task.summary.steps.get_mut(step_index) {
                        step_summary.status = AgentTaskStatus::Paused.as_str().to_string();
                        step_summary.error_code = Some("TASK_PAUSED".to_string());
                        step_summary.error_message = Some(pause_message.clone());
                        step_summary.message = pause_message.clone();
                        step_summary.completed_at = Some(paused_at);
                        step_summary.updated_at = paused_at;
                    }
                }
                task.interrupt_waiter.notify_waiters();
                task.approval_waiter.notify_waiters();
                let checkpoint_id = checkpoint_agent_task_runtime_and_cache(
                    ctx,
                    task,
                    AgentTaskStatus::Paused.as_str(),
                );
                let summary_snapshot = task.summary.clone();
                (
                    build_intervention_ack(
                        true,
                        request.action,
                        task.summary.task_id.clone(),
                        Some(task.summary.status.clone()),
                        "paused".to_string(),
                        None,
                        checkpoint_id,
                    ),
                    summary_snapshot,
                )
            };

            if ctx.distributed_config.enabled {
                if let Err(error) = persist_distributed_task_summary(ctx, &summary_snapshot).await {
                    warn!(
                        error = error.as_str(),
                        task_id = summary_snapshot.task_id.as_str(),
                        "failed to persist distributed task summary after pause intervention"
                    );
                    set_distributed_dispatch_error(ctx, DISTRIBUTED_ERROR_SOURCE_STATE_SYNC, error)
                        .await;
                } else {
                    clear_distributed_dispatch_error(ctx, DISTRIBUTED_ERROR_SOURCE_STATE_SYNC)
                        .await;
                }
            }
            Ok(response)
        }
        AgentTaskInterventionAction::Resume => {
            let response = handle_agent_task_resume(
                ctx,
                &json!({
                    "taskId": request.task_id,
                    "reason": request.reason,
                }),
            )
            .await?;
            Ok(build_intervention_ack(
                response
                    .get("accepted")
                    .and_then(Value::as_bool)
                    .unwrap_or(false),
                request.action,
                response
                    .get("taskId")
                    .and_then(Value::as_str)
                    .unwrap_or(request.task_id.as_str())
                    .to_string(),
                response
                    .get("status")
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned),
                if response
                    .get("accepted")
                    .and_then(Value::as_bool)
                    .unwrap_or(false)
                {
                    "resumed".to_string()
                } else {
                    "resume_rejected".to_string()
                },
                None,
                response
                    .get("checkpointId")
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned),
            ))
        }
        AgentTaskInterventionAction::Cancel => {
            let response = handle_agent_task_interrupt(
                ctx,
                &json!({
                    "taskId": request.task_id,
                    "reason": request.reason,
                }),
            )
            .await?;
            Ok(build_intervention_ack(
                response
                    .get("accepted")
                    .and_then(Value::as_bool)
                    .unwrap_or(false),
                request.action,
                response
                    .get("taskId")
                    .and_then(Value::as_str)
                    .unwrap_or(request.task_id.as_str())
                    .to_string(),
                response
                    .get("status")
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned),
                if response
                    .get("accepted")
                    .and_then(Value::as_bool)
                    .unwrap_or(false)
                {
                    "cancel_requested".to_string()
                } else {
                    "cancel_rejected".to_string()
                },
                None,
                None,
            ))
        }
        AgentTaskInterventionAction::Retry
        | AgentTaskInterventionAction::ContinueWithClarification
        | AgentTaskInterventionAction::NarrowScope
        | AgentTaskInterventionAction::RelaxValidation
        | AgentTaskInterventionAction::SwitchProfileAndRetry
        | AgentTaskInterventionAction::EscalateToPairMode => {
            let source_runtime = {
                let store = ctx.agent_tasks.read().await;
                store.tasks.get(request.task_id.as_str()).cloned()
            };
            let Some(source_runtime) = source_runtime else {
                return Ok(build_intervention_ack(
                    false,
                    request.action,
                    request.task_id,
                    None,
                    "task_not_found".to_string(),
                    None,
                    None,
                ));
            };
            let (access_mode, agent_profile) = resolve_intervention_profile(
                source_runtime.summary.access_mode.as_str(),
                source_runtime.summary.agent_profile.as_str(),
                request.action,
                request.execution_profile_id.as_deref(),
            )?;
            let preferred_backend_ids =
                request.preferred_backend_ids.clone().unwrap_or_else(|| {
                    source_runtime
                        .summary
                        .backend_id
                        .clone()
                        .map(|backend_id| vec![backend_id])
                        .unwrap_or_default()
                });
            let steps = build_child_steps_from_intervention(&source_runtime, &request)?;
            let root_task_id = source_runtime
                .summary
                .root_task_id
                .clone()
                .or_else(|| Some(source_runtime.summary.task_id.clone()));
            let child_auto_drive = prepare_auto_drive_for_child(
                source_runtime.summary.auto_drive.clone(),
                request.action,
            );
            let relaunch_context =
                normalize_agent_task_relaunch_context(request.relaunch_context.clone())
                    .or_else(|| source_runtime.summary.relaunch_context.clone());
            let (child_task_id, child_payload) = launch_agent_task(
                ctx,
                LaunchAgentTaskSpec {
                    workspace_id: source_runtime.summary.workspace_id.clone(),
                    thread_id: source_runtime.summary.thread_id.clone(),
                    request_id: None,
                    title: source_runtime.summary.title.clone(),
                    task_source: source_runtime.summary.task_source.clone(),
                    execution_profile_id: request
                        .execution_profile_id
                        .clone()
                        .or_else(|| source_runtime.summary.execution_profile_id.clone()),
                    review_profile_id: source_runtime.summary.review_profile_id.clone(),
                    validation_preset_id: source_runtime.summary.validation_preset_id.clone(),
                    provider_hint: source_runtime.summary.provider.clone(),
                    model_id_hint: source_runtime.summary.model_id.clone(),
                    reason_effort: source_runtime.summary.reason_effort.clone(),
                    access_mode,
                    agent_profile,
                    execution_mode: infer_execution_mode_for_summary(&source_runtime.summary),
                    required_capabilities: Vec::new(),
                    preferred_backend_ids,
                    max_subtasks: None,
                    mission_brief: source_runtime.summary.mission_brief.clone(),
                    relaunch_context,
                    steps,
                    auto_drive: child_auto_drive,
                    root_task_id,
                    parent_task_id: Some(source_runtime.summary.task_id.clone()),
                },
            )
            .await?;
            Ok(build_intervention_ack(
                true,
                request.action,
                source_runtime.summary.task_id,
                child_payload
                    .get("status")
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned),
                "spawned_child_task".to_string(),
                Some(child_task_id),
                child_payload
                    .get("checkpointId")
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned),
            ))
        }
    }
}

pub(super) fn parse_agent_task_resume_task_id(params: &Value) -> Result<String, RpcError> {
    let params = as_object(params)?;
    let task_id = read_optional_string(params, "taskId")
        .or_else(|| read_optional_string(params, "task_id"))
        .unwrap_or_default();
    let normalized = task_id.trim().to_string();
    if normalized.is_empty() {
        return Err(RpcError::invalid_params("taskId is required."));
    }
    Ok(normalized)
}

pub(super) fn prepare_task_runtime_for_resume(task: &mut AgentTaskRuntime) {
    let now = now_ms();
    let mut first_pending_step: Option<usize> = None;
    for (index, step_summary) in task.summary.steps.iter_mut().enumerate() {
        if step_summary.status == AgentTaskStatus::Completed.as_str() {
            continue;
        }
        if first_pending_step.is_none() {
            first_pending_step = Some(index);
        }
        step_summary.status = AgentTaskStatus::Queued.as_str().to_string();
        step_summary.message = "Queued for resumed execution.".to_string();
        step_summary.run_id = None;
        step_summary.output = None;
        step_summary.metadata = json!({});
        step_summary.started_at = None;
        step_summary.completed_at = None;
        step_summary.updated_at = now;
        step_summary.error_code = None;
        step_summary.error_message = None;
        step_summary.approval_id = None;
    }
    task.summary.current_step = first_pending_step;
}
