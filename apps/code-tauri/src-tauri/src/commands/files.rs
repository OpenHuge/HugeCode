use crate::backend::{runtime_backend, RuntimeWorkspaceFileContent, RuntimeWorkspaceFileEntry};
use crate::runtime_service;
use serde_json::{json, Value};

#[tauri::command]
pub fn code_workspace_files_list(workspace_id: String) -> Vec<RuntimeWorkspaceFileEntry> {
    runtime_backend().workspace_files(&workspace_id)
}

#[tauri::command]
pub fn code_workspace_file_read(
    workspace_id: String,
    file_id: String,
) -> Option<RuntimeWorkspaceFileContent> {
    runtime_backend().workspace_file_read(&workspace_id, &file_id)
}

#[tauri::command]
pub async fn code_text_file_read_v1(
    scope: String,
    kind: String,
    workspace_id: Option<String>,
) -> Result<Value, String> {
    runtime_service::invoke_runtime_rpc(
        "code_text_file_read_v1",
        json!({
            "scope": scope,
            "kind": kind,
            "workspaceId": workspace_id,
        }),
    )
    .await
}

#[tauri::command]
pub async fn code_text_file_write_v1(
    scope: String,
    kind: String,
    content: String,
    workspace_id: Option<String>,
) -> Result<Value, String> {
    runtime_service::invoke_runtime_rpc(
        "code_text_file_write_v1",
        json!({
            "scope": scope,
            "kind": kind,
            "content": content,
            "workspaceId": workspace_id,
        }),
    )
    .await
}
