import {
  normalizeRuntimePreferredBackendIds,
  resolveRuntimePreferredBackendIdsInput,
} from "@ku0/code-application";
import type { RuntimeRunStartRequest, RuntimeRunStartV2Response } from "../ports/runtimeClient";
import { getAppSettings } from "../ports/desktopAppSettings";
import { prepareRuntimeRunV2, startRuntimeRunV2 } from "../ports/runtimeJobs";

type RuntimeRunStartRequestWithRemoteSelection = RuntimeRunStartRequest;

export { normalizeRuntimePreferredBackendIds, resolveRuntimePreferredBackendIdsInput };

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
  const launchRequest = await buildRuntimeRunStartRequestWithRemoteSelection(request);
  await prepareRuntimeRunV2(launchRequest);
  return startRuntimeRunV2(launchRequest);
}

export async function buildRuntimeRunStartRequestWithRemoteSelection(
  request: RuntimeRunStartRequestWithRemoteSelection
): Promise<RuntimeRunStartRequestWithRemoteSelection> {
  const preferredBackendIds =
    request.executionMode === "distributed"
      ? await resolvePreferredBackendIdsForRuntimeRunLaunch(
          request.preferredBackendIds,
          request.defaultBackendId ?? undefined
        )
      : undefined;
  return {
    ...request,
    ...(preferredBackendIds ? { preferredBackendIds } : {}),
  };
}

export async function startPreparedRuntimeRunWithRemoteSelection(
  request: RuntimeRunStartRequestWithRemoteSelection
): Promise<RuntimeRunStartV2Response> {
  const launchRequest = await buildRuntimeRunStartRequestWithRemoteSelection(request);
  return startRuntimeRunV2(launchRequest);
}
