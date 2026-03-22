#![cfg_attr(test, allow(dead_code))]

use super::*;
use std::{collections::VecDeque, path::PathBuf};

use crate::runtime_tool_domain::{
    normalize_runtime_tool_text, parse_runtime_tool_execution_phase,
    parse_runtime_tool_execution_scope, parse_runtime_tool_execution_status,
};
#[path = "runtime_tool_metrics_storage.rs"]
mod storage;
pub(crate) use crate::runtime_tool_domain::{
    RuntimeToolExecutionChannelHealth, RuntimeToolExecutionChannelHealthStatus,
    RuntimeToolExecutionCircuitBreakerEntry, RuntimeToolExecutionCircuitBreakerState,
    RuntimeToolExecutionEvent, RuntimeToolExecutionEventPhase, RuntimeToolExecutionScope,
    RuntimeToolExecutionStatus,
};
use storage::{
    load_snapshot, persist_snapshot, resolve_metrics_flush_batch_size,
    resolve_metrics_flush_interval_ms, resolve_metrics_snapshot_path, resolve_metrics_window_size,
    runtime_tool_metrics_async_flush_enabled, spawn_runtime_tool_metrics_flush_worker,
    RuntimeToolMetricsFlushWorker,
};

const CODE_RUNTIME_TOOL_METRICS_PATH_ENV: &str = "CODE_RUNTIME_TOOL_METRICS_PATH";
const CODE_RUNTIME_TOOL_METRICS_WINDOW_SIZE_ENV: &str = "CODE_RUNTIME_TOOL_METRICS_WINDOW_SIZE";
const CODE_RUNTIME_TOOL_METRICS_ASYNC_FLUSH_ENABLED_ENV: &str =
    "CODE_RUNTIME_TOOL_METRICS_ASYNC_FLUSH_ENABLED";
const CODE_RUNTIME_TOOL_METRICS_FLUSH_BATCH_SIZE_ENV: &str =
    "CODE_RUNTIME_TOOL_METRICS_FLUSH_BATCH_SIZE";
const CODE_RUNTIME_TOOL_METRICS_FLUSH_INTERVAL_MS_ENV: &str =
    "CODE_RUNTIME_TOOL_METRICS_FLUSH_INTERVAL_MS";
const DEFAULT_RUNTIME_TOOL_METRICS_WINDOW_SIZE: usize = 500;
const MAX_RUNTIME_TOOL_METRICS_WINDOW_SIZE: usize = 5_000;
const DEFAULT_RUNTIME_TOOL_METRICS_FILE_NAME: &str = "runtime-tool-execution-metrics.json";
const DEFAULT_RUNTIME_TOOL_METRICS_DIR_NAME: &str = ".hugecode";
const DEFAULT_ERROR_CODE_TOP_K_LIMIT: usize = 10;
const DEFAULT_RUNTIME_TOOL_METRICS_FLUSH_BATCH_SIZE: usize = 50;
const MAX_RUNTIME_TOOL_METRICS_FLUSH_BATCH_SIZE: usize = 5_000;
const DEFAULT_RUNTIME_TOOL_METRICS_FLUSH_INTERVAL_MS: u64 = 1_000;
const MAX_RUNTIME_TOOL_METRICS_FLUSH_INTERVAL_MS: u64 = 60_000;

fn now_epoch_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
        .try_into()
        .unwrap_or(u64::MAX)
}

fn default_metrics_window_size() -> usize {
    DEFAULT_RUNTIME_TOOL_METRICS_WINDOW_SIZE
}

fn default_metrics_updated_at() -> u64 {
    now_epoch_ms()
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeToolExecutionRecentEntry {
    pub(crate) tool_name: String,
    pub(crate) scope: RuntimeToolExecutionScope,
    pub(crate) status: RuntimeToolExecutionStatus,
    #[serde(default)]
    pub(crate) error_code: Option<String>,
    #[serde(default)]
    pub(crate) duration_ms: Option<u64>,
    pub(crate) at: u64,
    #[serde(default)]
    pub(crate) trace_id: Option<String>,
    #[serde(default)]
    pub(crate) span_id: Option<String>,
    #[serde(default)]
    pub(crate) parent_span_id: Option<String>,
    #[serde(default)]
    pub(crate) attempt: Option<u32>,
    #[serde(default)]
    pub(crate) request_id: Option<String>,
    #[serde(default)]
    pub(crate) planner_step_key: Option<String>,
    #[serde(default)]
    pub(crate) workspace_id: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeToolExecutionTotals {
    pub(crate) attempted_total: u64,
    pub(crate) started_total: u64,
    pub(crate) completed_total: u64,
    pub(crate) success_total: u64,
    pub(crate) validation_failed_total: u64,
    pub(crate) runtime_failed_total: u64,
    pub(crate) timeout_total: u64,
    pub(crate) blocked_total: u64,
    #[serde(default)]
    pub(crate) repetition_blocked_total: u64,
    #[serde(default)]
    pub(crate) approval_timeout_total: u64,
    #[serde(default)]
    pub(crate) sub_agent_timeout_total: u64,
    #[serde(default)]
    pub(crate) stale_write_rejected_total: u64,
    #[serde(default)]
    pub(crate) delta_queue_drop_total: u64,
    #[serde(default)]
    pub(crate) stream_guardrail_tripped_total: u64,
    #[serde(default)]
    pub(crate) terminalization_cas_noop_total: u64,
    #[serde(default)]
    pub(crate) lifecycle_sweep_run_total: u64,
    #[serde(default)]
    pub(crate) lifecycle_sweep_skip_no_lease_total: u64,
    #[serde(default)]
    pub(crate) lifecycle_lease_acquire_fail_total: u64,
    #[serde(default)]
    pub(crate) lifecycle_lease_renew_fail_total: u64,
    #[serde(default)]
    pub(crate) lifecycle_lease_lost_total: u64,
    #[serde(default)]
    pub(crate) lifecycle_lease_contended_total: u64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum RuntimeToolSafetyCounter {
    RepetitionBlocked,
    ApprovalTimeout,
    SubAgentTimeout,
    StaleWriteRejected,
    DeltaQueueDrop,
    StreamGuardrailTripped,
    TerminalizationCasNoop,
    LifecycleSweepRun,
    LifecycleSweepSkipNoLease,
    LifecycleLeaseAcquireFail,
    LifecycleLeaseRenewFail,
    LifecycleLeaseLost,
    LifecycleLeaseContended,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeToolExecutionByToolEntry {
    pub(crate) tool_name: String,
    pub(crate) scope: RuntimeToolExecutionScope,
    #[serde(flatten)]
    pub(crate) totals: RuntimeToolExecutionTotals,
    #[serde(default)]
    pub(crate) last_status: Option<RuntimeToolExecutionStatus>,
    #[serde(default)]
    pub(crate) last_error_code: Option<String>,
    #[serde(default)]
    pub(crate) last_duration_ms: Option<u64>,
    pub(crate) updated_at: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeToolExecutionScopeRate {
    pub(crate) scope: RuntimeToolExecutionScope,
    #[serde(default)]
    pub(crate) success_rate: Option<f64>,
    pub(crate) denominator: u64,
    pub(crate) blocked_total: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeToolExecutionErrorCodeCount {
    pub(crate) error_code: String,
    pub(crate) count: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeToolExecutionMetricsSnapshot {
    pub(crate) totals: RuntimeToolExecutionTotals,
    #[serde(default)]
    pub(crate) by_tool: HashMap<String, RuntimeToolExecutionByToolEntry>,
    #[serde(default)]
    pub(crate) recent: Vec<RuntimeToolExecutionRecentEntry>,
    #[serde(default = "default_metrics_updated_at")]
    pub(crate) updated_at: u64,
    #[serde(default = "default_metrics_window_size")]
    pub(crate) window_size: usize,
    pub(crate) channel_health: RuntimeToolExecutionChannelHealth,
    #[serde(default)]
    pub(crate) scope_rates: Option<Vec<RuntimeToolExecutionScopeRate>>,
    #[serde(default)]
    pub(crate) error_code_top_k: Option<Vec<RuntimeToolExecutionErrorCodeCount>>,
    pub(crate) circuit_breakers: Vec<RuntimeToolExecutionCircuitBreakerEntry>,
}

impl RuntimeToolExecutionMetricsSnapshot {
    fn empty(window_size: usize) -> Self {
        let mut snapshot = Self {
            totals: RuntimeToolExecutionTotals::default(),
            by_tool: HashMap::new(),
            recent: Vec::new(),
            updated_at: now_epoch_ms(),
            window_size,
            channel_health: RuntimeToolExecutionChannelHealth {
                status: RuntimeToolExecutionChannelHealthStatus::Healthy,
                reason: None,
                last_error_code: None,
                updated_at: Some(now_epoch_ms()),
            },
            scope_rates: None,
            error_code_top_k: None,
            circuit_breakers: Vec::new(),
        };
        snapshot.refresh_derived_fields();
        snapshot
    }

    fn refresh_derived_fields(&mut self) {
        let updated_at = self.updated_at;
        self.channel_health = RuntimeToolExecutionChannelHealth {
            status: RuntimeToolExecutionChannelHealthStatus::Healthy,
            reason: None,
            last_error_code: None,
            updated_at: Some(updated_at),
        };
        self.scope_rates = Some(compute_scope_rates(&self.by_tool));
        self.error_code_top_k = Some(compute_error_code_top_k(self.recent.as_slice()));
        self.circuit_breakers = RuntimeToolExecutionScope::ordered()
            .into_iter()
            .map(|scope| RuntimeToolExecutionCircuitBreakerEntry {
                scope,
                state: RuntimeToolExecutionCircuitBreakerState::Closed,
                opened_at: None,
                updated_at,
            })
            .collect();
    }
}

pub(crate) struct RuntimeToolExecutionMetricsStore {
    snapshot: RuntimeToolExecutionMetricsSnapshot,
    recent_buffer: VecDeque<RuntimeToolExecutionRecentEntry>,
    window_size: usize,
    path: PathBuf,
    flush_worker: Option<RuntimeToolMetricsFlushWorker>,
    flush_batch_size: usize,
    flush_interval_ms: u64,
    pending_flush_events: usize,
    last_flush_dispatch_at: u64,
}

impl RuntimeToolExecutionMetricsStore {
    pub(crate) fn from_env() -> Self {
        let window_size = resolve_metrics_window_size();
        let path = resolve_metrics_snapshot_path();
        Self::load_or_default(path, window_size)
    }

    #[cfg(test)]
    pub(crate) fn isolated_for_test() -> Self {
        static COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

        let unique = COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed) + 1;
        let path = std::env::temp_dir().join(format!(
            "code-runtime-tool-metrics-router-test-{}-{unique}.json",
            std::process::id()
        ));
        Self::with_path(path, resolve_metrics_window_size())
    }

    #[cfg(test)]
    fn with_path(path: PathBuf, window_size: usize) -> Self {
        Self::load_or_default(
            path,
            window_size.clamp(1, MAX_RUNTIME_TOOL_METRICS_WINDOW_SIZE),
        )
    }

    fn load_or_default(path: PathBuf, window_size: usize) -> Self {
        let loaded_snapshot = load_snapshot(path.as_path()).ok();
        let mut snapshot = loaded_snapshot
            .unwrap_or_else(|| RuntimeToolExecutionMetricsSnapshot::empty(window_size));
        snapshot.window_size = window_size;
        if snapshot.recent.len() > window_size {
            snapshot.recent = snapshot
                .recent
                .split_off(snapshot.recent.len().saturating_sub(window_size));
        }
        snapshot.refresh_derived_fields();
        let recent_buffer = snapshot.recent.iter().cloned().collect::<VecDeque<_>>();
        let flush_worker = if runtime_tool_metrics_async_flush_enabled() {
            spawn_runtime_tool_metrics_flush_worker(path.clone())
        } else {
            None
        };
        let flush_batch_size = resolve_metrics_flush_batch_size();
        let flush_interval_ms = resolve_metrics_flush_interval_ms();
        let now = now_epoch_ms();
        Self {
            snapshot,
            recent_buffer,
            window_size,
            path,
            flush_worker,
            flush_batch_size,
            flush_interval_ms,
            pending_flush_events: 0,
            last_flush_dispatch_at: now,
        }
    }

    pub(crate) fn read_snapshot(&self) -> RuntimeToolExecutionMetricsSnapshot {
        let mut snapshot = self.snapshot.clone();
        snapshot.refresh_derived_fields();
        snapshot
    }

    pub(crate) fn record_events(
        &mut self,
        events: &[RuntimeToolExecutionEvent],
    ) -> Result<RuntimeToolExecutionMetricsSnapshot, String> {
        for event in events {
            self.apply_event(event)?;
        }
        self.snapshot.window_size = self.window_size;
        self.snapshot.updated_at = now_epoch_ms();
        self.snapshot.recent = self.recent_buffer.iter().cloned().collect();
        self.snapshot.refresh_derived_fields();
        self.pending_flush_events = self.pending_flush_events.saturating_add(events.len());
        self.maybe_flush_snapshot(false)?;
        Ok(self.snapshot.clone())
    }

    pub(crate) fn increment_safety_counter(
        &mut self,
        counter: RuntimeToolSafetyCounter,
    ) -> Result<RuntimeToolExecutionMetricsSnapshot, String> {
        match counter {
            RuntimeToolSafetyCounter::RepetitionBlocked => {
                self.snapshot.totals.repetition_blocked_total = self
                    .snapshot
                    .totals
                    .repetition_blocked_total
                    .saturating_add(1);
            }
            RuntimeToolSafetyCounter::ApprovalTimeout => {
                self.snapshot.totals.approval_timeout_total = self
                    .snapshot
                    .totals
                    .approval_timeout_total
                    .saturating_add(1);
            }
            RuntimeToolSafetyCounter::SubAgentTimeout => {
                self.snapshot.totals.sub_agent_timeout_total = self
                    .snapshot
                    .totals
                    .sub_agent_timeout_total
                    .saturating_add(1);
            }
            RuntimeToolSafetyCounter::StaleWriteRejected => {
                self.snapshot.totals.stale_write_rejected_total = self
                    .snapshot
                    .totals
                    .stale_write_rejected_total
                    .saturating_add(1);
            }
            RuntimeToolSafetyCounter::DeltaQueueDrop => {
                self.snapshot.totals.delta_queue_drop_total = self
                    .snapshot
                    .totals
                    .delta_queue_drop_total
                    .saturating_add(1);
            }
            RuntimeToolSafetyCounter::StreamGuardrailTripped => {
                self.snapshot.totals.stream_guardrail_tripped_total = self
                    .snapshot
                    .totals
                    .stream_guardrail_tripped_total
                    .saturating_add(1);
            }
            RuntimeToolSafetyCounter::TerminalizationCasNoop => {
                self.snapshot.totals.terminalization_cas_noop_total = self
                    .snapshot
                    .totals
                    .terminalization_cas_noop_total
                    .saturating_add(1);
            }
            RuntimeToolSafetyCounter::LifecycleSweepRun => {
                self.snapshot.totals.lifecycle_sweep_run_total = self
                    .snapshot
                    .totals
                    .lifecycle_sweep_run_total
                    .saturating_add(1);
            }
            RuntimeToolSafetyCounter::LifecycleSweepSkipNoLease => {
                self.snapshot.totals.lifecycle_sweep_skip_no_lease_total = self
                    .snapshot
                    .totals
                    .lifecycle_sweep_skip_no_lease_total
                    .saturating_add(1);
            }
            RuntimeToolSafetyCounter::LifecycleLeaseAcquireFail => {
                self.snapshot.totals.lifecycle_lease_acquire_fail_total = self
                    .snapshot
                    .totals
                    .lifecycle_lease_acquire_fail_total
                    .saturating_add(1);
            }
            RuntimeToolSafetyCounter::LifecycleLeaseRenewFail => {
                self.snapshot.totals.lifecycle_lease_renew_fail_total = self
                    .snapshot
                    .totals
                    .lifecycle_lease_renew_fail_total
                    .saturating_add(1);
            }
            RuntimeToolSafetyCounter::LifecycleLeaseLost => {
                self.snapshot.totals.lifecycle_lease_lost_total = self
                    .snapshot
                    .totals
                    .lifecycle_lease_lost_total
                    .saturating_add(1);
            }
            RuntimeToolSafetyCounter::LifecycleLeaseContended => {
                self.snapshot.totals.lifecycle_lease_contended_total = self
                    .snapshot
                    .totals
                    .lifecycle_lease_contended_total
                    .saturating_add(1);
            }
        }
        self.snapshot.window_size = self.window_size;
        self.snapshot.updated_at = now_epoch_ms();
        self.snapshot.recent = self.recent_buffer.iter().cloned().collect();
        self.snapshot.refresh_derived_fields();
        self.pending_flush_events = self.pending_flush_events.saturating_add(1);
        self.maybe_flush_snapshot(false)?;
        Ok(self.snapshot.clone())
    }

    pub(crate) fn reset(&mut self) -> Result<RuntimeToolExecutionMetricsSnapshot, String> {
        self.snapshot = RuntimeToolExecutionMetricsSnapshot::empty(self.window_size);
        self.recent_buffer.clear();
        self.snapshot.refresh_derived_fields();
        self.pending_flush_events = 0;
        self.maybe_flush_snapshot(true)?;
        Ok(self.snapshot.clone())
    }

    fn maybe_flush_snapshot(&mut self, force: bool) -> Result<(), String> {
        if self.flush_worker.is_none() {
            persist_snapshot(self.path.as_path(), &self.snapshot)?;
            self.pending_flush_events = 0;
            self.last_flush_dispatch_at = now_epoch_ms();
            return Ok(());
        }

        let now = now_epoch_ms();
        if !force {
            let flush_due_to_batch = self.pending_flush_events >= self.flush_batch_size;
            let flush_due_to_interval =
                now.saturating_sub(self.last_flush_dispatch_at) >= self.flush_interval_ms;
            if !flush_due_to_batch && !flush_due_to_interval {
                return Ok(());
            }
        }

        let snapshot = self.snapshot.clone();
        let Some(worker) = self.flush_worker.as_ref() else {
            persist_snapshot(self.path.as_path(), &snapshot)?;
            self.pending_flush_events = 0;
            self.last_flush_dispatch_at = now;
            return Ok(());
        };
        if worker.sender.send(snapshot).is_ok() {
            self.pending_flush_events = 0;
            self.last_flush_dispatch_at = now;
            return Ok(());
        }

        // Async path is unavailable; sync flush protects durability.
        persist_snapshot(self.path.as_path(), &self.snapshot)?;
        self.pending_flush_events = 0;
        self.last_flush_dispatch_at = now;
        Ok(())
    }

    fn apply_event(&mut self, event: &RuntimeToolExecutionEvent) -> Result<(), String> {
        let tool_name = event.tool_name.trim();
        if tool_name.is_empty() {
            return Err("runtime tool metrics event toolName is required.".to_string());
        }
        let tool_name = tool_name.to_string();
        let updated_at = event.at;
        let key = format!("{}:{tool_name}", event.scope.as_str());
        let by_tool =
            self.snapshot
                .by_tool
                .entry(key)
                .or_insert_with(|| RuntimeToolExecutionByToolEntry {
                    tool_name: tool_name.clone(),
                    scope: event.scope,
                    totals: RuntimeToolExecutionTotals::default(),
                    last_status: None,
                    last_error_code: None,
                    last_duration_ms: None,
                    updated_at,
                });
        by_tool.updated_at = updated_at;

        match event.phase {
            RuntimeToolExecutionEventPhase::Attempted => {
                self.snapshot.totals.attempted_total =
                    self.snapshot.totals.attempted_total.saturating_add(1);
                by_tool.totals.attempted_total = by_tool.totals.attempted_total.saturating_add(1);
            }
            RuntimeToolExecutionEventPhase::Started => {
                self.snapshot.totals.started_total =
                    self.snapshot.totals.started_total.saturating_add(1);
                by_tool.totals.started_total = by_tool.totals.started_total.saturating_add(1);
            }
            RuntimeToolExecutionEventPhase::Completed => {
                let status = event.status.ok_or_else(|| {
                    "runtime tool metrics completed event requires status.".to_string()
                })?;
                self.snapshot.totals.completed_total =
                    self.snapshot.totals.completed_total.saturating_add(1);
                by_tool.totals.completed_total = by_tool.totals.completed_total.saturating_add(1);
                increment_status_totals(&mut self.snapshot.totals, status);
                increment_status_totals(&mut by_tool.totals, status);
                by_tool.last_status = Some(status);
                by_tool.last_error_code = normalize_runtime_tool_text(event.error_code.as_deref());
                by_tool.last_duration_ms = event.duration_ms;

                self.recent_buffer
                    .push_back(RuntimeToolExecutionRecentEntry {
                        tool_name,
                        scope: event.scope,
                        status,
                        error_code: normalize_runtime_tool_text(event.error_code.as_deref()),
                        duration_ms: event.duration_ms,
                        at: event.at,
                        trace_id: normalize_runtime_tool_text(event.trace_id.as_deref()),
                        span_id: normalize_runtime_tool_text(event.span_id.as_deref()),
                        parent_span_id: normalize_runtime_tool_text(
                            event.parent_span_id.as_deref(),
                        ),
                        attempt: event.attempt,
                        request_id: normalize_runtime_tool_text(event.request_id.as_deref()),
                        planner_step_key: normalize_runtime_tool_text(
                            event.planner_step_key.as_deref(),
                        ),
                        workspace_id: normalize_runtime_tool_text(event.workspace_id.as_deref()),
                    });
                while self.recent_buffer.len() > self.window_size {
                    self.recent_buffer.pop_front();
                }
            }
        }

        Ok(())
    }
}

pub(crate) fn parse_runtime_tool_execution_events(
    params: &Value,
) -> Result<Vec<RuntimeToolExecutionEvent>, RpcError> {
    let params = as_object(params)?;
    let Some(events_value) = params.get("events") else {
        return Err(RpcError::invalid_params(
            "runtime tool metrics `events` array is required.",
        ));
    };
    let Some(events) = events_value.as_array() else {
        return Err(RpcError::invalid_params(
            "runtime tool metrics `events` must be an array.",
        ));
    };
    if events.is_empty() {
        return Err(RpcError::invalid_params(
            "runtime tool metrics `events` must include at least one event.",
        ));
    }

    events
        .iter()
        .enumerate()
        .map(|(index, value)| parse_runtime_tool_execution_event(index, value))
        .collect()
}

#[derive(Clone, Debug, Default)]
pub(crate) struct RuntimeToolExecutionMetricsReadFilter {
    pub(crate) scope: Option<RuntimeToolExecutionScope>,
    pub(crate) tool_name: Option<String>,
    pub(crate) since_ms: Option<u64>,
    pub(crate) limit: Option<usize>,
}

pub(crate) fn parse_runtime_tool_execution_metrics_read_filter(
    params: &Value,
) -> Result<RuntimeToolExecutionMetricsReadFilter, RpcError> {
    let params = as_object(params)?;
    let scope = read_optional_string(params, "scope")
        .map(|raw| parse_runtime_tool_execution_scope(raw.as_str()))
        .transpose()
        .map_err(|error| RpcError::invalid_params(format!("scope {error}")))?;
    let tool_name =
        normalize_runtime_tool_text(read_optional_string(params, "toolName").as_deref());
    let since_ms = read_optional_u64(params, "sinceMs");
    let limit = read_optional_u64(params, "limit")
        .and_then(|value| usize::try_from(value).ok())
        .and_then(|value| if value == 0 { None } else { Some(value) });

    Ok(RuntimeToolExecutionMetricsReadFilter {
        scope,
        tool_name,
        since_ms,
        limit,
    })
}

pub(crate) fn filter_runtime_tool_execution_snapshot(
    snapshot: &RuntimeToolExecutionMetricsSnapshot,
    filter: &RuntimeToolExecutionMetricsReadFilter,
) -> RuntimeToolExecutionMetricsSnapshot {
    let scope = filter.scope;
    let tool_name = filter.tool_name.as_deref();
    let since_ms = filter.since_ms;

    let mut by_tool = HashMap::new();
    for (key, entry) in snapshot.by_tool.iter() {
        if scope.is_some() && Some(entry.scope) != scope {
            continue;
        }
        if let Some(expected) = tool_name {
            if entry.tool_name != expected {
                continue;
            }
        }
        by_tool.insert(key.clone(), entry.clone());
    }

    let mut recent = snapshot
        .recent
        .iter()
        .filter(|entry| {
            if scope.is_some() && Some(entry.scope) != scope {
                return false;
            }
            if let Some(expected) = tool_name {
                if entry.tool_name != expected {
                    return false;
                }
            }
            if let Some(since) = since_ms {
                if entry.at < since {
                    return false;
                }
            }
            true
        })
        .cloned()
        .collect::<Vec<_>>();
    if let Some(limit) = filter.limit {
        if recent.len() > limit {
            recent = recent.split_off(recent.len().saturating_sub(limit));
        }
    }

    let mut totals = RuntimeToolExecutionTotals {
        repetition_blocked_total: snapshot.totals.repetition_blocked_total,
        approval_timeout_total: snapshot.totals.approval_timeout_total,
        sub_agent_timeout_total: snapshot.totals.sub_agent_timeout_total,
        stale_write_rejected_total: snapshot.totals.stale_write_rejected_total,
        delta_queue_drop_total: snapshot.totals.delta_queue_drop_total,
        stream_guardrail_tripped_total: snapshot.totals.stream_guardrail_tripped_total,
        terminalization_cas_noop_total: snapshot.totals.terminalization_cas_noop_total,
        lifecycle_sweep_run_total: snapshot.totals.lifecycle_sweep_run_total,
        lifecycle_sweep_skip_no_lease_total: snapshot.totals.lifecycle_sweep_skip_no_lease_total,
        lifecycle_lease_acquire_fail_total: snapshot.totals.lifecycle_lease_acquire_fail_total,
        lifecycle_lease_renew_fail_total: snapshot.totals.lifecycle_lease_renew_fail_total,
        lifecycle_lease_lost_total: snapshot.totals.lifecycle_lease_lost_total,
        lifecycle_lease_contended_total: snapshot.totals.lifecycle_lease_contended_total,
        ..RuntimeToolExecutionTotals::default()
    };
    for entry in by_tool.values() {
        totals.attempted_total = totals
            .attempted_total
            .saturating_add(entry.totals.attempted_total);
        totals.started_total = totals
            .started_total
            .saturating_add(entry.totals.started_total);
        totals.completed_total = totals
            .completed_total
            .saturating_add(entry.totals.completed_total);
        totals.success_total = totals
            .success_total
            .saturating_add(entry.totals.success_total);
        totals.validation_failed_total = totals
            .validation_failed_total
            .saturating_add(entry.totals.validation_failed_total);
        totals.runtime_failed_total = totals
            .runtime_failed_total
            .saturating_add(entry.totals.runtime_failed_total);
        totals.timeout_total = totals
            .timeout_total
            .saturating_add(entry.totals.timeout_total);
        totals.blocked_total = totals
            .blocked_total
            .saturating_add(entry.totals.blocked_total);
    }

    let mut filtered = RuntimeToolExecutionMetricsSnapshot {
        totals,
        by_tool,
        recent,
        updated_at: snapshot.updated_at,
        window_size: snapshot.window_size,
        channel_health: snapshot.channel_health.clone(),
        scope_rates: snapshot.scope_rates.clone(),
        error_code_top_k: snapshot.error_code_top_k.clone(),
        circuit_breakers: snapshot.circuit_breakers.clone(),
    };
    filtered.refresh_derived_fields();
    filtered
}

fn parse_runtime_tool_execution_event(
    index: usize,
    value: &Value,
) -> Result<RuntimeToolExecutionEvent, RpcError> {
    let event = value.as_object().ok_or_else(|| {
        RpcError::invalid_params(format!(
            "runtime tool metrics events[{index}] must be an object."
        ))
    })?;

    let tool_name = read_required_string(event, "toolName")
        .map(|value| value.to_string())
        .map_err(|_| {
            RpcError::invalid_params(format!(
                "runtime tool metrics events[{index}].toolName is required."
            ))
        })?;

    let scope =
        parse_runtime_tool_execution_scope(read_required_string(event, "scope").map_err(|_| {
            RpcError::invalid_params(format!(
                "runtime tool metrics events[{index}].scope is required."
            ))
        })?)
        .map_err(|error| RpcError::invalid_params(format!("events[{index}].scope {error}")))?;

    let phase =
        parse_runtime_tool_execution_phase(read_required_string(event, "phase").map_err(|_| {
            RpcError::invalid_params(format!(
                "runtime tool metrics events[{index}].phase is required."
            ))
        })?)
        .map_err(|error| RpcError::invalid_params(format!("events[{index}].phase {error}")))?;

    let at = read_optional_u64(event, "at").ok_or_else(|| {
        RpcError::invalid_params(format!(
            "runtime tool metrics events[{index}].at must be a non-negative integer."
        ))
    })?;

    let status = read_optional_string(event, "status")
        .map(|raw| parse_runtime_tool_execution_status(raw.as_str()))
        .transpose()
        .map_err(|error| RpcError::invalid_params(format!("events[{index}].status {error}")))?;
    let error_code =
        normalize_runtime_tool_text(read_optional_string(event, "errorCode").as_deref());
    let duration_ms = read_optional_u64(event, "durationMs");
    let trace_id = normalize_runtime_tool_text(read_optional_string(event, "traceId").as_deref());
    let span_id = normalize_runtime_tool_text(read_optional_string(event, "spanId").as_deref());
    let parent_span_id =
        normalize_runtime_tool_text(read_optional_string(event, "parentSpanId").as_deref());
    let request_id =
        normalize_runtime_tool_text(read_optional_string(event, "requestId").as_deref());
    let planner_step_key =
        normalize_runtime_tool_text(read_optional_string(event, "plannerStepKey").as_deref());
    let workspace_id =
        normalize_runtime_tool_text(read_optional_string(event, "workspaceId").as_deref());
    let attempt = read_optional_u64(event, "attempt").and_then(|value| u32::try_from(value).ok());

    if trace_id.is_some() && span_id.is_none() {
        return Err(RpcError::invalid_params(format!(
            "events[{index}].spanId is required when events[{index}].traceId is provided."
        )));
    }

    if phase == RuntimeToolExecutionEventPhase::Completed && status.is_none() {
        return Err(RpcError::invalid_params(format!(
            "runtime tool metrics events[{index}].status is required when phase=completed."
        )));
    }

    Ok(RuntimeToolExecutionEvent {
        tool_name,
        scope,
        phase,
        at,
        status,
        error_code,
        duration_ms,
        trace_id,
        span_id,
        parent_span_id,
        attempt,
        request_id,
        planner_step_key,
        workspace_id,
    })
}

fn increment_status_totals(
    totals: &mut RuntimeToolExecutionTotals,
    status: RuntimeToolExecutionStatus,
) {
    match status {
        RuntimeToolExecutionStatus::Success => {
            totals.success_total = totals.success_total.saturating_add(1)
        }
        RuntimeToolExecutionStatus::ValidationFailed => {
            totals.validation_failed_total = totals.validation_failed_total.saturating_add(1)
        }
        RuntimeToolExecutionStatus::RuntimeFailed => {
            totals.runtime_failed_total = totals.runtime_failed_total.saturating_add(1)
        }
        RuntimeToolExecutionStatus::Timeout => {
            totals.timeout_total = totals.timeout_total.saturating_add(1)
        }
        RuntimeToolExecutionStatus::Blocked => {
            totals.blocked_total = totals.blocked_total.saturating_add(1)
        }
    }
}

fn compute_scope_rates(
    by_tool: &HashMap<String, RuntimeToolExecutionByToolEntry>,
) -> Vec<RuntimeToolExecutionScopeRate> {
    let mut scope_totals: HashMap<RuntimeToolExecutionScope, RuntimeToolOutcomeAggregation> =
        HashMap::new();
    for scope in RuntimeToolExecutionScope::ordered() {
        scope_totals.insert(scope, RuntimeToolOutcomeAggregation::default());
    }
    for entry in by_tool.values() {
        let bucket = scope_totals.entry(entry.scope).or_default();
        bucket.success_total = bucket
            .success_total
            .saturating_add(entry.totals.success_total);
        bucket.validation_failed_total = bucket
            .validation_failed_total
            .saturating_add(entry.totals.validation_failed_total);
        bucket.runtime_failed_total = bucket
            .runtime_failed_total
            .saturating_add(entry.totals.runtime_failed_total);
        bucket.timeout_total = bucket
            .timeout_total
            .saturating_add(entry.totals.timeout_total);
        bucket.blocked_total = bucket
            .blocked_total
            .saturating_add(entry.totals.blocked_total);
    }

    RuntimeToolExecutionScope::ordered()
        .into_iter()
        .map(|scope| {
            let totals = scope_totals.get(&scope).cloned().unwrap_or_default();
            let denominator = totals
                .success_total
                .saturating_add(totals.validation_failed_total)
                .saturating_add(totals.runtime_failed_total)
                .saturating_add(totals.timeout_total);
            let success_rate = if denominator > 0 {
                Some(totals.success_total as f64 / denominator as f64)
            } else {
                None
            };
            RuntimeToolExecutionScopeRate {
                scope,
                success_rate,
                denominator,
                blocked_total: totals.blocked_total,
            }
        })
        .collect()
}

fn compute_error_code_top_k(
    recent: &[RuntimeToolExecutionRecentEntry],
) -> Vec<RuntimeToolExecutionErrorCodeCount> {
    let mut counters: HashMap<String, u64> = HashMap::new();
    for entry in recent {
        let Some(error_code) = normalize_runtime_tool_text(entry.error_code.as_deref()) else {
            continue;
        };
        let counter = counters.entry(error_code).or_insert(0);
        *counter = counter.saturating_add(1);
    }
    let mut rows = counters
        .into_iter()
        .map(|(error_code, count)| RuntimeToolExecutionErrorCodeCount { error_code, count })
        .collect::<Vec<_>>();
    rows.sort_by(|left, right| {
        right
            .count
            .cmp(&left.count)
            .then_with(|| left.error_code.cmp(&right.error_code))
    });
    if rows.len() > DEFAULT_ERROR_CODE_TOP_K_LIMIT {
        rows.truncate(DEFAULT_ERROR_CODE_TOP_K_LIMIT);
    }
    rows
}

#[derive(Clone, Debug, Default)]
struct RuntimeToolOutcomeAggregation {
    success_total: u64,
    validation_failed_total: u64,
    runtime_failed_total: u64,
    timeout_total: u64,
    blocked_total: u64,
}

#[cfg(test)]
#[path = "runtime_tool_metrics_tests.rs"]
mod tests;
