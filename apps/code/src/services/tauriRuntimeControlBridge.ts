import type {
  AcpIntegrationProbeRequest,
  AcpIntegrationSetStateRequest,
  AcpIntegrationSummary,
  AcpIntegrationUpsertInput,
  RuntimeDiagnosticsExportRequest,
  RuntimeDiagnosticsExportResponse,
  RuntimeBackendSetStateRequest,
  RuntimeSecurityPreflightDecision,
  RuntimeSecurityPreflightRequest,
  RuntimeSessionDeleteRequest,
  RuntimeSessionExportRequest,
  RuntimeSessionExportResponse,
  RuntimeSessionImportRequest,
  RuntimeSessionImportResponse,
  WorkspaceDiagnosticsListRequest,
  WorkspaceDiagnosticsListResponse,
} from "@ku0/code-runtime-host-contract";
import {
  type DistributedTaskGraph,
  detectRuntimeMode,
  getRuntimeClient,
  type RuntimeBackendSummary,
  type RuntimeBackendUpsertInput,
  type RuntimeToolExecutionEvent,
  type RuntimeToolExecutionMetricsReadRequest,
  type RuntimeToolExecutionMetricsSnapshot,
  type RuntimeToolGuardrailEvaluateRequest,
  type RuntimeToolGuardrailEvaluateResult,
  type RuntimeToolGuardrailOutcomeEvent,
  type RuntimeToolGuardrailStateSnapshot,
} from "./runtimeClient";
import { exportRuntimeDiagnosticsWithFallback } from "./runtimeClientDiagnosticsExport";
import { evaluateRuntimeSecurityPreflightWithFallback } from "./runtimeClientSecurityPreflight";
import {
  deleteRuntimeSessionWithFallback,
  exportRuntimeSessionWithFallback,
  importRuntimeSessionWithFallback,
} from "./runtimeClientSessionPortability";
import {
  getErrorMessage,
  isRuntimeMethodUnsupportedError,
  isWebRuntimeConnectionError,
} from "./tauriRuntimeTransport";
import {
  type DistributedTaskGraphInput,
  logRuntimeWarning,
  normalizeRuntimeBackendSetStateRequest,
} from "./tauriRuntimeTurnHelpers";

type RuntimeOptionalMethodFallback<Result> = {
  message: string;
  details: Record<string, unknown>;
  value: Result | null;
};

async function invokeOptionalRuntimeMethod<Result>(
  operation: () => Promise<Result>,
  options?: {
    webConnectionFallback?: RuntimeOptionalMethodFallback<Result>;
  }
): Promise<Result | null> {
  try {
    return await operation();
  } catch (error) {
    if (isRuntimeMethodUnsupportedError(error)) {
      return null;
    }
    const webConnectionFallback = options?.webConnectionFallback;
    if (
      webConnectionFallback &&
      detectRuntimeMode() === "runtime-gateway-web" &&
      isWebRuntimeConnectionError(error)
    ) {
      logRuntimeWarning(webConnectionFallback.message, {
        ...webConnectionFallback.details,
        error: getErrorMessage(error),
      });
      return webConnectionFallback.value;
    }
    throw error;
  }
}

export async function runtimeBackendsList(
  workspaceId: string | null = null
): Promise<RuntimeBackendSummary[] | null> {
  return invokeOptionalRuntimeMethod(() => getRuntimeClient().runtimeBackendsList(), {
    webConnectionFallback: {
      message:
        "Web runtime backend pool list unavailable; backend pool state is read-only until a runtime-backed connection is restored.",
      details: { workspaceId },
      value: null,
    },
  });
}

export async function acpIntegrationsList(
  workspaceId: string | null = null
): Promise<AcpIntegrationSummary[] | null> {
  return invokeOptionalRuntimeMethod(() => getRuntimeClient().acpIntegrationsList(), {
    webConnectionFallback: {
      message:
        "Web ACP integrations list unavailable; ACP controls are read-only until a runtime-backed connection is restored.",
      details: { workspaceId },
      value: null,
    },
  });
}

export async function acpIntegrationUpsert(
  request: AcpIntegrationUpsertInput & { workspaceId?: string | null }
): Promise<AcpIntegrationSummary | null> {
  const { workspaceId: _workspaceId, ...input } = request;
  return invokeOptionalRuntimeMethod(() => getRuntimeClient().acpIntegrationUpsert(input));
}

export async function acpIntegrationRemove(request: {
  integrationId: string;
  workspaceId?: string | null;
}): Promise<boolean | null> {
  void request.workspaceId;
  return invokeOptionalRuntimeMethod(() =>
    getRuntimeClient().acpIntegrationRemove(request.integrationId)
  );
}

export async function acpIntegrationSetState(
  request: AcpIntegrationSetStateRequest & { workspaceId?: string | null }
): Promise<AcpIntegrationSummary | null> {
  void request.workspaceId;
  const { workspaceId: _workspaceId, ...input } = request;
  return invokeOptionalRuntimeMethod(() => getRuntimeClient().acpIntegrationSetState(input));
}

export async function acpIntegrationProbe(
  request: AcpIntegrationProbeRequest & { workspaceId?: string | null }
): Promise<AcpIntegrationSummary | null> {
  void request.workspaceId;
  const { workspaceId: _workspaceId, ...input } = request;
  return invokeOptionalRuntimeMethod(() => getRuntimeClient().acpIntegrationProbe(input));
}

export async function runtimeBackendUpsert(
  request: RuntimeBackendUpsertInput & { workspaceId?: string | null }
): Promise<RuntimeBackendSummary | null> {
  const { workspaceId: _workspaceId, ...input } = request;
  return invokeOptionalRuntimeMethod(() => getRuntimeClient().runtimeBackendUpsert(input));
}

export async function runtimeBackendRemove(request: {
  backendId: string;
  workspaceId?: string | null;
}): Promise<boolean | null> {
  void request.workspaceId;
  return invokeOptionalRuntimeMethod(() =>
    getRuntimeClient().runtimeBackendRemove(request.backendId)
  );
}

export async function runtimeBackendSetState(request: {
  backendId: string;
  state?: string;
  workspaceId?: string | null;
  status?: RuntimeBackendSetStateRequest["status"];
  rolloutState?: RuntimeBackendSetStateRequest["rolloutState"];
  force?: boolean;
  reason?: string | null;
}): Promise<RuntimeBackendSummary | null> {
  void request.workspaceId;
  const normalizedRequest = normalizeRuntimeBackendSetStateRequest(request);
  if (!normalizedRequest) {
    return null;
  }
  return invokeOptionalRuntimeMethod(() =>
    getRuntimeClient().runtimeBackendSetState(normalizedRequest)
  );
}

export async function distributedTaskGraph(
  request?: DistributedTaskGraphInput
): Promise<DistributedTaskGraph | null> {
  const taskId = typeof request?.taskId === "string" ? request.taskId.trim() : "";
  const limit =
    typeof request?.limit === "number" && Number.isFinite(request.limit) && request.limit > 0
      ? Math.trunc(request.limit)
      : undefined;
  const includeDiagnostics =
    typeof request?.includeDiagnostics === "boolean" ? request.includeDiagnostics : undefined;
  if (!taskId) {
    return null;
  }
  return invokeOptionalRuntimeMethod(
    () =>
      getRuntimeClient().distributedTaskGraph({
        taskId,
        ...(limit !== undefined ? { limit } : {}),
        ...(includeDiagnostics !== undefined ? { includeDiagnostics } : {}),
      }),
    {
      webConnectionFallback: {
        message:
          "Web runtime distributed task graph unavailable; graph diagnostics stay read-only until a runtime-backed connection is restored.",
        details: {
          taskId,
          ...(limit !== undefined ? { limit } : {}),
          ...(includeDiagnostics !== undefined ? { includeDiagnostics } : {}),
        },
        value: null,
      },
    }
  );
}

export async function runtimeDiagnosticsExportV1(
  request: RuntimeDiagnosticsExportRequest = {}
): Promise<RuntimeDiagnosticsExportResponse | null> {
  return invokeOptionalRuntimeMethod(
    () => exportRuntimeDiagnosticsWithFallback(getRuntimeClient(), request),
    {
      webConnectionFallback: {
        message: "Web runtime diagnostics export unavailable; using graceful fallback.",
        details: {
          workspaceId: request.workspaceId ?? null,
          redactionLevel: request.redactionLevel ?? "strict",
        },
        value: null,
      },
    }
  );
}

export async function listWorkspaceDiagnostics(
  request: WorkspaceDiagnosticsListRequest
): Promise<WorkspaceDiagnosticsListResponse | null> {
  return invokeOptionalRuntimeMethod(() => getRuntimeClient().workspaceDiagnosticsListV1(request), {
    webConnectionFallback: {
      message: "Web runtime workspace diagnostics unavailable; using graceful fallback.",
      details: {
        workspaceId: request.workspaceId,
        paths: request.paths ?? null,
        severities: request.severities ?? null,
        maxItems: request.maxItems ?? null,
      },
      value: null,
    },
  });
}

export async function runtimeSessionExportV1(
  request: RuntimeSessionExportRequest
): Promise<RuntimeSessionExportResponse | null> {
  return invokeOptionalRuntimeMethod(
    () => exportRuntimeSessionWithFallback(getRuntimeClient(), request),
    {
      webConnectionFallback: {
        message: "Web runtime session export unavailable; using graceful fallback.",
        details: {
          workspaceId: request.workspaceId,
          threadId: request.threadId,
          includeAgentTasks: request.includeAgentTasks ?? false,
        },
        value: null,
      },
    }
  );
}

export async function runtimeSessionImportV1(
  request: RuntimeSessionImportRequest
): Promise<RuntimeSessionImportResponse | null> {
  return invokeOptionalRuntimeMethod(
    () => importRuntimeSessionWithFallback(getRuntimeClient(), request),
    {
      webConnectionFallback: {
        message: "Web runtime session import unavailable; using graceful fallback.",
        details: {
          workspaceId: request.workspaceId,
          threadId: request.threadId ?? null,
        },
        value: null,
      },
    }
  );
}

export async function runtimeSessionDeleteV1(
  request: RuntimeSessionDeleteRequest
): Promise<boolean> {
  const result = await invokeOptionalRuntimeMethod(
    () => deleteRuntimeSessionWithFallback(getRuntimeClient(), request),
    {
      webConnectionFallback: {
        message: "Web runtime session delete unavailable; using graceful fallback.",
        details: {
          workspaceId: request.workspaceId,
          threadId: request.threadId,
        },
        value: false,
      },
    }
  );
  return result ?? false;
}

export async function runtimeSecurityPreflightV1(
  request: RuntimeSecurityPreflightRequest
): Promise<RuntimeSecurityPreflightDecision> {
  const result = await invokeOptionalRuntimeMethod(
    () => evaluateRuntimeSecurityPreflightWithFallback(getRuntimeClient(), request),
    {
      webConnectionFallback: {
        message: "Web runtime security preflight unavailable; using review fallback.",
        details: {
          workspaceId: request.workspaceId ?? null,
          toolName: request.toolName ?? null,
          command: request.command ?? null,
        },
        value: {
          action: "review",
          reason: "Web runtime security preflight is unavailable; review required by fallback.",
          advisories: [],
        },
      },
    }
  );
  return (
    result ?? {
      action: "review",
      reason: "Runtime security preflight is unavailable; review required by fallback.",
      advisories: [],
    }
  );
}

export async function runtimeToolMetricsRecord(
  events: RuntimeToolExecutionEvent[]
): Promise<RuntimeToolExecutionMetricsSnapshot> {
  return getRuntimeClient().runtimeToolMetricsRecord(events);
}

export async function runtimeToolMetricsRead(
  query?: RuntimeToolExecutionMetricsReadRequest | null
): Promise<RuntimeToolExecutionMetricsSnapshot> {
  return getRuntimeClient().runtimeToolMetricsRead(query);
}

export async function runtimeToolMetricsReset(): Promise<RuntimeToolExecutionMetricsSnapshot> {
  return getRuntimeClient().runtimeToolMetricsReset();
}

export async function runtimeToolGuardrailEvaluate(
  request: RuntimeToolGuardrailEvaluateRequest
): Promise<RuntimeToolGuardrailEvaluateResult> {
  return getRuntimeClient().runtimeToolGuardrailEvaluate(request);
}

export async function runtimeToolGuardrailRecordOutcome(
  event: RuntimeToolGuardrailOutcomeEvent
): Promise<RuntimeToolGuardrailStateSnapshot> {
  return getRuntimeClient().runtimeToolGuardrailRecordOutcome(event);
}

export async function runtimeToolGuardrailRead(): Promise<RuntimeToolGuardrailStateSnapshot> {
  return getRuntimeClient().runtimeToolGuardrailRead();
}
