use serde_json::Value;

pub(crate) fn trim_to_non_empty(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

pub(crate) fn parse_http_port_from_text(raw: &str) -> Option<u16> {
    let trimmed = raw.trim();
    if let Ok(port) = trimmed.parse::<u16>() {
        return Some(port);
    }
    let digits: String = trimmed.chars().filter(|value| value.is_ascii_digit()).collect();
    digits.parse::<u16>().ok()
}

fn parse_login_status_scalar(value: &Value) -> Option<&'static str> {
    match value {
        Value::Bool(flag) => Some(if *flag { "logged_in" } else { "logged_out" }),
        Value::Number(number) => {
            if number.as_i64() == Some(1) {
                Some("logged_in")
            } else if number.as_i64() == Some(0) {
                Some("logged_out")
            } else {
                None
            }
        }
        Value::String(text) => match text.trim().to_ascii_lowercase().as_str() {
            "true" | "1" | "logged_in" => Some("logged_in"),
            "false" | "0" | "logged_out" => Some("logged_out"),
            _ => None,
        },
        _ => None,
    }
}

fn extract_login_status_from_json(value: &Value) -> Option<&'static str> {
    match value {
        Value::Object(object) => {
            for key in ["islogin", "login"] {
                if let Some(status) = object.get(key).and_then(parse_login_status_scalar) {
                    return Some(status);
                }
            }
            object
                .get("data")
                .and_then(extract_login_status_from_json)
                .or_else(|| object.values().find_map(extract_login_status_from_json))
        }
        Value::Array(entries) => entries.iter().find_map(extract_login_status_from_json),
        _ => None,
    }
}

pub(crate) fn parse_login_status_body(body: &str) -> Option<&'static str> {
    let trimmed = body.trim();
    if trimmed.is_empty() {
        return None;
    }
    if let Ok(payload) = serde_json::from_str::<Value>(trimmed) {
        if let Some(status) = extract_login_status_from_json(&payload) {
            return Some(status);
        }
    }
    let lowered = trimmed.to_ascii_lowercase();
    if lowered.contains("\"islogin\":false") || lowered.contains("\"login\":false") {
        Some("logged_out")
    } else if lowered.contains("\"islogin\":true") || lowered.contains("\"login\":true") {
        Some("logged_in")
    } else if lowered == "true" {
        Some("logged_in")
    } else if lowered == "false" {
        Some("logged_out")
    } else {
        None
    }
}

pub(crate) fn normalize_qr_output_mode(value: Option<&str>) -> &'static str {
    match value.map(str::trim) {
        Some("terminal") => "terminal",
        Some("base64") => "base64",
        Some("image") => "image",
        _ => "none",
    }
}

pub(crate) fn normalize_info_output_mode(value: Option<&str>) -> &'static str {
    match value.map(str::trim) {
        Some("inline") => "inline",
        _ => "none",
    }
}
