use super::*;

#[derive(Clone, Debug)]
pub(super) struct MissionControlProjectionState {
    pub(super) generated_at: u64,
    pub(super) workspaces: Vec<MissionWorkspaceProjection>,
    pub(super) tasks: Vec<MissionTaskProjection>,
    pub(super) runs: Vec<MissionRunProjection>,
    pub(super) review_packs: Vec<MissionReviewPackProjection>,
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
