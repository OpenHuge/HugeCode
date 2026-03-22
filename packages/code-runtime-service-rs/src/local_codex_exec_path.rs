use std::{
    collections::BTreeSet,
    path::PathBuf,
    process::Command as StdCommand,
    sync::{Mutex, OnceLock},
};

use tokio::process::Command;

pub(super) const CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV: &str =
    "CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH";

const DEFAULT_CODEX_EXEC_BINARY: &str = "codex";
static AUTO_DETECTED_CODEX_BINARY: OnceLock<Mutex<Option<String>>> = OnceLock::new();

fn trim_non_empty(value: Option<&str>) -> Option<&str> {
    value
        .map(str::trim)
        .filter(|candidate| !candidate.is_empty())
}

fn detect_windows_npm_codex_candidates() -> Vec<PathBuf> {
    if !cfg!(windows) {
        return Vec::new();
    }

    let Some(app_data) = std::env::var_os("APPDATA") else {
        return Vec::new();
    };
    let npm_root = PathBuf::from(app_data).join("npm");
    vec![npm_root.join("codex.cmd"), npm_root.join("codex.ps1")]
}

fn codex_executable_file_name() -> &'static str {
    if cfg!(windows) {
        "codex.cmd"
    } else {
        "codex"
    }
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

fn detect_npm_global_codex_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    let mut seen = BTreeSet::new();
    let executable_name = codex_executable_file_name();

    for candidate in detect_windows_npm_codex_candidates() {
        push_candidate(&mut candidates, &mut seen, candidate);
    }

    let Some(prefix_line) = run_probe_command("npm", &["config", "get", "prefix"]) else {
        return candidates;
    };
    let prefix = PathBuf::from(prefix_line.trim());
    if cfg!(windows) {
        push_candidate(&mut candidates, &mut seen, prefix.join(executable_name));
        push_candidate(&mut candidates, &mut seen, prefix.join("codex.ps1"));
    } else {
        push_candidate(
            &mut candidates,
            &mut seen,
            prefix.join("bin").join(executable_name),
        );
    }

    candidates
}

fn detect_homebrew_codex_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    let mut seen = BTreeSet::new();
    let executable_name = codex_executable_file_name();

    for prefix in [
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/home/linuxbrew/.linuxbrew/bin",
    ] {
        push_candidate(
            &mut candidates,
            &mut seen,
            PathBuf::from(prefix).join(executable_name),
        );
    }

    if cfg!(windows) {
        return candidates;
    }

    if let Some(prefix_line) = run_probe_command("brew", &["--prefix"]) {
        push_candidate(
            &mut candidates,
            &mut seen,
            PathBuf::from(prefix_line.trim())
                .join("bin")
                .join(executable_name),
        );
    }

    candidates
}

fn detect_absolute_codex_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    for candidate in detect_npm_global_codex_candidates() {
        if candidate.is_file() {
            candidates.push(candidate);
        }
    }
    for candidate in detect_homebrew_codex_candidates() {
        if candidate.is_file() {
            candidates.push(candidate);
        }
    }
    candidates
}

fn resolve_auto_detected_local_codex_exec_binary() -> String {
    let cache = AUTO_DETECTED_CODEX_BINARY.get_or_init(|| Mutex::new(None));
    let mut cached = cache.lock().expect("local codex exec cache poisoned");
    if let Some(resolved) = cached.as_ref() {
        return resolved.clone();
    }

    let resolved = if cfg!(windows) {
        detect_absolute_codex_candidates()
            .into_iter()
            .find(|candidate| candidate.is_file())
            .map(|candidate| candidate.to_string_lossy().to_string())
            .unwrap_or_else(|| DEFAULT_CODEX_EXEC_BINARY.to_string())
    } else {
        DEFAULT_CODEX_EXEC_BINARY.to_string()
    };
    *cached = Some(resolved.clone());
    resolved
}

pub(super) fn resolve_local_codex_exec_binary(override_value: Option<&str>) -> String {
    if let Some(explicit_override) = trim_non_empty(override_value) {
        if !explicit_override.eq_ignore_ascii_case(DEFAULT_CODEX_EXEC_BINARY) {
            return explicit_override.to_string();
        }
    }

    if let Some(env_override) = trim_non_empty(
        std::env::var(CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV)
            .ok()
            .as_deref(),
    ) {
        return env_override.to_string();
    }

    if trim_non_empty(override_value)
        .is_some_and(|value| value.eq_ignore_ascii_case(DEFAULT_CODEX_EXEC_BINARY))
    {
        return DEFAULT_CODEX_EXEC_BINARY.to_string();
    }

    resolve_auto_detected_local_codex_exec_binary()
}

fn local_codex_command_invocation(binary: &str) -> (String, Vec<String>) {
    let trimmed = binary.trim();
    let normalized = trimmed.to_ascii_lowercase();
    if cfg!(windows) && normalized.ends_with(".ps1") {
        (
            "powershell.exe".to_string(),
            vec![
                "-NoLogo".to_string(),
                "-NoProfile".to_string(),
                "-ExecutionPolicy".to_string(),
                "Bypass".to_string(),
                "-File".to_string(),
                trimmed.to_string(),
            ],
        )
    } else if cfg!(windows) && (normalized.ends_with(".cmd") || normalized.ends_with(".bat")) {
        (
            "cmd.exe".to_string(),
            vec![
                "/d".to_string(),
                "/s".to_string(),
                "/c".to_string(),
                "call".to_string(),
                trimmed.to_string(),
            ],
        )
    } else {
        (trimmed.to_string(), Vec::new())
    }
}

pub(super) fn new_local_codex_command(binary: &str) -> Command {
    let (program, args) = local_codex_command_invocation(binary);
    let mut command = Command::new(program);
    for arg in args {
        command.arg(arg);
    }
    command
}

pub(super) fn format_local_codex_command(binary: &str) -> String {
    let (program, args) = local_codex_command_invocation(binary);
    if args.is_empty() {
        program
    } else {
        format!("{program} {}", args.join(" "))
    }
}

#[cfg(test)]
pub(crate) fn local_codex_exec_env_lock() -> &'static std::sync::Mutex<()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
}

#[cfg(test)]
pub(crate) fn reset_local_codex_exec_binary_cache() {
    if let Some(cache) = AUTO_DETECTED_CODEX_BINARY.get() {
        let mut cached = cache.lock().expect("local codex exec cache poisoned");
        *cached = None;
    }
}

#[cfg(test)]
mod tests {
    use super::{
        format_local_codex_command, local_codex_command_invocation, local_codex_exec_env_lock,
        reset_local_codex_exec_binary_cache, resolve_local_codex_exec_binary,
        CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV,
    };
    use std::fs;
    use uuid::Uuid;

    struct TempDir {
        path: std::path::PathBuf,
    }

    impl TempDir {
        fn new(prefix: &str) -> Self {
            let path = std::env::temp_dir().join(format!("{prefix}-{}", Uuid::new_v4()));
            fs::create_dir_all(path.as_path()).expect("create temp dir");
            Self { path }
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(self.path.as_path());
        }
    }

    #[test]
    fn resolve_local_codex_exec_binary_prefers_explicit_override() {
        assert_eq!(
            resolve_local_codex_exec_binary(Some("custom-codex")),
            "custom-codex".to_string()
        );
        assert_eq!(
            resolve_local_codex_exec_binary(Some("  /usr/local/bin/codex  ")),
            "/usr/local/bin/codex".to_string()
        );
    }

    #[test]
    fn resolve_local_codex_exec_binary_uses_env_override_when_present() {
        let _guard = local_codex_exec_env_lock()
            .lock()
            .expect("local codex exec path env lock poisoned");
        let previous_override = std::env::var_os(CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV);

        unsafe {
            std::env::set_var(CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV, "C:/tools/codex.exe");
        }
        reset_local_codex_exec_binary_cache();

        assert_eq!(
            resolve_local_codex_exec_binary(None),
            "C:/tools/codex.exe".to_string()
        );

        unsafe {
            match previous_override {
                Some(value) => std::env::set_var(CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV, value),
                None => std::env::remove_var(CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV),
            }
        }
        reset_local_codex_exec_binary_cache();
    }

    #[test]
    fn resolve_local_codex_exec_binary_detects_windows_npm_install() {
        let _guard = local_codex_exec_env_lock()
            .lock()
            .expect("local codex exec path env lock poisoned");
        let previous_override = std::env::var_os(CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV);
        let previous_app_data = std::env::var_os("APPDATA");
        let temp_dir = TempDir::new("local-codex-exec-path");
        let npm_dir = temp_dir.path.join("npm");
        fs::create_dir_all(npm_dir.as_path()).expect("create npm dir");

        if cfg!(windows) {
            fs::write(npm_dir.join("codex.cmd"), "@echo off\r\n").expect("write codex.cmd");
        }

        unsafe {
            std::env::remove_var(CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV);
            std::env::set_var("APPDATA", temp_dir.path.as_os_str());
        }
        reset_local_codex_exec_binary_cache();

        let resolved = resolve_local_codex_exec_binary(None);
        if cfg!(windows) {
            assert!(resolved.ends_with(r"npm\codex.cmd"));
        } else {
            assert_eq!(resolved, "codex".to_string());
        }

        unsafe {
            match previous_override {
                Some(value) => std::env::set_var(CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV, value),
                None => std::env::remove_var(CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV),
            }
            match previous_app_data {
                Some(value) => std::env::set_var("APPDATA", value),
                None => std::env::remove_var("APPDATA"),
            }
        }
        reset_local_codex_exec_binary_cache();
    }

    #[test]
    fn resolve_local_codex_exec_binary_treats_default_bare_codex_override_as_auto_detected() {
        let _guard = local_codex_exec_env_lock()
            .lock()
            .expect("local codex exec path env lock poisoned");
        let previous_override = std::env::var_os(CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV);
        let previous_app_data = std::env::var_os("APPDATA");
        let temp_dir = TempDir::new("local-codex-explicit-default");
        let npm_dir = temp_dir.path.join("npm");
        fs::create_dir_all(npm_dir.as_path()).expect("create npm dir");

        if cfg!(windows) {
            fs::write(npm_dir.join("codex.cmd"), "@echo off\r\n").expect("write codex.cmd");
        }

        unsafe {
            std::env::remove_var(CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV);
            std::env::set_var("APPDATA", temp_dir.path.as_os_str());
        }
        reset_local_codex_exec_binary_cache();

        let resolved = resolve_local_codex_exec_binary(Some("codex"));
        if cfg!(windows) {
            assert!(resolved.ends_with(r"npm\codex.cmd"));
        } else {
            assert_eq!(resolved, "codex".to_string());
        }

        unsafe {
            match previous_override {
                Some(value) => std::env::set_var(CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV, value),
                None => std::env::remove_var(CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV),
            }
            match previous_app_data {
                Some(value) => std::env::set_var("APPDATA", value),
                None => std::env::remove_var("APPDATA"),
            }
        }
        reset_local_codex_exec_binary_cache();
    }

    #[test]
    fn format_local_codex_command_wraps_powershell_scripts() {
        if cfg!(windows) {
            assert_eq!(
                format_local_codex_command(r"C:\Users\tester\AppData\Roaming\npm\codex.ps1"),
                r"powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File C:\Users\tester\AppData\Roaming\npm\codex.ps1".to_string()
            );
            assert_eq!(
                format_local_codex_command(r"C:\Users\tester\AppData\Roaming\npm\codex.cmd"),
                r"cmd.exe /d /s /c call C:\Users\tester\AppData\Roaming\npm\codex.cmd".to_string()
            );
        } else {
            assert_eq!(
                format_local_codex_command("/usr/local/bin/codex"),
                "/usr/local/bin/codex".to_string()
            );
        }
    }

    #[test]
    fn local_codex_command_invocation_wraps_windows_batch_shims() {
        if cfg!(windows) {
            let (program, args) =
                local_codex_command_invocation(r"C:\Users\tester\AppData\Roaming\npm\codex.cmd");
            assert_eq!(program, "cmd.exe");
            assert_eq!(
                args,
                vec![
                    "/d".to_string(),
                    "/s".to_string(),
                    "/c".to_string(),
                    "call".to_string(),
                    r"C:\Users\tester\AppData\Roaming\npm\codex.cmd".to_string(),
                ]
            );
        } else {
            let (program, args) = local_codex_command_invocation("/usr/local/bin/codex");
            assert_eq!(program, "/usr/local/bin/codex");
            assert!(args.is_empty());
        }
    }
}
