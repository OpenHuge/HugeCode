import type {
  AgentRole,
  AgentTaskExecutionMode,
  AgentTaskInterventionAction,
  AgentTaskMissionPlanMilestone,
  AgentTaskMissionSkillPlanItem,
  AgentTaskMissionValidationLane,
  AgentTaskPublishHandoffReference,
  AgentTaskRelaunchContext,
  AgentTaskSourceSummary,
  AgentTaskStartRequest,
  AgentTaskStatus,
  AgentTaskStepApprovalMetadata,
  AgentTaskSummary,
} from "./agentExecution.js";
import type { AccessMode, ModelProvider, ReasonEffort, TurnExecutionMode } from "./foundation.js";
import type { HugeCodeReviewPackSummary, HugeCodeRunSummary } from "../hugeCodeMissionControl.js";

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

export type RuntimeContextSelectionStrategyV2 = "minimal" | "balanced" | "deep";

export type RuntimeContextToolExposureProfileV2 = "minimal" | "slim" | "full";

export type RuntimeContextSelectionPolicyV2 = {
  strategy: RuntimeContextSelectionStrategyV2;
  tokenBudgetTarget: number;
  toolExposureProfile: RuntimeContextToolExposureProfileV2;
  preferColdFetch: boolean;
};

export type RuntimeContextWorkingSetV2 = {
  summary: string;
  workspaceRoot: string | null;
  layers: RuntimeContextLayerV2[];
  selectionPolicy: RuntimeContextSelectionPolicyV2;
  contextFingerprint: string;
  stablePrefixFingerprint: string;
};

export type RuntimeContextSourceFamilyV2 =
  | "manual"
  | "github"
  | "discussion"
  | "note"
  | "feedback"
  | "doc"
  | "call"
  | "external"
  | "schedule"
  | "runtime";

export type RuntimeContextConsumerV2 = "run" | "review_pack" | "takeover" | "follow_up";

export type RuntimeReviewIntentV2 = "execute" | "review" | "triage";

export type RuntimeContextTruthSourceV2 = {
  kind: string;
  family: RuntimeContextSourceFamilyV2;
  label: string;
  summary: string;
  source: string | null;
  reference: string | null;
  canonicalUrl: string | null;
  primary: boolean;
};

export type RuntimeContextTruthV2 = {
  summary: string;
  canonicalTaskSource: RuntimeContextTruthSourceV2 | null;
  sources: RuntimeContextTruthSourceV2[];
  executionProfileId: string | null;
  reviewProfileId: string | null;
  validationPresetId: string | null;
  reviewIntent: RuntimeReviewIntentV2;
  ownerSummary: string;
  sourceMetadata: string[];
  consumers: RuntimeContextConsumerV2[];
};

export type RuntimeGuidanceLayerScopeV2 = "repo" | "source" | "review_profile" | "launch";

export type RuntimeGuidanceLayerV2 = {
  id: string;
  scope: RuntimeGuidanceLayerScopeV2;
  summary: string;
  source: string;
  priority: number;
  instructions: string[];
  skillIds: string[];
};

export type RuntimeGuidanceStackV2 = {
  summary: string;
  precedence: string[];
  layers: RuntimeGuidanceLayerV2[];
};

export type RuntimeDelegationStateV2 =
  | "launch_ready"
  | "needs_clarification"
  | "review"
  | "resume"
  | "handoff"
  | "blocked";

export type RuntimeDelegationContractV2 = {
  summary: string;
  state: RuntimeDelegationStateV2;
  humanOwner: string;
  agentExecutor: string;
  accountability: string;
  nextOperatorAction: string;
  continueVia: string | null;
};

export type RuntimeTriagePriorityV2 = "low" | "medium" | "high" | "urgent";

export type RuntimeTriageSummaryV2 = {
  owner: string | null;
  priority: RuntimeTriagePriorityV2 | null;
  riskLevel: RuntimeRunRiskLevelV2 | null;
  tags: string[];
  dedupeKey: string | null;
  summary: string;
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

export type RuntimeAutonomyProfileV2 = "supervised" | "night_operator";

export type RuntimeWakeActionV2 = "continue" | "approve" | "clarify" | "reroute" | "pair" | "hold";

export type RuntimeWakeStateV2 = "ready" | "attention" | "blocked";

export type RuntimeSourceScopeV2 =
  | "repository_only"
  | "workspace_graph"
  | "workspace_graph_and_public_web";

export type RuntimeResearchModeV2 = "repository_only" | "public_web" | "staged";

export type RuntimeQueueBudgetV2 = {
  maxQueuedActions?: number | null;
  maxRuntimeMinutes?: number | null;
  maxAutoContinuations?: number | null;
};

export type RuntimeWakePolicyV2 = {
  mode: "auto_queue" | "review_queue" | "hold";
  safeFollowUp: boolean;
  allowAutomaticContinuation: boolean;
  allowedActions: RuntimeWakeActionV2[];
  stopGates: string[];
  queueBudget?: RuntimeQueueBudgetV2 | null;
};

export type RuntimeResearchPolicyV2 = {
  mode: RuntimeResearchModeV2;
  allowNetworkAnalysis: boolean;
  requireCitations: boolean;
  allowPrivateContextStage: boolean;
};

export type RuntimeIntentSignalKindV2 =
  | "operator_intent"
  | "thread_history"
  | "repo_rule"
  | "task_source"
  | "recent_commit"
  | "validation_debt"
  | "review_debt"
  | "research";

export type RuntimeIntentSignalV2 = {
  kind: RuntimeIntentSignalKindV2;
  summary: string;
  source: string | null;
  confidence: "low" | "medium" | "high";
};

export type RuntimeIntentSnapshotV2 = {
  summary: string;
  primaryGoal: string | null;
  dominantDirection: string | null;
  confidence: "low" | "medium" | "high";
  signals: RuntimeIntentSignalV2[];
};

export type RuntimeOpportunityCandidateV2 = {
  id: string;
  title: string;
  summary: string;
  whySelected: string;
  whyNow: string;
  evidence: string[];
  risk: RuntimeRunRiskLevelV2;
  stopGates: string[];
  nextWakeAction: RuntimeWakeActionV2;
  score: number;
  confidence: "low" | "medium" | "high";
};

export type RuntimeOpportunityQueueV2 = {
  selectedOpportunityId: string | null;
  selectionSummary: string | null;
  candidates: RuntimeOpportunityCandidateV2[];
};

export type RuntimeResearchCitationV2 = {
  id: string;
  label: string;
  url?: string | null;
  sourceKind: "repo_doc" | "task_source" | "public_web" | "runtime_log";
  trustLevel: "primary" | "runtime" | "derived";
  claimSummary: string;
};

export type RuntimeResearchTraceV2 = {
  mode: RuntimeResearchModeV2;
  stage: "repository" | "public_web" | "private_context";
  summary: string;
  citations: RuntimeResearchCitationV2[];
  sensitiveContextMixed: boolean;
};

export type RuntimeExecutionEligibilityV2 = {
  eligible: boolean;
  summary: string;
  wakeState: RuntimeWakeStateV2;
  nextEligibleAction: RuntimeWakeActionV2;
  blockingReasons: string[];
};

export type RuntimeWakePolicySummaryV2 = {
  summary: string;
  safeFollowUp: boolean;
  allowedActions: RuntimeWakeActionV2[];
  queueBudget?: RuntimeQueueBudgetV2 | null;
};

export type RuntimeMissionPlanV2 = {
  planVersion: string;
  summary: string;
  currentMilestoneId: string | null;
  estimatedDurationMinutes: number | null;
  estimatedWorkerRuns: number | null;
  parallelismHint: string;
  clarifyingQuestions: string[];
  milestones: AgentTaskMissionPlanMilestone[];
  validationLanes: AgentTaskMissionValidationLane[];
  skillPlan: AgentTaskMissionSkillPlanItem[];
};

export type RuntimeAutonomyRequestV2 = {
  autonomyProfile: RuntimeAutonomyProfileV2;
  wakePolicy: RuntimeWakePolicyV2;
  sourceScope: RuntimeSourceScopeV2;
  researchPolicy: RuntimeResearchPolicyV2;
  queueBudget: RuntimeQueueBudgetV2;
};

export type RuntimeRunPrepareV2Response = {
  preparedAt: number;
  runIntent: RuntimeRunIntentBriefV2;
  contextWorkingSet: RuntimeContextWorkingSetV2;
  contextTruth: RuntimeContextTruthV2;
  guidanceStack: RuntimeGuidanceStackV2;
  triageSummary: RuntimeTriageSummaryV2;
  delegationContract: RuntimeDelegationContractV2;
  executionGraph: RuntimeExecutionGraphV2;
  approvalBatches: RuntimeApprovalBatchV2[];
  validationPlan: RuntimeValidationPlanV2;
  reviewFocus: string[];
  plan: RuntimeMissionPlanV2;
  autonomyProfile: RuntimeAutonomyProfileV2;
  wakePolicy: RuntimeWakePolicyV2;
  intentSnapshot: RuntimeIntentSnapshotV2;
  opportunityQueue: RuntimeOpportunityQueueV2;
  researchTrace: RuntimeResearchTraceV2;
  executionEligibility: RuntimeExecutionEligibilityV2;
  wakePolicySummary: RuntimeWakePolicySummaryV2;
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
  approvedPlanVersion?: string | null;
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

export type RuntimeRunSummary = AgentTaskSummary;

export type RuntimeRunRecordV2 = {
  run: RuntimeRunSummary;
  missionRun: HugeCodeRunSummary;
  reviewPack: HugeCodeReviewPackSummary | null;
  autonomyProfile?: RuntimeAutonomyProfileV2 | null;
  wakePolicy?: RuntimeWakePolicyV2 | null;
  intentSnapshot?: RuntimeIntentSnapshotV2 | null;
  opportunityQueue?: RuntimeOpportunityQueueV2 | null;
  researchTrace?: RuntimeResearchTraceV2 | null;
  executionEligibility?: RuntimeExecutionEligibilityV2 | null;
  wakeReason?: string | null;
  selectedOpportunityId?: string | null;
};

export type RuntimeRunStartV2Response = RuntimeRunRecordV2;

export type RuntimeRunGetV2Response = RuntimeRunRecordV2;

export type RuntimeRunSubscribeV2Response = RuntimeRunRecordV2 | null;

export type RuntimeRunCancelV2Response = RuntimeRunCancelAck;

export type RuntimeRunResumeV2Response = RuntimeRunRecordV2;

export type RuntimeRunInterventionV2Response = RuntimeRunRecordV2;

export type RuntimeReviewGetV2Response =
  | (HugeCodeReviewPackSummary & {
      autonomyProfile?: RuntimeAutonomyProfileV2 | null;
      wakePolicy?: RuntimeWakePolicyV2 | null;
      intentSnapshot?: RuntimeIntentSnapshotV2 | null;
      opportunityQueue?: RuntimeOpportunityQueueV2 | null;
      researchTrace?: RuntimeResearchTraceV2 | null;
      executionEligibility?: RuntimeExecutionEligibilityV2 | null;
      wakeReason?: string | null;
      selectedOpportunityId?: string | null;
    })
  | null;

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
