import type {
  HealthResponse,
  ModelPoolEntry,
  RemoteStatus,
  SettingsSummary,
  TerminalSessionSummary,
  TerminalStatus,
  ThreadSummary,
  WorkspaceSummary,
} from "./foundation.js";
import type { HugeCodeMissionControlSnapshot } from "../hugeCodeMissionControl.js";
import type {
  RuntimeTaskSourceIngestResponse,
  RuntimeTaskSourceReconcileResponse,
  RuntimeTaskSourceRecord,
  TurnAck,
} from "./agentExecution.js";
import type {
  CliSessionSummary,
  OAuthAccountSummary,
  OAuthChatgptAuthTokensRefreshResponse,
  OAuthCodexLoginCancelResponse,
  OAuthCodexLoginStartResponse,
  OAuthPoolApplyResult,
  OAuthPoolMember,
  OAuthPoolSelectionResult,
  OAuthPoolSummary,
  OAuthPrimaryAccountSummary,
  PromptLibraryEntry,
  RuntimeCockpitToolsCodexImportResponse,
  RuntimeProviderCatalogEntry,
} from "./providersAndAuth.js";
import type { AcpIntegrationSummary, RuntimeBackendSummary } from "./runtimeBackends.js";
import type {
  ActionRequiredRecord,
  ActionRequiredStatus,
  KernelCapabilityDescriptor,
  KernelContextSlice,
  KernelExtensionBundle,
  KernelJob,
  KernelPolicyDecision,
  KernelProjectionBootstrapResponse,
  KernelSession,
  LiveSkillExecutionResult,
  LiveSkillSummary,
  RuntimeCompositionProfile,
  RuntimeCompositionProfileSummaryV2,
  RuntimeCompositionResolveV2Response,
  RuntimeCompositionSnapshotPublishResponse,
  RuntimeBrowserDebugRunResponse,
  RuntimeBrowserDebugStatusResponse,
  RuntimeCodexCloudTasksListResponse,
  RuntimeCodexConfigPathResponse,
  RuntimeCodexDoctorResponse,
  RuntimeCodexExecRunResponse,
  RuntimeCodexUpdateResponse,
  RuntimeCollaborationModesListResponse,
  RuntimeDiagnosticsExportResponse,
  RuntimeExtensionHealthReadResponse,
  RuntimeExtensionPermissionsEvaluateResponse,
  RuntimeExtensionRecord,
  RuntimeExtensionRegistrySearchResponse,
  RuntimeExtensionRegistrySource,
  RuntimeExtensionResourceReadResponse,
  RuntimeExtensionToolInvokeResponse,
  RuntimeExtensionToolSummary,
  RuntimeMcpServerStatusListResponse,
  RuntimePolicySnapshot,
  RuntimeSecurityPreflightDecision,
  RuntimeSessionExportResponse,
  RuntimeSessionImportResponse,
  RuntimeThreadSnapshotsGetResponse,
  RuntimeThreadSnapshotsSetResponse,
  RuntimeToolExecutionMetricsSnapshot,
  RuntimeToolGuardrailEvaluateResult,
  RuntimeToolGuardrailStateSnapshot,
  ToolPreflightDecision,
} from "./runtimeFeatures.js";
import type {
  DistributedTaskGraph,
  RuntimeReviewGetV2Response,
  RuntimeRunCancelV2Response,
  RuntimeRunCheckpointApprovalAck,
  RuntimeRunGetV2Response,
  RuntimeRunInterventionV2Response,
  RuntimeRunPrepareV2Response,
  RuntimeRunResumeV2Response,
  RuntimeRunStartV2Response,
  RuntimeRunSubscribeV2Response,
  RuntimeRunSummary,
  SubAgentCloseAck,
  SubAgentInterruptAck,
  SubAgentSendResult,
  SubAgentSessionSummary,
  SubAgentWaitResult,
} from "./runtimeRunsAndSubAgents.js";
import type {
  GitBranchesSnapshot,
  GitChangesSnapshot,
  GitCommitResult,
  GitDiffContent,
  GitLogResponse,
  GitOperationResult,
  RuntimeBootstrapSnapshot,
  RuntimeRpcBatchResponse,
  RuntimeTextFileResponse,
  WorkspaceDiagnosticsListResponse,
  WorkspaceFileContent,
  WorkspaceFileSummary,
  WorkspacePatchApplyResponse,
} from "./workspaceAndGit.js";

import { CODE_RUNTIME_RPC_METHODS, type CodeRuntimeRpcCapabilities } from "./rpcCore.js";

import type {
  RuntimeAppSettingsRecord,
  ThreadLiveSubscribeResult,
  ThreadLiveUnsubscribeResult,
} from "./payloadShared.js";

export interface CodeRuntimeRpcResponsePayloadByMethod {
  [CODE_RUNTIME_RPC_METHODS.RPC_CAPABILITIES]: CodeRuntimeRpcCapabilities;
  [CODE_RUNTIME_RPC_METHODS.HEALTH]: HealthResponse;
  [CODE_RUNTIME_RPC_METHODS.SETTINGS_SUMMARY]: SettingsSummary;
  [CODE_RUNTIME_RPC_METHODS.APP_SETTINGS_GET]: RuntimeAppSettingsRecord;
  [CODE_RUNTIME_RPC_METHODS.APP_SETTINGS_UPDATE]: RuntimeAppSettingsRecord;
  [CODE_RUNTIME_RPC_METHODS.TEXT_FILE_READ_V1]: RuntimeTextFileResponse;
  [CODE_RUNTIME_RPC_METHODS.TEXT_FILE_WRITE_V1]: boolean;
  [CODE_RUNTIME_RPC_METHODS.REMOTE_STATUS]: RemoteStatus;
  [CODE_RUNTIME_RPC_METHODS.TERMINAL_STATUS]: TerminalStatus;
  [CODE_RUNTIME_RPC_METHODS.MODELS_POOL]: ModelPoolEntry[];
  [CODE_RUNTIME_RPC_METHODS.PROVIDERS_CATALOG]: RuntimeProviderCatalogEntry[];
  [CODE_RUNTIME_RPC_METHODS.WORKSPACES_LIST]: WorkspaceSummary[];
  [CODE_RUNTIME_RPC_METHODS.BOOTSTRAP_SNAPSHOT]: RuntimeBootstrapSnapshot;
  [CODE_RUNTIME_RPC_METHODS.MISSION_CONTROL_SNAPSHOT_V1]: HugeCodeMissionControlSnapshot;
  [CODE_RUNTIME_RPC_METHODS.RPC_BATCH]: RuntimeRpcBatchResponse;
  [CODE_RUNTIME_RPC_METHODS.WORKSPACE_PICK_DIRECTORY]: string | null;
  [CODE_RUNTIME_RPC_METHODS.WORKSPACE_CREATE]: WorkspaceSummary;
  [CODE_RUNTIME_RPC_METHODS.WORKSPACE_RENAME]: WorkspaceSummary | null;
  [CODE_RUNTIME_RPC_METHODS.WORKSPACE_REMOVE]: boolean;
  [CODE_RUNTIME_RPC_METHODS.WORKSPACE_FILES_LIST]: WorkspaceFileSummary[];
  [CODE_RUNTIME_RPC_METHODS.WORKSPACE_FILE_READ]: WorkspaceFileContent | null;
  [CODE_RUNTIME_RPC_METHODS.WORKSPACE_DIAGNOSTICS_LIST_V1]: WorkspaceDiagnosticsListResponse;
  [CODE_RUNTIME_RPC_METHODS.WORKSPACE_PATCH_APPLY_V1]: WorkspacePatchApplyResponse;
  [CODE_RUNTIME_RPC_METHODS.GIT_CHANGES_LIST]: GitChangesSnapshot;
  [CODE_RUNTIME_RPC_METHODS.GIT_DIFF_READ]: GitDiffContent | null;
  [CODE_RUNTIME_RPC_METHODS.GIT_BRANCHES_LIST]: GitBranchesSnapshot;
  [CODE_RUNTIME_RPC_METHODS.GIT_BRANCH_CREATE]: GitOperationResult;
  [CODE_RUNTIME_RPC_METHODS.GIT_BRANCH_CHECKOUT]: GitOperationResult;
  [CODE_RUNTIME_RPC_METHODS.GIT_LOG]: GitLogResponse;
  [CODE_RUNTIME_RPC_METHODS.GIT_STAGE_CHANGE]: GitOperationResult;
  [CODE_RUNTIME_RPC_METHODS.GIT_STAGE_ALL]: GitOperationResult;
  [CODE_RUNTIME_RPC_METHODS.GIT_UNSTAGE_CHANGE]: GitOperationResult;
  [CODE_RUNTIME_RPC_METHODS.GIT_REVERT_CHANGE]: GitOperationResult;
  [CODE_RUNTIME_RPC_METHODS.GIT_COMMIT]: GitCommitResult;
  [CODE_RUNTIME_RPC_METHODS.PROMPT_LIBRARY_LIST]: PromptLibraryEntry[];
  [CODE_RUNTIME_RPC_METHODS.PROMPT_LIBRARY_CREATE]: PromptLibraryEntry;
  [CODE_RUNTIME_RPC_METHODS.PROMPT_LIBRARY_UPDATE]: PromptLibraryEntry;
  [CODE_RUNTIME_RPC_METHODS.PROMPT_LIBRARY_DELETE]: boolean;
  [CODE_RUNTIME_RPC_METHODS.PROMPT_LIBRARY_MOVE]: PromptLibraryEntry;
  [CODE_RUNTIME_RPC_METHODS.THREADS_LIST]: ThreadSummary[];
  [CODE_RUNTIME_RPC_METHODS.THREAD_CREATE]: ThreadSummary;
  [CODE_RUNTIME_RPC_METHODS.THREAD_RESUME]: ThreadSummary | null;
  [CODE_RUNTIME_RPC_METHODS.THREAD_ARCHIVE]: boolean;
  [CODE_RUNTIME_RPC_METHODS.THREAD_LIVE_SUBSCRIBE]: ThreadLiveSubscribeResult;
  [CODE_RUNTIME_RPC_METHODS.THREAD_LIVE_UNSUBSCRIBE]: ThreadLiveUnsubscribeResult;
  [CODE_RUNTIME_RPC_METHODS.TURN_SEND]: TurnAck;
  [CODE_RUNTIME_RPC_METHODS.TURN_INTERRUPT]: boolean;
  [CODE_RUNTIME_RPC_METHODS.TASK_SOURCE_INGEST_V1]: RuntimeTaskSourceIngestResponse;
  [CODE_RUNTIME_RPC_METHODS.TASK_SOURCE_GET_V1]: RuntimeTaskSourceRecord | null;
  [CODE_RUNTIME_RPC_METHODS.TASK_SOURCE_LIST_V1]: RuntimeTaskSourceRecord[];
  [CODE_RUNTIME_RPC_METHODS.TASK_SOURCE_RECONCILE_V1]: RuntimeTaskSourceReconcileResponse;
  [CODE_RUNTIME_RPC_METHODS.RUN_PREPARE_V2]: RuntimeRunPrepareV2Response;
  [CODE_RUNTIME_RPC_METHODS.RUN_START_V2]: RuntimeRunStartV2Response;
  [CODE_RUNTIME_RPC_METHODS.RUN_CANCEL_V2]: RuntimeRunCancelV2Response;
  [CODE_RUNTIME_RPC_METHODS.RUN_RESUME_V2]: RuntimeRunResumeV2Response;
  [CODE_RUNTIME_RPC_METHODS.RUN_INTERVENE_V2]: RuntimeRunInterventionV2Response;
  [CODE_RUNTIME_RPC_METHODS.RUN_GET_V2]: RuntimeRunGetV2Response;
  [CODE_RUNTIME_RPC_METHODS.RUN_SUBSCRIBE_V2]: RuntimeRunSubscribeV2Response;
  [CODE_RUNTIME_RPC_METHODS.REVIEW_GET_V2]: RuntimeReviewGetV2Response;
  [CODE_RUNTIME_RPC_METHODS.RUNS_LIST]: RuntimeRunSummary[];
  [CODE_RUNTIME_RPC_METHODS.SUB_AGENT_SPAWN]: SubAgentSessionSummary;
  [CODE_RUNTIME_RPC_METHODS.SUB_AGENT_SEND]: SubAgentSendResult;
  [CODE_RUNTIME_RPC_METHODS.SUB_AGENT_WAIT]: SubAgentWaitResult;
  [CODE_RUNTIME_RPC_METHODS.SUB_AGENT_STATUS]: SubAgentSessionSummary | null;
  [CODE_RUNTIME_RPC_METHODS.SUB_AGENT_INTERRUPT]: SubAgentInterruptAck;
  [CODE_RUNTIME_RPC_METHODS.SUB_AGENT_CLOSE]: SubAgentCloseAck;
  [CODE_RUNTIME_RPC_METHODS.RUN_CHECKPOINT_APPROVAL]: RuntimeRunCheckpointApprovalAck;
  [CODE_RUNTIME_RPC_METHODS.RUNTIME_TOOL_PREFLIGHT_V2]: ToolPreflightDecision;
  [CODE_RUNTIME_RPC_METHODS.ACTION_REQUIRED_SUBMIT_V2]: ActionRequiredStatus;
  [CODE_RUNTIME_RPC_METHODS.ACTION_REQUIRED_GET_V2]: ActionRequiredRecord | null;
  [CODE_RUNTIME_RPC_METHODS.RUNTIME_TOOL_OUTCOME_RECORD_V2]: boolean;
  [CODE_RUNTIME_RPC_METHODS.RUNTIME_POLICY_GET_V2]: RuntimePolicySnapshot;
  [CODE_RUNTIME_RPC_METHODS.RUNTIME_POLICY_SET_V2]: RuntimePolicySnapshot;
  [CODE_RUNTIME_RPC_METHODS.KERNEL_CAPABILITIES_LIST_V2]: KernelCapabilityDescriptor[];
  [CODE_RUNTIME_RPC_METHODS.KERNEL_SESSIONS_LIST_V2]: KernelSession[];
  [CODE_RUNTIME_RPC_METHODS.KERNEL_JOBS_LIST_V2]: KernelJob[];
  [CODE_RUNTIME_RPC_METHODS.KERNEL_CONTEXT_SNAPSHOT_V2]: KernelContextSlice;
  [CODE_RUNTIME_RPC_METHODS.KERNEL_EXTENSIONS_LIST_V2]: KernelExtensionBundle[];
  [CODE_RUNTIME_RPC_METHODS.KERNEL_POLICIES_EVALUATE_V2]: KernelPolicyDecision;
  [CODE_RUNTIME_RPC_METHODS.KERNEL_PROJECTION_BOOTSTRAP_V3]: KernelProjectionBootstrapResponse;
  [CODE_RUNTIME_RPC_METHODS.COMPOSITION_PROFILE_LIST_V2]: RuntimeCompositionProfileSummaryV2[];
  [CODE_RUNTIME_RPC_METHODS.COMPOSITION_PROFILE_GET_V2]: RuntimeCompositionProfile | null;
  [CODE_RUNTIME_RPC_METHODS.COMPOSITION_PROFILE_RESOLVE_V2]: RuntimeCompositionResolveV2Response;
  [CODE_RUNTIME_RPC_METHODS.COMPOSITION_SNAPSHOT_PUBLISH_V1]: RuntimeCompositionSnapshotPublishResponse;
  [CODE_RUNTIME_RPC_METHODS.RUNTIME_BACKENDS_LIST]: RuntimeBackendSummary[];
  [CODE_RUNTIME_RPC_METHODS.RUNTIME_BACKEND_UPSERT]: RuntimeBackendSummary;
  [CODE_RUNTIME_RPC_METHODS.RUNTIME_BACKEND_REMOVE]: boolean;
  [CODE_RUNTIME_RPC_METHODS.RUNTIME_BACKEND_SET_STATE]: RuntimeBackendSummary;
  [CODE_RUNTIME_RPC_METHODS.ACP_INTEGRATIONS_LIST]: AcpIntegrationSummary[];
  [CODE_RUNTIME_RPC_METHODS.ACP_INTEGRATION_UPSERT]: AcpIntegrationSummary;
  [CODE_RUNTIME_RPC_METHODS.ACP_INTEGRATION_REMOVE]: boolean;
  [CODE_RUNTIME_RPC_METHODS.ACP_INTEGRATION_SET_STATE]: AcpIntegrationSummary;
  [CODE_RUNTIME_RPC_METHODS.ACP_INTEGRATION_PROBE]: AcpIntegrationSummary;
  [CODE_RUNTIME_RPC_METHODS.DISTRIBUTED_TASK_GRAPH]: DistributedTaskGraph;
  [CODE_RUNTIME_RPC_METHODS.RUNTIME_TOOL_METRICS_RECORD]: RuntimeToolExecutionMetricsSnapshot;
  [CODE_RUNTIME_RPC_METHODS.RUNTIME_TOOL_METRICS_READ]: RuntimeToolExecutionMetricsSnapshot;
  [CODE_RUNTIME_RPC_METHODS.RUNTIME_TOOL_METRICS_RESET]: RuntimeToolExecutionMetricsSnapshot;
  [CODE_RUNTIME_RPC_METHODS.RUNTIME_TOOL_GUARDRAIL_EVALUATE]: RuntimeToolGuardrailEvaluateResult;
  [CODE_RUNTIME_RPC_METHODS.RUNTIME_TOOL_GUARDRAIL_RECORD_OUTCOME]: RuntimeToolGuardrailStateSnapshot;
  [CODE_RUNTIME_RPC_METHODS.RUNTIME_TOOL_GUARDRAIL_READ]: RuntimeToolGuardrailStateSnapshot;
  [CODE_RUNTIME_RPC_METHODS.TERMINAL_OPEN]: TerminalSessionSummary;
  [CODE_RUNTIME_RPC_METHODS.TERMINAL_WRITE]: TerminalSessionSummary | null;
  [CODE_RUNTIME_RPC_METHODS.TERMINAL_INPUT_RAW]: boolean;
  [CODE_RUNTIME_RPC_METHODS.TERMINAL_READ]: TerminalSessionSummary | null;
  [CODE_RUNTIME_RPC_METHODS.TERMINAL_STREAM_START]: boolean;
  [CODE_RUNTIME_RPC_METHODS.TERMINAL_STREAM_STOP]: boolean;
  [CODE_RUNTIME_RPC_METHODS.TERMINAL_INTERRUPT]: boolean;
  [CODE_RUNTIME_RPC_METHODS.TERMINAL_RESIZE]: boolean;
  [CODE_RUNTIME_RPC_METHODS.TERMINAL_CLOSE]: boolean;
  [CODE_RUNTIME_RPC_METHODS.CLI_SESSIONS_LIST]: CliSessionSummary[];
  [CODE_RUNTIME_RPC_METHODS.OAUTH_ACCOUNTS_LIST]: OAuthAccountSummary[];
  [CODE_RUNTIME_RPC_METHODS.OAUTH_ACCOUNT_UPSERT]: OAuthAccountSummary;
  [CODE_RUNTIME_RPC_METHODS.OAUTH_ACCOUNT_REMOVE]: boolean;
  [CODE_RUNTIME_RPC_METHODS.OAUTH_PRIMARY_ACCOUNT_GET]: OAuthPrimaryAccountSummary;
  [CODE_RUNTIME_RPC_METHODS.OAUTH_PRIMARY_ACCOUNT_SET]: OAuthPrimaryAccountSummary;
  [CODE_RUNTIME_RPC_METHODS.OAUTH_POOLS_LIST]: OAuthPoolSummary[];
  [CODE_RUNTIME_RPC_METHODS.OAUTH_POOL_UPSERT]: OAuthPoolSummary;
  [CODE_RUNTIME_RPC_METHODS.OAUTH_POOL_REMOVE]: boolean;
  [CODE_RUNTIME_RPC_METHODS.OAUTH_POOL_MEMBERS_LIST]: OAuthPoolMember[];
  [CODE_RUNTIME_RPC_METHODS.OAUTH_POOL_APPLY]: OAuthPoolApplyResult;
  [CODE_RUNTIME_RPC_METHODS.OAUTH_POOL_MEMBERS_REPLACE]: OAuthPoolMember[];
  [CODE_RUNTIME_RPC_METHODS.OAUTH_POOL_SELECT]: OAuthPoolSelectionResult | null;
  [CODE_RUNTIME_RPC_METHODS.OAUTH_POOL_ACCOUNT_BIND]: OAuthPoolSelectionResult | null;
  [CODE_RUNTIME_RPC_METHODS.OAUTH_RATE_LIMIT_REPORT]: boolean;
  [CODE_RUNTIME_RPC_METHODS.OAUTH_CHATGPT_AUTH_TOKENS_REFRESH]: OAuthChatgptAuthTokensRefreshResponse | null;
  [CODE_RUNTIME_RPC_METHODS.OAUTH_CODEX_LOGIN_START]: OAuthCodexLoginStartResponse;
  [CODE_RUNTIME_RPC_METHODS.OAUTH_CODEX_LOGIN_CANCEL]: OAuthCodexLoginCancelResponse;
  [CODE_RUNTIME_RPC_METHODS.OAUTH_CODEX_ACCOUNTS_IMPORT_FROM_COCKPIT_TOOLS]: RuntimeCockpitToolsCodexImportResponse;
  [CODE_RUNTIME_RPC_METHODS.LIVE_SKILLS_LIST]: LiveSkillSummary[];
  [CODE_RUNTIME_RPC_METHODS.LIVE_SKILL_EXECUTE]: LiveSkillExecutionResult;
  [CODE_RUNTIME_RPC_METHODS.CODEX_EXEC_RUN_V1]: RuntimeCodexExecRunResponse;
  [CODE_RUNTIME_RPC_METHODS.CODEX_CLOUD_TASKS_LIST_V1]: RuntimeCodexCloudTasksListResponse;
  [CODE_RUNTIME_RPC_METHODS.CODEX_CONFIG_PATH_GET_V1]: RuntimeCodexConfigPathResponse;
  [CODE_RUNTIME_RPC_METHODS.CODEX_DOCTOR_V1]: RuntimeCodexDoctorResponse;
  [CODE_RUNTIME_RPC_METHODS.CODEX_UPDATE_V1]: RuntimeCodexUpdateResponse;
  [CODE_RUNTIME_RPC_METHODS.COLLABORATION_MODES_LIST_V1]: RuntimeCollaborationModesListResponse;
  [CODE_RUNTIME_RPC_METHODS.MCP_SERVER_STATUS_LIST_V1]: RuntimeMcpServerStatusListResponse;
  [CODE_RUNTIME_RPC_METHODS.BROWSER_DEBUG_STATUS_V1]: RuntimeBrowserDebugStatusResponse;
  [CODE_RUNTIME_RPC_METHODS.BROWSER_DEBUG_RUN_V1]: RuntimeBrowserDebugRunResponse;
  [CODE_RUNTIME_RPC_METHODS.EXTENSION_CATALOG_LIST_V2]: RuntimeExtensionRecord[];
  [CODE_RUNTIME_RPC_METHODS.EXTENSION_GET_V2]: RuntimeExtensionRecord | null;
  [CODE_RUNTIME_RPC_METHODS.EXTENSION_INSTALL_V2]: RuntimeExtensionRecord;
  [CODE_RUNTIME_RPC_METHODS.EXTENSION_UPDATE_V2]: RuntimeExtensionRecord;
  [CODE_RUNTIME_RPC_METHODS.EXTENSION_SET_STATE_V2]: RuntimeExtensionRecord | null;
  [CODE_RUNTIME_RPC_METHODS.EXTENSION_REMOVE_V2]: boolean;
  [CODE_RUNTIME_RPC_METHODS.EXTENSION_REGISTRY_SEARCH_V2]: RuntimeExtensionRegistrySearchResponse;
  [CODE_RUNTIME_RPC_METHODS.EXTENSION_REGISTRY_SOURCES_V2]: RuntimeExtensionRegistrySource[];
  [CODE_RUNTIME_RPC_METHODS.EXTENSION_PERMISSIONS_EVALUATE_V2]: RuntimeExtensionPermissionsEvaluateResponse;
  [CODE_RUNTIME_RPC_METHODS.EXTENSION_HEALTH_READ_V2]: RuntimeExtensionHealthReadResponse;
  [CODE_RUNTIME_RPC_METHODS.EXTENSION_TOOLS_LIST_V2]: RuntimeExtensionToolSummary[];
  [CODE_RUNTIME_RPC_METHODS.EXTENSION_TOOL_INVOKE_V2]: RuntimeExtensionToolInvokeResponse;
  [CODE_RUNTIME_RPC_METHODS.EXTENSION_RESOURCE_READ_V2]: RuntimeExtensionResourceReadResponse;
  [CODE_RUNTIME_RPC_METHODS.SESSION_EXPORT_V1]: RuntimeSessionExportResponse;
  [CODE_RUNTIME_RPC_METHODS.SESSION_IMPORT_V1]: RuntimeSessionImportResponse;
  [CODE_RUNTIME_RPC_METHODS.SESSION_DELETE_V1]: boolean;
  [CODE_RUNTIME_RPC_METHODS.THREAD_SNAPSHOTS_GET_V1]: RuntimeThreadSnapshotsGetResponse;
  [CODE_RUNTIME_RPC_METHODS.THREAD_SNAPSHOTS_SET_V1]: RuntimeThreadSnapshotsSetResponse;
  [CODE_RUNTIME_RPC_METHODS.SECURITY_PREFLIGHT_V1]: RuntimeSecurityPreflightDecision;
  [CODE_RUNTIME_RPC_METHODS.RUNTIME_DIAGNOSTICS_EXPORT_V1]: RuntimeDiagnosticsExportResponse;
}
