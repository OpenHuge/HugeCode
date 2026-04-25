use std::{collections::HashMap, io::ErrorKind, process::Stdio, time::Duration};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, BufReader};

use super::{
    local_claude_exec_path::{
        format_local_claude_command, local_claude_external_auth_configured,
        new_local_claude_command, resolve_local_claude_exec_binary,
        CODE_RUNTIME_LOCAL_CLAUDE_EXEC_PATH_ENV,
    },
    native_state_store::TABLE_NATIVE_RUNTIME_STATE_KV,
    provider_requests, truncate_text_for_error, AppContext,
};

const LOCAL_CLAUDE_THREAD_SESSION_STORE_KEY: &str = "claude_code_local_thread_sessions_v1";
const LOCAL_CLAUDE_PROBE_TIMEOUT_MS: u64 = 5_000;
const LOCAL_CLAUDE_NOT_AUTHENTICATED_ERROR: &str =
    "Local Claude CLI is installed but not authenticated. Run `claude` to sign in and retry.";

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
    pub(crate) recovered_from_stale_resume: bool,
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct LocalClaudeAuthStatus {
    #[serde(default)]
    logged_in: bool,
    #[serde(default)]
    auth_method: Option<String>,
    #[serde(default)]
    api_provider: Option<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum LocalClaudeReadinessKind {
    Ready,
    NotInstalled,
    NotAuthenticated,
    UnsupportedPlatform,
    Degraded,
}

impl LocalClaudeReadinessKind {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Ready => "ready",
            Self::NotInstalled => "not_installed",
            Self::NotAuthenticated => "not_authenticated",
            Self::UnsupportedPlatform => "unsupported_platform",
            Self::Degraded => "degraded",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct LocalClaudeReadiness {
    pub(crate) kind: LocalClaudeReadinessKind,
    pub(crate) message: String,
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
    truncate_text_for_error(
        redact_local_claude_sensitive_text(trimmed).as_str(),
        max_chars,
    )
}

fn redact_delimited_secret(text: &str, needle: &str, delimiter: char) -> String {
    let mut result = String::with_capacity(text.len());
    let mut cursor = 0usize;

    while let Some(relative_start) = text[cursor..].find(needle) {
        let start = cursor + relative_start;
        let value_start = start + needle.len();
        result.push_str(&text[cursor..value_start]);

        let mut chars = text[value_start..].char_indices();
        let mut value_end = text.len();
        let mut escaped = false;
        while let Some((offset, ch)) = chars.next() {
            if delimiter == '"' {
                if escaped {
                    escaped = false;
                    continue;
                }
                if ch == '\\' {
                    escaped = true;
                    continue;
                }
            }
            if ch == delimiter {
                value_end = value_start + offset;
                break;
            }
        }

        if value_end > value_start {
            result.push_str("<redacted>");
        }
        cursor = value_end;
    }

    result.push_str(&text[cursor..]);
    result
}

fn redact_flag_secret(text: &str, flag: &str) -> String {
    let mut result = String::with_capacity(text.len());
    let mut index = 0usize;

    while let Some(relative_start) = text[index..].find(flag) {
        let start = index + relative_start;
        let after_flag = start + flag.len();
        result.push_str(&text[index..after_flag]);

        let whitespace_len = text[after_flag..]
            .chars()
            .take_while(|ch| ch.is_whitespace())
            .map(char::len_utf8)
            .sum::<usize>();
        let value_start = after_flag + whitespace_len;
        result.push_str(&text[after_flag..value_start]);

        let value_len = text[value_start..]
            .chars()
            .take_while(|ch| !ch.is_whitespace())
            .map(char::len_utf8)
            .sum::<usize>();
        if value_len == 0 {
            index = value_start;
            continue;
        }

        result.push_str("<redacted>");
        index = value_start + value_len;
    }

    result.push_str(&text[index..]);
    result
}

fn append_redacted_log_line(buffer: &mut String, line: &str) {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return;
    }
    if !buffer.is_empty() {
        buffer.push('\n');
    }
    buffer.push_str(redact_local_claude_sensitive_text(trimmed).as_str());
}

fn redact_local_claude_sensitive_text(text: &str) -> String {
    let mut redacted = text.to_string();
    for needle in [
        "\"session_id\":\"",
        "\"session_id\": \"",
        "\"sessionId\":\"",
        "\"sessionId\": \"",
    ] {
        redacted = redact_delimited_secret(redacted.as_str(), needle, '"');
    }
    for needle in ["session_id=", "sessionId="] {
        redacted = redact_delimited_secret(redacted.as_str(), needle, ' ');
    }
    redact_flag_secret(redacted.as_str(), "--resume")
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

    // Stored Claude session ids are sensitive and must not be exposed via argv.
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

fn should_collect_local_claude_output_text(value: &Value) -> bool {
    let Some(object) = value.as_object() else {
        return false;
    };
    matches!(
        object.get("type").and_then(Value::as_str),
        Some("assistant") | Some("result")
    )
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
    if combined.contains("sign in")
        || combined.contains("login")
        || combined.contains("authenticated")
    {
        return Some(LOCAL_CLAUDE_NOT_AUTHENTICATED_ERROR.to_string());
    }
    None
}

#[cfg(test)]
async fn run_local_claude_probe_once() -> Result<LocalClaudeProbeResult, String> {
    if !local_claude_supported_platform() {
        return Err("Claude Code Local is only supported on macOS in this build.".to_string());
    }
    ensure_local_claude_authenticated().await?;

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
    let probe = tokio::time::timeout(
        Duration::from_millis(LOCAL_CLAUDE_PROBE_TIMEOUT_MS),
        async {
            loop {
                let Some(line) = reader.next_line().await.map_err(|error| {
                    format!("Failed to read local Claude readiness probe output: {error}")
                })?
                else {
                    return Err("Local Claude readiness probe produced no init event.".to_string());
                };
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                let Ok(parsed) = serde_json::from_str::<Value>(trimmed) else {
                    continue;
                };
                if let Some(probe) = extract_init_event_probe(&parsed) {
                    return Ok(probe);
                }
            }
        },
    )
    .await
    .map_err(|_| {
        "Local Claude readiness probe timed out before emitting an init event.".to_string()
    })??;

    let _ = child.kill().await;
    let _ = child.wait().await;
    let _ = stderr_task.await;
    Ok(probe)
}

async fn run_local_claude_exec_turn_once(
    input: &LocalClaudeExecTurnInput,
    delta_callback: Option<provider_requests::ProviderDeltaCallback>,
) -> Result<LocalClaudeExecTurnResult, String> {
    if !local_claude_supported_platform() {
        return Err("Claude Code Local is only supported on macOS in this build.".to_string());
    }
    ensure_local_claude_authenticated().await?;

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
    let mut stdout_log_buffer = String::new();

    while let Some(line) = reader
        .next_line()
        .await
        .map_err(|error| format!("Failed to read local Claude output: {error}"))?
    {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        append_redacted_log_line(&mut stdout_log_buffer, trimmed);
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
            continue;
        }

        if should_collect_local_claude_output_text(&parsed) {
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
    }

    let status = child
        .wait()
        .await
        .map_err(|error| format!("Failed to wait for local Claude process: {error}"))?;
    let stderr_bytes = stderr_task.await.unwrap_or_default();
    let stderr_text = String::from_utf8_lossy(stderr_bytes.as_slice()).to_string();

    if !status.success() {
        if let Some(classified) =
            classify_local_claude_error(stderr_text.as_str(), stdout_log_buffer.as_str())
        {
            return Err(classified);
        }
        return Err(format!(
            "`claude --print` failed (status {:?}): stderr={}, stdout={}",
            status.code(),
            summarize_command_output(stderr_bytes.as_slice(), 600),
            truncate_text_for_error(stdout_log_buffer.as_str(), 600)
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
        recovered_from_stale_resume: false,
    })
}

async fn read_local_claude_auth_status() -> Result<LocalClaudeAuthStatus, String> {
    let claude_exec_path = resolve_local_claude_exec_binary(None);
    let display_binary = format_local_claude_command(claude_exec_path.as_str());
    let mut command = new_local_claude_command(claude_exec_path.as_str());
    command
        .arg("auth")
        .arg("status")
        .arg("--json")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null())
        .kill_on_drop(true);

    let output = tokio::time::timeout(
        Duration::from_millis(LOCAL_CLAUDE_PROBE_TIMEOUT_MS),
        command.output(),
    )
    .await
    .map_err(|_| "Local Claude auth status probe timed out.".to_string())?
    .map_err(|error| {
        if error.kind() == ErrorKind::NotFound {
            return format!(
                "failed to run `{}` (not found). Install Claude Code or set {} to a valid executable path.",
                display_binary, CODE_RUNTIME_LOCAL_CLAUDE_EXEC_PATH_ENV
            );
        }
        format!("failed to run `{}`: {error}", display_binary)
    })?;

    if !output.status.success() {
        return Err(format!(
            "`{} auth status --json` failed (status {:?}): stderr={}, stdout={}",
            display_binary,
            output.status.code(),
            summarize_command_output(output.stderr.as_slice(), 600),
            summarize_command_output(output.stdout.as_slice(), 600)
        ));
    }

    serde_json::from_slice::<LocalClaudeAuthStatus>(output.stdout.as_slice()).map_err(|error| {
        format!(
            "Local Claude auth status probe returned invalid JSON: {error}. stdout={}, stderr={}",
            summarize_command_output(output.stdout.as_slice(), 600),
            summarize_command_output(output.stderr.as_slice(), 600)
        )
    })
}

async fn ensure_local_claude_authenticated() -> Result<(), String> {
    if local_claude_external_auth_configured() {
        return Ok(());
    }
    let auth_status = read_local_claude_auth_status().await?;
    if !auth_status.logged_in {
        return Err(LOCAL_CLAUDE_NOT_AUTHENTICATED_ERROR.to_string());
    }
    Ok(())
}

async fn verify_local_claude_cli_installation() -> Result<(), String> {
    if !local_claude_supported_platform() {
        return Err("Claude Code Local is only supported on macOS in this build.".to_string());
    }

    let claude_exec_path = resolve_local_claude_exec_binary(None);
    let display_binary = format_local_claude_command(claude_exec_path.as_str());
    let mut command = new_local_claude_command(claude_exec_path.as_str());
    command
        .arg("-v")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null())
        .kill_on_drop(true);

    let output = tokio::time::timeout(
        Duration::from_millis(LOCAL_CLAUDE_PROBE_TIMEOUT_MS),
        command.output(),
    )
    .await
    .map_err(|_| "Local Claude version probe timed out.".to_string())?
    .map_err(|error| {
        if error.kind() == ErrorKind::NotFound {
            return format!(
                "failed to run `{}` (not found). Install Claude Code or set {} to a valid executable path.",
                display_binary, CODE_RUNTIME_LOCAL_CLAUDE_EXEC_PATH_ENV
            );
        }
        format!("failed to run `{}`: {error}", display_binary)
    })?;

    if !output.status.success() {
        return Err(format!(
            "`{} -v` failed (status {:?}): stderr={}, stdout={}",
            display_binary,
            output.status.code(),
            summarize_command_output(output.stderr.as_slice(), 600),
            summarize_command_output(output.stdout.as_slice(), 600)
        ));
    }

    Ok(())
}

#[cfg(test)]
#[allow(dead_code)]
pub(crate) async fn check_local_claude_cli_readiness() -> Result<(), String> {
    let readiness = read_local_claude_cli_readiness().await;
    if readiness.kind == LocalClaudeReadinessKind::Ready {
        Ok(())
    } else {
        Err(readiness.message)
    }
}

pub(crate) async fn read_local_claude_cli_readiness() -> LocalClaudeReadiness {
    if !local_claude_supported_platform() {
        return LocalClaudeReadiness {
            kind: LocalClaudeReadinessKind::UnsupportedPlatform,
            message: "Local Claude Code is currently supported on macOS only.".to_string(),
        };
    }

    if let Err(error) = verify_local_claude_cli_installation().await {
        let kind = if error.contains("(not found)")
            || error.contains("valid executable path")
            || error.contains("timed out")
        {
            LocalClaudeReadinessKind::NotInstalled
        } else {
            LocalClaudeReadinessKind::Degraded
        };
        return LocalClaudeReadiness {
            kind,
            message: error,
        };
    }

    match ensure_local_claude_authenticated().await {
        Ok(()) => LocalClaudeReadiness {
            kind: LocalClaudeReadinessKind::Ready,
            message: "Local Claude Code is ready on this machine.".to_string(),
        },
        Err(error) => {
            let kind = if error == LOCAL_CLAUDE_NOT_AUTHENTICATED_ERROR {
                LocalClaudeReadinessKind::NotAuthenticated
            } else {
                LocalClaudeReadinessKind::Degraded
            };
            LocalClaudeReadiness {
                kind,
                message: error,
            }
        }
    }
}

#[cfg(test)]
pub(crate) async fn probe_local_claude_cli() -> Result<LocalClaudeProbeResult, String> {
    run_local_claude_probe_once().await
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
    run_local_claude_exec_turn_once(&input, delta_callback).await
}

#[cfg(test)]
mod tests {
    #[cfg(target_os = "macos")]
    use super::{
        check_local_claude_cli_readiness, probe_local_claude_cli, query_local_claude_exec_turn,
    };
    use super::{
        classify_local_claude_error, extract_final_message_from_stream_event,
        extract_init_event_probe, permission_mode_for_local_claude,
        redact_local_claude_sensitive_text, resolve_local_claude_exec_command_args,
        should_collect_local_claude_output_text, LocalClaudeExecTurnInput,
    };
    use serde_json::json;

    #[cfg(target_os = "macos")]
    use super::super::local_claude_exec_path::{
        local_claude_exec_env_lock, reset_local_claude_exec_binary_cache,
        CODE_RUNTIME_LOCAL_CLAUDE_EXEC_PATH_ENV,
    };
    #[cfg(target_os = "macos")]
    use std::fs;
    #[cfg(target_os = "macos")]
    use tempfile::TempDir;

    #[cfg(target_os = "macos")]
    use std::os::unix::fs::PermissionsExt;

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
    fn resolve_local_claude_exec_command_args_includes_model() {
        let args = resolve_local_claude_exec_command_args(&LocalClaudeExecTurnInput {
            workspace_path: "/tmp/workspace".to_string(),
            prompt: "Ping Claude".to_string(),
            model_id: Some("claude-sonnet-4-5".to_string()),
            access_mode: "on-request".to_string(),
            collaboration_mode_is_plan: false,
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

    #[test]
    fn classify_local_claude_error_does_not_treat_api_key_source_none_as_auth_failure() {
        assert_eq!(
            classify_local_claude_error("", r#"{"apiKeySource":"none"}"#),
            None
        );
    }

    #[test]
    fn redact_local_claude_sensitive_text_hides_session_identifiers() {
        let original = r#"stderr=session_id=session-123 command=claude --resume abc123 payload={"session_id":"session-123","sessionId":"session-456"}"#;
        let redacted = redact_local_claude_sensitive_text(original);
        assert!(!redacted.contains("session-123"));
        assert!(!redacted.contains("session-456"));
        assert!(!redacted.contains("abc123"));
        assert!(redacted.contains("session_id=<redacted>"));
        assert!(redacted.contains(r#""session_id":"<redacted>""#));
        assert!(redacted.contains(r#""sessionId":"<redacted>""#));
        assert!(redacted.contains("--resume <redacted>"));
    }

    #[test]
    fn should_collect_local_claude_output_text_ignores_system_hook_events() {
        assert!(!should_collect_local_claude_output_text(&json!({
            "type": "system",
            "subtype": "hook",
            "hookSpecificOutput": {
                "hookEventName": "SessionStart",
                "additionalContext": "Injected hook context"
            }
        })));
        assert!(should_collect_local_claude_output_text(&json!({
            "type": "assistant",
            "message": {
                "content": [{"type": "text", "text": "hello"}]
            }
        })));
        assert!(should_collect_local_claude_output_text(&json!({
            "type": "result",
            "result": "hello"
        })));
    }

    #[cfg(target_os = "macos")]
    fn write_fake_local_claude_script(temp: &TempDir) -> std::path::PathBuf {
        let script_path = temp.path().join("fake-claude.sh");
        let script = r#"#!/bin/sh
if [ "$1" = "auth" ] && [ "$2" = "status" ]; then
  printf '{"loggedIn":true,"authMethod":"oauth_token","apiProvider":"firstParty"}\n'
  exit 0
fi

printf '%s\n' '{"type":"system","subtype":"hook","hook_event_name":"SessionStart"}'
printf '%s\n' '{"type":"system","subtype":"init","session_id":"session-123","apiKeySource":"none","model":"claude-sonnet-4-5"}'
printf '%s\n' '{"type":"assistant","message":{"content":[{"type":"text","text":"LOCAL_RUNTIME_CLAUDE_OK"}]}}'
printf '%s\n' '{"type":"result","subtype":"success","result":"LOCAL_RUNTIME_CLAUDE_OK"}'
"#;
        fs::write(&script_path, script).expect("write fake claude script");
        let mut permissions = fs::metadata(&script_path)
            .expect("fake claude metadata")
            .permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&script_path, permissions).expect("set fake claude permissions");
        script_path
    }

    #[cfg(target_os = "macos")]
    #[tokio::test]
    async fn probe_local_claude_cli_accepts_oauth_login_when_init_reports_none() {
        let _guard = local_claude_exec_env_lock()
            .lock()
            .expect("local claude exec env lock poisoned");
        let previous_override = std::env::var_os(CODE_RUNTIME_LOCAL_CLAUDE_EXEC_PATH_ENV);
        let temp = TempDir::new().expect("create temp dir");
        let script_path = write_fake_local_claude_script(&temp);

        unsafe {
            std::env::set_var(
                CODE_RUNTIME_LOCAL_CLAUDE_EXEC_PATH_ENV,
                script_path.as_os_str(),
            );
        }
        reset_local_claude_exec_binary_cache();

        let result = probe_local_claude_cli().await;

        unsafe {
            match previous_override {
                Some(value) => std::env::set_var(CODE_RUNTIME_LOCAL_CLAUDE_EXEC_PATH_ENV, value),
                None => std::env::remove_var(CODE_RUNTIME_LOCAL_CLAUDE_EXEC_PATH_ENV),
            }
        }
        reset_local_claude_exec_binary_cache();

        let probe = result.expect("probe should succeed for logged-in oauth cli");
        assert_eq!(probe.session_id.as_deref(), Some("session-123"));
        assert_eq!(probe.api_key_source.as_deref(), Some("none"));
        assert_eq!(probe.model.as_deref(), Some("claude-sonnet-4-5"));
    }

    #[cfg(target_os = "macos")]
    #[tokio::test]
    async fn check_local_claude_cli_readiness_accepts_logged_in_cli_without_stream_probe() {
        let _guard = local_claude_exec_env_lock()
            .lock()
            .expect("local claude exec env lock poisoned");
        let previous_override = std::env::var_os(CODE_RUNTIME_LOCAL_CLAUDE_EXEC_PATH_ENV);
        let temp = TempDir::new().expect("create temp dir");
        let script_path = temp.path().join("fake-claude-ready.sh");
        let script = r#"#!/bin/sh
if [ "$1" = "-v" ]; then
  printf 'claude 2.1.81\n'
  exit 0
fi

if [ "$1" = "auth" ] && [ "$2" = "status" ] && [ "$3" = "--json" ]; then
  printf '{"loggedIn":true,"authMethod":"oauth_token","apiProvider":"firstParty"}\n'
  exit 0
fi

printf 'unexpected args: %s\n' "$*" >&2
exit 1
"#;
        fs::write(&script_path, script).expect("write fake claude script");
        let mut permissions = fs::metadata(&script_path)
            .expect("fake claude metadata")
            .permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&script_path, permissions).expect("set fake claude permissions");

        unsafe {
            std::env::set_var(
                CODE_RUNTIME_LOCAL_CLAUDE_EXEC_PATH_ENV,
                script_path.as_os_str(),
            );
        }
        reset_local_claude_exec_binary_cache();

        let result = check_local_claude_cli_readiness().await;

        unsafe {
            match previous_override {
                Some(value) => std::env::set_var(CODE_RUNTIME_LOCAL_CLAUDE_EXEC_PATH_ENV, value),
                None => std::env::remove_var(CODE_RUNTIME_LOCAL_CLAUDE_EXEC_PATH_ENV),
            }
        }
        reset_local_claude_exec_binary_cache();

        result.expect("readiness should succeed for installed authenticated cli");
    }

    #[cfg(target_os = "macos")]
    #[tokio::test]
    async fn query_local_claude_exec_turn_accepts_oauth_login_when_init_reports_none() {
        let _guard = local_claude_exec_env_lock()
            .lock()
            .expect("local claude exec env lock poisoned");
        let previous_override = std::env::var_os(CODE_RUNTIME_LOCAL_CLAUDE_EXEC_PATH_ENV);
        let temp = TempDir::new().expect("create temp dir");
        let script_path = write_fake_local_claude_script(&temp);

        unsafe {
            std::env::set_var(
                CODE_RUNTIME_LOCAL_CLAUDE_EXEC_PATH_ENV,
                script_path.as_os_str(),
            );
        }
        reset_local_claude_exec_binary_cache();

        let result = query_local_claude_exec_turn(
            LocalClaudeExecTurnInput {
                workspace_path: temp.path().to_string_lossy().to_string(),
                prompt: "Reply with exactly LOCAL_RUNTIME_CLAUDE_OK".to_string(),
                model_id: None,
                access_mode: "on-request".to_string(),
                collaboration_mode_is_plan: false,
            },
            None,
        )
        .await;

        unsafe {
            match previous_override {
                Some(value) => std::env::set_var(CODE_RUNTIME_LOCAL_CLAUDE_EXEC_PATH_ENV, value),
                None => std::env::remove_var(CODE_RUNTIME_LOCAL_CLAUDE_EXEC_PATH_ENV),
            }
        }
        reset_local_claude_exec_binary_cache();

        let turn = result.expect("turn should succeed for logged-in oauth cli");
        assert_eq!(turn.output, "LOCAL_RUNTIME_CLAUDE_OK");
        assert_eq!(turn.response_model_id.as_deref(), Some("claude-sonnet-4-5"));
        assert_eq!(turn.session_id.as_deref(), Some("session-123"));
        assert!(!turn.recovered_from_stale_resume);
    }
}
