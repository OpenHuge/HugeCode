use super::*;

#[derive(Clone, Copy, Debug)]
pub(super) struct RpcMethodEntry {
    pub(super) method: &'static str,
}

impl RpcMethodEntry {
    const fn new(method: &'static str) -> Self {
        Self { method }
    }
}

pub(super) const MAX_LOCAL_CLI_SESSIONS: usize = 64;
pub(super) const LOCAL_CODEX_CLI_SYNC_MIN_INTERVAL_MS: u64 = 5_000;
pub(super) const LOCAL_CODEX_CLI_ACCOUNT_ID: &str = "codex-local-cli";
pub(super) const LOCAL_CODEX_CLI_ACCOUNT_SOURCE: &str = "local_codex_cli_auth";
pub(super) const SERVICE_CODEX_OAUTH_ACCOUNT_SOURCE: &str = "service_codex_oauth";
pub(super) const SERVICE_CODEX_USAGE_REFRESH_MIN_INTERVAL_MS: u64 = 15_000;
pub(super) const SERVICE_CODEX_USAGE_STALE_AFTER_MS: u64 = 60_000;
pub(super) const SERVICE_CODEX_USAGE_REFRESH_RETRY_BACKOFF_MS: u64 = 45_000;
pub(super) const SERVICE_CODEX_USAGE_FORCE_REFRESH_MAX_ACCOUNTS: usize = 3;
pub(super) const RPC_TURN_SEND_ACK_TIMEOUT_MS: u64 = 60_000;
pub(super) const LOCAL_CODEX_CLI_DISABLED_REASON_PROFILE_MISSING: &str =
    "local_cli_profile_missing";
pub(super) const LOCAL_CODEX_CLI_DISABLED_REASON_CREDENTIAL_MISSING: &str =
    "local_cli_credential_missing";
pub(super) const LOCAL_CODEX_CLI_RESERVED_METADATA_KEYS: &[&str] = &[
    "source",
    "localCliManaged",
    "credentialAvailable",
    "credentialSource",
];

pub(super) const RPC_METHOD_REGISTRY: &[RpcMethodEntry] = &[
    RpcMethodEntry::new("code_rpc_capabilities"),
    RpcMethodEntry::new("code_health"),
    RpcMethodEntry::new("code_settings_summary"),
    RpcMethodEntry::new("code_app_settings_get"),
    RpcMethodEntry::new("code_app_settings_update"),
    RpcMethodEntry::new("code_remote_status"),
    RpcMethodEntry::new("code_terminal_status"),
    RpcMethodEntry::new("code_models_pool"),
    RpcMethodEntry::new("code_providers_catalog"),
    RpcMethodEntry::new("code_workspaces_list"),
    RpcMethodEntry::new("code_mission_control_snapshot_v1"),
    RpcMethodEntry::new("code_mission_control_summary_v1"),
    RpcMethodEntry::new("code_bootstrap_snapshot"),
    RpcMethodEntry::new("code_rpc_batch"),
    RpcMethodEntry::new("code_workspace_pick_directory"),
    RpcMethodEntry::new("code_workspace_create"),
    RpcMethodEntry::new("code_workspace_rename"),
    RpcMethodEntry::new("code_workspace_remove"),
    RpcMethodEntry::new("code_workspace_files_list"),
    RpcMethodEntry::new("code_workspace_file_read"),
    RpcMethodEntry::new("code_workspace_diagnostics_list_v1"),
    RpcMethodEntry::new("code_workspace_patch_apply_v1"),
    RpcMethodEntry::new("code_git_changes_list"),
    RpcMethodEntry::new("code_git_diff_read"),
    RpcMethodEntry::new("code_git_log"),
    RpcMethodEntry::new("code_git_branches_list"),
    RpcMethodEntry::new("code_git_branch_create"),
    RpcMethodEntry::new("code_git_branch_checkout"),
    RpcMethodEntry::new("code_git_stage_change"),
    RpcMethodEntry::new("code_git_stage_all"),
    RpcMethodEntry::new("code_git_unstage_change"),
    RpcMethodEntry::new("code_git_revert_change"),
    RpcMethodEntry::new("code_git_commit"),
    RpcMethodEntry::new("code_prompt_library_list"),
    RpcMethodEntry::new("code_prompt_library_create"),
    RpcMethodEntry::new("code_prompt_library_update"),
    RpcMethodEntry::new("code_prompt_library_delete"),
    RpcMethodEntry::new("code_prompt_library_move"),
    RpcMethodEntry::new("code_threads_list"),
    RpcMethodEntry::new("code_thread_create"),
    RpcMethodEntry::new("code_thread_resume"),
    RpcMethodEntry::new("code_thread_archive"),
    RpcMethodEntry::new("code_thread_live_subscribe"),
    RpcMethodEntry::new("code_thread_live_unsubscribe"),
    RpcMethodEntry::new("code_turn_send"),
    RpcMethodEntry::new("code_turn_interrupt"),
    RpcMethodEntry::new("code_runtime_run_prepare_v2"),
    RpcMethodEntry::new("code_runtime_run_start"),
    RpcMethodEntry::new("code_runtime_run_start_v2"),
    RpcMethodEntry::new("code_runtime_run_cancel"),
    RpcMethodEntry::new("code_runtime_run_resume"),
    RpcMethodEntry::new("code_runtime_run_resume_v2"),
    RpcMethodEntry::new("code_runtime_run_intervene"),
    RpcMethodEntry::new("code_runtime_run_intervene_v2"),
    RpcMethodEntry::new("code_runtime_run_subscribe"),
    RpcMethodEntry::new("code_runtime_run_get_v2"),
    RpcMethodEntry::new("code_runtime_run_subscribe_v2"),
    RpcMethodEntry::new("code_runtime_review_get_v2"),
    RpcMethodEntry::new("code_runtime_runs_list"),
    RpcMethodEntry::new("code_kernel_job_start_v3"),
    RpcMethodEntry::new("code_kernel_job_get_v3"),
    RpcMethodEntry::new("code_kernel_job_cancel_v3"),
    RpcMethodEntry::new("code_kernel_job_resume_v3"),
    RpcMethodEntry::new("code_kernel_job_intervene_v3"),
    RpcMethodEntry::new("code_kernel_job_subscribe_v3"),
    RpcMethodEntry::new("code_kernel_job_callback_register_v3"),
    RpcMethodEntry::new("code_kernel_job_callback_remove_v3"),
    RpcMethodEntry::new("code_sub_agent_spawn"),
    RpcMethodEntry::new("code_sub_agent_send"),
    RpcMethodEntry::new("code_sub_agent_wait"),
    RpcMethodEntry::new("code_sub_agent_status"),
    RpcMethodEntry::new("code_sub_agent_interrupt"),
    RpcMethodEntry::new("code_sub_agent_close"),
    RpcMethodEntry::new("code_runtime_run_checkpoint_approval"),
    RpcMethodEntry::new("code_runtime_tool_preflight_v2"),
    RpcMethodEntry::new("code_action_required_submit_v2"),
    RpcMethodEntry::new("code_action_required_get_v2"),
    RpcMethodEntry::new("code_runtime_tool_outcome_record_v2"),
    RpcMethodEntry::new("code_runtime_policy_get_v2"),
    RpcMethodEntry::new("code_runtime_policy_set_v2"),
    RpcMethodEntry::new("code_kernel_capabilities_list_v2"),
    RpcMethodEntry::new("code_kernel_sessions_list_v2"),
    RpcMethodEntry::new("code_kernel_jobs_list_v2"),
    RpcMethodEntry::new("code_kernel_context_snapshot_v2"),
    RpcMethodEntry::new("code_kernel_extensions_list_v2"),
    RpcMethodEntry::new("code_kernel_policies_evaluate_v2"),
    RpcMethodEntry::new("code_kernel_projection_bootstrap_v3"),
    RpcMethodEntry::new("code_runtime_backends_list"),
    RpcMethodEntry::new("code_runtime_backend_upsert"),
    RpcMethodEntry::new("code_runtime_backend_remove"),
    RpcMethodEntry::new("code_runtime_backend_set_state"),
    RpcMethodEntry::new("code_acp_integrations_list"),
    RpcMethodEntry::new("code_acp_integration_upsert"),
    RpcMethodEntry::new("code_acp_integration_remove"),
    RpcMethodEntry::new("code_acp_integration_set_state"),
    RpcMethodEntry::new("code_acp_integration_probe"),
    RpcMethodEntry::new("code_distributed_task_graph"),
    RpcMethodEntry::new("code_runtime_tool_metrics_record"),
    RpcMethodEntry::new("code_runtime_tool_metrics_read"),
    RpcMethodEntry::new("code_runtime_tool_metrics_reset"),
    RpcMethodEntry::new("code_runtime_tool_guardrail_evaluate"),
    RpcMethodEntry::new("code_runtime_tool_guardrail_record_outcome"),
    RpcMethodEntry::new("code_runtime_tool_guardrail_read"),
    RpcMethodEntry::new("code_terminal_open"),
    RpcMethodEntry::new("code_terminal_write"),
    RpcMethodEntry::new("code_terminal_input_raw"),
    RpcMethodEntry::new("code_terminal_read"),
    RpcMethodEntry::new("code_terminal_stream_start"),
    RpcMethodEntry::new("code_terminal_stream_stop"),
    RpcMethodEntry::new("code_terminal_interrupt"),
    RpcMethodEntry::new("code_terminal_resize"),
    RpcMethodEntry::new("code_terminal_close"),
    RpcMethodEntry::new("code_cli_sessions_list"),
    RpcMethodEntry::new("code_oauth_accounts_list"),
    RpcMethodEntry::new("code_oauth_account_upsert"),
    RpcMethodEntry::new("code_oauth_account_remove"),
    RpcMethodEntry::new("code_oauth_primary_account_get"),
    RpcMethodEntry::new("code_oauth_primary_account_set"),
    RpcMethodEntry::new("code_oauth_pools_list"),
    RpcMethodEntry::new("code_oauth_pool_upsert"),
    RpcMethodEntry::new("code_oauth_pool_remove"),
    RpcMethodEntry::new("code_oauth_pool_members_list"),
    RpcMethodEntry::new("code_oauth_pool_apply"),
    RpcMethodEntry::new("code_oauth_pool_members_replace"),
    RpcMethodEntry::new("code_oauth_pool_select"),
    RpcMethodEntry::new("code_oauth_pool_account_bind"),
    RpcMethodEntry::new("code_oauth_rate_limit_report"),
    RpcMethodEntry::new("code_oauth_chatgpt_auth_tokens_refresh"),
    RpcMethodEntry::new("code_oauth_codex_login_start"),
    RpcMethodEntry::new("code_oauth_codex_login_cancel"),
    RpcMethodEntry::new("code_oauth_codex_accounts_import_from_cockpit_tools"),
    RpcMethodEntry::new("code_live_skills_list"),
    RpcMethodEntry::new("code_live_skill_execute"),
    RpcMethodEntry::new("code_codex_exec_run_v1"),
    RpcMethodEntry::new("code_codex_cloud_tasks_list_v1"),
    RpcMethodEntry::new("code_codex_config_path_get_v1"),
    RpcMethodEntry::new("code_codex_doctor_v1"),
    RpcMethodEntry::new("code_codex_update_v1"),
    RpcMethodEntry::new("code_collaboration_modes_list_v1"),
    RpcMethodEntry::new("code_apps_list_v1"),
    RpcMethodEntry::new("code_mcp_server_status_list_v1"),
    RpcMethodEntry::new("code_browser_debug_status_v1"),
    RpcMethodEntry::new("code_browser_debug_run_v1"),
    RpcMethodEntry::new("code_extensions_list_v1"),
    RpcMethodEntry::new("code_extension_install_v1"),
    RpcMethodEntry::new("code_extension_remove_v1"),
    RpcMethodEntry::new("code_extension_tools_list_v1"),
    RpcMethodEntry::new("code_extension_resource_read_v1"),
    RpcMethodEntry::new("code_extensions_config_v1"),
    RpcMethodEntry::new("code_session_export_v1"),
    RpcMethodEntry::new("code_session_import_v1"),
    RpcMethodEntry::new("code_session_delete_v1"),
    RpcMethodEntry::new("code_thread_snapshots_get_v1"),
    RpcMethodEntry::new("code_thread_snapshots_set_v1"),
    RpcMethodEntry::new("code_security_preflight_v1"),
    RpcMethodEntry::new("code_runtime_diagnostics_export_v1"),
];

const RPC_CAPABILITY_PROFILE_FULL_RUNTIME: &str = "full-runtime";
fn rpc_invocation_capabilities_payload() -> Value {
    json!({
        "rpc": {
            "invocationPolicies": {
                "code_turn_send": {
                    "completionMode": "events",
                    "ackTimeoutMs": RPC_TURN_SEND_ACK_TIMEOUT_MS,
                },
            },
        },
    })
}

pub(super) fn resolve_rpc_method(method: &str) -> Option<&'static str> {
    let method = method.trim();
    if let Some(code_candidate) = crate::native_runtime::native_rpc_alias_to_code_candidate(method)
    {
        if let Some(entry) = RPC_METHOD_REGISTRY
            .iter()
            .find(|entry| code_candidate == entry.method)
        {
            return Some(entry.method);
        }
    }
    RPC_METHOD_REGISTRY
        .iter()
        .find(|entry| method == entry.method)
        .map(|entry| entry.method)
}

pub(super) fn list_rpc_method_capabilities() -> Vec<String> {
    let mut methods = Vec::with_capacity(RPC_METHOD_REGISTRY.len());
    for entry in RPC_METHOD_REGISTRY {
        methods.push(entry.method.to_string());
    }
    methods.sort_unstable();
    methods.dedup();
    methods
}

pub(super) fn list_native_rpc_method_capabilities() -> Vec<String> {
    let mut methods = list_native_alias_rpc_method_capabilities();
    methods.extend(list_native_only_rpc_method_capabilities());
    methods.sort_unstable();
    methods.dedup();
    methods
}

fn list_native_alias_rpc_method_capabilities() -> Vec<String> {
    let methods = list_rpc_method_capabilities();
    crate::native_runtime::map_rpc_methods_to_native_namespace(methods.as_slice())
}

fn list_native_only_rpc_method_capabilities() -> Vec<String> {
    crate::native_runtime::NATIVE_ONLY_RPC_METHODS
        .iter()
        .map(|entry| (*entry).to_string())
        .collect()
}

pub(super) fn hash_rpc_method_capabilities(methods: &[String]) -> String {
    const FNV_OFFSET_BASIS: u64 = 0xcbf29ce484222325;
    const FNV_PRIME: u64 = 0x100000001b3;

    let mut hash = FNV_OFFSET_BASIS;
    for method in methods {
        for byte in method.as_bytes() {
            hash ^= u64::from(*byte);
            hash = hash.wrapping_mul(FNV_PRIME);
        }
        hash ^= 0xff;
        hash = hash.wrapping_mul(FNV_PRIME);
    }
    format!("{hash:016x}")
}

pub(super) fn rpc_transport_catalog_payload() -> Value {
    json!({
        "rpc": {
            "channel": "rpc",
            "endpointPath": CODE_RUNTIME_RPC_TRANSPORT_RPC_PATH,
            "protocol": CODE_RUNTIME_RPC_TRANSPORT_RPC_PROTOCOL,
            "replay": {
                "mode": "none",
                "key": Value::Null,
            },
        },
        "events": {
            "channel": "events",
            "endpointPath": CODE_RUNTIME_RPC_TRANSPORT_EVENTS_PATH,
            "protocol": CODE_RUNTIME_RPC_TRANSPORT_EVENTS_PROTOCOL,
            "replay": {
                "mode": "header",
                "key": CODE_RUNTIME_RPC_TRANSPORT_REPLAY_HEADER,
            },
        },
        "ws": {
            "channel": "duplex",
            "endpointPath": CODE_RUNTIME_RPC_TRANSPORT_WS_PATH,
            "protocol": CODE_RUNTIME_RPC_TRANSPORT_WS_PROTOCOL,
            "replay": {
                "mode": "query",
                "key": CODE_RUNTIME_RPC_TRANSPORT_REPLAY_QUERY,
            },
        },
    })
}

pub(super) fn rpc_capabilities_payload() -> Value {
    let methods = list_rpc_method_capabilities();
    let method_set_hash = hash_rpc_method_capabilities(methods.as_slice());
    let error_codes: BTreeMap<String, String> = CODE_RUNTIME_RPC_ERROR_CODES
        .iter()
        .map(|(code, value)| ((*code).to_string(), (*value).to_string()))
        .collect();
    json!({
        "profile": RPC_CAPABILITY_PROFILE_FULL_RUNTIME,
        "contractVersion": CODE_RUNTIME_RPC_CONTRACT_VERSION,
        "freezeEffectiveAt": CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT,
        "methodSetHash": method_set_hash,
        "methods": methods,
        "features": CODE_RUNTIME_RPC_FEATURES,
        "errorCodes": error_codes,
        "transports": rpc_transport_catalog_payload(),
        "capabilities": rpc_invocation_capabilities_payload(),
    })
}

fn native_rpc_capabilities_payload() -> Value {
    let alias_methods = list_native_alias_rpc_method_capabilities();
    let native_only_methods = list_native_only_rpc_method_capabilities();
    let methods = list_native_rpc_method_capabilities();
    let method_set_hash = hash_rpc_method_capabilities(methods.as_slice());
    let error_codes: BTreeMap<String, String> = CODE_RUNTIME_RPC_ERROR_CODES
        .iter()
        .map(|(code, value)| ((*code).to_string(), (*value).to_string()))
        .collect();
    let mut features = CODE_RUNTIME_RPC_FEATURES
        .iter()
        .map(|entry| (*entry).to_string())
        .collect::<Vec<_>>();
    features.push("native_rpc_namespace_v1".to_string());
    features.push("native_state_fabric_v1".to_string());
    features.push("native_capability_schema_v2".to_string());
    features.sort_unstable();
    features.dedup();
    json!({
        "namespace": "native",
        "profile": RPC_CAPABILITY_PROFILE_FULL_RUNTIME,
        "contractVersion": CODE_RUNTIME_RPC_CONTRACT_VERSION,
        "freezeEffectiveAt": CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT,
        "methodSetHash": method_set_hash,
        "methods": methods,
        "features": features,
        "errorCodes": error_codes,
        "transports": rpc_transport_catalog_payload(),
        "eventMethods": crate::native_runtime::NATIVE_RUNTIME_EVENT_METHODS,
        "methodSets": {
            "aliasNativeMethods": alias_methods,
            "nativeOnlyMethods": native_only_methods,
        },
        "capabilities": {
            "rpc": {
                "invocationPolicies": {
                    "code_turn_send": {
                        "completionMode": "events",
                        "ackTimeoutMs": RPC_TURN_SEND_ACK_TIMEOUT_MS,
                    },
                },
            },
            "nativeCapabilitySchemaVersion": "v2",
            "uiLayers": {
                "sidebar": true,
                "timeline": true,
                "composer": true,
                "managementCenter": true,
                "reviewPanel": true,
                "utilityPanel": true,
            },
            "voice": {
                "vad": true,
                "transcription": true,
                "globalHotkey": true,
            },
            "workflow": {
                "workMode": true,
                "parallelTasks": true,
                "approvals": true,
                "resume": true,
            },
            "tooling": {
                "plugins": true,
                "tools": true,
                "skills": true,
            },
            "fallback": {
                "threadLive": "polling",
                "runtimeOffline": "degraded",
            },
        },
    })
}

pub(super) fn rpc_capabilities_payload_for_requested_method(requested_method: &str) -> Value {
    if crate::native_runtime::method_uses_native_namespace(requested_method) {
        return native_rpc_capabilities_payload();
    }
    rpc_capabilities_payload()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn advertised_methods_include_only_canonical_names() {
        let methods = list_rpc_method_capabilities();

        assert!(methods
            .iter()
            .any(|method| method == "code_oauth_pool_apply"));
        assert!(methods
            .iter()
            .any(|method| method == "code_runtime_run_start"));
        assert!(methods
            .iter()
            .any(|method| method == "code_kernel_job_start_v3"));
        assert!(methods
            .iter()
            .any(|method| method == "code_runtime_run_checkpoint_approval"));
        assert!(methods
            .iter()
            .any(|method| method == "code_oauth_codex_accounts_import_from_cockpit_tools"));
        assert!(!methods
            .iter()
            .any(|method| method == "code_agent_task_start"));
        assert!(!methods
            .iter()
            .any(|method| method == "code_approval_decision"));
        assert!(methods.iter().all(|method| method != "oauth_pool_apply"));
    }

    #[test]
    fn retired_run_aliases_are_not_resolved() {
        assert_eq!(resolve_rpc_method("code_agent_task_start"), None);
        assert_eq!(resolve_rpc_method("code_agent_task_status"), None);
        assert_eq!(resolve_rpc_method("code_approval_decision"), None);
    }

    #[test]
    fn unrelated_legacy_aliases_are_not_resolved() {
        assert_eq!(resolve_rpc_method("oauth_pool_apply"), None);
    }
}
