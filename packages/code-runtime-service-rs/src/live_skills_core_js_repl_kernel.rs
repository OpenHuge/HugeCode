fn create_core_js_repl_tmp_dir(workspace_id: &str) -> Result<PathBuf, String> {
    let mut sanitized = workspace_id
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch
            } else {
                '-'
            }
        })
        .collect::<String>();
    if sanitized.is_empty() {
        sanitized = "workspace".to_string();
    }
    let path = std::env::temp_dir().join(format!(
        "hypecode-js-repl-{sanitized}-{}",
        Uuid::new_v4()
    ));
    fs::create_dir_all(path.as_path())
        .map_err(|error| format!("Failed to create js_repl tmp dir `{}`: {error}", path.display()))?;
    Ok(path)
}

async fn remove_dir_all_off_thread(path: &Path) -> Result<(), String> {
    let path = path.to_path_buf();
    tokio::task::spawn_blocking(move || -> Result<(), String> {
        if !path.exists() {
            return Ok(());
        }
        fs::remove_dir_all(path.as_path())
            .map_err(|error| format!("Failed to remove `{}`: {error}", path.display()))
    })
    .await
    .map_err(|error| format!("remove dir task join failed: {error}"))?
}

async fn handle_core_js_repl_host_call(
    ctx: &AppContext,
    scope: &WorkspaceScope,
    effective_access_mode: &str,
    artifacts: &mut Vec<RuntimeArtifact>,
    nested_tool_calls: &mut Vec<Value>,
    request: CoreJsReplProtocolHostCall,
) -> Value {
    if request.message_type != "host_call" {
        return core_js_repl_host_error_response(
            request.call_id,
            "ProtocolError",
            "Unsupported host call envelope.",
        );
    }

    match request.method.as_str() {
        "tool" => {
            let tool_name = request
                .tool_name
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .unwrap_or_default()
                .to_string();
            if tool_name.is_empty() {
                nested_tool_calls.push(json!({ "name": Value::Null, "ok": false }));
                return core_js_repl_host_error_response(
                    request.call_id,
                    "ValidationError",
                    "codex.tool(name, args?) requires a non-empty tool name.",
                );
            }
            let executed = timeout(
                Duration::from_millis(CORE_JS_REPL_NESTED_TOOL_TIMEOUT_MS),
                execute_core_js_repl_nested_tool_call(
                    ctx,
                    scope,
                    effective_access_mode,
                    tool_name.as_str(),
                    request.arguments.as_ref(),
                ),
            )
            .await;
            match executed {
                Ok(Ok(result)) => {
                    nested_tool_calls.push(json!({ "name": tool_name, "ok": true }));
                    json!({
                        "op": "host_response",
                        "callId": request.call_id,
                        "ok": true,
                        "result": result,
                    })
                }
                Ok(Err(error)) => {
                    nested_tool_calls.push(json!({ "name": tool_name, "ok": false }));
                    core_js_repl_host_error_response(request.call_id, "ToolError", error.as_str())
                }
                Err(_) => {
                    nested_tool_calls.push(json!({ "name": tool_name, "ok": false }));
                    core_js_repl_host_error_response(
                        request.call_id,
                        "TimeoutError",
                        "Nested tool call timed out.",
                    )
                }
            }
        }
        "emit_image" => {
            let Some(image) = request.image.as_ref() else {
                return core_js_repl_host_error_response(
                    request.call_id,
                    "ValidationError",
                    "codex.emitImage(imageLike) requires an image payload.",
                );
            };
            match extract_core_js_repl_image_artifact(image) {
                Ok(artifact) => {
                    artifacts.push(artifact);
                    json!({
                        "op": "host_response",
                        "callId": request.call_id,
                        "ok": true,
                        "result": Value::Null,
                    })
                }
                Err(error) => {
                    core_js_repl_host_error_response(request.call_id, "ValidationError", error.as_str())
                }
            }
        }
        _ => {
            let message = format!("Unsupported host call method `{}`.", request.method);
            core_js_repl_host_error_response(request.call_id, "ProtocolError", message.as_str())
        }
    }
}

fn core_js_repl_host_error_response(call_id: u64, name: &str, message: &str) -> Value {
    json!({
        "op": "host_response",
        "callId": call_id,
        "ok": false,
        "error": {
            "name": name,
            "message": message,
        }
    })
}

async fn execute_core_js_repl_nested_tool_call(
    ctx: &AppContext,
    scope: &WorkspaceScope,
    effective_access_mode: &str,
    tool_name: &str,
    arguments: Option<&Value>,
) -> Result<Value, String> {
    let args = arguments.unwrap_or(&Value::Null);
    let object = args
        .as_object()
        .cloned()
        .unwrap_or_else(serde_json::Map::new);
    let guardrail_tool_name = core_js_repl_nested_guardrail_tool_name(tool_name);
    let payload_bytes = serde_json::to_vec(args)
        .ok()
        .map(|bytes| bytes.len())
        .and_then(|len| u64::try_from(len).ok())
        .unwrap_or(0);
    let started_at = now_ms();
    let guardrail_scope = crate::runtime_tool_metrics::RuntimeToolExecutionScope::Runtime;

    record_core_js_repl_nested_tool_phase_event(
        ctx,
        guardrail_tool_name,
        guardrail_scope,
        crate::runtime_tool_metrics::RuntimeToolExecutionEventPhase::Attempted,
        started_at,
        scope.workspace_id.as_str(),
    )
    .await;

    let guardrail_request = crate::runtime_tool_guardrails::RuntimeToolGuardrailEvaluateRequest {
        tool_name: guardrail_tool_name.to_string(),
        scope: guardrail_scope,
        workspace_id: Some(scope.workspace_id.clone()),
        payload_bytes,
        at: Some(started_at),
        request_id: None,
        trace_id: None,
        span_id: None,
        parent_span_id: None,
        planner_step_key: None,
        attempt: None,
        capability_profile:
            crate::runtime_tool_guardrails::RuntimeToolGuardrailCapabilityProfile::default(),
    };
    let guardrail_result = {
        let mut guardrails = ctx.runtime_tool_guardrails.lock().await;
        guardrails.evaluate(&guardrail_request)
    }
    .map_err(|error| format!("Nested tool `{tool_name}` guardrail evaluation failed: {error}"))?;
    if !guardrail_result.allowed {
        let message = guardrail_result
            .message
            .clone()
            .unwrap_or_else(|| format!("Nested tool `{tool_name}` blocked by runtime guardrail."));
        let error_code = guardrail_result.error_code.as_deref();
        record_core_js_repl_nested_tool_outcome(
            ctx,
            guardrail_tool_name,
            guardrail_scope,
            crate::runtime_tool_metrics::RuntimeToolExecutionStatus::Blocked,
            started_at,
            Some(0),
            error_code,
            scope.workspace_id.as_str(),
        )
        .await;
        return Err(message);
    }

    record_core_js_repl_nested_tool_phase_event(
        ctx,
        guardrail_tool_name,
        guardrail_scope,
        crate::runtime_tool_metrics::RuntimeToolExecutionEventPhase::Started,
        started_at,
        scope.workspace_id.as_str(),
    )
    .await;

    let result = match tool_name {
        "read-file" => {
            let path = read_required_nested_tool_string(&object, "path")?;
            Ok(json!(execute_core_read_skill(
                Ok(scope),
                "",
                &LiveSkillExecuteOptions {
                    workspace_id: Some(scope.workspace_id.clone()),
                    path: Some(path),
                    ..LiveSkillExecuteOptions::default()
                },
                BUILTIN_LIVE_CORE_READ_SKILL_ID,
            )
            .await))
        }
        "write-file" => {
            let path = read_required_nested_tool_string(&object, "path")?;
            let content = read_required_nested_tool_string(&object, "content")?;
            Ok(json!(execute_core_write_skill(
                Ok(scope),
                "",
                &LiveSkillExecuteOptions {
                    workspace_id: Some(scope.workspace_id.clone()),
                    path: Some(path),
                    content: Some(content),
                    ..LiveSkillExecuteOptions::default()
                },
                BUILTIN_LIVE_CORE_WRITE_SKILL_ID,
            )
            .await))
        }
        "edit-file" => {
            let path = read_required_nested_tool_string(&object, "path")?;
            let find = read_required_nested_tool_string(&object, "find")?;
            let replace = read_required_nested_tool_string(&object, "replace")?;
            Ok(json!(execute_core_edit_skill(
                Ok(scope),
                "",
                &LiveSkillExecuteOptions {
                    workspace_id: Some(scope.workspace_id.clone()),
                    path: Some(path),
                    find: Some(find),
                    replace: Some(replace),
                    ..LiveSkillExecuteOptions::default()
                },
                BUILTIN_LIVE_CORE_EDIT_SKILL_ID,
            )
            .await))
        }
        "run-shell-command" => {
            let command = read_required_nested_tool_string(&object, "command")?;
            let timeout_ms = object.get("timeoutMs").and_then(Value::as_u64);
            Ok(json!(execute_core_bash_skill(
                &ctx.config,
                &ctx.live_skill_execution_counters,
                Ok(scope),
                "",
                &LiveSkillExecuteOptions {
                    workspace_id: Some(scope.workspace_id.clone()),
                    command: Some(command),
                    timeout_ms,
                    ..LiveSkillExecuteOptions::default()
                },
                BUILTIN_LIVE_CORE_BASH_SKILL_ID,
                Some(effective_access_mode),
            )
            .await))
        }
        "inspect-workspace-diagnostics" => crate::rpc_dispatch::invoke_workspace_diagnostics_list_v1(
            ctx,
            &json!({
                "workspaceId": scope.workspace_id,
                "paths": object.get("paths").cloned().unwrap_or(Value::Null),
                "severities": object.get("severities").cloned().unwrap_or(Value::Null),
                "maxItems": object.get("maxItems").cloned().unwrap_or(Value::Null),
                "includeProviderDetails": object
                    .get("includeProviderDetails")
                    .cloned()
                    .unwrap_or(Value::Null),
            }),
        )
        .await
        .map_err(|error| error.message),
        "apply-workspace-patch" => {
            let diff = read_required_nested_tool_string(&object, "diff")?;
            crate::rpc_dispatch::invoke_workspace_patch_apply_v1(
                ctx,
                &json!({
                    "workspaceId": scope.workspace_id,
                    "diff": diff,
                    "dryRun": object.get("dryRun").cloned().unwrap_or(Value::Null),
                }),
            )
            .await
            .map_err(|error| error.message)
        }
        "get-runtime-browser-debug-status" => crate::rpc_dispatch::invoke_browser_debug_status_v1(
            ctx,
            &json!({ "workspaceId": scope.workspace_id }),
        )
        .await
        .map_err(|error| error.message),
        "inspect-runtime-browser" => crate::rpc_dispatch::invoke_browser_debug_run_v1(
            ctx,
            &json!({
                "workspaceId": scope.workspace_id,
                "operation": "inspect",
                "prompt": object.get("prompt").cloned().unwrap_or(Value::Null),
                "includeScreenshot": object.get("includeScreenshot").cloned().unwrap_or(Value::Null),
                "timeoutMs": object.get("timeoutMs").cloned().unwrap_or(Value::Null),
                "steps": object.get("steps").cloned().unwrap_or(Value::Null),
            }),
        )
        .await
        .map_err(|error| error.message),
        "run-runtime-browser-automation" => crate::rpc_dispatch::invoke_browser_debug_run_v1(
            ctx,
            &json!({
                "workspaceId": scope.workspace_id,
                "operation": "automation",
                "prompt": object.get("prompt").cloned().unwrap_or(Value::Null),
                "includeScreenshot": object.get("includeScreenshot").cloned().unwrap_or(Value::Null),
                "timeoutMs": object.get("timeoutMs").cloned().unwrap_or(Value::Null),
                "steps": object.get("steps").cloned().unwrap_or(Value::Null),
            }),
        )
        .await
        .map_err(|error| error.message),
        "get-runtime-mini-program-status" => crate::rpc_dispatch::invoke_mini_program_status_v1(
            ctx,
            &json!({ "workspaceId": scope.workspace_id }),
        )
        .await
        .map_err(|error| error.message),
        "open-runtime-mini-program-project" => crate::rpc_dispatch::invoke_mini_program_run_v1(
            ctx,
            &json!({
                "workspaceId": scope.workspace_id,
                "action": "open_project",
            }),
        )
        .await
        .map_err(|error| error.message),
        "refresh-runtime-mini-program-project" => crate::rpc_dispatch::invoke_mini_program_run_v1(
            ctx,
            &json!({
                "workspaceId": scope.workspace_id,
                "action": "refresh_project",
            }),
        )
        .await
        .map_err(|error| error.message),
        "build-runtime-mini-program-npm" => crate::rpc_dispatch::invoke_mini_program_run_v1(
            ctx,
            &json!({
                "workspaceId": scope.workspace_id,
                "action": "build_npm",
                "compileType": object.get("compileType").cloned().unwrap_or(Value::Null),
            }),
        )
        .await
        .map_err(|error| error.message),
        "preview-runtime-mini-program" => crate::rpc_dispatch::invoke_mini_program_run_v1(
            ctx,
            &json!({
                "workspaceId": scope.workspace_id,
                "action": "preview",
                "compileCondition": object.get("compileCondition").cloned().unwrap_or(Value::Null),
                "qrOutputMode": object.get("qrOutputMode").cloned().unwrap_or(Value::Null),
                "infoOutputMode": object.get("infoOutputMode").cloned().unwrap_or(Value::Null),
            }),
        )
        .await
        .map_err(|error| error.message),
        "upload-runtime-mini-program" => crate::rpc_dispatch::invoke_mini_program_run_v1(
            ctx,
            &json!({
                "workspaceId": scope.workspace_id,
                "action": "upload",
                "version": object.get("version").cloned().unwrap_or(Value::Null),
                "desc": object.get("desc").cloned().unwrap_or(Value::Null),
                "infoOutputMode": object.get("infoOutputMode").cloned().unwrap_or(Value::Null),
            }),
        )
        .await
        .map_err(|error| error.message),
        "reset-runtime-mini-program-file-watch" => {
            crate::rpc_dispatch::invoke_mini_program_run_v1(
                ctx,
                &json!({
                    "workspaceId": scope.workspace_id,
                    "action": "reset_file_watch",
                }),
            )
            .await
            .map_err(|error| error.message)
        }
        _ => Err(format!("Unsupported nested tool `{tool_name}`.")),
    };

    let duration_ms = now_ms().saturating_sub(started_at);
    let (status, error_code) = match &result {
        Ok(_) => (crate::runtime_tool_metrics::RuntimeToolExecutionStatus::Success, None),
        Err(error)
            if error.contains("timed out") =>
        {
            (crate::runtime_tool_metrics::RuntimeToolExecutionStatus::Timeout, None)
        }
        Err(error) if is_core_js_repl_blocked_error(error.as_str()) => {
            (
                crate::runtime_tool_metrics::RuntimeToolExecutionStatus::Blocked,
                Some("runtime.validation.request.blocked"),
            )
        }
        Err(_) => (
            crate::runtime_tool_metrics::RuntimeToolExecutionStatus::RuntimeFailed,
            None,
        ),
    };
    record_core_js_repl_nested_tool_outcome(
        ctx,
        guardrail_tool_name,
        guardrail_scope,
        status,
        now_ms(),
        Some(duration_ms),
        error_code,
        scope.workspace_id.as_str(),
    )
    .await;

    result
}

fn core_js_repl_nested_guardrail_tool_name(tool_name: &str) -> &str {
    match tool_name {
        "read-file" => "read-workspace-file",
        "write-file" => "write-workspace-file",
        "edit-file" => "edit-workspace-file",
        "run-shell-command" => "execute-workspace-command",
        "inspect-workspace-diagnostics" => "inspect-workspace-diagnostics",
        "apply-workspace-patch" => "apply-workspace-patch",
        "get-runtime-browser-debug-status" => "get-runtime-browser-debug-status",
        "inspect-runtime-browser" => "inspect-runtime-browser",
        "run-runtime-browser-automation" => "run-runtime-browser-automation",
        "get-runtime-mini-program-status" => "get-runtime-mini-program-status",
        "open-runtime-mini-program-project" => "open-runtime-mini-program-project",
        "refresh-runtime-mini-program-project" => "refresh-runtime-mini-program-project",
        "build-runtime-mini-program-npm" => "build-runtime-mini-program-npm",
        "preview-runtime-mini-program" => "preview-runtime-mini-program",
        "upload-runtime-mini-program" => "upload-runtime-mini-program",
        "reset-runtime-mini-program-file-watch" => "reset-runtime-mini-program-file-watch",
        _ => tool_name,
    }
}

async fn record_core_js_repl_nested_tool_phase_event(
    ctx: &AppContext,
    tool_name: &str,
    scope: crate::runtime_tool_metrics::RuntimeToolExecutionScope,
    phase: crate::runtime_tool_metrics::RuntimeToolExecutionEventPhase,
    at: u64,
    workspace_id: &str,
) {
    let event = crate::runtime_tool_metrics::RuntimeToolExecutionEvent {
        tool_name: tool_name.to_string(),
        scope,
        phase,
        at,
        status: None,
        error_code: None,
        duration_ms: None,
        trace_id: None,
        span_id: None,
        parent_span_id: None,
        attempt: None,
        request_id: None,
        planner_step_key: None,
        workspace_id: Some(workspace_id.to_string()),
    };
    let mut metrics = ctx.runtime_tool_metrics.lock().await;
    if let Err(error) = metrics.record_events([event].as_slice()) {
        drop(metrics);
        let mut guardrails = ctx.runtime_tool_guardrails.lock().await;
        let _ = guardrails.mark_channel_failure(
            "runtime tool metrics record failed",
            "runtime.validation.metrics_unhealthy",
        );
        tracing::warn!(
            error = error.as_str(),
            tool_name,
            "record core-js-repl nested tool phase event failed"
        );
    }
}

async fn record_core_js_repl_nested_tool_outcome(
    ctx: &AppContext,
    tool_name: &str,
    scope: crate::runtime_tool_metrics::RuntimeToolExecutionScope,
    status: crate::runtime_tool_metrics::RuntimeToolExecutionStatus,
    at: u64,
    duration_ms: Option<u64>,
    error_code: Option<&str>,
    workspace_id: &str,
) {
    let event = crate::runtime_tool_metrics::RuntimeToolExecutionEvent {
        tool_name: tool_name.to_string(),
        scope,
        phase: crate::runtime_tool_metrics::RuntimeToolExecutionEventPhase::Completed,
        at,
        status: Some(status),
        error_code: error_code.map(ToOwned::to_owned),
        duration_ms,
        trace_id: None,
        span_id: None,
        parent_span_id: None,
        attempt: None,
        request_id: None,
        planner_step_key: None,
        workspace_id: Some(workspace_id.to_string()),
    };
    {
        let mut metrics = ctx.runtime_tool_metrics.lock().await;
        if let Err(error) = metrics.record_events([event].as_slice()) {
            drop(metrics);
            let mut guardrails = ctx.runtime_tool_guardrails.lock().await;
            let _ = guardrails.mark_channel_failure(
                "runtime tool metrics record failed",
                "runtime.validation.metrics_unhealthy",
            );
            tracing::warn!(
                error = error.as_str(),
                tool_name,
                "record core-js-repl nested tool completion event failed"
            );
        }
    }

    let outcome_event = crate::runtime_tool_guardrails::RuntimeToolGuardrailOutcomeEvent {
        tool_name: tool_name.to_string(),
        scope,
        status,
        at,
        workspace_id: Some(workspace_id.to_string()),
        duration_ms,
        error_code: error_code.map(ToOwned::to_owned),
        request_id: None,
        trace_id: None,
        span_id: None,
        parent_span_id: None,
        planner_step_key: None,
        attempt: None,
    };
    let mut guardrails = ctx.runtime_tool_guardrails.lock().await;
    if let Err(error) = guardrails.record_outcome(&outcome_event) {
        let _ = guardrails.mark_channel_failure(
            "runtime tool guardrail outcome persistence failed",
            "runtime.validation.metrics_unhealthy",
        );
        tracing::warn!(
            error = error.as_str(),
            tool_name,
            "record core-js-repl nested tool guardrail outcome failed"
        );
    }
}

fn is_core_js_repl_blocked_error(error: &str) -> bool {
    let normalized = error.trim().to_ascii_lowercase();
    normalized.contains("blocked by runtime guardrail")
        || normalized.contains("request.blocked")
        || normalized.contains("command.restricted")
}

fn read_required_nested_tool_string(
    object: &serde_json::Map<String, Value>,
    field: &str,
) -> Result<String, String> {
    object
        .get(field)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .ok_or_else(|| format!("{field} is required."))
}

fn extract_core_js_repl_image_artifact(value: &Value) -> Result<RuntimeArtifact, String> {
    if let Some(data_url) = value.as_str() {
        return decode_core_js_repl_data_url(data_url);
    }

    let Some(object) = value.as_object() else {
        return Err("codex.emitImage(...) requires a data URL or image object.".to_string());
    };

    if object.get("kind").and_then(Value::as_str) == Some("image") {
        return runtime_image_artifact_from_object(object);
    }

    if object.contains_key("bytes") {
        let mime_type = object
            .get("mimeType")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| "mimeType is required for image byte payloads.".to_string())?;
        let bytes = decode_core_js_repl_bytes_value(
            object
                .get("bytes")
                .ok_or_else(|| "bytes is required.".to_string())?,
        )?;
        return runtime_image_artifact_from_bytes(
            mime_type,
            bytes.as_slice(),
            object
                .get("title")
                .and_then(Value::as_str)
                .map(str::to_string),
            object
                .get("detail")
                .and_then(Value::as_str)
                .map(str::to_string),
        );
    }

    if let Some(artifacts) = object.get("artifacts").and_then(Value::as_array) {
        let has_text = ["message", "contentText", "output"]
            .into_iter()
            .any(|field| {
                object
                    .get(field)
                    .and_then(Value::as_str)
                    .is_some_and(|value| !value.trim().is_empty())
            });
        if has_text {
            return Err("codex.emitImage(...) rejects mixed text-and-image tool results.".to_string());
        }
        if artifacts.len() != 1 {
            return Err("codex.emitImage(...) requires exactly one image artifact.".to_string());
        }
        return extract_core_js_repl_image_artifact(&artifacts[0]);
    }

    Err("Unsupported image payload for codex.emitImage(...).".to_string())
}

fn runtime_image_artifact_from_object(
    object: &serde_json::Map<String, Value>,
) -> Result<RuntimeArtifact, String> {
    let mime_type = object
        .get("mimeType")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "mimeType is required for image artifacts.".to_string())?;
    let data_base64 = object
        .get("dataBase64")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "dataBase64 is required for image artifacts.".to_string())?;
    let decoded = base64::engine::general_purpose::STANDARD
        .decode(data_base64)
        .map_err(|error| format!("Invalid base64 image payload: {error}"))?;
    runtime_image_artifact_from_bytes(
        mime_type,
        decoded.as_slice(),
        object
            .get("title")
            .and_then(Value::as_str)
            .map(str::to_string),
        object
            .get("detail")
            .and_then(Value::as_str)
            .map(str::to_string),
    )
}

fn decode_core_js_repl_data_url(data_url: &str) -> Result<RuntimeArtifact, String> {
    let trimmed = data_url.trim();
    let encoded = trimmed
        .strip_prefix("data:")
        .ok_or_else(|| "Image data URL must start with `data:`.".to_string())?;
    let (metadata, payload) = encoded
        .split_once(',')
        .ok_or_else(|| "Invalid image data URL.".to_string())?;
    let mime_type = metadata
        .strip_suffix(";base64")
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Image data URL must use base64 encoding.".to_string())?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(payload.trim())
        .map_err(|error| format!("Invalid image data URL payload: {error}"))?;
    runtime_image_artifact_from_bytes(mime_type, bytes.as_slice(), None, None)
}

fn decode_core_js_repl_bytes_value(value: &Value) -> Result<Vec<u8>, String> {
    match value {
        Value::String(encoded) => base64::engine::general_purpose::STANDARD
            .decode(encoded.trim())
            .map_err(|error| format!("Invalid base64 bytes payload: {error}")),
        Value::Array(values) => values
            .iter()
            .map(|entry| {
                entry
                    .as_u64()
                    .and_then(|value| u8::try_from(value).ok())
                    .ok_or_else(|| "bytes array entries must be integers between 0 and 255.".to_string())
            })
            .collect(),
        Value::Object(object)
            if object.get("type").and_then(Value::as_str) == Some("Buffer") =>
        {
            decode_core_js_repl_bytes_value(
                object
                    .get("data")
                    .ok_or_else(|| "Buffer payload is missing `data`.".to_string())?,
            )
        }
        _ => Err("Unsupported bytes payload; use base64, Buffer, or byte array.".to_string()),
    }
}

fn runtime_image_artifact_from_bytes(
    mime_type: &str,
    bytes: &[u8],
    title: Option<String>,
    detail: Option<String>,
) -> Result<RuntimeArtifact, String> {
    if bytes.is_empty() {
        return Err("Image payload must not be empty.".to_string());
    }
    if bytes.len() > CORE_JS_REPL_ARTIFACT_MAX_BYTES {
        return Err(format!(
            "Image payload exceeds {} bytes.",
            CORE_JS_REPL_ARTIFACT_MAX_BYTES
        ));
    }
    Ok(RuntimeArtifact::Image {
        title,
        mime_type: mime_type.to_string(),
        data_base64: base64::engine::general_purpose::STANDARD.encode(bytes),
        detail,
    })
}
