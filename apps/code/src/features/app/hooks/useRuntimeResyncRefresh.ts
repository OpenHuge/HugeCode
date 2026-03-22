import { useEffect, useRef } from "react";
import { recordRuntimeEventDedupeHit } from "../../../application/runtime/ports/runtimeEventStabilityMetrics";
import { subscribeRuntimeEventStateChannel } from "../../../application/runtime/ports/runtimeEventStateMachine";
import { subscribeScopedRuntimeUpdatedEvents } from "../../../application/runtime/ports/runtimeUpdatedEvents";
import { pushErrorToast } from "../../../application/runtime/ports/toasts";
import type { DebugEntry, WorkspaceInfo } from "../../../types";
import {
  parseRuntimeDurabilityDiagnostics,
  parseRuntimeDurabilityWorkspaceId,
  RUNTIME_DURABILITY_WINDOW_MS,
  serializeRuntimeDurabilityEventKey,
} from "../../../utils/runtimeUpdatedDurability";

const RESYNC_REASONS = new Set(["event_replay_gap", "event_stream_lagged", "stream_reconnected"]);
const RESYNC_REFRESH_DEBOUNCE_MS = 350;
const RESYNC_NOTICE_THROTTLE_MS = 20_000;

type UseRuntimeResyncRefreshOptions = {
  activeWorkspace: WorkspaceInfo | null;
  activeThreadId: string | null;
  refreshWorkspaces: () => Promise<WorkspaceInfo[] | undefined> | unknown;
  listThreadsForWorkspace: (
    workspace: WorkspaceInfo,
    options?: { preserveState?: boolean }
  ) => Promise<void> | void;
  refreshThread: (workspaceId: string, threadId: string) => Promise<unknown> | unknown;
  refreshAccountInfo: (workspaceId?: string) => Promise<unknown> | unknown;
  refreshAccountRateLimits: (workspaceId?: string) => Promise<unknown> | unknown;
  onDebug?: (entry: DebugEntry) => void;
};

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function reasonPriority(reason: string): number {
  if (reason === "event_replay_gap") {
    return 3;
  }
  if (reason === "event_stream_lagged") {
    return 2;
  }
  if (reason === "stream_reconnected") {
    return 1;
  }
  return 0;
}

export function useRuntimeResyncRefresh(options: UseRuntimeResyncRefreshOptions) {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const pendingScope = new Set<string>();
    let pendingReason: string | null = null;
    let pendingReplayGapLastEventId: number | null = null;
    let pendingReplayGapOldestEventId: number | null = null;
    let pendingStreamLaggedDroppedEvents: number | null = null;
    const durabilitySeenAtByKey = new Map<string, number>();
    let lastNoticeAtMs = 0;

    const flush = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        const reason = pendingReason;
        const scope = Array.from(pendingScope);
        const replayGapLastEventId = pendingReplayGapLastEventId;
        const replayGapOldestEventId = pendingReplayGapOldestEventId;
        const streamLaggedDroppedEvents = pendingStreamLaggedDroppedEvents;
        pendingReason = null;
        pendingScope.clear();
        pendingReplayGapLastEventId = null;
        pendingReplayGapOldestEventId = null;
        pendingStreamLaggedDroppedEvents = null;
        if (!reason || scope.length === 0) {
          return;
        }

        const {
          activeWorkspace,
          activeThreadId,
          refreshWorkspaces,
          listThreadsForWorkspace,
          refreshThread,
          refreshAccountInfo,
          refreshAccountRateLimits,
          onDebug,
        } = optionsRef.current;

        onDebug?.({
          id: `${Date.now()}-runtime-resync-refresh`,
          timestamp: Date.now(),
          source: "server",
          label: "native state fabric resync refresh",
          payload: {
            reason,
            scope,
            replayGapLastEventId,
            replayGapOldestEventId,
            streamLaggedDroppedEvents,
          },
        });

        const now = Date.now();
        if (now - lastNoticeAtMs >= RESYNC_NOTICE_THROTTLE_MS) {
          if (reason === "event_stream_lagged") {
            pushErrorToast({
              title: "Runtime stream lag detected",
              message:
                streamLaggedDroppedEvents && streamLaggedDroppedEvents > 0
                  ? `Resynced after dropping ${streamLaggedDroppedEvents} event(s).`
                  : "Resynced after stream lag.",
            });
            lastNoticeAtMs = now;
          } else if (reason === "event_replay_gap") {
            const gapSummary =
              replayGapLastEventId !== null && replayGapOldestEventId !== null
                ? `Replay resumed from ${replayGapOldestEventId} after ${replayGapLastEventId}.`
                : "Replay gap detected; runtime state was resynced.";
            pushErrorToast({
              title: "Runtime replay gap detected",
              message: gapSummary,
            });
            lastNoticeAtMs = now;
          }
        }

        if (scope.includes("bootstrap") || scope.includes("workspaces")) {
          void Promise.resolve(refreshWorkspaces()).catch(() => undefined);
        }

        const shouldRefreshThreads =
          scope.includes("bootstrap") || scope.includes("threads") || scope.includes("workspaces");
        if (activeWorkspace?.connected && shouldRefreshThreads) {
          void Promise.resolve(
            listThreadsForWorkspace(activeWorkspace, { preserveState: true })
          ).catch(() => undefined);
          if (activeThreadId) {
            void Promise.resolve(refreshThread(activeWorkspace.id, activeThreadId)).catch(
              () => undefined
            );
          }
        }

        if (activeWorkspace?.connected && scope.includes("oauth")) {
          void Promise.resolve(refreshAccountInfo(activeWorkspace.id)).catch(() => undefined);
          void Promise.resolve(refreshAccountRateLimits(activeWorkspace.id)).catch(() => undefined);
        }
      }, RESYNC_REFRESH_DEBOUNCE_MS);
    };

    const unlisten = subscribeScopedRuntimeUpdatedEvents(
      {
        workspaceId: options.activeWorkspace?.id ?? null,
        scopes: ["agents", "bootstrap", "workspaces", "threads", "oauth"],
      },
      ({ event, params, reason, scope }) => {
        const durabilityDiagnostics = parseRuntimeDurabilityDiagnostics(params);
        if (durabilityDiagnostics) {
          const workspaceId = parseRuntimeDurabilityWorkspaceId(event, params);
          const dedupeKey = serializeRuntimeDurabilityEventKey(
            {
              revision: durabilityDiagnostics.revision,
              workspaceId,
              reason: durabilityDiagnostics.reason,
            },
            durabilityDiagnostics.updatedAt
          );
          const now = Date.now();
          for (const [key, recordedAt] of durabilitySeenAtByKey.entries()) {
            if (now - recordedAt >= RUNTIME_DURABILITY_WINDOW_MS) {
              durabilitySeenAtByKey.delete(key);
            }
          }
          const lastRecordedAt = durabilitySeenAtByKey.get(dedupeKey);
          if (
            typeof lastRecordedAt === "number" &&
            now - lastRecordedAt < RUNTIME_DURABILITY_WINDOW_MS
          ) {
            recordRuntimeEventDedupeHit();
            return;
          }
          durabilitySeenAtByKey.set(dedupeKey, now);

          optionsRef.current.onDebug?.({
            id: `${now}-runtime-durability-warning`,
            timestamp: now,
            source: "server",
            label: "native state fabric warning durability degraded",
            payload: {
              reason: durabilityDiagnostics.reason,
              scope: durabilityDiagnostics.scope,
              ...(durabilityDiagnostics.revision
                ? { revision: durabilityDiagnostics.revision }
                : {}),
              ...(workspaceId ? { workspaceId } : {}),
              ...(durabilityDiagnostics.updatedAt !== null
                ? { updatedAt: durabilityDiagnostics.updatedAt }
                : {}),
              ...(durabilityDiagnostics.mode ? { mode: durabilityDiagnostics.mode } : {}),
              ...(durabilityDiagnostics.degraded !== null
                ? { degraded: durabilityDiagnostics.degraded }
                : {}),
              ...(durabilityDiagnostics.checkpointWriteTotal !== null
                ? { checkpointWriteTotal: durabilityDiagnostics.checkpointWriteTotal }
                : {}),
              ...(durabilityDiagnostics.checkpointWriteFailedTotal !== null
                ? { checkpointWriteFailedTotal: durabilityDiagnostics.checkpointWriteFailedTotal }
                : {}),
              ...(durabilityDiagnostics.agentTaskCheckpointRecoverTotal !== null
                ? {
                    agentTaskCheckpointRecoverTotal:
                      durabilityDiagnostics.agentTaskCheckpointRecoverTotal,
                  }
                : {}),
              ...(durabilityDiagnostics.subagentCheckpointRecoverTotal !== null
                ? {
                    subagentCheckpointRecoverTotal:
                      durabilityDiagnostics.subagentCheckpointRecoverTotal,
                  }
                : {}),
              ...(durabilityDiagnostics.runtimeRecoveryInterruptTotal !== null
                ? {
                    runtimeRecoveryInterruptTotal:
                      durabilityDiagnostics.runtimeRecoveryInterruptTotal,
                  }
                : {}),
              ...(durabilityDiagnostics.agentTaskResumeTotal !== null
                ? { agentTaskResumeTotal: durabilityDiagnostics.agentTaskResumeTotal }
                : {}),
              ...(durabilityDiagnostics.agentTaskResumeFailedTotal !== null
                ? { agentTaskResumeFailedTotal: durabilityDiagnostics.agentTaskResumeFailedTotal }
                : {}),
            },
          });
          return;
        }

        if (!RESYNC_REASONS.has(reason)) {
          return;
        }
        for (const entry of scope) {
          pendingScope.add(entry);
        }
        const replayGapLastEventId = readNumber(
          params.replayGapLastEventId ?? params.replay_gap_last_event_id
        );
        const replayGapOldestEventId = readNumber(
          params.replayGapOldestEventId ?? params.replay_gap_oldest_event_id
        );
        const streamLaggedDroppedEvents = readNumber(
          params.streamLaggedDroppedEvents ?? params.stream_lagged_dropped_events
        );
        if (replayGapLastEventId !== null) {
          pendingReplayGapLastEventId = replayGapLastEventId;
        }
        if (replayGapOldestEventId !== null) {
          pendingReplayGapOldestEventId = replayGapOldestEventId;
        }
        if (streamLaggedDroppedEvents !== null) {
          pendingStreamLaggedDroppedEvents = streamLaggedDroppedEvents;
        }
        if (pendingScope.size === 0) {
          return;
        }
        if (!pendingReason || reasonPriority(reason) >= reasonPriority(pendingReason)) {
          pendingReason = reason;
        }
        flush();
      }
    );

    const unlistenState = subscribeRuntimeEventStateChannel(
      "app-server-events",
      ({ previous, current }) => {
        if (current.status !== "open") {
          return;
        }
        if (
          previous?.status !== "fallback" &&
          previous?.status !== "reconnecting" &&
          previous?.status !== "error"
        ) {
          return;
        }
        pendingReason = "stream_reconnected";
        pendingScope.add("bootstrap");
        pendingScope.add("workspaces");
        pendingScope.add("threads");
        pendingScope.add("oauth");
        flush();
      }
    );

    return () => {
      unlisten();
      unlistenState();
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [options.activeWorkspace?.id]);
}
