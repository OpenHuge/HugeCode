use super::*;

pub(crate) const SESSION_PORTABILITY_SCHEMA_VERSION: &str = "session-portability/v1";

#[derive(Default)]
pub(crate) struct SessionPortabilityStore {
    imported_snapshots_by_thread_id: HashMap<String, Value>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeSessionExportResponsePayload {
    schema_version: String,
    exported_at: u64,
    workspace_id: String,
    thread_id: String,
    snapshot: Value,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeSessionImportResponsePayload {
    pub(crate) schema_version: String,
    pub(crate) workspace_id: String,
    pub(crate) thread_id: String,
    pub(crate) imported: bool,
    pub(crate) warnings: Vec<String>,
}

fn extract_snapshot_thread_id(snapshot: &Value) -> Option<String> {
    snapshot
        .get("thread")
        .and_then(Value::as_object)
        .and_then(|thread| thread.get("id"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .or_else(|| {
            snapshot
                .get("threadId")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(ToOwned::to_owned)
        })
}

fn extract_snapshot_thread_title(snapshot: &Value) -> String {
    snapshot
        .get("thread")
        .and_then(Value::as_object)
        .and_then(|thread| thread.get("title"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| "Imported session".to_string())
}

fn extract_snapshot_thread_provider(
    snapshot: &Value,
    default_model_id: &str,
) -> (String, Option<String>) {
    let provider = snapshot
        .get("thread")
        .and_then(Value::as_object)
        .and_then(|thread| thread.get("provider"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| {
            infer_provider(None, Some(default_model_id))
                .routed_provider()
                .to_string()
        });
    let model_id = snapshot
        .get("thread")
        .and_then(Value::as_object)
        .and_then(|thread| thread.get("modelId"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .or_else(|| Some(default_model_id.to_string()));
    (provider, model_id)
}

impl SessionPortabilityStore {
    pub(crate) fn set_snapshot(&mut self, thread_id: &str, snapshot: Value) {
        self.imported_snapshots_by_thread_id
            .insert(thread_id.to_string(), snapshot);
    }

    pub(crate) fn get_snapshot(&self, thread_id: &str) -> Option<Value> {
        self.imported_snapshots_by_thread_id.get(thread_id).cloned()
    }

    pub(crate) fn remove_snapshot(&mut self, thread_id: &str) {
        self.imported_snapshots_by_thread_id.remove(thread_id);
    }
}

pub(crate) async fn export_session_snapshot(
    ctx: &AppContext,
    workspace_id: &str,
    thread_id: &str,
    include_agent_tasks: bool,
) -> Result<RuntimeSessionExportResponsePayload, RpcError> {
    let thread_summary = {
        let state = ctx.state.read().await;
        let Some(threads) = state.workspace_threads.get(workspace_id) else {
            return Err(RpcError::invalid_params(format!(
                "workspace `{workspace_id}` has no threads"
            )));
        };
        let Some(thread) = threads.iter().find(|entry| entry.id == thread_id) else {
            return Err(RpcError::invalid_params(format!(
                "thread `{thread_id}` was not found in workspace `{workspace_id}`"
            )));
        };
        thread.clone()
    };

    let mut snapshot = {
        let imported = ctx
            .session_portability_store
            .read()
            .await
            .get_snapshot(thread_id);
        imported.unwrap_or_else(|| {
            json!({
                "schemaVersion": SESSION_PORTABILITY_SCHEMA_VERSION,
                "workspaceId": workspace_id,
                "thread": thread_summary,
            })
        })
    };

    if !snapshot.is_object() {
        snapshot = json!({
            "schemaVersion": SESSION_PORTABILITY_SCHEMA_VERSION,
            "workspaceId": workspace_id,
            "thread": thread_summary,
        });
    }

    if let Some(snapshot_object) = snapshot.as_object_mut() {
        snapshot_object.insert(
            "schemaVersion".to_string(),
            Value::String(SESSION_PORTABILITY_SCHEMA_VERSION.to_string()),
        );
        snapshot_object.insert(
            "workspaceId".to_string(),
            Value::String(workspace_id.to_string()),
        );
        snapshot_object.insert("thread".to_string(), json!(thread_summary));

        if include_agent_tasks {
            let store = ctx.agent_tasks.read().await;
            let task_summaries = store
                .tasks
                .values()
                .filter(|entry| {
                    entry.summary.workspace_id == workspace_id
                        && entry.summary.thread_id.as_deref() == Some(thread_id)
                })
                .map(|entry| entry.summary.clone())
                .collect::<Vec<_>>();
            snapshot_object.insert("agentTasks".to_string(), json!(task_summaries));
        }
    }

    Ok(RuntimeSessionExportResponsePayload {
        schema_version: SESSION_PORTABILITY_SCHEMA_VERSION.to_string(),
        exported_at: now_ms(),
        workspace_id: workspace_id.to_string(),
        thread_id: thread_id.to_string(),
        snapshot,
    })
}

pub(crate) async fn import_session_snapshot(
    ctx: &AppContext,
    workspace_id: &str,
    snapshot: Value,
    preferred_thread_id: Option<&str>,
) -> Result<RuntimeSessionImportResponsePayload, RpcError> {
    let preferred_thread_id = preferred_thread_id
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);
    let source_thread_id = extract_snapshot_thread_id(&snapshot);
    let thread_id = preferred_thread_id
        .clone()
        .or(source_thread_id.clone())
        .unwrap_or_else(|| new_id("thread"));

    let mut warnings = Vec::new();
    if let Some(source_thread_id) = source_thread_id {
        if source_thread_id != thread_id {
            warnings.push(format!(
                "snapshot thread id `{source_thread_id}` was remapped to `{thread_id}`"
            ));
        }
    }

    let thread_title = extract_snapshot_thread_title(&snapshot);
    let (provider, model_id) =
        extract_snapshot_thread_provider(&snapshot, ctx.config.default_model_id.as_str());

    {
        let mut state = ctx.state.write().await;
        ensure_workspace(&mut state, workspace_id, &ctx.config.default_model_id);

        let threads = state
            .workspace_threads
            .entry(workspace_id.to_string())
            .or_default();
        if threads.iter().any(|entry| entry.id == thread_id) {
            return Err(RpcError::invalid_params(format!(
                "thread `{thread_id}` already exists in workspace `{workspace_id}`"
            )));
        }

        let now = now_ms();
        threads.insert(
            0,
            ThreadSummary {
                id: thread_id.clone(),
                workspace_id: workspace_id.to_string(),
                title: thread_title,
                unread: false,
                running: false,
                created_at: now,
                updated_at: now,
                provider,
                model_id,
                status: Some("imported".to_string()),
                archived: false,
                last_activity_at: Some(now),
                agent_role: None,
                agent_nickname: None,
            },
        );
    }

    {
        let mut store = ctx.session_portability_store.write().await;
        store.set_snapshot(thread_id.as_str(), snapshot);
    }

    Ok(RuntimeSessionImportResponsePayload {
        schema_version: SESSION_PORTABILITY_SCHEMA_VERSION.to_string(),
        workspace_id: workspace_id.to_string(),
        thread_id,
        imported: true,
        warnings,
    })
}

pub(crate) async fn delete_session_snapshot(
    ctx: &AppContext,
    workspace_id: &str,
    thread_id: &str,
) -> Result<bool, RpcError> {
    let removed_thread = {
        let mut state = ctx.state.write().await;
        let Some(threads) = state.workspace_threads.get_mut(workspace_id) else {
            return Ok(false);
        };
        let before = threads.len();
        threads.retain(|entry| entry.id != thread_id);
        before != threads.len()
    };

    if !removed_thread {
        return Ok(false);
    }

    {
        let mut store = ctx.session_portability_store.write().await;
        store.remove_snapshot(thread_id);
    }

    {
        let mut store = ctx.agent_tasks.write().await;
        let removed_task_ids = store
            .tasks
            .iter()
            .filter(|(_, entry)| {
                entry.summary.workspace_id == workspace_id
                    && entry.summary.thread_id.as_deref() == Some(thread_id)
            })
            .map(|(task_id, _)| task_id.clone())
            .collect::<Vec<_>>();
        if !removed_task_ids.is_empty() {
            let removed_ids = removed_task_ids.iter().cloned().collect::<HashSet<_>>();
            for task_id in &removed_task_ids {
                store.tasks.remove(task_id);
            }
            store.order.retain(|task_id| !removed_ids.contains(task_id));
            store
                .approval_index
                .retain(|_, task_id| !removed_ids.contains(task_id));
        }
    }

    Ok(true)
}
