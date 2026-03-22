import type { KernelJob, KernelJobStartRequestV3 } from "../ports/runtimeClient";
import { getAppSettings } from "../ports/tauriAppSettings";
import { startRuntimeJob } from "../ports/tauriRuntimeJobs";

type RuntimeJobStartRequestWithRemoteSelection = KernelJobStartRequestV3;

function dedupeBackendIds(value: string[] | undefined): string[] | undefined {
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

export async function resolvePreferredBackendIdsForTurnSend(
  preferredBackendIds?: string[] | null,
  defaultBackendId?: string | null
): Promise<string[] | undefined> {
  return resolvePreferredBackendIdsForRuntimeJobStart(
    preferredBackendIds ?? undefined,
    defaultBackendId
  );
}

export async function resolvePreferredBackendIdsForRuntimeJobStart(
  preferredBackendIds?: string[],
  defaultBackendId?: string | null
): Promise<string[] | undefined> {
  const explicitIds = dedupeBackendIds(preferredBackendIds);
  if (explicitIds) {
    return explicitIds;
  }
  const launchDefaultIds = dedupeBackendIds(
    typeof defaultBackendId === "string" ? [defaultBackendId] : undefined
  );
  if (launchDefaultIds) {
    return launchDefaultIds;
  }
  const settings = await getAppSettings();
  const globalDefaultBackendId =
    typeof settings.defaultRemoteExecutionBackendId === "string"
      ? settings.defaultRemoteExecutionBackendId.trim()
      : "";
  return globalDefaultBackendId ? [globalDefaultBackendId] : undefined;
}

export async function startRuntimeJobWithRemoteSelection(
  request: RuntimeJobStartRequestWithRemoteSelection
): Promise<KernelJob> {
  const preferredBackendIds =
    request.executionMode === "distributed"
      ? await resolvePreferredBackendIdsForRuntimeJobStart(
          request.preferredBackendIds,
          request.defaultBackendId ?? undefined
        )
      : undefined;
  return startRuntimeJob({
    ...request,
    ...(preferredBackendIds ? { preferredBackendIds } : {}),
  });
}
