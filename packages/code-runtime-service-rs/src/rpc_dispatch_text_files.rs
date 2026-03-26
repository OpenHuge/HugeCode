use super::*;
use crate::local_codex_cli_sessions::{resolve_local_codex_config_path, resolve_local_codex_home_dir};
use serde::Serialize;
use super::workspace_git_dispatch::resolve_workspace_path;

const TEXT_FILE_READ_MAX_BYTES: usize = 512 * 1024;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum RuntimeTextFileScope {
    Workspace,
    Global,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum RuntimeTextFileKind {
    Agents,
    Config,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeTextFileResponsePayload {
    exists: bool,
    content: String,
    truncated: bool,
}

fn parse_text_file_scope(
    params: &serde_json::Map<String, Value>,
) -> Result<RuntimeTextFileScope, RpcError> {
    match read_required_string(params, "scope")? {
        "workspace" => Ok(RuntimeTextFileScope::Workspace),
        "global" => Ok(RuntimeTextFileScope::Global),
        other => Err(RpcError::invalid_params(format!(
            "Unsupported text file scope `{other}`."
        ))),
    }
}

fn parse_text_file_kind(
    params: &serde_json::Map<String, Value>,
) -> Result<RuntimeTextFileKind, RpcError> {
    match read_required_string(params, "kind")? {
        "agents" => Ok(RuntimeTextFileKind::Agents),
        "config" => Ok(RuntimeTextFileKind::Config),
        other => Err(RpcError::invalid_params(format!(
            "Unsupported text file kind `{other}`."
        ))),
    }
}

fn text_file_name(kind: RuntimeTextFileKind) -> &'static str {
    match kind {
        RuntimeTextFileKind::Agents => "AGENTS.md",
        RuntimeTextFileKind::Config => "config.toml",
    }
}

fn resolve_global_text_file_path(kind: RuntimeTextFileKind) -> Option<PathBuf> {
    match kind {
        RuntimeTextFileKind::Agents => resolve_local_codex_home_dir().map(|home| home.join("AGENTS.md")),
        RuntimeTextFileKind::Config => resolve_local_codex_config_path(),
    }
}

async fn resolve_text_file_path(
    ctx: &AppContext,
    scope: RuntimeTextFileScope,
    kind: RuntimeTextFileKind,
    workspace_id: Option<&str>,
) -> Result<Option<PathBuf>, RpcError> {
    match scope {
        RuntimeTextFileScope::Global => Ok(resolve_global_text_file_path(kind)),
        RuntimeTextFileScope::Workspace => {
            let workspace_id = workspace_id.ok_or_else(|| {
                RpcError::invalid_params("workspaceId is required for workspace text files.")
            })?;
            let workspace_root: PathBuf = resolve_workspace_path(ctx, workspace_id).await?;
            Ok(Some(workspace_root.join(text_file_name(kind))))
        }
    }
}

fn unavailable_text_file_path_message(kind: RuntimeTextFileKind) -> &'static str {
    match kind {
        RuntimeTextFileKind::Agents => "Local Codex home directory is unavailable for AGENTS.md.",
        RuntimeTextFileKind::Config => "Local Codex config.toml path is unavailable.",
    }
}

pub(super) async fn handle_text_file_read_v1(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let scope = parse_text_file_scope(params)?;
    let kind = parse_text_file_kind(params)?;
    let workspace_id = read_optional_string(params, "workspaceId");
    let path = resolve_text_file_path(ctx, scope, kind, workspace_id.as_deref()).await?;

    let Some(path) = path else {
        return Ok(json!(RuntimeTextFileResponsePayload {
            exists: false,
            content: String::new(),
            truncated: false,
        }));
    };

    let response = tokio::task::spawn_blocking(move || -> Result<RuntimeTextFileResponsePayload, RpcError> {
        match fs::read(path.as_path()) {
            Ok(content_bytes) => {
                let truncated = content_bytes.len() > TEXT_FILE_READ_MAX_BYTES;
                let content_slice = if truncated {
                    &content_bytes[..TEXT_FILE_READ_MAX_BYTES]
                } else {
                    content_bytes.as_slice()
                };
                Ok(RuntimeTextFileResponsePayload {
                    exists: true,
                    content: String::from_utf8_lossy(content_slice).to_string(),
                    truncated,
                })
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                Ok(RuntimeTextFileResponsePayload {
                    exists: false,
                    content: String::new(),
                    truncated: false,
                })
            }
            Err(error) => Err(RpcError::internal(format!(
                "read text file `{}`: {error}",
                path.display()
            ))),
        }
    })
    .await
    .map_err(|error| RpcError::internal(format!("read text file task join error: {error}")))??;

    Ok(json!(response))
}

pub(super) async fn handle_text_file_write_v1(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let scope = parse_text_file_scope(params)?;
    let kind = parse_text_file_kind(params)?;
    let workspace_id = read_optional_string(params, "workspaceId");
    let content = read_required_string(params, "content")?.to_string();
    let path = resolve_text_file_path(ctx, scope, kind, workspace_id.as_deref()).await?;

    let Some(path) = path else {
        return Err(RpcError::invalid_params(
            unavailable_text_file_path_message(kind),
        ));
    };

    tokio::task::spawn_blocking(move || -> Result<(), RpcError> {
        let Some(parent) = path.parent() else {
            return Err(RpcError::internal(format!(
                "text file `{}` has no parent directory",
                path.display()
            )));
        };
        fs::create_dir_all(parent).map_err(|error| {
            RpcError::internal(format!(
                "create text file parent directory `{}`: {error}",
                parent.display()
            ))
        })?;
        fs::write(path.as_path(), content).map_err(|error| {
            RpcError::internal(format!("write text file `{}`: {error}", path.display()))
        })
    })
    .await
    .map_err(|error| RpcError::internal(format!("write text file task join error: {error}")))??;

    Ok(Value::Bool(true))
}
