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

export type RuntimeContextMemoryRefKindV2 =
  | "repo_instruction_surface"
  | "task_source_digest"
  | "review_guidance"
  | "checkpoint_summary"
  | "operator_note";

export type RuntimeContextMemoryStorageV2 =
  | "workspace_manifest"
  | "runtime_memory"
  | "external_reference"
  | "review_pack";

export type RuntimeContextMemoryPersistenceScopeV2 =
  | "workspace"
  | "run"
  | "review_pack"
  | "cross_run";

export type RuntimeContextMemoryRefV2 = {
  id: string;
  label: string;
  kind: RuntimeContextMemoryRefKindV2;
  summary: string;
  storage: RuntimeContextMemoryStorageV2;
  persistenceScope: RuntimeContextMemoryPersistenceScopeV2;
  sourceRef?: string | null;
  updatedAt?: number | null;
};

export type RuntimeContextArtifactRefKindV2 =
  | "task_source_snapshot"
  | "validation_plan"
  | "review_pack"
  | "checkpoint_projection"
  | "diff_bundle";

export type RuntimeContextArtifactRefV2 = {
  id: string;
  label: string;
  kind: RuntimeContextArtifactRefKindV2;
  summary: string;
  mimeType?: string | null;
  locator?: string | null;
  sourceRef?: string | null;
};

export type RuntimeContextRefreshModeV2 = "on_prepare" | "on_resume" | "on_demand";

export type RuntimeContextRetentionModeV2 = "window_only" | "window_and_memory" | "memory_first";

export type RuntimeContextWorkingSetPolicyV2 = {
  selectionStrategy: RuntimeContextSelectionStrategyV2;
  toolExposureProfile: RuntimeContextToolExposureProfileV2;
  tokenBudgetTarget: number;
  refreshMode: RuntimeContextRefreshModeV2;
  retentionMode: RuntimeContextRetentionModeV2;
  preferColdFetch: boolean;
  compactBeforeDelegation: boolean;
};

export type RuntimeContextPlaneV2 = {
  summary: string;
  memoryRefs: RuntimeContextMemoryRefV2[];
  artifactRefs: RuntimeContextArtifactRefV2[];
  compactionSummary?: RuntimeCompactionSummary | null;
  workingSetPolicy: RuntimeContextWorkingSetPolicyV2;
};

export type RuntimeCapabilityKindV2 =
  | "workspace_read"
  | "workspace_write"
  | "network_fetch"
  | "validation"
  | "review_skill"
  | "runtime_tool"
  | "session_command"
  | "plugin";

export type RuntimeCapabilityReadinessV2 = "ready" | "attention" | "blocked" | "unsupported";

export type RuntimeCapabilitySafetyLevelV2 = "read" | "write" | "destructive";

export type RuntimeCapabilityDescriptorV2 = {
  id: string;
  label: string;
  summary: string;
  kind: RuntimeCapabilityKindV2;
  readiness: RuntimeCapabilityReadinessV2;
  safetyLevel: RuntimeCapabilitySafetyLevelV2;
  source: string | null;
  runtimeToolName?: string | null;
};

export type RuntimeCapabilityCatalogV2 = {
  summary: string;
  catalogId: string | null;
  generatedAt: number | null;
  capabilities: RuntimeCapabilityDescriptorV2[];
};

export type RuntimeSandboxFilesystemPolicyV2 = "workspace_scoped" | "read_only" | "host_managed";

export type RuntimeSandboxRefV2 = {
  id: string;
  label: string;
  summary: string;
  accessMode: AccessMode;
  executionProfileId: string | null;
  preferredBackendIds: string[];
  routedProvider: ModelProvider | null;
  networkPolicy: "default" | "restricted" | "offline" | null;
  filesystemPolicy: RuntimeSandboxFilesystemPolicyV2;
  toolPosture: string | null;
  approvalSensitivity: string | null;
};

export type RuntimeMcpSourceKindV2 = "remote_mcp" | "workspace_skill" | "runtime_extension";

export type RuntimeMcpSourceAuthorityV2 = "runtime" | "workspace" | "session";

export type RuntimeMcpSourceAvailabilityV2 = "ready" | "attention" | "blocked";

export type RuntimeMcpSourceV2 = {
  id: string;
  label: string;
  kind: RuntimeMcpSourceKindV2;
  authority: RuntimeMcpSourceAuthorityV2;
  availability: RuntimeMcpSourceAvailabilityV2;
  summary: string;
};

export type RuntimeToolCallRefStatusV2 = "planned" | "completed" | "blocked";

export type RuntimeToolCallRefV2 = {
  id: string;
  toolName: string;
  status: RuntimeToolCallRefStatusV2;
  summary: string;
  capabilityId?: string | null;
};

export type RuntimeToolResultRefV2 = {
  id: string;
  toolName: string;
  summary: string;
  artifactRefIds: string[];
  sourceCallId?: string | null;
};

export type RuntimeToolingPlaneV2 = {
  summary: string;
  capabilityCatalog: RuntimeCapabilityCatalogV2 | null;
  sandboxRef: RuntimeSandboxRefV2 | null;
  mcpSources: RuntimeMcpSourceV2[];
  toolCallRefs: RuntimeToolCallRefV2[];
  toolResultRefs: RuntimeToolResultRefV2[];
};

export type RuntimeKnowledgeItemKindV2 =
  | "repo_fact"
  | "session_recall"
  | "skill_hint"
  | "validation_hint"
  | "delegation_hint";

export type RuntimeKnowledgeItemScopeV2 =
  | "workspace"
  | "run"
  | "review_pack"
  | "sub_agent"
  | "takeover";

export type RuntimeKnowledgeItemConfidenceV2 = "low" | "medium" | "high";

export type RuntimeKnowledgeItemV2 = {
  id: string;
  kind: RuntimeKnowledgeItemKindV2;
  scope: RuntimeKnowledgeItemScopeV2;
  summary: string;
  detail?: string | null;
  provenance: string[];
  sourceRef?: string | null;
  confidence?: RuntimeKnowledgeItemConfidenceV2 | null;
  durable?: boolean | null;
};

export type RuntimeSkillCandidateStateV2 = "candidate" | "accepted" | "deferred" | "rejected";

export type RuntimeSkillCandidateV2 = {
  id: string;
  label: string;
  summary: string;
  state: RuntimeSkillCandidateStateV2;
  source: "run" | "review_pack" | "sub_agent";
  evidence: string[];
  proposedSkillId?: string | null;
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

export type RuntimeDelegationToolAccessModeV2 = "inherit_subset" | "read_only" | "scoped_write";

export type RuntimeDelegationToolAccessProfileV2 = {
  mode: RuntimeDelegationToolAccessModeV2;
  summary: string;
  allowedTools: string[];
  blockedTools?: string[] | null;
};

export type RuntimeDelegationBudgetInheritanceModeV2 = "inherit" | "bounded_subset" | "isolated";

export type RuntimeDelegationBudgetInheritanceV2 = {
  mode: RuntimeDelegationBudgetInheritanceModeV2;
  summary: string;
  inheritedBudgetRatio?: number | null;
  maxRuntimeMinutes?: number | null;
  maxAutoContinuations?: number | null;
};

export type RuntimeDelegationKnowledgeAccessModeV2 =
  | "runtime_scoped_read_only"
  | "runtime_scoped_cached"
  | "none";

export type RuntimeDelegationKnowledgeAccessV2 = {
  mode: RuntimeDelegationKnowledgeAccessModeV2;
  summary: string;
  sources: string[];
};

export type RuntimeSubAgentResultSummaryV2 = {
  summary: string;
  artifacts?: string[] | null;
  nextAction?: string | null;
};

export type RuntimeSubAgentFailureClassV2 =
  | "none"
  | "approval"
  | "budget"
  | "tooling"
  | "context"
  | "operator"
  | "unknown";

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
  delegationGroupId?: string | null;
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

export type RuntimeAuxiliaryExecutionTaskV2 =
  | "context_compaction"
  | "session_recall"
  | "skill_candidate_draft"
  | "research_summarization"
  | "browser_assessment";

export type RuntimeAuxiliaryExecutionModeV2 =
  | "auxiliary_preferred"
  | "primary_fallback"
  | "primary_only";

export type RuntimeAuxiliaryExecutionRouteV2 = {
  task: RuntimeAuxiliaryExecutionTaskV2;
  mode: RuntimeAuxiliaryExecutionModeV2;
  summary: string;
  provider?: ModelProvider | null;
  modelId?: string | null;
};

export type RuntimeAuxiliaryExecutionPolicyV2 = {
  enabled: boolean;
  summary: string;
  routes: RuntimeAuxiliaryExecutionRouteV2[];
  fallbackSummary: string;
};

export type RuntimeDelegationBatchStrategyV2 = "serial" | "parallel" | "speculative";

export type RuntimeDelegationMergeStrategyV2 =
  | "operator_review"
  | "runtime_summary"
  | "blocking_merge";

export type RuntimeDelegationBatchV2 = {
  id: string;
  summary: string;
  strategy: RuntimeDelegationBatchStrategyV2;
  mergeStrategy: RuntimeDelegationMergeStrategyV2;
  childRoles: string[];
  preferredBackendIds: string[];
};

export type RuntimeDelegationPlanV2 = {
  summary: string;
  fanOutReady: boolean;
  reviewRequired: boolean;
  childCount: number;
  batches: RuntimeDelegationBatchV2[];
};

export type RuntimeEvalCaseV2 = {
  id: string;
  label: string;
  taskFamily: string;
  summary: string;
  successEnvelope: string;
  modelBaseline: string;
  regressionBudget: string;
  source: "runtime_prepare" | "repository_contract" | "task_source";
  trackedWorkarounds: string[];
};

export type RuntimeEvalPlaneV2 = {
  summary: string;
  evalCases: RuntimeEvalCaseV2[];
  modelReleasePlaybook: string[];
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
  contextPlane?: RuntimeContextPlaneV2 | null;
  toolingPlane?: RuntimeToolingPlaneV2 | null;
  evalPlane?: RuntimeEvalPlaneV2 | null;
  guidanceStack: RuntimeGuidanceStackV2;
  triageSummary: RuntimeTriageSummaryV2;
  delegationContract: RuntimeDelegationContractV2;
  delegationPlan?: RuntimeDelegationPlanV2 | null;
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
  auxiliaryExecutionPolicy?: RuntimeAuxiliaryExecutionPolicyV2 | null;
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

export type RuntimeContextBoundaryTrigger =
  | "payload_bytes"
  | "consecutive_failures"
  | "session_length"
  | "tool_output"
  | "manual"
  | "sub_agent_spawn"
  | "resume"
  | "unknown";

export type RuntimeContextBoundaryPhase = "pre_turn" | "mid_turn" | "spawn" | "resume" | "manual";

export type RuntimeContextBoundaryStatus =
  | "pending"
  | "active"
  | "compacted"
  | "offloaded"
  | "failed";

export type RuntimeContextBoundarySummary = {
  boundaryId: string;
  trigger: RuntimeContextBoundaryTrigger;
  phase: RuntimeContextBoundaryPhase;
  status: RuntimeContextBoundaryStatus;
  preTokens?: number | null;
  postTokens?: number | null;
  preservedRangeIds?: string[] | null;
  summaryRef?: string | null;
  offloadRefs?: string[] | null;
  projectionFingerprint?: string | null;
  updatedAt?: number | null;
};

export type RuntimeContextProjectionSummary = {
  boundaryId: string;
  summaryRef?: string | null;
  projectionFingerprint?: string | null;
  preservedRangeIds?: string[] | null;
  recentSuffixRangeIds?: string[] | null;
  offloadRefs?: string[] | null;
  workingSetSummary?: string | null;
  knowledgeItems?: RuntimeKnowledgeItemV2[] | null;
  skillCandidates?: RuntimeSkillCandidateV2[] | null;
  updatedAt?: number | null;
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
  delegationScope?: string | null;
  toolAccessProfile?: RuntimeDelegationToolAccessProfileV2 | null;
  budgetInheritance?: RuntimeDelegationBudgetInheritanceV2 | null;
  knowledgeAccess?: RuntimeDelegationKnowledgeAccessV2 | null;
  contextBoundary?: RuntimeContextBoundarySummary | null;
  contextProjection?: RuntimeContextProjectionSummary | null;
  takeoverBundle?: RuntimeTakeoverBundle | null;
  approvalEvents?: RuntimeApprovalEvent[] | null;
  compactionSummary?: RuntimeCompactionSummary | null;
  resultSummary?: RuntimeSubAgentResultSummaryV2 | null;
  failureClass?: RuntimeSubAgentFailureClassV2 | null;
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
