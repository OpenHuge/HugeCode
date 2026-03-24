use crate::commands::policy::rpc_method_enabled;
use crate::CODE_TAURI_REGISTERED_RPC_COMMANDS;
use serde::Serialize;
use std::collections::{BTreeMap, HashSet};

pub(crate) const CODE_RUNTIME_RPC_CONTRACT_VERSION: &str = "2026-03-24";
pub(crate) const CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT: &str = "2026-03-24";
pub(crate) const CODE_RUNTIME_RPC_FROZEN_FEATURE: &str = "contract_frozen_2026_03_24";
pub(crate) const CODE_RUNTIME_RPC_CAPABILITY_PROFILE: &str = "desktop-core";
pub(crate) const CODE_RUNTIME_RPC_FEATURES: &[&str] = &[
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
    CODE_RUNTIME_RPC_FROZEN_FEATURE,
];
pub(crate) const CODE_RUNTIME_RPC_ERROR_CODES: &[(&str, &str)] = &[
    ("METHOD_NOT_FOUND", "METHOD_NOT_FOUND"),
    ("INVALID_PARAMS", "INVALID_PARAMS"),
    ("INTERNAL_ERROR", "INTERNAL_ERROR"),
];

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RpcTransportReplayDescriptor {
    pub mode: String,
    pub key: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RpcTransportDescriptor {
    pub channel: String,
    pub endpoint_path: String,
    pub protocol: String,
    pub replay: RpcTransportReplayDescriptor,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RpcCapabilities {
    pub profile: String,
    pub contract_version: String,
    pub freeze_effective_at: String,
    pub method_set_hash: String,
    pub features: Vec<String>,
    pub methods: Vec<String>,
    pub error_codes: BTreeMap<String, String>,
    pub transports: BTreeMap<String, RpcTransportDescriptor>,
}

fn rpc_transport(
    channel: &str,
    endpoint_path: &str,
    protocol: &str,
    replay_mode: &str,
    replay_key: Option<&str>,
) -> RpcTransportDescriptor {
    RpcTransportDescriptor {
        channel: channel.to_string(),
        endpoint_path: endpoint_path.to_string(),
        protocol: protocol.to_string(),
        replay: RpcTransportReplayDescriptor {
            mode: replay_mode.to_string(),
            key: replay_key.map(ToOwned::to_owned),
        },
    }
}

fn normalize_rpc_methods<'a>(methods: impl IntoIterator<Item = &'a str>) -> Vec<String> {
    let mut normalized: Vec<String> = methods
        .into_iter()
        .map(str::trim)
        .filter(|method| !method.is_empty())
        .map(ToOwned::to_owned)
        .collect();
    normalized.sort_unstable();
    normalized.dedup();
    normalized
}

pub(crate) fn compute_rpc_method_set_hash(methods: &[String]) -> String {
    const FNV_OFFSET_BASIS: u64 = 0xcbf29ce484222325;
    const FNV_PRIME: u64 = 0x100000001b3;

    let normalized = normalize_rpc_methods(methods.iter().map(String::as_str));
    let mut hash = FNV_OFFSET_BASIS;
    for method in normalized {
        for byte in method.as_bytes() {
            hash ^= u64::from(*byte);
            hash = hash.wrapping_mul(FNV_PRIME);
        }
        hash ^= 0xff;
        hash = hash.wrapping_mul(FNV_PRIME);
    }
    format!("{hash:016x}")
}

pub(crate) fn build_rpc_capabilities(methods: &[&str]) -> RpcCapabilities {
    let normalized_methods = current_rpc_methods(methods);
    let method_set_hash = compute_rpc_method_set_hash(normalized_methods.as_slice());
    let features = current_rpc_features();
    let error_codes = CODE_RUNTIME_RPC_ERROR_CODES
        .iter()
        .map(|(code, value)| ((*code).to_string(), (*value).to_string()))
        .collect();
    let transports = BTreeMap::from([
        (
            "rpc".to_string(),
            rpc_transport("rpc", "/rpc", "json-rpc-over-http-v1", "none", None),
        ),
        (
            "events".to_string(),
            rpc_transport(
                "events",
                "/events",
                "sse-v1",
                "header",
                Some("Last-Event-ID"),
            ),
        ),
        (
            "ws".to_string(),
            rpc_transport(
                "duplex",
                "/ws",
                "runtime-ws-v1",
                "query",
                Some("lastEventId"),
            ),
        ),
    ]);

    RpcCapabilities {
        profile: CODE_RUNTIME_RPC_CAPABILITY_PROFILE.to_string(),
        contract_version: CODE_RUNTIME_RPC_CONTRACT_VERSION.to_string(),
        freeze_effective_at: CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT.to_string(),
        method_set_hash,
        features,
        methods: normalized_methods,
        error_codes,
        transports,
    }
}

pub(crate) fn current_rpc_methods(methods: &[&str]) -> Vec<String> {
    normalize_rpc_methods(
        methods
            .iter()
            .copied()
            .filter(|method| rpc_method_enabled(method)),
    )
}

pub(crate) fn current_rpc_features() -> Vec<String> {
    let mut seen = HashSet::new();
    CODE_RUNTIME_RPC_FEATURES
        .iter()
        .filter_map(|feature| {
            let owned = (*feature).to_string();
            seen.insert(owned.clone()).then_some(owned)
        })
        .collect()
}

#[tauri::command]
pub fn code_rpc_capabilities() -> RpcCapabilities {
    build_rpc_capabilities(CODE_TAURI_REGISTERED_RPC_COMMANDS)
}
