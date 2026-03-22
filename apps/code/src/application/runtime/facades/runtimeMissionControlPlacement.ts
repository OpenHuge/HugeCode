import type {
  AgentTaskSummary,
  HugeCodeBackendContractSummary,
  HugeCodePlacementAttentionReason,
  HugeCodePlacementHealthSummary,
  HugeCodePlacementLifecycleState,
  HugeCodePlacementResolutionSource,
  HugeCodeRunPlacementEvidence,
  HugeCodeRunSummary,
} from "@ku0/code-runtime-host-contract";
import type { RunProjectionRoutingContext } from "./runtimeMissionControlRouting";

function normalizeBackendIds(ids: string[] | null | undefined): string[] {
  return Array.from(
    new Set((ids ?? []).map((entry) => entry.trim()).filter((entry) => entry.length > 0))
  );
}

function resolvePlacementSource(input: {
  resolvedBackendId: string | null;
  requestedBackendIds: string[];
  routingStrategy: NonNullable<HugeCodeRunSummary["executionProfile"]>["routingStrategy"];
}): HugeCodePlacementResolutionSource {
  if (!input.resolvedBackendId) {
    return "unresolved";
  }
  if (input.requestedBackendIds.length > 0) {
    return input.requestedBackendIds.includes(input.resolvedBackendId)
      ? "explicit_preference"
      : "runtime_fallback";
  }
  if (input.routingStrategy === "provider_route") {
    return "provider_route";
  }
  return "workspace_default";
}

function resolvePlacementLifecycleState(input: {
  resolvedBackendId: string | null;
  requestedBackendIds: string[];
  backendContract: HugeCodeBackendContractSummary | null;
  readiness: HugeCodeRunSummary["routing"] extends infer Routing
    ? Routing extends { health: infer Health }
      ? Health | null
      : never
    : never;
}): HugeCodePlacementLifecycleState {
  if (!input.resolvedBackendId) {
    return input.requestedBackendIds.length > 0 ? "requested" : "unresolved";
  }
  if (
    input.requestedBackendIds.length > 0 &&
    !input.requestedBackendIds.includes(input.resolvedBackendId)
  ) {
    return "fallback";
  }
  if (input.backendContract || input.readiness !== null) {
    return "confirmed";
  }
  return "resolved";
}

function buildPlacementSummary(input: {
  resolvedBackendId: string | null;
  resolutionSource: HugeCodePlacementResolutionSource;
  lifecycleState: HugeCodePlacementLifecycleState;
  readiness: HugeCodeRunSummary["routing"] extends infer Routing
    ? Routing extends { health: infer Health }
      ? Health | null
      : never
    : never;
}) {
  const readinessRationale =
    input.readiness && input.readiness !== "ready"
      ? ` Routing readiness is currently ${input.readiness}.`
      : "";

  if (input.lifecycleState === "requested") {
    return {
      summary: "Requested backend placement is waiting for runtime confirmation.",
      rationale:
        "Mission Control recorded backend intent, but runtime has not confirmed a concrete backend yet.",
    };
  }

  if (input.lifecycleState === "unresolved" || !input.resolvedBackendId) {
    return {
      summary: "Placement is unresolved.",
      rationale: `Runtime has not recorded a concrete backend placement for this run yet.${readinessRationale}`,
    };
  }

  if (input.lifecycleState === "resolved") {
    return {
      summary: `Runtime resolved backend ${input.resolvedBackendId}, but confirmation details are incomplete.`,
      rationale: `Runtime selected ${input.resolvedBackendId}, but placement metadata is incomplete.${readinessRationale}`,
    };
  }

  if (input.lifecycleState === "fallback") {
    return {
      summary: `Runtime confirmed fallback placement on backend ${input.resolvedBackendId}.`,
      rationale: `Runtime selected ${input.resolvedBackendId} instead of the requested backend set, which indicates fallback placement.${readinessRationale}`,
    };
  }

  switch (input.resolutionSource) {
    case "explicit_preference":
      return {
        summary: `Runtime confirmed the requested backend ${input.resolvedBackendId}.`,
        rationale: `Mission Control requested ${input.resolvedBackendId} and runtime confirmed that placement.${readinessRationale}`,
      };
    case "provider_route":
      return {
        summary: `Runtime confirmed provider-routed placement on backend ${input.resolvedBackendId}.`,
        rationale: `Execution profile routing used provider-level placement rather than an explicit backend preference.${readinessRationale}`,
      };
    case "workspace_default":
      return {
        summary: `Runtime confirmed workspace-default placement on backend ${input.resolvedBackendId}.`,
        rationale: `No explicit backend preference was recorded, so runtime used the default workspace backend.${readinessRationale}`,
      };
    case "unresolved":
    case "runtime_fallback":
    default:
      return {
        summary: `Runtime confirmed backend placement on ${input.resolvedBackendId}.`,
        rationale: `Runtime recorded ${input.resolvedBackendId} as the backend for this run.${readinessRationale}`,
      };
  }
}

function findBackendContract(
  backendId: string | null,
  context?: RunProjectionRoutingContext
): HugeCodeBackendContractSummary | null {
  if (!backendId) {
    return null;
  }
  return context?.backends?.find((entry) => entry.backendId === backendId)?.contract ?? null;
}

function findBackendSnapshot(backendId: string | null, context?: RunProjectionRoutingContext) {
  if (!backendId) {
    return null;
  }
  return context?.backends?.find((entry) => entry.backendId === backendId) ?? null;
}

function resolvePlacementHealthSummary(input: {
  resolvedBackendId: string | null;
  requestedBackendIds: string[];
  resolutionSource: HugeCodePlacementResolutionSource;
  readiness: HugeCodeRunPlacementEvidence["readiness"];
  backendSnapshot: ReturnType<typeof findBackendSnapshot>;
  backendContract: HugeCodeBackendContractSummary | null;
}): HugeCodePlacementHealthSummary {
  const backendHealth = input.backendContract?.health ?? null;
  if (input.readiness === "blocked") {
    return "placement_blocked";
  }
  if (!input.resolvedBackendId && input.requestedBackendIds.length > 0) {
    return "placement_blocked";
  }
  if (
    input.backendSnapshot?.healthy === false ||
    input.backendSnapshot?.status === "disabled" ||
    input.backendSnapshot?.status === "draining" ||
    backendHealth === "disabled" ||
    backendHealth === "draining" ||
    (input.backendSnapshot?.queueDepth ?? 0) > 0 ||
    ((input.backendSnapshot?.capacity ?? 0) > 0 &&
      (input.backendSnapshot?.inFlight ?? 0) >= (input.backendSnapshot?.capacity ?? 0)) ||
    (input.backendSnapshot?.placementFailuresTotal ?? 0) > 0
  ) {
    return "placement_attention";
  }
  if (
    input.readiness === "attention" ||
    input.resolutionSource === "runtime_fallback" ||
    (input.resolvedBackendId !== null && input.backendContract === null)
  ) {
    return "placement_attention";
  }
  return "placement_ready";
}

function resolvePlacementAttentionReasons(input: {
  resolvedBackendId: string | null;
  requestedBackendIds: string[];
  resolutionSource: HugeCodePlacementResolutionSource;
  readiness: HugeCodeRunPlacementEvidence["readiness"];
  backendSnapshot: ReturnType<typeof findBackendSnapshot>;
  backendContract: HugeCodeBackendContractSummary | null;
}): HugeCodePlacementAttentionReason[] {
  const backendHealth = input.backendContract?.health ?? null;
  const reasons: HugeCodePlacementAttentionReason[] = [];
  if (!input.resolvedBackendId) {
    reasons.push(
      input.requestedBackendIds.length > 0 ? "placement_unresolved" : "routing_unavailable"
    );
  }
  if (input.resolutionSource === "runtime_fallback") {
    reasons.push("fallback_backend_selected");
  }
  if (input.resolvedBackendId !== null && input.backendContract === null) {
    reasons.push("backend_metadata_missing");
  }
  if (input.backendSnapshot?.healthy === false) {
    reasons.push("backend_unhealthy");
  }
  if (input.backendSnapshot?.status === "disabled") {
    reasons.push("backend_disabled");
  }
  if (input.backendSnapshot?.status === "draining" || backendHealth === "draining") {
    reasons.push("backend_draining");
  }
  if (backendHealth === "disabled") {
    reasons.push("backend_disabled");
  }
  if ((input.backendSnapshot?.queueDepth ?? 0) > 0) {
    reasons.push("backend_queue_depth");
  }
  if (
    (input.backendSnapshot?.capacity ?? 0) > 0 &&
    (input.backendSnapshot?.inFlight ?? 0) >= (input.backendSnapshot?.capacity ?? 0)
  ) {
    reasons.push("backend_at_capacity");
  }
  if ((input.backendSnapshot?.placementFailuresTotal ?? 0) > 0) {
    reasons.push("backend_failures_detected");
  }
  if (input.readiness === null) {
    reasons.push(
      input.resolvedBackendId !== null
        ? "awaiting_backend_confirmation"
        : "routing_metadata_missing"
    );
  }
  return [...new Set(reasons)];
}

export function buildPlacementEvidence(input: {
  task: AgentTaskSummary;
  routing: HugeCodeRunSummary["routing"];
  executionProfile: HugeCodeRunSummary["executionProfile"];
  routingContext?: RunProjectionRoutingContext;
}): HugeCodeRunPlacementEvidence | null {
  const requestedBackendIds = normalizeBackendIds(input.task.preferredBackendIds);
  const resolvedBackendId = input.routing?.backendId ?? input.task.backendId?.trim() ?? null;
  const resolutionSource = resolvePlacementSource({
    resolvedBackendId,
    requestedBackendIds,
    routingStrategy: input.executionProfile?.routingStrategy ?? "workspace_default",
  });
  const backendSnapshot = findBackendSnapshot(resolvedBackendId, input.routingContext);
  const backendContract = findBackendContract(resolvedBackendId, input.routingContext);
  const readiness = input.routing?.health ?? null;
  const lifecycleState = resolvePlacementLifecycleState({
    resolvedBackendId,
    requestedBackendIds,
    backendContract,
    readiness,
  });
  const summary = buildPlacementSummary({
    resolvedBackendId,
    resolutionSource,
    lifecycleState,
    readiness,
  });
  const healthSummary = resolvePlacementHealthSummary({
    resolvedBackendId,
    requestedBackendIds,
    resolutionSource,
    readiness,
    backendSnapshot,
    backendContract,
  });
  const attentionReasons = resolvePlacementAttentionReasons({
    resolvedBackendId,
    requestedBackendIds,
    resolutionSource,
    readiness,
    backendSnapshot,
    backendContract,
  });

  if (
    lifecycleState === "unresolved" &&
    !input.routing &&
    requestedBackendIds.length === 0 &&
    !backendContract
  ) {
    return null;
  }

  return {
    resolvedBackendId,
    requestedBackendIds,
    resolutionSource,
    lifecycleState,
    readiness,
    healthSummary,
    attentionReasons,
    summary: summary.summary,
    rationale: summary.rationale,
    tcpOverlay: backendSnapshot?.tcpOverlay ?? null,
    backendContract,
  };
}
