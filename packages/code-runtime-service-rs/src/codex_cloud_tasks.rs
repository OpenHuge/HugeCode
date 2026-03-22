use std::io::ErrorKind;

use serde::Serialize;
use serde_json::Value;

use super::{
    local_codex_cli_sessions::{
        resolve_local_codex_exec_config_overrides, resolve_local_codex_home_dir,
    },
    local_codex_exec_path::{
        format_local_codex_command, new_local_codex_command, resolve_local_codex_exec_binary,
        CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV,
    },
    RpcError,
};

const CODE_RUNTIME_CODEX_CLOUD_TASKS_READ_ENABLED_ENV: &str =
    "CODE_RUNTIME_CODEX_CLOUD_TASKS_READ_ENABLED";

#[derive(Clone, Debug)]
pub(crate) struct CodexCloudTasksListInput {
    pub codex_bin: Option<String>,
    pub cursor: Option<String>,
    pub limit: Option<u64>,
    pub force_refetch: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CodexCloudTaskSummaryPayload {
    pub id: String,
    pub url: Option<String>,
    pub title: Option<String>,
    pub status: String,
    pub updated_at: Option<String>,
    pub environment_id: Option<String>,
    pub environment_label: Option<String>,
    pub summary: Option<String>,
    pub is_review: bool,
    pub attempt_total: Option<u64>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CodexCloudTasksListResponsePayload {
    pub tasks: Vec<CodexCloudTaskSummaryPayload>,
    pub cursor: Option<String>,
    pub warnings: Vec<String>,
}

fn env_flag_enabled(name: &str) -> bool {
    std::env::var(name)
        .ok()
        .map(|value| value.trim().to_ascii_lowercase())
        .is_some_and(|value| matches!(value.as_str(), "1" | "true" | "yes" | "on"))
}

fn local_codex_command_environment_overrides() -> Vec<(&'static str, String)> {
    resolve_local_codex_home_dir()
        .map(|home| vec![("CODEX_HOME", home.to_string_lossy().to_string())])
        .unwrap_or_default()
}

fn local_codex_command_config_overrides() -> Vec<String> {
    resolve_local_codex_exec_config_overrides()
}

fn parse_payload_from_stdout(stdout: &str) -> Option<Value> {
    let trimmed = stdout.trim();
    if trimmed.is_empty() {
        return None;
    }
    if let Ok(parsed) = serde_json::from_str::<Value>(trimmed) {
        return Some(parsed);
    }
    for line in trimmed.lines().rev() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if let Ok(parsed) = serde_json::from_str::<Value>(line) {
            return Some(parsed);
        }
    }
    None
}

fn read_optional_string(object: &serde_json::Map<String, Value>, keys: &[&str]) -> Option<String> {
    for key in keys {
        let Some(value) = object.get(*key) else {
            continue;
        };
        if let Some(text) = value.as_str() {
            let trimmed = text.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }
    None
}

pub(crate) fn codex_cloud_tasks_read_enabled() -> bool {
    env_flag_enabled(CODE_RUNTIME_CODEX_CLOUD_TASKS_READ_ENABLED_ENV)
}

pub(crate) async fn list_codex_cloud_tasks(
    input: CodexCloudTasksListInput,
) -> Result<CodexCloudTasksListResponsePayload, RpcError> {
    let mut warnings = Vec::<String>::new();
    let codex_exec_path = resolve_local_codex_exec_binary(input.codex_bin.as_deref());
    let display_binary = format_local_codex_command(codex_exec_path.as_str());

    let mut command = new_local_codex_command(codex_exec_path.as_str());
    for (key, value) in local_codex_command_environment_overrides() {
        command.env(key, value);
    }
    for argument in local_codex_command_config_overrides() {
        command.arg(argument);
    }
    command.arg("cloud").arg("list").arg("--json");

    if let Some(cursor) = input
        .cursor
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        command.arg("--cursor").arg(cursor);
    }
    if let Some(limit) = input.limit.filter(|value| *value > 0) {
        command.arg("--limit").arg(limit.to_string());
    }
    if input.force_refetch {
        warnings.push(
            "forceRefetch was requested; Codex CLI has no guaranteed force-refetch flag for cloud list, request executed best-effort."
                .to_string(),
        );
    }

    let output = command.output().await.map_err(|error| {
        if error.kind() == ErrorKind::NotFound {
            return RpcError::internal(format!(
                "failed to run `{}` (not found). Install Codex CLI or set {} to a valid executable path.",
                display_binary, CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV
            ));
        }
        RpcError::internal(format!("failed to run `{}`: {error}", display_binary))
    })?;

    if !output.status.success() {
        return Err(RpcError::internal(format!(
            "`codex cloud list --json` failed (status {:?}): {}",
            output.status.code(),
            String::from_utf8_lossy(output.stderr.as_slice()).trim()
        )));
    }

    let stdout = String::from_utf8_lossy(output.stdout.as_slice()).to_string();
    let Some(payload) = parse_payload_from_stdout(stdout.as_str()) else {
        warnings.push("Codex cloud list produced empty output.".to_string());
        return Ok(CodexCloudTasksListResponsePayload {
            tasks: Vec::new(),
            cursor: None,
            warnings,
        });
    };

    let payload_object = payload.as_object().ok_or_else(|| {
        RpcError::internal("`codex cloud list --json` returned a non-object payload.")
    })?;

    let tasks = payload_object
        .get("tasks")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|entry| {
            let object = entry.as_object()?;
            let id = read_optional_string(object, &["id"])?;
            let status =
                read_optional_string(object, &["status"]).unwrap_or_else(|| "unknown".to_string());
            let is_review = object
                .get("is_review")
                .or_else(|| object.get("isReview"))
                .and_then(Value::as_bool)
                .unwrap_or(false);
            let attempt_total = object
                .get("attempt_total")
                .or_else(|| object.get("attemptTotal"))
                .and_then(Value::as_u64);
            Some(CodexCloudTaskSummaryPayload {
                id,
                url: read_optional_string(object, &["url"]),
                title: read_optional_string(object, &["title"]),
                status,
                updated_at: read_optional_string(object, &["updated_at", "updatedAt"]),
                environment_id: read_optional_string(object, &["environment_id", "environmentId"]),
                environment_label: read_optional_string(
                    object,
                    &["environment_label", "environmentLabel"],
                ),
                summary: read_optional_string(object, &["summary"]),
                is_review,
                attempt_total,
            })
        })
        .collect::<Vec<_>>();

    let cursor = read_optional_string(payload_object, &["cursor", "next_cursor", "nextCursor"]);

    Ok(CodexCloudTasksListResponsePayload {
        tasks,
        cursor,
        warnings,
    })
}

#[cfg(test)]
mod tests {
    use super::local_codex_command_config_overrides;
    use crate::local_codex_exec_path::local_codex_exec_env_lock;
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
    fn local_codex_command_config_overrides_disable_configured_mcp_servers() {
        let _guard = local_codex_exec_env_lock()
            .lock()
            .expect("codex cloud tasks env lock poisoned");
        let previous_runtime_home = std::env::var_os("CODE_RUNTIME_LOCAL_CODEX_HOME");
        let previous_codex_home = std::env::var_os("CODEX_HOME");
        let temp_dir = TempDir::new("codex-cloud-tasks-config");
        fs::write(
            temp_dir.path.join("config.toml"),
            r#"
                [mcp_servers.linear]
                command = "npx"

                [mcp_servers.playwright]
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
            local_codex_command_config_overrides(),
            vec![
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
