use super::*;

fn test_backend() -> RuntimeBackendSummary {
    RuntimeBackendSummary {
        backend_id: "worker-a".to_string(),
        display_name: "Worker A".to_string(),
        capabilities: vec!["code".to_string()],
        max_concurrency: 4,
        cost_tier: "standard".to_string(),
        latency_class: "interactive".to_string(),
        rollout_state: "current".to_string(),
        status: "active".to_string(),
        healthy: true,
        health_score: 0.98,
        failures: 0,
        queue_depth: 0,
        running_tasks: 0,
        created_at: 1,
        updated_at: 1,
        last_heartbeat_at: now_ms(),
        heartbeat_interval_ms: Some(1_000),
        backend_class: Some("primary".to_string()),
        specializations: None,
        policy: Some(RuntimeBackendPolicyProfile {
            trust_tier: Some("trusted".to_string()),
            data_sensitivity: Some("restricted".to_string()),
            approval_policy: Some("checkpoint-required".to_string()),
            allowed_tool_classes: Some(vec!["read".to_string(), "write".to_string()]),
        }),
        connectivity: None,
        lease: None,
        readiness: None,
        backend_kind: Some("native".to_string()),
        integration_id: None,
        transport: Some("stdio".to_string()),
        origin: Some("runtime-native".to_string()),
        contract: None,
    }
}

#[test]
fn hydrate_runtime_backends_from_native_store_restores_persisted_registry_entries() {
    let temp = tempfile::tempdir().expect("tempdir");
    let store = native_state_store::NativeStateStore::new(temp.path().join("native.db"));
    store.initialize_blocking();
    let backend = test_backend();
    store
        .upsert_setting_value_blocking(
            native_state_store::TABLE_NATIVE_RUNTIME_STATE_KV,
            RUNTIME_BACKENDS_STATE_KEY,
            json!([backend]),
        )
        .expect("persist registry payload");

    let hydrated = hydrate_runtime_backends_from_native_store(&store);
    let restored = hydrated.get("worker-a").expect("restored backend");
    assert_eq!(restored.backend_class.as_deref(), Some("primary"));
    assert_eq!(restored.backend_kind.as_deref(), Some("native"));
    assert_eq!(
        restored
            .contract
            .as_ref()
            .and_then(|entry| entry.get("origin"))
            .and_then(Value::as_str),
        Some("runtime-native")
    );
    assert_eq!(
        restored
            .policy
            .as_ref()
            .and_then(|policy| policy.trust_tier.as_deref()),
        Some("trusted")
    );
}

#[test]
fn assess_runtime_backend_operability_rejects_unreachable_or_expired_backends() {
    let mut unreachable = test_backend();
    unreachable.connectivity = Some(RuntimeBackendConnectivitySummary {
        mode: Some("overlay".to_string()),
        overlay: Some("tailscale".to_string()),
        endpoint: None,
        reachability: Some("unreachable".to_string()),
        checked_at: Some(now_ms()),
        source: Some("probe".to_string()),
        reason: Some("link down".to_string()),
    });
    let assessment = assess_runtime_backend_operability(&unreachable, 0);
    assert_eq!(assessment.state, "blocked");
    assert!(!assessment.placement_eligible);
    assert!(assessment
        .reasons
        .iter()
        .any(|reason| reason == "connectivity_unreachable"));

    let mut expired = test_backend();
    expired.lease = Some(RuntimeBackendLeaseSummary {
        status: "expired".to_string(),
        lease_id: Some("lease-1".to_string()),
        holder_id: Some("holder-1".to_string()),
        scope: Some("backend".to_string()),
        acquired_at: Some(now_ms().saturating_sub(10_000)),
        expires_at: Some(now_ms().saturating_sub(1_000)),
        ttl_ms: Some(1_000),
        observed_at: Some(now_ms()),
    });
    let assessment = assess_runtime_backend_operability(&expired, 0);
    assert_eq!(assessment.state, "blocked");
    assert!(!assessment.placement_eligible);
    assert!(assessment
        .reasons
        .iter()
        .any(|reason| reason == "lease_expired"));
}

#[test]
fn assess_runtime_backend_operability_marks_stale_heartbeat_as_attention() {
    let mut stale = test_backend();
    stale.last_heartbeat_at = now_ms().saturating_sub(20_000);
    stale.heartbeat_interval_ms = Some(1_000);

    let assessment = assess_runtime_backend_operability(&stale, 0);
    assert_eq!(assessment.state, "blocked");
    assert!(!assessment.placement_eligible);
    assert_eq!(assessment.heartbeat_state, "stale");
    assert!(assessment
        .reasons
        .iter()
        .any(|reason| reason == "heartbeat_stale"));
}

#[test]
fn runtime_backend_summary_value_includes_policy_profile() {
    let backend = test_backend();
    let value = build_runtime_backend_summary_value(&backend, 0).expect("serialize backend");
    assert_eq!(value["policy"]["trustTier"], "trusted");
    assert_eq!(value["policy"]["dataSensitivity"], "restricted");
    assert_eq!(value["policy"]["approvalPolicy"], "checkpoint-required");
    assert_eq!(value["policy"]["allowedToolClasses"], json!(["read", "write"]));
}
