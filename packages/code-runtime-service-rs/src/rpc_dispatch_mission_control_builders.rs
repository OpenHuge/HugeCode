use super::*;
use crate::runtime_checkpoint::build_agent_task_checkpoint_state_payload;
use crate::runtime_execution_graph::{
    upsert_runtime_execution_graph_edge, upsert_runtime_execution_graph_node,
};
use crate::{
    RuntimeExecutionEdgeSummary, RuntimeExecutionGraphSummary, RuntimeExecutionNodeSummary,
    build_runtime_execution_graph_summary_with_runtime_truth,
};

fn summarize_run(summary: &AgentTaskSummary) -> Option<String> {
    summary
        .steps
        .iter()
        .find_map(|step| trim_to_option(Some(step.message.as_str())))
}

fn build_runtime_source_citations(
    summary: &AgentTaskSummary,
    workspace_roots_by_id: &HashMap<String, String>,
) -> Vec<Value> {
    let mut citations = Vec::new();
    if workspace_roots_by_id.contains_key(summary.workspace_id.as_str()) {
        citations.push(json!({
            "id": "repo-agents-md",
            "label": "AGENTS.md",
            "url": Value::Null,
            "sourceKind": "repo_doc",
            "trustLevel": "primary",
            "claimSummary": "Runtime should keep unattended work aligned with repo-owned instructions.",
        }));
    }
    if let Some(task_source) = summary.task_source.as_ref() {
        citations.push(json!({
            "id": "task-source",
            "label": task_source
                .label
                .clone()
                .or(task_source.title.clone())
                .unwrap_or_else(|| "Task source".to_string()),
            "url": task_source.url.clone(),
            "sourceKind": "task_source",
            "trustLevel": if task_source.url.is_some() { "primary" } else { "runtime" },
            "claimSummary": task_source
                .reference
                .clone()
                .or(task_source.title.clone())
                .unwrap_or_else(|| "Task source provided the current mission framing.".to_string()),
        }));
    }
    citations
}

fn derive_selected_opportunity_id(summary: &AgentTaskSummary) -> Option<String> {
    summary
        .auto_drive
        .as_ref()
        .and_then(|auto_drive| auto_drive.decision_trace.as_ref())
        .and_then(|trace| trim_to_option(trace.selected_candidate_id.as_deref()))
        .or_else(|| {
            summary
                .auto_drive
                .as_ref()
                .map(|_| "opportunity-primary".to_string())
        })
}

fn derive_wake_reason(runtime: &AgentTaskRuntime, run_state: &str) -> Option<String> {
    if let Some(reason) = runtime
        .summary
        .auto_drive
        .as_ref()
        .and_then(|auto_drive| auto_drive.stop.as_ref())
        .and_then(|stop| trim_to_option(Some(stop.reason.as_str())))
    {
        return Some(reason);
    }
    if runtime.summary.pending_approval.is_some() {
        return Some("approval_required".to_string());
    }
    match run_state {
        "needs_input" => Some("operator_input_required".to_string()),
        "failed" => Some("validation_or_execution_failure".to_string()),
        "review_ready" => Some("review_pack_ready".to_string()),
        "paused" => Some("paused_for_runtime_gate".to_string()),
        _ => None,
    }
}

fn derive_wake_state(run_state: &str, wake_reason: Option<&str>) -> Option<String> {
    Some(match run_state {
        "review_ready" => "ready".to_string(),
        "failed" => "blocked".to_string(),
        "needs_input" | "paused" => "attention".to_string(),
        _ if wake_reason.is_some() => "attention".to_string(),
        _ => return None,
    })
}

fn derive_next_eligible_action(run_state: &str, wake_reason: Option<&str>) -> Option<String> {
    Some(match run_state {
        "review_ready" => "approve".to_string(),
        "failed" => "reroute".to_string(),
        "needs_input" => "clarify".to_string(),
        "paused" => "continue".to_string(),
        _ if wake_reason == Some("approval_required") => "pair".to_string(),
        _ => return None,
    })
}

fn derive_queue_position(run_state: &str) -> Option<u32> {
    match run_state {
        "review_ready" | "needs_input" | "paused" | "failed" => Some(1),
        _ => None,
    }
}

fn build_sub_agent_execution_node(
    graph_id: &str,
    sub_agent: &MissionRunSubAgentSummary,
) -> RuntimeExecutionNodeSummary {
    let executor_linkage = sub_agent.executor_linkage.as_ref();
    let session_id = executor_linkage
        .and_then(|entry| entry.get("sessionId"))
        .and_then(Value::as_str)
        .unwrap_or(sub_agent.session_id.as_str())
        .to_string();
    let executor_kind = executor_linkage
        .and_then(|entry| entry.get("executorKind"))
        .and_then(Value::as_str)
        .unwrap_or("sub_agent")
        .to_string();
    let checkpoint = sub_agent
        .checkpoint_state
        .as_ref()
        .and_then(|entry| serde_json::to_value(entry).ok());
    RuntimeExecutionNodeSummary {
        id: format!("{graph_id}:sub-agent:{session_id}"),
        kind: sub_agent
            .scope_profile
            .clone()
            .unwrap_or_else(|| "sub_agent".to_string()),
        status: sub_agent.status.clone(),
        executor_kind: Some(executor_kind),
        executor_session_id: Some(session_id),
        preferred_backend_ids: Vec::new(),
        resolved_backend_id: None,
        placement_lifecycle_state: None,
        placement_resolution_source: None,
        checkpoint,
        review_actionability: None,
    }
}

fn append_sub_agent_execution_graph(
    graph: &mut RuntimeExecutionGraphSummary,
    sub_agents: &[MissionRunSubAgentSummary],
) {
    let Some(root_node_id) = graph.nodes.first().map(|node| node.id.clone()) else {
        return;
    };
    for sub_agent in sub_agents {
        let node = sub_agent
            .execution_node
            .as_ref()
            .and_then(|value| serde_json::from_value::<RuntimeExecutionNodeSummary>(value.clone()).ok())
            .unwrap_or_else(|| build_sub_agent_execution_node(graph.graph_id.as_str(), sub_agent));
        let edge = sub_agent
            .execution_edge
            .as_ref()
            .and_then(|value| serde_json::from_value::<RuntimeExecutionEdgeSummary>(value.clone()).ok())
            .unwrap_or(RuntimeExecutionEdgeSummary {
                from_node_id: root_node_id.clone(),
                to_node_id: node.id.clone(),
                kind: "delegates_to".to_string(),
            });
        upsert_runtime_execution_graph_edge(graph, edge);
        upsert_runtime_execution_graph_node(graph, node);
    }
}

fn normalize_task_source_value(source: &AgentTaskSourceSummary) -> Value {
    let kind = match source.kind.trim().to_ascii_lowercase().as_str() {
        "autodrive" => "autodrive",
        "manual" => "manual",
        "manual_thread" => "manual_thread",
        "github_issue" => "github_issue",
        "github_pr_followup" => "github_pr_followup",
        "schedule" => "schedule",
        "external_runtime" => "external_runtime",
        _ => "external_runtime",
    };
    json!({
        "kind": kind,
        "label": trim_to_option(source.label.as_deref()),
        "shortLabel": trim_to_option(source.short_label.as_deref()),
        "title": trim_to_option(source.title.as_deref()),
        "reference": trim_to_option(source.reference.as_deref()),
        "url": trim_to_option(source.url.as_deref())
            .or_else(|| trim_to_option(source.canonical_url.as_deref())),
        "issueNumber": source.issue_number,
        "pullRequestNumber": source.pull_request_number,
        "repo": source.repo.as_ref().map(|repo| json!({
            "owner": trim_to_option(repo.owner.as_deref()),
            "name": trim_to_option(repo.name.as_deref()),
            "fullName": trim_to_option(repo.full_name.as_deref()),
            "remoteUrl": trim_to_option(repo.remote_url.as_deref()),
        })).unwrap_or(Value::Null),
        "workspaceId": trim_to_option(source.workspace_id.as_deref()),
        "workspaceRoot": trim_to_option(source.workspace_root.as_deref()),
        "externalId": trim_to_option(source.external_id.as_deref()),
        "canonicalUrl": trim_to_option(source.canonical_url.as_deref()),
        "threadId": trim_to_option(source.thread_id.as_deref()),
        "requestId": trim_to_option(source.request_id.as_deref()),
        "sourceTaskId": trim_to_option(source.source_task_id.as_deref()),
        "sourceRunId": trim_to_option(source.source_run_id.as_deref()),
    })
}

fn derive_runtime_task_source_value(summary: &AgentTaskSummary, title: Option<&str>) -> Option<Value> {
    if let Some(source) = summary.task_source.as_ref() {
        let mut value = normalize_task_source_value(source);
        if value.get("title").and_then(Value::as_str).is_none() {
            value["title"] = trim_to_option(title).map(Value::String).unwrap_or(Value::Null);
        }
        if value.get("threadId").and_then(Value::as_str).is_none() {
            value["threadId"] = trim_to_option(summary.thread_id.as_deref())
                .map(Value::String)
                .unwrap_or(Value::Null);
        }
        if value.get("requestId").and_then(Value::as_str).is_none() {
            value["requestId"] = trim_to_option(summary.request_id.as_deref())
                .map(Value::String)
                .unwrap_or(Value::Null);
        }
        if value.get("sourceRunId").and_then(Value::as_str).is_none() {
            value["sourceRunId"] = Value::String(summary.task_id.clone());
        }
        return Some(value);
    }

    if let Some(thread_id) = trim_to_option(summary.thread_id.as_deref()) {
        return Some(json!({
            "kind": "manual_thread",
            "label": "Manual thread",
            "shortLabel": "Manual",
            "title": trim_to_option(title),
            "reference": Value::Null,
            "url": Value::Null,
            "issueNumber": Value::Null,
            "pullRequestNumber": Value::Null,
            "repo": Value::Null,
            "workspaceId": trim_to_option(Some(summary.workspace_id.as_str())),
            "workspaceRoot": Value::Null,
            "externalId": Value::Null,
            "canonicalUrl": Value::Null,
            "threadId": thread_id,
            "requestId": trim_to_option(summary.request_id.as_deref()),
            "sourceTaskId": Value::Null,
            "sourceRunId": summary.task_id,
        }));
    }

    if trim_to_option(title).is_some() || trim_to_option(summary.request_id.as_deref()).is_some() {
        return Some(json!({
            "kind": "external_runtime",
            "label": "External runtime",
            "shortLabel": "External",
            "title": trim_to_option(title),
            "reference": Value::Null,
            "url": Value::Null,
            "issueNumber": Value::Null,
            "pullRequestNumber": Value::Null,
            "repo": Value::Null,
            "workspaceId": trim_to_option(Some(summary.workspace_id.as_str())),
            "workspaceRoot": Value::Null,
            "externalId": Value::Null,
            "canonicalUrl": Value::Null,
            "threadId": Value::Null,
            "requestId": trim_to_option(summary.request_id.as_deref()),
            "sourceTaskId": summary.task_id,
            "sourceRunId": summary.task_id,
        }));
    }

    None
}

fn build_thread_task_source_value(thread: &ThreadSummary, title: &str) -> Value {
    json!({
        "kind": "manual_thread",
        "label": "Manual thread",
        "shortLabel": "Manual",
        "title": title,
        "reference": Value::Null,
        "url": Value::Null,
        "issueNumber": Value::Null,
        "pullRequestNumber": Value::Null,
        "repo": Value::Null,
        "workspaceId": thread.workspace_id,
        "workspaceRoot": Value::Null,
        "externalId": Value::Null,
        "canonicalUrl": Value::Null,
        "threadId": thread.id,
        "requestId": Value::Null,
        "sourceTaskId": Value::Null,
        "sourceRunId": Value::Null,
    })
}

pub(crate) fn project_runtime_task_to_run(
    runtime: &AgentTaskRuntime,
    backend_summaries: &HashMap<String, RuntimeBackendSummary>,
    sub_agents_by_run: &HashMap<String, Vec<MissionRunSubAgentSummary>>,
    workspace_roots_by_id: &HashMap<String, String>,
) -> MissionRunProjection {
    let summary = &runtime.summary;
    let run_state = project_run_state(
        summary.status.as_str(),
        summary.distributed_status.as_deref(),
    );
    let execution_profile = build_execution_profile(runtime);
    let backend = summary
        .backend_id
        .as_deref()
        .and_then(|backend_id| backend_summaries.get(backend_id));
    let routing = build_routing(runtime, backend);
    let approval = build_approval(runtime);
    let review_decision = build_review_decision(runtime, run_state.as_str());
    let intervention = build_intervention(runtime);
    let operator_state = build_operator_state(runtime, &approval, &routing);
    let next_action = build_next_action(runtime, &approval);
    let validations = derive_run_validations(summary);
    let artifacts = derive_run_artifacts(runtime);
    let warnings = derive_run_warnings(runtime);
    let completion_reason = derive_completion_reason(runtime, run_state.as_str());
    let changed_paths = derive_run_changed_paths(summary);
    let auto_drive_value = runtime
        .summary
        .auto_drive
        .as_ref()
        .and_then(|entry| serde_json::to_value(entry).ok());
    let mission_brief_value = runtime
        .summary
        .mission_brief
        .as_ref()
        .and_then(|entry| serde_json::to_value(entry).ok());
    let relaunch_context_value = runtime
        .summary
        .relaunch_context
        .as_ref()
        .and_then(|entry| serde_json::to_value(entry).ok());
    let publish_handoff = build_publish_handoff_reference(
        summary.task_id.as_str(),
        summary.auto_drive.as_ref(),
        workspace_roots_by_id
            .get(summary.workspace_id.as_str())
            .map(String::as_str),
    );
    let task_source_value = summary
        .task_source
        .as_ref()
        .and_then(|entry| serde_json::to_value(entry).ok());
    let sub_agents = sub_agents_by_run
        .get(summary.task_id.as_str())
        .cloned()
        .unwrap_or_default();
    let execution_profile_id = execution_profile
        .get("id")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    let task_mode = execution_profile
        .get("autonomy")
        .and_then(Value::as_str)
        .and_then(|autonomy| match autonomy {
            "operator_review" => Some("ask"),
            "bounded_delegate" => Some("pair"),
            "autonomous_delegate" => Some("delegate"),
            _ => None,
        });
    let lineage_title = trim_to_option(summary.title.as_deref()).or_else(|| summarize_run(summary));
    let task_source = derive_runtime_task_source_value(summary, lineage_title.as_deref());
    let lineage = build_mission_lineage(
        lineage_title,
        task_source.as_ref(),
        summary.thread_id.as_deref(),
        summary.request_id.as_deref(),
        execution_profile_id.as_deref(),
        task_mode,
        summary.root_task_id.as_deref(),
        summary.parent_task_id.as_deref(),
        summary.child_task_ids.as_deref().unwrap_or(&[]),
        auto_drive_value.as_ref(),
        review_decision.as_ref(),
    );
    let ledger = build_run_ledger(
        runtime,
        warnings.as_slice(),
        validations.as_slice(),
        artifacts.as_slice(),
        &routing,
        completion_reason.as_deref(),
    );
    let checkpoint = Some(build_agent_task_checkpoint_state_payload(
        summary,
        runtime.recovered,
        runtime.checkpoint_id.as_deref(),
    ));
    let mission_task_id =
        resolve_mission_task_id(summary.thread_id.as_deref(), summary.task_id.as_str());
    let governance = build_governance_summary(
        run_state.as_str(),
        &approval,
        review_decision.as_ref(),
        &intervention,
        &next_action,
        completion_reason.as_deref(),
        sub_agents.as_slice(),
    );
    let placement =
        build_placement_evidence(summary, &routing, &execution_profile, backend_summaries);
    let checkpoint_id = checkpoint
        .as_ref()
        .and_then(|entry| entry.get("checkpointId"))
        .and_then(Value::as_str);
    let trace_id = checkpoint
        .as_ref()
        .and_then(|entry| entry.get("traceId"))
        .and_then(Value::as_str);
    let review_pack_id = if is_terminal_run_state(run_state.as_str()) {
        Some(format!("review-pack:{}", summary.task_id))
    } else {
        None
    };
    let mission_linkage = Some(build_runtime_mission_linkage_summary(
        summary.workspace_id.as_str(),
        summary.task_id.as_str(),
        mission_task_id.as_str(),
        summary.thread_id.as_deref(),
        summary.request_id.as_deref(),
        review_pack_id.as_deref(),
        checkpoint_id,
        trace_id,
    ));
    let evidence_state = derive_review_evidence_state(
        validations.as_slice(),
        warnings.as_slice(),
        artifacts.as_slice(),
    );
    let review_actionability = Some(runtime.review_actionability.clone().unwrap_or_else(|| {
        build_runtime_review_actionability_summary(
            run_state.as_str(),
            review_decision.as_ref(),
            &intervention,
            &next_action,
            evidence_state,
            derive_review_validation_outcome(validations.as_slice()).as_str(),
            placement.as_ref(),
            mission_linkage
                .as_ref()
                .expect("mission linkage should exist"),
        )
    }));
    let takeover_bundle = Some(runtime.takeover_bundle.clone().unwrap_or_else(|| {
        build_runtime_takeover_bundle(
            run_state.as_str(),
            &approval,
            &next_action,
            checkpoint
                .as_ref()
                .expect("checkpoint summary should exist for runtime run projections"),
            mission_linkage.as_ref(),
            review_pack_id.as_deref(),
            publish_handoff.as_ref(),
            review_actionability.as_ref(),
        )
    }));
    let session_boundary = Some(build_runtime_session_boundary(
        summary.workspace_id.as_str(),
        summary.task_id.as_str(),
        mission_task_id.as_str(),
        mission_linkage.as_ref(),
        review_pack_id.as_deref(),
        checkpoint.as_ref(),
    ));
    let continuation = Some(build_runtime_continuation_summary(
        session_boundary
            .as_ref()
            .expect("session boundary should exist for runtime run projections"),
        checkpoint.as_ref(),
        mission_linkage.as_ref(),
        publish_handoff.as_ref(),
        review_actionability.as_ref(),
        takeover_bundle.as_ref(),
        review_pack_id.as_deref(),
    ));
    let next_operator_action = Some(build_runtime_next_operator_action(
        run_state.as_str(),
        &approval,
        if is_terminal_run_state(run_state.as_str()) {
            Some(if matches!(run_state.as_str(), "failed" | "cancelled")
                || derive_review_validation_outcome(validations.as_slice()).as_str() == "failed"
            {
                "action_required"
            } else if derive_review_evidence_state(
                validations.as_slice(),
                warnings.as_slice(),
                artifacts.as_slice(),
            ) == "incomplete"
            {
                "incomplete_evidence"
            } else {
                "ready"
            })
        } else {
            None
        },
        review_decision.as_ref(),
        &next_action,
        continuation
            .as_ref()
            .expect("continuation should exist for runtime run projections"),
        session_boundary
            .as_ref()
            .expect("session boundary should exist for runtime run projections"),
    ));
    let mut execution_graph = runtime.execution_graph.clone().unwrap_or_else(|| {
        build_runtime_execution_graph_summary_with_runtime_truth(
            summary,
            Some(run_state.as_str()),
            placement.as_ref(),
            checkpoint.as_ref(),
            review_actionability.as_ref(),
        )
    });
    append_sub_agent_execution_graph(&mut execution_graph, sub_agents.as_slice());
    let operator_snapshot = Some(build_run_operator_snapshot(
        runtime,
        run_state.as_str(),
        &execution_profile,
        &routing,
        workspace_roots_by_id
            .get(summary.workspace_id.as_str())
            .map(String::as_str),
    ));
    let workspace_evidence = Some(build_workspace_evidence(
        changed_paths.as_slice(),
        artifacts.as_slice(),
        validations.as_slice(),
        mission_brief_value.as_ref(),
        publish_handoff.as_ref(),
        relaunch_context_value.as_ref(),
    ));
    let selected_opportunity_id = derive_selected_opportunity_id(summary);
    let wake_reason = derive_wake_reason(runtime, run_state.as_str());
    let wake_state = derive_wake_state(run_state.as_str(), wake_reason.as_deref());
    let next_eligible_action =
        derive_next_eligible_action(run_state.as_str(), wake_reason.as_deref());
    let source_citations = build_runtime_source_citations(summary, workspace_roots_by_id);
    MissionRunProjection {
        id: summary.task_id.clone(),
        task_id: mission_task_id,
        workspace_id: summary.workspace_id.clone(),
        state: run_state.clone(),
        task_source: task_source.clone().or(task_source_value),
        title: trim_to_option(summary.title.as_deref()),
        summary: summarize_run(summary),
        started_at: summary.started_at,
        finished_at: summary.completed_at,
        updated_at: summary.updated_at,
        current_step_index: summary.current_step,
        pending_intervention: intervention
            .get("primaryAction")
            .and_then(Value::as_str)
            .map(ToOwned::to_owned),
        auto_drive: build_auto_drive(runtime),
        execution_profile: Some(execution_profile),
        profile_readiness: Some(build_profile_readiness(&routing)),
        routing: Some(routing),
        approval: Some(approval),
        review_decision,
        intervention: Some(intervention),
        operator_state: Some(operator_state),
        next_action: Some(next_action),
        warnings,
        validations,
        artifacts,
        changed_paths,
        completion_reason,
        review_pack_id: if is_terminal_run_state(run_state.as_str()) {
            Some(format!("review-pack:{}", summary.task_id))
        } else {
            None
        },
        lineage: Some(lineage),
        ledger: Some(ledger),
        checkpoint,
        mission_linkage,
        review_actionability,
        session_boundary,
        continuation,
        next_operator_action,
        execution_graph: serde_json::to_value(execution_graph).ok(),
        takeover_bundle,
        governance: Some(governance),
        placement,
        operator_snapshot,
        workspace_evidence,
        mission_brief: mission_brief_value,
        relaunch_context: relaunch_context_value,
        sub_agents,
        publish_handoff,
        selected_opportunity_id,
        wake_reason,
        wake_state,
        source_citations: if source_citations.is_empty() {
            None
        } else {
            Some(source_citations)
        },
        queue_position: derive_queue_position(run_state.as_str()),
        next_eligible_action,
    }
}

pub(super) fn project_thread_to_task(
    thread: &ThreadSummary,
    latest_run: Option<&MissionRunProjection>,
) -> MissionTaskProjection {
    let title =
        trim_to_option(Some(thread.title.as_str())).unwrap_or_else(|| "Untitled task".to_string());
    let (mode, mode_source) = if let Some(run) = latest_run {
        let autonomy = run
            .execution_profile
            .as_ref()
            .and_then(|profile| profile.get("autonomy"))
            .and_then(Value::as_str);
        match autonomy {
            Some("operator_review") => (Some("ask".to_string()), "execution_profile".to_string()),
            Some("bounded_delegate") => (Some("pair".to_string()), "execution_profile".to_string()),
            Some("autonomous_delegate") => (
                Some("delegate".to_string()),
                "execution_profile".to_string(),
            ),
            _ => (None, "missing".to_string()),
        }
    } else {
        (None, "missing".to_string())
    };
    let run_state = latest_run.map(|run| run.state.as_str());
    let review_decision = latest_run.and_then(|run| run.review_decision.as_ref());
    let task_source = Some(build_thread_task_source_value(thread, title.as_str()));
    MissionTaskProjection {
        id: thread.id.clone(),
        workspace_id: thread.workspace_id.clone(),
        title: title.clone(),
        objective: Some(title.clone()),
        origin: json!({
            "kind": "thread",
            "threadId": thread.id,
            "runId": latest_run.as_ref().map(|run| run.id.as_str()),
            "requestId": Value::Null,
        }),
        task_source: task_source.clone(),
        mode: mode.clone(),
        mode_source,
        status: project_task_status(run_state, thread.archived, thread.running),
        created_at: Some(thread.created_at),
        updated_at: latest_run
            .map(|run| run.updated_at.max(thread.updated_at))
            .unwrap_or(thread.updated_at),
        current_run_id: latest_run.and_then(|run| {
            if is_terminal_run_state(run.state.as_str()) {
                None
            } else {
                Some(run.id.clone())
            }
        }),
        latest_run_id: latest_run.map(|run| run.id.clone()),
        latest_run_state: latest_run.map(|run| run.state.clone()).or_else(|| {
            if thread.running {
                Some("running".to_string())
            } else {
                None
            }
        }),
        next_action: latest_run.and_then(|run| run.next_action.clone()),
        lineage: Some(build_mission_lineage(
            Some(title),
            task_source.as_ref(),
            Some(thread.id.as_str()),
            None,
            latest_run
                .and_then(|run| run.execution_profile.as_ref())
                .and_then(|profile| profile.get("id"))
                .and_then(Value::as_str),
            mode.as_deref(),
            None,
            None,
            &[],
            latest_run.and_then(|run| run.auto_drive.as_ref()),
            review_decision,
        )),
        accountability: build_task_accountability(latest_run, Some(thread.created_at)),
        execution_graph: latest_run.and_then(|run| run.execution_graph.clone()),
    }
}

pub(super) fn build_orphan_task(
    run: &MissionRunProjection,
    runtime: &AgentTaskRuntime,
) -> MissionTaskProjection {
    let summary = &runtime.summary;
    let title = run
        .title
        .clone()
        .or_else(|| run.summary.clone())
        .or_else(|| trim_to_option(summary.title.as_deref()))
        .unwrap_or_else(|| "Untitled task".to_string());
    let (mode, mode_source, _) =
        map_access_mode_to_task_mode(summary.access_mode.as_str(), summary.agent_profile.as_str());
    let execution_profile_id = run
        .execution_profile
        .as_ref()
        .and_then(|profile| profile.get("id"))
        .and_then(Value::as_str);
    let task_source = run
        .task_source
        .clone()
        .or_else(|| derive_runtime_task_source_value(summary, Some(title.as_str())));
    MissionTaskProjection {
        id: run.task_id.clone(),
        workspace_id: run.workspace_id.clone(),
        title: title.clone(),
        objective: Some(title.clone()),
        origin: json!({
            "kind": "run",
            "threadId": summary.thread_id,
            "runId": run.id,
            "requestId": summary.request_id,
        }),
        task_source: task_source.clone(),
        mode: mode.clone(),
        mode_source,
        status: project_task_status(Some(run.state.as_str()), false, false),
        created_at: Some(summary.created_at),
        updated_at: run.updated_at,
        current_run_id: if is_terminal_run_state(run.state.as_str()) {
            None
        } else {
            Some(run.id.clone())
        },
        latest_run_id: Some(run.id.clone()),
        latest_run_state: Some(run.state.clone()),
        next_action: run.next_action.clone(),
        lineage: Some(build_mission_lineage(
            Some(title),
            task_source.as_ref(),
            summary.thread_id.as_deref(),
            summary.request_id.as_deref(),
            execution_profile_id,
            mode.as_deref(),
            summary.root_task_id.as_deref(),
            summary.parent_task_id.as_deref(),
            summary.child_task_ids.as_deref().unwrap_or(&[]),
            run.auto_drive.as_ref(),
            run.review_decision.as_ref(),
        )),
        accountability: build_task_accountability(Some(run), Some(summary.created_at)),
        execution_graph: run.execution_graph.clone(),
    }
}

pub(crate) fn build_review_pack(run: &MissionRunProjection) -> MissionReviewPackProjection {
    let validation_outcome = derive_review_validation_outcome(run.validations.as_slice());
    let review_decision_status = run
        .review_decision
        .as_ref()
        .and_then(|decision| decision.get("status"))
        .and_then(Value::as_str);
    let review_status = if matches!(run.state.as_str(), "failed" | "cancelled")
        || validation_outcome == "failed"
        || review_decision_status == Some("rejected")
    {
        "action_required".to_string()
    } else if validation_outcome == "unknown" && run.warnings.is_empty() && run.artifacts.is_empty()
    {
        "incomplete_evidence".to_string()
    } else {
        "ready".to_string()
    };
    let summary = run
        .summary
        .clone()
        .or_else(|| run.title.clone())
        .or_else(|| run.completion_reason.clone())
        .unwrap_or_else(|| {
            if run.state == "failed" {
                "Run failed without a recorded summary.".to_string()
            } else {
                "Review-ready result".to_string()
            }
        });
    let checks_performed = run
        .validations
        .iter()
        .filter_map(|validation| validation.get("label").and_then(Value::as_str))
        .map(ToOwned::to_owned)
        .collect::<Vec<_>>();
    let recommended_next_action = run
        .next_operator_action
        .as_ref()
        .and_then(|action| action.get("detail").and_then(Value::as_str))
        .map(ToOwned::to_owned)
        .or_else(|| {
            run.next_operator_action
                .as_ref()
                .and_then(|action| action.get("label").and_then(Value::as_str))
                .map(ToOwned::to_owned)
        })
        .or_else(|| {
            run.continuation
                .as_ref()
                .and_then(|continuation| continuation.get("recommendedAction"))
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
        })
        .or_else(|| {
            run.continuation
                .as_ref()
                .and_then(|continuation| continuation.get("detail"))
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
        })
        .or_else(|| {
            run.continuation
                .as_ref()
                .and_then(|continuation| continuation.get("summary"))
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
        })
        .or_else(|| {
            run.review_decision
                .as_ref()
                .and_then(|decision| decision.get("status"))
                .and_then(Value::as_str)
                .and_then(|status| match status {
                    "accepted" => Some(
                        "Accepted in review. No further action is required unless follow-up work is needed."
                            .to_string(),
                    ),
                    "rejected" => Some(
                        "Rejected in review. Open the mission thread to retry or reroute with operator feedback."
                            .to_string(),
                    ),
                    _ => None,
                })
        })
        .or_else(|| {
            run.next_action
                .as_ref()
                .and_then(|next_action| next_action.get("label"))
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
        })
        .or_else(|| match review_status.as_str() {
            "ready" => Some("Review the evidence and accept or retry.".to_string()),
            "action_required" => Some("Inspect warnings or failures before retrying.".to_string()),
            _ => Some("Review the available evidence before accepting this run.".to_string()),
        });
    let evidence_state =
        if run.validations.is_empty() && run.warnings.is_empty() && run.artifacts.is_empty() {
            "incomplete".to_string()
        } else {
            "confirmed".to_string()
        };
    let ledger = run.ledger.as_ref().map(|entry| {
        let mut entry = entry.clone();
        if let Some(object) = entry.as_object_mut() {
            object.insert(
                "warningCount".to_string(),
                Value::Number(serde_json::Number::from(run.warnings.len())),
            );
            object.insert(
                "validationCount".to_string(),
                Value::Number(serde_json::Number::from(run.validations.len())),
            );
            object.insert(
                "artifactCount".to_string(),
                Value::Number(serde_json::Number::from(run.artifacts.len())),
            );
            object.insert(
                "evidenceState".to_string(),
                Value::String(evidence_state.clone()),
            );
        }
        entry
    });
    let file_changes = build_review_pack_file_changes(run.changed_paths.as_slice());
    let evidence_refs = build_review_pack_evidence_refs(run);
    let assumptions = build_review_pack_assumptions(run, review_status.as_str());
    let reproduction_guidance = build_review_pack_reproduction_guidance(run);
    let rollback_guidance = build_review_pack_rollback_guidance(run, run.task_id.as_str());
    let backend_audit = build_review_pack_backend_audit(run);
    let failure_class = run
        .relaunch_context
        .as_ref()
        .and_then(|context| context.get("failureClass"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    let relaunch_options = build_review_pack_relaunch_options(run);
    let sub_agent_summary = if run.sub_agents.is_empty() {
        None
    } else {
        Some(run.sub_agents.clone())
    };
    let publish_handoff = run.publish_handoff.clone();
    let takeover_bundle = run.takeover_bundle.clone();
    MissionReviewPackProjection {
        id: run
            .review_pack_id
            .clone()
            .unwrap_or_else(|| format!("review-pack:{}", run.id)),
        run_id: run.id.clone(),
        task_id: run.task_id.clone(),
        workspace_id: run.workspace_id.clone(),
        task_source: run.task_source.clone(),
        summary,
        review_status,
        evidence_state: evidence_state.clone(),
        validation_outcome,
        warning_count: run.warnings.len(),
        warnings: run.warnings.clone(),
        validations: run.validations.clone(),
        artifacts: run.artifacts.clone(),
        checks_performed,
        recommended_next_action,
        file_changes: Some(file_changes),
        evidence_refs: Some(evidence_refs),
        assumptions: if assumptions.is_empty() {
            None
        } else {
            Some(assumptions)
        },
        reproduction_guidance: if reproduction_guidance.is_empty() {
            None
        } else {
            Some(reproduction_guidance)
        },
        rollback_guidance: if rollback_guidance.is_empty() {
            None
        } else {
            Some(rollback_guidance)
        },
        backend_audit: Some(backend_audit),
        review_decision: run.review_decision.clone(),
        created_at: run.finished_at.unwrap_or(run.updated_at),
        lineage: run.lineage.clone(),
        ledger,
        checkpoint: run.checkpoint.clone(),
        mission_linkage: run.mission_linkage.clone(),
        actionability: run.review_actionability.clone(),
        session_boundary: run.session_boundary.clone(),
        continuation: run.continuation.clone(),
        next_operator_action: run.next_operator_action.clone(),
        takeover_bundle,
        governance: run.governance.clone(),
        placement: run.placement.clone(),
        workspace_evidence: run.workspace_evidence.clone(),
        failure_class,
        relaunch_options,
        sub_agent_summary,
        publish_handoff,
        selected_opportunity_id: run.selected_opportunity_id.clone(),
        wake_reason: run.wake_reason.clone(),
        wake_state: run.wake_state.clone(),
        source_citations: run.source_citations.clone(),
        queue_position: run.queue_position,
        next_eligible_action: run.next_eligible_action.clone(),
    }
}
