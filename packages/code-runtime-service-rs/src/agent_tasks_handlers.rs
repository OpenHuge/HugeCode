use super::agent_policy::{
    create_agent_step_summary, ensure_agent_task_capacity, is_agent_task_terminal_status,
    normalize_agent_profile, validate_agent_task_steps,
};
use super::*;
#[path = "agent_tasks_handlers_intervention.rs"]
mod intervention;
#[path = "agent_tasks_handlers_placement.rs"]
mod placement;
#[path = "agent_tasks_handlers_start.rs"]
mod start;
#[path = "agent_tasks_handlers_support.rs"]
mod support;
pub(super) use intervention::handle_agent_task_intervene;
use placement::{
    normalize_execution_mode, select_backend_for_agent_task, RuntimeBackendPlacementContext,
};
use support::{
    build_agent_task_response_payload_for_ctx, build_agent_task_runtime_response_payload_for_ctx,
    checkpoint_agent_task_runtime_and_cache, clear_auto_drive_stop_state,
    clone_runtime_backend_snapshot, collect_workspace_roots_by_id, prepare_auto_drive_for_child,
    resolve_agent_approval_wait_timeout_ms, set_auto_drive_stop_state, APPROVAL_TIMEOUT_ERROR_CODE,
    APPROVAL_TIMEOUT_ERROR_MESSAGE,
};
pub(crate) use support::{
    build_agent_task_runtime_response_payload, derive_agent_task_review_pack_id,
    refresh_agent_task_runtime_execution_truth,
};

pub(super) async fn handle_agent_task_start(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    start::handle_agent_task_start(ctx, params).await
}

#[derive(Clone, Debug)]
struct LaunchAgentTaskSpec {
    workspace_id: String,
    thread_id: Option<String>,
    request_id: Option<String>,
    title: Option<String>,
    task_source: Option<AgentTaskSourceSummary>,
    execution_profile_id: Option<String>,
    review_profile_id: Option<String>,
    validation_preset_id: Option<String>,
    provider_hint: Option<String>,
    model_id_hint: Option<String>,
    reason_effort: Option<String>,
    access_mode: String,
    agent_profile: String,
    execution_mode: String,
    required_capabilities: Vec<String>,
    preferred_backend_ids: Vec<String>,
    max_subtasks: Option<u32>,
    mission_brief: Option<AgentTaskMissionBriefRecord>,
    relaunch_context: Option<AgentTaskRelaunchContextRecord>,
    steps: Vec<AgentTaskStepInput>,
    auto_drive: Option<AgentTaskAutoDriveState>,
    root_task_id: Option<String>,
    parent_task_id: Option<String>,
}

fn initialize_auto_drive_state(
    auto_drive: Option<AgentTaskAutoDriveState>,
) -> Option<AgentTaskAutoDriveState> {
    auto_drive.map(|mut state| {
        if state.enabled.is_none() {
            state.enabled = Some(true);
        }
        let waypoint_indicators = state
            .destination
            .done_definition
            .as_ref()
            .and_then(|definition| definition.waypoint_indicators.clone())
            .unwrap_or_default();
        let active_waypoint = waypoint_indicators.first().cloned();
        state.navigation = Some(match state.navigation.take() {
            Some(mut navigation) => {
                if navigation.active_waypoint.is_none() {
                    navigation.active_waypoint = active_waypoint;
                }
                if navigation.completed_waypoints.is_none() {
                    navigation.completed_waypoints = Some(Vec::new());
                }
                if navigation.pending_waypoints.is_none() {
                    navigation.pending_waypoints = Some(waypoint_indicators);
                }
                if navigation.reroute_count.is_none() {
                    navigation.reroute_count = Some(0);
                }
                if navigation.validation_failure_count.is_none() {
                    navigation.validation_failure_count = Some(0);
                }
                if navigation.no_progress_iterations.is_none() {
                    navigation.no_progress_iterations = Some(0);
                }
                navigation
            }
            None => AgentTaskAutoDriveNavigation {
                active_waypoint,
                completed_waypoints: Some(Vec::new()),
                pending_waypoints: Some(waypoint_indicators),
                last_progress_at: None,
                reroute_count: Some(0),
                validation_failure_count: Some(0),
                no_progress_iterations: Some(0),
            },
        });
        state.recovery = None;
        state.stop = None;
        state
    })
}

async fn link_agent_task_lineage(
    ctx: &AppContext,
    parent_task_id: Option<&str>,
    child_task_id: &str,
) {
    let Some(parent_task_id) = parent_task_id else {
        return;
    };

    let parent_snapshot = {
        let mut store = ctx.agent_tasks.write().await;
        let Some(parent) = store.tasks.get_mut(parent_task_id) else {
            return;
        };
        let child_ids = parent.summary.child_task_ids.get_or_insert_with(Vec::new);
        if !child_ids.iter().any(|existing| existing == child_task_id) {
            child_ids.push(child_task_id.to_string());
        }
        parent.summary.updated_at = now_ms();
        let _ = checkpoint_agent_task_runtime_and_cache(ctx, parent, "child_task_spawned");
        parent.summary.clone()
    };

    if ctx.distributed_config.enabled {
        if let Err(error) = persist_distributed_task_summary(ctx, &parent_snapshot).await {
            warn!(
                error = error.as_str(),
                task_id = parent_snapshot.task_id.as_str(),
                "failed to persist parent task lineage after child spawn"
            );
            set_distributed_dispatch_error(ctx, DISTRIBUTED_ERROR_SOURCE_STATE_SYNC, error).await;
        }
    }
}

async fn launch_agent_task(
    ctx: &AppContext,
    spec: LaunchAgentTaskSpec,
) -> Result<(String, Value), RpcError> {
    let execution_mode = normalize_execution_mode(Some(spec.execution_mode.as_str()))?;
    validate_agent_task_steps(
        &spec.steps,
        spec.access_mode.as_str(),
        spec.agent_profile.as_str(),
    )?;

    let (route, routed_model_id, routed_source) = compute_agent_route(
        ctx,
        spec.provider_hint.as_deref(),
        spec.model_id_hint.as_deref(),
    )?;
    let task_id = new_id("agent-task");
    let now = now_ms();
    let distributed_mode_requested = execution_mode == "distributed";
    let placement_context = if distributed_mode_requested {
        let store = ctx.agent_tasks.read().await;
        let resume_backend_id = spec
            .relaunch_context
            .as_ref()
            .and_then(|context| context.source_task_id.as_deref())
            .into_iter()
            .chain(spec.parent_task_id.as_deref())
            .chain(spec.root_task_id.as_deref())
            .find_map(|task_id| {
                store
                    .tasks
                    .get(task_id)
                    .and_then(|runtime| runtime.summary.backend_id.clone())
            });
        RuntimeBackendPlacementContext {
            preferred_backend_ids: spec.preferred_backend_ids.clone(),
            resume_backend_id,
        }
    } else {
        RuntimeBackendPlacementContext::default()
    };
    let step_summaries = spec
        .steps
        .iter()
        .enumerate()
        .map(|(index, step)| create_agent_step_summary(index, step))
        .collect::<Vec<_>>();
    let mut summary = AgentTaskSummary {
        task_id: task_id.clone(),
        workspace_id: spec.workspace_id.clone(),
        thread_id: spec.thread_id.clone(),
        request_id: spec.request_id.clone(),
        title: spec.title.clone(),
        task_source: crate::runtime_helpers::derive_agent_task_source_summary(
            spec.task_source.clone(),
            Some(spec.workspace_id.as_str()),
            spec.thread_id.as_deref(),
            spec.request_id.as_deref(),
            task_id.as_str(),
            spec.title.as_deref(),
        ),
        status: AgentTaskStatus::Queued.as_str().to_string(),
        access_mode: spec.access_mode.clone(),
        execution_profile_id: spec.execution_profile_id.clone(),
        review_profile_id: spec.review_profile_id.clone(),
        agent_profile: spec.agent_profile.clone(),
        provider: spec.provider_hint.clone(),
        model_id: spec.model_id_hint.clone(),
        reason_effort: spec.reason_effort.clone(),
        routed_provider: Some(route.routed_provider().to_string()),
        routed_model_id: Some(routed_model_id),
        routed_pool: Some(route.routed_pool().to_string()),
        routed_source: Some(routed_source),
        current_step: None,
        created_at: now,
        updated_at: now,
        started_at: None,
        completed_at: None,
        error_code: None,
        error_message: None,
        pending_approval_id: None,
        pending_approval: None,
        validation_preset_id: spec.validation_preset_id.clone(),
        review_decision: None,
        mission_brief: spec.mission_brief.clone(),
        relaunch_context: spec.relaunch_context.clone(),
        auto_drive: initialize_auto_drive_state(spec.auto_drive.clone()),
        backend_id: None,
        acp_integration_id: None,
        acp_session_id: None,
        acp_config_options: None,
        acp_available_commands: None,
        preferred_backend_ids: (!spec.preferred_backend_ids.is_empty())
            .then(|| spec.preferred_backend_ids.clone()),
        placement_fallback_reason_code: None,
        resume_backend_id: placement_context.resume_backend_id.clone(),
        placement_score_breakdown: None,
        root_task_id: spec.root_task_id.clone().or_else(|| {
            if distributed_mode_requested {
                Some(task_id.clone())
            } else {
                None
            }
        }),
        parent_task_id: spec.parent_task_id.clone(),
        child_task_ids: if distributed_mode_requested
            || spec.parent_task_id.is_some()
            || spec.root_task_id.is_some()
        {
            Some(Vec::new())
        } else {
            None
        },
        distributed_status: if distributed_mode_requested {
            Some("planning".to_string())
        } else {
            None
        },
        steps: step_summaries,
    };
    if distributed_mode_requested {
        let placement_outcome = select_backend_for_agent_task(
            ctx,
            spec.required_capabilities.as_slice(),
            &placement_context,
        )
        .await?;
        summary.backend_id = Some(placement_outcome.selected_backend_id);
        summary.placement_fallback_reason_code = placement_outcome.fallback_reason_code;
        summary.resume_backend_id = placement_outcome.resume_backend_id;
        summary.placement_score_breakdown = Some(
            serde_json::to_value(placement_outcome.score_breakdown).map_err(|error| {
                RpcError::internal(format!(
                    "Failed to serialize placement score breakdown: {error}"
                ))
            })?,
        );
    }

    {
        let mut store = ctx.agent_tasks.write().await;
        if store.tasks.contains_key(task_id.as_str()) {
            return Err(RpcError::internal("Agent task id collision."));
        }
        if !ensure_agent_task_capacity(&mut store, ctx.config.agent_task_history_limit) {
            return Err(RpcError::invalid_params(format!(
                "Agent task queue is full ({} entries) and all tasks are still active. Wait for running tasks to finish or interrupt older tasks.",
                ctx.config.agent_task_history_limit
            )));
        }
        store.order.push_back(task_id.clone());
        store.tasks.insert(
            task_id.clone(),
            AgentTaskRuntime {
                summary: summary.clone(),
                steps_input: spec.steps.clone(),
                interrupt_requested: false,
                checkpoint_id: None,
                review_actionability: None,
                execution_graph: None,
                takeover_bundle: None,
                recovered: false,
                last_tool_signature: None,
                consecutive_tool_signature_count: 0,
                interrupt_waiter: Arc::new(Notify::new()),
                approval_waiter: Arc::new(Notify::new()),
            },
        );
        if let Some(task) = store.tasks.get_mut(task_id.as_str()) {
            let _ = checkpoint_agent_task_runtime_and_cache(
                ctx,
                task,
                AgentTaskStatus::Queued.as_str(),
            );
        }
    }
    if ctx.distributed_config.enabled {
        if let Err(error) = persist_distributed_task_summary(ctx, &summary).await {
            set_distributed_dispatch_error(ctx, DISTRIBUTED_ERROR_SOURCE_STATE_SYNC, error.clone())
                .await;
            let mut store = ctx.agent_tasks.write().await;
            store.tasks.remove(task_id.as_str());
            store.order.retain(|entry| entry != task_id.as_str());
            return Err(RpcError::internal(format!(
                "Distributed task state persistence failed: {error}"
            )));
        }

        let lane = distributed::routing::compute_workspace_lane(
            summary.workspace_id.as_str(),
            ctx.distributed_config.lane_count,
        );
        let start_command = distributed::queue::DistributedCommandEnvelope::new(
            summary.task_id.clone(),
            Some(summary.workspace_id.clone()),
            summary.thread_id.clone(),
            summary.request_id.clone(),
            lane,
            distributed::queue::COMMAND_KIND_TASK_START,
            json!({
                "provider": summary.provider.clone(),
                "modelId": summary.model_id.clone(),
                "accessMode": summary.access_mode.clone(),
                "agentProfile": summary.agent_profile.clone(),
                "stepCount": summary.steps.len(),
                "executionMode": execution_mode,
                "backendId": summary.backend_id.clone(),
                "requiredCapabilities": if spec.required_capabilities.is_empty() {
                    Value::Null
                } else {
                    json!(spec.required_capabilities)
                },
                "maxSubtasks": spec.max_subtasks,
                "preferredBackendIds": if spec.preferred_backend_ids.is_empty() {
                    Value::Null
                } else {
                    json!(spec.preferred_backend_ids)
                },
                "missionBrief": summary.mission_brief.clone(),
                "relaunchContext": summary.relaunch_context.clone(),
                "rootTaskId": summary.root_task_id.clone(),
                "parentTaskId": summary.parent_task_id.clone(),
                "autoDrive": summary.auto_drive.clone(),
            }),
        );
        if let Err(error) = enqueue_distributed_agent_command(ctx, start_command).await {
            if let Some(client) = ctx.distributed_redis_client.as_ref() {
                if let Err(cleanup_error) = distributed::state_store::remove_task_summary(
                    client.as_ref(),
                    summary.workspace_id.as_str(),
                    summary.task_id.as_str(),
                )
                .await
                {
                    warn!(
                        error = cleanup_error.as_str(),
                        task_id = summary.task_id.as_str(),
                        "failed to rollback distributed task state after enqueue failure"
                    );
                }
            }
            let mut store = ctx.agent_tasks.write().await;
            store.tasks.remove(task_id.as_str());
            store.order.retain(|entry| entry != task_id.as_str());
            return Err(error);
        }
    }

    link_agent_task_lineage(ctx, summary.parent_task_id.as_deref(), task_id.as_str()).await;
    let _ = super::spawn_agent_task_execution(ctx.clone(), task_id.clone());

    let response_payload = {
        let runtime_snapshot = {
            let store = ctx.agent_tasks.read().await;
            store.tasks.get(task_id.as_str()).cloned()
        };
        let backend_snapshot = {
            let backend_store = ctx.runtime_backends.read().await;
            runtime_snapshot
                .as_ref()
                .and_then(|runtime| {
                    clone_runtime_backend_snapshot(
                        &backend_store,
                        runtime.summary.backend_id.as_deref(),
                    )
                })
                .or_else(|| {
                    clone_runtime_backend_snapshot(&backend_store, summary.backend_id.as_deref())
                })
        };
        if let Some(runtime) = runtime_snapshot.as_ref() {
            build_agent_task_runtime_response_payload_for_ctx(
                ctx,
                runtime,
                backend_snapshot.as_ref(),
            )
            .await?
        } else {
            build_agent_task_response_payload_for_ctx(
                ctx,
                &summary,
                false,
                None,
                backend_snapshot.as_ref(),
            )
            .await?
        }
    };
    Ok((task_id, response_payload))
}

#[derive(Clone, Debug)]
struct ApprovalTimeoutSweepRecord {
    task_id: String,
    approval_id: String,
    action: Option<String>,
    request_id: Option<String>,
    summary: AgentTaskSummary,
}

async fn increment_approval_timeout_metric(ctx: &AppContext) {
    let _ = crate::runtime_tool_safety_counters::record_runtime_tool_safety_counter(
        ctx,
        runtime_tool_metrics::RuntimeToolSafetyCounter::ApprovalTimeout,
        "increment approval-timeout runtime tool metric failed",
    )
    .await;
}

pub(super) async fn sweep_agent_approval_timeouts(ctx: &AppContext) -> usize {
    let timeout_ms = resolve_agent_approval_wait_timeout_ms();
    let now = now_ms();
    let candidate_task_ids = {
        let store = ctx.agent_tasks.read().await;
        store
            .tasks
            .iter()
            .filter_map(|(task_id, task)| {
                let pending = task.summary.pending_approval.as_ref()?;
                let should_timeout = task.summary.status
                    == AgentTaskStatus::AwaitingApproval.as_str()
                    && pending.decision.is_none()
                    && now.saturating_sub(pending.created_at) >= timeout_ms;
                if should_timeout {
                    Some(task_id.clone())
                } else {
                    None
                }
            })
            .collect::<Vec<_>>()
    };

    if candidate_task_ids.is_empty() {
        return 0;
    }

    let mut timed_out = Vec::new();
    let mut terminalization_noop_task_ids = Vec::new();
    {
        let mut store = ctx.agent_tasks.write().await;
        for task_id in candidate_task_ids {
            let (approval_id, pending_approval_id, action, request_id, summary) = {
                let Some(task) = store.tasks.get_mut(task_id.as_str()) else {
                    continue;
                };
                if task.summary.status != AgentTaskStatus::AwaitingApproval.as_str() {
                    continue;
                }
                let Some(pending) = task.summary.pending_approval.as_ref() else {
                    continue;
                };
                if pending.decision.is_some() {
                    continue;
                }
                if now.saturating_sub(pending.created_at) < timeout_ms {
                    continue;
                }

                let approval_id = pending.approval_id.clone();
                let pending_step_index = pending.step_index;
                let pending_approval_id = task.summary.pending_approval_id.clone();
                let action = {
                    let normalized = pending.action.trim();
                    if normalized.is_empty() {
                        None
                    } else {
                        Some(normalized.to_string())
                    }
                };
                let finalized = try_finalize_agent_task_runtime(task, |task| {
                    task.summary.status = AgentTaskStatus::Failed.as_str().to_string();
                    task.summary.error_code = Some(APPROVAL_TIMEOUT_ERROR_CODE.to_string());
                    task.summary.error_message = Some(APPROVAL_TIMEOUT_ERROR_MESSAGE.to_string());
                    task.summary.current_step = None;
                    task.summary.completed_at = Some(now);
                    task.summary.updated_at = now;
                    if let Some(step_summary) = task.summary.steps.get_mut(pending_step_index) {
                        step_summary.status = AgentTaskStatus::Failed.as_str().to_string();
                        step_summary.error_code = Some(APPROVAL_TIMEOUT_ERROR_CODE.to_string());
                        step_summary.error_message =
                            Some(APPROVAL_TIMEOUT_ERROR_MESSAGE.to_string());
                        step_summary.updated_at = now;
                    }
                });
                if !finalized {
                    terminalization_noop_task_ids.push(task.summary.task_id.clone());
                    continue;
                }
                task.summary.pending_approval_id = None;
                task.summary.pending_approval = None;
                task.approval_waiter.notify_waiters();
                let _ = checkpoint_agent_task_runtime_and_cache(
                    ctx,
                    task,
                    AgentTaskStatus::Failed.as_str(),
                );
                let request_id = task.summary.request_id.clone();
                let summary = task.summary.clone();
                (
                    approval_id,
                    pending_approval_id,
                    action,
                    request_id,
                    summary,
                )
            };

            store.approval_index.remove(approval_id.as_str());
            if let Some(pending_approval_id) = pending_approval_id {
                store.approval_index.remove(pending_approval_id.as_str());
            }

            timed_out.push(ApprovalTimeoutSweepRecord {
                task_id: summary.task_id.clone(),
                approval_id,
                action,
                request_id,
                summary,
            });
        }
    }

    for task_id in terminalization_noop_task_ids {
        increment_terminalization_cas_noop_metric(ctx, task_id.as_str(), "approval_timeout_sweep")
            .await;
    }

    if timed_out.is_empty() {
        return 0;
    }

    for record in timed_out.iter() {
        publish_turn_event(
            ctx,
            TURN_EVENT_APPROVAL_RESOLVED,
            json!({
                "approvalId": record.approval_id,
                "turnId": record.task_id,
                "status": "error",
                "reason": APPROVAL_TIMEOUT_ERROR_MESSAGE,
                "action": record.action,
            }),
            record.request_id.as_deref(),
        );
        publish_turn_event(
            ctx,
            TURN_EVENT_FAILED,
            json!({
                "turnId": record.task_id,
                "error": {
                    "code": APPROVAL_TIMEOUT_ERROR_CODE,
                    "message": APPROVAL_TIMEOUT_ERROR_MESSAGE,
                },
            }),
            record.request_id.as_deref(),
        );
        increment_approval_timeout_metric(ctx).await;
    }

    if ctx.distributed_config.enabled {
        let mut persisted_all = true;
        for record in timed_out.iter() {
            if let Err(error) = persist_distributed_task_summary(ctx, &record.summary).await {
                warn!(
                    error = error.as_str(),
                    task_id = record.task_id.as_str(),
                    "failed to persist distributed task summary after approval timeout sweep"
                );
                set_distributed_dispatch_error(ctx, DISTRIBUTED_ERROR_SOURCE_STATE_SYNC, error)
                    .await;
                persisted_all = false;
            }
        }
        if persisted_all {
            clear_distributed_dispatch_error(ctx, DISTRIBUTED_ERROR_SOURCE_STATE_SYNC).await;
        }
    }

    timed_out.len()
}

pub(super) async fn handle_agent_task_interrupt(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let request = parse_agent_task_interrupt_request(params)?;
    if ctx.distributed_config.enabled {
        let distributed_meta = {
            let store = ctx.agent_tasks.read().await;
            store.tasks.get(request.task_id.as_str()).map(|task| {
                (
                    task.summary.workspace_id.clone(),
                    task.summary.thread_id.clone(),
                    task.summary.request_id.clone(),
                    task.summary.status.clone(),
                )
            })
        };
        if let Some((workspace_id, thread_id, request_id, status)) = distributed_meta {
            if !is_agent_task_terminal_status(status.as_str()) {
                let lane = distributed::routing::compute_workspace_lane(
                    workspace_id.as_str(),
                    ctx.distributed_config.lane_count,
                );
                let command = distributed::queue::DistributedCommandEnvelope::new(
                    request.task_id.clone(),
                    Some(workspace_id),
                    thread_id,
                    request_id,
                    lane,
                    distributed::queue::COMMAND_KIND_TASK_INTERRUPT,
                    json!({
                        "reason": request.reason.clone(),
                    }),
                );
                enqueue_distributed_agent_command(ctx, command).await?;
            }
        }
    }

    let mut store = ctx.agent_tasks.write().await;
    let Some(task) = store.tasks.get_mut(request.task_id.as_str()) else {
        return Ok(json!({
            "accepted": false,
            "taskId": request.task_id,
            "status": Value::Null,
            "message": "Task not found.",
        }));
    };

    if is_agent_task_terminal_status(task.summary.status.as_str()) {
        return Ok(json!({
            "accepted": false,
            "taskId": task.summary.task_id,
            "status": task.summary.status,
            "message": "Task is already in terminal state.",
        }));
    }

    task.interrupt_requested = true;
    let _ = crate::acp_runtime::cancel_session_by_task(ctx, request.task_id.as_str()).await;
    task.summary.updated_at = now_ms();
    let mut emit_turn_failed = false;
    if matches!(
        task.summary.status.as_str(),
        "queued" | "running" | "awaiting_approval"
    ) {
        let interrupted_at = now_ms();
        task.summary.status = AgentTaskStatus::Interrupted.as_str().to_string();
        task.summary.error_code = Some("TASK_INTERRUPTED".to_string());
        task.summary.error_message = Some(
            request
                .reason
                .clone()
                .unwrap_or_else(|| "Task interrupted by operator.".to_string()),
        );
        task.summary.current_step = None;
        task.summary.completed_at = Some(interrupted_at);
        task.summary.updated_at = interrupted_at;
        set_auto_drive_stop_state(
            &mut task.summary.auto_drive,
            "cancelled",
            task.summary.error_message.clone(),
        );
        emit_turn_failed = true;
    }
    task.interrupt_waiter.notify_waiters();
    task.approval_waiter.notify_waiters();
    let _ =
        checkpoint_agent_task_runtime_and_cache(ctx, task, AgentTaskStatus::Interrupted.as_str());
    let summary_snapshot = task.summary.clone();
    let response = json!({
        "accepted": true,
        "taskId": task.summary.task_id,
        "status": task.summary.status,
        "message": task.summary.error_message.clone().unwrap_or_else(|| "Interrupt signal accepted.".to_string()),
    });
    drop(store);

    if ctx.distributed_config.enabled {
        if let Err(error) = persist_distributed_task_summary(ctx, &summary_snapshot).await {
            warn!(
                error = error.as_str(),
                task_id = summary_snapshot.task_id.as_str(),
                "failed to persist distributed task summary after interrupt"
            );
            set_distributed_dispatch_error(ctx, DISTRIBUTED_ERROR_SOURCE_STATE_SYNC, error).await;
        } else {
            clear_distributed_dispatch_error(ctx, DISTRIBUTED_ERROR_SOURCE_STATE_SYNC).await;
        }
    }

    if emit_turn_failed {
        publish_turn_event(
            ctx,
            TURN_EVENT_FAILED,
            json!({
                "turnId": summary_snapshot.task_id,
                "error": {
                    "code": summary_snapshot.error_code.clone().unwrap_or_else(|| "TASK_INTERRUPTED".to_string()),
                    "message": summary_snapshot
                        .error_message
                        .clone()
                        .unwrap_or_else(|| "Task interrupted by operator.".to_string()),
                },
            }),
            summary_snapshot.request_id.as_deref(),
        );
    }

    Ok(response)
}

pub(super) async fn handle_agent_task_status(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let request = parse_agent_task_status_request(params)?;
    let runtime_snapshot = {
        let store = ctx.agent_tasks.read().await;
        store.tasks.get(request.task_id.as_str()).cloned()
    };
    let task_payload = if let Some(runtime) = runtime_snapshot.as_ref() {
        let backend_snapshot = {
            let backend_store = ctx.runtime_backends.read().await;
            clone_runtime_backend_snapshot(&backend_store, runtime.summary.backend_id.as_deref())
        };
        Some(
            build_agent_task_runtime_response_payload_for_ctx(
                ctx,
                runtime,
                backend_snapshot.as_ref(),
            )
            .await?,
        )
    } else {
        None
    };
    Ok(json!(task_payload))
}

pub(super) async fn handle_agent_tasks_list(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let request = parse_agent_task_list_request(params)?;
    let limit = request
        .limit
        .unwrap_or(100)
        .clamp(1, ctx.config.agent_task_history_limit as u64) as usize;
    let status_filter = request.status.map(|status| status.as_str().to_string());
    let workspace_filter = request.workspace_id.map(|entry| entry.trim().to_string());

    let runtimes = {
        let store = ctx.agent_tasks.read().await;
        let mut filtered = Vec::new();
        for task_id in store.order.iter().rev() {
            let Some(runtime) = store.tasks.get(task_id.as_str()) else {
                continue;
            };
            if let Some(status) = status_filter.as_deref() {
                if runtime.summary.status != status {
                    continue;
                }
            }
            if let Some(workspace_id) = workspace_filter.as_deref() {
                if runtime.summary.workspace_id != workspace_id {
                    continue;
                }
            }
            filtered.push(runtime.clone());
            if filtered.len() >= limit {
                break;
            }
        }
        filtered
    };
    let backend_store = ctx.runtime_backends.read().await;
    let workspace_roots_by_id = collect_workspace_roots_by_id(ctx).await;
    let mut results = Vec::new();
    for runtime in &runtimes {
        let backend_snapshot =
            clone_runtime_backend_snapshot(&backend_store, runtime.summary.backend_id.as_deref());
        results.push(build_agent_task_runtime_response_payload(
            runtime,
            backend_snapshot.as_ref(),
            workspace_roots_by_id
                .get(runtime.summary.workspace_id.as_str())
                .map(String::as_str),
        )?);
    }

    Ok(Value::Array(results))
}

pub(super) async fn handle_agent_approval_decision(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let request = parse_agent_approval_decision_request(params)?;
    if ctx.distributed_config.enabled {
        let distributed_meta = {
            let store = ctx.agent_tasks.read().await;
            if let Some(task_id) = store.approval_index.get(request.approval_id.as_str()) {
                store.tasks.get(task_id.as_str()).map(|task| {
                    (
                        task.summary.task_id.clone(),
                        task.summary.workspace_id.clone(),
                        task.summary.thread_id.clone(),
                        task.summary.request_id.clone(),
                    )
                })
            } else {
                None
            }
        };
        if let Some((task_id, workspace_id, thread_id, request_id)) = distributed_meta {
            let lane = distributed::routing::compute_workspace_lane(
                workspace_id.as_str(),
                ctx.distributed_config.lane_count,
            );
            let command = distributed::queue::DistributedCommandEnvelope::new(
                task_id,
                Some(workspace_id),
                thread_id,
                request_id,
                lane,
                distributed::queue::COMMAND_KIND_APPROVAL_DECISION,
                json!({
                    "approvalId": request.approval_id.clone(),
                    "decision": request.decision.as_str(),
                    "reason": request.reason.clone(),
                }),
            );
            enqueue_distributed_agent_command(ctx, command).await?;
        }
    }

    let mut store = ctx.agent_tasks.write().await;
    let Some(task_id) = store
        .approval_index
        .get(request.approval_id.as_str())
        .cloned()
    else {
        return Ok(json!({
            "recorded": false,
            "approvalId": request.approval_id,
            "taskId": Value::Null,
            "status": Value::Null,
            "message": "Approval request not found.",
        }));
    };
    let Some(task) = store.tasks.get(task_id.as_str()) else {
        store.approval_index.remove(request.approval_id.as_str());
        return Ok(json!({
            "recorded": false,
            "approvalId": request.approval_id,
            "taskId": task_id,
            "status": Value::Null,
            "message": "Task for approval request not found.",
        }));
    };
    let (task_summary_id, task_status, approval_matches) = {
        let Some(pending) = task.summary.pending_approval.as_ref() else {
            return Ok(json!({
                "recorded": false,
                "approvalId": request.approval_id,
                "taskId": task.summary.task_id,
                "status": task.summary.status,
                "message": "Task has no pending approval.",
            }));
        };
        (
            task.summary.task_id.clone(),
            task.summary.status.clone(),
            pending.approval_id == request.approval_id,
        )
    };

    if !approval_matches {
        return Ok(json!({
            "recorded": false,
            "approvalId": request.approval_id,
            "taskId": task_summary_id,
            "status": task_status,
            "message": "Approval id does not match current task pending approval.",
        }));
    }

    let Some(task) = store.tasks.get_mut(task_id.as_str()) else {
        return Ok(json!({
            "recorded": false,
            "approvalId": request.approval_id,
            "taskId": task_id,
            "status": Value::Null,
            "message": "Task disappeared while recording approval decision.",
        }));
    };
    let Some(pending) = task.summary.pending_approval.as_mut() else {
        return Ok(json!({
            "recorded": false,
            "approvalId": request.approval_id,
            "taskId": task.summary.task_id,
            "status": task.summary.status,
            "message": "Task has no pending approval.",
        }));
    };

    pending.decision = Some(request.decision.as_str().to_string());
    pending.decision_reason = trim_optional_string(request.reason.clone());
    pending.decided_at = Some(now_ms());
    task.summary.updated_at = now_ms();
    task.approval_waiter.notify_waiters();
    let _ = checkpoint_agent_task_runtime_and_cache(ctx, task, "approval_decision");
    let summary_snapshot = task.summary.clone();
    let response = json!({
        "recorded": true,
        "approvalId": request.approval_id,
        "taskId": task.summary.task_id,
        "status": task.summary.status,
        "message": "Approval decision recorded.",
    });
    drop(store);

    if ctx.distributed_config.enabled {
        if let Err(error) = persist_distributed_task_summary(ctx, &summary_snapshot).await {
            warn!(
                error = error.as_str(),
                task_id = summary_snapshot.task_id.as_str(),
                "failed to persist distributed task summary after approval decision"
            );
            set_distributed_dispatch_error(ctx, DISTRIBUTED_ERROR_SOURCE_STATE_SYNC, error).await;
        } else {
            clear_distributed_dispatch_error(ctx, DISTRIBUTED_ERROR_SOURCE_STATE_SYNC).await;
        }
    }

    Ok(response)
}

pub(super) async fn handle_agent_task_resume(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let task_id = intervention::parse_agent_task_resume_task_id(params)?;
    let (response, task_to_resume) = {
        let mut store = ctx.agent_tasks.write().await;
        if !store.tasks.contains_key(task_id.as_str()) {
            if let Some(recovered_runtime) = recover_agent_task_runtime_by_id(
                ctx.agent_task_durability.as_ref(),
                task_id.as_str(),
            ) {
                store.order.push_back(task_id.clone());
                store.tasks.insert(task_id.clone(), recovered_runtime);
            }
        }
        let Some(task) = store.tasks.get_mut(task_id.as_str()) else {
            ctx.agent_task_durability.record_agent_task_resume(false);
            ctx.runtime_diagnostics
                .record_agent_recovery_result(false, None);
            return Ok(json!({
                "accepted": false,
                "taskId": task_id,
                "status": Value::Null,
                "message": "Task not found.",
                "recovered": false,
            }));
        };
        if !intervention::is_agent_task_resumable(&task.summary) {
            ctx.agent_task_durability.record_agent_task_resume(false);
            ctx.runtime_diagnostics
                .record_agent_recovery_result(false, None);
            return Ok(json!({
                "accepted": false,
                "taskId": task.summary.task_id,
                "status": task.summary.status,
                "message": "Task is not resumable.",
                "recovered": false,
            }));
        }
        let resume_requested_at = now_ms();
        let interrupted_at = task.summary.completed_at.unwrap_or(task.summary.updated_at);
        let recovery_latency_ms = resume_requested_at.saturating_sub(interrupted_at);
        let resumable_from_recovery = is_agent_task_recovery_interrupted(&task.summary);
        let pending_approval_id = task.summary.pending_approval_id.clone();
        task.summary.pending_approval_id = None;
        task.summary.pending_approval = None;
        task.summary.status = AgentTaskStatus::Queued.as_str().to_string();
        task.summary.error_code = None;
        task.summary.error_message = None;
        task.summary.completed_at = None;
        task.summary.updated_at = now_ms();
        task.interrupt_requested = false;
        task.recovered = task.recovered || resumable_from_recovery;
        clear_auto_drive_stop_state(&mut task.summary.auto_drive);
        intervention::prepare_task_runtime_for_resume(task);
        let checkpoint_id =
            checkpoint_agent_task_runtime_and_cache(ctx, task, AgentTaskStatus::Queued.as_str());
        let resumed_task_id = task.summary.task_id.clone();
        let resumed_status = task.summary.status.clone();
        let resumed_updated_at = task.summary.updated_at;
        let resumed_trace_id = agent_task_trace_id(resumed_task_id.as_str());
        if let Some(approval_id) = pending_approval_id {
            store.approval_index.remove(approval_id.as_str());
        }
        ctx.agent_task_durability.record_agent_task_resume(true);
        ctx.runtime_diagnostics
            .record_agent_recovery_result(true, Some(recovery_latency_ms));
        (
            json!({
                "accepted": true,
                "taskId": resumed_task_id,
                "status": resumed_status,
                "message": "Task resume accepted.",
                "recovered": resumable_from_recovery,
                "checkpointId": checkpoint_id,
                "traceId": resumed_trace_id,
                "updatedAt": resumed_updated_at,
                "recoveryLatencyMs": recovery_latency_ms,
            }),
            Some(resumed_task_id),
        )
    };

    if let Some(task_id) = task_to_resume {
        let _ = super::spawn_agent_task_execution(ctx.clone(), task_id);
    }
    Ok(response)
}
