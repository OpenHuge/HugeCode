use super::*;
use crate::agent_task_launch_synthesis::WorkspaceLaunchContext;

fn build_clarifying_questions(missing_context: &[String]) -> Vec<String> {
    missing_context
        .iter()
        .filter_map(|item| match item.as_str() {
            "objective" => Some(
                "Clarify the concrete end state so the runtime can lock the mission scope."
                    .to_string(),
            ),
            "execution_profile" => Some(
                "Choose an execution profile before launch so the runtime can enforce the correct supervision posture."
                    .to_string(),
            ),
            "validation_preset" => Some(
                "Pick a validation preset so milestone validation can stay explicit."
                    .to_string(),
            ),
            _ => None,
        })
        .collect()
}

pub(super) fn build_validation_lanes(workspace_context: &WorkspaceLaunchContext) -> Vec<Value> {
    let mut lanes = Vec::new();
    if let Some(command) = workspace_context.validate_fast_command.as_ref() {
        lanes.push(json!({
            "id": "lane-fast",
            "label": "Fast lane",
            "summary": "Run the narrowest fast validation lane while features are still changing.",
            "trigger": "per_feature",
            "commands": [command],
        }));
    }
    if let Some(command) = workspace_context.component_test_command.as_ref() {
        lanes.push(json!({
            "id": "lane-component",
            "label": "Component lane",
            "summary": "Run browser-backed component checks at milestone boundaries.",
            "trigger": "per_milestone",
            "commands": [command],
        }));
    }
    if lanes.is_empty() {
        if let Some(command) = workspace_context.validate_command.as_ref() {
            lanes.push(json!({
                "id": "lane-review",
                "label": "Review lane",
                "summary": "Run the primary repository validation lane before review.",
                "trigger": "pre_review",
                "commands": [command],
            }));
        }
    } else if let Some(command) = workspace_context.validate_command.as_ref() {
        if !lanes.iter().any(|lane| {
            lane.get("commands")
                .and_then(Value::as_array)
                .is_some_and(|commands| {
                    commands
                        .iter()
                        .any(|entry| entry.as_str() == Some(command.as_str()))
                })
        }) {
            lanes.push(json!({
                "id": "lane-review",
                "label": "Review lane",
                "summary": "Run the primary repository validation lane before review.",
                "trigger": "pre_review",
                "commands": [command],
            }));
        }
    }
    lanes
}

fn build_skill_plan(required_capabilities: &[String], allow_network_analysis: bool) -> Vec<Value> {
    let mut skills = Vec::new();
    if required_capabilities.iter().any(|entry| entry == "code") {
        skills.push(json!({
            "skillId": "implementation-core",
            "label": "Implementation core",
            "state": "available",
            "summary": "General coding and refactoring capability is available for feature work.",
        }));
    }
    if required_capabilities
        .iter()
        .any(|entry| entry == "validation")
    {
        skills.push(json!({
            "skillId": "validation-lane",
            "label": "Validation lane",
            "state": "available",
            "summary": "Runtime can run repo-owned validation commands as part of milestone checks.",
        }));
    }
    if required_capabilities.iter().any(|entry| entry == "review") {
        skills.push(json!({
            "skillId": "review-pack-audit",
            "label": "Review pack audit",
            "state": "available",
            "summary": "Review Pack and runtime evidence are available for final inspection.",
        }));
    }
    if required_capabilities
        .iter()
        .any(|entry| entry == "research")
        || allow_network_analysis
    {
        skills.push(json!({
            "skillId": "research-orchestrator",
            "label": "Research orchestrator",
            "state": if allow_network_analysis { "recommended" } else { "missing" },
            "summary": if allow_network_analysis {
                "Research orchestration is recommended when the plan needs public-web investigation."
            } else {
                "Enable network-backed research before expecting public-web investigation."
            },
        }));
    }
    skills
}

fn build_plan_version(payload: &Value) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let serialized =
        serde_json::to_string(&canonicalize_plan_version_value(payload)).unwrap_or_else(|_| {
            "{}".to_string()
        });
    let mut hasher = DefaultHasher::new();
    serialized.hash(&mut hasher);
    format!("plan-{:016x}", hasher.finish())
}

fn canonicalize_plan_version_value(value: &Value) -> Value {
    match value {
        Value::Array(entries) => Value::Array(
            entries
                .iter()
                .map(canonicalize_plan_version_value)
                .collect::<Vec<_>>(),
        ),
        Value::Object(object) => {
            let mut sorted_keys = object.keys().cloned().collect::<Vec<_>>();
            sorted_keys.sort();
            let mut normalized = serde_json::Map::with_capacity(sorted_keys.len());
            for key in sorted_keys {
                if key == "graphId" {
                    continue;
                }
                if let Some(entry) = object.get(key.as_str()) {
                    normalized.insert(key, canonicalize_plan_version_value(entry));
                }
            }
            Value::Object(normalized)
        }
        _ => value.clone(),
    }
}

pub(super) fn build_prepare_plan(
    objective: Option<&str>,
    missing_context: &[String],
    execution_graph: &Value,
    validation_lanes: &[Value],
    required_capabilities: &[String],
    allow_network_analysis: bool,
    execution_mode: &str,
    preferred_backend_ids: &[String],
) -> Value {
    let clarifying_questions = build_clarifying_questions(missing_context);
    let node_ids_by_kind = |kind: &str| -> Vec<String> {
        execution_graph
            .get("nodes")
            .and_then(Value::as_array)
            .map(|nodes| {
                nodes
                    .iter()
                    .filter(|node| node.get("kind").and_then(Value::as_str) == Some(kind))
                    .filter_map(|node| {
                        node.get("id")
                            .and_then(Value::as_str)
                            .map(ToOwned::to_owned)
                    })
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default()
    };
    let plan_payload = json!({
        "objective": objective,
        "missingContext": missing_context,
        "requiredCapabilities": required_capabilities,
        "validationLanes": validation_lanes,
        "executionMode": execution_mode,
        "preferredBackendIds": preferred_backend_ids,
        "executionGraph": execution_graph,
    });
    let plan_version = build_plan_version(&plan_payload);
    let clarify_nodes = node_ids_by_kind("clarify");
    let execute_nodes = execution_graph
        .get("nodes")
        .and_then(Value::as_array)
        .map(|nodes| {
            nodes
                .iter()
                .filter(|node| {
                    matches!(
                        node.get("kind").and_then(Value::as_str),
                        Some("read" | "plan" | "edit")
                    )
                })
                .filter_map(|node| {
                    node.get("id")
                        .and_then(Value::as_str)
                        .map(ToOwned::to_owned)
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let validate_nodes = execution_graph
        .get("nodes")
        .and_then(Value::as_array)
        .map(|nodes| {
            nodes
                .iter()
                .filter(|node| {
                    matches!(
                        node.get("kind").and_then(Value::as_str),
                        Some("validate" | "review")
                    )
                })
                .filter_map(|node| {
                    node.get("id")
                        .and_then(Value::as_str)
                        .map(ToOwned::to_owned)
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let current_milestone_id = if !clarifying_questions.is_empty() {
        Some("milestone-clarify")
    } else if !execute_nodes.is_empty() {
        Some("milestone-execute")
    } else if !validate_nodes.is_empty() {
        Some("milestone-validate")
    } else {
        None
    };
    let mut milestones = Vec::new();
    if !clarify_nodes.is_empty() || !clarifying_questions.is_empty() {
        milestones.push(json!({
            "id": "milestone-clarify",
            "label": "Clarify scope",
            "summary": "Lock the objective, constraints, and missing context before execution fans out.",
            "status": if current_milestone_id == Some("milestone-clarify") { "active" } else { "completed" },
            "nodeIds": clarify_nodes,
            "validationLaneIds": Vec::<String>::new(),
            "acceptanceCriteria": clarifying_questions,
        }));
    }
    if !execute_nodes.is_empty() {
        milestones.push(json!({
            "id": "milestone-execute",
            "label": "Execute features",
            "summary": "Advance the planned implementation path feature by feature without widening scope.",
            "status": if current_milestone_id == Some("milestone-execute") { "active" } else { "planned" },
            "nodeIds": execute_nodes,
            "validationLaneIds": validation_lanes
                .iter()
                .filter(|lane| lane.get("trigger").and_then(Value::as_str) == Some("per_feature"))
                .filter_map(|lane| lane.get("id").and_then(Value::as_str).map(ToOwned::to_owned))
                .collect::<Vec<_>>(),
            "acceptanceCriteria": [
                "Deliver the intended feature slice without reopening settled constraints.",
                "Leave the repo in a state that can enter milestone validation."
            ],
        }));
    }
    if !validate_nodes.is_empty() || !validation_lanes.is_empty() {
        milestones.push(json!({
            "id": "milestone-validate",
            "label": "Validate and review",
            "summary": "Run milestone validation and prepare a compact review artifact before handoff.",
            "status": if current_milestone_id == Some("milestone-validate") { "active" } else { "planned" },
            "nodeIds": validate_nodes,
            "validationLaneIds": validation_lanes
                .iter()
                .filter_map(|lane| lane.get("id").and_then(Value::as_str).map(ToOwned::to_owned))
                .collect::<Vec<_>>(),
            "acceptanceCriteria": [
                "Run the declared validation lanes.",
                "Publish enough evidence for Review Pack to stay decision-ready."
            ],
        }));
    }
    let estimated_worker_runs = u32::try_from(
        milestones.len()
            + execution_graph
                .get("nodes")
                .and_then(Value::as_array)
                .map(Vec::len)
                .unwrap_or(0),
    )
    .ok();
    let estimated_duration_minutes = estimated_worker_runs.map(|runs| runs.saturating_mul(12));
    json!({
        "planVersion": plan_version,
        "summary": objective
            .map(|value| format!("Runtime decomposed `{value}` into milestone-scoped execution with explicit validation lanes."))
            .unwrap_or_else(|| "Runtime decomposed the request into milestone-scoped execution with explicit validation lanes.".to_string()),
        "currentMilestoneId": current_milestone_id,
        "estimatedDurationMinutes": estimated_duration_minutes,
        "estimatedWorkerRuns": estimated_worker_runs,
        "parallelismHint": if execution_mode == "distributed" {
            "Use targeted parallelism only where validation or isolated reads can proceed without widening coordination overhead."
        } else {
            "Keep execution mostly sequential and reserve parallelism for narrow validation or research slices."
        },
        "clarifyingQuestions": build_clarifying_questions(missing_context),
        "milestones": milestones,
        "validationLanes": validation_lanes,
        "skillPlan": build_skill_plan(required_capabilities, allow_network_analysis),
    })
}

#[cfg(test)]
mod tests {
    use super::build_plan_version;
    use serde_json::json;

    #[test]
    fn build_plan_version_is_stable_across_object_key_order() {
        let left = json!({
            "objective": "Ship the launch handshake",
            "executionGraph": {
                "graphId": "prepare-graph-1000",
                "nodes": [
                    { "id": "node-1", "kind": "read" }
                ],
                "edges": [
                    { "to": "node-1", "from": "node-0" }
                ],
            },
            "validationLanes": [
                {
                    "label": "Review lane",
                    "commands": ["pnpm validate"],
                    "id": "lane-review",
                }
            ],
        });
        let right = json!({
            "validationLanes": [
                {
                    "commands": ["pnpm validate"],
                    "id": "lane-review",
                    "label": "Review lane",
                }
            ],
            "executionGraph": {
                "graphId": "prepare-graph-2000",
                "edges": [
                    { "from": "node-0", "to": "node-1" }
                ],
                "nodes": [
                    { "kind": "read", "id": "node-1" }
                ],
            },
            "objective": "Ship the launch handshake",
        });

        assert_eq!(build_plan_version(&left), build_plan_version(&right));
    }
}
