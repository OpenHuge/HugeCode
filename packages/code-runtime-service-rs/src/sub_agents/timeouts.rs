use super::*;
use crate::sub_agents::enrich_sub_agent_summary_for_response;

pub(super) async fn read_agent_task_summary(
    ctx: &AppContext,
    task_id: &str,
) -> Option<AgentTaskSummary> {
    let tasks = ctx.agent_tasks.read().await;
    tasks
        .tasks
        .get(task_id)
        .map(|runtime| runtime.summary.clone())
}

async fn interrupt_sub_agent_task_due_to_timeout(
    ctx: &AppContext,
    task_id: &str,
    timeout_message: &str,
) -> Option<(AgentTaskSummary, bool)> {
    let mut tasks = ctx.agent_tasks.write().await;
    let task = tasks.tasks.get_mut(task_id)?;
    let mut finalized = false;
    let _ = try_finalize_agent_task_runtime(task, |task| {
        finalized = true;
        let now = now_ms();
        task.interrupt_requested = true;
        task.summary.status = AgentTaskStatus::Interrupted.as_str().to_string();
        task.summary.error_code = Some(SUB_AGENT_TASK_TIMEOUT_ERROR_CODE.to_string());
        task.summary.error_message = Some(truncate_text_for_error(timeout_message, 240));
        task.summary.current_step = None;
        task.summary.completed_at = Some(task.summary.completed_at.unwrap_or(now));
        task.summary.updated_at = now;
        task.interrupt_waiter.notify_waiters();
        task.approval_waiter.notify_waiters();

        let checkpoint_id =
            checkpoint_agent_task_runtime(ctx, task, AgentTaskStatus::Interrupted.as_str());
        if let Some(checkpoint_id) = checkpoint_id {
            task.checkpoint_id = Some(checkpoint_id);
        }
    });
    let summary = task.summary.clone();
    drop(tasks);
    if !finalized {
        increment_terminalization_cas_noop_metric(
            ctx,
            summary.task_id.as_str(),
            "sub_agent_timeout_interrupt",
        )
        .await;
    }
    Some((summary, finalized))
}

async fn mark_sub_agent_session_task_timeout(
    ctx: &AppContext,
    session_id: &str,
    task_id: &str,
    timeout_message: &str,
) -> Result<SubAgentSessionSummary, RpcError> {
    let mut sessions = ctx.sub_agent_sessions.write().await;
    let Some(runtime) = sessions.sessions.get_mut(session_id) else {
        return Err(RpcError::invalid_params(format!(
            "sub-agent session `{session_id}` was not found."
        )));
    };
    runtime.summary.status = SUB_AGENT_STATUS_INTERRUPTED.to_string();
    runtime.summary.active_task_id = None;
    runtime.summary.active_task_started_at = None;
    runtime.summary.last_task_id = Some(task_id.to_string());
    runtime.summary.updated_at = now_ms();
    runtime.summary.error_code = Some(SUB_AGENT_TASK_TIMEOUT_ERROR_CODE.to_string());
    runtime.summary.error_message = Some(truncate_text_for_error(timeout_message, 240));
    checkpoint_sub_agent_session_runtime_and_cache(ctx, runtime, "task_timeout", false);
    let summary = enrich_sub_agent_summary_for_response(&runtime.summary);
    drop(sessions);
    publish_sub_agent_item_event(ctx, TURN_EVENT_TOOL_RESULT, &summary, None);
    Ok(summary)
}

pub(super) async fn enforce_sub_agent_task_timeout_if_needed(
    ctx: &AppContext,
    runtime: &SubAgentSessionRuntime,
) -> Result<Option<(SubAgentSessionSummary, Option<AgentTaskSummary>)>, RpcError> {
    let latest_runtime = {
        let sessions = ctx.sub_agent_sessions.read().await;
        sessions
            .sessions
            .get(runtime.summary.session_id.as_str())
            .cloned()
    };
    let Some(latest_runtime) = latest_runtime else {
        return Ok(None);
    };

    if latest_runtime.summary.active_task_id != runtime.summary.active_task_id
        || latest_runtime.summary.active_task_started_at != runtime.summary.active_task_started_at
    {
        return Ok(None);
    }

    let max_task_ms = resolve_sub_agent_max_task_ms();
    let now = now_ms();
    if !is_sub_agent_task_timeout_due(&latest_runtime.summary, now, max_task_ms) {
        return Ok(None);
    }
    let Some(task_id) = latest_runtime.summary.active_task_id.clone() else {
        return Ok(None);
    };
    let timeout_message = build_sub_agent_task_timeout_message(task_id.as_str(), max_task_ms);
    let task_summary_with_state =
        interrupt_sub_agent_task_due_to_timeout(ctx, task_id.as_str(), timeout_message.as_str())
            .await;
    let (task_summary, finalized) = match task_summary_with_state {
        Some((summary, finalized)) => (Some(summary), finalized),
        None => (None, false),
    };
    if finalized {
        let _ = crate::runtime_tool_safety_counters::record_runtime_tool_safety_counter(
            ctx,
            runtime_tool_metrics::RuntimeToolSafetyCounter::SubAgentTimeout,
            "increment sub-agent-timeout runtime tool metric failed",
        )
        .await;
    }
    let session_summary = if let Some(task_summary) = task_summary.as_ref() {
        update_sub_agent_session_with_task(
            ctx,
            latest_runtime.summary.session_id.as_str(),
            task_summary,
        )
        .await?
    } else {
        mark_sub_agent_session_task_timeout(
            ctx,
            latest_runtime.summary.session_id.as_str(),
            task_id.as_str(),
            timeout_message.as_str(),
        )
        .await?
    };
    Ok(Some((session_summary, task_summary)))
}
