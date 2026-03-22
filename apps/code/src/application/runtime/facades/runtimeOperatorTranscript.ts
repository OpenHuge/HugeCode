export type RuntimeOperatorTranscriptSource = "webmcp_console";
export type RuntimeOperatorTranscriptAction = "tool" | "createMessage" | "elicitInput";
export type RuntimeOperatorTranscriptStatus = "success" | "error";

export type RuntimeGuardrailEffectiveLimits = {
  payloadLimitBytes: number;
  computerObserveRateLimitPerMinute: number;
};

export type WebMcpCallerContextSource =
  | "runtime_metadata"
  | "request_context"
  | "request_input"
  | "unavailable";

export type WebMcpAgentMetadataSource =
  | "runtime_metadata"
  | "request_context"
  | "request_input"
  | "unavailable";

export type WebMcpCallerContextAudit = {
  provider: string | null;
  modelId: string | null;
  policySource: string | null;
  source: WebMcpCallerContextSource;
};

export type WebMcpAgentMetadataAudit = {
  provider: string | null;
  modelId: string | null;
  source: WebMcpAgentMetadataSource;
};

export type WebMcpExecutionContextAudit = {
  callerContext: WebMcpCallerContextAudit;
  agentMetadata: WebMcpAgentMetadataAudit;
};

export type RuntimeOperatorTranscriptItem = {
  id: string;
  at: number;
  source: RuntimeOperatorTranscriptSource;
  action: RuntimeOperatorTranscriptAction;
  status: RuntimeOperatorTranscriptStatus;
  durationMs: number;
  summary: string;
  result: string;
  dryRun: boolean;
  effectiveLimits: RuntimeGuardrailEffectiveLimits | null;
  contextAudit: WebMcpExecutionContextAudit | null;
};

export type RuntimeOperatorTranscriptAuditSnapshot = {
  schemaVersion: 1;
  execution: {
    id: string;
    action: RuntimeOperatorTranscriptAction;
    status: RuntimeOperatorTranscriptStatus;
    at: number;
    durationMs: number;
    dryRun: boolean;
  };
  callerContext: {
    source: WebMcpCallerContextSource;
    provider: string | null;
    modelId: string | null;
    policySource: string | null;
  };
  agentMetadata: {
    source: WebMcpAgentMetadataSource;
    provider: string | null;
    modelId: string | null;
  };
  guardrails: {
    payloadLimitBytes: number | null;
    computerObserveRateLimitPerMinute: number | null;
  };
};

export type HydratedRuntimeOperatorTranscriptItem = RuntimeOperatorTranscriptItem & {
  contextAudit: WebMcpExecutionContextAudit;
  auditSnapshot: RuntimeOperatorTranscriptAuditSnapshot;
  callerSourceFilter: WebMcpCallerContextSource;
  callerProviderFilter: "n/a" | string;
};

export type NormalizeWebMcpConsoleTranscriptItemInput = {
  id?: string | null;
  at?: number;
  action: RuntimeOperatorTranscriptAction;
  status: RuntimeOperatorTranscriptStatus;
  durationMs: number;
  summary: string;
  result: string;
  dryRun?: boolean;
  effectiveLimits?: RuntimeGuardrailEffectiveLimits | null;
  input?: unknown;
  response?: unknown;
  contextAudit?: WebMcpExecutionContextAudit | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function readProviderAndModelFromRecord(value: unknown): {
  provider: string | null;
  modelId: string | null;
} {
  const record = asRecord(value);
  const provider = asNonEmptyString(record?.provider);
  const modelId = asNonEmptyString(record?.modelId) ?? asNonEmptyString(record?.model_id);
  return {
    provider,
    modelId,
  };
}

function hasProviderModel(value: { provider: string | null; modelId: string | null }): boolean {
  return value.provider !== null || value.modelId !== null;
}

function createUnavailableExecutionContextAudit(): WebMcpExecutionContextAudit {
  return {
    callerContext: {
      provider: null,
      modelId: null,
      policySource: null,
      source: "unavailable",
    },
    agentMetadata: {
      provider: null,
      modelId: null,
      source: "unavailable",
    },
  };
}

function createRuntimeOperatorTranscriptId(): string {
  return `operator-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function extractWebMcpExecutionContextAudit(
  input: unknown,
  response: unknown
): WebMcpExecutionContextAudit {
  const inputRecord = asRecord(input);
  const responseRecord = asRecord(response);

  const requestInputContext = readProviderAndModelFromRecord(inputRecord);
  const requestNestedContext = readProviderAndModelFromRecord(inputRecord?.context);

  const responseData = asRecord(responseRecord?.data);
  const responseResult = asRecord(responseData?.result);
  const responseMetadata = asRecord(responseResult?.metadata);

  const responseProviderDiagnostics =
    asRecord(responseMetadata?.providerDiagnostics) ?? asRecord(responseData?.providerDiagnostics);
  const diagnosticsContext = {
    provider:
      asNonEmptyString(responseProviderDiagnostics?.callerProvider) ??
      asNonEmptyString(responseProviderDiagnostics?.provider),
    modelId:
      asNonEmptyString(responseProviderDiagnostics?.callerModelId) ??
      asNonEmptyString(responseProviderDiagnostics?.modelId) ??
      asNonEmptyString(responseProviderDiagnostics?.model_id),
    policySource: asNonEmptyString(responseProviderDiagnostics?.policySource),
  };
  const responseCallerContextRecord =
    asRecord(responseMetadata?.callerContext) ?? asRecord(responseData?.callerContext);
  const responseCallerContext = readProviderAndModelFromRecord(responseCallerContextRecord);
  const responseCallerPolicySource = asNonEmptyString(responseCallerContextRecord?.policySource);

  const responseAgentMetadataRecord =
    asRecord(responseMetadata?.agentMetadata) ?? asRecord(responseData?.agentMetadata);
  const responseAgentMetadata = readProviderAndModelFromRecord(responseAgentMetadataRecord);

  const callerContext: WebMcpCallerContextAudit = hasProviderModel(diagnosticsContext)
    ? {
        provider: diagnosticsContext.provider,
        modelId: diagnosticsContext.modelId,
        policySource: diagnosticsContext.policySource,
        source: "runtime_metadata",
      }
    : hasProviderModel(responseCallerContext) || responseCallerPolicySource !== null
      ? {
          provider: responseCallerContext.provider,
          modelId: responseCallerContext.modelId,
          policySource: responseCallerPolicySource,
          source: "runtime_metadata",
        }
      : hasProviderModel(requestNestedContext)
        ? {
            provider: requestNestedContext.provider,
            modelId: requestNestedContext.modelId,
            policySource: null,
            source: "request_context",
          }
        : hasProviderModel(requestInputContext)
          ? {
              provider: requestInputContext.provider,
              modelId: requestInputContext.modelId,
              policySource: null,
              source: "request_input",
            }
          : {
              provider: null,
              modelId: null,
              policySource: null,
              source: "unavailable",
            };

  const agentMetadata: WebMcpAgentMetadataAudit = hasProviderModel(responseAgentMetadata)
    ? {
        provider: responseAgentMetadata.provider,
        modelId: responseAgentMetadata.modelId,
        source: "runtime_metadata",
      }
    : hasProviderModel(requestNestedContext)
      ? {
          provider: requestNestedContext.provider,
          modelId: requestNestedContext.modelId,
          source: "request_context",
        }
      : hasProviderModel(requestInputContext)
        ? {
            provider: requestInputContext.provider,
            modelId: requestInputContext.modelId,
            source: "request_input",
          }
        : {
            provider: null,
            modelId: null,
            source: "unavailable",
          };

  return {
    callerContext,
    agentMetadata,
  };
}

export function normalizeWebMcpConsoleTranscriptItem(
  input: NormalizeWebMcpConsoleTranscriptItemInput
): RuntimeOperatorTranscriptItem {
  return {
    id: asNonEmptyString(input.id) ?? createRuntimeOperatorTranscriptId(),
    at: typeof input.at === "number" && Number.isFinite(input.at) ? input.at : Date.now(),
    source: "webmcp_console",
    action: input.action,
    status: input.status,
    durationMs: Math.max(0, Math.trunc(input.durationMs)),
    summary: input.summary,
    result: input.result,
    dryRun: input.dryRun === true,
    effectiveLimits: input.effectiveLimits ?? null,
    contextAudit:
      input.contextAudit ??
      (input.input !== undefined || input.response !== undefined
        ? extractWebMcpExecutionContextAudit(input.input, input.response)
        : null),
  };
}

export function appendRuntimeOperatorTranscriptItem(
  current: RuntimeOperatorTranscriptItem[],
  next: RuntimeOperatorTranscriptItem,
  limit = 8
): RuntimeOperatorTranscriptItem[] {
  return [next, ...current].slice(0, Math.max(1, Math.trunc(limit)));
}

export function buildRuntimeOperatorTranscriptAuditSnapshot(
  entry: RuntimeOperatorTranscriptItem
): RuntimeOperatorTranscriptAuditSnapshot {
  const contextAudit = entry.contextAudit ?? createUnavailableExecutionContextAudit();
  return {
    schemaVersion: 1,
    execution: {
      id: entry.id,
      action: entry.action,
      status: entry.status,
      at: entry.at,
      durationMs: entry.durationMs,
      dryRun: entry.dryRun,
    },
    callerContext: {
      source: contextAudit.callerContext.source,
      provider: contextAudit.callerContext.provider,
      modelId: contextAudit.callerContext.modelId,
      policySource: contextAudit.callerContext.policySource,
    },
    agentMetadata: {
      source: contextAudit.agentMetadata.source,
      provider: contextAudit.agentMetadata.provider,
      modelId: contextAudit.agentMetadata.modelId,
    },
    guardrails: {
      payloadLimitBytes: entry.effectiveLimits?.payloadLimitBytes ?? null,
      computerObserveRateLimitPerMinute:
        entry.effectiveLimits?.computerObserveRateLimitPerMinute ?? null,
    },
  };
}

export function hydrateRuntimeOperatorTranscriptItem(
  entry: RuntimeOperatorTranscriptItem
): HydratedRuntimeOperatorTranscriptItem {
  const contextAudit = entry.contextAudit ?? createUnavailableExecutionContextAudit();
  return {
    ...entry,
    contextAudit,
    auditSnapshot: buildRuntimeOperatorTranscriptAuditSnapshot(entry),
    callerSourceFilter: contextAudit.callerContext.source,
    callerProviderFilter: contextAudit.callerContext.provider ?? "n/a",
  };
}

export function hydrateRuntimeOperatorTranscript(
  entries: RuntimeOperatorTranscriptItem[]
): HydratedRuntimeOperatorTranscriptItem[] {
  return entries.map((entry) => hydrateRuntimeOperatorTranscriptItem(entry));
}
