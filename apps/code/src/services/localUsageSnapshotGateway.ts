import type { LocalUsageSnapshot } from "../types";

type LocalCliSession = { updatedAt: number } & Record<string, unknown>;

type LocalUsageSnapshotPayload = {
  days: number;
  workspacePath?: string;
};

type LocalUsageSnapshotGatewayDeps = {
  cacheTtlMs: number;
  isTauri: () => boolean;
  readRuntimeCliSessions: () => Promise<LocalCliSession[]>;
  invokeLocalUsageSnapshot: (payload: LocalUsageSnapshotPayload) => Promise<LocalUsageSnapshot>;
  isMissingTauriInvokeError: (error: unknown) => boolean;
  isMissingTauriCommandError: (error: unknown, command: string) => boolean;
  buildLocalUsageSnapshotFromCliSessions: (
    sessions: LocalCliSession[],
    days: number,
    workspacePath?: string | null
  ) => LocalUsageSnapshot;
};

function normalizeLocalUsageSnapshotDays(days?: number): number {
  if (typeof days !== "number" || !Number.isFinite(days) || days <= 0) {
    return 30;
  }
  return Math.max(1, Math.trunc(days));
}

function normalizeLocalUsageSnapshotWorkspacePath(workspacePath?: string | null): string | null {
  if (typeof workspacePath !== "string") {
    return null;
  }
  const normalizedWorkspacePath = workspacePath.trim();
  return normalizedWorkspacePath.length > 0 ? normalizedWorkspacePath : null;
}

function toLocalUsageCacheKey(days: number, workspacePath: string | null) {
  return `${days}::${workspacePath ?? ""}`;
}

export function createLocalUsageSnapshotGateway(deps: LocalUsageSnapshotGatewayDeps) {
  const inFlightByKey = new Map<string, Promise<LocalUsageSnapshot>>();
  const cacheByKey = new Map<string, { snapshot: LocalUsageSnapshot; expiresAt: number }>();

  const readCachedLocalUsageSnapshot = (cacheKey: string): LocalUsageSnapshot | null => {
    const cached = cacheByKey.get(cacheKey);
    if (!cached) {
      return null;
    }
    if (cached.expiresAt <= Date.now()) {
      cacheByKey.delete(cacheKey);
      return null;
    }
    return cached.snapshot;
  };

  const writeCachedLocalUsageSnapshot = (cacheKey: string, snapshot: LocalUsageSnapshot) => {
    cacheByKey.set(cacheKey, {
      snapshot,
      expiresAt: Date.now() + deps.cacheTtlMs,
    });
  };

  const read = async (
    days?: number,
    workspacePath?: string | null
  ): Promise<LocalUsageSnapshot> => {
    const normalizedDays = normalizeLocalUsageSnapshotDays(days);
    const normalizedWorkspacePath = normalizeLocalUsageSnapshotWorkspacePath(workspacePath);
    const cacheKey = toLocalUsageCacheKey(normalizedDays, normalizedWorkspacePath);
    const cachedSnapshot = readCachedLocalUsageSnapshot(cacheKey);
    if (cachedSnapshot) {
      return cachedSnapshot;
    }
    const inFlight = inFlightByKey.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    const requestPromise: Promise<LocalUsageSnapshot> = (async (): Promise<LocalUsageSnapshot> => {
      const payload: LocalUsageSnapshotPayload = { days: normalizedDays };
      if (normalizedWorkspacePath) {
        payload.workspacePath = normalizedWorkspacePath;
      }
      if (!deps.isTauri()) {
        const sessions = await deps.readRuntimeCliSessions();
        return deps.buildLocalUsageSnapshotFromCliSessions(
          sessions,
          normalizedDays,
          normalizedWorkspacePath
        );
      }
      try {
        return await deps.invokeLocalUsageSnapshot(payload);
      } catch (error) {
        if (
          deps.isMissingTauriInvokeError(error) ||
          deps.isMissingTauriCommandError(error, "local_usage_snapshot")
        ) {
          const sessions = await deps.readRuntimeCliSessions();
          return deps.buildLocalUsageSnapshotFromCliSessions(
            sessions,
            normalizedDays,
            normalizedWorkspacePath
          );
        }
        throw error;
      }
    })()
      .then((snapshot) => {
        writeCachedLocalUsageSnapshot(cacheKey, snapshot);
        return snapshot;
      })
      .finally(() => {
        if (inFlightByKey.get(cacheKey) === requestPromise) {
          inFlightByKey.delete(cacheKey);
        }
      });

    inFlightByKey.set(cacheKey, requestPromise);
    return requestPromise;
  };

  const resetCache = () => {
    inFlightByKey.clear();
    cacheByKey.clear();
  };

  return {
    read,
    resetCache,
  };
}
