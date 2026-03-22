use std::collections::BTreeSet;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use serde_json::{json, Value};
use tokio::process::Command;

use super::*;
use crate::local_codex_cli_sessions::{
    list_local_codex_mcp_server_status, resolve_local_codex_config_path,
    resolve_local_codex_home_dir,
};
use crate::local_codex_exec_path::{
    format_local_codex_command, new_local_codex_command, resolve_local_codex_exec_binary,
};

const CODEX_EXEC_RUN_METHOD: &str = "code_codex_exec_run_v1";
const CODEX_CLOUD_TASKS_LIST_METHOD: &str = "code_codex_cloud_tasks_list_v1";
const CODEX_CONFIG_PATH_GET_METHOD: &str = "code_codex_config_path_get_v1";
const CODEX_DOCTOR_METHOD: &str = "code_codex_doctor_v1";
const CODEX_UPDATE_METHOD: &str = "code_codex_update_v1";
const COLLABORATION_MODES_LIST_METHOD: &str = "code_collaboration_modes_list_v1";
const APPS_LIST_METHOD: &str = "code_apps_list_v1";
const MCP_SERVER_STATUS_LIST_METHOD: &str = "code_mcp_server_status_list_v1";

const CODE_RUNTIME_CODEX_UNIFIED_RPC_MIGRATION_ENABLED_ENV: &str =
    "CODE_RUNTIME_CODEX_UNIFIED_RPC_MIGRATION_ENABLED";

fn codex_unified_rpc_migration_enabled() -> bool {
    std::env::var(CODE_RUNTIME_CODEX_UNIFIED_RPC_MIGRATION_ENABLED_ENV)
        .ok()
        .map(|value| value.trim().to_ascii_lowercase())
        .is_none_or(|value| !matches!(value.as_str(), "0" | "false" | "no" | "off"))
}

fn method_not_enabled(method: &str) -> RpcError {
    RpcError::method_not_found(method)
}

fn local_codex_command_environment_overrides() -> Vec<(&'static str, String)> {
    resolve_local_codex_home_dir()
        .map(|home| vec![("CODEX_HOME", home.to_string_lossy().to_string())])
        .unwrap_or_default()
}

fn read_optional_string_array(params: &serde_json::Map<String, Value>, key: &str) -> Vec<String> {
    params
        .get(key)
        .and_then(Value::as_array)
        .map(|entries| {
            entries
                .iter()
                .filter_map(Value::as_str)
                .map(str::trim)
                .filter(|entry| !entry.is_empty())
                .map(ToOwned::to_owned)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

async fn resolve_workspace_path(ctx: &AppContext, workspace_id: Option<&str>) -> Option<String> {
    let workspace_id = workspace_id?.trim();
    if workspace_id.is_empty() {
        return None;
    }
    let state = ctx.state.read().await;
    state
        .workspaces
        .iter()
        .find(|workspace| workspace.id == workspace_id)
        .map(|workspace| workspace.path.clone())
}

fn codex_event_to_turn_event_kind(event_type: &str) -> Option<&'static str> {
    match event_type {
        "turn.started" => Some(TURN_EVENT_STARTED),
        "turn.completed" => Some(TURN_EVENT_COMPLETED),
        "turn.failed" => Some(TURN_EVENT_FAILED),
        "item.started" | "item.updated" | "item.completed" => Some(TURN_EVENT_ITEM_UPDATED),
        _ => None,
    }
}

pub(super) async fn handle_codex_rpc_method(
    method: &str,
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    match method {
        "code_codex_exec_run_v1" => handle_codex_exec_run_v1(ctx, params).await,
        "code_codex_cloud_tasks_list_v1" => handle_codex_cloud_tasks_list_v1(ctx, params).await,
        "code_codex_config_path_get_v1" => handle_codex_config_path_get_v1(ctx, params).await,
        "code_codex_doctor_v1" => handle_codex_doctor_v1(ctx, params).await,
        "code_codex_update_v1" => handle_codex_update_v1(ctx, params).await,
        "code_collaboration_modes_list_v1" => handle_collaboration_modes_list_v1(ctx, params).await,
        "code_apps_list_v1" => handle_apps_list_v1(ctx, params).await,
        "code_mcp_server_status_list_v1" => handle_mcp_server_status_list_v1(ctx, params).await,
        _ => Err(RpcError::method_not_found(method)),
    }
}

pub(super) async fn handle_codex_exec_run_v1(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    if !codex_exec_run::codex_exec_run_enabled() {
        return Err(method_not_enabled(CODEX_EXEC_RUN_METHOD));
    }

    let params = as_object(params)?;
    let prompt = read_required_string(params, "prompt")?.to_string();
    let workspace_id = read_optional_string(params, "workspaceId")
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);
    let workspace_path = resolve_workspace_path(ctx, workspace_id.as_deref()).await;

    let response = codex_exec_run::run_codex_exec_jsonl(codex_exec_run::CodexExecRunInput {
        workspace_path,
        prompt,
        codex_bin: read_optional_string(params, "codexBin"),
        codex_args: read_optional_string_array(params, "codexArgs"),
        output_schema: params.get("outputSchema").cloned(),
        approval_policy: read_optional_string(params, "approvalPolicy"),
        sandbox_mode: read_optional_string(params, "sandboxMode"),
    })
    .await?;

    for event in &response.events {
        let Some(kind) = codex_event_to_turn_event_kind(event.event_type.as_str()) else {
            continue;
        };
        publish_turn_event(
            ctx,
            kind,
            json!({
                "source": "codex.exec",
                "eventType": event.event_type,
                "index": event.index,
                "payload": event.payload,
                "workspaceId": workspace_id,
                "at": now_ms(),
            }),
            None,
        );
    }

    Ok(json!(response))
}

pub(super) async fn handle_codex_cloud_tasks_list_v1(
    _ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    if !codex_cloud_tasks::codex_cloud_tasks_read_enabled() {
        return Err(method_not_enabled(CODEX_CLOUD_TASKS_LIST_METHOD));
    }

    let params = as_object(params)?;
    let response =
        codex_cloud_tasks::list_codex_cloud_tasks(codex_cloud_tasks::CodexCloudTasksListInput {
            codex_bin: read_optional_string(params, "codexBin"),
            cursor: read_optional_string(params, "cursor"),
            limit: read_optional_u64(params, "limit"),
            force_refetch: read_optional_bool(params, "forceRefetch").unwrap_or(false),
        })
        .await?;

    Ok(json!(response))
}

pub(super) async fn handle_codex_config_path_get_v1(
    _ctx: &AppContext,
    _params: &Value,
) -> Result<Value, RpcError> {
    if !codex_unified_rpc_migration_enabled() {
        return Err(method_not_enabled(CODEX_CONFIG_PATH_GET_METHOD));
    }

    let path = resolve_local_codex_config_path();
    let exists = path.as_ref().is_some_and(|entry| entry.as_path().exists());
    Ok(json!({
        "path": path.map(|entry| entry.to_string_lossy().to_string()),
        "exists": exists,
    }))
}

async fn run_process(
    binary: &str,
    args: &[String],
) -> Result<(bool, Option<i32>, String, String), RpcError> {
    let mut command = Command::new(binary);
    for (key, value) in local_codex_command_environment_overrides() {
        command.env(key, value);
    }
    for arg in args {
        command.arg(arg);
    }
    let output = command.output().await.map_err(|error| {
        if error.kind() == ErrorKind::NotFound {
            return RpcError::internal(format!("failed to run `{binary}` (not found)."));
        }
        RpcError::internal(format!("failed to run `{binary}`: {error}"))
    })?;
    Ok((
        output.status.success(),
        output.status.code(),
        String::from_utf8_lossy(output.stdout.as_slice()).to_string(),
        String::from_utf8_lossy(output.stderr.as_slice()).to_string(),
    ))
}

async fn run_codex_process(
    binary: &str,
    args: &[String],
) -> Result<(bool, Option<i32>, String, String), RpcError> {
    let display_binary = format_local_codex_command(binary);
    let mut command = new_local_codex_command(binary);
    for (key, value) in local_codex_command_environment_overrides() {
        command.env(key, value);
    }
    for arg in args {
        command.arg(arg);
    }
    let output = command.output().await.map_err(|error| {
        if error.kind() == ErrorKind::NotFound {
            return RpcError::internal(format!("failed to run `{display_binary}` (not found)."));
        }
        RpcError::internal(format!("failed to run `{display_binary}`: {error}"))
    })?;
    Ok((
        output.status.success(),
        output.status.code(),
        String::from_utf8_lossy(output.stdout.as_slice()).to_string(),
        String::from_utf8_lossy(output.stderr.as_slice()).to_string(),
    ))
}

fn first_non_empty_line(value: &str) -> Option<String> {
    value
        .lines()
        .map(str::trim)
        .find(|entry| !entry.is_empty())
        .map(ToOwned::to_owned)
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum CodexInstallSource {
    Explicit,
    Path,
    NpmGlobal,
    Homebrew,
    Standalone,
}

impl CodexInstallSource {
    fn label(self) -> &'static str {
        match self {
            Self::Explicit => "explicit override",
            Self::Path => "PATH",
            Self::NpmGlobal => "npm global install",
            Self::Homebrew => "Homebrew install",
            Self::Standalone => "standalone path",
        }
    }
}

#[derive(Clone, Debug)]
struct CodexProbeCandidate {
    command: String,
    source: CodexInstallSource,
}

#[derive(Clone, Debug)]
struct CodexProbeResult {
    candidate: CodexProbeCandidate,
    ok: bool,
    version: Option<String>,
    stdout: String,
    stderr: String,
    resolved_path: Option<String>,
    resolved_source: CodexInstallSource,
}

fn infer_install_source_from_path(path: &str) -> CodexInstallSource {
    let normalized = path.trim().replace('\\', "/").to_ascii_lowercase();
    if normalized.contains("/appdata/roaming/npm/")
        || normalized.ends_with("/npm/codex")
        || normalized.ends_with("/npm/codex.cmd")
        || normalized.ends_with("/npm/codex.ps1")
    {
        return CodexInstallSource::NpmGlobal;
    }
    if normalized.starts_with("/opt/homebrew/")
        || normalized.starts_with("/usr/local/homebrew/")
        || normalized.starts_with("/home/linuxbrew/.linuxbrew/")
        || normalized.contains("/cellar/")
    {
        return CodexInstallSource::Homebrew;
    }
    CodexInstallSource::Standalone
}

fn codex_executable_file_name() -> &'static str {
    if cfg!(windows) {
        "codex.cmd"
    } else {
        "codex"
    }
}

fn push_candidate(
    candidates: &mut Vec<CodexProbeCandidate>,
    seen: &mut BTreeSet<String>,
    command: String,
    source: CodexInstallSource,
) {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return;
    }
    let dedupe_key = trimmed.replace('\\', "/").to_ascii_lowercase();
    if !seen.insert(dedupe_key) {
        return;
    }
    candidates.push(CodexProbeCandidate {
        command: trimmed.to_string(),
        source,
    });
}

fn add_existing_candidate(
    candidates: &mut Vec<CodexProbeCandidate>,
    seen: &mut BTreeSet<String>,
    path: PathBuf,
    source: CodexInstallSource,
) {
    if !path.is_file() {
        return;
    }
    push_candidate(candidates, seen, path.to_string_lossy().to_string(), source);
}

async fn detect_npm_global_codex_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    let executable_name = codex_executable_file_name();

    if cfg!(windows) {
        if let Some(app_data) = std::env::var_os("APPDATA") {
            candidates.push(PathBuf::from(app_data).join("npm").join(executable_name));
        }
    }

    let args = vec![
        "config".to_string(),
        "get".to_string(),
        "prefix".to_string(),
    ];
    let Ok((ok, _, stdout, _)) = run_process("npm", args.as_slice()).await else {
        return candidates;
    };
    if !ok {
        return candidates;
    }

    let Some(prefix_line) = first_non_empty_line(stdout.as_str()) else {
        return candidates;
    };
    let prefix = PathBuf::from(prefix_line.trim());
    if cfg!(windows) {
        candidates.push(prefix.join(executable_name));
    } else {
        candidates.push(prefix.join("bin").join(executable_name));
    }
    candidates
}

async fn detect_homebrew_codex_candidates() -> Vec<PathBuf> {
    let mut candidates = vec![
        PathBuf::from("/opt/homebrew/bin").join(codex_executable_file_name()),
        PathBuf::from("/usr/local/bin").join(codex_executable_file_name()),
        PathBuf::from("/home/linuxbrew/.linuxbrew/bin").join(codex_executable_file_name()),
    ];

    if cfg!(windows) {
        return candidates;
    }

    let args = vec!["--prefix".to_string()];
    let Ok((ok, _, stdout, _)) = run_process("brew", args.as_slice()).await else {
        return candidates;
    };
    if !ok {
        return candidates;
    }
    if let Some(prefix_line) = first_non_empty_line(stdout.as_str()) {
        candidates.push(
            PathBuf::from(prefix_line.trim())
                .join("bin")
                .join(codex_executable_file_name()),
        );
    }
    candidates
}

async fn collect_codex_install_hints() -> Vec<CodexProbeCandidate> {
    let mut candidates = Vec::new();
    let mut seen = BTreeSet::new();

    for path in detect_npm_global_codex_candidates().await {
        add_existing_candidate(
            &mut candidates,
            &mut seen,
            path,
            CodexInstallSource::NpmGlobal,
        );
    }
    for path in detect_homebrew_codex_candidates().await {
        add_existing_candidate(
            &mut candidates,
            &mut seen,
            path,
            CodexInstallSource::Homebrew,
        );
    }

    candidates
}

async fn resolve_command_path(command: &str) -> Option<String> {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return None;
    }
    let path = Path::new(trimmed);
    if path.components().count() > 1 || path.is_absolute() {
        return path.is_file().then(|| path.to_string_lossy().to_string());
    }

    let args = vec![trimmed.to_string()];
    if cfg!(windows) {
        let Ok((ok, _, stdout, _)) = run_process("where", args.as_slice()).await else {
            return None;
        };
        if !ok {
            return None;
        }
        return first_non_empty_line(stdout.as_str());
    }

    let Ok((ok, _, stdout, _)) = run_process("which", args.as_slice()).await else {
        return None;
    };
    if !ok {
        return None;
    }
    first_non_empty_line(stdout.as_str())
}

async fn probe_codex_candidate(
    candidate: CodexProbeCandidate,
    codex_args: &[String],
) -> CodexProbeResult {
    let mut args = codex_args.to_vec();
    args.push("--version".to_string());

    let resolved_path = resolve_command_path(candidate.command.as_str()).await;
    let resolved_source = resolved_path
        .as_deref()
        .map(infer_install_source_from_path)
        .unwrap_or(candidate.source);

    match run_codex_process(candidate.command.as_str(), args.as_slice()).await {
        Ok((ok, _, stdout, stderr)) => {
            let version = if ok {
                first_non_empty_line(stdout.as_str())
            } else {
                None
            };
            CodexProbeResult {
                candidate,
                ok: ok && version.is_some(),
                version,
                stdout,
                stderr,
                resolved_path,
                resolved_source,
            }
        }
        Err(error) => CodexProbeResult {
            candidate,
            ok: false,
            version: None,
            stdout: String::new(),
            stderr: error.message,
            resolved_path,
            resolved_source,
        },
    }
}

fn default_codex_probe_candidate(requested_codex_bin: Option<&str>) -> CodexProbeCandidate {
    if let Some(command) = requested_codex_bin
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        if command.eq_ignore_ascii_case("codex") {
            let resolved = resolve_local_codex_exec_binary(Some(command));
            let source = if resolved == "codex" {
                CodexInstallSource::Path
            } else {
                infer_install_source_from_path(resolved.as_str())
            };
            return CodexProbeCandidate {
                command: resolved,
                source,
            };
        }
        return CodexProbeCandidate {
            command: command.to_string(),
            source: CodexInstallSource::Explicit,
        };
    }

    let command = resolve_local_codex_exec_binary(None);
    let source = if command == "codex" {
        CodexInstallSource::Path
    } else {
        infer_install_source_from_path(command.as_str())
    };
    CodexProbeCandidate { command, source }
}

async fn probe_codex_install_hints(candidates: Vec<CodexProbeCandidate>) -> Vec<CodexProbeResult> {
    let mut matches = Vec::new();
    for candidate in candidates {
        let result = probe_codex_candidate(candidate, &[]).await;
        if result.ok {
            matches.push(result);
        }
    }
    matches
}

fn normalize_probe_identity(result: &CodexProbeResult) -> String {
    result
        .resolved_path
        .as_deref()
        .unwrap_or(result.candidate.command.as_str())
        .replace('\\', "/")
        .to_ascii_lowercase()
}

fn select_effective_codex_probe(
    primary_probe: &CodexProbeResult,
    alternative_installs: &[CodexProbeResult],
    explicit_override_requested: bool,
) -> CodexProbeResult {
    if primary_probe.ok || explicit_override_requested {
        return primary_probe.clone();
    }
    alternative_installs
        .first()
        .cloned()
        .unwrap_or_else(|| primary_probe.clone())
}

fn format_codex_probe_label(result: &CodexProbeResult) -> String {
    let path = result
        .resolved_path
        .as_deref()
        .unwrap_or(result.candidate.command.as_str());
    format!("{path} ({})", result.resolved_source.label())
}

fn format_codex_failure_summary(result: &CodexProbeResult) -> String {
    let stderr = first_non_empty_line(result.stderr.as_str())
        .or_else(|| first_non_empty_line(result.stdout.as_str()))
        .unwrap_or_else(|| "probe failed without output".to_string());
    format!("{} failed: {}", result.candidate.command, stderr)
}

fn infer_update_method(output: &str, resolved_source: CodexInstallSource) -> &'static str {
    match resolved_source {
        CodexInstallSource::NpmGlobal => return "npm",
        CodexInstallSource::Homebrew => return "brew_formula",
        CodexInstallSource::Explicit
        | CodexInstallSource::Path
        | CodexInstallSource::Standalone => {}
    }

    let normalized = output.to_ascii_lowercase();
    if normalized.contains("brew") && normalized.contains("cask") {
        return "brew_cask";
    }
    if normalized.contains("brew") {
        return "brew_formula";
    }
    if normalized.contains("npm") {
        return "npm";
    }
    "unknown"
}

pub(super) async fn handle_codex_doctor_v1(
    _ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    if !codex_unified_rpc_migration_enabled() {
        return Err(method_not_enabled(CODEX_DOCTOR_METHOD));
    }

    let params = as_object(params)?;
    let requested_codex_bin = read_optional_string(params, "codexBin")
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);
    let codex_args = read_optional_string_array(params, "codexArgs");

    let primary_candidate = default_codex_probe_candidate(requested_codex_bin.as_deref());
    let primary_probe = probe_codex_candidate(primary_candidate, codex_args.as_slice()).await;

    let hinted_installs = probe_codex_install_hints(collect_codex_install_hints().await).await;
    let alternative_installs = hinted_installs
        .into_iter()
        .filter(|result| {
            normalize_probe_identity(result) != normalize_probe_identity(&primary_probe)
        })
        .collect::<Vec<_>>();
    let effective_probe = select_effective_codex_probe(
        &primary_probe,
        alternative_installs.as_slice(),
        requested_codex_bin.is_some(),
    );

    let (node_ok, _, node_stdout, node_stderr) = run_process("node", &["--version".to_string()])
        .await
        .unwrap_or((
            false,
            None,
            String::new(),
            "node executable is not available".to_string(),
        ));

    let config_path = resolve_local_codex_config_path();
    let mut detail_parts = Vec::<String>::new();

    if effective_probe.ok {
        detail_parts.push(format!(
            "Detected Codex CLI at {}",
            format_codex_probe_label(&effective_probe)
        ));
        if !primary_probe.ok && effective_probe.candidate.command != primary_probe.candidate.command
        {
            detail_parts.push(format!(
                "Preferred probe failed before fallback succeeded: {}",
                format_codex_failure_summary(&primary_probe)
            ));
        }
    } else {
        detail_parts.push(format_codex_failure_summary(&primary_probe));
        if !alternative_installs.is_empty() {
            let detected = alternative_installs
                .iter()
                .map(format_codex_probe_label)
                .collect::<Vec<_>>()
                .join(", ");
            if requested_codex_bin.is_some() {
                detail_parts.push(format!(
                    "Other detected installs: {detected}. Update Default Codex path to one of these locations."
                ));
            } else {
                detail_parts.push(format!(
                    "Codex CLI was also detected outside PATH: {detected}. Set Default Codex path to use one of these installs."
                ));
            }
        }
    }

    if let Some(config_path) = config_path.as_ref() {
        detail_parts.push(format!("Config: {}", config_path.to_string_lossy()));
    }

    if !node_stderr.trim().is_empty() {
        detail_parts.push(format!("Node: {}", node_stderr.trim()));
    }
    let warnings = config_path
        .as_ref()
        .filter(|entry| !entry.exists())
        .map(|path| {
            vec![format!(
                "Codex config.toml was not found at {}.",
                path.to_string_lossy()
            )]
        })
        .unwrap_or_default();

    Ok(json!({
        "ok": effective_probe.ok,
        "codexBin": effective_probe.candidate.command,
        "version": effective_probe.version,
        "appServerOk": effective_probe.ok,
        "details": if detail_parts.is_empty() { Value::Null } else { Value::String(detail_parts.join(" | ")) },
        "path": config_path.map(|entry| entry.to_string_lossy().to_string()),
        "nodeOk": node_ok,
        "nodeVersion": first_non_empty_line(node_stdout.as_str()),
        "nodeDetails": if node_stderr.trim().is_empty() { Value::Null } else { Value::String(node_stderr.trim().to_string()) },
        "warnings": warnings,
    }))
}

pub(super) async fn handle_codex_update_v1(
    _ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    if !codex_unified_rpc_migration_enabled() {
        return Err(method_not_enabled(CODEX_UPDATE_METHOD));
    }

    let params = as_object(params)?;
    let requested_codex_bin = read_optional_string(params, "codexBin")
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);
    let codex_args = read_optional_string_array(params, "codexArgs");
    let primary_candidate = default_codex_probe_candidate(requested_codex_bin.as_deref());
    let primary_probe = probe_codex_candidate(primary_candidate, codex_args.as_slice()).await;
    let hinted_installs = probe_codex_install_hints(collect_codex_install_hints().await).await;
    let alternative_installs = hinted_installs
        .into_iter()
        .filter(|result| {
            normalize_probe_identity(result) != normalize_probe_identity(&primary_probe)
        })
        .collect::<Vec<_>>();
    let effective_probe = select_effective_codex_probe(
        &primary_probe,
        alternative_installs.as_slice(),
        requested_codex_bin.is_some(),
    );
    if !effective_probe.ok {
        let alternative_summary = alternative_installs
            .iter()
            .map(|result| format_codex_probe_label(&result))
            .collect::<Vec<_>>();
        let mut details = vec![format_codex_failure_summary(&primary_probe)];
        if !alternative_summary.is_empty() {
            details.push(format!(
                "Detected installs: {}. Set Default Codex path before retrying update.",
                alternative_summary.join(", ")
            ));
        }
        return Ok(json!({
            "ok": false,
            "method": "unknown",
            "package": "codex",
            "beforeVersion": Value::Null,
            "afterVersion": Value::Null,
            "upgraded": false,
            "output": Value::Null,
            "details": details.join(" | "),
            "warnings": [],
        }));
    }

    let before_version = effective_probe.version.clone();
    let mut update_args = codex_args.clone();
    update_args.push("update".to_string());
    let (ok, _exit_code, stdout, stderr) = run_codex_process(
        effective_probe.candidate.command.as_str(),
        update_args.as_slice(),
    )
    .await?;
    let after_probe =
        probe_codex_candidate(effective_probe.candidate.clone(), codex_args.as_slice()).await;
    let after_version = after_probe.version.clone();

    let combined_output = [stdout.trim(), stderr.trim()]
        .into_iter()
        .filter(|entry| !entry.is_empty())
        .collect::<Vec<_>>()
        .join("\n");
    let method = infer_update_method(combined_output.as_str(), effective_probe.resolved_source);
    let upgraded = ok
        && before_version
            .as_deref()
            .zip(after_version.as_deref())
            .is_some_and(|(before, after)| before != after);

    let details = if ok {
        Value::Null
    } else {
        Value::String(format!(
            "{} | {}",
            format_codex_probe_label(&effective_probe),
            combined_output
        ))
    };

    Ok(json!({
        "ok": ok,
        "method": method,
        "package": "codex",
        "beforeVersion": before_version,
        "afterVersion": after_version,
        "upgraded": upgraded,
        "output": if combined_output.is_empty() { Value::Null } else { Value::String(combined_output.clone()) },
        "details": details,
        "warnings": [],
    }))
}

pub(super) async fn handle_collaboration_modes_list_v1(
    _ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    if !codex_unified_rpc_migration_enabled() {
        return Err(method_not_enabled(COLLABORATION_MODES_LIST_METHOD));
    }

    let params = as_object(params)?;
    let _workspace_id = read_required_string(params, "workspaceId")?;

    Ok(built_in_collaboration_modes_list_response())
}

fn built_in_collaboration_modes_list_response() -> Value {
    json!({
        "data": [
            {
                "id": "plan",
                "label": "Plan",
                "mode": "plan",
                "model": "",
                "reasoningEffort": Value::Null,
                "developerInstructions": Value::Null,
                "value": {},
            },
            {
                "id": "default",
                "label": "Default",
                "mode": "default",
                "model": "",
                "reasoningEffort": Value::Null,
                "developerInstructions": Value::Null,
                "value": {},
            }
        ],
        "warnings": ["Using built-in collaboration mode defaults from runtime service."],
    })
}

pub(super) async fn handle_apps_list_v1(
    _ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    if !codex_unified_rpc_migration_enabled() {
        return Err(method_not_enabled(APPS_LIST_METHOD));
    }

    let params = as_object(params)?;
    let _workspace_id = read_required_string(params, "workspaceId")?;

    Ok(json!({
        "data": [],
        "nextCursor": Value::Null,
        "warnings": ["Runtime service app catalog is not configured; returning an empty list."],
    }))
}

pub(super) async fn handle_mcp_server_status_list_v1(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    if !codex_unified_rpc_migration_enabled() {
        return Err(method_not_enabled(MCP_SERVER_STATUS_LIST_METHOD));
    }

    let params = as_object(params)?;
    let workspace_id = read_required_string(params, "workspaceId")?;
    let workspace_path = resolve_workspace_path(ctx, Some(workspace_id)).await;
    let servers = list_local_codex_mcp_server_status(workspace_path.as_deref())
        .into_iter()
        .map(|server| {
            json!({
                "id": server.id,
                "name": server.name,
                "status": server.status,
                "authStatus": Value::Null,
                "tools": server.tools,
                "resources": Value::Null,
                "resourceTemplates": Value::Null,
                "warnings": server.warnings,
            })
        })
        .collect::<Vec<_>>();

    Ok(json!({
        "data": servers,
        "nextCursor": Value::Null,
        "warnings": [],
    }))
}

#[cfg(test)]
mod tests {
    use super::{
        built_in_collaboration_modes_list_response, codex_unified_rpc_migration_enabled,
        default_codex_probe_candidate, infer_install_source_from_path, infer_update_method,
        select_effective_codex_probe, CodexInstallSource, CodexProbeCandidate, CodexProbeResult,
        CODE_RUNTIME_CODEX_UNIFIED_RPC_MIGRATION_ENABLED_ENV,
    };
    use crate::local_codex_exec_path::{
        local_codex_exec_env_lock, reset_local_codex_exec_binary_cache,
        CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV,
    };
    use std::sync::{Mutex, OnceLock};

    fn codex_rpc_env_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    #[test]
    fn infer_install_source_detects_npm_global_windows_shim() {
        assert_eq!(
            infer_install_source_from_path(r"C:\Users\alice\AppData\Roaming\npm\codex.cmd"),
            CodexInstallSource::NpmGlobal
        );
    }

    #[test]
    fn infer_install_source_detects_homebrew_locations() {
        assert_eq!(
            infer_install_source_from_path("/opt/homebrew/bin/codex"),
            CodexInstallSource::Homebrew
        );
        assert_eq!(
            infer_install_source_from_path("/home/linuxbrew/.linuxbrew/bin/codex"),
            CodexInstallSource::Homebrew
        );
    }

    #[test]
    fn infer_update_method_prefers_resolved_install_source() {
        assert_eq!(
            infer_update_method("", CodexInstallSource::NpmGlobal),
            "npm"
        );
        assert_eq!(
            infer_update_method("", CodexInstallSource::Homebrew),
            "brew_formula"
        );
        assert_eq!(
            infer_update_method("updated with npm", CodexInstallSource::Standalone),
            "npm"
        );
    }

    #[test]
    fn default_codex_probe_candidate_prefers_runtime_resolved_binary() {
        let _guard = local_codex_exec_env_lock()
            .lock()
            .expect("local codex exec path env lock poisoned");
        let previous_override = std::env::var_os(CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV);

        unsafe {
            std::env::set_var(
                CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV,
                r"C:\Users\alice\AppData\Roaming\npm\codex.cmd",
            );
        }
        reset_local_codex_exec_binary_cache();

        let candidate = default_codex_probe_candidate(None);
        assert_eq!(
            candidate.command,
            r"C:\Users\alice\AppData\Roaming\npm\codex.cmd"
        );
        assert_eq!(candidate.source, CodexInstallSource::NpmGlobal);

        unsafe {
            match previous_override {
                Some(value) => std::env::set_var(CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV, value),
                None => std::env::remove_var(CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV),
            }
        }
        reset_local_codex_exec_binary_cache();
    }

    #[test]
    fn default_codex_probe_candidate_respects_explicit_override() {
        let candidate = default_codex_probe_candidate(Some(r"C:\tools\codex.exe"));
        assert_eq!(candidate.command, r"C:\tools\codex.exe");
        assert_eq!(candidate.source, CodexInstallSource::Explicit);
    }

    #[test]
    fn default_codex_probe_candidate_treats_bare_codex_override_as_runtime_resolved_binary() {
        let _guard = local_codex_exec_env_lock()
            .lock()
            .expect("local codex exec path env lock poisoned");
        let previous_override = std::env::var_os(CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV);

        unsafe {
            std::env::set_var(
                CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV,
                r"C:\Users\alice\AppData\Roaming\npm\codex.cmd",
            );
        }
        reset_local_codex_exec_binary_cache();

        let candidate = default_codex_probe_candidate(Some("codex"));
        assert_eq!(
            candidate.command,
            r"C:\Users\alice\AppData\Roaming\npm\codex.cmd"
        );
        assert_eq!(candidate.source, CodexInstallSource::NpmGlobal);

        unsafe {
            match previous_override {
                Some(value) => std::env::set_var(CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV, value),
                None => std::env::remove_var(CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV),
            }
        }
        reset_local_codex_exec_binary_cache();
    }

    #[test]
    fn codex_unified_rpc_migration_defaults_to_enabled() {
        let _guard = codex_rpc_env_lock()
            .lock()
            .expect("codex rpc env lock poisoned");
        std::env::remove_var(CODE_RUNTIME_CODEX_UNIFIED_RPC_MIGRATION_ENABLED_ENV);
        assert!(codex_unified_rpc_migration_enabled());

        std::env::set_var(CODE_RUNTIME_CODEX_UNIFIED_RPC_MIGRATION_ENABLED_ENV, "0");
        assert!(!codex_unified_rpc_migration_enabled());
    }

    #[tokio::test]
    async fn collaboration_modes_builtin_list_includes_plan_and_default() {
        let _guard = codex_rpc_env_lock()
            .lock()
            .expect("codex rpc env lock poisoned");
        let response = built_in_collaboration_modes_list_response();

        let modes = response
            .get("data")
            .and_then(|value| value.as_array())
            .expect("data array");
        let mode_ids = modes
            .iter()
            .filter_map(|mode| mode.get("id").and_then(|value| value.as_str()))
            .collect::<Vec<_>>();

        assert_eq!(mode_ids, vec!["plan", "default"]);
    }

    fn probe_result(command: &str, ok: bool, resolved_path: Option<&str>) -> CodexProbeResult {
        CodexProbeResult {
            candidate: CodexProbeCandidate {
                command: command.to_string(),
                source: CodexInstallSource::Path,
            },
            ok,
            version: ok.then(|| "codex-cli 0.113.0".to_string()),
            stdout: String::new(),
            stderr: String::new(),
            resolved_path: resolved_path.map(ToOwned::to_owned),
            resolved_source: if ok {
                CodexInstallSource::NpmGlobal
            } else {
                CodexInstallSource::Path
            },
        }
    }

    #[test]
    fn select_effective_codex_probe_prefers_detected_install_when_unconfigured() {
        let primary = probe_result("codex", false, None);
        let fallback = probe_result(
            r"C:\Users\alice\AppData\Roaming\npm\codex.cmd",
            true,
            Some(r"C:\Users\alice\AppData\Roaming\npm\codex.cmd"),
        );

        let selected =
            select_effective_codex_probe(&primary, std::slice::from_ref(&fallback), false);

        assert!(selected.ok);
        assert_eq!(selected.candidate.command, fallback.candidate.command);
    }

    #[test]
    fn select_effective_codex_probe_respects_explicit_override_failures() {
        let primary = probe_result(r"C:\custom\codex.cmd", false, Some(r"C:\custom\codex.cmd"));
        let fallback = probe_result(
            r"C:\Users\alice\AppData\Roaming\npm\codex.cmd",
            true,
            Some(r"C:\Users\alice\AppData\Roaming\npm\codex.cmd"),
        );

        let selected =
            select_effective_codex_probe(&primary, std::slice::from_ref(&fallback), true);

        assert!(!selected.ok);
        assert_eq!(selected.candidate.command, primary.candidate.command);
    }
}
