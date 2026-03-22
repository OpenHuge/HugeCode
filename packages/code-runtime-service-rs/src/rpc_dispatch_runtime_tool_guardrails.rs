use super::*;

pub(super) async fn handle_runtime_tool_guardrail_evaluate(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let request = runtime_tool_guardrails::parse_runtime_tool_guardrail_evaluate_request(params)?;
    let mut guardrails = ctx.runtime_tool_guardrails.lock().await;
    let result = guardrails.evaluate(&request).map_err(|error| {
        let _ = guardrails.mark_channel_failure(
            "runtime tool guardrail evaluate failed",
            "runtime.validation.metrics_unhealthy",
        );
        RpcError::internal(error)
    })?;
    Ok(json!(result))
}

pub(super) async fn handle_runtime_tool_guardrail_record_outcome(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let event = runtime_tool_guardrails::parse_runtime_tool_guardrail_outcome_event(params)?;
    let mut guardrails = ctx.runtime_tool_guardrails.lock().await;
    let snapshot = guardrails.record_outcome(&event).map_err(|error| {
        let _ = guardrails.mark_channel_failure(
            "runtime tool guardrail outcome persistence failed",
            "runtime.validation.metrics_unhealthy",
        );
        RpcError::internal(error)
    })?;
    Ok(json!(snapshot))
}

pub(super) async fn handle_runtime_tool_guardrail_read(
    ctx: &AppContext,
) -> Result<Value, RpcError> {
    let guardrails = ctx.runtime_tool_guardrails.lock().await;
    let snapshot = guardrails.read_snapshot();
    Ok(json!(snapshot))
}
