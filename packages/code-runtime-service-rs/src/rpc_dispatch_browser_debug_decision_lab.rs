use super::*;
use super::chatgpt_lab_shared::*;
use serde_json::{Map, Value};

struct ChatgptJsonLabExecution {
    tool_calls: Vec<Value>,
    warnings: Vec<String>,
    completion_state: String,
}

async fn execute_chatgpt_json_lab_flow(
    config: &BrowserDebugMcpLaunchConfig,
    timeout_ms: u64,
    chatgpt_url: &str,
    request_id: &str,
    prompt: &str,
    lab_label: &str,
) -> Result<ChatgptJsonLabExecution, String> {
    let mut client = BrowserDebugMcpClient::connect(config).await?;
    let tools = client.list_tools().await?;
    let tool_name_set = tools
        .iter()
        .map(|tool| tool.name.as_str())
        .collect::<std::collections::BTreeSet<_>>();
    let can_reuse_existing_page =
        tool_name_set.contains("list_pages") && tool_name_set.contains("select_page");
    let can_open_new_page = tool_name_set.contains("new_page");
    for required_tool in ["wait_for", "evaluate_script"] {
        if !tool_name_set.contains(required_tool) {
            return Err(format!(
                "Chrome DevTools MCP does not expose required tool `{required_tool}`."
            ));
        }
    }
    if !can_reuse_existing_page && !can_open_new_page {
        return Err(format!(
            "Chrome DevTools MCP requires either list_pages/select_page or new_page for the ChatGPT {lab_label}."
        ));
    }

    let mut warnings = Vec::new();
    let mut tool_calls = Vec::new();
    let force_fresh_chat = should_prefer_fresh_chat_context(chatgpt_url);
    if can_reuse_existing_page {
        let call_result = client.call_tool("list_pages", None).await?;
        let normalized = normalize_browser_call_result("list_pages", call_result, &mut warnings);
        let existing_page_id = extract_chatgpt_page_id(&normalized, chatgpt_url);
        let fallback_page_id = extract_any_chatgpt_page_id(&normalized, chatgpt_url);
        tool_calls.push(normalized);
        if let Some(page_id) = existing_page_id {
            let call_result = client
                .call_tool(
                    "select_page",
                    Some(Map::from_iter([(
                        "pageId".to_string(),
                        Value::Number(page_id.into()),
                    )])),
                )
                .await?;
            tool_calls.push(normalize_browser_call_result(
                "select_page",
                call_result,
                &mut warnings,
            ));
        } else if let Some(page_id) = fallback_page_id {
            warnings.push(format!(
                "Resetting the current ChatGPT page to a fresh task context to avoid prior conversation leakage into the {lab_label}."
            ));
            let call_result = client
                .call_tool(
                    "select_page",
                    Some(Map::from_iter([(
                        "pageId".to_string(),
                        Value::Number(page_id.into()),
                    )])),
                )
                .await?;
            tool_calls.push(normalize_browser_call_result(
                "select_page",
                call_result,
                &mut warnings,
            ));
        } else if can_open_new_page {
            warnings.push(format!(
                "Opened a fresh ChatGPT page to avoid leaking prior conversation history into the {lab_label}."
            ));
            let call_result = client
                .call_tool(
                    "new_page",
                    Some(Map::from_iter([(
                        "url".to_string(),
                        Value::String(chatgpt_url.to_string()),
                    )])),
                )
                .await?;
            tool_calls.push(normalize_browser_call_result(
                "new_page",
                call_result,
                &mut warnings,
            ));
        } else {
            return Err(
                "Chrome DevTools MCP did not expose a reusable ChatGPT page and cannot open a new one."
                    .to_string(),
            );
        }
    } else {
        let call_result = client
            .call_tool(
                "new_page",
                Some(Map::from_iter([(
                    "url".to_string(),
                    Value::String(chatgpt_url.to_string()),
                )])),
            )
            .await?;
        tool_calls.push(normalize_browser_call_result(
            "new_page",
            call_result,
            &mut warnings,
        ));
    }

    let wait_for_result = client
        .call_tool(
            "wait_for",
            Some(Map::from_iter([
                (
                    "text".to_string(),
                    Value::Array(vec![
                        Value::String("ChatGPT".to_string()),
                        Value::String("Ask anything".to_string()),
                        Value::String("New chat".to_string()),
                    ]),
                ),
                ("timeout".to_string(), Value::Number(timeout_ms.into())),
            ])),
        )
        .await?;
    tool_calls.push(normalize_browser_call_result(
        "wait_for",
        wait_for_result,
        &mut warnings,
    ));

    let mut prepare_result = normalize_browser_call_result(
        "evaluate_script",
        client
            .call_tool(
                "evaluate_script",
                Some(Map::from_iter([(
                    "function".to_string(),
                    Value::String(build_chatgpt_prepare_page_script()),
                )])),
            )
            .await?,
        &mut warnings,
    );
    if let Some(error) = extract_decision_lab_step_error(&prepare_result) {
        return Err(format!("ChatGPT {lab_label} browser step failed: {error}"));
    }
    if chatgpt_prepare_requires_auth(&prepare_result) {
        let stderr = client.close().await;
        if !stderr.trim().is_empty() {
            warnings.push(stderr.trim().to_string());
        }
        return Ok(ChatgptJsonLabExecution {
            tool_calls,
            warnings,
            completion_state: "auth_required".to_string(),
        });
    }
    if let Some(plan_blocked_message) = chatgpt_prepare_plan_blocked_message(&prepare_result) {
        warnings.push(format!(
            "ChatGPT surfaced an account/workspace warning before the {lab_label} prompt: {plan_blocked_message}"
        ));
    }
    let mut baseline_assistant_turn_count = 0;
    let mut should_reset_to_fresh_chat = false;
    if let Some(object) = extract_structured_object(&prepare_result) {
        baseline_assistant_turn_count = object
            .get("assistantTurnCount")
            .and_then(Value::as_u64)
            .unwrap_or(0);
        should_reset_to_fresh_chat = force_fresh_chat
            && (object
                .get("isConversationUrl")
                .and_then(Value::as_bool)
                .unwrap_or(false)
                || baseline_assistant_turn_count > 0);
    }
    tool_calls.push(prepare_result.clone());

    if should_reset_to_fresh_chat {
        warnings.push(format!(
            "Resetting the ChatGPT page into a fresh task context before sending the {lab_label} prompt."
        ));
        let reset_result = normalize_browser_call_result(
            "evaluate_script",
            client
                .call_tool(
                    "evaluate_script",
                    Some(Map::from_iter([(
                        "function".to_string(),
                        Value::String(build_chatgpt_reset_page_script(chatgpt_url)),
                    )])),
                )
                .await?,
            &mut warnings,
        );
        if let Some(error) = extract_decision_lab_step_error(&reset_result) {
            if !is_navigation_context_reset_error(error.as_str()) {
                return Err(format!("ChatGPT {lab_label} browser step failed: {error}"));
            }
        }
        tool_calls.push(reset_result);

        let wait_for_result = client
            .call_tool(
                "wait_for",
                Some(Map::from_iter([
                    (
                        "text".to_string(),
                        Value::Array(vec![
                            Value::String("ChatGPT".to_string()),
                            Value::String("Ask anything".to_string()),
                            Value::String("New chat".to_string()),
                        ]),
                    ),
                    ("timeout".to_string(), Value::Number(timeout_ms.into())),
                ])),
            )
            .await?;
        tool_calls.push(normalize_browser_call_result(
            "wait_for",
            wait_for_result,
            &mut warnings,
        ));

        prepare_result = normalize_browser_call_result(
            "evaluate_script",
            client
                .call_tool(
                    "evaluate_script",
                    Some(Map::from_iter([(
                        "function".to_string(),
                        Value::String(build_chatgpt_prepare_page_script()),
                    )])),
                )
                .await?,
            &mut warnings,
        );
        if let Some(error) = extract_decision_lab_step_error(&prepare_result) {
            return Err(format!("ChatGPT {lab_label} browser step failed: {error}"));
        }
        if chatgpt_prepare_requires_auth(&prepare_result) {
            let stderr = client.close().await;
            if !stderr.trim().is_empty() {
                warnings.push(stderr.trim().to_string());
            }
            return Ok(ChatgptJsonLabExecution {
                tool_calls,
                warnings,
                completion_state: "auth_required".to_string(),
            });
        }
        if let Some(plan_blocked_message) = chatgpt_prepare_plan_blocked_message(&prepare_result) {
            warnings.push(format!(
                "ChatGPT surfaced an account/workspace warning after resetting the page: {plan_blocked_message}"
            ));
        }
        baseline_assistant_turn_count = extract_structured_object(&prepare_result)
            .and_then(|object| object.get("assistantTurnCount").and_then(Value::as_u64))
            .unwrap_or(0);
        tool_calls.push(prepare_result.clone());
    }

    let mut fill_succeeded = false;
    for attempt in 0..2 {
        let normalized = normalize_browser_call_result(
            "evaluate_script",
            client
                .call_tool(
                    "evaluate_script",
                    Some(Map::from_iter([(
                        "function".to_string(),
                        Value::String(build_chatgpt_fill_and_send_script(prompt)),
                    )])),
                )
                .await?,
            &mut warnings,
        );
        let maybe_error = extract_decision_lab_step_error(&normalized);
        tool_calls.push(normalized.clone());
        let Some(error) = maybe_error else {
            fill_succeeded = true;
            break;
        };
        if attempt == 0 && should_retry_chatgpt_fill_step(error.as_str()) {
            warnings.push(format!(
                "Retrying the ChatGPT send step after `{error}` because the composer was not yet actionable."
            ));
            let wait_for_result = client
                .call_tool(
                    "wait_for",
                    Some(Map::from_iter([
                        (
                            "text".to_string(),
                            Value::Array(vec![
                                Value::String("ChatGPT".to_string()),
                                Value::String("Ask anything".to_string()),
                                Value::String("New chat".to_string()),
                            ]),
                        ),
                        ("timeout".to_string(), Value::Number(timeout_ms.into())),
                    ])),
                )
                .await?;
            tool_calls.push(normalize_browser_call_result(
                "wait_for",
                wait_for_result,
                &mut warnings,
            ));
            continue;
        }
        return Err(format!("ChatGPT {lab_label} browser step failed: {error}"));
    }
    if !fill_succeeded {
        return Err(format!(
            "ChatGPT {lab_label} browser step failed: send_step_exhausted"
        ));
    }

    for function in [
        build_chatgpt_completion_wait_script(timeout_ms, request_id, baseline_assistant_turn_count),
        build_chatgpt_extract_code_block_script(request_id),
    ] {
        let normalized = normalize_browser_call_result(
            "evaluate_script",
            client
                .call_tool(
                    "evaluate_script",
                    Some(Map::from_iter([(
                        "function".to_string(),
                        Value::String(function),
                    )])),
                )
                .await?,
            &mut warnings,
        );
        if let Some(error) = extract_decision_lab_step_error(&normalized) {
            return Err(format!("ChatGPT {lab_label} browser step failed: {error}"));
        }
        tool_calls.push(normalized);
    }
    let stderr = client.close().await;
    if !stderr.trim().is_empty() {
        warnings.push(stderr.trim().to_string());
    }
    Ok(ChatgptJsonLabExecution {
        tool_calls,
        warnings,
        completion_state: "completed".to_string(),
    })
}

pub(super) async fn run_chatgpt_decision_lab_operation(
    workspace_path: &Path,
    request: &BrowserDebugRunRequest,
) -> BrowserDebugRunSnapshot {
    let browser_url = normalize_browser_debug_browser_url(request.browser_url.as_deref());
    let Some(decision_lab_request) = request.decision_lab.as_ref() else {
        return BrowserDebugRunSnapshot {
            available: false,
            status: "failed",
            mode: "mcp-chrome-devtools",
            browser_url: browser_url.clone(),
            message: "ChatGPT decision lab requires a decisionLab payload.".to_string(),
            tool_calls: Vec::new(),
            content_text: None,
            structured_content: None,
            artifacts: Vec::new(),
            warnings: vec!["ChatGPT decision lab requires a decisionLab payload.".to_string()],
            decision_lab: None,
            research_route_lab: None,
        };
    };
    let Ok(Some(config)) =
        resolve_chrome_devtools_mcp_launch_config(workspace_path, request.browser_url.as_deref())
    else {
        return BrowserDebugRunSnapshot {
            available: false,
            status: "blocked",
            mode: "mcp-chrome-devtools",
            browser_url: browser_url.clone(),
            message: "Chrome DevTools MCP is unavailable for the ChatGPT decision lab.".to_string(),
            tool_calls: Vec::new(),
            content_text: None,
            structured_content: None,
            artifacts: Vec::new(),
            warnings: vec![
                "Chrome DevTools MCP is unavailable. Install Node/npx and provide a connectable Chrome session.".to_string(),
            ],
            decision_lab: None,
            research_route_lab: None,
        };
    };

    let timeout_ms = request
        .timeout_ms
        .unwrap_or(BROWSER_DEBUG_DEFAULT_TIMEOUT_MS)
        .clamp(1_000, BROWSER_DEBUG_MAX_TIMEOUT_MS);
    let chatgpt_url = decision_lab_request
        .chatgpt_url
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(DEFAULT_CHATGPT_URL);
    let request_id = build_decision_lab_request_id();
    let prompt = build_chatgpt_decision_lab_prompt(decision_lab_request, request_id.as_str());
    let result = timeout(
        Duration::from_millis(timeout_ms),
        execute_chatgpt_json_lab_flow(
            &config,
            timeout_ms,
            chatgpt_url,
            request_id.as_str(),
            prompt.as_str(),
            "decision lab",
        ),
    )
    .await;

    match result {
        Ok(Ok(ChatgptJsonLabExecution {
            tool_calls,
            warnings,
            completion_state,
        })) => {
            if completion_state == "auth_required" {
                let (content_text, structured_content, artifacts) =
                    aggregate_browser_tool_call_results(tool_calls.as_slice());
                return BrowserDebugRunSnapshot {
                    available: false,
                    status: "blocked",
                    mode: "mcp-chrome-devtools",
                    browser_url: browser_url.clone(),
                    message: "ChatGPT login is required in the selected browser session.".to_string(),
                    tool_calls,
                    content_text,
                    structured_content,
                    artifacts,
                    warnings,
                    decision_lab: None,
                    research_route_lab: None,
                };
            }
            let (content_text, structured_content, artifacts) =
                aggregate_browser_tool_call_results(tool_calls.as_slice());
            let extract_result = tool_calls.last().cloned().unwrap_or(Value::Null);
            let extract_object = extract_structured_object(&extract_result).unwrap_or_default();
            let code_block = extract_decision_lab_json_candidate(&extract_object);
            let Some(code_block) = code_block else {
                return BrowserDebugRunSnapshot {
                    available: false,
                    status: "failed",
                    mode: "mcp-chrome-devtools",
                    browser_url: browser_url.clone(),
                    message: "ChatGPT decision lab did not return a code block.".to_string(),
                    tool_calls,
                    content_text,
                    structured_content,
                    artifacts,
                    warnings: {
                        let mut next = warnings;
                        next.push("ChatGPT decision lab did not return a code block.".to_string());
                        next
                    },
                    decision_lab: None,
                    research_route_lab: None,
                };
            };
            let parsed_json = match serde_json::from_str::<Value>(code_block.as_str()) {
                Ok(value) => value,
                Err(error) => {
                    return BrowserDebugRunSnapshot {
                        available: false,
                        status: "failed",
                        mode: "mcp-chrome-devtools",
                        browser_url: browser_url.clone(),
                        message: format!("ChatGPT decision lab returned invalid JSON: {error}"),
                        tool_calls,
                        content_text,
                        structured_content,
                        artifacts,
                        warnings: {
                            let mut next = warnings;
                            next.push(format!(
                                "ChatGPT decision lab returned invalid JSON: {error}"
                            ));
                            next
                        },
                        decision_lab: None,
                        research_route_lab: None,
                    }
                }
            };
            let decision_lab = normalize_decision_lab_result_payload(&parsed_json);
            BrowserDebugRunSnapshot {
                available: true,
                status: "completed",
                mode: "mcp-chrome-devtools",
                browser_url: browser_url.clone(),
                message: "ChatGPT decision lab completed.".to_string(),
                tool_calls,
                content_text,
                structured_content,
                artifacts,
                warnings,
                decision_lab,
                research_route_lab: None,
            }
        }
        Ok(Err(error)) => BrowserDebugRunSnapshot {
            available: false,
            status: "failed",
            mode: "mcp-chrome-devtools",
            browser_url: browser_url.clone(),
            message: error.clone(),
            tool_calls: Vec::new(),
            content_text: None,
            structured_content: None,
            artifacts: Vec::new(),
            warnings: vec![error],
            decision_lab: None,
            research_route_lab: None,
        },
        Err(_) => BrowserDebugRunSnapshot {
            available: false,
            status: "failed",
            mode: "mcp-chrome-devtools",
            browser_url,
            message: "Timed out while running the ChatGPT decision lab.".to_string(),
            tool_calls: Vec::new(),
            content_text: None,
            structured_content: None,
            artifacts: Vec::new(),
            warnings: vec!["Timed out while running the ChatGPT decision lab.".to_string()],
            decision_lab: None,
            research_route_lab: None,
        },
    }
}

pub(super) async fn run_chatgpt_research_route_lab_operation(
    workspace_path: &Path,
    request: &BrowserDebugRunRequest,
) -> BrowserDebugRunSnapshot {
    let browser_url = normalize_browser_debug_browser_url(request.browser_url.as_deref());
    let Some(research_route_request) = request.research_route_lab.as_ref() else {
        return BrowserDebugRunSnapshot {
            available: false,
            status: "failed",
            mode: "mcp-chrome-devtools",
            browser_url: browser_url.clone(),
            message: "ChatGPT research route lab requires a researchRouteLab payload.".to_string(),
            tool_calls: Vec::new(),
            content_text: None,
            structured_content: None,
            artifacts: Vec::new(),
            warnings: vec!["ChatGPT research route lab requires a researchRouteLab payload.".to_string()],
            decision_lab: None,
            research_route_lab: None,
        };
    };
    let Ok(Some(config)) =
        resolve_chrome_devtools_mcp_launch_config(workspace_path, request.browser_url.as_deref())
    else {
        return BrowserDebugRunSnapshot {
            available: false,
            status: "blocked",
            mode: "mcp-chrome-devtools",
            browser_url: browser_url.clone(),
            message: "Chrome DevTools MCP is unavailable for the ChatGPT research route lab.".to_string(),
            tool_calls: Vec::new(),
            content_text: None,
            structured_content: None,
            artifacts: Vec::new(),
            warnings: vec![
                "Chrome DevTools MCP is unavailable. Install Node/npx and provide a connectable Chrome session.".to_string(),
            ],
            decision_lab: None,
            research_route_lab: None,
        };
    };

    let timeout_ms = request
        .timeout_ms
        .unwrap_or(BROWSER_DEBUG_DEFAULT_TIMEOUT_MS)
        .clamp(1_000, BROWSER_DEBUG_MAX_TIMEOUT_MS);
    let chatgpt_url = research_route_request
        .chatgpt_url
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(DEFAULT_CHATGPT_URL);
    let request_id = build_decision_lab_request_id();
    let prompt =
        build_chatgpt_research_route_lab_prompt(research_route_request, request_id.as_str());
    let trusted_domains = research_route_request
        .trusted_domains
        .clone()
        .unwrap_or_default();
    let allowed_route_ids = research_route_request
        .routes
        .iter()
        .map(|route| route.id.trim().to_string())
        .filter(|route| !route.is_empty())
        .collect::<Vec<_>>();
    let result = timeout(
        Duration::from_millis(timeout_ms),
        execute_chatgpt_json_lab_flow(
            &config,
            timeout_ms,
            chatgpt_url,
            request_id.as_str(),
            prompt.as_str(),
            "research route lab",
        ),
    )
    .await;

    match result {
        Ok(Ok(ChatgptJsonLabExecution {
            tool_calls,
            mut warnings,
            completion_state,
        })) => {
            if completion_state == "auth_required" {
                let (content_text, structured_content, artifacts) =
                    aggregate_browser_tool_call_results(tool_calls.as_slice());
                return BrowserDebugRunSnapshot {
                    available: false,
                    status: "blocked",
                    mode: "mcp-chrome-devtools",
                    browser_url: browser_url.clone(),
                    message: "ChatGPT login is required in the selected browser session.".to_string(),
                    tool_calls,
                    content_text,
                    structured_content,
                    artifacts,
                    warnings,
                    decision_lab: None,
                    research_route_lab: None,
                };
            }
            let (content_text, structured_content, artifacts) =
                aggregate_browser_tool_call_results(tool_calls.as_slice());
            let extract_result = tool_calls.last().cloned().unwrap_or(Value::Null);
            let extract_object = extract_structured_object(&extract_result).unwrap_or_default();
            let Some(code_block) = extract_decision_lab_json_candidate(&extract_object) else {
                warnings.push("ChatGPT research route lab did not return a code block.".to_string());
                return BrowserDebugRunSnapshot {
                    available: false,
                    status: "failed",
                    mode: "mcp-chrome-devtools",
                    browser_url: browser_url.clone(),
                    message: "ChatGPT research route lab did not return a code block.".to_string(),
                    tool_calls,
                    content_text,
                    structured_content,
                    artifacts,
                    warnings,
                    decision_lab: None,
                    research_route_lab: None,
                };
            };
            let parsed_json = match serde_json::from_str::<Value>(code_block.as_str()) {
                Ok(value) => value,
                Err(error) => {
                    warnings.push(format!(
                        "ChatGPT research route lab returned invalid JSON: {error}"
                    ));
                    return BrowserDebugRunSnapshot {
                        available: false,
                        status: "failed",
                        mode: "mcp-chrome-devtools",
                        browser_url: browser_url.clone(),
                        message: format!(
                            "ChatGPT research route lab returned invalid JSON: {error}"
                        ),
                        tool_calls,
                        content_text,
                        structured_content,
                        artifacts,
                        warnings,
                        decision_lab: None,
                        research_route_lab: None,
                    };
                }
            };
            let research_route_lab =
                normalize_research_route_lab_result_payload(
                    &parsed_json,
                    trusted_domains.as_slice(),
                    allowed_route_ids.as_slice(),
                );
            if let Some(blocked_reason) = research_route_lab
                .as_ref()
                .and_then(|value| value.get("blockedReason"))
                .and_then(Value::as_str)
            {
                warnings.push(format!(
                    "ChatGPT research route lab completed with a research gap: {blocked_reason}"
                ));
            }
            BrowserDebugRunSnapshot {
                available: true,
                status: "completed",
                mode: "mcp-chrome-devtools",
                browser_url: browser_url.clone(),
                message: "ChatGPT research route lab completed.".to_string(),
                tool_calls,
                content_text,
                structured_content,
                artifacts,
                warnings,
                decision_lab: None,
                research_route_lab,
            }
        }
        Ok(Err(error)) => BrowserDebugRunSnapshot {
            available: false,
            status: "failed",
            mode: "mcp-chrome-devtools",
            browser_url: browser_url.clone(),
            message: error.clone(),
            tool_calls: Vec::new(),
            content_text: None,
            structured_content: None,
            artifacts: Vec::new(),
            warnings: vec![error],
            decision_lab: None,
            research_route_lab: None,
        },
        Err(_) => BrowserDebugRunSnapshot {
            available: false,
            status: "failed",
            mode: "mcp-chrome-devtools",
            browser_url,
            message: "Timed out while running the ChatGPT research route lab.".to_string(),
            tool_calls: Vec::new(),
            content_text: None,
            structured_content: None,
            artifacts: Vec::new(),
            warnings: vec!["Timed out while running the ChatGPT research route lab.".to_string()],
            decision_lab: None,
            research_route_lab: None,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::fs;
    use tempfile::TempDir;

    #[cfg(unix)]
    use std::os::unix::fs::PermissionsExt;

    #[test]
    fn extract_last_json_object_reads_plain_json_without_fences() {
        let text = concat!(
            "ChatGPT said:\n",
            "Thought for a second\n",
            "JSON\n",
            "{\"recommendedOptionId\":\"route-b\",\"recommendedOption\":\"Route B\",\"alternativeOptionIds\":[\"route-a\"],\"decisionMemo\":\"Best balance of safety and progress.\",\"confidence\":\"high\",\"assumptions\":[\"Workspace constraints are accurate.\"],\"followUpQuestions\":[]}\n"
        );
        assert_eq!(
            extract_last_json_object(text),
            Some("{\"recommendedOptionId\":\"route-b\",\"recommendedOption\":\"Route B\",\"alternativeOptionIds\":[\"route-a\"],\"decisionMemo\":\"Best balance of safety and progress.\",\"confidence\":\"high\",\"assumptions\":[\"Workspace constraints are accurate.\"],\"followUpQuestions\":[]}".to_string())
        );
    }

    #[test]
    fn extract_last_json_object_prefers_outer_object_when_nested_objects_exist() {
        let text = concat!(
            "ChatGPT said:\n",
            "JSON\n",
            "{\"recommendedRoute\":\"route-a\",\"sources\":[{\"label\":\"React\",\"domain\":\"react.dev\"}]}\n"
        );
        assert_eq!(
            extract_last_json_object(text),
            Some(
                "{\"recommendedRoute\":\"route-a\",\"sources\":[{\"label\":\"React\",\"domain\":\"react.dev\"}]}"
                    .to_string()
            )
        );
    }

    #[test]
    fn extract_structured_object_reads_json_code_block_from_content_text() {
        let result = json!({
            "contentText": "Script ran on page and returned:\n```json\n{\"ok\":true,\"assistantTurnCount\":8,\"requestIdMatched\":true}\n```",
            "structuredContent": Value::Null,
        });
        assert_eq!(
            extract_structured_object(&result)
                .and_then(|value| value.get("assistantTurnCount").cloned()),
            Some(json!(8))
        );
    }

    #[test]
    fn extract_decision_lab_step_error_ignores_successful_content_text_payload() {
        let result = json!({
            "ok": true,
            "contentText": "Script ran on page and returned:\n```json\n{\"ok\":true,\"assistantTurnCount\":8,\"requestIdMatched\":true}\n```",
            "structuredContent": Value::Null,
        });
        assert_eq!(extract_decision_lab_step_error(&result), None);
    }

    #[test]
    fn page_matches_chatgpt_url_prefers_fresh_home_over_existing_conversation() {
        assert!(!page_matches_chatgpt_url(
            "https://chatgpt.com/c/abc123",
            "https://chatgpt.com/"
        ));
        assert!(page_matches_chatgpt_url(
            "https://chatgpt.com/",
            "https://chatgpt.com/"
        ));
    }

    #[test]
    fn page_matches_chatgpt_url_reuses_specific_conversation_targets() {
        assert!(page_matches_chatgpt_url(
            "https://chatgpt.com/c/abc123",
            "https://chatgpt.com/c/abc123"
        ));
        assert!(!page_matches_chatgpt_url(
            "https://chatgpt.com/c/def456",
            "https://chatgpt.com/c/abc123"
        ));
    }

    #[test]
    fn extract_any_chatgpt_page_id_recognizes_conversation_pages_for_reset_flow() {
        let result = json!({
            "structuredContent": {
                "pages": [
                    { "pageId": 1, "url": "https://example.com/" },
                    { "pageId": 2, "url": "https://chatgpt.com/c/abc123" }
                ]
            }
        });
        assert_eq!(
            extract_any_chatgpt_page_id(&result, "https://chatgpt.com/"),
            Some(2)
        );
    }

    fn write_fake_chrome_devtools_server_script(temp: &TempDir) -> std::path::PathBuf {
        let script_path = temp.path().join("fake-chrome-devtools-mcp.sh");
        let script = r##"#!/bin/sh
probe_state="${TMPDIR:-/tmp}/fake-chrome-devtools-probe-state.$$"
while IFS= read -r line; do
  id=$(printf '%s' "$line" | sed -n 's/.*"id":\([0-9][0-9]*\).*/\1/p')
  case "$line" in
    *'"method":"initialize"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"capabilities":{"tools":{"listChanged":true}},"serverInfo":{"name":"fake-chrome-devtools-mcp","version":"0.0.0"},"protocolVersion":"2025-03-26"}}\n' "$id"
      ;;
    *'"method":"notifications/initialized"'*)
      ;;
    *'"method":"tools/list"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"tools":[{"name":"list_pages","description":"List pages","inputSchema":{"type":"object"}},{"name":"select_page","description":"Select page","inputSchema":{"type":"object"}},{"name":"new_page","description":"New page","inputSchema":{"type":"object"}},{"name":"wait_for","description":"Wait","inputSchema":{"type":"object"}},{"name":"evaluate_script","description":"Eval","inputSchema":{"type":"object"}}]}}\n' "$id"
      ;;
    *'"method":"tools/call"'*'"name":"list_pages"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"content":[{"type":"text","text":"Pages\\n1: https://example.com/\\n2: https://chatgpt.com/c/abc123"}],"structuredContent":{"pages":[{"pageId":1,"url":"https://example.com/"},{"pageId":2,"url":"https://chatgpt.com/c/abc123"}]}}}\n' "$id"
      ;;
    *'"method":"tools/call"'*'"name":"select_page"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"structuredContent":{"ok":true,"pageId":2}}}\n' "$id"
      ;;
    *'"method":"tools/call"'*'"name":"new_page"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"structuredContent":{"ok":true,"pageId":3,"url":"https://chatgpt.com/"}}}\n' "$id"
      ;;
    *'"method":"tools/call"'*'"name":"wait_for"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"structuredContent":{"ok":true}}}\n' "$id"
      ;;
    *decision_lab_prepare_page_v4*)
      if [ ! -f "$probe_state" ]; then
        : > "$probe_state"
        printf '{"jsonrpc":"2.0","id":%s,"result":{"structuredContent":{"ok":true,"composerFound":true,"assistantTurnCount":2,"dismissedDialogLabels":["Continue"],"newChatControlFound":true,"isConversationUrl":true}}}\n' "$id"
      else
        printf '{"jsonrpc":"2.0","id":%s,"result":{"structuredContent":{"ok":true,"composerFound":true,"assistantTurnCount":0,"dismissedDialogLabels":["Continue"],"newChatControlFound":true,"isConversationUrl":false}}}\n' "$id"
      fi
      ;;
    *decision_lab_reset_page_v1*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"structuredContent":{"ok":false,"error":"Execution context was destroyed, most likely because of a navigation."}}}\n' "$id"
      ;;
    *decision_lab_fill_and_send_v2*execCommand*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"structuredContent":{"ok":true,"composerFound":true,"usedExecCommand":true,"sendButtonFound":true,"sendButtonEnabled":true,"sendTriggered":true}}}\n' "$id"
      ;;
    *decision_lab_fill_and_send_v2*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"structuredContent":{"ok":false,"error":"missing_exec_command"}}}\n' "$id"
      ;;
    *decision_lab_wait_completion_v3*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"structuredContent":{"ok":true,"assistantTurnCount":4,"matchedUserTurnPresent":true,"matchedAssistantTurnPresent":true,"matchedAssistantResponseActions":true,"matchedAssistantCodeBlockCount":0,"matchedAssistantText":"ChatGPT said:\\nJSON\\n{\\"recommendedOptionId\\":\\"route-b\\"}"}}}\n' "$id"
      ;;
    *decision_lab_extract_result_v3*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"structuredContent":{"codeBlock":null,"assistantTurnText":"ChatGPT said:\\nThought for a second\\nJSON\\n{\\"recommendedOptionId\\":\\"route-b\\",\\"recommendedOption\\":\\"Route B\\",\\"alternativeOptionIds\\":[\\"route-a\\"],\\"decisionMemo\\":\\"Best balance of safety and progress.\\",\\"confidence\\":\\"high\\",\\"assumptions\\":[\\"Workspace constraints are accurate.\\"],\\"followUpQuestions\\":[\\"Should we validate dependency drift first?\\"]}","title":"ChatGPT","url":"https://chatgpt.com/c/abc123"}}}\n' "$id"
      ;;
    *'"method":"tools/call"'*'"name":"evaluate_script"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"structuredContent":{"ok":false,"error":"unexpected_script"}}}\n' "$id"
      ;;
  esac
done
"##;
        fs::write(&script_path, script).expect("write fake chrome devtools server script");
        #[cfg(unix)]
        let mut permissions = fs::metadata(&script_path)
            .expect("fake chrome devtools metadata")
            .permissions();
        #[cfg(unix)]
        permissions.set_mode(0o755);
        #[cfg(unix)]
        fs::set_permissions(&script_path, permissions)
            .expect("set fake chrome devtools permissions");
        script_path
    }

    fn write_fake_chrome_devtools_research_server_script(temp: &TempDir) -> std::path::PathBuf {
        let script_path = temp.path().join("fake-chrome-devtools-research-mcp.sh");
        let script = r##"#!/bin/sh
probe_state="${TMPDIR:-/tmp}/fake-chrome-devtools-research-probe-state.$$"
while IFS= read -r line; do
  id=$(printf '%s' "$line" | sed -n 's/.*"id":\([0-9][0-9]*\).*/\1/p')
  case "$line" in
    *'"method":"initialize"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"capabilities":{"tools":{"listChanged":true}},"serverInfo":{"name":"fake-chrome-devtools-mcp","version":"0.0.0"},"protocolVersion":"2025-03-26"}}\n' "$id"
      ;;
    *'"method":"notifications/initialized"'*)
      ;;
    *'"method":"tools/list"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"tools":[{"name":"list_pages","description":"List pages","inputSchema":{"type":"object"}},{"name":"select_page","description":"Select page","inputSchema":{"type":"object"}},{"name":"new_page","description":"New page","inputSchema":{"type":"object"}},{"name":"wait_for","description":"Wait","inputSchema":{"type":"object"}},{"name":"evaluate_script","description":"Eval","inputSchema":{"type":"object"}}]}}\n' "$id"
      ;;
    *'"method":"tools/call"'*'"name":"list_pages"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"content":[{"type":"text","text":"Pages\\n1: https://example.com/\\n2: https://chatgpt.com/c/abc123"}],"structuredContent":{"pages":[{"pageId":1,"url":"https://example.com/"},{"pageId":2,"url":"https://chatgpt.com/c/abc123"}]}}}\n' "$id"
      ;;
    *'"method":"tools/call"'*'"name":"select_page"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"structuredContent":{"ok":true,"pageId":2}}}\n' "$id"
      ;;
    *'"method":"tools/call"'*'"name":"new_page"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"structuredContent":{"ok":true,"pageId":3,"url":"https://chatgpt.com/"}}}\n' "$id"
      ;;
    *'"method":"tools/call"'*'"name":"wait_for"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"structuredContent":{"ok":true}}}\n' "$id"
      ;;
    *decision_lab_prepare_page_v4*)
      if [ ! -f "$probe_state" ]; then
        : > "$probe_state"
        printf '{"jsonrpc":"2.0","id":%s,"result":{"structuredContent":{"ok":true,"composerFound":true,"assistantTurnCount":2,"dismissedDialogLabels":["Continue"],"newChatControlFound":true,"isConversationUrl":true}}}\n' "$id"
      else
        printf '{"jsonrpc":"2.0","id":%s,"result":{"structuredContent":{"ok":true,"composerFound":true,"assistantTurnCount":0,"dismissedDialogLabels":["Continue"],"newChatControlFound":true,"isConversationUrl":false}}}\n' "$id"
      fi
      ;;
    *decision_lab_reset_page_v1*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"structuredContent":{"ok":false,"error":"Execution context was destroyed, most likely because of a navigation."}}}\n' "$id"
      ;;
    *decision_lab_fill_and_send_v2*execCommand*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"structuredContent":{"ok":true,"composerFound":true,"usedExecCommand":true,"sendButtonFound":true,"sendButtonEnabled":true,"sendTriggered":true}}}\n' "$id"
      ;;
    *decision_lab_fill_and_send_v2*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"structuredContent":{"ok":false,"error":"missing_exec_command"}}}\n' "$id"
      ;;
    *decision_lab_wait_completion_v3*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"structuredContent":{"ok":true,"assistantTurnCount":4,"matchedUserTurnPresent":true,"matchedAssistantTurnPresent":true,"matchedAssistantResponseActions":true,"matchedAssistantCodeBlockCount":0,"matchedAssistantText":"ChatGPT said:\\nJSON\\n{\\"recommendedRoute\\":\\"stabilize_route\\"}"}}}\n' "$id"
      ;;
    *decision_lab_extract_result_v3*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"structuredContent":{"codeBlock":null,"assistantTurnText":"ChatGPT said:\\nThought for a second\\nJSON\\n{\\"recommendedRoute\\":\\"stabilize_route\\",\\"alternativeRoutes\\":[{\\"id\\":\\"advance_primary_surface\\",\\"label\\":\\"Advance primary surface\\",\\"reason\\":\\"Stabilize dependencies first.\\"}],\\"decisionMemo\\":\\"The official docs support stabilizing the toolchain before widening scope.\\",\\"sources\\":[{\\"label\\":\\"React 19 upgrade guide\\",\\"url\\":\\"https://react.dev/blog/2024/04/25/react-19-upgrade-guide\\",\\"domain\\":\\"react.dev\\"}],\\"confidence\\":\\"high\\",\\"openQuestions\\":[\\"Confirm the current test runner support.\\"],\\"blockedReason\\":null}","title":"ChatGPT","url":"https://chatgpt.com/c/abc123"}}}\n' "$id"
      ;;
    *'"method":"tools/call"'*'"name":"evaluate_script"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"structuredContent":{"ok":false,"error":"unexpected_script"}}}\n' "$id"
      ;;
  esac
done
"##;
        fs::write(&script_path, script).expect("write fake chrome devtools research server script");
        #[cfg(unix)]
        let mut permissions = fs::metadata(&script_path)
            .expect("fake chrome devtools research metadata")
            .permissions();
        #[cfg(unix)]
        permissions.set_mode(0o755);
        #[cfg(unix)]
        fs::set_permissions(&script_path, permissions)
            .expect("set fake chrome devtools research permissions");
        script_path
    }

    #[tokio::test]
    async fn run_browser_debug_operation_executes_chatgpt_decision_lab_via_chrome_devtools() {
        let _guard = browser_debug_env_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let temp = TempDir::new().expect("create temp dir");
        let script_path = write_fake_chrome_devtools_server_script(&temp);

        std::env::set_var(
            BROWSER_DEBUG_CHROME_COMMAND_OVERRIDE_ENV,
            script_path.as_os_str(),
        );
        std::env::set_var(BROWSER_DEBUG_CHROME_ARGS_OVERRIDE_ENV, "[]");

        let request = BrowserDebugRunRequest {
            workspace_id: "ws-browser".to_string(),
            operation: "chatgpt_decision_lab".to_string(),
            browser_url: None,
            prompt: None,
            include_screenshot: Some(false),
            timeout_ms: Some(5_000),
            steps: None,
            decision_lab: Some(BrowserDebugDecisionLabRequest {
                question: "Which route should AutoDrive choose?".to_string(),
                options: vec![
                    BrowserDebugDecisionLabOptionRequest {
                        id: "route-a".to_string(),
                        label: "Route A".to_string(),
                        summary: Some("Safer but slower.".to_string()),
                    },
                    BrowserDebugDecisionLabOptionRequest {
                        id: "route-b".to_string(),
                        label: "Route B".to_string(),
                        summary: Some("Balanced option.".to_string()),
                    },
                ],
                constraints: Some(vec!["No destructive changes".to_string()]),
                allow_live_web_research: Some(false),
                chatgpt_url: None,
            }),
            research_route_lab: None,
        };

        let result = run_chatgpt_decision_lab_operation(temp.path(), &request).await;
        assert!(result.available, "{result:?}");
        assert_eq!(result.status, "completed");
        assert_eq!(result.mode, "mcp-chrome-devtools");
        assert_eq!(result.tool_calls.len(), 10);
        assert!(result
            .warnings
            .iter()
            .any(|warning| warning.contains("fresh task context")));
        assert!(result
            .tool_calls
            .iter()
            .any(|value| value.get("toolName") == Some(&json!("select_page"))));
        assert_eq!(
            result
                .decision_lab
                .as_ref()
                .and_then(|value| value.get("recommendedOptionId")),
            Some(&json!("route-b"))
        );
        assert_eq!(
            result
                .decision_lab
                .as_ref()
                .and_then(|value| value.get("confidence")),
            Some(&json!("high"))
        );

        std::env::remove_var(BROWSER_DEBUG_CHROME_COMMAND_OVERRIDE_ENV);
        std::env::remove_var(BROWSER_DEBUG_CHROME_ARGS_OVERRIDE_ENV);
    }

    #[tokio::test]
    async fn run_browser_debug_operation_executes_chatgpt_research_route_lab_via_chrome_devtools()
    {
        let _guard = browser_debug_env_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let temp = TempDir::new().expect("create temp dir");
        let script_path = write_fake_chrome_devtools_research_server_script(&temp);

        std::env::set_var(
            BROWSER_DEBUG_CHROME_COMMAND_OVERRIDE_ENV,
            script_path.as_os_str(),
        );
        std::env::set_var(BROWSER_DEBUG_CHROME_ARGS_OVERRIDE_ENV, "[]");

        let request = BrowserDebugRunRequest {
            workspace_id: "ws-browser".to_string(),
            operation: "chatgpt_research_route_lab".to_string(),
            browser_url: None,
            prompt: None,
            include_screenshot: Some(false),
            timeout_ms: Some(5_000),
            steps: None,
            decision_lab: None,
            research_route_lab: Some(BrowserDebugResearchRouteLabRequest {
                question: "Which route should AutoDrive choose for the migration task?".to_string(),
                routes: vec![
                    BrowserDebugResearchRouteOptionRequest {
                        id: "advance_primary_surface".to_string(),
                        label: "Advance primary surface".to_string(),
                        summary: Some("Keep implementing the active surface.".to_string()),
                    },
                    BrowserDebugResearchRouteOptionRequest {
                        id: "stabilize_route".to_string(),
                        label: "Stabilize route".to_string(),
                        summary: Some("Use official docs to de-risk the route.".to_string()),
                    },
                ],
                constraints: Some(vec!["Prefer official docs.".to_string()]),
                focus_areas: Some(vec![
                    "Confirm the official React and Vite migration guidance.".to_string(),
                ]),
                trusted_domains: Some(vec!["react.dev".to_string(), "vite.dev".to_string()]),
                allow_live_web_research: Some(true),
                chatgpt_url: None,
            }),
        };

        let result = run_chatgpt_research_route_lab_operation(temp.path(), &request).await;
        assert!(result.available, "{result:?}");
        assert_eq!(result.status, "completed");
        assert_eq!(result.mode, "mcp-chrome-devtools");
        assert!(result
            .warnings
            .iter()
            .any(|warning| warning.contains("fresh task context")));
        assert_eq!(
            result
                .research_route_lab
                .as_ref()
                .and_then(|value| value.get("recommendedRoute")),
            Some(&json!("stabilize_route"))
        );
        assert_eq!(
            result
                .research_route_lab
                .as_ref()
                .and_then(|value| value.get("confidence")),
            Some(&json!("high"))
        );
        assert_eq!(
            result
                .research_route_lab
                .as_ref()
                .and_then(|value| value.get("sources"))
                .and_then(Value::as_array)
                .and_then(|entries| entries.first())
                .and_then(|entry| entry.get("domain")),
            Some(&json!("react.dev"))
        );

        std::env::remove_var(BROWSER_DEBUG_CHROME_COMMAND_OVERRIDE_ENV);
        std::env::remove_var(BROWSER_DEBUG_CHROME_ARGS_OVERRIDE_ENV);
    }
}
