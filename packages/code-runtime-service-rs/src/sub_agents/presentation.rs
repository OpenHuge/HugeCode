use super::{
    SubAgentSessionSummary, SUB_AGENT_STATUS_AWAITING_APPROVAL, SUB_AGENT_STATUS_CANCELLED,
    SUB_AGENT_STATUS_CLOSED, SUB_AGENT_STATUS_COMPLETED, SUB_AGENT_STATUS_FAILED,
    SUB_AGENT_STATUS_IDLE, SUB_AGENT_STATUS_INTERRUPTED, SUB_AGENT_STATUS_RUNNING,
};
use serde_json::{json, Value};

pub(crate) fn sub_agent_item_status_from_session_status(status: &str) -> &'static str {
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

pub(crate) fn build_sub_agent_item(summary: &SubAgentSessionSummary) -> Value {
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

fn collect_json_string_array(value: Option<&Value>) -> Vec<String> {
    value
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(ToOwned::to_owned)
        .collect()
}

pub(crate) fn derive_sub_agent_failure_class(summary: &SubAgentSessionSummary) -> String {
    let error_code = summary
        .error_code
        .as_deref()
        .map(str::trim)
        .unwrap_or_default()
        .to_ascii_uppercase();
    if summary.status == SUB_AGENT_STATUS_AWAITING_APPROVAL
        || error_code.contains("APPROVAL")
        || error_code.contains("PERMISSION")
    {
        return "approval".to_string();
    }
    if error_code.contains("TIMEOUT") || error_code.contains("BUDGET") {
        return "budget".to_string();
    }
    if error_code.contains("CONTEXT") || error_code.contains("COMPACTION") {
        return "context".to_string();
    }
    if error_code.contains("TASK_START_FAILED") || error_code.contains("TASK_NOT_FOUND") {
        return "tooling".to_string();
    }
    if matches!(
        summary.status.as_str(),
        SUB_AGENT_STATUS_CANCELLED | SUB_AGENT_STATUS_INTERRUPTED
    ) {
        return "operator".to_string();
    }
    if summary.status == SUB_AGENT_STATUS_FAILED {
        return "unknown".to_string();
    }
    "none".to_string()
}

pub(crate) fn build_sub_agent_result_summary(summary: &SubAgentSessionSummary) -> Value {
    let mut artifacts = Vec::new();
    if let Some(context_projection) = summary.context_projection.as_ref() {
        artifacts.extend(collect_json_string_array(
            context_projection.get("offloadRefs"),
        ));
        if let Some(summary_ref) = context_projection
            .get("summaryRef")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            artifacts.push(summary_ref.to_string());
        }
    }
    let status = summary.status.as_str();
    let next_action = match status {
        SUB_AGENT_STATUS_COMPLETED => {
            "Merge the delegated result back into the parent run summary."
        }
        SUB_AGENT_STATUS_AWAITING_APPROVAL => {
            "Review the blocked child action before continuing the parent run."
        }
        SUB_AGENT_STATUS_FAILED => {
            "Inspect the child failure class and decide whether to retry or narrow scope."
        }
        SUB_AGENT_STATUS_CANCELLED | SUB_AGENT_STATUS_INTERRUPTED => {
            "Decide whether the child should be relaunched with tighter runtime scope."
        }
        _ => {
            "Keep the child session under runtime supervision until it publishes a terminal result."
        }
    };
    json!({
        "summary": summary
            .title
            .clone()
            .map(|title| format!("Delegated session `{title}` is currently `{status}`."))
            .unwrap_or_else(|| format!("Delegated session is currently `{status}`.")),
        "artifacts": if artifacts.is_empty() {
            Value::Null
        } else {
            json!(artifacts)
        },
        "nextAction": next_action,
    })
}

pub(crate) fn build_sub_agent_projection_knowledge(summary: &SubAgentSessionSummary) -> Vec<Value> {
    let mut knowledge_items = Vec::new();
    if let Some(scope_profile) = summary
        .scope_profile
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        knowledge_items.push(json!({
            "id": format!("knowledge:{}:scope", summary.session_id),
            "kind": "delegation_hint",
            "scope": "sub_agent",
            "summary": format!("Child scope is locked to `{scope_profile}` under runtime governance."),
            "detail": summary
                .profile_descriptor
                .as_ref()
                .map(|descriptor| descriptor.description.clone()),
            "provenance": ["sub_agent_profile", "runtime_governance"],
            "sourceRef": summary.parent_run_id.clone(),
            "confidence": "high",
            "durable": false,
        }));
    }
    if let Some(allowed_skill_ids) = summary
        .allowed_skill_ids
        .as_ref()
        .filter(|skills| !skills.is_empty())
    {
        knowledge_items.push(json!({
            "id": format!("knowledge:{}:skills", summary.session_id),
            "kind": "skill_hint",
            "scope": "sub_agent",
            "summary": format!(
                "Runtime limited delegated execution to {} allowed skill hint(s).",
                allowed_skill_ids.len()
            ),
            "detail": allowed_skill_ids.join(", "),
            "provenance": ["sub_agent_profile", "runtime_skill_gate"],
            "sourceRef": summary.parent_run_id.clone(),
            "confidence": "high",
            "durable": false,
        }));
    }
    let offload_refs = summary
        .context_projection
        .as_ref()
        .map(|projection| collect_json_string_array(projection.get("offloadRefs")))
        .unwrap_or_default();
    if !offload_refs.is_empty() {
        knowledge_items.push(json!({
            "id": format!("knowledge:{}:recall", summary.session_id),
            "kind": "session_recall",
            "scope": "sub_agent",
            "summary": format!(
                "Runtime compacted delegated context and published {} recall reference(s).",
                offload_refs.len()
            ),
            "detail": offload_refs.join(", "),
            "provenance": ["context_compaction", "runtime_projection"],
            "sourceRef": summary.parent_run_id.clone(),
            "confidence": "medium",
            "durable": false,
        }));
    }
    knowledge_items
}

pub(crate) fn build_sub_agent_skill_candidates(summary: &SubAgentSessionSummary) -> Vec<Value> {
    if summary.status != SUB_AGENT_STATUS_COMPLETED {
        return Vec::new();
    }
    let Some(scope_profile) = summary
        .scope_profile
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    else {
        return Vec::new();
    };
    vec![json!({
        "id": format!("skill-candidate:{}:{scope_profile}", summary.session_id),
        "label": format!("Runtime {}", scope_profile.replace('-', " ")),
        "summary": format!(
            "Completed `{scope_profile}` sub-agent session produced a reusable governed delegation pattern."
        ),
        "state": "candidate",
        "source": "sub_agent",
        "evidence": [
            format!("status:{}", summary.status),
            format!("scope:{scope_profile}"),
            format!("session:{}", summary.session_id),
        ],
        "proposedSkillId": null,
    })]
}
