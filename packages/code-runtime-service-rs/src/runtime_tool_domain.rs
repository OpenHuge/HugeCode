use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum RuntimeToolExecutionStatus {
    Success,
    ValidationFailed,
    RuntimeFailed,
    Timeout,
    Blocked,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub(crate) enum RuntimeToolExecutionScope {
    Write,
    Runtime,
    ComputerObserve,
}

impl RuntimeToolExecutionScope {
    pub(crate) fn ordered() -> [Self; 3] {
        [Self::Write, Self::Runtime, Self::ComputerObserve]
    }

    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Write => "write",
            Self::Runtime => "runtime",
            Self::ComputerObserve => "computer_observe",
        }
    }
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum RuntimeToolExecutionEventPhase {
    Attempted,
    Started,
    Completed,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeToolExecutionEvent {
    pub(crate) tool_name: String,
    pub(crate) scope: RuntimeToolExecutionScope,
    pub(crate) phase: RuntimeToolExecutionEventPhase,
    pub(crate) at: u64,
    #[serde(default)]
    pub(crate) status: Option<RuntimeToolExecutionStatus>,
    #[serde(default)]
    pub(crate) error_code: Option<String>,
    #[serde(default)]
    pub(crate) duration_ms: Option<u64>,
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

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum RuntimeToolExecutionChannelHealthStatus {
    Healthy,
    Degraded,
    Unavailable,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeToolExecutionChannelHealth {
    pub(crate) status: RuntimeToolExecutionChannelHealthStatus,
    #[serde(default)]
    pub(crate) reason: Option<String>,
    #[serde(default)]
    pub(crate) last_error_code: Option<String>,
    #[serde(default)]
    pub(crate) updated_at: Option<u64>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum RuntimeToolExecutionCircuitBreakerState {
    Closed,
    Open,
    HalfOpen,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeToolExecutionCircuitBreakerEntry {
    pub(crate) scope: RuntimeToolExecutionScope,
    pub(crate) state: RuntimeToolExecutionCircuitBreakerState,
    #[serde(default)]
    pub(crate) opened_at: Option<u64>,
    pub(crate) updated_at: u64,
}

pub(crate) fn parse_runtime_tool_execution_scope(
    value: &str,
) -> Result<RuntimeToolExecutionScope, String> {
    match value.trim() {
        "write" => Ok(RuntimeToolExecutionScope::Write),
        "runtime" => Ok(RuntimeToolExecutionScope::Runtime),
        "computer_observe" => Ok(RuntimeToolExecutionScope::ComputerObserve),
        _ => Err("must be one of write|runtime|computer_observe.".to_string()),
    }
}

pub(crate) fn parse_runtime_tool_execution_phase(
    value: &str,
) -> Result<RuntimeToolExecutionEventPhase, String> {
    match value.trim() {
        "attempted" => Ok(RuntimeToolExecutionEventPhase::Attempted),
        "started" => Ok(RuntimeToolExecutionEventPhase::Started),
        "completed" => Ok(RuntimeToolExecutionEventPhase::Completed),
        _ => Err("must be one of attempted|started|completed.".to_string()),
    }
}

pub(crate) fn parse_runtime_tool_execution_status(
    value: &str,
) -> Result<RuntimeToolExecutionStatus, String> {
    match value.trim() {
        "success" => Ok(RuntimeToolExecutionStatus::Success),
        "validation_failed" => Ok(RuntimeToolExecutionStatus::ValidationFailed),
        "runtime_failed" => Ok(RuntimeToolExecutionStatus::RuntimeFailed),
        "timeout" => Ok(RuntimeToolExecutionStatus::Timeout),
        "blocked" => Ok(RuntimeToolExecutionStatus::Blocked),
        _ => Err(
            "must be one of success|validation_failed|runtime_failed|timeout|blocked.".to_string(),
        ),
    }
}

pub(crate) fn normalize_runtime_tool_text(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(ToOwned::to_owned)
}
