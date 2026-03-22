use ku0_runtime_shell_core::{resolve_shell_from_env, ShellSpec};

async fn execute_core_bash_skill(
    config: &ServiceConfig,
    counters: &LiveSkillExecutionCounters,
    resolved_scope: Result<&WorkspaceScope, &String>,
    input: &str,
    options: &LiveSkillExecuteOptions,
    skill_id: &str,
    access_mode_hint: Option<&str>,
) -> LiveSkillExecutionResult {
    execute_core_bash_skill_with_cancel(
        config,
        counters,
        resolved_scope,
        input,
        options,
        skill_id,
        access_mode_hint,
        None,
    )
    .await
}

async fn execute_core_bash_skill_with_cancel(
    config: &ServiceConfig,
    counters: &LiveSkillExecutionCounters,
    resolved_scope: Result<&WorkspaceScope, &String>,
    input: &str,
    options: &LiveSkillExecuteOptions,
    skill_id: &str,
    access_mode_hint: Option<&str>,
    cancellation: Option<CancellationToken>,
) -> LiveSkillExecutionResult {
    let scope = match resolved_scope {
        Ok(scope) => scope,
        Err(error) => return core_failed_result(skill_id, error.clone(), Value::Null),
    };

    if let Err(error) = create_dir_all_off_thread(scope.workspace_path.as_path()).await {
        return core_failed_result(
            skill_id,
            format!(
                "Failed to prepare workspace `{}`: {error}",
                scope.workspace_path.display()
            ),
            json!({ "workspaceId": scope.workspace_id }),
        );
    }

    let Some(command) = resolve_core_shell_command(input, options) else {
        return core_failed_result(
            skill_id,
            "command is required for core-bash.".to_string(),
            json!({ "workspaceId": scope.workspace_id }),
        );
    };
    if let Err(error) = validate_core_shell_command(command) {
        return core_failed_result_with_error_code(
            skill_id,
            error,
            CORE_VALIDATION_COMMAND_RESTRICTED_ERROR_CODE,
            json!({ "workspaceId": scope.workspace_id }),
        );
    }

    let timeout_ms = normalize_optional_u64(
        options.timeout_ms,
        DEFAULT_CORE_SHELL_TIMEOUT_MS,
        250,
        120_000,
    );
    let effective_access_mode = normalize_core_bash_access_mode(access_mode_hint);
    let shell_spec = resolve_shell_from_env("CODE_RUNTIME_CORE_SHELL");
    if !config.sandbox_enabled || effective_access_mode == "full-access" {
        return execute_core_bash_legacy(
            scope,
            skill_id,
            command,
            timeout_ms,
            effective_access_mode,
            false,
            &shell_spec,
            cancellation.as_ref(),
        )
        .await;
    }

    counters.record_sandbox_exec_attempt();
    let network_access = normalize_sandbox_network_access(config.sandbox_network_access.as_str());
    let fs_access = if effective_access_mode == "read-only" {
        sandbox_rs::RuntimeFsAccess::ReadOnly
    } else {
        sandbox_rs::RuntimeFsAccess::ReadWrite
    };
    let sandbox_config = sandbox_rs::RuntimeSandboxConfig {
        network_access: network_access.to_string(),
        allowed_hosts: if config.sandbox_allowed_hosts.is_empty() {
            None
        } else {
            Some(config.sandbox_allowed_hosts.clone())
        },
        allowed_roots: Some(vec![scope.workspace_path.display().to_string()]),
        fs_isolation: "workspace".to_string(),
        fs_access,
        working_directory: Some(scope.workspace_path.display().to_string()),
    };
    let (shell_cmd, shell_args) = build_shell_invocation(&shell_spec, command);
    let options = sandbox_rs::RuntimeExecOptions {
        cwd: Some(scope.workspace_path.display().to_string()),
        timeout_ms: Some(timeout_ms),
        stdin: None,
        max_output_bytes: Some(MAX_CORE_SHELL_CAPTURE_BYTES),
        env: HashMap::new(),
    };
    let executed = tokio::task::spawn_blocking(move || {
        sandbox_rs::execute_native_command(sandbox_config, shell_cmd.as_str(), &shell_args, options)
    })
    .await
    .map_err(|error| format!("Sandbox execution task failed: {error}"));

    match executed {
        Ok(Ok(result)) => {
            if result.timed_out {
                counters.record_sandbox_exec_failure();
                return core_failed_result_with_error_code(
                    skill_id,
                    format!("Command timed out after {timeout_ms}ms."),
                    CORE_RUNTIME_COMMAND_TIMEOUT_ERROR_CODE,
                    json!({
                        "workspaceId": scope.workspace_id,
                        "command": command,
                        "timeoutMs": timeout_ms,
                        "sandboxed": true,
                        "shellFamily": shell_spec.family.as_str(),
                        "shellExecutable": shell_spec.executable.as_str(),
                        "effectiveAccessMode": effective_access_mode,
                        "sandboxPolicy": {
                            "fsAccess": if fs_access == sandbox_rs::RuntimeFsAccess::ReadOnly { "read-only" } else { "read-write" },
                            "networkAccess": network_access,
                        }
                    }),
                );
            }
            let output = [result.stdout.as_str(), result.stderr.as_str()]
                .iter()
                .map(|entry| entry.trim())
                .filter(|entry| !entry.is_empty())
                .collect::<Vec<_>>()
                .join("\n");
            let (status, message, no_matches, error_code) = classify_shell_command_result(
                command,
                result.exit_code,
                result.stdout.as_str(),
                result.stderr.as_str(),
            );
            if status == "failed" {
                counters.record_sandbox_exec_failure();
            }
            LiveSkillExecutionResult {
                run_id: new_id("live-skill-run"),
                skill_id: skill_id.to_string(),
                status: status.to_string(),
                message,
                output,
                network: None,
                artifacts: vec![],
                metadata: attach_optional_error_code(json!({
                    "workspaceId": scope.workspace_id,
                    "command": command,
                    "timeoutMs": timeout_ms,
                    "exitCode": result.exit_code,
                    "stdoutBytes": result.stdout.as_bytes().len(),
                    "stderrBytes": result.stderr.as_bytes().len(),
                    "noMatches": no_matches,
                    "sandboxed": true,
                    "shellFamily": shell_spec.family.as_str(),
                    "shellExecutable": shell_spec.executable.as_str(),
                    "effectiveAccessMode": effective_access_mode,
                    "sandboxPolicy": {
                        "fsAccess": if fs_access == sandbox_rs::RuntimeFsAccess::ReadOnly { "read-only" } else { "read-write" },
                        "networkAccess": network_access,
                    }
                }), error_code),
            }
        }
        Ok(Err(error)) => {
            counters.record_sandbox_exec_failure();
            core_failed_result_with_error_code(
                skill_id,
                format!("Sandbox execution unavailable: {error}"),
                CORE_SANDBOX_UNAVAILABLE_ERROR_CODE,
                json!({
                    "workspaceId": scope.workspace_id,
                    "command": command,
                    "timeoutMs": timeout_ms,
                    "sandboxed": true,
                    "shellFamily": shell_spec.family.as_str(),
                    "shellExecutable": shell_spec.executable.as_str(),
                    "effectiveAccessMode": effective_access_mode,
                    "sandboxErrorCode": CORE_SANDBOX_UNAVAILABLE_ERROR_CODE,
                    "sandboxPolicy": {
                        "fsAccess": if fs_access == sandbox_rs::RuntimeFsAccess::ReadOnly { "read-only" } else { "read-write" },
                        "networkAccess": network_access,
                    }
                }),
            )
        }
        Err(error) => {
            counters.record_sandbox_exec_failure();
            core_failed_result_with_error_code(
                skill_id,
                format!("Sandbox execution unavailable: {error}"),
                CORE_SANDBOX_UNAVAILABLE_ERROR_CODE,
                json!({
                    "workspaceId": scope.workspace_id,
                    "command": command,
                    "timeoutMs": timeout_ms,
                    "sandboxed": true,
                    "shellFamily": shell_spec.family.as_str(),
                    "shellExecutable": shell_spec.executable.as_str(),
                    "effectiveAccessMode": effective_access_mode,
                    "sandboxErrorCode": CORE_SANDBOX_UNAVAILABLE_ERROR_CODE,
                }),
            )
        }
    }
}

fn normalize_core_bash_access_mode(access_mode_hint: Option<&str>) -> &'static str {
    let Some(value) = access_mode_hint.map(str::trim).filter(|value| !value.is_empty()) else {
        return "on-request";
    };
    let normalized = value.to_ascii_lowercase().replace('_', "-");
    match normalized.as_str() {
        "read-only" | "read" => "read-only",
        "on-request" | "workspace-write" => "on-request",
        "full-access"
        | "danger-full-access"
        | "dangerous-bypass-approvals-and-sandbox"
        | "bypass-approvals-and-sandbox" => "full-access",
        _ => "on-request",
    }
}

fn shell_command_looks_like_search(command: &str) -> bool {
    let lowered = command.trim().to_ascii_lowercase();
    lowered.starts_with("rg ")
        || lowered.starts_with("grep ")
        || lowered.starts_with("git grep")
        || lowered.contains(" rg ")
        || lowered.contains(" grep ")
        || lowered.contains("git grep")
        || lowered.contains("xargs grep")
}

fn shell_command_uses_truncated_search_pipeline(command: &str) -> bool {
    let lowered = command.to_ascii_lowercase();
    shell_command_looks_like_search(command)
        && (lowered.contains("| head -n 200") || lowered.contains("|head -n 200"))
}

fn shell_exit_represents_no_matches(
    command: &str,
    exit_code: i32,
    stdout: &str,
    stderr: &str,
) -> bool {
    stdout.trim().is_empty()
        && stderr.trim().is_empty()
        && shell_command_looks_like_search(command)
        && (exit_code == 1 || (exit_code == 0 && shell_command_uses_truncated_search_pipeline(command)))
}

fn classify_shell_command_result(
    command: &str,
    exit_code: i32,
    stdout: &str,
    stderr: &str,
) -> (&'static str, String, bool, Option<&'static str>) {
    if shell_exit_represents_no_matches(command, exit_code, stdout, stderr) {
        return (
            "completed",
            "Search completed with no matches.".to_string(),
            true,
            None,
        );
    }
    if exit_code == 0 {
        return (
            "completed",
            format!("Command completed with exit code {exit_code}."),
            false,
            None,
        );
    }
    if shell_exit_indicates_command_unavailable(exit_code)
        || shell_output_indicates_command_unavailable(stdout)
        || shell_output_indicates_command_unavailable(stderr)
    {
        return (
            "failed",
            "Command failed because a referenced executable or shell command is unavailable in this environment."
                .to_string(),
            false,
            Some(CORE_RUNTIME_COMMAND_UNAVAILABLE_ERROR_CODE),
        );
    }
    if shell_exit_indicates_permission_denied(exit_code)
        || shell_output_indicates_permission_denied(stdout)
        || shell_output_indicates_permission_denied(stderr)
    {
        return (
            "failed",
            "Command failed because the environment denied access to an executable, file, or path."
                .to_string(),
            false,
            Some(CORE_RUNTIME_PERMISSION_DENIED_ERROR_CODE),
        );
    }
    (
        "failed",
        format!("Command failed with exit code {exit_code}."),
        false,
        Some(CORE_RUNTIME_COMMAND_FAILED_ERROR_CODE),
    )
}

fn shell_exit_indicates_command_unavailable(exit_code: i32) -> bool {
    matches!(exit_code, 127 | 9009)
}

fn shell_exit_indicates_permission_denied(exit_code: i32) -> bool {
    matches!(exit_code, 5 | 126)
}

fn shell_output_indicates_command_unavailable(output: &str) -> bool {
    let normalized = output.trim().to_ascii_lowercase();
    normalized.contains("command not found")
        || normalized.contains("is not recognized as an internal or external command")
        || normalized.contains("is not recognized as the name of a cmdlet")
        || normalized.contains("no such file or directory")
        || normalized.contains("cannot find the file")
        || normalized.contains("找不到")
}

fn shell_output_indicates_permission_denied(output: &str) -> bool {
    let normalized = output.trim().to_ascii_lowercase();
    normalized.contains("permission denied")
        || normalized.contains("access is denied")
        || normalized.contains("拒绝访问")
}

fn classify_shell_command_launch_error_code(error: &str) -> &'static str {
    if shell_output_indicates_permission_denied(error) {
        return CORE_RUNTIME_PERMISSION_DENIED_ERROR_CODE;
    }
    if shell_output_indicates_command_unavailable(error) {
        return CORE_RUNTIME_COMMAND_UNAVAILABLE_ERROR_CODE;
    }
    CORE_RUNTIME_COMMAND_FAILED_ERROR_CODE
}

fn attach_optional_error_code(metadata: Value, error_code: Option<&'static str>) -> Value {
    match error_code {
        Some(error_code) => attach_error_code(metadata, error_code),
        None => metadata,
    }
}

fn normalize_sandbox_network_access(value: &str) -> &'static str {
    match value.trim().to_ascii_lowercase().replace('_', "-").as_str() {
        "allowlist" => "allowlist",
        "full" => "full",
        _ => "none",
    }
}

fn build_shell_invocation(shell_spec: &ShellSpec, command: &str) -> (String, Vec<String>) {
    (
        shell_spec.executable.clone(),
        shell_spec.command_args(command),
    )
}

struct ShellCommandRunOutcome {
    exit_code: Option<i32>,
    stdout: String,
    stderr: String,
    timed_out: bool,
    cancelled: bool,
}

async fn execute_core_bash_legacy(
    scope: &WorkspaceScope,
    skill_id: &str,
    command: &str,
    timeout_ms: u64,
    effective_access_mode: &str,
    sandboxed: bool,
    shell_spec: &ShellSpec,
    cancellation: Option<&CancellationToken>,
) -> LiveSkillExecutionResult {
    let executed = run_shell_command_with_cancel(
        scope.workspace_path.as_path(),
        command,
        timeout_ms,
        shell_spec,
        cancellation,
    )
    .await;

    match executed {
        Ok(ShellCommandRunOutcome {
            exit_code,
            stdout,
            stderr,
            timed_out,
            cancelled,
        }) => {
            if cancelled {
                return core_failed_result_with_error_code(
                    skill_id,
                    "Command cancelled.".to_string(),
                    CORE_RUNTIME_COMMAND_CANCELLED_ERROR_CODE,
                    json!({
                        "workspaceId": scope.workspace_id,
                        "command": command,
                        "timeoutMs": timeout_ms,
                        "cancelled": true,
                        "sandboxed": sandboxed,
                        "effectiveAccessMode": effective_access_mode
                    }),
                );
            }
            if timed_out {
                return core_failed_result_with_error_code(
                    skill_id,
                    format!("Command timed out after {timeout_ms}ms."),
                    CORE_RUNTIME_COMMAND_TIMEOUT_ERROR_CODE,
                    json!({
                        "workspaceId": scope.workspace_id,
                        "command": command,
                        "timeoutMs": timeout_ms,
                        "sandboxed": sandboxed,
                        "effectiveAccessMode": effective_access_mode
                    }),
                );
            }
            let output = [stdout.as_str(), stderr.as_str()]
                .iter()
                .map(|entry| entry.trim())
                .filter(|entry| !entry.is_empty())
                .collect::<Vec<_>>()
                .join("\n");
            let normalized_exit_code = exit_code.unwrap_or(-1);
            let (status, message, no_matches, error_code) =
                classify_shell_command_result(command, normalized_exit_code, &stdout, &stderr);
            LiveSkillExecutionResult {
                run_id: new_id("live-skill-run"),
                skill_id: skill_id.to_string(),
                status: status.to_string(),
                message,
                output,
                network: None,
                artifacts: vec![],
                metadata: attach_optional_error_code(json!({
                    "workspaceId": scope.workspace_id,
                    "command": command,
                    "timeoutMs": timeout_ms,
                    "exitCode": exit_code,
                    "stdoutBytes": stdout.as_bytes().len(),
                    "stderrBytes": stderr.as_bytes().len(),
                    "noMatches": no_matches,
                    "sandboxed": sandboxed,
                    "shellFamily": shell_spec.family.as_str(),
                    "shellExecutable": shell_spec.executable.as_str(),
                    "effectiveAccessMode": effective_access_mode
                }), error_code),
            }
        }
        Err(error) => {
            let error_code = classify_shell_command_launch_error_code(error.as_str());
            core_failed_result_with_error_code(
                skill_id,
                error,
                error_code,
                json!({
                    "workspaceId": scope.workspace_id,
                    "command": command,
                    "timeoutMs": timeout_ms,
                    "sandboxed": sandboxed,
                    "shellFamily": shell_spec.family.as_str(),
                    "shellExecutable": shell_spec.executable.as_str(),
                    "effectiveAccessMode": effective_access_mode
                }),
            )
        }
    }
}

#[cfg(test)]
async fn run_shell_command(
    workspace_path: &Path,
    command: &str,
    timeout_ms: u64,
    shell_spec: &ShellSpec,
) -> Result<(Option<i32>, String, String, bool), String> {
    let outcome =
        run_shell_command_with_cancel(workspace_path, command, timeout_ms, shell_spec, None).await?;
    Ok((
        outcome.exit_code,
        outcome.stdout,
        outcome.stderr,
        outcome.timed_out,
    ))
}

async fn run_shell_command_with_cancel(
    workspace_path: &Path,
    command: &str,
    timeout_ms: u64,
    shell_spec: &ShellSpec,
    cancellation: Option<&CancellationToken>,
) -> Result<ShellCommandRunOutcome, String> {
    let mut process = TokioCommand::new(shell_spec.executable.as_str());
    process.args(shell_spec.command_args(command));
    process
        .current_dir(workspace_path)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    let mut child = process
        .spawn()
        .map_err(|error| format!("Failed to run command `{command}`: {error}"))?;
    let stdout_stream = child
        .stdout
        .take()
        .ok_or_else(|| format!("Failed to capture stdout for command `{command}`."))?;
    let stderr_stream = child
        .stderr
        .take()
        .ok_or_else(|| format!("Failed to capture stderr for command `{command}`."))?;

    let stdout_task = tokio::spawn(read_shell_stream(
        stdout_stream,
        MAX_CORE_SHELL_CAPTURE_BYTES,
    ));
    let stderr_task = tokio::spawn(read_shell_stream(
        stderr_stream,
        MAX_CORE_SHELL_CAPTURE_BYTES,
    ));

    let status = if let Some(cancellation) = cancellation {
        tokio::select! {
            _ = cancellation.cancelled() => {
                let _ = child.kill().await;
                let _ = child.wait().await;
                stdout_task.abort();
                stderr_task.abort();
                return Ok(ShellCommandRunOutcome {
                    exit_code: None,
                    stdout: String::new(),
                    stderr: String::new(),
                    timed_out: false,
                    cancelled: true,
                });
            }
            waited = timeout(Duration::from_millis(timeout_ms), child.wait()) => {
                match waited {
                    Ok(Ok(status)) => status,
                    Ok(Err(error)) => {
                        stdout_task.abort();
                        stderr_task.abort();
                        return Err(format!("Failed to execute command `{command}`: {error}"));
                    }
                    Err(_) => {
                        let _ = child.kill().await;
                        let _ = child.wait().await;
                        stdout_task.abort();
                        stderr_task.abort();
                        return Ok(ShellCommandRunOutcome {
                            exit_code: None,
                            stdout: String::new(),
                            stderr: String::new(),
                            timed_out: true,
                            cancelled: false,
                        });
                    }
                }
            }
        }
    } else {
        match timeout(Duration::from_millis(timeout_ms), child.wait()).await {
            Ok(Ok(status)) => status,
            Ok(Err(error)) => {
                stdout_task.abort();
                stderr_task.abort();
                return Err(format!("Failed to execute command `{command}`: {error}"));
            }
            Err(_) => {
                let _ = child.kill().await;
                let _ = child.wait().await;
                stdout_task.abort();
                stderr_task.abort();
                return Ok(ShellCommandRunOutcome {
                    exit_code: None,
                    stdout: String::new(),
                    stderr: String::new(),
                    timed_out: true,
                    cancelled: false,
                });
            }
        }
    };

    let stdout = stdout_task
        .await
        .map_err(|error| format!("Failed to collect stdout for command `{command}`: {error}"))?
        .map_err(|error| format!("Failed to read stdout for command `{command}`: {error}"))?;
    let stderr = stderr_task
        .await
        .map_err(|error| format!("Failed to collect stderr for command `{command}`: {error}"))?
        .map_err(|error| format!("Failed to read stderr for command `{command}`: {error}"))?;

    Ok(ShellCommandRunOutcome {
        exit_code: status.code(),
        stdout: truncate_shell_output(stdout.as_str()),
        stderr: truncate_shell_output(stderr.as_str()),
        timed_out: false,
        cancelled: false,
    })
}

async fn read_shell_stream<R>(mut stream: R, max_bytes: usize) -> Result<String, std::io::Error>
where
    R: AsyncRead + Unpin,
{
    let mut captured = Vec::with_capacity(max_bytes.min(8 * 1024));
    let mut buffer = [0u8; 8 * 1024];
    let mut truncated = false;

    loop {
        let read = stream.read(&mut buffer).await?;
        if read == 0 {
            break;
        }
        if !truncated && append_bytes_with_limit(&mut captured, &buffer[..read], max_bytes) {
            truncated = true;
        }
    }

    let mut output = String::from_utf8_lossy(captured.as_slice()).into_owned();
    if truncated {
        output.push('…');
    }
    Ok(output)
}
