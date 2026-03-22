use super::*;

fn temp_metrics_path(test_name: &str) -> PathBuf {
    std::env::temp_dir().join(format!(
        "code-runtime-tool-metrics-{test_name}-{}.json",
        Uuid::new_v4()
    ))
}

fn completed_event(
    tool_name: &str,
    scope: RuntimeToolExecutionScope,
    status: RuntimeToolExecutionStatus,
    at: u64,
) -> RuntimeToolExecutionEvent {
    RuntimeToolExecutionEvent {
        tool_name: tool_name.to_string(),
        scope,
        phase: RuntimeToolExecutionEventPhase::Completed,
        at,
        status: Some(status),
        error_code: None,
        duration_ms: Some(12),
        trace_id: None,
        span_id: None,
        parent_span_id: None,
        attempt: None,
        request_id: None,
        planner_step_key: None,
        workspace_id: None,
    }
}

#[test]
fn store_recovers_from_persisted_snapshot() {
    let path = temp_metrics_path("recover");
    let mut store = RuntimeToolExecutionMetricsStore::with_path(path.clone(), 500);
    store
        .record_events(&[
            RuntimeToolExecutionEvent {
                tool_name: "run-runtime-live-skill".to_string(),
                scope: RuntimeToolExecutionScope::Runtime,
                phase: RuntimeToolExecutionEventPhase::Attempted,
                at: 11,
                status: None,
                error_code: None,
                duration_ms: None,
                trace_id: None,
                span_id: None,
                parent_span_id: None,
                attempt: None,
                request_id: None,
                planner_step_key: None,
                workspace_id: None,
            },
            RuntimeToolExecutionEvent {
                tool_name: "run-runtime-live-skill".to_string(),
                scope: RuntimeToolExecutionScope::Runtime,
                phase: RuntimeToolExecutionEventPhase::Started,
                at: 12,
                status: None,
                error_code: None,
                duration_ms: None,
                trace_id: None,
                span_id: None,
                parent_span_id: None,
                attempt: None,
                request_id: None,
                planner_step_key: None,
                workspace_id: None,
            },
            completed_event(
                "run-runtime-live-skill",
                RuntimeToolExecutionScope::Runtime,
                RuntimeToolExecutionStatus::Success,
                13,
            ),
        ])
        .expect("record metrics");

    let recovered = RuntimeToolExecutionMetricsStore::with_path(path.clone(), 500);
    let snapshot = recovered.read_snapshot();
    assert_eq!(snapshot.totals.attempted_total, 1);
    assert_eq!(snapshot.totals.started_total, 1);
    assert_eq!(snapshot.totals.completed_total, 1);
    assert_eq!(snapshot.recent.len(), 1);
    assert_eq!(
        snapshot.recent[0].status,
        RuntimeToolExecutionStatus::Success
    );

    let _ = fs::remove_file(path);
}

#[test]
fn store_applies_rolling_window_truncation() {
    let path = temp_metrics_path("truncation");
    let mut store = RuntimeToolExecutionMetricsStore::with_path(path.clone(), 3);
    for index in 0..5 {
        store
            .record_events(&[completed_event(
                "execute-workspace-command",
                RuntimeToolExecutionScope::Runtime,
                RuntimeToolExecutionStatus::RuntimeFailed,
                index,
            )])
            .expect("record event");
    }

    let snapshot = store.read_snapshot();
    assert_eq!(snapshot.window_size, 3);
    assert_eq!(snapshot.recent.len(), 3);
    assert_eq!(snapshot.recent[0].at, 2);
    assert_eq!(snapshot.recent[1].at, 3);
    assert_eq!(snapshot.recent[2].at, 4);
    assert_eq!(snapshot.totals.completed_total, 5);

    let _ = fs::remove_file(path);
}

#[test]
fn store_reset_clears_snapshot_and_file() {
    let path = temp_metrics_path("reset");
    let mut store = RuntimeToolExecutionMetricsStore::with_path(path.clone(), 500);
    store
        .record_events(&[completed_event(
            "write-workspace-file",
            RuntimeToolExecutionScope::Write,
            RuntimeToolExecutionStatus::ValidationFailed,
            21,
        )])
        .expect("record event");

    let reset_snapshot = store.reset().expect("reset metrics");
    assert_eq!(reset_snapshot.totals.completed_total, 0);
    assert!(reset_snapshot.recent.is_empty());

    let reloaded = RuntimeToolExecutionMetricsStore::with_path(path.clone(), 500);
    let snapshot = reloaded.read_snapshot();
    assert_eq!(snapshot.totals.completed_total, 0);
    assert!(snapshot.recent.is_empty());

    let _ = fs::remove_file(path);
}

#[test]
fn store_tracks_runtime_safety_counters() {
    let path = temp_metrics_path("safety-counters");
    let mut store = RuntimeToolExecutionMetricsStore::with_path(path.clone(), 500);
    store
        .increment_safety_counter(RuntimeToolSafetyCounter::RepetitionBlocked)
        .expect("increment repetition counter");
    store
        .increment_safety_counter(RuntimeToolSafetyCounter::ApprovalTimeout)
        .expect("increment approval-timeout counter");
    store
        .increment_safety_counter(RuntimeToolSafetyCounter::SubAgentTimeout)
        .expect("increment sub-agent-timeout counter");
    store
        .increment_safety_counter(RuntimeToolSafetyCounter::TerminalizationCasNoop)
        .expect("increment terminalization-cas noop counter");
    store
        .increment_safety_counter(RuntimeToolSafetyCounter::LifecycleSweepRun)
        .expect("increment lifecycle sweep run counter");
    store
        .increment_safety_counter(RuntimeToolSafetyCounter::LifecycleSweepSkipNoLease)
        .expect("increment lifecycle sweep skip-no-lease counter");
    store
        .increment_safety_counter(RuntimeToolSafetyCounter::LifecycleLeaseAcquireFail)
        .expect("increment lifecycle lease acquire-fail counter");
    store
        .increment_safety_counter(RuntimeToolSafetyCounter::LifecycleLeaseRenewFail)
        .expect("increment lifecycle lease renew-fail counter");
    store
        .increment_safety_counter(RuntimeToolSafetyCounter::LifecycleLeaseLost)
        .expect("increment lifecycle lease lost counter");
    store
        .increment_safety_counter(RuntimeToolSafetyCounter::LifecycleLeaseContended)
        .expect("increment lifecycle lease contended counter");

    let snapshot = store.read_snapshot();
    assert_eq!(snapshot.totals.repetition_blocked_total, 1);
    assert_eq!(snapshot.totals.approval_timeout_total, 1);
    assert_eq!(snapshot.totals.sub_agent_timeout_total, 1);
    assert_eq!(snapshot.totals.terminalization_cas_noop_total, 1);
    assert_eq!(snapshot.totals.lifecycle_sweep_run_total, 1);
    assert_eq!(snapshot.totals.lifecycle_sweep_skip_no_lease_total, 1);
    assert_eq!(snapshot.totals.lifecycle_lease_acquire_fail_total, 1);
    assert_eq!(snapshot.totals.lifecycle_lease_renew_fail_total, 1);
    assert_eq!(snapshot.totals.lifecycle_lease_lost_total, 1);
    assert_eq!(snapshot.totals.lifecycle_lease_contended_total, 1);

    let filtered = filter_runtime_tool_execution_snapshot(
        &snapshot,
        &RuntimeToolExecutionMetricsReadFilter::default(),
    );
    assert_eq!(filtered.totals.repetition_blocked_total, 1);
    assert_eq!(filtered.totals.approval_timeout_total, 1);
    assert_eq!(filtered.totals.sub_agent_timeout_total, 1);
    assert_eq!(filtered.totals.terminalization_cas_noop_total, 1);
    assert_eq!(filtered.totals.lifecycle_sweep_run_total, 1);
    assert_eq!(filtered.totals.lifecycle_sweep_skip_no_lease_total, 1);
    assert_eq!(filtered.totals.lifecycle_lease_acquire_fail_total, 1);
    assert_eq!(filtered.totals.lifecycle_lease_renew_fail_total, 1);
    assert_eq!(filtered.totals.lifecycle_lease_lost_total, 1);
    assert_eq!(filtered.totals.lifecycle_lease_contended_total, 1);

    let _ = fs::remove_file(path);
}

#[tokio::test]
async fn store_records_consistent_totals_under_concurrent_updates() {
    let path = temp_metrics_path("concurrent");
    let store = Arc::new(AsyncMutex::new(
        RuntimeToolExecutionMetricsStore::with_path(path.clone(), 500),
    ));
    let mut joins = Vec::new();
    for worker in 0..12_u64 {
        let store = store.clone();
        joins.push(tokio::spawn(async move {
            let mut lock = store.lock().await;
            lock.record_events(&[
                RuntimeToolExecutionEvent {
                    tool_name: format!("tool-{worker}"),
                    scope: RuntimeToolExecutionScope::Runtime,
                    phase: RuntimeToolExecutionEventPhase::Attempted,
                    at: worker * 10,
                    status: None,
                    error_code: None,
                    duration_ms: None,
                    trace_id: None,
                    span_id: None,
                    parent_span_id: None,
                    attempt: None,
                    request_id: None,
                    planner_step_key: None,
                    workspace_id: None,
                },
                RuntimeToolExecutionEvent {
                    tool_name: format!("tool-{worker}"),
                    scope: RuntimeToolExecutionScope::Runtime,
                    phase: RuntimeToolExecutionEventPhase::Started,
                    at: worker * 10 + 1,
                    status: None,
                    error_code: None,
                    duration_ms: None,
                    trace_id: None,
                    span_id: None,
                    parent_span_id: None,
                    attempt: None,
                    request_id: None,
                    planner_step_key: None,
                    workspace_id: None,
                },
                completed_event(
                    format!("tool-{worker}").as_str(),
                    RuntimeToolExecutionScope::Runtime,
                    RuntimeToolExecutionStatus::Success,
                    worker * 10 + 2,
                ),
            ])
            .expect("record metrics");
        }));
    }
    for join in joins {
        join.await.expect("join task");
    }

    let snapshot = store.lock().await.read_snapshot();
    assert_eq!(snapshot.totals.attempted_total, 12);
    assert_eq!(snapshot.totals.started_total, 12);
    assert_eq!(snapshot.totals.completed_total, 12);
    assert_eq!(snapshot.totals.success_total, 12);
    assert_eq!(snapshot.recent.len(), 12);

    let _ = fs::remove_file(path);
}

#[test]
fn parse_events_rejects_trace_id_without_span_id() {
    let params = serde_json::json!({
        "events": [
            {
                "toolName": "execute-workspace-command",
                "scope": "runtime",
                "phase": "attempted",
                "at": 11,
                "traceId": "trace-1"
            }
        ]
    });

    let error =
        parse_runtime_tool_execution_events(&params).expect_err("traceId without spanId must fail");
    let rendered = format!("{error:?}");
    assert!(rendered.contains("InvalidParams"));
    assert!(rendered.contains("spanId is required"));
}
