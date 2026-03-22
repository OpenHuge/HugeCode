use serde_json::{json, Value};

pub(super) fn project_agent_task_scope(task_id: &str) -> Value {
    match tauri::async_runtime::block_on(crate::runtime_service::invoke_runtime_rpc(
        "code_runtime_run_subscribe",
        json!({
            "taskId": task_id,
        }),
    )) {
        Ok(task) => json!({
            "taskId": task_id,
            "task": task,
            "source": "code_runtime_run_subscribe",
        }),
        Err(error) => json!({
            "taskId": task_id,
            "task": Value::Null,
            "source": "code_runtime_run_subscribe",
            "error": error,
        }),
    }
}

pub(super) fn project_agent_run_scope(run_id: &str) -> Value {
    match tauri::async_runtime::block_on(crate::runtime_service::invoke_runtime_rpc(
        "code_mission_control_snapshot_v1",
        json!({}),
    )) {
        Ok(snapshot) => {
            let task = snapshot
                .get("tasks")
                .and_then(Value::as_array)
                .and_then(|tasks| {
                    tasks.iter().find(|task| {
                        task.get("runSummary")
                            .and_then(Value::as_object)
                            .and_then(|run| run.get("id"))
                            .and_then(Value::as_str)
                            .is_some_and(|candidate| candidate == run_id)
                    })
                })
                .cloned();
            let run = snapshot
                .get("runs")
                .and_then(Value::as_array)
                .and_then(|runs| {
                    runs.iter().find(|run| {
                        run.get("id")
                            .and_then(Value::as_str)
                            .is_some_and(|candidate| candidate == run_id)
                    })
                })
                .cloned();
            json!({
                "runId": run_id,
                "run": run,
                "task": task,
                "source": "code_mission_control_snapshot_v1",
            })
        }
        Err(error) => json!({
            "runId": run_id,
            "run": Value::Null,
            "task": Value::Null,
            "source": "code_mission_control_snapshot_v1",
            "error": error,
        }),
    }
}
