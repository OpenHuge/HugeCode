use std::collections::HashMap;

use super::common_utils::unix_timestamp_seconds;
use super::state_utils::{
    build_runtime_thread, dedupe_preserve_order, normalize_thread_metadata, parse_id_suffix,
};
use super::terminal_utils::{fallback_current_dir, truncate_terminal_line};
use super::workspace_utils::resolve_workspace_root;
use super::{RuntimeState, RuntimeWorkspace, MAX_TERMINAL_SESSION_LINES};
use ku0_runtime_shell_core::TerminalSessionState;

impl RuntimeState {
    pub(super) fn seed(
        default_model_id: Option<String>,
        seed_route: Option<(String, String)>,
    ) -> Self {
        let now = unix_timestamp_seconds();
        let (provider, model_id) = match seed_route {
            Some((provider, model_id)) => (provider, Some(model_id)),
            None => ("unknown".to_string(), None),
        };

        let mut state = Self {
            workspaces: HashMap::new(),
            threads: HashMap::new(),
            workspace_threads: HashMap::new(),
            terminal_sessions: HashMap::new(),
            workspace_terminal_sessions: HashMap::new(),
            active_turns: HashMap::new(),
            provider_circuits: HashMap::new(),
            next_thread_seq: 1,
            next_turn_seq: 1,
            next_terminal_seq: 1,
        };

        state.workspaces.insert(
            "workspace-local".to_string(),
            RuntimeWorkspace {
                id: "workspace-local".to_string(),
                path: ".".to_string(),
                display_name: "Local Workspace".to_string(),
                connected: true,
                default_model_id,
            },
        );
        state.workspace_threads.insert(
            "workspace-local".to_string(),
            vec!["thread-seed".to_string()],
        );
        state.threads.insert(
            "thread-seed".to_string(),
            build_runtime_thread(
                "thread-seed".to_string(),
                "workspace-local".to_string(),
                "Implement prerequisites".to_string(),
                now,
                provider,
                model_id,
            ),
        );

        state
    }

    pub(super) fn normalize(
        mut self,
        seed_state: &RuntimeState,
        fallback_model_id: Option<&str>,
    ) -> RuntimeState {
        let now = unix_timestamp_seconds();

        if self.workspaces.is_empty() {
            self.workspaces = seed_state.workspaces.clone();
        }
        for (workspace_id, seed_workspace) in &seed_state.workspaces {
            self.workspaces
                .entry(workspace_id.clone())
                .or_insert_with(|| seed_workspace.clone());
        }

        let workspace_ids = self.workspaces.keys().cloned().collect::<Vec<_>>();
        for workspace_id in workspace_ids {
            if let Some(workspace) = self.workspaces.get_mut(&workspace_id) {
                workspace.id = workspace_id.clone();
                if workspace.path.trim().is_empty() {
                    workspace.path = ".".to_string();
                }
                if workspace.display_name.trim().is_empty() {
                    workspace.display_name = format!("Workspace {workspace_id}");
                }
                if workspace.default_model_id.is_none() {
                    workspace.default_model_id =
                        fallback_model_id.map(str::to_string).or_else(|| {
                            seed_state
                                .workspaces
                                .get(&workspace_id)
                                .and_then(|seed_workspace| seed_workspace.default_model_id.clone())
                        });
                }
            }
        }

        let mut normalized_threads = HashMap::new();
        for (thread_id, mut thread) in std::mem::take(&mut self.threads) {
            if thread_id.trim().is_empty() {
                continue;
            }
            if thread.workspace_id.trim().is_empty() {
                thread.workspace_id = "workspace-local".to_string();
            }
            if !self.workspaces.contains_key(&thread.workspace_id) {
                self.workspaces.insert(
                    thread.workspace_id.clone(),
                    RuntimeWorkspace {
                        id: thread.workspace_id.clone(),
                        path: ".".to_string(),
                        display_name: format!("Workspace {}", thread.workspace_id),
                        connected: true,
                        default_model_id: fallback_model_id.map(str::to_string),
                    },
                );
            }
            thread.id = thread_id.clone();
            if thread.title.trim().is_empty() {
                thread.title = "New thread".to_string();
            }
            if thread.provider.trim().is_empty() {
                thread.provider = "unknown".to_string();
            }
            if thread.created_at == 0 {
                thread.created_at = now;
            }
            if thread.updated_at < thread.created_at {
                thread.updated_at = thread.created_at;
            }
            normalize_thread_metadata(&mut thread);
            normalized_threads.insert(thread_id, thread);
        }
        self.threads = normalized_threads;

        let mut rebuilt_workspace_threads: HashMap<String, Vec<String>> = self
            .workspaces
            .keys()
            .cloned()
            .map(|workspace_id| (workspace_id, Vec::new()))
            .collect();
        for (workspace_id, thread_ids) in &self.workspace_threads {
            let bucket = rebuilt_workspace_threads
                .entry(workspace_id.clone())
                .or_default();
            for thread_id in thread_ids {
                if let Some(thread) = self.threads.get(thread_id) {
                    if thread.workspace_id == *workspace_id {
                        bucket.push(thread_id.clone());
                    }
                }
            }
        }
        for (thread_id, thread) in &self.threads {
            rebuilt_workspace_threads
                .entry(thread.workspace_id.clone())
                .or_default()
                .push(thread_id.clone());
        }
        for thread_ids in rebuilt_workspace_threads.values_mut() {
            dedupe_preserve_order(thread_ids);
        }
        self.workspace_threads = rebuilt_workspace_threads;

        let mut normalized_sessions = HashMap::new();
        for (session_id, mut session) in std::mem::take(&mut self.terminal_sessions) {
            if session_id.trim().is_empty() {
                continue;
            }
            if session.workspace_id.trim().is_empty() {
                session.workspace_id = "workspace-local".to_string();
            }
            if !self.workspaces.contains_key(&session.workspace_id) {
                self.workspaces.insert(
                    session.workspace_id.clone(),
                    RuntimeWorkspace {
                        id: session.workspace_id.clone(),
                        path: ".".to_string(),
                        display_name: format!("Workspace {}", session.workspace_id),
                        connected: true,
                        default_model_id: fallback_model_id.map(str::to_string),
                    },
                );
            }
            session.id = session_id.clone();
            session.state = TerminalSessionState::Exited;
            if session.created_at == 0 {
                session.created_at = now;
            }
            if session.updated_at < session.created_at {
                session.updated_at = session.created_at;
            }
            for line in &mut session.lines {
                *line = truncate_terminal_line(line);
            }
            if session.lines.len() > MAX_TERMINAL_SESSION_LINES {
                let keep_from = session.lines.len() - MAX_TERMINAL_SESSION_LINES;
                session.lines.drain(0..keep_from);
            }
            if session.lines.is_empty() {
                session
                    .lines
                    .push("Terminal session restored from persisted state.".to_string());
            }
            if !session.cwd.as_ref().is_some_and(|cwd| cwd.is_dir()) {
                session.cwd = Some(
                    self.workspaces
                        .get(&session.workspace_id)
                        .and_then(|workspace| resolve_workspace_root(&workspace.path))
                        .unwrap_or_else(fallback_current_dir),
                );
            }
            normalized_sessions.insert(session_id, session);
        }
        self.terminal_sessions = normalized_sessions;

        let mut rebuilt_workspace_terminal_sessions: HashMap<String, Vec<String>> = self
            .workspaces
            .keys()
            .cloned()
            .map(|workspace_id| (workspace_id, Vec::new()))
            .collect();
        for (workspace_id, session_ids) in &self.workspace_terminal_sessions {
            let bucket = rebuilt_workspace_terminal_sessions
                .entry(workspace_id.clone())
                .or_default();
            for session_id in session_ids {
                if let Some(session) = self.terminal_sessions.get(session_id) {
                    if session.workspace_id == *workspace_id {
                        bucket.push(session_id.clone());
                    }
                }
            }
        }
        for (session_id, session) in &self.terminal_sessions {
            rebuilt_workspace_terminal_sessions
                .entry(session.workspace_id.clone())
                .or_default()
                .push(session_id.clone());
        }
        for session_ids in rebuilt_workspace_terminal_sessions.values_mut() {
            dedupe_preserve_order(session_ids);
        }
        self.workspace_terminal_sessions = rebuilt_workspace_terminal_sessions;

        let mut normalized_active_turns = HashMap::new();
        for (turn_id, thread_id) in std::mem::take(&mut self.active_turns) {
            let normalized_turn_id = turn_id.trim();
            let normalized_thread_id = thread_id.trim();
            if normalized_turn_id.is_empty() || normalized_thread_id.is_empty() {
                continue;
            }
            if let Some(thread) = self.threads.get(normalized_thread_id) {
                if thread.running {
                    normalized_active_turns.insert(
                        normalized_turn_id.to_string(),
                        normalized_thread_id.to_string(),
                    );
                }
            }
        }
        self.active_turns = normalized_active_turns;

        let mut normalized_provider_circuits = HashMap::new();
        for (provider, circuit) in std::mem::take(&mut self.provider_circuits) {
            let normalized_provider = provider.trim().to_ascii_lowercase();
            if normalized_provider.is_empty() {
                continue;
            }
            if circuit.consecutive_failures == 0 && circuit.cooldown_until_epoch_seconds == 0 {
                continue;
            }
            normalized_provider_circuits.insert(normalized_provider, circuit);
        }
        self.provider_circuits = normalized_provider_circuits;

        let max_thread_seq = self
            .threads
            .keys()
            .filter_map(|thread_id| parse_id_suffix(thread_id))
            .max()
            .unwrap_or(0);
        let max_terminal_seq = self
            .terminal_sessions
            .keys()
            .filter_map(|session_id| parse_id_suffix(session_id))
            .max()
            .unwrap_or(0);
        self.next_thread_seq = self
            .next_thread_seq
            .max(max_thread_seq.saturating_add(1))
            .max(seed_state.next_thread_seq)
            .max(1);
        self.next_turn_seq = self.next_turn_seq.max(seed_state.next_turn_seq).max(1);
        self.next_terminal_seq = self
            .next_terminal_seq
            .max(max_terminal_seq.saturating_add(1))
            .max(seed_state.next_terminal_seq)
            .max(1);

        self
    }

    pub(super) fn ensure_workspace(&mut self, workspace_id: &str, fallback_model_id: Option<&str>) {
        self.workspaces
            .entry(workspace_id.to_string())
            .or_insert_with(|| RuntimeWorkspace {
                id: workspace_id.to_string(),
                path: ".".to_string(),
                display_name: format!("Workspace {}", workspace_id),
                connected: true,
                default_model_id: fallback_model_id.map(str::to_string),
            });

        self.workspace_threads
            .entry(workspace_id.to_string())
            .or_default();
        self.workspace_terminal_sessions
            .entry(workspace_id.to_string())
            .or_default();
    }

    pub(super) fn ensure_thread(
        &mut self,
        workspace_id: &str,
        requested_thread_id: Option<String>,
        title_hint: String,
        now: u64,
    ) -> String {
        let thread_id = match requested_thread_id {
            Some(existing_or_new) => existing_or_new,
            None => self.next_thread_id(workspace_id),
        };

        self.threads.entry(thread_id.clone()).or_insert_with(|| {
            build_runtime_thread(
                thread_id.clone(),
                workspace_id.to_string(),
                title_hint,
                now,
                "unknown".to_string(),
                None,
            )
        });

        let thread_ids = self
            .workspace_threads
            .entry(workspace_id.to_string())
            .or_default();

        if !thread_ids.iter().any(|candidate| candidate == &thread_id) {
            thread_ids.push(thread_id.clone());
        }

        thread_id
    }

    fn next_thread_id(&mut self, workspace_id: &str) -> String {
        let thread_id = format!("thread-{workspace_id}-{:04}", self.next_thread_seq);
        self.next_thread_seq += 1;
        thread_id
    }

    #[cfg_attr(not(test), allow(dead_code))]
    pub(super) fn next_turn_id(&mut self) -> String {
        let turn_id = format!("turn-{:06}", self.next_turn_seq);
        self.next_turn_seq += 1;
        turn_id
    }

    pub(super) fn next_terminal_id(&mut self, workspace_id: &str) -> String {
        let session_id = format!("terminal-{workspace_id}-{:04}", self.next_terminal_seq);
        self.next_terminal_seq += 1;
        session_id
    }

    pub(super) fn next_workspace_id(&self) -> String {
        let mut sequence = 1_u64;
        loop {
            let workspace_id = format!("workspace-{sequence}");
            if !self.workspaces.contains_key(&workspace_id) {
                return workspace_id;
            }
            sequence = sequence.saturating_add(1);
        }
    }

    pub(super) fn clear_active_turns_for_thread(&mut self, thread_id: &str) -> bool {
        let previous_len = self.active_turns.len();
        self.active_turns
            .retain(|_, active_thread_id| active_thread_id != thread_id);
        self.active_turns.len() != previous_len
    }

    pub(super) fn latest_running_thread_id(&self) -> Option<String> {
        self.threads
            .values()
            .filter(|thread| thread.running)
            .max_by(|left, right| {
                left.updated_at
                    .cmp(&right.updated_at)
                    .then_with(|| left.id.cmp(&right.id))
            })
            .map(|thread| thread.id.clone())
    }

    pub(super) fn active_turn_lane_count(&self) -> usize {
        self.threads
            .values()
            .filter(|thread| thread.running)
            .count()
    }
}
