use super::*;

const CODE_RUNTIME_DISABLE_WORKSPACE_PICKER_ENV: &str = "CODE_RUNTIME_DISABLE_WORKSPACE_PICKER";

enum WorkspacePickerAttemptOutcome {
    Selected(String),
    Cancelled,
    Unavailable,
}

async fn run_workspace_picker_attempt(
    program: &str,
    args: &[&str],
    cancellation_markers: &[&str],
) -> Result<WorkspacePickerAttemptOutcome, RpcError> {
    let output = match tokio::process::Command::new(program)
        .args(args)
        .output()
        .await
    {
        Ok(output) => output,
        Err(error) => {
            if error.kind() == std::io::ErrorKind::NotFound {
                return Ok(WorkspacePickerAttemptOutcome::Unavailable);
            }
            return Err(RpcError::internal(format!(
                "Failed to launch workspace picker `{program}`: {error}"
            )));
        }
    };

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if output.status.success() {
        if stdout.is_empty() {
            return Ok(WorkspacePickerAttemptOutcome::Cancelled);
        }
        let selected_path = normalize_workspace_picker_path(stdout.as_str())?;
        return Ok(WorkspacePickerAttemptOutcome::Selected(selected_path));
    }

    let combined_output = if stderr.is_empty() {
        stdout.clone()
    } else if stdout.is_empty() {
        stderr.clone()
    } else {
        format!("{stdout}\n{stderr}")
    };
    let combined_lower = combined_output.to_lowercase();
    if output.status.code() == Some(1)
        || cancellation_markers
            .iter()
            .any(|marker| combined_lower.contains(marker.to_lowercase().as_str()))
    {
        return Ok(WorkspacePickerAttemptOutcome::Cancelled);
    }

    let message = if combined_output.trim().is_empty() {
        format!(
            "Workspace picker command `{program}` failed with status {:?}.",
            output.status.code()
        )
    } else {
        format!("Workspace picker command `{program}` failed: {combined_output}")
    };
    Err(RpcError::internal(message))
}

fn normalize_workspace_picker_path(raw: &str) -> Result<String, RpcError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(RpcError::internal(
            "Runtime picker returned an empty workspace path.",
        ));
    }
    let path = Path::new(trimmed);
    if !path.is_dir() {
        return Err(RpcError::internal(format!(
            "Runtime picker returned non-directory path: `{}`.",
            trimmed
        )));
    }
    let normalized_path = fs::canonicalize(path)
        .ok()
        .unwrap_or_else(|| path.to_path_buf());
    Ok(normalized_path.to_string_lossy().trim().to_string())
}

fn parse_truthy_flag(value: Option<&str>) -> bool {
    let Some(raw) = value else {
        return false;
    };
    matches!(
        raw.trim().to_ascii_lowercase().as_str(),
        "1" | "true" | "yes" | "on"
    )
}

fn is_workspace_picker_disabled_from_values(
    disable_picker: Option<&str>,
    ci: Option<&str>,
) -> bool {
    parse_truthy_flag(disable_picker) || parse_truthy_flag(ci)
}

fn is_workspace_picker_disabled() -> bool {
    is_workspace_picker_disabled_from_values(
        std::env::var(CODE_RUNTIME_DISABLE_WORKSPACE_PICKER_ENV)
            .ok()
            .as_deref(),
        std::env::var("CI").ok().as_deref(),
    )
}

async fn pick_workspace_directory_path_from_runtime() -> Result<Option<String>, RpcError> {
    if is_workspace_picker_disabled() {
        return Err(RpcError::internal(
            "Workspace picker is disabled in this non-interactive runtime environment.",
        ));
    }

    #[cfg(target_os = "macos")]
    {
        match run_workspace_picker_attempt(
            "osascript",
            &[
                "-e",
                "POSIX path of (choose folder with prompt \"Select workspace folder\")",
            ],
            &["user canceled", "-128"],
        )
        .await?
        {
            WorkspacePickerAttemptOutcome::Selected(path) => return Ok(Some(path)),
            WorkspacePickerAttemptOutcome::Cancelled => return Ok(None),
            WorkspacePickerAttemptOutcome::Unavailable => {
                return Err(RpcError::internal(
                    "Workspace picker is unavailable: `osascript` not found on macOS runtime host.",
                ));
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        let powershell_script = "[void][System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms');$dialog=New-Object System.Windows.Forms.FolderBrowserDialog;$dialog.Description='Select workspace folder';$dialog.ShowNewFolderButton=$false;if($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK){Write-Output $dialog.SelectedPath}";
        let Some(powershell_shell) = ku0_runtime_shell_core::resolve_windows_powershell(None)
        else {
            return Err(RpcError::internal(
                "Workspace picker is unavailable: neither `pwsh` nor `powershell` was found on the Windows runtime host.",
            ));
        };
        match run_workspace_picker_attempt(
            powershell_shell.executable.as_str(),
            &[
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                powershell_script,
            ],
            &["operation canceled", "cancelled"],
        )
        .await?
        {
            WorkspacePickerAttemptOutcome::Selected(path) => return Ok(Some(path)),
            WorkspacePickerAttemptOutcome::Cancelled => return Ok(None),
            WorkspacePickerAttemptOutcome::Unavailable => {
                return Err(RpcError::internal(
                    "Workspace picker is unavailable: resolved Windows PowerShell executable could not be launched.",
                ));
            }
        }
    }

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        match run_workspace_picker_attempt(
            "zenity",
            &[
                "--file-selection",
                "--directory",
                "--title=Select workspace folder",
            ],
            &["cancel"],
        )
        .await?
        {
            WorkspacePickerAttemptOutcome::Selected(path) => return Ok(Some(path)),
            WorkspacePickerAttemptOutcome::Cancelled => return Ok(None),
            WorkspacePickerAttemptOutcome::Unavailable => {}
        }

        let home_dir = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
        match run_workspace_picker_attempt(
            "kdialog",
            &[
                "--getexistingdirectory",
                home_dir.as_str(),
                "Select workspace folder",
            ],
            &["cancel"],
        )
        .await?
        {
            WorkspacePickerAttemptOutcome::Selected(path) => Ok(Some(path)),
            WorkspacePickerAttemptOutcome::Cancelled => Ok(None),
            WorkspacePickerAttemptOutcome::Unavailable => Err(RpcError::internal(
                "Workspace picker is unavailable: expected `zenity` or `kdialog` on runtime host.",
            )),
        }
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", unix)))]
    {
        Err(RpcError::internal(
            "Workspace picker is unavailable on this runtime host platform.",
        ))
    }
}

pub(super) async fn handle_workspace_pick_directory() -> Result<Value, RpcError> {
    match pick_workspace_directory_path_from_runtime().await? {
        Some(path) => Ok(Value::String(path)),
        None => Ok(Value::Null),
    }
}

#[cfg(test)]
mod tests {
    use super::{is_workspace_picker_disabled_from_values, parse_truthy_flag};

    #[test]
    fn parse_truthy_flag_accepts_common_truthy_values() {
        assert!(parse_truthy_flag(Some("1")));
        assert!(parse_truthy_flag(Some("true")));
        assert!(parse_truthy_flag(Some(" YES ")));
        assert!(parse_truthy_flag(Some("On")));
    }

    #[test]
    fn parse_truthy_flag_rejects_non_truthy_values() {
        assert!(!parse_truthy_flag(None));
        assert!(!parse_truthy_flag(Some("")));
        assert!(!parse_truthy_flag(Some("0")));
        assert!(!parse_truthy_flag(Some("false")));
        assert!(!parse_truthy_flag(Some("off")));
    }

    #[test]
    fn workspace_picker_disabled_by_ci_or_explicit_env() {
        assert!(!is_workspace_picker_disabled_from_values(None, None));
        assert!(is_workspace_picker_disabled_from_values(Some("1"), None));
        assert!(is_workspace_picker_disabled_from_values(None, Some("true")));
        assert!(is_workspace_picker_disabled_from_values(
            Some("0"),
            Some("1")
        ));
        assert!(!is_workspace_picker_disabled_from_values(
            Some("0"),
            Some("false")
        ));
    }
}
