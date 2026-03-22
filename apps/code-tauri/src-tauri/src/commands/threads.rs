use crate::backend::runtime_backend;
use crate::models::{
    ThreadLiveSubscribeRequest, ThreadLiveSubscribeResult, ThreadLiveUnsubscribeRequest,
    ThreadLiveUnsubscribeResult, ThreadSummary,
};
use crate::runtime_service;

#[tauri::command]
pub fn code_threads_list(workspace_id: String) -> Vec<ThreadSummary> {
    runtime_backend().threads(&workspace_id)
}

#[tauri::command]
pub fn code_thread_create(workspace_id: String, title: Option<String>) -> ThreadSummary {
    runtime_backend().create_thread(&workspace_id, title)
}

#[tauri::command]
pub fn code_thread_resume(workspace_id: String, thread_id: String) -> Option<ThreadSummary> {
    runtime_backend().resume_thread(&workspace_id, &thread_id)
}

#[tauri::command]
pub fn code_thread_archive(workspace_id: String, thread_id: String) -> bool {
    runtime_backend().archive_thread(&workspace_id, &thread_id)
}

#[tauri::command]
pub async fn code_thread_live_subscribe(
    payload: ThreadLiveSubscribeRequest,
) -> Result<ThreadLiveSubscribeResult, String> {
    runtime_service::thread_live_subscribe(&payload.workspace_id, &payload.thread_id).await
}

#[tauri::command]
pub async fn code_thread_live_unsubscribe(
    payload: ThreadLiveUnsubscribeRequest,
) -> ThreadLiveUnsubscribeResult {
    runtime_service::thread_live_unsubscribe(&payload.subscription_id).await
}
