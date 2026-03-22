use super::*;

fn build_tool_inspector_value(inspector: &ToolInspectorMetadata) -> Value {
    let mut inspector_object = serde_json::Map::from_iter([(
        "decision".to_string(),
        Value::String(inspector.decision.clone()),
    )]);
    if let Some(reason) = inspector
        .reason
        .as_ref()
        .filter(|value| !value.trim().is_empty())
    {
        inspector_object.insert("reason".to_string(), Value::String(reason.clone()));
    }
    if let Some(rule_id) = inspector
        .rule_id
        .as_ref()
        .filter(|value| !value.trim().is_empty())
    {
        inspector_object.insert("ruleId".to_string(), Value::String(rule_id.clone()));
    }
    Value::Object(inspector_object)
}

pub(in crate::agent_tasks::execution::runner) fn apply_tool_inspector_metadata(
    metadata: &mut Value,
    inspector: &ToolInspectorMetadata,
) {
    if let Some(metadata_object) = metadata.as_object_mut() {
        metadata_object.insert(
            "inspectorDecision".to_string(),
            Value::String(inspector.decision.clone()),
        );
        if let Some(reason) = inspector
            .reason
            .as_ref()
            .filter(|value| !value.trim().is_empty())
        {
            metadata_object.insert("inspectorReason".to_string(), Value::String(reason.clone()));
        }
        if let Some(rule_id) = inspector
            .rule_id
            .as_ref()
            .filter(|value| !value.trim().is_empty())
        {
            metadata_object.insert("ruleId".to_string(), Value::String(rule_id.clone()));
        }
        metadata_object.insert(
            "inspector".to_string(),
            build_tool_inspector_value(inspector),
        );
        return;
    }
    let mut metadata_object = serde_json::Map::new();
    metadata_object.insert(
        "inspectorDecision".to_string(),
        Value::String(inspector.decision.clone()),
    );
    if let Some(reason) = inspector
        .reason
        .as_ref()
        .filter(|value| !value.trim().is_empty())
    {
        metadata_object.insert("inspectorReason".to_string(), Value::String(reason.clone()));
    }
    if let Some(rule_id) = inspector
        .rule_id
        .as_ref()
        .filter(|value| !value.trim().is_empty())
    {
        metadata_object.insert("ruleId".to_string(), Value::String(rule_id.clone()));
    }
    metadata_object.insert(
        "inspector".to_string(),
        build_tool_inspector_value(inspector),
    );
    *metadata = Value::Object(metadata_object);
}

pub(in crate::agent_tasks::execution::runner) fn apply_step_observability_to_tool_result_payload(
    payload: &mut Value,
    metadata: &Value,
) {
    let Some(payload_object) = payload.as_object_mut() else {
        return;
    };
    let Some(item) = payload_object
        .get_mut("item")
        .and_then(Value::as_object_mut)
    else {
        return;
    };

    let mut event_metadata = serde_json::Map::new();
    for key in ["toolCapabilities", "approval", "inspector", "safety"] {
        if let Some(value) = metadata.get(key).filter(|value| !value.is_null()) {
            event_metadata.insert(key.to_string(), value.clone());
        }
    }
    if event_metadata.is_empty() {
        return;
    }
    let event_metadata_value = Value::Object(event_metadata);
    item.insert("metadata".to_string(), event_metadata_value.clone());
    if let Some(arguments) = item.get_mut("arguments").and_then(Value::as_object_mut) {
        arguments.insert("metadata".to_string(), event_metadata_value);
    }
}

pub(in crate::agent_tasks::execution::runner) fn apply_tool_inspector_to_tool_result_payload(
    payload: &mut Value,
    inspector: &ToolInspectorMetadata,
) {
    let Some(payload_object) = payload.as_object_mut() else {
        return;
    };
    let Some(item) = payload_object
        .get_mut("item")
        .and_then(Value::as_object_mut)
    else {
        return;
    };
    item.insert(
        "inspectorDecision".to_string(),
        Value::String(inspector.decision.clone()),
    );
    if let Some(reason) = inspector
        .reason
        .as_ref()
        .filter(|value| !value.trim().is_empty())
    {
        item.insert("inspectorReason".to_string(), Value::String(reason.clone()));
    }
    if let Some(rule_id) = inspector
        .rule_id
        .as_ref()
        .filter(|value| !value.trim().is_empty())
    {
        item.insert("ruleId".to_string(), Value::String(rule_id.clone()));
    }
    item.insert(
        "inspector".to_string(),
        build_tool_inspector_value(inspector),
    );
    if let Some(arguments) = item.get_mut("arguments").and_then(Value::as_object_mut) {
        arguments.insert(
            "inspectorDecision".to_string(),
            Value::String(inspector.decision.clone()),
        );
        if let Some(reason) = inspector
            .reason
            .as_ref()
            .filter(|value| !value.trim().is_empty())
        {
            arguments.insert("inspectorReason".to_string(), Value::String(reason.clone()));
        }
        if let Some(rule_id) = inspector
            .rule_id
            .as_ref()
            .filter(|value| !value.trim().is_empty())
        {
            arguments.insert("ruleId".to_string(), Value::String(rule_id.clone()));
        }
        arguments.insert(
            "inspector".to_string(),
            build_tool_inspector_value(inspector),
        );
    }
}
