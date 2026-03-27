import type { HealthResponse } from "../../../contracts/runtime";
import type { RuntimeExecutionReliabilitySummary } from "./runtimeExecutionReliability";
import type { RuntimeCapabilitiesSummary } from "@ku0/code-runtime-client/runtimeClientTypes";

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
    channelStatus: RuntimeExecutionReliabilitySummary["channelHealth"]["status"];
    blockedTotal: number;
    topFailedReason: string | null;
    openCircuitBreakerScopes: RuntimeExecutionReliabilitySummary["circuitBreakers"][number]["scope"][];
  };
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
    blockedTotal: executionReliability.blockedTotal,
    topFailedReason: executionReliability.topFailedReason,
    openCircuitBreakerScopes: executionReliability.circuitBreakers
      .filter((entry) => entry.state === "open")
      .map((entry) => entry.scope),
  };
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
        ? (route.blockingReason ?? route.detail)
        : executionReliabilitySignal.state === "blocked"
          ? executionReliabilitySignal.detail
          : null;

  let recommendedAction = "Runtime looks healthy. You can launch this run now.";
  if (runtime.state === "blocked") {
    recommendedAction =
      "Reconnect to the runtime or restore runtime capabilities before launching.";
  } else if (route.state === "blocked") {
    recommendedAction =
      route.recommendedAction ??
      "Fix the selected route or switch to a ready route before launching.";
  } else if (executionReliabilitySignal.state !== "ready") {
    recommendedAction = executionReliability.recommendedAction;
  } else if (route.state === "attention") {
    recommendedAction =
      route.recommendedAction ??
      "Inspect routing attention before launching, even though a viable route is still available.";
  } else if (stalePendingApprovalCount > 0) {
    recommendedAction =
      "Resolve or interrupt stale input requests before launching more work into the queue.";
  } else if (pendingApprovalCount > 0) {
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
    executionReliability: executionReliabilitySignal,
  };
}
