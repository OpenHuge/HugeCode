use super::autodrive::{
    mark_auto_drive_completed, mark_auto_drive_failure, mark_auto_drive_progress,
    set_auto_drive_recovery_marker,
};
use super::*;

#[test]
fn security_inspector_denies_destructive_shell_pattern() {
    let decision = inspect_shell_command("rm -rf / --no-preserve-root");
    assert!(matches!(
        decision,
        ToolInspectorDecision::Deny {
            rule_id: Some(_),
            ..
        }
    ));
}

#[test]
fn security_inspector_requires_approval_for_risky_shell_pattern() {
    let decision = inspect_shell_command("sudo chmod -R 777 ./workspace");
    assert!(matches!(
        decision,
        ToolInspectorDecision::RequireApproval {
            rule_id: Some(_),
            ..
        }
    ));
}

#[test]
fn context_compression_trigger_detects_large_payloads() {
    let large_output = "a".repeat(32 * 1024);
    let trigger = context_compression::detect_context_compression_trigger(
        Some(large_output.as_str()),
        &json!({}),
        &[],
        true,
        1,
    );
    assert!(trigger.is_some());
}

#[test]
fn context_compression_trigger_detects_failure_streak() {
    let trigger = context_compression::detect_context_compression_trigger(
        Some("small"),
        &json!({}),
        &[
            AgentTaskStatus::Completed.as_str().to_string(),
            AgentTaskStatus::Failed.as_str().to_string(),
            AgentTaskStatus::Failed.as_str().to_string(),
        ],
        false,
        4,
    );
    assert!(matches!(
        trigger,
        Some(context_compression::ContextCompressionTrigger {
            source: context_compression::ContextCompressionTriggerSource::ConsecutiveFailures,
            ..
        })
    ));
}

#[test]
fn context_compression_trigger_detects_long_session() {
    let trigger = context_compression::detect_context_compression_trigger(
        Some("small"),
        &json!({}),
        &[],
        true,
        context_compression::DEFAULT_CONTEXT_COMPRESSION_LONG_SESSION_STEP_THRESHOLD,
    );
    assert!(matches!(
        trigger,
        Some(context_compression::ContextCompressionTrigger {
            source: context_compression::ContextCompressionTriggerSource::SessionLength,
            ..
        })
    ));
}

#[test]
fn parse_security_pattern_rules_env_supports_rule_id_override() {
    let rules = parse_security_pattern_rules_env("danger_custom=shutdown now,rm -rf /tmp", "test");
    assert_eq!(rules.len(), 2);
    assert_eq!(rules[0].id, "danger_custom");
    assert_eq!(rules[0].pattern, "shutdown now");
    assert_eq!(rules[1].id, "test.2");
}

#[test]
fn mark_auto_drive_completed_closes_waypoints_and_sets_stop_state() {
    let mut auto_drive = Some(AgentTaskAutoDriveState {
        enabled: Some(true),
        destination: AgentTaskAutoDriveDestination {
            title: "Ship runtime truth".to_string(),
            desired_end_state: vec!["Runtime snapshot is canonical".to_string()],
            done_definition: Some(AgentTaskAutoDriveDoneDefinition {
                arrival_criteria: Some(vec!["Review pack ready".to_string()]),
                required_validation: None,
                waypoint_indicators: Some(vec!["Collect evidence".to_string()]),
            }),
            hard_boundaries: None,
            route_preference: Some("balanced".to_string()),
        },
        budget: None,
        risk_policy: None,
        context_policy: None,
        decision_policy: None,
        continuation_policy: None,
        continuation_state: None,
        decision_trace: None,
        scenario_profile: None,
        outcome_feedback: None,
        autonomy_state: None,
        navigation: Some(AgentTaskAutoDriveNavigation {
            active_waypoint: Some("Publish review pack".to_string()),
            completed_waypoints: Some(vec!["Collect evidence".to_string()]),
            pending_waypoints: Some(vec!["Publish review pack".to_string()]),
            last_progress_at: Some(5),
            reroute_count: Some(0),
            validation_failure_count: Some(0),
            no_progress_iterations: Some(1),
        }),
        stop: None,
        recovery: None,
    });

    mark_auto_drive_completed(
        &mut auto_drive,
        Some("Runtime reached the destination.".to_string()),
        10,
    );

    let auto_drive = auto_drive.expect("auto drive state");
    let navigation = auto_drive.navigation.expect("navigation");
    assert_eq!(navigation.active_waypoint, None);
    assert_eq!(navigation.pending_waypoints, Some(Vec::new()));
    assert_eq!(
        navigation.completed_waypoints,
        Some(vec![
            "Collect evidence".to_string(),
            "Publish review pack".to_string()
        ])
    );
    assert_eq!(navigation.last_progress_at, Some(10));
    assert_eq!(navigation.no_progress_iterations, Some(0));
    assert_eq!(
        auto_drive.stop.expect("stop").summary,
        Some("Runtime reached the destination.".to_string())
    );
    let feedback = auto_drive.outcome_feedback.expect("outcome feedback");
    assert_eq!(feedback.status.as_deref(), Some("completed"));
    assert_eq!(
        feedback.summary.as_deref(),
        Some("Runtime reached the destination.")
    );
}

#[test]
fn set_auto_drive_recovery_marker_records_checkpoint_recovery_state() {
    let mut auto_drive = Some(AgentTaskAutoDriveState {
        enabled: Some(true),
        destination: AgentTaskAutoDriveDestination {
            title: "Ship runtime truth".to_string(),
            desired_end_state: vec!["Runtime snapshot is canonical".to_string()],
            done_definition: None,
            hard_boundaries: None,
            route_preference: Some("balanced".to_string()),
        },
        budget: None,
        risk_policy: None,
        context_policy: None,
        decision_policy: None,
        continuation_policy: None,
        continuation_state: None,
        decision_trace: None,
        scenario_profile: None,
        outcome_feedback: None,
        autonomy_state: None,
        navigation: Some(AgentTaskAutoDriveNavigation {
            active_waypoint: Some("Resume route".to_string()),
            completed_waypoints: Some(Vec::new()),
            pending_waypoints: Some(vec!["Resume route".to_string()]),
            last_progress_at: Some(4),
            reroute_count: Some(0),
            validation_failure_count: Some(0),
            no_progress_iterations: Some(0),
        }),
        stop: None,
        recovery: None,
    });

    set_auto_drive_recovery_marker(
        &mut auto_drive,
        Some("checkpoint-1".to_string()),
        Some("trace-1".to_string()),
        12,
        Some("Runtime recovered AutoDrive from a checkpoint. Resume to continue.".to_string()),
        true,
    );

    let recovery = auto_drive
        .and_then(|state| state.recovery)
        .expect("recovery marker");
    assert!(recovery.recovered.unwrap_or(false));
    assert!(recovery.resume_ready.unwrap_or(false));
    assert_eq!(recovery.checkpoint_id.as_deref(), Some("checkpoint-1"));
    assert_eq!(recovery.trace_id.as_deref(), Some("trace-1"));
    assert_eq!(recovery.recovered_at, Some(12));
    assert_eq!(
        recovery.summary.as_deref(),
        Some("Runtime recovered AutoDrive from a checkpoint. Resume to continue.")
    );
}

#[test]
fn runtime_autonomy_updates_outcome_feedback_across_progress_and_failure() {
    let mut auto_drive = Some(AgentTaskAutoDriveState {
        enabled: Some(true),
        destination: AgentTaskAutoDriveDestination {
            title: "Ship runtime truth".to_string(),
            desired_end_state: vec!["Runtime snapshot is canonical".to_string()],
            done_definition: None,
            hard_boundaries: None,
            route_preference: Some("balanced".to_string()),
        },
        budget: None,
        risk_policy: None,
        context_policy: None,
        decision_policy: None,
        continuation_policy: None,
        continuation_state: None,
        decision_trace: None,
        scenario_profile: None,
        outcome_feedback: None,
        autonomy_state: None,
        navigation: Some(AgentTaskAutoDriveNavigation {
            active_waypoint: Some("Validate runtime".to_string()),
            completed_waypoints: Some(Vec::new()),
            pending_waypoints: Some(vec!["Validate runtime".to_string()]),
            last_progress_at: None,
            reroute_count: Some(0),
            validation_failure_count: Some(0),
            no_progress_iterations: Some(0),
        }),
        stop: None,
        recovery: None,
    });

    mark_auto_drive_progress(&mut auto_drive, 20);
    let feedback = auto_drive
        .as_ref()
        .and_then(|state| state.outcome_feedback.as_ref())
        .expect("progress feedback");
    assert_eq!(feedback.status.as_deref(), Some("progressing"));
    assert_eq!(feedback.at, Some(20));

    mark_auto_drive_failure(
        &mut auto_drive,
        "validation_failed",
        Some("Representative validation lane failed.".to_string()),
        35,
    );
    let feedback = auto_drive
        .and_then(|state| state.outcome_feedback)
        .expect("failure feedback");
    assert_eq!(feedback.status.as_deref(), Some("validation_failed"));
    assert_eq!(feedback.failure_class.as_deref(), Some("validation_failed"));
    assert!(feedback.human_intervention_required.unwrap_or(false));
    assert_eq!(
        feedback.summary.as_deref(),
        Some("Representative validation lane failed.")
    );
}
