import type {
  AgentTaskAutoDriveState,
  HugeCodeTaskMode,
  RuntimeAutonomyRequestV2,
} from "@ku0/code-runtime-host-contract";
import { detectRuntimeMode } from "../ports/runtimeClientMode";
import {
  compactThread,
  interruptTurn,
  listMcpServerStatus,
  REVIEW_START_DESKTOP_ONLY_MESSAGE,
  respondToServerRequest,
  respondToToolCallRequest,
  respondToUserInputRequest,
  sendUserMessage,
  startReview,
  steerTurn,
} from "../ports/tauriThreads";
import type {
  AccessMode,
  ComposerExecutionMode,
  DynamicToolCallResponse,
  ReviewTarget,
} from "../../../types";
import type {
  RuntimeRequestId,
  RuntimeThreadId,
  RuntimeTurnId,
  RuntimeWorkspaceId,
} from "../types/runtimeIds";
import { recordLegacyLifecycleUsage } from "../../../services/runtimeLegacyLifecycleTelemetry";

export type RuntimeSessionTurnOptions = {
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
  autoDrive?: AgentTaskAutoDriveState | null;
  autonomyRequest?: RuntimeAutonomyRequestV2 | null;
  telemetrySource?: string | null;
};

export type SendMessageInput = {
  threadId: RuntimeThreadId;
  text: string;
  options?: RuntimeSessionTurnOptions;
};

export type SteerTurnInput = {
  threadId: RuntimeThreadId;
  turnId: RuntimeTurnId;
  text: string;
  images?: string[];
  contextPrefix?: string | null;
  options?: Omit<RuntimeSessionTurnOptions, "requestId" | "contextPrefix" | "images">;
};

export type InterruptTurnInput = {
  threadId: RuntimeThreadId;
  turnId: RuntimeTurnId;
  telemetrySource?: string | null;
};

export type StartReviewInput = {
  threadId: RuntimeThreadId;
  target: ReviewTarget;
  delivery?: "inline" | "detached";
};

export type RuntimeSessionReviewStartResult = {
  reviewThreadId?: string | null;
  review_thread_id?: string | null;
  threadId?: string | null;
};

export type RuntimeSessionReviewStartResponse = {
  result?: RuntimeSessionReviewStartResult | null;
  reviewThreadId?: string | null;
  review_thread_id?: string | null;
  error?: unknown;
};

export type CompactThreadInput = {
  threadId: RuntimeThreadId;
};

export type ListMcpServerStatusInput = {
  cursor?: string | null;
  limit?: number | null;
};

export type RespondToApprovalInput = {
  requestId: RuntimeRequestId | number;
  decision: "accept" | "decline";
};

export type RespondToUserInputInput = {
  requestId: RuntimeRequestId | number;
  answers: Record<string, { answers: string[] }>;
};

export type RespondToToolCallInput = {
  requestId: RuntimeRequestId | number;
  response: DynamicToolCallResponse;
};

export type RuntimeSessionCommandFacade = {
  /**
   * Compatibility-only thread/turn execution surface for composer flows.
   * Product lifecycle work should prefer kernel v2 run launch and run-control
   * facades.
   */
  sendMessage: (input: SendMessageInput) => ReturnType<typeof sendUserMessage>;
  steerTurn: (input: SteerTurnInput) => ReturnType<typeof steerTurn>;
  interruptTurn: (input: InterruptTurnInput) => ReturnType<typeof interruptTurn>;
  startReview: (input: StartReviewInput) => Promise<RuntimeSessionReviewStartResponse>;
  compactThread: (input: CompactThreadInput) => ReturnType<typeof compactThread>;
  listMcpServerStatus: (input?: ListMcpServerStatusInput) => ReturnType<typeof listMcpServerStatus>;
  respondToApproval: (input: RespondToApprovalInput) => ReturnType<typeof respondToServerRequest>;
  respondToUserInput: (
    input: RespondToUserInputInput
  ) => ReturnType<typeof respondToUserInputRequest>;
  respondToToolCall: (input: RespondToToolCallInput) => ReturnType<typeof respondToToolCallRequest>;
  canStartReviewInCurrentHost: () => boolean;
  reviewStartDesktopOnlyMessage: typeof REVIEW_START_DESKTOP_ONLY_MESSAGE;
};

export type RuntimeSessionCommandDependencies = {
  sendUserMessage: typeof sendUserMessage;
  steerTurn: typeof steerTurn;
  interruptTurn: typeof interruptTurn;
  startReview: (
    workspaceId: RuntimeWorkspaceId,
    threadId: RuntimeThreadId,
    target: ReviewTarget,
    delivery?: "inline" | "detached"
  ) => Promise<RuntimeSessionReviewStartResponse>;
  compactThread: typeof compactThread;
  listMcpServerStatus: typeof listMcpServerStatus;
  respondToServerRequest: typeof respondToServerRequest;
  respondToUserInputRequest: typeof respondToUserInputRequest;
  respondToToolCallRequest: typeof respondToToolCallRequest;
  detectRuntimeMode: typeof detectRuntimeMode;
  reviewStartDesktopOnlyMessage: typeof REVIEW_START_DESKTOP_ONLY_MESSAGE;
};

const defaultRuntimeSessionCommandDependencies: RuntimeSessionCommandDependencies = {
  sendUserMessage,
  steerTurn,
  interruptTurn,
  startReview: (workspaceId, threadId, target, delivery) =>
    startReview(
      workspaceId,
      threadId,
      target,
      delivery
    ) as Promise<RuntimeSessionReviewStartResponse>,
  compactThread,
  listMcpServerStatus,
  respondToServerRequest,
  respondToUserInputRequest,
  respondToToolCallRequest,
  detectRuntimeMode,
  reviewStartDesktopOnlyMessage: REVIEW_START_DESKTOP_ONLY_MESSAGE,
};

export function createRuntimeSessionCommandFacade(
  workspaceId: RuntimeWorkspaceId,
  deps: RuntimeSessionCommandDependencies = defaultRuntimeSessionCommandDependencies
): RuntimeSessionCommandFacade {
  return {
    sendMessage: ({ threadId, text, options }) => {
      const { telemetrySource, ...runtimeOptions } = options ?? {};
      recordLegacyLifecycleUsage({
        method: "code_turn_send",
        workspaceId,
        threadId,
        source: telemetrySource ?? "runtime_session_commands",
        executionMode: runtimeOptions.executionMode ?? null,
        missionMode: runtimeOptions.missionMode ?? null,
      });
      return deps.sendUserMessage(workspaceId, threadId, text, runtimeOptions);
    },
    steerTurn: ({ threadId, turnId, text, images, contextPrefix, options }) => {
      recordLegacyLifecycleUsage({
        method: "code_turn_send",
        workspaceId,
        threadId,
        source: options?.telemetrySource ?? "runtime_session_commands",
        executionMode: options?.executionMode ?? null,
        missionMode: options?.missionMode ?? null,
      });
      return deps.steerTurn(workspaceId, threadId, turnId, text, images, contextPrefix, {
        model: options?.model,
        effort: options?.effort,
        serviceTier: options?.serviceTier,
        accessMode: options?.accessMode,
        executionMode: options?.executionMode,
        missionMode: options?.missionMode,
        executionProfileId: options?.executionProfileId,
        preferredBackendIds: options?.preferredBackendIds,
        codexBin: options?.codexBin,
        codexArgs: options?.codexArgs,
        collaborationMode: options?.collaborationMode,
        autoDrive: options?.autoDrive,
        autonomyRequest: options?.autonomyRequest,
      });
    },
    interruptTurn: ({ threadId, turnId, telemetrySource }) => {
      recordLegacyLifecycleUsage({
        method: "code_turn_interrupt",
        workspaceId,
        threadId,
        source: telemetrySource ?? "runtime_session_commands",
      });
      return deps.interruptTurn(workspaceId, threadId, turnId);
    },
    startReview: ({ threadId, target, delivery }) =>
      deps.startReview(workspaceId, threadId, target, delivery),
    compactThread: ({ threadId }) => deps.compactThread(workspaceId, threadId),
    listMcpServerStatus: (input) =>
      deps.listMcpServerStatus(workspaceId, input?.cursor ?? null, input?.limit ?? null),
    respondToApproval: ({ requestId, decision }) =>
      deps.respondToServerRequest(workspaceId, requestId, decision),
    respondToUserInput: ({ requestId, answers }) =>
      deps.respondToUserInputRequest(workspaceId, requestId, answers),
    respondToToolCall: ({ requestId, response }) =>
      deps.respondToToolCallRequest(workspaceId, requestId, response),
    canStartReviewInCurrentHost: () => deps.detectRuntimeMode() === "tauri",
    reviewStartDesktopOnlyMessage: deps.reviewStartDesktopOnlyMessage,
  };
}
