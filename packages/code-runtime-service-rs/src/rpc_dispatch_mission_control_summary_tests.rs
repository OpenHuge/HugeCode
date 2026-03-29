use super::*;
use crate::rpc_dispatch::mission_control_dispatch::summary::build_continuity_readiness;

fn mission_control_summary_run(id: &str, task_id: &str, state: &str) -> MissionRunProjection {
    MissionRunProjection {
        id: id.to_string(),
        task_id: task_id.to_string(),
        workspace_id: "workspace-1".to_string(),
        state: state.to_string(),
        task_source: None,
        title: Some("Continuity".to_string()),
        summary: None,
        started_at: Some(1),
        finished_at: None,
        updated_at: 1,
        current_step_index: None,
        pending_intervention: None,
        auto_drive: None,
        execution_profile: None,
        profile_readiness: None,
        routing: None,
        approval: None,
        review_decision: None,
        intervention: None,
        operator_state: None,
        next_action: None,
        warnings: Vec::new(),
        validations: Vec::new(),
        artifacts: Vec::new(),
        changed_paths: Vec::new(),
        completion_reason: None,
        review_pack_id: None,
        lineage: None,
        ledger: None,
        checkpoint: None,
        mission_linkage: None,
        review_actionability: None,
        session_boundary: None,
        continuation: None,
        next_operator_action: None,
        execution_graph: None,
        takeover_bundle: None,
        governance: None,
        placement: None,
        operator_snapshot: None,
        workspace_evidence: None,
        mission_brief: None,
        relaunch_context: None,
        sub_agents: Vec::new(),
        publish_handoff: None,
        selected_opportunity_id: None,
        wake_reason: None,
        wake_state: None,
        source_citations: None,
        queue_position: None,
        next_eligible_action: None,
    }
}

#[test]
fn continuity_readiness_summary_matches_runtime_follow_up_semantics() {
    let blocked = MissionRunProjection {
        review_actionability: Some(json!({
            "state": "blocked",
            "summary": "Review follow-up is blocked.",
            "degradedReasons": [],
            "actions": [],
        })),
        ..mission_control_summary_run("run-blocked", "task-blocked", "review_ready")
    };
    let ready_resume = MissionRunProjection {
        checkpoint: Some(json!({
            "state": "paused",
            "lifecycleState": "paused",
            "checkpointId": "checkpoint-1",
            "traceId": "trace-1",
            "recovered": true,
            "updatedAt": 1,
            "resumeReady": true,
            "recoveredAt": 1,
            "summary": "Resume ready from checkpoint-1."
        })),
        ..mission_control_summary_run("run-resume", "task-resume", "paused")
    };
    let ready_handoff = MissionRunProjection {
        mission_linkage: Some(json!({
            "workspaceId": "workspace-1",
            "taskId": "task-handoff",
            "runId": "run-handoff",
            "missionTaskId": "task-handoff",
            "taskEntityKind": "thread",
            "recoveryPath": "thread",
            "navigationTarget": {
                "kind": "thread",
                "workspaceId": "workspace-1",
                "threadId": "thread-handoff"
            },
            "summary": "Continue from thread-handoff."
        })),
        ..mission_control_summary_run("run-handoff", "task-handoff", "running")
    };

    let summary =
        build_continuity_readiness(true, true, &[blocked, ready_resume, ready_handoff], &[]);

    assert_eq!(summary.tone, "blocked");
    assert_eq!(summary.label, "Continuity readiness");
    assert!(summary.detail.contains("1 run can safely continue"));
    assert!(summary.detail.contains("1 handoff path ready"));
    assert!(summary.detail.contains("1 review follow-up blocked"));
}

#[test]
fn continuity_readiness_summary_flags_review_ready_runs_without_runtime_follow_up_truth() {
    let review_only = MissionRunProjection {
        review_pack_id: Some("review-pack:1".to_string()),
        ..mission_control_summary_run("run-review", "task-review", "review_ready")
    };

    let summary = build_continuity_readiness(true, true, &[review_only], &[]);

    assert_eq!(summary.tone, "attention");
    assert_eq!(summary.detail, "1 run is missing a canonical continue path");
}
