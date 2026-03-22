import type {
  HugeCodeMissionControlSnapshot,
  HugeCodeRunState,
  HugeCodeTaskSummary,
} from "@ku0/code-runtime-host-contract";
import { useCallback, useEffect, useRef } from "react";
import { sendNotification } from "../../../application/runtime/ports/tauriNotifications";
import type { DebugEntry } from "../../../types";
import type { MissionNavigationTarget } from "../../missions/utils/missionControlPresentation";

const DEFAULT_MIN_DURATION_MS = 60_000;
const MAX_BODY_LENGTH = 200;

type MissionControlCompletionNotificationOptions = {
  enabled: boolean;
  isWindowFocused: boolean;
  missionControlProjection: HugeCodeMissionControlSnapshot | null;
  minDurationMs?: number;
  getWorkspaceName?: (workspaceId: string) => string | undefined;
  onThreadNotificationSent?: (workspaceId: string, threadId: string) => void;
  onMissionNotificationSent?: (target: MissionNavigationTarget) => void;
  onDebug?: (entry: DebugEntry) => void;
};

function isTerminalRunState(state: HugeCodeRunState): boolean {
  return state === "review_ready" || state === "failed" || state === "cancelled";
}

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

function resolveDefaultBody(state: HugeCodeRunState): string {
  if (state === "review_ready") {
    return "Task is ready for review.";
  }
  if (state === "failed") {
    return "Task ended with an error.";
  }
  return "Task was cancelled.";
}

function resolveRunDurationMs(startedAt: number | null, finishedAt: number | null): number | null {
  if (
    typeof startedAt !== "number" ||
    !Number.isFinite(startedAt) ||
    typeof finishedAt !== "number" ||
    !Number.isFinite(finishedAt)
  ) {
    return null;
  }
  const duration = finishedAt - startedAt;
  return Number.isFinite(duration) && duration >= 0 ? duration : null;
}

export function useMissionControlCompletionNotifications({
  enabled,
  isWindowFocused,
  missionControlProjection,
  minDurationMs = DEFAULT_MIN_DURATION_MS,
  getWorkspaceName,
  onThreadNotificationSent,
  onMissionNotificationSent,
  onDebug,
}: MissionControlCompletionNotificationOptions) {
  const mountedAtRef = useRef(Date.now());
  const hasObservedRuntimeSnapshotRef = useRef(false);
  const previousStateByRunIdRef = useRef(new Map<string, HugeCodeRunState>());
  const notifiedTerminalStatesRef = useRef(new Set<string>());

  const notifyRunTransition = useCallback(
    async (params: {
      runId: string;
      taskId: string;
      workspaceId: string;
      threadId: string | null;
      reviewPackId: string | null;
      state: HugeCodeRunState;
      summary: string | null;
      durationMs: number | null;
    }) => {
      if (!enabled || isWindowFocused) {
        return;
      }
      if (params.durationMs !== null && params.durationMs < minDurationMs) {
        return;
      }
      const stateKey = `${params.runId}:${params.state}`;
      if (notifiedTerminalStatesRef.current.has(stateKey)) {
        return;
      }
      notifiedTerminalStatesRef.current.add(stateKey);
      const title = getWorkspaceName?.(params.workspaceId) ?? "Agent Complete";
      const body = truncateText(
        params.summary?.trim() || resolveDefaultBody(params.state),
        MAX_BODY_LENGTH
      );
      try {
        await sendNotification(title, body, {
          autoCancel: true,
          extra: {
            kind: "mission_run",
            workspaceId: params.workspaceId,
            taskId: params.taskId,
            runId: params.runId,
            reviewPackId: params.reviewPackId,
            state: params.state,
            threadId: params.threadId,
          },
        });
        if (params.threadId) {
          onThreadNotificationSent?.(params.workspaceId, params.threadId);
        }
        onMissionNotificationSent?.({
          kind: "mission",
          workspaceId: params.workspaceId,
          taskId: params.taskId,
          runId: params.runId,
          reviewPackId: params.reviewPackId,
          threadId: params.threadId,
          limitation: params.threadId ? null : "thread_unavailable",
        });
        onDebug?.({
          id: `${Date.now()}-client-notification-mission-run`,
          timestamp: Date.now(),
          source: "client",
          label: "notification/mission-run",
          payload: {
            runId: params.runId,
            taskId: params.taskId,
            workspaceId: params.workspaceId,
            state: params.state,
          },
        });
      } catch (error) {
        onDebug?.({
          id: `${Date.now()}-client-notification-mission-run-error`,
          timestamp: Date.now(),
          source: "error",
          label: "notification/mission-run-error",
          payload: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [
      enabled,
      getWorkspaceName,
      isWindowFocused,
      minDurationMs,
      onDebug,
      onMissionNotificationSent,
      onThreadNotificationSent,
    ]
  );

  useEffect(() => {
    if (!missionControlProjection || missionControlProjection.source !== "runtime_snapshot_v1") {
      hasObservedRuntimeSnapshotRef.current = false;
      previousStateByRunIdRef.current.clear();
      return;
    }
    const taskById = new Map(missionControlProjection.tasks.map((task) => [task.id, task]));
    const reviewPackIdByRunId = new Map(
      missionControlProjection.reviewPacks.map((reviewPack) => [reviewPack.runId, reviewPack.id])
    );
    const nextStateByRunId = new Map<string, HugeCodeRunState>();

    if (!hasObservedRuntimeSnapshotRef.current) {
      for (const run of missionControlProjection.runs) {
        nextStateByRunId.set(run.id, run.state);
      }
      hasObservedRuntimeSnapshotRef.current = true;
      previousStateByRunIdRef.current = nextStateByRunId;
      return;
    }

    for (const run of missionControlProjection.runs) {
      nextStateByRunId.set(run.id, run.state);
      if (!isTerminalRunState(run.state)) {
        continue;
      }

      const previousState = previousStateByRunIdRef.current.get(run.id);
      const transitionedToTerminal =
        previousState !== undefined && !isTerminalRunState(previousState);
      const terminalRunObservedAfterMount =
        previousState === undefined &&
        typeof run.finishedAt === "number" &&
        Number.isFinite(run.finishedAt) &&
        run.finishedAt >= mountedAtRef.current;

      if (!transitionedToTerminal && !terminalRunObservedAfterMount) {
        continue;
      }

      const task = taskById.get(run.taskId);
      const threadId = resolveThreadId(task);
      void notifyRunTransition({
        runId: run.id,
        taskId: run.taskId,
        workspaceId: run.workspaceId,
        threadId,
        state: run.state,
        summary: run.summary,
        durationMs: resolveRunDurationMs(run.startedAt, run.finishedAt),
        reviewPackId: run.reviewPackId ?? reviewPackIdByRunId.get(run.id) ?? null,
      });
    }

    previousStateByRunIdRef.current = nextStateByRunId;
  }, [missionControlProjection, notifyRunTransition]);
}
