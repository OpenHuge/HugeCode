use super::*;
mod agent_task_launch_synthesis_autodrive;
use agent_task_launch_synthesis_autodrive::{
    merge_scenario_profile, synthesize_auto_drive_autonomy_state,
    synthesize_auto_drive_context_policy, synthesize_auto_drive_decision_policy,
    synthesize_auto_drive_outcome_feedback, synthesize_auto_drive_scenario_profile,
    synthesize_launch_decision_trace,
};

#[derive(Clone, Debug)]
pub(crate) struct WorkspaceGraphMember {
    pub(crate) id: String,
    pub(crate) display_name: String,
    pub(crate) root_path: String,
    pub(crate) connected: bool,
    pub(crate) has_agents_md: bool,
    pub(crate) has_readme: bool,
    pub(crate) has_repository_execution_contract: bool,
}

#[derive(Clone, Debug, Default)]
pub(crate) struct WorkspaceLaunchContext {
    pub(crate) workspace_id: Option<String>,
    pub(crate) workspace_name: Option<String>,
    pub(crate) workspace_root_path: Option<String>,
    pub(crate) has_agents_md: bool,
    pub(crate) has_readme: bool,
    pub(crate) has_repository_execution_contract: bool,
    pub(crate) has_cargo_toml: bool,
    pub(crate) has_e2e_map: bool,
    pub(crate) validate_fast_command: Option<String>,
    pub(crate) validate_command: Option<String>,
    pub(crate) preflight_command: Option<String>,
    pub(crate) test_command: Option<String>,
    pub(crate) component_test_command: Option<String>,
    pub(crate) e2e_commands: Vec<String>,
    pub(crate) evaluation_sample_paths: Vec<String>,
    pub(crate) total_workspace_count: usize,
    pub(crate) connected_workspace_count: usize,
    pub(crate) peer_workspaces: Vec<WorkspaceGraphMember>,
}

fn read_optional_text(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(ToOwned::to_owned)
}

fn normalize_string_items(items: Vec<String>) -> Option<Vec<String>> {
    let mut seen = HashSet::new();
    let values = items
        .into_iter()
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
        .filter(|item| seen.insert(item.clone()))
        .collect::<Vec<_>>();
    (!values.is_empty()).then_some(values)
}

fn merge_optional_string_items(
    explicit: Option<Vec<String>>,
    inferred: Vec<String>,
) -> Option<Vec<String>> {
    let mut values = explicit.unwrap_or_default();
    for item in inferred {
        push_unique(&mut values, item);
    }
    normalize_string_items(values)
}

fn push_unique(items: &mut Vec<String>, value: impl Into<String>) {
    let value = value.into();
    if !items.iter().any(|existing| existing == &value) {
        items.push(value);
    }
}

fn parse_package_commands(raw: &str, context: &mut WorkspaceLaunchContext) {
    let Ok(parsed) = serde_json::from_str::<Value>(raw) else {
        return;
    };
    let scripts = parsed
        .get("scripts")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    context.validate_fast_command = scripts
        .get("validate:fast")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    context.validate_command = scripts
        .get("validate")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    context.preflight_command = scripts
        .get("preflight:codex")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    context.test_command = scripts
        .get("test")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    context.component_test_command = scripts
        .get("test:component")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    context.e2e_commands = scripts
        .iter()
        .filter_map(|(key, value)| {
            key.starts_with("test:e2e:")
                .then(|| value.as_str().map(ToOwned::to_owned))
                .flatten()
        })
        .collect::<Vec<_>>();
    context.e2e_commands.sort();
}

fn detect_workspace_evaluation_sample_paths(root: &Path) -> Vec<String> {
    let candidate_paths = [
        ".codex/e2e-map.json",
        "tests",
        "test",
        "fixtures",
        "__fixtures__",
        "playwright",
    ];
    candidate_paths
        .iter()
        .filter_map(|relative| {
            let path = root.join(relative);
            path.exists().then(|| path.display().to_string())
        })
        .collect::<Vec<_>>()
}

fn has_workspace_evaluation_signals(context: &WorkspaceLaunchContext) -> bool {
    context.test_command.is_some()
        || context.component_test_command.is_some()
        || !context.e2e_commands.is_empty()
        || context.has_e2e_map
        || !context.evaluation_sample_paths.is_empty()
        || context.has_cargo_toml
}

fn build_workspace_evaluation_source_signals(context: &WorkspaceLaunchContext) -> Vec<String> {
    let mut signals = Vec::new();
    if context.test_command.is_some() {
        push_unique(&mut signals, "test_command");
    }
    if context.component_test_command.is_some() {
        push_unique(&mut signals, "component_test_command");
    }
    if !context.e2e_commands.is_empty() {
        push_unique(&mut signals, "e2e_commands");
    }
    if context.has_e2e_map {
        push_unique(&mut signals, "e2e_map");
    }
    if context.has_cargo_toml {
        push_unique(&mut signals, "cargo_toml");
    }
    if !context.evaluation_sample_paths.is_empty() {
        push_unique(&mut signals, "evaluation_samples");
    }
    signals
}

pub(crate) async fn read_workspace_launch_context(
    ctx: &AppContext,
    workspace_id: &str,
) -> WorkspaceLaunchContext {
    let workspaces = {
        let state = ctx.state.read().await;
        state.workspaces.clone()
    };
    if workspaces.is_empty() {
        return WorkspaceLaunchContext::default();
    }

    let mut context = WorkspaceLaunchContext {
        total_workspace_count: workspaces.len(),
        connected_workspace_count: workspaces
            .iter()
            .filter(|workspace| workspace.connected)
            .count(),
        ..WorkspaceLaunchContext::default()
    };

    for workspace in workspaces {
        let root = PathBuf::from(workspace.path.clone());
        let has_agents_md = root.join("AGENTS.md").exists();
        let has_readme = root.join("README.md").exists();
        let has_repository_execution_contract = root
            .join(".hugecode/repository-execution-contract.json")
            .exists();
        let has_cargo_toml = root.join("Cargo.toml").exists();
        let has_e2e_map = root.join(".codex/e2e-map.json").exists();
        if workspace.id == workspace_id {
            context.workspace_id = Some(workspace.id.clone());
            context.workspace_name = Some(workspace.display_name.clone());
            context.workspace_root_path = Some(workspace.path.clone());
            context.has_agents_md = has_agents_md;
            context.has_readme = has_readme;
            context.has_repository_execution_contract = has_repository_execution_contract;
            context.has_cargo_toml = has_cargo_toml;
            context.has_e2e_map = has_e2e_map;
            context.evaluation_sample_paths =
                detect_workspace_evaluation_sample_paths(root.as_path());
            if let Ok(package_json) = fs::read_to_string(root.join("package.json")) {
                parse_package_commands(package_json.as_str(), &mut context);
            }
            continue;
        }
        context.peer_workspaces.push(WorkspaceGraphMember {
            id: workspace.id,
            display_name: workspace.display_name,
            root_path: workspace.path,
            connected: workspace.connected,
            has_agents_md,
            has_readme,
            has_repository_execution_contract,
        });
    }
    context.peer_workspaces.sort_by(|left, right| {
        right
            .connected
            .cmp(&left.connected)
            .then(left.display_name.cmp(&right.display_name))
            .then(left.id.cmp(&right.id))
    });
    context
}

fn infer_mission_risk_level(
    access_mode: &str,
    auto_drive: Option<&AgentTaskAutoDriveState>,
    explicit: Option<&AgentTaskMissionBriefRecord>,
) -> String {
    if let Some(explicit_level) =
        explicit.and_then(|brief| read_optional_text(brief.risk_level.as_deref()))
    {
        return explicit_level;
    }
    if access_mode == "full-access" {
        return "high".to_string();
    }
    if auto_drive.is_some() || access_mode == "on-request" {
        return "medium".to_string();
    }
    "low".to_string()
}

fn infer_required_capabilities(
    explicit: Option<&AgentTaskMissionBriefRecord>,
    auto_drive: Option<&AgentTaskAutoDriveState>,
    context: &WorkspaceLaunchContext,
) -> Option<Vec<String>> {
    if let Some(existing) = explicit.and_then(|brief| brief.required_capabilities.clone()) {
        return normalize_string_items(existing);
    }
    let Some(auto_drive) = auto_drive else {
        return None;
    };
    let mut capabilities = vec!["code".to_string()];
    let allow_validation = auto_drive
        .risk_policy
        .as_ref()
        .and_then(|policy| policy.allow_validation_commands)
        .unwrap_or(true);
    if allow_validation
        && (context.validate_fast_command.is_some()
            || context.validate_command.is_some()
            || auto_drive.destination.done_definition.is_some())
    {
        push_unique(&mut capabilities, "validation");
    }
    if context.has_agents_md || context.has_repository_execution_contract {
        push_unique(&mut capabilities, "repo_policy");
    }
    if auto_drive
        .risk_policy
        .as_ref()
        .and_then(|policy| policy.allow_network_analysis)
        .unwrap_or(false)
    {
        push_unique(&mut capabilities, "research");
    }
    if !context.peer_workspaces.is_empty() {
        push_unique(&mut capabilities, "multi_workspace");
    }
    if has_workspace_evaluation_signals(context) {
        push_unique(&mut capabilities, "evaluation");
    }
    normalize_string_items(capabilities)
}

fn infer_max_subtasks(
    explicit: Option<&AgentTaskMissionBriefRecord>,
    access_mode: &str,
    auto_drive: Option<&AgentTaskAutoDriveState>,
) -> Option<u32> {
    if let Some(existing) = explicit.and_then(|brief| brief.max_subtasks) {
        return Some(existing);
    }
    auto_drive.map(|_| if access_mode == "full-access" { 3 } else { 2 })
}

fn merge_done_definition(
    explicit: Option<&AgentTaskMissionBriefRecord>,
    auto_drive: Option<&AgentTaskAutoDriveState>,
    context: &WorkspaceLaunchContext,
) -> Option<Vec<String>> {
    let mut done_definition = explicit
        .and_then(|brief| brief.done_definition.clone())
        .unwrap_or_else(|| {
            auto_drive
                .and_then(|state| state.destination.done_definition.as_ref())
                .and_then(|definition| definition.arrival_criteria.clone())
                .unwrap_or_default()
        });
    if done_definition.is_empty() {
        return None;
    }
    if let Some(command) = context
        .validate_fast_command
        .as_ref()
        .or(context.validate_command.as_ref())
    {
        push_unique(
            &mut done_definition,
            format!("Validate the result with `{command}` before claiming arrival."),
        );
    }
    if has_workspace_evaluation_signals(context) {
        push_unique(
            &mut done_definition,
            "Update the most representative automated test lane and regression samples for the chosen route.",
        );
    }
    normalize_string_items(done_definition)
}

fn merge_constraints(
    explicit: Option<&AgentTaskMissionBriefRecord>,
    auto_drive: Option<&AgentTaskAutoDriveState>,
    context: &WorkspaceLaunchContext,
) -> Option<Vec<String>> {
    let mut constraints = explicit
        .and_then(|brief| brief.constraints.clone())
        .unwrap_or_else(|| {
            auto_drive
                .and_then(|state| state.destination.hard_boundaries.clone())
                .unwrap_or_default()
        });
    if context.has_agents_md || context.has_readme {
        push_unique(
            &mut constraints,
            "Follow repository authority docs before widening scope.",
        );
    }
    if context.has_repository_execution_contract {
        push_unique(
            &mut constraints,
            "Honor repository execution contract defaults during launch and validation.",
        );
    }
    if !context.peer_workspaces.is_empty() {
        push_unique(
            &mut constraints,
            "Use other connected workspaces as architectural context, but do not widen edits outside the active workspace unless the destination requires it.",
        );
    }
    if has_workspace_evaluation_signals(context) {
        push_unique(
            &mut constraints,
            "Preserve representative regression samples or held-out fixtures so future AutoDrive evals can still detect drift.",
        );
    }
    normalize_string_items(constraints)
}

fn merge_evaluation_plan(
    explicit: Option<&AgentTaskMissionBriefRecord>,
    context: &WorkspaceLaunchContext,
) -> Option<AgentTaskMissionEvaluationPlanRecord> {
    let explicit_plan = explicit.and_then(|brief| brief.evaluation_plan.clone());
    if explicit_plan.is_none() && !has_workspace_evaluation_signals(context) {
        return None;
    }

    let mut plan = explicit_plan.unwrap_or(AgentTaskMissionEvaluationPlanRecord {
        representative_commands: None,
        component_commands: None,
        end_to_end_commands: None,
        sample_paths: None,
        held_out_guidance: None,
        source_signals: None,
    });

    let representative_commands = [
        read_optional_text(context.test_command.as_deref()),
        read_optional_text(context.validate_fast_command.as_deref()),
        context.has_cargo_toml.then_some("cargo test".to_string()),
    ]
    .into_iter()
    .flatten()
    .collect::<Vec<_>>();

    plan.representative_commands =
        merge_optional_string_items(plan.representative_commands, representative_commands);
    plan.component_commands = merge_optional_string_items(
        plan.component_commands,
        read_optional_text(context.component_test_command.as_deref())
            .into_iter()
            .collect::<Vec<_>>(),
    );
    plan.end_to_end_commands =
        merge_optional_string_items(plan.end_to_end_commands, context.e2e_commands.clone());
    plan.sample_paths =
        merge_optional_string_items(plan.sample_paths, context.evaluation_sample_paths.clone());
    plan.held_out_guidance = merge_optional_string_items(
        plan.held_out_guidance,
        vec![
            "Keep at least one representative scenario or fixture untouched so future AutoDrive evals can detect drift.".to_string(),
            "Prefer the narrowest representative lane before escalating to wider suites.".to_string(),
        ],
    );
    plan.source_signals = merge_optional_string_items(
        plan.source_signals,
        build_workspace_evaluation_source_signals(context),
    );

    let has_values = plan.representative_commands.is_some()
        || plan.component_commands.is_some()
        || plan.end_to_end_commands.is_some()
        || plan.sample_paths.is_some()
        || plan.held_out_guidance.is_some()
        || plan.source_signals.is_some();
    has_values.then_some(plan)
}

fn merge_permission_summary(
    explicit: Option<&AgentTaskMissionBriefRecord>,
    access_mode: &str,
    auto_drive: Option<&AgentTaskAutoDriveState>,
) -> Option<AgentTaskPermissionSummaryRecord> {
    let allow_network = auto_drive
        .and_then(|state| state.risk_policy.as_ref())
        .and_then(|policy| policy.allow_network_analysis);
    match explicit.and_then(|brief| brief.permission_summary.clone()) {
        Some(mut summary) => {
            if summary.access_mode.is_none() {
                summary.access_mode = Some(access_mode.to_string());
            }
            if summary.allow_network.is_none() {
                summary.allow_network = allow_network;
            }
            Some(summary)
        }
        None => Some(AgentTaskPermissionSummaryRecord {
            access_mode: Some(access_mode.to_string()),
            allow_network,
            writable_roots: None,
            tool_names: None,
        }),
    }
}

fn build_context_policy_guidance(auto_drive: &AgentTaskAutoDriveState) -> Vec<String> {
    let Some(context_policy) = auto_drive.context_policy.as_ref() else {
        return Vec::new();
    };
    let mut guidance = Vec::new();
    if let Some(scope) = read_optional_text(context_policy.scope.as_deref()) {
        guidance.push(format!("Scope: {scope}."));
    }
    if let Some(paths) = context_policy.workspace_context_paths.clone() {
        let summarized = paths.into_iter().take(4).collect::<Vec<_>>();
        if !summarized.is_empty() {
            guidance.push(format!("Context paths: {}.", summarized.join(", ")));
        }
    }
    if let Some(paths) = context_policy.workspace_read_paths.clone() {
        let summarized = paths.into_iter().take(4).collect::<Vec<_>>();
        if !summarized.is_empty() {
            guidance.push(format!("Read paths: {}.", summarized.join(", ")));
        }
    }
    if let Some(authority_sources) = context_policy.authority_sources.clone() {
        if !authority_sources.is_empty() {
            guidance.push(format!(
                "Authority sources: {}.",
                authority_sources.join(", ")
            ));
        }
    }
    guidance
}

fn build_decision_policy_guidance(auto_drive: &AgentTaskAutoDriveState) -> Vec<String> {
    let Some(decision_policy) = auto_drive.decision_policy.as_ref() else {
        return Vec::new();
    };
    let mut guidance = Vec::new();
    if let Some(independent_thread) = decision_policy.independent_thread {
        guidance.push(format!("Independent thread: {independent_thread}."));
    }
    if let Some(autonomy_priority) =
        read_optional_text(decision_policy.autonomy_priority.as_deref())
    {
        guidance.push(format!("Autonomy priority: {autonomy_priority}."));
    }
    if let Some(prompt_strategy) = read_optional_text(decision_policy.prompt_strategy.as_deref()) {
        guidance.push(format!("Prompt strategy: {prompt_strategy}."));
    }
    if let Some(research_mode) = read_optional_text(decision_policy.research_mode.as_deref()) {
        guidance.push(format!("Research mode: {research_mode}."));
    }
    guidance
}

pub(crate) fn synthesize_agent_task_auto_drive_state(
    explicit: Option<AgentTaskAutoDriveState>,
    context: &WorkspaceLaunchContext,
) -> Option<AgentTaskAutoDriveState> {
    let mut auto_drive = explicit?;
    auto_drive.context_policy = synthesize_auto_drive_context_policy(
        auto_drive.context_policy.clone(),
        &auto_drive,
        context,
    );
    auto_drive.decision_policy = synthesize_auto_drive_decision_policy(
        auto_drive.decision_policy.clone(),
        &auto_drive,
        context,
    );
    auto_drive.scenario_profile = synthesize_auto_drive_scenario_profile(
        auto_drive.scenario_profile.clone(),
        &auto_drive,
        context,
    );
    auto_drive.decision_trace = synthesize_launch_decision_trace(
        auto_drive.decision_trace.clone(),
        &auto_drive,
        auto_drive.scenario_profile.as_ref(),
    );
    auto_drive.outcome_feedback = synthesize_auto_drive_outcome_feedback(
        auto_drive.outcome_feedback.clone(),
        auto_drive.scenario_profile.as_ref(),
    );
    auto_drive.autonomy_state = synthesize_auto_drive_autonomy_state(
        auto_drive.autonomy_state.clone(),
        &auto_drive,
        auto_drive.scenario_profile.as_ref(),
    );
    Some(auto_drive)
}

pub(crate) fn synthesize_agent_task_mission_brief(
    explicit: Option<AgentTaskMissionBriefRecord>,
    objective: String,
    access_mode: &str,
    preferred_backend_ids: &[String],
    auto_drive: Option<&AgentTaskAutoDriveState>,
    context: &WorkspaceLaunchContext,
) -> AgentTaskMissionBriefRecord {
    let explicit_ref = explicit.as_ref();
    AgentTaskMissionBriefRecord {
        objective: explicit
            .as_ref()
            .map(|brief| brief.objective.trim().to_string())
            .filter(|value| !value.is_empty())
            .unwrap_or(objective),
        done_definition: merge_done_definition(explicit_ref, auto_drive, context),
        constraints: merge_constraints(explicit_ref, auto_drive, context),
        risk_level: Some(infer_mission_risk_level(
            access_mode,
            auto_drive,
            explicit_ref,
        )),
        required_capabilities: infer_required_capabilities(explicit_ref, auto_drive, context),
        max_subtasks: infer_max_subtasks(explicit_ref, access_mode, auto_drive),
        preferred_backend_ids: explicit
            .as_ref()
            .and_then(|brief| brief.preferred_backend_ids.clone())
            .or_else(|| normalize_string_items(preferred_backend_ids.to_vec())),
        permission_summary: merge_permission_summary(explicit_ref, access_mode, auto_drive),
        evaluation_plan: merge_evaluation_plan(explicit_ref, context),
        scenario_profile: merge_scenario_profile(explicit_ref, auto_drive, context),
    }
}

fn format_multiline_list(label: &str, values: Vec<String>) -> Option<String> {
    if values.is_empty() {
        return None;
    }
    Some(format!("{label}:\n- {}", values.join("\n- ")))
}

fn build_workspace_graph_guidance(context: &WorkspaceLaunchContext) -> Vec<String> {
    let mut guidance = Vec::new();
    if let Some(name) = read_optional_text(context.workspace_name.as_deref()) {
        let workspace_id = context
            .workspace_id
            .clone()
            .unwrap_or_else(|| "unknown".to_string());
        let root = context
            .workspace_root_path
            .clone()
            .unwrap_or_else(|| "unknown".to_string());
        guidance.push(format!(
            "Active workspace: {name} ({workspace_id}) at {root}."
        ));
    }
    if context.total_workspace_count > 0 {
        guidance.push(format!(
            "Connected workspaces in app: {}/{}.",
            context.connected_workspace_count, context.total_workspace_count
        ));
    }
    for peer in context.peer_workspaces.iter().take(4) {
        let mut signals = Vec::new();
        if peer.connected {
            signals.push("connected");
        }
        if peer.has_agents_md {
            signals.push("AGENTS.md");
        }
        if peer.has_readme {
            signals.push("README.md");
        }
        if peer.has_repository_execution_contract {
            signals.push("repo-contract");
        }
        let signal_summary = if signals.is_empty() {
            "no extra signals".to_string()
        } else {
            signals.join(", ")
        };
        guidance.push(format!(
            "Peer workspace: {} ({}) at {} [{}].",
            peer.display_name, peer.id, peer.root_path, signal_summary
        ));
    }
    guidance
}

fn build_evaluation_strategy_guidance(mission_brief: &AgentTaskMissionBriefRecord) -> Vec<String> {
    let Some(plan) = mission_brief.evaluation_plan.as_ref() else {
        return Vec::new();
    };
    let mut guidance = Vec::new();
    if let Some(commands) = plan.representative_commands.clone() {
        if !commands.is_empty() {
            guidance.push(format!(
                "Representative regression lane: {}.",
                commands
                    .iter()
                    .take(3)
                    .map(|command| format!("`{command}`"))
                    .collect::<Vec<_>>()
                    .join(", ")
            ));
        }
    }
    if let Some(commands) = plan.component_commands.clone() {
        let summarized = commands.into_iter().take(3).collect::<Vec<_>>();
        if !summarized.is_empty() {
            guidance.push(format!(
                "Component interaction lane: {} when UI behavior changes.",
                summarized
                    .iter()
                    .map(|command| format!("`{command}`"))
                    .collect::<Vec<_>>()
                    .join(", ")
            ));
        }
    }
    if let Some(commands) = plan.end_to_end_commands.clone() {
        let summarized = commands.into_iter().take(3).collect::<Vec<_>>();
        if !summarized.is_empty() {
            guidance.push(format!(
                "Targeted end-to-end lanes: {}.",
                summarized
                    .iter()
                    .map(|command| format!("`{command}`"))
                    .collect::<Vec<_>>()
                    .join(", ")
            ));
        }
    }
    if let Some(paths) = plan.sample_paths.clone() {
        let summarized = paths.into_iter().take(4).collect::<Vec<_>>();
        if !summarized.is_empty() {
            guidance.push(format!(
                "Representative samples and fixture assets: {}.",
                summarized.join(", ")
            ));
        }
    }
    if let Some(source_signals) = plan.source_signals.clone() {
        let summarized = source_signals.into_iter().take(6).collect::<Vec<_>>();
        if !summarized.is_empty() {
            guidance.push(format!("Evaluation signals: {}.", summarized.join(", ")));
        }
    }
    if let Some(held_out_guidance) = plan.held_out_guidance.clone() {
        for guidance_line in held_out_guidance.into_iter().take(3) {
            guidance.push(guidance_line);
        }
    } else {
        guidance.push(format!(
            "Keep at least one representative scenario or fixture untouched when expanding coverage so held-out regression detection remains meaningful."
        ));
    }
    guidance
}

fn build_auto_drive_launch_instruction(
    operator_seed: &str,
    mission_brief: &AgentTaskMissionBriefRecord,
    auto_drive: &AgentTaskAutoDriveState,
    context: &WorkspaceLaunchContext,
) -> String {
    let desired_end_state = auto_drive.destination.desired_end_state.clone();
    let allow_network_analysis = auto_drive
        .risk_policy
        .as_ref()
        .and_then(|policy| policy.allow_network_analysis)
        .unwrap_or(false);
    let repo_guidance = [
        context.has_agents_md.then_some(
            "Read AGENTS.md and follow repository-specific authority before widening scope."
                .to_string(),
        ),
        context.has_readme
            .then_some("Use README.md as current repo orientation context.".to_string()),
        context.has_repository_execution_contract.then_some(
            "Honor .hugecode/repository-execution-contract.json defaults for launch and validation."
                .to_string(),
        ),
        context
            .validate_fast_command
            .as_ref()
            .map(|command| format!("Prefer `{command}` as the narrow validation path when feasible.")),
        context.preflight_command.as_ref().map(|command| {
            format!("Escalate to `{command}` only when the route affects broader workspace contracts.")
        }),
    ]
    .into_iter()
    .flatten()
    .collect::<Vec<_>>();
    let workspace_graph_guidance = build_workspace_graph_guidance(context);
    let context_policy_guidance = build_context_policy_guidance(auto_drive);
    let decision_policy_guidance = build_decision_policy_guidance(auto_drive);
    let evaluation_strategy_guidance = build_evaluation_strategy_guidance(mission_brief);

    [
        Some("AutoDrive launch capsule".to_string()),
        Some(format!("Objective: {}", mission_brief.objective)),
        read_optional_text(Some(operator_seed)).map(|seed| format!("Operator seed: {seed}")),
        Some(
            "Mission posture: Treat this as an independent, operator-priority AutoDrive mission rather than a thread-bound continuation."
                .to_string(),
        ),
        format_multiline_list("Desired end state", desired_end_state),
        mission_brief
            .done_definition
            .clone()
            .and_then(|values| format_multiline_list("Done definition", values)),
        mission_brief
            .constraints
            .clone()
            .and_then(|values| format_multiline_list("Hard boundaries", values)),
        format_multiline_list("Context policy", context_policy_guidance),
        format_multiline_list("Decision policy", decision_policy_guidance),
        format_multiline_list("App workspace graph", workspace_graph_guidance),
        format_multiline_list("Repository guidance", repo_guidance),
        format_multiline_list("Evaluation strategy", evaluation_strategy_guidance),
        Some(if allow_network_analysis {
            "External research:\n- Network analysis is allowed.\n- Use current external guidance and ecosystem signals when they materially improve architecture, implementation, or validation choices."
                .to_string()
        } else {
            "External research:\n- Network analysis is disabled.\n- Rely on repository truth and runtime-published context only."
                .to_string()
        }),
        Some(
            "Execution policy:\n- Start by inspecting current repo state, authority docs, and the app-wide workspace graph.\n- Make the smallest safe change that advances the destination.\n- Validate before claiming arrival.\n- Stop and surface blockers instead of broadening scope silently."
                .to_string(),
        ),
    ]
    .into_iter()
    .flatten()
    .collect::<Vec<_>>()
    .join("\n\n")
}

pub(crate) fn synthesize_agent_task_steps(
    steps: Vec<AgentTaskStepInput>,
    auto_drive: Option<&AgentTaskAutoDriveState>,
    mission_brief: &AgentTaskMissionBriefRecord,
    context: &WorkspaceLaunchContext,
) -> Vec<AgentTaskStepInput> {
    let Some(auto_drive) = auto_drive else {
        return steps;
    };
    let mut next_steps = steps;
    let Some(first_step) = next_steps.first_mut() else {
        return next_steps;
    };
    if first_step.kind != AgentStepKind::Read {
        return next_steps;
    }
    let operator_seed = first_step
        .input
        .clone()
        .unwrap_or_else(|| mission_brief.objective.clone());
    first_step.input = Some(build_auto_drive_launch_instruction(
        operator_seed.as_str(),
        mission_brief,
        auto_drive,
        context,
    ));
    next_steps
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_auto_drive(allow_network_analysis: bool) -> AgentTaskAutoDriveState {
        AgentTaskAutoDriveState {
            enabled: Some(true),
            destination: AgentTaskAutoDriveDestination {
                title: "Ship runtime truth".to_string(),
                desired_end_state: vec!["Runtime-backed controls".to_string()],
                done_definition: Some(AgentTaskAutoDriveDoneDefinition {
                    arrival_criteria: Some(vec!["Controls use runtime truth".to_string()]),
                    required_validation: None,
                    waypoint_indicators: None,
                }),
                hard_boundaries: Some(vec!["Do not widen scope".to_string()]),
                route_preference: Some("balanced".to_string()),
            },
            budget: None,
            risk_policy: Some(AgentTaskAutoDriveRiskPolicy {
                pause_on_destructive_change: None,
                pause_on_dependency_change: None,
                pause_on_low_confidence: None,
                pause_on_human_checkpoint: None,
                allow_network_analysis: Some(allow_network_analysis),
                allow_validation_commands: Some(true),
                minimum_confidence: Some("medium".to_string()),
            }),
            context_policy: None,
            decision_policy: None,
            scenario_profile: None,
            decision_trace: None,
            outcome_feedback: None,
            autonomy_state: None,
            navigation: None,
            recovery: None,
            stop: None,
        }
    }

    fn sample_context() -> WorkspaceLaunchContext {
        WorkspaceLaunchContext {
            workspace_id: Some("workspace-1".to_string()),
            workspace_name: Some("Workspace".to_string()),
            workspace_root_path: Some("/repo".to_string()),
            has_agents_md: true,
            has_readme: true,
            has_repository_execution_contract: true,
            has_cargo_toml: true,
            has_e2e_map: true,
            validate_fast_command: Some("pnpm validate:fast".to_string()),
            validate_command: Some("pnpm validate".to_string()),
            preflight_command: Some("pnpm preflight:codex".to_string()),
            test_command: Some("pnpm test".to_string()),
            component_test_command: Some("pnpm test:component".to_string()),
            e2e_commands: vec!["pnpm test:e2e:smoke".to_string()],
            evaluation_sample_paths: vec![
                "/repo/.codex/e2e-map.json".to_string(),
                "/repo/tests".to_string(),
            ],
            total_workspace_count: 2,
            connected_workspace_count: 2,
            peer_workspaces: vec![WorkspaceGraphMember {
                id: "workspace-2".to_string(),
                display_name: "Peer Workspace".to_string(),
                root_path: "/peer".to_string(),
                connected: true,
                has_agents_md: true,
                has_readme: false,
                has_repository_execution_contract: false,
            }],
        }
    }

    #[test]
    fn launch_instruction_includes_workspace_graph_and_research_posture() {
        let mission_brief = AgentTaskMissionBriefRecord {
            objective: "Ship runtime truth".to_string(),
            done_definition: Some(vec!["Controls use runtime truth".to_string()]),
            constraints: Some(vec!["Do not widen scope".to_string()]),
            risk_level: Some("medium".to_string()),
            required_capabilities: None,
            max_subtasks: Some(2),
            preferred_backend_ids: None,
            permission_summary: None,
            evaluation_plan: Some(AgentTaskMissionEvaluationPlanRecord {
                representative_commands: Some(vec!["pnpm test".to_string()]),
                component_commands: Some(vec!["pnpm test:component".to_string()]),
                end_to_end_commands: Some(vec!["pnpm test:e2e:smoke".to_string()]),
                sample_paths: Some(vec![
                    "/repo/.codex/e2e-map.json".to_string(),
                    "/repo/tests".to_string(),
                ]),
                held_out_guidance: Some(vec![
                    "Keep at least one representative scenario or fixture untouched so held-out regression detection remains meaningful.".to_string(),
                ]),
                source_signals: Some(vec!["e2e_map".to_string(), "test_command".to_string()]),
            }),
            scenario_profile: None,
        };
        let auto_drive = synthesize_agent_task_auto_drive_state(
            Some(sample_auto_drive(true)),
            &sample_context(),
        )
        .expect("auto drive");

        let instruction = build_auto_drive_launch_instruction(
            "Ship runtime truth",
            &mission_brief,
            &auto_drive,
            &sample_context(),
        );

        assert!(instruction.contains("independent, operator-priority AutoDrive mission"));
        assert!(instruction.contains("App workspace graph"));
        assert!(instruction.contains("Peer workspace: Peer Workspace"));
        assert!(instruction.contains("Context policy"));
        assert!(instruction.contains("Decision policy"));
        assert!(instruction.contains("Evaluation strategy"));
        assert!(instruction.contains("Representative regression lane"));
        assert!(instruction.contains("held-out regression detection"));
        assert!(instruction.contains("Network analysis is allowed."));
    }

    #[test]
    fn synthesize_auto_drive_state_adds_context_and_decision_policies() {
        let auto_drive = synthesize_agent_task_auto_drive_state(
            Some(sample_auto_drive(true)),
            &sample_context(),
        )
        .expect("auto drive");

        assert_eq!(
            auto_drive
                .context_policy
                .as_ref()
                .and_then(|policy| policy.scope.as_deref()),
            Some("workspace_graph")
        );
        assert_eq!(
            auto_drive
                .decision_policy
                .as_ref()
                .and_then(|policy| policy.independent_thread),
            Some(true)
        );
        assert_eq!(
            auto_drive
                .decision_policy
                .as_ref()
                .and_then(|policy| policy.prompt_strategy.as_deref()),
            Some("workspace_graph_first")
        );
        assert_eq!(
            auto_drive
                .scenario_profile
                .as_ref()
                .and_then(|profile| profile.authority_scope.as_deref()),
            Some("workspace_graph")
        );
        assert_eq!(
            auto_drive
                .scenario_profile
                .as_ref()
                .and_then(|profile| profile.safe_background),
            Some(false)
        );
        assert_eq!(
            auto_drive
                .decision_trace
                .as_ref()
                .and_then(|trace| trace.selected_candidate_id.as_deref()),
            Some("launch_autodrive")
        );
        assert_eq!(
            auto_drive
                .outcome_feedback
                .as_ref()
                .and_then(|feedback| feedback.status.as_deref()),
            Some("launch_prepared")
        );
        assert_eq!(
            auto_drive
                .autonomy_state
                .as_ref()
                .and_then(|state| state.high_priority),
            Some(true)
        );
    }

    #[test]
    fn mission_brief_infers_multi_workspace_capability_for_autodrive() {
        let mission_brief = synthesize_agent_task_mission_brief(
            None,
            "Ship runtime truth".to_string(),
            "on-request",
            &[],
            Some(&sample_auto_drive(true)),
            &sample_context(),
        );
        let constraints = mission_brief.constraints.clone().unwrap_or_default();
        let done_definition = mission_brief.done_definition.clone().unwrap_or_default();
        let evaluation_plan = mission_brief
            .evaluation_plan
            .clone()
            .expect("evaluation plan");

        assert_eq!(
            mission_brief.required_capabilities,
            Some(vec![
                "code".to_string(),
                "validation".to_string(),
                "repo_policy".to_string(),
                "research".to_string(),
                "multi_workspace".to_string(),
                "evaluation".to_string(),
            ])
        );
        assert!(constraints
            .iter()
            .any(|entry| entry.contains("other connected workspaces")));
        assert!(constraints
            .iter()
            .any(|entry| entry.contains("held-out fixtures")));
        assert!(done_definition
            .iter()
            .any(|entry| entry.contains("representative automated test lane")));
        assert_eq!(
            evaluation_plan.representative_commands,
            Some(vec![
                "pnpm test".to_string(),
                "pnpm validate:fast".to_string(),
                "cargo test".to_string()
            ])
        );
        assert_eq!(
            evaluation_plan.component_commands,
            Some(vec!["pnpm test:component".to_string()])
        );
        assert_eq!(
            evaluation_plan.end_to_end_commands,
            Some(vec!["pnpm test:e2e:smoke".to_string()])
        );
        assert!(evaluation_plan
            .sample_paths
            .unwrap_or_default()
            .iter()
            .any(|path| path.contains(".codex/e2e-map.json")));
        assert!(evaluation_plan
            .source_signals
            .unwrap_or_default()
            .iter()
            .any(|signal| signal == "e2e_map"));
        assert_eq!(
            mission_brief
                .scenario_profile
                .as_ref()
                .and_then(|profile| profile.authority_scope.as_deref()),
            Some("workspace_graph")
        );
        assert!(mission_brief
            .scenario_profile
            .as_ref()
            .and_then(|profile| profile.scenario_keys.clone())
            .unwrap_or_default()
            .iter()
            .any(|key| key == "workspace_graph_launch"));
    }
}
