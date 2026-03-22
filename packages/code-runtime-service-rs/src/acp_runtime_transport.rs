use super::{truncate_text_for_error, AcpInitializeProbeMetadata, AcpJsonRpcResponse};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;

const ACP_PROTOCOL_VERSION: &str = "2026-03-17";

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AcpServerInfo {
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    version: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AcpInitializeResult {
    #[serde(default, alias = "protocol_version")]
    protocol_version: Option<String>,
    #[serde(default, alias = "server_info")]
    server_info: Option<AcpServerInfo>,
    #[serde(default)]
    capabilities: Option<Value>,
}

fn build_acp_client_capabilities() -> Value {
    json!({
        "terminal": true,
        "configOptions": true,
        "slashCommands": true,
    })
}

fn build_probe_metadata(initialize_result: AcpInitializeResult) -> AcpInitializeProbeMetadata {
    AcpInitializeProbeMetadata {
        protocol_version: initialize_result.protocol_version,
        server_name: initialize_result
            .server_info
            .as_ref()
            .and_then(|server| server.name.clone()),
        server_version: initialize_result
            .server_info
            .as_ref()
            .and_then(|server| server.version.clone()),
        capabilities: initialize_result.capabilities.clone(),
        config_options: initialize_result.capabilities.and_then(|capabilities| {
            capabilities
                .get("configOptions")
                .cloned()
                .or_else(|| capabilities.get("config_options").cloned())
        }),
    }
}

pub(crate) async fn probe_acp_stdio_initialize(
    command: &str,
    args: &[String],
    cwd: Option<&str>,
    env: &HashMap<String, String>,
) -> Result<AcpInitializeProbeMetadata, String> {
    let command = command.trim();
    if command.is_empty() {
        return Err("ACP stdio probe requires a command.".to_string());
    }

    let mut child = Command::new(command);
    child
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(cwd) = cwd.map(str::trim).filter(|value| !value.is_empty()) {
        child.current_dir(cwd);
    }
    for (key, value) in env {
        if key.trim().is_empty() {
            continue;
        }
        child.env(key, value);
    }

    let mut child = child
        .spawn()
        .map_err(|error| format!("spawn ACP stdio transport failed: {error}"))?;
    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| "ACP stdio stdin unavailable".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "ACP stdio stdout unavailable".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "ACP stdio stderr unavailable".to_string())?;
    let stderr_task = tokio::spawn(async move {
        let mut reader = BufReader::new(stderr);
        let mut buffer = String::new();
        let _ = reader.read_to_string(&mut buffer).await;
        buffer
    });
    let mut stdout = BufReader::new(stdout).lines();

    let initialize_request = serde_json::to_string(&json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": ACP_PROTOCOL_VERSION,
            "clientInfo": {
                "name": "hypecode-runtime",
                "version": env!("CARGO_PKG_VERSION"),
            },
            "capabilities": {
                "terminal": true,
                "configOptions": true,
                "slashCommands": true,
            }
        }
    }))
    .map_err(|error| format!("encode ACP initialize request failed: {error}"))?;
    stdin
        .write_all(initialize_request.as_bytes())
        .await
        .map_err(|error| format!("write ACP initialize request failed: {error}"))?;
    stdin
        .write_all(b"\n")
        .await
        .map_err(|error| format!("write ACP initialize newline failed: {error}"))?;
    stdin
        .flush()
        .await
        .map_err(|error| format!("flush ACP initialize request failed: {error}"))?;

    let initialize_payload = loop {
        let Some(line) = stdout
            .next_line()
            .await
            .map_err(|error| format!("read ACP initialize response failed: {error}"))?
        else {
            let stderr = stderr_task.await.unwrap_or_default();
            return Err(format!(
                "ACP stdio transport exited before initialize response. stderr={}",
                truncate_text_for_error(stderr.trim(), 400)
            ));
        };
        if line.trim().is_empty() {
            continue;
        }
        let value: Value = serde_json::from_str(line.as_str())
            .map_err(|error| format!("decode ACP initialize response failed: {error}"))?;
        let response: AcpJsonRpcResponse = serde_json::from_value(value.clone())
            .map_err(|error| format!("parse ACP initialize response failed: {error}"))?;
        if response.id != json!(1) {
            continue;
        }
        if let Some(error) = response.error {
            let stderr = stderr_task.await.unwrap_or_default();
            return Err(format!(
                "ACP initialize failed: {}{}",
                error.message,
                if stderr.trim().is_empty() {
                    String::new()
                } else {
                    format!(" (stderr={})", truncate_text_for_error(stderr.trim(), 400))
                }
            ));
        }
        break response.result.unwrap_or(Value::Null);
    };

    let initialized_notification = serde_json::to_string(&json!({
        "jsonrpc": "2.0",
        "method": "initialized",
        "params": {},
    }))
    .map_err(|error| format!("encode ACP initialized notification failed: {error}"))?;
    stdin
        .write_all(initialized_notification.as_bytes())
        .await
        .map_err(|error| format!("write ACP initialized notification failed: {error}"))?;
    stdin
        .write_all(b"\n")
        .await
        .map_err(|error| format!("write ACP initialized newline failed: {error}"))?;
    stdin
        .flush()
        .await
        .map_err(|error| format!("flush ACP initialized notification failed: {error}"))?;
    let _ = stdin.shutdown().await;
    drop(stdin);

    let initialize_result: AcpInitializeResult = serde_json::from_value(initialize_payload)
        .map_err(|error| format!("parse ACP initialize result failed: {error}"))?;
    let _ = child.wait().await;
    let _ = stderr_task.await;
    Ok(build_probe_metadata(initialize_result))
}

pub(super) fn read_jsonrpc_id_u64(value: &Value) -> Option<u64> {
    value.get("id").and_then(|id| match id {
        Value::Number(number) => number.as_u64(),
        Value::String(value) => value.parse::<u64>().ok(),
        _ => None,
    })
}

pub(super) fn read_jsonrpc_method(value: &Value) -> Option<&str> {
    value.get("method").and_then(Value::as_str)
}

pub(super) async fn write_jsonrpc_notification(
    stdin: &mut tokio::process::ChildStdin,
    method: &str,
    params: Value,
) -> Result<(), String> {
    let encoded = serde_json::to_string(&json!({
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
    }))
    .map_err(|error| format!("encode ACP notification failed: {error}"))?;
    stdin
        .write_all(encoded.as_bytes())
        .await
        .map_err(|error| format!("write ACP notification failed: {error}"))?;
    stdin
        .write_all(b"\n")
        .await
        .map_err(|error| format!("write ACP notification newline failed: {error}"))?;
    stdin
        .flush()
        .await
        .map_err(|error| format!("flush ACP notification failed: {error}"))
}

pub(super) async fn write_jsonrpc_request(
    stdin: &mut tokio::process::ChildStdin,
    id: u64,
    method: &str,
    params: Value,
) -> Result<(), String> {
    let encoded = serde_json::to_string(&json!({
        "jsonrpc": "2.0",
        "id": id,
        "method": method,
        "params": params,
    }))
    .map_err(|error| format!("encode ACP request failed: {error}"))?;
    stdin
        .write_all(encoded.as_bytes())
        .await
        .map_err(|error| format!("write ACP request failed: {error}"))?;
    stdin
        .write_all(b"\n")
        .await
        .map_err(|error| format!("write ACP request newline failed: {error}"))?;
    stdin
        .flush()
        .await
        .map_err(|error| format!("flush ACP request failed: {error}"))
}

async fn read_initialize_result(
    stdout: &mut tokio::io::Lines<BufReader<tokio::process::ChildStdout>>,
) -> Result<AcpInitializeResult, String> {
    loop {
        let Some(line) = stdout
            .next_line()
            .await
            .map_err(|error| format!("read ACP initialize response failed: {error}"))?
        else {
            return Err("ACP stdio transport exited before initialize response.".to_string());
        };
        if line.trim().is_empty() {
            continue;
        }
        let value: Value = serde_json::from_str(line.as_str())
            .map_err(|error| format!("decode ACP initialize response failed: {error}"))?;
        let response: AcpJsonRpcResponse = serde_json::from_value(value)
            .map_err(|error| format!("parse ACP initialize response failed: {error}"))?;
        if response.id != json!(1) {
            continue;
        }
        if let Some(error) = response.error {
            return Err(format!("ACP initialize failed: {}", error.message));
        }
        return serde_json::from_value(response.result.unwrap_or(Value::Null))
            .map_err(|error| format!("parse ACP initialize result failed: {error}"));
    }
}

pub(super) async fn open_acp_stdio_transport(
    command: &str,
    args: &[String],
    cwd: Option<&str>,
    env: &HashMap<String, String>,
) -> Result<
    (
        tokio::process::Child,
        tokio::process::ChildStdin,
        tokio::io::Lines<BufReader<tokio::process::ChildStdout>>,
        tokio::task::JoinHandle<String>,
        AcpInitializeProbeMetadata,
    ),
    String,
> {
    let mut child = Command::new(command);
    child
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(cwd) = cwd.map(str::trim).filter(|value| !value.is_empty()) {
        child.current_dir(cwd);
    }
    for (key, value) in env {
        if key.trim().is_empty() {
            continue;
        }
        child.env(key, value);
    }
    let mut child = child
        .spawn()
        .map_err(|error| format!("spawn ACP stdio transport failed: {error}"))?;
    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| "ACP stdio stdin unavailable".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "ACP stdio stdout unavailable".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "ACP stdio stderr unavailable".to_string())?;
    let stderr_task = tokio::spawn(async move {
        let mut reader = BufReader::new(stderr);
        let mut buffer = String::new();
        let _ = reader.read_to_string(&mut buffer).await;
        buffer
    });
    let mut stdout = BufReader::new(stdout).lines();
    write_jsonrpc_request(
        &mut stdin,
        1,
        "initialize",
        json!({
            "protocolVersion": ACP_PROTOCOL_VERSION,
            "clientInfo": {
                "name": "hypecode-runtime",
                "version": env!("CARGO_PKG_VERSION"),
            },
            "capabilities": build_acp_client_capabilities(),
        }),
    )
    .await?;
    let initialize_result = read_initialize_result(&mut stdout).await?;
    write_jsonrpc_notification(&mut stdin, "initialized", json!({})).await?;
    let metadata = build_probe_metadata(initialize_result);
    Ok((child, stdin, stdout, stderr_task, metadata))
}
