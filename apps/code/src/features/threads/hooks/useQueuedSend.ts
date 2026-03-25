import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { QueuedMessage, WorkspaceInfo } from "../../../types";
import { parseBuiltInSlashCommand } from "../../../utils/slashCommands";

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
};

type UseQueuedSendResult = {
  queuedByThread: Record<string, QueuedMessage[]>;
  activeQueue: QueuedMessage[];
  handleSend: (text: string, images?: string[]) => Promise<void | false>;
  queueMessage: (text: string, images?: string[]) => Promise<void>;
  removeQueuedMessage: (threadId: string, messageId: string) => void;
};

type SlashCommandKind = "compact" | "fork" | "mcp" | "new" | "resume" | "review" | "status";

function parseSlashCommand(text: string): SlashCommandKind | null {
  return parseBuiltInSlashCommand(text);
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
}: UseQueuedSendOptions): UseQueuedSendResult {
  // Steering no longer requires an active turn id; keep the input for compatibility.
  void activeTurnId;
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
    async (command: SlashCommandKind, trimmed: string): Promise<void | false> => {
      if (command === "fork") {
        await startFork(trimmed);
        return;
      }
      if (command === "review") {
        return await startReview(trimmed);
      }
      if (command === "resume") {
        await startResume(trimmed);
        return;
      }
      if (command === "compact") {
        await startCompact(trimmed);
        return;
      }
      if (command === "mcp") {
        await startMcp(trimmed);
        return;
      }
      if (command === "status") {
        await startStatus(trimmed);
        return;
      }
      if (command === "new" && activeWorkspace) {
        const threadId = await startThreadForWorkspace(activeWorkspace.id);
        const rest = trimmed.replace(/^\/new\b/i, "").trim();
        if (threadId && rest) {
          await sendUserMessageToThread(activeWorkspace, threadId, rest, []);
        }
      }
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
      if (command) {
        const commandResult = await runSlashCommand(command, trimmed);
        if (commandResult === false) {
          return false;
        }
        clearActiveImages();
        return;
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
      try {
        await sendUserMessage(trimmed, nextImages);
      } catch (error) {
        if (directSendThreadId) {
          clearInFlight(directSendThreadId);
        }
        throw error;
      }
      clearActiveImages();
    },
    [
      activeThreadId,
      activeWorkspace,
      clearActiveImages,
      clearInFlight,
      connectWorkspace,
      enqueueMessage,
      isProcessing,
      isReviewing,
      steerEnabled,
      runSlashCommand,
      sendUserMessage,
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
  }, [
    activeThreadId,
    clearInFlight,
    hasStartedByThread,
    inFlightByThread,
    isProcessing,
    isReviewing,
  ]);

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
        const trimmed = nextItem.text.trim();
        const command = parseSlashCommand(trimmed);
        if (command) {
          await runSlashCommand(command, trimmed);
        } else {
          await sendUserMessage(nextItem.text, nextItem.images ?? []);
        }
      } catch {
        setInFlightByThread((prev) => ({ ...prev, [threadId]: null }));
        setHasStartedByThread((prev) => ({ ...prev, [threadId]: false }));
        prependQueuedMessage(threadId, nextItem);
      }
    })();
  }, [
    activeThreadId,
    inFlightByThread,
    isProcessing,
    isReviewing,
    queueFlushPaused,
    prependQueuedMessage,
    queuedByThread,
    runSlashCommand,
    sendUserMessage,
  ]);

  return {
    queuedByThread,
    activeQueue,
    handleSend,
    queueMessage,
    removeQueuedMessage,
  };
}
