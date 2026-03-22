use super::*;
use crate::runtime_execution_graph::graph_id_for_task;

pub(crate) fn sync_sub_agent_executor_linkage(summary: &mut SubAgentSessionSummary) {
    let thread_id = summary
        .thread_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_owned());
    let trace_id = summary
        .trace_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_owned())
        .or_else(|| Some(sub_agent_trace_id(summary.session_id.as_str())));
    summary.executor_linkage = Some(SubAgentExecutorLinkage {
        executor_kind: "sub_agent".to_string(),
        session_id: summary.session_id.clone(),
        workspace_id: summary.workspace_id.clone(),
        task_id: summary
            .active_task_id
            .clone()
            .or_else(|| summary.last_task_id.clone()),
        active_task_id: summary.active_task_id.clone(),
        last_task_id: summary.last_task_id.clone(),
        thread_id,
        parent_run_id: summary.parent_run_id.clone(),
        trace_id,
        active_task_started_at: summary.active_task_started_at,
        status: summary.status.clone(),
    });
}

pub(crate) fn sync_sub_agent_runtime_execution_graph(runtime: &mut SubAgentSessionRuntime) {
    let Some(parent_run_id) = runtime
        .summary
        .parent_run_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    else {
        runtime.execution_node = None;
        runtime.execution_edge = None;
        return;
    };
    let graph_id = graph_id_for_task(parent_run_id);
    let checkpoint = runtime
        .summary
        .checkpoint_state
        .as_ref()
        .and_then(|state| serde_json::to_value(state).ok());
    let executor_kind = runtime
        .summary
        .executor_linkage
        .as_ref()
        .map(|linkage| linkage.executor_kind.clone())
        .unwrap_or_else(|| "sub_agent".to_string());
    runtime.execution_node = Some(RuntimeExecutionNodeSummary {
        id: format!("{graph_id}:sub-agent:{}", runtime.summary.session_id),
        kind: runtime
            .summary
            .scope_profile
            .clone()
            .unwrap_or_else(|| "sub_agent".to_string()),
        status: runtime.summary.status.clone(),
        executor_kind: Some(executor_kind),
        executor_session_id: Some(runtime.summary.session_id.clone()),
        preferred_backend_ids: Vec::new(),
        resolved_backend_id: None,
        placement_lifecycle_state: None,
        placement_resolution_source: None,
        checkpoint,
        review_actionability: None,
    });
    runtime.execution_edge = Some(RuntimeExecutionEdgeSummary {
        from_node_id: format!("{graph_id}:root"),
        to_node_id: format!("{graph_id}:sub-agent:{}", runtime.summary.session_id),
        kind: "delegates_to".to_string(),
    });
}
