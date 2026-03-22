use std::time::{Duration, SystemTime};

use reqwest::header::{HeaderMap, RETRY_AFTER};
use reqwest::StatusCode;
use serde_json::Value;

pub(crate) const UPSTREAM_ERROR_BODY_SNIPPET_MAX_CHARS: usize = 240;

pub(crate) fn extract_openai_error_message(payload: &Value, fallback: &str) -> String {
    payload
        .get("error")
        .and_then(Value::as_object)
        .and_then(|error| error.get("message"))
        .and_then(Value::as_str)
        .filter(|message| !message.trim().is_empty())
        .unwrap_or(fallback)
        .to_string()
}

pub(crate) fn build_upstream_error_message(
    payload: Option<&Value>,
    raw_body: &[u8],
    status: StatusCode,
    fallback: &str,
) -> String {
    if let Some(payload) = payload {
        let parsed = extract_openai_error_message(payload, fallback);
        if parsed != fallback {
            return parsed;
        }
    }

    if let Some(snippet) = normalize_error_body_snippet(raw_body) {
        return format!("{fallback} (status {}): {snippet}", status.as_u16());
    }

    fallback.to_string()
}

pub(crate) fn normalize_error_body_snippet(raw_body: &[u8]) -> Option<String> {
    let raw_body = String::from_utf8_lossy(raw_body);
    let compact = raw_body
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string();
    if compact.is_empty() {
        return None;
    }
    Some(truncate_chars_with_ascii_ellipsis(
        compact.as_str(),
        UPSTREAM_ERROR_BODY_SNIPPET_MAX_CHARS,
    ))
}

fn truncate_chars_with_ascii_ellipsis(value: &str, max_chars: usize) -> String {
    if max_chars == 0 {
        return String::new();
    }
    let value_len = value.chars().count();
    if value_len <= max_chars {
        return value.to_string();
    }
    if max_chars <= 3 {
        return value.chars().take(max_chars).collect();
    }
    let mut truncated = value.chars().take(max_chars - 3).collect::<String>();
    truncated.push_str("...");
    truncated
}

pub(crate) fn should_retry_transport_error(
    attempt: u32,
    max_retries: u32,
    error: &reqwest::Error,
) -> bool {
    attempt < max_retries
        && (error.is_timeout()
            || error.is_connect()
            || error.is_request()
            || error.is_body()
            || error.is_decode())
}

pub(crate) fn should_retry_status_code(status: StatusCode, attempt: u32, max_retries: u32) -> bool {
    attempt < max_retries && (status == StatusCode::TOO_MANY_REQUESTS || status.is_server_error())
}

pub(crate) fn retry_after_ms_from_headers(headers: &HeaderMap) -> Option<u64> {
    headers
        .get(RETRY_AFTER)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .and_then(|value| parse_retry_after_ms(value, SystemTime::now()))
}

pub(crate) fn parse_retry_after_ms(value: &str, now: SystemTime) -> Option<u64> {
    if value.is_empty() {
        return None;
    }

    if let Ok(seconds) = value.parse::<u64>() {
        return Some(seconds.saturating_mul(1000));
    }

    let retry_at = httpdate::parse_http_date(value).ok()?;
    let wait = retry_at
        .duration_since(now)
        .unwrap_or_else(|_| Duration::from_secs(0));
    Some(duration_millis_u64(wait))
}

fn duration_millis_u64(duration: Duration) -> u64 {
    u64::try_from(duration.as_millis()).unwrap_or(u64::MAX)
}

pub(crate) fn retry_backoff_ms(
    base_ms: u64,
    attempt: u32,
    retry_after_ms: Option<u64>,
    max_delay_ms: u64,
) -> u64 {
    let exponent = attempt.min(8);
    let factor = 1_u64.checked_shl(exponent).unwrap_or(1);
    let base_backoff_ms = base_ms.saturating_mul(factor);
    let jitter_budget_ms = (base_backoff_ms / 5).max(1);
    let jitter_ms = rand::random::<u64>() % (jitter_budget_ms + 1);
    let computed_ms = base_backoff_ms.saturating_add(jitter_ms);
    let bounded_ms = match retry_after_ms {
        Some(retry_after_ms) => computed_ms.max(retry_after_ms),
        None => computed_ms,
    };
    bounded_ms.min(max_delay_ms.max(1))
}
