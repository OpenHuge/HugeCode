import type {
  RuntimeCompositionBackendCandidate,
  RuntimeCompositionProfile,
  RuntimeCompositionResolution,
  RuntimeCompositionRouteCandidate,
} from "@ku0/code-runtime-host-contract";

export function normalizeRuntimePreferredBackendIds(
  value: readonly string[] | undefined | null
): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
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
  return ids.length > 0 ? ids : undefined;
}

export function resolveRuntimePreferredBackendIdsInput(input: {
  preferredBackendIds?: readonly string[] | null;
  defaultBackendId?: string | null;
  fallbackDefaultBackendId?: string | null;
}): string[] | undefined {
  const explicitIds = normalizeRuntimePreferredBackendIds(input.preferredBackendIds);
  if (explicitIds) {
    return explicitIds;
  }
  const launchDefaultIds = normalizeRuntimePreferredBackendIds(
    typeof input.defaultBackendId === "string" ? [input.defaultBackendId] : undefined
  );
  if (launchDefaultIds) {
    return launchDefaultIds;
  }
  return normalizeRuntimePreferredBackendIds(
    typeof input.fallbackDefaultBackendId === "string"
      ? [input.fallbackDefaultBackendId]
      : undefined
  );
}

export function resolveRuntimeCompositionSelectedBackendCandidates(input: {
  effectiveProfile: Pick<RuntimeCompositionProfile, "backendPolicy">;
  selectedRouteCandidates: Pick<
    RuntimeCompositionRouteCandidate,
    "pluginId" | "preferredBackendIds" | "resolvedBackendId"
  >[];
}): RuntimeCompositionBackendCandidate[] {
  const backendCandidates = new Map<string, RuntimeCompositionBackendCandidate>();
  for (const backendId of input.effectiveProfile.backendPolicy.preferredBackendIds ?? []) {
    const normalized = normalizeRuntimePreferredBackendIds([backendId])?.[0];
    if (!normalized) {
      continue;
    }
    backendCandidates.set(normalized, {
      backendId: normalized,
      sourcePluginId: null,
    });
  }
  for (const route of input.selectedRouteCandidates) {
    for (const backendId of normalizeRuntimePreferredBackendIds(route.preferredBackendIds) ?? []) {
      if (!backendCandidates.has(backendId)) {
        backendCandidates.set(backendId, {
          backendId,
          sourcePluginId: route.pluginId,
        });
      }
    }
    const resolvedBackendId = normalizeRuntimePreferredBackendIds(
      route.resolvedBackendId ? [route.resolvedBackendId] : undefined
    )?.[0];
    if (resolvedBackendId && !backendCandidates.has(resolvedBackendId)) {
      backendCandidates.set(resolvedBackendId, {
        backendId: resolvedBackendId,
        sourcePluginId: route.pluginId,
      });
    }
  }
  const profileResolvedBackendId = normalizeRuntimePreferredBackendIds(
    input.effectiveProfile.backendPolicy.resolvedBackendId
      ? [input.effectiveProfile.backendPolicy.resolvedBackendId]
      : undefined
  )?.[0];
  if (profileResolvedBackendId) {
    if (!backendCandidates.has(profileResolvedBackendId)) {
      backendCandidates.set(profileResolvedBackendId, {
        backendId: profileResolvedBackendId,
        sourcePluginId: null,
      });
    }
  }
  return [...backendCandidates.values()];
}

export function readRuntimeCompositionPreferredBackendIds(
  resolution: RuntimeCompositionResolution | null
): string[] | null {
  return (
    normalizeRuntimePreferredBackendIds(
      resolution?.selectedBackendCandidates.map((entry) => entry.backendId)
    ) ?? null
  );
}

export function readRuntimeCompositionResolvedBackendId(input: {
  selectedRoute: string;
  activeProfile: Pick<RuntimeCompositionProfile, "backendPolicy"> | null;
  resolution: RuntimeCompositionResolution | null;
}): string | null {
  const normalizedRoute = input.selectedRoute.trim() || "auto";
  const routePluginId = `route:${normalizedRoute}`;
  const selectedRouteCandidate =
    input.resolution?.selectedRouteCandidates.find((entry) => entry.pluginId === routePluginId) ??
    null;
  return (
    normalizeRuntimePreferredBackendIds(
      selectedRouteCandidate?.resolvedBackendId ? [selectedRouteCandidate.resolvedBackendId] : null
    )?.[0] ??
    normalizeRuntimePreferredBackendIds(
      input.activeProfile?.backendPolicy.resolvedBackendId
        ? [input.activeProfile.backendPolicy.resolvedBackendId]
        : null
    )?.[0] ??
    null
  );
}
