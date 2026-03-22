use serde_json::Value;

pub(crate) fn distributed_graph_read_string_field(
    record: &serde_json::Map<String, Value>,
    keys: &[&str],
) -> Option<String> {
    for key in keys {
        let Some(value) = record.get(*key) else {
            continue;
        };
        let Some(raw) = value.as_str() else {
            continue;
        };
        let trimmed = raw.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }
    None
}

pub(crate) fn distributed_graph_read_reason_field(
    record: &serde_json::Map<String, Value>,
) -> Option<String> {
    if let Some(reason) = distributed_graph_read_string_field(
        record,
        &[
            "errorMessage",
            "error_message",
            "reason",
            "diagnosticReason",
            "diagnostic_reason",
        ],
    ) {
        return Some(reason);
    }

    if let Some(Value::Object(error)) = record.get("error") {
        return distributed_graph_read_string_field(
            error,
            &["message", "errorMessage", "error_message", "reason"],
        );
    }

    None
}

pub(crate) fn distributed_graph_read_u32_field(
    record: &serde_json::Map<String, Value>,
    keys: &[&str],
) -> Option<u32> {
    for key in keys {
        let Some(value) = record.get(*key) else {
            continue;
        };
        if let Some(number) = value.as_u64() {
            return Some(number.min(u64::from(u32::MAX)) as u32);
        }
        let Some(raw) = value.as_str() else {
            continue;
        };
        let Ok(number) = raw.trim().parse::<u32>() else {
            continue;
        };
        return Some(number);
    }
    None
}

pub(crate) fn distributed_graph_extract_role(record: &serde_json::Map<String, Value>) -> String {
    let Some(Value::Array(steps)) = record.get("steps") else {
        return "router".to_string();
    };
    for step in steps {
        let Some(step_record) = step.as_object() else {
            continue;
        };
        if let Some(role) = distributed_graph_read_string_field(step_record, &["role"]) {
            return role;
        }
    }
    "router".to_string()
}
