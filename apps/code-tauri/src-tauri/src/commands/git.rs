use crate::backend::{
    runtime_backend, RuntimeGitBranchesSnapshot, RuntimeGitChangesSnapshot, RuntimeGitCommitResult,
    RuntimeGitDiff, RuntimeGitOperationResult,
};

#[tauri::command]
pub fn code_git_changes_list(workspace_id: String) -> RuntimeGitChangesSnapshot {
    runtime_backend().git_changes(&workspace_id)
}

#[tauri::command]
pub fn code_git_diff_read(
    workspace_id: String,
    change_id: String,
    offset: Option<u64>,
    max_bytes: Option<u64>,
) -> Option<RuntimeGitDiff> {
    let normalized_offset = offset.and_then(|value| usize::try_from(value).ok());
    let normalized_max_bytes = max_bytes.and_then(|value| usize::try_from(value).ok());
    runtime_backend().git_diff_read(
        &workspace_id,
        &change_id,
        normalized_offset,
        normalized_max_bytes,
    )
}

#[tauri::command]
pub fn code_git_branches_list(workspace_id: String) -> RuntimeGitBranchesSnapshot {
    runtime_backend().git_branches(&workspace_id)
}

#[tauri::command]
pub fn code_git_branch_create(
    workspace_id: String,
    branch_name: String,
) -> RuntimeGitOperationResult {
    runtime_backend().git_branch_create(&workspace_id, &branch_name)
}

#[tauri::command]
pub fn code_git_branch_checkout(
    workspace_id: String,
    branch_name: String,
) -> RuntimeGitOperationResult {
    runtime_backend().git_branch_checkout(&workspace_id, &branch_name)
}

#[tauri::command]
pub fn code_git_stage_change(workspace_id: String, change_id: String) -> RuntimeGitOperationResult {
    runtime_backend().git_stage_change(&workspace_id, &change_id)
}

#[tauri::command]
pub fn code_git_stage_all(workspace_id: String) -> RuntimeGitOperationResult {
    runtime_backend().git_stage_all(&workspace_id)
}

#[tauri::command]
pub fn code_git_unstage_change(
    workspace_id: String,
    change_id: String,
) -> RuntimeGitOperationResult {
    runtime_backend().git_unstage_change(&workspace_id, &change_id)
}

#[tauri::command]
pub fn code_git_revert_change(
    workspace_id: String,
    change_id: String,
) -> RuntimeGitOperationResult {
    runtime_backend().git_revert_change(&workspace_id, &change_id)
}

#[tauri::command]
pub fn code_git_commit(workspace_id: String, message: String) -> RuntimeGitCommitResult {
    runtime_backend().git_commit(&workspace_id, &message)
}
