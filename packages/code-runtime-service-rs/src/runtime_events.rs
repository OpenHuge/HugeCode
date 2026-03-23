#[rustfmt::skip]
use std::{collections::VecDeque, convert::Infallible, sync::{atomic::Ordering, Arc}, time::Duration};

use axum::{
    extract::State,
    http::HeaderMap,
    response::sse::{Event, KeepAlive, Sse},
};
use futures_util::StreamExt as FuturesStreamExt;
use serde_json::{json, Value};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use tokio_stream::wrappers::{errors::BroadcastStreamRecvError, BroadcastStream};
use tokio_util::sync::CancellationToken;
use tracing::warn;

use crate::{native_runtime::native_event_method_for_kind, now_ms, AppContext};

pub(crate) const TURN_EVENTS_BUFFER: usize = 256;
pub(crate) const TURN_EVENTS_REPLAY_BUFFER: usize = 1_024;
pub(crate) const TURN_EVENTS_REPLAY_MAX_BYTES: usize = 4 * 1024 * 1024;
#[rustfmt::skip]
const CODE_RUNTIME_SERVICE_TURN_EVENT_REPLAY_MAX_FRAME_BYTES_ENV: &str = "CODE_RUNTIME_SERVICE_TURN_EVENT_REPLAY_MAX_FRAME_BYTES";
const DEFAULT_TURN_EVENT_REPLAY_MAX_FRAME_BYTES: usize = 262_144;
const MIN_TURN_EVENT_REPLAY_MAX_FRAME_BYTES: usize = 4_096;
const MAX_TURN_EVENT_REPLAY_MAX_FRAME_BYTES: usize = 4_194_304;
pub(crate) const TURN_EVENT_STARTED: &str = "turn.started";
pub(crate) const TURN_EVENT_ITEM_STARTED: &str = "item.started";
pub(crate) const TURN_EVENT_ITEM_UPDATED: &str = "item.updated";
pub(crate) const TURN_EVENT_ITEM_COMPLETED: &str = "item.completed";
pub(crate) const TURN_EVENT_ITEM_AGENT_MESSAGE_DELTA: &str = "item.agentMessage.delta";
pub(crate) const TURN_EVENT_ITEM_MCP_TOOL_CALL_PROGRESS: &str = "item.mcpToolCall.progress";
pub(crate) const TURN_EVENT_DELTA: &str = TURN_EVENT_ITEM_AGENT_MESSAGE_DELTA;
pub(crate) const TURN_EVENT_TOOL_CALLING: &str = TURN_EVENT_ITEM_STARTED;
pub(crate) const TURN_EVENT_TOOL_RESULT: &str = TURN_EVENT_ITEM_COMPLETED;
pub(crate) const TURN_EVENT_APPROVAL_REQUIRED: &str = "approval.required";
pub(crate) const TURN_EVENT_APPROVAL_RESOLVED: &str = "approval.resolved";
pub(crate) const TURN_EVENT_COMPLETED: &str = "turn.completed";
pub(crate) const TURN_EVENT_FAILED: &str = "turn.failed";
pub(crate) const TURN_EVENT_THREAD_LIVE_UPDATE: &str = "thread.live_update";
pub(crate) const TURN_EVENT_THREAD_LIVE_HEARTBEAT: &str = "thread.live_heartbeat";
pub(crate) const TURN_EVENT_THREAD_LIVE_DETACHED: &str = "thread.live_detached";
pub(crate) const TURN_EVENT_EXTENSION_UPDATED: &str = "extension.updated";
pub(crate) const TURN_EVENT_SESSION_PORTABILITY_UPDATED: &str = "session.portability.updated";
pub(crate) const TURN_EVENT_SECURITY_PREFLIGHT_BLOCKED: &str = "security.preflight.blocked";
const NATIVE_STATE_FABRIC_UPDATED_EVENT: &str = "native_state_fabric_updated";
const RUNTIME_UPDATED_EVENT: &str = "runtime.updated";
pub(crate) const EVENT_STREAM_RESYNC_REASON_REPLAY_GAP: &str = "event_replay_gap";
pub(crate) const EVENT_STREAM_RESYNC_REASON_LAGGED: &str = "event_stream_lagged";
pub(crate) const EVENT_STREAM_RESYNC_SCOPE: &[&str] = &[
    "bootstrap",
    "workspaces",
    "threads",
    "agents",
    "models",
    "providers",
    "oauth",
    "prompts",
    "plugins",
    "tools",
    "skills",
    "themes",
    "schedules",
    "watchers",
    "insights",
    "server",
    "settings",
    "voice",
    "workflow",
];

#[derive(Clone, Debug)]
pub(crate) struct TurnEventFrame {
    pub(crate) id: u64,
    pub(crate) payload_json: Arc<str>,
}

#[derive(Debug)]
pub(crate) struct TurnEventReplayBuffer {
    pub(crate) frames: VecDeque<TurnEventFrame>,
    pub(crate) total_payload_bytes: usize,
    pub(crate) max_frame_bytes: usize,
}

#[derive(Debug, Clone, Copy)]
pub(crate) struct TurnEventReplayGap {
    pub(crate) requested_last_event_id: u64,
    pub(crate) oldest_available_event_id: u64,
}

#[derive(Debug)]
pub(crate) struct TurnEventReplayResolution {
    pub(crate) frames: Vec<TurnEventFrame>,
    pub(crate) replay_gap: Option<TurnEventReplayGap>,
}

#[rustfmt::skip]
fn is_latest_state_fabric_event_kind(kind: &str) -> bool { matches!(kind, NATIVE_STATE_FABRIC_UPDATED_EVENT | RUNTIME_UPDATED_EVENT) }
#[rustfmt::skip]
fn is_agent_job_scope_method(method: &str) -> bool {
    matches!(method,
        "code_runtime_run_start" | "code_runtime_run_start_v2" | "code_runtime_run_cancel" | "code_runtime_run_resume" | "code_runtime_run_resume_v2" | "code_runtime_run_intervene" | "code_runtime_run_intervene_v2"
        | "code_kernel_job_start_v3" | "code_kernel_job_cancel_v3" | "code_kernel_job_resume_v3" | "code_kernel_job_intervene_v3"
        | "code_runtime_run_subscribe" | "code_runtime_run_subscribe_v2" | "code_kernel_job_get_v3" | "code_kernel_job_subscribe_v3" | "code_kernel_job_callback_register_v3" | "code_kernel_job_callback_remove_v3"
        | "code_sub_agent_spawn" | "code_sub_agent_send" | "code_sub_agent_wait" | "code_sub_agent_status" | "code_sub_agent_interrupt" | "code_sub_agent_close"
        | "code_runtime_run_checkpoint_approval"
    )
}
#[rustfmt::skip]
fn is_extension_scope_method(method: &str) -> bool { matches!(method,
    "code_extension_catalog_list_v2" | "code_extension_get_v2" | "code_extension_install_v2" | "code_extension_update_v2"
    | "code_extension_set_state_v2" | "code_extension_remove_v2" | "code_extension_registry_search_v2"
    | "code_extension_registry_sources_v2" | "code_extension_permissions_evaluate_v2" | "code_extension_health_read_v2"
    | "code_extension_ui_apps_list_v2" | "code_extension_tools_list_v2" | "code_extension_resource_read_v2") }
#[rustfmt::skip]
fn lock_mutex_with_poison_recovery<'a, T>(mutex: &'a std::sync::Mutex<T>, recovered_message: &str) -> std::sync::MutexGuard<'a, T> {
    let mut recovered_from_poison = false;
    let guard = match mutex.lock() {
        Ok(guard) => guard,
        Err(poisoned) => {
            recovered_from_poison = true;
            poisoned.into_inner()
        }
    };
    if recovered_from_poison {
        warn!(recovered_message);
    }
    guard
}

pub(crate) fn latest_runtime_state_fabric_event_frame(ctx: &AppContext) -> Option<TurnEventFrame> {
    let latest_frame = lock_mutex_with_poison_recovery(
        ctx.latest_runtime_state_fabric_event.as_ref(),
        "recovered poisoned latest runtime state fabric event lock",
    );
    latest_frame.clone()
}

fn cache_latest_runtime_state_fabric_event(ctx: &AppContext, frame: &TurnEventFrame) {
    let mut latest_frame = lock_mutex_with_poison_recovery(
        ctx.latest_runtime_state_fabric_event.as_ref(),
        "recovered poisoned latest runtime state fabric event lock",
    );
    *latest_frame = Some(frame.clone());
}

fn enqueue_runtime_state_fabric_fanout_frame(ctx: &AppContext, frame: TurnEventFrame) {
    let mut pending_frame = lock_mutex_with_poison_recovery(
        ctx.runtime_state_fabric_fanout_pending.as_ref(),
        "recovered poisoned runtime state-fabric fanout pending lock",
    );
    if pending_frame.replace(frame).is_some() {
        ctx.runtime_diagnostics
            .record_state_fabric_fanout_coalesced();
    }
    drop(pending_frame);
    ctx.runtime_state_fabric_fanout_notify.notify_one();
}

fn enqueue_thread_live_update_fanout_frame(
    ctx: &AppContext,
    subscription_id: &str,
    frame: TurnEventFrame,
) {
    let mut pending_frames = lock_mutex_with_poison_recovery(
        ctx.thread_live_update_fanout_pending.as_ref(),
        "recovered poisoned thread-live update fanout pending lock",
    );
    if pending_frames
        .insert(subscription_id.to_string(), frame)
        .is_some()
    {
        ctx.runtime_diagnostics
            .record_thread_live_update_fanout_coalesced();
    }
    drop(pending_frames);
    ctx.thread_live_update_fanout_notify.notify_one();
}

pub(crate) fn runtime_state_fabric_fanout_queue_depth(ctx: &AppContext) -> u64 {
    let pending_frame = lock_mutex_with_poison_recovery(
        ctx.runtime_state_fabric_fanout_pending.as_ref(),
        "recovered poisoned runtime state-fabric fanout pending lock",
    );
    u64::from(pending_frame.is_some())
}

pub(crate) fn thread_live_update_fanout_queue_depth(ctx: &AppContext) -> u64 {
    let pending_frames = lock_mutex_with_poison_recovery(
        ctx.thread_live_update_fanout_pending.as_ref(),
        "recovered poisoned thread-live update fanout pending lock",
    );
    pending_frames.len() as u64
}

fn take_runtime_state_fabric_fanout_frame(ctx: &AppContext) -> Option<TurnEventFrame> {
    let mut pending_frame = lock_mutex_with_poison_recovery(
        ctx.runtime_state_fabric_fanout_pending.as_ref(),
        "recovered poisoned runtime state-fabric fanout pending lock",
    );
    pending_frame.take()
}

fn take_thread_live_update_fanout_frames(
    ctx: &AppContext,
) -> std::collections::HashMap<String, TurnEventFrame> {
    let mut pending_frames = lock_mutex_with_poison_recovery(
        ctx.thread_live_update_fanout_pending.as_ref(),
        "recovered poisoned thread-live update fanout pending lock",
    );
    std::mem::take(&mut *pending_frames)
}

pub(crate) fn spawn_runtime_state_fabric_fanout_task(
    ctx: AppContext,
    shutdown: CancellationToken,
) -> tokio::task::JoinHandle<()> {
    ctx.runtime_state_fabric_fanout_active
        .store(true, Ordering::Relaxed);
    tokio::spawn(async move {
        loop {
            tokio::select! {
                _ = shutdown.cancelled() => {
                    drain_runtime_state_fabric_fanout_frames(&ctx);
                    break;
                }
                _ = ctx.runtime_state_fabric_fanout_notify.notified() => {
                    drain_runtime_state_fabric_fanout_frames(&ctx);
                }
            }
        }
        ctx.runtime_state_fabric_fanout_active
            .store(false, Ordering::Relaxed);
    })
}

pub(crate) fn spawn_thread_live_update_fanout_task(
    ctx: AppContext,
    shutdown: CancellationToken,
) -> tokio::task::JoinHandle<()> {
    ctx.thread_live_update_fanout_active
        .store(true, Ordering::Relaxed);
    tokio::spawn(async move {
        loop {
            tokio::select! {
                _ = shutdown.cancelled() => {
                    drain_thread_live_update_fanout_frames(&ctx);
                    break;
                }
                _ = ctx.thread_live_update_fanout_notify.notified() => {
                    drain_thread_live_update_fanout_frames(&ctx);
                }
            }
        }
        ctx.thread_live_update_fanout_active
            .store(false, Ordering::Relaxed);
    })
}

fn drain_runtime_state_fabric_fanout_frames(ctx: &AppContext) {
    loop {
        let Some(frame) = take_runtime_state_fabric_fanout_frame(ctx) else {
            break;
        };
        let _ = ctx.turn_events.send(frame);
    }
}

fn drain_thread_live_update_fanout_frames(ctx: &AppContext) {
    loop {
        let frames = take_thread_live_update_fanout_frames(ctx);
        if frames.is_empty() {
            break;
        }
        for frame in frames.into_values() {
            let _ = ctx.turn_events.send(frame);
        }
    }
}

impl TurnEventReplayBuffer {
    fn resolve_replay_max_frame_bytes() -> usize {
        std::env::var(CODE_RUNTIME_SERVICE_TURN_EVENT_REPLAY_MAX_FRAME_BYTES_ENV)
            .ok()
            .and_then(|value| value.trim().parse::<usize>().ok())
            .map(|value| {
                value.clamp(
                    MIN_TURN_EVENT_REPLAY_MAX_FRAME_BYTES,
                    MAX_TURN_EVENT_REPLAY_MAX_FRAME_BYTES,
                )
            })
            .unwrap_or(DEFAULT_TURN_EVENT_REPLAY_MAX_FRAME_BYTES)
    }

    pub(crate) fn new() -> Self {
        Self {
            frames: VecDeque::new(),
            total_payload_bytes: 0,
            max_frame_bytes: Self::resolve_replay_max_frame_bytes(),
        }
    }

    pub(crate) fn push(&mut self, frame: TurnEventFrame) -> bool {
        if frame.payload_json.len() > self.max_frame_bytes {
            return false;
        }
        self.total_payload_bytes = self
            .total_payload_bytes
            .saturating_add(frame.payload_json.len());
        self.frames.push_back(frame.clone());
        while self.frames.len() > 1
            && (self.frames.len() > TURN_EVENTS_REPLAY_BUFFER
                || self.total_payload_bytes > TURN_EVENTS_REPLAY_MAX_BYTES)
        {
            if let Some(evicted) = self.frames.pop_front() {
                self.total_payload_bytes = self
                    .total_payload_bytes
                    .saturating_sub(evicted.payload_json.len());
            } else {
                break;
            }
        }
        true
    }

    fn collect_since(&self, last_event_id: u64) -> Vec<TurnEventFrame> {
        self.frames
            .iter()
            .filter(|frame| frame.id > last_event_id)
            .cloned()
            .collect()
    }
}

pub(crate) async fn events_handler(
    State(ctx): State<AppContext>,
    headers: HeaderMap,
) -> Sse<impl tokio_stream::Stream<Item = Result<Event, Infallible>>> {
    // Subscribe first to avoid a replay/live race window that can drop events.
    let receiver = ctx.turn_events.subscribe();
    let replay_resolution = resolve_turn_event_replay_frames(&ctx, &headers);
    let replay_events = replay_resolution.frames;
    let replay_high_watermark = replay_events.last().map(|frame| frame.id).unwrap_or(0);
    let replay_gap_event = replay_resolution.replay_gap.and_then(|gap| {
        let envelope = build_runtime_stream_resync_event_envelope(
            current_runtime_update_revision_string(&ctx),
            EVENT_STREAM_RESYNC_REASON_REPLAY_GAP,
            Some(json!({
                "replayGapLastEventId": gap.requested_last_event_id,
                "replayGapOldestEventId": gap.oldest_available_event_id,
            })),
        );
        serialize_turn_event_envelope_sse_event(&envelope)
    });

    let mut replay_items =
        Vec::with_capacity(replay_events.len() + usize::from(replay_gap_event.is_some()));
    if let Some(event) = replay_gap_event {
        replay_items.push(Ok(event));
    }
    replay_items.extend(
        replay_events
            .into_iter()
            .map(|frame| Ok(serialize_turn_event_sse_frame(&frame))),
    );
    let replay_stream = tokio_stream::iter(replay_items);
    let mut emitted_lag_resync_event = false;
    let live_stream = FuturesStreamExt::flat_map(BroadcastStream::new(receiver), move |result| {
        let items: Vec<Result<Event, Infallible>> = match result {
            Ok(frame) => {
                if frame.id <= replay_high_watermark {
                    Vec::new()
                } else {
                    vec![Ok(serialize_turn_event_sse_frame(&frame))]
                }
            }
            Err(BroadcastStreamRecvError::Lagged(skipped)) => {
                ctx.runtime_diagnostics
                    .record_sse_event_stream_lagged(skipped as u64);
                if emitted_lag_resync_event {
                    Vec::new()
                } else {
                    warn!(
                        skipped,
                        "runtime turn event stream lagged; emitting resync signal"
                    );
                    lagged_recovery_sse_events(&ctx, &mut emitted_lag_resync_event, skipped)
                }
            }
        };
        tokio_stream::iter(items)
    });
    let stream = tokio_stream::StreamExt::chain(replay_stream, live_stream);

    Sse::new(stream).keep_alive(KeepAlive::default())
}

fn serialize_turn_event_sse_frame(frame: &TurnEventFrame) -> Event {
    Event::default()
        .id(frame.id.to_string())
        .retry(Duration::from_millis(1_000))
        .data(frame.payload_json.as_ref())
}

fn resolve_turn_event_replay_frames(
    ctx: &AppContext,
    headers: &HeaderMap,
) -> TurnEventReplayResolution {
    let last_event_id = headers
        .get("last-event-id")
        .and_then(|header| header.to_str().ok())
        .and_then(|value| value.trim().parse::<u64>().ok());
    resolve_turn_event_replay_frames_for_last_event_id(ctx, last_event_id)
}

pub(crate) fn resolve_turn_event_replay_frames_for_last_event_id(
    ctx: &AppContext,
    last_event_id: Option<u64>,
) -> TurnEventReplayResolution {
    let should_include_latest_state_frame = last_event_id.is_some();
    let last_event_id = last_event_id.unwrap_or(0);
    let mut recovered_from_poison = false;
    let replay_buffer_guard = match ctx.turn_event_replay_buffer.lock() {
        Ok(guard) => guard,
        Err(poisoned) => {
            recovered_from_poison = true;
            poisoned.into_inner()
        }
    };

    if recovered_from_poison {
        warn!("recovered poisoned runtime turn event replay buffer lock");
    }

    let mut replay_gap = replay_buffer_guard
        .frames
        .front()
        .map(|frame| frame.id)
        .and_then(|oldest_event_id| {
            if last_event_id + 1 < oldest_event_id {
                warn!(
                    last_event_id,
                    oldest_event_id,
                    "requested replay id is outside buffer window; replay will be partial"
                );
                Some(TurnEventReplayGap {
                    requested_last_event_id: last_event_id,
                    oldest_available_event_id: oldest_event_id,
                })
            } else {
                None
            }
        });

    let mut frames = replay_buffer_guard.collect_since(last_event_id);
    drop(replay_buffer_guard);

    let latest_state_frame =
        latest_runtime_state_fabric_event_frame(ctx).filter(|frame| frame.id > last_event_id);

    if replay_gap.is_none()
        && should_include_latest_state_frame
        && frames.is_empty()
        && latest_state_frame
            .as_ref()
            .is_some_and(|frame| frame.id > last_event_id.saturating_add(1))
    {
        let oldest_available_event_id = latest_state_frame
            .as_ref()
            .map(|frame| frame.id)
            .unwrap_or(last_event_id.saturating_add(1));
        replay_gap = Some(TurnEventReplayGap {
            requested_last_event_id: last_event_id,
            oldest_available_event_id,
        });
    }

    if should_include_latest_state_frame {
        if let Some(latest_state_frame) = latest_state_frame {
            let insert_index = frames.partition_point(|frame| frame.id < latest_state_frame.id);
            if frames
                .get(insert_index)
                .map(|frame| frame.id != latest_state_frame.id)
                .unwrap_or(true)
            {
                frames.insert(insert_index, latest_state_frame);
            }
        }
    }

    TurnEventReplayResolution { frames, replay_gap }
}

pub(crate) fn runtime_update_scope_for_method(method: &str) -> Option<&'static [&'static str]> {
    match method {
        "code_workspace_create" | "code_workspace_rename" | "code_workspace_remove" => {
            Some(&["workspaces", "bootstrap"])
        }
        "code_thread_create" | "code_thread_resume" | "code_thread_archive" => {
            Some(&["threads", "bootstrap"])
        }
        "code_thread_live_subscribe" | "code_thread_live_unsubscribe" => Some(&["threads"]),
        "code_turn_send" | "code_turn_interrupt" => Some(&["threads"]),
        candidate if is_agent_job_scope_method(candidate) => Some(&["agents", "threads"]),
        "code_runtime_backend_upsert"
        | "code_runtime_backend_remove"
        | "code_runtime_backend_set_state"
        | "code_acp_integration_upsert"
        | "code_acp_integration_remove"
        | "code_acp_integration_set_state"
        | "code_acp_integration_probe" => Some(&["agents", "bootstrap"]),
        "code_oauth_account_upsert"
        | "code_oauth_account_remove"
        | "code_oauth_primary_account_set"
        | "code_oauth_pool_upsert"
        | "code_oauth_pool_remove"
        | "code_oauth_pool_apply"
        | "code_oauth_pool_members_replace"
        | "code_oauth_rate_limit_report" => Some(&["oauth", "providers", "models", "bootstrap"]),
        "native_providers_snapshot" | "native_providers_connection_probe" => {
            Some(&["providers", "models", "bootstrap"])
        }
        "code_prompt_library_create"
        | "code_prompt_library_update"
        | "code_prompt_library_delete"
        | "code_prompt_library_move" => Some(&["prompts", "bootstrap"]),
        candidate if is_extension_scope_method(candidate) => {
            Some(&["tools", "plugins", "bootstrap"])
        }
        "code_session_export_v1" | "code_session_import_v1" | "code_session_delete_v1" => {
            Some(&["threads", "agents", "bootstrap"])
        }
        "code_security_preflight_v1" => Some(&["tools", "agents"]),
        "native_plugin_install"
        | "native_plugin_uninstall"
        | "native_plugin_update"
        | "native_plugin_set_enabled" => Some(&["plugins"]),
        "native_tool_policy_upsert"
        | "native_tool_set_enabled"
        | "native_tool_secret_upsert"
        | "native_tool_secret_remove" => Some(&["tools"]),
        "native_skill_upsert" | "native_skill_remove" | "native_skill_set_enabled" => {
            Some(&["skills"])
        }
        "native_theme_upsert" | "native_theme_remove" | "native_theme_set_active" => {
            Some(&["themes", "settings"])
        }
        "native_schedule_create"
        | "native_schedule_update"
        | "native_schedule_delete"
        | "native_schedule_run_now"
        | "native_schedule_cancel_run" => Some(&["schedules", "workflow"]),
        "native_watcher_create"
        | "native_watcher_update"
        | "native_watcher_delete"
        | "native_watcher_set_enabled" => Some(&["watchers", "workflow"]),
        "native_server_config_set" => Some(&["server", "settings"]),
        "native_settings_set" => Some(&["settings"]),
        "native_voice_config_set" | "native_voice_hotkey_set" => Some(&["voice", "settings"]),
        "native_review_comment_upsert"
        | "native_review_comment_remove"
        | "native_review_comment_set_resolved" => Some(&["review"]),
        _ => None,
    }
}

pub(crate) async fn publish_thread_live_update_events(
    ctx: &AppContext,
    workspace_id: &str,
    thread_id: &str,
    reason: Option<&str>,
) {
    let workspace_id = workspace_id.trim();
    let thread_id = thread_id.trim();
    if workspace_id.is_empty() || thread_id.is_empty() {
        return;
    }

    let reason = reason
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);

    let subscriptions = {
        let subscriptions = ctx.thread_live_subscriptions.read().await;
        subscriptions
            .values()
            .filter(|entry| entry.workspace_id == workspace_id && entry.thread_id == thread_id)
            .cloned()
            .collect::<Vec<_>>()
    };

    for subscription in subscriptions {
        let mut payload = serde_json::Map::from_iter([
            (
                "workspaceId".to_string(),
                Value::String(subscription.workspace_id.clone()),
            ),
            (
                "threadId".to_string(),
                Value::String(subscription.thread_id.clone()),
            ),
            (
                "subscriptionId".to_string(),
                Value::String(subscription.subscription_id.clone()),
            ),
            ("scopeKind".to_string(), Value::String("thread".to_string())),
            (
                "changeKind".to_string(),
                Value::String("threadLiveStatePatched".to_string()),
            ),
            ("transient".to_string(), Value::Bool(true)),
        ]);
        if let Some(reason) = reason.as_ref() {
            payload.insert("reason".to_string(), Value::String(reason.clone()));
        }
        publish_thread_live_update_event(
            ctx,
            subscription.subscription_id.as_str(),
            Value::Object(payload),
        );
    }
}

pub(crate) fn publish_thread_live_heartbeat_event(
    ctx: &AppContext,
    workspace_id: &str,
    thread_id: &str,
    subscription_id: &str,
    heartbeat_interval_ms: u64,
) {
    let workspace_id = workspace_id.trim();
    let thread_id = thread_id.trim();
    let subscription_id = subscription_id.trim();
    if workspace_id.is_empty() || thread_id.is_empty() || subscription_id.is_empty() {
        return;
    }

    publish_turn_event(
        ctx,
        TURN_EVENT_THREAD_LIVE_HEARTBEAT,
        json!({
            "workspaceId": workspace_id,
            "threadId": thread_id,
            "subscriptionId": subscription_id,
            "scopeKind": "thread",
            "changeKind": "threadLiveHeartbeatObserved",
            "sentAtMs": (OffsetDateTime::now_utc().unix_timestamp() as u64).saturating_mul(1_000),
            "heartbeatIntervalMs": heartbeat_interval_ms,
            "transient": true,
        }),
        None,
    );
}

pub(crate) fn publish_thread_live_detached_event(
    ctx: &AppContext,
    workspace_id: &str,
    thread_id: &str,
    subscription_id: &str,
    reason: Option<&str>,
) {
    let workspace_id = workspace_id.trim();
    let thread_id = thread_id.trim();
    let subscription_id = subscription_id.trim();
    if workspace_id.is_empty() || thread_id.is_empty() || subscription_id.is_empty() {
        return;
    }

    let mut payload = serde_json::Map::from_iter([
        (
            "workspaceId".to_string(),
            Value::String(workspace_id.to_string()),
        ),
        ("threadId".to_string(), Value::String(thread_id.to_string())),
        (
            "subscriptionId".to_string(),
            Value::String(subscription_id.to_string()),
        ),
        ("scopeKind".to_string(), Value::String("thread".to_string())),
        (
            "changeKind".to_string(),
            Value::String("threadLiveDetached".to_string()),
        ),
        ("transient".to_string(), Value::Bool(true)),
    ]);
    if let Some(reason) = reason.map(str::trim).filter(|value| !value.is_empty()) {
        payload.insert("reason".to_string(), Value::String(reason.to_string()));
    }
    publish_turn_event(
        ctx,
        TURN_EVENT_THREAD_LIVE_DETACHED,
        Value::Object(payload),
        None,
    );
}

fn build_runtime_updated_payload(
    revision: String,
    scope: &[&str],
    reason: &str,
    diagnostics: Option<Value>,
) -> Value {
    let mut payload = json!({
        "revision": revision,
        "scope": scope,
        "reason": reason,
    });
    if let (Some(Value::Object(extra_fields)), Value::Object(payload_object)) =
        (diagnostics, &mut payload)
    {
        for (key, value) in extra_fields {
            payload_object.insert(key, value);
        }
    }
    payload
}

fn current_runtime_update_revision_string(ctx: &AppContext) -> String {
    ctx.runtime_update_revision
        .load(Ordering::Relaxed)
        .to_string()
}

pub(crate) fn build_runtime_stream_resync_event_envelope(
    revision: String,
    reason: &str,
    diagnostics: Option<Value>,
) -> Value {
    let payload =
        build_runtime_updated_payload(revision, EVENT_STREAM_RESYNC_SCOPE, reason, diagnostics);
    build_turn_event_envelope(RUNTIME_UPDATED_EVENT, payload, None)
}

pub(crate) fn publish_runtime_updated_event(
    ctx: &AppContext,
    scope: &[&str],
    reason: &str,
    diagnostics: Option<Value>,
) {
    publish_runtime_updated_event_at(ctx, scope, reason, diagnostics, now_ms());
}

pub(crate) fn publish_runtime_updated_event_at(
    ctx: &AppContext,
    scope: &[&str],
    reason: &str,
    diagnostics: Option<Value>,
    event_at_ms: u64,
) {
    ctx.runtime_update_last_event_at_ms
        .store(event_at_ms, Ordering::Relaxed);
    let revision = ctx.runtime_update_revision.fetch_add(1, Ordering::Relaxed) + 1;
    let payload = build_runtime_updated_payload(revision.to_string(), scope, reason, diagnostics);
    publish_turn_event(ctx, RUNTIME_UPDATED_EVENT, payload, None);
}

pub(crate) fn publish_turn_event(
    ctx: &AppContext,
    kind: &str,
    payload: Value,
    request_id: Option<&str>,
) {
    let Some((frame, skip_replay)) = build_turn_event_frame(ctx, kind, payload, request_id) else {
        return;
    };
    if is_latest_state_fabric_event_kind(kind) {
        cache_latest_runtime_state_fabric_event(ctx, &frame);
        if ctx
            .runtime_state_fabric_fanout_active
            .load(Ordering::Relaxed)
        {
            enqueue_runtime_state_fabric_fanout_frame(ctx, frame);
        } else {
            let _ = ctx.turn_events.send(frame);
        }
        return;
    }
    if skip_replay {
        let _ = ctx.turn_events.send(frame);
        return;
    }
    let mut recovered_from_poison = false;
    let mut replay_buffer = match ctx.turn_event_replay_buffer.lock() {
        Ok(guard) => guard,
        Err(poisoned) => {
            recovered_from_poison = true;
            poisoned.into_inner()
        }
    };
    if recovered_from_poison {
        warn!("recovered poisoned runtime turn event replay buffer lock");
    }
    let persisted_for_replay = replay_buffer.push(frame.clone());
    drop(replay_buffer);
    if !persisted_for_replay {
        crate::runtime_tool_safety_counters::record_runtime_tool_safety_counter_best_effort(
            ctx,
            crate::runtime_tool_metrics::RuntimeToolSafetyCounter::StreamGuardrailTripped,
            "increment stream-guardrail-tripped runtime tool metric failed",
        );
    }
    let _ = ctx.turn_events.send(frame);
}

fn publish_thread_live_update_event(ctx: &AppContext, subscription_id: &str, payload: Value) {
    let Some((frame, _skip_replay)) =
        build_turn_event_frame(ctx, TURN_EVENT_THREAD_LIVE_UPDATE, payload, None)
    else {
        return;
    };
    if ctx.thread_live_update_fanout_active.load(Ordering::Relaxed) {
        enqueue_thread_live_update_fanout_frame(ctx, subscription_id, frame);
    } else {
        let _ = ctx.turn_events.send(frame);
    }
}

fn build_turn_event_frame(
    ctx: &AppContext,
    kind: &str,
    payload: Value,
    request_id: Option<&str>,
) -> Option<(TurnEventFrame, bool)> {
    let skip_replay = should_skip_turn_event_replay_payload(&payload);
    if skip_replay && ctx.turn_events.receiver_count() == 0 {
        return None;
    }
    let event = build_turn_event_envelope(kind, payload, request_id);
    let event_id = ctx.turn_event_next_id.fetch_add(1, Ordering::Relaxed) + 1;
    let payload_json = serialize_turn_event_envelope_json(&event)?;
    Some((
        TurnEventFrame {
            id: event_id,
            payload_json,
        },
        skip_replay,
    ))
}

fn should_skip_turn_event_replay_payload(payload: &Value) -> bool {
    payload
        .as_object()
        .and_then(|payload| payload.get("transient"))
        .and_then(Value::as_bool)
        .unwrap_or(false)
}

fn build_turn_event_envelope(kind: &str, payload: Value, request_id: Option<&str>) -> Value {
    let emitted_at = OffsetDateTime::now_utc().format(&Rfc3339).ok();
    let mut event = serde_json::Map::from_iter([
        ("kind".to_string(), Value::String(kind.to_string())),
        ("payload".to_string(), payload),
    ]);
    if let Some(method) = native_event_method_for_kind(kind) {
        event.insert("method".to_string(), Value::String(method.to_string()));
    }
    if let Some(timestamp) = emitted_at {
        event.insert("emittedAt".to_string(), Value::String(timestamp));
    }
    if let Some(request_id) = request_id {
        let trimmed = request_id.trim();
        if !trimmed.is_empty() {
            event.insert("requestId".to_string(), Value::String(trimmed.to_string()));
        }
    }
    Value::Object(event)
}

fn serialize_turn_event_envelope_json(event: &Value) -> Option<Arc<str>> {
    match serde_json::to_string(event) {
        Ok(payload) => Some(Arc::<str>::from(payload)),
        Err(error) => {
            warn!(error = %error, "failed to serialize runtime turn event");
            None
        }
    }
}

fn serialize_turn_event_envelope_sse_event(event: &Value) -> Option<Event> {
    let payload_json = serialize_turn_event_envelope_json(event)?;
    Some(
        Event::default()
            .retry(Duration::from_millis(1_000))
            .data(payload_json.as_ref()),
    )
}

fn next_lagged_resync_event(
    emitted_lag_resync_event: &mut bool,
    revision: String,
    skipped: u64,
) -> Option<Event> {
    if *emitted_lag_resync_event {
        return None;
    }
    *emitted_lag_resync_event = true;
    let envelope = build_runtime_stream_resync_event_envelope(
        revision,
        EVENT_STREAM_RESYNC_REASON_LAGGED,
        Some(json!({
            "streamLaggedDroppedEvents": skipped,
        })),
    );
    serialize_turn_event_envelope_sse_event(&envelope)
}

fn lagged_recovery_sse_events(
    ctx: &AppContext,
    emitted_lag_resync_event: &mut bool,
    skipped: u64,
) -> Vec<Result<Event, Infallible>> {
    let mut events = Vec::new();
    let Some(resync_event) = next_lagged_resync_event(
        emitted_lag_resync_event,
        current_runtime_update_revision_string(ctx),
        skipped,
    ) else {
        return events;
    };
    events.push(Ok(resync_event));
    if let Some(frame) = latest_runtime_state_fabric_event_frame(ctx) {
        events.push(Ok(serialize_turn_event_sse_frame(&frame)));
    }
    events
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        build_app_context, create_initial_state, native_state_store, ServiceConfig,
        ThreadLiveSubscription, DEFAULT_AGENT_MAX_CONCURRENT_TASKS,
        DEFAULT_AGENT_TASK_HISTORY_LIMIT, DEFAULT_ANTHROPIC_ENDPOINT, DEFAULT_ANTHROPIC_VERSION,
        DEFAULT_DISCOVERY_BROWSE_INTERVAL_MS, DEFAULT_DISCOVERY_SERVICE_TYPE,
        DEFAULT_DISCOVERY_STALE_TTL_MS, DEFAULT_GEMINI_ENDPOINT,
        DEFAULT_LIVE_SKILLS_NETWORK_BASE_URL, DEFAULT_LIVE_SKILLS_NETWORK_CACHE_TTL_MS,
        DEFAULT_LIVE_SKILLS_NETWORK_TIMEOUT_MS, DEFAULT_OAUTH_LOOPBACK_CALLBACK_PORT,
        DEFAULT_OPENAI_COMPAT_MODEL_CACHE_TTL_MS, DEFAULT_OPENAI_MAX_RETRIES,
        DEFAULT_OPENAI_RETRY_BASE_MS, DEFAULT_OPENAI_TIMEOUT_MS,
        DEFAULT_RUNTIME_WS_MAX_CONNECTIONS, DEFAULT_RUNTIME_WS_MAX_FRAME_SIZE_BYTES,
        DEFAULT_RUNTIME_WS_MAX_MESSAGE_SIZE_BYTES, DEFAULT_RUNTIME_WS_MAX_WRITE_BUFFER_SIZE_BYTES,
        DEFAULT_RUNTIME_WS_WRITE_BUFFER_SIZE_BYTES, DEFAULT_SANDBOX_NETWORK_ACCESS,
        DEFAULT_THREAD_LIVE_HEARTBEAT_INTERVAL_MS,
    };

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
            oauth_secret_key: None,
            oauth_public_base_url: None,
            oauth_loopback_callback_port: DEFAULT_OAUTH_LOOPBACK_CALLBACK_PORT,
            runtime_auth_token: None,
            agent_max_concurrent_tasks: DEFAULT_AGENT_MAX_CONCURRENT_TASKS,
            agent_task_history_limit: DEFAULT_AGENT_TASK_HISTORY_LIMIT,
            distributed_enabled: false,
            distributed_redis_url: None,
            distributed_lane_count: 1,
            distributed_worker_concurrency: 1,
            distributed_claim_idle_ms: 500,
            discovery_enabled: false,
            discovery_service_type: DEFAULT_DISCOVERY_SERVICE_TYPE.to_string(),
            discovery_browse_interval_ms: DEFAULT_DISCOVERY_BROWSE_INTERVAL_MS,
            discovery_stale_ttl_ms: DEFAULT_DISCOVERY_STALE_TTL_MS,
            runtime_backend_id: "runtime-events-test".to_string(),
            runtime_backend_capabilities: vec!["code".to_string()],
            runtime_port: 8788,
            ws_write_buffer_size_bytes: DEFAULT_RUNTIME_WS_WRITE_BUFFER_SIZE_BYTES,
            ws_max_write_buffer_size_bytes: DEFAULT_RUNTIME_WS_MAX_WRITE_BUFFER_SIZE_BYTES,
            ws_max_frame_size_bytes: DEFAULT_RUNTIME_WS_MAX_FRAME_SIZE_BYTES,
            ws_max_message_size_bytes: DEFAULT_RUNTIME_WS_MAX_MESSAGE_SIZE_BYTES,
            ws_max_connections: DEFAULT_RUNTIME_WS_MAX_CONNECTIONS,
            provider_extensions: Vec::new(),
        }
    }

    fn test_context() -> AppContext {
        build_app_context(
            create_initial_state("gpt-5.4"),
            test_config(),
            Arc::new(native_state_store::NativeStateStore::from_env_or_default()),
        )
    }

    async fn add_thread_live_subscription(
        ctx: &AppContext,
        subscription_id: &str,
        workspace_id: &str,
        thread_id: &str,
    ) {
        let mut subscriptions = ctx.thread_live_subscriptions.write().await;
        subscriptions.insert(
            subscription_id.to_string(),
            ThreadLiveSubscription {
                subscription_id: subscription_id.to_string(),
                workspace_id: workspace_id.to_string(),
                thread_id: thread_id.to_string(),
                heartbeat_interval_ms: DEFAULT_THREAD_LIVE_HEARTBEAT_INTERVAL_MS,
            },
        );
    }

    fn frame_payload(frame: &TurnEventFrame) -> Value {
        serde_json::from_str::<Value>(frame.payload_json.as_ref())
            .expect("event payload")
            .get("payload")
            .cloned()
            .expect("payload object")
    }

    #[test]
    fn next_lagged_resync_event_emits_once_per_stream() {
        let mut emitted_lag_resync_event = false;
        assert!(
            next_lagged_resync_event(&mut emitted_lag_resync_event, "1".to_string(), 9).is_some()
        );
        assert!(emitted_lag_resync_event);
        assert!(
            next_lagged_resync_event(&mut emitted_lag_resync_event, "2".to_string(), 18).is_none()
        );
    }

    #[test]
    fn runtime_state_fabric_events_use_latest_cache_instead_of_generic_replay_buffer() {
        let ctx = test_context();
        publish_runtime_updated_event(&ctx, &["skills"], "runtime-events-test-1", None);
        publish_runtime_updated_event(&ctx, &["skills"], "runtime-events-test-2", None);

        let replay_buffer = ctx
            .turn_event_replay_buffer
            .lock()
            .expect("replay buffer lock");
        assert!(
            replay_buffer.frames.is_empty(),
            "state fabric events should not occupy the generic replay buffer"
        );
        drop(replay_buffer);

        let replay = resolve_turn_event_replay_frames_for_last_event_id(&ctx, Some(1));
        assert_eq!(replay.frames.len(), 1);
        assert_eq!(replay.frames[0].id, 2);
        assert_eq!(
            serde_json::from_str::<Value>(replay.frames[0].payload_json.as_ref())
                .ok()
                .and_then(|event| event.get("payload").cloned())
                .and_then(|payload| payload.get("reason").cloned())
                .and_then(|reason| reason.as_str().map(str::to_string))
                .as_deref(),
            Some("runtime-events-test-2")
        );
    }

    #[tokio::test]
    async fn runtime_state_fabric_fanout_coalesces_pending_burst_to_latest_frame() {
        let ctx = test_context();
        let mut receiver = ctx.turn_events.subscribe();
        ctx.runtime_state_fabric_fanout_active
            .store(true, Ordering::Relaxed);
        let shutdown = CancellationToken::new();

        publish_runtime_updated_event(&ctx, &["skills"], "runtime-events-burst-1", None);
        publish_runtime_updated_event(&ctx, &["skills"], "runtime-events-burst-2", None);
        publish_runtime_updated_event(&ctx, &["skills"], "runtime-events-burst-3", None);

        let handle = spawn_runtime_state_fabric_fanout_task(ctx.clone(), shutdown.clone());
        let frame = tokio::time::timeout(Duration::from_millis(250), receiver.recv())
            .await
            .expect("expected coalesced frame")
            .expect("broadcast frame");
        shutdown.cancel();
        tokio::time::timeout(Duration::from_millis(250), handle)
            .await
            .expect("runtime state-fabric fanout task should exit")
            .expect("runtime state-fabric fanout join");

        let payload = serde_json::from_str::<Value>(frame.payload_json.as_ref())
            .expect("event payload")
            .get("payload")
            .cloned()
            .expect("payload object");
        assert_eq!(
            payload["reason"],
            Value::String("runtime-events-burst-3".to_string())
        );
        assert_eq!(frame.id, 3);
        assert!(
            tokio::time::timeout(Duration::from_millis(50), receiver.recv())
                .await
                .is_err(),
            "expected intermediate state-fabric frames to be coalesced"
        );
    }

    #[tokio::test]
    async fn thread_live_update_fanout_coalesces_pending_burst_to_latest_frame() {
        let ctx = test_context();
        add_thread_live_subscription(&ctx, "sub-1", "ws-1", "thread-1").await;
        let mut receiver = ctx.turn_events.subscribe();
        ctx.thread_live_update_fanout_active
            .store(true, Ordering::Relaxed);
        let shutdown = CancellationToken::new();

        publish_thread_live_update_events(&ctx, "ws-1", "thread-1", Some("thread-live-1")).await;
        publish_thread_live_update_events(&ctx, "ws-1", "thread-1", Some("thread-live-2")).await;
        publish_thread_live_update_events(&ctx, "ws-1", "thread-1", Some("thread-live-3")).await;

        let handle = spawn_thread_live_update_fanout_task(ctx.clone(), shutdown.clone());
        let frame = tokio::time::timeout(Duration::from_millis(250), receiver.recv())
            .await
            .expect("expected coalesced frame")
            .expect("broadcast frame");
        shutdown.cancel();
        tokio::time::timeout(Duration::from_millis(250), handle)
            .await
            .expect("thread-live update fanout task should exit")
            .expect("thread-live update fanout join");

        let payload = frame_payload(&frame);
        assert_eq!(
            payload["subscriptionId"],
            Value::String("sub-1".to_string())
        );
        assert_eq!(
            payload["reason"],
            Value::String("thread-live-3".to_string())
        );
        assert_eq!(frame.id, 3);
        assert!(
            tokio::time::timeout(Duration::from_millis(50), receiver.recv())
                .await
                .is_err(),
            "expected intermediate thread-live frames to be coalesced"
        );
    }

    #[tokio::test]
    async fn thread_live_update_fanout_preserves_latest_frame_per_subscription() {
        let ctx = test_context();
        add_thread_live_subscription(&ctx, "sub-1", "ws-1", "thread-1").await;
        add_thread_live_subscription(&ctx, "sub-2", "ws-1", "thread-1").await;
        let mut receiver = ctx.turn_events.subscribe();
        ctx.thread_live_update_fanout_active
            .store(true, Ordering::Relaxed);
        let shutdown = CancellationToken::new();

        publish_thread_live_update_events(&ctx, "ws-1", "thread-1", Some("thread-live-a")).await;
        publish_thread_live_update_events(&ctx, "ws-1", "thread-1", Some("thread-live-b")).await;
        publish_thread_live_update_events(&ctx, "ws-1", "thread-1", Some("thread-live-c")).await;

        let handle = spawn_thread_live_update_fanout_task(ctx.clone(), shutdown.clone());
        let frame_a = tokio::time::timeout(Duration::from_millis(250), receiver.recv())
            .await
            .expect("expected first coalesced frame")
            .expect("broadcast frame");
        let frame_b = tokio::time::timeout(Duration::from_millis(250), receiver.recv())
            .await
            .expect("expected second coalesced frame")
            .expect("broadcast frame");
        shutdown.cancel();
        tokio::time::timeout(Duration::from_millis(250), handle)
            .await
            .expect("thread-live update fanout task should exit")
            .expect("thread-live update fanout join");

        let mut subscription_ids = vec![
            frame_payload(&frame_a)["subscriptionId"]
                .as_str()
                .expect("subscription id")
                .to_string(),
            frame_payload(&frame_b)["subscriptionId"]
                .as_str()
                .expect("subscription id")
                .to_string(),
        ];
        subscription_ids.sort();
        assert_eq!(
            subscription_ids,
            vec!["sub-1".to_string(), "sub-2".to_string()]
        );
        assert_eq!(
            frame_payload(&frame_a)["reason"],
            Value::String("thread-live-c".to_string())
        );
        assert_eq!(
            frame_payload(&frame_b)["reason"],
            Value::String("thread-live-c".to_string())
        );
        assert!(
            tokio::time::timeout(Duration::from_millis(50), receiver.recv())
                .await
                .is_err(),
            "expected one latest frame per subscription"
        );
    }

    #[tokio::test]
    async fn runtime_state_fabric_fanout_cancellation_flushes_latest_frame_and_clears_active() {
        let ctx = test_context();
        let mut receiver = ctx.turn_events.subscribe();
        let shutdown = CancellationToken::new();
        let handle = spawn_runtime_state_fabric_fanout_task(ctx.clone(), shutdown.clone());

        publish_runtime_updated_event(&ctx, &["skills"], "runtime-events-cancel-1", None);
        publish_runtime_updated_event(&ctx, &["skills"], "runtime-events-cancel-2", None);
        shutdown.cancel();

        let frame = tokio::time::timeout(Duration::from_millis(250), receiver.recv())
            .await
            .expect("expected flushed frame during cancellation")
            .expect("broadcast frame");
        tokio::time::timeout(Duration::from_millis(250), handle)
            .await
            .expect("runtime state-fabric fanout task should exit")
            .expect("runtime state-fabric fanout join");

        assert_eq!(
            frame_payload(&frame)["reason"],
            Value::String("runtime-events-cancel-2".to_string())
        );
        assert!(
            !ctx.runtime_state_fabric_fanout_active
                .load(Ordering::Relaxed),
            "expected runtime state-fabric fanout task to clear active flag on exit"
        );
    }

    #[tokio::test]
    async fn thread_live_update_fanout_cancellation_flushes_latest_frames_and_clears_active() {
        let ctx = test_context();
        add_thread_live_subscription(&ctx, "sub-1", "ws-1", "thread-1").await;
        add_thread_live_subscription(&ctx, "sub-2", "ws-1", "thread-1").await;
        let mut receiver = ctx.turn_events.subscribe();
        let shutdown = CancellationToken::new();
        let handle = spawn_thread_live_update_fanout_task(ctx.clone(), shutdown.clone());

        publish_thread_live_update_events(&ctx, "ws-1", "thread-1", Some("thread-live-x")).await;
        publish_thread_live_update_events(&ctx, "ws-1", "thread-1", Some("thread-live-y")).await;
        shutdown.cancel();

        let frame_a = tokio::time::timeout(Duration::from_millis(250), receiver.recv())
            .await
            .expect("expected first flushed frame during cancellation")
            .expect("broadcast frame");
        let frame_b = tokio::time::timeout(Duration::from_millis(250), receiver.recv())
            .await
            .expect("expected second flushed frame during cancellation")
            .expect("broadcast frame");
        tokio::time::timeout(Duration::from_millis(250), handle)
            .await
            .expect("thread-live update fanout task should exit")
            .expect("thread-live update fanout join");

        let mut subscription_ids = vec![
            frame_payload(&frame_a)["subscriptionId"]
                .as_str()
                .expect("subscription id")
                .to_string(),
            frame_payload(&frame_b)["subscriptionId"]
                .as_str()
                .expect("subscription id")
                .to_string(),
        ];
        subscription_ids.sort();
        assert_eq!(
            subscription_ids,
            vec!["sub-1".to_string(), "sub-2".to_string()]
        );
        assert_eq!(
            frame_payload(&frame_a)["reason"],
            Value::String("thread-live-y".to_string())
        );
        assert_eq!(
            frame_payload(&frame_b)["reason"],
            Value::String("thread-live-y".to_string())
        );
        assert!(
            !ctx.thread_live_update_fanout_active.load(Ordering::Relaxed),
            "expected thread-live update fanout task to clear active flag on exit"
        );
    }
}
