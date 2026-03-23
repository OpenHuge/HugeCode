import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject } from "react";
import { useScopedRuntimeUpdatedEvent } from "../../../application/runtime/ports/runtimeUpdatedEvents";
import { mergeThreadItems } from "../../../utils/threadItems";
import type { DebugEntry, ThreadListSortKey, WorkspaceInfo } from "../../../types";
import { recordSentryMetric } from "../../shared/sentry";
import { saveDetachedReviewLinks, type PersistedThreadSnapshot } from "../utils/threadStorage";
import type { ThreadAction, ThreadState } from "./useThreadsReducer";

const RUNTIME_UPDATED_SKIP_THREAD_REFRESH_REASONS = new Set([
  "event_replay_gap",
  "event_stream_lagged",
  "stream_reconnected",
  "agent_task_durability_degraded",
  "code_turn_send",
  "code_turn_interrupt",
]);
const THREAD_RUNTIME_REFRESH_DEBOUNCE_MS = 220;

function recordThreadSwitchedMetric(params: { workspaceId: string; threadId: string }) {
  recordSentryMetric("thread_switched", 1, {
    attributes: {
      workspace_id: params.workspaceId,
      thread_id: params.threadId,
      reason: "select",
    },
  });
}

type ThreadSnapshotRecord = PersistedThreadSnapshot;

type UseThreadLifecycleOptions = {
  activeWorkspace: WorkspaceInfo | null;
  activeWorkspaceId: string | null;
  activeThreadId: string | null;
  onDebug?: (entry: DebugEntry) => void;
  threadSortKey: ThreadListSortKey;
  state: Pick<
    ThreadState,
    | "threadsByWorkspace"
    | "itemsByThread"
    | "threadStatusById"
    | "threadParentById"
    | "activeThreadIdByWorkspace"
  >;
  dispatch: Dispatch<ThreadAction>;
  threadSnapshotsReady: boolean;
  listThreadSnapshots: (workspaceId?: string | null) => ThreadSnapshotRecord[];
  getPersistedActiveThreadId: (workspaceId: string) => string | null;
  persistActiveThreadId: (workspaceId: string, threadId: string | null) => void;
  syncThreadSnapshots: (
    threadsByWorkspace: ThreadState["threadsByWorkspace"],
    itemsByThread: ThreadState["itemsByThread"],
    threadStatusById: ThreadState["threadStatusById"]
  ) => void;
  loadedThreadsRef: MutableRefObject<Record<string, boolean>>;
  itemsByThreadRef: MutableRefObject<ThreadState["itemsByThread"]>;
  detachedReviewStartedNoticeRef: MutableRefObject<Set<string>>;
  detachedReviewCompletedNoticeRef: MutableRefObject<Set<string>>;
  detachedReviewParentByChildRef: MutableRefObject<Record<string, string>>;
  detachedReviewLinksByWorkspaceRef: MutableRefObject<Record<string, Record<string, string>>>;
  recordThreadActivity: (workspaceId: string, threadId: string, timestamp?: number) => void;
  safeMessageActivity: () => void;
  updateThreadParent: (parentId: string, childIds: string[]) => void;
  listThreadsForWorkspace: (
    workspace: WorkspaceInfo,
    options?: { preserveState?: boolean }
  ) => Promise<unknown>;
  resumeThreadForWorkspace: (workspaceId: string, threadId: string) => Promise<string | null>;
};

export function useThreadLifecycle({
  activeWorkspace,
  activeWorkspaceId,
  activeThreadId,
  onDebug,
  threadSortKey,
  state,
  dispatch,
  threadSnapshotsReady,
  listThreadSnapshots,
  getPersistedActiveThreadId,
  persistActiveThreadId,
  syncThreadSnapshots,
  loadedThreadsRef,
  itemsByThreadRef,
  detachedReviewStartedNoticeRef,
  detachedReviewCompletedNoticeRef,
  detachedReviewParentByChildRef,
  detachedReviewLinksByWorkspaceRef,
  recordThreadActivity,
  safeMessageActivity,
  updateThreadParent,
  listThreadsForWorkspace,
  resumeThreadForWorkspace,
}: UseThreadLifecycleOptions) {
  const snapshotsHydratedRef = useRef(false);
  const listThreadsForWorkspaceRef = useRef(listThreadsForWorkspace);
  const threadsRuntimeUpdatedEvent = useScopedRuntimeUpdatedEvent({
    workspaceId: activeWorkspace?.id ?? null,
    scopes: ["threads", "bootstrap", "agents"],
  });

  useEffect(() => {
    listThreadsForWorkspaceRef.current = listThreadsForWorkspace;
  }, [listThreadsForWorkspace]);

  useEffect(() => {
    if (snapshotsHydratedRef.current || !threadSnapshotsReady) {
      return;
    }
    snapshotsHydratedRef.current = true;
    const snapshots = listThreadSnapshots();
    if (snapshots.length === 0) {
      return;
    }
    const threadsByWorkspace = new Map<string, { id: string; name: string; updatedAt: number }[]>();
    snapshots.forEach((snapshot) => {
      if (snapshot.items.length === 0) {
        return;
      }
      const existing = threadsByWorkspace.get(snapshot.workspaceId) ?? [];
      existing.push({
        id: snapshot.threadId,
        name: snapshot.name || "New Agent",
        updatedAt: snapshot.updatedAt,
      });
      threadsByWorkspace.set(snapshot.workspaceId, existing);
      const existingItems = itemsByThreadRef.current[snapshot.threadId] ?? [];
      dispatch({
        type: "setThreadItems",
        threadId: snapshot.threadId,
        items:
          existingItems.length > 0
            ? mergeThreadItems(existingItems, snapshot.items)
            : snapshot.items,
      });
      if (snapshot.lastDurationMs !== null && snapshot.lastDurationMs !== undefined) {
        dispatch({
          type: "hydrateThreadStatus",
          threadId: snapshot.threadId,
          lastDurationMs: snapshot.lastDurationMs,
        });
      }
    });
    threadsByWorkspace.forEach((threads, workspaceId) => {
      dispatch({
        type: "setThreads",
        workspaceId,
        threads,
        sortKey: threadSortKey,
      });
      const persistedActiveThreadId = getPersistedActiveThreadId(workspaceId);
      const preferredThreadId =
        (persistedActiveThreadId && threads.some((thread) => thread.id === persistedActiveThreadId)
          ? persistedActiveThreadId
          : null) ??
        threads.slice().sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))[0]
          ?.id ??
        null;
      const currentActiveThreadId = state.activeThreadIdByWorkspace[workspaceId] ?? null;
      const shouldPreferPersistedSnapshot =
        preferredThreadId !== null &&
        (!currentActiveThreadId || !loadedThreadsRef.current[currentActiveThreadId]);
      if (shouldPreferPersistedSnapshot && currentActiveThreadId !== preferredThreadId) {
        dispatch({
          type: "setActiveThreadId",
          workspaceId,
          threadId: preferredThreadId,
        });
      }
    });
  }, [
    dispatch,
    getPersistedActiveThreadId,
    itemsByThreadRef,
    listThreadSnapshots,
    loadedThreadsRef,
    state.activeThreadIdByWorkspace,
    threadSnapshotsReady,
    threadSortKey,
  ]);

  useEffect(() => {
    Object.entries(state.activeThreadIdByWorkspace).forEach(([workspaceId, threadId]) => {
      persistActiveThreadId(workspaceId, threadId ?? null);
    });
  }, [persistActiveThreadId, state.activeThreadIdByWorkspace]);

  useEffect(() => {
    if (!threadSnapshotsReady) {
      return;
    }
    syncThreadSnapshots(state.threadsByWorkspace, state.itemsByThread, state.threadStatusById);
  }, [
    state.itemsByThread,
    state.threadStatusById,
    state.threadsByWorkspace,
    syncThreadSnapshots,
    threadSnapshotsReady,
  ]);

  useEffect(() => {
    const linksByWorkspace = detachedReviewLinksByWorkspaceRef.current;
    Object.entries(state.threadsByWorkspace).forEach(([workspaceId, threads]) => {
      const workspaceLinks = linksByWorkspace[workspaceId];
      if (!workspaceLinks) {
        return;
      }
      const threadIds = new Set(threads.map((thread) => thread.id));
      Object.entries(workspaceLinks).forEach(([childId, parentId]) => {
        if (!childId || !parentId || childId === parentId) {
          return;
        }
        if (!threadIds.has(childId) || !threadIds.has(parentId)) {
          return;
        }
        if (state.threadParentById[childId]) {
          return;
        }
        updateThreadParent(parentId, [childId]);
      });
    });
  }, [
    detachedReviewLinksByWorkspaceRef,
    state.threadParentById,
    state.threadsByWorkspace,
    updateThreadParent,
  ]);

  useEffect(() => {
    const runtimeUpdatedEvent = threadsRuntimeUpdatedEvent.lastEvent;
    if (!runtimeUpdatedEvent || !activeWorkspace?.connected) {
      return;
    }
    if (RUNTIME_UPDATED_SKIP_THREAD_REFRESH_REASONS.has(runtimeUpdatedEvent.reason)) {
      return;
    }
    const debounceTimer = setTimeout(() => {
      if (!activeWorkspace.connected) {
        return;
      }
      onDebug?.({
        id: `${Date.now()}-server-runtime-updated-threads-refresh`,
        timestamp: Date.now(),
        source: "server",
        label: "native state fabric threads refresh",
        payload: runtimeUpdatedEvent.event,
      });
      void Promise.resolve(
        listThreadsForWorkspaceRef.current(activeWorkspace, { preserveState: true })
      ).catch(() => undefined);
    }, THREAD_RUNTIME_REFRESH_DEBOUNCE_MS);

    return () => {
      clearTimeout(debounceTimer);
    };
  }, [activeWorkspace, onDebug, threadsRuntimeUpdatedEvent]);

  const registerDetachedReviewChild = useCallback(
    (workspaceId: string, parentId: string, childId: string) => {
      if (!workspaceId || !parentId || !childId || parentId === childId) {
        return;
      }
      detachedReviewParentByChildRef.current[childId] = parentId;
      const existingWorkspaceLinks = detachedReviewLinksByWorkspaceRef.current[workspaceId] ?? {};
      if (existingWorkspaceLinks[childId] !== parentId) {
        const nextLinksByWorkspace = {
          ...detachedReviewLinksByWorkspaceRef.current,
          [workspaceId]: {
            ...existingWorkspaceLinks,
            [childId]: parentId,
          },
        };
        detachedReviewLinksByWorkspaceRef.current = nextLinksByWorkspace;
        saveDetachedReviewLinks(nextLinksByWorkspace);
      }

      const timestamp = Date.now();
      recordThreadActivity(workspaceId, parentId, timestamp);
      dispatch({
        type: "setThreadTimestamp",
        workspaceId,
        threadId: parentId,
        timestamp,
      });

      const noticeKey = `${parentId}->${childId}`;
      if (!detachedReviewStartedNoticeRef.current.has(noticeKey)) {
        detachedReviewStartedNoticeRef.current.add(noticeKey);
        dispatch({
          type: "addAssistantMessage",
          threadId: parentId,
          text: `Detached review started. [Open review thread](/thread/${childId})`,
        });
      }

      if (parentId !== activeThreadId) {
        dispatch({ type: "markUnread", threadId: parentId, hasUnread: true });
      }
      safeMessageActivity();
    },
    [
      activeThreadId,
      detachedReviewLinksByWorkspaceRef,
      detachedReviewParentByChildRef,
      detachedReviewStartedNoticeRef,
      dispatch,
      recordThreadActivity,
      safeMessageActivity,
    ]
  );

  const setActiveThreadId = useCallback(
    (threadId: string | null, workspaceId?: string) => {
      const targetId = workspaceId ?? activeWorkspaceId;
      if (!targetId) {
        return;
      }
      const currentThreadId = state.activeThreadIdByWorkspace[targetId] ?? null;
      dispatch({ type: "setActiveThreadId", workspaceId: targetId, threadId });
      if (threadId && currentThreadId !== threadId) {
        recordThreadSwitchedMetric({ workspaceId: targetId, threadId });
      }
      if (threadId) {
        void (async () => {
          const resumedThreadId = await resumeThreadForWorkspace(targetId, threadId);
          if (
            resumedThreadId ||
            !activeWorkspace ||
            activeWorkspace.id !== targetId ||
            (itemsByThreadRef.current[threadId]?.length ?? 0) > 0
          ) {
            return;
          }
          await listThreadsForWorkspace(activeWorkspace, { preserveState: true });
        })();
      }
    },
    [
      activeWorkspace,
      activeWorkspaceId,
      dispatch,
      itemsByThreadRef,
      listThreadsForWorkspace,
      resumeThreadForWorkspace,
      state.activeThreadIdByWorkspace,
    ]
  );

  const handleReviewExited = useCallback(
    (workspaceId: string, threadId: string) => {
      const parentId = detachedReviewParentByChildRef.current[threadId];
      if (!parentId) {
        return;
      }
      delete detachedReviewParentByChildRef.current[threadId];

      const timestamp = Date.now();
      recordThreadActivity(workspaceId, parentId, timestamp);
      dispatch({
        type: "setThreadTimestamp",
        workspaceId,
        threadId: parentId,
        timestamp,
      });
      const noticeKey = `${parentId}->${threadId}`;
      const alreadyNotified = detachedReviewCompletedNoticeRef.current.has(noticeKey);
      if (!alreadyNotified) {
        detachedReviewCompletedNoticeRef.current.add(noticeKey);
        dispatch({
          type: "addAssistantMessage",
          threadId: parentId,
          text: `Detached review completed. [Open review thread](/thread/${threadId})`,
        });
      }
      if (parentId !== activeThreadId) {
        dispatch({ type: "markUnread", threadId: parentId, hasUnread: true });
      }
      safeMessageActivity();
    },
    [
      activeThreadId,
      detachedReviewCompletedNoticeRef,
      detachedReviewParentByChildRef,
      dispatch,
      recordThreadActivity,
      safeMessageActivity,
    ]
  );

  return {
    registerDetachedReviewChild,
    handleReviewExited,
    setActiveThreadId,
  };
}
