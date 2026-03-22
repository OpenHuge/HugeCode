use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::AgentTaskSummary;

#[allow(dead_code)]
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeExecutionNodeSummary {
    pub id: String,
    pub kind: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub executor_kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub executor_session_id: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub preferred_backend_ids: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resolved_backend_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub placement_lifecycle_state: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub placement_resolution_source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub checkpoint: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub review_actionability: Option<Value>,
}

#[allow(dead_code)]
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeExecutionEdgeSummary {
    pub from_node_id: String,
    pub to_node_id: String,
    pub kind: String,
}

#[allow(dead_code)]
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeExecutionGraphSummary {
    pub graph_id: String,
    pub nodes: Vec<RuntimeExecutionNodeSummary>,
    pub edges: Vec<RuntimeExecutionEdgeSummary>,
}

#[allow(dead_code)]
pub(crate) fn build_runtime_execution_graph_summary(
    summary: &AgentTaskSummary,
) -> RuntimeExecutionGraphSummary {
    build_runtime_execution_graph_summary_with_runtime_truth(summary, None, None, None, None)
}

#[allow(dead_code)]
pub(crate) fn graph_id_for_task(task_id: &str) -> String {
    format!("graph-{task_id}")
}

fn first_step_kind(summary: &AgentTaskSummary) -> String {
    summary
        .steps
        .first()
        .map(|step| step.kind.trim())
        .filter(|kind| !kind.is_empty())
        .unwrap_or("plan")
        .to_string()
}

fn clone_value_if_present(value: Option<&Value>) -> Option<Value> {
    value.filter(|entry| !entry.is_null()).cloned()
}

fn read_string_field(value: Option<&Value>, key: &str) -> Option<String> {
    value
        .and_then(|entry| entry.get(key))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
}

fn read_string_array_field(value: Option<&Value>, key: &str) -> Vec<String> {
    value
        .and_then(|entry| entry.get(key))
        .and_then(Value::as_array)
        .map(|entries| {
            entries
                .iter()
                .filter_map(Value::as_str)
                .map(str::trim)
                .filter(|entry| !entry.is_empty())
                .map(ToOwned::to_owned)
                .collect()
        })
        .unwrap_or_default()
}

fn fallback_placement_lifecycle_state(
    resolved_backend_id: Option<&str>,
    preferred_backend_ids: &[String],
) -> Option<String> {
    match resolved_backend_id {
        None if preferred_backend_ids.is_empty() => Some("unresolved".to_string()),
        None => Some("requested".to_string()),
        Some(resolved_backend_id)
            if !preferred_backend_ids.is_empty()
                && !preferred_backend_ids
                    .iter()
                    .any(|entry| entry.as_str() == resolved_backend_id) =>
        {
            Some("fallback".to_string())
        }
        Some(_) => Some("resolved".to_string()),
    }
}

fn build_root_execution_node(
    summary: &AgentTaskSummary,
    graph_id: &str,
    node_status: Option<&str>,
    placement: Option<&Value>,
    checkpoint: Option<&Value>,
    review_actionability: Option<&Value>,
) -> RuntimeExecutionNodeSummary {
    let preferred_backend_ids = {
        let requested_backend_ids = read_string_array_field(placement, "requestedBackendIds");
        if requested_backend_ids.is_empty() {
            summary.preferred_backend_ids.clone().unwrap_or_default()
        } else {
            requested_backend_ids
        }
    };
    let resolved_backend_id =
        read_string_field(placement, "resolvedBackendId").or_else(|| summary.backend_id.clone());
    let placement_lifecycle_state = read_string_field(placement, "lifecycleState").or_else(|| {
        fallback_placement_lifecycle_state(
            resolved_backend_id.as_deref(),
            preferred_backend_ids.as_slice(),
        )
    });

    RuntimeExecutionNodeSummary {
        id: format!("{graph_id}:root"),
        kind: first_step_kind(summary),
        status: node_status.unwrap_or(summary.status.as_str()).to_string(),
        executor_kind: None,
        executor_session_id: None,
        preferred_backend_ids,
        resolved_backend_id,
        placement_lifecycle_state,
        placement_resolution_source: read_string_field(placement, "resolutionSource"),
        checkpoint: clone_value_if_present(checkpoint),
        review_actionability: clone_value_if_present(review_actionability),
    }
}

#[allow(dead_code)]
pub(crate) fn update_runtime_execution_graph_root(
    graph: &mut RuntimeExecutionGraphSummary,
    summary: &AgentTaskSummary,
    node_status: Option<&str>,
    placement: Option<&Value>,
    checkpoint: Option<&Value>,
    review_actionability: Option<&Value>,
) {
    let graph_id = graph_id_for_task(summary.task_id.as_str());
    graph.graph_id = graph_id.clone();
    let root_node = build_root_execution_node(
        summary,
        graph_id.as_str(),
        node_status,
        placement,
        checkpoint,
        review_actionability,
    );
    if graph.nodes.is_empty() {
        graph.nodes.push(root_node);
    } else {
        graph.nodes[0] = root_node;
    }
}

#[allow(dead_code)]
pub(crate) fn upsert_runtime_execution_graph_node(
    graph: &mut RuntimeExecutionGraphSummary,
    node: RuntimeExecutionNodeSummary,
) {
    if let Some(existing) = graph.nodes.iter_mut().find(|entry| entry.id == node.id) {
        *existing = node;
    } else {
        graph.nodes.push(node);
    }
}

#[allow(dead_code)]
pub(crate) fn upsert_runtime_execution_graph_edge(
    graph: &mut RuntimeExecutionGraphSummary,
    edge: RuntimeExecutionEdgeSummary,
) {
    if let Some(existing) = graph.edges.iter_mut().find(|entry| {
        entry.from_node_id == edge.from_node_id && entry.to_node_id == edge.to_node_id
    }) {
        *existing = edge;
    } else {
        graph.edges.push(edge);
    }
}

#[allow(dead_code)]
pub(crate) fn build_runtime_execution_graph_summary_with_runtime_truth(
    summary: &AgentTaskSummary,
    node_status: Option<&str>,
    placement: Option<&Value>,
    checkpoint: Option<&Value>,
    review_actionability: Option<&Value>,
) -> RuntimeExecutionGraphSummary {
    let graph_id = graph_id_for_task(summary.task_id.as_str());
    RuntimeExecutionGraphSummary {
        nodes: vec![build_root_execution_node(
            summary,
            graph_id.as_str(),
            node_status,
            placement,
            checkpoint,
            review_actionability,
        )],
        graph_id,
        edges: Vec::new(),
    }
}
