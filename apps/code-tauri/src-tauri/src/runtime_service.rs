use crate::backend::{
    runtime_backend, NativeStateFabricChange, NativeStateFabricDelta, NativeStateFabricRead,
};
use crate::instruction_skills_watcher;
use crate::models::{
    ThreadLiveSubscribeResult, ThreadLiveUnsubscribeResult, TurnAck, TurnInterruptRequest,
    TurnSendRequest,
};
use code_runtime_service_rs::{
    EmbeddedRuntime, EmbeddedRuntimeContextChange, EmbeddedRuntimeContextDelta,
    EmbeddedRuntimeContextScope, EmbeddedRuntimeContextSnapshot, EmbeddedRuntimeError,
    EmbeddedRuntimeThreadLiveSubscription, EmbeddedRuntimeThreadSnapshot, EmbeddedRuntimeTurnAck,
    EmbeddedRuntimeTurnInterruptRequest, EmbeddedRuntimeTurnSendAttachment,
    EmbeddedRuntimeTurnSendRequest, EmbeddedRuntimeWorkspaceSnapshot,
};
use serde_json::json;
use serde_json::Value;
use std::collections::HashSet;
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter};

const RUNTIME_EVENT_NAME: &str = "fastcode://runtime/event";

static EMBEDDED_RUNTIME: OnceLock<Result<EmbeddedRuntime, String>> = OnceLock::new();
static RUNTIME_EVENT_RELAY: OnceLock<()> = OnceLock::new();
static RUNTIME_CONTEXT_SYNC: OnceLock<Mutex<RuntimeContextSyncState>> = OnceLock::new();

#[derive(Debug, Default)]
struct RuntimeContextSyncState {
    global_hydrated: bool,
    last_applied_revision: u64,
    last_sync_mode: Option<&'static str>,
    delta_apply_total: u64,
    full_resync_total: u64,
    resync_required_total: u64,
    last_scope: Option<String>,
    hydrated_workspaces: HashSet<String>,
    hydrated_threads: HashSet<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
enum RuntimeContextSyncScope {
    Global,
    Workspace {
        workspace_id: String,
    },
    Thread {
        workspace_id: String,
        thread_id: String,
    },
}

fn runtime_service() -> Result<&'static EmbeddedRuntime, String> {
    let runtime = EMBEDDED_RUNTIME.get_or_init(|| {
        let default_model_id = runtime_backend()
            .workspaces()
            .first()
            .and_then(|workspace| workspace.default_model_id.as_deref())
            .map(str::to_string);
        EmbeddedRuntime::from_env(default_model_id.as_deref())
            .map_err(|error| format!("{}: {}", error.code, error.message))
    });
    runtime.as_ref().map_err(Clone::clone)
}

pub fn attach_runtime_event_relay(app: AppHandle) -> Result<(), String> {
    let runtime = runtime_service()?;
    if RUNTIME_EVENT_RELAY.set(()).is_err() {
        instruction_skills_watcher::attach_instruction_skills_refresh_relay(app);
        return Ok(());
    }
    let mut receiver = runtime.subscribe_events();
    let relay_app = app.clone();
    let replay_runtime = runtime.clone();
    tauri::async_runtime::spawn(async move {
        let mut last_event_id = None::<u64>;
        loop {
            match receiver.recv().await {
                Ok(frame) => {
                    last_event_id = Some(frame.event_id);
                    emit_runtime_event_frame(&relay_app, frame.envelope);
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => {
                    let Ok(replay) = replay_runtime.replay_events_after(last_event_id) else {
                        continue;
                    };
                    let newest_event_id = replay.newest_event_id;
                    if let Some(frame) = replay.resync_event {
                        emit_runtime_event_frame(&relay_app, frame.envelope);
                    }
                    for frame in replay.frames {
                        last_event_id = Some(frame.event_id);
                        emit_runtime_event_frame(&relay_app, frame.envelope);
                    }
                    if newest_event_id.is_some() && last_event_id.is_none() {
                        last_event_id = newest_event_id;
                    }
                }
                Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
            }
        }
    });
    instruction_skills_watcher::attach_instruction_skills_refresh_relay(app);
    Ok(())
}

fn emit_runtime_event_frame(app: &AppHandle, envelope: Value) {
    if let Some(fabric_event) = map_runtime_thread_live_event_to_fabric(&envelope) {
        let _ = app.emit(RUNTIME_EVENT_NAME, fabric_event);
        return;
    }
    let _ = app.emit(RUNTIME_EVENT_NAME, envelope);
}

fn read_optional_string_field(value: &Value, keys: &[&str]) -> Option<String> {
    let record = value.as_object()?;
    keys.iter()
        .find_map(|key| record.get(*key))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(str::to_string)
}

fn emit_native_state_fabric_updated_event(
    app: &AppHandle,
    workspace_id: Option<&str>,
    params: serde_json::Map<String, Value>,
) {
    let event_workspace_id = workspace_id
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("workspace-local");
    let _ = app.emit(
        RUNTIME_EVENT_NAME,
        Value::Object(serde_json::Map::from_iter([
            ("workspace_id".to_string(), Value::from(event_workspace_id)),
            (
                "message".to_string(),
                Value::Object(serde_json::Map::from_iter([
                    (
                        "method".to_string(),
                        Value::from("native_state_fabric_updated"),
                    ),
                    ("params".to_string(), Value::Object(params)),
                ])),
            ),
        ])),
    );
}

fn map_runtime_thread_live_event_to_fabric(envelope: &Value) -> Option<Value> {
    let kind = envelope.get("kind")?.as_str()?.trim();
    let payload = envelope.get("payload")?.as_object()?;
    let thread_id = payload.get("threadId")?.as_str()?.trim();
    let subscription_id = payload.get("subscriptionId")?.as_str()?.trim();
    if thread_id.is_empty() || subscription_id.is_empty() {
        return None;
    }
    let workspace_id = payload
        .get("workspaceId")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)?;

    let (change_kind, change) = match kind {
        "thread.live_update" => (
            "threadLiveStatePatched",
            NativeStateFabricChange::ThreadLiveStatePatched {
                workspace_id: workspace_id.clone(),
                thread_id: thread_id.to_string(),
            },
        ),
        "thread.live_heartbeat" => (
            "threadLiveHeartbeatObserved",
            NativeStateFabricChange::ThreadLiveHeartbeatObserved {
                workspace_id: workspace_id.clone(),
                thread_id: thread_id.to_string(),
            },
        ),
        "thread.live_detached" => (
            "threadLiveDetached",
            NativeStateFabricChange::ThreadLiveDetached {
                workspace_id: workspace_id.clone(),
                thread_id: thread_id.to_string(),
            },
        ),
        _ => return None,
    };

    let revision = runtime_backend().append_state_fabric_change(change);
    let mut params = serde_json::Map::from_iter([
        ("revision".to_string(), Value::from(revision)),
        ("scopeKind".to_string(), Value::from("thread")),
        ("workspaceId".to_string(), Value::from(workspace_id.clone())),
        ("threadId".to_string(), Value::from(thread_id.to_string())),
        (
            "subscriptionId".to_string(),
            Value::from(subscription_id.to_string()),
        ),
        ("changeKind".to_string(), Value::from(change_kind)),
        ("source".to_string(), Value::from("embedded_runtime")),
    ]);
    if let Some(reason) = payload
        .get("reason")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        params.insert("reason".to_string(), Value::from(reason));
    }
    if let Some(sent_at_ms) = payload.get("sentAtMs").and_then(Value::as_u64) {
        params.insert("sentAtMs".to_string(), Value::from(sent_at_ms));
    }
    if let Some(heartbeat_interval_ms) = payload.get("heartbeatIntervalMs").and_then(Value::as_u64)
    {
        params.insert(
            "heartbeatIntervalMs".to_string(),
            Value::from(heartbeat_interval_ms),
        );
    }

    Some(Value::Object(serde_json::Map::from_iter([
        ("workspace_id".to_string(), Value::from(workspace_id)),
        (
            "message".to_string(),
            Value::Object(serde_json::Map::from_iter([
                (
                    "method".to_string(),
                    Value::from("native_state_fabric_updated"),
                ),
                ("params".to_string(), Value::Object(params)),
            ])),
        ),
    ])))
}

pub async fn send_turn(payload: TurnSendRequest) -> TurnAck {
    let runtime = match runtime_service() {
        Ok(runtime) => runtime,
        Err(message) => {
            return turn_ack_from_runtime_error(
                payload.thread_id.clone(),
                payload.provider.clone(),
                payload.model_id.clone(),
                EmbeddedRuntimeError {
                    code: "INTERNAL_ERROR".to_string(),
                    message,
                },
            );
        }
    };

    let _ = ensure_runtime_context_synced(
        runtime,
        RuntimeContextSyncScope::Thread {
            workspace_id: payload.workspace_id.clone(),
            thread_id: payload.thread_id.clone().unwrap_or_default(),
        }
        .normalize(),
    )
    .await;

    match runtime.send_turn(map_turn_send_request(&payload)).await {
        Ok(ack) => {
            let turn_ack = map_turn_ack(&ack);
            if turn_ack.accepted {
                runtime_backend().apply_runtime_turn_ack(&payload, &turn_ack);
            }
            turn_ack
        }
        Err(error) => turn_ack_from_runtime_error(
            payload.thread_id.clone(),
            payload.provider.clone(),
            payload.model_id.clone(),
            error,
        ),
    }
}

pub async fn interrupt_turn(payload: TurnInterruptRequest) -> bool {
    let runtime = match runtime_service() {
        Ok(runtime) => runtime,
        Err(_) => return false,
    };
    match runtime
        .interrupt_turn(EmbeddedRuntimeTurnInterruptRequest {
            turn_id: payload.turn_id.clone(),
            reason: payload.reason.clone(),
        })
        .await
    {
        Ok(interrupted) => {
            if interrupted {
                let _ = runtime_backend().interrupt_turn(&payload);
            }
            interrupted
        }
        Err(_) => false,
    }
}

pub async fn thread_live_subscribe(
    workspace_id: &str,
    thread_id: &str,
) -> Result<ThreadLiveSubscribeResult, String> {
    let runtime = runtime_service()?;
    ensure_runtime_context_synced(
        runtime,
        RuntimeContextSyncScope::Thread {
            workspace_id: workspace_id.to_string(),
            thread_id: thread_id.to_string(),
        },
    )
    .await?;
    let subscription = runtime
        .thread_live_subscribe(workspace_id, thread_id)
        .await
        .map_err(|error| format!("{}: {}", error.code, error.message))?;
    Ok(map_thread_live_subscription(subscription))
}

pub async fn thread_live_unsubscribe(subscription_id: &str) -> ThreadLiveUnsubscribeResult {
    let ok = match runtime_service() {
        Ok(runtime) => runtime
            .thread_live_unsubscribe(subscription_id)
            .await
            .unwrap_or(false),
        Err(_) => false,
    };
    ThreadLiveUnsubscribeResult { ok }
}

pub async fn invoke_runtime_rpc(method: &str, payload: Value) -> Result<Value, String> {
    let runtime = runtime_service()?;
    let normalized_payload = normalize_runtime_rpc_payload(payload);
    sync_runtime_rpc_context(runtime, &normalized_payload).await;
    runtime
        .invoke_value(method, &normalized_payload)
        .await
        .map_err(|error| format!("{}: {}", error.code, error.message))
}

pub async fn refresh_agent_task_state_fabric(
    app: &AppHandle,
    task_id: &str,
    workspace_id_hint: Option<String>,
) -> Result<(), String> {
    let runtime = runtime_service()?;
    let normalized_task_id = task_id.trim();
    if normalized_task_id.is_empty() {
        return Ok(());
    }
    let status_payload = json!({
        "taskId": normalized_task_id,
    });
    sync_runtime_rpc_context(runtime, &status_payload).await;
    let task_payload = runtime
        .invoke_value("code_runtime_run_subscribe", &status_payload)
        .await
        .map_err(|error| format!("{}: {}", error.code, error.message))?;
    let Some(task_record) = task_payload.as_object() else {
        return Ok(());
    };

    let workspace_id = read_optional_string_field(&task_payload, &["workspaceId", "workspace_id"])
        .or(workspace_id_hint);
    let effective_task_id = read_optional_string_field(&task_payload, &["taskId", "task_id"])
        .unwrap_or_else(|| normalized_task_id.to_string());

    let task_revision =
        runtime_backend().append_state_fabric_change(NativeStateFabricChange::TaskUpsert {
            workspace_id: workspace_id.clone(),
            task_id: effective_task_id.clone(),
        });
    emit_native_state_fabric_updated_event(
        app,
        workspace_id.as_deref(),
        serde_json::Map::from_iter([
            ("revision".to_string(), Value::from(task_revision)),
            ("scopeKind".to_string(), Value::from("task")),
            ("changeKind".to_string(), Value::from("taskUpsert")),
            ("taskId".to_string(), Value::from(effective_task_id.clone())),
            ("source".to_string(), Value::from("tauri_agent_rpc")),
            (
                "workspaceId".to_string(),
                workspace_id
                    .as_ref()
                    .map(|id| Value::from(id.as_str()))
                    .unwrap_or(Value::Null),
            ),
        ]),
    );

    let run_id = task_record
        .get("runSummary")
        .and_then(|value| read_optional_string_field(value, &["id", "runId", "run_id"]));
    if let Some(run_id) = run_id {
        let run_revision =
            runtime_backend().append_state_fabric_change(NativeStateFabricChange::RunUpsert {
                workspace_id: workspace_id.clone(),
                task_id: Some(effective_task_id.clone()),
                run_id: run_id.clone(),
            });
        emit_native_state_fabric_updated_event(
            app,
            workspace_id.as_deref(),
            serde_json::Map::from_iter([
                ("revision".to_string(), Value::from(run_revision)),
                ("scopeKind".to_string(), Value::from("run")),
                ("changeKind".to_string(), Value::from("runUpsert")),
                ("taskId".to_string(), Value::from(effective_task_id)),
                ("runId".to_string(), Value::from(run_id)),
                ("source".to_string(), Value::from("tauri_agent_rpc")),
                (
                    "workspaceId".to_string(),
                    workspace_id
                        .as_ref()
                        .map(|id| Value::from(id.as_str()))
                        .unwrap_or(Value::Null),
                ),
            ]),
        );
    }

    Ok(())
}

fn normalize_runtime_rpc_payload(payload: Value) -> Value {
    if payload.is_null() {
        Value::Object(serde_json::Map::new())
    } else {
        payload
    }
}

async fn sync_runtime_rpc_context(runtime: &EmbeddedRuntime, payload: &Value) {
    let scope = infer_runtime_context_scope(unwrap_runtime_context_payload(payload));
    let _ = ensure_runtime_context_synced(runtime, scope).await;
}

fn unwrap_runtime_context_payload(payload: &Value) -> &Value {
    payload
        .get("payload")
        .filter(|value| value.is_object())
        .unwrap_or(payload)
}

fn runtime_context_sync_state() -> &'static Mutex<RuntimeContextSyncState> {
    RUNTIME_CONTEXT_SYNC.get_or_init(|| Mutex::new(RuntimeContextSyncState::default()))
}

async fn ensure_runtime_context_synced(
    runtime: &EmbeddedRuntime,
    scope: RuntimeContextSyncScope,
) -> Result<u64, String> {
    let (global_hydrated, last_applied_revision, scope_hydrated) = {
        let state = runtime_context_sync_state()
            .lock()
            .expect("runtime context sync state lock poisoned while reading sync state");
        (
            state.global_hydrated,
            state.last_applied_revision,
            state.scope_hydrated(&scope),
        )
    };

    if !global_hydrated && !scope_hydrated {
        let revision = apply_state_fabric_scope_snapshot(runtime, &scope).await?;
        record_runtime_context_sync(&scope, revision, "full", false);
        return Ok(revision);
    }

    match runtime_backend().state_fabric_delta_after_for_scope(
        last_applied_revision,
        &map_runtime_context_scope_to_state_fabric_scope(&scope),
    ) {
        NativeStateFabricRead::Delta(delta) => {
            if delta.changes.is_empty() {
                record_runtime_context_sync(&scope, delta.revision, "delta", false);
                return Ok(delta.revision);
            }
            match apply_state_fabric_scope_delta(runtime, delta).await {
                Ok(revision) => {
                    record_runtime_context_sync(&scope, revision, "delta", false);
                    Ok(revision)
                }
                Err(_) => {
                    let revision = apply_state_fabric_scope_snapshot(runtime, &scope).await?;
                    record_runtime_context_sync(&scope, revision, "full", false);
                    Ok(revision)
                }
            }
        }
        NativeStateFabricRead::ResyncRequired(_) => {
            let revision = apply_state_fabric_scope_snapshot(runtime, &scope).await?;
            record_runtime_context_sync(&scope, revision, "full", true);
            Ok(revision)
        }
    }
}

async fn apply_state_fabric_scope_delta(
    runtime: &EmbeddedRuntime,
    delta: NativeStateFabricDelta,
) -> Result<u64, String> {
    let Some(context_delta) = build_context_delta_from_state_fabric(delta)? else {
        return Ok(runtime_backend()
            .state_fabric_journal_diagnostics()
            .revision);
    };
    let revision = context_delta.revision;
    runtime.apply_context_delta(context_delta).await;
    Ok(revision)
}

async fn apply_state_fabric_scope_snapshot(
    runtime: &EmbeddedRuntime,
    scope: &RuntimeContextSyncScope,
) -> Result<u64, String> {
    let payload = runtime_backend()
        .state_fabric_snapshot_payload(&map_runtime_context_scope_to_state_fabric_scope(scope));
    let revision = payload
        .get("revision")
        .and_then(Value::as_u64)
        .ok_or_else(|| "native state fabric snapshot is missing revision".to_string())?;
    let snapshot = parse_context_snapshot_from_state_fabric_payload(scope, &payload)?;
    runtime
        .apply_context_scope_snapshot(map_runtime_context_scope(scope), snapshot)
        .await;
    Ok(revision)
}

fn parse_context_snapshot_from_state_fabric_payload(
    scope: &RuntimeContextSyncScope,
    payload: &Value,
) -> Result<EmbeddedRuntimeContextSnapshot, String> {
    let state = payload
        .get("state")
        .ok_or_else(|| "native state fabric snapshot is missing state payload".to_string())?;
    let revision = payload
        .get("revision")
        .and_then(Value::as_u64)
        .unwrap_or_default();

    let workspaces = match scope {
        RuntimeContextSyncScope::Global => read_workspace_summaries(state, "workspaces")?,
        RuntimeContextSyncScope::Workspace { .. } | RuntimeContextSyncScope::Thread { .. } => {
            read_optional_workspace_summary(state, "workspace")?
                .into_iter()
                .collect::<Vec<_>>()
        }
    };
    let threads = match scope {
        RuntimeContextSyncScope::Global | RuntimeContextSyncScope::Workspace { .. } => {
            read_thread_summaries(state, "threads")?
        }
        RuntimeContextSyncScope::Thread { .. } => read_optional_thread_summary(state, "thread")?
            .into_iter()
            .collect::<Vec<_>>(),
    };

    Ok(EmbeddedRuntimeContextSnapshot {
        revision,
        workspaces,
        threads,
    })
}

fn read_workspace_summaries(
    payload: &Value,
    key: &str,
) -> Result<Vec<EmbeddedRuntimeWorkspaceSnapshot>, String> {
    let Some(value) = payload.get(key) else {
        return Ok(Vec::new());
    };
    if value.is_null() {
        return Ok(Vec::new());
    }
    serde_json::from_value::<Vec<EmbeddedRuntimeWorkspaceSnapshot>>(value.clone())
        .map_err(|error| format!("decode native state fabric workspaces failed: {error}"))
}

fn read_optional_workspace_summary(
    payload: &Value,
    key: &str,
) -> Result<Option<EmbeddedRuntimeWorkspaceSnapshot>, String> {
    let Some(value) = payload.get(key) else {
        return Ok(None);
    };
    if value.is_null() {
        return Ok(None);
    }
    serde_json::from_value::<EmbeddedRuntimeWorkspaceSnapshot>(value.clone())
        .map(Some)
        .map_err(|error| format!("decode native state fabric workspace failed: {error}"))
}

fn read_thread_summaries(
    payload: &Value,
    key: &str,
) -> Result<Vec<EmbeddedRuntimeThreadSnapshot>, String> {
    let Some(value) = payload.get(key) else {
        return Ok(Vec::new());
    };
    if value.is_null() {
        return Ok(Vec::new());
    }
    serde_json::from_value::<Vec<EmbeddedRuntimeThreadSnapshot>>(value.clone())
        .map_err(|error| format!("decode native state fabric threads failed: {error}"))
}

fn read_optional_thread_summary(
    payload: &Value,
    key: &str,
) -> Result<Option<EmbeddedRuntimeThreadSnapshot>, String> {
    let Some(value) = payload.get(key) else {
        return Ok(None);
    };
    if value.is_null() {
        return Ok(None);
    }
    serde_json::from_value::<EmbeddedRuntimeThreadSnapshot>(value.clone())
        .map(Some)
        .map_err(|error| format!("decode native state fabric thread failed: {error}"))
}

fn build_context_delta_from_state_fabric(
    delta: NativeStateFabricDelta,
) -> Result<Option<EmbeddedRuntimeContextDelta>, String> {
    let changes = delta
        .changes
        .into_iter()
        .map(|entry| map_state_fabric_change_to_context_change(entry.change))
        .collect::<Result<Vec<_>, _>>()?
        .into_iter()
        .flatten()
        .collect::<Vec<_>>();
    if changes.is_empty() {
        return Ok(None);
    }
    Ok(Some(EmbeddedRuntimeContextDelta {
        base_revision: delta.base_revision,
        revision: delta.revision,
        changes,
    }))
}

fn map_state_fabric_change_to_context_change(
    change: NativeStateFabricChange,
) -> Result<Option<EmbeddedRuntimeContextChange>, String> {
    match change {
        NativeStateFabricChange::WorkspaceUpsert { workspace_id } => {
            let payload = runtime_backend().state_fabric_snapshot_payload(
                &crate::backend::NativeStateFabricScope::Workspace {
                    workspace_id: workspace_id.clone(),
                },
            );
            let state = payload.get("state").ok_or_else(|| {
                "workspace state fabric snapshot is missing state payload".to_string()
            })?;
            let Some(workspace) = read_optional_workspace_summary(state, "workspace")? else {
                return Err(format!(
                    "workspace state fabric snapshot is missing workspace {}",
                    workspace_id
                ));
            };
            Ok(Some(EmbeddedRuntimeContextChange::WorkspaceUpsert {
                workspace,
            }))
        }
        NativeStateFabricChange::WorkspaceRemove { workspace_id } => {
            Ok(Some(EmbeddedRuntimeContextChange::WorkspaceRemove {
                workspace_id,
            }))
        }
        NativeStateFabricChange::ThreadUpsert {
            workspace_id,
            thread_id,
        } => {
            let payload = runtime_backend().state_fabric_snapshot_payload(
                &map_runtime_context_scope_to_state_fabric_scope(
                    &RuntimeContextSyncScope::Thread {
                        workspace_id: workspace_id.clone(),
                        thread_id: thread_id.clone(),
                    },
                ),
            );
            let state = payload.get("state").ok_or_else(|| {
                "thread state fabric snapshot is missing state payload".to_string()
            })?;
            let Some(thread) = read_optional_thread_summary(state, "thread")? else {
                return Err(format!(
                    "thread state fabric snapshot is missing thread {}",
                    thread_id
                ));
            };
            Ok(Some(EmbeddedRuntimeContextChange::ThreadUpsert { thread }))
        }
        NativeStateFabricChange::ThreadRemove {
            workspace_id,
            thread_id,
        } => Ok(Some(EmbeddedRuntimeContextChange::ThreadRemove {
            workspace_id,
            thread_id,
        })),
        NativeStateFabricChange::ThreadLiveStatePatched { .. }
        | NativeStateFabricChange::ThreadLiveHeartbeatObserved { .. }
        | NativeStateFabricChange::ThreadLiveDetached { .. }
        | NativeStateFabricChange::TaskUpsert { .. }
        | NativeStateFabricChange::TaskRemove { .. }
        | NativeStateFabricChange::RunUpsert { .. }
        | NativeStateFabricChange::RunRemove { .. }
        | NativeStateFabricChange::TerminalSessionUpsert { .. }
        | NativeStateFabricChange::TerminalOutputAppended { .. }
        | NativeStateFabricChange::TerminalSessionStatePatched { .. }
        | NativeStateFabricChange::SkillsCatalogPatched { .. }
        | NativeStateFabricChange::SkillsWatcherStatePatched { .. }
        | NativeStateFabricChange::RuntimeCapabilitiesPatched => Ok(None),
    }
}

fn record_runtime_context_sync(
    scope: &RuntimeContextSyncScope,
    revision: u64,
    mode: &'static str,
    resync_required: bool,
) {
    let mut state = runtime_context_sync_state()
        .lock()
        .expect("runtime context sync state lock poisoned while recording sync result");
    state.last_applied_revision = revision;
    state.last_sync_mode = Some(mode);
    state.last_scope = Some(scope.label().to_string());
    state.mark_scope_hydrated(scope);
    if mode == "delta" {
        state.delta_apply_total = state.delta_apply_total.saturating_add(1);
    } else {
        state.full_resync_total = state.full_resync_total.saturating_add(1);
    }
    if resync_required {
        state.resync_required_total = state.resync_required_total.saturating_add(1);
    }
}

fn map_runtime_context_scope(scope: &RuntimeContextSyncScope) -> EmbeddedRuntimeContextScope {
    match scope {
        RuntimeContextSyncScope::Global => EmbeddedRuntimeContextScope::Global,
        RuntimeContextSyncScope::Workspace { workspace_id } => {
            EmbeddedRuntimeContextScope::Workspace {
                workspace_id: workspace_id.clone(),
            }
        }
        RuntimeContextSyncScope::Thread {
            workspace_id,
            thread_id,
        } => EmbeddedRuntimeContextScope::Thread {
            workspace_id: workspace_id.clone(),
            thread_id: thread_id.clone(),
        },
    }
}

fn map_runtime_context_scope_to_state_fabric_scope(
    scope: &RuntimeContextSyncScope,
) -> crate::backend::NativeStateFabricScope {
    match scope {
        RuntimeContextSyncScope::Global => crate::backend::NativeStateFabricScope::Global,
        RuntimeContextSyncScope::Workspace { workspace_id } => {
            crate::backend::NativeStateFabricScope::Workspace {
                workspace_id: workspace_id.clone(),
            }
        }
        RuntimeContextSyncScope::Thread {
            workspace_id,
            thread_id,
        } => crate::backend::NativeStateFabricScope::Thread {
            workspace_id: workspace_id.clone(),
            thread_id: thread_id.clone(),
        },
    }
}

pub fn runtime_context_sync_diagnostics_payload() -> Value {
    let backend = runtime_backend().state_fabric_journal_diagnostics();
    let state = runtime_context_sync_state()
        .lock()
        .expect("runtime context sync state lock poisoned while building diagnostics");
    serde_json::json!({
        "backendRevision": backend.revision,
        "embeddedAppliedRevision": state.last_applied_revision,
        "lastSyncMode": state.last_sync_mode.unwrap_or("full"),
        "deltaApplyTotal": state.delta_apply_total,
        "fullResyncTotal": state.full_resync_total,
        "resyncRequiredTotal": state.resync_required_total,
        "scope": state.last_scope.clone().unwrap_or_else(|| "unsynced".to_string()),
        "oldestAvailableRevision": backend.oldest_available_revision,
        "retainedChangeCount": backend.retained_change_count,
        "hydratedWorkspaceCount": state.hydrated_workspaces.len(),
        "hydratedThreadCount": state.hydrated_threads.len(),
        "globalHydrated": state.global_hydrated
    })
}

fn infer_runtime_context_scope(payload: &Value) -> RuntimeContextSyncScope {
    let object = payload.as_object();
    let workspace_id = object.and_then(|record| {
        ["workspaceId", "workspace_id"]
            .iter()
            .find_map(|key| record.get(*key).and_then(Value::as_str))
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string)
    });
    let thread_id = object.and_then(|record| {
        ["threadId", "thread_id"]
            .iter()
            .find_map(|key| record.get(*key).and_then(Value::as_str))
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string)
    });
    match (workspace_id, thread_id) {
        (Some(workspace_id), Some(thread_id)) => RuntimeContextSyncScope::Thread {
            workspace_id,
            thread_id,
        }
        .normalize(),
        (Some(workspace_id), None) => RuntimeContextSyncScope::Workspace { workspace_id },
        _ => RuntimeContextSyncScope::Global,
    }
}

impl RuntimeContextSyncState {
    fn scope_hydrated(&self, scope: &RuntimeContextSyncScope) -> bool {
        if self.global_hydrated {
            return true;
        }
        match scope {
            RuntimeContextSyncScope::Global => false,
            RuntimeContextSyncScope::Workspace { workspace_id } => {
                self.hydrated_workspaces.contains(workspace_id)
            }
            RuntimeContextSyncScope::Thread {
                workspace_id,
                thread_id,
            } => {
                self.hydrated_workspaces.contains(workspace_id)
                    || self.hydrated_threads.contains(
                        scope_thread_key(workspace_id.as_str(), thread_id.as_str()).as_str(),
                    )
            }
        }
    }

    fn mark_scope_hydrated(&mut self, scope: &RuntimeContextSyncScope) {
        match scope {
            RuntimeContextSyncScope::Global => {
                self.global_hydrated = true;
            }
            RuntimeContextSyncScope::Workspace { workspace_id } => {
                self.hydrated_workspaces.insert(workspace_id.clone());
            }
            RuntimeContextSyncScope::Thread {
                workspace_id,
                thread_id,
            } => {
                self.hydrated_threads
                    .insert(scope_thread_key(workspace_id.as_str(), thread_id.as_str()));
            }
        }
    }
}

fn scope_thread_key(workspace_id: &str, thread_id: &str) -> String {
    format!("{workspace_id}::{thread_id}")
}

impl RuntimeContextSyncScope {
    fn label(&self) -> &str {
        match self {
            RuntimeContextSyncScope::Global => "global",
            RuntimeContextSyncScope::Workspace { .. } => "workspace",
            RuntimeContextSyncScope::Thread { .. } => "thread",
        }
    }

    fn normalize(self) -> Self {
        match self {
            RuntimeContextSyncScope::Thread {
                workspace_id,
                thread_id,
            } if thread_id.trim().is_empty() => RuntimeContextSyncScope::Workspace { workspace_id },
            other => other,
        }
    }
}

fn map_turn_send_request(payload: &TurnSendRequest) -> EmbeddedRuntimeTurnSendRequest {
    EmbeddedRuntimeTurnSendRequest {
        workspace_id: payload.workspace_id.clone(),
        thread_id: payload.thread_id.clone(),
        request_id: payload.request_id.clone(),
        content: payload.content.clone(),
        context_prefix: payload.context_prefix.clone(),
        provider: payload.provider.clone(),
        model_id: payload.model_id.clone(),
        reason_effort: payload.reason_effort.clone(),
        service_tier: payload.service_tier.clone(),
        mission_mode: payload.mission_mode.clone(),
        execution_profile_id: payload.execution_profile_id.clone(),
        preferred_backend_ids: payload.preferred_backend_ids.clone(),
        execution_mode: payload.execution_mode.clone(),
        codex_bin: payload.codex_bin.clone(),
        codex_args: payload.codex_args.clone(),
        access_mode: payload.access_mode.clone(),
        queue: payload.queue,
        attachments: payload
            .attachments
            .iter()
            .map(|attachment| EmbeddedRuntimeTurnSendAttachment {
                id: attachment.id.clone(),
                name: attachment.name.clone(),
                mime_type: attachment.mime_type.clone(),
                size: attachment.size,
            })
            .collect(),
        collaboration_mode: payload.collaboration_mode.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn infer_runtime_context_scope_prefers_thread_when_both_ids_exist() {
        let payload = serde_json::json!({
            "payload": {
                "workspaceId": "workspace-1",
                "threadId": "thread-1"
            }
        });

        assert_eq!(
            infer_runtime_context_scope(unwrap_runtime_context_payload(&payload)),
            RuntimeContextSyncScope::Thread {
                workspace_id: "workspace-1".to_string(),
                thread_id: "thread-1".to_string(),
            }
        );
    }

    #[test]
    fn infer_runtime_context_scope_normalizes_blank_thread_to_workspace_scope() {
        let payload = serde_json::json!({
            "workspace_id": "workspace-1",
            "thread_id": "   "
        });

        assert_eq!(
            infer_runtime_context_scope(unwrap_runtime_context_payload(&payload)),
            RuntimeContextSyncScope::Workspace {
                workspace_id: "workspace-1".to_string(),
            }
        );
    }

    #[test]
    fn parses_workspace_scoped_state_fabric_snapshot_into_context_snapshot() {
        let payload = serde_json::json!({
            "revision": 7,
            "state": {
                "workspace": {
                    "id": "workspace-1",
                    "path": "/tmp/workspace-1",
                    "displayName": "Workspace 1",
                    "connected": true,
                    "defaultModelId": "gpt-5.4"
                },
                "threads": [{
                    "id": "thread-1",
                    "workspaceId": "workspace-1",
                    "title": "Thread 1",
                    "unread": false,
                    "running": false,
                    "createdAt": 1,
                    "updatedAt": 2,
                    "provider": "openai",
                    "modelId": "gpt-5.4",
                    "status": "idle",
                    "archived": false,
                    "lastActivityAt": 2,
                    "agentRole": null,
                    "agentNickname": null
                }]
            }
        });

        let snapshot = parse_context_snapshot_from_state_fabric_payload(
            &RuntimeContextSyncScope::Workspace {
                workspace_id: "workspace-1".to_string(),
            },
            &payload,
        )
        .expect("state fabric snapshot should parse");

        assert_eq!(snapshot.revision, 7);
        assert_eq!(snapshot.workspaces.len(), 1);
        assert_eq!(snapshot.workspaces[0].id, "workspace-1");
        assert_eq!(snapshot.threads.len(), 1);
        assert_eq!(snapshot.threads[0].id, "thread-1");
    }

    #[test]
    fn parses_thread_scoped_state_fabric_snapshot_into_context_snapshot() {
        let payload = serde_json::json!({
            "revision": 9,
            "state": {
                "workspace": {
                    "id": "workspace-1",
                    "path": "/tmp/workspace-1",
                    "displayName": "Workspace 1",
                    "connected": true,
                    "defaultModelId": "gpt-5.4"
                },
                "thread": {
                    "id": "thread-9",
                    "workspaceId": "workspace-1",
                    "title": "Thread 9",
                    "unread": false,
                    "running": true,
                    "createdAt": 1,
                    "updatedAt": 9,
                    "provider": "openai",
                    "modelId": "gpt-5.4",
                    "status": "running",
                    "archived": false,
                    "lastActivityAt": 9,
                    "agentRole": null,
                    "agentNickname": null
                }
            }
        });

        let snapshot = parse_context_snapshot_from_state_fabric_payload(
            &RuntimeContextSyncScope::Thread {
                workspace_id: "workspace-1".to_string(),
                thread_id: "thread-9".to_string(),
            },
            &payload,
        )
        .expect("thread scoped state fabric snapshot should parse");

        assert_eq!(snapshot.revision, 9);
        assert_eq!(snapshot.workspaces.len(), 1);
        assert_eq!(snapshot.threads.len(), 1);
        assert_eq!(snapshot.threads[0].id, "thread-9");
    }
}

fn map_turn_ack(ack: &EmbeddedRuntimeTurnAck) -> TurnAck {
    TurnAck {
        accepted: ack.accepted,
        turn_id: ack.turn_id.clone(),
        thread_id: ack.thread_id.clone(),
        routed_provider: ack.routed_provider.clone(),
        routed_model_id: ack.routed_model_id.clone(),
        routed_pool: ack.routed_pool.clone(),
        routed_source: ack.routed_source.clone(),
        message: ack.message.clone(),
    }
}

fn turn_ack_from_runtime_error(
    thread_id: Option<String>,
    _provider: Option<String>,
    _model_id: Option<String>,
    error: EmbeddedRuntimeError,
) -> TurnAck {
    TurnAck {
        accepted: false,
        turn_id: None,
        thread_id,
        routed_provider: None,
        routed_model_id: None,
        routed_pool: None,
        routed_source: None,
        message: format!("{}: {}", error.code, error.message),
    }
}

fn map_thread_live_subscription(
    subscription: EmbeddedRuntimeThreadLiveSubscription,
) -> ThreadLiveSubscribeResult {
    ThreadLiveSubscribeResult {
        subscription_id: subscription.subscription_id,
        heartbeat_interval_ms: subscription.heartbeat_interval_ms,
        transport_mode: subscription.transport_mode,
    }
}
