import type {
  AccessMode,
  AcpIntegrationProbeRequest,
  AcpIntegrationSetStateRequest,
  AcpIntegrationTransportConfig,
  AcpIntegrationUpsertInput,
  AgentTaskAutoDriveState,
  AgentTaskExecutionMode,
  AgentTaskSourceKind,
  AgentTaskStepInput,
  DistributedTaskGraphRequest,
  ReasonEffort,
  RuntimeBackendRolloutState,
  RuntimeBackendSetStateRequest,
  RuntimeBackendUpsertInput,
  RuntimeReviewGetV2Request,
  RuntimeRpcBatchRequest,
  RuntimeRunCancelRequest,
  RuntimeRunCheckpointApprovalRequest,
  RuntimeRunGetV2Request,
  RuntimeRunInterventionRequest,
  RuntimeRunPrepareV2Request,
  RuntimeRunResumeRequest,
  RuntimeRunsListRequest,
  RuntimeRunStartRequest,
  RuntimeTaskSourceGetRequest,
  RuntimeTaskSourceIngestRequest,
  RuntimeTaskSourceListRequest,
  RuntimeTaskSourceReconcileRequest,
  SubAgentCloseRequest,
  SubAgentInterruptRequest,
  SubAgentSendRequest,
  SubAgentSpawnRequest,
  SubAgentStatusRequest,
  SubAgentWaitRequest,
  WorkspaceDiagnosticsListRequest,
  WorkspacePatchApplyRequest,
} from "../codeRuntimeRpc.js";
import type {
  OAuthAccountUpsertInput,
  OAuthChatgptAuthTokensRefreshRequest,
  OAuthCodexLoginCancelRequest,
  OAuthCodexLoginStartRequest,
  OAuthPoolAccountBindRequest,
  OAuthPoolApplyInput,
  OAuthPoolMemberInput,
  OAuthPoolSelectionRequest,
  OAuthPoolUpsertInput,
  OAuthPrimaryAccountSetInput,
  OAuthProviderId,
  OAuthRateLimitReportInput,
  OAuthStickyMode,
  OAuthUsageRefreshMode,
  PromptLibraryScope,
} from "./providersAndAuth.js";
import type {
  ActionRequiredSubmitRequest,
  KernelContextSnapshotRequest,
  KernelExtensionsListRequest,
  KernelJobsListRequest,
  KernelPoliciesEvaluateRequest,
  KernelProjectionBootstrapRequest,
  KernelSessionsListRequest,
  LiveSkillExecuteRequest,
  RuntimeBrowserDebugRunRequest,
  RuntimeBrowserDebugStatusRequest,
  RuntimeCodexCloudTasksListRequest,
  RuntimeCodexDoctorRequest,
  RuntimeCodexExecRunRequest,
  RuntimeCodexUpdateRequest,
  RuntimeDiagnosticsExportRequest,
  RuntimeDiagnosticsRedactionLevel,
  RuntimeExtensionCatalogListRequest,
  RuntimeExtensionGetRequest,
  RuntimeExtensionHealthReadRequest,
  RuntimeExtensionInstallRequest,
  RuntimeExtensionPermissionsEvaluateRequest,
  RuntimeExtensionRegistrySearchRequest,
  RuntimeExtensionRemoveRequest,
  RuntimeExtensionResourceReadRequest,
  RuntimeExtensionSetStateRequest,
  RuntimeExtensionToolsListRequest,
  RuntimeExtensionUiAppDescriptor,
  RuntimeExtensionUpdateRequest,
  RuntimeMcpServerStatusListRequest,
  RuntimePolicySetRequest,
  RuntimeSecurityPreflightRequest,
  RuntimeSessionDeleteRequest,
  RuntimeSessionExportRequest,
  RuntimeSessionImportRequest,
  RuntimeThreadSnapshotsGetRequest,
  RuntimeThreadSnapshotsSetRequest,
  RuntimeToolExecutionEvent,
  RuntimeToolExecutionMetricsReadRequest,
  RuntimeToolGuardrailEvaluateRequest,
  RuntimeToolGuardrailOutcomeEvent,
  RuntimeToolOutcomeRecordRequest,
  RuntimeToolPreflightV2Request,
} from "./runtimeFeatures.js";

import { CODE_RUNTIME_RPC_METHODS, type CodeRuntimeRpcEmptyParams } from "../codeRuntimeRpc.js";

import type {
  RuntimeAppSettingsUpdateRequest,
  RuntimeTextFileReadRequest,
  RuntimeTextFileWriteRequest,
  ThreadLiveSubscribeRequest,
  ThreadLiveUnsubscribeRequest,
  TurnInterruptRequestCompat,
  TurnSendRequestCompat,
} from "./payloadShared.js";

export interface CodeRuntimeRpcRequestPayloadByMethod {
  [CODE_RUNTIME_RPC_METHODS.RPC_CAPABILITIES]: CodeRuntimeRpcEmptyParams;
  [CODE_RUNTIME_RPC_METHODS.HEALTH]: CodeRuntimeRpcEmptyParams;
  [CODE_RUNTIME_RPC_METHODS.SETTINGS_SUMMARY]: CodeRuntimeRpcEmptyParams;
  [CODE_RUNTIME_RPC_METHODS.APP_SETTINGS_GET]: CodeRuntimeRpcEmptyParams;
  [CODE_RUNTIME_RPC_METHODS.APP_SETTINGS_UPDATE]: RuntimeAppSettingsUpdateRequest;
  [CODE_RUNTIME_RPC_METHODS.TEXT_FILE_READ_V1]: RuntimeTextFileReadRequest;
  [CODE_RUNTIME_RPC_METHODS.TEXT_FILE_WRITE_V1]: RuntimeTextFileWriteRequest;
  [CODE_RUNTIME_RPC_METHODS.REMOTE_STATUS]: CodeRuntimeRpcEmptyParams;
  [CODE_RUNTIME_RPC_METHODS.TERMINAL_STATUS]: CodeRuntimeRpcEmptyParams;
  [CODE_RUNTIME_RPC_METHODS.MODELS_POOL]: CodeRuntimeRpcEmptyParams;
  [CODE_RUNTIME_RPC_METHODS.PROVIDERS_CATALOG]: CodeRuntimeRpcEmptyParams;
  [CODE_RUNTIME_RPC_METHODS.WORKSPACES_LIST]: CodeRuntimeRpcEmptyParams;
  [CODE_RUNTIME_RPC_METHODS.BOOTSTRAP_SNAPSHOT]: CodeRuntimeRpcEmptyParams;
  [CODE_RUNTIME_RPC_METHODS.MISSION_CONTROL_SNAPSHOT_V1]: CodeRuntimeRpcEmptyParams;
  [CODE_RUNTIME_RPC_METHODS.RPC_BATCH]: RuntimeRpcBatchRequest;
  [CODE_RUNTIME_RPC_METHODS.WORKSPACE_PICK_DIRECTORY]: CodeRuntimeRpcEmptyParams;
  [CODE_RUNTIME_RPC_METHODS.WORKSPACE_CREATE]: {
    path: string;
    displayName: string | null;
    display_name?: string | null;
  };
  [CODE_RUNTIME_RPC_METHODS.WORKSPACE_RENAME]: {
    workspaceId: string;
    displayName: string;
    workspace_id?: string;
    display_name?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.WORKSPACE_REMOVE]: {
    workspaceId: string;
    workspace_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.WORKSPACE_FILES_LIST]: {
    workspaceId: string;
    workspace_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.WORKSPACE_FILE_READ]: {
    workspaceId: string;
    fileId: string;
    workspace_id?: string;
    file_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.WORKSPACE_DIAGNOSTICS_LIST_V1]: WorkspaceDiagnosticsListRequest & {
    workspace_id?: string;
    max_items?: number | null;
    include_provider_details?: boolean;
  };
  [CODE_RUNTIME_RPC_METHODS.WORKSPACE_PATCH_APPLY_V1]: WorkspacePatchApplyRequest & {
    workspace_id?: string;
    dry_run?: boolean | null;
  };
  [CODE_RUNTIME_RPC_METHODS.GIT_CHANGES_LIST]: {
    workspaceId: string;
    workspace_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.GIT_DIFF_READ]: {
    workspaceId: string;
    changeId: string;
    offset?: number;
    maxBytes?: number;
    workspace_id?: string;
    change_id?: string;
    max_bytes?: number;
  };
  [CODE_RUNTIME_RPC_METHODS.GIT_BRANCHES_LIST]: {
    workspaceId: string;
    workspace_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.GIT_BRANCH_CREATE]: {
    workspaceId: string;
    branchName: string;
    workspace_id?: string;
    branch_name?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.GIT_BRANCH_CHECKOUT]: {
    workspaceId: string;
    branchName: string;
    workspace_id?: string;
    branch_name?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.GIT_LOG]: {
    workspaceId: string;
    limit?: number;
    workspace_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.GIT_STAGE_CHANGE]: {
    workspaceId: string;
    changeId: string;
    workspace_id?: string;
    change_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.GIT_STAGE_ALL]: {
    workspaceId: string;
    workspace_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.GIT_UNSTAGE_CHANGE]: {
    workspaceId: string;
    changeId: string;
    workspace_id?: string;
    change_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.GIT_REVERT_CHANGE]: {
    workspaceId: string;
    changeId: string;
    workspace_id?: string;
    change_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.GIT_COMMIT]: {
    workspaceId: string;
    message: string;
    workspace_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.PROMPT_LIBRARY_LIST]: {
    workspaceId: string | null;
    workspace_id?: string | null;
  };
  [CODE_RUNTIME_RPC_METHODS.PROMPT_LIBRARY_CREATE]: {
    workspaceId: string | null;
    scope: PromptLibraryScope;
    title: string;
    description: string;
    content: string;
    workspace_id?: string | null;
  };
  [CODE_RUNTIME_RPC_METHODS.PROMPT_LIBRARY_UPDATE]: {
    workspaceId: string | null;
    promptId: string;
    title: string;
    description: string;
    content: string;
    workspace_id?: string | null;
    prompt_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.PROMPT_LIBRARY_DELETE]: {
    workspaceId: string | null;
    promptId: string;
    workspace_id?: string | null;
    prompt_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.PROMPT_LIBRARY_MOVE]: {
    workspaceId: string | null;
    promptId: string;
    targetScope: PromptLibraryScope;
    workspace_id?: string | null;
    prompt_id?: string;
    target_scope?: PromptLibraryScope;
  };
  [CODE_RUNTIME_RPC_METHODS.THREADS_LIST]: {
    workspaceId: string;
    workspace_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.THREAD_CREATE]: {
    workspaceId: string;
    title: string | null;
    workspace_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.THREAD_RESUME]: {
    workspaceId: string;
    threadId: string;
    workspace_id?: string;
    thread_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.THREAD_ARCHIVE]: {
    workspaceId: string;
    threadId: string;
    workspace_id?: string;
    thread_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.THREAD_LIVE_SUBSCRIBE]: ThreadLiveSubscribeRequest;
  [CODE_RUNTIME_RPC_METHODS.THREAD_LIVE_UNSUBSCRIBE]: ThreadLiveUnsubscribeRequest;
  [CODE_RUNTIME_RPC_METHODS.TURN_SEND]: {
    payload: TurnSendRequestCompat;
  };
  [CODE_RUNTIME_RPC_METHODS.TURN_INTERRUPT]: {
    payload: TurnInterruptRequestCompat;
  };
  [CODE_RUNTIME_RPC_METHODS.TASK_SOURCE_INGEST_V1]: RuntimeTaskSourceIngestRequest;
  [CODE_RUNTIME_RPC_METHODS.TASK_SOURCE_GET_V1]: RuntimeTaskSourceGetRequest & {
    source_record_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.TASK_SOURCE_LIST_V1]: RuntimeTaskSourceListRequest & {
    workspace_id?: string | null;
    source_kind?: AgentTaskSourceKind | null;
  };
  [CODE_RUNTIME_RPC_METHODS.TASK_SOURCE_RECONCILE_V1]: RuntimeTaskSourceReconcileRequest & {
    source_record_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.RUN_PREPARE_V2]: RuntimeRunPrepareV2Request & {
    workspace_id?: string;
    thread_id?: string | null;
    request_id?: string;
    model_id?: string | null;
    reason_effort?: ReasonEffort | null;
    access_mode?: AccessMode;
    execution_mode?: AgentTaskExecutionMode;
    preferred_backend_ids?: string[] | null;
    approved_plan_version?: string | null;
    auto_drive?: AgentTaskAutoDriveState | null;
    steps: Array<
      AgentTaskStepInput & {
        timeout_ms?: number | null;
        requires_approval?: boolean | null;
        approval_reason?: string | null;
      }
    >;
  };
  [CODE_RUNTIME_RPC_METHODS.RUN_START_V2]: RuntimeRunStartRequest & {
    workspace_id?: string;
    thread_id?: string | null;
    request_id?: string;
    model_id?: string | null;
    reason_effort?: ReasonEffort | null;
    access_mode?: AccessMode;
    execution_mode?: AgentTaskExecutionMode;
    preferred_backend_ids?: string[] | null;
    approved_plan_version?: string | null;
    auto_drive?: AgentTaskAutoDriveState | null;
    steps: Array<
      AgentTaskStepInput & {
        timeout_ms?: number | null;
        requires_approval?: boolean | null;
        approval_reason?: string | null;
      }
    >;
  };
  [CODE_RUNTIME_RPC_METHODS.RUN_CANCEL_V2]: RuntimeRunCancelRequest & {
    run_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.RUN_RESUME_V2]: RuntimeRunResumeRequest & {
    run_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.RUN_INTERVENE_V2]: RuntimeRunInterventionRequest & {
    run_id?: string;
    instruction_patch?: string | null;
    execution_profile_id?: string | null;
    preferred_backend_ids?: string[] | null;
    approved_plan_version?: string | null;
  };
  [CODE_RUNTIME_RPC_METHODS.RUN_GET_V2]: RuntimeRunGetV2Request & {
    run_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.RUN_SUBSCRIBE_V2]: RuntimeRunGetV2Request & {
    run_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.REVIEW_GET_V2]: RuntimeReviewGetV2Request & {
    run_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.RUNS_LIST]: RuntimeRunsListRequest & {
    workspace_id?: string | null;
  };
  [CODE_RUNTIME_RPC_METHODS.SUB_AGENT_SPAWN]: SubAgentSpawnRequest & {
    workspace_id?: string;
    thread_id?: string | null;
    access_mode?: AccessMode;
    reason_effort?: ReasonEffort | null;
    model_id?: string | null;
  };
  [CODE_RUNTIME_RPC_METHODS.SUB_AGENT_SEND]: SubAgentSendRequest & {
    session_id?: string;
    request_id?: string;
    requires_approval?: boolean;
    approval_reason?: string | null;
  };
  [CODE_RUNTIME_RPC_METHODS.SUB_AGENT_WAIT]: SubAgentWaitRequest & {
    session_id?: string;
    timeout_ms?: number | null;
    poll_interval_ms?: number | null;
  };
  [CODE_RUNTIME_RPC_METHODS.SUB_AGENT_STATUS]: SubAgentStatusRequest & {
    session_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.SUB_AGENT_INTERRUPT]: SubAgentInterruptRequest & {
    session_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.SUB_AGENT_CLOSE]: SubAgentCloseRequest & {
    session_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.RUN_CHECKPOINT_APPROVAL]: RuntimeRunCheckpointApprovalRequest & {
    run_id?: string | null;
    approval_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.RUNTIME_TOOL_PREFLIGHT_V2]: RuntimeToolPreflightV2Request;
  [CODE_RUNTIME_RPC_METHODS.ACTION_REQUIRED_SUBMIT_V2]: ActionRequiredSubmitRequest & {
    request_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.ACTION_REQUIRED_GET_V2]: {
    requestId: string;
    request_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.RUNTIME_TOOL_OUTCOME_RECORD_V2]: RuntimeToolOutcomeRecordRequest;
  [CODE_RUNTIME_RPC_METHODS.RUNTIME_POLICY_GET_V2]: CodeRuntimeRpcEmptyParams;
  [CODE_RUNTIME_RPC_METHODS.RUNTIME_POLICY_SET_V2]: RuntimePolicySetRequest;
  [CODE_RUNTIME_RPC_METHODS.KERNEL_CAPABILITIES_LIST_V2]: CodeRuntimeRpcEmptyParams;
  [CODE_RUNTIME_RPC_METHODS.KERNEL_SESSIONS_LIST_V2]: KernelSessionsListRequest & {
    workspace_id?: string | null;
  };
  [CODE_RUNTIME_RPC_METHODS.KERNEL_JOBS_LIST_V2]: KernelJobsListRequest & {
    workspace_id?: string | null;
  };
  [CODE_RUNTIME_RPC_METHODS.KERNEL_CONTEXT_SNAPSHOT_V2]: KernelContextSnapshotRequest & {
    workspace_id?: string;
    thread_id?: string;
    task_id?: string;
    run_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.KERNEL_EXTENSIONS_LIST_V2]: KernelExtensionsListRequest & {
    workspace_id?: string | null;
  };
  [CODE_RUNTIME_RPC_METHODS.KERNEL_POLICIES_EVALUATE_V2]: KernelPoliciesEvaluateRequest & {
    workspace_id?: string | null;
    tool_name?: string | null;
    payload_bytes?: number | null;
    requires_approval?: boolean | null;
    capability_id?: string | null;
    mutation_kind?: string | null;
  };
  [CODE_RUNTIME_RPC_METHODS.KERNEL_PROJECTION_BOOTSTRAP_V3]: KernelProjectionBootstrapRequest;
  [CODE_RUNTIME_RPC_METHODS.RUNTIME_BACKENDS_LIST]: CodeRuntimeRpcEmptyParams;
  [CODE_RUNTIME_RPC_METHODS.RUNTIME_BACKEND_UPSERT]: RuntimeBackendUpsertInput & {
    backend_id?: string;
    display_name?: string;
    max_concurrency?: number;
    cost_tier?: string;
    latency_class?: string;
    rollout_state?: RuntimeBackendRolloutState;
  };
  [CODE_RUNTIME_RPC_METHODS.RUNTIME_BACKEND_REMOVE]: {
    backendId: string;
    backend_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.RUNTIME_BACKEND_SET_STATE]: RuntimeBackendSetStateRequest & {
    backend_id?: string;
    rollout_state?: RuntimeBackendRolloutState;
  };
  [CODE_RUNTIME_RPC_METHODS.ACP_INTEGRATIONS_LIST]: CodeRuntimeRpcEmptyParams;
  [CODE_RUNTIME_RPC_METHODS.ACP_INTEGRATION_UPSERT]: AcpIntegrationUpsertInput & {
    integration_id?: string;
    display_name?: string;
    transport_config?: AcpIntegrationTransportConfig;
    max_concurrency?: number;
    cost_tier?: string;
    latency_class?: string;
    backend_id?: string | null;
  };
  [CODE_RUNTIME_RPC_METHODS.ACP_INTEGRATION_REMOVE]: {
    integrationId: string;
    integration_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.ACP_INTEGRATION_SET_STATE]: AcpIntegrationSetStateRequest & {
    integration_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.ACP_INTEGRATION_PROBE]: AcpIntegrationProbeRequest & {
    integration_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.DISTRIBUTED_TASK_GRAPH]: DistributedTaskGraphRequest & {
    task_id?: string;
    include_diagnostics?: boolean;
  };
  [CODE_RUNTIME_RPC_METHODS.RUNTIME_TOOL_METRICS_RECORD]: {
    events: RuntimeToolExecutionEvent[];
  };
  [CODE_RUNTIME_RPC_METHODS.RUNTIME_TOOL_METRICS_READ]:
    | RuntimeToolExecutionMetricsReadRequest
    | CodeRuntimeRpcEmptyParams;
  [CODE_RUNTIME_RPC_METHODS.RUNTIME_TOOL_METRICS_RESET]: CodeRuntimeRpcEmptyParams;
  [CODE_RUNTIME_RPC_METHODS.RUNTIME_TOOL_GUARDRAIL_EVALUATE]: RuntimeToolGuardrailEvaluateRequest;
  [CODE_RUNTIME_RPC_METHODS.RUNTIME_TOOL_GUARDRAIL_RECORD_OUTCOME]: {
    event: RuntimeToolGuardrailOutcomeEvent;
  };
  [CODE_RUNTIME_RPC_METHODS.RUNTIME_TOOL_GUARDRAIL_READ]: CodeRuntimeRpcEmptyParams;
  [CODE_RUNTIME_RPC_METHODS.TERMINAL_OPEN]: {
    workspaceId: string;
    workspace_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.TERMINAL_WRITE]: {
    sessionId: string;
    input: string;
    session_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.TERMINAL_INPUT_RAW]: {
    sessionId: string;
    input: string;
    session_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.TERMINAL_READ]: {
    sessionId: string;
    session_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.TERMINAL_STREAM_START]: {
    sessionId: string;
    session_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.TERMINAL_STREAM_STOP]: {
    sessionId: string;
    session_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.TERMINAL_INTERRUPT]: {
    sessionId: string;
    session_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.TERMINAL_RESIZE]: {
    sessionId: string;
    rows: number;
    cols: number;
    session_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.TERMINAL_CLOSE]: {
    sessionId: string;
    session_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.CLI_SESSIONS_LIST]: CodeRuntimeRpcEmptyParams;
  [CODE_RUNTIME_RPC_METHODS.OAUTH_ACCOUNTS_LIST]: {
    provider: OAuthProviderId | null;
    usageRefresh?: OAuthUsageRefreshMode | null;
    usage_refresh?: OAuthUsageRefreshMode | null;
  };
  [CODE_RUNTIME_RPC_METHODS.OAUTH_ACCOUNT_UPSERT]: OAuthAccountUpsertInput & {
    account_id?: string;
    external_account_id?: string | null;
    display_name?: string | null;
    disabled_reason?: string | null;
  };
  [CODE_RUNTIME_RPC_METHODS.OAUTH_ACCOUNT_REMOVE]: {
    accountId: string;
    account_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.OAUTH_PRIMARY_ACCOUNT_GET]: {
    provider: OAuthProviderId;
  };
  [CODE_RUNTIME_RPC_METHODS.OAUTH_PRIMARY_ACCOUNT_SET]: OAuthPrimaryAccountSetInput & {
    account_id?: string | null;
  };
  [CODE_RUNTIME_RPC_METHODS.OAUTH_POOLS_LIST]: {
    provider: OAuthProviderId | null;
  };
  [CODE_RUNTIME_RPC_METHODS.OAUTH_POOL_UPSERT]: OAuthPoolUpsertInput & {
    pool_id?: string;
    preferred_account_id?: string | null;
    sticky_mode?: OAuthStickyMode;
  };
  [CODE_RUNTIME_RPC_METHODS.OAUTH_POOL_REMOVE]: {
    poolId: string;
    pool_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.OAUTH_POOL_MEMBERS_LIST]: {
    poolId: string;
    pool_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.OAUTH_POOL_APPLY]: OAuthPoolApplyInput & {
    expected_updated_at?: number | null;
  };
  [CODE_RUNTIME_RPC_METHODS.OAUTH_POOL_MEMBERS_REPLACE]: {
    poolId: string;
    members: OAuthPoolMemberInput[];
    pool_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.OAUTH_POOL_SELECT]: OAuthPoolSelectionRequest & {
    pool_id?: string;
    session_id?: string | null;
    workspace_id?: string | null;
    model_id?: string | null;
  };
  [CODE_RUNTIME_RPC_METHODS.OAUTH_POOL_ACCOUNT_BIND]: OAuthPoolAccountBindRequest & {
    pool_id?: string;
    session_id?: string;
    account_id?: string;
    workspace_id?: string | null;
  };
  [CODE_RUNTIME_RPC_METHODS.OAUTH_RATE_LIMIT_REPORT]: OAuthRateLimitReportInput & {
    account_id?: string;
    model_id?: string | null;
    retry_after_sec?: number | null;
    reset_at?: number | null;
    error_code?: string | null;
    error_message?: string | null;
  };
  [CODE_RUNTIME_RPC_METHODS.OAUTH_CHATGPT_AUTH_TOKENS_REFRESH]: OAuthChatgptAuthTokensRefreshRequest & {
    session_id?: string | null;
    previous_account_id?: string | null;
    workspace_id?: string | null;
  };
  [CODE_RUNTIME_RPC_METHODS.OAUTH_CODEX_LOGIN_START]: OAuthCodexLoginStartRequest & {
    workspace_id?: string;
    force_oauth?: boolean;
  };
  [CODE_RUNTIME_RPC_METHODS.OAUTH_CODEX_LOGIN_CANCEL]: OAuthCodexLoginCancelRequest & {
    workspace_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.OAUTH_CODEX_ACCOUNTS_IMPORT_FROM_COCKPIT_TOOLS]: CodeRuntimeRpcEmptyParams;
  [CODE_RUNTIME_RPC_METHODS.LIVE_SKILLS_LIST]: CodeRuntimeRpcEmptyParams;
  [CODE_RUNTIME_RPC_METHODS.LIVE_SKILL_EXECUTE]: LiveSkillExecuteRequest;
  [CODE_RUNTIME_RPC_METHODS.CODEX_EXEC_RUN_V1]: RuntimeCodexExecRunRequest & {
    workspace_id?: string | null;
    codex_bin?: string | null;
    codex_args?: string[] | null;
    output_schema?: Record<string, unknown> | null;
    approval_policy?: string | null;
    sandbox_mode?: string | null;
  };
  [CODE_RUNTIME_RPC_METHODS.CODEX_CLOUD_TASKS_LIST_V1]: RuntimeCodexCloudTasksListRequest & {
    workspace_id?: string | null;
    force_refetch?: boolean;
  };
  [CODE_RUNTIME_RPC_METHODS.CODEX_CONFIG_PATH_GET_V1]: CodeRuntimeRpcEmptyParams;
  [CODE_RUNTIME_RPC_METHODS.CODEX_DOCTOR_V1]: RuntimeCodexDoctorRequest & {
    codex_bin?: string | null;
    codex_args?: string[] | null;
  };
  [CODE_RUNTIME_RPC_METHODS.CODEX_UPDATE_V1]: RuntimeCodexUpdateRequest & {
    codex_bin?: string | null;
    codex_args?: string[] | null;
  };
  [CODE_RUNTIME_RPC_METHODS.COLLABORATION_MODES_LIST_V1]: {
    workspaceId: string;
    workspace_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.MCP_SERVER_STATUS_LIST_V1]: RuntimeMcpServerStatusListRequest & {
    workspace_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.BROWSER_DEBUG_STATUS_V1]: RuntimeBrowserDebugStatusRequest & {
    workspace_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.BROWSER_DEBUG_RUN_V1]: RuntimeBrowserDebugRunRequest & {
    workspace_id?: string;
    include_screenshot?: boolean | null;
  };
  [CODE_RUNTIME_RPC_METHODS.EXTENSION_CATALOG_LIST_V2]: RuntimeExtensionCatalogListRequest & {
    workspace_id?: string | null;
    include_disabled?: boolean | null;
  };
  [CODE_RUNTIME_RPC_METHODS.EXTENSION_GET_V2]: RuntimeExtensionGetRequest & {
    workspace_id?: string | null;
    extension_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.EXTENSION_INSTALL_V2]: RuntimeExtensionInstallRequest & {
    workspace_id?: string | null;
    extension_id?: string;
    display_name?: string | null;
    lifecycle_state?: string | null;
    ui_apps?: RuntimeExtensionUiAppDescriptor[] | null;
  };
  [CODE_RUNTIME_RPC_METHODS.EXTENSION_UPDATE_V2]: RuntimeExtensionUpdateRequest & {
    workspace_id?: string | null;
    extension_id?: string;
    display_name?: string | null;
    lifecycle_state?: string | null;
    ui_apps?: RuntimeExtensionUiAppDescriptor[] | null;
  };
  [CODE_RUNTIME_RPC_METHODS.EXTENSION_SET_STATE_V2]: RuntimeExtensionSetStateRequest & {
    workspace_id?: string | null;
    extension_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.EXTENSION_REMOVE_V2]: RuntimeExtensionRemoveRequest & {
    workspace_id?: string | null;
    extension_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.EXTENSION_REGISTRY_SEARCH_V2]: RuntimeExtensionRegistrySearchRequest & {
    workspace_id?: string | null;
    source_ids?: string[] | null;
  };
  [CODE_RUNTIME_RPC_METHODS.EXTENSION_REGISTRY_SOURCES_V2]: CodeRuntimeRpcEmptyParams;
  [CODE_RUNTIME_RPC_METHODS.EXTENSION_PERMISSIONS_EVALUATE_V2]: RuntimeExtensionPermissionsEvaluateRequest & {
    workspace_id?: string | null;
    extension_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.EXTENSION_HEALTH_READ_V2]: RuntimeExtensionHealthReadRequest & {
    workspace_id?: string | null;
    extension_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.EXTENSION_TOOLS_LIST_V2]: RuntimeExtensionToolsListRequest & {
    workspace_id?: string | null;
    extension_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.EXTENSION_RESOURCE_READ_V2]: RuntimeExtensionResourceReadRequest & {
    workspace_id?: string | null;
    extension_id?: string;
    resource_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.SESSION_EXPORT_V1]: RuntimeSessionExportRequest & {
    workspace_id?: string;
    thread_id?: string;
    include_agent_tasks?: boolean;
  };
  [CODE_RUNTIME_RPC_METHODS.SESSION_IMPORT_V1]: RuntimeSessionImportRequest & {
    workspace_id?: string;
    thread_id?: string | null;
  };
  [CODE_RUNTIME_RPC_METHODS.SESSION_DELETE_V1]: RuntimeSessionDeleteRequest & {
    workspace_id?: string;
    thread_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.THREAD_SNAPSHOTS_GET_V1]: RuntimeThreadSnapshotsGetRequest;
  [CODE_RUNTIME_RPC_METHODS.THREAD_SNAPSHOTS_SET_V1]: RuntimeThreadSnapshotsSetRequest;
  [CODE_RUNTIME_RPC_METHODS.SECURITY_PREFLIGHT_V1]: RuntimeSecurityPreflightRequest & {
    workspace_id?: string | null;
    tool_name?: string | null;
    check_package_advisory?: boolean;
    check_exec_policy?: boolean;
    exec_policy_rules?: string[] | null;
  };
  [CODE_RUNTIME_RPC_METHODS.RUNTIME_DIAGNOSTICS_EXPORT_V1]: RuntimeDiagnosticsExportRequest & {
    workspace_id?: string | null;
    redaction_level?: RuntimeDiagnosticsRedactionLevel;
    include_task_summaries?: boolean;
    include_event_tail?: boolean;
    include_zip_base64?: boolean;
  };
}
