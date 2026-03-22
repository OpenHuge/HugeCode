use super::*;
use crate::rpc_dispatch::mission_control_dispatch::support::{
    build_placement_evidence, build_runtime_takeover_bundle, derive_run_artifacts,
    derive_run_validations, derive_run_warnings,
};
use crate::rpc_dispatch::mission_control_dispatch::{
    build_approval, build_intervention, build_next_action, build_operator_state,
    build_publish_handoff_reference, build_review_decision, build_review_pack,
    build_runtime_mission_linkage_summary, build_runtime_review_actionability_summary,
    derive_review_evidence_state, derive_review_validation_outcome, project_run_state,
    project_runtime_task_to_run,
};
use crate::runtime_checkpoint::build_agent_task_checkpoint_state_payload;
use crate::{
    build_profile_readiness, build_runtime_execution_graph_summary_with_runtime_truth,
    build_task_execution_profile, build_task_routing,
};

pub(super) const APPROVAL_TIMEOUT_ERROR_CODE: &str = "APPROVAL_TIMEOUT";
pub(super) const APPROVAL_TIMEOUT_ERROR_MESSAGE: &str =
    "Approval wait timed out before a decision was recorded.";
const DEFAULT_AGENT_APPROVAL_WAIT_TIMEOUT_MS: u64 = 300_000;
const MAX_AGENT_APPROVAL_WAIT_TIMEOUT_MS: u64 = 3_600_000;

fn build_agent_task_publish_handoff_payload(
    summary: &AgentTaskSummary,
    workspace_root: Option<&str>,
) -> Option<Value> {
    build_publish_handoff_reference(
        summary.task_id.as_str(),
        summary.auto_drive.as_ref(),
        workspace_root,
    )
}

pub(crate) fn derive_agent_task_review_pack_id(summary: &AgentTaskSummary) -> Option<String> {
    if let Some(review_pack_id) = summary
        .review_decision
        .as_ref()
        .map(|decision| decision.review_pack_id.clone())
    {
        return Some(review_pack_id);
    }
    let run_state = project_run_state(
        summary.status.as_str(),
        summary.distributed_status.as_deref(),
    );
    if matches!(run_state.as_str(), "review_ready" | "failed" | "cancelled") {
        return Some(format!("review-pack:{}", summary.task_id));
    }
    None
}

pub(super) fn clone_runtime_backend_snapshot(
    backends: &HashMap<String, RuntimeBackendSummary>,
    backend_id: Option<&str>,
) -> Option<RuntimeBackendSummary> {
    let backend_id = backend_id
        .map(str::trim)
        .filter(|value| !value.is_empty())?;
    backends.get(backend_id).cloned()
}

fn resolve_workspace_root_for_runtime_refresh(
    ctx: &AppContext,
    workspace_id: &str,
) -> Option<String> {
    ctx.state.try_read().ok().and_then(|state| {
        state
            .workspaces
            .iter()
            .find(|workspace| workspace.id == workspace_id)
            .map(|workspace| workspace.path.clone())
    })
}

fn resolve_runtime_backend_for_refresh(
    ctx: &AppContext,
    backend_id: Option<&str>,
) -> Option<RuntimeBackendSummary> {
    ctx.runtime_backends
        .try_read()
        .ok()
        .and_then(|backends| clone_runtime_backend_snapshot(&backends, backend_id))
}

fn derive_agent_task_runtime_review_actionability(
    run_state: &str,
    review_decision: Option<&Value>,
    intervention: &Value,
    next_action: &Value,
    validations: &[Value],
    warnings: &[String],
    artifacts: &[Value],
    placement: Option<&Value>,
    mission_linkage: &Value,
) -> Value {
    build_runtime_review_actionability_summary(
        run_state,
        review_decision,
        intervention,
        next_action,
        derive_review_evidence_state(validations, warnings, artifacts),
        derive_review_validation_outcome(validations).as_str(),
        placement,
        mission_linkage,
    )
}

pub(crate) fn refresh_agent_task_runtime_execution_truth(
    ctx: &AppContext,
    runtime: &mut AgentTaskRuntime,
) -> Result<(), RpcError> {
    let workspace_root =
        resolve_workspace_root_for_runtime_refresh(ctx, runtime.summary.workspace_id.as_str());
    let backend = resolve_runtime_backend_for_refresh(ctx, runtime.summary.backend_id.as_deref());
    let routing = build_task_routing(&runtime.summary, backend.as_ref());
    let approval = build_approval(runtime);
    let intervention = build_intervention(runtime);
    let next_action = build_next_action(runtime, &approval);
    let run_state = project_run_state(
        runtime.summary.status.as_str(),
        runtime.summary.distributed_status.as_deref(),
    );
    let review_decision = build_review_decision(runtime, run_state.as_str());
    let validations = derive_run_validations(&runtime.summary);
    let warnings = derive_run_warnings(runtime);
    let artifacts = derive_run_artifacts(runtime);
    let execution_profile = build_task_execution_profile(&runtime.summary);
    let checkpoint_state = build_agent_task_checkpoint_state_payload(
        &runtime.summary,
        runtime.recovered,
        runtime.checkpoint_id.as_deref(),
    );
    let mission_task_id = if let Some(thread_id) = runtime
        .summary
        .thread_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        thread_id.to_string()
    } else {
        format!("runtime-task:{}", runtime.summary.task_id)
    };
    let review_pack_id = derive_agent_task_review_pack_id(&runtime.summary);
    let backend_summaries = backend
        .map(|summary| HashMap::from([(summary.backend_id.clone(), summary.clone())]))
        .unwrap_or_default();
    let placement = build_placement_evidence(
        &runtime.summary,
        &routing,
        &execution_profile,
        &backend_summaries,
    );
    let mission_linkage = build_runtime_mission_linkage_summary(
        runtime.summary.workspace_id.as_str(),
        runtime.summary.task_id.as_str(),
        mission_task_id.as_str(),
        runtime.summary.thread_id.as_deref(),
        runtime.summary.request_id.as_deref(),
        review_pack_id.as_deref(),
        checkpoint_state.get("checkpointId").and_then(Value::as_str),
        checkpoint_state.get("traceId").and_then(Value::as_str),
    );
    let review_actionability = derive_agent_task_runtime_review_actionability(
        run_state.as_str(),
        review_decision.as_ref(),
        &intervention,
        &next_action,
        validations.as_slice(),
        warnings.as_slice(),
        artifacts.as_slice(),
        placement.as_ref(),
        &mission_linkage,
    );
    let publish_handoff =
        build_agent_task_publish_handoff_payload(&runtime.summary, workspace_root.as_deref());
    let takeover_bundle = build_runtime_takeover_bundle(
        run_state.as_str(),
        &approval,
        &next_action,
        &checkpoint_state,
        Some(&mission_linkage),
        review_pack_id.as_deref(),
        publish_handoff.as_ref(),
        Some(&review_actionability),
    );
    let execution_graph = build_runtime_execution_graph_summary_with_runtime_truth(
        &runtime.summary,
        Some(run_state.as_str()),
        placement.as_ref(),
        Some(&checkpoint_state),
        Some(&review_actionability),
    );
    runtime.review_actionability = Some(review_actionability);
    runtime.takeover_bundle = Some(takeover_bundle);
    runtime.execution_graph = Some(execution_graph);
    Ok(())
}

pub(super) fn resolve_agent_approval_wait_timeout_ms() -> u64 {
    std::env::var("CODE_RUNTIME_SERVICE_AGENT_APPROVAL_WAIT_TIMEOUT_MS")
        .ok()
        .and_then(|value| value.trim().parse::<u64>().ok())
        .map(|value| value.clamp(1, MAX_AGENT_APPROVAL_WAIT_TIMEOUT_MS))
        .unwrap_or(DEFAULT_AGENT_APPROVAL_WAIT_TIMEOUT_MS)
}

pub(crate) fn build_agent_task_response_payload(
    summary: &AgentTaskSummary,
    recovered: bool,
    checkpoint_id: Option<&str>,
    backend: Option<&RuntimeBackendSummary>,
    workspace_root: Option<&str>,
) -> Result<Value, RpcError> {
    let execution_profile = build_task_execution_profile(summary);
    let routing = build_task_routing(summary, backend);
    let profile_readiness = build_profile_readiness(&routing);
    let run_state = project_run_state(
        summary.status.as_str(),
        summary.distributed_status.as_deref(),
    );
    let backend_summaries = backend
        .cloned()
        .map(|backend| HashMap::from([(backend.backend_id.clone(), backend)]))
        .unwrap_or_default();
    let mut payload = serde_json::to_value(summary)
        .map_err(|error| RpcError::internal(format!("Serialize agent task summary: {error}")))?;
    let object = payload
        .as_object_mut()
        .ok_or_else(|| RpcError::internal("Agent task summary payload must be an object."))?;
    object.insert("recovered".to_string(), Value::Bool(recovered));
    if let Some(checkpoint_id) = checkpoint_id {
        object.insert(
            "checkpointId".to_string(),
            Value::String(checkpoint_id.to_string()),
        );
    }
    let checkpoint_state =
        build_agent_task_checkpoint_state_payload(summary, recovered, checkpoint_id);
    let mission_task_id = if let Some(thread_id) = summary
        .thread_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        thread_id.to_string()
    } else {
        format!("runtime-task:{}", summary.task_id)
    };
    let review_pack_id = derive_agent_task_review_pack_id(summary);
    let placement =
        build_placement_evidence(summary, &routing, &execution_profile, &backend_summaries);
    let execution_graph = build_runtime_execution_graph_summary_with_runtime_truth(
        summary,
        Some(run_state.as_str()),
        placement.as_ref(),
        Some(&checkpoint_state),
        None,
    );
    object.insert(
        "traceId".to_string(),
        checkpoint_state
            .get("traceId")
            .cloned()
            .unwrap_or(Value::String(agent_task_trace_id(summary.task_id.as_str()))),
    );
    object.insert("checkpointState".to_string(), checkpoint_state);
    object.insert(
        "missionLinkage".to_string(),
        build_runtime_mission_linkage_summary(
            summary.workspace_id.as_str(),
            summary.task_id.as_str(),
            mission_task_id.as_str(),
            summary.thread_id.as_deref(),
            summary.request_id.as_deref(),
            review_pack_id.as_deref(),
            object
                .get("checkpointState")
                .and_then(|entry| entry.get("checkpointId"))
                .and_then(Value::as_str),
            object
                .get("checkpointState")
                .and_then(|entry| entry.get("traceId"))
                .and_then(Value::as_str),
        ),
    );
    object.insert("executionProfile".to_string(), execution_profile);
    object.insert("routing".to_string(), routing);
    object.insert("profileReadiness".to_string(), profile_readiness);
    if let Some(placement) = placement {
        object.insert("placement".to_string(), placement);
    }
    object.insert(
        "executionGraph".to_string(),
        serde_json::to_value(execution_graph).map_err(|error| {
            RpcError::internal(format!("Serialize execution graph summary: {error}"))
        })?,
    );
    if let Some(review_pack_id) = review_pack_id {
        object.insert("reviewPackId".to_string(), Value::String(review_pack_id));
    }
    if let Some(publish_handoff) = build_agent_task_publish_handoff_payload(summary, workspace_root)
    {
        object.insert("publishHandoff".to_string(), publish_handoff);
    }
    Ok(payload)
}

pub(crate) fn build_agent_task_runtime_response_payload(
    runtime: &AgentTaskRuntime,
    backend: Option<&RuntimeBackendSummary>,
    workspace_root: Option<&str>,
) -> Result<Value, RpcError> {
    let routing = build_task_routing(&runtime.summary, backend);
    let approval = build_approval(runtime);
    let intervention = build_intervention(runtime);
    let operator_state = build_operator_state(runtime, &approval, &routing);
    let next_action = build_next_action(runtime, &approval);
    let run_state = project_run_state(
        runtime.summary.status.as_str(),
        runtime.summary.distributed_status.as_deref(),
    );
    let review_decision = build_review_decision(runtime, run_state.as_str());
    let validations = derive_run_validations(&runtime.summary);
    let warnings = derive_run_warnings(runtime);
    let artifacts = derive_run_artifacts(runtime);
    let mut payload = build_agent_task_response_payload(
        &runtime.summary,
        runtime.recovered,
        runtime.checkpoint_id.as_deref(),
        backend,
        workspace_root,
    )?;
    let object = payload
        .as_object_mut()
        .ok_or_else(|| RpcError::internal("Agent task runtime payload must be an object."))?;
    object.insert("approvalState".to_string(), approval);
    object.insert("intervention".to_string(), intervention);
    object.insert("operatorState".to_string(), operator_state);
    object.insert("nextAction".to_string(), next_action);
    if let Some(review_decision) = review_decision {
        object.insert("reviewDecision".to_string(), review_decision);
    }
    let mission_linkage = object.get("missionLinkage").cloned().unwrap_or(Value::Null);
    let review_actionability = runtime.review_actionability.clone().unwrap_or_else(|| {
        derive_agent_task_runtime_review_actionability(
            run_state.as_str(),
            object.get("reviewDecision"),
            object.get("intervention").unwrap_or(&Value::Null),
            object.get("nextAction").unwrap_or(&Value::Null),
            validations.as_slice(),
            warnings.as_slice(),
            artifacts.as_slice(),
            object.get("placement"),
            &mission_linkage,
        )
    });
    object.insert("reviewActionability".to_string(), review_actionability);
    let takeover_bundle = runtime.takeover_bundle.clone().unwrap_or_else(|| {
        build_runtime_takeover_bundle(
            run_state.as_str(),
            object.get("approvalState").unwrap_or(&Value::Null),
            object.get("nextAction").unwrap_or(&Value::Null),
            object.get("checkpointState").unwrap_or(&Value::Null),
            object.get("missionLinkage"),
            object.get("reviewPackId").and_then(Value::as_str),
            object.get("publishHandoff"),
            object.get("reviewActionability"),
        )
    });
    object.insert("takeoverBundle".to_string(), takeover_bundle);
    let execution_graph = runtime.execution_graph.clone().unwrap_or_else(|| {
        build_runtime_execution_graph_summary_with_runtime_truth(
            &runtime.summary,
            Some(run_state.as_str()),
            object.get("placement"),
            object.get("checkpointState"),
            object.get("reviewActionability"),
        )
    });
    object.insert(
        "executionGraph".to_string(),
        serde_json::to_value(execution_graph).map_err(|error| {
            RpcError::internal(format!("Serialize execution graph summary: {error}"))
        })?,
    );
    let backend_summaries = backend
        .cloned()
        .map(|entry| HashMap::from([(entry.backend_id.clone(), entry)]))
        .unwrap_or_default();
    let workspace_roots_by_id = workspace_root
        .map(|root| HashMap::from([(runtime.summary.workspace_id.clone(), root.to_string())]))
        .unwrap_or_default();
    let sub_agents_by_run = HashMap::new();
    let run_summary = project_runtime_task_to_run(
        runtime,
        &backend_summaries,
        &sub_agents_by_run,
        &workspace_roots_by_id,
    );
    object.insert(
        "runSummary".to_string(),
        serde_json::to_value(&run_summary)
            .map_err(|error| RpcError::internal(format!("Serialize run summary: {error}")))?,
    );
    if object.get("reviewPackId").and_then(Value::as_str).is_some() {
        let review_pack_summary = build_review_pack(&run_summary);
        object.insert(
            "reviewPackSummary".to_string(),
            serde_json::to_value(review_pack_summary).map_err(|error| {
                RpcError::internal(format!("Serialize review pack summary: {error}"))
            })?,
        );
    }
    Ok(payload)
}

async fn resolve_workspace_root_by_id(ctx: &AppContext, workspace_id: &str) -> Option<String> {
    let state = ctx.state.read().await;
    state
        .workspaces
        .iter()
        .find(|workspace| workspace.id == workspace_id)
        .map(|workspace| workspace.path.clone())
}

pub(super) async fn collect_workspace_roots_by_id(ctx: &AppContext) -> HashMap<String, String> {
    let state = ctx.state.read().await;
    state
        .workspaces
        .iter()
        .map(|workspace| (workspace.id.clone(), workspace.path.clone()))
        .collect()
}

pub(super) async fn build_agent_task_response_payload_for_ctx(
    ctx: &AppContext,
    summary: &AgentTaskSummary,
    recovered: bool,
    checkpoint_id: Option<&str>,
    backend: Option<&RuntimeBackendSummary>,
) -> Result<Value, RpcError> {
    let workspace_root = resolve_workspace_root_by_id(ctx, summary.workspace_id.as_str()).await;
    build_agent_task_response_payload(
        summary,
        recovered,
        checkpoint_id,
        backend,
        workspace_root.as_deref(),
    )
}

pub(super) async fn build_agent_task_runtime_response_payload_for_ctx(
    ctx: &AppContext,
    runtime: &AgentTaskRuntime,
    backend: Option<&RuntimeBackendSummary>,
) -> Result<Value, RpcError> {
    let workspace_root =
        resolve_workspace_root_by_id(ctx, runtime.summary.workspace_id.as_str()).await;
    build_agent_task_runtime_response_payload(runtime, backend, workspace_root.as_deref())
}

pub(super) fn checkpoint_agent_task_runtime_and_cache(
    ctx: &AppContext,
    task: &mut AgentTaskRuntime,
    lifecycle_state: &str,
) -> Option<String> {
    let checkpoint_id = checkpoint_agent_task_runtime(ctx, task, lifecycle_state);
    if let Some(checkpoint_id_value) = checkpoint_id.as_ref() {
        task.checkpoint_id = Some(checkpoint_id_value.clone());
    }
    if let Err(error) = refresh_agent_task_runtime_execution_truth(ctx, task) {
        tracing::warn!(
            task_id = task.summary.task_id.as_str(),
            error = error.message(),
            "failed to refresh runtime execution truth after checkpoint"
        );
    }
    checkpoint_id
}

pub(super) fn set_auto_drive_stop_state(
    auto_drive: &mut Option<AgentTaskAutoDriveState>,
    reason: &str,
    summary: Option<String>,
) {
    let Some(state) = auto_drive.as_mut() else {
        return;
    };
    state.stop = Some(AgentTaskAutoDriveStopState {
        reason: reason.to_string(),
        summary,
        at: Some(now_ms()),
    });
}

pub(super) fn clear_auto_drive_stop_state(auto_drive: &mut Option<AgentTaskAutoDriveState>) {
    if let Some(state) = auto_drive.as_mut() {
        state.recovery = None;
        state.stop = None;
        if let Some(navigation) = state.navigation.as_mut() {
            navigation.last_progress_at = Some(now_ms());
            navigation.no_progress_iterations = Some(0);
        }
    }
}

pub(super) fn prepare_auto_drive_for_child(
    auto_drive: Option<AgentTaskAutoDriveState>,
    action: AgentTaskInterventionAction,
) -> Option<AgentTaskAutoDriveState> {
    super::initialize_auto_drive_state(auto_drive).map(|mut state| {
        if let Some(navigation) = state.navigation.as_mut() {
            if matches!(
                action,
                AgentTaskInterventionAction::Retry
                    | AgentTaskInterventionAction::ContinueWithClarification
                    | AgentTaskInterventionAction::NarrowScope
                    | AgentTaskInterventionAction::RelaxValidation
                    | AgentTaskInterventionAction::SwitchProfileAndRetry
                    | AgentTaskInterventionAction::EscalateToPairMode
            ) {
                navigation.reroute_count = Some(navigation.reroute_count.unwrap_or(0) + 1);
            }
            navigation.last_progress_at = Some(now_ms());
            navigation.no_progress_iterations = Some(0);
        }
        state.recovery = None;
        state.stop = None;
        state
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mock_runtime() -> AgentTaskRuntime {
        let now = now_ms();
        AgentTaskRuntime {
            summary: AgentTaskSummary {
                task_id: "task-routing-baseline".to_string(),
                workspace_id: "workspace-1".to_string(),
                thread_id: Some("thread-1".to_string()),
                request_id: Some("request-1".to_string()),
                title: Some("Routing baseline".to_string()),
                task_source: None,
                validation_preset_id: Some("standard".to_string()),
                status: AgentTaskStatus::Running.as_str().to_string(),
                access_mode: "full-access".to_string(),
                execution_profile_id: Some("autonomous-delegate".to_string()),
                review_profile_id: None,
                agent_profile: "delegate".to_string(),
                provider: Some("openai".to_string()),
                model_id: Some("gpt-5.3-codex".to_string()),
                reason_effort: Some("high".to_string()),
                routed_provider: Some("openai".to_string()),
                routed_model_id: Some("gpt-5.3-codex".to_string()),
                routed_pool: Some("codex".to_string()),
                routed_source: Some("workspace-default".to_string()),
                current_step: None,
                created_at: now,
                updated_at: now,
                started_at: Some(now),
                completed_at: None,
                error_code: None,
                error_message: None,
                pending_approval_id: None,
                pending_approval: None,
                review_decision: None,
                mission_brief: Some(AgentTaskMissionBriefRecord {
                    objective: "Stabilize runtime truth".to_string(),
                    done_definition: Some(vec![
                        "Mission Control consumes runtime-published summaries.".to_string(),
                    ]),
                    constraints: None,
                    risk_level: Some("high".to_string()),
                    required_capabilities: None,
                    max_subtasks: None,
                    preferred_backend_ids: Some(vec!["backend-a".to_string()]),
                    permission_summary: Some(AgentTaskPermissionSummaryRecord {
                        access_mode: Some("full-access".to_string()),
                        allow_network: None,
                        writable_roots: None,
                        tool_names: None,
                    }),
                    evaluation_plan: None,
                    scenario_profile: None,
                }),
                relaunch_context: None,
                auto_drive: None,
                backend_id: Some("backend-a".to_string()),
                acp_integration_id: None,
                acp_session_id: None,
                acp_config_options: None,
                acp_available_commands: None,
                preferred_backend_ids: Some(vec!["backend-a".to_string()]),
                placement_fallback_reason_code: None,
                resume_backend_id: None,
                placement_score_breakdown: None,
                root_task_id: None,
                parent_task_id: None,
                child_task_ids: None,
                distributed_status: Some("running".to_string()),
                steps: Vec::new(),
            },
            steps_input: Vec::new(),
            interrupt_requested: false,
            checkpoint_id: None,
            review_actionability: None,
            execution_graph: None,
            takeover_bundle: None,
            recovered: false,
            last_tool_signature: None,
            consecutive_tool_signature_count: 0,
            interrupt_waiter: Arc::new(Notify::new()),
            approval_waiter: Arc::new(Notify::new()),
        }
    }

    fn mock_backend() -> RuntimeBackendSummary {
        RuntimeBackendSummary {
            backend_id: "backend-a".to_string(),
            display_name: "Backend A".to_string(),
            capabilities: vec!["code".to_string()],
            max_concurrency: 4,
            cost_tier: "standard".to_string(),
            latency_class: "interactive".to_string(),
            rollout_state: "current".to_string(),
            status: "active".to_string(),
            healthy: true,
            health_score: 0.97,
            failures: 0,
            queue_depth: 0,
            running_tasks: 1,
            created_at: 1,
            updated_at: 1,
            last_heartbeat_at: 1,
            heartbeat_interval_ms: None,
            backend_class: None,
            specializations: None,
            policy: Some(default_runtime_backend_policy_profile()),
            connectivity: None,
            lease: None,
            readiness: None,
            backend_kind: Some("native".to_string()),
            integration_id: None,
            transport: Some("stdio".to_string()),
            origin: Some("runtime-native".to_string()),
            contract: None,
        }
    }

    #[test]
    fn build_agent_task_runtime_response_payload_includes_track_a_contract_baseline() {
        let runtime = mock_runtime();

        let payload = build_agent_task_runtime_response_payload(&runtime, None, None)
            .expect("task runtime payload");

        assert_eq!(
            payload["executionProfile"]["executionMode"],
            Value::String("distributed".to_string())
        );
        assert_eq!(
            payload["executionProfile"]["routingStrategy"],
            Value::String("workspace_default".to_string())
        );
        assert_eq!(
            payload["routing"]["backendId"],
            Value::String("backend-a".to_string())
        );
        assert_eq!(
            payload["routing"]["resolutionSource"],
            Value::String("explicit_preference".to_string())
        );
        assert_eq!(
            payload["routing"]["lifecycleState"],
            Value::String("resolved".to_string())
        );
        assert_eq!(
            payload["profileReadiness"]["health"],
            Value::String("attention".to_string())
        );
        assert_eq!(payload["profileReadiness"]["ready"], Value::Bool(false));
        assert_eq!(
            payload["checkpointState"]["lifecycleState"],
            Value::String("running".to_string())
        );
        assert_eq!(
            payload["checkpointState"]["traceId"],
            Value::String("agent-task:task-routing-baseline".to_string())
        );
        assert_eq!(
            payload["missionLinkage"]["recoveryPath"],
            Value::String("thread".to_string())
        );
        assert_eq!(
            payload["placement"]["resolvedBackendId"],
            Value::String("backend-a".to_string())
        );
        assert_eq!(
            payload["placement"]["requestedBackendIds"],
            json!(["backend-a"])
        );
        assert_eq!(
            payload["placement"]["lifecycleState"],
            Value::String("confirmed".to_string())
        );
        assert_eq!(
            payload["executionGraph"]["graphId"],
            Value::String("graph-task-routing-baseline".to_string())
        );
        assert_eq!(
            payload["executionGraph"]["nodes"][0]["kind"],
            Value::String("plan".to_string())
        );
        assert_eq!(
            payload["executionGraph"]["nodes"][0]["resolvedBackendId"],
            Value::String("backend-a".to_string())
        );
        assert_eq!(
            payload["executionGraph"]["nodes"][0]["preferredBackendIds"],
            json!(["backend-a"])
        );
        assert_eq!(
            payload["executionProfile"]["validationPresetId"],
            Value::String("standard".to_string())
        );
        assert_eq!(
            payload["executionGraph"]["nodes"][0]["placementLifecycleState"],
            Value::String("confirmed".to_string())
        );
        assert_eq!(
            payload["executionGraph"]["nodes"][0]["checkpoint"]["traceId"],
            Value::String("agent-task:task-routing-baseline".to_string())
        );
        assert_eq!(
            payload["reviewActionability"]["state"],
            Value::String("degraded".to_string())
        );
        assert_eq!(
            payload["executionGraph"]["nodes"][0]["reviewActionability"]["state"],
            Value::String("degraded".to_string())
        );
    }

    #[test]
    fn build_agent_task_runtime_response_payload_uses_backend_snapshot_when_available() {
        let runtime = mock_runtime();
        let backend = mock_backend();

        let payload = build_agent_task_runtime_response_payload(&runtime, Some(&backend), None)
            .expect("task runtime payload");

        assert_eq!(
            payload["routing"]["lifecycleState"],
            Value::String("confirmed".to_string())
        );
        assert_eq!(
            payload["routing"]["health"],
            Value::String("ready".to_string())
        );
        assert_eq!(
            payload["profileReadiness"]["health"],
            Value::String("ready".to_string())
        );
        assert_eq!(payload["profileReadiness"]["ready"], Value::Bool(true));
        assert_eq!(
            payload["executionGraph"]["nodes"][0]["placementLifecycleState"],
            Value::String("confirmed".to_string())
        );
    }

    #[test]
    fn build_agent_task_runtime_response_payload_includes_runtime_control_fields() {
        let runtime = mock_runtime();

        let payload = build_agent_task_runtime_response_payload(&runtime, None, None)
            .expect("task runtime payload");

        assert_eq!(
            payload["approvalState"]["status"],
            Value::String("not_required".to_string())
        );
        assert_eq!(
            payload["intervention"]["primaryAction"],
            Value::String("cancel".to_string())
        );
        assert_eq!(
            payload["operatorState"]["health"],
            Value::String("attention".to_string())
        );
        assert_eq!(
            payload["nextAction"]["action"],
            Value::String("cancel".to_string())
        );
        assert_eq!(
            payload["reviewActionability"]["degradedReasons"],
            json!(["run_not_review_ready", "validation_outcome_unknown"])
        );
        assert_eq!(
            payload["takeoverBundle"]["pathKind"],
            Value::String("handoff".to_string())
        );
        assert_eq!(
            payload["takeoverBundle"]["primaryAction"],
            Value::String("open_handoff".to_string())
        );
        assert_eq!(
            payload["takeoverBundle"]["target"]["kind"],
            Value::String("thread".to_string())
        );
        assert_eq!(
            payload["runSummary"]["governance"]["state"],
            Value::String("in_progress".to_string())
        );
        assert_eq!(
            payload["runSummary"]["placement"]["resolvedBackendId"],
            Value::String("backend-a".to_string())
        );
        assert_eq!(
            payload["runSummary"]["missionBrief"]["objective"],
            Value::String("Stabilize runtime truth".to_string())
        );
    }

    #[test]
    fn build_agent_task_runtime_response_payload_prefers_stored_execution_truth() {
        let mut runtime = mock_runtime();
        runtime.review_actionability = Some(json!({
            "state": "ready",
            "summary": "Stored review truth",
        }));
        runtime.takeover_bundle = Some(json!({
            "state": "recoverable",
            "primaryAction": "resume",
        }));
        runtime.execution_graph = Some(RuntimeExecutionGraphSummary {
            graph_id: "graph-task-routing-baseline".to_string(),
            nodes: vec![RuntimeExecutionNodeSummary {
                id: "graph-task-routing-baseline:root".to_string(),
                kind: "plan".to_string(),
                status: "running".to_string(),
                executor_kind: None,
                executor_session_id: None,
                preferred_backend_ids: vec!["backend-a".to_string()],
                resolved_backend_id: Some("backend-a".to_string()),
                placement_lifecycle_state: Some("resolved".to_string()),
                placement_resolution_source: Some("stored".to_string()),
                checkpoint: None,
                review_actionability: Some(json!({
                    "state": "ready",
                })),
            }],
            edges: Vec::new(),
        });

        let payload =
            build_agent_task_runtime_response_payload(&runtime, Some(&mock_backend()), None)
                .expect("task runtime payload");

        assert_eq!(
            payload["reviewActionability"]["summary"],
            json!("Stored review truth")
        );
        assert_eq!(payload["takeoverBundle"]["primaryAction"], json!("resume"));
        assert_eq!(
            payload["executionGraph"]["nodes"][0]["placementResolutionSource"],
            json!("stored")
        );
    }

    #[test]
    fn build_agent_task_runtime_response_payload_includes_review_decision_for_terminal_runs() {
        let mut runtime = mock_runtime();
        runtime.summary.status = AgentTaskStatus::Completed.as_str().to_string();
        runtime.summary.completed_at = Some(now_ms());
        runtime.summary.auto_drive = Some(AgentTaskAutoDriveState {
            enabled: Some(true),
            destination: AgentTaskAutoDriveDestination {
                title: "Ship publish handoff".to_string(),
                desired_end_state: vec!["Prepare review branch".to_string()],
                done_definition: None,
                hard_boundaries: None,
                route_preference: None,
            },
            budget: None,
            risk_policy: None,
            context_policy: None,
            decision_policy: None,
            scenario_profile: None,
            decision_trace: None,
            outcome_feedback: None,
            autonomy_state: None,
            navigation: None,
            recovery: None,
            stop: Some(AgentTaskAutoDriveStopState {
                reason: "completed".to_string(),
                summary: Some("AutoDrive prepared publish handoff.".to_string()),
                at: Some(12),
            }),
        });

        let payload =
            build_agent_task_runtime_response_payload(&runtime, Some(&mock_backend()), None)
                .expect("task runtime payload");

        assert_eq!(
            payload["reviewDecision"]["status"],
            Value::String("pending".to_string())
        );
        assert_eq!(
            payload["reviewActionability"]["actions"][0]["action"],
            Value::String("accept_result".to_string())
        );
        assert_eq!(
            payload["reviewActionability"]["actions"][0]["enabled"],
            Value::Bool(true)
        );
        assert_eq!(
            payload["missionLinkage"]["recoveryPath"],
            Value::String("thread".to_string())
        );
        assert_eq!(
            payload["reviewDecision"]["reviewPackId"],
            Value::String("review-pack:task-routing-baseline".to_string())
        );
        assert_eq!(
            payload["reviewPackId"],
            Value::String("review-pack:task-routing-baseline".to_string())
        );
        assert_eq!(
            payload["nextAction"]["action"],
            Value::String("review".to_string())
        );
        assert_eq!(
            payload["publishHandoff"]["jsonPath"],
            Value::String(".hugecode/runs/task-routing-baseline/publish/handoff.json".to_string())
        );
        assert_eq!(
            payload["publishHandoff"]["summary"],
            Value::String("AutoDrive prepared publish handoff.".to_string())
        );
        assert_eq!(
            payload["runSummary"]["reviewPackId"],
            Value::String("review-pack:task-routing-baseline".to_string())
        );
        assert_eq!(
            payload["reviewPackSummary"]["id"],
            Value::String("review-pack:task-routing-baseline".to_string())
        );
        assert_eq!(
            payload["reviewPackSummary"]["governance"]["state"],
            Value::String("awaiting_review".to_string())
        );
    }

    #[test]
    fn build_agent_task_runtime_response_payload_recovers_review_linkage_without_thread_id() {
        let mut runtime = mock_runtime();
        runtime.summary.thread_id = None;
        runtime.summary.status = AgentTaskStatus::Completed.as_str().to_string();
        runtime.summary.completed_at = Some(now_ms());
        runtime.checkpoint_id = Some("checkpoint-threadless".to_string());

        let payload =
            build_agent_task_runtime_response_payload(&runtime, Some(&mock_backend()), None)
                .expect("task runtime payload");

        assert_eq!(
            payload["missionLinkage"]["recoveryPath"],
            Value::String("run".to_string())
        );
        assert_eq!(
            payload["missionLinkage"]["navigationTarget"]["kind"],
            Value::String("run".to_string())
        );
        assert_eq!(
            payload["reviewActionability"]["degradedReasons"],
            json!([
                "validation_outcome_unknown",
                "thread_link_recovered_via_run"
            ])
        );
    }

    #[test]
    fn build_agent_task_runtime_response_payload_enriches_publish_handoff_from_workspace_metadata()
    {
        let mut runtime = mock_runtime();
        runtime.summary.status = AgentTaskStatus::Completed.as_str().to_string();
        runtime.summary.completed_at = Some(now_ms());
        runtime.summary.auto_drive = Some(AgentTaskAutoDriveState {
            enabled: Some(true),
            destination: AgentTaskAutoDriveDestination {
                title: "Ship publish handoff".to_string(),
                desired_end_state: vec!["Prepare review branch".to_string()],
                done_definition: None,
                hard_boundaries: None,
                route_preference: None,
            },
            budget: None,
            risk_policy: None,
            context_policy: None,
            decision_policy: None,
            scenario_profile: None,
            decision_trace: None,
            outcome_feedback: None,
            autonomy_state: None,
            navigation: None,
            recovery: None,
            stop: Some(AgentTaskAutoDriveStopState {
                reason: "completed".to_string(),
                summary: Some("AutoDrive prepared publish handoff.".to_string()),
                at: Some(12),
            }),
        });

        let temp = tempfile::tempdir().expect("tempdir");
        let handoff_dir = temp
            .path()
            .join(".hugecode")
            .join("runs")
            .join("task-routing-baseline")
            .join("publish");
        std::fs::create_dir_all(&handoff_dir).expect("create handoff dir");
        std::fs::write(
            handoff_dir.join("handoff.json"),
            serde_json::to_vec(&json!({
                "publish": {
                    "branchName": "autodrive/runtime-truth-task-1",
                    "commitMessage": "Ship runtime truth"
                },
                "reviewDraft": {
                    "title": "Ship runtime truth"
                },
                "validation": {
                    "summary": "pnpm validate passed"
                }
            }))
            .expect("serialize handoff"),
        )
        .expect("write handoff");

        let payload = build_agent_task_runtime_response_payload(
            &runtime,
            Some(&mock_backend()),
            temp.path().to_str(),
        )
        .expect("task runtime payload");

        assert_eq!(
            payload["publishHandoff"]["branchName"],
            Value::String("autodrive/runtime-truth-task-1".to_string())
        );
        assert_eq!(
            payload["publishHandoff"]["reviewTitle"],
            Value::String("Ship runtime truth".to_string())
        );
    }
}
