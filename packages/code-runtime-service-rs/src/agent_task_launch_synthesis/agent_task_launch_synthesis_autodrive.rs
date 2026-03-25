use super::*;

fn infer_auto_drive_scenario_keys(context: &WorkspaceLaunchContext) -> Vec<String> {
    let mut keys = Vec::new();
    push_unique(
        &mut keys,
        if !context.peer_workspaces.is_empty() {
            "workspace_graph_launch"
        } else {
            "active_workspace_launch"
        },
    );
    if has_workspace_evaluation_signals(context) {
        push_unique(&mut keys, "validation-recovery");
    }
    if !context.peer_workspaces.is_empty() {
        push_unique(&mut keys, "multi-workspace-authority");
    }
    if !context.e2e_commands.is_empty() {
        push_unique(&mut keys, "publish-corridor");
    }
    keys
}

pub(super) fn synthesize_auto_drive_scenario_profile(
    explicit: Option<AgentTaskAutoDriveScenarioProfile>,
    auto_drive: &AgentTaskAutoDriveState,
    context: &WorkspaceLaunchContext,
) -> Option<AgentTaskAutoDriveScenarioProfile> {
    let mut profile = explicit.unwrap_or(AgentTaskAutoDriveScenarioProfile {
        authority_scope: None,
        authority_sources: None,
        representative_commands: None,
        component_commands: None,
        end_to_end_commands: None,
        sample_paths: None,
        held_out_guidance: None,
        source_signals: None,
        scenario_keys: None,
        safe_background: None,
    });
    if profile.authority_scope.is_none() {
        profile.authority_scope = auto_drive
            .context_policy
            .as_ref()
            .and_then(|policy| policy.scope.clone())
            .or_else(|| Some(default_auto_drive_context_scope(context).to_string()));
    }
    if profile.authority_sources.is_none() {
        profile.authority_sources = auto_drive
            .context_policy
            .as_ref()
            .and_then(|policy| policy.authority_sources.clone())
            .or_else(|| build_default_auto_drive_authority_sources(auto_drive, context));
    }
    profile.representative_commands = merge_optional_string_items(
        profile.representative_commands,
        [
            read_optional_text(context.test_command.as_deref()),
            read_optional_text(context.validate_fast_command.as_deref()),
            context.has_cargo_toml.then_some("cargo test".to_string()),
        ]
        .into_iter()
        .flatten()
        .collect::<Vec<_>>(),
    );
    profile.component_commands = merge_optional_string_items(
        profile.component_commands,
        read_optional_text(context.component_test_command.as_deref())
            .into_iter()
            .collect::<Vec<_>>(),
    );
    profile.end_to_end_commands =
        merge_optional_string_items(profile.end_to_end_commands, context.e2e_commands.clone());
    profile.sample_paths = merge_optional_string_items(
        profile.sample_paths,
        context.evaluation_sample_paths.clone(),
    );
    profile.held_out_guidance = merge_optional_string_items(
        profile.held_out_guidance,
        vec![
            "Keep at least one representative scenario or fixture untouched so future AutoDrive evals can detect drift.".to_string(),
            "Prefer the narrowest representative lane before escalating to wider suites.".to_string(),
        ],
    );
    profile.source_signals = merge_optional_string_items(
        profile.source_signals,
        build_workspace_evaluation_source_signals(context),
    );
    profile.scenario_keys = merge_optional_string_items(
        profile.scenario_keys,
        infer_auto_drive_scenario_keys(context),
    );
    if profile.safe_background.is_none() {
        profile.safe_background = Some(false);
    }
    let has_values = profile.authority_scope.is_some()
        || profile.authority_sources.is_some()
        || profile.representative_commands.is_some()
        || profile.component_commands.is_some()
        || profile.end_to_end_commands.is_some()
        || profile.sample_paths.is_some()
        || profile.held_out_guidance.is_some()
        || profile.source_signals.is_some()
        || profile.scenario_keys.is_some()
        || profile.safe_background.is_some();
    has_values.then_some(profile)
}

pub(super) fn synthesize_launch_decision_trace(
    explicit: Option<AgentTaskAutoDriveDecisionTrace>,
    auto_drive: &AgentTaskAutoDriveState,
    scenario_profile: Option<&AgentTaskAutoDriveScenarioProfile>,
) -> Option<AgentTaskAutoDriveDecisionTrace> {
    let mut trace = explicit.unwrap_or(AgentTaskAutoDriveDecisionTrace {
        phase: None,
        summary: None,
        selected_candidate_id: None,
        selected_candidate_summary: None,
        selection_tags: None,
        score_breakdown: None,
        authority_sources: None,
        representative_command: None,
        held_out_guidance: None,
    });
    let authority_scope = scenario_profile
        .and_then(|profile| profile.authority_scope.as_deref())
        .unwrap_or("active_workspace");
    if trace.phase.is_none() {
        trace.phase = Some("launch".to_string());
    }
    if trace.selected_candidate_id.is_none() {
        trace.selected_candidate_id = Some("launch_autodrive".to_string());
    }
    if trace.selected_candidate_summary.is_none() {
        trace.selected_candidate_summary = Some(
            "Prepare an independent AutoDrive mission using runtime-owned repo authority and representative evaluation lanes.".to_string(),
        );
    }
    if trace.selection_tags.is_none() {
        trace.selection_tags = Some(
            [
                Some(authority_scope.to_string()),
                Some("eval_first".to_string()),
                auto_drive
                    .decision_policy
                    .as_ref()
                    .and_then(|policy| policy.research_mode.clone())
                    .map(|mode| format!("research:{mode}")),
            ]
            .into_iter()
            .flatten()
            .collect::<Vec<_>>(),
        );
    }
    if trace.score_breakdown.is_none() {
        let mut breakdown = vec![AgentTaskAutoDriveDecisionScore {
            reason_code: "repo_authority".to_string(),
            label: "repo authority is available".to_string(),
            delta: 12,
        }];
        if authority_scope == "workspace_graph" {
            breakdown.push(AgentTaskAutoDriveDecisionScore {
                reason_code: "workspace_graph_context".to_string(),
                label: "workspace graph context is available".to_string(),
                delta: 16,
            });
        }
        if scenario_profile
            .and_then(|profile| profile.representative_commands.as_ref())
            .map(|commands| !commands.is_empty())
            .unwrap_or(false)
        {
            breakdown.push(AgentTaskAutoDriveDecisionScore {
                reason_code: "representative_eval_lane".to_string(),
                label: "representative evaluation lane is available".to_string(),
                delta: 14,
            });
        }
        trace.score_breakdown = Some(breakdown);
    }
    if trace.authority_sources.is_none() {
        trace.authority_sources =
            scenario_profile.and_then(|profile| profile.authority_sources.clone());
    }
    if trace.representative_command.is_none() {
        trace.representative_command = scenario_profile
            .and_then(|profile| profile.representative_commands.as_ref())
            .and_then(|commands| commands.first().cloned());
    }
    if trace.held_out_guidance.is_none() {
        trace.held_out_guidance =
            scenario_profile.and_then(|profile| profile.held_out_guidance.clone());
    }
    if trace.summary.is_none() {
        let scope_summary = if authority_scope == "workspace_graph" {
            "workspace graph"
        } else {
            "active workspace"
        };
        let eval_summary = if trace.representative_command.is_some() {
            "representative eval lane"
        } else {
            "repo authority"
        };
        trace.summary = Some(format!("Launch uses {scope_summary} and {eval_summary}."));
    }
    let has_values = trace.phase.is_some()
        || trace.summary.is_some()
        || trace.selected_candidate_id.is_some()
        || trace.selection_tags.is_some()
        || trace.score_breakdown.is_some();
    has_values.then_some(trace)
}

pub(super) fn synthesize_auto_drive_outcome_feedback(
    explicit: Option<AgentTaskAutoDriveOutcomeFeedback>,
    scenario_profile: Option<&AgentTaskAutoDriveScenarioProfile>,
) -> Option<AgentTaskAutoDriveOutcomeFeedback> {
    let mut feedback = explicit.unwrap_or(AgentTaskAutoDriveOutcomeFeedback {
        status: None,
        summary: None,
        failure_class: None,
        validation_commands: None,
        human_intervention_required: None,
        held_out_preserved: None,
        at: None,
    });
    if feedback.status.is_none() {
        feedback.status = Some("launch_prepared".to_string());
    }
    if feedback.summary.is_none() {
        feedback.summary = Some("Runtime prepared AutoDrive launch context.".to_string());
    }
    if feedback.validation_commands.is_none() {
        feedback.validation_commands =
            scenario_profile.and_then(|profile| profile.representative_commands.clone());
    }
    if feedback.human_intervention_required.is_none() {
        feedback.human_intervention_required = Some(false);
    }
    if feedback.held_out_preserved.is_none() {
        feedback.held_out_preserved = Some(
            scenario_profile
                .and_then(|profile| profile.held_out_guidance.as_ref())
                .map(|guidance| !guidance.is_empty())
                .unwrap_or(false),
        );
    }
    let has_values = feedback.status.is_some()
        || feedback.summary.is_some()
        || feedback.validation_commands.is_some();
    has_values.then_some(feedback)
}

pub(super) fn synthesize_auto_drive_autonomy_state(
    explicit: Option<AgentTaskAutoDriveAutonomyState>,
    auto_drive: &AgentTaskAutoDriveState,
    scenario_profile: Option<&AgentTaskAutoDriveScenarioProfile>,
) -> Option<AgentTaskAutoDriveAutonomyState> {
    let mut state = explicit.unwrap_or(AgentTaskAutoDriveAutonomyState {
        independent_thread: None,
        autonomy_priority: None,
        high_priority: None,
        escalation_pressure: None,
        unattended_continuation_allowed: None,
        background_safe: None,
        human_intervention_hotspots: None,
    });
    if state.independent_thread.is_none() {
        state.independent_thread = auto_drive
            .decision_policy
            .as_ref()
            .and_then(|policy| policy.independent_thread);
    }
    if state.autonomy_priority.is_none() {
        state.autonomy_priority = auto_drive
            .decision_policy
            .as_ref()
            .and_then(|policy| policy.autonomy_priority.clone());
    }
    if state.high_priority.is_none() {
        state.high_priority = Some(
            state.independent_thread.unwrap_or(false)
                && matches!(state.autonomy_priority.as_deref(), Some("operator")),
        );
    }
    if state.escalation_pressure.is_none() {
        state.escalation_pressure = Some("medium".to_string());
    }
    if state.unattended_continuation_allowed.is_none() {
        state.unattended_continuation_allowed = Some(false);
    }
    if state.background_safe.is_none() {
        state.background_safe = scenario_profile.and_then(|profile| profile.safe_background);
    }
    if state.human_intervention_hotspots.is_none() {
        state.human_intervention_hotspots =
            normalize_string_items(vec!["validation".to_string(), "scope_change".to_string()]);
    }
    let has_values = state.independent_thread.is_some()
        || state.autonomy_priority.is_some()
        || state.high_priority.is_some()
        || state.escalation_pressure.is_some()
        || state.unattended_continuation_allowed.is_some()
        || state.background_safe.is_some()
        || state.human_intervention_hotspots.is_some();
    has_values.then_some(state)
}

pub(super) fn merge_scenario_profile(
    explicit: Option<&AgentTaskMissionBriefRecord>,
    auto_drive: Option<&AgentTaskAutoDriveState>,
    context: &WorkspaceLaunchContext,
) -> Option<AgentTaskMissionScenarioProfileRecord> {
    let explicit_profile = explicit.and_then(|brief| brief.scenario_profile.clone());
    if explicit_profile.is_none()
        && auto_drive.is_none()
        && !has_workspace_evaluation_signals(context)
    {
        return None;
    }
    let auto_drive_profile = auto_drive.and_then(|state| state.scenario_profile.clone());
    let mut profile = explicit_profile.unwrap_or(AgentTaskMissionScenarioProfileRecord {
        authority_scope: None,
        authority_sources: None,
        representative_commands: None,
        component_commands: None,
        end_to_end_commands: None,
        sample_paths: None,
        held_out_guidance: None,
        source_signals: None,
        scenario_keys: None,
        safe_background: None,
    });
    let authority_scope = auto_drive_profile
        .as_ref()
        .and_then(|entry| entry.authority_scope.clone())
        .or_else(|| Some(default_auto_drive_context_scope(context).to_string()));
    if profile.authority_scope.is_none() {
        profile.authority_scope = authority_scope;
    }
    if profile.authority_sources.is_none() {
        profile.authority_sources = auto_drive_profile
            .as_ref()
            .and_then(|entry| entry.authority_sources.clone());
    }
    if profile.representative_commands.is_none() {
        profile.representative_commands = auto_drive_profile
            .as_ref()
            .and_then(|entry| entry.representative_commands.clone());
    }
    if profile.component_commands.is_none() {
        profile.component_commands = auto_drive_profile
            .as_ref()
            .and_then(|entry| entry.component_commands.clone());
    }
    if profile.end_to_end_commands.is_none() {
        profile.end_to_end_commands = auto_drive_profile
            .as_ref()
            .and_then(|entry| entry.end_to_end_commands.clone());
    }
    if profile.sample_paths.is_none() {
        profile.sample_paths = auto_drive_profile
            .as_ref()
            .and_then(|entry| entry.sample_paths.clone());
    }
    if profile.held_out_guidance.is_none() {
        profile.held_out_guidance = auto_drive_profile
            .as_ref()
            .and_then(|entry| entry.held_out_guidance.clone());
    }
    if profile.source_signals.is_none() {
        profile.source_signals = auto_drive_profile
            .as_ref()
            .and_then(|entry| entry.source_signals.clone());
    }
    if profile.scenario_keys.is_none() {
        profile.scenario_keys = auto_drive_profile
            .as_ref()
            .and_then(|entry| entry.scenario_keys.clone())
            .or_else(|| normalize_string_items(infer_auto_drive_scenario_keys(context)));
    }
    if profile.safe_background.is_none() {
        profile.safe_background = auto_drive_profile
            .as_ref()
            .and_then(|entry| entry.safe_background)
            .or(Some(false));
    }
    let has_values = profile.authority_scope.is_some()
        || profile.authority_sources.is_some()
        || profile.representative_commands.is_some()
        || profile.component_commands.is_some()
        || profile.end_to_end_commands.is_some()
        || profile.sample_paths.is_some()
        || profile.held_out_guidance.is_some()
        || profile.source_signals.is_some()
        || profile.scenario_keys.is_some()
        || profile.safe_background.is_some();
    has_values.then_some(profile)
}

fn default_auto_drive_context_scope(context: &WorkspaceLaunchContext) -> &'static str {
    if !context.peer_workspaces.is_empty() {
        "workspace_graph"
    } else {
        "active_workspace"
    }
}

fn build_default_auto_drive_workspace_read_paths(
    context: &WorkspaceLaunchContext,
) -> Option<Vec<String>> {
    let mut paths = Vec::new();
    if let Some(root) = read_optional_text(context.workspace_root_path.as_deref()) {
        push_unique(&mut paths, root.clone());
        for relative in context.repo_instruction_sources.iter() {
            push_unique(&mut paths, format!("{root}/{relative}"));
        }
        if context.has_readme {
            push_unique(&mut paths, format!("{root}/README.md"));
        }
        if context.has_repository_execution_contract {
            push_unique(
                &mut paths,
                format!("{root}/.hugecode/repository-execution-contract.json"),
            );
        }
    }
    for peer in context.peer_workspaces.iter().filter(|peer| peer.connected) {
        push_unique(&mut paths, peer.root_path.clone());
    }
    normalize_string_items(paths)
}

fn build_default_auto_drive_workspace_context_paths(
    context: &WorkspaceLaunchContext,
) -> Option<Vec<String>> {
    let mut paths = Vec::new();
    if let Some(root) = read_optional_text(context.workspace_root_path.as_deref()) {
        for relative in context.repo_instruction_sources.iter() {
            push_unique(&mut paths, format!("{root}/{relative}"));
        }
        if context.has_readme {
            push_unique(&mut paths, format!("{root}/README.md"));
        }
        if context.has_repository_execution_contract {
            push_unique(
                &mut paths,
                format!("{root}/.hugecode/repository-execution-contract.json"),
            );
        }
    }
    for peer in context
        .peer_workspaces
        .iter()
        .filter(|peer| peer.connected)
        .take(4)
    {
        push_unique(&mut paths, peer.root_path.clone());
    }
    normalize_string_items(paths)
}

fn build_default_auto_drive_authority_sources(
    auto_drive: &AgentTaskAutoDriveState,
    context: &WorkspaceLaunchContext,
) -> Option<Vec<String>> {
    let mut sources = Vec::new();
    if has_repo_instruction_sources(context)
        || context.has_readme
        || context.has_repository_execution_contract
    {
        push_unique(&mut sources, "repo_authority".to_string());
    }
    if !context.peer_workspaces.is_empty() {
        push_unique(&mut sources, "workspace_graph".to_string());
    }
    if auto_drive
        .risk_policy
        .as_ref()
        .and_then(|policy| policy.allow_network_analysis)
        .unwrap_or(false)
    {
        push_unique(&mut sources, "network_research".to_string());
    }
    normalize_string_items(sources)
}

pub(super) fn synthesize_auto_drive_context_policy(
    explicit: Option<AgentTaskAutoDriveContextPolicy>,
    auto_drive: &AgentTaskAutoDriveState,
    context: &WorkspaceLaunchContext,
) -> Option<AgentTaskAutoDriveContextPolicy> {
    let mut context_policy = explicit.unwrap_or(AgentTaskAutoDriveContextPolicy {
        scope: None,
        workspace_read_paths: None,
        workspace_context_paths: None,
        authority_sources: None,
    });
    if context_policy.scope.is_none() {
        context_policy.scope = Some(default_auto_drive_context_scope(context).to_string());
    }
    if context_policy.workspace_read_paths.is_none() {
        context_policy.workspace_read_paths =
            build_default_auto_drive_workspace_read_paths(context);
    }
    if context_policy.workspace_context_paths.is_none() {
        context_policy.workspace_context_paths =
            build_default_auto_drive_workspace_context_paths(context);
    }
    if context_policy.authority_sources.is_none() {
        context_policy.authority_sources =
            build_default_auto_drive_authority_sources(auto_drive, context);
    }
    let has_values = context_policy.scope.is_some()
        || context_policy.workspace_read_paths.is_some()
        || context_policy.workspace_context_paths.is_some()
        || context_policy.authority_sources.is_some();
    has_values.then_some(context_policy)
}

pub(super) fn synthesize_auto_drive_decision_policy(
    explicit: Option<AgentTaskAutoDriveDecisionPolicy>,
    auto_drive: &AgentTaskAutoDriveState,
    context: &WorkspaceLaunchContext,
) -> Option<AgentTaskAutoDriveDecisionPolicy> {
    let mut decision_policy = explicit.unwrap_or(AgentTaskAutoDriveDecisionPolicy {
        independent_thread: None,
        autonomy_priority: None,
        prompt_strategy: None,
        research_mode: None,
    });
    if decision_policy.independent_thread.is_none() {
        decision_policy.independent_thread = Some(true);
    }
    if decision_policy.autonomy_priority.is_none() {
        decision_policy.autonomy_priority = Some("operator".to_string());
    }
    if decision_policy.prompt_strategy.is_none() {
        decision_policy.prompt_strategy = Some(
            if !context.peer_workspaces.is_empty() {
                "workspace_graph_first"
            } else {
                "repo_truth_first"
            }
            .to_string(),
        );
    }
    if decision_policy.research_mode.is_none() {
        decision_policy.research_mode = Some(
            if auto_drive
                .risk_policy
                .as_ref()
                .and_then(|policy| policy.allow_network_analysis)
                .unwrap_or(false)
            {
                "live_when_allowed"
            } else {
                "repository_only"
            }
            .to_string(),
        );
    }
    let has_values = decision_policy.independent_thread.is_some()
        || decision_policy.autonomy_priority.is_some()
        || decision_policy.prompt_strategy.is_some()
        || decision_policy.research_mode.is_some();
    has_values.then_some(decision_policy)
}
