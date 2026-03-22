use super::*;

#[path = "agent_tasks_execution.rs"]
mod execution;
#[path = "agent_tasks_handlers.rs"]
mod handlers;
pub(crate) use handlers::{
    build_agent_task_runtime_response_payload, derive_agent_task_review_pack_id,
    refresh_agent_task_runtime_execution_truth,
};

pub(super) async fn handle_agent_task_start(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    handlers::handle_agent_task_start(ctx, params).await
}

pub(super) async fn handle_agent_task_interrupt(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    handlers::handle_agent_task_interrupt(ctx, params).await
}

pub(super) async fn handle_agent_task_resume(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    handlers::handle_agent_task_resume(ctx, params).await
}

pub(super) async fn handle_agent_task_intervene(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    handlers::handle_agent_task_intervene(ctx, params).await
}

pub(super) async fn handle_agent_task_status(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    handlers::handle_agent_task_status(ctx, params).await
}

pub(super) async fn handle_agent_tasks_list(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    handlers::handle_agent_tasks_list(ctx, params).await
}

pub(super) async fn handle_agent_approval_decision(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    handlers::handle_agent_approval_decision(ctx, params).await
}

pub(super) async fn sweep_agent_approval_timeouts(ctx: &AppContext) -> usize {
    handlers::sweep_agent_approval_timeouts(ctx).await
}

pub(super) fn spawn_agent_task_execution(
    ctx: AppContext,
    task_id: String,
) -> RuntimeTaskHandle<RuntimeTaskRunResult<()>> {
    ctx.task_supervisor.clone().spawn_cancellable(
        RuntimeTaskDomain::Runtime,
        format!("agent.task.execution.{task_id}"),
        async move {
            execution::run_agent_task(ctx, task_id).await;
        },
    )
}
