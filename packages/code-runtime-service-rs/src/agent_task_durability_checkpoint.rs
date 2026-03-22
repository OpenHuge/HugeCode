use super::*;
use tracing::warn;

#[derive(Clone, Copy, Debug)]
enum DurabilityCheckpointKind {
    AgentTask,
    SubAgentSession,
    ToolLifecycle,
}

impl DurabilityCheckpointKind {
    fn persistence_failure_label(self) -> &'static str {
        match self {
            Self::AgentTask => "agent-task snapshot persistence failed",
            Self::SubAgentSession => "sub-agent session snapshot persistence failed",
            Self::ToolLifecycle => "tool lifecycle snapshot persistence failed",
        }
    }

    fn stale_write_warning(self) -> &'static str {
        match self {
            Self::AgentTask => "stale distributed agent checkpoint write rejected by CAS",
            Self::SubAgentSession => "stale distributed sub-agent checkpoint write rejected by CAS",
            Self::ToolLifecycle => {
                "stale distributed tool lifecycle checkpoint write rejected by CAS"
            }
        }
    }

    fn record_stale_write_diagnostic(self, ctx: &AppContext) {
        match self {
            Self::AgentTask => ctx
                .runtime_diagnostics
                .record_stale_write_rejected_task_checkpoint(),
            Self::SubAgentSession => ctx
                .runtime_diagnostics
                .record_stale_write_rejected_sub_agent_checkpoint(),
            Self::ToolLifecycle => ctx
                .runtime_diagnostics
                .record_stale_write_rejected_tool_lifecycle_checkpoint(),
        }
    }
}

async fn persist_local_checkpoint(
    ctx: &AppContext,
    durability: Arc<AgentTaskDurabilityStore>,
    kind: DurabilityCheckpointKind,
    persist: impl FnOnce() -> Result<(), String> + Send + 'static,
) -> bool {
    let local_result = tokio::task::spawn_blocking(persist)
        .await
        .map_err(|error| format!("Join durability checkpoint persistence task: {error}"))
        .and_then(|result| result);
    match local_result {
        Ok(()) => {
            durability.record_checkpoint_write_success();
            true
        }
        Err(error) => {
            handle_checkpoint_write_failure(
                ctx,
                format!("{}: {error}", kind.persistence_failure_label()),
            )
            .await;
            false
        }
    }
}

async fn handle_stale_write_rejected(
    ctx: &AppContext,
    kind: DurabilityCheckpointKind,
    identifier_field: &str,
    identifier_value: &str,
) {
    kind.record_stale_write_diagnostic(ctx);
    let _ = crate::runtime_tool_safety_counters::record_runtime_tool_safety_counter(
        ctx,
        runtime_tool_metrics::RuntimeToolSafetyCounter::StaleWriteRejected,
        "increment stale-write-rejected runtime tool metric failed",
    )
    .await;
    warn!(
        checkpoint_kind = ?kind,
        checkpoint_identifier_field = identifier_field,
        checkpoint_identifier = identifier_value,
        "{}",
        kind.stale_write_warning()
    );
}

pub(super) fn spawn_agent_task_snapshot_checkpoint(
    ctx: AppContext,
    snapshot: AgentTaskRuntimeSnapshot,
) {
    let durability = ctx.agent_task_durability.clone();
    if !durability.should_persist() {
        return;
    }
    let redis_client = ctx.distributed_redis_client.clone();
    let distributed_enabled = ctx.distributed_config.enabled;
    let snapshot_for_local = snapshot.clone();
    let durability_for_local = durability.clone();
    tokio::spawn(async move {
        let persisted = persist_local_checkpoint(
            &ctx,
            durability.clone(),
            DurabilityCheckpointKind::AgentTask,
            move || durability_for_local.persist_agent_task_snapshot_local(&snapshot_for_local),
        )
        .await;
        if !persisted {
            return;
        }

        if distributed_enabled {
            if let Some(client) = redis_client.as_ref() {
                let payload = match serde_json::to_value(&snapshot) {
                    Ok(value) => value,
                    Err(error) => {
                        warn!(
                            error = error.to_string().as_str(),
                            task_id = snapshot.task_id.as_str(),
                            "failed to serialize agent task checkpoint for distributed state store"
                        );
                        return;
                    }
                };
                match distributed::state_store::persist_agent_task_runtime_snapshot(
                    client.as_ref(),
                    snapshot.workspace_id.as_str(),
                    snapshot.task_id.as_str(),
                    snapshot.updated_at,
                    &payload,
                )
                .await
                {
                    Ok(distributed::state_store::PersistWriteResult::Applied) => {}
                    Ok(distributed::state_store::PersistWriteResult::StaleWriteRejected) => {
                        handle_stale_write_rejected(
                            &ctx,
                            DurabilityCheckpointKind::AgentTask,
                            "task_id",
                            snapshot.task_id.as_str(),
                        )
                        .await;
                    }
                    Err(error) => {
                        warn!(
                            error = error.as_str(),
                            task_id = snapshot.task_id.as_str(),
                            "failed to persist agent task checkpoint to distributed state store"
                        );
                    }
                }
            }
        }
    });
}

pub(super) fn spawn_sub_agent_snapshot_checkpoint(
    ctx: AppContext,
    snapshot: SubAgentSessionRuntimeSnapshot,
) {
    let durability = ctx.agent_task_durability.clone();
    if !durability.should_persist() {
        return;
    }
    let redis_client = ctx.distributed_redis_client.clone();
    let distributed_enabled = ctx.distributed_config.enabled;
    let snapshot_for_local = snapshot.clone();
    let durability_for_local = durability.clone();
    tokio::spawn(async move {
        let persisted = persist_local_checkpoint(
            &ctx,
            durability.clone(),
            DurabilityCheckpointKind::SubAgentSession,
            move || {
                durability_for_local.persist_sub_agent_session_snapshot_local(&snapshot_for_local)
            },
        )
        .await;
        if !persisted {
            return;
        }

        if distributed_enabled {
            if let Some(client) = redis_client.as_ref() {
                let payload = match serde_json::to_value(&snapshot) {
                    Ok(value) => value,
                    Err(error) => {
                        warn!(
                            error = error.to_string().as_str(),
                            session_id = snapshot.session_id.as_str(),
                            "failed to serialize sub-agent checkpoint for distributed state store"
                        );
                        return;
                    }
                };
                match distributed::state_store::persist_sub_agent_session_runtime_snapshot(
                    client.as_ref(),
                    snapshot.workspace_id.as_str(),
                    snapshot.session_id.as_str(),
                    snapshot.updated_at,
                    &payload,
                )
                .await
                {
                    Ok(distributed::state_store::PersistWriteResult::Applied) => {}
                    Ok(distributed::state_store::PersistWriteResult::StaleWriteRejected) => {
                        handle_stale_write_rejected(
                            &ctx,
                            DurabilityCheckpointKind::SubAgentSession,
                            "session_id",
                            snapshot.session_id.as_str(),
                        )
                        .await;
                    }
                    Err(error) => {
                        warn!(
                            error = error.as_str(),
                            session_id = snapshot.session_id.as_str(),
                            "failed to persist sub-agent checkpoint to distributed state store"
                        );
                    }
                }
            }
        }
    });
}

pub(super) fn spawn_tool_call_snapshot_checkpoint(
    ctx: AppContext,
    snapshot: ToolCallLifecycleSnapshot,
) {
    let durability = ctx.agent_task_durability.clone();
    if !durability.should_persist() {
        return;
    }
    let redis_client = ctx.distributed_redis_client.clone();
    let distributed_enabled = ctx.distributed_config.enabled;
    let snapshot_for_local = snapshot.clone();
    let durability_for_local = durability.clone();
    tokio::spawn(async move {
        let persisted = persist_local_checkpoint(
            &ctx,
            durability.clone(),
            DurabilityCheckpointKind::ToolLifecycle,
            move || {
                durability_for_local.persist_tool_call_lifecycle_snapshot_local(&snapshot_for_local)
            },
        )
        .await;
        if !persisted {
            return;
        }

        if distributed_enabled {
            if let Some(client) = redis_client.as_ref() {
                let payload = match serde_json::to_value(&snapshot) {
                    Ok(value) => value,
                    Err(error) => {
                        warn!(
                            error = error.to_string().as_str(),
                            checkpoint_id = snapshot.checkpoint_id.as_str(),
                            "failed to serialize tool lifecycle checkpoint for distributed state store"
                        );
                        return;
                    }
                };
                match distributed::state_store::persist_tool_call_lifecycle_snapshot(
                    client.as_ref(),
                    snapshot.workspace_id.as_str(),
                    snapshot.task_id.as_str(),
                    snapshot.checkpoint_id.as_str(),
                    snapshot.updated_at,
                    &payload,
                )
                .await
                {
                    Ok(distributed::state_store::PersistWriteResult::Applied) => {}
                    Ok(distributed::state_store::PersistWriteResult::StaleWriteRejected) => {
                        handle_stale_write_rejected(
                            &ctx,
                            DurabilityCheckpointKind::ToolLifecycle,
                            "checkpoint_id",
                            snapshot.checkpoint_id.as_str(),
                        )
                        .await;
                    }
                    Err(error) => {
                        warn!(
                            error = error.as_str(),
                            checkpoint_id = snapshot.checkpoint_id.as_str(),
                            "failed to persist tool lifecycle checkpoint to distributed state store"
                        );
                    }
                }
            }
        }
    });
}

async fn handle_checkpoint_write_failure(ctx: &AppContext, message: String) {
    warn!(
        error = message.as_str(),
        "agent task durability checkpoint write failed"
    );
    let degrade_triggered = ctx.agent_task_durability.record_checkpoint_write_failure();
    if !degrade_triggered {
        return;
    }
    publish_runtime_updated_event(
        ctx,
        &["agents"],
        "agent_task_durability_degraded",
        Some(build_agent_task_durability_diagnostics_payload(
            ctx.agent_task_durability.as_ref(),
        )),
    );
}
