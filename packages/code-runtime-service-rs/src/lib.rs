mod acp_client_adapter;
mod acp_runtime;
mod agent_policy;
mod agent_task_durability;
mod agent_task_launch_synthesis;
mod agent_tasks;
mod codex_cloud_tasks;
mod codex_exec_run;
mod codex_oauth_handlers;
mod diagnostics_export;
mod distributed;
mod distributed_graph_rpc_helpers;
mod distributed_runtime;
mod extensions_runtime;
mod instruction_skills;
pub mod live_skills;
mod local_claude_exec_path;
mod local_claude_exec_turn;
mod local_codex_account_sync;
mod local_codex_cli_sessions;
mod local_codex_exec_path;
mod local_codex_exec_turn;
mod model_catalog;
mod native_runtime;
mod native_state_store;
mod oauth_metadata;
pub mod oauth_pool;
mod oauth_routing;
mod oauth_rpc_inputs;
mod prompt_library;
mod provider_catalog_runtime;
mod provider_query;
mod provider_replay;
mod provider_request_retry;
mod provider_requests;
mod provider_runtime_tool_call;
mod repository_execution_contract;
mod rpc_dispatch;
pub(crate) mod rpc_dispatch_extensions;
mod rpc_dispatch_native;
mod rpc_params;
mod runtime_checkpoint;
mod runtime_events;
mod runtime_execution_graph;
mod runtime_helpers;
mod runtime_tool_domain;
mod runtime_tool_guardrails;
mod runtime_tool_metrics;
mod runtime_tool_safety_counters;
mod runtime_transport_auth;
mod security_preflight;
mod session_portability;
mod sub_agents;
mod terminal_runtime;
mod turn_failure_codes;
mod turn_runtime_plan;
mod turn_runtime_plan_validation;
mod turn_send_handler;
mod workspace_diagnostics;
mod workspace_picker;

pub(crate) use agent_tasks::refresh_agent_task_runtime_execution_truth;
pub use distributed::config::{
    DEFAULT_DISTRIBUTED_CLAIM_IDLE_MS, DEFAULT_DISTRIBUTED_LANE_COUNT,
    DEFAULT_DISTRIBUTED_WORKER_CONCURRENCY, MAX_DISTRIBUTED_LANE_COUNT,
    MAX_DISTRIBUTED_WORKER_CONCURRENCY,
};
pub use instruction_skills::{
    compute_instruction_skill_roots_fingerprint, compute_instruction_skill_shared_fingerprint,
    compute_instruction_skill_workspace_fingerprint, resolve_instruction_skill_watch_roots,
    InstructionSkillWatchRoot,
};
pub use live_skills::{
    DEFAULT_LIVE_SKILLS_NETWORK_BASE_URL, DEFAULT_LIVE_SKILLS_NETWORK_CACHE_TTL_MS,
    DEFAULT_LIVE_SKILLS_NETWORK_TIMEOUT_MS,
};
pub(crate) use rpc_dispatch::mission_control_dispatch::{
    build_task_execution_profile,
    support::{build_profile_readiness, build_task_routing},
};
#[allow(unused_imports)]
pub(crate) use runtime_execution_graph::{
    build_runtime_execution_graph_summary,
    build_runtime_execution_graph_summary_with_runtime_truth, RuntimeExecutionEdgeSummary,
    RuntimeExecutionGraphSummary, RuntimeExecutionNodeSummary,
};

pub const DEFAULT_SANDBOX_NETWORK_ACCESS: &str = "none";
pub const DEFAULT_DISCOVERY_SERVICE_TYPE: &str = "_openwrap-code-runtime._tcp.local.";
pub const DEFAULT_DISCOVERY_BROWSE_INTERVAL_MS: u64 = 5_000;
pub const DEFAULT_DISCOVERY_STALE_TTL_MS: u64 = 15_000;
pub const DEFAULT_RUNTIME_BACKEND_CAPABILITIES: &str = "code";

use std::{
    collections::hash_map::DefaultHasher,
    collections::{BTreeMap, HashMap, HashSet, VecDeque},
    fmt::Write as _,
    fs::{self, File},
    hash::{Hash, Hasher},
    io::{BufRead, BufReader, BufWriter, Write as _},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, LazyLock, Mutex,
    },
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query, State,
    },
    http::{
        header::HOST,
        header::{CACHE_CONTROL, RETRY_AFTER},
        HeaderMap, HeaderValue, StatusCode,
    },
    middleware::{self},
    response::{Html, IntoResponse},
    routing::{get, post},
    Json, Router,
};
use base64::{
    engine::general_purpose::{URL_SAFE, URL_SAFE_NO_PAD},
    Engine as _,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use tokio::sync::{
    broadcast, Mutex as AsyncMutex, Notify, OwnedMutexGuard, OwnedSemaphorePermit, RwLock,
    Semaphore,
};
use tokio_stream::{
    wrappers::{errors::BroadcastStreamRecvError, BroadcastStream},
    StreamExt,
};
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::{info, warn};
use uuid::Uuid;

use acp_client_adapter::{
    hydrate_acp_integrations_from_native_store, sync_projected_backends,
    sync_projected_backends_into_map,
};
#[cfg(test)]
use agent_policy::ensure_agent_task_capacity;
use agent_policy::{
    is_agent_task_terminal_status, is_full_access_mode, is_read_only_access_mode,
    normalize_access_mode, normalize_reason_effort, trim_optional_string,
};
use agent_task_durability::{
    agent_task_trace_id, bootstrap_durable_runtime_state,
    build_agent_task_durability_diagnostics_payload, checkpoint_agent_task_runtime,
    checkpoint_tool_call_lifecycle, is_agent_task_recovery_interrupted,
    recover_agent_task_runtime_by_id,
};
use agent_tasks::{
    handle_agent_approval_decision, handle_agent_task_interrupt, handle_agent_task_intervene,
    handle_agent_task_resume, handle_agent_task_start, handle_agent_task_status,
    handle_agent_tasks_list,
};
use codex_oauth_handlers::{
    codex_oauth_callback_handler, codex_oauth_cancel_handler, codex_oauth_start_handler,
};
use distributed_runtime::{
    build_cached_distributed_readiness_snapshot, build_runtime_observability_snapshot,
    clear_distributed_dispatch_error, enqueue_distributed_agent_command,
    persist_distributed_runtime_backend_summary, persist_distributed_task_summary,
    prepare_runtime_updated_diagnostics_payload_for_emit, remove_distributed_runtime_backend,
    set_distributed_dispatch_error, sync_runtime_backends_from_distributed_store,
};
#[cfg(test)]
use distributed_runtime::{
    normalize_distributed_dispatch_error_message, normalize_distributed_dispatch_error_source,
    resolve_cached_distributed_readiness_snapshot, truncate_chars_with_ellipsis,
};
use local_claude_exec_turn::{
    check_local_claude_cli_readiness, clear_local_claude_thread_session,
    persist_local_claude_thread_session, query_local_claude_exec_turn,
    read_local_claude_thread_session, LocalClaudeExecTurnInput,
};
use local_codex_account_sync::{
    classify_oauth_api_key_resolution_error, import_cockpit_tools_codex_accounts,
    is_local_codex_cli_managed_account,
    resolve_local_codex_cli_fallback_api_credential_from_profile,
    resolve_local_codex_cli_id_token_from_profile, resolve_local_codex_cli_profile_for_account,
    resolve_local_codex_cli_refresh_token_from_profile, resolve_oauth_api_key_for_account,
    sync_local_codex_cli_account,
};
#[cfg(test)]
use local_codex_account_sync::{
    sync_local_codex_cli_account_from_profile, sync_local_codex_cli_account_without_profile,
};
use local_codex_cli_sessions::{
    list_local_cli_sessions, load_local_codex_cached_model_slugs,
    persist_local_codex_cli_auth_updates,
};
#[cfg(test)]
use local_codex_cli_sessions::{
    load_local_codex_cli_auth_profile_from_path, parse_local_codex_cli_auth_profile_from_value,
};
use local_codex_exec_turn::{query_local_codex_exec_turn, should_use_local_codex_exec_for_turn};
use model_catalog::{
    detect_provider_from_model_id, infer_provider, parse_openai_compat_model_catalog,
    parse_runtime_provider, CompatModelCatalog,
};
#[cfg(test)]
use oauth_metadata::redact_oauth_account_metadata;
use oauth_metadata::{
    extract_oauth_auth_mode_from_metadata, extract_oauth_credential_source_from_metadata,
    extract_openai_compat_base_url_from_metadata, redact_oauth_account_summary,
    should_route_oauth_via_chatgpt_codex_backend,
};
use oauth_pool::{
    canonicalize_provider_alias, validate_oauth_secret_key, OAuthAccountUpsertInput,
    OAuthPoolAccountBindInput, OAuthPoolApplyInput, OAuthPoolDiagnostics, OAuthPoolMemberInput,
    OAuthPoolMutationError, OAuthPoolMutationErrorCode, OAuthPoolSelectMissReason,
    OAuthPoolSelectionInput, OAuthPoolStore, OAuthPoolUpsertInput, OAuthPrimaryAccountSetInput,
    OAuthRateLimitReportInput, OAUTH_ACCOUNT_API_KEY_ENCRYPTED_V1_KEY,
};
use oauth_routing::{
    recover_local_codex_cli_api_credential, refresh_local_codex_cli_account_for_turn,
    resolve_oauth_routing_credentials, resolve_oauth_routing_credentials_from_account,
    should_attempt_local_codex_sync,
};
use oauth_rpc_inputs::{
    map_oauth_account_upsert_error, map_oauth_pool_mutation_error,
    parse_oauth_account_upsert_input, parse_oauth_pool_apply_input, parse_oauth_pool_member_inputs,
    parse_oauth_pool_upsert_input, parse_oauth_primary_account_set_input,
    parse_oauth_rate_limit_report_input, parse_optional_oauth_provider,
};
use prompt_library::{
    build_prompt_library_entry, derive_title, ensure_workspace, list_prompt_library_entries,
    read_required_prompt_scope, remove_prompt_from_workspace_store,
};
#[cfg(test)]
use provider_catalog_runtime::prune_compat_model_catalog_cache;
use provider_catalog_runtime::{
    build_models_pool, build_providers_catalog, prune_compat_model_catalog_failure_cache,
    resolve_provider_default_model_id,
};
use provider_query::query_provider;
use provider_requests::{build_openai_compat_endpoint, extract_openai_error_message};
use repository_execution_contract::{
    profile_execution_mode, resolve_workspace_repository_execution_defaults,
    RepositoryExecutionExplicitLaunchInput,
};
use rpc_dispatch::handle_rpc;
pub(crate) use rpc_dispatch::{
    assess_runtime_backend_operability, build_kernel_projection_delta_v3,
    RuntimeBackendOperabilityAssessment,
};
use rpc_dispatch_native::handle_native_rpc;
use rpc_params::{
    as_object, read_optional_bool, read_optional_i32, read_optional_string, read_optional_u64,
    read_required_string,
};
use runtime_events::{
    build_runtime_stream_resync_event_envelope, events_handler,
    latest_runtime_state_fabric_event_frame, publish_runtime_updated_event,
    publish_runtime_updated_event_at, publish_thread_live_detached_event,
    publish_thread_live_heartbeat_event, publish_thread_live_update_events, publish_turn_event,
    resolve_turn_event_replay_frames_for_last_event_id, runtime_update_scope_for_method,
    spawn_runtime_state_fabric_fanout_task, spawn_thread_live_update_fanout_task, TurnEventFrame,
    TurnEventReplayBuffer, EVENT_STREAM_RESYNC_REASON_LAGGED,
    EVENT_STREAM_RESYNC_REASON_REPLAY_GAP, TURN_EVENTS_BUFFER, TURN_EVENT_APPROVAL_REQUIRED,
    TURN_EVENT_APPROVAL_RESOLVED, TURN_EVENT_COMPLETED, TURN_EVENT_DELTA,
    TURN_EVENT_EXTENSION_UPDATED, TURN_EVENT_FAILED, TURN_EVENT_ITEM_MCP_TOOL_CALL_PROGRESS,
    TURN_EVENT_ITEM_UPDATED, TURN_EVENT_SECURITY_PREFLIGHT_BLOCKED,
    TURN_EVENT_SESSION_PORTABILITY_UPDATED, TURN_EVENT_STARTED, TURN_EVENT_TOOL_CALLING,
    TURN_EVENT_TOOL_RESULT,
};
#[cfg(test)]
use runtime_events::{
    EVENT_STREAM_RESYNC_SCOPE, TURN_EVENTS_REPLAY_BUFFER, TURN_EVENTS_REPLAY_MAX_BYTES,
};
use runtime_helpers::{
    compute_agent_route, increment_terminalization_cas_noop_metric, normalize_model_id,
    parse_agent_approval_decision_request, parse_agent_task_interrupt_request,
    parse_agent_task_intervention_request, parse_agent_task_list_request,
    parse_agent_task_status_request, resolve_agent_workspace_lock,
    resolve_compat_model_catalog_refresh_lock, terminalization_cas_enabled,
    try_finalize_agent_task_runtime,
};
#[cfg(test)]
use runtime_helpers::{
    prune_stale_agent_workspace_locks, prune_stale_compat_model_catalog_refresh_locks,
};
use runtime_transport_auth::{configured_runtime_auth_token, runtime_transport_auth_middleware};
use sub_agents::{
    handle_sub_agent_close, handle_sub_agent_interrupt, handle_sub_agent_send,
    handle_sub_agent_spawn, handle_sub_agent_status, handle_sub_agent_wait,
};
use turn_runtime_plan::{
    maybe_recover_provider_local_access_refusal, query_provider_via_runtime_plan,
    query_provider_via_runtime_plan_only, should_use_provider_runtime_plan_flow,
};
use turn_send_handler::handle_turn_send;

pub type SharedRuntimeState = Arc<RwLock<RuntimeState>>;

pub const DEFAULT_OPENAI_TIMEOUT_MS: u64 = 45_000;
pub const DEFAULT_OPENAI_MAX_RETRIES: u32 = 2;
pub const DEFAULT_OPENAI_RETRY_BASE_MS: u64 = 250;
pub const DEFAULT_ANTHROPIC_ENDPOINT: &str = "https://api.anthropic.com/v1/messages";
pub const DEFAULT_ANTHROPIC_VERSION: &str = "2023-06-01";
pub const DEFAULT_GEMINI_ENDPOINT: &str = "https://generativelanguage.googleapis.com/v1beta/models";
pub const DEFAULT_OPENAI_COMPAT_MODEL_CACHE_TTL_MS: u64 = 30_000;
pub const MAX_OPENAI_COMPAT_MODEL_CACHE_ENTRIES: usize = 128;
pub const MIN_RECOMMENDED_OPENAI_COMPAT_MODEL_CACHE_TTL_MS: u64 = 1_000;
const OPENAI_COMPAT_MODEL_CATALOG_ERROR_COOLDOWN_MS: u64 = 500;
pub const DEFAULT_AGENT_MAX_CONCURRENT_TASKS: usize = 4;
pub const MAX_AGENT_MAX_CONCURRENT_TASKS: usize = 128;
pub const DEFAULT_AGENT_TASK_HISTORY_LIMIT: usize = 256;
pub const MAX_AGENT_TASK_HISTORY_LIMIT: usize = 4_096;
pub const DEFAULT_RUNTIME_WS_WRITE_BUFFER_SIZE_BYTES: usize = 256 * 1024;
pub const DEFAULT_RUNTIME_WS_MAX_WRITE_BUFFER_SIZE_BYTES: usize = 16 * 1024 * 1024;
pub const DEFAULT_RUNTIME_WS_MAX_FRAME_SIZE_BYTES: usize = 8 * 1024 * 1024;
pub const DEFAULT_RUNTIME_WS_MAX_MESSAGE_SIZE_BYTES: usize = 8 * 1024 * 1024;
pub const DEFAULT_RUNTIME_WS_MAX_CONNECTIONS: usize = 256;
const MAX_RUNTIME_WS_WRITE_BUFFER_SIZE_BYTES_HARD: usize = 4 * 1024 * 1024;
const MAX_RUNTIME_WS_MAX_WRITE_BUFFER_SIZE_BYTES_HARD: usize = 64 * 1024 * 1024;
const MAX_RUNTIME_WS_MAX_FRAME_SIZE_BYTES_HARD: usize = 16 * 1024 * 1024;
const MAX_RUNTIME_WS_MAX_MESSAGE_SIZE_BYTES_HARD: usize = 32 * 1024 * 1024;
const MAX_RUNTIME_WS_MAX_CONNECTIONS_HARD: usize = 4_096;
const WS_CONNECTION_LIMIT_RETRY_AFTER_SECONDS: &str = "1";
const WS_CONNECTION_LIMIT_CACHE_CONTROL: &str = "no-store";

const DEFAULT_OPENAI_MODEL_ID: &str = "gpt-5.4";
const DEFAULT_ANTHROPIC_MODEL_ID: &str = "claude-sonnet-4-5";
const DEFAULT_GEMINI_MODEL_ID: &str = "gemini-3.1-pro";
const DISTRIBUTED_STATE_SYNC_INTERVAL_MS: u64 = 1_500;
const DISTRIBUTED_WORKER_POLL_INTERVAL_MS: u64 = 120;
const DISTRIBUTED_WORKER_RECLAIM_INTERVAL_LOOPS: u64 = 8;
const DISTRIBUTED_ERROR_SOURCE_BOOTSTRAP: &str = "bootstrap";
const DISTRIBUTED_ERROR_SOURCE_STATE_SYNC: &str = "state-sync";
const DISTRIBUTED_ERROR_SOURCE_BACKEND_REGISTRY: &str = "backend-registry";
const DISTRIBUTED_ERROR_SOURCE_WORKER: &str = "worker";
const DISTRIBUTED_ERROR_SOURCE_ENQUEUE: &str = "enqueue";
const DISTRIBUTED_ERROR_SOURCE_DISCOVERY: &str = "discovery";
const DISTRIBUTED_ERROR_SOURCE_UNKNOWN: &str = "unknown";
const MAX_DISTRIBUTED_DISPATCH_ERROR_CHARS: usize = 2_048;
const MAX_DISTRIBUTED_DISPATCH_SUMMARY_CHARS: usize = 4_096;
const DEFAULT_THREAD_LIVE_HEARTBEAT_INTERVAL_MS: u64 = 10_000;
const CODE_RUNTIME_RPC_CONTRACT_VERSION: &str = "2026-03-25";
const CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT: &str = "2026-03-25";
const CODE_RUNTIME_RPC_FEATURES: &[&str] = &[
    "method_not_found_error_code",
    "rpc_capabilities_handshake",
    "oauth_account_pool",
    "oauth_secret_key_encryption_v1",
    "prompt_library_mutation",
    "live_skills_core_agents",
    "provider_catalog",
    "bootstrap_snapshot_v1",
    "rpc_batch_read_v1",
    "agent_orchestrator_v1",
    "canonical_methods_only",
    "distributed_runtime_v1",
    "durable_task_log_v1",
    "workspace_lane_sharding_v1",
    "event_replay_durable_v1",
    "multi_backend_pool_v1",
    "distributed_subtask_graph_v1",
    "backend_placement_observability_v1",
    "sub_agent_sessions_v1",
    "execution_mode_v2",
    "agent_task_durability_v1",
    "agent_task_resume_v1",
    "runtime_tool_lifecycle_v2",
    "runtime_tool_metrics_v1",
    "runtime_tool_guardrails_v1",
    "runtime_autonomy_v2",
    "runtime_autonomy_safety_v1",
    "runtime_kernel_v2",
    "runtime_kernel_prepare_v2",
    "runtime_kernel_projection_v3",
    "runtime_kernel_jobs_v3",
    "runtime_stream_backpressure_v1",
    "runtime_lifecycle_sweeper_v1",
    "runtime_lifecycle_consistency_v1",
    "runtime_distributed_state_cas_v1",
    "runtime_stream_guardrails_v1",
    "runtime_lifecycle_observability_v1",
    "runtime_distributed_lease_observability_v1",
    "runtime_backend_registry_persistence_v1",
    "runtime_backend_operability_v1",
    "runtime_acp_readiness_probe_v1",
    "runtime_review_actionability_v1",
    "runtime_review_linkage_v1",
    "runtime_truth_contract_core_v1",
    "runtime_mission_control_summary_v1",
    "runtime_task_normalization_v1",
    "runtime_task_native_run_review_v1",
    "runtime_fault_injection_test_v1",
    "oauth_chatgpt_auth_tokens_refresh_v1",
    "oauth_codex_login_control_v1",
    "git_diff_paging_v1",
    "thread_live_subscription_v1",
    "workspace_diagnostics_list_v1",
    "runtime_extension_lifecycle_v1",
    "runtime_session_portability_v1",
    "runtime_security_preflight_v1",
    "runtime_diagnostics_export_v1",
    "runtime_codex_exec_run_v1",
    "runtime_codex_cloud_tasks_read_v1",
    "runtime_codex_execpolicy_preflight_v1",
    "runtime_codex_unified_rpc_migration_v1",
    "runtime_host_deprecated",
    "app_server_protocol_v2_2026_03_25",
    "contract_frozen_2026_03_25",
];
const CODE_RUNTIME_RPC_ERROR_CODES: &[(&str, &str)] = &[
    ("METHOD_NOT_FOUND", "METHOD_NOT_FOUND"),
    ("INVALID_PARAMS", "INVALID_PARAMS"),
    ("INTERNAL_ERROR", "INTERNAL_ERROR"),
];
const CODE_RUNTIME_RPC_TRANSPORT_RPC_PATH: &str = "/rpc";
const CODE_RUNTIME_RPC_TRANSPORT_EVENTS_PATH: &str = "/events";
const CODE_RUNTIME_RPC_TRANSPORT_WS_PATH: &str = "/ws";
const CODE_RUNTIME_RPC_TRANSPORT_AUTH_HEADER: &str = "x-code-runtime-auth-token";
const CODE_RUNTIME_RPC_TRANSPORT_AUTH_QUERY: &str = "token";
const CODE_RUNTIME_OAUTH_CODEX_START_PATH: &str = "/oauth/codex/start";
const CODE_RUNTIME_OAUTH_CODEX_CALLBACK_PATH: &str = "/auth/callback";
const CODE_RUNTIME_OAUTH_CODEX_CALLBACK_LEGACY_PATH: &str = "/oauth/codex/callback";
const CODE_RUNTIME_OAUTH_CODEX_CANCEL_PATH: &str = "/oauth/codex/cancel";
const CODE_RUNTIME_DEFAULT_WORKSPACE_PATH_ENV: &str = "CODE_RUNTIME_SERVICE_DEFAULT_WORKSPACE_PATH";
const CODE_RUNTIME_TURNS_USE_LOCAL_CODEX_EXEC_ENV: &str =
    "CODE_RUNTIME_SERVICE_TURNS_USE_LOCAL_CODEX_EXEC";
const CODE_RUNTIME_RPC_TRANSPORT_RPC_PROTOCOL: &str = "json-rpc-over-http-v1";
const CODE_RUNTIME_RPC_TRANSPORT_EVENTS_PROTOCOL: &str = "sse-v1";
const CODE_RUNTIME_RPC_TRANSPORT_WS_PROTOCOL: &str = "runtime-ws-v1";
const CODE_RUNTIME_RPC_TRANSPORT_REPLAY_HEADER: &str = "Last-Event-ID";
const CODE_RUNTIME_RPC_TRANSPORT_REPLAY_QUERY: &str = "lastEventId";
const CODEX_OAUTH_ISSUER: &str = "https://auth.openai.com";
const CODEX_OAUTH_CLIENT_ID: &str = "app_EMoamEEZ73f0CkXaXp7hrann";
#[cfg(test)]
const CODE_RUNTIME_CODEX_OAUTH_ISSUER_ENV: &str = "CODE_RUNTIME_CODEX_OAUTH_ISSUER";

pub(crate) fn resolve_codex_oauth_issuer() -> String {
    #[cfg(test)]
    if let Some(issuer) = std::env::var(CODE_RUNTIME_CODEX_OAUTH_ISSUER_ENV)
        .ok()
        .map(|value| value.trim().trim_end_matches('/').to_string())
        .filter(|value| !value.is_empty())
    {
        return issuer;
    }

    CODEX_OAUTH_ISSUER.to_string()
}
const CODEX_OAUTH_STATE_BYTES: usize = 32;
const CODEX_OAUTH_PKCE_VERIFIER_BYTES: usize = 64;
const CODEX_OAUTH_LOGIN_TTL_MS: u64 = 10 * 60 * 1000;
// These OAuth parameters are part of the registered HugeCode Codex login shape.
// Changing them breaks the upstream authorize flow even if local tests still build.
const CODEX_OAUTH_SCOPE: &str =
    "openid profile email offline_access api.connectors.read api.connectors.invoke";
const CODEX_OAUTH_DEFAULT_WORKSPACE_ID: &str = "workspace-local";
pub const DEFAULT_OAUTH_LOOPBACK_CALLBACK_PORT: u16 = 1455;
const CODEX_OAUTH_ORIGINATOR: &str = "hypecode";

fn persist_compact_json_snapshot<T: Serialize>(
    path: &Path,
    payload: &T,
    snapshot_label: &str,
) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "create {snapshot_label} directory `{}`: {error}",
                parent.display()
            )
        })?;
    }

    let temp_path = path.with_extension(format!("tmp-{}", Uuid::new_v4().as_simple()));
    {
        let file = File::create(&temp_path).map_err(|error| {
            format!(
                "write {snapshot_label} temp snapshot `{}`: {error}",
                temp_path.display()
            )
        })?;
        let mut writer = BufWriter::new(file);
        serde_json::to_writer(&mut writer, payload)
            .map_err(|error| format!("serialize {snapshot_label} snapshot: {error}"))?;
        writer.flush().map_err(|error| {
            format!(
                "flush {snapshot_label} temp snapshot `{}`: {error}",
                temp_path.display()
            )
        })?;
    }
    if let Err(error) = fs::rename(&temp_path, path) {
        fs::copy(&temp_path, path).map_err(|copy_error| {
            format!(
                "persist {snapshot_label} snapshot `{}`: rename failed ({error}); copy fallback failed ({copy_error})",
                path.display()
            )
        })?;
        let _ = fs::remove_file(&temp_path);
    }
    Ok(())
}

include!("lib_thread_live_subscription.rs");
include!("lib_types.rs");
include!("lib_config_and_router.rs");
include!("lib_runtime_oauth.rs");
include!("lib_distributed_worker.rs");
include!("lib_transport_rpc.rs");

#[cfg(test)]
mod lib_tests;
