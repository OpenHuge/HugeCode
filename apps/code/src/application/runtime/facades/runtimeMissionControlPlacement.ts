import type {
  AgentTaskSummary,
  HugeCodePlacementAttentionReason,
  HugeCodePlacementLifecycleState,
  HugeCodePlacementResolutionSource,
  HugeCodeRunPlacementEvidence,
  HugeCodeRunSummary,
} from "@ku0/code-runtime-host-contract";
import {
  projectRuntimeExecutionGraphSummary,
  resolveExecutionGraphRootNode,
} from "./runtimeMissionControlExecutionGraph";

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeStringList(values: string[] | null | undefined): string[] {
  return Array.from(
    new Set((values ?? []).map((entry) => entry.trim()).filter((entry) => entry.length > 0))
  );
}

function clonePlacementEvidence(
  placement: HugeCodeRunPlacementEvidence | null | undefined
): HugeCodeRunPlacementEvidence | null {
  if (!placement) {
    return null;
  }

  return {
    ...placement,
    resolvedBackendId: normalizeText(placement.resolvedBackendId),
    requestedBackendIds: normalizeStringList(placement.requestedBackendIds),
    summary: normalizeText(placement.summary) ?? "Runtime published placement evidence.",
    rationale:
      normalizeText(placement.rationale) ??
      "Placement details were published by runtime without frontend inference.",
    fallbackReasonCode: normalizeText(placement.fallbackReasonCode),
    resumeBackendId: normalizeText(placement.resumeBackendId),
    attentionReasons: [...placement.attentionReasons],
    scoreBreakdown: placement.scoreBreakdown
      ? placement.scoreBreakdown.map((entry) => ({
          ...entry,
          reasons: [...entry.reasons],
        }))
      : null,
    backendContract: placement.backendContract ? { ...placement.backendContract } : null,
  };
}

function normalizePlacementResolutionSource(
  value: string | null | undefined
): HugeCodePlacementResolutionSource | null {
  switch (value) {
    case "explicit_preference":
    case "workspace_default":
    case "provider_route":
    case "runtime_fallback":
    case "unresolved":
      return value;
    default:
      return null;
  }
}

function normalizePlacementLifecycleState(
  value: string | null | undefined
): HugeCodePlacementLifecycleState | null {
  switch (value) {
    case "requested":
    case "resolved":
    case "confirmed":
    case "fallback":
    case "unresolved":
      return value;
    default:
      return null;
  }
}

function buildSynthesizedPlacementEvidence(input: {
  task: AgentTaskSummary;
  routing: HugeCodeRunSummary["routing"];
}): HugeCodeRunPlacementEvidence | null {
  const rootNode = resolveExecutionGraphRootNode(
    projectRuntimeExecutionGraphSummary(input.task.executionGraph)
  );
  if (!rootNode) {
    return null;
  }

  const requestedBackendIds = normalizeStringList(rootNode.preferredBackendIds);
  const resolvedBackendId = normalizeText(rootNode.resolvedBackendId);
  const lifecycleState = normalizePlacementLifecycleState(rootNode.placementLifecycleState);
  if (!lifecycleState && !resolvedBackendId && requestedBackendIds.length === 0) {
    return null;
  }

  const resolutionSource =
    normalizePlacementResolutionSource(rootNode.placementResolutionSource) ??
    (requestedBackendIds.length > 0 ? "explicit_preference" : "unresolved");
  const normalizedLifecycleState =
    lifecycleState ?? (resolvedBackendId ? "resolved" : "unresolved");

  const attentionReasons: HugeCodePlacementAttentionReason[] = [];
  if (!resolvedBackendId) {
    attentionReasons.push("awaiting_backend_confirmation", "placement_unresolved");
  } else if (normalizedLifecycleState === "fallback") {
    attentionReasons.push("fallback_backend_selected");
  }

  const summary = resolvedBackendId
    ? normalizedLifecycleState === "confirmed"
      ? `Placement is confirmed on ${resolvedBackendId}.`
      : `Placement is resolving on ${resolvedBackendId}.`
    : "Placement is unresolved.";

  const rationale = resolvedBackendId
    ? `Runtime selected ${resolvedBackendId} from execution-graph placement metadata.`
    : "Runtime has not confirmed a concrete backend placement yet.";

  return {
    resolvedBackendId,
    requestedBackendIds,
    resolutionSource,
    lifecycleState: normalizedLifecycleState,
    readiness: resolvedBackendId ? (input.routing?.health ?? "ready") : "attention",
    healthSummary:
      resolvedBackendId && normalizedLifecycleState !== "fallback"
        ? "placement_ready"
        : resolvedBackendId
          ? "placement_attention"
          : "placement_attention",
    attentionReasons,
    summary,
    rationale,
  };
}

export function buildPlacementEvidence(input: {
  task: AgentTaskSummary;
  routing: HugeCodeRunSummary["routing"];
  executionProfile: HugeCodeRunSummary["executionProfile"];
}): HugeCodeRunPlacementEvidence | null {
  void input.routing;
  void input.executionProfile;
  return (
    clonePlacementEvidence(input.task.runSummary?.placement ?? null) ??
    buildSynthesizedPlacementEvidence(input)
  );
}
