import type { HealthResponse } from "../../../contracts/runtime";
import type { RuntimeExecutionReliabilitySummary } from "./runtimeExecutionReliability";
import type { RuntimeCapabilitiesSummary } from "@ku0/code-runtime-client/runtimeClientTypes";
import type { RuntimeRunPrepareV2Response } from "@ku0/code-runtime-host-contract";

export type RuntimeLaunchReadinessState = "ready" | "attention" | "blocked";

export type RuntimeLaunchReadinessRoute = {
  value: string;
  label: string;
  ready: boolean;
  detail: string | null;
};

export type RuntimeLaunchReadinessSignal = {
  state: RuntimeLaunchReadinessState;
  label: string;
  detail: string;
};

export type RuntimeLaunchPreparationReadinessSignal = RuntimeLaunchReadinessSignal & {
  clarified: boolean | null;
  eligible: boolean | null;
  loading: boolean;
  missingContext: string[];
  nextEligibleAction: string | null;
  autonomyProfile: string | null;
};

export type RuntimeLaunchReadinessSummary = {
  state: RuntimeLaunchReadinessState;
  headline: string;
  blockingReason: string | null;
  recommendedAction: string;
  launchAllowed: boolean;
  route: RuntimeLaunchReadinessSignal & {
    value: string;
  };
  runtime: RuntimeLaunchReadinessSignal;
  approvalPressure: RuntimeLaunchReadinessSignal & {
    pendingCount: number;
    staleCount: number;
  };
  executionReliability: RuntimeLaunchReadinessSignal & {
    gatePassed: boolean | null;
    channelStatus: RuntimeExecutionReliabilitySummary["channelHealth"]["status"];
  };
  preparation: RuntimeLaunchPreparationReadinessSignal;
};

type BuildRuntimeLaunchReadinessOptions = {
  capabilities: unknown;
  health: unknown;
  healthError: string | null;
  selectedRoute: RuntimeLaunchReadinessRoute;
  executionReliability: RuntimeExecutionReliabilitySummary;
  pendingApprovalCount: number;
  stalePendingApprovalCount: number;
};

type MergeRuntimeLaunchPreparationReadinessOptions = {
  hasLaunchRequest: boolean;
  preparation: RuntimeRunPrepareV2Response | null;
  preparationLoading: boolean;
  preparationError: string | null;
};

function isRuntimeCapabilitiesSummary(value: unknown): value is RuntimeCapabilitiesSummary {
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

function isHealthResponse(value: unknown): value is HealthResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.app === "string" && typeof record.version === "string" && record.status === "ok"
  );
}

function maxState(
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
  const capabilities = isRuntimeCapabilitiesSummary(capabilitiesInput) ? capabilitiesInput : null;
  const health = isHealthResponse(healthInput) ? healthInput : null;
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

function buildRouteSignal(
  route: RuntimeLaunchReadinessRoute
): RuntimeLaunchReadinessSignal & { value: string } {
  return {
    value: route.value,
    state: route.ready ? "ready" : "blocked",
    label: route.label,
    detail:
      route.detail?.trim() ||
      (route.ready ? "Selected route is ready for launch." : "Selected route is not ready."),
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
  executionReliability: RuntimeExecutionReliabilitySummary
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
  };
}

function createPreparationSignal(
  overrides: Partial<RuntimeLaunchPreparationReadinessSignal> = {}
): RuntimeLaunchPreparationReadinessSignal {
  return {
    state: "ready",
    label: "Runtime launch plan",
    detail: "Enter a mission brief to evaluate runtime-owned launch planning.",
    clarified: null,
    eligible: null,
    loading: false,
    missingContext: [],
    nextEligibleAction: null,
    autonomyProfile: null,
    ...overrides,
  };
}

function formatRuntimeLaunchPlanDetail(preparation: RuntimeRunPrepareV2Response): string {
  const summary = preparation.executionEligibility.summary.trim();
  const selectionSummary = preparation.opportunityQueue.selectionSummary?.trim() ?? "";
  if (summary.length > 0 && selectionSummary.length > 0) {
    return `${summary} ${selectionSummary}`;
  }
  if (summary.length > 0) {
    return summary;
  }
  if (selectionSummary.length > 0) {
    return selectionSummary;
  }
  return preparation.runIntent.summary;
}

function buildRuntimeLaunchPreparationSignal({
  hasLaunchRequest,
  preparation,
  preparationLoading,
  preparationError,
}: MergeRuntimeLaunchPreparationReadinessOptions): RuntimeLaunchPreparationReadinessSignal {
  if (!hasLaunchRequest) {
    return createPreparationSignal();
  }

  if (preparationLoading) {
    return createPreparationSignal({
      state: "attention",
      detail: "Runtime is preparing the launch plan for this mission brief.",
      loading: true,
    });
  }

  const trimmedError = preparationError?.trim() ?? "";
  if (trimmedError.length > 0) {
    return createPreparationSignal({
      state: "blocked",
      detail: trimmedError,
    });
  }

  if (!preparation) {
    return createPreparationSignal({
      state: "attention",
      detail: "Runtime launch planning has not finished publishing preflight truth yet.",
    });
  }

  const blockingReason =
    preparation.executionEligibility.blockingReasons.find((reason) => reason.trim().length > 0) ??
    null;

  if (!preparation.executionEligibility.eligible) {
    return createPreparationSignal({
      state: "blocked",
      detail: blockingReason ?? preparation.executionEligibility.summary,
      clarified: preparation.runIntent.clarified,
      eligible: false,
      missingContext: preparation.runIntent.missingContext,
      nextEligibleAction: preparation.executionEligibility.nextEligibleAction,
      autonomyProfile: preparation.autonomyProfile,
    });
  }

  if (!preparation.runIntent.clarified) {
    return createPreparationSignal({
      state: "attention",
      detail:
        preparation.runIntent.missingContext.length > 0
          ? `Runtime still needs ${preparation.runIntent.missingContext.join(", ")} before the launch brief is fully clarified.`
          : formatRuntimeLaunchPlanDetail(preparation),
      clarified: false,
      eligible: true,
      missingContext: preparation.runIntent.missingContext,
      nextEligibleAction: preparation.executionEligibility.nextEligibleAction,
      autonomyProfile: preparation.autonomyProfile,
    });
  }

  return createPreparationSignal({
    state: "ready",
    detail: formatRuntimeLaunchPlanDetail(preparation),
    clarified: true,
    eligible: true,
    missingContext: preparation.runIntent.missingContext,
    nextEligibleAction: preparation.executionEligibility.nextEligibleAction,
    autonomyProfile: preparation.autonomyProfile,
  });
}

function buildPreparationRecommendedAction(
  signal: RuntimeLaunchPreparationReadinessSignal
): string | null {
  if (signal.loading) {
    return "Wait for the runtime-owned launch plan before starting this mission.";
  }
  if (signal.state === "blocked") {
    if (signal.missingContext.length > 0) {
      return `Clarify ${signal.missingContext.join(", ")} before starting this mission.`;
    }
    if (signal.detail.trim().length > 0) {
      return `Resolve the runtime launch-plan block before starting: ${signal.detail}`;
    }
    return "Resolve the runtime launch-plan block before starting this mission.";
  }
  if (signal.state === "attention") {
    if (signal.missingContext.length > 0) {
      return `Clarify ${signal.missingContext.join(", ")} so the runtime launch plan is fully aligned.`;
    }
    return "Review the runtime-owned launch plan before starting this mission.";
  }
  return null;
}

function toLaunchReadinessHeadline(state: RuntimeLaunchReadinessState): string {
  return state === "ready"
    ? "Launch readiness confirmed"
    : state === "blocked"
      ? "Launch readiness blocked"
      : "Launch readiness needs attention";
}

export function buildRuntimeLaunchReadiness({
  capabilities,
  health,
  healthError,
  selectedRoute,
  executionReliability,
  pendingApprovalCount,
  stalePendingApprovalCount,
}: BuildRuntimeLaunchReadinessOptions): RuntimeLaunchReadinessSummary {
  const runtime = buildRuntimeSignal(capabilities, health, healthError);
  const route = buildRouteSignal(selectedRoute);
  const approvalPressure = buildApprovalPressureSignal(
    pendingApprovalCount,
    stalePendingApprovalCount
  );
  const executionReliabilitySignal = buildExecutionReliabilitySignal(executionReliability);

  const state = maxState(
    maxState(maxState(runtime.state, route.state), executionReliabilitySignal.state),
    approvalPressure.state
  );
  const blockingReason =
    runtime.state === "blocked"
      ? runtime.detail
      : route.state === "blocked"
        ? route.detail
        : executionReliabilitySignal.state === "blocked"
          ? executionReliabilitySignal.detail
          : null;

  let recommendedAction = "Runtime looks healthy. You can launch this run now.";
  if (runtime.state === "blocked") {
    recommendedAction =
      "Reconnect to the runtime or restore runtime capabilities before launching.";
  } else if (route.state === "blocked") {
    recommendedAction = "Fix the selected route or switch to a ready route before launching.";
  } else if (executionReliabilitySignal.state !== "ready") {
    recommendedAction = executionReliability.recommendedAction;
  } else if (stalePendingApprovalCount > 0) {
    recommendedAction =
      "Resolve or interrupt stale input requests before launching more work into the queue.";
  } else if (pendingApprovalCount > 0) {
    recommendedAction = "Review the approval backlog before launching more work.";
  }

  return {
    state,
    headline: toLaunchReadinessHeadline(state),
    blockingReason,
    recommendedAction,
    launchAllowed: state !== "blocked",
    runtime,
    route,
    approvalPressure,
    executionReliability: executionReliabilitySignal,
    preparation: createPreparationSignal(),
  };
}

export function mergeRuntimeLaunchPreparationIntoLaunchReadiness(
  summary: RuntimeLaunchReadinessSummary,
  options: MergeRuntimeLaunchPreparationReadinessOptions
): RuntimeLaunchReadinessSummary {
  const preparation = buildRuntimeLaunchPreparationSignal(options);
  const state = maxState(summary.state, preparation.state);
  const blockingReason =
    summary.state === "blocked"
      ? summary.blockingReason
      : preparation.state === "blocked"
        ? preparation.detail
        : summary.blockingReason;
  const recommendedAction =
    summary.state === "blocked"
      ? summary.recommendedAction
      : (buildPreparationRecommendedAction(preparation) ?? summary.recommendedAction);

  return {
    ...summary,
    state,
    headline: toLaunchReadinessHeadline(state),
    blockingReason,
    recommendedAction,
    launchAllowed: state !== "blocked",
    preparation,
  };
}
