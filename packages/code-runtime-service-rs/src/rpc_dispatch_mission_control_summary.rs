#![cfg_attr(test, allow(dead_code))]

use super::*;

#[derive(Clone, Debug)]
pub(super) struct MissionControlProjectionState {
    pub(super) generated_at: u64,
    pub(super) workspaces: Vec<MissionWorkspaceProjection>,
    pub(super) tasks: Vec<MissionTaskProjection>,
    pub(super) runs: Vec<MissionRunProjection>,
    pub(super) review_packs: Vec<MissionReviewPackProjection>,
}

#[cfg(test)]
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct MissionControlReadinessSummaryProjection {
    pub(super) tone: String,
    pub(super) label: String,
    pub(super) detail: String,
}

#[cfg(test)]
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

#[cfg(test)]
fn json_string_field<'a>(value: &'a Option<Value>, key: &str) -> Option<&'a str> {
    value
        .as_ref()?
        .get(key)?
        .as_str()
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
}

#[cfg(test)]
fn json_bool_field(value: &Option<Value>, key: &str) -> bool {
    value
        .as_ref()
        .and_then(|entry| entry.get(key))
        .and_then(Value::as_bool)
        .unwrap_or(false)
}

#[cfg(test)]
fn json_has_non_null_field(value: &Option<Value>, key: &str) -> bool {
    value
        .as_ref()
        .and_then(|entry| entry.get(key))
        .is_some_and(|entry| !entry.is_null())
}

#[cfg(test)]
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

#[cfg(test)]
fn empty_continuity_readiness() -> MissionControlReadinessSummaryProjection {
    MissionControlReadinessSummaryProjection {
        tone: "idle".to_string(),
        label: "Continuity readiness".to_string(),
        detail: "Checkpoint and review continuity signals appear once runs are available."
            .to_string(),
    }
}

#[cfg(test)]
fn has_recovery_path(run: &MissionRunProjection) -> bool {
    run.publish_handoff.is_some() || json_has_non_null_field(&run.mission_linkage, "navigationTarget")
}

#[cfg(test)]
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

#[cfg(test)]
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

#[cfg(test)]
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

#[cfg(test)]
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

#[cfg(test)]
#[path = "rpc_dispatch_mission_control_summary_tests.rs"]
mod tests;
