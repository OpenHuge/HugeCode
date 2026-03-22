use super::*;
use serde::Deserialize;
use tokio::io::AsyncWriteExt;
use tokio::sync::{broadcast, mpsc, oneshot};

#[path = "acp_runtime_helpers.rs"]
mod helpers;
#[path = "acp_runtime_transport.rs"]
mod transport;

use helpers::{
    acp_method_not_found, extract_available_commands, extract_config_options,
    extract_prompt_result_text, extract_prompt_stop_reason, extract_session_id,
    extract_session_update_delta_text,
};
use transport::{
    open_acp_stdio_transport, read_jsonrpc_id_u64, read_jsonrpc_method, write_jsonrpc_notification,
    write_jsonrpc_request,
};

pub(crate) use transport::probe_acp_stdio_initialize;

const ACP_NOTIFICATION_SESSION_UPDATE: &str = "session/update";
const ACP_NOTIFICATION_AVAILABLE_COMMANDS_UPDATE: &str = "available_commands_update";
const ACP_REQUEST_METHODS_NEW_SESSION: &[&str] = &["session/new", "newSession"];
const ACP_REQUEST_METHODS_LOAD_SESSION: &[&str] = &["session/load", "loadSession"];
const ACP_REQUEST_METHODS_PROMPT: &[&str] = &["prompt", "session/prompt"];

#[derive(Clone, Debug, Deserialize)]
struct AcpJsonRpcError {
    message: String,
}

#[derive(Clone, Debug, Deserialize)]
struct AcpJsonRpcResponse {
    id: Value,
    #[serde(default)]
    result: Option<Value>,
    #[serde(default)]
    error: Option<AcpJsonRpcError>,
}

#[derive(Clone, Debug)]
pub(crate) struct AcpSessionDiagnostics {
    pub(crate) integration_id: String,
    pub(crate) backend_id: String,
    pub(crate) session_id: String,
    pub(crate) config_options: Option<Value>,
    pub(crate) available_commands: Option<Value>,
}

#[derive(Clone, Debug)]
pub(crate) enum AcpSessionEvent {
    SessionUpdate(Value),
    AvailableCommandsUpdate(Value),
}

#[derive(Clone, Debug)]
pub(crate) struct AcpPromptOutcome {
    pub(crate) text: Option<String>,
    pub(crate) stop_reason: Option<String>,
}

#[derive(Clone, Debug)]
struct AcpSessionRuntime {
    integration_id: String,
    backend_id: String,
    session_id: String,
    workspace_id: String,
    config_options: Option<Value>,
    available_commands: Option<Value>,
    event_tx: broadcast::Sender<AcpSessionEvent>,
    terminal_session_ids: HashMap<String, String>,
}

#[derive(Clone)]
struct AcpClientHandle {
    integration_id: String,
    command_tx: mpsc::Sender<AcpClientCommand>,
}

enum AcpClientCommand {
    Request {
        method: String,
        params: Value,
        response_tx: oneshot::Sender<Result<Value, String>>,
    },
    Notification {
        method: String,
        params: Value,
        response_tx: oneshot::Sender<Result<(), String>>,
    },
}

#[derive(Default)]
pub(crate) struct AcpRuntimeStore {
    clients: HashMap<String, Arc<AcpClientHandle>>,
    sessions_by_key: HashMap<String, AcpSessionRuntime>,
    session_key_by_id: HashMap<String, String>,
    turn_sessions: HashMap<String, String>,
    task_sessions: HashMap<String, String>,
}

impl AcpRuntimeStore {
    fn detach_turn_binding(&mut self, turn_id: &str) {
        self.turn_sessions.remove(turn_id);
    }

    fn detach_task_binding(&mut self, task_id: &str) -> Vec<String> {
        let Some(session_id) = self.task_sessions.remove(task_id) else {
            return Vec::new();
        };
        let Some(session_key) = self.session_key_by_id.get(session_id.as_str()).cloned() else {
            return Vec::new();
        };
        if !session_key.starts_with("task:") {
            return Vec::new();
        }
        if self
            .turn_sessions
            .values()
            .chain(self.task_sessions.values())
            .any(|candidate| candidate == &session_id)
        {
            return Vec::new();
        }
        let Some(session) = self.sessions_by_key.remove(session_key.as_str()) else {
            return Vec::new();
        };
        self.session_key_by_id.remove(session_id.as_str());
        session.terminal_session_ids.into_values().collect()
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct AcpInitializeProbeMetadata {
    pub(crate) protocol_version: Option<String>,
    pub(crate) server_name: Option<String>,
    pub(crate) server_version: Option<String>,
    pub(crate) capabilities: Option<Value>,
    pub(crate) config_options: Option<Value>,
}

#[derive(Clone, Debug)]
pub(crate) struct AcpAgentTaskPromptInput {
    pub(crate) title: Option<String>,
    pub(crate) access_mode: String,
    pub(crate) agent_profile: String,
    pub(crate) mission_brief: Option<Value>,
    pub(crate) relaunch_context: Option<Value>,
    pub(crate) auto_drive: Option<Value>,
    pub(crate) steps: Vec<Value>,
}

pub(crate) fn build_acp_thread_session_key(
    workspace_id: &str,
    thread_id: &str,
    backend_id: &str,
) -> String {
    format!(
        "thread:{}:{}:{}",
        workspace_id.trim(),
        thread_id.trim(),
        backend_id.trim()
    )
}

pub(crate) fn build_acp_hidden_task_session_key(
    workspace_id: &str,
    task_id: &str,
    backend_id: &str,
) -> String {
    format!(
        "task:{}:{}:{}",
        workspace_id.trim(),
        task_id.trim(),
        backend_id.trim()
    )
}

pub(crate) fn build_agent_task_acp_prompt(input: &AcpAgentTaskPromptInput) -> String {
    let mut sections = Vec::new();
    if let Some(title) = input
        .title
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        sections.push(format!("Title: {title}"));
    }
    sections.push(format!("Access mode: {}", input.access_mode.trim()));
    sections.push(format!("Agent profile: {}", input.agent_profile.trim()));
    if let Some(mission_brief) = input.mission_brief.as_ref() {
        sections.push(format!(
            "Mission brief:\n{}",
            serde_json::to_string_pretty(mission_brief)
                .unwrap_or_else(|_| mission_brief.to_string())
        ));
    }
    if let Some(relaunch_context) = input.relaunch_context.as_ref() {
        sections.push(format!(
            "Relaunch context:\n{}",
            serde_json::to_string_pretty(relaunch_context)
                .unwrap_or_else(|_| relaunch_context.to_string())
        ));
    }
    if let Some(auto_drive) = input.auto_drive.as_ref() {
        sections.push(format!(
            "Auto-drive:\n{}",
            serde_json::to_string_pretty(auto_drive).unwrap_or_else(|_| auto_drive.to_string())
        ));
    }
    sections.push(format!(
        "Submitted steps:\n{}",
        serde_json::to_string_pretty(&input.steps)
            .unwrap_or_else(|_| json!(input.steps).to_string())
    ));
    sections.join("\n\n")
}

pub(crate) fn build_acp_prompt_params(session_id: &str, prompt: &str) -> Value {
    json!({
        "sessionId": session_id,
        "prompt": [
            {
                "type": "text",
                "text": prompt,
            }
        ],
    })
}

impl AcpClientHandle {
    async fn request(&self, method: &str, params: Value) -> Result<Value, String> {
        let (response_tx, response_rx) = oneshot::channel();
        self.command_tx
            .send(AcpClientCommand::Request {
                method: method.to_string(),
                params,
                response_tx,
            })
            .await
            .map_err(|_| format!("ACP client `{}` is unavailable.", self.integration_id))?;
        response_rx
            .await
            .map_err(|_| format!("ACP client `{}` dropped request.", self.integration_id))?
    }

    async fn notify(&self, method: &str, params: Value) -> Result<(), String> {
        let (response_tx, response_rx) = oneshot::channel();
        self.command_tx
            .send(AcpClientCommand::Notification {
                method: method.to_string(),
                params,
                response_tx,
            })
            .await
            .map_err(|_| format!("ACP client `{}` is unavailable.", self.integration_id))?;
        response_rx
            .await
            .map_err(|_| format!("ACP client `{}` dropped notification.", self.integration_id))?
    }

    async fn request_with_fallback(
        &self,
        methods: &[&str],
        params: Value,
    ) -> Result<Value, String> {
        let mut last_error = None;
        for method in methods {
            match self.request(method, params.clone()).await {
                Ok(value) => return Ok(value),
                Err(error) if acp_method_not_found(error.as_str()) => {
                    last_error = Some(error);
                }
                Err(error) => return Err(error),
            }
        }
        Err(last_error.unwrap_or_else(|| "ACP request methods unavailable.".to_string()))
    }

    async fn new_session(&self, params: Value) -> Result<Value, String> {
        self.request_with_fallback(ACP_REQUEST_METHODS_NEW_SESSION, params)
            .await
    }

    async fn load_session(&self, params: Value) -> Result<Value, String> {
        self.request_with_fallback(ACP_REQUEST_METHODS_LOAD_SESSION, params)
            .await
    }

    async fn load_session_if_supported(&self, session_id: &str) -> Result<Option<Value>, String> {
        match self.load_session(json!({ "sessionId": session_id })).await {
            Ok(value) => Ok(Some(value)),
            Err(error) if acp_method_not_found(error.as_str()) => Ok(None),
            Err(error) => Err(error),
        }
    }

    async fn prompt(&self, params: Value) -> Result<Value, String> {
        self.request_with_fallback(ACP_REQUEST_METHODS_PROMPT, params)
            .await
    }

    async fn cancel(&self, params: Value) -> Result<(), String> {
        self.notify("session/cancel", params).await
    }
}

async fn respond_to_acp_server_request(
    ctx: &AppContext,
    method: &str,
    params: &Value,
) -> Result<Value, String> {
    let session_id = params
        .get("sessionId")
        .or_else(|| params.get("session_id"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| format!("ACP server request `{method}` is missing sessionId."))?
        .to_string();
    let requested_terminal_id = params
        .get("terminalId")
        .or_else(|| params.get("terminal_id"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);
    let runtime_terminal_id = {
        let store = ctx.acp_runtime.lock().await;
        let Some(session_key) = store.session_key_by_id.get(session_id.as_str()) else {
            return Err(format!(
                "ACP session `{session_id}` is not registered for `{method}`."
            ));
        };
        let Some(session) = store.sessions_by_key.get(session_key.as_str()) else {
            return Err(format!(
                "ACP session runtime `{session_id}` is missing for `{method}`."
            ));
        };
        requested_terminal_id
            .as_ref()
            .and_then(|terminal_id| {
                session
                    .terminal_session_ids
                    .get(terminal_id.as_str())
                    .cloned()
            })
            .or_else(|| session.terminal_session_ids.values().next().cloned())
    };
    match method {
        "terminal/create" => {
            let workspace_id = {
                let store = ctx.acp_runtime.lock().await;
                let Some(session_key) = store.session_key_by_id.get(session_id.as_str()) else {
                    return Err(format!("ACP session `{session_id}` is not registered."));
                };
                let Some(session) = store.sessions_by_key.get(session_key.as_str()) else {
                    return Err(format!("ACP session `{session_id}` runtime is missing."));
                };
                session.workspace_id.clone()
            };
            let requested_cwd = params
                .get("cwd")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(std::path::PathBuf::from);
            let requested_command = params
                .get("command")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(ToOwned::to_owned);
            let requested_args = params
                .get("args")
                .and_then(Value::as_array)
                .map(|entries| {
                    entries
                        .iter()
                        .filter_map(Value::as_str)
                        .map(str::trim)
                        .filter(|value| !value.is_empty())
                        .map(ToOwned::to_owned)
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            let requested_env = params
                .get("env")
                .map(|value| match value {
                    Value::Array(entries) => entries
                        .iter()
                        .filter_map(|entry| {
                            let object = entry.as_object()?;
                            let key = object.get("name")?.as_str()?.trim();
                            let value = object.get("value")?.as_str()?.trim();
                            if key.is_empty() || value.is_empty() {
                                return None;
                            }
                            Some((key.to_string(), value.to_string()))
                        })
                        .collect::<Vec<_>>(),
                    Value::Object(entries) => entries
                        .iter()
                        .filter_map(|(key, value)| {
                            let key = key.trim();
                            let value = value.as_str()?.trim();
                            if key.is_empty() || value.is_empty() {
                                return None;
                            }
                            Some((key.to_string(), value.to_string()))
                        })
                        .collect::<Vec<_>>(),
                    _ => Vec::new(),
                })
                .unwrap_or_default();
            let summary = crate::terminal_runtime::handle_terminal_open_with_options(
                ctx,
                workspace_id.as_str(),
                crate::terminal_runtime::TerminalOpenOptions {
                    cwd: requested_cwd,
                    env: requested_env,
                    command: requested_command,
                    args: requested_args,
                },
            )
            .await
            .map_err(|error| error.message)?;
            let terminal_id = summary
                .get("id")
                .and_then(Value::as_str)
                .ok_or_else(|| "runtime terminal open result is missing id".to_string())?
                .to_string();
            {
                let mut store = ctx.acp_runtime.lock().await;
                if let Some(session_key) = store.session_key_by_id.get(session_id.as_str()).cloned()
                {
                    if let Some(session) = store.sessions_by_key.get_mut(session_key.as_str()) {
                        session
                            .terminal_session_ids
                            .insert(terminal_id.clone(), terminal_id.clone());
                    }
                }
            }
            Ok(json!({
                "terminalId": terminal_id,
                "summary": summary,
            }))
        }
        "terminal/output" => {
            let Some(runtime_terminal_id) = runtime_terminal_id else {
                return Ok(json!({
                    "terminalId": Value::Null,
                    "output": "",
                    "truncated": false,
                    "exitStatus": Value::Null,
                }));
            };
            let output_payload = crate::terminal_runtime::handle_terminal_read_output(
                ctx,
                runtime_terminal_id.as_str(),
            )
            .await
            .map_err(|error| error.message)?;
            let summary = output_payload
                .get("summary")
                .cloned()
                .unwrap_or(Value::Null);
            let output = output_payload
                .get("output")
                .and_then(Value::as_str)
                .unwrap_or_default();
            let output_byte_limit = params
                .get("outputByteLimit")
                .or_else(|| params.get("output_byte_limit"))
                .and_then(Value::as_u64)
                .and_then(|value| usize::try_from(value).ok());
            let (output, truncated) = truncate_terminal_output(output, output_byte_limit);
            Ok(json!({
                "terminalId": runtime_terminal_id,
                "output": output,
                "truncated": truncated,
                "exitStatus": summary.get("exitStatus").cloned().unwrap_or(Value::Null),
                "summary": summary,
            }))
        }
        "terminal/wait_for_exit" => {
            let Some(runtime_terminal_id) = runtime_terminal_id else {
                return Ok(json!({
                    "terminalId": Value::Null,
                    "exitCode": Value::Null,
                    "signal": Value::Null,
                }));
            };
            let summary = crate::terminal_runtime::handle_terminal_wait_for_exit(
                ctx,
                runtime_terminal_id.as_str(),
            )
            .await
            .map_err(|error| error.message)?;
            Ok(json!({
                "terminalId": runtime_terminal_id,
                "exitCode": summary.get("exitStatus").and_then(|value| value.get("exitCode")).cloned().unwrap_or(Value::Null),
                "signal": summary.get("exitStatus").and_then(|value| value.get("signal")).cloned().unwrap_or(Value::Null),
                "summary": summary,
            }))
        }
        "terminal/kill" => {
            let Some(runtime_terminal_id) = runtime_terminal_id else {
                return Ok(json!({"killed": false, "terminalId": Value::Null}));
            };
            let summary =
                crate::terminal_runtime::handle_terminal_kill(ctx, runtime_terminal_id.as_str())
                    .await
                    .map_err(|error| error.message)?;
            Ok(json!({
                "killed": true,
                "terminalId": runtime_terminal_id,
                "exitStatus": summary.get("exitStatus").cloned().unwrap_or(Value::Null),
                "summary": summary,
            }))
        }
        "terminal/release" => {
            let Some(runtime_terminal_id) = runtime_terminal_id else {
                return Ok(json!({"released": true}));
            };
            let _ =
                crate::terminal_runtime::handle_terminal_close(ctx, runtime_terminal_id.as_str())
                    .await
                    .map_err(|error| error.message)?;
            {
                let mut store = ctx.acp_runtime.lock().await;
                if let Some(session_key) = store.session_key_by_id.get(session_id.as_str()).cloned()
                {
                    if let Some(session) = store.sessions_by_key.get_mut(session_key.as_str()) {
                        session
                            .terminal_session_ids
                            .remove(runtime_terminal_id.as_str());
                    }
                }
            }
            Ok(json!({"released": true, "terminalId": runtime_terminal_id}))
        }
        _ => Err(format!("Unsupported ACP server request `{method}`.")),
    }
}

async fn handle_acp_notification(ctx: &AppContext, method: &str, params: Value) {
    let Some(session_id) = extract_session_id(&params) else {
        return;
    };
    let mut event = None;
    {
        let mut store = ctx.acp_runtime.lock().await;
        let Some(session_key) = store.session_key_by_id.get(session_id.as_str()).cloned() else {
            return;
        };
        let Some(session) = store.sessions_by_key.get_mut(session_key.as_str()) else {
            return;
        };
        match method {
            ACP_NOTIFICATION_SESSION_UPDATE => {
                if let Some(config_options) = extract_config_options(&params) {
                    session.config_options = Some(config_options);
                }
                if let Some(available_commands) = extract_available_commands(&params) {
                    session.available_commands = Some(available_commands);
                }
                event = Some((
                    session.event_tx.clone(),
                    AcpSessionEvent::SessionUpdate(params),
                ));
            }
            ACP_NOTIFICATION_AVAILABLE_COMMANDS_UPDATE => {
                if let Some(available_commands) = extract_available_commands(&params) {
                    session.available_commands = Some(available_commands);
                }
                event = Some((
                    session.event_tx.clone(),
                    AcpSessionEvent::AvailableCommandsUpdate(params),
                ));
            }
            _ => {}
        }
    }
    if let Some((sender, event)) = event {
        let _ = sender.send(event);
    }
}

async fn spawn_acp_client(
    ctx: AppContext,
    integration: &crate::acp_client_adapter::AcpIntegrationSummary,
) -> Result<(Arc<AcpClientHandle>, AcpInitializeProbeMetadata), String> {
    let crate::acp_client_adapter::AcpIntegrationTransportConfig::Stdio {
        command,
        args,
        cwd,
        env,
    } = &integration.transport_config
    else {
        return Err("ACP execution supports stdio integrations only.".to_string());
    };
    let (mut child, mut stdin, mut stdout, stderr_task, metadata) =
        open_acp_stdio_transport(command.as_str(), args.as_slice(), cwd.as_deref(), env).await?;
    let (command_tx, mut command_rx) = mpsc::channel::<AcpClientCommand>(32);
    let integration_id = integration.integration_id.clone();
    let integration_id_for_task = integration_id.clone();
    let ctx_for_task = ctx.clone();
    tokio::spawn(async move {
        let mut next_request_id = 2_u64;
        let mut pending = HashMap::<u64, oneshot::Sender<Result<Value, String>>>::new();
        loop {
            tokio::select! {
                maybe_command = command_rx.recv() => {
                    match maybe_command {
                        Some(AcpClientCommand::Request { method, params, response_tx }) => {
                            let request_id = next_request_id;
                            next_request_id = next_request_id.saturating_add(1);
                            if let Err(error) = write_jsonrpc_request(&mut stdin, request_id, method.as_str(), params).await {
                                let _ = response_tx.send(Err(error));
                                continue;
                            }
                            pending.insert(request_id, response_tx);
                        }
                        Some(AcpClientCommand::Notification { method, params, response_tx }) => {
                            let result = write_jsonrpc_notification(&mut stdin, method.as_str(), params).await;
                            let _ = response_tx.send(result);
                        }
                        None => break,
                    }
                }
                maybe_line = stdout.next_line() => {
                    let Ok(maybe_line) = maybe_line else {
                        break;
                    };
                    let Some(line) = maybe_line else {
                        break;
                    };
                    if line.trim().is_empty() {
                        continue;
                    }
                    let Ok(value) = serde_json::from_str::<Value>(line.as_str()) else {
                        continue;
                    };
                    if let Some(method) = read_jsonrpc_method(&value) {
                        if let Some(request_id) = read_jsonrpc_id_u64(&value) {
                            let params = value.get("params").cloned().unwrap_or(Value::Null);
                            let response = respond_to_acp_server_request(&ctx_for_task, method, &params).await;
                            let response_value = match response {
                                Ok(result) => json!({"jsonrpc":"2.0","id":request_id,"result":result}),
                                Err(error) => json!({"jsonrpc":"2.0","id":request_id,"error":{"message":error}}),
                            };
                            let _ = stdin.write_all(response_value.to_string().as_bytes()).await;
                            let _ = stdin.write_all(b"\n").await;
                            let _ = stdin.flush().await;
                            continue;
                        }
                        let params = value.get("params").cloned().unwrap_or(Value::Null);
                        handle_acp_notification(&ctx_for_task, method, params).await;
                        continue;
                    }
                    if let Some(response_id) = read_jsonrpc_id_u64(&value) {
                        if let Some(waiter) = pending.remove(&response_id) {
                            let response: Result<AcpJsonRpcResponse, _> = serde_json::from_value(value);
                            match response {
                                Ok(response) => {
                                    if let Some(error) = response.error {
                                        let _ = waiter.send(Err(error.message));
                                    } else {
                                        let _ = waiter.send(Ok(response.result.unwrap_or(Value::Null)));
                                    }
                                }
                                Err(error) => {
                                    let _ = waiter.send(Err(format!("parse ACP response failed: {error}")));
                                }
                            }
                        }
                    }
                }
            }
        }
        for (_, waiter) in pending.drain() {
            let _ = waiter.send(Err(format!(
                "ACP client `{integration_id_for_task}` stopped before responding."
            )));
        }
        let _ = stdin.shutdown().await;
        drop(stdin);
        let _ = child.wait().await;
        let _ = stderr_task.await;
        let mut runtime = ctx_for_task.acp_runtime.lock().await;
        runtime.clients.remove(integration_id_for_task.as_str());
    });

    Ok((
        Arc::new(AcpClientHandle {
            integration_id,
            command_tx,
        }),
        metadata,
    ))
}

pub(crate) fn is_execution_capable_integration(
    integration: &crate::acp_client_adapter::AcpIntegrationSummary,
) -> bool {
    integration.state == "active"
        && integration.healthy
        && matches!(
            integration.transport_config,
            crate::acp_client_adapter::AcpIntegrationTransportConfig::Stdio { .. }
        )
}

pub(crate) async fn resolve_execution_integration(
    ctx: &AppContext,
    backend_id: &str,
) -> Option<crate::acp_client_adapter::AcpIntegrationSummary> {
    let store = ctx.acp_integrations.read().await;
    store
        .find_by_backend_id(backend_id)
        .filter(is_execution_capable_integration)
}

async fn ensure_acp_client_for_integration(
    ctx: &AppContext,
    integration: &crate::acp_client_adapter::AcpIntegrationSummary,
) -> Result<Arc<AcpClientHandle>, String> {
    {
        let store = ctx.acp_runtime.lock().await;
        if let Some(handle) = store.clients.get(integration.integration_id.as_str()) {
            return Ok(handle.clone());
        }
    }
    let (handle, metadata) = spawn_acp_client(ctx.clone(), integration).await?;
    let mut store = ctx.acp_runtime.lock().await;
    if let Some(existing) = store.clients.get(integration.integration_id.as_str()) {
        return Ok(existing.clone());
    }
    store
        .clients
        .insert(integration.integration_id.clone(), handle.clone());
    ctx.acp_integrations
        .write()
        .await
        .apply_probe_metadata(integration.integration_id.as_str(), metadata);
    Ok(handle)
}

async fn refresh_existing_session_runtime(
    ctx: &AppContext,
    client: &AcpClientHandle,
    session_key: &str,
    turn_id: Option<&str>,
    task_id: Option<&str>,
) -> Result<Option<(AcpSessionDiagnostics, broadcast::Receiver<AcpSessionEvent>)>, String> {
    let session_snapshot = {
        let store = ctx.acp_runtime.lock().await;
        store.sessions_by_key.get(session_key).cloned()
    };
    let Some(session_snapshot) = session_snapshot else {
        return Ok(None);
    };

    let remote_refresh = client
        .load_session_if_supported(session_snapshot.session_id.as_str())
        .await?;
    let next_config_options = remote_refresh
        .as_ref()
        .and_then(extract_config_options)
        .or_else(|| session_snapshot.config_options.clone());
    let next_available_commands = remote_refresh
        .as_ref()
        .and_then(extract_available_commands)
        .or_else(|| session_snapshot.available_commands.clone());

    let mut store = ctx.acp_runtime.lock().await;
    let (session_id, diagnostics, receiver) = {
        let Some(session) = store.sessions_by_key.get_mut(session_key) else {
            return Ok(None);
        };
        session.config_options = next_config_options.clone();
        session.available_commands = next_available_commands.clone();
        (
            session.session_id.clone(),
            AcpSessionDiagnostics {
                integration_id: session.integration_id.clone(),
                backend_id: session.backend_id.clone(),
                session_id: session.session_id.clone(),
                config_options: session.config_options.clone(),
                available_commands: session.available_commands.clone(),
            },
            session.event_tx.subscribe(),
        )
    };
    if let Some(turn_id) = turn_id {
        store
            .turn_sessions
            .insert(turn_id.to_string(), session_id.clone());
    }
    if let Some(task_id) = task_id {
        store.task_sessions.insert(task_id.to_string(), session_id);
    }
    Ok(Some((diagnostics, receiver)))
}

pub(crate) async fn ensure_session_for_turn(
    ctx: &AppContext,
    backend_id: &str,
    workspace_id: &str,
    thread_id: &str,
    workspace_path: &str,
    access_mode: &str,
    turn_id: &str,
) -> Result<(AcpSessionDiagnostics, broadcast::Receiver<AcpSessionEvent>), String> {
    let integration = resolve_execution_integration(ctx, backend_id)
        .await
        .ok_or_else(|| format!("ACP backend `{backend_id}` is not available for execution."))?;
    let client = ensure_acp_client_for_integration(ctx, &integration).await?;
    let session_key = build_acp_thread_session_key(workspace_id, thread_id, backend_id);
    if let Some(existing) = refresh_existing_session_runtime(
        ctx,
        client.as_ref(),
        session_key.as_str(),
        Some(turn_id),
        None,
    )
    .await?
    {
        return Ok(existing);
    }
    let session_result = client
        .new_session(json!({
            "cwd": workspace_path,
            "configOptions": {
                "accessMode": access_mode,
            }
        }))
        .await?;
    let session_id = extract_session_id(&session_result)
        .ok_or_else(|| "ACP session/new response did not include sessionId.".to_string())?;
    let config_options = extract_config_options(&session_result);
    let available_commands = extract_available_commands(&session_result);
    let (event_tx, _) = broadcast::channel(64);
    let receiver = event_tx.subscribe();
    let mut store = ctx.acp_runtime.lock().await;
    store
        .session_key_by_id
        .insert(session_id.clone(), session_key.clone());
    store
        .turn_sessions
        .insert(turn_id.to_string(), session_id.clone());
    store.sessions_by_key.insert(
        session_key,
        AcpSessionRuntime {
            integration_id: integration.integration_id.clone(),
            backend_id: integration.backend_id.clone(),
            session_id: session_id.clone(),
            workspace_id: workspace_id.to_string(),
            config_options: config_options.clone(),
            available_commands: available_commands.clone(),
            event_tx,
            terminal_session_ids: HashMap::new(),
        },
    );
    Ok((
        AcpSessionDiagnostics {
            integration_id: integration.integration_id,
            backend_id: integration.backend_id,
            session_id,
            config_options,
            available_commands,
        },
        receiver,
    ))
}

pub(crate) async fn ensure_session_for_task(
    ctx: &AppContext,
    backend_id: &str,
    workspace_id: &str,
    thread_id: Option<&str>,
    task_id: &str,
    workspace_path: &str,
    access_mode: &str,
) -> Result<(AcpSessionDiagnostics, broadcast::Receiver<AcpSessionEvent>), String> {
    if let Some(thread_id) = thread_id.map(str::trim).filter(|value| !value.is_empty()) {
        let (diagnostics, receiver) = ensure_session_for_turn(
            ctx,
            backend_id,
            workspace_id,
            thread_id,
            workspace_path,
            access_mode,
            task_id,
        )
        .await?;
        let mut store = ctx.acp_runtime.lock().await;
        store.detach_turn_binding(task_id);
        store
            .task_sessions
            .insert(task_id.to_string(), diagnostics.session_id.clone());
        return Ok((diagnostics, receiver));
    }
    let integration = resolve_execution_integration(ctx, backend_id)
        .await
        .ok_or_else(|| format!("ACP backend `{backend_id}` is not available for execution."))?;
    let client = ensure_acp_client_for_integration(ctx, &integration).await?;
    let session_key = build_acp_hidden_task_session_key(workspace_id, task_id, backend_id);
    if let Some(existing) = refresh_existing_session_runtime(
        ctx,
        client.as_ref(),
        session_key.as_str(),
        None,
        Some(task_id),
    )
    .await?
    {
        return Ok(existing);
    }
    let session_result = client
        .new_session(json!({
            "cwd": workspace_path,
            "configOptions": {
                "accessMode": access_mode,
            }
        }))
        .await?;
    let session_id = extract_session_id(&session_result)
        .ok_or_else(|| "ACP session/new response did not include sessionId.".to_string())?;
    let config_options = extract_config_options(&session_result);
    let available_commands = extract_available_commands(&session_result);
    let (event_tx, _) = broadcast::channel(64);
    let receiver = event_tx.subscribe();
    let mut store = ctx.acp_runtime.lock().await;
    store
        .session_key_by_id
        .insert(session_id.clone(), session_key.clone());
    store
        .task_sessions
        .insert(task_id.to_string(), session_id.clone());
    store.sessions_by_key.insert(
        session_key,
        AcpSessionRuntime {
            integration_id: integration.integration_id.clone(),
            backend_id: integration.backend_id.clone(),
            session_id: session_id.clone(),
            workspace_id: workspace_id.to_string(),
            config_options: config_options.clone(),
            available_commands: available_commands.clone(),
            event_tx,
            terminal_session_ids: HashMap::new(),
        },
    );
    Ok((
        AcpSessionDiagnostics {
            integration_id: integration.integration_id,
            backend_id: integration.backend_id,
            session_id,
            config_options,
            available_commands,
        },
        receiver,
    ))
}

pub(crate) async fn prompt_session(
    ctx: &AppContext,
    session_id: &str,
    prompt: &str,
) -> Result<AcpPromptOutcome, String> {
    let integration_id = {
        let store = ctx.acp_runtime.lock().await;
        let Some(session_key) = store.session_key_by_id.get(session_id) else {
            return Err(format!("ACP session `{session_id}` is not registered."));
        };
        let Some(session) = store.sessions_by_key.get(session_key.as_str()) else {
            return Err(format!("ACP session `{session_id}` runtime is missing."));
        };
        session.integration_id.clone()
    };
    let client = {
        let store = ctx.acp_runtime.lock().await;
        store
            .clients
            .get(integration_id.as_str())
            .cloned()
            .ok_or_else(|| format!("ACP client `{integration_id}` is unavailable."))?
    };
    let response = client
        .prompt(build_acp_prompt_params(session_id, prompt))
        .await?;
    Ok(AcpPromptOutcome {
        text: extract_prompt_result_text(&response),
        stop_reason: extract_prompt_stop_reason(&response),
    })
}

pub(crate) async fn cancel_session_by_turn(ctx: &AppContext, turn_id: &str) -> Result<(), String> {
    let session_id = {
        let store = ctx.acp_runtime.lock().await;
        store
            .turn_sessions
            .get(turn_id)
            .cloned()
            .ok_or_else(|| format!("ACP turn `{turn_id}` is not registered."))?
    };
    cancel_session(ctx, session_id.as_str()).await
}

pub(crate) async fn cancel_session_by_task(ctx: &AppContext, task_id: &str) -> Result<(), String> {
    let session_id = {
        let store = ctx.acp_runtime.lock().await;
        store
            .task_sessions
            .get(task_id)
            .cloned()
            .ok_or_else(|| format!("ACP task `{task_id}` is not registered."))?
    };
    cancel_session(ctx, session_id.as_str()).await
}

pub(crate) async fn release_turn_session_binding(ctx: &AppContext, turn_id: &str) {
    let mut store = ctx.acp_runtime.lock().await;
    store.detach_turn_binding(turn_id);
}

pub(crate) async fn release_task_session_binding(ctx: &AppContext, task_id: &str) {
    let terminal_ids = {
        let mut store = ctx.acp_runtime.lock().await;
        store.detach_task_binding(task_id)
    };
    for terminal_id in terminal_ids {
        let _ = crate::terminal_runtime::handle_terminal_close(ctx, terminal_id.as_str()).await;
    }
}

async fn cancel_session(ctx: &AppContext, session_id: &str) -> Result<(), String> {
    let integration_id = {
        let store = ctx.acp_runtime.lock().await;
        let Some(session_key) = store.session_key_by_id.get(session_id) else {
            return Err(format!("ACP session `{session_id}` is not registered."));
        };
        let Some(session) = store.sessions_by_key.get(session_key.as_str()) else {
            return Err(format!("ACP session `{session_id}` runtime is missing."));
        };
        session.integration_id.clone()
    };
    let client = {
        let store = ctx.acp_runtime.lock().await;
        store
            .clients
            .get(integration_id.as_str())
            .cloned()
            .ok_or_else(|| format!("ACP client `{integration_id}` is unavailable."))?
    };
    client.cancel(json!({ "sessionId": session_id })).await
}

fn truncate_terminal_output(output: &str, output_byte_limit: Option<usize>) -> (String, bool) {
    let Some(output_byte_limit) = output_byte_limit else {
        return (output.to_string(), false);
    };
    if output.len() <= output_byte_limit {
        return (output.to_string(), false);
    }
    let mut start = output.len().saturating_sub(output_byte_limit);
    while !output.is_char_boundary(start) && start < output.len() {
        start += 1;
    }
    (output[start..].to_string(), true)
}

pub(crate) fn extract_session_update_text(payload: &Value) -> Option<String> {
    extract_session_update_delta_text(payload)
}

pub(crate) fn extract_session_config_options(payload: &Value) -> Option<Value> {
    extract_config_options(payload)
}

pub(crate) fn extract_session_available_commands(payload: &Value) -> Option<Value> {
    extract_available_commands(payload)
}

pub(crate) fn prompt_outcome_was_cancelled(outcome: &AcpPromptOutcome) -> bool {
    outcome
        .stop_reason
        .as_deref()
        .is_some_and(|value| value.eq_ignore_ascii_case("cancelled"))
}

pub(crate) fn resolve_prompt_outcome_text(
    outcome: &AcpPromptOutcome,
    streamed_parts: &[String],
) -> String {
    if let Some(text) = outcome
        .text
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return text.to_string();
    }
    let streamed = streamed_parts
        .iter()
        .map(String::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>();
    if streamed.is_empty() {
        String::new()
    } else {
        streamed.join("\n")
    }
}

#[cfg(test)]
#[path = "acp_runtime_tests.rs"]
mod tests;
