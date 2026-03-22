use super::*;

pub(super) fn acp_method_not_found(error: &str) -> bool {
    let normalized = error.trim().to_ascii_lowercase();
    normalized.contains("method not found")
        || normalized.contains("unknown method")
        || normalized.contains("not implemented")
}

pub(super) fn extract_session_id(value: &Value) -> Option<String> {
    value.as_object().and_then(|object| {
        object
            .get("sessionId")
            .or_else(|| object.get("session_id"))
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)
    })
}

fn session_update_payload<'a>(value: &'a Value) -> &'a Value {
    value
        .get("update")
        .filter(|payload| payload.is_object())
        .unwrap_or(value)
}

fn session_update_kind(value: &Value) -> Option<String> {
    session_update_payload(value)
        .as_object()
        .and_then(|object| {
            object
                .get("sessionUpdate")
                .or_else(|| object.get("session_update"))
                .and_then(Value::as_str)
        })
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn session_update_carries_agent_text(value: &Value) -> bool {
    let Some(kind) = session_update_kind(value) else {
        return true;
    };
    let normalized = kind.to_ascii_lowercase();
    normalized == "agent_message_chunk"
        || normalized == "agent_message"
        || normalized == "assistant_message_chunk"
        || normalized == "assistant_message"
}

fn push_trimmed_text(parts: &mut Vec<String>, value: Option<&str>) {
    if let Some(text) = value.map(str::trim).filter(|value| !value.is_empty()) {
        parts.push(text.to_string());
    }
}

fn collect_text_parts(value: &Value, parts: &mut Vec<String>) {
    match value {
        Value::String(text) => push_trimmed_text(parts, Some(text.as_str())),
        Value::Array(items) => {
            for item in items {
                collect_text_parts(item, parts);
            }
        }
        Value::Object(object) => {
            push_trimmed_text(
                parts,
                object
                    .get("delta")
                    .or_else(|| object.get("text"))
                    .or_else(|| object.get("message"))
                    .or_else(|| object.get("output"))
                    .and_then(Value::as_str),
            );
            if let Some(content) = object.get("content") {
                collect_text_parts(content, parts);
            }
            if let Some(items) = object.get("items") {
                collect_text_parts(items, parts);
            }
            if let Some(parts_value) = object.get("parts") {
                collect_text_parts(parts_value, parts);
            }
        }
        _ => {}
    }
}

pub(super) fn extract_config_options(value: &Value) -> Option<Value> {
    let payload = session_update_payload(value);
    payload.as_object().and_then(|object| {
        object
            .get("configOptions")
            .or_else(|| object.get("config_options"))
            .cloned()
    })
}

pub(super) fn extract_available_commands(value: &Value) -> Option<Value> {
    let payload = session_update_payload(value);
    payload.as_object().and_then(|object| {
        object
            .get("availableCommands")
            .or_else(|| object.get("available_commands"))
            .or_else(|| object.get("commands"))
            .cloned()
    })
}

pub(super) fn extract_prompt_result_text(value: &Value) -> Option<String> {
    let mut parts = Vec::new();
    collect_text_parts(value, &mut parts);
    if parts.is_empty() {
        None
    } else {
        Some(parts.join("\n"))
    }
}

pub(super) fn extract_prompt_stop_reason(value: &Value) -> Option<String> {
    value.as_object().and_then(|object| {
        object
            .get("stopReason")
            .or_else(|| object.get("stop_reason"))
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)
    })
}

pub(super) fn extract_session_update_delta_text(value: &Value) -> Option<String> {
    if !session_update_carries_agent_text(value) {
        return None;
    }
    let mut parts = Vec::new();
    collect_text_parts(session_update_payload(value), &mut parts);
    if parts.is_empty() {
        None
    } else {
        Some(parts.join("\n"))
    }
}
