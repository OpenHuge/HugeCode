import type {
  RuntimeSessionCheckpointBaseline,
  RuntimeSessionCheckpointSession,
  RuntimeSessionTimelineRecord,
} from "../types/runtimeSessionCheckpoint";

export type RuntimeSessionCheckpointPresentationSummary = {
  hasSessions: boolean;
  latestHookCheckpointKey: string | null;
  latestLifecycleEventId: string | null;
  latestSession: RuntimeSessionCheckpointSession | null;
  latestSessionLabel: string | null;
  totalCheckpointPayloads: number;
  totalRecords: number;
  totalSessions: number;
};

function compareSessionActivityByRecency(
  left: RuntimeSessionCheckpointSession,
  right: RuntimeSessionCheckpointSession
): number {
  if ((right.latestActivityAt ?? -1) !== (left.latestActivityAt ?? -1)) {
    return (right.latestActivityAt ?? -1) - (left.latestActivityAt ?? -1);
  }
  return left.sessionKey.localeCompare(right.sessionKey);
}

export function sortRuntimeSessionCheckpointSessionsByRecency(
  sessions: RuntimeSessionCheckpointSession[]
): RuntimeSessionCheckpointSession[] {
  return sessions.slice().sort(compareSessionActivityByRecency);
}

export function formatRuntimeSessionCheckpointSessionLabel(
  session: RuntimeSessionCheckpointSession
): string {
  return session.branchKey ?? session.sessionKey;
}

export function formatRuntimeSessionCheckpointRecordKey(
  record: RuntimeSessionTimelineRecord
): string {
  return record.recordKind === "lifecycle_event"
    ? `${record.lifecycleKind}/${record.lifecyclePhase}`
    : `${record.hookPoint}/${record.status}`;
}

export function buildRuntimeSessionCheckpointPresentationSummary(
  baseline: RuntimeSessionCheckpointBaseline
): RuntimeSessionCheckpointPresentationSummary {
  const sessions = sortRuntimeSessionCheckpointSessionsByRecency(baseline.sessions);
  const latestSession = sessions[0] ?? null;

  return {
    hasSessions: sessions.length > 0,
    latestHookCheckpointKey: latestSession?.replay.lastHookCheckpointKey ?? null,
    latestLifecycleEventId: latestSession?.replay.lastLifecycleEventId ?? null,
    latestSession,
    latestSessionLabel: latestSession
      ? formatRuntimeSessionCheckpointSessionLabel(latestSession)
      : null,
    totalCheckpointPayloads: sessions.reduce(
      (count, session) => count + session.checkpoints.length,
      0
    ),
    totalRecords: sessions.reduce((count, session) => count + session.records.length, 0),
    totalSessions: sessions.length,
  };
}
