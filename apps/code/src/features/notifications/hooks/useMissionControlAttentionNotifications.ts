import type {
  HugeCodeMissionControlSnapshot,
  HugeCodeReviewPackSummary,
  HugeCodeRunSummary,
  HugeCodeTaskSummary,
} from "@ku0/code-runtime-host-contract";
import { useCallback, useEffect, useRef } from "react";
import { summarizeReviewContinuationActionability } from "../../../application/runtime/facades/runtimeReviewContinuationFacade";
import { sendNotification } from "../../../application/runtime/ports/tauriNotifications";
import type { DebugEntry } from "../../../types";
import type { MissionNavigationTarget } from "../../missions/utils/missionControlPresentation";

const MAX_BODY_LENGTH = 200;

type AttentionType = "approval_wait" | "environment_blocked";

type MissionControlAttentionNotificationOptions = {
  enabled: boolean;
  isWindowFocused: boolean;
  missionControlProjection: HugeCodeMissionControlSnapshot | null;
  getWorkspaceName?: (workspaceId: string) => string | undefined;
  onThreadNotificationSent?: (workspaceId: string, threadId: string) => void;
  onMissionNotificationSent?: (target: MissionNavigationTarget) => void;
  onDebug?: (entry: DebugEntry) => void;
};

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1)}…`;
}

function resolveThreadId(task: HugeCodeTaskSummary | undefined): string | null {
  if (!task) {
    return null;
  }
  if (task.origin.kind === "thread") {
    return task.origin.threadId;
  }
  if (typeof task.origin.threadId === "string" && task.origin.threadId.trim().length > 0) {
    return task.origin.threadId.trim();
  }
  return null;
}

function resolveAttentionType(run: HugeCodeRunSummary): AttentionType | null {
  if (run.reviewDecision?.status === "rejected") {
    return null;
  }
  if (run.approval?.status === "pending_decision") {
    return "approval_wait";
  }
  if (run.operatorState?.health === "blocked" || run.operatorSnapshot?.blocker) {
    return "environment_blocked";
  }
  return null;
}

function resolveAttentionTitle(type: AttentionType, workspaceName: string | undefined): string {
  const suffix = workspaceName ? ` — ${workspaceName}` : "";
  if (type === "approval_wait") {
    return `Approval needed${suffix}`;
  }
  return `Mission blocked${suffix}`;
}

function resolveAttentionBody(type: AttentionType, run: HugeCodeRunSummary): string {
  if (type === "approval_wait") {
    return run.approval?.summary?.trim() || "Run is waiting for approval.";
  }
  return (
    run.operatorSnapshot?.blocker?.trim() ||
    run.operatorState?.detail?.trim() ||
    run.nextAction?.detail?.trim() ||
    run.summary?.trim() ||
    "Run is blocked by environment."
  );
}

function resolveRejectedBody(
  reviewPack: HugeCodeReviewPackSummary,
  run: HugeCodeRunSummary | null | undefined
): string {
  const continuation = summarizeReviewContinuationActionability({
    takeoverBundle: reviewPack.takeoverBundle ?? run?.takeoverBundle ?? null,
    actionability: reviewPack.actionability ?? run?.actionability ?? null,
    missionLinkage: reviewPack.missionLinkage ?? run?.missionLinkage ?? null,
    publishHandoff: reviewPack.publishHandoff ?? run?.publishHandoff ?? null,
  });
  return (
    reviewPack.reviewDecision?.summary?.trim() ||
    (continuation.state !== "missing" ? continuation.recommendedAction : null) ||
    reviewPack.recommendedNextAction?.trim() ||
    reviewPack.summary.trim() ||
    "Reviewer requested changes before this run can be accepted."
  );
}

export function useMissionControlAttentionNotifications({
  enabled,
  isWindowFocused,
  missionControlProjection,
  getWorkspaceName,
  onThreadNotificationSent,
  onMissionNotificationSent,
  onDebug,
}: MissionControlAttentionNotificationOptions) {
  const hasObservedRuntimeSnapshotRef = useRef(false);
  const previousAttentionByRunIdRef = useRef(new Map<string, AttentionType | null>());
  const previousReviewDecisionByPackIdRef = useRef(new Map<string, string | null>());

  const notify = useCallback(
    async (title: string, body: string, extra: Record<string, unknown>) => {
      if (!enabled || isWindowFocused) {
        return;
      }
      try {
        await sendNotification(title, truncateText(body, MAX_BODY_LENGTH), {
          autoCancel: true,
          extra,
        });
        onDebug?.({
          id: `${Date.now()}-client-notification-mission-attention`,
          timestamp: Date.now(),
          source: "client",
          label: "notification/mission-attention",
          payload: extra,
        });
      } catch (error) {
        onDebug?.({
          id: `${Date.now()}-client-notification-mission-attention-error`,
          timestamp: Date.now(),
          source: "error",
          label: "notification/mission-attention-error",
          payload: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [enabled, isWindowFocused, onDebug]
  );

  useEffect(() => {
    if (!missionControlProjection || missionControlProjection.source !== "runtime_snapshot_v1") {
      hasObservedRuntimeSnapshotRef.current = false;
      previousAttentionByRunIdRef.current.clear();
      previousReviewDecisionByPackIdRef.current.clear();
      return;
    }

    const taskById = new Map(missionControlProjection.tasks.map((task) => [task.id, task]));
    const nextAttentionByRunId = new Map<string, AttentionType | null>();
    const nextReviewDecisionByPackId = new Map<string, string | null>();

    if (!hasObservedRuntimeSnapshotRef.current) {
      for (const run of missionControlProjection.runs) {
        nextAttentionByRunId.set(run.id, resolveAttentionType(run));
      }
      for (const reviewPack of missionControlProjection.reviewPacks) {
        nextReviewDecisionByPackId.set(reviewPack.id, reviewPack.reviewDecision?.status ?? null);
      }
      hasObservedRuntimeSnapshotRef.current = true;
      previousAttentionByRunIdRef.current = nextAttentionByRunId;
      previousReviewDecisionByPackIdRef.current = nextReviewDecisionByPackId;
      return;
    }

    for (const run of missionControlProjection.runs) {
      const currentType = resolveAttentionType(run);
      const previousType = previousAttentionByRunIdRef.current.get(run.id) ?? null;
      nextAttentionByRunId.set(run.id, currentType);

      if (!currentType || currentType === previousType) {
        continue;
      }

      const task = taskById.get(run.taskId);
      const threadId = resolveThreadId(task);
      const workspaceName = getWorkspaceName?.(run.workspaceId);
      void notify(
        resolveAttentionTitle(currentType, workspaceName),
        resolveAttentionBody(currentType, run),
        {
          kind: "mission_attention",
          type: currentType,
          workspaceId: run.workspaceId,
          taskId: run.taskId,
          runId: run.id,
          threadId,
          reviewPackId: run.reviewPackId ?? null,
        }
      );
      if (threadId) {
        onThreadNotificationSent?.(run.workspaceId, threadId);
      }
      onMissionNotificationSent?.({
        kind: "mission",
        workspaceId: run.workspaceId,
        taskId: run.taskId,
        runId: run.id,
        reviewPackId: run.reviewPackId ?? null,
        threadId,
        limitation: threadId ? null : "thread_unavailable",
      });
    }

    for (const reviewPack of missionControlProjection.reviewPacks) {
      const currentStatus = reviewPack.reviewDecision?.status ?? null;
      const previousStatus = previousReviewDecisionByPackIdRef.current.get(reviewPack.id) ?? null;
      nextReviewDecisionByPackId.set(reviewPack.id, currentStatus);

      if (currentStatus !== "rejected" || previousStatus === "rejected") {
        continue;
      }

      const run = missionControlProjection.runs.find((entry) => entry.id === reviewPack.runId);
      const workspaceName = getWorkspaceName?.(reviewPack.workspaceId);
      void notify(
        `Changes requested${workspaceName ? ` — ${workspaceName}` : ""}`,
        resolveRejectedBody(reviewPack, run),
        {
          kind: "mission_attention",
          type: "review_rejected",
          workspaceId: reviewPack.workspaceId,
          taskId: reviewPack.taskId,
          runId: reviewPack.runId,
          reviewPackId: reviewPack.id,
        }
      );
      onMissionNotificationSent?.({
        kind: "review",
        workspaceId: reviewPack.workspaceId,
        taskId: reviewPack.taskId,
        runId: run?.id ?? reviewPack.runId,
        reviewPackId: reviewPack.id,
        limitation: null,
      });
    }

    previousAttentionByRunIdRef.current = nextAttentionByRunId;
    previousReviewDecisionByPackIdRef.current = nextReviewDecisionByPackId;
  }, [
    getWorkspaceName,
    missionControlProjection,
    notify,
    onMissionNotificationSent,
    onThreadNotificationSent,
  ]);
}
