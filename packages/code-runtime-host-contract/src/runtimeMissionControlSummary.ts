import type {
  HugeCodeMissionActivityItem,
  HugeCodeMissionControlReadinessSummary,
  HugeCodeMissionControlSnapshot,
  HugeCodeMissionControlSummary,
  HugeCodeNextOperatorAction,
  HugeCodeReviewQueueItem,
  HugeCodeRunSummary,
} from "./hugeCodeMissionControl.js";
import {
  buildRuntimeContinuationDescriptor,
  buildRuntimeContinuationReadinessSummary,
  formatRuntimeContinuationStateLabel,
} from "./runtimeContinuationFacade.js";
import { resolveRuntimeNextOperatorAction } from "./runtimeTruthCompat.js";

export type RuntimeCapabilitiesSummaryLike = {
  mode: string;
  methods: readonly string[];
  features: readonly string[];
  wsEndpointPath: string | null;
  error: string | null;
};

export type RuntimeLaunchHealthResponseLike = {
  app: string;
  version: string;
  status: "ok";
};

export type RuntimeLaunchReadinessState = "ready" | "attention" | "blocked";

export type RuntimeLaunchReadinessRoute = {
  value: string;
  label: string;
  state: RuntimeLaunchReadinessState;
  ready: boolean;
  launchAllowed: boolean;
  detail: string | null;
  blockingReason?: string | null;
  recommendedAction?: string | null;
  fallbackDetail?: string | null;
  provenanceLabel?: string | null;
};

export type RuntimeLaunchReadinessSignal = {
  state: RuntimeLaunchReadinessState;
  label: string;
  detail: string;
};

type RuntimeLaunchReadinessRouteSignal = RuntimeLaunchReadinessSignal & {
  value: string;
  launchAllowed: boolean;
  blockingReason: string | null;
  recommendedAction: string | null;
  fallbackDetail: string | null;
  provenanceLabel: string | null;
};

export type RuntimeLaunchExecutionReliabilitySummary = {
  state: RuntimeLaunchReadinessState;
  blockingReason: string | null;
  recommendedAction: string;
  gate: {
    minSuccessRate: number;
    successRate: number | null;
    denominator: number;
    passed: boolean | null;
  };
  channelHealth: {
    status: "healthy" | "degraded" | "unavailable" | "unknown";
    reason: string | null;
    lastErrorCode: string | null;
    updatedAt: number | null;
    source: "guardrails" | "metrics" | "unavailable";
  };
  blockedTotal: number;
  topFailedReason: string | null;
  circuitBreakers: Array<{
    scope: "write" | "runtime" | "computer_observe";
    state: "closed" | "open" | "half_open";
    openedAt: number | null;
    updatedAt: number | null;
  }>;
};

export type RuntimeLaunchReadinessSummary = {
  state: RuntimeLaunchReadinessState;
  headline: string;
  blockingReason: string | null;
  recommendedAction: string;
  launchAllowed: boolean;
  route: RuntimeLaunchReadinessRouteSignal;
  runtime: RuntimeLaunchReadinessSignal;
  approvalPressure: RuntimeLaunchReadinessSignal & {
    pendingCount: number;
    staleCount: number;
  };
  executionReliability: RuntimeLaunchReadinessSignal & {
    gatePassed: boolean | null;
    channelStatus: RuntimeLaunchExecutionReliabilitySummary["channelHealth"]["status"];
    blockedTotal: number;
    topFailedReason: string | null;
    openCircuitBreakerScopes: RuntimeLaunchExecutionReliabilitySummary["circuitBreakers"][number]["scope"][];
  };
};

export const EMPTY_RUNTIME_MISSION_CONTROL_SUMMARY: HugeCodeMissionControlSummary = {
  workspaceLabel: "No workspace selected",
  tasksCount: 0,
  runsCount: 0,
  approvalCount: 0,
  reviewPacksCount: 0,
  connectedWorkspaceCount: 0,
  launchReadiness: {
    tone: "idle",
    label: "Launch readiness",
    detail: "Select a workspace to inspect runtime launch readiness.",
  },
  continuityReadiness: {
    tone: "idle",
    label: "Continuity readiness",
    detail: "Checkpoint and review continuity signals appear once runs are available.",
  },
  missionItems: [],
  reviewItems: [],
};

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function pushUnique(values: string[], next: string | null | undefined) {
  if (!next) {
    return;
  }
  if (!values.includes(next)) {
    values.push(next);
  }
}

function isRuntimeCapabilitiesSummaryLike(value: unknown): value is RuntimeCapabilitiesSummaryLike {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.mode === "string" &&
    Array.isArray(record.methods) &&
    Array.isArray(record.features) &&
    (typeof record.wsEndpointPath === "string" || record.wsEndpointPath === null) &&
    (typeof record.error === "string" || record.error === null)
  );
}

function isRuntimeLaunchHealthResponseLike(
  value: unknown
): value is RuntimeLaunchHealthResponseLike {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.app === "string" && typeof record.version === "string" && record.status === "ok"
  );
}

function maxLaunchState(
  left: RuntimeLaunchReadinessState,
  right: RuntimeLaunchReadinessState
): RuntimeLaunchReadinessState {
  if (left === "blocked" || right === "blocked") {
    return "blocked";
  }
  if (left === "attention" || right === "attention") {
    return "attention";
  }
  return "ready";
}

function buildRuntimeSignal(
  capabilitiesInput: unknown,
  healthInput: unknown,
  healthError: string | null
): RuntimeLaunchReadinessSignal {
  const capabilities = isRuntimeCapabilitiesSummaryLike(capabilitiesInput)
    ? capabilitiesInput
    : null;
  const health = isRuntimeLaunchHealthResponseLike(healthInput) ? healthInput : null;
  if (!capabilities || capabilities.mode === "unavailable" || capabilities.error) {
    const detail =
      capabilities?.error?.trim() || healthError?.trim() || "Runtime capabilities unavailable.";
    return {
      state: "blocked",
      label: "Runtime transport",
      detail,
    };
  }
  if (healthError?.trim()) {
    return {
      state: "attention",
      label: "Runtime health",
      detail: healthError.trim(),
    };
  }
  if (!health) {
    return {
      state: "attention",
      label: "Runtime health",
      detail: "Runtime health has not been confirmed yet.",
    };
  }
  return {
    state: "ready",
    label: "Runtime transport",
    detail: `${capabilities.mode} transport ready. Health status: ${health.status}.`,
  };
}

function buildRouteSignal(route: RuntimeLaunchReadinessRoute): RuntimeLaunchReadinessRouteSignal {
  const detail =
    route.detail?.trim() ||
    (route.state === "ready"
      ? "Selected route is ready for launch."
      : route.state === "attention"
        ? "Selected route can launch, but routing needs operator attention."
        : "Selected route is not ready.");
  return {
    value: route.value,
    state: route.state,
    label: route.label,
    detail,
    launchAllowed: route.launchAllowed,
    blockingReason: route.blockingReason?.trim() || null,
    recommendedAction: route.recommendedAction?.trim() || null,
    fallbackDetail: route.fallbackDetail?.trim() || null,
    provenanceLabel: route.provenanceLabel?.trim() || null,
  };
}

function buildApprovalPressureSignal(
  pendingApprovalCount: number,
  stalePendingApprovalCount: number
): RuntimeLaunchReadinessSummary["approvalPressure"] {
  if (stalePendingApprovalCount > 0) {
    return {
      state: "attention",
      label: "Approval pressure",
      detail: `${pendingApprovalCount} pending approvals, ${stalePendingApprovalCount} stale input request(s).`,
      pendingCount: pendingApprovalCount,
      staleCount: stalePendingApprovalCount,
    };
  }
  if (pendingApprovalCount > 0) {
    return {
      state: "attention",
      label: "Approval pressure",
      detail: `${pendingApprovalCount} pending approval or clarification request(s).`,
      pendingCount: pendingApprovalCount,
      staleCount: stalePendingApprovalCount,
    };
  }
  return {
    state: "ready",
    label: "Approval pressure",
    detail: "No pending approvals or clarifications are blocking launch.",
    pendingCount: pendingApprovalCount,
    staleCount: stalePendingApprovalCount,
  };
}

function buildExecutionReliabilitySignal(
  executionReliability: RuntimeLaunchExecutionReliabilitySummary
): RuntimeLaunchReadinessSummary["executionReliability"] {
  return {
    state: executionReliability.state,
    label: "Execution reliability",
    detail:
      executionReliability.blockingReason ??
      (executionReliability.state === "ready"
        ? "Runtime tool execution channel looks healthy for another launch."
        : executionReliability.recommendedAction),
    gatePassed: executionReliability.gate.passed,
    channelStatus: executionReliability.channelHealth.status,
    blockedTotal: executionReliability.blockedTotal,
    topFailedReason: executionReliability.topFailedReason,
    openCircuitBreakerScopes: executionReliability.circuitBreakers
      .filter((entry) => entry.state === "open")
      .map((entry) => entry.scope),
  };
}

export function buildRuntimeLaunchReadinessSummary(input: {
  capabilities: unknown;
  health: unknown;
  healthError: string | null;
  selectedRoute: RuntimeLaunchReadinessRoute;
  executionReliability: RuntimeLaunchExecutionReliabilitySummary;
  pendingApprovalCount: number;
  stalePendingApprovalCount: number;
}): RuntimeLaunchReadinessSummary {
  const runtime = buildRuntimeSignal(input.capabilities, input.health, input.healthError);
  const route = buildRouteSignal(input.selectedRoute);
  const approvalPressure = buildApprovalPressureSignal(
    input.pendingApprovalCount,
    input.stalePendingApprovalCount
  );
  const executionReliability = buildExecutionReliabilitySignal(input.executionReliability);
  const state = maxLaunchState(
    maxLaunchState(maxLaunchState(runtime.state, route.state), executionReliability.state),
    approvalPressure.state
  );
  const blockingReason =
    runtime.state === "blocked"
      ? runtime.detail
      : route.state === "blocked"
        ? (route.blockingReason ?? route.detail)
        : executionReliability.state === "blocked"
          ? executionReliability.detail
          : null;

  let recommendedAction = "Runtime looks healthy. You can launch this run now.";
  if (runtime.state === "blocked") {
    recommendedAction =
      "Reconnect to the runtime or restore runtime capabilities before launching.";
  } else if (route.state === "blocked") {
    recommendedAction =
      route.recommendedAction ??
      "Fix the selected route or switch to a ready route before launching.";
  } else if (executionReliability.state !== "ready") {
    recommendedAction = input.executionReliability.recommendedAction;
  } else if (route.state === "attention") {
    recommendedAction =
      route.recommendedAction ??
      "Inspect routing attention before launching, even though a viable route is still available.";
  } else if (input.stalePendingApprovalCount > 0) {
    recommendedAction =
      "Resolve or interrupt stale input requests before launching more work into the queue.";
  } else if (input.pendingApprovalCount > 0) {
    recommendedAction = "Review the approval backlog before launching more work.";
  }

  return {
    state,
    headline:
      state === "ready"
        ? "Launch readiness confirmed"
        : state === "blocked"
          ? "Launch readiness blocked"
          : "Launch readiness needs attention",
    blockingReason,
    recommendedAction,
    launchAllowed: state !== "blocked",
    runtime,
    route,
    approvalPressure,
    executionReliability,
  };
}

function resolveRunContinuationDescriptor(run: HugeCodeRunSummary) {
  return buildRuntimeContinuationDescriptor({
    runState: run.state,
    checkpoint: run.checkpoint ?? null,
    continuation: run.continuation ?? null,
    missionLinkage: run.missionLinkage ?? null,
    actionability: run.actionability ?? null,
    publishHandoff: run.publishHandoff ?? null,
    takeoverBundle: run.takeoverBundle ?? null,
    nextAction: run.nextAction ?? null,
    reviewPackId: run.reviewPackId ?? null,
  });
}

function resolveRunNextOperatorAction(run: HugeCodeRunSummary): HugeCodeNextOperatorAction | null {
  if (run.nextOperatorAction) {
    return run.nextOperatorAction;
  }
  return resolveRuntimeNextOperatorAction({
    workspaceId: run.workspaceId,
    taskId: run.taskId,
    runId: run.id,
    reviewPackId: run.reviewPackId ?? null,
    state: run.state,
    approval: run.approval ?? null,
    reviewDecision: run.reviewDecision ?? null,
    nextAction: run.nextAction ?? null,
    checkpoint: run.checkpoint ?? null,
    missionLinkage: run.missionLinkage ?? null,
    actionability: run.actionability ?? null,
    publishHandoff: run.publishHandoff ?? null,
    takeoverBundle: run.takeoverBundle ?? null,
    sessionBoundary: run.sessionBoundary ?? null,
    continuation: run.continuation ?? null,
    nextOperatorAction: null,
  });
}

function buildSharedLaunchReadiness(
  hasActiveWorkspace: boolean,
  activeWorkspaceConnected: boolean,
  runs: HugeCodeMissionControlSnapshot["runs"]
): HugeCodeMissionControlReadinessSummary {
  if (!hasActiveWorkspace) {
    return EMPTY_RUNTIME_MISSION_CONTROL_SUMMARY.launchReadiness;
  }
  if (!activeWorkspaceConnected) {
    return {
      tone: "blocked",
      label: "Launch readiness",
      detail: "The selected workspace is not connected to the runtime.",
    };
  }
  if (runs.length === 0) {
    return {
      tone: "attention",
      label: "Launch readiness",
      detail: "The workspace is connected, but no runtime runs have reported placement yet.",
    };
  }
  const blockedRuns = runs.filter((run) => {
    if (run.placement?.healthSummary === "placement_blocked") {
      return true;
    }
    if (run.routing?.backendOperability?.state === "blocked") {
      return true;
    }
    return run.placement?.readiness === "blocked" || run.routing?.health === "blocked";
  });
  if (blockedRuns.length > 0) {
    const firstBlocked = blockedRuns[0];
    const blockedDetail =
      firstBlocked?.placement?.summary ??
      firstBlocked?.routing?.routeHint ??
      firstBlocked?.summary ??
      "Runtime placement is blocked.";
    return {
      tone: "blocked",
      label: "Launch readiness",
      detail: `${pluralize(blockedRuns.length, "run")} are blocked by routing or backend operability. First: ${blockedDetail}`,
    };
  }
  const attentionRuns = runs.filter((run) => {
    if (run.placement?.lifecycleState === "fallback") {
      return true;
    }
    if (run.placement?.healthSummary === "placement_attention") {
      return true;
    }
    if (run.routing?.backendOperability?.state === "attention") {
      return true;
    }
    return run.placement?.readiness === "attention" || run.routing?.health === "attention";
  });
  if (attentionRuns.length > 0) {
    const firstAttention = attentionRuns[0];
    const attentionDetail =
      firstAttention?.placement?.summary ??
      firstAttention?.routing?.routeHint ??
      firstAttention?.summary ??
      "Runtime placement needs operator inspection.";
    return {
      tone: "attention",
      label: "Launch readiness",
      detail: `${pluralize(attentionRuns.length, "run")} need routing review before the next launch. First: ${attentionDetail}`,
    };
  }
  return {
    tone: "ready",
    label: "Launch readiness",
    detail:
      "Connected routing and backend operability are healthy for the current workspace slice.",
  };
}

function buildSharedContinuityReadiness(
  hasActiveWorkspace: boolean,
  activeWorkspaceConnected: boolean,
  runs: HugeCodeMissionControlSnapshot["runs"]
): HugeCodeMissionControlReadinessSummary {
  if (!hasActiveWorkspace) {
    return EMPTY_RUNTIME_MISSION_CONTROL_SUMMARY.continuityReadiness;
  }
  if (!activeWorkspaceConnected) {
    return {
      tone: "blocked",
      label: "Continuity readiness",
      detail:
        "The selected workspace must connect before checkpoint or review continuity can recover.",
    };
  }
  const readiness = buildRuntimeContinuationReadinessSummary({
    candidates: runs.map((run) => ({
      runId: run.id,
      taskId: run.taskId,
      runState: run.state,
      checkpoint: run.checkpoint ?? null,
      continuation: run.continuation ?? null,
      missionLinkage: run.missionLinkage ?? null,
      actionability: run.actionability ?? null,
      publishHandoff: run.publishHandoff ?? null,
      takeoverBundle: run.takeoverBundle ?? null,
      nextAction: run.nextAction ?? null,
      reviewPackId: run.reviewPackId ?? null,
    })),
  });
  return {
    tone: readiness.state,
    label: "Continuity readiness",
    detail: readiness.detail,
  };
}

function getWorkspaceName(
  workspaces: HugeCodeMissionControlSnapshot["workspaces"],
  workspaceId: string
) {
  return workspaces.find((workspace) => workspace.id === workspaceId)?.name ?? workspaceId;
}

function getMissionItemTone(run: HugeCodeRunSummary): HugeCodeMissionActivityItem["tone"] {
  const continuation = resolveRunContinuationDescriptor(run);
  if (run.placement?.readiness === "blocked" || continuation?.state === "blocked") {
    return "blocked";
  }
  if (run.approval?.status === "pending_decision" || run.state === "needs_input") {
    return "attention";
  }
  if (run.placement?.readiness === "attention" || continuation?.state === "attention") {
    return "attention";
  }
  if (run.state === "running") {
    return "active";
  }
  if (
    run.reviewPackId ||
    continuation?.pathKind === "review" ||
    resolveRunNextOperatorAction(run)?.action === "open_review_pack"
  ) {
    return "ready";
  }
  return "neutral";
}

function getMissionStatusLabel(run: HugeCodeRunSummary) {
  const continuation = resolveRunContinuationDescriptor(run);
  const nextOperatorAction = resolveRunNextOperatorAction(run);
  if (run.placement?.readiness === "blocked") {
    return "Routing blocked";
  }
  if (continuation?.state === "blocked") {
    return "Continuation blocked";
  }
  if (run.approval?.label) {
    return run.approval.label;
  }
  if (continuation?.state === "ready") {
    if (continuation.pathKind === "resume") {
      return "Resume ready";
    }
    if (continuation.pathKind === "handoff") {
      return "Handoff ready";
    }
    if (continuation.pathKind === "review") {
      return "Review ready";
    }
  }
  if (run.state === "running") {
    return "In progress";
  }
  if (run.state === "needs_input") {
    return "Needs input";
  }
  if (nextOperatorAction?.action === "open_review_pack" || run.reviewPackId) {
    return "Review ready";
  }
  return run.state.replace(/_/g, " ");
}

function resolveMissionItemDetail(run: HugeCodeRunSummary) {
  const continuation = resolveRunContinuationDescriptor(run);
  const nextOperatorAction = resolveRunNextOperatorAction(run);
  return (
    run.approval?.summary ??
    nextOperatorAction?.detail ??
    nextOperatorAction?.label ??
    continuation?.canonicalNextAction.detail ??
    continuation?.recommendedAction ??
    continuation?.summary ??
    run.summary ??
    run.placement?.summary ??
    run.actionability?.summary ??
    "Runtime-backed mission status is available for this run."
  );
}

function buildMissionItemHighlights(run: HugeCodeRunSummary) {
  const highlights: string[] = [];
  const continuation = resolveRunContinuationDescriptor(run);
  const nextOperatorAction = resolveRunNextOperatorAction(run);
  pushUnique(highlights, nextOperatorAction?.label ? `Next: ${nextOperatorAction.label}` : null);
  pushUnique(highlights, continuation?.summary ?? null);
  pushUnique(highlights, run.checkpoint?.summary ?? null);
  pushUnique(highlights, run.publishHandoff?.summary ?? null);
  pushUnique(highlights, run.actionability?.summary ?? null);
  return highlights.slice(0, 3);
}

function getMissionActivityPriority(run: HugeCodeRunSummary) {
  const continuation = resolveRunContinuationDescriptor(run);
  if (run.placement?.readiness === "blocked" || continuation?.state === "blocked") {
    return 600;
  }
  if (run.approval?.status === "pending_decision" || run.state === "needs_input") {
    return 520;
  }
  if (run.placement?.readiness === "attention" || continuation?.state === "attention") {
    return 440;
  }
  if (run.state === "running") {
    return 360;
  }
  if (run.reviewPackId || continuation?.pathKind === "review") {
    return 280;
  }
  return 120;
}

function buildMissionActivityItems(
  workspaces: HugeCodeMissionControlSnapshot["workspaces"],
  runs: HugeCodeMissionControlSnapshot["runs"]
): HugeCodeMissionActivityItem[] {
  return [...runs]
    .sort(
      (left, right) =>
        getMissionActivityPriority(right) - getMissionActivityPriority(left) ||
        right.updatedAt - left.updatedAt
    )
    .slice(0, 6)
    .map((run) => ({
      id: run.id,
      title: run.title || "Untitled run",
      workspaceName: getWorkspaceName(workspaces, run.workspaceId),
      statusLabel: getMissionStatusLabel(run),
      tone: getMissionItemTone(run),
      detail: resolveMissionItemDetail(run),
      highlights: buildMissionItemHighlights(run),
    }));
}

function formatReviewStatusLabel(reviewStatus: string) {
  if (reviewStatus === "ready") {
    return "Ready";
  }
  return reviewStatus.replace(/_/g, " ");
}

function getHighestReviewSeverity(
  reviewPack: HugeCodeMissionControlSnapshot["reviewPacks"][number]
) {
  return reviewPack.reviewGate?.highestSeverity ?? reviewPack.reviewFindings?.[0]?.severity ?? null;
}

function resolveReviewPackContinuityDescriptor(
  reviewPack: HugeCodeMissionControlSnapshot["reviewPacks"][number]
) {
  return buildRuntimeContinuationDescriptor({
    checkpoint: reviewPack.checkpoint ?? null,
    continuation: reviewPack.continuation ?? null,
    missionLinkage: reviewPack.missionLinkage ?? null,
    actionability: reviewPack.actionability ?? null,
    publishHandoff: reviewPack.publishHandoff ?? null,
    takeoverBundle: reviewPack.takeoverBundle ?? null,
    reviewPackId: reviewPack.id,
  });
}

function hasCriticalReviewSignal(
  reviewPack: HugeCodeMissionControlSnapshot["reviewPacks"][number]
) {
  return (
    reviewPack.validationOutcome === "failed" ||
    reviewPack.reviewStatus === "action_required" ||
    reviewPack.reviewDecision?.status === "rejected" ||
    reviewPack.reviewGate?.state === "fail" ||
    reviewPack.reviewGate?.state === "blocked" ||
    getHighestReviewSeverity(reviewPack) === "critical"
  );
}

function getReviewPackContinuityState(
  descriptor: ReturnType<typeof resolveReviewPackContinuityDescriptor>
) {
  if (descriptor?.state === "blocked") {
    return "blocked";
  }
  if (descriptor?.state === "attention") {
    return "attention";
  }
  return null;
}

function hasAutofixReadySignal(reviewPack: HugeCodeMissionControlSnapshot["reviewPacks"][number]) {
  return reviewPack.autofixCandidate?.status === "available";
}

function hasNeedsAttentionSignal(
  reviewPack: HugeCodeMissionControlSnapshot["reviewPacks"][number]
) {
  return (
    reviewPack.reviewStatus === "incomplete_evidence" ||
    reviewPack.validationOutcome === "warning" ||
    reviewPack.placement?.resolutionSource === "runtime_fallback" ||
    reviewPack.placement?.lifecycleState === "fallback"
  );
}

function resolveReviewQueuePriorityBand(input: {
  reviewPack: HugeCodeMissionControlSnapshot["reviewPacks"][number];
  continuityState: "blocked" | "attention" | null;
}) {
  if (hasCriticalReviewSignal(input.reviewPack)) {
    return 4;
  }
  if (input.continuityState) {
    return 3;
  }
  if (hasAutofixReadySignal(input.reviewPack)) {
    return 2;
  }
  if (hasNeedsAttentionSignal(input.reviewPack)) {
    return 1;
  }
  return 0;
}

function getReviewStatusLabel(
  reviewPack: HugeCodeMissionControlSnapshot["reviewPacks"][number],
  continuityState: "blocked" | "attention" | null
) {
  if (reviewPack.validationOutcome === "failed") {
    return "Validation failed";
  }
  if (hasCriticalReviewSignal(reviewPack)) {
    return "Critical review";
  }
  if (continuityState === "blocked") {
    return formatRuntimeContinuationStateLabel("blocked");
  }
  if (continuityState === "attention") {
    return formatRuntimeContinuationStateLabel("attention");
  }
  if (hasAutofixReadySignal(reviewPack)) {
    return "Autofix ready";
  }
  if (hasNeedsAttentionSignal(reviewPack)) {
    return "Needs attention";
  }
  if (reviewPack.reviewStatus === "ready") {
    return "Ready";
  }
  if (reviewPack.continuation?.pathKind === "review") {
    return "Review ready";
  }
  return formatReviewStatusLabel(reviewPack.reviewStatus);
}

function formatValidationLabel(validationOutcome: string) {
  if (validationOutcome === "passed") {
    return "Passed";
  }
  if (validationOutcome === "failed") {
    return "Failed";
  }
  return validationOutcome.replace(/_/g, " ");
}

function getReviewItemTone(
  reviewPack: HugeCodeMissionControlSnapshot["reviewPacks"][number],
  continuityState: "blocked" | "attention" | null
): HugeCodeReviewQueueItem["tone"] {
  if (
    reviewPack.validationOutcome === "failed" ||
    reviewPack.reviewGate?.state === "fail" ||
    reviewPack.reviewGate?.state === "blocked" ||
    reviewPack.reviewDecision?.status === "rejected" ||
    continuityState === "blocked"
  ) {
    return "blocked";
  }
  if (
    hasCriticalReviewSignal(reviewPack) ||
    continuityState === "attention" ||
    hasAutofixReadySignal(reviewPack) ||
    hasNeedsAttentionSignal(reviewPack)
  ) {
    return "attention";
  }
  if (reviewPack.reviewStatus === "ready" || reviewPack.continuation?.pathKind === "review") {
    return "ready";
  }
  return "neutral";
}

function resolveReviewQueueSummary(
  reviewPack: HugeCodeMissionControlSnapshot["reviewPacks"][number],
  continuityDescriptor: ReturnType<typeof resolveReviewPackContinuityDescriptor>
) {
  if (reviewPack.validationOutcome === "failed") {
    return (
      reviewPack.reviewGate?.blockingReason ??
      reviewPack.reviewGate?.summary ??
      reviewPack.reviewFindings?.[0]?.summary ??
      reviewPack.recommendedNextAction ??
      reviewPack.summary ??
      "Validation failed and operator review is required."
    );
  }
  if (hasCriticalReviewSignal(reviewPack)) {
    return (
      reviewPack.reviewGate?.blockingReason ??
      reviewPack.reviewGate?.summary ??
      reviewPack.reviewFindings?.[0]?.summary ??
      reviewPack.recommendedNextAction ??
      reviewPack.summary ??
      "Critical review findings need operator action."
    );
  }
  if (
    continuityDescriptor &&
    (continuityDescriptor.state === "blocked" || continuityDescriptor.state === "attention")
  ) {
    return (
      continuityDescriptor.canonicalNextAction.detail ??
      continuityDescriptor.blockingReason ??
      continuityDescriptor.recommendedAction ??
      continuityDescriptor.summary ??
      reviewPack.recommendedNextAction ??
      reviewPack.summary ??
      "Runtime continuity needs operator attention."
    );
  }
  if (hasAutofixReadySignal(reviewPack)) {
    return (
      reviewPack.autofixCandidate?.summary ??
      reviewPack.recommendedNextAction ??
      reviewPack.summary ??
      "Runtime prepared an autofix candidate for this review."
    );
  }
  return (
    continuityDescriptor?.canonicalNextAction.detail ??
    continuityDescriptor?.recommendedAction ??
    continuityDescriptor?.summary ??
    reviewPack.recommendedNextAction ??
    reviewPack.summary ??
    "Review-ready evidence is available."
  );
}

function computeReviewQueuePriority(input: {
  reviewPack: HugeCodeMissionControlSnapshot["reviewPacks"][number];
  continuityDescriptor: ReturnType<typeof resolveReviewPackContinuityDescriptor>;
  continuityState: "blocked" | "attention" | null;
}) {
  const priorityBand = resolveReviewQueuePriorityBand(input);
  if (priorityBand > 0) {
    return (
      priorityBand * 200 +
      Math.min(input.reviewPack.warningCount, 9) * 5 +
      Math.min(
        input.reviewPack.reviewGate?.findingCount ?? input.reviewPack.reviewFindings?.length ?? 0,
        9
      )
    );
  }
  if (
    input.reviewPack.reviewStatus === "ready" ||
    input.reviewPack.continuation?.pathKind === "review" ||
    input.continuityDescriptor?.state === "ready"
  ) {
    return 320;
  }
  if (
    input.reviewPack.continuation ||
    input.reviewPack.actionability ||
    input.reviewPack.missionLinkage ||
    input.reviewPack.publishHandoff ||
    input.reviewPack.recommendedNextAction
  ) {
    return 240;
  }
  return 120;
}

function buildReviewQueueItems(
  workspaces: HugeCodeMissionControlSnapshot["workspaces"],
  reviewPacks: HugeCodeMissionControlSnapshot["reviewPacks"]
): HugeCodeReviewQueueItem[] {
  return [...reviewPacks]
    .map((reviewPack) => {
      const continuityDescriptor = resolveReviewPackContinuityDescriptor(reviewPack);
      const continuityState = getReviewPackContinuityState(continuityDescriptor);
      return {
        reviewPack,
        priority: computeReviewQueuePriority({
          reviewPack,
          continuityDescriptor,
          continuityState,
        }),
        item: {
          id: reviewPack.id,
          title: reviewPack.summary,
          workspaceName: getWorkspaceName(workspaces, reviewPack.workspaceId),
          summary: resolveReviewQueueSummary(reviewPack, continuityDescriptor),
          reviewStatusLabel: getReviewStatusLabel(reviewPack, continuityState),
          validationLabel: formatValidationLabel(reviewPack.validationOutcome),
          tone: getReviewItemTone(reviewPack, continuityState),
          warningCount: reviewPack.warningCount,
        },
      };
    })
    .sort(
      (left, right) =>
        right.priority - left.priority || right.reviewPack.createdAt - left.reviewPack.createdAt
    )
    .slice(0, 6)
    .map((entry) => entry.item);
}

export function buildRuntimeMissionControlSummary(
  snapshot: HugeCodeMissionControlSnapshot | null,
  activeWorkspaceId: string | null
): HugeCodeMissionControlSummary {
  if (!snapshot) {
    return EMPTY_RUNTIME_MISSION_CONTROL_SUMMARY;
  }
  const scopedWorkspaces = snapshot.workspaces;
  const connectedWorkspaceCount = scopedWorkspaces.filter(
    (workspace) => workspace.connected
  ).length;
  const activeWorkspace =
    (activeWorkspaceId
      ? (scopedWorkspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null)
      : null) ?? null;
  const scopedTasks = activeWorkspaceId
    ? snapshot.tasks.filter((task) => task.workspaceId === activeWorkspaceId)
    : snapshot.tasks;
  const scopedRuns = activeWorkspaceId
    ? snapshot.runs.filter((run) => run.workspaceId === activeWorkspaceId)
    : snapshot.runs;
  const scopedReviewPacks = activeWorkspaceId
    ? snapshot.reviewPacks.filter((reviewPack) => reviewPack.workspaceId === activeWorkspaceId)
    : snapshot.reviewPacks;
  const approvalCount = scopedRuns.filter(
    (run) => run.approval?.status === "pending_decision" || run.state === "needs_input"
  ).length;
  const hasActiveWorkspace = activeWorkspaceId !== null;
  const workspaceLabel = hasActiveWorkspace
    ? (activeWorkspace?.name ?? "Selected workspace")
    : `${connectedWorkspaceCount}/${scopedWorkspaces.length} connected workspaces`;

  return {
    workspaceLabel,
    tasksCount: scopedTasks.length,
    runsCount: scopedRuns.length,
    approvalCount,
    reviewPacksCount: scopedReviewPacks.length,
    connectedWorkspaceCount,
    launchReadiness: buildSharedLaunchReadiness(
      hasActiveWorkspace,
      activeWorkspace?.connected ?? false,
      scopedRuns
    ),
    continuityReadiness: buildSharedContinuityReadiness(
      hasActiveWorkspace,
      activeWorkspace?.connected ?? false,
      scopedRuns
    ),
    missionItems: buildMissionActivityItems(scopedWorkspaces, scopedRuns),
    reviewItems: buildReviewQueueItems(scopedWorkspaces, scopedReviewPacks),
  };
}
