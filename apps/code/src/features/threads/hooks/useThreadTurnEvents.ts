import type { Dispatch, MutableRefObject } from "react";
import { useCallback, useEffect, useRef } from "react";
import { useRuntimeSessionCommandsResolver } from "../../../application/runtime/facades/runtimeSessionCommandFacadeHooks";
import type { ConversationItem, RateLimitSnapshot, TurnPlan } from "../../../types";
import { normalizePlanUpdate } from "../../../application/runtime/facades/runtimeTurnPlanProjection";
import { resolveRateLimitsSnapshot } from "../../../utils/rateLimits";
import { getThreadTimestamp } from "../../../utils/threadItems";
import type { ThreadExecutionState } from "../utils/threadExecutionState";
import { asString, normalizeRateLimits, normalizeTokenUsage } from "../utils/threadNormalize";
import { getMeaningfulThreadName, truncateThreadName } from "../utils/threadTitle";
import type { ThreadAction } from "./useThreadsReducer";

type UseThreadTurnEventsOptions = {
  dispatch: Dispatch<ThreadAction>;
  planByThreadRef: MutableRefObject<Record<string, TurnPlan | null>>;
  itemsByThreadRef: MutableRefObject<Record<string, ConversationItem[]>>;
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
  pendingInterruptsRef: MutableRefObject<Set<string>>;
  syncPendingInterruptPersistence?: () => void;
  pushThreadErrorMessage: (threadId: string, message: string) => void;
  safeMessageActivity: () => void;
  recordThreadActivity: (workspaceId: string, threadId: string, timestamp?: number) => void;
};

const TURN_VISIBLE_OUTPUT_CHECK_DELAY_MS = 200;
const TURN_ERROR_MAX_MESSAGE_LENGTH = 420;

function normalizeTurnFailureMessage(message: string): string {
  const normalized = message.trim();
  if (!normalized) {
    return "";
  }

  const lowered = normalized.toLowerCase();
  const usageLimitExceeded =
    lowered.includes("usage limit has been reached") ||
    lowered.includes("you've hit your usage limit") ||
    lowered.includes("quota exceeded") ||
    lowered.includes("resource_exhausted");
  if (usageLimitExceeded) {
    return "Local Codex CLI and provider fallback both hit usage limits. Check your account quota and retry.";
  }

  if (normalized.length <= TURN_ERROR_MAX_MESSAGE_LENGTH) {
    return normalized;
  }

  const truncated = normalized.slice(0, TURN_ERROR_MAX_MESSAGE_LENGTH - 1).trimEnd();
  return `${truncated}… (truncated; see runtime logs for full details)`;
}

function hasText(value?: string): boolean {
  return (value?.trim().length ?? 0) > 0;
}

function isMeaningfulVisibleOutput(item: ConversationItem): boolean {
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

function hasVisibleTurnOutputSinceLatestUserMessage(items: ConversationItem[]): boolean {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item.kind === "message" && item.role === "user") {
      return false;
    }
    if (isMeaningfulVisibleOutput(item)) {
      return true;
    }
  }
  return false;
}

export function useThreadTurnEvents({
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
}: UseThreadTurnEventsOptions) {
  const resolveRuntimeSessionCommands = useRuntimeSessionCommandsResolver();
  const pendingVisibleOutputChecksRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  const pendingVisibleOutputCheckIdsRef = useRef<Map<string, number>>(new Map());
  const pendingVisibleOutputCheckSequenceRef = useRef(0);

  const clearPendingVisibleOutputCheck = useCallback((threadId: string) => {
    const timeoutId = pendingVisibleOutputChecksRef.current.get(threadId);
    if (timeoutId === undefined) {
      pendingVisibleOutputCheckIdsRef.current.delete(threadId);
      return;
    }
    clearTimeout(timeoutId);
    pendingVisibleOutputChecksRef.current.delete(threadId);
    pendingVisibleOutputCheckIdsRef.current.delete(threadId);
  }, []);

  useEffect(() => {
    return () => {
      for (const timeoutId of pendingVisibleOutputChecksRef.current.values()) {
        clearTimeout(timeoutId);
      }
      pendingVisibleOutputChecksRef.current.clear();
      pendingVisibleOutputCheckIdsRef.current.clear();
    };
  }, []);

  const shouldClearCompletedPlan = useCallback(
    (threadId: string, turnId: string) => {
      const plan = planByThreadRef.current[threadId];
      if (!plan || plan.steps.length === 0) {
        return false;
      }
      if (turnId && plan.turnId !== turnId) {
        return false;
      }
      return plan.steps.every((step) => step.status === "completed");
    },
    [planByThreadRef]
  );

  const onThreadStarted = useCallback(
    (workspaceId: string, thread: Record<string, unknown>) => {
      const threadId = asString(thread.id);
      if (!threadId) {
        return;
      }
      if (isThreadHidden(workspaceId, threadId)) {
        return;
      }
      dispatch({ type: "ensureThread", workspaceId, threadId });
      const timestamp = getThreadTimestamp(thread);
      const activityTimestamp = timestamp > 0 ? timestamp : Date.now();
      recordThreadActivity(workspaceId, threadId, activityTimestamp);
      dispatch({
        type: "setThreadTimestamp",
        workspaceId,
        threadId,
        timestamp: activityTimestamp,
      });

      const customName = getCustomName(workspaceId, threadId);
      if (!customName) {
        const preview = getMeaningfulThreadName(asString(thread.preview));
        if (preview) {
          const name = truncateThreadName(preview);
          dispatch({ type: "setThreadName", workspaceId, threadId, name });
        }
      }
      safeMessageActivity();
    },
    [dispatch, getCustomName, isThreadHidden, recordThreadActivity, safeMessageActivity]
  );

  const onThreadNameUpdated = useCallback(
    (workspaceId: string, payload: { threadId: string; threadName: string | null }) => {
      const { threadId, threadName } = payload;
      if (!threadId || !threadName) {
        return;
      }
      if (getCustomName(workspaceId, threadId)) {
        return;
      }
      const meaningfulThreadName = getMeaningfulThreadName(threadName);
      if (!meaningfulThreadName) {
        return;
      }
      dispatch({
        type: "setThreadName",
        workspaceId,
        threadId,
        name: truncateThreadName(meaningfulThreadName),
      });
    },
    [dispatch, getCustomName]
  );

  const onTurnStarted = useCallback(
    (workspaceId: string, threadId: string, turnId: string) => {
      clearPendingVisibleOutputCheck(threadId);
      dispatch({
        type: "ensureThread",
        workspaceId,
        threadId,
      });
      if (pendingInterruptsRef.current.has(threadId)) {
        pendingInterruptsRef.current.delete(threadId);
        syncPendingInterruptPersistence?.();
        if (turnId) {
          void resolveRuntimeSessionCommands(workspaceId)
            .interruptTurn({ threadId, turnId })
            .catch(() => undefined);
        }
        return;
      }
      markProcessing(threadId, true, "running");
      if (turnId) {
        setActiveTurnId(threadId, turnId);
      }
    },
    [
      clearPendingVisibleOutputCheck,
      dispatch,
      markProcessing,
      pendingInterruptsRef,
      resolveRuntimeSessionCommands,
      setActiveTurnId,
      syncPendingInterruptPersistence,
    ]
  );

  const onTurnCompleted = useCallback(
    (workspaceId: string, threadId: string, turnId: string, _payload?: Record<string, unknown>) => {
      clearPendingVisibleOutputCheck(threadId);
      markProcessing(threadId, false, "idle");
      setActiveTurnId(threadId, null);
      if (pendingInterruptsRef.current.delete(threadId)) {
        syncPendingInterruptPersistence?.();
      }
      dispatch({ type: "completePendingTurnItems", threadId });
      const timeoutId = setTimeout(() => {
        pendingVisibleOutputChecksRef.current.delete(threadId);
        void (async () => {
          const activeCheckId = pendingVisibleOutputCheckIdsRef.current.get(threadId);
          if (activeCheckId !== checkId) {
            return;
          }
          if (
            hasVisibleTurnOutputSinceLatestUserMessage(itemsByThreadRef.current[threadId] ?? [])
          ) {
            pendingVisibleOutputCheckIdsRef.current.delete(threadId);
            return;
          }
          if (refreshThreadSnapshot) {
            await Promise.resolve(refreshThreadSnapshot(workspaceId, threadId)).catch(
              () => undefined
            );
            if (
              pendingVisibleOutputCheckIdsRef.current.get(threadId) !== checkId ||
              hasVisibleTurnOutputSinceLatestUserMessage(itemsByThreadRef.current[threadId] ?? [])
            ) {
              pendingVisibleOutputCheckIdsRef.current.delete(threadId);
              return;
            }
          }
          pendingVisibleOutputCheckIdsRef.current.delete(threadId);
          pushThreadErrorMessage(
            threadId,
            "Turn completed without any visible response or tool output. The agent may not have produced output. Check runtime logs and retry."
          );
          safeMessageActivity();
        })();
      }, TURN_VISIBLE_OUTPUT_CHECK_DELAY_MS);
      const checkId = pendingVisibleOutputCheckSequenceRef.current + 1;
      pendingVisibleOutputCheckSequenceRef.current = checkId;
      pendingVisibleOutputChecksRef.current.set(threadId, timeoutId);
      pendingVisibleOutputCheckIdsRef.current.set(threadId, checkId);
      if (shouldClearCompletedPlan(threadId, turnId)) {
        dispatch({ type: "clearThreadPlan", threadId });
      }
    },
    [
      clearPendingVisibleOutputCheck,
      dispatch,
      itemsByThreadRef,
      markProcessing,
      pendingInterruptsRef,
      pushThreadErrorMessage,
      refreshThreadSnapshot,
      safeMessageActivity,
      setActiveTurnId,
      syncPendingInterruptPersistence,
      shouldClearCompletedPlan,
    ]
  );

  const onTurnPlanUpdated = useCallback(
    (
      workspaceId: string,
      threadId: string,
      turnId: string,
      payload: { explanation: unknown; plan: unknown }
    ) => {
      dispatch({ type: "ensureThread", workspaceId, threadId });
      const normalized = normalizePlanUpdate(turnId, payload.explanation, payload.plan);
      dispatch({ type: "setThreadPlan", threadId, plan: normalized });
    },
    [dispatch]
  );

  const onTurnDiffUpdated = useCallback(
    (workspaceId: string, threadId: string, diff: string) => {
      dispatch({ type: "ensureThread", workspaceId, threadId });
      dispatch({ type: "setThreadTurnDiff", threadId, diff });
    },
    [dispatch]
  );

  const onThreadTokenUsageUpdated = useCallback(
    (workspaceId: string, threadId: string, tokenUsage: Record<string, unknown> | null) => {
      dispatch({ type: "ensureThread", workspaceId, threadId });
      dispatch({
        type: "setThreadTokenUsage",
        threadId,
        tokenUsage: normalizeTokenUsage(tokenUsage),
      });
    },
    [dispatch]
  );

  const onAccountRateLimitsUpdated = useCallback(
    (workspaceId: string, rateLimits: Record<string, unknown>) => {
      const resolvedRateLimits = resolveRateLimitsSnapshot(rateLimits);
      if (!resolvedRateLimits) {
        return;
      }
      const previousRateLimits = getCurrentRateLimits?.(workspaceId) ?? null;
      dispatch({
        type: "setRateLimits",
        workspaceId,
        rateLimits: normalizeRateLimits(resolvedRateLimits, previousRateLimits),
      });
    },
    [dispatch, getCurrentRateLimits]
  );

  const onTurnError = useCallback(
    (
      workspaceId: string,
      threadId: string,
      _turnId: string,
      payload: { message: string; code?: string; willRetry: boolean }
    ) => {
      clearPendingVisibleOutputCheck(threadId);
      if (payload.willRetry) {
        return;
      }
      dispatch({ type: "ensureThread", workspaceId, threadId });
      dispatch({ type: "completePendingTurnItems", threadId });
      markProcessing(threadId, false, "idle");
      markReviewing(threadId, false);
      setActiveTurnId(threadId, null);
      const fallback = payload.code?.trim() ? payload.code.trim() : "";
      const messageSource = normalizeTurnFailureMessage(payload.message) || fallback;
      const message = messageSource ? `Turn failed: ${messageSource}` : "Turn failed.";
      pushThreadErrorMessage(threadId, message);
      safeMessageActivity();
    },
    [
      clearPendingVisibleOutputCheck,
      dispatch,
      markProcessing,
      markReviewing,
      pushThreadErrorMessage,
      safeMessageActivity,
      setActiveTurnId,
    ]
  );

  return {
    onThreadStarted,
    onThreadNameUpdated,
    onTurnStarted,
    onTurnCompleted,
    onTurnPlanUpdated,
    onTurnDiffUpdated,
    onThreadTokenUsageUpdated,
    onAccountRateLimitsUpdated,
    onTurnError,
  };
}
