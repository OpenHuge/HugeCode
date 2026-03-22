use super::*;
use tracing::warn;

async fn mark_runtime_tool_metrics_failure(
    ctx: &AppContext,
    error: String,
    failure_context: &'static str,
) {
    let mut guardrails = ctx.runtime_tool_guardrails.lock().await;
    let _ = guardrails.mark_channel_failure(
        "runtime tool metrics record failed",
        "runtime.validation.metrics_unhealthy",
    );
    warn!(error = error.as_str(), "{failure_context}");
}

pub(crate) async fn record_runtime_tool_safety_counter(
    ctx: &AppContext,
    counter: runtime_tool_metrics::RuntimeToolSafetyCounter,
    failure_context: &'static str,
) -> bool {
    let mut metrics = ctx.runtime_tool_metrics.lock().await;
    if let Err(error) = metrics.increment_safety_counter(counter) {
        drop(metrics);
        mark_runtime_tool_metrics_failure(ctx, error, failure_context).await;
        return false;
    }
    true
}

pub(crate) fn record_runtime_tool_safety_counter_best_effort(
    ctx: &AppContext,
    counter: runtime_tool_metrics::RuntimeToolSafetyCounter,
    failure_context: &'static str,
) {
    if let Ok(mut metrics) = ctx.runtime_tool_metrics.try_lock() {
        if let Err(error) = metrics.increment_safety_counter(counter) {
            drop(metrics);
            let ctx = ctx.clone();
            tokio::spawn(async move {
                mark_runtime_tool_metrics_failure(&ctx, error, failure_context).await;
            });
        }
        return;
    }

    let ctx = ctx.clone();
    tokio::spawn(async move {
        let _ = record_runtime_tool_safety_counter(&ctx, counter, failure_context).await;
    });
}
