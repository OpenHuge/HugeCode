use super::*;
use serde_json::{json, Map, Value};

fn build_decision_lab_request_id() -> String {
    let millis = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    format!("decision-lab-{millis}")
}

fn build_chatgpt_decision_lab_prompt(
    request: &BrowserDebugDecisionLabRequest,
    request_id: &str,
) -> String {
    let options = request
        .options
        .iter()
        .map(|option| {
            let summary = option
                .summary
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .unwrap_or("No summary provided.");
            format!("- id: {}\n  label: {}\n  summary: {}", option.id, option.label, summary)
        })
        .collect::<Vec<_>>()
        .join("\n");
    let constraints = request
        .constraints
        .clone()
        .unwrap_or_default()
        .into_iter()
        .map(|entry| entry.trim().to_string())
        .filter(|entry| !entry.is_empty())
        .collect::<Vec<_>>();
    let research_rule = if request.allow_live_web_research.unwrap_or(false) {
        "You may use live web context if it materially improves the recommendation."
    } else {
        "Do not use live web research. Decide only from the supplied repo/runtime context."
    };
    let constraints_text = if constraints.is_empty() {
        "none".to_string()
    } else {
        constraints.join(" | ")
    };
    [
        "Return exactly one fenced Markdown code block containing valid JSON only.",
        "Do not add any explanation before or after the code block.",
        "Optimize the decision only; do not execute the task.",
        "Choose exactly one recommendedOptionId from the supplied options.",
        research_rule,
        "Use the following request id only as opaque context.",
        &format!("Decision lab request id: {request_id}"),
        "Do not mention the request id in the response.",
        "",
        "Question:",
        request.question.trim(),
        "",
        "Options:",
        options.as_str(),
        "",
        "Constraints:",
        constraints_text.as_str(),
        "",
        "Return JSON with this exact shape:",
        r#"{"recommendedOptionId":"string","recommendedOption":"string","alternativeOptionIds":["string"],"decisionMemo":"string","confidence":"low|medium|high","assumptions":["string"],"followUpQuestions":["string"]}"#,
    ]
    .join("\n")
}

fn build_chatgpt_prepare_page_script() -> &'static str {
    r#"
() => {
  /* decision_lab_prepare_page_v2 */
  const normalizeLabel = (value) => (value ?? '').replace(/\s+/g, ' ').trim();
  const dismissedDialogLabels = [];
  const dismissBlockingDialogs = () => {
    const buttonPatterns = [/^continue$/i, /^close$/i, /^ok$/i, /^dismiss$/i, /^got it$/i, /^not now$/i, /^maybe later$/i];
    for (const button of Array.from(document.querySelectorAll('button'))) {
      const label = normalizeLabel(`${button.getAttribute('aria-label') ?? ''} ${button.textContent ?? ''}`);
      if (!label || button.disabled) {
        continue;
      }
      if (!buttonPatterns.some((pattern) => pattern.test(label))) {
        continue;
      }
      dismissedDialogLabels.push(label);
      button.click();
    }
  };
  dismissBlockingDialogs();
  const assistantTurnCount = Array.from(document.querySelectorAll('main section')).filter((section) => {
    const heading = normalizeLabel(section.querySelector('h4, [role="heading"]')?.textContent ?? '');
    return /^chatgpt said:?$/i.test(heading);
  }).length;
  const composer =
    document.querySelector('#prompt-textarea') ||
    document.querySelector('textarea[placeholder]') ||
    document.querySelector('div[contenteditable="true"][id="prompt-textarea"]') ||
    document.querySelector('div[contenteditable="true"][data-testid="composer"]') ||
    document.querySelector('div[contenteditable="true"]');
  const sendButton = Array.from(document.querySelectorAll('button')).find((button) => {
    const label = normalizeLabel(`${button.getAttribute('aria-label') ?? ''} ${button.textContent ?? ''}`).toLowerCase();
    return /(^send prompt$|^send$| send prompt| send )/.test(label);
  });
  return {
    ok: true,
    composerFound: Boolean(composer),
    sendButtonFound: Boolean(sendButton),
    sendButtonEnabled: Boolean(sendButton) && !sendButton.disabled,
    assistantTurnCount,
    dismissedDialogLabels,
    title: document.title,
    url: window.location.href
  };
}
"#
}

fn build_chatgpt_fill_and_send_script(prompt: &str) -> String {
    let prompt_literal = serde_json::to_string(prompt).unwrap_or_else(|_| "\"\"".to_string());
    format!(
        r#"
async () => {{
  /* decision_lab_fill_and_send_v2 */
  const prompt = {prompt_literal};
  const normalizeLabel = (value) => (value ?? '').replace(/\s+/g, ' ').trim();
  const dismissedDialogLabels = [];
  const dismissBlockingDialogs = () => {{
    const buttonPatterns = [/^continue$/i, /^close$/i, /^ok$/i, /^dismiss$/i, /^got it$/i, /^not now$/i, /^maybe later$/i];
    for (const button of Array.from(document.querySelectorAll('button'))) {{
      const label = normalizeLabel(`${{button.getAttribute('aria-label') ?? ''}} ${{button.textContent ?? ''}}`);
      if (!label || button.disabled) {{
        continue;
      }}
      if (!buttonPatterns.some((pattern) => pattern.test(label))) {{
        continue;
      }}
      dismissedDialogLabels.push(label);
      button.click();
    }}
  }};
  const findComposer = () =>
    document.querySelector('#prompt-textarea') ||
    document.querySelector('textarea[placeholder]') ||
    document.querySelector('div[contenteditable="true"][id="prompt-textarea"]') ||
    document.querySelector('div[contenteditable="true"][data-testid="composer"]') ||
    document.querySelector('div[contenteditable="true"]');
  const findSendButton = () => Array.from(document.querySelectorAll('button')).find((button) => {{
    const label = normalizeLabel(`${{button.getAttribute('aria-label') ?? ''}} ${{button.textContent ?? ''}}`).toLowerCase();
    return /(^send prompt$|^send$| send prompt| send )/.test(label);
  }});
  dismissBlockingDialogs();
  await new Promise((resolve) => setTimeout(resolve, 50));
  const composer =
    findComposer();
  if (!composer) {{
    return {{ ok: false, error: 'composer_not_found', dismissedDialogLabels }};
  }}
  composer.focus();
  let usedExecCommand = false;
  let inserted = false;
  try {{
    if (typeof document.execCommand === 'function') {{
      try {{
        document.execCommand('selectAll', false);
        document.execCommand('delete', false);
      }} catch {{}}
      inserted = document.execCommand('insertText', false, prompt);
      usedExecCommand = inserted;
    }}
  }} catch {{}}
  if ('value' in composer) {{
    if (!inserted) {{
      composer.value = '';
      composer.dispatchEvent(new Event('input', {{ bubbles: true }}));
      composer.value = prompt;
    }}
    composer.dispatchEvent(new Event('input', {{ bubbles: true }}));
  }} else {{
    if (!inserted) {{
      composer.textContent = '';
      composer.dispatchEvent(new InputEvent('beforeinput', {{
        bubbles: true,
        cancelable: true,
        inputType: 'deleteContentBackward',
        data: null
      }}));
      composer.textContent = prompt;
      composer.dispatchEvent(new InputEvent('beforeinput', {{
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: prompt
      }}));
    }}
    composer.dispatchEvent(new InputEvent('input', {{
      bubbles: true,
      inputType: inserted ? 'insertText' : 'insertReplacementText',
      data: prompt
    }}));
    composer.dispatchEvent(new Event('change', {{ bubbles: true }}));
  }}
  await new Promise((resolve) => setTimeout(resolve, 50));
  const sendButton = findSendButton();
  if (!sendButton) {{
    return {{
      ok: false,
      error: 'send_button_not_found',
      composerFound: true,
      usedExecCommand,
      dismissedDialogLabels
    }};
  }}
  if (sendButton.disabled) {{
    return {{
      ok: false,
      error: 'send_button_disabled',
      composerFound: true,
      sendButtonFound: true,
      sendButtonEnabled: false,
      usedExecCommand,
      dismissedDialogLabels
    }};
  }}
  sendButton.click();
  return {{
    ok: true,
    composerFound: true,
    sendButtonFound: true,
    sendButtonEnabled: true,
    sendTriggered: true,
    usedExecCommand,
    dismissedDialogLabels
  }};
}}
"#
    )
}

fn build_chatgpt_completion_wait_script(
    timeout_ms: u64,
    request_id: &str,
    baseline_assistant_turn_count: u64,
) -> String {
    let request_id_literal =
        serde_json::to_string(request_id).unwrap_or_else(|_| "\"\"".to_string());
    format!(
        r#"
async () => {{
  /* decision_lab_wait_completion_v3 */
  const requestId = {request_id_literal};
  const baselineAssistantTurnCount = {baseline_assistant_turn_count};
  return await new Promise((resolve) => {{
    const normalizeLabel = (value) => (value ?? '').replace(/\s+/g, ' ').trim();
    const dismissBlockingDialogs = () => {{
      const buttonPatterns = [/^continue$/i, /^close$/i, /^ok$/i, /^dismiss$/i, /^got it$/i, /^not now$/i, /^maybe later$/i];
      const clicked = [];
      for (const button of Array.from(document.querySelectorAll('button'))) {{
        const label = normalizeLabel(`${{button.getAttribute('aria-label') ?? ''}} ${{button.textContent ?? ''}}`);
        if (!label || button.disabled) {{
          continue;
        }}
        if (!buttonPatterns.some((pattern) => pattern.test(label))) {{
          continue;
        }}
        clicked.push(label);
        button.click();
      }}
      return clicked;
    }};
    const collectTurns = () => Array.from(document.querySelectorAll('main section')).map((section, index) => {{
      const heading = normalizeLabel(section.querySelector('h4, [role="heading"]')?.textContent ?? '');
      const rawText = section.innerText ?? '';
      const buttons = Array.from(section.querySelectorAll('button'))
        .map((button) => normalizeLabel(`${{button.getAttribute('aria-label') ?? ''}} ${{button.textContent ?? ''}}`))
        .filter(Boolean);
      return {{
        index,
        heading,
        rawText,
        normalizedText: normalizeLabel(rawText),
        buttons,
        responseActionVisible: buttons.some((label) => /copy response|good response|bad response|share|more actions|switch model/i.test(label)),
        codeBlockCount: section.querySelectorAll('pre code').length
      }};
    }});
    const findRequestTurns = () => {{
      const turns = collectTurns();
      const assistantTurnCount = turns.filter((turn) => /^chatgpt said:?$/i.test(turn.heading)).length;
      let userTurn = null;
      for (const turn of turns) {{
        if (/^you said:?$/i.test(turn.heading) && turn.normalizedText.includes(requestId)) {{
          userTurn = turn;
        }}
      }}
      let assistantTurn = null;
      if (userTurn) {{
        assistantTurn = turns.find((turn) => turn.index > userTurn.index && /^chatgpt said:?$/i.test(turn.heading)) ?? null;
      }}
      return {{ turns, assistantTurnCount, userTurn, assistantTurn }};
    }};
    const readState = () => {{
      const buttons = Array.from(document.querySelectorAll('button'));
      const stopStreaming = buttons.some((button) => {{
        const label = normalizeLabel(`${{button.getAttribute('aria-label') ?? ''}} ${{button.textContent ?? ''}}`).toLowerCase();
        return /stop streaming/.test(label);
      }});
      const {{ assistantTurnCount, userTurn, assistantTurn }} = findRequestTurns();
      const matchedAssistantText = assistantTurn?.rawText ?? null;
      return {{
        stopStreaming,
        assistantTurnCount,
        matchedUserTurnPresent: Boolean(userTurn),
        matchedAssistantTurnPresent: Boolean(assistantTurn),
        matchedAssistantText,
        matchedAssistantResponseActions: assistantTurn?.responseActionVisible ?? false,
        matchedAssistantCodeBlockCount: assistantTurn?.codeBlockCount ?? 0,
        title: document.title,
        url: window.location.href
      }};
    }};
    const start = Date.now();
    let readySince = null;
    const tick = () => {{
      const dismissedDialogLabels = dismissBlockingDialogs();
      const state = readState();
      const assistantTextReady =
        typeof state.matchedAssistantText === 'string' &&
        normalizeLabel(state.matchedAssistantText).length > 'ChatGPT said:'.length + 16;
      const ready =
        state.matchedUserTurnPresent &&
        state.matchedAssistantTurnPresent &&
        state.assistantTurnCount > baselineAssistantTurnCount &&
        !state.stopStreaming &&
        (
          state.matchedAssistantResponseActions ||
          state.matchedAssistantCodeBlockCount > 0 ||
          assistantTextReady
        );
      if (ready) {{
        if (readySince === null) {{
          readySince = Date.now();
        }}
        if (Date.now() - readySince >= 1200) {{
          resolve({{ ok: true, dismissedDialogLabels, ...state }});
          return;
        }}
      }} else {{
        readySince = null;
      }}
      if (Date.now() - start >= {timeout_ms}) {{
        resolve({{ ok: false, error: 'timeout_waiting_for_completion', dismissedDialogLabels, ...state }});
        return;
      }}
      setTimeout(tick, 250);
    }};
    tick();
  }});
}}
"#
    )
}

fn build_chatgpt_extract_code_block_script(request_id: &str) -> String {
    let request_id_literal =
        serde_json::to_string(request_id).unwrap_or_else(|_| "\"\"".to_string());
    format!(
        r#"
() => {{
  /* decision_lab_extract_result_v3 */
  const requestId = {request_id_literal};
  const normalizeLabel = (value) => (value ?? '').replace(/\s+/g, ' ').trim();
  const turns = Array.from(document.querySelectorAll('main section')).map((section, index) => {{
    const heading = normalizeLabel(section.querySelector('h4, [role="heading"]')?.textContent ?? '');
    return {{
      index,
      section,
      heading,
      rawText: section.innerText ?? '',
      normalizedText: normalizeLabel(section.innerText ?? '')
    }};
  }});
  let userTurn = null;
  for (const turn of turns) {{
    if (/^you said:?$/i.test(turn.heading) && turn.normalizedText.includes(requestId)) {{
      userTurn = turn;
    }}
  }}
  const assistantTurn = userTurn
    ? turns.find((turn) => turn.index > userTurn.index && /^chatgpt said:?$/i.test(turn.heading)) ?? null
    : turns.filter((turn) => /^chatgpt said:?$/i.test(turn.heading)).at(-1) ?? null;
  const assistantCodeBlocks = assistantTurn
    ? Array.from(assistantTurn.section.querySelectorAll('pre code'))
    : [];
  const codeBlock = assistantCodeBlocks.length > 0
    ? assistantCodeBlocks[assistantCodeBlocks.length - 1].innerText
    : null;
  const responseText =
    document.querySelector('main')?.innerText ??
    document.body?.innerText ??
    null;
  return {{
    codeBlock,
    assistantTurnText: assistantTurn?.rawText ?? null,
    requestIdMatched: Boolean(userTurn),
    responseText,
    title: document.title,
    url: window.location.href
  }};
}}
"#
    )
}

fn extract_last_fenced_code_block(text: &str) -> Option<String> {
    let mut cursor = text;
    let mut last = None;
    while let Some(start) = cursor.find("```") {
        let after_start = &cursor[start + 3..];
        let body_start = after_start.find('\n').map(|index| index + 1).unwrap_or(0);
        let after_language = &after_start[body_start..];
        let Some(end) = after_language.find("```") else {
            break;
        };
        let candidate = after_language[..end].trim();
        if !candidate.is_empty() {
            last = Some(candidate.to_string());
        }
        cursor = &after_language[end + 3..];
    }
    last
}

fn extract_last_json_object(text: &str) -> Option<String> {
    fn find_balanced_json_object_end(input: &str) -> Option<usize> {
        let mut depth = 0usize;
        let mut in_string = false;
        let mut escaped = false;
        for (index, ch) in input.char_indices() {
            if in_string {
                if escaped {
                    escaped = false;
                    continue;
                }
                match ch {
                    '\\' => escaped = true,
                    '"' => in_string = false,
                    _ => {}
                }
                continue;
            }
            match ch {
                '"' => in_string = true,
                '{' => depth += 1,
                '}' => {
                    if depth == 0 {
                        return None;
                    }
                    depth -= 1;
                    if depth == 0 {
                        return Some(index + ch.len_utf8());
                    }
                }
                _ => {}
            }
        }
        None
    }

    let mut last = None;
    for (start, ch) in text.char_indices() {
        if ch != '{' {
            continue;
        }
        let Some(end) = find_balanced_json_object_end(&text[start..]) else {
            continue;
        };
        let candidate = text[start..start + end].trim();
        if candidate.is_empty() {
            continue;
        }
        if serde_json::from_str::<Value>(candidate).is_ok() {
            last = Some(candidate.to_string());
        }
    }
    last
}

fn extract_decision_lab_json_candidate(extract_object: &Map<String, Value>) -> Option<String> {
    if let Some(code_block) = extract_object
        .get("codeBlock")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return Some(code_block.to_string());
    }
    if let Some(assistant_turn_text) = extract_object
        .get("assistantTurnText")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        if let Some(code_block) = extract_last_fenced_code_block(assistant_turn_text) {
            return Some(code_block);
        }
        if let Some(json_object) = extract_last_json_object(assistant_turn_text) {
            return Some(json_object);
        }
    }
    if let Some(response_text) = extract_object
        .get("responseText")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        if let Some(code_block) = extract_last_fenced_code_block(response_text) {
            return Some(code_block);
        }
        if let Some(json_object) = extract_last_json_object(response_text) {
            return Some(json_object);
        }
    }
    None
}

fn extract_structured_object(result: &Value) -> Option<Map<String, Value>> {
    result
        .get("structuredContent")
        .and_then(Value::as_object)
        .cloned()
        .or_else(|| {
            result
                .get("contentText")
                .and_then(Value::as_str)
                .and_then(extract_last_fenced_code_block)
                .and_then(|candidate| serde_json::from_str::<Value>(candidate.as_str()).ok())
                .and_then(|value| value.as_object().cloned())
        })
}

fn extract_content_text(result: &Value) -> Option<String> {
    result
        .get("contentText")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn normalize_decision_lab_result_payload(value: &Value) -> Option<Value> {
    let object = value.as_object()?;
    let confidence = object
        .get("confidence")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| matches!(*value, "low" | "medium" | "high"))
        .map(ToOwned::to_owned);
    Some(json!({
        "recommendedOptionId": object.get("recommendedOptionId").and_then(Value::as_str).map(str::trim).filter(|value| !value.is_empty()),
        "recommendedOption": object.get("recommendedOption").and_then(Value::as_str).map(str::trim).filter(|value| !value.is_empty()),
        "alternativeOptionIds": object.get("alternativeOptionIds").and_then(Value::as_array).map(|entries| {
            entries.iter().filter_map(Value::as_str).map(str::trim).filter(|value| !value.is_empty()).map(ToOwned::to_owned).collect::<Vec<_>>()
        }).unwrap_or_default(),
        "decisionMemo": object.get("decisionMemo").and_then(Value::as_str).map(str::trim).filter(|value| !value.is_empty()),
        "confidence": confidence,
        "assumptions": object.get("assumptions").and_then(Value::as_array).map(|entries| {
            entries.iter().filter_map(Value::as_str).map(str::trim).filter(|value| !value.is_empty()).map(ToOwned::to_owned).collect::<Vec<_>>()
        }).unwrap_or_default(),
        "followUpQuestions": object.get("followUpQuestions").and_then(Value::as_array).map(|entries| {
            entries.iter().filter_map(Value::as_str).map(str::trim).filter(|value| !value.is_empty()).map(ToOwned::to_owned).collect::<Vec<_>>()
        }).unwrap_or_default(),
    }))
}

fn extract_decision_lab_step_error(result: &Value) -> Option<String> {
    if result.get("ok").and_then(Value::as_bool) == Some(false) {
        if let Some(error) = result.get("error").and_then(Value::as_str) {
            let trimmed = error.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
        return extract_content_text(result);
    }
    if let Some(structured) = extract_structured_object(result) {
        if structured.get("ok").and_then(Value::as_bool) == Some(false) {
            if let Some(error) = structured.get("error").and_then(Value::as_str) {
                let trimmed = error.trim();
                if !trimmed.is_empty() {
                    return Some(trimmed.to_string());
                }
            }
            return Some("unknown_decision_lab_step_error".to_string());
        }
    }
    None
}

fn page_matches_chatgpt_url(candidate_url: &str, chatgpt_url: &str) -> bool {
    let candidate = candidate_url.trim().trim_end_matches('/');
    let target = chatgpt_url.trim().trim_end_matches('/');
    if candidate.is_empty() || target.is_empty() {
        return false;
    }
    candidate.starts_with(target)
        || target.starts_with(candidate)
        || (candidate.contains("chatgpt.com") && target.contains("chatgpt.com"))
}

fn extract_chatgpt_page_id(result: &Value, chatgpt_url: &str) -> Option<u64> {
    let structured_pages = result
        .get("structuredContent")
        .and_then(Value::as_object)
        .and_then(|object| object.get("pages"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    for page in structured_pages {
        let Some(page_id) = page.get("pageId").and_then(Value::as_u64) else {
            continue;
        };
        let Some(url) = page.get("url").and_then(Value::as_str) else {
            continue;
        };
        if page_matches_chatgpt_url(url, chatgpt_url) {
            return Some(page_id);
        }
    }
    let content_text = extract_content_text(result)?;
    for line in content_text.lines() {
        let Some((page_id_raw, url_raw)) = line.split_once(':') else {
            continue;
        };
        let Ok(page_id) = page_id_raw.trim().parse::<u64>() else {
            continue;
        };
        if page_matches_chatgpt_url(url_raw.trim(), chatgpt_url) {
            return Some(page_id);
        }
    }
    None
}

pub(super) async fn run_chatgpt_decision_lab_operation(
    workspace_path: &Path,
    request: &BrowserDebugRunRequest,
) -> BrowserDebugRunSnapshot {
    let Some(decision_lab_request) = request.decision_lab.as_ref() else {
        return BrowserDebugRunSnapshot {
            available: false,
            status: "failed",
            mode: "mcp-chrome-devtools",
            message: "ChatGPT decision lab requires a decisionLab payload.".to_string(),
            tool_calls: Vec::new(),
            content_text: None,
            structured_content: None,
            artifacts: Vec::new(),
            warnings: vec!["ChatGPT decision lab requires a decisionLab payload.".to_string()],
            decision_lab: None,
        };
    };
    let Ok(Some(config)) = resolve_chrome_devtools_mcp_launch_config(workspace_path) else {
        return BrowserDebugRunSnapshot {
            available: false,
            status: "blocked",
            mode: "mcp-chrome-devtools",
            message: "Chrome DevTools MCP is unavailable for the ChatGPT decision lab.".to_string(),
            tool_calls: Vec::new(),
            content_text: None,
            structured_content: None,
            artifacts: Vec::new(),
            warnings: vec![
                "Chrome DevTools MCP is unavailable. Install Node/npx and provide a connectable Chrome session.".to_string(),
            ],
            decision_lab: None,
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
    let result = timeout(Duration::from_millis(timeout_ms), async move {
        let mut client = BrowserDebugMcpClient::connect(&config).await?;
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
            return Err(
                "Chrome DevTools MCP requires either list_pages/select_page or new_page for the ChatGPT decision lab."
                    .to_string(),
            );
        }

        let mut warnings = Vec::new();
        let mut tool_calls = Vec::new();
        if can_reuse_existing_page {
            let call_result = client.call_tool("list_pages", None).await?;
            let normalized = normalize_browser_call_result("list_pages", call_result, &mut warnings);
            let existing_page_id = extract_chatgpt_page_id(&normalized, chatgpt_url);
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
            } else if can_open_new_page {
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

        let prepare_result = client
            .call_tool(
                "evaluate_script",
                Some(Map::from_iter([(
                    "function".to_string(),
                    Value::String(build_chatgpt_prepare_page_script().to_string()),
                )])),
            )
            .await?;
        let prepare_result =
            normalize_browser_call_result("evaluate_script", prepare_result, &mut warnings);
        if let Some(error) = extract_decision_lab_step_error(&prepare_result) {
            return Err(format!("ChatGPT decision lab browser step failed: {error}"));
        }
        let baseline_assistant_turn_count = extract_structured_object(&prepare_result)
            .and_then(|object| object.get("assistantTurnCount").and_then(Value::as_u64))
            .unwrap_or(0);
        tool_calls.push(prepare_result);

        for (tool_name, arguments) in [
            (
                "evaluate_script",
                Some(Map::from_iter([(
                    "function".to_string(),
                    Value::String(build_chatgpt_fill_and_send_script(prompt.as_str())),
                )])),
            ),
            (
                "evaluate_script",
                Some(Map::from_iter([(
                    "function".to_string(),
                    Value::String(build_chatgpt_completion_wait_script(
                        timeout_ms,
                        request_id.as_str(),
                        baseline_assistant_turn_count,
                    )),
                )])),
            ),
            (
                "evaluate_script",
                Some(Map::from_iter([(
                    "function".to_string(),
                    Value::String(build_chatgpt_extract_code_block_script(request_id.as_str())),
                )])),
            ),
        ] {
            let call_result = client.call_tool(tool_name, arguments).await?;
            let normalized = normalize_browser_call_result(tool_name, call_result, &mut warnings);
            if tool_name == "evaluate_script" {
                if let Some(error) = extract_decision_lab_step_error(&normalized) {
                    return Err(format!("ChatGPT decision lab browser step failed: {error}"));
                }
            }
            tool_calls.push(normalized);
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
            let extract_result = tool_calls.last().cloned().unwrap_or(Value::Null);
            let extract_object = extract_structured_object(&extract_result).unwrap_or_default();
            let code_block = extract_decision_lab_json_candidate(&extract_object);
            let Some(code_block) = code_block else {
                return BrowserDebugRunSnapshot {
                    available: false,
                    status: "failed",
                    mode: "mcp-chrome-devtools",
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
                };
            };
            let parsed_json = match serde_json::from_str::<Value>(code_block.as_str()) {
                Ok(value) => value,
                Err(error) => {
                    return BrowserDebugRunSnapshot {
                        available: false,
                        status: "failed",
                        mode: "mcp-chrome-devtools",
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
                    }
                }
            };
            let decision_lab = normalize_decision_lab_result_payload(&parsed_json);
            BrowserDebugRunSnapshot {
                available: true,
                status: "completed",
                mode: "mcp-chrome-devtools",
                message: "ChatGPT decision lab completed.".to_string(),
                tool_calls,
                content_text,
                structured_content,
                artifacts,
                warnings,
                decision_lab,
            }
        }
        Ok(Err(error)) => BrowserDebugRunSnapshot {
            available: false,
            status: "failed",
            mode: "mcp-chrome-devtools",
            message: error.clone(),
            tool_calls: Vec::new(),
            content_text: None,
            structured_content: None,
            artifacts: Vec::new(),
            warnings: vec![error],
            decision_lab: None,
        },
        Err(_) => BrowserDebugRunSnapshot {
            available: false,
            status: "failed",
            mode: "mcp-chrome-devtools",
            message: "Timed out while running the ChatGPT decision lab.".to_string(),
            tool_calls: Vec::new(),
            content_text: None,
            structured_content: None,
            artifacts: Vec::new(),
            warnings: vec!["Timed out while running the ChatGPT decision lab.".to_string()],
            decision_lab: None,
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

    fn write_fake_chrome_devtools_server_script(temp: &TempDir) -> std::path::PathBuf {
        let script_path = temp.path().join("fake-chrome-devtools-mcp.sh");
        let script = r##"#!/bin/sh
while IFS= read -r line; do
  id=$(printf '%s' "$line" | sed -n 's/.*"id":\([0-9][0-9]*\).*/\1/p')
  case "$line" in
    *'"method":"initialize"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"capabilities":{"tools":{"listChanged":true}},"serverInfo":{"name":"fake-chrome-devtools-mcp","version":"0.0.0"},"protocolVersion":"2025-03-26"}}\n' "$id"
      ;;
    *'"method":"notifications/initialized"'*)
      ;;
    *'"method":"tools/list"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"tools":[{"name":"list_pages","description":"List pages","inputSchema":{"type":"object"}},{"name":"select_page","description":"Select page","inputSchema":{"type":"object"}},{"name":"wait_for","description":"Wait","inputSchema":{"type":"object"}},{"name":"evaluate_script","description":"Eval","inputSchema":{"type":"object"}}]}}\n' "$id"
      ;;
    *'"method":"tools/call"'*'"name":"list_pages"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"content":[{"type":"text","text":"Pages\\n1: https://example.com/\\n2: https://chatgpt.com/c/abc123"}],"structuredContent":{"pages":[{"pageId":1,"url":"https://example.com/"},{"pageId":2,"url":"https://chatgpt.com/c/abc123"}]}}}\n' "$id"
      ;;
    *'"method":"tools/call"'*'"name":"select_page"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"structuredContent":{"ok":true,"pageId":2}}}\n' "$id"
      ;;
    *'"method":"tools/call"'*'"name":"wait_for"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"structuredContent":{"ok":true}}}\n' "$id"
      ;;
    *decision_lab_prepare_page_v2*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"structuredContent":{"ok":true,"composerFound":true,"assistantTurnCount":3,"dismissedDialogLabels":["Continue"]}}}\n' "$id"
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
        };

        let result = run_chatgpt_decision_lab_operation(temp.path(), &request).await;
        assert!(result.available, "{result:?}");
        assert_eq!(result.status, "completed");
        assert_eq!(result.mode, "mcp-chrome-devtools");
        assert_eq!(result.tool_calls.len(), 7);
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
}
