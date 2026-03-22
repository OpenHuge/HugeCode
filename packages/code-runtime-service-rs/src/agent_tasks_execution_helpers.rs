use super::*;

const DEFAULT_AGENT_APPROVAL_WAIT_TIMEOUT_MS: u64 = 300_000;
const MAX_AGENT_APPROVAL_WAIT_TIMEOUT_MS: u64 = 3_600_000;

fn resolve_agent_approval_wait_timeout_ms() -> u64 {
    std::env::var("CODE_RUNTIME_SERVICE_AGENT_APPROVAL_WAIT_TIMEOUT_MS")
        .ok()
        .and_then(|value| value.trim().parse::<u64>().ok())
        .map(|value| value.clamp(1, MAX_AGENT_APPROVAL_WAIT_TIMEOUT_MS))
        .unwrap_or(DEFAULT_AGENT_APPROVAL_WAIT_TIMEOUT_MS)
}

pub(super) async fn read_agent_interrupt_message(
    ctx: &AppContext,
    task_id: &str,
) -> Option<String> {
    let store = ctx.agent_tasks.read().await;
    let task = store.tasks.get(task_id)?;
    if !task.interrupt_requested
        && task.summary.status != AgentTaskStatus::Interrupted.as_str()
        && task.summary.status != AgentTaskStatus::Paused.as_str()
    {
        return None;
    }

    Some(
        task.summary
            .error_message
            .clone()
            .filter(|message| !message.trim().is_empty())
            .unwrap_or_else(|| {
                if task.summary.status == AgentTaskStatus::Paused.as_str() {
                    "Task paused by operator.".to_string()
                } else {
                    "Task interrupted by operator.".to_string()
                }
            }),
    )
}

pub(super) async fn wait_for_agent_task_approval(
    ctx: &AppContext,
    task_id: &str,
    approval_id: &str,
) -> Result<AgentApprovalWaitOutcome, RpcError> {
    let timeout_ms = resolve_agent_approval_wait_timeout_ms();
    loop {
        let (decision, interrupted, waiter) = {
            let store = ctx.agent_tasks.read().await;
            let Some(task) = store.tasks.get(task_id) else {
                return Err(RpcError::internal(
                    "Agent task disappeared while waiting approval.",
                ));
            };
            let decision = task
                .summary
                .pending_approval
                .as_ref()
                .filter(|pending| pending.approval_id == approval_id)
                .and_then(|pending| pending.decision.as_deref())
                .and_then(|value| match value {
                    "approved" => Some(AgentApprovalDecision::Approved),
                    "rejected" => Some(AgentApprovalDecision::Rejected),
                    _ => None,
                });
            (
                decision,
                task.interrupt_requested,
                task.approval_waiter.clone(),
            )
        };

        if interrupted {
            return Ok(AgentApprovalWaitOutcome::Interrupted);
        }
        if let Some(decision) = decision {
            return Ok(match decision {
                AgentApprovalDecision::Approved => AgentApprovalWaitOutcome::Approved,
                AgentApprovalDecision::Rejected => AgentApprovalWaitOutcome::Rejected,
            });
        }
        if tokio::time::timeout(Duration::from_millis(timeout_ms), waiter.notified())
            .await
            .is_err()
        {
            return Ok(AgentApprovalWaitOutcome::TimedOut);
        }
    }
}

pub(super) fn resolve_approval_checkpoint_state(
    decision: &AgentApprovalWaitOutcome,
) -> &'static str {
    if *decision == AgentApprovalWaitOutcome::Approved {
        AgentTaskStatus::Running.as_str()
    } else if *decision == AgentApprovalWaitOutcome::Interrupted {
        AgentTaskStatus::Interrupted.as_str()
    } else {
        AgentTaskStatus::Failed.as_str()
    }
}

pub(super) fn publish_approval_resolved_event(
    ctx: &AppContext,
    approval_id: &str,
    task_id: &str,
    status: Option<&str>,
    reason: Option<String>,
    action: Option<String>,
    request_id: Option<&str>,
) {
    let Some(status) = status else {
        return;
    };
    let mut payload = serde_json::Map::from_iter([
        (
            "approvalId".to_string(),
            Value::String(approval_id.to_string()),
        ),
        ("turnId".to_string(), Value::String(task_id.to_string())),
        ("status".to_string(), Value::String(status.to_string())),
    ]);
    if matches!(status, "approved" | "rejected") {
        payload.insert("decision".to_string(), Value::String(status.to_string()));
    }
    let mut approval = serde_json::Map::from_iter([(
        "resolutionStatus".to_string(),
        Value::String(status.to_string()),
    )]);
    if let Some(reason) = reason.filter(|value| !value.trim().is_empty()) {
        payload.insert("reason".to_string(), Value::String(reason.clone()));
        approval.insert("resolutionReason".to_string(), Value::String(reason));
    }
    if let Some(action) = action.filter(|value| !value.trim().is_empty()) {
        payload.insert("action".to_string(), Value::String(action.clone()));
        approval.insert("resolutionAction".to_string(), Value::String(action));
    }
    approval.insert("decision".to_string(), Value::String(status.to_string()));
    payload.insert("approval".to_string(), Value::Object(approval));
    publish_turn_event(
        ctx,
        TURN_EVENT_APPROVAL_RESOLVED,
        Value::Object(payload),
        request_id,
    );
}

pub(super) fn publish_approval_failure_event(
    ctx: &AppContext,
    task_id: &str,
    decision: &AgentApprovalWaitOutcome,
    interrupt_message_for_event: Option<String>,
    request_id: Option<&str>,
) -> bool {
    if *decision == AgentApprovalWaitOutcome::Approved {
        return false;
    }
    let (error_code, error_message) = match decision {
        AgentApprovalWaitOutcome::Rejected => (
            "APPROVAL_REJECTED",
            "Approval rejected by operator.".to_string(),
        ),
        AgentApprovalWaitOutcome::Interrupted => (
            "TASK_INTERRUPTED",
            interrupt_message_for_event
                .unwrap_or_else(|| "Task interrupted while awaiting approval.".to_string()),
        ),
        AgentApprovalWaitOutcome::Error => (
            "APPROVAL_UNAVAILABLE",
            "Approval channel failed while waiting for decision.".to_string(),
        ),
        AgentApprovalWaitOutcome::TimedOut => (
            "APPROVAL_TIMEOUT",
            "Approval wait timed out before a decision was recorded.".to_string(),
        ),
        AgentApprovalWaitOutcome::Approved => ("INTERNAL_ERROR", "Unexpected state.".to_string()),
    };
    publish_turn_event(
        ctx,
        TURN_EVENT_FAILED,
        json!({
            "turnId": task_id,
            "error": {
                "code": error_code,
                "message": error_message,
            },
        }),
        request_id,
    );
    true
}

pub(super) async fn finalize_approval_wait_outcome(
    ctx: &AppContext,
    task_id: &str,
    approval_id: &str,
    decision: &AgentApprovalWaitOutcome,
    emit_events: bool,
    approval_resolution_status: Option<&str>,
    approval_resolution_reason: Option<String>,
    approval_resolution_action: Option<String>,
    interrupt_message_for_event: Option<String>,
    request_id: Option<&str>,
) -> bool {
    let _ = checkpoint_agent_task_runtime_state(
        ctx,
        task_id,
        resolve_approval_checkpoint_state(decision),
    )
    .await;
    if !emit_events {
        return false;
    }
    publish_approval_resolved_event(
        ctx,
        approval_id,
        task_id,
        approval_resolution_status,
        approval_resolution_reason,
        approval_resolution_action,
        request_id,
    );
    publish_approval_failure_event(
        ctx,
        task_id,
        decision,
        interrupt_message_for_event,
        request_id,
    )
}

pub(super) const AGENT_STEP_REQUIRES_FRESH_READ_ERROR_CODE: &str = "STEP_REQUIRES_FRESH_READ";

#[derive(Clone, Debug)]
pub(super) struct AgentStepReadRequirementViolation {
    pub message: String,
    pub metadata: Value,
}

fn normalized_agent_step_path(step: &AgentTaskStepInput) -> Option<&str> {
    step.path
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

fn agent_step_requires_read_evidence(step_kind: AgentStepKind) -> bool {
    step_kind.requires_read_evidence()
}

fn is_completed_agent_step_status(status: &str) -> bool {
    status == AgentTaskStatus::Completed.as_str()
}

pub(super) fn resolve_agent_step_read_requirement_violation(
    step_index: usize,
    step: &AgentTaskStepInput,
    steps_input: &[AgentTaskStepInput],
    step_summaries: &[AgentTaskStepSummary],
) -> Option<AgentStepReadRequirementViolation> {
    if !agent_step_requires_read_evidence(step.kind) {
        return None;
    }
    let target_path = normalized_agent_step_path(step)?.to_string();

    let mut last_completed_read_index: Option<usize> = None;
    let mut last_completed_mutation_index: Option<usize> = None;

    for prior_index in 0..step_index {
        let Some(prior_summary) = step_summaries.get(prior_index) else {
            continue;
        };
        if !is_completed_agent_step_status(prior_summary.status.as_str()) {
            continue;
        }
        let Some(prior_step) = steps_input.get(prior_index) else {
            continue;
        };
        let Some(prior_path) = normalized_agent_step_path(prior_step) else {
            continue;
        };
        if prior_path != target_path {
            continue;
        }
        match prior_step.kind.mutation_kind() {
            AgentStepMutationKind::Read => last_completed_read_index = Some(prior_index),
            AgentStepMutationKind::Write | AgentStepMutationKind::Edit => {
                last_completed_mutation_index = Some(prior_index)
            }
            AgentStepMutationKind::Bash | AgentStepMutationKind::JsRepl => {}
        }
    }

    let missing_prior_read = last_completed_read_index.is_none();
    let requires_fresh_read = match (last_completed_read_index, last_completed_mutation_index) {
        (Some(last_read_index), Some(last_mutation_index)) => last_mutation_index > last_read_index,
        _ => false,
    };

    if !missing_prior_read && !requires_fresh_read {
        return None;
    }

    let message = if requires_fresh_read {
        let last_mutation_index = last_completed_mutation_index
            .expect("fresh-read violation must have a prior mutation index");
        format!(
            "Step {} (`{}`) requires a fresh read of `{}` after step {} mutated it.",
            step_index + 1,
            step.kind.as_str(),
            target_path,
            last_mutation_index + 1
        )
    } else {
        format!(
            "Step {} (`{}`) requires a prior completed read of `{}` in this task.",
            step_index + 1,
            step.kind.as_str(),
            target_path
        )
    };

    Some(AgentStepReadRequirementViolation {
        message,
        metadata: json!({
            "guard": "taskScopedReadBeforeMutation",
            "path": target_path,
            "requiresFreshRead": requires_fresh_read,
            "lastReadStepIndex": last_completed_read_index.map(|index| index + 1),
            "lastMutationStepIndex": last_completed_mutation_index.map(|index| index + 1),
            "safety": {
                "guard": "taskScopedReadBeforeMutation",
                "path": target_path,
                "requiresFreshRead": requires_fresh_read,
                "lastReadStepIndex": last_completed_read_index.map(|index| index + 1),
                "lastMutationStepIndex": last_completed_mutation_index.map(|index| index + 1),
            },
        }),
    })
}

fn is_research_network_step(agent_profile: &str, step: &AgentTaskStepInput) -> bool {
    agent_profile == "research"
        && step.kind == AgentStepKind::Read
        && step.path.is_none()
        && step.content.is_none()
        && step.find.is_none()
        && step.replace.is_none()
        && step.command.is_none()
}

fn copy_research_live_skill_option(
    source: &serde_json::Map<String, Value>,
    target: &mut serde_json::Map<String, Value>,
    camel_key: &str,
    snake_key: &str,
) {
    if let Some(value) = source
        .get(camel_key)
        .or_else(|| source.get(snake_key))
        .filter(|value| !value.is_null())
    {
        target.insert(camel_key.to_string(), value.clone());
    }
}

fn parse_research_step_payload(
    workspace_id: &str,
    raw_input: &str,
    step: &AgentTaskStepInput,
) -> (String, serde_json::Map<String, Value>) {
    let mut query = raw_input.trim().to_string();
    let mut options = serde_json::Map::from_iter([(
        "workspaceId".to_string(),
        Value::String(workspace_id.to_string()),
    )]);

    if let Ok(Value::Object(payload)) = serde_json::from_str::<Value>(raw_input) {
        if let Some(parsed_query) = payload
            .get("query")
            .or_else(|| payload.get("input"))
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            query = parsed_query.to_string();
        }
        if let Some(source_options) = payload.get("options").and_then(Value::as_object) {
            copy_research_live_skill_option(
                source_options,
                &mut options,
                "allowNetwork",
                "allow_network",
            );
            copy_research_live_skill_option(
                source_options,
                &mut options,
                "fetchPageContent",
                "fetch_page_content",
            );
            copy_research_live_skill_option(
                source_options,
                &mut options,
                "maxResults",
                "max_results",
            );
            copy_research_live_skill_option(
                source_options,
                &mut options,
                "maxCharsPerResult",
                "max_chars_per_result",
            );
            copy_research_live_skill_option(
                source_options,
                &mut options,
                "preferDomains",
                "prefer_domains",
            );
            copy_research_live_skill_option(
                source_options,
                &mut options,
                "recencyDays",
                "recency_days",
            );
            copy_research_live_skill_option(
                source_options,
                &mut options,
                "workspaceContextPaths",
                "workspace_context_paths",
            );
            copy_research_live_skill_option(
                source_options,
                &mut options,
                "timeoutMs",
                "timeout_ms",
            );
        }
    }

    if let Some(timeout_ms) = step.timeout_ms {
        options.insert("timeoutMs".to_string(), Value::Number(timeout_ms.into()));
    }

    (query, options)
}

pub(super) fn build_agent_step_skill_request(
    workspace_id: &str,
    access_mode: &str,
    agent_profile: &str,
    step: &AgentTaskStepInput,
) -> serde_json::Map<String, Value> {
    if is_research_network_step(agent_profile, step) {
        let raw_input = step.input.clone().unwrap_or_default();
        let (query, options) = parse_research_step_payload(workspace_id, raw_input.as_str(), step);
        return serde_json::Map::from_iter([
            (
                "skillId".to_string(),
                Value::String(live_skills::BUILTIN_LIVE_NETWORK_SKILL_ID.to_string()),
            ),
            ("input".to_string(), Value::String(query)),
            ("options".to_string(), Value::Object(options)),
            (
                "context".to_string(),
                json!({
                    "accessMode": access_mode,
                }),
            ),
        ]);
    }

    let mut options = serde_json::Map::new();
    options.insert(
        "workspaceId".to_string(),
        Value::String(workspace_id.to_string()),
    );
    if let Some(path) = step.path.as_deref() {
        options.insert("path".to_string(), Value::String(path.to_string()));
    }
    if let Some(paths) = step.paths.as_ref() {
        options.insert(
            "paths".to_string(),
            Value::Array(paths.iter().cloned().map(Value::String).collect()),
        );
    }
    if let Some(content) = step.content.as_deref() {
        options.insert("content".to_string(), Value::String(content.to_string()));
    }
    if let Some(find) = step.find.as_deref() {
        options.insert("find".to_string(), Value::String(find.to_string()));
    }
    if let Some(replace) = step.replace.as_deref() {
        options.insert("replace".to_string(), Value::String(replace.to_string()));
    }
    if let Some(command) = step.command.as_deref() {
        options.insert("command".to_string(), Value::String(command.to_string()));
    }
    if let Some(severities) = step.severities.as_ref() {
        options.insert(
            "severities".to_string(),
            Value::Array(
                severities
                    .iter()
                    .map(|severity| Value::String(severity.as_str().to_string()))
                    .collect(),
            ),
        );
    }
    if let Some(max_items) = step.max_items {
        options.insert("maxItems".to_string(), Value::Number(max_items.into()));
    }
    if let Some(timeout_ms) = step.timeout_ms {
        options.insert("timeoutMs".to_string(), Value::Number(timeout_ms.into()));
    }

    let mut payload = serde_json::Map::new();
    payload.insert(
        "skillId".to_string(),
        Value::String(step.kind.capability().skill_id.to_string()),
    );
    payload.insert(
        "input".to_string(),
        Value::String(step.input.clone().unwrap_or_default()),
    );
    payload.insert("options".to_string(), Value::Object(options));
    payload.insert(
        "context".to_string(),
        json!({
            "accessMode": access_mode,
        }),
    );
    payload
}

pub(super) fn classify_tool_error_class(error_code: &str) -> &'static str {
    match error_code {
        "STEP_TIMEOUT" => "timeout",
        "TASK_INTERRUPTED" => "interrupted",
        "STEP_EXECUTION_FAILED" => "execution",
        "INTERNAL_ERROR" => "internal",
        _ => "execution",
    }
}

pub(super) fn build_tool_calling_event_payload(
    task_id: &str,
    tool_call_id: &str,
    tool_name: &str,
    input: Value,
    batch_id: Option<&str>,
    attempt: Option<u32>,
    checkpoint_id: Option<&str>,
    trace_id: &str,
    recovered: bool,
) -> Value {
    let mut arguments = match input {
        Value::Object(map) => map,
        value => serde_json::Map::from_iter([("input".to_string(), value)]),
    };
    if let Some(batch_id) = batch_id {
        arguments.insert("batchId".to_string(), Value::String(batch_id.to_string()));
    }
    if let Some(attempt) = attempt {
        arguments.insert("attempt".to_string(), Value::Number(attempt.into()));
    }
    if let Some(checkpoint_id) = checkpoint_id {
        arguments.insert(
            "checkpointId".to_string(),
            Value::String(checkpoint_id.to_string()),
        );
    }
    arguments.insert("traceId".to_string(), Value::String(trace_id.to_string()));
    arguments.insert("recovered".to_string(), Value::Bool(recovered));

    let mut item = serde_json::Map::from_iter([
        ("id".to_string(), Value::String(tool_call_id.to_string())),
        ("type".to_string(), Value::String("mcpToolCall".to_string())),
        ("server".to_string(), Value::String("runtime".to_string())),
        ("tool".to_string(), Value::String(tool_name.to_string())),
        ("arguments".to_string(), Value::Object(arguments.clone())),
        (
            "status".to_string(),
            Value::String("inProgress".to_string()),
        ),
    ]);
    if let Some(batch_id) = batch_id {
        item.insert("batchId".to_string(), Value::String(batch_id.to_string()));
    }
    if let Some(attempt) = attempt {
        item.insert("attempt".to_string(), Value::Number(attempt.into()));
    }
    if let Some(checkpoint_id) = checkpoint_id {
        item.insert(
            "checkpointId".to_string(),
            Value::String(checkpoint_id.to_string()),
        );
    }
    item.insert("traceId".to_string(), Value::String(trace_id.to_string()));
    item.insert("recovered".to_string(), Value::Bool(recovered));

    Value::Object(serde_json::Map::from_iter([
        ("turnId".to_string(), Value::String(task_id.to_string())),
        (
            "itemId".to_string(),
            Value::String(tool_call_id.to_string()),
        ),
        ("item".to_string(), Value::Object(item)),
    ]))
}

pub(super) fn build_tool_result_event_payload(
    task_id: &str,
    tool_call_id: &str,
    tool_name: &str,
    ok: bool,
    output: Option<String>,
    error_code: Option<&str>,
    error_message: Option<String>,
    batch_id: Option<&str>,
    attempt: Option<u32>,
    checkpoint_id: Option<&str>,
    trace_id: &str,
    error_class: Option<&str>,
    duration_ms: Option<u64>,
    recovered: bool,
) -> Value {
    let mut arguments = serde_json::Map::new();
    if let Some(batch_id) = batch_id {
        arguments.insert("batchId".to_string(), Value::String(batch_id.to_string()));
    }
    if let Some(attempt) = attempt {
        arguments.insert("attempt".to_string(), Value::Number(attempt.into()));
    }
    if let Some(checkpoint_id) = checkpoint_id {
        arguments.insert(
            "checkpointId".to_string(),
            Value::String(checkpoint_id.to_string()),
        );
    }
    arguments.insert("traceId".to_string(), Value::String(trace_id.to_string()));
    arguments.insert("recovered".to_string(), Value::Bool(recovered));
    if let Some(error_class) = error_class {
        arguments.insert(
            "errorClass".to_string(),
            Value::String(error_class.to_string()),
        );
    }
    if let Some(duration_ms) = duration_ms {
        arguments.insert("durationMs".to_string(), Value::Number(duration_ms.into()));
    }

    let mut item = serde_json::Map::from_iter([
        ("id".to_string(), Value::String(tool_call_id.to_string())),
        ("type".to_string(), Value::String("mcpToolCall".to_string())),
        ("server".to_string(), Value::String("runtime".to_string())),
        ("tool".to_string(), Value::String(tool_name.to_string())),
        ("arguments".to_string(), Value::Object(arguments)),
        (
            "status".to_string(),
            Value::String(if ok { "completed" } else { "failed" }.to_string()),
        ),
        (
            "result".to_string(),
            Value::String(if ok {
                output.unwrap_or_default()
            } else {
                String::new()
            }),
        ),
        (
            "error".to_string(),
            Value::String(if ok {
                String::new()
            } else {
                error_message.unwrap_or_else(|| "Tool execution failed.".to_string())
            }),
        ),
    ]);
    if let Some(batch_id) = batch_id {
        item.insert("batchId".to_string(), Value::String(batch_id.to_string()));
    }
    if let Some(attempt) = attempt {
        item.insert("attempt".to_string(), Value::Number(attempt.into()));
    }
    if let Some(checkpoint_id) = checkpoint_id {
        item.insert(
            "checkpointId".to_string(),
            Value::String(checkpoint_id.to_string()),
        );
    }
    if let Some(error_class) = error_class {
        item.insert(
            "errorClass".to_string(),
            Value::String(error_class.to_string()),
        );
    }
    if let Some(duration_ms) = duration_ms {
        item.insert("durationMs".to_string(), Value::Number(duration_ms.into()));
    }
    item.insert("traceId".to_string(), Value::String(trace_id.to_string()));
    item.insert("recovered".to_string(), Value::Bool(recovered));
    if !ok {
        item.insert(
            "errorCode".to_string(),
            Value::String(error_code.unwrap_or("STEP_EXECUTION_FAILED").to_string()),
        );
    }

    Value::Object(serde_json::Map::from_iter([
        ("turnId".to_string(), Value::String(task_id.to_string())),
        (
            "itemId".to_string(),
            Value::String(tool_call_id.to_string()),
        ),
        ("item".to_string(), Value::Object(item)),
    ]))
}

pub(super) async fn checkpoint_agent_task_runtime_state(
    ctx: &AppContext,
    task_id: &str,
    lifecycle_state: &str,
) -> Option<String> {
    let runtime = {
        let store = ctx.agent_tasks.read().await;
        store.tasks.get(task_id).cloned()
    }?;
    let checkpoint_id = checkpoint_agent_task_runtime(ctx, &runtime, lifecycle_state);
    if let Some(checkpoint_id_value) = checkpoint_id.as_ref() {
        let mut store = ctx.agent_tasks.write().await;
        if let Some(task) = store.tasks.get_mut(task_id) {
            task.checkpoint_id = Some(checkpoint_id_value.clone());
        }
    }
    checkpoint_id
}
