import type {
  AccessMode,
  ModelPool,
  ModelProvider,
  ModelSource,
  ReasonEffort,
  TurnExecutionMode,
  TurnSendAttachment,
} from "../codeRuntimeRpc.js";
import type {
  HugeCodeContinuationSummary,
  HugeCodeNextOperatorAction,
  HugeCodePlacementLifecycleState,
  HugeCodePlacementResolutionSource,
  HugeCodeReviewPackSummary,
  HugeCodeRunSummary,
  HugeCodeRuntimeSessionBoundary,
  HugeCodeTaskMode,
} from "../hugeCodeMissionControl.js";
import type {
  RuntimeGitHubSourceLaunchHandshakeState,
  RuntimeTaskSourceCommandKind,
  RuntimeTaskSourceEventSummary,
  RuntimeTaskSourceLaunchDisposition,
  RuntimeTaskSourceRequester,
  RuntimeTaskSourceTriggerMode,
} from "../runtimeTaskSourceShared.js";
import type {
  RuntimeAutonomyRequestV2,
  RuntimeBackendOperabilitySummary,
  RuntimeCheckpointState,
  RuntimeMissionLinkageSummary,
  RuntimeReviewActionabilitySummary,
  RuntimeTakeoverBundle,
} from "./backendsAndRuns.js";
import type { LiveSkillSource } from "./runtimeFeatures.js";
import type { WorkspaceDiagnosticSeverity } from "./workspaceAndGit.js";

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
  autoDrive?: AgentTaskAutoDriveState | null;
  autonomyRequest?: RuntimeAutonomyRequestV2 | null;
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
  | "github_discussion"
  | "note"
  | "customer_feedback"
  | "doc"
  | "call_summary"
  | "external_ref"
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
  githubSource?: RuntimeGitHubSourceProvenance | null;
};

export type RuntimeTaskSourceProvider = "github" | (string & {});

export type RuntimeTaskSourceState =
  | "received"
  | "deduped"
  | "queued"
  | "launched"
  | "intervened"
  | "waiting_review"
  | "completed"
  | "failed"
  | "ignored";

export type RuntimeTaskSourceWriteBackState =
  | "not_requested"
  | "pending"
  | "mirrored"
  | "failed"
  | (string & {});

export type RuntimeTaskSourcePayload = {
  kind: Extract<AgentTaskSourceKind, "github_issue" | "github_pr_followup"> | (string & {});
  title?: string | null;
  body?: string | null;
  url?: string | null;
  canonicalUrl?: string | null;
  repo: AgentTaskSourceRepoContext;
  issueNumber?: number | null;
  pullRequestNumber?: number | null;
  commentId?: number | null;
  commentUrl?: string | null;
  commentBody?: string | null;
  commentAuthor?: RuntimeTaskSourceRequester | null;
  commandKind?: RuntimeTaskSourceCommandKind | null;
  triggerMode: RuntimeTaskSourceTriggerMode;
  headSha?: string | null;
  externalId?: string | null;
  requestedBy?: RuntimeTaskSourceRequester | null;
};

export type RuntimeTaskSourceLaunchRequest = {
  enabled?: boolean | null;
  threadId?: string | null;
  requestId?: string | null;
  title?: string | null;
  missionBrief?: AgentTaskMissionBrief | null;
  executionProfileId?: string | null;
  reviewProfileId?: string | null;
  validationPresetId?: string | null;
  accessMode?: AccessMode | null;
  preferredBackendIds?: string[] | null;
};

export type RuntimeGitHubSourceRef = {
  label: string;
  issueNumber?: number | null;
  pullRequestNumber?: number | null;
  headSha?: string | null;
  triggerMode?: RuntimeTaskSourceTriggerMode | null;
  commandKind?: RuntimeTaskSourceCommandKind | null;
};

export type RuntimeGitHubSourceComment = {
  commentId?: number | null;
  url?: string | null;
  author?: RuntimeTaskSourceRequester | null;
};

export type RuntimeGitHubSourceLaunchHandshake = {
  state: RuntimeGitHubSourceLaunchHandshakeState;
  summary: string;
  disposition?: RuntimeTaskSourceLaunchDisposition | null;
  preparedPlanVersion?: string | null;
  approvedPlanVersion?: string | null;
};

export type RuntimeGitHubSourceProvenance = {
  sourceRecordId: string;
  repo: AgentTaskSourceRepoContext;
  event: RuntimeTaskSourceEventSummary;
  ref: RuntimeGitHubSourceRef;
  comment?: RuntimeGitHubSourceComment | null;
  launchHandshake: RuntimeGitHubSourceLaunchHandshake;
};

export type RuntimeTaskSourceRecord = {
  sourceRecordId: string;
  provider: RuntimeTaskSourceProvider;
  sourceKind: AgentTaskSourceKind;
  dedupeKey: string;
  state: RuntimeTaskSourceState;
  writeBackState: RuntimeTaskSourceWriteBackState;
  workspaceId?: string | null;
  workspacePath?: string | null;
  deliveryId?: string | null;
  eventName?: string | null;
  action?: string | null;
  commandKind?: RuntimeTaskSourceCommandKind | null;
  repo?: AgentTaskSourceRepoContext | null;
  issueNumber?: number | null;
  pullRequestNumber?: number | null;
  headSha?: string | null;
  url?: string | null;
  commentId?: number | null;
  linkedTaskId?: string | null;
  linkedRunId?: string | null;
  linkedReviewPackId?: string | null;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
  githubSource?: RuntimeGitHubSourceProvenance | null;
  createdAt: number;
  updatedAt: number;
  payload: RuntimeTaskSourcePayload;
};

export type RuntimeTaskSourceLaunchResult = {
  disposition: RuntimeTaskSourceLaunchDisposition;
  message: string;
  runId?: string | null;
  taskId?: string | null;
  reviewPackId?: string | null;
};

export type RuntimeTaskSourceIngestRequest = {
  provider: RuntimeTaskSourceProvider;
  event: RuntimeTaskSourceEventSummary;
  payload: RuntimeTaskSourcePayload;
  launch?: RuntimeTaskSourceLaunchRequest | null;
};

export type RuntimeTaskSourceIngestResponse = {
  record: RuntimeTaskSourceRecord;
  launch: RuntimeTaskSourceLaunchResult;
  deduped: boolean;
};

export type RuntimeTaskSourceGetRequest = {
  sourceRecordId: string;
};

export type RuntimeTaskSourceListRequest = {
  workspaceId?: string | null;
  provider?: RuntimeTaskSourceProvider | null;
  sourceKind?: AgentTaskSourceKind | null;
  state?: RuntimeTaskSourceState | null;
  limit?: number | null;
};

export type RuntimeTaskSourceReconcileRequest = {
  sourceRecordId: string;
};

export type RuntimeTaskSourceReconcileResponse = {
  reconciled: boolean;
  record: RuntimeTaskSourceRecord | null;
  message?: string | null;
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
  | "replan_scope"
  | "drop_feature"
  | "insert_feature"
  | "change_validation_lane"
  | "change_backend_preference"
  | "mark_blocked_with_reason"
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
  allowChatgptDecisionLab?: boolean | null;
  autoRunChatgptDecisionLab?: boolean | null;
  allowValidationCommands?: boolean | null;
  minimumConfidence?: AgentTaskAutoDriveConfidence | null;
  chatgptDecisionLabMinConfidence?: AgentTaskAutoDriveConfidence | null;
  chatgptDecisionLabMaxScoreGap?: number | null;
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

export type AgentTaskAutoDriveContinuationPolicy = {
  enabled?: boolean | null;
  maxAutomaticFollowUps?: number | null;
  requireValidationSuccessToStop?: boolean | null;
  minimumConfidenceToStop?: AgentTaskAutoDriveConfidence | null;
};

export type AgentTaskAutoDriveContinuationState = {
  automaticFollowUpCount?: number | null;
  status?: "idle" | "continuing" | "stopped" | null;
  lastContinuationAt?: number | null;
  lastContinuationReason?: string | null;
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
  continuationPolicy?: AgentTaskAutoDriveContinuationPolicy | null;
  continuationState?: AgentTaskAutoDriveContinuationState | null;
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

export type AgentTaskMissionPlanMilestoneStatus = "planned" | "active" | "completed" | "blocked";

export type AgentTaskMissionValidationTrigger = "per_feature" | "per_milestone" | "pre_review";

export type AgentTaskMissionPlanMilestone = {
  id: string;
  label: string;
  summary: string;
  status?: AgentTaskMissionPlanMilestoneStatus | null;
  nodeIds?: string[] | null;
  validationLaneIds?: string[] | null;
  acceptanceCriteria?: string[] | null;
};

export type AgentTaskMissionValidationLane = {
  id: string;
  label: string;
  summary: string;
  trigger: AgentTaskMissionValidationTrigger;
  commands?: string[] | null;
};

export type AgentTaskMissionSkillPlanItemState = "available" | "missing" | "recommended";

export type AgentTaskMissionSkillPlanItem = {
  skillId: string;
  label: string;
  state: AgentTaskMissionSkillPlanItemState;
  summary?: string | null;
};

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
  planVersion?: string | null;
  planSummary?: string | null;
  currentMilestoneId?: string | null;
  estimatedDurationMinutes?: number | null;
  estimatedWorkerRuns?: number | null;
  parallelismHint?: string | null;
  clarificationQuestions?: string[] | null;
  milestones?: AgentTaskMissionPlanMilestone[] | null;
  validationLanes?: AgentTaskMissionValidationLane[] | null;
  skillPlan?: AgentTaskMissionSkillPlanItem[] | null;
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
  sourcePlanVersion?: string | null;
  summary?: string | null;
  failureClass?: AgentTaskFailureClass | null;
  recommendedActions?: AgentTaskInterventionAction[] | null;
  planChangeSummary?: string | null;
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
  sessionBoundary?: HugeCodeRuntimeSessionBoundary | null;
  continuation?: HugeCodeContinuationSummary | null;
  nextOperatorAction?: HugeCodeNextOperatorAction | null;
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
  approvedPlanVersion?: string | null;
  autoDrive?: AgentTaskAutoDriveState | null;
  autonomyRequest?: RuntimeAutonomyRequestV2 | null;
  steps: AgentTaskStepInput[];
};
