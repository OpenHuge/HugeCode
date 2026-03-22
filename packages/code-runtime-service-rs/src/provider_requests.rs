use std::{
    sync::Arc,
    time::{Duration, Instant},
};

use serde_json::{json, Value};
use tracing::warn;

use crate::provider_request_retry::{
    build_upstream_error_message, retry_after_ms_from_headers, retry_backoff_ms,
    should_retry_status_code, should_retry_transport_error,
};
#[cfg(test)]
use crate::provider_request_retry::{
    normalize_error_body_snippet, parse_retry_after_ms, UPSTREAM_ERROR_BODY_SNIPPET_MAX_CHARS,
};
use crate::ServiceConfig;

pub(crate) use crate::provider_request_retry::extract_openai_error_message;

mod chatgpt;

const CHATGPT_CODEX_RESPONSES_ENDPOINT: &str = "https://chatgpt.com/backend-api/codex/responses";
const CHATGPT_CODEX_USAGE_ENDPOINT: &str = "https://chatgpt.com/backend-api/wham/usage";
const CHATGPT_CODEX_ACCOUNTS_CHECK_ENDPOINT: &str =
    "https://chatgpt.com/backend-api/wham/accounts/check";
const CODE_RUNTIME_SERVICE_CHATGPT_SSE_BUFFER_MAX_BYTES_ENV: &str =
    "CODE_RUNTIME_SERVICE_CHATGPT_SSE_BUFFER_MAX_BYTES";
const CODE_RUNTIME_SERVICE_CHATGPT_SSE_FRAME_MAX_BYTES_ENV: &str =
    "CODE_RUNTIME_SERVICE_CHATGPT_SSE_FRAME_MAX_BYTES";
const CODE_RUNTIME_SERVICE_PROVIDER_MAX_ELAPSED_MS_ENV: &str =
    "CODE_RUNTIME_SERVICE_PROVIDER_MAX_ELAPSED_MS";
const DEFAULT_CHATGPT_SSE_BUFFER_MAX_BYTES: usize = 1_048_576;
const MIN_CHATGPT_SSE_BUFFER_MAX_BYTES: usize = 65_536;
const MAX_CHATGPT_SSE_BUFFER_MAX_BYTES: usize = 16_777_216;
const DEFAULT_CHATGPT_SSE_FRAME_MAX_BYTES: usize = 262_144;
const MIN_CHATGPT_SSE_FRAME_MAX_BYTES: usize = 4_096;
const MAX_CHATGPT_SSE_FRAME_MAX_BYTES: usize = 4_194_304;
const DEFAULT_PROVIDER_MAX_ELAPSED_MS: u64 = 180_000;
const MIN_PROVIDER_MAX_ELAPSED_MS: u64 = 1_000;
const MAX_PROVIDER_MAX_ELAPSED_MS: u64 = 900_000;

pub(crate) type ProviderDeltaCallback = Arc<dyn Fn(String) + Send + Sync>;

fn resolve_chatgpt_sse_buffer_max_bytes() -> usize {
    std::env::var(CODE_RUNTIME_SERVICE_CHATGPT_SSE_BUFFER_MAX_BYTES_ENV)
        .ok()
        .and_then(|value| value.trim().parse::<usize>().ok())
        .map(|value| {
            value.clamp(
                MIN_CHATGPT_SSE_BUFFER_MAX_BYTES,
                MAX_CHATGPT_SSE_BUFFER_MAX_BYTES,
            )
        })
        .unwrap_or(DEFAULT_CHATGPT_SSE_BUFFER_MAX_BYTES)
}

fn resolve_chatgpt_sse_frame_max_bytes() -> usize {
    std::env::var(CODE_RUNTIME_SERVICE_CHATGPT_SSE_FRAME_MAX_BYTES_ENV)
        .ok()
        .and_then(|value| value.trim().parse::<usize>().ok())
        .map(|value| {
            value.clamp(
                MIN_CHATGPT_SSE_FRAME_MAX_BYTES,
                MAX_CHATGPT_SSE_FRAME_MAX_BYTES,
            )
        })
        .unwrap_or(DEFAULT_CHATGPT_SSE_FRAME_MAX_BYTES)
}

fn resolve_provider_max_elapsed_ms() -> u64 {
    std::env::var(CODE_RUNTIME_SERVICE_PROVIDER_MAX_ELAPSED_MS_ENV)
        .ok()
        .and_then(|value| value.trim().parse::<u64>().ok())
        .map(|value| {
            if value == 0 {
                0
            } else {
                value.clamp(MIN_PROVIDER_MAX_ELAPSED_MS, MAX_PROVIDER_MAX_ELAPSED_MS)
            }
        })
        .unwrap_or(DEFAULT_PROVIDER_MAX_ELAPSED_MS)
}

fn provider_elapsed_budget_exhausted(started_at: Instant, max_elapsed_ms: u64) -> bool {
    if max_elapsed_ms == 0 {
        return false;
    }
    started_at.elapsed().as_millis().min(u128::from(u64::MAX)) as u64 >= max_elapsed_ms
}

pub(crate) async fn query_openai(
    client: &reqwest::Client,
    config: &ServiceConfig,
    api_key_override: Option<&str>,
    content: &str,
    model_id: &str,
    reason_effort: Option<&str>,
    service_tier: Option<&str>,
) -> Result<String, String> {
    let api_key = api_key_override.or(config.openai_api_key.as_deref());
    let Some(api_key) = api_key else {
        return Err("OPENAI_API_KEY is not configured for code-runtime-service-rs.".to_string());
    };

    let mut request_body = json!({
        "model": model_id,
        "input": content
    });

    if let Some(effort) = reason_effort {
        let normalized = if effort == "xhigh" { "high" } else { effort };
        request_body["reasoning"] = json!({ "effort": normalized });
    }
    if matches!(service_tier, Some("fast")) {
        request_body["service_tier"] = json!("priority");
    }

    let request_started_at = Instant::now();
    let provider_max_elapsed_ms = resolve_provider_max_elapsed_ms();
    for attempt in 0..=config.openai_max_retries {
        if provider_elapsed_budget_exhausted(request_started_at, provider_max_elapsed_ms) {
            return Err(format!(
                "OpenAI request exceeded provider elapsed budget of {provider_max_elapsed_ms}ms."
            ));
        }
        let send_result = client
            .post(&config.openai_endpoint)
            .bearer_auth(api_key)
            .json(&request_body)
            .send()
            .await;

        let response = match send_result {
            Ok(response) => response,
            Err(error) => {
                let message = format!("OpenAI request failed: {error}");
                if should_retry_transport_error(attempt, config.openai_max_retries, &error) {
                    let backoff_ms = retry_backoff_ms(
                        config.openai_retry_base_ms,
                        attempt,
                        None,
                        config.openai_timeout_ms,
                    );
                    warn!(
                        attempt = attempt + 1,
                        max_attempts = config.openai_max_retries + 1,
                        backoff_ms,
                        error = message.as_str(),
                        "retrying OpenAI request after transport failure"
                    );
                    if provider_elapsed_budget_exhausted(
                        request_started_at,
                        provider_max_elapsed_ms,
                    ) {
                        return Err(format!(
                            "OpenAI request exceeded provider elapsed budget of {provider_max_elapsed_ms}ms."
                        ));
                    }
                    tokio::time::sleep(Duration::from_millis(backoff_ms)).await;
                    continue;
                }
                return Err(message);
            }
        };

        let status = response.status();
        let retry_after_ms = retry_after_ms_from_headers(response.headers());
        let body = match response.bytes().await {
            Ok(body) => body,
            Err(error) => {
                let message = format!("Failed to read OpenAI response body: {error}");
                if should_retry_transport_error(attempt, config.openai_max_retries, &error) {
                    let backoff_ms = retry_backoff_ms(
                        config.openai_retry_base_ms,
                        attempt,
                        None,
                        config.openai_timeout_ms,
                    );
                    warn!(
                        attempt = attempt + 1,
                        max_attempts = config.openai_max_retries + 1,
                        backoff_ms,
                        error = message.as_str(),
                        "retrying OpenAI request after response body read failure"
                    );
                    if provider_elapsed_budget_exhausted(
                        request_started_at,
                        provider_max_elapsed_ms,
                    ) {
                        return Err(format!(
                            "OpenAI request exceeded provider elapsed budget of {provider_max_elapsed_ms}ms."
                        ));
                    }
                    tokio::time::sleep(Duration::from_millis(backoff_ms)).await;
                    continue;
                }
                return Err(message);
            }
        };
        let payload = serde_json::from_slice::<Value>(body.as_ref());

        if !status.is_success() {
            let message = build_upstream_error_message(
                payload.as_ref().ok(),
                body.as_ref(),
                status,
                "OpenAI request failed.",
            );
            if should_retry_status_code(status, attempt, config.openai_max_retries) {
                let backoff_ms = retry_backoff_ms(
                    config.openai_retry_base_ms,
                    attempt,
                    retry_after_ms,
                    config.openai_timeout_ms,
                );
                warn!(
                    attempt = attempt + 1,
                    max_attempts = config.openai_max_retries + 1,
                    backoff_ms,
                    retry_after_ms,
                    status = status.as_u16(),
                    error = message.as_str(),
                    "retrying OpenAI request after upstream error"
                );
                if provider_elapsed_budget_exhausted(request_started_at, provider_max_elapsed_ms) {
                    return Err(format!(
                        "OpenAI request exceeded provider elapsed budget of {provider_max_elapsed_ms}ms."
                    ));
                }
                tokio::time::sleep(Duration::from_millis(backoff_ms)).await;
                continue;
            }
            return Err(message);
        }
        let payload =
            payload.map_err(|error| format!("Failed to parse OpenAI response: {error}"))?;

        if let Some(text) = extract_output_text(&payload) {
            return Ok(text);
        }

        return Err("OpenAI response did not include text output.".to_string());
    }

    Err("OpenAI request retry budget exhausted.".to_string())
}

pub(crate) async fn query_chatgpt_codex_responses(
    client: &reqwest::Client,
    config: &ServiceConfig,
    access_token: &str,
    content: &str,
    model_id: &str,
    reason_effort: Option<&str>,
    service_tier: Option<&str>,
    account_id: Option<&str>,
    delta_callback: Option<ProviderDeltaCallback>,
) -> Result<String, String> {
    query_chatgpt_codex_responses_with_endpoint(
        client,
        config,
        CHATGPT_CODEX_RESPONSES_ENDPOINT,
        access_token,
        content,
        model_id,
        reason_effort,
        service_tier,
        account_id,
        delta_callback,
    )
    .await
}

pub(crate) async fn query_chatgpt_codex_usage(
    client: &reqwest::Client,
    config: &ServiceConfig,
    access_token: &str,
    account_id: Option<&str>,
) -> Result<Value, String> {
    query_chatgpt_codex_usage_with_endpoint(
        client,
        config,
        CHATGPT_CODEX_USAGE_ENDPOINT,
        access_token,
        account_id,
    )
    .await
}

pub(crate) async fn query_chatgpt_codex_accounts_check(
    client: &reqwest::Client,
    config: &ServiceConfig,
    access_token: &str,
    account_id: Option<&str>,
) -> Result<Value, String> {
    query_chatgpt_codex_accounts_check_with_endpoint(
        client,
        config,
        CHATGPT_CODEX_ACCOUNTS_CHECK_ENDPOINT,
        access_token,
        account_id,
    )
    .await
}

async fn query_chatgpt_codex_responses_with_endpoint(
    client: &reqwest::Client,
    config: &ServiceConfig,
    endpoint: &str,
    access_token: &str,
    content: &str,
    model_id: &str,
    reason_effort: Option<&str>,
    service_tier: Option<&str>,
    account_id: Option<&str>,
    delta_callback: Option<ProviderDeltaCallback>,
) -> Result<String, String> {
    chatgpt::query_chatgpt_codex_responses_with_endpoint(
        client,
        config,
        endpoint,
        access_token,
        content,
        model_id,
        reason_effort,
        service_tier,
        account_id,
        delta_callback,
    )
    .await
}

async fn query_chatgpt_codex_usage_with_endpoint(
    client: &reqwest::Client,
    config: &ServiceConfig,
    endpoint: &str,
    access_token: &str,
    account_id: Option<&str>,
) -> Result<Value, String> {
    chatgpt::query_chatgpt_codex_usage_with_endpoint(
        client,
        config,
        endpoint,
        access_token,
        account_id,
    )
    .await
}

async fn query_chatgpt_codex_accounts_check_with_endpoint(
    client: &reqwest::Client,
    config: &ServiceConfig,
    endpoint: &str,
    access_token: &str,
    account_id: Option<&str>,
) -> Result<Value, String> {
    chatgpt::query_chatgpt_codex_accounts_check_with_endpoint(
        client,
        config,
        endpoint,
        access_token,
        account_id,
    )
    .await
}
pub(crate) async fn query_openai_compat_chat(
    client: &reqwest::Client,
    config: &ServiceConfig,
    base_url: &str,
    api_key: &str,
    content: &str,
    model_id: &str,
    reason_effort: Option<&str>,
    service_tier: Option<&str>,
) -> Result<String, String> {
    let endpoint = build_openai_compat_endpoint(base_url, "chat/completions")?;
    let mut request_body = json!({
        "model": model_id,
        "messages": [{
            "role": "user",
            "content": content
        }]
    });

    if let Some(effort) = reason_effort {
        let normalized = if effort == "xhigh" { "high" } else { effort };
        request_body["reasoning"] = json!({ "effort": normalized });
    }
    if matches!(service_tier, Some("fast")) {
        request_body["service_tier"] = json!("priority");
    }

    for attempt in 0..=config.openai_max_retries {
        let send_result = client
            .post(endpoint.as_str())
            .bearer_auth(api_key)
            .json(&request_body)
            .send()
            .await;

        let response = match send_result {
            Ok(response) => response,
            Err(error) => {
                let message = format!("OpenAI-compat chat request failed: {error}");
                if should_retry_transport_error(attempt, config.openai_max_retries, &error) {
                    let backoff_ms = retry_backoff_ms(
                        config.openai_retry_base_ms,
                        attempt,
                        None,
                        config.openai_timeout_ms,
                    );
                    warn!(
                        attempt = attempt + 1,
                        max_attempts = config.openai_max_retries + 1,
                        backoff_ms,
                        error = message.as_str(),
                        "retrying OpenAI-compat chat request after transport failure"
                    );
                    tokio::time::sleep(Duration::from_millis(backoff_ms)).await;
                    continue;
                }
                return Err(message);
            }
        };

        let status = response.status();
        let retry_after_ms = retry_after_ms_from_headers(response.headers());
        let body = match response.bytes().await {
            Ok(body) => body,
            Err(error) => {
                let message = format!("Failed to read OpenAI-compat chat response body: {error}");
                if should_retry_transport_error(attempt, config.openai_max_retries, &error) {
                    let backoff_ms = retry_backoff_ms(
                        config.openai_retry_base_ms,
                        attempt,
                        None,
                        config.openai_timeout_ms,
                    );
                    warn!(
                        attempt = attempt + 1,
                        max_attempts = config.openai_max_retries + 1,
                        backoff_ms,
                        error = message.as_str(),
                        "retrying OpenAI-compat chat request after response body read failure"
                    );
                    tokio::time::sleep(Duration::from_millis(backoff_ms)).await;
                    continue;
                }
                return Err(message);
            }
        };
        let payload = serde_json::from_slice::<Value>(body.as_ref());

        if !status.is_success() {
            let message = build_upstream_error_message(
                payload.as_ref().ok(),
                body.as_ref(),
                status,
                "OpenAI-compat chat failed.",
            );
            if should_retry_status_code(status, attempt, config.openai_max_retries) {
                let backoff_ms = retry_backoff_ms(
                    config.openai_retry_base_ms,
                    attempt,
                    retry_after_ms,
                    config.openai_timeout_ms,
                );
                warn!(
                    attempt = attempt + 1,
                    max_attempts = config.openai_max_retries + 1,
                    backoff_ms,
                    retry_after_ms,
                    status = status.as_u16(),
                    error = message.as_str(),
                    "retrying OpenAI-compat chat request after upstream error"
                );
                tokio::time::sleep(Duration::from_millis(backoff_ms)).await;
                continue;
            }
            return Err(message);
        }
        let payload = payload
            .map_err(|error| format!("Failed to parse OpenAI-compat chat response: {error}"))?;

        if let Some(text) = extract_chat_completions_text(&payload) {
            return Ok(text);
        }
        return Err("OpenAI-compat chat response did not include text output.".to_string());
    }

    Err("OpenAI-compat chat retry budget exhausted.".to_string())
}

pub(crate) async fn query_anthropic(
    client: &reqwest::Client,
    config: &ServiceConfig,
    api_key_override: Option<&str>,
    content: &str,
    model_id: &str,
) -> Result<String, String> {
    let api_key = api_key_override.or(config.anthropic_api_key.as_deref());
    let Some(api_key) = api_key else {
        return Err("ANTHROPIC_API_KEY is not configured for code-runtime-service-rs.".to_string());
    };

    let request_body = json!({
        "model": model_id,
        "max_tokens": 2048,
        "messages": [{
            "role": "user",
            "content": [{
                "type": "text",
                "text": content
            }]
        }]
    });

    for attempt in 0..=config.openai_max_retries {
        let send_result = client
            .post(config.anthropic_endpoint.as_str())
            .header("x-api-key", api_key)
            .header("anthropic-version", config.anthropic_version.as_str())
            .json(&request_body)
            .send()
            .await;

        let response = match send_result {
            Ok(response) => response,
            Err(error) => {
                let message = format!("Anthropic request failed: {error}");
                if should_retry_transport_error(attempt, config.openai_max_retries, &error) {
                    let backoff_ms = retry_backoff_ms(
                        config.openai_retry_base_ms,
                        attempt,
                        None,
                        config.openai_timeout_ms,
                    );
                    warn!(
                        attempt = attempt + 1,
                        max_attempts = config.openai_max_retries + 1,
                        backoff_ms,
                        error = message.as_str(),
                        "retrying Anthropic request after transport failure"
                    );
                    tokio::time::sleep(Duration::from_millis(backoff_ms)).await;
                    continue;
                }
                return Err(message);
            }
        };

        let status = response.status();
        let retry_after_ms = retry_after_ms_from_headers(response.headers());
        let body = match response.bytes().await {
            Ok(body) => body,
            Err(error) => {
                let message = format!("Failed to read Anthropic response body: {error}");
                if should_retry_transport_error(attempt, config.openai_max_retries, &error) {
                    let backoff_ms = retry_backoff_ms(
                        config.openai_retry_base_ms,
                        attempt,
                        None,
                        config.openai_timeout_ms,
                    );
                    warn!(
                        attempt = attempt + 1,
                        max_attempts = config.openai_max_retries + 1,
                        backoff_ms,
                        error = message.as_str(),
                        "retrying Anthropic request after response body read failure"
                    );
                    tokio::time::sleep(Duration::from_millis(backoff_ms)).await;
                    continue;
                }
                return Err(message);
            }
        };
        let payload = serde_json::from_slice::<Value>(body.as_ref());

        if !status.is_success() {
            let message = build_upstream_error_message(
                payload.as_ref().ok(),
                body.as_ref(),
                status,
                "Anthropic request failed.",
            );
            if should_retry_status_code(status, attempt, config.openai_max_retries) {
                let backoff_ms = retry_backoff_ms(
                    config.openai_retry_base_ms,
                    attempt,
                    retry_after_ms,
                    config.openai_timeout_ms,
                );
                warn!(
                    attempt = attempt + 1,
                    max_attempts = config.openai_max_retries + 1,
                    backoff_ms,
                    retry_after_ms,
                    status = status.as_u16(),
                    error = message.as_str(),
                    "retrying Anthropic request after upstream error"
                );
                tokio::time::sleep(Duration::from_millis(backoff_ms)).await;
                continue;
            }
            return Err(message);
        }
        let payload =
            payload.map_err(|error| format!("Failed to parse Anthropic response: {error}"))?;

        if let Some(text) = extract_anthropic_text(&payload) {
            return Ok(text);
        }
        return Err("Anthropic response did not include text output.".to_string());
    }

    Err("Anthropic request retry budget exhausted.".to_string())
}

pub(crate) async fn query_google(
    client: &reqwest::Client,
    config: &ServiceConfig,
    api_key_override: Option<&str>,
    content: &str,
    model_id: &str,
) -> Result<String, String> {
    let api_key = api_key_override.or(config.gemini_api_key.as_deref());
    let Some(api_key) = api_key else {
        return Err("GEMINI_API_KEY is not configured for code-runtime-service-rs.".to_string());
    };

    let endpoint =
        build_google_generate_content_endpoint(config.gemini_endpoint.as_str(), model_id, api_key)?;
    let request_body = json!({
        "contents": [{
            "role": "user",
            "parts": [{
                "text": content
            }]
        }]
    });

    for attempt in 0..=config.openai_max_retries {
        let send_result = client
            .post(endpoint.clone())
            .json(&request_body)
            .send()
            .await;

        let response = match send_result {
            Ok(response) => response,
            Err(error) => {
                let message = format!("Gemini request failed: {error}");
                if should_retry_transport_error(attempt, config.openai_max_retries, &error) {
                    let backoff_ms = retry_backoff_ms(
                        config.openai_retry_base_ms,
                        attempt,
                        None,
                        config.openai_timeout_ms,
                    );
                    warn!(
                        attempt = attempt + 1,
                        max_attempts = config.openai_max_retries + 1,
                        backoff_ms,
                        error = message.as_str(),
                        "retrying Gemini request after transport failure"
                    );
                    tokio::time::sleep(Duration::from_millis(backoff_ms)).await;
                    continue;
                }
                return Err(message);
            }
        };

        let status = response.status();
        let retry_after_ms = retry_after_ms_from_headers(response.headers());
        let body = match response.bytes().await {
            Ok(body) => body,
            Err(error) => {
                let message = format!("Failed to read Gemini response body: {error}");
                if should_retry_transport_error(attempt, config.openai_max_retries, &error) {
                    let backoff_ms = retry_backoff_ms(
                        config.openai_retry_base_ms,
                        attempt,
                        None,
                        config.openai_timeout_ms,
                    );
                    warn!(
                        attempt = attempt + 1,
                        max_attempts = config.openai_max_retries + 1,
                        backoff_ms,
                        error = message.as_str(),
                        "retrying Gemini request after response body read failure"
                    );
                    tokio::time::sleep(Duration::from_millis(backoff_ms)).await;
                    continue;
                }
                return Err(message);
            }
        };
        let payload = serde_json::from_slice::<Value>(body.as_ref());

        if !status.is_success() {
            let message = build_upstream_error_message(
                payload.as_ref().ok(),
                body.as_ref(),
                status,
                "Gemini request failed.",
            );
            if should_retry_status_code(status, attempt, config.openai_max_retries) {
                let backoff_ms = retry_backoff_ms(
                    config.openai_retry_base_ms,
                    attempt,
                    retry_after_ms,
                    config.openai_timeout_ms,
                );
                warn!(
                    attempt = attempt + 1,
                    max_attempts = config.openai_max_retries + 1,
                    backoff_ms,
                    retry_after_ms,
                    status = status.as_u16(),
                    error = message.as_str(),
                    "retrying Gemini request after upstream error"
                );
                tokio::time::sleep(Duration::from_millis(backoff_ms)).await;
                continue;
            }
            return Err(message);
        }
        let payload =
            payload.map_err(|error| format!("Failed to parse Gemini response: {error}"))?;

        if let Some(text) = extract_gemini_text(&payload) {
            return Ok(text);
        }
        return Err("Gemini response did not include text output.".to_string());
    }

    Err("Gemini request retry budget exhausted.".to_string())
}

pub(crate) fn build_openai_compat_endpoint(base_url: &str, path: &str) -> Result<String, String> {
    let base = base_url.trim();
    if base.is_empty() {
        return Err("OpenAI-compat base URL is empty.".to_string());
    }
    if !base.ends_with('/') {
        let mut owned = base.to_string();
        owned.push('/');
        let url = reqwest::Url::parse(owned.as_str())
            .map_err(|error| format!("Invalid OpenAI-compat base URL: {error}"))?;
        return url
            .join(path.trim_start_matches('/'))
            .map(|url| url.to_string())
            .map_err(|error| format!("Invalid OpenAI-compat path `{path}`: {error}"));
    }

    let url = reqwest::Url::parse(base)
        .map_err(|error| format!("Invalid OpenAI-compat base URL: {error}"))?;
    url.join(path.trim_start_matches('/'))
        .map(|url| url.to_string())
        .map_err(|error| format!("Invalid OpenAI-compat path `{path}`: {error}"))
}

fn build_google_generate_content_endpoint(
    endpoint: &str,
    model_id: &str,
    api_key: &str,
) -> Result<String, String> {
    let base = endpoint.trim().trim_end_matches('/');
    let normalized_model = model_id.trim().trim_start_matches("models/");
    let url_raw = format!("{base}/{normalized_model}:generateContent");
    let mut url = reqwest::Url::parse(url_raw.as_str())
        .map_err(|error| format!("Invalid CODE_RUNTIME_SERVICE_GEMINI_ENDPOINT: {error}"))?;
    url.query_pairs_mut().append_pair("key", api_key);
    Ok(url.to_string())
}

fn extract_output_text(payload: &Value) -> Option<String> {
    if let Some(text) = payload.get("output_text").and_then(Value::as_str) {
        let trimmed = text.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }

    payload
        .get("output")
        .and_then(Value::as_array)
        .and_then(|output| {
            output.iter().find_map(|item| {
                item.get("content")
                    .and_then(Value::as_array)
                    .and_then(|parts| {
                        parts.iter().find_map(|part| {
                            if part.get("type").and_then(Value::as_str) == Some("output_text") {
                                part.get("text")
                                    .and_then(Value::as_str)
                                    .map(ToOwned::to_owned)
                            } else {
                                None
                            }
                        })
                    })
            })
        })
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty())
}

fn extract_chat_completions_text(payload: &Value) -> Option<String> {
    let choices = payload.get("choices")?.as_array()?;
    let first = choices.first()?;
    let message = first.get("message")?;
    if let Some(content) = message.get("content").and_then(Value::as_str) {
        let trimmed = content.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }

    if let Some(parts) = message.get("content").and_then(Value::as_array) {
        let joined = parts
            .iter()
            .filter_map(|part| {
                part.get("text")
                    .and_then(Value::as_str)
                    .or_else(|| part.get("content").and_then(Value::as_str))
            })
            .map(str::trim)
            .filter(|segment| !segment.is_empty())
            .collect::<Vec<_>>()
            .join("\n");
        if !joined.is_empty() {
            return Some(joined);
        }
    }

    None
}

fn extract_anthropic_text(payload: &Value) -> Option<String> {
    payload
        .get("content")
        .and_then(Value::as_array)
        .and_then(|items| {
            let joined = items
                .iter()
                .filter_map(|item| {
                    if item.get("type").and_then(Value::as_str) == Some("text") {
                        item.get("text").and_then(Value::as_str)
                    } else {
                        None
                    }
                })
                .map(str::trim)
                .filter(|entry| !entry.is_empty())
                .collect::<Vec<_>>()
                .join("\n");
            if joined.is_empty() {
                None
            } else {
                Some(joined)
            }
        })
}

fn extract_gemini_text(payload: &Value) -> Option<String> {
    payload
        .get("candidates")
        .and_then(Value::as_array)
        .and_then(|candidates| {
            candidates.iter().find_map(|candidate| {
                candidate
                    .get("content")
                    .and_then(Value::as_object)
                    .and_then(|content| content.get("parts"))
                    .and_then(Value::as_array)
                    .and_then(|parts| {
                        let joined = parts
                            .iter()
                            .filter_map(|part| part.get("text").and_then(Value::as_str))
                            .map(str::trim)
                            .filter(|entry| !entry.is_empty())
                            .collect::<Vec<_>>()
                            .join("\n");
                        if joined.is_empty() {
                            None
                        } else {
                            Some(joined)
                        }
                    })
            })
        })
}

#[cfg(test)]
#[cfg(test)]
mod tests {
    include!("provider_requests_tests_body.inc");
}
