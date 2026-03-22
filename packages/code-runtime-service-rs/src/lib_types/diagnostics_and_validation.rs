#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReadinessChecks {
    openai_api_key_present: bool,
    anthropic_api_key_present: bool,
    gemini_api_key_present: bool,
    openai_endpoint_valid: bool,
    anthropic_endpoint_valid: bool,
    gemini_endpoint_valid: bool,
    default_model_valid: bool,
    default_provider_ready: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReadinessResponse {
    app: &'static str,
    status: &'static str,
    checks: ReadinessChecks,
    runtime_diagnostics: RuntimeDiagnosticsSnapshot,
    distributed: distributed::diagnostics::DistributedReadinessSnapshot,
    #[serde(skip_serializing_if = "Option::is_none")]
    oauth_pool: Option<OAuthPoolDiagnostics>,
    #[serde(skip_serializing_if = "Option::is_none")]
    oauth_pool_error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeObservabilityMetadataSnapshot {
    scope: String,
    task_counter_mode: String,
    snapshot_age_ms: u64,
    source_revision: u64,
    queue_depth: u64,
    state_fabric_fanout_queue_depth: u64,
    thread_live_update_fanout_queue_depth: u64,
    active_runtime_tasks: u64,
    active_subscription_tasks: u64,
    active_flow_tasks: u64,
    task_counter_cache_hit_total: u64,
    task_counter_cache_miss_total: u64,
    task_counter_full_scan_fallback_total: u64,
    state_fabric_fanout_coalesced_total: u64,
    thread_live_update_fanout_coalesced_total: u64,
    backpressure_lagged_total: u64,
    backpressure_dropped_total: u64,
    graceful_shutdown_completed_total: u64,
    forced_abort_total: u64,
    shutdown_wait_timed_out_total: u64,
    last_shutdown_wait_ms: u64,
}

impl Default for RuntimeObservabilityMetadataSnapshot {
    fn default() -> Self {
        Self {
            scope: "unspecified".to_string(),
            task_counter_mode: "unspecified".to_string(),
            snapshot_age_ms: 0,
            source_revision: 0,
            queue_depth: 0,
            state_fabric_fanout_queue_depth: 0,
            thread_live_update_fanout_queue_depth: 0,
            active_runtime_tasks: 0,
            active_subscription_tasks: 0,
            active_flow_tasks: 0,
            task_counter_cache_hit_total: 0,
            task_counter_cache_miss_total: 0,
            task_counter_full_scan_fallback_total: 0,
            state_fabric_fanout_coalesced_total: 0,
            thread_live_update_fanout_coalesced_total: 0,
            backpressure_lagged_total: 0,
            backpressure_dropped_total: 0,
            graceful_shutdown_completed_total: 0,
            forced_abort_total: 0,
            shutdown_wait_timed_out_total: 0,
            last_shutdown_wait_ms: 0,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeDiagnosticsSnapshot {
    oauth_routing_failures_total: u64,
    oauth_routing_pool_select_error_total: u64,
    oauth_routing_pool_not_found_total: u64,
    oauth_routing_pool_disabled_total: u64,
    oauth_routing_pool_exhausted_total: u64,
    oauth_routing_rate_limited_total: u64,
    oauth_routing_auth_missing_total: u64,
    oauth_routing_decrypt_failed_total: u64,
    oauth_reserved_metadata_rejections_total: u64,
    local_codex_sync_failures_total: u64,
    agent_tasks_started_total: u64,
    agent_task_queue_wait_ms_total: u64,
    agent_execution_slot_wait_ms_total: u64,
    agent_workspace_lock_wait_ms_total: u64,
    agent_backend_placement_failures_total: u64,
    backend_registry_sync_performed_total: u64,
    backend_registry_sync_skipped_total: u64,
    backend_registry_sync_failed_total: u64,
    tool_inspector_allow_total: u64,
    tool_inspector_require_approval_total: u64,
    tool_inspector_deny_total: u64,
    context_compression_trigger_total: u64,
    context_compression_trigger_payload_source_total: u64,
    context_compression_trigger_failure_streak_source_total: u64,
    context_compression_trigger_session_length_source_total: u64,
    context_compression_payload_bytes_total: u64,
    stale_write_rejected_task_summary_total: u64,
    stale_write_rejected_task_checkpoint_total: u64,
    stale_write_rejected_sub_agent_checkpoint_total: u64,
    stale_write_rejected_tool_lifecycle_checkpoint_total: u64,
    agent_session_concurrency_limit_hits_total: u64,
    agent_session_concurrency_limit_workspace_hits: HashMap<String, u64>,
    agent_recovery_attempts_total: u64,
    agent_recovery_success_total: u64,
    agent_recovery_failed_total: u64,
    agent_recovery_latency_ms_total: u64,
    agent_recovery_latency_ms_max: u64,
    agent_recovery_latency_p95_approx_ms: u64,
    agent_recovery_sla_20s_violation_total: u64,
    agent_recovery_sla_20s_breached: bool,
    agent_recovery_sla_20s_reason_code: String,
    agent_tasks_total: u64,
    agent_tasks_queued: u64,
    agent_tasks_running: u64,
    agent_tasks_awaiting_approval: u64,
    agent_tasks_terminal: u64,
    agent_workspace_locks_total: u64,
    compat_model_catalog_fetch_failures_total: u64,
    compat_model_catalog_error_cooldown_hits_total: u64,
    compat_model_catalog_cache_entries: u64,
    compat_model_catalog_failure_cache_entries: u64,
    compat_model_catalog_refresh_locks_total: u64,
    live_skill_network_cache_entries: u64,
    agent_execution_slots_available: u64,
    agent_execution_slots_max: u64,
    ws_connections_opened_total: u64,
    ws_connections_closed_total: u64,
    ws_connections_active: u64,
    ws_protocol_errors_total: u64,
    ws_receive_errors_total: u64,
    ws_event_stream_lagged_total: u64,
    ws_event_stream_lagged_dropped_total: u64,
    sse_event_stream_lagged_total: u64,
    sse_event_stream_lagged_dropped_total: u64,
    ws_replay_gap_total: u64,
    ws_upgrade_failures_total: u64,
    ws_connections_rejected_total: u64,
    ws_connection_slots_available: u64,
    ws_connection_slots_max: u64,
    observability: RuntimeObservabilityMetadataSnapshot,
}

#[derive(Debug, Default)]
struct RuntimeDiagnosticsState {
    oauth_routing_failures_total: AtomicU64,
    oauth_routing_pool_select_error_total: AtomicU64,
    oauth_routing_pool_not_found_total: AtomicU64,
    oauth_routing_pool_disabled_total: AtomicU64,
    oauth_routing_pool_exhausted_total: AtomicU64,
    oauth_routing_rate_limited_total: AtomicU64,
    oauth_routing_auth_missing_total: AtomicU64,
    oauth_routing_decrypt_failed_total: AtomicU64,
    oauth_reserved_metadata_rejections_total: AtomicU64,
    local_codex_sync_failures_total: AtomicU64,
    agent_tasks_started_total: AtomicU64,
    agent_task_queue_wait_ms_total: AtomicU64,
    agent_execution_slot_wait_ms_total: AtomicU64,
    agent_workspace_lock_wait_ms_total: AtomicU64,
    agent_backend_placement_failures_total: AtomicU64,
    backend_registry_sync_performed_total: AtomicU64,
    backend_registry_sync_skipped_total: AtomicU64,
    backend_registry_sync_failed_total: AtomicU64,
    tool_inspector_allow_total: AtomicU64,
    tool_inspector_require_approval_total: AtomicU64,
    tool_inspector_deny_total: AtomicU64,
    context_compression_trigger_total: AtomicU64,
    context_compression_trigger_payload_source_total: AtomicU64,
    context_compression_trigger_failure_streak_source_total: AtomicU64,
    context_compression_trigger_session_length_source_total: AtomicU64,
    context_compression_payload_bytes_total: AtomicU64,
    stale_write_rejected_task_summary_total: AtomicU64,
    stale_write_rejected_task_checkpoint_total: AtomicU64,
    stale_write_rejected_sub_agent_checkpoint_total: AtomicU64,
    stale_write_rejected_tool_lifecycle_checkpoint_total: AtomicU64,
    agent_session_concurrency_limit_hits_total: AtomicU64,
    agent_session_concurrency_limit_workspace_hits: std::sync::RwLock<HashMap<String, u64>>,
    agent_recovery_attempts_total: AtomicU64,
    agent_recovery_success_total: AtomicU64,
    agent_recovery_failed_total: AtomicU64,
    agent_recovery_latency_ms_total: AtomicU64,
    agent_recovery_latency_ms_max: AtomicU64,
    agent_recovery_latency_le_1s_total: AtomicU64,
    agent_recovery_latency_1s_to_5s_total: AtomicU64,
    agent_recovery_latency_5s_to_10s_total: AtomicU64,
    agent_recovery_latency_10s_to_20s_total: AtomicU64,
    agent_recovery_latency_gt_20s_total: AtomicU64,
    compat_model_catalog_fetch_failures_total: AtomicU64,
    compat_model_catalog_error_cooldown_hits_total: AtomicU64,
    ws_connections_opened_total: AtomicU64,
    ws_connections_closed_total: AtomicU64,
    ws_connections_active: AtomicU64,
    ws_protocol_errors_total: AtomicU64,
    ws_receive_errors_total: AtomicU64,
    ws_event_stream_lagged_total: AtomicU64,
    ws_event_stream_lagged_dropped_total: AtomicU64,
    sse_event_stream_lagged_total: AtomicU64,
    sse_event_stream_lagged_dropped_total: AtomicU64,
    ws_replay_gap_total: AtomicU64,
    ws_upgrade_failures_total: AtomicU64,
    ws_connections_rejected_total: AtomicU64,
    runtime_task_counter_cache_hit_total: AtomicU64,
    runtime_task_counter_cache_miss_total: AtomicU64,
    runtime_task_counter_full_scan_fallback_total: AtomicU64,
    state_fabric_fanout_coalesced_total: AtomicU64,
    thread_live_update_fanout_coalesced_total: AtomicU64,
}

impl RuntimeDiagnosticsState {
    fn snapshot(&self) -> RuntimeDiagnosticsSnapshot {
        let recovery_latency_le_1s_total = self
            .agent_recovery_latency_le_1s_total
            .load(Ordering::Relaxed);
        let recovery_latency_1s_to_5s_total = self
            .agent_recovery_latency_1s_to_5s_total
            .load(Ordering::Relaxed);
        let recovery_latency_5s_to_10s_total = self
            .agent_recovery_latency_5s_to_10s_total
            .load(Ordering::Relaxed);
        let recovery_latency_10s_to_20s_total = self
            .agent_recovery_latency_10s_to_20s_total
            .load(Ordering::Relaxed);
        let recovery_latency_gt_20s_total = self
            .agent_recovery_latency_gt_20s_total
            .load(Ordering::Relaxed);
        let agent_recovery_latency_p95_approx_ms = approximate_recovery_latency_p95_ms(
            recovery_latency_le_1s_total,
            recovery_latency_1s_to_5s_total,
            recovery_latency_5s_to_10s_total,
            recovery_latency_10s_to_20s_total,
            recovery_latency_gt_20s_total,
        );
        let agent_recovery_sla_20s_breached = agent_recovery_latency_p95_approx_ms > 20_000;
        let agent_recovery_sla_20s_reason_code = if agent_recovery_sla_20s_breached {
            "p95_over_20s".to_string()
        } else {
            "ok".to_string()
        };
        let agent_session_concurrency_limit_workspace_hits =
            match self.agent_session_concurrency_limit_workspace_hits.read() {
                Ok(guard) => guard.clone(),
                Err(poisoned) => poisoned.into_inner().clone(),
            };
        let ws_event_stream_lagged_total = self.ws_event_stream_lagged_total.load(Ordering::Relaxed);
        let ws_event_stream_lagged_dropped_total = self
            .ws_event_stream_lagged_dropped_total
            .load(Ordering::Relaxed);
        let sse_event_stream_lagged_total = self
            .sse_event_stream_lagged_total
            .load(Ordering::Relaxed);
        let sse_event_stream_lagged_dropped_total = self
            .sse_event_stream_lagged_dropped_total
            .load(Ordering::Relaxed);
        RuntimeDiagnosticsSnapshot {
            oauth_routing_failures_total: self.oauth_routing_failures_total.load(Ordering::Relaxed),
            oauth_routing_pool_select_error_total: self
                .oauth_routing_pool_select_error_total
                .load(Ordering::Relaxed),
            oauth_routing_pool_not_found_total: self
                .oauth_routing_pool_not_found_total
                .load(Ordering::Relaxed),
            oauth_routing_pool_disabled_total: self
                .oauth_routing_pool_disabled_total
                .load(Ordering::Relaxed),
            oauth_routing_pool_exhausted_total: self
                .oauth_routing_pool_exhausted_total
                .load(Ordering::Relaxed),
            oauth_routing_rate_limited_total: self
                .oauth_routing_rate_limited_total
                .load(Ordering::Relaxed),
            oauth_routing_auth_missing_total: self
                .oauth_routing_auth_missing_total
                .load(Ordering::Relaxed),
            oauth_routing_decrypt_failed_total: self
                .oauth_routing_decrypt_failed_total
                .load(Ordering::Relaxed),
            oauth_reserved_metadata_rejections_total: self
                .oauth_reserved_metadata_rejections_total
                .load(Ordering::Relaxed),
            local_codex_sync_failures_total: self
                .local_codex_sync_failures_total
                .load(Ordering::Relaxed),
            agent_tasks_started_total: self.agent_tasks_started_total.load(Ordering::Relaxed),
            agent_task_queue_wait_ms_total: self
                .agent_task_queue_wait_ms_total
                .load(Ordering::Relaxed),
            agent_execution_slot_wait_ms_total: self
                .agent_execution_slot_wait_ms_total
                .load(Ordering::Relaxed),
            agent_workspace_lock_wait_ms_total: self
                .agent_workspace_lock_wait_ms_total
                .load(Ordering::Relaxed),
            agent_backend_placement_failures_total: self
                .agent_backend_placement_failures_total
                .load(Ordering::Relaxed),
            backend_registry_sync_performed_total: self
                .backend_registry_sync_performed_total
                .load(Ordering::Relaxed),
            backend_registry_sync_skipped_total: self
                .backend_registry_sync_skipped_total
                .load(Ordering::Relaxed),
            backend_registry_sync_failed_total: self
                .backend_registry_sync_failed_total
                .load(Ordering::Relaxed),
            tool_inspector_allow_total: self
                .tool_inspector_allow_total
                .load(Ordering::Relaxed),
            tool_inspector_require_approval_total: self
                .tool_inspector_require_approval_total
                .load(Ordering::Relaxed),
            tool_inspector_deny_total: self.tool_inspector_deny_total.load(Ordering::Relaxed),
            context_compression_trigger_total: self
                .context_compression_trigger_total
                .load(Ordering::Relaxed),
            context_compression_trigger_payload_source_total: self
                .context_compression_trigger_payload_source_total
                .load(Ordering::Relaxed),
            context_compression_trigger_failure_streak_source_total: self
                .context_compression_trigger_failure_streak_source_total
                .load(Ordering::Relaxed),
            context_compression_trigger_session_length_source_total: self
                .context_compression_trigger_session_length_source_total
                .load(Ordering::Relaxed),
            context_compression_payload_bytes_total: self
                .context_compression_payload_bytes_total
                .load(Ordering::Relaxed),
            stale_write_rejected_task_summary_total: self
                .stale_write_rejected_task_summary_total
                .load(Ordering::Relaxed),
            stale_write_rejected_task_checkpoint_total: self
                .stale_write_rejected_task_checkpoint_total
                .load(Ordering::Relaxed),
            stale_write_rejected_sub_agent_checkpoint_total: self
                .stale_write_rejected_sub_agent_checkpoint_total
                .load(Ordering::Relaxed),
            stale_write_rejected_tool_lifecycle_checkpoint_total: self
                .stale_write_rejected_tool_lifecycle_checkpoint_total
                .load(Ordering::Relaxed),
            agent_session_concurrency_limit_hits_total: self
                .agent_session_concurrency_limit_hits_total
                .load(Ordering::Relaxed),
            agent_session_concurrency_limit_workspace_hits,
            agent_recovery_attempts_total: self
                .agent_recovery_attempts_total
                .load(Ordering::Relaxed),
            agent_recovery_success_total: self
                .agent_recovery_success_total
                .load(Ordering::Relaxed),
            agent_recovery_failed_total: self
                .agent_recovery_failed_total
                .load(Ordering::Relaxed),
            agent_recovery_latency_ms_total: self
                .agent_recovery_latency_ms_total
                .load(Ordering::Relaxed),
            agent_recovery_latency_ms_max: self
                .agent_recovery_latency_ms_max
                .load(Ordering::Relaxed),
            agent_recovery_latency_p95_approx_ms,
            agent_recovery_sla_20s_violation_total: recovery_latency_gt_20s_total,
            agent_recovery_sla_20s_breached,
            agent_recovery_sla_20s_reason_code,
            agent_tasks_total: 0,
            agent_tasks_queued: 0,
            agent_tasks_running: 0,
            agent_tasks_awaiting_approval: 0,
            agent_tasks_terminal: 0,
            agent_workspace_locks_total: 0,
            compat_model_catalog_fetch_failures_total: self
                .compat_model_catalog_fetch_failures_total
                .load(Ordering::Relaxed),
            compat_model_catalog_error_cooldown_hits_total: self
                .compat_model_catalog_error_cooldown_hits_total
                .load(Ordering::Relaxed),
            compat_model_catalog_cache_entries: 0,
            compat_model_catalog_failure_cache_entries: 0,
            compat_model_catalog_refresh_locks_total: 0,
            live_skill_network_cache_entries: 0,
            agent_execution_slots_available: 0,
            agent_execution_slots_max: 0,
            ws_connections_opened_total: self.ws_connections_opened_total.load(Ordering::Relaxed),
            ws_connections_closed_total: self.ws_connections_closed_total.load(Ordering::Relaxed),
            ws_connections_active: self.ws_connections_active.load(Ordering::Relaxed),
            ws_protocol_errors_total: self.ws_protocol_errors_total.load(Ordering::Relaxed),
            ws_receive_errors_total: self.ws_receive_errors_total.load(Ordering::Relaxed),
            ws_event_stream_lagged_total,
            ws_event_stream_lagged_dropped_total,
            sse_event_stream_lagged_total,
            sse_event_stream_lagged_dropped_total,
            ws_replay_gap_total: self.ws_replay_gap_total.load(Ordering::Relaxed),
            ws_upgrade_failures_total: self.ws_upgrade_failures_total.load(Ordering::Relaxed),
            ws_connections_rejected_total: self
                .ws_connections_rejected_total
                .load(Ordering::Relaxed),
            ws_connection_slots_available: 0,
            ws_connection_slots_max: 0,
            observability: RuntimeObservabilityMetadataSnapshot {
                task_counter_cache_hit_total: self
                    .runtime_task_counter_cache_hit_total
                    .load(Ordering::Relaxed),
                task_counter_cache_miss_total: self
                    .runtime_task_counter_cache_miss_total
                    .load(Ordering::Relaxed),
                task_counter_full_scan_fallback_total: self
                    .runtime_task_counter_full_scan_fallback_total
                    .load(Ordering::Relaxed),
                state_fabric_fanout_coalesced_total: self
                    .state_fabric_fanout_coalesced_total
                    .load(Ordering::Relaxed),
                thread_live_update_fanout_coalesced_total: self
                    .thread_live_update_fanout_coalesced_total
                    .load(Ordering::Relaxed),
                backpressure_lagged_total: ws_event_stream_lagged_total
                    + sse_event_stream_lagged_total,
                backpressure_dropped_total: ws_event_stream_lagged_dropped_total
                    + sse_event_stream_lagged_dropped_total,
                ..RuntimeObservabilityMetadataSnapshot::default()
            },
        }
    }

    fn record_oauth_routing_failure(&self, reason_code: &str) {
        self.oauth_routing_failures_total
            .fetch_add(1, Ordering::Relaxed);
        match reason_code {
            "pool_select_error" => {
                self.oauth_routing_pool_select_error_total
                    .fetch_add(1, Ordering::Relaxed);
            }
            "pool_not_found" => {
                self.oauth_routing_pool_not_found_total
                    .fetch_add(1, Ordering::Relaxed);
            }
            "pool_disabled" => {
                self.oauth_routing_pool_disabled_total
                    .fetch_add(1, Ordering::Relaxed);
            }
            "pool_exhausted" => {
                self.oauth_routing_pool_exhausted_total
                    .fetch_add(1, Ordering::Relaxed);
            }
            "rate_limited" => {
                self.oauth_routing_rate_limited_total
                    .fetch_add(1, Ordering::Relaxed);
            }
            "auth_missing" => {
                self.oauth_routing_auth_missing_total
                    .fetch_add(1, Ordering::Relaxed);
            }
            "decrypt_failed" => {
                self.oauth_routing_decrypt_failed_total
                    .fetch_add(1, Ordering::Relaxed);
            }
            _ => {}
        }
    }

    fn record_oauth_reserved_metadata_rejection(&self) {
        self.oauth_reserved_metadata_rejections_total
            .fetch_add(1, Ordering::Relaxed);
    }

    fn record_local_codex_sync_failure(&self) {
        self.local_codex_sync_failures_total
            .fetch_add(1, Ordering::Relaxed);
    }

    fn record_agent_task_started(&self, queue_wait_ms: u64) {
        self.agent_tasks_started_total
            .fetch_add(1, Ordering::Relaxed);
        self.agent_task_queue_wait_ms_total
            .fetch_add(queue_wait_ms, Ordering::Relaxed);
    }

    fn record_agent_execution_slot_wait(&self, wait_ms: u64) {
        self.agent_execution_slot_wait_ms_total
            .fetch_add(wait_ms, Ordering::Relaxed);
    }

    fn record_agent_workspace_lock_wait(&self, wait_ms: u64) {
        self.agent_workspace_lock_wait_ms_total
            .fetch_add(wait_ms, Ordering::Relaxed);
    }

    fn record_agent_backend_placement_failure(&self) {
        self.agent_backend_placement_failures_total
            .fetch_add(1, Ordering::Relaxed);
    }

    fn record_backend_registry_sync_performed(&self) {
        self.backend_registry_sync_performed_total
            .fetch_add(1, Ordering::Relaxed);
    }

    fn record_backend_registry_sync_skipped(&self) {
        self.backend_registry_sync_skipped_total
            .fetch_add(1, Ordering::Relaxed);
    }

    fn record_backend_registry_sync_failed(&self) {
        self.backend_registry_sync_failed_total
            .fetch_add(1, Ordering::Relaxed);
    }

    fn record_tool_inspector_decision(&self, action: &str) {
        match action {
            "allow" => {
                self.tool_inspector_allow_total
                    .fetch_add(1, Ordering::Relaxed);
            }
            "require_approval" => {
                self.tool_inspector_require_approval_total
                    .fetch_add(1, Ordering::Relaxed);
            }
            "deny" => {
                self.tool_inspector_deny_total
                    .fetch_add(1, Ordering::Relaxed);
            }
            _ => {}
        }
    }

    fn record_context_compression_trigger(&self, payload_bytes: u64, source: &str) {
        self.context_compression_trigger_total
            .fetch_add(1, Ordering::Relaxed);
        self.context_compression_payload_bytes_total
            .fetch_add(payload_bytes, Ordering::Relaxed);
        match source {
            "payload_bytes" => {
                self.context_compression_trigger_payload_source_total
                    .fetch_add(1, Ordering::Relaxed);
            }
            "consecutive_failures" => {
                self.context_compression_trigger_failure_streak_source_total
                    .fetch_add(1, Ordering::Relaxed);
            }
            "session_length" => {
                self.context_compression_trigger_session_length_source_total
                    .fetch_add(1, Ordering::Relaxed);
            }
            _ => {}
        }
    }

    fn record_stale_write_rejected_task_summary(&self) {
        self.stale_write_rejected_task_summary_total
            .fetch_add(1, Ordering::Relaxed);
    }

    fn record_stale_write_rejected_task_checkpoint(&self) {
        self.stale_write_rejected_task_checkpoint_total
            .fetch_add(1, Ordering::Relaxed);
    }

    fn record_stale_write_rejected_sub_agent_checkpoint(&self) {
        self.stale_write_rejected_sub_agent_checkpoint_total
            .fetch_add(1, Ordering::Relaxed);
    }

    fn record_stale_write_rejected_tool_lifecycle_checkpoint(&self) {
        self.stale_write_rejected_tool_lifecycle_checkpoint_total
            .fetch_add(1, Ordering::Relaxed);
    }

    fn record_agent_session_concurrency_limit_hit(&self, workspace_id: &str) {
        self.agent_session_concurrency_limit_hits_total
            .fetch_add(1, Ordering::Relaxed);
        let workspace_id = workspace_id.trim();
        if workspace_id.is_empty() {
            return;
        }
        match self.agent_session_concurrency_limit_workspace_hits.write() {
            Ok(mut guard) => {
                let entry = guard.entry(workspace_id.to_string()).or_insert(0);
                *entry = entry.saturating_add(1);
            }
            Err(poisoned) => {
                let mut guard = poisoned.into_inner();
                let entry = guard.entry(workspace_id.to_string()).or_insert(0);
                *entry = entry.saturating_add(1);
            }
        }
    }

    fn record_agent_recovery_result(&self, success: bool, latency_ms: Option<u64>) {
        self.agent_recovery_attempts_total
            .fetch_add(1, Ordering::Relaxed);
        if success {
            self.agent_recovery_success_total
                .fetch_add(1, Ordering::Relaxed);
        } else {
            self.agent_recovery_failed_total
                .fetch_add(1, Ordering::Relaxed);
        }
        let Some(latency_ms) = latency_ms else {
            return;
        };
        self.agent_recovery_latency_ms_total
            .fetch_add(latency_ms, Ordering::Relaxed);
        let _ = self.agent_recovery_latency_ms_max.fetch_max(
            latency_ms,
            Ordering::Relaxed,
        );
        let bucket = match latency_ms {
            ..=1_000 => &self.agent_recovery_latency_le_1s_total,
            1_001..=5_000 => &self.agent_recovery_latency_1s_to_5s_total,
            5_001..=10_000 => &self.agent_recovery_latency_5s_to_10s_total,
            10_001..=20_000 => &self.agent_recovery_latency_10s_to_20s_total,
            _ => &self.agent_recovery_latency_gt_20s_total,
        };
        bucket.fetch_add(1, Ordering::Relaxed);
    }

    fn record_compat_model_catalog_fetch_failure(&self) {
        self.compat_model_catalog_fetch_failures_total
            .fetch_add(1, Ordering::Relaxed);
    }

    fn record_compat_model_catalog_error_cooldown_hit(&self) {
        self.compat_model_catalog_error_cooldown_hits_total
            .fetch_add(1, Ordering::Relaxed);
    }

    fn record_ws_connection_opened(&self) {
        self.ws_connections_opened_total
            .fetch_add(1, Ordering::Relaxed);
        self.ws_connections_active.fetch_add(1, Ordering::Relaxed);
    }

    fn record_ws_connection_closed(&self) {
        self.ws_connections_closed_total
            .fetch_add(1, Ordering::Relaxed);
        let _ = self.ws_connections_active.fetch_update(
            Ordering::Relaxed,
            Ordering::Relaxed,
            |current| Some(current.saturating_sub(1)),
        );
    }

    fn record_ws_protocol_error(&self) {
        self.ws_protocol_errors_total
            .fetch_add(1, Ordering::Relaxed);
    }

    fn record_ws_receive_error(&self) {
        self.ws_receive_errors_total.fetch_add(1, Ordering::Relaxed);
    }

    fn record_ws_event_stream_lagged(&self, dropped_events: u64) {
        self.ws_event_stream_lagged_total
            .fetch_add(1, Ordering::Relaxed);
        self.ws_event_stream_lagged_dropped_total
            .fetch_add(dropped_events, Ordering::Relaxed);
    }

    fn record_sse_event_stream_lagged(&self, dropped_events: u64) {
        self.sse_event_stream_lagged_total
            .fetch_add(1, Ordering::Relaxed);
        self.sse_event_stream_lagged_dropped_total
            .fetch_add(dropped_events, Ordering::Relaxed);
    }

    fn record_runtime_task_counter_cache_hit(&self) {
        self.runtime_task_counter_cache_hit_total
            .fetch_add(1, Ordering::Relaxed);
    }

    fn record_runtime_task_counter_cache_miss(&self) {
        self.runtime_task_counter_cache_miss_total
            .fetch_add(1, Ordering::Relaxed);
    }

    fn record_runtime_task_counter_full_scan_fallback(&self) {
        self.runtime_task_counter_full_scan_fallback_total
            .fetch_add(1, Ordering::Relaxed);
    }

    fn record_state_fabric_fanout_coalesced(&self) {
        self.state_fabric_fanout_coalesced_total
            .fetch_add(1, Ordering::Relaxed);
    }

    fn record_thread_live_update_fanout_coalesced(&self) {
        self.thread_live_update_fanout_coalesced_total
            .fetch_add(1, Ordering::Relaxed);
    }

    fn record_ws_replay_gap(&self) {
        self.ws_replay_gap_total.fetch_add(1, Ordering::Relaxed);
    }

    fn record_ws_upgrade_failure(&self) {
        self.ws_upgrade_failures_total
            .fetch_add(1, Ordering::Relaxed);
    }

    fn record_ws_connection_rejected(&self) {
        self.ws_connections_rejected_total
            .fetch_add(1, Ordering::Relaxed);
    }
}

fn approximate_recovery_latency_p95_ms(
    le_1s_total: u64,
    one_to_five_total: u64,
    five_to_ten_total: u64,
    ten_to_twenty_total: u64,
    gt_twenty_total: u64,
) -> u64 {
    let total = le_1s_total
        .saturating_add(one_to_five_total)
        .saturating_add(five_to_ten_total)
        .saturating_add(ten_to_twenty_total)
        .saturating_add(gt_twenty_total);
    if total == 0 {
        return 0;
    }
    let target = ((total as f64) * 0.95).ceil() as u64;
    let mut cumulative = le_1s_total;
    if cumulative >= target {
        return 1_000;
    }
    cumulative = cumulative.saturating_add(one_to_five_total);
    if cumulative >= target {
        return 5_000;
    }
    cumulative = cumulative.saturating_add(five_to_ten_total);
    if cumulative >= target {
        return 10_000;
    }
    cumulative = cumulative.saturating_add(ten_to_twenty_total);
    if cumulative >= target {
        return 20_000;
    }
    30_000
}

#[cfg(test)]
mod diagnostics_and_validation_tests {
    use super::approximate_recovery_latency_p95_ms;

    #[test]
    fn recovery_latency_p95_returns_zero_for_empty_distribution() {
        assert_eq!(approximate_recovery_latency_p95_ms(0, 0, 0, 0, 0), 0);
    }

    #[test]
    fn recovery_latency_p95_maps_to_expected_bucket_threshold() {
        assert_eq!(approximate_recovery_latency_p95_ms(95, 5, 0, 0, 0), 1_000);
        assert_eq!(approximate_recovery_latency_p95_ms(10, 80, 10, 0, 0), 10_000);
        assert_eq!(approximate_recovery_latency_p95_ms(10, 20, 65, 5, 0), 10_000);
        assert_eq!(approximate_recovery_latency_p95_ms(10, 20, 20, 45, 5), 20_000);
        assert_eq!(approximate_recovery_latency_p95_ms(5, 5, 5, 5, 80), 30_000);
    }
}

#[derive(Debug, Default)]
pub struct ConfigValidation {
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}
