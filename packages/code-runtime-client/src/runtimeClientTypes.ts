import type {
  AcpIntegrationProbeRequest,
  AcpIntegrationSetStateRequest,
  AcpIntegrationSummary,
  AcpIntegrationUpsertInput,
  ActionRequiredRecord,
  ActionRequiredStatus,
  ActionRequiredSubmitRequest,
  CliSessionSummary,
  DistributedTaskGraph,
  DistributedTaskGraphRequest,
  GitBranchesSnapshot,
  GitChangesSnapshot,
  GitCommitResult,
  GitDiffContent,
  GitLogResponse,
  GitOperationResult,
  HealthResponse,
  HugeCodeMissionControlSnapshot,
  KernelCapabilityDescriptor,
  KernelContextSlice,
  KernelExtensionBundle,
  KernelExtensionsListRequest,
  KernelJob,
  KernelJobCallbackRegistrationAckV3,
  KernelJobCallbackRegistrationV3,
  KernelJobCallbackRemoveAckV3,
  KernelJobCallbackRemoveRequestV3,
  KernelJobGetRequestV3,
  KernelJobInterventionRequestV3,
  KernelJobResumeRequestV3,
  KernelJobsListRequest,
  KernelJobStartRequestV3,
  KernelJobSubscribeRequestV3,
  KernelPoliciesEvaluateRequest,
  KernelPolicyDecision,
  KernelProjectionBootstrapRequest,
  KernelProjectionBootstrapResponse,
  KernelSession,
  KernelSessionsListRequest,
  LiveSkillExecuteRequest,
  LiveSkillExecutionResult,
  LiveSkillSummary,
  ModelPoolEntry,
  OAuthAccountSummary,
  OAuthAccountUpsertInput,
  OAuthChatgptAuthTokensRefreshRequest,
  OAuthChatgptAuthTokensRefreshResponse,
  OAuthCodexLoginCancelRequest,
  OAuthCodexLoginCancelResponse,
  OAuthCodexLoginStartRequest,
  OAuthCodexLoginStartResponse,
  OAuthPoolAccountBindRequest,
  OAuthPoolApplyInput,
  OAuthPoolApplyResult,
  OAuthPoolMember,
  OAuthPoolMemberInput,
  OAuthPoolSelectionRequest,
  OAuthPoolSelectionResult,
  OAuthPoolSummary,
  OAuthPoolUpsertInput,
  OAuthPrimaryAccountSetInput,
  OAuthPrimaryAccountSummary,
  OAuthProviderId,
  OAuthRateLimitReportInput,
  OAuthUsageRefreshMode,
  PromptLibraryEntry,
  PromptLibraryScope,
  RemoteStatus,
  RuntimeBackendSetStateRequest,
  RuntimeBackendSummary,
  RuntimeBackendUpsertInput,
  RuntimeBootstrapSnapshot,
  RuntimeBrowserDebugRunRequest,
  RuntimeBrowserDebugRunResponse,
  RuntimeBrowserDebugStatusRequest,
  RuntimeBrowserDebugStatusResponse,
  RuntimeCockpitToolsCodexImportResponse,
  RuntimeCodexCloudTasksListRequest,
  RuntimeCodexCloudTasksListResponse,
  RuntimeCodexConfigPathResponse,
  RuntimeCodexDoctorRequest,
  RuntimeCodexDoctorResponse,
  RuntimeCodexExecRunRequest,
  RuntimeCodexExecRunResponse,
  RuntimeCodexUpdateRequest,
  RuntimeCodexUpdateResponse,
  RuntimeCollaborationModesListResponse,
  RuntimeDiagnosticsExportRequest,
  RuntimeDiagnosticsExportResponse,
  RuntimeExtensionInstallRequest,
  RuntimeExtensionResourceReadRequest,
  RuntimeExtensionResourceReadResponse,
  RuntimeExtensionsConfigResponse,
  RuntimeExtensionSpec,
  RuntimeExtensionToolSummary,
  RuntimeMcpServerStatusListRequest,
  RuntimeMcpServerStatusListResponse,
  RuntimePolicySetRequest,
  RuntimePolicySnapshot,
  RuntimeProviderCatalogEntry,
  RuntimeRunCancelAck,
  RuntimeRunCancelRequest,
  RuntimeRunCheckpointApprovalAck,
  RuntimeRunCheckpointApprovalRequest,
  RuntimeRunPrepareV2Request,
  RuntimeRunPrepareV2Response,
  RuntimeRunGetV2Request,
  RuntimeRunGetV2Response,
  RuntimeRunInterventionAck,
  RuntimeRunInterventionRequest,
  RuntimeRunInterventionV2Response,
  RuntimeRunResumeAck,
  RuntimeRunResumeRequest,
  RuntimeRunResumeV2Response,
  RuntimeRunsListRequest,
  RuntimeRunStartRequest,
  RuntimeRunStartV2Response,
  RuntimeRunSubscribeRequest,
  RuntimeRunSubscribeV2Response,
  RuntimeRunSummary,
  RuntimeReviewGetV2Request,
  RuntimeReviewGetV2Response,
  RuntimeSecurityPreflightDecision,
  RuntimeSecurityPreflightRequest,
  RuntimeSessionDeleteRequest,
  RuntimeSessionExportRequest,
  RuntimeSessionExportResponse,
  RuntimeSessionImportRequest,
  RuntimeSessionImportResponse,
  SettingsSummary,
  SubAgentCloseAck,
  SubAgentCloseRequest,
  SubAgentInterruptAck,
  SubAgentInterruptRequest,
  SubAgentSendRequest,
  SubAgentSendResult,
  SubAgentSessionSummary,
  SubAgentSpawnRequest,
  SubAgentStatusRequest,
  SubAgentWaitRequest,
  SubAgentWaitResult,
  TerminalSessionSummary,
  TerminalStatus,
  ThreadCreateRequest,
  ThreadSummary,
  ToolPreflightDecision,
  TurnAck,
  TurnInterruptRequest,
  TurnSendRequest,
  WorkspaceDiagnosticsListRequest,
  WorkspaceDiagnosticsListResponse,
  WorkspaceFileContent,
  WorkspaceFileSummary,
  WorkspacePatchApplyRequest,
  WorkspacePatchApplyResponse,
  WorkspaceSummary,
  RuntimeThreadSnapshotsGetRequest,
  RuntimeThreadSnapshotsGetResponse,
  RuntimeThreadSnapshotsSetRequest,
  RuntimeThreadSnapshotsSetResponse,
  RuntimeToolExecutionEvent,
  RuntimeToolExecutionMetricsReadRequest,
  RuntimeToolExecutionMetricsSnapshot,
  RuntimeToolGuardrailEvaluateRequest,
  RuntimeToolGuardrailEvaluateResult,
  RuntimeToolGuardrailOutcomeEvent,
  RuntimeToolGuardrailStateSnapshot,
  RuntimeToolOutcomeRecordRequest,
  RuntimeToolPreflightV2Request,
} from "@ku0/code-runtime-host-contract";

export type RuntimeClientMode = "tauri" | "runtime-gateway-web" | "unavailable";

export type RuntimeCapabilitiesSummary = {
  mode: RuntimeClientMode;
  methods: string[];
  features: string[];
  wsEndpointPath: string | null;
  error: string | null;
};

export type RuntimeClient<TAppSettings extends Record<string, unknown> = Record<string, unknown>> =
  {
    health: () => Promise<HealthResponse>;
    workspaces: () => Promise<WorkspaceSummary[]>;
    missionControlSnapshotV1: () => Promise<HugeCodeMissionControlSnapshot>;
    workspacePickDirectory: () => Promise<string | null>;
    workspaceCreate: (path: string, displayName: string | null) => Promise<WorkspaceSummary>;
    workspaceRename: (workspaceId: string, displayName: string) => Promise<WorkspaceSummary | null>;
    workspaceRemove: (workspaceId: string) => Promise<boolean>;
    workspaceFiles: (workspaceId: string) => Promise<WorkspaceFileSummary[]>;
    workspaceFileRead: (
      workspaceId: string,
      fileId: string
    ) => Promise<WorkspaceFileContent | null>;
    workspaceDiagnosticsListV1: (
      request: WorkspaceDiagnosticsListRequest
    ) => Promise<WorkspaceDiagnosticsListResponse>;
    workspacePatchApplyV1: (
      request: WorkspacePatchApplyRequest
    ) => Promise<WorkspacePatchApplyResponse>;
    gitChanges: (workspaceId: string) => Promise<GitChangesSnapshot>;
    gitLog: (workspaceId: string, limit?: number) => Promise<GitLogResponse>;
    gitDiffRead: (
      workspaceId: string,
      changeId: string,
      options?: { offset?: number; maxBytes?: number }
    ) => Promise<GitDiffContent | null>;
    gitBranches: (workspaceId: string) => Promise<GitBranchesSnapshot>;
    gitBranchCreate: (workspaceId: string, branchName: string) => Promise<GitOperationResult>;
    gitBranchCheckout: (workspaceId: string, branchName: string) => Promise<GitOperationResult>;
    gitStageChange: (workspaceId: string, changeId: string) => Promise<GitOperationResult>;
    gitStageAll: (workspaceId: string) => Promise<GitOperationResult>;
    gitUnstageChange: (workspaceId: string, changeId: string) => Promise<GitOperationResult>;
    gitRevertChange: (workspaceId: string, changeId: string) => Promise<GitOperationResult>;
    gitCommit: (workspaceId: string, message: string) => Promise<GitCommitResult>;
    promptLibrary: (workspaceId: string | null) => Promise<PromptLibraryEntry[]>;
    promptLibraryCreate: (input: {
      workspaceId: string | null;
      scope: PromptLibraryScope;
      title: string;
      description: string;
      content: string;
    }) => Promise<PromptLibraryEntry>;
    promptLibraryUpdate: (input: {
      workspaceId: string | null;
      promptId: string;
      title: string;
      description: string;
      content: string;
    }) => Promise<PromptLibraryEntry>;
    promptLibraryDelete: (input: {
      workspaceId: string | null;
      promptId: string;
    }) => Promise<boolean>;
    promptLibraryMove: (input: {
      workspaceId: string | null;
      promptId: string;
      targetScope: PromptLibraryScope;
    }) => Promise<PromptLibraryEntry>;
    threads: (workspaceId: string) => Promise<ThreadSummary[]>;
    createThread: (payload: ThreadCreateRequest) => Promise<ThreadSummary>;
    resumeThread: (workspaceId: string, threadId: string) => Promise<ThreadSummary | null>;
    archiveThread: (workspaceId: string, threadId: string) => Promise<boolean>;
    threadLiveSubscribe: (
      workspaceId: string,
      threadId: string
    ) => Promise<Record<string, unknown>>;
    threadLiveUnsubscribe: (subscriptionId: string) => Promise<Record<string, unknown>>;
    sendTurn: (payload: TurnSendRequest) => Promise<TurnAck>;
    interruptTurn: (payload: TurnInterruptRequest) => Promise<boolean>;
    runtimeRunPrepareV2: (
      request: RuntimeRunPrepareV2Request
    ) => Promise<RuntimeRunPrepareV2Response>;
    runtimeRunStart: (request: RuntimeRunStartRequest) => Promise<RuntimeRunSummary>;
    runtimeRunStartV2: (request: RuntimeRunStartRequest) => Promise<RuntimeRunStartV2Response>;
    runtimeRunGetV2: (request: RuntimeRunGetV2Request) => Promise<RuntimeRunGetV2Response>;
    runtimeRunIntervene: (
      request: RuntimeRunInterventionRequest
    ) => Promise<RuntimeRunInterventionAck>;
    runtimeRunInterveneV2: (
      request: RuntimeRunInterventionRequest
    ) => Promise<RuntimeRunInterventionV2Response>;
    runtimeRunCancel: (request: RuntimeRunCancelRequest) => Promise<RuntimeRunCancelAck>;
    runtimeRunResume: (request: RuntimeRunResumeRequest) => Promise<RuntimeRunResumeAck>;
    runtimeRunResumeV2: (request: RuntimeRunResumeRequest) => Promise<RuntimeRunResumeV2Response>;
    runtimeRunSubscribe: (request: RuntimeRunSubscribeRequest) => Promise<RuntimeRunSummary | null>;
    runtimeRunSubscribeV2: (
      request: RuntimeRunGetV2Request
    ) => Promise<RuntimeRunSubscribeV2Response>;
    runtimeReviewGetV2: (request: RuntimeReviewGetV2Request) => Promise<RuntimeReviewGetV2Response>;
    runtimeRunsList: (request: RuntimeRunsListRequest) => Promise<RuntimeRunSummary[]>;
    kernelJobStartV3: (request: KernelJobStartRequestV3) => Promise<KernelJob>;
    kernelJobGetV3: (request: KernelJobGetRequestV3) => Promise<KernelJob | null>;
    kernelJobCancelV3: (request: RuntimeRunCancelRequest) => Promise<RuntimeRunCancelAck>;
    kernelJobResumeV3: (request: KernelJobResumeRequestV3) => Promise<RuntimeRunResumeAck>;
    kernelJobInterveneV3: (
      request: KernelJobInterventionRequestV3
    ) => Promise<RuntimeRunInterventionAck>;
    kernelJobSubscribeV3: (request: KernelJobSubscribeRequestV3) => Promise<KernelJob | null>;
    kernelJobCallbackRegisterV3: (
      request: KernelJobCallbackRegistrationV3
    ) => Promise<KernelJobCallbackRegistrationAckV3>;
    kernelJobCallbackRemoveV3: (
      request: KernelJobCallbackRemoveRequestV3
    ) => Promise<KernelJobCallbackRemoveAckV3>;
    subAgentSpawn: (request: SubAgentSpawnRequest) => Promise<SubAgentSessionSummary>;
    subAgentSend: (request: SubAgentSendRequest) => Promise<SubAgentSendResult>;
    subAgentWait: (request: SubAgentWaitRequest) => Promise<SubAgentWaitResult>;
    subAgentStatus: (request: SubAgentStatusRequest) => Promise<SubAgentSessionSummary | null>;
    subAgentInterrupt: (request: SubAgentInterruptRequest) => Promise<SubAgentInterruptAck>;
    subAgentClose: (request: SubAgentCloseRequest) => Promise<SubAgentCloseAck>;
    runtimeRunCheckpointApproval: (
      request: RuntimeRunCheckpointApprovalRequest
    ) => Promise<RuntimeRunCheckpointApprovalAck>;
    runtimeToolPreflightV2: (
      request: RuntimeToolPreflightV2Request
    ) => Promise<ToolPreflightDecision>;
    actionRequiredSubmitV2: (request: ActionRequiredSubmitRequest) => Promise<ActionRequiredStatus>;
    actionRequiredGetV2: (requestId: string) => Promise<ActionRequiredRecord | null>;
    runtimeToolOutcomeRecordV2: (request: RuntimeToolOutcomeRecordRequest) => Promise<boolean>;
    runtimePolicyGetV2: () => Promise<RuntimePolicySnapshot>;
    runtimePolicySetV2: (request: RuntimePolicySetRequest) => Promise<RuntimePolicySnapshot>;
    kernelCapabilitiesListV2: () => Promise<KernelCapabilityDescriptor[]>;
    kernelSessionsListV2: (request?: KernelSessionsListRequest) => Promise<KernelSession[]>;
    kernelJobsListV2: (request?: KernelJobsListRequest) => Promise<KernelJob[]>;
    kernelContextSnapshotV2: (request: {
      kind: KernelContextSlice["scope"]["kind"];
      workspaceId?: string | null;
      threadId?: string | null;
      taskId?: string | null;
      runId?: string | null;
    }) => Promise<KernelContextSlice>;
    kernelExtensionsListV2: (
      request?: KernelExtensionsListRequest
    ) => Promise<KernelExtensionBundle[]>;
    kernelPoliciesEvaluateV2: (
      request: KernelPoliciesEvaluateRequest
    ) => Promise<KernelPolicyDecision>;
    kernelProjectionBootstrapV3: (
      request?: KernelProjectionBootstrapRequest
    ) => Promise<KernelProjectionBootstrapResponse>;
    acpIntegrationsList: () => Promise<AcpIntegrationSummary[]>;
    acpIntegrationUpsert: (input: AcpIntegrationUpsertInput) => Promise<AcpIntegrationSummary>;
    acpIntegrationRemove: (integrationId: string) => Promise<boolean>;
    acpIntegrationSetState: (
      request: AcpIntegrationSetStateRequest
    ) => Promise<AcpIntegrationSummary>;
    acpIntegrationProbe: (request: AcpIntegrationProbeRequest) => Promise<AcpIntegrationSummary>;
    runtimeBackendsList: () => Promise<RuntimeBackendSummary[]>;
    runtimeBackendUpsert: (input: RuntimeBackendUpsertInput) => Promise<RuntimeBackendSummary>;
    runtimeBackendRemove: (backendId: string) => Promise<boolean>;
    runtimeBackendSetState: (
      request: RuntimeBackendSetStateRequest
    ) => Promise<RuntimeBackendSummary>;
    codexExecRunV1: (request: RuntimeCodexExecRunRequest) => Promise<RuntimeCodexExecRunResponse>;
    codexCloudTasksListV1: (
      request?: RuntimeCodexCloudTasksListRequest
    ) => Promise<RuntimeCodexCloudTasksListResponse>;
    codexConfigPathGetV1: () => Promise<RuntimeCodexConfigPathResponse>;
    codexDoctorV1: (request?: RuntimeCodexDoctorRequest) => Promise<RuntimeCodexDoctorResponse>;
    codexUpdateV1: (request?: RuntimeCodexUpdateRequest) => Promise<RuntimeCodexUpdateResponse>;
    collaborationModesListV1: (
      workspaceId: string
    ) => Promise<RuntimeCollaborationModesListResponse>;
    mcpServerStatusListV1: (
      request: RuntimeMcpServerStatusListRequest
    ) => Promise<RuntimeMcpServerStatusListResponse>;
    browserDebugStatusV1: (
      request: RuntimeBrowserDebugStatusRequest
    ) => Promise<RuntimeBrowserDebugStatusResponse>;
    browserDebugRunV1: (
      request: RuntimeBrowserDebugRunRequest
    ) => Promise<RuntimeBrowserDebugRunResponse>;
    extensionsListV1: (workspaceId?: string | null) => Promise<RuntimeExtensionSpec[]>;
    extensionInstallV1: (request: RuntimeExtensionInstallRequest) => Promise<RuntimeExtensionSpec>;
    extensionRemoveV1: (request: {
      workspaceId?: string | null;
      extensionId: string;
    }) => Promise<boolean>;
    extensionToolsListV1: (request: {
      workspaceId?: string | null;
      extensionId: string;
    }) => Promise<RuntimeExtensionToolSummary[]>;
    extensionResourceReadV1: (
      request: RuntimeExtensionResourceReadRequest
    ) => Promise<RuntimeExtensionResourceReadResponse>;
    extensionsConfigV1: (workspaceId?: string | null) => Promise<RuntimeExtensionsConfigResponse>;
    sessionExportV1: (
      request: RuntimeSessionExportRequest
    ) => Promise<RuntimeSessionExportResponse>;
    sessionImportV1: (
      request: RuntimeSessionImportRequest
    ) => Promise<RuntimeSessionImportResponse>;
    sessionDeleteV1: (request: RuntimeSessionDeleteRequest) => Promise<boolean>;
    threadSnapshotsGetV1: (
      request: RuntimeThreadSnapshotsGetRequest
    ) => Promise<RuntimeThreadSnapshotsGetResponse>;
    threadSnapshotsSetV1: (
      request: RuntimeThreadSnapshotsSetRequest
    ) => Promise<RuntimeThreadSnapshotsSetResponse>;
    securityPreflightV1: (
      request: RuntimeSecurityPreflightRequest
    ) => Promise<RuntimeSecurityPreflightDecision>;
    runtimeDiagnosticsExportV1: (
      request: RuntimeDiagnosticsExportRequest
    ) => Promise<RuntimeDiagnosticsExportResponse>;
    distributedTaskGraph: (request: DistributedTaskGraphRequest) => Promise<DistributedTaskGraph>;
    runtimeToolMetricsRecord: (
      events: RuntimeToolExecutionEvent[]
    ) => Promise<RuntimeToolExecutionMetricsSnapshot>;
    runtimeToolMetricsRead: (
      query?: RuntimeToolExecutionMetricsReadRequest | null
    ) => Promise<RuntimeToolExecutionMetricsSnapshot>;
    runtimeToolMetricsReset: () => Promise<RuntimeToolExecutionMetricsSnapshot>;
    runtimeToolGuardrailEvaluate: (
      request: RuntimeToolGuardrailEvaluateRequest
    ) => Promise<RuntimeToolGuardrailEvaluateResult>;
    runtimeToolGuardrailRecordOutcome: (
      event: RuntimeToolGuardrailOutcomeEvent
    ) => Promise<RuntimeToolGuardrailStateSnapshot>;
    runtimeToolGuardrailRead: () => Promise<RuntimeToolGuardrailStateSnapshot>;
    models: () => Promise<ModelPoolEntry[]>;
    providersCatalog: () => Promise<RuntimeProviderCatalogEntry[]>;
    remoteStatus: () => Promise<RemoteStatus>;
    terminalStatus: () => Promise<TerminalStatus>;
    terminalOpen: (workspaceId: string) => Promise<TerminalSessionSummary>;
    terminalWrite: (sessionId: string, input: string) => Promise<TerminalSessionSummary | null>;
    terminalInputRaw: (sessionId: string, input: string) => Promise<boolean>;
    terminalRead: (sessionId: string) => Promise<TerminalSessionSummary | null>;
    terminalStreamStart: (sessionId: string) => Promise<boolean>;
    terminalStreamStop: (sessionId: string) => Promise<boolean>;
    terminalInterrupt: (sessionId: string) => Promise<boolean>;
    terminalResize: (sessionId: string, rows: number, cols: number) => Promise<boolean>;
    terminalClose: (sessionId: string) => Promise<boolean>;
    cliSessions: () => Promise<CliSessionSummary[]>;
    oauthAccounts: (
      provider?: OAuthProviderId | null,
      options?: { usageRefresh?: OAuthUsageRefreshMode | null }
    ) => Promise<OAuthAccountSummary[]>;
    oauthUpsertAccount: (input: OAuthAccountUpsertInput) => Promise<OAuthAccountSummary>;
    oauthRemoveAccount: (accountId: string) => Promise<boolean>;
    oauthPrimaryAccountGet: (provider: OAuthProviderId) => Promise<OAuthPrimaryAccountSummary>;
    oauthPrimaryAccountSet: (
      input: OAuthPrimaryAccountSetInput
    ) => Promise<OAuthPrimaryAccountSummary>;
    oauthPools: (provider?: OAuthProviderId | null) => Promise<OAuthPoolSummary[]>;
    oauthUpsertPool: (input: OAuthPoolUpsertInput) => Promise<OAuthPoolSummary>;
    oauthRemovePool: (poolId: string) => Promise<boolean>;
    oauthPoolMembers: (poolId: string) => Promise<OAuthPoolMember[]>;
    oauthApplyPool: (input: OAuthPoolApplyInput) => Promise<OAuthPoolApplyResult>;
    oauthReplacePoolMembers: (
      poolId: string,
      members: OAuthPoolMemberInput[]
    ) => Promise<OAuthPoolMember[]>;
    oauthSelectPoolAccount: (
      request: OAuthPoolSelectionRequest
    ) => Promise<OAuthPoolSelectionResult | null>;
    oauthBindPoolAccount: (
      request: OAuthPoolAccountBindRequest
    ) => Promise<OAuthPoolSelectionResult | null>;
    oauthReportRateLimit: (input: OAuthRateLimitReportInput) => Promise<boolean>;
    oauthChatgptAuthTokensRefresh: (
      request?: OAuthChatgptAuthTokensRefreshRequest
    ) => Promise<OAuthChatgptAuthTokensRefreshResponse | null>;
    oauthCodexLoginStart: (
      request: OAuthCodexLoginStartRequest
    ) => Promise<OAuthCodexLoginStartResponse>;
    oauthCodexLoginCancel: (
      request: OAuthCodexLoginCancelRequest
    ) => Promise<OAuthCodexLoginCancelResponse>;
    oauthCodexAccountsImportFromCockpitTools: () => Promise<RuntimeCockpitToolsCodexImportResponse>;
    liveSkills: () => Promise<LiveSkillSummary[]>;
    runLiveSkill: (request: LiveSkillExecuteRequest) => Promise<LiveSkillExecutionResult>;
    appSettingsGet: () => Promise<TAppSettings>;
    appSettingsUpdate: (settings: TAppSettings) => Promise<TAppSettings>;
    settings: () => Promise<SettingsSummary>;
    bootstrap: () => Promise<RuntimeBootstrapSnapshot>;
  };
