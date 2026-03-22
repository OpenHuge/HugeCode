use super::*;

const BACKEND_HEARTBEAT_STALE_MULTIPLIER: u64 = 2;

#[derive(Clone, Debug)]
pub(crate) struct RuntimeBackendOperabilityAssessment {
    pub(crate) state: &'static str,
    pub(crate) placement_eligible: bool,
    pub(crate) summary: String,
    pub(crate) reasons: Vec<String>,
    pub(crate) availability: &'static str,
    pub(crate) heartbeat_state: &'static str,
    pub(crate) heartbeat_age_ms: u64,
    pub(crate) reachability: Option<String>,
    pub(crate) lease_status: Option<String>,
    pub(crate) readiness_state: Option<String>,
    pub(crate) active_tasks: u64,
    pub(crate) available_execution_slots: u64,
}

pub(crate) fn backend_is_acp_projection(summary: &RuntimeBackendSummary) -> bool {
    summary.origin.as_deref() == Some("acp-projection")
        || summary.backend_kind.as_deref() == Some("acp")
        || summary.backend_id.starts_with("acp:")
}

fn backend_reachability(summary: &RuntimeBackendSummary) -> Option<&str> {
    summary
        .connectivity
        .as_ref()
        .and_then(|connectivity| connectivity.reachability.as_deref())
}

fn backend_lease_status(summary: &RuntimeBackendSummary) -> Option<&str> {
    summary.lease.as_ref().map(|lease| lease.status.as_str())
}

fn compute_backend_heartbeat_age_ms(summary: &RuntimeBackendSummary, now: u64) -> u64 {
    now.saturating_sub(summary.last_heartbeat_at)
}

fn backend_heartbeat_stale(summary: &RuntimeBackendSummary, heartbeat_age_ms: u64) -> bool {
    summary
        .heartbeat_interval_ms
        .map(|interval_ms| {
            interval_ms > 0
                && heartbeat_age_ms > interval_ms.saturating_mul(BACKEND_HEARTBEAT_STALE_MULTIPLIER)
        })
        .unwrap_or(false)
}

fn build_backend_operability_summary(
    summary: &RuntimeBackendSummary,
    active_tasks: u64,
    reasons: &[String],
    availability: &str,
    heartbeat_state: &str,
) -> String {
    if availability == "available" {
        return format!(
            "{} is placement-ready with {} open slot(s).",
            summary.display_name,
            summary
                .max_concurrency
                .saturating_sub(active_tasks.min(summary.max_concurrency))
        );
    }
    let reason_text = if reasons.is_empty() {
        availability.to_string()
    } else {
        reasons.join(", ")
    };
    format!(
        "{} is {} for placement (heartbeat {}, queue {}, running {}/{}, reasons: {}).",
        summary.display_name,
        availability,
        heartbeat_state,
        summary.queue_depth,
        active_tasks,
        summary.max_concurrency,
        reason_text
    )
}

pub(crate) fn assess_runtime_backend_operability(
    summary: &RuntimeBackendSummary,
    active_tasks: u64,
) -> RuntimeBackendOperabilityAssessment {
    let now = now_ms();
    let heartbeat_age_ms = compute_backend_heartbeat_age_ms(summary, now);
    let heartbeat_stale = backend_heartbeat_stale(summary, heartbeat_age_ms);
    let reachability = backend_reachability(summary).map(str::to_string);
    let lease_status = backend_lease_status(summary).map(str::to_string);
    let readiness_state = summary.readiness.as_ref().map(|entry| entry.state.clone());
    let mut reasons = Vec::<String>::new();
    let mut blocked = false;
    let mut attention = false;

    if summary.status == "disabled" {
        reasons.push("backend_disabled".to_string());
        blocked = true;
    }
    if summary.status == "draining" {
        reasons.push("backend_draining".to_string());
        blocked = true;
    }
    if !matches!(summary.rollout_state.as_str(), "current" | "ramping") {
        reasons.push("backend_rollout_inactive".to_string());
        blocked = true;
    }
    if !summary.healthy {
        reasons.push("health_check_failed".to_string());
        blocked = true;
    }
    if matches!(reachability.as_deref(), Some("unreachable")) {
        reasons.push("connectivity_unreachable".to_string());
        blocked = true;
    } else if matches!(reachability.as_deref(), Some("degraded")) {
        reasons.push("connectivity_degraded".to_string());
        attention = true;
    }
    if matches!(lease_status.as_deref(), Some("expired")) {
        reasons.push("lease_expired".to_string());
        blocked = true;
    } else if matches!(lease_status.as_deref(), Some("released")) {
        reasons.push("lease_released".to_string());
        blocked = true;
    } else if matches!(lease_status.as_deref(), Some("expiring")) {
        reasons.push("lease_expiring".to_string());
        attention = true;
    }
    if heartbeat_stale {
        reasons.push("heartbeat_stale".to_string());
        blocked = true;
    }
    if summary.max_concurrency > 0 && active_tasks >= summary.max_concurrency {
        reasons.push("capacity_saturated".to_string());
        blocked = true;
    }
    if summary.queue_depth > 0 {
        reasons.push("queue_backlog".to_string());
        attention = true;
    }
    if summary.failures > 0 {
        reasons.push("recent_failures_recorded".to_string());
        attention = true;
    }
    match readiness_state.as_deref() {
        Some("blocked") => {
            reasons.push("readiness_blocked".to_string());
            blocked = true;
        }
        Some("attention") => {
            reasons.push("readiness_attention".to_string());
            attention = true;
        }
        Some("unknown") => {
            reasons.push("readiness_unknown".to_string());
            attention = true;
        }
        _ => {}
    }

    let availability = if summary.status == "disabled" {
        "disabled"
    } else if summary.status == "draining" {
        "draining"
    } else if reasons.iter().any(|reason| reason == "capacity_saturated") {
        "saturated"
    } else if blocked || attention {
        "degraded"
    } else {
        "available"
    };
    let state = if blocked {
        "blocked"
    } else if attention {
        "attention"
    } else {
        "ready"
    };
    let heartbeat_state = if heartbeat_stale {
        "stale"
    } else if summary.last_heartbeat_at == 0 {
        "missing"
    } else {
        "fresh"
    };
    let available_execution_slots = summary
        .max_concurrency
        .saturating_sub(active_tasks.min(summary.max_concurrency));

    RuntimeBackendOperabilityAssessment {
        state,
        placement_eligible: state != "blocked",
        summary: build_backend_operability_summary(
            summary,
            active_tasks,
            reasons.as_slice(),
            availability,
            heartbeat_state,
        ),
        reasons,
        availability,
        heartbeat_state,
        heartbeat_age_ms,
        reachability,
        lease_status,
        readiness_state,
        active_tasks,
        available_execution_slots,
    }
}

pub(crate) fn build_runtime_backend_operability_value(
    summary: &RuntimeBackendSummary,
    active_tasks: u64,
) -> Value {
    let assessment = assess_runtime_backend_operability(summary, active_tasks);
    json!({
        "state": assessment.state,
        "placementEligible": assessment.placement_eligible,
        "summary": assessment.summary,
        "reasons": assessment.reasons,
        "heartbeatState": assessment.heartbeat_state,
        "heartbeatAgeMs": assessment.heartbeat_age_ms,
        "reachability": assessment.reachability,
        "leaseStatus": assessment.lease_status,
        "readinessState": assessment.readiness_state,
        "activeTasks": assessment.active_tasks,
        "availableExecutionSlots": assessment.available_execution_slots,
    })
}
