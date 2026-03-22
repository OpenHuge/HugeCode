use super::*;

const CODE_RUNTIME_SERVICE_LIFECYCLE_SWEEPER_ENABLED_ENV: &str =
    "CODE_RUNTIME_SERVICE_LIFECYCLE_SWEEPER_ENABLED";
const CODE_RUNTIME_SERVICE_LIFECYCLE_SWEEP_INTERVAL_MS_ENV: &str =
    "CODE_RUNTIME_SERVICE_LIFECYCLE_SWEEP_INTERVAL_MS";
const CODE_RUNTIME_SERVICE_LIFECYCLE_SWEEPER_MODE_ENV: &str =
    "CODE_RUNTIME_SERVICE_LIFECYCLE_SWEEPER_MODE";
const CODE_RUNTIME_SERVICE_LIFECYCLE_SWEEPER_LEASE_TTL_MS_ENV: &str =
    "CODE_RUNTIME_SERVICE_LIFECYCLE_SWEEPER_LEASE_TTL_MS";
const CODE_RUNTIME_SERVICE_LIFECYCLE_SWEEPER_LEASE_RENEW_MS_ENV: &str =
    "CODE_RUNTIME_SERVICE_LIFECYCLE_SWEEPER_LEASE_RENEW_MS";
const CODE_RUNTIME_SERVICE_LIFECYCLE_SWEEPER_LEASE_KEY_ENV: &str =
    "CODE_RUNTIME_SERVICE_LIFECYCLE_SWEEPER_LEASE_KEY";
const CODE_RUNTIME_SERVICE_LIFECYCLE_OBSERVABILITY_ENABLED_ENV: &str =
    "CODE_RUNTIME_SERVICE_LIFECYCLE_OBSERVABILITY_ENABLED";
const CODE_RUNTIME_SERVICE_RUNTIME_UPDATED_EMIT_MIN_INTERVAL_MS_ENV: &str =
    "CODE_RUNTIME_SERVICE_RUNTIME_UPDATED_EMIT_MIN_INTERVAL_MS";
const CODE_RUNTIME_SERVICE_LIFECYCLE_LEASE_DEGRADED_AFTER_MS_ENV: &str =
    "CODE_RUNTIME_SERVICE_LIFECYCLE_LEASE_DEGRADED_AFTER_MS";
const CODE_RUNTIME_SERVICE_TEST_FAULT_INJECTION_ENABLED_ENV: &str =
    "CODE_RUNTIME_SERVICE_TEST_FAULT_INJECTION_ENABLED";
const CODE_RUNTIME_SERVICE_TEST_FAULT_PROFILE_ENV: &str =
    "CODE_RUNTIME_SERVICE_TEST_FAULT_PROFILE";
const DEFAULT_LIFECYCLE_SWEEPER_LEASE_KEY: &str = "runtime:lifecycle:sweeper:lease";
const DEFAULT_LIFECYCLE_SWEEP_INTERVAL_MS: u64 = 5_000;
const MIN_LIFECYCLE_SWEEP_INTERVAL_MS: u64 = 1_000;
const MAX_LIFECYCLE_SWEEP_INTERVAL_MS: u64 = 60_000;
const DEFAULT_LIFECYCLE_SWEEPER_LEASE_TTL_MS: u64 = 15_000;
const MIN_LIFECYCLE_SWEEPER_LEASE_TTL_MS: u64 = 5_000;
const MAX_LIFECYCLE_SWEEPER_LEASE_TTL_MS: u64 = 120_000;
const DEFAULT_LIFECYCLE_SWEEPER_LEASE_RENEW_MS: u64 = 5_000;
const MIN_LIFECYCLE_SWEEPER_LEASE_RENEW_MS: u64 = 1_000;
const MAX_LIFECYCLE_SWEEPER_LEASE_RENEW_MS: u64 = 60_000;
const DEFAULT_RUNTIME_UPDATED_EMIT_MIN_INTERVAL_MS: u64 = 1_000;
const MIN_RUNTIME_UPDATED_EMIT_MIN_INTERVAL_MS: u64 = 200;
const MAX_RUNTIME_UPDATED_EMIT_MIN_INTERVAL_MS: u64 = 10_000;
const DEFAULT_LIFECYCLE_LEASE_DEGRADED_AFTER_MS: u64 = 30_000;
const MIN_LIFECYCLE_LEASE_DEGRADED_AFTER_MS: u64 = 5_000;
const MAX_LIFECYCLE_LEASE_DEGRADED_AFTER_MS: u64 = 300_000;
const LEASE_ERROR_REDIS_UNAVAILABLE: &str = "LEASE_REDIS_UNAVAILABLE";
const LEASE_ERROR_ACQUIRE_FAILED: &str = "LEASE_ACQUIRE_FAILED";
const LEASE_ERROR_RENEW_FAILED: &str = "LEASE_RENEW_FAILED";
const LEASE_ERROR_LOST: &str = "LEASE_LOST";
const LEASE_ERROR_CONTENDED: &str = "LEASE_CONTENDED";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum LifecycleSweeperMode {
    Local,
    LeaderLease,
}

impl LifecycleSweeperMode {
    fn as_str(self) -> &'static str {
        match self {
            Self::Local => "local",
            Self::LeaderLease => "leader_lease",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum LifecycleTestFaultProfile {
    None,
    LeaseRenewFail,
    RedisTimeout,
    CasStaleSpike,
}

fn lifecycle_observability_enabled() -> bool {
    !matches!(
        std::env::var(CODE_RUNTIME_SERVICE_LIFECYCLE_OBSERVABILITY_ENABLED_ENV)
            .ok()
            .map(|value| value.trim().to_ascii_lowercase())
            .as_deref(),
        Some("0" | "false" | "no" | "off")
    )
}

fn resolve_runtime_updated_emit_min_interval_ms() -> u64 {
    std::env::var(CODE_RUNTIME_SERVICE_RUNTIME_UPDATED_EMIT_MIN_INTERVAL_MS_ENV)
        .ok()
        .and_then(|value| value.trim().parse::<u64>().ok())
        .map(|value| {
            if value == 0 {
                0
            } else {
                value.clamp(
                    MIN_RUNTIME_UPDATED_EMIT_MIN_INTERVAL_MS,
                    MAX_RUNTIME_UPDATED_EMIT_MIN_INTERVAL_MS,
                )
            }
        })
        .unwrap_or(DEFAULT_RUNTIME_UPDATED_EMIT_MIN_INTERVAL_MS)
}

fn resolve_lifecycle_lease_degraded_after_ms() -> u64 {
    std::env::var(CODE_RUNTIME_SERVICE_LIFECYCLE_LEASE_DEGRADED_AFTER_MS_ENV)
        .ok()
        .and_then(|value| value.trim().parse::<u64>().ok())
        .map(|value| {
            value.clamp(
                MIN_LIFECYCLE_LEASE_DEGRADED_AFTER_MS,
                MAX_LIFECYCLE_LEASE_DEGRADED_AFTER_MS,
            )
        })
        .unwrap_or(DEFAULT_LIFECYCLE_LEASE_DEGRADED_AFTER_MS)
}

fn lifecycle_test_fault_injection_enabled() -> bool {
    matches!(
        std::env::var(CODE_RUNTIME_SERVICE_TEST_FAULT_INJECTION_ENABLED_ENV)
            .ok()
            .map(|value| value.trim().to_ascii_lowercase())
            .as_deref(),
        Some("1" | "true" | "yes" | "on")
    )
}

fn resolve_lifecycle_test_fault_profile() -> LifecycleTestFaultProfile {
    if !lifecycle_test_fault_injection_enabled() {
        return LifecycleTestFaultProfile::None;
    }
    match std::env::var(CODE_RUNTIME_SERVICE_TEST_FAULT_PROFILE_ENV)
        .ok()
        .map(|value| value.trim().to_ascii_lowercase())
        .as_deref()
    {
        Some("lease_renew_fail" | "lease-renew-fail") => LifecycleTestFaultProfile::LeaseRenewFail,
        Some("redis_timeout" | "redis-timeout") => LifecycleTestFaultProfile::RedisTimeout,
        Some("cas_stale_spike" | "cas-stale-spike") => LifecycleTestFaultProfile::CasStaleSpike,
        _ => LifecycleTestFaultProfile::None,
    }
}

pub(super) fn resolve_default_workspace_path() -> String {
    std::env::var(CODE_RUNTIME_DEFAULT_WORKSPACE_PATH_ENV)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .or_else(|| {
            std::env::current_dir().ok().and_then(|path| {
                let display = path.to_string_lossy().trim().to_string();
                if display.is_empty() {
                    None
                } else {
                    Some(display)
                }
            })
        })
        .unwrap_or_else(|| ".".to_string())
}

pub(super) fn truncate_text_for_error(value: &str, max_chars: usize) -> String {
    if value.chars().count() <= max_chars {
        return value.to_string();
    }
    value.chars().take(max_chars).collect::<String>() + "..."
}

fn lifecycle_sweeper_enabled() -> bool {
    !matches!(
        std::env::var(CODE_RUNTIME_SERVICE_LIFECYCLE_SWEEPER_ENABLED_ENV)
            .ok()
            .map(|value| value.trim().to_ascii_lowercase())
            .as_deref(),
        Some("0" | "false" | "no" | "off")
    )
}

fn resolve_lifecycle_sweep_interval_ms() -> u64 {
    std::env::var(CODE_RUNTIME_SERVICE_LIFECYCLE_SWEEP_INTERVAL_MS_ENV)
        .ok()
        .and_then(|value| value.trim().parse::<u64>().ok())
        .map(|value| {
            value.clamp(
                MIN_LIFECYCLE_SWEEP_INTERVAL_MS,
                MAX_LIFECYCLE_SWEEP_INTERVAL_MS,
            )
        })
        .unwrap_or(DEFAULT_LIFECYCLE_SWEEP_INTERVAL_MS)
}

fn resolve_lifecycle_sweeper_mode(distributed_enabled: bool) -> LifecycleSweeperMode {
    let default_mode = if distributed_enabled {
        LifecycleSweeperMode::LeaderLease
    } else {
        LifecycleSweeperMode::Local
    };
    match std::env::var(CODE_RUNTIME_SERVICE_LIFECYCLE_SWEEPER_MODE_ENV)
        .ok()
        .map(|value| value.trim().to_ascii_lowercase())
        .as_deref()
    {
        Some("local") => LifecycleSweeperMode::Local,
        Some("leader_lease" | "leader-lease") => LifecycleSweeperMode::LeaderLease,
        _ => default_mode,
    }
}

fn resolve_lifecycle_sweeper_lease_ttl_ms() -> u64 {
    std::env::var(CODE_RUNTIME_SERVICE_LIFECYCLE_SWEEPER_LEASE_TTL_MS_ENV)
        .ok()
        .and_then(|value| value.trim().parse::<u64>().ok())
        .map(|value| {
            value.clamp(
                MIN_LIFECYCLE_SWEEPER_LEASE_TTL_MS,
                MAX_LIFECYCLE_SWEEPER_LEASE_TTL_MS,
            )
        })
        .unwrap_or(DEFAULT_LIFECYCLE_SWEEPER_LEASE_TTL_MS)
}

fn resolve_lifecycle_sweeper_lease_renew_ms() -> u64 {
    std::env::var(CODE_RUNTIME_SERVICE_LIFECYCLE_SWEEPER_LEASE_RENEW_MS_ENV)
        .ok()
        .and_then(|value| value.trim().parse::<u64>().ok())
        .map(|value| {
            value.clamp(
                MIN_LIFECYCLE_SWEEPER_LEASE_RENEW_MS,
                MAX_LIFECYCLE_SWEEPER_LEASE_RENEW_MS,
            )
        })
        .unwrap_or(DEFAULT_LIFECYCLE_SWEEPER_LEASE_RENEW_MS)
}

fn resolve_lifecycle_sweeper_lease_key() -> String {
    std::env::var(CODE_RUNTIME_SERVICE_LIFECYCLE_SWEEPER_LEASE_KEY_ENV)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| DEFAULT_LIFECYCLE_SWEEPER_LEASE_KEY.to_string())
}

async fn set_lifecycle_sweeper_observability_state(
    ctx: &AppContext,
    lease_state_hint: &str,
    error_code: Option<&str>,
    mark_renewed: bool,
    mark_sweep: bool,
    unhealthy: bool,
    degraded_after_ms: u64,
) -> bool {
    let now = now_ms();
    let mut observability = ctx.lifecycle_sweeper_observability.write().await;
    let previous_state = observability.lease_state.clone();
    if unhealthy {
        if observability.lease_unhealthy_since_at.is_none() {
            observability.lease_unhealthy_since_at = Some(now);
        }
    } else {
        observability.lease_unhealthy_since_at = None;
    }
    let next_state = if unhealthy
        && observability
            .lease_unhealthy_since_at
            .is_some_and(|since| now.saturating_sub(since) >= degraded_after_ms)
    {
        "degraded".to_string()
    } else {
        lease_state_hint.to_string()
    };
    observability.lease_state = next_state.clone();
    if let Some(error_code) = error_code {
        observability.last_lease_error_code = Some(error_code.to_string());
    } else if !unhealthy {
        observability.last_lease_error_code = None;
    }
    if mark_renewed {
        observability.last_lease_renew_at = Some(now);
    }
    if mark_sweep {
        observability.last_sweep_at = Some(now);
    }
    let degraded_transition = (previous_state == "degraded") != (next_state == "degraded");
    degraded_transition
}

async fn maybe_publish_lifecycle_runtime_updated_event(
    ctx: &AppContext,
    last_emit_at_ms: &mut u64,
    min_interval_ms: u64,
    force_emit: bool,
    reason: &str,
) {
    if !lifecycle_observability_enabled() {
        return;
    }
    let now = now_ms();
    if !force_emit
        && min_interval_ms > 0
        && now.saturating_sub(*last_emit_at_ms) < min_interval_ms
    {
        return;
    }
    let (event_at_ms, diagnostics) =
        prepare_runtime_updated_diagnostics_payload_for_emit(ctx, None, None, None, Some(reason))
            .await;
    publish_runtime_updated_event_at(ctx, &["agents"], reason, Some(diagnostics), event_at_ms);
    *last_emit_at_ms = now;
}

fn spawn_lifecycle_sweeper(ctx: AppContext) -> Option<tokio::task::JoinHandle<()>> {
    if !lifecycle_sweeper_enabled() {
        return None;
    }
    let sweep_interval_ms = resolve_lifecycle_sweep_interval_ms();
    let lifecycle_sweeper_mode = if ctx.lifecycle_sweeper_mode == LifecycleSweeperMode::LeaderLease.as_str()
    {
        LifecycleSweeperMode::LeaderLease
    } else {
        LifecycleSweeperMode::Local
    };
    let lease_key = resolve_lifecycle_sweeper_lease_key();
    let lease_ttl_ms = resolve_lifecycle_sweeper_lease_ttl_ms();
    let lease_renew_ms = resolve_lifecycle_sweeper_lease_renew_ms().min(lease_ttl_ms.max(1));
    let lease_degraded_after_ms = resolve_lifecycle_lease_degraded_after_ms();
    let runtime_updated_emit_min_interval_ms = resolve_runtime_updated_emit_min_interval_ms();
    let test_fault_profile = resolve_lifecycle_test_fault_profile();
    Some(tokio::spawn(async move {
        {
            let mut leader = ctx.lifecycle_sweeper_lease_leader.write().await;
            *leader = None;
        }
        {
            let _ = set_lifecycle_sweeper_observability_state(
                &ctx,
                "follower",
                None,
                false,
                false,
                false,
                lease_degraded_after_ms,
            )
            .await;
        }
        let mut ticker = tokio::time::interval(Duration::from_millis(sweep_interval_ms));
        ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        let lease_token = format!(
            "{}:{}",
            ctx.config.runtime_backend_id,
            new_id("lifecycle-sweeper-lease")
        );
        let mut lease_held = false;
        let mut last_lease_renew_at = Instant::now();
        let mut last_runtime_updated_emit_at_ms = 0u64;
        loop {
            ticker.tick().await;
            let mut should_emit_runtime_updated = false;
            let mut force_runtime_updated = false;
            let mut runtime_updated_reason = "runtime_lifecycle_sweeper";
            if lifecycle_sweeper_mode == LifecycleSweeperMode::LeaderLease {
                let Some(redis_client) = ctx.distributed_redis_client.as_ref() else {
                    crate::runtime_tool_safety_counters::record_runtime_tool_safety_counter(
                        &ctx,
                        runtime_tool_metrics::RuntimeToolSafetyCounter::LifecycleLeaseAcquireFail,
                        "increment lifecycle runtime tool safety counter failed",
                    )
                    .await;
                    crate::runtime_tool_safety_counters::record_runtime_tool_safety_counter(
                        &ctx,
                        runtime_tool_metrics::RuntimeToolSafetyCounter::LifecycleSweepSkipNoLease,
                        "increment lifecycle runtime tool safety counter failed",
                    )
                    .await;
                    set_distributed_dispatch_error(
                        &ctx,
                        DISTRIBUTED_ERROR_SOURCE_STATE_SYNC,
                        "lifecycle sweeper leader lease requires redis client",
                    )
                    .await;
                    let mut leader = ctx.lifecycle_sweeper_lease_leader.write().await;
                    *leader = None;
                    let degraded_transition = set_lifecycle_sweeper_observability_state(
                        &ctx,
                        "follower",
                        Some(LEASE_ERROR_REDIS_UNAVAILABLE),
                        false,
                        false,
                        true,
                        lease_degraded_after_ms,
                    )
                    .await;
                    force_runtime_updated = degraded_transition;
                    runtime_updated_reason = "runtime_lifecycle_lease_redis_unavailable";
                    maybe_publish_lifecycle_runtime_updated_event(
                        &ctx,
                        &mut last_runtime_updated_emit_at_ms,
                        runtime_updated_emit_min_interval_ms,
                        force_runtime_updated,
                        runtime_updated_reason,
                    )
                    .await;
                    continue;
                };
                if !lease_held {
                    let acquire_result = match test_fault_profile {
                        LifecycleTestFaultProfile::RedisTimeout => {
                            Err("fault injection: redis timeout".to_string())
                        }
                        _ => {
                            distributed::state_store::try_acquire_lease(
                                redis_client.as_ref(),
                                lease_key.as_str(),
                                lease_token.as_str(),
                                lease_ttl_ms,
                            )
                            .await
                        }
                    };
                    match acquire_result
                    {
                        Ok(acquired) => {
                            lease_held = acquired;
                            if acquired {
                                let mut leader = ctx.lifecycle_sweeper_lease_leader.write().await;
                                *leader = Some(lease_token.clone());
                                clear_distributed_dispatch_error(
                                    &ctx,
                                    DISTRIBUTED_ERROR_SOURCE_STATE_SYNC,
                                )
                                .await;
                                last_lease_renew_at = Instant::now();
                                let degraded_transition =
                                    set_lifecycle_sweeper_observability_state(
                                        &ctx,
                                        "holder",
                                        None,
                                        true,
                                        false,
                                        false,
                                        lease_degraded_after_ms,
                                    )
                                    .await;
                                should_emit_runtime_updated = true;
                                force_runtime_updated = degraded_transition;
                                runtime_updated_reason = "runtime_lifecycle_lease_acquired";
                            } else {
                                clear_distributed_dispatch_error(
                                    &ctx,
                                    DISTRIBUTED_ERROR_SOURCE_STATE_SYNC,
                                )
                                .await;
                                crate::runtime_tool_safety_counters::record_runtime_tool_safety_counter(
                                    &ctx,
                                    runtime_tool_metrics::RuntimeToolSafetyCounter::LifecycleLeaseContended,
                                    "increment lifecycle runtime tool safety counter failed",
                                )
                                .await;
                                let degraded_transition =
                                    set_lifecycle_sweeper_observability_state(
                                        &ctx,
                                        "follower",
                                        Some(LEASE_ERROR_CONTENDED),
                                        false,
                                        false,
                                        false,
                                        lease_degraded_after_ms,
                                    )
                                    .await;
                                should_emit_runtime_updated = true;
                                force_runtime_updated = degraded_transition;
                                runtime_updated_reason = "runtime_lifecycle_lease_contended";
                            }
                        }
                        Err(error) => {
                            crate::runtime_tool_safety_counters::record_runtime_tool_safety_counter(
                                &ctx,
                                runtime_tool_metrics::RuntimeToolSafetyCounter::LifecycleLeaseAcquireFail,
                                "increment lifecycle runtime tool safety counter failed",
                            )
                            .await;
                            set_distributed_dispatch_error(
                                &ctx,
                                DISTRIBUTED_ERROR_SOURCE_STATE_SYNC,
                                format!("lifecycle sweeper lease acquire failed: {error}"),
                            )
                            .await;
                            let mut leader = ctx.lifecycle_sweeper_lease_leader.write().await;
                            *leader = None;
                            let degraded_transition = set_lifecycle_sweeper_observability_state(
                                &ctx,
                                "follower",
                                Some(LEASE_ERROR_ACQUIRE_FAILED),
                                false,
                                false,
                                true,
                                lease_degraded_after_ms,
                            )
                            .await;
                            should_emit_runtime_updated = true;
                            force_runtime_updated = degraded_transition;
                            runtime_updated_reason = "runtime_lifecycle_lease_acquire_failed";
                        }
                    }
                } else if last_lease_renew_at.elapsed() >= Duration::from_millis(lease_renew_ms) {
                    let renew_result = match test_fault_profile {
                        LifecycleTestFaultProfile::LeaseRenewFail
                        | LifecycleTestFaultProfile::RedisTimeout => {
                            Err("fault injection: lease renew failed".to_string())
                        }
                        _ => {
                            distributed::state_store::renew_lease_if_owner(
                                redis_client.as_ref(),
                                lease_key.as_str(),
                                lease_token.as_str(),
                                lease_ttl_ms,
                            )
                            .await
                        }
                    };
                    match renew_result
                    {
                        Ok(renewed) => {
                            if renewed {
                                last_lease_renew_at = Instant::now();
                                let degraded_transition =
                                    set_lifecycle_sweeper_observability_state(
                                        &ctx,
                                        "holder",
                                        None,
                                        true,
                                        false,
                                        false,
                                        lease_degraded_after_ms,
                                    )
                                    .await;
                                force_runtime_updated |= degraded_transition;
                            } else {
                                lease_held = false;
                                clear_distributed_dispatch_error(
                                    &ctx,
                                    DISTRIBUTED_ERROR_SOURCE_STATE_SYNC,
                                )
                                .await;
                                crate::runtime_tool_safety_counters::record_runtime_tool_safety_counter(
                                    &ctx,
                                    runtime_tool_metrics::RuntimeToolSafetyCounter::LifecycleLeaseLost,
                                    "increment lifecycle runtime tool safety counter failed",
                                )
                                .await;
                                let degraded_transition =
                                    set_lifecycle_sweeper_observability_state(
                                        &ctx,
                                        "follower",
                                        Some(LEASE_ERROR_LOST),
                                        false,
                                        false,
                                        false,
                                        lease_degraded_after_ms,
                                    )
                                    .await;
                                should_emit_runtime_updated = true;
                                force_runtime_updated |= degraded_transition;
                                runtime_updated_reason = "runtime_lifecycle_lease_lost";
                            }
                        }
                        Err(error) => {
                            lease_held = false;
                            crate::runtime_tool_safety_counters::record_runtime_tool_safety_counter(
                                &ctx,
                                runtime_tool_metrics::RuntimeToolSafetyCounter::LifecycleLeaseRenewFail,
                                "increment lifecycle runtime tool safety counter failed",
                            )
                            .await;
                            set_distributed_dispatch_error(
                                &ctx,
                                DISTRIBUTED_ERROR_SOURCE_STATE_SYNC,
                                format!("lifecycle sweeper lease renew failed: {error}"),
                            )
                            .await;
                            let degraded_transition = set_lifecycle_sweeper_observability_state(
                                &ctx,
                                "follower",
                                Some(LEASE_ERROR_RENEW_FAILED),
                                false,
                                false,
                                true,
                                lease_degraded_after_ms,
                            )
                            .await;
                            should_emit_runtime_updated = true;
                            force_runtime_updated |= degraded_transition;
                            runtime_updated_reason = "runtime_lifecycle_lease_renew_failed";
                        }
                    }
                }

                if !lease_held {
                    crate::runtime_tool_safety_counters::record_runtime_tool_safety_counter(
                        &ctx,
                        runtime_tool_metrics::RuntimeToolSafetyCounter::LifecycleSweepSkipNoLease,
                        "increment lifecycle runtime tool safety counter failed",
                    )
                    .await;
                    if let Ok(owner) = distributed::state_store::read_lease_owner(
                        redis_client.as_ref(),
                        lease_key.as_str(),
                    )
                    .await
                    {
                        let mut leader = ctx.lifecycle_sweeper_lease_leader.write().await;
                        *leader = owner;
                    }
                    if should_emit_runtime_updated {
                        maybe_publish_lifecycle_runtime_updated_event(
                            &ctx,
                            &mut last_runtime_updated_emit_at_ms,
                            runtime_updated_emit_min_interval_ms,
                            force_runtime_updated,
                            runtime_updated_reason,
                        )
                        .await;
                    }
                    continue;
                }
            }
            crate::runtime_tool_safety_counters::record_runtime_tool_safety_counter(
                &ctx,
                runtime_tool_metrics::RuntimeToolSafetyCounter::LifecycleSweepRun,
                "increment lifecycle runtime tool safety counter failed",
            )
            .await;
            let degraded_transition = set_lifecycle_sweeper_observability_state(
                &ctx,
                "holder",
                None,
                false,
                true,
                false,
                lease_degraded_after_ms,
            )
            .await;
            force_runtime_updated |= degraded_transition;
            let approval_swept = agent_tasks::sweep_agent_approval_timeouts(&ctx).await;
            let sub_agent_swept = sub_agents::sweep_sub_agent_task_timeouts(&ctx).await;
            if approval_swept > 0 || sub_agent_swept > 0 {
                should_emit_runtime_updated = true;
                runtime_updated_reason = "runtime_lifecycle_sweeper_reclaimed";
                info!(
                    approval_swept,
                    sub_agent_swept,
                    "runtime lifecycle sweeper reclaimed stale runtime state"
                );
            }
            if should_emit_runtime_updated || force_runtime_updated {
                maybe_publish_lifecycle_runtime_updated_event(
                    &ctx,
                    &mut last_runtime_updated_emit_at_ms,
                    runtime_updated_emit_min_interval_ms,
                    force_runtime_updated,
                    runtime_updated_reason,
                )
                .await;
            }
        }
    }))
}

pub fn create_initial_state(default_model_id: &str) -> SharedRuntimeState {
    let state = RuntimeState {
        workspaces: vec![WorkspaceSummary {
            id: "workspace-web".to_string(),
            path: resolve_default_workspace_path(),
            display_name: "Web Workspace".to_string(),
            connected: true,
            default_model_id: Some(default_model_id.to_string()),
        }],
        workspace_threads: HashMap::new(),
        prompt_library_global: Vec::new(),
        prompt_library_workspace: HashMap::new(),
        runtime_policy_mode: "strict".to_string(),
        runtime_policy_updated_at: now_ms(),
    };
    Arc::new(RwLock::new(state))
}

fn hydrate_runtime_workspaces_from_native_store(
    state: &SharedRuntimeState,
    native_state_store: &native_state_store::NativeStateStore,
    default_model_id: &str,
) {
    let persisted = match native_state_store.get_setting_value_blocking(
        native_state_store::TABLE_NATIVE_RUNTIME_STATE_KV,
        RUNTIME_WORKSPACES_STATE_KEY,
    ) {
        Ok(value) => value,
        Err(error) => {
            warn!(
                error = error.as_str(),
                "failed to hydrate runtime workspaces from native state store"
            );
            return;
        }
    };
    let Some(value) = persisted else {
        return;
    };
    let Ok(mut workspaces) = serde_json::from_value::<Vec<WorkspaceSummary>>(value) else {
        warn!("persisted runtime workspaces payload is invalid");
        return;
    };

    workspaces.retain(|workspace| {
        !workspace.id.trim().is_empty()
            && !workspace.path.trim().is_empty()
            && !workspace.display_name.trim().is_empty()
    });
    if workspaces.is_empty() {
        return;
    }

    let mut seen_ids = HashSet::new();
    workspaces.retain(|workspace| seen_ids.insert(workspace.id.clone()));
    let mut seen_paths = HashSet::new();
    workspaces.retain(|workspace| {
        seen_paths.insert(normalize_workspace_identity_path(workspace.path.as_str()))
    });
    for workspace in &mut workspaces {
        if workspace.default_model_id.is_none() {
            workspace.default_model_id = Some(default_model_id.to_string());
        }
    }

    let default_workspace_path = resolve_default_workspace_path();
    if let Some(default_workspace) = workspaces
        .iter_mut()
        .find(|workspace| workspace.id == "workspace-web")
    {
        default_workspace.path = default_workspace_path.clone();
        default_workspace.display_name = "Web Workspace".to_string();
        default_workspace.connected = true;
        if default_workspace.default_model_id.is_none() {
            default_workspace.default_model_id = Some(default_model_id.to_string());
        }
    } else {
        workspaces.insert(
            0,
            WorkspaceSummary {
                id: "workspace-web".to_string(),
                path: default_workspace_path.clone(),
                display_name: "Web Workspace".to_string(),
                connected: true,
                default_model_id: Some(default_model_id.to_string()),
            },
        );
    }

    workspaces.sort_by_key(|workspace| if workspace.id == "workspace-web" { 0 } else { 1 });
    let mut seen_paths = HashSet::new();
    workspaces.retain(|workspace| {
        seen_paths.insert(normalize_workspace_identity_path(workspace.path.as_str()))
    });

    let mut guard = state
        .try_write()
        .expect("runtime state lock poisoned while hydrating workspaces");
    guard.workspaces = workspaces;
}

struct RuntimeBootstrapArtifacts {
    context: AppContext,
    recovered_queued_task_ids: Vec<String>,
}

fn start_runtime_background_tasks(
    context: &AppContext,
    recovered_queued_task_ids: Vec<String>,
) -> RuntimeBackgroundTasks {
    let mut tasks = Vec::new();
    if context.distributed_config.enabled && context.distributed_redis_client.is_some() {
        tasks.push(RuntimeBackgroundTask::abort_only(
            "distributed.queue.bootstrap",
            spawn_distributed_queue_bootstrap(context.clone()),
        ));
        tasks.push(RuntimeBackgroundTask::abort_only(
            "distributed.state.sync",
            spawn_distributed_state_sync(context.clone()),
        ));
        if context.config.discovery_enabled {
            tasks.push(RuntimeBackgroundTask::abort_only(
                "distributed.discovery.sync",
                spawn_distributed_discovery_sync(context.clone()),
            ));
        }
    }
    for task_id in recovered_queued_task_ids {
        let _ = agent_tasks::spawn_agent_task_execution(context.clone(), task_id);
    }
    if let Some(handle) = spawn_lifecycle_sweeper(context.clone()) {
        tasks.push(RuntimeBackgroundTask::abort_only(
            "runtime.lifecycle.sweeper",
            handle,
        ));
    }
    tasks.push(RuntimeBackgroundTask::graceful(
        "runtime.state-fabric.fanout",
        context.runtime_fanout_shutdown.as_ref().clone(),
        spawn_runtime_state_fabric_fanout_task(
            context.clone(),
            context.runtime_fanout_shutdown.as_ref().clone(),
        ),
    ));
    tasks.push(RuntimeBackgroundTask::graceful(
        "runtime.thread-live-update.fanout",
        context.runtime_fanout_shutdown.as_ref().clone(),
        spawn_thread_live_update_fanout_task(
            context.clone(),
            context.runtime_fanout_shutdown.as_ref().clone(),
        ),
    ));
    RuntimeBackgroundTasks::new(tasks)
}

pub(crate) fn build_runtime_app_state(
    state: SharedRuntimeState,
    config: ServiceConfig,
    native_state_store: Arc<native_state_store::NativeStateStore>,
) -> RuntimeAppState {
    let artifacts = build_runtime_bootstrap_artifacts(state, config, native_state_store);
    let background_tasks =
        start_runtime_background_tasks(&artifacts.context, artifacts.recovered_queued_task_ids);
    RuntimeAppState::new(artifacts.context, background_tasks)
}

pub fn build_runtime_app_state_from_env(
    state: SharedRuntimeState,
    config: ServiceConfig,
) -> RuntimeAppState {
    let native_state_store = Arc::new(native_state_store::NativeStateStore::from_env_or_default());
    build_runtime_app_state(state, config, native_state_store)
}

pub fn build_router_from_runtime_app_state(app_state: RuntimeAppState) -> Router {
    let transport_routes = Router::new()
        .route(CODE_RUNTIME_RPC_TRANSPORT_EVENTS_PATH, get(events_handler))
        .route(CODE_RUNTIME_RPC_TRANSPORT_WS_PATH, get(ws_handler))
        .route(CODE_RUNTIME_RPC_TRANSPORT_RPC_PATH, post(rpc_handler));
    let transport_routes = if configured_runtime_auth_token(&app_state.transport_state().config)
        .is_some()
    {
        transport_routes.route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            runtime_transport_auth_middleware,
        ))
    } else {
        transport_routes
    };

    Router::new()
        .route("/health", get(health_handler))
        .route("/ready", get(ready_handler))
        .route("/readiness", get(ready_handler))
        .route(
            CODE_RUNTIME_OAUTH_CODEX_START_PATH,
            post(codex_oauth_start_handler),
        )
        .route(
            CODE_RUNTIME_OAUTH_CODEX_CANCEL_PATH,
            post(codex_oauth_cancel_handler),
        )
        .route(
            CODE_RUNTIME_OAUTH_CODEX_CALLBACK_PATH,
            get(codex_oauth_callback_handler),
        )
        .route(
            CODE_RUNTIME_OAUTH_CODEX_CALLBACK_LEGACY_PATH,
            get(codex_oauth_callback_handler),
        )
        .merge(transport_routes)
        .with_state(app_state)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
}

pub fn build_router(state: SharedRuntimeState, config: ServiceConfig) -> Router {
    let native_state_store = Arc::new(native_state_store::NativeStateStore::from_env_or_default());
    build_router_with_native_state_store(state, config, native_state_store)
}

fn build_runtime_bootstrap_artifacts(
    state: SharedRuntimeState,
    config: ServiceConfig,
    native_state_store: Arc<native_state_store::NativeStateStore>,
) -> RuntimeBootstrapArtifacts {
    let config_views = config.views().into_owned();
    let client = reqwest::Client::builder()
        .timeout(openai_http_timeout(&config))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());
    let (oauth_pool, oauth_pool_bootstrap_error) = initialize_oauth_pool(&config);
    match oauth_pool.diagnostics() {
        Ok(diagnostics) => {
            info!(
                accounts_total = diagnostics.accounts_total,
                accounts_enabled = diagnostics.accounts_enabled,
                pools_total = diagnostics.pools_total,
                pool_members_total = diagnostics.pool_members_total,
                oauth_secret_key_configured = diagnostics.oauth_secret_key_configured,
                "oauth pool startup diagnostics"
            );
        }
        Err(error) => {
            warn!(
                error = error.as_str(),
                "failed to collect oauth pool startup diagnostics"
            );
        }
    }
    let (turn_events, _) = broadcast::channel(TURN_EVENTS_BUFFER);
    let agent_task_execution_slots = Arc::new(Semaphore::new(
        config_views.agent_execution.agent_max_concurrent_tasks,
    ));
    let ws_connection_slots = Arc::new(Semaphore::new(resolve_ws_max_connections(&config)));
    let distributed_config = config.distributed_runtime_config();
    let lifecycle_sweeper_mode =
        resolve_lifecycle_sweeper_mode(distributed_config.enabled).as_str().to_string();
    let mut distributed_errors = HashMap::<String, String>::new();
    let distributed_redis_client = if distributed_config.enabled {
        match distributed_config.normalized_redis_url() {
            Some(redis_url) => match redis::Client::open(redis_url) {
                Ok(client) => Some(Arc::new(client)),
                Err(error) => {
                    let message = format!("Initialize distributed redis client: {error}");
                    warn!(
                        error = message.as_str(),
                        "distributed runtime redis bootstrap failed"
                    );
                    distributed_errors
                        .insert(DISTRIBUTED_ERROR_SOURCE_BOOTSTRAP.to_string(), message);
                    None
                }
            },
            None => {
                distributed_errors.insert(
                    DISTRIBUTED_ERROR_SOURCE_BOOTSTRAP.to_string(),
                    "Distributed runtime is enabled but redis URL is missing.".to_string(),
                );
                None
            }
        }
    } else {
        None
    };
    let (agent_task_durability, recovered_runtime_state, recovered_queued_task_ids) =
        bootstrap_durable_runtime_state(&config);
    #[cfg(test)]
    let runtime_tool_metrics_store =
        runtime_tool_metrics::RuntimeToolExecutionMetricsStore::isolated_for_test();
    #[cfg(not(test))]
    let runtime_tool_metrics_store =
        runtime_tool_metrics::RuntimeToolExecutionMetricsStore::from_env();
    let runtime_tool_metrics_window_size = runtime_tool_metrics_store.read_snapshot().window_size;
    native_state_store.initialize_blocking();
    hydrate_runtime_workspaces_from_native_store(
        &state,
        native_state_store.as_ref(),
        config.default_model_id.as_str(),
    );
    let acp_integrations_store = hydrate_acp_integrations_from_native_store(native_state_store.as_ref());
    let mut runtime_backends =
        crate::rpc_dispatch::hydrate_runtime_backends_from_native_store(native_state_store.as_ref());
    sync_projected_backends_into_map(&acp_integrations_store, &mut runtime_backends);
    let task_supervisor = RuntimeTaskSupervisor::new(Duration::from_millis(250));
    let context = AppContext {
        state,
        config,
        client,
        oauth_pool: Arc::new(oauth_pool),
        oauth_pool_bootstrap_error,
        native_state_store,
        runtime_diagnostics: Arc::new(RuntimeDiagnosticsState::default()),
        runtime_tool_metrics: Arc::new(AsyncMutex::new(runtime_tool_metrics_store)),
        runtime_tool_guardrails: Arc::new(AsyncMutex::new({
            #[cfg(test)]
            {
                runtime_tool_guardrails::RuntimeToolGuardrailStore::isolated_for_test(
                    runtime_tool_metrics_window_size,
                )
            }
            #[cfg(not(test))]
            {
                runtime_tool_guardrails::RuntimeToolGuardrailStore::from_env(
                    runtime_tool_metrics_window_size,
                )
            }
        })),
        extensions_store: Arc::new(RwLock::new(extensions_runtime::RuntimeExtensionStore::default())),
        session_portability_store: Arc::new(RwLock::new(
            session_portability::SessionPortabilityStore::default(),
        )),
        security_preflight_permission_store: Arc::new(RwLock::new(
            security_preflight::SecurityPreflightPermissionStore::default(),
        )),
        compat_model_catalog_cache: Arc::new(RwLock::new(HashMap::new())),
        compat_model_catalog_refresh_locks: Arc::new(RwLock::new(HashMap::new())),
        compat_model_catalog_failure_cache: Arc::new(RwLock::new(HashMap::new())),
        terminal_sessions: Arc::new(RwLock::new(HashMap::new())),
        terminal_processes: Arc::new(std::sync::Mutex::new(
            ku0_runtime_shell_core::TerminalProcessRegistry::new(),
        )),
        live_skill_network_cache: Arc::new(RwLock::new(HashMap::new())),
        live_skill_js_repl_sessions: Arc::new(RwLock::new(HashMap::new())),
        live_skill_execution_counters: live_skills::LiveSkillExecutionCounters::default(),
        local_codex_sync_last_attempt_ms: Arc::new(AtomicU64::new(0)),
        service_codex_usage_refresh_last_attempt_ms: Arc::new(AtomicU64::new(0)),
        service_codex_usage_refresh_attempt_by_account_ms: Arc::new(RwLock::new(HashMap::new())),
        turn_events,
        turn_event_next_id: Arc::new(AtomicU64::new(0)),
        turn_event_replay_buffer: Arc::new(Mutex::new(TurnEventReplayBuffer::new())),
        task_supervisor,
        latest_runtime_state_fabric_event: Arc::new(Mutex::new(None)),
        runtime_state_fabric_fanout_pending: Arc::new(Mutex::new(None)),
        runtime_state_fabric_fanout_notify: Arc::new(Notify::new()),
        runtime_state_fabric_fanout_active: Arc::new(AtomicBool::new(false)),
        thread_live_update_fanout_pending: Arc::new(Mutex::new(HashMap::new())),
        thread_live_update_fanout_notify: Arc::new(Notify::new()),
        thread_live_update_fanout_active: Arc::new(AtomicBool::new(false)),
        runtime_fanout_shutdown: Arc::new(tokio_util::sync::CancellationToken::new()),
        revision_json_cache: Arc::new(Mutex::new(RuntimeRevisionJsonCache::default())),
        runtime_task_counters_cache: Arc::new(Mutex::new(RuntimeTaskCounterCache::default())),
        thread_live_subscriptions: Arc::new(RwLock::new(HashMap::new())),
        thread_live_heartbeat_tasks: Arc::new(AsyncMutex::new(HashMap::new())),
        turn_interrupt_waiters: Arc::new(RwLock::new(HashMap::new())),
        runtime_update_revision: Arc::new(AtomicU64::new(0)),
        runtime_update_last_event_at_ms: Arc::new(AtomicU64::new(0)),
        agent_tasks: Arc::new(RwLock::new(recovered_runtime_state.agent_tasks)),
        agent_task_durability: agent_task_durability.clone(),
        sub_agent_sessions: Arc::new(RwLock::new(recovered_runtime_state.sub_agent_sessions)),
        acp_integrations: Arc::new(RwLock::new(acp_integrations_store)),
        acp_runtime: Arc::new(AsyncMutex::new(acp_runtime::AcpRuntimeStore::default())),
        runtime_backends: Arc::new(RwLock::new(runtime_backends)),
        runtime_backends_sync_last_hydrated_ms: Arc::new(AtomicU64::new(0)),
        runtime_backends_sync_lock: Arc::new(AsyncMutex::new(())),
        agent_workspace_locks: Arc::new(RwLock::new(HashMap::new())),
        agent_task_execution_slots,
        ws_connection_slots,
        distributed_config,
        distributed_redis_client,
        distributed_dispatch_errors: Arc::new(RwLock::new(distributed_errors)),
        distributed_readiness_snapshot_cache: Arc::new(RwLock::new(None)),
        lifecycle_sweeper_mode,
        lifecycle_sweeper_lease_leader: Arc::new(RwLock::new(None)),
        lifecycle_sweeper_observability: Arc::new(RwLock::new(
            LifecycleSweeperObservabilityState::default(),
        )),
        discovery_advertisement: Arc::new(RuntimeDiscoveryAdvertisement::default()),
        discovery_managed_backends: Arc::new(RwLock::new(HashMap::new())),
        discovery_upsert_total: Arc::new(AtomicU64::new(0)),
        discovery_stale_remove_total: Arc::new(AtomicU64::new(0)),
        codex_oauth_pending_logins: Arc::new(AsyncMutex::new(HashMap::new())),
        codex_oauth_loopback_listener: Arc::new(AsyncMutex::new(None)),
    };
    if let Err(error) = sync_local_codex_cli_account(context.oauth_pool.as_ref()) {
        context
            .runtime_diagnostics
            .record_local_codex_sync_failure();
        warn!(
            error = error.as_str(),
            "failed to sync local codex cli auth account"
        );
    }
    RuntimeBootstrapArtifacts {
        context,
        recovered_queued_task_ids,
    }
}

#[cfg(test)]
pub(crate) fn build_app_context(
    state: SharedRuntimeState,
    config: ServiceConfig,
    native_state_store: Arc<native_state_store::NativeStateStore>,
) -> AppContext {
    build_runtime_bootstrap_artifacts(state, config, native_state_store).context
}

pub(crate) fn build_router_with_native_state_store(
    state: SharedRuntimeState,
    config: ServiceConfig,
    native_state_store: Arc<native_state_store::NativeStateStore>,
) -> Router {
    let app_state = build_runtime_app_state(state, config, native_state_store);
    build_router_from_runtime_app_state(app_state)
}
