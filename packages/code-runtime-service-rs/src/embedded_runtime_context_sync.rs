use crate::{
    EmbeddedRuntimeContextSnapshot, EmbeddedRuntimeThreadSnapshot, EmbeddedRuntimeWorkspaceSnapshot,
    RuntimeState, ThreadSummary, WorkspaceSummary,
};

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum EmbeddedRuntimeContextScope {
    Global,
    Workspace { workspace_id: String },
    Thread { workspace_id: String, thread_id: String },
}

pub(crate) fn apply_context_scope_snapshot_to_state(
    state: &mut RuntimeState,
    scope: &EmbeddedRuntimeContextScope,
    snapshot: EmbeddedRuntimeContextSnapshot,
) {
    match scope {
        EmbeddedRuntimeContextScope::Global => {
            state.workspaces = snapshot
                .workspaces
                .iter()
                .map(workspace_snapshot_to_summary)
                .collect();
            state.workspace_threads = snapshot
                .workspaces
                .iter()
                .map(|workspace| (workspace.id.clone(), Vec::new()))
                .collect();
            for thread in snapshot.threads {
                let workspace_id = thread.workspace_id.clone();
                state
                    .workspace_threads
                    .entry(workspace_id)
                    .or_insert_with(Vec::new)
                    .push(thread_snapshot_to_summary(thread));
            }
        }
        EmbeddedRuntimeContextScope::Workspace { workspace_id } => {
            apply_workspace_scope_snapshot(state, workspace_id.as_str(), snapshot);
        }
        EmbeddedRuntimeContextScope::Thread {
            workspace_id,
            thread_id,
        } => {
            apply_thread_scope_snapshot(state, workspace_id.as_str(), thread_id.as_str(), snapshot);
        }
    }
    sort_context_state(state);
}

pub(crate) fn workspace_snapshot_to_summary(
    snapshot: &EmbeddedRuntimeWorkspaceSnapshot,
) -> WorkspaceSummary {
    WorkspaceSummary {
        id: snapshot.id.clone(),
        path: snapshot.path.clone(),
        display_name: snapshot.display_name.clone(),
        connected: snapshot.connected,
        default_model_id: snapshot.default_model_id.clone(),
    }
}

pub(crate) fn thread_snapshot_to_summary(snapshot: EmbeddedRuntimeThreadSnapshot) -> ThreadSummary {
    ThreadSummary {
        id: snapshot.id,
        workspace_id: snapshot.workspace_id,
        title: snapshot.title,
        unread: snapshot.unread,
        running: snapshot.running,
        created_at: snapshot.created_at,
        updated_at: snapshot.updated_at,
        provider: snapshot.provider,
        model_id: snapshot.model_id,
        status: snapshot.status,
        archived: snapshot.archived,
        last_activity_at: snapshot.last_activity_at,
        agent_role: snapshot.agent_role,
        agent_nickname: snapshot.agent_nickname,
    }
}

pub(crate) fn sort_context_state(state: &mut RuntimeState) {
    state.workspaces.sort_by(|left, right| left.id.cmp(&right.id));
    for threads in state.workspace_threads.values_mut() {
        threads.sort_by(|left, right| left.id.cmp(&right.id));
    }
}

fn apply_workspace_scope_snapshot(
    state: &mut RuntimeState,
    workspace_id: &str,
    snapshot: EmbeddedRuntimeContextSnapshot,
) {
    let workspace = snapshot
        .workspaces
        .into_iter()
        .find(|entry| entry.id == workspace_id);
    let threads = snapshot
        .threads
        .into_iter()
        .filter(|entry| entry.workspace_id == workspace_id)
        .map(thread_snapshot_to_summary)
        .collect::<Vec<_>>();

    match workspace {
        Some(workspace) => {
            if let Some(existing) = state.workspaces.iter_mut().find(|entry| entry.id == workspace_id)
            {
                *existing = workspace_snapshot_to_summary(&workspace);
            } else {
                state.workspaces.push(workspace_snapshot_to_summary(&workspace));
            }
            state.workspace_threads.insert(workspace_id.to_string(), threads);
        }
        None => {
            state.workspaces.retain(|entry| entry.id != workspace_id);
            state.workspace_threads.remove(workspace_id);
        }
    }
}

fn apply_thread_scope_snapshot(
    state: &mut RuntimeState,
    workspace_id: &str,
    thread_id: &str,
    snapshot: EmbeddedRuntimeContextSnapshot,
) {
    let workspace = snapshot
        .workspaces
        .into_iter()
        .find(|entry| entry.id == workspace_id);
    let thread = snapshot
        .threads
        .into_iter()
        .find(|entry| entry.workspace_id == workspace_id && entry.id == thread_id);

    match workspace {
        Some(workspace) => {
            if let Some(existing) = state.workspaces.iter_mut().find(|entry| entry.id == workspace_id)
            {
                *existing = workspace_snapshot_to_summary(&workspace);
            } else {
                state.workspaces.push(workspace_snapshot_to_summary(&workspace));
            }
            for threads in state.workspace_threads.values_mut() {
                threads.retain(|entry| entry.id != thread_id);
            }
            let threads = state
                .workspace_threads
                .entry(workspace_id.to_string())
                .or_insert_with(Vec::new);
            match thread {
                Some(thread) => {
                    threads.push(thread_snapshot_to_summary(thread));
                }
                None => {
                    threads.retain(|entry| entry.id != thread_id);
                }
            }
        }
        None => {
            state.workspaces.retain(|entry| entry.id != workspace_id);
            state.workspace_threads.remove(workspace_id);
        }
    }
}
