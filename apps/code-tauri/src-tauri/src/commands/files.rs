use crate::backend::{runtime_backend, RuntimeWorkspaceFileContent, RuntimeWorkspaceFileEntry};

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
