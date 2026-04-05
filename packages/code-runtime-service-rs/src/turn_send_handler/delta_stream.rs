use super::*;

const CODE_RUNTIME_SERVICE_TURN_DELTA_COALESCE_ENABLED_ENV: &str =
    "CODE_RUNTIME_SERVICE_TURN_DELTA_COALESCE_ENABLED";
const CODE_RUNTIME_SERVICE_TURN_DELTA_COALESCE_FLUSH_MS_ENV: &str =
    "CODE_RUNTIME_SERVICE_TURN_DELTA_COALESCE_FLUSH_MS";
const CODE_RUNTIME_SERVICE_TURN_DELTA_COALESCE_MAX_CHARS_ENV: &str =
    "CODE_RUNTIME_SERVICE_TURN_DELTA_COALESCE_MAX_CHARS";
const CODE_RUNTIME_SERVICE_STREAM_DELTA_PIPELINE_MODE_ENV: &str =
    "CODE_RUNTIME_SERVICE_STREAM_DELTA_PIPELINE_MODE";
const CODE_RUNTIME_SERVICE_STREAM_DELTA_QUEUE_CAP_ENV: &str =
    "CODE_RUNTIME_SERVICE_STREAM_DELTA_QUEUE_CAP";
const CODE_RUNTIME_SERVICE_STREAM_DELTA_OVERFLOW_POLICY_ENV: &str =
    "CODE_RUNTIME_SERVICE_STREAM_DELTA_OVERFLOW_POLICY";
const DEFAULT_TURN_DELTA_COALESCE_FLUSH_MS: u64 = 50;
const MIN_TURN_DELTA_COALESCE_FLUSH_MS: u64 = 10;
const MAX_TURN_DELTA_COALESCE_FLUSH_MS: u64 = 1_000;
const DEFAULT_TURN_DELTA_COALESCE_MAX_CHARS: usize = 1_024;
const MIN_TURN_DELTA_COALESCE_MAX_CHARS: usize = 64;
const MAX_TURN_DELTA_COALESCE_MAX_CHARS: usize = 16_384;
const DEFAULT_STREAM_DELTA_QUEUE_CAP: usize = 256;
const MIN_STREAM_DELTA_QUEUE_CAP: usize = 16;
const MAX_STREAM_DELTA_QUEUE_CAP: usize = 4_096;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum StreamDeltaPipelineMode {
    Bounded,
    Inline,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum StreamDeltaOverflowPolicy {
    DropOldest,
    DropNewest,
    Block,
}

#[derive(Clone, Copy, Debug)]
pub(super) struct TurnDeltaCoalescerConfig {
    enabled: bool,
    flush_interval_ms: u64,
    max_chars: usize,
}

impl TurnDeltaCoalescerConfig {
    pub(super) fn from_env() -> Self {
        Self {
            enabled: parse_turn_delta_coalesce_enabled(
                std::env::var(CODE_RUNTIME_SERVICE_TURN_DELTA_COALESCE_ENABLED_ENV)
                    .ok()
                    .as_deref(),
            ),
            flush_interval_ms: parse_turn_delta_coalesce_flush_ms(
                std::env::var(CODE_RUNTIME_SERVICE_TURN_DELTA_COALESCE_FLUSH_MS_ENV)
                    .ok()
                    .as_deref(),
            ),
            max_chars: parse_turn_delta_coalesce_max_chars(
                std::env::var(CODE_RUNTIME_SERVICE_TURN_DELTA_COALESCE_MAX_CHARS_ENV)
                    .ok()
                    .as_deref(),
            ),
        }
    }
}

pub(super) fn parse_turn_delta_coalesce_enabled(value: Option<&str>) -> bool {
    !matches!(
        value
            .map(|entry| entry.trim().to_ascii_lowercase())
            .as_deref(),
        Some("0" | "false" | "no" | "off")
    )
}

pub(super) fn parse_turn_delta_coalesce_flush_ms(value: Option<&str>) -> u64 {
    value
        .and_then(|entry| entry.trim().parse::<u64>().ok())
        .map(|parsed| {
            parsed.clamp(
                MIN_TURN_DELTA_COALESCE_FLUSH_MS,
                MAX_TURN_DELTA_COALESCE_FLUSH_MS,
            )
        })
        .unwrap_or(DEFAULT_TURN_DELTA_COALESCE_FLUSH_MS)
}

pub(super) fn parse_turn_delta_coalesce_max_chars(value: Option<&str>) -> usize {
    value
        .and_then(|entry| entry.trim().parse::<usize>().ok())
        .map(|parsed| {
            parsed.clamp(
                MIN_TURN_DELTA_COALESCE_MAX_CHARS,
                MAX_TURN_DELTA_COALESCE_MAX_CHARS,
            )
        })
        .unwrap_or(DEFAULT_TURN_DELTA_COALESCE_MAX_CHARS)
}

fn parse_stream_delta_pipeline_mode(value: Option<&str>) -> StreamDeltaPipelineMode {
    match value
        .map(|entry| entry.trim().to_ascii_lowercase())
        .as_deref()
    {
        Some("inline") => StreamDeltaPipelineMode::Inline,
        _ => StreamDeltaPipelineMode::Bounded,
    }
}

fn parse_stream_delta_queue_cap(value: Option<&str>) -> usize {
    value
        .and_then(|entry| entry.trim().parse::<usize>().ok())
        .map(|parsed| parsed.clamp(MIN_STREAM_DELTA_QUEUE_CAP, MAX_STREAM_DELTA_QUEUE_CAP))
        .unwrap_or(DEFAULT_STREAM_DELTA_QUEUE_CAP)
}

fn parse_stream_delta_overflow_policy(value: Option<&str>) -> StreamDeltaOverflowPolicy {
    match value
        .map(|entry| entry.trim().to_ascii_lowercase())
        .as_deref()
    {
        Some("drop_newest" | "drop-newest") => StreamDeltaOverflowPolicy::DropNewest,
        Some("block") => StreamDeltaOverflowPolicy::Block,
        _ => StreamDeltaOverflowPolicy::DropOldest,
    }
}

#[derive(Debug)]
struct TurnDeltaChunk {
    delta: String,
    transient: bool,
    coalesced: bool,
    chunk_index: Option<u64>,
    queue_depth: Option<u64>,
    dropped_chunks: Option<u64>,
    emit_lag_ms: Option<u64>,
}

#[derive(Clone, Debug)]
struct TurnDeltaMetadata {
    queue_depth: Option<u64>,
    dropped_chunks: Option<u64>,
    emit_lag_ms: Option<u64>,
}

#[derive(Debug)]
struct TurnDeltaCoalescerState {
    pending: String,
    pending_chars: usize,
    pending_metadata: Option<TurnDeltaMetadata>,
    last_flush_at: Instant,
    next_chunk_index: u64,
    emitted: bool,
}

pub(super) struct TurnDeltaCoalescer {
    ctx: AppContext,
    turn_id: String,
    request_id: Option<String>,
    config: TurnDeltaCoalescerConfig,
    state: Mutex<TurnDeltaCoalescerState>,
}

impl TurnDeltaCoalescer {
    pub(super) fn new(
        ctx: AppContext,
        turn_id: String,
        request_id: Option<String>,
        config: TurnDeltaCoalescerConfig,
    ) -> Self {
        Self {
            ctx,
            turn_id,
            request_id,
            config,
            state: Mutex::new(TurnDeltaCoalescerState {
                pending: String::new(),
                pending_chars: 0,
                pending_metadata: None,
                last_flush_at: Instant::now(),
                next_chunk_index: 0,
                emitted: false,
            }),
        }
    }

    fn ingest(&self, delta: String, metadata: Option<TurnDeltaMetadata>) {
        if delta.is_empty() {
            return;
        }
        let chunk = if self.config.enabled {
            self.ingest_coalesced(delta, metadata)
        } else {
            Some(self.ingest_passthrough(delta, metadata))
        };
        if let Some(chunk) = chunk {
            self.publish_chunk(chunk);
        }
    }

    pub(super) fn flush_final(&self) {
        if !self.config.enabled {
            return;
        }
        let chunk = {
            let mut state = match self.state.lock() {
                Ok(guard) => guard,
                Err(poisoned) => {
                    warn!("recovered poisoned turn delta coalescer lock");
                    poisoned.into_inner()
                }
            };
            Self::drain_coalesced_chunk(&mut state)
        };
        if let Some(chunk) = chunk {
            self.publish_chunk(chunk);
        }
    }

    pub(super) fn streamed_delta_emitted(&self) -> bool {
        let state = match self.state.lock() {
            Ok(guard) => guard,
            Err(poisoned) => {
                warn!("recovered poisoned turn delta coalescer lock");
                poisoned.into_inner()
            }
        };
        state.emitted
    }

    fn ingest_passthrough(
        &self,
        delta: String,
        metadata: Option<TurnDeltaMetadata>,
    ) -> TurnDeltaChunk {
        let mut state = match self.state.lock() {
            Ok(guard) => guard,
            Err(poisoned) => {
                warn!("recovered poisoned turn delta coalescer lock");
                poisoned.into_inner()
            }
        };
        state.emitted = true;
        TurnDeltaChunk {
            delta,
            transient: false,
            coalesced: false,
            chunk_index: None,
            queue_depth: metadata.as_ref().and_then(|entry| entry.queue_depth),
            dropped_chunks: metadata.as_ref().and_then(|entry| entry.dropped_chunks),
            emit_lag_ms: metadata.as_ref().and_then(|entry| entry.emit_lag_ms),
        }
    }

    fn ingest_coalesced(
        &self,
        delta: String,
        metadata: Option<TurnDeltaMetadata>,
    ) -> Option<TurnDeltaChunk> {
        let mut state = match self.state.lock() {
            Ok(guard) => guard,
            Err(poisoned) => {
                warn!("recovered poisoned turn delta coalescer lock");
                poisoned.into_inner()
            }
        };
        state.pending_chars = state.pending_chars.saturating_add(delta.chars().count());
        state.pending.push_str(delta.as_str());
        if metadata.is_some() {
            state.pending_metadata = metadata;
        }

        let due_by_size = state.pending_chars >= self.config.max_chars;
        let due_by_time =
            state.last_flush_at.elapsed() >= Duration::from_millis(self.config.flush_interval_ms);
        if !(due_by_size || due_by_time) {
            return None;
        }
        Self::drain_coalesced_chunk(&mut state)
    }

    fn drain_coalesced_chunk(state: &mut TurnDeltaCoalescerState) -> Option<TurnDeltaChunk> {
        if state.pending.is_empty() {
            return None;
        }
        let delta = std::mem::take(&mut state.pending);
        let metadata = state.pending_metadata.take();
        state.pending_chars = 0;
        state.last_flush_at = Instant::now();
        state.emitted = true;
        let chunk_index = state.next_chunk_index;
        state.next_chunk_index = state.next_chunk_index.saturating_add(1);
        Some(TurnDeltaChunk {
            delta,
            transient: true,
            coalesced: true,
            chunk_index: Some(chunk_index),
            queue_depth: metadata.as_ref().and_then(|entry| entry.queue_depth),
            dropped_chunks: metadata.as_ref().and_then(|entry| entry.dropped_chunks),
            emit_lag_ms: metadata.as_ref().and_then(|entry| entry.emit_lag_ms),
        })
    }

    fn publish_chunk(&self, chunk: TurnDeltaChunk) {
        let mut payload = serde_json::Map::from_iter([
            ("turnId".to_string(), Value::String(self.turn_id.clone())),
            ("delta".to_string(), Value::String(chunk.delta)),
        ]);
        if chunk.transient {
            payload.insert("transient".to_string(), Value::Bool(true));
        }
        if chunk.coalesced {
            payload.insert("coalesced".to_string(), Value::Bool(true));
        }
        if let Some(chunk_index) = chunk.chunk_index {
            payload.insert("chunkIndex".to_string(), Value::Number(chunk_index.into()));
        }
        if let Some(queue_depth) = chunk.queue_depth {
            payload.insert("queueDepth".to_string(), Value::Number(queue_depth.into()));
        }
        if let Some(dropped_chunks) = chunk.dropped_chunks {
            payload.insert(
                "droppedChunks".to_string(),
                Value::Number(dropped_chunks.into()),
            );
        }
        if let Some(emit_lag_ms) = chunk.emit_lag_ms {
            payload.insert("emitLagMs".to_string(), Value::Number(emit_lag_ms.into()));
        }
        publish_turn_event(
            &self.ctx,
            TURN_EVENT_DELTA,
            Value::Object(payload),
            self.request_id.as_deref(),
        );
    }
}

#[derive(Clone, Copy, Debug)]
pub(super) struct TurnDeltaPipelineConfig {
    mode: StreamDeltaPipelineMode,
    queue_cap: usize,
    overflow_policy: StreamDeltaOverflowPolicy,
}

impl TurnDeltaPipelineConfig {
    pub(super) fn from_env() -> Self {
        Self {
            mode: parse_stream_delta_pipeline_mode(
                std::env::var(CODE_RUNTIME_SERVICE_STREAM_DELTA_PIPELINE_MODE_ENV)
                    .ok()
                    .as_deref(),
            ),
            queue_cap: parse_stream_delta_queue_cap(
                std::env::var(CODE_RUNTIME_SERVICE_STREAM_DELTA_QUEUE_CAP_ENV)
                    .ok()
                    .as_deref(),
            ),
            overflow_policy: parse_stream_delta_overflow_policy(
                std::env::var(CODE_RUNTIME_SERVICE_STREAM_DELTA_OVERFLOW_POLICY_ENV)
                    .ok()
                    .as_deref(),
            ),
        }
    }
}

#[derive(Debug)]
struct TurnDeltaPipelineItem {
    delta: String,
    queued_at: Instant,
}

#[derive(Debug)]
struct TurnDeltaPipelineState {
    queue: VecDeque<TurnDeltaPipelineItem>,
    closed: bool,
}

pub(super) struct TurnDeltaPipeline {
    ctx: AppContext,
    coalescer: Arc<TurnDeltaCoalescer>,
    config: TurnDeltaPipelineConfig,
    state: Arc<Mutex<TurnDeltaPipelineState>>,
    notify: Arc<Notify>,
    dropped_chunks: Arc<AtomicU64>,
    worker: Mutex<Option<RuntimeTaskHandle<RuntimeTaskRunResult<()>>>>,
}

impl TurnDeltaPipeline {
    pub(super) fn new(
        ctx: AppContext,
        coalescer: Arc<TurnDeltaCoalescer>,
        config: TurnDeltaPipelineConfig,
    ) -> Self {
        let state = Arc::new(Mutex::new(TurnDeltaPipelineState {
            queue: VecDeque::new(),
            closed: false,
        }));
        let notify = Arc::new(Notify::new());
        let dropped_chunks = Arc::new(AtomicU64::new(0));
        let worker = if config.mode == StreamDeltaPipelineMode::Bounded {
            let state = state.clone();
            let notify = notify.clone();
            let coalescer = coalescer.clone();
            let dropped_chunks = dropped_chunks.clone();
            Some(ctx.task_supervisor.spawn_cancellable(
                RuntimeTaskDomain::Flow,
                format!("turn.delta.pipeline.{}", coalescer.turn_id.as_str()),
                async move {
                    loop {
                        let next = {
                            let mut guard = match state.lock() {
                                Ok(guard) => guard,
                                Err(poisoned) => {
                                    warn!("recovered poisoned turn delta pipeline lock");
                                    poisoned.into_inner()
                                }
                            };
                            if let Some(item) = guard.queue.pop_front() {
                                let queue_depth =
                                    u64::try_from(guard.queue.len()).unwrap_or(u64::MAX);
                                Some((item, queue_depth))
                            } else if guard.closed {
                                return;
                            } else {
                                None
                            }
                        };

                        let Some((item, queue_depth)) = next else {
                            notify.notified().await;
                            continue;
                        };
                        let emit_lag_ms =
                            item.queued_at
                                .elapsed()
                                .as_millis()
                                .min(u128::from(u64::MAX)) as u64;
                        let dropped = dropped_chunks.load(Ordering::Relaxed);
                        coalescer.ingest(
                            item.delta,
                            Some(TurnDeltaMetadata {
                                queue_depth: Some(queue_depth),
                                dropped_chunks: Some(dropped),
                                emit_lag_ms: Some(emit_lag_ms),
                            }),
                        );
                    }
                },
            ))
        } else {
            None
        };

        Self {
            ctx,
            coalescer,
            config,
            state,
            notify,
            dropped_chunks,
            worker: Mutex::new(worker),
        }
    }

    pub(super) fn ingest(&self, delta: String) {
        if delta.is_empty() {
            return;
        }
        if self.config.mode == StreamDeltaPipelineMode::Inline {
            self.coalescer.ingest(delta, None);
            return;
        }

        let item = TurnDeltaPipelineItem {
            delta,
            queued_at: Instant::now(),
        };
        loop {
            let mut guard = match self.state.lock() {
                Ok(guard) => guard,
                Err(poisoned) => {
                    warn!("recovered poisoned turn delta pipeline lock");
                    poisoned.into_inner()
                }
            };
            if guard.closed {
                return;
            }
            if guard.queue.len() < self.config.queue_cap {
                guard.queue.push_back(item);
                drop(guard);
                self.notify.notify_one();
                return;
            }

            match self.config.overflow_policy {
                StreamDeltaOverflowPolicy::DropOldest => {
                    let _ = guard.queue.pop_front();
                    let _ = self.dropped_chunks.fetch_add(1, Ordering::Relaxed) + 1;
                    crate::runtime_tool_safety_counters::record_runtime_tool_safety_counter_best_effort(
                        &self.ctx,
                        runtime_tool_metrics::RuntimeToolSafetyCounter::DeltaQueueDrop,
                        "increment delta-queue-drop runtime tool metric failed",
                    );
                    guard.queue.push_back(item);
                    drop(guard);
                    self.notify.notify_one();
                    return;
                }
                StreamDeltaOverflowPolicy::DropNewest => {
                    let _ = self.dropped_chunks.fetch_add(1, Ordering::Relaxed);
                    crate::runtime_tool_safety_counters::record_runtime_tool_safety_counter_best_effort(
                        &self.ctx,
                        runtime_tool_metrics::RuntimeToolSafetyCounter::DeltaQueueDrop,
                        "increment delta-queue-drop runtime tool metric failed",
                    );
                    return;
                }
                StreamDeltaOverflowPolicy::Block => {
                    drop(guard);
                    std::thread::sleep(Duration::from_millis(1));
                }
            }
        }
    }

    pub(super) async fn flush_final(&self) {
        {
            let mut guard = match self.state.lock() {
                Ok(guard) => guard,
                Err(poisoned) => {
                    warn!("recovered poisoned turn delta pipeline lock");
                    poisoned.into_inner()
                }
            };
            guard.closed = true;
        }
        self.notify.notify_waiters();
        let worker = {
            let mut guard = match self.worker.lock() {
                Ok(guard) => guard,
                Err(poisoned) => {
                    warn!("recovered poisoned turn delta pipeline worker lock");
                    poisoned.into_inner()
                }
            };
            guard.take()
        };
        if let Some(mut worker) = worker {
            let _ = worker.wait_with_timeout_or_abort().await;
        }
        if self.config.mode == StreamDeltaPipelineMode::Bounded {
            let drained = {
                let mut guard = match self.state.lock() {
                    Ok(guard) => guard,
                    Err(poisoned) => {
                        warn!("recovered poisoned turn delta pipeline lock");
                        poisoned.into_inner()
                    }
                };
                guard.queue.drain(..).collect::<Vec<_>>()
            };
            let dropped = self.dropped_chunks.load(Ordering::Relaxed);
            let drained_len = drained.len();
            for (index, item) in drained.into_iter().enumerate() {
                let remaining = drained_len.saturating_sub(index + 1);
                let queue_depth = u64::try_from(remaining).unwrap_or(u64::MAX);
                let emit_lag_ms = item
                    .queued_at
                    .elapsed()
                    .as_millis()
                    .min(u128::from(u64::MAX)) as u64;
                self.coalescer.ingest(
                    item.delta,
                    Some(TurnDeltaMetadata {
                        queue_depth: Some(queue_depth),
                        dropped_chunks: Some(dropped),
                        emit_lag_ms: Some(emit_lag_ms),
                    }),
                );
            }
        }
        self.coalescer.flush_final();
    }

    pub(super) fn streamed_delta_emitted(&self) -> bool {
        self.coalescer.streamed_delta_emitted()
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;
    use std::time::Instant;

    use super::*;
    use crate::{
        build_app_context, create_initial_state, native_state_store, AppContext, ServiceConfig,
        DEFAULT_AGENT_MAX_CONCURRENT_TASKS, DEFAULT_AGENT_TASK_HISTORY_LIMIT,
        DEFAULT_ANTHROPIC_ENDPOINT, DEFAULT_ANTHROPIC_VERSION,
        DEFAULT_DISCOVERY_BROWSE_INTERVAL_MS, DEFAULT_DISCOVERY_SERVICE_TYPE,
        DEFAULT_DISCOVERY_STALE_TTL_MS, DEFAULT_GEMINI_ENDPOINT,
        DEFAULT_LIVE_SKILLS_NETWORK_BASE_URL, DEFAULT_LIVE_SKILLS_NETWORK_CACHE_TTL_MS,
        DEFAULT_LIVE_SKILLS_NETWORK_TIMEOUT_MS, DEFAULT_OAUTH_LOOPBACK_CALLBACK_PORT,
        DEFAULT_OPENAI_COMPAT_MODEL_CACHE_TTL_MS, DEFAULT_OPENAI_MAX_RETRIES,
        DEFAULT_OPENAI_RETRY_BASE_MS, DEFAULT_OPENAI_TIMEOUT_MS,
        DEFAULT_RUNTIME_WS_MAX_CONNECTIONS, DEFAULT_RUNTIME_WS_MAX_FRAME_SIZE_BYTES,
        DEFAULT_RUNTIME_WS_MAX_MESSAGE_SIZE_BYTES, DEFAULT_RUNTIME_WS_MAX_WRITE_BUFFER_SIZE_BYTES,
        DEFAULT_RUNTIME_WS_WRITE_BUFFER_SIZE_BYTES, DEFAULT_SANDBOX_NETWORK_ACCESS,
        TURN_EVENT_DELTA,
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
            runtime_backend_id: "turn-delta-test".to_string(),
            runtime_backend_capabilities: vec!["code".to_string()],
            runtime_port: 8788,
            ws_write_buffer_size_bytes: DEFAULT_RUNTIME_WS_WRITE_BUFFER_SIZE_BYTES,
            ws_max_write_buffer_size_bytes: DEFAULT_RUNTIME_WS_MAX_WRITE_BUFFER_SIZE_BYTES,
            ws_max_frame_size_bytes: DEFAULT_RUNTIME_WS_MAX_FRAME_SIZE_BYTES,
            ws_max_message_size_bytes: DEFAULT_RUNTIME_WS_MAX_MESSAGE_SIZE_BYTES,
            ws_max_connections: DEFAULT_RUNTIME_WS_MAX_CONNECTIONS,
            provider_extension_seeds: Vec::new(),
        }
    }

    fn test_context() -> AppContext {
        build_app_context(
            create_initial_state("gpt-5.4"),
            test_config(),
            Arc::new(native_state_store::NativeStateStore::from_env_or_default()),
        )
    }

    #[test]
    fn parse_turn_delta_coalesce_enabled_defaults_to_true() {
        assert!(parse_turn_delta_coalesce_enabled(None));
        assert!(parse_turn_delta_coalesce_enabled(Some("true")));
        assert!(!parse_turn_delta_coalesce_enabled(Some("false")));
        assert!(!parse_turn_delta_coalesce_enabled(Some("0")));
    }

    #[test]
    fn parse_turn_delta_coalesce_flush_ms_clamps_values() {
        assert_eq!(
            parse_turn_delta_coalesce_flush_ms(None),
            DEFAULT_TURN_DELTA_COALESCE_FLUSH_MS
        );
        assert_eq!(
            parse_turn_delta_coalesce_flush_ms(Some("0")),
            MIN_TURN_DELTA_COALESCE_FLUSH_MS
        );
        assert_eq!(
            parse_turn_delta_coalesce_flush_ms(Some("999999")),
            MAX_TURN_DELTA_COALESCE_FLUSH_MS
        );
    }

    #[test]
    fn parse_turn_delta_coalesce_max_chars_clamps_values() {
        assert_eq!(
            parse_turn_delta_coalesce_max_chars(None),
            DEFAULT_TURN_DELTA_COALESCE_MAX_CHARS
        );
        assert_eq!(
            parse_turn_delta_coalesce_max_chars(Some("1")),
            MIN_TURN_DELTA_COALESCE_MAX_CHARS
        );
        assert_eq!(
            parse_turn_delta_coalesce_max_chars(Some("999999")),
            MAX_TURN_DELTA_COALESCE_MAX_CHARS
        );
    }

    #[test]
    fn drain_coalesced_chunk_marks_payload_as_transient_and_coalesced() {
        let mut state = TurnDeltaCoalescerState {
            pending: "hello".to_string(),
            pending_chars: 5,
            pending_metadata: None,
            last_flush_at: Instant::now(),
            next_chunk_index: 3,
            emitted: false,
        };
        let chunk = TurnDeltaCoalescer::drain_coalesced_chunk(&mut state)
            .expect("expected coalesced chunk");
        assert_eq!(chunk.delta, "hello");
        assert!(chunk.transient);
        assert!(chunk.coalesced);
        assert_eq!(chunk.chunk_index, Some(3));
        assert_eq!(state.pending, "");
        assert_eq!(state.pending_chars, 0);
        assert!(state.emitted);
        assert_eq!(state.next_chunk_index, 4);
    }

    #[tokio::test]
    async fn bounded_turn_delta_pipeline_flush_final_stops_worker_and_emits_delta() {
        let ctx = test_context();
        let mut receiver = ctx.turn_events.subscribe();
        let pipeline = TurnDeltaPipeline::new(
            ctx.clone(),
            Arc::new(TurnDeltaCoalescer::new(
                ctx.clone(),
                "turn-delta-test".to_string(),
                None,
                TurnDeltaCoalescerConfig {
                    enabled: false,
                    flush_interval_ms: DEFAULT_TURN_DELTA_COALESCE_FLUSH_MS,
                    max_chars: DEFAULT_TURN_DELTA_COALESCE_MAX_CHARS,
                },
            )),
            TurnDeltaPipelineConfig {
                mode: StreamDeltaPipelineMode::Bounded,
                queue_cap: 16,
                overflow_policy: StreamDeltaOverflowPolicy::DropOldest,
            },
        );

        pipeline.ingest("hello".to_string());
        pipeline.flush_final().await;

        let frame = tokio::time::timeout(std::time::Duration::from_secs(1), async {
            loop {
                let frame = receiver.recv().await.expect("turn event frame");
                let envelope =
                    serde_json::from_str::<serde_json::Value>(frame.payload_json.as_ref())
                        .expect("turn event payload");
                if envelope.get("kind").and_then(serde_json::Value::as_str)
                    == Some(TURN_EVENT_DELTA)
                {
                    break envelope;
                }
            }
        })
        .await
        .expect("delta event should be emitted");

        assert_eq!(frame["payload"]["delta"].as_str(), Some("hello"),);
        assert_eq!(ctx.task_supervisor.snapshot().active_flow_tasks, 0);
    }
}
