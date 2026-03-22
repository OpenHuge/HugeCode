#![cfg_attr(test, allow(dead_code))]

use super::*;
use std::{
    collections::{HashMap, VecDeque},
    path::{Path, PathBuf},
};

use crate::runtime_tool_domain::{
    normalize_runtime_tool_text, parse_runtime_tool_execution_scope,
    parse_runtime_tool_execution_status, RuntimeToolExecutionChannelHealth,
    RuntimeToolExecutionChannelHealthStatus, RuntimeToolExecutionCircuitBreakerEntry,
    RuntimeToolExecutionCircuitBreakerState, RuntimeToolExecutionScope, RuntimeToolExecutionStatus,
};

const CODE_RUNTIME_TOOL_GUARDRAILS_PATH_ENV: &str = "CODE_RUNTIME_TOOL_GUARDRAILS_PATH";
const DEFAULT_RUNTIME_TOOL_GUARDRAILS_FILE_NAME: &str = "runtime-tool-guardrails.json";
const DEFAULT_RUNTIME_TOOL_GUARDRAILS_DIR_NAME: &str = ".hugecode";

const DEFAULT_PAYLOAD_LIMIT_BYTES: usize = 64 * 1024;
const DEFAULT_COMPUTER_OBSERVE_RATE_LIMIT_PER_MINUTE: u32 = 12;
const DEFAULT_CIRCUIT_WINDOW_SIZE: usize = 50;
const DEFAULT_CIRCUIT_MIN_COMPLETED: usize = 20;
const DEFAULT_CIRCUIT_OPEN_MS: u64 = 10 * 60 * 1_000;
const DEFAULT_HALF_OPEN_MAX_PROBES: u32 = 3;
const DEFAULT_HALF_OPEN_REQUIRED_SUCCESSES: u32 = 2;
const RATE_LIMIT_WINDOW_MS: u64 = 60_000;

fn now_epoch_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
        .try_into()
        .unwrap_or(u64::MAX)
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum RuntimeToolGuardrailBlockReason {
    PayloadTooLarge,
    RateLimited,
    CircuitOpen,
    MetricsUnhealthy,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum RuntimeToolGuardrailCapabilityProfile {
    Default,
    SoloMax,
}

impl Default for RuntimeToolGuardrailCapabilityProfile {
    fn default() -> Self {
        Self::Default
    }
}

impl RuntimeToolGuardrailCapabilityProfile {
    fn from_optional_str(value: Option<&str>) -> Self {
        match value.map(str::trim).filter(|entry| !entry.is_empty()) {
            Some("solo-max") | Some("solo_max") => Self::SoloMax,
            _ => Self::Default,
        }
    }

    fn payload_limit_multiplier(self) -> usize {
        match self {
            Self::Default => 1,
            Self::SoloMax => 4,
        }
    }

    fn computer_observe_rate_limit_multiplier(self) -> u32 {
        match self {
            Self::Default => 1,
            Self::SoloMax => 5,
        }
    }
}

impl RuntimeToolGuardrailBlockReason {
    fn code(self) -> &'static str {
        match self {
            Self::PayloadTooLarge => "runtime.validation.payload_too_large",
            Self::RateLimited => "runtime.validation.rate_limited",
            Self::CircuitOpen => "runtime.validation.circuit_open",
            Self::MetricsUnhealthy => "runtime.validation.metrics_unhealthy",
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeToolGuardrailEvaluateRequest {
    pub(crate) tool_name: String,
    pub(crate) scope: RuntimeToolExecutionScope,
    #[serde(default)]
    pub(crate) workspace_id: Option<String>,
    pub(crate) payload_bytes: u64,
    #[serde(default)]
    pub(crate) at: Option<u64>,
    #[serde(default)]
    pub(crate) request_id: Option<String>,
    #[serde(default)]
    pub(crate) trace_id: Option<String>,
    #[serde(default)]
    pub(crate) span_id: Option<String>,
    #[serde(default)]
    pub(crate) parent_span_id: Option<String>,
    #[serde(default)]
    pub(crate) planner_step_key: Option<String>,
    #[serde(default)]
    pub(crate) attempt: Option<u32>,
    #[serde(default)]
    pub(crate) capability_profile: RuntimeToolGuardrailCapabilityProfile,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeToolGuardrailEvaluateResult {
    pub(crate) allowed: bool,
    #[serde(default)]
    pub(crate) block_reason: Option<RuntimeToolGuardrailBlockReason>,
    #[serde(default)]
    pub(crate) error_code: Option<String>,
    #[serde(default)]
    pub(crate) message: Option<String>,
    pub(crate) channel_health: RuntimeToolExecutionChannelHealth,
    #[serde(default)]
    pub(crate) circuit_breaker: Option<RuntimeToolExecutionCircuitBreakerEntry>,
    pub(crate) effective_payload_limit_bytes: u64,
    pub(crate) effective_computer_observe_rate_limit_per_minute: u32,
    pub(crate) updated_at: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeToolGuardrailOutcomeEvent {
    pub(crate) tool_name: String,
    pub(crate) scope: RuntimeToolExecutionScope,
    pub(crate) status: RuntimeToolExecutionStatus,
    pub(crate) at: u64,
    #[serde(default)]
    pub(crate) workspace_id: Option<String>,
    #[serde(default)]
    pub(crate) duration_ms: Option<u64>,
    #[serde(default)]
    pub(crate) error_code: Option<String>,
    #[serde(default)]
    pub(crate) request_id: Option<String>,
    #[serde(default)]
    pub(crate) trace_id: Option<String>,
    #[serde(default)]
    pub(crate) span_id: Option<String>,
    #[serde(default)]
    pub(crate) parent_span_id: Option<String>,
    #[serde(default)]
    pub(crate) planner_step_key: Option<String>,
    #[serde(default)]
    pub(crate) attempt: Option<u32>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeToolGuardrailStateSnapshot {
    pub(crate) window_size: usize,
    pub(crate) payload_limit_bytes: usize,
    pub(crate) computer_observe_rate_limit_per_minute: u32,
    pub(crate) circuit_window_size: usize,
    pub(crate) circuit_min_completed: usize,
    pub(crate) circuit_open_ms: u64,
    pub(crate) half_open_max_probes: u32,
    pub(crate) half_open_required_successes: u32,
    pub(crate) channel_health: RuntimeToolExecutionChannelHealth,
    pub(crate) circuit_breakers: Vec<RuntimeToolExecutionCircuitBreakerEntry>,
    pub(crate) updated_at: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct RuntimeToolGuardrailCircuitRuntimeState {
    scope: RuntimeToolExecutionScope,
    state: RuntimeToolExecutionCircuitBreakerState,
    #[serde(default)]
    opened_at: Option<u64>,
    updated_at: u64,
    #[serde(default)]
    half_open_probe_attempts: u32,
    #[serde(default)]
    half_open_probe_successes: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct RuntimeToolGuardrailPersistedState {
    window_size: usize,
    payload_limit_bytes: usize,
    computer_observe_rate_limit_per_minute: u32,
    circuit_window_size: usize,
    circuit_min_completed: usize,
    circuit_open_ms: u64,
    half_open_max_probes: u32,
    half_open_required_successes: u32,
    channel_health: RuntimeToolExecutionChannelHealth,
    circuit_states: HashMap<RuntimeToolExecutionScope, RuntimeToolGuardrailCircuitRuntimeState>,
    updated_at: u64,
    #[serde(default)]
    recent_completed_by_scope:
        HashMap<RuntimeToolExecutionScope, VecDeque<RuntimeToolExecutionStatus>>,
    #[serde(default)]
    computer_observe_hits_by_workspace: HashMap<String, VecDeque<u64>>,
}

impl RuntimeToolGuardrailPersistedState {
    fn empty(window_size: usize) -> Self {
        let updated_at = now_epoch_ms();
        let mut circuit_states = HashMap::new();
        for scope in RuntimeToolExecutionScope::ordered() {
            circuit_states.insert(scope, closed_circuit_state(scope, updated_at));
        }
        Self {
            window_size,
            payload_limit_bytes: DEFAULT_PAYLOAD_LIMIT_BYTES,
            computer_observe_rate_limit_per_minute: DEFAULT_COMPUTER_OBSERVE_RATE_LIMIT_PER_MINUTE,
            circuit_window_size: DEFAULT_CIRCUIT_WINDOW_SIZE,
            circuit_min_completed: DEFAULT_CIRCUIT_MIN_COMPLETED,
            circuit_open_ms: DEFAULT_CIRCUIT_OPEN_MS,
            half_open_max_probes: DEFAULT_HALF_OPEN_MAX_PROBES,
            half_open_required_successes: DEFAULT_HALF_OPEN_REQUIRED_SUCCESSES,
            channel_health: RuntimeToolExecutionChannelHealth {
                status: RuntimeToolExecutionChannelHealthStatus::Healthy,
                reason: None,
                last_error_code: None,
                updated_at: Some(updated_at),
            },
            circuit_states,
            updated_at,
            recent_completed_by_scope: HashMap::new(),
            computer_observe_hits_by_workspace: HashMap::new(),
        }
    }
}

pub(crate) struct RuntimeToolGuardrailStore {
    state: RuntimeToolGuardrailPersistedState,
    path: PathBuf,
}

impl RuntimeToolGuardrailStore {
    pub(crate) fn from_env(window_size: usize) -> Self {
        let path = resolve_guardrail_snapshot_path();
        Self::load_or_default(path, window_size)
    }

    #[cfg(test)]
    pub(crate) fn isolated_for_test(window_size: usize) -> Self {
        static COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

        let unique = COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed) + 1;
        let path = std::env::temp_dir().join(format!(
            "code-runtime-tool-guardrails-router-test-{}-{unique}.json",
            std::process::id()
        ));
        Self::with_path(path, window_size)
    }

    #[cfg(test)]
    fn with_path(path: PathBuf, window_size: usize) -> Self {
        Self::load_or_default(path, window_size)
    }

    fn load_or_default(path: PathBuf, window_size: usize) -> Self {
        let loaded = load_snapshot(path.as_path()).ok();
        let mut state =
            loaded.unwrap_or_else(|| RuntimeToolGuardrailPersistedState::empty(window_size));
        state.window_size = window_size.max(1);
        state.payload_limit_bytes = state.payload_limit_bytes.max(1);
        state.circuit_window_size = state.circuit_window_size.max(1);
        state.circuit_min_completed = state.circuit_min_completed.max(1);
        state.computer_observe_rate_limit_per_minute =
            state.computer_observe_rate_limit_per_minute.max(1);
        state.half_open_max_probes = state.half_open_max_probes.max(1);
        state.half_open_required_successes = state
            .half_open_required_successes
            .min(state.half_open_max_probes)
            .max(1);
        for scope in RuntimeToolExecutionScope::ordered() {
            state
                .circuit_states
                .entry(scope)
                .or_insert_with(|| closed_circuit_state(scope, state.updated_at));
            state.recent_completed_by_scope.entry(scope).or_default();
        }
        for history in state.recent_completed_by_scope.values_mut() {
            while history.len() > state.circuit_window_size {
                history.pop_front();
            }
        }
        Self { state, path }
    }

    pub(crate) fn read_snapshot(&self) -> RuntimeToolGuardrailStateSnapshot {
        RuntimeToolGuardrailStateSnapshot {
            window_size: self.state.window_size,
            payload_limit_bytes: self.state.payload_limit_bytes,
            computer_observe_rate_limit_per_minute: self
                .state
                .computer_observe_rate_limit_per_minute,
            circuit_window_size: self.state.circuit_window_size,
            circuit_min_completed: self.state.circuit_min_completed,
            circuit_open_ms: self.state.circuit_open_ms,
            half_open_max_probes: self.state.half_open_max_probes,
            half_open_required_successes: self.state.half_open_required_successes,
            channel_health: self.state.channel_health.clone(),
            circuit_breakers: RuntimeToolExecutionScope::ordered()
                .into_iter()
                .map(|scope| {
                    self.state
                        .circuit_states
                        .get(&scope)
                        .map(to_circuit_breaker_entry)
                        .unwrap_or_else(|| RuntimeToolExecutionCircuitBreakerEntry {
                            scope,
                            state: RuntimeToolExecutionCircuitBreakerState::Closed,
                            opened_at: None,
                            updated_at: self.state.updated_at,
                        })
                })
                .collect(),
            updated_at: self.state.updated_at,
        }
    }

    pub(crate) fn evaluate(
        &mut self,
        request: &RuntimeToolGuardrailEvaluateRequest,
    ) -> Result<RuntimeToolGuardrailEvaluateResult, String> {
        let now = request.at.unwrap_or_else(now_epoch_ms);
        self.state.updated_at = now;
        self.prune_rate_limit_window(now);
        self.refresh_open_circuit_if_cooldown_elapsed(request.scope, now);

        if self.state.channel_health.status != RuntimeToolExecutionChannelHealthStatus::Healthy {
            let result = self.blocked_result(
                request.scope,
                now,
                request,
                RuntimeToolGuardrailBlockReason::MetricsUnhealthy,
                Some("Guardrail channel is not healthy; runtime tool execution is fail-closed."),
            );
            persist_snapshot(self.path.as_path(), &self.state)?;
            return Ok(result);
        }

        let effective_payload_limit_bytes = self.effective_payload_limit_bytes(request);
        let effective_rate_limit = self.effective_computer_observe_rate_limit(request);
        if request.payload_bytes > u64::try_from(effective_payload_limit_bytes).unwrap_or(u64::MAX)
        {
            let result = self.blocked_result(
                request.scope,
                now,
                request,
                RuntimeToolGuardrailBlockReason::PayloadTooLarge,
                Some("Tool input payload exceeds runtime guardrail limit."),
            );
            persist_snapshot(self.path.as_path(), &self.state)?;
            return Ok(result);
        }

        if request.scope == RuntimeToolExecutionScope::ComputerObserve {
            let workspace_id = normalize_runtime_tool_text(request.workspace_id.as_deref())
                .unwrap_or_else(|| "__global__".to_string());
            let hits = self
                .state
                .computer_observe_hits_by_workspace
                .entry(workspace_id)
                .or_default();
            if hits.len() >= usize::try_from(effective_rate_limit).unwrap_or(usize::MAX) {
                let result = self.blocked_result(
                    request.scope,
                    now,
                    request,
                    RuntimeToolGuardrailBlockReason::RateLimited,
                    Some("Computer observe rate limit exceeded for workspace."),
                );
                persist_snapshot(self.path.as_path(), &self.state)?;
                return Ok(result);
            }
            hits.push_back(now);
        }

        let circuit = self
            .state
            .circuit_states
            .entry(request.scope)
            .or_insert_with(|| closed_circuit_state(request.scope, now));
        if circuit.state == RuntimeToolExecutionCircuitBreakerState::Open {
            let result = self.blocked_result(
                request.scope,
                now,
                request,
                RuntimeToolGuardrailBlockReason::CircuitOpen,
                Some("Runtime guardrail circuit is open for this tool scope."),
            );
            persist_snapshot(self.path.as_path(), &self.state)?;
            return Ok(result);
        }
        if circuit.state == RuntimeToolExecutionCircuitBreakerState::HalfOpen {
            if circuit.half_open_probe_attempts >= self.state.half_open_max_probes {
                transition_circuit_to_open(circuit, now);
                let result = self.blocked_result(
                    request.scope,
                    now,
                    request,
                    RuntimeToolGuardrailBlockReason::CircuitOpen,
                    Some("Runtime guardrail half-open probes exhausted."),
                );
                persist_snapshot(self.path.as_path(), &self.state)?;
                return Ok(result);
            }
            circuit.half_open_probe_attempts = circuit.half_open_probe_attempts.saturating_add(1);
            circuit.updated_at = now;
        }

        self.state.channel_health.status = RuntimeToolExecutionChannelHealthStatus::Healthy;
        self.state.channel_health.reason = None;
        self.state.channel_health.last_error_code = None;
        self.state.channel_health.updated_at = Some(now);
        persist_snapshot(self.path.as_path(), &self.state)?;

        Ok(RuntimeToolGuardrailEvaluateResult {
            allowed: true,
            block_reason: None,
            error_code: None,
            message: None,
            channel_health: self.state.channel_health.clone(),
            circuit_breaker: self
                .state
                .circuit_states
                .get(&request.scope)
                .map(to_circuit_breaker_entry),
            effective_payload_limit_bytes: u64::try_from(effective_payload_limit_bytes)
                .unwrap_or(u64::MAX),
            effective_computer_observe_rate_limit_per_minute: effective_rate_limit,
            updated_at: now,
        })
    }

    fn effective_payload_limit_bytes(
        &self,
        request: &RuntimeToolGuardrailEvaluateRequest,
    ) -> usize {
        self.state
            .payload_limit_bytes
            .saturating_mul(request.capability_profile.payload_limit_multiplier())
            .max(1)
    }

    fn effective_computer_observe_rate_limit(
        &self,
        request: &RuntimeToolGuardrailEvaluateRequest,
    ) -> u32 {
        self.state
            .computer_observe_rate_limit_per_minute
            .saturating_mul(
                request
                    .capability_profile
                    .computer_observe_rate_limit_multiplier(),
            )
            .max(1)
    }

    pub(crate) fn record_outcome(
        &mut self,
        event: &RuntimeToolGuardrailOutcomeEvent,
    ) -> Result<RuntimeToolGuardrailStateSnapshot, String> {
        let now = event.at;
        self.state.updated_at = now;
        let history = self
            .state
            .recent_completed_by_scope
            .entry(event.scope)
            .or_default();
        history.push_back(event.status);
        while history.len() > self.state.circuit_window_size {
            history.pop_front();
        }

        let circuit = self
            .state
            .circuit_states
            .entry(event.scope)
            .or_insert_with(|| closed_circuit_state(event.scope, now));
        if circuit.state == RuntimeToolExecutionCircuitBreakerState::HalfOpen {
            if event.status == RuntimeToolExecutionStatus::Success {
                circuit.half_open_probe_successes =
                    circuit.half_open_probe_successes.saturating_add(1);
            }
            circuit.updated_at = now;
            if circuit.half_open_probe_attempts >= self.state.half_open_max_probes {
                if circuit.half_open_probe_successes >= self.state.half_open_required_successes {
                    transition_circuit_to_closed(circuit, now);
                } else {
                    transition_circuit_to_open(circuit, now);
                }
            }
        } else {
            self.evaluate_circuit_threshold(event.scope, now);
        }

        self.state.channel_health.status = RuntimeToolExecutionChannelHealthStatus::Healthy;
        self.state.channel_health.reason = None;
        self.state.channel_health.last_error_code = None;
        self.state.channel_health.updated_at = Some(now);
        persist_snapshot(self.path.as_path(), &self.state)?;
        Ok(self.read_snapshot())
    }

    pub(crate) fn mark_channel_failure(
        &mut self,
        reason: &str,
        error_code: &str,
    ) -> Result<(), String> {
        let now = now_epoch_ms();
        self.state.updated_at = now;
        self.state.channel_health.status = RuntimeToolExecutionChannelHealthStatus::Unavailable;
        self.state.channel_health.reason = normalize_runtime_tool_text(Some(reason))
            .or_else(|| Some("Runtime guardrail channel failure".to_string()));
        self.state.channel_health.last_error_code = normalize_runtime_tool_text(Some(error_code));
        self.state.channel_health.updated_at = Some(now);
        persist_snapshot(self.path.as_path(), &self.state)
    }

    fn blocked_result(
        &self,
        scope: RuntimeToolExecutionScope,
        now: u64,
        request: &RuntimeToolGuardrailEvaluateRequest,
        reason: RuntimeToolGuardrailBlockReason,
        message: Option<&str>,
    ) -> RuntimeToolGuardrailEvaluateResult {
        let effective_payload_limit_bytes = self.effective_payload_limit_bytes(request);
        let effective_computer_observe_rate_limit_per_minute =
            self.effective_computer_observe_rate_limit(request);
        RuntimeToolGuardrailEvaluateResult {
            allowed: false,
            block_reason: Some(reason),
            error_code: Some(reason.code().to_string()),
            message: message.and_then(|value| normalize_runtime_tool_text(Some(value))),
            channel_health: self.state.channel_health.clone(),
            circuit_breaker: self
                .state
                .circuit_states
                .get(&scope)
                .map(to_circuit_breaker_entry),
            effective_payload_limit_bytes: u64::try_from(effective_payload_limit_bytes)
                .unwrap_or(u64::MAX),
            effective_computer_observe_rate_limit_per_minute,
            updated_at: now,
        }
    }

    fn evaluate_circuit_threshold(&mut self, scope: RuntimeToolExecutionScope, now: u64) {
        let Some(history) = self.state.recent_completed_by_scope.get(&scope) else {
            return;
        };
        let mut success_total = 0_u64;
        let mut failure_total = 0_u64;
        for status in history.iter() {
            match status {
                RuntimeToolExecutionStatus::Success => {
                    success_total = success_total.saturating_add(1)
                }
                RuntimeToolExecutionStatus::ValidationFailed
                | RuntimeToolExecutionStatus::RuntimeFailed
                | RuntimeToolExecutionStatus::Timeout => {
                    failure_total = failure_total.saturating_add(1);
                }
                RuntimeToolExecutionStatus::Blocked => {}
            }
        }
        let denominator = success_total.saturating_add(failure_total);
        if denominator < u64::try_from(self.state.circuit_min_completed).unwrap_or(u64::MAX) {
            return;
        }
        let success_rate = if denominator > 0 {
            success_total as f64 / denominator as f64
        } else {
            1.0
        };
        if success_rate < 0.8 {
            if let Some(circuit) = self.state.circuit_states.get_mut(&scope) {
                transition_circuit_to_open(circuit, now);
            }
        }
    }

    fn prune_rate_limit_window(&mut self, now: u64) {
        let window_start = now.saturating_sub(RATE_LIMIT_WINDOW_MS);
        self.state
            .computer_observe_hits_by_workspace
            .retain(|_, hits| {
                while let Some(first) = hits.front().copied() {
                    if first >= window_start {
                        break;
                    }
                    hits.pop_front();
                }
                !hits.is_empty()
            });
    }

    fn refresh_open_circuit_if_cooldown_elapsed(
        &mut self,
        scope: RuntimeToolExecutionScope,
        now: u64,
    ) {
        let Some(circuit) = self.state.circuit_states.get_mut(&scope) else {
            return;
        };
        if circuit.state != RuntimeToolExecutionCircuitBreakerState::Open {
            return;
        }
        let Some(opened_at) = circuit.opened_at else {
            return;
        };
        if now.saturating_sub(opened_at) < self.state.circuit_open_ms {
            return;
        }
        transition_circuit_to_half_open(circuit, now);
    }
}

pub(crate) fn parse_runtime_tool_guardrail_evaluate_request(
    params: &Value,
) -> Result<RuntimeToolGuardrailEvaluateRequest, RpcError> {
    let params = as_object(params)?;
    let tool_name = read_required_string(params, "toolName")
        .map_err(|_| RpcError::invalid_params("toolName is required."))?
        .trim()
        .to_string();
    if tool_name.is_empty() {
        return Err(RpcError::invalid_params("toolName is required."));
    }
    let scope = read_required_string(params, "scope")
        .map_err(|_| RpcError::invalid_params("scope is required."))?;
    let scope = parse_runtime_tool_execution_scope(scope)
        .map_err(|error| RpcError::invalid_params(format!("scope {error}")))?;
    let payload_bytes = params
        .get("payload")
        .and_then(|payload| serde_json::to_vec(payload).ok())
        .map(|bytes| bytes.len())
        .and_then(|len| u64::try_from(len).ok())
        .or_else(|| read_optional_u64(params, "payloadBytes"))
        .ok_or_else(|| RpcError::invalid_params("payloadBytes is required."))?;
    let workspace_id =
        normalize_runtime_tool_text(read_optional_string(params, "workspaceId").as_deref());
    let trace_id = normalize_runtime_tool_text(read_optional_string(params, "traceId").as_deref());
    let span_id = normalize_runtime_tool_text(read_optional_string(params, "spanId").as_deref());
    if trace_id.is_some() && span_id.is_none() {
        return Err(RpcError::invalid_params(
            "spanId is required when traceId is provided.",
        ));
    }
    Ok(RuntimeToolGuardrailEvaluateRequest {
        tool_name,
        scope,
        workspace_id,
        payload_bytes,
        at: read_optional_u64(params, "at"),
        request_id: normalize_runtime_tool_text(
            read_optional_string(params, "requestId").as_deref(),
        ),
        trace_id,
        span_id,
        parent_span_id: normalize_runtime_tool_text(
            read_optional_string(params, "parentSpanId").as_deref(),
        ),
        planner_step_key: normalize_runtime_tool_text(
            read_optional_string(params, "plannerStepKey").as_deref(),
        ),
        attempt: read_optional_u64(params, "attempt").and_then(|value| u32::try_from(value).ok()),
        capability_profile: RuntimeToolGuardrailCapabilityProfile::from_optional_str(
            read_optional_string(params, "capabilityProfile").as_deref(),
        ),
    })
}

pub(crate) fn parse_runtime_tool_guardrail_outcome_event(
    params: &Value,
) -> Result<RuntimeToolGuardrailOutcomeEvent, RpcError> {
    let params = as_object(params)?;
    let event = params
        .get("event")
        .and_then(Value::as_object)
        .ok_or_else(|| RpcError::invalid_params("event object is required."))?;
    let tool_name = read_required_string(event, "toolName")
        .map_err(|_| RpcError::invalid_params("event.toolName is required."))?
        .trim()
        .to_string();
    if tool_name.is_empty() {
        return Err(RpcError::invalid_params("event.toolName is required."));
    }
    let scope = parse_runtime_tool_execution_scope(
        read_required_string(event, "scope")
            .map_err(|_| RpcError::invalid_params("event.scope is required."))?,
    )
    .map_err(|error| RpcError::invalid_params(format!("event.scope {error}")))?;
    let status = parse_runtime_tool_execution_status(
        read_required_string(event, "status")
            .map_err(|_| RpcError::invalid_params("event.status is required."))?,
    )
    .map_err(|error| RpcError::invalid_params(format!("event.status {error}")))?;
    let at = read_optional_u64(event, "at")
        .ok_or_else(|| RpcError::invalid_params("event.at must be a non-negative integer."))?;
    let trace_id = normalize_runtime_tool_text(read_optional_string(event, "traceId").as_deref());
    let span_id = normalize_runtime_tool_text(read_optional_string(event, "spanId").as_deref());
    if trace_id.is_some() && span_id.is_none() {
        return Err(RpcError::invalid_params(
            "event.spanId is required when event.traceId is provided.",
        ));
    }
    Ok(RuntimeToolGuardrailOutcomeEvent {
        tool_name,
        scope,
        status,
        at,
        workspace_id: normalize_runtime_tool_text(
            read_optional_string(event, "workspaceId").as_deref(),
        ),
        duration_ms: read_optional_u64(event, "durationMs"),
        error_code: normalize_runtime_tool_text(
            read_optional_string(event, "errorCode").as_deref(),
        ),
        request_id: normalize_runtime_tool_text(
            read_optional_string(event, "requestId").as_deref(),
        ),
        trace_id,
        span_id,
        parent_span_id: normalize_runtime_tool_text(
            read_optional_string(event, "parentSpanId").as_deref(),
        ),
        planner_step_key: normalize_runtime_tool_text(
            read_optional_string(event, "plannerStepKey").as_deref(),
        ),
        attempt: read_optional_u64(event, "attempt").and_then(|value| u32::try_from(value).ok()),
    })
}

fn closed_circuit_state(
    scope: RuntimeToolExecutionScope,
    now: u64,
) -> RuntimeToolGuardrailCircuitRuntimeState {
    RuntimeToolGuardrailCircuitRuntimeState {
        scope,
        state: RuntimeToolExecutionCircuitBreakerState::Closed,
        opened_at: None,
        updated_at: now,
        half_open_probe_attempts: 0,
        half_open_probe_successes: 0,
    }
}

fn transition_circuit_to_open(circuit: &mut RuntimeToolGuardrailCircuitRuntimeState, now: u64) {
    circuit.state = RuntimeToolExecutionCircuitBreakerState::Open;
    circuit.opened_at = Some(now);
    circuit.updated_at = now;
    circuit.half_open_probe_attempts = 0;
    circuit.half_open_probe_successes = 0;
}

fn transition_circuit_to_half_open(
    circuit: &mut RuntimeToolGuardrailCircuitRuntimeState,
    now: u64,
) {
    circuit.state = RuntimeToolExecutionCircuitBreakerState::HalfOpen;
    circuit.updated_at = now;
    circuit.half_open_probe_attempts = 0;
    circuit.half_open_probe_successes = 0;
}

fn transition_circuit_to_closed(circuit: &mut RuntimeToolGuardrailCircuitRuntimeState, now: u64) {
    circuit.state = RuntimeToolExecutionCircuitBreakerState::Closed;
    circuit.opened_at = None;
    circuit.updated_at = now;
    circuit.half_open_probe_attempts = 0;
    circuit.half_open_probe_successes = 0;
}

fn to_circuit_breaker_entry(
    state: &RuntimeToolGuardrailCircuitRuntimeState,
) -> RuntimeToolExecutionCircuitBreakerEntry {
    RuntimeToolExecutionCircuitBreakerEntry {
        scope: state.scope,
        state: state.state.clone(),
        opened_at: state.opened_at,
        updated_at: state.updated_at,
    }
}

fn resolve_guardrail_snapshot_path() -> PathBuf {
    if let Some(path) = std::env::var(CODE_RUNTIME_TOOL_GUARDRAILS_PATH_ENV)
        .ok()
        .and_then(|value| normalize_runtime_tool_text(Some(value.as_str())))
    {
        return PathBuf::from(path);
    }

    let home = std::env::var("HOME")
        .ok()
        .or_else(|| std::env::var("USERPROFILE").ok());
    if let Some(home_dir) = home {
        let target = PathBuf::from(home_dir)
            .join(DEFAULT_RUNTIME_TOOL_GUARDRAILS_DIR_NAME)
            .join(DEFAULT_RUNTIME_TOOL_GUARDRAILS_FILE_NAME);
        if let Err(error) = migrate_legacy_guardrail_snapshot_if_needed(target.as_path()) {
            eprintln!(
                "runtime tool guardrail legacy migration failed for `{}`: {}",
                target.display(),
                error
            );
        }
        return target;
    }

    let target = std::env::temp_dir()
        .join(DEFAULT_RUNTIME_TOOL_GUARDRAILS_DIR_NAME)
        .join(DEFAULT_RUNTIME_TOOL_GUARDRAILS_FILE_NAME);
    if let Err(error) = migrate_legacy_guardrail_snapshot_if_needed(target.as_path()) {
        eprintln!(
            "runtime tool guardrail legacy migration failed for `{}`: {}",
            target.display(),
            error
        );
    }
    target
}

fn migrate_legacy_guardrail_snapshot_if_needed(path: &Path) -> Result<(), String> {
    if path.exists() {
        return Ok(());
    }
    let Some(source) = legacy_guardrail_snapshot_paths()
        .into_iter()
        .find(|candidate| candidate != path && candidate.exists())
    else {
        return Ok(());
    };

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "create runtime tool guardrail directory `{}`: {error}",
                parent.display()
            )
        })?;
    }
    fs::copy(source.as_path(), path).map_err(|error| {
        format!(
            "copy runtime tool guardrail snapshot `{}` to `{}` failed: {error}",
            source.display(),
            path.display()
        )
    })?;
    Ok(())
}

fn legacy_guardrail_snapshot_paths() -> Vec<PathBuf> {
    const LEGACY_DIR_NAMES: &[&str] = &[".code-runtime-service-rs", ".code-runtime-service"];

    let mut paths = Vec::new();
    if let Some(home_dir) = std::env::var("HOME")
        .ok()
        .or_else(|| std::env::var("USERPROFILE").ok())
    {
        let home_dir = home_dir.trim();
        if !home_dir.is_empty() {
            let home_dir = PathBuf::from(home_dir);
            for dir_name in LEGACY_DIR_NAMES {
                paths.push(
                    home_dir
                        .join(dir_name)
                        .join(DEFAULT_RUNTIME_TOOL_GUARDRAILS_FILE_NAME),
                );
            }
        }
    }

    let temp_dir = std::env::temp_dir();
    for dir_name in LEGACY_DIR_NAMES {
        paths.push(
            temp_dir
                .join(dir_name)
                .join(DEFAULT_RUNTIME_TOOL_GUARDRAILS_FILE_NAME),
        );
    }
    paths
}

fn load_snapshot(path: &Path) -> Result<RuntimeToolGuardrailPersistedState, String> {
    let raw = fs::read_to_string(path).map_err(|error| {
        format!(
            "read runtime tool guardrail snapshot `{}`: {error}",
            path.display()
        )
    })?;
    serde_json::from_str::<RuntimeToolGuardrailPersistedState>(raw.as_str()).map_err(|error| {
        format!(
            "parse runtime tool guardrail snapshot `{}`: {error}",
            path.display()
        )
    })
}

fn persist_snapshot(
    path: &Path,
    snapshot: &RuntimeToolGuardrailPersistedState,
) -> Result<(), String> {
    persist_compact_json_snapshot(path, snapshot, "runtime tool guardrail")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_guardrail_path(test_name: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "code-runtime-tool-guardrails-{test_name}-{}.json",
            Uuid::new_v4()
        ))
    }

    fn evaluate_request(
        scope: RuntimeToolExecutionScope,
        payload_bytes: u64,
    ) -> RuntimeToolGuardrailEvaluateRequest {
        RuntimeToolGuardrailEvaluateRequest {
            tool_name: "test-tool".to_string(),
            scope,
            workspace_id: Some("ws-1".to_string()),
            payload_bytes,
            at: Some(100),
            request_id: None,
            trace_id: None,
            span_id: None,
            parent_span_id: None,
            planner_step_key: None,
            attempt: None,
            capability_profile: RuntimeToolGuardrailCapabilityProfile::Default,
        }
    }

    #[test]
    fn solo_max_profile_relaxes_payload_limit() {
        let path = temp_guardrail_path("solo-max-payload");
        let mut store = RuntimeToolGuardrailStore::with_path(path.clone(), 500);
        let mut request = evaluate_request(
            RuntimeToolExecutionScope::Runtime,
            (DEFAULT_PAYLOAD_LIMIT_BYTES as u64).saturating_add(1),
        );
        request.capability_profile = RuntimeToolGuardrailCapabilityProfile::SoloMax;
        let result = store.evaluate(&request).expect("evaluate");
        assert!(result.allowed);
        let _ = fs::remove_file(path);
    }

    #[test]
    fn parse_evaluate_supports_solo_max_capability_profile() {
        let params = serde_json::json!({
            "toolName": "execute-workspace-command",
            "scope": "runtime",
            "payloadBytes": 12,
            "capabilityProfile": "solo-max"
        });
        let request = parse_runtime_tool_guardrail_evaluate_request(&params)
            .expect("parse capability profile");
        assert_eq!(
            request.capability_profile,
            RuntimeToolGuardrailCapabilityProfile::SoloMax
        );
    }

    #[test]
    fn blocks_payloads_over_limit() {
        let path = temp_guardrail_path("payload-limit");
        let mut store = RuntimeToolGuardrailStore::with_path(path.clone(), 500);
        let result = store
            .evaluate(&evaluate_request(
                RuntimeToolExecutionScope::Runtime,
                (DEFAULT_PAYLOAD_LIMIT_BYTES as u64).saturating_add(1),
            ))
            .expect("evaluate");
        assert!(!result.allowed);
        assert_eq!(
            result.block_reason,
            Some(RuntimeToolGuardrailBlockReason::PayloadTooLarge)
        );
        let _ = fs::remove_file(path);
    }

    #[test]
    fn applies_computer_observe_rate_limit() {
        let path = temp_guardrail_path("rate-limit");
        let mut store = RuntimeToolGuardrailStore::with_path(path.clone(), 500);
        for index in 0..DEFAULT_COMPUTER_OBSERVE_RATE_LIMIT_PER_MINUTE {
            let mut request = evaluate_request(RuntimeToolExecutionScope::ComputerObserve, 32);
            request.at = Some(100 + u64::from(index));
            let result = store.evaluate(&request).expect("evaluate allowed");
            assert!(result.allowed);
        }

        let mut blocked_request = evaluate_request(RuntimeToolExecutionScope::ComputerObserve, 32);
        blocked_request.at = Some(200);
        let blocked = store.evaluate(&blocked_request).expect("evaluate blocked");
        assert!(!blocked.allowed);
        assert_eq!(
            blocked.block_reason,
            Some(RuntimeToolGuardrailBlockReason::RateLimited)
        );
        let _ = fs::remove_file(path);
    }

    #[test]
    fn opens_circuit_on_low_success_rate() {
        let path = temp_guardrail_path("circuit-open");
        let mut store = RuntimeToolGuardrailStore::with_path(path.clone(), 500);
        for index in 0..20_u64 {
            let status = if index < 5 {
                RuntimeToolExecutionStatus::Success
            } else {
                RuntimeToolExecutionStatus::RuntimeFailed
            };
            store
                .record_outcome(&RuntimeToolGuardrailOutcomeEvent {
                    tool_name: "execute-workspace-command".to_string(),
                    scope: RuntimeToolExecutionScope::Runtime,
                    status,
                    at: 1_000 + index,
                    workspace_id: Some("ws-1".to_string()),
                    duration_ms: None,
                    error_code: None,
                    request_id: None,
                    trace_id: None,
                    span_id: None,
                    parent_span_id: None,
                    planner_step_key: None,
                    attempt: None,
                })
                .expect("record outcome");
        }
        let result = store
            .evaluate(&evaluate_request(RuntimeToolExecutionScope::Runtime, 32))
            .expect("evaluate");
        assert!(!result.allowed);
        assert_eq!(
            result.block_reason,
            Some(RuntimeToolGuardrailBlockReason::CircuitOpen)
        );
        let _ = fs::remove_file(path);
    }

    #[test]
    fn recovers_from_persisted_snapshot() {
        let path = temp_guardrail_path("recover");
        let mut store = RuntimeToolGuardrailStore::with_path(path.clone(), 500);
        store
            .record_outcome(&RuntimeToolGuardrailOutcomeEvent {
                tool_name: "write-workspace-file".to_string(),
                scope: RuntimeToolExecutionScope::Write,
                status: RuntimeToolExecutionStatus::Success,
                at: 120,
                workspace_id: Some("ws-1".to_string()),
                duration_ms: None,
                error_code: None,
                request_id: None,
                trace_id: None,
                span_id: None,
                parent_span_id: None,
                planner_step_key: None,
                attempt: None,
            })
            .expect("record outcome");
        let recovered = RuntimeToolGuardrailStore::with_path(path.clone(), 500);
        let snapshot = recovered.read_snapshot();
        assert_eq!(snapshot.window_size, 500);
        assert_eq!(
            snapshot.channel_health.status,
            RuntimeToolExecutionChannelHealthStatus::Healthy
        );
        let _ = fs::remove_file(path);
    }

    #[test]
    fn persists_guardrail_snapshot_as_compact_json() {
        let path = temp_guardrail_path("compact");
        let store = RuntimeToolGuardrailStore::with_path(path.clone(), 500);

        persist_snapshot(path.as_path(), &store.state).expect("persist guardrail snapshot");

        let raw = fs::read_to_string(path.as_path()).expect("read guardrail snapshot");
        assert_eq!(
            raw,
            serde_json::to_string(&store.state).expect("serialize compact guardrail snapshot")
        );
        let loaded = load_snapshot(path.as_path()).expect("reload guardrail snapshot");
        assert_eq!(loaded, store.state);

        let _ = fs::remove_file(path);
    }

    #[test]
    fn parse_evaluate_rejects_trace_id_without_span_id() {
        let params = serde_json::json!({
            "toolName": "execute-workspace-command",
            "scope": "runtime",
            "payloadBytes": 12,
            "traceId": "trace-1"
        });
        let error = parse_runtime_tool_guardrail_evaluate_request(&params)
            .expect_err("traceId without spanId must fail");
        let rendered = format!("{error:?}");
        assert!(rendered.contains("InvalidParams"));
        assert!(rendered.contains("spanId is required"));
    }

    #[test]
    fn parse_outcome_rejects_trace_id_without_span_id() {
        let params = serde_json::json!({
            "event": {
                "toolName": "execute-workspace-command",
                "scope": "runtime",
                "status": "runtime_failed",
                "at": 42,
                "traceId": "trace-1"
            }
        });
        let error = parse_runtime_tool_guardrail_outcome_event(&params)
            .expect_err("event traceId without spanId must fail");
        let rendered = format!("{error:?}");
        assert!(rendered.contains("InvalidParams"));
        assert!(rendered.contains("spanId is required"));
    }
}
