import {
  type GitCommitResult,
  type GitDiffContent,
  type GitLogResponse,
  type GitOperationResult,
  type PromptLibraryEntry,
  type PromptLibraryScope,
  type RuntimeCompositionProfileGetV2Request,
  type RuntimeCompositionProfileListV2Request,
  type RuntimeCompositionProfileResolveV2Request,
  type RuntimeCompositionSnapshotPublishRequest,
  type RuntimeRunGetV2Request,
  type RuntimeRunPrepareV2Request,
  type RuntimeRunStartRequest,
  type RuntimeRunsListRequest,
  type RuntimeRunInterventionRequest,
  type RuntimeRunCancelRequest,
  type RuntimeRunResumeRequest,
  type RuntimeReviewGetV2Request,
  type ThreadCreateRequest,
  type ThreadSummary,
  type TurnInterruptRequest,
  type TurnSendRequest,
  CODE_RUNTIME_RPC_EMPTY_PARAMS,
  CODE_RUNTIME_RPC_METHODS,
} from "@ku0/code-runtime-host-contract";
import {
  normalizeLiveSkillExecuteRequest,
  validateLiveSkillExecuteRequest,
} from "./runtimeClientLiveSkills";
import { type RuntimeRpcInvoker, invokeRuntimeExtensionRpc } from "./runtimeClientRpcHelpers";
import { adaptRuntimeRpcPayload, withCanonicalFields } from "./runtimeClientRpcPayloads";
import { OPTIONAL_RUNTIME_RPC_METHODS, THREAD_LIVE_RPC_METHODS } from "./runtimeClientRpcMethods";
import type { RuntimeClient } from "./runtimeClientTypes";

export function createBaseRpcRuntimeClient<
  TAppSettings extends Record<string, unknown> = Record<string, unknown>,
>(invokeRpc: RuntimeRpcInvoker) {
  const client = {
    health() {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.HEALTH, CODE_RUNTIME_RPC_EMPTY_PARAMS);
    },
    workspaces() {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.WORKSPACES_LIST, CODE_RUNTIME_RPC_EMPTY_PARAMS);
    },
    missionControlSnapshotV1() {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.MISSION_CONTROL_SNAPSHOT_V1,
        CODE_RUNTIME_RPC_EMPTY_PARAMS
      );
    },
    workspacePickDirectory() {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        OPTIONAL_RUNTIME_RPC_METHODS.WORKSPACE_PICK_DIRECTORY,
        CODE_RUNTIME_RPC_EMPTY_PARAMS
      );
    },
    workspaceCreate(path: string, displayName: string | null) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.WORKSPACE_CREATE, {
        path,
        ...withCanonicalFields({ displayName }),
      });
    },
    workspaceRename(workspaceId: string, displayName: string) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.WORKSPACE_RENAME, {
        ...withCanonicalFields({ workspaceId, displayName }),
      });
    },
    workspaceRemove(workspaceId: string) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.WORKSPACE_REMOVE,
        withCanonicalFields({ workspaceId })
      );
    },
    workspaceFiles(workspaceId: string) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.WORKSPACE_FILES_LIST,
        withCanonicalFields({ workspaceId })
      );
    },
    workspaceFileRead(workspaceId: string, fileId: string) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.WORKSPACE_FILE_READ, {
        ...withCanonicalFields({ workspaceId, fileId }),
      });
    },
    gitChanges(workspaceId: string) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.GIT_CHANGES_LIST,
        withCanonicalFields({ workspaceId })
      );
    },
    gitLog(workspaceId: string, limit?: number) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.GIT_LOG, {
        limit,
        ...withCanonicalFields({ workspaceId }),
      });
    },
    gitDiffRead(
      workspaceId: string,
      changeId: string,
      options?: { offset?: number; maxBytes?: number }
    ) {
      const offset = options?.offset;
      const maxBytes = options?.maxBytes;
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.GIT_DIFF_READ, {
        ...withCanonicalFields({ workspaceId, changeId, maxBytes }),
        offset,
      });
    },
    gitBranches(workspaceId: string) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.GIT_BRANCHES_LIST,
        withCanonicalFields({ workspaceId })
      );
    },
    gitBranchCreate(workspaceId: string, branchName: string) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.GIT_BRANCH_CREATE, {
        ...withCanonicalFields({ workspaceId, branchName }),
      });
    },
    gitBranchCheckout(workspaceId: string, branchName: string) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.GIT_BRANCH_CHECKOUT, {
        ...withCanonicalFields({ workspaceId, branchName }),
      });
    },
    gitStageChange(workspaceId: string, changeId: string) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.GIT_STAGE_CHANGE, {
        ...withCanonicalFields({ workspaceId, changeId }),
      });
    },
    gitStageAll(workspaceId: string) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.GIT_STAGE_ALL,
        withCanonicalFields({ workspaceId })
      );
    },
    gitUnstageChange(workspaceId: string, changeId: string) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.GIT_UNSTAGE_CHANGE, {
        ...withCanonicalFields({ workspaceId, changeId }),
      });
    },
    gitRevertChange(workspaceId: string, changeId: string) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.GIT_REVERT_CHANGE, {
        ...withCanonicalFields({ workspaceId, changeId }),
      });
    },
    gitCommit(workspaceId: string, message: string) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.GIT_COMMIT, {
        ...withCanonicalFields({ workspaceId }),
        message,
      });
    },
    promptLibrary(workspaceId: string | null) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.PROMPT_LIBRARY_LIST, {
        ...withCanonicalFields({ workspaceId }),
      });
    },
    promptLibraryCreate(input: {
      workspaceId: string | null;
      scope: PromptLibraryScope;
      title: string;
      description: string;
      content: string;
    }) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.PROMPT_LIBRARY_CREATE, {
        ...withCanonicalFields({ workspaceId: input.workspaceId }),
        scope: input.scope,
        title: input.title,
        description: input.description,
        content: input.content,
      });
    },
    promptLibraryUpdate(input: {
      workspaceId: string | null;
      promptId: string;
      title: string;
      description: string;
      content: string;
    }) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.PROMPT_LIBRARY_UPDATE, {
        ...withCanonicalFields({ workspaceId: input.workspaceId, promptId: input.promptId }),
        title: input.title,
        description: input.description,
        content: input.content,
      });
    },
    promptLibraryDelete(input: { workspaceId: string | null; promptId: string }) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.PROMPT_LIBRARY_DELETE, {
        ...withCanonicalFields({ workspaceId: input.workspaceId, promptId: input.promptId }),
      });
    },
    promptLibraryMove(input: {
      workspaceId: string | null;
      promptId: string;
      targetScope: PromptLibraryScope;
    }) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.PROMPT_LIBRARY_MOVE, {
        ...withCanonicalFields({
          workspaceId: input.workspaceId,
          promptId: input.promptId,
          targetScope: input.targetScope,
        }),
      });
    },
    threads(workspaceId: string) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.THREADS_LIST, withCanonicalFields({ workspaceId }));
    },
    createThread(payload: ThreadCreateRequest) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.THREAD_CREATE, {
        ...withCanonicalFields({ workspaceId: payload.workspaceId }),
        title: payload.title,
      });
    },
    resumeThread(workspaceId: string, threadId: string) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.THREAD_RESUME, {
        ...withCanonicalFields({ workspaceId, threadId }),
      });
    },
    archiveThread(workspaceId: string, threadId: string) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.THREAD_ARCHIVE, {
        ...withCanonicalFields({ workspaceId, threadId }),
      });
    },
    threadLiveSubscribe(workspaceId: string, threadId: string) {
      return invokeRuntimeExtensionRpc(invokeRpc, THREAD_LIVE_RPC_METHODS.THREAD_LIVE_SUBSCRIBE, {
        ...withCanonicalFields({ workspaceId, threadId }),
      });
    },
    threadLiveUnsubscribe(subscriptionId: string) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        THREAD_LIVE_RPC_METHODS.THREAD_LIVE_UNSUBSCRIBE,
        withCanonicalFields({ subscriptionId })
      );
    },
    sendTurn(payload: TurnSendRequest) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.TURN_SEND, {
        payload: adaptRuntimeRpcPayload("turnSend", payload),
      });
    },
    interruptTurn(payload: TurnInterruptRequest) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.TURN_INTERRUPT, {
        payload: adaptRuntimeRpcPayload("turnInterrupt", payload),
      });
    },
    runtimeRunPrepareV2(request: RuntimeRunPrepareV2Request) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.RUN_PREPARE_V2,
        adaptRuntimeRpcPayload("runtimeRunPrepareV2", request)
      );
    },
    runtimeRunStartV2(request: RuntimeRunStartRequest) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.RUN_START_V2,
        adaptRuntimeRpcPayload("runtimeRunStartV2", request)
      );
    },
    runtimeRunGetV2(request: RuntimeRunGetV2Request) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.RUN_GET_V2,
        adaptRuntimeRpcPayload("runtimeRunGetV2", request)
      );
    },
    runtimeRunInterveneV2(request: RuntimeRunInterventionRequest) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.RUN_INTERVENE_V2,
        adaptRuntimeRpcPayload("runtimeRunInterveneV2", request)
      );
    },
    runtimeRunCancelV2(request: RuntimeRunCancelRequest) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.RUN_CANCEL_V2,
        adaptRuntimeRpcPayload("runtimeRunCancelV2", request)
      );
    },
    runtimeRunResumeV2(request: RuntimeRunResumeRequest) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.RUN_RESUME_V2,
        adaptRuntimeRpcPayload("runtimeRunResumeV2", request)
      );
    },
    runtimeRunSubscribeV2(request: RuntimeRunGetV2Request) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.RUN_SUBSCRIBE_V2,
        adaptRuntimeRpcPayload("runtimeRunSubscribeV2", request)
      );
    },
    runtimeReviewGetV2(request: RuntimeReviewGetV2Request) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.REVIEW_GET_V2,
        adaptRuntimeRpcPayload("runtimeReviewGetV2", request)
      );
    },
    runtimeRunsList(request: RuntimeRunsListRequest) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.RUNS_LIST,
        adaptRuntimeRpcPayload("runtimeRunsList", request)
      );
    },
    runtimeCompositionProfileListV2(request: RuntimeCompositionProfileListV2Request) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.COMPOSITION_PROFILE_LIST_V2, {
        ...withCanonicalFields({ workspaceId: request.workspaceId }),
      });
    },
    runtimeCompositionProfileGetV2(request: RuntimeCompositionProfileGetV2Request) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.COMPOSITION_PROFILE_GET_V2, {
        ...withCanonicalFields({
          workspaceId: request.workspaceId,
          profileId: request.profileId,
        }),
      });
    },
    runtimeCompositionProfileResolveV2(request: RuntimeCompositionProfileResolveV2Request) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.COMPOSITION_PROFILE_RESOLVE_V2, {
        ...withCanonicalFields({
          workspaceId: request.workspaceId,
          profileId: request.profileId ?? null,
        }),
        launchOverride: request.launchOverride ?? null,
      });
    },
    runtimeCompositionSnapshotPublishV1(request: RuntimeCompositionSnapshotPublishRequest) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.COMPOSITION_SNAPSHOT_PUBLISH_V1, {
        ...withCanonicalFields({
          workspaceId: request.workspaceId,
        }),
        profiles: request.profiles,
        snapshot: request.snapshot,
        authorityRevision: request.authorityRevision,
        authority_revision: request.authorityRevision,
        publishedAt: request.publishedAt ?? null,
        published_at: request.publishedAt ?? null,
        publisherSessionId: request.publisherSessionId ?? null,
        publisher_session_id: request.publisherSessionId ?? null,
      });
    },
    runLiveSkill(request) {
      try {
        validateLiveSkillExecuteRequest(request);
      } catch (error) {
        return Promise.reject(error);
      }
      const normalizedRequest = normalizeLiveSkillExecuteRequest(request);
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.LIVE_SKILL_EXECUTE, {
        ...normalizedRequest,
        ...withCanonicalFields({ skillId: normalizedRequest.skillId }),
      });
    },
  } satisfies Pick<
    RuntimeClient<TAppSettings>,
    | "health"
    | "workspaces"
    | "missionControlSnapshotV1"
    | "workspacePickDirectory"
    | "workspaceCreate"
    | "workspaceRename"
    | "workspaceRemove"
    | "workspaceFiles"
    | "workspaceFileRead"
    | "gitChanges"
    | "gitLog"
    | "gitDiffRead"
    | "gitBranches"
    | "gitBranchCreate"
    | "gitBranchCheckout"
    | "gitStageChange"
    | "gitStageAll"
    | "gitUnstageChange"
    | "gitRevertChange"
    | "gitCommit"
    | "promptLibrary"
    | "promptLibraryCreate"
    | "promptLibraryUpdate"
    | "promptLibraryDelete"
    | "promptLibraryMove"
    | "threads"
    | "createThread"
    | "resumeThread"
    | "archiveThread"
    | "threadLiveSubscribe"
    | "threadLiveUnsubscribe"
    | "sendTurn"
    | "interruptTurn"
    | "runtimeRunPrepareV2"
    | "runtimeRunStartV2"
    | "runtimeRunGetV2"
    | "runtimeRunInterveneV2"
    | "runtimeRunCancelV2"
    | "runtimeRunResumeV2"
    | "runtimeRunSubscribeV2"
    | "runtimeReviewGetV2"
    | "runtimeRunsList"
    | "runtimeCompositionProfileListV2"
    | "runtimeCompositionProfileGetV2"
    | "runtimeCompositionProfileResolveV2"
    | "runtimeCompositionSnapshotPublishV1"
    | "runLiveSkill"
  >;

  return client;
}

export type {
  GitCommitResult,
  GitDiffContent,
  GitLogResponse,
  GitOperationResult,
  PromptLibraryEntry,
  ThreadSummary,
};
