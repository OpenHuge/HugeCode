import type { AccessMode, AppMention, ComposerExecutionMode } from "../types";
import type { HugeCodeTaskMode } from "@ku0/code-runtime-host-contract";
import { registerRuntimeTurnContextByTurnId, registerRuntimeTurnRequestContext } from "./events";
import { getRuntimeClient } from "./runtimeClient";
import {
  buildRuntimeTurnRequestId,
  normalizeRuntimeReasonEffort,
  type RuntimeAccessMode,
  type RuntimeTurnAck,
  toRuntimeAccessMode,
  toRuntimeTurnAttachments,
} from "./tauriRuntimeTurnHelpers";

type RuntimeTurnOptions = {
  model?: string | null;
  effort?: string | null;
  serviceTier?: string | null;
  accessMode?: AccessMode;
  executionMode?: ComposerExecutionMode;
  missionMode?: HugeCodeTaskMode | null;
  executionProfileId?: string | null;
  preferredBackendIds?: string[] | null;
  codexBin?: string | null;
  codexArgs?: string[] | null;
  collaborationMode?: Record<string, unknown> | null;
};

function mapTurnRoutingFields(ack: RuntimeTurnAck) {
  return {
    routedProvider: ack.routedProvider ?? null,
    routed_provider: ack.routedProvider ?? null,
    routedModelId: ack.routedModelId ?? null,
    routed_model_id: ack.routedModelId ?? null,
    routedPool: ack.routedPool ?? null,
    routed_pool: ack.routedPool ?? null,
    routedSource: ack.routedSource ?? null,
    routed_source: ack.routedSource ?? null,
  };
}

export async function sendUserMessage(
  workspaceId: string,
  threadId: string,
  text: string,
  options?: {
    requestId?: string | null;
    model?: string | null;
    effort?: string | null;
    serviceTier?: string | null;
    accessMode?: AccessMode;
    executionMode?: ComposerExecutionMode;
    missionMode?: HugeCodeTaskMode | null;
    executionProfileId?: string | null;
    preferredBackendIds?: string[] | null;
    codexBin?: string | null;
    codexArgs?: string[] | null;
    contextPrefix?: string | null;
    images?: string[];
    collaborationMode?: Record<string, unknown> | null;
    appMentions?: AppMention[];
  }
) {
  const requestId =
    typeof options?.requestId === "string" && options.requestId.trim().length > 0
      ? options.requestId.trim()
      : buildRuntimeTurnRequestId();
  registerRuntimeTurnRequestContext(requestId, workspaceId, threadId);
  const executionMode = options?.executionMode ?? "hybrid";
  const ack = (await getRuntimeClient().sendTurn({
    workspaceId,
    threadId,
    requestId,
    content: text,
    contextPrefix: options?.contextPrefix ?? null,
    provider: null,
    modelId: options?.model ?? null,
    reasonEffort: normalizeRuntimeReasonEffort(options?.effort ?? null),
    serviceTier: options?.serviceTier ?? null,
    missionMode: options?.missionMode ?? null,
    executionProfileId: options?.executionProfileId ?? null,
    preferredBackendIds: options?.preferredBackendIds ?? null,
    accessMode: toRuntimeAccessMode(options?.accessMode ?? null) as RuntimeAccessMode,
    executionMode,
    codexBin: options?.codexBin ?? null,
    codexArgs: options?.codexArgs ?? null,
    queue: false,
    attachments: toRuntimeTurnAttachments(options?.images ?? null),
    ...(Object.hasOwn(options ?? {}, "collaborationMode") && options?.collaborationMode != null
      ? { collaborationMode: options.collaborationMode }
      : {}),
  })) as RuntimeTurnAck;

  if (ack.turnId) {
    registerRuntimeTurnContextByTurnId(ack.turnId, workspaceId, ack.threadId ?? threadId);
  }

  if (!ack.accepted || !ack.turnId) {
    return {
      code: typeof ack.code === "string" && ack.code.trim().length > 0 ? ack.code.trim() : null,
      error: ack.message || "Turn failed to start.",
      result: {
        threadId: ack.threadId ?? threadId,
        thread_id: ack.threadId ?? threadId,
        turn: null,
      },
    };
  }

  const routing = mapTurnRoutingFields(ack);
  return {
    result: {
      accepted: ack.accepted,
      threadId: ack.threadId ?? threadId,
      thread_id: ack.threadId ?? threadId,
      ...routing,
      turn: {
        id: ack.turnId,
        threadId: ack.threadId ?? threadId,
        thread_id: ack.threadId ?? threadId,
        ...routing,
      },
    },
  };
}

export async function steerTurn(
  workspaceId: string,
  threadId: string,
  turnId: string,
  text: string,
  images?: string[],
  appMentions?: AppMention[],
  contextPrefix?: string | null,
  options?: RuntimeTurnOptions
) {
  // Steering is modeled as an explicit queued canonical turn under frozen runtime RPC.
  void turnId;
  void appMentions;
  const executionMode = options?.executionMode ?? "runtime";
  const ack = (await getRuntimeClient().sendTurn({
    workspaceId,
    threadId,
    content: text,
    contextPrefix: contextPrefix ?? null,
    provider: null,
    modelId: options?.model ?? null,
    reasonEffort: normalizeRuntimeReasonEffort(options?.effort ?? null),
    serviceTier: options?.serviceTier ?? null,
    missionMode: options?.missionMode ?? null,
    executionProfileId: options?.executionProfileId ?? null,
    preferredBackendIds: options?.preferredBackendIds ?? null,
    accessMode: toRuntimeAccessMode(options?.accessMode ?? null) as RuntimeAccessMode,
    executionMode,
    codexBin: options?.codexBin ?? null,
    codexArgs: options?.codexArgs ?? null,
    queue: true,
    attachments: toRuntimeTurnAttachments(images ?? null),
    ...(Object.hasOwn(options ?? {}, "collaborationMode") && options?.collaborationMode != null
      ? { collaborationMode: options.collaborationMode }
      : {}),
  })) as RuntimeTurnAck;

  if (!ack.accepted || !ack.turnId) {
    return {
      code: typeof ack.code === "string" && ack.code.trim().length > 0 ? ack.code.trim() : null,
      error: ack.message || "Turn steer failed.",
      result: {
        threadId: ack.threadId ?? threadId,
        thread_id: ack.threadId ?? threadId,
        turnId: ack.turnId ?? null,
        turn_id: ack.turnId ?? null,
      },
    };
  }

  const routing = mapTurnRoutingFields(ack);
  return {
    result: {
      accepted: ack.accepted,
      threadId: ack.threadId ?? threadId,
      thread_id: ack.threadId ?? threadId,
      turnId: ack.turnId,
      turn_id: ack.turnId,
      ...routing,
      turn: {
        id: ack.turnId,
        threadId: ack.threadId ?? threadId,
        thread_id: ack.threadId ?? threadId,
        ...routing,
      },
    },
  };
}
