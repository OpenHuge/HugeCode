use super::helpers::{
    extract_available_commands, extract_config_options, extract_prompt_stop_reason,
    extract_session_update_delta_text,
};
use super::{
    build_acp_hidden_task_session_key, build_acp_prompt_params, build_acp_thread_session_key,
    build_agent_task_acp_prompt, probe_acp_stdio_initialize, prompt_outcome_was_cancelled,
    resolve_prompt_outcome_text, AcpAgentTaskPromptInput, AcpPromptOutcome, AcpRuntimeStore,
    AcpSessionRuntime,
};
use serde_json::json;
use std::collections::HashMap;
use std::fs;
use tempfile::TempDir;
use tokio::sync::broadcast;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

fn write_fake_acp_server_script(temp: &TempDir) -> std::path::PathBuf {
    let script_path = temp.path().join("fake-acp-server.sh");
    let script = r#"#!/bin/sh
while IFS= read -r line; do
  id=$(printf '%s' "$line" | sed -n 's/.*"id":\([0-9][0-9]*\).*/\1/p')
  case "$line" in
    *'"method":"initialize"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"protocolVersion":"2026-03-17","serverInfo":{"name":"fake-acp","version":"0.1.0"},"capabilities":{"configOptions":{"accessMode":{"type":"string"}}}}}\n' "$id"
      ;;
    *'"method":"initialized"'*)
      ;;
  esac
done
"#;
    fs::write(&script_path, script).expect("write fake acp server");
    #[cfg(unix)]
    let mut permissions = fs::metadata(&script_path)
        .expect("fake acp server metadata")
        .permissions();
    #[cfg(unix)]
    permissions.set_mode(0o755);
    #[cfg(unix)]
    fs::set_permissions(&script_path, permissions).expect("set fake acp server permissions");
    script_path
}

#[test]
fn acp_thread_session_key_is_stable_for_workspace_thread_and_backend() {
    let key = build_acp_thread_session_key("workspace-a", "thread-1", "acp:codex");
    assert_eq!(key, "thread:workspace-a:thread-1:acp:codex");
}

#[test]
fn acp_hidden_task_session_key_is_distinct_from_thread_owned_session() {
    let key = build_acp_hidden_task_session_key("workspace-a", "task-1", "acp:codex");
    assert_eq!(key, "task:workspace-a:task-1:acp:codex");
}

#[tokio::test]
async fn acp_stdio_probe_initializes_and_extracts_server_metadata() {
    let temp = TempDir::new().expect("tempdir");
    let script_path = write_fake_acp_server_script(&temp);
    let metadata = probe_acp_stdio_initialize(
        script_path.to_string_lossy().as_ref(),
        &[],
        None,
        &HashMap::new(),
    )
    .await
    .expect("probe should succeed");

    assert_eq!(metadata.protocol_version.as_deref(), Some("2026-03-17"));
    assert_eq!(metadata.server_name.as_deref(), Some("fake-acp"));
    assert_eq!(metadata.server_version.as_deref(), Some("0.1.0"));
    assert_eq!(
        metadata.config_options,
        Some(json!({
            "accessMode": {"type": "string"}
        }))
    );
}

#[test]
fn acp_agent_task_prompt_contains_deterministic_mission_sections() {
    let prompt = build_agent_task_acp_prompt(&AcpAgentTaskPromptInput {
        title: Some("Review build failure".to_string()),
        access_mode: "full-access".to_string(),
        agent_profile: "review".to_string(),
        mission_brief: Some(json!({
            "objective": "Fix the failing build",
            "doneDefinition": ["tests green", "no regressions"],
        })),
        relaunch_context: Some(json!({
            "summary": "Previous run failed after validation",
            "failureClass": "validation_failed",
        })),
        auto_drive: Some(json!({
            "destination": {
                "title": "Ship passing validation",
                "desiredEndState": ["validate passes"]
            }
        })),
        steps: vec![
            json!({"kind": "read", "input": "inspect the failing test output"}),
            json!({"kind": "edit", "path": "src/main.rs", "input": "fix the regression"}),
        ],
    });

    assert!(prompt.contains("Title: Review build failure"));
    assert!(prompt.contains("Access mode: full-access"));
    assert!(prompt.contains("Agent profile: review"));
    assert!(prompt.contains("Mission brief:"));
    assert!(prompt.contains("Relaunch context:"));
    assert!(prompt.contains("Auto-drive:"));
    assert!(prompt.contains("Submitted steps:"));
    assert!(prompt.contains("\"kind\": \"edit\""));
}

#[test]
fn acp_runtime_store_detaches_hidden_task_session_and_keeps_thread_session_bindings() {
    let (event_tx, _) = broadcast::channel(4);
    let mut store = AcpRuntimeStore::default();
    store.session_key_by_id.insert(
        "session-task".to_string(),
        "task:workspace-a:task-1:acp:codex".to_string(),
    );
    store.sessions_by_key.insert(
        "task:workspace-a:task-1:acp:codex".to_string(),
        AcpSessionRuntime {
            integration_id: "integration-a".to_string(),
            backend_id: "acp:codex".to_string(),
            session_id: "session-task".to_string(),
            workspace_id: "workspace-a".to_string(),
            config_options: None,
            available_commands: None,
            event_tx: event_tx.clone(),
            terminal_session_ids: HashMap::from([("term-1".to_string(), "term-1".to_string())]),
        },
    );
    store
        .task_sessions
        .insert("task-1".to_string(), "session-task".to_string());

    let released = store.detach_task_binding("task-1");
    assert_eq!(released, vec!["term-1".to_string()]);
    assert!(store.task_sessions.is_empty());
    assert!(store.session_key_by_id.is_empty());
    assert!(store.sessions_by_key.is_empty());

    store.session_key_by_id.insert(
        "session-thread".to_string(),
        "thread:workspace-a:thread-1:acp:codex".to_string(),
    );
    store.sessions_by_key.insert(
        "thread:workspace-a:thread-1:acp:codex".to_string(),
        AcpSessionRuntime {
            integration_id: "integration-a".to_string(),
            backend_id: "acp:codex".to_string(),
            session_id: "session-thread".to_string(),
            workspace_id: "workspace-a".to_string(),
            config_options: None,
            available_commands: None,
            event_tx,
            terminal_session_ids: HashMap::new(),
        },
    );
    store
        .task_sessions
        .insert("task-2".to_string(), "session-thread".to_string());

    let released = store.detach_task_binding("task-2");
    assert!(released.is_empty());
    assert!(store.task_sessions.is_empty());
    assert!(store.session_key_by_id.contains_key("session-thread"));
    assert!(store
        .sessions_by_key
        .contains_key("thread:workspace-a:thread-1:acp:codex"));
}

#[test]
fn acp_extracts_nested_session_update_config_and_command_payloads() {
    let config_update = json!({
        "sessionId": "sess-config",
        "update": {
            "sessionUpdate": "config_option_update",
            "configOptions": [
                {
                    "id": "mode",
                    "type": "select",
                    "currentValue": "code",
                }
            ]
        }
    });
    let command_update = json!({
        "sessionId": "sess-commands",
        "update": {
            "sessionUpdate": "available_commands_update",
            "availableCommands": [
                {
                    "name": "plan",
                    "description": "Create a plan"
                }
            ]
        }
    });

    assert_eq!(
        extract_config_options(&config_update),
        Some(json!([
            {
                "id": "mode",
                "type": "select",
                "currentValue": "code",
            }
        ]))
    );
    assert_eq!(
        extract_available_commands(&command_update),
        Some(json!([
            {
                "name": "plan",
                "description": "Create a plan"
            }
        ]))
    );
}

#[test]
fn acp_extracts_delta_text_and_stop_reason_from_protocol_shapes() {
    let session_update = json!({
        "sessionId": "sess-chunk",
        "update": {
            "sessionUpdate": "agent_message_chunk",
            "content": [
                {
                    "type": "content",
                    "content": {
                        "type": "text",
                        "text": "First chunk"
                    }
                },
                {
                    "type": "content",
                    "content": {
                        "type": "text",
                        "text": "Second chunk"
                    }
                }
            ]
        }
    });
    let prompt_response = json!({
        "stopReason": "end_turn"
    });

    assert_eq!(
        extract_session_update_delta_text(&session_update),
        Some("First chunk\nSecond chunk".to_string())
    );
    assert_eq!(
        extract_prompt_stop_reason(&prompt_response),
        Some("end_turn".to_string())
    );
}

#[test]
fn acp_ignores_tool_call_update_content_when_extracting_agent_text() {
    let tool_call_update = json!({
        "sessionId": "sess-tool",
        "update": {
            "sessionUpdate": "tool_call_update",
            "content": [
                {
                    "type": "content",
                    "content": {
                        "type": "text",
                        "text": "tool output should not leak into assistant deltas"
                    }
                }
            ]
        }
    });

    assert_eq!(extract_session_update_delta_text(&tool_call_update), None);
}

#[test]
fn acp_ignores_non_agent_message_chunks_when_extracting_agent_text() {
    let user_message_update = json!({
        "sessionId": "sess-user",
        "update": {
            "sessionUpdate": "user_message_chunk",
            "content": [
                {
                    "type": "content",
                    "content": {
                        "type": "text",
                        "text": "user text should not stream as assistant output"
                    }
                }
            ]
        }
    });
    let thought_update = json!({
        "sessionId": "sess-thought",
        "update": {
            "sessionUpdate": "agent_thought_chunk",
            "content": [
                {
                    "type": "content",
                    "content": {
                        "type": "text",
                        "text": "hidden chain of thought should not leak"
                    }
                }
            ]
        }
    });

    assert_eq!(
        extract_session_update_delta_text(&user_message_update),
        None
    );
    assert_eq!(extract_session_update_delta_text(&thought_update), None);
}

#[test]
fn acp_builds_prompt_params_as_text_content_blocks() {
    assert_eq!(
        build_acp_prompt_params("sess-1", "Complete this through ACP"),
        json!({
            "sessionId": "sess-1",
            "prompt": [
                {
                    "type": "text",
                    "text": "Complete this through ACP"
                }
            ]
        })
    );
}

#[test]
fn acp_resolves_prompt_outcome_text_from_streamed_chunks_and_cancel_state() {
    let streamed_only = AcpPromptOutcome {
        text: None,
        stop_reason: Some("end_turn".to_string()),
    };
    let cancelled = AcpPromptOutcome {
        text: None,
        stop_reason: Some("cancelled".to_string()),
    };

    assert_eq!(
        resolve_prompt_outcome_text(
            &streamed_only,
            &["Chunk A".to_string(), "Chunk B".to_string()]
        ),
        "Chunk A\nChunk B".to_string()
    );
    assert!(prompt_outcome_was_cancelled(&cancelled));
}
