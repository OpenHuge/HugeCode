use crate::backend::{runtime_backend, RuntimePromptLibraryEntry, RuntimePromptScope};

#[tauri::command]
pub fn code_prompt_library_list(workspace_id: Option<String>) -> Vec<RuntimePromptLibraryEntry> {
    runtime_backend().prompt_library(workspace_id.as_deref())
}

#[tauri::command]
pub fn code_prompt_library_create(
    workspace_id: Option<String>,
    scope: RuntimePromptScope,
    title: String,
    description: String,
    content: String,
) -> Result<RuntimePromptLibraryEntry, String> {
    runtime_backend().prompt_library_create(
        workspace_id.as_deref(),
        scope,
        &title,
        &description,
        &content,
    )
}

#[tauri::command]
pub fn code_prompt_library_update(
    workspace_id: Option<String>,
    prompt_id: String,
    title: String,
    description: String,
    content: String,
) -> Result<RuntimePromptLibraryEntry, String> {
    runtime_backend().prompt_library_update(
        workspace_id.as_deref(),
        &prompt_id,
        &title,
        &description,
        &content,
    )
}

#[tauri::command]
pub fn code_prompt_library_delete(
    workspace_id: Option<String>,
    prompt_id: String,
) -> Result<bool, String> {
    runtime_backend().prompt_library_delete(workspace_id.as_deref(), &prompt_id)
}

#[tauri::command]
pub fn code_prompt_library_move(
    workspace_id: Option<String>,
    prompt_id: String,
    target_scope: RuntimePromptScope,
) -> Result<RuntimePromptLibraryEntry, String> {
    runtime_backend().prompt_library_move(workspace_id.as_deref(), &prompt_id, target_scope)
}
