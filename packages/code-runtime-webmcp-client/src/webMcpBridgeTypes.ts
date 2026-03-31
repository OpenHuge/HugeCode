import type {
  ActionRequiredRecord,
  ActionRequiredStatus,
  AgentTaskApprovalStateSummary,
  ActionRequiredSubmitRequest,
  AgentTaskAutoDriveState,
  AgentTaskExecutionMode,
  AgentTaskExecutionProfile,
  AgentTaskExecutionProfileReadiness,
  AgentTaskInterventionSummary,
  AgentTaskMissionBrief,
  AgentTaskNextAction,
  AgentTaskOperatorState,
  AgentTaskRelaunchContext,
  AgentTaskReviewDecisionSummary,
  AgentTaskRoutingSummary,
  AgentTaskSourceSummary,
  AgentTaskStepSummary,
  AgentTaskSummary,
  HugeCodeReviewPackSummary,
  HugeCodeRunSummary,
  HugeCodeTaskSourceSummary,
  LiveSkillExecuteRequest,
  LiveSkillExecutionResult,
  LiveSkillSummary,
  OAuthAccountUpsertInput,
  OAuthPoolApplyInput,
  OAuthPoolSelectionRequest,
  OAuthProviderId,
  OAuthUsageRefreshMode,
  PromptLibraryScope,
  RuntimeBrowserDebugRunRequest,
  RuntimeBrowserDebugRunResponse,
  RuntimeBrowserDebugStatusRequest,
  RuntimeBrowserDebugStatusResponse,
  RuntimeApprovalEvent,
  RuntimeCheckpointState,
  RuntimeCompactionSummary,
  RuntimeExtensionInstallRequest,
  SubAgentScopeProfile,
  SubAgentScopeProfileDescriptor,
  WorkspaceDiagnosticsListRequest,
  WorkspaceDiagnosticsListResponse,
} from "@ku0/code-runtime-host-contract";
import type {
  ApprovalRequest,
  RequestUserInputRequest,
  RequestUserInputResponse,
} from "./webMcpBridgeAppTypes";

export type WebMcpAgent = {
  requestUserInteraction?: <T>(request: () => Promise<T> | T) => Promise<T>;
  provider?: string | null;
  modelId?: string | null;
  model_id?: string | null;
  model?: {
    provider?: string | null;
    id?: string | null;
  } | null;
  context?: {
    provider?: string | null;
    modelId?: string | null;
    model_id?: string | null;
  } | null;
};

export type AgentIntentPriority = "low" | "medium" | "high" | "critical";
export type AgentTaskPriority = "low" | "medium" | "high";
export type AgentTaskStatus =
  | "backlog"
  | "in_progress"
  | "paused"
  | "review"
  | "done"
  | "cancelled";
export type AgentAuditCategory =
  | "intent"
  | "task"
  | "governance"
  | "coordination"
  | "runtime"
  | "system";
export type AgentAuditLevel = "info" | "warning" | "error";
export type RuntimeAgentTaskStatus =
  | "queued"
  | "running"
  | "paused"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "cancelled"
  | "interrupted";
export type RuntimeAgentTaskExecutionMode = "single" | "distributed";
export type RuntimeAgentTaskStepKind =
  | "read"
  | "write"
  | "edit"
  | "bash"
  | "js_repl"
  | "diagnostics";
export type RuntimeAgentAccessMode = "read-only" | "on-request" | "full-access";
export type RuntimeAgentReasonEffort = "low" | "medium" | "high" | "xhigh";
export type RuntimeSubAgentSessionStatus =
  | "idle"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "cancelled"
  | "interrupted"
  | "closed";

export type RuntimeAgentTaskStepInput = {
  kind: RuntimeAgentTaskStepKind;
  input?: string | null;
  requiresApproval?: boolean | null;
  approvalReason?: string | null;
};

export type JsonRecord = Record<string, unknown>;

export type RuntimeInvocationActivationState =
  | "discovered"
  | "verified"
  | "installed"
  | "bound"
  | "active"
  | "degraded"
  | "refresh_pending"
  | "deactivated"
  | "failed"
  | "uninstalled";

export type RuntimeInvocationReadinessState = "ready" | "attention" | "blocked";

export type RuntimeInvocationKind = "invocation" | "skill" | "route" | "host_binding";

export type RuntimeInvocationBindingStage =
  | "compile_time_descriptor"
  | "runtime_binding"
  | "session_overlay";

export type RuntimeInvocationSourceType =
  | "runtime_plugin"
  | "behavior_asset"
  | "registry_package"
  | "session_overlay";

export type RuntimeInvocationSourceScope =
  | "runtime"
  | "workspace"
  | "package"
  | "session_overlay"
  | "host";

export type RuntimeInvocationDiagnostic = {
  phase: string;
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  at: number;
};

export type RuntimeInvocationTransition = {
  state: RuntimeInvocationActivationState;
  at: number;
  reason: string;
};

export type RuntimeInvocationDescriptor = {
  id: string;
  title: string;
  version: string;
  kind: RuntimeInvocationKind;
  bindingStage: RuntimeInvocationBindingStage;
  live: boolean;
  activationState: RuntimeInvocationActivationState;
  readiness: {
    state: RuntimeInvocationReadinessState;
    summary: string;
    detail: string;
  };
  diagnostics: RuntimeInvocationDiagnostic[];
  transitionHistory: RuntimeInvocationTransition[];
  source: {
    activationId: string;
    sourceType: RuntimeInvocationSourceType;
    sourceScope: RuntimeInvocationSourceScope;
    sourceRef: string;
    pluginId: string | null;
    packageRef: string | null;
    overlayId: string | null;
    sessionId: string | null;
  };
  metadata: JsonRecord | null;
};

export type RuntimeInvocationCatalogSnapshot = {
  workspaceId: string;
  sessionId: string | null;
  refreshedAt: number;
  entries: RuntimeInvocationDescriptor[];
  activeEntries: RuntimeInvocationDescriptor[];
  summary: {
    total: number;
    active: number;
    degraded: number;
    failed: number;
    deactivated: number;
    refreshPending: number;
  };
};

type RuntimeBrowserAssessmentResult = {
  status: "passed" | "failed" | "error";
  target:
    | {
        kind: "fixture";
        fixtureName: string;
      }
    | {
        kind: "route";
        routePath: string;
      };
  domSnapshot: {
    childElementCount: number;
    html: string | null;
    selector: string | null;
    selectorMatched: boolean;
    text: string | null;
  } | null;
  consoleEntries: Array<{
    level: "log" | "info" | "warn" | "error";
    line?: number | null;
    message: string;
    sourceId?: string | null;
  }>;
  accessibilityFailures: Array<{
    code: string;
    message: string;
    selector?: string | null;
  }>;
  sourceUrl?: string | null;
  title?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  traceId?: string | null;
  trace: Array<{
    at: string;
    stage: "proxy" | "render" | "collect" | "audit" | "transport" | "error";
    message: string;
    code?: string | null;
    detail?: string | null;
  }>;
};

export type WebMcpToolAnnotations = {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
  title?: string;
  taskSupport?: "none" | "partial" | "full";
};

export type WebMcpToolDescriptor = {
  name: string;
  description: string;
  inputSchema: JsonRecord;
  annotations?: WebMcpToolAnnotations;
  execute: (input: JsonRecord, agent: WebMcpAgent | null) => unknown;
};

export type WebMcpContextPayload = {
  tools?: WebMcpToolDescriptor[];
  resources?: WebMcpResourceDescriptor[];
  prompts?: WebMcpPromptDescriptor[];
};

export type WebMcpResourceDescriptor = {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  read: (uri: URL, params?: Record<string, string>) => Promise<{ contents: unknown[] }>;
};

export type WebMcpPromptDescriptor = {
  name: string;
  description?: string;
  argsSchema?: JsonRecord;
  get: (args: Record<string, unknown>) => Promise<{ messages: unknown[] }>;
};

type RuntimeAgentTaskSummaryCore = Pick<
  AgentTaskSummary,
  | "taskId"
  | "workspaceId"
  | "threadId"
  | "title"
  | "status"
  | "accessMode"
  | "distributedStatus"
  | "currentStep"
  | "createdAt"
  | "updatedAt"
  | "startedAt"
  | "completedAt"
  | "errorCode"
  | "errorMessage"
  | "pendingApprovalId"
  | "checkpointId"
  | "traceId"
  | "recovered"
>;

type RuntimeAgentTaskTruthFields = Partial<
  Pick<
    AgentTaskSummary,
    | "requestId"
    | "executionMode"
    | "provider"
    | "modelId"
    | "reasonEffort"
    | "routedProvider"
    | "routedModelId"
    | "routedPool"
    | "routedSource"
    | "executionProfileId"
    | "executionProfile"
    | "profileReadiness"
    | "routing"
    | "approvalState"
    | "reviewDecision"
    | "reviewPackId"
    | "intervention"
    | "operatorState"
    | "nextAction"
    | "missionBrief"
    | "relaunchContext"
    | "publishHandoff"
    | "autoDrive"
    | "checkpointState"
    | "missionLinkage"
    | "reviewActionability"
    | "takeoverBundle"
    | "executionGraph"
    | "runSummary"
    | "reviewPackSummary"
    | "backendId"
    | "acpIntegrationId"
    | "acpSessionId"
    | "acpConfigOptions"
    | "acpAvailableCommands"
    | "preferredBackendIds"
    | "taskSource"
    | "rootTaskId"
    | "parentTaskId"
    | "childTaskIds"
    | "steps"
  >
>;

export type RuntimeAgentTaskSummary = RuntimeAgentTaskSummaryCore &
  RuntimeAgentTaskTruthFields & {
    executionMode?: AgentTaskExecutionMode | null;
    executionProfile?: AgentTaskExecutionProfile | null;
    profileReadiness?: AgentTaskExecutionProfileReadiness | null;
    routing?: AgentTaskRoutingSummary | null;
    approvalState?: AgentTaskApprovalStateSummary | null;
    reviewDecision?: AgentTaskReviewDecisionSummary | null;
    reviewPackId?: string | null;
    intervention?: AgentTaskInterventionSummary | null;
    operatorState?: AgentTaskOperatorState | null;
    nextAction?: AgentTaskNextAction | null;
    missionBrief?: AgentTaskMissionBrief | null;
    relaunchContext?: AgentTaskRelaunchContext | null;
    publishHandoff?: AgentTaskSummary["publishHandoff"] | null;
    autoDrive?: AgentTaskAutoDriveState | null;
    checkpointState?: AgentTaskSummary["checkpointState"] | null;
    missionLinkage?: AgentTaskSummary["missionLinkage"] | null;
    reviewActionability?: AgentTaskSummary["reviewActionability"] | null;
    takeoverBundle?: AgentTaskSummary["takeoverBundle"] | null;
    executionGraph?: AgentTaskSummary["executionGraph"] | null;
    runSummary?: HugeCodeRunSummary | null;
    reviewPackSummary?: HugeCodeReviewPackSummary | null;
    acpIntegrationId?: string | null;
    acpSessionId?: string | null;
    acpConfigOptions?: Record<string, unknown> | null;
    acpAvailableCommands?: unknown[] | Record<string, unknown> | null;
    taskSource?: AgentTaskSourceSummary | null;
    steps?: AgentTaskStepSummary[];
  };

export type RuntimeSubAgentSessionSummary = {
  sessionId: string;
  workspaceId: string;
  threadId: string | null;
  title: string | null;
  status: RuntimeSubAgentSessionStatus;
  accessMode: RuntimeAgentAccessMode;
  reasonEffort: RuntimeAgentReasonEffort | null;
  provider: string | null;
  modelId: string | null;
  activeTaskId: string | null;
  lastTaskId: string | null;
  createdAt: number;
  updatedAt: number;
  closedAt: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  scopeProfile?: SubAgentScopeProfile | null;
  allowedSkillIds?: string[] | null;
  allowNetwork?: boolean | null;
  workspaceReadPaths?: string[] | null;
  parentRunId?: string | null;
  profileDescriptor?: SubAgentScopeProfileDescriptor | null;
  checkpointId?: string | null;
  traceId?: string | null;
  recovered?: boolean | null;
  checkpointState?: RuntimeCheckpointState | null;
  approvalEvents?: RuntimeApprovalEvent[] | null;
  compactionSummary?: RuntimeCompactionSummary | null;
  evalTags?: string[] | null;
};

export type WebMcpRegistrationHandle = {
  unregister?: () => void | Promise<void>;
};

export type WebMcpModelContext = {
  provideContext?: (payload: WebMcpContextPayload) => void | Promise<void>;
  clearContext?: () => void | Promise<void>;
  registerTool?: (
    tool: WebMcpToolDescriptor
  ) => WebMcpRegistrationHandle | undefined | Promise<WebMcpRegistrationHandle | undefined>;
  unregisterTool?: (toolName: string) => void | Promise<void>;
  listTools?: () => unknown[] | Promise<unknown[]>;
  callTool?: (params: { name: string; arguments?: JsonRecord }) => unknown | Promise<unknown>;
  registerResource?: (
    resource: WebMcpResourceDescriptor
  ) => WebMcpRegistrationHandle | undefined | Promise<WebMcpRegistrationHandle | undefined>;
  unregisterResource?: (uri: string) => void | Promise<void>;
  listResources?: () => unknown[] | Promise<unknown[]>;
  listResourceTemplates?: () => unknown[] | Promise<unknown[]>;
  registerPrompt?: (
    prompt: WebMcpPromptDescriptor
  ) => WebMcpRegistrationHandle | undefined | Promise<WebMcpRegistrationHandle | undefined>;
  unregisterPrompt?: (name: string) => void | Promise<void>;
  listPrompts?: () => unknown[] | Promise<unknown[]>;
  createMessage?: (params: JsonRecord) => unknown | Promise<unknown>;
  elicitInput?: (params: JsonRecord) => unknown | Promise<unknown>;
};

export type WebMcpCapabilityMatrix = {
  modelContext: boolean;
  tools: {
    provideContext: boolean;
    clearContext: boolean;
    registerTool: boolean;
    unregisterTool: boolean;
    listTools: boolean;
    callTool: boolean;
  };
  resources: {
    registerResource: boolean;
    unregisterResource: boolean;
    listResources: boolean;
    listResourceTemplates: boolean;
  };
  prompts: {
    registerPrompt: boolean;
    unregisterPrompt: boolean;
    listPrompts: boolean;
  };
  model: {
    createMessage: boolean;
    elicitInput: boolean;
  };
  supported: boolean;
  missingRequired: string[];
};

export type WebMcpCatalog = {
  tools: unknown[];
  resources: unknown[];
  resourceTemplates: unknown[];
  prompts: unknown[];
  capabilities: WebMcpCapabilityMatrix;
};

export type WebMcpCallToolInput = {
  name: string;
  arguments?: JsonRecord;
};

export type WebMcpCreateMessageInput = {
  messages: Array<Record<string, unknown>>;
  maxTokens: number;
  systemPrompt?: string;
  temperature?: number;
  stopSequences?: string[];
  modelPreferences?: Record<string, unknown>;
  includeContext?: "none" | "thisServer" | "allServers";
  metadata?: Record<string, unknown>;
};

export type WebMcpElicitInput =
  | {
      mode?: "form";
      message: string;
      requestedSchema: Record<string, unknown>;
    }
  | {
      mode: "url";
      message: string;
      elicitationId: string;
      url: string;
    };

export type RuntimeSubAgentSessionHandle = {
  sessionId: string;
  status: RuntimeSubAgentSessionStatus;
  activeTaskId: string | null;
  lastTaskId: string | null;
  checkpointId: string | null;
  traceId: string | null;
  recovered: boolean | null;
};

export type RuntimeSkillIdResolution = {
  requestedSkillId: string;
  resolvedSkillId: string;
  aliasApplied: boolean;
  acceptedSkillIds: string[];
};

export type RuntimeAllowedSkillResolution = {
  requestedSkillIds: string[];
  resolvedSkillIds: string[];
  entries: RuntimeSkillIdResolution[];
};

export type RuntimeSubAgentSendInput = {
  sessionId: string;
  instruction: string;
  requestId?: string;
  requiresApproval?: boolean;
  approvalReason?: string | null;
};

export type RuntimeSubAgentSendResult = {
  session: RuntimeSubAgentSessionSummary;
  task: RuntimeAgentTaskSummary | null;
};

export type RuntimeSubAgentWaitInput = {
  sessionId: string;
  timeoutMs?: number | null;
  pollIntervalMs?: number | null;
};

export type RuntimeSubAgentWaitResult = {
  session: RuntimeSubAgentSessionSummary;
  task: RuntimeAgentTaskSummary | null;
  done: boolean;
  timedOut: boolean;
};

export type RuntimeSubAgentStatusInput = {
  sessionId: string;
};

export type RuntimeSubAgentInterruptInput = {
  sessionId: string;
  reason?: string | null;
};

export type RuntimeSubAgentInterruptResult = {
  accepted: boolean;
  sessionId: string;
  taskId: string | null;
  status: RuntimeSubAgentSessionStatus;
  message: string;
};

export type RuntimeSubAgentCloseInput = {
  sessionId: string;
  reason?: string | null;
  force?: boolean;
};

export type RuntimeSubAgentCloseResult = {
  closed: boolean;
  sessionId: string;
  status: RuntimeSubAgentSessionStatus;
  message: string;
};

export type RuntimeAgentTaskListInput = {
  workspaceId?: string | null;
  status?: RuntimeAgentTaskStatus | null;
  limit?: number | null;
};

export type RuntimeAgentTaskStartInput = {
  workspaceId: string;
  /**
   * @deprecated Compatibility-only bridge back to legacy thread ownership.
   * New product lifecycle work should launch kernel v2 runs without depending
   * on thread identity as the primary execution contract.
   */
  threadId?: string | null;
  /**
   * @deprecated Compatibility-only carry-over from the thread/turn pipeline.
   * Canonical kernel v2 lifecycle state should be tracked by run id.
   */
  requestId?: string;
  title?: string | null;
  taskSource?: HugeCodeTaskSourceSummary | null;
  executionProfileId?: string | null;
  reviewProfileId?: string | null;
  validationPresetId?: string | null;
  instruction: string;
  stepKind?: RuntimeAgentTaskStepKind;
  accessMode?: RuntimeAgentAccessMode;
  executionMode?: RuntimeAgentTaskExecutionMode;
  reasonEffort?: RuntimeAgentReasonEffort | null;
  provider?: string | null;
  modelId?: string | null;
  requiredCapabilities?: string[];
  maxSubtasks?: number;
  preferredBackendIds?: string[];
  missionBrief?: AgentTaskMissionBrief | null;
  relaunchContext?: AgentTaskRelaunchContext | null;
  approvedPlanVersion?: string | null;
  autoDrive?: AgentTaskAutoDriveState | null;
  requiresApproval?: boolean;
  approvalReason?: string | null;
};

export type RuntimeAgentTaskInterruptInput = {
  taskId: string;
  reason?: string | null;
};

export type RuntimeAgentTaskInterventionAction =
  | "pause"
  | "resume"
  | "cancel"
  | "retry"
  | "continue_with_clarification"
  | "narrow_scope"
  | "relax_validation"
  | "replan_scope"
  | "drop_feature"
  | "insert_feature"
  | "change_validation_lane"
  | "change_backend_preference"
  | "mark_blocked_with_reason"
  | "switch_profile_and_retry"
  | "escalate_to_pair_mode";

export type RuntimeAgentTaskInterventionInput = {
  taskId: string;
  action: RuntimeAgentTaskInterventionAction;
  reason?: string | null;
  instructionPatch?: string | null;
  executionProfileId?: string | null;
  reviewProfileId?: string | null;
  preferredBackendIds?: string[] | null;
  relaunchContext?: AgentTaskRelaunchContext | null;
  approvedPlanVersion?: string | null;
};

export type RuntimeAgentTaskInterventionOutcome =
  | "submitted"
  | "spawned"
  | "completed"
  | "blocked"
  | "unsupported"
  | "unavailable";

export type RuntimeAgentTaskInterventionResult = {
  accepted: boolean;
  action: RuntimeAgentTaskInterventionAction;
  taskId: string;
  status: RuntimeAgentTaskStatus | null;
  outcome: RuntimeAgentTaskInterventionOutcome;
  spawnedTaskId?: string | null;
  checkpointId?: string | null;
};

export type RuntimeAgentTaskResumeInput = {
  taskId: string;
  reason?: string | null;
};

export type RuntimeAgentTaskInterruptResult = {
  accepted: boolean;
  taskId: string;
  status: RuntimeAgentTaskStatus;
  message: string;
};

export type RuntimeAgentTaskResumeResult = {
  accepted: boolean;
  taskId: string;
  status: RuntimeAgentTaskStatus;
  code?: string | null;
  message: string;
  recovered?: boolean | null;
  checkpointId?: string | null;
  traceId?: string | null;
  updatedAt?: number | null;
};

export type RuntimeAgentApprovalDecision = "approved" | "rejected";

export type RuntimeAgentApprovalDecisionInput = {
  approvalId: string;
  decision: RuntimeAgentApprovalDecision;
  reason?: string | null;
};

export type RuntimeAgentApprovalDecisionResult = {
  recorded: boolean;
  approvalId: string;
  taskId: string | null;
  status: RuntimeAgentTaskStatus | null;
  message: string;
};

export type RuntimeAgentControl = {
  listTasks: (input: RuntimeAgentTaskListInput) => Promise<RuntimeAgentTaskSummary[]>;
  getTaskStatus: (taskId: string) => Promise<RuntimeAgentTaskSummary | null>;
  startTask: (input: RuntimeAgentTaskStartInput) => Promise<RuntimeAgentTaskSummary>;
  interveneTask?: (
    input: RuntimeAgentTaskInterventionInput
  ) => Promise<RuntimeAgentTaskInterventionResult>;
  interruptTask: (
    input: RuntimeAgentTaskInterruptInput
  ) => Promise<RuntimeAgentTaskInterruptResult>;
  resumeTask?: (input: RuntimeAgentTaskResumeInput) => Promise<RuntimeAgentTaskResumeResult>;
  submitTaskApprovalDecision: (
    input: RuntimeAgentApprovalDecisionInput
  ) => Promise<RuntimeAgentApprovalDecisionResult>;
  actionRequiredGetV2?: (requestId: string) => Promise<ActionRequiredRecord | null>;
  actionRequiredSubmitV2?: (input: ActionRequiredSubmitRequest) => Promise<ActionRequiredStatus>;
  respondToServerRequest?: (
    workspaceId: string,
    requestId: number | string,
    decision: "accept" | "decline"
  ) => Promise<unknown>;
  respondToUserInputRequest?: (
    workspaceId: string,
    requestId: number | string,
    answers: RequestUserInputResponse["answers"]
  ) => Promise<unknown>;
  respondToServerRequestResult?: (
    workspaceId: string,
    requestId: number | string,
    result: Record<string, unknown>
  ) => Promise<unknown>;
  getRuntimePolicy?: () => Promise<unknown>;
  setRuntimePolicy?: (input: {
    mode: "strict" | "balanced" | "aggressive";
    actor?: string | null;
  }) => Promise<unknown>;
  runtimeToolMetricsRead?: () => Promise<unknown>;
  runtimeToolGuardrailRead?: () => Promise<unknown>;
  runtimeBackendsList?: (workspaceId?: string | null) => Promise<unknown>;
  runtimeBackendSetState?: (input: {
    backendId: string;
    workspaceId?: string | null;
    status?: "active" | "draining" | "disabled";
    rolloutState?: "current" | "ramping" | "draining" | "drained";
    force?: boolean;
    reason?: string | null;
  }) => Promise<unknown>;
  runtimeBackendRemove?: (input: {
    backendId: string;
    workspaceId?: string | null;
  }) => Promise<boolean | null>;
  runtimeBackendUpsert?: (input: {
    backendId: string;
    workspaceId?: string | null;
    displayName: string;
    capabilities: string[];
    maxConcurrency: number;
    costTier: string;
    latencyClass: string;
    rolloutState: "current" | "ramping" | "draining" | "drained";
    status: "active" | "draining" | "disabled";
  }) => Promise<unknown>;
  distributedTaskGraph?: (input?: {
    taskId?: string | null;
    limit?: number | null;
    includeDiagnostics?: boolean | null;
  }) => Promise<unknown>;
  getRuntimeCapabilitiesSummary?: () => Promise<unknown>;
  getRuntimeHealth?: () => Promise<unknown>;
  getRuntimeRemoteStatus?: () => Promise<unknown>;
  getRuntimeSettings?: () => Promise<unknown>;
  getRuntimeBootstrapSnapshot?: () => Promise<unknown>;
  getRuntimeTerminalStatus?: () => Promise<unknown>;
  openRuntimeTerminalSession?: (input?: { workspaceId?: string | null }) => Promise<unknown>;
  readRuntimeTerminalSession?: (sessionId: string) => Promise<unknown>;
  writeRuntimeTerminalSession?: (input: { sessionId: string; input: string }) => Promise<unknown>;
  interruptRuntimeTerminalSession?: (sessionId: string) => Promise<unknown>;
  resizeRuntimeTerminalSession?: (input: {
    sessionId: string;
    rows: number;
    cols: number;
  }) => Promise<unknown>;
  closeRuntimeTerminalSession?: (sessionId: string) => Promise<unknown>;
  runtimeDiagnosticsExportV1?: (input?: {
    workspaceId?: string | null;
    redactionLevel?: "strict" | "balanced" | "minimal";
    includeTaskSummaries?: boolean;
  }) => Promise<unknown>;
  runtimeSessionExportV1?: (input: {
    workspaceId: string;
    threadId: string;
    includeAgentTasks?: boolean;
  }) => Promise<unknown>;
  runtimeSessionImportV1?: (input: {
    workspaceId: string;
    snapshot: Record<string, unknown>;
    threadId?: string | null;
  }) => Promise<unknown>;
  runtimeSessionDeleteV1?: (input: { workspaceId: string; threadId: string }) => Promise<boolean>;
  runtimeSecurityPreflightV1?: (input: {
    workspaceId?: string | null;
    toolName?: string | null;
    command?: string | null;
    input?: Record<string, unknown> | null;
    checkPackageAdvisory?: boolean;
    checkExecPolicy?: boolean;
    execPolicyRules?: string[] | null;
  }) => Promise<unknown>;
  runRuntimeCodexDoctor?: (input?: {
    codexBin?: string | null;
    codexArgs?: string[] | null;
  }) => Promise<unknown>;
  runRuntimeCodexUpdate?: (input?: {
    codexBin?: string | null;
    codexArgs?: string[] | null;
  }) => Promise<unknown>;
  listRuntimePrompts?: (workspaceId?: string | null) => Promise<unknown>;
  createRuntimePrompt?: (input: {
    workspaceId?: string | null;
    scope: PromptLibraryScope;
    title: string;
    description: string;
    content: string;
  }) => Promise<unknown>;
  updateRuntimePrompt?: (input: {
    workspaceId?: string | null;
    promptId: string;
    title: string;
    description: string;
    content: string;
  }) => Promise<unknown>;
  deleteRuntimePrompt?: (input: {
    workspaceId?: string | null;
    promptId: string;
  }) => Promise<boolean | null>;
  moveRuntimePrompt?: (input: {
    workspaceId?: string | null;
    promptId: string;
    targetScope: PromptLibraryScope;
  }) => Promise<unknown>;
  listRuntimeOAuthAccounts?: (
    provider?: OAuthProviderId | null,
    options?: { usageRefresh?: OAuthUsageRefreshMode | null }
  ) => Promise<unknown>;
  getRuntimeAccountInfo?: (workspaceId: string) => Promise<unknown>;
  getRuntimeAccountRateLimits?: (workspaceId: string) => Promise<unknown>;
  upsertRuntimeOAuthAccount?: (input: OAuthAccountUpsertInput) => Promise<unknown>;
  removeRuntimeOAuthAccount?: (accountId: string) => Promise<boolean>;
  listRuntimeOAuthPools?: (provider?: OAuthProviderId | null) => Promise<unknown>;
  listRuntimeOAuthPoolMembers?: (poolId: string) => Promise<unknown>;
  applyRuntimeOAuthPool?: (input: OAuthPoolApplyInput) => Promise<unknown>;
  removeRuntimeOAuthPool?: (poolId: string) => Promise<boolean>;
  selectRuntimeOAuthPoolAccount?: (input: OAuthPoolSelectionRequest) => Promise<unknown>;
  listRuntimeModels?: () => Promise<unknown>;
  listRuntimeProviderCatalog?: () => Promise<unknown>;
  listRuntimeCollaborationModes?: (workspaceId: string) => Promise<unknown>;
  listRuntimeMcpServerStatus?: (input: {
    workspaceId: string;
    cursor?: string | null;
    limit?: number | null;
  }) => Promise<unknown>;
  getRuntimeBrowserDebugStatus?: (
    input: RuntimeBrowserDebugStatusRequest
  ) => Promise<RuntimeBrowserDebugStatusResponse>;
  assessRuntimeBrowserSurface?: (input: {
    workspaceId: string;
    target:
      | {
          kind: "fixture";
          fixtureName: string;
        }
      | {
          kind: "route";
          routePath: string;
        };
    selector?: string | null;
    waitForMs?: number | null;
  }) => Promise<RuntimeBrowserAssessmentResult | null>;
  runRuntimeBrowserDebug?: (
    input: RuntimeBrowserDebugRunRequest
  ) => Promise<RuntimeBrowserDebugRunResponse>;
  listWorkspaceDiagnostics?: (
    input: WorkspaceDiagnosticsListRequest
  ) => Promise<WorkspaceDiagnosticsListResponse | null>;
  applyWorkspacePatch?: (input: {
    workspaceId: string;
    diff: string;
    dryRun?: boolean | null;
  }) => Promise<unknown>;
  listRuntimeExtensions?: (workspaceId?: string | null) => Promise<unknown>;
  listRuntimeExtensionTools?: (input: {
    workspaceId?: string | null;
    extensionId: string;
  }) => Promise<unknown>;
  readRuntimeExtensionResource?: (input: {
    workspaceId?: string | null;
    extensionId: string;
    resourceId: string;
  }) => Promise<unknown>;
  getRuntimeExtensionsConfig?: (workspaceId?: string | null) => Promise<unknown>;
  installRuntimeExtension?: (input: RuntimeExtensionInstallRequest) => Promise<unknown>;
  removeRuntimeExtension?: (input: {
    workspaceId?: string | null;
    extensionId: string;
  }) => Promise<boolean | null>;
  listRuntimeInvocations?: (input?: {
    sessionId?: string | null;
    activeOnly?: boolean | null;
    kind?: RuntimeInvocationKind | null;
  }) => Promise<RuntimeInvocationDescriptor[]>;
  getRuntimeInvocation?: (input: {
    invocationId: string;
    sessionId?: string | null;
  }) => Promise<RuntimeInvocationDescriptor | null>;
  listLiveSkills?: () => Promise<LiveSkillSummary[]>;
  runLiveSkill?: (input: LiveSkillExecuteRequest) => Promise<LiveSkillExecutionResult>;
  spawnSubAgentSession?: (input: {
    workspaceId: string;
    threadId?: string | null;
    title?: string | null;
    accessMode?: RuntimeAgentAccessMode;
    reasonEffort?: RuntimeAgentReasonEffort | null;
    provider?: string | null;
    modelId?: string | null;
    scopeProfile?: SubAgentScopeProfile | null;
    allowedSkillIds?: string[] | null;
    allowNetwork?: boolean | null;
    workspaceReadPaths?: string[] | null;
    parentRunId?: string | null;
  }) => Promise<RuntimeSubAgentSessionSummary>;
  sendSubAgentInstruction?: (input: RuntimeSubAgentSendInput) => Promise<RuntimeSubAgentSendResult>;
  waitSubAgentSession?: (input: RuntimeSubAgentWaitInput) => Promise<RuntimeSubAgentWaitResult>;
  getSubAgentSessionStatus?: (
    input: RuntimeSubAgentStatusInput
  ) => Promise<RuntimeSubAgentSessionSummary | null>;
  interruptSubAgentSession?: (
    input: RuntimeSubAgentInterruptInput
  ) => Promise<RuntimeSubAgentInterruptResult>;
  closeSubAgentSession?: (input: RuntimeSubAgentCloseInput) => Promise<RuntimeSubAgentCloseResult>;
};

export type WebMcpResponseRequiredState = {
  approvals: ApprovalRequest[];
  userInputRequests: RequestUserInputRequest[];
};

export type AgentIntentState = {
  objective: string;
  constraints: string;
  successCriteria: string;
  deadline: string | null;
  priority: AgentIntentPriority;
  managerNotes: string;
};

export type AgentProjectTask = {
  id: string;
  title: string;
  owner: string;
  status: AgentTaskStatus;
  priority: AgentTaskPriority;
  blocked: boolean;
  dueDate: string | null;
  notes: string;
  updatedAt: number;
};

export type AgentAuditLogEntry = {
  id: string;
  at: number;
  category: AgentAuditCategory;
  level: AgentAuditLevel;
  message: string;
  details?: string | null;
};

export type AgentGovernanceCycleSource = "manual" | "auto" | "webmcp";

export type AgentGovernancePolicy = {
  autoEnabled: boolean;
  intervalMinutes: number;
  pauseBlockedInProgress: boolean;
  reassignUnowned: boolean;
  terminateOverdueDays: number;
  ownerPool: string[];
};

export type AgentGovernanceCycleReport = {
  source: AgentGovernanceCycleSource;
  runAt: number;
  inspected: number;
  pausedCount: number;
  terminatedCount: number;
  reassignedCount: number;
  ownerPool: string[];
  notes: string[];
};

export type AgentCommandCenterSnapshot = {
  workspaceId: string;
  workspaceName: string;
  intent: AgentIntentState;
  tasks: AgentProjectTask[];
  auditLog: AgentAuditLogEntry[];
  governance: {
    policy: AgentGovernancePolicy;
    lastCycle: AgentGovernanceCycleReport | null;
  };
  updatedAt: number;
};

export type UpsertTaskInput = {
  id?: string;
  title?: string;
  owner?: string;
  status?: AgentTaskStatus;
  priority?: AgentTaskPriority;
  blocked?: boolean;
  dueDate?: string | null;
  notes?: string;
};

export type AgentCommandCenterActions = {
  setIntentPatch: (patch: Partial<AgentIntentState>) => AgentIntentState;
  setGovernancePolicyPatch: (patch: Partial<AgentGovernancePolicy>) => AgentGovernancePolicy;
  runGovernanceCycle: (source?: AgentGovernanceCycleSource) => AgentGovernanceCycleReport;
  upsertTask: (input: UpsertTaskInput) => AgentProjectTask;
  moveTask: (id: string, status: AgentTaskStatus) => AgentProjectTask | null;
  pauseTask: (id: string) => AgentProjectTask | null;
  resumeTask: (id: string) => AgentProjectTask | null;
  terminateTask: (id: string, reason?: string) => AgentProjectTask | null;
  rebalanceTasks: (owners: string[]) => { updatedCount: number; owners: string[] };
  assignTask: (id: string, owner: string) => AgentProjectTask | null;
  removeTask: (id: string) => boolean;
  clearCompleted: () => number;
};

export type WebMcpActiveModelContext = {
  provider?: string | null;
  modelId?: string | null;
};

export type WebMcpSyncOptions = {
  enabled: boolean;
  readOnlyMode: boolean;
  requireUserApproval: boolean;
  snapshot: AgentCommandCenterSnapshot;
  actions: AgentCommandCenterActions;
  activeModelContext?: WebMcpActiveModelContext | null;
  toolExposureProfile?: "minimal" | "slim" | "full" | null;
  runtimeControl?: RuntimeAgentControl | null;
  responseRequiredState?: WebMcpResponseRequiredState;
  onApprovalRequest?: (message: string) => Promise<boolean>;
};

export type WebMcpSyncResult = {
  supported: boolean;
  enabled: boolean;
  mode: "provideContext" | "registerTool" | "disabled";
  registeredTools: number;
  registeredResources: number;
  registeredPrompts: number;
  toolExposureMode?: "minimal" | "slim" | "full" | null;
  toolExposureReasonCodes?: string[];
  capabilities: WebMcpCapabilityMatrix;
  error: string | null;
};
