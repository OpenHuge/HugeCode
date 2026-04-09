import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRuntimeInvocationCatalogResolver } from "../../../application/runtime/facades/runtimeInvocationCatalogFacadeHooks";
import { useRuntimeInvocationExecuteResolver } from "../../../application/runtime/facades/runtimeInvocationExecuteFacadeHooks";
import { pushErrorToast } from "../../../application/runtime/ports/toasts";
import type { QueuedMessage, WorkspaceInfo } from "../../../types";
import {
  parseBuiltInSlashCommand,
  resolveInvocationSlashCommandText,
} from "../../../utils/slashCommands";

type UseQueuedSendOptions = {
  activeThreadId: string | null;
  activeTurnId: string | null;
  isProcessing: boolean;
  isReviewing: boolean;
  queueFlushPaused?: boolean;
  steerEnabled: boolean;
  activeWorkspace: WorkspaceInfo | null;
  connectWorkspace: (workspace: WorkspaceInfo) => Promise<void>;
  startThreadForWorkspace: (
    workspaceId: string,
    options?: { activate?: boolean }
  ) => Promise<string | null>;
  sendUserMessage: (text: string, images?: string[]) => Promise<void>;
  sendUserMessageToThread: (
    workspace: WorkspaceInfo,
    threadId: string,
    text: string,
    images?: string[]
  ) => Promise<void>;
  startFork: (text: string) => Promise<void>;
  startReview: (text: string) => Promise<void | false>;
  startResume: (text: string) => Promise<void>;
  startCompact: (text: string) => Promise<void>;
  startMcp: (text: string) => Promise<void>;
  startStatus: (text: string) => Promise<void>;
  clearActiveImages: () => void;
  onComposePatchResolved?: (input: { invocationId: string; text: string }) => void;
};

type UseQueuedSendResult = {
  queuedByThread: Record<string, QueuedMessage[]>;
  activeQueue: QueuedMessage[];
  handleSend: (text: string, images?: string[]) => Promise<void | false>;
  queueMessage: (text: string, images?: string[]) => Promise<void>;
  removeQueuedMessage: (threadId: string, messageId: string) => void;
};

type SlashCommandKind = "compact" | "fork" | "mcp" | "new" | "resume" | "review" | "status";
type QueuedSendDispatchResult = "blocked" | "compose_patch" | "handled" | "processing";
const RUNTIME_SLASH_CATALOG_UNAVAILABLE_MESSAGE =
  "Runtime slash command catalog is unavailable. Retry after runtime reconnects.";

function parseSlashCommand(text: string): SlashCommandKind | null {
  return parseBuiltInSlashCommand(text);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readComposePatchText(payload: unknown): string | null {
  const record = asRecord(payload);
  const text = record?.text;
  return typeof text === "string" && text.trim().length > 0 ? text : null;
}

export function useQueuedSend({
  activeThreadId,
  activeTurnId,
  isProcessing,
  isReviewing,
  queueFlushPaused = false,
  steerEnabled,
  activeWorkspace,
  connectWorkspace,
  startThreadForWorkspace,
  sendUserMessage,
  sendUserMessageToThread,
  startFork,
  startReview,
  startResume,
  startCompact,
  startMcp,
  startStatus,
  clearActiveImages,
  onComposePatchResolved,
}: UseQueuedSendOptions): UseQueuedSendResult {
  const resolveInvocationCatalog = useRuntimeInvocationCatalogResolver();
  const resolveInvocationExecute = useRuntimeInvocationExecuteResolver();
  const [queuedByThread, setQueuedByThread] = useState<Record<string, QueuedMessage[]>>({});
  const [inFlightByThread, setInFlightByThread] = useState<Record<string, QueuedMessage | null>>(
    {}
  );
  const [hasStartedByThread, setHasStartedByThread] = useState<Record<string, boolean>>({});
  const optimisticInFlightByThreadRef = useRef<Record<string, boolean>>({});

  const activeQueue = useMemo(
    () => (activeThreadId ? (queuedByThread[activeThreadId] ?? []) : []),
    [activeThreadId, queuedByThread]
  );

  const clearInFlight = useCallback((threadId: string) => {
    optimisticInFlightByThreadRef.current[threadId] = false;
    setInFlightByThread((prev) => ({ ...prev, [threadId]: null }));
    setHasStartedByThread((prev) => ({ ...prev, [threadId]: false }));
  }, []);

  const enqueueMessage = useCallback((threadId: string, item: QueuedMessage) => {
    setQueuedByThread((prev) => ({
      ...prev,
      [threadId]: [...(prev[threadId] ?? []), item],
    }));
  }, []);

  const removeQueuedMessage = useCallback((threadId: string, messageId: string) => {
    setQueuedByThread((prev) => ({
      ...prev,
      [threadId]: (prev[threadId] ?? []).filter((entry) => entry.id !== messageId),
    }));
  }, []);

  const prependQueuedMessage = useCallback((threadId: string, item: QueuedMessage) => {
    setQueuedByThread((prev) => ({
      ...prev,
      [threadId]: [item, ...(prev[threadId] ?? [])],
    }));
  }, []);

  const runSlashCommand = useCallback(
    async (command: SlashCommandKind, trimmed: string): Promise<QueuedSendDispatchResult> => {
      if (command === "fork") {
        await startFork(trimmed);
        return "handled";
      }
      if (command === "review") {
        return (await startReview(trimmed)) === false ? "blocked" : "processing";
      }
      if (command === "resume") {
        await startResume(trimmed);
        return "handled";
      }
      if (command === "compact") {
        await startCompact(trimmed);
        return "handled";
      }
      if (command === "mcp") {
        await startMcp(trimmed);
        return "handled";
      }
      if (command === "status") {
        await startStatus(trimmed);
        return "handled";
      }
      if (command === "new" && activeWorkspace) {
        const threadId = await startThreadForWorkspace(activeWorkspace.id);
        const rest = trimmed.replace(/^\/new\b/i, "").trim();
        if (threadId && rest) {
          await sendUserMessageToThread(activeWorkspace, threadId, rest, []);
        }
      }
      return "handled";
    },
    [
      activeWorkspace,
      sendUserMessageToThread,
      startFork,
      startReview,
      startResume,
      startCompact,
      startMcp,
      startStatus,
      startThreadForWorkspace,
    ]
  );

  const runInvocationSlashCommand = useCallback(
    async (trimmed: string): Promise<QueuedSendDispatchResult | null> => {
      if (!trimmed.startsWith("/") || !activeWorkspace) {
        return null;
      }
      let catalog: Awaited<
        ReturnType<ReturnType<typeof resolveInvocationCatalog>["publishActiveCatalog"]>
      > | null = null;
      try {
        catalog = await resolveInvocationCatalog(activeWorkspace.id).publishActiveCatalog({
          audience: "operator",
        });
      } catch {
        pushErrorToast({
          title: "Slash command unavailable",
          message: RUNTIME_SLASH_CATALOG_UNAVAILABLE_MESSAGE,
        });
        return "blocked";
      }
      const slashInvocations =
        catalog?.items.filter(
          (item) => item.kind === "session_command" && Boolean(item.metadata?.slashCommand)
        ) ?? [];
      const resolved = resolveInvocationSlashCommandText(trimmed, slashInvocations);
      if (!resolved) {
        return null;
      }
      if ("error" in resolved) {
        pushErrorToast({
          title: "Slash command blocked",
          message: resolved.error,
        });
        return "blocked";
      }

      const execution = await resolveInvocationExecute(activeWorkspace.id).invoke({
        invocationId: resolved.invocationId,
        arguments: resolved.arguments,
        context: {
          threadId: activeThreadId,
          turnId: activeTurnId,
          telemetrySource: "thread_slash_command",
        },
        caller: "operator",
      });
      if (!execution.ok) {
        pushErrorToast({
          title: "Slash command blocked",
          message: execution.message,
        });
        return "blocked";
      }
      if (execution.kind === "compose_patch_resolved") {
        const text = readComposePatchText(execution.payload);
        if (!text) {
          pushErrorToast({
            title: "Slash command failed",
            message: `Invocation \`${resolved.invocationId}\` returned an invalid compose patch payload.`,
          });
          return "blocked";
        }
        onComposePatchResolved?.({
          invocationId: resolved.invocationId,
          text,
        });
        return "compose_patch";
      }
      return execution.kind === "session_message_sent" ? "processing" : "handled";
    },
    [
      activeThreadId,
      activeTurnId,
      activeWorkspace,
      onComposePatchResolved,
      resolveInvocationCatalog,
      resolveInvocationExecute,
    ]
  );

  const dispatchMessage = useCallback(
    async (text: string, images: string[] = []): Promise<QueuedSendDispatchResult> => {
      const trimmed = text.trim();
      const command = parseSlashCommand(trimmed);
      if (command) {
        return await runSlashCommand(command, trimmed);
      }
      const invocationResult = await runInvocationSlashCommand(trimmed);
      if (invocationResult) {
        return invocationResult;
      }
      await sendUserMessage(trimmed, images);
      return "processing";
    },
    [runInvocationSlashCommand, runSlashCommand, sendUserMessage]
  );

  const handleSend = useCallback(
    async (text: string, images: string[] = []) => {
      const trimmed = text.trim();
      const command = parseSlashCommand(trimmed);
      const nextImages = command ? [] : images;
      if (!trimmed && nextImages.length === 0) {
        return;
      }
      if (activeThreadId && isReviewing) {
        return false;
      }
      const optimisticInFlight = activeThreadId
        ? optimisticInFlightByThreadRef.current[activeThreadId] === true
        : false;
      if ((isProcessing || optimisticInFlight) && activeThreadId && !steerEnabled) {
        const item: QueuedMessage = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          text: trimmed,
          createdAt: Date.now(),
          images: nextImages,
        };
        enqueueMessage(activeThreadId, item);
        clearActiveImages();
        return;
      }
      if (activeWorkspace && !activeWorkspace.connected) {
        await connectWorkspace(activeWorkspace);
      }

      const directSendThreadId = activeThreadId;
      if (directSendThreadId) {
        optimisticInFlightByThreadRef.current[directSendThreadId] = true;
        setInFlightByThread((prev) => ({
          ...prev,
          [directSendThreadId]: {
            id: `direct-send-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            text: trimmed,
            createdAt: Date.now(),
            images: nextImages,
          },
        }));
        setHasStartedByThread((prev) => ({
          ...prev,
          [directSendThreadId]: isProcessing,
        }));
      }
      let dispatchResult: QueuedSendDispatchResult;
      try {
        dispatchResult = await dispatchMessage(trimmed, nextImages);
      } catch (error) {
        if (directSendThreadId) {
          clearInFlight(directSendThreadId);
        }
        throw error;
      }
      if (dispatchResult === "blocked") {
        if (directSendThreadId) {
          clearInFlight(directSendThreadId);
        }
        return false;
      }
      if (dispatchResult === "compose_patch") {
        if (directSendThreadId) {
          clearInFlight(directSendThreadId);
        }
        clearActiveImages();
        return false;
      }
      if (dispatchResult === "handled") {
        if (directSendThreadId) {
          clearInFlight(directSendThreadId);
        }
        clearActiveImages();
        return;
      }
      clearActiveImages();
    },
    [
      activeThreadId,
      activeWorkspace,
      clearActiveImages,
      clearInFlight,
      connectWorkspace,
      dispatchMessage,
      enqueueMessage,
      isProcessing,
      isReviewing,
      steerEnabled,
    ]
  );

  const queueMessage = useCallback(
    async (text: string, images: string[] = []) => {
      const trimmed = text.trim();
      const command = parseSlashCommand(trimmed);
      const nextImages = command ? [] : images;
      if (!trimmed && nextImages.length === 0) {
        return;
      }
      if (activeThreadId && isReviewing) {
        return;
      }
      if (!activeThreadId) {
        return;
      }
      const item: QueuedMessage = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text: trimmed,
        createdAt: Date.now(),
        images: nextImages,
      };
      enqueueMessage(activeThreadId, item);
      clearActiveImages();
    },
    [activeThreadId, clearActiveImages, enqueueMessage, isReviewing]
  );

  useEffect(() => {
    if (!activeThreadId) {
      return;
    }
    const inFlight = inFlightByThread[activeThreadId];
    if (!inFlight) {
      return;
    }
    if (isProcessing || isReviewing) {
      if (!hasStartedByThread[activeThreadId]) {
        setHasStartedByThread((prev) => ({
          ...prev,
          [activeThreadId]: true,
        }));
      }
      return;
    }
    if (hasStartedByThread[activeThreadId]) {
      setInFlightByThread((prev) => ({ ...prev, [activeThreadId]: null }));
      setHasStartedByThread((prev) => ({ ...prev, [activeThreadId]: false }));
    }
  }, [activeThreadId, hasStartedByThread, inFlightByThread, isProcessing, isReviewing]);

  useEffect(() => {
    if (!activeThreadId || isProcessing || isReviewing || queueFlushPaused) {
      return;
    }
    if (inFlightByThread[activeThreadId]) {
      return;
    }
    const queue = queuedByThread[activeThreadId] ?? [];
    if (queue.length === 0) {
      return;
    }
    const threadId = activeThreadId;
    const nextItem = queue[0];
    optimisticInFlightByThreadRef.current[threadId] = true;
    setInFlightByThread((prev) => ({ ...prev, [threadId]: nextItem }));
    setHasStartedByThread((prev) => ({ ...prev, [threadId]: false }));
    setQueuedByThread((prev) => ({
      ...prev,
      [threadId]: (prev[threadId] ?? []).slice(1),
    }));
    (async () => {
      try {
        const dispatchResult = await dispatchMessage(nextItem.text, nextItem.images ?? []);
        if (dispatchResult !== "processing") {
          clearInFlight(threadId);
        }
      } catch {
        clearInFlight(threadId);
        prependQueuedMessage(threadId, nextItem);
      }
    })();
  }, [
    activeThreadId,
    clearInFlight,
    dispatchMessage,
    inFlightByThread,
    isProcessing,
    isReviewing,
    prependQueuedMessage,
    queueFlushPaused,
    queuedByThread,
  ]);

  return {
    queuedByThread,
    activeQueue,
    handleSend,
    queueMessage,
    removeQueuedMessage,
  };
}
