use super::*;
use crate::models::TerminalSessionState as TerminalSessionSummaryState;
use std::io::Write;

const RUNTIME_STATE_DIR_NAME: &str = ".hugecode";

pub(super) fn runtime_state_path_from_env() -> PathBuf {
    if let Ok(path) = std::env::var(RUNTIME_STATE_ENV_PATH) {
        let trimmed = path.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed);
        }
    }

    default_runtime_state_path()
}

fn default_runtime_state_path() -> PathBuf {
    desktop_state_home_dir()
        .or_else(home_dir)
        .unwrap_or_else(std::env::temp_dir)
        .join(RUNTIME_STATE_DIR_NAME)
        .join(RUNTIME_STATE_FILENAME)
}

fn desktop_state_home_dir() -> Option<PathBuf> {
    if cfg!(target_os = "macos") {
        return home_dir()
            .map(|home| home.join("Library").join("Application Support"))
            .or_else(|| std::env::var_os("TMPDIR").map(PathBuf::from));
    }
    if cfg!(target_os = "windows") {
        return std::env::var_os("LOCALAPPDATA")
            .map(PathBuf::from)
            .or_else(|| std::env::var_os("APPDATA").map(PathBuf::from));
    }
    std::env::var_os("XDG_STATE_HOME")
        .map(PathBuf::from)
        .or_else(|| home_dir().map(|home| home.join(".local").join("state")))
}

fn legacy_runtime_state_paths() -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if cfg!(target_os = "windows") {
        if let Some(base_dir) = std::env::var_os("LOCALAPPDATA")
            .or_else(|| std::env::var_os("APPDATA"))
            .map(PathBuf::from)
        {
            candidates.push(base_dir.join("hugecode").join(RUNTIME_STATE_FILENAME));
            candidates.push(
                base_dir
                    .join("OpenFast")
                    .join("Code")
                    .join(RUNTIME_STATE_FILENAME),
            );
        }
        return candidates;
    }

    if let Some(base_dir) = desktop_state_home_dir() {
        candidates.push(base_dir.join("hugecode").join(RUNTIME_STATE_FILENAME));
        candidates.push(
            base_dir
                .join("open-wrap")
                .join("code")
                .join(RUNTIME_STATE_FILENAME),
        );
    }
    candidates.push(
        std::env::temp_dir()
            .join("hugecode")
            .join(RUNTIME_STATE_FILENAME),
    );
    candidates.push(
        std::env::temp_dir()
            .join("open-wrap")
            .join("code")
            .join(RUNTIME_STATE_FILENAME),
    );
    candidates
}

fn migrate_legacy_runtime_state_if_needed(state_path: &Path) -> io::Result<()> {
    if state_path.exists() {
        return Ok(());
    }

    let Some(source) = legacy_runtime_state_paths()
        .into_iter()
        .find(|candidate| candidate != state_path && candidate.exists())
    else {
        return Ok(());
    };

    if let Some(parent) = state_path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::copy(source.as_path(), state_path)?;
    Ok(())
}

fn home_dir() -> Option<PathBuf> {
    if let Some(home) = std::env::var_os("HOME") {
        return Some(PathBuf::from(home));
    }
    std::env::var_os("USERPROFILE").map(PathBuf::from)
}

pub(super) fn restore_resolver_circuits_from_state(
    resolver: &ModelPoolResolver,
    state: &RuntimeState,
) {
    let snapshot = state
        .provider_circuits
        .iter()
        .map(|(provider, circuit)| {
            (
                provider.clone(),
                (
                    circuit.consecutive_failures,
                    circuit.cooldown_until_epoch_seconds,
                ),
            )
        })
        .collect::<BTreeMap<_, _>>();
    resolver.restore_provider_circuit_snapshot(&snapshot);
}

pub(super) fn sync_resolver_circuits_to_state(
    resolver: &ModelPoolResolver,
    state: &mut RuntimeState,
) {
    let snapshot = resolver.provider_circuit_snapshot();
    state.provider_circuits = snapshot
        .into_iter()
        .map(
            |(provider, (consecutive_failures, cooldown_until_epoch_seconds))| {
                (
                    provider,
                    RuntimeProviderCircuitState {
                        consecutive_failures,
                        cooldown_until_epoch_seconds,
                    },
                )
            },
        )
        .collect();
}

pub(super) fn load_runtime_state(
    state_path: &Path,
    seed_state: RuntimeState,
    fallback_model_id: Option<&str>,
) -> RuntimeState {
    if let Err(error) = migrate_legacy_runtime_state_if_needed(state_path) {
        eprintln!(
            "failed to migrate legacy runtime state into {}: {error}",
            state_path.display()
        );
    }

    let raw = match fs::read_to_string(state_path) {
        Ok(raw) => raw,
        Err(error) => {
            if error.kind() != io::ErrorKind::NotFound {
                eprintln!(
                    "failed to read runtime state at {}: {error}",
                    state_path.display()
                );
            }
            return seed_state;
        }
    };

    let parsed_state = match serde_json::from_str::<RuntimeStateSnapshot>(&raw) {
        Ok(snapshot) => {
            if snapshot.version != RUNTIME_STATE_VERSION {
                eprintln!(
                    "runtime state version mismatch (found {}, expected {}), attempting best-effort load",
                    snapshot.version, RUNTIME_STATE_VERSION
                );
            }
            Some(snapshot.state)
        }
        Err(snapshot_error) => match serde_json::from_str::<RuntimeState>(&raw) {
            Ok(state) => Some(state),
            Err(raw_state_error) => {
                eprintln!(
                    "failed to parse runtime state at {}: snapshot error: {snapshot_error}; state error: {raw_state_error}",
                    state_path.display()
                );
                None
            }
        },
    };

    match parsed_state {
        Some(state) => state.normalize(&seed_state, fallback_model_id),
        None => seed_state,
    }
}

pub(super) fn save_runtime_state(state_path: &Path, state: &RuntimeState) -> io::Result<()> {
    migrate_legacy_runtime_state_if_needed(state_path)?;

    if let Some(parent) = state_path.parent() {
        fs::create_dir_all(parent)?;
    }

    let snapshot = RuntimeStateSnapshotRef {
        version: RUNTIME_STATE_VERSION,
        state,
    };
    let temp_path = state_path.with_file_name(format!(
        "{}.tmp",
        state_path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or(RUNTIME_STATE_FILENAME)
    ));

    {
        let temp_file = fs::File::create(&temp_path)?;
        let mut writer = io::BufWriter::new(temp_file);
        serde_json::to_writer_pretty(&mut writer, &snapshot)
            .map_err(|error| io::Error::other(format!("serialize runtime state: {error}")))?;
        writer.flush()?;
    }

    match fs::rename(&temp_path, state_path) {
        Ok(()) => Ok(()),
        Err(initial_error) => {
            if state_path.exists() {
                fs::remove_file(state_path)?;
                fs::rename(&temp_path, state_path)
            } else {
                let _ = fs::remove_file(&temp_path);
                Err(initial_error)
            }
        }
    }
}

pub(super) fn parse_id_suffix(value: &str) -> Option<u64> {
    let (_, suffix) = value.rsplit_once('-')?;
    suffix.parse::<u64>().ok()
}

pub(super) fn dedupe_preserve_order(items: &mut Vec<String>) {
    let mut seen = HashSet::new();
    items.retain(|value| seen.insert(value.clone()));
}

#[cfg_attr(not(test), allow(dead_code))]
pub(super) fn extract_collaboration_mode_id(value: Option<&serde_json::Value>) -> Option<String> {
    let mode = value?;
    let settings = mode.get("settings").and_then(serde_json::Value::as_object);
    [
        settings
            .and_then(|settings| settings.get("id"))
            .and_then(serde_json::Value::as_str),
        mode.get("id").and_then(serde_json::Value::as_str),
        mode.get("modeId").and_then(serde_json::Value::as_str),
        mode.get("mode_id").and_then(serde_json::Value::as_str),
        mode.get("mode").and_then(serde_json::Value::as_str),
    ]
    .into_iter()
    .flatten()
    .map(str::trim)
    .find(|id| !id.is_empty())
    .map(str::to_string)
}

pub(super) fn build_runtime_thread(
    id: String,
    workspace_id: String,
    title: String,
    now: u64,
    provider: String,
    model_id: Option<String>,
) -> RuntimeThread {
    RuntimeThread {
        id,
        workspace_id,
        title,
        unread: false,
        running: false,
        created_at: now,
        updated_at: now,
        provider,
        model_id,
        status: Some("idle".to_string()),
        archived: false,
        last_activity_at: Some(now),
        agent_role: None,
        agent_nickname: None,
    }
}

pub(super) fn set_thread_idle(thread: &mut RuntimeThread, now: u64) {
    thread.running = false;
    thread.updated_at = now;
    thread.status = Some("idle".to_string());
    thread.archived = false;
    thread.last_activity_at = Some(now);
}

pub(super) fn touch_thread_activity(thread: &mut RuntimeThread, now: u64) {
    thread.updated_at = now;
    thread.last_activity_at = Some(now);
    thread.archived = false;
}

pub(super) fn normalize_thread_metadata(thread: &mut RuntimeThread) {
    if thread.last_activity_at.is_none() {
        thread.last_activity_at = Some(thread.updated_at);
    }
    if thread
        .status
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .is_none()
    {
        thread.status = Some(if thread.running { "active" } else { "idle" }.to_string());
    }
    if thread
        .agent_role
        .as_deref()
        .map(str::trim)
        .is_some_and(|value| value.is_empty())
    {
        thread.agent_role = None;
    }
    if thread
        .agent_nickname
        .as_deref()
        .map(str::trim)
        .is_some_and(|value| value.is_empty())
    {
        thread.agent_nickname = None;
    }
}

pub(super) fn thread_to_summary(thread: &RuntimeThread) -> ThreadSummary {
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
    }
}

pub(super) fn terminal_to_summary(session: &RuntimeTerminalSession) -> TerminalSessionSummary {
    TerminalSessionSummary {
        id: session.id.clone(),
        workspace_id: session.workspace_id.clone(),
        state: terminal_session_state_to_summary_state(session.state),
        created_at: session.created_at,
        updated_at: session.updated_at,
        lines: session.lines.clone(),
    }
}

fn terminal_session_state_to_summary_state(
    state: ku0_runtime_shell_core::TerminalSessionState,
) -> TerminalSessionSummaryState {
    match state {
        ku0_runtime_shell_core::TerminalSessionState::Created => {
            TerminalSessionSummaryState::Created
        }
        ku0_runtime_shell_core::TerminalSessionState::Exited => TerminalSessionSummaryState::Exited,
        ku0_runtime_shell_core::TerminalSessionState::IoFailed => {
            TerminalSessionSummaryState::IoFailed
        }
        ku0_runtime_shell_core::TerminalSessionState::Unsupported => {
            TerminalSessionSummaryState::Unsupported
        }
    }
}

pub(super) fn terminal_to_chunk_read(
    session: &RuntimeTerminalSession,
    chunks: Vec<String>,
) -> TerminalChunkRead {
    TerminalChunkRead {
        session_id: session.id.clone(),
        workspace_id: session.workspace_id.clone(),
        state: terminal_session_state_to_summary_state(session.state),
        cursor: session.lines.len() as u64,
        updated_at: session.updated_at,
        chunks,
    }
}

#[cfg(test)]
mod tests {
    use super::{extract_collaboration_mode_id, runtime_state_path_from_env};
    use serde_json::json;
    use std::path::PathBuf;
    use std::sync::{Mutex, OnceLock};

    fn runtime_state_env_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    #[test]
    fn runtime_state_path_uses_localappdata_on_windows() {
        if !cfg!(target_os = "windows") {
            return;
        }

        let _guard = runtime_state_env_lock()
            .lock()
            .expect("runtime state env lock poisoned");
        let previous_override = std::env::var_os("CODE_TAURI_RUNTIME_STATE_PATH");
        let previous_local = std::env::var_os("LOCALAPPDATA");
        let previous_roaming = std::env::var_os("APPDATA");

        std::env::remove_var("CODE_TAURI_RUNTIME_STATE_PATH");
        std::env::set_var("LOCALAPPDATA", r"C:\Users\tester\AppData\Local");
        std::env::set_var("APPDATA", r"C:\Users\tester\AppData\Roaming");

        let path = runtime_state_path_from_env();
        assert_eq!(
            path,
            PathBuf::from(r"C:\Users\tester\AppData\Local")
                .join(".hugecode")
                .join("runtime-state.json")
        );

        match previous_override {
            Some(value) => std::env::set_var("CODE_TAURI_RUNTIME_STATE_PATH", value),
            None => std::env::remove_var("CODE_TAURI_RUNTIME_STATE_PATH"),
        }
        match previous_local {
            Some(value) => std::env::set_var("LOCALAPPDATA", value),
            None => std::env::remove_var("LOCALAPPDATA"),
        }
        match previous_roaming {
            Some(value) => std::env::set_var("APPDATA", value),
            None => std::env::remove_var("APPDATA"),
        }
    }

    #[test]
    fn extract_collaboration_mode_id_accepts_stable_and_legacy_fields() {
        assert_eq!(
            extract_collaboration_mode_id(Some(&json!({
                "settings": { "id": "pair-programming" },
                "id": "ignored",
                "mode": "default",
            }))),
            Some("pair-programming".to_string())
        );
        assert_eq!(
            extract_collaboration_mode_id(Some(&json!({
                "id": "pair-programming",
                "mode": "default",
            }))),
            Some("pair-programming".to_string())
        );
        assert_eq!(
            extract_collaboration_mode_id(Some(&json!({
                "modeId": "plan",
            }))),
            Some("plan".to_string())
        );
        assert_eq!(
            extract_collaboration_mode_id(Some(&json!({
                "mode": "default",
            }))),
            Some("default".to_string())
        );
    }

    #[test]
    fn runtime_state_path_uses_dot_hugecode_dir_on_macos() {
        if !cfg!(target_os = "macos") {
            return;
        }

        let _guard = runtime_state_env_lock()
            .lock()
            .expect("runtime state env lock poisoned");
        let previous_override = std::env::var_os("CODE_TAURI_RUNTIME_STATE_PATH");
        let previous_home = std::env::var_os("HOME");
        let previous_tmpdir = std::env::var_os("TMPDIR");

        std::env::remove_var("CODE_TAURI_RUNTIME_STATE_PATH");
        std::env::set_var("HOME", "/Users/tester");
        std::env::set_var("TMPDIR", "/tmp/runtime-state-tests");

        let path = runtime_state_path_from_env();
        assert_eq!(
            path,
            PathBuf::from("/Users/tester")
                .join("Library")
                .join("Application Support")
                .join(".hugecode")
                .join("runtime-state.json")
        );

        match previous_override {
            Some(value) => std::env::set_var("CODE_TAURI_RUNTIME_STATE_PATH", value),
            None => std::env::remove_var("CODE_TAURI_RUNTIME_STATE_PATH"),
        }
        match previous_home {
            Some(value) => std::env::set_var("HOME", value),
            None => std::env::remove_var("HOME"),
        }
        match previous_tmpdir {
            Some(value) => std::env::set_var("TMPDIR", value),
            None => std::env::remove_var("TMPDIR"),
        }
    }

    #[test]
    fn runtime_state_path_uses_dot_hugecode_dir_on_linux() {
        if !cfg!(target_os = "linux") {
            return;
        }

        let _guard = runtime_state_env_lock()
            .lock()
            .expect("runtime state env lock poisoned");
        let previous_override = std::env::var_os("CODE_TAURI_RUNTIME_STATE_PATH");
        let previous_xdg_state = std::env::var_os("XDG_STATE_HOME");
        let previous_home = std::env::var_os("HOME");

        std::env::remove_var("CODE_TAURI_RUNTIME_STATE_PATH");
        std::env::set_var("XDG_STATE_HOME", "/home/tester/.local/state");
        std::env::set_var("HOME", "/home/tester");

        let path = runtime_state_path_from_env();
        assert_eq!(
            path,
            PathBuf::from("/home/tester/.local/state")
                .join(".hugecode")
                .join("runtime-state.json")
        );

        match previous_override {
            Some(value) => std::env::set_var("CODE_TAURI_RUNTIME_STATE_PATH", value),
            None => std::env::remove_var("CODE_TAURI_RUNTIME_STATE_PATH"),
        }
        match previous_xdg_state {
            Some(value) => std::env::set_var("XDG_STATE_HOME", value),
            None => std::env::remove_var("XDG_STATE_HOME"),
        }
        match previous_home {
            Some(value) => std::env::set_var("HOME", value),
            None => std::env::remove_var("HOME"),
        }
    }
}
