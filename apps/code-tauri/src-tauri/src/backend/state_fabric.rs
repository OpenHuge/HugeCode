use super::*;
use serde::Serialize;
use serde_json::{json, Value};
use std::collections::{BTreeMap, VecDeque};
use std::time::{SystemTime, UNIX_EPOCH};

#[path = "state_fabric_agent_projection.rs"]
mod agent_projection;

#[allow(dead_code)]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum NativeStateFabricScope {
    Global,
    Workspace {
        workspace_id: String,
    },
    Thread {
        workspace_id: String,
        thread_id: String,
    },
    Terminal {
        workspace_id: String,
        session_id: String,
    },
    Skills {
        workspace_id: Option<String>,
    },
    Task {
        task_id: String,
    },
    Run {
        run_id: String,
    },
}

#[allow(dead_code)]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum NativeStateFabricChange {
    WorkspaceUpsert {
        workspace_id: String,
    },
    WorkspaceRemove {
        workspace_id: String,
    },
    ThreadUpsert {
        workspace_id: String,
        thread_id: String,
    },
    ThreadRemove {
        workspace_id: String,
        thread_id: String,
    },
    ThreadLiveStatePatched {
        workspace_id: String,
        thread_id: String,
    },
    ThreadLiveHeartbeatObserved {
        workspace_id: String,
        thread_id: String,
    },
    ThreadLiveDetached {
        workspace_id: String,
        thread_id: String,
    },
    TaskUpsert {
        workspace_id: Option<String>,
        task_id: String,
    },
    TaskRemove {
        workspace_id: Option<String>,
        task_id: String,
    },
    RunUpsert {
        workspace_id: Option<String>,
        task_id: Option<String>,
        run_id: String,
    },
    RunRemove {
        workspace_id: Option<String>,
        task_id: Option<String>,
        run_id: String,
    },
    TerminalSessionUpsert {
        workspace_id: String,
        session_id: String,
    },
    TerminalOutputAppended {
        workspace_id: String,
        session_id: String,
        chunk: String,
    },
    TerminalSessionStatePatched {
        workspace_id: String,
        session_id: String,
    },
    SkillsCatalogPatched {
        workspace_id: Option<String>,
    },
    SkillsWatcherStatePatched {
        workspace_id: Option<String>,
    },
    RuntimeCapabilitiesPatched,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeStateFabricEnvelope {
    pub revision: u64,
    pub emitted_at: u64,
    pub scope_hints: Vec<NativeStateFabricScope>,
    pub change: NativeStateFabricChange,
}

#[cfg(test)]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeStateFabricSnapshot {
    pub revision: u64,
    pub entries: Vec<NativeStateFabricEnvelope>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeStateFabricDelta {
    pub base_revision: u64,
    pub revision: u64,
    pub changes: Vec<NativeStateFabricEnvelope>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeStateFabricResyncRequired {
    pub requested_revision: u64,
    pub latest_revision: u64,
    pub oldest_available_revision: Option<u64>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeStateFabricJournalDiagnostics {
    pub revision: u64,
    pub oldest_available_revision: Option<u64>,
    pub retained_change_count: usize,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum NativeStateFabricRead {
    Delta(NativeStateFabricDelta),
    ResyncRequired(NativeStateFabricResyncRequired),
}

#[derive(Debug)]
pub struct NativeStateFabricJournal {
    revision: u64,
    workspaces: BTreeMap<String, WorkspaceSummary>,
    threads: BTreeMap<String, ThreadSummary>,
    changes: VecDeque<NativeStateFabricEnvelope>,
    journal_limit: usize,
    last_pruned_global_revision: u64,
    pruned_workspace_revisions: BTreeMap<String, u64>,
    pruned_thread_revisions: BTreeMap<String, u64>,
    pruned_task_revisions: BTreeMap<String, u64>,
    pruned_run_revisions: BTreeMap<String, u64>,
    pruned_terminal_revisions: BTreeMap<String, u64>,
    last_pruned_global_skills_revision: u64,
    pruned_workspace_skills_revisions: BTreeMap<String, u64>,
}

impl NativeStateFabricJournal {
    #[cfg(test)]
    pub fn new(journal_limit: usize) -> Self {
        Self {
            revision: 0,
            workspaces: BTreeMap::new(),
            threads: BTreeMap::new(),
            changes: VecDeque::new(),
            journal_limit: journal_limit.max(1),
            last_pruned_global_revision: 0,
            pruned_workspace_revisions: BTreeMap::new(),
            pruned_thread_revisions: BTreeMap::new(),
            pruned_task_revisions: BTreeMap::new(),
            pruned_run_revisions: BTreeMap::new(),
            pruned_terminal_revisions: BTreeMap::new(),
            last_pruned_global_skills_revision: 0,
            pruned_workspace_skills_revisions: BTreeMap::new(),
        }
    }

    pub fn from_state(state: &RuntimeState) -> Self {
        let (workspaces, threads) = state_fabric_maps_from_state(state);
        Self {
            revision: 0,
            workspaces,
            threads,
            changes: VecDeque::new(),
            journal_limit: 512,
            last_pruned_global_revision: 0,
            pruned_workspace_revisions: BTreeMap::new(),
            pruned_thread_revisions: BTreeMap::new(),
            pruned_task_revisions: BTreeMap::new(),
            pruned_run_revisions: BTreeMap::new(),
            pruned_terminal_revisions: BTreeMap::new(),
            last_pruned_global_skills_revision: 0,
            pruned_workspace_skills_revisions: BTreeMap::new(),
        }
    }

    #[cfg(test)]
    pub fn snapshot_for_scope(&self, scope: &NativeStateFabricScope) -> NativeStateFabricSnapshot {
        NativeStateFabricSnapshot {
            revision: self.revision,
            entries: self
                .changes
                .iter()
                .filter(|entry| scope_includes_change(scope, &entry.change))
                .cloned()
                .collect(),
        }
    }

    pub fn delta_after_for_scope(
        &self,
        scope: &NativeStateFabricScope,
        revision: u64,
    ) -> NativeStateFabricRead {
        if revision == self.revision {
            return NativeStateFabricRead::Delta(NativeStateFabricDelta {
                base_revision: revision,
                revision: self.revision,
                changes: Vec::new(),
            });
        }

        let next_required_revision = revision.saturating_add(1);
        let oldest_available_revision = self.oldest_available_revision_for_scope(scope);
        if self.scope_pruned_revision(scope) >= next_required_revision {
            return NativeStateFabricRead::ResyncRequired(NativeStateFabricResyncRequired {
                requested_revision: revision,
                latest_revision: self.revision,
                oldest_available_revision,
            });
        }

        NativeStateFabricRead::Delta(NativeStateFabricDelta {
            base_revision: revision,
            revision: self.revision,
            changes: self
                .changes
                .iter()
                .filter(|entry| entry.revision > revision)
                .filter(|entry| scope_includes_change(scope, &entry.change))
                .cloned()
                .collect(),
        })
    }

    pub fn append(&mut self, change: NativeStateFabricChange) -> u64 {
        self.revision = self.revision.saturating_add(1);
        self.changes.push_back(NativeStateFabricEnvelope {
            revision: self.revision,
            emitted_at: now_epoch_ms(),
            scope_hints: scope_hints_for_change(&change),
            change,
        });
        while self.changes.len() > self.journal_limit {
            if let Some(pruned) = self.changes.pop_front() {
                self.record_pruned_change(&pruned);
            }
        }
        self.revision
    }

    pub fn diagnostics(&self) -> NativeStateFabricJournalDiagnostics {
        NativeStateFabricJournalDiagnostics {
            revision: self.revision,
            oldest_available_revision: self.changes.front().map(|entry| entry.revision),
            retained_change_count: self.changes.len(),
        }
    }

    pub fn refresh_from_state(&mut self, state: &RuntimeState) {
        let (next_workspaces, next_threads) = state_fabric_maps_from_state(state);

        for thread_id in self.threads.keys().cloned().collect::<Vec<_>>() {
            if let Some(existing) = self.threads.get(&thread_id).cloned() {
                if !next_threads.contains_key(&thread_id) {
                    self.append(NativeStateFabricChange::ThreadRemove {
                        workspace_id: existing.workspace_id,
                        thread_id,
                    });
                }
            }
        }
        for (thread_id, next_thread) in &next_threads {
            if self.threads.get(thread_id) != Some(next_thread) {
                self.append(NativeStateFabricChange::ThreadUpsert {
                    workspace_id: next_thread.workspace_id.clone(),
                    thread_id: thread_id.clone(),
                });
            }
        }

        for workspace_id in self.workspaces.keys().cloned().collect::<Vec<_>>() {
            if !next_workspaces.contains_key(&workspace_id) {
                self.append(NativeStateFabricChange::WorkspaceRemove { workspace_id });
            }
        }
        for (workspace_id, next_workspace) in &next_workspaces {
            if self.workspaces.get(workspace_id) != Some(next_workspace) {
                self.append(NativeStateFabricChange::WorkspaceUpsert {
                    workspace_id: workspace_id.clone(),
                });
            }
        }

        self.workspaces = next_workspaces;
        self.threads = next_threads;
    }

    fn oldest_available_revision_for_scope(&self, scope: &NativeStateFabricScope) -> Option<u64> {
        self.changes
            .iter()
            .find(|entry| scope_includes_change(scope, &entry.change))
            .map(|entry| entry.revision)
    }

    fn scope_pruned_revision(&self, scope: &NativeStateFabricScope) -> u64 {
        match scope {
            NativeStateFabricScope::Global => self.last_pruned_global_revision,
            NativeStateFabricScope::Workspace { workspace_id } => self
                .pruned_workspace_revisions
                .get(workspace_id)
                .copied()
                .unwrap_or(0)
                .max(
                    self.pruned_workspace_skills_revisions
                        .get(workspace_id)
                        .copied()
                        .unwrap_or(0),
                ),
            NativeStateFabricScope::Thread { thread_id, .. } => self
                .pruned_thread_revisions
                .get(thread_id)
                .copied()
                .unwrap_or(0),
            NativeStateFabricScope::Task { task_id } => self
                .pruned_task_revisions
                .get(task_id)
                .copied()
                .unwrap_or(0),
            NativeStateFabricScope::Run { run_id } => {
                self.pruned_run_revisions.get(run_id).copied().unwrap_or(0)
            }
            NativeStateFabricScope::Terminal { session_id, .. } => self
                .pruned_terminal_revisions
                .get(session_id)
                .copied()
                .unwrap_or(0),
            NativeStateFabricScope::Skills { workspace_id } => workspace_id
                .as_ref()
                .and_then(|workspace_id| self.pruned_workspace_skills_revisions.get(workspace_id))
                .copied()
                .unwrap_or(self.last_pruned_global_skills_revision),
        }
    }

    fn record_pruned_change(&mut self, envelope: &NativeStateFabricEnvelope) {
        self.last_pruned_global_revision = envelope.revision;
        match &envelope.change {
            NativeStateFabricChange::WorkspaceUpsert { workspace_id } => {
                self.pruned_workspace_revisions
                    .insert(workspace_id.clone(), envelope.revision);
            }
            NativeStateFabricChange::WorkspaceRemove { workspace_id } => {
                self.pruned_workspace_revisions
                    .insert(workspace_id.clone(), envelope.revision);
            }
            NativeStateFabricChange::ThreadUpsert {
                workspace_id,
                thread_id,
            }
            | NativeStateFabricChange::ThreadRemove {
                workspace_id,
                thread_id,
            }
            | NativeStateFabricChange::ThreadLiveStatePatched {
                workspace_id,
                thread_id,
            }
            | NativeStateFabricChange::ThreadLiveHeartbeatObserved {
                workspace_id,
                thread_id,
            }
            | NativeStateFabricChange::ThreadLiveDetached {
                workspace_id,
                thread_id,
            } => {
                self.pruned_workspace_revisions
                    .insert(workspace_id.clone(), envelope.revision);
                self.pruned_thread_revisions
                    .insert(thread_id.clone(), envelope.revision);
            }
            NativeStateFabricChange::TaskUpsert {
                workspace_id,
                task_id,
            }
            | NativeStateFabricChange::TaskRemove {
                workspace_id,
                task_id,
            } => {
                if let Some(workspace_id) = workspace_id {
                    self.pruned_workspace_revisions
                        .insert(workspace_id.clone(), envelope.revision);
                }
                self.pruned_task_revisions
                    .insert(task_id.clone(), envelope.revision);
            }
            NativeStateFabricChange::RunUpsert {
                workspace_id,
                task_id,
                run_id,
            }
            | NativeStateFabricChange::RunRemove {
                workspace_id,
                task_id,
                run_id,
            } => {
                if let Some(workspace_id) = workspace_id {
                    self.pruned_workspace_revisions
                        .insert(workspace_id.clone(), envelope.revision);
                }
                if let Some(task_id) = task_id {
                    self.pruned_task_revisions
                        .insert(task_id.clone(), envelope.revision);
                }
                self.pruned_run_revisions
                    .insert(run_id.clone(), envelope.revision);
            }
            NativeStateFabricChange::TerminalSessionUpsert {
                workspace_id,
                session_id,
            }
            | NativeStateFabricChange::TerminalOutputAppended {
                workspace_id,
                session_id,
                ..
            } => {
                self.pruned_workspace_revisions
                    .insert(workspace_id.clone(), envelope.revision);
                self.pruned_terminal_revisions
                    .insert(session_id.clone(), envelope.revision);
            }
            NativeStateFabricChange::TerminalSessionStatePatched {
                workspace_id,
                session_id,
            } => {
                self.pruned_workspace_revisions
                    .insert(workspace_id.clone(), envelope.revision);
                self.pruned_terminal_revisions
                    .insert(session_id.clone(), envelope.revision);
            }
            NativeStateFabricChange::SkillsCatalogPatched { workspace_id } => {
                if let Some(workspace_id) = workspace_id {
                    self.pruned_workspace_skills_revisions
                        .insert(workspace_id.clone(), envelope.revision);
                } else {
                    self.last_pruned_global_skills_revision = envelope.revision;
                }
            }
            NativeStateFabricChange::SkillsWatcherStatePatched { workspace_id } => {
                if let Some(workspace_id) = workspace_id {
                    self.pruned_workspace_skills_revisions
                        .insert(workspace_id.clone(), envelope.revision);
                } else {
                    self.last_pruned_global_skills_revision = envelope.revision;
                }
            }
            NativeStateFabricChange::RuntimeCapabilitiesPatched => {}
        }
    }
}

fn scope_includes_change(scope: &NativeStateFabricScope, change: &NativeStateFabricChange) -> bool {
    match scope {
        NativeStateFabricScope::Global => true,
        NativeStateFabricScope::Workspace { workspace_id } => {
            change_workspace_id(change).is_some_and(|candidate| candidate == workspace_id.as_str())
        }
        NativeStateFabricScope::Thread {
            workspace_id,
            thread_id,
        } => match change {
            NativeStateFabricChange::ThreadUpsert {
                workspace_id: candidate_workspace_id,
                thread_id: candidate_thread_id,
            }
            | NativeStateFabricChange::ThreadRemove {
                workspace_id: candidate_workspace_id,
                thread_id: candidate_thread_id,
            }
            | NativeStateFabricChange::ThreadLiveStatePatched {
                workspace_id: candidate_workspace_id,
                thread_id: candidate_thread_id,
            }
            | NativeStateFabricChange::ThreadLiveHeartbeatObserved {
                workspace_id: candidate_workspace_id,
                thread_id: candidate_thread_id,
            }
            | NativeStateFabricChange::ThreadLiveDetached {
                workspace_id: candidate_workspace_id,
                thread_id: candidate_thread_id,
            } => candidate_workspace_id == workspace_id && candidate_thread_id == thread_id,
            _ => false,
        },
        NativeStateFabricScope::Task { task_id } => match change {
            NativeStateFabricChange::TaskUpsert {
                task_id: candidate_task_id,
                ..
            }
            | NativeStateFabricChange::TaskRemove {
                task_id: candidate_task_id,
                ..
            } => candidate_task_id == task_id,
            NativeStateFabricChange::RunUpsert {
                task_id: Some(candidate_task_id),
                ..
            }
            | NativeStateFabricChange::RunRemove {
                task_id: Some(candidate_task_id),
                ..
            } => candidate_task_id == task_id,
            _ => false,
        },
        NativeStateFabricScope::Run { run_id } => match change {
            NativeStateFabricChange::RunUpsert {
                run_id: candidate_run_id,
                ..
            }
            | NativeStateFabricChange::RunRemove {
                run_id: candidate_run_id,
                ..
            } => candidate_run_id == run_id,
            _ => false,
        },
        NativeStateFabricScope::Terminal {
            workspace_id,
            session_id,
        } => match change {
            NativeStateFabricChange::TerminalSessionUpsert {
                workspace_id: candidate_workspace_id,
                session_id: candidate_session_id,
            }
            | NativeStateFabricChange::TerminalOutputAppended {
                workspace_id: candidate_workspace_id,
                session_id: candidate_session_id,
                ..
            }
            | NativeStateFabricChange::TerminalSessionStatePatched {
                workspace_id: candidate_workspace_id,
                session_id: candidate_session_id,
            } => candidate_workspace_id == workspace_id && candidate_session_id == session_id,
            _ => false,
        },
        NativeStateFabricScope::Skills { workspace_id } => match (workspace_id, change) {
            (
                Some(expected_workspace_id),
                NativeStateFabricChange::SkillsCatalogPatched {
                    workspace_id: Some(candidate_workspace_id),
                },
            )
            | (
                Some(expected_workspace_id),
                NativeStateFabricChange::SkillsWatcherStatePatched {
                    workspace_id: Some(candidate_workspace_id),
                },
            ) => candidate_workspace_id == expected_workspace_id,
            (None, NativeStateFabricChange::SkillsCatalogPatched { workspace_id: None })
            | (None, NativeStateFabricChange::SkillsWatcherStatePatched { workspace_id: None }) => {
                true
            }
            _ => false,
        },
    }
}

fn change_workspace_id(change: &NativeStateFabricChange) -> Option<&str> {
    match change {
        NativeStateFabricChange::WorkspaceUpsert { workspace_id }
        | NativeStateFabricChange::WorkspaceRemove { workspace_id }
        | NativeStateFabricChange::ThreadUpsert { workspace_id, .. }
        | NativeStateFabricChange::ThreadRemove { workspace_id, .. } => Some(workspace_id.as_str()),
        NativeStateFabricChange::ThreadLiveStatePatched { workspace_id, .. }
        | NativeStateFabricChange::ThreadLiveHeartbeatObserved { workspace_id, .. }
        | NativeStateFabricChange::ThreadLiveDetached { workspace_id, .. } => {
            Some(workspace_id.as_str())
        }
        NativeStateFabricChange::TaskUpsert {
            workspace_id: Some(workspace_id),
            ..
        }
        | NativeStateFabricChange::TaskRemove {
            workspace_id: Some(workspace_id),
            ..
        }
        | NativeStateFabricChange::RunUpsert {
            workspace_id: Some(workspace_id),
            ..
        }
        | NativeStateFabricChange::RunRemove {
            workspace_id: Some(workspace_id),
            ..
        } => Some(workspace_id.as_str()),
        NativeStateFabricChange::TaskUpsert {
            workspace_id: None, ..
        }
        | NativeStateFabricChange::TaskRemove {
            workspace_id: None, ..
        }
        | NativeStateFabricChange::RunUpsert {
            workspace_id: None, ..
        }
        | NativeStateFabricChange::RunRemove {
            workspace_id: None, ..
        } => None,
        NativeStateFabricChange::TerminalSessionUpsert { workspace_id, .. }
        | NativeStateFabricChange::TerminalOutputAppended { workspace_id, .. } => {
            Some(workspace_id.as_str())
        }
        NativeStateFabricChange::TerminalSessionStatePatched { workspace_id, .. } => {
            Some(workspace_id.as_str())
        }
        NativeStateFabricChange::SkillsCatalogPatched {
            workspace_id: Some(workspace_id),
        } => Some(workspace_id.as_str()),
        NativeStateFabricChange::SkillsCatalogPatched { workspace_id: None }
        | NativeStateFabricChange::SkillsWatcherStatePatched { workspace_id: None } => None,
        NativeStateFabricChange::SkillsWatcherStatePatched {
            workspace_id: Some(workspace_id),
        } => Some(workspace_id.as_str()),
        NativeStateFabricChange::RuntimeCapabilitiesPatched => None,
    }
}

fn now_epoch_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
        .try_into()
        .unwrap_or(u64::MAX)
}

fn scope_hints_for_change(change: &NativeStateFabricChange) -> Vec<NativeStateFabricScope> {
    match change {
        NativeStateFabricChange::WorkspaceUpsert { workspace_id }
        | NativeStateFabricChange::WorkspaceRemove { workspace_id } => vec![
            NativeStateFabricScope::Global,
            NativeStateFabricScope::Workspace {
                workspace_id: workspace_id.clone(),
            },
        ],
        NativeStateFabricChange::ThreadUpsert {
            workspace_id,
            thread_id,
        }
        | NativeStateFabricChange::ThreadRemove {
            workspace_id,
            thread_id,
        }
        | NativeStateFabricChange::ThreadLiveStatePatched {
            workspace_id,
            thread_id,
        }
        | NativeStateFabricChange::ThreadLiveHeartbeatObserved {
            workspace_id,
            thread_id,
        }
        | NativeStateFabricChange::ThreadLiveDetached {
            workspace_id,
            thread_id,
        } => vec![
            NativeStateFabricScope::Global,
            NativeStateFabricScope::Workspace {
                workspace_id: workspace_id.clone(),
            },
            NativeStateFabricScope::Thread {
                workspace_id: workspace_id.clone(),
                thread_id: thread_id.clone(),
            },
        ],
        NativeStateFabricChange::TaskUpsert {
            workspace_id,
            task_id,
        }
        | NativeStateFabricChange::TaskRemove {
            workspace_id,
            task_id,
        } => {
            let mut scopes = vec![
                NativeStateFabricScope::Global,
                NativeStateFabricScope::Task {
                    task_id: task_id.clone(),
                },
            ];
            if let Some(workspace_id) = workspace_id {
                scopes.push(NativeStateFabricScope::Workspace {
                    workspace_id: workspace_id.clone(),
                });
            }
            scopes
        }
        NativeStateFabricChange::RunUpsert {
            workspace_id,
            task_id,
            run_id,
        }
        | NativeStateFabricChange::RunRemove {
            workspace_id,
            task_id,
            run_id,
        } => {
            let mut scopes = vec![
                NativeStateFabricScope::Global,
                NativeStateFabricScope::Run {
                    run_id: run_id.clone(),
                },
            ];
            if let Some(task_id) = task_id {
                scopes.push(NativeStateFabricScope::Task {
                    task_id: task_id.clone(),
                });
            }
            if let Some(workspace_id) = workspace_id {
                scopes.push(NativeStateFabricScope::Workspace {
                    workspace_id: workspace_id.clone(),
                });
            }
            scopes
        }
        NativeStateFabricChange::TerminalSessionUpsert {
            workspace_id,
            session_id,
        }
        | NativeStateFabricChange::TerminalOutputAppended {
            workspace_id,
            session_id,
            ..
        }
        | NativeStateFabricChange::TerminalSessionStatePatched {
            workspace_id,
            session_id,
        } => vec![
            NativeStateFabricScope::Global,
            NativeStateFabricScope::Workspace {
                workspace_id: workspace_id.clone(),
            },
            NativeStateFabricScope::Terminal {
                workspace_id: workspace_id.clone(),
                session_id: session_id.clone(),
            },
        ],
        NativeStateFabricChange::SkillsCatalogPatched { workspace_id }
        | NativeStateFabricChange::SkillsWatcherStatePatched { workspace_id } => {
            let mut scopes = vec![
                NativeStateFabricScope::Global,
                NativeStateFabricScope::Skills {
                    workspace_id: workspace_id.clone(),
                },
            ];
            if let Some(workspace_id) = workspace_id {
                scopes.push(NativeStateFabricScope::Workspace {
                    workspace_id: workspace_id.clone(),
                });
            }
            scopes
        }
        NativeStateFabricChange::RuntimeCapabilitiesPatched => vec![NativeStateFabricScope::Global],
    }
}

fn state_fabric_maps_from_state(
    state: &RuntimeState,
) -> (
    BTreeMap<String, WorkspaceSummary>,
    BTreeMap<String, ThreadSummary>,
) {
    let workspaces = state
        .workspaces
        .values()
        .map(|workspace| {
            (
                workspace.id.clone(),
                WorkspaceSummary {
                    id: workspace.id.clone(),
                    path: workspace.path.clone(),
                    display_name: workspace.display_name.clone(),
                    connected: workspace.connected,
                    default_model_id: workspace.default_model_id.clone(),
                },
            )
        })
        .collect::<BTreeMap<_, _>>();
    let threads = state
        .threads
        .values()
        .map(|thread| {
            (
                thread.id.clone(),
                ThreadSummary {
                    id: thread.id.clone(),
                    workspace_id: thread.workspace_id.clone(),
                    title: thread.title.clone(),
                    unread: thread.unread,
                    running: thread.running,
                    created_at: thread.created_at,
                    updated_at: thread.updated_at,
                    provider: thread.provider.clone(),
                    model_id: thread.model_id.clone(),
                    status: thread.status.clone(),
                    archived: thread.archived,
                    last_activity_at: thread.last_activity_at,
                    agent_role: thread.agent_role.clone(),
                    agent_nickname: thread.agent_nickname.clone(),
                },
            )
        })
        .collect::<BTreeMap<_, _>>();
    (workspaces, threads)
}

impl RuntimeBackend {
    pub fn append_state_fabric_change(&self, change: NativeStateFabricChange) -> u64 {
        self.state_fabric
            .lock()
            .expect("native state fabric lock poisoned while appending change")
            .append(change)
    }

    pub fn state_fabric_delta_after_for_scope(
        &self,
        revision: u64,
        scope: &NativeStateFabricScope,
    ) -> NativeStateFabricRead {
        self.state_fabric
            .lock()
            .expect("native state fabric lock poisoned while reading delta")
            .delta_after_for_scope(scope, revision)
    }

    pub fn state_fabric_journal_diagnostics(&self) -> NativeStateFabricJournalDiagnostics {
        self.state_fabric
            .lock()
            .expect("native state fabric lock poisoned while reading diagnostics")
            .diagnostics()
    }

    pub fn state_fabric_snapshot_payload(&self, scope: &NativeStateFabricScope) -> Value {
        let revision = self
            .state_fabric
            .lock()
            .expect("native state fabric lock poisoned while reading snapshot revision")
            .diagnostics()
            .revision;
        json!({
            "revision": revision,
            "scope": scope,
            "state": self.project_state_fabric_scope(scope),
        })
    }

    pub fn state_fabric_delta_payload(
        &self,
        revision: u64,
        scope: &NativeStateFabricScope,
    ) -> Value {
        match self.state_fabric_delta_after_for_scope(revision, scope) {
            NativeStateFabricRead::Delta(delta) => json!({
                "baseRevision": delta.base_revision,
                "revision": delta.revision,
                "scope": scope,
                "changes": delta.changes,
            }),
            NativeStateFabricRead::ResyncRequired(resync) => json!({
                "requestedRevision": resync.requested_revision,
                "latestRevision": resync.latest_revision,
                "oldestAvailableRevision": resync.oldest_available_revision,
                "scope": scope,
            }),
        }
    }

    pub fn state_fabric_diagnostics_payload(&self) -> Value {
        let diagnostics = self.state_fabric_journal_diagnostics();
        json!({
            "revision": diagnostics.revision,
            "oldestAvailableRevision": diagnostics.oldest_available_revision,
            "retainedChangeCount": diagnostics.retained_change_count,
            "projectionKeys": ["global", "workspace", "thread", "task", "run", "terminal", "skills"],
        })
    }

    fn project_state_fabric_scope(&self, scope: &NativeStateFabricScope) -> Value {
        match scope {
            NativeStateFabricScope::Global => json!({
                "workspaces": self.workspaces(),
                "threads": self
                    .workspaces()
                    .into_iter()
                    .flat_map(|workspace| self.threads(workspace.id.as_str()))
                    .collect::<Vec<_>>(),
                "terminalStream": crate::commands::terminal::terminal_stream_diagnostics_payload(),
                "fabricHydration": crate::runtime_service::runtime_context_sync_diagnostics_payload(),
                "instructionSkillsWatcher": crate::instruction_skills_watcher::instruction_skills_watcher_diagnostics_payload(),
            }),
            NativeStateFabricScope::Workspace { workspace_id } => {
                let workspace = self
                    .workspaces()
                    .into_iter()
                    .find(|workspace| workspace.id == *workspace_id);
                json!({
                    "workspace": workspace,
                    "threads": self.threads(workspace_id),
                    "terminalSessions": self.terminal_sessions_for_workspace(workspace_id),
                    "instructionSkillsWatcher": crate::instruction_skills_watcher::instruction_skills_watcher_diagnostics_payload(),
                })
            }
            NativeStateFabricScope::Thread {
                workspace_id,
                thread_id,
            } => {
                let workspace = self
                    .workspaces()
                    .into_iter()
                    .find(|workspace| workspace.id == *workspace_id);
                let thread = self
                    .threads(workspace_id)
                    .into_iter()
                    .find(|thread| thread.id == *thread_id);
                json!({
                    "workspace": workspace,
                    "thread": thread,
                })
            }
            NativeStateFabricScope::Task { task_id } => {
                agent_projection::project_agent_task_scope(task_id)
            }
            NativeStateFabricScope::Run { run_id } => {
                agent_projection::project_agent_run_scope(run_id)
            }
            NativeStateFabricScope::Terminal {
                workspace_id,
                session_id,
            } => json!({
                "workspaceId": workspace_id,
                "session": self.terminal_session_by_id(session_id),
                "terminalStream": crate::commands::terminal::terminal_stream_diagnostics_payload(),
            }),
            NativeStateFabricScope::Skills { workspace_id } => json!({
                "workspaceId": workspace_id,
                "watcher": crate::instruction_skills_watcher::instruction_skills_watcher_diagnostics_payload(),
            }),
        }
    }

    fn terminal_sessions_for_workspace(&self, workspace_id: &str) -> Vec<TerminalSessionSummary> {
        let state = self
            .state
            .lock()
            .expect("runtime state lock poisoned while collecting workspace terminal sessions");
        let Some(session_ids) = state.workspace_terminal_sessions.get(workspace_id) else {
            return Vec::new();
        };
        session_ids
            .iter()
            .filter_map(|session_id| state.terminal_sessions.get(session_id))
            .map(terminal_to_summary)
            .collect()
    }

    fn terminal_session_by_id(&self, session_id: &str) -> Option<TerminalSessionSummary> {
        let state = self
            .state
            .lock()
            .expect("runtime state lock poisoned while collecting terminal session");
        state
            .terminal_sessions
            .get(session_id)
            .map(terminal_to_summary)
    }
}

#[cfg(test)]
mod tests {
    use super::{
        NativeStateFabricChange, NativeStateFabricJournal, NativeStateFabricRead,
        NativeStateFabricScope,
    };
    use crate::backend::RuntimeState;

    #[test]
    fn fabric_snapshot_starts_at_revision_zero() {
        let fabric = NativeStateFabricJournal::new(8);

        let snapshot = fabric.snapshot_for_scope(&NativeStateFabricScope::Global);

        assert_eq!(snapshot.revision, 0);
        assert!(snapshot.entries.is_empty());
    }

    #[test]
    fn fabric_delta_keeps_mixed_domain_changes_in_one_revision_chain() {
        let mut fabric = NativeStateFabricJournal::new(8);

        fabric.append(NativeStateFabricChange::WorkspaceUpsert {
            workspace_id: "workspace-a".to_string(),
        });
        fabric.append(NativeStateFabricChange::ThreadLiveDetached {
            workspace_id: "workspace-a".to_string(),
            thread_id: "thread-1".to_string(),
        });
        fabric.append(NativeStateFabricChange::TerminalOutputAppended {
            workspace_id: "workspace-a".to_string(),
            session_id: "terminal-1".to_string(),
            chunk: "cargo test\n".to_string(),
        });

        let read = fabric.delta_after_for_scope(&NativeStateFabricScope::Global, 0);
        let NativeStateFabricRead::Delta(delta) = read else {
            panic!("expected delta result");
        };

        assert_eq!(delta.base_revision, 0);
        assert_eq!(delta.revision, 3);
        assert_eq!(delta.changes.len(), 3);
    }

    #[test]
    fn fabric_requires_resync_after_scope_revision_is_pruned() {
        let mut fabric = NativeStateFabricJournal::new(2);

        fabric.append(NativeStateFabricChange::WorkspaceUpsert {
            workspace_id: "workspace-a".to_string(),
        });
        fabric.append(NativeStateFabricChange::SkillsCatalogPatched {
            workspace_id: Some("workspace-a".to_string()),
        });
        fabric.append(NativeStateFabricChange::TerminalOutputAppended {
            workspace_id: "workspace-a".to_string(),
            session_id: "terminal-1".to_string(),
            chunk: "pnpm validate\n".to_string(),
        });

        let read = fabric.delta_after_for_scope(
            &NativeStateFabricScope::Workspace {
                workspace_id: "workspace-a".to_string(),
            },
            0,
        );
        let NativeStateFabricRead::ResyncRequired(resync) = read else {
            panic!("expected resync required result");
        };

        assert_eq!(resync.requested_revision, 0);
        assert_eq!(resync.latest_revision, 3);
        assert_eq!(resync.oldest_available_revision, Some(2));
    }

    #[test]
    fn fabric_refresh_from_state_emits_workspace_and_thread_changes() {
        let mut state = RuntimeState::seed(Some("gpt-5.4".to_string()), None);
        let mut fabric = NativeStateFabricJournal::from_state(&state);

        state.ensure_workspace("workspace-1", Some("gpt-5.4"));
        state.ensure_thread(
            "workspace-1",
            Some("thread-1".to_string()),
            "Thread 1".to_string(),
            1,
        );
        fabric.refresh_from_state(&state);

        let read = fabric.delta_after_for_scope(&NativeStateFabricScope::Global, 0);
        let NativeStateFabricRead::Delta(delta) = read else {
            panic!("expected delta result");
        };

        assert!(delta.changes.iter().any(|entry| matches!(
            entry.change,
            NativeStateFabricChange::WorkspaceUpsert { ref workspace_id }
                if workspace_id == "workspace-1"
        )));
        assert!(delta.changes.iter().any(|entry| matches!(
            entry.change,
            NativeStateFabricChange::ThreadUpsert {
                ref workspace_id,
                ref thread_id,
            } if workspace_id == "workspace-1" && thread_id == "thread-1"
        )));
    }

    #[test]
    fn fabric_filters_task_and_run_changes_by_scope() {
        let mut fabric = NativeStateFabricJournal::new(8);

        fabric.append(NativeStateFabricChange::TaskUpsert {
            workspace_id: Some("workspace-a".to_string()),
            task_id: "task-1".to_string(),
        });
        fabric.append(NativeStateFabricChange::RunUpsert {
            workspace_id: Some("workspace-a".to_string()),
            task_id: Some("task-1".to_string()),
            run_id: "run-1".to_string(),
        });
        fabric.append(NativeStateFabricChange::RunUpsert {
            workspace_id: Some("workspace-a".to_string()),
            task_id: Some("task-2".to_string()),
            run_id: "run-2".to_string(),
        });

        let NativeStateFabricRead::Delta(task_delta) = fabric.delta_after_for_scope(
            &NativeStateFabricScope::Task {
                task_id: "task-1".into(),
            },
            0,
        ) else {
            panic!("expected task delta result");
        };
        assert_eq!(task_delta.changes.len(), 2);

        let NativeStateFabricRead::Delta(run_delta) = fabric.delta_after_for_scope(
            &NativeStateFabricScope::Run {
                run_id: "run-1".into(),
            },
            0,
        ) else {
            panic!("expected run delta result");
        };
        assert_eq!(run_delta.changes.len(), 1);
        assert!(matches!(
            run_delta.changes[0].change,
            NativeStateFabricChange::RunUpsert { ref run_id, .. } if run_id == "run-1"
        ));
    }
}
