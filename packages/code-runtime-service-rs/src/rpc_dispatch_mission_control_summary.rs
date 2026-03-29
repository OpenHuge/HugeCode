use super::*;

#[derive(Clone, Debug)]
pub(super) struct MissionControlProjectionState {
    pub(super) generated_at: u64,
    pub(super) workspaces: Vec<MissionWorkspaceProjection>,
    pub(super) tasks: Vec<MissionTaskProjection>,
    pub(super) runs: Vec<MissionRunProjection>,
    pub(super) review_packs: Vec<MissionReviewPackProjection>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct MissionControlReadinessSummaryProjection {
    pub(super) tone: String,
    pub(super) label: String,
    pub(super) detail: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MissionActivityItemProjection {
    id: String,
    title: String,
    workspace_name: String,
    status_label: String,
    tone: String,
    detail: String,
    highlights: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReviewQueueItemProjection {
    id: String,
    title: String,
    workspace_name: String,
    summary: String,
    review_status_label: String,
    validation_label: String,
    tone: String,
    warning_count: usize,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MissionControlSummaryProjection {
    workspace_label: String,
    tasks_count: usize,
    runs_count: usize,
    approval_count: usize,
    review_packs_count: usize,
    connected_workspace_count: usize,
    launch_readiness: MissionControlReadinessSummaryProjection,
    continuity_readiness: MissionControlReadinessSummaryProjection,
    mission_items: Vec<MissionActivityItemProjection>,
    review_items: Vec<ReviewQueueItemProjection>,
}

#[derive(Default)]
struct ContinuitySignalCounts {
    ready_resume_count: usize,
    ready_handoff_count: usize,
    ready_review_count: usize,
    review_blocked_count: usize,
    missing_path_count: usize,
    attention_count: usize,
    blocked_count: usize,
}

fn json_string_field<'a>(value: &'a Option<Value>, key: &str) -> Option<&'a str> {
    value
        .as_ref()?
        .get(key)?
        .as_str()
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
}

fn json_bool_field(value: &Option<Value>, key: &str) -> bool {
    value
        .as_ref()
        .and_then(|entry| entry.get(key))
        .and_then(Value::as_bool)
        .unwrap_or(false)
}

fn json_has_non_null_field(value: &Option<Value>, key: &str) -> bool {
    value
        .as_ref()
        .and_then(|entry| entry.get(key))
        .is_some_and(|entry| !entry.is_null())
}

fn pluralize(count: usize, singular: &str, plural: Option<&str>) -> String {
    let label = if count == 1 {
        singular.to_string()
    } else {
        plural
            .map(ToOwned::to_owned)
            .unwrap_or_else(|| format!("{singular}s"))
    };
    format!("{count} {label}")
}

fn empty_launch_readiness() -> MissionControlReadinessSummaryProjection {
    MissionControlReadinessSummaryProjection {
        tone: "idle".to_string(),
        label: "Launch readiness".to_string(),
        detail: "Select a workspace to inspect runtime launch readiness.".to_string(),
    }
}

fn empty_continuity_readiness() -> MissionControlReadinessSummaryProjection {
    MissionControlReadinessSummaryProjection {
        tone: "idle".to_string(),
        label: "Continuity readiness".to_string(),
        detail: "Checkpoint and review continuity signals appear once runs are available."
            .to_string(),
    }
}

fn has_recovery_path(run: &MissionRunProjection) -> bool {
    run.publish_handoff.is_some() || json_has_non_null_field(&run.mission_linkage, "navigationTarget")
}

fn quantify_continuity_statement(
    count: usize,
    singular_subject: &str,
    plural_subject: &str,
    singular_predicate: &str,
    plural_predicate: &str,
) -> String {
    if count == 1 {
        format!("1 {singular_subject} {singular_predicate}")
    } else {
        format!("{count} {plural_subject} {plural_predicate}")
    }
}

fn analyze_run_continuity_signal(run: &MissionRunProjection) -> Option<&'static str> {
    if let Some(takeover_bundle) = run.takeover_bundle.as_ref() {
        let state = takeover_bundle.get("state").and_then(Value::as_str);
        let path_kind = takeover_bundle.get("pathKind").and_then(Value::as_str);
        if state == Some("blocked") {
            return Some("blocked");
        }
        if state == Some("ready") && path_kind == Some("resume") {
            return Some("ready_resume");
        }
        if state == Some("ready") && path_kind == Some("handoff") {
            return Some("ready_handoff");
        }
        if state == Some("ready") && path_kind == Some("review") {
            return Some("ready_review");
        }
        return Some("attention");
    }

    if let Some(continuation) = run.continuation.as_ref() {
        let state = continuation.get("state").and_then(Value::as_str);
        let path_kind = continuation.get("pathKind").and_then(Value::as_str);
        if state == Some("blocked") {
            return Some("blocked");
        }
        if state == Some("ready") && path_kind == Some("resume") {
            return Some("ready_resume");
        }
        if state == Some("ready") && path_kind == Some("handoff") {
            return Some("ready_handoff");
        }
        if state == Some("ready") && path_kind == Some("review") {
            return Some("ready_review");
        }
        if state == Some("attention") || state == Some("ready") {
            return Some("attention_missing");
        }
    }

    match json_string_field(&run.review_actionability, "state") {
        Some("blocked") => return Some("blocked"),
        Some("ready") => return Some("ready_review"),
        Some("degraded") => return Some("attention"),
        _ => {}
    }
    if json_bool_field(&run.checkpoint, "resumeReady") {
        return Some("ready_resume");
    }
    if has_recovery_path(run) {
        return Some("ready_handoff");
    }
    if run.state == "review_ready" {
        return Some("attention_missing");
    }
    if run.checkpoint.is_some() || run.mission_linkage.is_some() || run.publish_handoff.is_some() {
        if json_bool_field(&run.checkpoint, "recovered")
            || run.state == "paused"
            || run.state == "needs_input"
        {
            return Some("blocked_missing");
        }
        return Some("attention");
    }
    None
}

fn count_continuity_signals(runs: &[MissionRunProjection]) -> ContinuitySignalCounts {
    let mut counts = ContinuitySignalCounts::default();
    for run in runs {
        match analyze_run_continuity_signal(run) {
            Some("ready_resume") => counts.ready_resume_count += 1,
            Some("ready_handoff") => counts.ready_handoff_count += 1,
            Some("ready_review") => counts.ready_review_count += 1,
            Some("blocked_missing") => {
                counts.blocked_count += 1;
                counts.missing_path_count += 1;
            }
            Some("attention_missing") => {
                counts.attention_count += 1;
                counts.missing_path_count += 1;
            }
            Some("attention") => counts.attention_count += 1,
            Some("blocked") => {
                counts.blocked_count += 1;
                counts.review_blocked_count += 1;
            }
            _ => {}
        }
    }
    counts
}

fn build_launch_readiness(
    has_active_workspace: bool,
    active_workspace_connected: bool,
    runs: &[MissionRunProjection],
) -> MissionControlReadinessSummaryProjection {
    if !has_active_workspace {
        return empty_launch_readiness();
    }
    if !active_workspace_connected {
        return MissionControlReadinessSummaryProjection {
            tone: "blocked".to_string(),
            label: "Launch readiness".to_string(),
            detail: "The selected workspace is not connected to the runtime.".to_string(),
        };
    }
    if runs.is_empty() {
        return MissionControlReadinessSummaryProjection {
            tone: "attention".to_string(),
            label: "Launch readiness".to_string(),
            detail:
                "The workspace is connected, but no runtime runs have reported placement yet."
                    .to_string(),
        };
    }
    let blocked_runs = runs
        .iter()
        .filter(|run| {
            json_string_field(&run.placement, "healthSummary") == Some("placement_blocked")
                || json_string_field(&run.routing, "health") == Some("blocked")
                || run
                    .routing
                    .as_ref()
                    .and_then(|routing| routing.get("backendOperability"))
                    .and_then(|operability| operability.get("state"))
                    .and_then(Value::as_str)
                    == Some("blocked")
        })
        .collect::<Vec<_>>();
    let blocked_count = blocked_runs.len();
    if blocked_count > 0 {
        let first_detail = blocked_runs
            .first()
            .and_then(|run| {
                json_string_field(&run.placement, "summary")
                    .or_else(|| json_string_field(&run.routing, "routeHint"))
                    .or_else(|| run.summary.as_deref().map(str::trim).filter(|value| !value.is_empty()))
            })
            .unwrap_or("Runtime placement is blocked.");
        return MissionControlReadinessSummaryProjection {
            tone: "blocked".to_string(),
            label: "Launch readiness".to_string(),
            detail: format!(
                "{} are blocked by routing or backend operability. First: {}",
                pluralize(blocked_count, "run", None),
                first_detail
            ),
        };
    }
    let attention_runs = runs
        .iter()
        .filter(|run| {
            json_string_field(&run.placement, "lifecycleState") == Some("fallback")
                || json_string_field(&run.placement, "healthSummary") == Some("placement_attention")
                || json_string_field(&run.routing, "health") == Some("attention")
                || run
                    .routing
                    .as_ref()
                    .and_then(|routing| routing.get("backendOperability"))
                    .and_then(|operability| operability.get("state"))
                    .and_then(Value::as_str)
                    == Some("attention")
        })
        .collect::<Vec<_>>();
    let attention_count = attention_runs.len();
    if attention_count > 0 {
        let first_detail = attention_runs
            .first()
            .and_then(|run| {
                json_string_field(&run.placement, "summary")
                    .or_else(|| json_string_field(&run.routing, "routeHint"))
                    .or_else(|| run.summary.as_deref().map(str::trim).filter(|value| !value.is_empty()))
            })
            .unwrap_or("Runtime placement needs operator inspection.");
        return MissionControlReadinessSummaryProjection {
            tone: "attention".to_string(),
            label: "Launch readiness".to_string(),
            detail: format!(
                "{} need routing review before the next launch. First: {}",
                pluralize(attention_count, "run", None),
                first_detail
            ),
        };
    }
    MissionControlReadinessSummaryProjection {
        tone: "ready".to_string(),
        label: "Launch readiness".to_string(),
        detail:
            "Connected routing and backend operability are healthy for the current workspace slice."
                .to_string(),
    }
}

pub(super) fn build_continuity_readiness(
    has_active_workspace: bool,
    active_workspace_connected: bool,
    runs: &[MissionRunProjection],
    _review_packs: &[MissionReviewPackProjection],
) -> MissionControlReadinessSummaryProjection {
    if !has_active_workspace {
        return empty_continuity_readiness();
    }
    if !active_workspace_connected {
        return MissionControlReadinessSummaryProjection {
            tone: "blocked".to_string(),
            label: "Continuity readiness".to_string(),
            detail:
                "The selected workspace must connect before checkpoint or review continuity can recover."
                    .to_string(),
        };
    }

    let counts = count_continuity_signals(runs);
    let has_continuity_truth = counts.ready_resume_count
        + counts.ready_handoff_count
        + counts.ready_review_count
        + counts.review_blocked_count
        + counts.missing_path_count
        + counts.attention_count
        > 0;
    let tone = if counts.blocked_count > 0 {
        "blocked"
    } else if !has_continuity_truth || counts.attention_count > 0 || counts.missing_path_count > 0 {
        "attention"
    } else {
        "ready"
    };
    let mut detail_parts = Vec::new();
    if counts.ready_resume_count > 0 {
        detail_parts.push(format!(
            "{} can safely continue",
            pluralize(counts.ready_resume_count, "run", None)
        ));
    }
    if counts.ready_handoff_count > 0 {
        detail_parts.push(format!(
            "{} ready",
            pluralize(counts.ready_handoff_count, "handoff path", None)
        ));
    }
    if counts.ready_review_count > 0 {
        detail_parts.push(format!(
            "{} actionable",
            pluralize(counts.ready_review_count, "review follow-up", None)
        ));
    }
    if counts.review_blocked_count > 0 {
        detail_parts.push(format!(
            "{} blocked",
            pluralize(counts.review_blocked_count, "review follow-up", None)
        ));
    }
    if counts.missing_path_count > 0 {
        detail_parts.push(quantify_continuity_statement(
            counts.missing_path_count,
            "run",
            "runs",
            "is missing a canonical continue path",
            "are missing a canonical continue path",
        ));
    }
    if counts.attention_count > 0 && counts.review_blocked_count == 0 && counts.missing_path_count == 0 {
        detail_parts.push(quantify_continuity_statement(
            counts.attention_count,
            "run",
            "runs",
            "needs continuity attention",
            "need continuity attention",
        ));
    }

    if !detail_parts.is_empty() {
        return MissionControlReadinessSummaryProjection {
            tone: tone.to_string(),
            label: "Continuity readiness".to_string(),
            detail: detail_parts.join("; "),
        };
    }

    MissionControlReadinessSummaryProjection {
        tone: "attention".to_string(),
        label: "Continuity readiness".to_string(),
        detail:
            "No runtime-published checkpoint, handoff, or review follow-up truth is available yet."
                .to_string(),
    }
}

fn workspace_name(workspaces: &[MissionWorkspaceProjection], workspace_id: &str) -> String {
    workspaces
        .iter()
        .find(|workspace| workspace.id == workspace_id)
        .map(|workspace| workspace.name.clone())
        .unwrap_or_else(|| workspace_id.to_string())
}

fn mission_item_tone(run: &MissionRunProjection) -> String {
    if json_string_field(&run.approval, "status") == Some("pending_decision")
        || run.state == "needs_input"
    {
        return "attention".to_string();
    }
    if json_string_field(&run.placement, "readiness") == Some("blocked") {
        return "blocked".to_string();
    }
    if run.state == "running" {
        return "active".to_string();
    }
    if run.review_pack_id.is_some() {
        return "ready".to_string();
    }
    "neutral".to_string()
}

fn mission_status_label(run: &MissionRunProjection) -> String {
    if let Some(label) = json_string_field(&run.approval, "label") {
        return label.to_string();
    }
    match run.state.as_str() {
        "running" => "In progress".to_string(),
        "needs_input" => "Needs input".to_string(),
        _ if run.review_pack_id.is_some() => "Review ready".to_string(),
        _ => run.state.replace('_', " "),
    }
}

fn build_mission_activity_items(
    workspaces: &[MissionWorkspaceProjection],
    runs: &[MissionRunProjection],
) -> Vec<MissionActivityItemProjection> {
    let mut sorted_runs = runs.to_vec();
    sorted_runs.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
    sorted_runs
        .into_iter()
        .take(6)
        .map(|run| MissionActivityItemProjection {
            id: run.id.clone(),
            title: trim_to_option(run.title.as_deref())
                .unwrap_or_else(|| "Untitled run".to_string()),
            workspace_name: workspace_name(workspaces, run.workspace_id.as_str()),
            status_label: mission_status_label(&run),
            tone: mission_item_tone(&run),
            detail: trim_to_option(run.summary.as_deref())
                .or_else(|| json_string_field(&run.approval, "summary").map(ToOwned::to_owned))
                .or_else(|| json_string_field(&run.placement, "summary").map(ToOwned::to_owned))
                .unwrap_or_else(|| {
                    "Runtime-backed mission status is available for this run.".to_string()
                }),
            highlights: [
                json_string_field(&run.checkpoint, "summary").map(ToOwned::to_owned),
                json_string_field(&run.publish_handoff, "summary").map(ToOwned::to_owned),
                json_string_field(&run.review_actionability, "summary").map(ToOwned::to_owned),
            ]
            .into_iter()
            .flatten()
            .collect::<Vec<_>>(),
        })
        .collect()
}

fn format_review_status_label(review_status: &str) -> String {
    if review_status == "ready" {
        "Ready".to_string()
    } else {
        review_status.replace('_', " ")
    }
}

fn format_validation_label(validation_outcome: &str) -> String {
    match validation_outcome {
        "passed" => "Passed".to_string(),
        "failed" => "Failed".to_string(),
        _ => validation_outcome.replace('_', " "),
    }
}

fn review_item_tone(review_status: &str, validation_outcome: &str) -> String {
    if validation_outcome == "failed" {
        return "blocked".to_string();
    }
    if review_status == "ready" {
        return "ready".to_string();
    }
    if review_status == "needs_input" || validation_outcome == "warning" {
        return "attention".to_string();
    }
    "neutral".to_string()
}

fn build_review_queue_items(
    workspaces: &[MissionWorkspaceProjection],
    review_packs: &[MissionReviewPackProjection],
) -> Vec<ReviewQueueItemProjection> {
    let mut sorted_review_packs = review_packs.to_vec();
    sorted_review_packs.sort_by(|left, right| right.created_at.cmp(&left.created_at));
    sorted_review_packs
        .into_iter()
        .take(6)
        .map(|review_pack| ReviewQueueItemProjection {
            id: review_pack.id.clone(),
            title: review_pack.summary.clone(),
            workspace_name: workspace_name(workspaces, review_pack.workspace_id.as_str()),
            summary: review_pack
                .recommended_next_action
                .clone()
                .unwrap_or_else(|| review_pack.summary.clone()),
            review_status_label: format_review_status_label(review_pack.review_status.as_str()),
            validation_label: format_validation_label(review_pack.validation_outcome.as_str()),
            tone: review_item_tone(
                review_pack.review_status.as_str(),
                review_pack.validation_outcome.as_str(),
            ),
            warning_count: review_pack.warning_count,
        })
        .collect()
}

fn build_mission_control_summary_projection(
    projection: &MissionControlProjectionState,
    active_workspace_id: Option<&str>,
) -> MissionControlSummaryProjection {
    let connected_workspace_count = projection
        .workspaces
        .iter()
        .filter(|workspace| workspace.connected)
        .count();
    let active_workspace = active_workspace_id.and_then(|workspace_id| {
        projection
            .workspaces
            .iter()
            .find(|workspace| workspace.id == workspace_id)
    });
    let has_active_workspace = active_workspace_id.is_some();

    let scoped_tasks = projection
        .tasks
        .iter()
        .filter(|task| active_workspace_id.is_none_or(|workspace_id| task.workspace_id == workspace_id))
        .cloned()
        .collect::<Vec<_>>();
    let scoped_runs = projection
        .runs
        .iter()
        .filter(|run| active_workspace_id.is_none_or(|workspace_id| run.workspace_id == workspace_id))
        .cloned()
        .collect::<Vec<_>>();
    let scoped_review_packs = projection
        .review_packs
        .iter()
        .filter(|review_pack| {
            active_workspace_id.is_none_or(|workspace_id| review_pack.workspace_id == workspace_id)
        })
        .cloned()
        .collect::<Vec<_>>();
    let approval_count = scoped_runs
        .iter()
        .filter(|run| {
            json_string_field(&run.approval, "status") == Some("pending_decision")
                || run.state == "needs_input"
        })
        .count();
    let workspace_label = if let Some(workspace) = active_workspace {
        workspace.name.clone()
    } else if has_active_workspace {
        "Selected workspace".to_string()
    } else {
        format!(
            "{}/{} connected workspaces",
            connected_workspace_count,
            projection.workspaces.len()
        )
    };

    MissionControlSummaryProjection {
        workspace_label,
        tasks_count: scoped_tasks.len(),
        runs_count: scoped_runs.len(),
        approval_count,
        review_packs_count: scoped_review_packs.len(),
        connected_workspace_count,
        launch_readiness: build_launch_readiness(
            has_active_workspace,
            active_workspace.is_some_and(|workspace| workspace.connected),
            scoped_runs.as_slice(),
        ),
        continuity_readiness: build_continuity_readiness(
            has_active_workspace,
            active_workspace.is_some_and(|workspace| workspace.connected),
            scoped_runs.as_slice(),
            scoped_review_packs.as_slice(),
        ),
        mission_items: build_mission_activity_items(
            projection.workspaces.as_slice(),
            scoped_runs.as_slice(),
        ),
        review_items: build_review_queue_items(
            projection.workspaces.as_slice(),
            scoped_review_packs.as_slice(),
        ),
    }
}

pub(super) async fn build_mission_control_projection_state(
    ctx: &AppContext,
    generated_at: u64,
) -> MissionControlProjectionState {
    let (workspaces, workspace_threads) = {
        let state = ctx.state.read().await;
        (state.workspaces.clone(), state.workspace_threads.clone())
    };
    let runtime_tasks = {
        let store = ctx.agent_tasks.read().await;
        store
            .order
            .iter()
            .filter_map(|task_id| store.tasks.get(task_id.as_str()).cloned())
            .collect::<Vec<_>>()
    };
    let backend_summaries = {
        let backends = ctx.runtime_backends.read().await;
        backends.clone()
    };
    let sub_agent_summaries_by_run = {
        let sessions = ctx.sub_agent_sessions.read().await;
        let runtimes = sessions
            .sessions
            .values()
            .cloned()
            .collect::<Vec<_>>();
        drop(sessions);
        build_sub_agent_summary_map(&runtimes)
    };
    let projected_workspaces = workspaces
        .into_iter()
        .map(|workspace| MissionWorkspaceProjection {
            id: workspace.id,
            name: workspace.display_name,
            root_path: workspace.path,
            connected: workspace.connected,
            default_profile_id: None,
        })
        .collect::<Vec<_>>();
    let workspace_roots_by_id = collect_workspace_roots(projected_workspaces.as_slice());
    let runs = runtime_tasks
        .iter()
        .map(|runtime| {
            project_runtime_task_to_run(
                runtime,
                &backend_summaries,
                &sub_agent_summaries_by_run,
                &workspace_roots_by_id,
            )
        })
        .collect::<Vec<_>>();
    let mut latest_run_by_task_id: HashMap<String, MissionRunProjection> = HashMap::new();
    for run in &runs {
        let replace = latest_run_by_task_id
            .get(run.task_id.as_str())
            .map(|existing| run.updated_at > existing.updated_at)
            .unwrap_or(true);
        if replace {
            latest_run_by_task_id.insert(run.task_id.clone(), run.clone());
        }
    }
    let mut threads = workspace_threads
        .into_values()
        .flat_map(|entries| entries.into_iter())
        .collect::<Vec<_>>();
    threads.sort_by_key(|thread| thread.updated_at);
    threads.reverse();
    let mut tasks = threads
        .iter()
        .map(|thread| project_thread_to_task(thread, latest_run_by_task_id.get(thread.id.as_str())))
        .collect::<Vec<_>>();
    let mut seen_task_ids = tasks
        .iter()
        .map(|task| task.id.clone())
        .collect::<HashSet<_>>();
    let runtime_by_run_id = runtime_tasks
        .iter()
        .map(|runtime| (runtime.summary.task_id.clone(), runtime))
        .collect::<HashMap<_, _>>();
    for run in &runs {
        if seen_task_ids.contains(run.task_id.as_str()) {
            continue;
        }
        let Some(runtime) = runtime_by_run_id.get(run.id.as_str()) else {
            continue;
        };
        let task = build_orphan_task(run, runtime);
        seen_task_ids.insert(task.id.clone());
        tasks.push(task);
    }
    let review_packs = runs
        .iter()
        .filter(|run| is_terminal_run_state(run.state.as_str()))
        .map(build_review_pack)
        .collect::<Vec<_>>();

    MissionControlProjectionState {
        generated_at,
        workspaces: projected_workspaces,
        tasks,
        runs,
        review_packs,
    }
}

pub(crate) async fn handle_mission_control_summary_v1(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let active_workspace_id = read_optional_string(params, "activeWorkspaceId")
        .or_else(|| read_optional_string(params, "active_workspace_id"));
    let revision = ctx
        .runtime_update_revision
        .load(std::sync::atomic::Ordering::Relaxed);
    let cache_key = RuntimeRevisionCacheKey::MissionControlSummary {
        workspace_id: active_workspace_id.clone(),
    };
    if let Some(cached_summary) =
        crate::read_runtime_revision_cached_json_value(ctx, &cache_key, revision)
    {
        return Ok(cached_summary);
    }

    let projection = build_mission_control_projection_state(ctx, now_ms()).await;
    let summary =
        build_mission_control_summary_projection(&projection, active_workspace_id.as_deref());
    let summary = serde_json::to_value(summary)
        .map_err(|error| RpcError::internal(format!("Serialize mission control summary: {error}")))?;
    crate::store_runtime_revision_cached_json_value(ctx, cache_key, revision, &summary);
    Ok(summary)
}
