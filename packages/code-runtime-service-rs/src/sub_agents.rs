use super::*;
use crate::agent_task_durability::sub_agent_trace_id;
use crate::rpc_dispatch::mission_control_dispatch::build_runtime_sub_agent_takeover_bundle;
use crate::runtime_context_compaction::enrich_agent_task_summary_for_response;

#[path = "sub_agents/profiles.rs"]
pub(crate) mod profiles;
#[path = "sub_agents/runtime_projection.rs"]
mod runtime_projection;
#[path = "sub_agents/timeouts.rs"]
mod timeouts;

use profiles::{
    checkpoint_sub_agent_session_runtime_and_cache, maybe_track_sub_agent_approval_transition,
    normalize_sub_agent_scope_profile, resolve_sub_agent_profile_defaults,
    update_sub_agent_compaction_summary_from_task, SubAgentApprovalEvent, SubAgentCheckpointState,
    SubAgentScopeProfileDescriptor,
};
pub(crate) use runtime_projection::{
    sync_sub_agent_executor_linkage, sync_sub_agent_runtime_execution_graph,
};

const SUB_AGENT_STATUS_IDLE: &str = "idle";
const SUB_AGENT_STATUS_RUNNING: &str = "running";
const SUB_AGENT_STATUS_AWAITING_APPROVAL: &str = "awaiting_approval";
const SUB_AGENT_STATUS_COMPLETED: &str = "completed";
const SUB_AGENT_STATUS_FAILED: &str = "failed";
const SUB_AGENT_STATUS_CANCELLED: &str = "cancelled";
const SUB_AGENT_STATUS_INTERRUPTED: &str = "interrupted";
const SUB_AGENT_STATUS_CLOSED: &str = "closed";

const DEFAULT_SUB_AGENT_WAIT_TIMEOUT_MS: u64 = 30_000;
const MAX_SUB_AGENT_WAIT_TIMEOUT_MS: u64 = 300_000;
const DEFAULT_SUB_AGENT_WAIT_POLL_INTERVAL_MS: u64 = 200;
const MAX_SUB_AGENT_WAIT_POLL_INTERVAL_MS: u64 = 2_000;
const DEFAULT_SUB_AGENT_SESSION_HISTORY_LIMIT: usize = 128;
const DEFAULT_SUB_AGENT_SESSION_STALE_TTL_MS: u64 = 6 * 60 * 60 * 1000;
const DEFAULT_SUB_AGENT_MAX_TASK_MS: u64 = 900_000;
const MAX_SUB_AGENT_MAX_TASK_MS: u64 = 86_400_000;
const CODE_RUNTIME_SERVICE_SUB_AGENT_MAX_TASK_MS_ENV: &str =
    "CODE_RUNTIME_SERVICE_SUB_AGENT_MAX_TASK_MS";
const SUB_AGENT_TASK_TIMEOUT_ERROR_CODE: &str = "SUB_AGENT_TASK_TIMEOUT";

fn sub_agent_item_status_from_session_status(status: &str) -> &'static str {
    match status {
        SUB_AGENT_STATUS_IDLE | SUB_AGENT_STATUS_RUNNING | SUB_AGENT_STATUS_AWAITING_APPROVAL => {
            "inProgress"
        }
        SUB_AGENT_STATUS_COMPLETED | SUB_AGENT_STATUS_CLOSED => "completed",
        SUB_AGENT_STATUS_FAILED | SUB_AGENT_STATUS_CANCELLED | SUB_AGENT_STATUS_INTERRUPTED => {
            "failed"
        }
        _ => "inProgress",
    }
}

fn build_sub_agent_item(summary: &SubAgentSessionSummary) -> Value {
    let receiver_thread_ids = summary
        .thread_id
        .as_deref()
        .filter(|thread_id| !thread_id.trim().is_empty())
        .map(|thread_id| vec![thread_id.to_string()])
        .unwrap_or_default();
    let prompt = summary
        .title
        .clone()
        .or_else(|| summary.error_message.clone())
        .unwrap_or_default();
    let mut agents_states = serde_json::Map::new();
    if let Some(last_task_id) = summary.last_task_id.as_deref() {
        if !last_task_id.trim().is_empty() {
            agents_states.insert(
                last_task_id.to_string(),
                json!({
                    "status": summary.status,
                    "message": summary.error_message,
                }),
            );
        }
    }

    json!({
        "id": format!("sub-agent:{}", summary.session_id),
        "type": "collabToolCall",
        "tool": "subAgent",
        "senderThreadId": summary.thread_id.clone().unwrap_or_default(),
        "receiverThreadIds": receiver_thread_ids,
        "prompt": prompt,
        "agentsStates": agents_states,
        "status": sub_agent_item_status_from_session_status(summary.status.as_str()),
        "sessionId": summary.session_id,
    })
}

pub(super) fn enrich_sub_agent_summary_for_response(
    summary: &SubAgentSessionSummary,
) -> SubAgentSessionSummary {
    let mut enriched = summary.clone();
    enriched.takeover_bundle = Some(build_runtime_sub_agent_takeover_bundle(&enriched));
    enriched
}

fn publish_sub_agent_item_event(
    ctx: &AppContext,
    kind: &str,
    summary: &SubAgentSessionSummary,
    request_id: Option<&str>,
) {
    let turn_id = summary
        .active_task_id
        .as_deref()
        .or(summary.last_task_id.as_deref())
        .unwrap_or(summary.session_id.as_str())
        .to_string();
    let mut payload = serde_json::Map::from_iter([
        ("turnId".to_string(), Value::String(turn_id)),
        (
            "itemId".to_string(),
            Value::String(format!("sub-agent:{}", summary.session_id)),
        ),
        ("item".to_string(), build_sub_agent_item(summary)),
    ]);
    if let Some(thread_id) = summary.thread_id.as_deref() {
        if !thread_id.trim().is_empty() {
            payload.insert("threadId".to_string(), Value::String(thread_id.to_string()));
        }
    }
    publish_turn_event(ctx, kind, Value::Object(payload), request_id);
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct SubAgentExecutorLinkage {
    pub(super) executor_kind: String,
    pub(super) session_id: String,
    pub(super) workspace_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) task_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) active_task_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) last_task_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) thread_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) parent_run_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) trace_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) active_task_started_at: Option<u64>,
    pub(super) status: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct SubAgentSessionSummary {
    pub(super) session_id: String,
    pub(super) workspace_id: String,
    pub(super) thread_id: Option<String>,
    pub(super) title: Option<String>,
    pub(super) status: String,
    pub(super) access_mode: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) scope_profile: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) profile_descriptor: Option<SubAgentScopeProfileDescriptor>,
    pub(super) reason_effort: Option<String>,
    pub(super) provider: Option<String>,
    pub(super) model_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) allowed_skill_ids: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) allow_network: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) workspace_read_paths: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) parent_run_id: Option<String>,
    pub(super) active_task_id: Option<String>,
    pub(super) active_task_started_at: Option<u64>,
    pub(super) last_task_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) executor_linkage: Option<SubAgentExecutorLinkage>,
    pub(super) created_at: u64,
    pub(super) updated_at: u64,
    pub(super) closed_at: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) checkpoint_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) trace_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) recovered: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) checkpoint_state: Option<SubAgentCheckpointState>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) context_boundary: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) context_projection: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) takeover_bundle: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) approval_events: Option<Vec<SubAgentApprovalEvent>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) compaction_summary: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) eval_tags: Option<Vec<String>>,
    pub(super) error_code: Option<String>,
    pub(super) error_message: Option<String>,
}

#[derive(Clone, Debug)]
pub(super) struct SubAgentSessionRuntime {
    pub(super) summary: SubAgentSessionSummary,
    pub(super) execution_node: Option<RuntimeExecutionNodeSummary>,
    pub(super) execution_edge: Option<RuntimeExecutionEdgeSummary>,
    pub(super) closed: bool,
}

#[derive(Default)]
pub(super) struct SubAgentSessionStore {
    pub(super) sessions: HashMap<String, SubAgentSessionRuntime>,
    pub(super) order: VecDeque<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SubAgentSendResult {
    session: SubAgentSessionSummary,
    task: AgentTaskSummary,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SubAgentWaitResult {
    session: SubAgentSessionSummary,
    task: Option<AgentTaskSummary>,
    done: bool,
    timed_out: bool,
    next_poll_after_ms: Option<u64>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SubAgentInterruptResult {
    accepted: bool,
    session_id: String,
    task_id: Option<String>,
    status: String,
    message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SubAgentCloseResult {
    closed: bool,
    session_id: String,
    status: String,
    message: String,
}

fn read_optional_string_array(
    params: &serde_json::Map<String, Value>,
    key: &str,
    alias: Option<&str>,
) -> Option<Vec<String>> {
    let value = params
        .get(key)
        .or_else(|| alias.and_then(|entry| params.get(entry)))?;
    let entries = value
        .as_array()
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(str::trim)
                .filter(|entry| !entry.is_empty())
                .map(ToOwned::to_owned)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    if entries.is_empty() {
        None
    } else {
        Some(entries)
    }
}

fn read_optional_bool_with_alias(
    params: &serde_json::Map<String, Value>,
    key: &str,
    alias: &str,
) -> Option<bool> {
    read_optional_bool(params, key).or_else(|| read_optional_bool(params, alias))
}

pub(crate) async fn handle_sub_agent_spawn(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = read_required_string(params, "workspaceId")?.to_string();
    let thread_id = trim_optional_string(read_optional_string(params, "threadId"));
    let title = trim_optional_string(read_optional_string(params, "title"));
    let access_mode = normalize_access_mode(read_optional_string(params, "accessMode").as_deref())?;
    let scope_profile = normalize_sub_agent_scope_profile(
        read_optional_string(params, "scopeProfile")
            .or_else(|| read_optional_string(params, "scope_profile"))
            .as_deref(),
    )?
    .unwrap_or_else(|| "general".to_string());
    let reason_effort =
        normalize_reason_effort(read_optional_string(params, "reasonEffort").as_deref())?;
    let provider = trim_optional_string(read_optional_string(params, "provider"));
    let model_id = trim_optional_string(read_optional_string(params, "modelId"));
    let allowed_skill_ids =
        read_optional_string_array(params, "allowedSkillIds", Some("allowed_skill_ids"));
    let allow_network = read_optional_bool_with_alias(params, "allowNetwork", "allow_network");
    let workspace_read_paths =
        read_optional_string_array(params, "workspaceReadPaths", Some("workspace_read_paths"));
    let parent_run_id = trim_optional_string(
        read_optional_string(params, "parentRunId")
            .or_else(|| read_optional_string(params, "parent_run_id")),
    );
    let (access_mode, allowed_skill_ids, allow_network, workspace_read_paths, profile_descriptor) =
        resolve_sub_agent_profile_defaults(
            access_mode,
            scope_profile.clone(),
            allowed_skill_ids,
            allow_network,
            workspace_read_paths,
        )?;

    let summary = create_sub_agent_session(
        ctx,
        workspace_id,
        thread_id,
        title,
        access_mode,
        scope_profile,
        profile_descriptor,
        reason_effort,
        provider,
        model_id,
        allowed_skill_ids,
        allow_network,
        workspace_read_paths,
        parent_run_id,
    )
    .await?;

    Ok(json!(summary))
}

pub(crate) async fn handle_sub_agent_status(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let session_id = read_required_string(params, "sessionId")?;
    let runtime = {
        let sessions = ctx.sub_agent_sessions.read().await;
        sessions.sessions.get(session_id).cloned()
    };
    let Some(runtime) = runtime else {
        return Ok(json!(Option::<SubAgentSessionSummary>::None));
    };
    if let Some((timed_out_summary, _)) =
        timeouts::enforce_sub_agent_task_timeout_if_needed(ctx, &runtime).await?
    {
        return Ok(json!(Some(timed_out_summary)));
    }
    Ok(json!(Some(enrich_sub_agent_summary_for_response(
        &runtime.summary
    ))))
}

pub(crate) async fn handle_sub_agent_send(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let session_id = read_required_string(params, "sessionId")?.to_string();
    let instruction = read_required_string(params, "instruction")?.to_string();
    let requires_approval = read_optional_bool(params, "requiresApproval").unwrap_or(false);
    let approval_reason = trim_optional_string(read_optional_string(params, "approvalReason"));
    let request_id = trim_optional_string(read_optional_string(params, "requestId"));

    let runtime = get_sub_agent_session_runtime(ctx, session_id.as_str()).await?;
    if runtime.closed {
        return Err(RpcError::invalid_params(format!(
            "sub-agent session `{session_id}` is already closed."
        )));
    }
    if let Some(active_task_id) = runtime.summary.active_task_id.as_deref() {
        if let Some(task_summary) = timeouts::read_agent_task_summary(ctx, active_task_id).await {
            if !is_agent_task_terminal_status(task_summary.status.as_str()) {
                return Err(RpcError::invalid_params(format!(
                    "sub-agent session `{session_id}` already has active task `{active_task_id}`."
                )));
            }
        }
    }

    let task_request_id = request_id.unwrap_or_else(|| format!("{session_id}:{}", new_id("req")));
    let task_start_result = match handle_agent_task_start(
        ctx,
        &json!({
            "workspaceId": runtime.summary.workspace_id,
            "threadId": runtime.summary.thread_id,
            "title": runtime.summary.title,
            "provider": runtime.summary.provider,
            "modelId": runtime.summary.model_id,
            "reasonEffort": runtime.summary.reason_effort,
            "accessMode": runtime.summary.access_mode,
            "agentProfile": match runtime.summary.scope_profile.as_deref() {
                Some("research") => Value::String("research".to_string()),
                Some("review") => Value::String("review".to_string()),
                _ => Value::Null,
            },
            "requestId": task_request_id,
            "steps": [{
                "kind": "read",
                "input": instruction,
                "requiresApproval": requires_approval,
                "approvalReason": approval_reason,
            }],
        }),
    )
    .await
    {
        Ok(result) => result,
        Err(error) => {
            let _ = mark_sub_agent_session_task_start_failed(
                ctx,
                session_id.as_str(),
                error.message.as_str(),
            )
            .await;
            return Err(error);
        }
    };

    let task_id = extract_task_id(task_start_result.as_object())?;
    let task_summary = timeouts::read_agent_task_summary(ctx, task_id.as_str())
        .await
        .ok_or_else(|| {
            RpcError::internal(format!(
                "sub-agent task `{task_id}` was started but summary was not found."
            ))
        })?;

    let session_summary =
        update_sub_agent_session_with_task(ctx, session_id.as_str(), &task_summary).await?;
    let task_summary = enrich_agent_task_summary_for_response(&task_summary);

    Ok(json!(SubAgentSendResult {
        session: session_summary,
        task: task_summary,
    }))
}

pub(crate) async fn handle_sub_agent_wait(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let session_id = read_required_string(params, "sessionId")?.to_string();
    let timeout_ms = read_optional_u64(params, "timeoutMs")
        .unwrap_or(DEFAULT_SUB_AGENT_WAIT_TIMEOUT_MS)
        .clamp(1, MAX_SUB_AGENT_WAIT_TIMEOUT_MS);
    let poll_interval_ms = read_optional_u64(params, "pollIntervalMs")
        .unwrap_or(DEFAULT_SUB_AGENT_WAIT_POLL_INTERVAL_MS)
        .clamp(25, MAX_SUB_AGENT_WAIT_POLL_INTERVAL_MS);
    let started_at = Instant::now();

    loop {
        let runtime = get_sub_agent_session_runtime(ctx, session_id.as_str()).await?;
        if let Some((session_summary, task_summary)) =
            timeouts::enforce_sub_agent_task_timeout_if_needed(ctx, &runtime).await?
        {
            let task_summary = task_summary
                .as_ref()
                .map(enrich_agent_task_summary_for_response);
            return Ok(json!(SubAgentWaitResult {
                session: session_summary,
                task: task_summary,
                done: true,
                timed_out: false,
                next_poll_after_ms: None,
            }));
        }
        let candidate_task_id = runtime
            .summary
            .active_task_id
            .clone()
            .or(runtime.summary.last_task_id.clone());

        let Some(task_id) = candidate_task_id else {
            if is_sub_agent_session_terminal_status(runtime.summary.status.as_str()) {
                return Ok(json!(SubAgentWaitResult {
                    session: enrich_sub_agent_summary_for_response(&runtime.summary),
                    task: None,
                    done: true,
                    timed_out: false,
                    next_poll_after_ms: None,
                }));
            }
            if started_at.elapsed() >= Duration::from_millis(timeout_ms) {
                return Ok(json!(SubAgentWaitResult {
                    session: enrich_sub_agent_summary_for_response(&runtime.summary),
                    task: None,
                    done: false,
                    timed_out: true,
                    next_poll_after_ms: Some(poll_interval_ms),
                }));
            }
            tokio::time::sleep(Duration::from_millis(poll_interval_ms)).await;
            continue;
        };

        let task_summary = timeouts::read_agent_task_summary(ctx, task_id.as_str()).await;
        if let Some(task_summary) = task_summary {
            let session_summary =
                update_sub_agent_session_with_task(ctx, session_id.as_str(), &task_summary).await?;
            let task_summary = enrich_agent_task_summary_for_response(&task_summary);
            if is_agent_task_terminal_status(task_summary.status.as_str()) {
                return Ok(json!(SubAgentWaitResult {
                    session: session_summary,
                    task: Some(task_summary),
                    done: true,
                    timed_out: false,
                    next_poll_after_ms: None,
                }));
            }

            if started_at.elapsed() >= Duration::from_millis(timeout_ms) {
                return Ok(json!(SubAgentWaitResult {
                    session: session_summary,
                    task: Some(task_summary),
                    done: false,
                    timed_out: true,
                    next_poll_after_ms: Some(poll_interval_ms),
                }));
            }
        } else {
            let session_summary =
                mark_sub_agent_session_task_missing(ctx, session_id.as_str(), task_id.as_str())
                    .await?;
            if started_at.elapsed() >= Duration::from_millis(timeout_ms) {
                return Ok(json!(SubAgentWaitResult {
                    session: session_summary,
                    task: None,
                    done: false,
                    timed_out: true,
                    next_poll_after_ms: Some(poll_interval_ms),
                }));
            }
        }

        tokio::time::sleep(Duration::from_millis(poll_interval_ms)).await;
    }
}

pub(crate) async fn handle_sub_agent_interrupt(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let session_id = read_required_string(params, "sessionId")?.to_string();
    let reason = trim_optional_string(read_optional_string(params, "reason"));

    let runtime = get_sub_agent_session_runtime(ctx, session_id.as_str()).await?;
    let Some(task_id) = runtime.summary.active_task_id.clone() else {
        if !is_sub_agent_session_terminal_status(runtime.summary.status.as_str()) {
            let status_summary = mark_sub_agent_session_manual_status(
                ctx,
                session_id.as_str(),
                SUB_AGENT_STATUS_INTERRUPTED,
                Some("SESSION_INTERRUPTED"),
                Some(
                    reason
                        .as_deref()
                        .unwrap_or("Sub-agent session interrupted without an active task."),
                ),
                None,
            )
            .await?;
            return Ok(json!(SubAgentInterruptResult {
                accepted: true,
                session_id,
                task_id: None,
                status: status_summary.status,
                message: "Sub-agent interrupt submitted.".to_string(),
            }));
        }
        return Ok(json!(SubAgentInterruptResult {
            accepted: false,
            session_id: session_id.clone(),
            task_id: None,
            status: runtime.summary.status,
            message: "No active sub-agent task to interrupt.".to_string(),
        }));
    };

    let ack = handle_agent_task_interrupt(
        ctx,
        &json!({
            "taskId": task_id,
            "reason": reason,
        }),
    )
    .await?;

    let ack_object = ack
        .as_object()
        .ok_or_else(|| RpcError::internal("Agent task interrupt response must be an object."))?;
    let accepted = ack_object
        .get("accepted")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let task_id = trim_optional_string(read_optional_string(ack_object, "taskId"));

    let status = if let Some(task_id) = task_id.as_deref() {
        if let Some(task_summary) = timeouts::read_agent_task_summary(ctx, task_id).await {
            update_sub_agent_session_with_task(ctx, session_id.as_str(), &task_summary)
                .await?
                .status
        } else {
            runtime.summary.status
        }
    } else {
        runtime.summary.status
    };

    Ok(json!(SubAgentInterruptResult {
        accepted,
        session_id,
        task_id,
        status,
        message: if accepted {
            "Sub-agent interrupt submitted.".to_string()
        } else {
            "Sub-agent interrupt was not accepted.".to_string()
        },
    }))
}

pub(crate) async fn handle_sub_agent_close(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let session_id = read_required_string(params, "sessionId")?.to_string();
    let reason = trim_optional_string(read_optional_string(params, "reason"));
    let force = read_optional_bool(params, "force").unwrap_or(false);

    let runtime = get_sub_agent_session_runtime(ctx, session_id.as_str()).await?;

    if runtime.closed {
        return Ok(json!(SubAgentCloseResult {
            closed: true,
            session_id,
            status: SUB_AGENT_STATUS_CLOSED.to_string(),
            message: "Sub-agent session already closed.".to_string(),
        }));
    }

    if let Some(task_id) = runtime.summary.active_task_id.clone() {
        if force {
            let _ = handle_agent_task_interrupt(
                ctx,
                &json!({
                    "taskId": task_id,
                    "reason": reason,
                }),
            )
            .await;
        }
    }

    let summary = {
        let mut sessions = ctx.sub_agent_sessions.write().await;
        let Some(runtime) = sessions.sessions.get_mut(session_id.as_str()) else {
            return Err(RpcError::invalid_params(format!(
                "sub-agent session `{session_id}` was not found."
            )));
        };
        runtime.closed = true;
        runtime.summary.status = SUB_AGENT_STATUS_CLOSED.to_string();
        runtime.summary.updated_at = now_ms();
        runtime.summary.closed_at = Some(now_ms());
        runtime.summary.active_task_id = None;
        runtime.summary.active_task_started_at = None;
        checkpoint_sub_agent_session_runtime_and_cache(ctx, runtime, "closed", false);
        runtime.summary.clone()
    };
    publish_sub_agent_item_event(ctx, TURN_EVENT_TOOL_RESULT, &summary, None);

    Ok(json!(SubAgentCloseResult {
        closed: true,
        session_id,
        status: SUB_AGENT_STATUS_CLOSED.to_string(),
        message: "Sub-agent session closed.".to_string(),
    }))
}

fn trim_sub_agent_session_history(store: &mut SubAgentSessionStore, limit: usize) {
    while store.sessions.len() >= limit {
        let Some(oldest_session_id) = store.order.pop_front() else {
            break;
        };
        store.sessions.remove(oldest_session_id.as_str());
    }
}

fn sub_agent_session_stale_ttl_ms(config: &ServiceConfig) -> u64 {
    let history_limit = config
        .agent_task_history_limit
        .max(DEFAULT_SUB_AGENT_SESSION_HISTORY_LIMIT) as u64;
    let adaptive = history_limit.saturating_mul(60_000);
    adaptive.max(DEFAULT_SUB_AGENT_SESSION_STALE_TTL_MS)
}

fn parse_sub_agent_max_task_ms(value: Option<&str>) -> u64 {
    value
        .and_then(|entry| entry.trim().parse::<u64>().ok())
        .map(|parsed| parsed.clamp(1, MAX_SUB_AGENT_MAX_TASK_MS))
        .unwrap_or(DEFAULT_SUB_AGENT_MAX_TASK_MS)
}

fn resolve_sub_agent_max_task_ms() -> u64 {
    parse_sub_agent_max_task_ms(
        std::env::var(CODE_RUNTIME_SERVICE_SUB_AGENT_MAX_TASK_MS_ENV)
            .ok()
            .as_deref(),
    )
}

fn is_sub_agent_task_timeout_due(
    summary: &SubAgentSessionSummary,
    now: u64,
    max_task_ms: u64,
) -> bool {
    if summary.active_task_id.is_none() {
        return false;
    }
    let Some(active_task_started_at) = summary.active_task_started_at else {
        return false;
    };
    now.saturating_sub(active_task_started_at) >= max_task_ms
}

fn build_sub_agent_task_timeout_message(task_id: &str, max_task_ms: u64) -> String {
    format!("Sub-agent task `{task_id}` exceeded max runtime budget of {max_task_ms}ms.")
}

fn is_sub_agent_session_terminal_status(status: &str) -> bool {
    matches!(
        status,
        SUB_AGENT_STATUS_COMPLETED
            | SUB_AGENT_STATUS_FAILED
            | SUB_AGENT_STATUS_CANCELLED
            | SUB_AGENT_STATUS_INTERRUPTED
            | SUB_AGENT_STATUS_CLOSED
    )
}

fn is_sub_agent_session_counted_as_active(runtime: &SubAgentSessionRuntime) -> bool {
    !runtime.closed
        && matches!(
            runtime.summary.status.as_str(),
            SUB_AGENT_STATUS_IDLE | SUB_AGENT_STATUS_RUNNING | SUB_AGENT_STATUS_AWAITING_APPROVAL
        )
}

fn prune_stale_sub_agent_sessions(store: &mut SubAgentSessionStore, now: u64, ttl_ms: u64) {
    let stale_ids = store
        .sessions
        .iter()
        .filter_map(|(session_id, runtime)| {
            let last_touch = runtime
                .summary
                .closed_at
                .unwrap_or(runtime.summary.updated_at.max(runtime.summary.created_at));
            let age_ms = now.saturating_sub(last_touch);
            let stale = age_ms >= ttl_ms
                && (runtime.closed
                    || runtime.summary.active_task_id.is_none()
                    || is_sub_agent_session_terminal_status(runtime.summary.status.as_str()));
            if stale {
                Some(session_id.clone())
            } else {
                None
            }
        })
        .collect::<Vec<_>>();

    if stale_ids.is_empty() {
        return;
    }

    for stale_id in stale_ids {
        store.sessions.remove(stale_id.as_str());
    }
    store
        .order
        .retain(|session_id| store.sessions.contains_key(session_id.as_str()));
}

async fn get_sub_agent_session_runtime(
    ctx: &AppContext,
    session_id: &str,
) -> Result<SubAgentSessionRuntime, RpcError> {
    let sessions = ctx.sub_agent_sessions.read().await;
    sessions.sessions.get(session_id).cloned().ok_or_else(|| {
        RpcError::invalid_params(format!("sub-agent session `{session_id}` was not found."))
    })
}

async fn create_sub_agent_session(
    ctx: &AppContext,
    workspace_id: String,
    thread_id: Option<String>,
    title: Option<String>,
    access_mode: String,
    scope_profile: String,
    profile_descriptor: SubAgentScopeProfileDescriptor,
    reason_effort: Option<String>,
    provider: Option<String>,
    model_id: Option<String>,
    allowed_skill_ids: Option<Vec<String>>,
    allow_network: Option<bool>,
    workspace_read_paths: Option<Vec<String>>,
    parent_run_id: Option<String>,
) -> Result<SubAgentSessionSummary, RpcError> {
    let now = now_ms();
    let session_id = new_id("sub-agent");
    let mut summary = SubAgentSessionSummary {
        session_id: session_id.clone(),
        workspace_id,
        thread_id,
        title,
        status: SUB_AGENT_STATUS_IDLE.to_string(),
        access_mode,
        scope_profile: Some(scope_profile.clone()),
        profile_descriptor: Some(profile_descriptor),
        reason_effort,
        provider,
        model_id,
        allowed_skill_ids,
        allow_network,
        workspace_read_paths,
        parent_run_id,
        active_task_id: None,
        active_task_started_at: None,
        last_task_id: None,
        executor_linkage: None,
        created_at: now,
        updated_at: now,
        closed_at: None,
        checkpoint_id: None,
        trace_id: Some(sub_agent_trace_id(session_id.as_str())),
        recovered: Some(false),
        checkpoint_state: None,
        context_boundary: None,
        context_projection: None,
        takeover_bundle: None,
        approval_events: Some(Vec::new()),
        compaction_summary: None,
        eval_tags: Some(vec![
            "mode:runtime".to_string(),
            "surface:sub-agent".to_string(),
            format!("scope:{scope_profile}"),
        ]),
        error_code: None,
        error_message: None,
    };
    sync_sub_agent_executor_linkage(&mut summary);

    {
        let mut sessions = ctx.sub_agent_sessions.write().await;
        prune_stale_sub_agent_sessions(
            &mut sessions,
            now,
            sub_agent_session_stale_ttl_ms(&ctx.config),
        );
        let active_sessions = sessions
            .sessions
            .values()
            .filter(|runtime| is_sub_agent_session_counted_as_active(runtime))
            .count();
        let max_active_sessions = ctx.config.agent_max_concurrent_tasks.max(1);
        if active_sessions >= max_active_sessions {
            return Err(RpcError::invalid_params(format!(
                "sub-agent session limit reached ({max_active_sessions}). Close stale sessions or raise CODE_RUNTIME_SERVICE_AGENT_MAX_CONCURRENT_TASKS."
            )));
        }
        trim_sub_agent_session_history(
            &mut sessions,
            ctx.config
                .agent_task_history_limit
                .max(DEFAULT_SUB_AGENT_SESSION_HISTORY_LIMIT),
        );
        sessions.order.push_back(session_id.clone());
        sessions.sessions.insert(
            session_id,
            SubAgentSessionRuntime {
                summary: summary.clone(),
                execution_node: None,
                execution_edge: None,
                closed: false,
            },
        );
        if let Some(runtime) = sessions.sessions.get_mut(summary.session_id.as_str()) {
            checkpoint_sub_agent_session_runtime_and_cache(ctx, runtime, "spawned", false);
        }
    }

    Ok(enrich_sub_agent_summary_for_response(
        &get_sub_agent_session_runtime(ctx, summary.session_id.as_str())
            .await?
            .summary,
    ))
}

fn extract_task_id(
    task_start_result: Option<&serde_json::Map<String, Value>>,
) -> Result<String, RpcError> {
    let task_object = task_start_result
        .ok_or_else(|| RpcError::internal("Agent task start response must be an object."))?;
    trim_optional_string(read_optional_string(task_object, "taskId"))
        .ok_or_else(|| RpcError::internal("Agent task start response did not include taskId."))
}

pub(super) async fn sweep_sub_agent_task_timeouts(ctx: &AppContext) -> usize {
    let runtimes = {
        let sessions = ctx.sub_agent_sessions.read().await;
        sessions.sessions.values().cloned().collect::<Vec<_>>()
    };
    let mut swept_total = 0usize;
    for runtime in runtimes {
        match timeouts::enforce_sub_agent_task_timeout_if_needed(ctx, &runtime).await {
            Ok(Some(_)) => {
                swept_total = swept_total.saturating_add(1);
            }
            Ok(None) => {}
            Err(error) => {
                warn!(
                    error = error.message.as_str(),
                    session_id = runtime.summary.session_id.as_str(),
                    "sub-agent lifecycle sweep timeout enforcement failed"
                );
            }
        }
    }
    swept_total
}

async fn mark_sub_agent_session_task_missing(
    ctx: &AppContext,
    session_id: &str,
    task_id: &str,
) -> Result<SubAgentSessionSummary, RpcError> {
    let mut sessions = ctx.sub_agent_sessions.write().await;
    let Some(runtime) = sessions.sessions.get_mut(session_id) else {
        return Err(RpcError::invalid_params(format!(
            "sub-agent session `{session_id}` was not found."
        )));
    };
    if runtime.summary.active_task_id.as_deref() == Some(task_id) {
        runtime.summary.active_task_id = None;
    }
    runtime.summary.active_task_started_at = None;
    runtime.summary.last_task_id = Some(task_id.to_string());
    runtime.summary.updated_at = now_ms();
    runtime.summary.status = SUB_AGENT_STATUS_FAILED.to_string();
    runtime.summary.error_code = Some("TASK_NOT_FOUND".to_string());
    runtime.summary.error_message = Some(format!(
        "Tracked task `{task_id}` is no longer available in runtime task store."
    ));
    checkpoint_sub_agent_session_runtime_and_cache(ctx, runtime, "task_missing", false);
    let summary = enrich_sub_agent_summary_for_response(&runtime.summary);
    drop(sessions);
    publish_sub_agent_item_event(ctx, TURN_EVENT_TOOL_RESULT, &summary, None);
    Ok(summary)
}

async fn mark_sub_agent_session_task_start_failed(
    ctx: &AppContext,
    session_id: &str,
    error_message: &str,
) -> Result<(), RpcError> {
    let mut sessions = ctx.sub_agent_sessions.write().await;
    let Some(runtime) = sessions.sessions.get_mut(session_id) else {
        return Ok(());
    };
    if runtime.summary.active_task_id.is_some() {
        runtime.summary.last_task_id = runtime.summary.active_task_id.clone();
    }
    runtime.summary.active_task_id = None;
    runtime.summary.active_task_started_at = None;
    runtime.summary.updated_at = now_ms();
    runtime.summary.status = SUB_AGENT_STATUS_FAILED.to_string();
    runtime.summary.error_code = Some("TASK_START_FAILED".to_string());
    runtime.summary.error_message = Some(truncate_text_for_error(error_message, 240));
    checkpoint_sub_agent_session_runtime_and_cache(ctx, runtime, "task_start_failed", false);
    let summary = enrich_sub_agent_summary_for_response(&runtime.summary);
    drop(sessions);
    publish_sub_agent_item_event(ctx, TURN_EVENT_TOOL_RESULT, &summary, None);
    Ok(())
}

async fn mark_sub_agent_session_manual_status(
    ctx: &AppContext,
    session_id: &str,
    status: &str,
    error_code: Option<&str>,
    error_message: Option<&str>,
    request_id: Option<&str>,
) -> Result<SubAgentSessionSummary, RpcError> {
    let mut sessions = ctx.sub_agent_sessions.write().await;
    let Some(runtime) = sessions.sessions.get_mut(session_id) else {
        return Err(RpcError::invalid_params(format!(
            "sub-agent session `{session_id}` was not found."
        )));
    };
    if runtime.summary.active_task_id.is_some() {
        runtime.summary.last_task_id = runtime.summary.active_task_id.clone();
    }
    runtime.summary.status = status.to_string();
    runtime.summary.active_task_id = None;
    runtime.summary.active_task_started_at = None;
    runtime.summary.updated_at = now_ms();
    runtime.summary.error_code = error_code.map(ToOwned::to_owned);
    runtime.summary.error_message =
        error_message.map(|message| truncate_text_for_error(message, 240));
    let lifecycle_state = if is_sub_agent_session_terminal_status(status) {
        "manual_terminal"
    } else {
        "manual_running"
    };
    checkpoint_sub_agent_session_runtime_and_cache(ctx, runtime, lifecycle_state, false);
    let summary = enrich_sub_agent_summary_for_response(&runtime.summary);
    drop(sessions);
    let event_kind = if is_sub_agent_session_terminal_status(status) {
        TURN_EVENT_TOOL_RESULT
    } else if status == SUB_AGENT_STATUS_RUNNING {
        TURN_EVENT_TOOL_CALLING
    } else {
        TURN_EVENT_ITEM_UPDATED
    };
    publish_sub_agent_item_event(ctx, event_kind, &summary, request_id);
    Ok(summary)
}

async fn update_sub_agent_session_with_task(
    ctx: &AppContext,
    session_id: &str,
    task_summary: &AgentTaskSummary,
) -> Result<SubAgentSessionSummary, RpcError> {
    let mut sessions = ctx.sub_agent_sessions.write().await;
    let Some(runtime) = sessions.sessions.get_mut(session_id) else {
        return Err(RpcError::invalid_params(format!(
            "sub-agent session `{session_id}` was not found."
        )));
    };
    let previous_status = runtime.summary.status.clone();

    if runtime.closed {
        runtime.summary.status = SUB_AGENT_STATUS_CLOSED.to_string();
        runtime.summary.updated_at = now_ms();
        runtime.summary.active_task_started_at = None;
        checkpoint_sub_agent_session_runtime_and_cache(ctx, runtime, "closed", false);
        let summary = enrich_sub_agent_summary_for_response(&runtime.summary);
        drop(sessions);
        publish_sub_agent_item_event(ctx, TURN_EVENT_TOOL_RESULT, &summary, None);
        return Ok(summary);
    }

    runtime.summary.status =
        map_agent_task_status_to_sub_agent_status(task_summary.status.as_str()).to_string();
    let now = now_ms();
    runtime.summary.updated_at = now;
    runtime.summary.last_task_id = Some(task_summary.task_id.clone());
    runtime.summary.error_code = task_summary.error_code.clone();
    runtime.summary.error_message = task_summary.error_message.clone();
    update_sub_agent_compaction_summary_from_task(&mut runtime.summary, task_summary);
    maybe_track_sub_agent_approval_transition(
        &mut runtime.summary,
        previous_status.as_str(),
        task_summary,
    );

    if is_agent_task_terminal_status(task_summary.status.as_str()) {
        runtime.summary.active_task_id = None;
        runtime.summary.active_task_started_at = None;
    } else {
        let previous_active_task_id = runtime.summary.active_task_id.clone();
        let previous_active_task_started_at = runtime.summary.active_task_started_at;
        runtime.summary.active_task_id = Some(task_summary.task_id.clone());
        runtime.summary.active_task_started_at =
            if previous_active_task_id.as_deref() == Some(task_summary.task_id.as_str()) {
                previous_active_task_started_at
                    .or(task_summary.started_at)
                    .or(Some(now))
            } else {
                task_summary.started_at.or(Some(now))
            };
    }
    checkpoint_sub_agent_session_runtime_and_cache(ctx, runtime, "task_status_sync", false);
    let summary = enrich_sub_agent_summary_for_response(&runtime.summary);
    drop(sessions);
    let event_kind = if previous_status == SUB_AGENT_STATUS_IDLE {
        TURN_EVENT_TOOL_CALLING
    } else if is_sub_agent_session_terminal_status(summary.status.as_str()) {
        TURN_EVENT_TOOL_RESULT
    } else {
        TURN_EVENT_ITEM_UPDATED
    };
    publish_sub_agent_item_event(ctx, event_kind, &summary, None);
    Ok(summary)
}

fn map_agent_task_status_to_sub_agent_status(task_status: &str) -> &'static str {
    match task_status {
        "queued" | "running" => SUB_AGENT_STATUS_RUNNING,
        "awaiting_approval" => SUB_AGENT_STATUS_AWAITING_APPROVAL,
        "completed" => SUB_AGENT_STATUS_COMPLETED,
        "failed" => SUB_AGENT_STATUS_FAILED,
        "cancelled" => SUB_AGENT_STATUS_CANCELLED,
        "interrupted" => SUB_AGENT_STATUS_INTERRUPTED,
        _ => SUB_AGENT_STATUS_IDLE,
    }
}

#[cfg(test)]
#[path = "sub_agents/tests.rs"]
mod tests;
