use super::*;
use crate::local_codex_cli_sessions::resolve_local_codex_playwright_runtime_availability;
use serde::Deserialize;
use serde_json::{json, Map, Value};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};
use tokio::time::{timeout, Duration};

#[path = "rpc_dispatch_browser_debug_decision_lab.rs"]
mod decision_lab;
#[path = "rpc_dispatch_browser_debug_chrome.rs"]
mod chrome;

const BROWSER_DEBUG_MCP_COMMAND_OVERRIDE_ENV: &str =
    "CODE_RUNTIME_BROWSER_DEBUG_PLAYWRIGHT_COMMAND";
const BROWSER_DEBUG_MCP_ARGS_OVERRIDE_ENV: &str = "CODE_RUNTIME_BROWSER_DEBUG_PLAYWRIGHT_ARGS_JSON";
const BROWSER_DEBUG_CHROME_COMMAND_OVERRIDE_ENV: &str =
    "CODE_RUNTIME_BROWSER_DEBUG_CHROME_COMMAND";
const BROWSER_DEBUG_CHROME_ARGS_OVERRIDE_ENV: &str =
    "CODE_RUNTIME_BROWSER_DEBUG_CHROME_ARGS_JSON";
const BROWSER_DEBUG_CHROME_BROWSER_URL_ENV: &str =
    "CODE_RUNTIME_BROWSER_DEBUG_CHROME_BROWSER_URL";
const BROWSER_DEBUG_DEFAULT_TIMEOUT_MS: u64 = 20_000;
const BROWSER_DEBUG_MAX_TIMEOUT_MS: u64 = 120_000;
const BROWSER_DEBUG_PROTOCOL_VERSION: &str = "2025-03-26";
const DEFAULT_CHATGPT_URL: &str = "https://chatgpt.com/";

#[cfg(test)]
pub(super) fn browser_debug_env_lock() -> &'static std::sync::Mutex<()> {
    static LOCK: std::sync::OnceLock<std::sync::Mutex<()>> = std::sync::OnceLock::new();
    LOCK.get_or_init(|| std::sync::Mutex::new(()))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BrowserDebugStatusRequest {
    #[serde(alias = "workspace_id")]
    workspace_id: String,
    #[serde(default, alias = "browser_url")]
    browser_url: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BrowserDebugRunRequest {
    #[serde(alias = "workspace_id")]
    workspace_id: String,
    operation: String,
    #[serde(default, alias = "browser_url")]
    browser_url: Option<String>,
    #[serde(default)]
    prompt: Option<String>,
    #[serde(default, alias = "include_screenshot")]
    include_screenshot: Option<bool>,
    #[serde(default, alias = "timeout_ms")]
    timeout_ms: Option<u64>,
    #[serde(default)]
    steps: Option<Vec<BrowserDebugToolCallRequest>>,
    #[serde(default, alias = "decision_lab")]
    decision_lab: Option<BrowserDebugDecisionLabRequest>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BrowserDebugToolCallRequest {
    #[serde(alias = "tool_name")]
    tool_name: String,
    #[serde(default)]
    arguments: Option<Map<String, Value>>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BrowserDebugDecisionLabOptionRequest {
    id: String,
    label: String,
    #[serde(default)]
    summary: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BrowserDebugDecisionLabRequest {
    question: String,
    options: Vec<BrowserDebugDecisionLabOptionRequest>,
    #[serde(default)]
    constraints: Option<Vec<String>>,
    #[serde(default, alias = "allow_live_web_research")]
    allow_live_web_research: Option<bool>,
    #[serde(default, alias = "chatgpt_url")]
    chatgpt_url: Option<String>,
}

#[derive(Clone, Debug)]
struct BrowserDebugMcpLaunchConfig {
    command: String,
    args: Vec<String>,
    cwd: PathBuf,
    package_root: Option<PathBuf>,
}

#[derive(Clone, Debug, Default)]
struct BrowserDebugStatusSnapshot {
    available: bool,
    mode: &'static str,
    status: &'static str,
    package_root: Option<String>,
    server_name: Option<String>,
    browser_url: Option<String>,
    tools: Vec<Value>,
    warnings: Vec<String>,
}

#[derive(Clone, Debug)]
struct BrowserDebugRunSnapshot {
    available: bool,
    status: &'static str,
    mode: &'static str,
    browser_url: Option<String>,
    message: String,
    tool_calls: Vec<Value>,
    content_text: Option<String>,
    structured_content: Option<Value>,
    artifacts: Vec<Value>,
    warnings: Vec<String>,
    decision_lab: Option<Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct McpJsonRpcResponse {
    id: Value,
    #[serde(default)]
    result: Option<Value>,
    #[serde(default)]
    error: Option<McpJsonRpcError>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct McpJsonRpcError {
    #[allow(dead_code)]
    code: i64,
    message: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct McpListToolsResult {
    #[serde(default)]
    tools: Vec<McpToolDefinition>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct McpToolDefinition {
    name: String,
    #[serde(default)]
    description: Option<String>,
    #[serde(default, rename = "inputSchema", alias = "input_schema")]
    input_schema: Option<Value>,
    #[serde(default)]
    annotations: Option<Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct McpCallToolResult {
    #[serde(default)]
    content: Vec<Value>,
    #[serde(default, rename = "structuredContent", alias = "structured_content")]
    structured_content: Option<Value>,
    #[serde(default, rename = "isError", alias = "is_error")]
    is_error: Option<bool>,
}

struct BrowserDebugMcpClient {
    child: Child,
    stdin: ChildStdin,
    stdout: tokio::io::Lines<BufReader<ChildStdout>>,
    stderr_task: tokio::task::JoinHandle<String>,
    next_request_id: u64,
}

impl BrowserDebugMcpClient {
    async fn connect(config: &BrowserDebugMcpLaunchConfig) -> Result<Self, String> {
        let mut command = Command::new(&config.command);
        command
            .args(&config.args)
            .current_dir(&config.cwd)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        let mut child = command
            .spawn()
            .map_err(|error| format!("spawn browser debug mcp failed: {error}"))?;
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "browser debug mcp stdin unavailable".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "browser debug mcp stdout unavailable".to_string())?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| "browser debug mcp stderr unavailable".to_string())?;
        let stderr_task = tokio::spawn(async move {
            let mut reader = BufReader::new(stderr);
            let mut buffer = String::new();
            let _ = reader.read_to_string(&mut buffer).await;
            buffer
        });
        let mut client = Self {
            child,
            stdin,
            stdout: BufReader::new(stdout).lines(),
            stderr_task,
            next_request_id: 1,
        };
        client.initialize().await?;
        Ok(client)
    }

    async fn initialize(&mut self) -> Result<(), String> {
        let _ = self
            .request(
                "initialize",
                json!({
                    "protocolVersion": BROWSER_DEBUG_PROTOCOL_VERSION,
                    "capabilities": {},
                    "clientInfo": {
                        "name": "hypecode-runtime",
                        "version": env!("CARGO_PKG_VERSION"),
                    }
                }),
            )
            .await?;
        self.notification("notifications/initialized", Value::Null)
            .await?;
        Ok(())
    }

    async fn notification(&mut self, method: &str, params: Value) -> Result<(), String> {
        let mut payload = Map::new();
        payload.insert("jsonrpc".to_string(), Value::String("2.0".to_string()));
        payload.insert("method".to_string(), Value::String(method.to_string()));
        if !params.is_null() {
            payload.insert("params".to_string(), params);
        }
        let encoded = serde_json::to_string(&Value::Object(payload))
            .map_err(|error| format!("encode MCP notification failed: {error}"))?;
        self.stdin
            .write_all(encoded.as_bytes())
            .await
            .map_err(|error| format!("write MCP notification failed: {error}"))?;
        self.stdin
            .write_all(b"\n")
            .await
            .map_err(|error| format!("write MCP notification newline failed: {error}"))?;
        self.stdin
            .flush()
            .await
            .map_err(|error| format!("flush MCP notification failed: {error}"))
    }

    async fn request(&mut self, method: &str, params: Value) -> Result<Value, String> {
        let request_id = self.next_request_id;
        self.next_request_id += 1;

        let encoded = serde_json::to_string(&json!({
            "jsonrpc": "2.0",
            "id": request_id,
            "method": method,
            "params": params,
        }))
        .map_err(|error| format!("encode MCP request failed: {error}"))?;
        self.stdin
            .write_all(encoded.as_bytes())
            .await
            .map_err(|error| format!("write MCP request failed: {error}"))?;
        self.stdin
            .write_all(b"\n")
            .await
            .map_err(|error| format!("write MCP request newline failed: {error}"))?;
        self.stdin
            .flush()
            .await
            .map_err(|error| format!("flush MCP request failed: {error}"))?;

        loop {
            let Some(line) = self
                .stdout
                .next_line()
                .await
                .map_err(|error| format!("read MCP response failed: {error}"))?
            else {
                return Err("playwright mcp exited before responding".to_string());
            };
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            if !trimmed.starts_with('{') && !trimmed.starts_with('[') {
                continue;
            }
            let value: Value = serde_json::from_str(trimmed)
                .map_err(|error| format!("decode MCP response failed: {error}"))?;
            let response: McpJsonRpcResponse = serde_json::from_value(value.clone())
                .map_err(|error| format!("parse MCP response envelope failed: {error}"))?;
            if response.id != json!(request_id) {
                continue;
            }
            if let Some(error) = response.error {
                return Err(error.message);
            }
            return Ok(response.result.unwrap_or(Value::Null));
        }
    }

    async fn list_tools(&mut self) -> Result<Vec<McpToolDefinition>, String> {
        let value = self.request("tools/list", json!({})).await?;
        let result: McpListToolsResult = serde_json::from_value(value)
            .map_err(|error| format!("parse MCP tools/list failed: {error}"))?;
        Ok(result.tools)
    }

    async fn call_tool(
        &mut self,
        tool_name: &str,
        arguments: Option<Map<String, Value>>,
    ) -> Result<McpCallToolResult, String> {
        let value = self
            .request(
                "tools/call",
                json!({
                    "name": tool_name,
                    "arguments": arguments.unwrap_or_default(),
                }),
            )
            .await?;
        serde_json::from_value(value)
            .map_err(|error| format!("parse MCP tools/call failed: {error}"))
    }

    async fn close(mut self) -> String {
        let _ = self.stdin.shutdown().await;
        if timeout(Duration::from_millis(200), self.child.wait())
            .await
            .is_err()
        {
            let _ = self.child.kill().await;
            let _ = timeout(Duration::from_millis(500), self.child.wait()).await;
        }
        match timeout(Duration::from_millis(500), &mut self.stderr_task).await {
            Ok(Ok(stderr)) => stderr,
            _ => {
                self.stderr_task.abort();
                String::new()
            }
        }
    }
}

fn parse_mcp_args_override(raw: &str) -> Result<Vec<String>, String> {
    let value: Value = serde_json::from_str(raw.trim())
        .map_err(|error| format!("invalid browser debug MCP args override JSON: {error}"))?;
    let Some(entries) = value.as_array() else {
        return Err("browser debug MCP args override must be a JSON array".to_string());
    };
    let mut args = Vec::with_capacity(entries.len());
    for entry in entries {
        let Some(text) = entry.as_str() else {
            return Err("browser debug MCP args override entries must be strings".to_string());
        };
        args.push(text.to_string());
    }
    Ok(args)
}

fn command_exists_on_path(command: &str) -> bool {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return false;
    }
    let candidate = Path::new(trimmed);
    if candidate.components().count() > 1 {
        return candidate.is_file();
    }
    let Some(path_env) = std::env::var_os("PATH") else {
        return false;
    };
    let executable_suffixes = if cfg!(windows) {
        std::env::var_os("PATHEXT")
            .map(|value| {
                value
                    .to_string_lossy()
                    .split(';')
                    .map(str::trim)
                    .filter(|entry| !entry.is_empty())
                    .map(ToOwned::to_owned)
                    .collect::<Vec<_>>()
            })
            .filter(|entries| !entries.is_empty())
            .unwrap_or_else(|| {
                vec![
                    ".EXE".to_string(),
                    ".CMD".to_string(),
                    ".BAT".to_string(),
                    ".COM".to_string(),
                ]
            })
    } else {
        vec![String::new()]
    };

    std::env::split_paths(path_env.as_os_str()).any(|dir| {
        let joined = dir.join(trimmed);
        if joined.is_file() {
            return true;
        }
        executable_suffixes.iter().any(|suffix| {
            let suffixed = dir.join(format!("{trimmed}{suffix}"));
            suffixed.is_file()
        })
    })
}

fn resolve_playwright_mcp_launch_config(
    workspace_path: &Path,
) -> Result<Option<BrowserDebugMcpLaunchConfig>, String> {
    let availability = resolve_local_codex_playwright_runtime_availability(workspace_path.to_str());
    if let Ok(command) = std::env::var(BROWSER_DEBUG_MCP_COMMAND_OVERRIDE_ENV) {
        let trimmed = command.trim();
        if !trimmed.is_empty() {
            let args = match std::env::var(BROWSER_DEBUG_MCP_ARGS_OVERRIDE_ENV) {
                Ok(raw) if !raw.trim().is_empty() => parse_mcp_args_override(raw.as_str())?,
                _ => Vec::new(),
            };
            return Ok(Some(BrowserDebugMcpLaunchConfig {
                command: trimmed.to_string(),
                args,
                cwd: availability
                    .package_root
                    .clone()
                    .unwrap_or_else(|| workspace_path.to_path_buf()),
                package_root: availability.package_root,
            }));
        }
    }
    if !availability.available {
        return Ok(None);
    }
    Ok(Some(BrowserDebugMcpLaunchConfig {
        command: "pnpm".to_string(),
        args: vec!["exec".to_string(), "playwright-mcp".to_string()],
        cwd: availability
            .package_root
            .clone()
            .unwrap_or_else(|| workspace_path.to_path_buf()),
        package_root: availability.package_root,
    }))
}

fn normalize_browser_debug_browser_url(candidate: Option<&str>) -> Option<String> {
    candidate
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn chrome_mcp_args_include_browser_url(args: &[String]) -> bool {
    args.iter().any(|arg| arg.starts_with("--browserUrl="))
}

fn resolve_chrome_devtools_mcp_launch_config(
    workspace_path: &Path,
    requested_browser_url: Option<&str>,
) -> Result<Option<BrowserDebugMcpLaunchConfig>, String> {
    let browser_url = normalize_browser_debug_browser_url(requested_browser_url).or_else(|| {
        normalize_browser_debug_browser_url(
            std::env::var(BROWSER_DEBUG_CHROME_BROWSER_URL_ENV).ok().as_deref(),
        )
    });
    if let Ok(command) = std::env::var(BROWSER_DEBUG_CHROME_COMMAND_OVERRIDE_ENV) {
        let trimmed = command.trim();
        if !trimmed.is_empty() {
            let mut args = match std::env::var(BROWSER_DEBUG_CHROME_ARGS_OVERRIDE_ENV) {
                Ok(raw) if !raw.trim().is_empty() => parse_mcp_args_override(raw.as_str())?,
                _ => Vec::new(),
            };
            if let Some(browser_url) = browser_url.clone() {
                if !chrome_mcp_args_include_browser_url(args.as_slice()) {
                    args.push(format!("--browserUrl={browser_url}"));
                }
            }
            return Ok(Some(BrowserDebugMcpLaunchConfig {
                command: trimmed.to_string(),
                args,
                cwd: workspace_path.to_path_buf(),
                package_root: None,
            }));
        }
    }
    if !command_exists_on_path("npx") {
        return Ok(None);
    }
    let mut args = vec!["-y".to_string(), "chrome-devtools-mcp@latest".to_string()];
    if let Some(browser_url) = browser_url {
        args.push(format!("--browserUrl={browser_url}"));
    } else {
        args.push("--autoConnect".to_string());
    }
    Ok(Some(BrowserDebugMcpLaunchConfig {
        command: "npx".to_string(),
        args,
        cwd: workspace_path.to_path_buf(),
        package_root: None,
    }))
}

fn normalize_browser_tool_summary(tool: &McpToolDefinition) -> Value {
    let read_only = tool
        .annotations
        .as_ref()
        .and_then(Value::as_object)
        .and_then(|annotations| annotations.get("readOnlyHint"))
        .and_then(Value::as_bool);
    json!({
        "name": tool.name,
        "description": tool.description,
        "readOnly": read_only,
        "inputSchema": tool.input_schema,
    })
}

fn value_as_object(value: Option<Value>) -> Option<Value> {
    value.and_then(|candidate| match candidate {
        Value::Object(_) => Some(candidate),
        _ => None,
    })
}

fn normalize_browser_call_result(
    tool_name: &str,
    result: McpCallToolResult,
    step_warnings: &mut Vec<String>,
) -> Value {
    let mut text_parts = Vec::new();
    let mut artifacts = Vec::new();
    for item in &result.content {
        let Some(item_type) = item.get("type").and_then(Value::as_str) else {
            continue;
        };
        match item_type {
            "text" => {
                if let Some(text) = item.get("text").and_then(Value::as_str) {
                    let trimmed = text.trim();
                    if !trimmed.is_empty() {
                        text_parts.push(trimmed.to_string());
                    }
                }
            }
            "image" => {
                if let Some(data) = item.get("data").and_then(Value::as_str) {
                    artifacts.push(json!({
                        "kind": "image",
                        "title": item.get("title").and_then(Value::as_str),
                        "mimeType": item.get("mimeType").and_then(Value::as_str).unwrap_or("application/octet-stream"),
                        "dataBase64": data,
                    }));
                }
            }
            "resource_link" => {
                if let Some(uri) = item.get("uri").and_then(Value::as_str) {
                    artifacts.push(json!({
                        "kind": "resource",
                        "title": item.get("name").and_then(Value::as_str).or_else(|| item.get("title").and_then(Value::as_str)),
                        "uri": uri,
                        "mimeType": item.get("mimeType").and_then(Value::as_str),
                        "description": item.get("description").and_then(Value::as_str),
                    }));
                }
            }
            _ => {
                step_warnings.push(format!(
                    "browser debug adapter ignored unsupported MCP content type `{item_type}`."
                ));
            }
        }
    }
    let content_text = if text_parts.is_empty() {
        None
    } else {
        Some(text_parts.join("\n\n"))
    };
    let structured_content = value_as_object(result.structured_content);
    let error_text = if result.is_error.unwrap_or(false) {
        content_text
            .clone()
            .map(Value::String)
            .unwrap_or(Value::Null)
    } else {
        Value::Null
    };
    json!({
        "toolName": tool_name,
        "ok": !result.is_error.unwrap_or(false),
        "contentText": content_text,
        "structuredContent": structured_content,
        "artifacts": artifacts,
        "error": error_text,
    })
}

fn aggregate_browser_tool_call_results(
    tool_calls: &[Value],
) -> (Option<String>, Option<Value>, Vec<Value>) {
    let mut text_parts = Vec::new();
    let mut structured_content = None;
    let mut artifacts = Vec::new();
    for entry in tool_calls {
        if let Some(text) = entry.get("contentText").and_then(Value::as_str) {
            let trimmed = text.trim();
            if !trimmed.is_empty() {
                text_parts.push(trimmed.to_string());
            }
        }
        if structured_content.is_none() {
            structured_content = entry
                .get("structuredContent")
                .cloned()
                .filter(Value::is_object);
        }
        if let Some(items) = entry.get("artifacts").and_then(Value::as_array) {
            artifacts.extend(items.iter().cloned());
        }
    }
    let content_text = if text_parts.is_empty() {
        None
    } else {
        Some(text_parts.join("\n\n"))
    };
    (content_text, structured_content, artifacts)
}

fn build_inspect_steps(
    tools: &[McpToolDefinition],
    include_screenshot: bool,
) -> Result<Vec<BrowserDebugToolCallRequest>, String> {
    let has_snapshot = tools.iter().any(|tool| tool.name == "browser_snapshot");
    let has_screenshot = tools
        .iter()
        .any(|tool| tool.name == "browser_take_screenshot");
    if !has_snapshot && !has_screenshot {
        return Err(
            "Playwright MCP does not expose browser_snapshot or browser_take_screenshot."
                .to_string(),
        );
    }

    let mut steps = Vec::new();
    if has_snapshot {
        steps.push(BrowserDebugToolCallRequest {
            tool_name: "browser_snapshot".to_string(),
            arguments: Some(Map::new()),
        });
    } else if has_screenshot {
        steps.push(BrowserDebugToolCallRequest {
            tool_name: "browser_take_screenshot".to_string(),
            arguments: Some(Map::new()),
        });
    }
    if include_screenshot
        && has_screenshot
        && !steps
            .iter()
            .any(|step| step.tool_name == "browser_take_screenshot")
    {
        steps.push(BrowserDebugToolCallRequest {
            tool_name: "browser_take_screenshot".to_string(),
            arguments: Some(Map::new()),
        });
    }
    Ok(steps)
}

async fn collect_browser_debug_status(
    workspace_path: &Path,
    timeout_ms: u64,
    browser_url: Option<&str>,
) -> BrowserDebugStatusSnapshot {
    let collect_from_config = |config: BrowserDebugMcpLaunchConfig,
                               mode: &'static str,
                               server_name: &'static str| async move {
        let package_root = config
            .package_root
            .as_ref()
            .map(|path| path.to_string_lossy().to_string());
        let browser_url = normalize_browser_debug_browser_url(browser_url);
        let result = timeout(Duration::from_millis(timeout_ms), async move {
            let mut client = BrowserDebugMcpClient::connect(&config).await?;
            let tools = client.list_tools().await?;
            let stderr = client.close().await;
            Ok::<(Vec<McpToolDefinition>, String), String>((tools, stderr))
        })
        .await;
        match result {
            Ok(Ok((tools, stderr))) => {
                let mut warnings = Vec::new();
                if !stderr.trim().is_empty() {
                    warnings.push(stderr.trim().to_string());
                }
                BrowserDebugStatusSnapshot {
                    available: true,
                    mode,
                    status: "ready",
                    package_root,
                    server_name: Some(server_name.to_string()),
                    browser_url,
                    tools: tools.iter().map(normalize_browser_tool_summary).collect(),
                    warnings,
                }
            }
            Ok(Err(error)) => BrowserDebugStatusSnapshot {
                available: false,
                mode,
                status: "degraded",
                package_root,
                server_name: Some(server_name.to_string()),
                browser_url,
                tools: Vec::new(),
                warnings: vec![error],
            },
            Err(_) => BrowserDebugStatusSnapshot {
                available: false,
                mode,
                status: "degraded",
                package_root,
                server_name: Some(server_name.to_string()),
                browser_url,
                tools: Vec::new(),
                warnings: vec![format!("Timed out while querying {server_name} MCP.")],
            },
        }
    };

    let playwright_snapshot = match resolve_playwright_mcp_launch_config(workspace_path) {
        Ok(Some(config)) => collect_from_config(config, "mcp-playwright", "playwright").await,
        Ok(None) => BrowserDebugStatusSnapshot {
            available: false,
            mode: "unavailable",
            status: "unavailable",
            package_root: None,
            server_name: None,
            browser_url: None,
            tools: Vec::new(),
            warnings: vec![
                "Playwright MCP is unavailable. Add @playwright/mcp to the workspace and ensure node/pnpm are installed.".to_string(),
            ],
        },
        Err(error) => BrowserDebugStatusSnapshot {
            available: false,
            mode: "mcp-playwright",
            status: "degraded",
            package_root: None,
            server_name: Some("playwright".to_string()),
            browser_url: None,
            tools: Vec::new(),
            warnings: vec![error],
        },
    };
    if playwright_snapshot.available {
        return playwright_snapshot;
    }

    let chrome_snapshot =
        match resolve_chrome_devtools_mcp_launch_config(workspace_path, browser_url) {
        Ok(Some(config)) => {
            collect_from_config(config, "mcp-chrome-devtools", "chrome-devtools").await
        }
        Ok(None) => BrowserDebugStatusSnapshot {
            available: false,
            mode: "unavailable",
            status: "unavailable",
            package_root: None,
            server_name: None,
            browser_url: normalize_browser_debug_browser_url(browser_url),
            tools: Vec::new(),
            warnings: vec![
                "Chrome DevTools MCP is unavailable. Ensure npx is installed and a connectable Chrome session exists.".to_string(),
            ],
        },
        Err(error) => BrowserDebugStatusSnapshot {
            available: false,
            mode: "mcp-chrome-devtools",
            status: "degraded",
            package_root: None,
            server_name: Some("chrome-devtools".to_string()),
            browser_url: normalize_browser_debug_browser_url(browser_url),
            tools: Vec::new(),
            warnings: vec![error],
        },
    };
    if chrome_snapshot.available {
        let mut snapshot = chrome_snapshot;
        snapshot.warnings.extend(playwright_snapshot.warnings);
        return snapshot;
    }
    if chrome_snapshot.status != "unavailable" {
        let mut snapshot = chrome_snapshot;
        snapshot.warnings.extend(playwright_snapshot.warnings);
        return snapshot;
    }
    if playwright_snapshot.status != "unavailable" {
        let mut snapshot = playwright_snapshot;
        snapshot.warnings.extend(chrome_snapshot.warnings);
        return snapshot;
    }
    BrowserDebugStatusSnapshot {
        available: false,
        mode: "unavailable",
        status: "unavailable",
        package_root: None,
        server_name: None,
        browser_url: chrome_snapshot.browser_url.clone(),
        tools: Vec::new(),
        warnings: playwright_snapshot
            .warnings
            .into_iter()
            .chain(chrome_snapshot.warnings.into_iter())
            .collect(),
    }
}

async fn run_browser_debug_operation(
    workspace_path: &Path,
    request: &BrowserDebugRunRequest,
) -> BrowserDebugRunSnapshot {
    if request.operation.trim() == "chatgpt_decision_lab" {
        return decision_lab::run_chatgpt_decision_lab_operation(workspace_path, request).await;
    }
    let timeout_ms = request
        .timeout_ms
        .unwrap_or(BROWSER_DEBUG_DEFAULT_TIMEOUT_MS)
        .clamp(1_000, BROWSER_DEBUG_MAX_TIMEOUT_MS);
    let operation = request.operation.trim();
    let requested_browser_url =
        normalize_browser_debug_browser_url(request.browser_url.as_deref());
    if operation == "inspect" && requested_browser_url.is_some() {
        let Ok(Some(config)) =
            resolve_chrome_devtools_mcp_launch_config(workspace_path, request.browser_url.as_deref())
        else {
            return BrowserDebugRunSnapshot {
                available: false,
                status: "blocked",
                mode: "mcp-chrome-devtools",
                browser_url: requested_browser_url,
                message: "Chrome DevTools MCP is unavailable for runtime browser inspect.".to_string(),
                tool_calls: Vec::new(),
                content_text: None,
                structured_content: None,
                artifacts: Vec::new(),
                warnings: vec![
                    "Chrome DevTools MCP is unavailable. Install Node/npx and provide a connectable browser debug target.".to_string(),
                ],
                decision_lab: None,
            };
        };
        return chrome::run_chrome_devtools_inspect(&config, request, timeout_ms).await;
    }

    let Ok(Some(config)) = resolve_playwright_mcp_launch_config(workspace_path) else {
        return BrowserDebugRunSnapshot {
            available: false,
            status: "blocked",
            mode: "unavailable",
            browser_url: requested_browser_url,
            message: "Playwright MCP is unavailable for runtime browser debug.".to_string(),
            tool_calls: Vec::new(),
            content_text: None,
            structured_content: None,
            artifacts: Vec::new(),
            warnings: vec![
                "Playwright MCP is unavailable. Add @playwright/mcp to the workspace and ensure node/pnpm are installed.".to_string(),
            ],
            decision_lab: None,
        };
    };

    let result = timeout(Duration::from_millis(timeout_ms), async move {
        let mut client = BrowserDebugMcpClient::connect(&config).await?;
        let tools = client.list_tools().await?;
        let tool_name_set = tools
            .iter()
            .map(|tool| tool.name.as_str())
            .collect::<std::collections::BTreeSet<_>>();
        let steps = match operation {
            "inspect" => build_inspect_steps(
                tools.as_slice(),
                request.include_screenshot.unwrap_or(false),
            )?,
            "automation" => {
                let Some(steps) = request.steps.clone() else {
                    return Err(
                        "Browser automation requires at least one tool call step.".to_string()
                    );
                };
                if steps.is_empty() {
                    return Err(
                        "Browser automation requires at least one tool call step.".to_string()
                    );
                }
                steps
            }
            _ => {
                return Err(format!(
                    "Unsupported browser debug operation `{operation}`."
                ))
            }
        };

        let mut warnings = Vec::new();
        let mut tool_calls = Vec::new();
        for step in steps {
            if !tool_name_set.contains(step.tool_name.as_str()) {
                return Err(format!(
                    "Playwright MCP does not expose tool `{}` in this runtime.",
                    step.tool_name
                ));
            }
            let call_result = client
                .call_tool(step.tool_name.as_str(), step.arguments.clone())
                .await?;
            tool_calls.push(normalize_browser_call_result(
                step.tool_name.as_str(),
                call_result,
                &mut warnings,
            ));
        }
        let stderr = client.close().await;
        if !stderr.trim().is_empty() {
            warnings.push(stderr.trim().to_string());
        }
        Ok::<(Vec<Value>, Vec<String>), String>((tool_calls, warnings))
    })
    .await;

    match result {
        Ok(Ok((tool_calls, warnings))) => {
            let (content_text, structured_content, artifacts) =
                aggregate_browser_tool_call_results(tool_calls.as_slice());
            BrowserDebugRunSnapshot {
                available: true,
                status: "completed",
                mode: "mcp-playwright",
                browser_url: requested_browser_url,
                message: if request.operation.trim() == "inspect" {
                    request
                        .prompt
                        .as_deref()
                        .map(str::trim)
                        .filter(|value| !value.is_empty())
                        .map(|prompt| format!("Browser inspect completed for: {prompt}"))
                        .unwrap_or_else(|| "Browser inspect completed.".to_string())
                } else {
                    "Browser automation completed.".to_string()
                },
                tool_calls,
                content_text,
                structured_content,
                artifacts,
                warnings,
                decision_lab: None,
            }
        }
        Ok(Err(error)) => BrowserDebugRunSnapshot {
            available: false,
            status: "failed",
            mode: "mcp-playwright",
            browser_url: requested_browser_url,
            message: error.clone(),
            tool_calls: Vec::new(),
            content_text: None,
            structured_content: None,
            artifacts: Vec::new(),
            warnings: vec![error],
            decision_lab: None,
        },
        Err(_) => BrowserDebugRunSnapshot {
            available: false,
            status: "failed",
            mode: "mcp-playwright",
            browser_url: requested_browser_url,
            message: "Timed out while running browser debug operation.".to_string(),
            tool_calls: Vec::new(),
            content_text: None,
            structured_content: None,
            artifacts: Vec::new(),
            warnings: vec!["Timed out while running browser debug operation.".to_string()],
            decision_lab: None,
        },
    }
}

pub(super) async fn handle_browser_debug_status_v1(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let request: BrowserDebugStatusRequest =
        serde_json::from_value(params.clone()).map_err(|error| {
            RpcError::invalid_params(format!("Invalid browser debug status payload: {error}"))
        })?;
    let workspace_path =
        super::workspace_git_dispatch::resolve_workspace_path(ctx, request.workspace_id.as_str())
            .await?;
    let snapshot = collect_browser_debug_status(
        workspace_path.as_path(),
        BROWSER_DEBUG_DEFAULT_TIMEOUT_MS,
        request.browser_url.as_deref(),
    )
    .await;
    Ok(json!({
        "workspaceId": request.workspace_id,
        "available": snapshot.available,
        "mode": snapshot.mode,
        "status": snapshot.status,
        "packageRoot": snapshot.package_root,
        "serverName": snapshot.server_name,
        "browserUrl": snapshot.browser_url,
        "tools": snapshot.tools,
        "warnings": snapshot.warnings,
    }))
}

pub(super) async fn handle_browser_debug_run_v1(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let request: BrowserDebugRunRequest =
        serde_json::from_value(params.clone()).map_err(|error| {
            RpcError::invalid_params(format!("Invalid browser debug run payload: {error}"))
        })?;
    let workspace_path =
        super::workspace_git_dispatch::resolve_workspace_path(ctx, request.workspace_id.as_str())
            .await?;
    let result = run_browser_debug_operation(workspace_path.as_path(), &request).await;
    Ok(json!({
        "workspaceId": request.workspace_id,
        "available": result.available,
        "status": result.status,
        "mode": result.mode,
        "operation": request.operation,
        "browserUrl": result.browser_url,
        "message": result.message,
        "toolCalls": result.tool_calls,
        "contentText": result.content_text,
        "structuredContent": result.structured_content,
        "artifacts": result.artifacts,
        "decisionLab": result.decision_lab,
        "warnings": result.warnings,
    }))
}

#[cfg(test)]
#[path = "rpc_dispatch_browser_debug_tests.rs"]
mod tests;
