function normalizeRuntimePreferredBackendIds(
  value: readonly string[] | undefined | null
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    ids.push(trimmed);
  }
  return ids;
}

type RuntimeCompositionBackendCandidateLike = {
  backendId: string;
};

type RuntimeCompositionResolutionLike = {
  selectedPlugins?: unknown[] | null;
  selectedRouteCandidates?: unknown[] | null;
  selectedBackendCandidates?: RuntimeCompositionBackendCandidateLike[] | null;
  blockedPlugins?: unknown[] | null;
  provenance?: {
    appliedLayerOrder?: string[] | null;
  } | null;
};

type RuntimeCompositionSnapshotLike = {
  authorityState: string;
  freshnessState: string;
};

export type RuntimeCompositionResolutionSummary = {
  selectedPluginCount: number;
  blockedPluginCount: number;
  routeCandidateCount: number;
  selectedBackendCount: number;
  preferredBackendIds: string[];
  backendSummary: string;
  layerSummary: string;
  countsSummary: string;
};

export function buildRuntimeCompositionResolutionSummary(
  resolution: RuntimeCompositionResolutionLike | null | undefined
): RuntimeCompositionResolutionSummary {
  const preferredBackendIds = normalizeRuntimePreferredBackendIds(
    resolution?.selectedBackendCandidates?.map((candidate) => candidate.backendId)
  );
  const selectedPluginCount = resolution?.selectedPlugins?.length ?? 0;
  const blockedPluginCount = resolution?.blockedPlugins?.length ?? 0;
  const routeCandidateCount = resolution?.selectedRouteCandidates?.length ?? 0;
  const selectedBackendCount = preferredBackendIds.length;
  const appliedLayerOrder = resolution?.provenance?.appliedLayerOrder ?? [];

  return {
    selectedPluginCount,
    blockedPluginCount,
    routeCandidateCount,
    selectedBackendCount,
    preferredBackendIds,
    backendSummary:
      preferredBackendIds.length > 0 ? preferredBackendIds.join(", ") : "runtime fallback",
    layerSummary: appliedLayerOrder.length > 0 ? appliedLayerOrder.join(" -> ") : "runtime default",
    countsSummary: `Selected plugins ${selectedPluginCount}, blocked plugins ${blockedPluginCount}, route candidates ${routeCandidateCount}.`,
  };
}

export function buildRuntimeCompositionAuthoritySummary(
  snapshot: RuntimeCompositionSnapshotLike | null | undefined
) {
  return snapshot ? `${snapshot.authorityState} / ${snapshot.freshnessState}` : "unavailable";
}
