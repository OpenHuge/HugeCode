use std::io::ErrorKind;
use std::path::Path;
use std::process::Command;

use super::codex_probe::{
    resolve_codex_command_candidates, CodexInstallSource, CodexProbeCandidate,
    CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV,
};
use super::local_codex_paths::resolve_local_codex_home_dir;

pub(crate) fn codex_command_environment_overrides() -> Vec<(&'static str, String)> {
    resolve_local_codex_home_dir()
        .map(|home| vec![("CODEX_HOME", home.to_string_lossy().to_string())])
        .unwrap_or_default()
}

fn build_codex_command(binary: &str, args: &[String]) -> Command {
    let mut command = if cfg!(windows) && binary.trim().to_ascii_lowercase().ends_with(".ps1") {
        let mut powershell = Command::new("powershell.exe");
        powershell
            .arg("-NoLogo")
            .arg("-NoProfile")
            .arg("-ExecutionPolicy")
            .arg("Bypass")
            .arg("-File")
            .arg(binary);
        powershell
    } else {
        Command::new(binary)
    };
    for (key, value) in codex_command_environment_overrides() {
        command.env(key, value);
    }
    for arg in args {
        command.arg(arg);
    }
    command
}

fn format_codex_command_name(binary: &str) -> String {
    if cfg!(windows) && binary.trim().to_ascii_lowercase().ends_with(".ps1") {
        format!("powershell.exe -File {binary}")
    } else {
        binary.to_string()
    }
}

fn format_codex_command_not_found(display_binary: &str) -> String {
    format!(
        "failed to run `{display_binary}` (not found). Install Codex CLI or set {CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV}."
    )
}

fn format_codex_command_error(binary: &str, error: &std::io::Error) -> String {
    let display_binary = format_codex_command_name(binary);
    if error.kind() == ErrorKind::NotFound {
        return format_codex_command_not_found(display_binary.as_str());
    }
    format!("failed to run `{display_binary}`: {error}")
}

pub(crate) fn run_codex_command(
    binary: &str,
    args: &[String],
) -> Result<std::process::Output, String> {
    build_codex_command(binary, args)
        .output()
        .map_err(|error| format_codex_command_error(binary, &error))
}

fn is_retryable_codex_launch_error(error: &std::io::Error) -> bool {
    matches!(
        error.kind(),
        ErrorKind::NotFound | ErrorKind::PermissionDenied
    )
}

pub(crate) fn run_codex_command_with_candidates(
    candidates: &[CodexProbeCandidate],
    args: &[String],
) -> Result<(CodexProbeCandidate, std::process::Output, Vec<String>), String> {
    if candidates.is_empty() {
        return Err("failed to resolve Codex CLI command candidates.".to_string());
    }

    let explicit_only = candidates
        .first()
        .is_some_and(|candidate| candidate.source == CodexInstallSource::Explicit);
    let mut warnings = Vec::new();

    for (index, candidate) in candidates.iter().enumerate() {
        let candidate_path = Path::new(candidate.command.as_str());
        let candidate_points_to_path = candidate_path.parent().is_some();
        let candidate_missing = candidate_points_to_path && !candidate_path.is_file();
        if candidate_missing {
            let message = format_codex_command_not_found(
                format_codex_command_name(candidate.command.as_str()).as_str(),
            );
            let has_fallback = index + 1 < candidates.len();
            if explicit_only || !has_fallback {
                return Err(message);
            }
            warnings.push(format!(
                "Preferred Codex CLI candidate {} was unavailable on disk; falling back to the next detected install.",
                format_codex_command_name(candidate.command.as_str())
            ));
            continue;
        }

        match build_codex_command(candidate.command.as_str(), args).output() {
            Ok(output) => {
                return Ok((candidate.clone(), output, warnings));
            }
            Err(error) => {
                let message = format_codex_command_error(candidate.command.as_str(), &error);
                let has_fallback = index + 1 < candidates.len();
                if explicit_only || !has_fallback || !is_retryable_codex_launch_error(&error) {
                    return Err(message);
                }
                warnings.push(format!(
                    "Preferred Codex CLI candidate {} failed to launch; falling back to the next detected install.",
                    format_codex_command_name(candidate.command.as_str())
                ));
            }
        }
    }

    Err("failed to resolve Codex CLI command candidates.".to_string())
}

pub(crate) fn run_resolved_codex_command(
    codex_bin: Option<&str>,
    args: &[String],
) -> Result<(CodexProbeCandidate, std::process::Output, Vec<String>), String> {
    let candidates = resolve_codex_command_candidates(codex_bin)?;
    run_codex_command_with_candidates(candidates.as_slice(), args)
}

#[cfg(test)]
mod tests {
    use super::{codex_command_environment_overrides, run_codex_command_with_candidates};
    use crate::commands::codex_probe::{CodexInstallSource, CodexProbeCandidate};
    use std::sync::Mutex;

    fn codex_command_env_lock() -> &'static Mutex<()> {
        crate::commands::policy::rpc_policy_env_lock()
    }

    #[test]
    fn codex_command_environment_overrides_export_runtime_home_as_codex_home() {
        let _guard = codex_command_env_lock()
            .lock()
            .expect("codex command env lock poisoned");
        let previous_runtime_home = std::env::var_os("CODE_RUNTIME_LOCAL_CODEX_HOME");
        let previous_codex_home = std::env::var_os("CODEX_HOME");

        std::env::set_var("CODE_RUNTIME_LOCAL_CODEX_HOME", "/tmp/runtime-codex-home");
        std::env::remove_var("CODEX_HOME");

        let overrides = codex_command_environment_overrides();
        assert_eq!(
            overrides,
            vec![("CODEX_HOME", "/tmp/runtime-codex-home".to_string())]
        );

        match previous_runtime_home {
            Some(value) => std::env::set_var("CODE_RUNTIME_LOCAL_CODEX_HOME", value),
            None => std::env::remove_var("CODE_RUNTIME_LOCAL_CODEX_HOME"),
        }
        match previous_codex_home {
            Some(value) => std::env::set_var("CODEX_HOME", value),
            None => std::env::remove_var("CODEX_HOME"),
        }
    }

    #[test]
    fn codex_command_runner_falls_back_to_next_detected_candidate() {
        let missing_binary = if cfg!(windows) {
            r"C:\missing\codex.cmd"
        } else {
            "/missing/codex"
        };
        let fallback_binary = std::env::current_exe()
            .expect("resolve current test executable")
            .to_string_lossy()
            .to_string();
        let args = vec!["--help".to_string()];

        let (selected, output, warnings) = run_codex_command_with_candidates(
            &[
                CodexProbeCandidate {
                    command: missing_binary.to_string(),
                    source: CodexInstallSource::NpmGlobal,
                },
                CodexProbeCandidate {
                    command: fallback_binary.clone(),
                    source: CodexInstallSource::Path,
                },
            ],
            args.as_slice(),
        )
        .expect("runner should fall back to the next candidate");

        assert_eq!(selected.command, fallback_binary);
        assert!(output.status.success());
        assert_eq!(warnings.len(), 1);
        assert!(warnings[0].contains("falling back"));
    }

    #[test]
    fn codex_command_runner_does_not_fallback_from_explicit_override() {
        let missing_binary = if cfg!(windows) {
            r"C:\missing\codex.cmd"
        } else {
            "/missing/codex"
        };

        let error = run_codex_command_with_candidates(
            &[
                CodexProbeCandidate {
                    command: missing_binary.to_string(),
                    source: CodexInstallSource::Explicit,
                },
                CodexProbeCandidate {
                    command: if cfg!(windows) {
                        "cmd.exe".to_string()
                    } else {
                        "sh".to_string()
                    },
                    source: CodexInstallSource::Path,
                },
            ],
            &[],
        )
        .expect_err("explicit override should fail fast");

        assert!(error.contains("Install Codex CLI or set"));
    }
}
