use crate::runtime_service;
use serde_json::Value;
use tauri::AppHandle;

fn empty_payload() -> Value {
    Value::Object(serde_json::Map::new())
}

#[tauri::command]
pub async fn code_mission_control_snapshot_v1() -> Result<Value, String> {
    runtime_service::invoke_runtime_rpc("code_mission_control_snapshot_v1", empty_payload()).await
}

async fn invoke_runtime_run_start(app: AppHandle, payload: Value) -> Result<Value, String> {
    let workspace_id = payload
        .get("workspaceId")
        .or_else(|| payload.get("workspace_id"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);
    let result = runtime_service::invoke_runtime_rpc("code_runtime_run_start", payload).await?;
    if let Some(task_id) = result
        .get("taskId")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        let _ = runtime_service::refresh_agent_task_state_fabric(&app, task_id, workspace_id).await;
    }
    Ok(result)
}

async fn invoke_runtime_run_cancel(app: AppHandle, payload: Value) -> Result<Value, String> {
    let result = runtime_service::invoke_runtime_rpc("code_runtime_run_cancel", payload).await?;
    if result
        .get("accepted")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        if let Some(task_id) = result
            .get("taskId")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            let _ = runtime_service::refresh_agent_task_state_fabric(&app, task_id, None).await;
        }
    }
    Ok(result)
}

async fn invoke_runtime_run_resume(app: AppHandle, payload: Value) -> Result<Value, String> {
    let result = runtime_service::invoke_runtime_rpc("code_runtime_run_resume", payload).await?;
    if result
        .get("accepted")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        if let Some(task_id) = result
            .get("taskId")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            let _ = runtime_service::refresh_agent_task_state_fabric(&app, task_id, None).await;
        }
    }
    Ok(result)
}

async fn invoke_runtime_run_intervene(app: AppHandle, payload: Value) -> Result<Value, String> {
    let result = runtime_service::invoke_runtime_rpc("code_runtime_run_intervene", payload).await?;
    if result
        .get("accepted")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        for run_id in ["runId", "spawnedRunId"] {
            if let Some(task_id) = result
                .get(run_id)
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
            {
                let _ = runtime_service::refresh_agent_task_state_fabric(&app, task_id, None).await;
            }
        }
    }
    Ok(result)
}

async fn invoke_kernel_job_start_v3(app: AppHandle, payload: Value) -> Result<Value, String> {
    let workspace_id = payload
        .get("workspaceId")
        .or_else(|| payload.get("workspace_id"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);
    let result = runtime_service::invoke_runtime_rpc("code_kernel_job_start_v3", payload).await?;
    if let Some(task_id) = result
        .get("id")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        let _ = runtime_service::refresh_agent_task_state_fabric(&app, task_id, workspace_id).await;
    }
    Ok(result)
}

async fn invoke_kernel_job_cancel_v3(app: AppHandle, payload: Value) -> Result<Value, String> {
    let result = runtime_service::invoke_runtime_rpc("code_kernel_job_cancel_v3", payload).await?;
    if result
        .get("accepted")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        if let Some(task_id) = result
            .get("taskId")
            .or_else(|| result.get("runId"))
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            let _ = runtime_service::refresh_agent_task_state_fabric(&app, task_id, None).await;
        }
    }
    Ok(result)
}

async fn invoke_kernel_job_resume_v3(app: AppHandle, payload: Value) -> Result<Value, String> {
    let result = runtime_service::invoke_runtime_rpc("code_kernel_job_resume_v3", payload).await?;
    if result
        .get("accepted")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        if let Some(task_id) = result
            .get("taskId")
            .or_else(|| result.get("runId"))
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            let _ = runtime_service::refresh_agent_task_state_fabric(&app, task_id, None).await;
        }
    }
    Ok(result)
}

async fn invoke_kernel_job_intervene_v3(app: AppHandle, payload: Value) -> Result<Value, String> {
    let result =
        runtime_service::invoke_runtime_rpc("code_kernel_job_intervene_v3", payload).await?;
    if result
        .get("accepted")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        for run_id in ["runId", "spawnedRunId"] {
            if let Some(task_id) = result
                .get(run_id)
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
            {
                let _ = runtime_service::refresh_agent_task_state_fabric(&app, task_id, None).await;
            }
        }
    }
    Ok(result)
}

#[tauri::command]
pub async fn code_runtime_run_start(app: AppHandle, payload: Value) -> Result<Value, String> {
    invoke_runtime_run_start(app, payload).await
}

#[tauri::command]
pub async fn code_runtime_run_cancel(app: AppHandle, payload: Value) -> Result<Value, String> {
    invoke_runtime_run_cancel(app, payload).await
}

#[tauri::command]
pub async fn code_runtime_run_resume(app: AppHandle, payload: Value) -> Result<Value, String> {
    invoke_runtime_run_resume(app, payload).await
}

#[tauri::command]
pub async fn code_runtime_run_intervene(app: AppHandle, payload: Value) -> Result<Value, String> {
    invoke_runtime_run_intervene(app, payload).await
}

#[tauri::command]
pub async fn code_runtime_run_subscribe(payload: Value) -> Result<Value, String> {
    runtime_service::invoke_runtime_rpc("code_runtime_run_subscribe", payload).await
}

#[tauri::command]
pub async fn code_runtime_runs_list(payload: Value) -> Result<Value, String> {
    runtime_service::invoke_runtime_rpc("code_runtime_runs_list", payload).await
}

#[tauri::command]
pub async fn code_kernel_job_start_v3(app: AppHandle, payload: Value) -> Result<Value, String> {
    invoke_kernel_job_start_v3(app, payload).await
}

#[tauri::command]
pub async fn code_kernel_job_get_v3(payload: Value) -> Result<Value, String> {
    runtime_service::invoke_runtime_rpc("code_kernel_job_get_v3", payload).await
}

#[tauri::command]
pub async fn code_kernel_job_cancel_v3(app: AppHandle, payload: Value) -> Result<Value, String> {
    invoke_kernel_job_cancel_v3(app, payload).await
}

#[tauri::command]
pub async fn code_kernel_job_resume_v3(app: AppHandle, payload: Value) -> Result<Value, String> {
    invoke_kernel_job_resume_v3(app, payload).await
}

#[tauri::command]
pub async fn code_kernel_job_intervene_v3(app: AppHandle, payload: Value) -> Result<Value, String> {
    invoke_kernel_job_intervene_v3(app, payload).await
}

#[tauri::command]
pub async fn code_kernel_job_subscribe_v3(payload: Value) -> Result<Value, String> {
    runtime_service::invoke_runtime_rpc("code_kernel_job_subscribe_v3", payload).await
}

#[tauri::command]
pub async fn code_kernel_job_callback_register_v3(payload: Value) -> Result<Value, String> {
    runtime_service::invoke_runtime_rpc("code_kernel_job_callback_register_v3", payload).await
}

#[tauri::command]
pub async fn code_kernel_job_callback_remove_v3(payload: Value) -> Result<Value, String> {
    runtime_service::invoke_runtime_rpc("code_kernel_job_callback_remove_v3", payload).await
}

async fn invoke_runtime_run_checkpoint_approval(
    app: AppHandle,
    payload: Value,
) -> Result<Value, String> {
    let result =
        runtime_service::invoke_runtime_rpc("code_runtime_run_checkpoint_approval", payload)
            .await?;
    if result
        .get("recorded")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        if let Some(task_id) = result
            .get("taskId")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            let _ = runtime_service::refresh_agent_task_state_fabric(&app, task_id, None).await;
        }
    }
    Ok(result)
}

#[tauri::command]
pub async fn code_runtime_run_checkpoint_approval(
    app: AppHandle,
    payload: Value,
) -> Result<Value, String> {
    invoke_runtime_run_checkpoint_approval(app, payload).await
}

#[tauri::command]
pub async fn code_kernel_capabilities_list_v2(payload: Value) -> Result<Value, String> {
    runtime_service::invoke_runtime_rpc("code_kernel_capabilities_list_v2", payload).await
}

#[tauri::command]
pub async fn code_kernel_sessions_list_v2(payload: Value) -> Result<Value, String> {
    runtime_service::invoke_runtime_rpc("code_kernel_sessions_list_v2", payload).await
}

#[tauri::command]
pub async fn code_kernel_jobs_list_v2(payload: Value) -> Result<Value, String> {
    runtime_service::invoke_runtime_rpc("code_kernel_jobs_list_v2", payload).await
}

#[tauri::command]
pub async fn code_kernel_context_snapshot_v2(payload: Value) -> Result<Value, String> {
    runtime_service::invoke_runtime_rpc("code_kernel_context_snapshot_v2", payload).await
}

#[tauri::command]
pub async fn code_kernel_extensions_list_v2(payload: Value) -> Result<Value, String> {
    runtime_service::invoke_runtime_rpc("code_kernel_extensions_list_v2", payload).await
}

#[tauri::command]
pub async fn code_kernel_policies_evaluate_v2(payload: Value) -> Result<Value, String> {
    runtime_service::invoke_runtime_rpc("code_kernel_policies_evaluate_v2", payload).await
}

#[tauri::command]
pub async fn code_kernel_projection_bootstrap_v3(payload: Value) -> Result<Value, String> {
    runtime_service::invoke_runtime_rpc("code_kernel_projection_bootstrap_v3", payload).await
}

#[tauri::command]
pub async fn code_distributed_task_graph(payload: Value) -> Result<Value, String> {
    runtime_service::invoke_runtime_rpc("code_distributed_task_graph", payload).await
}

#[tauri::command]
pub async fn code_oauth_codex_login_start(payload: Value) -> Result<Value, String> {
    runtime_service::invoke_runtime_rpc("code_oauth_codex_login_start", payload).await
}

#[tauri::command]
pub async fn code_oauth_codex_login_cancel(payload: Value) -> Result<Value, String> {
    runtime_service::invoke_runtime_rpc("code_oauth_codex_login_cancel", payload).await
}

#[tauri::command]
pub async fn code_sub_agent_spawn(payload: Value) -> Result<Value, String> {
    runtime_service::invoke_runtime_rpc("code_sub_agent_spawn", payload).await
}

#[tauri::command]
pub async fn code_sub_agent_send(payload: Value) -> Result<Value, String> {
    runtime_service::invoke_runtime_rpc("code_sub_agent_send", payload).await
}

#[tauri::command]
pub async fn code_sub_agent_wait(payload: Value) -> Result<Value, String> {
    runtime_service::invoke_runtime_rpc("code_sub_agent_wait", payload).await
}

#[tauri::command]
pub async fn code_sub_agent_status(payload: Value) -> Result<Value, String> {
    runtime_service::invoke_runtime_rpc("code_sub_agent_status", payload).await
}

#[tauri::command]
pub async fn code_sub_agent_interrupt(payload: Value) -> Result<Value, String> {
    runtime_service::invoke_runtime_rpc("code_sub_agent_interrupt", payload).await
}

#[tauri::command]
pub async fn code_sub_agent_close(payload: Value) -> Result<Value, String> {
    runtime_service::invoke_runtime_rpc("code_sub_agent_close", payload).await
}
