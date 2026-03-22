use super::*;
use crate::local_codex_cli_sessions::resolve_local_codex_playwright_runtime_availability;
use serde::Deserialize;
use serde_json::{json, Map, Value};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};
use tokio::time::{timeout, Duration};

const BROWSER_DEBUG_MCP_COMMAND_OVERRIDE_ENV: &str =
    "CODE_RUNTIME_BROWSER_DEBUG_PLAYWRIGHT_COMMAND";
const BROWSER_DEBUG_MCP_ARGS_OVERRIDE_ENV: &str = "CODE_RUNTIME_BROWSER_DEBUG_PLAYWRIGHT_ARGS_JSON";
const BROWSER_DEBUG_DEFAULT_TIMEOUT_MS: u64 = 20_000;
const BROWSER_DEBUG_MAX_TIMEOUT_MS: u64 = 120_000;
const BROWSER_DEBUG_PROTOCOL_VERSION: &str = "2025-03-26";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BrowserDebugStatusRequest {
    #[serde(alias = "workspace_id")]
    workspace_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BrowserDebugRunRequest {
    #[serde(alias = "workspace_id")]
    workspace_id: String,
    operation: String,
    #[serde(default)]
    prompt: Option<String>,
    #[serde(default, alias = "include_screenshot")]
    include_screenshot: Option<bool>,
    #[serde(default, alias = "timeout_ms")]
    timeout_ms: Option<u64>,
    #[serde(default)]
    steps: Option<Vec<BrowserDebugToolCallRequest>>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BrowserDebugToolCallRequest {
    #[serde(alias = "tool_name")]
    tool_name: String,
    #[serde(default)]
    arguments: Option<Map<String, Value>>,
}

#[derive(Clone, Debug)]
struct PlaywrightMcpLaunchConfig {
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
    tools: Vec<Value>,
    warnings: Vec<String>,
}

#[derive(Clone, Debug)]
struct BrowserDebugRunSnapshot {
    available: bool,
    status: &'static str,
    mode: &'static str,
    message: String,
    tool_calls: Vec<Value>,
    content_text: Option<String>,
    structured_content: Option<Value>,
    artifacts: Vec<Value>,
    warnings: Vec<String>,
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
    async fn connect(config: &PlaywrightMcpLaunchConfig) -> Result<Self, String> {
        let mut command = Command::new(&config.command);
        command
            .args(&config.args)
            .current_dir(&config.cwd)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        let mut child = command
            .spawn()
            .map_err(|error| format!("spawn playwright mcp failed: {error}"))?;
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "playwright mcp stdin unavailable".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "playwright mcp stdout unavailable".to_string())?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| "playwright mcp stderr unavailable".to_string())?;
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
            if line.trim().is_empty() {
                continue;
            }
            let value: Value = serde_json::from_str(line.as_str())
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
        let _ = self.child.kill().await;
        let _ = self.child.wait().await;
        self.stderr_task.await.unwrap_or_default()
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

fn resolve_playwright_mcp_launch_config(
    workspace_path: &Path,
) -> Result<Option<PlaywrightMcpLaunchConfig>, String> {
    let availability = resolve_local_codex_playwright_runtime_availability(workspace_path.to_str());
    if let Ok(command) = std::env::var(BROWSER_DEBUG_MCP_COMMAND_OVERRIDE_ENV) {
        let trimmed = command.trim();
        if !trimmed.is_empty() {
            let args = match std::env::var(BROWSER_DEBUG_MCP_ARGS_OVERRIDE_ENV) {
                Ok(raw) if !raw.trim().is_empty() => parse_mcp_args_override(raw.as_str())?,
                _ => Vec::new(),
            };
            return Ok(Some(PlaywrightMcpLaunchConfig {
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
    Ok(Some(PlaywrightMcpLaunchConfig {
        command: "pnpm".to_string(),
        args: vec!["exec".to_string(), "playwright-mcp".to_string()],
        cwd: availability
            .package_root
            .clone()
            .unwrap_or_else(|| workspace_path.to_path_buf()),
        package_root: availability.package_root,
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
) -> BrowserDebugStatusSnapshot {
    let Ok(Some(config)) = resolve_playwright_mcp_launch_config(workspace_path) else {
        return BrowserDebugStatusSnapshot {
            available: false,
            mode: "unavailable",
            status: "unavailable",
            package_root: None,
            server_name: None,
            tools: Vec::new(),
            warnings: vec![
                "Playwright MCP is unavailable. Add @playwright/mcp to the workspace and ensure node/pnpm are installed.".to_string(),
            ],
        };
    };
    let package_root = config
        .package_root
        .as_ref()
        .map(|path| path.to_string_lossy().to_string());
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
                mode: "mcp-playwright",
                status: "ready",
                package_root,
                server_name: Some("playwright".to_string()),
                tools: tools.iter().map(normalize_browser_tool_summary).collect(),
                warnings,
            }
        }
        Ok(Err(error)) => BrowserDebugStatusSnapshot {
            available: false,
            mode: "mcp-playwright",
            status: "degraded",
            package_root,
            server_name: Some("playwright".to_string()),
            tools: Vec::new(),
            warnings: vec![error],
        },
        Err(_) => BrowserDebugStatusSnapshot {
            available: false,
            mode: "mcp-playwright",
            status: "degraded",
            package_root,
            server_name: Some("playwright".to_string()),
            tools: Vec::new(),
            warnings: vec!["Timed out while querying Playwright MCP.".to_string()],
        },
    }
}

async fn run_browser_debug_operation(
    workspace_path: &Path,
    request: &BrowserDebugRunRequest,
) -> BrowserDebugRunSnapshot {
    let Ok(Some(config)) = resolve_playwright_mcp_launch_config(workspace_path) else {
        return BrowserDebugRunSnapshot {
            available: false,
            status: "blocked",
            mode: "unavailable",
            message: "Playwright MCP is unavailable for runtime browser debug.".to_string(),
            tool_calls: Vec::new(),
            content_text: None,
            structured_content: None,
            artifacts: Vec::new(),
            warnings: vec![
                "Playwright MCP is unavailable. Add @playwright/mcp to the workspace and ensure node/pnpm are installed.".to_string(),
            ],
        };
    };

    let timeout_ms = request
        .timeout_ms
        .unwrap_or(BROWSER_DEBUG_DEFAULT_TIMEOUT_MS)
        .clamp(1_000, BROWSER_DEBUG_MAX_TIMEOUT_MS);
    let operation = request.operation.trim();
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
            }
        }
        Ok(Err(error)) => BrowserDebugRunSnapshot {
            available: false,
            status: "failed",
            mode: "mcp-playwright",
            message: error.clone(),
            tool_calls: Vec::new(),
            content_text: None,
            structured_content: None,
            artifacts: Vec::new(),
            warnings: vec![error],
        },
        Err(_) => BrowserDebugRunSnapshot {
            available: false,
            status: "failed",
            mode: "mcp-playwright",
            message: "Timed out while running browser debug operation.".to_string(),
            tool_calls: Vec::new(),
            content_text: None,
            structured_content: None,
            artifacts: Vec::new(),
            warnings: vec!["Timed out while running browser debug operation.".to_string()],
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
    let snapshot =
        collect_browser_debug_status(workspace_path.as_path(), BROWSER_DEBUG_DEFAULT_TIMEOUT_MS)
            .await;
    Ok(json!({
        "workspaceId": request.workspace_id,
        "available": snapshot.available,
        "mode": snapshot.mode,
        "status": snapshot.status,
        "packageRoot": snapshot.package_root,
        "serverName": snapshot.server_name,
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
        "message": result.message,
        "toolCalls": result.tool_calls,
        "contentText": result.content_text,
        "structuredContent": result.structured_content,
        "artifacts": result.artifacts,
        "warnings": result.warnings,
    }))
}

#[cfg(test)]
mod tests {
    use super::{
        collect_browser_debug_status, run_browser_debug_operation, BrowserDebugRunRequest,
        BROWSER_DEBUG_MCP_ARGS_OVERRIDE_ENV, BROWSER_DEBUG_MCP_COMMAND_OVERRIDE_ENV,
    };
    use serde_json::{json, Map};
    use std::fs;
    use std::sync::{Mutex, OnceLock};
    use tempfile::TempDir;

    #[cfg(unix)]
    use std::os::unix::fs::PermissionsExt;

    fn browser_debug_env_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    fn write_fake_playwright_server_script(temp: &TempDir) -> std::path::PathBuf {
        let script_path = temp.path().join("fake-playwright-mcp.sh");
        let script = r#"#!/bin/sh
while IFS= read -r line; do
  id=$(printf '%s' "$line" | sed -n 's/.*"id":\([0-9][0-9]*\).*/\1/p')
  case "$line" in
    *'"method":"initialize"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"capabilities":{"tools":{"listChanged":true}},"serverInfo":{"name":"fake-playwright-mcp","version":"0.0.0"},"protocolVersion":"2025-03-26"}}\n' "$id"
      ;;
    *'"method":"notifications/initialized"'*)
      ;;
    *'"method":"tools/list"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"tools":[{"name":"browser_snapshot","description":"Snapshot","annotations":{"readOnlyHint":true},"inputSchema":{"type":"object"}},{"name":"browser_take_screenshot","description":"Screenshot","inputSchema":{"type":"object"}},{"name":"browser_navigate","description":"Navigate","inputSchema":{"type":"object"}}]}}\n' "$id"
      ;;
    *'"method":"tools/call"'*'"name":"browser_snapshot"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"content":[{"type":"text","text":"Page snapshot: Example"}],"structuredContent":{"url":"https://example.com","title":"Example"}}}\n' "$id"
      ;;
    *'"method":"tools/call"'*'"name":"browser_take_screenshot"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"content":[{"type":"image","mimeType":"image/png","data":"YWJj"}]}}\n' "$id"
      ;;
    *'"method":"tools/call"'*'"name":"browser_navigate"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"content":[{"type":"text","text":"Navigated"}]}}\n' "$id"
      ;;
  esac
done
"#;
        fs::write(&script_path, script).expect("write fake playwright server script");
        #[cfg(unix)]
        let mut permissions = fs::metadata(&script_path)
            .expect("fake server metadata")
            .permissions();
        #[cfg(unix)]
        permissions.set_mode(0o755);
        #[cfg(unix)]
        fs::set_permissions(&script_path, permissions).expect("set fake server permissions");
        script_path
    }

    fn write_workspace_manifest(temp: &TempDir) {
        fs::write(
            temp.path().join("package.json"),
            r#"{
  "name": "browser-debug-test",
  "devDependencies": {
    "@playwright/mcp": "^0.0.68"
  }
}"#,
        )
        .expect("write package.json");
    }

    #[tokio::test]
    async fn collect_browser_debug_status_lists_playwright_tools_via_override() {
        let _guard = browser_debug_env_lock()
            .lock()
            .expect("browser debug env lock poisoned");
        let temp = TempDir::new().expect("create temp dir");
        write_workspace_manifest(&temp);
        let script_path = write_fake_playwright_server_script(&temp);

        std::env::set_var(
            BROWSER_DEBUG_MCP_COMMAND_OVERRIDE_ENV,
            script_path.as_os_str(),
        );
        std::env::set_var(BROWSER_DEBUG_MCP_ARGS_OVERRIDE_ENV, "[]");

        let snapshot = collect_browser_debug_status(temp.path(), 5_000).await;
        assert!(snapshot.available);
        assert_eq!(snapshot.mode, "mcp-playwright");
        assert_eq!(snapshot.status, "ready");
        assert!(snapshot
            .tools
            .iter()
            .any(|tool| tool.get("name") == Some(&json!("browser_snapshot"))));

        std::env::remove_var(BROWSER_DEBUG_MCP_COMMAND_OVERRIDE_ENV);
        std::env::remove_var(BROWSER_DEBUG_MCP_ARGS_OVERRIDE_ENV);
    }

    #[tokio::test]
    async fn run_browser_debug_operation_executes_multiple_steps_and_collects_artifacts() {
        let _guard = browser_debug_env_lock()
            .lock()
            .expect("browser debug env lock poisoned");
        let temp = TempDir::new().expect("create temp dir");
        write_workspace_manifest(&temp);
        let script_path = write_fake_playwright_server_script(&temp);

        std::env::set_var(
            BROWSER_DEBUG_MCP_COMMAND_OVERRIDE_ENV,
            script_path.as_os_str(),
        );
        std::env::set_var(BROWSER_DEBUG_MCP_ARGS_OVERRIDE_ENV, "[]");

        let request = BrowserDebugRunRequest {
            workspace_id: "ws-browser".to_string(),
            operation: "automation".to_string(),
            prompt: None,
            include_screenshot: Some(false),
            timeout_ms: Some(5_000),
            steps: Some(vec![
                super::BrowserDebugToolCallRequest {
                    tool_name: "browser_navigate".to_string(),
                    arguments: Some(Map::from_iter([(
                        "url".to_string(),
                        json!("https://example.com"),
                    )])),
                },
                super::BrowserDebugToolCallRequest {
                    tool_name: "browser_take_screenshot".to_string(),
                    arguments: Some(Map::new()),
                },
            ]),
        };

        let result = run_browser_debug_operation(temp.path(), &request).await;
        assert!(result.available);
        assert_eq!(result.status, "completed");
        assert_eq!(result.mode, "mcp-playwright");
        assert_eq!(result.tool_calls.len(), 2);
        assert_eq!(result.artifacts.len(), 1);
        assert_eq!(result.artifacts[0].get("kind"), Some(&json!("image")));

        std::env::remove_var(BROWSER_DEBUG_MCP_COMMAND_OVERRIDE_ENV);
        std::env::remove_var(BROWSER_DEBUG_MCP_ARGS_OVERRIDE_ENV);
    }
}
