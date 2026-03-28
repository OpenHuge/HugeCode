import type {
  RuntimeToolLifecycleEvent,
  RuntimeToolLifecycleHookCheckpoint,
  RuntimeToolLifecycleHookCheckpointStatus,
  RuntimeToolLifecycleHookPoint,
  RuntimeToolLifecycleSnapshot,
  RuntimeToolLifecycleSource,
  RuntimeToolLifecycleStatus,
} from "./runtimeToolLifecycle";

export const RUNTIME_SESSION_CHECKPOINT_BASELINE_SCHEMA_VERSION =
  "runtime-session-checkpoint-baseline/v1";

export type RuntimeSessionCheckpointReplayOrdering = "chronological";
export type RuntimeSessionCheckpointCompactionStrategy = "latest_record_per_identity";

export type RuntimeSessionIdentity = {
  sessionKey: string;
  branchKey: string | null;
  workspaceId: string | null;
  threadId: string | null;
  turnId: string | null;
  toolCallId: string | null;
};

export type RuntimeSessionLifecycleEventRecord = {
  recordKind: "lifecycle_event";
  recordId: string;
  lifecycleEventId: string;
  lifecycleKind: RuntimeToolLifecycleEvent["kind"];
  lifecyclePhase: RuntimeToolLifecycleEvent["phase"];
  source: RuntimeToolLifecycleSource;
  status: RuntimeToolLifecycleStatus | null;
  at: number;
  correlationKey: string | null;
  toolName: string | null;
  scope: RuntimeToolLifecycleEvent["scope"];
  errorCode: string | null;
};

export type RuntimeSessionHookCheckpointRecord = {
  recordKind: "hook_checkpoint";
  recordId: string;
  hookCheckpointKey: string;
  hookPoint: RuntimeToolLifecycleHookPoint;
  source: RuntimeToolLifecycleSource;
  status: RuntimeToolLifecycleHookCheckpointStatus;
  at: number;
  lifecycleEventId: string | null;
  toolName: string | null;
  scope: string | null;
  reason: string | null;
};

export type RuntimeSessionTimelineRecord =
  | RuntimeSessionLifecycleEventRecord
  | RuntimeSessionHookCheckpointRecord;

export type RuntimeSessionCheckpointPayload = {
  checkpointKey: string;
  hookPoint: RuntimeToolLifecycleHookPoint;
  status: RuntimeToolLifecycleHookCheckpointStatus;
  lifecycleEventId: string | null;
  source: RuntimeToolLifecycleSource;
  at: number;
  toolName: string | null;
  scope: RuntimeToolLifecycleHookCheckpoint["scope"];
  reason: string | null;
};

export type RuntimeSessionReplayMetadata = {
  ordering: RuntimeSessionCheckpointReplayOrdering;
  compaction: RuntimeSessionCheckpointCompactionStrategy;
  lastLifecycleEventId: string | null;
  lastHookCheckpointKey: string | null;
};

export type RuntimeSessionCheckpointSession = RuntimeSessionIdentity & {
  latestActivityAt: number | null;
  replay: RuntimeSessionReplayMetadata;
  records: RuntimeSessionTimelineRecord[];
  checkpoints: RuntimeSessionCheckpointPayload[];
};

export type RuntimeSessionCheckpointBaseline = {
  schemaVersion: typeof RUNTIME_SESSION_CHECKPOINT_BASELINE_SCHEMA_VERSION;
  workspaceId: string | null;
  lifecycleRevision: RuntimeToolLifecycleSnapshot["revision"];
  projectionSource: "runtime_tool_lifecycle";
  sessions: RuntimeSessionCheckpointSession[];
};

export type RuntimeSessionCheckpointActivity =
  | RuntimeToolLifecycleEvent
  | RuntimeToolLifecycleHookCheckpoint;
