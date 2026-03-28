import type { HugeCodeTaskMode } from "@ku0/code-runtime-host-contract";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  resolveChatgptAuthTokensRefreshResponse,
  respondToServerRequestResult,
  setThreadName as setThreadNameService,
} from "../../../application/runtime/ports/tauriThreads";
import type {
  AccessMode,
  ComposerExecutionMode,
  ConversationItem,
  CustomPromptOption,
  DebugEntry,
  ThreadListSortKey,
  WorkspaceInfo,
} from "../../../types";
import {
  type ChatgptAuthTokensRefreshRequest,
  useAppServerEvents,
} from "../../app/hooks/useAppServerEvents";
import type { AtlasLongTermMemoryDigest } from "../../atlas/utils/atlasContext";
import { loadDetachedReviewLinks, makeCustomNameKey, saveCustomName } from "../utils/threadStorage";
import { useThreadAccountInfo } from "./useThreadAccountInfo";
import { useThreadActions } from "./useThreadActions";
import { useThreadApprovals } from "./useThreadApprovals";
import { useThreadEventHandlers } from "./useThreadEventHandlers";
import { useThreadLifecycle } from "./useThreadLifecycle";
import { useThreadLinking } from "./useThreadLinking";
import { useThreadMessaging } from "./useThreadMessaging";
import { useThreadRateLimits } from "./useThreadRateLimits";
import { useThreadSelectors } from "./useThreadSelectors";
import { useThreadStatus } from "./useThreadStatus";
import { useThreadStorage } from "./useThreadStorage";
import { initialState, threadReducer } from "./useThreadsReducer";
import { useThreadTitleAutogeneration } from "./useThreadTitleAutogeneration";
import { useThreadToolCall } from "./useThreadToolCall";
import { useThreadUserInput } from "./useThreadUserInput";
import type { useThreadCodexParams } from "./useThreadCodexParams";

type UseThreadsOptions = {
  activeWorkspace: WorkspaceInfo | null;
  onWorkspaceConnected: (id: string) => void;
  onDebug?: (entry: DebugEntry) => void;
  hasAvailableModel?: boolean;
  toolsCapabilitySupport?: "supported" | "unsupported" | "unknown" | null;
  visionCapabilitySupport?: "supported" | "unsupported" | "unknown" | null;
  provider?: string | null;
  model?: string | null;
  effort?: string | null;
  fastMode?: boolean;
  collaborationMode?: Record<string, unknown> | null;
  accessMode?: AccessMode;
  executionMode?: ComposerExecutionMode;
  missionMode?: HugeCodeTaskMode | null;
  executionProfileId?: string | null;
  preferredBackendIds?: string[] | null;
  defaultCodexBin?: string | null;
  defaultCodexArgs?: string | null;
  reviewDeliveryMode?: "inline" | "detached";
  steerEnabled?: boolean;
  threadTitleAutogenerationEnabled?: boolean;
  customPrompts?: CustomPromptOption[];
  onMessageActivity?: () => void;
  threadSortKey?: ThreadListSortKey;
  getAtlasDriverOrder?: (workspaceId: string, threadId: string) => string[] | null | undefined;
  getAtlasEnabled?: (workspaceId: string, threadId: string) => boolean | null | undefined;
  getAtlasDetailLevel?: (workspaceId: string, threadId: string) => string | null | undefined;
  getAtlasLongTermMemoryDigest?: (
    workspaceId: string,
    threadId: string
  ) => AtlasLongTermMemoryDigest | null | undefined;
  upsertThreadAtlasMemoryDigest?: (
    workspaceId: string,
    threadId: string,
    digest: AtlasLongTermMemoryDigest
  ) => void;
  getThreadCodexParams?: ReturnType<typeof useThreadCodexParams>["getThreadCodexParams"];
};

export function useThreads({
  activeWorkspace,
  onWorkspaceConnected,
  onDebug,
  hasAvailableModel = true,
  toolsCapabilitySupport = "unknown",
  visionCapabilitySupport = "unknown",
  provider,
  model,
  effort,
  fastMode = false,
  collaborationMode,
  accessMode,
  executionMode = "runtime",
  missionMode,
  executionProfileId,
  preferredBackendIds,
  defaultCodexBin,
  defaultCodexArgs,
  reviewDeliveryMode = "inline",
  steerEnabled = true,
  threadTitleAutogenerationEnabled = true,
  customPrompts = [],
  onMessageActivity,
  threadSortKey = "updated_at",
  getAtlasDriverOrder,
  getAtlasEnabled,
  getAtlasDetailLevel,
  getAtlasLongTermMemoryDigest,
  upsertThreadAtlasMemoryDigest,
  getThreadCodexParams,
}: UseThreadsOptions) {
  const [state, dispatch] = useReducer(threadReducer, initialState);
  const [pendingDraftUserMessagesByWorkspace, setPendingDraftUserMessagesByWorkspace] = useState<
    Record<string, ConversationItem[]>
  >({});
  const loadedThreadsRef = useRef<Record<string, boolean>>({});
  const replaceOnResumeRef = useRef<Record<string, boolean>>({});
  const pendingInterruptsRef = useRef<Set<string>>(new Set());
  const activeThreadIdRef = useRef<string | null>(null);
  const planByThreadRef = useRef(state.planByThread);
  const itemsByThreadRef = useRef(state.itemsByThread);
  const threadsByWorkspaceRef = useRef(state.threadsByWorkspace);
  const detachedReviewStartedNoticeRef = useRef<Set<string>>(new Set());
  const detachedReviewCompletedNoticeRef = useRef<Set<string>>(new Set());
  const detachedReviewParentByChildRef = useRef<Record<string, string>>({});
  const detachedReviewLinksByWorkspaceRef = useRef(loadDetachedReviewLinks());
  const pendingInterruptsHydratedRef = useRef(false);
  const pendingDraftHydratedWorkspaceIdsRef = useRef<Set<string>>(new Set());
  const tokenUsageByThreadRef = useRef(state.tokenUsageByThread);
  const rateLimitsByWorkspaceRef = useRef(state.rateLimitsByWorkspace);
  planByThreadRef.current = state.planByThread;
  itemsByThreadRef.current = state.itemsByThread;
  tokenUsageByThreadRef.current = state.tokenUsageByThread;
  rateLimitsByWorkspaceRef.current = state.rateLimitsByWorkspace;
  threadsByWorkspaceRef.current = state.threadsByWorkspace;
  const { approvalAllowlistRef, handleApprovalDecision, handleApprovalRemember } =
    useThreadApprovals({ dispatch, onDebug });
  const { handleUserInputSubmit } = useThreadUserInput({ dispatch });
  const { handleToolCallSubmit } = useThreadToolCall({ dispatch });
  const {
    customNamesRef,
    listThreadSnapshots,
    threadSnapshotsReady,
    threadActivityRef,
    pinnedThreadsVersion,
    getCustomName,
    getPersistedActiveThreadId,
    getPersistedPendingInterruptThreadIds,
    getPersistedThreadName,
    getPersistedPendingDraftMessages,
    recordThreadActivity,
    removeThreadSnapshot,
    persistActiveThreadId,
    persistPendingInterruptThreadIds,
    persistPendingDraftMessages,
    syncThreadSnapshots,
    pinThread,
    unpinThread,
    isThreadPinned,
    getPinTimestamp,
  } = useThreadStorage();
  void pinnedThreadsVersion;

  const activeWorkspaceId = activeWorkspace?.id ?? null;
  const { activeThreadId, activeItems } = useThreadSelectors({
    activeWorkspaceId,
    activeThreadIdByWorkspace: state.activeThreadIdByWorkspace,
    itemsByThread: state.itemsByThread,
  });
  activeThreadIdRef.current = activeThreadId;
  const pendingDraftUserMessages = activeWorkspaceId
    ? (pendingDraftUserMessagesByWorkspace[activeWorkspaceId] ?? [])
    : [];
  const hasPendingDraftUserMessages = pendingDraftUserMessages.length > 0;

  const activeItemsWithPendingDraft = useMemo(() => {
    if (!pendingDraftUserMessages.length || activeThreadId) {
      return activeItems;
    }
    const activeItemIds = new Set(activeItems.map((item) => item.id));
    const missingPendingItems = pendingDraftUserMessages.filter(
      (pendingItem) => !activeItemIds.has(pendingItem.id)
    );
    if (!missingPendingItems.length) {
      return activeItems;
    }
    return [...activeItems, ...missingPendingItems];
  }, [activeItems, activeThreadId, pendingDraftUserMessages]);

  const getCurrentRateLimits = useCallback(
    (workspaceId: string) => rateLimitsByWorkspaceRef.current[workspaceId] ?? null,
    []
  );

  const syncPendingInterruptPersistence = useCallback(() => {
    persistPendingInterruptThreadIds([...pendingInterruptsRef.current]);
  }, [persistPendingInterruptThreadIds]);

  const { refreshAccountRateLimits, refreshAccountRateLimitsBatch } = useThreadRateLimits({
    activeWorkspaceId,
    activeWorkspaceConnected: activeWorkspace?.connected,
    getCurrentRateLimits,
    dispatch,
    onDebug,
  });
  const { refreshAccountInfo } = useThreadAccountInfo({
    activeWorkspaceId,
    activeWorkspaceConnected: activeWorkspace?.connected,
    dispatch,
    onDebug,
  });

  const { markProcessing, markReviewing, setActiveTurnId } = useThreadStatus({
    dispatch,
  });

  const pushThreadErrorMessage = useCallback(
    (threadId: string, message: string) => {
      dispatch({
        type: "addAssistantMessage",
        threadId,
        text: message,
      });
      if (threadId !== activeThreadId) {
        dispatch({ type: "markUnread", threadId, hasUnread: true });
      }
    },
    [activeThreadId]
  );

  const safeMessageActivity = useCallback(() => {
    try {
      void onMessageActivity?.();
    } catch {
      // Ignore refresh errors to avoid breaking the UI.
    }
  }, [onMessageActivity]);

  const setPendingDraftUserMessage = useCallback(
    (workspaceId: string, item: ConversationItem, operation: "add" | "remove") => {
      setPendingDraftUserMessagesByWorkspace((previous) => {
        const current = previous[workspaceId] ?? [];
        if (operation === "remove") {
          const next = current.filter((entry) => entry.id !== item.id);
          if (next.length === current.length) {
            return previous;
          }
          if (next.length === 0) {
            const { [workspaceId]: _discard, ...rest } = previous;
            persistPendingDraftMessages(workspaceId, []);
            return rest;
          }
          persistPendingDraftMessages(workspaceId, next);
          return {
            ...previous,
            [workspaceId]: next,
          };
        }
        if (current.some((entry) => entry.id === item.id)) {
          return previous;
        }
        const next = [...current, item];
        persistPendingDraftMessages(workspaceId, next);
        return {
          ...previous,
          [workspaceId]: next,
        };
      });
    },
    [persistPendingDraftMessages]
  );

  const renameThread = useCallback(
    (workspaceId: string, threadId: string, newName: string) => {
      saveCustomName(workspaceId, threadId, newName);
      const key = makeCustomNameKey(workspaceId, threadId);
      customNamesRef.current[key] = newName;
      dispatch({ type: "setThreadName", workspaceId, threadId, name: newName });
      void Promise.resolve(setThreadNameService(workspaceId, threadId, newName)).catch((error) => {
        onDebug?.({
          id: `${Date.now()}-client-thread-rename-error`,
          timestamp: Date.now(),
          source: "error",
          label: "thread/name/set error",
          payload: error instanceof Error ? error.message : String(error),
        });
      });
    },
    [customNamesRef, onDebug]
  );

  const { applyCollabThreadLinks, applyCollabThreadLinksFromThread, updateThreadParent } =
    useThreadLinking({
      dispatch,
      threadParentById: state.threadParentById,
    });

  const handleWorkspaceConnected = useCallback(
    (workspaceId: string) => {
      onWorkspaceConnected(workspaceId);
      void refreshAccountRateLimits(workspaceId);
      void refreshAccountInfo(workspaceId);
    },
    [onWorkspaceConnected, refreshAccountRateLimits, refreshAccountInfo]
  );

  const handleAccountUpdated = useCallback(
    (workspaceId: string) => {
      void refreshAccountRateLimits(workspaceId);
      void refreshAccountInfo(workspaceId);
    },
    [refreshAccountRateLimits, refreshAccountInfo]
  );

  if (!pendingInterruptsHydratedRef.current) {
    pendingInterruptsHydratedRef.current = true;
    pendingInterruptsRef.current = new Set(getPersistedPendingInterruptThreadIds());
  }

  useEffect(() => {
    if (!threadSnapshotsReady) {
      return;
    }
    const workspaceIdsToHydrate = new Set<string>(Object.keys(state.threadsByWorkspace));
    if (activeWorkspaceId) {
      workspaceIdsToHydrate.add(activeWorkspaceId);
    }
    const pendingDraftHydratedWorkspaceIds = pendingDraftHydratedWorkspaceIdsRef.current;
    const pendingWorkspaceIds = [...workspaceIdsToHydrate].filter(
      (workspaceId) => !pendingDraftHydratedWorkspaceIds.has(workspaceId)
    );
    if (pendingWorkspaceIds.length === 0) {
      return;
    }
    pendingWorkspaceIds.forEach((workspaceId) => {
      pendingDraftHydratedWorkspaceIds.add(workspaceId);
    });
    setPendingDraftUserMessagesByWorkspace((previous) => {
      const next = { ...previous };
      let changed = false;
      for (const workspaceId of pendingWorkspaceIds) {
        const persistedDrafts = getPersistedPendingDraftMessages(workspaceId);
        if (persistedDrafts.length === 0) {
          continue;
        }
        if (JSON.stringify(previous[workspaceId] ?? []) === JSON.stringify(persistedDrafts)) {
          continue;
        }
        next[workspaceId] = persistedDrafts;
        changed = true;
      }
      return changed ? next : previous;
    });
  }, [
    activeWorkspaceId,
    getPersistedPendingDraftMessages,
    state.threadsByWorkspace,
    threadSnapshotsReady,
  ]);

  const isThreadHidden = useCallback(
    (workspaceId: string, threadId: string) =>
      Boolean(state.hiddenThreadIdsByWorkspace[workspaceId]?.[threadId]),
    [state.hiddenThreadIdsByWorkspace]
  );

  const { onUserMessageCreated } = useThreadTitleAutogeneration({
    enabled: threadTitleAutogenerationEnabled,
    itemsByThreadRef,
    threadsByWorkspaceRef,
    getCustomName,
    renameThread,
    onDebug,
  });

  const {
    startThreadForWorkspace,
    forkThreadForWorkspace,
    resumeThreadForWorkspace,
    refreshThread,
    resetWorkspaceThreads,
    listThreadsForWorkspace,
    loadOlderThreadsForWorkspace,
    archiveThread,
  } = useThreadActions({
    dispatch,
    itemsByThread: state.itemsByThread,
    itemsByThreadRef,
    activeTurnIdByThread: state.activeTurnIdByThread,
    threadsByWorkspace: state.threadsByWorkspace,
    activeThreadIdByWorkspace: state.activeThreadIdByWorkspace,
    threadListCursorByWorkspace: state.threadListCursorByWorkspace,
    threadStatusById: state.threadStatusById,
    threadSortKey,
    onDebug,
    getCustomName,
    getPersistedThreadName,
    threadActivityRef,
    loadedThreadsRef,
    replaceOnResumeRef,
    applyCollabThreadLinksFromThread,
    updateThreadParent,
  });
  const { registerDetachedReviewChild, handleReviewExited, setActiveThreadId } = useThreadLifecycle(
    {
      activeWorkspace,
      activeWorkspaceId,
      activeThreadId,
      onDebug,
      threadSortKey,
      state: {
        threadsByWorkspace: state.threadsByWorkspace,
        itemsByThread: state.itemsByThread,
        threadStatusById: state.threadStatusById,
        threadParentById: state.threadParentById,
        activeThreadIdByWorkspace: state.activeThreadIdByWorkspace,
      },
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
    }
  );

  const threadHandlers = useThreadEventHandlers({
    activeThreadId,
    dispatch,
    itemsByThreadRef,
    planByThreadRef,
    refreshThreadSnapshot: (workspaceId, threadId) =>
      refreshThread(workspaceId, threadId, { replaceLocal: false }),
    getCurrentRateLimits,
    getCustomName,
    isThreadHidden,
    markProcessing,
    markReviewing,
    setActiveTurnId,
    safeMessageActivity,
    recordThreadActivity,
    onUserMessageCreated,
    pushThreadErrorMessage,
    onDebug,
    onWorkspaceConnected: handleWorkspaceConnected,
    applyCollabThreadLinks,
    upsertThreadAtlasMemoryDigest,
    onReviewExited: handleReviewExited,
    approvalAllowlistRef,
    pendingInterruptsRef,
    syncPendingInterruptPersistence,
  });

  const handleAccountLoginCompleted = useCallback(
    (workspaceId: string) => {
      handleAccountUpdated(workspaceId);
    },
    [handleAccountUpdated]
  );

  const handleChatgptAuthTokensRefreshRequest = useCallback(
    (request: ChatgptAuthTokensRefreshRequest) => {
      void Promise.resolve()
        .then(async () => {
          const refreshedTokens = await resolveChatgptAuthTokensRefreshResponse({
            previousAccountId: request.params.previous_account_id,
            chatgptWorkspaceId: request.params.chatgpt_workspace_id ?? null,
          });
          if (!refreshedTokens) {
            onDebug?.({
              id: `${Date.now()}-chatgpt-auth-token-refresh-unavailable`,
              timestamp: Date.now(),
              source: "error",
              label: "account/chatgptAuthTokens/refresh unavailable",
              payload: {
                workspaceId: request.workspace_id,
                requestId: request.request_id,
                reason: request.params.reason,
                previousAccountId: request.params.previous_account_id,
              },
            });
            await respondToServerRequestResult(request.workspace_id, request.request_id, {});
            return;
          }

          await respondToServerRequestResult(request.workspace_id, request.request_id, {
            accessToken: refreshedTokens.accessToken,
            chatgptAccountId: refreshedTokens.chatgptAccountId,
            chatgptPlanType: refreshedTokens.chatgptPlanType,
          });
        })
        .catch((error) => {
          onDebug?.({
            id: `${Date.now()}-chatgpt-auth-token-refresh-error`,
            timestamp: Date.now(),
            source: "error",
            label: "account/chatgptAuthTokens/refresh error",
            payload: error instanceof Error ? error.message : String(error),
          });
        });
    },
    [onDebug]
  );

  const handlers = useMemo(
    () => ({
      ...threadHandlers,
      onAccountUpdated: handleAccountUpdated,
      onAccountLoginCompleted: handleAccountLoginCompleted,
      onChatgptAuthTokensRefreshRequest: handleChatgptAuthTokensRefreshRequest,
    }),
    [
      threadHandlers,
      handleAccountUpdated,
      handleAccountLoginCompleted,
      handleChatgptAuthTokensRefreshRequest,
    ]
  );

  useAppServerEvents(handlers);

  const startThread = useCallback(async () => {
    if (!activeWorkspaceId) {
      return null;
    }
    return startThreadForWorkspace(activeWorkspaceId);
  }, [activeWorkspaceId, startThreadForWorkspace]);

  const ensureThreadForActiveWorkspace = useCallback(async () => {
    if (!activeWorkspace) {
      return null;
    }
    let threadId = activeThreadIdRef.current;
    if (!threadId) {
      threadId = await startThreadForWorkspace(activeWorkspace.id);
      if (!threadId) {
        return null;
      }
    } else if (!loadedThreadsRef.current[threadId]) {
      const resumedThreadId = await resumeThreadForWorkspace(activeWorkspace.id, threadId);
      if (!resumedThreadId) {
        threadId = await startThreadForWorkspace(activeWorkspace.id);
        if (!threadId) {
          return null;
        }
      } else {
        threadId = resumedThreadId;
      }
    }
    return threadId;
  }, [activeWorkspace, resumeThreadForWorkspace, startThreadForWorkspace]);

  const ensureThreadForWorkspace = useCallback(
    async (workspaceId: string) => {
      const currentActiveThreadId = state.activeThreadIdByWorkspace[workspaceId] ?? null;
      const shouldActivate = workspaceId === activeWorkspaceId;
      let threadId = currentActiveThreadId;
      if (!threadId) {
        threadId = await startThreadForWorkspace(workspaceId, {
          activate: shouldActivate,
        });
        if (!threadId) {
          return null;
        }
      } else if (!loadedThreadsRef.current[threadId]) {
        const resumedThreadId = await resumeThreadForWorkspace(workspaceId, threadId);
        if (!resumedThreadId) {
          threadId = await startThreadForWorkspace(workspaceId, {
            activate: shouldActivate,
          });
          if (!threadId) {
            return null;
          }
        } else {
          threadId = resumedThreadId;
        }
      }
      if (shouldActivate && currentActiveThreadId !== threadId) {
        dispatch({ type: "setActiveThreadId", workspaceId, threadId });
      }
      return threadId;
    },
    [
      activeWorkspaceId,
      resumeThreadForWorkspace,
      startThreadForWorkspace,
      state.activeThreadIdByWorkspace,
    ]
  );

  const {
    interruptTurn,
    sendUserMessage,
    sendUserMessageToThread,
    startFork,
    startReview,
    startResume,
    startCompact,
    startMcp,
    startStatus,
    reviewPrompt,
    openReviewPrompt,
    closeReviewPrompt,
    showPresetStep,
    choosePreset,
    highlightedPresetIndex,
    setHighlightedPresetIndex,
    highlightedBranchIndex,
    setHighlightedBranchIndex,
    highlightedCommitIndex,
    setHighlightedCommitIndex,
    handleReviewPromptKeyDown,
    confirmBranch,
    selectBranch,
    selectBranchAtIndex,
    selectCommit,
    selectCommitAtIndex,
    confirmCommit,
    updateCustomInstructions,
    confirmCustom,
  } = useThreadMessaging({
    activeWorkspace,
    activeThreadId,
    hasAvailableModel,
    toolsCapabilitySupport,
    visionCapabilitySupport,
    accessMode,
    provider,
    model,
    effort,
    fastMode,
    collaborationMode,
    missionMode,
    executionProfileId,
    preferredBackendIds,
    reviewDeliveryMode,
    steerEnabled,
    executionMode,
    defaultCodexBin,
    defaultCodexArgs,
    customPrompts,
    threadStatusById: state.threadStatusById,
    activeTurnIdByThread: state.activeTurnIdByThread,
    rateLimitsByWorkspace: state.rateLimitsByWorkspace,
    pendingInterruptsRef,
    syncPendingInterruptPersistence,
    dispatch,
    activeThreadIdRef,
    getCustomName,
    markProcessing,
    markReviewing,
    setActiveTurnId,
    recordThreadActivity,
    safeMessageActivity,
    onUserMessageCreated,
    onDebug,
    pushThreadErrorMessage,
    ensureThreadForActiveWorkspace,
    ensureThreadForWorkspace,
    refreshThread,
    forkThreadForWorkspace,
    updateThreadParent,
    registerDetachedReviewChild,
    setPendingDraftUserMessage,
    itemsByThreadRef,
    planByThreadRef,
    tokenUsageByThreadRef,
    getAtlasDriverOrder,
    getAtlasEnabled,
    getAtlasDetailLevel,
    getAtlasLongTermMemoryDigest,
    getThreadCodexParams,
  });

  const removeThread = useCallback(
    (workspaceId: string, threadId: string) => {
      unpinThread(workspaceId, threadId);
      removeThreadSnapshot(workspaceId, threadId);
      dispatch({ type: "removeThread", workspaceId, threadId });
      void archiveThread(workspaceId, threadId);
    },
    [archiveThread, removeThreadSnapshot, unpinThread]
  );

  return {
    threadSnapshotsReady,
    activeThreadId,
    setActiveThreadId,
    activeItems: activeItemsWithPendingDraft,
    itemsByThread: state.itemsByThread,
    hasPendingDraftUserMessages,
    approvals: state.approvals,
    userInputRequests: state.userInputRequests,
    toolCallRequests: state.toolCallRequests,
    threadsByWorkspace: state.threadsByWorkspace,
    threadParentById: state.threadParentById,
    threadStatusById: state.threadStatusById,
    threadResumeLoadingById: state.threadResumeLoadingById,
    threadListLoadingByWorkspace: state.threadListLoadingByWorkspace,
    threadListPagingByWorkspace: state.threadListPagingByWorkspace,
    threadListCursorByWorkspace: state.threadListCursorByWorkspace,
    activeTurnIdByThread: state.activeTurnIdByThread,
    turnDiffByThread: state.turnDiffByThread,
    tokenUsageByThread: state.tokenUsageByThread,
    rateLimitsByWorkspace: state.rateLimitsByWorkspace,
    accountByWorkspace: state.accountByWorkspace,
    planByThread: state.planByThread,
    lastAgentMessageByThread: state.lastAgentMessageByThread,
    refreshAccountRateLimits,
    refreshAccountRateLimitsBatch,
    refreshAccountInfo,
    interruptTurn,
    removeThread,
    pinThread,
    unpinThread,
    isThreadPinned,
    getPinTimestamp,
    renameThread,
    startThread,
    startThreadForWorkspace,
    forkThreadForWorkspace,
    listThreadsForWorkspace,
    refreshThread,
    resetWorkspaceThreads,
    loadOlderThreadsForWorkspace,
    sendUserMessage,
    sendUserMessageToThread,
    startFork,
    startReview,
    startResume,
    startCompact,
    startMcp,
    startStatus,
    reviewPrompt,
    openReviewPrompt,
    closeReviewPrompt,
    showPresetStep,
    choosePreset,
    highlightedPresetIndex,
    setHighlightedPresetIndex,
    highlightedBranchIndex,
    setHighlightedBranchIndex,
    highlightedCommitIndex,
    setHighlightedCommitIndex,
    handleReviewPromptKeyDown,
    confirmBranch,
    selectBranch,
    selectBranchAtIndex,
    selectCommit,
    selectCommitAtIndex,
    confirmCommit,
    updateCustomInstructions,
    confirmCustom,
    handleApprovalDecision,
    handleApprovalRemember,
    handleUserInputSubmit,
    handleToolCallSubmit,
  };
}
