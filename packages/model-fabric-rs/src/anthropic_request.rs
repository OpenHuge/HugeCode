use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{CompletionRequest, Message, Tool, ToolCall};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct AnthropicMcpToolConfiguration {
    pub(super) enabled: Option<bool>,
    pub(super) allowed_tools: Option<Vec<String>>,
    pub(super) defer_loading: Option<bool>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct AnthropicMcpServer {
    pub(super) name: String,
    pub(super) server_url: Option<String>,
    pub(super) connector_id: Option<String>,
    pub(super) authorization_token: Option<String>,
    pub(super) tool_configuration: Option<AnthropicMcpToolConfiguration>,
}

pub(super) fn build_request_body(
    model_id: &str,
    request: &CompletionRequest,
    stream: bool,
) -> Value {
    let (system_prompt, messages) = format_messages(&request.messages);

    let mut body = json!({
      "model": model_id,
      "messages": messages,
      "max_tokens": request.max_tokens.unwrap_or(4096),
    });

    if stream {
        body["stream"] = json!(true);
    }
    if let Some(system) = system_prompt {
        body["system"] = json!(system);
    }
    if let Some(temperature) = request.temperature {
        body["temperature"] = json!(temperature);
    }
    if let Some(top_p) = request.top_p {
        body["top_p"] = json!(top_p);
    }
    if let Some(stop_sequences) = &request.stop_sequences {
        body["stop_sequences"] = json!(stop_sequences);
    }
    if let Some(tools) = &request.tools {
        body["tools"] = json!(format_tools(tools));
    }
    if let Some(mcp_servers) = &request.anthropic_mcp_servers {
        body["mcp_servers"] = json!(format_mcp_servers(mcp_servers));
    }

    body
}

pub(super) fn parse_tool_call(value: &Value) -> Option<ToolCall> {
    if value.get("type")?.as_str()? != "tool_use" {
        return None;
    }
    let id = value
        .get("id")
        .and_then(|value| value.as_str())
        .map(|value| value.to_string())
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    let name = value.get("name")?.as_str()?.to_string();
    let input = value.get("input")?;
    let arguments = serde_json::to_string(input).unwrap_or_else(|_| "{}".to_string());
    Some(ToolCall {
        id,
        name,
        arguments,
    })
}

pub(super) fn map_finish_reason(reason: &str) -> String {
    match reason {
        "end_turn" | "stop_sequence" => "stop".to_string(),
        "max_tokens" => "length".to_string(),
        "tool_use" => "tool_calls".to_string(),
        _ => "stop".to_string(),
    }
}

fn format_messages(messages: &[Message]) -> (Option<String>, Vec<Value>) {
    let mut system_prompt: Option<String> = None;
    let mut formatted: Vec<Value> = Vec::new();

    for message in messages {
        if message.role == "system" {
            system_prompt = Some(match system_prompt {
                Some(existing) => format!("{existing}\n{}", message.content),
                None => message.content.clone(),
            });
        } else {
            formatted.push(json!({
              "role": message.role,
              "content": message.content,
            }));
        }
    }

    if let Some(first) = formatted.first() {
        let role = first
            .get("role")
            .and_then(|value| value.as_str())
            .unwrap_or("");
        if role != "user" {
            formatted.insert(0, json!({ "role": "user", "content": "Hello" }));
        }
    }

    (system_prompt, formatted)
}

fn format_tools(tools: &[Tool]) -> Vec<Value> {
    tools
        .iter()
        .map(|tool| {
            json!({
              "name": tool.name,
              "description": tool.description,
              "input_schema": tool.parameters,
            })
        })
        .collect()
}

fn format_mcp_servers(servers: &[AnthropicMcpServer]) -> Vec<Value> {
    servers
        .iter()
        .map(|server| {
            let mut formatted = json!({
              "name": server.name,
            });

            if let Some(server_url) = &server.server_url {
                formatted["server_url"] = json!(server_url);
            }
            if let Some(connector_id) = &server.connector_id {
                formatted["connector_id"] = json!(connector_id);
            }
            if let Some(authorization_token) = &server.authorization_token {
                formatted["authorization_token"] = json!(authorization_token);
            }
            if let Some(tool_configuration) = &server.tool_configuration {
                let mut formatted_tool_configuration = json!({});
                if let Some(enabled) = tool_configuration.enabled {
                    formatted_tool_configuration["enabled"] = json!(enabled);
                }
                if let Some(allowed_tools) = &tool_configuration.allowed_tools {
                    formatted_tool_configuration["allowed_tools"] = json!(allowed_tools);
                }
                if let Some(defer_loading) = tool_configuration.defer_loading {
                    formatted_tool_configuration["defer_loading"] = json!(defer_loading);
                }
                if formatted_tool_configuration
                    .as_object()
                    .is_some_and(|value| !value.is_empty())
                {
                    formatted["tool_configuration"] = formatted_tool_configuration;
                }
            }

            formatted
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn request_body_includes_deferred_mcp_servers() {
        let request = CompletionRequest {
            model: "claude-sonnet-4-5".to_string(),
            messages: vec![Message {
                role: "user".to_string(),
                content: "Summarize the latest runtime guidance.".to_string(),
            }],
            temperature: None,
            max_tokens: Some(1024),
            stop_sequences: None,
            tools: Some(vec![Tool {
                name: "read-workspace-file".to_string(),
                description: "Read a workspace file".to_string(),
                parameters: json!({
                  "type": "object",
                  "properties": {
                    "path": { "type": "string" }
                  },
                  "required": ["path"],
                }),
            }]),
            anthropic_mcp_servers: Some(vec![AnthropicMcpServer {
                name: "docs".to_string(),
                server_url: Some("https://example.com/mcp".to_string()),
                connector_id: None,
                authorization_token: Some("secret-token".to_string()),
                tool_configuration: Some(AnthropicMcpToolConfiguration {
                    enabled: Some(true),
                    allowed_tools: Some(vec!["search_docs".to_string()]),
                    defer_loading: Some(true),
                }),
            }]),
            top_p: None,
            timeout_ms: None,
        };

        let body = build_request_body("claude-sonnet-4-5", &request, false);

        assert_eq!(
            body.get("mcp_servers"),
            Some(&json!([
              {
                "name": "docs",
                "server_url": "https://example.com/mcp",
                "authorization_token": "secret-token",
                "tool_configuration": {
                  "enabled": true,
                  "allowed_tools": ["search_docs"],
                  "defer_loading": true,
                },
              }
            ]))
        );
        assert_eq!(
            body.get("tools"),
            Some(&json!([
              {
                "name": "read-workspace-file",
                "description": "Read a workspace file",
                "input_schema": {
                  "type": "object",
                  "properties": {
                    "path": { "type": "string" }
                  },
                  "required": ["path"],
                },
              }
            ]))
        );
    }

    #[test]
    fn request_body_omits_mcp_servers_when_not_requested() {
        let request = CompletionRequest {
            model: "claude-sonnet-4-5".to_string(),
            messages: vec![Message {
                role: "user".to_string(),
                content: "Hello".to_string(),
            }],
            temperature: None,
            max_tokens: None,
            stop_sequences: None,
            tools: None,
            anthropic_mcp_servers: None,
            top_p: None,
            timeout_ms: None,
        };

        let body = build_request_body("claude-sonnet-4-5", &request, true);

        assert_eq!(body.get("stream"), Some(&json!(true)));
        assert!(body.get("mcp_servers").is_none());
    }
}
