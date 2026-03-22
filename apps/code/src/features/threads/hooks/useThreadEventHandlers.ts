import type { Dispatch, MutableRefObject } from "react";
import { useCallback, useMemo } from "react";
import type {
  AppServerEvent,
  ConversationItem,
  DebugEntry,
  RateLimitSnapshot,
  TurnPlan,
} from "../../../types";
import { getAppServerRawMethod } from "../../../utils/appServerEvents";
import type { AtlasLongTermMemoryDigest } from "../../atlas/utils/atlasContext";
import type { ThreadExecutionState } from "../utils/threadExecutionState";
import { useThreadApprovalEvents } from "./useThreadApprovalEvents";
import { useThreadItemEvents } from "./useThreadItemEvents";
import type { ThreadAction } from "./useThreadsReducer";
import { useThreadToolCallEvents } from "./useThreadToolCallEvents";
import { useThreadTurnEvents } from "./useThreadTurnEvents";
import { useThreadUserInputEvents } from "./useThreadUserInputEvents";

type ThreadEventHandlersOptions = {
  activeThreadId: string | null;
  dispatch: Dispatch<ThreadAction>;
  itemsByThreadRef: MutableRefObject<Record<string, ConversationItem[]>>;
  planByThreadRef: MutableRefObject<Record<string, TurnPlan | null>>;
  refreshThreadSnapshot?: (workspaceId: string, threadId: string) => Promise<unknown> | unknown;
  getCurrentRateLimits?: (workspaceId: string) => RateLimitSnapshot | null;
  getCustomName: (workspaceId: string, threadId: string) => string | undefined;
  isThreadHidden: (workspaceId: string, threadId: string) => boolean;
  markProcessing: (
    threadId: string,
    isProcessing: boolean,
    executionState?: ThreadExecutionState
  ) => void;
  markReviewing: (threadId: string, isReviewing: boolean) => void;
  setActiveTurnId: (threadId: string, turnId: string | null) => void;
  safeMessageActivity: () => void;
  recordThreadActivity: (workspaceId: string, threadId: string, timestamp?: number) => void;
  onUserMessageCreated?: (
    workspaceId: string,
    threadId: string,
    text: string
  ) => void | Promise<void>;
  pushThreadErrorMessage: (threadId: string, message: string) => void;
  onDebug?: (entry: DebugEntry) => void;
  onWorkspaceConnected: (workspaceId: string) => void;
  applyCollabThreadLinks: (threadId: string, item: Record<string, unknown>) => void;
  upsertThreadAtlasMemoryDigest?: (
    workspaceId: string,
    threadId: string,
    digest: AtlasLongTermMemoryDigest
  ) => void;
  onReviewExited?: (workspaceId: string, threadId: string) => void;
  approvalAllowlistRef: MutableRefObject<Record<string, string[][]>>;
  pendingInterruptsRef: MutableRefObject<Set<string>>;
  syncPendingInterruptPersistence?: () => void;
};

function normalizeThreadStatusValue(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, "");
}

function resolveThreadStatusUpdate(
  status: Record<string, unknown> | string | null
): { isProcessing: boolean; executionState: ThreadExecutionState } | null {
  const normalizedStatus = normalizeThreadStatusValue(
    typeof status === "string"
      ? status
      : (status?.status ?? status?.state ?? status?.type ?? status?.executionState)
  );
  if (
    normalizedStatus === "active" ||
    normalizedStatus === "running" ||
    normalizedStatus === "processing" ||
    normalizedStatus === "pending" ||
    normalizedStatus === "started"
  ) {
    return {
      isProcessing: true,
      executionState: "running",
    };
  }
  if (
    normalizedStatus === "awaitingapproval" ||
    normalizedStatus === "needsapproval" ||
    normalizedStatus === "waitingapproval"
  ) {
    return {
      isProcessing: true,
      executionState: "awaitingApproval",
    };
  }
  if (
    normalizedStatus === "idle" ||
    normalizedStatus === "inactive" ||
    normalizedStatus === "completed" ||
    normalizedStatus === "done" ||
    normalizedStatus === "notloaded"
  ) {
    return {
      isProcessing: false,
      executionState: "idle",
    };
  }
  return null;
}

export function useThreadEventHandlers({
  activeThreadId,
  dispatch,
  itemsByThreadRef,
  planByThreadRef,
  refreshThreadSnapshot,
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
  onWorkspaceConnected,
  applyCollabThreadLinks,
  upsertThreadAtlasMemoryDigest,
  onReviewExited,
  approvalAllowlistRef,
  pendingInterruptsRef,
  syncPendingInterruptPersistence,
}: ThreadEventHandlersOptions) {
  const routeApprovalRequest = useThreadApprovalEvents({
    dispatch,
    approvalAllowlistRef,
  });
  const onApprovalRequest = useCallback(
    (request: Parameters<typeof routeApprovalRequest>[0]) => {
      const threadIdRaw = request.params?.threadId ?? request.params?.thread_id ?? "";
      const threadId = typeof threadIdRaw === "string" ? threadIdRaw.trim() : "";
      if (threadId) {
        markProcessing(threadId, true, "awaitingApproval");
      }
      routeApprovalRequest(request);
    },
    [markProcessing, routeApprovalRequest]
  );
  const onApprovalResolved = useCallback(
    (
      workspaceId: string,
      payload: {
        approvalId: string;
        threadId: string;
        turnId: string;
        status: "approved" | "rejected" | "interrupted" | "resolved";
      }
    ) => {
      if (payload.approvalId) {
        dispatch({
          type: "removeApproval",
          requestId: payload.approvalId,
          workspaceId,
        });
      }
      const threadId = payload.threadId.trim();
      if (!threadId) {
        return;
      }
      if (payload.status === "approved") {
        markProcessing(threadId, true, "running");
        return;
      }
      if (payload.status === "resolved") {
        return;
      }
      markProcessing(threadId, false, "idle");
    },
    [dispatch, markProcessing]
  );
  const onRequestUserInput = useThreadUserInputEvents({ dispatch });
  const onToolCallRequest = useThreadToolCallEvents({ dispatch });

  const onThreadStatusChanged = useCallback(
    (
      _workspaceId: string,
      payload: { threadId: string; status: Record<string, unknown> | string | null }
    ) => {
      const threadId = payload.threadId.trim();
      if (!threadId) {
        return;
      }
      const nextStatus = resolveThreadStatusUpdate(payload.status);
      if (!nextStatus) {
        return;
      }
      markProcessing(threadId, nextStatus.isProcessing, nextStatus.executionState);
    },
    [markProcessing]
  );

  const onThreadArchived = useCallback(
    (workspaceId: string, threadId: string) => {
      dispatch({ type: "hideThread", workspaceId, threadId });
    },
    [dispatch]
  );

  const onThreadUnarchived = useCallback(
    (workspaceId: string, threadId: string) => {
      dispatch({ type: "ensureThread", workspaceId, threadId });
      recordThreadActivity(workspaceId, threadId, Date.now());
    },
    [dispatch, recordThreadActivity]
  );

  const onRawResponseItemCompleted = useCallback(
    (
      workspaceId: string,
      payload: { threadId: string; turnId: string; item: Record<string, unknown> }
    ) => {
      if (!payload.threadId) {
        return;
      }
      dispatch({ type: "ensureThread", workspaceId, threadId: payload.threadId });
      applyCollabThreadLinks(payload.threadId, payload.item);
      recordThreadActivity(workspaceId, payload.threadId, Date.now());
      safeMessageActivity();
    },
    [applyCollabThreadLinks, dispatch, recordThreadActivity, safeMessageActivity]
  );

  const onMcpToolCallProgress = useCallback(
    (
      workspaceId: string,
      payload: { threadId: string; turnId: string; itemId: string; message: string }
    ) => {
      dispatch({ type: "ensureThread", workspaceId, threadId: payload.threadId });
      dispatch({
        type: "appendToolOutput",
        threadId: payload.threadId,
        itemId: payload.itemId,
        delta: payload.message,
      });
      recordThreadActivity(workspaceId, payload.threadId, Date.now());
      safeMessageActivity();
    },
    [dispatch, recordThreadActivity, safeMessageActivity]
  );

  const {
    onAgentMessageDelta,
    onAgentMessageCompleted,
    onItemStarted,
    onItemUpdated,
    onItemCompleted,
    onReasoningSummaryDelta,
    onReasoningSummaryBoundary,
    onReasoningTextDelta,
    onPlanDelta,
    onCommandOutputDelta,
    onTerminalInteraction,
    onFileChangeOutputDelta,
  } = useThreadItemEvents({
    activeThreadId,
    dispatch,
    getCustomName,
    markProcessing,
    markReviewing,
    safeMessageActivity,
    recordThreadActivity,
    applyCollabThreadLinks,
    onUserMessageCreated,
    upsertThreadAtlasMemoryDigest,
    onReviewExited,
  });

  const {
    onThreadStarted,
    onThreadNameUpdated,
    onTurnStarted,
    onTurnCompleted,
    onTurnPlanUpdated,
    onTurnDiffUpdated,
    onThreadTokenUsageUpdated,
    onAccountRateLimitsUpdated,
    onTurnError,
  } = useThreadTurnEvents({
    dispatch,
    planByThreadRef,
    itemsByThreadRef,
    refreshThreadSnapshot,
    getCurrentRateLimits,
    getCustomName,
    isThreadHidden,
    markProcessing,
    markReviewing,
    setActiveTurnId,
    pendingInterruptsRef,
    syncPendingInterruptPersistence,
    pushThreadErrorMessage,
    safeMessageActivity,
    recordThreadActivity,
  });

  const onBackgroundThreadAction = useCallback(
    (workspaceId: string, threadId: string, action: string) => {
      if (action !== "hide") {
        return;
      }
      dispatch({ type: "hideThread", workspaceId, threadId });
    },
    [dispatch]
  );

  const onAppServerEvent = useCallback(
    (event: AppServerEvent) => {
      const method = getAppServerRawMethod(event) ?? "";
      const inferredSource = method === "codex/stderr" ? "stderr" : "event";
      onDebug?.({
        id: `${Date.now()}-server-event`,
        timestamp: Date.now(),
        source: inferredSource,
        label: method || "event",
        payload: event,
      });
    },
    [onDebug]
  );

  const handlers = useMemo(
    () => ({
      onWorkspaceConnected,
      onApprovalRequest,
      onApprovalResolved,
      onRequestUserInput,
      onToolCallRequest,
      onThreadStatusChanged,
      onThreadArchived,
      onThreadUnarchived,
      onRawResponseItemCompleted,
      onMcpToolCallProgress,
      onBackgroundThreadAction,
      onAppServerEvent,
      onAgentMessageDelta,
      onAgentMessageCompleted,
      onItemStarted,
      onItemUpdated,
      onItemCompleted,
      onReasoningSummaryDelta,
      onReasoningSummaryBoundary,
      onReasoningTextDelta,
      onPlanDelta,
      onCommandOutputDelta,
      onTerminalInteraction,
      onFileChangeOutputDelta,
      onThreadStarted,
      onThreadNameUpdated,
      onTurnStarted,
      onTurnCompleted,
      onTurnPlanUpdated,
      onTurnDiffUpdated,
      onThreadTokenUsageUpdated,
      onAccountRateLimitsUpdated,
      onTurnError,
    }),
    [
      onWorkspaceConnected,
      onApprovalRequest,
      onApprovalResolved,
      onRequestUserInput,
      onToolCallRequest,
      onThreadStatusChanged,
      onThreadArchived,
      onThreadUnarchived,
      onRawResponseItemCompleted,
      onMcpToolCallProgress,
      onBackgroundThreadAction,
      onAppServerEvent,
      onAgentMessageDelta,
      onAgentMessageCompleted,
      onItemStarted,
      onItemUpdated,
      onItemCompleted,
      onReasoningSummaryDelta,
      onReasoningSummaryBoundary,
      onReasoningTextDelta,
      onPlanDelta,
      onCommandOutputDelta,
      onTerminalInteraction,
      onFileChangeOutputDelta,
      onThreadStarted,
      onThreadNameUpdated,
      onTurnStarted,
      onTurnCompleted,
      onTurnPlanUpdated,
      onTurnDiffUpdated,
      onThreadTokenUsageUpdated,
      onAccountRateLimitsUpdated,
      onTurnError,
    ]
  );

  return handlers;
}
