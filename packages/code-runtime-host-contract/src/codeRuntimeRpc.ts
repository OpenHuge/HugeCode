import type {
  HugeCodeCheckpointSummary,
  HugeCodeMissionControlSnapshot,
  HugeCodeMissionControlSummary,
  HugeCodeMissionLinkageSummary,
  HugeCodePlacementLifecycleState,
  HugeCodePlacementResolutionSource,
  HugeCodePublishHandoffReference,
  HugeCodeReviewActionabilitySummary,
  HugeCodeReviewPackSummary,
  HugeCodeRunSummary,
  HugeCodeTakeoverBundle,
  HugeCodeTaskMode,
} from "./hugeCodeMissionControl.js";

export type ReasonEffort = "low" | "medium" | "high" | "xhigh";

export type AccessMode = "read-only" | "on-request" | "full-access";

export type RuntimeMode = "local" | "remote";

export type ModelProvider =
  | "openai"
  | "anthropic"
  | "google"
  | "antigravity"
  | "anti-gravity"
  | "local"
  | "unknown"
  | (string & {});

export type ModelSource =
  | "local-codex"
  | "oauth-account"
  | "workspace-default"
  | "fallback"
  | "acp-backend";

export type ModelPool =
  | "codex"
  | "antigravity"
  | "anti-gravity"
  | "claude"
  | "gemini"
  | "auto"
  | (string & {});

export type ModelCapability = "chat" | "coding" | "reasoning" | "vision";

export type WorkspaceSummary = {
  id: string;
  path: string;
  displayName: string;
  connected: boolean;
  defaultModelId: string | null;
};

export type ThreadSummary = {
  id: string;
  workspaceId: string;
  title: string;
  unread: boolean;
  running: boolean;
  createdAt: number;
  updatedAt: number;
  provider: ModelProvider;
  modelId: string | null;
  status?: string | null;
  archived?: boolean;
  lastActivityAt?: number | null;
  agentRole?: string | null;
  agentNickname?: string | null;
};

export type ModelPoolEntry = {
  id: string;
  displayName: string;
  provider: ModelProvider;
  pool: ModelPool;
  source: ModelSource;
  available: boolean;
  supportsReasoning: boolean;
  supportsVision: boolean;
  reasoningEfforts: ReasonEffort[];
  capabilities: ModelCapability[];
};

export type RemoteStatus = {
  connected: boolean;
  mode: RuntimeMode;
  endpoint: string | null;
  latencyMs: number | null;
};

export type TerminalStatus = {
  state: "ready" | "uninitialized" | "unsupported";
  message: string;
};

export type TerminalSessionSummary = {
  id: string;
  workspaceId: string;
  state: "created" | "exited" | "ioFailed" | "unsupported";
  createdAt: number;
  updatedAt: number;
  lines: string[];
};

export type TerminalOutputEventPayload = {
  sessionId: string;
  workspaceId: string;
  state: TerminalSessionSummary["state"];
  cursor: number;
  chunk: string;
  lines?: string[];
  updatedAt: number;
};

export type SettingsSummary = {
  defaultModelStrategy: "unified-auto-routing";
  remoteEnabled: boolean;
  defaultReasonEffort: ReasonEffort;
  defaultAccessMode: AccessMode;
  maxActiveTurnLanes?: number;
  activeTurnLanes?: number;
};

export type HealthResponse = {
  app: string;
  version: string;
  status: "ok";
};

export type TurnSendAttachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
};

export type TurnExecutionMode = "runtime" | "local-cli" | "hybrid";

export type TurnSendRequest = {
  workspaceId: string;
  threadId: string | null;
  requestId?: string;
  content: string;
  contextPrefix?: string | null;
  provider?: ModelProvider | null;
  modelId: string | null;
  reasonEffort: ReasonEffort | null;
  serviceTier?: string | null;
  missionMode?: HugeCodeTaskMode | null;
  executionProfileId?: string | null;
  preferredBackendIds?: string[] | null;
  accessMode: AccessMode;
  executionMode: TurnExecutionMode;
  codexBin?: string | null;
  codexArgs?: string[] | null;
  queue: boolean;
  attachments: TurnSendAttachment[];
  collaborationMode?: Record<string, unknown> | null;
};

export type TurnInterruptRequest = {
  turnId: string | null;
  reason: string | null;
};

export type TurnAck = {
  accepted: boolean;
  turnId: string | null;
  threadId: string | null;
  routedProvider: ModelProvider | null;
  routedModelId: string | null;
  routedPool: ModelPool | null;
  routedSource: ModelSource | null;
  backendId?: string | null;
  message: string;
};

export type AgentRole = "router" | "planner" | "coder" | "verifier";

export type AgentTaskStatus =
  | "queued"
  | "running"
  | "paused"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "cancelled"
  | "interrupted";

export type AgentTaskExecutionMode = "single" | "distributed";

export type AgentTaskSourceKind =
  | "autodrive"
  | "manual"
  | "manual_thread"
  | "github_issue"
  | "github_pr_followup"
  | "schedule"
  | "external_runtime"
  | (string & {});

export type AgentTaskSourceRepoContext = {
  owner?: string | null;
  name?: string | null;
  fullName?: string | null;
  remoteUrl?: string | null;
};

export type AgentTaskSourceSummary = {
  kind: AgentTaskSourceKind;
  label?: string | null;
  shortLabel?: string | null;
  title?: string | null;
  reference?: string | null;
  url?: string | null;
  issueNumber?: number | null;
  pullRequestNumber?: number | null;
  repo?: AgentTaskSourceRepoContext | null;
  workspaceId?: string | null;
  workspaceRoot?: string | null;
  externalId?: string | null;
  canonicalUrl?: string | null;
  threadId?: string | null;
  requestId?: string | null;
  sourceTaskId?: string | null;
  sourceRunId?: string | null;
};

export type ReviewGateState = "pass" | "warn" | "fail" | "blocked";

export type ReviewFindingSeverity = "info" | "warning" | "error" | "critical";

export type ReviewFindingCategory =
  | "correctness_risk"
  | "validation_gap"
  | "security_risk"
  | "repo_policy_mismatch"
  | "followup_clarification"
  | (string & {});

export type ReviewFindingConfidence = "low" | "medium" | "high";

export type ReviewFindingAnchor = {
  path?: string | null;
  startLine?: number | null;
  endLine?: number | null;
  diffSide?: "base" | "head" | null;
  label?: string | null;
};

export type ReviewFinding = {
  id: string;
  title: string;
  severity: ReviewFindingSeverity;
  category: ReviewFindingCategory;
  summary: string;
  confidence: ReviewFindingConfidence;
  suggestedNextAction?: string | null;
  anchors?: ReviewFindingAnchor[] | null;
};

export type ReviewGateSummary = {
  state: ReviewGateState;
  summary: string;
  blockingReason?: string | null;
  highestSeverity?: ReviewFindingSeverity | null;
  findingCount?: number | null;
};

export type RuntimeSkillUsageRecommendedFor = "delegate" | "review" | "repair";

export type RuntimeSkillUsageSummary = {
  skillId: string;
  name: string;
  source?: LiveSkillSource | null;
  status?: "used" | "available" | "suggested" | "unavailable" | null;
  recommendedFor?: RuntimeSkillUsageRecommendedFor[] | null;
  summary?: string | null;
};

export type RuntimeAutofixCandidate = {
  id: string;
  summary: string;
  status: "available" | "applied" | "blocked";
  patchRef?: string | null;
  approvalRequired?: boolean | null;
  blockingReason?: string | null;
};

export type AgentTaskExecutionAutonomy =
  | "operator_review"
  | "bounded_delegate"
  | "autonomous_delegate";

export type AgentTaskToolPosture = "read_only" | "workspace_safe" | "workspace_extended";

export type AgentTaskRoutingStrategy = "workspace_default" | "provider_route" | "direct_model";

export type AgentTaskApprovalSensitivity = "heightened" | "standard" | "low_friction";

export type AgentTaskRoutingHealth = "ready" | "attention" | "blocked";

export type AgentTaskApprovalStateKind =
  | "not_required"
  | "pending_decision"
  | "approved"
  | "rejected"
  | "unavailable";

export type AgentTaskInterventionAction =
  | "pause"
  | "resume"
  | "cancel"
  | "retry"
  | "continue_with_clarification"
  | "narrow_scope"
  | "relax_validation"
  | "switch_profile_and_retry"
  | "escalate_to_pair_mode";

export type AgentTaskAutoDriveRoutePreference = "stability_first" | "balanced" | "speed_first";

export type AgentTaskAutoDriveConfidence = "low" | "medium" | "high";

export type AgentTaskAutoDriveContextScope = "active_workspace" | "workspace_graph";

export type AgentTaskAutoDriveAutonomyPriority = "operator" | "balanced";

export type AgentTaskAutoDrivePromptStrategy = "repo_truth_first" | "workspace_graph_first";

export type AgentTaskAutoDriveResearchMode = "repository_only" | "live_when_allowed";

export type AgentTaskAutoDriveStopReason =
  | "completed"
  | "paused"
  | "budget_exhausted"
  | "validation_failed"
  | "rerouted"
  | "operator_intervened"
  | "cancelled"
  | "failed";

export type AgentTaskAutoDriveDoneDefinition = {
  arrivalCriteria?: string[];
  requiredValidation?: string[];
  waypointIndicators?: string[];
};

export type AgentTaskAutoDriveDestination = {
  title: string;
  desiredEndState: string[];
  doneDefinition?: AgentTaskAutoDriveDoneDefinition | null;
  hardBoundaries?: string[];
  routePreference?: AgentTaskAutoDriveRoutePreference | null;
};

export type AgentTaskAutoDriveBudget = {
  maxTokens?: number | null;
  maxIterations?: number | null;
  maxDurationMs?: number | null;
  maxFilesPerIteration?: number | null;
  maxNoProgressIterations?: number | null;
  maxValidationFailures?: number | null;
  maxReroutes?: number | null;
};

export type AgentTaskAutoDriveRiskPolicy = {
  pauseOnDestructiveChange?: boolean | null;
  pauseOnDependencyChange?: boolean | null;
  pauseOnLowConfidence?: boolean | null;
  pauseOnHumanCheckpoint?: boolean | null;
  allowNetworkAnalysis?: boolean | null;
  allowValidationCommands?: boolean | null;
  minimumConfidence?: AgentTaskAutoDriveConfidence | null;
};

export type AgentTaskAutoDriveContextPolicy = {
  scope?: AgentTaskAutoDriveContextScope | null;
  workspaceReadPaths?: string[] | null;
  workspaceContextPaths?: string[] | null;
  authoritySources?: string[] | null;
};

export type AgentTaskAutoDriveDecisionPolicy = {
  independentThread?: boolean | null;
  autonomyPriority?: AgentTaskAutoDriveAutonomyPriority | null;
  promptStrategy?: AgentTaskAutoDrivePromptStrategy | null;
  researchMode?: AgentTaskAutoDriveResearchMode | null;
};

export type AgentTaskAutoDriveDecisionScore = {
  reasonCode: string;
  label: string;
  delta: number;
};

export type AgentTaskAutoDriveScenarioProfile = {
  authorityScope?: AgentTaskAutoDriveContextScope | null;
  authoritySources?: string[] | null;
  representativeCommands?: string[] | null;
  componentCommands?: string[] | null;
  endToEndCommands?: string[] | null;
  samplePaths?: string[] | null;
  heldOutGuidance?: string[] | null;
  sourceSignals?: string[] | null;
  scenarioKeys?: string[] | null;
  safeBackground?: boolean | null;
};

export type AgentTaskAutoDriveDecisionTrace = {
  phase?: "launch" | "progress" | "failure" | "completed" | "recovered" | null;
  summary?: string | null;
  selectedCandidateId?: string | null;
  selectedCandidateSummary?: string | null;
  selectionTags?: string[] | null;
  scoreBreakdown?: AgentTaskAutoDriveDecisionScore[] | null;
  authoritySources?: string[] | null;
  representativeCommand?: string | null;
  heldOutGuidance?: string[] | null;
};

export type AgentTaskAutoDriveOutcomeFeedback = {
  status?:
    | "launch_prepared"
    | "progressing"
    | "validation_failed"
    | "failed"
    | "completed"
    | "recovered"
    | "operator_intervened"
    | null;
  summary?: string | null;
  failureClass?: string | null;
  validationCommands?: string[] | null;
  humanInterventionRequired?: boolean | null;
  heldOutPreserved?: boolean | null;
  at?: number | null;
};

export type AgentTaskAutoDriveAutonomyState = {
  independentThread?: boolean | null;
  autonomyPriority?: AgentTaskAutoDriveAutonomyPriority | null;
  highPriority?: boolean | null;
  escalationPressure?: "low" | "medium" | "high" | null;
  unattendedContinuationAllowed?: boolean | null;
  backgroundSafe?: boolean | null;
  humanInterventionHotspots?: string[] | null;
};

export type AgentTaskAutoDriveNavigation = {
  activeWaypoint?: string | null;
  completedWaypoints?: string[];
  pendingWaypoints?: string[];
  lastProgressAt?: number | null;
  rerouteCount?: number | null;
  validationFailureCount?: number | null;
  noProgressIterations?: number | null;
};

export type AgentTaskAutoDriveRecoveryMarker = {
  recovered?: boolean | null;
  resumeReady?: boolean | null;
  checkpointId?: string | null;
  traceId?: string | null;
  recoveredAt?: number | null;
  summary?: string | null;
};

export type AgentTaskAutoDriveStopState = {
  reason: AgentTaskAutoDriveStopReason;
  summary?: string | null;
  at?: number | null;
};

export type AgentTaskAutoDriveState = {
  enabled?: boolean | null;
  destination: AgentTaskAutoDriveDestination;
  budget?: AgentTaskAutoDriveBudget | null;
  riskPolicy?: AgentTaskAutoDriveRiskPolicy | null;
  contextPolicy?: AgentTaskAutoDriveContextPolicy | null;
  decisionPolicy?: AgentTaskAutoDriveDecisionPolicy | null;
  scenarioProfile?: AgentTaskAutoDriveScenarioProfile | null;
  decisionTrace?: AgentTaskAutoDriveDecisionTrace | null;
  outcomeFeedback?: AgentTaskAutoDriveOutcomeFeedback | null;
  autonomyState?: AgentTaskAutoDriveAutonomyState | null;
  navigation?: AgentTaskAutoDriveNavigation | null;
  recovery?: AgentTaskAutoDriveRecoveryMarker | null;
  stop?: AgentTaskAutoDriveStopState | null;
};

export type AgentTaskMissionRiskLevel = "low" | "medium" | "high";

export type AgentTaskPermissionSummary = {
  accessMode?: AccessMode | null;
  allowNetwork?: boolean | null;
  writableRoots?: string[] | null;
  toolNames?: string[] | null;
};

export type AgentTaskMissionEvaluationPlan = {
  representativeCommands?: string[] | null;
  componentCommands?: string[] | null;
  endToEndCommands?: string[] | null;
  samplePaths?: string[] | null;
  heldOutGuidance?: string[] | null;
  sourceSignals?: string[] | null;
};

export type AgentTaskMissionScenarioProfile = AgentTaskAutoDriveScenarioProfile;

export type AgentTaskMissionBrief = {
  objective: string;
  doneDefinition?: string[] | null;
  constraints?: string[] | null;
  riskLevel?: AgentTaskMissionRiskLevel | null;
  requiredCapabilities?: string[] | null;
  maxSubtasks?: number | null;
  preferredBackendIds?: string[] | null;
  permissionSummary?: AgentTaskPermissionSummary | null;
  evaluationPlan?: AgentTaskMissionEvaluationPlan | null;
  scenarioProfile?: AgentTaskMissionScenarioProfile | null;
};

export type AgentTaskFailureClass =
  | "validation_failed"
  | "approval_required"
  | "runtime_failed"
  | "timed_out"
  | "interrupted"
  | "cancelled"
  | "unknown";

export type AgentTaskRelaunchContext = {
  sourceTaskId?: string | null;
  sourceRunId?: string | null;
  sourceReviewPackId?: string | null;
  summary?: string | null;
  failureClass?: AgentTaskFailureClass | null;
  recommendedActions?: AgentTaskInterventionAction[] | null;
};

export type AgentTaskPublishHandoffReference = {
  jsonPath: string;
  markdownPath: string;
  reason?: string | null;
  summary?: string | null;
  at?: number | null;
  branchName?: string | null;
  commitMessage?: string | null;
  reviewTitle?: string | null;
  details?: string[] | null;
};

export type AgentTaskExecutionProfile = {
  id: string;
  name: string;
  description: string;
  executionMode: AgentTaskExecutionMode | null;
  autonomy: AgentTaskExecutionAutonomy;
  supervisionLabel: string;
  accessMode: AccessMode;
  routingStrategy: AgentTaskRoutingStrategy;
  toolPosture: AgentTaskToolPosture;
  approvalSensitivity: AgentTaskApprovalSensitivity;
  identitySource: string | null;
  validationPresetId: string | null;
};

export type AgentTaskExecutionProfileReadiness = {
  ready: boolean;
  health: AgentTaskRoutingHealth;
  summary: string;
  issues: string[];
};

export type AgentTaskRoutingSummary = {
  backendId?: string | null;
  provider: ModelProvider | null;
  providerLabel: string | null;
  pool: ModelPool | null;
  routeLabel: string;
  routeHint: string | null;
  health: AgentTaskRoutingHealth;
  backendOperability?: RuntimeBackendOperabilitySummary | null;
  resolutionSource?: HugeCodePlacementResolutionSource | null;
  lifecycleState?: HugeCodePlacementLifecycleState | null;
  enabledAccountCount: number;
  readyAccountCount: number;
  enabledPoolCount: number;
};

export type AgentTaskApprovalStateSummary = {
  status: AgentTaskApprovalStateKind;
  approvalId: string | null;
  label: string;
  summary: string;
};

export type AgentTaskReviewDecisionState = "pending" | "accepted" | "rejected";

export type AgentTaskReviewDecisionSummary = {
  status: AgentTaskReviewDecisionState;
  reviewPackId: string;
  label: string;
  summary: string;
  decidedAt: number | null;
};

export type AgentTaskInterventionAvailability = {
  action: AgentTaskInterventionAction;
  label: string;
  enabled: boolean;
  supported: boolean;
  reason: string | null;
};

export type AgentTaskInterventionSummary = {
  actions: AgentTaskInterventionAvailability[];
  primaryAction: AgentTaskInterventionAction | null;
};

export type AgentTaskOperatorState = {
  health: "healthy" | "attention" | "blocked";
  headline: string;
  detail: string | null;
};

export type AgentTaskNextAction = {
  label: string;
  action: AgentTaskInterventionAction | "review";
  detail: string | null;
};

export type AgentTaskDistributedStatus =
  | "idle"
  | "planning"
  | "running"
  | "aggregating"
  | "failed"
  | "zombie";

export type AgentTaskStepKind = "read" | "write" | "edit" | "bash" | "js_repl" | "diagnostics";

export type AgentTaskStepInput = {
  kind: AgentTaskStepKind;
  input?: string | null;
  path?: string | null;
  paths?: string[] | null;
  content?: string | null;
  find?: string | null;
  replace?: string | null;
  command?: string | null;
  severities?: WorkspaceDiagnosticSeverity[] | null;
  maxItems?: number | null;
  timeoutMs?: number | null;
  requiresApproval?: boolean | null;
  approvalReason?: string | null;
};

export type AgentTaskStepToolCapabilitiesMetadata = {
  defaultRequiresApproval?: boolean;
  mutationKind?: string | null;
  parallelSafe?: boolean;
  requiresReadEvidence?: boolean;
  skillId?: string | null;
};

export type AgentTaskStepInspectorMetadata = {
  decision?: string | null;
  reason?: string | null;
  ruleId?: string | null;
};

export type AgentTaskStepApprovalMetadata = {
  decision?: string | null;
  required?: boolean;
  reused?: boolean;
  requestReason?: string | null;
  requestSource?: string | null;
  resolutionStatus?: string | null;
  resolutionReason?: string | null;
  resolutionAction?: string | null;
  scopeKind?: string | null;
  scopeKey?: string | null;
  scopeTarget?: string | null;
};

export type AgentTaskStepSafetyMetadata = {
  guard?: string | null;
  path?: string | null;
  requiresFreshRead?: boolean | null;
  lastReadStepIndex?: number | null;
  lastMutationStepIndex?: number | null;
};

export type AgentTaskStepMetadata = Record<string, unknown> & {
  toolCapabilities?: AgentTaskStepToolCapabilitiesMetadata | null;
  inspector?: AgentTaskStepInspectorMetadata | null;
  approval?: AgentTaskStepApprovalMetadata | null;
  safety?: AgentTaskStepSafetyMetadata | null;
};

export type AgentTaskStepSummary = {
  index: number;
  kind: AgentTaskStepKind;
  role: AgentRole;
  status: AgentTaskStatus | "pending";
  message: string;
  runId: string | null;
  output: string | null;
  metadata: AgentTaskStepMetadata;
  startedAt: number | null;
  updatedAt: number;
  completedAt: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  approvalId: string | null;
};

export type RuntimeExecutionNodeSummary = {
  id: string;
  kind: "plan" | (string & {});
  status?: string;
  executorKind?: "sub_agent" | (string & {}) | null;
  executorSessionId?: string | null;
  preferredBackendIds?: string[];
  resolvedBackendId: string | null;
  placementLifecycleState?: string | null;
  placementResolutionSource?: string | null;
  checkpoint?: RuntimeCheckpointState | null;
  reviewActionability?: RuntimeReviewActionabilitySummary | null;
};

export type RuntimeExecutionEdgeSummary = {
  fromNodeId: string;
  toNodeId: string;
  kind: "depends_on" | (string & {});
};

export type RuntimeExecutionGraphSummary = {
  graphId: string;
  nodes: RuntimeExecutionNodeSummary[];
  edges: RuntimeExecutionEdgeSummary[];
};

export type AgentTaskPlacementScoreBreakdown = {
  backendId: string;
  totalScore: number;
  explicitPreferenceScore: number;
  resumeAffinityScore: number;
  readinessScore: number;
  latencyScore: number;
  capacityScore: number;
  queuePenalty: number;
  failurePenalty: number;
  healthScore: number;
  reasons: string[];
};

export type AgentTaskSummary = {
  taskId: string;
  workspaceId: string;
  threadId: string | null;
  requestId: string | null;
  title: string | null;
  taskSource?: AgentTaskSourceSummary | null;
  status: AgentTaskStatus;
  accessMode: AccessMode;
  executionProfileId?: string | null;
  reviewProfileId?: string | null;
  executionMode?: AgentTaskExecutionMode | null;
  provider: ModelProvider | null;
  modelId: string | null;
  reasonEffort?: ReasonEffort | null;
  routedProvider: ModelProvider | null;
  routedModelId: string | null;
  routedPool: ModelPool | null;
  routedSource: ModelSource | null;
  currentStep: number | null;
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  completedAt: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  pendingApprovalId: string | null;
  validationPresetId?: string | null;
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
  publishHandoff?: AgentTaskPublishHandoffReference | null;
  autoDrive?: AgentTaskAutoDriveState | null;
  checkpointId?: string | null;
  traceId?: string | null;
  recovered?: boolean | null;
  checkpointState?: RuntimeCheckpointState | null;
  missionLinkage?: RuntimeMissionLinkageSummary | null;
  reviewActionability?: RuntimeReviewActionabilitySummary | null;
  reviewGate?: ReviewGateSummary | null;
  reviewFindings?: ReviewFinding[] | null;
  reviewRunId?: string | null;
  skillUsage?: RuntimeSkillUsageSummary[] | null;
  autofixCandidate?: RuntimeAutofixCandidate | null;
  takeoverBundle?: RuntimeTakeoverBundle | null;
  executionGraph?: RuntimeExecutionGraphSummary | null;
  backendId?: string | null;
  acpIntegrationId?: string | null;
  acpSessionId?: string | null;
  acpConfigOptions?: Record<string, unknown> | null;
  acpAvailableCommands?: unknown[] | Record<string, unknown> | null;
  preferredBackendIds?: string[] | null;
  placementFallbackReasonCode?: string | null;
  resumeBackendId?: string | null;
  placementScoreBreakdown?: AgentTaskPlacementScoreBreakdown[] | null;
  rootTaskId?: string | null;
  parentTaskId?: string | null;
  childTaskIds?: string[];
  distributedStatus?: AgentTaskDistributedStatus | null;
  runSummary?: HugeCodeRunSummary | null;
  reviewPackSummary?: HugeCodeReviewPackSummary | null;
  steps: AgentTaskStepSummary[];
};

export type AgentTaskStartRequest = {
  workspaceId: string;
  threadId?: string | null;
  requestId?: string;
  title?: string | null;
  taskSource?: AgentTaskSourceSummary | null;
  executionProfileId?: string | null;
  reviewProfileId?: string | null;
  validationPresetId?: string | null;
  provider?: ModelProvider | null;
  modelId?: string | null;
  reasonEffort?: ReasonEffort | null;
  accessMode?: AccessMode;
  executionMode?: AgentTaskExecutionMode;
  requiredCapabilities?: string[];
  preferredBackendIds?: string[];
  defaultBackendId?: string | null;
  missionBrief?: AgentTaskMissionBrief | null;
  relaunchContext?: AgentTaskRelaunchContext | null;
  autoDrive?: AgentTaskAutoDriveState | null;
  steps: AgentTaskStepInput[];
};

export type RuntimeBackendStatus = "active" | "draining" | "disabled";

export type RuntimeBackendRolloutState = "current" | "ramping" | "draining" | "drained";

export type RuntimeBackendClass = "primary" | "burst" | "specialized";

export type RuntimeBackendTrustTier = "trusted" | "standard" | "isolated";

export type RuntimeBackendDataSensitivity = "public" | "internal" | "restricted";

export type RuntimeBackendApprovalPolicy =
  | "runtime-default"
  | "checkpoint-required"
  | "never-auto-approve";

export type RuntimeBackendToolClass = "read" | "write" | "exec" | "network" | "browser" | "mcp";

export type RuntimeBackendPolicyProfile = {
  trustTier: RuntimeBackendTrustTier;
  dataSensitivity: RuntimeBackendDataSensitivity;
  approvalPolicy: RuntimeBackendApprovalPolicy;
  allowedToolClasses: RuntimeBackendToolClass[];
};

export type RuntimeBackendReachability = "reachable" | "degraded" | "unreachable" | "unknown";

export type RuntimeBackendConnectivityMode = "direct" | "overlay" | "gateway";

export type RuntimeBackendOverlay = "tailscale" | "netbird" | "orbit";

export type RuntimeBackendLeaseStatus = "active" | "expiring" | "expired" | "released" | "none";

export type RuntimeBackendConnectivitySummary = {
  mode?: RuntimeBackendConnectivityMode | null;
  overlay?: RuntimeBackendOverlay | null;
  endpoint?: string | null;
  reachability?: RuntimeBackendReachability | null;
  checkedAt?: number | null;
  source?: "runtime" | "overlay" | "operator" | "probe" | null;
  reason?: string | null;
};

export type RuntimeBackendLeaseSummary = {
  status: RuntimeBackendLeaseStatus;
  leaseId?: string | null;
  holderId?: string | null;
  scope?: "backend" | "slot" | "node" | "overlay-session" | null;
  acquiredAt?: number | null;
  expiresAt?: number | null;
  ttlMs?: number | null;
  observedAt?: number | null;
};

export type RuntimeBackendReadinessState =
  | "ready"
  | "attention"
  | "blocked"
  | "unknown"
  | "not_applicable";

export type RuntimeBackendReadinessSummary = {
  state: RuntimeBackendReadinessState;
  summary: string;
  reasons: string[];
  checkedAt?: number | null;
  handshakeState?: "verified" | "missing" | "failed" | "unknown" | null;
  capabilityState?: "verified" | "missing" | "failed" | "unknown" | null;
  authState?: "verified" | "missing" | "failed" | "unknown" | null;
  protocolVersion?: string | null;
  serverName?: string | null;
  serverVersion?: string | null;
};

export type RuntimeBackendOperabilityState = "ready" | "attention" | "blocked";

export type RuntimeBackendOperabilitySummary = {
  state: RuntimeBackendOperabilityState;
  placementEligible: boolean;
  summary: string;
  reasons: string[];
  heartbeatState?: "fresh" | "stale" | "missing" | "unknown" | null;
  heartbeatAgeMs?: number | null;
  reachability?: RuntimeBackendReachability | null;
  leaseStatus?: RuntimeBackendLeaseStatus | null;
  readinessState?: RuntimeBackendReadinessState | null;
  activeTasks?: number | null;
  availableExecutionSlots?: number | null;
};

export type RuntimeBackendDiagnosticsSummary = {
  availability: "available" | "saturated" | "draining" | "disabled" | "degraded" | "unknown";
  summary: string;
  reasons: string[];
  degraded: boolean;
  heartbeatAgeMs?: number | null;
  lastHeartbeatAt?: number | null;
  reachability?: RuntimeBackendReachability | null;
  leaseStatus?: RuntimeBackendLeaseStatus | null;
  readinessState?: RuntimeBackendReadinessState | null;
};

export type AcpIntegrationTransport = "stdio" | "http";

export type AcpIntegrationState = "active" | "draining" | "disabled" | "degraded";

export type AcpStdioTransportConfig = {
  transport: "stdio";
  command: string;
  args?: string[];
  cwd?: string | null;
  env?: Record<string, string> | null;
};

export type AcpHttpTransportConfig = {
  transport: "http";
  endpoint: string;
  experimental?: boolean;
  headers?: Record<string, string> | null;
};

export type AcpIntegrationTransportConfig = AcpStdioTransportConfig | AcpHttpTransportConfig;

export type AcpIntegrationSummary = {
  integrationId: string;
  backendId: string;
  displayName: string;
  state: AcpIntegrationState;
  transport: AcpIntegrationTransport;
  transportConfig: AcpIntegrationTransportConfig;
  healthy: boolean;
  lastError?: string | null;
  lastProbeAt?: number | null;
  protocolVersion?: string | null;
  serverName?: string | null;
  serverVersion?: string | null;
  configOptions?: Record<string, unknown> | null;
  capabilities: string[];
  maxConcurrency: number;
  costTier: string;
  latencyClass: string;
  backendClass?: RuntimeBackendClass | null;
  specializations?: string[] | null;
  connectivity?: RuntimeBackendConnectivitySummary | null;
  lease?: RuntimeBackendLeaseSummary | null;
  readiness?: RuntimeBackendReadinessSummary | null;
  createdAt: number;
  updatedAt: number;
};

export type AcpIntegrationUpsertInput = {
  integrationId: string;
  displayName: string;
  transportConfig: AcpIntegrationTransportConfig;
  state?: AcpIntegrationState;
  capabilities: string[];
  maxConcurrency: number;
  costTier: string;
  latencyClass: string;
  backendId?: string | null;
  backendClass?: RuntimeBackendClass | null;
  specializations?: string[] | null;
  connectivity?: RuntimeBackendConnectivitySummary | null;
  lease?: RuntimeBackendLeaseSummary | null;
};

export type AcpIntegrationSetStateRequest = {
  integrationId: string;
  state: AcpIntegrationState;
  reason?: string | null;
};

export type AcpIntegrationProbeRequest = {
  integrationId: string;
  force?: boolean;
};

export type RuntimeBackendSummary = {
  backendId: string;
  displayName: string;
  capabilities: string[];
  maxConcurrency: number;
  costTier: string;
  latencyClass: string;
  rolloutState: RuntimeBackendRolloutState;
  status: RuntimeBackendStatus;
  healthy: boolean;
  healthScore: number;
  failures: number;
  queueDepth: number;
  runningTasks: number;
  createdAt: number;
  updatedAt: number;
  lastHeartbeatAt: number;
  heartbeatIntervalMs?: number | null;
  backendClass?: RuntimeBackendClass | null;
  specializations?: string[] | null;
  connectivity?: RuntimeBackendConnectivitySummary | null;
  lease?: RuntimeBackendLeaseSummary | null;
  readiness?: RuntimeBackendReadinessSummary | null;
  operability?: RuntimeBackendOperabilitySummary | null;
  diagnostics?: RuntimeBackendDiagnosticsSummary | null;
  policy?: RuntimeBackendPolicyProfile | null;
  backendKind?: "native" | "acp" | null;
  integrationId?: string | null;
  transport?: AcpIntegrationTransport | null;
  origin?: "runtime-native" | "acp-projection" | null;
  contract?: {
    kind: "native" | "acp";
    origin: "runtime-native" | "acp-projection";
    transport: AcpIntegrationTransport | null;
    capabilityCount: number;
    health: RuntimeBackendStatus;
    rolloutState: RuntimeBackendRolloutState;
    backendClass?: RuntimeBackendClass | null;
    reachability?: RuntimeBackendReachability | null;
    leaseStatus?: RuntimeBackendLeaseStatus | null;
    readinessState?: RuntimeBackendReadinessState | null;
  } | null;
};

export type RuntimeBackendUpsertInput = {
  backendId: string;
  displayName: string;
  capabilities: string[];
  maxConcurrency: number;
  costTier: string;
  latencyClass: string;
  rolloutState: RuntimeBackendRolloutState;
  status: RuntimeBackendStatus;
  healthScore?: number;
  failures?: number;
  queueDepth?: number;
  runningTasks?: number;
  lastHeartbeatAt?: number;
  heartbeatIntervalMs?: number | null;
  backendClass?: RuntimeBackendClass | null;
  specializations?: string[] | null;
  connectivity?: RuntimeBackendConnectivitySummary | null;
  lease?: RuntimeBackendLeaseSummary | null;
  policy?: RuntimeBackendPolicyProfile | null;
};

export type RuntimeBackendSetStateRequest = {
  backendId: string;
  status?: RuntimeBackendStatus;
  rolloutState?: RuntimeBackendRolloutState;
  force?: boolean;
  reason?: string | null;
};

export type DistributedTaskGraphRequest = {
  taskId: string;
  limit?: number;
  includeDiagnostics?: boolean;
};

export type DistributedTaskGraphNode = {
  taskId: string;
  parentTaskId: string | null;
  role: AgentRole | (string & {});
  backendId: string | null;
  status: AgentTaskStatus | "pending";
  attempt: number;
};

export type DistributedTaskGraphEdge = {
  fromTaskId: string;
  toTaskId: string;
  type: "depends_on" | (string & {});
};

export type DistributedTaskGraphSummary = {
  totalNodes?: number;
  runningNodes?: number;
  completedNodes?: number;
  failedNodes?: number;
  workspaceSummaryLimit?: number | null;
  queueDepth?: number | null;
  placementFailuresTotal?: number | null;
  accessMode?: string | null;
  routedProvider?: string | null;
  executionMode?: TurnExecutionMode | null;
  reason?: string | null;
};

export type DistributedTaskGraph = {
  taskId: string;
  rootTaskId: string;
  nodes: DistributedTaskGraphNode[];
  edges: DistributedTaskGraphEdge[];
  summary?: DistributedTaskGraphSummary | null;
};

export type AgentTaskInterruptRequest = {
  taskId: string;
  reason?: string | null;
};

export type AgentTaskResumeRequest = {
  taskId: string;
  reason?: string | null;
};

export type AgentTaskInterventionRequest = {
  taskId: string;
  action: AgentTaskInterventionAction;
  reason?: string | null;
  instructionPatch?: string | null;
  executionProfileId?: string | null;
  reviewProfileId?: string | null;
  preferredBackendIds?: string[] | null;
  relaunchContext?: AgentTaskRelaunchContext | null;
};

export type AgentTaskStatusRequest = {
  taskId: string;
};

export type AgentTaskListRequest = {
  workspaceId?: string | null;
  status?: AgentTaskStatus | null;
  limit?: number | null;
};

export type RuntimeRunId = string;

export type RuntimeRunStartRequest = AgentTaskStartRequest;

export type RuntimeRunPrepareV2Request = AgentTaskStartRequest;

export type RuntimeRunRiskLevelV2 = "low" | "medium" | "high";

export type RuntimeRunIntentBriefV2 = {
  title: string | null;
  objective: string | null;
  summary: string;
  taskSource: AgentTaskSourceSummary | null;
  accessMode: AccessMode;
  executionMode: AgentTaskExecutionMode;
  executionProfileId: string | null;
  reviewProfileId: string | null;
  validationPresetId: string | null;
  preferredBackendIds: string[];
  requiredCapabilities: string[];
  riskLevel: RuntimeRunRiskLevelV2;
  clarified: boolean;
  missingContext: string[];
};

export type RuntimeContextEntryV2 = {
  id: string;
  label: string;
  kind: "workspace" | "repo_rule" | "validation" | "backend" | "task_source" | "step";
  detail: string | null;
  source: string | null;
};

export type RuntimeContextLayerTierV2 = "hot" | "warm" | "cold";

export type RuntimeContextLayerV2 = {
  tier: RuntimeContextLayerTierV2;
  summary: string;
  entries: RuntimeContextEntryV2[];
};

export type RuntimeContextWorkingSetV2 = {
  summary: string;
  workspaceRoot: string | null;
  layers: RuntimeContextLayerV2[];
};

export type RuntimeExecutionNodeKindV2 =
  | "clarify"
  | "read"
  | "plan"
  | "edit"
  | "validate"
  | "review";

export type RuntimeExecutionNodeStatusV2 = "planned" | "running" | "completed" | "blocked";

export type RuntimeExecutionNodeV2 = {
  id: string;
  label: string;
  kind: RuntimeExecutionNodeKindV2;
  status: RuntimeExecutionNodeStatusV2;
  capability: string;
  dependsOn: string[];
  parallelSafe: boolean;
  requiresApproval: boolean;
};

export type RuntimeExecutionGraphV2 = {
  graphId: string;
  summary: string;
  nodes: RuntimeExecutionNodeV2[];
};

export type RuntimeApprovalBatchV2 = {
  id: string;
  summary: string;
  riskLevel: RuntimeRunRiskLevelV2;
  actionCount: number;
  stepIds: string[];
};

export type RuntimeValidationPlanV2 = {
  required: boolean;
  summary: string;
  commands: string[];
};

export type RuntimeRunPrepareV2Response = {
  preparedAt: number;
  runIntent: RuntimeRunIntentBriefV2;
  contextWorkingSet: RuntimeContextWorkingSetV2;
  executionGraph: RuntimeExecutionGraphV2;
  approvalBatches: RuntimeApprovalBatchV2[];
  validationPlan: RuntimeValidationPlanV2;
  reviewFocus: string[];
};

export type RuntimeRunCancelRequest = {
  runId: RuntimeRunId;
  reason?: string | null;
};

export type RuntimeRunResumeRequest = {
  runId: RuntimeRunId;
  reason?: string | null;
};

export type RuntimeRunInterventionRequest = {
  runId: RuntimeRunId;
  action: AgentTaskInterventionAction;
  reason?: string | null;
  instructionPatch?: string | null;
  executionProfileId?: string | null;
  reviewProfileId?: string | null;
  preferredBackendIds?: string[] | null;
  relaunchContext?: AgentTaskRelaunchContext | null;
};

export type RuntimeRunSubscribeRequest = {
  runId: RuntimeRunId;
};

export type RuntimeRunGetV2Request = {
  runId: RuntimeRunId;
};

export type RuntimeReviewGetV2Request = {
  runId: RuntimeRunId;
};

export type RuntimeRunsListRequest = AgentTaskListRequest;

export type KernelJobIdV3 = RuntimeRunId;

export type KernelJobDeliveryModeV3 = "poll" | "callback";

export type KernelJobDeliveryV3 = {
  mode: KernelJobDeliveryModeV3;
  callbackId?: string | null;
};

export type KernelJobStartRequestV3 = RuntimeRunStartRequest & {
  delivery?: KernelJobDeliveryV3 | null;
};

export type KernelJobGetRequestV3 = {
  jobId: KernelJobIdV3;
};

export type KernelJobCancelRequestV3 = RuntimeRunCancelRequest;

export type KernelJobResumeRequestV3 = RuntimeRunResumeRequest;

export type KernelJobInterventionRequestV3 = RuntimeRunInterventionRequest;

export type KernelJobSubscribeRequestV3 = RuntimeRunSubscribeRequest;

export type KernelJobCallbackRegistrationV3 = {
  callbackId: string;
  workspaceId?: string | null;
  jobId?: string | null;
  mode?: KernelJobDeliveryModeV3 | null;
  callbackUrl?: string | null;
  secret?: string | null;
};

export type KernelJobCallbackRegistrationAckV3 = {
  registered: boolean;
  callbackId: string;
  delivery: KernelJobDeliveryV3;
  message?: string | null;
};

export type KernelJobCallbackRemoveRequestV3 = {
  callbackId: string;
};

export type KernelJobCallbackRemoveAckV3 = {
  removed: boolean;
  callbackId: string;
  message?: string | null;
};

export type RuntimeRunSummary = AgentTaskSummary;

export type RuntimeRunRecordV2 = {
  run: RuntimeRunSummary;
  missionRun: HugeCodeRunSummary;
  reviewPack: HugeCodeReviewPackSummary | null;
};

export type RuntimeRunStartV2Response = RuntimeRunRecordV2;

export type RuntimeRunGetV2Response = RuntimeRunRecordV2;

export type RuntimeRunSubscribeV2Response = RuntimeRunRecordV2 | null;

export type RuntimeRunResumeV2Response = RuntimeRunRecordV2;

export type RuntimeRunInterventionV2Response = RuntimeRunRecordV2;

export type RuntimeReviewGetV2Response = HugeCodeReviewPackSummary | null;

export type RuntimeRunCancelAck = {
  accepted: boolean;
  runId: RuntimeRunId;
  status: AgentTaskStatus;
  message: string;
};

export type RuntimeRunResumeAck = {
  accepted: boolean;
  runId: RuntimeRunId;
  status: AgentTaskStatus;
  code?: string | null;
  message: string;
  recovered?: boolean | null;
  checkpointId?: string | null;
  traceId?: string | null;
  updatedAt?: number | null;
};

export type RuntimeRunInterventionAck = {
  accepted: boolean;
  action: AgentTaskInterventionAction;
  runId: RuntimeRunId;
  status: AgentTaskStatus;
  outcome: string;
  spawnedRunId?: RuntimeRunId | null;
  checkpointId?: string | null;
};

export type SubAgentSessionStatus =
  | "idle"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "cancelled"
  | "interrupted"
  | "closed";

export type RuntimeWorkflowState =
  | "queued"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "timed_out"
  | "interrupted";

export type SubAgentScopeProfile = "general" | "research" | "review";

export type SubAgentApprovalMode = "inherit" | "read_only_safe";

export type RuntimeCheckpointState = {
  state: RuntimeWorkflowState;
  lifecycleState?: string | null;
  checkpointId?: string | null;
  traceId?: string | null;
  recovered?: boolean | null;
  updatedAt?: number | null;
  resumeReady?: boolean | null;
  recoveredAt?: number | null;
  summary?: string | null;
};

export type RuntimeTakeoverState = "ready" | "attention" | "blocked";

export type RuntimeTakeoverPathKind = "approval" | "resume" | "review" | "handoff" | "missing";

export type RuntimeTakeoverPrimaryAction =
  | "approve"
  | "resume"
  | "open_review_pack"
  | "open_handoff"
  | "open_sub_agent_session"
  | "inspect_runtime";

export type RuntimeMissionNavigationTarget =
  | {
      kind: "thread";
      workspaceId: string;
      threadId: string;
    }
  | {
      kind: "run";
      workspaceId: string;
      taskId: string;
      runId: string;
      reviewPackId?: string | null;
      checkpointId?: string | null;
      traceId?: string | null;
    };

export type RuntimeTakeoverTarget =
  | RuntimeMissionNavigationTarget
  | {
      kind: "review_pack";
      workspaceId: string;
      taskId: string;
      runId: string;
      reviewPackId: string;
      checkpointId?: string | null;
      traceId?: string | null;
    }
  | {
      kind: "sub_agent_session";
      workspaceId: string;
      sessionId: string;
      parentRunId?: string | null;
      threadId?: string | null;
      activeTaskId?: string | null;
      lastTaskId?: string | null;
      checkpointId?: string | null;
      traceId?: string | null;
    };

export type RuntimeMissionLinkageSummary = {
  workspaceId: string;
  taskId: string;
  runId: string;
  reviewPackId?: string | null;
  checkpointId?: string | null;
  traceId?: string | null;
  threadId?: string | null;
  requestId?: string | null;
  missionTaskId: string;
  taskEntityKind: "thread" | "run";
  recoveryPath: "thread" | "run";
  navigationTarget: RuntimeMissionNavigationTarget;
  summary: string;
};

export type RuntimeReviewActionabilityAction =
  | "accept_result"
  | "reject_result"
  | "retry"
  | "continue_with_clarification"
  | "narrow_scope"
  | "relax_validation"
  | "switch_profile_and_retry"
  | "escalate_to_pair_mode";

export type RuntimeReviewActionAvailability = {
  action: RuntimeReviewActionabilityAction;
  enabled: boolean;
  supported: boolean;
  reason: string | null;
};

export type RuntimeReviewActionabilitySummary = {
  state: "ready" | "degraded" | "blocked";
  summary: string;
  degradedReasons: string[];
  actions: RuntimeReviewActionAvailability[];
};

export type RuntimeTakeoverBundle = {
  state: RuntimeTakeoverState;
  pathKind: RuntimeTakeoverPathKind;
  primaryAction: RuntimeTakeoverPrimaryAction;
  summary: string;
  blockingReason?: string | null;
  recommendedAction: string;
  target?: RuntimeTakeoverTarget | null;
  checkpointId?: string | null;
  traceId?: string | null;
  reviewPackId?: string | null;
  publishHandoff?: AgentTaskPublishHandoffReference | null;
  reviewActionability?: RuntimeReviewActionabilitySummary | null;
};

export type RuntimeApprovalEvent = {
  status: "requested" | "approved" | "rejected" | "timed_out" | "interrupted" | "unavailable";
  approvalId?: string | null;
  stepIndex?: number | null;
  at?: number | null;
  reason?: string | null;
  action?: string | null;
  approval?: AgentTaskStepApprovalMetadata | null;
};

export type RuntimeCompactionSummary = {
  triggered: boolean;
  executed: boolean;
  source?: string | null;
  compressedSteps?: number | null;
  bytesReduced?: number | null;
  keepRecentSteps?: number | null;
  summaryMaxChars?: number | null;
  executionError?: string | null;
};

export type SubAgentScopeProfileDescriptor = {
  profile: SubAgentScopeProfile;
  allowNetwork: boolean;
  allowedSkillIds: string[];
  workspaceReadPaths: string[];
  writableRoots: string[];
  maxTaskMs: number;
  maxDepth: number;
  approvalMode: SubAgentApprovalMode;
  readOnly: boolean;
  description: string;
};

export type SubAgentSessionSummary = {
  sessionId: string;
  workspaceId: string;
  threadId: string | null;
  title: string | null;
  status: SubAgentSessionStatus;
  accessMode: AccessMode;
  reasonEffort: ReasonEffort | null;
  provider: ModelProvider | null;
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
  takeoverBundle?: RuntimeTakeoverBundle | null;
  approvalEvents?: RuntimeApprovalEvent[] | null;
  compactionSummary?: RuntimeCompactionSummary | null;
  evalTags?: string[] | null;
};

export type SubAgentSpawnRequest = {
  workspaceId: string;
  threadId?: string | null;
  title?: string | null;
  accessMode?: AccessMode;
  reasonEffort?: ReasonEffort | null;
  provider?: ModelProvider | null;
  modelId?: string | null;
  scopeProfile?: SubAgentScopeProfile | null;
  allowedSkillIds?: string[] | null;
  allowNetwork?: boolean | null;
  workspaceReadPaths?: string[] | null;
  parentRunId?: string | null;
};

export type SubAgentSendRequest = {
  sessionId: string;
  instruction: string;
  requestId?: string;
  requiresApproval?: boolean;
  approvalReason?: string | null;
};

export type SubAgentSendResult = {
  session: SubAgentSessionSummary;
  task: AgentTaskSummary;
};

export type SubAgentWaitRequest = {
  sessionId: string;
  timeoutMs?: number | null;
  pollIntervalMs?: number | null;
};

export type SubAgentWaitResult = {
  session: SubAgentSessionSummary;
  task: AgentTaskSummary | null;
  done: boolean;
  timedOut: boolean;
};

export type SubAgentStatusRequest = {
  sessionId: string;
};

export type SubAgentInterruptRequest = {
  sessionId: string;
  reason?: string | null;
};

export type SubAgentInterruptAck = {
  accepted: boolean;
  sessionId: string;
  taskId: string | null;
  status: SubAgentSessionStatus;
  message: string;
};

export type SubAgentCloseRequest = {
  sessionId: string;
  reason?: string | null;
  force?: boolean;
};

export type SubAgentCloseAck = {
  closed: boolean;
  sessionId: string;
  status: SubAgentSessionStatus;
  message: string;
};

export type AgentApprovalDecision = "approved" | "rejected";

export type AgentApprovalDecisionRequest = {
  approvalId: string;
  decision: AgentApprovalDecision;
  reason?: string | null;
};

export type RuntimeRunCheckpointApprovalRequest = AgentApprovalDecisionRequest & {
  runId?: RuntimeRunId | null;
};

export type AgentTaskInterruptAck = {
  accepted: boolean;
  taskId: string;
  status: AgentTaskStatus;
  message: string;
};

export type AgentTaskResumeAck = {
  accepted: boolean;
  taskId: string;
  status: AgentTaskStatus;
  code?: string | null;
  message: string;
  recovered?: boolean | null;
  checkpointId?: string | null;
  traceId?: string | null;
  updatedAt?: number | null;
};

export type AgentTaskInterventionAck = {
  accepted: boolean;
  action: AgentTaskInterventionAction;
  taskId: string;
  status: AgentTaskStatus;
  outcome: string;
  spawnedTaskId?: string | null;
  checkpointId?: string | null;
};

export type AgentApprovalDecisionAck = {
  recorded: boolean;
  approvalId: string;
  taskId: string | null;
  status: AgentTaskStatus | null;
  message: string;
};

export type RuntimeRunCheckpointApprovalAck = {
  recorded: boolean;
  approvalId: string;
  runId: RuntimeRunId | null;
  status: AgentTaskStatus | null;
  message: string;
};

export type ThreadCreateRequest = {
  workspaceId: string;
  title: string | null;
};

export type RuntimeBootstrapSnapshot = {
  health: HealthResponse | null;
  settings: SettingsSummary | null;
  remote: RemoteStatus | null;
  terminal: TerminalStatus | null;
  models: ModelPoolEntry[];
  workspaces: WorkspaceSummary[];
};

export type RuntimeRpcBatchItemRequest = {
  method: CodeRuntimeRpcMethod;
  params?: Record<string, unknown> | null;
};

export type RuntimeRpcBatchRequest = {
  requests: RuntimeRpcBatchItemRequest[];
};

export type RuntimeRpcBatchItemResponse =
  | {
      method: CodeRuntimeRpcMethod;
      ok: true;
      result: unknown;
      error?: never;
    }
  | {
      method: CodeRuntimeRpcMethod;
      ok: false;
      error: CodeRuntimeRpcError;
      result?: never;
    };

export type RuntimeRpcBatchResponse = {
  responses: RuntimeRpcBatchItemResponse[];
};

export type WorkspaceFileSummary = {
  id: string;
  path: string;
  summary: string;
};

export type WorkspaceFileContent = {
  id: string;
  path: string;
  summary: string;
  content: string;
};

export type WorkspaceDiagnosticSeverity = "error" | "warning" | "info" | "hint";

export type WorkspaceDiagnosticsProviderId = "native" | "cargo-check" | "oxlint" | "tsc";

export type WorkspaceDiagnosticsProviderStatusKind = "used" | "skipped" | "failed" | "unavailable";

export type WorkspaceDiagnosticsListRequest = {
  workspaceId: string;
  paths?: string[] | null;
  severities?: WorkspaceDiagnosticSeverity[] | null;
  maxItems?: number | null;
  includeProviderDetails?: boolean;
};

export type WorkspaceDiagnosticsProviderStatus = {
  id: WorkspaceDiagnosticsProviderId;
  status: WorkspaceDiagnosticsProviderStatusKind;
  durationMs?: number | null;
  message?: string | null;
};

export type WorkspaceDiagnostic = {
  path: string;
  severity: WorkspaceDiagnosticSeverity;
  message: string;
  source: string;
  code?: string | null;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
};

export type WorkspaceDiagnosticsSummary = {
  errorCount: number;
  warningCount: number;
  infoCount: number;
  hintCount: number;
  total: number;
};

export type WorkspaceDiagnosticsListResponse = {
  workspaceId: string;
  available: boolean;
  summary: WorkspaceDiagnosticsSummary;
  items: WorkspaceDiagnostic[];
  providers: WorkspaceDiagnosticsProviderStatus[];
  generatedAtMs: number;
  reason?: string | null;
};

export type WorkspacePatchApplyRequest = {
  workspaceId: string;
  diff: string;
  dryRun?: boolean | null;
};

export type WorkspacePatchApplyResponse = {
  workspaceId: string;
  ok: boolean;
  applied: boolean;
  dryRun: boolean;
  files: string[];
  stdout: string;
  stderr: string;
  error: string | null;
};

export type GitChangeSummary = {
  id: string;
  path: string;
  status: string;
  summary: string;
};

export type GitChangesSnapshot = {
  staged: GitChangeSummary[];
  unstaged: GitChangeSummary[];
};

export type GitDiffContent = {
  id: string;
  diff: string;
  hasMore?: boolean;
  nextOffset?: number | null;
};

export type GitBranchSummary = {
  name: string;
  lastUsedAt: number;
};

export type GitBranchesSnapshot = {
  currentBranch: string | null;
  branches: GitBranchSummary[];
};

export type GitWorkflowStatusResult = {
  branch: string | null;
  hasWorkingTreeChanges: boolean;
  hasUpstream: boolean;
  aheadCount: number;
  behindCount: number;
  activeWorktreePath: string | null;
};

export type GitWorkflowBranch = {
  name: string;
  current: boolean;
  isDefault: boolean;
  isRemote: boolean;
  remoteName: string | null;
  worktreePath: string | null;
};

export type GitResolvedPullRequest = {
  number: number;
  title: string;
  url: string;
  baseBranch: string;
  headBranch: string;
};

export type GitResolvePullRequestInput = {
  workspaceId: string;
  reference: string;
};

export type GitResolvePullRequestResult = {
  pullRequest: GitResolvedPullRequest;
};

export type GitPreparePullRequestThreadInput = {
  workspaceId: string;
  reference: string;
  mode: "local" | "worktree";
};

export type GitPreparePullRequestThreadResult = {
  branch: string;
  worktreePath: string | null;
};

export type GitLogEntry = {
  sha: string;
  summary: string;
  author: string;
  timestamp: number;
};

export type GitLogResponse = {
  total: number;
  entries: GitLogEntry[];
  ahead: number;
  behind: number;
  aheadEntries: GitLogEntry[];
  behindEntries: GitLogEntry[];
  upstream: string | null;
};

export type GitOperationResult = {
  ok: boolean;
  error: string | null;
};

export type GitCommitResult = {
  committed: boolean;
  committedCount: number;
  error: string | null;
};

export type PromptLibraryScope = "global" | "workspace";

export type PromptLibraryEntry = {
  id: string;
  title: string;
  description: string;
  content: string;
  scope: PromptLibraryScope;
};

export type OAuthProviderId = "codex" | "gemini" | "claude_code";

export type CanonicalModelProvider = "openai" | "anthropic" | "google" | "local" | "unknown";

export type CanonicalModelPool = "codex" | "claude" | "gemini" | "auto";

export type RuntimeProviderCatalogEntry = {
  providerId: CanonicalModelProvider | (string & {});
  displayName: string;
  pool: CanonicalModelPool | (string & {}) | null;
  oauthProviderId: OAuthProviderId | null;
  aliases: string[];
  defaultModelId: string | null;
  available: boolean;
  supportsNative: boolean;
  supportsOpenaiCompat: boolean;
  registryVersion?: string | null;
};

export type OAuthAccountStatus = "enabled" | "disabled" | "forbidden" | "validation_blocked";

export type OAuthPoolStrategy = "round_robin" | "p2c";

export type OAuthStickyMode = "cache_first" | "balance" | "performance_first";
export type OAuthUsageRefreshMode = "auto" | "force" | "off";

export type OAuthAccountRouteConfig = {
  compatBaseUrl?: string | null;
  proxyId?: string | null;
  priority?: number | null;
  concurrencyLimit?: number | null;
  schedulable?: boolean | null;
};

export type OAuthAccountChatgptWorkspace = {
  workspaceId: string;
  title?: string | null;
  role?: string | null;
  isDefault: boolean;
};

export type OAuthAccountRoutingState = {
  credentialReady?: boolean | null;
  lastRoutingError?: string | null;
  rateLimitedUntil?: number | null;
  overloadedUntil?: number | null;
  tempUnschedulableUntil?: number | null;
  tempUnschedulableReason?: string | null;
};

export type OAuthAccountSummary = {
  accountId: string;
  provider: OAuthProviderId;
  externalAccountId: string | null;
  email: string | null;
  displayName: string | null;
  status: OAuthAccountStatus;
  disabledReason: string | null;
  routeConfig?: OAuthAccountRouteConfig | null;
  routingState?: OAuthAccountRoutingState | null;
  chatgptWorkspaces?: OAuthAccountChatgptWorkspace[] | null;
  defaultChatgptWorkspaceId?: string | null;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
};

export type OAuthAccountUpsertInput = {
  accountId: string;
  provider: OAuthProviderId;
  externalAccountId?: string | null;
  email?: string | null;
  displayName?: string | null;
  status?: OAuthAccountStatus;
  disabledReason?: string | null;
  routeConfig?: OAuthAccountRouteConfig | null;
  routingState?: OAuthAccountRoutingState | null;
  chatgptWorkspaces?: OAuthAccountChatgptWorkspace[] | null;
  defaultChatgptWorkspaceId?: string | null;
  metadata?: Record<string, unknown>;
};

export type OAuthPrimaryAccountSummary = {
  provider: OAuthProviderId;
  accountId: string | null;
  account: OAuthAccountSummary | null;
  defaultPoolId: string;
  routeAccountId: string | null;
  inSync: boolean;
  createdAt: number;
  updatedAt: number;
};

export type OAuthPrimaryAccountSetInput = {
  provider: OAuthProviderId;
  accountId: string | null;
};

export type OAuthPoolSummary = {
  poolId: string;
  provider: OAuthProviderId;
  name: string;
  strategy: OAuthPoolStrategy;
  stickyMode: OAuthStickyMode;
  preferredAccountId: string | null;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
};

export type OAuthPoolUpsertInput = {
  poolId: string;
  provider: OAuthProviderId;
  name: string;
  strategy?: OAuthPoolStrategy;
  stickyMode?: OAuthStickyMode;
  preferredAccountId?: string | null;
  enabled?: boolean;
  metadata?: Record<string, unknown>;
};

export type OAuthPoolMember = {
  poolId: string;
  accountId: string;
  weight: number;
  priority: number;
  position: number;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
};

export type OAuthPoolMemberInput = {
  accountId: string;
  weight?: number;
  priority?: number;
  position?: number;
  enabled?: boolean;
};

export type OAuthPoolApplyInput = {
  pool: OAuthPoolUpsertInput;
  members: OAuthPoolMemberInput[];
  expectedUpdatedAt?: number | null;
};

export type OAuthPoolApplyResult = {
  pool: OAuthPoolSummary;
  members: OAuthPoolMember[];
};

export type OAuthPoolSelectionRequest = {
  poolId: string;
  sessionId?: string | null;
  // Canonical selector for ChatGPT/Codex workspace membership.
  chatgptWorkspaceId?: string | null;
  // Legacy compat alias. New callers should use `chatgptWorkspaceId`.
  workspaceId?: string | null;
  modelId?: string | null;
};

export type OAuthPoolSelectionResult = {
  poolId: string;
  account: OAuthAccountSummary;
  reason: string;
};

export type OAuthPoolAccountBindRequest = {
  poolId: string;
  sessionId: string;
  accountId: string;
  // Canonical selector for the target ChatGPT workspace when the caller wants
  // the project-workspace binding to target one specific ChatGPT workspace.
  chatgptWorkspaceId?: string | null;
  // Legacy compat alias. New callers should use `chatgptWorkspaceId`.
  workspaceId?: string | null;
};

export type NativeProvidersSnapshot = {
  providers: RuntimeProviderCatalogEntry[];
  accounts: OAuthAccountSummary[];
  pools: OAuthPoolSummary[];
  poolMembersByPoolId: Record<string, OAuthPoolMember[]>;
};

export type NativeProviderConnectionProbeInput = {
  provider?: OAuthProviderId | null;
  providerId?: string | null;
  poolId?: string | null;
  accountId?: string | null;
  sessionId?: string | null;
  modelId?: string | null;
};

export type NativeProviderConnectionProbeResult = {
  ok: boolean;
  available: boolean;
  provider: OAuthProviderId | (string & {}) | null;
  poolId: string | null;
  accountId: string | null;
  sessionId: string | null;
  modelId: string | null;
  latencyMs: number;
  selection: OAuthPoolSelectionResult | null;
  diagnostics: {
    accounts: number;
    pools: number;
    members: number;
  };
  error: string | null;
  poolMembersByPoolId: Record<string, OAuthPoolMember[]>;
};

export type CliSessionSummary = {
  sessionId: string;
  updatedAt: number;
  path: string;
  startedAt?: number;
  cwd?: string;
  model?: string;
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type OAuthRateLimitReportInput = {
  accountId: string;
  modelId?: string | null;
  success?: boolean;
  retryAfterSec?: number | null;
  resetAt?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
};

export type OAuthChatgptAuthTokensRefreshReason = "unauthorized";

export type OAuthChatgptAuthTokensRefreshRequest = {
  reason?: OAuthChatgptAuthTokensRefreshReason | null;
  // Optional runtime session identifier. When present, refresh should prefer
  // the same workspace-aware account binding used by pool selection.
  sessionId?: string | null;
  previousAccountId?: string | null;
  // Canonical selector for the target ChatGPT workspace.
  chatgptWorkspaceId?: string | null;
  // Legacy compat alias. New callers should use `chatgptWorkspaceId`.
  workspaceId?: string | null;
};

export type OAuthChatgptAuthTokensRefreshResponse = {
  accessToken: string;
  chatgptAccountId: string;
  chatgptPlanType: string | null;
  sourceAccountId: string;
};

export type OAuthCodexLoginStartRequest = {
  workspaceId: string;
  forceOAuth?: boolean;
};

export type OAuthCodexLoginStartResponse = {
  loginId: string;
  authUrl: string;
  immediateSuccess?: boolean;
};

export type OAuthCodexLoginCancelRequest = {
  workspaceId: string;
};

export type OAuthCodexLoginCancelResponse = {
  canceled: boolean;
  status?: string | null;
};

export type RuntimeCockpitToolsCodexImportResponse = {
  scanned: number;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  sourcePath: string | null;
  message: string | null;
};

export type LiveSkillKind =
  | "network_analysis"
  | "research_orchestration"
  | "file_tree"
  | "file_search"
  | "file_read"
  | "file_write"
  | "file_edit"
  | "shell_command"
  | "computer_observe"
  | (string & {});

export type LiveSkillSource = "builtin" | "managed" | "workspace" | (string & {});

export type LiveSkillSummary = {
  id: string;
  name: string;
  description: string;
  kind: LiveSkillKind;
  source: LiveSkillSource;
  version: string;
  enabled: boolean;
  supportsNetwork: boolean;
  tags: string[];
  aliases?: string[] | null;
};

export type LiveSkillExecutionResultItem = {
  title: string;
  url: string;
  snippet: string;
  content: string | null;
  domain?: string | null;
  dedupeKey?: string | null;
  fetchedAt?: number | null;
  publishedAt?: string | null;
};

export type LiveSkillNetworkResult = {
  query: string;
  provider: string;
  fetchedAt: number;
  items: LiveSkillExecutionResultItem[];
};

export type LiveSkillResearchRunSession = {
  sessionId: string;
  query: string;
  status: string;
  scopeProfile: SubAgentScopeProfile;
  allowNetwork: boolean;
  allowedSkillIds: string[];
  workspaceReadPaths: string[];
  parentRunId: string;
  profileDescriptor?: SubAgentScopeProfileDescriptor | null;
  checkpointId?: string | null;
  traceId?: string | null;
  recovered?: boolean | null;
  checkpointState?: RuntimeCheckpointState | null;
  takeoverBundle?: RuntimeTakeoverBundle | null;
  approvalEvents?: RuntimeApprovalEvent[] | null;
  compactionSummary?: RuntimeCompactionSummary | null;
  evalTags?: string[] | null;
  providerDiagnostics?: Record<string, unknown> | null;
};

export type LiveSkillResearchCitation = {
  query: string;
  title: string;
  url: string;
  domain?: string | null;
  snippet: string;
  contentPreview?: string | null;
  dedupeKey?: string | null;
  fetchedAt?: number | null;
  publishedAt?: string | null;
};

export type LiveSkillResearchRunMetadata = {
  goal: string;
  subQueries: string[];
  sessions: LiveSkillResearchRunSession[];
  citations: LiveSkillResearchCitation[];
  highlights: string[];
  gaps: string[];
  freshnessSummary: {
    freshestPublishedAt?: string | null;
    citationCount: number;
    datedCitationCount: number;
  };
  providerDiagnostics: Record<string, unknown>;
};

export type LiveSkillExecutionMetadata = Record<string, unknown> & {
  profileUsed?: SubAgentScopeProfile | null;
  approvalEvents?: RuntimeApprovalEvent[] | null;
  checkpointState?: RuntimeCheckpointState | null;
  compactionSummary?: RuntimeCompactionSummary | null;
  evalTags?: string[] | null;
  researchRun?: LiveSkillResearchRunMetadata | null;
};

export type RuntimeArtifact =
  | {
      kind: "image";
      title?: string | null;
      mimeType: string;
      dataBase64: string;
      detail?: string | null;
    }
  | {
      kind: "resource";
      title?: string | null;
      uri: string;
      mimeType?: string | null;
      description?: string | null;
    };

export type LiveSkillExecutionResult = {
  runId: string;
  skillId: string;
  status: "completed" | "failed" | "blocked";
  message: string;
  output: string;
  network: LiveSkillNetworkResult | null;
  artifacts: RuntimeArtifact[];
  metadata: LiveSkillExecutionMetadata;
};

export type LiveSkillExecuteContext = {
  accessMode?: string | null;
  access_mode?: string | null;
  provider?: string | null;
  modelId?: string | null;
  model_id?: string | null;
} & Record<string, unknown>;

export type LiveSkillExecuteRequest = {
  skillId: string;
  input: string;
  context?: LiveSkillExecuteContext | null;
  options?: {
    query?: string | null;
    pattern?: string | null;
    matchMode?: "literal" | "regex" | null;
    caseSensitive?: boolean | null;
    wholeWord?: boolean | null;
    includeGlobs?: string[] | null;
    excludeGlobs?: string[] | null;
    contextBefore?: number | null;
    contextAfter?: number | null;
    maxResults?: number | null;
    maxCharsPerResult?: number | null;
    timeoutMs?: number | null;
    allowNetwork?: boolean | null;
    subQueries?: string[] | null;
    maxSubQueries?: number | null;
    maxParallel?: number | null;
    preferDomains?: string[] | null;
    recencyDays?: number | null;
    fetchPageContent?: boolean | null;
    workspaceContextPaths?: string[] | null;
    workspaceId?: string | null;
    path?: string | null;
    maxDepth?: number | null;
    includeHidden?: boolean | null;
    includeViewport?: boolean | null;
    content?: string | null;
    find?: string | null;
    replace?: string | null;
    command?: string | null;
  } | null;
  skill_id?: string;
};

export type RuntimeToolExecutionStatus =
  | "success"
  | "validation_failed"
  | "runtime_failed"
  | "timeout"
  | "blocked";

export type RuntimeToolExecutionScope = "write" | "runtime" | "computer_observe";

export type RuntimeToolExecutionEventPhase = "attempted" | "started" | "completed";

export type RuntimeToolExecutionEvent = {
  toolName: string;
  scope: RuntimeToolExecutionScope;
  phase: RuntimeToolExecutionEventPhase;
  at: number;
  status?: RuntimeToolExecutionStatus | null;
  errorCode?: string | null;
  durationMs?: number | null;
  traceId?: string | null;
  spanId?: string | null;
  parentSpanId?: string | null;
  attempt?: number | null;
  requestId?: string | null;
  plannerStepKey?: string | null;
  workspaceId?: string | null;
};

export type RuntimeToolExecutionRecentEntry = {
  toolName: string;
  scope: RuntimeToolExecutionScope;
  status: RuntimeToolExecutionStatus;
  errorCode: string | null;
  durationMs: number | null;
  at: number;
  traceId?: string | null;
  spanId?: string | null;
  parentSpanId?: string | null;
  attempt?: number | null;
  requestId?: string | null;
  plannerStepKey?: string | null;
  workspaceId?: string | null;
};

export type RuntimeToolExecutionTotals = {
  attemptedTotal: number;
  startedTotal: number;
  completedTotal: number;
  successTotal: number;
  validationFailedTotal: number;
  runtimeFailedTotal: number;
  timeoutTotal: number;
  blockedTotal: number;
  repetitionBlockedTotal?: number;
  approvalTimeoutTotal?: number;
  subAgentTimeoutTotal?: number;
  staleWriteRejectedTotal?: number;
  deltaQueueDropTotal?: number;
  streamGuardrailTrippedTotal?: number;
  terminalizationCasNoopTotal?: number;
  lifecycleSweepRunTotal?: number;
  lifecycleSweepSkipNoLeaseTotal?: number;
  lifecycleLeaseAcquireFailTotal?: number;
  lifecycleLeaseRenewFailTotal?: number;
  lifecycleLeaseLostTotal?: number;
  lifecycleLeaseContendedTotal?: number;
};

export type RuntimeToolExecutionByToolEntry = RuntimeToolExecutionTotals & {
  toolName: string;
  scope: RuntimeToolExecutionScope;
  lastStatus: RuntimeToolExecutionStatus | null;
  lastErrorCode: string | null;
  lastDurationMs: number | null;
  updatedAt: number;
};

export type RuntimeToolExecutionChannelHealth = {
  status: "healthy" | "degraded" | "unavailable";
  reason?: string | null;
  lastErrorCode?: string | null;
  updatedAt?: number | null;
};

export type RuntimeToolExecutionScopeRate = {
  scope: RuntimeToolExecutionScope;
  successRate: number | null;
  denominator: number;
  blockedTotal: number;
};

export type RuntimeToolExecutionErrorCodeCount = {
  errorCode: string;
  count: number;
};

export type RuntimeToolExecutionCircuitBreakerEntry = {
  scope: RuntimeToolExecutionScope;
  state: "closed" | "open" | "half_open";
  openedAt: number | null;
  updatedAt: number;
};

export type RuntimeToolExecutionMetricsSnapshot = {
  totals: RuntimeToolExecutionTotals;
  byTool: Record<string, RuntimeToolExecutionByToolEntry>;
  recent: RuntimeToolExecutionRecentEntry[];
  updatedAt: number;
  windowSize: number;
  channelHealth: RuntimeToolExecutionChannelHealth;
  scopeRates?: RuntimeToolExecutionScopeRate[] | null;
  errorCodeTopK?: RuntimeToolExecutionErrorCodeCount[] | null;
  circuitBreakers: RuntimeToolExecutionCircuitBreakerEntry[];
};

export type RuntimeToolExecutionMetricsReadRequest = {
  scope?: RuntimeToolExecutionScope | null;
  toolName?: string | null;
  sinceMs?: number | null;
  limit?: number | null;
};

export type RuntimeToolGuardrailBlockReason =
  | "payload_too_large"
  | "rate_limited"
  | "circuit_open"
  | "metrics_unhealthy";

export type RuntimeToolGuardrailCapabilityProfile = "default" | "solo-max";

export type RuntimeToolGuardrailEvaluateRequest = {
  toolName: string;
  scope: RuntimeToolExecutionScope;
  workspaceId?: string | null;
  payloadBytes: number;
  at?: number | null;
  requestId?: string | null;
  traceId?: string | null;
  spanId?: string | null;
  parentSpanId?: string | null;
  plannerStepKey?: string | null;
  attempt?: number | null;
  capabilityProfile?: RuntimeToolGuardrailCapabilityProfile | null;
};

export type RuntimeToolGuardrailEvaluateResult = {
  allowed: boolean;
  blockReason: RuntimeToolGuardrailBlockReason | null;
  errorCode: string | null;
  message: string | null;
  channelHealth: RuntimeToolExecutionChannelHealth;
  circuitBreaker: RuntimeToolExecutionCircuitBreakerEntry | null;
  effectivePayloadLimitBytes?: number | null;
  effectiveComputerObserveRateLimitPerMinute?: number | null;
  updatedAt: number;
};

export type RuntimeToolGuardrailOutcomeEvent = {
  toolName: string;
  scope: RuntimeToolExecutionScope;
  status: RuntimeToolExecutionStatus;
  at: number;
  workspaceId?: string | null;
  durationMs?: number | null;
  errorCode?: string | null;
  requestId?: string | null;
  traceId?: string | null;
  spanId?: string | null;
  parentSpanId?: string | null;
  plannerStepKey?: string | null;
  attempt?: number | null;
};

export type RuntimeToolGuardrailStateSnapshot = {
  windowSize: number;
  payloadLimitBytes: number;
  computerObserveRateLimitPerMinute: number;
  circuitWindowSize: number;
  circuitMinCompleted: number;
  circuitOpenMs: number;
  halfOpenMaxProbes: number;
  halfOpenRequiredSuccesses: number;
  channelHealth: RuntimeToolExecutionChannelHealth;
  circuitBreakers: RuntimeToolExecutionCircuitBreakerEntry[];
  updatedAt: number;
};

export type RuntimePolicyMode = "strict" | "balanced" | "aggressive";

export type ToolRiskLevel = "low" | "medium" | "high" | "critical";

export type ToolPreflightDecisionAction = "allow" | "require_approval" | "deny";

export type ActionRequiredKind = "approval" | "elicitation" | "review_decision";

export type ActionRequiredStatus =
  | "submitted"
  | "approved"
  | "rejected"
  | "timeout"
  | "cancelled"
  | "error";

export type ToolExecutionOutcome =
  | "success"
  | "failed"
  | "interrupted"
  | "timeout"
  | "guardrail_blocked";

export type RuntimeToolPreflightV2Request = {
  toolName: string;
  scope?: RuntimeToolExecutionScope | null;
  workspaceId?: string | null;
  payload?: unknown;
  payloadBytes?: number | null;
  at?: number | null;
  requestId?: string | null;
  traceId?: string | null;
  spanId?: string | null;
  parentSpanId?: string | null;
  plannerStepKey?: string | null;
  attempt?: number | null;
};

export type ToolPreflightDecision = {
  action: ToolPreflightDecisionAction;
  riskLevel: ToolRiskLevel;
  requiresApproval: boolean;
  policyMode: RuntimePolicyMode;
  errorCode: string | null;
  message: string | null;
  guardrail: RuntimeToolGuardrailEvaluateResult | null;
};

export type ActionRequiredRecord = {
  requestId: string;
  kind: ActionRequiredKind;
  status: ActionRequiredStatus;
  action: string | null;
  reason: string | null;
  input: Record<string, unknown> | null;
  createdAt: number | null;
  decidedAt: number | null;
  decisionReason: string | null;
};

export type ActionRequiredSubmitRequest = {
  requestId: string;
  kind?: ActionRequiredKind | null;
  status: ActionRequiredStatus;
  reason?: string | null;
};

export type RuntimeToolOutcomeRecordRequest = {
  toolName: string;
  scope: RuntimeToolExecutionScope;
  outcome: ToolExecutionOutcome;
  at?: number | null;
  workspaceId?: string | null;
  durationMs?: number | null;
  errorCode?: string | null;
  requestId?: string | null;
  traceId?: string | null;
  spanId?: string | null;
  parentSpanId?: string | null;
  plannerStepKey?: string | null;
  attempt?: number | null;
};

export type RuntimePolicySnapshot = {
  mode: RuntimePolicyMode;
  updatedAt: number;
};

export type RuntimePolicySetRequest = {
  mode: RuntimePolicyMode;
  actor?: string | null;
};

export type KernelCapabilityKind =
  | "terminal"
  | "job"
  | "backend"
  | "extension"
  | "skill"
  | "policy"
  | "context";

export type KernelCapabilityHealth = "ready" | "attention" | "blocked";

export type KernelPlacement = "local" | "remote";

export type KernelInteractivity = "interactive" | "background";

export type KernelIsolation = "host" | "desktop_sandbox" | "container_sandbox" | "vm";

export type KernelNetworkMode = "default" | "restricted" | "offline";

export type KernelAuthority = "user" | "service" | "delegated";

export type KernelExecutionProfile = {
  placement: KernelPlacement;
  interactivity: KernelInteractivity;
  isolation: KernelIsolation;
  network: KernelNetworkMode;
  authority: KernelAuthority;
};

export type KernelCapabilityDescriptor = {
  id: string;
  name: string;
  kind: KernelCapabilityKind;
  enabled: boolean;
  health: KernelCapabilityHealth;
  executionProfile: KernelExecutionProfile;
  tags?: string[] | null;
  metadata?: Record<string, unknown> | null;
};

export type KernelContinuation = {
  checkpointId?: string | null;
  resumeSupported: boolean;
  recovered: boolean;
  reviewActionability?: Record<string, unknown> | null;
  takeover?: Record<string, unknown> | null;
  missionLinkage?: Record<string, unknown> | null;
  publishHandoff?: Record<string, unknown> | null;
  summary?: string | null;
};

export type KernelSessionKind = "pty";

export type KernelSession = {
  id: string;
  kind: KernelSessionKind;
  workspaceId: string | null;
  state: string;
  createdAt: number;
  updatedAt: number;
  executionProfile: KernelExecutionProfile;
  lines?: string[] | null;
  metadata?: Record<string, unknown> | null;
};

export type KernelJob = {
  id: string;
  workspaceId: string;
  threadId?: string | null;
  title?: string | null;
  status: string;
  provider?: ModelProvider | null;
  modelId?: string | null;
  backendId?: string | null;
  preferredBackendIds?: string[] | null;
  executionProfile: KernelExecutionProfile;
  createdAt: number;
  updatedAt: number;
  startedAt?: number | null;
  completedAt?: number | null;
  continuation: KernelContinuation;
  metadata?: Record<string, unknown> | null;
};

export type KernelContextScope =
  | { kind: "global" }
  | { kind: "workspace"; workspaceId: string }
  | { kind: "thread"; workspaceId: string; threadId: string }
  | { kind: "task"; taskId: string }
  | { kind: "run"; runId: string }
  | { kind: "skills"; workspaceId?: string | null };

export type KernelContextSlice = {
  scope: KernelContextScope;
  revision: number;
  snapshot: Record<string, unknown>;
  latestEvent?: Record<string, unknown> | null;
  sources?: string[] | null;
};

export type KernelExtensionBundle = {
  id: string;
  name: string;
  enabled: boolean;
  transport: RuntimeExtensionTransport;
  workspaceId: string | null;
  toolCount: number;
  resourceCount: number;
  surfaces: string[];
  installedAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown> | null;
};

export type KernelPolicyDecision = {
  decision: "allow" | "ask" | "deny";
  reason: string;
  policyMode: RuntimePolicyMode;
  evaluatedAt: number;
  channelHealth?: RuntimeToolExecutionChannelHealth | null;
  circuitBreaker?: RuntimeToolExecutionCircuitBreakerEntry | null;
  metadata?: Record<string, unknown> | null;
};

export type KernelProjectionScope =
  | "mission_control"
  | "jobs"
  | "sessions"
  | "capabilities"
  | "extensions"
  | "continuity"
  | "diagnostics";

export type KernelProjectionSlices = Partial<Record<KernelProjectionScope, unknown>>;

export type KernelCapabilitiesSlice = KernelCapabilityDescriptor[];

export type KernelContinuitySummary = {
  recoverableRunCount: number;
  reviewBlockedCount: number;
  itemCount: number;
};

export type KernelContinuityItem = {
  taskId: string;
  runId: string;
  checkpoint?: HugeCodeCheckpointSummary | null;
  missionLinkage?: HugeCodeMissionLinkageSummary | null;
  reviewActionability?: HugeCodeReviewActionabilitySummary | null;
  publishHandoff?: HugeCodePublishHandoffReference | null;
  takeoverBundle?: HugeCodeTakeoverBundle | null;
};

export type KernelContinuitySlice = {
  summary: KernelContinuitySummary;
  items: KernelContinuityItem[];
};

export type KernelDiagnosticsSlice = {
  revision: number;
  latestEvent?: unknown | null;
  runtime: unknown;
  toolMetrics: RuntimeToolExecutionMetricsSnapshot;
  toolGuardrails: RuntimeToolGuardrailStateSnapshot;
};

export type KernelProjectionBootstrapRequest = {
  scopes?: KernelProjectionScope[] | null;
};

export type KernelProjectionBootstrapResponse = {
  revision: number;
  sliceRevisions: Partial<Record<KernelProjectionScope, number>>;
  slices: KernelProjectionSlices;
};

export type KernelProjectionSubscriberConfig = {
  maxBufferDepth?: number | null;
};

export type KernelProjectionOpType = "replace" | "upsert" | "remove" | "patch" | "resync_required";

export type KernelProjectionOp = {
  type: KernelProjectionOpType;
  scope: KernelProjectionScope;
  key?: string | null;
  value?: unknown;
  patch?: Record<string, unknown> | null;
  revision?: number | null;
  reason?: string | null;
};

export type KernelProjectionDelta = {
  revision: number;
  scopes: KernelProjectionScope[];
  ops: KernelProjectionOp[];
};

export type KernelProjectionSubscriptionRequest = {
  scopes?: KernelProjectionScope[] | null;
  lastRevision?: number | null;
  subscriberConfig?: KernelProjectionSubscriberConfig | null;
};

export type KernelProjectionSubscriptionAck = {
  ok: true;
  revision: number;
  scopes: KernelProjectionScope[];
  transport: "ws" | "tauri-event" | "fallback-runtime-updated";
};

export type KernelSessionsListRequest = {
  workspaceId?: string | null;
  kind?: KernelSessionKind | null;
};

export type KernelJobsListRequest = {
  workspaceId?: string | null;
  status?: string | null;
};

export type KernelContextSnapshotRequest = KernelContextScope;

export type KernelExtensionsListRequest = {
  workspaceId?: string | null;
};

export type KernelPoliciesEvaluateRequest = {
  toolName?: string | null;
  scope?: RuntimeToolExecutionScope | null;
  workspaceId?: string | null;
  payloadBytes?: number | null;
  requiresApproval?: boolean | null;
  capabilityId?: string | null;
  mutationKind?: string | null;
};

export type RuntimeExtensionTransport =
  | "builtin"
  | "mcp-stdio"
  | "mcp-http"
  | "frontend"
  | (string & {});

export type RuntimeExtensionSpec = {
  extensionId: string;
  name: string;
  transport: RuntimeExtensionTransport;
  enabled: boolean;
  workspaceId: string | null;
  config: Record<string, unknown>;
  installedAt: number;
  updatedAt: number;
};

export type RuntimeExtensionToolSummary = {
  extensionId: string;
  toolName: string;
  description: string;
  inputSchema: Record<string, unknown> | null;
  readOnly: boolean;
};

export type RuntimeExtensionInstallRequest = {
  workspaceId?: string | null;
  extensionId: string;
  name: string;
  transport: RuntimeExtensionTransport;
  enabled?: boolean;
  config?: Record<string, unknown> | null;
};

export type RuntimeExtensionRemoveRequest = {
  workspaceId?: string | null;
  extensionId: string;
};

export type RuntimeExtensionToolsListRequest = {
  workspaceId?: string | null;
  extensionId: string;
};

export type RuntimeExtensionResourceReadRequest = {
  workspaceId?: string | null;
  extensionId: string;
  resourceId: string;
};

export type RuntimeExtensionResourceReadResponse = {
  extensionId: string;
  resourceId: string;
  contentType: string;
  content: string;
  metadata: Record<string, unknown> | null;
};

export type RuntimeExtensionsConfigResponse = {
  extensions: RuntimeExtensionSpec[];
  warnings: string[];
};

export type RuntimeSessionExportRequest = {
  workspaceId: string;
  threadId: string;
  includeAgentTasks?: boolean;
};

export type RuntimeSessionExportResponse = {
  schemaVersion: string;
  exportedAt: number;
  workspaceId: string;
  threadId: string;
  snapshot: Record<string, unknown>;
};

export type RuntimeSessionImportRequest = {
  workspaceId: string;
  snapshot: Record<string, unknown>;
  threadId?: string | null;
};

export type RuntimeSessionImportResponse = {
  schemaVersion: string;
  workspaceId: string;
  threadId: string;
  imported: boolean;
  warnings: string[];
};

export type RuntimeSessionDeleteRequest = {
  workspaceId: string;
  threadId: string;
};

export type RuntimeThreadSnapshotsGetRequest = {};

export type RuntimeThreadSnapshotsGetResponse = {
  snapshots: Record<string, Record<string, unknown>>;
  updatedAt: number | null;
};

export type RuntimeThreadSnapshotsSetRequest = {
  snapshots: Record<string, Record<string, unknown>>;
};

export type RuntimeThreadSnapshotsSetResponse = {
  snapshotCount: number;
  updatedAt: number;
};

export type RuntimeCodexExecRunRequest = {
  workspaceId?: string | null;
  prompt: string;
  codexBin?: string | null;
  codexArgs?: string[] | null;
  outputSchema?: Record<string, unknown> | null;
  approvalPolicy?: string | null;
  sandboxMode?: string | null;
};

export type RuntimeCodexExecEventEnvelope = {
  index: number;
  type: string;
  payload: Record<string, unknown>;
  emittedAt?: number | null;
};

export type RuntimeCodexExecRunResponse = {
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  events: RuntimeCodexExecEventEnvelope[];
  finalMessage: string | null;
  finalJson: Record<string, unknown> | null;
  warnings: string[];
};

export type RuntimeCodexCloudTasksListRequest = {
  workspaceId?: string | null;
  cursor?: string | null;
  limit?: number | null;
  forceRefetch?: boolean;
};

export type RuntimeCodexCloudTaskSummary = {
  id: string;
  url: string | null;
  title: string | null;
  status: string;
  updatedAt: string | null;
  environmentId: string | null;
  environmentLabel: string | null;
  summary: string | null;
  isReview: boolean;
  attemptTotal: number | null;
};

export type RuntimeCodexCloudTasksListResponse = {
  tasks: RuntimeCodexCloudTaskSummary[];
  cursor: string | null;
  warnings: string[];
};

export type RuntimeCodexConfigPathResponse = {
  path: string | null;
  exists: boolean;
};

export type RuntimeCodexDoctorRequest = {
  codexBin?: string | null;
  codexArgs?: string[] | null;
};

export type RuntimeCodexDoctorResponse = {
  ok: boolean;
  codexBin: string | null;
  version: string | null;
  appServerOk: boolean;
  details: string | null;
  path: string | null;
  nodeOk: boolean;
  nodeVersion: string | null;
  nodeDetails: string | null;
  warnings?: string[];
};

export type RuntimeCodexUpdateRequest = {
  codexBin?: string | null;
  codexArgs?: string[] | null;
};

export type RuntimeCodexUpdateMethod = "brew_formula" | "brew_cask" | "npm" | "unknown";

export type RuntimeCodexUpdateResponse = {
  ok: boolean;
  method: RuntimeCodexUpdateMethod;
  package: string | null;
  beforeVersion: string | null;
  afterVersion: string | null;
  upgraded: boolean;
  output: string | null;
  details: string | null;
  warnings?: string[];
};

export type RuntimeCollaborationModeMask = {
  id: string;
  label: string;
  mode: string;
  model: string;
  reasoningEffort: string | null;
  developerInstructions: string | null;
  value: Record<string, unknown>;
};

export type RuntimeCollaborationModesListResponse = {
  data: RuntimeCollaborationModeMask[];
  warnings: string[];
};

export type RuntimeAppsListRequest = {
  workspaceId: string;
  cursor?: string | null;
  limit?: number | null;
  threadId?: string | null;
};

export type RuntimeAppInfo = {
  id: string;
  name: string;
  description?: string;
  isAccessible: boolean;
  installUrl?: string | null;
  distributionChannel?: string | null;
};

export type RuntimeAppsListResponse = {
  data: RuntimeAppInfo[];
  nextCursor: string | null;
  warnings: string[];
};

export type RuntimeMcpServerStatusListRequest = {
  workspaceId: string;
  cursor?: string | null;
  limit?: number | null;
};

export type RuntimeMcpServerStatusSummary = {
  id?: string | null;
  name: string;
  status?: string | null;
  authStatus?: string | Record<string, unknown> | null;
  tools?: Record<string, unknown> | null;
  resources?: unknown[];
  resourceTemplates?: unknown[];
  warnings?: string[];
};

export type RuntimeMcpServerStatusListResponse = {
  data: RuntimeMcpServerStatusSummary[];
  nextCursor: string | null;
  warnings: string[];
};

export type RuntimeBrowserDebugMode =
  | "mcp-playwright"
  | "observe-only"
  | "unavailable"
  | (string & {});

export type RuntimeBrowserDebugAvailabilityStatus =
  | "ready"
  | "degraded"
  | "blocked"
  | "unavailable"
  | (string & {});

export type RuntimeBrowserDebugToolSummary = {
  name: string;
  description?: string | null;
  readOnly?: boolean | null;
  inputSchema?: Record<string, unknown> | null;
};

export type RuntimeBrowserDebugStatusRequest = {
  workspaceId: string;
};

export type RuntimeBrowserDebugStatusResponse = {
  workspaceId: string;
  available: boolean;
  mode: RuntimeBrowserDebugMode;
  status: RuntimeBrowserDebugAvailabilityStatus;
  packageRoot?: string | null;
  serverName?: string | null;
  tools: RuntimeBrowserDebugToolSummary[];
  warnings: string[];
};

export type RuntimeBrowserDebugToolCall = {
  toolName: string;
  arguments?: Record<string, unknown> | null;
};

export type RuntimeBrowserDebugOperation = "inspect" | "automation";

export type RuntimeBrowserDebugRunRequest = {
  workspaceId: string;
  operation: RuntimeBrowserDebugOperation;
  prompt?: string | null;
  includeScreenshot?: boolean | null;
  timeoutMs?: number | null;
  steps?: RuntimeBrowserDebugToolCall[] | null;
};

export type RuntimeBrowserDebugArtifact = RuntimeArtifact;

export type RuntimeBrowserDebugToolCallResult = {
  toolName: string;
  ok: boolean;
  contentText?: string | null;
  structuredContent?: Record<string, unknown> | null;
  artifacts?: RuntimeBrowserDebugArtifact[] | null;
  error?: string | null;
};

export type RuntimeBrowserDebugRunResponse = {
  workspaceId: string;
  available: boolean;
  status: "completed" | "failed" | "blocked";
  mode: RuntimeBrowserDebugMode;
  operation: RuntimeBrowserDebugOperation;
  message: string;
  toolCalls: RuntimeBrowserDebugToolCallResult[];
  contentText?: string | null;
  structuredContent?: Record<string, unknown> | null;
  artifacts: RuntimeBrowserDebugArtifact[];
  warnings: string[];
};

export type RuntimeSecurityPreflightRequest = {
  workspaceId?: string | null;
  toolName?: string | null;
  command?: string | null;
  input?: Record<string, unknown> | null;
  checkPackageAdvisory?: boolean;
  checkExecPolicy?: boolean;
  execPolicyRules?: string[] | null;
};

export type RuntimeSecurityPreflightDecision = {
  action: "allow" | "review" | "block";
  reason: string;
  advisories: Array<{
    packageManager: string;
    packageName: string;
    indicator: string;
    severity: string;
  }>;
  execPolicyDecision?: "allow" | "prompt" | "forbidden" | null;
  execPolicyMatchedRules?: Array<{
    matchedPrefix: string[];
    decision: string;
    justification?: string | null;
  }>;
};

export type RuntimeDiagnosticsRedactionLevel = "strict" | "balanced" | "minimal";

export type RuntimeDiagnosticsExportRequest = {
  workspaceId?: string | null;
  redactionLevel?: RuntimeDiagnosticsRedactionLevel;
  includeTaskSummaries?: boolean;
  includeEventTail?: boolean;
  includeZipBase64?: boolean;
};

export type RuntimeDiagnosticsExportResponse = {
  schemaVersion: "runtime-diagnostics-export/v1";
  exportedAt: number;
  source: "runtime-service" | "tauri";
  redactionLevel: RuntimeDiagnosticsRedactionLevel;
  filename: string;
  mimeType: "application/zip";
  sizeBytes: number;
  zipBase64: string | null;
  sections: string[];
  warnings: string[];
  redactionStats: {
    redactedKeys: number;
    redactedValues: number;
    hashedPaths: number;
    hashedEmails: number;
    hashedSecrets: number;
  };
};

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

export const CODE_RUNTIME_RPC_METHODS = {
  RPC_CAPABILITIES: "code_rpc_capabilities",
  HEALTH: "code_health",
  SETTINGS_SUMMARY: "code_settings_summary",
  APP_SETTINGS_GET: "code_app_settings_get",
  APP_SETTINGS_UPDATE: "code_app_settings_update",
  REMOTE_STATUS: "code_remote_status",
  TERMINAL_STATUS: "code_terminal_status",
  MODELS_POOL: "code_models_pool",
  PROVIDERS_CATALOG: "code_providers_catalog",
  WORKSPACES_LIST: "code_workspaces_list",
  BOOTSTRAP_SNAPSHOT: "code_bootstrap_snapshot",
  MISSION_CONTROL_SNAPSHOT_V1: "code_mission_control_snapshot_v1",
  MISSION_CONTROL_SUMMARY_V1: "code_mission_control_summary_v1",
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
  RUN_START: "code_runtime_run_start",
  RUN_PREPARE_V2: "code_runtime_run_prepare_v2",
  RUN_START_V2: "code_runtime_run_start_v2",
  RUN_CANCEL: "code_runtime_run_cancel",
  RUN_RESUME: "code_runtime_run_resume",
  RUN_RESUME_V2: "code_runtime_run_resume_v2",
  RUN_INTERVENE: "code_runtime_run_intervene",
  RUN_INTERVENE_V2: "code_runtime_run_intervene_v2",
  RUN_SUBSCRIBE: "code_runtime_run_subscribe",
  RUN_GET_V2: "code_runtime_run_get_v2",
  RUN_SUBSCRIBE_V2: "code_runtime_run_subscribe_v2",
  REVIEW_GET_V2: "code_runtime_review_get_v2",
  RUNS_LIST: "code_runtime_runs_list",
  KERNEL_JOB_START_V3: "code_kernel_job_start_v3",
  KERNEL_JOB_GET_V3: "code_kernel_job_get_v3",
  KERNEL_JOB_CANCEL_V3: "code_kernel_job_cancel_v3",
  KERNEL_JOB_RESUME_V3: "code_kernel_job_resume_v3",
  KERNEL_JOB_INTERVENE_V3: "code_kernel_job_intervene_v3",
  KERNEL_JOB_SUBSCRIBE_V3: "code_kernel_job_subscribe_v3",
  KERNEL_JOB_CALLBACK_REGISTER_V3: "code_kernel_job_callback_register_v3",
  KERNEL_JOB_CALLBACK_REMOVE_V3: "code_kernel_job_callback_remove_v3",
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
  APPS_LIST_V1: "code_apps_list_v1",
  MCP_SERVER_STATUS_LIST_V1: "code_mcp_server_status_list_v1",
  BROWSER_DEBUG_STATUS_V1: "code_browser_debug_status_v1",
  BROWSER_DEBUG_RUN_V1: "code_browser_debug_run_v1",
  EXTENSIONS_LIST_V1: "code_extensions_list_v1",
  EXTENSION_INSTALL_V1: "code_extension_install_v1",
  EXTENSION_REMOVE_V1: "code_extension_remove_v1",
  EXTENSION_TOOLS_LIST_V1: "code_extension_tools_list_v1",
  EXTENSION_RESOURCE_READ_V1: "code_extension_resource_read_v1",
  EXTENSIONS_CONFIG_V1: "code_extensions_config_v1",
  SESSION_EXPORT_V1: "code_session_export_v1",
  SESSION_IMPORT_V1: "code_session_import_v1",
  SESSION_DELETE_V1: "code_session_delete_v1",
  THREAD_SNAPSHOTS_GET_V1: "code_thread_snapshots_get_v1",
  THREAD_SNAPSHOTS_SET_V1: "code_thread_snapshots_set_v1",
  SECURITY_PREFLIGHT_V1: "code_security_preflight_v1",
  RUNTIME_DIAGNOSTICS_EXPORT_V1: "code_runtime_diagnostics_export_v1",
} as const;

export type CodeRuntimeRpcMethod =
  (typeof CODE_RUNTIME_RPC_METHODS)[keyof typeof CODE_RUNTIME_RPC_METHODS];

export const CODE_RUNTIME_RPC_METHOD_LIST = Object.freeze(
  Object.values(CODE_RUNTIME_RPC_METHODS)
) as readonly CodeRuntimeRpcMethod[];

export const CODE_RUNTIME_RPC_CONTRACT_VERSION = "2026-03-22" as const;
export const CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT = "2026-03-22" as const;
export const CODE_RUNTIME_RPC_CAPABILITY_PROFILES = Object.freeze({
  FULL_RUNTIME: "full-runtime",
  DESKTOP_CORE: "desktop-core",
} as const);
export type CodeRuntimeRpcCapabilityProfile =
  | (typeof CODE_RUNTIME_RPC_CAPABILITY_PROFILES)[keyof typeof CODE_RUNTIME_RPC_CAPABILITY_PROFILES]
  | (string & {});

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
  "app_server_protocol_v2_2026_03_22",
  "contract_frozen_2026_03_22",
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

export type RuntimeAppSettingsRecord = Record<string, unknown>;

export type RuntimeAppSettingsUpdateRequest = {
  payload: RuntimeAppSettingsRecord;
};

export type TurnSendRequestCompat = TurnSendRequest & {
  workspace_id?: string;
  thread_id?: string | null;
  request_id?: string;
  mission_mode?: HugeCodeTaskMode | null;
  execution_profile_id?: string | null;
  preferred_backend_ids?: string[] | null;
  contextPrefix?: string | null;
  context_prefix?: string | null;
  model_id?: string | null;
  reason_effort?: ReasonEffort | null;
  access_mode?: AccessMode;
  execution_mode?: TurnExecutionMode;
  codex_bin?: string | null;
  codex_args?: string[] | null;
};

export type TurnInterruptRequestCompat = TurnInterruptRequest & {
  turn_id?: string | null;
};

export type ThreadLiveSubscribeRequest = {
  workspaceId: string;
  threadId: string;
  workspace_id?: string;
  thread_id?: string;
};

export type ThreadLiveSubscribeResult = {
  subscriptionId: string;
  heartbeatIntervalMs: number;
  transportMode: "push";
  contextRevision: number;
};

export type ThreadLiveUnsubscribeRequest = {
  subscriptionId: string;
  subscription_id?: string;
};

export type ThreadLiveUnsubscribeResult = {
  ok: true;
};

export type MissionControlSummaryRequest = {
  activeWorkspaceId: string | null;
  active_workspace_id?: string | null;
};

export interface CodeRuntimeRpcRequestPayloadByMethod {
  [CODE_RUNTIME_RPC_METHODS.RPC_CAPABILITIES]: CodeRuntimeRpcEmptyParams;
  [CODE_RUNTIME_RPC_METHODS.HEALTH]: CodeRuntimeRpcEmptyParams;
  [CODE_RUNTIME_RPC_METHODS.SETTINGS_SUMMARY]: CodeRuntimeRpcEmptyParams;
  [CODE_RUNTIME_RPC_METHODS.APP_SETTINGS_GET]: CodeRuntimeRpcEmptyParams;
  [CODE_RUNTIME_RPC_METHODS.APP_SETTINGS_UPDATE]: RuntimeAppSettingsUpdateRequest;
  [CODE_RUNTIME_RPC_METHODS.REMOTE_STATUS]: CodeRuntimeRpcEmptyParams;
  [CODE_RUNTIME_RPC_METHODS.TERMINAL_STATUS]: CodeRuntimeRpcEmptyParams;
  [CODE_RUNTIME_RPC_METHODS.MODELS_POOL]: CodeRuntimeRpcEmptyParams;
  [CODE_RUNTIME_RPC_METHODS.PROVIDERS_CATALOG]: CodeRuntimeRpcEmptyParams;
  [CODE_RUNTIME_RPC_METHODS.WORKSPACES_LIST]: CodeRuntimeRpcEmptyParams;
  [CODE_RUNTIME_RPC_METHODS.BOOTSTRAP_SNAPSHOT]: CodeRuntimeRpcEmptyParams;
  [CODE_RUNTIME_RPC_METHODS.MISSION_CONTROL_SNAPSHOT_V1]: CodeRuntimeRpcEmptyParams;
  [CODE_RUNTIME_RPC_METHODS.MISSION_CONTROL_SUMMARY_V1]: MissionControlSummaryRequest;
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
  [CODE_RUNTIME_RPC_METHODS.RUN_PREPARE_V2]: RuntimeRunPrepareV2Request & {
    workspace_id?: string;
    thread_id?: string | null;
    request_id?: string;
    model_id?: string | null;
    reason_effort?: ReasonEffort | null;
    access_mode?: AccessMode;
    execution_mode?: AgentTaskExecutionMode;
    preferred_backend_ids?: string[] | null;
    auto_drive?: AgentTaskAutoDriveState | null;
    steps: Array<
      AgentTaskStepInput & {
        timeout_ms?: number | null;
        requires_approval?: boolean | null;
        approval_reason?: string | null;
      }
    >;
  };
  [CODE_RUNTIME_RPC_METHODS.RUN_START]: RuntimeRunStartRequest & {
    workspace_id?: string;
    thread_id?: string | null;
    request_id?: string;
    model_id?: string | null;
    reason_effort?: ReasonEffort | null;
    access_mode?: AccessMode;
    execution_mode?: AgentTaskExecutionMode;
    preferred_backend_ids?: string[] | null;
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
    auto_drive?: AgentTaskAutoDriveState | null;
    steps: Array<
      AgentTaskStepInput & {
        timeout_ms?: number | null;
        requires_approval?: boolean | null;
        approval_reason?: string | null;
      }
    >;
  };
  [CODE_RUNTIME_RPC_METHODS.RUN_CANCEL]: RuntimeRunCancelRequest & {
    run_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.RUN_RESUME]: RuntimeRunResumeRequest & {
    run_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.RUN_RESUME_V2]: RuntimeRunResumeRequest & {
    run_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.RUN_INTERVENE]: RuntimeRunInterventionRequest & {
    run_id?: string;
    instruction_patch?: string | null;
    execution_profile_id?: string | null;
    preferred_backend_ids?: string[] | null;
  };
  [CODE_RUNTIME_RPC_METHODS.RUN_INTERVENE_V2]: RuntimeRunInterventionRequest & {
    run_id?: string;
    instruction_patch?: string | null;
    execution_profile_id?: string | null;
    preferred_backend_ids?: string[] | null;
  };
  [CODE_RUNTIME_RPC_METHODS.RUN_SUBSCRIBE]: RuntimeRunSubscribeRequest & {
    run_id?: string;
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
  [CODE_RUNTIME_RPC_METHODS.KERNEL_JOB_START_V3]: KernelJobStartRequestV3 & {
    workspace_id?: string;
    thread_id?: string | null;
    request_id?: string;
    model_id?: string | null;
    reason_effort?: ReasonEffort | null;
    access_mode?: AccessMode;
    execution_mode?: AgentTaskExecutionMode;
    preferred_backend_ids?: string[] | null;
    auto_drive?: AgentTaskAutoDriveState | null;
    steps: Array<
      AgentTaskStepInput & {
        timeout_ms?: number | null;
        requires_approval?: boolean | null;
        approval_reason?: string | null;
      }
    >;
  };
  [CODE_RUNTIME_RPC_METHODS.KERNEL_JOB_GET_V3]: KernelJobGetRequestV3 & {
    job_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.KERNEL_JOB_CANCEL_V3]: KernelJobCancelRequestV3 & {
    run_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.KERNEL_JOB_RESUME_V3]: KernelJobResumeRequestV3 & {
    run_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.KERNEL_JOB_INTERVENE_V3]: KernelJobInterventionRequestV3 & {
    run_id?: string;
    instruction_patch?: string | null;
    execution_profile_id?: string | null;
    preferred_backend_ids?: string[] | null;
  };
  [CODE_RUNTIME_RPC_METHODS.KERNEL_JOB_SUBSCRIBE_V3]: KernelJobSubscribeRequestV3 & {
    run_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.KERNEL_JOB_CALLBACK_REGISTER_V3]: KernelJobCallbackRegistrationV3 & {
    workspace_id?: string | null;
    job_id?: string | null;
    callback_id?: string;
    callback_url?: string | null;
  };
  [CODE_RUNTIME_RPC_METHODS.KERNEL_JOB_CALLBACK_REMOVE_V3]: KernelJobCallbackRemoveRequestV3 & {
    callback_id?: string;
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
  [CODE_RUNTIME_RPC_METHODS.APPS_LIST_V1]: RuntimeAppsListRequest & {
    workspace_id?: string;
    thread_id?: string | null;
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
  [CODE_RUNTIME_RPC_METHODS.EXTENSIONS_LIST_V1]: {
    workspaceId?: string | null;
    workspace_id?: string | null;
  };
  [CODE_RUNTIME_RPC_METHODS.EXTENSION_INSTALL_V1]: RuntimeExtensionInstallRequest & {
    workspace_id?: string | null;
    extension_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.EXTENSION_REMOVE_V1]: RuntimeExtensionRemoveRequest & {
    workspace_id?: string | null;
    extension_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.EXTENSION_TOOLS_LIST_V1]: RuntimeExtensionToolsListRequest & {
    workspace_id?: string | null;
    extension_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.EXTENSION_RESOURCE_READ_V1]: RuntimeExtensionResourceReadRequest & {
    workspace_id?: string | null;
    extension_id?: string;
    resource_id?: string;
  };
  [CODE_RUNTIME_RPC_METHODS.EXTENSIONS_CONFIG_V1]: {
    workspaceId?: string | null;
    workspace_id?: string | null;
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

export interface CodeRuntimeRpcResponsePayloadByMethod {
  [CODE_RUNTIME_RPC_METHODS.RPC_CAPABILITIES]: CodeRuntimeRpcCapabilities;
  [CODE_RUNTIME_RPC_METHODS.HEALTH]: HealthResponse;
  [CODE_RUNTIME_RPC_METHODS.SETTINGS_SUMMARY]: SettingsSummary;
  [CODE_RUNTIME_RPC_METHODS.APP_SETTINGS_GET]: RuntimeAppSettingsRecord;
  [CODE_RUNTIME_RPC_METHODS.APP_SETTINGS_UPDATE]: RuntimeAppSettingsRecord;
  [CODE_RUNTIME_RPC_METHODS.REMOTE_STATUS]: RemoteStatus;
  [CODE_RUNTIME_RPC_METHODS.TERMINAL_STATUS]: TerminalStatus;
  [CODE_RUNTIME_RPC_METHODS.MODELS_POOL]: ModelPoolEntry[];
  [CODE_RUNTIME_RPC_METHODS.PROVIDERS_CATALOG]: RuntimeProviderCatalogEntry[];
  [CODE_RUNTIME_RPC_METHODS.WORKSPACES_LIST]: WorkspaceSummary[];
  [CODE_RUNTIME_RPC_METHODS.BOOTSTRAP_SNAPSHOT]: RuntimeBootstrapSnapshot;
  [CODE_RUNTIME_RPC_METHODS.MISSION_CONTROL_SNAPSHOT_V1]: HugeCodeMissionControlSnapshot;
  [CODE_RUNTIME_RPC_METHODS.MISSION_CONTROL_SUMMARY_V1]: HugeCodeMissionControlSummary;
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
  [CODE_RUNTIME_RPC_METHODS.RUN_PREPARE_V2]: RuntimeRunPrepareV2Response;
  [CODE_RUNTIME_RPC_METHODS.RUN_START]: RuntimeRunSummary;
  [CODE_RUNTIME_RPC_METHODS.RUN_START_V2]: RuntimeRunStartV2Response;
  [CODE_RUNTIME_RPC_METHODS.RUN_CANCEL]: RuntimeRunCancelAck;
  [CODE_RUNTIME_RPC_METHODS.RUN_RESUME]: RuntimeRunResumeAck;
  [CODE_RUNTIME_RPC_METHODS.RUN_RESUME_V2]: RuntimeRunResumeV2Response;
  [CODE_RUNTIME_RPC_METHODS.RUN_INTERVENE]: RuntimeRunInterventionAck;
  [CODE_RUNTIME_RPC_METHODS.RUN_INTERVENE_V2]: RuntimeRunInterventionV2Response;
  [CODE_RUNTIME_RPC_METHODS.RUN_SUBSCRIBE]: RuntimeRunSummary | null;
  [CODE_RUNTIME_RPC_METHODS.RUN_GET_V2]: RuntimeRunGetV2Response;
  [CODE_RUNTIME_RPC_METHODS.RUN_SUBSCRIBE_V2]: RuntimeRunSubscribeV2Response;
  [CODE_RUNTIME_RPC_METHODS.REVIEW_GET_V2]: RuntimeReviewGetV2Response;
  [CODE_RUNTIME_RPC_METHODS.RUNS_LIST]: RuntimeRunSummary[];
  [CODE_RUNTIME_RPC_METHODS.KERNEL_JOB_START_V3]: KernelJob;
  [CODE_RUNTIME_RPC_METHODS.KERNEL_JOB_GET_V3]: KernelJob | null;
  [CODE_RUNTIME_RPC_METHODS.KERNEL_JOB_CANCEL_V3]: RuntimeRunCancelAck;
  [CODE_RUNTIME_RPC_METHODS.KERNEL_JOB_RESUME_V3]: RuntimeRunResumeAck;
  [CODE_RUNTIME_RPC_METHODS.KERNEL_JOB_INTERVENE_V3]: RuntimeRunInterventionAck;
  [CODE_RUNTIME_RPC_METHODS.KERNEL_JOB_SUBSCRIBE_V3]: KernelJob | null;
  [CODE_RUNTIME_RPC_METHODS.KERNEL_JOB_CALLBACK_REGISTER_V3]: KernelJobCallbackRegistrationAckV3;
  [CODE_RUNTIME_RPC_METHODS.KERNEL_JOB_CALLBACK_REMOVE_V3]: KernelJobCallbackRemoveAckV3;
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
  [CODE_RUNTIME_RPC_METHODS.APPS_LIST_V1]: RuntimeAppsListResponse;
  [CODE_RUNTIME_RPC_METHODS.MCP_SERVER_STATUS_LIST_V1]: RuntimeMcpServerStatusListResponse;
  [CODE_RUNTIME_RPC_METHODS.BROWSER_DEBUG_STATUS_V1]: RuntimeBrowserDebugStatusResponse;
  [CODE_RUNTIME_RPC_METHODS.BROWSER_DEBUG_RUN_V1]: RuntimeBrowserDebugRunResponse;
  [CODE_RUNTIME_RPC_METHODS.EXTENSIONS_LIST_V1]: RuntimeExtensionSpec[];
  [CODE_RUNTIME_RPC_METHODS.EXTENSION_INSTALL_V1]: RuntimeExtensionSpec;
  [CODE_RUNTIME_RPC_METHODS.EXTENSION_REMOVE_V1]: boolean;
  [CODE_RUNTIME_RPC_METHODS.EXTENSION_TOOLS_LIST_V1]: RuntimeExtensionToolSummary[];
  [CODE_RUNTIME_RPC_METHODS.EXTENSION_RESOURCE_READ_V1]: RuntimeExtensionResourceReadResponse;
  [CODE_RUNTIME_RPC_METHODS.EXTENSIONS_CONFIG_V1]: RuntimeExtensionsConfigResponse;
  [CODE_RUNTIME_RPC_METHODS.SESSION_EXPORT_V1]: RuntimeSessionExportResponse;
  [CODE_RUNTIME_RPC_METHODS.SESSION_IMPORT_V1]: RuntimeSessionImportResponse;
  [CODE_RUNTIME_RPC_METHODS.SESSION_DELETE_V1]: boolean;
  [CODE_RUNTIME_RPC_METHODS.THREAD_SNAPSHOTS_GET_V1]: RuntimeThreadSnapshotsGetResponse;
  [CODE_RUNTIME_RPC_METHODS.THREAD_SNAPSHOTS_SET_V1]: RuntimeThreadSnapshotsSetResponse;
  [CODE_RUNTIME_RPC_METHODS.SECURITY_PREFLIGHT_V1]: RuntimeSecurityPreflightDecision;
  [CODE_RUNTIME_RPC_METHODS.RUNTIME_DIAGNOSTICS_EXPORT_V1]: RuntimeDiagnosticsExportResponse;
}

const CODE_RUNTIME_RPC_METHOD_SET: ReadonlySet<string> = new Set(CODE_RUNTIME_RPC_METHOD_LIST);

export function isCodeRuntimeRpcMethod(value: unknown): value is CodeRuntimeRpcMethod {
  return typeof value === "string" && CODE_RUNTIME_RPC_METHOD_SET.has(value);
}

export function computeCodeRuntimeRpcMethodSetHash(methods: Iterable<string>): string {
  const FNV_OFFSET_BASIS = 0xcbf29ce484222325n;
  const FNV_PRIME = 0x100000001b3n;
  const MASK_64 = 0xffffffffffffffffn;
  const normalized = [...new Set([...methods].map((entry) => entry.trim()).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right)
  );
  let hash = FNV_OFFSET_BASIS;
  for (const method of normalized) {
    for (let index = 0; index < method.length; index += 1) {
      hash ^= BigInt(method.charCodeAt(index) & 0xff);
      hash = (hash * FNV_PRIME) & MASK_64;
    }
    hash ^= 0xffn;
    hash = (hash * FNV_PRIME) & MASK_64;
  }
  return hash.toString(16).padStart(16, "0");
}
export type CodeRuntimeRpcSpec = {
  contractVersion: string;
  freezeEffectiveAt: string;
  methodSetHash: string;
  methods: readonly string[];
  canonicalMethods: readonly CodeRuntimeRpcMethod[];
  features: readonly string[];
  errorCodes: typeof CODE_RUNTIME_RPC_ERROR_CODES;
  transports: CodeRuntimeRpcTransports;
  executionGraphFields: readonly string[];
};

export const CODE_RUNTIME_RPC_EXECUTION_GRAPH_FIELDS = Object.freeze([
  "executionGraph",
  "graphId",
  "nodes",
  "edges",
  "status",
  "executorKind",
  "executorSessionId",
  "preferredBackendIds",
  "resolvedBackendId",
  "placementLifecycleState",
  "placementResolutionSource",
  "checkpoint",
  "reviewActionability",
] as const);

export function buildCodeRuntimeRpcSpec(): CodeRuntimeRpcSpec {
  const methods = [...CODE_RUNTIME_RPC_METHOD_LIST].sort((left, right) =>
    left.localeCompare(right)
  );
  return {
    contractVersion: CODE_RUNTIME_RPC_CONTRACT_VERSION,
    freezeEffectiveAt: CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT,
    methodSetHash: computeCodeRuntimeRpcMethodSetHash(methods),
    methods,
    canonicalMethods: CODE_RUNTIME_RPC_METHOD_LIST,
    features: CODE_RUNTIME_RPC_FEATURES,
    errorCodes: CODE_RUNTIME_RPC_ERROR_CODES,
    transports: CODE_RUNTIME_RPC_TRANSPORTS,
    executionGraphFields: CODE_RUNTIME_RPC_EXECUTION_GRAPH_FIELDS,
  };
}
