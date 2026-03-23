import { useEffect, useRef } from "react";
import { normalizeLifecycleStatus } from "../../../utils/lifecycleStatus";
import type { AutoDriveControllerHookDraft } from "../../../application/runtime/types/autoDrive";
import type { ConversationItem, WorkspaceInfo } from "../../../types";

type AutoDriveContinuationDraftEntry = {
  autoDriveDraft?: AutoDriveControllerHookDraft | null;
} | null;

type SendUserMessageToThread = (
  workspace: WorkspaceInfo,
  threadId: string,
  text: string,
  images?: string[],
  options?: { skipPromptExpansion?: boolean }
) => Promise<void>;

type UseMainAppAutoDriveContinuationOptions = {
  activeWorkspace: WorkspaceInfo | null;
  activeThreadId: string | null;
  activeItems: ConversationItem[];
  threadStatusById: Record<
    string,
    | {
        isProcessing: boolean;
      }
    | undefined
  >;
  getThreadCodexParams: (workspaceId: string, threadId: string) => AutoDriveContinuationDraftEntry;
  sendUserMessageToThread: SendUserMessageToThread;
};

type AutoDriveTurnSummary = {
  userMessageId: string;
  userText: string;
  assistantText: string | null;
  changedPaths: string[];
  failedToolDetails: string[];
};

type AutoDriveContinuationTracker = {
  previousProcessing: boolean;
  automaticFollowUpCount: number;
  lastProcessedUserMessageId: string | null;
  lastAutoPromptText: string | null;
};

function dedupe(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}

function extractLatestAssistantText(items: ConversationItem[]): string | null {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item?.kind !== "message" || item.role !== "assistant") {
      continue;
    }
    const text = item.text.trim();
    if (text.length > 0) {
      return text;
    }
  }
  return null;
}

function resolveAssistantGapSignal(assistantText: string | null): string | null {
  if (!assistantText) {
    return null;
  }
  const normalizedText = assistantText.trim();
  if (normalizedText.length === 0) {
    return null;
  }
  if (
    /failed|blocked|pending|error|cannot|unable|timeout|timed out|missing|unresolved/i.test(
      normalizedText
    )
  ) {
    return normalizedText;
  }
  return null;
}

export function summarizeLatestAutoDriveTurn(
  items: ConversationItem[]
): AutoDriveTurnSummary | null {
  let latestUserIndex = -1;
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item?.kind === "message" && item.role === "user") {
      latestUserIndex = index;
      break;
    }
  }
  if (latestUserIndex < 0) {
    return null;
  }

  const userMessage = items[latestUserIndex];
  if (!userMessage || userMessage.kind !== "message" || userMessage.role !== "user") {
    return null;
  }

  const turnItems = items.slice(latestUserIndex + 1);
  const assistantText = extractLatestAssistantText(turnItems);
  const toolItems = turnItems.filter(
    (item): item is Extract<ConversationItem, { kind: "tool" }> => item.kind === "tool"
  );
  const failedToolDetails = dedupe(
    toolItems
      .filter((item) => normalizeLifecycleStatus(item.status) === "failed")
      .map((item) => {
        const base = item.title.trim() || item.detail.trim() || "Tool step failed";
        const detail = item.output?.trim() || item.detail.trim();
        return detail.length > 0 && detail !== base ? `${base}: ${detail}` : base;
      })
  );
  const changedPaths = dedupe(
    toolItems.flatMap((item) => item.changes?.map((change) => change.path) ?? [])
  );

  return {
    userMessageId: userMessage.id,
    userText: userMessage.text,
    assistantText: assistantText?.trim() || null,
    changedPaths,
    failedToolDetails,
  };
}

export function buildAutoDriveContinuationPrompt(summary: AutoDriveTurnSummary): string | null {
  const gapSignals = dedupe([
    ...summary.failedToolDetails.slice(0, 2),
    resolveAssistantGapSignal(summary.assistantText) ?? "",
  ]);

  if (gapSignals.length === 0) {
    return null;
  }

  const lines = [
    "AutoDrive continuation",
    "继续当前路线，不要重做已经完成的工作。",
    `上一轮未闭环点：${gapSignals.join(" | ")}`,
    summary.changedPaths.length > 0
      ? `已触达路径：${summary.changedPaths.slice(0, 5).join(", ")}`
      : null,
    "先解决最高优先级失败或验证缺口，再运行与你这条路线最相关的最窄真实验证。",
    "只有在最终 pass/fail 已明确，或者确认存在真实阻塞并说明阻塞原因后，才停止。",
  ];

  return lines.filter((line): line is string => Boolean(line)).join("\n");
}

function shouldAutoContinueTurn(summary: AutoDriveTurnSummary): boolean {
  if (summary.failedToolDetails.length > 0) {
    return true;
  }
  return resolveAssistantGapSignal(summary.assistantText) !== null;
}

export function useMainAppAutoDriveContinuation({
  activeWorkspace,
  activeThreadId,
  activeItems,
  threadStatusById,
  getThreadCodexParams,
  sendUserMessageToThread,
}: UseMainAppAutoDriveContinuationOptions) {
  const trackerRef = useRef<Record<string, AutoDriveContinuationTracker>>({});

  useEffect(() => {
    if (!activeWorkspace?.id || !activeThreadId) {
      return;
    }

    const draft = getThreadCodexParams(activeWorkspace.id, activeThreadId)?.autoDriveDraft ?? null;
    if (!draft?.enabled || draft.continuation?.enabled === false) {
      delete trackerRef.current[`${activeWorkspace.id}:${activeThreadId}`];
      return;
    }

    const trackerKey = `${activeWorkspace.id}:${activeThreadId}`;
    const tracker =
      trackerRef.current[trackerKey] ??
      ({
        previousProcessing: false,
        automaticFollowUpCount: 0,
        lastProcessedUserMessageId: null,
        lastAutoPromptText: null,
      } satisfies AutoDriveContinuationTracker);
    trackerRef.current[trackerKey] = tracker;

    const isProcessing = threadStatusById[activeThreadId]?.isProcessing ?? false;
    const latestTurn = summarizeLatestAutoDriveTurn(activeItems);
    const justCompleted = tracker.previousProcessing && !isProcessing;
    tracker.previousProcessing = isProcessing;

    if (!justCompleted || !latestTurn) {
      return;
    }
    if (tracker.lastProcessedUserMessageId === latestTurn.userMessageId) {
      return;
    }

    const latestUserWasAutoPrompt =
      tracker.lastAutoPromptText !== null &&
      latestTurn.userText.trim() === tracker.lastAutoPromptText;
    if (!latestUserWasAutoPrompt) {
      tracker.automaticFollowUpCount = 0;
    }
    tracker.lastProcessedUserMessageId = latestTurn.userMessageId;

    if (!shouldAutoContinueTurn(latestTurn)) {
      tracker.lastAutoPromptText = null;
      return;
    }

    const maxAutomaticFollowUps = Math.max(0, draft.continuation?.maxAutomaticFollowUps ?? 2);
    if (tracker.automaticFollowUpCount >= maxAutomaticFollowUps) {
      return;
    }

    const followUpPrompt = buildAutoDriveContinuationPrompt(latestTurn);
    if (!followUpPrompt) {
      tracker.lastAutoPromptText = null;
      return;
    }

    tracker.automaticFollowUpCount += 1;
    tracker.lastAutoPromptText = followUpPrompt;
    void sendUserMessageToThread(activeWorkspace, activeThreadId, followUpPrompt, [], {
      skipPromptExpansion: true,
    });
  }, [
    activeItems,
    activeThreadId,
    activeWorkspace,
    getThreadCodexParams,
    sendUserMessageToThread,
    threadStatusById,
  ]);
}
