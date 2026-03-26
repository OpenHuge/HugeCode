use std::{
    collections::BTreeSet,
    path::PathBuf,
    process::Command as StdCommand,
    sync::{Mutex, OnceLock},
};

use tokio::process::Command;

pub(super) const CODE_RUNTIME_LOCAL_CLAUDE_EXEC_PATH_ENV: &str =
    "CODE_RUNTIME_LOCAL_CLAUDE_EXEC_PATH";

const DEFAULT_CLAUDE_EXEC_BINARY: &str = "claude";
static AUTO_DETECTED_CLAUDE_BINARY: OnceLock<Mutex<Option<String>>> = OnceLock::new();

fn trim_non_empty(value: Option<&str>) -> Option<&str> {
    value
        .map(str::trim)
        .filter(|candidate| !candidate.is_empty())
}

fn first_non_empty_line(value: &str) -> Option<String> {
    value
        .lines()
        .map(str::trim)
        .find(|entry| !entry.is_empty())
        .map(ToOwned::to_owned)
}

fn run_probe_command(program: &str, args: &[&str]) -> Option<String> {
    let output = StdCommand::new(program).args(args).output().ok()?;
    if !output.status.success() {
        return None;
    }
    first_non_empty_line(String::from_utf8_lossy(output.stdout.as_slice()).as_ref())
}

fn push_candidate(candidates: &mut Vec<PathBuf>, seen: &mut BTreeSet<String>, candidate: PathBuf) {
    let normalized = candidate
        .to_string_lossy()
        .replace('\\', "/")
        .to_ascii_lowercase();
    if seen.insert(normalized) {
        candidates.push(candidate);
    }
}

fn detect_homebrew_claude_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    let mut seen = BTreeSet::new();

    for prefix in ["/opt/homebrew/bin", "/usr/local/bin"] {
        push_candidate(
            &mut candidates,
            &mut seen,
            PathBuf::from(prefix).join(DEFAULT_CLAUDE_EXEC_BINARY),
        );
    }

    if let Some(prefix_line) = run_probe_command("brew", &["--prefix"]) {
        push_candidate(
            &mut candidates,
            &mut seen,
            PathBuf::from(prefix_line.trim())
                .join("bin")
                .join(DEFAULT_CLAUDE_EXEC_BINARY),
        );
    }

    candidates
}

fn detect_absolute_claude_candidates() -> Vec<PathBuf> {
    detect_homebrew_claude_candidates()
        .into_iter()
        .filter(|candidate| candidate.is_file())
        .collect()
}

fn resolve_auto_detected_local_claude_exec_binary() -> String {
    let cache = AUTO_DETECTED_CLAUDE_BINARY.get_or_init(|| Mutex::new(None));
    let mut cached = cache.lock().expect("local claude exec cache poisoned");
    if let Some(resolved) = cached.as_ref() {
        return resolved.clone();
    }

    let resolved = detect_absolute_claude_candidates()
        .into_iter()
        .find(|candidate| candidate.is_file())
        .map(|candidate| candidate.to_string_lossy().to_string())
        .unwrap_or_else(|| DEFAULT_CLAUDE_EXEC_BINARY.to_string());
    *cached = Some(resolved.clone());
    resolved
}

pub(super) fn resolve_local_claude_exec_binary(override_value: Option<&str>) -> String {
    if let Some(explicit_override) = trim_non_empty(override_value) {
        if !explicit_override.eq_ignore_ascii_case(DEFAULT_CLAUDE_EXEC_BINARY) {
            return explicit_override.to_string();
        }
    }

    if let Some(env_override) = trim_non_empty(
        std::env::var(CODE_RUNTIME_LOCAL_CLAUDE_EXEC_PATH_ENV)
            .ok()
            .as_deref(),
    ) {
        return env_override.to_string();
    }

    if trim_non_empty(override_value)
        .is_some_and(|value| value.eq_ignore_ascii_case(DEFAULT_CLAUDE_EXEC_BINARY))
    {
        return DEFAULT_CLAUDE_EXEC_BINARY.to_string();
    }

    resolve_auto_detected_local_claude_exec_binary()
}

pub(super) fn new_local_claude_command(binary: &str) -> Command {
    Command::new(binary.trim())
}

pub(super) fn format_local_claude_command(binary: &str) -> String {
    binary.trim().to_string()
}

#[cfg(test)]
pub(crate) fn local_claude_exec_env_lock() -> &'static std::sync::Mutex<()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
}

#[cfg(test)]
pub(crate) fn reset_local_claude_exec_binary_cache() {
    if let Some(cache) = AUTO_DETECTED_CLAUDE_BINARY.get() {
        let mut cached = cache.lock().expect("local claude exec cache poisoned");
        *cached = None;
    }
}

#[cfg(test)]
mod tests {
    use super::{
        format_local_claude_command, local_claude_exec_env_lock,
        reset_local_claude_exec_binary_cache, resolve_local_claude_exec_binary,
        CODE_RUNTIME_LOCAL_CLAUDE_EXEC_PATH_ENV,
    };

    #[test]
    fn resolve_local_claude_exec_binary_uses_override_when_present() {
        assert_eq!(
            resolve_local_claude_exec_binary(Some("custom-claude")),
            "custom-claude".to_string()
        );
        assert_eq!(
            resolve_local_claude_exec_binary(Some("  /usr/local/bin/claude  ")),
            "/usr/local/bin/claude".to_string()
        );
    }

    #[test]
    fn resolve_local_claude_exec_binary_prefers_env_override() {
        let _guard = local_claude_exec_env_lock()
            .lock()
            .expect("local claude exec env lock poisoned");
        let previous = std::env::var_os(CODE_RUNTIME_LOCAL_CLAUDE_EXEC_PATH_ENV);
        reset_local_claude_exec_binary_cache();

        unsafe {
            std::env::set_var(
                CODE_RUNTIME_LOCAL_CLAUDE_EXEC_PATH_ENV,
                "/tmp/claude-custom",
            );
        }

        assert_eq!(
            resolve_local_claude_exec_binary(None),
            "/tmp/claude-custom".to_string()
        );

        unsafe {
            match previous {
                Some(value) => std::env::set_var(CODE_RUNTIME_LOCAL_CLAUDE_EXEC_PATH_ENV, value),
                None => std::env::remove_var(CODE_RUNTIME_LOCAL_CLAUDE_EXEC_PATH_ENV),
            }
        }
    }

    #[test]
    fn format_local_claude_command_trims_binary() {
        assert_eq!(
            format_local_claude_command("  /Users/test/.local/bin/claude  "),
            "/Users/test/.local/bin/claude".to_string()
        );
    }
}
