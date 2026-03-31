import type { Dispatch, MutableRefObject } from "react";
import { useCallback, useRef } from "react";
import {
  archiveThread as archiveThreadService,
  forkThread as forkThreadService,
  listThreads as listThreadsService,
  resumeThread as resumeThreadService,
  startThread as startThreadService,
} from "../../../application/runtime/ports/tauriThreads";
import type {
  ConversationItem,
  DebugEntry,
  ThreadListSortKey,
  ThreadSummary,
  WorkspaceInfo,
} from "../../../types";
import {
  buildItemsFromThread,
  getThreadCreatedTimestamp,
  getThreadTimestamp,
  isReviewingFromThread,
  mergeThreadItems,
  previewThreadName,
} from "../../../utils/threadItems";
import type { ThreadExecutionState } from "../utils/threadExecutionState";
import { asString, normalizeRootPath } from "../utils/threadNormalize";
import {
  getMeaningfulThreadName,
  isMeaningfulThreadName,
  truncateThreadName,
} from "../utils/threadTitle";
import { saveThreadActivity } from "../utils/threadStorage";
import type { ThreadAction, ThreadState } from "./useThreadsReducer";

const THREAD_LIST_TARGET_COUNT = 20;
const THREAD_LIST_PAGE_SIZE = 100;
const THREAD_LIST_MAX_PAGES_WITH_ACTIVITY = 8;
const THREAD_LIST_MAX_PAGES_WITHOUT_ACTIVITY = 3;
const THREAD_LIST_MAX_PAGES_OLDER = 6;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as Record<string, unknown>;
}

function getParentThreadIdFromSource(source: unknown): string | null {
  const sourceRecord = asRecord(source);
  if (!sourceRecord) {
    return null;
  }
  const subAgent = asRecord(sourceRecord.subAgent ?? sourceRecord.sub_agent);
  if (!subAgent) {
    return null;
  }
  const threadSpawn = asRecord(subAgent.thread_spawn ?? subAgent.threadSpawn);
  if (!threadSpawn) {
    return null;
  }
  const parentId = asString(threadSpawn.parent_thread_id ?? threadSpawn.parentThreadId);
  return parentId || null;
}

function normalizeTurnStatus(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, "");
}

type ResumedTurnState = {
  turnId: string | null;
  executionState: ThreadExecutionState;
};

function getResumedTurnState(thread: Record<string, unknown>): ResumedTurnState {
  const turns = Array.isArray(thread.turns) ? (thread.turns as Array<Record<string, unknown>>) : [];
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (!turn || typeof turn !== "object") {
      continue;
    }
    const status = normalizeTurnStatus(turn.status ?? turn.turnStatus ?? turn.turn_status);
    const turnId = asString(turn.id ?? turn.turnId ?? turn.turn_id);
    if (!turnId) {
      continue;
    }
    if (
      status === "awaitingapproval" ||
      status === "needsapproval" ||
      status === "waitingapproval"
    ) {
      return {
        turnId,
        executionState: "awaitingApproval",
      };
    }
    const isInProgress =
      status === "inprogress" ||
      status === "running" ||
      status === "processing" ||
      status === "pending" ||
      status === "started";
    if (!isInProgress) {
      continue;
    }
    return {
      turnId,
      executionState: "running",
    };
  }
  return {
    turnId: null,
    executionState: "idle",
  };
}

function getListedThreadExecutionState(
  thread: Record<string, unknown>
): ThreadExecutionState | null {
  const normalizedStatus = normalizeTurnStatus(
    thread.status ?? thread.state ?? thread.type ?? thread.executionState
  );
  if (
    normalizedStatus === "awaitingapproval" ||
    normalizedStatus === "needsapproval" ||
    normalizedStatus === "waitingapproval"
  ) {
    return "awaitingApproval";
  }
  if (
    thread.running === true ||
    normalizedStatus === "active" ||
    normalizedStatus === "running" ||
    normalizedStatus === "processing" ||
    normalizedStatus === "pending" ||
    normalizedStatus === "started"
  ) {
    return "running";
  }
  if (
    thread.running === false ||
    normalizedStatus === "idle" ||
    normalizedStatus === "inactive" ||
    normalizedStatus === "completed" ||
    normalizedStatus === "done" ||
    normalizedStatus === "notloaded"
  ) {
    return "idle";
  }
  return null;
}

type UseThreadActionsOptions = {
  dispatch: Dispatch<ThreadAction>;
  itemsByThread: ThreadState["itemsByThread"];
  itemsByThreadRef: MutableRefObject<ThreadState["itemsByThread"]>;
  activeTurnIdByThread: ThreadState["activeTurnIdByThread"];
  threadsByWorkspace: ThreadState["threadsByWorkspace"];
  activeThreadIdByWorkspace: ThreadState["activeThreadIdByWorkspace"];
  threadListCursorByWorkspace: ThreadState["threadListCursorByWorkspace"];
  threadStatusById: ThreadState["threadStatusById"];
  threadSortKey: ThreadListSortKey;
  onDebug?: (entry: DebugEntry) => void;
  getCustomName: (workspaceId: string, threadId: string) => string | undefined;
  getPersistedThreadName: (workspaceId: string, threadId: string) => string | undefined;
  threadActivityRef: MutableRefObject<Record<string, Record<string, number>>>;
  loadedThreadsRef: MutableRefObject<Record<string, boolean>>;
  replaceOnResumeRef: MutableRefObject<Record<string, boolean>>;
  applyCollabThreadLinksFromThread: (threadId: string, thread: Record<string, unknown>) => void;
  updateThreadParent: (parentId: string, childIds: string[]) => void;
};

function getMeaningfulPreview(preview: string): string | null {
  return getMeaningfulThreadName(preview);
}

function resolveListedThreadName(params: {
  customName?: string;
  preview: string;
  fallbackName: string;
  existingName?: string;
}): string {
  if (params.customName) {
    return params.customName;
  }
  const meaningfulPreview = getMeaningfulPreview(params.preview);
  if (meaningfulPreview) {
    return truncateThreadName(meaningfulPreview);
  }
  const existingName = params.existingName?.trim();
  if (existingName && isMeaningfulThreadName(existingName)) {
    return existingName;
  }
  return params.fallbackName;
}

function hasText(value?: string): boolean {
  return (value?.trim().length ?? 0) > 0;
}

function isMeaningfulVisibleThreadOutput(item: ConversationItem): boolean {
  if (item.kind === "message") {
    return item.role === "assistant" && hasText(item.text);
  }
  if (item.kind === "tool") {
    return hasText(item.output) || (item.changes?.length ?? 0) > 0;
  }
  if (item.kind === "reasoning") {
    return hasText(item.summary) || hasText(item.content);
  }
  if (item.kind === "review") {
    return hasText(item.text);
  }
  if (item.kind === "diff") {
    return hasText(item.diff);
  }
  if (item.kind === "explore") {
    return item.entries.length > 0;
  }
  return false;
}

function hasVisibleRemoteOutputSinceLatestUserMessage(items: ConversationItem[]): boolean {
  let latestUserIndex = -1;
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item.kind === "message" && item.role === "user") {
      latestUserIndex = index;
      break;
    }
  }

  return items.slice(latestUserIndex + 1).some((item) => isMeaningfulVisibleThreadOutput(item));
}

export function useThreadActions({
  dispatch,
  itemsByThread,
  itemsByThreadRef,
  activeTurnIdByThread,
  threadsByWorkspace,
  activeThreadIdByWorkspace,
  threadListCursorByWorkspace,
  threadStatusById,
  threadSortKey,
  onDebug,
  getCustomName,
  getPersistedThreadName,
  threadActivityRef,
  loadedThreadsRef,
  replaceOnResumeRef,
  applyCollabThreadLinksFromThread,
  updateThreadParent,
}: UseThreadActionsOptions) {
  const resumeInFlightByThreadRef = useRef<Record<string, number>>({});

  const hasConclusiveSettledRemoteSnapshot = useCallback(
    (threadId: string, items: ConversationItem[], remoteTurns: Array<Record<string, unknown>>) => {
      const localStatus = threadStatusById[threadId];
      const localActiveTurnId = activeTurnIdByThread[threadId];
      if (!localStatus?.isProcessing && !localActiveTurnId) {
        return false;
      }
      if (remoteTurns.length > 0) {
        return true;
      }
      return hasVisibleRemoteOutputSinceLatestUserMessage(items);
    },
    [activeTurnIdByThread, threadStatusById]
  );

  const extractThreadId = useCallback((response: Record<string, unknown> | null | undefined) => {
    if (!response) {
      return "";
    }
    const result = asRecord(response.result);
    const thread = asRecord(result?.thread) ?? asRecord(response.thread);
    return String(thread?.id ?? "");
  }, []);

  const startThreadForWorkspace = useCallback(
    async (workspaceId: string, options?: { activate?: boolean }) => {
      const shouldActivate = options?.activate !== false;
      onDebug?.({
        id: `${Date.now()}-client-thread-start`,
        timestamp: Date.now(),
        source: "client",
        label: "thread/start",
        payload: { workspaceId },
      });
      try {
        const response = await startThreadService(workspaceId, {
          telemetrySource: "thread_actions",
        });
        onDebug?.({
          id: `${Date.now()}-server-thread-start`,
          timestamp: Date.now(),
          source: "server",
          label: "thread/start response",
          payload: response,
        });
        const threadId = extractThreadId(response);
        if (threadId) {
          dispatch({ type: "ensureThread", workspaceId, threadId });
          if (shouldActivate) {
            dispatch({ type: "setActiveThreadId", workspaceId, threadId });
          }
          loadedThreadsRef.current[threadId] = true;
          return threadId;
        }
        return null;
      } catch (error) {
        onDebug?.({
          id: `${Date.now()}-client-thread-start-error`,
          timestamp: Date.now(),
          source: "error",
          label: "thread/start error",
          payload: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    [dispatch, extractThreadId, loadedThreadsRef, onDebug]
  );

  const resumeThreadForWorkspace = useCallback(
    async (workspaceId: string, threadId: string, force = false, replaceLocal = false) => {
      if (!threadId) {
        return null;
      }
      if (!force && loadedThreadsRef.current[threadId]) {
        return threadId;
      }
      const status = threadStatusById[threadId];
      if (status?.isProcessing && loadedThreadsRef.current[threadId] && !force) {
        onDebug?.({
          id: `${Date.now()}-client-thread-resume-skipped`,
          timestamp: Date.now(),
          source: "client",
          label: "thread/resume skipped",
          payload: { workspaceId, threadId, reason: "active-turn" },
        });
        return threadId;
      }
      onDebug?.({
        id: `${Date.now()}-client-thread-resume`,
        timestamp: Date.now(),
        source: "client",
        label: "thread/resume",
        payload: { workspaceId, threadId },
      });
      const inFlightCount = (resumeInFlightByThreadRef.current[threadId] ?? 0) + 1;
      resumeInFlightByThreadRef.current[threadId] = inFlightCount;
      if (inFlightCount === 1) {
        dispatch({ type: "setThreadResumeLoading", threadId, isLoading: true });
      }
      try {
        const response = (await resumeThreadService(workspaceId, threadId, {
          telemetrySource: "thread_actions",
        })) as Record<string, unknown> | null;
        onDebug?.({
          id: `${Date.now()}-server-thread-resume`,
          timestamp: Date.now(),
          source: "server",
          label: "thread/resume response",
          payload: response,
        });
        const result = (response?.result ?? response) as Record<string, unknown> | null;
        const thread = (result?.thread ?? response?.thread ?? null) as Record<
          string,
          unknown
        > | null;
        if (!thread) {
          onDebug?.({
            id: `${Date.now()}-client-thread-resume-missing-thread`,
            timestamp: Date.now(),
            source: "error",
            label: "thread/resume missing thread",
            payload: { workspaceId, threadId, response },
          });
          return null;
        }
        dispatch({ type: "ensureThread", workspaceId, threadId });
        applyCollabThreadLinksFromThread(threadId, thread);
        const sourceParentId = getParentThreadIdFromSource(thread.source);
        if (sourceParentId) {
          updateThreadParent(sourceParentId, [threadId]);
        }
        const items = buildItemsFromThread(thread);
        const localItems = itemsByThreadRef.current[threadId] ?? itemsByThread[threadId] ?? [];
        const shouldReplace = replaceLocal || replaceOnResumeRef.current[threadId] === true;
        if (shouldReplace) {
          replaceOnResumeRef.current[threadId] = false;
        }
        const resumedTurnState = getResumedTurnState(thread);
        const remoteTurns = Array.isArray(thread.turns)
          ? (thread.turns as Array<Record<string, unknown>>)
          : [];
        const preserveLocalInFlightState =
          shouldReplace &&
          localItems.length > 0 &&
          resumedTurnState.executionState === "idle" &&
          resumedTurnState.turnId === null &&
          remoteTurns.length === 0 &&
          (threadStatusById[threadId]?.isProcessing === true ||
            typeof activeTurnIdByThread[threadId] === "string");
        const shouldHydrateSettledStateWithoutReplacing =
          !shouldReplace &&
          localItems.length > 0 &&
          resumedTurnState.executionState === "idle" &&
          resumedTurnState.turnId === null &&
          hasConclusiveSettledRemoteSnapshot(threadId, items, remoteTurns);
        if (
          (localItems.length === 0 || shouldReplace || shouldHydrateSettledStateWithoutReplacing) &&
          !preserveLocalInFlightState
        ) {
          dispatch({
            type: "markProcessing",
            threadId,
            isProcessing: resumedTurnState.executionState !== "idle",
            executionState: resumedTurnState.executionState,
            timestamp: Date.now(),
          });
          dispatch({
            type: "setActiveTurnId",
            threadId,
            turnId: resumedTurnState.turnId,
          });
          dispatch({
            type: "markReviewing",
            threadId,
            isReviewing: isReviewingFromThread(thread),
          });
        }
        const mergedItems =
          items.length > 0
            ? shouldReplace
              ? items
              : mergeThreadItems(items, localItems)
            : localItems;
        if (mergedItems.length > 0) {
          dispatch({ type: "setThreadItems", threadId, items: mergedItems });
        }
        const preview = asString(thread?.preview ?? "");
        const meaningfulPreview = getMeaningfulPreview(preview);
        const customName =
          getCustomName(workspaceId, threadId) ?? getPersistedThreadName(workspaceId, threadId);
        if (!customName && meaningfulPreview) {
          dispatch({
            type: "setThreadName",
            workspaceId,
            threadId,
            name: previewThreadName(meaningfulPreview, "New Agent"),
          });
        }
        const lastAgentMessage = [...mergedItems]
          .reverse()
          .find((item) => item.kind === "message" && item.role === "assistant") as
          | ConversationItem
          | undefined;
        const lastText =
          lastAgentMessage && lastAgentMessage.kind === "message"
            ? lastAgentMessage.text
            : (meaningfulPreview ?? "");
        if (lastText) {
          dispatch({
            type: "setLastAgentMessage",
            threadId,
            text: lastText,
            timestamp: getThreadTimestamp(thread),
          });
        }
        loadedThreadsRef.current[threadId] = true;
        return threadId;
      } catch (error) {
        onDebug?.({
          id: `${Date.now()}-client-thread-resume-error`,
          timestamp: Date.now(),
          source: "error",
          label: "thread/resume error",
          payload: error instanceof Error ? error.message : String(error),
        });
        return null;
      } finally {
        const nextCount = Math.max(0, (resumeInFlightByThreadRef.current[threadId] ?? 1) - 1);
        if (nextCount === 0) {
          delete resumeInFlightByThreadRef.current[threadId];
          dispatch({ type: "setThreadResumeLoading", threadId, isLoading: false });
        } else {
          resumeInFlightByThreadRef.current[threadId] = nextCount;
        }
      }
    },
    [
      applyCollabThreadLinksFromThread,
      dispatch,
      activeTurnIdByThread,
      getCustomName,
      itemsByThread,
      loadedThreadsRef,
      onDebug,
      replaceOnResumeRef,
      hasConclusiveSettledRemoteSnapshot,
      threadStatusById,
      updateThreadParent,
    ]
  );

  const forkThreadForWorkspace = useCallback(
    async (workspaceId: string, threadId: string) => {
      if (!threadId) {
        return null;
      }
      onDebug?.({
        id: `${Date.now()}-client-thread-fork`,
        timestamp: Date.now(),
        source: "client",
        label: "thread/fork",
        payload: { workspaceId, threadId },
      });
      try {
        const response = await forkThreadService(workspaceId, threadId);
        onDebug?.({
          id: `${Date.now()}-server-thread-fork`,
          timestamp: Date.now(),
          source: "server",
          label: "thread/fork response",
          payload: response,
        });
        const forkedThreadId = extractThreadId(response);
        if (!forkedThreadId) {
          return null;
        }
        dispatch({ type: "ensureThread", workspaceId, threadId: forkedThreadId });
        dispatch({
          type: "setActiveThreadId",
          workspaceId,
          threadId: forkedThreadId,
        });
        loadedThreadsRef.current[forkedThreadId] = false;
        await resumeThreadForWorkspace(workspaceId, forkedThreadId, true, true);
        return forkedThreadId;
      } catch (error) {
        onDebug?.({
          id: `${Date.now()}-client-thread-fork-error`,
          timestamp: Date.now(),
          source: "error",
          label: "thread/fork error",
          payload: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    },
    [dispatch, extractThreadId, loadedThreadsRef, onDebug, resumeThreadForWorkspace]
  );

  const refreshThread = useCallback(
    async (
      workspaceId: string,
      threadId: string,
      options?: {
        replaceLocal?: boolean;
      }
    ) => {
      if (!threadId) {
        return null;
      }
      const shouldReplace = options?.replaceLocal !== false;
      replaceOnResumeRef.current[threadId] = shouldReplace;
      return resumeThreadForWorkspace(workspaceId, threadId, true, shouldReplace);
    },
    [replaceOnResumeRef, resumeThreadForWorkspace]
  );

  const resetWorkspaceThreads = useCallback(
    (workspaceId: string) => {
      const threadIds = new Set<string>();
      const list = threadsByWorkspace[workspaceId] ?? [];
      list.forEach((thread) => {
        threadIds.add(thread.id);
      });
      const activeThread = activeThreadIdByWorkspace[workspaceId];
      if (activeThread) {
        threadIds.add(activeThread);
      }
      threadIds.forEach((threadId) => {
        loadedThreadsRef.current[threadId] = false;
      });
    },
    [activeThreadIdByWorkspace, loadedThreadsRef, threadsByWorkspace]
  );

  const listThreadsForWorkspace = useCallback(
    async (
      workspace: WorkspaceInfo,
      options?: {
        preserveState?: boolean;
        sortKey?: ThreadListSortKey;
      }
    ) => {
      const preserveState = options?.preserveState ?? false;
      const requestedSortKey = options?.sortKey ?? threadSortKey;
      const workspacePath = normalizeRootPath(workspace.path);
      if (!preserveState) {
        dispatch({
          type: "setThreadListLoading",
          workspaceId: workspace.id,
          isLoading: true,
        });
        dispatch({
          type: "setThreadListCursor",
          workspaceId: workspace.id,
          cursor: null,
        });
      }
      onDebug?.({
        id: `${Date.now()}-client-thread-list`,
        timestamp: Date.now(),
        source: "client",
        label: "thread/list",
        payload: { workspaceId: workspace.id, path: workspace.path },
      });
      try {
        const knownActivityByThread = threadActivityRef.current[workspace.id] ?? {};
        const hasKnownActivity = Object.keys(knownActivityByThread).length > 0;
        const matchingThreads: Record<string, unknown>[] = [];
        const maxPagesWithoutMatch = hasKnownActivity
          ? THREAD_LIST_MAX_PAGES_WITH_ACTIVITY
          : THREAD_LIST_MAX_PAGES_WITHOUT_ACTIVITY;
        let pagesFetched = 0;
        let cursor: string | null = null;
        do {
          pagesFetched += 1;
          const response = (await listThreadsService(
            workspace.id,
            cursor,
            THREAD_LIST_PAGE_SIZE,
            requestedSortKey
          )) as Record<string, unknown>;
          onDebug?.({
            id: `${Date.now()}-server-thread-list`,
            timestamp: Date.now(),
            source: "server",
            label: "thread/list response",
            payload: response,
          });
          const result = (response.result ?? response) as Record<string, unknown>;
          const data = Array.isArray(result?.data)
            ? (result.data as Record<string, unknown>[])
            : [];
          const nextCursor = (result?.nextCursor ?? result?.next_cursor ?? null) as string | null;
          matchingThreads.push(
            ...data.filter(
              (thread) => normalizeRootPath(String(thread?.cwd ?? "")) === workspacePath
            )
          );
          cursor = nextCursor;
          if (matchingThreads.length === 0 && pagesFetched >= maxPagesWithoutMatch) {
            break;
          }
          if (pagesFetched >= THREAD_LIST_MAX_PAGES_WITH_ACTIVITY) {
            break;
          }
        } while (cursor && matchingThreads.length < THREAD_LIST_TARGET_COUNT);

        const uniqueById = new Map<string, Record<string, unknown>>();
        matchingThreads.forEach((thread) => {
          const id = String(thread?.id ?? "");
          if (id && !uniqueById.has(id)) {
            uniqueById.set(id, thread);
          }
        });
        const uniqueThreads = Array.from(uniqueById.values());
        const activityByThread = threadActivityRef.current[workspace.id] ?? {};
        const nextActivityByThread = { ...activityByThread };
        let didChangeActivity = false;
        uniqueThreads.forEach((thread) => {
          const threadId = String(thread?.id ?? "");
          if (!threadId) {
            return;
          }
          const sourceParentId = getParentThreadIdFromSource(thread.source);
          if (sourceParentId) {
            updateThreadParent(sourceParentId, [threadId]);
          }
          const listedExecutionState = getListedThreadExecutionState(thread);
          if (listedExecutionState) {
            const hasLocalActiveTurn = Boolean(activeTurnIdByThread[threadId]?.trim());
            if (!(listedExecutionState === "idle" && hasLocalActiveTurn)) {
              dispatch({
                type: "markProcessing",
                threadId,
                isProcessing: listedExecutionState !== "idle",
                executionState: listedExecutionState,
                timestamp: Date.now(),
              });
              if (listedExecutionState === "idle") {
                dispatch({
                  type: "setActiveTurnId",
                  threadId,
                  turnId: null,
                });
              }
            }
          }
          const timestamp = getThreadTimestamp(thread);
          if (timestamp > (nextActivityByThread[threadId] ?? 0)) {
            nextActivityByThread[threadId] = timestamp;
            didChangeActivity = true;
          }
        });
        if (didChangeActivity) {
          const next = {
            ...threadActivityRef.current,
            [workspace.id]: nextActivityByThread,
          };
          threadActivityRef.current = next;
          saveThreadActivity(next);
        }
        if (requestedSortKey === "updated_at") {
          uniqueThreads.sort((a, b) => {
            const aId = String(a?.id ?? "");
            const bId = String(b?.id ?? "");
            const aCreated = getThreadTimestamp(a);
            const bCreated = getThreadTimestamp(b);
            const aActivity = Math.max(nextActivityByThread[aId] ?? 0, aCreated);
            const bActivity = Math.max(nextActivityByThread[bId] ?? 0, bCreated);
            return bActivity - aActivity;
          });
        } else {
          uniqueThreads.sort((a, b) => {
            const delta = getThreadCreatedTimestamp(b) - getThreadCreatedTimestamp(a);
            if (delta !== 0) {
              return delta;
            }
            const aId = String(a?.id ?? "");
            const bId = String(b?.id ?? "");
            return aId.localeCompare(bId);
          });
        }
        const existingNamesByThreadId = new Map(
          (threadsByWorkspace[workspace.id] ?? []).map((thread) => [thread.id, thread.name])
        );
        const summaries = uniqueThreads
          .slice(0, THREAD_LIST_TARGET_COUNT)
          .map((thread, index) => {
            const id = String(thread?.id ?? "");
            const preview = asString(thread?.preview ?? "").trim();
            const customName =
              getCustomName(workspace.id, id) ?? getPersistedThreadName(workspace.id, id);
            const fallbackName = `Agent ${index + 1}`;
            const name = resolveListedThreadName({
              customName,
              preview,
              fallbackName,
              existingName: existingNamesByThreadId.get(id),
            });
            return {
              id,
              name,
              updatedAt: getThreadTimestamp(thread),
            };
          })
          .filter((entry) => entry.id);
        dispatch({
          type: "setThreads",
          workspaceId: workspace.id,
          threads: summaries,
          sortKey: requestedSortKey,
        });
        dispatch({
          type: "setThreadListCursor",
          workspaceId: workspace.id,
          cursor,
        });
        uniqueThreads.forEach((thread) => {
          const threadId = String(thread?.id ?? "");
          const preview = getMeaningfulPreview(asString(thread?.preview ?? ""));
          if (!threadId || !preview) {
            return;
          }
          dispatch({
            type: "setLastAgentMessage",
            threadId,
            text: preview,
            timestamp: getThreadTimestamp(thread),
          });
        });
      } catch (error) {
        onDebug?.({
          id: `${Date.now()}-client-thread-list-error`,
          timestamp: Date.now(),
          source: "error",
          label: "thread/list error",
          payload: error instanceof Error ? error.message : String(error),
        });
      } finally {
        if (!preserveState) {
          dispatch({
            type: "setThreadListLoading",
            workspaceId: workspace.id,
            isLoading: false,
          });
        }
      }
    },
    [
      dispatch,
      getCustomName,
      getPersistedThreadName,
      onDebug,
      threadActivityRef,
      threadSortKey,
      updateThreadParent,
    ]
  );

  const loadOlderThreadsForWorkspace = useCallback(
    async (workspace: WorkspaceInfo) => {
      const requestedSortKey = threadSortKey;
      const nextCursor = threadListCursorByWorkspace[workspace.id] ?? null;
      if (!nextCursor) {
        return;
      }
      const workspacePath = normalizeRootPath(workspace.path);
      const existing = threadsByWorkspace[workspace.id] ?? [];
      dispatch({
        type: "setThreadListPaging",
        workspaceId: workspace.id,
        isLoading: true,
      });
      onDebug?.({
        id: `${Date.now()}-client-thread-list-older`,
        timestamp: Date.now(),
        source: "client",
        label: "thread/list older",
        payload: { workspaceId: workspace.id, cursor: nextCursor },
      });
      try {
        const matchingThreads: Record<string, unknown>[] = [];
        const maxPagesWithoutMatch = THREAD_LIST_MAX_PAGES_OLDER;
        let pagesFetched = 0;
        let cursor: string | null = nextCursor;
        do {
          pagesFetched += 1;
          const response = (await listThreadsService(
            workspace.id,
            cursor,
            THREAD_LIST_PAGE_SIZE,
            requestedSortKey
          )) as Record<string, unknown>;
          onDebug?.({
            id: `${Date.now()}-server-thread-list-older`,
            timestamp: Date.now(),
            source: "server",
            label: "thread/list older response",
            payload: response,
          });
          const result = (response.result ?? response) as Record<string, unknown>;
          const data = Array.isArray(result?.data)
            ? (result.data as Record<string, unknown>[])
            : [];
          const next = (result?.nextCursor ?? result?.next_cursor ?? null) as string | null;
          matchingThreads.push(
            ...data.filter(
              (thread) => normalizeRootPath(String(thread?.cwd ?? "")) === workspacePath
            )
          );
          cursor = next;
          if (matchingThreads.length === 0 && pagesFetched >= maxPagesWithoutMatch) {
            break;
          }
          if (pagesFetched >= THREAD_LIST_MAX_PAGES_OLDER) {
            break;
          }
        } while (cursor && matchingThreads.length < THREAD_LIST_TARGET_COUNT);

        const existingIds = new Set(existing.map((thread) => thread.id));
        const additions: ThreadSummary[] = [];
        matchingThreads.forEach((thread) => {
          const id = String(thread?.id ?? "");
          if (!id || existingIds.has(id)) {
            return;
          }
          const sourceParentId = getParentThreadIdFromSource(thread.source);
          if (sourceParentId) {
            updateThreadParent(sourceParentId, [id]);
          }
          const preview = asString(thread?.preview ?? "").trim();
          const customName =
            getCustomName(workspace.id, id) ?? getPersistedThreadName(workspace.id, id);
          const fallbackName = `Agent ${existing.length + additions.length + 1}`;
          const name = resolveListedThreadName({
            customName,
            preview,
            fallbackName,
          });
          additions.push({ id, name, updatedAt: getThreadTimestamp(thread) });
          existingIds.add(id);
        });

        if (additions.length > 0) {
          dispatch({
            type: "setThreads",
            workspaceId: workspace.id,
            threads: [...existing, ...additions],
            sortKey: requestedSortKey,
          });
        }
        dispatch({
          type: "setThreadListCursor",
          workspaceId: workspace.id,
          cursor,
        });
        matchingThreads.forEach((thread) => {
          const threadId = String(thread?.id ?? "");
          const preview = getMeaningfulPreview(asString(thread?.preview ?? ""));
          if (!threadId || !preview) {
            return;
          }
          dispatch({
            type: "setLastAgentMessage",
            threadId,
            text: preview,
            timestamp: getThreadTimestamp(thread),
          });
        });
      } catch (error) {
        onDebug?.({
          id: `${Date.now()}-client-thread-list-older-error`,
          timestamp: Date.now(),
          source: "error",
          label: "thread/list older error",
          payload: error instanceof Error ? error.message : String(error),
        });
      } finally {
        dispatch({
          type: "setThreadListPaging",
          workspaceId: workspace.id,
          isLoading: false,
        });
      }
    },
    [
      dispatch,
      getCustomName,
      getPersistedThreadName,
      onDebug,
      threadListCursorByWorkspace,
      threadsByWorkspace,
      threadSortKey,
      updateThreadParent,
    ]
  );

  const archiveThread = useCallback(
    async (workspaceId: string, threadId: string) => {
      try {
        await archiveThreadService(workspaceId, threadId, {
          telemetrySource: "thread_actions",
        });
      } catch (error) {
        onDebug?.({
          id: `${Date.now()}-client-thread-archive-error`,
          timestamp: Date.now(),
          source: "error",
          label: "thread/archive error",
          payload: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [onDebug]
  );

  return {
    startThreadForWorkspace,
    forkThreadForWorkspace,
    resumeThreadForWorkspace,
    refreshThread,
    resetWorkspaceThreads,
    listThreadsForWorkspace,
    loadOlderThreadsForWorkspace,
    archiveThread,
  };
}
