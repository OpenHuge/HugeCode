use serde_json::Value;

use super::RpcError;

pub(super) fn as_object(value: &Value) -> Result<&serde_json::Map<String, Value>, RpcError> {
    value
        .as_object()
        .ok_or_else(|| RpcError::invalid_params("RPC params must be a JSON object."))
}

pub(super) fn read_required_string<'a>(
    params: &'a serde_json::Map<String, Value>,
    field: &str,
) -> Result<&'a str, RpcError> {
    read_string_candidate(params, field)
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .ok_or_else(|| RpcError::invalid_params(format!("Missing required string field: {field}")))
}

pub(super) fn read_optional_string(
    params: &serde_json::Map<String, Value>,
    field: &str,
) -> Option<String> {
    read_string_candidate(params, field)
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(ToOwned::to_owned)
}

fn read_string_candidate<'a>(
    params: &'a serde_json::Map<String, Value>,
    field: &str,
) -> Option<&'a str> {
    read_value_candidate(params, field).and_then(Value::as_str)
}

pub(super) fn read_optional_bool(
    params: &serde_json::Map<String, Value>,
    field: &str,
) -> Option<bool> {
    read_value_candidate(params, field).and_then(Value::as_bool)
}

pub(super) fn read_optional_i32(
    params: &serde_json::Map<String, Value>,
    field: &str,
) -> Option<i32> {
    read_value_candidate(params, field)
        .and_then(Value::as_i64)
        .and_then(|value| i32::try_from(value).ok())
}

pub(super) fn read_optional_u64(
    params: &serde_json::Map<String, Value>,
    field: &str,
) -> Option<u64> {
    read_value_candidate(params, field).and_then(Value::as_u64)
}

fn read_value_candidate<'a>(
    params: &'a serde_json::Map<String, Value>,
    field: &str,
) -> Option<&'a Value> {
    params.get(field).or_else(|| {
        let alternate = alternate_field_name(field)?;
        params.get(&alternate)
    })
}

fn alternate_field_name(field: &str) -> Option<String> {
    if field.contains('_') {
        return Some(snake_to_camel(field));
    }
    if field.chars().any(|ch| ch.is_ascii_uppercase()) {
        return Some(camel_to_snake(field));
    }
    None
}

pub(crate) fn snake_to_camel(input: &str) -> String {
    let mut output = String::with_capacity(input.len());
    let mut uppercase_next = false;
    for ch in input.chars() {
        if ch == '_' {
            uppercase_next = true;
            continue;
        }
        if uppercase_next {
            output.push(ch.to_ascii_uppercase());
            uppercase_next = false;
        } else {
            output.push(ch);
        }
    }
    output
}

fn camel_to_snake(input: &str) -> String {
    let mut output = String::with_capacity(input.len() + 4);
    for ch in input.chars() {
        if ch.is_ascii_uppercase() {
            output.push('_');
            output.push(ch.to_ascii_lowercase());
        } else {
            output.push(ch);
        }
    }
    output
}
