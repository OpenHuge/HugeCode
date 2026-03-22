const MAX_CORE_JS_REPL_SOURCE_BYTES: usize = 64 * 1024;
const CORE_JS_REPL_PROTOCOL_OUTPUT_BYTES: usize = 128 * 1024;
const CORE_JS_REPL_ARTIFACT_MAX_BYTES: usize = 2 * 1024 * 1024;
const CORE_JS_REPL_NESTED_TOOL_TIMEOUT_MS: u64 = 20_000;

const CORE_JS_REPL_CONTROLLER_SOURCE: &str = r###"
import repl from 'node:repl';
import readline from 'node:readline';
import util from 'node:util';
import { PassThrough, Writable } from 'node:stream';

const MAX_CAPTURE_BYTES = 128 * 1024;
const MAX_VALUE_BYTES = 16 * 1024;

function createSink() {
  return new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
}

function createReplServer() {
  return repl.start({
    prompt: '',
    input: new PassThrough(),
    output: createSink(),
    terminal: false,
    useGlobal: true,
    ignoreUndefined: false,
    useColors: false,
    breakEvalOnSigint: true,
  });
}

function formatValue(value, maxBytes = MAX_VALUE_BYTES) {
  const rendered =
    typeof value === 'string'
      ? value
      : util.inspect(value, { colors: false, depth: 4, maxArrayLength: 50, breakLength: 100 });
  const byteLength = Buffer.byteLength(rendered);
  if (byteLength <= maxBytes) {
    return rendered;
  }
  return `${rendered.slice(0, Math.max(0, maxBytes - 16))}...[truncated]`;
}

function appendCapturedLine(target, state, args) {
  if (!Array.isArray(args) || args.length === 0) {
    return;
  }
  const rendered = args.map((value) => formatValue(value, MAX_CAPTURE_BYTES)).join(' ');
  const remaining = MAX_CAPTURE_BYTES - state.totalBytes;
  if (remaining <= 0) {
    state.truncated = true;
    return;
  }
  const renderedBytes = Buffer.byteLength(rendered);
  if (renderedBytes <= remaining) {
    target.push(rendered);
    state.totalBytes += renderedBytes;
    return;
  }
  const sliceLength = Math.max(0, remaining - 16);
  target.push(`${rendered.slice(0, sliceLength)}...[truncated]`);
  state.totalBytes = MAX_CAPTURE_BYTES;
  state.truncated = true;
}

function captureWritable(target, state) {
  return (chunk, encoding, callback) => {
    const rendered = Buffer.isBuffer(chunk)
      ? chunk.toString(typeof encoding === 'string' ? encoding : 'utf8')
      : String(chunk);
    appendCapturedLine(target, state, [rendered]);
    if (typeof callback === 'function') {
      callback();
    }
    return true;
  };
}

let replServer = createReplServer();
let requestChain = Promise.resolve();
const protocolWrite = process.stdout.write.bind(process.stdout);
const pendingHostCalls = new Map();
let nextHostCallId = 0;
const kernelState = {
  tmpDir: null,
};

function sendResponse(message) {
  protocolWrite(`${JSON.stringify(message)}\n`);
}

function createHostCall(method, payload) {
  const callId = ++nextHostCallId;
  return new Promise((resolve, reject) => {
    pendingHostCalls.set(callId, { resolve, reject });
    sendResponse({
      type: 'host_call',
      callId,
      method,
      ...payload,
    });
  });
}

function resolveHostCall(message) {
  const callId = Number(message.callId);
  if (!Number.isFinite(callId)) {
    return;
  }
  const pending = pendingHostCalls.get(callId);
  if (!pending) {
    return;
  }
  pendingHostCalls.delete(callId);
  if (message.ok === false) {
    const error = new Error(
      typeof message.error?.message === 'string' ? message.error.message : 'Host call failed.'
    );
    if (typeof message.error?.name === 'string' && message.error.name) {
      error.name = message.error.name;
    }
    pending.reject(error);
    return;
  }
  pending.resolve(message.result ?? null);
}

globalThis.codex = {
  get tmpDir() {
    return kernelState.tmpDir;
  },
  tool(name, args) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      throw new Error('codex.tool(name, args?) requires a non-empty tool name.');
    }
    return createHostCall('tool', {
      toolName: name.trim(),
      arguments: args ?? null,
    });
  },
  emitImage(imageLike) {
    return createHostCall('emit_image', {
      image: imageLike ?? null,
    });
  },
};

async function evaluateCode(message) {
  const stdout = [];
  const stderr = [];
  const stdoutState = { totalBytes: 0, truncated: false };
  const stderrState = { totalBytes: 0, truncated: false };
  const originalConsole = globalThis.console;
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);

  globalThis.console = {
    ...originalConsole,
    log: (...args) => appendCapturedLine(stdout, stdoutState, args),
    info: (...args) => appendCapturedLine(stdout, stdoutState, args),
    debug: (...args) => appendCapturedLine(stdout, stdoutState, args),
    warn: (...args) => appendCapturedLine(stderr, stderrState, args),
    error: (...args) => appendCapturedLine(stderr, stderrState, args),
  };
  process.stdout.write = captureWritable(stdout, stdoutState);
  process.stderr.write = captureWritable(stderr, stderrState);
  kernelState.tmpDir = typeof message.tmpDir === 'string' ? message.tmpDir : null;

  try {
    const result = await new Promise((resolve) => {
      replServer.eval(message.code, replServer.context, 'runtime-js-repl', (error, value) => {
        resolve({ error, value });
      });
    });
    if (result.error) {
      sendResponse({
        type: 'eval_result',
        id: message.id,
        ok: false,
        stdout,
        stderr,
        truncated: stdoutState.truncated || stderrState.truncated,
        error: {
          name: result.error.name ?? 'Error',
          message: result.error.message ?? String(result.error),
          stack: result.error.stack ? formatValue(result.error.stack, MAX_CAPTURE_BYTES) : null,
        },
      });
      return;
    }
    const value = formatValue(result.value);
    sendResponse({
      type: 'eval_result',
      id: message.id,
      ok: true,
      stdout,
      stderr,
      truncated: stdoutState.truncated || stderrState.truncated,
      value,
    });
  } finally {
    globalThis.console = originalConsole;
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
  terminal: false,
});

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) {
    return;
  }
  let message;
  try {
    message = JSON.parse(trimmed);
  } catch (error) {
    sendResponse({
      id: null,
      ok: false,
      stdout: [],
      stderr: [],
      truncated: false,
      error: {
        name: 'ProtocolError',
        message: `Invalid JSON request: ${error instanceof Error ? error.message : String(error)}`,
        stack: null,
      },
    });
    return;
  }
  if (message.op === 'host_response') {
    resolveHostCall(message);
    return;
  }
  requestChain = requestChain
    .then(async () => {
      if (message.op !== 'eval' || typeof message.code !== 'string') {
        sendResponse({
          id: message.id ?? null,
          ok: false,
          stdout: [],
          stderr: [],
          truncated: false,
          error: {
            name: 'ProtocolError',
            message: 'Unsupported request. Expected { op: \"eval\", code: string }.',
            stack: null,
          },
        });
        return;
      }
      await evaluateCode(message);
    })
    .catch((error) => {
      sendResponse({
        id: null,
        ok: false,
        stdout: [],
        stderr: [],
        truncated: false,
        error: {
          name: error?.name ?? 'ProtocolError',
          message: error?.message ?? String(error),
          stack: error?.stack ? formatValue(error.stack, MAX_CAPTURE_BYTES) : null,
        },
      });
    });
});
"###;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CoreJsReplProtocolResponse {
    id: Option<u64>,
    #[allow(dead_code)]
    #[serde(default, alias = "type")]
    message_type: Option<String>,
    ok: bool,
    #[serde(default)]
    value: Option<String>,
    #[serde(default)]
    stdout: Vec<String>,
    #[serde(default)]
    stderr: Vec<String>,
    #[serde(default)]
    truncated: bool,
    #[serde(default)]
    error: Option<CoreJsReplProtocolError>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CoreJsReplProtocolError {
    #[serde(default)]
    name: Option<String>,
    message: String,
    #[serde(default)]
    stack: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CoreJsReplProtocolHostCall {
    #[serde(alias = "type")]
    message_type: String,
    call_id: u64,
    method: String,
    #[serde(default)]
    tool_name: Option<String>,
    #[serde(default)]
    arguments: Option<Value>,
    #[serde(default)]
    image: Option<Value>,
}

enum CoreJsReplEvalOutcome {
    Response(CoreJsReplEvalResult),
    Timeout,
    Cancelled,
}

struct CoreJsReplEvalResult {
    response: CoreJsReplProtocolResponse,
    artifacts: Vec<RuntimeArtifact>,
    nested_tool_calls: Vec<Value>,
}

#[cfg(test)]
async fn execute_core_js_repl_skill(
    ctx: &AppContext,
    config: &ServiceConfig,
    counters: &LiveSkillExecutionCounters,
    session_store: &LiveSkillCoreJsReplSessionStore,
    resolved_scope: Result<&WorkspaceScope, &String>,
    input: &str,
    options: &LiveSkillExecuteOptions,
    skill_id: &str,
    access_mode_hint: Option<&str>,
) -> LiveSkillExecutionResult {
    execute_core_js_repl_skill_with_cancel(
        ctx,
        config,
        counters,
        session_store,
        resolved_scope,
        input,
        options,
        skill_id,
        access_mode_hint,
        None,
    )
    .await
}

async fn execute_core_js_repl_skill_with_cancel(
    ctx: &AppContext,
    config: &ServiceConfig,
    counters: &LiveSkillExecutionCounters,
    session_store: &LiveSkillCoreJsReplSessionStore,
    resolved_scope: Result<&WorkspaceScope, &String>,
    input: &str,
    options: &LiveSkillExecuteOptions,
    skill_id: &str,
    access_mode_hint: Option<&str>,
    cancellation: Option<CancellationToken>,
) -> LiveSkillExecutionResult {
    let scope = match resolved_scope {
        Ok(scope) => scope,
        Err(error) => return core_failed_result(skill_id, error.clone(), Value::Null),
    };

    if let Err(error) = create_dir_all_off_thread(scope.workspace_path.as_path()).await {
        return core_failed_result(
            skill_id,
            format!(
                "Failed to prepare workspace `{}`: {error}",
                scope.workspace_path.display()
            ),
            json!({ "workspaceId": scope.workspace_id }),
        );
    }

    let Some(source) = resolve_core_js_repl_source(input, options) else {
        return core_failed_result(
            skill_id,
            "JavaScript source is required for core-js-repl.".to_string(),
            json!({ "workspaceId": scope.workspace_id }),
        );
    };
    if source.as_bytes().len() > MAX_CORE_JS_REPL_SOURCE_BYTES {
        return core_failed_result_with_error_code(
            skill_id,
            format!(
                "JavaScript source must be <= {} bytes.",
                MAX_CORE_JS_REPL_SOURCE_BYTES
            ),
            CORE_VALIDATION_PAYLOAD_TOO_LARGE_ERROR_CODE,
            json!({
                "workspaceId": scope.workspace_id,
                "sourceBytes": source.as_bytes().len(),
            }),
        );
    }

    let timeout_ms = normalize_optional_u64(
        options.timeout_ms,
        DEFAULT_CORE_SHELL_TIMEOUT_MS,
        250,
        120_000,
    );
    let effective_access_mode = normalize_core_bash_access_mode(access_mode_hint);
    if config.sandbox_enabled && effective_access_mode != "full-access" {
        return execute_core_js_repl_sandboxed(
            config,
            counters,
            scope,
            skill_id,
            source,
            timeout_ms,
            effective_access_mode,
        )
        .await;
    }

    let session_entry = ensure_core_js_repl_session(session_store, scope).await;
    let session_handle = match session_entry {
        Ok(session) => session,
        Err(error) => {
            return core_failed_result(
                skill_id,
                error,
                json!({
                    "workspaceId": scope.workspace_id,
                    "timeoutMs": timeout_ms,
                    "sandboxed": false,
                    "runtime": "node",
                    "invocationMode": "persistent_repl",
                    "effectiveAccessMode": effective_access_mode,
                    "sourceBytes": source.as_bytes().len(),
                }),
            )
        }
    };
    let mut session = session_handle.lock().await;

    let should_retry_after_timeout = should_retry_core_js_repl_after_timeout(source);
    let mut retried_after_timeout = false;
    let executed = match session
        .evaluate(
            ctx,
            scope,
            source,
            timeout_ms,
            effective_access_mode,
            cancellation.as_ref(),
        )
        .await
    {
        Ok(CoreJsReplEvalOutcome::Timeout) if should_retry_after_timeout => {
            if let Err(error) = session.respawn().await {
                return core_failed_result(
                    skill_id,
                    format!("JavaScript timed out after {timeout_ms}ms, and session recovery failed: {error}"),
                    json!({
                        "workspaceId": scope.workspace_id,
                        "timeoutMs": timeout_ms,
                        "sandboxed": false,
                        "runtime": "node",
                        "invocationMode": "persistent_repl",
                        "effectiveAccessMode": effective_access_mode,
                        "sourceBytes": source.as_bytes().len(),
                        "persistentSession": true,
                        "sessionId": session.session_id,
                        "retriedAfterTimeout": true,
                    }),
                );
            }
            retried_after_timeout = true;
            session
                .evaluate(
                    ctx,
                    scope,
                    source,
                    timeout_ms,
                    effective_access_mode,
                    cancellation.as_ref(),
                )
                .await
        }
        other => other,
    };
    match executed {
        Ok(CoreJsReplEvalOutcome::Response(result)) => {
            let response = result.response;
            let output = format_core_js_repl_output(&response);
            let status = if response.ok { "completed" } else { "failed" };
            let protocol_error = response.error.as_ref();
            LiveSkillExecutionResult {
                run_id: new_id("live-skill-run"),
                skill_id: skill_id.to_string(),
                status: status.to_string(),
                message: build_core_js_repl_message(status, protocol_error),
                output,
                network: None,
                artifacts: result.artifacts,
                metadata: json!({
                    "workspaceId": scope.workspace_id,
                    "timeoutMs": timeout_ms,
                    "runtime": "node",
                    "persistentSession": true,
                    "sessionId": session.session_id,
                    "sessionCreatedAtMs": session.created_at_ms,
                    "sessionLastUsedAtMs": session.last_used_at_ms,
                    "protocolRequestId": response.id,
                    "outputTruncated": response.truncated,
                    "errorName": protocol_error.and_then(|error| error.name.clone()),
                    "kernel": {
                        "sessionMode": "persistent",
                        "tmpDir": session.tmp_dir.display().to_string(),
                        "nestedToolCalls": result.nested_tool_calls,
                    },
                    "retriedAfterTimeout": retried_after_timeout,
                    "sandboxed": false,
                    "invocationMode": "persistent_repl",
                    "effectiveAccessMode": effective_access_mode,
                    "sourceBytes": source.as_bytes().len(),
                }),
            }
        }
        Ok(CoreJsReplEvalOutcome::Timeout) => core_failed_result(
            skill_id,
            format!("JavaScript timed out after {timeout_ms}ms."),
            json!({
                "workspaceId": scope.workspace_id,
                "timeoutMs": timeout_ms,
                "sandboxed": false,
                "runtime": "node",
                "invocationMode": "persistent_repl",
                "effectiveAccessMode": effective_access_mode,
                "sourceBytes": source.as_bytes().len(),
                "persistentSession": true,
                "sessionId": session.session_id,
                "kernel": {
                    "sessionMode": "persistent",
                    "tmpDir": session.tmp_dir.display().to_string(),
                    "nestedToolCalls": [],
                },
                "retriedAfterTimeout": retried_after_timeout,
            }),
        ),
        Ok(CoreJsReplEvalOutcome::Cancelled) => core_failed_result_with_error_code(
            skill_id,
            "JavaScript execution cancelled.".to_string(),
            CORE_RUNTIME_COMMAND_CANCELLED_ERROR_CODE,
            json!({
                "workspaceId": scope.workspace_id,
                "timeoutMs": timeout_ms,
                "sandboxed": false,
                "runtime": "node",
                "invocationMode": "persistent_repl",
                "effectiveAccessMode": effective_access_mode,
                "sourceBytes": source.as_bytes().len(),
                "persistentSession": true,
                "sessionId": session.session_id,
                "kernel": {
                    "sessionMode": "persistent",
                    "tmpDir": session.tmp_dir.display().to_string(),
                    "nestedToolCalls": [],
                },
                "retriedAfterTimeout": retried_after_timeout,
                "cancelled": true,
            }),
        ),
        Err(error) => core_failed_result(
            skill_id,
            error,
            json!({
                "workspaceId": scope.workspace_id,
                "timeoutMs": timeout_ms,
                "sandboxed": false,
                "runtime": "node",
                "invocationMode": "persistent_repl",
                "effectiveAccessMode": effective_access_mode,
                "sourceBytes": source.as_bytes().len(),
                "persistentSession": true,
                "sessionId": session.session_id,
                "kernel": {
                    "sessionMode": "persistent",
                    "tmpDir": session.tmp_dir.display().to_string(),
                    "nestedToolCalls": [],
                },
                "retriedAfterTimeout": retried_after_timeout,
            }),
        ),
    }
}

fn should_retry_core_js_repl_after_timeout(source: &str) -> bool {
    let lowered = source.to_ascii_lowercase();
    lowered.contains("get-runtime-browser-debug-status")
        || lowered.contains("inspect-runtime-browser")
        || lowered.contains("run-runtime-browser-automation")
}

async fn execute_core_js_repl_reset_skill(
    session_store: &LiveSkillCoreJsReplSessionStore,
    resolved_scope: Result<&WorkspaceScope, &String>,
    skill_id: &str,
) -> LiveSkillExecutionResult {
    let scope = match resolved_scope {
        Ok(scope) => scope,
        Err(error) => return core_failed_result(skill_id, error.clone(), Value::Null),
    };

    let removed = {
        let mut sessions = session_store.write().await;
        sessions.remove(scope.workspace_id.as_str())
    };
    let mut previous_session_id = None;
    if let Some(session) = removed {
        let mut session_guard = session.lock().await;
        previous_session_id = Some(session_guard.session_id.clone());
        session_guard.terminate().await;
    }

    core_completed_result(
        skill_id,
        if previous_session_id.is_some() {
            "JavaScript REPL session reset.".to_string()
        } else {
            "No JavaScript REPL session was active.".to_string()
        },
        String::new(),
        json!({
            "workspaceId": scope.workspace_id,
            "resetAtMs": now_ms(),
            "previousSessionId": previous_session_id,
        }),
    )
}

fn resolve_core_js_repl_source<'a>(
    input: &'a str,
    options: &'a LiveSkillExecuteOptions,
) -> Option<&'a str> {
    options.content.as_deref().or_else(|| {
        let trimmed = input.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

async fn execute_core_js_repl_sandboxed(
    config: &ServiceConfig,
    counters: &LiveSkillExecutionCounters,
    scope: &WorkspaceScope,
    skill_id: &str,
    source: &str,
    timeout_ms: u64,
    effective_access_mode: &str,
) -> LiveSkillExecutionResult {
    counters.record_sandbox_exec_attempt();
    let network_access = normalize_sandbox_network_access(config.sandbox_network_access.as_str());
    let fs_access = if effective_access_mode == "read-only" {
        sandbox_rs::RuntimeFsAccess::ReadOnly
    } else {
        sandbox_rs::RuntimeFsAccess::ReadWrite
    };
    let sandbox_config = sandbox_rs::RuntimeSandboxConfig {
        network_access: network_access.to_string(),
        allowed_hosts: if config.sandbox_allowed_hosts.is_empty() {
            None
        } else {
            Some(config.sandbox_allowed_hosts.clone())
        },
        allowed_roots: Some(vec![scope.workspace_path.display().to_string()]),
        fs_isolation: "workspace".to_string(),
        fs_access,
        working_directory: Some(scope.workspace_path.display().to_string()),
    };
    let options = sandbox_rs::RuntimeExecOptions {
        cwd: Some(scope.workspace_path.display().to_string()),
        timeout_ms: Some(timeout_ms),
        stdin: None,
        max_output_bytes: Some(MAX_CORE_SHELL_CAPTURE_BYTES),
        env: HashMap::new(),
    };
    let source_owned = source.to_string();
    let executed = tokio::task::spawn_blocking(move || {
        sandbox_rs::execute_native_command(
            sandbox_config,
            "node",
            &[
                "--input-type=module".to_string(),
                "--eval".to_string(),
                source_owned,
            ],
            options,
        )
    })
    .await
    .map_err(|error| format!("Sandbox execution task failed: {error}"));

    match executed {
        Ok(Ok(result)) => {
            if result.timed_out {
                counters.record_sandbox_exec_failure();
                return core_failed_result(
                    skill_id,
                    format!("JavaScript timed out after {timeout_ms}ms."),
                    json!({
                        "workspaceId": scope.workspace_id,
                        "timeoutMs": timeout_ms,
                        "sandboxed": true,
                        "runtime": "node",
                        "invocationMode": "esm_eval",
                        "effectiveAccessMode": effective_access_mode,
                        "sourceBytes": source.as_bytes().len(),
                        "persistentSession": false,
                        "kernel": {
                            "sessionMode": "fallback",
                            "tmpDir": Value::Null,
                            "nestedToolCalls": [],
                        },
                        "sandboxPolicy": {
                            "fsAccess": if fs_access == sandbox_rs::RuntimeFsAccess::ReadOnly { "read-only" } else { "read-write" },
                            "networkAccess": network_access,
                        }
                    }),
                );
            }
            let output = [result.stdout.as_str(), result.stderr.as_str()]
                .iter()
                .map(|entry| entry.trim())
                .filter(|entry| !entry.is_empty())
                .collect::<Vec<_>>()
                .join("\n");
            let status = if result.exit_code == 0 {
                "completed"
            } else {
                "failed"
            };
            if status == "failed" {
                counters.record_sandbox_exec_failure();
            }
            LiveSkillExecutionResult {
                run_id: new_id("live-skill-run"),
                skill_id: skill_id.to_string(),
                status: status.to_string(),
                message: if status == "completed" {
                    format!("JavaScript completed with exit code {}.", result.exit_code)
                } else {
                    format!("JavaScript failed with exit code {}.", result.exit_code)
                },
                output,
                network: None,
                artifacts: vec![],
                metadata: json!({
                    "workspaceId": scope.workspace_id,
                    "timeoutMs": timeout_ms,
                    "exitCode": result.exit_code,
                    "stdoutBytes": result.stdout.as_bytes().len(),
                    "stderrBytes": result.stderr.as_bytes().len(),
                    "sandboxed": true,
                    "runtime": "node",
                    "invocationMode": "esm_eval",
                    "effectiveAccessMode": effective_access_mode,
                    "sourceBytes": source.as_bytes().len(),
                    "persistentSession": false,
                    "kernel": {
                        "sessionMode": "fallback",
                        "tmpDir": Value::Null,
                        "nestedToolCalls": [],
                    },
                    "sandboxPolicy": {
                        "fsAccess": if fs_access == sandbox_rs::RuntimeFsAccess::ReadOnly { "read-only" } else { "read-write" },
                        "networkAccess": network_access,
                    }
                }),
            }
        }
        Ok(Err(error)) => {
            counters.record_sandbox_exec_failure();
            core_failed_result_with_error_code(
                skill_id,
                format!("Sandbox execution unavailable: {error}"),
                CORE_SANDBOX_UNAVAILABLE_ERROR_CODE,
                json!({
                    "workspaceId": scope.workspace_id,
                    "timeoutMs": timeout_ms,
                    "sandboxed": true,
                    "runtime": "node",
                    "invocationMode": "esm_eval",
                    "effectiveAccessMode": effective_access_mode,
                    "sourceBytes": source.as_bytes().len(),
                    "persistentSession": false,
                    "sandboxErrorCode": CORE_SANDBOX_UNAVAILABLE_ERROR_CODE,
                    "kernel": {
                        "sessionMode": "fallback",
                        "tmpDir": Value::Null,
                        "nestedToolCalls": [],
                    },
                    "sandboxPolicy": {
                        "fsAccess": if fs_access == sandbox_rs::RuntimeFsAccess::ReadOnly { "read-only" } else { "read-write" },
                        "networkAccess": network_access,
                    }
                }),
            )
        }
        Err(error) => {
            counters.record_sandbox_exec_failure();
            core_failed_result_with_error_code(
                skill_id,
                format!("Sandbox execution unavailable: {error}"),
                CORE_SANDBOX_UNAVAILABLE_ERROR_CODE,
                json!({
                    "workspaceId": scope.workspace_id,
                    "timeoutMs": timeout_ms,
                    "sandboxed": true,
                    "runtime": "node",
                    "invocationMode": "esm_eval",
                    "effectiveAccessMode": effective_access_mode,
                    "sourceBytes": source.as_bytes().len(),
                    "persistentSession": false,
                    "sandboxErrorCode": CORE_SANDBOX_UNAVAILABLE_ERROR_CODE,
                    "kernel": {
                        "sessionMode": "fallback",
                        "tmpDir": Value::Null,
                        "nestedToolCalls": [],
                    },
                }),
            )
        }
    }
}

async fn ensure_core_js_repl_session(
    session_store: &LiveSkillCoreJsReplSessionStore,
    scope: &WorkspaceScope,
) -> Result<Arc<AsyncMutex<CoreJsReplSession>>, String> {
    if let Some(existing) = session_store.read().await.get(scope.workspace_id.as_str()).cloned() {
        return Ok(existing);
    }

    let created = Arc::new(AsyncMutex::new(
        CoreJsReplSession::spawn(scope.workspace_id.as_str(), scope.workspace_path.as_path())
            .await?,
    ));
    let mut sessions = session_store.write().await;
    Ok(sessions
        .entry(scope.workspace_id.clone())
        .or_insert_with(|| created.clone())
        .clone())
}

impl CoreJsReplSession {
    async fn spawn(workspace_id: &str, workspace_path: &Path) -> Result<Self, String> {
        let (
            process,
            stdin,
            stdout,
            stderr_buffer,
            stderr_task,
            tmp_dir,
            created_at_ms,
        ) = spawn_core_js_repl_process(workspace_id, workspace_path).await?;
        Ok(Self {
            session_id: new_id("js-repl-session"),
            workspace_path: workspace_path.to_path_buf(),
            tmp_dir,
            process,
            stdin,
            stdout,
            stderr_buffer,
            stderr_task,
            created_at_ms,
            last_used_at_ms: created_at_ms,
            next_request_id: 0,
        })
    }

    async fn evaluate(
        &mut self,
        ctx: &AppContext,
        scope: &WorkspaceScope,
        source: &str,
        timeout_ms: u64,
        effective_access_mode: &str,
        cancellation: Option<&CancellationToken>,
    ) -> Result<CoreJsReplEvalOutcome, String> {
        self.ensure_process_running().await?;
        self.next_request_id = self.next_request_id.saturating_add(1);
        self.last_used_at_ms = now_ms();

        let payload = json!({
            "id": self.next_request_id,
            "op": "eval",
            "code": source,
            "tmpDir": self.tmp_dir.display().to_string(),
        });
        let payload_line =
            serde_json::to_string(&payload).map_err(|error| format!("Failed to serialize JavaScript request: {error}"))?;
        self.stdin
            .write_all(payload_line.as_bytes())
            .await
            .map_err(|error| format!("Failed to write JavaScript request: {error}"))?;
        self.stdin
            .write_all(b"\n")
            .await
            .map_err(|error| format!("Failed to finalize JavaScript request: {error}"))?;
        self.stdin
            .flush()
            .await
            .map_err(|error| format!("Failed to flush JavaScript request: {error}"))?;

        let deadline = tokio::time::Instant::now() + Duration::from_millis(timeout_ms);
        let mut artifacts = Vec::new();
        let mut nested_tool_calls = Vec::new();
        loop {
            if cancellation.is_some_and(CancellationToken::is_cancelled) {
                self.terminate().await;
                return Ok(CoreJsReplEvalOutcome::Cancelled);
            }
            let mut line = String::new();
            let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
            if remaining.is_zero() {
                self.terminate().await;
                return Ok(CoreJsReplEvalOutcome::Timeout);
            }
            let bytes_read = if let Some(cancellation) = cancellation {
                tokio::select! {
                    _ = cancellation.cancelled() => {
                        self.terminate().await;
                        return Ok(CoreJsReplEvalOutcome::Cancelled);
                    }
                    read = timeout(remaining, self.stdout.read_line(&mut line)) => {
                        match read {
                            Ok(Ok(bytes_read)) => bytes_read,
                            Ok(Err(error)) => {
                                return Err(format!("Failed to read JavaScript response: {error}"));
                            }
                            Err(_) => {
                                self.terminate().await;
                                return Ok(CoreJsReplEvalOutcome::Timeout);
                            }
                        }
                    }
                }
            } else {
                let read = timeout(remaining, self.stdout.read_line(&mut line)).await;
                match read {
                    Ok(Ok(bytes_read)) => bytes_read,
                    Ok(Err(error)) => {
                        return Err(format!("Failed to read JavaScript response: {error}"));
                    }
                    Err(_) => {
                        self.terminate().await;
                        return Ok(CoreJsReplEvalOutcome::Timeout);
                    }
                }
            };
            if bytes_read == 0 {
                let stderr = self.read_stderr_snapshot();
                return Err(if stderr.is_empty() {
                    "JavaScript REPL session exited unexpectedly.".to_string()
                } else {
                    format!("JavaScript REPL session exited unexpectedly: {stderr}")
                });
            }

            let value: Value = serde_json::from_str(line.trim_end())
                .map_err(|error| format!("Failed to parse JavaScript response: {error}"))?;
            if value.get("type").and_then(Value::as_str) == Some("host_call") {
                let host_call: CoreJsReplProtocolHostCall =
                    serde_json::from_value(value)
                        .map_err(|error| format!("Failed to parse JavaScript host call: {error}"))?;
                let response = handle_core_js_repl_host_call(
                    ctx,
                    scope,
                    effective_access_mode,
                    &mut artifacts,
                    &mut nested_tool_calls,
                    host_call,
                )
                .await;
                let encoded = serde_json::to_string(&response)
                    .map_err(|error| format!("Failed to encode JavaScript host response: {error}"))?;
                self.stdin
                    .write_all(encoded.as_bytes())
                    .await
                    .map_err(|error| format!("Failed to write JavaScript host response: {error}"))?;
                self.stdin
                    .write_all(b"\n")
                    .await
                    .map_err(|error| format!("Failed to finalize JavaScript host response: {error}"))?;
                self.stdin
                    .flush()
                    .await
                    .map_err(|error| format!("Failed to flush JavaScript host response: {error}"))?;
                continue;
            }

            let response: CoreJsReplProtocolResponse =
                serde_json::from_value(value)
                    .map_err(|error| format!("Failed to parse JavaScript response envelope: {error}"))?;
            return Ok(CoreJsReplEvalOutcome::Response(CoreJsReplEvalResult {
                response,
                artifacts,
                nested_tool_calls,
            }));
        }
    }

    async fn ensure_process_running(&mut self) -> Result<(), String> {
        match self.process.try_wait() {
            Ok(Some(_)) => self.respawn().await,
            Ok(None) => Ok(()),
            Err(error) => Err(format!("Failed to inspect JavaScript REPL session: {error}")),
        }
    }

    async fn respawn(&mut self) -> Result<(), String> {
        self.terminate().await;
        let (process, stdin, stdout, stderr_buffer, stderr_task, tmp_dir, created_at_ms) =
            spawn_core_js_repl_process(self.session_id.as_str(), self.workspace_path.as_path())
                .await?;
        self.session_id = new_id("js-repl-session");
        self.tmp_dir = tmp_dir;
        self.process = process;
        self.stdin = stdin;
        self.stdout = stdout;
        self.stderr_buffer = stderr_buffer;
        self.stderr_task = stderr_task;
        self.created_at_ms = created_at_ms;
        self.last_used_at_ms = created_at_ms;
        self.next_request_id = 0;
        Ok(())
    }

    async fn terminate(&mut self) {
        let _ = self.stdin.shutdown().await;
        let _ = self.process.kill().await;
        let _ = self.process.wait().await;
        self.stderr_task.abort();
        let _ = remove_dir_all_off_thread(self.tmp_dir.as_path()).await;
    }

    fn read_stderr_snapshot(&self) -> String {
        snapshot_core_js_repl_stderr(self.stderr_buffer.as_ref())
    }
}

async fn spawn_core_js_repl_process(
    workspace_id: &str,
    workspace_path: &Path,
) -> Result<
    (
        Child,
        ChildStdin,
        BufReader<ChildStdout>,
        Arc<std::sync::Mutex<Vec<u8>>>,
        tokio::task::JoinHandle<()>,
        PathBuf,
        u64,
    ),
    String,
> {
    let tmp_dir = create_core_js_repl_tmp_dir(workspace_id)?;
    let mut process = TokioCommand::new("node");
    process.args([
        "--input-type=module",
        "--eval",
        CORE_JS_REPL_CONTROLLER_SOURCE,
    ]);
    process
        .current_dir(workspace_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    let mut child = process
        .spawn()
        .map_err(|error| format!("Failed to run node for core-js-repl: {error}"))?;
    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| "Failed to capture stdin for core-js-repl.".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture stdout for core-js-repl.".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Failed to capture stderr for core-js-repl.".to_string())?;
    let stderr_buffer = Arc::new(std::sync::Mutex::new(Vec::new()));
    let stderr_task = spawn_core_js_repl_stderr_task(stderr, stderr_buffer.clone());

    Ok((
        child,
        stdin,
        BufReader::new(stdout),
        stderr_buffer,
        stderr_task,
        tmp_dir,
        now_ms(),
    ))
}

fn spawn_core_js_repl_stderr_task(
    mut stderr: ChildStderr,
    buffer: Arc<std::sync::Mutex<Vec<u8>>>,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let mut chunk = [0_u8; 4096];
        loop {
            let read = match stderr.read(&mut chunk).await {
                Ok(read) => read,
                Err(_) => return,
            };
            if read == 0 {
                return;
            }
            let mut guard = match buffer.lock() {
                Ok(guard) => guard,
                Err(poisoned) => poisoned.into_inner(),
            };
            let _ = append_bytes_with_limit(&mut guard, &chunk[..read], CORE_JS_REPL_PROTOCOL_OUTPUT_BYTES);
        }
    })
}

fn snapshot_core_js_repl_stderr(buffer: &std::sync::Mutex<Vec<u8>>) -> String {
    let bytes = match buffer.lock() {
        Ok(guard) => guard.clone(),
        Err(poisoned) => poisoned.into_inner().clone(),
    };
    truncate_shell_output(String::from_utf8_lossy(bytes.as_slice()).as_ref())
}

fn build_core_js_repl_message(
    status: &str,
    protocol_error: Option<&CoreJsReplProtocolError>,
) -> String {
    if status == "completed" {
        return "JavaScript completed in persistent session.".to_string();
    }
    if let Some(error) = protocol_error {
        return match error.name.as_deref() {
            Some(name) if !name.is_empty() => format!("{name}: {}", error.message),
            _ => error.message.clone(),
        };
    }
    "JavaScript failed in persistent session.".to_string()
}

fn format_core_js_repl_output(response: &CoreJsReplProtocolResponse) -> String {
    let mut sections = Vec::new();
    sections.extend(response.stdout.iter().map(|line| line.trim().to_string()).filter(|line| !line.is_empty()));
    sections.extend(response.stderr.iter().map(|line| line.trim().to_string()).filter(|line| !line.is_empty()));

    if response.ok {
        if let Some(value) = response.value.as_deref() {
            let trimmed = value.trim();
            if !trimmed.is_empty() && trimmed != "undefined" {
                sections.push(trimmed.to_string());
            }
        }
    } else if let Some(error) = response.error.as_ref() {
        let rendered = error.stack.as_deref().unwrap_or(error.message.as_str()).trim();
        if !rendered.is_empty() {
            sections.push(rendered.to_string());
        }
    }

    truncate_shell_output(sections.join("\n").as_str())
}
