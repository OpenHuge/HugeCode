export const HUGECODE_RUN_STATES = [
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

export type HugeCodeRunState = (typeof HUGECODE_RUN_STATES)[number];

export const HUGECODE_INTERVENTION_ACTIONS = [
  "pause",
  "resume",
  "cancel",
  "retry",
  "continue_with_clarification",
  "narrow_scope",
  "relax_validation",
  "replan_scope",
  "drop_feature",
  "insert_feature",
  "change_validation_lane",
  "change_backend_preference",
  "mark_blocked_with_reason",
  "switch_profile_and_retry",
  "escalate_to_pair_mode",
] as const;

export type HugeCodeInterventionAction = (typeof HUGECODE_INTERVENTION_ACTIONS)[number];

export type HugeCodeValidationOutcome = "passed" | "failed" | "warning" | "skipped" | "unknown";

export type HugeCodeMissionControlSource = "runtime_snapshot_v1";

export type HugeCodeEvidenceState = "confirmed" | "incomplete";

export type HugeCodeTaskMode = "ask" | "pair" | "delegate";

export type HugeCodeTaskModeSource =
  | "execution_profile"
  | "execution_mode"
  | "access_mode"
  | "legacy_thread_projection"
  | "missing";

export type HugeCodeTaskStatus =
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

export type HugeCodeReviewStatus = "ready" | "action_required" | "incomplete_evidence";

export type HugeCodeReviewDecisionState = "pending" | "accepted" | "rejected";

export type HugeCodeTaskAccountabilityLifecycle = "claimed" | "executing" | "in_review" | "done";

export type HugeCodeGovernanceStateKind =
  | "in_progress"
  | "awaiting_approval"
  | "awaiting_review"
  | "action_required"
  | "completed";

export type HugeCodeGovernanceAction =
  | HugeCodeInterventionAction
  | "review_result"
  | "accept_result"
  | "reject_result";

export type HugeCodeTaskOrigin =
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

export type HugeCodeTaskSourceKind =
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

export type HugeCodeTaskSourceRepoContext = {
  owner?: string | null;
  name?: string | null;
  fullName?: string | null;
  remoteUrl?: string | null;
};

export type HugeCodeTaskSourceSummary = {
  kind: HugeCodeTaskSourceKind;
  label?: string | null;
  shortLabel?: string | null;
  title?: string | null;
  reference?: string | null;
  url?: string | null;
  issueNumber?: number | null;
  pullRequestNumber?: number | null;
  repo?: HugeCodeTaskSourceRepoContext | null;
  workspaceId?: string | null;
  workspaceRoot?: string | null;
  externalId?: string | null;
  canonicalUrl?: string | null;
  threadId?: string | null;
  requestId?: string | null;
  sourceTaskId?: string | null;
  sourceRunId?: string | null;
};

export type HugeCodeTaskSourceLinkage = HugeCodeTaskSourceSummary & {
  label: string;
  shortLabel: string;
};

export type HugeCodeExecutionAutonomy =
  | "operator_review"
  | "bounded_delegate"
  | "autonomous_delegate";

export type HugeCodeExecutionToolPosture = "read_only" | "workspace_safe" | "workspace_extended";

export type HugeCodeExecutionRoutingStrategy =
  | "workspace_default"
  | "provider_route"
  | "direct_model";

export type HugeCodeApprovalSensitivity = "heightened" | "standard" | "low_friction";

export type HugeCodeRoutingHealth = "ready" | "attention" | "blocked";

export type HugeCodeApprovalStateKind =
  | "not_required"
  | "pending_decision"
  | "approved"
  | "rejected"
  | "unavailable";

export type HugeCodeAutoDriveRoutePreference = "stability_first" | "balanced" | "speed_first";

export type HugeCodeAutoDriveConfidence = "low" | "medium" | "high";

export type HugeCodeAutoDriveContextScope = "active_workspace" | "workspace_graph";

export type HugeCodeAutoDriveAutonomyPriority = "operator" | "balanced";

export type HugeCodeAutoDrivePromptStrategy = "repo_truth_first" | "workspace_graph_first";

export type HugeCodeAutoDriveResearchMode = "repository_only" | "live_when_allowed";

export type HugeCodeAutoDriveStopReason =
  | "completed"
  | "paused"
  | "budget_exhausted"
  | "validation_failed"
  | "rerouted"
  | "operator_intervened"
  | "cancelled"
  | "failed";

export type HugeCodeAutoDriveDoneDefinition = {
  arrivalCriteria?: string[];
  requiredValidation?: string[];
  waypointIndicators?: string[];
};

export type HugeCodeAutoDriveDestination = {
  title: string;
  desiredEndState: string[];
  doneDefinition?: HugeCodeAutoDriveDoneDefinition | null;
  hardBoundaries?: string[];
  routePreference?: HugeCodeAutoDriveRoutePreference | null;
};

export type HugeCodeAutoDriveBudget = {
  maxTokens?: number | null;
  maxIterations?: number | null;
  maxDurationMs?: number | null;
  maxFilesPerIteration?: number | null;
  maxNoProgressIterations?: number | null;
  maxValidationFailures?: number | null;
  maxReroutes?: number | null;
};

export type HugeCodeAutoDriveRiskPolicy = {
  pauseOnDestructiveChange?: boolean | null;
  pauseOnDependencyChange?: boolean | null;
  pauseOnLowConfidence?: boolean | null;
  pauseOnHumanCheckpoint?: boolean | null;
  allowNetworkAnalysis?: boolean | null;
  allowValidationCommands?: boolean | null;
  minimumConfidence?: HugeCodeAutoDriveConfidence | null;
};

export type HugeCodeAutoDriveContextPolicy = {
  scope?: HugeCodeAutoDriveContextScope | null;
  workspaceReadPaths?: string[] | null;
  workspaceContextPaths?: string[] | null;
  authoritySources?: string[] | null;
};

export type HugeCodeAutoDriveDecisionPolicy = {
  independentThread?: boolean | null;
  autonomyPriority?: HugeCodeAutoDriveAutonomyPriority | null;
  promptStrategy?: HugeCodeAutoDrivePromptStrategy | null;
  researchMode?: HugeCodeAutoDriveResearchMode | null;
};

export type HugeCodeAutoDriveContinuationPolicy = {
  enabled?: boolean | null;
  maxAutomaticFollowUps?: number | null;
  requireValidationSuccessToStop?: boolean | null;
  minimumConfidenceToStop?: HugeCodeAutoDriveConfidence | null;
};

export type HugeCodeAutoDriveContinuationState = {
  automaticFollowUpCount?: number | null;
  status?: "idle" | "continuing" | "stopped" | null;
  lastContinuationAt?: number | null;
  lastContinuationReason?: string | null;
};

export type HugeCodeAutoDriveDecisionScore = {
  reasonCode: string;
  label: string;
  delta: number;
};

export type HugeCodeAutoDriveScenarioProfile = {
  authorityScope?: HugeCodeAutoDriveContextScope | null;
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

export type HugeCodeAutoDriveDecisionTrace = {
  phase?: "launch" | "progress" | "failure" | "completed" | "recovered" | null;
  summary?: string | null;
  selectedCandidateId?: string | null;
  selectedCandidateSummary?: string | null;
  selectionTags?: string[] | null;
  scoreBreakdown?: HugeCodeAutoDriveDecisionScore[] | null;
  authoritySources?: string[] | null;
  representativeCommand?: string | null;
  heldOutGuidance?: string[] | null;
};

export type HugeCodeAutoDriveOutcomeFeedback = {
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

export type HugeCodeAutoDriveAutonomyState = {
  independentThread?: boolean | null;
  autonomyPriority?: HugeCodeAutoDriveAutonomyPriority | null;
  highPriority?: boolean | null;
  escalationPressure?: "low" | "medium" | "high" | null;
  unattendedContinuationAllowed?: boolean | null;
  backgroundSafe?: boolean | null;
  humanInterventionHotspots?: string[] | null;
};

export type HugeCodeAutoDriveNavigation = {
  activeWaypoint?: string | null;
  completedWaypoints?: string[];
  pendingWaypoints?: string[];
  lastProgressAt?: number | null;
  rerouteCount?: number | null;
  validationFailureCount?: number | null;
  noProgressIterations?: number | null;
};

export type HugeCodeAutoDriveRecoveryMarker = {
  recovered?: boolean | null;
  resumeReady?: boolean | null;
  checkpointId?: string | null;
  traceId?: string | null;
  recoveredAt?: number | null;
  summary?: string | null;
};

export type HugeCodeAutoDriveStopState = {
  reason: HugeCodeAutoDriveStopReason;
  summary?: string | null;
  at?: number | null;
};

export type HugeCodeAutoDriveState = {
  enabled?: boolean | null;
  destination: HugeCodeAutoDriveDestination;
  budget?: HugeCodeAutoDriveBudget | null;
  riskPolicy?: HugeCodeAutoDriveRiskPolicy | null;
  contextPolicy?: HugeCodeAutoDriveContextPolicy | null;
  decisionPolicy?: HugeCodeAutoDriveDecisionPolicy | null;
  continuationPolicy?: HugeCodeAutoDriveContinuationPolicy | null;
  continuationState?: HugeCodeAutoDriveContinuationState | null;
  scenarioProfile?: HugeCodeAutoDriveScenarioProfile | null;
  decisionTrace?: HugeCodeAutoDriveDecisionTrace | null;
  outcomeFeedback?: HugeCodeAutoDriveOutcomeFeedback | null;
  autonomyState?: HugeCodeAutoDriveAutonomyState | null;
  navigation?: HugeCodeAutoDriveNavigation | null;
  recovery?: HugeCodeAutoDriveRecoveryMarker | null;
  stop?: HugeCodeAutoDriveStopState | null;
};

export type HugeCodeInterventionAvailability = {
  action: HugeCodeInterventionAction;
  label: string;
  enabled: boolean;
  supported: boolean;
  reason: string | null;
};

export type HugeCodeMissionBriefPermissionSummary = {
  accessMode?: "read-only" | "on-request" | "full-access" | null;
  allowNetwork?: boolean | null;
  writableRoots?: string[] | null;
  toolNames?: string[] | null;
};

export type HugeCodeMissionBriefEvaluationPlan = {
  representativeCommands?: string[] | null;
  componentCommands?: string[] | null;
  endToEndCommands?: string[] | null;
  samplePaths?: string[] | null;
  heldOutGuidance?: string[] | null;
  sourceSignals?: string[] | null;
};

export type HugeCodeMissionBriefScenarioProfile = HugeCodeAutoDriveScenarioProfile;

export type HugeCodeMissionPlanMilestoneStatus = "planned" | "active" | "completed" | "blocked";

export type HugeCodeMissionValidationTrigger = "per_feature" | "per_milestone" | "pre_review";

export type HugeCodeMissionPlanMilestone = {
  id: string;
  label: string;
  summary: string;
  status?: HugeCodeMissionPlanMilestoneStatus | null;
  nodeIds?: string[] | null;
  validationLaneIds?: string[] | null;
  acceptanceCriteria?: string[] | null;
};

export type HugeCodeMissionValidationLane = {
  id: string;
  label: string;
  summary: string;
  trigger: HugeCodeMissionValidationTrigger;
  commands?: string[] | null;
};

export type HugeCodeMissionSkillPlanItemState = "available" | "missing" | "recommended";

export type HugeCodeMissionSkillPlanItem = {
  skillId: string;
  label: string;
  state: HugeCodeMissionSkillPlanItemState;
  summary?: string | null;
};

export type HugeCodeMissionBrief = {
  objective: string;
  doneDefinition?: string[] | null;
  constraints?: string[] | null;
  riskLevel?: "low" | "medium" | "high" | null;
  requiredCapabilities?: string[] | null;
  maxSubtasks?: number | null;
  preferredBackendIds?: string[] | null;
  permissionSummary?: HugeCodeMissionBriefPermissionSummary | null;
  evaluationPlan?: HugeCodeMissionBriefEvaluationPlan | null;
  scenarioProfile?: HugeCodeMissionBriefScenarioProfile | null;
  planVersion?: string | null;
  planSummary?: string | null;
  currentMilestoneId?: string | null;
  estimatedDurationMinutes?: number | null;
  estimatedWorkerRuns?: number | null;
  parallelismHint?: string | null;
  clarificationQuestions?: string[] | null;
  milestones?: HugeCodeMissionPlanMilestone[] | null;
  validationLanes?: HugeCodeMissionValidationLane[] | null;
  skillPlan?: HugeCodeMissionSkillPlanItem[] | null;
};

export type HugeCodeFailureClass =
  | "validation_failed"
  | "approval_required"
  | "runtime_failed"
  | "timed_out"
  | "interrupted"
  | "cancelled"
  | "unknown";

export type HugeCodeRelaunchContext = {
  sourceTaskId?: string | null;
  sourceRunId?: string | null;
  sourceReviewPackId?: string | null;
  sourcePlanVersion?: string | null;
  summary?: string | null;
  failureClass?: HugeCodeFailureClass | null;
  recommendedActions?: HugeCodeInterventionAction[] | null;
  planChangeSummary?: string | null;
};

export type HugeCodeReviewPackRelaunchOptions = HugeCodeRelaunchContext & {
  primaryAction?: HugeCodeInterventionAction | null;
  availableActions?: HugeCodeInterventionAvailability[] | null;
};

export type HugeCodePublishHandoffReference = {
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

export type HugeCodeTakeoverState = "ready" | "attention" | "blocked";

export type HugeCodeTakeoverPathKind = "approval" | "resume" | "review" | "handoff" | "missing";

export type HugeCodeTakeoverPrimaryAction =
  | "approve"
  | "resume"
  | "open_review_pack"
  | "open_handoff"
  | "open_sub_agent_session"
  | "inspect_runtime";

export type HugeCodeSubAgentCheckpointState = {
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

export type HugeCodeSubAgentApprovalState = {
  status: string;
  approvalId?: string | null;
  action?: string | null;
  reason?: string | null;
  at?: number | null;
};

export type HugeCodeSubAgentSummary = {
  sessionId: string;
  parentRunId?: string | null;
  scopeProfile?: string | null;
  status: string;
  approvalState?: HugeCodeSubAgentApprovalState | null;
  checkpointState?: HugeCodeSubAgentCheckpointState | null;
  takeoverBundle?: HugeCodeTakeoverBundle | null;
  summary?: string | null;
  timedOutReason?: string | null;
  interruptedReason?: string | null;
};

export type HugeCodeReviewArtifactRef = {
  id: string;
  label: string;
  kind: "diff" | "validation" | "log" | "evidence" | "command";
  uri?: string | null;
};

export type HugeCodeReviewDecisionSummary = {
  status: HugeCodeReviewDecisionState;
  reviewPackId: string;
  label: string;
  summary: string;
  decidedAt: number | null;
};

export type HugeCodeReviewPackFileChangeSummary = {
  paths: string[];
  totalCount: number;
  summary: string;
  missingReason: string | null;
};

export type HugeCodeReviewPackEvidenceRefs = {
  traceId: string | null;
  checkpointId: string | null;
  diffArtifactIds: string[];
  validationArtifactIds: string[];
  logArtifactIds: string[];
  commandArtifactIds: string[];
};

export type HugeCodeValidationSummary = {
  id: string;
  label: string;
  outcome: HugeCodeValidationOutcome;
  summary: string;
  startedAt?: number | null;
  finishedAt?: number | null;
};

export type HugeCodeMissionLineage = {
  objective: string | null;
  desiredEndState?: string[];
  hardBoundaries?: string[];
  doneDefinition?: HugeCodeAutoDriveDoneDefinition | null;
  riskPolicy?: HugeCodeAutoDriveRiskPolicy | null;
  taskMode?: HugeCodeTaskMode | null;
  executionProfileId?: string | null;
  taskSource?: HugeCodeTaskSourceSummary | null;
  threadId?: string | null;
  requestId?: string | null;
  rootTaskId?: string | null;
  parentTaskId?: string | null;
  childTaskIds?: string[];
  reviewDecisionState?: HugeCodeReviewDecisionState | null;
  reviewDecisionSummary?: string | null;
};

export type HugeCodeTaskAccountability = {
  lifecycle: HugeCodeTaskAccountabilityLifecycle;
  claimedBy: string | null;
  claimedAt: number | null;
  lifecycleUpdatedAt: number | null;
};

export type HugeCodeRunLedger = {
  traceId: string | null;
  checkpointId: string | null;
  recovered: boolean;
  stepCount: number;
  completedStepCount: number;
  warningCount: number;
  validationCount: number;
  artifactCount: number;
  evidenceState: HugeCodeEvidenceState;
  backendId: string | null;
  routeLabel: string | null;
  completionReason: string | null;
  lastProgressAt: number | null;
};

export type HugeCodeCheckpointSummary = {
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

export type HugeCodeMissionNavigationTarget =
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

export type HugeCodeRuntimeSessionBoundary = {
  workspaceId: string;
  taskId: string;
  runId: string;
  missionTaskId: string;
  sessionKind: "thread" | "run";
  threadId?: string | null;
  requestId?: string | null;
  reviewPackId?: string | null;
  checkpointId?: string | null;
  traceId?: string | null;
  navigationTarget: HugeCodeMissionNavigationTarget;
};

export type HugeCodeTakeoverTarget =
  | HugeCodeMissionNavigationTarget
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

export type HugeCodeMissionLinkageSummary = {
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
  navigationTarget: HugeCodeMissionNavigationTarget;
  summary: string;
};

export type HugeCodeContinuationTruthSource =
  | "takeover_bundle"
  | "review_actionability"
  | "mission_linkage"
  | "publish_handoff"
  | "checkpoint"
  | "missing";

export type HugeCodeContinuationState = "ready" | "attention" | "blocked" | "missing";

export type HugeCodeContinuationSummary = {
  state: HugeCodeContinuationState;
  pathKind: HugeCodeTakeoverPathKind;
  source: HugeCodeContinuationTruthSource;
  summary: string;
  detail: string | null;
  recommendedAction: string;
  target?: HugeCodeTakeoverTarget | null;
  reviewPackId?: string | null;
  reviewActionability?: HugeCodeReviewActionabilitySummary | null;
  sessionBoundary: HugeCodeRuntimeSessionBoundary;
};

export type HugeCodeNextOperatorActionSource =
  | "review_pack"
  | "approval"
  | "continuation"
  | "run_failure"
  | "run_activity"
  | "runtime_fallback";

export type HugeCodeNextOperatorAction = {
  action:
    | HugeCodeTakeoverPrimaryAction
    | HugeCodeInterventionAction
    | "review"
    | "open_mission"
    | "view_failure";
  label: string;
  detail: string | null;
  source: HugeCodeNextOperatorActionSource;
  target?: HugeCodeTakeoverTarget | null;
  sessionBoundary: HugeCodeRuntimeSessionBoundary;
};

export type HugeCodeExecutionNodeSummary = {
  id: string;
  kind: "plan" | (string & {});
  status?: string;
  executorKind?: "sub_agent" | (string & {}) | null;
  executorSessionId?: string | null;
  preferredBackendIds?: string[];
  resolvedBackendId: string | null;
  placementLifecycleState?: string | null;
  placementResolutionSource?: string | null;
  checkpoint?: HugeCodeCheckpointSummary | null;
  reviewActionability?: HugeCodeReviewActionabilitySummary | null;
};

export type HugeCodeExecutionEdgeSummary = {
  fromNodeId: string;
  toNodeId: string;
  kind: "depends_on" | (string & {});
};

export type HugeCodeExecutionGraphSummary = {
  graphId: string;
  nodes: HugeCodeExecutionNodeSummary[];
  edges: HugeCodeExecutionEdgeSummary[];
};

export type HugeCodeReviewActionabilityAction =
  | "accept_result"
  | "reject_result"
  | "retry"
  | "continue_with_clarification"
  | "narrow_scope"
  | "relax_validation"
  | "switch_profile_and_retry"
  | "escalate_to_pair_mode";

export type HugeCodeReviewActionAvailability = {
  action: HugeCodeReviewActionabilityAction;
  enabled: boolean;
  supported: boolean;
  reason: string | null;
};

export type HugeCodeReviewActionabilitySummary = {
  state: "ready" | "degraded" | "blocked";
  summary: string;
  degradedReasons: string[];
  actions: HugeCodeReviewActionAvailability[];
};

export type HugeCodeReviewGateState = "pass" | "warn" | "fail" | "blocked";

export type HugeCodeReviewFindingSeverity = "info" | "warning" | "error" | "critical";

export type HugeCodeReviewFindingCategory =
  | "correctness_risk"
  | "validation_gap"
  | "security_risk"
  | "repo_policy_mismatch"
  | "followup_clarification"
  | (string & {});

export type HugeCodeReviewFindingConfidence = "low" | "medium" | "high";

export type HugeCodeReviewFindingAnchor = {
  path?: string | null;
  startLine?: number | null;
  endLine?: number | null;
  diffSide?: "base" | "head" | null;
  label?: string | null;
};

export type HugeCodeReviewFinding = {
  id: string;
  title: string;
  severity: HugeCodeReviewFindingSeverity;
  category: HugeCodeReviewFindingCategory;
  summary: string;
  confidence: HugeCodeReviewFindingConfidence;
  suggestedNextAction?: string | null;
  anchors?: HugeCodeReviewFindingAnchor[] | null;
};

export type HugeCodeReviewGateSummary = {
  state: HugeCodeReviewGateState;
  summary: string;
  blockingReason?: string | null;
  highestSeverity?: HugeCodeReviewFindingSeverity | null;
  findingCount?: number | null;
};

export type HugeCodeRuntimeSkillUsageRecommendedFor = "delegate" | "review" | "repair";

export type HugeCodeRuntimeSkillUsageSummary = {
  skillId: string;
  name: string;
  source?: "builtin" | "managed" | "workspace" | (string & {}) | null;
  status?: "used" | "available" | "suggested" | "unavailable" | null;
  recommendedFor?: HugeCodeRuntimeSkillUsageRecommendedFor[] | null;
  summary?: string | null;
};

export type HugeCodeRuntimeAutofixCandidate = {
  id: string;
  summary: string;
  status: "available" | "applied" | "blocked";
  patchRef?: string | null;
  approvalRequired?: boolean | null;
  blockingReason?: string | null;
};

export type HugeCodeTakeoverBundle = {
  state: HugeCodeTakeoverState;
  pathKind: HugeCodeTakeoverPathKind;
  primaryAction: HugeCodeTakeoverPrimaryAction;
  summary: string;
  blockingReason?: string | null;
  recommendedAction: string;
  target?: HugeCodeTakeoverTarget | null;
  checkpointId?: string | null;
  traceId?: string | null;
  reviewPackId?: string | null;
  publishHandoff?: HugeCodePublishHandoffReference | null;
  reviewActionability?: HugeCodeReviewActionabilitySummary | null;
};

export type HugeCodeRunGovernanceSummary = {
  state: HugeCodeGovernanceStateKind;
  label: string;
  summary: string;
  blocking: boolean;
  suggestedAction: HugeCodeGovernanceAction | null;
  availableActions: HugeCodeGovernanceAction[];
};

export type HugeCodeBackendContractSummary = {
  kind: "native" | "acp";
  origin: "runtime-native" | "acp-projection";
  transport: "stdio" | "http" | null;
  capabilityCount: number;
  health: "active" | "draining" | "disabled";
  rolloutState: "current" | "ramping" | "draining" | "drained";
};

export type HugeCodePlacementResolutionSource =
  | "explicit_preference"
  | "workspace_default"
  | "provider_route"
  | "runtime_fallback"
  | "unresolved";

export type HugeCodePlacementLifecycleState =
  | "requested"
  | "resolved"
  | "confirmed"
  | "fallback"
  | "unresolved";

export type HugeCodePlacementHealthSummary =
  | "placement_ready"
  | "placement_attention"
  | "placement_blocked";

export type HugeCodePlacementAttentionReason =
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

export type HugeCodePlacementScoreBreakdown = {
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

export type HugeCodeRunPlacementEvidence = {
  resolvedBackendId: string | null;
  requestedBackendIds: string[];
  resolutionSource: HugeCodePlacementResolutionSource;
  lifecycleState: HugeCodePlacementLifecycleState;
  readiness: HugeCodeRoutingHealth | null;
  healthSummary: HugeCodePlacementHealthSummary;
  attentionReasons: HugeCodePlacementAttentionReason[];
  summary: string;
  rationale: string;
  fallbackReasonCode?: string | null;
  resumeBackendId?: string | null;
  scoreBreakdown?: HugeCodePlacementScoreBreakdown[] | null;
  tcpOverlay?: "tailscale" | "netbird" | null;
  backendContract?: HugeCodeBackendContractSummary | null;
};

export type HugeCodeRunOperatorEventKind =
  | "status_transition"
  | "tool_start"
  | "tool_finish"
  | "approval_wait"
  | "blocked"
  | "recovered";

export type HugeCodeRunOperatorEvent = {
  kind: HugeCodeRunOperatorEventKind;
  label: string;
  detail: string | null;
  at: number | null;
};

export type HugeCodeRunOperatorSnapshot = {
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
  recentEvents: HugeCodeRunOperatorEvent[];
};

export type HugeCodeWorkspaceEvidenceBucketKind =
  | "changedFiles"
  | "diffs"
  | "validations"
  | "commands"
  | "logs"
  | "memoryOrNotes";

export type HugeCodeWorkspaceEvidenceItem = {
  id: string;
  label: string;
  detail: string | null;
  uri: string | null;
};

export type HugeCodeWorkspaceEvidenceBucket = {
  kind: HugeCodeWorkspaceEvidenceBucketKind;
  label: string;
  summary: string;
  items: HugeCodeWorkspaceEvidenceItem[];
  missingReason: string | null;
};

export type HugeCodeWorkspaceEvidence = {
  summary: string;
  buckets: HugeCodeWorkspaceEvidenceBucket[];
};

export type HugeCodeWorkspace = {
  id: string;
  name: string;
  rootPath: string;
  connected: boolean;
  defaultProfileId: string | null;
};

export type HugeCodeTask = {
  id: string;
  workspaceId: string;
  title: string;
  objective: string | null;
  origin: HugeCodeTaskOrigin;
  taskSource?: HugeCodeTaskSourceSummary | null;
  mode: HugeCodeTaskMode | null;
  modeSource: HugeCodeTaskModeSource;
  status: HugeCodeTaskStatus;
  createdAt: number | null;
  updatedAt: number;
  currentRunId: string | null;
  latestRunId: string | null;
  latestRunState: HugeCodeRunState | null;
  nextAction?: HugeCodeRunNextAction | null;
  lineage?: HugeCodeMissionLineage | null;
  accountability?: HugeCodeTaskAccountability | null;
  executionGraph?: HugeCodeExecutionGraphSummary | null;
};

export type HugeCodeRun = {
  id: string;
  taskId: string;
  workspaceId: string;
  state: HugeCodeRunState;
  title: string | null;
  summary: string | null;
  taskSource?: HugeCodeTaskSourceSummary | null;
  startedAt: number | null;
  finishedAt: number | null;
  updatedAt: number;
  currentStepIndex: number | null;
  pendingIntervention?: HugeCodeInterventionAction | null;
  autoDrive?: HugeCodeAutoDriveState | null;
  executionProfile?: HugeCodeExecutionProfile | null;
  reviewProfileId?: string | null;
  profileReadiness?: HugeCodeExecutionProfileReadiness | null;
  routing?: HugeCodeRunRoutingSummary | null;
  approval?: HugeCodeRunApprovalSummary | null;
  reviewDecision?: HugeCodeReviewDecisionSummary | null;
  intervention?: HugeCodeRunInterventionSummary | null;
  operatorState?: HugeCodeRunOperatorState | null;
  nextAction?: HugeCodeRunNextAction | null;
  warnings?: string[];
  validations?: HugeCodeValidationSummary[];
  artifacts?: HugeCodeReviewArtifactRef[];
  changedPaths?: string[];
  completionReason?: string | null;
  reviewPackId?: string | null;
  lineage?: HugeCodeMissionLineage | null;
  ledger?: HugeCodeRunLedger | null;
  checkpoint?: HugeCodeCheckpointSummary | null;
  missionLinkage?: HugeCodeMissionLinkageSummary | null;
  actionability?: HugeCodeReviewActionabilitySummary | null;
  reviewGate?: HugeCodeReviewGateSummary | null;
  reviewFindings?: HugeCodeReviewFinding[] | null;
  reviewRunId?: string | null;
  skillUsage?: HugeCodeRuntimeSkillUsageSummary[] | null;
  autofixCandidate?: HugeCodeRuntimeAutofixCandidate | null;
  sessionBoundary?: HugeCodeRuntimeSessionBoundary | null;
  continuation?: HugeCodeContinuationSummary | null;
  nextOperatorAction?: HugeCodeNextOperatorAction | null;
  governance?: HugeCodeRunGovernanceSummary | null;
  placement?: HugeCodeRunPlacementEvidence | null;
  operatorSnapshot?: HugeCodeRunOperatorSnapshot | null;
  workspaceEvidence?: HugeCodeWorkspaceEvidence | null;
  missionBrief?: HugeCodeMissionBrief | null;
  relaunchContext?: HugeCodeRelaunchContext | null;
  subAgents?: HugeCodeSubAgentSummary[];
  publishHandoff?: HugeCodePublishHandoffReference | null;
  takeoverBundle?: HugeCodeTakeoverBundle | null;
  executionGraph?: HugeCodeExecutionGraphSummary | null;
  selectedOpportunityId?: string | null;
  wakeReason?: string | null;
  wakeState?: HugeCodeWakeState | null;
  sourceCitations?: HugeCodeSourceCitation[] | null;
  queuePosition?: number | null;
  nextEligibleAction?: HugeCodeNextEligibleAction | null;
};

export type HugeCodeExecutionProfile = {
  id: string;
  name: string;
  description: string;
  executionMode: "local_interactive" | "local_background" | "desktop_sandbox" | "remote_sandbox";
  autonomy: HugeCodeExecutionAutonomy;
  supervisionLabel: string;
  accessMode: "read-only" | "on-request" | "full-access";
  networkPolicy: "default" | "restricted" | "offline";
  routingStrategy: HugeCodeExecutionRoutingStrategy;
  toolPosture: HugeCodeExecutionToolPosture;
  approvalSensitivity: HugeCodeApprovalSensitivity;
  identitySource: string | null;
  validationPresetId: string | null;
};

export type HugeCodeExecutionProfileReadiness = {
  ready: boolean;
  health: HugeCodeRoutingHealth;
  summary: string;
  issues: string[];
};

export type HugeCodeRunRoutingSummary = {
  backendId?: string | null;
  provider: string | null;
  providerLabel: string | null;
  pool: string | null;
  routeLabel: string;
  routeHint: string | null;
  health: HugeCodeRoutingHealth;
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

export type HugeCodeRunApprovalSummary = {
  status: HugeCodeApprovalStateKind;
  approvalId: string | null;
  label: string;
  summary: string;
};

export type HugeCodeRunInterventionSummary = {
  actions: HugeCodeInterventionAvailability[];
  primaryAction: HugeCodeInterventionAction | null;
};

export type HugeCodeRunOperatorState = {
  health: "healthy" | "attention" | "blocked";
  headline: string;
  detail: string | null;
};

export type HugeCodeRunNextAction = {
  label: string;
  action: HugeCodeInterventionAction | "review";
  detail: string | null;
};

export type HugeCodeWakeState = "ready" | "attention" | "blocked";

export type HugeCodeNextEligibleAction =
  | "continue"
  | "approve"
  | "clarify"
  | "reroute"
  | "pair"
  | "hold";

export type HugeCodeSourceCitation = {
  id: string;
  label: string;
  url?: string | null;
  sourceKind: "repo_doc" | "task_source" | "public_web" | "runtime_log";
  trustLevel: "primary" | "runtime" | "derived";
  claimSummary: string;
};

export type HugeCodeReviewPack = {
  id: string;
  runId: string;
  taskId: string;
  workspaceId: string;
  summary: string;
  taskSource?: HugeCodeTaskSourceSummary | null;
  reviewStatus: HugeCodeReviewStatus;
  evidenceState: HugeCodeEvidenceState;
  validationOutcome: HugeCodeValidationOutcome;
  warningCount: number;
  warnings: string[];
  validations: HugeCodeValidationSummary[];
  artifacts: HugeCodeReviewArtifactRef[];
  checksPerformed: string[];
  recommendedNextAction: string | null;
  fileChanges?: HugeCodeReviewPackFileChangeSummary | null;
  evidenceRefs?: HugeCodeReviewPackEvidenceRefs | null;
  assumptions?: string[];
  reproductionGuidance?: string[];
  rollbackGuidance?: string[];
  backendAudit?: {
    summary: string;
    details: string[];
    missingReason: string | null;
  };
  reviewDecision?: HugeCodeReviewDecisionSummary | null;
  createdAt: number;
  lineage?: HugeCodeMissionLineage | null;
  ledger?: HugeCodeRunLedger | null;
  checkpoint?: HugeCodeCheckpointSummary | null;
  missionLinkage?: HugeCodeMissionLinkageSummary | null;
  actionability?: HugeCodeReviewActionabilitySummary | null;
  reviewProfileId?: string | null;
  reviewGate?: HugeCodeReviewGateSummary | null;
  reviewFindings?: HugeCodeReviewFinding[] | null;
  reviewRunId?: string | null;
  skillUsage?: HugeCodeRuntimeSkillUsageSummary[] | null;
  autofixCandidate?: HugeCodeRuntimeAutofixCandidate | null;
  sessionBoundary?: HugeCodeRuntimeSessionBoundary | null;
  continuation?: HugeCodeContinuationSummary | null;
  nextOperatorAction?: HugeCodeNextOperatorAction | null;
  governance?: HugeCodeRunGovernanceSummary | null;
  placement?: HugeCodeRunPlacementEvidence | null;
  workspaceEvidence?: HugeCodeWorkspaceEvidence | null;
  failureClass?: HugeCodeFailureClass | null;
  relaunchOptions?: HugeCodeReviewPackRelaunchOptions | null;
  subAgentSummary?: HugeCodeSubAgentSummary[] | null;
  publishHandoff?: HugeCodePublishHandoffReference | null;
  takeoverBundle?: HugeCodeTakeoverBundle | null;
  selectedOpportunityId?: string | null;
  wakeReason?: string | null;
  wakeState?: HugeCodeWakeState | null;
  sourceCitations?: HugeCodeSourceCitation[] | null;
  queuePosition?: number | null;
  nextEligibleAction?: HugeCodeNextEligibleAction | null;
};

export type HugeCodeTaskSummary = Pick<
  HugeCodeTask,
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

export type HugeCodeRunSummary = Pick<
  HugeCodeRun,
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
  | "sessionBoundary"
  | "continuation"
  | "nextOperatorAction"
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
  | "selectedOpportunityId"
  | "wakeReason"
  | "wakeState"
  | "sourceCitations"
  | "queuePosition"
  | "nextEligibleAction"
>;

export type HugeCodeReviewPackSummary = Pick<
  HugeCodeReviewPack,
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
  | "sessionBoundary"
  | "continuation"
  | "nextOperatorAction"
  | "governance"
  | "placement"
  | "workspaceEvidence"
  | "failureClass"
  | "relaunchOptions"
  | "subAgentSummary"
  | "publishHandoff"
  | "takeoverBundle"
  | "selectedOpportunityId"
  | "wakeReason"
  | "wakeState"
  | "sourceCitations"
  | "queuePosition"
  | "nextEligibleAction"
>;

export type HugeCodeMissionControlSnapshot = {
  source: HugeCodeMissionControlSource;
  generatedAt: number;
  workspaces: HugeCodeWorkspace[];
  tasks: HugeCodeTaskSummary[];
  runs: HugeCodeRunSummary[];
  reviewPacks: HugeCodeReviewPackSummary[];
};

export type HugeCodeMissionControlReadinessTone = "ready" | "attention" | "blocked" | "idle";

export type HugeCodeMissionControlActivityTone =
  | "active"
  | "ready"
  | "attention"
  | "blocked"
  | "neutral";

export type HugeCodeMissionControlReadinessSummary = {
  tone: HugeCodeMissionControlReadinessTone;
  label: string;
  detail: string;
};

export type HugeCodeMissionActivityItem = {
  id: string;
  title: string;
  workspaceName: string;
  statusLabel: string;
  tone: HugeCodeMissionControlActivityTone;
  detail: string;
  highlights: string[];
};

export type HugeCodeReviewQueueItem = {
  id: string;
  title: string;
  workspaceName: string;
  summary: string;
  reviewStatusLabel: string;
  validationLabel: string;
  tone: HugeCodeMissionControlActivityTone;
  warningCount: number;
};

export type HugeCodeMissionControlSummary = {
  workspaceLabel: string;
  tasksCount: number;
  runsCount: number;
  approvalCount: number;
  reviewPacksCount: number;
  connectedWorkspaceCount: number;
  launchReadiness: HugeCodeMissionControlReadinessSummary;
  continuityReadiness: HugeCodeMissionControlReadinessSummary;
  missionItems: HugeCodeMissionActivityItem[];
  reviewItems: HugeCodeReviewQueueItem[];
};
