import {
  type AcpIntegrationProbeRequest,
  type AcpIntegrationSetStateRequest,
  type AcpIntegrationUpsertInput,
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
  type RuntimeReviewGetV2Request,
  type RuntimeCodexCloudTasksListRequest,
  type RuntimeCodexDoctorRequest,
  type RuntimeCodexExecRunRequest,
  type RuntimeCodexUpdateRequest,
  type RuntimeDiagnosticsExportRequest,
  type RuntimeExtensionInstallRequest,
  type RuntimeExtensionResourceReadRequest,
  type RuntimeExtensionUpdateRequest,
  type RuntimeMcpServerStatusListRequest,
  type RuntimeBackendSetStateRequest,
  type RuntimeBackendUpsertInput,
  type RuntimeSecurityPreflightRequest,
  type RuntimeSessionDeleteRequest,
  type RuntimeSessionExportRequest,
  type RuntimeSessionImportRequest,
  type RuntimeThreadSnapshotsSetRequest,
  type SubAgentCloseRequest,
  type SubAgentInterruptRequest,
  type SubAgentSendRequest,
  type SubAgentSpawnRequest,
  type SubAgentStatusRequest,
  type SubAgentWaitRequest,
  type TurnInterruptRequest,
  type TurnInterruptRequestCompat,
  type TurnSendRequest,
  type TurnSendRequestCompat,
  type WorkspaceDiagnosticsListRequest,
  type WorkspacePatchApplyRequest,
} from "@ku0/code-runtime-host-contract";

export function withCanonicalFields<Fields extends Record<string, unknown>>(
  fields: Fields
): Fields {
  return { ...fields };
}

function withCanonicalPayload<Payload extends object>(payload: Payload): Payload {
  return { ...payload };
}

function toCompatTurnSendPayload(payload: TurnSendRequest): TurnSendRequestCompat {
  const compatPayload = payload as TurnSendRequestCompat;
  const requestId = payload.requestId ?? compatPayload.request_id;
  const hasContextPrefixField = "contextPrefix" in payload || "context_prefix" in compatPayload;
  const contextPrefix = payload.contextPrefix ?? compatPayload.context_prefix ?? null;
  const hasCollaborationModeField = Object.hasOwn(payload, "collaborationMode");
  const collaborationMode = payload.collaborationMode;
  const hasAutoDriveField = Object.hasOwn(payload, "autoDrive");
  const autoDrive = payload.autoDrive;

  return withCanonicalPayload({
    ...payload,
    requestId,
    provider: payload.provider ?? null,
    modelId: payload.modelId ?? null,
    reasonEffort: payload.reasonEffort ?? null,
    missionMode: payload.missionMode ?? null,
    executionProfileId: payload.executionProfileId ?? null,
    codexBin: payload.codexBin ?? null,
    codexArgs: payload.codexArgs ?? null,
    preferredBackendIds: payload.preferredBackendIds ?? null,
    ...(hasContextPrefixField
      ? {
          contextPrefix,
        }
      : {}),
    ...(hasAutoDriveField && autoDrive != null
      ? {
          autoDrive,
        }
      : {}),
    ...(hasCollaborationModeField && collaborationMode != null
      ? {
          collaborationMode,
        }
      : {}),
  }) as TurnSendRequestCompat;
}

function toCompatRuntimeBackendUpsertPayload(payload: RuntimeBackendUpsertInput) {
  return withCanonicalPayload({
    ...payload,
  });
}

function toCompatRuntimeBackendSetStatePayload(payload: RuntimeBackendSetStateRequest) {
  return withCanonicalPayload({
    ...payload,
  });
}

function toCompatAcpIntegrationUpsertPayload(payload: AcpIntegrationUpsertInput) {
  return withCanonicalPayload({
    ...payload,
    backendId: payload.backendId ?? null,
  });
}

function toCompatAcpIntegrationSetStatePayload(payload: AcpIntegrationSetStateRequest) {
  return withCanonicalPayload({ ...payload });
}

function toCompatAcpIntegrationProbePayload(payload: AcpIntegrationProbeRequest) {
  return withCanonicalPayload({ ...payload });
}

function toCompatTurnInterruptPayload(payload: TurnInterruptRequest): TurnInterruptRequestCompat {
  return withCanonicalPayload({
    ...payload,
    turnId: payload.turnId ?? null,
  }) as TurnInterruptRequestCompat;
}

function toCompatRuntimeRunStartPayload(payload: RuntimeRunStartRequest) {
  return withCanonicalPayload({
    ...payload,
    threadId: payload.threadId ?? null,
    requestId: payload.requestId,
    taskSource: payload.taskSource ?? null,
    executionProfileId: payload.executionProfileId ?? null,
    reviewProfileId: payload.reviewProfileId ?? null,
    modelId: payload.modelId ?? null,
    reasonEffort: payload.reasonEffort ?? null,
    requiredCapabilities: payload.requiredCapabilities,
    preferredBackendIds: payload.preferredBackendIds,
    defaultBackendId: payload.defaultBackendId ?? null,
    validationPresetId: payload.validationPresetId ?? null,
    missionBrief: payload.missionBrief ?? null,
    relaunchContext: payload.relaunchContext ?? null,
    steps: payload.steps.map((step) => ({
      ...step,
      timeoutMs: step.timeoutMs ?? null,
      requiresApproval: step.requiresApproval ?? null,
      approvalReason: step.approvalReason ?? null,
    })),
  });
}

function toCompatRuntimeRunPrepareV2Payload(payload: RuntimeRunPrepareV2Request) {
  return toCompatRuntimeRunStartPayload(payload);
}

function toCompatRuntimeRunCancelPayload(payload: RuntimeRunCancelRequest) {
  return withCanonicalPayload({ ...payload });
}

function toCompatRuntimeRunInterventionPayload(payload: RuntimeRunInterventionRequest) {
  return withCanonicalPayload({
    ...payload,
    instructionPatch: payload.instructionPatch ?? null,
    executionProfileId: payload.executionProfileId ?? null,
    reviewProfileId: payload.reviewProfileId ?? null,
    preferredBackendIds: payload.preferredBackendIds ?? null,
    relaunchContext: payload.relaunchContext ?? null,
  });
}

function toCompatRuntimeRunResumePayload(payload: RuntimeRunResumeRequest) {
  return withCanonicalPayload({ ...payload });
}

function toCompatRuntimeRunGetV2Payload(payload: RuntimeRunGetV2Request) {
  return withCanonicalPayload({ ...payload });
}

function toCompatRuntimeReviewGetV2Payload(payload: RuntimeReviewGetV2Request) {
  return withCanonicalPayload({ ...payload });
}

function toCompatRuntimeRunsListPayload(payload: RuntimeRunsListRequest) {
  return withCanonicalPayload({ ...payload });
}

function toCompatRuntimeRunCheckpointApprovalPayload(payload: RuntimeRunCheckpointApprovalRequest) {
  return withCanonicalPayload({ ...payload });
}

function toCompatSubAgentSpawnPayload(payload: SubAgentSpawnRequest) {
  return withCanonicalPayload({
    ...payload,
    threadId: payload.threadId ?? null,
    reasonEffort: payload.reasonEffort ?? null,
    modelId: payload.modelId ?? null,
  });
}

function toCompatSubAgentSendPayload(payload: SubAgentSendRequest) {
  return withCanonicalPayload({
    ...payload,
    approvalReason: payload.approvalReason ?? null,
  });
}

function toCompatSubAgentWaitPayload(payload: SubAgentWaitRequest) {
  return withCanonicalPayload({
    ...payload,
    timeoutMs: payload.timeoutMs ?? null,
    pollIntervalMs: payload.pollIntervalMs ?? null,
  });
}

function toCompatSubAgentStatusPayload(payload: SubAgentStatusRequest) {
  return withCanonicalPayload({ ...payload });
}

function toCompatSubAgentInterruptPayload(payload: SubAgentInterruptRequest) {
  return withCanonicalPayload({ ...payload });
}

function toCompatSubAgentClosePayload(payload: SubAgentCloseRequest) {
  return withCanonicalPayload({ ...payload });
}

function toCompatExtensionInstallPayload(payload: RuntimeExtensionInstallRequest) {
  return withCanonicalPayload({
    ...payload,
    workspaceId: payload.workspaceId ?? null,
  });
}

function toCompatExtensionUpdatePayload(payload: RuntimeExtensionUpdateRequest) {
  return withCanonicalPayload({
    ...payload,
    workspaceId: payload.workspaceId ?? null,
  });
}

function toCompatExtensionSetStatePayload(payload: {
  workspaceId?: string | null;
  extensionId: string;
  enabled: boolean;
}) {
  return withCanonicalPayload({
    ...payload,
    workspaceId: payload.workspaceId ?? null,
  });
}

function toCompatExtensionRemovePayload(payload: {
  workspaceId?: string | null;
  extensionId: string;
}) {
  return withCanonicalPayload({
    ...payload,
    workspaceId: payload.workspaceId ?? null,
  });
}

function toCompatExtensionToolsListPayload(payload: {
  workspaceId?: string | null;
  extensionId: string;
}) {
  return withCanonicalPayload({
    ...payload,
    workspaceId: payload.workspaceId ?? null,
  });
}

function toCompatExtensionResourceReadPayload(payload: RuntimeExtensionResourceReadRequest) {
  return withCanonicalPayload({
    ...payload,
    workspaceId: payload.workspaceId ?? null,
  });
}

function toCompatSessionExportPayload(payload: RuntimeSessionExportRequest) {
  return withCanonicalPayload({
    ...payload,
    includeAgentTasks: payload.includeAgentTasks ?? true,
  });
}

function toCompatSessionImportPayload(payload: RuntimeSessionImportRequest) {
  return withCanonicalPayload({
    ...payload,
    threadId: payload.threadId ?? null,
  });
}

function toCompatSessionDeletePayload(payload: RuntimeSessionDeleteRequest) {
  return withCanonicalPayload({ ...payload });
}

function toCompatThreadSnapshotsSetPayload(payload: RuntimeThreadSnapshotsSetRequest) {
  return withCanonicalPayload({ ...payload });
}

function toCompatCodexExecRunPayload(payload: RuntimeCodexExecRunRequest) {
  return withCanonicalPayload({
    ...payload,
    workspaceId: payload.workspaceId ?? null,
  });
}

function toCompatCodexCloudTasksPayload(payload: RuntimeCodexCloudTasksListRequest) {
  return withCanonicalPayload({
    ...payload,
    workspaceId: payload.workspaceId ?? null,
    cursor: payload.cursor ?? null,
    forceRefetch: payload.forceRefetch ?? false,
  });
}

function toCompatCodexDoctorPayload(payload: RuntimeCodexDoctorRequest) {
  return withCanonicalPayload({
    ...payload,
    codexBin: payload.codexBin ?? null,
    codexArgs: payload.codexArgs ?? null,
  });
}

function toCompatCodexUpdatePayload(payload: RuntimeCodexUpdateRequest) {
  return withCanonicalPayload({
    ...payload,
    codexBin: payload.codexBin ?? null,
    codexArgs: payload.codexArgs ?? null,
  });
}

function toCompatMcpServerStatusListPayload(payload: RuntimeMcpServerStatusListRequest) {
  return withCanonicalPayload({ ...payload });
}

function toCompatBrowserDebugStatusPayload(payload: RuntimeBrowserDebugStatusRequest) {
  return withCanonicalPayload({ ...payload });
}

function toCompatBrowserDebugRunPayload(payload: RuntimeBrowserDebugRunRequest) {
  return withCanonicalPayload({
    ...payload,
    includeScreenshot: payload.includeScreenshot ?? null,
  });
}

function toCompatWorkspacePatchApplyPayload(payload: WorkspacePatchApplyRequest) {
  return withCanonicalPayload({
    ...payload,
    dryRun: payload.dryRun ?? null,
  });
}

function toCompatWorkspaceDiagnosticsListPayload(payload: WorkspaceDiagnosticsListRequest) {
  return withCanonicalPayload({
    ...payload,
    maxItems: payload.maxItems ?? null,
    includeProviderDetails: payload.includeProviderDetails ?? false,
  });
}

function toCompatSecurityPreflightPayload(payload: RuntimeSecurityPreflightRequest) {
  return withCanonicalPayload({
    ...payload,
    workspaceId: payload.workspaceId ?? null,
  });
}

function toCompatRuntimeDiagnosticsExportPayload(payload: RuntimeDiagnosticsExportRequest) {
  const redactionLevel = payload.redactionLevel ?? "strict";
  const includeTaskSummaries = payload.includeTaskSummaries ?? false;
  const includeEventTail = payload.includeEventTail ?? true;
  const includeZipBase64 = payload.includeZipBase64 ?? true;
  return withCanonicalPayload({
    ...payload,
    workspaceId: payload.workspaceId ?? null,
    redactionLevel,
    includeTaskSummaries,
    includeEventTail,
    includeZipBase64,
  });
}

export const RUNTIME_RPC_PAYLOAD_REGISTRY = Object.freeze({
  turnSend: toCompatTurnSendPayload,
  turnInterrupt: toCompatTurnInterruptPayload,
  runtimeRunPrepareV2: toCompatRuntimeRunPrepareV2Payload,
  runtimeRunStartV2: toCompatRuntimeRunStartPayload,
  runtimeRunInterveneV2: toCompatRuntimeRunInterventionPayload,
  runtimeRunCancelV2: toCompatRuntimeRunCancelPayload,
  runtimeRunResumeV2: toCompatRuntimeRunResumePayload,
  runtimeRunGetV2: toCompatRuntimeRunGetV2Payload,
  runtimeRunSubscribeV2: toCompatRuntimeRunGetV2Payload,
  runtimeReviewGetV2: toCompatRuntimeReviewGetV2Payload,
  runtimeRunsList: toCompatRuntimeRunsListPayload,
  runtimeRunCheckpointApproval: toCompatRuntimeRunCheckpointApprovalPayload,
  subAgentSpawn: toCompatSubAgentSpawnPayload,
  subAgentSend: toCompatSubAgentSendPayload,
  subAgentWait: toCompatSubAgentWaitPayload,
  subAgentStatus: toCompatSubAgentStatusPayload,
  subAgentInterrupt: toCompatSubAgentInterruptPayload,
  subAgentClose: toCompatSubAgentClosePayload,
  acpIntegrationUpsert: toCompatAcpIntegrationUpsertPayload,
  acpIntegrationSetState: toCompatAcpIntegrationSetStatePayload,
  acpIntegrationProbe: toCompatAcpIntegrationProbePayload,
  runtimeBackendUpsert: toCompatRuntimeBackendUpsertPayload,
  runtimeBackendSetState: toCompatRuntimeBackendSetStatePayload,
  codexExecRun: toCompatCodexExecRunPayload,
  codexCloudTasksList: toCompatCodexCloudTasksPayload,
  codexDoctor: toCompatCodexDoctorPayload,
  codexUpdate: toCompatCodexUpdatePayload,
  mcpServerStatusList: toCompatMcpServerStatusListPayload,
  browserDebugStatus: toCompatBrowserDebugStatusPayload,
  browserDebugRun: toCompatBrowserDebugRunPayload,
  workspacePatchApply: toCompatWorkspacePatchApplyPayload,
  workspaceDiagnosticsList: toCompatWorkspaceDiagnosticsListPayload,
  extensionInstall: toCompatExtensionInstallPayload,
  extensionUpdate: toCompatExtensionUpdatePayload,
  extensionSetState: toCompatExtensionSetStatePayload,
  extensionRemove: toCompatExtensionRemovePayload,
  extensionToolsList: toCompatExtensionToolsListPayload,
  extensionResourceRead: toCompatExtensionResourceReadPayload,
  sessionExport: toCompatSessionExportPayload,
  sessionImport: toCompatSessionImportPayload,
  sessionDelete: toCompatSessionDeletePayload,
  threadSnapshotsSet: toCompatThreadSnapshotsSetPayload,
  securityPreflight: toCompatSecurityPreflightPayload,
  runtimeDiagnosticsExport: toCompatRuntimeDiagnosticsExportPayload,
});

export function adaptRuntimeRpcPayload<Key extends keyof typeof RUNTIME_RPC_PAYLOAD_REGISTRY>(
  key: Key,
  payload: Parameters<(typeof RUNTIME_RPC_PAYLOAD_REGISTRY)[Key]>[0]
): ReturnType<(typeof RUNTIME_RPC_PAYLOAD_REGISTRY)[Key]> {
  const adapter = RUNTIME_RPC_PAYLOAD_REGISTRY[key];
  return adapter(payload as never) as ReturnType<(typeof RUNTIME_RPC_PAYLOAD_REGISTRY)[Key]>;
}
