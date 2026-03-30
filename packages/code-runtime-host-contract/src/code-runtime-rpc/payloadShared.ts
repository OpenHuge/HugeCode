import type {
  AccessMode,
  AgentTaskAutoDriveState,
  ReasonEffort,
  RuntimeTextFileKind,
  RuntimeTextFileScope,
  TurnExecutionMode,
  TurnInterruptRequest,
  TurnSendRequest,
} from "../codeRuntimeRpc.js";
import type { HugeCodeTaskMode } from "../hugeCodeMissionControl.js";

export type RuntimeAppSettingsRecord = Record<string, unknown>;

export type RuntimeAppSettingsUpdateRequest = {
  payload: RuntimeAppSettingsRecord;
};

export type RuntimeTextFileReadRequest = {
  scope: RuntimeTextFileScope;
  kind: RuntimeTextFileKind;
  workspaceId?: string | null;
  workspace_id?: string | null;
};

export type RuntimeTextFileWriteRequest = RuntimeTextFileReadRequest & {
  content: string;
};

export type TurnSendRequestCompat = TurnSendRequest & {
  workspace_id?: string;
  thread_id?: string | null;
  request_id?: string;
  mission_mode?: HugeCodeTaskMode | null;
  execution_profile_id?: string | null;
  preferred_backend_ids?: string[] | null;
  contextPrefix?: string | null;
  context_prefix?: string | null;
  model_id?: string | null;
  reason_effort?: ReasonEffort | null;
  access_mode?: AccessMode;
  execution_mode?: TurnExecutionMode;
  codex_bin?: string | null;
  codex_args?: string[] | null;
  auto_drive?: AgentTaskAutoDriveState | null;
};

export type TurnInterruptRequestCompat = TurnInterruptRequest & {
  turn_id?: string | null;
};

export type ThreadLiveSubscribeRequest = {
  workspaceId: string;
  threadId: string;
  workspace_id?: string;
  thread_id?: string;
};

export type ThreadLiveSubscribeResult = {
  subscriptionId: string;
  heartbeatIntervalMs: number;
  transportMode: "push";
  contextRevision: number;
};

export type ThreadLiveUnsubscribeRequest = {
  subscriptionId: string;
  subscription_id?: string;
};

export type ThreadLiveUnsubscribeResult = {
  ok: true;
};
