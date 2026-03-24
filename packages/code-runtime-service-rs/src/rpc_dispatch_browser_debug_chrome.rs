use super::*;

fn extract_first_page_id(result: &Value) -> Option<u64> {
    let structured_pages = result
        .get("structuredContent")
        .and_then(Value::as_object)
        .and_then(|content| content.get("pages"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    for page in structured_pages {
        if let Some(page_id) = page.get("pageId").and_then(Value::as_u64) {
            return Some(page_id);
        }
    }
    let content_text = result.get("contentText").and_then(Value::as_str)?;
    for line in content_text.lines() {
        let Some((page_id_raw, _rest)) = line.split_once(':') else {
            continue;
        };
        let Ok(page_id) = page_id_raw.trim().parse::<u64>() else {
            continue;
        };
        return Some(page_id);
    }
    None
}

pub(super) async fn run_chrome_devtools_inspect(
    config: &BrowserDebugMcpLaunchConfig,
    request: &BrowserDebugRunRequest,
    timeout_ms: u64,
) -> BrowserDebugRunSnapshot {
    let browser_url = normalize_browser_debug_browser_url(request.browser_url.as_deref());
    let result = timeout(Duration::from_millis(timeout_ms), async move {
        let mut client = BrowserDebugMcpClient::connect(config).await?;
        let tools = client.list_tools().await?;
        let tool_name_set = tools
            .iter()
            .map(|tool| tool.name.as_str())
            .collect::<std::collections::BTreeSet<_>>();
        if !tool_name_set.contains("take_snapshot") && !tool_name_set.contains("take_screenshot") {
            return Err(
                "Chrome DevTools MCP does not expose take_snapshot or take_screenshot."
                    .to_string(),
            );
        }

        let mut warnings = Vec::new();
        let mut tool_calls = Vec::new();
        if tool_name_set.contains("list_pages") {
            let call_result = client.call_tool("list_pages", None).await?;
            let normalized = normalize_browser_call_result("list_pages", call_result, &mut warnings);
            let first_page_id = extract_first_page_id(&normalized);
            tool_calls.push(normalized);
            if let Some(page_id) = first_page_id {
                if tool_name_set.contains("select_page") {
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
                }
            }
        }

        if tool_name_set.contains("take_snapshot") {
            let call_result = client.call_tool("take_snapshot", None).await?;
            tool_calls.push(normalize_browser_call_result(
                "take_snapshot",
                call_result,
                &mut warnings,
            ));
        } else if tool_name_set.contains("take_screenshot") {
            let call_result = client.call_tool("take_screenshot", None).await?;
            tool_calls.push(normalize_browser_call_result(
                "take_screenshot",
                call_result,
                &mut warnings,
            ));
        }

        if request.include_screenshot.unwrap_or(false)
            && tool_name_set.contains("take_screenshot")
            && !tool_calls.iter().any(|entry| {
                entry.get("toolName") == Some(&Value::String("take_screenshot".to_string()))
            })
        {
            let call_result = client.call_tool("take_screenshot", None).await?;
            tool_calls.push(normalize_browser_call_result(
                "take_screenshot",
                call_result,
                &mut warnings,
            ));
        }

        let stderr = client.close().await;
        if !stderr.trim().is_empty() {
            warnings.push(stderr.trim().to_string());
        }
        Ok::<(Vec<Value>, Vec<String>), String>((tool_calls, warnings))
    })
    .await;

    match result {
        Ok(Ok((tool_calls, warnings))) => {
            let (content_text, structured_content, artifacts) =
                aggregate_browser_tool_call_results(tool_calls.as_slice());
            BrowserDebugRunSnapshot {
                available: true,
                status: "completed",
                mode: "mcp-chrome-devtools",
                browser_url,
                message: request
                    .prompt
                    .as_deref()
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(|prompt| format!("Browser inspect completed for: {prompt}"))
                    .unwrap_or_else(|| "Browser inspect completed.".to_string()),
                tool_calls,
                content_text,
                structured_content,
                artifacts,
                warnings,
                decision_lab: None,
                research_route_lab: None,
            }
        }
        Ok(Err(error)) => BrowserDebugRunSnapshot {
            available: false,
            status: "failed",
            mode: "mcp-chrome-devtools",
            browser_url,
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
            message: "Timed out while running browser debug operation.".to_string(),
            tool_calls: Vec::new(),
            content_text: None,
            structured_content: None,
            artifacts: Vec::new(),
            warnings: vec!["Timed out while running browser debug operation.".to_string()],
            decision_lab: None,
            research_route_lab: None,
        },
    }
}
