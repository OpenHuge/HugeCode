use std::time::Duration;

use serde_json::{json, Value};
use tracing::warn;

use crate::provider_request_retry::{
    build_upstream_error_message, retry_after_ms_from_headers, retry_backoff_ms,
    should_retry_status_code, should_retry_transport_error,
};
use crate::ServiceConfig;

const RUNTIME_PLAN_TOOL_NAME: &str = "runtime_plan";

#[derive(Debug, Clone)]
pub(crate) struct OpenAiRuntimeToolCallResponse {
    pub tool_arguments: Option<String>,
    pub assistant_text: Option<String>,
}

pub(crate) async fn query_openai_runtime_tool_call(
    client: &reqwest::Client,
    config: &ServiceConfig,
    api_key_override: Option<&str>,
    content: &str,
    model_id: &str,
    reason_effort: Option<&str>,
    service_tier: Option<&str>,
) -> Result<OpenAiRuntimeToolCallResponse, String> {
    let api_key = api_key_override.or(config.openai_api_key.as_deref());
    let Some(api_key) = api_key else {
        return Err("OPENAI_API_KEY is not configured for code-runtime-service-rs.".to_string());
    };

    let mut request_body = json!({
        "model": model_id,
        "input": [{
            "role": "user",
            "content": [{
                "type": "input_text",
                "text": content
            }]
        }],
        "tools": [{
            "type": "function",
            "name": RUNTIME_PLAN_TOOL_NAME,
            "description": "Plan runtime tool execution. Return up to 16 steps for read/write/edit/bash/js_repl/diagnostics and an optional finalMessage.",
            "strict": true,
            "parameters": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                    "plan": {
                        "type": "array",
                        "items": { "type": "string" }
                    },
                    "steps": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "additionalProperties": false,
                            "properties": {
                                "kind": {
                                    "type": "string",
                                    "enum": ["read", "write", "edit", "bash", "js_repl", "diagnostics"]
                                },
                                "input": { "type": "string" },
                                "path": { "type": "string" },
                                "paths": {
                                    "type": "array",
                                    "items": { "type": "string" }
                                },
                                "content": { "type": "string" },
                                "find": { "type": "string" },
                                "replace": { "type": "string" },
                                "command": { "type": "string" },
                                "severities": {
                                    "type": "array",
                                    "items": {
                                        "type": "string",
                                        "enum": ["error", "warning", "info", "hint"]
                                    }
                                },
                                "taskKey": { "type": "string" },
                                "dependsOn": {
                                    "type": "array",
                                    "items": { "type": "string" }
                                },
                                "requiresApproval": { "type": "boolean" },
                                "maxItems": { "type": "number" },
                                "timeoutMs": { "type": "number" }
                            },
                            "required": ["kind"]
                        }
                    },
                    "finalMessage": { "type": "string" }
                },
                "required": ["plan", "steps", "finalMessage"]
            }
        }],
        "tool_choice": {
            "type": "function",
            "name": RUNTIME_PLAN_TOOL_NAME
        },
        "parallel_tool_calls": false
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
            .post(&config.openai_endpoint)
            .bearer_auth(api_key)
            .json(&request_body)
            .send()
            .await;

        let response = match send_result {
            Ok(response) => response,
            Err(error) => {
                let message = format!("OpenAI runtime tool-call request failed: {error}");
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
                        "retrying OpenAI runtime tool-call request after transport failure"
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
                    format!("Failed to read OpenAI runtime tool-call response body: {error}");
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
                        "retrying OpenAI runtime tool-call request after response body read failure"
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
                "OpenAI runtime tool-call request failed.",
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
                    "retrying OpenAI runtime tool-call request after upstream error"
                );
                tokio::time::sleep(Duration::from_millis(backoff_ms)).await;
                continue;
            }
            return Err(message);
        }

        let payload = payload.map_err(|error| {
            format!("Failed to parse OpenAI runtime tool-call response: {error}")
        })?;
        let tool_arguments = extract_runtime_tool_arguments(&payload);
        let assistant_text = extract_output_text(&payload);
        if tool_arguments.is_some() || assistant_text.is_some() {
            return Ok(OpenAiRuntimeToolCallResponse {
                tool_arguments,
                assistant_text,
            });
        }

        return Err(
            "OpenAI runtime tool-call response did not include tool arguments or text output."
                .to_string(),
        );
    }

    Err("OpenAI runtime tool-call request retry budget exhausted.".to_string())
}

fn extract_runtime_tool_arguments(payload: &Value) -> Option<String> {
    let output = payload.get("output")?.as_array()?;
    for item in output {
        let item_type = item.get("type").and_then(Value::as_str).unwrap_or_default();
        if item_type != "function_call" && item_type != "custom_tool_call" {
            continue;
        }
        let name = item.get("name").and_then(Value::as_str).unwrap_or_default();
        if name != RUNTIME_PLAN_TOOL_NAME {
            continue;
        }
        if let Some(arguments) = item.get("arguments").and_then(Value::as_str) {
            let trimmed = arguments.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
        if let Some(arguments) = item.get("arguments") {
            let serialized = serde_json::to_string(arguments).ok()?;
            let trimmed = serialized.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
        if let Some(input) = item.get("input").and_then(Value::as_str) {
            let trimmed = input.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }
    None
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
