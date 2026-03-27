import {
  CODE_RUNTIME_RPC_EMPTY_PARAMS,
  CODE_RUNTIME_RPC_METHODS,
  type TerminalSessionSummary,
  type TerminalStatus,
} from "@ku0/code-runtime-host-contract";
import {
  invokeRuntimeExtensionRpc,
  normalizeNullableTerminalSessionSummary,
  normalizeTerminalSessionSummary,
  normalizeTerminalStatus,
  type RuntimeRpcInvoker,
} from "./runtimeClientRpcHelpers";
import {
  OPTIONAL_RUNTIME_RPC_METHODS,
  RUNTIME_AUTONOMY_V2_RPC_METHODS,
  RUNTIME_EXTENSION_RPC_METHODS,
  RUNTIME_KERNEL_V2_RPC_METHODS,
  RUNTIME_TOOL_METRICS_RPC_METHODS,
} from "./runtimeClientRpcMethods";
import { adaptRuntimeRpcPayload, withCanonicalFields } from "./runtimeClientRpcPayloads";
import { createBaseRpcRuntimeClient } from "./runtimeClientRpcFactory";
import type { RuntimeClient } from "./runtimeClientTypes";

type AppLocalRpcRuntimeClientKeys =
  | "oauthAccounts"
  | "oauthUpsertAccount"
  | "oauthRemoveAccount"
  | "oauthPrimaryAccountGet"
  | "oauthPrimaryAccountSet"
  | "oauthPools"
  | "oauthUpsertPool"
  | "oauthRemovePool"
  | "oauthPoolMembers"
  | "oauthApplyPool"
  | "oauthReplacePoolMembers"
  | "oauthSelectPoolAccount"
  | "oauthBindPoolAccount"
  | "oauthReportRateLimit"
  | "oauthChatgptAuthTokensRefresh"
  | "oauthCodexLoginStart"
  | "oauthCodexLoginCancel"
  | "oauthCodexAccountsImportFromCockpitTools"
  | "appSettingsGet"
  | "appSettingsUpdate"
  | "textFileReadV1"
  | "textFileWriteV1";

export function createExtendedRpcRuntimeClient<
  TAppSettings extends Record<string, unknown> = Record<string, unknown>,
>(invokeRpc: RuntimeRpcInvoker) {
  const client = {
    ...createBaseRpcRuntimeClient<TAppSettings>(invokeRpc),
    kernelJobCallbackRegisterV3(request) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.KERNEL_JOB_CALLBACK_REGISTER_V3,
        adaptRuntimeRpcPayload("kernelJobCallbackRegisterV3", request)
      );
    },
    kernelJobCallbackRemoveV3(request) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.KERNEL_JOB_CALLBACK_REMOVE_V3,
        adaptRuntimeRpcPayload("kernelJobCallbackRemoveV3", request)
      );
    },
    subAgentSpawn(request) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        OPTIONAL_RUNTIME_RPC_METHODS.SUB_AGENT_SPAWN,
        adaptRuntimeRpcPayload("subAgentSpawn", request)
      );
    },
    subAgentSend(request) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        OPTIONAL_RUNTIME_RPC_METHODS.SUB_AGENT_SEND,
        adaptRuntimeRpcPayload("subAgentSend", request)
      );
    },
    subAgentWait(request) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        OPTIONAL_RUNTIME_RPC_METHODS.SUB_AGENT_WAIT,
        adaptRuntimeRpcPayload("subAgentWait", request)
      );
    },
    subAgentStatus(request) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        OPTIONAL_RUNTIME_RPC_METHODS.SUB_AGENT_STATUS,
        adaptRuntimeRpcPayload("subAgentStatus", request)
      );
    },
    subAgentInterrupt(request) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        OPTIONAL_RUNTIME_RPC_METHODS.SUB_AGENT_INTERRUPT,
        adaptRuntimeRpcPayload("subAgentInterrupt", request)
      );
    },
    subAgentClose(request) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        OPTIONAL_RUNTIME_RPC_METHODS.SUB_AGENT_CLOSE,
        adaptRuntimeRpcPayload("subAgentClose", request)
      );
    },
    runtimeRunCheckpointApproval(request) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.RUN_CHECKPOINT_APPROVAL,
        adaptRuntimeRpcPayload("runtimeRunCheckpointApproval", request)
      );
    },
    runtimeToolPreflightV2(request) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_AUTONOMY_V2_RPC_METHODS.RUNTIME_TOOL_PREFLIGHT_V2,
        request as Record<string, unknown>
      );
    },
    actionRequiredSubmitV2(request) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_AUTONOMY_V2_RPC_METHODS.ACTION_REQUIRED_SUBMIT_V2,
        {
          ...request,
          ...withCanonicalFields({ requestId: request.requestId }),
        }
      );
    },
    actionRequiredGetV2(requestId) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_AUTONOMY_V2_RPC_METHODS.ACTION_REQUIRED_GET_V2,
        withCanonicalFields({ requestId })
      );
    },
    runtimeToolOutcomeRecordV2(request) {
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
    runtimePolicySetV2(request) {
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
    kernelSessionsListV2(request) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_KERNEL_V2_RPC_METHODS.KERNEL_SESSIONS_LIST_V2,
        {
          ...withCanonicalFields({ workspaceId: request?.workspaceId ?? null }),
          kind: request?.kind ?? null,
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
    kernelExtensionsListV2(request) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_KERNEL_V2_RPC_METHODS.KERNEL_EXTENSIONS_LIST_V2,
        withCanonicalFields({ workspaceId: request?.workspaceId ?? null })
      );
    },
    kernelPoliciesEvaluateV2(request) {
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
    kernelProjectionBootstrapV3(request) {
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
    acpIntegrationUpsert(input) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.ACP_INTEGRATION_UPSERT,
        adaptRuntimeRpcPayload("acpIntegrationUpsert", input)
      );
    },
    acpIntegrationRemove(integrationId) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.ACP_INTEGRATION_REMOVE,
        { integrationId }
      );
    },
    acpIntegrationSetState(request) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.ACP_INTEGRATION_SET_STATE,
        adaptRuntimeRpcPayload("acpIntegrationSetState", request)
      );
    },
    acpIntegrationProbe(request) {
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
    runtimeBackendUpsert(input) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.RUNTIME_BACKEND_UPSERT,
        adaptRuntimeRpcPayload("runtimeBackendUpsert", input)
      );
    },
    runtimeBackendRemove(backendId) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.RUNTIME_BACKEND_REMOVE,
        withCanonicalFields({ backendId })
      );
    },
    runtimeBackendSetState(request) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.RUNTIME_BACKEND_SET_STATE,
        adaptRuntimeRpcPayload("runtimeBackendSetState", request)
      );
    },
    codexExecRunV1(request) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.CODEX_EXEC_RUN_V1,
        adaptRuntimeRpcPayload("codexExecRun", request)
      );
    },
    codexCloudTasksListV1(request = {}) {
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
    codexDoctorV1(request = {}) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.CODEX_DOCTOR_V1,
        adaptRuntimeRpcPayload("codexDoctor", request)
      );
    },
    codexUpdateV1(request = {}) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.CODEX_UPDATE_V1,
        adaptRuntimeRpcPayload("codexUpdate", request)
      );
    },
    collaborationModesListV1(workspaceId) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.COLLABORATION_MODES_LIST_V1,
        withCanonicalFields({ workspaceId })
      );
    },
    mcpServerStatusListV1(request) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.MCP_SERVER_STATUS_LIST_V1,
        adaptRuntimeRpcPayload("mcpServerStatusList", request)
      );
    },
    browserDebugStatusV1(request) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.BROWSER_DEBUG_STATUS_V1,
        adaptRuntimeRpcPayload("browserDebugStatus", request)
      );
    },
    browserDebugRunV1(request) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.BROWSER_DEBUG_RUN_V1,
        adaptRuntimeRpcPayload("browserDebugRun", request)
      );
    },
    extensionCatalogListV2(request = {}) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.EXTENSION_CATALOG_LIST_V2,
        withCanonicalFields({
          workspaceId: request.workspaceId ?? null,
          includeDisabled: request.includeDisabled ?? null,
          kinds: request.kinds ?? null,
        })
      );
    },
    extensionGetV2(request) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.EXTENSION_GET_V2,
        withCanonicalFields({
          workspaceId: request.workspaceId ?? null,
          extensionId: request.extensionId,
        })
      );
    },
    extensionInstallV2(request) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.EXTENSION_INSTALL_V2,
        adaptRuntimeRpcPayload("extensionInstall", request)
      );
    },
    extensionUpdateV2(request) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.EXTENSION_UPDATE_V2,
        adaptRuntimeRpcPayload("extensionUpdate", request)
      );
    },
    extensionSetStateV2(request) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.EXTENSION_SET_STATE_V2,
        adaptRuntimeRpcPayload("extensionSetState", request)
      );
    },
    extensionRemoveV2(request) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.EXTENSION_REMOVE_V2,
        adaptRuntimeRpcPayload("extensionRemove", request)
      );
    },
    extensionRegistrySearchV2(request = {}) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.EXTENSION_REGISTRY_SEARCH_V2,
        withCanonicalFields({
          workspaceId: request.workspaceId ?? null,
          query: request.query ?? null,
          kinds: request.kinds ?? null,
          sourceIds: request.sourceIds ?? null,
        })
      );
    },
    extensionRegistrySourcesV2() {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.EXTENSION_REGISTRY_SOURCES_V2,
        CODE_RUNTIME_RPC_EMPTY_PARAMS
      );
    },
    extensionPermissionsEvaluateV2(request) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.EXTENSION_PERMISSIONS_EVALUATE_V2,
        withCanonicalFields({
          workspaceId: request.workspaceId ?? null,
          extensionId: request.extensionId,
        })
      );
    },
    extensionHealthReadV2(request) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.EXTENSION_HEALTH_READ_V2,
        withCanonicalFields({
          workspaceId: request.workspaceId ?? null,
          extensionId: request.extensionId,
        })
      );
    },
    workspacePatchApplyV1(request) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.WORKSPACE_PATCH_APPLY_V1,
        adaptRuntimeRpcPayload("workspacePatchApply", request)
      );
    },
    workspaceDiagnosticsListV1(request) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.WORKSPACE_DIAGNOSTICS_LIST_V1,
        adaptRuntimeRpcPayload("workspaceDiagnosticsList", request)
      );
    },
    extensionToolsListV2(request) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.EXTENSION_TOOLS_LIST_V2,
        adaptRuntimeRpcPayload("extensionToolsList", request)
      );
    },
    extensionResourceReadV2(request) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.EXTENSION_RESOURCE_READ_V2,
        adaptRuntimeRpcPayload("extensionResourceRead", request)
      );
    },
    sessionExportV1(request) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.SESSION_EXPORT_V1,
        adaptRuntimeRpcPayload("sessionExport", request)
      );
    },
    sessionImportV1(request) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.SESSION_IMPORT_V1,
        adaptRuntimeRpcPayload("sessionImport", request)
      );
    },
    sessionDeleteV1(request) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.SESSION_DELETE_V1,
        adaptRuntimeRpcPayload("sessionDelete", request)
      );
    },
    threadSnapshotsGetV1(request) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.THREAD_SNAPSHOTS_GET_V1,
        request
      );
    },
    threadSnapshotsSetV1(request) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.THREAD_SNAPSHOTS_SET_V1,
        adaptRuntimeRpcPayload("threadSnapshotsSet", request)
      );
    },
    securityPreflightV1(request) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_EXTENSION_RPC_METHODS.SECURITY_PREFLIGHT_V1,
        adaptRuntimeRpcPayload("securityPreflight", request)
      );
    },
    runtimeDiagnosticsExportV1(request) {
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
    runtimeToolMetricsRecord(events) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_TOOL_METRICS_RPC_METHODS.RUNTIME_TOOL_METRICS_RECORD,
        {
          events,
        }
      );
    },
    runtimeToolMetricsRead(query) {
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
    runtimeToolGuardrailEvaluate(request) {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        RUNTIME_TOOL_METRICS_RPC_METHODS.RUNTIME_TOOL_GUARDRAIL_EVALUATE,
        request
      );
    },
    runtimeToolGuardrailRecordOutcome(event) {
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
    terminalOpen(workspaceId) {
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
    terminalWrite(sessionId, input) {
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
    terminalInputRaw(sessionId, input) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.TERMINAL_INPUT_RAW, {
        ...withCanonicalFields({ sessionId }),
        input,
      });
    },
    terminalRead(sessionId) {
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
    terminalStreamStart(sessionId) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.TERMINAL_STREAM_START,
        withCanonicalFields({ sessionId })
      );
    },
    terminalStreamStop(sessionId) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.TERMINAL_STREAM_STOP,
        withCanonicalFields({ sessionId })
      );
    },
    terminalInterrupt(sessionId) {
      return invokeRpc(
        CODE_RUNTIME_RPC_METHODS.TERMINAL_INTERRUPT,
        withCanonicalFields({ sessionId })
      );
    },
    terminalResize(sessionId, rows, cols) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.TERMINAL_RESIZE, {
        ...withCanonicalFields({ sessionId }),
        rows,
        cols,
      });
    },
    terminalClose(sessionId) {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.TERMINAL_CLOSE, withCanonicalFields({ sessionId }));
    },
    cliSessions() {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.CLI_SESSIONS_LIST, CODE_RUNTIME_RPC_EMPTY_PARAMS);
    },
    liveSkills() {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.LIVE_SKILLS_LIST, CODE_RUNTIME_RPC_EMPTY_PARAMS);
    },
    settings() {
      return invokeRpc(CODE_RUNTIME_RPC_METHODS.SETTINGS_SUMMARY, CODE_RUNTIME_RPC_EMPTY_PARAMS);
    },
    bootstrap() {
      return invokeRuntimeExtensionRpc(
        invokeRpc,
        OPTIONAL_RUNTIME_RPC_METHODS.BOOTSTRAP_SNAPSHOT,
        CODE_RUNTIME_RPC_EMPTY_PARAMS
      );
    },
  } satisfies Omit<RuntimeClient<TAppSettings>, AppLocalRpcRuntimeClientKeys>;

  return client;
}
