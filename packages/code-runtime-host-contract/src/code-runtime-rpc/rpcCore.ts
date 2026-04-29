export const CODE_RUNTIME_RPC_INVOCATION_COMPLETION_MODES = Object.freeze({
  RPC: "rpc",
  EVENTS: "events",
} as const);

export type CodeRuntimeRpcInvocationCompletionMode =
  (typeof CODE_RUNTIME_RPC_INVOCATION_COMPLETION_MODES)[keyof typeof CODE_RUNTIME_RPC_INVOCATION_COMPLETION_MODES];

export type CodeRuntimeRpcInvocationPolicy = {
  completionMode: CodeRuntimeRpcInvocationCompletionMode;
  ackTimeoutMs?: number | null;
};

export type CodeRuntimeRpcCapabilitiesMetadata = {
  rpc?: {
    invocationPolicies?: Record<string, CodeRuntimeRpcInvocationPolicy>;
  };
};

export const CODE_RUNTIME_RPC_CAPABILITY_PROFILES = Object.freeze({
  FULL_RUNTIME: "full-runtime",
  DESKTOP_CORE: "desktop-core",
} as const);

export type CodeRuntimeRpcCapabilityProfile =
  | (typeof CODE_RUNTIME_RPC_CAPABILITY_PROFILES)[keyof typeof CODE_RUNTIME_RPC_CAPABILITY_PROFILES]
  | (string & {});

export const CODE_RUNTIME_RPC_METHODS = {
  RPC_CAPABILITIES: "code_rpc_capabilities",
  HEALTH: "code_health",
  SETTINGS_SUMMARY: "code_settings_summary",
  APP_SETTINGS_GET: "code_app_settings_get",
  APP_SETTINGS_UPDATE: "code_app_settings_update",
  TEXT_FILE_READ_V1: "code_text_file_read_v1",
  TEXT_FILE_WRITE_V1: "code_text_file_write_v1",
  REMOTE_STATUS: "code_remote_status",
  TERMINAL_STATUS: "code_terminal_status",
  MODELS_POOL: "code_models_pool",
  PROVIDERS_CATALOG: "code_providers_catalog",
  HUGEROUTER_COMMERCIAL_SERVICE_READ: "code_hugerouter_commercial_service_read",
  HUGEROUTER_ROUTE_TOKEN_ISSUE: "code_hugerouter_route_token_issue",
  WORKSPACES_LIST: "code_workspaces_list",
  BOOTSTRAP_SNAPSHOT: "code_bootstrap_snapshot",
  MISSION_CONTROL_SNAPSHOT_V1: "code_mission_control_snapshot_v1",
  RPC_BATCH: "code_rpc_batch",
  WORKSPACE_PICK_DIRECTORY: "code_workspace_pick_directory",
  WORKSPACE_CREATE: "code_workspace_create",
  WORKSPACE_RENAME: "code_workspace_rename",
  WORKSPACE_REMOVE: "code_workspace_remove",
  WORKSPACE_FILES_LIST: "code_workspace_files_list",
  WORKSPACE_FILE_READ: "code_workspace_file_read",
  WORKSPACE_DIAGNOSTICS_LIST_V1: "code_workspace_diagnostics_list_v1",
  WORKSPACE_PATCH_APPLY_V1: "code_workspace_patch_apply_v1",
  GIT_CHANGES_LIST: "code_git_changes_list",
  GIT_DIFF_READ: "code_git_diff_read",
  GIT_BRANCHES_LIST: "code_git_branches_list",
  GIT_BRANCH_CREATE: "code_git_branch_create",
  GIT_BRANCH_CHECKOUT: "code_git_branch_checkout",
  GIT_LOG: "code_git_log",
  GIT_STAGE_CHANGE: "code_git_stage_change",
  GIT_STAGE_ALL: "code_git_stage_all",
  GIT_UNSTAGE_CHANGE: "code_git_unstage_change",
  GIT_REVERT_CHANGE: "code_git_revert_change",
  GIT_COMMIT: "code_git_commit",
  PROMPT_LIBRARY_LIST: "code_prompt_library_list",
  PROMPT_LIBRARY_CREATE: "code_prompt_library_create",
  PROMPT_LIBRARY_UPDATE: "code_prompt_library_update",
  PROMPT_LIBRARY_DELETE: "code_prompt_library_delete",
  PROMPT_LIBRARY_MOVE: "code_prompt_library_move",
  THREADS_LIST: "code_threads_list",
  THREAD_CREATE: "code_thread_create",
  THREAD_RESUME: "code_thread_resume",
  THREAD_ARCHIVE: "code_thread_archive",
  THREAD_LIVE_SUBSCRIBE: "code_thread_live_subscribe",
  THREAD_LIVE_UNSUBSCRIBE: "code_thread_live_unsubscribe",
  TURN_SEND: "code_turn_send",
  TURN_INTERRUPT: "code_turn_interrupt",
  TASK_SOURCE_INGEST_V1: "code_task_source_ingest_v1",
  TASK_SOURCE_GET_V1: "code_task_source_get_v1",
  TASK_SOURCE_LIST_V1: "code_task_source_list_v1",
  TASK_SOURCE_RECONCILE_V1: "code_task_source_reconcile_v1",
  RUN_PREPARE_V2: "code_runtime_run_prepare_v2",
  RUN_START_V2: "code_runtime_run_start_v2",
  RUN_CANCEL_V2: "code_runtime_run_cancel_v2",
  RUN_RESUME_V2: "code_runtime_run_resume_v2",
  RUN_INTERVENE_V2: "code_runtime_run_intervene_v2",
  RUN_GET_V2: "code_runtime_run_get_v2",
  RUN_SUBSCRIBE_V2: "code_runtime_run_subscribe_v2",
  REVIEW_GET_V2: "code_runtime_review_get_v2",
  RUNS_LIST: "code_runtime_runs_list",
  SUB_AGENT_SPAWN: "code_sub_agent_spawn",
  SUB_AGENT_SEND: "code_sub_agent_send",
  SUB_AGENT_WAIT: "code_sub_agent_wait",
  SUB_AGENT_STATUS: "code_sub_agent_status",
  SUB_AGENT_INTERRUPT: "code_sub_agent_interrupt",
  SUB_AGENT_CLOSE: "code_sub_agent_close",
  RUN_CHECKPOINT_APPROVAL: "code_runtime_run_checkpoint_approval",
  RUNTIME_TOOL_PREFLIGHT_V2: "code_runtime_tool_preflight_v2",
  ACTION_REQUIRED_SUBMIT_V2: "code_action_required_submit_v2",
  ACTION_REQUIRED_GET_V2: "code_action_required_get_v2",
  RUNTIME_TOOL_OUTCOME_RECORD_V2: "code_runtime_tool_outcome_record_v2",
  RUNTIME_POLICY_GET_V2: "code_runtime_policy_get_v2",
  RUNTIME_POLICY_SET_V2: "code_runtime_policy_set_v2",
  KERNEL_CAPABILITIES_LIST_V2: "code_kernel_capabilities_list_v2",
  KERNEL_SESSIONS_LIST_V2: "code_kernel_sessions_list_v2",
  KERNEL_JOBS_LIST_V2: "code_kernel_jobs_list_v2",
  KERNEL_CONTEXT_SNAPSHOT_V2: "code_kernel_context_snapshot_v2",
  KERNEL_EXTENSIONS_LIST_V2: "code_kernel_extensions_list_v2",
  KERNEL_POLICIES_EVALUATE_V2: "code_kernel_policies_evaluate_v2",
  KERNEL_PROJECTION_BOOTSTRAP_V3: "code_kernel_projection_bootstrap_v3",
  COMPOSITION_PROFILE_LIST_V2: "code_runtime_composition_profile_list_v2",
  COMPOSITION_PROFILE_GET_V2: "code_runtime_composition_profile_get_v2",
  COMPOSITION_PROFILE_RESOLVE_V2: "code_runtime_composition_profile_resolve_v2",
  COMPOSITION_SNAPSHOT_PUBLISH_V1: "code_runtime_composition_snapshot_publish_v1",
  RUNTIME_INVOCATION_HOSTS_LIST_V1: "code_runtime_invocation_hosts_list_v1",
  RUNTIME_INVOCATION_DISPATCH_V1: "code_runtime_invocation_dispatch_v1",
  RUNTIME_BACKENDS_LIST: "code_runtime_backends_list",
  RUNTIME_BACKEND_UPSERT: "code_runtime_backend_upsert",
  RUNTIME_BACKEND_REMOVE: "code_runtime_backend_remove",
  RUNTIME_BACKEND_SET_STATE: "code_runtime_backend_set_state",
  ACP_INTEGRATIONS_LIST: "code_acp_integrations_list",
  ACP_INTEGRATION_UPSERT: "code_acp_integration_upsert",
  ACP_INTEGRATION_REMOVE: "code_acp_integration_remove",
  ACP_INTEGRATION_SET_STATE: "code_acp_integration_set_state",
  ACP_INTEGRATION_PROBE: "code_acp_integration_probe",
  DISTRIBUTED_TASK_GRAPH: "code_distributed_task_graph",
  RUNTIME_TOOL_METRICS_RECORD: "code_runtime_tool_metrics_record",
  RUNTIME_TOOL_METRICS_READ: "code_runtime_tool_metrics_read",
  RUNTIME_TOOL_METRICS_RESET: "code_runtime_tool_metrics_reset",
  RUNTIME_TOOL_GUARDRAIL_EVALUATE: "code_runtime_tool_guardrail_evaluate",
  RUNTIME_TOOL_GUARDRAIL_RECORD_OUTCOME: "code_runtime_tool_guardrail_record_outcome",
  RUNTIME_TOOL_GUARDRAIL_READ: "code_runtime_tool_guardrail_read",
  TERMINAL_OPEN: "code_terminal_open",
  TERMINAL_WRITE: "code_terminal_write",
  TERMINAL_INPUT_RAW: "code_terminal_input_raw",
  TERMINAL_READ: "code_terminal_read",
  TERMINAL_STREAM_START: "code_terminal_stream_start",
  TERMINAL_STREAM_STOP: "code_terminal_stream_stop",
  TERMINAL_INTERRUPT: "code_terminal_interrupt",
  TERMINAL_RESIZE: "code_terminal_resize",
  TERMINAL_CLOSE: "code_terminal_close",
  CLI_SESSIONS_LIST: "code_cli_sessions_list",
  OAUTH_ACCOUNTS_LIST: "code_oauth_accounts_list",
  OAUTH_ACCOUNT_UPSERT: "code_oauth_account_upsert",
  OAUTH_ACCOUNT_REMOVE: "code_oauth_account_remove",
  OAUTH_PRIMARY_ACCOUNT_GET: "code_oauth_primary_account_get",
  OAUTH_PRIMARY_ACCOUNT_SET: "code_oauth_primary_account_set",
  OAUTH_POOLS_LIST: "code_oauth_pools_list",
  OAUTH_POOL_UPSERT: "code_oauth_pool_upsert",
  OAUTH_POOL_REMOVE: "code_oauth_pool_remove",
  OAUTH_POOL_MEMBERS_LIST: "code_oauth_pool_members_list",
  OAUTH_POOL_APPLY: "code_oauth_pool_apply",
  OAUTH_POOL_MEMBERS_REPLACE: "code_oauth_pool_members_replace",
  OAUTH_POOL_SELECT: "code_oauth_pool_select",
  OAUTH_POOL_ACCOUNT_BIND: "code_oauth_pool_account_bind",
  OAUTH_RATE_LIMIT_REPORT: "code_oauth_rate_limit_report",
  OAUTH_CHATGPT_AUTH_TOKENS_REFRESH: "code_oauth_chatgpt_auth_tokens_refresh",
  OAUTH_CODEX_LOGIN_START: "code_oauth_codex_login_start",
  OAUTH_CODEX_LOGIN_CANCEL: "code_oauth_codex_login_cancel",
  OAUTH_CODEX_ACCOUNTS_IMPORT_FROM_COCKPIT_TOOLS:
    "code_oauth_codex_accounts_import_from_cockpit_tools",
  LIVE_SKILLS_LIST: "code_live_skills_list",
  LIVE_SKILL_EXECUTE: "code_live_skill_execute",
  CODEX_EXEC_RUN_V1: "code_codex_exec_run_v1",
  CODEX_CLOUD_TASKS_LIST_V1: "code_codex_cloud_tasks_list_v1",
  CODEX_CONFIG_PATH_GET_V1: "code_codex_config_path_get_v1",
  CODEX_DOCTOR_V1: "code_codex_doctor_v1",
  CODEX_UPDATE_V1: "code_codex_update_v1",
  COLLABORATION_MODES_LIST_V1: "code_collaboration_modes_list_v1",
  MCP_SERVER_STATUS_LIST_V1: "code_mcp_server_status_list_v1",
  BROWSER_DEBUG_STATUS_V1: "code_browser_debug_status_v1",
  BROWSER_DEBUG_RUN_V1: "code_browser_debug_run_v1",
  MINI_PROGRAM_STATUS_V1: "code_mini_program_status_v1",
  MINI_PROGRAM_RUN_V1: "code_mini_program_run_v1",
  EXTENSION_CATALOG_LIST_V2: "code_extension_catalog_list_v2",
  EXTENSION_GET_V2: "code_extension_get_v2",
  EXTENSION_INSTALL_V2: "code_extension_install_v2",
  EXTENSION_UPDATE_V2: "code_extension_update_v2",
  EXTENSION_SET_STATE_V2: "code_extension_set_state_v2",
  EXTENSION_REMOVE_V2: "code_extension_remove_v2",
  EXTENSION_REGISTRY_SEARCH_V2: "code_extension_registry_search_v2",
  EXTENSION_REGISTRY_SOURCES_V2: "code_extension_registry_sources_v2",
  EXTENSION_PERMISSIONS_EVALUATE_V2: "code_extension_permissions_evaluate_v2",
  EXTENSION_HEALTH_READ_V2: "code_extension_health_read_v2",
  EXTENSION_TOOLS_LIST_V2: "code_extension_tools_list_v2",
  EXTENSION_TOOL_INVOKE_V2: "code_extension_tool_invoke_v2",
  EXTENSION_RESOURCE_READ_V2: "code_extension_resource_read_v2",
  SESSION_EXPORT_V1: "code_session_export_v1",
  SESSION_IMPORT_V1: "code_session_import_v1",
  SESSION_DELETE_V1: "code_session_delete_v1",
  THREAD_SNAPSHOTS_GET_V1: "code_thread_snapshots_get_v1",
  THREAD_SNAPSHOTS_SET_V1: "code_thread_snapshots_set_v1",
  SECURITY_PREFLIGHT_V1: "code_security_preflight_v1",
  RUNTIME_DIAGNOSTICS_EXPORT_V1: "code_runtime_diagnostics_export_v1",
} as const;

export const CODE_RUNTIME_CANONICAL_MISSION_LAUNCH_METHODS = [
  CODE_RUNTIME_RPC_METHODS.RUN_PREPARE_V2,
  CODE_RUNTIME_RPC_METHODS.RUN_START_V2,
] as const;

export const CODE_RUNTIME_CANONICAL_RUN_LIFECYCLE_METHODS = [
  CODE_RUNTIME_RPC_METHODS.RUN_PREPARE_V2,
  CODE_RUNTIME_RPC_METHODS.RUN_START_V2,
  CODE_RUNTIME_RPC_METHODS.RUN_GET_V2,
  CODE_RUNTIME_RPC_METHODS.RUN_SUBSCRIBE_V2,
  CODE_RUNTIME_RPC_METHODS.REVIEW_GET_V2,
  CODE_RUNTIME_RPC_METHODS.RUN_CANCEL_V2,
  CODE_RUNTIME_RPC_METHODS.RUN_RESUME_V2,
  CODE_RUNTIME_RPC_METHODS.RUN_INTERVENE_V2,
  CODE_RUNTIME_RPC_METHODS.RUNS_LIST,
  CODE_RUNTIME_RPC_METHODS.RUN_CHECKPOINT_APPROVAL,
] as const;

/**
 * Compatibility-only thread/turn lifecycle surface.
 *
 * These methods remain valid for thread-specific conversational flows, but
 * they are not the canonical product lifecycle for launch, resume, intervene,
 * or review-follow-up work.
 */
export const CODE_RUNTIME_COMPAT_THREAD_TURN_METHODS = [
  CODE_RUNTIME_RPC_METHODS.THREADS_LIST,
  CODE_RUNTIME_RPC_METHODS.THREAD_CREATE,
  CODE_RUNTIME_RPC_METHODS.THREAD_RESUME,
  CODE_RUNTIME_RPC_METHODS.THREAD_ARCHIVE,
  CODE_RUNTIME_RPC_METHODS.THREAD_LIVE_SUBSCRIBE,
  CODE_RUNTIME_RPC_METHODS.THREAD_LIVE_UNSUBSCRIBE,
  CODE_RUNTIME_RPC_METHODS.TURN_SEND,
  CODE_RUNTIME_RPC_METHODS.TURN_INTERRUPT,
] as const;

export type CodeRuntimeRpcMethod =
  (typeof CODE_RUNTIME_RPC_METHODS)[keyof typeof CODE_RUNTIME_RPC_METHODS];

export const CODE_RUNTIME_RPC_METHOD_LIST = Object.freeze(
  Object.values(CODE_RUNTIME_RPC_METHODS)
) as readonly CodeRuntimeRpcMethod[];

export const CODE_RUNTIME_RPC_FEATURES = Object.freeze([
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
  "runtime_invocation_host_registry_v1",
  "runtime_codex_execpolicy_preflight_v1",
  "runtime_codex_unified_rpc_migration_v1",
  "hugerouter_commercial_service_v1",
  "runtime_host_deprecated",
  "app_server_protocol_v2_2026_03_25",
  "contract_frozen_2026_03_25",
]) as readonly string[];

export const CODE_RUNTIME_RPC_TRANSPORTS = Object.freeze({
  rpc: {
    channel: "rpc",
    endpointPath: "/rpc",
    protocol: "json-rpc-over-http-v1",
    replay: {
      mode: "none",
      key: null,
    },
  },
  events: {
    channel: "events",
    endpointPath: "/events",
    protocol: "sse-v1",
    replay: {
      mode: "header",
      key: "Last-Event-ID",
    },
  },
  ws: {
    channel: "duplex",
    endpointPath: "/ws",
    protocol: "runtime-ws-v1",
    replay: {
      mode: "query",
      key: "lastEventId",
    },
  },
} as const);

export type CodeRuntimeRpcTransports = typeof CODE_RUNTIME_RPC_TRANSPORTS;

export type CodeRuntimeRpcCapabilities = {
  profile?: CodeRuntimeRpcCapabilityProfile;
  contractVersion: string;
  freezeEffectiveAt: string;
  methodSetHash: string;
  methods: string[];
  features: string[];
  errorCodes: Record<string, string>;
  transports?: CodeRuntimeRpcTransports;
  capabilities?: CodeRuntimeRpcCapabilitiesMetadata;
};

export const CODE_RUNTIME_RPC_ERROR_CODES = {
  METHOD_NOT_FOUND: "METHOD_NOT_FOUND",
  INVALID_PARAMS: "INVALID_PARAMS",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type CodeRuntimeRpcErrorCode =
  (typeof CODE_RUNTIME_RPC_ERROR_CODES)[keyof typeof CODE_RUNTIME_RPC_ERROR_CODES];

export type CodeRuntimeRpcError = {
  code: CodeRuntimeRpcErrorCode | (string & {});
  message: string;
  details?: unknown;
};

export type CodeRuntimeRpcResponseEnvelope<Result> =
  | {
      ok: true;
      result: Result;
      error?: never;
    }
  | {
      ok: false;
      error: CodeRuntimeRpcError;
      result?: never;
    };

export type CodeRuntimeRpcEmptyParams = Record<string, never>;

export const CODE_RUNTIME_RPC_EMPTY_PARAMS: CodeRuntimeRpcEmptyParams = Object.freeze({});
