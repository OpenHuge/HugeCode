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
};

export type StartReviewInput = {
  threadId: RuntimeThreadId;
  target: ReviewTarget;
  delivery?: "inline" | "detached";
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
  sendMessage: (input: SendMessageInput) => ReturnType<typeof sendUserMessage>;
  steerTurn: (input: SteerTurnInput) => ReturnType<typeof steerTurn>;
  interruptTurn: (input: InterruptTurnInput) => ReturnType<typeof interruptTurn>;
  startReview: (input: StartReviewInput) => ReturnType<typeof startReview>;
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
  startReview: typeof startReview;
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
  startReview,
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
    sendMessage: ({ threadId, text, options }) =>
      deps.sendUserMessage(workspaceId, threadId, text, options),
    steerTurn: ({ threadId, turnId, text, images, contextPrefix, options }) =>
      deps.steerTurn(workspaceId, threadId, turnId, text, images, contextPrefix, {
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
      }),
    interruptTurn: ({ threadId, turnId }) => deps.interruptTurn(workspaceId, threadId, turnId),
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
    canStartReviewInCurrentHost: () => false,
    reviewStartDesktopOnlyMessage: deps.reviewStartDesktopOnlyMessage,
  };
}
