use super::*;
use ku0_runtime_shell_core::{
    build_terminal_runtime_status, push_terminal_line, resolve_shell, spawn_terminal_process,
    terminate_terminal_process, ShellFamily, TerminalExitStatus, TerminalProcessRegistry,
    TerminalRuntimeState, TerminalSessionRecord, TerminalSessionState, TerminalSpawnSpec,
};
use std::path::PathBuf;
use tokio::time::{sleep, Duration};

#[derive(Clone, Debug, Default)]
pub(crate) struct TerminalOpenOptions {
    pub(crate) cwd: Option<PathBuf>,
    pub(crate) env: Vec<(String, String)>,
    pub(crate) command: Option<String>,
    pub(crate) args: Vec<String>,
}

pub(crate) fn build_terminal_summary(session: &TerminalSessionRecord) -> Value {
    json!({
        "id": session.id,
        "workspaceId": session.workspace_id,
        "state": terminal_session_state_label(session.state),
        "createdAt": session.created_at,
        "updatedAt": session.updated_at,
        "exitStatus": session.exit_status,
        "lines": session.lines,
    })
}

fn synthesize_terminal_output_from_summary(summary: &Value) -> Option<String> {
    let lines = summary.get("lines")?.as_array()?;
    let synthesized = lines
        .iter()
        .filter_map(Value::as_str)
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .filter(|line| *line != "Terminal session opened.")
        .filter(|line| !line.starts_with("Working directory: "))
        .filter(|line| !line.starts_with("> "))
        .collect::<Vec<_>>();
    if synthesized.is_empty() {
        return None;
    }
    Some(synthesized.join("\n"))
}

fn terminal_session_state_label(state: TerminalSessionState) -> &'static str {
    match state {
        TerminalSessionState::Created => "created",
        TerminalSessionState::Exited => "exited",
        TerminalSessionState::IoFailed => "ioFailed",
        TerminalSessionState::Unsupported => "unsupported",
    }
}

fn terminal_runtime_state_label(state: TerminalRuntimeState) -> &'static str {
    match state {
        TerminalRuntimeState::Ready => "ready",
        TerminalRuntimeState::Uninitialized => "uninitialized",
        TerminalRuntimeState::Unsupported => "unsupported",
    }
}

fn build_terminal_status_payload(state: TerminalRuntimeState, active_count: usize) -> Value {
    let status = build_terminal_runtime_status(state, active_count);
    json!({
        "state": terminal_runtime_state_label(status.state),
        "message": status.message
    })
}

fn resolve_workspace_cwd(workspaces: &[WorkspaceSummary], workspace_id: &str) -> PathBuf {
    workspaces
        .iter()
        .find(|workspace| workspace.id == workspace_id)
        .map(|workspace| PathBuf::from(workspace.path.as_str()))
        .filter(|path| path.is_dir())
        .or_else(|| std::env::current_dir().ok())
        .unwrap_or_else(|| PathBuf::from("."))
}

fn resolve_terminal_cwd(
    workspaces: &[WorkspaceSummary],
    workspace_id: &str,
    requested_cwd: Option<PathBuf>,
) -> PathBuf {
    let workspace_cwd = resolve_workspace_cwd(workspaces, workspace_id);
    let Some(requested_cwd) = requested_cwd else {
        return workspace_cwd;
    };
    if requested_cwd.is_absolute() {
        return requested_cwd;
    }
    workspace_cwd.join(requested_cwd)
}

fn quote_terminal_token(shell_family: ShellFamily, token: &str) -> String {
    match shell_family {
        ShellFamily::Posix => format!("'{}'", token.replace('\'', "'\"'\"'")),
        ShellFamily::PowerShell => format!("'{}'", token.replace('\'', "''")),
        ShellFamily::Cmd => format!("\"{}\"", token.replace('"', "\"\"")),
    }
}

fn build_terminal_command_line(
    shell_family: ShellFamily,
    command: Option<&str>,
    args: &[String],
) -> Option<String> {
    let command = command
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)?;
    if args.is_empty() {
        return Some(command);
    }
    let mut tokens = vec![quote_terminal_token(shell_family, command.as_str())];
    tokens.extend(
        args.iter()
            .map(String::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(|value| quote_terminal_token(shell_family, value)),
    );
    Some(tokens.join(" "))
}

fn next_terminal_session_id() -> String {
    format!("terminal-{}", Uuid::new_v4())
}

pub(crate) async fn terminal_status_payload(ctx: &AppContext) -> Value {
    let sessions = ctx.terminal_sessions.read().await;
    let active_count = sessions
        .values()
        .filter(|session| session.is_active())
        .count();
    build_terminal_status_payload(TerminalRuntimeState::Ready, active_count)
}

pub(crate) async fn handle_terminal_open(
    ctx: &AppContext,
    workspace_id: &str,
) -> Result<Value, RpcError> {
    handle_terminal_open_with_options(ctx, workspace_id, TerminalOpenOptions::default()).await
}

pub(crate) async fn handle_terminal_open_with_options(
    ctx: &AppContext,
    workspace_id: &str,
    options: TerminalOpenOptions,
) -> Result<Value, RpcError> {
    let workspaces = {
        let state = ctx.state.read().await;
        state.workspaces.clone()
    };
    let cwd = resolve_terminal_cwd(&workspaces, workspace_id, options.cwd);
    let session_id = next_terminal_session_id();
    let shell = resolve_shell(None);
    let initial_command =
        build_terminal_command_line(shell.family, options.command.as_deref(), &options.args);
    let mut session = TerminalSessionRecord::new(
        session_id.clone(),
        workspace_id.to_string(),
        now_ms(),
        Some(cwd.clone()),
        TerminalSessionState::Created,
    );
    session.push_line("Terminal session opened.");
    session.push_line(format!("Working directory: {}", cwd.display()));
    if let Some(command) = initial_command.as_deref() {
        session.push_line(format!("> {command}"));
    }

    let mut spawn_spec = TerminalSpawnSpec::new(cwd.clone(), shell.clone());
    spawn_spec.env = options.env;
    if let Some(command) = initial_command.as_deref() {
        spawn_spec.args = shell.command_args(command);
    }
    let spawned_process = spawn_terminal_process(&spawn_spec);
    if let Err(error) = spawned_process.as_ref() {
        session.set_state(TerminalSessionState::IoFailed, now_ms());
        session.push_line(format!("Failed to start terminal shell: {error}"));
    }

    if let Ok(process) = spawned_process {
        let mut registry = match ctx.terminal_processes.lock() {
            Ok(guard) => guard,
            Err(poisoned) => poisoned.into_inner(),
        };
        registry.insert(session_id.clone(), process);
    }

    let mut sessions = ctx.terminal_sessions.write().await;
    sessions.insert(session_id, session.clone());
    Ok(build_terminal_summary(&session))
}

fn with_terminal_process_registry<T>(
    ctx: &AppContext,
    callback: impl FnOnce(&mut TerminalProcessRegistry) -> T,
) -> T {
    let mut registry = match ctx.terminal_processes.lock() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    };
    callback(&mut registry)
}

async fn append_terminal_error(
    ctx: &AppContext,
    session_id: &str,
    message: String,
    mark_io_failed: bool,
) -> Option<Value> {
    let mut sessions = ctx.terminal_sessions.write().await;
    let session = sessions.get_mut(session_id)?;
    if mark_io_failed {
        session.set_state(TerminalSessionState::IoFailed, now_ms());
    } else {
        session.touch(now_ms());
    }
    push_terminal_line(session, message);
    Some(build_terminal_summary(session))
}

async fn apply_terminal_exit_status(
    ctx: &AppContext,
    session_id: &str,
    exit_status: TerminalExitStatus,
) -> Option<Value> {
    let mut sessions = ctx.terminal_sessions.write().await;
    let session = sessions.get_mut(session_id)?;
    session.set_exit_status(exit_status, now_ms());
    session.set_state(TerminalSessionState::Exited, now_ms());
    Some(build_terminal_summary(session))
}

async fn append_terminal_lines(
    ctx: &AppContext,
    session_id: &str,
    lines: Vec<String>,
) -> Option<Value> {
    let mut sessions = ctx.terminal_sessions.write().await;
    let session = sessions.get_mut(session_id)?;
    if !lines.is_empty() {
        for line in lines {
            push_terminal_line(session, line);
        }
        session.touch(now_ms());
    }
    Some(build_terminal_summary(session))
}

async fn sync_terminal_output(
    ctx: &AppContext,
    session_id: &str,
) -> Result<(String, Value), RpcError> {
    let raw_output =
        with_terminal_process_registry(ctx, |registry| registry.drain_raw_output(session_id))
            .join("");
    let lines =
        with_terminal_process_registry(ctx, |registry| registry.drain_line_output(session_id));
    let summary = if let Some(updated) = append_terminal_lines(ctx, session_id, lines).await {
        updated
    } else {
        let sessions = ctx.terminal_sessions.read().await;
        sessions
            .get(session_id)
            .map(build_terminal_summary)
            .unwrap_or(Value::Null)
    };
    if let Some(updated) = sync_terminal_exit_status(ctx, session_id).await? {
        return Ok((raw_output, updated));
    }
    Ok((raw_output, summary))
}

async fn sync_terminal_exit_status(
    ctx: &AppContext,
    session_id: &str,
) -> Result<Option<Value>, RpcError> {
    let exit_status = with_terminal_process_registry(ctx, |registry| {
        registry.with_process_mut(session_id, |handle| handle.try_wait())
    });
    match exit_status {
        Ok(Some(exit_status)) => Ok(apply_terminal_exit_status(ctx, session_id, exit_status).await),
        Ok(None) => Ok(None),
        Err(error) => Err(RpcError::internal(error.to_string())),
    }
}

pub(crate) async fn handle_terminal_write(
    ctx: &AppContext,
    session_id: &str,
    input: &str,
) -> Result<Value, RpcError> {
    let command = input.trim();
    let mut sessions = ctx.terminal_sessions.write().await;
    let Some(session) = sessions.get_mut(session_id) else {
        return Ok(Value::Null);
    };
    if command.is_empty() {
        return Ok(build_terminal_summary(session));
    }
    push_terminal_line(session, format!("> {command}"));
    session.touch(now_ms());
    drop(sessions);

    let write_result = with_terminal_process_registry(ctx, |registry| {
        registry.with_process_mut(session_id, |handle| handle.write_command(command))
    });
    if let Err(error) = write_result {
        return Ok(append_terminal_error(
            ctx,
            session_id,
            format!("Failed to send command to terminal shell: {error}"),
            true,
        )
        .await
        .unwrap_or(Value::Null));
    }

    let sessions = ctx.terminal_sessions.read().await;
    Ok(sessions
        .get(session_id)
        .map(build_terminal_summary)
        .unwrap_or(Value::Null))
}

pub(crate) async fn handle_terminal_input_raw(
    ctx: &AppContext,
    session_id: &str,
    input: &str,
) -> Result<Value, RpcError> {
    let sessions = ctx.terminal_sessions.read().await;
    let Some(session) = sessions.get(session_id) else {
        return Ok(json!(false));
    };
    if !session.is_active() {
        return Ok(json!(false));
    }
    drop(sessions);

    let write_result = with_terminal_process_registry(ctx, |registry| {
        registry.with_process_mut(session_id, |handle| handle.write_raw_input(input))
    });
    match write_result {
        Ok(()) => {
            let mut sessions = ctx.terminal_sessions.write().await;
            if let Some(session) = sessions.get_mut(session_id) {
                session.touch(now_ms());
            }
            Ok(json!(true))
        }
        Err(error) => {
            let _ = append_terminal_error(
                ctx,
                session_id,
                format!("Failed to send terminal raw input: {error}"),
                true,
            )
            .await;
            Ok(json!(false))
        }
    }
}

pub(crate) async fn handle_terminal_read(
    ctx: &AppContext,
    session_id: &str,
) -> Result<Value, RpcError> {
    Ok(sync_terminal_output(ctx, session_id).await?.1)
}

pub(crate) async fn handle_terminal_read_output(
    ctx: &AppContext,
    session_id: &str,
) -> Result<Value, RpcError> {
    const OUTPUT_SYNC_ATTEMPTS: usize = 4;
    const OUTPUT_SYNC_RETRY_DELAY_MS: u64 = 40;

    for attempt in 0..OUTPUT_SYNC_ATTEMPTS {
        let (output, summary) = sync_terminal_output(ctx, session_id).await?;
        let effective_output = if output.trim().is_empty() {
            synthesize_terminal_output_from_summary(&summary).unwrap_or_default()
        } else {
            output
        };
        let exited = summary
            .get("exitStatus")
            .and_then(Value::as_object)
            .is_some_and(|status| !status.is_empty());
        if !effective_output.trim().is_empty() || exited || attempt + 1 == OUTPUT_SYNC_ATTEMPTS {
            return Ok(json!({
                "output": effective_output,
                "summary": summary,
            }));
        }
        sleep(Duration::from_millis(OUTPUT_SYNC_RETRY_DELAY_MS)).await;
    }

    Ok(json!({
        "output": "",
        "summary": Value::Null,
    }))
}

pub(crate) async fn handle_terminal_interrupt(
    ctx: &AppContext,
    session_id: &str,
) -> Result<Value, RpcError> {
    let interrupt_result = with_terminal_process_registry(ctx, |registry| {
        registry.with_process_mut(session_id, |handle| handle.send_interrupt())
    });
    match interrupt_result {
        Ok(()) => Ok(json!(true)),
        Err(error) => {
            let _ = append_terminal_error(
                ctx,
                session_id,
                format!("Failed to send terminal interrupt: {error}"),
                true,
            )
            .await;
            Ok(json!(false))
        }
    }
}

pub(crate) async fn handle_terminal_resize(
    ctx: &AppContext,
    session_id: &str,
    rows: u16,
    cols: u16,
) -> Result<Value, RpcError> {
    let resize_result = with_terminal_process_registry(ctx, |registry| {
        registry.with_process_mut(session_id, |handle| handle.resize(rows, cols))
    });
    match resize_result {
        Ok(()) => Ok(json!(true)),
        Err(error) => {
            let _ = append_terminal_error(
                ctx,
                session_id,
                format!("Failed to resize terminal shell: {error}"),
                true,
            )
            .await;
            Ok(json!(false))
        }
    }
}

pub(crate) async fn handle_terminal_close(
    ctx: &AppContext,
    session_id: &str,
) -> Result<Value, RpcError> {
    let removed_process =
        with_terminal_process_registry(ctx, |registry| registry.remove(session_id));
    if let Some(process) = removed_process {
        terminate_terminal_process(process);
    }

    let mut sessions = ctx.terminal_sessions.write().await;
    let Some(session) = sessions.get_mut(session_id) else {
        return Ok(json!(false));
    };
    session.set_state(TerminalSessionState::Exited, now_ms());
    push_terminal_line(session, "Terminal session closed.".to_string());
    Ok(json!(true))
}

pub(crate) async fn handle_terminal_wait_for_exit(
    ctx: &AppContext,
    session_id: &str,
) -> Result<Value, RpcError> {
    let mut lines =
        with_terminal_process_registry(ctx, |registry| registry.drain_line_output(session_id));
    let exit_status = with_terminal_process_registry(ctx, |registry| {
        registry.with_process_mut(session_id, |handle| handle.wait())
    });
    match exit_status {
        Ok(exit_status) => {
            lines.extend(with_terminal_process_registry(ctx, |registry| {
                registry.drain_line_output(session_id)
            }));
            let _ = append_terminal_lines(ctx, session_id, lines).await;
            Ok(apply_terminal_exit_status(ctx, session_id, exit_status)
                .await
                .unwrap_or(Value::Null))
        }
        Err(_error) => {
            let sessions = ctx.terminal_sessions.read().await;
            Ok(sessions
                .get(session_id)
                .map(build_terminal_summary)
                .unwrap_or(Value::Null))
        }
    }
}

pub(crate) async fn handle_terminal_kill(
    ctx: &AppContext,
    session_id: &str,
) -> Result<Value, RpcError> {
    let exit_status = with_terminal_process_registry(ctx, |registry| {
        registry.with_process_mut(session_id, |handle| handle.terminate())
    });
    match exit_status {
        Ok(exit_status) => Ok(apply_terminal_exit_status(ctx, session_id, exit_status)
            .await
            .unwrap_or(Value::Null)),
        Err(error) => Ok(append_terminal_error(
            ctx,
            session_id,
            format!("Failed to terminate terminal shell: {error}"),
            true,
        )
        .await
        .unwrap_or(Value::Null)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn terminal_summary_contains_canonical_state() {
        let states = [
            TerminalSessionState::Created,
            TerminalSessionState::Exited,
            TerminalSessionState::IoFailed,
            TerminalSessionState::Unsupported,
        ];
        for state in states {
            let session = TerminalSessionRecord::new(
                "terminal-1".to_string(),
                "workspace-1".to_string(),
                1,
                None,
                state,
            );
            let summary = build_terminal_summary(&session);
            assert_eq!(
                summary["state"],
                Value::String(terminal_session_state_label(state).to_string())
            );
            assert!(summary.get("active").is_none());
        }
    }

    #[test]
    fn terminal_status_payload_contains_canonical_state() {
        let ready = build_terminal_status_payload(TerminalRuntimeState::Ready, 2);
        assert_eq!(ready["state"], Value::String("ready".to_string()));
        assert!(ready.get("available").is_none());

        let uninitialized = build_terminal_status_payload(TerminalRuntimeState::Uninitialized, 0);
        assert_eq!(
            uninitialized["state"],
            Value::String("uninitialized".to_string())
        );
        assert!(uninitialized.get("available").is_none());

        let unsupported = build_terminal_status_payload(TerminalRuntimeState::Unsupported, 0);
        assert_eq!(
            unsupported["state"],
            Value::String("unsupported".to_string())
        );
        assert!(unsupported.get("available").is_none());
    }
}
