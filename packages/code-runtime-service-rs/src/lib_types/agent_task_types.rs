const MAX_AGENT_TASK_STEPS: usize = 64;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
enum AgentTaskStatus {
    Queued,
    Running,
    Paused,
    AwaitingApproval,
    Completed,
    Failed,
    Cancelled,
    Interrupted,
}

impl AgentTaskStatus {
    fn as_str(self) -> &'static str {
        match self {
            Self::Queued => "queued",
            Self::Running => "running",
            Self::Paused => "paused",
            Self::AwaitingApproval => "awaiting_approval",
            Self::Completed => "completed",
            Self::Failed => "failed",
            Self::Cancelled => "cancelled",
            Self::Interrupted => "interrupted",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
enum AgentTaskInterventionAction {
    Pause,
    Resume,
    Cancel,
    Retry,
    ContinueWithClarification,
    NarrowScope,
    RelaxValidation,
    ReplanScope,
    DropFeature,
    InsertFeature,
    ChangeValidationLane,
    ChangeBackendPreference,
    MarkBlockedWithReason,
    SwitchProfileAndRetry,
    EscalateToPairMode,
}

impl AgentTaskInterventionAction {
    fn as_str(self) -> &'static str {
        match self {
            Self::Pause => "pause",
            Self::Resume => "resume",
            Self::Cancel => "cancel",
            Self::Retry => "retry",
            Self::ContinueWithClarification => "continue_with_clarification",
            Self::NarrowScope => "narrow_scope",
            Self::RelaxValidation => "relax_validation",
            Self::ReplanScope => "replan_scope",
            Self::DropFeature => "drop_feature",
            Self::InsertFeature => "insert_feature",
            Self::ChangeValidationLane => "change_validation_lane",
            Self::ChangeBackendPreference => "change_backend_preference",
            Self::MarkBlockedWithReason => "mark_blocked_with_reason",
            Self::SwitchProfileAndRetry => "switch_profile_and_retry",
            Self::EscalateToPairMode => "escalate_to_pair_mode",
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentTaskAutoDriveDoneDefinition {
    #[serde(default)]
    arrival_criteria: Option<Vec<String>>,
    #[serde(default)]
    required_validation: Option<Vec<String>>,
    #[serde(default)]
    waypoint_indicators: Option<Vec<String>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentTaskAutoDriveDestination {
    title: String,
    desired_end_state: Vec<String>,
    #[serde(default)]
    done_definition: Option<AgentTaskAutoDriveDoneDefinition>,
    #[serde(default)]
    hard_boundaries: Option<Vec<String>>,
    #[serde(default)]
    route_preference: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentTaskAutoDriveBudget {
    #[serde(default)]
    max_tokens: Option<u64>,
    #[serde(default)]
    max_iterations: Option<u32>,
    #[serde(default)]
    max_duration_ms: Option<u64>,
    #[serde(default)]
    max_files_per_iteration: Option<u32>,
    #[serde(default)]
    max_no_progress_iterations: Option<u32>,
    #[serde(default)]
    max_validation_failures: Option<u32>,
    #[serde(default)]
    max_reroutes: Option<u32>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentTaskAutoDriveRiskPolicy {
    #[serde(default)]
    pause_on_destructive_change: Option<bool>,
    #[serde(default)]
    pause_on_dependency_change: Option<bool>,
    #[serde(default)]
    pause_on_low_confidence: Option<bool>,
    #[serde(default)]
    pause_on_human_checkpoint: Option<bool>,
    #[serde(default)]
    allow_network_analysis: Option<bool>,
    #[serde(default)]
    allow_validation_commands: Option<bool>,
    #[serde(default)]
    minimum_confidence: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentTaskAutoDriveContextPolicy {
    #[serde(default)]
    scope: Option<String>,
    #[serde(default)]
    workspace_read_paths: Option<Vec<String>>,
    #[serde(default)]
    workspace_context_paths: Option<Vec<String>>,
    #[serde(default)]
    authority_sources: Option<Vec<String>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentTaskAutoDriveDecisionPolicy {
    #[serde(default)]
    independent_thread: Option<bool>,
    #[serde(default)]
    autonomy_priority: Option<String>,
    #[serde(default)]
    prompt_strategy: Option<String>,
    #[serde(default)]
    research_mode: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentTaskAutoDriveDecisionScore {
    reason_code: String,
    label: String,
    delta: i32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentTaskAutoDriveScenarioProfile {
    #[serde(default)]
    authority_scope: Option<String>,
    #[serde(default)]
    authority_sources: Option<Vec<String>>,
    #[serde(default)]
    representative_commands: Option<Vec<String>>,
    #[serde(default)]
    component_commands: Option<Vec<String>>,
    #[serde(default)]
    end_to_end_commands: Option<Vec<String>>,
    #[serde(default)]
    sample_paths: Option<Vec<String>>,
    #[serde(default)]
    held_out_guidance: Option<Vec<String>>,
    #[serde(default)]
    source_signals: Option<Vec<String>>,
    #[serde(default)]
    scenario_keys: Option<Vec<String>>,
    #[serde(default)]
    safe_background: Option<bool>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentTaskAutoDriveDecisionTrace {
    #[serde(default)]
    phase: Option<String>,
    #[serde(default)]
    summary: Option<String>,
    #[serde(default)]
    selected_candidate_id: Option<String>,
    #[serde(default)]
    selected_candidate_summary: Option<String>,
    #[serde(default)]
    selection_tags: Option<Vec<String>>,
    #[serde(default)]
    score_breakdown: Option<Vec<AgentTaskAutoDriveDecisionScore>>,
    #[serde(default)]
    authority_sources: Option<Vec<String>>,
    #[serde(default)]
    representative_command: Option<String>,
    #[serde(default)]
    held_out_guidance: Option<Vec<String>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentTaskAutoDriveOutcomeFeedback {
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    summary: Option<String>,
    #[serde(default)]
    failure_class: Option<String>,
    #[serde(default)]
    validation_commands: Option<Vec<String>>,
    #[serde(default)]
    human_intervention_required: Option<bool>,
    #[serde(default)]
    held_out_preserved: Option<bool>,
    #[serde(default)]
    at: Option<u64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentTaskAutoDriveAutonomyState {
    #[serde(default)]
    independent_thread: Option<bool>,
    #[serde(default)]
    autonomy_priority: Option<String>,
    #[serde(default)]
    high_priority: Option<bool>,
    #[serde(default)]
    escalation_pressure: Option<String>,
    #[serde(default)]
    unattended_continuation_allowed: Option<bool>,
    #[serde(default)]
    background_safe: Option<bool>,
    #[serde(default)]
    human_intervention_hotspots: Option<Vec<String>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentTaskAutoDriveNavigation {
    #[serde(default)]
    active_waypoint: Option<String>,
    #[serde(default)]
    completed_waypoints: Option<Vec<String>>,
    #[serde(default)]
    pending_waypoints: Option<Vec<String>>,
    #[serde(default)]
    last_progress_at: Option<u64>,
    #[serde(default)]
    reroute_count: Option<u32>,
    #[serde(default)]
    validation_failure_count: Option<u32>,
    #[serde(default)]
    no_progress_iterations: Option<u32>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentTaskAutoDriveRecoveryMarker {
    #[serde(default)]
    recovered: Option<bool>,
    #[serde(default)]
    resume_ready: Option<bool>,
    #[serde(default)]
    checkpoint_id: Option<String>,
    #[serde(default)]
    trace_id: Option<String>,
    #[serde(default)]
    recovered_at: Option<u64>,
    #[serde(default)]
    summary: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentTaskAutoDriveStopState {
    reason: String,
    #[serde(default)]
    summary: Option<String>,
    #[serde(default)]
    at: Option<u64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentTaskAutoDriveState {
    #[serde(default)]
    enabled: Option<bool>,
    destination: AgentTaskAutoDriveDestination,
    #[serde(default)]
    budget: Option<AgentTaskAutoDriveBudget>,
    #[serde(default)]
    risk_policy: Option<AgentTaskAutoDriveRiskPolicy>,
    #[serde(default)]
    context_policy: Option<AgentTaskAutoDriveContextPolicy>,
    #[serde(default)]
    decision_policy: Option<AgentTaskAutoDriveDecisionPolicy>,
    #[serde(default)]
    scenario_profile: Option<AgentTaskAutoDriveScenarioProfile>,
    #[serde(default)]
    decision_trace: Option<AgentTaskAutoDriveDecisionTrace>,
    #[serde(default)]
    outcome_feedback: Option<AgentTaskAutoDriveOutcomeFeedback>,
    #[serde(default)]
    autonomy_state: Option<AgentTaskAutoDriveAutonomyState>,
    #[serde(default)]
    navigation: Option<AgentTaskAutoDriveNavigation>,
    #[serde(default)]
    recovery: Option<AgentTaskAutoDriveRecoveryMarker>,
    #[serde(default)]
    stop: Option<AgentTaskAutoDriveStopState>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
enum AgentStepKind {
    Read,
    Write,
    Edit,
    Bash,
    JsRepl,
    Diagnostics,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum AgentStepMutationKind {
    Read,
    Write,
    Edit,
    Bash,
    JsRepl,
}

impl AgentStepMutationKind {
    fn as_str(self) -> &'static str {
        match self {
            Self::Read => "read",
            Self::Write => "write",
            Self::Edit => "edit",
            Self::Bash => "bash",
            Self::JsRepl => "js_repl",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct AgentStepCapability {
    role: &'static str,
    skill_id: &'static str,
    default_requires_approval: bool,
    mutation_kind: AgentStepMutationKind,
    requires_read_evidence: bool,
    parallel_safe: bool,
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct AgentStepApprovalScope {
    kind: &'static str,
    key: String,
    target: String,
}

impl AgentStepKind {
    fn as_str(self) -> &'static str {
        match self {
            Self::Read => "read",
            Self::Write => "write",
            Self::Edit => "edit",
            Self::Bash => "bash",
            Self::JsRepl => "js_repl",
            Self::Diagnostics => "diagnostics",
        }
    }

    fn capability(self) -> AgentStepCapability {
        match self {
            Self::Read => AgentStepCapability {
                role: "planner",
                skill_id: "core-read",
                default_requires_approval: false,
                mutation_kind: AgentStepMutationKind::Read,
                requires_read_evidence: false,
                parallel_safe: true,
            },
            Self::Write => AgentStepCapability {
                role: "coder",
                skill_id: "core-write",
                default_requires_approval: true,
                mutation_kind: AgentStepMutationKind::Write,
                requires_read_evidence: true,
                parallel_safe: false,
            },
            Self::Edit => AgentStepCapability {
                role: "coder",
                skill_id: "core-edit",
                default_requires_approval: true,
                mutation_kind: AgentStepMutationKind::Edit,
                requires_read_evidence: true,
                parallel_safe: false,
            },
            Self::Bash => AgentStepCapability {
                role: "coder",
                skill_id: "core-bash",
                default_requires_approval: true,
                mutation_kind: AgentStepMutationKind::Bash,
                requires_read_evidence: false,
                parallel_safe: false,
            },
            Self::JsRepl => AgentStepCapability {
                role: "coder",
                skill_id: "core-js-repl",
                default_requires_approval: true,
                mutation_kind: AgentStepMutationKind::JsRepl,
                requires_read_evidence: false,
                parallel_safe: false,
            },
            Self::Diagnostics => AgentStepCapability {
                role: "verifier",
                skill_id: "core-diagnostics",
                default_requires_approval: false,
                mutation_kind: AgentStepMutationKind::Read,
                requires_read_evidence: false,
                parallel_safe: true,
            },
        }
    }

    fn role(self) -> &'static str {
        self.capability().role
    }

    fn default_requires_approval(self) -> bool {
        self.capability().default_requires_approval
    }

    fn skill_id(self) -> &'static str {
        self.capability().skill_id
    }

    fn mutation_kind(self) -> AgentStepMutationKind {
        self.capability().mutation_kind
    }

    fn requires_read_evidence(self) -> bool {
        self.capability().requires_read_evidence
    }

    fn parallel_safe(self) -> bool {
        self.capability().parallel_safe
    }

    fn approval_scope(
        self,
        workspace_id: Option<&str>,
        path: Option<&str>,
        command: Option<&str>,
        input: Option<&str>,
    ) -> Option<AgentStepApprovalScope> {
        match self {
            Self::Write | Self::Edit => {
                let normalized_path = path
                    .map(str::trim)
                    .filter(|value| !value.is_empty())?
                    .to_string();
                let normalized_workspace = workspace_id
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .unwrap_or("_global");
                Some(AgentStepApprovalScope {
                    kind: "file-target",
                    key: format!("workspace:{normalized_workspace}:file:{normalized_path}"),
                    target: normalized_path,
                })
            }
            Self::Bash => {
                let command_prefix = derive_safe_bash_approval_prefix(command)?;
                let normalized_workspace = workspace_id
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .unwrap_or("_global");
                Some(AgentStepApprovalScope {
                    kind: "command-prefix",
                    key: format!(
                        "workspace:{normalized_workspace}:command-prefix:{command_prefix}"
                    ),
                    target: command_prefix,
                })
            }
            Self::JsRepl => {
                let snippet = input
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .and_then(|value| value.lines().find(|line| !line.trim().is_empty()))
                    .map(str::trim)?
                    .chars()
                    .take(80)
                    .collect::<String>();
                let normalized_workspace = workspace_id
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .unwrap_or("_global");
                Some(AgentStepApprovalScope {
                    kind: "js-repl-snippet",
                    key: format!("workspace:{normalized_workspace}:js-repl:{snippet}"),
                    target: snippet,
                })
            }
            Self::Read | Self::Diagnostics => None,
        }
    }
}

fn normalize_command_tokens(command: Option<&str>) -> Vec<String> {
    command
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| {
            value
                .split_whitespace()
                .map(|entry| entry.to_ascii_lowercase())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

fn derive_safe_bash_approval_prefix(command: Option<&str>) -> Option<String> {
    let tokens = normalize_command_tokens(command);
    match tokens.as_slice() {
        [single] if matches!(single.as_str(), "pwd" | "whoami" | "date" | "env") => {
            Some(single.clone())
        }
        [command, ..]
            if matches!(
                command.as_str(),
                "ls" | "uname"
                    | "cat"
                    | "head"
                    | "tail"
                    | "wc"
                    | "grep"
                    | "rg"
                    | "stat"
                    | "du"
                    | "file"
                    | "which"
                    | "echo"
            ) =>
        {
            Some(command.clone())
        }
        [git, subcommand, ..]
            if git == "git"
                && matches!(
                    subcommand.as_str(),
                    "status" | "branch" | "diff" | "log" | "show" | "rev-parse" | "ls-files"
                ) =>
        {
            Some(format!("{git} {subcommand}"))
        }
        _ => None,
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct AgentTaskStepInput {
    kind: AgentStepKind,
    #[serde(default)]
    input: Option<String>,
    #[serde(default)]
    path: Option<String>,
    #[serde(default)]
    paths: Option<Vec<String>>,
    #[serde(default)]
    content: Option<String>,
    #[serde(default)]
    find: Option<String>,
    #[serde(default)]
    replace: Option<String>,
    #[serde(default)]
    command: Option<String>,
    #[serde(default)]
    severities: Option<Vec<crate::workspace_diagnostics::WorkspaceDiagnosticSeverity>>,
    #[serde(default)]
    max_items: Option<u64>,
    #[serde(default)]
    timeout_ms: Option<u64>,
    #[serde(default)]
    requires_approval: Option<bool>,
    #[serde(default)]
    approval_reason: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct AgentTaskPermissionSummary {
    #[serde(default)]
    access_mode: Option<String>,
    #[serde(default)]
    allow_network: Option<bool>,
    #[serde(default)]
    writable_roots: Option<Vec<String>>,
    #[serde(default)]
    tool_names: Option<Vec<String>>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct AgentTaskMissionEvaluationPlan {
    #[serde(default)]
    representative_commands: Option<Vec<String>>,
    #[serde(default)]
    component_commands: Option<Vec<String>>,
    #[serde(default)]
    end_to_end_commands: Option<Vec<String>>,
    #[serde(default)]
    sample_paths: Option<Vec<String>>,
    #[serde(default)]
    held_out_guidance: Option<Vec<String>>,
    #[serde(default)]
    source_signals: Option<Vec<String>>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct AgentTaskMissionScenarioProfile {
    #[serde(default)]
    authority_scope: Option<String>,
    #[serde(default)]
    authority_sources: Option<Vec<String>>,
    #[serde(default)]
    representative_commands: Option<Vec<String>>,
    #[serde(default)]
    component_commands: Option<Vec<String>>,
    #[serde(default)]
    end_to_end_commands: Option<Vec<String>>,
    #[serde(default)]
    sample_paths: Option<Vec<String>>,
    #[serde(default)]
    held_out_guidance: Option<Vec<String>>,
    #[serde(default)]
    source_signals: Option<Vec<String>>,
    #[serde(default)]
    scenario_keys: Option<Vec<String>>,
    #[serde(default)]
    safe_background: Option<bool>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct AgentTaskMissionBrief {
    objective: String,
    #[serde(default)]
    done_definition: Option<Vec<String>>,
    #[serde(default)]
    constraints: Option<Vec<String>>,
    #[serde(default)]
    risk_level: Option<String>,
    #[serde(default)]
    required_capabilities: Option<Vec<String>>,
    #[serde(default)]
    max_subtasks: Option<u32>,
    #[serde(default)]
    preferred_backend_ids: Option<Vec<String>>,
    #[serde(default)]
    permission_summary: Option<AgentTaskPermissionSummary>,
    #[serde(default)]
    evaluation_plan: Option<AgentTaskMissionEvaluationPlan>,
    #[serde(default)]
    scenario_profile: Option<AgentTaskMissionScenarioProfile>,
    #[serde(default)]
    plan_version: Option<String>,
    #[serde(default)]
    plan_summary: Option<String>,
    #[serde(default)]
    current_milestone_id: Option<String>,
    #[serde(default)]
    estimated_duration_minutes: Option<u32>,
    #[serde(default)]
    estimated_worker_runs: Option<u32>,
    #[serde(default)]
    parallelism_hint: Option<String>,
    #[serde(default)]
    clarification_questions: Option<Vec<String>>,
    #[serde(default)]
    milestones: Option<Vec<AgentTaskMissionPlanMilestone>>,
    #[serde(default)]
    validation_lanes: Option<Vec<AgentTaskMissionValidationLane>>,
    #[serde(default)]
    skill_plan: Option<Vec<AgentTaskMissionSkillPlanItem>>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct AgentTaskRelaunchContext {
    #[serde(default)]
    source_task_id: Option<String>,
    #[serde(default)]
    source_run_id: Option<String>,
    #[serde(default)]
    source_review_pack_id: Option<String>,
    #[serde(default)]
    source_plan_version: Option<String>,
    #[serde(default)]
    summary: Option<String>,
    #[serde(default)]
    failure_class: Option<String>,
    #[serde(default)]
    recommended_actions: Option<Vec<String>>,
    #[serde(default)]
    plan_change_summary: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct AgentTaskSourceRepoContext {
    #[serde(default)]
    owner: Option<String>,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    full_name: Option<String>,
    #[serde(default)]
    remote_url: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct AgentTaskSourceSummary {
    kind: String,
    #[serde(default)]
    label: Option<String>,
    #[serde(default)]
    short_label: Option<String>,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    reference: Option<String>,
    #[serde(default)]
    url: Option<String>,
    #[serde(default)]
    issue_number: Option<u64>,
    #[serde(default)]
    pull_request_number: Option<u64>,
    #[serde(default)]
    repo: Option<AgentTaskSourceRepoContext>,
    #[serde(default)]
    workspace_id: Option<String>,
    #[serde(default)]
    workspace_root: Option<String>,
    #[serde(default)]
    external_id: Option<String>,
    #[serde(default)]
    canonical_url: Option<String>,
    #[serde(default)]
    thread_id: Option<String>,
    #[serde(default)]
    request_id: Option<String>,
    #[serde(default)]
    source_task_id: Option<String>,
    #[serde(default)]
    source_run_id: Option<String>,
    #[serde(default)]
    github_source: Option<AgentTaskSourceGitHubProvenance>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct AgentTaskStartRequest {
    workspace_id: String,
    #[serde(default)]
    thread_id: Option<String>,
    #[serde(default)]
    request_id: Option<String>,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    task_source: Option<AgentTaskSourceSummary>,
    #[serde(default)]
    execution_profile_id: Option<String>,
    #[serde(default)]
    review_profile_id: Option<String>,
    #[serde(default)]
    validation_preset_id: Option<String>,
    #[serde(default)]
    provider: Option<String>,
    #[serde(default)]
    model_id: Option<String>,
    #[serde(default)]
    reason_effort: Option<String>,
    #[serde(default)]
    access_mode: Option<String>,
    #[serde(default)]
    agent_profile: Option<String>,
    #[serde(default)]
    execution_mode: Option<String>,
    #[serde(default)]
    required_capabilities: Option<Vec<String>>,
    #[serde(default)]
    preferred_backend_ids: Option<Vec<String>>,
    #[serde(default)]
    default_backend_id: Option<String>,
    #[serde(default)]
    mission_brief: Option<AgentTaskMissionBrief>,
    #[serde(default)]
    relaunch_context: Option<AgentTaskRelaunchContext>,
    #[serde(default)]
    approved_plan_version: Option<String>,
    #[serde(default)]
    auto_drive: Option<AgentTaskAutoDriveState>,
    #[serde(default)]
    autonomy_request: Option<Value>,
    steps: Vec<AgentTaskStepInput>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct AgentTaskInterventionRequest {
    task_id: String,
    action: AgentTaskInterventionAction,
    #[serde(default)]
    reason: Option<String>,
    #[serde(default)]
    instruction_patch: Option<String>,
    #[serde(default)]
    execution_profile_id: Option<String>,
    #[serde(default)]
    preferred_backend_ids: Option<Vec<String>>,
    #[serde(default)]
    relaunch_context: Option<AgentTaskRelaunchContext>,
    #[serde(default)]
    approved_plan_version: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentTaskInterruptRequest {
    #[serde(alias = "task_id")]
    task_id: String,
    #[serde(default)]
    reason: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentTaskStatusRequest {
    #[serde(alias = "task_id")]
    task_id: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentTaskListRequest {
    #[serde(default, alias = "workspace_id")]
    workspace_id: Option<String>,
    #[serde(default)]
    status: Option<AgentTaskStatus>,
    #[serde(default)]
    limit: Option<u64>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
enum AgentApprovalDecision {
    Approved,
    Rejected,
}

impl AgentApprovalDecision {
    fn as_str(self) -> &'static str {
        match self {
            Self::Approved => "approved",
            Self::Rejected => "rejected",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum AgentApprovalWaitOutcome {
    Approved,
    Rejected,
    Interrupted,
    TimedOut,
    Error,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentApprovalDecisionRequest {
    #[serde(alias = "approval_id")]
    approval_id: String,
    decision: AgentApprovalDecision,
    #[serde(default)]
    reason: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentTaskStepSummary {
    index: usize,
    kind: String,
    role: String,
    status: String,
    message: String,
    run_id: Option<String>,
    output: Option<String>,
    metadata: Value,
    started_at: Option<u64>,
    updated_at: u64,
    completed_at: Option<u64>,
    error_code: Option<String>,
    error_message: Option<String>,
    approval_id: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PendingApprovalSummary {
    approval_id: String,
    step_index: usize,
    action: String,
    reason: String,
    input: Value,
    created_at: u64,
    decision: Option<String>,
    decision_reason: Option<String>,
    decided_at: Option<u64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReviewDecisionSummary {
    status: String,
    review_pack_id: String,
    label: String,
    summary: String,
    decided_at: Option<u64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentTaskPermissionSummaryRecord {
    #[serde(skip_serializing_if = "Option::is_none")]
    access_mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    allow_network: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    writable_roots: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool_names: Option<Vec<String>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentTaskMissionBriefRecord {
    objective: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    done_definition: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    constraints: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    risk_level: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    required_capabilities: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_subtasks: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    preferred_backend_ids: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    permission_summary: Option<AgentTaskPermissionSummaryRecord>,
    #[serde(skip_serializing_if = "Option::is_none")]
    evaluation_plan: Option<AgentTaskMissionEvaluationPlanRecord>,
    #[serde(skip_serializing_if = "Option::is_none")]
    scenario_profile: Option<AgentTaskMissionScenarioProfileRecord>,
    #[serde(skip_serializing_if = "Option::is_none")]
    plan_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    plan_summary: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    current_milestone_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    estimated_duration_minutes: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    estimated_worker_runs: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    parallelism_hint: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    clarification_questions: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    milestones: Option<Vec<AgentTaskMissionPlanMilestoneRecord>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    validation_lanes: Option<Vec<AgentTaskMissionValidationLaneRecord>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    skill_plan: Option<Vec<AgentTaskMissionSkillPlanItemRecord>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentTaskMissionEvaluationPlanRecord {
    #[serde(skip_serializing_if = "Option::is_none")]
    representative_commands: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    component_commands: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    end_to_end_commands: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    sample_paths: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    held_out_guidance: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    source_signals: Option<Vec<String>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentTaskMissionScenarioProfileRecord {
    #[serde(skip_serializing_if = "Option::is_none")]
    authority_scope: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    authority_sources: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    representative_commands: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    component_commands: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    end_to_end_commands: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    sample_paths: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    held_out_guidance: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    source_signals: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    scenario_keys: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    safe_background: Option<bool>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentTaskRelaunchContextRecord {
    #[serde(skip_serializing_if = "Option::is_none")]
    source_task_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    source_run_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    source_review_pack_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    source_plan_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    summary: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    failure_class: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    recommended_actions: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    plan_change_summary: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentTaskSummary {
    task_id: String,
    workspace_id: String,
    thread_id: Option<String>,
    request_id: Option<String>,
    title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    task_source: Option<AgentTaskSourceSummary>,
    status: String,
    access_mode: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    execution_profile_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    review_profile_id: Option<String>,
    agent_profile: String,
    provider: Option<String>,
    model_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    reason_effort: Option<String>,
    routed_provider: Option<String>,
    routed_model_id: Option<String>,
    routed_pool: Option<String>,
    routed_source: Option<String>,
    current_step: Option<usize>,
    created_at: u64,
    updated_at: u64,
    started_at: Option<u64>,
    completed_at: Option<u64>,
    error_code: Option<String>,
    error_message: Option<String>,
    pending_approval_id: Option<String>,
    pending_approval: Option<PendingApprovalSummary>,
    #[serde(default, alias = "validation_preset_id")]
    validation_preset_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    review_decision: Option<ReviewDecisionSummary>,
    #[serde(skip_serializing_if = "Option::is_none")]
    mission_brief: Option<AgentTaskMissionBriefRecord>,
    #[serde(skip_serializing_if = "Option::is_none")]
    relaunch_context: Option<AgentTaskRelaunchContextRecord>,
    #[serde(skip_serializing_if = "Option::is_none")]
    auto_drive: Option<AgentTaskAutoDriveState>,
    #[serde(skip_serializing_if = "Option::is_none")]
    backend_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    acp_integration_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    acp_session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    acp_config_options: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    acp_available_commands: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    preferred_backend_ids: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    placement_fallback_reason_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    resume_backend_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    placement_score_breakdown: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    root_task_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    parent_task_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    child_task_ids: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    distributed_status: Option<String>,
    steps: Vec<AgentTaskStepSummary>,
}

#[derive(Clone, Debug)]
struct AgentTaskRuntime {
    summary: AgentTaskSummary,
    steps_input: Vec<AgentTaskStepInput>,
    interrupt_requested: bool,
    checkpoint_id: Option<String>,
    review_actionability: Option<Value>,
    execution_graph: Option<RuntimeExecutionGraphSummary>,
    takeover_bundle: Option<Value>,
    recovered: bool,
    last_tool_signature: Option<String>,
    consecutive_tool_signature_count: u32,
    interrupt_waiter: Arc<Notify>,
    approval_waiter: Arc<Notify>,
}

#[derive(Default)]
struct AgentTaskStore {
    tasks: HashMap<String, AgentTaskRuntime>,
    order: VecDeque<String>,
    approval_index: HashMap<String, String>,
}
