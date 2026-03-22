use super::*;
#[path = "approval.rs"]
mod approval_flow;
#[path = "post_exec.rs"]
mod post_exec_outcome;
#[path = "../../../agent_tasks_execution_runtime_autonomy.rs"]
mod runtime_autonomy;
use runtime_autonomy::metadata::{
    apply_tool_inspector_metadata, apply_tool_inspector_to_tool_result_payload,
};
use runtime_autonomy::{
    enforce_agent_session_concurrency_limit, finalize_agent_task_completion,
    preflight_and_mark_tool_started, record_runtime_tool_outcome,
    resolve_runtime_tool_scope_for_step,
};

async fn resolve_agent_task_workspace_path(ctx: &AppContext, workspace_id: &str) -> String {
    let state = ctx.state.read().await;
    state
        .workspaces
        .iter()
        .find(|workspace| workspace.id == workspace_id)
        .map(|workspace| workspace.path.clone())
        .unwrap_or_else(resolve_default_workspace_path)
}

async fn run_agent_task_via_acp(
    ctx: &AppContext,
    task_id: &str,
    backend_id: &str,
    workspace_id: &str,
    request_id: Option<&str>,
    access_mode: &str,
    steps_input: &[AgentTaskStepInput],
    interrupt_waiter: Arc<Notify>,
) {
    let summary_snapshot = {
        let store = ctx.agent_tasks.read().await;
        let Some(task) = store.tasks.get(task_id) else {
            return;
        };
        task.summary.clone()
    };
    let workspace_path = resolve_agent_task_workspace_path(ctx, workspace_id).await;
    let (diagnostics, mut receiver) = match crate::acp_runtime::ensure_session_for_task(
        ctx,
        backend_id,
        workspace_id,
        summary_snapshot.thread_id.as_deref(),
        task_id,
        workspace_path.as_str(),
        access_mode,
    )
    .await
    {
        Ok(result) => result,
        Err(error) => {
            let finished_at = now_ms();
            {
                let mut store = ctx.agent_tasks.write().await;
                if let Some(task) = store.tasks.get_mut(task_id) {
                    task.summary.status = AgentTaskStatus::Failed.as_str().to_string();
                    task.summary.error_code = Some("ACP_RUNTIME_ERROR".to_string());
                    task.summary.error_message = Some(error.clone());
                    task.summary.completed_at = Some(finished_at);
                    task.summary.updated_at = finished_at;
                }
            }
            publish_turn_event(
                ctx,
                TURN_EVENT_FAILED,
                json!({
                    "turnId": task_id,
                    "error": {
                        "code": "ACP_RUNTIME_ERROR",
                        "message": error,
                    },
                }),
                request_id,
            );
            return;
        }
    };
    {
        let mut store = ctx.agent_tasks.write().await;
        if let Some(task) = store.tasks.get_mut(task_id) {
            task.summary.routed_source = Some("acp-backend".to_string());
            task.summary.backend_id = Some(diagnostics.backend_id.clone());
            task.summary.acp_integration_id = Some(diagnostics.integration_id.clone());
            task.summary.acp_session_id = Some(diagnostics.session_id.clone());
            task.summary.acp_config_options = diagnostics.config_options.clone();
            task.summary.acp_available_commands = diagnostics.available_commands.clone();
        }
    }
    let prompt = crate::acp_runtime::build_agent_task_acp_prompt(
        &crate::acp_runtime::AcpAgentTaskPromptInput {
            title: summary_snapshot.title.clone(),
            access_mode: access_mode.to_string(),
            agent_profile: summary_snapshot.agent_profile.clone(),
            mission_brief: summary_snapshot
                .mission_brief
                .as_ref()
                .and_then(|value| serde_json::to_value(value).ok()),
            relaunch_context: summary_snapshot
                .relaunch_context
                .as_ref()
                .and_then(|value| serde_json::to_value(value).ok()),
            auto_drive: summary_snapshot
                .auto_drive
                .as_ref()
                .and_then(|value| serde_json::to_value(value).ok()),
            steps: steps_input
                .iter()
                .filter_map(|step| serde_json::to_value(step).ok())
                .collect(),
        },
    );
    let prompt_future =
        crate::acp_runtime::prompt_session(ctx, diagnostics.session_id.as_str(), prompt.as_str());
    tokio::pin!(prompt_future);
    let mut streamed_parts = Vec::new();
    let completion = loop {
        tokio::select! {
            _ = interrupt_waiter.notified() => {
                let _ = crate::acp_runtime::cancel_session_by_task(ctx, task_id).await;
                break Err("Task interrupted by operator.".to_string());
            }
            event = receiver.recv() => {
                match event {
                    Ok(crate::acp_runtime::AcpSessionEvent::SessionUpdate(payload))
                    | Ok(crate::acp_runtime::AcpSessionEvent::AvailableCommandsUpdate(payload)) => {
                        {
                            let mut store = ctx.agent_tasks.write().await;
                            if let Some(task) = store.tasks.get_mut(task_id) {
                                if let Some(config_options) =
                                    crate::acp_runtime::extract_session_config_options(&payload)
                                {
                                    task.summary.acp_config_options = Some(config_options);
                                }
                                if let Some(available_commands) =
                                    crate::acp_runtime::extract_session_available_commands(&payload)
                                {
                                    task.summary.acp_available_commands = Some(available_commands);
                                }
                                task.summary.updated_at = now_ms();
                            }
                        }
                        if let Some(delta) = crate::acp_runtime::extract_session_update_text(&payload) {
                            streamed_parts.push(delta.clone());
                            publish_turn_event(
                                ctx,
                                TURN_EVENT_DELTA,
                                json!({
                                    "turnId": task_id,
                                    "delta": delta,
                                }),
                                request_id,
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
                            {
                                let mut store = ctx.agent_tasks.write().await;
                                if let Some(task) = store.tasks.get_mut(task_id) {
                                    if let Some(config_options) =
                                        crate::acp_runtime::extract_session_config_options(&payload)
                                    {
                                        task.summary.acp_config_options = Some(config_options);
                                    }
                                    if let Some(available_commands) =
                                        crate::acp_runtime::extract_session_available_commands(&payload)
                                    {
                                        task.summary.acp_available_commands = Some(available_commands);
                                    }
                                    task.summary.updated_at = now_ms();
                                }
                            }
                            if let Some(delta) = crate::acp_runtime::extract_session_update_text(&payload) {
                                streamed_parts.push(delta.clone());
                                publish_turn_event(
                                    ctx,
                                    TURN_EVENT_DELTA,
                                    json!({
                                        "turnId": task_id,
                                        "delta": delta,
                                    }),
                                    request_id,
                                );
                            }
                        }
                        Err(tokio::sync::broadcast::error::TryRecvError::Empty)
                        | Err(tokio::sync::broadcast::error::TryRecvError::Closed) => break,
                        Err(tokio::sync::broadcast::error::TryRecvError::Lagged(_)) => continue,
                    }
                }
                break match result {
                    Ok(outcome) => {
                        if crate::acp_runtime::prompt_outcome_was_cancelled(&outcome) {
                            Err("Task interrupted by operator.".to_string())
                        } else {
                            Ok(crate::acp_runtime::resolve_prompt_outcome_text(&outcome, &streamed_parts))
                        }
                    }
                    Err(error) => Err(error),
                };
            }
        }
    };
    let finished_at = now_ms();
    match completion {
        Ok(message) => {
            {
                let mut store = ctx.agent_tasks.write().await;
                if let Some(task) = store.tasks.get_mut(task_id) {
                    task.summary.status = AgentTaskStatus::Completed.as_str().to_string();
                    task.summary.updated_at = finished_at;
                    task.summary.completed_at = Some(finished_at);
                    task.summary.current_step = None;
                    for (index, step) in task.summary.steps.iter_mut().enumerate() {
                        step.status = AgentTaskStatus::Completed.as_str().to_string();
                        step.updated_at = finished_at;
                        step.completed_at = Some(finished_at);
                        step.message = "Executed by ACP session runtime.".to_string();
                        if index == 0 {
                            step.output = Some(message.clone());
                        }
                    }
                    runtime_autonomy::autodrive::mark_auto_drive_completed(
                        &mut task.summary.auto_drive,
                        Some("ACP session runtime reached the destination.".to_string()),
                        finished_at,
                    );
                }
            }
            let _ = checkpoint_agent_task_runtime_state(
                ctx,
                task_id,
                AgentTaskStatus::Completed.as_str(),
            )
            .await;
            publish_turn_event(
                ctx,
                TURN_EVENT_COMPLETED,
                json!({
                    "turnId": task_id,
                    "output": message.as_str(),
                    "message": {
                        "role": "assistant",
                        "content": message.as_str(),
                    },
                }),
                request_id,
            );
        }
        Err(error) => {
            {
                let mut store = ctx.agent_tasks.write().await;
                if let Some(task) = store.tasks.get_mut(task_id) {
                    let interrupted =
                        task.interrupt_requested || error == "Task interrupted by operator.";
                    task.summary.status = if interrupted {
                        AgentTaskStatus::Interrupted.as_str().to_string()
                    } else {
                        AgentTaskStatus::Failed.as_str().to_string()
                    };
                    task.summary.error_code = Some(if interrupted {
                        "TASK_INTERRUPTED".to_string()
                    } else {
                        "ACP_RUNTIME_ERROR".to_string()
                    });
                    task.summary.error_message = Some(error.clone());
                    task.summary.updated_at = finished_at;
                    task.summary.completed_at = Some(finished_at);
                    task.summary.current_step = None;
                    runtime_autonomy::autodrive::mark_auto_drive_failure(
                        &mut task.summary.auto_drive,
                        if interrupted { "cancelled" } else { "failed" },
                        Some(error.clone()),
                        finished_at,
                    );
                }
            }
            let lifecycle_state = {
                let store = ctx.agent_tasks.read().await;
                if store.tasks.get(task_id).is_some_and(|task| {
                    task.summary.status == AgentTaskStatus::Interrupted.as_str()
                }) {
                    AgentTaskStatus::Interrupted.as_str()
                } else {
                    AgentTaskStatus::Failed.as_str()
                }
            };
            let _ = checkpoint_agent_task_runtime_state(ctx, task_id, lifecycle_state).await;
            publish_turn_event(
                ctx,
                TURN_EVENT_FAILED,
                json!({
                    "turnId": task_id,
                    "error": {
                        "code": if lifecycle_state == AgentTaskStatus::Interrupted.as_str() {
                            "TASK_INTERRUPTED"
                        } else {
                            "ACP_RUNTIME_ERROR"
                        },
                        "message": error,
                    },
                }),
                request_id,
            );
        }
    }
    crate::acp_runtime::release_task_session_binding(ctx, task_id).await;
}

pub(super) async fn run_agent_task(ctx: AppContext, task_id: String) {
    let (
        workspace_id,
        request_id,
        access_mode,
        agent_profile,
        steps_input,
        interrupt_waiter,
        task_recovered,
    ) = {
        let mut store = ctx.agent_tasks.write().await;
        let Some(task) = store.tasks.get_mut(task_id.as_str()) else {
            return;
        };
        task.summary.updated_at = now_ms();
        (
            task.summary.workspace_id.clone(),
            task.summary.request_id.clone(),
            task.summary.access_mode.clone(),
            task.summary.agent_profile.clone(),
            task.steps_input.clone(),
            task.interrupt_waiter.clone(),
            task.recovered,
        )
    };
    let total_steps = steps_input.len();
    if !enforce_agent_session_concurrency_limit(
        &ctx,
        task_id.as_str(),
        workspace_id.as_str(),
        request_id.as_deref(),
    )
    .await
    {
        return;
    }

    publish_turn_event(
        &ctx,
        TURN_EVENT_STARTED,
        json!({
            "turnId": task_id,
            "taskId": task_id,
            "role": "router",
        }),
        request_id.as_deref(),
    );
    publish_turn_event(
        &ctx,
        TURN_EVENT_DELTA,
        json!({
            "turnId": task_id,
            "delta": format!("Task started with {} step(s).", total_steps),
        }),
        request_id.as_deref(),
    );

    let workspace_lock = resolve_agent_workspace_lock(&ctx, workspace_id.as_str()).await;
    let workspace_lock_wait_started = Instant::now();
    let _workspace_guard: OwnedMutexGuard<()> = loop {
        tokio::select! {
            guard = workspace_lock.clone().lock_owned() => {
                let workspace_wait_ms = workspace_lock_wait_started.elapsed().as_millis();
                ctx.runtime_diagnostics
                    .record_agent_workspace_lock_wait(workspace_wait_ms.min(u128::from(u64::MAX)) as u64);
                break guard;
            }
            _ = interrupt_waiter.notified() => {
                if let Some(interrupt_message) = read_agent_interrupt_message(&ctx, task_id.as_str()).await {
                    publish_turn_event(
                        &ctx,
                        TURN_EVENT_FAILED,
                        json!({
                            "turnId": task_id,
                            "error": {
                                "code": "TASK_INTERRUPTED",
                                "message": interrupt_message,
                            },
                        }),
                        request_id.as_deref(),
                    );
                    return;
                }
            }
        }
    };

    let execution_slot_wait_started = Instant::now();
    let _execution_slot_guard: OwnedSemaphorePermit = loop {
        tokio::select! {
            permit = ctx.agent_task_execution_slots.clone().acquire_owned() => {
                match permit {
                    Ok(permit) => {
                        let slot_wait_ms = execution_slot_wait_started.elapsed().as_millis();
                        ctx.runtime_diagnostics
                            .record_agent_execution_slot_wait(slot_wait_ms.min(u128::from(u64::MAX)) as u64);
                        break permit;
                    }
                    Err(_) => {
                        publish_turn_event(
                            &ctx,
                            TURN_EVENT_FAILED,
                            json!({
                                "turnId": task_id,
                                "error": {
                                    "code": "INTERNAL_ERROR",
                                    "message": "Agent execution slot is unavailable.",
                                },
                            }),
                            request_id.as_deref(),
                        );
                        return;
                    }
                }
            }
            _ = interrupt_waiter.notified() => {
                if let Some(interrupt_message) = read_agent_interrupt_message(&ctx, task_id.as_str()).await {
                    publish_turn_event(
                        &ctx,
                        TURN_EVENT_FAILED,
                        json!({
                            "turnId": task_id,
                            "error": {
                                "code": "TASK_INTERRUPTED",
                                "message": interrupt_message,
                            },
                        }),
                        request_id.as_deref(),
                    );
                    return;
                }
            }
        }
    };

    let mut queue_wait_ms_to_record = None;
    {
        let mut store = ctx.agent_tasks.write().await;
        let Some(task) = store.tasks.get_mut(task_id.as_str()) else {
            return;
        };
        if task.interrupt_requested
            || matches!(
                task.summary.status.as_str(),
                status if status == AgentTaskStatus::Interrupted.as_str()
                    || status == AgentTaskStatus::Paused.as_str()
            )
        {
            let stop_message = task
                .summary
                .error_message
                .clone()
                .filter(|message| !message.trim().is_empty())
                .unwrap_or_else(|| {
                    if task.summary.status == AgentTaskStatus::Paused.as_str() {
                        "Task paused by operator.".to_string()
                    } else {
                        "Task interrupted by operator.".to_string()
                    }
                });
            if task.summary.status != AgentTaskStatus::Paused.as_str() {
                publish_turn_event(
                    &ctx,
                    TURN_EVENT_FAILED,
                    json!({
                        "turnId": task_id,
                        "error": {
                            "code": "TASK_INTERRUPTED",
                            "message": stop_message,
                        },
                    }),
                    request_id.as_deref(),
                );
            }
            return;
        }

        task.summary.status = AgentTaskStatus::Running.as_str().to_string();
        if task.summary.started_at.is_none() {
            let started_at = now_ms();
            task.summary.started_at = Some(started_at);
            queue_wait_ms_to_record = Some(started_at.saturating_sub(task.summary.created_at));
        }
        task.summary.updated_at = now_ms();
    }
    let _ = checkpoint_agent_task_runtime_state(
        &ctx,
        task_id.as_str(),
        AgentTaskStatus::Running.as_str(),
    )
    .await;
    if let Some(queue_wait_ms) = queue_wait_ms_to_record {
        ctx.runtime_diagnostics
            .record_agent_task_started(queue_wait_ms);
    }

    let acp_backend_id = {
        let store = ctx.agent_tasks.read().await;
        store
            .tasks
            .get(task_id.as_str())
            .and_then(|task| task.summary.backend_id.clone())
    };
    if let Some(backend_id) = acp_backend_id {
        if crate::acp_runtime::resolve_execution_integration(&ctx, backend_id.as_str())
            .await
            .is_some()
        {
            run_agent_task_via_acp(
                &ctx,
                task_id.as_str(),
                backend_id.as_str(),
                workspace_id.as_str(),
                request_id.as_deref(),
                access_mode.as_str(),
                steps_input.as_slice(),
                interrupt_waiter.clone(),
            )
            .await;
            return;
        }
    }

    for (step_index, step) in steps_input.iter().cloned().enumerate() {
        let interrupted = {
            let store = ctx.agent_tasks.read().await;
            let Some(task) = store.tasks.get(task_id.as_str()) else {
                return;
            };
            task.interrupt_requested || task.summary.status == AgentTaskStatus::Paused.as_str()
        };

        if interrupted {
            let mut store = ctx.agent_tasks.write().await;
            let mut stop_message = "Task interrupted before execution.".to_string();
            let mut paused = false;
            if let Some(task) = store.tasks.get_mut(task_id.as_str()) {
                paused = task.summary.status == AgentTaskStatus::Paused.as_str();
                stop_message = task
                    .summary
                    .error_message
                    .clone()
                    .filter(|message| !message.trim().is_empty())
                    .unwrap_or_else(|| {
                        if paused {
                            "Task paused before execution.".to_string()
                        } else {
                            "Task interrupted before execution.".to_string()
                        }
                    });
                task.summary.status = if paused {
                    AgentTaskStatus::Paused.as_str().to_string()
                } else {
                    AgentTaskStatus::Interrupted.as_str().to_string()
                };
                task.summary.error_code = Some(if paused {
                    "TASK_PAUSED".to_string()
                } else {
                    "TASK_INTERRUPTED".to_string()
                });
                task.summary.error_message = Some(stop_message.clone());
                task.summary.completed_at = Some(now_ms());
                task.summary.updated_at = now_ms();
                task.summary.current_step = None;
            }
            let _ = checkpoint_agent_task_runtime_state(
                &ctx,
                task_id.as_str(),
                if paused {
                    AgentTaskStatus::Paused.as_str()
                } else {
                    AgentTaskStatus::Interrupted.as_str()
                },
            )
            .await;
            if !paused {
                publish_turn_event(
                    &ctx,
                    TURN_EVENT_FAILED,
                    json!({
                        "turnId": task_id,
                        "error": {
                            "code": "TASK_INTERRUPTED",
                            "message": stop_message,
                        },
                    }),
                    request_id.as_deref(),
                );
            }
            return;
        }

        let step_already_completed = {
            let store = ctx.agent_tasks.read().await;
            let Some(task) = store.tasks.get(task_id.as_str()) else {
                return;
            };
            task.summary
                .steps
                .get(step_index)
                .is_some_and(|summary| summary.status == AgentTaskStatus::Completed.as_str())
        };
        if step_already_completed {
            continue;
        }

        let read_requirement_violation = {
            let store = ctx.agent_tasks.read().await;
            let Some(task) = store.tasks.get(task_id.as_str()) else {
                return;
            };
            resolve_agent_step_read_requirement_violation(
                step_index,
                &step,
                steps_input.as_slice(),
                task.summary.steps.as_slice(),
            )
        };
        if let Some(violation) = read_requirement_violation {
            let finished_at = now_ms();
            {
                let mut store = ctx.agent_tasks.write().await;
                let Some(task) = store.tasks.get_mut(task_id.as_str()) else {
                    return;
                };
                task.summary.status = AgentTaskStatus::Failed.as_str().to_string();
                task.summary.error_code =
                    Some(AGENT_STEP_REQUIRES_FRESH_READ_ERROR_CODE.to_string());
                task.summary.error_message = Some(violation.message.clone());
                task.summary.completed_at = Some(finished_at);
                task.summary.updated_at = finished_at;
                task.summary.current_step = None;
                if let Some(step_summary) = task.summary.steps.get_mut(step_index) {
                    step_summary.status = AgentTaskStatus::Failed.as_str().to_string();
                    step_summary.error_code =
                        Some(AGENT_STEP_REQUIRES_FRESH_READ_ERROR_CODE.to_string());
                    step_summary.error_message = Some(violation.message.clone());
                    step_summary.message = violation.message.clone();
                    step_summary.metadata = violation.metadata.clone();
                    step_summary.completed_at = Some(finished_at);
                    step_summary.updated_at = finished_at;
                }
            }
            let _ = checkpoint_agent_task_runtime_state(
                &ctx,
                task_id.as_str(),
                AgentTaskStatus::Failed.as_str(),
            )
            .await;
            publish_turn_event(
                &ctx,
                TURN_EVENT_FAILED,
                json!({
                    "turnId": task_id,
                    "error": {
                        "code": AGENT_STEP_REQUIRES_FRESH_READ_ERROR_CODE,
                        "message": violation.message,
                    },
                }),
                request_id.as_deref(),
            );
            return;
        }

        let tool_call_id = format!("{task_id}:{}", step_index + 1);
        let trace_id = agent_task_trace_id(task_id.as_str());
        let tool_scope = resolve_runtime_tool_scope_for_step(step.kind);
        let tool_attempt = Some(1_u32);

        let Some(step_inspector_metadata) = approval_flow::handle_step_inspector_and_approval(
            &ctx,
            task_id.as_str(),
            step_index,
            &step,
            workspace_id.as_str(),
            request_id.as_deref(),
            access_mode.as_str(),
            agent_profile.as_str(),
            trace_id.as_str(),
            tool_call_id.as_str(),
            tool_scope,
            tool_attempt,
            task_recovered,
        )
        .await
        else {
            return;
        };

        {
            let mut store = ctx.agent_tasks.write().await;
            let Some(task) = store.tasks.get_mut(task_id.as_str()) else {
                return;
            };
            task.summary.status = AgentTaskStatus::Running.as_str().to_string();
            task.summary.current_step = Some(step_index);
            task.summary.updated_at = now_ms();
            if let Some(step_summary) = task.summary.steps.get_mut(step_index) {
                step_summary.status = AgentTaskStatus::Running.as_str().to_string();
                step_summary.started_at = Some(now_ms());
                step_summary.updated_at = now_ms();
                step_summary.message = "Executing step.".to_string();
            }
        }
        let _ = checkpoint_agent_task_runtime_state(
            &ctx,
            task_id.as_str(),
            AgentTaskStatus::Running.as_str(),
        )
        .await;
        let tool_input_payload = json!({
            "path": step.path.clone(),
            "paths": step.paths.clone(),
            "command": step.command.clone(),
            "severities": step.severities.as_ref().map(|values| values.iter().map(|severity| severity.as_str()).collect::<Vec<_>>()),
            "maxItems": step.max_items,
        });
        if !preflight_and_mark_tool_started(
            &ctx,
            task_id.as_str(),
            step_index,
            step.kind,
            workspace_id.as_str(),
            request_id.as_deref(),
            trace_id.as_str(),
            tool_call_id.as_str(),
            &tool_input_payload,
            tool_scope,
            tool_attempt,
            task_recovered,
        )
        .await
        {
            return;
        }
        let tool_call_checkpoint_id = checkpoint_tool_call_lifecycle(
            &ctx,
            task_id.as_str(),
            workspace_id.as_str(),
            tool_call_id.as_str(),
            step.kind.as_str(),
            "calling",
            None,
            None,
            None,
            Some(task_id.as_str()),
            tool_attempt,
            task_recovered,
            tool_input_payload.clone(),
        );
        publish_turn_event(
            &ctx,
            TURN_EVENT_TOOL_CALLING,
            build_tool_calling_event_payload(
                task_id.as_str(),
                tool_call_id.as_str(),
                step.kind.as_str(),
                tool_input_payload,
                Some(task_id.as_str()),
                tool_attempt,
                tool_call_checkpoint_id.as_deref(),
                trace_id.as_str(),
                task_recovered,
            ),
            request_id.as_deref(),
        );

        let skill_payload = Value::Object(build_agent_step_skill_request(
            workspace_id.as_str(),
            access_mode.as_str(),
            agent_profile.as_str(),
            &step,
        ));
        let live_skill_ctx = ctx.clone();
        let execution_cancel = ctx.task_supervisor.child_token();
        let execution_cancel_for_skill = execution_cancel.clone();
        let mut executed_task = ctx.task_supervisor.spawn_abortable(
            RuntimeTaskDomain::Flow,
            format!("agent.task.step.{task_id}.{step_index}"),
            async move {
                live_skills::handle_live_skill_execute_with_cancel(
                    &live_skill_ctx,
                    &skill_payload,
                    Some(execution_cancel_for_skill),
                )
                .await
            },
        );
        let mut step_timeout_sleep = step
            .timeout_ms
            .filter(|timeout_ms| *timeout_ms > 0)
            .map(|timeout_ms| Box::pin(tokio::time::sleep(Duration::from_millis(timeout_ms))));
        let step_started_at = Instant::now();
        let mut last_heartbeat_elapsed_secs = 0u64;
        let mut step_heartbeat_sleep = Box::pin(tokio::time::sleep(Duration::from_millis(
            resolve_agent_task_step_heartbeat_interval_ms(Duration::from_secs(0)),
        )));
        let executed = loop {
            tokio::select! {
                join_result = executed_task.join_future() => {
                    break match join_result {
                        Ok(result) => result,
                        Err(error) => Err(RpcError::internal(format!(
                            "Live skill execution task failed: {error}"
                        ))),
                    };
                }
                _ = interrupt_waiter.notified() => {
                    if let Some(interrupt_message) = read_agent_interrupt_message(&ctx, task_id.as_str()).await {
                        let interrupt_message_for_events = interrupt_message.clone();
                        let mut paused = false;
                        execution_cancel.cancel();
                        let _ = executed_task.wait_with_timeout_or_abort().await;
                        let finished_at = now_ms();
                        {
                            let mut store = ctx.agent_tasks.write().await;
                            if let Some(task) = store.tasks.get_mut(task_id.as_str()) {
                                paused = task.summary.status == AgentTaskStatus::Paused.as_str();
                                task.summary.status = if paused {
                                    AgentTaskStatus::Paused.as_str().to_string()
                                } else {
                                    AgentTaskStatus::Interrupted.as_str().to_string()
                                };
                                task.summary.error_code = Some(if paused {
                                    "TASK_PAUSED".to_string()
                                } else {
                                    "TASK_INTERRUPTED".to_string()
                                });
                                task.summary.error_message = Some(interrupt_message.clone());
                                task.summary.completed_at = Some(finished_at);
                                task.summary.updated_at = finished_at;
                                task.summary.current_step = None;
                                if let Some(step_summary) = task.summary.steps.get_mut(step_index) {
                                    step_summary.status = if paused {
                                        AgentTaskStatus::Paused.as_str().to_string()
                                    } else {
                                        AgentTaskStatus::Interrupted.as_str().to_string()
                                    };
                                    step_summary.error_code = Some(if paused {
                                        "TASK_PAUSED".to_string()
                                    } else {
                                        "TASK_INTERRUPTED".to_string()
                                    });
                                    step_summary.error_message = Some(interrupt_message.clone());
                                    step_summary.message = interrupt_message.clone();
                                    step_summary.completed_at = Some(finished_at);
                                    step_summary.updated_at = finished_at;
                                    let mut step_metadata = step_summary.metadata.clone();
                                    apply_tool_inspector_metadata(
                                        &mut step_metadata,
                                        &step_inspector_metadata,
                                    );
                                    step_summary.metadata = step_metadata;
                                }
                            }
                        }
                        let _ = checkpoint_agent_task_runtime_state(
                            &ctx,
                            task_id.as_str(),
                            if paused {
                                AgentTaskStatus::Paused.as_str()
                            } else {
                                AgentTaskStatus::Interrupted.as_str()
                            },
                        )
                        .await;
                        let duration_ms = step_started_at
                            .elapsed()
                            .as_millis()
                            .min(u128::from(u64::MAX)) as u64;
                        record_runtime_tool_outcome(
                            &ctx,
                            step.kind.as_str(),
                            tool_scope,
                            runtime_tool_metrics::RuntimeToolExecutionStatus::RuntimeFailed,
                            finished_at,
                            Some(duration_ms),
                            Some("TASK_INTERRUPTED"),
                            request_id.as_deref(),
                            Some(trace_id.as_str()),
                            Some(tool_call_id.as_str()),
                            workspace_id.as_str(),
                            tool_attempt,
                        )
                        .await;
                        let trace_id = agent_task_trace_id(task_id.as_str());
                        let tool_result_checkpoint_id = checkpoint_tool_call_lifecycle(
                            &ctx,
                            task_id.as_str(),
                            workspace_id.as_str(),
                            tool_call_id.as_str(),
                            step.kind.as_str(),
                            "result",
                            Some(false),
                            Some("interrupted"),
                            Some(duration_ms),
                            Some(task_id.as_str()),
                            tool_attempt,
                            task_recovered,
                            json!({
                                "error": {
                                    "code": "TASK_INTERRUPTED",
                                    "message": interrupt_message_for_events.clone(),
                                },
                            }),
                        );
                        let mut tool_result_payload = build_tool_result_event_payload(
                            task_id.as_str(),
                            tool_call_id.as_str(),
                            step.kind.as_str(),
                            false,
                            None,
                            Some("TASK_INTERRUPTED"),
                            Some(interrupt_message_for_events.clone()),
                            Some(task_id.as_str()),
                            tool_attempt,
                            tool_result_checkpoint_id.as_deref(),
                            trace_id.as_str(),
                            Some("interrupted"),
                            Some(duration_ms),
                            task_recovered,
                        );
                        apply_tool_inspector_to_tool_result_payload(
                            &mut tool_result_payload,
                            &step_inspector_metadata,
                        );
                        publish_turn_event(
                            &ctx,
                            TURN_EVENT_TOOL_RESULT,
                            tool_result_payload,
                            request_id.as_deref(),
                        );
                        if !paused {
                            publish_turn_event(
                                &ctx,
                                TURN_EVENT_FAILED,
                                json!({
                                    "turnId": task_id,
                                    "error": {
                                        "code": "TASK_INTERRUPTED",
                                        "message": interrupt_message_for_events,
                                    },
                                }),
                                request_id.as_deref(),
                            );
                        }
                        return;
                    }
                }
                _ = &mut step_heartbeat_sleep => {
                    if ctx.turn_events.receiver_count() == 0 {
                        let next_heartbeat_interval_ms =
                            resolve_agent_task_step_idle_check_interval_ms(
                                step_started_at.elapsed(),
                            );
                        step_heartbeat_sleep.as_mut().reset(
                            tokio::time::Instant::now()
                                + Duration::from_millis(next_heartbeat_interval_ms),
                        );
                        continue;
                    }
                    let elapsed_secs = step_started_at.elapsed().as_secs().max(1);
                    if elapsed_secs != last_heartbeat_elapsed_secs {
                        last_heartbeat_elapsed_secs = elapsed_secs;
                        publish_turn_event(
                            &ctx,
                            TURN_EVENT_DELTA,
                            json!({
                                "turnId": task_id,
                                "stepIndex": step_index,
                                "transient": true,
                                "delta": format!(
                                    "Step {}/{} still running ({}s elapsed).",
                                    step_index + 1,
                                    total_steps,
                                    elapsed_secs
                                ),
                            }),
                            request_id.as_deref(),
                        );
                    }
                    let next_heartbeat_interval_ms =
                        resolve_agent_task_step_heartbeat_interval_ms(step_started_at.elapsed());
                    step_heartbeat_sleep.as_mut().reset(
                        tokio::time::Instant::now()
                            + Duration::from_millis(next_heartbeat_interval_ms),
                    );
                }
                _ = async {
                    if let Some(timeout_sleep) = step_timeout_sleep.as_mut() {
                        timeout_sleep.as_mut().await;
                    }
                }, if step_timeout_sleep.is_some() => {
                    let timeout_ms = step.timeout_ms.unwrap_or(0);
                    let timeout_message = if timeout_ms > 0 {
                        format!("Step timed out after {timeout_ms}ms.")
                    } else {
                        "Step timed out.".to_string()
                    };
                    execution_cancel.cancel();
                    let _ = executed_task.wait_with_timeout_or_abort().await;
                    let finished_at = now_ms();
                    {
                        let mut store = ctx.agent_tasks.write().await;
                        if let Some(task) = store.tasks.get_mut(task_id.as_str()) {
                            task.summary.status = AgentTaskStatus::Failed.as_str().to_string();
                            task.summary.error_code = Some("STEP_TIMEOUT".to_string());
                            task.summary.error_message = Some(timeout_message.clone());
                            task.summary.completed_at = Some(finished_at);
                            task.summary.updated_at = finished_at;
                            task.summary.current_step = None;
                            if let Some(step_summary) = task.summary.steps.get_mut(step_index) {
                                step_summary.status = AgentTaskStatus::Failed.as_str().to_string();
                                step_summary.error_code = Some("STEP_TIMEOUT".to_string());
                                step_summary.error_message = Some(timeout_message.clone());
                                step_summary.message = timeout_message.clone();
                                step_summary.completed_at = Some(finished_at);
                                step_summary.updated_at = finished_at;
                                let mut step_metadata = step_summary.metadata.clone();
                                apply_tool_inspector_metadata(
                                    &mut step_metadata,
                                    &step_inspector_metadata,
                                );
                                step_summary.metadata = step_metadata;
                            }
                        }
                    }
                    let _ = checkpoint_agent_task_runtime_state(
                        &ctx,
                        task_id.as_str(),
                        AgentTaskStatus::Failed.as_str(),
                    )
                    .await;
                    let duration_ms = step_started_at
                        .elapsed()
                        .as_millis()
                        .min(u128::from(u64::MAX)) as u64;
                    record_runtime_tool_outcome(
                        &ctx,
                        step.kind.as_str(),
                        tool_scope,
                        runtime_tool_metrics::RuntimeToolExecutionStatus::Timeout,
                        finished_at,
                        Some(duration_ms),
                        Some("STEP_TIMEOUT"),
                        request_id.as_deref(),
                        Some(trace_id.as_str()),
                        Some(tool_call_id.as_str()),
                        workspace_id.as_str(),
                        tool_attempt,
                    )
                    .await;
                    let trace_id = agent_task_trace_id(task_id.as_str());
                    let tool_result_checkpoint_id = checkpoint_tool_call_lifecycle(
                        &ctx,
                        task_id.as_str(),
                        workspace_id.as_str(),
                        tool_call_id.as_str(),
                        step.kind.as_str(),
                        "result",
                        Some(false),
                        Some("timeout"),
                        Some(duration_ms),
                        Some(task_id.as_str()),
                        tool_attempt,
                        task_recovered,
                        json!({
                            "error": {
                                "code": "STEP_TIMEOUT",
                                "message": timeout_message.clone(),
                            },
                        }),
                    );
                    let mut tool_result_payload = build_tool_result_event_payload(
                        task_id.as_str(),
                        tool_call_id.as_str(),
                        step.kind.as_str(),
                        false,
                        None,
                        Some("STEP_TIMEOUT"),
                        Some(timeout_message.clone()),
                        Some(task_id.as_str()),
                        tool_attempt,
                        tool_result_checkpoint_id.as_deref(),
                        trace_id.as_str(),
                        Some("timeout"),
                        Some(duration_ms),
                        task_recovered,
                    );
                    apply_tool_inspector_to_tool_result_payload(
                        &mut tool_result_payload,
                        &step_inspector_metadata,
                    );
                    publish_turn_event(
                        &ctx,
                        TURN_EVENT_TOOL_RESULT,
                        tool_result_payload,
                        request_id.as_deref(),
                    );
                    publish_turn_event(
                        &ctx,
                        TURN_EVENT_FAILED,
                        json!({
                            "turnId": task_id,
                            "error": {
                                "code": "STEP_TIMEOUT",
                                "message": timeout_message,
                            },
                        }),
                        request_id.as_deref(),
                    );
                    return;
                }
            }
        };
        if !post_exec_outcome::handle_step_post_exec_outcome(
            &ctx,
            task_id.as_str(),
            step_index,
            total_steps,
            &step,
            executed,
            step_started_at,
            workspace_id.as_str(),
            request_id.as_deref(),
            tool_scope,
            tool_call_id.as_str(),
            tool_attempt,
            task_recovered,
            &step_inspector_metadata,
        )
        .await
        {
            return;
        }
    }

    finalize_agent_task_completion(&ctx, task_id.as_str(), request_id.as_deref()).await;
}
