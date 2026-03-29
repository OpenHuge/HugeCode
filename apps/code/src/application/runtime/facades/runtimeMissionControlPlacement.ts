import type {
  AgentTaskSummary,
  HugeCodeRunPlacementEvidence,
  HugeCodeRunSummary,
} from "@ku0/code-runtime-host-contract";

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

export function buildPlacementEvidence(input: {
  task: AgentTaskSummary;
  routing: HugeCodeRunSummary["routing"];
  executionProfile: HugeCodeRunSummary["executionProfile"];
}): HugeCodeRunPlacementEvidence | null {
  void input.routing;
  void input.executionProfile;
  return clonePlacementEvidence(input.task.runSummary?.placement ?? null);
}
