import { RUNTIME_MESSAGE_CODES } from "@ku0/code-runtime-client/runtimeMessageCodes";
import { createRuntimeError } from "@ku0/code-runtime-client/runtimeMessageEnvelope";
import type {
  AgentCommandCenterSnapshot,
  RuntimeAgentControl,
  WebMcpAgent,
} from "@ku0/code-runtime-webmcp-client/webMcpBridgeTypes";

type JsonRecord = Record<string, unknown>;

type WebMcpToolAnnotations = {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
  title?: string;
  taskSupport?: "none" | "partial" | "full";
};

type WebMcpToolDescriptor = {
  name: string;
  description: string;
  inputSchema: JsonRecord;
  annotations?: WebMcpToolAnnotations;
  execute: (input: JsonRecord, agent: WebMcpAgent | null) => unknown;
};

type RuntimeDiagnosticsToolHelpers = {
  buildResponse: (message: string, data: JsonRecord) => JsonRecord;
  toNonEmptyString: (value: unknown) => string | null;
};

type BuildRuntimeDiagnosticsToolsOptions = {
  snapshot: AgentCommandCenterSnapshot;
  runtimeControl: RuntimeAgentControl;
  helpers: RuntimeDiagnosticsToolHelpers;
};

type RuntimeDiagnosticsControl = RuntimeAgentControl & {
  runtimeToolMetricsRead?: () => Promise<unknown>;
  runtimeToolGuardrailRead?: () => Promise<unknown>;
  runtimeBackendsList?: (workspaceId?: string | null) => Promise<unknown>;
  distributedTaskGraph?: (input?: {
    taskId?: string | null;
    limit?: number | null;
    includeDiagnostics?: boolean | null;
  }) => Promise<unknown>;
  getRuntimeCapabilitiesSummary?: () => Promise<unknown>;
  getRuntimeHealth?: () => Promise<unknown>;
  getRuntimeTerminalStatus?: () => Promise<unknown>;
};

type RuntimeDiagnosticsControlMethodName =
  | "runtimeToolMetricsRead"
  | "runtimeBackendsList"
  | "runtimeToolGuardrailRead"
  | "distributedTaskGraph"
  | "getRuntimeCapabilitiesSummary"
  | "getRuntimeHealth"
  | "getRuntimeTerminalStatus";

const DEFAULT_RUNTIME_TOOL_SUCCESS_MIN_RATE = 0.95;
const TOP_FAILED_TOOLS_LIMIT = 5;
const RUNTIME_TOOL_SCOPES = ["write", "runtime", "computer_observe"] as const;
const SOLO_MAX_PAYLOAD_LIMIT_MULTIPLIER = 4;
const SOLO_MAX_COMPUTER_OBSERVE_RATE_LIMIT_MULTIPLIER = 5;

type RuntimeToolScope = (typeof RUNTIME_TOOL_SCOPES)[number];

type RuntimeToolOutcomeTotals = {
  successTotal: number;
  validationFailedTotal: number;
  runtimeFailedTotal: number;
  timeoutTotal: number;
  blockedTotal: number;
};

type RuntimeToolMetricsSummary = {
  gate: {
    minSuccessRate: number;
    successRate: number | null;
    denominator: number;
    passed: boolean | null;
    blockedTotal: number;
    windowSize: number | null;
    updatedAt: number | null;
  };
  scopeSuccessRates: Array<{
    scope: RuntimeToolScope;
    successRate: number | null;
    denominator: number;
    blockedTotal: number;
  }>;
  topFailedTools: Array<{
    scope: RuntimeToolScope;
    toolName: string;
    failedTotal: number;
    validationFailedTotal: number;
    runtimeFailedTotal: number;
    timeoutTotal: number;
    blockedTotal: number;
  }>;
  channelHealth: {
    status: "healthy" | "degraded" | "unavailable";
    reason: string | null;
    lastErrorCode: string | null;
    updatedAt: number | null;
    source: "metrics" | "guardrails";
  };
  circuitBreakers: Array<{
    scope: RuntimeToolScope;
    state: string;
    openedAt: number | null;
    updatedAt: number | null;
  }>;
  topFailedReasons: Array<{
    errorCode: string;
    count: number;
  }>;
  effectiveLimitsByProfile: {
    default: {
      payloadLimitBytes: number | null;
      computerObserveRateLimitPerMinute: number | null;
    };
    soloMax: {
      payloadLimitBytes: number | null;
      computerObserveRateLimitPerMinute: number | null;
    };
  };
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" ? (value as JsonRecord) : null;
}

function asNonNegativeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.trunc(value));
}

function asOptionalNonNegativeInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const normalized = Math.trunc(value);
  return normalized >= 0 ? normalized : null;
}

function asOptionalNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readValue(record: JsonRecord | null, camel: string, snake: string): unknown {
  if (!record) {
    return undefined;
  }
  if (Object.hasOwn(record, camel)) {
    return record[camel];
  }
  if (Object.hasOwn(record, snake)) {
    return record[snake];
  }
  return undefined;
}

function readCounter(record: JsonRecord | null, camel: string, snake: string): number {
  if (!record) {
    return 0;
  }
  if (Object.hasOwn(record, camel)) {
    return asNonNegativeInteger(record[camel]);
  }
  if (Object.hasOwn(record, snake)) {
    return asNonNegativeInteger(record[snake]);
  }
  return 0;
}

function readOutcomeTotals(record: JsonRecord | null): RuntimeToolOutcomeTotals {
  return {
    successTotal: readCounter(record, "successTotal", "success_total"),
    validationFailedTotal: readCounter(record, "validationFailedTotal", "validation_failed_total"),
    runtimeFailedTotal: readCounter(record, "runtimeFailedTotal", "runtime_failed_total"),
    timeoutTotal: readCounter(record, "timeoutTotal", "timeout_total"),
    blockedTotal: readCounter(record, "blockedTotal", "blocked_total"),
  };
}

function computeSuccessRate(totals: RuntimeToolOutcomeTotals): {
  successRate: number | null;
  denominator: number;
} {
  const denominator =
    totals.successTotal +
    totals.validationFailedTotal +
    totals.runtimeFailedTotal +
    totals.timeoutTotal;
  if (denominator <= 0) {
    return {
      successRate: null,
      denominator: 0,
    };
  }
  return {
    successRate: totals.successTotal / denominator,
    denominator,
  };
}

function isRuntimeToolScope(value: unknown): value is RuntimeToolScope {
  return value === "write" || value === "runtime" || value === "computer_observe";
}

function readChannelHealthSummary(input: {
  metricsRecord: JsonRecord | null;
  guardrailsRecord: JsonRecord | null;
}): RuntimeToolMetricsSummary["channelHealth"] | null {
  const guardrailsChannelHealth = asRecord(
    readValue(input.guardrailsRecord, "channelHealth", "channel_health")
  );
  if (guardrailsChannelHealth) {
    const status = asOptionalNonEmptyString(readValue(guardrailsChannelHealth, "status", "status"));
    if (status === "healthy" || status === "degraded" || status === "unavailable") {
      return {
        status,
        reason: asOptionalNonEmptyString(readValue(guardrailsChannelHealth, "reason", "reason")),
        lastErrorCode: asOptionalNonEmptyString(
          readValue(guardrailsChannelHealth, "lastErrorCode", "last_error_code")
        ),
        updatedAt: asOptionalNonNegativeInteger(
          readValue(guardrailsChannelHealth, "updatedAt", "updated_at")
        ),
        source: "guardrails",
      };
    }
  }

  const metricsChannelHealth = asRecord(
    readValue(input.metricsRecord, "channelHealth", "channel_health")
  );
  if (!metricsChannelHealth) {
    return null;
  }
  const status = asOptionalNonEmptyString(readValue(metricsChannelHealth, "status", "status"));
  if (status !== "healthy" && status !== "degraded" && status !== "unavailable") {
    return null;
  }
  return {
    status,
    reason: asOptionalNonEmptyString(readValue(metricsChannelHealth, "reason", "reason")),
    lastErrorCode: asOptionalNonEmptyString(
      readValue(metricsChannelHealth, "lastErrorCode", "last_error_code")
    ),
    updatedAt: asOptionalNonNegativeInteger(
      readValue(metricsChannelHealth, "updatedAt", "updated_at")
    ),
    source: "metrics",
  };
}

function readCircuitBreakersSummary(input: {
  metricsRecord: JsonRecord | null;
  guardrailsRecord: JsonRecord | null;
}): RuntimeToolMetricsSummary["circuitBreakers"] {
  const source = asRecord(input.guardrailsRecord)
    ? (readValue(input.guardrailsRecord, "circuitBreakers", "circuit_breakers") ??
      readValue(input.metricsRecord, "circuitBreakers", "circuit_breakers"))
    : readValue(input.metricsRecord, "circuitBreakers", "circuit_breakers");
  if (!Array.isArray(source)) {
    return [];
  }
  const rows: RuntimeToolMetricsSummary["circuitBreakers"] = [];
  for (const entryValue of source) {
    const entry = asRecord(entryValue);
    if (!entry) {
      continue;
    }
    const scope = asOptionalNonEmptyString(readValue(entry, "scope", "scope"));
    if (!isRuntimeToolScope(scope)) {
      continue;
    }
    rows.push({
      scope,
      state: asOptionalNonEmptyString(readValue(entry, "state", "state")) ?? "unknown",
      openedAt: asOptionalNonNegativeInteger(readValue(entry, "openedAt", "opened_at")),
      updatedAt: asOptionalNonNegativeInteger(readValue(entry, "updatedAt", "updated_at")),
    });
  }
  return rows;
}

function readTopFailedReasonsSummary(
  metricsRecord: JsonRecord | null
): RuntimeToolMetricsSummary["topFailedReasons"] {
  const topK = readValue(metricsRecord, "errorCodeTopK", "error_code_top_k");
  if (Array.isArray(topK)) {
    const rows: RuntimeToolMetricsSummary["topFailedReasons"] = [];
    for (const entryValue of topK) {
      const entry = asRecord(entryValue);
      if (!entry) {
        continue;
      }
      const errorCode = asOptionalNonEmptyString(readValue(entry, "errorCode", "error_code"));
      if (!errorCode) {
        continue;
      }
      rows.push({
        errorCode,
        count: asNonNegativeInteger(readValue(entry, "count", "count")),
      });
    }
    if (rows.length > 0) {
      return rows;
    }
  }

  const reasonCounts = new Map<string, number>();
  const recent = readValue(metricsRecord, "recent", "recent");
  if (Array.isArray(recent)) {
    for (const entryValue of recent) {
      const entry = asRecord(entryValue);
      if (!entry) {
        continue;
      }
      const errorCode = asOptionalNonEmptyString(readValue(entry, "errorCode", "error_code"));
      if (!errorCode) {
        continue;
      }
      reasonCounts.set(errorCode, (reasonCounts.get(errorCode) ?? 0) + 1);
    }
  }
  return [...reasonCounts.entries()]
    .map(([errorCode, count]) => ({ errorCode, count }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.errorCode.localeCompare(right.errorCode);
    })
    .slice(0, TOP_FAILED_TOOLS_LIMIT);
}

function readEffectiveLimitsByProfile(
  guardrailsRecord: JsonRecord | null
): RuntimeToolMetricsSummary["effectiveLimitsByProfile"] {
  const payloadLimitBytes = asOptionalNonNegativeInteger(
    readValue(guardrailsRecord, "payloadLimitBytes", "payload_limit_bytes")
  );
  const computerObserveRateLimitPerMinute = asOptionalNonNegativeInteger(
    readValue(
      guardrailsRecord,
      "computerObserveRateLimitPerMinute",
      "computer_observe_rate_limit_per_minute"
    )
  );
  return {
    default: {
      payloadLimitBytes,
      computerObserveRateLimitPerMinute,
    },
    soloMax: {
      payloadLimitBytes:
        payloadLimitBytes === null ? null : payloadLimitBytes * SOLO_MAX_PAYLOAD_LIMIT_MULTIPLIER,
      computerObserveRateLimitPerMinute:
        computerObserveRateLimitPerMinute === null
          ? null
          : computerObserveRateLimitPerMinute * SOLO_MAX_COMPUTER_OBSERVE_RATE_LIMIT_MULTIPLIER,
    },
  };
}

function summarizeRuntimeToolMetrics(
  metrics: unknown,
  minSuccessRate: number,
  guardrails: unknown
): RuntimeToolMetricsSummary {
  const metricsRecord = asRecord(metrics);
  const guardrailsRecord = asRecord(guardrails);
  const totals = readOutcomeTotals(asRecord(metricsRecord?.totals));
  const { successRate: overallSuccessRate, denominator: overallDenominator } =
    computeSuccessRate(totals);

  const windowSize =
    metricsRecord && Object.hasOwn(metricsRecord, "windowSize")
      ? asNonNegativeInteger(metricsRecord.windowSize)
      : 0;
  const updatedAt =
    metricsRecord && Object.hasOwn(metricsRecord, "updatedAt")
      ? asNonNegativeInteger(metricsRecord.updatedAt)
      : 0;

  const scopeTotals: Record<RuntimeToolScope, RuntimeToolOutcomeTotals> = {
    write: readOutcomeTotals(null),
    runtime: readOutcomeTotals(null),
    computer_observe: readOutcomeTotals(null),
  };
  const failedByTool: RuntimeToolMetricsSummary["topFailedTools"] = [];
  const byToolRecord = asRecord(metricsRecord?.byTool);
  for (const entryValue of Object.values(byToolRecord ?? {})) {
    const entry = asRecord(entryValue);
    if (!entry) {
      continue;
    }
    const scope = entry?.scope;
    if (!isRuntimeToolScope(scope)) {
      continue;
    }
    const toolName =
      typeof entry.toolName === "string" && entry.toolName.trim().length > 0
        ? entry.toolName.trim()
        : "<unknown>";
    const totalsByTool = readOutcomeTotals(entry);
    scopeTotals[scope].successTotal += totalsByTool.successTotal;
    scopeTotals[scope].validationFailedTotal += totalsByTool.validationFailedTotal;
    scopeTotals[scope].runtimeFailedTotal += totalsByTool.runtimeFailedTotal;
    scopeTotals[scope].timeoutTotal += totalsByTool.timeoutTotal;
    scopeTotals[scope].blockedTotal += totalsByTool.blockedTotal;

    const failedTotal =
      totalsByTool.validationFailedTotal +
      totalsByTool.runtimeFailedTotal +
      totalsByTool.timeoutTotal;
    if (failedTotal <= 0 && totalsByTool.blockedTotal <= 0) {
      continue;
    }
    failedByTool.push({
      scope,
      toolName,
      failedTotal,
      validationFailedTotal: totalsByTool.validationFailedTotal,
      runtimeFailedTotal: totalsByTool.runtimeFailedTotal,
      timeoutTotal: totalsByTool.timeoutTotal,
      blockedTotal: totalsByTool.blockedTotal,
    });
  }

  failedByTool.sort((left, right) => {
    if (right.failedTotal !== left.failedTotal) {
      return right.failedTotal - left.failedTotal;
    }
    if (right.blockedTotal !== left.blockedTotal) {
      return right.blockedTotal - left.blockedTotal;
    }
    if (left.scope !== right.scope) {
      return left.scope.localeCompare(right.scope);
    }
    return left.toolName.localeCompare(right.toolName);
  });

  const channelHealth = readChannelHealthSummary({
    metricsRecord,
    guardrailsRecord,
  });
  if (!channelHealth) {
    throw createRuntimeError({
      code: RUNTIME_MESSAGE_CODES.runtime.validation.inputInvalid,
      message: "Runtime tool metrics snapshot is missing channelHealth truth.",
    });
  }
  const circuitBreakers = readCircuitBreakersSummary({
    metricsRecord,
    guardrailsRecord,
  });
  const topFailedReasons = readTopFailedReasonsSummary(metricsRecord);
  const effectiveLimitsByProfile = readEffectiveLimitsByProfile(guardrailsRecord);

  return {
    gate: {
      minSuccessRate,
      successRate: overallSuccessRate,
      denominator: overallDenominator,
      passed: overallSuccessRate === null ? null : overallSuccessRate >= minSuccessRate,
      blockedTotal: totals.blockedTotal,
      windowSize: windowSize > 0 ? windowSize : null,
      updatedAt: updatedAt > 0 ? updatedAt : null,
    },
    scopeSuccessRates: RUNTIME_TOOL_SCOPES.map((scope) => {
      const result = computeSuccessRate(scopeTotals[scope]);
      return {
        scope,
        successRate: result.successRate,
        denominator: result.denominator,
        blockedTotal: scopeTotals[scope].blockedTotal,
      };
    }),
    topFailedTools: failedByTool.slice(0, TOP_FAILED_TOOLS_LIMIT),
    channelHealth,
    circuitBreakers,
    topFailedReasons,
    effectiveLimitsByProfile,
  };
}

function requireRuntimeDiagnosticsControlMethod<
  MethodName extends RuntimeDiagnosticsControlMethodName,
>(
  control: RuntimeDiagnosticsControl,
  methodName: MethodName,
  toolName: string
): NonNullable<RuntimeDiagnosticsControl[MethodName]> {
  const candidate = control[methodName];
  if (typeof candidate !== "function") {
    throw createRuntimeError({
      code: RUNTIME_MESSAGE_CODES.runtime.validation.methodUnavailable,
      message: `Tool ${toolName} is unavailable because runtime control method ${String(methodName)} is not implemented.`,
    });
  }
  return candidate as NonNullable<RuntimeDiagnosticsControl[MethodName]>;
}

export function buildRuntimeDiagnosticsTools(
  options: BuildRuntimeDiagnosticsToolsOptions
): WebMcpToolDescriptor[] {
  const { snapshot, runtimeControl, helpers } = options;
  const runtimeDiagnosticsControl = runtimeControl as RuntimeDiagnosticsControl;

  return [
    {
      name: "get-runtime-tool-execution-metrics",
      description:
        "Read in-memory runtime tool execution telemetry for success/failure diagnosis and tool quality tracking.",
      inputSchema: {
        type: "object",
        properties: {
          minSuccessRate: {
            type: "number",
            description: "Optional gate threshold between 0 and 1. Defaults to 0.95.",
          },
        },
      },
      execute: async (input) => {
        const minSuccessRateInput = input.minSuccessRate;
        const minSuccessRate =
          typeof minSuccessRateInput === "undefined"
            ? DEFAULT_RUNTIME_TOOL_SUCCESS_MIN_RATE
            : (() => {
                if (
                  typeof minSuccessRateInput !== "number" ||
                  !Number.isFinite(minSuccessRateInput) ||
                  minSuccessRateInput < 0 ||
                  minSuccessRateInput > 1
                ) {
                  throw createRuntimeError({
                    code: RUNTIME_MESSAGE_CODES.runtime.validation.inputInvalid,
                    message: "minSuccessRate must be a number between 0 and 1.",
                  });
                }
                return minSuccessRateInput;
              })();
        const runtimeToolMetricsRead = requireRuntimeDiagnosticsControlMethod(
          runtimeDiagnosticsControl,
          "runtimeToolMetricsRead",
          "get-runtime-tool-execution-metrics"
        );
        const metrics = await runtimeToolMetricsRead();
        const runtimeToolGuardrailRead = runtimeDiagnosticsControl.runtimeToolGuardrailRead;
        const guardrails =
          typeof runtimeToolGuardrailRead === "function" ? await runtimeToolGuardrailRead() : null;
        const metricsSummary = summarizeRuntimeToolMetrics(metrics, minSuccessRate, guardrails);
        return helpers.buildResponse("Runtime tool execution metrics retrieved.", {
          workspaceId: snapshot.workspaceId,
          metrics,
          guardrails,
          metricsSummary,
        });
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: "get-runtime-tool-guardrail-state",
      description: "Read runtime tool guardrail state snapshot for fail-closed diagnostics.",
      inputSchema: {
        type: "object",
        properties: {},
      },
      execute: async () => {
        const runtimeToolGuardrailRead = requireRuntimeDiagnosticsControlMethod(
          runtimeDiagnosticsControl,
          "runtimeToolGuardrailRead",
          "get-runtime-tool-guardrail-state"
        );
        const guardrails = await runtimeToolGuardrailRead();
        const effectiveLimitsByProfile = readEffectiveLimitsByProfile(asRecord(guardrails));
        return helpers.buildResponse("Runtime tool guardrail state retrieved.", {
          workspaceId: snapshot.workspaceId,
          guardrails,
          effectiveLimitsByProfile,
        });
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: "list-runtime-backends",
      description: "List runtime backend pool and routing availability.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
        },
      },
      execute: async (input) => {
        const runtimeBackendsList = requireRuntimeDiagnosticsControlMethod(
          runtimeDiagnosticsControl,
          "runtimeBackendsList",
          "list-runtime-backends"
        );
        const workspaceId = helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId;
        const backends = await runtimeBackendsList(workspaceId);
        return helpers.buildResponse("Runtime backends listed.", {
          workspaceId,
          backends,
        });
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: "get-runtime-distributed-task-graph",
      description: "Read distributed execution graph for a runtime task.",
      inputSchema: {
        type: "object",
        properties: {
          taskId: { type: "string" },
          limit: { type: "number" },
          includeDiagnostics: { type: "boolean" },
        },
        required: ["taskId"],
      },
      execute: async (input) => {
        const distributedTaskGraph = requireRuntimeDiagnosticsControlMethod(
          runtimeDiagnosticsControl,
          "distributedTaskGraph",
          "get-runtime-distributed-task-graph"
        );
        const taskId = helpers.toNonEmptyString(input.taskId);
        if (!taskId) {
          throw createRuntimeError({
            code: RUNTIME_MESSAGE_CODES.runtime.validation.inputRequired,
            message: "taskId is required.",
          });
        }
        const limit =
          typeof input.limit === "number" && Number.isFinite(input.limit) && input.limit > 0
            ? Math.trunc(input.limit)
            : null;
        const includeDiagnostics =
          typeof input.includeDiagnostics === "boolean" ? input.includeDiagnostics : null;
        const graph = await distributedTaskGraph({
          taskId,
          ...(limit !== null ? { limit } : {}),
          ...(includeDiagnostics !== null ? { includeDiagnostics } : {}),
        });
        return helpers.buildResponse("Runtime distributed task graph retrieved.", {
          workspaceId: snapshot.workspaceId,
          taskId,
          ...(limit !== null ? { limit } : {}),
          ...(includeDiagnostics !== null ? { includeDiagnostics } : {}),
          graph,
        });
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: "get-runtime-capabilities-summary",
      description: "Read runtime capabilities summary for transport/method availability.",
      inputSchema: {
        type: "object",
        properties: {},
      },
      execute: async () => {
        const getRuntimeCapabilitiesSummary = requireRuntimeDiagnosticsControlMethod(
          runtimeDiagnosticsControl,
          "getRuntimeCapabilitiesSummary",
          "get-runtime-capabilities-summary"
        );
        const capabilities = await getRuntimeCapabilitiesSummary();
        return helpers.buildResponse("Runtime capabilities summary retrieved.", {
          workspaceId: snapshot.workspaceId,
          capabilities,
        });
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: "get-runtime-health",
      description: "Read runtime health status and availability signals.",
      inputSchema: {
        type: "object",
        properties: {},
      },
      execute: async () => {
        const getRuntimeHealth = requireRuntimeDiagnosticsControlMethod(
          runtimeDiagnosticsControl,
          "getRuntimeHealth",
          "get-runtime-health"
        );
        const health = await getRuntimeHealth();
        return helpers.buildResponse("Runtime health retrieved.", {
          workspaceId: snapshot.workspaceId,
          health,
        });
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: "get-runtime-terminal-status",
      description: "Read runtime terminal subsystem status and active session summary.",
      inputSchema: {
        type: "object",
        properties: {},
      },
      execute: async () => {
        const getRuntimeTerminalStatus = requireRuntimeDiagnosticsControlMethod(
          runtimeDiagnosticsControl,
          "getRuntimeTerminalStatus",
          "get-runtime-terminal-status"
        );
        const terminalStatus = await getRuntimeTerminalStatus();
        return helpers.buildResponse("Runtime terminal status retrieved.", {
          workspaceId: snapshot.workspaceId,
          terminalStatus,
        });
      },
      annotations: { readOnlyHint: true },
    },
  ];
}
