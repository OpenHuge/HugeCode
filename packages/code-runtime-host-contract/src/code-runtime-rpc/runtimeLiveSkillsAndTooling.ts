import type {
  RuntimeApprovalEvent,
  RuntimeCheckpointState,
  RuntimeCompactionSummary,
  RuntimeContextBoundarySummary,
  RuntimeContextProjectionSummary,
  RuntimeTakeoverBundle,
  SubAgentScopeProfile,
  SubAgentScopeProfileDescriptor,
} from "./runtimeRunsAndSubAgents.js";
import type { LiveSkillKind, LiveSkillSource } from "./liveSkillsShared.js";

export type { LiveSkillKind, LiveSkillSource } from "./liveSkillsShared.js";

export type LiveSkillSummary = {
  id: string;
  name: string;
  description: string;
  kind: LiveSkillKind;
  source: LiveSkillSource;
  version: string;
  enabled: boolean;
  supportsNetwork: boolean;
  permissions?: string[] | null;
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
  contextBoundary?: RuntimeContextBoundarySummary | null;
  contextProjection?: RuntimeContextProjectionSummary | null;
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
  contextBoundary?: RuntimeContextBoundarySummary | null;
  contextProjection?: RuntimeContextProjectionSummary | null;
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

export type PolicyReadiness = "ready" | "attention" | "blocked";

export type PolicyCapabilityEffect = "allow" | "approval" | "restricted" | "blocked";

export type PolicyCapabilityState = {
  capabilityId: string;
  label: string;
  readiness: PolicyReadiness;
  effect: PolicyCapabilityEffect;
  activeConstraint: boolean;
  summary: string;
  detail?: string | null;
};

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
  state: PolicyState;
};

export type RuntimePolicySetRequest = {
  mode: RuntimePolicyMode;
  actor?: string | null;
};

export type PolicyState = {
  readiness: PolicyReadiness;
  summary: string;
  activeConstraintCount: number;
  blockedCapabilityCount: number;
  capabilities: PolicyCapabilityState[];
};
