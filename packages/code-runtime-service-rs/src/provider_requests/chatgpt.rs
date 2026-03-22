use std::time::{Duration, Instant};

use serde_json::{json, Value};
use tokio_stream::StreamExt;
use tracing::warn;

use super::{
    build_upstream_error_message, provider_elapsed_budget_exhausted,
    resolve_chatgpt_sse_buffer_max_bytes, resolve_chatgpt_sse_frame_max_bytes,
    resolve_provider_max_elapsed_ms, retry_after_ms_from_headers, retry_backoff_ms,
    should_retry_status_code, should_retry_transport_error, ProviderDeltaCallback, ServiceConfig,
};

#[derive(Clone, Debug, PartialEq, Eq)]
enum ChatgptSseFrameParse {
    Ignore,
    Delta(String),
    Done(String),
}

fn normalize_sse_newlines(buffer: &mut String) {
    if !buffer.contains('\r') {
        return;
    }
    *buffer = buffer.replace("\r\n", "\n").replace('\r', "\n");
}

fn pop_next_sse_frame(buffer: &mut String) -> Option<String> {
    let separator_index = buffer.find("\n\n")?;
    let frame = buffer[..separator_index].to_string();
    buffer.drain(..separator_index + 2);
    Some(frame)
}

fn parse_chatgpt_sse_frame(frame: &str, output_text: &mut String) -> ChatgptSseFrameParse {
    let mut payload = String::new();
    for line in frame.lines() {
        let trimmed = line.trim_end();
        if let Some(data) = trimmed.strip_prefix("data:") {
            if !payload.is_empty() {
                payload.push('\n');
            }
            payload.push_str(data.trim_start());
        }
    }
    if payload.is_empty() || payload == "[DONE]" {
        return ChatgptSseFrameParse::Ignore;
    }
    let Ok(event) = serde_json::from_str::<Value>(payload.as_str()) else {
        return ChatgptSseFrameParse::Ignore;
    };
    let Some(event_type) = event.get("type").and_then(Value::as_str) else {
        return ChatgptSseFrameParse::Ignore;
    };
    match event_type {
        "response.output_text.done" => {
            let Some(text) = event
                .get("text")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|text| !text.is_empty())
                .map(ToOwned::to_owned)
            else {
                return ChatgptSseFrameParse::Ignore;
            };
            ChatgptSseFrameParse::Done(text)
        }
        "response.output_text.delta" => {
            if let Some(delta) = event.get("delta").and_then(Value::as_str) {
                output_text.push_str(delta);
                return ChatgptSseFrameParse::Delta(delta.to_string());
            }
            ChatgptSseFrameParse::Ignore
        }
        _ => ChatgptSseFrameParse::Ignore,
    }
}

pub(super) async fn query_chatgpt_codex_responses_with_endpoint(
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
    let mut request_body = json!({
        "model": model_id,
        "store": false,
        "stream": true,
        "instructions": "You are Codex.",
        "input": [{
            "role": "user",
            "content": [{
                "type": "input_text",
                "text": content
            }]
        }]
    });
    if let Some(effort) = reason_effort {
        let normalized = if effort == "xhigh" { "high" } else { effort };
        request_body["reasoning"] = json!({ "effort": normalized });
    }
    if matches!(service_tier, Some("fast")) {
        request_body["serviceTier"] = json!("fast");
    }

    let request_started_at = Instant::now();
    let provider_max_elapsed_ms = resolve_provider_max_elapsed_ms();
    let chatgpt_sse_buffer_max_bytes = resolve_chatgpt_sse_buffer_max_bytes();
    let chatgpt_sse_frame_max_bytes = resolve_chatgpt_sse_frame_max_bytes();

    for attempt in 0..=config.openai_max_retries {
        if provider_elapsed_budget_exhausted(request_started_at, provider_max_elapsed_ms) {
            return Err(format!(
                "ChatGPT Codex request exceeded provider elapsed budget of {provider_max_elapsed_ms}ms."
            ));
        }
        let mut request = client
            .post(endpoint)
            .bearer_auth(access_token)
            .header("accept", "text/event-stream")
            .json(&request_body);
        if let Some(account_id) = account_id.map(str::trim).filter(|entry| !entry.is_empty()) {
            request = request.header("ChatGPT-Account-Id", account_id);
        }
        let send_result = request.send().await;
        let response = match send_result {
            Ok(response) => response,
            Err(error) => {
                let message = format!("ChatGPT Codex request failed: {error}");
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
                        "retrying ChatGPT Codex request after transport failure"
                    );
                    if provider_elapsed_budget_exhausted(
                        request_started_at,
                        provider_max_elapsed_ms,
                    ) {
                        return Err(format!(
                            "ChatGPT Codex request exceeded provider elapsed budget of {provider_max_elapsed_ms}ms."
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
        if !status.is_success() {
            let body = response
                .bytes()
                .await
                .map_err(|error| format!("Failed to read ChatGPT Codex response body: {error}"))?;
            let payload = serde_json::from_slice::<Value>(body.as_ref()).ok();
            let message = build_upstream_error_message(
                payload.as_ref(),
                body.as_ref(),
                status,
                "ChatGPT Codex request failed.",
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
                    "retrying ChatGPT Codex request after upstream error"
                );
                if provider_elapsed_budget_exhausted(request_started_at, provider_max_elapsed_ms) {
                    return Err(format!(
                        "ChatGPT Codex request exceeded provider elapsed budget of {provider_max_elapsed_ms}ms."
                    ));
                }
                tokio::time::sleep(Duration::from_millis(backoff_ms)).await;
                continue;
            }
            return Err(message);
        }

        let mut output_text = String::new();
        let mut buffer = String::new();
        let mut saw_data_frame = false;
        let mut stream = response.bytes_stream();
        let mut stream_retry_backoff_ms: Option<u64> = None;
        let mut stream_error_message: Option<String> = None;
        while let Some(chunk_result) = stream.next().await {
            if provider_elapsed_budget_exhausted(request_started_at, provider_max_elapsed_ms) {
                return Err(format!(
                    "ChatGPT Codex request exceeded provider elapsed budget of {provider_max_elapsed_ms}ms."
                ));
            }
            let chunk = match chunk_result {
                Ok(chunk) => chunk,
                Err(error) => {
                    let message = format!("Failed to read ChatGPT Codex response stream: {error}");
                    if attempt < config.openai_max_retries {
                        stream_retry_backoff_ms = Some(retry_backoff_ms(
                            config.openai_retry_base_ms,
                            attempt,
                            None,
                            config.openai_timeout_ms,
                        ));
                        stream_error_message = Some(message);
                        break;
                    }
                    return Err(message);
                }
            };
            buffer.push_str(String::from_utf8_lossy(chunk.as_ref()).as_ref());
            if buffer.len() > chatgpt_sse_buffer_max_bytes {
                let message = format!(
                    "STREAM_SSE_FRAME_LIMIT: ChatGPT Codex SSE buffer exceeded {} bytes.",
                    chatgpt_sse_buffer_max_bytes
                );
                if attempt < config.openai_max_retries {
                    stream_retry_backoff_ms = Some(retry_backoff_ms(
                        config.openai_retry_base_ms,
                        attempt,
                        None,
                        config.openai_timeout_ms,
                    ));
                    stream_error_message = Some(message);
                    break;
                }
                return Err(message);
            }
            normalize_sse_newlines(&mut buffer);
            while let Some(frame) = pop_next_sse_frame(&mut buffer) {
                if frame.len() > chatgpt_sse_frame_max_bytes {
                    let message = format!(
                        "STREAM_SSE_FRAME_LIMIT: ChatGPT Codex SSE frame exceeded {} bytes.",
                        chatgpt_sse_frame_max_bytes
                    );
                    if attempt < config.openai_max_retries {
                        stream_retry_backoff_ms = Some(retry_backoff_ms(
                            config.openai_retry_base_ms,
                            attempt,
                            None,
                            config.openai_timeout_ms,
                        ));
                        stream_error_message = Some(message);
                        break;
                    }
                    return Err(message);
                }
                if frame
                    .lines()
                    .any(|line| line.trim_start().starts_with("data:"))
                {
                    saw_data_frame = true;
                }
                match parse_chatgpt_sse_frame(frame.as_str(), &mut output_text) {
                    ChatgptSseFrameParse::Ignore => {}
                    ChatgptSseFrameParse::Delta(delta) => {
                        if let Some(callback) = delta_callback.as_ref() {
                            callback(delta);
                        }
                    }
                    ChatgptSseFrameParse::Done(done_text) => return Ok(done_text),
                }
            }
            if stream_retry_backoff_ms.is_some() {
                break;
            }
        }
        if let Some(backoff_ms) = stream_retry_backoff_ms {
            let error = stream_error_message
                .unwrap_or_else(|| "Failed to read ChatGPT Codex response stream.".to_string());
            warn!(
                attempt = attempt + 1,
                max_attempts = config.openai_max_retries + 1,
                backoff_ms,
                error = error.as_str(),
                "retrying ChatGPT Codex request after stream read failure"
            );
            if provider_elapsed_budget_exhausted(request_started_at, provider_max_elapsed_ms) {
                return Err(format!(
                    "ChatGPT Codex request exceeded provider elapsed budget of {provider_max_elapsed_ms}ms."
                ));
            }
            tokio::time::sleep(Duration::from_millis(backoff_ms)).await;
            continue;
        }
        normalize_sse_newlines(&mut buffer);
        if !buffer.trim().is_empty() {
            if buffer.len() > chatgpt_sse_frame_max_bytes {
                let message = format!(
                    "STREAM_SSE_FRAME_LIMIT: ChatGPT Codex final SSE frame exceeded {} bytes.",
                    chatgpt_sse_frame_max_bytes
                );
                if attempt < config.openai_max_retries {
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
                        "retrying ChatGPT Codex request after oversized final stream frame"
                    );
                    tokio::time::sleep(Duration::from_millis(backoff_ms)).await;
                    continue;
                }
                return Err(message);
            }
            saw_data_frame = saw_data_frame
                || buffer
                    .lines()
                    .any(|line| line.trim_start().starts_with("data:"));
            match parse_chatgpt_sse_frame(buffer.as_str(), &mut output_text) {
                ChatgptSseFrameParse::Ignore => {}
                ChatgptSseFrameParse::Delta(delta) => {
                    if let Some(callback) = delta_callback.as_ref() {
                        callback(delta);
                    }
                }
                ChatgptSseFrameParse::Done(done_text) => return Ok(done_text),
            }
        }

        if saw_data_frame {
            let message =
                "ChatGPT Codex stream ended before response.output_text.done event.".to_string();
            if attempt < config.openai_max_retries {
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
                    "retrying ChatGPT Codex request after incomplete stream output"
                );
                if provider_elapsed_budget_exhausted(request_started_at, provider_max_elapsed_ms) {
                    return Err(format!(
                        "ChatGPT Codex request exceeded provider elapsed budget of {provider_max_elapsed_ms}ms."
                    ));
                }
                tokio::time::sleep(Duration::from_millis(backoff_ms)).await;
                continue;
            }
            return Err(message);
        }
        return Err("ChatGPT Codex stream completed without text output.".to_string());
    }

    Err("ChatGPT Codex request retry budget exhausted.".to_string())
}

pub(super) async fn query_chatgpt_codex_usage_with_endpoint(
    client: &reqwest::Client,
    config: &ServiceConfig,
    endpoint: &str,
    access_token: &str,
    account_id: Option<&str>,
) -> Result<Value, String> {
    for attempt in 0..=config.openai_max_retries {
        let mut request = client
            .get(endpoint)
            .bearer_auth(access_token)
            .header("user-agent", "codex-cli");
        if let Some(account_id) = account_id.map(str::trim).filter(|entry| !entry.is_empty()) {
            request = request.header("ChatGPT-Account-Id", account_id);
        }
        let send_result = request.send().await;
        let response = match send_result {
            Ok(response) => response,
            Err(error) => {
                let message = format!("ChatGPT Codex usage request failed: {error}");
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
                        "retrying ChatGPT Codex usage request after transport failure"
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
                let message = format!("Failed to read ChatGPT Codex usage response body: {error}");
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
                        "retrying ChatGPT Codex usage request after response body read failure"
                    );
                    tokio::time::sleep(Duration::from_millis(backoff_ms)).await;
                    continue;
                }
                return Err(message);
            }
        };
        let payload = serde_json::from_slice::<Value>(body.as_ref()).ok();

        if !status.is_success() {
            let message = build_upstream_error_message(
                payload.as_ref(),
                body.as_ref(),
                status,
                "ChatGPT Codex usage request failed.",
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
                    "retrying ChatGPT Codex usage request after upstream error"
                );
                tokio::time::sleep(Duration::from_millis(backoff_ms)).await;
                continue;
            }
            return Err(message);
        }

        let Some(payload) = payload else {
            return Err("ChatGPT Codex usage response was not valid JSON.".to_string());
        };
        if !payload.is_object() {
            return Err("ChatGPT Codex usage response was not a JSON object.".to_string());
        }
        return Ok(payload);
    }

    Err("ChatGPT Codex usage request retry budget exhausted.".to_string())
}

pub(super) async fn query_chatgpt_codex_accounts_check_with_endpoint(
    client: &reqwest::Client,
    config: &ServiceConfig,
    endpoint: &str,
    access_token: &str,
    account_id: Option<&str>,
) -> Result<Value, String> {
    for attempt in 0..=config.openai_max_retries {
        let mut request = client
            .get(endpoint)
            .bearer_auth(access_token)
            .header("accept", "application/json")
            .header("user-agent", "codex-cli");
        if let Some(account_id) = account_id.map(str::trim).filter(|entry| !entry.is_empty()) {
            request = request.header("ChatGPT-Account-Id", account_id);
        }
        let send_result = request.send().await;
        let response = match send_result {
            Ok(response) => response,
            Err(error) => {
                let message = format!("ChatGPT account profile request failed: {error}");
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
                        "retrying ChatGPT account profile request after transport failure"
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
                let message =
                    format!("Failed to read ChatGPT account profile response body: {error}");
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
                        "retrying ChatGPT account profile request after response body read failure"
                    );
                    tokio::time::sleep(Duration::from_millis(backoff_ms)).await;
                    continue;
                }
                return Err(message);
            }
        };
        let payload = serde_json::from_slice::<Value>(body.as_ref()).ok();

        if !status.is_success() {
            let message = build_upstream_error_message(
                payload.as_ref(),
                body.as_ref(),
                status,
                "ChatGPT account profile request failed.",
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
                    "retrying ChatGPT account profile request after upstream error"
                );
                tokio::time::sleep(Duration::from_millis(backoff_ms)).await;
                continue;
            }
            return Err(message);
        }

        let Some(payload) = payload else {
            return Err("ChatGPT account profile response was not valid JSON.".to_string());
        };
        if !payload.is_object() {
            return Err("ChatGPT account profile response was not a JSON object.".to_string());
        }
        return Ok(payload);
    }

    Err("ChatGPT account profile request retry budget exhausted.".to_string())
}
