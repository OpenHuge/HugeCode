    fn write_fake_acp_stdio_server_script(test_name: &str, mode: &str) -> (PathBuf, PathBuf) {
        let base_dir = std::env::temp_dir().join(format!(
            "acp-runtime-test-{}-{}",
            test_name,
            rand::random::<u64>()
        ));
        fs::create_dir_all(base_dir.as_path()).expect("create fake acp test dir");
        let script_path = base_dir.join("fake-acp-server.js");
        let cancel_log_path = base_dir.join("cancel.log");
        let script = format!(
            r#"#!/usr/bin/env node
const fs = require("node:fs");
const readline = require("node:readline");

const mode = {mode:?};
const cancelLogPath = process.env.ACP_CANCEL_LOG || "";
let nextSession = 1;
const promptBySessionId = new Map();
let nextServerRequestId = 700;
const requestKindById = new Map();
const terminalStateBySessionId = new Map();

function send(message) {{
  process.stdout.write(JSON.stringify(message) + "\n");
}}

function sessionPayload(sessionId) {{
  return {{
    sessionId,
    configOptions: [{{ id: "mode", type: "select", currentValue: "code" }}],
    availableCommands: [{{ name: "plan", description: "Create a plan" }}],
  }};
}}

const rl = readline.createInterface({{
  input: process.stdin,
  crlfDelay: Infinity,
}});

rl.on("line", (line) => {{
  if (!line.trim()) {{
    return;
  }}
  const message = JSON.parse(line);
  const method = message.method || "";
  const params = message.params || {{}};

  if (method === "initialize") {{
    send({{
      jsonrpc: "2.0",
      id: message.id,
      result: {{
        protocolVersion: "2026-03-17",
        serverInfo: {{ name: "fake-acp", version: "0.2.0" }},
        capabilities: {{
          configOptions: [{{ id: "mode", type: "select", currentValue: "code" }}],
          slashCommands: true,
          terminal: true,
        }},
      }},
    }});
    return;
  }}

  if (method === "initialized") {{
    return;
  }}

  if (method === "session/new" || method === "newSession") {{
    const sessionId = `sess-${{nextSession++}}`;
    send({{
      jsonrpc: "2.0",
      id: message.id,
      result: sessionPayload(sessionId),
    }});
    return;
  }}

  if (method === "session/load" || method === "loadSession") {{
    const sessionId = params.sessionId || params.session_id || "sess-1";
    send({{
      jsonrpc: "2.0",
      id: message.id,
      result: sessionPayload(sessionId),
    }});
    return;
  }}

  if (method === "prompt" || method === "session/prompt") {{
    const sessionId = params.sessionId || params.session_id || "sess-1";
    if (mode === "prompt-structured") {{
      const promptBlocks = Array.isArray(params.prompt) ? params.prompt : [];
      const promptText = promptBlocks
        .filter((entry) => entry && entry.type === "text" && typeof entry.text === "string")
        .map((entry) => entry.text.trim())
        .filter(Boolean)
        .join("\n");
      const promptShapeOk =
        promptBlocks.length === 1 &&
        promptBlocks[0]?.type === "text" &&
        promptText === "Complete this through ACP";
      send({{
        jsonrpc: "2.0",
        method: "session/update",
        params: {{
          sessionId,
          update: {{
            sessionUpdate: "agent_message_chunk",
            content: [
              {{
                type: "content",
                content: {{
                  type: "text",
                  text: promptShapeOk ? "structured-prompt-observed" : `structured-prompt-missing:${{JSON.stringify(params.prompt ?? null)}}`,
                }},
              }},
            ],
          }},
        }},
      }});
      send({{
        jsonrpc: "2.0",
        id: message.id,
        result: {{ stopReason: "end_turn" }},
      }});
      return;
    }}

    if (mode === "stream-complete") {{
      send({{
        jsonrpc: "2.0",
        method: "session/update",
        params: {{
          sessionId,
          update: {{
            sessionUpdate: "config_option_update",
            configOptions: [{{ id: "mode", type: "select", currentValue: "code" }}],
          }},
        }},
      }});
      send({{
        jsonrpc: "2.0",
        method: "session/update",
        params: {{
          sessionId,
          update: {{
            sessionUpdate: "available_commands_update",
            availableCommands: [{{ name: "plan", description: "Create a plan" }}],
          }},
        }},
      }});
      send({{
        jsonrpc: "2.0",
        method: "session/update",
        params: {{
          sessionId,
          update: {{
            sessionUpdate: "agent_message_chunk",
            content: [
              {{
                type: "content",
                content: {{ type: "text", text: "acp-streamed-output" }},
              }},
            ],
          }},
        }},
      }});
      send({{
        jsonrpc: "2.0",
        id: message.id,
        result: {{ stopReason: "end_turn" }},
      }});
      return;
    }}

    if (mode === "terminal-command") {{
      promptBySessionId.set(sessionId, message.id);
      requestKindById.set(nextServerRequestId, "terminal/create");
      send({{
        jsonrpc: "2.0",
        id: nextServerRequestId++,
        method: "terminal/create",
        params: {{
          sessionId,
          command: "echo",
          args: ["acp-terminal-output"],
        }},
      }});
      return;
    }}

    if (mode === "terminal-wait-exit") {{
      promptBySessionId.set(sessionId, message.id);
      terminalStateBySessionId.set(sessionId, {{ stage: "create-wait-exit" }});
      requestKindById.set(nextServerRequestId, "terminal/create");
      send({{
        jsonrpc: "2.0",
        id: nextServerRequestId++,
        method: "terminal/create",
        params: {{
          sessionId,
          command: "node",
          args: ["-e", "console.log(process.env.ACP_TEST_ENV || ''); process.exit(7)"],
          env: [{{ name: "ACP_TEST_ENV", value: "env-array-ok" }}],
        }},
      }});
      return;
    }}

    if (mode === "terminal-output-limit") {{
      promptBySessionId.set(sessionId, message.id);
      terminalStateBySessionId.set(sessionId, {{ stage: "create-output-limit" }});
      requestKindById.set(nextServerRequestId, "terminal/create");
      send({{
        jsonrpc: "2.0",
        id: nextServerRequestId++,
        method: "terminal/create",
        params: {{
          sessionId,
          command: "node",
          args: ["-e", "process.stdout.write('alpha-beta-gamma')"],
        }},
      }});
      return;
    }}

    if (mode === "terminal-kill") {{
      promptBySessionId.set(sessionId, message.id);
      terminalStateBySessionId.set(sessionId, {{ stage: "create-kill" }});
      requestKindById.set(nextServerRequestId, "terminal/create");
      send({{
        jsonrpc: "2.0",
        id: nextServerRequestId++,
        method: "terminal/create",
        params: {{
          sessionId,
          command: "node",
          args: ["-e", "setInterval(() => {{}}, 1000)"],
        }},
      }});
      return;
    }}

    promptBySessionId.set(sessionId, message.id);
    send({{
      jsonrpc: "2.0",
      method: "session/update",
      params: {{
        sessionId,
        update: {{
          sessionUpdate: "agent_message_chunk",
          content: [
            {{
              type: "content",
              content: {{ type: "text", text: "waiting-for-cancel" }},
            }},
          ],
        }},
      }},
    }});
    return;
  }}

  if (method === "session/cancel") {{
    const sessionId = params.sessionId || params.session_id || "sess-1";
    if (cancelLogPath) {{
      fs.appendFileSync(cancelLogPath, sessionId + "\n");
    }}
    if (promptBySessionId.has(sessionId)) {{
      send({{
        jsonrpc: "2.0",
        id: promptBySessionId.get(sessionId),
        result: {{ stopReason: "cancelled" }},
      }});
      promptBySessionId.delete(sessionId);
    }}
  }}

  if (requestKindById.get(message.id) === "terminal/create" && message.result && message.result.terminalId) {{
    const sessionId = "sess-1";
    const terminalId = message.result.terminalId;
    const terminalState = terminalStateBySessionId.get(sessionId);
    if (terminalState?.stage === "create-wait-exit") {{
      setTimeout(() => {{
        requestKindById.set(nextServerRequestId, "terminal/output");
        send({{
          jsonrpc: "2.0",
          id: nextServerRequestId++,
          method: "terminal/output",
          params: {{
            sessionId,
            terminalId,
          }},
        }});
      }}, 200);
      return;
    }}
    if (terminalState?.stage === "create-output-limit") {{
      setTimeout(() => {{
        requestKindById.set(nextServerRequestId, "terminal/output");
        send({{
          jsonrpc: "2.0",
          id: nextServerRequestId++,
          method: "terminal/output",
          params: {{
            sessionId,
            terminalId,
            outputByteLimit: 5,
          }},
        }});
      }}, 200);
      return;
    }}
    if (terminalState?.stage === "create-kill") {{
      requestKindById.set(nextServerRequestId, "terminal/kill");
      terminalStateBySessionId.set(sessionId, {{ stage: "kill-sent", terminalId }});
      send({{
        jsonrpc: "2.0",
        id: nextServerRequestId++,
        method: "terminal/kill",
        params: {{
          sessionId,
          terminalId,
        }},
      }});
      return;
    }}
    setTimeout(() => {{
      requestKindById.set(nextServerRequestId, "terminal/output");
      send({{
        jsonrpc: "2.0",
        id: nextServerRequestId++,
        method: "terminal/output",
        params: {{
          sessionId,
          terminalId,
        }},
      }});
    }}, 200);
    return;
  }}

  if (requestKindById.get(message.id) === "terminal/kill" && message.result) {{
    const sessionId = "sess-1";
    const terminalId = terminalStateBySessionId.get(sessionId)?.terminalId;
    requestKindById.set(nextServerRequestId, "terminal/wait_for_exit");
    send({{
      jsonrpc: "2.0",
      id: nextServerRequestId++,
      method: "terminal/wait_for_exit",
      params: {{
        sessionId,
        terminalId,
      }},
    }});
    return;
  }}

  if (requestKindById.get(message.id) === "terminal/output" && message.result) {{
    const sessionId = "sess-1";
    const terminalState = terminalStateBySessionId.get(sessionId);
    if (terminalState?.stage === "create-wait-exit") {{
      const output = String(message.result?.output || "");
      const summaryLines = Array.isArray(message.result?.summary?.lines)
        ? message.result.summary.lines.map((line) => String(line))
        : [];
      terminalStateBySessionId.set(sessionId, {{
        stage: "wait-exit-sent",
        outputObserved:
          output.includes("env-array-ok") ||
          summaryLines.some((line) => line.includes("env-array-ok")),
        output,
      }});
      requestKindById.set(nextServerRequestId, "terminal/wait_for_exit");
      send({{
        jsonrpc: "2.0",
        id: nextServerRequestId++,
        method: "terminal/wait_for_exit",
        params: {{
          sessionId,
          terminalId: message.result?.terminalId || null,
        }},
      }});
      return;
    }}
    if (terminalState?.stage === "create-output-limit") {{
      const promptId = promptBySessionId.get(sessionId);
      const output = String(message.result?.output || "");
      const truncated = message.result?.truncated === true;
      const observed = output === "gamma" && truncated;
      send({{
        jsonrpc: "2.0",
        method: "session/update",
        params: {{
          sessionId,
          update: {{
            sessionUpdate: "agent_message_chunk",
            content: [
              {{
                type: "content",
                content: {{
                  type: "text",
                  text: observed
                    ? "terminal-output-limit-observed"
                    : `terminal-output-limit-missing:${{JSON.stringify({{ output, truncated }})}}`,
                }},
              }},
            ],
          }},
        }},
      }});
      send({{
        jsonrpc: "2.0",
        id: promptId,
        result: {{ stopReason: "end_turn" }},
      }});
      promptBySessionId.delete(sessionId);
      terminalStateBySessionId.delete(sessionId);
      return;
    }}
  }}

  if (requestKindById.get(message.id) === "terminal/wait_for_exit" && message.result) {{
    const sessionId = "sess-1";
    const promptId = promptBySessionId.get(sessionId);
    const summaryLines = Array.isArray(message.result?.summary?.lines)
      ? message.result.summary.lines
      : [];
    const exitCode = message.result?.exitCode ?? null;
    const terminalId = message.result?.terminalId ?? null;
    const terminalState = terminalStateBySessionId.get(sessionId);
    let observed = false;
    let observedText = "terminal-wait-missing";

    if (terminalState?.stage === "wait-exit-sent") {{
      observed =
        exitCode === 7 &&
        terminalId &&
        terminalState.outputObserved === true;
      observedText = observed
        ? "terminal-wait-exit-observed"
        : `terminal-wait-exit-missing:${{JSON.stringify({{
            exitCode,
            terminalId,
            outputObserved: terminalState.outputObserved === true,
            output: terminalState.output || "",
          }})}}`;
    }} else if (terminalState?.stage === "kill-sent") {{
      const signal = String(message.result?.signal || "");
      observed =
        terminalId === terminalState.terminalId &&
        (signal.length > 0 || exitCode !== null);
      observedText = observed
        ? (signal.length > 0
            ? `terminal-kill-observed:${{signal}}`
            : "terminal-kill-observed")
        : `terminal-kill-missing:${{JSON.stringify({{
            exitCode,
            signal,
            terminalId,
          }})}}`;
      requestKindById.set(nextServerRequestId, "terminal/release");
      terminalStateBySessionId.set(sessionId, {{
        stage: "release-sent",
        terminalId: terminalState.terminalId,
        observed,
        observedText,
      }});
      send({{
        jsonrpc: "2.0",
        id: nextServerRequestId++,
        method: "terminal/release",
        params: {{
          sessionId,
          terminalId: terminalState.terminalId,
        }},
      }});
      return;
    }}

    send({{
      jsonrpc: "2.0",
      method: "session/update",
      params: {{
        sessionId,
        update: {{
          sessionUpdate: "agent_message_chunk",
          content: [
            {{
              type: "content",
              content: {{
                type: "text",
                text: observedText,
              }},
            }},
          ],
        }},
      }},
    }});
    send({{
      jsonrpc: "2.0",
      id: promptId,
      result: {{ stopReason: "end_turn" }},
    }});
    promptBySessionId.delete(sessionId);
    terminalStateBySessionId.delete(sessionId);
    return;
  }}

  if (requestKindById.get(message.id) === "terminal/release" && message.result) {{
    const sessionId = "sess-1";
    const promptId = promptBySessionId.get(sessionId);
    const terminalState = terminalStateBySessionId.get(sessionId);
    const observed = Boolean(terminalState?.observed && message.result?.released === true);
    send({{
      jsonrpc: "2.0",
      method: "session/update",
      params: {{
        sessionId,
        update: {{
          sessionUpdate: "agent_message_chunk",
          content: [
            {{
              type: "content",
              content: {{
                type: "text",
                text: observed ? terminalState.observedText : "terminal-release-missing",
              }},
            }},
          ],
        }},
      }},
    }});
    send({{
      jsonrpc: "2.0",
      id: promptId,
      result: {{ stopReason: "end_turn" }},
    }});
    promptBySessionId.delete(sessionId);
    terminalStateBySessionId.delete(sessionId);
    return;
  }}

  if (message.id >= 700 && message.result) {{
    const sessionId = "sess-1";
    const promptId = promptBySessionId.get(sessionId);
    const output = String(message.result?.output || "");
    const observed = output.includes("acp-terminal-output");
    send({{
      jsonrpc: "2.0",
      method: "session/update",
      params: {{
        sessionId,
        update: {{
          sessionUpdate: "agent_message_chunk",
          content: [
            {{
              type: "content",
              content: {{
                type: "text",
                text: observed ? "terminal-command-observed" : "terminal-command-missing",
              }},
            }},
          ],
        }},
      }},
    }});
    send({{
      jsonrpc: "2.0",
      id: promptId,
      result: {{ stopReason: "end_turn" }},
    }});
    promptBySessionId.delete(sessionId);
  }}
}});
"#
        );
        fs::write(script_path.as_path(), script).expect("write fake acp server script");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut permissions = fs::metadata(script_path.as_path())
                .expect("fake acp server metadata")
                .permissions();
            permissions.set_mode(0o755);
            fs::set_permissions(script_path.as_path(), permissions)
                .expect("set fake acp server permissions");
        }
        (script_path, cancel_log_path)
    }

    async fn send_service_rpc_request(
        client: &reqwest::Client,
        service_base_url: &str,
        payload: &Value,
    ) -> Value {
        let response = client
            .post(format!("{service_base_url}/rpc"))
            .json(payload)
            .send()
            .await
            .expect("send service rpc request");
        assert_eq!(response.status(), reqwest::StatusCode::OK);
        response
            .json()
            .await
            .expect("parse service rpc response")
    }

    async fn upsert_and_probe_acp_stdio_integration(
        client: &reqwest::Client,
        service_base_url: &str,
        integration_id: &str,
        backend_id: &str,
        script_path: &Path,
        cancel_log_path: &Path,
    ) {
        let upsert_payload = send_service_rpc_request(
            client,
            service_base_url,
            &json!({
                "method": "code_acp_integration_upsert",
                "params": {
                    "integrationId": integration_id,
                    "backendId": backend_id,
                    "displayName": format!("ACP {}", integration_id),
                    "transportConfig": {
                        "transport": "stdio",
                        "command": "node",
                        "args": [script_path.display().to_string()],
                        "env": {
                            "ACP_CANCEL_LOG": cancel_log_path.display().to_string(),
                        }
                    },
                    "capabilities": ["code"],
                    "maxConcurrency": 1,
                    "costTier": "standard",
                    "latencyClass": "local",
                    "state": "active"
                }
            }),
        )
        .await;
        assert_eq!(upsert_payload["ok"], Value::Bool(true));

        let probe_payload = send_service_rpc_request(
            client,
            service_base_url,
            &json!({
                "method": "code_acp_integration_probe",
                "params": {
                    "integrationId": integration_id,
                    "force": true
                }
            }),
        )
        .await;
        assert_eq!(probe_payload["ok"], Value::Bool(true));
        assert_eq!(probe_payload["result"]["healthy"], Value::Bool(true));
        assert_eq!(
            probe_payload["result"]["protocolVersion"],
            Value::String("2026-03-17".to_string())
        );
    }

    async fn upsert_and_probe_acp_stdio_integration_via_app(
        app: Router,
        integration_id: &str,
        backend_id: &str,
        script_path: &Path,
        cancel_log_path: &Path,
    ) {
        let upsert_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_acp_integration_upsert",
                "params": {
                    "integrationId": integration_id,
                    "backendId": backend_id,
                    "displayName": format!("ACP {}", integration_id),
                    "transportConfig": {
                        "transport": "stdio",
                        "command": "node",
                        "args": [script_path.display().to_string()],
                        "env": {
                            "ACP_CANCEL_LOG": cancel_log_path.display().to_string(),
                        }
                    },
                    "capabilities": ["code"],
                    "maxConcurrency": 1,
                    "costTier": "standard",
                    "latencyClass": "local",
                    "state": "active"
                }
            }),
        )
        .await;
        assert_eq!(upsert_payload["ok"], Value::Bool(true));

        let probe_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_acp_integration_probe",
                "params": {
                    "integrationId": integration_id,
                    "force": true
                }
            }),
        )
        .await;
        assert_eq!(probe_payload["ok"], Value::Bool(true));
        assert_eq!(probe_payload["result"]["healthy"], Value::Bool(true));
    }

    #[tokio::test]
    async fn events_route_sends_acp_prompt_as_structured_text_blocks() {
        let (script_path, cancel_log_path) =
            write_fake_acp_stdio_server_script("turn-prompt-structured", "prompt-structured");
        let (service_base_url, service_handle) =
            spawn_runtime_service_server(test_service_config()).await;
        let client = reqwest::Client::new();

        upsert_and_probe_acp_stdio_integration(
            &client,
            service_base_url.as_str(),
            "acp-turn-prompt-structured",
            "acp:test-turn-prompt-structured",
            script_path.as_path(),
            cancel_log_path.as_path(),
        )
        .await;

        let mut events_response = client
            .get(format!("{service_base_url}/events"))
            .send()
            .await
            .expect("open structured ACP turn SSE events stream");
        assert_eq!(events_response.status(), reqwest::StatusCode::OK);

        let turn_response = client
            .post(format!("{service_base_url}/rpc"))
            .json(&json!({
                "method": "code_turn_send",
                "params": {
                    "payload": {
                        "workspaceId": "workspace-web",
                        "threadId": "thread-acp-prompt-structured",
                        "requestId": "request-acp-prompt-structured",
                        "content": "Complete this through ACP",
                        "provider": "openai",
                        "modelId": "gpt-5.3-codex",
                        "reasonEffort": "high",
                        "accessMode": "on-request",
                        "preferredBackendIds": ["acp:test-turn-prompt-structured"],
                        "queue": false,
                        "attachments": [],
                    }
                }
            }))
            .send()
            .await
            .expect("send structured acp turn request");
        assert_eq!(turn_response.status(), reqwest::StatusCode::OK);
        let turn_payload: Value = turn_response
            .json()
            .await
            .expect("parse structured acp turn response");
        assert_eq!(turn_payload["ok"], Value::Bool(true));
        let turn_id = turn_payload["result"]["turnId"]
            .as_str()
            .expect("structured acp turn id")
            .to_string();

        let turn_events =
            read_sse_events_until_turn_completed(&mut events_response, turn_id.as_str()).await;
        let terminal_completion = turn_events
            .iter()
            .find(|event| {
                event["kind"] == Value::String("turn.completed".to_string())
                    && event["payload"]["turnId"] == Value::String(turn_id.clone())
            })
            .expect("structured acp completed event");
        assert_eq!(
            terminal_completion["payload"]["output"],
            Value::String("structured-prompt-observed".to_string())
        );

        let _ = fs::remove_dir_all(script_path.parent().expect("fake acp dir"));
        service_handle.abort();
    }

    #[tokio::test]
    async fn events_route_streams_acp_turn_completion_from_session_updates_without_prompt_text() {
        let (script_path, cancel_log_path) =
            write_fake_acp_stdio_server_script("turn-stream-complete", "stream-complete");
        let (service_base_url, service_handle) =
            spawn_runtime_service_server(test_service_config()).await;
        let client = reqwest::Client::new();

        upsert_and_probe_acp_stdio_integration(
            &client,
            service_base_url.as_str(),
            "acp-turn-stream",
            "acp:test-turn-stream",
            script_path.as_path(),
            cancel_log_path.as_path(),
        )
        .await;

        let mut events_response = client
            .get(format!("{service_base_url}/events"))
            .send()
            .await
            .expect("open acp turn SSE events stream");
        assert_eq!(events_response.status(), reqwest::StatusCode::OK);

        let turn_response = client
            .post(format!("{service_base_url}/rpc"))
            .json(&json!({
                "method": "code_turn_send",
                "params": {
                    "payload": {
                        "workspaceId": "workspace-web",
                        "threadId": "thread-acp-stream-complete",
                        "requestId": "request-acp-stream-complete",
                        "content": "Complete this through ACP",
                        "provider": "openai",
                        "modelId": "gpt-5.3-codex",
                        "reasonEffort": "high",
                        "accessMode": "on-request",
                        "preferredBackendIds": ["acp:test-turn-stream"],
                        "queue": false,
                        "attachments": [],
                    }
                }
            }))
            .send()
            .await
            .expect("send acp turn request");
        assert_eq!(turn_response.status(), reqwest::StatusCode::OK);
        let turn_payload: Value = turn_response.json().await.expect("parse acp turn response");
        assert_eq!(turn_payload["ok"], Value::Bool(true));
        assert_eq!(turn_payload["result"]["accepted"], Value::Bool(true));
        assert_eq!(
            turn_payload["result"]["routedSource"],
            Value::String("acp-backend".to_string())
        );
        let turn_id = turn_payload["result"]["turnId"]
            .as_str()
            .expect("acp turn id")
            .to_string();

        let turn_events =
            read_sse_events_until_turn_completed(&mut events_response, turn_id.as_str()).await;
        let scoped_events = turn_events
            .iter()
            .filter(|event| event["payload"]["turnId"] == Value::String(turn_id.clone()))
            .cloned()
            .collect::<Vec<_>>();

        assert!(scoped_events.iter().any(|event| {
            event["kind"] == Value::String("item.agentMessage.delta".to_string())
                && event["payload"]["delta"]
                    == Value::String("acp-streamed-output".to_string())
        }));
        assert_eq!(
            scoped_events.last().expect("acp turn completed event")["kind"],
            Value::String("turn.completed".to_string())
        );
        assert_eq!(
            scoped_events.last().expect("acp turn completed event")["payload"]["output"],
            Value::String("acp-streamed-output".to_string())
        );

        let _ = fs::remove_dir_all(script_path.parent().expect("fake acp dir"));
        service_handle.abort();
    }
    #[tokio::test]
    async fn turn_interrupt_sends_acp_session_cancel_notification() {
        let (script_path, cancel_log_path) =
            write_fake_acp_stdio_server_script("turn-interrupt-cancel", "wait-cancel");
        let (service_base_url, service_handle) =
            spawn_runtime_service_server(test_service_config()).await;
        let client = reqwest::Client::new();

        upsert_and_probe_acp_stdio_integration(
            &client,
            service_base_url.as_str(),
            "acp-turn-cancel",
            "acp:test-turn-cancel",
            script_path.as_path(),
            cancel_log_path.as_path(),
        )
        .await;

        let mut events_response = client
            .get(format!("{service_base_url}/events"))
            .send()
            .await
            .expect("open acp interrupt SSE events stream");
        assert_eq!(events_response.status(), reqwest::StatusCode::OK);

        let turn_response = client
            .post(format!("{service_base_url}/rpc"))
            .json(&json!({
                "method": "code_turn_send",
                "params": {
                    "payload": {
                        "workspaceId": "workspace-web",
                        "threadId": "thread-acp-cancel",
                        "requestId": "request-acp-cancel",
                        "content": "Interrupt this ACP turn",
                        "provider": "openai",
                        "modelId": "gpt-5.3-codex",
                        "reasonEffort": "high",
                        "accessMode": "on-request",
                        "preferredBackendIds": ["acp:test-turn-cancel"],
                        "queue": false,
                        "attachments": [],
                    }
                }
            }))
            .send()
            .await
            .expect("send interruptible acp turn request");
        assert_eq!(turn_response.status(), reqwest::StatusCode::OK);
        let turn_payload: Value = turn_response
            .json()
            .await
            .expect("parse interruptible acp turn response");
        assert_eq!(turn_payload["ok"], Value::Bool(true));
        let turn_id = turn_payload["result"]["turnId"]
            .as_str()
            .expect("interruptible acp turn id")
            .to_string();

        let initial_events = read_sse_events_until(
            &mut events_response,
            "initial acp turn delta",
            |events| {
                events.iter().any(|event| {
                    event["kind"] == Value::String("item.agentMessage.delta".to_string())
                        && event["payload"]["turnId"] == Value::String(turn_id.clone())
                })
            },
        )
        .await;
        assert!(initial_events.iter().any(|event| {
            event["kind"] == Value::String("item.agentMessage.delta".to_string())
                && event["payload"]["delta"] == Value::String("waiting-for-cancel".to_string())
        }));

        let interrupt_response = client
            .post(format!("{service_base_url}/rpc"))
            .json(&json!({
                "method": "code_turn_interrupt",
                "params": {
                    "turnId": turn_id.clone(),
                    "reason": "interrupt-acp-test"
                }
            }))
            .send()
            .await
            .expect("send acp turn interrupt request");
        assert_eq!(interrupt_response.status(), reqwest::StatusCode::OK);
        let interrupt_payload: Value = interrupt_response
            .json()
            .await
            .expect("parse acp turn interrupt response");
        assert_eq!(interrupt_payload["ok"], Value::Bool(true));
        assert_eq!(interrupt_payload["result"], Value::Bool(true));

        let terminal_events = read_sse_events_until(
            &mut events_response,
            "acp interrupted turn.failed",
            |events| {
                events.iter().any(|event| {
                    event["kind"] == Value::String("turn.failed".to_string())
                        && event["payload"]["turnId"] == Value::String(turn_id.clone())
                })
            },
        )
        .await;
        let failed_event = terminal_events
            .iter()
            .find(|event| {
                event["kind"] == Value::String("turn.failed".to_string())
                    && event["payload"]["turnId"] == Value::String(turn_id.clone())
            })
            .expect("acp turn.failed event");
        assert_eq!(
            failed_event["payload"]["error"]["code"],
            Value::String("TASK_INTERRUPTED".to_string())
        );

        let cancel_log = tokio::time::timeout(Duration::from_secs(2), async {
            loop {
                if let Ok(contents) = fs::read_to_string(cancel_log_path.as_path()) {
                    if contents.lines().any(|line| line.trim() == "sess-1") {
                        break contents;
                    }
                }
                tokio::time::sleep(Duration::from_millis(25)).await;
            }
        })
        .await
        .expect("wait for ACP cancel log");
        assert!(cancel_log.lines().any(|line| line.trim() == "sess-1"));

        let _ = fs::remove_dir_all(script_path.parent().expect("fake acp dir"));
        service_handle.abort();
    }

    #[tokio::test]
    async fn agent_task_status_records_acp_diagnostics_from_stream_updates() {
        let (script_path, cancel_log_path) =
            write_fake_acp_stdio_server_script("task-stream-diagnostics", "stream-complete");
        let app = test_router();

        upsert_and_probe_acp_stdio_integration_via_app(
            app.clone(),
            "acp-task-stream",
            "acp:test-task-stream",
            script_path.as_path(),
            cancel_log_path.as_path(),
        )
        .await;

        let start_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_start",
                "params": {
                    "workspaceId": "workspace-web",
                    "executionMode": "distributed",
                    "requiredCapabilities": ["code"],
                    "preferredBackendIds": ["acp:test-task-stream"],
                    "steps": [
                        {
                            "kind": "read",
                            "input": "Complete through ACP task runtime"
                        }
                    ]
                }
            }),
        )
        .await;
        assert_eq!(start_payload["ok"], Value::Bool(true));
        let task_id = start_payload["result"]["taskId"]
            .as_str()
            .expect("acp task id")
            .to_string();

        let status_payload =
            wait_for_agent_task_terminal_status(app.clone(), task_id.as_str(), &["completed"])
                .await;
        assert_eq!(
            status_payload["result"]["backendId"],
            Value::String("acp:test-task-stream".to_string())
        );
        assert_eq!(
            status_payload["result"]["routedSource"],
            Value::String("acp-backend".to_string())
        );
        assert_eq!(
            status_payload["result"]["acpIntegrationId"],
            Value::String("acp-task-stream".to_string())
        );
        assert_eq!(
            status_payload["result"]["acpSessionId"],
            Value::String("sess-1".to_string())
        );
        assert_eq!(
            status_payload["result"]["acpConfigOptions"],
            json!([
                {
                    "id": "mode",
                    "type": "select",
                    "currentValue": "code"
                }
            ])
        );
        assert_eq!(
            status_payload["result"]["acpAvailableCommands"],
            json!([
                {
                    "name": "plan",
                    "description": "Create a plan"
                }
            ])
        );

        let _ = fs::remove_dir_all(script_path.parent().expect("fake acp dir"));
    }

    #[tokio::test]
    async fn events_route_supports_acp_terminal_create_with_command_execution() {
        let (script_path, cancel_log_path) =
            write_fake_acp_stdio_server_script("terminal-command", "terminal-command");
        let (service_base_url, service_handle) =
            spawn_runtime_service_server(test_service_config()).await;
        let client = reqwest::Client::new();

        upsert_and_probe_acp_stdio_integration(
            &client,
            service_base_url.as_str(),
            "acp-terminal-command",
            "acp:test-terminal-command",
            script_path.as_path(),
            cancel_log_path.as_path(),
        )
        .await;

        let mut events_response = client
            .get(format!("{service_base_url}/events"))
            .send()
            .await
            .expect("open acp terminal SSE events stream");
        assert_eq!(events_response.status(), reqwest::StatusCode::OK);

        let turn_response = client
            .post(format!("{service_base_url}/rpc"))
            .json(&json!({
                "method": "code_turn_send",
                "params": {
                    "payload": {
                        "workspaceId": "workspace-web",
                        "threadId": "thread-acp-terminal-command",
                        "requestId": "request-acp-terminal-command",
                        "content": "Run a terminal command through ACP",
                        "provider": "openai",
                        "modelId": "gpt-5.3-codex",
                        "reasonEffort": "high",
                        "accessMode": "on-request",
                        "preferredBackendIds": ["acp:test-terminal-command"],
                        "queue": false,
                        "attachments": [],
                    }
                }
            }))
            .send()
            .await
            .expect("send acp terminal turn request");
        assert_eq!(turn_response.status(), reqwest::StatusCode::OK);
        let turn_payload: Value = turn_response
            .json()
            .await
            .expect("parse acp terminal turn response");
        assert_eq!(turn_payload["ok"], Value::Bool(true));
        let turn_id = turn_payload["result"]["turnId"]
            .as_str()
            .expect("acp terminal turn id")
            .to_string();

        let turn_events =
            read_sse_events_until_turn_completed(&mut events_response, turn_id.as_str()).await;
        let terminal_completion = turn_events
            .iter()
            .find(|event| {
                event["kind"] == Value::String("turn.completed".to_string())
                    && event["payload"]["turnId"] == Value::String(turn_id.clone())
            })
            .expect("acp terminal completed event");
        assert_eq!(
            terminal_completion["payload"]["output"],
            Value::String("terminal-command-observed".to_string())
        );

        let _ = fs::remove_dir_all(script_path.parent().expect("fake acp dir"));
        service_handle.abort();
    }

    #[tokio::test]
    async fn events_route_supports_acp_terminal_wait_for_exit_and_env_arrays() {
        let (script_path, cancel_log_path) =
            write_fake_acp_stdio_server_script("terminal-wait-exit", "terminal-wait-exit");
        let (service_base_url, service_handle) =
            spawn_runtime_service_server(test_service_config()).await;
        let client = reqwest::Client::new();

        upsert_and_probe_acp_stdio_integration(
            &client,
            service_base_url.as_str(),
            "acp-terminal-wait-exit",
            "acp:test-terminal-wait-exit",
            script_path.as_path(),
            cancel_log_path.as_path(),
        )
        .await;

        let mut events_response = client
            .get(format!("{service_base_url}/events"))
            .send()
            .await
            .expect("open acp terminal wait SSE events stream");
        assert_eq!(events_response.status(), reqwest::StatusCode::OK);

        let turn_response = client
            .post(format!("{service_base_url}/rpc"))
            .json(&json!({
                "method": "code_turn_send",
                "params": {
                    "payload": {
                        "workspaceId": "workspace-web",
                        "threadId": "thread-acp-terminal-wait-exit",
                        "requestId": "request-acp-terminal-wait-exit",
                        "content": "Run a command through ACP and wait for exit",
                        "provider": "openai",
                        "modelId": "gpt-5.3-codex",
                        "reasonEffort": "high",
                        "accessMode": "on-request",
                        "preferredBackendIds": ["acp:test-terminal-wait-exit"],
                        "queue": false,
                        "attachments": [],
                    }
                }
            }))
            .send()
            .await
            .expect("send acp terminal wait turn request");
        assert_eq!(turn_response.status(), reqwest::StatusCode::OK);
        let turn_payload: Value = turn_response
            .json()
            .await
            .expect("parse acp terminal wait response");
        let turn_id = turn_payload["result"]["turnId"]
            .as_str()
            .expect("acp terminal wait turn id")
            .to_string();

        let turn_events =
            read_sse_events_until_turn_completed(&mut events_response, turn_id.as_str()).await;
        let terminal_completion = turn_events
            .iter()
            .find(|event| {
                event["kind"] == Value::String("turn.completed".to_string())
                    && event["payload"]["turnId"] == Value::String(turn_id.clone())
            })
            .expect("acp terminal wait completed event");
        assert_eq!(
            terminal_completion["payload"]["output"],
            Value::String("terminal-wait-exit-observed".to_string())
        );

        let _ = fs::remove_dir_all(script_path.parent().expect("fake acp dir"));
        service_handle.abort();
    }

    #[tokio::test]
    async fn events_route_supports_acp_terminal_kill_then_wait_for_exit() {
        let (script_path, cancel_log_path) =
            write_fake_acp_stdio_server_script("terminal-kill", "terminal-kill");
        let (service_base_url, service_handle) =
            spawn_runtime_service_server(test_service_config()).await;
        let client = reqwest::Client::new();

        upsert_and_probe_acp_stdio_integration(
            &client,
            service_base_url.as_str(),
            "acp-terminal-kill",
            "acp:test-terminal-kill",
            script_path.as_path(),
            cancel_log_path.as_path(),
        )
        .await;

        let mut events_response = client
            .get(format!("{service_base_url}/events"))
            .send()
            .await
            .expect("open acp terminal kill SSE events stream");
        assert_eq!(events_response.status(), reqwest::StatusCode::OK);

        let turn_response = client
            .post(format!("{service_base_url}/rpc"))
            .json(&json!({
                "method": "code_turn_send",
                "params": {
                    "payload": {
                        "workspaceId": "workspace-web",
                        "threadId": "thread-acp-terminal-kill",
                        "requestId": "request-acp-terminal-kill",
                        "content": "Kill an ACP terminal and still wait for exit",
                        "provider": "openai",
                        "modelId": "gpt-5.3-codex",
                        "reasonEffort": "high",
                        "accessMode": "on-request",
                        "preferredBackendIds": ["acp:test-terminal-kill"],
                        "queue": false,
                        "attachments": [],
                    }
                }
            }))
            .send()
            .await
            .expect("send acp terminal kill turn request");
        assert_eq!(turn_response.status(), reqwest::StatusCode::OK);
        let turn_payload: Value = turn_response
            .json()
            .await
            .expect("parse acp terminal kill response");
        let turn_id = turn_payload["result"]["turnId"]
            .as_str()
            .expect("acp terminal kill turn id")
            .to_string();

        let turn_events =
            read_sse_events_until_turn_completed(&mut events_response, turn_id.as_str()).await;
        let terminal_completion = turn_events
            .iter()
            .find(|event| {
                event["kind"] == Value::String("turn.completed".to_string())
                    && event["payload"]["turnId"] == Value::String(turn_id.clone())
            })
            .expect("acp terminal kill completed event");
        let output = terminal_completion["payload"]["output"]
            .as_str()
            .expect("acp terminal kill output");
        assert!(output.starts_with("terminal-kill-observed"));
        if cfg!(unix) {
            assert_ne!(output, "terminal-kill-observed");
        }

        let _ = fs::remove_dir_all(script_path.parent().expect("fake acp dir"));
        service_handle.abort();
    }

    #[tokio::test]
    async fn events_route_supports_acp_terminal_output_byte_limits() {
        let (script_path, cancel_log_path) =
            write_fake_acp_stdio_server_script("terminal-output-limit", "terminal-output-limit");
        let (service_base_url, service_handle) =
            spawn_runtime_service_server(test_service_config()).await;
        let client = reqwest::Client::new();

        upsert_and_probe_acp_stdio_integration(
            &client,
            service_base_url.as_str(),
            "acp-terminal-output-limit",
            "acp:test-terminal-output-limit",
            script_path.as_path(),
            cancel_log_path.as_path(),
        )
        .await;

        let mut events_response = client
            .get(format!("{service_base_url}/events"))
            .send()
            .await
            .expect("open acp terminal output-limit SSE events stream");
        assert_eq!(events_response.status(), reqwest::StatusCode::OK);

        let turn_response = client
            .post(format!("{service_base_url}/rpc"))
            .json(&json!({
                "method": "code_turn_send",
                "params": {
                    "payload": {
                        "workspaceId": "workspace-web",
                        "threadId": "thread-acp-terminal-output-limit",
                        "requestId": "request-acp-terminal-output-limit",
                        "content": "Read ACP terminal output with a byte limit",
                        "provider": "openai",
                        "modelId": "gpt-5.3-codex",
                        "reasonEffort": "high",
                        "accessMode": "on-request",
                        "preferredBackendIds": ["acp:test-terminal-output-limit"],
                        "queue": false,
                        "attachments": [],
                    }
                }
            }))
            .send()
            .await
            .expect("send acp terminal output-limit turn request");
        assert_eq!(turn_response.status(), reqwest::StatusCode::OK);
        let turn_payload: Value = turn_response
            .json()
            .await
            .expect("parse acp terminal output-limit response");
        let turn_id = turn_payload["result"]["turnId"]
            .as_str()
            .expect("acp terminal output-limit turn id")
            .to_string();

        let turn_events =
            read_sse_events_until_turn_completed(&mut events_response, turn_id.as_str()).await;
        let terminal_completion = turn_events
            .iter()
            .find(|event| {
                event["kind"] == Value::String("turn.completed".to_string())
                    && event["payload"]["turnId"] == Value::String(turn_id.clone())
            })
            .expect("acp terminal output-limit completed event");
        assert_eq!(
            terminal_completion["payload"]["output"],
            Value::String("terminal-output-limit-observed".to_string())
        );

        let _ = fs::remove_dir_all(script_path.parent().expect("fake acp dir"));
        service_handle.abort();
    }
