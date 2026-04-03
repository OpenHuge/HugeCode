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
  KernelContextSnapshotRequest,
  KernelContextSlice,
  KernelExtensionBundle,
  KernelJob,
  KernelExtensionsListRequest,
  KernelJobsListRequest,
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
  RuntimeCompositionProfile,
  RuntimeCompositionProfileGetV2Request,
  RuntimeCompositionProfileListV2Request,
  RuntimeCompositionProfileResolveV2Request,
  RuntimeCompositionProfileSummaryV2,
  RuntimeCompositionResolveV2Response,
  RuntimeCompositionSnapshotPublishRequest,
  RuntimeCompositionSnapshotPublishResponse,
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
  RuntimeExtensionCatalogListRequest,
  RuntimeExtensionGetRequest,
  RuntimeExtensionHealthReadRequest,
  RuntimeExtensionHealthReadResponse,
  RuntimeExtensionInstallRequest,
  RuntimeExtensionPermissionsEvaluateRequest,
  RuntimeExtensionPermissionsEvaluateResponse,
  RuntimeExtensionRecord,
  RuntimeExtensionRegistrySearchRequest,
  RuntimeExtensionRegistrySearchResponse,
  RuntimeExtensionRegistrySource,
  RuntimeExtensionRemoveRequest,
  RuntimeExtensionResourceReadRequest,
  RuntimeExtensionResourceReadResponse,
  RuntimeExtensionSetStateRequest,
  RuntimeExtensionToolInvokeRequest,
  RuntimeExtensionToolInvokeResponse,
  RuntimeExtensionToolSummary,
  RuntimeExtensionToolsListRequest,
  RuntimeMcpServerStatusListRequest,
  RuntimeMcpServerStatusListResponse,
  RuntimePolicySetRequest,
  RuntimePolicySnapshot,
  RuntimeProviderCatalogEntry,
  RuntimeRunCancelRequest,
  RuntimeRunCheckpointApprovalAck,
  RuntimeRunCheckpointApprovalRequest,
  RuntimeRunPrepareV2Request,
  RuntimeRunPrepareV2Response,
  RuntimeRunGetV2Request,
  RuntimeRunGetV2Response,
  RuntimeRunInterventionRequest,
  RuntimeRunInterventionV2Response,
  RuntimeRunCancelV2Response,
  RuntimeRunResumeRequest,
  RuntimeRunResumeV2Response,
  RuntimeRunsListRequest,
  RuntimeRunStartRequest,
  RuntimeRunStartV2Response,
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
  RuntimeTextFileReadRequest,
  RuntimeTextFileResponse,
  RuntimeTextFileWriteRequest,
  RuntimeToolExecutionEvent,
  RuntimeToolExecutionMetricsReadRequest,
  RuntimeToolExecutionMetricsSnapshot,
  RuntimeToolGuardrailEvaluateRequest,
  RuntimeToolGuardrailEvaluateResult,
  RuntimeToolGuardrailOutcomeEvent,
  RuntimeToolGuardrailStateSnapshot,
  RuntimeToolOutcomeRecordRequest,
  RuntimeToolPreflightV2Request,
  RuntimeExtensionUpdateRequest,
} from "@ku0/code-runtime-host-contract";

export type RuntimeClientMode = "electron-bridge" | "runtime-gateway-web" | "unavailable";

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
    /**
     * @deprecated Compatibility-only thread lifecycle surface. Product launch,
     * resume, intervene, and follow-up flows should prefer the runtime run v2
     * lifecycle methods.
     */
    threads: (workspaceId: string) => Promise<ThreadSummary[]>;
    /**
     * @deprecated Compatibility-only thread lifecycle surface.
     */
    createThread: (payload: ThreadCreateRequest) => Promise<ThreadSummary>;
    /**
     * @deprecated Compatibility-only thread lifecycle surface.
     */
    resumeThread: (workspaceId: string, threadId: string) => Promise<ThreadSummary | null>;
    /**
     * @deprecated Compatibility-only thread lifecycle surface.
     */
    archiveThread: (workspaceId: string, threadId: string) => Promise<boolean>;
    /**
     * @deprecated Compatibility-only thread lifecycle surface.
     */
    threadLiveSubscribe: (
      workspaceId: string,
      threadId: string
    ) => Promise<Record<string, unknown>>;
    /**
     * @deprecated Compatibility-only thread lifecycle surface.
     */
    threadLiveUnsubscribe: (subscriptionId: string) => Promise<Record<string, unknown>>;
    /**
     * @deprecated Compatibility-only thread/turn execution surface.
     */
    sendTurn: (payload: TurnSendRequest) => Promise<TurnAck>;
    /**
     * @deprecated Compatibility-only thread/turn execution surface.
     */
    interruptTurn: (payload: TurnInterruptRequest) => Promise<boolean>;
    runtimeRunPrepareV2: (
      request: RuntimeRunPrepareV2Request
    ) => Promise<RuntimeRunPrepareV2Response>;
    runtimeRunStartV2: (request: RuntimeRunStartRequest) => Promise<RuntimeRunStartV2Response>;
    runtimeRunGetV2: (request: RuntimeRunGetV2Request) => Promise<RuntimeRunGetV2Response>;
    runtimeRunInterveneV2: (
      request: RuntimeRunInterventionRequest
    ) => Promise<RuntimeRunInterventionV2Response>;
    runtimeRunCancelV2: (request: RuntimeRunCancelRequest) => Promise<RuntimeRunCancelV2Response>;
    runtimeRunResumeV2: (request: RuntimeRunResumeRequest) => Promise<RuntimeRunResumeV2Response>;
    runtimeRunSubscribeV2: (
      request: RuntimeRunGetV2Request
    ) => Promise<RuntimeRunSubscribeV2Response>;
    runtimeReviewGetV2: (request: RuntimeReviewGetV2Request) => Promise<RuntimeReviewGetV2Response>;
    runtimeRunsList: (request: RuntimeRunsListRequest) => Promise<RuntimeRunSummary[]>;
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
    kernelContextSnapshotV2: (request: KernelContextSnapshotRequest) => Promise<KernelContextSlice>;
    kernelExtensionsListV2: (
      request?: KernelExtensionsListRequest
    ) => Promise<KernelExtensionBundle[]>;
    kernelPoliciesEvaluateV2: (
      request: KernelPoliciesEvaluateRequest
    ) => Promise<KernelPolicyDecision>;
    kernelProjectionBootstrapV3: (
      request?: KernelProjectionBootstrapRequest
    ) => Promise<KernelProjectionBootstrapResponse>;
    runtimeCompositionProfileListV2: (
      request: RuntimeCompositionProfileListV2Request
    ) => Promise<RuntimeCompositionProfileSummaryV2[]>;
    runtimeCompositionProfileGetV2: (
      request: RuntimeCompositionProfileGetV2Request
    ) => Promise<RuntimeCompositionProfile | null>;
    runtimeCompositionProfileResolveV2: (
      request: RuntimeCompositionProfileResolveV2Request
    ) => Promise<RuntimeCompositionResolveV2Response>;
    runtimeCompositionSnapshotPublishV1: (
      request: RuntimeCompositionSnapshotPublishRequest
    ) => Promise<RuntimeCompositionSnapshotPublishResponse>;
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
    extensionCatalogListV2: (
      request?: RuntimeExtensionCatalogListRequest
    ) => Promise<RuntimeExtensionRecord[]>;
    extensionGetV2: (request: RuntimeExtensionGetRequest) => Promise<RuntimeExtensionRecord | null>;
    extensionInstallV2: (
      request: RuntimeExtensionInstallRequest
    ) => Promise<RuntimeExtensionRecord>;
    extensionUpdateV2: (request: RuntimeExtensionUpdateRequest) => Promise<RuntimeExtensionRecord>;
    extensionSetStateV2: (
      request: RuntimeExtensionSetStateRequest
    ) => Promise<RuntimeExtensionRecord | null>;
    extensionRemoveV2: (request: RuntimeExtensionRemoveRequest) => Promise<boolean>;
    extensionRegistrySearchV2: (
      request?: RuntimeExtensionRegistrySearchRequest
    ) => Promise<RuntimeExtensionRegistrySearchResponse>;
    extensionRegistrySourcesV2: () => Promise<RuntimeExtensionRegistrySource[]>;
    extensionPermissionsEvaluateV2: (
      request: RuntimeExtensionPermissionsEvaluateRequest
    ) => Promise<RuntimeExtensionPermissionsEvaluateResponse>;
    extensionHealthReadV2: (
      request: RuntimeExtensionHealthReadRequest
    ) => Promise<RuntimeExtensionHealthReadResponse>;
    extensionToolsListV2: (
      request: RuntimeExtensionToolsListRequest
    ) => Promise<RuntimeExtensionToolSummary[]>;
    extensionToolInvokeV2: (
      request: RuntimeExtensionToolInvokeRequest
    ) => Promise<RuntimeExtensionToolInvokeResponse>;
    extensionResourceReadV2: (
      request: RuntimeExtensionResourceReadRequest
    ) => Promise<RuntimeExtensionResourceReadResponse>;
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
    textFileReadV1: (request: RuntimeTextFileReadRequest) => Promise<RuntimeTextFileResponse>;
    textFileWriteV1: (request: RuntimeTextFileWriteRequest) => Promise<boolean>;
    settings: () => Promise<SettingsSummary>;
    bootstrap: () => Promise<RuntimeBootstrapSnapshot>;
  };
