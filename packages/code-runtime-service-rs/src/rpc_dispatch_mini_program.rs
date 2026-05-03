use super::*;
use base64::engine::general_purpose::STANDARD;
use serde::Deserialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tokio::io::{AsyncRead, AsyncReadExt};
use tokio::process::Command;
use tokio::time::{timeout, Duration};

#[path = "rpc_dispatch_mini_program_support.rs"]
mod support;

use support::{
    parse_http_port_from_text, parse_login_status_body, normalize_info_output_mode,
    normalize_qr_output_mode, trim_to_non_empty,
};

const MINI_PROGRAM_CLI_OVERRIDE_ENV: &str = "CODE_RUNTIME_MINI_PROGRAM_CLI_PATH";
const MINI_PROGRAM_HTTP_PORT_OVERRIDE_ENV: &str = "CODE_RUNTIME_MINI_PROGRAM_HTTP_PORT";
const MINI_PROGRAM_ACTION_TIMEOUT_MS: u64 = 120_000;
const MINI_PROGRAM_HTTP_TIMEOUT_MS: u64 = 3_000;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MiniProgramStatusRequest {
    #[serde(alias = "workspace_id")]
    workspace_id: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MiniProgramCompileConditionRequest {
    #[serde(default, alias = "path_name")]
    path_name: Option<String>,
    #[serde(default)]
    query: Option<String>,
    #[serde(default)]
    scene: Option<u32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MiniProgramActionRunRequest {
    #[serde(alias = "workspace_id")]
    workspace_id: String,
    action: String,
    #[serde(default, alias = "compile_type")]
    compile_type: Option<String>,
    #[serde(default, alias = "compile_condition")]
    compile_condition: Option<MiniProgramCompileConditionRequest>,
    #[serde(default)]
    version: Option<String>,
    #[serde(default)]
    desc: Option<String>,
    #[serde(default, alias = "qr_output_mode")]
    qr_output_mode: Option<String>,
    #[serde(default, alias = "info_output_mode")]
    info_output_mode: Option<String>,
}

#[derive(Clone, Debug)]
enum MiniProgramHost {
    Macos,
    Windows,
    Unsupported(String),
}

impl MiniProgramHost {
    fn current() -> Self {
        Self::from_os_name(std::env::consts::OS)
    }

    fn from_os_name(value: &str) -> Self {
        match value {
            "macos" => Self::Macos,
            "windows" => Self::Windows,
            other => Self::Unsupported(other.to_string()),
        }
    }

    fn os_label(&self) -> &str {
        match self {
            Self::Macos => "macos",
            Self::Windows => "windows",
            Self::Unsupported(other) => other.as_str(),
        }
    }
}

#[derive(Clone, Debug)]
struct MiniProgramProjectSnapshot {
    valid: bool,
    project_config_path: Option<String>,
    app_id: Option<String>,
    project_name: Option<String>,
    miniprogram_root: Option<String>,
    plugin_root: Option<String>,
    compile_type: &'static str,
}

#[derive(Clone, Debug)]
struct MiniProgramCiAvailability {
    available: bool,
    declared: bool,
    package_root: Option<String>,
    version: Option<String>,
}

#[derive(Clone, Debug)]
struct MiniProgramStatusSnapshot {
    available: bool,
    status: &'static str,
    host_os: String,
    devtools_installed: bool,
    cli_path: Option<String>,
    http_port: Option<u16>,
    service_status: &'static str,
    login_status: &'static str,
    project: MiniProgramProjectSnapshot,
    miniprogram_ci: MiniProgramCiAvailability,
    supported_actions: Vec<&'static str>,
    warnings: Vec<String>,
}

#[derive(Clone, Debug)]
struct MiniProgramActionSnapshot {
    available: bool,
    status: &'static str,
    message: String,
    command: Vec<String>,
    exit_code: Option<i32>,
    stdout: Option<String>,
    stderr: Option<String>,
    qr_code: Option<Value>,
    info: Option<Value>,
    warnings: Vec<String>,
}

#[derive(Clone, Debug)]
struct MiniProgramCliRunOutput {
    command: Vec<String>,
    exit_code: Option<i32>,
    stdout: String,
    stderr: String,
}

fn find_workspace_package_root(workspace_path: &Path) -> Option<PathBuf> {
    let mut current = if workspace_path.is_dir() {
        workspace_path.to_path_buf()
    } else {
        workspace_path.parent()?.to_path_buf()
    };
    loop {
        if current.join("package.json").is_file() {
            return Some(current);
        }
        if !current.pop() {
            return None;
        }
    }
}

fn read_project_snapshot(workspace_path: &Path) -> MiniProgramProjectSnapshot {
    let config_path = workspace_path.join("project.config.json");
    let fallback = MiniProgramProjectSnapshot {
        valid: false,
        project_config_path: config_path
            .is_file()
            .then(|| config_path.to_string_lossy().to_string()),
        app_id: None,
        project_name: None,
        miniprogram_root: None,
        plugin_root: None,
        compile_type: "unknown",
    };
    let raw = match fs::read_to_string(&config_path) {
        Ok(value) => value,
        Err(_) => return fallback,
    };
    let payload = match serde_json::from_str::<Value>(raw.trim()) {
        Ok(value) => value,
        Err(_) => return fallback,
    };
    let app_id = trim_to_non_empty(payload.get("appid").and_then(Value::as_str));
    let project_name = trim_to_non_empty(payload.get("projectname").and_then(Value::as_str));
    let miniprogram_root =
        trim_to_non_empty(payload.get("miniprogramRoot").and_then(Value::as_str));
    let plugin_root = trim_to_non_empty(payload.get("pluginRoot").and_then(Value::as_str));
    let compile_type = if plugin_root.is_some() && miniprogram_root.is_none() {
        "plugin"
    } else if miniprogram_root.is_some() {
        "miniprogram"
    } else {
        "unknown"
    };
    MiniProgramProjectSnapshot {
        valid: app_id.is_some(),
        project_config_path: Some(config_path.to_string_lossy().to_string()),
        app_id,
        project_name,
        miniprogram_root,
        plugin_root,
        compile_type,
    }
}

fn read_miniprogram_ci_availability(workspace_path: &Path) -> MiniProgramCiAvailability {
    let package_root = find_workspace_package_root(workspace_path);
    let mut declared = false;
    let mut version = None;
    if let Some(root) = package_root.as_ref() {
        if let Ok(raw) = fs::read_to_string(root.join("package.json")) {
            if let Ok(payload) = serde_json::from_str::<Value>(raw.trim()) {
                for key in [
                    "dependencies",
                    "devDependencies",
                    "optionalDependencies",
                    "peerDependencies",
                ] {
                    if let Some(entries) = payload.get(key).and_then(Value::as_object) {
                        if let Some(value) = entries.get("miniprogram-ci").and_then(Value::as_str) {
                            declared = true;
                            version = trim_to_non_empty(Some(value));
                            break;
                        }
                    }
                }
            }
        }
        let installed_package_json = root.join("node_modules").join("miniprogram-ci").join("package.json");
        if let Ok(raw) = fs::read_to_string(installed_package_json) {
            if let Ok(payload) = serde_json::from_str::<Value>(raw.trim()) {
                version = trim_to_non_empty(payload.get("version").and_then(Value::as_str))
                    .or(version);
                declared = true;
            }
        }
    }
    MiniProgramCiAvailability {
        available: package_root.is_some() && declared,
        declared,
        package_root: package_root.map(|path| path.to_string_lossy().to_string()),
        version,
    }
}

fn find_port_files(base_dir: &Path, depth: usize, results: &mut Vec<PathBuf>) {
    if depth == 0 {
        return;
    }
    let entries = match fs::read_dir(base_dir) {
        Ok(value) => value,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            find_port_files(path.as_path(), depth - 1, results);
            continue;
        }
        if path.file_name().is_some_and(|value| value == ".ide") {
            results.push(path);
        }
    }
}

fn resolve_http_port(host: &MiniProgramHost) -> Option<u16> {
    if let Ok(value) = std::env::var(MINI_PROGRAM_HTTP_PORT_OVERRIDE_ENV) {
        if let Ok(port) = value.trim().parse::<u16>() {
            return Some(port);
        }
    }
    let base_dir = match host {
        MiniProgramHost::Macos => {
            let home = std::env::var("HOME").ok()?;
            PathBuf::from(home)
                .join("Library")
                .join("Application Support")
                .join("微信开发者工具")
        }
        MiniProgramHost::Windows => {
            let local_app_data = std::env::var("LOCALAPPDATA").ok()?;
            PathBuf::from(local_app_data)
                .join("微信开发者工具")
                .join("User Data")
        }
        MiniProgramHost::Unsupported(_) => return None,
    };
    let mut candidates = Vec::new();
    find_port_files(base_dir.as_path(), 4, &mut candidates);
    candidates.sort();
    candidates.into_iter().find_map(|path| {
        fs::read_to_string(path)
            .ok()
            .and_then(|value| parse_http_port_from_text(value.as_str()))
    })
}

fn resolve_cli_path(host: &MiniProgramHost) -> Option<PathBuf> {
    if let Ok(value) = std::env::var(MINI_PROGRAM_CLI_OVERRIDE_ENV) {
        let candidate = PathBuf::from(value.trim());
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    let candidates = match host {
        MiniProgramHost::Macos => vec![PathBuf::from(
            "/Applications/wechatwebdevtools.app/Contents/MacOS/cli",
        )],
        MiniProgramHost::Windows => {
            let mut values = Vec::new();
            for env_name in ["ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA"] {
                if let Ok(root) = std::env::var(env_name) {
                    values.push(
                        PathBuf::from(&root)
                            .join("Tencent")
                            .join("微信web开发者工具")
                            .join("cli.bat"),
                    );
                    values.push(
                        PathBuf::from(&root)
                            .join("Programs")
                            .join("微信开发者工具")
                            .join("cli.bat"),
                    );
                    values.push(PathBuf::from(&root).join("微信开发者工具").join("cli.bat"));
                }
            }
            values
        }
        MiniProgramHost::Unsupported(_) => return None,
    };
    candidates.into_iter().find(|path| path.is_file())
}

async fn read_login_status(http_port: Option<u16>) -> (&'static str, &'static str, Vec<String>) {
    let Some(port) = http_port else {
        return (
            "unavailable",
            "unavailable",
            vec!["WeChat DevTools HTTP V2 port was not discovered.".to_string()],
        );
    };
    let client = match reqwest::Client::builder()
        .timeout(Duration::from_millis(MINI_PROGRAM_HTTP_TIMEOUT_MS))
        .build()
    {
        Ok(value) => value,
        Err(error) => {
            return (
                "unknown",
                "unknown",
                vec![format!("Failed to build HTTP client for WeChat DevTools probing: {error}")],
            )
        }
    };
    let url = format!("http://127.0.0.1:{port}/v2/islogin");
    match client.get(url).send().await {
        Ok(response) => {
            let service_status = if response.status().is_success() {
                "running"
            } else {
                "unknown"
            };
            let body = response.text().await.unwrap_or_default();
            if let Some(login_status) = parse_login_status_body(&body) {
                (service_status, login_status, Vec::new())
            } else {
                (
                    service_status,
                    "unknown",
                    vec!["Could not parse WeChat DevTools login state from HTTP V2 response.".to_string()],
                )
            }
        }
        Err(error) => (
            "stopped",
            "unknown",
            vec![format!("WeChat DevTools HTTP V2 probe failed: {error}")],
        ),
    }
}

async fn collect_mini_program_status(
    workspace_path: &Path,
    host: MiniProgramHost,
) -> MiniProgramStatusSnapshot {
    let project = read_project_snapshot(workspace_path);
    let miniprogram_ci = read_miniprogram_ci_availability(workspace_path);
    let mut warnings = Vec::new();
    if let MiniProgramHost::Unsupported(os_name) = &host {
        warnings.push(format!(
            "WeChat Mini Program official tooling is only supported in HugeCode on macOS and Windows. Current host: {os_name}."
        ));
        return MiniProgramStatusSnapshot {
            available: false,
            status: "unavailable",
            host_os: os_name.clone(),
            devtools_installed: false,
            cli_path: None,
            http_port: None,
            service_status: "unavailable",
            login_status: "unavailable",
            project,
            miniprogram_ci,
            supported_actions: Vec::new(),
            warnings,
        };
    }

    let cli_path = resolve_cli_path(&host);
    let http_port = resolve_http_port(&host);
    let (service_status, login_status, login_warnings) = read_login_status(http_port).await;
    warnings.extend(login_warnings);
    if !project.valid {
        warnings.push("Workspace root does not contain a valid WeChat Mini Program project.config.json.".to_string());
    }
    if cli_path.is_none() {
        warnings.push("WeChat DevTools CLI was not found on this host.".to_string());
    }
    let mut status = if cli_path.is_some() && project.valid {
        "ready"
    } else if cli_path.is_some() || project.valid || miniprogram_ci.available {
        "attention"
    } else {
        "blocked"
    };
    let supported_actions = if cli_path.is_some() {
        vec![
            "open_project",
            "refresh_project",
            "build_npm",
            "preview",
            "upload",
            "reset_file_watch",
        ]
    } else {
        Vec::new()
    };
    if supported_actions.is_empty() {
        status = if project.valid || miniprogram_ci.available {
            "attention"
        } else {
            "blocked"
        };
    }
    MiniProgramStatusSnapshot {
        available: cli_path.is_some(),
        status,
        host_os: host.os_label().to_string(),
        devtools_installed: cli_path.is_some(),
        cli_path: cli_path.map(|path| path.to_string_lossy().to_string()),
        http_port,
        service_status,
        login_status,
        project,
        miniprogram_ci,
        supported_actions,
        warnings,
    }
}

async fn read_child_pipe<R>(mut pipe: Option<R>) -> Vec<u8>
where
    R: AsyncRead + Unpin,
{
    let mut buffer = Vec::new();
    if let Some(reader) = pipe.as_mut() {
        let _ = reader.read_to_end(&mut buffer).await;
    }
    buffer
}

async fn run_cli_command(
    cli_path: &Path,
    args: &[String],
) -> Result<MiniProgramCliRunOutput, String> {
    run_cli_command_with_timeout(
        cli_path,
        args,
        Duration::from_millis(MINI_PROGRAM_ACTION_TIMEOUT_MS),
    )
    .await
}

async fn run_cli_command_with_timeout(
    cli_path: &Path,
    args: &[String],
    timeout_duration: Duration,
) -> Result<MiniProgramCliRunOutput, String> {
    let mut command = Command::new(cli_path);
    command
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let command_repr = std::iter::once(cli_path.to_string_lossy().to_string())
        .chain(args.iter().cloned())
        .collect::<Vec<_>>();
    let mut child = command
        .spawn()
        .map_err(|error| format!("spawn mini program cli failed: {error}"))?;
    let stdout_task = tokio::spawn(read_child_pipe(child.stdout.take()));
    let stderr_task = tokio::spawn(read_child_pipe(child.stderr.take()));
    let exit_status = match timeout(timeout_duration, child.wait()).await {
        Ok(Ok(status)) => status,
        Ok(Err(error)) => {
            let _ = stdout_task.await;
            let _ = stderr_task.await;
            return Err(format!("wait mini program cli failed: {error}"));
        }
        Err(_) => {
            child
                .kill()
                .await
                .map_err(|error| format!("mini program cli timed out and kill failed: {error}"))?;
            let _ = stdout_task.await;
            let _ = stderr_task.await;
            return Err("mini program cli timed out".to_string());
        }
    };
    let stdout = stdout_task
        .await
        .map_err(|error| format!("read mini program cli stdout failed: {error}"))?;
    let stderr = stderr_task
        .await
        .map_err(|error| format!("read mini program cli stderr failed: {error}"))?;
    Ok(MiniProgramCliRunOutput {
        command: command_repr,
        exit_code: exit_status.code(),
        stdout: String::from_utf8_lossy(&stdout).to_string(),
        stderr: String::from_utf8_lossy(&stderr).to_string(),
    })
}

fn build_inline_output_dir() -> PathBuf {
    std::env::temp_dir().join(format!("hugecode-mini-program-{}", Uuid::new_v4()))
}

async fn execute_mini_program_action(
    workspace_path: &Path,
    cli_path: &Path,
    request: &MiniProgramActionRunRequest,
) -> MiniProgramActionSnapshot {
    let project = read_project_snapshot(workspace_path);
    if !project.valid {
        return MiniProgramActionSnapshot {
            available: true,
            status: "blocked",
            message: "Workspace root is not a valid WeChat Mini Program project.".to_string(),
            command: Vec::new(),
            exit_code: None,
            stdout: None,
            stderr: None,
            qr_code: None,
            info: None,
            warnings: Vec::new(),
        };
    }

    let action = request.action.trim();
    let mut args = match action {
        "open_project" | "refresh_project" => vec![
            "open".to_string(),
            "--project".to_string(),
            workspace_path.to_string_lossy().to_string(),
        ],
        "build_npm" => {
            let mut args = vec![
                "build-npm".to_string(),
                "--project".to_string(),
                workspace_path.to_string_lossy().to_string(),
            ];
            if let Some(compile_type) = trim_to_non_empty(request.compile_type.as_deref()) {
                args.push("--compile-type".to_string());
                args.push(compile_type);
            }
            args
        }
        "preview" => vec![
            "preview".to_string(),
            "--project".to_string(),
            workspace_path.to_string_lossy().to_string(),
        ],
        "upload" => {
            let Some(version) = trim_to_non_empty(request.version.as_deref()) else {
                return MiniProgramActionSnapshot {
                    available: true,
                    status: "blocked",
                    message: "Upload requires a version string.".to_string(),
                    command: Vec::new(),
                    exit_code: None,
                    stdout: None,
                    stderr: None,
                    qr_code: None,
                    info: None,
                    warnings: Vec::new(),
                };
            };
            let mut args = vec![
                "upload".to_string(),
                "--project".to_string(),
                workspace_path.to_string_lossy().to_string(),
                "-v".to_string(),
                version,
            ];
            if let Some(desc) = trim_to_non_empty(request.desc.as_deref()) {
                args.push("-d".to_string());
                args.push(desc);
            }
            args
        }
        "reset_file_watch" => vec![
            "reset-fileutils".to_string(),
            "--project".to_string(),
            workspace_path.to_string_lossy().to_string(),
        ],
        other => {
            return MiniProgramActionSnapshot {
                available: true,
                status: "blocked",
                message: format!("Unsupported mini program action `{other}`."),
                command: Vec::new(),
                exit_code: None,
                stdout: None,
                stderr: None,
                qr_code: None,
                info: None,
                warnings: Vec::new(),
            }
        }
    };

    let mut warnings = Vec::new();
    if action == "preview" {
        if let Some(condition) = request.compile_condition.as_ref() {
            let compile_condition = json!({
                "pathName": trim_to_non_empty(condition.path_name.as_deref()),
                "query": trim_to_non_empty(condition.query.as_deref()),
                "scene": condition.scene,
            });
            args.push("--compile-condition".to_string());
            args.push(compile_condition.to_string());
        }
    } else if request.compile_condition.is_some() {
        warnings.push("compileCondition is only applied to preview in v1.".to_string());
    }

    let mut qr_output_path = None;
    let qr_output_mode = normalize_qr_output_mode(request.qr_output_mode.as_deref());
    if action == "preview" {
        match qr_output_mode {
            "base64" => {
                let output_dir = build_inline_output_dir();
                let _ = fs::create_dir_all(&output_dir);
                let output_path = output_dir.join("preview-qr.txt");
                args.push("--qr-output".to_string());
                args.push(format!("base64@{}", output_path.to_string_lossy()));
                args.push("--qr-format".to_string());
                args.push("base64".to_string());
                qr_output_path = Some(output_path);
            }
            "image" => {
                let output_dir = build_inline_output_dir();
                let _ = fs::create_dir_all(&output_dir);
                let output_path = output_dir.join("preview-qr.png");
                args.push("--qr-output".to_string());
                args.push(output_path.to_string_lossy().to_string());
                args.push("--qr-format".to_string());
                args.push("image".to_string());
                qr_output_path = Some(output_path);
            }
            "terminal" => {}
            _ => {}
        }
    } else if qr_output_mode != "none" {
        warnings.push("qrOutputMode only applies to preview.".to_string());
    }

    let mut info_output_path = None;
    if normalize_info_output_mode(request.info_output_mode.as_deref()) == "inline"
        && (action == "preview" || action == "upload")
    {
        let output_dir = build_inline_output_dir();
        let _ = fs::create_dir_all(&output_dir);
        let output_path = output_dir.join("action-info.json");
        args.push("--info-output".to_string());
        args.push(output_path.to_string_lossy().to_string());
        info_output_path = Some(output_path);
    } else if normalize_info_output_mode(request.info_output_mode.as_deref()) == "inline" {
        warnings.push("infoOutputMode only applies to preview and upload.".to_string());
    }

    let command_result = match run_cli_command(cli_path, &args).await {
        Ok(value) => value,
        Err(error) => {
            return MiniProgramActionSnapshot {
                available: true,
                status: "failed",
                message: error,
                command: std::iter::once(cli_path.to_string_lossy().to_string())
                    .chain(args)
                    .collect(),
                exit_code: None,
                stdout: None,
                stderr: None,
                qr_code: None,
                info: None,
                warnings,
            }
        }
    };

    let qr_code = qr_output_path.as_ref().and_then(|path| {
        let data = fs::read(path).ok()?;
        match qr_output_mode {
            "base64" => Some(json!({
                "format": "base64",
                "dataBase64": String::from_utf8_lossy(&data).trim().to_string(),
                "outputPath": path.to_string_lossy().to_string(),
            })),
            "image" => Some(json!({
                "format": "image",
                "dataBase64": STANDARD.encode(data),
                "outputPath": path.to_string_lossy().to_string(),
            })),
            _ => None,
        }
    });

    let info = info_output_path
        .as_ref()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|raw| serde_json::from_str::<Value>(raw.trim()).ok());
    if info_output_path.is_some() && info.is_none() {
        warnings.push("Failed to parse info-output JSON produced by WeChat DevTools.".to_string());
    }

    let succeeded = command_result.exit_code == Some(0);
    let message = if succeeded {
        format!("Mini program action `{action}` completed.")
    } else {
        format!("Mini program action `{action}` failed.")
    };
    MiniProgramActionSnapshot {
        available: true,
        status: if succeeded { "completed" } else { "failed" },
        message,
        command: command_result.command,
        exit_code: command_result.exit_code,
        stdout: Some(command_result.stdout),
        stderr: Some(command_result.stderr),
        qr_code,
        info,
        warnings,
    }
}

pub(super) async fn handle_mini_program_status_v1(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let request: MiniProgramStatusRequest = serde_json::from_value(params.clone()).map_err(|error| {
        RpcError::invalid_params(format!("Invalid mini program status payload: {error}"))
    })?;
    let workspace_path =
        super::workspace_git_dispatch::resolve_workspace_path(ctx, request.workspace_id.as_str())
            .await?;
    let snapshot = collect_mini_program_status(workspace_path.as_path(), MiniProgramHost::current()).await;
    Ok(json!({
        "workspaceId": request.workspace_id,
        "available": snapshot.available,
        "status": snapshot.status,
        "hostOs": snapshot.host_os,
        "devtoolsInstalled": snapshot.devtools_installed,
        "cliPath": snapshot.cli_path,
        "httpPort": snapshot.http_port,
        "serviceStatus": snapshot.service_status,
        "loginStatus": snapshot.login_status,
        "project": {
            "valid": snapshot.project.valid,
            "projectConfigPath": snapshot.project.project_config_path,
            "appId": snapshot.project.app_id,
            "projectName": snapshot.project.project_name,
            "miniprogramRoot": snapshot.project.miniprogram_root,
            "pluginRoot": snapshot.project.plugin_root,
            "compileType": snapshot.project.compile_type,
        },
        "miniprogramCi": {
            "available": snapshot.miniprogram_ci.available,
            "declared": snapshot.miniprogram_ci.declared,
            "packageRoot": snapshot.miniprogram_ci.package_root,
            "version": snapshot.miniprogram_ci.version,
        },
        "supportedActions": snapshot.supported_actions,
        "warnings": snapshot.warnings,
    }))
}

pub(super) async fn handle_mini_program_run_v1(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let request: MiniProgramActionRunRequest =
        serde_json::from_value(params.clone()).map_err(|error| {
            RpcError::invalid_params(format!("Invalid mini program run payload: {error}"))
        })?;
    let workspace_path =
        super::workspace_git_dispatch::resolve_workspace_path(ctx, request.workspace_id.as_str())
            .await?;
    let host = MiniProgramHost::current();
    let cli_path = resolve_cli_path(&host);
    let result = match cli_path {
        Some(path) => execute_mini_program_action(workspace_path.as_path(), path.as_path(), &request).await,
        None => MiniProgramActionSnapshot {
            available: false,
            status: match host {
                MiniProgramHost::Unsupported(_) => "blocked",
                _ => "blocked",
            },
            message: "WeChat DevTools CLI is unavailable on this host.".to_string(),
            command: Vec::new(),
            exit_code: None,
            stdout: None,
            stderr: None,
            qr_code: None,
            info: None,
            warnings: Vec::new(),
        },
    };
    Ok(json!({
        "workspaceId": request.workspace_id,
        "available": result.available,
        "action": request.action,
        "status": result.status,
        "message": result.message,
        "command": result.command,
        "exitCode": result.exit_code,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "qrCode": result.qr_code,
        "info": result.info,
        "warnings": result.warnings,
    }))
}

#[cfg(test)]
mod tests {
    use super::{
        collect_mini_program_status, execute_mini_program_action, parse_login_status_body,
        run_cli_command_with_timeout, MiniProgramActionRunRequest, MiniProgramHost,
        MINI_PROGRAM_CLI_OVERRIDE_ENV,
    };
    use std::fs;
    use std::path::{Path, PathBuf};
    use tempfile::TempDir;
    use tokio::time::Duration;

    #[cfg(unix)]
    use std::os::unix::fs::PermissionsExt;

    fn write_fake_cli_script(temp: &TempDir) -> PathBuf {
        let script_path = temp.path().join("fake-mini-program-cli.sh");
        let script = r#"#!/bin/sh
set -eu
cmd="$1"
shift || true
if [ "$cmd" = "preview" ]; then
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --qr-output)
        qr_output="$2"
        shift 2
        ;;
      --info-output)
        info_output="$2"
        shift 2
        ;;
      *)
        shift
        ;;
    esac
  done
  if [ -n "${qr_output:-}" ]; then
    case "$qr_output" in
      base64@*)
        printf 'ZmFrZS1xci1jb2Rl' > "${qr_output#base64@}"
        ;;
      *)
        printf 'PNG' > "$qr_output"
        ;;
    esac
  fi
  if [ -n "${info_output:-}" ]; then
    printf '{"size":123}' > "$info_output"
  fi
  printf 'preview ok'
  exit 0
fi
if [ "$cmd" = "upload" ]; then
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --info-output|-i)
        info_output="$2"
        shift 2
        ;;
      *)
        shift
        ;;
    esac
  done
  if [ -n "${info_output:-}" ]; then
    printf '{"upload":true}' > "$info_output"
  fi
  printf 'upload ok'
  exit 0
fi
printf '%s ok' "$cmd"
"#;
        fs::write(&script_path, script).expect("write fake mini program cli script");
        #[cfg(unix)]
        {
            let mut permissions = fs::metadata(&script_path)
                .expect("metadata")
                .permissions();
            permissions.set_mode(0o755);
            fs::set_permissions(&script_path, permissions).expect("chmod");
        }
        script_path
    }

    fn write_hanging_cli_script(temp: &TempDir, pid_path: &Path) -> PathBuf {
        let script_path = temp.path().join("hanging-mini-program-cli.sh");
        let script = format!(
            "#!/bin/sh\nset -eu\nprintf '%s' \"$$\" > \"{}\"\nwhile :; do :; done\n",
            pid_path.to_string_lossy()
        );
        fs::write(&script_path, script).expect("write hanging mini program cli script");
        #[cfg(unix)]
        {
            let mut permissions = fs::metadata(&script_path)
                .expect("metadata")
                .permissions();
            permissions.set_mode(0o755);
            fs::set_permissions(&script_path, permissions).expect("chmod");
        }
        script_path
    }

    fn write_project_config(temp: &TempDir) {
        fs::write(
            temp.path().join("project.config.json"),
            r#"{
  "appid": "wx123",
  "projectname": "demo-mini-program",
  "miniprogramRoot": "src"
}"#,
        )
        .expect("write project config");
    }

    #[test]
    fn collect_mini_program_status_marks_invalid_workspace_when_project_config_missing() {
        let temp = TempDir::new().expect("tempdir");
        let runtime = tokio::runtime::Runtime::new().expect("runtime");
        let snapshot = runtime.block_on(collect_mini_program_status(
            temp.path(),
            MiniProgramHost::Unsupported("linux".to_string()),
        ));
        assert!(!snapshot.available);
        assert_eq!(snapshot.status, "unavailable");
        assert!(!snapshot.project.valid);
    }

    #[test]
    fn execute_mini_program_action_collects_preview_outputs() {
        let temp = TempDir::new().expect("tempdir");
        write_project_config(&temp);
        let cli_path = write_fake_cli_script(&temp);
        let request = MiniProgramActionRunRequest {
            workspace_id: "ws-preview".to_string(),
            action: "preview".to_string(),
            compile_type: None,
            compile_condition: Some(super::MiniProgramCompileConditionRequest {
                path_name: Some("pages/index/index".to_string()),
                query: Some("foo=bar".to_string()),
                scene: Some(1011),
            }),
            version: None,
            desc: None,
            qr_output_mode: Some("base64".to_string()),
            info_output_mode: Some("inline".to_string()),
        };
        let runtime = tokio::runtime::Runtime::new().expect("runtime");
        let result = runtime.block_on(execute_mini_program_action(
            temp.path(),
            cli_path.as_path(),
            &request,
        ));
        assert_eq!(result.status, "completed");
        assert_eq!(result.exit_code, Some(0));
        assert!(result.qr_code.is_some());
        assert!(result.info.is_some());
    }

    #[test]
    fn execute_mini_program_action_blocks_upload_without_version() {
        let temp = TempDir::new().expect("tempdir");
        write_project_config(&temp);
        let cli_path = write_fake_cli_script(&temp);
        let request = MiniProgramActionRunRequest {
            workspace_id: "ws-upload".to_string(),
            action: "upload".to_string(),
            compile_type: None,
            compile_condition: None,
            version: None,
            desc: None,
            qr_output_mode: None,
            info_output_mode: None,
        };
        let runtime = tokio::runtime::Runtime::new().expect("runtime");
        let result = runtime.block_on(execute_mini_program_action(
            temp.path(),
            cli_path.as_path(),
            &request,
        ));
        assert_eq!(result.status, "blocked");
        assert!(result.message.contains("version"));
    }

    #[test]
    fn collect_mini_program_status_uses_cli_override() {
        let temp = TempDir::new().expect("tempdir");
        write_project_config(&temp);
        let cli_path = write_fake_cli_script(&temp);
        std::env::set_var(MINI_PROGRAM_CLI_OVERRIDE_ENV, cli_path.to_string_lossy().to_string());
        let runtime = tokio::runtime::Runtime::new().expect("runtime");
        let snapshot = runtime.block_on(collect_mini_program_status(
            temp.path(),
            MiniProgramHost::Macos,
        ));
        std::env::remove_var(MINI_PROGRAM_CLI_OVERRIDE_ENV);
        assert!(snapshot.available);
        assert_eq!(snapshot.status, "ready");
        assert!(snapshot.devtools_installed);
    }

    #[test]
    fn parse_login_status_body_prefers_islogin_false_over_unrelated_true_fields() {
        let payload = r#"{"success":true,"islogin":false}"#;
        assert_eq!(parse_login_status_body(payload), Some("logged_out"));
    }

    #[test]
    fn run_cli_command_with_timeout_kills_hung_process() {
        let temp = TempDir::new().expect("tempdir");
        let pid_path = temp.path().join("mini-program.pid");
        let cli_path = write_hanging_cli_script(&temp, pid_path.as_path());
        let runtime = tokio::runtime::Runtime::new().expect("runtime");
        let result = runtime.block_on(run_cli_command_with_timeout(
            cli_path.as_path(),
            &["preview".to_string()],
            Duration::from_millis(200),
        ));
        assert!(result.is_err());
        assert_eq!(result.err().as_deref(), Some("mini program cli timed out"));
        for _ in 0..20 {
            if pid_path.exists() {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
        let pid = fs::read_to_string(pid_path)
            .expect("pid")
            .trim()
            .parse::<u32>()
            .expect("numeric pid");
        assert!(
            !PathBuf::from(format!("/proc/{pid}")).exists(),
            "timed out mini program cli process should be reaped"
        );
    }
}
