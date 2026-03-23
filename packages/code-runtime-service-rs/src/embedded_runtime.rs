use super::*;
use crate::{handle_rpc, RpcError};
use crate::embedded_runtime_context_sync::{
    apply_context_scope_snapshot_to_state, sort_context_state, thread_snapshot_to_summary,
    workspace_snapshot_to_summary,
};
use crate::oauth_pool::default_oauth_pool_db_path;

use serde::{de::DeserializeOwned, Deserialize, Serialize};
use tokio::{sync::broadcast, task::JoinHandle};
use tokio_util::sync::CancellationToken;

const DEFAULT_EMBEDDED_RUNTIME_BACKEND_ID: &str = "tauri-embedded-runtime";
const DEFAULT_EMBEDDED_RUNTIME_PORT: u16 = 8788;
const DEFAULT_EMBEDDED_OAUTH_SECRET_KEY: &str =
    "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=";

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddedRuntimeWorkspaceSnapshot {
    pub id: String,
    pub path: String,
    pub display_name: String,
    pub connected: bool,
    pub default_model_id: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddedRuntimeThreadSnapshot {
    pub id: String,
    pub workspace_id: String,
    pub title: String,
    pub unread: bool,
    pub running: bool,
    pub created_at: u64,
    pub updated_at: u64,
    pub provider: String,
    pub model_id: Option<String>,
    pub status: Option<String>,
    #[serde(default)]
    pub archived: bool,
    pub last_activity_at: Option<u64>,
    pub agent_role: Option<String>,
    pub agent_nickname: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddedRuntimeTurnSendAttachment {
    pub id: String,
    pub name: String,
    #[serde(alias = "mime_type")]
    pub mime_type: String,
    pub size: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddedRuntimeTurnSendRequest {
    #[serde(alias = "workspace_id")]
    pub workspace_id: String,
    #[serde(alias = "thread_id")]
    pub thread_id: Option<String>,
    #[serde(alias = "request_id")]
    pub request_id: Option<String>,
    pub content: String,
    #[serde(alias = "context_prefix")]
    pub context_prefix: Option<String>,
    pub provider: Option<String>,
    #[serde(alias = "model_id")]
    pub model_id: Option<String>,
    #[serde(alias = "reason_effort")]
    pub reason_effort: Option<String>,
    #[serde(alias = "service_tier")]
    pub service_tier: Option<String>,
    #[serde(alias = "mission_mode")]
    pub mission_mode: Option<String>,
    #[serde(alias = "execution_profile_id")]
    pub execution_profile_id: Option<String>,
    #[serde(alias = "preferred_backend_ids")]
    pub preferred_backend_ids: Option<Vec<String>>,
    #[serde(alias = "execution_mode")]
    pub execution_mode: Option<String>,
    #[serde(alias = "codex_bin")]
    pub codex_bin: Option<String>,
    #[serde(alias = "codex_args")]
    pub codex_args: Option<Vec<String>>,
    #[serde(alias = "access_mode")]
    pub access_mode: String,
    pub queue: bool,
    #[serde(default)]
    pub attachments: Vec<EmbeddedRuntimeTurnSendAttachment>,
    #[serde(alias = "collaboration_mode")]
    pub collaboration_mode: Option<Value>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddedRuntimeTurnAck {
    pub accepted: bool,
    pub turn_id: Option<String>,
    pub thread_id: Option<String>,
    pub routed_provider: Option<String>,
    pub routed_model_id: Option<String>,
    pub routed_pool: Option<String>,
    pub routed_source: Option<String>,
    pub message: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddedRuntimeTurnInterruptRequest {
    #[serde(alias = "turn_id")]
    pub turn_id: Option<String>,
    pub reason: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddedRuntimeThreadLiveSubscription {
    pub subscription_id: String,
    pub heartbeat_interval_ms: u64,
    pub transport_mode: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddedRuntimeContextSnapshot {
    pub revision: u64,
    #[serde(default)]
    pub workspaces: Vec<EmbeddedRuntimeWorkspaceSnapshot>,
    #[serde(default)]
    pub threads: Vec<EmbeddedRuntimeThreadSnapshot>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum EmbeddedRuntimeContextChange {
    WorkspaceUpsert { workspace: EmbeddedRuntimeWorkspaceSnapshot },
    WorkspaceRemove { workspace_id: String },
    ThreadUpsert { thread: EmbeddedRuntimeThreadSnapshot },
    ThreadRemove { workspace_id: String, thread_id: String },
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddedRuntimeContextDelta {
    pub base_revision: u64,
    pub revision: u64,
    #[serde(default)]
    pub changes: Vec<EmbeddedRuntimeContextChange>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddedRuntimeEventFrame {
    pub event_id: u64,
    pub envelope: Value,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddedRuntimeEventReplay {
    pub frames: Vec<EmbeddedRuntimeEventFrame>,
    pub resync_event: Option<EmbeddedRuntimeEventFrame>,
    pub newest_event_id: Option<u64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddedRuntimeError {
    pub code: String,
    pub message: String,
}

#[derive(Clone)]
pub struct EmbeddedRuntime {
    app_state: RuntimeAppState,
    event_frames: broadcast::Sender<EmbeddedRuntimeEventFrame>,
    event_relay_shutdown: CancellationToken,
    event_relay_handle: Arc<std::sync::Mutex<Option<JoinHandle<()>>>>,
}

impl EmbeddedRuntime {
    pub fn from_env(default_model_id: Option<&str>) -> Result<Self, EmbeddedRuntimeError> {
        let config = embedded_runtime_service_config(default_model_id)?;
        let state = create_initial_state(config.default_model_id.as_str());
        Self::from_config(state, config)
    }

    pub fn from_config(
        state: SharedRuntimeState,
        config: ServiceConfig,
    ) -> Result<Self, EmbeddedRuntimeError> {
        let validation = validate_service_config(&config);
        if !validation.errors.is_empty() {
            return Err(EmbeddedRuntimeError {
                code: "INVALID_CONFIG".to_string(),
                message: validation.errors.join(" "),
            });
        }
        let native_state_store =
            Arc::new(native_state_store::NativeStateStore::from_env_or_default());
        let app_state = build_runtime_app_state(state, config, native_state_store);
        let (event_frames, _) = broadcast::channel(TURN_EVENTS_BUFFER);
        let runtime = Self {
            app_state,
            event_frames,
            event_relay_shutdown: CancellationToken::new(),
            event_relay_handle: Arc::new(std::sync::Mutex::new(None)),
        };
        runtime.spawn_event_relay();
        Ok(runtime)
    }

    pub fn subscribe_events(&self) -> broadcast::Receiver<EmbeddedRuntimeEventFrame> {
        self.event_frames.subscribe()
    }

    pub async fn shutdown(&self) {
        self.app_state.shutdown_background_tasks().await;
        self.shutdown_event_relay().await;
    }

    pub fn replay_events_after(
        &self,
        last_event_id: Option<u64>,
    ) -> Result<EmbeddedRuntimeEventReplay, EmbeddedRuntimeError> {
        let ctx = self.app_state.context();
        let replay = resolve_turn_event_replay_frames_for_last_event_id(&ctx, last_event_id);
        let replay_gap = replay.replay_gap;
        let newest_event_id = replay.frames.last().map(|frame| frame.id);
        let frames = replay
            .frames
            .into_iter()
            .map(parse_embedded_runtime_event_frame)
            .collect::<Result<Vec<_>, _>>()?;
        let suppress_state_only_resync = replay_gap.is_some()
            && frames.len() == 1
            && frames[0]
                .envelope
                .get("kind")
                .and_then(Value::as_str)
                .is_some_and(|kind| kind == "runtime.updated");
        let resync_event = if suppress_state_only_resync {
            None
        } else {
            replay_gap.map(|gap| EmbeddedRuntimeEventFrame {
                event_id: gap.oldest_available_event_id.saturating_sub(1),
                envelope: build_runtime_stream_resync_event_envelope(
                    ctx.runtime_update_revision.load(std::sync::atomic::Ordering::Relaxed)
                        .to_string(),
                    EVENT_STREAM_RESYNC_REASON_REPLAY_GAP,
                    Some(json!({
                        "replayGapLastEventId": gap.requested_last_event_id,
                        "replayGapOldestEventId": gap.oldest_available_event_id,
                    })),
                ),
            })
        };
        Ok(EmbeddedRuntimeEventReplay {
            frames,
            resync_event,
            newest_event_id,
        })
    }

    pub async fn invoke_value(
        &self,
        method: &str,
        params: &Value,
    ) -> Result<Value, EmbeddedRuntimeError> {
        handle_rpc(self.app_state.context(), method, params)
            .await
            .map_err(embedded_runtime_error_from_rpc)
    }

    pub async fn invoke_json<T: DeserializeOwned>(
        &self,
        method: &str,
        params: &Value,
    ) -> Result<T, EmbeddedRuntimeError> {
        let value = self.invoke_value(method, params).await?;
        serde_json::from_value(value).map_err(|error| EmbeddedRuntimeError {
            code: "INTERNAL_ERROR".to_string(),
            message: format!("decode embedded {method} result failed: {error}"),
        })
    }

    pub async fn sync_workspace_snapshot(&self, snapshot: EmbeddedRuntimeWorkspaceSnapshot) {
        self.apply_context_delta(EmbeddedRuntimeContextDelta {
            base_revision: 0,
            revision: 0,
            changes: vec![EmbeddedRuntimeContextChange::WorkspaceUpsert {
                workspace: snapshot,
            }],
        })
        .await;
    }

    pub async fn sync_thread_snapshot(&self, snapshot: EmbeddedRuntimeThreadSnapshot) {
        self.apply_context_delta(EmbeddedRuntimeContextDelta {
            base_revision: 0,
            revision: 0,
            changes: vec![EmbeddedRuntimeContextChange::ThreadUpsert { thread: snapshot }],
        })
        .await;
    }

    pub async fn apply_context_snapshot(&self, snapshot: EmbeddedRuntimeContextSnapshot) {
        let mut state = self.app_state.context().state.write().await;
        apply_context_scope_snapshot_to_state(&mut state, &EmbeddedRuntimeContextScope::Global, snapshot);
    }

    pub async fn apply_context_scope_snapshot(
        &self,
        scope: EmbeddedRuntimeContextScope,
        snapshot: EmbeddedRuntimeContextSnapshot,
    ) {
        match scope {
            EmbeddedRuntimeContextScope::Global => {
                self.apply_context_snapshot(snapshot).await;
            }
            EmbeddedRuntimeContextScope::Workspace { workspace_id } => {
                let mut state = self.app_state.context().state.write().await;
                apply_context_scope_snapshot_to_state(
                    &mut state,
                    &EmbeddedRuntimeContextScope::Workspace { workspace_id },
                    snapshot,
                );
            }
            EmbeddedRuntimeContextScope::Thread {
                workspace_id,
                thread_id,
            } => {
                let mut state = self.app_state.context().state.write().await;
                apply_context_scope_snapshot_to_state(
                    &mut state,
                    &EmbeddedRuntimeContextScope::Thread {
                        workspace_id,
                        thread_id,
                    },
                    snapshot,
                );
            }
        }
    }

    pub async fn apply_context_delta(&self, delta: EmbeddedRuntimeContextDelta) {
        let mut state = self.app_state.context().state.write().await;
        for change in delta.changes {
            match change {
                EmbeddedRuntimeContextChange::WorkspaceUpsert { workspace } => {
                    if let Some(existing) =
                        state.workspaces.iter_mut().find(|entry| entry.id == workspace.id)
                    {
                        *existing = workspace_snapshot_to_summary(&workspace);
                    } else {
                        state.workspaces.push(workspace_snapshot_to_summary(&workspace));
                    }
                    state
                        .workspace_threads
                        .entry(workspace.id)
                        .or_insert_with(Vec::new);
                }
                EmbeddedRuntimeContextChange::WorkspaceRemove { workspace_id } => {
                    state.workspaces.retain(|workspace| workspace.id != workspace_id);
                    state.workspace_threads.remove(workspace_id.as_str());
                }
                EmbeddedRuntimeContextChange::ThreadUpsert { thread } => {
                    let thread_id = thread.id.clone();
                    for threads in state.workspace_threads.values_mut() {
                        threads.retain(|entry| entry.id != thread_id);
                    }
                    let threads = state
                        .workspace_threads
                        .entry(thread.workspace_id.clone())
                        .or_insert_with(Vec::new);
                    if let Some(existing) = threads.iter_mut().find(|entry| entry.id == thread_id) {
                        *existing = thread_snapshot_to_summary(thread);
                    } else {
                        threads.push(thread_snapshot_to_summary(thread));
                    }
                }
                EmbeddedRuntimeContextChange::ThreadRemove {
                    workspace_id,
                    thread_id,
                } => {
                    if let Some(threads) = state.workspace_threads.get_mut(workspace_id.as_str()) {
                        threads.retain(|thread| thread.id != thread_id);
                    }
                }
            }
        }
        sort_context_state(&mut state);
    }

    pub async fn send_turn(
        &self,
        request: EmbeddedRuntimeTurnSendRequest,
    ) -> Result<EmbeddedRuntimeTurnAck, EmbeddedRuntimeError> {
        self.invoke_json("code_turn_send", &json!({ "payload": request }))
            .await
    }

    pub async fn interrupt_turn(
        &self,
        request: EmbeddedRuntimeTurnInterruptRequest,
    ) -> Result<bool, EmbeddedRuntimeError> {
        self.invoke_json("code_turn_interrupt", &json!({ "payload": request }))
            .await
    }

    pub async fn thread_live_subscribe(
        &self,
        workspace_id: &str,
        thread_id: &str,
    ) -> Result<EmbeddedRuntimeThreadLiveSubscription, EmbeddedRuntimeError> {
        self.invoke_json(
            "code_thread_live_subscribe",
            &json!({
                "workspaceId": workspace_id,
                "threadId": thread_id,
            }),
        )
        .await
    }

    pub async fn thread_live_unsubscribe(
        &self,
        subscription_id: &str,
    ) -> Result<bool, EmbeddedRuntimeError> {
        let response = self
            .invoke_json::<Value>(
            "code_thread_live_unsubscribe",
            &json!({
                "subscriptionId": subscription_id,
            }),
        )
        .await?;
        Ok(response
            .get("ok")
            .and_then(Value::as_bool)
            .unwrap_or(false))
    }

    fn spawn_event_relay(&self) {
        let mut receiver = self.app_state.context().turn_events.subscribe();
        let sender = self.event_frames.clone();
        let shutdown = self.event_relay_shutdown.clone();
        let handle = tokio::spawn(async move {
            loop {
                tokio::select! {
                    _ = shutdown.cancelled() => break,
                    result = receiver.recv() => match result {
                        Ok(frame) => {
                            let Ok(envelope) = serde_json::from_str::<Value>(&frame.payload_json) else {
                                continue;
                            };
                            let _ = sender.send(EmbeddedRuntimeEventFrame {
                                event_id: frame.id,
                                envelope,
                            });
                        }
                        Err(broadcast::error::RecvError::Lagged(_)) => continue,
                        Err(broadcast::error::RecvError::Closed) => break,
                    }
                }
            }
        });
        let mut relay_handle = match self.event_relay_handle.lock() {
            Ok(guard) => guard,
            Err(poisoned) => poisoned.into_inner(),
        };
        *relay_handle = Some(handle);
    }

    async fn shutdown_event_relay(&self) {
        self.event_relay_shutdown.cancel();
        let handle = {
            let mut guard = match self.event_relay_handle.lock() {
                Ok(guard) => guard,
                Err(poisoned) => poisoned.into_inner(),
            };
            guard.take()
        };
        if let Some(handle) = handle {
            let _ = handle.await;
        }
    }
}

impl Drop for EmbeddedRuntime {
    fn drop(&mut self) {
        self.event_relay_shutdown.cancel();
    }
}

fn parse_embedded_runtime_event_frame(
    frame: TurnEventFrame,
) -> Result<EmbeddedRuntimeEventFrame, EmbeddedRuntimeError> {
    let envelope =
        serde_json::from_str::<Value>(&frame.payload_json).map_err(|error| EmbeddedRuntimeError {
            code: "INTERNAL_ERROR".to_string(),
            message: format!("decode embedded runtime event replay failed: {error}"),
        })?;
    Ok(EmbeddedRuntimeEventFrame {
        event_id: frame.id,
        envelope,
    })
}

fn embedded_runtime_error_from_rpc(error: RpcError) -> EmbeddedRuntimeError {
    EmbeddedRuntimeError {
        code: error.code_str().to_string(),
        message: error.message().to_string(),
    }
}

fn embedded_runtime_service_config(
    default_model_id: Option<&str>,
) -> Result<ServiceConfig, EmbeddedRuntimeError> {
    let resolved_default_model_id = env_string("CODE_RUNTIME_SERVICE_DEFAULT_MODEL")
        .or_else(|| default_model_id.map(str::trim).map(str::to_string))
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "gpt-5.4".to_string());
    let provider_extension_seeds = parse_provider_extension_seeds(
        std::env::var("CODE_RUNTIME_SERVICE_PROVIDER_EXTENSIONS_JSON")
            .ok()
            .as_deref(),
    )
    .map_err(|message| EmbeddedRuntimeError {
        code: "INVALID_CONFIG".to_string(),
        message,
    })?;
    let runtime_backend_capabilities = env_string("CODE_RUNTIME_SERVICE_RUNTIME_BACKEND_CAPABILITIES")
        .unwrap_or_else(|| DEFAULT_RUNTIME_BACKEND_CAPABILITIES.to_string())
        .split(',')
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(str::to_string)
        .collect::<Vec<_>>();

    Ok(ServiceConfig {
        default_model_id: resolved_default_model_id,
        openai_api_key: env_string("OPENAI_API_KEY")
            .or_else(|| env_string("CODE_RUNTIME_SERVICE_OPENAI_API_KEY")),
        openai_endpoint: env_string("CODE_RUNTIME_SERVICE_OPENAI_ENDPOINT")
            .unwrap_or_else(|| "https://api.openai.com/v1/responses".to_string()),
        openai_compat_base_url: env_string("CODE_RUNTIME_SERVICE_OPENAI_COMPAT_BASE_URL"),
        openai_compat_api_key: env_string("CODE_RUNTIME_SERVICE_OPENAI_COMPAT_API_KEY"),
        anthropic_api_key: env_string("ANTHROPIC_API_KEY")
            .or_else(|| env_string("CODE_RUNTIME_SERVICE_ANTHROPIC_API_KEY")),
        anthropic_endpoint: env_string("CODE_RUNTIME_SERVICE_ANTHROPIC_ENDPOINT")
            .unwrap_or_else(|| DEFAULT_ANTHROPIC_ENDPOINT.to_string()),
        anthropic_version: env_string("CODE_RUNTIME_SERVICE_ANTHROPIC_VERSION")
            .unwrap_or_else(|| DEFAULT_ANTHROPIC_VERSION.to_string()),
        gemini_api_key: env_string("GEMINI_API_KEY")
            .or_else(|| env_string("CODE_RUNTIME_SERVICE_GEMINI_API_KEY")),
        gemini_endpoint: env_string("CODE_RUNTIME_SERVICE_GEMINI_ENDPOINT")
            .unwrap_or_else(|| DEFAULT_GEMINI_ENDPOINT.to_string()),
        openai_timeout_ms: env_u64("CODE_RUNTIME_SERVICE_OPENAI_TIMEOUT_MS")
            .unwrap_or(DEFAULT_OPENAI_TIMEOUT_MS),
        openai_max_retries: env_u32("CODE_RUNTIME_SERVICE_OPENAI_MAX_RETRIES")
            .unwrap_or(DEFAULT_OPENAI_MAX_RETRIES),
        openai_retry_base_ms: env_u64("CODE_RUNTIME_SERVICE_OPENAI_RETRY_BASE_MS")
            .unwrap_or(DEFAULT_OPENAI_RETRY_BASE_MS),
        openai_compat_model_cache_ttl_ms: env_u64(
            "CODE_RUNTIME_SERVICE_OPENAI_COMPAT_MODEL_CACHE_TTL_MS",
        )
        .unwrap_or(DEFAULT_OPENAI_COMPAT_MODEL_CACHE_TTL_MS),
        live_skills_network_enabled: env_bool("CODE_RUNTIME_SERVICE_LIVE_SKILLS_NETWORK_ENABLED")
            .unwrap_or(true),
        live_skills_network_base_url: env_string("CODE_RUNTIME_SERVICE_LIVE_SKILLS_NETWORK_BASE_URL")
            .unwrap_or_else(|| DEFAULT_LIVE_SKILLS_NETWORK_BASE_URL.to_string()),
        live_skills_network_timeout_ms: env_u64(
            "CODE_RUNTIME_SERVICE_LIVE_SKILLS_NETWORK_TIMEOUT_MS",
        )
        .unwrap_or(DEFAULT_LIVE_SKILLS_NETWORK_TIMEOUT_MS),
        live_skills_network_cache_ttl_ms: env_u64(
            "CODE_RUNTIME_SERVICE_LIVE_SKILLS_NETWORK_CACHE_TTL_MS",
        )
        .unwrap_or(DEFAULT_LIVE_SKILLS_NETWORK_CACHE_TTL_MS),
        sandbox_enabled: env_bool("CODE_RUNTIME_SERVICE_SANDBOX_ENABLED").unwrap_or(false),
        sandbox_network_access: env_string("CODE_RUNTIME_SERVICE_SANDBOX_NETWORK_ACCESS")
            .unwrap_or_else(|| DEFAULT_SANDBOX_NETWORK_ACCESS.to_string()),
        sandbox_allowed_hosts: env_string("CODE_RUNTIME_SERVICE_SANDBOX_ALLOWED_HOSTS")
            .map(|value| {
                value
                    .split(',')
                    .map(str::trim)
                    .filter(|entry| !entry.is_empty())
                    .map(str::to_string)
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default(),
        oauth_pool_db_path: env_string("CODE_RUNTIME_SERVICE_OAUTH_POOL_DB_PATH")
            .unwrap_or_else(default_oauth_pool_db_path),
        oauth_secret_key: env_string("CODE_RUNTIME_SERVICE_OAUTH_SECRET_KEY")
            .or_else(|| Some(DEFAULT_EMBEDDED_OAUTH_SECRET_KEY.to_string())),
        oauth_public_base_url: env_string("CODE_RUNTIME_SERVICE_OAUTH_PUBLIC_BASE_URL"),
        oauth_loopback_callback_port: env_u16("CODE_RUNTIME_SERVICE_OAUTH_LOOPBACK_CALLBACK_PORT")
            .unwrap_or(DEFAULT_OAUTH_LOOPBACK_CALLBACK_PORT),
        runtime_auth_token: env_string("CODE_RUNTIME_SERVICE_RUNTIME_AUTH_TOKEN"),
        agent_max_concurrent_tasks: env_usize("CODE_RUNTIME_SERVICE_AGENT_MAX_CONCURRENT_TASKS")
            .unwrap_or(DEFAULT_AGENT_MAX_CONCURRENT_TASKS),
        agent_task_history_limit: env_usize("CODE_RUNTIME_SERVICE_AGENT_TASK_HISTORY_LIMIT")
            .unwrap_or(DEFAULT_AGENT_TASK_HISTORY_LIMIT),
        distributed_enabled: env_bool("CODE_RUNTIME_SERVICE_DISTRIBUTED_ENABLED")
            .unwrap_or(false),
        distributed_redis_url: env_string("CODE_RUNTIME_SERVICE_DISTRIBUTED_REDIS_URL"),
        distributed_lane_count: env_usize("CODE_RUNTIME_SERVICE_DISTRIBUTED_LANE_COUNT")
            .unwrap_or(DEFAULT_DISTRIBUTED_LANE_COUNT),
        distributed_worker_concurrency: env_usize(
            "CODE_RUNTIME_SERVICE_DISTRIBUTED_WORKER_CONCURRENCY",
        )
        .unwrap_or(DEFAULT_DISTRIBUTED_WORKER_CONCURRENCY),
        distributed_claim_idle_ms: env_u64("CODE_RUNTIME_SERVICE_DISTRIBUTED_CLAIM_IDLE_MS")
            .unwrap_or(DEFAULT_DISTRIBUTED_CLAIM_IDLE_MS),
        discovery_enabled: env_bool("CODE_RUNTIME_SERVICE_DISCOVERY_ENABLED").unwrap_or(false),
        discovery_service_type: env_string("CODE_RUNTIME_SERVICE_DISCOVERY_SERVICE_TYPE")
            .unwrap_or_else(|| DEFAULT_DISCOVERY_SERVICE_TYPE.to_string()),
        discovery_browse_interval_ms: env_u64(
            "CODE_RUNTIME_SERVICE_DISCOVERY_BROWSE_INTERVAL_MS",
        )
        .unwrap_or(DEFAULT_DISCOVERY_BROWSE_INTERVAL_MS),
        discovery_stale_ttl_ms: env_u64("CODE_RUNTIME_SERVICE_DISCOVERY_STALE_TTL_MS")
            .unwrap_or(DEFAULT_DISCOVERY_STALE_TTL_MS),
        runtime_backend_id: env_string("CODE_RUNTIME_SERVICE_RUNTIME_BACKEND_ID")
            .unwrap_or_else(|| DEFAULT_EMBEDDED_RUNTIME_BACKEND_ID.to_string()),
        runtime_backend_capabilities,
        runtime_port: env_u16("CODE_RUNTIME_SERVICE_RUNTIME_PORT")
            .unwrap_or(DEFAULT_EMBEDDED_RUNTIME_PORT),
        ws_write_buffer_size_bytes: env_usize(
            "CODE_RUNTIME_SERVICE_WS_WRITE_BUFFER_SIZE_BYTES",
        )
        .unwrap_or(DEFAULT_RUNTIME_WS_WRITE_BUFFER_SIZE_BYTES),
        ws_max_write_buffer_size_bytes: env_usize(
            "CODE_RUNTIME_SERVICE_WS_MAX_WRITE_BUFFER_SIZE_BYTES",
        )
        .unwrap_or(DEFAULT_RUNTIME_WS_MAX_WRITE_BUFFER_SIZE_BYTES),
        ws_max_frame_size_bytes: env_usize("CODE_RUNTIME_SERVICE_WS_MAX_FRAME_SIZE_BYTES")
            .unwrap_or(DEFAULT_RUNTIME_WS_MAX_FRAME_SIZE_BYTES),
        ws_max_message_size_bytes: env_usize(
            "CODE_RUNTIME_SERVICE_WS_MAX_MESSAGE_SIZE_BYTES",
        )
        .unwrap_or(DEFAULT_RUNTIME_WS_MAX_MESSAGE_SIZE_BYTES),
        ws_max_connections: env_usize("CODE_RUNTIME_SERVICE_WS_MAX_CONNECTIONS")
            .unwrap_or(DEFAULT_RUNTIME_WS_MAX_CONNECTIONS),
        provider_extension_seeds,
    })
}

fn env_string(key: &str) -> Option<String> {
    std::env::var(key)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn env_bool(key: &str) -> Option<bool> {
    env_string(key).and_then(|value| match value.to_ascii_lowercase().as_str() {
        "1" | "true" | "yes" | "on" => Some(true),
        "0" | "false" | "no" | "off" => Some(false),
        _ => None,
    })
}

fn env_u16(key: &str) -> Option<u16> {
    env_string(key).and_then(|value| value.parse::<u16>().ok())
}

fn env_u32(key: &str) -> Option<u32> {
    env_string(key).and_then(|value| value.parse::<u32>().ok())
}

fn env_u64(key: &str) -> Option<u64> {
    env_string(key).and_then(|value| value.parse::<u64>().ok())
}

fn env_usize(key: &str) -> Option<usize> {
    env_string(key).and_then(|value| value.parse::<usize>().ok())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::time::{timeout, Duration};

    fn test_config() -> ServiceConfig {
        ServiceConfig {
            default_model_id: "gpt-5.4".to_string(),
            openai_api_key: Some("test-openai-key".to_string()),
            openai_endpoint: "https://api.openai.com/v1/responses".to_string(),
            openai_compat_base_url: None,
            openai_compat_api_key: None,
            anthropic_api_key: None,
            anthropic_endpoint: DEFAULT_ANTHROPIC_ENDPOINT.to_string(),
            anthropic_version: DEFAULT_ANTHROPIC_VERSION.to_string(),
            gemini_api_key: None,
            gemini_endpoint: DEFAULT_GEMINI_ENDPOINT.to_string(),
            openai_timeout_ms: DEFAULT_OPENAI_TIMEOUT_MS,
            openai_max_retries: DEFAULT_OPENAI_MAX_RETRIES,
            openai_retry_base_ms: DEFAULT_OPENAI_RETRY_BASE_MS,
            openai_compat_model_cache_ttl_ms: DEFAULT_OPENAI_COMPAT_MODEL_CACHE_TTL_MS,
            live_skills_network_enabled: false,
            live_skills_network_base_url: DEFAULT_LIVE_SKILLS_NETWORK_BASE_URL.to_string(),
            live_skills_network_timeout_ms: DEFAULT_LIVE_SKILLS_NETWORK_TIMEOUT_MS,
            live_skills_network_cache_ttl_ms: DEFAULT_LIVE_SKILLS_NETWORK_CACHE_TTL_MS,
            sandbox_enabled: false,
            sandbox_network_access: DEFAULT_SANDBOX_NETWORK_ACCESS.to_string(),
            sandbox_allowed_hosts: Vec::new(),
            oauth_pool_db_path: ":memory:".to_string(),
            oauth_secret_key: Some(DEFAULT_EMBEDDED_OAUTH_SECRET_KEY.to_string()),
            oauth_public_base_url: None,
            oauth_loopback_callback_port: DEFAULT_OAUTH_LOOPBACK_CALLBACK_PORT,
            runtime_auth_token: None,
            agent_max_concurrent_tasks: DEFAULT_AGENT_MAX_CONCURRENT_TASKS,
            agent_task_history_limit: DEFAULT_AGENT_TASK_HISTORY_LIMIT,
            distributed_enabled: false,
            distributed_redis_url: None,
            distributed_lane_count: DEFAULT_DISTRIBUTED_LANE_COUNT,
            distributed_worker_concurrency: DEFAULT_DISTRIBUTED_WORKER_CONCURRENCY,
            distributed_claim_idle_ms: DEFAULT_DISTRIBUTED_CLAIM_IDLE_MS,
            discovery_enabled: false,
            discovery_service_type: DEFAULT_DISCOVERY_SERVICE_TYPE.to_string(),
            discovery_browse_interval_ms: DEFAULT_DISCOVERY_BROWSE_INTERVAL_MS,
            discovery_stale_ttl_ms: DEFAULT_DISCOVERY_STALE_TTL_MS,
            runtime_backend_id: "embedded-runtime-test".to_string(),
            runtime_backend_capabilities: vec!["code".to_string()],
            runtime_port: DEFAULT_EMBEDDED_RUNTIME_PORT,
            ws_write_buffer_size_bytes: DEFAULT_RUNTIME_WS_WRITE_BUFFER_SIZE_BYTES,
            ws_max_write_buffer_size_bytes: DEFAULT_RUNTIME_WS_MAX_WRITE_BUFFER_SIZE_BYTES,
            ws_max_frame_size_bytes: DEFAULT_RUNTIME_WS_MAX_FRAME_SIZE_BYTES,
            ws_max_message_size_bytes: DEFAULT_RUNTIME_WS_MAX_MESSAGE_SIZE_BYTES,
            ws_max_connections: DEFAULT_RUNTIME_WS_MAX_CONNECTIONS,
            provider_extension_seeds: Vec::new(),
        }
    }

    fn test_runtime() -> EmbeddedRuntime {
        EmbeddedRuntime::from_config(create_initial_state("gpt-5.4"), test_config())
            .expect("embedded runtime should build")
    }

    #[tokio::test]
    async fn shutdown_stops_event_relay_and_is_idempotent() {
        let runtime = test_runtime();
        runtime.shutdown().await;
        runtime.shutdown().await;

        assert!(runtime.event_relay_shutdown.is_cancelled());
        let relay_handle = runtime
            .event_relay_handle
            .lock()
            .expect("embedded runtime relay handle lock");
        assert!(
            relay_handle.is_none(),
            "embedded runtime shutdown should await and clear relay handle"
        );
    }

    #[tokio::test]
    async fn send_turn_accepts_context_prefix_and_codex_overrides() {
        let runtime = test_runtime();
        runtime
            .sync_workspace_snapshot(EmbeddedRuntimeWorkspaceSnapshot {
                id: "workspace-local".to_string(),
                path: resolve_default_workspace_path(),
                display_name: "Workspace".to_string(),
                connected: true,
                default_model_id: Some("gpt-5.4".to_string()),
            })
            .await;

        let ack = runtime
            .send_turn(EmbeddedRuntimeTurnSendRequest {
                workspace_id: "workspace-local".to_string(),
                thread_id: None,
                request_id: Some("req-embedded-1".to_string()),
                content: "Implement runtime parity".to_string(),
                context_prefix: Some("[ATLAS_CONTEXT v1]\nplan: parity".to_string()),
                provider: Some("openai".to_string()),
                model_id: Some("gpt-5.4".to_string()),
                reason_effort: Some("high".to_string()),
                service_tier: None,
                mission_mode: Some("delegate".to_string()),
                execution_profile_id: Some("balanced-delegate".to_string()),
                preferred_backend_ids: Some(vec!["backend-a".to_string()]),
                execution_mode: Some("local-cli".to_string()),
                codex_bin: Some("/opt/codex".to_string()),
                codex_args: Some(vec!["--profile".to_string(), "desktop".to_string()]),
                access_mode: "on-request".to_string(),
                queue: false,
                attachments: Vec::new(),
                collaboration_mode: Some(json!({
                    "mode": "plan",
                    "settings": {
                        "id": "plan",
                        "developer_instructions": "Return a plan first.",
                        "model": "gpt-5.4",
                        "reasoning_effort": "high"
                    }
                })),
            })
            .await
            .expect("embedded send turn should accept request");

        assert!(ack.accepted);
        assert!(ack.turn_id.is_some());
        assert!(ack.thread_id.is_some());
        assert_eq!(ack.routed_provider.as_deref(), Some("openai"));
    }

    #[tokio::test]
    async fn interrupt_turn_resolves_active_turns() {
        let runtime = test_runtime();
        runtime
            .sync_workspace_snapshot(EmbeddedRuntimeWorkspaceSnapshot {
                id: "workspace-local".to_string(),
                path: resolve_default_workspace_path(),
                display_name: "Workspace".to_string(),
                connected: true,
                default_model_id: Some("gpt-5.4".to_string()),
            })
            .await;

        let ack = runtime
            .send_turn(EmbeddedRuntimeTurnSendRequest {
                workspace_id: "workspace-local".to_string(),
                thread_id: None,
                request_id: Some("req-embedded-2".to_string()),
                content: "Interrupt me".to_string(),
                context_prefix: None,
                provider: Some("openai".to_string()),
                model_id: Some("gpt-5.4".to_string()),
                reason_effort: Some("high".to_string()),
                service_tier: None,
                mission_mode: Some("pair".to_string()),
                execution_profile_id: Some("operator-review".to_string()),
                preferred_backend_ids: Some(vec!["backend-b".to_string()]),
                execution_mode: Some("runtime".to_string()),
                codex_bin: None,
                codex_args: None,
                access_mode: "on-request".to_string(),
                queue: false,
                attachments: Vec::new(),
                collaboration_mode: None,
            })
            .await
            .expect("embedded send turn should accept request");

        let interrupted = runtime
            .interrupt_turn(EmbeddedRuntimeTurnInterruptRequest {
                turn_id: ack.turn_id.clone(),
                reason: Some("user-stop".to_string()),
            })
            .await
            .expect("interrupt should decode");

        assert!(interrupted);
    }

    #[tokio::test]
    async fn thread_live_subscribe_emits_heartbeat_event() {
        let runtime = test_runtime();
        runtime
            .sync_workspace_snapshot(EmbeddedRuntimeWorkspaceSnapshot {
                id: "workspace-local".to_string(),
                path: resolve_default_workspace_path(),
                display_name: "Workspace".to_string(),
                connected: true,
                default_model_id: Some("gpt-5.4".to_string()),
            })
            .await;
        runtime
            .sync_thread_snapshot(EmbeddedRuntimeThreadSnapshot {
                id: "thread-live-1".to_string(),
                workspace_id: "workspace-local".to_string(),
                title: "Thread live".to_string(),
                unread: false,
                running: false,
                created_at: 1,
                updated_at: 1,
                provider: "openai".to_string(),
                model_id: Some("gpt-5.4".to_string()),
                status: Some("idle".to_string()),
                archived: false,
                last_activity_at: Some(1),
                agent_role: None,
                agent_nickname: None,
            })
            .await;
        let mut events = runtime.subscribe_events();

        let subscription = runtime
            .thread_live_subscribe("workspace-local", "thread-live-1")
            .await
            .expect("thread live subscription should succeed");
        assert_eq!(subscription.transport_mode, "push");

        let heartbeat = timeout(Duration::from_secs(2), async {
            loop {
                let frame = events.recv().await.expect("embedded event frame");
                let method = frame
                    .envelope
                    .get("method")
                    .or_else(|| {
                        frame.envelope
                            .get("message")
                            .and_then(Value::as_object)
                            .and_then(|message| message.get("method"))
                    })
                    .and_then(Value::as_str);
                if matches!(
                    method,
                    Some("thread.live_heartbeat" | "native_state_fabric_updated")
                ) {
                    return frame;
                }
            }
        })
        .await
        .expect("thread live heartbeat should arrive");
        let payload = heartbeat
            .envelope
            .get("payload")
            .or_else(|| {
                heartbeat
                    .envelope
                    .get("params")
                    .or_else(|| {
                        heartbeat
                            .envelope
                            .get("message")
                            .and_then(Value::as_object)
                            .and_then(|message| message.get("params"))
                    })
            })
            .and_then(Value::as_object)
            .cloned()
            .expect("heartbeat payload");

        assert_eq!(
            payload
                .get("changeKind")
                .and_then(Value::as_str),
            Some("threadLiveHeartbeatObserved")
        );
        assert_eq!(
            payload
                .get("subscriptionId")
                .and_then(Value::as_str),
            Some(subscription.subscription_id.as_str())
        );
    }

    #[tokio::test]
    async fn thread_live_unsubscribe_stops_supervised_heartbeat_task() {
        let runtime = test_runtime();
        runtime
            .sync_workspace_snapshot(EmbeddedRuntimeWorkspaceSnapshot {
                id: "workspace-local".to_string(),
                path: resolve_default_workspace_path(),
                display_name: "Workspace".to_string(),
                connected: true,
                default_model_id: Some("gpt-5.4".to_string()),
            })
            .await;
        runtime
            .sync_thread_snapshot(EmbeddedRuntimeThreadSnapshot {
                id: "thread-live-2".to_string(),
                workspace_id: "workspace-local".to_string(),
                title: "Thread live".to_string(),
                unread: false,
                running: false,
                created_at: 1,
                updated_at: 1,
                provider: "openai".to_string(),
                model_id: Some("gpt-5.4".to_string()),
                status: Some("idle".to_string()),
                archived: false,
                last_activity_at: Some(1),
                agent_role: None,
                agent_nickname: None,
            })
            .await;

        let subscription = runtime
            .thread_live_subscribe("workspace-local", "thread-live-2")
            .await
            .expect("thread live subscription should succeed");

        tokio::time::timeout(Duration::from_secs(1), async {
            loop {
                if runtime
                    .app_state
                    .context()
                    .task_supervisor
                    .snapshot()
                    .active_subscription_tasks
                    > 0
                {
                    break;
                }
                tokio::task::yield_now().await;
            }
        })
        .await
        .expect("heartbeat task should register with the supervisor");

        runtime
            .thread_live_unsubscribe(subscription.subscription_id.as_str())
            .await
            .expect("thread live unsubscribe should succeed");

        tokio::time::timeout(Duration::from_secs(1), async {
            loop {
                let active = runtime
                    .app_state
                    .context()
                    .task_supervisor
                    .snapshot()
                    .active_subscription_tasks;
                let heartbeat_tasks = runtime
                    .app_state
                    .context()
                    .thread_live_heartbeat_tasks
                    .lock()
                    .await
                    .len();
                if active == 0 && heartbeat_tasks == 0 {
                    break;
                }
                tokio::task::yield_now().await;
            }
        })
        .await
        .expect("heartbeat task should stop after unsubscribe");
    }

    #[tokio::test]
    async fn apply_context_delta_removes_stale_threads_and_workspaces() {
        let runtime = test_runtime();
        runtime
            .apply_context_snapshot(EmbeddedRuntimeContextSnapshot {
                revision: 1,
                workspaces: vec![
                    EmbeddedRuntimeWorkspaceSnapshot {
                        id: "workspace-a".to_string(),
                        path: resolve_default_workspace_path(),
                        display_name: "Workspace A".to_string(),
                        connected: true,
                        default_model_id: Some("gpt-5.4".to_string()),
                    },
                    EmbeddedRuntimeWorkspaceSnapshot {
                        id: "workspace-b".to_string(),
                        path: resolve_default_workspace_path(),
                        display_name: "Workspace B".to_string(),
                        connected: true,
                        default_model_id: Some("gpt-5.4".to_string()),
                    },
                ],
                threads: vec![
                    EmbeddedRuntimeThreadSnapshot {
                        id: "thread-a".to_string(),
                        workspace_id: "workspace-a".to_string(),
                        title: "Thread A".to_string(),
                        unread: false,
                        running: false,
                        created_at: 1,
                        updated_at: 1,
                        provider: "openai".to_string(),
                        model_id: Some("gpt-5.4".to_string()),
                        status: Some("idle".to_string()),
                        archived: false,
                        last_activity_at: Some(1),
                        agent_role: None,
                        agent_nickname: None,
                    },
                    EmbeddedRuntimeThreadSnapshot {
                        id: "thread-b".to_string(),
                        workspace_id: "workspace-b".to_string(),
                        title: "Thread B".to_string(),
                        unread: false,
                        running: false,
                        created_at: 1,
                        updated_at: 1,
                        provider: "openai".to_string(),
                        model_id: Some("gpt-5.4".to_string()),
                        status: Some("idle".to_string()),
                        archived: false,
                        last_activity_at: Some(1),
                        agent_role: None,
                        agent_nickname: None,
                    },
                ],
            })
            .await;

        runtime
            .apply_context_delta(EmbeddedRuntimeContextDelta {
                base_revision: 1,
                revision: 3,
                changes: vec![
                    EmbeddedRuntimeContextChange::ThreadRemove {
                        workspace_id: "workspace-a".to_string(),
                        thread_id: "thread-a".to_string(),
                    },
                    EmbeddedRuntimeContextChange::WorkspaceRemove {
                        workspace_id: "workspace-b".to_string(),
                    },
                ],
            })
            .await;

        let state = runtime.app_state.context().state.read().await;
        assert!(state.workspaces.iter().any(|workspace| workspace.id == "workspace-a"));
        assert!(!state.workspaces.iter().any(|workspace| workspace.id == "workspace-b"));
        assert_eq!(
            state
                .workspace_threads
                .get("workspace-a")
                .map(Vec::len)
                .unwrap_or_default(),
            0
        );
        assert!(state.workspace_threads.get("workspace-b").is_none());
    }

    #[tokio::test]
    async fn apply_workspace_scope_snapshot_replaces_threads_within_workspace_only() {
        let runtime = test_runtime();
        runtime
            .apply_context_snapshot(EmbeddedRuntimeContextSnapshot {
                revision: 1,
                workspaces: vec![
                    EmbeddedRuntimeWorkspaceSnapshot {
                        id: "workspace-a".to_string(),
                        path: resolve_default_workspace_path(),
                        display_name: "Workspace A".to_string(),
                        connected: true,
                        default_model_id: Some("gpt-5.4".to_string()),
                    },
                    EmbeddedRuntimeWorkspaceSnapshot {
                        id: "workspace-b".to_string(),
                        path: resolve_default_workspace_path(),
                        display_name: "Workspace B".to_string(),
                        connected: true,
                        default_model_id: Some("gpt-5.4".to_string()),
                    },
                ],
                threads: vec![
                    EmbeddedRuntimeThreadSnapshot {
                        id: "thread-a".to_string(),
                        workspace_id: "workspace-a".to_string(),
                        title: "Thread A".to_string(),
                        unread: false,
                        running: false,
                        created_at: 1,
                        updated_at: 1,
                        provider: "openai".to_string(),
                        model_id: Some("gpt-5.4".to_string()),
                        status: Some("idle".to_string()),
                        archived: false,
                        last_activity_at: Some(1),
                        agent_role: None,
                        agent_nickname: None,
                    },
                    EmbeddedRuntimeThreadSnapshot {
                        id: "thread-b".to_string(),
                        workspace_id: "workspace-b".to_string(),
                        title: "Thread B".to_string(),
                        unread: false,
                        running: false,
                        created_at: 1,
                        updated_at: 1,
                        provider: "openai".to_string(),
                        model_id: Some("gpt-5.4".to_string()),
                        status: Some("idle".to_string()),
                        archived: false,
                        last_activity_at: Some(1),
                        agent_role: None,
                        agent_nickname: None,
                    },
                ],
            })
            .await;

        runtime
            .apply_context_scope_snapshot(
                EmbeddedRuntimeContextScope::Workspace {
                    workspace_id: "workspace-a".to_string(),
                },
                EmbeddedRuntimeContextSnapshot {
                    revision: 2,
                    workspaces: vec![EmbeddedRuntimeWorkspaceSnapshot {
                        id: "workspace-a".to_string(),
                        path: resolve_default_workspace_path(),
                        display_name: "Workspace A".to_string(),
                        connected: true,
                        default_model_id: Some("gpt-5.4".to_string()),
                    }],
                    threads: Vec::new(),
                },
            )
            .await;

        let state = runtime.app_state.context().state.read().await;
        assert_eq!(
            state
                .workspace_threads
                .get("workspace-a")
                .map(Vec::len)
                .unwrap_or_default(),
            0
        );
        assert_eq!(
            state
                .workspace_threads
                .get("workspace-b")
                .map(Vec::len)
                .unwrap_or_default(),
            1
        );
    }

    #[tokio::test]
    async fn apply_thread_scope_snapshot_removes_missing_thread_without_touching_siblings() {
        let runtime = test_runtime();
        runtime
            .apply_context_snapshot(EmbeddedRuntimeContextSnapshot {
                revision: 1,
                workspaces: vec![EmbeddedRuntimeWorkspaceSnapshot {
                    id: "workspace-a".to_string(),
                    path: resolve_default_workspace_path(),
                    display_name: "Workspace A".to_string(),
                    connected: true,
                    default_model_id: Some("gpt-5.4".to_string()),
                }],
                threads: vec![
                    EmbeddedRuntimeThreadSnapshot {
                        id: "thread-a".to_string(),
                        workspace_id: "workspace-a".to_string(),
                        title: "Thread A".to_string(),
                        unread: false,
                        running: false,
                        created_at: 1,
                        updated_at: 1,
                        provider: "openai".to_string(),
                        model_id: Some("gpt-5.4".to_string()),
                        status: Some("idle".to_string()),
                        archived: false,
                        last_activity_at: Some(1),
                        agent_role: None,
                        agent_nickname: None,
                    },
                    EmbeddedRuntimeThreadSnapshot {
                        id: "thread-b".to_string(),
                        workspace_id: "workspace-a".to_string(),
                        title: "Thread B".to_string(),
                        unread: false,
                        running: false,
                        created_at: 1,
                        updated_at: 1,
                        provider: "openai".to_string(),
                        model_id: Some("gpt-5.4".to_string()),
                        status: Some("idle".to_string()),
                        archived: false,
                        last_activity_at: Some(1),
                        agent_role: None,
                        agent_nickname: None,
                    },
                ],
            })
            .await;

        runtime
            .apply_context_scope_snapshot(
                EmbeddedRuntimeContextScope::Thread {
                    workspace_id: "workspace-a".to_string(),
                    thread_id: "thread-a".to_string(),
                },
                EmbeddedRuntimeContextSnapshot {
                    revision: 2,
                    workspaces: vec![EmbeddedRuntimeWorkspaceSnapshot {
                        id: "workspace-a".to_string(),
                        path: resolve_default_workspace_path(),
                        display_name: "Workspace A".to_string(),
                        connected: true,
                        default_model_id: Some("gpt-5.4".to_string()),
                    }],
                    threads: Vec::new(),
                },
            )
            .await;

        let state = runtime.app_state.context().state.read().await;
        let threads = state
            .workspace_threads
            .get("workspace-a")
            .expect("workspace threads should exist");
        assert!(!threads.iter().any(|thread| thread.id == "thread-a"));
        assert!(threads.iter().any(|thread| thread.id == "thread-b"));
    }

    #[tokio::test]
    async fn replay_events_after_cursor_returns_only_newer_frames() {
        let runtime = test_runtime();
        let ctx = runtime.app_state.context();

        publish_runtime_updated_event(&ctx, &["skills"], "embedded-runtime-test-1", None);
        publish_runtime_updated_event(&ctx, &["skills"], "embedded-runtime-test-2", None);

        let replay = runtime
            .replay_events_after(Some(1))
            .expect("replay after cursor should succeed");

        assert!(replay.resync_event.is_none());
        assert_eq!(replay.frames.len(), 1);
        assert_eq!(replay.frames[0].event_id, 2);
        assert_eq!(
            replay.frames[0]
                .envelope
                .get("payload")
                .and_then(Value::as_object)
                .and_then(|payload| payload.get("reason"))
                .and_then(Value::as_str),
            Some("embedded-runtime-test-2")
        );
    }

    #[tokio::test]
    async fn replay_events_after_cursor_returns_resync_when_gap_detected() {
        let runtime = test_runtime();
        let ctx = runtime.app_state.context();

        publish_runtime_updated_event(&ctx, &["skills"], "embedded-runtime-gap-bootstrap", None);
        for index in 0..=(TURN_EVENTS_REPLAY_BUFFER + 1) {
            publish_turn_event(
                &ctx,
                TURN_EVENT_APPROVAL_REQUIRED,
                json!({
                    "approvalId": format!("approval-gap-{index}"),
                    "kind": "command",
                }),
                None,
            );
        }
        publish_runtime_updated_event(&ctx, &["skills"], "embedded-runtime-gap-tail", None);

        let replay = runtime
            .replay_events_after(Some(1))
            .expect("replay after stale cursor should succeed");

        assert!(replay.resync_event.is_some());
        assert!(!replay.frames.is_empty());
        assert_eq!(
            replay
                .frames
                .last()
                .and_then(|frame| frame.envelope.get("payload"))
                .and_then(Value::as_object)
                .and_then(|payload| payload.get("reason"))
                .and_then(Value::as_str),
            Some("embedded-runtime-gap-tail")
        );
        assert_eq!(
            replay
                .resync_event
                .as_ref()
                .and_then(|frame| frame.envelope.get("payload"))
                .and_then(Value::as_object)
                .and_then(|payload| payload.get("reason"))
                .and_then(Value::as_str),
            Some(EVENT_STREAM_RESYNC_REASON_REPLAY_GAP)
        );
    }

    #[tokio::test]
    async fn replay_events_after_cursor_replays_latest_state_without_gap_for_state_only_history() {
        let runtime = test_runtime();
        let ctx = runtime.app_state.context();

        for index in 0..=(TURN_EVENTS_REPLAY_BUFFER + 1) {
            publish_runtime_updated_event(
                &ctx,
                &["skills"],
                format!("embedded-runtime-state-only-{index}").as_str(),
                None,
            );
        }

        let replay = runtime
            .replay_events_after(Some(1))
            .expect("replay after stale cursor should succeed");

        let expected_reason = format!(
            "embedded-runtime-state-only-{}",
            TURN_EVENTS_REPLAY_BUFFER + 1
        );
        assert!(replay.resync_event.is_none());
        assert_eq!(replay.frames.len(), 1);
        assert_eq!(
            replay.frames[0]
                .envelope
                .get("payload")
                .and_then(Value::as_object)
                .and_then(|payload| payload.get("reason"))
                .and_then(Value::as_str),
            Some(expected_reason.as_str())
        );
    }
}
