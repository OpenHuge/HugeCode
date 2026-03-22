use super::runtime_backends_dispatch::build_runtime_routing_health_payload;
use super::*;
use crate::agent_tasks::{
    build_agent_task_runtime_response_payload, derive_agent_task_review_pack_id,
};
use crate::runtime_checkpoint::build_agent_task_checkpoint_state_payload;

const RUNTIME_DIAGNOSTICS_EXPORT_METHOD: &str = "code_runtime_diagnostics_export_v1";
const MAX_TASK_SUMMARIES: usize = 256;
const EVENT_TAIL_RECENT_KINDS_LIMIT: usize = 32;

fn diagnostics_export_not_enabled_error() -> RpcError {
    RpcError::method_not_found(RUNTIME_DIAGNOSTICS_EXPORT_METHOD)
}

fn ensure_runtime_diagnostics_export_enabled() -> Result<(), RpcError> {
    if diagnostics_export::runtime_diagnostics_export_enabled() {
        return Ok(());
    }
    Err(diagnostics_export_not_enabled_error())
}

fn serialize_section_payload<T: Serialize>(
    payload: T,
    section_path: &str,
) -> Result<Value, RpcError> {
    serde_json::to_value(payload).map_err(|error| {
        RpcError::internal(format!(
            "failed to serialize diagnostics export section `{section_path}`: {error}"
        ))
    })
}

fn build_contract_drift_guard_payload() -> Value {
    let capabilities = rpc_capabilities_payload();
    json!({
        "contractVersion": capabilities.get("contractVersion").cloned().unwrap_or(Value::Null),
        "methodSetHash": capabilities.get("methodSetHash").cloned().unwrap_or(Value::Null),
        "features": capabilities.get("features").cloned().unwrap_or_else(|| json!([])),
        "namespace": "code",
        "sourceOfTruth": "runtime-service",
        "summary": "Runtime diagnostics export captured the canonical RPC contract fingerprint used by this runtime.",
    })
}

fn task_matches_workspace(task: &AgentTaskRuntime, workspace_id: Option<&str>) -> bool {
    match workspace_id {
        Some(expected_workspace_id) => task.summary.workspace_id == expected_workspace_id,
        None => true,
    }
}

fn extract_event_kind(payload_json: &str) -> Option<String> {
    serde_json::from_str::<Value>(payload_json)
        .ok()
        .and_then(|value| value.as_object().cloned())
        .and_then(|event| event.get("kind").cloned())
        .and_then(|kind| kind.as_str().map(str::to_string))
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
struct RuntimeDiagnosticsTaskCollection {
    total: u64,
    queued: u64,
    running: u64,
    awaiting_approval: u64,
    terminal: u64,
    task_summaries: Vec<RuntimeDiagnosticsTaskSummaryPayload>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeDiagnosticsTaskSummaryPayload {
    task_id: String,
    workspace_id: String,
    status: String,
    current_step: Option<usize>,
    created_at: u64,
    updated_at: u64,
    started_at: Option<u64>,
    completed_at: Option<u64>,
    error_code: Option<String>,
    backend_id: Option<String>,
    distributed_status: Option<String>,
    step_count: usize,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeCheckpointEvidenceTaskPayload {
    task_id: String,
    workspace_id: String,
    status: String,
    review_pack_id: Option<String>,
    review_decision: Option<Value>,
    publish_handoff: Option<Value>,
    mission_linkage: Option<Value>,
    review_actionability: Option<Value>,
    takeover_bundle: Option<Value>,
    trace_id: Option<String>,
    checkpoint_id: Option<String>,
    checkpoint: Value,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeSubAgentSessionEvidencePayload {
    session_id: String,
    workspace_id: String,
    status: String,
    parent_run_id: Option<String>,
    active_task_id: Option<String>,
    last_task_id: Option<String>,
    checkpoint_id: Option<String>,
    trace_id: Option<String>,
    checkpoint_state: Option<Value>,
    approval_events: Option<Value>,
    compaction_summary: Option<Value>,
    takeover_bundle: Value,
}

fn collect_runtime_diagnostics_task_collection(
    store: &AgentTaskStore,
    workspace_id: Option<&str>,
    include_task_summaries: bool,
) -> RuntimeDiagnosticsTaskCollection {
    let mut collection = RuntimeDiagnosticsTaskCollection {
        total: store.tasks.len() as u64,
        ..RuntimeDiagnosticsTaskCollection::default()
    };
    for task in store.tasks.values() {
        let status = task.summary.status.as_str();
        match status {
            "queued" => collection.queued += 1,
            "running" => collection.running += 1,
            "awaiting_approval" => collection.awaiting_approval += 1,
            _ if is_agent_task_terminal_status(status) => collection.terminal += 1,
            _ => {}
        }

        if include_task_summaries
            && collection.task_summaries.len() < MAX_TASK_SUMMARIES
            && task_matches_workspace(task, workspace_id)
        {
            collection
                .task_summaries
                .push(RuntimeDiagnosticsTaskSummaryPayload {
                    task_id: task.summary.task_id.clone(),
                    workspace_id: task.summary.workspace_id.clone(),
                    status: task.summary.status.clone(),
                    current_step: task.summary.current_step,
                    created_at: task.summary.created_at,
                    updated_at: task.summary.updated_at,
                    started_at: task.summary.started_at,
                    completed_at: task.summary.completed_at,
                    error_code: task.summary.error_code.clone(),
                    backend_id: task.summary.backend_id.clone(),
                    distributed_status: task.summary.distributed_status.clone(),
                    step_count: task.summary.steps.len(),
                });
        }
    }
    collection
}

fn runtime_task_counters_from_collection(
    collection: &RuntimeDiagnosticsTaskCollection,
) -> crate::distributed_runtime::RuntimeTaskCounters {
    crate::distributed_runtime::RuntimeTaskCounters {
        total: collection.total,
        queued: collection.queued,
        running: collection.running,
        awaiting_approval: collection.awaiting_approval,
        terminal: collection.terminal,
    }
}

fn collect_runtime_checkpoint_evidence_payload(
    store: &AgentTaskStore,
    workspace_roots_by_id: &HashMap<String, String>,
    workspace_id: Option<&str>,
) -> Vec<RuntimeCheckpointEvidenceTaskPayload> {
    store
        .order
        .iter()
        .filter_map(|task_id| store.tasks.get(task_id.as_str()))
        .filter(|task| task_matches_workspace(task, workspace_id))
        .take(MAX_TASK_SUMMARIES)
        .map(|task| {
            let response_payload = build_agent_task_runtime_response_payload(
                task,
                None,
                workspace_roots_by_id
                    .get(task.summary.workspace_id.as_str())
                    .map(String::as_str),
            )
            .unwrap_or_else(|_| {
                json!({
                    "checkpointState": build_agent_task_checkpoint_state_payload(
                        &task.summary,
                        task.recovered,
                        task.checkpoint_id.as_deref(),
                    )
                })
            });
            let checkpoint = response_payload
                .get("checkpointState")
                .cloned()
                .unwrap_or_else(|| {
                    build_agent_task_checkpoint_state_payload(
                        &task.summary,
                        task.recovered,
                        task.checkpoint_id.as_deref(),
                    )
                });
            let review_pack_id = response_payload
                .get("reviewPackId")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
                .or_else(|| derive_agent_task_review_pack_id(&task.summary));
            RuntimeCheckpointEvidenceTaskPayload {
                task_id: task.summary.task_id.clone(),
                workspace_id: task.summary.workspace_id.clone(),
                status: task.summary.status.clone(),
                review_pack_id,
                review_decision: response_payload.get("reviewDecision").cloned(),
                publish_handoff: response_payload.get("publishHandoff").cloned(),
                mission_linkage: response_payload.get("missionLinkage").cloned(),
                review_actionability: response_payload.get("reviewActionability").cloned(),
                takeover_bundle: response_payload.get("takeoverBundle").cloned(),
                trace_id: checkpoint
                    .get("traceId")
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned),
                checkpoint_id: checkpoint
                    .get("checkpointId")
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned),
                checkpoint,
            }
        })
        .collect()
}

async fn collect_runtime_sub_agent_session_evidence_payload(
    ctx: &AppContext,
    workspace_id: Option<&str>,
) -> Vec<RuntimeSubAgentSessionEvidencePayload> {
    let sessions = ctx.sub_agent_sessions.read().await;
    sessions
        .order
        .iter()
        .filter_map(|session_id| sessions.sessions.get(session_id.as_str()))
        .filter(|runtime| {
            workspace_id
                .map(|expected| runtime.summary.workspace_id == expected)
                .unwrap_or(true)
        })
        .take(MAX_TASK_SUMMARIES)
        .map(|runtime| {
            let summary = &runtime.summary;
            RuntimeSubAgentSessionEvidencePayload {
                session_id: summary.session_id.clone(),
                workspace_id: summary.workspace_id.clone(),
                status: summary.status.clone(),
                parent_run_id: summary.parent_run_id.clone(),
                active_task_id: summary.active_task_id.clone(),
                last_task_id: summary.last_task_id.clone(),
                checkpoint_id: summary.checkpoint_id.clone(),
                trace_id: summary.trace_id.clone(),
                checkpoint_state: summary
                    .checkpoint_state
                    .as_ref()
                    .and_then(|value| serde_json::to_value(value).ok()),
                approval_events: summary
                    .approval_events
                    .as_ref()
                    .and_then(|value| serde_json::to_value(value).ok()),
                compaction_summary: summary.compaction_summary.clone(),
                takeover_bundle:
                    crate::rpc_dispatch::mission_control_dispatch::build_runtime_sub_agent_takeover_bundle(
                        summary,
                    ),
            }
        })
        .collect()
}

fn build_event_tail_summary(ctx: &AppContext) -> Value {
    let mut recovered_from_poison = false;
    let replay_buffer = match ctx.turn_event_replay_buffer.lock() {
        Ok(guard) => guard,
        Err(poisoned) => {
            recovered_from_poison = true;
            poisoned.into_inner()
        }
    };
    let oldest_event_id = replay_buffer.frames.front().map(|frame| frame.id);
    let replay_newest_event_id = replay_buffer.frames.back().map(|frame| frame.id);
    let recent_kinds = replay_buffer
        .frames
        .iter()
        .rev()
        .take(EVENT_TAIL_RECENT_KINDS_LIMIT)
        .filter_map(|frame| extract_event_kind(frame.payload_json.as_ref()))
        .collect::<Vec<_>>();
    let latest_state_fabric_frame = crate::latest_runtime_state_fabric_event_frame(ctx);
    let newest_event_id = match (replay_newest_event_id, latest_state_fabric_frame.as_ref()) {
        (Some(replay_newest_event_id), Some(frame)) => Some(replay_newest_event_id.max(frame.id)),
        (Some(replay_newest_event_id), None) => Some(replay_newest_event_id),
        (None, Some(frame)) => Some(frame.id),
        (None, None) => None,
    };
    let latest_state_fabric_event = latest_state_fabric_frame.and_then(|frame| {
            serde_json::from_str::<Value>(frame.payload_json.as_ref())
                .ok()
                .and_then(|value| {
                    value.get("payload").and_then(Value::as_object).map(|payload| {
                        json!({
                            "eventId": frame.id,
                            "revision": payload.get("revision").cloned().unwrap_or(Value::Null),
                            "reason": payload.get("reason").cloned().unwrap_or(Value::Null),
                        })
                    })
                })
        });

    json!({
        "framesTotal": replay_buffer.frames.len(),
        "totalPayloadBytes": replay_buffer.total_payload_bytes,
        "maxFrameBytes": replay_buffer.max_frame_bytes,
        "oldestEventId": oldest_event_id,
        "newestEventId": newest_event_id,
        "recentKinds": recent_kinds,
        "latestStateFabricEvent": latest_state_fabric_event,
        "lockRecoveredFromPoison": recovered_from_poison,
    })
}

async fn collect_runtime_checkpoint_evidence_payload_cached(
    ctx: &AppContext,
    workspace_id: Option<&str>,
) -> Result<Value, RpcError> {
    let revision = ctx
        .runtime_update_revision
        .load(std::sync::atomic::Ordering::Relaxed);
    let key = RuntimeRevisionCacheKey::RuntimeCheckpointReviewEvidence {
        workspace_id: workspace_id.map(str::to_string),
    };
    if let Some(cached_value) = crate::read_runtime_revision_cached_json_value(ctx, &key, revision)
    {
        return Ok(cached_value);
    }
    let workspace_roots_by_id = {
        let state = ctx.state.read().await;
        state
            .workspaces
            .iter()
            .map(|workspace| (workspace.id.clone(), workspace.path.clone()))
            .collect::<HashMap<_, _>>()
    };
    let store = ctx.agent_tasks.read().await;
    let payload = serialize_section_payload(
        collect_runtime_checkpoint_evidence_payload(&store, &workspace_roots_by_id, workspace_id),
        "runtime/checkpoint-review-evidence.json",
    )?;
    crate::store_runtime_revision_cached_json_value(ctx, key, revision, &payload);
    Ok(payload)
}

async fn collect_runtime_sub_agent_session_evidence_payload_cached(
    ctx: &AppContext,
    workspace_id: Option<&str>,
) -> Result<Value, RpcError> {
    let revision = ctx
        .runtime_update_revision
        .load(std::sync::atomic::Ordering::Relaxed);
    let key = RuntimeRevisionCacheKey::RuntimeSubAgentSessionEvidence {
        workspace_id: workspace_id.map(str::to_string),
    };
    if let Some(cached_value) = crate::read_runtime_revision_cached_json_value(ctx, &key, revision)
    {
        return Ok(cached_value);
    }
    let payload = serialize_section_payload(
        collect_runtime_sub_agent_session_evidence_payload(ctx, workspace_id).await,
        "runtime/sub-agent-session-evidence.json",
    )?;
    crate::store_runtime_revision_cached_json_value(ctx, key, revision, &payload);
    Ok(payload)
}

async fn build_runtime_diagnostics_snapshot_payload(
    ctx: &AppContext,
    workspace_id: Option<&str>,
    include_task_summaries: bool,
    include_event_tail: bool,
) -> Value {
    let task_collection = if include_task_summaries {
        let store = ctx.agent_tasks.read().await;
        Some(collect_runtime_diagnostics_task_collection(
            &store,
            workspace_id,
            true,
        ))
    } else {
        None
    };
    let observability = build_runtime_observability_snapshot(
        ctx,
        crate::distributed_runtime::RuntimeObservabilityScope::Full,
        task_collection
            .as_ref()
            .map(runtime_task_counters_from_collection)
            .map(crate::distributed_runtime::RuntimeTaskCounterMode::Provided)
            .unwrap_or(crate::distributed_runtime::RuntimeTaskCounterMode::Compute),
    )
    .await;
    let runtime_diagnostics = observability.runtime_diagnostics;

    let mut payload = serde_json::Map::new();
    payload.insert("snapshot".to_string(), json!(runtime_diagnostics));
    if let Some(workspace_id) = workspace_id {
        payload.insert(
            "workspaceId".to_string(),
            Value::String(workspace_id.to_string()),
        );
    }
    if let Some(task_collection) = task_collection {
        payload.insert(
            "taskSummaries".to_string(),
            json!(task_collection.task_summaries),
        );
    }
    if include_event_tail {
        payload.insert("eventTail".to_string(), build_event_tail_summary(ctx));
    }
    Value::Object(payload)
}

pub(super) async fn handle_runtime_diagnostics_export_v1(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    ensure_runtime_diagnostics_export_enabled()?;
    let params = as_object(params)?;
    let workspace_id = read_optional_string(params, "workspaceId")
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let redaction_level = diagnostics_export::parse_runtime_diagnostics_redaction_level(
        read_optional_string(params, "redactionLevel").as_deref(),
    )?;
    let include_task_summaries =
        read_optional_bool(params, "includeTaskSummaries").unwrap_or(false);
    let include_event_tail = read_optional_bool(params, "includeEventTail").unwrap_or(true);
    let include_zip_base64 = read_optional_bool(params, "includeZipBase64").unwrap_or(true);

    let mut warnings = Vec::new();
    if let Some(workspace_id) = workspace_id.as_deref() {
        let state = ctx.state.read().await;
        if !state
            .workspaces
            .iter()
            .any(|workspace| workspace.id == workspace_id)
        {
            warnings.push(format!(
                "workspace `{workspace_id}` does not exist in runtime state; export is generated from global runtime metadata."
            ));
        }
    }

    let capabilities_payload = rpc_capabilities_payload();
    let health_payload = health_response_payload();
    let settings_payload = settings_summary_payload();
    let runtime_diagnostics_payload = build_runtime_diagnostics_snapshot_payload(
        ctx,
        workspace_id.as_deref(),
        include_task_summaries,
        include_event_tail,
    )
    .await;
    let tool_metrics_payload = {
        let runtime_tool_metrics = ctx.runtime_tool_metrics.lock().await;
        serialize_section_payload(
            runtime_tool_metrics.read_snapshot(),
            "runtime/tool-metrics.json",
        )?
    };
    let tool_guardrails_payload = {
        let runtime_tool_guardrails = ctx.runtime_tool_guardrails.lock().await;
        serialize_section_payload(
            runtime_tool_guardrails.read_snapshot(),
            "runtime/tool-guardrails.json",
        )?
    };
    let routing_health_payload = serialize_section_payload(
        build_runtime_routing_health_payload(ctx).await,
        "runtime/routing-health.json",
    )?;
    let checkpoint_review_evidence_payload =
        collect_runtime_checkpoint_evidence_payload_cached(ctx, workspace_id.as_deref()).await?;
    let sub_agent_session_evidence_payload =
        collect_runtime_sub_agent_session_evidence_payload_cached(ctx, workspace_id.as_deref())
            .await?;
    let contract_drift_guard_payload = serialize_section_payload(
        build_contract_drift_guard_payload(),
        "runtime/contract-drift-guard.json",
    )?;

    let mut sections = vec![
        diagnostics_export::RuntimeDiagnosticsSection {
            path: "runtime/capabilities.json".to_string(),
            payload: capabilities_payload,
        },
        diagnostics_export::RuntimeDiagnosticsSection {
            path: "runtime/health.json".to_string(),
            payload: health_payload,
        },
        diagnostics_export::RuntimeDiagnosticsSection {
            path: "runtime/settings-summary.json".to_string(),
            payload: settings_payload,
        },
        diagnostics_export::RuntimeDiagnosticsSection {
            path: "runtime/runtime-diagnostics.json".to_string(),
            payload: runtime_diagnostics_payload,
        },
        diagnostics_export::RuntimeDiagnosticsSection {
            path: "runtime/tool-metrics.json".to_string(),
            payload: tool_metrics_payload,
        },
        diagnostics_export::RuntimeDiagnosticsSection {
            path: "runtime/tool-guardrails.json".to_string(),
            payload: tool_guardrails_payload,
        },
        diagnostics_export::RuntimeDiagnosticsSection {
            path: "runtime/routing-health.json".to_string(),
            payload: routing_health_payload,
        },
        diagnostics_export::RuntimeDiagnosticsSection {
            path: "runtime/checkpoint-review-evidence.json".to_string(),
            payload: checkpoint_review_evidence_payload,
        },
        diagnostics_export::RuntimeDiagnosticsSection {
            path: "runtime/sub-agent-session-evidence.json".to_string(),
            payload: sub_agent_session_evidence_payload,
        },
        diagnostics_export::RuntimeDiagnosticsSection {
            path: "runtime/contract-drift-guard.json".to_string(),
            payload: contract_drift_guard_payload,
        },
    ];

    if ctx.distributed_config.enabled {
        sections.push(diagnostics_export::RuntimeDiagnosticsSection {
            path: "runtime/distributed-readiness.json".to_string(),
            payload: serialize_section_payload(
                build_cached_distributed_readiness_snapshot(ctx).await,
                "runtime/distributed-readiness.json",
            )?,
        });
    } else {
        warnings.push(
            "Skipped `runtime/distributed-readiness.json` because distributed runtime is disabled."
                .to_string(),
        );
    }

    let exported_at = now_ms();
    let build_input = diagnostics_export::RuntimeDiagnosticsExportBuildInput {
        exported_at,
        source: "runtime-service",
        redaction_level,
        sections,
        warnings,
        include_zip_base64,
    };
    let build_output = tokio::task::spawn_blocking(move || {
        diagnostics_export::build_runtime_diagnostics_export(build_input)
    })
    .await
    .map_err(|error| {
        RpcError::internal(format!(
            "failed to join diagnostics export build task: {error}"
        ))
    })??;

    Ok(json!({
        "schemaVersion": diagnostics_export::RUNTIME_DIAGNOSTICS_EXPORT_SCHEMA_VERSION,
        "exportedAt": exported_at,
        "source": "runtime-service",
        "redactionLevel": redaction_level.as_str(),
        "filename": build_output.filename,
        "mimeType": "application/zip",
        "sizeBytes": build_output.size_bytes,
        "zipBase64": build_output.zip_base64,
        "sections": build_output.sections,
        "warnings": build_output.warnings,
        "redactionStats": build_output.redaction_stats,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    use crate::{
        build_app_context, create_initial_state, native_state_store, publish_runtime_updated_event,
        ServiceConfig, DEFAULT_AGENT_MAX_CONCURRENT_TASKS, DEFAULT_AGENT_TASK_HISTORY_LIMIT,
        DEFAULT_ANTHROPIC_ENDPOINT, DEFAULT_ANTHROPIC_VERSION,
        DEFAULT_DISCOVERY_BROWSE_INTERVAL_MS, DEFAULT_DISCOVERY_SERVICE_TYPE,
        DEFAULT_DISCOVERY_STALE_TTL_MS, DEFAULT_GEMINI_ENDPOINT, DEFAULT_LIVE_SKILLS_NETWORK_BASE_URL,
        DEFAULT_LIVE_SKILLS_NETWORK_CACHE_TTL_MS, DEFAULT_LIVE_SKILLS_NETWORK_TIMEOUT_MS,
        DEFAULT_OAUTH_LOOPBACK_CALLBACK_PORT, DEFAULT_OPENAI_COMPAT_MODEL_CACHE_TTL_MS,
        DEFAULT_OPENAI_MAX_RETRIES, DEFAULT_OPENAI_RETRY_BASE_MS, DEFAULT_OPENAI_TIMEOUT_MS,
        DEFAULT_RUNTIME_WS_MAX_CONNECTIONS, DEFAULT_RUNTIME_WS_MAX_FRAME_SIZE_BYTES,
        DEFAULT_RUNTIME_WS_MAX_MESSAGE_SIZE_BYTES, DEFAULT_RUNTIME_WS_MAX_WRITE_BUFFER_SIZE_BYTES,
        DEFAULT_RUNTIME_WS_WRITE_BUFFER_SIZE_BYTES, DEFAULT_SANDBOX_NETWORK_ACCESS,
    };
    use tokio::sync::Notify;

    fn diagnostics_export_test_config() -> ServiceConfig {
        ServiceConfig {
            default_model_id: "gpt-5.4".to_string(),
            openai_api_key: Some("test-openai-key".to_string()),
            openai_endpoint: "https://api.openai.com/v1/responses".to_string(),
            openai_compat_base_url: None,
            openai_compat_api_key: None,
            anthropic_api_key: None,
            anthropic_endpoint: DEFAULT_ANTHROPIC_ENDPOINT.to_string(),
            anthropic_version: DEFAULT_ANTHROPIC_VERSION.to_string(),
            gemini_api_key: None,
            gemini_endpoint: DEFAULT_GEMINI_ENDPOINT.to_string(),
            openai_timeout_ms: DEFAULT_OPENAI_TIMEOUT_MS,
            openai_max_retries: DEFAULT_OPENAI_MAX_RETRIES,
            openai_retry_base_ms: DEFAULT_OPENAI_RETRY_BASE_MS,
            openai_compat_model_cache_ttl_ms: DEFAULT_OPENAI_COMPAT_MODEL_CACHE_TTL_MS,
            live_skills_network_enabled: false,
            live_skills_network_base_url: DEFAULT_LIVE_SKILLS_NETWORK_BASE_URL.to_string(),
            live_skills_network_timeout_ms: DEFAULT_LIVE_SKILLS_NETWORK_TIMEOUT_MS,
            live_skills_network_cache_ttl_ms: DEFAULT_LIVE_SKILLS_NETWORK_CACHE_TTL_MS,
            sandbox_enabled: false,
            sandbox_network_access: DEFAULT_SANDBOX_NETWORK_ACCESS.to_string(),
            sandbox_allowed_hosts: Vec::new(),
            oauth_pool_db_path: ":memory:".to_string(),
            oauth_secret_key: None,
            oauth_public_base_url: None,
            oauth_loopback_callback_port: DEFAULT_OAUTH_LOOPBACK_CALLBACK_PORT,
            runtime_auth_token: None,
            agent_max_concurrent_tasks: DEFAULT_AGENT_MAX_CONCURRENT_TASKS,
            agent_task_history_limit: DEFAULT_AGENT_TASK_HISTORY_LIMIT,
            distributed_enabled: false,
            distributed_redis_url: None,
            distributed_lane_count: 1,
            distributed_worker_concurrency: 1,
            distributed_claim_idle_ms: 500,
            discovery_enabled: false,
            discovery_service_type: DEFAULT_DISCOVERY_SERVICE_TYPE.to_string(),
            discovery_browse_interval_ms: DEFAULT_DISCOVERY_BROWSE_INTERVAL_MS,
            discovery_stale_ttl_ms: DEFAULT_DISCOVERY_STALE_TTL_MS,
            runtime_backend_id: "diagnostics-export-test".to_string(),
            runtime_backend_capabilities: vec!["code".to_string()],
            runtime_port: 8788,
            ws_write_buffer_size_bytes: DEFAULT_RUNTIME_WS_WRITE_BUFFER_SIZE_BYTES,
            ws_max_write_buffer_size_bytes: DEFAULT_RUNTIME_WS_MAX_WRITE_BUFFER_SIZE_BYTES,
            ws_max_frame_size_bytes: DEFAULT_RUNTIME_WS_MAX_FRAME_SIZE_BYTES,
            ws_max_message_size_bytes: DEFAULT_RUNTIME_WS_MAX_MESSAGE_SIZE_BYTES,
            ws_max_connections: DEFAULT_RUNTIME_WS_MAX_CONNECTIONS,
            provider_extensions: Vec::new(),
        }
    }

    fn diagnostics_export_test_context() -> AppContext {
        build_app_context(
            create_initial_state("gpt-5.4"),
            diagnostics_export_test_config(),
            Arc::new(native_state_store::NativeStateStore::from_env_or_default()),
        )
    }

    fn diagnostics_export_test_runtime(
        task_id: &str,
        workspace_id: &str,
        status: AgentTaskStatus,
    ) -> AgentTaskRuntime {
        let now = now_ms();
        AgentTaskRuntime {
            summary: AgentTaskSummary {
                task_id: task_id.to_string(),
                workspace_id: workspace_id.to_string(),
                thread_id: None,
                request_id: None,
                title: None,
                task_source: None,
                validation_preset_id: None,
                status: status.as_str().to_string(),
                access_mode: "workspace-write".to_string(),
                execution_profile_id: None,
                review_profile_id: None,
                agent_profile: "code".to_string(),
                provider: None,
                model_id: None,
                reason_effort: None,
                routed_provider: None,
                routed_model_id: None,
                routed_pool: None,
                routed_source: None,
                current_step: Some(1),
                created_at: now,
                updated_at: now,
                started_at: Some(now),
                completed_at: None,
                error_code: None,
                error_message: None,
                pending_approval_id: None,
                pending_approval: None,
                review_decision: None,
                mission_brief: None,
                relaunch_context: None,
                auto_drive: None,
                backend_id: Some("worker-1".to_string()),
                acp_integration_id: None,
                acp_session_id: None,
                acp_config_options: None,
                acp_available_commands: None,
                preferred_backend_ids: None,
                placement_fallback_reason_code: None,
                resume_backend_id: None,
                placement_score_breakdown: None,
                root_task_id: None,
                parent_task_id: None,
                child_task_ids: None,
                distributed_status: Some("planning".to_string()),
                steps: vec![AgentTaskStepSummary {
                    index: 0,
                    kind: "read".to_string(),
                    role: "planner".to_string(),
                    status: status.as_str().to_string(),
                    message: "step".to_string(),
                    run_id: None,
                    output: None,
                    metadata: Value::Null,
                    started_at: Some(now),
                    updated_at: now,
                    completed_at: None,
                    error_code: None,
                    error_message: None,
                    approval_id: None,
                }],
            },
            steps_input: Vec::new(),
            interrupt_requested: false,
            checkpoint_id: None,
            review_actionability: None,
            execution_graph: None,
            takeover_bundle: None,
            recovered: false,
            last_tool_signature: None,
            consecutive_tool_signature_count: 0,
            interrupt_waiter: Arc::new(Notify::new()),
            approval_waiter: Arc::new(Notify::new()),
        }
    }

    #[test]
    fn diagnostics_export_env_gate_returns_method_not_found_when_disabled() {
        diagnostics_export::with_runtime_diagnostics_export_env_for_test(Some("0"), || {
            let error = ensure_runtime_diagnostics_export_enabled().expect_err("disabled");
            assert_eq!(error.code.as_str(), "METHOD_NOT_FOUND");
            assert!(
                error.message.contains(RUNTIME_DIAGNOSTICS_EXPORT_METHOD),
                "unexpected error message: {}",
                error.message
            );
        });
    }

    #[test]
    fn diagnostics_export_env_gate_allows_when_enabled() {
        diagnostics_export::with_runtime_diagnostics_export_env_for_test(Some("true"), || {
            assert!(ensure_runtime_diagnostics_export_enabled().is_ok());
        });
    }

    #[test]
    fn diagnostics_export_task_collection_tracks_counters_and_workspace_filtered_summaries() {
        let mut store = AgentTaskStore::default();
        store.tasks.insert(
            "task-a".to_string(),
            diagnostics_export_test_runtime("task-a", "workspace-a", AgentTaskStatus::Queued),
        );
        store.tasks.insert(
            "task-b".to_string(),
            diagnostics_export_test_runtime("task-b", "workspace-b", AgentTaskStatus::Running),
        );
        store.tasks.insert(
            "task-c".to_string(),
            diagnostics_export_test_runtime("task-c", "workspace-a", AgentTaskStatus::Completed),
        );

        let collection =
            collect_runtime_diagnostics_task_collection(&store, Some("workspace-a"), true);
        let mut task_summaries = collection.task_summaries.clone();
        task_summaries.sort_by(|left, right| left.task_id.cmp(&right.task_id));

        assert_eq!(collection.total, 3);
        assert_eq!(collection.queued, 1);
        assert_eq!(collection.running, 1);
        assert_eq!(collection.awaiting_approval, 0);
        assert_eq!(collection.terminal, 1);
        assert_eq!(task_summaries.len(), 2);
        assert_eq!(task_summaries[0].task_id, "task-a");
        assert_eq!(task_summaries[0].workspace_id, "workspace-a");
        assert_eq!(task_summaries[0].status, "queued");
        assert_eq!(task_summaries[0].current_step, Some(1));
        assert_eq!(task_summaries[0].backend_id.as_deref(), Some("worker-1"));
        assert_eq!(
            task_summaries[0].distributed_status.as_deref(),
            Some("planning")
        );
        assert_eq!(task_summaries[0].step_count, 1);
        assert_eq!(task_summaries[1].task_id, "task-c");
    }

    #[test]
    fn diagnostics_export_checkpoint_review_evidence_includes_review_pack_and_publish_handoff() {
        let mut store = AgentTaskStore::default();
        let mut runtime = diagnostics_export_test_runtime(
            "task-handoff",
            "workspace-a",
            AgentTaskStatus::Completed,
        );
        runtime.summary.auto_drive = Some(AgentTaskAutoDriveState {
            enabled: Some(true),
            destination: AgentTaskAutoDriveDestination {
                title: "Ship publish handoff".to_string(),
                desired_end_state: vec!["Prepare review branch".to_string()],
                done_definition: None,
                hard_boundaries: None,
                route_preference: None,
            },
            budget: None,
            risk_policy: None,
            context_policy: None,
            decision_policy: None,
            scenario_profile: None,
            decision_trace: None,
            outcome_feedback: None,
            autonomy_state: None,
            navigation: None,
            recovery: None,
            stop: Some(AgentTaskAutoDriveStopState {
                reason: "completed".to_string(),
                summary: Some("AutoDrive prepared publish handoff.".to_string()),
                at: Some(12),
            }),
        });
        runtime.checkpoint_id = Some("checkpoint-export-1".to_string());
        store.tasks.insert("task-handoff".to_string(), runtime);
        store.order.push_back("task-handoff".to_string());

        let temp = tempfile::tempdir().expect("tempdir");
        let handoff_dir = temp
            .path()
            .join(".hugecode")
            .join("runs")
            .join("task-handoff")
            .join("publish");
        std::fs::create_dir_all(&handoff_dir).expect("create handoff dir");
        std::fs::write(
            handoff_dir.join("handoff.json"),
            serde_json::to_vec(&json!({
                "publish": {
                    "branchName": "autodrive/task-handoff",
                    "commitMessage": "Ship publish handoff"
                },
                "reviewDraft": {
                    "title": "Ship publish handoff"
                }
            }))
            .expect("serialize handoff"),
        )
        .expect("write handoff");

        let workspace_roots_by_id = HashMap::from([(
            "workspace-a".to_string(),
            temp.path().to_string_lossy().to_string(),
        )]);

        let payloads = collect_runtime_checkpoint_evidence_payload(
            &store,
            &workspace_roots_by_id,
            Some("workspace-a"),
        );

        assert_eq!(payloads.len(), 1);
        assert_eq!(
            payloads[0].review_pack_id.as_deref(),
            Some("review-pack:task-handoff")
        );
        assert_eq!(
            payloads[0]
                .publish_handoff
                .as_ref()
                .and_then(|handoff| handoff.get("branchName"))
                .and_then(Value::as_str),
            Some("autodrive/task-handoff")
        );
        assert_eq!(
            payloads[0]
                .publish_handoff
                .as_ref()
                .and_then(|handoff| handoff.get("reviewTitle"))
                .and_then(Value::as_str),
            Some("Ship publish handoff")
        );
        assert_eq!(
            payloads[0].checkpoint_id.as_deref(),
            Some("checkpoint-export-1")
        );
        assert_eq!(
            payloads[0]
                .mission_linkage
                .as_ref()
                .and_then(|linkage| linkage.get("recoveryPath"))
                .and_then(Value::as_str),
            Some("run")
        );
        assert_eq!(
            payloads[0]
                .review_actionability
                .as_ref()
                .and_then(|actionability| actionability.get("actions"))
                .and_then(Value::as_array)
                .map(Vec::len),
            Some(8)
        );
    }

    #[tokio::test]
    async fn diagnostics_event_tail_reports_latest_state_fabric_event() {
        let ctx = diagnostics_export_test_context();
        publish_runtime_updated_event(&ctx, &["skills"], "diagnostics-event-tail", None);

        let summary = build_event_tail_summary(&ctx);
        assert_eq!(
            summary
                .get("latestStateFabricEvent")
                .and_then(|value| value.get("reason"))
                .and_then(Value::as_str),
            Some("diagnostics-event-tail")
        );
    }

    #[test]
    fn diagnostics_export_prunes_expired_compat_failure_cache_entries() {
        diagnostics_export::with_runtime_diagnostics_export_env_for_test(Some("true"), || {
            let runtime = tokio::runtime::Runtime::new().expect("tokio runtime");
            runtime.block_on(async {
                let ctx = diagnostics_export_test_context();
                let key = CompatModelCatalogCacheKey {
                    base_url: "https://compat.example.com".to_string(),
                    api_key_fingerprint: 7,
                };
                {
                    let mut failures = ctx.compat_model_catalog_failure_cache.write().await;
                    failures.insert(
                        key,
                        CachedCompatModelCatalogFailure {
                            error: "boom".to_string(),
                            failed_at: Instant::now()
                                - compat_model_error_cooldown()
                                - Duration::from_millis(1),
                        },
                    );
                }

                let payload =
                    build_runtime_diagnostics_snapshot_payload(&ctx, None, false, false).await;
                let snapshot = payload
                    .get("snapshot")
                    .cloned()
                    .expect("runtime diagnostics snapshot");
                assert_eq!(
                    snapshot["compatModelCatalogFailureCacheEntries"],
                    Value::Number(0_u64.into())
                );
                let failures = ctx.compat_model_catalog_failure_cache.read().await;
                assert!(failures.is_empty());
            });
        });
    }

    #[tokio::test]
    async fn diagnostics_export_snapshot_includes_observability_metadata() {
        let ctx = diagnostics_export_test_context();

        let payload = build_runtime_diagnostics_snapshot_payload(&ctx, None, false, false).await;
        let snapshot = payload
            .get("snapshot")
            .cloned()
            .expect("runtime diagnostics snapshot");

        assert_eq!(
            snapshot["observability"]["scope"],
            Value::String("full".to_string())
        );
        assert_eq!(
            snapshot["observability"]["taskCounterMode"],
            Value::String("compute".to_string())
        );
        assert_eq!(
            snapshot["observability"]["taskCounterCacheMissTotal"],
            Value::Number(1_u64.into())
        );
        assert_eq!(
            snapshot["observability"]["stateFabricFanoutQueueDepth"],
            Value::Number(0_u64.into())
        );
        assert_eq!(
            snapshot["observability"]["threadLiveUpdateFanoutCoalescedTotal"],
            Value::Number(0_u64.into())
        );
    }

    #[tokio::test]
    async fn diagnostics_checkpoint_evidence_cache_reuses_revision_scoped_payload() {
        let ctx = diagnostics_export_test_context();
        let first = collect_runtime_checkpoint_evidence_payload_cached(&ctx, None)
            .await
            .expect("first checkpoint evidence payload");
        let second = collect_runtime_checkpoint_evidence_payload_cached(&ctx, None)
            .await
            .expect("second checkpoint evidence payload");
        assert_eq!(first, second);

        let cache = ctx
            .revision_json_cache
            .lock()
            .expect("revision cache lock");
        assert_eq!(cache.revision, 0);
        assert!(cache.entries.contains_key(
            &RuntimeRevisionCacheKey::RuntimeCheckpointReviewEvidence { workspace_id: None }
        ));
    }

    #[tokio::test]
    async fn diagnostics_checkpoint_evidence_cache_drops_stale_revision_entries() {
        let ctx = diagnostics_export_test_context();
        let first_key = RuntimeRevisionCacheKey::RuntimeCheckpointReviewEvidence {
            workspace_id: None,
        };
        let second_key = RuntimeRevisionCacheKey::RuntimeCheckpointReviewEvidence {
            workspace_id: Some("workspace-a".to_string()),
        };

        collect_runtime_checkpoint_evidence_payload_cached(&ctx, None)
            .await
            .expect("cache first revision");

        publish_runtime_updated_event(&ctx, &["agents"], "diagnostics-cache-revision-bump", None);

        collect_runtime_checkpoint_evidence_payload_cached(&ctx, Some("workspace-a"))
            .await
            .expect("cache second revision");

        let cache = ctx
            .revision_json_cache
            .lock()
            .expect("revision cache lock");
        assert_eq!(cache.revision, 1);
        assert!(!cache.entries.contains_key(&first_key));
        assert!(cache.entries.contains_key(&second_key));
    }
}
