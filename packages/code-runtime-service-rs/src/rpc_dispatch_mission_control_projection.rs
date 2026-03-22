use super::*;
use std::fs;
use std::path::Path;

const REVIEW_RELAUNCH_ACTIONS: &[&str] = &[
    "retry",
    "continue_with_clarification",
    "switch_profile_and_retry",
    "escalate_to_pair_mode",
];

fn load_publish_handoff_metadata(workspace_root: Option<&str>, run_id: &str) -> Option<Value> {
    let workspace_root = workspace_root?;
    let handoff_path = Path::new(workspace_root)
        .join(".hugecode")
        .join("runs")
        .join(run_id)
        .join("publish")
        .join("handoff.json");
    let raw = fs::read_to_string(handoff_path).ok()?;
    let parsed = serde_json::from_str::<Value>(raw.as_str()).ok()?;
    let publish = parsed.get("publish").and_then(Value::as_object);
    let branch_name = publish
        .and_then(|entry| entry.get("branchName"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    let commit_message = publish
        .and_then(|entry| entry.get("commitMessage"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    let review_title = parsed
        .get("reviewDraft")
        .and_then(Value::as_object)
        .and_then(|entry| entry.get("title"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    let validation_summary = parsed
        .get("validation")
        .and_then(Value::as_object)
        .and_then(|entry| entry.get("summary"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    let operator_command = parsed
        .get("operatorCommands")
        .and_then(Value::as_array)
        .and_then(|entries| entries.first())
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    let changed_files = parsed
        .get("evidence")
        .and_then(Value::as_object)
        .and_then(|entry| entry.get("changedFiles"))
        .and_then(Value::as_array)
        .map(|entries| {
            entries
                .iter()
                .filter_map(Value::as_str)
                .map(ToOwned::to_owned)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let mut details = Vec::new();
    if let Some(commit_message) = commit_message.as_ref() {
        details.push(format!("Commit message: {commit_message}"));
    }
    if let Some(validation_summary) = validation_summary.as_ref() {
        details.push(format!("Validation: {validation_summary}"));
    }
    if let Some(operator_command) = operator_command.as_ref() {
        details.push(format!("Operator command: {operator_command}"));
    }
    if !changed_files.is_empty() {
        details.push(format!("Changed files: {}", changed_files.join(", ")));
    }
    if branch_name.is_none() && review_title.is_none() && details.is_empty() {
        return None;
    }
    Some(json!({
        "branchName": branch_name,
        "commitMessage": commit_message,
        "reviewTitle": review_title,
        "details": if details.is_empty() { Value::Null } else { json!(details) },
    }))
}

pub(crate) fn build_publish_handoff_reference(
    run_id: &str,
    auto_drive: Option<&AgentTaskAutoDriveState>,
    workspace_root: Option<&str>,
) -> Option<Value> {
    let stop_state = auto_drive.and_then(|state| state.stop.as_ref()).cloned();
    let stop_state = stop_state?;
    let mut handoff = json!({
        "jsonPath": format!(".hugecode/runs/{run_id}/publish/handoff.json"),
        "markdownPath": format!(".hugecode/runs/{run_id}/publish/handoff.md"),
        "reason": stop_state.reason,
        "summary": stop_state.summary,
        "at": stop_state.at,
    });
    if let (Some(object), Some(metadata)) = (
        handoff.as_object_mut(),
        load_publish_handoff_metadata(workspace_root, run_id),
    ) {
        if let Some(metadata_object) = metadata.as_object() {
            for (key, value) in metadata_object {
                object.insert(key.clone(), value.clone());
            }
        }
    }
    Some(handoff)
}

pub(super) fn build_review_pack_relaunch_options(run: &MissionRunProjection) -> Option<Value> {
    let available_actions = run
        .intervention
        .as_ref()
        .and_then(|entry| entry.get("actions"))
        .and_then(Value::as_array)
        .map(|actions| {
            actions
                .iter()
                .filter(|action| {
                    action
                        .get("action")
                        .and_then(Value::as_str)
                        .map(|value| REVIEW_RELAUNCH_ACTIONS.contains(&value))
                        .unwrap_or(false)
                })
                .cloned()
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let primary_action = run
        .intervention
        .as_ref()
        .and_then(|entry| entry.get("primaryAction"))
        .and_then(Value::as_str)
        .filter(|value| REVIEW_RELAUNCH_ACTIONS.contains(value))
        .map(ToOwned::to_owned);
    let mut recommended_actions = run
        .relaunch_context
        .as_ref()
        .and_then(|context| context.get("recommendedActions"))
        .and_then(Value::as_array)
        .map(|actions| {
            actions
                .iter()
                .filter_map(Value::as_str)
                .map(ToOwned::to_owned)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    for action in &available_actions {
        let Some(action_name) = action.get("action").and_then(Value::as_str) else {
            continue;
        };
        let enabled = action
            .get("enabled")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        let supported = action
            .get("supported")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        if enabled
            && supported
            && !recommended_actions
                .iter()
                .any(|existing| existing == action_name)
        {
            recommended_actions.push(action_name.to_string());
        }
    }
    if run.relaunch_context.is_none() && available_actions.is_empty() && primary_action.is_none() {
        return None;
    }
    let mut payload = run
        .relaunch_context
        .clone()
        .and_then(|value| value.as_object().cloned())
        .unwrap_or_default();
    payload.insert(
        "sourceTaskId".to_string(),
        payload
            .get("sourceTaskId")
            .cloned()
            .unwrap_or_else(|| json!(run.task_id)),
    );
    payload.insert(
        "sourceRunId".to_string(),
        payload
            .get("sourceRunId")
            .cloned()
            .unwrap_or_else(|| json!(run.id)),
    );
    payload.insert(
        "sourceReviewPackId".to_string(),
        payload
            .get("sourceReviewPackId")
            .cloned()
            .unwrap_or_else(|| json!(run.review_pack_id.clone())),
    );
    if !payload.contains_key("summary") && !available_actions.is_empty() {
        payload.insert(
            "summary".to_string(),
            json!("Structured relaunch options are available from the recorded run context."),
        );
    }
    payload.insert(
        "recommendedActions".to_string(),
        if recommended_actions.is_empty() {
            Value::Null
        } else {
            json!(recommended_actions)
        },
    );
    payload.insert(
        "primaryAction".to_string(),
        primary_action.map(Value::String).unwrap_or(Value::Null),
    );
    payload.insert(
        "availableActions".to_string(),
        if available_actions.is_empty() {
            Value::Null
        } else {
            Value::Array(available_actions)
        },
    );
    Some(Value::Object(payload))
}
