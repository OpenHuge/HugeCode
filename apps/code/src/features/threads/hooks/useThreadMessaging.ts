import * as Sentry from "@sentry/react";
import type { HugeCodeTaskMode } from "@ku0/code-runtime-host-contract";
import type { Dispatch, MutableRefObject } from "react";
import { useCallback } from "react";
import {
  REVIEW_START_DESKTOP_ONLY_MESSAGE,
  compactThread as compactThreadService,
  interruptTurn as interruptTurnService,
  listMcpServerStatus as listMcpServerStatusService,
  sendUserMessage as sendUserMessageService,
  startReview as startReviewService,
  steerTurn as steerTurnService,
} from "../../../application/runtime/ports/tauriThreads";
import { detectRuntimeMode } from "../../../application/runtime/ports/runtimeClientMode";
import { pushErrorToast } from "../../../application/runtime/ports/toasts";
import type {
  AccessMode,
  AppMention,
  ComposerExecutionMode,
  ConversationItem,
  CustomPromptOption,
  DebugEntry,
  RateLimitSnapshot,
  ReviewTarget,
  WorkspaceInfo,
} from "../../../types";
import { formatRelativeTime } from "../../../utils/time";
import { extractCollaborationModeId } from "../../../application/runtime/ports/runtimeCollaborationModes";
import { trackProductAnalyticsEvent } from "../../shared/productAnalytics";
import {
  type AtlasLongTermMemoryDigest,
  buildAtlasContextPrefix,
} from "../../atlas/utils/atlasContext";
import {
  extractReviewThreadId,
  extractRpcErrorMessage,
  parseReviewTarget,
} from "../utils/threadNormalize";
import { useReviewPrompt } from "./useReviewPrompt";
import {
  buildAttachmentContextPrefix,
  buildStartTurnPayload,
  extractStartedTurnId,
  extractSteeredTurnId,
  isInterruptRequestSuccessful,
  parseCodexArgs,
  resolveExpandedMessageText,
  resolveSendMessageSettings,
  resolveTurnRequestRouting,
  type SendMessageOptions,
} from "./useThreadMessagingHelpers";
import type { ThreadAction, ThreadState } from "./useThreadsReducer";

type UseThreadMessagingOptions = {
  activeWorkspace: WorkspaceInfo | null;
  activeThreadId: string | null;
  activeThreadIdRef?: MutableRefObject<string | null>;
  hasAvailableModel?: boolean;
  accessMode?: AccessMode;
  model?: string | null;
  effort?: string | null;
  fastMode?: boolean;
  collaborationMode?: Record<string, unknown> | null;
  executionMode?: ComposerExecutionMode;
  missionMode?: HugeCodeTaskMode | null;
  executionProfileId?: string | null;
  preferredBackendIds?: string[] | null;
  defaultCodexBin?: string | null;
  defaultCodexArgs?: string | null;
  reviewDeliveryMode?: "inline" | "detached";
  steerEnabled: boolean;
  customPrompts: CustomPromptOption[];
  threadStatusById: ThreadState["threadStatusById"];
  activeTurnIdByThread: ThreadState["activeTurnIdByThread"];
  rateLimitsByWorkspace: Record<string, RateLimitSnapshot | null>;
  pendingInterruptsRef: MutableRefObject<Set<string>>;
  syncPendingInterruptPersistence?: () => void;
  dispatch: Dispatch<ThreadAction>;
  getCustomName: (workspaceId: string, threadId: string) => string | undefined;
  markProcessing: (threadId: string, isProcessing: boolean) => void;
  markReviewing: (threadId: string, isReviewing: boolean) => void;
  setActiveTurnId: (threadId: string, turnId: string | null) => void;
  recordThreadActivity: (workspaceId: string, threadId: string, timestamp?: number) => void;
  safeMessageActivity: () => void;
  onUserMessageCreated?: (
    workspaceId: string,
    threadId: string,
    text: string
  ) => void | Promise<void>;
  onDebug?: (entry: DebugEntry) => void;
  pushThreadErrorMessage: (threadId: string, message: string) => void;
  ensureThreadForActiveWorkspace: () => Promise<string | null>;
  ensureThreadForWorkspace: (workspaceId: string) => Promise<string | null>;
  refreshThread: (workspaceId: string, threadId: string) => Promise<string | null>;
  forkThreadForWorkspace: (workspaceId: string, threadId: string) => Promise<string | null>;
  updateThreadParent: (parentId: string, childIds: string[]) => void;
  registerDetachedReviewChild?: (workspaceId: string, parentId: string, childId: string) => void;
  setPendingDraftUserMessage?: (
    workspaceId: string,
    item: ConversationItem,
    operation: "add" | "remove"
  ) => void;
  itemsByThreadRef?: MutableRefObject<ThreadState["itemsByThread"]>;
  planByThreadRef?: MutableRefObject<ThreadState["planByThread"]>;
  tokenUsageByThreadRef?: MutableRefObject<ThreadState["tokenUsageByThread"]>;
  getAtlasDriverOrder?: (workspaceId: string, threadId: string) => string[] | null | undefined;
  getAtlasEnabled?: (workspaceId: string, threadId: string) => boolean | null | undefined;
  getAtlasDetailLevel?: (workspaceId: string, threadId: string) => string | null | undefined;
  getAtlasLongTermMemoryDigest?: (
    workspaceId: string,
    threadId: string
  ) => AtlasLongTermMemoryDigest | null | undefined;
};

async function invokeSteerTurnRequest(params: {
  workspaceId: string;
  threadId: string;
  activeTurnId: string;
  text: string;
  images: string[];
  appMentions: AppMention[];
  contextPrefix: string | null;
  model: string | null | undefined;
  effort: string | null | undefined;
  fastMode: boolean;
  collaborationMode: Record<string, unknown> | null;
  accessMode: AccessMode | undefined;
  executionMode: ComposerExecutionMode;
  missionMode: HugeCodeTaskMode | null;
  executionProfileId: string | null;
  preferredBackendIds: string[] | null;
  codexBin: string | null;
  codexArgs: string[] | null;
}): Promise<Record<string, unknown>> {
  const serviceTier = params.fastMode ? "fast" : null;
  if (params.contextPrefix) {
    return (await steerTurnService(
      params.workspaceId,
      params.threadId,
      params.activeTurnId,
      params.text,
      params.images,
      params.appMentions.length > 0 ? params.appMentions : undefined,
      params.contextPrefix,
      {
        model: params.model,
        effort: params.effort,
        serviceTier,
        collaborationMode: params.collaborationMode,
        accessMode: params.accessMode,
        executionMode: params.executionMode,
        missionMode: params.missionMode,
        executionProfileId: params.executionProfileId,
        preferredBackendIds: params.preferredBackendIds,
        codexBin: params.codexBin,
        codexArgs: params.codexArgs,
      }
    )) as Record<string, unknown>;
  }
  if (params.appMentions.length > 0) {
    return (await steerTurnService(
      params.workspaceId,
      params.threadId,
      params.activeTurnId,
      params.text,
      params.images,
      params.appMentions,
      undefined,
      {
        model: params.model,
        effort: params.effort,
        serviceTier,
        collaborationMode: params.collaborationMode,
        accessMode: params.accessMode,
        executionMode: params.executionMode,
        missionMode: params.missionMode,
        executionProfileId: params.executionProfileId,
        preferredBackendIds: params.preferredBackendIds,
        codexBin: params.codexBin,
        codexArgs: params.codexArgs,
      }
    )) as Record<string, unknown>;
  }
  return (await steerTurnService(
    params.workspaceId,
    params.threadId,
    params.activeTurnId,
    params.text,
    params.images,
    undefined,
    undefined,
    {
      model: params.model,
      effort: params.effort,
      serviceTier,
      collaborationMode: params.collaborationMode,
      accessMode: params.accessMode,
      executionMode: params.executionMode,
      missionMode: params.missionMode,
      executionProfileId: params.executionProfileId,
      preferredBackendIds: params.preferredBackendIds,
      codexBin: params.codexBin,
      codexArgs: params.codexArgs,
    }
  )) as Record<string, unknown>;
}

function canStartReviewInCurrentHost() {
  return detectRuntimeMode() === "tauri";
}

function resolveInterruptFailureMessage(response: unknown): string {
  if (response && typeof response === "object") {
    const record = response as Record<string, unknown>;
    const message =
      typeof record.message === "string"
        ? record.message.trim()
        : typeof record.result === "object" &&
            record.result !== null &&
            typeof (record.result as Record<string, unknown>).message === "string"
          ? ((record.result as Record<string, unknown>).message as string).trim()
          : "";
    if (message) {
      return `Failed to stop session: ${message}`;
    }
  }
  return "Failed to stop session.";
}

export function useThreadMessaging({
  activeWorkspace,
  activeThreadId,
  activeThreadIdRef,
  hasAvailableModel = true,
  accessMode,
  model,
  effort,
  fastMode = false,
  collaborationMode,
  executionMode = "runtime",
  missionMode,
  executionProfileId,
  preferredBackendIds,
  defaultCodexBin,
  defaultCodexArgs,
  reviewDeliveryMode = "inline",
  steerEnabled,
  customPrompts,
  threadStatusById,
  activeTurnIdByThread,
  rateLimitsByWorkspace,
  pendingInterruptsRef,
  syncPendingInterruptPersistence,
  dispatch,
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
}: UseThreadMessagingOptions) {
  const reportReviewUnavailable = useCallback(() => {
    const runtimeMode = detectRuntimeMode();
    onDebug?.({
      id: `${Date.now()}-client-review-start-unavailable`,
      timestamp: Date.now(),
      source: "client",
      label: "review/start unavailable",
      payload: {
        runtimeMode,
        activeThreadId,
      },
    });
    if (activeThreadId) {
      pushThreadErrorMessage(activeThreadId, REVIEW_START_DESKTOP_ONLY_MESSAGE);
      safeMessageActivity();
      return;
    }
    pushErrorToast({
      title: "Desktop review only",
      message: REVIEW_START_DESKTOP_ONLY_MESSAGE,
    });
  }, [activeThreadId, onDebug, pushThreadErrorMessage, safeMessageActivity]);

  const sendMessageToThread = useCallback(
    async (
      workspace: WorkspaceInfo,
      threadId: string,
      text: string,
      images: string[] = [],
      options?: SendMessageOptions
    ) => {
      const messageText = text.trim();
      if (!messageText && images.length === 0) {
        return;
      }
      const expandedMessage = resolveExpandedMessageText(
        messageText,
        options?.skipPromptExpansion,
        customPrompts
      );
      if (expandedMessage.errorMessage) {
        pushThreadErrorMessage(threadId, expandedMessage.errorMessage);
        safeMessageActivity();
        return;
      }
      const finalText = expandedMessage.finalText;
      const localCliCodexBin =
        typeof workspace.codex_bin === "string" && workspace.codex_bin.trim().length > 0
          ? workspace.codex_bin.trim()
          : (defaultCodexBin ?? null);
      const localCliCodexArgs = parseCodexArgs(
        workspace.settings.codexArgs ?? defaultCodexArgs ?? null
      );
      const {
        resolvedModel,
        resolvedEffort,
        resolvedFastMode,
        sanitizedCollaborationMode,
        resolvedAccessMode,
        resolvedExecutionMode,
        resolvedMissionMode,
        resolvedExecutionProfileId,
        resolvedPreferredBackendIds,
        resolvedCodexBin,
        resolvedCodexArgs,
        appMentions,
      } = resolveSendMessageSettings(options, {
        model,
        effort,
        fastMode,
        collaborationMode,
        accessMode,
        executionMode,
        missionMode,
        executionProfileId,
        preferredBackendIds,
        codexBin: localCliCodexBin,
        codexArgs: localCliCodexArgs,
      });
      const hasExplicitModel = typeof resolvedModel === "string" && resolvedModel.trim().length > 0;
      if (!hasAvailableModel && !hasExplicitModel) {
        pushThreadErrorMessage(
          threadId,
          "No available model route in current runtime. Sign in with a provider account or configure API keys."
        );
        safeMessageActivity();
        return;
      }

      const isProcessing = threadStatusById[threadId]?.isProcessing ?? false;
      const routing = resolveTurnRequestRouting({
        steerEnabled,
        isProcessing,
        activeTurnId: activeTurnIdByThread[threadId] ?? null,
      });
      const { requestMode, activeTurnId, routeReason } = routing;
      const analyticsAttributes = {
        workspaceId: workspace.id,
        threadId,
        executionProfileId: resolvedExecutionProfileId,
        backendId: resolvedPreferredBackendIds?.[0] ?? null,
        runState: isProcessing ? "running" : "idle",
        requestMode,
        eventSource: "thread_messaging",
      } as const;
      const optimisticText = finalText;
      if (optimisticText) {
        void onUserMessageCreated?.(workspace.id, threadId, optimisticText);
      }
      if (optimisticText || images.length > 0) {
        const optimisticMessageId =
          typeof options?.optimisticMessageId === "string" &&
          options.optimisticMessageId.trim().length > 0
            ? options.optimisticMessageId
            : `optimistic-user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        dispatch({
          type: "upsertItem",
          workspaceId: workspace.id,
          threadId,
          item: {
            id: optimisticMessageId,
            kind: "message",
            role: "user",
            text: optimisticText,
            images: images.length > 0 ? images : undefined,
          },
          hasCustomName: Boolean(getCustomName(workspace.id, threadId)),
        });
      }
      Sentry.metrics.count("prompt_sent", 1, {
        attributes: {
          workspace_id: workspace.id,
          thread_id: threadId,
          has_images: images.length > 0 ? "true" : "false",
          text_length: String(finalText.length),
          model: resolvedModel ?? "unknown",
          effort: resolvedEffort ?? "unknown",
          fast_mode: resolvedFastMode ? "true" : "false",
          execution_mode: resolvedExecutionMode,
          collaboration_mode: sanitizedCollaborationMode ?? "unknown",
        },
      });
      void trackProductAnalyticsEvent("define_started", analyticsAttributes);
      const timestamp = Date.now();
      recordThreadActivity(workspace.id, threadId, timestamp);
      dispatch({
        type: "setThreadTimestamp",
        workspaceId: workspace.id,
        threadId,
        timestamp,
      });
      markProcessing(threadId, true);
      safeMessageActivity();
      onDebug?.({
        id: `${Date.now()}-${requestMode === "steer" ? "client-turn-steer" : "client-turn-start"}`,
        timestamp: Date.now(),
        source: "client",
        label: requestMode === "steer" ? "turn/steer" : "turn/start",
        payload: {
          workspaceId: workspace.id,
          threadId,
          turnId: activeTurnId,
          text: finalText,
          images,
          model: resolvedModel,
          effort: resolvedEffort,
          fastMode: resolvedFastMode,
          executionMode: resolvedExecutionMode,
          collaborationMode: sanitizedCollaborationMode,
          routeReason,
        },
      });
      const atlasEnabled = getAtlasEnabled
        ? getAtlasEnabled(workspace.id, threadId) !== false
        : true;
      const atlasDetailLevel = getAtlasDetailLevel
        ? getAtlasDetailLevel(workspace.id, threadId)
        : null;
      const atlasLongTermMemoryDigest = getAtlasLongTermMemoryDigest
        ? getAtlasLongTermMemoryDigest(workspace.id, threadId)
        : null;
      const atlasContextPrefix =
        resolvedExecutionMode !== "local-cli" && atlasEnabled && getAtlasDriverOrder
          ? buildAtlasContextPrefix({
              order: getAtlasDriverOrder(workspace.id, threadId),
              items: itemsByThreadRef?.current[threadId] ?? [],
              plan: planByThreadRef?.current[threadId] ?? null,
              tokenUsage: tokenUsageByThreadRef?.current[threadId] ?? null,
              threadStatus: threadStatusById[threadId] ?? null,
              activeTurnId,
              detailLevel: atlasDetailLevel,
              longTermMemoryDigest: atlasLongTermMemoryDigest,
            })
          : null;
      const attachmentContextPrefix = buildAttachmentContextPrefix(images);
      const contextPrefix =
        [atlasContextPrefix, attachmentContextPrefix]
          .filter((entry): entry is string => Boolean(entry))
          .join("\n")
          .trim() || null;
      try {
        void trackProductAnalyticsEvent("delegate_started", analyticsAttributes);
        const startPayload = buildStartTurnPayload({
          model: resolvedModel,
          effort: resolvedEffort,
          fastMode: resolvedFastMode,
          collaborationMode: sanitizedCollaborationMode,
          accessMode: resolvedAccessMode,
          executionMode: resolvedExecutionMode,
          missionMode: resolvedMissionMode,
          executionProfileId: resolvedExecutionProfileId,
          preferredBackendIds: resolvedPreferredBackendIds,
          codexBin: resolvedExecutionMode === "runtime" ? null : resolvedCodexBin,
          codexArgs: resolvedExecutionMode === "runtime" ? null : resolvedCodexArgs,
          contextPrefix,
          images,
          appMentions,
        });
        const startTurn = () =>
          sendUserMessageService(workspace.id, threadId, finalText, startPayload);

        let response: Record<string, unknown>;
        if (requestMode === "steer" && activeTurnId) {
          response = await invokeSteerTurnRequest({
            workspaceId: workspace.id,
            threadId,
            activeTurnId,
            text: finalText,
            images,
            appMentions,
            contextPrefix,
            model: resolvedModel,
            effort: resolvedEffort,
            fastMode: resolvedFastMode,
            collaborationMode: sanitizedCollaborationMode,
            accessMode: resolvedAccessMode,
            executionMode: resolvedExecutionMode,
            missionMode: resolvedMissionMode,
            executionProfileId: resolvedExecutionProfileId,
            preferredBackendIds: resolvedPreferredBackendIds,
            codexBin: resolvedExecutionMode === "runtime" ? null : resolvedCodexBin,
            codexArgs: resolvedExecutionMode === "runtime" ? null : resolvedCodexArgs,
          });
        } else {
          response = (await startTurn()) as Record<string, unknown>;
        }

        const rpcError = extractRpcErrorMessage(response);

        onDebug?.({
          id: `${Date.now()}-${requestMode === "steer" ? "server-turn-steer" : "server-turn-start"}`,
          timestamp: Date.now(),
          source: "server",
          label: requestMode === "steer" ? "turn/steer response" : "turn/start response",
          payload: response,
        });
        if (rpcError) {
          if (requestMode !== "steer") {
            markProcessing(threadId, false);
            setActiveTurnId(threadId, null);
          }
          pushThreadErrorMessage(
            threadId,
            requestMode === "steer"
              ? `Turn steer failed: ${rpcError}`
              : `Turn failed to start: ${rpcError}`
          );
          safeMessageActivity();
          return;
        }
        if (requestMode === "steer") {
          const steeredTurnId = extractSteeredTurnId(response);
          if (steeredTurnId) {
            setActiveTurnId(threadId, steeredTurnId);
          }
          return;
        }
        const turnId = extractStartedTurnId(response);
        if (!turnId) {
          markProcessing(threadId, false);
          setActiveTurnId(threadId, null);
          pushThreadErrorMessage(threadId, "Turn failed to start.");
          safeMessageActivity();
          return;
        }
        setActiveTurnId(threadId, turnId);
      } catch (error) {
        if (requestMode !== "steer") {
          markProcessing(threadId, false);
          setActiveTurnId(threadId, null);
        }
        onDebug?.({
          id: `${Date.now()}-${requestMode === "steer" ? "client-turn-steer-error" : "client-turn-start-error"}`,
          timestamp: Date.now(),
          source: "error",
          label: requestMode === "steer" ? "turn/steer error" : "turn/start error",
          payload: error instanceof Error ? error.message : String(error),
        });
        pushThreadErrorMessage(
          threadId,
          requestMode === "steer"
            ? `Turn steer failed: ${error instanceof Error ? error.message : String(error)}`
            : error instanceof Error
              ? error.message
              : String(error)
        );
        safeMessageActivity();
      }
    },
    [
      accessMode,
      collaborationMode,
      customPrompts,
      defaultCodexArgs,
      defaultCodexBin,
      dispatch,
      effort,
      fastMode,
      executionProfileId,
      executionMode,
      activeTurnIdByThread,
      getCustomName,
      hasAvailableModel,
      markProcessing,
      model,
      onDebug,
      onUserMessageCreated,
      preferredBackendIds,
      pushThreadErrorMessage,
      recordThreadActivity,
      safeMessageActivity,
      setActiveTurnId,
      steerEnabled,
      missionMode,
      getAtlasDriverOrder,
      getAtlasEnabled,
      getAtlasDetailLevel,
      getAtlasLongTermMemoryDigest,
      itemsByThreadRef,
      planByThreadRef,
      tokenUsageByThreadRef,
      threadStatusById,
    ]
  );

  const sendUserMessage = useCallback(
    async (text: string, images: string[] = [], appMentions: AppMention[] = []) => {
      if (!activeWorkspace) {
        return;
      }
      const currentActiveThreadId = activeThreadIdRef?.current ?? activeThreadId;
      const messageText = text.trim();
      if (!messageText && images.length === 0) {
        return;
      }
      const expandedMessage = resolveExpandedMessageText(messageText, false, customPrompts);
      if (expandedMessage.errorMessage) {
        if (currentActiveThreadId) {
          pushThreadErrorMessage(currentActiveThreadId, expandedMessage.errorMessage);
          safeMessageActivity();
        } else {
          onDebug?.({
            id: `${Date.now()}-client-prompt-expand-error`,
            timestamp: Date.now(),
            source: "error",
            label: "prompt/expand error",
            payload: expandedMessage.errorMessage,
          });
        }
        return;
      }
      const finalText = expandedMessage.finalText;
      const shouldUsePendingDraftMessage = !currentActiveThreadId;
      const pendingDraftMessage: ConversationItem = {
        id: `pending-draft-user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        kind: "message",
        role: "user",
        text: finalText,
        images: images.length > 0 ? images : undefined,
      };
      if (shouldUsePendingDraftMessage) {
        setPendingDraftUserMessage?.(activeWorkspace.id, pendingDraftMessage, "add");
      }
      const threadId = await ensureThreadForActiveWorkspace();
      if (!threadId) {
        if (shouldUsePendingDraftMessage) {
          setPendingDraftUserMessage?.(activeWorkspace.id, pendingDraftMessage, "remove");
        }
        return;
      }
      try {
        await sendMessageToThread(activeWorkspace, threadId, finalText, images, {
          skipPromptExpansion: true,
          appMentions,
          optimisticMessageId: shouldUsePendingDraftMessage ? pendingDraftMessage.id : undefined,
        });
      } finally {
        if (shouldUsePendingDraftMessage) {
          setPendingDraftUserMessage?.(activeWorkspace.id, pendingDraftMessage, "remove");
        }
      }
    },
    [
      activeThreadId,
      activeThreadIdRef,
      activeWorkspace,
      customPrompts,
      ensureThreadForActiveWorkspace,
      onDebug,
      setPendingDraftUserMessage,
      pushThreadErrorMessage,
      safeMessageActivity,
      sendMessageToThread,
    ]
  );

  const sendUserMessageToThread = useCallback(
    async (
      workspace: WorkspaceInfo,
      threadId: string,
      text: string,
      images: string[] = [],
      options?: SendMessageOptions
    ) => {
      await sendMessageToThread(workspace, threadId, text, images, options);
    },
    [sendMessageToThread]
  );

  const interruptTurn = useCallback(async () => {
    if (!activeWorkspace || !activeThreadId) {
      return;
    }
    const activeTurnId = activeTurnIdByThread[activeThreadId] ?? null;
    const turnId = activeTurnId ?? "pending";
    const queuedInterrupt = !activeTurnId;
    if (queuedInterrupt) {
      pendingInterruptsRef.current.add(activeThreadId);
      syncPendingInterruptPersistence?.();
    }
    onDebug?.({
      id: `${Date.now()}-client-turn-interrupt`,
      timestamp: Date.now(),
      source: "client",
      label: "turn/interrupt",
      payload: {
        workspaceId: activeWorkspace.id,
        threadId: activeThreadId,
        turnId,
        queued: queuedInterrupt,
      },
    });
    try {
      const response = await interruptTurnService(activeWorkspace.id, activeThreadId, turnId);
      const interruptAccepted = isInterruptRequestSuccessful(response);
      onDebug?.({
        id: `${Date.now()}-server-turn-interrupt`,
        timestamp: Date.now(),
        source: "server",
        label: "turn/interrupt response",
        payload: response,
      });
      if (!interruptAccepted) {
        if (queuedInterrupt) {
          pendingInterruptsRef.current.delete(activeThreadId);
          syncPendingInterruptPersistence?.();
        }
        pushThreadErrorMessage(activeThreadId, resolveInterruptFailureMessage(response));
        safeMessageActivity();
        return;
      }
      if (queuedInterrupt) {
        markProcessing(activeThreadId, false);
        setActiveTurnId(activeThreadId, null);
        dispatch({
          type: "addAssistantMessage",
          threadId: activeThreadId,
          text: "Session stopped.",
        });
      } else {
        markProcessing(activeThreadId, false);
        setActiveTurnId(activeThreadId, null);
        dispatch({
          type: "addAssistantMessage",
          threadId: activeThreadId,
          text: "Session stopped.",
        });
      }
    } catch (error) {
      onDebug?.({
        id: `${Date.now()}-client-turn-interrupt-error`,
        timestamp: Date.now(),
        source: "error",
        label: "turn/interrupt error",
        payload: error instanceof Error ? error.message : String(error),
      });
      if (queuedInterrupt) {
        pendingInterruptsRef.current.delete(activeThreadId);
        syncPendingInterruptPersistence?.();
      }
      pushThreadErrorMessage(
        activeThreadId,
        error instanceof Error && error.message.trim()
          ? `Failed to stop session: ${error.message}`
          : "Failed to stop session."
      );
      safeMessageActivity();
    }
  }, [
    activeThreadId,
    activeTurnIdByThread,
    activeWorkspace,
    dispatch,
    markProcessing,
    onDebug,
    pendingInterruptsRef,
    pushThreadErrorMessage,
    safeMessageActivity,
    setActiveTurnId,
    syncPendingInterruptPersistence,
  ]);

  const startReviewTarget = useCallback(
    async (target: ReviewTarget, workspaceIdOverride?: string): Promise<boolean> => {
      if (!canStartReviewInCurrentHost()) {
        reportReviewUnavailable();
        return false;
      }
      const workspaceId = workspaceIdOverride ?? activeWorkspace?.id ?? null;
      if (!workspaceId) {
        return false;
      }
      const threadId = workspaceIdOverride
        ? await ensureThreadForWorkspace(workspaceId)
        : await ensureThreadForActiveWorkspace();
      if (!threadId) {
        return false;
      }

      const lockParentThread = reviewDeliveryMode !== "detached";
      if (lockParentThread) {
        markProcessing(threadId, true);
        markReviewing(threadId, true);
        safeMessageActivity();
      }
      onDebug?.({
        id: `${Date.now()}-client-review-start`,
        timestamp: Date.now(),
        source: "client",
        label: "review/start",
        payload: {
          workspaceId,
          threadId,
          target,
        },
      });
      try {
        const response = await startReviewService(
          workspaceId,
          threadId,
          target,
          reviewDeliveryMode
        );
        onDebug?.({
          id: `${Date.now()}-server-review-start`,
          timestamp: Date.now(),
          source: "server",
          label: "review/start response",
          payload: response,
        });
        const rpcError = extractRpcErrorMessage(response);
        if (rpcError) {
          if (lockParentThread) {
            markProcessing(threadId, false);
            markReviewing(threadId, false);
            setActiveTurnId(threadId, null);
          }
          pushThreadErrorMessage(threadId, `Review failed to start: ${rpcError}`);
          safeMessageActivity();
          return false;
        }
        const reviewThreadId = extractReviewThreadId(response);
        if (reviewThreadId && reviewThreadId !== threadId) {
          updateThreadParent(threadId, [reviewThreadId]);
          if (reviewDeliveryMode === "detached") {
            registerDetachedReviewChild?.(workspaceId, threadId, reviewThreadId);
          }
        }
        return true;
      } catch (error) {
        if (lockParentThread) {
          markProcessing(threadId, false);
          markReviewing(threadId, false);
        }
        onDebug?.({
          id: `${Date.now()}-client-review-start-error`,
          timestamp: Date.now(),
          source: "error",
          label: "review/start error",
          payload: error instanceof Error ? error.message : String(error),
        });
        pushThreadErrorMessage(threadId, error instanceof Error ? error.message : String(error));
        safeMessageActivity();
        return false;
      }
    },
    [
      activeWorkspace,
      ensureThreadForActiveWorkspace,
      ensureThreadForWorkspace,
      markProcessing,
      markReviewing,
      onDebug,
      pushThreadErrorMessage,
      reportReviewUnavailable,
      safeMessageActivity,
      setActiveTurnId,
      reviewDeliveryMode,
      registerDetachedReviewChild,
      updateThreadParent,
    ]
  );

  const {
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
  } = useReviewPrompt({
    activeWorkspace,
    activeThreadId,
    onDebug,
    startReviewTarget,
  });

  const startReview = useCallback(
    async (text: string) => {
      if (!activeWorkspace || !text.trim()) {
        return;
      }
      if (!canStartReviewInCurrentHost()) {
        reportReviewUnavailable();
        return false;
      }
      const trimmed = text.trim();
      const rest = trimmed.replace(/^\/review\b/i, "").trim();
      if (!rest) {
        openReviewPrompt();
        return;
      }

      const target = parseReviewTarget(trimmed);
      const started = await startReviewTarget(target);
      return started === false ? false : undefined;
    },
    [activeWorkspace, openReviewPrompt, reportReviewUnavailable, startReviewTarget]
  );

  const appendImmediateAssistantMessage = useCallback(
    (workspaceId: string, threadId: string, text: string) => {
      const timestamp = Date.now();
      recordThreadActivity(workspaceId, threadId, timestamp);
      dispatch({
        type: "addAssistantMessage",
        threadId,
        text,
      });
      dispatch({
        type: "markImmediateCompletion",
        threadId,
      });
      safeMessageActivity();
    },
    [dispatch, recordThreadActivity, safeMessageActivity]
  );

  const startStatus = useCallback(
    async (_text: string) => {
      if (!activeWorkspace) {
        return;
      }
      const threadId = await ensureThreadForActiveWorkspace();
      if (!threadId) {
        return;
      }

      const rateLimits = rateLimitsByWorkspace[activeWorkspace.id] ?? null;
      const primaryUsed = rateLimits?.primary?.usedPercent;
      const secondaryUsed = rateLimits?.secondary?.usedPercent;
      const primaryReset = rateLimits?.primary?.resetsAt;
      const secondaryReset = rateLimits?.secondary?.resetsAt;
      const credits = rateLimits?.credits ?? null;

      const normalizeReset = (value?: number | null) => {
        if (typeof value !== "number" || !Number.isFinite(value)) {
          return null;
        }
        return value > 1_000_000_000_000 ? value : value * 1000;
      };

      const resetLabel = (value?: number | null) => {
        const resetAt = normalizeReset(value);
        return resetAt ? formatRelativeTime(resetAt) : null;
      };

      const collabId = extractCollaborationModeId(collaborationMode) ?? "";

      const lines = [
        "Session status:",
        `- Model: ${model ?? "default"}`,
        `- Reasoning effort: ${effort ?? "default"}`,
        `- Fast speed: ${fastMode ? "on" : "off"}`,
        `- Access: ${accessMode ?? "on-request"}`,
        `- Execution: ${executionMode}`,
        `- Collaboration: ${collabId || "off"}`,
      ];

      if (typeof primaryUsed === "number") {
        const reset = resetLabel(primaryReset);
        lines.push(
          `- Session usage: ${Math.round(primaryUsed)}%${reset ? ` (resets ${reset})` : ""}`
        );
      }
      if (typeof secondaryUsed === "number") {
        const reset = resetLabel(secondaryReset);
        lines.push(
          `- Weekly usage: ${Math.round(secondaryUsed)}%${reset ? ` (resets ${reset})` : ""}`
        );
      }
      if (credits?.hasCredits) {
        if (credits.unlimited) {
          lines.push("- Credits: unlimited");
        } else if (credits.balance) {
          lines.push(`- Credits: ${credits.balance}`);
        }
      }

      appendImmediateAssistantMessage(activeWorkspace.id, threadId, lines.join("\n"));
    },
    [
      accessMode,
      activeWorkspace,
      appendImmediateAssistantMessage,
      collaborationMode,
      effort,
      fastMode,
      executionMode,
      ensureThreadForActiveWorkspace,
      model,
      rateLimitsByWorkspace,
    ]
  );

  const startMcp = useCallback(
    async (_text: string) => {
      if (!activeWorkspace) {
        return;
      }
      const threadId = await ensureThreadForActiveWorkspace();
      if (!threadId) {
        return;
      }

      try {
        const response = (await listMcpServerStatusService(
          activeWorkspace.id,
          null,
          null
        )) as Record<string, unknown> | null;
        const result = (response?.result ?? response) as Record<string, unknown> | null;
        const data = Array.isArray(result?.data)
          ? (result?.data as Array<Record<string, unknown>>)
          : [];

        const lines: string[] = ["MCP tools:"];
        if (data.length === 0) {
          lines.push("- No MCP servers configured.");
        } else {
          const servers = [...data].sort((a, b) =>
            String(a.name ?? "").localeCompare(String(b.name ?? ""))
          );
          for (const server of servers) {
            const name = String(server.name ?? "unknown");
            const authStatus = server.authStatus ?? server.auth_status ?? null;
            const authLabel =
              typeof authStatus === "string"
                ? authStatus
                : authStatus && typeof authStatus === "object" && "status" in authStatus
                  ? String((authStatus as { status?: unknown }).status ?? "")
                  : "";
            lines.push(`- ${name}${authLabel ? ` (auth: ${authLabel})` : ""}`);

            const toolsRecord =
              server.tools && typeof server.tools === "object"
                ? (server.tools as Record<string, unknown>)
                : {};
            const prefix = `mcp__${name}__`;
            const toolNames = Object.keys(toolsRecord)
              .map((toolName) =>
                toolName.startsWith(prefix) ? toolName.slice(prefix.length) : toolName
              )
              .sort((a, b) => a.localeCompare(b));
            lines.push(toolNames.length > 0 ? `  tools: ${toolNames.join(", ")}` : "  tools: none");

            const resources = Array.isArray(server.resources) ? server.resources.length : 0;
            const templates = Array.isArray(server.resourceTemplates)
              ? server.resourceTemplates.length
              : Array.isArray(server.resource_templates)
                ? server.resource_templates.length
                : 0;
            if (resources > 0 || templates > 0) {
              lines.push(`  resources: ${resources}, templates: ${templates}`);
            }
          }
        }

        appendImmediateAssistantMessage(activeWorkspace.id, threadId, lines.join("\n"));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load MCP status.";
        appendImmediateAssistantMessage(activeWorkspace.id, threadId, `MCP tools:\n- ${message}`);
      }
    },
    [activeWorkspace, appendImmediateAssistantMessage, ensureThreadForActiveWorkspace]
  );

  const startFork = useCallback(
    async (text: string) => {
      if (!activeWorkspace || !activeThreadId) {
        return;
      }
      const trimmed = text.trim();
      const rest = trimmed.replace(/^\/fork\b/i, "").trim();
      const threadId = await forkThreadForWorkspace(activeWorkspace.id, activeThreadId);
      if (!threadId) {
        return;
      }
      updateThreadParent(activeThreadId, [threadId]);
      if (rest) {
        await sendMessageToThread(activeWorkspace, threadId, rest, []);
      }
    },
    [
      activeThreadId,
      activeWorkspace,
      forkThreadForWorkspace,
      sendMessageToThread,
      updateThreadParent,
    ]
  );

  const startResume = useCallback(
    async (_text: string) => {
      if (!activeWorkspace) {
        return;
      }
      if (activeThreadId && threadStatusById[activeThreadId]?.isProcessing) {
        return;
      }
      const threadId = activeThreadId ?? (await ensureThreadForActiveWorkspace());
      if (!threadId) {
        return;
      }
      await refreshThread(activeWorkspace.id, threadId);
      safeMessageActivity();
    },
    [
      activeThreadId,
      activeWorkspace,
      ensureThreadForActiveWorkspace,
      refreshThread,
      safeMessageActivity,
      threadStatusById,
    ]
  );

  const startCompact = useCallback(
    async (_text: string) => {
      if (!activeWorkspace) {
        return;
      }
      const threadId = activeThreadId ?? (await ensureThreadForActiveWorkspace());
      if (!threadId) {
        return;
      }
      try {
        await compactThreadService(activeWorkspace.id, threadId);
      } catch (error) {
        pushThreadErrorMessage(
          threadId,
          error instanceof Error ? error.message : "Failed to start context compaction."
        );
      } finally {
        safeMessageActivity();
      }
    },
    [
      activeThreadId,
      activeWorkspace,
      ensureThreadForActiveWorkspace,
      pushThreadErrorMessage,
      safeMessageActivity,
    ]
  );

  return {
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
  };
}
