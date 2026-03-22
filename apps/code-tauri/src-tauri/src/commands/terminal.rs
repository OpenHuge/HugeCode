use crate::backend::{runtime_backend, NativeStateFabricChange, TerminalChunkRead};
use crate::commands::policy::require_terminal_commands_enabled;
use crate::models::{TerminalSessionState, TerminalSessionSummary, TerminalStatus};
use serde::Serialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::{mpsc, Mutex, OnceLock};
use std::thread::{self, JoinHandle};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

pub const TERMINAL_OUTPUT_EVENT: &str = "fastcode://runtime/event";
const TERMINAL_STREAM_POLL_INTERVAL: Duration = Duration::from_millis(120);

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
enum TerminalStreamRelayMode {
    Push,
    PollFallback,
}

enum TerminalStreamWorkerControl {
    Push { subscription_id: u64 },
    PollFallback { stop_tx: mpsc::Sender<()> },
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalStreamDiagnosticsStatus {
    mode: TerminalStreamRelayMode,
    active_stream_count: usize,
    push_stream_count: usize,
    poll_fallback_stream_count: usize,
    poll_interval_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    fallback_reason: Option<String>,
}

impl TerminalStreamDiagnosticsStatus {
    fn push(active_stream_count: usize) -> Self {
        Self {
            mode: TerminalStreamRelayMode::Push,
            active_stream_count,
            push_stream_count: active_stream_count,
            poll_fallback_stream_count: 0,
            poll_interval_ms: TERMINAL_STREAM_POLL_INTERVAL.as_millis() as u64,
            fallback_reason: None,
        }
    }

    fn poll_fallback(active_stream_count: usize, fallback_reason: impl Into<String>) -> Self {
        Self {
            mode: TerminalStreamRelayMode::PollFallback,
            active_stream_count,
            push_stream_count: 0,
            poll_fallback_stream_count: active_stream_count,
            poll_interval_ms: TERMINAL_STREAM_POLL_INTERVAL.as_millis() as u64,
            fallback_reason: Some(fallback_reason.into()),
        }
    }
}

struct TerminalStreamWorker {
    control: TerminalStreamWorkerControl,
    mode: TerminalStreamRelayMode,
    join_handle: JoinHandle<()>,
}

fn terminal_stream_status_cell() -> &'static Mutex<TerminalStreamDiagnosticsStatus> {
    static STATUS: OnceLock<Mutex<TerminalStreamDiagnosticsStatus>> = OnceLock::new();
    STATUS.get_or_init(|| Mutex::new(TerminalStreamDiagnosticsStatus::push(0)))
}

fn terminal_stream_registry() -> &'static Mutex<HashMap<String, TerminalStreamWorker>> {
    static REGISTRY: OnceLock<Mutex<HashMap<String, TerminalStreamWorker>>> = OnceLock::new();
    REGISTRY.get_or_init(|| Mutex::new(HashMap::new()))
}

fn publish_terminal_stream_status(status: TerminalStreamDiagnosticsStatus) {
    let mut stored = terminal_stream_status_cell()
        .lock()
        .expect("terminal stream status lock poisoned while publishing");
    *stored = status;
}

fn snapshot_terminal_stream_status() -> TerminalStreamDiagnosticsStatus {
    terminal_stream_status_cell()
        .lock()
        .expect("terminal stream status lock poisoned while snapshotting")
        .clone()
}

fn cleanup_finished_terminal_stream_workers() {
    let finished_workers = {
        let mut registry = terminal_stream_registry()
            .lock()
            .expect("terminal stream registry lock poisoned while cleaning finished workers");
        let finished_ids = registry
            .iter()
            .filter_map(|(session_id, worker)| {
                if worker.join_handle.is_finished() {
                    Some(session_id.clone())
                } else {
                    None
                }
            })
            .collect::<Vec<_>>();
        finished_ids
            .iter()
            .filter_map(|session_id| {
                registry
                    .remove(session_id)
                    .map(|worker| (session_id.clone(), worker))
            })
            .collect::<Vec<_>>()
    };

    for (session_id, worker) in finished_workers {
        if let TerminalStreamWorkerControl::Push { subscription_id } = worker.control {
            let _ = runtime_backend()
                .terminal_unsubscribe_raw_output(session_id.as_str(), subscription_id);
        }
        let _ = worker.join_handle.join();
    }

    publish_terminal_stream_status(build_terminal_stream_status());
}

fn stop_terminal_stream_worker(session_id: &str) -> bool {
    let worker = {
        let mut registry = terminal_stream_registry()
            .lock()
            .expect("terminal stream registry lock poisoned while stopping worker");
        registry.remove(session_id)
    };

    let Some(worker) = worker else {
        return false;
    };

    match worker.control {
        TerminalStreamWorkerControl::Push { subscription_id } => {
            let _ = runtime_backend().terminal_unsubscribe_raw_output(session_id, subscription_id);
        }
        TerminalStreamWorkerControl::PollFallback { stop_tx } => {
            let _ = stop_tx.send(());
        }
    }
    let _ = worker.join_handle.join();
    publish_terminal_stream_status(build_terminal_stream_status());
    true
}

fn emit_terminal_chunks(app: &AppHandle, output: TerminalChunkRead) {
    for chunk in output.chunks {
        let revision = runtime_backend().append_state_fabric_change(
            NativeStateFabricChange::TerminalOutputAppended {
                workspace_id: output.workspace_id.clone(),
                session_id: output.session_id.clone(),
                chunk: chunk.clone(),
            },
        );
        let payload = json!({
            "workspace_id": output.workspace_id,
            "message": {
                "method": "native_state_fabric_updated",
                "params": {
                    "revision": revision,
                    "scopeKind": "terminal",
                    "workspaceId": output.workspace_id,
                    "sessionId": output.session_id,
                    "changeKind": "terminalOutputAppended",
                    "state": output.state,
                    "cursor": output.cursor,
                    "chunk": chunk,
                    "updatedAt": output.updated_at,
                },
            },
        });
        let _ = app.emit(TERMINAL_OUTPUT_EVENT, payload);
    }
}

fn terminal_stream_worker_loop(
    app: AppHandle,
    session_id: String,
    stop_rx: mpsc::Receiver<()>,
    initial_output: TerminalChunkRead,
) {
    emit_terminal_chunks(&app, initial_output);

    loop {
        match stop_rx.recv_timeout(TERMINAL_STREAM_POLL_INTERVAL) {
            Ok(_) | Err(mpsc::RecvTimeoutError::Disconnected) => break,
            Err(mpsc::RecvTimeoutError::Timeout) => {}
        }

        let Some(output) = runtime_backend().terminal_read_chunks(&session_id) else {
            break;
        };
        let active = matches!(output.state, TerminalSessionState::Created);
        emit_terminal_chunks(&app, output);

        if !active {
            break;
        }
    }
}

fn terminal_stream_push_worker_loop(
    app: AppHandle,
    session_id: String,
    subscription_id: u64,
    subscription: ku0_runtime_shell_core::TerminalRawOutputSubscription,
    initial_output: TerminalChunkRead,
) {
    emit_terminal_chunks(&app, initial_output);

    while subscription.recv().is_ok() {
        let Some(output) = runtime_backend().terminal_read_chunks(&session_id) else {
            break;
        };
        let active = matches!(output.state, TerminalSessionState::Created);
        emit_terminal_chunks(&app, output);
        if !active {
            break;
        }
    }

    let _ = runtime_backend().terminal_unsubscribe_raw_output(&session_id, subscription_id);
}

fn build_terminal_stream_status() -> TerminalStreamDiagnosticsStatus {
    let registry = terminal_stream_registry()
        .lock()
        .expect("terminal stream registry lock poisoned while building status");
    let active_stream_count = registry.len();
    let poll_fallback_stream_count = registry
        .values()
        .filter(|worker| matches!(worker.mode, TerminalStreamRelayMode::PollFallback))
        .count();
    let push_stream_count = active_stream_count.saturating_sub(poll_fallback_stream_count);

    if poll_fallback_stream_count > 0 {
        let mut status = TerminalStreamDiagnosticsStatus::poll_fallback(
            active_stream_count,
            "raw-output-subscription-unavailable",
        );
        status.push_stream_count = push_stream_count;
        status.poll_fallback_stream_count = poll_fallback_stream_count;
        status
    } else {
        let mut status = TerminalStreamDiagnosticsStatus::push(active_stream_count);
        status.push_stream_count = push_stream_count;
        status.poll_fallback_stream_count = poll_fallback_stream_count;
        status
    }
}

pub fn terminal_stream_diagnostics_payload() -> Value {
    cleanup_finished_terminal_stream_workers();
    serde_json::to_value(snapshot_terminal_stream_status()).unwrap_or_else(|_| {
        json!({
            "mode": "poll-fallback",
            "activeStreamCount": 0,
            "pushStreamCount": 0,
            "pollFallbackStreamCount": 0,
            "pollIntervalMs": TERMINAL_STREAM_POLL_INTERVAL.as_millis() as u64,
            "fallbackReason": "serialize terminal stream diagnostics failed",
        })
    })
}

fn require_registered_workspace_id_from_ids<'a>(
    workspace_id: &str,
    available_workspace_ids: impl IntoIterator<Item = &'a str>,
) -> Result<String, String> {
    let workspace_id = workspace_id.trim();
    if workspace_id.is_empty() {
        return Err("workspaceId is required".to_string());
    }
    if available_workspace_ids
        .into_iter()
        .any(|id| id == workspace_id)
    {
        return Ok(workspace_id.to_string());
    }
    Err(format!(
        "workspaceId must reference a registered workspace: {workspace_id}"
    ))
}

fn require_registered_workspace_id(workspace_id: &str) -> Result<String, String> {
    let workspaces = runtime_backend().workspaces();
    require_registered_workspace_id_from_ids(
        workspace_id,
        workspaces.iter().map(|workspace| workspace.id.as_str()),
    )
}

#[tauri::command]
pub fn code_terminal_status() -> TerminalStatus {
    runtime_backend().terminal_status()
}

#[tauri::command]
pub fn code_terminal_open(workspace_id: String) -> Result<TerminalSessionSummary, String> {
    require_terminal_commands_enabled("code_terminal_open")?;
    let workspace_id = require_registered_workspace_id(&workspace_id)?;
    Ok(runtime_backend().terminal_open(&workspace_id))
}

#[tauri::command]
pub fn code_terminal_write(
    session_id: String,
    input: String,
) -> Result<Option<TerminalSessionSummary>, String> {
    require_terminal_commands_enabled("code_terminal_write")?;
    Ok(runtime_backend().terminal_write(&session_id, &input))
}

#[tauri::command]
pub fn code_terminal_input_raw(session_id: String, input: String) -> Result<bool, String> {
    require_terminal_commands_enabled("code_terminal_input_raw")?;
    let session_id = session_id.trim().to_string();
    if session_id.is_empty() {
        return Ok(false);
    }
    Ok(runtime_backend().terminal_input_raw(&session_id, &input))
}

#[tauri::command]
pub fn code_terminal_read(session_id: String) -> Result<Option<TerminalSessionSummary>, String> {
    require_terminal_commands_enabled("code_terminal_read")?;
    Ok(runtime_backend().terminal_read(&session_id))
}

#[tauri::command]
pub fn code_terminal_interrupt(session_id: String) -> Result<bool, String> {
    require_terminal_commands_enabled("code_terminal_interrupt")?;
    let session_id = session_id.trim().to_string();
    if session_id.is_empty() {
        return Ok(false);
    }
    Ok(runtime_backend().terminal_interrupt(&session_id))
}

#[tauri::command]
pub fn code_terminal_resize(session_id: String, rows: u16, cols: u16) -> Result<bool, String> {
    require_terminal_commands_enabled("code_terminal_resize")?;
    let session_id = session_id.trim().to_string();
    if session_id.is_empty() {
        return Ok(false);
    }
    Ok(runtime_backend().terminal_resize(&session_id, rows, cols))
}

#[tauri::command]
pub fn code_terminal_stream_start(
    app: tauri::AppHandle,
    session_id: String,
) -> Result<bool, String> {
    require_terminal_commands_enabled("code_terminal_stream_start")?;
    let session_id = session_id.trim().to_string();
    if session_id.is_empty() {
        return Ok(false);
    }

    cleanup_finished_terminal_stream_workers();

    let Some(initial_output) = runtime_backend().terminal_read_chunks(&session_id) else {
        return Ok(false);
    };
    if !matches!(initial_output.state, TerminalSessionState::Created) {
        return Ok(false);
    }

    stop_terminal_stream_worker(&session_id);

    let worker_session_id = session_id.clone();
    let worker_app = app.clone();
    let worker = if let Some(subscription) =
        runtime_backend().terminal_subscribe_raw_output(&session_id)
    {
        let subscription_id = subscription.subscription_id();
        TerminalStreamWorker {
            control: TerminalStreamWorkerControl::Push { subscription_id },
            mode: TerminalStreamRelayMode::Push,
            join_handle: thread::spawn(move || {
                terminal_stream_push_worker_loop(
                    worker_app,
                    worker_session_id,
                    subscription_id,
                    subscription,
                    initial_output,
                );
            }),
        }
    } else {
        let (stop_tx, stop_rx) = mpsc::channel();
        TerminalStreamWorker {
            control: TerminalStreamWorkerControl::PollFallback { stop_tx },
            mode: TerminalStreamRelayMode::PollFallback,
            join_handle: thread::spawn(move || {
                terminal_stream_worker_loop(worker_app, worker_session_id, stop_rx, initial_output);
            }),
        }
    };

    let mut registry = terminal_stream_registry()
        .lock()
        .expect("terminal stream registry lock poisoned while starting worker");
    registry.insert(session_id, worker);
    drop(registry);
    publish_terminal_stream_status(build_terminal_stream_status());
    Ok(true)
}

#[tauri::command]
pub fn code_terminal_stream_stop(session_id: String) -> Result<bool, String> {
    require_terminal_commands_enabled("code_terminal_stream_stop")?;
    let session_id = session_id.trim();
    if session_id.is_empty() {
        return Ok(false);
    }
    Ok(stop_terminal_stream_worker(session_id))
}

#[tauri::command]
pub fn code_terminal_close(session_id: String) -> Result<bool, String> {
    require_terminal_commands_enabled("code_terminal_close")?;
    let session_id = session_id.trim().to_string();
    if session_id.is_empty() {
        return Ok(false);
    }

    stop_terminal_stream_worker(&session_id);
    Ok(runtime_backend().terminal_close(&session_id))
}

#[cfg(test)]
mod tests {
    use super::{
        code_terminal_open, require_registered_workspace_id_from_ids,
        terminal_stream_diagnostics_payload,
    };
    use crate::commands::policy::CODE_TAURI_ENABLE_TERMINAL_COMMANDS_ENV;
    use crate::models::TerminalSessionState;
    use std::sync::Mutex;

    fn terminal_command_env_lock() -> &'static Mutex<()> {
        crate::commands::policy::rpc_policy_env_lock()
    }

    #[test]
    fn terminal_output_event_payload_uses_native_state_fabric_shape() {
        let payload = serde_json::json!({
            "workspace_id": "workspace-local",
            "message": {
                "method": "native_state_fabric_updated",
                "params": {
                    "revision": 4,
                    "scopeKind": "terminal",
                    "workspaceId": "workspace-local",
                    "sessionId": "terminal-1",
                    "changeKind": "terminalOutputAppended",
                    "state": TerminalSessionState::Created,
                    "cursor": 4,
                    "chunk": "chunk-a",
                    "updatedAt": 123,
                }
            }
        });

        assert_eq!(
            payload["message"]["params"]["chunk"].as_str(),
            Some("chunk-a")
        );
        assert_eq!(
            payload["message"]["params"]["sessionId"].as_str(),
            Some("terminal-1")
        );
        assert_eq!(
            payload["message"]["params"]["state"].as_str(),
            Some("created")
        );
        assert_eq!(payload["message"]["params"]["cursor"].as_u64(), Some(4));
        assert_eq!(
            payload["message"]["params"]["changeKind"].as_str(),
            Some("terminalOutputAppended")
        );
    }

    #[test]
    fn terminal_open_rejects_when_terminal_commands_are_disabled() {
        let _guard = terminal_command_env_lock()
            .lock()
            .expect("terminal command env lock poisoned");
        std::env::remove_var(CODE_TAURI_ENABLE_TERMINAL_COMMANDS_ENV);

        let error = code_terminal_open("workspace-local".to_string())
            .expect_err("terminal open should be disabled by default");
        assert_eq!(error, "Unsupported RPC method: code_terminal_open");
    }

    #[test]
    fn terminal_workspace_validation_rejects_unknown_workspace_ids_when_enabled() {
        let _guard = terminal_command_env_lock()
            .lock()
            .expect("terminal command env lock poisoned");
        std::env::set_var(CODE_TAURI_ENABLE_TERMINAL_COMMANDS_ENV, "1");

        let error = require_registered_workspace_id_from_ids(
            "workspace-terminal-guard-missing",
            ["workspace-local"],
        )
        .expect_err("terminal workspace validation should reject unknown workspace ids");
        assert!(
            error.contains("workspaceId must reference a registered workspace"),
            "unexpected error: {error}"
        );
    }

    #[test]
    fn terminal_stream_diagnostics_default_to_push_mode() {
        let payload = terminal_stream_diagnostics_payload();
        assert_eq!(payload["mode"].as_str(), Some("push"));
        assert_eq!(payload["activeStreamCount"].as_u64(), Some(0));
        assert_eq!(payload["pollFallbackStreamCount"].as_u64(), Some(0));
    }
}
