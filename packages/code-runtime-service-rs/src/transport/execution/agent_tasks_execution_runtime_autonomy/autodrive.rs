use super::*;

fn ensure_auto_drive_navigation(
    auto_drive: &mut AgentTaskAutoDriveState,
) -> &mut AgentTaskAutoDriveNavigation {
    auto_drive
        .navigation
        .get_or_insert_with(|| AgentTaskAutoDriveNavigation {
            active_waypoint: None,
            completed_waypoints: Some(Vec::new()),
            pending_waypoints: Some(Vec::new()),
            last_progress_at: None,
            reroute_count: Some(0),
            validation_failure_count: Some(0),
            no_progress_iterations: Some(0),
        })
}

fn set_outcome_feedback(
    auto_drive: &mut AgentTaskAutoDriveState,
    status: &str,
    summary: Option<String>,
    failure_class: Option<String>,
    at: u64,
    human_intervention_required: bool,
) {
    let validation_commands = auto_drive
        .scenario_profile
        .as_ref()
        .and_then(|profile| profile.representative_commands.clone());
    let held_out_preserved = auto_drive
        .scenario_profile
        .as_ref()
        .and_then(|profile| profile.held_out_guidance.as_ref())
        .map(|guidance| !guidance.is_empty());
    auto_drive.outcome_feedback = Some(AgentTaskAutoDriveOutcomeFeedback {
        status: Some(status.to_string()),
        summary,
        failure_class,
        validation_commands,
        human_intervention_required: Some(human_intervention_required),
        held_out_preserved,
        at: Some(at),
    });
}

fn ensure_autonomy_state(
    auto_drive: &mut AgentTaskAutoDriveState,
) -> &mut AgentTaskAutoDriveAutonomyState {
    if auto_drive.autonomy_state.is_none() {
        let independent_thread = auto_drive
            .decision_policy
            .as_ref()
            .and_then(|policy| policy.independent_thread);
        let autonomy_priority = auto_drive
            .decision_policy
            .as_ref()
            .and_then(|policy| policy.autonomy_priority.clone());
        let high_priority = independent_thread.unwrap_or(false)
            && matches!(autonomy_priority.as_deref(), Some("operator"));
        let background_safe = auto_drive
            .scenario_profile
            .as_ref()
            .and_then(|profile| profile.safe_background);
        auto_drive.autonomy_state = Some(AgentTaskAutoDriveAutonomyState {
            independent_thread,
            autonomy_priority,
            high_priority: Some(high_priority),
            escalation_pressure: Some("medium".to_string()),
            unattended_continuation_allowed: Some(false),
            background_safe,
            human_intervention_hotspots: None,
        });
    }
    auto_drive.autonomy_state.as_mut().expect("autonomy state")
}

pub(crate) fn mark_auto_drive_progress(auto_drive: &mut Option<AgentTaskAutoDriveState>, at: u64) {
    let Some(auto_drive) = auto_drive.as_mut() else {
        return;
    };
    let navigation = ensure_auto_drive_navigation(auto_drive);
    navigation.last_progress_at = Some(at);
    navigation.no_progress_iterations = Some(0);
    auto_drive.stop = None;
    if let Some(trace) = auto_drive.decision_trace.as_mut() {
        trace.phase = Some("progress".to_string());
    }
    ensure_autonomy_state(auto_drive).escalation_pressure = Some("low".to_string());
    set_outcome_feedback(auto_drive, "progressing", None, None, at, false);
}

pub(crate) fn mark_auto_drive_failure(
    auto_drive: &mut Option<AgentTaskAutoDriveState>,
    reason: &str,
    summary: Option<String>,
    at: u64,
) {
    let Some(auto_drive) = auto_drive.as_mut() else {
        return;
    };
    let navigation = ensure_auto_drive_navigation(auto_drive);
    navigation.last_progress_at = Some(at);
    if reason == "validation_failed" {
        navigation.validation_failure_count =
            Some(navigation.validation_failure_count.unwrap_or(0) + 1);
    }
    if let Some(trace) = auto_drive.decision_trace.as_mut() {
        trace.phase = Some("failure".to_string());
        trace.summary = summary.clone();
    }
    auto_drive.stop = Some(AgentTaskAutoDriveStopState {
        reason: reason.to_string(),
        summary,
        at: Some(at),
    });
    ensure_autonomy_state(auto_drive).escalation_pressure = Some("high".to_string());
    set_outcome_feedback(
        auto_drive,
        if reason == "validation_failed" {
            "validation_failed"
        } else {
            "failed"
        },
        auto_drive.stop.as_ref().and_then(|stop| stop.summary.clone()),
        Some(reason.to_string()),
        at,
        true,
    );
}

pub(crate) fn mark_auto_drive_completed(
    auto_drive: &mut Option<AgentTaskAutoDriveState>,
    summary: Option<String>,
    at: u64,
) {
    let Some(auto_drive) = auto_drive.as_mut() else {
        return;
    };
    let navigation = ensure_auto_drive_navigation(auto_drive);
    if let Some(active_waypoint) = navigation.active_waypoint.take() {
        let completed = navigation.completed_waypoints.get_or_insert_with(Vec::new);
        if !completed.iter().any(|entry| entry == &active_waypoint) {
            completed.push(active_waypoint);
        }
    }
    navigation.pending_waypoints = Some(Vec::new());
    navigation.last_progress_at = Some(at);
    navigation.no_progress_iterations = Some(0);
    if let Some(trace) = auto_drive.decision_trace.as_mut() {
        trace.phase = Some("completed".to_string());
        trace.summary = summary.clone();
    }
    auto_drive.stop = Some(AgentTaskAutoDriveStopState {
        reason: "completed".to_string(),
        summary,
        at: Some(at),
    });
    ensure_autonomy_state(auto_drive).escalation_pressure = Some("low".to_string());
    set_outcome_feedback(
        auto_drive,
        "completed",
        auto_drive.stop.as_ref().and_then(|stop| stop.summary.clone()),
        None,
        at,
        false,
    );
}

#[cfg_attr(not(test), allow(dead_code))]
pub(crate) fn set_auto_drive_recovery_marker(
    auto_drive: &mut Option<AgentTaskAutoDriveState>,
    checkpoint_id: Option<String>,
    trace_id: Option<String>,
    recovered_at: u64,
    summary: Option<String>,
    resume_ready: bool,
) {
    let Some(auto_drive) = auto_drive.as_mut() else {
        return;
    };
    auto_drive.recovery = Some(AgentTaskAutoDriveRecoveryMarker {
        recovered: Some(true),
        resume_ready: Some(resume_ready),
        checkpoint_id,
        trace_id,
        recovered_at: Some(recovered_at),
        summary,
    });
    if let Some(trace) = auto_drive.decision_trace.as_mut() {
        trace.phase = Some("recovered".to_string());
    }
    ensure_autonomy_state(auto_drive).escalation_pressure = Some("medium".to_string());
    set_outcome_feedback(
        auto_drive,
        "recovered",
        auto_drive.recovery.as_ref().and_then(|marker| marker.summary.clone()),
        None,
        recovered_at,
        !resume_ready,
    );
}
