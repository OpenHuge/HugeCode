use std::{collections::HashMap, io::ErrorKind, process::Stdio, time::Duration};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, BufReader};

use super::{
    local_claude_exec_path::{
        format_local_claude_command, new_local_claude_command, resolve_local_claude_exec_binary,
        CODE_RUNTIME_LOCAL_CLAUDE_EXEC_PATH_ENV,
    },
    native_state_store::TABLE_NATIVE_RUNTIME_STATE_KV,
    provider_requests, truncate_text_for_error, AppContext,
};

const LOCAL_CLAUDE_THREAD_SESSION_STORE_KEY: &str = "claude_code_local_thread_sessions_v1";
const LOCAL_CLAUDE_PROBE_TIMEOUT_MS: u64 = 5_000;

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub(crate) struct LocalClaudeProbeResult {
    pub(crate) session_id: Option<String>,
    pub(crate) api_key_source: Option<String>,
    pub(crate) model: Option<String>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub(crate) struct LocalClaudeExecTurnResult {
    pub(crate) output: String,
    pub(crate) response_model_id: Option<String>,
    pub(crate) session_id: Option<String>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LocalClaudeThreadSessionStore {
    #[serde(default = "default_local_claude_store_version")]
    version: u32,
    #[serde(default)]
    sessions: HashMap<String, String>,
}

#[derive(Clone, Debug)]
pub(crate) struct LocalClaudeExecTurnInput {
    pub(crate) workspace_path: String,
    pub(crate) prompt: String,
    pub(crate) model_id: Option<String>,
    pub(crate) access_mode: String,
    pub(crate) collaboration_mode_is_plan: bool,
    pub(crate) resume_session_id: Option<String>,
}

fn default_local_claude_store_version() -> u32 {
    1
}

fn local_claude_thread_session_key(workspace_id: &str, thread_id: &str) -> String {
    format!(
        "{}::{}",
        workspace_id.trim().to_ascii_lowercase(),
        thread_id.trim().to_ascii_lowercase()
    )
}

fn local_claude_supported_platform() -> bool {
    cfg!(target_os = "macos")
}

fn summarize_command_output(bytes: &[u8], max_chars: usize) -> String {
    let text = String::from_utf8_lossy(bytes);
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return "<empty>".to_string();
    }
    truncate_text_for_error(trimmed, max_chars)
}

fn read_string_field(object: &serde_json::Map<String, Value>, key: &str) -> Option<String> {
    object
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn permission_mode_for_local_claude(
    access_mode: &str,
    collaboration_mode_is_plan: bool,
) -> &'static str {
    if collaboration_mode_is_plan {
        return "plan";
    }
    match access_mode.trim() {
        "read-only" | "read_only" => "plan",
        "full-access" | "danger-full-access" => "bypassPermissions",
        _ => "default",
    }
}

fn resolve_local_claude_exec_command_args(input: &LocalClaudeExecTurnInput) -> Vec<String> {
    let mut args = vec![
        "--print".to_string(),
        "--verbose".to_string(),
        "--output-format".to_string(),
        "stream-json".to_string(),
        "--include-partial-messages".to_string(),
        "--permission-mode".to_string(),
        permission_mode_for_local_claude(
            input.access_mode.as_str(),
            input.collaboration_mode_is_plan,
        )
        .to_string(),
    ];

    if let Some(model_id) = input
        .model_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        args.push("--model".to_string());
        args.push(model_id.to_string());
    }

    if let Some(session_id) = input
        .resume_session_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        args.push("--resume".to_string());
        args.push(session_id.to_string());
    }

    args.push(input.prompt.clone());
    args
}

fn extract_init_event_probe(value: &Value) -> Option<LocalClaudeProbeResult> {
    let object = value.as_object()?;
    if object.get("type").and_then(Value::as_str) != Some("system") {
        return None;
    }
    if object.get("subtype").and_then(Value::as_str) != Some("init") {
        return None;
    }

    Some(LocalClaudeProbeResult {
        session_id: read_string_field(object, "session_id")
            .or_else(|| read_string_field(object, "sessionId")),
        api_key_source: read_string_field(object, "apiKeySource")
            .or_else(|| read_string_field(object, "api_key_source")),
        model: read_string_field(object, "model"),
    })
}

fn collect_text_blocks(value: &Value, fragments: &mut Vec<String>) {
    match value {
        Value::String(text) => {
            let trimmed = text.trim();
            if !trimmed.is_empty() {
                fragments.push(trimmed.to_string());
            }
        }
        Value::Array(entries) => {
            for entry in entries {
                collect_text_blocks(entry, fragments);
            }
        }
        Value::Object(object) => {
            if let Some(kind) = object.get("type").and_then(Value::as_str) {
                if kind == "tool_use" || kind == "tool_result" {
                    return;
                }
            }
            if let Some(text) = read_string_field(object, "text")
                .or_else(|| read_string_field(object, "result"))
                .or_else(|| read_string_field(object, "output_text"))
                .or_else(|| read_string_field(object, "message"))
            {
                fragments.push(text);
            }
            for key in [
                "content",
                "message",
                "messages",
                "result",
                "output",
                "output_text",
                "text",
            ] {
                if let Some(nested) = object.get(key) {
                    collect_text_blocks(nested, fragments);
                }
            }
        }
        _ => {}
    }
}

fn extract_final_message_from_stream_event(value: &Value) -> Option<String> {
    let object = value.as_object()?;
    for key in ["result", "message", "output_text", "text"] {
        if let Some(value) = read_string_field(object, key) {
            return Some(value);
        }
    }
    None
}

fn emit_assistant_delta(
    next_text: &str,
    emitted_text: &mut String,
    delta_callback: Option<&provider_requests::ProviderDeltaCallback>,
) {
    let trimmed = next_text.trim();
    if trimmed.is_empty() {
        return;
    }
    let next_owned = trimmed.to_string();
    let delta = if next_owned.starts_with(emitted_text.as_str()) {
        next_owned[emitted_text.len()..].to_string()
    } else if emitted_text.as_str().starts_with(next_owned.as_str()) {
        String::new()
    } else {
        next_owned.clone()
    };
    if !delta.is_empty() {
        if let Some(callback) = delta_callback {
            callback(delta);
        }
    }
    *emitted_text = next_owned;
}

fn classify_local_claude_error(stderr: &str, stdout: &str) -> Option<String> {
    let combined = format!("{stderr}\n{stdout}").to_ascii_lowercase();
    if combined.contains("api key source\":\"none")
        || combined.contains("api key source: none")
        || combined.contains("sign in")
        || combined.contains("login")
        || combined.contains("authenticated")
    {
        return Some(
            "Local Claude CLI is installed but not authenticated. Run `claude` to sign in and retry."
                .to_string(),
        );
    }
    None
}

fn looks_like_missing_resume_session(error: &str) -> bool {
    let normalized = error.to_ascii_lowercase();
    normalized.contains("resume")
        && (normalized.contains("not found")
            || normalized.contains("no session")
            || normalized.contains("invalid session")
            || normalized.contains("unknown session"))
}

async fn run_local_claude_probe_once() -> Result<LocalClaudeProbeResult, String> {
    if !local_claude_supported_platform() {
        return Err("Claude Code Local is only supported on macOS in this build.".to_string());
    }

    let claude_exec_path = resolve_local_claude_exec_binary(None);
    let display_binary = format_local_claude_command(claude_exec_path.as_str());
    let mut command = new_local_claude_command(claude_exec_path.as_str());
    command
        .arg("--print")
        .arg("--verbose")
        .arg("--output-format")
        .arg("stream-json")
        .arg("--permission-mode")
        .arg("plan")
        .arg("Probe local Claude runtime readiness.")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null())
        .kill_on_drop(true);

    let mut child = command.spawn().map_err(|error| {
        if error.kind() == ErrorKind::NotFound {
            return format!(
                "failed to run `{}` (not found). Install Claude Code or set {} to a valid executable path.",
                display_binary, CODE_RUNTIME_LOCAL_CLAUDE_EXEC_PATH_ENV
            );
        }
        format!("failed to run `{}`: {error}", display_binary)
    })?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "failed to capture local Claude probe stdout".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "failed to capture local Claude probe stderr".to_string())?;
    let stderr_task = tokio::spawn(async move {
        let mut stderr = stderr;
        let mut buffer = Vec::new();
        let _ = stderr.read_to_end(&mut buffer).await;
        buffer
    });
    let mut reader = BufReader::new(stdout).lines();
    let first_line = tokio::time::timeout(
        Duration::from_millis(LOCAL_CLAUDE_PROBE_TIMEOUT_MS),
        reader.next_line(),
    )
    .await
    .map_err(|_| {
        "Local Claude readiness probe timed out before emitting an init event.".to_string()
    })?
    .map_err(|error| format!("Failed to read local Claude readiness probe output: {error}"))?;

    let _ = child.kill().await;
    let _ = child.wait().await;
    let stderr_bytes = stderr_task.await.unwrap_or_default();
    let stderr_summary = summarize_command_output(stderr_bytes.as_slice(), 600);

    let Some(first_line) = first_line else {
        return Err(format!(
            "Local Claude readiness probe produced no init event. stderr={stderr_summary}"
        ));
    };
    let parsed = serde_json::from_str::<Value>(first_line.as_str()).map_err(|error| {
        format!(
            "Local Claude readiness probe returned invalid JSON: {error}. stderr={stderr_summary}"
        )
    })?;
    let probe = extract_init_event_probe(&parsed).ok_or_else(|| {
        format!("Local Claude readiness probe did not emit a system init event. stderr={stderr_summary}")
    })?;
    if probe.api_key_source.as_deref() == Some("none") {
        return Err(
            "Local Claude CLI is installed but not authenticated. Run `claude` to sign in and retry."
                .to_string(),
        );
    }
    Ok(probe)
}

async fn run_local_claude_exec_turn_once(
    input: &LocalClaudeExecTurnInput,
    delta_callback: Option<provider_requests::ProviderDeltaCallback>,
) -> Result<LocalClaudeExecTurnResult, String> {
    if !local_claude_supported_platform() {
        return Err("Claude Code Local is only supported on macOS in this build.".to_string());
    }

    let workspace = input.workspace_path.trim();
    if workspace.is_empty() {
        return Err("workspace path is empty for local Claude execution.".to_string());
    }

    let claude_exec_path = resolve_local_claude_exec_binary(None);
    let display_binary = format_local_claude_command(claude_exec_path.as_str());
    let mut command = new_local_claude_command(claude_exec_path.as_str());
    command
        .current_dir(workspace)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null())
        .kill_on_drop(true);
    for argument in resolve_local_claude_exec_command_args(input) {
        command.arg(argument);
    }

    let mut child = command.spawn().map_err(|error| {
        if error.kind() == ErrorKind::NotFound {
            return format!(
                "failed to run `{}` (not found). Install Claude Code or set {} to a valid executable path.",
                display_binary, CODE_RUNTIME_LOCAL_CLAUDE_EXEC_PATH_ENV
            );
        }
        format!("failed to run `{}`: {error}", display_binary)
    })?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "failed to capture local Claude stdout".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "failed to capture local Claude stderr".to_string())?;
    let stderr_task = tokio::spawn(async move {
        let mut stderr = stderr;
        let mut buffer = Vec::new();
        let _ = stderr.read_to_end(&mut buffer).await;
        buffer
    });

    let mut reader = BufReader::new(stdout).lines();
    let mut session_id: Option<String> = None;
    let mut response_model_id: Option<String> = None;
    let mut final_message: Option<String> = None;
    let mut emitted_text = String::new();
    let mut stdout_buffer = String::new();

    while let Some(line) = reader
        .next_line()
        .await
        .map_err(|error| format!("Failed to read local Claude output: {error}"))?
    {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if !stdout_buffer.is_empty() {
            stdout_buffer.push('\n');
        }
        stdout_buffer.push_str(trimmed);
        let parsed = match serde_json::from_str::<Value>(trimmed) {
            Ok(value) => value,
            Err(_) => continue,
        };
        if let Some(probe) = extract_init_event_probe(&parsed) {
            if session_id.is_none() {
                session_id = probe.session_id;
            }
            if response_model_id.is_none() {
                response_model_id = probe.model;
            }
            if probe.api_key_source.as_deref() == Some("none") {
                return Err(
                    "Local Claude CLI is installed but not authenticated. Run `claude` to sign in and retry."
                        .to_string(),
                );
            }
            continue;
        }

        let mut fragments = Vec::new();
        collect_text_blocks(&parsed, &mut fragments);
        for fragment in fragments {
            emit_assistant_delta(
                fragment.as_str(),
                &mut emitted_text,
                delta_callback.as_ref(),
            );
        }
        if final_message.is_none() {
            final_message = extract_final_message_from_stream_event(&parsed);
        }
    }

    let status = child
        .wait()
        .await
        .map_err(|error| format!("Failed to wait for local Claude process: {error}"))?;
    let stderr_bytes = stderr_task.await.unwrap_or_default();
    let stderr_text = String::from_utf8_lossy(stderr_bytes.as_slice()).to_string();

    if !status.success() {
        if let Some(classified) =
            classify_local_claude_error(stderr_text.as_str(), stdout_buffer.as_str())
        {
            return Err(classified);
        }
        return Err(format!(
            "`claude --print` failed (status {:?}): stderr={}, stdout={}",
            status.code(),
            summarize_command_output(stderr_bytes.as_slice(), 600),
            truncate_text_for_error(stdout_buffer.as_str(), 600)
        ));
    }

    let output = final_message
        .or_else(|| (!emitted_text.trim().is_empty()).then_some(emitted_text.clone()))
        .ok_or_else(|| {
            "local Claude execution completed without a final response message.".to_string()
        })?;

    Ok(LocalClaudeExecTurnResult {
        output,
        response_model_id,
        session_id,
    })
}

pub(crate) async fn probe_local_claude_cli() -> Result<LocalClaudeProbeResult, String> {
    run_local_claude_probe_once().await
}

pub(crate) async fn read_local_claude_thread_session(
    ctx: &AppContext,
    workspace_id: &str,
    thread_id: &str,
) -> Option<String> {
    let key = local_claude_thread_session_key(workspace_id, thread_id);
    let stored = ctx
        .native_state_store
        .get_setting_value(
            TABLE_NATIVE_RUNTIME_STATE_KV,
            LOCAL_CLAUDE_THREAD_SESSION_STORE_KEY,
        )
        .await
        .ok()??;
    let store = serde_json::from_value::<LocalClaudeThreadSessionStore>(stored).ok()?;
    store
        .sessions
        .get(key.as_str())
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

async fn write_local_claude_thread_sessions(
    ctx: &AppContext,
    store: LocalClaudeThreadSessionStore,
) -> Result<(), String> {
    let value = serde_json::to_value(store)
        .map_err(|error| format!("Encode local Claude session store failed: {error}"))?;
    ctx.native_state_store
        .upsert_setting_value(
            TABLE_NATIVE_RUNTIME_STATE_KV,
            LOCAL_CLAUDE_THREAD_SESSION_STORE_KEY,
            value,
        )
        .await
        .map(|_| ())
}

pub(crate) async fn persist_local_claude_thread_session(
    ctx: &AppContext,
    workspace_id: &str,
    thread_id: &str,
    session_id: &str,
) -> Result<(), String> {
    let key = local_claude_thread_session_key(workspace_id, thread_id);
    let session_id = session_id.trim();
    if key.is_empty() || session_id.is_empty() {
        return Ok(());
    }
    let stored = ctx
        .native_state_store
        .get_setting_value(
            TABLE_NATIVE_RUNTIME_STATE_KV,
            LOCAL_CLAUDE_THREAD_SESSION_STORE_KEY,
        )
        .await
        .ok()
        .flatten()
        .and_then(|value| serde_json::from_value::<LocalClaudeThreadSessionStore>(value).ok())
        .unwrap_or_default();
    let mut next = stored;
    next.sessions.insert(key, session_id.to_string());
    write_local_claude_thread_sessions(ctx, next).await
}

pub(crate) async fn clear_local_claude_thread_session(
    ctx: &AppContext,
    workspace_id: &str,
    thread_id: &str,
) -> Result<(), String> {
    let key = local_claude_thread_session_key(workspace_id, thread_id);
    let stored = ctx
        .native_state_store
        .get_setting_value(
            TABLE_NATIVE_RUNTIME_STATE_KV,
            LOCAL_CLAUDE_THREAD_SESSION_STORE_KEY,
        )
        .await
        .ok()
        .flatten()
        .and_then(|value| serde_json::from_value::<LocalClaudeThreadSessionStore>(value).ok())
        .unwrap_or_default();
    if !stored.sessions.contains_key(key.as_str()) {
        return Ok(());
    }
    let mut next = stored;
    next.sessions.remove(key.as_str());
    write_local_claude_thread_sessions(ctx, next).await
}

pub(crate) async fn query_local_claude_exec_turn(
    input: LocalClaudeExecTurnInput,
    delta_callback: Option<provider_requests::ProviderDeltaCallback>,
) -> Result<LocalClaudeExecTurnResult, String> {
    match run_local_claude_exec_turn_once(&input, delta_callback.clone()).await {
        Ok(result) => Ok(result),
        Err(error)
            if input.resume_session_id.is_some()
                && looks_like_missing_resume_session(error.as_str()) =>
        {
            let mut retry_input = input.clone();
            retry_input.resume_session_id = None;
            run_local_claude_exec_turn_once(&retry_input, delta_callback).await
        }
        Err(error) => Err(error),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        extract_final_message_from_stream_event, extract_init_event_probe,
        permission_mode_for_local_claude, resolve_local_claude_exec_command_args,
        LocalClaudeExecTurnInput,
    };
    use serde_json::json;

    #[test]
    fn permission_mode_maps_access_and_plan_modes() {
        assert_eq!(permission_mode_for_local_claude("read-only", false), "plan");
        assert_eq!(
            permission_mode_for_local_claude("on-request", false),
            "default"
        );
        assert_eq!(
            permission_mode_for_local_claude("full-access", false),
            "bypassPermissions"
        );
        assert_eq!(permission_mode_for_local_claude("on-request", true), "plan");
    }

    #[test]
    fn resolve_local_claude_exec_command_args_includes_resume_and_model() {
        let args = resolve_local_claude_exec_command_args(&LocalClaudeExecTurnInput {
            workspace_path: "/tmp/workspace".to_string(),
            prompt: "Ping Claude".to_string(),
            model_id: Some("claude-sonnet-4-5".to_string()),
            access_mode: "on-request".to_string(),
            collaboration_mode_is_plan: false,
            resume_session_id: Some("session-123".to_string()),
        });

        assert_eq!(
            args,
            vec![
                "--print".to_string(),
                "--verbose".to_string(),
                "--output-format".to_string(),
                "stream-json".to_string(),
                "--include-partial-messages".to_string(),
                "--permission-mode".to_string(),
                "default".to_string(),
                "--model".to_string(),
                "claude-sonnet-4-5".to_string(),
                "--resume".to_string(),
                "session-123".to_string(),
                "Ping Claude".to_string(),
            ]
        );
    }

    #[test]
    fn extract_init_event_probe_reads_session_id_and_auth_source() {
        let parsed = extract_init_event_probe(&json!({
            "type": "system",
            "subtype": "init",
            "session_id": "session-123",
            "apiKeySource": "subscription",
            "model": "claude-sonnet-4-5"
        }))
        .expect("init probe");

        assert_eq!(parsed.session_id.as_deref(), Some("session-123"));
        assert_eq!(parsed.api_key_source.as_deref(), Some("subscription"));
        assert_eq!(parsed.model.as_deref(), Some("claude-sonnet-4-5"));
    }

    #[test]
    fn extract_final_message_from_stream_event_prefers_result_text() {
        assert_eq!(
            extract_final_message_from_stream_event(&json!({
                "type": "result",
                "result": "Hello from Claude"
            }))
            .as_deref(),
            Some("Hello from Claude")
        );
    }
}
