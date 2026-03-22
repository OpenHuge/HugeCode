mod common_utils;
mod git;
mod git_utils;
mod prompt;
mod prompt_utils;
mod runtime_metadata;
mod runtime_state;
mod state_fabric;
mod state_utils;
mod terminal_process;
mod terminal_utils;
mod thread_live;
mod turn_contract;
mod turn_send;
mod workspace_utils;
use crate::models::{
    ModelPoolEntry, ModelPoolResolver, RemoteStatus, ResolverContext, RuntimeProviderCatalogEntry,
    SettingsSummary, TerminalSessionState as TerminalSessionSummaryState, TerminalSessionSummary,
    ThreadSummary, TurnInterruptRequest, WorkspaceSummary,
};
use crate::remote::RemoteRuntime;
#[cfg(test)]
use common_utils::normalize_workspace_path;
use common_utils::{normalize_workspace_display_name, truncate_text, unix_timestamp_seconds};
pub use git::{
    RuntimeGitBranchEntry, RuntimeGitBranchesSnapshot, RuntimeGitChangeEntry,
    RuntimeGitChangesSnapshot, RuntimeGitCommitResult, RuntimeGitDiff, RuntimeGitOperationResult,
};
use ku0_runtime_shell_core::{
    push_terminal_line, terminate_terminal_process, TerminalProcessHandle, TerminalProcessRegistry,
    TerminalRawOutputSubscription, TerminalSessionRecord, TerminalSessionState,
    MAX_TERMINAL_LINE_CHARS, MAX_TERMINAL_SESSION_LINES,
};
pub use prompt::{RuntimePromptLibraryEntry, RuntimePromptScope};
pub(crate) use runtime_metadata::{
    current_runtime_state_path_display, current_terminal_shell_command_line,
    current_terminal_shell_source,
};
use serde::{Deserialize, Serialize};
pub use state_fabric::{
    NativeStateFabricChange, NativeStateFabricDelta, NativeStateFabricRead, NativeStateFabricScope,
};
use state_utils::{
    build_runtime_thread, load_runtime_state, restore_resolver_circuits_from_state,
    runtime_state_path_from_env, save_runtime_state, set_thread_idle,
    sync_resolver_circuits_to_state, terminal_to_chunk_read, terminal_to_summary,
    thread_to_summary,
};
#[cfg(test)]
use std::collections::BTreeSet;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
#[cfg(test)]
use std::process::ExitStatus;
use std::sync::{Mutex, OnceLock};
use terminal_process::spawn_terminal_process;
#[cfg(test)]
use terminal_utils::execute_terminal_command;
#[cfg(test)]
use terminal_utils::truncate_terminal_line;
use terminal_utils::{fallback_current_dir, parse_cd_target, resolve_terminal_cwd};
use workspace_utils::{
    build_workspace_file_entry, collect_workspace_file_paths, describe_file,
    resolve_workspace_file, resolve_workspace_root,
};
pub fn runtime_backend() -> &'static RuntimeBackend {
    static BACKEND: OnceLock<RuntimeBackend> = OnceLock::new();

    BACKEND.get_or_init(RuntimeBackend::new)
}

#[allow(dead_code)]
#[derive(Debug)]
pub struct RuntimeBackend {
    resolver: ModelPoolResolver,
    remote_runtime: RemoteRuntime,
    max_active_turn_lanes: usize,
    state_path: PathBuf,
    state: Mutex<RuntimeState>,
    state_fabric: Mutex<state_fabric::NativeStateFabricJournal>,
    thread_live_subscriptions: Mutex<HashMap<String, thread_live::RuntimeThreadLiveSubscription>>,
    next_thread_live_subscription_seq: Mutex<u64>,
    terminal_processes: Mutex<TerminalProcessRegistry>,
    #[cfg(test)]
    simulated_provider_failures: BTreeSet<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct RuntimeState {
    workspaces: HashMap<String, RuntimeWorkspace>,
    threads: HashMap<String, RuntimeThread>,
    workspace_threads: HashMap<String, Vec<String>>,
    terminal_sessions: HashMap<String, RuntimeTerminalSession>,
    workspace_terminal_sessions: HashMap<String, Vec<String>>,
    #[serde(default)]
    active_turns: HashMap<String, String>,
    #[serde(default)]
    provider_circuits: HashMap<String, RuntimeProviderCircuitState>,
    next_thread_seq: u64,
    next_turn_seq: u64,
    next_terminal_seq: u64,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
struct RuntimeProviderCircuitState {
    consecutive_failures: u32,
    cooldown_until_epoch_seconds: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct RuntimeWorkspace {
    id: String,
    path: String,
    display_name: String,
    connected: bool,
    default_model_id: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct RuntimeThread {
    id: String,
    workspace_id: String,
    title: String,
    unread: bool,
    running: bool,
    created_at: u64,
    updated_at: u64,
    provider: String,
    model_id: Option<String>,
    status: Option<String>,
    #[serde(default)]
    archived: bool,
    last_activity_at: Option<u64>,
    agent_role: Option<String>,
    agent_nickname: Option<String>,
}

type RuntimeTerminalSession = TerminalSessionRecord;

#[cfg(test)]
#[derive(Debug)]
struct TerminalCommandResult {
    lines: Vec<String>,
    new_cwd: Option<PathBuf>,
}

#[cfg(test)]
#[derive(Debug)]
struct TerminalSubprocessOutput {
    lines: TerminalLineAccumulator,
    status: ExitStatus,
}

#[derive(Debug)]
struct TerminalLineAccumulator {
    lines: Vec<String>,
    dropped_line_count: usize,
}

impl TerminalLineAccumulator {
    fn new() -> Self {
        Self {
            lines: Vec::new(),
            dropped_line_count: 0,
        }
    }

    fn push(&mut self, line: String) {
        if self.lines.len() < MAX_TERMINAL_OUTPUT_LINES {
            self.lines.push(line);
        } else {
            self.dropped_line_count += 1;
        }
    }

    fn into_lines(mut self) -> Vec<String> {
        if self.dropped_line_count > 0 {
            self.lines.push(format!(
                "... output truncated ({} additional line(s)).",
                self.dropped_line_count
            ));
        }
        self.lines
    }

    #[cfg(test)]
    fn merge_capture(&mut self, capture: TerminalStreamCapture) {
        for line in capture.lines {
            self.push(line);
        }
        self.dropped_line_count += capture.dropped_line_count;
    }
}

#[cfg(test)]
#[derive(Debug)]
struct TerminalStreamCapture {
    lines: Vec<String>,
    dropped_line_count: usize,
}

#[cfg(test)]
impl TerminalStreamCapture {
    fn new() -> Self {
        Self {
            lines: Vec::new(),
            dropped_line_count: 0,
        }
    }

    fn push(&mut self, line: String) {
        if self.lines.len() < MAX_TERMINAL_OUTPUT_LINES {
            self.lines.push(line);
        } else {
            self.dropped_line_count += 1;
        }
    }
}

const MAX_TERMINAL_OUTPUT_LINES: usize = 200;
const DEFAULT_MAX_ACTIVE_TURN_LANES: usize = 2;
const MAX_ACTIVE_TURN_LANES_HARD_LIMIT: usize = 32;
const MAX_ACTIVE_TURN_LANES_ENV: &str = "CODE_TAURI_MAX_ACTIVE_TURN_LANES";
const RUNTIME_STATE_VERSION: u32 = 1;
const RUNTIME_STATE_ENV_PATH: &str = "CODE_TAURI_RUNTIME_STATE_PATH";
const RUNTIME_STATE_FILENAME: &str = "runtime-state.json";

fn parse_max_active_turn_lanes(raw: Option<&str>) -> usize {
    let Some(raw_value) = raw.map(str::trim).filter(|value| !value.is_empty()) else {
        return DEFAULT_MAX_ACTIVE_TURN_LANES;
    };

    let Ok(parsed) = raw_value.parse::<usize>() else {
        return DEFAULT_MAX_ACTIVE_TURN_LANES;
    };
    if parsed == 0 {
        return DEFAULT_MAX_ACTIVE_TURN_LANES;
    }
    parsed.min(MAX_ACTIVE_TURN_LANES_HARD_LIMIT)
}

fn resolve_max_active_turn_lanes_from_env() -> usize {
    parse_max_active_turn_lanes(std::env::var(MAX_ACTIVE_TURN_LANES_ENV).ok().as_deref())
}

fn lane_count_to_u32(value: usize) -> u32 {
    u32::try_from(value).unwrap_or(u32::MAX)
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalChunkRead {
    pub session_id: String,
    pub workspace_id: String,
    pub state: TerminalSessionSummaryState,
    pub cursor: u64,
    pub updated_at: u64,
    pub chunks: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct RuntimeStateSnapshot {
    version: u32,
    state: RuntimeState,
}

#[derive(Clone, Debug, Serialize)]
struct RuntimeStateSnapshotRef<'a> {
    version: u32,
    state: &'a RuntimeState,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeWorkspaceFileEntry {
    pub id: String,
    pub path: String,
    pub summary: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeWorkspaceFileContent {
    pub id: String,
    pub path: String,
    pub summary: String,
    pub content: String,
}

impl RuntimeBackend {
    pub fn new() -> Self {
        Self::new_with(ResolverContext::from_env(), RemoteRuntime::from_env())
    }

    pub fn new_with(resolver_context: ResolverContext, remote_runtime: RemoteRuntime) -> Self {
        Self::new_with_state_path(
            resolver_context,
            remote_runtime,
            runtime_state_path_from_env(),
        )
    }

    fn new_with_state_path(
        resolver_context: ResolverContext,
        remote_runtime: RemoteRuntime,
        state_path: PathBuf,
    ) -> Self {
        Self::new_with_state_path_and_lane_limit(resolver_context, remote_runtime, state_path, None)
    }

    fn new_with_state_path_and_lane_limit(
        resolver_context: ResolverContext,
        remote_runtime: RemoteRuntime,
        state_path: PathBuf,
        max_active_turn_lanes_override: Option<usize>,
    ) -> Self {
        let max_active_turn_lanes = max_active_turn_lanes_override
            .filter(|value| *value > 0)
            .unwrap_or_else(resolve_max_active_turn_lanes_from_env)
            .min(MAX_ACTIVE_TURN_LANES_HARD_LIMIT);
        let resolver = ModelPoolResolver::new(resolver_context);
        let default_model_id = resolver.default_model_id();
        let seed_route = resolver
            .resolve_turn(None, default_model_id.as_deref())
            .map(|route| (route.provider, route.model_id));
        let seed_state = RuntimeState::seed(default_model_id.clone(), seed_route);
        let mut state = load_runtime_state(&state_path, seed_state, default_model_id.as_deref());
        restore_resolver_circuits_from_state(&resolver, &state);
        sync_resolver_circuits_to_state(&resolver, &mut state);

        let backend = Self {
            resolver,
            remote_runtime,
            max_active_turn_lanes,
            state_path,
            state_fabric: Mutex::new(state_fabric::NativeStateFabricJournal::from_state(&state)),
            state: Mutex::new(state),
            thread_live_subscriptions: Mutex::new(HashMap::new()),
            next_thread_live_subscription_seq: Mutex::new(1),
            terminal_processes: Mutex::new(TerminalProcessRegistry::new()),
            #[cfg(test)]
            simulated_provider_failures: BTreeSet::new(),
        };

        backend
    }

    #[cfg(test)]
    fn new_with_state_path_for_tests(
        resolver_context: ResolverContext,
        remote_runtime: RemoteRuntime,
        state_path: PathBuf,
        max_active_turn_lanes: usize,
    ) -> Self {
        Self::new_with_state_path_and_lane_limit(
            resolver_context,
            remote_runtime,
            state_path,
            Some(max_active_turn_lanes),
        )
    }

    #[cfg(test)]
    fn new_with_state_path_and_failures(
        resolver_context: ResolverContext,
        remote_runtime: RemoteRuntime,
        state_path: PathBuf,
        simulated_provider_failures: BTreeSet<String>,
    ) -> Self {
        let mut backend = Self::new_with_state_path_for_tests(
            resolver_context,
            remote_runtime,
            state_path,
            DEFAULT_MAX_ACTIVE_TURN_LANES,
        );
        backend.simulated_provider_failures = simulated_provider_failures
            .into_iter()
            .map(|provider| provider.to_ascii_lowercase())
            .collect::<BTreeSet<_>>();
        backend
    }

    #[cfg(test)]
    fn new_with_state_path_and_failures_and_lane_limit(
        resolver_context: ResolverContext,
        remote_runtime: RemoteRuntime,
        state_path: PathBuf,
        simulated_provider_failures: BTreeSet<String>,
        max_active_turn_lanes: usize,
    ) -> Self {
        let mut backend = Self::new_with_state_path_for_tests(
            resolver_context,
            remote_runtime,
            state_path,
            max_active_turn_lanes,
        );
        backend.simulated_provider_failures = simulated_provider_failures
            .into_iter()
            .map(|provider| provider.to_ascii_lowercase())
            .collect::<BTreeSet<_>>();
        backend
    }

    fn persist_locked_state(&self, state: &RuntimeState) {
        if let Err(error) = save_runtime_state(&self.state_path, state) {
            eprintln!("failed to persist runtime state: {error}");
        }
        let mut state_fabric = self
            .state_fabric
            .lock()
            .expect("native state fabric lock poisoned while persisting state");
        state_fabric.refresh_from_state(state);
    }

    fn ensure_terminal_process(&self, session_id: &str, cwd: &Path) -> Result<bool, String> {
        let mut registry = self
            .terminal_processes
            .lock()
            .expect("terminal process registry lock poisoned while checking process");
        registry
            .ensure_process(session_id, &spawn_terminal_process(cwd))
            .map_err(|error| error.to_string())
    }

    fn restart_terminal_process(&self, session_id: &str, cwd: &Path) -> Result<(), String> {
        let mut registry = self
            .terminal_processes
            .lock()
            .expect("terminal process registry lock poisoned while restarting process");
        registry
            .restart_process(session_id, &spawn_terminal_process(cwd))
            .map_err(|error| error.to_string())
    }

    fn write_terminal_process_stdin(
        &self,
        session_id: &str,
        cwd: &Path,
        command: &str,
    ) -> Result<(), String> {
        let _spawned = self.ensure_terminal_process(session_id, cwd)?;
        let mut registry = self
            .terminal_processes
            .lock()
            .expect("terminal process registry lock poisoned while writing command");
        registry
            .with_process_mut(session_id, |handle| handle.write_command(command))
            .map_err(|error| error.to_string())
    }

    fn write_terminal_process_raw_stdin(
        &self,
        session_id: &str,
        input: &str,
    ) -> Result<(), String> {
        let mut registry = self
            .terminal_processes
            .lock()
            .expect("terminal process registry lock poisoned while writing raw input");
        registry
            .with_process_mut(session_id, |handle| handle.write_raw_input(input))
            .map_err(|error| error.to_string())
    }

    fn drain_terminal_process_output(&self, session_id: &str) -> Vec<String> {
        let mut registry = self
            .terminal_processes
            .lock()
            .expect("terminal process registry lock poisoned while reading output");
        registry.drain_line_output(session_id)
    }

    fn drain_terminal_process_raw_output(&self, session_id: &str) -> Vec<String> {
        let mut registry = self
            .terminal_processes
            .lock()
            .expect("terminal process registry lock poisoned while reading raw output");
        registry.drain_raw_output(session_id)
    }

    fn subscribe_terminal_process_raw_output(
        &self,
        session_id: &str,
    ) -> Option<TerminalRawOutputSubscription> {
        let mut registry = self
            .terminal_processes
            .lock()
            .expect("terminal process registry lock poisoned while subscribing raw output");
        registry.subscribe_raw_output(session_id)
    }

    fn unsubscribe_terminal_process_raw_output(
        &self,
        session_id: &str,
        subscription_id: u64,
    ) -> bool {
        let mut registry = self
            .terminal_processes
            .lock()
            .expect("terminal process registry lock poisoned while unsubscribing raw output");
        registry.unsubscribe_raw_output(session_id, subscription_id)
    }

    fn take_terminal_process(&self, session_id: &str) -> Option<TerminalProcessHandle> {
        let mut registry = self
            .terminal_processes
            .lock()
            .expect("terminal process registry lock poisoned while removing process");
        registry.remove(session_id)
    }

    fn terminate_terminal_processes(&self, session_ids: &[String]) {
        let mut registry = self
            .terminal_processes
            .lock()
            .expect("terminal process registry lock poisoned while removing process set");
        registry.terminate_many(session_ids);
    }

    fn append_terminal_runtime_message(&self, session_id: &str, message: String) {
        let mut state = self
            .state
            .lock()
            .expect("runtime state lock poisoned while recording terminal message");
        let mut changed = false;
        if let Some(session) = state.terminal_sessions.get_mut(session_id) {
            if session.is_active() {
                push_terminal_line(session, message);
                session.touch(unix_timestamp_seconds());
                changed = true;
            }
        }
        if changed {
            self.persist_locked_state(&state);
        }
    }

    fn terminal_summary_if_inactive_after_process_ready(
        &self,
        session_id: &str,
    ) -> Option<TerminalSessionSummary> {
        let summary = {
            let state = self
                .state
                .lock()
                .expect("runtime state lock poisoned while re-checking terminal activity");
            let session = state.terminal_sessions.get(session_id)?;
            if session.is_active() {
                return None;
            }
            terminal_to_summary(session)
        };

        if let Some(handle) = self.take_terminal_process(session_id) {
            terminate_terminal_process(handle);
        }
        Some(summary)
    }

    #[cfg(test)]
    fn should_simulate_provider_failure(&self, provider: &str) -> bool {
        self.simulated_provider_failures.contains(provider)
    }

    #[cfg(not(test))]
    #[cfg_attr(not(test), allow(dead_code))]
    fn should_simulate_provider_failure(&self, _provider: &str) -> bool {
        false
    }

    pub fn workspaces(&self) -> Vec<WorkspaceSummary> {
        let state = self
            .state
            .lock()
            .expect("runtime state lock poisoned while listing workspaces");

        let mut workspaces: Vec<_> = state
            .workspaces
            .values()
            .map(|workspace| WorkspaceSummary {
                id: workspace.id.clone(),
                path: workspace.path.clone(),
                display_name: workspace.display_name.clone(),
                connected: workspace.connected,
                default_model_id: workspace.default_model_id.clone(),
            })
            .collect();

        workspaces.sort_by(|left, right| left.id.cmp(&right.id));
        workspaces
    }

    #[cfg(test)]
    pub fn create_workspace(&self, path: &str, display_name: Option<String>) -> WorkspaceSummary {
        let mut state = self
            .state
            .lock()
            .expect("runtime state lock poisoned while creating workspace");

        let workspace_id = state.next_workspace_id();
        let normalized_path = normalize_workspace_path(path);
        let normalized_display_name = normalize_workspace_display_name(
            display_name.as_deref(),
            &normalized_path,
            &workspace_id,
        );
        let workspace = RuntimeWorkspace {
            id: workspace_id.clone(),
            path: normalized_path.clone(),
            display_name: normalized_display_name,
            connected: resolve_workspace_root(&normalized_path).is_some(),
            default_model_id: self.resolver.default_model_id(),
        };

        state
            .workspaces
            .insert(workspace_id.clone(), workspace.clone());
        state
            .workspace_threads
            .entry(workspace_id.clone())
            .or_default();
        state
            .workspace_terminal_sessions
            .entry(workspace_id.clone())
            .or_default();
        self.persist_locked_state(&state);

        WorkspaceSummary {
            id: workspace.id,
            path: workspace.path,
            display_name: workspace.display_name,
            connected: workspace.connected,
            default_model_id: workspace.default_model_id,
        }
    }

    pub fn create_workspace_if_valid(
        &self,
        path: &str,
        display_name: Option<String>,
    ) -> Result<WorkspaceSummary, String> {
        let canonical_root = resolve_workspace_root(path)
            .ok_or_else(|| "workspace path must reference an existing directory".to_string())?;
        let canonical_path = canonical_root.to_string_lossy().to_string();

        let mut state = self
            .state
            .lock()
            .expect("runtime state lock poisoned while creating workspace");

        if let Some(existing) = state.workspaces.values().find(|workspace| {
            resolve_workspace_root(workspace.path.as_str())
                .as_ref()
                .is_some_and(|root| root == &canonical_root)
        }) {
            return Ok(WorkspaceSummary {
                id: existing.id.clone(),
                path: existing.path.clone(),
                display_name: existing.display_name.clone(),
                connected: existing.connected,
                default_model_id: existing.default_model_id.clone(),
            });
        }

        let workspace_id = state.next_workspace_id();
        let normalized_display_name = normalize_workspace_display_name(
            display_name.as_deref(),
            &canonical_path,
            &workspace_id,
        );
        let workspace = RuntimeWorkspace {
            id: workspace_id.clone(),
            path: canonical_path.clone(),
            display_name: normalized_display_name,
            connected: true,
            default_model_id: self.resolver.default_model_id(),
        };

        state
            .workspaces
            .insert(workspace_id.clone(), workspace.clone());
        state
            .workspace_threads
            .entry(workspace_id.clone())
            .or_default();
        state
            .workspace_terminal_sessions
            .entry(workspace_id.clone())
            .or_default();
        self.persist_locked_state(&state);

        Ok(WorkspaceSummary {
            id: workspace.id,
            path: workspace.path,
            display_name: workspace.display_name,
            connected: workspace.connected,
            default_model_id: workspace.default_model_id,
        })
    }

    pub fn rename_workspace(
        &self,
        workspace_id: &str,
        display_name: String,
    ) -> Option<WorkspaceSummary> {
        let normalized_workspace_id = workspace_id.trim();
        if normalized_workspace_id.is_empty() {
            return None;
        }

        let normalized_display_name = display_name.trim();
        if normalized_display_name.is_empty() {
            return None;
        }

        let mut state = self
            .state
            .lock()
            .expect("runtime state lock poisoned while renaming workspace");
        let workspace = state.workspaces.get_mut(normalized_workspace_id)?;
        workspace.display_name = normalized_display_name.to_string();

        let summary = WorkspaceSummary {
            id: workspace.id.clone(),
            path: workspace.path.clone(),
            display_name: workspace.display_name.clone(),
            connected: workspace.connected,
            default_model_id: workspace.default_model_id.clone(),
        };
        self.persist_locked_state(&state);
        Some(summary)
    }

    pub fn remove_workspace(&self, workspace_id: &str) -> bool {
        let normalized_workspace_id = workspace_id.trim();
        if normalized_workspace_id.is_empty() {
            return false;
        }

        let mut state = self
            .state
            .lock()
            .expect("runtime state lock poisoned while removing workspace");
        if !state.workspaces.contains_key(normalized_workspace_id) {
            return false;
        }

        state.workspaces.remove(normalized_workspace_id);
        let mut removed_terminal_session_ids = Vec::new();

        if let Some(thread_ids) = state.workspace_threads.remove(normalized_workspace_id) {
            for thread_id in thread_ids {
                state.threads.remove(&thread_id);
            }
        }
        state
            .threads
            .retain(|_, thread| thread.workspace_id != normalized_workspace_id);
        let thread_ids = state.threads.keys().cloned().collect::<HashSet<_>>();
        state
            .active_turns
            .retain(|_, thread_id| thread_ids.contains(thread_id));
        for listed_ids in state.workspace_threads.values_mut() {
            listed_ids.retain(|thread_id| thread_ids.contains(thread_id));
        }

        if let Some(session_ids) = state
            .workspace_terminal_sessions
            .remove(normalized_workspace_id)
        {
            for session_id in session_ids {
                removed_terminal_session_ids.push(session_id.clone());
                state.terminal_sessions.remove(&session_id);
            }
        }
        state.terminal_sessions.retain(|session_id, session| {
            let keep = session.workspace_id != normalized_workspace_id;
            if !keep {
                removed_terminal_session_ids.push(session_id.clone());
            }
            keep
        });
        let session_ids = state
            .terminal_sessions
            .keys()
            .cloned()
            .collect::<HashSet<_>>();
        for listed_ids in state.workspace_terminal_sessions.values_mut() {
            listed_ids.retain(|session_id| session_ids.contains(session_id));
        }

        self.persist_locked_state(&state);
        drop(state);
        self.terminate_terminal_processes(&removed_terminal_session_ids);
        true
    }
    pub fn model_pool(&self) -> Vec<ModelPoolEntry> {
        self.resolver.model_pool()
    }

    pub fn provider_catalog(&self) -> Vec<RuntimeProviderCatalogEntry> {
        self.resolver.provider_catalog()
    }

    pub fn remote_status(&self) -> RemoteStatus {
        RemoteStatus {
            connected: self.remote_runtime.connected(),
            mode: self.remote_runtime.mode().as_str().to_string(),
            endpoint: self
                .remote_runtime
                .endpoint()
                .map(std::borrow::ToOwned::to_owned),
            latency_ms: self.remote_runtime.latency_ms(),
        }
    }

    pub fn settings_summary(&self) -> SettingsSummary {
        let active_turn_lanes = {
            let state = self
                .state
                .lock()
                .expect("runtime state lock poisoned while summarizing settings");
            state.active_turn_lane_count()
        };

        SettingsSummary {
            default_model_strategy: "unified-auto-routing".to_string(),
            remote_enabled: self.remote_runtime.connected()
                || self.resolver.has_available_oauth_models(),
            default_reason_effort: "high".to_string(),
            default_access_mode: "full-access".to_string(),
            max_active_turn_lanes: lane_count_to_u32(self.max_active_turn_lanes),
            active_turn_lanes: lane_count_to_u32(active_turn_lanes),
        }
    }

    pub fn threads(&self, workspace_id: &str) -> Vec<ThreadSummary> {
        let state = self
            .state
            .lock()
            .expect("runtime state lock poisoned while listing threads");

        let thread_ids = state
            .workspace_threads
            .get(workspace_id)
            .cloned()
            .unwrap_or_default();

        let mut threads: Vec<_> = thread_ids
            .iter()
            .filter_map(|thread_id| state.threads.get(thread_id))
            .map(thread_to_summary)
            .collect();

        threads.sort_by(|left, right| {
            right
                .updated_at
                .cmp(&left.updated_at)
                .then_with(|| left.id.cmp(&right.id))
        });

        threads
    }

    pub fn create_thread(&self, workspace_id: &str, title: Option<String>) -> ThreadSummary {
        let mut state = self
            .state
            .lock()
            .expect("runtime state lock poisoned while creating thread");

        state.ensure_workspace(workspace_id, self.resolver.default_model_id().as_deref());
        let workspace_default_model_id = state
            .workspaces
            .get(workspace_id)
            .and_then(|workspace| workspace.default_model_id.clone());
        let now = unix_timestamp_seconds();
        let title_hint = title
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| "New thread".to_string());
        let thread_id = state.ensure_thread(workspace_id, None, title_hint, now);

        let summary = if let Some(thread) = state.threads.get_mut(&thread_id) {
            set_thread_idle(thread, now);
            thread.unread = false;
            if let Some(route) = self
                .resolver
                .resolve_turn(None, workspace_default_model_id.as_deref())
            {
                thread.provider = route.provider;
                thread.model_id = Some(route.model_id);
            }
            thread_to_summary(thread)
        } else {
            thread_to_summary(&build_runtime_thread(
                thread_id,
                workspace_id.to_string(),
                "New thread".to_string(),
                now,
                "unknown".to_string(),
                None,
            ))
        };

        self.persist_locked_state(&state);
        summary
    }

    pub fn resume_thread(&self, workspace_id: &str, thread_id: &str) -> Option<ThreadSummary> {
        let mut state = self
            .state
            .lock()
            .expect("runtime state lock poisoned while resuming thread");
        let now = unix_timestamp_seconds();
        let workspace_matches = state
            .threads
            .get(thread_id)
            .map(|thread| thread.workspace_id == workspace_id)?;
        if !workspace_matches {
            return None;
        }
        state.clear_active_turns_for_thread(thread_id);
        let summary = {
            let thread = state.threads.get_mut(thread_id)?;
            thread.unread = false;
            set_thread_idle(thread, now);
            thread_to_summary(thread)
        };
        self.persist_locked_state(&state);
        Some(summary)
    }

    pub fn archive_thread(&self, workspace_id: &str, thread_id: &str) -> bool {
        let mut state = self
            .state
            .lock()
            .expect("runtime state lock poisoned while archiving thread");
        let Some(thread) = state.threads.get(thread_id) else {
            return false;
        };
        if thread.workspace_id != workspace_id {
            return false;
        }

        state.clear_active_turns_for_thread(thread_id);
        state.threads.remove(thread_id);
        if let Some(thread_ids) = state.workspace_threads.get_mut(workspace_id) {
            thread_ids.retain(|candidate| candidate != thread_id);
        }
        self.persist_locked_state(&state);
        true
    }

    pub fn interrupt_turn(&self, payload: &TurnInterruptRequest) -> bool {
        let requested_turn_id = payload
            .turn_id
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string);
        let _reason = payload.reason.as_deref().map(str::trim).unwrap_or_default();

        let mut state = self
            .state
            .lock()
            .expect("runtime state lock poisoned while interrupting turn");

        let target_thread_id = if let Some(turn_id) = requested_turn_id.as_deref() {
            state.active_turns.get(turn_id).cloned()
        } else {
            state.latest_running_thread_id()
        };
        let Some(thread_id) = target_thread_id else {
            return false;
        };

        let interrupted = if let Some(thread) = state.threads.get_mut(&thread_id) {
            if thread.running {
                set_thread_idle(thread, unix_timestamp_seconds());
                true
            } else {
                false
            }
        } else {
            false
        };

        let cleaned_mapping = state.clear_active_turns_for_thread(&thread_id);
        if interrupted || cleaned_mapping {
            self.persist_locked_state(&state);
        }
        interrupted
    }

    pub fn terminal_open(&self, workspace_id: &str) -> TerminalSessionSummary {
        let (session_id, cwd) = {
            let mut state = self
                .state
                .lock()
                .expect("runtime state lock poisoned while opening terminal");
            state.ensure_workspace(workspace_id, self.resolver.default_model_id().as_deref());
            let cwd = state
                .workspaces
                .get(workspace_id)
                .and_then(|workspace| resolve_workspace_root(&workspace.path))
                .unwrap_or_else(fallback_current_dir);
            let session_id = state.next_terminal_id(workspace_id);
            (session_id, cwd)
        };

        let spawn_error = self
            .restart_terminal_process(&session_id, &cwd)
            .err()
            .map(|error| format!("Failed to start terminal shell: {error}"));

        let mut state = self
            .state
            .lock()
            .expect("runtime state lock poisoned while opening terminal");
        let now = unix_timestamp_seconds();
        let mut lines = vec![
            "Terminal session opened.".to_string(),
            format!("Working directory: {}", cwd.display()),
        ];
        if let Some(message) = &spawn_error {
            lines.push(message.clone());
        }
        let mut session = RuntimeTerminalSession::new(
            session_id.clone(),
            workspace_id.to_string(),
            now,
            Some(cwd.clone()),
            if spawn_error.is_none() {
                TerminalSessionState::Created
            } else {
                TerminalSessionState::IoFailed
            },
        );
        session.lines = lines;
        state
            .workspace_terminal_sessions
            .entry(workspace_id.to_string())
            .or_default()
            .push(session_id.clone());
        state.terminal_sessions.insert(session_id, session.clone());
        self.persist_locked_state(&state);
        terminal_to_summary(&session)
    }

    pub fn terminal_write(&self, session_id: &str, input: &str) -> Option<TerminalSessionSummary> {
        let command = input.trim();
        if command.is_empty() {
            let state = self
                .state
                .lock()
                .expect("runtime state lock poisoned while writing terminal input");
            let session = state.terminal_sessions.get(session_id)?;
            return Some(terminal_to_summary(session));
        }

        let cwd = {
            let mut state = self
                .state
                .lock()
                .expect("runtime state lock poisoned while writing terminal input");
            let cwd = {
                let session = state.terminal_sessions.get_mut(session_id)?;
                if !session.is_active() {
                    return Some(terminal_to_summary(session));
                }
                session.touch(unix_timestamp_seconds());
                push_terminal_line(session, format!("> {command}"));
                session.cwd.clone().unwrap_or_else(fallback_current_dir)
            };
            self.persist_locked_state(&state);
            cwd
        };

        if let Some(target) = parse_cd_target(command) {
            let mut status_line = None;
            let mut next_cwd = None;

            match resolve_terminal_cwd(&cwd, target.as_str()) {
                Ok(resolved_cwd) => {
                    let changed = resolved_cwd != cwd;
                    if changed {
                        if let Err(error) =
                            self.restart_terminal_process(session_id, resolved_cwd.as_path())
                        {
                            status_line = Some(format!(
                                "Failed to restart terminal shell in {}: {error}",
                                resolved_cwd.display()
                            ));
                        } else {
                            next_cwd = Some(resolved_cwd.clone());
                        }
                    } else {
                        next_cwd = Some(resolved_cwd.clone());
                    }

                    let message_cwd = next_cwd.clone().unwrap_or(resolved_cwd);
                    if status_line.is_none() {
                        status_line =
                            Some(format!("Changed directory to {}.", message_cwd.display()));
                    }
                }
                Err(message) => {
                    status_line = Some(message);
                }
            }

            let mut state = self
                .state
                .lock()
                .expect("runtime state lock poisoned while writing terminal input");
            let summary = {
                let session = state.terminal_sessions.get_mut(session_id)?;
                if !session.is_active() {
                    return Some(terminal_to_summary(session));
                }
                if let Some(resolved_cwd) = next_cwd {
                    session.set_cwd(resolved_cwd);
                }
                if let Some(line) = status_line {
                    push_terminal_line(session, line);
                }
                session.touch(unix_timestamp_seconds());
                terminal_to_summary(session)
            };
            self.persist_locked_state(&state);
            return Some(summary);
        }

        let write_error = self
            .write_terminal_process_stdin(session_id, cwd.as_path(), command)
            .err()
            .map(|error| format!("Failed to send command to terminal shell: {error}"));

        let mut state = self
            .state
            .lock()
            .expect("runtime state lock poisoned while writing terminal input");
        let summary = {
            let session = state.terminal_sessions.get_mut(session_id)?;
            if !session.is_active() {
                return Some(terminal_to_summary(session));
            }
            if let Some(message) = write_error {
                push_terminal_line(session, message);
            }
            session.touch(unix_timestamp_seconds());
            terminal_to_summary(session)
        };
        self.persist_locked_state(&state);
        Some(summary)
    }

    pub fn terminal_input_raw(&self, session_id: &str, input: &str) -> bool {
        let cwd = {
            let state = self
                .state
                .lock()
                .expect("runtime state lock poisoned while writing raw terminal input");
            let Some(session) = state.terminal_sessions.get(session_id) else {
                return false;
            };
            if !session.is_active() {
                return false;
            }
            session.cwd.clone().unwrap_or_else(fallback_current_dir)
        };

        if let Err(error) = self.ensure_terminal_process(session_id, cwd.as_path()) {
            self.append_terminal_runtime_message(
                session_id,
                format!("Failed to send terminal raw input: {error}"),
            );
            return false;
        }

        if self
            .terminal_summary_if_inactive_after_process_ready(session_id)
            .is_some()
        {
            return false;
        }

        let write_result = self.write_terminal_process_raw_stdin(session_id, input);
        match write_result {
            Ok(()) => {
                let mut state = self
                    .state
                    .lock()
                    .expect("runtime state lock poisoned while recording terminal raw input");
                if let Some(session) = state.terminal_sessions.get_mut(session_id) {
                    if session.is_active() {
                        session.touch(unix_timestamp_seconds());
                        self.persist_locked_state(&state);
                        return true;
                    }
                }
                false
            }
            Err(error) => {
                self.append_terminal_runtime_message(
                    session_id,
                    format!("Failed to send terminal raw input: {error}"),
                );
                false
            }
        }
    }

    pub fn terminal_interrupt(&self, session_id: &str) -> bool {
        let cwd = {
            let state = self
                .state
                .lock()
                .expect("runtime state lock poisoned while interrupting terminal");
            let Some(session) = state.terminal_sessions.get(session_id) else {
                return false;
            };
            if !session.is_active() {
                return false;
            }
            session.cwd.clone().unwrap_or_else(fallback_current_dir)
        };

        if let Err(error) = self.ensure_terminal_process(session_id, cwd.as_path()) {
            self.append_terminal_runtime_message(
                session_id,
                format!("Failed to send terminal interrupt: {error}"),
            );
            return false;
        }

        if self
            .terminal_summary_if_inactive_after_process_ready(session_id)
            .is_some()
        {
            return false;
        }

        let interrupt_result = {
            let mut registry = self
                .terminal_processes
                .lock()
                .expect("terminal process registry lock poisoned while interrupting process");
            registry
                .with_process_mut(session_id, |handle| handle.send_interrupt())
                .map_err(|error| error.to_string())
        };

        match interrupt_result {
            Ok(()) => true,
            Err(error) => {
                self.append_terminal_runtime_message(
                    session_id,
                    format!("Failed to send terminal interrupt: {error}"),
                );
                false
            }
        }
    }

    pub fn terminal_resize(&self, session_id: &str, rows: u16, cols: u16) -> bool {
        if rows == 0 || cols == 0 {
            return false;
        }

        let cwd = {
            let state = self
                .state
                .lock()
                .expect("runtime state lock poisoned while resizing terminal");
            let Some(session) = state.terminal_sessions.get(session_id) else {
                return false;
            };
            if !session.is_active() {
                return false;
            }
            session.cwd.clone().unwrap_or_else(fallback_current_dir)
        };

        if let Err(error) = self.ensure_terminal_process(session_id, cwd.as_path()) {
            self.append_terminal_runtime_message(
                session_id,
                format!("Failed to resize terminal shell: {error}"),
            );
            return false;
        }

        if self
            .terminal_summary_if_inactive_after_process_ready(session_id)
            .is_some()
        {
            return false;
        }

        let resize_result = {
            let mut registry = self
                .terminal_processes
                .lock()
                .expect("terminal process registry lock poisoned while resizing process");
            registry
                .with_process_mut(session_id, |handle| handle.resize(rows, cols))
                .map_err(|error| error.to_string())
        };

        match resize_result {
            Ok(()) => true,
            Err(error) => {
                self.append_terminal_runtime_message(
                    session_id,
                    format!("Failed to resize terminal shell: {error}"),
                );
                false
            }
        }
    }

    pub fn terminal_read(&self, session_id: &str) -> Option<TerminalSessionSummary> {
        let (active, cwd) = {
            let state = self
                .state
                .lock()
                .expect("runtime state lock poisoned while reading terminal output");
            let session = state.terminal_sessions.get(session_id)?;
            (
                session.is_active(),
                session.cwd.clone().unwrap_or_else(fallback_current_dir),
            )
        };

        if !active {
            let state = self
                .state
                .lock()
                .expect("runtime state lock poisoned while reading terminal output");
            let session = state.terminal_sessions.get(session_id)?;
            return Some(terminal_to_summary(session));
        }

        if let Err(error) = self.ensure_terminal_process(session_id, cwd.as_path()) {
            let mut state = self
                .state
                .lock()
                .expect("runtime state lock poisoned while reading terminal output");
            let mut changed = false;
            let summary = {
                let session = state.terminal_sessions.get_mut(session_id)?;
                if session.is_active() {
                    push_terminal_line(
                        session,
                        format!("Failed to ensure terminal shell process: {error}"),
                    );
                    session.touch(unix_timestamp_seconds());
                    changed = true;
                }
                terminal_to_summary(session)
            };
            if changed {
                self.persist_locked_state(&state);
            }
            return Some(summary);
        }

        if let Some(summary) = self.terminal_summary_if_inactive_after_process_ready(session_id) {
            return Some(summary);
        }

        let drained_raw = self.drain_terminal_process_output(session_id);
        let _drained_chunks = self.drain_terminal_process_raw_output(session_id);
        let mut drained = TerminalLineAccumulator::new();
        for line in drained_raw {
            drained.push(line);
        }
        let lines = drained.into_lines();

        let mut state = self
            .state
            .lock()
            .expect("runtime state lock poisoned while reading terminal output");
        let mut changed = false;
        let summary = {
            let session = state.terminal_sessions.get_mut(session_id)?;
            if !session.is_active() {
                return Some(terminal_to_summary(session));
            }
            for line in lines {
                push_terminal_line(session, line);
                changed = true;
            }
            if changed {
                session.touch(unix_timestamp_seconds());
            }
            terminal_to_summary(session)
        };
        if changed {
            self.persist_locked_state(&state);
        }
        Some(summary)
    }

    pub fn terminal_read_chunks(&self, session_id: &str) -> Option<TerminalChunkRead> {
        let (active, cwd) = {
            let state = self
                .state
                .lock()
                .expect("runtime state lock poisoned while reading terminal chunks");
            let session = state.terminal_sessions.get(session_id)?;
            (
                session.is_active(),
                session.cwd.clone().unwrap_or_else(fallback_current_dir),
            )
        };

        if !active {
            let state = self
                .state
                .lock()
                .expect("runtime state lock poisoned while reading terminal chunks");
            let session = state.terminal_sessions.get(session_id)?;
            return Some(terminal_to_chunk_read(session, Vec::new()));
        }

        if let Err(error) = self.ensure_terminal_process(session_id, cwd.as_path()) {
            let mut state = self
                .state
                .lock()
                .expect("runtime state lock poisoned while reading terminal chunks");
            let mut changed = false;
            let summary = {
                let session = state.terminal_sessions.get_mut(session_id)?;
                if session.is_active() {
                    push_terminal_line(
                        session,
                        format!("Failed to ensure terminal shell process: {error}"),
                    );
                    session.touch(unix_timestamp_seconds());
                    changed = true;
                }
                terminal_to_chunk_read(session, Vec::new())
            };
            if changed {
                self.persist_locked_state(&state);
            }
            return Some(summary);
        }

        if let Some(summary) = self.terminal_summary_if_inactive_after_process_ready(session_id) {
            return Some(TerminalChunkRead {
                session_id: summary.id,
                workspace_id: summary.workspace_id,
                state: summary.state,
                cursor: summary.lines.len() as u64,
                updated_at: summary.updated_at,
                chunks: Vec::new(),
            });
        }

        let drained_lines = self.drain_terminal_process_output(session_id);
        let chunks = self.drain_terminal_process_raw_output(session_id);
        let chunk_count = chunks.len();
        let mut drained = TerminalLineAccumulator::new();
        for line in drained_lines {
            drained.push(line);
        }
        let lines = drained.into_lines();

        let mut state = self
            .state
            .lock()
            .expect("runtime state lock poisoned while reading terminal chunks");
        let mut changed = false;
        let summary = {
            let session = state.terminal_sessions.get_mut(session_id)?;
            if !session.is_active() {
                return Some(terminal_to_chunk_read(session, Vec::new()));
            }
            for line in lines {
                push_terminal_line(session, line);
                changed = true;
            }
            if chunk_count > 0 {
                changed = true;
            }
            if changed {
                session.touch(unix_timestamp_seconds());
            }
            terminal_to_chunk_read(session, chunks)
        };
        if changed {
            self.persist_locked_state(&state);
        }
        Some(summary)
    }

    pub fn terminal_subscribe_raw_output(
        &self,
        session_id: &str,
    ) -> Option<TerminalRawOutputSubscription> {
        let (active, cwd) = {
            let state = self
                .state
                .lock()
                .expect("runtime state lock poisoned while subscribing terminal output");
            let session = state.terminal_sessions.get(session_id)?;
            (
                session.is_active(),
                session.cwd.clone().unwrap_or_else(fallback_current_dir),
            )
        };

        if !active {
            return None;
        }

        if let Err(error) = self.ensure_terminal_process(session_id, cwd.as_path()) {
            self.append_terminal_runtime_message(
                session_id,
                format!("Failed to attach terminal stream relay: {error}"),
            );
            return None;
        }

        if self
            .terminal_summary_if_inactive_after_process_ready(session_id)
            .is_some()
        {
            return None;
        }

        self.subscribe_terminal_process_raw_output(session_id)
    }

    pub fn terminal_unsubscribe_raw_output(&self, session_id: &str, subscription_id: u64) -> bool {
        self.unsubscribe_terminal_process_raw_output(session_id, subscription_id)
    }

    pub fn terminal_close(&self, session_id: &str) -> bool {
        let mut state = self
            .state
            .lock()
            .expect("runtime state lock poisoned while closing terminal");
        let Some(session) = state.terminal_sessions.get_mut(session_id) else {
            return false;
        };
        session.set_state(TerminalSessionState::Exited, unix_timestamp_seconds());
        push_terminal_line(session, "Terminal session closed.".to_string());
        self.persist_locked_state(&state);
        drop(state);
        if let Some(handle) = self.take_terminal_process(session_id) {
            terminate_terminal_process(handle);
        }
        true
    }

    pub fn workspace_files(&self, workspace_id: &str) -> Vec<RuntimeWorkspaceFileEntry> {
        let Some(root) = self.workspace_root(workspace_id) else {
            return Vec::new();
        };

        let mut files = collect_workspace_file_paths(&root, 80)
            .into_iter()
            .filter_map(|absolute| build_workspace_file_entry(&root, &absolute))
            .collect::<Vec<_>>();

        files.sort_by(|left, right| left.path.cmp(&right.path));
        files
    }

    pub fn workspace_file_read(
        &self,
        workspace_id: &str,
        file_id: &str,
    ) -> Option<RuntimeWorkspaceFileContent> {
        let root = self.workspace_root(workspace_id)?;
        let absolute = resolve_workspace_file(&root, file_id)?;
        let content = fs::read(&absolute)
            .ok()
            .map(|bytes| String::from_utf8_lossy(&bytes).to_string())?;
        let summary = describe_file(&absolute);

        Some(RuntimeWorkspaceFileContent {
            id: file_id.to_string(),
            path: file_id.to_string(),
            summary,
            content: truncate_text(content, 40_000),
        })
    }

    fn workspace_root(&self, workspace_id: &str) -> Option<PathBuf> {
        let workspace_path = {
            let state = self
                .state
                .lock()
                .expect("runtime state lock poisoned while resolving workspace path");
            state
                .workspaces
                .get(workspace_id)
                .map(|workspace| workspace.path.clone())
        }?;

        resolve_workspace_root(&workspace_path)
    }
}

impl Drop for RuntimeBackend {
    fn drop(&mut self) {
        if let Ok(mut registry) = self.terminal_processes.lock() {
            registry.terminate_all();
        }
    }
}
#[cfg(test)]
mod tests;
#[cfg(test)]
mod tests_terminal;
