import type {
  HugeCodeContinuationSummary,
  HugeCodeNextOperatorAction,
  HugeCodeReviewPackSummary,
  HugeCodeRunSummary,
  HugeCodeRuntimeSessionBoundary,
  RuntimeCompactionSummary,
  RuntimeContextBoundarySummary,
  RuntimeContextProjectionSummary,
} from "@ku0/code-runtime-host-contract";
import type { RuntimeAgentTaskSummary as BaseRuntimeAgentTaskSummary } from "@ku0/code-runtime-webmcp-client/webMcpBridgeTypes";

/**
 * Type-only WebMCP surface for product consumers that should not depend on the
 * behavior port when they only need compile-time contracts.
 */
/**
 * Stable app-facing type surface for WebMCP-backed agent control.
 *
 * Product code should import types from here rather than from the bridge
 * behavior ports, so the runtime adapter can evolve without dragging type-only
 * consumers through behavior-layer compatibility shims.
 */
export type {
  AgentAuditCategory,
  AgentAuditLevel,
  AgentAuditLogEntry,
  AgentCommandCenterActions,
  AgentCommandCenterSnapshot,
  AgentGovernanceCycleReport,
  AgentGovernanceCycleSource,
  AgentGovernancePolicy,
  AgentIntentPriority,
  AgentIntentState,
  AgentProjectTask,
  AgentTaskPriority,
  AgentTaskStatus,
  RuntimeAgentAccessMode,
  RuntimeAgentApprovalDecision,
  RuntimeAgentApprovalDecisionInput,
  RuntimeAgentApprovalDecisionResult,
  RuntimeAgentControl,
  RuntimeAgentReasonEffort,
  RuntimeAgentTaskExecutionMode,
  RuntimeAgentTaskInterventionAction,
  RuntimeAgentTaskInterventionInput,
  RuntimeAgentTaskInterventionOutcome,
  RuntimeAgentTaskInterventionResult,
  RuntimeAgentTaskInterruptInput,
  RuntimeAgentTaskInterruptResult,
  RuntimeAgentTaskListInput,
  RuntimeAgentTaskResumeInput,
  RuntimeAgentTaskResumeResult,
  RuntimeAgentTaskStartInput,
  RuntimeAgentTaskStatus,
  RuntimeAgentTaskStepInput,
  RuntimeAgentTaskStepKind,
  RuntimeAllowedSkillResolution,
  RuntimeExecutableSkillCatalog,
  RuntimeExecutableSkillCatalogEntry,
  RuntimeExecutableSkillResolution,
  RuntimeSkillIdResolution,
  RuntimeSubAgentCloseInput,
  RuntimeSubAgentCloseResult,
  RuntimeSubAgentInterruptInput,
  RuntimeSubAgentInterruptResult,
  RuntimeSubAgentSendInput,
  RuntimeSubAgentSendResult,
  RuntimeSubAgentSessionHandle,
  RuntimeSubAgentSessionStatus,
  RuntimeSubAgentSessionSummary,
  RuntimeSubAgentStatusInput,
  RuntimeSubAgentWaitInput,
  RuntimeSubAgentWaitResult,
  UpsertTaskInput,
  WebMcpActiveModelContext,
  WebMcpAgent,
  WebMcpCallToolInput,
  WebMcpCapabilityMatrix,
  WebMcpCatalog,
  WebMcpCreateMessageInput,
  WebMcpElicitInput,
  WebMcpPromptDescriptor,
  WebMcpResourceDescriptor,
  WebMcpResponseRequiredState,
  WebMcpSyncOptions,
  WebMcpSyncResult,
} from "@ku0/code-runtime-webmcp-client/webMcpBridgeTypes";

export type RuntimeMissionRunSummary = HugeCodeRunSummary & {
  contextBoundary?: RuntimeContextBoundarySummary | null;
  contextProjection?: RuntimeContextProjectionSummary | null;
  compactionSummary?: RuntimeCompactionSummary | null;
};

export type RuntimeMissionReviewPackSummary = HugeCodeReviewPackSummary & {
  contextBoundary?: RuntimeContextBoundarySummary | null;
  contextProjection?: RuntimeContextProjectionSummary | null;
  compactionSummary?: RuntimeCompactionSummary | null;
};

export type RuntimeAgentTaskSummary = BaseRuntimeAgentTaskSummary & {
  sessionBoundary?: HugeCodeRuntimeSessionBoundary | null;
  continuation?: HugeCodeContinuationSummary | null;
  nextOperatorAction?: HugeCodeNextOperatorAction | null;
  contextBoundary?: RuntimeContextBoundarySummary | null;
  contextProjection?: RuntimeContextProjectionSummary | null;
  compactionSummary?: RuntimeCompactionSummary | null;
  runSummary?: RuntimeMissionRunSummary | null;
  reviewPackSummary?: RuntimeMissionReviewPackSummary | null;
};
