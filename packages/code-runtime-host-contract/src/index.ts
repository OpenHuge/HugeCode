export const CODE_RUNTIME_HOST_REQUEST_KINDS = [
  "initialize",
  "health",
  "bootstrap",
  "sendTurn",
  "interruptTurn",
  "approvalDecision",
] as const;

export type CodeRuntimeHostRequestKind = (typeof CODE_RUNTIME_HOST_REQUEST_KINDS)[number];

export const CODE_RUNTIME_HOST_EVENT_KINDS = [
  "turn.started",
  "item.started",
  "item.updated",
  "item.completed",
  "item.agentMessage.delta",
  "item.mcpToolCall.progress",
  "approval.required",
  "approval.resolved",
  "turn.completed",
  "turn.failed",
  "native_state_fabric_updated",
  "thread.live_update",
  "thread.live_heartbeat",
  "thread.live_detached",
  "extension.updated",
  "session.portability.updated",
  "security.preflight.blocked",
] as const;

export type CodeRuntimeHostEventKind = (typeof CODE_RUNTIME_HOST_EVENT_KINDS)[number];

export const CODE_RUNTIME_HOST_APPROVAL_DECISIONS = ["approved", "rejected"] as const;

export type CodeRuntimeHostApprovalDecision = (typeof CODE_RUNTIME_HOST_APPROVAL_DECISIONS)[number];

export const CODE_RUNTIME_HOST_APPROVAL_RESOLUTION_STATUSES = [
  "approved",
  "rejected",
  "error",
  "interrupted",
  "resolved",
] as const;

export type CodeRuntimeHostApprovalResolutionStatus =
  (typeof CODE_RUNTIME_HOST_APPROVAL_RESOLUTION_STATUSES)[number];

export interface InitializeRequestPayload {
  protocolVersion: string;
  clientName?: string;
  clientVersion?: string;
  capabilities?: string[];
  metadata?: Record<string, unknown>;
}

export interface HealthRequestPayload {
  detail?: boolean;
}

export interface BootstrapRequestPayload {
  sessionId?: string;
  workspaceRoot?: string;
  options?: Record<string, unknown>;
}

export interface SendTurnRequestPayload {
  turnId: string;
  input: string;
  conversationId?: string;
  metadata?: Record<string, unknown>;
}

export interface InterruptTurnRequestPayload {
  turnId?: string;
  reason?: string;
}

export interface ApprovalDecisionRequestPayload {
  approvalId: string;
  decision: CodeRuntimeHostApprovalDecision;
  reason?: string;
}

export interface CodeRuntimeHostRequestPayloadByKind {
  initialize: InitializeRequestPayload;
  health: HealthRequestPayload;
  bootstrap: BootstrapRequestPayload;
  sendTurn: SendTurnRequestPayload;
  interruptTurn: InterruptTurnRequestPayload;
  approvalDecision: ApprovalDecisionRequestPayload;
}

export type CodeRuntimeHostRequestEnvelope<
  K extends CodeRuntimeHostRequestKind = CodeRuntimeHostRequestKind,
> = {
  kind: K;
  requestId: string;
  payload: CodeRuntimeHostRequestPayloadByKind[K];
};

export interface CodeRuntimeHostError {
  code: string;
  message: string;
  details?: unknown;
}

export type CodeRuntimeHostResponseEnvelope<Result = unknown> =
  | {
      ok: true;
      requestId: string;
      result: Result;
      error?: never;
    }
  | {
      ok: false;
      requestId: string;
      error: CodeRuntimeHostError;
      result?: never;
    };

export interface TurnStartedEventPayload {
  turnId: string;
  requestId?: string;
}

export interface RuntimeHostItemPayload {
  id: string;
  type: string;
  [key: string]: unknown;
}

export interface ItemStartedEventPayload {
  turnId: string;
  threadId?: string;
  itemId?: string;
  item?: RuntimeHostItemPayload;
}

export interface ItemUpdatedEventPayload {
  turnId: string;
  threadId?: string;
  itemId?: string;
  item: RuntimeHostItemPayload;
}

export type {
  HugeCodeApprovalSensitivity,
  HugeCodeApprovalStateKind,
  HugeCodeAutoDriveAutonomyPriority,
  HugeCodeAutoDriveAutonomyState,
  HugeCodeAutoDriveBudget,
  HugeCodeAutoDriveConfidence,
  HugeCodeAutoDriveContextPolicy,
  HugeCodeAutoDriveContextScope,
  HugeCodeAutoDriveContinuationPolicy,
  HugeCodeAutoDriveContinuationState,
  HugeCodeAutoDriveDecisionPolicy,
  HugeCodeAutoDriveDecisionScore,
  HugeCodeAutoDriveDecisionTrace,
  HugeCodeAutoDriveDestination,
  HugeCodeAutoDriveDoneDefinition,
  HugeCodeAutoDriveNavigation,
  HugeCodeAutoDriveOutcomeFeedback,
  HugeCodeAutoDrivePromptStrategy,
  HugeCodeAutoDriveRecoveryMarker,
  HugeCodeAutoDriveResearchMode,
  HugeCodeAutoDriveRiskPolicy,
  HugeCodeAutoDriveRoutePreference,
  HugeCodeAutoDriveScenarioProfile,
  HugeCodeAutoDriveState,
  HugeCodeAutoDriveStopReason,
  HugeCodeAutoDriveStopState,
  HugeCodeBackendContractSummary,
  HugeCodeCheckpointSummary,
  HugeCodeEvidenceState,
  HugeCodeExecutionAutonomy,
  HugeCodeExecutionEdgeSummary,
  HugeCodeExecutionGraphSummary,
  HugeCodeExecutionNodeSummary,
  HugeCodeExecutionProfile,
  HugeCodeExecutionProfileReadiness,
  HugeCodeExecutionRoutingStrategy,
  HugeCodeExecutionToolPosture,
  HugeCodeFailureClass,
  HugeCodeGovernanceAction,
  HugeCodeGovernanceStateKind,
  HugeCodeInterventionAction,
  HugeCodeInterventionAvailability,
  HugeCodeMissionActivityItem,
  HugeCodeMissionBrief,
  HugeCodeMissionBriefEvaluationPlan,
  HugeCodeMissionBriefPermissionSummary,
  HugeCodeMissionBriefScenarioProfile,
  HugeCodeMissionControlActivityTone,
  HugeCodeMissionControlReadinessSummary,
  HugeCodeMissionControlReadinessTone,
  HugeCodeMissionControlSnapshot,
  HugeCodeMissionControlSource,
  HugeCodeMissionControlSummary,
  HugeCodeMissionLineage,
  HugeCodeMissionLinkageSummary,
  HugeCodeMissionNavigationTarget,
  HugeCodeNextEligibleAction,
  HugeCodePlacementAttentionReason,
  HugeCodePlacementHealthSummary,
  HugeCodePlacementLifecycleState,
  HugeCodePlacementResolutionSource,
  HugeCodePublishHandoffReference,
  HugeCodeReviewActionAvailability,
  HugeCodeReviewActionabilityAction,
  HugeCodeReviewActionabilitySummary,
  HugeCodeReviewArtifactRef,
  HugeCodeReviewDecisionState,
  HugeCodeReviewDecisionSummary,
  HugeCodeReviewFinding,
  HugeCodeReviewFindingAnchor,
  HugeCodeReviewFindingCategory,
  HugeCodeReviewFindingConfidence,
  HugeCodeReviewFindingSeverity,
  HugeCodeReviewGateState,
  HugeCodeReviewGateSummary,
  HugeCodeReviewPack,
  HugeCodeReviewPackEvidenceRefs,
  HugeCodeReviewPackFileChangeSummary,
  HugeCodeReviewPackRelaunchOptions,
  HugeCodeReviewPackSummary,
  HugeCodeReviewQueueItem,
  HugeCodeReviewStatus,
  HugeCodeRelaunchContext,
  HugeCodeRoutingHealth,
  HugeCodeRun,
  HugeCodeRunApprovalSummary,
  HugeCodeRunGovernanceSummary,
  HugeCodeRunInterventionSummary,
  HugeCodeRunLedger,
  HugeCodeRunNextAction,
  HugeCodeRunOperatorEvent,
  HugeCodeRunOperatorEventKind,
  HugeCodeRunOperatorSnapshot,
  HugeCodeRunOperatorState,
  HugeCodeRunPlacementEvidence,
  HugeCodeRunRoutingSummary,
  HugeCodeRunState,
  HugeCodeRunSummary,
  HugeCodeSourceCitation,
  HugeCodeSubAgentApprovalState,
  HugeCodeSubAgentCheckpointState,
  HugeCodeSubAgentSummary,
  HugeCodeTakeoverBundle,
  HugeCodeTakeoverPathKind,
  HugeCodeTakeoverPrimaryAction,
  HugeCodeTakeoverState,
  HugeCodeTakeoverTarget,
  HugeCodeTask,
  HugeCodeTaskAccountability,
  HugeCodeTaskAccountabilityLifecycle,
  HugeCodeTaskMode,
  HugeCodeTaskModeSource,
  HugeCodeTaskOrigin,
  HugeCodeTaskSourceKind,
  HugeCodeTaskSourceLinkage,
  HugeCodeTaskSourceRepoContext,
  HugeCodeTaskSourceSummary,
  HugeCodeTaskStatus,
  HugeCodeTaskSummary,
  HugeCodeValidationOutcome,
  HugeCodeValidationSummary,
  HugeCodeWakeState,
  HugeCodeWorkspace,
  HugeCodeWorkspaceEvidence,
  HugeCodeWorkspaceEvidenceBucket,
  HugeCodeWorkspaceEvidenceBucketKind,
  HugeCodeWorkspaceEvidenceItem,
  HugeCodeRuntimeAutofixCandidate,
  HugeCodeRuntimeSkillUsageRecommendedFor,
  HugeCodeRuntimeSkillUsageSummary,
} from "./hugeCodeMissionControl";
export { HUGECODE_INTERVENTION_ACTIONS, HUGECODE_RUN_STATES } from "./hugeCodeMissionControl";
export type {
  HugeCodeOperatorAction,
  HugeCodeOperatorActionId,
  HugeCodeOperatorContinuationPathKind,
  HugeCodeOperatorContinuationPathLabel,
  HugeCodeOperatorContinuationState,
  HugeCodeOperatorContinuationSummary,
  HugeCodeOperatorLoopInput,
  HugeCodeOperatorTargetKind,
  HugeCodeOperatorTruthSource,
  HugeCodeReviewActionAvailabilityResolution,
} from "./hugeCodeOperatorLoop";
export {
  formatHugeCodeOperatorTruthSourceLabel,
  getHugeCodeReviewActionAvailability,
  resolveHugeCodeOperatorAction,
  resolveHugeCodeOperatorContinuePathLabel,
  resolveHugeCodeOperatorTarget,
  resolveHugeCodeOperatorTruthSource,
  resolvePreferredHugeCodePublishHandoff,
  resolvePreferredHugeCodeReviewActionability,
  summarizeHugeCodeOperatorContinuation,
} from "./hugeCodeOperatorLoop";

export interface ItemCompletedEventPayload {
  turnId: string;
  threadId?: string;
  itemId?: string;
  item?: RuntimeHostItemPayload;
}

export interface ItemAgentMessageDeltaEventPayload {
  turnId: string;
  threadId?: string;
  itemId?: string;
  delta: string;
  stepIndex?: number;
  transient?: boolean;
  coalesced?: boolean;
  chunkIndex?: number;
  queueDepth?: number;
  droppedChunks?: number;
  emitLagMs?: number;
}

export interface ItemMcpToolCallProgressEventPayload {
  turnId: string;
  threadId?: string;
  itemId: string;
  message: string;
}

export interface ApprovalRequiredEventPayload {
  approvalId: string;
  turnId?: string;
  reason?: string;
  action?: string;
  input?: unknown;
  approval?: {
    required?: boolean;
    requestReason?: string;
    requestSource?: string;
    scopeKind?: string;
    scopeKey?: string;
    scopeTarget?: string;
  };
}

export interface ApprovalResolvedEventPayload {
  approvalId: string;
  turnId?: string;
  status?: CodeRuntimeHostApprovalResolutionStatus;
  decision?: CodeRuntimeHostApprovalDecision;
  reason?: string;
  action?: string;
  approval?: {
    decision?: string;
    resolutionStatus?: string;
    resolutionReason?: string;
    resolutionAction?: string;
  };
}

export interface TurnCompletedEventPayload {
  turnId: string;
  output?: unknown;
  responseModelId?: string;
}

export interface TurnFailedEventPayload {
  turnId: string;
  error: CodeRuntimeHostError;
}

export interface RuntimeUpdatedObservabilityPayload {
  scope?: string;
  taskCounterMode?: string;
  snapshotAgeMs?: number;
  sourceRevision?: number;
  queueDepth?: number;
  stateFabricFanoutQueueDepth?: number;
  threadLiveUpdateFanoutQueueDepth?: number;
  taskCounterCacheHitTotal?: number;
  taskCounterCacheMissTotal?: number;
  taskCounterFullScanFallbackTotal?: number;
  stateFabricFanoutCoalescedTotal?: number;
  threadLiveUpdateFanoutCoalescedTotal?: number;
  backpressureLaggedTotal?: number;
  backpressureDroppedTotal?: number;
}

export interface RuntimeUpdatedEventPayload {
  revision: string;
  scope: string[];
  reason?: string;
  workspaceId?: string;
  updatedAt?: number;
  timestamp?: number;
  mode?: string;
  degraded?: boolean;
  checkpointWriteTotal?: number;
  checkpointWriteFailedTotal?: number;
  agentTaskCheckpointRecoverTotal?: number;
  subagentCheckpointRecoverTotal?: number;
  runtimeRecoveryInterruptTotal?: number;
  agentTaskResumeTotal?: number;
  agentTaskResumeFailedTotal?: number;
  lifecycleSweeperMode?: string;
  lifecycleLeaseLeader?: string;
  lifecycleLeaseState?: "holder" | "follower" | "degraded";
  lifecycleLastSweepAt?: number;
  lifecycleLastLeaseRenewAt?: number;
  lifecycleLastLeaseErrorCode?: string;
  deltaQueueDropTotal?: number;
  terminalizationCasNoopTotal?: number;
  staleWriteRejectedTotal?: number;
  streamGuardrailTrippedTotal?: number;
  observability?: RuntimeUpdatedObservabilityPayload;
}

export interface ThreadLiveUpdateEventPayload {
  workspaceId?: string;
  threadId: string;
  subscriptionId: string;
  reason?: string;
}

export interface ThreadLiveHeartbeatEventPayload {
  workspaceId?: string;
  threadId: string;
  subscriptionId: string;
  sentAtMs?: number;
  heartbeatIntervalMs?: number;
}

export interface ThreadLiveDetachedEventPayload {
  workspaceId?: string;
  threadId: string;
  subscriptionId: string;
  reason?: string;
}

export interface ExtensionUpdatedEventPayload {
  extensionId: string;
  workspaceId?: string | null;
  action: "installed" | "removed" | "updated";
  updatedAt: number;
}

export interface SessionPortabilityUpdatedEventPayload {
  workspaceId: string;
  threadId: string;
  operation: "export" | "import" | "delete";
  schemaVersion: string;
  updatedAt: number;
}

export interface SecurityPreflightBlockedEventPayload {
  workspaceId?: string | null;
  toolName?: string | null;
  command?: string | null;
  reason: string;
  action: "review" | "block";
  blockedAt: number;
}

export interface CodeRuntimeHostEventPayloadByKind {
  "turn.started": TurnStartedEventPayload;
  "item.started": ItemStartedEventPayload;
  "item.updated": ItemUpdatedEventPayload;
  "item.completed": ItemCompletedEventPayload;
  "item.agentMessage.delta": ItemAgentMessageDeltaEventPayload;
  "item.mcpToolCall.progress": ItemMcpToolCallProgressEventPayload;
  "approval.required": ApprovalRequiredEventPayload;
  "approval.resolved": ApprovalResolvedEventPayload;
  "turn.completed": TurnCompletedEventPayload;
  "turn.failed": TurnFailedEventPayload;
  native_state_fabric_updated: RuntimeUpdatedEventPayload;
  "thread.live_update": ThreadLiveUpdateEventPayload;
  "thread.live_heartbeat": ThreadLiveHeartbeatEventPayload;
  "thread.live_detached": ThreadLiveDetachedEventPayload;
  "extension.updated": ExtensionUpdatedEventPayload;
  "session.portability.updated": SessionPortabilityUpdatedEventPayload;
  "security.preflight.blocked": SecurityPreflightBlockedEventPayload;
}

export type CodeRuntimeHostEventEnvelope<
  K extends CodeRuntimeHostEventKind = CodeRuntimeHostEventKind,
> = {
  kind: K;
  payload: CodeRuntimeHostEventPayloadByKind[K];
  requestId?: string;
  emittedAt?: string;
};

export type CodeRuntimeHostParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

const REQUEST_KIND_SET: ReadonlySet<string> = new Set(CODE_RUNTIME_HOST_REQUEST_KINDS);
const EVENT_KIND_SET: ReadonlySet<string> = new Set(CODE_RUNTIME_HOST_EVENT_KINDS);
const APPROVAL_DECISION_SET: ReadonlySet<string> = new Set(CODE_RUNTIME_HOST_APPROVAL_DECISIONS);
const APPROVAL_RESOLUTION_STATUS_SET: ReadonlySet<string> = new Set(
  CODE_RUNTIME_HOST_APPROVAL_RESOLUTION_STATUSES
);
const LIFECYCLE_LEASE_STATE_SET: ReadonlySet<string> = new Set(["holder", "follower", "degraded"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function validateOptionalStringField(
  record: Record<string, unknown>,
  field: string,
  errors: string[]
): void {
  const value = record[field];
  if (value !== undefined && typeof value !== "string") {
    errors.push(`${field} must be a string when provided.`);
  }
}

function validateOptionalRecordField(
  record: Record<string, unknown>,
  field: string,
  errors: string[]
): void {
  const value = record[field];
  if (value !== undefined && !isRecord(value)) {
    errors.push(`${field} must be an object when provided.`);
  }
}

function validateOptionalStringArrayField(
  record: Record<string, unknown>,
  field: string,
  errors: string[]
): void {
  const value = record[field];
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    errors.push(`${field} must be a string array when provided.`);
  }
}

function validateOptionalNumberField(
  record: Record<string, unknown>,
  field: string,
  errors: string[]
): void {
  const value = record[field];
  if (value !== undefined && typeof value !== "number") {
    errors.push(`${field} must be a number when provided.`);
  }
}

function validateOptionalStringValue(value: unknown, fieldPath: string, errors: string[]): void {
  if (value !== undefined && typeof value !== "string") {
    errors.push(`${fieldPath} must be a string when provided.`);
  }
}

function validateOptionalNumberValue(value: unknown, fieldPath: string, errors: string[]): void {
  if (value !== undefined && typeof value !== "number") {
    errors.push(`${fieldPath} must be a number when provided.`);
  }
}

function validateOptionalBooleanField(
  record: Record<string, unknown>,
  field: string,
  errors: string[]
): void {
  const value = record[field];
  if (value !== undefined && typeof value !== "boolean") {
    errors.push(`${field} must be a boolean when provided.`);
  }
}

function validateRuntimeHostError(errorValue: unknown, fieldPath: string, errors: string[]): void {
  if (!isRecord(errorValue)) {
    errors.push(`${fieldPath} must be an object.`);
    return;
  }
  if (!isNonEmptyString(errorValue.code)) {
    errors.push(`${fieldPath}.code must be a non-empty string.`);
  }
  if (!isNonEmptyString(errorValue.message)) {
    errors.push(`${fieldPath}.message must be a non-empty string.`);
  }
}

function validateRequiredPayloadString(
  payload: Record<string, unknown>,
  field: string,
  errors: string[]
): void {
  if (!isNonEmptyString(payload[field])) {
    errors.push(`payload.${field} must be a non-empty string.`);
  }
}

function validateRequiredPayloadNumber(
  payload: Record<string, unknown>,
  field: string,
  errors: string[]
): void {
  if (typeof payload[field] !== "number") {
    errors.push(`payload.${field} must be a number.`);
  }
}

function validateRequestPayload(
  kind: CodeRuntimeHostRequestKind,
  payload: Record<string, unknown>,
  errors: string[]
): void {
  switch (kind) {
    case "initialize":
      if (!isNonEmptyString(payload.protocolVersion)) {
        errors.push("payload.protocolVersion must be a non-empty string.");
      }
      validateOptionalStringField(payload, "clientName", errors);
      validateOptionalStringField(payload, "clientVersion", errors);
      validateOptionalStringArrayField(payload, "capabilities", errors);
      validateOptionalRecordField(payload, "metadata", errors);
      break;
    case "health":
      if (payload.detail !== undefined && typeof payload.detail !== "boolean") {
        errors.push("payload.detail must be a boolean when provided.");
      }
      break;
    case "bootstrap":
      validateOptionalStringField(payload, "sessionId", errors);
      validateOptionalStringField(payload, "workspaceRoot", errors);
      validateOptionalRecordField(payload, "options", errors);
      break;
    case "sendTurn":
      if (!isNonEmptyString(payload.turnId)) {
        errors.push("payload.turnId must be a non-empty string.");
      }
      if (!isNonEmptyString(payload.input)) {
        errors.push("payload.input must be a non-empty string.");
      }
      validateOptionalStringField(payload, "conversationId", errors);
      validateOptionalRecordField(payload, "metadata", errors);
      break;
    case "interruptTurn":
      validateOptionalStringField(payload, "turnId", errors);
      validateOptionalStringField(payload, "reason", errors);
      break;
    case "approvalDecision":
      if (!isNonEmptyString(payload.approvalId)) {
        errors.push("payload.approvalId must be a non-empty string.");
      }
      if (typeof payload.decision !== "string" || !APPROVAL_DECISION_SET.has(payload.decision)) {
        errors.push("payload.decision must be one of: approved, rejected.");
      }
      validateOptionalStringField(payload, "reason", errors);
      break;
    default:
      break;
  }
}

type EventPayloadValidator = (payload: Record<string, unknown>, errors: string[]) => void;

function validateTurnStartedEventPayload(payload: Record<string, unknown>, errors: string[]): void {
  validateRequiredPayloadString(payload, "turnId", errors);
  validateOptionalStringField(payload, "requestId", errors);
}

function validateRuntimeHostItemPayload(
  itemValue: unknown,
  fieldPath: string,
  errors: string[]
): itemValue is Record<string, unknown> {
  if (!isRecord(itemValue)) {
    errors.push(`${fieldPath} must be an object.`);
    return false;
  }
  if (!isNonEmptyString(itemValue.id)) {
    errors.push(`${fieldPath}.id must be a non-empty string.`);
  }
  if (!isNonEmptyString(itemValue.type)) {
    errors.push(`${fieldPath}.type must be a non-empty string.`);
  }
  return true;
}

function validateOptionalItemLifecycleFields(
  payload: Record<string, unknown>,
  errors: string[]
): void {
  validateOptionalStringField(payload, "threadId", errors);
  validateOptionalStringField(payload, "itemId", errors);
}

function validateLegacyToolCallingFields(payload: Record<string, unknown>, errors: string[]): void {
  validateRequiredPayloadString(payload, "toolCallId", errors);
  validateRequiredPayloadString(payload, "toolName", errors);
  validateOptionalStringField(payload, "batchId", errors);
  validateOptionalNumberField(payload, "attempt", errors);
  validateOptionalStringField(payload, "checkpointId", errors);
  validateOptionalStringField(payload, "traceId", errors);
  validateOptionalBooleanField(payload, "recovered", errors);
}

function validateLegacyToolResultFields(payload: Record<string, unknown>, errors: string[]): void {
  validateLegacyToolCallingFields(payload, errors);
  if (typeof payload.ok !== "boolean") {
    errors.push("payload.ok must be a boolean.");
  }
  validateOptionalStringField(payload, "errorClass", errors);
  validateOptionalNumberField(payload, "durationMs", errors);
  if (payload.error !== undefined) {
    validateRuntimeHostError(payload.error, "payload.error", errors);
  }
}

function validateItemStartedEventPayload(payload: Record<string, unknown>, errors: string[]): void {
  validateRequiredPayloadString(payload, "turnId", errors);
  validateOptionalItemLifecycleFields(payload, errors);
  const hasItem = payload.item !== undefined;
  const hasLegacyToolFields = payload.toolCallId !== undefined || payload.toolName !== undefined;
  if (hasItem) {
    validateRuntimeHostItemPayload(payload.item, "payload.item", errors);
  }
  if (hasLegacyToolFields) {
    validateLegacyToolCallingFields(payload, errors);
  }
  if (!hasItem && !hasLegacyToolFields) {
    errors.push("payload.item must be an object.");
  }
}

function validateItemUpdatedEventPayload(payload: Record<string, unknown>, errors: string[]): void {
  validateRequiredPayloadString(payload, "turnId", errors);
  validateOptionalItemLifecycleFields(payload, errors);
  validateRuntimeHostItemPayload(payload.item, "payload.item", errors);
}

function validateItemCompletedEventPayload(
  payload: Record<string, unknown>,
  errors: string[]
): void {
  validateRequiredPayloadString(payload, "turnId", errors);
  validateOptionalItemLifecycleFields(payload, errors);
  const hasItem = payload.item !== undefined;
  const hasLegacyToolFields =
    payload.toolCallId !== undefined || payload.toolName !== undefined || payload.ok !== undefined;
  if (hasItem) {
    validateRuntimeHostItemPayload(payload.item, "payload.item", errors);
  }
  if (hasLegacyToolFields) {
    validateLegacyToolResultFields(payload, errors);
  }
  if (!hasItem && !hasLegacyToolFields) {
    errors.push("payload.item must be an object.");
  }
}

function validateItemAgentMessageDeltaEventPayload(
  payload: Record<string, unknown>,
  errors: string[]
): void {
  validateRequiredPayloadString(payload, "turnId", errors);
  validateOptionalItemLifecycleFields(payload, errors);
  if (typeof payload.delta !== "string") {
    errors.push("payload.delta must be a string.");
  }
  validateOptionalNumberField(payload, "stepIndex", errors);
  validateOptionalBooleanField(payload, "transient", errors);
  validateOptionalBooleanField(payload, "coalesced", errors);
  validateOptionalNumberField(payload, "chunkIndex", errors);
  validateOptionalNumberField(payload, "queueDepth", errors);
  validateOptionalNumberField(payload, "droppedChunks", errors);
  validateOptionalNumberField(payload, "emitLagMs", errors);
}

function validateItemMcpToolCallProgressEventPayload(
  payload: Record<string, unknown>,
  errors: string[]
): void {
  validateRequiredPayloadString(payload, "turnId", errors);
  validateOptionalStringField(payload, "threadId", errors);
  validateRequiredPayloadString(payload, "itemId", errors);
  if (typeof payload.message !== "string") {
    errors.push("payload.message must be a string.");
  }
}

function validateApprovalRequiredEventPayload(
  payload: Record<string, unknown>,
  errors: string[]
): void {
  validateRequiredPayloadString(payload, "approvalId", errors);
  validateOptionalStringField(payload, "turnId", errors);
  validateOptionalStringField(payload, "reason", errors);
  validateOptionalStringField(payload, "action", errors);
  if (payload.approval !== undefined) {
    if (!isRecord(payload.approval)) {
      errors.push("payload.approval must be an object.");
    } else {
      validateOptionalBooleanField(payload.approval, "required", errors);
      validateOptionalStringField(payload.approval, "requestReason", errors);
      validateOptionalStringField(payload.approval, "requestSource", errors);
      validateOptionalStringField(payload.approval, "scopeKind", errors);
      validateOptionalStringField(payload.approval, "scopeKey", errors);
      validateOptionalStringField(payload.approval, "scopeTarget", errors);
    }
  }
}

function validateApprovalResolvedEventPayload(
  payload: Record<string, unknown>,
  errors: string[]
): void {
  validateRequiredPayloadString(payload, "approvalId", errors);
  validateOptionalStringField(payload, "turnId", errors);
  if (
    payload.status !== undefined &&
    (typeof payload.status !== "string" || !APPROVAL_RESOLUTION_STATUS_SET.has(payload.status))
  ) {
    errors.push("payload.status must be one of: approved, rejected, error, interrupted, resolved.");
  }
  if (
    payload.decision !== undefined &&
    (typeof payload.decision !== "string" || !APPROVAL_DECISION_SET.has(payload.decision))
  ) {
    errors.push("payload.decision must be one of: approved, rejected.");
  }
  validateOptionalStringField(payload, "reason", errors);
  validateOptionalStringField(payload, "action", errors);
  if (payload.approval !== undefined) {
    if (!isRecord(payload.approval)) {
      errors.push("payload.approval must be an object.");
    } else {
      validateOptionalStringField(payload.approval, "decision", errors);
      validateOptionalStringField(payload.approval, "resolutionStatus", errors);
      validateOptionalStringField(payload.approval, "resolutionReason", errors);
      validateOptionalStringField(payload.approval, "resolutionAction", errors);
    }
  }
}

function validateTurnCompletedEventPayload(
  payload: Record<string, unknown>,
  errors: string[]
): void {
  validateRequiredPayloadString(payload, "turnId", errors);
  validateOptionalStringField(payload, "responseModelId", errors);
}

function validateTurnFailedEventPayload(payload: Record<string, unknown>, errors: string[]): void {
  validateRequiredPayloadString(payload, "turnId", errors);
  validateRuntimeHostError(payload.error, "payload.error", errors);
}

function validateRuntimeUpdatedEventPayload(
  payload: Record<string, unknown>,
  errors: string[]
): void {
  validateRequiredPayloadString(payload, "revision", errors);
  if (!Array.isArray(payload.scope) || payload.scope.some((entry) => typeof entry !== "string")) {
    errors.push("payload.scope must be a string array.");
  }
  validateOptionalStringField(payload, "reason", errors);
  validateOptionalStringField(payload, "workspaceId", errors);
  validateOptionalNumberField(payload, "updatedAt", errors);
  validateOptionalNumberField(payload, "timestamp", errors);
  validateOptionalStringField(payload, "mode", errors);
  validateOptionalBooleanField(payload, "degraded", errors);
  validateOptionalNumberField(payload, "checkpointWriteTotal", errors);
  validateOptionalNumberField(payload, "checkpointWriteFailedTotal", errors);
  validateOptionalNumberField(payload, "agentTaskCheckpointRecoverTotal", errors);
  validateOptionalNumberField(payload, "subagentCheckpointRecoverTotal", errors);
  validateOptionalNumberField(payload, "runtimeRecoveryInterruptTotal", errors);
  validateOptionalNumberField(payload, "agentTaskResumeTotal", errors);
  validateOptionalNumberField(payload, "agentTaskResumeFailedTotal", errors);
  validateOptionalStringField(payload, "lifecycleSweeperMode", errors);
  validateOptionalStringField(payload, "lifecycleLeaseLeader", errors);
  if (
    payload.lifecycleLeaseState !== undefined &&
    (typeof payload.lifecycleLeaseState !== "string" ||
      !LIFECYCLE_LEASE_STATE_SET.has(payload.lifecycleLeaseState))
  ) {
    errors.push("payload.lifecycleLeaseState must be one of: holder, follower, degraded.");
  }
  validateOptionalNumberField(payload, "lifecycleLastSweepAt", errors);
  validateOptionalNumberField(payload, "lifecycleLastLeaseRenewAt", errors);
  validateOptionalStringField(payload, "lifecycleLastLeaseErrorCode", errors);
  validateOptionalNumberField(payload, "deltaQueueDropTotal", errors);
  validateOptionalNumberField(payload, "terminalizationCasNoopTotal", errors);
  validateOptionalNumberField(payload, "staleWriteRejectedTotal", errors);
  validateOptionalNumberField(payload, "streamGuardrailTrippedTotal", errors);
  if (payload.observability !== undefined) {
    if (!isRecord(payload.observability)) {
      errors.push("payload.observability must be an object when provided.");
    } else {
      validateOptionalStringValue(
        payload.observability.scope,
        "payload.observability.scope",
        errors
      );
      validateOptionalStringValue(
        payload.observability.taskCounterMode,
        "payload.observability.taskCounterMode",
        errors
      );
      validateOptionalNumberValue(
        payload.observability.snapshotAgeMs,
        "payload.observability.snapshotAgeMs",
        errors
      );
      validateOptionalNumberValue(
        payload.observability.sourceRevision,
        "payload.observability.sourceRevision",
        errors
      );
      validateOptionalNumberValue(
        payload.observability.queueDepth,
        "payload.observability.queueDepth",
        errors
      );
      validateOptionalNumberValue(
        payload.observability.stateFabricFanoutQueueDepth,
        "payload.observability.stateFabricFanoutQueueDepth",
        errors
      );
      validateOptionalNumberValue(
        payload.observability.threadLiveUpdateFanoutQueueDepth,
        "payload.observability.threadLiveUpdateFanoutQueueDepth",
        errors
      );
      validateOptionalNumberValue(
        payload.observability.taskCounterCacheHitTotal,
        "payload.observability.taskCounterCacheHitTotal",
        errors
      );
      validateOptionalNumberValue(
        payload.observability.taskCounterCacheMissTotal,
        "payload.observability.taskCounterCacheMissTotal",
        errors
      );
      validateOptionalNumberValue(
        payload.observability.taskCounterFullScanFallbackTotal,
        "payload.observability.taskCounterFullScanFallbackTotal",
        errors
      );
      validateOptionalNumberValue(
        payload.observability.stateFabricFanoutCoalescedTotal,
        "payload.observability.stateFabricFanoutCoalescedTotal",
        errors
      );
      validateOptionalNumberValue(
        payload.observability.threadLiveUpdateFanoutCoalescedTotal,
        "payload.observability.threadLiveUpdateFanoutCoalescedTotal",
        errors
      );
      validateOptionalNumberValue(
        payload.observability.backpressureLaggedTotal,
        "payload.observability.backpressureLaggedTotal",
        errors
      );
      validateOptionalNumberValue(
        payload.observability.backpressureDroppedTotal,
        "payload.observability.backpressureDroppedTotal",
        errors
      );
    }
  }
}

function validateThreadLiveUpdateEventPayload(
  payload: Record<string, unknown>,
  errors: string[]
): void {
  validateOptionalStringField(payload, "workspaceId", errors);
  validateRequiredPayloadString(payload, "threadId", errors);
  validateRequiredPayloadString(payload, "subscriptionId", errors);
  validateOptionalStringField(payload, "reason", errors);
}

function validateThreadLiveHeartbeatEventPayload(
  payload: Record<string, unknown>,
  errors: string[]
): void {
  validateOptionalStringField(payload, "workspaceId", errors);
  validateRequiredPayloadString(payload, "threadId", errors);
  validateRequiredPayloadString(payload, "subscriptionId", errors);
  validateOptionalNumberField(payload, "sentAtMs", errors);
  validateOptionalNumberField(payload, "heartbeatIntervalMs", errors);
}

function validateThreadLiveDetachedEventPayload(
  payload: Record<string, unknown>,
  errors: string[]
): void {
  validateOptionalStringField(payload, "workspaceId", errors);
  validateRequiredPayloadString(payload, "threadId", errors);
  validateRequiredPayloadString(payload, "subscriptionId", errors);
  validateOptionalStringField(payload, "reason", errors);
}

function validateExtensionUpdatedEventPayload(
  payload: Record<string, unknown>,
  errors: string[]
): void {
  validateRequiredPayloadString(payload, "extensionId", errors);
  validateOptionalStringField(payload, "workspaceId", errors);
  if (
    typeof payload.action !== "string" ||
    !new Set(["installed", "removed", "updated"]).has(payload.action)
  ) {
    errors.push("payload.action must be one of: installed, removed, updated.");
  }
  validateRequiredPayloadNumber(payload, "updatedAt", errors);
}

function validateSessionPortabilityUpdatedEventPayload(
  payload: Record<string, unknown>,
  errors: string[]
): void {
  validateRequiredPayloadString(payload, "workspaceId", errors);
  validateRequiredPayloadString(payload, "threadId", errors);
  if (
    typeof payload.operation !== "string" ||
    !new Set(["export", "import", "delete"]).has(payload.operation)
  ) {
    errors.push("payload.operation must be one of: export, import, delete.");
  }
  validateRequiredPayloadString(payload, "schemaVersion", errors);
  validateRequiredPayloadNumber(payload, "updatedAt", errors);
}

function validateSecurityPreflightBlockedEventPayload(
  payload: Record<string, unknown>,
  errors: string[]
): void {
  validateOptionalStringField(payload, "workspaceId", errors);
  validateOptionalStringField(payload, "toolName", errors);
  validateOptionalStringField(payload, "command", errors);
  validateRequiredPayloadString(payload, "reason", errors);
  if (typeof payload.action !== "string" || !new Set(["review", "block"]).has(payload.action)) {
    errors.push("payload.action must be one of: review, block.");
  }
  validateRequiredPayloadNumber(payload, "blockedAt", errors);
}

const EVENT_PAYLOAD_VALIDATORS: Record<CodeRuntimeHostEventKind, EventPayloadValidator> = {
  "turn.started": validateTurnStartedEventPayload,
  "item.started": validateItemStartedEventPayload,
  "item.updated": validateItemUpdatedEventPayload,
  "item.completed": validateItemCompletedEventPayload,
  "item.agentMessage.delta": validateItemAgentMessageDeltaEventPayload,
  "item.mcpToolCall.progress": validateItemMcpToolCallProgressEventPayload,
  "approval.required": validateApprovalRequiredEventPayload,
  "approval.resolved": validateApprovalResolvedEventPayload,
  "turn.completed": validateTurnCompletedEventPayload,
  "turn.failed": validateTurnFailedEventPayload,
  native_state_fabric_updated: validateRuntimeUpdatedEventPayload,
  "thread.live_update": validateThreadLiveUpdateEventPayload,
  "thread.live_heartbeat": validateThreadLiveHeartbeatEventPayload,
  "thread.live_detached": validateThreadLiveDetachedEventPayload,
  "extension.updated": validateExtensionUpdatedEventPayload,
  "session.portability.updated": validateSessionPortabilityUpdatedEventPayload,
  "security.preflight.blocked": validateSecurityPreflightBlockedEventPayload,
};

function validateEventPayload(
  kind: CodeRuntimeHostEventKind,
  payload: Record<string, unknown>,
  errors: string[]
): void {
  EVENT_PAYLOAD_VALIDATORS[kind](payload, errors);
}

export function isCodeRuntimeHostRequestKind(value: unknown): value is CodeRuntimeHostRequestKind {
  return typeof value === "string" && REQUEST_KIND_SET.has(value);
}

export function isCodeRuntimeHostEventKind(value: unknown): value is CodeRuntimeHostEventKind {
  return typeof value === "string" && EVENT_KIND_SET.has(value);
}

export function validateCodeRuntimeHostRequestEnvelope(value: unknown): string[] {
  if (!isRecord(value)) {
    return ["Request envelope must be an object."];
  }

  const errors: string[] = [];
  if (!isCodeRuntimeHostRequestKind(value.kind)) {
    errors.push("kind must be a valid request kind.");
  }
  if (!isNonEmptyString(value.requestId)) {
    errors.push("requestId must be a non-empty string.");
  }
  if (!isRecord(value.payload)) {
    errors.push("payload must be an object.");
    return errors;
  }
  if (isCodeRuntimeHostRequestKind(value.kind)) {
    validateRequestPayload(value.kind, value.payload, errors);
  }

  return errors;
}

export function validateCodeRuntimeHostResponseEnvelope(value: unknown): string[] {
  if (!isRecord(value)) {
    return ["Response envelope must be an object."];
  }

  const errors: string[] = [];
  if (typeof value.ok !== "boolean") {
    errors.push("ok must be a boolean.");
  }
  if (!isNonEmptyString(value.requestId)) {
    errors.push("requestId must be a non-empty string.");
  }

  if (value.ok === true) {
    if (!("result" in value)) {
      errors.push("result is required when ok is true.");
    }
    if ("error" in value && value.error !== undefined) {
      errors.push("error must be omitted when ok is true.");
    }
  }

  if (value.ok === false) {
    validateRuntimeHostError(value.error, "error", errors);
    if ("result" in value && value.result !== undefined) {
      errors.push("result must be omitted when ok is false.");
    }
  }

  return errors;
}

export function validateCodeRuntimeHostEventEnvelope(value: unknown): string[] {
  if (!isRecord(value)) {
    return ["Event envelope must be an object."];
  }

  const errors: string[] = [];
  if (!isCodeRuntimeHostEventKind(value.kind)) {
    errors.push("kind must be a valid event kind.");
  }
  if (!isRecord(value.payload)) {
    errors.push("payload must be an object.");
    return errors;
  }
  if (value.requestId !== undefined && typeof value.requestId !== "string") {
    errors.push("requestId must be a string when provided.");
  }
  if (value.emittedAt !== undefined && !isIsoDateTime(value.emittedAt)) {
    errors.push("emittedAt must be an ISO-8601 timestamp when provided.");
  }
  if (isCodeRuntimeHostEventKind(value.kind)) {
    validateEventPayload(value.kind, value.payload, errors);
  }

  return errors;
}

export function isCodeRuntimeHostRequestEnvelope(
  value: unknown
): value is CodeRuntimeHostRequestEnvelope {
  return validateCodeRuntimeHostRequestEnvelope(value).length === 0;
}

export function isCodeRuntimeHostResponseEnvelope(
  value: unknown
): value is CodeRuntimeHostResponseEnvelope {
  return validateCodeRuntimeHostResponseEnvelope(value).length === 0;
}

export function isCodeRuntimeHostEventEnvelope(
  value: unknown
): value is CodeRuntimeHostEventEnvelope {
  return validateCodeRuntimeHostEventEnvelope(value).length === 0;
}

export function parseCodeRuntimeHostRequestEnvelope(
  value: unknown
): CodeRuntimeHostParseResult<CodeRuntimeHostRequestEnvelope> {
  const errors = validateCodeRuntimeHostRequestEnvelope(value);
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value: value as CodeRuntimeHostRequestEnvelope };
}

export function parseCodeRuntimeHostResponseEnvelope(
  value: unknown
): CodeRuntimeHostParseResult<CodeRuntimeHostResponseEnvelope> {
  const errors = validateCodeRuntimeHostResponseEnvelope(value);
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value: value as CodeRuntimeHostResponseEnvelope };
}

export function parseCodeRuntimeHostEventEnvelope(
  value: unknown
): CodeRuntimeHostParseResult<CodeRuntimeHostEventEnvelope> {
  const errors = validateCodeRuntimeHostEventEnvelope(value);
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value: value as CodeRuntimeHostEventEnvelope };
}

export type * from "./codeRuntimeRpc.js";
export type * from "./codeRuntimeRpcCompat.js";
export type * from "./hugeCodeMissionControl.js";
export { HUGECODE_INTERVENTION_ACTIONS, HUGECODE_RUN_STATES } from "./hugeCodeMissionControl.js";
export {
  buildCodeRuntimeRpcSpec,
  CODE_RUNTIME_RPC_CONTRACT_VERSION,
  CODE_RUNTIME_RPC_EMPTY_PARAMS,
  CODE_RUNTIME_RPC_ERROR_CODES,
  CODE_RUNTIME_RPC_FEATURES,
  CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT,
  CODE_RUNTIME_RPC_INVOCATION_COMPLETION_MODES,
  CODE_RUNTIME_RPC_METHOD_LIST,
  CODE_RUNTIME_RPC_METHODS,
  CODE_RUNTIME_RPC_TRANSPORTS,
  computeCodeRuntimeRpcMethodSetHash,
  isCodeRuntimeRpcMethod,
} from "./codeRuntimeRpc.js";
export {
  buildCodeRuntimeRpcCompatFields,
  cloneWithCodeRuntimeRpcCompatAliases,
  CODE_RUNTIME_PROVIDER_ALIAS_REGISTRY,
  CODE_RUNTIME_RPC_COMPAT_FIELD_ALIASES,
  CODE_RUNTIME_RPC_COMPAT_FIELD_LIFECYCLE,
  CODE_RUNTIME_RPC_COMPAT_FIELD_REGISTRY,
  CODE_RUNTIME_RPC_METHOD_LEGACY_ALIASES,
  canonicalizeModelPool,
  canonicalizeModelProvider,
  canonicalizeOAuthProviderId,
  inferCodeRuntimeRpcMethodNotFoundCodeFromMessage,
  isCodeRuntimeRpcMethodNotFoundErrorCode,
  listCodeRuntimeRpcAllMethods,
  listCodeRuntimeRpcMethodCandidates,
  resolveCodeRuntimeRpcMethod,
} from "./codeRuntimeRpcCompat.js";
