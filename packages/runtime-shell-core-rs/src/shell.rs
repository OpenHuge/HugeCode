use std::collections::HashSet;
use std::ffi::OsString;
use std::process::{Command, Stdio};

const WINDOWS_POWERSHELL_LEGACY_PATH: &str =
    r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ShellFamily {
    Posix,
    PowerShell,
    Cmd,
}

impl ShellFamily {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Posix => "posix",
            Self::PowerShell => "powershell",
            Self::Cmd => "cmd",
        }
    }

    pub fn prompt_guidance(self) -> &'static str {
        match self {
            Self::Posix => "Emit POSIX-compatible shell commands.",
            Self::PowerShell => "Emit PowerShell-compatible commands instead of bash syntax.",
            Self::Cmd => "Emit Windows cmd-compatible commands instead of bash syntax.",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ShellSpec {
    pub executable: String,
    pub family: ShellFamily,
}

impl ShellSpec {
    pub fn terminal_args(&self) -> Vec<String> {
        match self.family {
            ShellFamily::Posix => Vec::new(),
            ShellFamily::PowerShell => vec!["-NoLogo".to_string()],
            ShellFamily::Cmd => vec!["/Q".to_string()],
        }
    }

    pub fn command_args(&self, command: &str) -> Vec<String> {
        match self.family {
            ShellFamily::Posix => vec!["-lc".to_string(), command.to_string()],
            ShellFamily::PowerShell => vec![
                "-NoLogo".to_string(),
                "-NoProfile".to_string(),
                "-Command".to_string(),
                command.to_string(),
            ],
            ShellFamily::Cmd => {
                vec!["/D".to_string(), "/C".to_string(), command.to_string()]
            }
        }
    }

    pub fn prompt_summary(&self) -> String {
        format!(
            "Shell environment: {} via `{}`. {}",
            self.family.as_str(),
            self.executable,
            self.family.prompt_guidance()
        )
    }
}

fn normalize_env_path(value: Option<OsString>) -> Option<String> {
    value.and_then(|entry| {
        let trimmed = entry.to_string_lossy().trim().to_string();
        if trimmed.is_empty() {
            return None;
        }
        Some(trimmed)
    })
}

fn read_non_empty_env_value(name: &str) -> Option<String> {
    normalize_env_path(std::env::var_os(name))
}

pub fn infer_shell_family(executable: &str) -> ShellFamily {
    let normalized = executable
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or(executable)
        .trim()
        .to_ascii_lowercase();
    if normalized.contains("pwsh") || normalized.contains("powershell") {
        return ShellFamily::PowerShell;
    }
    if normalized == "cmd" || normalized == "cmd.exe" {
        return ShellFamily::Cmd;
    }
    ShellFamily::Posix
}

fn shell_from_executable(executable: String) -> ShellSpec {
    ShellSpec {
        family: infer_shell_family(executable.as_str()),
        executable,
    }
}

fn push_unique_candidate(
    candidates: &mut Vec<String>,
    seen: &mut HashSet<String>,
    candidate: impl Into<String>,
) {
    let candidate = candidate.into();
    let trimmed = candidate.trim();
    if trimmed.is_empty() {
        return;
    }
    let normalized = trimmed.to_ascii_lowercase();
    if seen.insert(normalized) {
        candidates.push(trimmed.to_string());
    }
}

pub fn build_windows_shell_candidates(
    program_files: Option<&str>,
    program_w6432: Option<&str>,
    comspec: Option<&str>,
) -> Vec<String> {
    let mut candidates = Vec::new();
    let mut seen = HashSet::new();

    if let Some(program_files) = program_files
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        push_unique_candidate(
            &mut candidates,
            &mut seen,
            format!(r"{program_files}\PowerShell\7\pwsh.exe"),
        );
    }
    if let Some(program_w6432) = program_w6432
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        push_unique_candidate(
            &mut candidates,
            &mut seen,
            format!(r"{program_w6432}\PowerShell\7\pwsh.exe"),
        );
    }
    push_unique_candidate(
        &mut candidates,
        &mut seen,
        WINDOWS_POWERSHELL_LEGACY_PATH.to_string(),
    );
    for candidate in ["pwsh.exe", "pwsh", "powershell.exe", "powershell"] {
        push_unique_candidate(&mut candidates, &mut seen, candidate.to_string());
    }
    if let Some(comspec) = comspec.map(str::trim).filter(|value| !value.is_empty()) {
        push_unique_candidate(&mut candidates, &mut seen, comspec.to_string());
    }
    push_unique_candidate(&mut candidates, &mut seen, "cmd.exe".to_string());

    candidates
}

pub fn build_windows_powershell_candidates(
    program_files: Option<&str>,
    program_w6432: Option<&str>,
) -> Vec<String> {
    let mut candidates = Vec::new();
    let mut seen = HashSet::new();

    if let Some(program_files) = program_files
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        push_unique_candidate(
            &mut candidates,
            &mut seen,
            format!(r"{program_files}\PowerShell\7\pwsh.exe"),
        );
    }
    if let Some(program_w6432) = program_w6432
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        push_unique_candidate(
            &mut candidates,
            &mut seen,
            format!(r"{program_w6432}\PowerShell\7\pwsh.exe"),
        );
    }
    push_unique_candidate(
        &mut candidates,
        &mut seen,
        WINDOWS_POWERSHELL_LEGACY_PATH.to_string(),
    );
    for candidate in ["pwsh.exe", "pwsh", "powershell.exe", "powershell"] {
        push_unique_candidate(&mut candidates, &mut seen, candidate.to_string());
    }

    candidates
}

pub fn probe_windows_shell_candidate(candidate: &str) -> bool {
    let family = infer_shell_family(candidate);
    let mut command = Command::new(candidate);
    match family {
        ShellFamily::PowerShell => {
            command
                .arg("-NoLogo")
                .arg("-NoProfile")
                .arg("-Command")
                .arg("$PSVersionTable.PSVersion.ToString()");
        }
        ShellFamily::Cmd => {
            command.arg("/D").arg("/C").arg("exit 0");
        }
        ShellFamily::Posix => {
            command.arg("-lc").arg("exit 0");
        }
    }
    command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

pub fn resolve_windows_shell_with_probe<F>(
    override_shell: Option<String>,
    program_files: Option<String>,
    program_w6432: Option<String>,
    comspec: Option<String>,
    probe: F,
) -> ShellSpec
where
    F: Fn(&str) -> bool,
{
    if let Some(override_shell) = override_shell {
        return shell_from_executable(override_shell);
    }

    let candidates = build_windows_shell_candidates(
        program_files.as_deref(),
        program_w6432.as_deref(),
        comspec.as_deref(),
    );
    if let Some(resolved) = candidates
        .iter()
        .find(|candidate| probe(candidate.as_str()))
        .cloned()
    {
        return shell_from_executable(resolved);
    }

    shell_from_executable("cmd.exe".to_string())
}

pub fn resolve_windows_powershell_with_probe<F>(
    override_shell: Option<String>,
    program_files: Option<String>,
    program_w6432: Option<String>,
    probe: F,
) -> Option<ShellSpec>
where
    F: Fn(&str) -> bool,
{
    if let Some(override_shell) = override_shell {
        return Some(shell_from_executable(override_shell));
    }

    build_windows_powershell_candidates(program_files.as_deref(), program_w6432.as_deref())
        .into_iter()
        .find(|candidate| probe(candidate.as_str()))
        .map(shell_from_executable)
}

pub fn resolve_windows_shell(override_shell: Option<String>) -> ShellSpec {
    resolve_windows_shell_with_probe(
        override_shell,
        read_non_empty_env_value("ProgramFiles"),
        read_non_empty_env_value("ProgramW6432"),
        read_non_empty_env_value("COMSPEC"),
        probe_windows_shell_candidate,
    )
}

pub fn resolve_windows_powershell(override_shell: Option<String>) -> Option<ShellSpec> {
    resolve_windows_powershell_with_probe(
        override_shell,
        read_non_empty_env_value("ProgramFiles"),
        read_non_empty_env_value("ProgramW6432"),
        probe_windows_shell_candidate,
    )
}

pub fn resolve_shell(override_shell: Option<String>) -> ShellSpec {
    if cfg!(target_os = "windows") {
        return resolve_windows_shell(override_shell);
    }

    let executable = override_shell
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .or_else(|| read_non_empty_env_value("SHELL"))
        .unwrap_or_else(|| "sh".to_string());
    shell_from_executable(executable)
}

pub fn resolve_shell_from_env(var_name: &str) -> ShellSpec {
    resolve_shell(read_non_empty_env_value(var_name))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn infer_shell_family_detects_known_windows_shells() {
        assert_eq!(infer_shell_family("pwsh.exe"), ShellFamily::PowerShell);
        assert_eq!(
            infer_shell_family(r"C:\Windows\System32\cmd.exe"),
            ShellFamily::Cmd
        );
        assert_eq!(infer_shell_family("/bin/zsh"), ShellFamily::Posix);
    }

    #[test]
    fn build_windows_candidates_deduplicates_and_prefers_program_files() {
        let candidates = build_windows_shell_candidates(
            Some(r"C:\Program Files"),
            Some(r"C:\Program Files"),
            Some(r"C:\Windows\System32\cmd.exe"),
        );
        assert!(candidates
            .first()
            .is_some_and(|value| value.ends_with(r"PowerShell\7\pwsh.exe")));
        assert_eq!(
            candidates
                .iter()
                .filter(|value| value.as_str() == r"C:\Windows\System32\cmd.exe")
                .count(),
            1
        );
    }

    #[test]
    fn resolve_windows_shell_prefers_override_without_probe() {
        let shell = resolve_windows_shell_with_probe(
            Some("custom-shell.exe".to_string()),
            None,
            None,
            None,
            |_| false,
        );
        assert_eq!(shell.executable, "custom-shell.exe");
    }
}
