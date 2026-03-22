use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::process::Command;

pub(crate) const CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV: &str =
    "CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum CodexInstallSource {
    Explicit,
    Path,
    NpmGlobal,
    Homebrew,
    Standalone,
}

impl CodexInstallSource {
    pub(crate) fn label(self) -> &'static str {
        match self {
            Self::Explicit => "explicit override",
            Self::Path => "PATH",
            Self::NpmGlobal => "npm global install",
            Self::Homebrew => "Homebrew install",
            Self::Standalone => "standalone path",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct CodexProbeCandidate {
    pub(crate) command: String,
    pub(crate) source: CodexInstallSource,
}

pub(crate) fn resolve_codex_binary(codex_bin: Option<&str>) -> Result<String, String> {
    if codex_bin
        .map(str::trim)
        .is_some_and(|value| !value.is_empty())
    {
        return Err("codexBin override is not allowed in the desktop default profile.".to_string());
    }

    Ok(collect_codex_probe_candidates()
        .into_iter()
        .next()
        .map(|candidate| candidate.command)
        .unwrap_or_else(|| "codex".to_string()))
}

pub(crate) fn resolve_codex_command_candidates(
    codex_bin: Option<&str>,
) -> Result<Vec<CodexProbeCandidate>, String> {
    let primary = resolve_codex_binary(codex_bin)?;
    let candidates = collect_codex_probe_candidates();
    if candidates.is_empty() {
        return Ok(vec![CodexProbeCandidate {
            command: primary,
            source: CodexInstallSource::Path,
        }]);
    }

    let primary_normalized = primary.replace('\\', "/").to_ascii_lowercase();
    let primary_source = candidates
        .iter()
        .find(|candidate| {
            candidate.command.replace('\\', "/").to_ascii_lowercase() == primary_normalized
        })
        .map(|candidate| candidate.source)
        .unwrap_or(CodexInstallSource::Path);
    if primary_source == CodexInstallSource::Explicit {
        return Ok(vec![CodexProbeCandidate {
            command: primary,
            source: primary_source,
        }]);
    }

    Ok(candidates)
}

pub(crate) fn infer_install_source_from_command(
    command: &str,
    is_explicit: bool,
) -> CodexInstallSource {
    let normalized = command.trim().replace('\\', "/").to_ascii_lowercase();
    if normalized.contains("/appdata/roaming/npm/")
        || normalized.ends_with("/npm/codex.cmd")
        || normalized.ends_with("/npm/codex.ps1")
    {
        return CodexInstallSource::NpmGlobal;
    }
    if is_explicit {
        return CodexInstallSource::Explicit;
    }
    if normalized.starts_with("/opt/homebrew/")
        || normalized.starts_with("/usr/local/homebrew/")
        || normalized.starts_with("/home/linuxbrew/.linuxbrew/")
        || normalized.contains("/cellar/")
    {
        return CodexInstallSource::Homebrew;
    }
    if Path::new(command).parent().is_some() {
        return CodexInstallSource::Standalone;
    }
    CodexInstallSource::Path
}

pub(crate) fn collect_codex_probe_candidates() -> Vec<CodexProbeCandidate> {
    let mut candidates = Vec::new();
    let mut seen = BTreeSet::new();

    if let Some(override_binary) = std::env::var(CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        push_codex_probe_candidate(&mut candidates, &mut seen, override_binary, true);
    }

    for candidate in detect_npm_global_codex_candidates() {
        add_existing_codex_probe_candidate(&mut candidates, &mut seen, candidate);
    }
    for candidate in detect_homebrew_codex_candidates() {
        add_existing_codex_probe_candidate(&mut candidates, &mut seen, candidate);
    }
    for candidate in detect_standalone_codex_candidates() {
        add_existing_codex_probe_candidate(&mut candidates, &mut seen, candidate);
    }
    push_codex_probe_candidate(&mut candidates, &mut seen, "codex", false);

    candidates
}

pub(crate) fn infer_update_method(output: &str, source: CodexInstallSource) -> String {
    if source == CodexInstallSource::NpmGlobal {
        return "npm".to_string();
    }
    if source == CodexInstallSource::Homebrew {
        return "brew_formula".to_string();
    }
    let normalized = output.to_ascii_lowercase();
    if normalized.contains("brew") && normalized.contains("cask") {
        return "brew_cask".to_string();
    }
    if normalized.contains("brew") {
        return "brew_formula".to_string();
    }
    if normalized.contains("npm") {
        return "npm".to_string();
    }
    "unknown".to_string()
}

fn push_codex_probe_candidate(
    candidates: &mut Vec<CodexProbeCandidate>,
    seen: &mut BTreeSet<String>,
    command: impl Into<String>,
    is_explicit: bool,
) {
    let command = command.into();
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return;
    }

    let dedupe_key = trimmed.replace('\\', "/").to_ascii_lowercase();
    if !seen.insert(dedupe_key) {
        return;
    }

    candidates.push(CodexProbeCandidate {
        command: trimmed.to_string(),
        source: infer_install_source_from_command(trimmed, is_explicit),
    });
}

fn detect_windows_npm_codex_candidates() -> Vec<String> {
    if !cfg!(windows) {
        return Vec::new();
    }

    let Some(app_data) = std::env::var_os("APPDATA") else {
        return Vec::new();
    };
    let npm_root = PathBuf::from(app_data).join("npm");
    vec![
        npm_root.join("codex.cmd").to_string_lossy().to_string(),
        npm_root.join("codex.ps1").to_string_lossy().to_string(),
    ]
}

fn codex_executable_file_name() -> &'static str {
    if cfg!(windows) {
        "codex.cmd"
    } else {
        "codex"
    }
}

fn add_existing_codex_probe_candidate(
    candidates: &mut Vec<CodexProbeCandidate>,
    seen: &mut BTreeSet<String>,
    path: PathBuf,
) {
    if !path.is_file() {
        return;
    }
    push_codex_probe_candidate(candidates, seen, path.to_string_lossy().to_string(), false);
}

fn detect_npm_global_codex_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    let executable_name = codex_executable_file_name();

    for candidate in detect_windows_npm_codex_candidates() {
        candidates.push(PathBuf::from(candidate));
    }

    let Some(prefix_line) = run_helper_command("npm", &["config", "get", "prefix"]) else {
        return candidates;
    };
    let prefix = PathBuf::from(prefix_line.trim());
    if cfg!(windows) {
        candidates.push(prefix.join(executable_name));
        candidates.push(prefix.join("codex.ps1"));
    } else {
        candidates.push(prefix.join("bin").join(executable_name));
    }
    candidates
}

fn detect_homebrew_codex_candidates() -> Vec<PathBuf> {
    let executable_name = codex_executable_file_name();
    let mut candidates = vec![
        PathBuf::from("/opt/homebrew/bin").join(executable_name),
        PathBuf::from("/usr/local/bin").join(executable_name),
        PathBuf::from("/home/linuxbrew/.linuxbrew/bin").join(executable_name),
    ];

    if cfg!(windows) {
        return candidates;
    }

    if let Some(prefix_line) = run_helper_command("brew", &["--prefix"]) {
        candidates.push(
            PathBuf::from(prefix_line.trim())
                .join("bin")
                .join(executable_name),
        );
    }

    candidates
}

fn detect_standalone_codex_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    let mut seen = BTreeSet::new();

    for (root, max_depth) in standalone_codex_search_roots() {
        collect_standalone_codex_candidates_from_root(
            root.as_path(),
            max_depth,
            0,
            &mut candidates,
            &mut seen,
        );
    }

    candidates
}

fn standalone_codex_search_roots() -> Vec<(PathBuf, usize)> {
    let mut roots = Vec::new();
    let mut seen = BTreeSet::new();

    let mut push_root = |path: PathBuf, max_depth: usize| {
        let normalized = path
            .to_string_lossy()
            .replace('\\', "/")
            .to_ascii_lowercase();
        if seen.insert(normalized) {
            roots.push((path, max_depth));
        }
    };

    for home_env in ["HOME", "USERPROFILE"] {
        let Some(home) = std::env::var_os(home_env).map(PathBuf::from) else {
            continue;
        };
        push_root(home.clone(), 1);
        push_root(home.join("bin"), 1);
        push_root(home.join(".local").join("bin"), 1);
        push_root(home.join("Downloads"), 2);
        push_root(home.join("Desktop"), 2);
        push_root(home.join("Applications"), 2);
        push_root(home.join("tools"), 3);
    }

    if cfg!(windows) {
        if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA").map(PathBuf::from) {
            push_root(local_app_data.join("Programs"), 2);
            push_root(
                local_app_data
                    .join("Microsoft")
                    .join("WinGet")
                    .join("Links"),
                1,
            );
            push_root(
                local_app_data
                    .join("Microsoft")
                    .join("WinGet")
                    .join("Packages"),
                3,
            );
        }
    }

    roots
}

fn collect_standalone_codex_candidates_from_root(
    root: &Path,
    max_depth: usize,
    depth: usize,
    candidates: &mut Vec<PathBuf>,
    seen: &mut BTreeSet<String>,
) {
    if depth > max_depth || !root.is_dir() {
        return;
    }

    let Ok(entries) = std::fs::read_dir(root) else {
        return;
    };
    for entry in entries.flatten().take(256) {
        let path = entry.path();
        if path.is_file() {
            if standalone_codex_binary_name_matches(path.as_path()) {
                let normalized = path
                    .to_string_lossy()
                    .replace('\\', "/")
                    .to_ascii_lowercase();
                if seen.insert(normalized) {
                    candidates.push(path);
                }
            }
            continue;
        }

        if !path.is_dir() || depth == max_depth {
            continue;
        }

        let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        if should_skip_standalone_codex_scan_dir(name) {
            continue;
        }

        collect_standalone_codex_candidates_from_root(
            path.as_path(),
            max_depth,
            depth + 1,
            candidates,
            seen,
        );
    }
}

fn standalone_codex_binary_name_matches(path: &Path) -> bool {
    let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
        return false;
    };
    let normalized = name.to_ascii_lowercase();

    if cfg!(windows) {
        return normalized == "codex.exe"
            || (normalized.starts_with("codex-") && normalized.ends_with(".exe"));
    }

    normalized == "codex" || normalized.starts_with("codex-")
}

fn should_skip_standalone_codex_scan_dir(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        ".git" | ".cargo" | ".pnpm-store" | ".yarn" | "node_modules" | "target" | "__pycache__"
    )
}

fn run_helper_command(binary: &str, args: &[&str]) -> Option<String> {
    let output = Command::new(binary).args(args).output().ok()?;
    if !output.status.success() {
        return None;
    }
    first_non_empty_line(String::from_utf8_lossy(output.stdout.as_slice()).as_ref())
}

fn first_non_empty_line(value: &str) -> Option<String> {
    value
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::{
        collect_codex_probe_candidates, infer_install_source_from_command, infer_update_method,
        CodexInstallSource, CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV,
    };
    use std::{
        fs,
        sync::Mutex,
        time::{SystemTime, UNIX_EPOCH},
    };

    fn codex_probe_env_lock() -> &'static Mutex<()> {
        crate::commands::policy::rpc_policy_env_lock()
    }

    struct TempDir {
        path: std::path::PathBuf,
    }

    impl TempDir {
        fn new(prefix: &str) -> Self {
            let unique = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system time before epoch")
                .as_nanos();
            let path = std::env::temp_dir().join(format!("{prefix}-{unique}"));
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
    fn infer_install_source_detects_windows_npm_shims() {
        assert_eq!(
            infer_install_source_from_command(
                r"C:\Users\alice\AppData\Roaming\npm\codex.cmd",
                false,
            ),
            CodexInstallSource::NpmGlobal
        );
        assert_eq!(
            infer_install_source_from_command(
                r"C:\Users\alice\AppData\Roaming\npm\codex.ps1",
                true,
            ),
            CodexInstallSource::NpmGlobal
        );
    }

    #[test]
    fn infer_install_source_detects_homebrew_paths() {
        assert_eq!(
            infer_install_source_from_command("/opt/homebrew/bin/codex", false),
            CodexInstallSource::Homebrew
        );
        assert_eq!(
            infer_install_source_from_command("/home/linuxbrew/.linuxbrew/bin/codex", false),
            CodexInstallSource::Homebrew
        );
    }

    #[test]
    fn infer_update_method_prefers_npm_for_windows_shims() {
        assert_eq!(
            infer_update_method("", CodexInstallSource::NpmGlobal),
            "npm"
        );
        assert_eq!(
            infer_update_method("", CodexInstallSource::Homebrew),
            "brew_formula"
        );
        assert_eq!(
            infer_update_method("updated with brew", CodexInstallSource::Standalone),
            "brew_formula"
        );
    }

    #[test]
    fn collect_codex_probe_candidates_includes_windows_npm_fallbacks() {
        if !cfg!(windows) {
            return;
        }

        let _guard = codex_probe_env_lock()
            .lock()
            .expect("codex probe env lock poisoned");
        let previous_override = std::env::var_os(CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV);
        let previous_app_data = std::env::var_os("APPDATA");
        let temp_dir = TempDir::new("tauri-codex-probe");
        let npm_dir = temp_dir.path.join("npm");
        fs::create_dir_all(npm_dir.as_path()).expect("create npm dir");
        fs::write(npm_dir.join("codex.cmd"), "@echo off\r\n").expect("write codex.cmd");
        fs::write(npm_dir.join("codex.ps1"), "Write-Output codex\r\n").expect("write codex.ps1");

        std::env::remove_var(CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV);
        std::env::set_var("APPDATA", temp_dir.path.as_os_str());

        let commands = collect_codex_probe_candidates()
            .into_iter()
            .map(|entry| entry.command)
            .collect::<Vec<_>>();
        assert!(commands
            .iter()
            .any(|entry| entry.ends_with(r"npm\codex.cmd")));
        assert!(commands
            .iter()
            .any(|entry| entry.ends_with(r"npm\codex.ps1")));
        assert!(commands.iter().any(|entry| entry == "codex"));

        match previous_override {
            Some(value) => std::env::set_var(CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV, value),
            None => std::env::remove_var(CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV),
        }
        match previous_app_data {
            Some(value) => std::env::set_var("APPDATA", value),
            None => std::env::remove_var("APPDATA"),
        }
    }

    #[test]
    fn collect_codex_probe_candidates_includes_standalone_release_binaries_from_user_dirs() {
        let _guard = codex_probe_env_lock()
            .lock()
            .expect("codex probe env lock poisoned");
        let previous_override = std::env::var_os(CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV);
        let previous_home = std::env::var_os("HOME");
        let previous_userprofile = std::env::var_os("USERPROFILE");
        let previous_local_app_data = std::env::var_os("LOCALAPPDATA");
        let temp_dir = TempDir::new("tauri-codex-standalone-probe");
        let standalone_dir = temp_dir.path.join("tools").join("codex");
        fs::create_dir_all(standalone_dir.as_path()).expect("create standalone dir");

        let binary_name = if cfg!(windows) {
            "codex-x86_64-pc-windows-msvc.exe"
        } else if cfg!(target_os = "macos") {
            "codex-aarch64-apple-darwin"
        } else {
            "codex-x86_64-unknown-linux-musl"
        };
        let binary_path = standalone_dir.join(binary_name);
        fs::write(binary_path.as_path(), "codex").expect("write standalone binary");

        std::env::remove_var(CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV);
        std::env::set_var("HOME", temp_dir.path.as_os_str());
        std::env::set_var("USERPROFILE", temp_dir.path.as_os_str());
        if cfg!(windows) {
            std::env::set_var("LOCALAPPDATA", temp_dir.path.join("local").as_os_str());
        } else {
            std::env::remove_var("LOCALAPPDATA");
        }

        let commands = collect_codex_probe_candidates()
            .into_iter()
            .map(|entry| entry.command)
            .collect::<Vec<_>>();
        assert!(commands
            .iter()
            .any(|entry| entry == &binary_path.to_string_lossy()));

        match previous_override {
            Some(value) => std::env::set_var(CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV, value),
            None => std::env::remove_var(CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV),
        }
        match previous_home {
            Some(value) => std::env::set_var("HOME", value),
            None => std::env::remove_var("HOME"),
        }
        match previous_userprofile {
            Some(value) => std::env::set_var("USERPROFILE", value),
            None => std::env::remove_var("USERPROFILE"),
        }
        match previous_local_app_data {
            Some(value) => std::env::set_var("LOCALAPPDATA", value),
            None => std::env::remove_var("LOCALAPPDATA"),
        }
    }
}
