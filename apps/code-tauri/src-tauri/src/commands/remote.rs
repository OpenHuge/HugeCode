use crate::backend::runtime_backend;
use crate::models::RemoteStatus;

#[tauri::command]
pub fn code_remote_status() -> RemoteStatus {
    runtime_backend().remote_status()
}
