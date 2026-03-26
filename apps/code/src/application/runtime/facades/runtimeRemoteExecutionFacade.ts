import type { RuntimeRunStartRequest, RuntimeRunStartV2Response } from "../ports/runtimeClient";
import { getAppSettings } from "../ports/tauriAppSettings";
import { prepareRuntimeRunV2, startRuntimeRunV2 } from "../ports/tauriRuntimeJobs";

type RuntimeRunStartRequestWithRemoteSelection = RuntimeRunStartRequest;

export function normalizeRuntimePreferredBackendIds(
  value: string[] | undefined | null
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
  preferredBackendIds?: string[] | null;
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

export async function resolvePreferredBackendIdsForTurnSend(
  preferredBackendIds?: string[] | null,
  defaultBackendId?: string | null
): Promise<string[] | undefined> {
  return resolvePreferredBackendIdsForRuntimeRunLaunch(
    preferredBackendIds ?? undefined,
    defaultBackendId
  );
}

export async function resolvePreferredBackendIdsForRuntimeRunLaunch(
  preferredBackendIds?: string[],
  defaultBackendId?: string | null
): Promise<string[] | undefined> {
  const resolved = resolveRuntimePreferredBackendIdsInput({
    preferredBackendIds,
    defaultBackendId,
  });
  if (resolved) {
    return resolved;
  }
  const settings = await getAppSettings();
  const globalDefaultBackendId =
    typeof settings.defaultRemoteExecutionBackendId === "string"
      ? settings.defaultRemoteExecutionBackendId.trim()
      : "";
  return resolveRuntimePreferredBackendIdsInput({
    fallbackDefaultBackendId: globalDefaultBackendId,
  });
}

export async function startRuntimeRunWithRemoteSelection(
  request: RuntimeRunStartRequestWithRemoteSelection
): Promise<RuntimeRunStartV2Response> {
  const preferredBackendIds =
    request.executionMode === "distributed"
      ? await resolvePreferredBackendIdsForRuntimeRunLaunch(
          request.preferredBackendIds,
          request.defaultBackendId ?? undefined
        )
      : undefined;
  const launchRequest = {
    ...request,
    ...(preferredBackendIds ? { preferredBackendIds } : {}),
  };
  await prepareRuntimeRunV2(launchRequest);
  return startRuntimeRunV2(launchRequest);
}
