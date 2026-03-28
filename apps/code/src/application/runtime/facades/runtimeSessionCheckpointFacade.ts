import type {
  RuntimeToolLifecycleEvent,
  RuntimeToolLifecycleHookCheckpoint,
  RuntimeToolLifecycleSnapshot,
} from "../types/runtimeToolLifecycle";
import {
  RUNTIME_SESSION_CHECKPOINT_BASELINE_SCHEMA_VERSION,
  RUNTIME_SESSION_CHECKPOINT_PROJECTION_SOURCE,
  type RuntimeSessionCheckpointActivity,
  type RuntimeSessionCheckpointBaseline,
  type RuntimeSessionCheckpointPayload,
  type RuntimeSessionCheckpointSession,
  type RuntimeSessionHookCheckpointRecord,
  type RuntimeSessionLifecycleEventRecord,
  type RuntimeSessionTimelineRecord,
} from "../types/runtimeSessionCheckpoint";

function buildRuntimeSessionKey(activity: RuntimeSessionCheckpointActivity): string {
  if (activity.threadId) {
    return `thread:${activity.threadId}`;
  }
  if (activity.turnId) {
    return `turn:${activity.turnId}`;
  }
  if (activity.toolCallId) {
    return `tool_call:${activity.toolCallId}`;
  }
  return `workspace:${activity.workspaceId ?? "global"}`;
}

function buildRuntimeSessionBranchKey(activity: RuntimeSessionCheckpointActivity): string | null {
  if (activity.threadId && activity.turnId) {
    return `thread:${activity.threadId}/turn:${activity.turnId}`;
  }
  if (activity.turnId && activity.toolCallId) {
    return `turn:${activity.turnId}/tool_call:${activity.toolCallId}`;
  }
  if (activity.toolCallId) {
    return `tool_call:${activity.toolCallId}`;
  }
  return null;
}

function dedupeLifecycleEvents(
  lastEvent: RuntimeToolLifecycleEvent | null,
  recentEvents: RuntimeToolLifecycleEvent[]
): RuntimeToolLifecycleEvent[] {
  const eventMap = new Map<string, RuntimeToolLifecycleEvent>();
  for (const event of recentEvents) {
    eventMap.set(event.id, event);
  }
  if (lastEvent) {
    eventMap.set(lastEvent.id, lastEvent);
  }
  return Array.from(eventMap.values());
}

function dedupeHookCheckpoints(
  lastHookCheckpoint: RuntimeToolLifecycleHookCheckpoint | null,
  recentHookCheckpoints: RuntimeToolLifecycleHookCheckpoint[]
): RuntimeToolLifecycleHookCheckpoint[] {
  const checkpointMap = new Map<string, RuntimeToolLifecycleHookCheckpoint>();
  for (const checkpoint of recentHookCheckpoints) {
    checkpointMap.set(checkpoint.key, checkpoint);
  }
  if (lastHookCheckpoint) {
    checkpointMap.set(lastHookCheckpoint.key, lastHookCheckpoint);
  }
  return Array.from(checkpointMap.values());
}

function compareSessionTimelineRecord(
  left: RuntimeSessionTimelineRecord,
  right: RuntimeSessionTimelineRecord
): number {
  if (left.at !== right.at) {
    return left.at - right.at;
  }
  if (left.recordKind !== right.recordKind) {
    return left.recordKind === "lifecycle_event" ? -1 : 1;
  }
  return left.recordId.localeCompare(right.recordId);
}

function createLifecycleEventRecord(
  event: RuntimeToolLifecycleEvent
): RuntimeSessionLifecycleEventRecord {
  return {
    recordKind: "lifecycle_event",
    recordId: `event:${event.id}`,
    lifecycleEventId: event.id,
    lifecycleKind: event.kind,
    lifecyclePhase: event.phase,
    source: event.source,
    status: event.status ?? null,
    at: event.at,
    correlationKey: event.correlationKey ?? null,
    toolName: event.toolName ?? null,
    scope: event.scope ?? null,
    errorCode: event.errorCode ?? null,
  };
}

function createHookCheckpointRecord(
  checkpoint: RuntimeToolLifecycleHookCheckpoint
): RuntimeSessionHookCheckpointRecord {
  return {
    recordKind: "hook_checkpoint",
    recordId: `checkpoint:${checkpoint.key}`,
    hookCheckpointKey: checkpoint.key,
    hookPoint: checkpoint.point,
    source: checkpoint.source,
    status: checkpoint.status,
    at: checkpoint.at,
    lifecycleEventId: checkpoint.lifecycleEventId ?? null,
    toolName: checkpoint.toolName ?? null,
    scope: checkpoint.scope ?? null,
    reason: checkpoint.reason ?? null,
  };
}

function createCheckpointPayload(
  checkpoint: RuntimeToolLifecycleHookCheckpoint
): RuntimeSessionCheckpointPayload {
  return {
    checkpointKey: checkpoint.key,
    hookPoint: checkpoint.point,
    status: checkpoint.status,
    lifecycleEventId: checkpoint.lifecycleEventId ?? null,
    source: checkpoint.source,
    at: checkpoint.at,
    toolName: checkpoint.toolName ?? null,
    scope: checkpoint.scope ?? null,
    reason: checkpoint.reason ?? null,
  };
}

function getLatestRecordId(
  records: RuntimeSessionTimelineRecord[],
  recordKind: RuntimeSessionTimelineRecord["recordKind"]
): string | null {
  const matchingRecord = records.filter((record) => record.recordKind === recordKind).at(-1);
  if (!matchingRecord) {
    return null;
  }
  return matchingRecord.recordKind === "lifecycle_event"
    ? matchingRecord.lifecycleEventId
    : matchingRecord.hookCheckpointKey;
}

function createEmptySession(
  activity: RuntimeSessionCheckpointActivity
): RuntimeSessionCheckpointSession {
  return {
    sessionKey: buildRuntimeSessionKey(activity),
    branchKey: buildRuntimeSessionBranchKey(activity),
    workspaceId: activity.workspaceId ?? null,
    threadId: activity.threadId ?? null,
    turnId: activity.turnId ?? null,
    toolCallId: activity.toolCallId ?? null,
    latestActivityAt: null,
    replay: {
      ordering: "chronological",
      compaction: "latest_record_per_identity",
      lastLifecycleEventId: null,
      lastHookCheckpointKey: null,
    },
    records: [],
    checkpoints: [],
  };
}

function upsertSession(
  sessionMap: Map<string, RuntimeSessionCheckpointSession>,
  activity: RuntimeSessionCheckpointActivity
): RuntimeSessionCheckpointSession {
  const sessionKey = buildRuntimeSessionKey(activity);
  const existing = sessionMap.get(sessionKey);
  if (existing) {
    return existing;
  }
  const session = createEmptySession(activity);
  sessionMap.set(sessionKey, session);
  return session;
}

export function buildRuntimeSessionCheckpointBaseline(input: {
  workspaceId: string | null;
  lifecycleSnapshot: RuntimeToolLifecycleSnapshot;
}): RuntimeSessionCheckpointBaseline {
  const events = dedupeLifecycleEvents(
    input.lifecycleSnapshot.lastEvent,
    input.lifecycleSnapshot.recentEvents
  );
  const checkpoints = dedupeHookCheckpoints(
    input.lifecycleSnapshot.lastHookCheckpoint ?? null,
    input.lifecycleSnapshot.recentHookCheckpoints ?? []
  );
  const sessionMap = new Map<string, RuntimeSessionCheckpointSession>();

  for (const event of events) {
    const session = upsertSession(sessionMap, event);
    session.records.push(createLifecycleEventRecord(event));
    session.latestActivityAt =
      session.latestActivityAt === null ? event.at : Math.max(session.latestActivityAt, event.at);
  }

  for (const checkpoint of checkpoints) {
    const session = upsertSession(sessionMap, checkpoint);
    session.records.push(createHookCheckpointRecord(checkpoint));
    session.checkpoints.push(createCheckpointPayload(checkpoint));
    session.latestActivityAt =
      session.latestActivityAt === null
        ? checkpoint.at
        : Math.max(session.latestActivityAt, checkpoint.at);
  }

  const sessions = Array.from(sessionMap.values())
    .map((session) => {
      const records = session.records.slice().sort(compareSessionTimelineRecord);
      const sortedCheckpoints = session.checkpoints
        .slice()
        .sort((left, right) =>
          left.at !== right.at
            ? left.at - right.at
            : left.checkpointKey.localeCompare(right.checkpointKey)
        );
      return {
        ...session,
        records,
        checkpoints: sortedCheckpoints,
        replay: {
          ordering: "chronological" as const,
          compaction: "latest_record_per_identity" as const,
          lastLifecycleEventId: getLatestRecordId(records, "lifecycle_event"),
          lastHookCheckpointKey: getLatestRecordId(records, "hook_checkpoint"),
        },
      };
    })
    .sort((left, right) => {
      if ((right.latestActivityAt ?? -1) !== (left.latestActivityAt ?? -1)) {
        return (right.latestActivityAt ?? -1) - (left.latestActivityAt ?? -1);
      }
      return left.sessionKey.localeCompare(right.sessionKey);
    });

  return {
    schemaVersion: RUNTIME_SESSION_CHECKPOINT_BASELINE_SCHEMA_VERSION,
    workspaceId: input.workspaceId,
    lifecycleRevision: input.lifecycleSnapshot.revision,
    projectionSource: RUNTIME_SESSION_CHECKPOINT_PROJECTION_SOURCE,
    sessions,
  };
}
