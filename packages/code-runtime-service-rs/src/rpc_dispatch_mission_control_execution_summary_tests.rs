use super::*;

#[test]
fn build_review_pack_and_run_projection_publish_lifecycle_and_evidence_summaries() {
    let run = MissionRunProjection {
        id: "run-1".to_string(),
        task_id: "task-1".to_string(),
        workspace_id: "workspace-1".to_string(),
        state: "review_ready".to_string(),
        task_source: None,
        title: Some("Ship runtime authority".to_string()),
        summary: Some("Runtime completed the authority publish sequence.".to_string()),
        started_at: Some(1),
        finished_at: Some(10),
        updated_at: 10,
        current_step_index: Some(2),
        pending_intervention: None,
        auto_drive: None,
        execution_profile: None,
        profile_readiness: None,
        routing: None,
        approval: None,
        review_decision: Some(json!({
            "status": "pending",
            "reviewPackId": "review-pack:run-1",
            "label": "Decision pending",
            "summary": "Accept or reject this result from the review surface.",
            "decidedAt": Value::Null,
        })),
        intervention: None,
        operator_state: None,
        next_action: None,
        warnings: Vec::new(),
        validations: vec![json!({
            "id": "validation-1",
            "label": "pnpm validate",
            "outcome": "passed",
            "summary": "Validation passed.",
        })],
        artifacts: vec![json!({
            "id": "artifact-1",
            "label": "Diff",
            "kind": "diff",
        })],
        changed_paths: vec!["apps/code/src/application/runtime/kernel/runtimeKernelComposition.ts".to_string()],
        completion_reason: Some("completed".to_string()),
        review_pack_id: Some("review-pack:run-1".to_string()),
        lineage: None,
        ledger: None,
        checkpoint: Some(json!({
            "state": "completed",
            "lifecycleState": "completed",
            "checkpointId": "checkpoint-1",
            "traceId": "trace-1",
            "recovered": false,
            "updatedAt": 10,
            "resumeReady": false,
            "summary": "Checkpoint captured after execution.",
        })),
        mission_linkage: None,
        review_actionability: None,
        session_boundary: None,
        continuation: None,
        next_operator_action: Some(json!({
            "action": "review",
            "label": "Review the evidence",
            "detail": "Inspect the Review Pack and decide whether to continue.",
            "source": "review_pack",
        })),
        execution_graph: None,
        takeover_bundle: None,
        governance: None,
        placement: Some(json!({
            "resolvedBackendId": "backend-fallback",
            "requestedBackendIds": ["backend-primary"],
            "resolutionSource": "runtime_fallback",
            "lifecycleState": "fallback",
            "readiness": "attention",
            "healthSummary": "placement_attention",
            "attentionReasons": ["fallback_backend_selected"],
            "summary": "Runtime rerouted onto the fallback backend.",
            "rationale": "Primary backend was unavailable during publish.",
        })),
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
    };

    let review_pack = build_review_pack(&run);
    let run_lifecycle = build_runtime_execution_lifecycle_summary_for_run(&run);
    let run_evidence = build_runtime_execution_evidence_summary_for_run(&run);
    let review_pack_lifecycle =
        build_runtime_execution_lifecycle_summary_for_review_pack(&review_pack, Some(&run));
    let review_pack_evidence = build_runtime_execution_evidence_summary_for_review_pack(&review_pack);

    assert_eq!(
        run_lifecycle.get("stage").and_then(Value::as_str),
        Some("completed")
    );
    assert_eq!(
        run_evidence.get("state").and_then(Value::as_str),
        Some("ready_for_review")
    );
    assert_eq!(
        review_pack_lifecycle
            .get("readyForReview")
            .and_then(Value::as_bool),
        Some(true)
    );
    assert_eq!(
        review_pack_evidence
            .get("changedPathCount")
            .and_then(Value::as_u64),
        Some(1)
    );
}
