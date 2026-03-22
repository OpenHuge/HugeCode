use crate::backend::runtime_backend;
use crate::commands::policy::{env_flag_enabled, method_not_found, require_codex_commands_enabled};
use crate::models::WorkspaceSummary;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::ErrorKind;

use super::codex_command_runner::{run_codex_command, run_resolved_codex_command};
use super::codex_probe::{
    collect_codex_probe_candidates, infer_install_source_from_command, infer_update_method,
    resolve_codex_binary, CodexInstallSource, CodexProbeCandidate,
    CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV,
};
use super::local_codex_paths::{
    list_local_codex_mcp_server_status, resolve_local_codex_auth_path,
    resolve_local_codex_browser_debug_config_overrides, resolve_local_codex_config_path,
    resolve_local_codex_exec_config_overrides,
};

const CODE_RUNTIME_CODEX_EXEC_RUN_ENABLED_ENV: &str = "CODE_RUNTIME_CODEX_EXEC_RUN_ENABLED";
const CODE_RUNTIME_CODEX_CLOUD_TASKS_READ_ENABLED_ENV: &str =
    "CODE_RUNTIME_CODEX_CLOUD_TASKS_READ_ENABLED";
const CODE_RUNTIME_CODEX_UNIFIED_RPC_MIGRATION_ENABLED_ENV: &str =
    "CODE_RUNTIME_CODEX_UNIFIED_RPC_MIGRATION_ENABLED";

fn codex_unified_rpc_migration_enabled() -> bool {
    std::env::var(CODE_RUNTIME_CODEX_UNIFIED_RPC_MIGRATION_ENABLED_ENV)
        .ok()
        .map(|value| value.trim().to_ascii_lowercase())
        .is_none_or(|value| !matches!(value.as_str(), "0" | "false" | "no" | "off"))
}

fn codex_exec_command_config_overrides(workspace_path: Option<&str>) -> Vec<String> {
    let mut args = resolve_local_codex_exec_config_overrides();
    args.extend(resolve_local_codex_browser_debug_config_overrides(
        workspace_path,
    ));
    args
}

fn probe_codex_candidate(candidate: CodexProbeCandidate, args: &[String]) -> CodexProbeResult {
    match run_codex_command(candidate.command.as_str(), args) {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(output.stdout.as_slice()).to_string();
            let stderr = String::from_utf8_lossy(output.stderr.as_slice()).to_string();
            let version = if output.status.success() {
                first_non_empty_line(stdout.as_str())
            } else {
                None
            };

            CodexProbeResult {
                candidate,
                ok: output.status.success(),
                version,
                stderr,
            }
        }
        Err(error) => CodexProbeResult {
            candidate,
            ok: false,
            version: None,
            stderr: error,
        },
    }
}

fn format_codex_probe_label(result: &CodexProbeResult) -> String {
    format!(
        "{} ({})",
        result.candidate.command,
        result.candidate.source.label()
    )
}

fn format_codex_failure_summary(result: &CodexProbeResult) -> String {
    let detail = result.stderr.trim();
    if detail.is_empty() {
        format!(
            "Codex CLI probe failed for {}",
            format_codex_probe_label(result)
        )
    } else {
        format!(
            "Codex CLI probe failed for {}: {}",
            format_codex_probe_label(result),
            detail
        )
    }
}

fn first_non_empty_line(value: &str) -> Option<String> {
    value
        .lines()
        .map(str::trim)
        .find(|entry| !entry.is_empty())
        .map(ToOwned::to_owned)
}

fn resolve_registered_workspace_path_from_entries(
    workspace_id: Option<&str>,
    workspaces: &[WorkspaceSummary],
) -> Result<Option<String>, String> {
    let Some(workspace_id) = workspace_id
        .map(str::trim)
        .filter(|value| !value.is_empty())
    else {
        return Ok(None);
    };

    let workspace = workspaces
        .iter()
        .find(|workspace| workspace.id == workspace_id)
        .ok_or_else(|| {
            format!("workspaceId must reference a registered workspace: {workspace_id}")
        })?;
    Ok(Some(workspace.path.clone()))
}

fn resolve_registered_workspace_path(workspace_id: Option<&str>) -> Result<Option<String>, String> {
    let workspaces = runtime_backend().workspaces();
    resolve_registered_workspace_path_from_entries(workspace_id, workspaces.as_slice())
}

#[derive(Clone, Debug)]
struct CodexProbeResult {
    candidate: CodexProbeCandidate,
    ok: bool,
    version: Option<String>,
    stderr: String,
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexExecRunRequest {
    pub workspace_id: Option<String>,
    pub prompt: String,
    pub codex_bin: Option<String>,
    pub codex_args: Option<Vec<String>>,
    pub output_schema: Option<Value>,
    pub approval_policy: Option<String>,
    pub sandbox_mode: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexExecEventEnvelope {
    pub index: usize,
    #[serde(rename = "type")]
    pub event_type: String,
    pub payload: Value,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexExecRunResponse {
    pub ok: bool,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub events: Vec<CodexExecEventEnvelope>,
    pub final_message: Option<String>,
    pub final_json: Option<Value>,
    pub warnings: Vec<String>,
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexCloudTasksListRequest {
    pub codex_bin: Option<String>,
    pub cursor: Option<String>,
    pub limit: Option<u64>,
    pub force_refetch: Option<bool>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexCloudTaskSummary {
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
pub struct CodexCloudTasksListResponse {
    pub tasks: Vec<CodexCloudTaskSummary>,
    pub cursor: Option<String>,
    pub warnings: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexConfigPathResponse {
    pub path: Option<String>,
    pub exists: bool,
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexDoctorRequest {
    pub codex_bin: Option<String>,
    pub codex_args: Option<Vec<String>>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexDoctorResponse {
    pub ok: bool,
    pub codex_bin: Option<String>,
    pub version: Option<String>,
    pub app_server_ok: bool,
    pub details: Option<String>,
    pub path: Option<String>,
    pub node_ok: bool,
    pub node_version: Option<String>,
    pub node_details: Option<String>,
    pub warnings: Vec<String>,
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexUpdateRequest {
    pub codex_bin: Option<String>,
    pub codex_args: Option<Vec<String>>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexUpdateResponse {
    pub ok: bool,
    pub method: String,
    pub package: Option<String>,
    pub before_version: Option<String>,
    pub after_version: Option<String>,
    pub upgraded: bool,
    pub output: Option<String>,
    pub details: Option<String>,
    pub warnings: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollaborationModeMask {
    pub id: String,
    pub label: String,
    pub mode: String,
    pub model: String,
    pub reasoning_effort: Option<String>,
    pub developer_instructions: Option<String>,
    pub value: Value,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollaborationModesListResponse {
    pub data: Vec<CollaborationModeMask>,
    pub warnings: Vec<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppsListRequest {
    pub workspace_id: String,
    pub cursor: Option<String>,
    pub limit: Option<u64>,
    pub thread_id: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub is_accessible: bool,
    pub install_url: Option<String>,
    pub distribution_channel: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppsListResponse {
    pub data: Vec<AppInfo>,
    pub next_cursor: Option<String>,
    pub warnings: Vec<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpServerStatusListRequest {
    pub workspace_id: String,
    pub cursor: Option<String>,
    pub limit: Option<u64>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpServerStatusSummary {
    pub id: Option<String>,
    pub name: String,
    pub status: Option<String>,
    pub auth_status: Option<Value>,
    pub tools: Option<Value>,
    pub resources: Option<Vec<Value>>,
    pub resource_templates: Option<Vec<Value>>,
    pub warnings: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpServerStatusListResponse {
    pub data: Vec<McpServerStatusSummary>,
    pub next_cursor: Option<String>,
    pub warnings: Vec<String>,
}

#[tauri::command]
pub fn code_codex_exec_run_v1(
    payload: CodexExecRunRequest,
) -> Result<CodexExecRunResponse, String> {
    require_codex_commands_enabled("code_codex_exec_run_v1")?;
    if !env_flag_enabled(CODE_RUNTIME_CODEX_EXEC_RUN_ENABLED_ENV) {
        return Err(method_not_found("code_codex_exec_run_v1"));
    }
    if payload.prompt.trim().is_empty() {
        return Err("`prompt` is required for code_codex_exec_run_v1.".to_string());
    }

    let mut args = vec![
        "exec".to_string(),
        "--json".to_string(),
        "--skip-git-repo-check".to_string(),
    ];
    let workspace_path = resolve_registered_workspace_path(payload.workspace_id.as_deref())?;
    args.extend(codex_exec_command_config_overrides(
        workspace_path.as_deref(),
    ));
    if let Some(workspace_path) = workspace_path {
        args.push("-C".to_string());
        args.push(workspace_path);
    }
    if let Some(approval_policy) = payload
        .approval_policy
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        args.push("--approval-policy".to_string());
        args.push(approval_policy.to_string());
    }
    if let Some(sandbox_mode) = payload
        .sandbox_mode
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        args.push("--sandbox".to_string());
        args.push(sandbox_mode.to_string());
    }
    if let Some(schema) = payload.output_schema {
        args.push("--output-schema".to_string());
        args.push(schema.to_string());
    }
    if let Some(extra_args) = payload.codex_args {
        for argument in extra_args {
            let argument = argument.trim();
            if !argument.is_empty() {
                args.push(argument.to_string());
            }
        }
    }
    args.push(payload.prompt);

    let (_selected_candidate, output, fallback_warnings) =
        run_resolved_codex_command(payload.codex_bin.as_deref(), args.as_slice())?;
    let stdout = String::from_utf8_lossy(output.stdout.as_slice()).to_string();
    let stderr = String::from_utf8_lossy(output.stderr.as_slice()).to_string();

    let mut events = Vec::new();
    let mut final_message = None;
    let mut final_json = None;
    let mut warnings = fallback_warnings;
    for (index, line) in stdout.lines().enumerate() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        match serde_json::from_str::<Value>(line) {
            Ok(value) => {
                let event_type = value
                    .as_object()
                    .and_then(|object| object.get("type"))
                    .and_then(Value::as_str)
                    .unwrap_or("unknown")
                    .to_string();
                if final_message.is_none() {
                    final_message = value
                        .as_object()
                        .and_then(|object| object.get("message"))
                        .and_then(Value::as_str)
                        .map(ToOwned::to_owned);
                }
                if final_json.is_none() {
                    final_json = value
                        .as_object()
                        .and_then(|object| object.get("final_json"))
                        .cloned();
                }
                events.push(CodexExecEventEnvelope {
                    index,
                    event_type,
                    payload: value,
                });
            }
            Err(error) => warnings.push(format!(
                "failed to parse codex json event at line {}: {}",
                index + 1,
                error
            )),
        }
    }

    if final_message.is_none() {
        final_message = first_non_empty_line(stdout.as_str());
    }

    Ok(CodexExecRunResponse {
        ok: output.status.success(),
        exit_code: output.status.code(),
        stdout,
        stderr,
        events,
        final_message,
        final_json,
        warnings,
    })
}

#[tauri::command]
pub fn code_codex_cloud_tasks_list_v1(
    payload: Option<CodexCloudTasksListRequest>,
) -> Result<CodexCloudTasksListResponse, String> {
    require_codex_commands_enabled("code_codex_cloud_tasks_list_v1")?;
    if !env_flag_enabled(CODE_RUNTIME_CODEX_CLOUD_TASKS_READ_ENABLED_ENV) {
        return Err(method_not_found("code_codex_cloud_tasks_list_v1"));
    }

    let request = payload.unwrap_or_default();
    let mut args = vec![
        "cloud".to_string(),
        "list".to_string(),
        "--json".to_string(),
    ];
    args.extend(codex_exec_command_config_overrides(None));
    if let Some(cursor) = request
        .cursor
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        args.push("--cursor".to_string());
        args.push(cursor.to_string());
    }
    if let Some(limit) = request.limit.filter(|value| *value > 0) {
        args.push("--limit".to_string());
        args.push(limit.to_string());
    }

    let (_selected_candidate, output, mut warnings) =
        run_resolved_codex_command(request.codex_bin.as_deref(), args.as_slice())?;
    if !output.status.success() {
        return Err(format!(
            "`codex cloud list --json` failed (status {:?}): {}",
            output.status.code(),
            String::from_utf8_lossy(output.stderr.as_slice()).trim()
        ));
    }

    let stdout = String::from_utf8_lossy(output.stdout.as_slice()).to_string();
    let payload_value = serde_json::from_str::<Value>(stdout.trim())
        .or_else(|_| {
            stdout
                .lines()
                .rev()
                .map(str::trim)
                .find(|line| !line.is_empty())
                .ok_or_else(|| serde_json::Error::io(std::io::Error::from(ErrorKind::InvalidData)))
                .and_then(serde_json::from_str)
        })
        .unwrap_or_else(|_| Value::Object(Default::default()));

    let object = payload_value.as_object().cloned().unwrap_or_default();
    let tasks = object
        .get("tasks")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|entry| {
            let object = entry.as_object()?;
            let id = object.get("id")?.as_str()?.to_string();
            let status = object
                .get("status")
                .and_then(Value::as_str)
                .unwrap_or("unknown")
                .to_string();
            Some(CodexCloudTaskSummary {
                id,
                url: object
                    .get("url")
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned),
                title: object
                    .get("title")
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned),
                status,
                updated_at: object
                    .get("updated_at")
                    .or_else(|| object.get("updatedAt"))
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned),
                environment_id: object
                    .get("environment_id")
                    .or_else(|| object.get("environmentId"))
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned),
                environment_label: object
                    .get("environment_label")
                    .or_else(|| object.get("environmentLabel"))
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned),
                summary: object
                    .get("summary")
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned),
                is_review: object
                    .get("is_review")
                    .or_else(|| object.get("isReview"))
                    .and_then(Value::as_bool)
                    .unwrap_or(false),
                attempt_total: object
                    .get("attempt_total")
                    .or_else(|| object.get("attemptTotal"))
                    .and_then(Value::as_u64),
            })
        })
        .collect::<Vec<_>>();

    Ok(CodexCloudTasksListResponse {
        tasks,
        cursor: object
            .get("cursor")
            .or_else(|| object.get("next_cursor"))
            .or_else(|| object.get("nextCursor"))
            .and_then(Value::as_str)
            .map(ToOwned::to_owned),
        warnings: {
            if request.force_refetch.unwrap_or(false) {
                warnings.push("forceRefetch executed as best-effort for cloud list.".to_string());
            }
            warnings
        },
    })
}

#[tauri::command]
pub fn code_codex_config_path_get_v1() -> Result<CodexConfigPathResponse, String> {
    require_codex_commands_enabled("code_codex_config_path_get_v1")?;
    if !codex_unified_rpc_migration_enabled() {
        return Err(method_not_found("code_codex_config_path_get_v1"));
    }

    let path = resolve_local_codex_config_path();
    let exists = path.as_ref().is_some_and(|entry| entry.as_path().exists());
    Ok(CodexConfigPathResponse {
        path: path.map(|entry| entry.to_string_lossy().to_string()),
        exists,
    })
}

#[tauri::command]
pub fn code_codex_doctor_v1(
    payload: Option<CodexDoctorRequest>,
) -> Result<CodexDoctorResponse, String> {
    require_codex_commands_enabled("code_codex_doctor_v1")?;
    if !codex_unified_rpc_migration_enabled() {
        return Err(method_not_found("code_codex_doctor_v1"));
    }

    let payload = payload.unwrap_or_default();
    let _ = resolve_codex_binary(payload.codex_bin.as_deref())?;
    let mut args = payload.codex_args.unwrap_or_default();
    args.push("--version".to_string());
    let probe_results = collect_codex_probe_candidates()
        .into_iter()
        .map(|candidate| probe_codex_candidate(candidate, args.as_slice()))
        .collect::<Vec<_>>();
    let primary_probe = probe_results
        .iter()
        .find(|result| result.ok)
        .cloned()
        .or_else(|| probe_results.first().cloned())
        .unwrap_or_else(|| {
            probe_codex_candidate(
                CodexProbeCandidate {
                    command: "codex".to_string(),
                    source: CodexInstallSource::Path,
                },
                args.as_slice(),
            )
        });

    let node_output = run_codex_command("node", &["--version".to_string()]).ok();
    let node_ok = node_output
        .as_ref()
        .is_some_and(|entry| entry.status.success());
    let node_stdout = node_output
        .as_ref()
        .map(|entry| String::from_utf8_lossy(entry.stdout.as_slice()).to_string())
        .unwrap_or_default();
    let node_stderr = node_output
        .as_ref()
        .map(|entry| String::from_utf8_lossy(entry.stderr.as_slice()).to_string())
        .unwrap_or_else(|| "node executable is not available".to_string());
    let config_path = resolve_local_codex_config_path();
    let auth_path = resolve_local_codex_auth_path();
    let mut warnings = Vec::new();
    if let Some(path) = config_path.as_ref().filter(|entry| !entry.exists()) {
        warnings.push(format!(
            "Codex config.toml was not found at {}.",
            path.to_string_lossy()
        ));
    }
    if let Some(path) = auth_path.as_ref().filter(|entry| !entry.exists()) {
        warnings.push(format!(
            "Codex auth.json was not found at {}.",
            path.to_string_lossy()
        ));
    }

    let mut detail_parts = Vec::new();
    if primary_probe.ok {
        detail_parts.push(format!(
            "Detected Codex CLI at {}",
            format_codex_probe_label(&primary_probe)
        ));
        if let Some(failed_probe) = probe_results.first().filter(|result| {
            !result.ok && result.candidate.command != primary_probe.candidate.command
        }) {
            detail_parts.push(format!(
                "Preferred probe failed before fallback succeeded: {}",
                format_codex_failure_summary(failed_probe)
            ));
        }
    } else {
        detail_parts.push(format_codex_failure_summary(&primary_probe));
    }

    let alternative_installs = probe_results
        .iter()
        .filter(|result| result.ok && result.candidate.command != primary_probe.candidate.command)
        .map(format_codex_probe_label)
        .collect::<Vec<_>>();
    if !alternative_installs.is_empty() {
        detail_parts.push(format!(
            "Other detected installs: {}",
            alternative_installs.join(", ")
        ));
    }
    if !primary_probe.stderr.trim().is_empty() && primary_probe.ok {
        detail_parts.push(primary_probe.stderr.trim().to_string());
    }
    if !node_stderr.trim().is_empty() {
        detail_parts.push(format!("Node: {}", node_stderr.trim()));
    }

    Ok(CodexDoctorResponse {
        ok: primary_probe.ok,
        codex_bin: Some(primary_probe.candidate.command.clone()),
        version: primary_probe.version.clone(),
        app_server_ok: primary_probe.ok,
        details: if detail_parts.is_empty() {
            None
        } else {
            Some(detail_parts.join(" | "))
        },
        path: config_path.map(|entry| entry.to_string_lossy().to_string()),
        node_ok,
        node_version: first_non_empty_line(node_stdout.as_str()),
        node_details: if node_stderr.trim().is_empty() {
            None
        } else {
            Some(node_stderr.trim().to_string())
        },
        warnings: {
            if !primary_probe.ok && probe_results.len() > 1 {
                warnings.push(
                    "Codex CLI was unavailable from the preferred probe target; desktop fallback probes were attempted."
                        .to_string(),
                );
            }
            warnings
        },
    })
}

#[tauri::command]
pub fn code_codex_update_v1(
    payload: Option<CodexUpdateRequest>,
) -> Result<CodexUpdateResponse, String> {
    require_codex_commands_enabled("code_codex_update_v1")?;
    if !codex_unified_rpc_migration_enabled() {
        return Err(method_not_found("code_codex_update_v1"));
    }

    let payload = payload.unwrap_or_default();
    let codex_args = payload.codex_args.unwrap_or_default();
    let explicit_override_enabled = std::env::var(CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV)
        .ok()
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false);

    let mut before_args = codex_args.clone();
    before_args.push("--version".to_string());
    let (selected_candidate, before_output, mut warnings) =
        run_resolved_codex_command(payload.codex_bin.as_deref(), before_args.as_slice())?;
    let codex_bin = selected_candidate.command;
    let install_source =
        infer_install_source_from_command(codex_bin.as_str(), explicit_override_enabled);
    let before_version = if before_output.status.success() {
        first_non_empty_line(String::from_utf8_lossy(before_output.stdout.as_slice()).as_ref())
    } else {
        None
    };

    let mut update_args = codex_args.clone();
    update_args.push("update".to_string());
    let update_output = run_codex_command(codex_bin.as_str(), update_args.as_slice())?;
    let ok = update_output.status.success();
    let stdout = String::from_utf8_lossy(update_output.stdout.as_slice()).to_string();
    let stderr = String::from_utf8_lossy(update_output.stderr.as_slice()).to_string();
    let combined = [stdout.trim(), stderr.trim()]
        .into_iter()
        .filter(|entry| !entry.is_empty())
        .collect::<Vec<_>>()
        .join("\n");

    let mut after_args = codex_args;
    after_args.push("--version".to_string());
    let after_version = run_codex_command(codex_bin.as_str(), after_args.as_slice())
        .ok()
        .and_then(|entry| {
            if entry.status.success() {
                first_non_empty_line(String::from_utf8_lossy(entry.stdout.as_slice()).as_ref())
            } else {
                None
            }
        });

    let upgraded = ok
        && before_version
            .as_deref()
            .zip(after_version.as_deref())
            .is_some_and(|(before, after)| before != after);

    Ok(CodexUpdateResponse {
        ok,
        method: infer_update_method(combined.as_str(), install_source),
        package: Some("codex".to_string()),
        before_version,
        after_version,
        upgraded,
        output: if combined.is_empty() {
            None
        } else {
            Some(combined.clone())
        },
        details: if ok {
            None
        } else if combined.is_empty() {
            Some("codex update failed".to_string())
        } else {
            Some(combined)
        },
        warnings: {
            warnings.shrink_to_fit();
            warnings
        },
    })
}

#[tauri::command]
pub fn code_collaboration_modes_list_v1(
    workspace_id: String,
) -> Result<CollaborationModesListResponse, String> {
    require_codex_commands_enabled("code_collaboration_modes_list_v1")?;
    if !codex_unified_rpc_migration_enabled() {
        return Err(method_not_found("code_collaboration_modes_list_v1"));
    }
    if workspace_id.trim().is_empty() {
        return Err("workspaceId is required".to_string());
    }

    Ok(CollaborationModesListResponse {
        data: vec![
            CollaborationModeMask {
                id: "plan".to_string(),
                label: "Plan".to_string(),
                mode: "plan".to_string(),
                model: "".to_string(),
                reasoning_effort: None,
                developer_instructions: None,
                value: Value::Object(Default::default()),
            },
            CollaborationModeMask {
                id: "default".to_string(),
                label: "Default".to_string(),
                mode: "default".to_string(),
                model: "".to_string(),
                reasoning_effort: None,
                developer_instructions: None,
                value: Value::Object(Default::default()),
            },
        ],
        warnings: vec!["Using built-in collaboration modes from desktop runtime.".to_string()],
    })
}

#[tauri::command]
pub fn code_apps_list_v1(payload: AppsListRequest) -> Result<AppsListResponse, String> {
    require_codex_commands_enabled("code_apps_list_v1")?;
    if !codex_unified_rpc_migration_enabled() {
        return Err(method_not_found("code_apps_list_v1"));
    }
    if payload.workspace_id.trim().is_empty() {
        return Err("workspaceId is required".to_string());
    }
    let _ = payload.cursor;
    let _ = payload.limit;
    let _ = payload.thread_id;

    Ok(AppsListResponse {
        data: Vec::new(),
        next_cursor: None,
        warnings: vec!["Desktop app catalog is unavailable; returning empty data.".to_string()],
    })
}

#[tauri::command]
pub fn code_mcp_server_status_list_v1(
    payload: McpServerStatusListRequest,
) -> Result<McpServerStatusListResponse, String> {
    require_codex_commands_enabled("code_mcp_server_status_list_v1")?;
    if !codex_unified_rpc_migration_enabled() {
        return Err(method_not_found("code_mcp_server_status_list_v1"));
    }
    if payload.workspace_id.trim().is_empty() {
        return Err("workspaceId is required".to_string());
    }
    let _ = payload.cursor;
    let _ = payload.limit;

    let workspace_path = resolve_registered_workspace_path(Some(payload.workspace_id.as_str()))?;
    Ok(McpServerStatusListResponse {
        data: list_local_codex_mcp_server_status(workspace_path.as_deref())
            .into_iter()
            .map(|server| McpServerStatusSummary {
                id: Some(server.id),
                name: server.name,
                status: Some(server.status),
                auth_status: None,
                tools: server.tools,
                resources: None,
                resource_templates: None,
                warnings: server.warnings,
            })
            .collect(),
        next_cursor: None,
        warnings: Vec::new(),
    })
}

#[cfg(test)]
mod tests {
    use super::{
        code_codex_exec_run_v1, code_collaboration_modes_list_v1,
        codex_exec_command_config_overrides, codex_unified_rpc_migration_enabled,
        resolve_registered_workspace_path_from_entries, CodexExecRunRequest,
        CODE_RUNTIME_CODEX_EXEC_RUN_ENABLED_ENV,
        CODE_RUNTIME_CODEX_UNIFIED_RPC_MIGRATION_ENABLED_ENV,
    };
    use crate::commands::codex_probe::resolve_codex_binary;
    use crate::commands::policy::CODE_TAURI_ENABLE_CODEX_COMMANDS_ENV;
    use crate::models::WorkspaceSummary;
    use std::{
        fs,
        sync::Mutex,
        time::{SystemTime, UNIX_EPOCH},
    };

    fn codex_command_env_lock() -> &'static Mutex<()> {
        crate::commands::policy::rpc_policy_env_lock()
    }

    struct TempDir {
        path: std::path::PathBuf,
    }

    impl TempDir {
        fn new(prefix: &str) -> Self {
            let unique = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system time before epoch")
                .as_nanos();
            let path = std::env::temp_dir().join(format!("{prefix}-{unique}"));
            fs::create_dir_all(path.as_path()).expect("create temp dir");
            Self { path }
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(self.path.as_path());
        }
    }

    fn workspace_summary(id: &str, path: &str) -> WorkspaceSummary {
        WorkspaceSummary {
            id: id.to_string(),
            path: path.to_string(),
            display_name: id.to_string(),
            connected: true,
            default_model_id: None,
        }
    }

    #[test]
    fn codex_exec_run_rejects_when_codex_commands_are_disabled() {
        let _guard = codex_command_env_lock()
            .lock()
            .expect("codex command env lock poisoned");
        std::env::remove_var(CODE_TAURI_ENABLE_CODEX_COMMANDS_ENV);
        std::env::set_var(CODE_RUNTIME_CODEX_EXEC_RUN_ENABLED_ENV, "1");

        let error = code_codex_exec_run_v1(CodexExecRunRequest {
            prompt: "hello".to_string(),
            ..CodexExecRunRequest::default()
        })
        .expect_err("codex exec run should be disabled by default");
        assert_eq!(error, "Unsupported RPC method: code_codex_exec_run_v1");
    }

    #[test]
    fn codex_binary_resolution_rejects_renderer_override() {
        let error = resolve_codex_binary(Some("/tmp/custom-codex"))
            .expect_err("renderer-supplied codex binary override should be rejected");
        assert!(
            error.contains("codexBin override is not allowed"),
            "unexpected error: {error}"
        );
    }

    #[test]
    fn codex_workspace_resolution_requires_registered_workspace_ids() {
        let workspaces = vec![workspace_summary("workspace-local", ".")];

        let resolved = resolve_registered_workspace_path_from_entries(
            Some("workspace-local"),
            workspaces.as_slice(),
        )
        .expect("registered workspace should resolve");
        assert_eq!(resolved, Some(".".to_string()));

        let error = resolve_registered_workspace_path_from_entries(
            Some("workspace-missing"),
            workspaces.as_slice(),
        )
        .expect_err("unknown workspace should be rejected");
        assert!(
            error.contains("workspaceId must reference a registered workspace"),
            "unexpected error: {error}"
        );
    }

    #[test]
    fn codex_unified_rpc_migration_defaults_to_enabled() {
        let _guard = codex_command_env_lock()
            .lock()
            .expect("codex command env lock poisoned");
        std::env::remove_var(CODE_RUNTIME_CODEX_UNIFIED_RPC_MIGRATION_ENABLED_ENV);
        assert!(codex_unified_rpc_migration_enabled());

        std::env::set_var(CODE_RUNTIME_CODEX_UNIFIED_RPC_MIGRATION_ENABLED_ENV, "off");
        assert!(!codex_unified_rpc_migration_enabled());
    }

    #[test]
    fn collaboration_modes_builtin_list_includes_plan_and_default() {
        let _guard = codex_command_env_lock()
            .lock()
            .expect("codex command env lock poisoned");
        std::env::set_var(CODE_TAURI_ENABLE_CODEX_COMMANDS_ENV, "1");
        std::env::remove_var(CODE_RUNTIME_CODEX_UNIFIED_RPC_MIGRATION_ENABLED_ENV);

        let response = code_collaboration_modes_list_v1("ws-1".to_string())
            .expect("collaboration modes list should succeed");
        let mode_ids = response
            .data
            .iter()
            .map(|mode| mode.id.as_str())
            .collect::<Vec<_>>();

        assert_eq!(mode_ids, vec!["plan", "default"]);
    }

    #[test]
    fn codex_exec_command_config_overrides_disable_configured_mcp_servers() {
        let _guard = codex_command_env_lock()
            .lock()
            .expect("codex command env lock poisoned");
        let previous_runtime_home = std::env::var_os("CODE_RUNTIME_LOCAL_CODEX_HOME");
        let previous_codex_home = std::env::var_os("CODEX_HOME");
        let temp_dir = TempDir::new("tauri-codex-config");
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

        std::env::set_var("CODE_RUNTIME_LOCAL_CODEX_HOME", temp_dir.path.as_os_str());
        std::env::remove_var("CODEX_HOME");

        assert_eq!(
            codex_exec_command_config_overrides(None),
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
