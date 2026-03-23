import {
  type AcpIntegrationProbeRequest,
  type AcpIntegrationSetStateRequest,
  type AcpIntegrationUpsertInput,
  type ActionRequiredSubmitRequest,
  CODE_RUNTIME_RPC_EMPTY_PARAMS,
  CODE_RUNTIME_RPC_METHODS,
  type KernelExtensionsListRequest,
  type KernelJobCallbackRegistrationV3,
  type KernelJobCallbackRemoveRequestV3,
  type KernelJobGetRequestV3,
  type KernelJobInterventionRequestV3,
  type KernelJobsListRequest,
  type KernelJobResumeRequestV3,
  type KernelJobStartRequestV3,
  type KernelJobSubscribeRequestV3,
  type KernelPoliciesEvaluateRequest,
  type KernelProjectionBootstrapRequest,
  type KernelSessionsListRequest,
  type LiveSkillExecuteRequest,
  type OAuthAccountUpsertInput,
  type OAuthChatgptAuthTokensRefreshRequest,
  type OAuthCodexLoginCancelRequest,
  type OAuthCodexLoginStartRequest,
  type OAuthPoolApplyInput,
  type OAuthPoolMemberInput,
  type OAuthPoolSelectionRequest,
  type OAuthPoolUpsertInput,
  type OAuthProviderId,
  type OAuthRateLimitReportInput,
  type OAuthUsageRefreshMode,
  type RuntimeBrowserDebugRunRequest,
  type RuntimeBrowserDebugStatusRequest,
  type RuntimeRunCancelRequest,
  type RuntimeRunCheckpointApprovalRequest,
  type RuntimeRunGetV2Request,
  type RuntimeRunInterventionRequest,
  type RuntimeRunPrepareV2Request,
  type RuntimeRunsListRequest,
  type RuntimeRunResumeRequest,
  type RuntimeRunStartRequest,
  type RuntimeRunSubscribeRequest,
  type RuntimeReviewGetV2Request,
  type RuntimeBackendSetStateRequest,
  type RuntimeBackendUpsertInput,
  type RuntimeCodexCloudTasksListRequest,
  type RuntimeCodexDoctorRequest,
  type RuntimeCodexExecRunRequest,
  type RuntimeCodexUpdateRequest,
  type RuntimeDiagnosticsExportRequest,
  type RuntimeExtensionInstallRequest,
  type RuntimeExtensionResourceReadRequest,
  type RuntimeMcpServerStatusListRequest,
  type RuntimePolicySetRequest,
  type RuntimeSecurityPreflightRequest,
  type RuntimeSessionDeleteRequest,
  type RuntimeSessionExportRequest,
  type RuntimeSessionImportRequest,
  type RuntimeThreadSnapshotsGetRequest,
  type RuntimeThreadSnapshotsSetRequest,
  type RuntimeToolExecutionEvent,
  type RuntimeToolExecutionMetricsReadRequest,
  type RuntimeToolGuardrailEvaluateRequest,
  type RuntimeToolGuardrailOutcomeEvent,
  type RuntimeToolOutcomeRecordRequest,
  type RuntimeToolPreflightV2Request,
  type SubAgentCloseRequest,
  type SubAgentInterruptRequest,
  type SubAgentSendRequest,
  type SubAgentSpawnRequest,
  type SubAgentStatusRequest,
  type SubAgentWaitRequest,
  type WorkspaceDiagnosticsListRequest,
  type WorkspacePatchApplyRequest,
} from "@ku0/code-runtime-host-contract";
import type {
  TerminalSessionSummary,
  TerminalStatus,
  ThreadCreateRequest,
  TurnInterruptRequest,
  TurnSendRequest,
} from "../contracts/runtime";
import type { AppSettings } from "../types";
import type { RuntimeClient as SharedRuntimeClient } from "@ku0/code-runtime-client/runtimeClientTypes";
import {
  normalizeLiveSkillExecuteRequest,
  validateLiveSkillExecuteRequest,
} from "./runtimeClientLiveSkills";
import {
  OPTIONAL_RUNTIME_RPC_METHODS,
  RUNTIME_AUTONOMY_V2_RPC_METHODS,
  RUNTIME_EXTENSION_RPC_METHODS,
  RUNTIME_KERNEL_V2_RPC_METHODS,
  RUNTIME_TOOL_METRICS_RPC_METHODS,
  THREAD_LIVE_RPC_METHODS,
} from "./runtimeClientRpcMethods";
import { adaptRuntimeRpcPayload, withCanonicalFields } from "./runtimeClientRpcPayloads";
import {
  invokeRuntimeExtensionRpc,
  normalizeNullableTerminalSessionSummary,
  normalizeTerminalSessionSummary,
  normalizeTerminalStatus,
  type RuntimeRpcInvoker,
} from "./runtimeClientRpcHelpers";

type RuntimeClient = SharedRuntimeClient<AppSettings>;

export function createRpcRuntimeClient(invokeRpc: RuntimeRpcInvoker): RuntimeClient {
  const client: RuntimeClient = {
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
    promptLibraryCreate(input) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.PROMPT_LIBRARY_CREATE, {
        ...withCanonicalFields({ workspaceId: input.workspaceId }),
        scope: input.scope,
        title: input.title,
        description: input.description,
        content: input.content,
      });
    },
    promptLibraryUpdate(input) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.PROMPT_LIBRARY_UPDATE, {
        ...withCanonicalFields({ workspaceId: input.workspaceId, promptId: input.promptId }),
        title: input.title,
        description: input.description,
        content: input.content,
      });
    },
    promptLibraryDelete(input) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.PROMPT_LIBRARY_DELETE, {
        ...withCanonicalFields({ workspaceId: input.workspaceId, promptId: input.promptId }),
      });
    },
    promptLibraryMove(input) {
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
    runtimeRunStart(request: RuntimeRunStartRequest) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.RUN_START,
        adaptRuntimeRpcPayload("runtimeRunStart", request)
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
    runtimeRunIntervene(request: RuntimeRunInterventionRequest) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.RUN_INTERVENE,
        adaptRuntimeRpcPayload("runtimeRunIntervene", request)
      );
    },
    runtimeRunInterveneV2(request: RuntimeRunInterventionRequest) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.RUN_INTERVENE_V2,
        adaptRuntimeRpcPayload("runtimeRunInterveneV2", request)
      );
    },
    runtimeRunCancel(request: RuntimeRunCancelRequest) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.RUN_CANCEL,
        adaptRuntimeRpcPayload("runtimeRunCancel", request)
      );
    },
    runtimeRunResume(request: RuntimeRunResumeRequest) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.RUN_RESUME,
        adaptRuntimeRpcPayload("runtimeRunResume", request)
      );
    },
    runtimeRunResumeV2(request: RuntimeRunResumeRequest) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.RUN_RESUME_V2,
        adaptRuntimeRpcPayload("runtimeRunResumeV2", request)
      );
    },
    runtimeRunSubscribe(request: RuntimeRunSubscribeRequest) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.RUN_SUBSCRIBE,
        adaptRuntimeRpcPayload("runtimeRunSubscribe", request)
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
    kernelJobStartV3(request: KernelJobStartRequestV3) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.KERNEL_JOB_START_V3,
        adaptRuntimeRpcPayload("kernelJobStartV3", request)
      );
    },
    kernelJobGetV3(request: KernelJobGetRequestV3) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.KERNEL_JOB_GET_V3,
        adaptRuntimeRpcPayload("kernelJobGetV3", request)
      );
    },
    kernelJobCancelV3(request: RuntimeRunCancelRequest) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.KERNEL_JOB_CANCEL_V3,
        adaptRuntimeRpcPayload("kernelJobCancelV3", request)
      );
    },
    kernelJobResumeV3(request: KernelJobResumeRequestV3) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.KERNEL_JOB_RESUME_V3,
        adaptRuntimeRpcPayload("kernelJobResumeV3", request)
      );
    },
    kernelJobInterveneV3(request: KernelJobInterventionRequestV3) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.KERNEL_JOB_INTERVENE_V3,
        adaptRuntimeRpcPayload("kernelJobInterveneV3", request)
      );
    },
    kernelJobSubscribeV3(request: KernelJobSubscribeRequestV3) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.KERNEL_JOB_SUBSCRIBE_V3,
        adaptRuntimeRpcPayload("kernelJobSubscribeV3", request)
      );
    },
    kernelJobCallbackRegisterV3(request: KernelJobCallbackRegistrationV3) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.KERNEL_JOB_CALLBACK_REGISTER_V3,
        adaptRuntimeRpcPayload("kernelJobCallbackRegisterV3", request)
      );
    },
    kernelJobCallbackRemoveV3(request: KernelJobCallbackRemoveRequestV3) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.KERNEL_JOB_CALLBACK_REMOVE_V3,
        adaptRuntimeRpcPayload("kernelJobCallbackRemoveV3", request)
      );
    },
    subAgentSpawn(request: SubAgentSpawnRequest) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        OPTIONAL_RUNTIME_RPC_METHODS.SUB_AGENT_SPAWN,
        adaptRuntimeRpcPayload("subAgentSpawn", request)
      );
    },
    subAgentSend(request: SubAgentSendRequest) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        OPTIONAL_RUNTIME_RPC_METHODS.SUB_AGENT_SEND,
        adaptRuntimeRpcPayload("subAgentSend", request)
      );
    },
    subAgentWait(request: SubAgentWaitRequest) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        OPTIONAL_RUNTIME_RPC_METHODS.SUB_AGENT_WAIT,
        adaptRuntimeRpcPayload("subAgentWait", request)
      );
    },
    subAgentStatus(request: SubAgentStatusRequest) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        OPTIONAL_RUNTIME_RPC_METHODS.SUB_AGENT_STATUS,
        adaptRuntimeRpcPayload("subAgentStatus", request)
      );
    },
    subAgentInterrupt(request: SubAgentInterruptRequest) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        OPTIONAL_RUNTIME_RPC_METHODS.SUB_AGENT_INTERRUPT,
        adaptRuntimeRpcPayload("subAgentInterrupt", request)
      );
    },
    subAgentClose(request: SubAgentCloseRequest) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        OPTIONAL_RUNTIME_RPC_METHODS.SUB_AGENT_CLOSE,
        adaptRuntimeRpcPayload("subAgentClose", request)
      );
    },
    runtimeRunCheckpointApproval(request: RuntimeRunCheckpointApprovalRequest) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.RUN_CHECKPOINT_APPROVAL,
        adaptRuntimeRpcPayload("runtimeRunCheckpointApproval", request)
      );
    },
    runtimeToolPreflightV2(request: RuntimeToolPreflightV2Request) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_AUTONOMY_V2_RPC_METHODS.RUNTIME_TOOL_PREFLIGHT_V2,
        request as Record<string, unknown>
      );
    },
    actionRequiredSubmitV2(request: ActionRequiredSubmitRequest) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_AUTONOMY_V2_RPC_METHODS.ACTION_REQUIRED_SUBMIT_V2,
        {
          ...request,
          ...withCanonicalFields({ requestId: request.requestId }),
        }
      );
    },
    actionRequiredGetV2(requestId: string) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_AUTONOMY_V2_RPC_METHODS.ACTION_REQUIRED_GET_V2,
        withCanonicalFields({ requestId })
      );
    },
    runtimeToolOutcomeRecordV2(request: RuntimeToolOutcomeRecordRequest) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_AUTONOMY_V2_RPC_METHODS.RUNTIME_TOOL_OUTCOME_RECORD_V2,
        request as Record<string, unknown>
      );
    },
    runtimePolicyGetV2() {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_AUTONOMY_V2_RPC_METHODS.RUNTIME_POLICY_GET_V2,
        CODE_RUNTIME_RPC_EMPTY_PARAMS
      );
    },
    runtimePolicySetV2(request: RuntimePolicySetRequest) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_AUTONOMY_V2_RPC_METHODS.RUNTIME_POLICY_SET_V2,
        request as Record<string, unknown>
      );
    },
    kernelCapabilitiesListV2() {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_KERNEL_V2_RPC_METHODS.KERNEL_CAPABILITIES_LIST_V2,
        CODE_RUNTIME_RPC_EMPTY_PARAMS
      );
    },
    kernelSessionsListV2(request?: KernelSessionsListRequest) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_KERNEL_V2_RPC_METHODS.KERNEL_SESSIONS_LIST_V2,
        {
          ...withCanonicalFields({ workspaceId: request?.workspaceId ?? null }),
          kind: request?.kind ?? null,
        }
      );
    },
    kernelJobsListV2(request?: KernelJobsListRequest) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_KERNEL_V2_RPC_METHODS.KERNEL_JOBS_LIST_V2,
        {
          ...withCanonicalFields({ workspaceId: request?.workspaceId ?? null }),
          status: request?.status ?? null,
        }
      );
    },
    kernelContextSnapshotV2(request) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_KERNEL_V2_RPC_METHODS.KERNEL_CONTEXT_SNAPSHOT_V2,
        {
          kind: request.kind,
          ...withCanonicalFields({
            workspaceId: request.workspaceId ?? null,
            threadId: request.threadId ?? null,
            taskId: request.taskId ?? null,
            runId: request.runId ?? null,
          }),
        }
      );
    },
    kernelExtensionsListV2(request?: KernelExtensionsListRequest) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_KERNEL_V2_RPC_METHODS.KERNEL_EXTENSIONS_LIST_V2,
        withCanonicalFields({ workspaceId: request?.workspaceId ?? null })
      );
    },
    kernelPoliciesEvaluateV2(request: KernelPoliciesEvaluateRequest) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_KERNEL_V2_RPC_METHODS.KERNEL_POLICIES_EVALUATE_V2,
        {
          ...withCanonicalFields({
            workspaceId: request.workspaceId ?? null,
            toolName: request.toolName ?? null,
            payloadBytes: request.payloadBytes ?? null,
            requiresApproval: request.requiresApproval ?? null,
            capabilityId: request.capabilityId ?? null,
            mutationKind: request.mutationKind ?? null,
          }),
          scope: request.scope ?? null,
        }
      );
    },
    kernelProjectionBootstrapV3(request?: KernelProjectionBootstrapRequest) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_KERNEL_V2_RPC_METHODS.KERNEL_PROJECTION_BOOTSTRAP_V3,
        {
          scopes: request?.scopes ?? null,
        }
      );
    },
    acpIntegrationsList() {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.ACP_INTEGRATIONS_LIST,
        CODE_RUNTIME_RPC_EMPTY_PARAMS
      );
    },
    acpIntegrationUpsert(input: AcpIntegrationUpsertInput) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.ACP_INTEGRATION_UPSERT,
        adaptRuntimeRpcPayload("acpIntegrationUpsert", input)
      );
    },
    acpIntegrationRemove(integrationId: string) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.ACP_INTEGRATION_REMOVE,
        { integrationId }
      );
    },
    acpIntegrationSetState(request: AcpIntegrationSetStateRequest) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.ACP_INTEGRATION_SET_STATE,
        adaptRuntimeRpcPayload("acpIntegrationSetState", request)
      );
    },
    acpIntegrationProbe(request: AcpIntegrationProbeRequest) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.ACP_INTEGRATION_PROBE,
        adaptRuntimeRpcPayload("acpIntegrationProbe", request)
      );
    },
    runtimeBackendsList() {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.RUNTIME_BACKENDS_LIST,
        CODE_RUNTIME_RPC_EMPTY_PARAMS
      );
    },
    runtimeBackendUpsert(input: RuntimeBackendUpsertInput) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.RUNTIME_BACKEND_UPSERT,
        adaptRuntimeRpcPayload("runtimeBackendUpsert", input)
      );
    },
    runtimeBackendRemove(backendId: string) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.RUNTIME_BACKEND_REMOVE,
        withCanonicalFields({ backendId })
      );
    },
    runtimeBackendSetState(request: RuntimeBackendSetStateRequest) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.RUNTIME_BACKEND_SET_STATE,
        adaptRuntimeRpcPayload("runtimeBackendSetState", request)
      );
    },
    codexExecRunV1(request: RuntimeCodexExecRunRequest) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.CODEX_EXEC_RUN_V1,
        adaptRuntimeRpcPayload("codexExecRun", request)
      );
    },
    codexCloudTasksListV1(request: RuntimeCodexCloudTasksListRequest = {}) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.CODEX_CLOUD_TASKS_LIST_V1,
        adaptRuntimeRpcPayload("codexCloudTasksList", request)
      );
    },
    codexConfigPathGetV1() {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.CODEX_CONFIG_PATH_GET_V1,
        CODE_RUNTIME_RPC_EMPTY_PARAMS
      );
    },
    codexDoctorV1(request: RuntimeCodexDoctorRequest = {}) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.CODEX_DOCTOR_V1,
        adaptRuntimeRpcPayload("codexDoctor", request)
      );
    },
    codexUpdateV1(request: RuntimeCodexUpdateRequest = {}) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.CODEX_UPDATE_V1,
        adaptRuntimeRpcPayload("codexUpdate", request)
      );
    },
    collaborationModesListV1(workspaceId: string) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.COLLABORATION_MODES_LIST_V1,
        withCanonicalFields({ workspaceId })
      );
    },
    mcpServerStatusListV1(request: RuntimeMcpServerStatusListRequest) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.MCP_SERVER_STATUS_LIST_V1,
        adaptRuntimeRpcPayload("mcpServerStatusList", request)
      );
    },
    browserDebugStatusV1(request: RuntimeBrowserDebugStatusRequest) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.BROWSER_DEBUG_STATUS_V1,
        adaptRuntimeRpcPayload("browserDebugStatus", request)
      );
    },
    browserDebugRunV1(request: RuntimeBrowserDebugRunRequest) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.BROWSER_DEBUG_RUN_V1,
        adaptRuntimeRpcPayload("browserDebugRun", request)
      );
    },
    workspacePatchApplyV1(request: WorkspacePatchApplyRequest) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.WORKSPACE_PATCH_APPLY_V1,
        adaptRuntimeRpcPayload("workspacePatchApply", request)
      );
    },
    workspaceDiagnosticsListV1(request: WorkspaceDiagnosticsListRequest) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.WORKSPACE_DIAGNOSTICS_LIST_V1,
        adaptRuntimeRpcPayload("workspaceDiagnosticsList", request)
      );
    },
    extensionsListV1(workspaceId?: string | null) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.EXTENSIONS_LIST_V1,
        withCanonicalFields({ workspaceId: workspaceId ?? null })
      );
    },
    extensionInstallV1(request: RuntimeExtensionInstallRequest) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.EXTENSION_INSTALL_V1,
        adaptRuntimeRpcPayload("extensionInstall", request)
      );
    },
    extensionRemoveV1(request: { workspaceId?: string | null; extensionId: string }) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.EXTENSION_REMOVE_V1,
        adaptRuntimeRpcPayload("extensionRemove", request)
      );
    },
    extensionToolsListV1(request: { workspaceId?: string | null; extensionId: string }) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.EXTENSION_TOOLS_LIST_V1,
        adaptRuntimeRpcPayload("extensionToolsList", request)
      );
    },
    extensionResourceReadV1(request: RuntimeExtensionResourceReadRequest) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.EXTENSION_RESOURCE_READ_V1,
        adaptRuntimeRpcPayload("extensionResourceRead", request)
      );
    },
    extensionsConfigV1(workspaceId?: string | null) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.EXTENSIONS_CONFIG_V1,
        withCanonicalFields({ workspaceId: workspaceId ?? null })
      );
    },
    sessionExportV1(request: RuntimeSessionExportRequest) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.SESSION_EXPORT_V1,
        adaptRuntimeRpcPayload("sessionExport", request)
      );
    },
    sessionImportV1(request: RuntimeSessionImportRequest) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.SESSION_IMPORT_V1,
        adaptRuntimeRpcPayload("sessionImport", request)
      );
    },
    sessionDeleteV1(request: RuntimeSessionDeleteRequest) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.SESSION_DELETE_V1,
        adaptRuntimeRpcPayload("sessionDelete", request)
      );
    },
    threadSnapshotsGetV1(request: RuntimeThreadSnapshotsGetRequest) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.THREAD_SNAPSHOTS_GET_V1,
        request
      );
    },
    threadSnapshotsSetV1(request: RuntimeThreadSnapshotsSetRequest) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.THREAD_SNAPSHOTS_SET_V1,
        adaptRuntimeRpcPayload("threadSnapshotsSet", request)
      );
    },
    securityPreflightV1(request: RuntimeSecurityPreflightRequest) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.SECURITY_PREFLIGHT_V1,
        adaptRuntimeRpcPayload("securityPreflight", request)
      );
    },
    runtimeDiagnosticsExportV1(request: RuntimeDiagnosticsExportRequest) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.RUNTIME_DIAGNOSTICS_EXPORT_V1,
        adaptRuntimeRpcPayload("runtimeDiagnosticsExport", request)
      );
    },
    distributedTaskGraph(request) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.DISTRIBUTED_TASK_GRAPH,
        {
          ...request,
          ...withCanonicalFields({ taskId: request.taskId }),
        }
      );
    },
    runtimeToolMetricsRecord(events: RuntimeToolExecutionEvent[]) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_TOOL_METRICS_RPC_METHODS.RUNTIME_TOOL_METRICS_RECORD,
        {
          events,
        }
      );
    },
    runtimeToolMetricsRead(query?: RuntimeToolExecutionMetricsReadRequest | null) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_TOOL_METRICS_RPC_METHODS.RUNTIME_TOOL_METRICS_READ,
        query ?? CODE_RUNTIME_RPC_EMPTY_PARAMS
      );
    },
    runtimeToolMetricsReset() {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_TOOL_METRICS_RPC_METHODS.RUNTIME_TOOL_METRICS_RESET,
        CODE_RUNTIME_RPC_EMPTY_PARAMS
      );
    },
    runtimeToolGuardrailEvaluate(request: RuntimeToolGuardrailEvaluateRequest) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_TOOL_METRICS_RPC_METHODS.RUNTIME_TOOL_GUARDRAIL_EVALUATE,
        request
      );
    },
    runtimeToolGuardrailRecordOutcome(event: RuntimeToolGuardrailOutcomeEvent) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_TOOL_METRICS_RPC_METHODS.RUNTIME_TOOL_GUARDRAIL_RECORD_OUTCOME,
        { event }
      );
    },
    runtimeToolGuardrailRead() {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_TOOL_METRICS_RPC_METHODS.RUNTIME_TOOL_GUARDRAIL_READ,
        CODE_RUNTIME_RPC_EMPTY_PARAMS
      );
    },
    models() {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.MODELS_POOL, CODE_RUNTIME_RPC_EMPTY_PARAMS);
    },
    providersCatalog() {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.PROVIDERS_CATALOG, CODE_RUNTIME_RPC_EMPTY_PARAMS);
    },
    remoteStatus() {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.REMOTE_STATUS, CODE_RUNTIME_RPC_EMPTY_PARAMS);
    },
    terminalStatus() {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.TERMINAL_STATUS,
        CODE_RUNTIME_RPC_EMPTY_PARAMS
      ).then((status) =>
        normalizeTerminalStatus(CODE_RUNTIME_RPC_METHODS.TERMINAL_STATUS, status as TerminalStatus)
      );
    },
    terminalOpen(workspaceId: string) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.TERMINAL_OPEN,
        withCanonicalFields({ workspaceId })
      ).then((summary) =>
        normalizeTerminalSessionSummary(
          CODE_RUNTIME_RPC_METHODS.TERMINAL_OPEN,
          summary as TerminalSessionSummary
        )
      );
    },
    terminalWrite(sessionId: string, input: string) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.TERMINAL_WRITE, {
        ...withCanonicalFields({ sessionId }),
        input,
      }).then((summary) =>
        normalizeNullableTerminalSessionSummary(
          CODE_RUNTIME_RPC_METHODS.TERMINAL_WRITE,
          summary as TerminalSessionSummary | null
        )
      );
    },
    terminalInputRaw(sessionId: string, input: string) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.TERMINAL_INPUT_RAW, {
        ...withCanonicalFields({ sessionId }),
        input,
      });
    },
    terminalRead(sessionId: string) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.TERMINAL_READ,
        withCanonicalFields({ sessionId })
      ).then((summary) =>
        normalizeNullableTerminalSessionSummary(
          CODE_RUNTIME_RPC_METHODS.TERMINAL_READ,
          summary as TerminalSessionSummary | null
        )
      );
    },
    terminalStreamStart(sessionId: string) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.TERMINAL_STREAM_START,
        withCanonicalFields({ sessionId })
      );
    },
    terminalStreamStop(sessionId: string) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.TERMINAL_STREAM_STOP,
        withCanonicalFields({ sessionId })
      );
    },
    terminalInterrupt(sessionId: string) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.TERMINAL_INTERRUPT,
        withCanonicalFields({ sessionId })
      );
    },
    terminalResize(sessionId: string, rows: number, cols: number) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.TERMINAL_RESIZE, {
        ...withCanonicalFields({ sessionId }),
        rows,
        cols,
      });
    },
    terminalClose(sessionId: string) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.TERMINAL_CLOSE, withCanonicalFields({ sessionId }));
    },
    cliSessions() {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.CLI_SESSIONS_LIST, CODE_RUNTIME_RPC_EMPTY_PARAMS);
    },
    oauthAccounts(
      provider: OAuthProviderId | null = null,
      options?: { usageRefresh?: OAuthUsageRefreshMode | null }
    ) {
      const usageRefresh = options?.usageRefresh;
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.OAUTH_ACCOUNTS_LIST, {
        provider,
        ...(usageRefresh ? withCanonicalFields({ usageRefresh }) : {}),
      });
    },
    oauthUpsertAccount(input: OAuthAccountUpsertInput) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.OAUTH_ACCOUNT_UPSERT, {
        ...input,
        ...withCanonicalFields({ accountId: input.accountId }),
      });
    },
    oauthRemoveAccount(accountId: string) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.OAUTH_ACCOUNT_REMOVE,
        withCanonicalFields({ accountId })
      );
    },
    oauthPrimaryAccountGet(provider: OAuthProviderId) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.OAUTH_PRIMARY_ACCOUNT_GET, { provider });
    },
    oauthPrimaryAccountSet(input) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.OAUTH_PRIMARY_ACCOUNT_SET, {
        provider: input.provider,
        ...withCanonicalFields({ accountId: input.accountId ?? null }),
      });
    },
    oauthPools(provider: OAuthProviderId | null = null) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.OAUTH_POOLS_LIST, { provider });
    },
    oauthUpsertPool(input: OAuthPoolUpsertInput) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.OAUTH_POOL_UPSERT, {
        ...input,
        ...withCanonicalFields({
          poolId: input.poolId,
          accountId: input.preferredAccountId ?? undefined,
        }),
      });
    },
    oauthRemovePool(poolId: string) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.OAUTH_POOL_REMOVE, withCanonicalFields({ poolId }));
    },
    oauthPoolMembers(poolId: string) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.OAUTH_POOL_MEMBERS_LIST,
        withCanonicalFields({ poolId })
      );
    },
    oauthApplyPool(input: OAuthPoolApplyInput) {
      return invokeRuntimeExtensionRpc(invokeRpc, RUNTIME_EXTENSION_RPC_METHODS.OAUTH_POOL_APPLY, {
        pool: {
          ...input.pool,
          ...withCanonicalFields({
            poolId: input.pool.poolId,
            accountId: input.pool.preferredAccountId ?? undefined,
          }),
        },
        members: input.members.map((member) => ({
          ...member,
          ...withCanonicalFields({ accountId: member.accountId }),
        })),
        expectedUpdatedAt: input.expectedUpdatedAt ?? null,
        expected_updated_at: input.expectedUpdatedAt ?? null,
      });
    },
    oauthReplacePoolMembers(poolId: string, members: OAuthPoolMemberInput[]) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.OAUTH_POOL_MEMBERS_REPLACE, {
        ...withCanonicalFields({ poolId }),
        members: members.map((member) => ({
          ...member,
          ...withCanonicalFields({ accountId: member.accountId }),
        })),
      });
    },
    oauthSelectPoolAccount(request: OAuthPoolSelectionRequest) {
      const chatgptWorkspaceId = request.chatgptWorkspaceId ?? request.workspaceId ?? null;
      const selectorPayload =
        request.chatgptWorkspaceId != null
          ? withCanonicalFields({
              chatgptWorkspaceId,
            })
          : withCanonicalFields({
              chatgptWorkspaceId,
              workspaceId: chatgptWorkspaceId,
            });
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.OAUTH_POOL_SELECT, {
        ...withCanonicalFields({
          poolId: request.poolId,
          sessionId: request.sessionId ?? null,
          modelId: request.modelId ?? null,
        }),
        ...selectorPayload,
      });
    },
    oauthBindPoolAccount(request) {
      // `sessionId` is the local project-workspace/session key. The optional
      // ChatGPT workspace selector remains explicit through
      // `chatgptWorkspaceId`.
      const chatgptWorkspaceId = request.chatgptWorkspaceId ?? request.workspaceId ?? null;
      const selectorPayload =
        request.chatgptWorkspaceId != null
          ? withCanonicalFields({
              chatgptWorkspaceId,
            })
          : withCanonicalFields({
              chatgptWorkspaceId,
              workspaceId: chatgptWorkspaceId,
            });
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.OAUTH_POOL_ACCOUNT_BIND, {
        ...withCanonicalFields({
          poolId: request.poolId,
          sessionId: request.sessionId,
          accountId: request.accountId,
        }),
        ...selectorPayload,
      });
    },
    oauthReportRateLimit(input: OAuthRateLimitReportInput) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.OAUTH_RATE_LIMIT_REPORT, {
        ...input,
        ...withCanonicalFields({
          accountId: input.accountId,
          modelId: input.modelId ?? null,
        }),
        retryAfterSec: input.retryAfterSec ?? null,
        resetAt: input.resetAt ?? null,
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage ?? null,
      });
    },
    oauthChatgptAuthTokensRefresh(request: OAuthChatgptAuthTokensRefreshRequest = {}) {
      const previousAccountId = request.previousAccountId ?? null;
      const sessionId = request.sessionId ?? null;
      // `chatgptWorkspaceId` is canonical. `workspaceId` remains wire-compatible
      // for older runtimes, but should not be used by new code paths.
      const chatgptWorkspaceId = request.chatgptWorkspaceId ?? request.workspaceId ?? null;
      const selectorPayload =
        request.chatgptWorkspaceId != null
          ? withCanonicalFields({
              chatgptWorkspaceId,
            })
          : withCanonicalFields({
              chatgptWorkspaceId,
              workspaceId: chatgptWorkspaceId,
            });
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.OAUTH_CHATGPT_AUTH_TOKENS_REFRESH,
        {
          reason: request.reason ?? null,
          previousAccountId,
          previous_account_id: previousAccountId,
          ...withCanonicalFields({
            sessionId,
          }),
          ...selectorPayload,
        }
      );
    },
    oauthCodexLoginStart(request: OAuthCodexLoginStartRequest) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.OAUTH_CODEX_LOGIN_START,
        withCanonicalFields({
          workspaceId: request.workspaceId,
          forceOAuth: request.forceOAuth === true,
        })
      );
    },
    oauthCodexLoginCancel(request: OAuthCodexLoginCancelRequest) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.OAUTH_CODEX_LOGIN_CANCEL,
        withCanonicalFields({
          workspaceId: request.workspaceId,
        })
      );
    },
    oauthCodexAccountsImportFromCockpitTools() {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.OAUTH_CODEX_ACCOUNTS_IMPORT_FROM_COCKPIT_TOOLS,
        CODE_RUNTIME_RPC_EMPTY_PARAMS
      );
    },
    liveSkills() {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.LIVE_SKILLS_LIST, CODE_RUNTIME_RPC_EMPTY_PARAMS);
    },
    runLiveSkill(request: LiveSkillExecuteRequest) {
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
    appSettingsGet() {
      return invokeRuntimeExtensionRpc<AppSettings>(
        invokeRpc,
        CODE_RUNTIME_RPC_METHODS.APP_SETTINGS_GET,
        CODE_RUNTIME_RPC_EMPTY_PARAMS
      );
    },
    appSettingsUpdate(settings: AppSettings) {
      return invokeRuntimeExtensionRpc<AppSettings>(
        invokeRpc,
        CODE_RUNTIME_RPC_METHODS.APP_SETTINGS_UPDATE,
        {
          payload: settings,
        }
      );
    },
    settings() {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.SETTINGS_SUMMARY, CODE_RUNTIME_RPC_EMPTY_PARAMS);
    },
    async bootstrap() {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        OPTIONAL_RUNTIME_RPC_METHODS.BOOTSTRAP_SNAPSHOT,
        CODE_RUNTIME_RPC_EMPTY_PARAMS
      );
    },
  };

  return client;
}
