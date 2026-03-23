use super::*;
use crate::sub_agents::SubAgentSessionSummary;
use crate::sub_agents::profiles::SubAgentCheckpointState;
use std::collections::{HashMap, HashSet};
#[path = "rpc_dispatch_mission_control_builders.rs"]
mod builders;
#[path = "rpc_dispatch_mission_control_execution_profile.rs"]
mod execution_profile;
#[path = "rpc_dispatch_mission_control_projection.rs"]
mod projection;
#[path = "rpc_dispatch_mission_control_summary.rs"]
mod summary;
#[path = "rpc_dispatch_mission_control_runtime_truth.rs"]
mod runtime_truth;
#[path = "rpc_dispatch_mission_control_support.rs"]
pub(crate) mod support;
use builders::{build_orphan_task, project_thread_to_task};
pub(crate) use builders::{build_review_pack, project_runtime_task_to_run};
pub(crate) use projection::build_publish_handoff_reference;
use projection::build_review_pack_relaunch_options;
use runtime_truth::{
    build_run_operator_snapshot, build_task_accountability, build_workspace_evidence,
};
use summary::build_mission_control_projection_state;
use support::{
    build_governance_summary, build_placement_evidence, build_profile_readiness,
    build_review_pack_assumptions, build_review_pack_backend_audit,
    build_review_pack_evidence_refs, build_review_pack_file_changes,
    build_review_pack_reproduction_guidance, build_review_pack_rollback_guidance, build_routing,
    build_run_ledger, collect_workspace_roots, derive_completion_reason, derive_run_artifacts,
    derive_run_changed_paths, derive_run_validations, derive_run_warnings,
};
pub(crate) use execution_profile::build_task_execution_profile;
use execution_profile::build_execution_profile;
pub(crate) use support::{
    build_runtime_mission_linkage_summary, build_runtime_review_actionability_summary,
    build_runtime_sub_agent_takeover_bundle, build_runtime_takeover_bundle,
    derive_review_evidence_state, derive_review_validation_outcome,
};
pub(crate) use summary::handle_mission_control_summary_v1;
#[cfg(test)]
#[path = "rpc_dispatch_mission_control_tests.rs"]
mod tests;
#[cfg(test)]
#[path = "rpc_dispatch_mission_control_summary_tests.rs"]
mod summary_tests;
#[cfg(test)]
#[path = "rpc_dispatch_mission_control_runtime_truth_tests.rs"]
mod runtime_truth_tests;
#[cfg(test)]
#[path = "rpc_dispatch_mission_control_graph_tests.rs"]
mod graph_tests;
#[cfg(test)]
#[path = "rpc_dispatch_mission_control_validation_tests.rs"]
mod validation_tests;

const RUNTIME_TASK_ENTITY_PREFIX: &str = "runtime-task:";
const SUB_AGENT_STATUS_INTERRUPTED: &str = "interrupted";
const SUB_AGENT_STATUS_FAILED: &str = "failed";
const SUB_AGENT_STATUS_CANCELLED: &str = "cancelled";
const SUB_AGENT_TASK_TIMEOUT_ERROR_CODE: &str = "SUB_AGENT_TASK_TIMEOUT";

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MissionWorkspaceProjection {
    id: String,
    name: String,
    root_path: String,
    connected: bool,
    default_profile_id: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MissionTaskProjection {
    id: String,
    workspace_id: String,
    title: String,
    objective: Option<String>,
    origin: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    task_source: Option<Value>,
    mode: Option<String>,
    mode_source: String,
    status: String,
    created_at: Option<u64>,
    updated_at: u64,
    current_run_id: Option<String>,
    latest_run_id: Option<String>,
    latest_run_state: Option<String>,
    next_action: Option<Value>,
    lineage: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    accountability: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    execution_graph: Option<Value>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MissionRunProjection {
    id: String,
    task_id: String,
    workspace_id: String,
    state: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    task_source: Option<Value>,
    title: Option<String>,
    summary: Option<String>,
    started_at: Option<u64>,
    finished_at: Option<u64>,
    updated_at: u64,
    current_step_index: Option<usize>,
    pending_intervention: Option<String>,
    auto_drive: Option<Value>,
    execution_profile: Option<Value>,
    profile_readiness: Option<Value>,
    routing: Option<Value>,
    approval: Option<Value>,
    review_decision: Option<Value>,
    intervention: Option<Value>,
    operator_state: Option<Value>,
    next_action: Option<Value>,
    warnings: Vec<String>,
    validations: Vec<Value>,
    artifacts: Vec<Value>,
    changed_paths: Vec<String>,
    completion_reason: Option<String>,
    review_pack_id: Option<String>,
    lineage: Option<Value>,
    ledger: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    checkpoint: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    mission_linkage: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    review_actionability: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    execution_graph: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    takeover_bundle: Option<Value>,
    governance: Option<Value>,
    placement: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    operator_snapshot: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    workspace_evidence: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    mission_brief: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    relaunch_context: Option<Value>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    sub_agents: Vec<MissionRunSubAgentSummary>,
    #[serde(skip_serializing_if = "Option::is_none")]
    publish_handoff: Option<Value>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MissionRunSubAgentApprovalState {
    status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    approval_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    action: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    at: Option<u64>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MissionRunSubAgentSummary {
    session_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    parent_run_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    scope_profile: Option<String>,
    status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    approval_state: Option<MissionRunSubAgentApprovalState>,
    #[serde(skip_serializing_if = "Option::is_none")]
    checkpoint_state: Option<SubAgentCheckpointState>,
    #[serde(skip_serializing_if = "Option::is_none")]
    executor_linkage: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    execution_node: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    execution_edge: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    takeover_bundle: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    summary: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    timed_out_reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    interrupted_reason: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MissionReviewPackProjection {
    id: String,
    run_id: String,
    task_id: String,
    workspace_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    task_source: Option<Value>,
    summary: String,
    review_status: String,
    evidence_state: String,
    validation_outcome: String,
    warning_count: usize,
    warnings: Vec<String>,
    validations: Vec<Value>,
    artifacts: Vec<Value>,
    checks_performed: Vec<String>,
    recommended_next_action: Option<String>,
    file_changes: Option<Value>,
    evidence_refs: Option<Value>,
    assumptions: Option<Vec<String>>,
    reproduction_guidance: Option<Vec<String>>,
    rollback_guidance: Option<Vec<String>>,
    backend_audit: Option<Value>,
    review_decision: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    failure_class: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    relaunch_options: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    sub_agent_summary: Option<Vec<MissionRunSubAgentSummary>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    publish_handoff: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    takeover_bundle: Option<Value>,
    created_at: u64,
    lineage: Option<Value>,
    ledger: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    checkpoint: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    mission_linkage: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    actionability: Option<Value>,
    governance: Option<Value>,
    placement: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    workspace_evidence: Option<Value>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MissionControlSnapshotProjection {
    source: String,
    generated_at: u64,
    workspaces: Vec<MissionWorkspaceProjection>,
    tasks: Vec<MissionTaskProjection>,
    runs: Vec<MissionRunProjection>,
    review_packs: Vec<MissionReviewPackProjection>,
}

fn trim_to_option(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(ToOwned::to_owned)
}

fn push_unique_text(values: &mut Vec<String>, value: Option<&str>) {
    let Some(normalized) = trim_to_option(value) else {
        return;
    };
    if values.iter().any(|entry| entry == &normalized) {
        return;
    }
    values.push(normalized);
}

fn push_unique_action(values: &mut Vec<String>, value: Option<&str>) {
    let Some(normalized) = trim_to_option(value) else {
        return;
    };
    if values.iter().any(|entry| entry == &normalized) {
        return;
    }
    values.push(normalized);
}

fn resolve_mission_task_id(thread_id: Option<&str>, task_id: &str) -> String {
    match trim_to_option(thread_id) {
        Some(thread_id) => thread_id,
        None => format!("{RUNTIME_TASK_ENTITY_PREFIX}{task_id}"),
    }
}

fn build_mission_lineage(
    objective: Option<String>,
    task_source: Option<&Value>,
    thread_id: Option<&str>,
    request_id: Option<&str>,
    execution_profile_id: Option<&str>,
    task_mode: Option<&str>,
    root_task_id: Option<&str>,
    parent_task_id: Option<&str>,
    child_task_ids: &[String],
    auto_drive: Option<&Value>,
    review_decision: Option<&Value>,
) -> Value {
    let destination = auto_drive.and_then(|entry| entry.get("destination"));
    json!({
        "objective": objective,
        "desiredEndState": destination
            .and_then(|entry| entry.get("desiredEndState"))
            .cloned()
            .unwrap_or_else(|| Value::Array(Vec::new())),
        "hardBoundaries": destination
            .and_then(|entry| entry.get("hardBoundaries"))
            .cloned()
            .unwrap_or_else(|| Value::Array(Vec::new())),
        "doneDefinition": destination
            .and_then(|entry| entry.get("doneDefinition"))
            .cloned()
            .unwrap_or(Value::Null),
        "riskPolicy": auto_drive
            .and_then(|entry| entry.get("riskPolicy"))
            .cloned()
            .unwrap_or(Value::Null),
        "taskMode": task_mode,
        "executionProfileId": execution_profile_id,
        "taskSource": task_source.cloned().unwrap_or(Value::Null),
        "threadId": thread_id,
        "requestId": request_id,
        "rootTaskId": root_task_id,
        "parentTaskId": parent_task_id,
        "childTaskIds": child_task_ids,
        "reviewDecisionState": review_decision
            .and_then(|entry| entry.get("status"))
            .cloned()
            .unwrap_or(Value::Null),
        "reviewDecisionSummary": review_decision
        .and_then(|entry| entry.get("summary"))
        .cloned()
        .unwrap_or(Value::Null),
    })
}

fn build_sub_agent_approval_state(
    summary: &SubAgentSessionSummary,
) -> Option<MissionRunSubAgentApprovalState> {
    let event = summary.approval_events.as_ref()?.last()?;
    Some(MissionRunSubAgentApprovalState {
        status: event.status.clone(),
        approval_id: event.approval_id.clone(),
        action: event.action.clone(),
        reason: event.reason.clone(),
        at: event.at,
    })
}

fn build_sub_agent_summary(runtime: &sub_agents::SubAgentSessionRuntime) -> MissionRunSubAgentSummary {
    let summary = &runtime.summary;
    let timed_out_reason = summary
        .error_code
        .as_deref()
        .and_then(|code| {
            (code == SUB_AGENT_TASK_TIMEOUT_ERROR_CODE).then(|| summary.error_message.clone())
        })
        .flatten();
    let interrupted_reason = if timed_out_reason.is_none()
        && matches!(
            summary.status.as_str(),
            SUB_AGENT_STATUS_INTERRUPTED | SUB_AGENT_STATUS_FAILED | SUB_AGENT_STATUS_CANCELLED
        ) {
        summary.error_message.clone()
    } else {
        None
    };
    let summary_text = summary
        .title
        .clone()
        .or_else(|| summary.reason_effort.clone())
        .or_else(|| summary.error_message.clone());
    MissionRunSubAgentSummary {
        session_id: summary.session_id.clone(),
        parent_run_id: trim_to_option(summary.parent_run_id.as_deref()),
        scope_profile: trim_to_option(summary.scope_profile.as_deref()),
        status: summary.status.clone(),
        approval_state: build_sub_agent_approval_state(summary),
        checkpoint_state: summary.checkpoint_state.clone(),
        executor_linkage: summary
            .executor_linkage
            .as_ref()
            .and_then(|linkage| serde_json::to_value(linkage).ok()),
        execution_node: runtime
            .execution_node
            .as_ref()
            .and_then(|node| serde_json::to_value(node).ok()),
        execution_edge: runtime
            .execution_edge
            .as_ref()
            .and_then(|edge| serde_json::to_value(edge).ok()),
        takeover_bundle: Some(build_runtime_sub_agent_takeover_bundle(summary)),
        summary: summary_text,
        timed_out_reason,
        interrupted_reason,
    }
}

pub(crate) fn build_sub_agent_summary_map(
    runtimes: &[sub_agents::SubAgentSessionRuntime],
) -> HashMap<String, Vec<MissionRunSubAgentSummary>> {
    let mut map: HashMap<String, Vec<MissionRunSubAgentSummary>> = HashMap::new();
    for runtime in runtimes {
        let summary = &runtime.summary;
        if let Some(parent_run_id) = trim_to_option(summary.parent_run_id.as_deref()) {
            map.entry(parent_run_id)
                .or_default()
                .push(build_sub_agent_summary(runtime));
        }
    }
    map
}

pub(crate) async fn build_mission_run_projection_by_run_id(
    ctx: &AppContext,
    run_id: &str,
) -> Option<MissionRunProjection> {
    let runtime = {
        let store = ctx.agent_tasks.read().await;
        store.tasks.get(run_id.trim()).cloned()
    }?;

    let backend_summaries = {
        let store = ctx.runtime_backends.read().await;
        store.clone()
    };
    let sub_agents_by_run = {
        let runtimes = {
            let store = ctx.sub_agent_sessions.read().await;
            store.sessions.values().cloned().collect::<Vec<_>>()
        };
        build_sub_agent_summary_map(runtimes.as_slice())
    };
    let workspace_roots_by_id = {
        let state = ctx.state.read().await;
        state
            .workspaces
            .iter()
            .map(|workspace| (workspace.id.clone(), workspace.path.clone()))
            .collect::<HashMap<_, _>>()
    };

    Some(project_runtime_task_to_run(
        &runtime,
        &backend_summaries,
        &sub_agents_by_run,
        &workspace_roots_by_id,
    ))
}

pub(crate) async fn build_review_pack_projection_by_run_id(
    ctx: &AppContext,
    run_id: &str,
) -> Option<MissionReviewPackProjection> {
    let run = build_mission_run_projection_by_run_id(ctx, run_id).await?;
    Some(build_review_pack(&run))
}

pub(crate) fn project_run_state(status: &str, distributed_status: Option<&str>) -> String {
    if status == "running" && distributed_status == Some("planning") {
        return "preparing".to_string();
    }
    if status == "running" && distributed_status == Some("aggregating") {
        return "validating".to_string();
    }
    match status {
        "queued" => "queued",
        "running" => "running",
        "paused" => "paused",
        "awaiting_approval" => "needs_input",
        "completed" => "review_ready",
        "failed" => "failed",
        "cancelled" | "interrupted" => "cancelled",
        _ => "draft",
    }
    .to_string()
}

fn project_task_status(run_state: Option<&str>, archived: bool, running: bool) -> String {
    match run_state {
        Some("draft") => "draft",
        Some("queued") | Some("preparing") => "queued",
        Some("running") | Some("validating") => "running",
        Some("paused") => "paused",
        Some("needs_input") => "needs_input",
        Some("review_ready") => "review_ready",
        Some("failed") => "failed",
        Some("cancelled") => "cancelled",
        Some(_) | None if archived => "archived",
        Some(_) | None if running => "running",
        _ => "ready",
    }
    .to_string()
}

fn is_terminal_run_state(state: &str) -> bool {
    matches!(state, "review_ready" | "failed" | "cancelled")
}

fn map_access_mode_to_task_mode(
    access_mode: &str,
    agent_profile: &str,
) -> (Option<String>, String, String) {
    if agent_profile == "review" {
        return (
            Some("ask".to_string()),
            "execution_profile".to_string(),
            "operator_review".to_string(),
        );
    }
    match access_mode {
        "read-only" => (
            Some("ask".to_string()),
            "access_mode".to_string(),
            "operator_review".to_string(),
        ),
        "full-access" => (
            Some("delegate".to_string()),
            "access_mode".to_string(),
            "autonomous_delegate".to_string(),
        ),
        "on-request" => (
            Some("pair".to_string()),
            "access_mode".to_string(),
            "bounded_delegate".to_string(),
        ),
        _ => (None, "missing".to_string(), "bounded_delegate".to_string()),
    }
}

fn latest_step_approval(summary: &AgentTaskSummary) -> Option<&Value> {
    summary.steps.iter().rev().find_map(|step| {
        step.metadata
            .as_object()
            .and_then(|metadata| metadata.get("approval"))
    })
}

pub(crate) fn build_approval(runtime: &AgentTaskRuntime) -> Value {
    let summary = &runtime.summary;
    if let Some(pending) = summary.pending_approval.as_ref() {
        return json!({
            "status": "pending_decision",
            "approvalId": pending.approval_id,
            "label": "Awaiting approval",
            "summary": pending.reason,
        });
    }
    if summary.status == "awaiting_approval" {
        return json!({
            "status": "pending_decision",
            "approvalId": summary.pending_approval_id,
            "label": "Awaiting approval",
            "summary": "This run is waiting for an operator decision before it can continue.",
        });
    }
    if let Some(approval) = latest_step_approval(summary) {
        let resolution_status = approval
            .get("resolutionStatus")
            .and_then(Value::as_str)
            .or_else(|| approval.get("decision").and_then(Value::as_str));
        let resolution_reason = approval
            .get("resolutionReason")
            .and_then(Value::as_str)
            .or_else(|| approval.get("requestReason").and_then(Value::as_str))
            .unwrap_or("Approval history was recorded without a detailed summary.");
        if resolution_status == Some("approved") {
            return json!({
                "status": "approved",
                "approvalId": Value::Null,
                "label": "Approval resolved",
                "summary": resolution_reason,
            });
        }
        if resolution_status == Some("rejected") {
            return json!({
                "status": "rejected",
                "approvalId": Value::Null,
                "label": "Approval rejected",
                "summary": resolution_reason,
            });
        }
    }
    json!({
        "status": "not_required",
        "approvalId": Value::Null,
        "label": "No pending approval",
        "summary": "This run does not currently require an approval decision.",
    })
}

fn is_recoverable_runtime_task(runtime: &AgentTaskRuntime) -> bool {
    let summary = &runtime.summary;
    if summary.status != "interrupted" {
        return false;
    }
    if runtime.recovered {
        return true;
    }
    matches!(
        summary.error_code.as_deref(),
        Some("runtime_restart_recovery")
            | Some("runtime.restart.recovery")
            | Some("runtime.task.interrupt.recoverable")
            | Some("runtime.task.interrupt.recovery")
    )
}

pub(crate) fn build_intervention(runtime: &AgentTaskRuntime) -> Value {
    let summary = &runtime.summary;
    let recoverable = is_recoverable_runtime_task(runtime);
    let resumable = recoverable || summary.status == "paused";
    let has_replayable_brief = trim_to_option(summary.title.as_deref()).is_some()
        || summary.steps.iter().any(|step| {
            !step.message.trim().is_empty() || trim_to_option(step.output.as_deref()).is_some()
        });
    let actions = vec![
        json!({
            "action": "pause",
            "label": "Pause",
            "enabled": summary.status == "running",
            "supported": true,
            "reason": Value::Null,
        }),
        json!({
            "action": "resume",
            "label": "Resume",
            "enabled": resumable,
            "supported": true,
            "reason": if resumable { Value::Null } else { Value::String("Only paused or recoverable interrupted runs can resume.".to_string()) },
        }),
        json!({
            "action": "cancel",
            "label": "Cancel",
            "enabled": matches!(summary.status.as_str(), "queued" | "running" | "awaiting_approval"),
            "supported": true,
            "reason": Value::Null,
        }),
        json!({
            "action": "retry",
            "label": "Retry",
            "enabled": has_replayable_brief,
            "supported": has_replayable_brief,
            "reason": if has_replayable_brief { Value::Null } else { Value::String("Retry needs a reusable mission brief.".to_string()) },
        }),
        json!({
            "action": "continue_with_clarification",
            "label": "Clarify",
            "enabled": has_replayable_brief,
            "supported": has_replayable_brief,
            "reason": if has_replayable_brief { Value::Null } else { Value::String("Clarification needs a reusable mission brief.".to_string()) },
        }),
        json!({
            "action": "narrow_scope",
            "label": "Narrow scope",
            "enabled": has_replayable_brief,
            "supported": has_replayable_brief,
            "reason": if has_replayable_brief { Value::Null } else { Value::String("Scope adjustment needs a reusable mission brief.".to_string()) },
        }),
        json!({
            "action": "relax_validation",
            "label": "Relax validation",
            "enabled": has_replayable_brief,
            "supported": has_replayable_brief,
            "reason": if has_replayable_brief { Value::Null } else { Value::String("Validation changes need a reusable mission brief.".to_string()) },
        }),
        json!({
            "action": "switch_profile_and_retry",
            "label": "Switch profile",
            "enabled": has_replayable_brief,
            "supported": has_replayable_brief,
            "reason": if has_replayable_brief { Value::Null } else { Value::String("Profile switching needs a reusable mission brief.".to_string()) },
        }),
        json!({
            "action": "escalate_to_pair_mode",
            "label": "Escalate to pair mode",
            "enabled": has_replayable_brief,
            "supported": has_replayable_brief,
            "reason": if has_replayable_brief { Value::Null } else { Value::String("Pair-mode escalation needs a reusable mission brief.".to_string()) },
        }),
    ];
    let primary_action =
        if summary.pending_approval_id.is_some() || summary.status == "awaiting_approval" {
            Some("continue_with_clarification")
        } else if summary.status == "paused" || recoverable {
            Some("resume")
        } else if matches!(
            summary.status.as_str(),
            "failed" | "completed" | "cancelled"
        ) {
            Some("retry")
        } else if matches!(summary.status.as_str(), "running" | "queued") {
            Some("cancel")
        } else {
            None
        };
    json!({
        "actions": actions,
        "primaryAction": primary_action,
    })
}

fn build_auto_drive(runtime: &AgentTaskRuntime) -> Option<Value> {
    runtime
        .summary
        .auto_drive
        .as_ref()
        .and_then(|auto_drive| serde_json::to_value(auto_drive).ok())
}

pub(crate) fn build_operator_state(
    runtime: &AgentTaskRuntime,
    approval: &Value,
    routing: &Value,
) -> Value {
    let summary = &runtime.summary;
    let approval_status = approval
        .get("status")
        .and_then(Value::as_str)
        .unwrap_or("unavailable");
    let routing_health = routing
        .get("health")
        .and_then(Value::as_str)
        .unwrap_or("attention");
    let routing_hint = routing.get("routeHint").and_then(Value::as_str);
    if approval_status == "pending_decision" {
        return json!({
            "health": "blocked",
            "headline": "Operator decision required",
            "detail": approval.get("summary").and_then(Value::as_str),
        });
    }
    if routing_health == "blocked" {
        return json!({
            "health": "blocked",
            "headline": "Routing metadata is incomplete",
            "detail": routing_hint,
        });
    }
    if summary.status == "failed" {
        return json!({
            "health": "attention",
            "headline": "Run failed",
            "detail": trim_to_option(summary.error_message.as_deref()),
        });
    }
    if summary.status == "paused" {
        return json!({
            "health": "attention",
            "headline": "Run is paused",
            "detail": trim_to_option(summary.error_message.as_deref()),
        });
    }
    if is_recoverable_runtime_task(runtime) {
        return json!({
            "health": "attention",
            "headline": "Run can resume from checkpoint",
            "detail": "Resume is available because runtime recovery preserved checkpoint state.",
        });
    }
    json!({
        "health": if routing_health == "ready" { "healthy" } else { "attention" },
        "headline": if routing_health == "ready" { "Run is controllable" } else { "Run needs operator attention" },
        "detail": routing_hint,
    })
}

pub(crate) fn build_next_action(runtime: &AgentTaskRuntime, approval: &Value) -> Value {
    let summary = &runtime.summary;
    if approval.get("status").and_then(Value::as_str) == Some("pending_decision") {
        return json!({
            "label": "Approve or reject this run",
            "action": "continue_with_clarification",
            "detail": approval.get("summary").cloned().unwrap_or(Value::Null),
        });
    }
    if summary.status == "completed" {
        return json!({
            "label": "Review the result",
            "action": "review",
            "detail": "The run finished and is ready for operator review.",
        });
    }
    if is_recoverable_runtime_task(runtime) {
        return json!({
            "label": "Resume from checkpoint",
            "action": "resume",
            "detail": "Runtime recovery preserved state for this interrupted run.",
        });
    }
    if summary.status == "paused" {
        return json!({
            "label": "Resume paused run",
            "action": "resume",
            "detail": "This run is paused and can continue from its latest checkpoint.",
        });
    }
    if matches!(summary.status.as_str(), "failed" | "cancelled") {
        return json!({
            "label": "Retry with the current brief",
            "action": "retry",
            "detail": "Launch a new run from the prior mission brief or switch profile first.",
        });
    }
    if matches!(summary.status.as_str(), "running" | "queued") {
        return json!({
            "label": "Continue monitoring or cancel",
            "action": "cancel",
            "detail": "This run is still active and can be interrupted from Mission Control.",
        });
    }
    json!({
        "label": "Inspect run state",
        "action": "review",
        "detail": trim_to_option(summary.error_message.as_deref()),
    })
}

pub(crate) fn build_review_decision(runtime: &AgentTaskRuntime, run_state: &str) -> Option<Value> {
    if !is_terminal_run_state(run_state) {
        return None;
    }
    if let Some(review_decision) = runtime.summary.review_decision.as_ref() {
        return Some(json!({
            "status": review_decision.status,
            "reviewPackId": review_decision.review_pack_id,
            "label": review_decision.label,
            "summary": review_decision.summary,
            "decidedAt": review_decision.decided_at,
        }));
    }
    Some(json!({
        "status": "pending",
        "reviewPackId": format!("review-pack:{}", runtime.summary.task_id),
        "label": "Decision pending",
        "summary": "Accept or reject this result from the review surface.",
        "decidedAt": Value::Null,
    }))
}

pub(crate) async fn handle_mission_control_snapshot_v1(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let _ = as_object(params)?;
    let revision = ctx
        .runtime_update_revision
        .load(std::sync::atomic::Ordering::Relaxed);
    if let Some(cached_snapshot) = crate::read_runtime_revision_cached_json_value(
        ctx,
        &RuntimeRevisionCacheKey::MissionControlSnapshot,
        revision,
    ) {
        return Ok(cached_snapshot);
    }
    let generated_at = now_ms();
    let projection = build_mission_control_projection_state(ctx, generated_at).await;
    let snapshot = MissionControlSnapshotProjection {
        source: "runtime_snapshot_v1".to_string(),
        generated_at: projection.generated_at,
        workspaces: projection.workspaces,
        tasks: projection.tasks,
        runs: projection.runs,
        review_packs: projection.review_packs,
    };
    let snapshot = serde_json::to_value(snapshot)
        .map_err(|error| RpcError::internal(format!("Serialize mission control snapshot: {error}")))?;
    crate::store_runtime_revision_cached_json_value(
        ctx,
        RuntimeRevisionCacheKey::MissionControlSnapshot,
        revision,
        &snapshot,
    );
    Ok(snapshot)
}
