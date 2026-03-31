import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { RuntimeRunGetV2Response, RuntimeReviewGetV2Response } from "../ports/runtimeJobs";
import { getRuntimeRunV2, subscribeRuntimeRunV2 } from "../ports/runtimeJobs";
import { subscribeScopedRuntimeUpdatedEvents } from "../ports/runtimeUpdatedEvents";

type SnapshotListener = () => void;

type RefreshMode = "get" | "subscribe";

export type RuntimeRunTruthSnapshot = {
  runId: string | null;
  workspaceId: string | null;
  record: RuntimeRunGetV2Response | null;
  reviewPack: RuntimeReviewGetV2Response;
  loading: boolean;
  error: string | null;
  lastLoadedAt: number | null;
  pendingMode: RefreshMode | null;
  subscriptionState: "inactive" | "live";
};

type RuntimeRunTruthSubscriptionInput = {
  runId: string;
  workspaceId?: string | null;
};

type RuntimeRunTruthPrimeInput = RuntimeRunTruthSubscriptionInput & {
  force?: boolean;
};

type RuntimeRunTruthEntry = {
  runId: string;
  listeners: Set<SnapshotListener>;
  snapshot: RuntimeRunTruthSnapshot;
  workspaceIdHint: string | null;
  subscribedWorkspaceId: string | null;
  inFlightPromise: Promise<RuntimeRunGetV2Response | null> | null;
  queuedRefreshMode: RefreshMode | null;
  refreshQueued: boolean;
};

type WorkspaceSubscriptionEntry = {
  refCount: number;
  unsubscribe: () => void;
};

const EMPTY_RUNTIME_RUN_TRUTH_SNAPSHOT: RuntimeRunTruthSnapshot = {
  runId: null,
  workspaceId: null,
  record: null,
  reviewPack: null,
  loading: false,
  error: null,
  lastLoadedAt: null,
  pendingMode: null,
  subscriptionState: "inactive",
};

const runtimeRunTruthEntries = new Map<string, RuntimeRunTruthEntry>();
const runtimeRunTruthWorkspaceSubscriptions = new Map<string, WorkspaceSubscriptionEntry>();

function normalizeRunId(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeWorkspaceId(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function createRuntimeRunTruthEntry(
  runId: string,
  workspaceIdHint: string | null
): RuntimeRunTruthEntry {
  return {
    runId,
    listeners: new Set(),
    snapshot: {
      ...EMPTY_RUNTIME_RUN_TRUTH_SNAPSHOT,
      runId,
      workspaceId: workspaceIdHint,
    },
    workspaceIdHint,
    subscribedWorkspaceId: null,
    inFlightPromise: null,
    queuedRefreshMode: null,
    refreshQueued: false,
  };
}

function getOrCreateRuntimeRunTruthEntry(
  runId: string,
  workspaceIdHint: string | null
): RuntimeRunTruthEntry {
  const existing = runtimeRunTruthEntries.get(runId);
  if (existing) {
    if (workspaceIdHint && existing.workspaceIdHint !== workspaceIdHint) {
      existing.workspaceIdHint = workspaceIdHint;
      if (!existing.snapshot.workspaceId) {
        existing.snapshot = {
          ...existing.snapshot,
          workspaceId: workspaceIdHint,
        };
      }
    }
    return existing;
  }
  const entry = createRuntimeRunTruthEntry(runId, workspaceIdHint);
  runtimeRunTruthEntries.set(runId, entry);
  return entry;
}

function notifyRuntimeRunTruthListeners(entry: RuntimeRunTruthEntry): void {
  for (const listener of entry.listeners) {
    listener();
  }
}

function setRuntimeRunTruthSnapshot(
  entry: RuntimeRunTruthEntry,
  patch: Partial<RuntimeRunTruthSnapshot>,
  notify = true
): void {
  const nextSnapshot = {
    ...entry.snapshot,
    ...patch,
  } satisfies RuntimeRunTruthSnapshot;
  if (
    nextSnapshot === entry.snapshot ||
    (nextSnapshot.record === entry.snapshot.record &&
      nextSnapshot.reviewPack === entry.snapshot.reviewPack &&
      nextSnapshot.loading === entry.snapshot.loading &&
      nextSnapshot.error === entry.snapshot.error &&
      nextSnapshot.lastLoadedAt === entry.snapshot.lastLoadedAt &&
      nextSnapshot.pendingMode === entry.snapshot.pendingMode &&
      nextSnapshot.subscriptionState === entry.snapshot.subscriptionState &&
      nextSnapshot.workspaceId === entry.snapshot.workspaceId &&
      nextSnapshot.runId === entry.snapshot.runId)
  ) {
    return;
  }
  entry.snapshot = nextSnapshot;
  if (notify) {
    notifyRuntimeRunTruthListeners(entry);
  }
}

function detachWorkspaceSubscription(workspaceId: string | null): void {
  if (!workspaceId) {
    return;
  }
  const existing = runtimeRunTruthWorkspaceSubscriptions.get(workspaceId);
  if (!existing) {
    return;
  }
  if (existing.refCount <= 1) {
    existing.unsubscribe();
    runtimeRunTruthWorkspaceSubscriptions.delete(workspaceId);
    return;
  }
  existing.refCount -= 1;
}

function scheduleRuntimeRunTruthRefresh(entry: RuntimeRunTruthEntry, mode: RefreshMode): void {
  const nextMode = entry.queuedRefreshMode === "get" || mode === "get" ? "get" : "subscribe";
  entry.queuedRefreshMode = nextMode;
  if (entry.refreshQueued) {
    return;
  }
  entry.refreshQueued = true;
  queueMicrotask(() => {
    entry.refreshQueued = false;
    const queuedMode = entry.queuedRefreshMode;
    entry.queuedRefreshMode = null;
    if (!queuedMode) {
      return;
    }
    void refreshRuntimeRunTruthEntry(entry, queuedMode);
  });
}

function attachWorkspaceSubscription(
  entry: RuntimeRunTruthEntry,
  workspaceId: string,
  notify = true
): void {
  const existing = runtimeRunTruthWorkspaceSubscriptions.get(workspaceId);
  if (existing) {
    existing.refCount += 1;
    entry.subscribedWorkspaceId = workspaceId;
    setRuntimeRunTruthSnapshot(
      entry,
      {
        workspaceId,
        subscriptionState: "live",
      },
      notify
    );
    return;
  }
  const unsubscribe = subscribeScopedRuntimeUpdatedEvents(
    {
      workspaceId,
      scopes: ["agents"],
    },
    () => {
      for (const candidate of runtimeRunTruthEntries.values()) {
        if (candidate.listeners.size === 0 || candidate.subscribedWorkspaceId !== workspaceId) {
          continue;
        }
        scheduleRuntimeRunTruthRefresh(candidate, "subscribe");
      }
    }
  );
  runtimeRunTruthWorkspaceSubscriptions.set(workspaceId, {
    refCount: 1,
    unsubscribe,
  });
  entry.subscribedWorkspaceId = workspaceId;
  setRuntimeRunTruthSnapshot(
    entry,
    {
      workspaceId,
      subscriptionState: "live",
    },
    notify
  );
}

function syncRuntimeRunTruthEntryWorkspaceSubscription(
  entry: RuntimeRunTruthEntry,
  notify = true
): void {
  const nextWorkspaceId =
    entry.listeners.size > 0
      ? (normalizeWorkspaceId(entry.snapshot.record?.run.workspaceId) ??
        entry.snapshot.workspaceId ??
        entry.workspaceIdHint)
      : null;
  if (entry.subscribedWorkspaceId === nextWorkspaceId) {
    if (nextWorkspaceId && entry.snapshot.subscriptionState !== "live") {
      setRuntimeRunTruthSnapshot(entry, { subscriptionState: "live" }, notify);
    }
    if (!nextWorkspaceId && entry.snapshot.subscriptionState !== "inactive") {
      setRuntimeRunTruthSnapshot(entry, { subscriptionState: "inactive" }, notify);
    }
    return;
  }
  detachWorkspaceSubscription(entry.subscribedWorkspaceId);
  entry.subscribedWorkspaceId = null;
  if (nextWorkspaceId) {
    attachWorkspaceSubscription(entry, nextWorkspaceId, notify);
    return;
  }
  setRuntimeRunTruthSnapshot(entry, { subscriptionState: "inactive" }, notify);
}

async function refreshRuntimeRunTruthEntry(
  entry: RuntimeRunTruthEntry,
  mode: RefreshMode
): Promise<RuntimeRunGetV2Response | null> {
  if (entry.inFlightPromise) {
    if (mode === "get") {
      entry.queuedRefreshMode = "get";
    } else if (!entry.queuedRefreshMode) {
      entry.queuedRefreshMode = "subscribe";
    }
    return entry.inFlightPromise;
  }
  setRuntimeRunTruthSnapshot(entry, {
    loading: true,
    error: null,
    pendingMode: mode,
  });
  const promise =
    mode === "subscribe"
      ? subscribeRuntimeRunV2({ runId: entry.runId })
      : getRuntimeRunV2({ runId: entry.runId });
  entry.inFlightPromise = promise;
  try {
    const nextRecord = await promise;
    const workspaceId =
      normalizeWorkspaceId(nextRecord?.run.workspaceId) ??
      entry.workspaceIdHint ??
      entry.snapshot.workspaceId;
    setRuntimeRunTruthSnapshot(entry, {
      workspaceId,
      record: nextRecord ?? null,
      reviewPack: nextRecord?.reviewPack ?? null,
      loading: false,
      error: null,
      lastLoadedAt: Date.now(),
      pendingMode: null,
    });
    syncRuntimeRunTruthEntryWorkspaceSubscription(entry);
    return nextRecord ?? null;
  } catch (error) {
    setRuntimeRunTruthSnapshot(entry, {
      loading: false,
      error: error instanceof Error ? error.message : String(error),
      pendingMode: null,
    });
    syncRuntimeRunTruthEntryWorkspaceSubscription(entry);
    return null;
  } finally {
    entry.inFlightPromise = null;
    if (entry.queuedRefreshMode) {
      scheduleRuntimeRunTruthRefresh(entry, entry.queuedRefreshMode);
    }
  }
}

export function primeRuntimeRunTruth({
  runId,
  workspaceId,
  force = false,
}: RuntimeRunTruthPrimeInput): Promise<RuntimeRunGetV2Response | null> {
  const normalizedRunId = normalizeRunId(runId);
  if (!normalizedRunId) {
    return Promise.resolve(null);
  }
  const entry = getOrCreateRuntimeRunTruthEntry(normalizedRunId, normalizeWorkspaceId(workspaceId));
  syncRuntimeRunTruthEntryWorkspaceSubscription(entry);
  if (!force && (entry.inFlightPromise || entry.snapshot.record !== null)) {
    return entry.inFlightPromise ?? Promise.resolve(entry.snapshot.record);
  }
  return refreshRuntimeRunTruthEntry(entry, "get");
}

export function readRuntimeRunTruthSnapshot(
  runId: string | null | undefined
): RuntimeRunTruthSnapshot {
  const normalizedRunId = normalizeRunId(runId);
  if (!normalizedRunId) {
    return EMPTY_RUNTIME_RUN_TRUTH_SNAPSHOT;
  }
  return runtimeRunTruthEntries.get(normalizedRunId)?.snapshot ?? EMPTY_RUNTIME_RUN_TRUTH_SNAPSHOT;
}

export function subscribeRuntimeRunTruthSnapshot(
  input: RuntimeRunTruthSubscriptionInput,
  listener: SnapshotListener
): () => void {
  const normalizedRunId = normalizeRunId(input.runId);
  if (!normalizedRunId) {
    return () => undefined;
  }
  const entry = getOrCreateRuntimeRunTruthEntry(
    normalizedRunId,
    normalizeWorkspaceId(input.workspaceId)
  );
  entry.listeners.add(listener);
  syncRuntimeRunTruthEntryWorkspaceSubscription(entry, false);
  return () => {
    entry.listeners.delete(listener);
    syncRuntimeRunTruthEntryWorkspaceSubscription(entry, false);
  };
}

export function useRuntimeRunTruth(input: {
  runId: string | null | undefined;
  workspaceId?: string | null;
  enabled?: boolean;
}): RuntimeRunTruthSnapshot {
  const enabled = input.enabled ?? true;
  const normalizedRunId = normalizeRunId(input.runId);
  const normalizedWorkspaceId = normalizeWorkspaceId(input.workspaceId);

  useEffect(() => {
    if (!enabled || !normalizedRunId) {
      return;
    }
    queueMicrotask(() => {
      void primeRuntimeRunTruth({
        runId: normalizedRunId,
        workspaceId: normalizedWorkspaceId,
      });
    });
  }, [enabled, normalizedRunId, normalizedWorkspaceId]);

  const subscribe = useCallback(
    (listener: SnapshotListener) =>
      enabled && normalizedRunId
        ? subscribeRuntimeRunTruthSnapshot(
            {
              runId: normalizedRunId,
              workspaceId: normalizedWorkspaceId,
            },
            listener
          )
        : () => undefined,
    [enabled, normalizedRunId, normalizedWorkspaceId]
  );

  const getSnapshot = useCallback(
    () =>
      enabled && normalizedRunId
        ? readRuntimeRunTruthSnapshot(normalizedRunId)
        : EMPTY_RUNTIME_RUN_TRUTH_SNAPSHOT,
    [enabled, normalizedRunId]
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useRuntimeReviewTruth(input: {
  runId: string | null | undefined;
  workspaceId?: string | null;
  enabled?: boolean;
}) {
  const snapshot = useRuntimeRunTruth(input);
  return {
    reviewPack: snapshot.reviewPack,
    record: snapshot.record,
    loading: snapshot.loading,
    error: snapshot.error,
    subscriptionState: snapshot.subscriptionState,
  };
}

export function __resetRuntimeRunTruthStoreForTests(): void {
  for (const subscription of runtimeRunTruthWorkspaceSubscriptions.values()) {
    subscription.unsubscribe();
  }
  runtimeRunTruthWorkspaceSubscriptions.clear();
  runtimeRunTruthEntries.clear();
}
