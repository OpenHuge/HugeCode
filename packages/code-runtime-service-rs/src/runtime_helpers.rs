use super::*;

const CODE_RUNTIME_SERVICE_TERMINALIZATION_CAS_ENABLED_ENV: &str =
    "CODE_RUNTIME_SERVICE_TERMINALIZATION_CAS_ENABLED";

pub(super) fn terminalization_cas_enabled() -> bool {
    !matches!(
        std::env::var(CODE_RUNTIME_SERVICE_TERMINALIZATION_CAS_ENABLED_ENV)
            .ok()
            .map(|value| value.trim().to_ascii_lowercase())
            .as_deref(),
        Some("0" | "false" | "no" | "off")
    )
}

pub(super) fn try_finalize_agent_task_runtime<F>(task: &mut AgentTaskRuntime, finalize: F) -> bool
where
    F: FnOnce(&mut AgentTaskRuntime),
{
    if terminalization_cas_enabled() && is_agent_task_terminal_status(task.summary.status.as_str())
    {
        return false;
    }
    finalize(task);
    true
}

pub(super) async fn increment_terminalization_cas_noop_metric(
    ctx: &AppContext,
    task_id: &str,
    source: &str,
) {
    if !crate::runtime_tool_safety_counters::record_runtime_tool_safety_counter(
        ctx,
        runtime_tool_metrics::RuntimeToolSafetyCounter::TerminalizationCasNoop,
        "increment terminalization CAS no-op metric failed",
    )
    .await
    {
        return;
    }
    info!(
        task_id,
        source, "terminalization CAS prevented duplicate task finalization"
    );
}

pub(super) fn parse_agent_task_interrupt_request(
    params: &Value,
) -> Result<AgentTaskInterruptRequest, RpcError> {
    let mut parsed: AgentTaskInterruptRequest =
        serde_json::from_value(params.clone()).map_err(|error| {
            RpcError::invalid_params(format!("Invalid agent task interrupt payload: {error}"))
        })?;
    let task_id = parsed.task_id.trim();
    if task_id.is_empty() {
        return Err(RpcError::invalid_params("taskId is required."));
    }
    parsed.task_id = task_id.to_string();
    parsed.reason = trim_optional_string(parsed.reason);
    Ok(parsed)
}

pub(super) fn parse_agent_task_intervention_request(
    params: &Value,
) -> Result<AgentTaskInterventionRequest, RpcError> {
    let mut parsed: AgentTaskInterventionRequest =
        serde_json::from_value(params.clone()).map_err(|error| {
            RpcError::invalid_params(format!("Invalid agent task intervention payload: {error}"))
        })?;
    let task_id = parsed.task_id.trim();
    if task_id.is_empty() {
        return Err(RpcError::invalid_params("taskId is required."));
    }
    parsed.task_id = task_id.to_string();
    parsed.reason = trim_optional_string(parsed.reason);
    parsed.instruction_patch = trim_optional_string(parsed.instruction_patch);
    parsed.execution_profile_id = trim_optional_string(parsed.execution_profile_id);
    parsed.preferred_backend_ids = parsed.preferred_backend_ids.map(|values| {
        values
            .into_iter()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .collect::<Vec<_>>()
    });
    if let Some(context) = parsed.relaunch_context.as_mut() {
        context.source_task_id = trim_optional_string(context.source_task_id.clone());
        context.source_run_id = trim_optional_string(context.source_run_id.clone());
        context.source_review_pack_id = trim_optional_string(context.source_review_pack_id.clone());
        context.summary = trim_optional_string(context.summary.clone());
        context.failure_class = trim_optional_string(context.failure_class.clone());
        context.recommended_actions = normalize_string_list(context.recommended_actions.clone());
    }
    Ok(parsed)
}

fn normalize_string_list(value: Option<Vec<String>>) -> Option<Vec<String>> {
    let values = value
        .unwrap_or_default()
        .into_iter()
        .map(|entry| entry.trim().to_string())
        .filter(|entry| !entry.is_empty())
        .collect::<Vec<_>>();
    (!values.is_empty()).then_some(values)
}

fn trim_str_to_option(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(ToOwned::to_owned)
}

fn normalize_permission_summary(
    value: Option<AgentTaskPermissionSummary>,
) -> Option<AgentTaskPermissionSummaryRecord> {
    let summary = value?;
    let access_mode = trim_optional_string(summary.access_mode);
    let writable_roots = normalize_string_list(summary.writable_roots);
    let tool_names = normalize_string_list(summary.tool_names);
    if access_mode.is_none()
        && summary.allow_network.is_none()
        && writable_roots.is_none()
        && tool_names.is_none()
    {
        return None;
    }
    Some(AgentTaskPermissionSummaryRecord {
        access_mode,
        allow_network: summary.allow_network,
        writable_roots,
        tool_names,
    })
}

fn normalize_task_source_repo_context(
    value: Option<AgentTaskSourceRepoContext>,
) -> Option<AgentTaskSourceRepoContext> {
    let repo = value?;
    let normalized = AgentTaskSourceRepoContext {
        owner: trim_optional_string(repo.owner),
        name: trim_optional_string(repo.name),
        full_name: trim_optional_string(repo.full_name),
        remote_url: trim_optional_string(repo.remote_url),
    };
    if normalized.owner.is_none()
        && normalized.name.is_none()
        && normalized.full_name.is_none()
        && normalized.remote_url.is_none()
    {
        return None;
    }
    Some(normalized)
}

fn infer_task_source_reference(
    kind: &str,
    issue_number: Option<u64>,
    pull_request_number: Option<u64>,
) -> Option<String> {
    match kind {
        "github_issue" => issue_number.map(|number| format!("#{number}")),
        "github_pr_followup" => pull_request_number.map(|number| format!("#{number}")),
        _ => None,
    }
}

fn build_task_source_labels(
    kind: &str,
    reference: Option<&str>,
    repo_full_name: Option<&str>,
) -> Option<(String, String)> {
    let reference = trim_str_to_option(reference);
    let repo_full_name = trim_str_to_option(repo_full_name);
    let (base_label, short_label) = match kind {
        "manual" => ("Manual launch".to_string(), "Manual".to_string()),
        "manual_thread" => ("Manual thread".to_string(), "Manual".to_string()),
        "autodrive" => (
            "AutoDrive Mission Control".to_string(),
            "AutoDrive".to_string(),
        ),
        "github_issue" => (
            match (reference.as_deref(), repo_full_name.as_deref()) {
                (Some(reference), Some(repo)) => format!("GitHub issue {reference} · {repo}"),
                (Some(reference), None) => format!("GitHub issue {reference}"),
                (None, Some(repo)) => format!("GitHub issue · {repo}"),
                (None, None) => "GitHub issue".to_string(),
            },
            reference
                .as_ref()
                .map(|value| format!("Issue {value}"))
                .unwrap_or_else(|| "GitHub issue".to_string()),
        ),
        "github_pr_followup" => (
            match (reference.as_deref(), repo_full_name.as_deref()) {
                (Some(reference), Some(repo)) => format!("PR follow-up {reference} · {repo}"),
                (Some(reference), None) => format!("PR follow-up {reference}"),
                (None, Some(repo)) => format!("PR follow-up · {repo}"),
                (None, None) => "PR follow-up".to_string(),
            },
            reference
                .as_ref()
                .map(|value| format!("PR {value}"))
                .unwrap_or_else(|| "PR follow-up".to_string()),
        ),
        "github_discussion" => (
            match (reference.as_deref(), repo_full_name.as_deref()) {
                (Some(reference), Some(repo)) => format!("GitHub discussion {reference} · {repo}"),
                (Some(reference), None) => format!("GitHub discussion {reference}"),
                (None, Some(repo)) => format!("GitHub discussion · {repo}"),
                (None, None) => "GitHub discussion".to_string(),
            },
            reference
                .as_ref()
                .map(|value| format!("Discussion {value}"))
                .unwrap_or_else(|| "GitHub discussion".to_string()),
        ),
        "note" => ("Operator note".to_string(), "Note".to_string()),
        "customer_feedback" => (
            "Customer feedback".to_string(),
            "Feedback".to_string(),
        ),
        "doc" => ("Document brief".to_string(), "Doc".to_string()),
        "call_summary" => ("Call summary".to_string(), "Call".to_string()),
        "external_ref" => (
            "External reference".to_string(),
            "Reference".to_string(),
        ),
        "schedule" => ("Scheduled task".to_string(), "Schedule".to_string()),
        "external_runtime" => ("External runtime".to_string(), "External".to_string()),
        _ => return None,
    };
    Some((base_label, short_label))
}

fn normalize_agent_task_source(
    value: Option<AgentTaskSourceSummary>,
    workspace_id: Option<&str>,
    title: Option<&str>,
) -> Option<AgentTaskSourceSummary> {
    let source = value.unwrap_or(AgentTaskSourceSummary {
        kind: "manual_thread".to_string(),
        label: None,
        short_label: None,
        title: None,
        reference: None,
        url: None,
        issue_number: None,
        pull_request_number: None,
        repo: None,
        workspace_id: None,
        workspace_root: None,
        external_id: None,
        canonical_url: None,
        thread_id: None,
        request_id: None,
        source_task_id: None,
        source_run_id: None,
    });
    let label = trim_optional_string(source.label);
    let short_label = trim_optional_string(source.short_label);
    let title = trim_optional_string(source.title).or_else(|| trim_str_to_option(title));
    let external_id = trim_optional_string(source.external_id);
    let canonical_url = trim_optional_string(source.canonical_url);
    let thread_id = trim_optional_string(source.thread_id);
    let request_id = trim_optional_string(source.request_id);
    let source_task_id = trim_optional_string(source.source_task_id);
    let source_run_id = trim_optional_string(source.source_run_id);
    let kind = canonicalize_agent_task_source_kind(source.kind.as_str()).or_else(|| {
        if label.is_some()
            || title.is_some()
            || external_id.is_some()
            || canonical_url.is_some()
            || thread_id.is_some()
            || request_id.is_some()
            || source_task_id.is_some()
            || source_run_id.is_some()
        {
            Some("external_runtime")
        } else {
            None
        }
    })?;
    let normalized_repo = normalize_task_source_repo_context(source.repo);
    let reference = trim_optional_string(source.reference).or_else(|| {
        infer_task_source_reference(kind, source.issue_number, source.pull_request_number)
    });
    let url = trim_optional_string(source.url).or_else(|| canonical_url.clone());
    let workspace_id =
        trim_optional_string(source.workspace_id).or_else(|| trim_str_to_option(workspace_id));
    let workspace_root = trim_optional_string(source.workspace_root);
    let repo_full_name = normalized_repo
        .as_ref()
        .and_then(|repo| repo.full_name.as_deref());
    let inferred_labels = build_task_source_labels(kind, reference.as_deref(), repo_full_name);
    Some(AgentTaskSourceSummary {
        kind: kind.to_string(),
        label: label.or_else(|| inferred_labels.as_ref().map(|(value, _)| value.clone())),
        short_label: short_label
            .or_else(|| inferred_labels.as_ref().map(|(_, value)| value.clone())),
        title,
        reference,
        url,
        issue_number: source.issue_number,
        pull_request_number: source.pull_request_number,
        repo: normalized_repo,
        workspace_id,
        workspace_root,
        external_id,
        canonical_url,
        thread_id,
        request_id,
        source_task_id,
        source_run_id,
    })
}

pub(super) fn normalize_agent_task_mission_brief(
    value: Option<AgentTaskMissionBrief>,
) -> Option<AgentTaskMissionBriefRecord> {
    let brief = value?;
    let objective = brief.objective.trim().to_string();
    if objective.is_empty() {
        return None;
    }
    Some(AgentTaskMissionBriefRecord {
        objective,
        done_definition: normalize_string_list(brief.done_definition),
        constraints: normalize_string_list(brief.constraints),
        risk_level: trim_optional_string(brief.risk_level),
        required_capabilities: normalize_string_list(brief.required_capabilities),
        max_subtasks: brief.max_subtasks,
        preferred_backend_ids: normalize_string_list(brief.preferred_backend_ids),
        permission_summary: normalize_permission_summary(brief.permission_summary),
        evaluation_plan: brief.evaluation_plan.map(normalize_mission_evaluation_plan),
        scenario_profile: brief
            .scenario_profile
            .map(normalize_mission_scenario_profile),
        plan_version: trim_optional_string(brief.plan_version),
        plan_summary: trim_optional_string(brief.plan_summary),
        current_milestone_id: trim_optional_string(brief.current_milestone_id),
        estimated_duration_minutes: brief.estimated_duration_minutes,
        estimated_worker_runs: brief.estimated_worker_runs,
        parallelism_hint: trim_optional_string(brief.parallelism_hint),
        clarification_questions: normalize_string_list(brief.clarification_questions),
        milestones: brief.milestones.map(normalize_mission_plan_milestones),
        validation_lanes: brief
            .validation_lanes
            .map(normalize_mission_validation_lanes),
        skill_plan: brief.skill_plan.map(normalize_mission_skill_plan_items),
    })
}

fn normalize_mission_evaluation_plan(
    plan: AgentTaskMissionEvaluationPlan,
) -> AgentTaskMissionEvaluationPlanRecord {
    AgentTaskMissionEvaluationPlanRecord {
        representative_commands: normalize_string_list(plan.representative_commands),
        component_commands: normalize_string_list(plan.component_commands),
        end_to_end_commands: normalize_string_list(plan.end_to_end_commands),
        sample_paths: normalize_string_list(plan.sample_paths),
        held_out_guidance: normalize_string_list(plan.held_out_guidance),
        source_signals: normalize_string_list(plan.source_signals),
    }
}

fn normalize_mission_scenario_profile(
    profile: AgentTaskMissionScenarioProfile,
) -> AgentTaskMissionScenarioProfileRecord {
    AgentTaskMissionScenarioProfileRecord {
        authority_scope: trim_optional_string(profile.authority_scope),
        authority_sources: normalize_string_list(profile.authority_sources),
        representative_commands: normalize_string_list(profile.representative_commands),
        component_commands: normalize_string_list(profile.component_commands),
        end_to_end_commands: normalize_string_list(profile.end_to_end_commands),
        sample_paths: normalize_string_list(profile.sample_paths),
        held_out_guidance: normalize_string_list(profile.held_out_guidance),
        source_signals: normalize_string_list(profile.source_signals),
        scenario_keys: normalize_string_list(profile.scenario_keys),
        safe_background: profile.safe_background,
    }
}

fn normalize_mission_plan_milestones(
    milestones: Vec<AgentTaskMissionPlanMilestone>,
) -> Vec<AgentTaskMissionPlanMilestoneRecord> {
    milestones
        .into_iter()
        .filter_map(|milestone| {
            let id = milestone.id.trim().to_string();
            let label = milestone.label.trim().to_string();
            let summary = milestone.summary.trim().to_string();
            if id.is_empty() || label.is_empty() || summary.is_empty() {
                return None;
            }
            Some(AgentTaskMissionPlanMilestoneRecord {
                id,
                label,
                summary,
                status: trim_optional_string(milestone.status),
                node_ids: normalize_string_list(milestone.node_ids),
                validation_lane_ids: normalize_string_list(milestone.validation_lane_ids),
                acceptance_criteria: normalize_string_list(milestone.acceptance_criteria),
            })
        })
        .collect()
}

fn normalize_mission_validation_lanes(
    lanes: Vec<AgentTaskMissionValidationLane>,
) -> Vec<AgentTaskMissionValidationLaneRecord> {
    lanes
        .into_iter()
        .filter_map(|lane| {
            let id = lane.id.trim().to_string();
            let label = lane.label.trim().to_string();
            let summary = lane.summary.trim().to_string();
            let trigger = lane.trigger.trim().to_string();
            if id.is_empty() || label.is_empty() || summary.is_empty() || trigger.is_empty() {
                return None;
            }
            Some(AgentTaskMissionValidationLaneRecord {
                id,
                label,
                summary,
                trigger,
                commands: normalize_string_list(lane.commands),
            })
        })
        .collect()
}

fn normalize_mission_skill_plan_items(
    items: Vec<AgentTaskMissionSkillPlanItem>,
) -> Vec<AgentTaskMissionSkillPlanItemRecord> {
    items
        .into_iter()
        .filter_map(|item| {
            let skill_id = item.skill_id.trim().to_string();
            let label = item.label.trim().to_string();
            let state = item.state.trim().to_string();
            if skill_id.is_empty() || label.is_empty() || state.is_empty() {
                return None;
            }
            Some(AgentTaskMissionSkillPlanItemRecord {
                skill_id,
                label,
                state,
                summary: trim_optional_string(item.summary),
            })
        })
        .collect()
}

pub(super) fn normalize_agent_task_relaunch_context(
    value: Option<AgentTaskRelaunchContext>,
) -> Option<AgentTaskRelaunchContextRecord> {
    let context = value?;
    let normalized = AgentTaskRelaunchContextRecord {
        source_task_id: trim_optional_string(context.source_task_id),
        source_run_id: trim_optional_string(context.source_run_id),
        source_review_pack_id: trim_optional_string(context.source_review_pack_id),
        source_plan_version: trim_optional_string(context.source_plan_version),
        summary: trim_optional_string(context.summary),
        failure_class: trim_optional_string(context.failure_class),
        recommended_actions: normalize_string_list(context.recommended_actions),
        plan_change_summary: trim_optional_string(context.plan_change_summary),
    };
    if normalized.source_task_id.is_none()
        && normalized.source_run_id.is_none()
        && normalized.source_review_pack_id.is_none()
        && normalized.source_plan_version.is_none()
        && normalized.summary.is_none()
        && normalized.failure_class.is_none()
        && normalized.recommended_actions.is_none()
        && normalized.plan_change_summary.is_none()
    {
        return None;
    }
    Some(normalized)
}

fn canonicalize_agent_task_source_kind(value: &str) -> Option<&'static str> {
    let normalized = value.trim().to_ascii_lowercase();
    match normalized.as_str() {
        "" => None,
        "manual" => Some("manual"),
        "manual_thread" => Some("manual_thread"),
        "autodrive" => Some("autodrive"),
        "github_issue" => Some("github_issue"),
        "github_pr_followup" => Some("github_pr_followup"),
        "github_discussion" => Some("github_discussion"),
        "note" => Some("note"),
        "customer_feedback" => Some("customer_feedback"),
        "doc" => Some("doc"),
        "call_summary" => Some("call_summary"),
        "external_ref" => Some("external_ref"),
        "schedule" => Some("schedule"),
        "external_runtime" => Some("external_runtime"),
        _ => Some("external_runtime"),
    }
}

pub(super) fn normalize_agent_task_source_summary(
    value: Option<AgentTaskSourceSummary>,
) -> Option<AgentTaskSourceSummary> {
    normalize_agent_task_source(value, None, None)
}

pub(super) fn derive_agent_task_source_summary(
    value: Option<AgentTaskSourceSummary>,
    workspace_id: Option<&str>,
    thread_id: Option<&str>,
    request_id: Option<&str>,
    task_id: &str,
    title: Option<&str>,
) -> Option<AgentTaskSourceSummary> {
    let normalized_title = trim_str_to_option(title);
    if let Some(source) = normalize_agent_task_source(value, workspace_id, title) {
        return Some(AgentTaskSourceSummary {
            kind: source.kind,
            label: source.label,
            short_label: source.short_label,
            title: source.title.or_else(|| normalized_title.clone()),
            reference: source.reference,
            url: source.url.or_else(|| source.canonical_url.clone()),
            issue_number: source.issue_number,
            pull_request_number: source.pull_request_number,
            repo: source.repo,
            workspace_id: source
                .workspace_id
                .or_else(|| trim_str_to_option(workspace_id)),
            workspace_root: source.workspace_root,
            external_id: source.external_id,
            canonical_url: source.canonical_url,
            thread_id: source.thread_id.or_else(|| trim_str_to_option(thread_id)),
            request_id: source.request_id.or_else(|| trim_str_to_option(request_id)),
            source_task_id: source.source_task_id,
            source_run_id: source.source_run_id.or_else(|| Some(task_id.to_string())),
        });
    }

    if let Some(thread_id) = trim_str_to_option(thread_id) {
        return Some(AgentTaskSourceSummary {
            kind: "manual_thread".to_string(),
            label: Some("Manual thread".to_string()),
            short_label: Some("Manual".to_string()),
            title: normalized_title,
            reference: None,
            url: None,
            issue_number: None,
            pull_request_number: None,
            repo: None,
            workspace_id: trim_str_to_option(workspace_id),
            workspace_root: None,
            external_id: None,
            canonical_url: None,
            thread_id: Some(thread_id),
            request_id: trim_str_to_option(request_id),
            source_task_id: None,
            source_run_id: Some(task_id.to_string()),
        });
    }

    if normalized_title.is_some() || trim_str_to_option(request_id).is_some() {
        return Some(AgentTaskSourceSummary {
            kind: "external_runtime".to_string(),
            label: Some("External runtime".to_string()),
            short_label: Some("External".to_string()),
            title: normalized_title,
            reference: None,
            url: None,
            issue_number: None,
            pull_request_number: None,
            repo: None,
            workspace_id: trim_str_to_option(workspace_id),
            workspace_root: None,
            external_id: None,
            canonical_url: None,
            thread_id: None,
            request_id: trim_str_to_option(request_id),
            source_task_id: Some(task_id.to_string()),
            source_run_id: Some(task_id.to_string()),
        });
    }

    None
}

pub(super) fn parse_agent_task_status_request(
    params: &Value,
) -> Result<AgentTaskStatusRequest, RpcError> {
    let mut parsed: AgentTaskStatusRequest =
        serde_json::from_value(params.clone()).map_err(|error| {
            RpcError::invalid_params(format!("Invalid agent task status payload: {error}"))
        })?;
    let task_id = parsed.task_id.trim();
    if task_id.is_empty() {
        return Err(RpcError::invalid_params("taskId is required."));
    }
    parsed.task_id = task_id.to_string();
    Ok(parsed)
}

pub(super) fn parse_agent_task_list_request(
    params: &Value,
) -> Result<AgentTaskListRequest, RpcError> {
    let mut parsed: AgentTaskListRequest =
        serde_json::from_value(params.clone()).map_err(|error| {
            RpcError::invalid_params(format!("Invalid agent tasks list payload: {error}"))
        })?;
    parsed.workspace_id = trim_optional_string(parsed.workspace_id);
    Ok(parsed)
}

pub(super) fn parse_agent_approval_decision_request(
    params: &Value,
) -> Result<AgentApprovalDecisionRequest, RpcError> {
    let mut parsed: AgentApprovalDecisionRequest =
        serde_json::from_value(params.clone()).map_err(|error| {
            RpcError::invalid_params(format!("Invalid approval decision payload: {error}"))
        })?;
    let approval_id = parsed.approval_id.trim();
    if approval_id.is_empty() {
        return Err(RpcError::invalid_params("approvalId is required."));
    }
    parsed.approval_id = approval_id.to_string();
    parsed.reason = trim_optional_string(parsed.reason);
    Ok(parsed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_agent_task_interrupt_request_trims_task_id_and_reason() {
        let parsed = parse_agent_task_interrupt_request(&json!({
            "taskId": "  task-123  ",
            "reason": "   stop now   "
        }))
        .expect("parse interrupt request");

        assert_eq!(parsed.task_id, "task-123");
        assert_eq!(parsed.reason.as_deref(), Some("stop now"));
    }

    #[test]
    fn parse_agent_approval_decision_request_trims_approval_id_and_reason() {
        let parsed = parse_agent_approval_decision_request(&json!({
            "approvalId": "  approval-1  ",
            "decision": "approved",
            "reason": "   operator approved   "
        }))
        .expect("parse approval decision request");

        assert_eq!(parsed.approval_id, "approval-1");
        assert_eq!(parsed.reason.as_deref(), Some("operator approved"));
    }

    #[test]
    fn parse_agent_task_intervention_request_trims_fields_and_aliases() {
        let parsed = parse_agent_task_intervention_request(&json!({
            "task_id": "  task-123  ",
            "action": "switch_profile_and_retry",
            "reason": "  reroute  ",
            "instruction_patch": "  retry with validation  ",
            "execution_profile_id": "  balanced-delegate  ",
            "preferred_backend_ids": ["  backend-a  ", "", "backend-b"],
            "relaunch_context": {
                "source_task_id": "  task-001  ",
                "source_run_id": "  run-001  ",
                "source_review_pack_id": "  review-pack:run-001  ",
                "summary": "  Retry from runtime snapshot  ",
                "failure_class": "  validation_failed  ",
                "recommended_actions": [" retry ", "", "switch_profile_and_retry"]
            }
        }))
        .expect("parse intervention request");

        assert_eq!(parsed.task_id, "task-123");
        assert_eq!(parsed.reason.as_deref(), Some("reroute"));
        assert_eq!(
            parsed.instruction_patch.as_deref(),
            Some("retry with validation")
        );
        assert_eq!(
            parsed.execution_profile_id.as_deref(),
            Some("balanced-delegate")
        );
        assert_eq!(
            parsed.preferred_backend_ids,
            Some(vec!["backend-a".to_string(), "backend-b".to_string()])
        );
        let relaunch_context = parsed
            .relaunch_context
            .expect("relaunch context should be parsed");
        assert_eq!(relaunch_context.source_task_id.as_deref(), Some("task-001"));
        assert_eq!(relaunch_context.source_run_id.as_deref(), Some("run-001"));
        assert_eq!(
            relaunch_context.source_review_pack_id.as_deref(),
            Some("review-pack:run-001")
        );
        assert_eq!(
            relaunch_context.summary.as_deref(),
            Some("Retry from runtime snapshot")
        );
        assert_eq!(
            relaunch_context.failure_class.as_deref(),
            Some("validation_failed")
        );
        assert_eq!(
            relaunch_context.recommended_actions,
            Some(vec![
                "retry".to_string(),
                "switch_profile_and_retry".to_string()
            ])
        );
        assert_eq!(
            parsed.action.as_str(),
            AgentTaskInterventionAction::SwitchProfileAndRetry.as_str()
        );
    }

    #[test]
    fn normalize_agent_task_source_summary_trims_fields_and_downgrades_unknown_kind() {
        let normalized = normalize_agent_task_source_summary(Some(AgentTaskSourceSummary {
            kind: "  future_adapter  ".to_string(),
            label: Some("  External planner  ".to_string()),
            short_label: Some("  Planner  ".to_string()),
            title: Some("  Queue follow-up task  ".to_string()),
            reference: None,
            url: Some("  https://example.com/tasks/42  ".to_string()),
            issue_number: None,
            pull_request_number: None,
            repo: None,
            workspace_id: Some("  workspace-42  ".to_string()),
            workspace_root: Some("  C:/repo  ".to_string()),
            external_id: Some("  planner-42  ".to_string()),
            canonical_url: Some("  https://example.com/tasks/42  ".to_string()),
            thread_id: Some("  thread-42  ".to_string()),
            request_id: Some("  request-42  ".to_string()),
            source_task_id: Some("  source-task-42  ".to_string()),
            source_run_id: Some("  source-run-42  ".to_string()),
        }))
        .expect("task source should normalize");

        assert_eq!(normalized.kind, "external_runtime");
        assert_eq!(normalized.label.as_deref(), Some("External planner"));
        assert_eq!(normalized.short_label.as_deref(), Some("Planner"));
        assert_eq!(normalized.title.as_deref(), Some("Queue follow-up task"));
        assert_eq!(
            normalized.url.as_deref(),
            Some("https://example.com/tasks/42")
        );
        assert_eq!(normalized.workspace_id.as_deref(), Some("workspace-42"));
        assert_eq!(normalized.workspace_root.as_deref(), Some("C:/repo"));
        assert_eq!(normalized.external_id.as_deref(), Some("planner-42"));
        assert_eq!(
            normalized.canonical_url.as_deref(),
            Some("https://example.com/tasks/42")
        );
        assert_eq!(normalized.thread_id.as_deref(), Some("thread-42"));
        assert_eq!(normalized.request_id.as_deref(), Some("request-42"));
        assert_eq!(normalized.source_task_id.as_deref(), Some("source-task-42"));
        assert_eq!(normalized.source_run_id.as_deref(), Some("source-run-42"));
    }

    #[test]
    fn normalize_agent_task_source_defaults_to_manual_thread_when_missing() {
        let source =
            normalize_agent_task_source(None, Some("workspace-1"), Some("Stabilize runtime"))
                .expect("manual source should be synthesized");

        assert_eq!(source.kind, "manual_thread");
        assert_eq!(source.short_label.as_deref(), Some("Manual"));
        assert_eq!(source.label.as_deref(), Some("Manual thread"));
        assert_eq!(source.workspace_id.as_deref(), Some("workspace-1"));
        assert_eq!(source.title.as_deref(), Some("Stabilize runtime"));
    }

    #[test]
    fn normalize_agent_task_source_preserves_autodrive_kind_and_labels() {
        let source = normalize_agent_task_source_summary(Some(AgentTaskSourceSummary {
            kind: "autodrive".to_string(),
            label: None,
            short_label: None,
            title: Some("  AutoDrive mission  ".to_string()),
            reference: None,
            url: None,
            issue_number: None,
            pull_request_number: None,
            repo: None,
            workspace_id: Some("workspace-1".to_string()),
            workspace_root: Some("/repo".to_string()),
            external_id: Some("autodrive:workspace-1".to_string()),
            canonical_url: None,
            thread_id: None,
            request_id: None,
            source_task_id: None,
            source_run_id: None,
        }))
        .expect("autodrive source should normalize");

        assert_eq!(source.kind, "autodrive");
        assert_eq!(source.label.as_deref(), Some("AutoDrive Mission Control"));
        assert_eq!(source.short_label.as_deref(), Some("AutoDrive"));
        assert_eq!(source.external_id.as_deref(), Some("autodrive:workspace-1"));
    }

    #[test]
    fn normalize_agent_task_source_trims_github_issue_metadata() {
        let source = normalize_agent_task_source(
            Some(AgentTaskSourceSummary {
                kind: "github_issue".to_string(),
                label: None,
                short_label: None,
                title: Some("  Fix source-linked lineage  ".to_string()),
                reference: None,
                url: Some("  https://github.com/ku0/hypecode/issues/42  ".to_string()),
                issue_number: Some(42),
                pull_request_number: None,
                repo: Some(AgentTaskSourceRepoContext {
                    owner: Some(" ku0 ".to_string()),
                    name: Some(" hypecode ".to_string()),
                    full_name: Some(" ku0/hypecode ".to_string()),
                    remote_url: Some(" https://github.com/ku0/hypecode.git ".to_string()),
                }),
                workspace_id: None,
                workspace_root: Some("  C:/workspace  ".to_string()),
                external_id: None,
                canonical_url: None,
                thread_id: None,
                request_id: None,
                source_task_id: None,
                source_run_id: None,
            }),
            Some("workspace-1"),
            None,
        )
        .expect("github issue source should normalize");

        assert_eq!(source.reference.as_deref(), Some("#42"));
        assert_eq!(source.short_label.as_deref(), Some("Issue #42"));
        assert_eq!(
            source.label.as_deref(),
            Some("GitHub issue #42 · ku0/hypecode")
        );
        assert_eq!(source.workspace_id.as_deref(), Some("workspace-1"));
        assert_eq!(source.workspace_root.as_deref(), Some("C:/workspace"));
    }
}

pub(super) async fn compute_agent_route(
    ctx: &AppContext,
    provider_hint: Option<&str>,
    requested_model_id: Option<&str>,
) -> Result<(TurnProviderRoute, String, String), RpcError> {
    let provider_hint_core =
        provider_hint.and_then(|provider| parse_runtime_provider(Some(provider)));
    let provider_hint_extension = match provider_hint {
        Some(provider) => resolve_active_provider_extension_by_alias(ctx, provider).await,
        None => None,
    };
    let model_hint_extension = match requested_model_id {
        Some(model_id) => resolve_active_provider_extension_by_model_id(ctx, model_id).await,
        None => None,
    };

    if let Some(provider_value) = provider_hint {
        if provider_hint_core.is_none() && provider_hint_extension.is_none() {
            let active_extensions = active_provider_extensions(ctx).await;
            let supported = RuntimeProvider::specs()
                .iter()
                .map(|spec| format!("{} ({})", spec.routed_provider, spec.aliases.join("/")))
                .chain(active_extensions.iter().map(|extension| {
                    format!(
                        "{} ({})",
                        extension.provider_id,
                        extension.aliases.join("/")
                    )
                }))
                .collect::<Vec<_>>()
                .join(", ");
            return Err(RpcError::invalid_params(format!(
                "Unsupported task provider `{provider_value}`. Supported providers: {supported}."
            )));
        }
    }

    if let (Some(provider_value), Some(extension_provider)) =
        (provider_hint, model_hint_extension.as_ref())
    {
        if provider_hint_extension.is_none() {
            return Err(RpcError::invalid_params(format!(
                "Task provider `{provider_value}` does not match extension model `{}` (provider `{}`).",
                requested_model_id.unwrap_or_default(),
                extension_provider.provider_id
            )));
        }
    }

    let route = if let Some(extension) = provider_hint_extension {
        TurnProviderRoute::Extension(extension)
    } else if let Some(extension) = model_hint_extension {
        TurnProviderRoute::Extension(extension)
    } else {
        TurnProviderRoute::Core(infer_provider(
            provider_hint,
            requested_model_id.or(Some(ctx.config.default_model_id.as_str())),
        ))
    };

    let model_id = requested_model_id
        .map(normalize_model_id)
        .unwrap_or_else(|| match &route {
            TurnProviderRoute::Core(provider) => provider.default_model_id().to_string(),
            TurnProviderRoute::Extension(extension) => extension.default_model_id.clone(),
        });

    let routed_source = if route.is_core_openai() {
        "local-codex".to_string()
    } else if matches!(route, TurnProviderRoute::Extension(_)) {
        "workspace-default".to_string()
    } else {
        "fallback".to_string()
    };

    Ok((route, model_id, routed_source))
}

fn prune_stale_async_mutex_locks<K: Clone + Eq + Hash>(
    locks: &mut HashMap<K, Arc<AsyncMutex<()>>>,
) {
    let stale_keys = locks
        .iter()
        .filter_map(|(key, lock)| {
            // A lock is only prunable when the map is the sole owner and no task currently holds it.
            if Arc::strong_count(lock) == 1 && lock.try_lock().is_ok() {
                Some(key.clone())
            } else {
                None
            }
        })
        .collect::<Vec<_>>();
    for key in stale_keys {
        locks.remove(&key);
    }
}

pub(super) fn prune_stale_compat_model_catalog_refresh_locks(
    locks: &mut HashMap<CompatModelCatalogCacheKey, Arc<AsyncMutex<()>>>,
) {
    prune_stale_async_mutex_locks(locks);
}

pub(super) async fn resolve_compat_model_catalog_refresh_lock(
    ctx: &AppContext,
    cache_key: &CompatModelCatalogCacheKey,
) -> Arc<AsyncMutex<()>> {
    if let Some(lock) = ctx
        .compat_model_catalog_refresh_locks
        .read()
        .await
        .get(cache_key)
        .cloned()
    {
        return lock;
    }

    let mut locks = ctx.compat_model_catalog_refresh_locks.write().await;
    prune_stale_compat_model_catalog_refresh_locks(&mut locks);
    locks
        .entry(cache_key.clone())
        .or_insert_with(|| Arc::new(AsyncMutex::new(())))
        .clone()
}

pub(super) fn prune_stale_agent_workspace_locks(locks: &mut HashMap<String, Arc<AsyncMutex<()>>>) {
    prune_stale_async_mutex_locks(locks);
}

pub(super) async fn resolve_agent_workspace_lock(
    ctx: &AppContext,
    workspace_id: &str,
) -> Arc<AsyncMutex<()>> {
    if let Some(lock) = ctx
        .agent_workspace_locks
        .read()
        .await
        .get(workspace_id)
        .cloned()
    {
        return lock;
    }

    let mut locks = ctx.agent_workspace_locks.write().await;
    prune_stale_agent_workspace_locks(&mut locks);
    locks
        .entry(workspace_id.to_string())
        .or_insert_with(|| Arc::new(AsyncMutex::new(())))
        .clone()
}

pub(super) fn normalize_model_id(model_id: &str) -> String {
    let trimmed = model_id.trim();
    if let Some((_, tail)) = trimmed.split_once('/') {
        let normalized_tail = tail.trim();
        if !normalized_tail.is_empty() {
            return normalized_tail.to_string();
        }
    }
    trimmed.to_string()
}
