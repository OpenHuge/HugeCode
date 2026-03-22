use std::env;
use std::path::{Path, PathBuf};

use ku0_runtime_shell_core::{infer_shell_family, ShellSpec, TerminalSpawnSpec};

const CODE_TAURI_WINDOWS_SHELL_ENV: &str = "CODE_TAURI_WINDOWS_SHELL";

#[derive(Clone, Debug, Eq, PartialEq)]
pub(super) struct TerminalShellDescriptor {
    pub program: String,
    pub args: Vec<String>,
    pub source: &'static str,
}

impl TerminalShellDescriptor {
    pub(super) fn command_line(&self) -> String {
        std::iter::once(self.program.as_str())
            .chain(self.args.iter().map(String::as_str))
            .collect::<Vec<_>>()
            .join(" ")
    }
}

pub(super) fn spawn_terminal_process(cwd: &Path) -> TerminalSpawnSpec {
    let descriptor = resolve_terminal_shell_descriptor();
    let program = descriptor.program;
    let mut spec = TerminalSpawnSpec::new(
        cwd.to_path_buf(),
        ShellSpec {
            family: infer_shell_family(program.as_str()),
            executable: program,
        },
    );
    spec.args = descriptor.args;
    spec
}

pub(super) fn describe_terminal_shell_command() -> String {
    resolve_terminal_shell_descriptor().command_line()
}

pub(super) fn terminal_shell_source() -> &'static str {
    resolve_terminal_shell_descriptor().source
}

pub(super) fn resolve_terminal_shell_descriptor() -> TerminalShellDescriptor {
    if cfg!(target_os = "windows") {
        return resolve_windows_terminal_shell_descriptor();
    }

    let shell = ku0_runtime_shell_core::resolve_shell(None);
    let args = shell.terminal_args();
    TerminalShellDescriptor {
        program: shell.executable,
        args,
        source: "default",
    }
}

#[cfg(test)]
fn resolve_windows_terminal_shell_descriptor() -> TerminalShellDescriptor {
    if let Some(shell_override) =
        env::var_os(CODE_TAURI_WINDOWS_SHELL_ENV).and_then(non_empty_env_path)
    {
        return descriptor_from_program(shell_override, "env");
    }

    // PTY teardown is materially more stable under cmd.exe in the current
    // Windows test environment, while production still prefers PowerShell.
    descriptor_from_program(PathBuf::from("cmd.exe"), "cmd")
}

#[cfg(not(test))]
fn resolve_windows_terminal_shell_descriptor() -> TerminalShellDescriptor {
    if let Some(shell_override) =
        env::var_os(CODE_TAURI_WINDOWS_SHELL_ENV).and_then(non_empty_env_path)
    {
        return descriptor_from_program(shell_override, "env");
    }

    for (program, source) in [
        ("pwsh.exe", "pwsh"),
        ("powershell.exe", "powershell"),
        ("cmd.exe", "cmd"),
    ] {
        if let Some(resolved) = find_executable_in_path(program) {
            return descriptor_from_program(resolved, source);
        }
    }

    descriptor_from_program(PathBuf::from("cmd.exe"), "cmd")
}

fn descriptor_from_program(program: PathBuf, source: &'static str) -> TerminalShellDescriptor {
    let lower_name = program
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let args = match lower_name.as_str() {
        "pwsh" | "pwsh.exe" => vec!["-NoLogo".to_string(), "-NoProfile".to_string()],
        "powershell" | "powershell.exe" => vec![
            "-NoLogo".to_string(),
            "-NoProfile".to_string(),
            "-ExecutionPolicy".to_string(),
            "Bypass".to_string(),
        ],
        "cmd" | "cmd.exe" => vec!["/Q".to_string()],
        _ => Vec::new(),
    };

    TerminalShellDescriptor {
        program: program.to_string_lossy().to_string(),
        args,
        source,
    }
}

fn non_empty_env_path(value: std::ffi::OsString) -> Option<PathBuf> {
    let trimmed = value.to_string_lossy().trim().to_string();
    if trimmed.is_empty() {
        return None;
    }
    Some(PathBuf::from(trimmed))
}

#[cfg(not(test))]
fn find_executable_in_path(program: &str) -> Option<PathBuf> {
    let program_path = Path::new(program);
    if program_path.parent().is_some() {
        return program_path.is_file().then(|| program_path.to_path_buf());
    }

    env::var_os("PATH").and_then(|value| {
        env::split_paths(&value)
            .map(|entry| entry.join(program))
            .find(|candidate| candidate.is_file())
    })
}

#[cfg(test)]
mod tests {
    use super::{
        descriptor_from_program, resolve_terminal_shell_descriptor, terminal_shell_source,
        TerminalShellDescriptor,
    };
    use std::path::PathBuf;
    use std::sync::{Mutex, OnceLock};

    fn terminal_shell_env_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    #[test]
    fn descriptor_from_program_applies_expected_default_args() {
        assert_eq!(
            descriptor_from_program(PathBuf::from("pwsh.exe"), "pwsh"),
            TerminalShellDescriptor {
                program: "pwsh.exe".to_string(),
                args: vec!["-NoLogo".to_string(), "-NoProfile".to_string()],
                source: "pwsh",
            }
        );
        assert_eq!(
            descriptor_from_program(PathBuf::from("powershell.exe"), "powershell"),
            TerminalShellDescriptor {
                program: "powershell.exe".to_string(),
                args: vec![
                    "-NoLogo".to_string(),
                    "-NoProfile".to_string(),
                    "-ExecutionPolicy".to_string(),
                    "Bypass".to_string(),
                ],
                source: "powershell",
            }
        );
        assert_eq!(
            descriptor_from_program(PathBuf::from("cmd.exe"), "cmd"),
            TerminalShellDescriptor {
                program: "cmd.exe".to_string(),
                args: vec!["/Q".to_string()],
                source: "cmd",
            }
        );
    }

    #[test]
    fn resolve_terminal_shell_descriptor_honors_windows_override_env() {
        if !cfg!(target_os = "windows") {
            return;
        }

        let _guard = terminal_shell_env_lock()
            .lock()
            .expect("terminal shell env lock poisoned");
        let previous = std::env::var_os("CODE_TAURI_WINDOWS_SHELL");
        std::env::set_var("CODE_TAURI_WINDOWS_SHELL", "powershell.exe");

        let descriptor = resolve_terminal_shell_descriptor();
        assert!(descriptor
            .program
            .to_ascii_lowercase()
            .contains("powershell"));
        assert_eq!(terminal_shell_source(), "env");

        match previous {
            Some(value) => std::env::set_var("CODE_TAURI_WINDOWS_SHELL", value),
            None => std::env::remove_var("CODE_TAURI_WINDOWS_SHELL"),
        }
    }
}
