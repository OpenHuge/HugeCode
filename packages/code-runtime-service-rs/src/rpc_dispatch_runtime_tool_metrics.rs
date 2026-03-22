use super::*;

async fn with_runtime_tool_metrics_store<R>(
    ctx: &AppContext,
    handler: impl FnOnce(
        &mut runtime_tool_metrics::RuntimeToolExecutionMetricsStore,
    ) -> Result<R, RpcError>,
) -> Result<R, RpcError> {
    let mut metrics = ctx.runtime_tool_metrics.lock().await;
    handler(&mut metrics)
}

async fn mark_guardrail_channel_failure(ctx: &AppContext, reason: &str) {
    let mut guardrails = ctx.runtime_tool_guardrails.lock().await;
    let _ = guardrails.mark_channel_failure(reason, "runtime.validation.metrics_unhealthy");
}

async fn attach_guardrail_state(
    ctx: &AppContext,
    mut snapshot: runtime_tool_metrics::RuntimeToolExecutionMetricsSnapshot,
) -> runtime_tool_metrics::RuntimeToolExecutionMetricsSnapshot {
    let guardrails = ctx.runtime_tool_guardrails.lock().await;
    let guardrail_snapshot = guardrails.read_snapshot();
    drop(guardrails);
    snapshot.channel_health = guardrail_snapshot.channel_health;
    snapshot.circuit_breakers = guardrail_snapshot.circuit_breakers;
    snapshot.updated_at = snapshot.updated_at.max(guardrail_snapshot.updated_at);
    snapshot
}

pub(super) async fn handle_runtime_tool_metrics_record(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let events = runtime_tool_metrics::parse_runtime_tool_execution_events(params)?;
    let snapshot = match with_runtime_tool_metrics_store(ctx, |metrics| {
        metrics
            .record_events(events.as_slice())
            .map_err(RpcError::internal)
    })
    .await
    {
        Ok(snapshot) => snapshot,
        Err(error) => {
            mark_guardrail_channel_failure(ctx, "runtime tool metrics record failed").await;
            return Err(error);
        }
    };
    let snapshot = attach_guardrail_state(ctx, snapshot).await;
    Ok(json!(snapshot))
}

pub(super) async fn handle_runtime_tool_metrics_read(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let metrics = ctx.runtime_tool_metrics.lock().await;
    let snapshot = metrics.read_snapshot();
    drop(metrics);
    let filter = runtime_tool_metrics::parse_runtime_tool_execution_metrics_read_filter(params)?;
    let filtered = runtime_tool_metrics::filter_runtime_tool_execution_snapshot(&snapshot, &filter);
    let filtered = attach_guardrail_state(ctx, filtered).await;
    Ok(json!(filtered))
}

pub(super) async fn handle_runtime_tool_metrics_reset(ctx: &AppContext) -> Result<Value, RpcError> {
    let snapshot = match with_runtime_tool_metrics_store(ctx, |metrics| {
        metrics.reset().map_err(RpcError::internal)
    })
    .await
    {
        Ok(snapshot) => snapshot,
        Err(error) => {
            mark_guardrail_channel_failure(ctx, "runtime tool metrics reset failed").await;
            return Err(error);
        }
    };
    let snapshot = attach_guardrail_state(ctx, snapshot).await;
    Ok(json!(snapshot))
}
