use super::agent_policy::is_agent_task_terminal_status;
use super::*;

pub(super) fn normalize_execution_mode(value: Option<&str>) -> Result<&'static str, RpcError> {
    let normalized = value
        .unwrap_or("single")
        .trim()
        .to_ascii_lowercase()
        .replace('_', "-");
    match normalized.as_str() {
        "" | "single" => Ok("single"),
        "distributed" => Ok("distributed"),
        _ => Err(RpcError::invalid_params(format!(
            "Unsupported execution mode `{normalized}`. Expected one of: single, distributed."
        ))),
    }
}

fn backend_matches_required_capabilities(
    backend: &RuntimeBackendSummary,
    required_capabilities: &[String],
) -> bool {
    required_capabilities.iter().all(|required| {
        backend
            .capabilities
            .iter()
            .any(|candidate| candidate.eq_ignore_ascii_case(required))
    })
}

fn backend_is_eligible_for_placement(
    backend: &RuntimeBackendSummary,
    required_capabilities: &[String],
    active_tasks: u64,
) -> bool {
    backend_matches_required_capabilities(backend, required_capabilities)
        && assess_runtime_backend_operability(backend, active_tasks).placement_eligible
}

#[derive(Clone, Debug, Default)]
pub(super) struct RuntimeBackendPlacementContext {
    pub(super) preferred_backend_ids: Vec<String>,
    pub(super) resume_backend_id: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(super) struct RuntimeBackendPlacementScoreBreakdown {
    pub(super) backend_id: String,
    pub(super) total_score: i64,
    pub(super) explicit_preference_score: i64,
    pub(super) resume_affinity_score: i64,
    pub(super) readiness_score: i64,
    pub(super) latency_score: i64,
    pub(super) capacity_score: i64,
    pub(super) queue_penalty: i64,
    pub(super) failure_penalty: i64,
    pub(super) health_score: i64,
    pub(super) reasons: Vec<String>,
}

#[derive(Clone, Debug)]
pub(super) struct RuntimeBackendPlacementOutcome {
    pub(super) selected_backend_id: String,
    pub(super) fallback_reason_code: Option<String>,
    pub(super) resume_backend_id: Option<String>,
    pub(super) score_breakdown: Vec<RuntimeBackendPlacementScoreBreakdown>,
}

fn latency_score_for_backend(backend: &RuntimeBackendSummary) -> i64 {
    match backend.latency_class.as_str() {
        "local" => 80,
        "interactive" => 60,
        "regional" => 35,
        "standard" => 20,
        "cross-region" => 0,
        _ => 10,
    }
}

fn score_backend_candidate(
    backend: &RuntimeBackendSummary,
    assessment: &RuntimeBackendOperabilityAssessment,
    context: &RuntimeBackendPlacementContext,
) -> RuntimeBackendPlacementScoreBreakdown {
    let backend_id = backend.backend_id.as_str();
    let explicit_preference_score = if context
        .preferred_backend_ids
        .iter()
        .any(|candidate| candidate == backend_id)
    {
        1_000
    } else {
        0
    };
    let resume_affinity_score = if context.resume_backend_id.as_deref() == Some(backend_id) {
        300
    } else {
        0
    };
    let readiness_score = if assessment.state == "ready" { 180 } else { 60 };
    let latency_score = latency_score_for_backend(backend);
    let capacity_score = i64::try_from(assessment.available_execution_slots)
        .unwrap_or(i64::MAX)
        .min(8)
        * 25;
    let queue_penalty = -i64::try_from(backend.queue_depth)
        .unwrap_or(i64::MAX)
        .min(20)
        * 15;
    let failure_penalty = -i64::try_from(backend.failures).unwrap_or(i64::MAX).min(20) * 20;
    let health_score = (backend.health_score * 100.0).round() as i64;
    let total_score = explicit_preference_score
        + resume_affinity_score
        + readiness_score
        + latency_score
        + capacity_score
        + queue_penalty
        + failure_penalty
        + health_score;
    let mut reasons = Vec::new();
    if explicit_preference_score > 0 {
        reasons.push("explicit_preference".to_string());
    }
    if resume_affinity_score > 0 {
        reasons.push("resume_affinity".to_string());
    }
    if readiness_score > 100 {
        reasons.push("placement_ready".to_string());
    } else {
        reasons.push("placement_attention".to_string());
    }
    if latency_score > 0 {
        reasons.push(format!("latency:{}", backend.latency_class));
    }
    if capacity_score > 0 {
        reasons.push("slots_available".to_string());
    }
    if queue_penalty < 0 {
        reasons.push("queue_pressure".to_string());
    }
    if failure_penalty < 0 {
        reasons.push("recent_failures".to_string());
    }
    RuntimeBackendPlacementScoreBreakdown {
        backend_id: backend.backend_id.clone(),
        total_score,
        explicit_preference_score,
        resume_affinity_score,
        readiness_score,
        latency_score,
        capacity_score,
        queue_penalty,
        failure_penalty,
        health_score,
        reasons,
    }
}

fn select_backend_from_candidates_with_context(
    candidates: Vec<(&RuntimeBackendSummary, RuntimeBackendOperabilityAssessment)>,
    context: &RuntimeBackendPlacementContext,
) -> Option<RuntimeBackendPlacementOutcome> {
    let mut scored = candidates
        .into_iter()
        .map(|(backend, assessment)| {
            let breakdown = score_backend_candidate(backend, &assessment, context);
            (backend, assessment, breakdown)
        })
        .collect::<Vec<_>>();
    scored.sort_by(|left, right| {
        right
            .2
            .total_score
            .cmp(&left.2.total_score)
            .then((right.1.state == "ready").cmp(&(left.1.state == "ready")))
            .then(left.1.reasons.len().cmp(&right.1.reasons.len()))
            .then(left.0.backend_id.cmp(&right.0.backend_id))
    });
    let selected = scored.first()?;
    let selected_backend_id = selected.0.backend_id.clone();
    let fallback_reason_code = if !context.preferred_backend_ids.is_empty()
        && !context
            .preferred_backend_ids
            .iter()
            .any(|candidate| candidate == selected_backend_id.as_str())
    {
        Some("preferred_backend_unavailable".to_string())
    } else if let Some(resume_backend_id) = context.resume_backend_id.as_deref() {
        if resume_backend_id != selected_backend_id.as_str() {
            Some("resume_backend_unavailable".to_string())
        } else {
            None
        }
    } else {
        None
    };
    Some(RuntimeBackendPlacementOutcome {
        selected_backend_id,
        fallback_reason_code,
        resume_backend_id: context.resume_backend_id.clone(),
        score_breakdown: scored.into_iter().map(|entry| entry.2).collect(),
    })
}

fn build_backend_placement_failure_message(
    backends: &HashMap<String, RuntimeBackendSummary>,
    required_capabilities: &[String],
) -> String {
    let mut candidate_messages = Vec::new();
    let mut backend_ids = backends.keys().cloned().collect::<Vec<_>>();
    backend_ids.sort();
    for backend_id in backend_ids {
        let Some(backend) = backends.get(backend_id.as_str()) else {
            continue;
        };
        let mut reasons =
            assess_runtime_backend_operability(backend, backend.running_tasks).reasons;
        if !backend_matches_required_capabilities(backend, required_capabilities) {
            reasons.push("required_capabilities_missing".to_string());
        }
        let detail = if reasons.is_empty() {
            "no operability evidence published".to_string()
        } else {
            reasons.join(", ")
        };
        candidate_messages.push(format!("{}: {detail}", backend.backend_id));
    }
    if candidate_messages.is_empty() {
        "No eligible runtime backend available for distributed execution.".to_string()
    } else {
        format!(
            "No eligible runtime backend available for distributed execution. candidate truth: {}",
            candidate_messages.join("; ")
        )
    }
}

async fn active_tasks_by_backend_for_placement(ctx: &AppContext) -> HashMap<String, u64> {
    let store = ctx.agent_tasks.read().await;
    let mut counts = HashMap::<String, u64>::new();
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

fn runtime_backend_active_tasks(
    backend: &RuntimeBackendSummary,
    active_tasks_by_backend: &HashMap<String, u64>,
) -> u64 {
    active_tasks_by_backend
        .get(backend.backend_id.as_str())
        .copied()
        .unwrap_or(backend.running_tasks)
        .max(backend.running_tasks)
}

pub(super) async fn select_backend_for_agent_task(
    ctx: &AppContext,
    required_capabilities: &[String],
    context: &RuntimeBackendPlacementContext,
) -> Result<RuntimeBackendPlacementOutcome, RpcError> {
    if let Err(error) = sync_runtime_backends_from_distributed_store(ctx).await {
        warn!(
            error = error.as_str(),
            "failed to hydrate runtime backends before placement"
        );
    }

    let active_tasks_by_backend = active_tasks_by_backend_for_placement(ctx).await;
    let backend_store = ctx.runtime_backends.read().await;

    let eligible = backend_store
        .values()
        .filter_map(|backend| {
            let active_tasks = runtime_backend_active_tasks(backend, &active_tasks_by_backend);
            if !backend_is_eligible_for_placement(backend, required_capabilities, active_tasks) {
                return None;
            }
            Some((
                backend,
                assess_runtime_backend_operability(backend, active_tasks),
            ))
        })
        .collect::<Vec<_>>();
    if eligible.is_empty() {
        ctx.runtime_diagnostics
            .record_agent_backend_placement_failure();
        return Err(RpcError::invalid_params(
            build_backend_placement_failure_message(&backend_store, required_capabilities),
        ));
    }

    match select_backend_from_candidates_with_context(eligible, context) {
        Some(selected) => Ok(selected),
        None => {
            ctx.runtime_diagnostics
                .record_agent_backend_placement_failure();
            Err(RpcError::invalid_params(
                "No backend matched distributed execution placement constraints.",
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_backend(backend_id: &str) -> RuntimeBackendSummary {
        RuntimeBackendSummary {
            backend_id: backend_id.to_string(),
            display_name: backend_id.to_string(),
            capabilities: vec!["code".to_string()],
            max_concurrency: 4,
            cost_tier: "standard".to_string(),
            latency_class: "interactive".to_string(),
            rollout_state: "current".to_string(),
            status: "active".to_string(),
            healthy: true,
            health_score: 0.95,
            failures: 0,
            queue_depth: 0,
            running_tasks: 0,
            created_at: 1,
            updated_at: 1,
            last_heartbeat_at: now_ms(),
            heartbeat_interval_ms: Some(1_000),
            backend_class: Some("primary".to_string()),
            specializations: None,
            policy: Some(default_runtime_backend_policy_profile()),
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
    fn placement_prefers_resume_backend_affinity_over_generic_health_tie_breaks() {
        let resume_backend = test_backend("worker-resume");
        let mut generic_backend = test_backend("worker-generic");
        generic_backend.health_score = 0.99;

        let outcome = select_backend_from_candidates_with_context(
            vec![
                (
                    &resume_backend,
                    assess_runtime_backend_operability(&resume_backend, 0),
                ),
                (
                    &generic_backend,
                    assess_runtime_backend_operability(&generic_backend, 0),
                ),
            ],
            &RuntimeBackendPlacementContext {
                preferred_backend_ids: Vec::new(),
                resume_backend_id: Some("worker-resume".to_string()),
            },
        )
        .expect("placement outcome");

        assert_eq!(outcome.selected_backend_id, "worker-resume");
        assert_eq!(outcome.resume_backend_id.as_deref(), Some("worker-resume"));
        assert_eq!(outcome.fallback_reason_code, None);
    }

    #[test]
    fn placement_reports_structured_fallback_when_preferred_backend_is_unavailable() {
        let available_backend = test_backend("worker-ready");

        let outcome = select_backend_from_candidates_with_context(
            vec![(
                &available_backend,
                assess_runtime_backend_operability(&available_backend, 0),
            )],
            &RuntimeBackendPlacementContext {
                preferred_backend_ids: vec!["worker-missing".to_string()],
                resume_backend_id: None,
            },
        )
        .expect("placement outcome");

        assert_eq!(outcome.selected_backend_id, "worker-ready");
        assert_eq!(
            outcome.fallback_reason_code.as_deref(),
            Some("preferred_backend_unavailable")
        );
        assert!(outcome
            .score_breakdown
            .iter()
            .any(|entry| entry.backend_id == "worker-ready"));
    }
}
