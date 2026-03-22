use super::*;
use crate::runtime_tool_metrics::RuntimeToolExecutionTotals;

const DISTRIBUTED_READINESS_SNAPSHOT_CACHE_TTL: Duration = Duration::from_millis(500);
const RUNTIME_BACKEND_REGISTRY_SYNC_TTL_MS: u64 = 1_000;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(super) enum RuntimeBackendRegistrySyncOutcome {
    Performed,
    Skipped,
}

pub(super) async fn set_distributed_dispatch_error(
    ctx: &AppContext,
    source: &str,
    message: impl Into<String>,
) {
    let normalized_source = normalize_distributed_dispatch_error_source(source);
    let mut guard = ctx.distributed_dispatch_errors.write().await;
    guard.insert(
        normalized_source.to_string(),
        normalize_distributed_dispatch_error_message(message.into()),
    );
}

pub(super) async fn clear_distributed_dispatch_error(ctx: &AppContext, source: &str) {
    let normalized_source = normalize_distributed_dispatch_error_source(source);
    let mut guard = ctx.distributed_dispatch_errors.write().await;
    guard.remove(normalized_source);
}

async fn summarize_distributed_dispatch_errors(ctx: &AppContext) -> Option<String> {
    let guard = ctx.distributed_dispatch_errors.read().await;
    if guard.is_empty() {
        return None;
    }
    let mut errors = guard
        .iter()
        .map(|(source, message)| format!("{source}: {message}"))
        .collect::<Vec<_>>();
    errors.sort_unstable();
    Some(truncate_chars_with_ellipsis(
        errors.join(" | ").as_str(),
        MAX_DISTRIBUTED_DISPATCH_SUMMARY_CHARS,
    ))
}

pub(super) fn normalize_distributed_dispatch_error_message(message: String) -> String {
    let mut sanitized = String::with_capacity(message.len());
    let mut last_was_space = false;
    for ch in message.chars() {
        if ch.is_control() && !matches!(ch, '\n' | '\r' | '\t') {
            continue;
        }
        if ch.is_whitespace() {
            if !last_was_space {
                sanitized.push(' ');
                last_was_space = true;
            }
            continue;
        }
        sanitized.push(ch);
        last_was_space = false;
    }
    let sanitized = sanitized.trim().to_string();
    let message = if sanitized.is_empty() {
        "unknown distributed dispatch error".to_string()
    } else {
        sanitized
    };
    truncate_chars_with_ellipsis(message.as_str(), MAX_DISTRIBUTED_DISPATCH_ERROR_CHARS)
}

pub(super) fn normalize_distributed_dispatch_error_source(source: &str) -> &str {
    match source {
        DISTRIBUTED_ERROR_SOURCE_BOOTSTRAP
        | DISTRIBUTED_ERROR_SOURCE_STATE_SYNC
        | DISTRIBUTED_ERROR_SOURCE_BACKEND_REGISTRY
        | DISTRIBUTED_ERROR_SOURCE_WORKER
        | DISTRIBUTED_ERROR_SOURCE_DISCOVERY
        | DISTRIBUTED_ERROR_SOURCE_ENQUEUE => source,
        _ => DISTRIBUTED_ERROR_SOURCE_UNKNOWN,
    }
}

pub(super) fn truncate_chars_with_ellipsis(value: &str, max_chars: usize) -> String {
    if max_chars == 0 {
        return String::new();
    }
    if max_chars == 1 {
        return "…".to_string();
    }
    if value.chars().count() <= max_chars {
        return value.to_string();
    }
    let mut normalized = String::with_capacity(max_chars);
    for ch in value.chars().take(max_chars - 1) {
        normalized.push(ch);
    }
    normalized.push('…');
    normalized
}

pub(super) fn resolve_cached_distributed_readiness_snapshot(
    cached: Option<&CachedDistributedReadinessSnapshot>,
    now: Instant,
) -> Option<distributed::diagnostics::DistributedReadinessSnapshot> {
    let cached = cached?;
    if now.saturating_duration_since(cached.fetched_at) <= DISTRIBUTED_READINESS_SNAPSHOT_CACHE_TTL
    {
        return Some(cached.snapshot.clone());
    }
    None
}

async fn build_runtime_updated_distributed_readiness_snapshot(
    ctx: &AppContext,
) -> distributed::diagnostics::DistributedReadinessSnapshot {
    let now = Instant::now();
    if let Some(cached) = {
        let cache = ctx.distributed_readiness_snapshot_cache.read().await;
        resolve_cached_distributed_readiness_snapshot(cache.as_ref(), now)
    } {
        return cached;
    }

    let snapshot = build_distributed_readiness_snapshot(ctx).await;
    let mut cache = ctx.distributed_readiness_snapshot_cache.write().await;
    *cache = Some(CachedDistributedReadinessSnapshot {
        snapshot: snapshot.clone(),
        fetched_at: Instant::now(),
    });
    snapshot
}

pub(super) async fn build_cached_distributed_readiness_snapshot(
    ctx: &AppContext,
) -> distributed::diagnostics::DistributedReadinessSnapshot {
    build_runtime_updated_distributed_readiness_snapshot(ctx).await
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub(super) struct RuntimeTaskCounters {
    pub(super) total: u64,
    pub(super) queued: u64,
    pub(super) running: u64,
    pub(super) awaiting_approval: u64,
    pub(super) terminal: u64,
}

pub(super) fn collect_runtime_task_counters(store: &AgentTaskStore) -> RuntimeTaskCounters {
    let mut counters = RuntimeTaskCounters {
        total: store.tasks.len() as u64,
        ..RuntimeTaskCounters::default()
    };
    for task in store.tasks.values() {
        let status = task.summary.status.as_str();
        match status {
            "queued" => counters.queued += 1,
            "running" => counters.running += 1,
            "awaiting_approval" => counters.awaiting_approval += 1,
            _ if is_agent_task_terminal_status(status) => counters.terminal += 1,
            _ => {}
        }
    }
    counters
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum RuntimeTaskCounterMode {
    Compute,
    Provided(RuntimeTaskCounters),
    Skip,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum RuntimeObservabilityScope {
    Full,
    LiveUpdate,
}

fn runtime_task_counter_mode_label(mode: RuntimeTaskCounterMode) -> &'static str {
    match mode {
        RuntimeTaskCounterMode::Compute => "compute",
        RuntimeTaskCounterMode::Provided(_) => "provided",
        RuntimeTaskCounterMode::Skip => "skip",
    }
}

fn runtime_observability_scope_label(scope: RuntimeObservabilityScope) -> &'static str {
    match scope {
        RuntimeObservabilityScope::Full => "full",
        RuntimeObservabilityScope::LiveUpdate => "live_update",
    }
}

async fn collect_compat_model_catalog_failure_cache_entries(ctx: &AppContext) -> u64 {
    let failure_entries = {
        let failures = ctx.compat_model_catalog_failure_cache.read().await;
        failures.len()
    };
    if failure_entries == 0 {
        return 0;
    }

    let mut failures = ctx.compat_model_catalog_failure_cache.write().await;
    prune_compat_model_catalog_failure_cache(
        &mut failures,
        Instant::now(),
        compat_model_error_cooldown(),
        MAX_OPENAI_COMPAT_MODEL_CACHE_ENTRIES,
    );
    failures.len() as u64
}

#[derive(Debug)]
pub(super) struct RuntimeObservabilitySnapshot {
    pub(super) runtime_diagnostics: RuntimeDiagnosticsSnapshot,
    pub(super) distributed: distributed::diagnostics::DistributedReadinessSnapshot,
    pub(super) runtime_tool_totals: RuntimeToolExecutionTotals,
    pub(super) lifecycle_observability: LifecycleSweeperObservabilityState,
    pub(super) lifecycle_lease_leader: Option<String>,
    pub(super) discovery_managed_backends: u64,
    pub(super) sandbox_exec_total: u64,
    pub(super) sandbox_exec_fail_total: u64,
    pub(super) discovery_upsert_total: u64,
    pub(super) discovery_stale_remove_total: u64,
}

pub(super) async fn build_runtime_observability_snapshot(
    ctx: &AppContext,
    scope: RuntimeObservabilityScope,
    task_counter_mode: RuntimeTaskCounterMode,
) -> RuntimeObservabilitySnapshot {
    let source_revision = ctx.runtime_update_revision.load(Ordering::Relaxed);
    let full_scope = matches!(scope, RuntimeObservabilityScope::Full);
    let task_counters = if full_scope {
        Some(match task_counter_mode {
            RuntimeTaskCounterMode::Compute => {
                if let Some(cached) = crate::read_runtime_task_counters_cache(ctx, source_revision)
                {
                    ctx.runtime_diagnostics
                        .record_runtime_task_counter_cache_hit();
                    cached
                } else {
                    ctx.runtime_diagnostics
                        .record_runtime_task_counter_cache_miss();
                    ctx.runtime_diagnostics
                        .record_runtime_task_counter_full_scan_fallback();
                    let store = ctx.agent_tasks.read().await;
                    let computed = collect_runtime_task_counters(&store);
                    crate::store_runtime_task_counters_cache(ctx, source_revision, computed);
                    computed
                }
            }
            RuntimeTaskCounterMode::Provided(counters) => counters,
            RuntimeTaskCounterMode::Skip => RuntimeTaskCounters::default(),
        })
    } else {
        None
    };
    let distributed = build_cached_distributed_readiness_snapshot(ctx).await;
    let mut runtime_diagnostics = ctx.runtime_diagnostics.snapshot();
    runtime_diagnostics.observability.scope = runtime_observability_scope_label(scope).to_string();
    runtime_diagnostics.observability.task_counter_mode =
        runtime_task_counter_mode_label(task_counter_mode).to_string();
    let last_runtime_update_event_at_ms =
        ctx.runtime_update_last_event_at_ms.load(Ordering::Relaxed);
    runtime_diagnostics.observability.snapshot_age_ms = if last_runtime_update_event_at_ms == 0 {
        0
    } else {
        now_ms().saturating_sub(last_runtime_update_event_at_ms)
    };
    runtime_diagnostics.observability.source_revision = source_revision;
    runtime_diagnostics.observability.queue_depth = distributed.pending_entries;
    runtime_diagnostics
        .observability
        .state_fabric_fanout_queue_depth =
        crate::runtime_events::runtime_state_fabric_fanout_queue_depth(ctx);
    runtime_diagnostics
        .observability
        .thread_live_update_fanout_queue_depth =
        crate::runtime_events::thread_live_update_fanout_queue_depth(ctx);
    let task_supervisor = ctx.task_supervisor.snapshot();
    runtime_diagnostics.observability.active_runtime_tasks = task_supervisor.active_runtime_tasks;
    runtime_diagnostics.observability.active_subscription_tasks =
        task_supervisor.active_subscription_tasks;
    runtime_diagnostics.observability.active_flow_tasks = task_supervisor.active_flow_tasks;
    runtime_diagnostics
        .observability
        .graceful_shutdown_completed_total = task_supervisor.graceful_shutdown_completed_total;
    runtime_diagnostics.observability.forced_abort_total = task_supervisor.forced_abort_total;
    runtime_diagnostics
        .observability
        .shutdown_wait_timed_out_total = task_supervisor.shutdown_wait_timed_out_total;
    runtime_diagnostics.observability.last_shutdown_wait_ms = task_supervisor.last_shutdown_wait_ms;
    if matches!(scope, RuntimeObservabilityScope::Full) {
        let agent_execution_config = ctx.config.views().agent_execution();
        runtime_diagnostics.agent_execution_slots_available =
            ctx.agent_task_execution_slots.available_permits() as u64;
        runtime_diagnostics.agent_execution_slots_max =
            agent_execution_config.agent_max_concurrent_tasks as u64;
        runtime_diagnostics.ws_connection_slots_available =
            ctx.ws_connection_slots.available_permits() as u64;
        runtime_diagnostics.ws_connection_slots_max =
            resolve_ws_max_connections(&ctx.config) as u64;

        let task_counters = task_counters.unwrap_or_default();
        runtime_diagnostics.agent_tasks_total = task_counters.total;
        runtime_diagnostics.agent_tasks_queued = task_counters.queued;
        runtime_diagnostics.agent_tasks_running = task_counters.running;
        runtime_diagnostics.agent_tasks_awaiting_approval = task_counters.awaiting_approval;
        runtime_diagnostics.agent_tasks_terminal = task_counters.terminal;

        runtime_diagnostics.agent_workspace_locks_total = {
            let locks = ctx.agent_workspace_locks.read().await;
            locks.len() as u64
        };
        runtime_diagnostics.compat_model_catalog_cache_entries = {
            let cache = ctx.compat_model_catalog_cache.read().await;
            cache.len() as u64
        };
        runtime_diagnostics.compat_model_catalog_failure_cache_entries =
            collect_compat_model_catalog_failure_cache_entries(ctx).await;
        runtime_diagnostics.compat_model_catalog_refresh_locks_total = {
            let locks = ctx.compat_model_catalog_refresh_locks.read().await;
            locks.len() as u64
        };
        runtime_diagnostics.live_skill_network_cache_entries = {
            let cache = ctx.live_skill_network_cache.read().await;
            cache.len() as u64
        };
    }

    let discovery_managed_backends = ctx.discovery_managed_backends.read().await.len() as u64;
    let sandbox_exec_total = ctx.live_skill_execution_counters.sandbox_exec_total();
    let sandbox_exec_fail_total = ctx.live_skill_execution_counters.sandbox_exec_fail_total();
    let discovery_upsert_total = ctx.discovery_upsert_total.load(Ordering::Relaxed);
    let discovery_stale_remove_total = ctx.discovery_stale_remove_total.load(Ordering::Relaxed);
    let runtime_tool_totals = {
        let metrics = ctx.runtime_tool_metrics.lock().await;
        metrics.read_snapshot().totals
    };
    let lifecycle_observability = {
        let observability = ctx.lifecycle_sweeper_observability.read().await;
        observability.clone()
    };
    let lifecycle_lease_leader = {
        let leader = ctx.lifecycle_sweeper_lease_leader.read().await;
        leader.clone()
    };

    RuntimeObservabilitySnapshot {
        runtime_diagnostics,
        distributed,
        runtime_tool_totals,
        lifecycle_observability,
        lifecycle_lease_leader,
        discovery_managed_backends,
        sandbox_exec_total,
        sandbox_exec_fail_total,
        discovery_upsert_total,
        discovery_stale_remove_total,
    }
}

pub(super) async fn invalidate_cached_distributed_readiness_snapshot(ctx: &AppContext) {
    let mut cache = ctx.distributed_readiness_snapshot_cache.write().await;
    *cache = None;
}

pub(super) async fn build_distributed_readiness_snapshot(
    ctx: &AppContext,
) -> distributed::diagnostics::DistributedReadinessSnapshot {
    let (backends_total, backends_healthy, backends_draining) = {
        let backends = ctx.runtime_backends.read().await;
        let mut healthy = 0u64;
        let mut draining = 0u64;
        for backend in backends.values() {
            if backend.healthy {
                healthy += 1;
            }
            if backend.status == "draining" {
                draining += 1;
            }
        }
        (backends.len() as u64, healthy, draining)
    };
    let placement_failures_total = ctx
        .runtime_diagnostics
        .snapshot()
        .agent_backend_placement_failures_total;

    if !ctx.distributed_config.enabled {
        return distributed::diagnostics::DistributedReadinessSnapshot {
            enabled: false,
            redis_connected: true,
            lane_count: 0,
            worker_count: 0,
            backends_total,
            backends_healthy,
            backends_draining,
            placement_failures_total,
            pending_entries: 0,
            invalid_command_entries: 0,
            oldest_pending_ms: None,
            last_dispatch_error: None,
        };
    }

    let redis_connected = match ctx.distributed_redis_client.as_ref() {
        Some(client) => matches!(
            tokio::time::timeout(
                Duration::from_millis(300),
                distributed::queue::ping(client.as_ref()),
            )
            .await,
            Ok(Ok(()))
        ),
        None => false,
    };
    let (local_pending_entries, local_oldest_pending_ms) = {
        let store = ctx.agent_tasks.read().await;
        compute_pending_task_metrics(
            store
                .tasks
                .values()
                .map(|runtime| (runtime.summary.status.as_str(), runtime.summary.created_at)),
            now_ms(),
        )
    };
    let (pending_entries, oldest_pending_ms) = if redis_connected {
        match ctx.distributed_redis_client.as_ref() {
            Some(client) => match distributed::queue::read_all_lanes_pending_metrics(
                client.as_ref(),
                ctx.distributed_config.lane_count,
            )
            .await
            {
                Ok(redis_metrics) => (
                    local_pending_entries.max(redis_metrics.pending_entries),
                    match (local_oldest_pending_ms, redis_metrics.oldest_pending_ms) {
                        (Some(left), Some(right)) => Some(left.max(right)),
                        (Some(left), None) => Some(left),
                        (None, Some(right)) => Some(right),
                        (None, None) => None,
                    },
                ),
                Err(error) => {
                    warn!(
                        error = error.as_str(),
                        "failed to collect distributed redis pending metrics for readiness"
                    );
                    (local_pending_entries, local_oldest_pending_ms)
                }
            },
            None => (local_pending_entries, local_oldest_pending_ms),
        }
    } else {
        (local_pending_entries, local_oldest_pending_ms)
    };
    let invalid_command_entries = if redis_connected {
        match ctx.distributed_redis_client.as_ref() {
            Some(client) => match distributed::queue::read_all_lanes_invalid_command_entries(
                client.as_ref(),
                ctx.distributed_config.lane_count,
            )
            .await
            {
                Ok(total) => total,
                Err(error) => {
                    warn!(
                        error = error.as_str(),
                        "failed to collect distributed invalid command metrics for readiness"
                    );
                    0
                }
            },
            None => 0,
        }
    } else {
        0
    };
    let last_dispatch_error = summarize_distributed_dispatch_errors(ctx).await;
    distributed::diagnostics::DistributedReadinessSnapshot {
        enabled: true,
        redis_connected,
        lane_count: ctx.distributed_config.lane_count as u64,
        worker_count: ctx.distributed_config.worker_concurrency as u64,
        backends_total,
        backends_healthy,
        backends_draining,
        placement_failures_total,
        pending_entries,
        invalid_command_entries,
        oldest_pending_ms,
        last_dispatch_error,
    }
}

pub(super) async fn build_runtime_updated_diagnostics_payload(
    ctx: &AppContext,
    access_mode: Option<&str>,
    routed_provider: Option<&str>,
    execution_mode: Option<&str>,
    reason: Option<&str>,
) -> Value {
    let observability = build_runtime_observability_snapshot(
        ctx,
        RuntimeObservabilityScope::LiveUpdate,
        RuntimeTaskCounterMode::Skip,
    )
    .await;
    let distributed = observability.distributed.clone();
    let runtime_snapshot = observability.runtime_diagnostics;
    let discovery_managed_backends = observability.discovery_managed_backends;
    let sandbox_exec_total = observability.sandbox_exec_total;
    let sandbox_exec_fail_total = observability.sandbox_exec_fail_total;
    let discovery_upsert_total = observability.discovery_upsert_total;
    let discovery_stale_remove_total = observability.discovery_stale_remove_total;
    let runtime_tool_totals = observability.runtime_tool_totals;
    let lifecycle_observability = observability.lifecycle_observability;
    let lifecycle_lease_leader = observability.lifecycle_lease_leader;
    let mut diagnostics = serde_json::Map::from_iter([
        (
            "observability".to_string(),
            json!(&runtime_snapshot.observability),
        ),
        (
            "backendsTotal".to_string(),
            Value::Number(distributed.backends_total.into()),
        ),
        (
            "backendsHealthy".to_string(),
            Value::Number(distributed.backends_healthy.into()),
        ),
        (
            "backendsDraining".to_string(),
            Value::Number(distributed.backends_draining.into()),
        ),
        (
            "placementFailuresTotal".to_string(),
            Value::Number(distributed.placement_failures_total.into()),
        ),
        (
            "backendRegistrySyncPerformedTotal".to_string(),
            Value::Number(
                runtime_snapshot
                    .backend_registry_sync_performed_total
                    .into(),
            ),
        ),
        (
            "backendRegistrySyncSkippedTotal".to_string(),
            Value::Number(runtime_snapshot.backend_registry_sync_skipped_total.into()),
        ),
        (
            "backendRegistrySyncFailedTotal".to_string(),
            Value::Number(runtime_snapshot.backend_registry_sync_failed_total.into()),
        ),
        (
            "queueDepth".to_string(),
            Value::Number(distributed.pending_entries.into()),
        ),
        (
            "toolInspectorAllowTotal".to_string(),
            Value::Number(runtime_snapshot.tool_inspector_allow_total.into()),
        ),
        (
            "toolInspectorRequireApprovalTotal".to_string(),
            Value::Number(
                runtime_snapshot
                    .tool_inspector_require_approval_total
                    .into(),
            ),
        ),
        (
            "toolInspectorDenyTotal".to_string(),
            Value::Number(runtime_snapshot.tool_inspector_deny_total.into()),
        ),
        (
            "contextCompressionTriggerTotal".to_string(),
            Value::Number(runtime_snapshot.context_compression_trigger_total.into()),
        ),
        (
            "contextCompressionPayloadBytesTotal".to_string(),
            Value::Number(
                runtime_snapshot
                    .context_compression_payload_bytes_total
                    .into(),
            ),
        ),
        (
            "contextCompressionTriggerPayloadSourceTotal".to_string(),
            Value::Number(
                runtime_snapshot
                    .context_compression_trigger_payload_source_total
                    .into(),
            ),
        ),
        (
            "contextCompressionTriggerFailureStreakSourceTotal".to_string(),
            Value::Number(
                runtime_snapshot
                    .context_compression_trigger_failure_streak_source_total
                    .into(),
            ),
        ),
        (
            "contextCompressionTriggerSessionLengthSourceTotal".to_string(),
            Value::Number(
                runtime_snapshot
                    .context_compression_trigger_session_length_source_total
                    .into(),
            ),
        ),
        (
            "agentSessionConcurrencyLimitHitsTotal".to_string(),
            Value::Number(
                runtime_snapshot
                    .agent_session_concurrency_limit_hits_total
                    .into(),
            ),
        ),
        (
            "agentRecoveryAttemptsTotal".to_string(),
            Value::Number(runtime_snapshot.agent_recovery_attempts_total.into()),
        ),
        (
            "agentRecoverySuccessTotal".to_string(),
            Value::Number(runtime_snapshot.agent_recovery_success_total.into()),
        ),
        (
            "agentRecoveryFailedTotal".to_string(),
            Value::Number(runtime_snapshot.agent_recovery_failed_total.into()),
        ),
        (
            "agentRecoveryLatencyMsTotal".to_string(),
            Value::Number(runtime_snapshot.agent_recovery_latency_ms_total.into()),
        ),
        (
            "agentRecoveryLatencyMsMax".to_string(),
            Value::Number(runtime_snapshot.agent_recovery_latency_ms_max.into()),
        ),
        (
            "agentRecoveryLatencyP95ApproxMs".to_string(),
            Value::Number(runtime_snapshot.agent_recovery_latency_p95_approx_ms.into()),
        ),
        (
            "agentRecoverySla20sViolationTotal".to_string(),
            Value::Number(
                runtime_snapshot
                    .agent_recovery_sla_20s_violation_total
                    .into(),
            ),
        ),
        (
            "agentRecoverySla20sBreached".to_string(),
            Value::Bool(runtime_snapshot.agent_recovery_sla_20s_breached),
        ),
        (
            "agentRecoverySla20sReasonCode".to_string(),
            Value::String(runtime_snapshot.agent_recovery_sla_20s_reason_code.clone()),
        ),
        (
            "sandboxEnabled".to_string(),
            Value::Bool(ctx.config.sandbox_enabled),
        ),
        (
            "sandboxExecTotal".to_string(),
            Value::Number(sandbox_exec_total.into()),
        ),
        (
            "sandboxExecFailTotal".to_string(),
            Value::Number(sandbox_exec_fail_total.into()),
        ),
        (
            "discoveryEnabled".to_string(),
            Value::Bool(ctx.config.discovery_enabled),
        ),
        (
            "discoveryManagedBackends".to_string(),
            Value::Number(discovery_managed_backends.into()),
        ),
        (
            "discoveryUpsertTotal".to_string(),
            Value::Number(discovery_upsert_total.into()),
        ),
        (
            "discoveryStaleRemoveTotal".to_string(),
            Value::Number(discovery_stale_remove_total.into()),
        ),
        (
            "staleWriteRejectedTaskSummaryTotal".to_string(),
            Value::Number(
                runtime_snapshot
                    .stale_write_rejected_task_summary_total
                    .into(),
            ),
        ),
        (
            "staleWriteRejectedTaskCheckpointTotal".to_string(),
            Value::Number(
                runtime_snapshot
                    .stale_write_rejected_task_checkpoint_total
                    .into(),
            ),
        ),
        (
            "staleWriteRejectedSubAgentCheckpointTotal".to_string(),
            Value::Number(
                runtime_snapshot
                    .stale_write_rejected_sub_agent_checkpoint_total
                    .into(),
            ),
        ),
        (
            "staleWriteRejectedToolLifecycleCheckpointTotal".to_string(),
            Value::Number(
                runtime_snapshot
                    .stale_write_rejected_tool_lifecycle_checkpoint_total
                    .into(),
            ),
        ),
    ]);
    if ctx.config.discovery_enabled {
        diagnostics.insert(
            "discoveryServiceType".to_string(),
            Value::String(ctx.config.discovery_service_type.clone()),
        );
    }
    if !runtime_snapshot
        .agent_session_concurrency_limit_workspace_hits
        .is_empty()
    {
        diagnostics.insert(
            "agentSessionConcurrencyLimitWorkspaceHits".to_string(),
            serde_json::to_value(
                runtime_snapshot
                    .agent_session_concurrency_limit_workspace_hits
                    .clone(),
            )
            .unwrap_or_else(|_| json!({})),
        );
    }
    if let Value::Object(durability_metrics) =
        build_agent_task_durability_diagnostics_payload(ctx.agent_task_durability.as_ref())
    {
        for (key, value) in durability_metrics {
            diagnostics.insert(key, value);
        }
    }
    if let Some(access_mode) = access_mode.map(str::trim).filter(|value| !value.is_empty()) {
        diagnostics.insert(
            "accessMode".to_string(),
            Value::String(access_mode.to_string()),
        );
    }
    if let Some(routed_provider) = routed_provider
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        diagnostics.insert(
            "routedProvider".to_string(),
            Value::String(routed_provider.to_string()),
        );
    }
    if let Some(execution_mode) = execution_mode
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        diagnostics.insert(
            "executionMode".to_string(),
            Value::String(execution_mode.to_string()),
        );
    }
    if let Some(reason) = reason.map(str::trim).filter(|value| !value.is_empty()) {
        diagnostics.insert("reason".to_string(), Value::String(reason.to_string()));
    }
    let mut payload = serde_json::Map::from_iter([
        (
            "diagnostics".to_string(),
            Value::Object(diagnostics.clone()),
        ),
        (
            "backendsTotal".to_string(),
            Value::Number(distributed.backends_total.into()),
        ),
        (
            "backendsHealthy".to_string(),
            Value::Number(distributed.backends_healthy.into()),
        ),
        (
            "backendsDraining".to_string(),
            Value::Number(distributed.backends_draining.into()),
        ),
        (
            "placementFailuresTotal".to_string(),
            Value::Number(distributed.placement_failures_total.into()),
        ),
        (
            "queueDepth".to_string(),
            Value::Number(distributed.pending_entries.into()),
        ),
    ]);
    if let Some(access_mode) = diagnostics.get("accessMode") {
        payload.insert("accessMode".to_string(), access_mode.clone());
    }
    if let Some(observability) = diagnostics.get("observability") {
        payload.insert("observability".to_string(), observability.clone());
    }
    if let Some(routed_provider) = diagnostics.get("routedProvider") {
        payload.insert("routedProvider".to_string(), routed_provider.clone());
    }
    if let Some(execution_mode) = diagnostics.get("executionMode") {
        payload.insert("executionMode".to_string(), execution_mode.clone());
    }
    if let Some(details_reason) = diagnostics.get("reason") {
        payload.insert("diagnosticReason".to_string(), details_reason.clone());
    }
    payload.insert(
        "lifecycleSweeperMode".to_string(),
        Value::String(ctx.lifecycle_sweeper_mode.clone()),
    );
    if let Some(lease_leader) = lifecycle_lease_leader {
        payload.insert(
            "lifecycleLeaseLeader".to_string(),
            Value::String(lease_leader),
        );
    }
    payload.insert(
        "lifecycleLeaseState".to_string(),
        Value::String(lifecycle_observability.lease_state.clone()),
    );
    if let Some(last_sweep_at) = lifecycle_observability.last_sweep_at {
        payload.insert(
            "lifecycleLastSweepAt".to_string(),
            Value::Number(last_sweep_at.into()),
        );
    }
    if let Some(last_lease_renew_at) = lifecycle_observability.last_lease_renew_at {
        payload.insert(
            "lifecycleLastLeaseRenewAt".to_string(),
            Value::Number(last_lease_renew_at.into()),
        );
    }
    if let Some(last_lease_error_code) = lifecycle_observability.last_lease_error_code {
        payload.insert(
            "lifecycleLastLeaseErrorCode".to_string(),
            Value::String(last_lease_error_code),
        );
    }
    payload.insert(
        "deltaQueueDropTotal".to_string(),
        Value::Number(runtime_tool_totals.delta_queue_drop_total.into()),
    );
    payload.insert(
        "terminalizationCasNoopTotal".to_string(),
        Value::Number(runtime_tool_totals.terminalization_cas_noop_total.into()),
    );
    payload.insert(
        "staleWriteRejectedTotal".to_string(),
        Value::Number(runtime_tool_totals.stale_write_rejected_total.into()),
    );
    payload.insert(
        "streamGuardrailTrippedTotal".to_string(),
        Value::Number(runtime_tool_totals.stream_guardrail_tripped_total.into()),
    );
    Value::Object(payload)
}

pub(super) async fn prepare_runtime_updated_diagnostics_payload_for_emit(
    ctx: &AppContext,
    access_mode: Option<&str>,
    routed_provider: Option<&str>,
    execution_mode: Option<&str>,
    reason: Option<&str>,
) -> (u64, Value) {
    let event_at_ms = now_ms();
    ctx.runtime_update_last_event_at_ms
        .store(event_at_ms, Ordering::Relaxed);
    let payload = build_runtime_updated_diagnostics_payload(
        ctx,
        access_mode,
        routed_provider,
        execution_mode,
        reason,
    )
    .await;
    (event_at_ms, payload)
}

pub(super) async fn persist_distributed_task_summary(
    ctx: &AppContext,
    summary: &AgentTaskSummary,
) -> Result<(), String> {
    if !ctx.distributed_config.enabled {
        return Ok(());
    }
    let Some(client) = ctx.distributed_redis_client.as_ref() else {
        return Err("Distributed redis client is unavailable.".to_string());
    };
    let summary_value = serde_json::to_value(summary)
        .map_err(|error| format!("Serialize distributed task summary: {error}"))?;
    let persist_result = distributed::state_store::persist_task_summary(
        client.as_ref(),
        summary.workspace_id.as_str(),
        summary.task_id.as_str(),
        summary.updated_at,
        &summary_value,
    )
    .await?;
    if matches!(
        persist_result,
        distributed::state_store::PersistWriteResult::StaleWriteRejected
    ) {
        ctx.runtime_diagnostics
            .record_stale_write_rejected_task_summary();
        let _ = crate::runtime_tool_safety_counters::record_runtime_tool_safety_counter(
            ctx,
            runtime_tool_metrics::RuntimeToolSafetyCounter::StaleWriteRejected,
            "increment stale-write-rejected runtime tool metric failed",
        )
        .await;
        warn!(
            task_id = summary.task_id.as_str(),
            "distributed stale task summary write rejected by CAS"
        );
    }
    Ok(())
}

pub(super) async fn hydrate_runtime_backends_from_distributed_store(
    ctx: &AppContext,
) -> Result<(), String> {
    if !ctx.distributed_config.enabled {
        return Ok(());
    }
    let Some(client) = ctx.distributed_redis_client.as_ref() else {
        return Ok(());
    };
    let backends = distributed::backend_registry::list_backends(client.as_ref()).await?;
    let mut store = ctx.runtime_backends.write().await;
    store.clear();
    for mut backend in backends {
        backend.policy = Some(normalize_runtime_backend_policy_profile(
            backend.policy.take(),
        ));
        store.insert(backend.backend_id.clone(), backend);
    }
    drop(store);
    sync_projected_backends(ctx).await;
    Ok(())
}

async fn sync_runtime_backends_from_distributed_store_with_ttl(
    ctx: &AppContext,
) -> Result<RuntimeBackendRegistrySyncOutcome, String> {
    if !ctx.distributed_config.enabled || ctx.distributed_redis_client.is_none() {
        return Ok(RuntimeBackendRegistrySyncOutcome::Skipped);
    }
    let now = now_ms();
    let last_hydrated_ms = ctx
        .runtime_backends_sync_last_hydrated_ms
        .load(Ordering::Relaxed);
    if now.saturating_sub(last_hydrated_ms) <= RUNTIME_BACKEND_REGISTRY_SYNC_TTL_MS {
        return Ok(RuntimeBackendRegistrySyncOutcome::Skipped);
    }

    let _sync_guard = ctx.runtime_backends_sync_lock.lock().await;
    let now_after_lock = now_ms();
    let last_hydrated_ms = ctx
        .runtime_backends_sync_last_hydrated_ms
        .load(Ordering::Relaxed);
    if now_after_lock.saturating_sub(last_hydrated_ms) <= RUNTIME_BACKEND_REGISTRY_SYNC_TTL_MS {
        return Ok(RuntimeBackendRegistrySyncOutcome::Skipped);
    }

    hydrate_runtime_backends_from_distributed_store(ctx).await?;
    ctx.runtime_backends_sync_last_hydrated_ms
        .store(now_ms(), Ordering::Relaxed);
    Ok(RuntimeBackendRegistrySyncOutcome::Performed)
}

pub(super) async fn sync_runtime_backends_from_distributed_store(
    ctx: &AppContext,
) -> Result<RuntimeBackendRegistrySyncOutcome, String> {
    match sync_runtime_backends_from_distributed_store_with_ttl(ctx).await {
        Ok(outcome) => {
            match outcome {
                RuntimeBackendRegistrySyncOutcome::Performed => ctx
                    .runtime_diagnostics
                    .record_backend_registry_sync_performed(),
                RuntimeBackendRegistrySyncOutcome::Skipped => ctx
                    .runtime_diagnostics
                    .record_backend_registry_sync_skipped(),
            }
            clear_distributed_dispatch_error(ctx, DISTRIBUTED_ERROR_SOURCE_BACKEND_REGISTRY).await;
            Ok(outcome)
        }
        Err(error) => {
            ctx.runtime_diagnostics
                .record_backend_registry_sync_failed();
            set_distributed_dispatch_error(
                ctx,
                DISTRIBUTED_ERROR_SOURCE_BACKEND_REGISTRY,
                error.clone(),
            )
            .await;
            Err(error)
        }
    }
}

pub(super) async fn persist_distributed_runtime_backend_summary(
    ctx: &AppContext,
    summary: &RuntimeBackendSummary,
) -> Result<(), String> {
    if !ctx.distributed_config.enabled {
        return Ok(());
    }
    let Some(client) = ctx.distributed_redis_client.as_ref() else {
        return Ok(());
    };
    distributed::backend_registry::upsert_backend(client.as_ref(), summary).await
}

pub(super) async fn remove_distributed_runtime_backend(
    ctx: &AppContext,
    backend_id: &str,
) -> Result<bool, String> {
    if !ctx.distributed_config.enabled {
        return Ok(false);
    }
    let Some(client) = ctx.distributed_redis_client.as_ref() else {
        return Ok(false);
    };
    distributed::backend_registry::remove_backend(client.as_ref(), backend_id).await
}

pub(super) async fn enqueue_distributed_agent_command(
    ctx: &AppContext,
    command: distributed::queue::DistributedCommandEnvelope,
) -> Result<(), RpcError> {
    if !ctx.distributed_config.enabled {
        return Ok(());
    }
    let enqueue_mode = distributed_enqueue_mode_for_kind(command.kind.as_str());
    let Some(client) = ctx.distributed_redis_client.as_ref() else {
        let message = "Distributed runtime is enabled but redis client is unavailable.".to_string();
        set_distributed_dispatch_error(ctx, DISTRIBUTED_ERROR_SOURCE_ENQUEUE, message.clone())
            .await;
        return match enqueue_mode {
            DistributedCommandEnqueueMode::Strict => Err(RpcError::internal(message)),
            DistributedCommandEnqueueMode::BestEffort => {
                warn!(
                    command_kind = command.kind.as_str(),
                    "best-effort distributed command enqueue skipped due to missing redis client"
                );
                Ok(())
            }
        };
    };
    match distributed::queue::enqueue_command(client.as_ref(), &command).await {
        Ok(_) => {
            clear_distributed_dispatch_error(ctx, DISTRIBUTED_ERROR_SOURCE_ENQUEUE).await;
            Ok(())
        }
        Err(error) => {
            set_distributed_dispatch_error(ctx, DISTRIBUTED_ERROR_SOURCE_ENQUEUE, error.clone())
                .await;
            match enqueue_mode {
                DistributedCommandEnqueueMode::Strict => Err(RpcError::internal(format!(
                    "Distributed command enqueue failed: {error}"
                ))),
                DistributedCommandEnqueueMode::BestEffort => {
                    warn!(
                        command_kind = command.kind.as_str(),
                        error = error.as_str(),
                        "best-effort distributed command enqueue failed"
                    );
                    Ok(())
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn distributed_runtime_test_config() -> ServiceConfig {
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
            distributed_lane_count: DEFAULT_DISTRIBUTED_LANE_COUNT,
            distributed_worker_concurrency: DEFAULT_DISTRIBUTED_WORKER_CONCURRENCY,
            distributed_claim_idle_ms: DEFAULT_DISTRIBUTED_CLAIM_IDLE_MS,
            discovery_enabled: false,
            discovery_service_type: DEFAULT_DISCOVERY_SERVICE_TYPE.to_string(),
            discovery_browse_interval_ms: DEFAULT_DISCOVERY_BROWSE_INTERVAL_MS,
            discovery_stale_ttl_ms: DEFAULT_DISCOVERY_STALE_TTL_MS,
            runtime_backend_id: "distributed-runtime-test".to_string(),
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

    fn distributed_runtime_test_context() -> AppContext {
        build_app_context(
            create_initial_state("gpt-5.4"),
            distributed_runtime_test_config(),
            Arc::new(native_state_store::NativeStateStore::from_env_or_default()),
        )
    }

    fn distributed_runtime_test_task(task_id: &str, status: &str) -> AgentTaskRuntime {
        let now = now_ms();
        AgentTaskRuntime {
            summary: AgentTaskSummary {
                task_id: task_id.to_string(),
                workspace_id: "workspace-a".to_string(),
                thread_id: None,
                request_id: None,
                title: None,
                task_source: None,
                validation_preset_id: None,
                status: status.to_string(),
                access_mode: "workspace-write".to_string(),
                execution_profile_id: None,
                review_profile_id: None,
                agent_profile: "code".to_string(),
                provider: None,
                model_id: None,
                reason_effort: None,
                routed_provider: None,
                routed_model_id: None,
                routed_pool: None,
                routed_source: None,
                current_step: Some(1),
                created_at: now,
                updated_at: now,
                started_at: Some(now),
                completed_at: None,
                error_code: None,
                error_message: None,
                pending_approval_id: None,
                pending_approval: None,
                review_decision: None,
                mission_brief: None,
                relaunch_context: None,
                auto_drive: None,
                backend_id: None,
                acp_integration_id: None,
                acp_session_id: None,
                acp_config_options: None,
                acp_available_commands: None,
                preferred_backend_ids: None,
                placement_fallback_reason_code: None,
                resume_backend_id: None,
                placement_score_breakdown: None,
                root_task_id: None,
                parent_task_id: None,
                child_task_ids: None,
                distributed_status: None,
                steps: Vec::new(),
            },
            steps_input: Vec::new(),
            interrupt_requested: false,
            checkpoint_id: None,
            review_actionability: None,
            execution_graph: None,
            takeover_bundle: None,
            recovered: false,
            last_tool_signature: None,
            consecutive_tool_signature_count: 0,
            interrupt_waiter: Arc::new(Notify::new()),
            approval_waiter: Arc::new(Notify::new()),
        }
    }

    async fn add_distributed_runtime_test_thread_live_subscription(
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

    #[tokio::test]
    async fn runtime_observability_snapshot_prunes_stale_compat_failure_entries() {
        let ctx = distributed_runtime_test_context();
        let key = CompatModelCatalogCacheKey {
            base_url: "https://compat.example.com".to_string(),
            api_key_fingerprint: 42,
        };
        {
            let mut failures = ctx.compat_model_catalog_failure_cache.write().await;
            failures.insert(
                key,
                CachedCompatModelCatalogFailure {
                    error: "boom".to_string(),
                    failed_at: Instant::now()
                        - compat_model_error_cooldown()
                        - Duration::from_millis(1),
                },
            );
        }

        let snapshot = build_runtime_observability_snapshot(
            &ctx,
            RuntimeObservabilityScope::Full,
            RuntimeTaskCounterMode::Compute,
        )
        .await;

        assert_eq!(
            snapshot
                .runtime_diagnostics
                .compat_model_catalog_failure_cache_entries,
            0
        );
        let failures = ctx.compat_model_catalog_failure_cache.read().await;
        assert!(failures.is_empty());
    }

    #[tokio::test]
    async fn runtime_observability_snapshot_skip_leaves_task_counters_unpopulated() {
        let ctx = distributed_runtime_test_context();
        {
            let mut store = ctx.agent_tasks.write().await;
            store.tasks.clear();
            store.order.clear();
            store.tasks.insert(
                "task-1".to_string(),
                distributed_runtime_test_task("task-1", "running"),
            );
            store.order.push_back("task-1".to_string());
        }

        let snapshot = build_runtime_observability_snapshot(
            &ctx,
            RuntimeObservabilityScope::LiveUpdate,
            RuntimeTaskCounterMode::Skip,
        )
        .await;

        assert_eq!(snapshot.runtime_diagnostics.agent_tasks_total, 0);
        assert_eq!(snapshot.runtime_diagnostics.agent_tasks_running, 0);
        assert_eq!(snapshot.runtime_diagnostics.agent_workspace_locks_total, 0);
        assert_eq!(
            snapshot.runtime_diagnostics.observability.scope,
            "live_update"
        );
        assert_eq!(
            snapshot.runtime_diagnostics.observability.task_counter_mode,
            "skip"
        );
        assert_eq!(
            snapshot.runtime_diagnostics.observability.snapshot_age_ms,
            0
        );
        assert_eq!(
            snapshot
                .runtime_diagnostics
                .compat_model_catalog_cache_entries,
            0
        );
    }

    #[tokio::test]
    async fn runtime_observability_snapshot_reports_scope_and_cache_accounting() {
        let ctx = distributed_runtime_test_context();
        {
            let mut store = ctx.agent_tasks.write().await;
            store.tasks.clear();
            store.order.clear();
            store.tasks.insert(
                "task-1".to_string(),
                distributed_runtime_test_task("task-1", "running"),
            );
            store.order.push_back("task-1".to_string());
        }

        let first = build_runtime_observability_snapshot(
            &ctx,
            RuntimeObservabilityScope::Full,
            RuntimeTaskCounterMode::Compute,
        )
        .await;
        assert_eq!(first.runtime_diagnostics.observability.scope, "full");
        assert_eq!(
            first.runtime_diagnostics.observability.task_counter_mode,
            "compute"
        );
        assert_eq!(first.runtime_diagnostics.observability.queue_depth, 0);
        assert_eq!(
            first
                .runtime_diagnostics
                .observability
                .task_counter_cache_hit_total,
            0
        );
        assert_eq!(
            first
                .runtime_diagnostics
                .observability
                .task_counter_cache_miss_total,
            1
        );
        assert_eq!(
            first
                .runtime_diagnostics
                .observability
                .task_counter_full_scan_fallback_total,
            1
        );

        let second = build_runtime_observability_snapshot(
            &ctx,
            RuntimeObservabilityScope::Full,
            RuntimeTaskCounterMode::Compute,
        )
        .await;
        assert_eq!(second.runtime_diagnostics.observability.scope, "full");
        assert_eq!(
            second
                .runtime_diagnostics
                .observability
                .task_counter_cache_hit_total,
            1
        );
        assert_eq!(
            second
                .runtime_diagnostics
                .observability
                .task_counter_cache_miss_total,
            1
        );
        assert_eq!(
            second
                .runtime_diagnostics
                .observability
                .task_counter_full_scan_fallback_total,
            1
        );
    }

    #[tokio::test]
    async fn runtime_observability_snapshot_reports_age_from_last_runtime_update_event() {
        let ctx = distributed_runtime_test_context();
        let seeded_age_ms = 250_u64;
        ctx.runtime_update_last_event_at_ms
            .store(now_ms().saturating_sub(seeded_age_ms), Ordering::Relaxed);

        let snapshot = build_runtime_observability_snapshot(
            &ctx,
            RuntimeObservabilityScope::LiveUpdate,
            RuntimeTaskCounterMode::Skip,
        )
        .await;

        assert!(snapshot.runtime_diagnostics.observability.snapshot_age_ms >= seeded_age_ms);
    }

    #[tokio::test]
    async fn runtime_updated_diagnostics_payload_exposes_live_update_observability_summary() {
        let ctx = distributed_runtime_test_context();

        let payload =
            build_runtime_updated_diagnostics_payload(&ctx, None, None, None, Some("test")).await;

        assert_eq!(
            payload["observability"]["scope"],
            Value::String("live_update".to_string())
        );
        assert_eq!(
            payload["observability"]["taskCounterMode"],
            Value::String("skip".to_string())
        );
        assert_eq!(
            payload["observability"]["queueDepth"],
            Value::Number(0_u64.into())
        );
        assert_eq!(
            payload["observability"]["stateFabricFanoutQueueDepth"],
            Value::Number(0_u64.into())
        );
        assert_eq!(
            payload["observability"]["threadLiveUpdateFanoutQueueDepth"],
            Value::Number(0_u64.into())
        );
        assert_eq!(
            payload["observability"]["stateFabricFanoutCoalescedTotal"],
            Value::Number(0_u64.into())
        );
        assert_eq!(
            payload["observability"]["threadLiveUpdateFanoutCoalescedTotal"],
            Value::Number(0_u64.into())
        );
    }

    #[tokio::test]
    async fn prepare_runtime_updated_diagnostics_payload_for_emit_refreshes_snapshot_age() {
        let ctx = distributed_runtime_test_context();
        ctx.runtime_update_last_event_at_ms
            .store(now_ms().saturating_sub(5_000), Ordering::Relaxed);

        let (_event_at_ms, payload) = prepare_runtime_updated_diagnostics_payload_for_emit(
            &ctx,
            None,
            None,
            None,
            Some("test"),
        )
        .await;

        let snapshot_age_ms = payload["observability"]["snapshotAgeMs"]
            .as_u64()
            .expect("snapshot age");
        assert!(
            snapshot_age_ms < 1_000,
            "unexpected snapshot age: {snapshot_age_ms}"
        );
    }

    #[tokio::test]
    async fn runtime_observability_snapshot_recomputes_task_counters_after_revision_bump() {
        let ctx = distributed_runtime_test_context();
        {
            let mut store = ctx.agent_tasks.write().await;
            store.tasks.clear();
            store.order.clear();
            store.tasks.insert(
                "task-1".to_string(),
                distributed_runtime_test_task("task-1", "running"),
            );
            store.order.push_back("task-1".to_string());
        }

        let first = build_runtime_observability_snapshot(
            &ctx,
            RuntimeObservabilityScope::Full,
            RuntimeTaskCounterMode::Compute,
        )
        .await;
        assert_eq!(first.runtime_diagnostics.agent_tasks_total, 1);
        assert_eq!(first.runtime_diagnostics.agent_tasks_running, 1);

        {
            let mut store = ctx.agent_tasks.write().await;
            store.tasks.insert(
                "task-1".to_string(),
                distributed_runtime_test_task("task-1", "completed"),
            );
        }
        ctx.runtime_update_revision.fetch_add(1, Ordering::Relaxed);

        let second = build_runtime_observability_snapshot(
            &ctx,
            RuntimeObservabilityScope::Full,
            RuntimeTaskCounterMode::Compute,
        )
        .await;
        assert_eq!(second.runtime_diagnostics.agent_tasks_total, 1);
        assert_eq!(second.runtime_diagnostics.agent_tasks_running, 0);
        assert_eq!(second.runtime_diagnostics.agent_tasks_terminal, 1);
    }

    #[tokio::test]
    async fn runtime_observability_snapshot_reports_native_fanout_queue_depth_and_coalescing() {
        let ctx = distributed_runtime_test_context();
        let _receiver = ctx.turn_events.subscribe();
        ctx.runtime_state_fabric_fanout_active
            .store(true, Ordering::Relaxed);
        ctx.thread_live_update_fanout_active
            .store(true, Ordering::Relaxed);
        add_distributed_runtime_test_thread_live_subscription(&ctx, "sub-1", "ws-1", "thread-1")
            .await;

        publish_runtime_updated_event(&ctx, &["threads"], "fanout-state-1", None);
        publish_runtime_updated_event(&ctx, &["threads"], "fanout-state-2", None);
        publish_runtime_updated_event(&ctx, &["threads"], "fanout-state-3", None);

        publish_thread_live_update_events(&ctx, "ws-1", "thread-1", Some("fanout-thread-1")).await;
        publish_thread_live_update_events(&ctx, "ws-1", "thread-1", Some("fanout-thread-2")).await;
        publish_thread_live_update_events(&ctx, "ws-1", "thread-1", Some("fanout-thread-3")).await;

        let snapshot = build_runtime_observability_snapshot(
            &ctx,
            RuntimeObservabilityScope::LiveUpdate,
            RuntimeTaskCounterMode::Skip,
        )
        .await;

        assert_eq!(
            snapshot
                .runtime_diagnostics
                .observability
                .state_fabric_fanout_queue_depth,
            1
        );
        assert_eq!(
            snapshot
                .runtime_diagnostics
                .observability
                .thread_live_update_fanout_queue_depth,
            1
        );
        assert_eq!(
            snapshot
                .runtime_diagnostics
                .observability
                .state_fabric_fanout_coalesced_total,
            2
        );
        assert_eq!(
            snapshot
                .runtime_diagnostics
                .observability
                .thread_live_update_fanout_coalesced_total,
            2
        );
    }
}
