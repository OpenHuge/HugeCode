import { invoke, isDesktopHostRuntime } from "../application/runtime/ports/desktopHostCore";
import type { LocalUsageSnapshot } from "../types";
import { createLocalUsageSnapshotGateway } from "./localUsageSnapshotGateway";
import { getRuntimeClient } from "./runtimeClient";
import {
  isMissingDesktopHostCommandError,
  isMissingDesktopHostInvokeError,
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
    isDesktopHostRuntime: () => isDesktopHostRuntime(),
    readRuntimeCliSessions: async () =>
      (await getRuntimeClient().cliSessions()) as Array<
        { updatedAt: number } & Record<string, unknown>
      >,
    invokeLocalUsageSnapshot: async (payload) =>
      invoke<LocalUsageSnapshot>("local_usage_snapshot", payload),
    isMissingDesktopHostInvokeError,
    isMissingDesktopHostCommandError,
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
