export const HYPECODE_RUN_STATES = [
  "draft",
  "queued",
  "preparing",
  "running",
  "paused",
  "needs_input",
  "validating",
  "review_ready",
  "failed",
  "cancelled",
] as const;

export type HypeCodeRunState = (typeof HYPECODE_RUN_STATES)[number];

export const HYPECODE_INTERVENTION_ACTIONS = [
  "pause",
  "resume",
  "cancel",
  "retry",
  "continue_with_clarification",
  "narrow_scope",
  "relax_validation",
  "switch_profile_and_retry",
  "escalate_to_pair_mode",
] as const;

export type HypeCodeInterventionAction = (typeof HYPECODE_INTERVENTION_ACTIONS)[number];

export type HypeCodeValidationOutcome = "passed" | "failed" | "warning" | "skipped" | "unknown";

export type HypeCodeMissionControlSource = "runtime_snapshot_v1";

export type HypeCodeEvidenceState = "confirmed" | "incomplete";

export type HypeCodeTaskMode = "ask" | "pair" | "delegate";

export type HypeCodeTaskModeSource =
  | "execution_profile"
  | "execution_mode"
  | "access_mode"
  | "legacy_thread_projection"
  | "missing";

export type HypeCodeTaskStatus =
  | "draft"
  | "ready"
  | "queued"
  | "running"
  | "paused"
  | "needs_input"
  | "review_ready"
  | "failed"
  | "cancelled"
  | "archived";

export type HypeCodeReviewStatus = "ready" | "action_required" | "incomplete_evidence";

export type HypeCodeReviewDecisionState = "pending" | "accepted" | "rejected";

export type HypeCodeTaskAccountabilityLifecycle = "claimed" | "executing" | "in_review" | "done";

export type HypeCodeGovernanceStateKind =
  | "in_progress"
  | "awaiting_approval"
  | "awaiting_review"
  | "action_required"
  | "completed";

export type HypeCodeGovernanceAction =
  | HypeCodeInterventionAction
  | "review_result"
  | "accept_result"
  | "reject_result";

export type HypeCodeTaskOrigin =
  | {
      kind: "thread";
      threadId: string;
      runId: string | null;
      requestId: string | null;
    }
  | {
      kind: "run";
      threadId: string | null;
      runId: string;
      requestId: string | null;
    };

export type HypeCodeTaskSourceKind =
  | "autodrive"
  | "manual"
  | "manual_thread"
  | "github_issue"
  | "github_pr_followup"
  | "schedule"
  | "external_runtime"
  | (string & {});

export type HypeCodeTaskSourceRepoContext = {
  owner?: string | null;
  name?: string | null;
  fullName?: string | null;
  remoteUrl?: string | null;
};

export type HypeCodeTaskSourceSummary = {
  kind: HypeCodeTaskSourceKind;
  label?: string | null;
  shortLabel?: string | null;
  title?: string | null;
  reference?: string | null;
  url?: string | null;
  issueNumber?: number | null;
  pullRequestNumber?: number | null;
  repo?: HypeCodeTaskSourceRepoContext | null;
  workspaceId?: string | null;
  workspaceRoot?: string | null;
  externalId?: string | null;
  canonicalUrl?: string | null;
  threadId?: string | null;
  requestId?: string | null;
  sourceTaskId?: string | null;
  sourceRunId?: string | null;
};

export type HypeCodeTaskSourceLinkage = HypeCodeTaskSourceSummary & {
  label: string;
  shortLabel: string;
};

export type HypeCodeExecutionAutonomy =
  | "operator_review"
  | "bounded_delegate"
  | "autonomous_delegate";

export type HypeCodeExecutionToolPosture = "read_only" | "workspace_safe" | "workspace_extended";

export type HypeCodeExecutionRoutingStrategy =
  | "workspace_default"
  | "provider_route"
  | "direct_model";

export type HypeCodeApprovalSensitivity = "heightened" | "standard" | "low_friction";

export type HypeCodeRoutingHealth = "ready" | "attention" | "blocked";

export type HypeCodeApprovalStateKind =
  | "not_required"
  | "pending_decision"
  | "approved"
  | "rejected"
  | "unavailable";

export type HypeCodeAutoDriveRoutePreference = "stability_first" | "balanced" | "speed_first";

export type HypeCodeAutoDriveConfidence = "low" | "medium" | "high";

export type HypeCodeAutoDriveContextScope = "active_workspace" | "workspace_graph";

export type HypeCodeAutoDriveAutonomyPriority = "operator" | "balanced";

export type HypeCodeAutoDrivePromptStrategy = "repo_truth_first" | "workspace_graph_first";

export type HypeCodeAutoDriveResearchMode = "repository_only" | "live_when_allowed";

export type HypeCodeAutoDriveStopReason =
  | "completed"
  | "paused"
  | "budget_exhausted"
  | "validation_failed"
  | "rerouted"
  | "operator_intervened"
  | "cancelled"
  | "failed";

export type HypeCodeAutoDriveDoneDefinition = {
  arrivalCriteria?: string[];
  requiredValidation?: string[];
  waypointIndicators?: string[];
};

export type HypeCodeAutoDriveDestination = {
  title: string;
  desiredEndState: string[];
  doneDefinition?: HypeCodeAutoDriveDoneDefinition | null;
  hardBoundaries?: string[];
  routePreference?: HypeCodeAutoDriveRoutePreference | null;
};

export type HypeCodeAutoDriveBudget = {
  maxTokens?: number | null;
  maxIterations?: number | null;
  maxDurationMs?: number | null;
  maxFilesPerIteration?: number | null;
  maxNoProgressIterations?: number | null;
  maxValidationFailures?: number | null;
  maxReroutes?: number | null;
};

export type HypeCodeAutoDriveRiskPolicy = {
  pauseOnDestructiveChange?: boolean | null;
  pauseOnDependencyChange?: boolean | null;
  pauseOnLowConfidence?: boolean | null;
  pauseOnHumanCheckpoint?: boolean | null;
  allowNetworkAnalysis?: boolean | null;
  allowValidationCommands?: boolean | null;
  minimumConfidence?: HypeCodeAutoDriveConfidence | null;
};

export type HypeCodeAutoDriveContextPolicy = {
  scope?: HypeCodeAutoDriveContextScope | null;
  workspaceReadPaths?: string[] | null;
  workspaceContextPaths?: string[] | null;
  authoritySources?: string[] | null;
};

export type HypeCodeAutoDriveDecisionPolicy = {
  independentThread?: boolean | null;
  autonomyPriority?: HypeCodeAutoDriveAutonomyPriority | null;
  promptStrategy?: HypeCodeAutoDrivePromptStrategy | null;
  researchMode?: HypeCodeAutoDriveResearchMode | null;
};

export type HypeCodeAutoDriveDecisionScore = {
  reasonCode: string;
  label: string;
  delta: number;
};

export type HypeCodeAutoDriveScenarioProfile = {
  authorityScope?: HypeCodeAutoDriveContextScope | null;
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

export type HypeCodeAutoDriveDecisionTrace = {
  phase?: "launch" | "progress" | "failure" | "completed" | "recovered" | null;
  summary?: string | null;
  selectedCandidateId?: string | null;
  selectedCandidateSummary?: string | null;
  selectionTags?: string[] | null;
  scoreBreakdown?: HypeCodeAutoDriveDecisionScore[] | null;
  authoritySources?: string[] | null;
  representativeCommand?: string | null;
  heldOutGuidance?: string[] | null;
};

export type HypeCodeAutoDriveOutcomeFeedback = {
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

export type HypeCodeAutoDriveAutonomyState = {
  independentThread?: boolean | null;
  autonomyPriority?: HypeCodeAutoDriveAutonomyPriority | null;
  highPriority?: boolean | null;
  escalationPressure?: "low" | "medium" | "high" | null;
  unattendedContinuationAllowed?: boolean | null;
  backgroundSafe?: boolean | null;
  humanInterventionHotspots?: string[] | null;
};

export type HypeCodeAutoDriveNavigation = {
  activeWaypoint?: string | null;
  completedWaypoints?: string[];
  pendingWaypoints?: string[];
  lastProgressAt?: number | null;
  rerouteCount?: number | null;
  validationFailureCount?: number | null;
  noProgressIterations?: number | null;
};

export type HypeCodeAutoDriveRecoveryMarker = {
  recovered?: boolean | null;
  resumeReady?: boolean | null;
  checkpointId?: string | null;
  traceId?: string | null;
  recoveredAt?: number | null;
  summary?: string | null;
};

export type HypeCodeAutoDriveStopState = {
  reason: HypeCodeAutoDriveStopReason;
  summary?: string | null;
  at?: number | null;
};

export type HypeCodeAutoDriveState = {
  enabled?: boolean | null;
  destination: HypeCodeAutoDriveDestination;
  budget?: HypeCodeAutoDriveBudget | null;
  riskPolicy?: HypeCodeAutoDriveRiskPolicy | null;
  contextPolicy?: HypeCodeAutoDriveContextPolicy | null;
  decisionPolicy?: HypeCodeAutoDriveDecisionPolicy | null;
  scenarioProfile?: HypeCodeAutoDriveScenarioProfile | null;
  decisionTrace?: HypeCodeAutoDriveDecisionTrace | null;
  outcomeFeedback?: HypeCodeAutoDriveOutcomeFeedback | null;
  autonomyState?: HypeCodeAutoDriveAutonomyState | null;
  navigation?: HypeCodeAutoDriveNavigation | null;
  recovery?: HypeCodeAutoDriveRecoveryMarker | null;
  stop?: HypeCodeAutoDriveStopState | null;
};

export type HypeCodeInterventionAvailability = {
  action: HypeCodeInterventionAction;
  label: string;
  enabled: boolean;
  supported: boolean;
  reason: string | null;
};

export type HypeCodeMissionBriefPermissionSummary = {
  accessMode?: "read-only" | "on-request" | "full-access" | null;
  allowNetwork?: boolean | null;
  writableRoots?: string[] | null;
  toolNames?: string[] | null;
};

export type HypeCodeMissionBriefEvaluationPlan = {
  representativeCommands?: string[] | null;
  componentCommands?: string[] | null;
  endToEndCommands?: string[] | null;
  samplePaths?: string[] | null;
  heldOutGuidance?: string[] | null;
  sourceSignals?: string[] | null;
};

export type HypeCodeMissionBriefScenarioProfile = HypeCodeAutoDriveScenarioProfile;

export type HypeCodeMissionBrief = {
  objective: string;
  doneDefinition?: string[] | null;
  constraints?: string[] | null;
  riskLevel?: "low" | "medium" | "high" | null;
  requiredCapabilities?: string[] | null;
  maxSubtasks?: number | null;
  preferredBackendIds?: string[] | null;
  permissionSummary?: HypeCodeMissionBriefPermissionSummary | null;
  evaluationPlan?: HypeCodeMissionBriefEvaluationPlan | null;
  scenarioProfile?: HypeCodeMissionBriefScenarioProfile | null;
};

export type HypeCodeFailureClass =
  | "validation_failed"
  | "approval_required"
  | "runtime_failed"
  | "timed_out"
  | "interrupted"
  | "cancelled"
  | "unknown";

export type HypeCodeRelaunchContext = {
  sourceTaskId?: string | null;
  sourceRunId?: string | null;
  sourceReviewPackId?: string | null;
  summary?: string | null;
  failureClass?: HypeCodeFailureClass | null;
  recommendedActions?: HypeCodeInterventionAction[] | null;
};

export type HypeCodeReviewPackRelaunchOptions = HypeCodeRelaunchContext & {
  primaryAction?: HypeCodeInterventionAction | null;
  availableActions?: HypeCodeInterventionAvailability[] | null;
};

export type HypeCodePublishHandoffReference = {
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

export type HypeCodeTakeoverState = "ready" | "attention" | "blocked";

export type HypeCodeTakeoverPathKind = "approval" | "resume" | "review" | "handoff" | "missing";

export type HypeCodeTakeoverPrimaryAction =
  | "approve"
  | "resume"
  | "open_review_pack"
  | "open_handoff"
  | "open_sub_agent_session"
  | "inspect_runtime";

export type HypeCodeSubAgentCheckpointState = {
  state: string;
  lifecycleState: string;
  checkpointId?: string | null;
  traceId: string;
  recovered: boolean;
  updatedAt: number;
  resumeReady?: boolean | null;
  recoveredAt?: number | null;
  summary?: string | null;
};

export type HypeCodeSubAgentApprovalState = {
  status: string;
  approvalId?: string | null;
  action?: string | null;
  reason?: string | null;
  at?: number | null;
};

export type HypeCodeSubAgentSummary = {
  sessionId: string;
  parentRunId?: string | null;
  scopeProfile?: string | null;
  status: string;
  approvalState?: HypeCodeSubAgentApprovalState | null;
  checkpointState?: HypeCodeSubAgentCheckpointState | null;
  takeoverBundle?: HypeCodeTakeoverBundle | null;
  summary?: string | null;
  timedOutReason?: string | null;
  interruptedReason?: string | null;
};

export type HypeCodeReviewArtifactRef = {
  id: string;
  label: string;
  kind: "diff" | "validation" | "log" | "evidence" | "command";
  uri?: string | null;
};

export type HypeCodeReviewDecisionSummary = {
  status: HypeCodeReviewDecisionState;
  reviewPackId: string;
  label: string;
  summary: string;
  decidedAt: number | null;
};

export type HypeCodeReviewPackFileChangeSummary = {
  paths: string[];
  totalCount: number;
  summary: string;
  missingReason: string | null;
};

export type HypeCodeReviewPackEvidenceRefs = {
  traceId: string | null;
  checkpointId: string | null;
  diffArtifactIds: string[];
  validationArtifactIds: string[];
  logArtifactIds: string[];
  commandArtifactIds: string[];
};

export type HypeCodeValidationSummary = {
  id: string;
  label: string;
  outcome: HypeCodeValidationOutcome;
  summary: string;
  startedAt?: number | null;
  finishedAt?: number | null;
};

export type HypeCodeMissionLineage = {
  objective: string | null;
  desiredEndState?: string[];
  hardBoundaries?: string[];
  doneDefinition?: HypeCodeAutoDriveDoneDefinition | null;
  riskPolicy?: HypeCodeAutoDriveRiskPolicy | null;
  taskMode?: HypeCodeTaskMode | null;
  executionProfileId?: string | null;
  taskSource?: HypeCodeTaskSourceSummary | null;
  threadId?: string | null;
  requestId?: string | null;
  rootTaskId?: string | null;
  parentTaskId?: string | null;
  childTaskIds?: string[];
  reviewDecisionState?: HypeCodeReviewDecisionState | null;
  reviewDecisionSummary?: string | null;
};

export type HypeCodeTaskAccountability = {
  lifecycle: HypeCodeTaskAccountabilityLifecycle;
  claimedBy: string | null;
  claimedAt: number | null;
  lifecycleUpdatedAt: number | null;
};

export type HypeCodeRunLedger = {
  traceId: string | null;
  checkpointId: string | null;
  recovered: boolean;
  stepCount: number;
  completedStepCount: number;
  warningCount: number;
  validationCount: number;
  artifactCount: number;
  evidenceState: HypeCodeEvidenceState;
  backendId: string | null;
  routeLabel: string | null;
  completionReason: string | null;
  lastProgressAt: number | null;
};

export type HypeCodeCheckpointSummary = {
  state: string;
  lifecycleState: string | null;
  checkpointId: string | null;
  traceId: string | null;
  recovered: boolean;
  updatedAt: number | null;
  resumeReady?: boolean | null;
  recoveredAt?: number | null;
  summary?: string | null;
};

export type HypeCodeMissionNavigationTarget =
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

export type HypeCodeTakeoverTarget =
  | HypeCodeMissionNavigationTarget
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

export type HypeCodeMissionLinkageSummary = {
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
  navigationTarget: HypeCodeMissionNavigationTarget;
  summary: string;
};

export type HypeCodeExecutionNodeSummary = {
  id: string;
  kind: "plan" | (string & {});
  status?: string;
  executorKind?: "sub_agent" | (string & {}) | null;
  executorSessionId?: string | null;
  preferredBackendIds?: string[];
  resolvedBackendId: string | null;
  placementLifecycleState?: string | null;
  placementResolutionSource?: string | null;
  checkpoint?: HypeCodeCheckpointSummary | null;
  reviewActionability?: HypeCodeReviewActionabilitySummary | null;
};

export type HypeCodeExecutionEdgeSummary = {
  fromNodeId: string;
  toNodeId: string;
  kind: "depends_on" | (string & {});
};

export type HypeCodeExecutionGraphSummary = {
  graphId: string;
  nodes: HypeCodeExecutionNodeSummary[];
  edges: HypeCodeExecutionEdgeSummary[];
};

export type HypeCodeReviewActionabilityAction =
  | "accept_result"
  | "reject_result"
  | "retry"
  | "continue_with_clarification"
  | "narrow_scope"
  | "relax_validation"
  | "switch_profile_and_retry"
  | "escalate_to_pair_mode";

export type HypeCodeReviewActionAvailability = {
  action: HypeCodeReviewActionabilityAction;
  enabled: boolean;
  supported: boolean;
  reason: string | null;
};

export type HypeCodeReviewActionabilitySummary = {
  state: "ready" | "degraded" | "blocked";
  summary: string;
  degradedReasons: string[];
  actions: HypeCodeReviewActionAvailability[];
};

export type HypeCodeReviewGateState = "pass" | "warn" | "fail" | "blocked";

export type HypeCodeReviewFindingSeverity = "info" | "warning" | "error" | "critical";

export type HypeCodeReviewFindingCategory =
  | "correctness_risk"
  | "validation_gap"
  | "security_risk"
  | "repo_policy_mismatch"
  | "followup_clarification"
  | (string & {});

export type HypeCodeReviewFindingConfidence = "low" | "medium" | "high";

export type HypeCodeReviewFindingAnchor = {
  path?: string | null;
  startLine?: number | null;
  endLine?: number | null;
  diffSide?: "base" | "head" | null;
  label?: string | null;
};

export type HypeCodeReviewFinding = {
  id: string;
  title: string;
  severity: HypeCodeReviewFindingSeverity;
  category: HypeCodeReviewFindingCategory;
  summary: string;
  confidence: HypeCodeReviewFindingConfidence;
  suggestedNextAction?: string | null;
  anchors?: HypeCodeReviewFindingAnchor[] | null;
};

export type HypeCodeReviewGateSummary = {
  state: HypeCodeReviewGateState;
  summary: string;
  blockingReason?: string | null;
  highestSeverity?: HypeCodeReviewFindingSeverity | null;
  findingCount?: number | null;
};

export type HypeCodeRuntimeSkillUsageRecommendedFor = "delegate" | "review" | "repair";

export type HypeCodeRuntimeSkillUsageSummary = {
  skillId: string;
  name: string;
  source?: "builtin" | "managed" | "workspace" | (string & {}) | null;
  status?: "used" | "available" | "suggested" | "unavailable" | null;
  recommendedFor?: HypeCodeRuntimeSkillUsageRecommendedFor[] | null;
  summary?: string | null;
};

export type HypeCodeRuntimeAutofixCandidate = {
  id: string;
  summary: string;
  status: "available" | "applied" | "blocked";
  patchRef?: string | null;
  approvalRequired?: boolean | null;
  blockingReason?: string | null;
};

export type HypeCodeTakeoverBundle = {
  state: HypeCodeTakeoverState;
  pathKind: HypeCodeTakeoverPathKind;
  primaryAction: HypeCodeTakeoverPrimaryAction;
  summary: string;
  blockingReason?: string | null;
  recommendedAction: string;
  target?: HypeCodeTakeoverTarget | null;
  checkpointId?: string | null;
  traceId?: string | null;
  reviewPackId?: string | null;
  publishHandoff?: HypeCodePublishHandoffReference | null;
  reviewActionability?: HypeCodeReviewActionabilitySummary | null;
};

export type HypeCodeRunGovernanceSummary = {
  state: HypeCodeGovernanceStateKind;
  label: string;
  summary: string;
  blocking: boolean;
  suggestedAction: HypeCodeGovernanceAction | null;
  availableActions: HypeCodeGovernanceAction[];
};

export type HypeCodeBackendContractSummary = {
  kind: "native" | "acp";
  origin: "runtime-native" | "acp-projection";
  transport: "stdio" | "http" | null;
  capabilityCount: number;
  health: "active" | "draining" | "disabled";
  rolloutState: "current" | "ramping" | "draining" | "drained";
};

export type HypeCodePlacementResolutionSource =
  | "explicit_preference"
  | "workspace_default"
  | "provider_route"
  | "runtime_fallback"
  | "unresolved";

export type HypeCodePlacementLifecycleState =
  | "requested"
  | "resolved"
  | "confirmed"
  | "fallback"
  | "unresolved";

export type HypeCodePlacementHealthSummary =
  | "placement_ready"
  | "placement_attention"
  | "placement_blocked";

export type HypeCodePlacementAttentionReason =
  | "awaiting_backend_confirmation"
  | "placement_unresolved"
  | "placement_metadata_incomplete"
  | "fallback_backend_selected"
  | "backend_metadata_missing"
  | "routing_metadata_missing"
  | "routing_unavailable"
  | "backend_unhealthy"
  | "backend_disabled"
  | "backend_draining"
  | "backend_queue_depth"
  | "backend_at_capacity"
  | "backend_failures_detected"
  | "backend_connectivity_degraded"
  | "backend_connectivity_unreachable"
  | "backend_lease_expiring"
  | "backend_lease_expired"
  | "backend_lease_released"
  | "backend_heartbeat_stale"
  | "backend_readiness_attention"
  | "backend_readiness_blocked"
  | "backend_rollout_inactive";

export type HypeCodePlacementScoreBreakdown = {
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

export type HypeCodeRunPlacementEvidence = {
  resolvedBackendId: string | null;
  requestedBackendIds: string[];
  resolutionSource: HypeCodePlacementResolutionSource;
  lifecycleState: HypeCodePlacementLifecycleState;
  readiness: HypeCodeRoutingHealth | null;
  healthSummary: HypeCodePlacementHealthSummary;
  attentionReasons: HypeCodePlacementAttentionReason[];
  summary: string;
  rationale: string;
  fallbackReasonCode?: string | null;
  resumeBackendId?: string | null;
  scoreBreakdown?: HypeCodePlacementScoreBreakdown[] | null;
  tcpOverlay?: "tailscale" | "netbird" | null;
  backendContract?: HypeCodeBackendContractSummary | null;
};

export type HypeCodeRunOperatorEventKind =
  | "status_transition"
  | "tool_start"
  | "tool_finish"
  | "approval_wait"
  | "blocked"
  | "recovered";

export type HypeCodeRunOperatorEvent = {
  kind: HypeCodeRunOperatorEventKind;
  label: string;
  detail: string | null;
  at: number | null;
};

export type HypeCodeRunOperatorSnapshot = {
  summary: string;
  runtimeLabel: string | null;
  provider: string | null;
  modelId: string | null;
  reasoningEffort: string | null;
  backendId: string | null;
  machineId: string | null;
  machineSummary: string | null;
  workspaceRoot: string | null;
  currentActivity: string | null;
  blocker: string | null;
  recentEvents: HypeCodeRunOperatorEvent[];
};

export type HypeCodeWorkspaceEvidenceBucketKind =
  | "changedFiles"
  | "diffs"
  | "validations"
  | "commands"
  | "logs"
  | "memoryOrNotes";

export type HypeCodeWorkspaceEvidenceItem = {
  id: string;
  label: string;
  detail: string | null;
  uri: string | null;
};

export type HypeCodeWorkspaceEvidenceBucket = {
  kind: HypeCodeWorkspaceEvidenceBucketKind;
  label: string;
  summary: string;
  items: HypeCodeWorkspaceEvidenceItem[];
  missingReason: string | null;
};

export type HypeCodeWorkspaceEvidence = {
  summary: string;
  buckets: HypeCodeWorkspaceEvidenceBucket[];
};

export type HypeCodeWorkspace = {
  id: string;
  name: string;
  rootPath: string;
  connected: boolean;
  defaultProfileId: string | null;
};

export type HypeCodeTask = {
  id: string;
  workspaceId: string;
  title: string;
  objective: string | null;
  origin: HypeCodeTaskOrigin;
  taskSource?: HypeCodeTaskSourceSummary | null;
  mode: HypeCodeTaskMode | null;
  modeSource: HypeCodeTaskModeSource;
  status: HypeCodeTaskStatus;
  createdAt: number | null;
  updatedAt: number;
  currentRunId: string | null;
  latestRunId: string | null;
  latestRunState: HypeCodeRunState | null;
  nextAction?: HypeCodeRunNextAction | null;
  lineage?: HypeCodeMissionLineage | null;
  accountability?: HypeCodeTaskAccountability | null;
  executionGraph?: HypeCodeExecutionGraphSummary | null;
};

export type HypeCodeRun = {
  id: string;
  taskId: string;
  workspaceId: string;
  state: HypeCodeRunState;
  title: string | null;
  summary: string | null;
  taskSource?: HypeCodeTaskSourceSummary | null;
  startedAt: number | null;
  finishedAt: number | null;
  updatedAt: number;
  currentStepIndex: number | null;
  pendingIntervention?: HypeCodeInterventionAction | null;
  autoDrive?: HypeCodeAutoDriveState | null;
  executionProfile?: HypeCodeExecutionProfile | null;
  reviewProfileId?: string | null;
  profileReadiness?: HypeCodeExecutionProfileReadiness | null;
  routing?: HypeCodeRunRoutingSummary | null;
  approval?: HypeCodeRunApprovalSummary | null;
  reviewDecision?: HypeCodeReviewDecisionSummary | null;
  intervention?: HypeCodeRunInterventionSummary | null;
  operatorState?: HypeCodeRunOperatorState | null;
  nextAction?: HypeCodeRunNextAction | null;
  warnings?: string[];
  validations?: HypeCodeValidationSummary[];
  artifacts?: HypeCodeReviewArtifactRef[];
  changedPaths?: string[];
  completionReason?: string | null;
  reviewPackId?: string | null;
  lineage?: HypeCodeMissionLineage | null;
  ledger?: HypeCodeRunLedger | null;
  checkpoint?: HypeCodeCheckpointSummary | null;
  missionLinkage?: HypeCodeMissionLinkageSummary | null;
  actionability?: HypeCodeReviewActionabilitySummary | null;
  reviewGate?: HypeCodeReviewGateSummary | null;
  reviewFindings?: HypeCodeReviewFinding[] | null;
  reviewRunId?: string | null;
  skillUsage?: HypeCodeRuntimeSkillUsageSummary[] | null;
  autofixCandidate?: HypeCodeRuntimeAutofixCandidate | null;
  governance?: HypeCodeRunGovernanceSummary | null;
  placement?: HypeCodeRunPlacementEvidence | null;
  operatorSnapshot?: HypeCodeRunOperatorSnapshot | null;
  workspaceEvidence?: HypeCodeWorkspaceEvidence | null;
  missionBrief?: HypeCodeMissionBrief | null;
  relaunchContext?: HypeCodeRelaunchContext | null;
  subAgents?: HypeCodeSubAgentSummary[];
  publishHandoff?: HypeCodePublishHandoffReference | null;
  takeoverBundle?: HypeCodeTakeoverBundle | null;
  executionGraph?: HypeCodeExecutionGraphSummary | null;
};

export type HypeCodeExecutionProfile = {
  id: string;
  name: string;
  description: string;
  executionMode: "local_interactive" | "local_background" | "desktop_sandbox" | "remote_sandbox";
  autonomy: HypeCodeExecutionAutonomy;
  supervisionLabel: string;
  accessMode: "read-only" | "on-request" | "full-access";
  networkPolicy: "default" | "restricted" | "offline";
  routingStrategy: HypeCodeExecutionRoutingStrategy;
  toolPosture: HypeCodeExecutionToolPosture;
  approvalSensitivity: HypeCodeApprovalSensitivity;
  identitySource: string | null;
  validationPresetId: string | null;
};

export type HypeCodeExecutionProfileReadiness = {
  ready: boolean;
  health: HypeCodeRoutingHealth;
  summary: string;
  issues: string[];
};

export type HypeCodeRunRoutingSummary = {
  backendId?: string | null;
  provider: string | null;
  providerLabel: string | null;
  pool: string | null;
  routeLabel: string;
  routeHint: string | null;
  health: HypeCodeRoutingHealth;
  backendOperability?: {
    state: "ready" | "attention" | "blocked";
    placementEligible: boolean;
    summary: string;
    reasons: string[];
    heartbeatState?: "fresh" | "stale" | "missing" | "unknown" | null;
    heartbeatAgeMs?: number | null;
    reachability?: "reachable" | "degraded" | "unreachable" | "unknown" | null;
    leaseStatus?: "active" | "expiring" | "expired" | "released" | "none" | null;
    readinessState?: "ready" | "attention" | "blocked" | "unknown" | "not_applicable" | null;
    activeTasks?: number | null;
    availableExecutionSlots?: number | null;
  } | null;
  enabledAccountCount: number;
  readyAccountCount: number;
  enabledPoolCount: number;
};

export type HypeCodeRunApprovalSummary = {
  status: HypeCodeApprovalStateKind;
  approvalId: string | null;
  label: string;
  summary: string;
};

export type HypeCodeRunInterventionSummary = {
  actions: HypeCodeInterventionAvailability[];
  primaryAction: HypeCodeInterventionAction | null;
};

export type HypeCodeRunOperatorState = {
  health: "healthy" | "attention" | "blocked";
  headline: string;
  detail: string | null;
};

export type HypeCodeRunNextAction = {
  label: string;
  action: HypeCodeInterventionAction | "review";
  detail: string | null;
};

export type HypeCodeReviewPack = {
  id: string;
  runId: string;
  taskId: string;
  workspaceId: string;
  summary: string;
  taskSource?: HypeCodeTaskSourceSummary | null;
  reviewStatus: HypeCodeReviewStatus;
  evidenceState: HypeCodeEvidenceState;
  validationOutcome: HypeCodeValidationOutcome;
  warningCount: number;
  warnings: string[];
  validations: HypeCodeValidationSummary[];
  artifacts: HypeCodeReviewArtifactRef[];
  checksPerformed: string[];
  recommendedNextAction: string | null;
  fileChanges?: HypeCodeReviewPackFileChangeSummary | null;
  evidenceRefs?: HypeCodeReviewPackEvidenceRefs | null;
  assumptions?: string[];
  reproductionGuidance?: string[];
  rollbackGuidance?: string[];
  backendAudit?: {
    summary: string;
    details: string[];
    missingReason: string | null;
  };
  reviewDecision?: HypeCodeReviewDecisionSummary | null;
  createdAt: number;
  lineage?: HypeCodeMissionLineage | null;
  ledger?: HypeCodeRunLedger | null;
  checkpoint?: HypeCodeCheckpointSummary | null;
  missionLinkage?: HypeCodeMissionLinkageSummary | null;
  actionability?: HypeCodeReviewActionabilitySummary | null;
  reviewProfileId?: string | null;
  reviewGate?: HypeCodeReviewGateSummary | null;
  reviewFindings?: HypeCodeReviewFinding[] | null;
  reviewRunId?: string | null;
  skillUsage?: HypeCodeRuntimeSkillUsageSummary[] | null;
  autofixCandidate?: HypeCodeRuntimeAutofixCandidate | null;
  governance?: HypeCodeRunGovernanceSummary | null;
  placement?: HypeCodeRunPlacementEvidence | null;
  workspaceEvidence?: HypeCodeWorkspaceEvidence | null;
  failureClass?: HypeCodeFailureClass | null;
  relaunchOptions?: HypeCodeReviewPackRelaunchOptions | null;
  subAgentSummary?: HypeCodeSubAgentSummary[] | null;
  publishHandoff?: HypeCodePublishHandoffReference | null;
  takeoverBundle?: HypeCodeTakeoverBundle | null;
};

export type HypeCodeTaskSummary = Pick<
  HypeCodeTask,
  | "id"
  | "workspaceId"
  | "title"
  | "objective"
  | "origin"
  | "taskSource"
  | "mode"
  | "modeSource"
  | "status"
  | "createdAt"
  | "updatedAt"
  | "currentRunId"
  | "latestRunId"
  | "latestRunState"
  | "nextAction"
  | "lineage"
  | "accountability"
  | "executionGraph"
>;

export type HypeCodeRunSummary = Pick<
  HypeCodeRun,
  | "id"
  | "taskId"
  | "workspaceId"
  | "taskSource"
  | "state"
  | "title"
  | "summary"
  | "taskSource"
  | "startedAt"
  | "finishedAt"
  | "updatedAt"
  | "currentStepIndex"
  | "pendingIntervention"
  | "executionProfile"
  | "reviewProfileId"
  | "profileReadiness"
  | "routing"
  | "approval"
  | "reviewDecision"
  | "intervention"
  | "operatorState"
  | "nextAction"
  | "warnings"
  | "validations"
  | "artifacts"
  | "changedPaths"
  | "autoDrive"
  | "completionReason"
  | "reviewPackId"
  | "lineage"
  | "ledger"
  | "checkpoint"
  | "missionLinkage"
  | "actionability"
  | "reviewGate"
  | "reviewFindings"
  | "reviewRunId"
  | "skillUsage"
  | "autofixCandidate"
  | "governance"
  | "placement"
  | "operatorSnapshot"
  | "workspaceEvidence"
  | "missionBrief"
  | "relaunchContext"
  | "subAgents"
  | "publishHandoff"
  | "takeoverBundle"
  | "executionGraph"
>;

export type HypeCodeReviewPackSummary = Pick<
  HypeCodeReviewPack,
  | "id"
  | "runId"
  | "taskId"
  | "workspaceId"
  | "taskSource"
  | "summary"
  | "taskSource"
  | "reviewStatus"
  | "evidenceState"
  | "validationOutcome"
  | "warningCount"
  | "warnings"
  | "validations"
  | "artifacts"
  | "checksPerformed"
  | "recommendedNextAction"
  | "fileChanges"
  | "evidenceRefs"
  | "assumptions"
  | "reproductionGuidance"
  | "rollbackGuidance"
  | "backendAudit"
  | "reviewDecision"
  | "createdAt"
  | "lineage"
  | "ledger"
  | "checkpoint"
  | "missionLinkage"
  | "actionability"
  | "reviewProfileId"
  | "reviewGate"
  | "reviewFindings"
  | "reviewRunId"
  | "skillUsage"
  | "autofixCandidate"
  | "governance"
  | "placement"
  | "workspaceEvidence"
  | "failureClass"
  | "relaunchOptions"
  | "subAgentSummary"
  | "publishHandoff"
  | "takeoverBundle"
>;

export type HypeCodeMissionControlSnapshot = {
  source: HypeCodeMissionControlSource;
  generatedAt: number;
  workspaces: HypeCodeWorkspace[];
  tasks: HypeCodeTaskSummary[];
  runs: HypeCodeRunSummary[];
  reviewPacks: HypeCodeReviewPackSummary[];
};

export type HypeCodeMissionControlReadinessTone = "ready" | "attention" | "blocked" | "idle";

export type HypeCodeMissionControlActivityTone =
  | "active"
  | "ready"
  | "attention"
  | "blocked"
  | "neutral";

export type HypeCodeMissionControlReadinessSummary = {
  tone: HypeCodeMissionControlReadinessTone;
  label: string;
  detail: string;
};

export type HypeCodeMissionActivityItem = {
  id: string;
  title: string;
  workspaceName: string;
  statusLabel: string;
  tone: HypeCodeMissionControlActivityTone;
  detail: string;
  highlights: string[];
};

export type HypeCodeReviewQueueItem = {
  id: string;
  title: string;
  workspaceName: string;
  summary: string;
  reviewStatusLabel: string;
  validationLabel: string;
  tone: HypeCodeMissionControlActivityTone;
  warningCount: number;
};

export type HypeCodeMissionControlSummary = {
  workspaceLabel: string;
  tasksCount: number;
  runsCount: number;
  approvalCount: number;
  reviewPacksCount: number;
  connectedWorkspaceCount: number;
  launchReadiness: HypeCodeMissionControlReadinessSummary;
  continuityReadiness: HypeCodeMissionControlReadinessSummary;
  missionItems: HypeCodeMissionActivityItem[];
  reviewItems: HypeCodeReviewQueueItem[];
};
