use super::*;
use crate::distributed_graph_rpc_helpers::{
    distributed_graph_extract_role, distributed_graph_read_reason_field,
    distributed_graph_read_string_field, distributed_graph_read_u32_field,
};
use crate::distributed_runtime::invalidate_cached_distributed_readiness_snapshot;
#[path = "rpc_dispatch_runtime_backends_operability.rs"]
mod operability;
#[cfg(test)]
#[path = "rpc_dispatch_runtime_backends_tests.rs"]
mod tests;

pub(crate) use operability::{
    assess_runtime_backend_operability, backend_is_acp_projection,
    build_runtime_backend_operability_value, RuntimeBackendOperabilityAssessment,
};

fn classify_backend_routing_health(
    summary: &RuntimeBackendSummary,
    active_tasks: u64,
) -> &'static str {
    assess_runtime_backend_operability(summary, active_tasks).state
}

fn build_runtime_backend_diagnostics(summary: &RuntimeBackendSummary, active_tasks: u64) -> Value {
    let assessment = assess_runtime_backend_operability(summary, active_tasks);

    json!({
        "availability": assessment.availability,
        "summary": assessment.summary,
        "reasons": assessment.reasons,
        "degraded": assessment.availability != "available",
        "heartbeatAgeMs": assessment.heartbeat_age_ms,
        "lastHeartbeatAt": summary.last_heartbeat_at,
        "reachability": assessment.reachability,
        "leaseStatus": assessment.lease_status,
        "readinessState": assessment.readiness_state,
    })
}

fn build_runtime_backend_summary_value(
    summary: &RuntimeBackendSummary,
    active_tasks: u64,
) -> Result<Value, RpcError> {
    let mut value = serde_json::to_value(summary).map_err(|error| {
        RpcError::internal(format!(
            "Failed to serialize runtime backend `{}`: {error}",
            summary.backend_id
        ))
    })?;
    let Value::Object(object) = &mut value else {
        return Err(RpcError::internal(
            "Runtime backend summary must serialize to an object.".to_string(),
        ));
    };
    if !matches!(object.get("contract"), Some(Value::Object(_))) {
        object.insert(
            "contract".to_string(),
            build_runtime_backend_contract(summary),
        );
    }
    object.insert(
        "diagnostics".to_string(),
        build_runtime_backend_diagnostics(summary, active_tasks),
    );
    object.insert(
        "operability".to_string(),
        build_runtime_backend_operability_value(summary, active_tasks),
    );
    Ok(value)
}

async fn collect_active_tasks_by_backend(
    ctx: &AppContext,
) -> std::collections::HashMap<String, u64> {
    let store = ctx.agent_tasks.read().await;
    let mut counts = std::collections::HashMap::<String, u64>::new();
    for runtime in store.tasks.values() {
        if is_agent_task_terminal_status(runtime.summary.status.as_str()) {
            continue;
        }
        let Some(backend_id) = runtime.summary.backend_id.as_deref().map(str::trim) else {
            continue;
        };
        if backend_id.is_empty() {
            continue;
        }
        *counts.entry(backend_id.to_string()).or_insert(0) += 1;
    }
    counts
}

pub(super) async fn build_runtime_routing_health_payload(ctx: &AppContext) -> Value {
    sync_runtime_backends_from_distributed_store(ctx).await;

    let active_tasks_by_backend = collect_active_tasks_by_backend(ctx).await;

    let backends = {
        let backends = ctx.runtime_backends.read().await;
        let mut items = backends.values().cloned().collect::<Vec<_>>();
        items.sort_by(|left, right| left.backend_id.cmp(&right.backend_id));
        items
    };

    let mut healthy_backends = 0u64;
    let mut degraded_backends = 0u64;
    let mut active_tasks_total = 0u64;
    let mut queue_depth_total = 0u64;
    let mut primary_backends = 0u64;
    let mut burst_backends = 0u64;
    let mut specialized_backends = 0u64;

    let backend_entries = backends
        .iter()
        .map(|backend| {
            let active_tasks = active_tasks_by_backend
                .get(backend.backend_id.as_str())
                .copied()
                .unwrap_or(0);
            let available_execution_slots = backend
                .max_concurrency
                .saturating_sub(active_tasks.min(backend.max_concurrency));
            let degraded_state = classify_backend_routing_health(backend, active_tasks);
            if backend.healthy {
                healthy_backends += 1;
            }
            if degraded_state != "ready" {
                degraded_backends += 1;
            }
            active_tasks_total += active_tasks;
            queue_depth_total += backend.queue_depth;
            match backend.backend_class.as_deref() {
                Some("primary") => primary_backends += 1,
                Some("burst") => burst_backends += 1,
                Some("specialized") => specialized_backends += 1,
                _ => {}
            }

            json!({
                "backendId": backend.backend_id,
                "displayName": backend.display_name,
                "backendClass": backend.backend_class,
                "policy": backend.policy,
                "specializations": backend.specializations,
                "status": backend.status,
                "healthy": backend.healthy,
                "healthScore": backend.health_score,
                "failures": backend.failures,
                "queueDepth": backend.queue_depth,
                "maxConcurrency": backend.max_concurrency,
                "activeTasks": active_tasks,
                "availableExecutionSlots": available_execution_slots,
                "degradedState": degraded_state,
                "connectivity": backend.connectivity,
                "lease": backend.lease,
                "readiness": backend.readiness,
                "operability": build_runtime_backend_operability_value(backend, active_tasks),
                "diagnostics": build_runtime_backend_diagnostics(backend, active_tasks),
            })
        })
        .collect::<Vec<_>>();

    json!({
        "summary": {
            "backendsTotal": backends.len(),
            "healthyBackends": healthy_backends,
            "degradedBackends": degraded_backends,
            "primaryBackends": primary_backends,
            "burstBackends": burst_backends,
            "specializedBackends": specialized_backends,
            "activeTasksTotal": active_tasks_total,
            "queueDepthTotal": queue_depth_total,
            "executionSlotsAvailable": ctx.agent_task_execution_slots.available_permits(),
            "executionSlotsMax": ctx.config.agent_max_concurrent_tasks,
        },
        "backends": backend_entries,
    })
}

pub(super) async fn handle_runtime_backends_list(ctx: &AppContext) -> Result<Value, RpcError> {
    sync_runtime_backends_from_distributed_store(ctx).await;
    let backends = ctx.runtime_backends.read().await;
    let mut items = backends.values().cloned().collect::<Vec<_>>();
    items.sort_by(|left, right| left.backend_id.cmp(&right.backend_id));
    drop(backends);
    let active_tasks_by_backend = collect_active_tasks_by_backend(ctx).await;
    let payload = items
        .iter()
        .map(|item| {
            let active_tasks = active_tasks_by_backend
                .get(item.backend_id.as_str())
                .copied()
                .unwrap_or(item.running_tasks);
            build_runtime_backend_summary_value(item, active_tasks)
        })
        .collect::<Result<Vec<_>, _>>()?;
    Ok(Value::Array(payload))
}

pub(super) async fn handle_runtime_backend_upsert(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    sync_runtime_backends_from_distributed_store(ctx).await;
    let params = as_object(params)?;
    let backend_id = read_required_string(params, "backendId")?.to_string();
    let display_name = read_optional_string(params, "displayName").unwrap_or_else(|| {
        backend_id
            .split('-')
            .next()
            .unwrap_or("Runtime Backend")
            .to_string()
    });
    let capabilities = parse_backend_capabilities(params)?;
    let max_concurrency = read_optional_u64(params, "maxConcurrency")
        .ok_or_else(|| RpcError::invalid_params("maxConcurrency is required."))?;
    if max_concurrency == 0 {
        return Err(RpcError::invalid_params(
            "maxConcurrency must be greater than 0.",
        ));
    }
    let cost_tier = read_optional_string(params, "costTier").unwrap_or_else(|| "standard".into());
    let latency_class =
        read_optional_string(params, "latencyClass").unwrap_or_else(|| "regional".into());
    let rollout_state =
        normalize_runtime_backend_rollout_state(read_required_string(params, "rolloutState")?)?;
    let status = normalize_runtime_backend_status(read_required_string(params, "status")?)?;
    let health_score = read_optional_f64_field(params, "healthScore").unwrap_or(1.0);
    let failures = read_optional_u64(params, "failures").unwrap_or(0);
    let queue_depth = read_optional_u64(params, "queueDepth").unwrap_or(0);
    let running_tasks = read_optional_u64(params, "runningTasks").unwrap_or(0);
    let last_heartbeat_at = read_optional_u64(params, "lastHeartbeatAt");
    let heartbeat_interval_ms = read_optional_u64(params, "heartbeatIntervalMs");
    let backend_class = read_optional_string(params, "backendClass")
        .map(|value| normalize_runtime_backend_class(value.as_str()))
        .transpose()?;
    let specializations = parse_optional_string_list(params, "specializations")?;
    let policy = parse_runtime_backend_policy_profile(params)?;
    let connectivity = parse_optional_runtime_backend_connectivity(params)?;
    let lease = parse_optional_runtime_backend_lease(params)?;
    let now = now_ms();

    let mut backends = ctx.runtime_backends.write().await;
    let summary = if let Some(existing) = backends.get_mut(backend_id.as_str()) {
        if !is_allowed_backend_status_transition(existing.status.as_str(), status.as_str()) {
            return Err(RpcError::invalid_params(format!(
                "backend status transition `{}` -> `{}` is not allowed.",
                existing.status, status
            )));
        }
        if !is_allowed_backend_rollout_transition(
            existing.rollout_state.as_str(),
            rollout_state.as_str(),
        ) {
            return Err(RpcError::invalid_params(format!(
                "backend rollout transition `{}` -> `{}` is not allowed.",
                existing.rollout_state, rollout_state
            )));
        }
        existing.display_name = display_name;
        existing.capabilities = capabilities;
        existing.max_concurrency = max_concurrency;
        existing.cost_tier = cost_tier;
        existing.latency_class = latency_class;
        existing.rollout_state = rollout_state;
        existing.status = status;
        existing.health_score = health_score;
        existing.failures = failures;
        existing.queue_depth = queue_depth;
        existing.running_tasks = running_tasks;
        existing.heartbeat_interval_ms = heartbeat_interval_ms;
        existing.backend_class = backend_class;
        existing.specializations = specializations;
        existing.policy = Some(policy);
        existing.connectivity = connectivity;
        existing.lease = lease;
        existing.healthy = compute_backend_healthy(existing.status.as_str(), existing.health_score);
        existing.updated_at = now;
        existing.last_heartbeat_at = last_heartbeat_at.unwrap_or(now);
        existing.backend_kind = Some("native".to_string());
        existing.integration_id = None;
        existing.transport = None;
        existing.origin = Some("runtime-native".to_string());
        existing.contract = Some(build_runtime_backend_contract(existing));
        existing.clone()
    } else {
        let healthy = compute_backend_healthy(status.as_str(), health_score);
        let mut summary = RuntimeBackendSummary {
            backend_id: backend_id.clone(),
            display_name,
            capabilities,
            max_concurrency,
            cost_tier,
            latency_class,
            rollout_state,
            status,
            healthy,
            health_score,
            failures,
            queue_depth,
            running_tasks,
            created_at: now,
            updated_at: now,
            last_heartbeat_at: last_heartbeat_at.unwrap_or(now),
            heartbeat_interval_ms,
            backend_class,
            specializations,
            policy: Some(policy),
            connectivity,
            lease,
            readiness: None,
            backend_kind: Some("native".to_string()),
            integration_id: None,
            transport: None,
            origin: Some("runtime-native".to_string()),
            contract: None,
        };
        summary.contract = Some(build_runtime_backend_contract(&summary));
        backends.insert(backend_id, summary.clone());
        summary
    };
    drop(backends);
    invalidate_cached_distributed_readiness_snapshot(ctx).await;
    persist_runtime_backends_to_native_store(ctx).await?;
    persist_runtime_backend_to_distributed_store(ctx, &summary).await;
    Ok(build_runtime_backend_summary_value(
        &summary,
        summary.running_tasks,
    )?)
}

pub(super) async fn handle_runtime_backend_remove(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    sync_runtime_backends_from_distributed_store(ctx).await;
    let params = as_object(params)?;
    let backend_id = read_required_string(params, "backendId")?;
    let mut backends = ctx.runtime_backends.write().await;
    if let Some(summary) = backends.get(backend_id) {
        if backend_is_acp_projection(summary) {
            return Err(RpcError::invalid_params(
                "ACP projected backends are managed through ACP integration RPCs.",
            ));
        }
    }
    let removed = backends.remove(backend_id).is_some();
    drop(backends);
    if removed {
        invalidate_cached_distributed_readiness_snapshot(ctx).await;
        persist_runtime_backends_to_native_store(ctx).await?;
    }
    remove_runtime_backend_from_distributed_store(ctx, backend_id).await;
    Ok(json!(removed))
}

pub(super) async fn handle_runtime_backend_set_state(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    sync_runtime_backends_from_distributed_store(ctx).await;
    let params = as_object(params)?;
    let backend_id = read_required_string(params, "backendId")?;
    let maybe_status = read_optional_string(params, "status")
        .map(|value| normalize_runtime_backend_status(value.as_str()))
        .transpose()?;
    let maybe_rollout_state = read_optional_string(params, "rolloutState")
        .map(|value| normalize_runtime_backend_rollout_state(value.as_str()))
        .transpose()?;
    let force = read_optional_bool(params, "force").unwrap_or(false);
    if maybe_status.is_none() && maybe_rollout_state.is_none() {
        return Err(RpcError::invalid_params(
            "runtime backend set state requires status and/or rolloutState.",
        ));
    }

    let mut backends = ctx.runtime_backends.write().await;
    let Some(summary) = backends.get_mut(backend_id) else {
        return Err(RpcError::invalid_params(format!(
            "runtime backend `{backend_id}` not found."
        )));
    };
    if backend_is_acp_projection(summary) {
        return Err(RpcError::invalid_params(
            "ACP projected backends are managed through ACP integration RPCs.",
        ));
    }

    if !force && maybe_status.as_deref() == Some("disabled") && summary.running_tasks > 0 {
        return Err(RpcError::invalid_params(format!(
            "runtime backend `{backend_id}` still has running tasks; pass force=true to disable."
        )));
    }
    let next_status = maybe_status.as_deref().unwrap_or(summary.status.as_str());
    if !force && !is_allowed_backend_status_transition(summary.status.as_str(), next_status) {
        return Err(RpcError::invalid_params(format!(
            "backend status transition `{}` -> `{next_status}` is not allowed.",
            summary.status
        )));
    }
    let next_rollout_state = maybe_rollout_state
        .as_deref()
        .unwrap_or(summary.rollout_state.as_str());
    if !force
        && !is_allowed_backend_rollout_transition(
            summary.rollout_state.as_str(),
            next_rollout_state,
        )
    {
        return Err(RpcError::invalid_params(format!(
            "backend rollout transition `{}` -> `{next_rollout_state}` is not allowed.",
            summary.rollout_state
        )));
    }

    if let Some(status) = maybe_status {
        summary.status = status;
    }
    if let Some(rollout_state) = maybe_rollout_state {
        summary.rollout_state = rollout_state;
    }
    summary.healthy = compute_backend_healthy(summary.status.as_str(), summary.health_score);
    summary.updated_at = now_ms();
    summary.contract = Some(build_runtime_backend_contract(summary));
    let snapshot = summary.clone();
    drop(backends);
    invalidate_cached_distributed_readiness_snapshot(ctx).await;
    persist_runtime_backends_to_native_store(ctx).await?;
    persist_runtime_backend_to_distributed_store(ctx, &snapshot).await;
    Ok(build_runtime_backend_summary_value(
        &snapshot,
        snapshot.running_tasks,
    )?)
}

#[derive(Clone, Debug)]
pub(crate) struct LocalDistributedTaskGraphSummaryCandidate {
    pub(crate) task_id: String,
    pub(crate) root_task_id: String,
    pub(crate) node: DistributedTaskGraphNodeSummary,
    pub(crate) access_mode: Option<String>,
    pub(crate) routed_provider: Option<String>,
    pub(crate) execution_mode: String,
    pub(crate) reason: Option<String>,
}

fn extract_local_distributed_task_graph_role(summary: &AgentTaskSummary) -> String {
    summary
        .steps
        .iter()
        .find_map(|step| {
            let role = step.role.trim();
            (!role.is_empty()).then_some(role.to_string())
        })
        .unwrap_or_else(|| "router".to_string())
}

pub(crate) fn collect_local_distributed_task_graph_summary_candidates(
    store: &AgentTaskStore,
    requested_task_id: &str,
    root_task_id: &str,
) -> Vec<LocalDistributedTaskGraphSummaryCandidate> {
    store
        .tasks
        .values()
        .filter_map(|runtime| {
            let summary = &runtime.summary;
            let summary_root_task_id = summary
                .root_task_id
                .as_deref()
                .unwrap_or(summary.task_id.as_str());
            if summary.task_id == requested_task_id || summary_root_task_id == root_task_id {
                Some(LocalDistributedTaskGraphSummaryCandidate {
                    task_id: summary.task_id.clone(),
                    root_task_id: summary_root_task_id.to_string(),
                    node: DistributedTaskGraphNodeSummary {
                        task_id: summary.task_id.clone(),
                        parent_task_id: summary.parent_task_id.clone(),
                        role: extract_local_distributed_task_graph_role(summary),
                        backend_id: summary.backend_id.clone(),
                        status: summary.status.clone(),
                        attempt: 1,
                    },
                    access_mode: trim_optional_string(Some(summary.access_mode.clone())),
                    routed_provider: trim_optional_string(summary.routed_provider.clone()),
                    execution_mode: "runtime".to_string(),
                    reason: trim_optional_string(summary.error_message.clone()),
                })
            } else {
                None
            }
        })
        .collect()
}

fn extend_local_distributed_task_graph_candidates(
    candidates: &mut HashMap<String, LocalDistributedTaskGraphSummaryCandidate>,
    summaries: Vec<LocalDistributedTaskGraphSummaryCandidate>,
) {
    for summary in summaries {
        candidates.entry(summary.task_id.clone()).or_insert(summary);
    }
}

pub(super) async fn handle_distributed_task_graph(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    const DEFAULT_WORKSPACE_TASK_SUMMARY_LIMIT: usize = 128;
    const MIN_WORKSPACE_TASK_SUMMARY_LIMIT: usize = 32;
    const MAX_WORKSPACE_TASK_SUMMARY_LIMIT: usize = 512;

    let params = as_object(params)?;
    let task_id = read_required_string(params, "taskId")?.to_string();
    let include_diagnostics = read_optional_bool(params, "includeDiagnostics").unwrap_or(true);
    let requested_workspace_summary_limit =
        read_optional_u64(params, "limit").and_then(|value| usize::try_from(value).ok());
    let workspace_summary_limit = requested_workspace_summary_limit
        .unwrap_or(DEFAULT_WORKSPACE_TASK_SUMMARY_LIMIT)
        .clamp(
            MIN_WORKSPACE_TASK_SUMMARY_LIMIT,
            MAX_WORKSPACE_TASK_SUMMARY_LIMIT,
        );
    let mut local_task_summaries: HashMap<String, LocalDistributedTaskGraphSummaryCandidate> =
        HashMap::new();
    let mut remote_task_summaries: HashMap<String, Value> = HashMap::new();
    let mut local_loaded_root_task_ids = HashSet::new();
    let mut workspace_id: Option<String> = None;
    let mut root_task_id = task_id.clone();

    {
        let store = ctx.agent_tasks.read().await;
        if let Some(target) = store.tasks.get(task_id.as_str()) {
            workspace_id = Some(target.summary.workspace_id.clone());
            root_task_id = target
                .summary
                .root_task_id
                .clone()
                .unwrap_or_else(|| target.summary.task_id.clone());
        }
        let local_summaries = collect_local_distributed_task_graph_summary_candidates(
            &store,
            task_id.as_str(),
            root_task_id.as_str(),
        );
        extend_local_distributed_task_graph_candidates(&mut local_task_summaries, local_summaries);
    }
    local_loaded_root_task_ids.insert(root_task_id.clone());

    if let Some(client) = ctx.distributed_redis_client.as_ref() {
        match distributed::state_store::read_task_summary(client.as_ref(), task_id.as_str()).await {
            Ok(Some(summary)) => {
                if let Some(record) = summary.as_object() {
                    if workspace_id.is_none() {
                        workspace_id = distributed_graph_read_string_field(
                            record,
                            &["workspaceId", "workspace_id"],
                        );
                    }
                    if root_task_id == task_id {
                        root_task_id = distributed_graph_read_string_field(
                            record,
                            &["rootTaskId", "root_task_id", "taskId", "task_id"],
                        )
                        .unwrap_or_else(|| task_id.clone());
                    }
                    if let Some(summary_task_id) =
                        distributed_graph_read_string_field(record, &["taskId", "task_id"])
                    {
                        remote_task_summaries
                            .entry(summary_task_id)
                            .or_insert(summary);
                    }
                }
            }
            Ok(None) => {}
            Err(error) => {
                warn!(
                    task_id = task_id.as_str(),
                    error = error.as_str(),
                    "failed to read distributed task summary from state store"
                );
            }
        }

        if let Some(workspace_id) = workspace_id.as_deref() {
            match distributed::state_store::read_workspace_task_summaries(
                client.as_ref(),
                workspace_id,
                Some(workspace_summary_limit),
            )
            .await
            {
                Ok(summaries) => {
                    for summary in summaries {
                        let Some(record) = summary.as_object() else {
                            continue;
                        };
                        let Some(summary_task_id) =
                            distributed_graph_read_string_field(record, &["taskId", "task_id"])
                        else {
                            continue;
                        };
                        remote_task_summaries
                            .entry(summary_task_id)
                            .or_insert(summary);
                    }
                }
                Err(error) => {
                    warn!(
                        workspace_id,
                        error = error.as_str(),
                        "failed to read workspace distributed task summaries from state store"
                    );
                }
            }
        }
    }

    if root_task_id == task_id {
        if let Some(summary) = remote_task_summaries.get(task_id.as_str()) {
            if let Some(record) = summary.as_object() {
                root_task_id = distributed_graph_read_string_field(
                    record,
                    &["rootTaskId", "root_task_id", "taskId", "task_id"],
                )
                .unwrap_or_else(|| task_id.clone());
            }
        }
    }

    if !local_loaded_root_task_ids.contains(root_task_id.as_str()) {
        let store = ctx.agent_tasks.read().await;
        let local_summaries = collect_local_distributed_task_graph_summary_candidates(
            &store,
            task_id.as_str(),
            root_task_id.as_str(),
        );
        drop(store);
        extend_local_distributed_task_graph_candidates(&mut local_task_summaries, local_summaries);
        local_loaded_root_task_ids.insert(root_task_id.clone());
    }

    let mut nodes = Vec::<DistributedTaskGraphNodeSummary>::new();
    let mut edges = Vec::<DistributedTaskGraphEdgeSummary>::new();
    let mut running_nodes = 0usize;
    let mut completed_nodes = 0usize;
    let mut failed_nodes = 0usize;

    for summary in local_task_summaries.values() {
        if summary.root_task_id != root_task_id {
            continue;
        }
        let node = summary.node.clone();
        match node.status.as_str() {
            "running" => running_nodes += 1,
            "completed" => completed_nodes += 1,
            "failed" => failed_nodes += 1,
            _ => {}
        }
        if let Some(parent_task_id) = node.parent_task_id.clone() {
            edges.push(DistributedTaskGraphEdgeSummary {
                from_task_id: parent_task_id,
                to_task_id: node.task_id.clone(),
                edge_type: "depends_on".to_string(),
            });
        }
        nodes.push(node);
    }

    for summary in remote_task_summaries.values() {
        let Some(record) = summary.as_object() else {
            continue;
        };
        let Some(summary_task_id) =
            distributed_graph_read_string_field(record, &["taskId", "task_id"])
        else {
            continue;
        };
        if local_task_summaries.contains_key(summary_task_id.as_str()) {
            continue;
        }
        let summary_root_task_id = distributed_graph_read_string_field(
            record,
            &["rootTaskId", "root_task_id", "taskId", "task_id"],
        )
        .unwrap_or_else(|| summary_task_id.clone());
        if summary_root_task_id != root_task_id {
            continue;
        }
        let parent_task_id =
            distributed_graph_read_string_field(record, &["parentTaskId", "parent_task_id"]);
        let node = DistributedTaskGraphNodeSummary {
            task_id: summary_task_id.clone(),
            parent_task_id: parent_task_id.clone(),
            role: distributed_graph_extract_role(record),
            backend_id: distributed_graph_read_string_field(record, &["backendId", "backend_id"]),
            status: distributed_graph_read_string_field(record, &["status"])
                .unwrap_or_else(|| "queued".to_string()),
            attempt: distributed_graph_read_u32_field(record, &["attempt"]).unwrap_or(1),
        };
        match node.status.as_str() {
            "running" => running_nodes += 1,
            "completed" => completed_nodes += 1,
            "failed" => failed_nodes += 1,
            _ => {}
        }
        if let Some(parent_task_id) = parent_task_id {
            edges.push(DistributedTaskGraphEdgeSummary {
                from_task_id: parent_task_id,
                to_task_id: summary_task_id,
                edge_type: "depends_on".to_string(),
            });
        }
        nodes.push(node);
    }

    nodes.sort_by(|left, right| left.task_id.cmp(&right.task_id));
    edges.sort_by(|left, right| {
        left.from_task_id
            .cmp(&right.from_task_id)
            .then(left.to_task_id.cmp(&right.to_task_id))
    });

    let (queue_depth, placement_failures_total, routing_health) = if include_diagnostics {
        let diagnostics = build_cached_distributed_readiness_snapshot(ctx).await;
        (
            Some(diagnostics.pending_entries),
            Some(diagnostics.placement_failures_total),
            Some(build_runtime_routing_health_payload(ctx).await),
        )
    } else {
        (None, None, None)
    };
    let total_nodes = nodes.len();
    let local_target_summary = local_task_summaries.get(task_id.as_str());
    let target_summary_record = remote_task_summaries
        .get(task_id.as_str())
        .and_then(Value::as_object);
    let target_access_mode = local_target_summary
        .and_then(|summary| summary.access_mode.clone())
        .or_else(|| {
            target_summary_record.and_then(|record| {
                distributed_graph_read_string_field(record, &["accessMode", "access_mode"])
            })
        });
    let target_routed_provider = local_target_summary
        .and_then(|summary| summary.routed_provider.clone())
        .or_else(|| {
            target_summary_record.and_then(|record| {
                distributed_graph_read_string_field(
                    record,
                    &["routedProvider", "routed_provider", "provider"],
                )
            })
        });
    let target_error_message = local_target_summary
        .and_then(|summary| summary.reason.clone())
        .or_else(|| target_summary_record.and_then(distributed_graph_read_reason_field));
    let target_execution_mode = local_target_summary
        .map(|summary| summary.execution_mode.clone())
        .or_else(|| {
            target_summary_record.and_then(|record| {
                distributed_graph_read_string_field(record, &["executionMode", "execution_mode"])
            })
        })
        .unwrap_or_else(|| "runtime".to_string());

    Ok(json!(DistributedTaskGraphSummary {
        task_id,
        root_task_id,
        nodes,
        edges,
        summary: Some(json!({
            "totalNodes": total_nodes,
            "runningNodes": running_nodes,
            "completedNodes": completed_nodes,
            "failedNodes": failed_nodes,
            "workspaceSummaryLimit": workspace_summary_limit,
            "queueDepth": queue_depth,
            "placementFailuresTotal": placement_failures_total,
            "routingHealth": routing_health,
            "accessMode": target_access_mode,
            "routedProvider": target_routed_provider,
            "executionMode": target_execution_mode,
            "reason": target_error_message,
        })),
    }))
}

fn parse_backend_capabilities(
    params: &serde_json::Map<String, Value>,
) -> Result<Vec<String>, RpcError> {
    let Some(raw_capabilities) = params.get("capabilities") else {
        return Err(RpcError::invalid_params("capabilities is required."));
    };
    let Some(entries) = raw_capabilities.as_array() else {
        return Err(RpcError::invalid_params(
            "capabilities must be an array of strings.",
        ));
    };
    let mut capabilities = entries
        .iter()
        .filter_map(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .collect::<Vec<_>>();
    if capabilities.is_empty() {
        return Err(RpcError::invalid_params(
            "capabilities must include at least one non-empty entry.",
        ));
    }
    capabilities.sort_unstable();
    capabilities.dedup();
    Ok(capabilities)
}

fn parse_optional_string_list(
    params: &serde_json::Map<String, Value>,
    key: &str,
) -> Result<Option<Vec<String>>, RpcError> {
    let Some(value) = params.get(key) else {
        return Ok(None);
    };
    if value.is_null() {
        return Ok(None);
    }
    let Some(entries) = value.as_array() else {
        return Err(RpcError::invalid_params(format!(
            "{key} must be an array of strings."
        )));
    };
    let mut normalized = entries
        .iter()
        .filter_map(Value::as_str)
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(ToOwned::to_owned)
        .collect::<Vec<_>>();
    normalized.sort_unstable();
    normalized.dedup();
    Ok((!normalized.is_empty()).then_some(normalized))
}

fn read_optional_f64_field(params: &serde_json::Map<String, Value>, key: &str) -> Option<f64> {
    params.get(key).and_then(|value| match value {
        Value::Number(number) => number.as_f64(),
        Value::String(text) => text.trim().parse::<f64>().ok(),
        _ => None,
    })
}

fn normalize_runtime_backend_class(input: &str) -> Result<String, RpcError> {
    match normalize_backend_state_value(input).as_str() {
        "primary" | "burst" | "specialized" => Ok(normalize_backend_state_value(input)),
        _ => Err(RpcError::invalid_params(format!(
            "Unsupported runtime backend class `{input}`. Expected one of: primary, burst, specialized."
        ))),
    }
}

fn normalize_runtime_backend_connectivity_mode(input: &str) -> Result<String, RpcError> {
    match normalize_backend_state_value(input).as_str() {
        "direct" | "overlay" | "gateway" => Ok(normalize_backend_state_value(input)),
        _ => Err(RpcError::invalid_params(format!(
            "Unsupported runtime backend connectivity mode `{input}`."
        ))),
    }
}

fn normalize_runtime_backend_overlay(input: &str) -> Result<String, RpcError> {
    match normalize_backend_state_value(input).as_str() {
        "tailscale" | "netbird" | "orbit" => Ok(normalize_backend_state_value(input)),
        _ => Err(RpcError::invalid_params(format!(
            "Unsupported runtime backend overlay `{input}`."
        ))),
    }
}

fn normalize_runtime_backend_reachability(input: &str) -> Result<String, RpcError> {
    match normalize_backend_state_value(input).as_str() {
        "reachable" | "degraded" | "unreachable" | "unknown" => {
            Ok(normalize_backend_state_value(input))
        }
        _ => Err(RpcError::invalid_params(format!(
            "Unsupported runtime backend reachability `{input}`."
        ))),
    }
}

fn normalize_runtime_backend_lease_status(input: &str) -> Result<String, RpcError> {
    match normalize_backend_state_value(input).as_str() {
        "active" | "expiring" | "expired" | "released" | "none" => {
            Ok(normalize_backend_state_value(input))
        }
        _ => Err(RpcError::invalid_params(format!(
            "Unsupported runtime backend lease status `{input}`."
        ))),
    }
}

fn normalize_runtime_backend_lease_scope(input: &str) -> Result<String, RpcError> {
    match normalize_backend_state_value(input).as_str() {
        "backend" | "slot" | "node" | "overlay-session" => Ok(normalize_backend_state_value(input)),
        _ => Err(RpcError::invalid_params(format!(
            "Unsupported runtime backend lease scope `{input}`."
        ))),
    }
}

fn normalize_runtime_backend_trust_tier(input: &str) -> Result<String, RpcError> {
    match normalize_backend_state_value(input).as_str() {
        "trusted" | "standard" | "isolated" => Ok(normalize_backend_state_value(input)),
        _ => Err(RpcError::invalid_params(format!(
            "Unsupported runtime backend trust tier `{input}`."
        ))),
    }
}

fn normalize_runtime_backend_data_sensitivity(input: &str) -> Result<String, RpcError> {
    match normalize_backend_state_value(input).as_str() {
        "public" | "internal" | "restricted" => Ok(normalize_backend_state_value(input)),
        _ => Err(RpcError::invalid_params(format!(
            "Unsupported runtime backend data sensitivity `{input}`."
        ))),
    }
}

fn normalize_runtime_backend_approval_policy(input: &str) -> Result<String, RpcError> {
    match normalize_backend_state_value(input).as_str() {
        "runtime-default" | "checkpoint-required" | "never-auto-approve" => {
            Ok(normalize_backend_state_value(input))
        }
        _ => Err(RpcError::invalid_params(format!(
            "Unsupported runtime backend approval policy `{input}`."
        ))),
    }
}

fn parse_runtime_backend_policy_profile(
    params: &serde_json::Map<String, Value>,
) -> Result<RuntimeBackendPolicyProfile, RpcError> {
    let Some(value) = params.get("policy") else {
        return Ok(normalize_runtime_backend_policy_profile(None));
    };
    if value.is_null() {
        return Ok(normalize_runtime_backend_policy_profile(None));
    }
    let object = as_object(value)?;
    let trust_tier = read_optional_string(object, "trustTier")
        .map(|entry| normalize_runtime_backend_trust_tier(entry.as_str()))
        .transpose()?;
    let data_sensitivity = read_optional_string(object, "dataSensitivity")
        .map(|entry| normalize_runtime_backend_data_sensitivity(entry.as_str()))
        .transpose()?;
    let approval_policy = read_optional_string(object, "approvalPolicy")
        .map(|entry| normalize_runtime_backend_approval_policy(entry.as_str()))
        .transpose()?;
    let allowed_tool_classes = parse_optional_string_list(object, "allowedToolClasses")?;

    Ok(normalize_runtime_backend_policy_profile(Some(
        RuntimeBackendPolicyProfile {
            trust_tier,
            data_sensitivity,
            approval_policy,
            allowed_tool_classes,
        },
    )))
}

fn parse_optional_runtime_backend_connectivity(
    params: &serde_json::Map<String, Value>,
) -> Result<Option<RuntimeBackendConnectivitySummary>, RpcError> {
    let Some(value) = params.get("connectivity") else {
        return Ok(None);
    };
    if value.is_null() {
        return Ok(None);
    }
    let object = as_object(value)?;
    let mode = read_optional_string(object, "mode")
        .map(|entry| normalize_runtime_backend_connectivity_mode(entry.as_str()))
        .transpose()?;
    let overlay = read_optional_string(object, "overlay")
        .map(|entry| normalize_runtime_backend_overlay(entry.as_str()))
        .transpose()?;
    let endpoint = read_optional_string(object, "endpoint");
    let reachability = read_optional_string(object, "reachability")
        .map(|entry| normalize_runtime_backend_reachability(entry.as_str()))
        .transpose()?;
    let checked_at = read_optional_u64(object, "checkedAt");
    let source = read_optional_string(object, "source");
    let reason = read_optional_string(object, "reason");

    if mode.is_none()
        && overlay.is_none()
        && endpoint.is_none()
        && reachability.is_none()
        && checked_at.is_none()
        && source.is_none()
        && reason.is_none()
    {
        return Ok(None);
    }

    Ok(Some(RuntimeBackendConnectivitySummary {
        mode,
        overlay,
        endpoint,
        reachability,
        checked_at,
        source,
        reason,
    }))
}

fn parse_optional_runtime_backend_lease(
    params: &serde_json::Map<String, Value>,
) -> Result<Option<RuntimeBackendLeaseSummary>, RpcError> {
    let Some(value) = params.get("lease") else {
        return Ok(None);
    };
    if value.is_null() {
        return Ok(None);
    }
    let object = as_object(value)?;
    let status = read_optional_string(object, "status")
        .map(|entry| normalize_runtime_backend_lease_status(entry.as_str()))
        .transpose()?
        .unwrap_or_else(|| "none".to_string());
    let lease_id = read_optional_string(object, "leaseId");
    let holder_id = read_optional_string(object, "holderId");
    let scope = read_optional_string(object, "scope")
        .map(|entry| normalize_runtime_backend_lease_scope(entry.as_str()))
        .transpose()?;
    let acquired_at = read_optional_u64(object, "acquiredAt");
    let expires_at = read_optional_u64(object, "expiresAt");
    let ttl_ms = read_optional_u64(object, "ttlMs");
    let observed_at = read_optional_u64(object, "observedAt");

    Ok(Some(RuntimeBackendLeaseSummary {
        status,
        lease_id,
        holder_id,
        scope,
        acquired_at,
        expires_at,
        ttl_ms,
        observed_at,
    }))
}

fn normalize_runtime_backend_status(input: &str) -> Result<String, RpcError> {
    match normalize_backend_state_value(input).as_str() {
        "active" | "draining" | "disabled" => Ok(normalize_backend_state_value(input)),
        _ => Err(RpcError::invalid_params(format!(
            "Unsupported runtime backend status `{input}`. Expected one of: active, draining, disabled."
        ))),
    }
}

fn normalize_runtime_backend_rollout_state(input: &str) -> Result<String, RpcError> {
    match normalize_backend_state_value(input).as_str() {
        "current" | "ramping" | "draining" | "drained" => Ok(normalize_backend_state_value(input)),
        _ => Err(RpcError::invalid_params(format!(
            "Unsupported runtime backend rolloutState `{input}`. Expected one of: current, ramping, draining, drained."
        ))),
    }
}

fn normalize_backend_state_value(input: &str) -> String {
    input.trim().to_ascii_lowercase().replace('_', "-")
}

fn is_allowed_backend_status_transition(current: &str, next: &str) -> bool {
    if current == next {
        return true;
    }
    matches!(
        (current, next),
        ("active", "draining")
            | ("draining", "active")
            | ("draining", "disabled")
            | ("active", "disabled")
            | ("disabled", "active")
    )
}

fn is_allowed_backend_rollout_transition(current: &str, next: &str) -> bool {
    if current == next {
        return true;
    }
    matches!(
        (current, next),
        ("current", "ramping")
            | ("current", "draining")
            | ("ramping", "current")
            | ("ramping", "draining")
            | ("draining", "drained")
            | ("draining", "current")
            | ("drained", "ramping")
    )
}

fn compute_backend_healthy(status: &str, health_score: f64) -> bool {
    status == "active" && health_score >= 0.8
}

async fn sync_runtime_backends_from_distributed_store(ctx: &AppContext) {
    if let Err(error) = super::sync_runtime_backends_from_distributed_store(ctx).await {
        warn!(
            error = error.as_str(),
            "failed to hydrate runtime backends from distributed store"
        );
    }
}

async fn persist_runtime_backend_to_distributed_store(
    ctx: &AppContext,
    summary: &RuntimeBackendSummary,
) {
    if let Err(error) = persist_runtime_backends_to_native_store(ctx).await {
        warn!(
            error = error.message(),
            backend_id = summary.backend_id.as_str(),
            "failed to persist runtime backend registry in native state store"
        );
    }
    if let Err(error) = persist_distributed_runtime_backend_summary(ctx, summary).await {
        warn!(
            error = error.as_str(),
            backend_id = summary.backend_id.as_str(),
            "failed to persist runtime backend in distributed store"
        );
        set_distributed_dispatch_error(ctx, DISTRIBUTED_ERROR_SOURCE_BACKEND_REGISTRY, error).await;
    } else {
        clear_distributed_dispatch_error(ctx, DISTRIBUTED_ERROR_SOURCE_BACKEND_REGISTRY).await;
    }
}

async fn remove_runtime_backend_from_distributed_store(ctx: &AppContext, backend_id: &str) {
    if let Err(error) = persist_runtime_backends_to_native_store(ctx).await {
        warn!(
            error = error.message(),
            backend_id, "failed to persist runtime backend registry removal in native state store"
        );
    }
    if let Err(error) = remove_distributed_runtime_backend(ctx, backend_id).await {
        warn!(
            error = error.as_str(),
            backend_id, "failed to remove runtime backend from distributed store"
        );
        set_distributed_dispatch_error(ctx, DISTRIBUTED_ERROR_SOURCE_BACKEND_REGISTRY, error).await;
    } else {
        clear_distributed_dispatch_error(ctx, DISTRIBUTED_ERROR_SOURCE_BACKEND_REGISTRY).await;
    }
}
