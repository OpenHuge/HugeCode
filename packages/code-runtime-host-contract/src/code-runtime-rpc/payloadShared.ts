import type { TurnInterruptRequest, TurnSendRequest } from "./agentExecution.js";
import type { RuntimeTextFileKind, RuntimeTextFileScope } from "./workspaceAndGit.js";

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

export type TurnSendRequestCompat = TurnSendRequest;

export type TurnInterruptRequestCompat = TurnInterruptRequest;

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
