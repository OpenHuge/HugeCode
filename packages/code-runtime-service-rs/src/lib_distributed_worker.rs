fn spawn_distributed_queue_bootstrap(ctx: AppContext) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        if !ctx.distributed_config.enabled {
            return;
        }
        let Some(client) = ctx.distributed_redis_client.as_ref() else {
            return;
        };

        for lane in 0..ctx.distributed_config.lane_count {
            if let Err(error) = distributed::queue::ensure_lane_consumer_group(client, lane).await {
                warn!(
                    error = error.as_str(),
                    lane, "distributed queue bootstrap failed while creating command stream group"
                );
                set_distributed_dispatch_error(&ctx, DISTRIBUTED_ERROR_SOURCE_BOOTSTRAP, error)
                    .await;
                return;
            }
        }

        let assignments = distributed::worker::build_worker_lane_assignments(
            ctx.distributed_config.lane_count,
            ctx.distributed_config.worker_concurrency,
        );
        for (worker_index, lanes) in assignments.iter().enumerate() {
            for lane in lanes {
                let consumer_name = distributed::worker::lane_consumer_name(worker_index, *lane);
                if let Err(error) =
                    distributed::queue::ensure_lane_consumer(client, *lane, consumer_name.as_str())
                        .await
                {
                    warn!(
                        error = error.as_str(),
                        lane = lane,
                        consumer_name = consumer_name.as_str(),
                        "distributed queue bootstrap failed while creating lane consumer"
                    );
                    set_distributed_dispatch_error(&ctx, DISTRIBUTED_ERROR_SOURCE_BOOTSTRAP, error)
                        .await;
                    return;
                }
            }
        }
        clear_distributed_dispatch_error(&ctx, DISTRIBUTED_ERROR_SOURCE_BOOTSTRAP).await;
        spawn_distributed_shadow_workers(ctx, assignments);
    })
}

fn spawn_distributed_shadow_workers(ctx: AppContext, assignments: Vec<Vec<usize>>) {
    if assignments.is_empty() {
        return;
    }

    for (worker_index, lanes) in assignments.into_iter().enumerate() {
        if lanes.is_empty() {
            continue;
        }
        let worker_ctx = ctx.clone();
        tokio::spawn(async move {
            if !worker_ctx.distributed_config.enabled {
                return;
            }
            let Some(client) = worker_ctx.distributed_redis_client.as_ref() else {
                return;
            };
            let lane_consumers = lanes
                .into_iter()
                .map(|lane| {
                    let consumer_name = distributed::worker::lane_consumer_name(worker_index, lane);
                    (lane, consumer_name)
                })
                .collect::<Vec<_>>();
            let read_block_ms =
                resolve_distributed_worker_read_block_ms(lane_consumers.len());
            let mut reclaim_start_ids = lane_consumers
                .iter()
                .map(|(lane, _)| (*lane, "0-0".to_string()))
                .collect::<HashMap<usize, String>>();
            let mut loop_tick = 0u64;

            loop {
                let mut loop_error = None::<String>;
                let mut loop_had_activity = false;
                for (lane, consumer_name) in &lane_consumers {
                    match distributed::queue::read_new_commands(
                        client.as_ref(),
                        *lane,
                        consumer_name.as_str(),
                        distributed::queue::COMMAND_STREAM_READ_COUNT_DEFAULT,
                        read_block_ms,
                    )
                    .await
                    {
                        Ok(batch) => {
                            let had_batch_commands = !batch.commands.is_empty();
                            let had_batch_failures = !batch.parse_failures.is_empty();
                            if had_batch_commands || had_batch_failures {
                                loop_had_activity = true;
                            }
                            for command in batch.commands {
                                if let Err(error) =
                                    process_distributed_shadow_command(&worker_ctx, *lane, command)
                                        .await
                                {
                                    warn!(
                                        error = error.as_str(),
                                        worker_index = worker_index + 1,
                                        lane,
                                        "distributed shadow worker failed to process command"
                                    );
                                    if loop_error.is_none() {
                                        loop_error = Some(error);
                                    }
                                }
                            }
                            for failure in &batch.parse_failures {
                                warn!(
                                    worker_index = worker_index + 1,
                                    lane,
                                    command_id = failure.stream_id.as_str(),
                                    error = failure.error.as_str(),
                                    "distributed shadow worker dropping invalid command payload"
                                );
                                if let Err(error) = ack_invalid_distributed_command(
                                    client.as_ref(),
                                    *lane,
                                    consumer_name.as_str(),
                                    failure.stream_id.as_str(),
                                    "distributed",
                                    failure.error.as_str(),
                                )
                                .await
                                {
                                    if loop_error.is_none() {
                                        loop_error = Some(error);
                                    }
                                }
                            }
                        }
                        Err(error) => {
                            warn!(
                                error = error.as_str(),
                                worker_index = worker_index + 1,
                                lane,
                                "distributed shadow worker read failed"
                            );
                            if loop_error.is_none() {
                                loop_error = Some(error);
                            }
                        }
                    }

                    if should_reclaim_distributed_pending(loop_tick, worker_index) {
                        let reclaim_start = reclaim_start_ids
                            .get(lane)
                            .cloned()
                            .unwrap_or_else(|| "0-0".to_string());
                        match distributed::queue::reclaim_idle_commands(
                            client.as_ref(),
                            *lane,
                            consumer_name.as_str(),
                            worker_ctx.distributed_config.claim_idle_ms,
                            reclaim_start.as_str(),
                            distributed::queue::COMMAND_STREAM_RECLAIM_COUNT_DEFAULT,
                        )
                        .await
                        {
                            Ok(reclaimed) => {
                                let had_reclaimed_commands = !reclaimed.commands.is_empty();
                                let had_reclaimed_failures = !reclaimed.parse_failures.is_empty();
                                if had_reclaimed_commands || had_reclaimed_failures {
                                    loop_had_activity = true;
                                }
                                reclaim_start_ids.insert(*lane, reclaimed.next_start_id.clone());
                                for command in reclaimed.commands {
                                    if let Err(error) = process_distributed_shadow_command(
                                        &worker_ctx,
                                        *lane,
                                        command,
                                    )
                                    .await
                                    {
                                        warn!(
                                            error = error.as_str(),
                                            worker_index = worker_index + 1,
                                            lane,
                                            "distributed shadow worker failed to process reclaimed command"
                                        );
                                        if loop_error.is_none() {
                                            loop_error = Some(error);
                                        }
                                    }
                                }
                                for failure in &reclaimed.parse_failures {
                                    warn!(
                                        worker_index = worker_index + 1,
                                        lane,
                                        command_id = failure.stream_id.as_str(),
                                        error = failure.error.as_str(),
                                        "distributed shadow worker dropping invalid reclaimed command payload"
                                    );
                                    if let Err(error) = ack_invalid_distributed_command(
                                        client.as_ref(),
                                        *lane,
                                        consumer_name.as_str(),
                                        failure.stream_id.as_str(),
                                        "reclaimed distributed",
                                        failure.error.as_str(),
                                    )
                                    .await
                                    {
                                        if loop_error.is_none() {
                                            loop_error = Some(error);
                                        }
                                    }
                                }
                            }
                            Err(error) => {
                                warn!(
                                    error = error.as_str(),
                                    worker_index = worker_index + 1,
                                    lane,
                                    "distributed shadow worker reclaim failed"
                                );
                                if loop_error.is_none() {
                                    loop_error = Some(error);
                                }
                            }
                        }
                    }
                }

                if let Some(error) = loop_error {
                    set_distributed_dispatch_error(
                        &worker_ctx,
                        DISTRIBUTED_ERROR_SOURCE_WORKER,
                        error,
                    )
                    .await;
                } else {
                    clear_distributed_dispatch_error(&worker_ctx, DISTRIBUTED_ERROR_SOURCE_WORKER)
                        .await;
                }

                loop_tick = loop_tick.wrapping_add(1);
                if should_sleep_after_distributed_worker_iteration(read_block_ms, loop_had_activity)
                {
                    tokio::time::sleep(Duration::from_millis(DISTRIBUTED_WORKER_POLL_INTERVAL_MS))
                        .await;
                } else if read_block_ms == 0 {
                    tokio::task::yield_now().await;
                }
            }
        });
    }
}

async fn ack_invalid_distributed_command(
    client: &redis::Client,
    lane: usize,
    consumer_name: &str,
    stream_id: &str,
    command_scope: &str,
    parse_error: &str,
) -> Result<(), String> {
    let record_error = distributed::queue::record_invalid_command(
        client,
        lane,
        stream_id,
        consumer_name,
        command_scope,
        parse_error,
    )
    .await
    .err();
    let acked = distributed::queue::ack_command(client, lane, stream_id).await?;
    if !acked {
        return Err(format!(
            "Failed to acknowledge invalid {command_scope} command `{stream_id}` on lane {lane}."
        ));
    }
    if let Some(error) = record_error {
        return Err(error);
    }
    Ok(())
}

async fn process_distributed_shadow_command(
    ctx: &AppContext,
    lane: usize,
    command: distributed::queue::QueuedDistributedCommand,
) -> Result<(), String> {
    let command_id = command.stream_id.clone();
    let envelope = command.envelope;

    if envelope.lane != lane {
        warn!(
            expected_lane = lane,
            actual_lane = envelope.lane,
            command_id = command_id.as_str(),
            kind = envelope.kind.as_str(),
            task_id = envelope.task_id.as_str(),
            "distributed shadow worker observed lane mismatch; acknowledging command"
        );
    }
    if !is_supported_distributed_command_kind(envelope.kind.as_str()) {
        warn!(
            lane,
            command_id = command_id.as_str(),
            kind = envelope.kind.as_str(),
            task_id = envelope.task_id.as_str(),
            "distributed shadow worker observed unknown command kind; acknowledging command"
        );
    }

    let Some(client) = ctx.distributed_redis_client.as_ref() else {
        return Err("Distributed redis client is unavailable for shadow command ack.".to_string());
    };
    let acked = distributed::queue::ack_command(client.as_ref(), lane, command_id.as_str()).await?;
    if !acked {
        return Err(format!(
            "Shadow worker failed to acknowledge distributed command `{command_id}` on lane {lane}."
        ));
    }
    Ok(())
}

fn should_reclaim_distributed_pending(loop_tick: u64, worker_index: usize) -> bool {
    if DISTRIBUTED_WORKER_RECLAIM_INTERVAL_LOOPS == 0 {
        return false;
    }
    let offset = (worker_index as u64) % DISTRIBUTED_WORKER_RECLAIM_INTERVAL_LOOPS;
    (loop_tick + offset) % DISTRIBUTED_WORKER_RECLAIM_INTERVAL_LOOPS == 0
}

fn resolve_distributed_worker_read_block_ms(lane_count: usize) -> u64 {
    if lane_count == 1 {
        DISTRIBUTED_WORKER_POLL_INTERVAL_MS
    } else {
        0
    }
}

fn should_sleep_after_distributed_worker_iteration(read_block_ms: u64, had_activity: bool) -> bool {
    read_block_ms == 0 && !had_activity
}

fn spawn_distributed_state_sync(ctx: AppContext) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        if !ctx.distributed_config.enabled || ctx.distributed_redis_client.is_none() {
            return;
        }
        let mut last_synced_updated_at = HashMap::<String, u64>::new();

        loop {
            tokio::time::sleep(Duration::from_millis(DISTRIBUTED_STATE_SYNC_INTERVAL_MS)).await;
            let (active_task_ids, summaries_to_sync) = {
                let store = ctx.agent_tasks.read().await;
                let mut active_task_ids = HashSet::<String>::with_capacity(store.tasks.len());
                let mut summaries_to_sync = Vec::new();
                for runtime in store.tasks.values() {
                    let summary = &runtime.summary;
                    active_task_ids.insert(summary.task_id.clone());
                    if last_synced_updated_at
                        .get(summary.task_id.as_str())
                        .is_some_and(|synced| *synced == summary.updated_at)
                    {
                        continue;
                    }
                    summaries_to_sync.push(summary.clone());
                }
                (active_task_ids, summaries_to_sync)
            };
            if active_task_ids.is_empty() {
                last_synced_updated_at.clear();
                clear_distributed_dispatch_error(&ctx, DISTRIBUTED_ERROR_SOURCE_STATE_SYNC).await;
                continue;
            }

            let mut sync_error = None::<String>;
            for summary in summaries_to_sync {
                if let Err(error) = persist_distributed_task_summary(&ctx, &summary).await {
                    warn!(
                        error = error.as_str(),
                        task_id = summary.task_id.as_str(),
                        "distributed task summary sync failed for task"
                    );
                    if sync_error.is_none() {
                        sync_error = Some(error);
                    }
                    continue;
                }
                last_synced_updated_at.insert(summary.task_id.clone(), summary.updated_at);
            }

            if let Some(error) = sync_error {
                set_distributed_dispatch_error(&ctx, DISTRIBUTED_ERROR_SOURCE_STATE_SYNC, error)
                    .await;
            } else {
                last_synced_updated_at
                    .retain(|task_id, _| active_task_ids.contains(task_id.as_str()));
                clear_distributed_dispatch_error(&ctx, DISTRIBUTED_ERROR_SOURCE_STATE_SYNC).await;
            }
        }
    })
}

fn spawn_distributed_discovery_sync(ctx: AppContext) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        if !ctx.distributed_config.enabled || !ctx.config.discovery_enabled {
            return;
        }
        let service_type = ctx.config.discovery_service_type.clone();
        let browse_interval_ms = ctx.config.discovery_browse_interval_ms.max(250);
        let stale_ttl_ms = ctx.config.discovery_stale_ttl_ms.max(browse_interval_ms);
        let local_backend_id = ctx.config.runtime_backend_id.clone();

        let advertised = start_discovery_advertisement(&ctx).await;
        if let Err(error) = advertised {
            warn!(
                error = error.as_str(),
                "distributed discovery advertisement bootstrap failed"
            );
            set_distributed_dispatch_error(&ctx, DISTRIBUTED_ERROR_SOURCE_DISCOVERY, error).await;
        }

        loop {
            upsert_local_runtime_backend_summary(&ctx).await;
            let loop_error =
                match browse_discovered_runtime_backends(service_type.as_str(), browse_interval_ms)
                    .await
                {
                Ok(discovered) => {
                    let now = now_ms();
                    for summary in discovered {
                        if summary.backend_id == local_backend_id {
                            continue;
                        }
                        let was_upserted =
                            upsert_discovered_runtime_backend_summary(&ctx, summary, now).await;
                        if was_upserted {
                            ctx.discovery_upsert_total.fetch_add(1, Ordering::Relaxed);
                        }
                    }
                    if let Err(error) = prune_stale_discovered_backends(&ctx, now, stale_ttl_ms).await
                    {
                        Some(error)
                    } else {
                        None
                    }
                }
                Err(error) => {
                    Some(error)
                }
            };

            if let Some(error) = loop_error {
                set_distributed_dispatch_error(&ctx, DISTRIBUTED_ERROR_SOURCE_DISCOVERY, error).await;
            } else {
                clear_distributed_dispatch_error(&ctx, DISTRIBUTED_ERROR_SOURCE_DISCOVERY).await;
            }
            tokio::time::sleep(Duration::from_millis(browse_interval_ms)).await;
        }
    })
}

async fn start_discovery_advertisement(ctx: &AppContext) -> Result<(), String> {
    let metadata = build_local_discovery_backend_metadata(ctx);
    let service_type = ctx.config.discovery_service_type.clone();
    let instance_name = metadata.backend_id.clone();
    let port = ctx.config.runtime_port;
    let properties = discovery_rs::encode_runtime_backend_properties(&metadata);
    let advertisement_id = tokio::task::spawn_blocking(move || {
        discovery_rs::advertise_start(
            service_type.as_str(),
            instance_name.as_str(),
            port,
            Some(properties),
        )
    })
    .await
    .map_err(|error| format!("Discovery advertisement task failed: {error}"))??;
    ctx.discovery_advertisement.set(advertisement_id);
    Ok(())
}

fn build_local_discovery_backend_metadata(
    ctx: &AppContext,
) -> discovery_rs::RuntimeBackendAdvertisementMetadata {
    discovery_rs::RuntimeBackendAdvertisementMetadata {
        backend_id: ctx.config.runtime_backend_id.clone(),
        display_name: Some(ctx.config.runtime_backend_id.clone()),
        capabilities: ctx.config.runtime_backend_capabilities.clone(),
        max_concurrency: ctx.distributed_config.worker_concurrency as u64,
        cost_tier: "standard".to_string(),
        latency_class: "regional".to_string(),
        rollout_state: "current".to_string(),
        status: "active".to_string(),
    }
}

fn local_runtime_backend_summary(ctx: &AppContext, now: u64) -> RuntimeBackendSummary {
    let metadata = build_local_discovery_backend_metadata(ctx);
    let mut summary = RuntimeBackendSummary {
        backend_id: metadata.backend_id.clone(),
        display_name: metadata
            .display_name
            .unwrap_or_else(|| metadata.backend_id.clone()),
        capabilities: metadata.capabilities,
        max_concurrency: metadata.max_concurrency.max(1),
        cost_tier: metadata.cost_tier,
        latency_class: metadata.latency_class,
        rollout_state: metadata.rollout_state,
        status: metadata.status.clone(),
        healthy: metadata.status == "active",
        health_score: if metadata.status == "active" { 1.0 } else { 0.0 },
        failures: 0,
        queue_depth: 0,
        running_tasks: 0,
        created_at: now,
        updated_at: now,
        last_heartbeat_at: now,
        heartbeat_interval_ms: None,
        backend_class: None,
        specializations: None,
        policy: Some(default_runtime_backend_policy_profile()),
        connectivity: None,
        lease: None,
        readiness: None,
        backend_kind: Some("native".to_string()),
        integration_id: None,
        transport: None,
        origin: Some("runtime-native".to_string()),
        contract: None,
    };
    summary.contract = Some(build_runtime_backend_contract(&summary));
    summary
}

async fn upsert_local_runtime_backend_summary(ctx: &AppContext) {
    let now = now_ms();
    let summary = local_runtime_backend_summary(ctx, now);
    {
        let mut backends = ctx.runtime_backends.write().await;
        let created_at = backends
            .get(summary.backend_id.as_str())
            .map(|existing| existing.created_at)
            .unwrap_or(now);
        let mut next = summary.clone();
        next.created_at = created_at;
        backends.insert(next.backend_id.clone(), next.clone());
        if let Err(error) = persist_distributed_runtime_backend_summary(ctx, &next).await {
            warn!(
                error = error.as_str(),
                backend_id = next.backend_id.as_str(),
                "failed to persist local discovery backend summary"
            );
            set_distributed_dispatch_error(ctx, DISTRIBUTED_ERROR_SOURCE_DISCOVERY, error).await;
        }
    }
}

async fn browse_discovered_runtime_backends(
    service_type: &str,
    browse_interval_ms: u64,
) -> Result<Vec<RuntimeBackendSummary>, String> {
    let service_type = service_type.to_string();
    let timeout_ms = browse_interval_ms.min(5_000) as u32;
    let discovered = tokio::task::spawn_blocking(move || {
        discovery_rs::discover_once(service_type.as_str(), timeout_ms)
    })
    .await
    .map_err(|error| format!("Discovery browse task failed: {error}"))??;
    let now = now_ms();
    let mut summaries = Vec::new();
    for service in discovered {
        match discovery_rs::decode_runtime_backend_properties(service.properties.as_slice()) {
            Ok(metadata) => {
                let mut summary = RuntimeBackendSummary {
                    backend_id: metadata.backend_id.clone(),
                    display_name: metadata
                        .display_name
                        .unwrap_or_else(|| metadata.backend_id.clone()),
                    capabilities: metadata.capabilities,
                    max_concurrency: metadata.max_concurrency.max(1),
                    cost_tier: metadata.cost_tier,
                    latency_class: metadata.latency_class,
                    rollout_state: metadata.rollout_state,
                    status: metadata.status.clone(),
                    healthy: metadata.status == "active",
                    health_score: if metadata.status == "active" { 1.0 } else { 0.0 },
                    failures: 0,
                    queue_depth: 0,
                    running_tasks: 0,
                    created_at: now,
                    updated_at: now,
                    last_heartbeat_at: now,
                    heartbeat_interval_ms: None,
                    backend_class: None,
                    specializations: None,
                    policy: Some(default_runtime_backend_policy_profile()),
                    connectivity: None,
                    lease: None,
                    readiness: None,
                    backend_kind: Some("native".to_string()),
                    integration_id: None,
                    transport: None,
                    origin: Some("runtime-native".to_string()),
                    contract: None,
                };
                summary.contract = Some(build_runtime_backend_contract(&summary));
                summaries.push(summary);
            }
            Err(error) => {
                warn!(
                    error = error.as_str(),
                    service = service.fullname.as_str(),
                    "skipping discovered service with invalid backend metadata"
                );
            }
        }
    }
    Ok(summaries)
}

async fn upsert_discovered_runtime_backend_summary(
    ctx: &AppContext,
    mut summary: RuntimeBackendSummary,
    now: u64,
) -> bool {
    let mut managed = ctx.discovery_managed_backends.write().await;
    let mut backends = ctx.runtime_backends.write().await;
    let is_managed = managed.contains_key(summary.backend_id.as_str());
    if backends.contains_key(summary.backend_id.as_str()) && !is_managed {
        return false;
    }

    if let Some(existing) = backends.get(summary.backend_id.as_str()) {
        summary.created_at = existing.created_at;
        summary.failures = existing.failures;
        summary.queue_depth = existing.queue_depth;
        summary.running_tasks = existing.running_tasks;
    } else {
        summary.created_at = now;
    }
    summary.updated_at = now;
    summary.last_heartbeat_at = now;
    backends.insert(summary.backend_id.clone(), summary.clone());
    managed.insert(summary.backend_id.clone(), now);
    drop(backends);
    drop(managed);
    if let Err(error) = persist_distributed_runtime_backend_summary(ctx, &summary).await {
        warn!(
            error = error.as_str(),
            backend_id = summary.backend_id.as_str(),
            "failed to persist discovered runtime backend summary"
        );
        set_distributed_dispatch_error(ctx, DISTRIBUTED_ERROR_SOURCE_DISCOVERY, error).await;
    }
    true
}

async fn prune_stale_discovered_backends(
    ctx: &AppContext,
    now: u64,
    stale_ttl_ms: u64,
) -> Result<(), String> {
    let stale_backend_ids = {
        let managed = ctx.discovery_managed_backends.read().await;
        managed
            .iter()
            .filter(|(_, last_seen)| now.saturating_sub(**last_seen) > stale_ttl_ms)
            .map(|(backend_id, _)| backend_id.clone())
            .collect::<Vec<_>>()
    };
    if stale_backend_ids.is_empty() {
        return Ok(());
    }
    {
        let mut managed = ctx.discovery_managed_backends.write().await;
        for backend_id in &stale_backend_ids {
            managed.remove(backend_id.as_str());
        }
    }
    for backend_id in stale_backend_ids {
        let removed_local = {
            let mut backends = ctx.runtime_backends.write().await;
            backends.remove(backend_id.as_str()).is_some()
        };
        if removed_local {
            ctx.discovery_stale_remove_total
                .fetch_add(1, Ordering::Relaxed);
        }
        if let Err(error) = remove_distributed_runtime_backend(ctx, backend_id.as_str()).await {
            return Err(error);
        }
    }
    Ok(())
}

fn compute_pending_task_metrics<'a, I>(summaries: I, now: u64) -> (u64, Option<u64>)
where
    I: IntoIterator<Item = (&'a str, u64)>,
{
    let mut pending_entries = 0u64;
    let mut oldest_created_at = None::<u64>;
    for (status, created_at) in summaries {
        if is_agent_task_terminal_status(status) {
            continue;
        }
        pending_entries += 1;
        oldest_created_at = Some(match oldest_created_at {
            Some(current_oldest) => current_oldest.min(created_at),
            None => created_at,
        });
    }
    let oldest_pending_ms = oldest_created_at.map(|created_at| now.saturating_sub(created_at));
    (pending_entries, oldest_pending_ms)
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum DistributedCommandEnqueueMode {
    Strict,
    BestEffort,
}

fn distributed_enqueue_mode_for_kind(kind: &str) -> DistributedCommandEnqueueMode {
    match kind {
        distributed::queue::COMMAND_KIND_TASK_START => DistributedCommandEnqueueMode::Strict,
        distributed::queue::COMMAND_KIND_TASK_INTERRUPT
        | distributed::queue::COMMAND_KIND_APPROVAL_DECISION => {
            DistributedCommandEnqueueMode::BestEffort
        }
        _ => DistributedCommandEnqueueMode::Strict,
    }
}

fn is_supported_distributed_command_kind(kind: &str) -> bool {
    matches!(
        kind,
        distributed::queue::COMMAND_KIND_TASK_START
            | distributed::queue::COMMAND_KIND_TASK_INTERRUPT
            | distributed::queue::COMMAND_KIND_APPROVAL_DECISION
    )
}
