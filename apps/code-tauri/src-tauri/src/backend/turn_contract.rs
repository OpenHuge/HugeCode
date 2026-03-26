#![allow(dead_code)]

use crate::models::TurnAck;

pub(crate) fn fallback_error_message(error: &str) -> String {
    let trimmed = error.trim();
    if trimmed.is_empty() {
        "unknown fallback error".to_string()
    } else {
        trimmed.to_string()
    }
}

pub(crate) fn normalize_provider_hint(value: Option<&str>) -> Option<String> {
    canonicalize_provider_alias(value)
}

pub(crate) fn normalize_model_id(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|model_id| !model_id.is_empty())
        .map(std::borrow::ToOwned::to_owned)
}

pub(crate) fn is_supported_turn_provider(provider: &str) -> bool {
    canonicalize_provider_alias(Some(provider)).is_some()
}

pub(crate) fn infer_provider_from_model_id(model_id: &str) -> Option<&'static str> {
    let normalized = model_id.trim().to_ascii_lowercase();
    let compact = normalized.replace('-', "").replace('_', "");
    if normalized.is_empty() {
        return None;
    }
    if normalized.contains("claude") {
        return Some("anthropic");
    }
    if normalized.contains("gemini") {
        return Some("google");
    }
    if normalized.contains("antigravity") || compact.contains("antigravity") {
        return Some("google");
    }
    if normalized.contains("gpt")
        || normalized.contains("codex")
        || normalized.contains("o1")
        || normalized.contains("o3")
        || normalized.contains("o4")
    {
        return Some("openai");
    }
    None
}

fn canonicalize_provider_alias(value: Option<&str>) -> Option<String> {
    let normalized = value?.trim().to_ascii_lowercase();
    if normalized.is_empty() {
        return None;
    }

    let canonical = match normalized.as_str() {
        "openai" | "codex" | "openai-codex" => "openai",
        "anthropic" | "claude" | "claude_code" | "claude-code" => "anthropic",
        "claude_code_local" => "claude_code_local",
        "google" | "gemini" | "antigravity" | "anti-gravity" | "gemini-antigravity" => "google",
        _ => return None,
    };
    Some(canonical.to_string())
}

pub(crate) fn invalid_turn_ack(
    thread_id: Option<String>,
    provider: Option<String>,
    model_id: Option<String>,
    message: String,
) -> TurnAck {
    TurnAck {
        accepted: false,
        turn_id: None,
        thread_id,
        routed_provider: provider,
        routed_model_id: model_id,
        routed_pool: None,
        routed_source: None,
        message,
    }
}

pub(crate) fn build_route_failure_message(
    requested_model_id: Option<&str>,
    route_failures: &[String],
) -> String {
    let requested = requested_model_id
        .map(str::trim)
        .filter(|model_id| !model_id.is_empty())
        .unwrap_or("auto");

    if route_failures.is_empty() {
        return format!("No candidate route succeeded for requested model '{requested}'.",);
    }

    format!(
        "No candidate route succeeded for requested model '{requested}'. Attempts: {}",
        route_failures.join(" | ")
    )
}

#[cfg(test)]
mod tests {
    use super::{
        infer_provider_from_model_id, is_supported_turn_provider, normalize_provider_hint,
    };

    #[test]
    fn normalize_provider_hint_maps_antigravity_aliases_to_google() {
        assert_eq!(
            normalize_provider_hint(Some("antigravity")),
            Some("google".to_string())
        );
        assert_eq!(
            normalize_provider_hint(Some("anti-gravity")),
            Some("google".to_string())
        );
        assert_eq!(
            normalize_provider_hint(Some("gemini-antigravity")),
            Some("google".to_string())
        );
    }

    #[test]
    fn supported_provider_check_accepts_google_aliases() {
        assert!(is_supported_turn_provider("google"));
        assert!(is_supported_turn_provider("gemini"));
        assert!(is_supported_turn_provider("antigravity"));
        assert!(is_supported_turn_provider("anti-gravity"));
        assert!(!is_supported_turn_provider("foo-ai"));
    }

    #[test]
    fn infer_provider_from_model_id_maps_antigravity_model_to_google() {
        assert_eq!(infer_provider_from_model_id("antigravity"), Some("google"));
        assert_eq!(infer_provider_from_model_id("anti-gravity"), Some("google"));
    }
}
