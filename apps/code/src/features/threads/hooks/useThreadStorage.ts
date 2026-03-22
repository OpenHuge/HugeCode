import type { ConversationItem, ThreadSummary } from "../../../types";
import type { MutableRefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { logger } from "../../../application/runtime/ports/logger";
import {
  readPersistedPendingInterruptThreadIds,
  readPersistedThreadStorageState,
  writePersistedPendingInterruptThreadIds,
  writePersistedThreadStorageState,
} from "../../../application/runtime/ports/tauriThreadSnapshots";
import {
  clearThreadSnapshots,
  type CustomNamesMap,
  loadCustomNames,
  loadPinnedThreads,
  loadThreadSnapshots,
  loadThreadActivity,
  MAX_PINS_SOFT_LIMIT,
  makeCustomNameKey,
  makePinKey,
  makeThreadSnapshotKey,
  type PinnedThreadsMap,
  type PersistedThreadSnapshot,
  type WorkspaceActiveThreadIdsMap,
  STORAGE_KEY_CUSTOM_NAMES,
  STORAGE_KEY_PINNED_THREADS,
  savePinnedThreads,
  saveThreadActivity,
  type WorkspacePendingDraftMessagesMap,
  type ThreadSnapshotsMap,
  type ThreadActivityMap,
} from "../utils/threadStorage";
import { isMeaningfulThreadName } from "../utils/threadTitle";
import type { ThreadActivityStatus } from "./useThreadsReducer.types";

export type UseThreadStorageResult = {
  customNamesRef: MutableRefObject<CustomNamesMap>;
  pinnedThreadsRef: MutableRefObject<PinnedThreadsMap>;
  threadSnapshotsRef: MutableRefObject<ThreadSnapshotsMap>;
  pendingDraftMessagesRef: MutableRefObject<WorkspacePendingDraftMessagesMap>;
  threadActivityRef: MutableRefObject<ThreadActivityMap>;
  pinnedThreadsVersion: number;
  threadSnapshotsReady: boolean;
  getCustomName: (workspaceId: string, threadId: string) => string | undefined;
  getPersistedThreadName: (workspaceId: string, threadId: string) => string | undefined;
  getPersistedPendingDraftMessages: (workspaceId: string) => ConversationItem[];
  getPersistedActiveThreadId: (workspaceId: string) => string | null;
  getPersistedPendingInterruptThreadIds: () => string[];
  listThreadSnapshots: (workspaceId?: string | null) => PersistedThreadSnapshot[];
  persistActiveThreadId: (workspaceId: string, threadId: string | null) => void;
  persistPendingDraftMessages: (workspaceId: string, items: ConversationItem[]) => void;
  persistPendingInterruptThreadIds: (threadIds: string[]) => void;
  recordThreadActivity: (workspaceId: string, threadId: string, timestamp?: number) => void;
  removeThreadSnapshot: (workspaceId: string, threadId: string) => void;
  syncThreadSnapshots: (
    threadsByWorkspace: Record<string, ThreadSummary[]>,
    itemsByThread: Record<string, ConversationItem[]>,
    threadStatusById: Record<string, ThreadActivityStatus>
  ) => void;
  pinThread: (workspaceId: string, threadId: string) => boolean;
  unpinThread: (workspaceId: string, threadId: string) => void;
  isThreadPinned: (workspaceId: string, threadId: string) => boolean;
  getPinTimestamp: (workspaceId: string, threadId: string) => number | null;
};

type PendingThreadSnapshotSync = {
  threadsByWorkspace: Record<string, ThreadSummary[]>;
  itemsByThread: Record<string, ConversationItem[]>;
  threadStatusById: Record<string, ThreadActivityStatus>;
};

function filterRestorableThreadSnapshots(nextSnapshots: ThreadSnapshotsMap): ThreadSnapshotsMap {
  return Object.fromEntries(
    Object.entries(nextSnapshots).filter(([, snapshot]) => snapshot.items.length > 0)
  );
}

export function useThreadStorage(): UseThreadStorageResult {
  const threadActivityRef = useRef<ThreadActivityMap>(loadThreadActivity());
  const pinnedThreadsRef = useRef<PinnedThreadsMap>(loadPinnedThreads());
  const threadSnapshotsRef = useRef<ThreadSnapshotsMap>({});
  const pendingDraftMessagesRef = useRef<WorkspacePendingDraftMessagesMap>({});
  const activeThreadIdByWorkspaceRef = useRef<WorkspaceActiveThreadIdsMap>({});
  const pendingInterruptThreadIdsRef = useRef<string[]>(readPersistedPendingInterruptThreadIds());
  const threadSnapshotsReadyRef = useRef(false);
  const pendingThreadSnapshotSyncRef = useRef<PendingThreadSnapshotSync | null>(null);
  const [pinnedThreadsVersion, setPinnedThreadsVersion] = useState(0);
  const [threadSnapshotsReady, setThreadSnapshotsReady] = useState(false);
  const customNamesRef = useRef<CustomNamesMap>({});

  const writePersistedThreadState = useCallback(
    (
      snapshots: ThreadSnapshotsMap,
      pendingDraftMessagesByWorkspace: WorkspacePendingDraftMessagesMap
    ) =>
      writePersistedThreadStorageState({
        snapshots,
        pendingDraftMessagesByWorkspace,
        lastActiveThreadIdByWorkspace: activeThreadIdByWorkspaceRef.current,
      }),
    []
  );

  const mergePersistedSnapshots = useCallback((nextSnapshots: ThreadSnapshotsMap) => {
    const filteredSnapshots = filterRestorableThreadSnapshots(nextSnapshots);
    if (Object.keys(threadSnapshotsRef.current).length === 0) {
      threadSnapshotsRef.current = filteredSnapshots;
      return;
    }
    threadSnapshotsRef.current = {
      ...filteredSnapshots,
      ...threadSnapshotsRef.current,
    };
  }, []);

  const getCustomName = useCallback((workspaceId: string, threadId: string) => {
    const key = makeCustomNameKey(workspaceId, threadId);
    return customNamesRef.current[key];
  }, []);

  const getPersistedThreadName = useCallback((workspaceId: string, threadId: string) => {
    const snapshot = threadSnapshotsRef.current[makeThreadSnapshotKey(workspaceId, threadId)];
    const name = snapshot?.name?.trim();
    return name && isMeaningfulThreadName(name) ? name : undefined;
  }, []);

  const hasSameSnapshotItems = useCallback(
    (left: ConversationItem[], right: ConversationItem[]) =>
      JSON.stringify(left) === JSON.stringify(right),
    []
  );

  const applyThreadSnapshotSync = useCallback(
    (
      threadsByWorkspace: Record<string, ThreadSummary[]>,
      itemsByThread: Record<string, ConversationItem[]>,
      threadStatusById: Record<string, ThreadActivityStatus>
    ) => {
      let changed = false;
      let nextSnapshots = threadSnapshotsRef.current;

      const ensureMutable = () => {
        if (!changed) {
          nextSnapshots = { ...threadSnapshotsRef.current };
          changed = true;
        }
      };

      for (const [workspaceId, threads] of Object.entries(threadsByWorkspace)) {
        for (const thread of threads) {
          if (!thread.id) {
            continue;
          }
          const key = makeThreadSnapshotKey(workspaceId, thread.id);
          const previous = nextSnapshots[key];
          const lastActivityAt = threadActivityRef.current[workspaceId]?.[thread.id] ?? 0;
          const processingStartedAt = threadStatusById[thread.id]?.processingStartedAt ?? 0;
          const nextSnapshot: PersistedThreadSnapshot = {
            workspaceId,
            threadId: thread.id,
            name: thread.name,
            updatedAt: Math.max(thread.updatedAt ?? 0, lastActivityAt, processingStartedAt),
            items: itemsByThread[thread.id] ?? previous?.items ?? [],
            lastDurationMs:
              threadStatusById[thread.id]?.lastDurationMs ?? previous?.lastDurationMs ?? null,
          };
          const shouldPersist = nextSnapshot.items.length > 0;
          if (!shouldPersist) {
            if (previous) {
              ensureMutable();
              delete nextSnapshots[key];
            }
            continue;
          }
          if (
            previous &&
            previous.workspaceId === nextSnapshot.workspaceId &&
            previous.threadId === nextSnapshot.threadId &&
            previous.name === nextSnapshot.name &&
            previous.updatedAt === nextSnapshot.updatedAt &&
            previous.lastDurationMs === nextSnapshot.lastDurationMs &&
            hasSameSnapshotItems(previous.items, nextSnapshot.items)
          ) {
            continue;
          }
          ensureMutable();
          nextSnapshots[key] = nextSnapshot;
        }
      }

      if (!changed) {
        return;
      }
      threadSnapshotsRef.current = nextSnapshots;
      void writePersistedThreadState(nextSnapshots, pendingDraftMessagesRef.current);
    },
    [hasSameSnapshotItems, writePersistedThreadState]
  );

  const flushPendingThreadSnapshotSync = useCallback(() => {
    if (!pendingThreadSnapshotSyncRef.current) {
      return;
    }
    const pendingSync = pendingThreadSnapshotSyncRef.current;
    pendingThreadSnapshotSyncRef.current = null;
    applyThreadSnapshotSync(
      pendingSync.threadsByWorkspace,
      pendingSync.itemsByThread,
      pendingSync.threadStatusById
    );
  }, [applyThreadSnapshotSync]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    customNamesRef.current = loadCustomNames();
    let cancelled = false;
    const hydrateLegacySnapshots = (options?: { persistToNative?: boolean }) => {
      const legacySnapshots = loadThreadSnapshots();
      mergePersistedSnapshots(legacySnapshots);
      threadSnapshotsReadyRef.current = true;
      setThreadSnapshotsReady(true);
      if (Object.keys(legacySnapshots).length === 0) {
        flushPendingThreadSnapshotSync();
        return;
      }
      if (options?.persistToNative === false) {
        flushPendingThreadSnapshotSync();
        return;
      }
      void Promise.resolve(
        writePersistedThreadState(legacySnapshots, pendingDraftMessagesRef.current)
      ).then((didPersist) => {
        if (didPersist) {
          clearThreadSnapshots();
        }
      });
      flushPendingThreadSnapshotSync();
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY_CUSTOM_NAMES) {
        customNamesRef.current = loadCustomNames();
      }
    };
    void readPersistedThreadStorageState()
      .then((persistedState) => {
        if (cancelled) {
          return;
        }
        pendingDraftMessagesRef.current = persistedState.pendingDraftMessagesByWorkspace;
        activeThreadIdByWorkspaceRef.current = persistedState.lastActiveThreadIdByWorkspace ?? {};
        const persistedSnapshots = persistedState.snapshots;
        const filteredPersistedSnapshots = filterRestorableThreadSnapshots(persistedSnapshots);
        if (Object.keys(persistedSnapshots).length > 0) {
          mergePersistedSnapshots(filteredPersistedSnapshots);
          threadSnapshotsReadyRef.current = true;
          setThreadSnapshotsReady(true);
          if (
            Object.keys(filteredPersistedSnapshots).length !==
            Object.keys(persistedSnapshots).length
          ) {
            void writePersistedThreadState(
              filteredPersistedSnapshots,
              pendingDraftMessagesRef.current
            );
          }
          clearThreadSnapshots();
          flushPendingThreadSnapshotSync();
          return;
        }
        hydrateLegacySnapshots();
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        hydrateLegacySnapshots({ persistToNative: false });
      });
    window.addEventListener("storage", handleStorage);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", handleStorage);
    };
  }, [flushPendingThreadSnapshotSync, mergePersistedSnapshots, writePersistedThreadState]);

  const recordThreadActivity = useCallback(
    (workspaceId: string, threadId: string, timestamp = Date.now()) => {
      const nextForWorkspace = {
        ...(threadActivityRef.current[workspaceId] ?? {}),
        [threadId]: timestamp,
      };
      const next = {
        ...threadActivityRef.current,
        [workspaceId]: nextForWorkspace,
      };
      threadActivityRef.current = next;
      saveThreadActivity(next);
    },
    []
  );

  const listThreadSnapshots = useCallback((workspaceId?: string | null) => {
    const snapshots = Object.values(threadSnapshotsRef.current);
    const filtered =
      workspaceId && workspaceId.trim().length > 0
        ? snapshots.filter((snapshot) => snapshot.workspaceId === workspaceId)
        : snapshots;
    return [...filtered].sort((left, right) => right.updatedAt - left.updatedAt);
  }, []);

  const getPersistedPendingDraftMessages = useCallback(
    (workspaceId: string) => pendingDraftMessagesRef.current[workspaceId] ?? [],
    []
  );

  const getPersistedActiveThreadId = useCallback(
    (workspaceId: string) => activeThreadIdByWorkspaceRef.current[workspaceId] ?? null,
    []
  );

  const getPersistedPendingInterruptThreadIds = useCallback(
    () => pendingInterruptThreadIdsRef.current,
    []
  );

  const persistActiveThreadId = useCallback(
    (workspaceId: string, threadId: string | null) => {
      const normalizedWorkspaceId = workspaceId.trim();
      const normalizedThreadId = threadId?.trim() ?? null;
      const currentThreadId = activeThreadIdByWorkspaceRef.current[normalizedWorkspaceId] ?? null;
      if (currentThreadId === normalizedThreadId) {
        return;
      }
      if (!normalizedThreadId) {
        const { [normalizedWorkspaceId]: _removed, ...rest } = activeThreadIdByWorkspaceRef.current;
        activeThreadIdByWorkspaceRef.current = rest;
        void writePersistedThreadState(threadSnapshotsRef.current, pendingDraftMessagesRef.current);
        return;
      }
      activeThreadIdByWorkspaceRef.current = {
        ...activeThreadIdByWorkspaceRef.current,
        [normalizedWorkspaceId]: normalizedThreadId,
      };
      void writePersistedThreadState(threadSnapshotsRef.current, pendingDraftMessagesRef.current);
    },
    [writePersistedThreadState]
  );

  const persistPendingDraftMessages = useCallback(
    (workspaceId: string, items: ConversationItem[]) => {
      const normalizedItems = items.filter(
        (item) => item.kind === "message" && item.role === "user"
      );
      const currentItems = pendingDraftMessagesRef.current[workspaceId] ?? [];
      if (JSON.stringify(currentItems) === JSON.stringify(normalizedItems)) {
        return;
      }
      if (normalizedItems.length === 0) {
        const { [workspaceId]: _removed, ...rest } = pendingDraftMessagesRef.current;
        pendingDraftMessagesRef.current = rest;
        void writePersistedThreadState(threadSnapshotsRef.current, rest);
        return;
      }
      const next = {
        ...pendingDraftMessagesRef.current,
        [workspaceId]: normalizedItems,
      };
      pendingDraftMessagesRef.current = next;
      void writePersistedThreadState(threadSnapshotsRef.current, next);
    },
    [writePersistedThreadState]
  );

  const persistPendingInterruptThreadIds = useCallback((threadIds: string[]) => {
    const normalizedThreadIds = [...new Set(threadIds.map((threadId) => threadId.trim()))].filter(
      (threadId) => threadId.length > 0
    );
    if (
      JSON.stringify(pendingInterruptThreadIdsRef.current) === JSON.stringify(normalizedThreadIds)
    ) {
      return;
    }
    pendingInterruptThreadIdsRef.current = normalizedThreadIds;
    writePersistedPendingInterruptThreadIds(normalizedThreadIds);
  }, []);

  const removeThreadSnapshot = useCallback(
    (workspaceId: string, threadId: string) => {
      const key = makeThreadSnapshotKey(workspaceId, threadId);
      if (!(key in threadSnapshotsRef.current)) {
        return;
      }
      const { [key]: _removed, ...rest } = threadSnapshotsRef.current;
      threadSnapshotsRef.current = rest;
      void writePersistedThreadState(rest, pendingDraftMessagesRef.current);
    },
    [writePersistedThreadState]
  );

  const syncThreadSnapshots = useCallback(
    (
      threadsByWorkspace: Record<string, ThreadSummary[]>,
      itemsByThread: Record<string, ConversationItem[]>,
      threadStatusById: Record<string, ThreadActivityStatus>
    ) => {
      if (!threadSnapshotsReadyRef.current) {
        pendingThreadSnapshotSyncRef.current = {
          threadsByWorkspace,
          itemsByThread,
          threadStatusById,
        };
        return;
      }
      applyThreadSnapshotSync(threadsByWorkspace, itemsByThread, threadStatusById);
    },
    [applyThreadSnapshotSync]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    pinnedThreadsRef.current = loadPinnedThreads();
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY_PINNED_THREADS) {
        return;
      }
      pinnedThreadsRef.current = loadPinnedThreads();
      setPinnedThreadsVersion((version) => version + 1);
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const pinThread = useCallback((workspaceId: string, threadId: string): boolean => {
    const key = makePinKey(workspaceId, threadId);
    if (key in pinnedThreadsRef.current) {
      return false;
    }
    const currentPinsForWorkspace = Object.keys(pinnedThreadsRef.current).filter((entry) =>
      entry.startsWith(`${workspaceId}:`)
    ).length;
    if (currentPinsForWorkspace >= MAX_PINS_SOFT_LIMIT) {
      logger.warn(`Pin limit reached (${MAX_PINS_SOFT_LIMIT}). Consider unpinning some threads.`);
    }
    const next = { ...pinnedThreadsRef.current, [key]: Date.now() };
    pinnedThreadsRef.current = next;
    savePinnedThreads(next);
    setPinnedThreadsVersion((version) => version + 1);
    return true;
  }, []);

  const unpinThread = useCallback((workspaceId: string, threadId: string) => {
    const key = makePinKey(workspaceId, threadId);
    if (!(key in pinnedThreadsRef.current)) {
      return;
    }
    const { [key]: _removed, ...rest } = pinnedThreadsRef.current;
    pinnedThreadsRef.current = rest;
    savePinnedThreads(rest);
    setPinnedThreadsVersion((version) => version + 1);
  }, []);

  const isThreadPinned = useCallback((workspaceId: string, threadId: string): boolean => {
    const key = makePinKey(workspaceId, threadId);
    return key in pinnedThreadsRef.current;
  }, []);

  const getPinTimestamp = useCallback((workspaceId: string, threadId: string): number | null => {
    const key = makePinKey(workspaceId, threadId);
    return pinnedThreadsRef.current[key] ?? null;
  }, []);

  return {
    customNamesRef,
    pinnedThreadsRef,
    threadSnapshotsRef,
    pendingDraftMessagesRef,
    threadActivityRef,
    pinnedThreadsVersion,
    threadSnapshotsReady,
    getCustomName,
    getPersistedThreadName,
    getPersistedPendingDraftMessages,
    getPersistedActiveThreadId,
    getPersistedPendingInterruptThreadIds,
    listThreadSnapshots,
    persistActiveThreadId,
    persistPendingDraftMessages,
    persistPendingInterruptThreadIds,
    recordThreadActivity,
    removeThreadSnapshot,
    syncThreadSnapshots,
    pinThread,
    unpinThread,
    isThreadPinned,
    getPinTimestamp,
  };
}
