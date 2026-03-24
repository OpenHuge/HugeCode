use super::*;
use serde_json::{json, Map, Value};

pub(super) fn build_decision_lab_request_id() -> String {
    let millis = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    format!("decision-lab-{millis}")
}

pub(super) fn build_chatgpt_decision_lab_prompt(
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
        "Treat this as an isolated task. Ignore unrelated earlier chat history unless it is repeated in the current request.",
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

pub(super) fn build_chatgpt_research_route_lab_prompt(
    request: &BrowserDebugResearchRouteLabRequest,
    request_id: &str,
) -> String {
    let routes = request
        .routes
        .iter()
        .map(|route| {
            let summary = route
                .summary
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .unwrap_or("No summary provided.");
            format!("- id: {}\n  label: {}\n  summary: {}", route.id, route.label, summary)
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
    let trusted_domains = request
        .trusted_domains
        .clone()
        .unwrap_or_default()
        .into_iter()
        .map(|entry| entry.trim().to_string())
        .filter(|entry| !entry.is_empty())
        .collect::<Vec<_>>();
    let research_rule = if request.allow_live_web_research.unwrap_or(false) {
        "You may use live web context, but cite only official or explicitly trusted sources."
    } else {
        "Do not browse broadly. Limit reasoning to the supplied context and trusted official sources."
    };
    let constraints_text = if constraints.is_empty() {
        "none".to_string()
    } else {
        constraints.join(" | ")
    };
    let trusted_text = if trusted_domains.is_empty() {
        "official framework or vendor documentation only".to_string()
    } else {
        trusted_domains.join(" | ")
    };
    [
        "Return exactly one fenced Markdown code block containing valid JSON only.",
        "Do not add any explanation before or after the code block.",
        "Treat this as a research and route-selection task only. Do not execute any code or external write actions.",
        "Choose exactly one recommendedRoute from the supplied routes unless you must block the task.",
        research_rule,
        "Use only official or explicitly trusted sources. If you cannot satisfy that constraint, return blockedReason.",
        "If you cannot justify a route from trusted sources, set recommendedRoute to null and explain the gap in blockedReason.",
        "Treat this as an isolated task. Ignore unrelated earlier chat history unless it is repeated in the current request.",
        "Use the following request id only as opaque context.",
        &format!("Research route request id: {request_id}"),
        "Do not mention the request id in the response.",
        "",
        "Question:",
        request.question.trim(),
        "",
        "Routes:",
        routes.as_str(),
        "",
        "Constraints:",
        constraints_text.as_str(),
        "",
        "Trusted source domains:",
        trusted_text.as_str(),
        "",
        "Return JSON with this exact shape:",
        r#"{"recommendedRoute":"string|null","alternativeRoutes":[{"id":"string","label":"string","reason":"string"}],"decisionMemo":"string","sources":[{"label":"string","url":"string|null","domain":"string"}],"confidence":"low|medium|high|null","openQuestions":["string"],"blockedReason":"string|null"}"#,
    ]
    .join("\n")
}

pub(super) fn build_chatgpt_prepare_page_script() -> String {
    r#"
async () => {
  /* decision_lab_prepare_page_v4 */
  const normalizeLabel = (value) => (value ?? '').replace(/\s+/g, ' ').trim();
  const pageText = () => normalizeLabel(document.body?.innerText ?? '');
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
  const readAssistantTurnCount = () => Array.from(document.querySelectorAll('main section')).filter((section) => {
    const heading = normalizeLabel(section.querySelector('h4, [role="heading"]')?.textContent ?? '');
    return /^chatgpt said:?$/i.test(heading);
  }).length;
  const findNewChatControl = () => Array.from(document.querySelectorAll('a, button')).find((element) => {
    const label = normalizeLabel(`${element.getAttribute('aria-label') ?? ''} ${element.textContent ?? ''}`);
    return /^new chat$/i.test(label);
  });
  const isConversationUrl = () => /^\/c(\/|$)/.test(window.location.pathname);
  dismissBlockingDialogs();
  const textSnapshot = pageText();
  const authRequired =
    /\/auth(\/|$)/.test(window.location.pathname) ||
    /\b(log in|sign up for free|get started)\b/i.test(textSnapshot);
  const planBlockedMessage = [
    /team plan failed to renew/i,
    /workspace will be deactivated/i,
  ]
    .map((pattern) => textSnapshot.match(pattern)?.[0] ?? null)
    .filter(Boolean)
    .join(' | ');
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
    assistantTurnCount: readAssistantTurnCount(),
    dismissedDialogLabels,
    newChatControlFound: Boolean(findNewChatControl()),
    isConversationUrl: isConversationUrl(),
    authRequired,
    planBlockedMessage: planBlockedMessage || null,
    title: document.title,
    url: window.location.href
  };
}
"#
    .to_string()
}

pub(super) fn build_chatgpt_reset_page_script(chatgpt_url: &str) -> String {
    let chatgpt_url_literal =
        serde_json::to_string(chatgpt_url).unwrap_or_else(|_| "\"https://chatgpt.com/\"".to_string());
    format!(
        r#"
async () => {{
  /* decision_lab_reset_page_v1 */
  const chatgptUrl = {chatgpt_url_literal};
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
  const findNewChatControl = () => Array.from(document.querySelectorAll('a, button')).find((element) => {{
    const label = normalizeLabel(`${{element.getAttribute('aria-label') ?? ''}} ${{element.textContent ?? ''}}`);
    return /^new chat$/i.test(label);
  }});
  dismissBlockingDialogs();
  const newChatControl = findNewChatControl();
  if (newChatControl) {{
    newChatControl.click();
    return {{
      ok: true,
      action: 'new_chat_click',
      dismissedDialogLabels
    }};
  }}
  if (window.location.href !== chatgptUrl) {{
    window.location.assign(chatgptUrl);
    return {{
      ok: true,
      action: 'navigate_home',
      dismissedDialogLabels
    }};
  }}
  return {{
    ok: true,
    action: 'noop',
    dismissedDialogLabels
  }};
}}
"#
    )
}

pub(super) fn build_chatgpt_fill_and_send_script(prompt: &str) -> String {
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
  const readComposerText = () => {{
    const currentComposer = findComposer();
    if (!currentComposer) {{
      return '';
    }}
    if ('value' in currentComposer && typeof currentComposer.value === 'string') {{
      return currentComposer.value;
    }}
    return currentComposer.textContent ?? '';
  }};
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
  let sendButton = findSendButton();
  const enableDeadline = Date.now() + 2500;
  while ((!sendButton || sendButton.disabled) && Date.now() < enableDeadline) {{
    dismissBlockingDialogs();
    composer.dispatchEvent(new Event('input', {{ bubbles: true }}));
    composer.dispatchEvent(new Event('change', {{ bubbles: true }}));
    await new Promise((resolve) => setTimeout(resolve, 100));
    sendButton = findSendButton();
  }}
  if (!sendButton) {{
    return {{
      ok: false,
      error: 'send_button_not_found',
      composerFound: true,
      composerTextLength: readComposerText().trim().length,
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
      composerTextLength: readComposerText().trim().length,
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

pub(super) fn build_chatgpt_completion_wait_script(
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

pub(super) fn build_chatgpt_extract_code_block_script(request_id: &str) -> String {
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

pub(super) fn extract_last_fenced_code_block(text: &str) -> Option<String> {
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

pub(super) fn extract_last_json_object(text: &str) -> Option<String> {
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

    let mut best: Option<String> = None;
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
            let replace = best
                .as_ref()
                .map(|current| candidate.len() >= current.len())
                .unwrap_or(true);
            if replace {
                best = Some(candidate.to_string());
            }
        }
    }
    best
}

pub(super) fn extract_decision_lab_json_candidate(extract_object: &Map<String, Value>) -> Option<String> {
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

pub(super) fn extract_structured_object(result: &Value) -> Option<Map<String, Value>> {
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

pub(super) fn extract_content_text(result: &Value) -> Option<String> {
    result
        .get("contentText")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

pub(super) fn normalize_decision_lab_result_payload(value: &Value) -> Option<Value> {
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

pub(super) fn normalize_trusted_domain(value: &str) -> Option<String> {
    let trimmed = value.trim().trim_start_matches("*.").trim_start_matches('.');
    if trimmed.is_empty() {
        return None;
    }
    Some(trimmed.to_ascii_lowercase())
}

pub(super) fn source_matches_trusted_domain(source_domain: &str, trusted_domains: &[String]) -> bool {
    let Some(source_domain) = normalize_trusted_domain(source_domain) else {
        return false;
    };
    trusted_domains.iter().any(|trusted_domain| {
        let Some(trusted_domain) = normalize_trusted_domain(trusted_domain.as_str()) else {
            return false;
        };
        source_domain == trusted_domain
            || source_domain.ends_with(format!(".{trusted_domain}").as_str())
    })
}

pub(super) fn normalize_research_route_lab_result_payload(
    value: &Value,
    trusted_domains: &[String],
    allowed_route_ids: &[String],
) -> Option<Value> {
    let object = value.as_object()?;
    let confidence = object
        .get("confidence")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| matches!(*value, "low" | "medium" | "high"))
        .map(ToOwned::to_owned);
    let recommended_route = object
        .get("recommendedRoute")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);

    let sources = object
        .get("sources")
        .and_then(Value::as_array)
        .map(|entries| {
            entries
                .iter()
                .filter_map(Value::as_object)
                .filter_map(|entry| {
                    let label = entry
                        .get("label")
                        .and_then(Value::as_str)
                        .map(str::trim)
                        .filter(|value| !value.is_empty())
                        .map(ToOwned::to_owned);
                    let url = entry
                        .get("url")
                        .and_then(Value::as_str)
                        .map(str::trim)
                        .filter(|value| !value.is_empty())
                        .map(ToOwned::to_owned);
                    let derived_domain = url
                        .as_deref()
                        .and_then(|value| reqwest::Url::parse(value).ok())
                        .and_then(|value| value.host_str().map(ToOwned::to_owned));
                    let domain = entry
                        .get("domain")
                        .and_then(Value::as_str)
                        .map(str::trim)
                        .filter(|value| !value.is_empty())
                        .map(ToOwned::to_owned)
                        .or(derived_domain);
                    if label.is_none() && url.is_none() && domain.is_none() {
                        return None;
                    }
                    Some(json!({
                        "label": label,
                        "url": url,
                        "domain": domain,
                    }))
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let untrusted_sources = if trusted_domains.is_empty() {
        Vec::new()
    } else {
        sources
            .iter()
            .filter_map(|entry| entry.get("domain").and_then(Value::as_str))
            .filter(|domain| !source_matches_trusted_domain(domain, trusted_domains))
            .map(ToOwned::to_owned)
            .collect::<Vec<_>>()
    };

    let blocked_reason = object
        .get("blockedReason")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .or_else(|| {
            if recommended_route.is_none() {
                Some("missing_recommended_route".to_string())
            } else if !allowed_route_ids.is_empty()
                && recommended_route
                    .as_ref()
                    .is_some_and(|route| !allowed_route_ids.iter().any(|candidate| candidate == route))
            {
                recommended_route
                    .as_ref()
                    .map(|route| format!("invalid_recommended_route:{route}"))
            } else if sources.is_empty() {
                Some("missing_trusted_sources".to_string())
            } else if !untrusted_sources.is_empty() {
                Some(format!(
                    "untrusted_source_domains:{}",
                    untrusted_sources.join(",")
                ))
            } else {
                None
            }
        });

    Some(json!({
        "recommendedRoute": recommended_route,
        "alternativeRoutes": object.get("alternativeRoutes").and_then(Value::as_array).map(|entries| {
            entries.iter().filter_map(Value::as_object).map(|entry| {
                json!({
                    "id": entry.get("id").and_then(Value::as_str).map(str::trim).filter(|value| !value.is_empty()),
                    "label": entry.get("label").and_then(Value::as_str).map(str::trim).filter(|value| !value.is_empty()),
                    "reason": entry.get("reason").and_then(Value::as_str).map(str::trim).filter(|value| !value.is_empty()),
                })
            }).collect::<Vec<_>>()
        }).unwrap_or_default(),
        "decisionMemo": object.get("decisionMemo").and_then(Value::as_str).map(str::trim).filter(|value| !value.is_empty()),
        "sources": sources,
        "confidence": confidence,
        "openQuestions": object.get("openQuestions").and_then(Value::as_array).map(|entries| {
            entries.iter().filter_map(Value::as_str).map(str::trim).filter(|value| !value.is_empty()).map(ToOwned::to_owned).collect::<Vec<_>>()
        }).unwrap_or_default(),
        "blockedReason": blocked_reason,
    }))
}

pub(super) fn extract_decision_lab_step_error(result: &Value) -> Option<String> {
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
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_research_route_lab_result_payload_marks_missing_sources_as_blocked() {
        let value = json!({
            "recommendedRoute": "route-a",
            "alternativeRoutes": [],
            "decisionMemo": "Prefer route A.",
            "sources": [],
            "confidence": "high",
            "openQuestions": [],
            "blockedReason": null
        });
        let result = normalize_research_route_lab_result_payload(&value, &[], &[])
            .expect("normalized research payload");
        assert_eq!(
            result.get("blockedReason"),
            Some(&json!("missing_trusted_sources"))
        );
    }

    #[test]
    fn normalize_research_route_lab_result_payload_blocks_untrusted_sources() {
        let value = json!({
            "recommendedRoute": "route-a",
            "alternativeRoutes": [],
            "decisionMemo": "Prefer route A.",
            "sources": [
                {
                    "label": "Random blog",
                    "url": "https://example.com/post",
                    "domain": "example.com"
                }
            ],
            "confidence": "medium",
            "openQuestions": [],
            "blockedReason": null
        });
        let result = normalize_research_route_lab_result_payload(
            &value,
            &["react.dev".to_string(), "vite.dev".to_string()],
            &["route-a".to_string()],
        )
        .expect("normalized research payload");
        assert_eq!(
            result.get("blockedReason"),
            Some(&json!("untrusted_source_domains:example.com"))
        );
    }

    #[test]
    fn normalize_research_route_lab_result_payload_marks_missing_route_as_blocked() {
        let value = json!({
            "recommendedRoute": null,
            "alternativeRoutes": [],
            "decisionMemo": "Need more evidence.",
            "sources": [
                {
                    "label": "React 19 upgrade guide",
                    "url": "https://react.dev/blog/2024/04/25/react-19-upgrade-guide",
                    "domain": "react.dev"
                }
            ],
            "confidence": "medium",
            "openQuestions": [],
            "blockedReason": null
        });
        let result = normalize_research_route_lab_result_payload(
            &value,
            &["react.dev".to_string()],
            &["route-a".to_string()],
        )
        .expect("normalized research payload");
        assert_eq!(
            result.get("blockedReason"),
            Some(&json!("missing_recommended_route"))
        );
    }

    #[test]
    fn normalize_research_route_lab_result_payload_blocks_routes_outside_candidate_set() {
        let value = json!({
            "recommendedRoute": "route-z",
            "alternativeRoutes": [],
            "decisionMemo": "Prefer route z.",
            "sources": [
                {
                    "label": "React 19 upgrade guide",
                    "url": "https://react.dev/blog/2024/04/25/react-19-upgrade-guide",
                    "domain": "react.dev"
                }
            ],
            "confidence": "high",
            "openQuestions": [],
            "blockedReason": null
        });
        let result = normalize_research_route_lab_result_payload(
            &value,
            &["react.dev".to_string()],
            &["route-a".to_string(), "route-b".to_string()],
        )
        .expect("normalized research payload");
        assert_eq!(
            result.get("blockedReason"),
            Some(&json!("invalid_recommended_route:route-z"))
        );
    }
}

pub(super) fn is_navigation_context_reset_error(error: &str) -> bool {
    let normalized = error.trim().to_ascii_lowercase();
    normalized.contains("execution context was destroyed")
        || normalized.contains("cannot find context with specified id")
}

pub(super) fn chatgpt_prepare_requires_auth(result: &Value) -> bool {
    extract_structured_object(result)
        .and_then(|object| object.get("authRequired").and_then(Value::as_bool))
        .unwrap_or(false)
}

pub(super) fn chatgpt_prepare_plan_blocked_message(result: &Value) -> Option<String> {
    extract_structured_object(result)
        .and_then(|object| object.get("planBlockedMessage").and_then(Value::as_str).map(str::trim).map(ToOwned::to_owned))
        .filter(|value| !value.is_empty())
}

pub(super) fn should_retry_chatgpt_fill_step(error: &str) -> bool {
    matches!(
        error.trim(),
        "composer_not_found" | "send_button_not_found" | "send_button_disabled"
    )
}

pub(super) fn page_matches_chatgpt_url(candidate_url: &str, chatgpt_url: &str) -> bool {
    let candidate_raw = candidate_url.trim();
    let target_raw = chatgpt_url.trim();
    if candidate_raw.is_empty() || target_raw.is_empty() {
        return false;
    }
    let candidate = reqwest::Url::parse(candidate_raw).ok();
    let target = reqwest::Url::parse(target_raw).ok();
    let same_origin = match (candidate.as_ref(), target.as_ref()) {
        (Some(candidate), Some(target)) => {
            candidate.host_str() == target.host_str()
                && candidate.scheme() == target.scheme()
                && candidate.port_or_known_default() == target.port_or_known_default()
        }
        _ => false,
    };
    if same_origin {
        let candidate_path = candidate
            .as_ref()
            .map(|value| value.path().trim_end_matches('/'))
            .unwrap_or_default();
        let target_path = target
            .as_ref()
            .map(|value| value.path().trim_end_matches('/'))
            .unwrap_or_default();
        let candidate_is_conversation =
            candidate_path == "/c" || candidate_path.starts_with("/c/");
        let target_is_conversation = target_path == "/c" || target_path.starts_with("/c/");
        if target_is_conversation {
            return candidate_path == target_path;
        }
        if candidate_is_conversation {
            return false;
        }
        return true;
    }
    let candidate = candidate_raw.trim_end_matches('/');
    let target = target_raw.trim_end_matches('/');
    candidate.starts_with(target)
        || target.starts_with(candidate)
        || (candidate.contains("chatgpt.com") && target.contains("chatgpt.com"))
}

pub(super) fn page_is_same_chatgpt_surface(candidate_url: &str, chatgpt_url: &str) -> bool {
    let candidate_raw = candidate_url.trim();
    let target_raw = chatgpt_url.trim();
    if candidate_raw.is_empty() || target_raw.is_empty() {
        return false;
    }
    let candidate = reqwest::Url::parse(candidate_raw).ok();
    let target = reqwest::Url::parse(target_raw).ok();
    match (candidate, target) {
        (Some(candidate), Some(target)) => {
            candidate.host_str() == target.host_str()
                && candidate.scheme() == target.scheme()
                && candidate.port_or_known_default() == target.port_or_known_default()
        }
        _ => candidate_raw.contains("chatgpt.com") && target_raw.contains("chatgpt.com"),
    }
}

pub(super) fn should_prefer_fresh_chat_context(chatgpt_url: &str) -> bool {
    !page_matches_chatgpt_url(chatgpt_url, chatgpt_url) || !chatgpt_url.contains("/c/")
}

pub(super) fn extract_chatgpt_page_id(result: &Value, chatgpt_url: &str) -> Option<u64> {
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

pub(super) fn extract_any_chatgpt_page_id(result: &Value, chatgpt_url: &str) -> Option<u64> {
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
        if page_is_same_chatgpt_surface(url, chatgpt_url) {
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
        if page_is_same_chatgpt_surface(url_raw.trim(), chatgpt_url) {
            return Some(page_id);
        }
    }
    None
}
