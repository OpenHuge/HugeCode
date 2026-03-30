use super::*;
use crate::native_state_store::TABLE_NATIVE_SCHEDULES;

pub(crate) async fn list_native_schedules(ctx: &AppContext) -> Result<Value, RpcError> {
    let schedules = ctx
        .native_state_store
        .list_entities(TABLE_NATIVE_SCHEDULES)
        .await
        .map_err(RpcError::internal)?;
    let mut projected = Vec::with_capacity(schedules.len());
    for schedule in schedules {
        projected.push(project_native_schedule_runtime_truth(ctx, schedule).await?);
    }
    Ok(Value::Array(projected))
}

pub(crate) async fn create_native_schedule(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let id =
        read_optional_string(params, "scheduleId").unwrap_or_else(|| new_id("native-schedule"));
    let payload = normalize_native_schedule_payload(
        extract_schedule_payload(params, "schedule", id.as_str()),
        None,
    );

    ctx.native_state_store
        .upsert_entity(TABLE_NATIVE_SCHEDULES, id.as_str(), Some(true), payload)
        .await
        .map_err(RpcError::internal)
}

pub(crate) async fn update_native_schedule(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let id = read_first_non_empty_schedule_string(params, &["scheduleId", "id"])
        .ok_or_else(|| RpcError::invalid_params("Missing required string field: scheduleId"))?;
    let existing = ctx
        .native_state_store
        .get_entity(TABLE_NATIVE_SCHEDULES, id.as_str())
        .await
        .map_err(RpcError::internal)?
        .ok_or_else(|| RpcError::invalid_params(format!("schedule `{id}` not found")))?;

    let existing_object = existing
        .as_object()
        .cloned()
        .unwrap_or_else(serde_json::Map::new);
    let mut existing_for_normalization = existing_object.clone();
    let patch = extract_schedule_payload(params, "schedule", id.as_str());
    let merged = match patch {
        Value::Object(patch_object) => {
            let mut merged = existing_object.clone();
            let explicit_outcome = patch_object.contains_key("lastOutcomeLabel")
                || patch_object.contains_key("lastOutcome")
                || patch_object.contains_key("lastResult");
            let affects_runtime_status = patch_object.contains_key("blockingReason")
                || patch_object.contains_key("blockReason")
                || patch_object.contains_key("lastError")
                || patch_object.contains_key("enabled")
                || patch_object.contains_key("status");
            for (key, value) in patch_object {
                merged.insert(key, value);
            }
            if affects_runtime_status && !explicit_outcome {
                merged.remove("lastOutcomeLabel");
                merged.remove("lastOutcome");
                merged.remove("lastResult");
                existing_for_normalization.remove("lastOutcomeLabel");
                existing_for_normalization.remove("lastOutcome");
                existing_for_normalization.remove("lastResult");
            }
            Value::Object(merged)
        }
        other => other,
    };
    let payload = normalize_native_schedule_payload(merged, Some(&existing_for_normalization));

    ctx.native_state_store
        .upsert_entity(
            TABLE_NATIVE_SCHEDULES,
            id.as_str(),
            existing_object.get("enabled").and_then(Value::as_bool),
            payload,
        )
        .await
        .map_err(RpcError::internal)
}

pub(crate) async fn schedule_run_state_update(
    ctx: &AppContext,
    params: &Value,
    status: &str,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let schedule_id = read_first_non_empty_schedule_string(params, &["scheduleId", "id"])
        .ok_or_else(|| RpcError::invalid_params("Missing required string field: scheduleId"))?;
    let existing = ctx
        .native_state_store
        .get_entity(TABLE_NATIVE_SCHEDULES, schedule_id.as_str())
        .await
        .map_err(RpcError::internal)?
        .ok_or_else(|| RpcError::invalid_params(format!("schedule `{schedule_id}` not found")))?;

    let mut object = existing
        .as_object()
        .cloned()
        .unwrap_or_else(serde_json::Map::new);
    let now = now_ms();
    object.insert(
        "lastActionAt".to_string(),
        Value::Number(serde_json::Number::from(now)),
    );
    if status == "running" {
        ensure_schedule_has_no_active_run(ctx, schedule_id.as_str(), &object).await?;
        let launch_outcome =
            launch_native_schedule_run(ctx, params, schedule_id.as_str(), &object).await?;
        object.remove("blockingReason");
        object.remove("blockReason");
        object.insert(
            "lastRunAt".to_string(),
            Value::Number(serde_json::Number::from(now)),
        );
        object.insert(
            "lastRunAtMs".to_string(),
            Value::Number(serde_json::Number::from(now)),
        );
        if let Some(task_id) = launch_outcome.task_id {
            object.insert("currentTaskId".to_string(), Value::String(task_id.clone()));
            object.insert("lastTriggeredTaskId".to_string(), Value::String(task_id));
        }
        if let Some(run_id) = launch_outcome.run_id {
            object.insert("currentRunId".to_string(), Value::String(run_id.clone()));
            object.insert("lastTriggeredRunId".to_string(), Value::String(run_id));
        }
        object.insert(
            "lastTriggeredAt".to_string(),
            Value::Number(serde_json::Number::from(now)),
        );
        object.insert("status".to_string(), Value::String("running".to_string()));
        object.insert(
            "lastOutcomeLabel".to_string(),
            Value::String("Running".to_string()),
        );
        remove_schedule_timestamp_fields(&mut object, &["nextRunAt", "nextRunAtMs"]);
    } else {
        if let Some(task_id) = read_schedule_text(&object, &["currentTaskId", "current_task_id"]) {
            let interrupt_ack = handle_agent_task_interrupt(
                ctx,
                &json!({
                    "taskId": task_id,
                    "reason": "Scheduled run cancelled.",
                }),
            )
            .await?;
            let accepted = interrupt_ack
                .get("accepted")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            if !accepted {
                let current_task_payload =
                    read_agent_task_status_payload(ctx, Some(task_id.as_str())).await?;
                if let Some(payload) = current_task_payload.as_ref() {
                    if let Some(task_status) = payload.get("status").and_then(Value::as_str) {
                        object.insert(
                            "currentTaskStatus".to_string(),
                            Value::String(task_status.to_string()),
                        );
                        if is_agent_task_terminal_status(task_status) {
                            project_schedule_terminal_task_state(&mut object, Some(payload));
                        } else {
                            object
                                .insert("status".to_string(), Value::String("running".to_string()));
                            if let Some(message) = interrupt_ack
                                .get("message")
                                .and_then(Value::as_str)
                                .map(str::trim)
                                .filter(|value| !value.is_empty())
                            {
                                object.insert(
                                    "lastOutcomeLabel".to_string(),
                                    Value::String(message.to_string()),
                                );
                            }
                        }
                        return ctx
                            .native_state_store
                            .upsert_entity(
                                TABLE_NATIVE_SCHEDULES,
                                schedule_id.as_str(),
                                object.get("enabled").and_then(Value::as_bool),
                                Value::Object(object),
                            )
                            .await
                            .map_err(RpcError::internal);
                    }
                }
            }
        }
        let next_status = derive_schedule_status(
            object
                .get("enabled")
                .and_then(Value::as_bool)
                .unwrap_or(true),
            None,
            Some("idle"),
        );
        object.insert("status".to_string(), Value::String(next_status.to_string()));
        object.insert(
            "lastOutcomeLabel".to_string(),
            Value::String("Cancelled current run".to_string()),
        );
        object.remove("currentTaskId");
        object.remove("currentRunId");
        if next_status == "idle" {
            let next_run_at = now.saturating_add(15 * 60 * 1000);
            set_schedule_timestamp_fields(&mut object, &["nextRunAt", "nextRunAtMs"], next_run_at);
        } else {
            remove_schedule_timestamp_fields(&mut object, &["nextRunAt", "nextRunAtMs"]);
        }
    }

    ctx.native_state_store
        .upsert_entity(
            TABLE_NATIVE_SCHEDULES,
            schedule_id.as_str(),
            object.get("enabled").and_then(Value::as_bool),
            Value::Object(object),
        )
        .await
        .map_err(RpcError::internal)
}

async fn read_agent_task_status_payload(
    ctx: &AppContext,
    task_id: Option<&str>,
) -> Result<Option<serde_json::Map<String, Value>>, RpcError> {
    let Some(task_id) = task_id.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(None);
    };
    let payload = handle_agent_task_status(ctx, &json!({ "taskId": task_id })).await?;
    Ok(payload.as_object().cloned())
}

fn derive_schedule_outcome_label_from_task_payload(
    payload: &serde_json::Map<String, Value>,
) -> Option<String> {
    let status = payload
        .get("status")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())?;
    let error_message = payload
        .get("errorMessage")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty());
    match status {
        "queued" => Some("Queued".to_string()),
        "running" => Some("Running".to_string()),
        "awaiting_approval" => Some("Awaiting approval".to_string()),
        "completed" => Some(
            if payload
                .get("reviewPackId")
                .and_then(Value::as_str)
                .map(str::trim)
                .is_some_and(|value| !value.is_empty())
            {
                "Review pack ready".to_string()
            } else {
                "Completed".to_string()
            },
        ),
        "failed" => Some(error_message.unwrap_or("Failed").to_string()),
        "interrupted" | "cancelled" => {
            Some(error_message.unwrap_or("Cancelled current run").to_string())
        }
        _ => None,
    }
}

fn project_schedule_terminal_task_state(
    object: &mut serde_json::Map<String, Value>,
    payload: Option<&serde_json::Map<String, Value>>,
) {
    let next_status = derive_schedule_status(
        object
            .get("enabled")
            .and_then(Value::as_bool)
            .unwrap_or(true),
        read_schedule_text(object, &["blockingReason", "blockReason", "lastError"]).as_deref(),
        Some("idle"),
    );
    object.insert("status".to_string(), Value::String(next_status.to_string()));
    if let Some(label) = payload.and_then(derive_schedule_outcome_label_from_task_payload) {
        object.insert("lastOutcomeLabel".to_string(), Value::String(label));
    }
    object.remove("currentTaskId");
    object.remove("currentRunId");
    object.remove("currentTaskStatus");
    if next_status == "idle" {
        let next_run_at = read_schedule_number(
            object,
            &["nextRunAtMs", "nextRunAt", "next_run_at_ms", "next_run_at"],
        )
        .unwrap_or_else(|| now_ms().saturating_add(15 * 60 * 1000));
        set_schedule_timestamp_fields(object, &["nextRunAt", "nextRunAtMs"], next_run_at);
    } else {
        remove_schedule_timestamp_fields(object, &["nextRunAt", "nextRunAtMs"]);
    }
}

async fn project_native_schedule_runtime_truth(
    ctx: &AppContext,
    schedule: Value,
) -> Result<Value, RpcError> {
    let Value::Object(mut object) = schedule else {
        return Ok(schedule);
    };
    let current_task_id = read_schedule_text(&object, &["currentTaskId", "current_task_id"]);
    let last_triggered_task_id =
        read_schedule_text(&object, &["lastTriggeredTaskId", "last_triggered_task_id"])
            .or_else(|| current_task_id.clone());
    let current_task_payload =
        read_agent_task_status_payload(ctx, current_task_id.as_deref()).await?;
    let last_triggered_task_payload =
        if last_triggered_task_id.as_deref() == current_task_id.as_deref() {
            current_task_payload.clone()
        } else {
            read_agent_task_status_payload(ctx, last_triggered_task_id.as_deref()).await?
        };

    if let Some(payload) = last_triggered_task_payload
        .as_ref()
        .or(current_task_payload.as_ref())
    {
        if let Some(run_id) = payload
            .get("runSummary")
            .and_then(Value::as_object)
            .and_then(|entry| entry.get("id"))
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            object.insert(
                "lastTriggeredRunId".to_string(),
                Value::String(run_id.to_string()),
            );
        }
        if let Some(status) = payload
            .get("status")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            object.insert(
                "lastTriggeredTaskStatus".to_string(),
                Value::String(status.to_string()),
            );
        }
        for key in [
            "missionLinkage",
            "reviewActionability",
            "reviewPackSummary",
            "reviewPackId",
            "taskSource",
        ] {
            if let Some(value) = payload.get(key) {
                object.insert(key.to_string(), value.clone());
            }
        }
    }

    if let Some(payload) = current_task_payload.as_ref() {
        if let Some(status) = payload
            .get("status")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            object.insert(
                "currentTaskStatus".to_string(),
                Value::String(status.to_string()),
            );
            if is_agent_task_terminal_status(status) {
                project_schedule_terminal_task_state(&mut object, Some(payload));
            } else {
                object.insert("status".to_string(), Value::String("running".to_string()));
                remove_schedule_timestamp_fields(&mut object, &["nextRunAt", "nextRunAtMs"]);
                if let Some(run_id) = payload
                    .get("runSummary")
                    .and_then(Value::as_object)
                    .and_then(|entry| entry.get("id"))
                    .and_then(Value::as_str)
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                {
                    object.insert(
                        "currentRunId".to_string(),
                        Value::String(run_id.to_string()),
                    );
                }
            }
        }
    } else if current_task_id.is_some() {
        project_schedule_terminal_task_state(&mut object, last_triggered_task_payload.as_ref());
    }

    Ok(Value::Object(object))
}

fn read_first_non_empty_schedule_string(
    params: &serde_json::Map<String, Value>,
    keys: &[&str],
) -> Option<String> {
    for key in keys {
        if let Some(value) = read_optional_string(params, key) {
            return Some(value);
        }
    }
    None
}

fn extract_schedule_payload(
    params: &serde_json::Map<String, Value>,
    payload_key: &str,
    id: &str,
) -> Value {
    if let Some(payload) = params.get(payload_key) {
        return ensure_schedule_payload_has_id(payload.clone(), id);
    }

    let mut object = serde_json::Map::new();
    for (key, value) in params {
        if ["id", "enabled", payload_key].contains(&key.as_str()) {
            continue;
        }
        if key.ends_with("Id") {
            continue;
        }
        object.insert(key.clone(), value.clone());
    }
    ensure_schedule_payload_has_id(Value::Object(object), id)
}

fn ensure_schedule_payload_has_id(payload: Value, id: &str) -> Value {
    match payload {
        Value::Object(mut object) => {
            object.insert("id".to_string(), Value::String(id.to_string()));
            Value::Object(object)
        }
        _ => json!({
            "id": id,
            "value": payload,
        }),
    }
}

fn normalize_schedule_text(value: &Value) -> Option<String> {
    value.as_str().and_then(|entry| {
        let trimmed = entry.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn read_schedule_string_array(
    object: &serde_json::Map<String, Value>,
    keys: &[&str],
) -> Option<Vec<String>> {
    for key in keys {
        let Some(value) = object.get(*key) else {
            continue;
        };
        let Some(entries) = value.as_array() else {
            continue;
        };
        let mut seen = std::collections::BTreeSet::new();
        let mut normalized = Vec::new();
        for entry in entries {
            let Some(text) = normalize_schedule_text(entry) else {
                continue;
            };
            if seen.insert(text.clone()) {
                normalized.push(text);
            }
        }
        if !normalized.is_empty() {
            return Some(normalized);
        }
    }
    None
}

fn read_schedule_text(object: &serde_json::Map<String, Value>, keys: &[&str]) -> Option<String> {
    for key in keys {
        if let Some(value) = object.get(*key).and_then(normalize_schedule_text) {
            return Some(value);
        }
    }
    None
}

fn read_schedule_number(object: &serde_json::Map<String, Value>, keys: &[&str]) -> Option<u64> {
    for key in keys {
        let Some(value) = object.get(*key) else {
            continue;
        };
        if let Some(number) = value.as_u64() {
            return Some(number);
        }
        if let Some(text) = value.as_str() {
            let trimmed = text.trim();
            if trimmed.is_empty() {
                continue;
            }
            if let Ok(parsed) = trimmed.parse::<u64>() {
                return Some(parsed);
            }
        }
    }
    None
}

fn derive_schedule_status(
    enabled: bool,
    blocking_reason: Option<&str>,
    explicit_status: Option<&str>,
) -> &'static str {
    if !enabled {
        return "paused";
    }
    if blocking_reason.is_some() {
        return "blocked";
    }
    match explicit_status {
        Some("running") => "running",
        Some("paused") => "paused",
        Some("blocked") => "blocked",
        Some("active") | Some("idle") | Some("cancelled") => "idle",
        _ => "idle",
    }
}

fn derive_schedule_outcome_label(status: &str, blocking_reason: Option<&str>) -> String {
    match status {
        "running" => "Running".to_string(),
        "paused" => "Paused".to_string(),
        "blocked" => blocking_reason
            .map(str::to_string)
            .unwrap_or_else(|| "Blocked".to_string()),
        _ => "Awaiting next run".to_string(),
    }
}

fn set_schedule_timestamp_fields(
    object: &mut serde_json::Map<String, Value>,
    keys: &[&str],
    value: u64,
) {
    let number = Value::Number(serde_json::Number::from(value));
    for key in keys {
        object.insert((*key).to_string(), number.clone());
    }
}

fn remove_schedule_timestamp_fields(object: &mut serde_json::Map<String, Value>, keys: &[&str]) {
    for key in keys {
        object.remove(*key);
    }
}

fn normalize_native_schedule_payload(
    payload: Value,
    existing: Option<&serde_json::Map<String, Value>>,
) -> Value {
    let Value::Object(mut object) = payload else {
        return payload;
    };

    let enabled = object
        .get("enabled")
        .and_then(Value::as_bool)
        .or_else(|| existing.and_then(|entry| entry.get("enabled").and_then(Value::as_bool)))
        .unwrap_or(true);
    object.insert("enabled".to_string(), Value::Bool(enabled));

    let cadence = read_schedule_text(&object, &["cadenceLabel", "cadence", "cron"])
        .or_else(|| {
            existing
                .and_then(|entry| read_schedule_text(entry, &["cadenceLabel", "cadence", "cron"]))
        })
        .unwrap_or_else(|| "*/15 * * * *".to_string());
    object
        .entry("cadenceLabel".to_string())
        .or_insert_with(|| Value::String(cadence.clone()));
    object
        .entry("cadence".to_string())
        .or_insert_with(|| Value::String(cadence.clone()));
    object
        .entry("cron".to_string())
        .or_insert_with(|| Value::String(cadence.clone()));

    let trigger_source_label =
        read_schedule_text(&object, &["triggerSourceLabel", "trigger_source_label"])
            .or_else(|| {
                existing.and_then(|entry| {
                    read_schedule_text(entry, &["triggerSourceLabel", "trigger_source_label"])
                })
            })
            .unwrap_or_else(|| "schedule".to_string());
    object.insert(
        "triggerSourceLabel".to_string(),
        Value::String(trigger_source_label),
    );

    let blocking_reason =
        read_schedule_text(&object, &["blockingReason", "blockReason", "lastError"]);
    let existing_status = existing.and_then(|entry| read_schedule_text(entry, &["status"]));
    let explicit_status = read_schedule_text(&object, &["status"]).or(existing_status);
    let status = derive_schedule_status(
        enabled,
        blocking_reason.as_deref(),
        explicit_status.as_deref(),
    );
    object.insert("status".to_string(), Value::String(status.to_string()));

    let explicit_last_outcome_label =
        read_schedule_text(&object, &["lastOutcomeLabel", "lastOutcome", "lastResult"]);
    let last_outcome_label = explicit_last_outcome_label
        .or_else(|| {
            if blocking_reason.is_some() {
                Some(derive_schedule_outcome_label(
                    status,
                    blocking_reason.as_deref(),
                ))
            } else {
                None
            }
        })
        .or_else(|| {
            existing.and_then(|entry| {
                read_schedule_text(entry, &["lastOutcomeLabel", "lastOutcome", "lastResult"])
            })
        })
        .unwrap_or_else(|| derive_schedule_outcome_label(status, blocking_reason.as_deref()));
    object.insert(
        "lastOutcomeLabel".to_string(),
        Value::String(last_outcome_label),
    );

    if let Some(last_run_at) = read_schedule_number(
        &object,
        &["lastRunAtMs", "lastRunAt", "last_run_at_ms", "last_run_at"],
    )
    .or_else(|| {
        existing.and_then(|entry| {
            read_schedule_number(
                entry,
                &["lastRunAtMs", "lastRunAt", "last_run_at_ms", "last_run_at"],
            )
        })
    }) {
        set_schedule_timestamp_fields(&mut object, &["lastRunAt", "lastRunAtMs"], last_run_at);
    }

    if status == "idle" {
        let next_run_at = read_schedule_number(
            &object,
            &["nextRunAtMs", "nextRunAt", "next_run_at_ms", "next_run_at"],
        )
        .or_else(|| {
            existing.and_then(|entry| {
                read_schedule_number(
                    entry,
                    &["nextRunAtMs", "nextRunAt", "next_run_at_ms", "next_run_at"],
                )
            })
        })
        .unwrap_or_else(|| now_ms().saturating_add(15 * 60 * 1000));
        set_schedule_timestamp_fields(&mut object, &["nextRunAt", "nextRunAtMs"], next_run_at);
    } else {
        remove_schedule_timestamp_fields(&mut object, &["nextRunAt", "nextRunAtMs"]);
    }

    Value::Object(object)
}

struct NativeScheduleLaunchOutcome {
    task_id: Option<String>,
    run_id: Option<String>,
}

pub(crate) fn reject_active_schedule_task(
    schedule_id: &str,
    current_task_id: &str,
    task_status: &str,
) -> Result<(), RpcError> {
    if is_agent_task_terminal_status(task_status) {
        return Ok(());
    }
    Err(RpcError::invalid_params(format!(
        "native schedule `{schedule_id}` already has an active task `{current_task_id}`"
    )))
}

async fn ensure_schedule_has_no_active_run(
    ctx: &AppContext,
    schedule_id: &str,
    schedule: &serde_json::Map<String, Value>,
) -> Result<(), RpcError> {
    let Some(current_task_id) = read_schedule_text(schedule, &["currentTaskId", "current_task_id"])
    else {
        return Ok(());
    };
    let Some(payload) = read_agent_task_status_payload(ctx, Some(current_task_id.as_str())).await?
    else {
        return Ok(());
    };
    let status = payload
        .get("status")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("running");
    reject_active_schedule_task(schedule_id, current_task_id.as_str(), status)
}

fn resolve_schedule_workspace_id(
    params: &serde_json::Map<String, Value>,
    schedule_id: &str,
    schedule: &serde_json::Map<String, Value>,
) -> Result<String, RpcError> {
    let schedule_workspace_id = read_schedule_text(schedule, &["workspaceId", "workspace_id"])
        .ok_or_else(|| {
            RpcError::invalid_params(
                "native schedule run-now requires a workspaceId in the schedule payload.",
            )
        })?;
    if let Some(request_workspace_id) =
        read_optional_string_value(params, &["workspaceId", "workspace_id"])
    {
        if request_workspace_id != schedule_workspace_id {
            return Err(RpcError::invalid_params(format!(
                "native schedule `{schedule_id}` run-now workspaceId must match the persisted schedule workspace."
            )));
        }
    }
    Ok(schedule_workspace_id)
}

async fn launch_native_schedule_run(
    ctx: &AppContext,
    params: &serde_json::Map<String, Value>,
    schedule_id: &str,
    schedule: &serde_json::Map<String, Value>,
) -> Result<NativeScheduleLaunchOutcome, RpcError> {
    let workspace_id = resolve_schedule_workspace_id(params, schedule_id, schedule)?;
    let prepare_payload =
        build_native_schedule_run_prepare_payload(schedule_id, &workspace_id, schedule)?;
    let prepare = crate::rpc_dispatch::handle_runtime_run_prepare_v2(ctx, &prepare_payload).await?;
    let approved_plan_version = extract_prepare_plan_version(&prepare)?;
    let start_payload =
        build_native_schedule_run_start_payload(prepare_payload, approved_plan_version.as_str());
    let response = crate::rpc_dispatch::handle_runtime_run_start_v2(ctx, &start_payload).await?;
    Ok(project_native_schedule_launch_outcome(&response))
}

fn build_native_schedule_task_source(schedule_id: &str, workspace_id: &str, title: &str) -> Value {
    json!({
        "kind": "schedule",
        "label": "Scheduled task",
        "shortLabel": "Schedule",
        "title": title,
        "externalId": schedule_id,
        "canonicalUrl": format!("schedule://{schedule_id}"),
        "sourceTaskId": schedule_id,
        "sourceRunId": schedule_id,
        "workspaceId": workspace_id,
    })
}

fn build_native_schedule_run_prepare_payload(
    schedule_id: &str,
    workspace_id: &str,
    schedule: &serde_json::Map<String, Value>,
) -> Result<Value, RpcError> {
    let prompt = read_schedule_text(schedule, &["prompt", "taskPrompt", "instructions"])
        .ok_or_else(|| {
            RpcError::invalid_params(
                "native schedule run-now requires a prompt in the schedule payload.",
            )
        })?;
    let title = read_schedule_text(schedule, &["name", "title"])
        .unwrap_or_else(|| "Scheduled automation".to_string());
    let execution_profile_id =
        read_schedule_text(schedule, &["executionProfileId", "execution_profile_id"]);
    let review_profile_id = read_schedule_text(schedule, &["reviewProfileId", "review_profile_id"]);
    let validation_preset_id =
        read_schedule_text(schedule, &["validationPresetId", "validation_preset_id"]);
    let preferred_backend_ids =
        read_schedule_string_array(schedule, &["preferredBackendIds", "preferred_backend_ids"])
            .or_else(|| {
                read_schedule_text(
                    schedule,
                    &[
                        "preferredBackendId",
                        "preferred_backend_id",
                        "backendId",
                        "backend_id",
                    ],
                )
                .map(|entry| vec![entry])
            });
    let access_mode = read_schedule_text(schedule, &["accessMode", "access_mode"]);
    Ok(json!({
        "workspaceId": workspace_id,
        "requestId": format!("schedule-run:{schedule_id}:{now}", now = now_ms()),
        "title": title,
        "taskSource": build_native_schedule_task_source(schedule_id, workspace_id, title.as_str()),
        "executionProfileId": execution_profile_id,
        "reviewProfileId": review_profile_id,
        "validationPresetId": validation_preset_id,
        "accessMode": access_mode,
        "preferredBackendIds": preferred_backend_ids,
        "steps": [
            {
                "kind": "read",
                "input": prompt,
            }
        ],
    }))
}

fn extract_prepare_plan_version(prepare: &Value) -> Result<String, RpcError> {
    prepare
        .get("plan")
        .and_then(Value::as_object)
        .and_then(|plan| plan.get("planVersion"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
        .ok_or_else(|| RpcError::internal("runtime run prepare v2 missing planVersion"))
}

fn build_native_schedule_run_start_payload(
    mut prepare_payload: Value,
    approved_plan_version: &str,
) -> Value {
    if let Some(payload) = prepare_payload.as_object_mut() {
        payload.insert(
            "approvedPlanVersion".to_string(),
            Value::String(approved_plan_version.to_string()),
        );
    }
    prepare_payload
}

fn project_native_schedule_launch_outcome(response: &Value) -> NativeScheduleLaunchOutcome {
    NativeScheduleLaunchOutcome {
        task_id: response
            .get("run")
            .and_then(Value::as_object)
            .and_then(|run| run.get("taskId"))
            .and_then(Value::as_str)
            .map(ToOwned::to_owned)
            .or_else(|| {
                response
                    .get("taskId")
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned)
            }),
        run_id: response
            .get("missionRun")
            .and_then(Value::as_object)
            .and_then(|entry| entry.get("id"))
            .and_then(Value::as_str)
            .map(ToOwned::to_owned)
            .or_else(|| {
                response
                    .get("run")
                    .and_then(Value::as_object)
                    .and_then(|entry| entry.get("taskId"))
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned)
            })
            .or_else(|| {
                response
                    .get("runId")
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned)
            }),
    }
}

fn read_optional_string_value(
    params: &serde_json::Map<String, Value>,
    keys: &[&str],
) -> Option<String> {
    for key in keys {
        if let Some(value) = params.get(*key).and_then(normalize_schedule_text) {
            return Some(value);
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_native_schedule_run_prepare_payload_preserves_governed_fields() {
        let schedule = json!({
            "name": "Nightly review",
            "prompt": "Inspect repo drift",
            "workspaceId": "ws-1",
            "executionProfileId": "balanced-delegate",
            "reviewProfileId": "night-review",
            "validationPresetId": "review-first",
            "preferredBackendIds": ["backend-a", "backend-b"],
            "accessMode": "read-only",
        });

        let payload = build_native_schedule_run_prepare_payload(
            "schedule-1",
            "ws-1",
            schedule.as_object().expect("schedule object"),
        )
        .expect("prepare payload");

        assert_eq!(payload.get("workspaceId"), Some(&json!("ws-1")));
        assert_eq!(
            payload.get("executionProfileId"),
            Some(&json!("balanced-delegate"))
        );
        assert_eq!(payload.get("reviewProfileId"), Some(&json!("night-review")));
        assert_eq!(
            payload.get("validationPresetId"),
            Some(&json!("review-first"))
        );
        assert_eq!(
            payload.get("preferredBackendIds"),
            Some(&json!(["backend-a", "backend-b"]))
        );
        assert_eq!(payload.get("accessMode"), Some(&json!("read-only")));
        assert_eq!(
            payload
                .get("taskSource")
                .and_then(Value::as_object)
                .and_then(|task_source| task_source.get("kind")),
            Some(&json!("schedule"))
        );
        assert!(payload.get("autonomyRequest").is_none());
    }

    #[test]
    fn build_native_schedule_run_start_payload_adds_approved_plan_version() {
        let payload = build_native_schedule_run_start_payload(
            json!({
                "workspaceId": "ws-1",
                "requestId": "schedule-run:schedule-1:1"
            }),
            "plan-v1",
        );

        assert_eq!(payload.get("approvedPlanVersion"), Some(&json!("plan-v1")));
        assert_eq!(payload.get("workspaceId"), Some(&json!("ws-1")));
    }

    #[test]
    fn extract_prepare_plan_version_reads_runtime_prepare_truth() {
        let prepare = json!({
            "plan": {
                "planVersion": "plan-v2"
            }
        });

        assert_eq!(
            extract_prepare_plan_version(&prepare).expect("plan version"),
            "plan-v2"
        );
    }

    #[test]
    fn project_native_schedule_launch_outcome_reads_run_record_v2_shape() {
        let outcome = project_native_schedule_launch_outcome(&json!({
            "run": {
                "taskId": "runtime-task:42"
            },
            "missionRun": {
                "id": "run-42"
            }
        }));

        assert_eq!(outcome.task_id.as_deref(), Some("runtime-task:42"));
        assert_eq!(outcome.run_id.as_deref(), Some("run-42"));
    }
}
