use super::*;

fn map_parallel_safe_capability_to_scope_profile(capability: &str) -> &'static str {
    match capability.trim() {
        "diagnostics" => "review",
        "read" => "research",
        _ => "general",
    }
}

fn build_parallel_safe_delegation_instruction(
    parent_title: Option<&str>,
    parent_objective: Option<&str>,
    node_label: &str,
    capability: &str,
) -> String {
    let lane_scope = map_parallel_safe_capability_to_scope_profile(capability);
    let parent_summary = parent_title
        .filter(|value| !value.trim().is_empty())
        .or(parent_objective.filter(|value| !value.trim().is_empty()))
        .unwrap_or("the parent runtime mission");
    format!(
        "You are a bounded `{lane_scope}` delegate under runtime governance.\n\
         Parent mission: {parent_summary}\n\
         Delegated lane capability: {capability}\n\
         Delegated lane objective: {node_label}\n\
         Constraints:\n\
         - Stay strictly within this delegated lane.\n\
         - Publish concise evidence and outcome summaries back to runtime.\n\
         - Do not broaden scope beyond this lane or mutate workspace state unless runtime explicitly allows it."
    )
}

pub(super) async fn materialize_parallel_safe_sub_agent_lanes(
    ctx: &AppContext,
    run_id: &str,
    request: &AgentTaskStartRequest,
    prepare: &Value,
) {
    let fan_out_ready = prepare
        .get("delegationPlan")
        .and_then(|plan| plan.get("fanOutReady"))
        .and_then(Value::as_bool)
        .unwrap_or(false);
    if !fan_out_ready {
        return;
    }

    let Some(nodes) = prepare
        .get("executionGraph")
        .and_then(|graph| graph.get("nodes"))
        .and_then(Value::as_array)
    else {
        return;
    };

    let workspace_id = request.workspace_id.trim();
    if workspace_id.is_empty() {
        return;
    }
    let thread_id = trim_optional_string(request.thread_id.clone());
    let reason_effort = trim_optional_string(request.reason_effort.clone());
    let provider = trim_optional_string(request.provider.clone());
    let model_id = trim_optional_string(request.model_id.clone());
    let parent_title = trim_optional_string(request.title.clone()).or_else(|| {
        prepare
            .get("runIntent")
            .and_then(|intent| intent.get("title"))
            .and_then(Value::as_str)
            .map(ToOwned::to_owned)
    });
    let parent_objective = prepare
        .get("runIntent")
        .and_then(|intent| intent.get("objective"))
        .and_then(Value::as_str);

    for node in nodes.iter().filter(|node| {
        node.get("parallelSafe")
            .and_then(Value::as_bool)
            .unwrap_or(false)
    }) {
        let capability = node
            .get("capability")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or("read");
        let node_label = node
            .get("label")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or("Delegated runtime lane");
        let scope_profile = map_parallel_safe_capability_to_scope_profile(capability);
        let session_title = format!("{} delegate · {node_label}", scope_profile.replace('_', " "));

        let spawn_result = crate::sub_agents::handle_sub_agent_spawn(
            ctx,
            &json!({
                "workspaceId": workspace_id,
                "threadId": thread_id,
                "title": session_title,
                "accessMode": "read-only",
                "scopeProfile": scope_profile,
                "reasonEffort": reason_effort,
                "provider": provider,
                "modelId": model_id,
                "parentRunId": run_id,
            }),
        )
        .await;

        let session_id = match spawn_result {
            Ok(result) => result
                .get("sessionId")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(ToOwned::to_owned),
            Err(error) => {
                warn!(
                    run_id,
                    capability,
                    node_label,
                    error = error.message.as_str(),
                    "failed to spawn runtime sub-agent lane"
                );
                None
            }
        };
        let Some(session_id) = session_id else {
            continue;
        };

        let instruction = build_parallel_safe_delegation_instruction(
            parent_title.as_deref(),
            parent_objective,
            node_label,
            capability,
        );
        if let Err(error) = crate::sub_agents::handle_sub_agent_send(
            ctx,
            &json!({
                "sessionId": session_id,
                "instruction": instruction,
                "requestId": format!(
                    "{run_id}:delegation:{capability}:{}",
                    node.get("id").and_then(Value::as_str).unwrap_or("lane")
                ),
            }),
        )
        .await
        {
            warn!(
                run_id,
                capability,
                node_label,
                session_id,
                error = error.message.as_str(),
                "failed to dispatch runtime sub-agent lane"
            );
        }
    }
}
