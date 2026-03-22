use super::runtime_autonomy::autodrive::{mark_auto_drive_failure, mark_auto_drive_progress};
use super::runtime_autonomy::metadata::{
    apply_step_observability_to_tool_result_payload, apply_tool_inspector_metadata,
    apply_tool_inspector_to_tool_result_payload,
};
use super::runtime_autonomy::{maybe_mark_context_compression, ToolInspectorMetadata};
use super::*;

fn merge_step_metadata(base: &mut Value, patch: Value) {
    let Some(patch_object) = patch.as_object() else {
        if !patch.is_null() {
            *base = patch;
        }
        return;
    };
    if let Some(base_object) = base.as_object_mut() {
        for (key, value) in patch_object {
            base_object.insert(key.clone(), value.clone());
        }
        return;
    }
    *base = Value::Object(patch_object.clone());
}

pub(super) async fn handle_step_post_exec_outcome(
    ctx: &AppContext,
    task_id: &str,
    step_index: usize,
    total_steps: usize,
    step: &AgentTaskStepInput,
    executed: Result<Value, RpcError>,
    step_started_at: Instant,
    workspace_id: &str,
    request_id: Option<&str>,
    tool_scope: runtime_tool_metrics::RuntimeToolExecutionScope,
    tool_call_id: &str,
    tool_attempt: Option<u32>,
    task_recovered: bool,
    step_inspector_metadata: &ToolInspectorMetadata,
) -> bool {
    let finished_at = now_ms();
    let step_duration_ms = step_started_at
        .elapsed()
        .as_millis()
        .min(u128::from(u64::MAX)) as u64;
    let trace_id = agent_task_trace_id(task_id);

    match executed {
        Ok(result) => {
            let mut metadata = {
                let store = ctx.agent_tasks.read().await;
                store
                    .tasks
                    .get(task_id)
                    .and_then(|task| task.summary.steps.get(step_index))
                    .map(|step_summary| step_summary.metadata.clone())
                    .unwrap_or_else(|| json!({}))
            };
            let status = result
                .get("status")
                .and_then(Value::as_str)
                .unwrap_or("failed")
                .to_string();
            let message = result
                .get("message")
                .and_then(Value::as_str)
                .unwrap_or("Step completed.")
                .to_string();
            let run_id = result
                .get("runId")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned);
            let output = result
                .get("output")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned);
            merge_step_metadata(
                &mut metadata,
                result.get("metadata").cloned().unwrap_or_else(|| json!({})),
            );
            if let Some(network) = result.get("network") {
                if let Some(metadata_object) = metadata.as_object_mut() {
                    metadata_object.insert("network".to_string(), network.clone());
                } else {
                    metadata = json!({
                        "network": network,
                    });
                }
            }
            let completed = status == "completed";
            let prior_step_statuses = {
                let store = ctx.agent_tasks.read().await;
                store
                    .tasks
                    .get(task_id)
                    .map(|task| {
                        task.summary
                            .steps
                            .iter()
                            .take(step_index)
                            .map(|summary| summary.status.clone())
                            .collect::<Vec<_>>()
                    })
                    .unwrap_or_default()
            };
            maybe_mark_context_compression(
                ctx,
                task_id,
                step_index,
                total_steps,
                request_id,
                output.as_deref(),
                &mut metadata,
                prior_step_statuses.as_slice(),
                completed,
                step_index + 1,
            )
            .await;
            apply_tool_inspector_metadata(&mut metadata, step_inspector_metadata);
            let mut interrupted_message_after_completion: Option<String> = None;
            let mut paused_after_completion = false;

            {
                let mut store = ctx.agent_tasks.write().await;
                let Some(task) = store.tasks.get_mut(task_id) else {
                    return false;
                };
                task.summary.updated_at = finished_at;
                if let Some(step_summary) = task.summary.steps.get_mut(step_index) {
                    step_summary.run_id = run_id.clone();
                    step_summary.output = output.clone();
                    step_summary.metadata = metadata.clone();
                    step_summary.completed_at = Some(finished_at);
                    step_summary.updated_at = finished_at;
                    step_summary.message = message.clone();
                    if completed {
                        step_summary.status = AgentTaskStatus::Completed.as_str().to_string();
                    } else {
                        step_summary.status = AgentTaskStatus::Failed.as_str().to_string();
                        step_summary.error_code = Some("STEP_EXECUTION_FAILED".to_string());
                        step_summary.error_message = Some(message.clone());
                    }
                }
                if !completed {
                    task.summary.status = AgentTaskStatus::Failed.as_str().to_string();
                    task.summary.error_code = Some("STEP_EXECUTION_FAILED".to_string());
                    task.summary.error_message = Some(message.clone());
                    task.summary.completed_at = Some(finished_at);
                    mark_auto_drive_failure(
                        &mut task.summary.auto_drive,
                        if step.kind == AgentStepKind::Diagnostics {
                            "validation_failed"
                        } else {
                            "failed"
                        },
                        Some(message.clone()),
                        finished_at,
                    );
                } else if task.interrupt_requested {
                    let paused = task.summary.status == AgentTaskStatus::Paused.as_str();
                    paused_after_completion = paused;
                    let interrupt_message = task
                        .summary
                        .error_message
                        .clone()
                        .filter(|entry| !entry.trim().is_empty())
                        .unwrap_or_else(|| {
                            if paused {
                                "Task paused by operator.".to_string()
                            } else {
                                "Task interrupted by operator.".to_string()
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
                    task.summary.error_message = Some(interrupt_message.clone());
                    task.summary.current_step = None;
                    task.summary.completed_at = Some(finished_at);
                    task.summary.updated_at = finished_at;
                    interrupted_message_after_completion = Some(interrupt_message);
                } else {
                    mark_auto_drive_progress(&mut task.summary.auto_drive, finished_at);
                }
            }

            let lifecycle_state = if completed {
                if interrupted_message_after_completion.is_some() {
                    if paused_after_completion {
                        AgentTaskStatus::Paused.as_str()
                    } else {
                        AgentTaskStatus::Interrupted.as_str()
                    }
                } else {
                    AgentTaskStatus::Running.as_str()
                }
            } else {
                AgentTaskStatus::Failed.as_str()
            };
            let _ = checkpoint_agent_task_runtime_state(ctx, task_id, lifecycle_state).await;
            let tool_error_code = if completed {
                if interrupted_message_after_completion.is_some() {
                    Some("TASK_INTERRUPTED")
                } else {
                    None
                }
            } else {
                Some("STEP_EXECUTION_FAILED")
            };
            let tool_error_message =
                if let Some(message) = interrupted_message_after_completion.clone() {
                    Some(message)
                } else if completed {
                    None
                } else {
                    Some(message.clone())
                };
            let tool_error_class = tool_error_code
                .map(classify_tool_error_class)
                .map(str::to_string);
            let completion_status = if completed && interrupted_message_after_completion.is_none() {
                runtime_tool_metrics::RuntimeToolExecutionStatus::Success
            } else {
                runtime_tool_metrics::RuntimeToolExecutionStatus::RuntimeFailed
            };
            record_runtime_tool_outcome(
                ctx,
                step.kind.as_str(),
                tool_scope,
                completion_status,
                finished_at,
                Some(step_duration_ms),
                tool_error_code,
                request_id,
                Some(trace_id.as_str()),
                Some(tool_call_id),
                workspace_id,
                tool_attempt,
            )
            .await;
            let tool_result_checkpoint_id = checkpoint_tool_call_lifecycle(
                ctx,
                task_id,
                workspace_id,
                tool_call_id,
                step.kind.as_str(),
                "result",
                Some(completed),
                tool_error_class.as_deref(),
                Some(step_duration_ms),
                Some(task_id),
                tool_attempt,
                task_recovered,
                json!({
                    "output": output.clone(),
                    "error": if let (Some(code), Some(message)) =
                        (tool_error_code, tool_error_message.clone())
                    {
                        json!({
                            "code": code,
                            "message": message,
                        })
                    } else {
                        Value::Null
                    },
                }),
            );
            if !message.trim().is_empty() {
                publish_turn_event(
                    ctx,
                    TURN_EVENT_ITEM_MCP_TOOL_CALL_PROGRESS,
                    json!({
                        "turnId": task_id,
                        "itemId": tool_call_id,
                        "message": message.clone(),
                    }),
                    request_id,
                );
            }
            let mut tool_result_payload = build_tool_result_event_payload(
                task_id,
                tool_call_id,
                step.kind.as_str(),
                completed,
                output.clone(),
                tool_error_code,
                tool_error_message.clone(),
                Some(task_id),
                tool_attempt,
                tool_result_checkpoint_id.as_deref(),
                trace_id.as_str(),
                tool_error_class.as_deref(),
                Some(step_duration_ms),
                task_recovered,
            );
            apply_tool_inspector_to_tool_result_payload(
                &mut tool_result_payload,
                step_inspector_metadata,
            );
            apply_step_observability_to_tool_result_payload(&mut tool_result_payload, &metadata);
            publish_turn_event(ctx, TURN_EVENT_TOOL_RESULT, tool_result_payload, request_id);
            if let Some(message) = interrupted_message_after_completion {
                publish_turn_event(
                    ctx,
                    TURN_EVENT_FAILED,
                    json!({
                        "turnId": task_id,
                        "error": {
                            "code": "TASK_INTERRUPTED",
                            "message": message,
                        },
                    }),
                    request_id,
                );
                return false;
            }
            if !completed {
                publish_turn_event(
                    ctx,
                    TURN_EVENT_FAILED,
                    json!({
                        "turnId": task_id,
                        "error": {
                            "code": "STEP_EXECUTION_FAILED",
                            "message": message,
                        },
                    }),
                    request_id,
                );
                return false;
            }
        }
        Err(error) => {
            {
                let mut store = ctx.agent_tasks.write().await;
                if let Some(task) = store.tasks.get_mut(task_id) {
                    task.summary.status = AgentTaskStatus::Failed.as_str().to_string();
                    task.summary.error_code = Some(error.code.as_str().to_string());
                    task.summary.error_message = Some(error.message.clone());
                    task.summary.completed_at = Some(finished_at);
                    task.summary.updated_at = finished_at;
                    if let Some(step_summary) = task.summary.steps.get_mut(step_index) {
                        step_summary.status = AgentTaskStatus::Failed.as_str().to_string();
                        step_summary.error_code = Some(error.code.as_str().to_string());
                        step_summary.error_message = Some(error.message.clone());
                        step_summary.updated_at = finished_at;
                        step_summary.completed_at = Some(finished_at);
                        let mut step_metadata = step_summary.metadata.clone();
                        apply_tool_inspector_metadata(&mut step_metadata, step_inspector_metadata);
                        step_summary.metadata = step_metadata;
                    }
                }
            }
            let _ =
                checkpoint_agent_task_runtime_state(ctx, task_id, AgentTaskStatus::Failed.as_str())
                    .await;
            record_runtime_tool_outcome(
                ctx,
                step.kind.as_str(),
                tool_scope,
                runtime_tool_metrics::RuntimeToolExecutionStatus::RuntimeFailed,
                finished_at,
                Some(step_duration_ms),
                Some(error.code.as_str()),
                request_id,
                Some(trace_id.as_str()),
                Some(tool_call_id),
                workspace_id,
                tool_attempt,
            )
            .await;
            let error_class = classify_tool_error_class(error.code.as_str());
            let tool_result_checkpoint_id = checkpoint_tool_call_lifecycle(
                ctx,
                task_id,
                workspace_id,
                tool_call_id,
                step.kind.as_str(),
                "result",
                Some(false),
                Some(error_class),
                Some(step_duration_ms),
                Some(task_id),
                tool_attempt,
                task_recovered,
                json!({
                    "error": {
                        "code": error.code.as_str(),
                        "message": error.message.clone(),
                    },
                }),
            );
            let mut tool_result_payload = build_tool_result_event_payload(
                task_id,
                tool_call_id,
                step.kind.as_str(),
                false,
                None,
                Some(error.code.as_str()),
                Some(error.message.clone()),
                Some(task_id),
                tool_attempt,
                tool_result_checkpoint_id.as_deref(),
                trace_id.as_str(),
                Some(error_class),
                Some(step_duration_ms),
                task_recovered,
            );
            apply_tool_inspector_to_tool_result_payload(
                &mut tool_result_payload,
                step_inspector_metadata,
            );
            let step_metadata = {
                let store = ctx.agent_tasks.read().await;
                store
                    .tasks
                    .get(task_id)
                    .and_then(|task| task.summary.steps.get(step_index))
                    .map(|step_summary| step_summary.metadata.clone())
                    .unwrap_or_else(|| json!({}))
            };
            apply_step_observability_to_tool_result_payload(
                &mut tool_result_payload,
                &step_metadata,
            );
            publish_turn_event(ctx, TURN_EVENT_TOOL_RESULT, tool_result_payload, request_id);
            publish_turn_event(
                ctx,
                TURN_EVENT_FAILED,
                json!({
                    "turnId": task_id,
                    "error": {
                        "code": error.code.as_str(),
                        "message": error.message,
                    },
                }),
                request_id,
            );
            return false;
        }
    }

    true
}
