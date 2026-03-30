use super::*;
use crate::runtime_tool_domain::{
    parse_runtime_tool_execution_scope, RuntimeToolExecutionChannelHealthStatus,
    RuntimeToolExecutionScope,
};
use ku0_runtime_shell_core::{TerminalSessionRecord, TerminalSessionState};

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct KernelSessionsListRequest {
    workspace_id: Option<String>,
    kind: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct KernelJobsListRequest {
    workspace_id: Option<String>,
    status: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct KernelExtensionsListRequest {
    workspace_id: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct KernelPoliciesEvaluateRequest {
    scope: Option<String>,
    tool_name: Option<String>,
    payload_bytes: Option<u64>,
    requires_approval: Option<bool>,
    workspace_id: Option<String>,
    mutation_kind: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct KernelContextSnapshotRequest {
    kind: String,
    workspace_id: Option<String>,
    thread_id: Option<String>,
    task_id: Option<String>,
    run_id: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
enum KernelContextSnapshotScope {
    Global,
    Workspace { workspace_id: String },
    Thread { workspace_id: String, thread_id: String },
    Task { task_id: String },
    Run { run_id: String },
    Skills { workspace_id: Option<String> },
}

fn parse_kernel_sessions_list_request(params: &Value) -> Result<KernelSessionsListRequest, RpcError> {
    let mut request: KernelSessionsListRequest = serde_json::from_value(params.clone())
        .map_err(|error| RpcError::invalid_params(format!("Invalid kernel sessions request: {error}")))?;
    request.workspace_id = trim_optional_string(request.workspace_id);
    request.kind = trim_optional_string(request.kind);
    Ok(request)
}

fn parse_kernel_jobs_list_request(params: &Value) -> Result<KernelJobsListRequest, RpcError> {
    let mut request: KernelJobsListRequest = serde_json::from_value(params.clone())
        .map_err(|error| RpcError::invalid_params(format!("Invalid kernel jobs request: {error}")))?;
    request.workspace_id = trim_optional_string(request.workspace_id);
    request.status = trim_optional_string(request.status);
    Ok(request)
}

fn parse_kernel_extensions_list_request(
    params: &Value,
) -> Result<KernelExtensionsListRequest, RpcError> {
    let mut request: KernelExtensionsListRequest = serde_json::from_value(params.clone())
        .map_err(|error| RpcError::invalid_params(format!("Invalid kernel extensions request: {error}")))?;
    request.workspace_id = trim_optional_string(request.workspace_id);
    Ok(request)
}

fn parse_kernel_policies_evaluate_request(
    params: &Value,
) -> Result<KernelPoliciesEvaluateRequest, RpcError> {
    let mut request: KernelPoliciesEvaluateRequest = serde_json::from_value(params.clone())
        .map_err(|error| RpcError::invalid_params(format!("Invalid kernel policies request: {error}")))?;
    request.scope = trim_optional_string(request.scope);
    request.tool_name = trim_optional_string(request.tool_name);
    request.workspace_id = trim_optional_string(request.workspace_id);
    request.mutation_kind = trim_optional_string(request.mutation_kind);
    Ok(request)
}

fn take_required_kernel_field(
    field_name: &'static str,
    value: Option<String>,
) -> Result<String, RpcError> {
    let value = trim_optional_string(value)
        .ok_or_else(|| RpcError::invalid_params(format!("{field_name} is required.")))?;
    Ok(value)
}

fn ensure_kernel_field_absent(
    value: &Option<String>,
    field_name: &'static str,
    kind: &str,
) -> Result<(), RpcError> {
    if trim_optional_string(value.clone()).is_some() {
        return Err(RpcError::invalid_params(format!(
            "{field_name} is not supported for kernel context kind `{kind}`."
        )));
    }
    Ok(())
}

fn parse_kernel_context_snapshot_scope(params: &Value) -> Result<KernelContextSnapshotScope, RpcError> {
    let mut request: KernelContextSnapshotRequest = serde_json::from_value(params.clone())
        .map_err(|error| RpcError::invalid_params(format!("Invalid kernel context snapshot request: {error}")))?;
    request.kind = request.kind.trim().to_string();
    if request.kind.is_empty() {
        return Err(RpcError::invalid_params("kind is required."));
    }
    request.workspace_id = trim_optional_string(request.workspace_id);
    request.thread_id = trim_optional_string(request.thread_id);
    request.task_id = trim_optional_string(request.task_id);
    request.run_id = trim_optional_string(request.run_id);

    match request.kind.as_str() {
        "global" => {
            ensure_kernel_field_absent(&request.workspace_id, "workspaceId", "global")?;
            ensure_kernel_field_absent(&request.thread_id, "threadId", "global")?;
            ensure_kernel_field_absent(&request.task_id, "taskId", "global")?;
            ensure_kernel_field_absent(&request.run_id, "runId", "global")?;
            Ok(KernelContextSnapshotScope::Global)
        }
        "workspace" => {
            ensure_kernel_field_absent(&request.thread_id, "threadId", "workspace")?;
            ensure_kernel_field_absent(&request.task_id, "taskId", "workspace")?;
            ensure_kernel_field_absent(&request.run_id, "runId", "workspace")?;
            Ok(KernelContextSnapshotScope::Workspace {
                workspace_id: take_required_kernel_field("workspaceId", request.workspace_id)?,
            })
        }
        "thread" => {
            ensure_kernel_field_absent(&request.task_id, "taskId", "thread")?;
            ensure_kernel_field_absent(&request.run_id, "runId", "thread")?;
            Ok(KernelContextSnapshotScope::Thread {
                workspace_id: take_required_kernel_field("workspaceId", request.workspace_id)?,
                thread_id: take_required_kernel_field("threadId", request.thread_id)?,
            })
        }
        "task" => {
            ensure_kernel_field_absent(&request.workspace_id, "workspaceId", "task")?;
            ensure_kernel_field_absent(&request.thread_id, "threadId", "task")?;
            ensure_kernel_field_absent(&request.run_id, "runId", "task")?;
            Ok(KernelContextSnapshotScope::Task {
                task_id: take_required_kernel_field("taskId", request.task_id)?,
            })
        }
        "run" => {
            ensure_kernel_field_absent(&request.workspace_id, "workspaceId", "run")?;
            ensure_kernel_field_absent(&request.thread_id, "threadId", "run")?;
            ensure_kernel_field_absent(&request.task_id, "taskId", "run")?;
            Ok(KernelContextSnapshotScope::Run {
                run_id: take_required_kernel_field("runId", request.run_id)?,
            })
        }
        "skills" => {
            ensure_kernel_field_absent(&request.thread_id, "threadId", "skills")?;
            ensure_kernel_field_absent(&request.task_id, "taskId", "skills")?;
            ensure_kernel_field_absent(&request.run_id, "runId", "skills")?;
            Ok(KernelContextSnapshotScope::Skills {
                workspace_id: request.workspace_id,
            })
        }
        other => Err(RpcError::invalid_params(format!(
            "Unsupported kernel context scope kind: {other}"
        ))),
    }
}

fn kernel_health_label(healthy: bool) -> &'static str {
    if healthy { "ready" } else { "attention" }
}

fn kernel_host_capability_payload(host_id: &str) -> Value {
    let is_wasi = host_id == "wasi";
    json!({
        "id": format!("host:{host_id}"),
        "name": if is_wasi { "WASI host binder" } else { "RPC host binder" },
        "kind": "host",
        "enabled": false,
        "health": "blocked",
        "executionProfile": kernel_execution_profile_payload("local", "background", "host", "restricted", "service"),
        "tags": if is_wasi { vec!["component-model", "wit", "host"] } else { vec!["rpc", "host"] },
        "metadata": {
            "pluginSource": if is_wasi { "wasi_host" } else { "rpc_host" },
            "bindingState": "unbound",
            "contractFormat": if is_wasi { "wit" } else { "rpc" },
            "contractBoundary": if is_wasi { "world-imports" } else { "remote-procedure-calls" },
            "interfaceId": if is_wasi { "wasi:*/*" } else { "runtime.plugin.host" },
            "worldId": if is_wasi {
                json!("hugecode:runtime/plugin-host")
            } else {
                Value::Null
            },
            "contractSurfaces": if is_wasi {
                json!([
                    {
                        "id": "hugecode:runtime/plugin-host",
                        "kind": "world",
                        "direction": "import",
                        "summary": "Reserved component-model world that the runtime host binder is expected to satisfy."
                    },
                    {
                        "id": "wasi:*/*",
                        "kind": "interface",
                        "direction": "import",
                        "summary": "Semver-qualified WIT interface imports published by the runtime host binder."
                    }
                ])
            } else {
                json!([
                    {
                        "id": "runtime.plugin.host",
                        "kind": "procedure_set",
                        "direction": "import",
                        "summary": "RPC procedure surface reserved for a runtime-managed plugin host binder."
                    }
                ])
            },
            "summary": if is_wasi {
                "Runtime-published component-model host slot reserved for future WIT/world bindings."
            } else {
                "Runtime-published remote host slot reserved for future RPC-backed plugin bindings."
            },
            "reason": "Runtime host binder is not currently connected.",
            "hostManaged": true,
            "semverQualifiedImports": is_wasi,
            "canonicalAbiResources": is_wasi,
        },
    })
}

fn kernel_execution_profile_payload(
    placement: &str,
    interactivity: &str,
    isolation: &str,
    network: &str,
    authority: &str,
) -> Value {
    json!({
        "placement": placement,
        "interactivity": interactivity,
        "isolation": isolation,
        "network": network,
        "authority": authority,
    })
}

fn kernel_terminal_execution_profile() -> Value {
    kernel_execution_profile_payload("local", "interactive", "host", "default", "user")
}

fn kernel_job_execution_profile(summary: &AgentTaskSummary) -> Value {
    let placement = if summary.backend_id.is_some() || summary.distributed_status.is_some() {
        "remote"
    } else {
        "local"
    };
    let interactivity = if summary.thread_id.is_some() {
        "interactive"
    } else {
        "background"
    };
    let isolation = if placement == "remote" {
        "container_sandbox"
    } else {
        "host"
    };
    let network = if summary.access_mode == "read-only" {
        "restricted"
    } else {
        "default"
    };
    let authority = if summary.backend_id.is_some() {
        "delegated"
    } else if summary.request_id.is_some() {
        "service"
    } else {
        "user"
    };
    kernel_execution_profile_payload(placement, interactivity, isolation, network, authority)
}

fn extract_takeover_field(bundle: Option<&Value>, field: &str) -> Option<Value> {
    bundle
        .and_then(Value::as_object)
        .and_then(|object| object.get(field))
        .cloned()
}

fn kernel_continuation_payload(runtime: &AgentTaskRuntime) -> Value {
    let summary = runtime
        .checkpoint_id
        .as_deref()
        .map(|checkpoint_id| format!("Checkpoint {checkpoint_id} is available for resume."))
        .or_else(|| {
            runtime
                .review_actionability
                .as_ref()
                .and_then(Value::as_object)
                .and_then(|object| object.get("summary"))
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
        })
        .or_else(|| {
            runtime
                .takeover_bundle
                .as_ref()
                .and_then(Value::as_object)
                .and_then(|object| object.get("summary"))
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
        });

    json!({
        "checkpointId": runtime.checkpoint_id,
        "resumeSupported": runtime.checkpoint_id.is_some() || runtime.recovered,
        "recovered": runtime.recovered,
        "reviewActionability": runtime.review_actionability,
        "takeover": runtime.takeover_bundle,
        "missionLinkage": extract_takeover_field(runtime.takeover_bundle.as_ref(), "missionLinkage"),
        "publishHandoff": extract_takeover_field(runtime.takeover_bundle.as_ref(), "publishHandoff"),
        "summary": summary,
    })
}

fn kernel_session_payload(session: &TerminalSessionRecord) -> Value {
    let state = match session.state {
        TerminalSessionState::Created => "created",
        TerminalSessionState::Exited => "exited",
        TerminalSessionState::IoFailed => "ioFailed",
        TerminalSessionState::Unsupported => "unsupported",
    };
    json!({
        "id": session.id,
        "kind": "pty",
        "workspaceId": session.workspace_id,
        "state": state,
        "createdAt": session.created_at,
        "updatedAt": session.updated_at,
        "executionProfile": kernel_terminal_execution_profile(),
        "lines": session.lines,
        "metadata": {
            "exitStatus": session.exit_status,
        },
    })
}

pub(super) fn kernel_job_payload(runtime: &AgentTaskRuntime) -> Value {
    json!({
        "id": runtime.summary.task_id,
        "workspaceId": runtime.summary.workspace_id,
        "threadId": runtime.summary.thread_id,
        "title": runtime.summary.title,
        "status": runtime.summary.status,
        "provider": runtime.summary.routed_provider.clone().or_else(|| runtime.summary.provider.clone()),
        "modelId": runtime.summary.routed_model_id.clone().or_else(|| runtime.summary.model_id.clone()),
        "backendId": runtime.summary.backend_id,
        "preferredBackendIds": runtime.summary.preferred_backend_ids,
        "executionProfile": kernel_job_execution_profile(&runtime.summary),
        "createdAt": runtime.summary.created_at,
        "updatedAt": runtime.summary.updated_at,
        "startedAt": runtime.summary.started_at,
        "completedAt": runtime.summary.completed_at,
        "continuation": kernel_continuation_payload(runtime),
        "metadata": {
            "agentProfile": runtime.summary.agent_profile,
            "accessMode": runtime.summary.access_mode,
            "currentStep": runtime.summary.current_step,
            "errorCode": runtime.summary.error_code,
            "errorMessage": runtime.summary.error_message,
        },
    })
}

fn extension_surfaces(config: &Value) -> Vec<String> {
    let mut surfaces = Vec::new();
    if config.get("tools").and_then(Value::as_array).is_some() {
        surfaces.push("tools".to_string());
    }
    if config.get("resources").and_then(Value::as_object).is_some() {
        surfaces.push("resources".to_string());
    }
    if config.get("hooks").and_then(Value::as_array).is_some() {
        surfaces.push("hooks".to_string());
    }
    if config.get("watchers").and_then(Value::as_array).is_some() {
        surfaces.push("watchers".to_string());
    }
    if surfaces.is_empty() {
        surfaces.push("tools".to_string());
    }
    surfaces
}

fn extension_tool_count(config: &Value) -> usize {
    config
        .get("tools")
        .and_then(Value::as_array)
        .map_or(1, Vec::len)
}

fn extension_resource_count(config: &Value) -> usize {
    config
        .get("resources")
        .and_then(Value::as_object)
        .map_or(0, serde_json::Map::len)
}

fn kernel_extension_bundle_payload(spec: &extensions_runtime::RuntimeExtensionSpecPayload) -> Value {
    let metadata = spec.config.as_object().cloned().map(Value::Object);
    json!({
        "id": spec.extension_id,
        "name": spec.name,
        "enabled": spec.enabled,
        "transport": spec.transport,
        "workspaceId": spec.workspace_id,
        "toolCount": extension_tool_count(&spec.config),
        "resourceCount": extension_resource_count(&spec.config),
        "surfaces": extension_surfaces(&spec.config),
        "installedAt": spec.installed_at,
        "updatedAt": spec.updated_at,
        "metadata": metadata,
    })
}

const KERNEL_PROJECTION_SCOPE_MISSION_CONTROL: &str = "mission_control";
const KERNEL_PROJECTION_SCOPE_JOBS: &str = "jobs";
const KERNEL_PROJECTION_SCOPE_SESSIONS: &str = "sessions";
const KERNEL_PROJECTION_SCOPE_CAPABILITIES: &str = "capabilities";
const KERNEL_PROJECTION_SCOPE_EXTENSIONS: &str = "extensions";
const KERNEL_PROJECTION_SCOPE_CONTINUITY: &str = "continuity";
const KERNEL_PROJECTION_SCOPE_DIAGNOSTICS: &str = "diagnostics";
const ALL_KERNEL_PROJECTION_SCOPES: &[&str] = &[
    KERNEL_PROJECTION_SCOPE_MISSION_CONTROL,
    KERNEL_PROJECTION_SCOPE_JOBS,
    KERNEL_PROJECTION_SCOPE_SESSIONS,
    KERNEL_PROJECTION_SCOPE_CAPABILITIES,
    KERNEL_PROJECTION_SCOPE_EXTENSIONS,
    KERNEL_PROJECTION_SCOPE_CONTINUITY,
    KERNEL_PROJECTION_SCOPE_DIAGNOSTICS,
];

fn kernel_projection_scope_cache_key(scope: &str) -> Result<RuntimeRevisionCacheKey, RpcError> {
    match scope {
        KERNEL_PROJECTION_SCOPE_MISSION_CONTROL => {
            Ok(RuntimeRevisionCacheKey::KernelProjectionMissionControlSlice)
        }
        KERNEL_PROJECTION_SCOPE_JOBS => Ok(RuntimeRevisionCacheKey::KernelProjectionJobsSlice),
        KERNEL_PROJECTION_SCOPE_SESSIONS => {
            Ok(RuntimeRevisionCacheKey::KernelProjectionSessionsSlice)
        }
        KERNEL_PROJECTION_SCOPE_CAPABILITIES => {
            Ok(RuntimeRevisionCacheKey::KernelProjectionCapabilitiesSlice)
        }
        KERNEL_PROJECTION_SCOPE_EXTENSIONS => {
            Ok(RuntimeRevisionCacheKey::KernelProjectionExtensionsSlice)
        }
        KERNEL_PROJECTION_SCOPE_CONTINUITY => {
            Ok(RuntimeRevisionCacheKey::KernelProjectionContinuitySlice)
        }
        KERNEL_PROJECTION_SCOPE_DIAGNOSTICS => {
            Ok(RuntimeRevisionCacheKey::KernelProjectionDiagnosticsSlice)
        }
        other => Err(RpcError::invalid_params(format!(
            "Unsupported kernel projection scope: {other}"
        ))),
    }
}

fn parse_kernel_projection_scopes(
    params: &serde_json::Map<String, Value>,
) -> Result<Vec<String>, RpcError> {
    let Some(scopes) = params.get("scopes") else {
        return Ok(
            ALL_KERNEL_PROJECTION_SCOPES
                .iter()
                .map(|scope| (*scope).to_string())
                .collect()
        );
    };
    let Some(scopes) = scopes.as_array() else {
        return Err(RpcError::invalid_params(
            "Kernel projection scopes must be an array of strings.",
        ));
    };
    let mut requested = Vec::with_capacity(scopes.len());
    for scope in scopes {
        let Some(scope) = scope.as_str().map(str::trim).filter(|scope| !scope.is_empty()) else {
            return Err(RpcError::invalid_params(
                "Kernel projection scopes must contain non-empty strings.",
            ));
        };
        let _ = kernel_projection_scope_cache_key(scope)?;
        if !requested.iter().any(|entry| entry == scope) {
            requested.push(scope.to_string());
        }
    }
    if requested.is_empty() {
        return Err(RpcError::invalid_params(
            "Kernel projection scopes must not be empty.",
        ));
    }
    Ok(requested)
}

fn json_value_present(value: Option<&Value>) -> bool {
    value.is_some_and(|value| !value.is_null())
}

fn build_kernel_continuity_slice_payload(mission_control: &Value) -> Value {
    let items = mission_control
        .get("runs")
        .and_then(Value::as_array)
        .into_iter()
        .flat_map(|runs| runs.iter())
        .filter_map(|run| {
            let task_id = run.get("taskId").and_then(Value::as_str)?;
            let run_id = run.get("id").and_then(Value::as_str)?;
            let checkpoint = run.get("checkpoint").cloned();
            let mission_linkage = run.get("missionLinkage").cloned();
            let review_actionability = run
                .get("reviewActionability")
                .cloned()
                .or_else(|| run.get("actionability").cloned());
            let publish_handoff = run.get("publishHandoff").cloned();
            let takeover_bundle = run.get("takeoverBundle").cloned();
            if !json_value_present(checkpoint.as_ref())
                && !json_value_present(mission_linkage.as_ref())
                && !json_value_present(review_actionability.as_ref())
                && !json_value_present(publish_handoff.as_ref())
                && !json_value_present(takeover_bundle.as_ref())
            {
                return None;
            }
            Some(json!({
                "taskId": task_id,
                "runId": run_id,
                "checkpoint": checkpoint,
                "missionLinkage": mission_linkage,
                "reviewActionability": review_actionability,
                "publishHandoff": publish_handoff,
                "takeoverBundle": takeover_bundle,
            }))
        })
        .collect::<Vec<_>>();
    let recoverable_run_count = items
        .iter()
        .filter(|item| json_value_present(item.get("checkpoint")))
        .count();
    let review_blocked_count = items
        .iter()
        .filter(|item| {
            item.get("reviewActionability")
                .and_then(Value::as_object)
                .and_then(|record| record.get("state"))
                .and_then(Value::as_str)
                .is_some_and(|state| state == "blocked")
        })
        .count();

    json!({
        "summary": {
            "recoverableRunCount": recoverable_run_count,
            "reviewBlockedCount": review_blocked_count,
            "itemCount": items.len(),
        },
        "items": items,
    })
}

async fn build_kernel_diagnostics_slice_payload(ctx: &AppContext) -> Value {
    let runtime_diagnostics = ctx.runtime_diagnostics.snapshot();
    let tool_metrics = ctx.runtime_tool_metrics.lock().await.read_snapshot();
    let tool_guardrails = ctx.runtime_tool_guardrails.lock().await.read_snapshot();
    json!({
        "revision": ctx.runtime_update_revision.load(Ordering::Relaxed),
        "latestEvent": latest_state_fabric_event_payload(ctx),
        "runtime": runtime_diagnostics,
        "toolMetrics": tool_metrics,
        "toolGuardrails": tool_guardrails,
    })
}

async fn build_kernel_capabilities_slice_payload(ctx: &AppContext) -> Value {
    let mut capabilities = vec![json!({
        "id": "terminal:pty",
        "name": "PTY Sessions",
        "kind": "terminal",
        "enabled": true,
        "health": "ready",
        "executionProfile": kernel_terminal_execution_profile(),
        "tags": ["pty", "local"],
        "metadata": {
            "activeSessions": ctx.terminal_sessions.read().await.len(),
        },
    })];

    let runtime_backends = ctx.runtime_backends.read().await;
    let mut backends = runtime_backends.values().cloned().collect::<Vec<_>>();
    backends.sort_by(|left, right| left.backend_id.cmp(&right.backend_id));
    for backend in backends {
        capabilities.push(json!({
            "id": format!("backend:{}", backend.backend_id),
            "name": backend.display_name,
            "kind": "backend",
            "enabled": backend.status != "disabled",
            "health": kernel_health_label(backend.healthy),
            "executionProfile": kernel_execution_profile_payload("remote", "background", "container_sandbox", "default", "delegated"),
            "tags": backend.capabilities,
            "metadata": {
                "backendId": backend.backend_id,
                "backendKind": backend.backend_kind,
                "transport": backend.transport,
                "origin": backend.origin,
                "rolloutState": backend.rollout_state,
                "status": backend.status,
                "healthy": backend.healthy,
            },
        }));
    }
    drop(runtime_backends);

    let extensions = super::extensions_dispatch::list_extension_catalog(ctx, None, true)
        .await
        .unwrap_or_default();
    for spec in extensions {
        capabilities.push(json!({
            "id": format!("extension:{}", spec.extension_id),
            "name": spec.name,
            "kind": "extension",
            "enabled": spec.enabled,
            "health": if spec.enabled { "ready" } else { "attention" },
            "executionProfile": kernel_execution_profile_payload("local", "background", "host", "default", "service"),
            "tags": extension_surfaces(&spec.config),
            "metadata": {
                "workspaceId": spec.workspace_id,
                "transport": spec.transport,
                "toolCount": extension_tool_count(&spec.config),
                "resourceCount": extension_resource_count(&spec.config),
            },
        }));
    }

    let guardrails = ctx.runtime_tool_guardrails.lock().await.read_snapshot();
    capabilities.push(json!({
        "id": "policy:runtime",
        "name": "Runtime Policy",
        "kind": "policy",
        "enabled": true,
        "health": match guardrails.channel_health.status {
            RuntimeToolExecutionChannelHealthStatus::Healthy => "ready",
            RuntimeToolExecutionChannelHealthStatus::Degraded => "attention",
            RuntimeToolExecutionChannelHealthStatus::Unavailable => "blocked",
        },
        "executionProfile": kernel_execution_profile_payload("local", "background", "host", "restricted", "service"),
        "tags": ["guardrails", "metrics", "approvals"],
        "metadata": {
            "channelHealth": guardrails.channel_health,
            "circuitBreakers": guardrails.circuit_breakers,
            "updatedAt": guardrails.updated_at,
        },
    }));

    let skills = crate::live_skills::list_live_skills(&ctx.config);
    capabilities.push(json!({
        "id": "skills:live",
        "name": "Live Skills",
        "kind": "skill",
        "enabled": true,
        "health": "ready",
        "executionProfile": kernel_execution_profile_payload("local", "interactive", "host", if ctx.config.live_skills_network_enabled { "default" } else { "restricted" }, "service"),
        "tags": ["live-skills"],
        "metadata": {
            "skillCount": skills.len(),
            "networkEnabled": ctx.config.live_skills_network_enabled,
        },
    }));
    capabilities.push(kernel_host_capability_payload("rpc"));
    capabilities.push(kernel_host_capability_payload("wasi"));

    let revision = ctx.runtime_update_revision.load(Ordering::Relaxed);
    capabilities.push(json!({
        "id": "context:state-fabric",
        "name": "Runtime State Fabric",
        "kind": "context",
        "enabled": true,
        "health": "ready",
        "executionProfile": kernel_execution_profile_payload("local", "background", "host", "default", "service"),
        "tags": ["state-fabric", "replay"],
        "metadata": {
            "revision": revision,
            "latestEvent": latest_state_fabric_event_payload(ctx),
        },
    }));

    capabilities.sort_by(|left, right| {
        left.get("id")
            .and_then(Value::as_str)
            .cmp(&right.get("id").and_then(Value::as_str))
    });

    Value::Array(capabilities)
}

async fn build_kernel_sessions_slice_payload(ctx: &AppContext, workspace_id: Option<&str>) -> Value {
    let sessions = ctx.terminal_sessions.read().await;
    let mut items = sessions
        .values()
        .filter(|session| {
            workspace_id.is_none_or(|workspace_id| session.workspace_id == workspace_id)
        })
        .map(kernel_session_payload)
        .collect::<Vec<_>>();
    items.sort_by(|left, right| {
        left.get("id")
            .and_then(Value::as_str)
            .cmp(&right.get("id").and_then(Value::as_str))
    });
    Value::Array(items)
}

async fn build_kernel_jobs_slice_payload(
    ctx: &AppContext,
    workspace_id: Option<&str>,
    status: Option<&str>,
) -> Value {
    let tasks = ctx.agent_tasks.read().await;
    let mut items = tasks
        .tasks
        .values()
        .filter(|runtime| {
            workspace_id.is_none_or(|workspace_id| runtime.summary.workspace_id == workspace_id)
                && status.is_none_or(|status| runtime.summary.status == status)
        })
        .map(kernel_job_payload)
        .collect::<Vec<_>>();
    items.sort_by(|left, right| {
        left.get("id")
            .and_then(Value::as_str)
            .cmp(&right.get("id").and_then(Value::as_str))
    });
    Value::Array(items)
}

async fn build_kernel_extensions_slice_payload(
    ctx: &AppContext,
    workspace_id: Option<&str>,
) -> Value {
    let mut bundles = super::extensions_dispatch::list_extension_catalog(ctx, workspace_id, true)
        .await
        .unwrap_or_default()
        .iter()
        .map(kernel_extension_bundle_payload)
        .collect::<Vec<_>>();
    bundles.sort_by(|left, right| {
        left.get("id")
            .and_then(Value::as_str)
            .cmp(&right.get("id").and_then(Value::as_str))
    });
    Value::Array(bundles)
}

async fn build_kernel_projection_slice_payload(
    ctx: &AppContext,
    scope: &str,
) -> Result<Value, RpcError> {
    let revision = ctx.runtime_update_revision.load(Ordering::Relaxed);
    let cache_key = kernel_projection_scope_cache_key(scope)?;
    if let Some(cached) = crate::read_runtime_revision_cached_json_value(ctx, &cache_key, revision) {
        return Ok(cached);
    }

    let payload = match scope {
        KERNEL_PROJECTION_SCOPE_MISSION_CONTROL => handle_mission_control_snapshot_v1(ctx, &json!({})).await?,
        KERNEL_PROJECTION_SCOPE_JOBS => build_kernel_jobs_slice_payload(ctx, None, None).await,
        KERNEL_PROJECTION_SCOPE_SESSIONS => build_kernel_sessions_slice_payload(ctx, None).await,
        KERNEL_PROJECTION_SCOPE_CAPABILITIES => build_kernel_capabilities_slice_payload(ctx).await,
        KERNEL_PROJECTION_SCOPE_EXTENSIONS => build_kernel_extensions_slice_payload(ctx, None).await,
        KERNEL_PROJECTION_SCOPE_CONTINUITY => {
            let mission_control = handle_mission_control_snapshot_v1(ctx, &json!({})).await?;
            build_kernel_continuity_slice_payload(&mission_control)
        }
        KERNEL_PROJECTION_SCOPE_DIAGNOSTICS => build_kernel_diagnostics_slice_payload(ctx).await,
        other => {
            return Err(RpcError::invalid_params(format!(
                "Unsupported kernel projection scope: {other}"
            )))
        }
    };

    crate::store_runtime_revision_cached_json_value(ctx, cache_key, revision, &payload);
    Ok(payload)
}

pub(crate) async fn build_kernel_projection_delta_v3(
    ctx: &AppContext,
    scopes: &[String],
    previous_revision: u64,
    resync_reason: Option<&str>,
) -> Result<Option<Value>, RpcError> {
    let revision = ctx.runtime_update_revision.load(Ordering::Relaxed);
    if revision == previous_revision && resync_reason.is_none() {
        return Ok(None);
    }

    let mut ops = Vec::with_capacity(scopes.len());
    for scope in scopes {
        if let Some(reason) = resync_reason {
            ops.push(json!({
                "type": "resync_required",
                "scope": scope,
                "reason": reason,
                "revision": revision,
            }));
            continue;
        }

        let payload = build_kernel_projection_slice_payload(ctx, scope.as_str()).await?;
        ops.push(json!({
            "type": "replace",
            "scope": scope,
            "value": payload,
            "revision": revision,
        }));
    }

    Ok(Some(json!({
        "revision": revision,
        "scopes": scopes,
        "ops": ops,
    })))
}

fn latest_state_fabric_event_payload(ctx: &AppContext) -> Option<Value> {
    let frame = crate::latest_runtime_state_fabric_event_frame(ctx)?;
    let payload = serde_json::from_str::<Value>(frame.payload_json.as_ref()).ok()?;
    Some(json!({
        "eventId": frame.id,
        "payload": payload,
    }))
}

async fn build_kernel_context_snapshot_payload(
    ctx: &AppContext,
    scope: KernelContextSnapshotScope,
) -> Result<Value, RpcError> {
    let revision = ctx.runtime_update_revision.load(Ordering::Relaxed);
    let latest_event = latest_state_fabric_event_payload(ctx);
    let state = ctx.state.read().await;
    let terminal_sessions = ctx.terminal_sessions.read().await;
    let agent_tasks = ctx.agent_tasks.read().await;
    let runtime_backends = ctx.runtime_backends.read().await;
    let extension_catalog = super::extensions_dispatch::list_extension_catalog(ctx, None, true)
        .await
        .unwrap_or_default();

    let (scope, snapshot) = match scope {
        KernelContextSnapshotScope::Global => (
            json!({ "kind": "global" }),
            json!({
                "workspaceCount": state.workspaces.len(),
                "threadCount": state.workspace_threads.values().map(Vec::len).sum::<usize>(),
                "terminalSessionCount": terminal_sessions.len(),
                "jobCount": agent_tasks.tasks.len(),
                "backendCount": runtime_backends.len(),
                "extensionCount": extension_catalog.len(),
            }),
        ),
        KernelContextSnapshotScope::Workspace { workspace_id } => {
            let workspace_threads = state
                .workspace_threads
                .get(workspace_id.as_str())
                .cloned()
                .unwrap_or_default();
            let sessions = terminal_sessions
                .values()
                .filter(|session| session.workspace_id == workspace_id)
                .map(|session| session.id.clone())
                .collect::<Vec<_>>();
            let tasks = agent_tasks
                .tasks
                .values()
                .filter(|runtime| runtime.summary.workspace_id == workspace_id)
                .map(|runtime| runtime.summary.task_id.clone())
                .collect::<Vec<_>>();
            (
                json!({ "kind": "workspace", "workspaceId": workspace_id }),
                json!({
                    "threadIds": workspace_threads.iter().map(|thread| thread.id.clone()).collect::<Vec<_>>(),
                    "terminalSessionIds": sessions,
                    "jobIds": tasks,
                    "extensionIds": extension_catalog
                        .iter()
                        .filter(|spec| spec.workspace_id.as_deref() == Some(workspace_id.as_str()))
                        .cloned()
                        .into_iter()
                        .map(|spec| spec.extension_id)
                        .collect::<Vec<_>>(),
                }),
            )
        }
        KernelContextSnapshotScope::Thread {
            workspace_id,
            thread_id,
        } => {
            let thread = state
                .workspace_threads
                .get(workspace_id.as_str())
                .and_then(|threads| threads.iter().find(|thread| thread.id == thread_id))
                .cloned();
            (
                json!({
                    "kind": "thread",
                    "workspaceId": workspace_id,
                    "threadId": thread_id,
                }),
                json!({
                    "thread": thread,
                    "jobIds": agent_tasks
                        .tasks
                        .values()
                        .filter(|runtime| runtime.summary.thread_id.as_deref() == Some(thread_id.as_str()))
                        .map(|runtime| runtime.summary.task_id.clone())
                        .collect::<Vec<_>>(),
                }),
            )
        }
        KernelContextSnapshotScope::Task { task_id } => {
            let task = agent_tasks.tasks.get(task_id.as_str()).map(kernel_job_payload);
            (json!({ "kind": "task", "taskId": task_id }), json!({ "task": task }))
        }
        KernelContextSnapshotScope::Run { run_id } => {
            let task = agent_tasks.tasks.get(run_id.as_str()).map(kernel_job_payload);
            (json!({ "kind": "run", "runId": run_id }), json!({ "run": task }))
        }
        KernelContextSnapshotScope::Skills { workspace_id } => {
            let skills = crate::live_skills::list_live_skills(&ctx.config);
            (
                json!({ "kind": "skills", "workspaceId": workspace_id }),
                json!({
                    "workspaceId": workspace_id,
                    "skillCount": skills.len(),
                    "skillIds": skills
                        .into_iter()
                        .filter_map(|skill| serde_json::to_value(skill).ok())
                        .filter_map(|value| {
                            value
                                .get("id")
                                .and_then(Value::as_str)
                                .map(ToOwned::to_owned)
                        })
                        .collect::<Vec<_>>(),
                    "networkEnabled": ctx.config.live_skills_network_enabled,
                }),
            )
        }
    };

    Ok(json!({
        "scope": scope,
        "revision": revision,
        "snapshot": snapshot,
        "latestEvent": latest_event,
        "sources": ["runtime_state", "terminal_sessions", "agent_tasks", "runtime_backends", "extensions_store"],
    }))
}

pub(super) async fn handle_kernel_capabilities_list_v2(
    ctx: &AppContext,
) -> Result<Value, RpcError> {
    build_kernel_projection_slice_payload(ctx, KERNEL_PROJECTION_SCOPE_CAPABILITIES).await
}

pub(super) async fn handle_kernel_sessions_list_v2(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let request = parse_kernel_sessions_list_request(params)?;
    let workspace_id = request.workspace_id;
    let kind = request.kind.unwrap_or_else(|| "pty".to_string());
    if kind != "pty" {
        return Err(RpcError::invalid_params(format!(
            "Unsupported kernel session kind: {kind}"
        )));
    }
    if workspace_id.is_none() {
        return build_kernel_projection_slice_payload(ctx, KERNEL_PROJECTION_SCOPE_SESSIONS).await;
    }
    Ok(build_kernel_sessions_slice_payload(ctx, workspace_id.as_deref()).await)
}

pub(super) async fn handle_kernel_jobs_list_v2(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let request = parse_kernel_jobs_list_request(params)?;
    let workspace_id = request.workspace_id;
    let status = request.status;
    if workspace_id.is_none() && status.is_none() {
        return build_kernel_projection_slice_payload(ctx, KERNEL_PROJECTION_SCOPE_JOBS).await;
    }
    Ok(build_kernel_jobs_slice_payload(
        ctx,
        workspace_id.as_deref(),
        status.as_deref(),
    )
    .await)
}


pub(super) async fn handle_kernel_context_snapshot_v2(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let scope = parse_kernel_context_snapshot_scope(params)?;
    build_kernel_context_snapshot_payload(ctx, scope).await
}

pub(super) async fn handle_kernel_extensions_list_v2(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let request = parse_kernel_extensions_list_request(params)?;
    let workspace_id = request.workspace_id;
    if workspace_id.is_none() {
        return build_kernel_projection_slice_payload(ctx, KERNEL_PROJECTION_SCOPE_EXTENSIONS).await;
    }
    Ok(build_kernel_extensions_slice_payload(ctx, workspace_id.as_deref()).await)
}

pub(super) async fn handle_kernel_policies_evaluate_v2(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let request = parse_kernel_policies_evaluate_request(params)?;
    let scope = request
        .scope
        .map(|value| parse_runtime_tool_execution_scope(value.as_str()))
        .transpose()
        .map_err(RpcError::invalid_params)?
        .unwrap_or(RuntimeToolExecutionScope::Runtime);
    let tool_name = request
        .tool_name
        .unwrap_or_else(|| "kernel.policy".to_string());
    let payload_bytes = request.payload_bytes.unwrap_or(0);
    let requires_approval = request.requires_approval.unwrap_or(false);

    let mut guardrails = ctx.runtime_tool_guardrails.lock().await;
    let evaluation = guardrails
        .evaluate(&crate::runtime_tool_guardrails::RuntimeToolGuardrailEvaluateRequest {
            tool_name,
            scope,
            workspace_id: request.workspace_id,
            payload_bytes,
            at: Some(now_ms()),
            request_id: None,
            trace_id: None,
            span_id: None,
            parent_span_id: None,
            planner_step_key: None,
            attempt: None,
            capability_profile: crate::runtime_tool_guardrails::RuntimeToolGuardrailCapabilityProfile::Default,
        })
        .map_err(|error| RpcError::internal(format!("kernel policy evaluation failed: {error}")))?;
    drop(guardrails);

    let state = ctx.state.read().await;
    let policy_mode = state.runtime_policy_mode.clone();
    let policy_updated_at = state.runtime_policy_updated_at;
    drop(state);

    let (decision, reason) = if !evaluation.allowed {
        (
            "deny",
            evaluation
                .message
                .clone()
                .unwrap_or_else(|| "Runtime guardrail denied the request.".to_string()),
        )
    } else if requires_approval {
        (
            "ask",
            "Runtime policy requires an approval checkpoint for this action.".to_string(),
        )
    } else {
        ("allow", "Runtime policy allows the request.".to_string())
    };

    Ok(json!({
        "decision": decision,
        "reason": reason,
        "policyMode": policy_mode,
        "evaluatedAt": policy_updated_at.max(evaluation.updated_at),
        "channelHealth": evaluation.channel_health,
        "circuitBreaker": evaluation.circuit_breaker,
        "metadata": {
            "guardrail": evaluation,
            "requiresApproval": requires_approval,
            "mutationKind": request.mutation_kind,
        },
    }))
}

pub(super) async fn handle_kernel_projection_bootstrap_v3(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let scopes = parse_kernel_projection_scopes(params)?;
    let revision = ctx.runtime_update_revision.load(Ordering::Relaxed);
    let mut slice_revisions = serde_json::Map::new();
    let mut slices = serde_json::Map::new();

    for scope in &scopes {
        let payload = build_kernel_projection_slice_payload(ctx, scope.as_str()).await?;
        slice_revisions.insert(scope.clone(), json!(revision));
        slices.insert(scope.clone(), payload);
    }

    Ok(json!({
        "revision": revision,
        "sliceRevisions": slice_revisions,
        "slices": slices,
    }))
}

#[cfg(test)]
#[path = "rpc_dispatch_kernel_tests.rs"]
mod tests;
