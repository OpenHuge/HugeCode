use super::*;
use rusqlite::Connection;
use std::sync::{
    atomic::{AtomicBool, AtomicU64, Ordering},
    Mutex,
};
use tracing::warn;

#[path = "agent_task_durability_checkpoint.rs"]
mod checkpoint_dispatch;
#[path = "agent_task_durability_sqlite.rs"]
mod sqlite_backend;

use crate::runtime_checkpoint::{
    build_runtime_checkpoint_summary, resolve_runtime_checkpoint_resume_ready,
};
use checkpoint_dispatch::{
    spawn_agent_task_snapshot_checkpoint, spawn_sub_agent_snapshot_checkpoint,
    spawn_tool_call_snapshot_checkpoint,
};
use sqlite_backend::{open_durability_sqlite, resolve_agent_task_durability_db_path};

const AGENT_TASK_DURABILITY_MODE_ENV: &str = "CODE_RUNTIME_SERVICE_AGENT_DURABILITY";
const AGENT_TASK_DURABILITY_DB_PATH_ENV: &str = "CODE_RUNTIME_SERVICE_AGENT_DURABILITY_DB";
const AGENT_TASK_DURABILITY_MODE_OFF: &str = "off";
const AGENT_TASK_DURABILITY_MODE_ACTIVE: &str = "active";
const AGENT_TASK_DURABILITY_SCHEMA_VERSION: u32 = 1;
const AGENT_TASK_DURABILITY_DEFAULT_RECOVERY_LIMIT: usize = 256;
const AGENT_TASK_DURABILITY_WRITE_FAILURE_CIRCUIT_BREAKER: u64 = 5;
const AGENT_TASK_DURABILITY_ERROR_CODE_RECOVERY_INTERRUPTED: &str = "RUNTIME_RESTART_RECOVERY";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum AgentTaskDurabilityMode {
    Off,
    Active,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct AgentTaskRuntimeSnapshot {
    version: u32,
    checkpoint_id: String,
    trace_id: String,
    lifecycle_state: String,
    task_id: String,
    workspace_id: String,
    status: String,
    summary: AgentTaskSummary,
    steps_input: Vec<AgentTaskStepInput>,
    interrupt_requested: bool,
    #[serde(default)]
    review_actionability: Option<Value>,
    #[serde(default)]
    execution_graph: Option<RuntimeExecutionGraphSummary>,
    #[serde(default)]
    takeover_bundle: Option<Value>,
    recovered: bool,
    updated_at: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct SubAgentSessionRuntimeSnapshot {
    version: u32,
    checkpoint_id: String,
    trace_id: String,
    lifecycle_state: String,
    session_id: String,
    workspace_id: String,
    summary: sub_agents::SubAgentSessionSummary,
    #[serde(default)]
    execution_node: Option<RuntimeExecutionNodeSummary>,
    #[serde(default)]
    execution_edge: Option<RuntimeExecutionEdgeSummary>,
    closed: bool,
    recovered: bool,
    updated_at: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct ToolCallLifecycleSnapshot {
    version: u32,
    checkpoint_id: String,
    trace_id: String,
    lifecycle_state: String,
    task_id: String,
    workspace_id: String,
    tool_call_id: String,
    tool_name: String,
    batch_id: Option<String>,
    attempt: Option<u32>,
    ok: Option<bool>,
    error_class: Option<String>,
    duration_ms: Option<u64>,
    recovered: bool,
    payload: Value,
    updated_at: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct AgentTaskDurabilityMetricsSnapshot {
    mode: String,
    degraded: bool,
    checkpoint_write_total: u64,
    checkpoint_write_failed_total: u64,
    agent_task_checkpoint_recover_total: u64,
    subagent_checkpoint_recover_total: u64,
    runtime_recovery_interrupt_total: u64,
    agent_task_resume_total: u64,
    agent_task_resume_failed_total: u64,
}

#[derive(Default)]
pub(super) struct DurableRuntimeRecoveryState {
    pub(super) agent_tasks: AgentTaskStore,
    pub(super) sub_agent_sessions: sub_agents::SubAgentSessionStore,
    pub(super) queued_task_ids: Vec<String>,
}

pub(super) struct AgentTaskDurabilityStore {
    mode: AgentTaskDurabilityMode,
    conn: Option<Mutex<Connection>>,
    startup_error: Option<String>,
    degraded: AtomicBool,
    consecutive_write_failures: AtomicU64,
    checkpoint_write_total: AtomicU64,
    checkpoint_write_failed_total: AtomicU64,
    agent_task_checkpoint_recover_total: AtomicU64,
    subagent_checkpoint_recover_total: AtomicU64,
    runtime_recovery_interrupt_total: AtomicU64,
    agent_task_resume_total: AtomicU64,
    agent_task_resume_failed_total: AtomicU64,
}

impl AgentTaskDurabilityStore {
    fn off() -> Self {
        Self {
            mode: AgentTaskDurabilityMode::Off,
            conn: None,
            startup_error: None,
            degraded: AtomicBool::new(false),
            consecutive_write_failures: AtomicU64::new(0),
            checkpoint_write_total: AtomicU64::new(0),
            checkpoint_write_failed_total: AtomicU64::new(0),
            agent_task_checkpoint_recover_total: AtomicU64::new(0),
            subagent_checkpoint_recover_total: AtomicU64::new(0),
            runtime_recovery_interrupt_total: AtomicU64::new(0),
            agent_task_resume_total: AtomicU64::new(0),
            agent_task_resume_failed_total: AtomicU64::new(0),
        }
    }

    fn unavailable(startup_error: impl Into<String>) -> Self {
        Self {
            mode: AgentTaskDurabilityMode::Active,
            conn: None,
            startup_error: Some(startup_error.into()),
            degraded: AtomicBool::new(true),
            consecutive_write_failures: AtomicU64::new(0),
            checkpoint_write_total: AtomicU64::new(0),
            checkpoint_write_failed_total: AtomicU64::new(0),
            agent_task_checkpoint_recover_total: AtomicU64::new(0),
            subagent_checkpoint_recover_total: AtomicU64::new(0),
            runtime_recovery_interrupt_total: AtomicU64::new(0),
            agent_task_resume_total: AtomicU64::new(0),
            agent_task_resume_failed_total: AtomicU64::new(0),
        }
    }

    fn with_conn(conn: Connection) -> Self {
        Self {
            mode: AgentTaskDurabilityMode::Active,
            conn: Some(Mutex::new(conn)),
            startup_error: None,
            degraded: AtomicBool::new(false),
            consecutive_write_failures: AtomicU64::new(0),
            checkpoint_write_total: AtomicU64::new(0),
            checkpoint_write_failed_total: AtomicU64::new(0),
            agent_task_checkpoint_recover_total: AtomicU64::new(0),
            subagent_checkpoint_recover_total: AtomicU64::new(0),
            runtime_recovery_interrupt_total: AtomicU64::new(0),
            agent_task_resume_total: AtomicU64::new(0),
            agent_task_resume_failed_total: AtomicU64::new(0),
        }
    }

    pub(super) fn is_active(&self) -> bool {
        self.mode == AgentTaskDurabilityMode::Active
    }

    pub(super) fn is_degraded(&self) -> bool {
        self.degraded.load(Ordering::Relaxed)
    }

    fn mode_label(&self) -> &'static str {
        match self.mode {
            AgentTaskDurabilityMode::Off => AGENT_TASK_DURABILITY_MODE_OFF,
            AgentTaskDurabilityMode::Active => AGENT_TASK_DURABILITY_MODE_ACTIVE,
        }
    }

    fn should_persist(&self) -> bool {
        self.is_active() && self.conn.is_some() && !self.is_degraded()
    }

    fn record_checkpoint_write_success(&self) {
        self.checkpoint_write_total.fetch_add(1, Ordering::Relaxed);
        self.consecutive_write_failures.store(0, Ordering::Relaxed);
    }

    fn record_checkpoint_write_failure(&self) -> bool {
        self.checkpoint_write_total.fetch_add(1, Ordering::Relaxed);
        self.checkpoint_write_failed_total
            .fetch_add(1, Ordering::Relaxed);
        let failures = self
            .consecutive_write_failures
            .fetch_add(1, Ordering::Relaxed)
            + 1;
        if failures < AGENT_TASK_DURABILITY_WRITE_FAILURE_CIRCUIT_BREAKER {
            return false;
        }
        !self.degraded.swap(true, Ordering::Relaxed)
    }

    fn record_agent_task_checkpoint_recover_total(&self, count: u64) {
        if count > 0 {
            self.agent_task_checkpoint_recover_total
                .fetch_add(count, Ordering::Relaxed);
        }
    }

    fn record_subagent_checkpoint_recover_total(&self, count: u64) {
        if count > 0 {
            self.subagent_checkpoint_recover_total
                .fetch_add(count, Ordering::Relaxed);
        }
    }

    fn record_runtime_recovery_interrupt(&self) {
        self.runtime_recovery_interrupt_total
            .fetch_add(1, Ordering::Relaxed);
    }

    pub(super) fn record_agent_task_resume(&self, accepted: bool) {
        self.agent_task_resume_total.fetch_add(1, Ordering::Relaxed);
        if !accepted {
            self.agent_task_resume_failed_total
                .fetch_add(1, Ordering::Relaxed);
        }
    }

    pub(super) fn metrics_snapshot(&self) -> AgentTaskDurabilityMetricsSnapshot {
        AgentTaskDurabilityMetricsSnapshot {
            mode: self.mode_label().to_string(),
            degraded: self.is_degraded(),
            checkpoint_write_total: self.checkpoint_write_total.load(Ordering::Relaxed),
            checkpoint_write_failed_total: self
                .checkpoint_write_failed_total
                .load(Ordering::Relaxed),
            agent_task_checkpoint_recover_total: self
                .agent_task_checkpoint_recover_total
                .load(Ordering::Relaxed),
            subagent_checkpoint_recover_total: self
                .subagent_checkpoint_recover_total
                .load(Ordering::Relaxed),
            runtime_recovery_interrupt_total: self
                .runtime_recovery_interrupt_total
                .load(Ordering::Relaxed),
            agent_task_resume_total: self.agent_task_resume_total.load(Ordering::Relaxed),
            agent_task_resume_failed_total: self
                .agent_task_resume_failed_total
                .load(Ordering::Relaxed),
        }
    }
}

pub(super) fn build_agent_task_durability_store(
    config: &ServiceConfig,
) -> AgentTaskDurabilityStore {
    let mode = resolve_agent_task_durability_mode();
    if mode == AgentTaskDurabilityMode::Off {
        return AgentTaskDurabilityStore::off();
    }

    let Some(path) = resolve_agent_task_durability_db_path(config) else {
        return AgentTaskDurabilityStore::unavailable("Failed to resolve durability sqlite path.");
    };
    let conn = match open_durability_sqlite(path.as_path()) {
        Ok(conn) => conn,
        Err(error) => {
            warn!(
                error = error.as_str(),
                "agent task durability sqlite initialization failed; runtime will remain memory-only"
            );
            return AgentTaskDurabilityStore::unavailable(error);
        }
    };
    AgentTaskDurabilityStore::with_conn(conn)
}

pub(super) fn bootstrap_durable_runtime_state(
    config: &ServiceConfig,
) -> (
    Arc<AgentTaskDurabilityStore>,
    DurableRuntimeRecoveryState,
    Vec<String>,
) {
    let durability = Arc::new(build_agent_task_durability_store(config));
    let recovered =
        recover_durable_runtime_state(durability.as_ref(), config.agent_task_history_limit);
    if !recovered.agent_tasks.tasks.is_empty() || !recovered.sub_agent_sessions.sessions.is_empty()
    {
        tracing::info!(
            recovered_tasks = recovered.agent_tasks.tasks.len(),
            recovered_sub_agents = recovered.sub_agent_sessions.sessions.len(),
            queued_for_restart = recovered.queued_task_ids.len(),
            "recovered agent runtime durability snapshots"
        );
    }
    let queued = recovered.queued_task_ids.clone();
    (durability, recovered, queued)
}

pub(super) fn build_agent_task_durability_diagnostics_payload(
    durability: &AgentTaskDurabilityStore,
) -> Value {
    serde_json::to_value(durability.metrics_snapshot()).unwrap_or_else(|_| json!({}))
}

pub(super) fn recover_durable_runtime_state(
    durability: &AgentTaskDurabilityStore,
    history_limit: usize,
) -> DurableRuntimeRecoveryState {
    if !durability.is_active() || durability.conn.is_none() {
        return DurableRuntimeRecoveryState::default();
    }
    let limit = history_limit
        .max(1)
        .min(AGENT_TASK_DURABILITY_DEFAULT_RECOVERY_LIMIT);
    let mut recovery = DurableRuntimeRecoveryState::default();

    let task_snapshots = match durability.read_recent_agent_task_snapshots_local(limit) {
        Ok(snapshots) => snapshots,
        Err(error) => {
            warn!(
                error = error.as_str(),
                "failed to recover agent task runtime snapshots from durability sqlite"
            );
            Vec::new()
        }
    };
    let mut task_snapshots = task_snapshots;
    task_snapshots.sort_by_key(|entry| entry.updated_at);

    let mut recovered_task_count = 0u64;
    for snapshot in task_snapshots {
        let Some((task_id, runtime, queue_for_restart)) =
            hydrate_agent_task_runtime_from_snapshot(durability, snapshot)
        else {
            continue;
        };
        if let Some(pending) = runtime.summary.pending_approval.as_ref() {
            if runtime.summary.status == AgentTaskStatus::AwaitingApproval.as_str() {
                recovery
                    .agent_tasks
                    .approval_index
                    .insert(pending.approval_id.clone(), task_id.clone());
            }
        }
        if queue_for_restart {
            recovery.queued_task_ids.push(task_id.clone());
        }
        recovery.agent_tasks.order.push_back(task_id.clone());
        recovery.agent_tasks.tasks.insert(task_id, runtime);
        recovered_task_count += 1;
    }
    durability.record_agent_task_checkpoint_recover_total(recovered_task_count);

    let sub_agent_snapshots = match durability.read_recent_sub_agent_session_snapshots_local(limit)
    {
        Ok(snapshots) => snapshots,
        Err(error) => {
            warn!(
                error = error.as_str(),
                "failed to recover sub-agent session snapshots from durability sqlite"
            );
            Vec::new()
        }
    };
    let mut sub_agent_snapshots = sub_agent_snapshots;
    sub_agent_snapshots.sort_by_key(|entry| entry.updated_at);

    let mut recovered_sub_agent_count = 0u64;
    for snapshot in sub_agent_snapshots {
        let session_id = snapshot.session_id.trim().to_string();
        if session_id.is_empty() {
            continue;
        }
        let mut summary = snapshot.summary;
        summary.checkpoint_id = Some(snapshot.checkpoint_id.clone());
        summary.trace_id = Some(snapshot.trace_id.clone());
        summary.recovered = Some(true);
        let resume_ready =
            resolve_runtime_checkpoint_resume_ready(summary.status.as_str(), true, None);
        summary.checkpoint_state = Some(sub_agents::profiles::SubAgentCheckpointState {
            state: sub_agents::profiles::map_sub_agent_status_to_workflow_state(
                summary.status.as_str(),
                summary.error_code.as_deref(),
            )
            .to_string(),
            lifecycle_state: snapshot.lifecycle_state.clone(),
            checkpoint_id: Some(snapshot.checkpoint_id.clone()),
            trace_id: snapshot.trace_id.clone(),
            recovered: true,
            updated_at: snapshot.updated_at,
            resume_ready: Some(resume_ready),
            recovered_at: Some(snapshot.updated_at),
            summary: build_runtime_checkpoint_summary(
                summary.status.as_str(),
                Some(snapshot.checkpoint_id.as_str()),
                true,
                resume_ready,
            ),
        });
        sub_agents::sync_sub_agent_executor_linkage(&mut summary);
        recovery
            .sub_agent_sessions
            .order
            .push_back(session_id.clone());
        recovery.sub_agent_sessions.sessions.insert(session_id, {
            let mut runtime = sub_agents::SubAgentSessionRuntime {
                summary,
                execution_node: snapshot.execution_node,
                execution_edge: snapshot.execution_edge,
                closed: snapshot.closed,
            };
            if runtime.execution_node.is_none() || runtime.execution_edge.is_none() {
                sub_agents::sync_sub_agent_runtime_execution_graph(&mut runtime);
            }
            runtime
        });
        recovered_sub_agent_count += 1;
    }
    durability.record_subagent_checkpoint_recover_total(recovered_sub_agent_count);

    recovery
}

pub(super) fn recover_agent_task_runtime_by_id(
    durability: &AgentTaskDurabilityStore,
    task_id: &str,
) -> Option<AgentTaskRuntime> {
    if !durability.is_active() || durability.conn.is_none() {
        return None;
    }
    let snapshot = match durability.read_agent_task_snapshot_local(task_id) {
        Ok(snapshot) => snapshot?,
        Err(error) => {
            warn!(
                error = error.as_str(),
                task_id, "failed to recover single agent task snapshot by task id"
            );
            return None;
        }
    };
    let (_, runtime, _) = hydrate_agent_task_runtime_from_snapshot(durability, snapshot)?;
    Some(runtime)
}

fn hydrate_agent_task_runtime_from_snapshot(
    durability: &AgentTaskDurabilityStore,
    snapshot: AgentTaskRuntimeSnapshot,
) -> Option<(String, AgentTaskRuntime, bool)> {
    let mut summary = snapshot.summary;
    let task_id = if summary.task_id.trim().is_empty() {
        snapshot.task_id.trim().to_string()
    } else {
        summary.task_id.trim().to_string()
    };
    if task_id.is_empty() {
        return None;
    }
    summary.task_id = task_id.clone();
    if summary.workspace_id.trim().is_empty() {
        summary.workspace_id = snapshot.workspace_id.trim().to_string();
    }
    if summary.updated_at < snapshot.updated_at {
        summary.updated_at = snapshot.updated_at;
    }
    let mut interrupt_requested = snapshot.interrupt_requested;
    let mut queue_for_restart = false;

    match summary.status.as_str() {
        value if value == AgentTaskStatus::Queued.as_str() => {
            queue_for_restart = true;
        }
        value if value == AgentTaskStatus::Running.as_str() => {
            let now = now_ms();
            summary.status = AgentTaskStatus::Interrupted.as_str().to_string();
            summary.error_code =
                Some(AGENT_TASK_DURABILITY_ERROR_CODE_RECOVERY_INTERRUPTED.to_string());
            summary.error_message = Some(
                "Task was running when runtime restarted. Resume to continue safely.".to_string(),
            );
            summary.current_step = None;
            summary.completed_at = Some(now);
            summary.updated_at = now;
            interrupt_requested = true;
            durability.record_runtime_recovery_interrupt();
        }
        _ => {}
    }
    if let Some(auto_drive) = summary.auto_drive.as_mut() {
        auto_drive.recovery = Some(AgentTaskAutoDriveRecoveryMarker {
            recovered: Some(true),
            resume_ready: Some(true),
            checkpoint_id: Some(snapshot.checkpoint_id.clone()),
            trace_id: Some(snapshot.trace_id.clone()),
            recovered_at: Some(summary.updated_at),
            summary: Some(
                "Runtime recovered AutoDrive from a checkpoint. Resume to continue.".to_string(),
            ),
        });
        if auto_drive.stop.is_none() && interrupt_requested {
            auto_drive.stop = Some(AgentTaskAutoDriveStopState {
                reason: "paused".to_string(),
                summary: Some(
                    "Runtime recovered AutoDrive from a checkpoint. Resume to continue."
                        .to_string(),
                ),
                at: Some(summary.updated_at),
            });
        }
    }

    let runtime = AgentTaskRuntime {
        summary,
        steps_input: snapshot.steps_input,
        interrupt_requested,
        checkpoint_id: Some(snapshot.checkpoint_id),
        review_actionability: snapshot.review_actionability,
        execution_graph: snapshot.execution_graph,
        takeover_bundle: snapshot.takeover_bundle,
        recovered: true,
        last_tool_signature: None,
        consecutive_tool_signature_count: 0,
        interrupt_waiter: Arc::new(Notify::new()),
        approval_waiter: Arc::new(Notify::new()),
    };
    Some((task_id, runtime, queue_for_restart))
}

pub(super) fn checkpoint_agent_task_runtime(
    ctx: &AppContext,
    runtime: &AgentTaskRuntime,
    lifecycle_state: &str,
) -> Option<String> {
    if !ctx.agent_task_durability.is_active() {
        return None;
    }
    let checkpoint_id = new_id("checkpoint");
    let trace_id = agent_task_trace_id(runtime.summary.task_id.as_str());
    let mut snapshot_runtime = runtime.clone();
    snapshot_runtime.checkpoint_id = Some(checkpoint_id.clone());
    if let Err(error) = refresh_agent_task_runtime_execution_truth(ctx, &mut snapshot_runtime) {
        warn!(
            task_id = runtime.summary.task_id.as_str(),
            error = error.message(),
            "failed to refresh runtime execution truth before checkpoint snapshot"
        );
    }
    let snapshot = AgentTaskRuntimeSnapshot {
        version: AGENT_TASK_DURABILITY_SCHEMA_VERSION,
        checkpoint_id: checkpoint_id.clone(),
        trace_id,
        lifecycle_state: lifecycle_state.to_string(),
        task_id: snapshot_runtime.summary.task_id.clone(),
        workspace_id: snapshot_runtime.summary.workspace_id.clone(),
        status: snapshot_runtime.summary.status.clone(),
        summary: snapshot_runtime.summary.clone(),
        steps_input: snapshot_runtime.steps_input.clone(),
        interrupt_requested: snapshot_runtime.interrupt_requested,
        review_actionability: snapshot_runtime.review_actionability.clone(),
        execution_graph: snapshot_runtime.execution_graph.clone(),
        takeover_bundle: snapshot_runtime.takeover_bundle.clone(),
        recovered: snapshot_runtime.recovered,
        updated_at: snapshot_runtime.summary.updated_at,
    };
    spawn_agent_task_snapshot_checkpoint(ctx.clone(), snapshot);
    Some(checkpoint_id)
}

pub(super) fn checkpoint_sub_agent_session_runtime(
    ctx: &AppContext,
    runtime: &sub_agents::SubAgentSessionRuntime,
    session_id: &str,
    workspace_id: &str,
    updated_at: u64,
    lifecycle_state: &str,
    recovered: bool,
) -> Option<String> {
    if !ctx.agent_task_durability.is_active() {
        return None;
    }
    let checkpoint_id = new_id("checkpoint");
    let trace_id = sub_agent_trace_id(session_id);
    let mut snapshot_runtime = runtime.clone();
    snapshot_runtime.summary.checkpoint_id = Some(checkpoint_id.clone());
    snapshot_runtime.summary.trace_id = Some(trace_id.clone());
    snapshot_runtime.summary.recovered = Some(recovered);
    snapshot_runtime.summary.checkpoint_state =
        Some(sub_agents::profiles::build_sub_agent_checkpoint_state(
            &snapshot_runtime.summary,
            lifecycle_state,
        ));
    sub_agents::sync_sub_agent_executor_linkage(&mut snapshot_runtime.summary);
    sub_agents::sync_sub_agent_runtime_execution_graph(&mut snapshot_runtime);
    let snapshot = SubAgentSessionRuntimeSnapshot {
        version: AGENT_TASK_DURABILITY_SCHEMA_VERSION,
        checkpoint_id: checkpoint_id.clone(),
        trace_id,
        lifecycle_state: lifecycle_state.to_string(),
        session_id: session_id.to_string(),
        workspace_id: workspace_id.to_string(),
        summary: snapshot_runtime.summary.clone(),
        execution_node: snapshot_runtime.execution_node.clone(),
        execution_edge: snapshot_runtime.execution_edge.clone(),
        closed: snapshot_runtime.closed,
        recovered,
        updated_at,
    };
    spawn_sub_agent_snapshot_checkpoint(ctx.clone(), snapshot);
    Some(checkpoint_id)
}

pub(super) fn checkpoint_tool_call_lifecycle(
    ctx: &AppContext,
    task_id: &str,
    workspace_id: &str,
    tool_call_id: &str,
    tool_name: &str,
    lifecycle_state: &str,
    ok: Option<bool>,
    error_class: Option<&str>,
    duration_ms: Option<u64>,
    batch_id: Option<&str>,
    attempt: Option<u32>,
    recovered: bool,
    payload: Value,
) -> Option<String> {
    if !ctx.agent_task_durability.is_active() {
        return None;
    }
    let checkpoint_id = new_id("checkpoint");
    let snapshot = ToolCallLifecycleSnapshot {
        version: AGENT_TASK_DURABILITY_SCHEMA_VERSION,
        checkpoint_id: checkpoint_id.clone(),
        trace_id: agent_task_trace_id(task_id),
        lifecycle_state: lifecycle_state.to_string(),
        task_id: task_id.to_string(),
        workspace_id: workspace_id.to_string(),
        tool_call_id: tool_call_id.to_string(),
        tool_name: tool_name.to_string(),
        batch_id: batch_id.map(str::to_string),
        attempt,
        ok,
        error_class: error_class.map(str::to_string),
        duration_ms,
        recovered,
        payload,
        updated_at: now_ms(),
    };
    spawn_tool_call_snapshot_checkpoint(ctx.clone(), snapshot);
    Some(checkpoint_id)
}

fn resolve_agent_task_durability_mode() -> AgentTaskDurabilityMode {
    let raw =
        std::env::var(AGENT_TASK_DURABILITY_MODE_ENV).unwrap_or_else(|_| "active".to_string());
    match raw.trim().to_ascii_lowercase().as_str() {
        AGENT_TASK_DURABILITY_MODE_OFF => AgentTaskDurabilityMode::Off,
        "" | AGENT_TASK_DURABILITY_MODE_ACTIVE => AgentTaskDurabilityMode::Active,
        _ => AgentTaskDurabilityMode::Active,
    }
}

pub(super) fn is_agent_task_recovery_interrupted(summary: &AgentTaskSummary) -> bool {
    summary.status == AgentTaskStatus::Interrupted.as_str()
        && summary.error_code.as_deref()
            == Some(AGENT_TASK_DURABILITY_ERROR_CODE_RECOVERY_INTERRUPTED)
}

pub(super) fn agent_task_trace_id(task_id: &str) -> String {
    format!("agent-task:{task_id}")
}

pub(super) fn sub_agent_trace_id(session_id: &str) -> String {
    format!("sub-agent:{session_id}")
}
