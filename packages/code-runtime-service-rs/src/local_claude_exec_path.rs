use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::PathBuf,
    process::Command as StdCommand,
    sync::{Mutex, OnceLock},
};

use tokio::process::Command;

pub(super) const CODE_RUNTIME_LOCAL_CLAUDE_EXEC_PATH_ENV: &str =
    "CODE_RUNTIME_LOCAL_CLAUDE_EXEC_PATH";
pub(super) const CODE_RUNTIME_LOCAL_CLAUDE_ENV_FILE_ENV: &str =
    "CODE_RUNTIME_LOCAL_CLAUDE_ENV_FILE";

const DEFAULT_CLAUDE_EXEC_BINARY: &str = "claude";
const XAI_API_KEY_ENV: &str = "XAI_API_KEY";
const ANTHROPIC_AUTH_TOKEN_ENV: &str = "ANTHROPIC_AUTH_TOKEN";
const ANTHROPIC_BASE_URL_ENV: &str = "ANTHROPIC_BASE_URL";
const LOCAL_CLAUDE_ENV_KEYS: &[&str] = &[
    XAI_API_KEY_ENV,
    ANTHROPIC_AUTH_TOKEN_ENV,
    ANTHROPIC_BASE_URL_ENV,
    "ANTHROPIC_DEFAULT_OPUS_MODEL",
    "ANTHROPIC_DEFAULT_SONNET_MODEL",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL",
];
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
    let mut command = Command::new(binary.trim());
    command.envs(local_claude_env_overrides());
    command
}

pub(super) fn format_local_claude_command(binary: &str) -> String {
    binary.trim().to_string()
}

fn strip_env_quotes(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.len() >= 2 {
        let first = trimmed.as_bytes()[0] as char;
        let last = trimmed.as_bytes()[trimmed.len() - 1] as char;
        if (first == '"' && last == '"') || (first == '\'' && last == '\'') {
            return trimmed[1..trimmed.len() - 1].to_string();
        }
    }
    trimmed.to_string()
}

fn parse_local_claude_env_file(contents: &str) -> BTreeMap<String, String> {
    let mut values = BTreeMap::new();
    for line in contents.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        let Some((key, value)) = trimmed.split_once('=') else {
            continue;
        };
        let key = key.trim();
        if LOCAL_CLAUDE_ENV_KEYS.contains(&key) {
            let value = strip_env_quotes(value);
            if !value.trim().is_empty() {
                values.insert(key.to_string(), value);
            }
        }
    }
    values
}

fn default_local_claude_env_file_path() -> Option<PathBuf> {
    let home = std::env::var_os("HOME")?;
    Some(
        PathBuf::from(home)
            .join(".hugecode")
            .join("claude-code.env"),
    )
}

fn resolve_local_claude_env_file_path() -> Option<PathBuf> {
    if let Some(path) = trim_non_empty(
        std::env::var(CODE_RUNTIME_LOCAL_CLAUDE_ENV_FILE_ENV)
            .ok()
            .as_deref(),
    ) {
        return Some(PathBuf::from(path));
    }
    default_local_claude_env_file_path()
}

pub(super) fn local_claude_env_overrides() -> BTreeMap<String, String> {
    let mut values = resolve_local_claude_env_file_path()
        .and_then(|path| fs::read_to_string(path).ok())
        .map(|contents| parse_local_claude_env_file(contents.as_str()))
        .unwrap_or_default();

    for key in LOCAL_CLAUDE_ENV_KEYS {
        if let Some(value) = trim_non_empty(std::env::var(key).ok().as_deref()) {
            values.insert((*key).to_string(), value.to_string());
        }
    }

    if !values.contains_key(ANTHROPIC_AUTH_TOKEN_ENV) {
        if let Some(api_key) = values.get(XAI_API_KEY_ENV).cloned() {
            values.insert(ANTHROPIC_AUTH_TOKEN_ENV.to_string(), api_key);
        }
    }

    values
}

pub(super) fn local_claude_external_auth_configured() -> bool {
    let values = local_claude_env_overrides();
    values
        .get(ANTHROPIC_BASE_URL_ENV)
        .is_some_and(|value| !value.trim().is_empty())
        && values
            .get(ANTHROPIC_AUTH_TOKEN_ENV)
            .or_else(|| values.get(XAI_API_KEY_ENV))
            .is_some_and(|value| !value.trim().is_empty())
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
        format_local_claude_command, local_claude_env_overrides, local_claude_exec_env_lock,
        local_claude_external_auth_configured, parse_local_claude_env_file,
        reset_local_claude_exec_binary_cache, resolve_local_claude_exec_binary,
        CODE_RUNTIME_LOCAL_CLAUDE_ENV_FILE_ENV, CODE_RUNTIME_LOCAL_CLAUDE_EXEC_PATH_ENV,
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

    #[test]
    fn parse_local_claude_env_file_keeps_only_supported_keys() {
        let parsed = parse_local_claude_env_file(
            r#"
            # comment
            XAI_API_KEY="sk-Xvs-test"
            ANTHROPIC_BASE_URL='https://xai.example/v1'
            OTHER_SECRET=blocked
            ANTHROPIC_DEFAULT_SONNET_MODEL=gpt-5.4
            "#,
        );

        assert_eq!(parsed.get("XAI_API_KEY"), Some(&"sk-Xvs-test".to_string()));
        assert_eq!(
            parsed.get("ANTHROPIC_BASE_URL"),
            Some(&"https://xai.example/v1".to_string())
        );
        assert_eq!(
            parsed.get("ANTHROPIC_DEFAULT_SONNET_MODEL"),
            Some(&"gpt-5.4".to_string())
        );
        assert!(!parsed.contains_key("OTHER_SECRET"));
    }

    #[test]
    fn local_claude_external_auth_can_use_env_file() {
        let _guard = local_claude_exec_env_lock()
            .lock()
            .expect("local claude exec env lock poisoned");
        let temp_dir = tempfile::tempdir().expect("tempdir");
        let env_path = temp_dir.path().join("claude.env");
        std::fs::write(
            &env_path,
            "XAI_API_KEY=sk-Xvs-test\nANTHROPIC_BASE_URL=https://xai.example/v1\n",
        )
        .expect("write env file");
        let previous_env_file = std::env::var_os(CODE_RUNTIME_LOCAL_CLAUDE_ENV_FILE_ENV);
        let previous_xai_key = std::env::var_os("XAI_API_KEY");
        let previous_token = std::env::var_os("ANTHROPIC_AUTH_TOKEN");
        let previous_base_url = std::env::var_os("ANTHROPIC_BASE_URL");

        unsafe {
            std::env::set_var(CODE_RUNTIME_LOCAL_CLAUDE_ENV_FILE_ENV, env_path);
            std::env::remove_var("XAI_API_KEY");
            std::env::remove_var("ANTHROPIC_AUTH_TOKEN");
            std::env::remove_var("ANTHROPIC_BASE_URL");
        }

        let values = local_claude_env_overrides();
        assert_eq!(
            values.get("ANTHROPIC_AUTH_TOKEN"),
            Some(&"sk-Xvs-test".to_string())
        );
        assert!(local_claude_external_auth_configured());

        unsafe {
            match previous_env_file {
                Some(value) => std::env::set_var(CODE_RUNTIME_LOCAL_CLAUDE_ENV_FILE_ENV, value),
                None => std::env::remove_var(CODE_RUNTIME_LOCAL_CLAUDE_ENV_FILE_ENV),
            }
            match previous_xai_key {
                Some(value) => std::env::set_var("XAI_API_KEY", value),
                None => std::env::remove_var("XAI_API_KEY"),
            }
            match previous_token {
                Some(value) => std::env::set_var("ANTHROPIC_AUTH_TOKEN", value),
                None => std::env::remove_var("ANTHROPIC_AUTH_TOKEN"),
            }
            match previous_base_url {
                Some(value) => std::env::set_var("ANTHROPIC_BASE_URL", value),
                None => std::env::remove_var("ANTHROPIC_BASE_URL"),
            }
        }
    }
}
