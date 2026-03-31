import { invoke, isTauri } from "../application/runtime/ports/desktopHostCore";
import type { LocalUsageSnapshot } from "../types";
import { createLocalUsageSnapshotGateway } from "./localUsageSnapshotGateway";
import { getRuntimeClient } from "./runtimeClient";
import {
  isMissingTauriCommandError,
  isMissingTauriInvokeError,
  LOCAL_USAGE_CACHE_TTL_MS,
} from "./runtimeTransport";
import { buildLocalUsageSnapshotFromCliSessions } from "./runtimeTurnHelpers";

let localUsageSnapshotGateway: ReturnType<typeof createLocalUsageSnapshotGateway> | null = null;

function getLocalUsageSnapshotGateway() {
  if (localUsageSnapshotGateway) {
    return localUsageSnapshotGateway;
  }
  localUsageSnapshotGateway = createLocalUsageSnapshotGateway({
    cacheTtlMs: LOCAL_USAGE_CACHE_TTL_MS,
    isTauri: () => isTauri(),
    readRuntimeCliSessions: async () =>
      (await getRuntimeClient().cliSessions()) as Array<
        { updatedAt: number } & Record<string, unknown>
      >,
    invokeLocalUsageSnapshot: async (payload) =>
      invoke<LocalUsageSnapshot>("local_usage_snapshot", payload),
    isMissingTauriInvokeError,
    isMissingTauriCommandError,
    buildLocalUsageSnapshotFromCliSessions,
  });
  return localUsageSnapshotGateway;
}

export function __resetLocalUsageSnapshotCacheForTests() {
  getLocalUsageSnapshotGateway().resetCache();
}

export async function localUsageSnapshot(
  days?: number,
  workspacePath?: string | null
): Promise<LocalUsageSnapshot> {
  return getLocalUsageSnapshotGateway().read(days, workspacePath);
}
