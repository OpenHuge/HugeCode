use crate::backend::{runtime_backend, NativeStateFabricScope};
use serde_json::Value;

fn read_scope_payload(payload: &Value) -> &Value {
    payload
        .get("scope")
        .filter(|value| value.is_object())
        .unwrap_or(payload)
}

fn read_string_field(payload: &Value, camel: &str, snake: &str) -> Option<String> {
    payload
        .get(camel)
        .or_else(|| payload.get(snake))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn parse_state_fabric_scope(payload: &Value) -> Result<NativeStateFabricScope, String> {
    let scope = read_scope_payload(payload);
    let Some(kind) = read_string_field(scope, "kind", "kind") else {
        return Err("scope.kind is required".to_string());
    };

    match kind.as_str() {
        "global" => Ok(NativeStateFabricScope::Global),
        "workspace" => Ok(NativeStateFabricScope::Workspace {
            workspace_id: read_string_field(scope, "workspaceId", "workspace_id")
                .ok_or_else(|| "scope.workspaceId is required".to_string())?,
        }),
        "thread" => Ok(NativeStateFabricScope::Thread {
            workspace_id: read_string_field(scope, "workspaceId", "workspace_id")
                .ok_or_else(|| "scope.workspaceId is required".to_string())?,
            thread_id: read_string_field(scope, "threadId", "thread_id")
                .ok_or_else(|| "scope.threadId is required".to_string())?,
        }),
        "terminal" => Ok(NativeStateFabricScope::Terminal {
            workspace_id: read_string_field(scope, "workspaceId", "workspace_id")
                .ok_or_else(|| "scope.workspaceId is required".to_string())?,
            session_id: read_string_field(scope, "sessionId", "session_id")
                .ok_or_else(|| "scope.sessionId is required".to_string())?,
        }),
        "skills" => Ok(NativeStateFabricScope::Skills {
            workspace_id: read_string_field(scope, "workspaceId", "workspace_id"),
        }),
        "task" => Ok(NativeStateFabricScope::Task {
            task_id: read_string_field(scope, "taskId", "task_id")
                .ok_or_else(|| "scope.taskId is required".to_string())?,
        }),
        "run" => Ok(NativeStateFabricScope::Run {
            run_id: read_string_field(scope, "runId", "run_id")
                .ok_or_else(|| "scope.runId is required".to_string())?,
        }),
        _ => Err(format!("unsupported native state fabric scope: {kind}")),
    }
}

fn parse_revision(payload: &Value) -> Result<u64, String> {
    let raw = payload
        .get("revision")
        .or_else(|| payload.get("afterRevision"))
        .or_else(|| payload.get("after_revision"))
        .ok_or_else(|| "revision is required".to_string())?;

    if let Some(revision) = raw.as_u64() {
        return Ok(revision);
    }
    if let Some(raw_text) = raw.as_str() {
        let trimmed = raw_text.trim();
        if trimmed.is_empty() {
            return Err("revision is required".to_string());
        }
        return trimmed
            .parse::<u64>()
            .map_err(|_| format!("revision must be a non-negative integer: {trimmed}"));
    }
    Err("revision must be a non-negative integer".to_string())
}

#[tauri::command]
pub fn native_state_fabric_snapshot(payload: Value) -> Result<Value, String> {
    let scope = parse_state_fabric_scope(&payload)?;
    Ok(runtime_backend().state_fabric_snapshot_payload(&scope))
}

#[tauri::command]
pub fn native_state_fabric_delta(payload: Value) -> Result<Value, String> {
    let scope = parse_state_fabric_scope(&payload)?;
    let revision = parse_revision(&payload)?;
    Ok(runtime_backend().state_fabric_delta_payload(revision, &scope))
}

#[tauri::command]
pub fn native_state_fabric_diagnostics() -> Result<Value, String> {
    Ok(runtime_backend().state_fabric_diagnostics_payload())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn snapshot_accepts_nested_scope_payload() {
        let scope = parse_state_fabric_scope(&serde_json::json!({
            "scope": {
                "kind": "thread",
                "workspaceId": "workspace-1",
                "threadId": "thread-1"
            }
        }))
        .expect("scope should parse");

        assert_eq!(
            scope,
            NativeStateFabricScope::Thread {
                workspace_id: "workspace-1".to_string(),
                thread_id: "thread-1".to_string(),
            }
        );
    }

    #[test]
    fn delta_accepts_string_revision_alias() {
        let revision = parse_revision(&serde_json::json!({
            "after_revision": "7"
        }))
        .expect("revision should parse");

        assert_eq!(revision, 7);
    }

    #[test]
    fn snapshot_accepts_task_scope_payload() {
        let scope = parse_state_fabric_scope(&serde_json::json!({
            "scope": {
                "kind": "task",
                "taskId": "task-1"
            }
        }))
        .expect("task scope should parse");

        assert_eq!(
            scope,
            NativeStateFabricScope::Task {
                task_id: "task-1".to_string(),
            }
        );
    }

    #[test]
    fn snapshot_accepts_run_scope_payload() {
        let scope = parse_state_fabric_scope(&serde_json::json!({
            "scope": {
                "kind": "run",
                "runId": "run-1"
            }
        }))
        .expect("run scope should parse");

        assert_eq!(
            scope,
            NativeStateFabricScope::Run {
                run_id: "run-1".to_string(),
            }
        );
    }
}
