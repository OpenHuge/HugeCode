use std::io::ErrorKind;

use serde::Serialize;
use serde_json::{json, Value};

use super::{
    local_codex_cli_sessions::{
        resolve_local_codex_browser_debug_config_overrides,
        resolve_local_codex_exec_config_overrides, resolve_local_codex_home_dir,
    },
    local_codex_exec_path::{
        format_local_codex_command, new_local_codex_command, resolve_local_codex_exec_binary,
        CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV,
    },
    truncate_text_for_error, RpcError,
};

const CODE_RUNTIME_CODEX_EXEC_RUN_ENABLED_ENV: &str = "CODE_RUNTIME_CODEX_EXEC_RUN_ENABLED";

#[derive(Clone, Debug)]
pub(crate) struct CodexExecRunInput {
    pub workspace_path: Option<String>,
    pub prompt: String,
    pub codex_bin: Option<String>,
    pub codex_args: Vec<String>,
    pub output_schema: Option<Value>,
    pub approval_policy: Option<String>,
    pub sandbox_mode: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CodexExecEventEnvelope {
    pub index: usize,
    pub event_type: String,
    pub payload: Value,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CodexExecRunResponsePayload {
    pub ok: bool,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub events: Vec<CodexExecEventEnvelope>,
    pub final_message: Option<String>,
    pub final_json: Option<Value>,
    pub warnings: Vec<String>,
}

fn env_flag_enabled(name: &str) -> bool {
    std::env::var(name)
        .ok()
        .map(|value| value.trim().to_ascii_lowercase())
        .is_some_and(|value| matches!(value.as_str(), "1" | "true" | "yes" | "on"))
}

fn summarize_command_output(bytes: &[u8], max_chars: usize) -> String {
    let text = String::from_utf8_lossy(bytes);
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return "<empty>".to_string();
    }
    truncate_text_for_error(trimmed, max_chars)
}

fn local_codex_command_environment_overrides() -> Vec<(&'static str, String)> {
    resolve_local_codex_home_dir()
        .map(|home| vec![("CODEX_HOME", home.to_string_lossy().to_string())])
        .unwrap_or_default()
}

fn local_codex_command_config_overrides(workspace_path: Option<&str>) -> Vec<String> {
    let mut args = resolve_local_codex_exec_config_overrides();
    args.extend(resolve_local_codex_browser_debug_config_overrides(
        workspace_path,
    ));
    args
}

fn read_string_field(object: &serde_json::Map<String, Value>, key: &str) -> Option<String> {
    object
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn extract_final_message_from_event(object: &serde_json::Map<String, Value>) -> Option<String> {
    for key in [
        "final_message",
        "finalMessage",
        "output_text",
        "message",
        "text",
    ] {
        if let Some(value) = read_string_field(object, key) {
            return Some(value);
        }
    }

    let item = object.get("item").and_then(Value::as_object)?;
    if let Some(value) = read_string_field(item, "text") {
        return Some(value);
    }

    let content = item.get("content")?;
    match content {
        Value::String(text) => {
            let trimmed = text.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        }
        Value::Array(entries) => entries.iter().find_map(|entry| {
            let object = entry.as_object()?;
            read_string_field(object, "text")
                .or_else(|| read_string_field(object, "output_text"))
                .or_else(|| {
                    object
                        .get("text")
                        .and_then(Value::as_object)
                        .and_then(|nested| read_string_field(nested, "value"))
                })
        }),
        _ => None,
    }
}

fn extract_final_json_from_event(object: &serde_json::Map<String, Value>) -> Option<Value> {
    for key in ["final_json", "finalJson", "output_json", "outputJson"] {
        if let Some(value) = object.get(key) {
            match value {
                Value::Object(_) | Value::Array(_) => return Some(value.clone()),
                Value::String(raw) => {
                    let trimmed = raw.trim();
                    if trimmed.is_empty() {
                        continue;
                    }
                    if let Ok(decoded) = serde_json::from_str::<Value>(trimmed) {
                        return Some(decoded);
                    }
                }
                _ => {}
            }
        }
    }
    None
}

pub(crate) fn codex_exec_run_enabled() -> bool {
    env_flag_enabled(CODE_RUNTIME_CODEX_EXEC_RUN_ENABLED_ENV)
}

pub(crate) async fn run_codex_exec_jsonl(
    input: CodexExecRunInput,
) -> Result<CodexExecRunResponsePayload, RpcError> {
    let prompt = input.prompt.trim();
    if prompt.is_empty() {
        return Err(RpcError::invalid_params(
            "`prompt` is required for code_codex_exec_run_v1.",
        ));
    }

    let codex_exec_path = resolve_local_codex_exec_binary(input.codex_bin.as_deref());
    let display_binary = format_local_codex_command(codex_exec_path.as_str());
    let mut command = new_local_codex_command(codex_exec_path.as_str());
    for (key, value) in local_codex_command_environment_overrides() {
        command.env(key, value);
    }
    for argument in local_codex_command_config_overrides(input.workspace_path.as_deref()) {
        command.arg(argument);
    }
    command
        .arg("exec")
        .arg("--json")
        .arg("--skip-git-repo-check");

    if let Some(workspace_path) = input
        .workspace_path
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        command.arg("-C").arg(workspace_path);
    }

    if let Some(approval_policy) = input
        .approval_policy
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        command.arg("--approval-policy").arg(approval_policy);
    }

    if let Some(sandbox_mode) = input
        .sandbox_mode
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        command.arg("--sandbox").arg(sandbox_mode);
    }

    if let Some(output_schema) = input.output_schema.as_ref() {
        let encoded_output_schema = serde_json::to_string(output_schema).map_err(|error| {
            RpcError::invalid_params(format!("`outputSchema` must be serializable JSON: {error}"))
        })?;
        command
            .arg("--output-schema")
            .arg(encoded_output_schema.as_str());
    }

    for argument in input.codex_args {
        let trimmed = argument.trim();
        if !trimmed.is_empty() {
            command.arg(trimmed);
        }
    }

    command.arg(prompt);

    let output = command.output().await.map_err(|error| {
        if error.kind() == ErrorKind::NotFound {
            return RpcError::internal(format!(
                "failed to run `{}` (not found). Install Codex CLI or set {} to a valid executable path.",
                display_binary, CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV
            ));
        }
        RpcError::internal(format!("failed to run `{}`: {error}", display_binary))
    })?;

    let stdout = String::from_utf8_lossy(output.stdout.as_slice()).to_string();
    let stderr = String::from_utf8_lossy(output.stderr.as_slice()).to_string();
    let mut events = Vec::<CodexExecEventEnvelope>::new();
    let mut warnings = Vec::<String>::new();
    let mut final_message: Option<String> = None;
    let mut final_json: Option<Value> = None;

    for (index, line) in stdout.lines().enumerate() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let parsed_value = match serde_json::from_str::<Value>(trimmed) {
            Ok(value) => value,
            Err(error) => {
                warnings.push(format!(
                    "failed to parse codex JSONL event at line {}: {}",
                    index + 1,
                    error
                ));
                continue;
            }
        };

        let (event_type, payload) = match parsed_value {
            Value::Object(ref object) => {
                if final_message.is_none() {
                    final_message = extract_final_message_from_event(object);
                }
                if final_json.is_none() {
                    final_json = extract_final_json_from_event(object);
                }
                (
                    object
                        .get("type")
                        .and_then(Value::as_str)
                        .map(ToOwned::to_owned)
                        .unwrap_or_else(|| "unknown".to_string()),
                    Value::Object(object.clone()),
                )
            }
            other => (
                "json_scalar".to_string(),
                json!({
                    "value": other,
                }),
            ),
        };

        events.push(CodexExecEventEnvelope {
            index,
            event_type,
            payload,
        });
    }

    if final_message.is_none() {
        final_message = stdout
            .lines()
            .map(str::trim)
            .rev()
            .find(|line| !line.is_empty())
            .map(str::to_string);
    }

    if final_json.is_none() && input.output_schema.is_some() {
        if let Some(final_message) = final_message.as_deref() {
            if let Ok(decoded) = serde_json::from_str::<Value>(final_message) {
                final_json = Some(decoded);
            }
        }
    }

    let mut ok = output.status.success();
    if input.output_schema.is_some() && final_json.is_none() {
        ok = false;
        warnings.push(
            "`--output-schema` was requested but no final JSON payload was produced.".to_string(),
        );
    }

    if !output.status.success() {
        warnings.push(format!(
            "`codex exec` failed (status {:?}): stderr={}, stdout={}",
            output.status.code(),
            summarize_command_output(output.stderr.as_slice(), 600),
            summarize_command_output(output.stdout.as_slice(), 600)
        ));
    }

    Ok(CodexExecRunResponsePayload {
        ok,
        exit_code: output.status.code(),
        stdout,
        stderr,
        events,
        final_message,
        final_json,
        warnings,
    })
}

#[cfg(test)]
mod tests {
    use super::{local_codex_command_config_overrides, local_codex_command_environment_overrides};
    use crate::local_codex_exec_path::{
        local_codex_exec_env_lock, resolve_local_codex_exec_binary,
    };
    use std::fs;
    use uuid::Uuid;

    struct TempDir {
        path: std::path::PathBuf,
    }

    impl TempDir {
        fn new(prefix: &str) -> Self {
            let path = std::env::temp_dir().join(format!("{prefix}-{}", Uuid::new_v4()));
            fs::create_dir_all(path.as_path()).expect("create temp dir");
            Self { path }
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(self.path.as_path());
        }
    }

    #[test]
    fn resolve_codex_exec_binary_from_override_works() {
        assert_eq!(resolve_local_codex_exec_binary(Some("codex")), "codex");
        assert_eq!(
            resolve_local_codex_exec_binary(Some("  /usr/local/bin/codex  ")),
            "/usr/local/bin/codex"
        );
    }

    #[test]
    fn local_codex_command_environment_overrides_export_runtime_home_as_codex_home() {
        let _guard = local_codex_exec_env_lock()
            .lock()
            .expect("codex exec env lock poisoned");
        let previous_runtime_home = std::env::var_os("CODE_RUNTIME_LOCAL_CODEX_HOME");
        let previous_codex_home = std::env::var_os("CODEX_HOME");

        unsafe {
            std::env::set_var("CODE_RUNTIME_LOCAL_CODEX_HOME", "/tmp/runtime-codex-home");
            std::env::remove_var("CODEX_HOME");
        }

        let overrides = local_codex_command_environment_overrides();
        assert_eq!(
            overrides,
            vec![("CODEX_HOME", "/tmp/runtime-codex-home".to_string())]
        );

        unsafe {
            match previous_runtime_home {
                Some(value) => std::env::set_var("CODE_RUNTIME_LOCAL_CODEX_HOME", value),
                None => std::env::remove_var("CODE_RUNTIME_LOCAL_CODEX_HOME"),
            }
            match previous_codex_home {
                Some(value) => std::env::set_var("CODEX_HOME", value),
                None => std::env::remove_var("CODEX_HOME"),
            }
        }
    }

    #[test]
    fn local_codex_command_config_overrides_disable_configured_mcp_servers() {
        let _guard = local_codex_exec_env_lock()
            .lock()
            .expect("codex exec env lock poisoned");
        let previous_runtime_home = std::env::var_os("CODE_RUNTIME_LOCAL_CODEX_HOME");
        let previous_codex_home = std::env::var_os("CODEX_HOME");
        let temp_dir = TempDir::new("codex-exec-run-config");
        fs::write(
            temp_dir.path.join("config.toml"),
            r#"
                [mcp_servers.figma]
                command = "npx"

                [mcp_servers.linear]
                command = "npx"

                [features]
                responses_websockets = true
                responses_websockets_v2 = true
            "#,
        )
        .expect("write config");

        unsafe {
            std::env::set_var("CODE_RUNTIME_LOCAL_CODEX_HOME", temp_dir.path.as_os_str());
            std::env::remove_var("CODEX_HOME");
        }

        assert_eq!(
            local_codex_command_config_overrides(None),
            vec![
                "-c".to_string(),
                "mcp_servers.figma.enabled=false".to_string(),
                "-c".to_string(),
                "mcp_servers.linear.enabled=false".to_string(),
                "-c".to_string(),
                "features.shell_snapshot=false".to_string(),
                "-c".to_string(),
                "features.responses_websockets=false".to_string(),
                "-c".to_string(),
                "features.responses_websockets_v2=false".to_string(),
            ]
        );

        unsafe {
            match previous_runtime_home {
                Some(value) => std::env::set_var("CODE_RUNTIME_LOCAL_CODEX_HOME", value),
                None => std::env::remove_var("CODE_RUNTIME_LOCAL_CODEX_HOME"),
            }
            match previous_codex_home {
                Some(value) => std::env::set_var("CODEX_HOME", value),
                None => std::env::remove_var("CODEX_HOME"),
            }
        }
    }
}
