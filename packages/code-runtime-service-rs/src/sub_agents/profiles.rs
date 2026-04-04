use super::*;
use crate::agent_task_durability::{checkpoint_sub_agent_session_runtime, sub_agent_trace_id};
use crate::runtime_checkpoint::{
    build_runtime_checkpoint_summary, resolve_runtime_checkpoint_resume_ready,
};
use crate::runtime_context_compaction::derive_agent_task_context_observability;
use crate::sub_agents::sync_sub_agent_executor_linkage;

pub(crate) const DEFAULT_SUB_AGENT_PROFILE_MAX_DEPTH: u64 = 1;
const DEFAULT_RESEARCH_ALLOWED_SKILL_IDS: [&str; 4] =
    ["network-analysis", "core-read", "core-grep", "core-tree"];
const DEFAULT_REVIEW_ALLOWED_SKILL_IDS: [&str; 3] = ["core-read", "core-grep", "core-tree"];

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SubAgentScopeProfileDescriptor {
    pub(crate) profile: String,
    pub(crate) allow_network: bool,
    pub(crate) allowed_skill_ids: Vec<String>,
    pub(crate) workspace_read_paths: Vec<String>,
    pub(crate) writable_roots: Vec<String>,
    pub(crate) max_task_ms: u64,
    pub(crate) max_depth: u64,
    pub(crate) approval_mode: String,
    pub(crate) read_only: bool,
    pub(crate) description: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SubAgentCheckpointState {
    pub(crate) state: String,
    pub(crate) lifecycle_state: String,
    pub(crate) checkpoint_id: Option<String>,
    pub(crate) trace_id: String,
    pub(crate) recovered: bool,
    pub(crate) updated_at: u64,
    pub(crate) resume_ready: Option<bool>,
    pub(crate) recovered_at: Option<u64>,
    pub(crate) summary: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SubAgentApprovalEvent {
    pub(crate) status: String,
    pub(crate) approval_id: Option<String>,
    pub(crate) step_index: Option<usize>,
    pub(crate) at: Option<u64>,
    pub(crate) reason: Option<String>,
    pub(crate) action: Option<String>,
}

pub(crate) fn normalize_sub_agent_scope_profile(
    value: Option<&str>,
) -> Result<Option<String>, RpcError> {
    let Some(value) = value.map(str::trim).filter(|entry| !entry.is_empty()) else {
        return Ok(Some("general".to_string()));
    };
    let normalized = value.to_ascii_lowercase();
    match normalized.as_str() {
        "general" | "research" | "review" => Ok(Some(normalized)),
        _ => Err(RpcError::invalid_params(format!(
            "Unsupported sub-agent scope profile `{normalized}`. Expected `general`, `research`, or `review`."
        ))),
    }
}

fn normalize_sub_agent_workspace_read_paths(
    workspace_read_paths: Option<Vec<String>>,
) -> Option<Vec<String>> {
    workspace_read_paths.and_then(|paths| {
        let mut seen = HashSet::new();
        let mut normalized = paths
            .into_iter()
            .map(|entry| entry.trim().to_string())
            .filter(|entry| !entry.is_empty())
            .filter(|entry| seen.insert(entry.clone()))
            .collect::<Vec<_>>();
        normalized.sort();
        if normalized.is_empty() {
            None
        } else {
            Some(normalized)
        }
    })
}

fn validate_profile_allowed_skill_ids(
    scope_profile: &str,
    allowed_skill_ids: Option<Vec<String>>,
) -> Result<Option<Vec<String>>, RpcError> {
    let Some(allowed_skill_ids) = allowed_skill_ids else {
        return Ok(None);
    };
    let profile_allowlist = match scope_profile {
        "research" => Some(DEFAULT_RESEARCH_ALLOWED_SKILL_IDS.as_slice()),
        "review" => Some(DEFAULT_REVIEW_ALLOWED_SKILL_IDS.as_slice()),
        _ => None,
    };
    let Some(profile_allowlist) = profile_allowlist else {
        return Ok(Some(allowed_skill_ids));
    };
    let allowlist = profile_allowlist
        .iter()
        .map(|entry| entry.to_string())
        .collect::<HashSet<_>>();
    let mut normalized = Vec::new();
    let mut seen = HashSet::new();
    for skill_id in allowed_skill_ids {
        let normalized_skill_id = skill_id.trim().to_string();
        if normalized_skill_id.is_empty() || !seen.insert(normalized_skill_id.clone()) {
            continue;
        }
        if !allowlist.contains(normalized_skill_id.as_str()) {
            return Err(RpcError::invalid_params(format!(
                "sub-agent scope profile `{scope_profile}` does not allow skill `{normalized_skill_id}`."
            )));
        }
        normalized.push(normalized_skill_id);
    }
    if normalized.is_empty() {
        Ok(None)
    } else {
        Ok(Some(normalized))
    }
}

pub(crate) fn resolve_sub_agent_profile_defaults(
    access_mode: String,
    scope_profile: String,
    allowed_skill_ids: Option<Vec<String>>,
    allow_network: Option<bool>,
    workspace_read_paths: Option<Vec<String>>,
) -> Result<
    (
        String,
        Option<Vec<String>>,
        Option<bool>,
        Option<Vec<String>>,
        SubAgentScopeProfileDescriptor,
    ),
    RpcError,
> {
    let max_task_ms = resolve_sub_agent_max_task_ms();
    let normalized_workspace_read_paths =
        normalize_sub_agent_workspace_read_paths(workspace_read_paths);
    let normalized_allowed_skill_ids =
        validate_profile_allowed_skill_ids(scope_profile.as_str(), allowed_skill_ids)?;
    match scope_profile.as_str() {
        "research" => {
            if access_mode != "read-only" {
                return Err(RpcError::invalid_params(
                    "sub-agent scope profile `research` requires accessMode `read-only`.",
                ));
            }
            let final_allow_network = allow_network.unwrap_or(true);
            let final_allowed_skill_ids = normalized_allowed_skill_ids.unwrap_or_else(|| {
                DEFAULT_RESEARCH_ALLOWED_SKILL_IDS
                    .iter()
                    .map(|entry| entry.to_string())
                    .collect()
            });
            let descriptor = SubAgentScopeProfileDescriptor {
                profile: scope_profile.clone(),
                allow_network: final_allow_network,
                allowed_skill_ids: final_allowed_skill_ids.clone(),
                workspace_read_paths: normalized_workspace_read_paths.clone().unwrap_or_default(),
                writable_roots: Vec::new(),
                max_task_ms,
                max_depth: DEFAULT_SUB_AGENT_PROFILE_MAX_DEPTH,
                approval_mode: "read_only_safe".to_string(),
                read_only: true,
                description: "Read-only research profile with bounded live-skill access."
                    .to_string(),
            };
            Ok((
                access_mode,
                Some(final_allowed_skill_ids),
                Some(final_allow_network),
                normalized_workspace_read_paths,
                descriptor,
            ))
        }
        "review" => {
            if access_mode != "read-only" {
                return Err(RpcError::invalid_params(
                    "sub-agent scope profile `review` requires accessMode `read-only`.",
                ));
            }
            if allow_network == Some(true) {
                return Err(RpcError::invalid_params(
                    "sub-agent scope profile `review` does not allow network access.",
                ));
            }
            let final_allowed_skill_ids = normalized_allowed_skill_ids.unwrap_or_else(|| {
                DEFAULT_REVIEW_ALLOWED_SKILL_IDS
                    .iter()
                    .map(|entry| entry.to_string())
                    .collect()
            });
            let descriptor = SubAgentScopeProfileDescriptor {
                profile: scope_profile.clone(),
                allow_network: false,
                allowed_skill_ids: final_allowed_skill_ids.clone(),
                workspace_read_paths: normalized_workspace_read_paths.clone().unwrap_or_default(),
                writable_roots: Vec::new(),
                max_task_ms,
                max_depth: DEFAULT_SUB_AGENT_PROFILE_MAX_DEPTH,
                approval_mode: "read_only_safe".to_string(),
                read_only: true,
                description: "Read-only review profile for validation and code inspection."
                    .to_string(),
            };
            Ok((
                access_mode,
                Some(final_allowed_skill_ids),
                Some(false),
                normalized_workspace_read_paths,
                descriptor,
            ))
        }
        _ => {
            let final_allow_network = allow_network.unwrap_or(false);
            let descriptor = SubAgentScopeProfileDescriptor {
                profile: scope_profile.clone(),
                allow_network: final_allow_network,
                allowed_skill_ids: normalized_allowed_skill_ids.clone().unwrap_or_default(),
                workspace_read_paths: normalized_workspace_read_paths.clone().unwrap_or_default(),
                writable_roots: if access_mode == "read-only" {
                    Vec::new()
                } else {
                    vec!["workspace".to_string()]
                },
                max_task_ms,
                max_depth: DEFAULT_SUB_AGENT_PROFILE_MAX_DEPTH,
                approval_mode: "inherit".to_string(),
                read_only: access_mode == "read-only",
                description: "General-purpose coding profile bounded by runtime access mode."
                    .to_string(),
            };
            Ok((
                access_mode,
                normalized_allowed_skill_ids,
                Some(final_allow_network),
                normalized_workspace_read_paths,
                descriptor,
            ))
        }
    }
}

pub(crate) fn map_sub_agent_status_to_workflow_state(
    status: &str,
    error_code: Option<&str>,
) -> &'static str {
    match status {
        SUB_AGENT_STATUS_IDLE => "queued",
        SUB_AGENT_STATUS_RUNNING => "running",
        SUB_AGENT_STATUS_AWAITING_APPROVAL => "awaiting_approval",
        SUB_AGENT_STATUS_COMPLETED | SUB_AGENT_STATUS_CLOSED => "completed",
        SUB_AGENT_STATUS_INTERRUPTED => "interrupted",
        SUB_AGENT_STATUS_FAILED | SUB_AGENT_STATUS_CANCELLED => {
            if matches!(
                error_code,
                Some(SUB_AGENT_TASK_TIMEOUT_ERROR_CODE | "APPROVAL_TIMEOUT")
            ) {
                "timed_out"
            } else {
                "failed"
            }
        }
        _ => "running",
    }
}

pub(crate) fn build_sub_agent_checkpoint_state(
    summary: &SubAgentSessionSummary,
    lifecycle_state: &str,
) -> SubAgentCheckpointState {
    let recovered = summary.recovered.unwrap_or(false);
    let resume_ready =
        resolve_runtime_checkpoint_resume_ready(summary.status.as_str(), recovered, None);
    SubAgentCheckpointState {
        state: map_sub_agent_status_to_workflow_state(
            summary.status.as_str(),
            summary.error_code.as_deref(),
        )
        .to_string(),
        lifecycle_state: lifecycle_state.to_string(),
        checkpoint_id: summary.checkpoint_id.clone(),
        trace_id: summary
            .trace_id
            .clone()
            .unwrap_or_else(|| sub_agent_trace_id(summary.session_id.as_str())),
        recovered,
        updated_at: summary.updated_at,
        resume_ready: Some(resume_ready),
        recovered_at: recovered.then_some(summary.updated_at),
        summary: build_runtime_checkpoint_summary(
            summary.status.as_str(),
            summary.checkpoint_id.as_deref(),
            recovered,
            resume_ready,
        ),
    }
}

pub(crate) fn update_sub_agent_compaction_summary_from_task(
    summary: &mut SubAgentSessionSummary,
    task_summary: &AgentTaskSummary,
) {
    let (context_boundary, context_projection, compaction_summary) =
        derive_agent_task_context_observability(task_summary);
    summary.context_boundary = context_boundary;
    summary.context_projection = context_projection;
    summary.compaction_summary = compaction_summary;
}

fn append_sub_agent_approval_event(
    summary: &mut SubAgentSessionSummary,
    event: SubAgentApprovalEvent,
) {
    let approval_events = summary.approval_events.get_or_insert_with(Vec::new);
    let duplicate = approval_events.last().is_some_and(|current| {
        current.status == event.status
            && current.approval_id == event.approval_id
            && current.step_index == event.step_index
    });
    if !duplicate {
        approval_events.push(event);
    }
}

pub(crate) fn maybe_track_sub_agent_approval_transition(
    summary: &mut SubAgentSessionSummary,
    previous_status: &str,
    task_summary: &AgentTaskSummary,
) {
    if task_summary.status == AgentTaskStatus::AwaitingApproval.as_str() {
        if let Some(pending) = task_summary.pending_approval.as_ref() {
            append_sub_agent_approval_event(
                summary,
                SubAgentApprovalEvent {
                    status: "requested".to_string(),
                    approval_id: Some(pending.approval_id.clone()),
                    step_index: Some(pending.step_index),
                    at: Some(pending.created_at),
                    reason: Some(pending.reason.clone()),
                    action: Some(pending.action.clone()),
                },
            );
        }
        return;
    }
    if previous_status != SUB_AGENT_STATUS_AWAITING_APPROVAL {
        return;
    }
    let resolution_status = match task_summary.error_code.as_deref() {
        Some("APPROVAL_REJECTED") => "rejected",
        Some("APPROVAL_TIMEOUT") => "timed_out",
        Some("TASK_INTERRUPTED") => "interrupted",
        Some("APPROVAL_UNAVAILABLE") => "unavailable",
        _ if task_summary.status == AgentTaskStatus::Completed.as_str() => "approved",
        _ => return,
    };
    let approval_id = task_summary
        .steps
        .iter()
        .find_map(|step| step.approval_id.clone());
    let step_index = task_summary
        .steps
        .iter()
        .find_map(|step| step.approval_id.as_ref().map(|_| step.index));
    append_sub_agent_approval_event(
        summary,
        SubAgentApprovalEvent {
            status: resolution_status.to_string(),
            approval_id,
            step_index,
            at: Some(task_summary.updated_at),
            reason: task_summary.error_message.clone(),
            action: task_summary
                .pending_approval
                .as_ref()
                .map(|pending| pending.action.clone()),
        },
    );
}

fn update_sub_agent_checkpoint_metadata(
    summary: &mut SubAgentSessionSummary,
    checkpoint_id: Option<String>,
    lifecycle_state: &str,
    recovered: bool,
) {
    summary.checkpoint_id = checkpoint_id;
    summary.trace_id = Some(sub_agent_trace_id(summary.session_id.as_str()));
    summary.recovered = Some(recovered);
    summary.checkpoint_state = Some(build_sub_agent_checkpoint_state(summary, lifecycle_state));
}

pub(crate) fn checkpoint_sub_agent_session_runtime_and_cache(
    ctx: &AppContext,
    runtime: &mut SubAgentSessionRuntime,
    lifecycle_state: &str,
    recovered: bool,
) {
    sync_sub_agent_executor_linkage(&mut runtime.summary);
    let checkpoint_id = checkpoint_sub_agent_session_runtime(
        ctx,
        runtime,
        runtime.summary.session_id.as_str(),
        runtime.summary.workspace_id.as_str(),
        runtime.summary.updated_at,
        lifecycle_state,
        recovered,
    );
    update_sub_agent_checkpoint_metadata(
        &mut runtime.summary,
        checkpoint_id,
        lifecycle_state,
        recovered,
    );
    sync_sub_agent_runtime_execution_graph(runtime);
}
