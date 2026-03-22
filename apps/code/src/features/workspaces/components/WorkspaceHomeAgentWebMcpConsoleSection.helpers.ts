import type {
  WebMcpCapabilityMatrix,
  WebMcpCatalog,
} from "../../../application/runtime/types/webMcpBridge";
import {
  type RuntimeGuardrailEffectiveLimits,
  type RuntimeOperatorTranscriptAction,
} from "../../../application/runtime/facades/runtimeOperatorTranscript";
import {
  extractSchemaValidationFromLegacyMessage,
  extractSchemaValidationResult,
} from "../../../application/runtime/ports/webMcpInputSchemaValidationError";
import type { SchemaValidationResult } from "../../../application/runtime/ports/webMcpToolInputSchemaValidation";

export type CatalogView = "tools" | "resources" | "prompts" | "resourceTemplates";

const PREFERRED_DRY_RUN_TEMPLATE_TOOL_NAMES = new Set([
  "execute-workspace-command",
  "write-workspace-file",
  "edit-workspace-file",
]);
export type ExecutionAction = RuntimeOperatorTranscriptAction;

export function stringifyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export const DEFAULT_TOOL_ARGUMENTS_DRAFT = "{}";
export const DEFAULT_CREATE_MESSAGE_DRAFT = stringifyJson({
  messages: [
    {
      role: "user",
      content: { type: "text", text: "Summarize current workspace status." },
    },
  ],
  maxTokens: 256,
});
export const DEFAULT_ELICIT_INPUT_DRAFT = stringifyJson({
  mode: "form",
  message: "Provide deployment channel",
  requestedSchema: {
    type: "object",
    properties: {
      channel: {
        type: "string",
        description: "Deployment channel",
      },
    },
    required: ["channel"],
  },
});

export const EMPTY_SCHEMA_VALIDATION_RESULT: SchemaValidationResult = {
  errors: [],
  warnings: [],
  missingRequired: [],
  typeMismatches: [],
  extraFields: [],
};

function uniqueMessages(values: string[]): string[] {
  return [...new Set(values)];
}

export function mergeSchemaValidationResults(
  ...results: SchemaValidationResult[]
): SchemaValidationResult {
  return {
    errors: uniqueMessages(results.flatMap((item) => item.errors)),
    warnings: uniqueMessages(results.flatMap((item) => item.warnings)),
    missingRequired: uniqueMessages(results.flatMap((item) => item.missingRequired)),
    typeMismatches: uniqueMessages(results.flatMap((item) => item.typeMismatches)),
    extraFields: uniqueMessages(results.flatMap((item) => item.extraFields)),
  };
}

export function extractSchemaValidationFromError(error: unknown): SchemaValidationResult | null {
  const structured = extractSchemaValidationResult(error);
  if (structured) {
    return structured;
  }
  if (error instanceof Error) {
    return extractSchemaValidationFromLegacyMessage(error.message);
  }
  if (typeof error === "string") {
    return extractSchemaValidationFromLegacyMessage(error);
  }
  return null;
}

export function parseJsonObject(input: string): Record<string, unknown> {
  const parsed = JSON.parse(input) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Payload must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

export function parseJsonError(input: string): string | null {
  try {
    parseJsonObject(input);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

export function getToolName(entry: unknown): string | null {
  if (!entry || typeof entry !== "object") {
    return null;
  }
  const value = (entry as Record<string, unknown>).name;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function getToolInputSchema(entry: unknown): unknown {
  if (!entry || typeof entry !== "object") {
    return null;
  }
  return (entry as Record<string, unknown>).inputSchema ?? null;
}

function getCatalogEntryLabel(entry: unknown, fallbackPrefix: string, index: number): string {
  if (!entry || typeof entry !== "object") {
    return `${fallbackPrefix}-${index + 1}`;
  }
  const record = entry as Record<string, unknown>;
  const candidates = [record.name, record.title, record.uri, record.id];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return `${fallbackPrefix}-${index + 1}`;
}

export function resolveCatalogEntries(catalog: WebMcpCatalog | null, view: CatalogView): unknown[] {
  if (!catalog) {
    return [];
  }
  if (view === "tools") {
    return catalog.tools;
  }
  if (view === "resources") {
    return catalog.resources;
  }
  if (view === "prompts") {
    return catalog.prompts;
  }
  return catalog.resourceTemplates;
}

export function selectCatalogLabel(entry: unknown, index: number): string {
  return getCatalogEntryLabel(entry, "entry", index).toLowerCase();
}

export function buildSchemaTemplate(
  schema: unknown,
  options?: {
    toolName?: string | null;
  }
): Record<string, unknown> {
  if (!schema || typeof schema !== "object") {
    return {};
  }
  const properties = (schema as Record<string, unknown>).properties;
  if (!properties || typeof properties !== "object") {
    return {};
  }

  const template: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (!value || typeof value !== "object") {
      template[key] = null;
      continue;
    }
    const field = value as Record<string, unknown>;
    if ("default" in field) {
      template[key] = field.default ?? null;
      continue;
    }
    if (field.type === "string") {
      template[key] = "";
      continue;
    }
    if (field.type === "number" || field.type === "integer") {
      template[key] = 0;
      continue;
    }
    if (field.type === "boolean") {
      if (key === "dryRun" && PREFERRED_DRY_RUN_TEMPLATE_TOOL_NAMES.has(options?.toolName ?? "")) {
        template[key] = true;
        continue;
      }
      template[key] = false;
      continue;
    }
    if (field.type === "array") {
      template[key] = [];
      continue;
    }
    if (field.type === "object") {
      template[key] = {};
      continue;
    }
    template[key] = null;
  }
  return template;
}

export function getCapabilityStatus(
  capabilities: WebMcpCapabilityMatrix
): Array<{ key: string; ready: boolean }> {
  const listCatalogReady =
    capabilities.tools.listTools &&
    capabilities.resources.listResources &&
    capabilities.prompts.listPrompts;
  return [
    { key: "callTool", ready: capabilities.tools.callTool },
    { key: "createMessage", ready: capabilities.model.createMessage },
    { key: "elicitInput", ready: capabilities.model.elicitInput },
    { key: "listCatalog", ready: listCatalogReady },
  ];
}

export function createExecutionId(): string {
  return `webmcp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function formatExecutionTime(at: number): string {
  return new Date(at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatExecutionDuration(durationMs: number): string {
  return `${Math.max(0, durationMs)}ms`;
}

export function summarizeResult(value: unknown): string {
  if (value === null || value === undefined) {
    return "Empty result";
  }
  if (typeof value === "string") {
    return value.length <= 60 ? value : `${value.slice(0, 57)}...`;
  }
  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>);
    return keys.length > 0 ? `Keys: ${keys.slice(0, 4).join(", ")}` : "Object result";
  }
  return String(value);
}

export function getActionLabel(action: ExecutionAction): string {
  if (action === "tool") {
    return "tool call";
  }
  if (action === "createMessage") {
    return "createMessage";
  }
  return "elicitInput";
}

export async function maybeConfirmExecution(
  autoExecuteCalls: boolean,
  label: string
): Promise<boolean> {
  if (autoExecuteCalls) {
    return true;
  }
  if (typeof window === "undefined" || typeof window.confirm !== "function") {
    return false;
  }
  return window.confirm(`Execute WebMCP call: ${label}?`);
}

export const RUNTIME_METRICS_UNAVAILABLE_CODE = "runtime.validation.metrics.unavailable";

const RUNTIME_EXECUTION_FIX_HINTS_BY_CODE: Record<string, string[]> = {
  "runtime.validation.path.outside_workspace": [
    "Use workspace-relative paths like `src/index.ts`.",
    "Remove absolute prefixes and `..` segments from the path.",
  ],
  "runtime.validation.payload.too_large": [
    "Reduce payload size and retry with smaller chunks.",
    "Split large write/edit operations into multiple tool calls.",
  ],
  "runtime.validation.payload_too_large": [
    "Reduce payload size and retry with smaller chunks.",
    "Split large write/edit operations into multiple tool calls.",
  ],
  "runtime.validation.circuit_open": [
    "Inspect `get-runtime-tool-execution-metrics` and resolve top failed tools first.",
    "Wait for cooldown or recover success rate before retrying this tool.",
  ],
  "runtime.validation.rate_limited": [
    "Slow down repeated `computer_observe` requests in the same workspace.",
    "Batch or dedupe repeated observe probes within one minute.",
  ],
  "runtime.validation.metrics_unhealthy": [
    "Ensure runtime metrics channel is healthy before running write/runtime tools.",
    "Run diagnostics tool to confirm metrics endpoint availability.",
  ],
  "runtime.validation.command.restricted": [
    "Use non-destructive workspace-scoped commands.",
    "For orchestration, use runtime sub-agent tools instead of shell commands.",
  ],
  [RUNTIME_METRICS_UNAVAILABLE_CODE]: [
    "Ensure desktop runtime or runtime gateway is reachable.",
    "Run `get-runtime-tool-execution-metrics` to verify metrics channel recovery.",
  ],
};

export function extractRuntimeErrorCode(error: unknown, message: string): string | null {
  if (error && typeof error === "object") {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && code.trim().length > 0) {
      return code.trim();
    }
  }
  const match = message.match(/Request failed \(([^)]+)\)\.?/);
  if (!match) {
    return null;
  }
  const code = match[1]?.trim();
  return code ? code : null;
}

export function resolveExecutionFixHints(error: unknown, message: string): string[] {
  const code = extractRuntimeErrorCode(error, message);
  const baseHints = code ? (RUNTIME_EXECUTION_FIX_HINTS_BY_CODE[code] ?? []) : [];
  const effectiveLimits = extractRuntimeGuardrailEffectiveLimits(message);
  if (!effectiveLimits) {
    return baseHints;
  }
  return [
    ...baseHints,
    `Current effective limits: payload<=${effectiveLimits.payloadLimitBytes}B, computer_observe<=${effectiveLimits.computerObserveRateLimitPerMinute}/min.`,
  ];
}

export function extractRuntimeGuardrailEffectiveLimits(
  message: string
): RuntimeGuardrailEffectiveLimits | null {
  const match = message.match(
    /effective limits:\s*payload<=([0-9]+)B,\s*computer_observe<=([0-9]+)\/min/i
  );
  if (!match) {
    return null;
  }
  const payloadLimitBytes = Number.parseInt(match[1] ?? "", 10);
  const computerObserveRateLimitPerMinute = Number.parseInt(match[2] ?? "", 10);
  if (
    !Number.isFinite(payloadLimitBytes) ||
    payloadLimitBytes < 0 ||
    !Number.isFinite(computerObserveRateLimitPerMinute) ||
    computerObserveRateLimitPerMinute < 0
  ) {
    return null;
  }
  return {
    payloadLimitBytes,
    computerObserveRateLimitPerMinute,
  };
}

export function resolveToolExecutionDryRun(input: unknown, response: unknown): boolean {
  const inputRecord = asRecord(input);
  if (inputRecord?.dryRun === true) {
    return true;
  }
  const responseRecord = asRecord(response);
  const responseMessage =
    typeof responseRecord?.message === "string" ? responseRecord.message.toLowerCase() : "";
  if (responseMessage.includes("dry-run")) {
    return true;
  }
  const responseData = asRecord(responseRecord?.data);
  const responseResult = asRecord(responseData?.result);
  const responseMetadata = asRecord(responseResult?.metadata);
  return responseMetadata?.dryRun === true;
}

type JsonRecord = Record<string, unknown>;

type RuntimeToolExecutionTotalsSnapshot = {
  attemptedTotal: number;
  startedTotal: number;
  completedTotal: number;
  successTotal: number;
  validationFailedTotal: number;
  runtimeFailedTotal: number;
  timeoutTotal: number;
  blockedTotal: number;
};

type RuntimeToolExecutionByToolSnapshot = RuntimeToolExecutionTotalsSnapshot & {
  toolName: string;
  scope: "write" | "runtime" | "computer_observe";
};

export type RuntimeToolExecutionMetricsSnapshot = {
  totals: RuntimeToolExecutionTotalsSnapshot;
  byTool: Record<string, RuntimeToolExecutionByToolSnapshot>;
  updatedAt: number;
  windowSize: number;
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

export type RuntimeToolExecutionMetricsSummary = {
  overallSuccessRate: number | null;
  blockedTotal: number;
  windowSize: number | null;
  updatedAt: number | null;
  scopeSuccessRates: Array<{
    scope: "write" | "runtime" | "computer_observe";
    successRate: number | null;
    blockedTotal: number;
  }>;
  topFailedTools: Array<{
    toolName: string;
    scope: "write" | "runtime" | "computer_observe";
    failures: number;
    blockedTotal: number;
  }>;
  effectiveLimitsByProfile: RuntimeToolExecutionMetricsSnapshot["effectiveLimitsByProfile"];
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" ? (value as JsonRecord) : null;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function asOptionalFiniteNonNegativeNumber(value: unknown): number | null {
  const parsed = asFiniteNumber(value);
  if (parsed === null) {
    return null;
  }
  return parsed >= 0 ? parsed : null;
}

function readEffectiveLimitsByProfile(
  value: unknown
): RuntimeToolExecutionMetricsSnapshot["effectiveLimitsByProfile"] {
  const record = asRecord(value);
  const defaultRecord = asRecord(record?.default);
  const soloMaxRecord = asRecord(record?.soloMax);
  return {
    default: {
      payloadLimitBytes: asOptionalFiniteNonNegativeNumber(defaultRecord?.payloadLimitBytes),
      computerObserveRateLimitPerMinute: asOptionalFiniteNonNegativeNumber(
        defaultRecord?.computerObserveRateLimitPerMinute
      ),
    },
    soloMax: {
      payloadLimitBytes: asOptionalFiniteNonNegativeNumber(soloMaxRecord?.payloadLimitBytes),
      computerObserveRateLimitPerMinute: asOptionalFiniteNonNegativeNumber(
        soloMaxRecord?.computerObserveRateLimitPerMinute
      ),
    },
  };
}

function toTotalsSnapshot(value: unknown): RuntimeToolExecutionTotalsSnapshot | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  const attemptedTotal = asFiniteNumber(record.attemptedTotal);
  const startedTotal = asFiniteNumber(record.startedTotal);
  const completedTotal = asFiniteNumber(record.completedTotal);
  const successTotal = asFiniteNumber(record.successTotal);
  const validationFailedTotal = asFiniteNumber(record.validationFailedTotal);
  const runtimeFailedTotal = asFiniteNumber(record.runtimeFailedTotal);
  const timeoutTotal = asFiniteNumber(record.timeoutTotal);
  const blockedTotal = asFiniteNumber(record.blockedTotal);
  if (
    attemptedTotal === null ||
    startedTotal === null ||
    completedTotal === null ||
    successTotal === null ||
    validationFailedTotal === null ||
    runtimeFailedTotal === null ||
    timeoutTotal === null ||
    blockedTotal === null
  ) {
    return null;
  }
  return {
    attemptedTotal,
    startedTotal,
    completedTotal,
    successTotal,
    validationFailedTotal,
    runtimeFailedTotal,
    timeoutTotal,
    blockedTotal,
  };
}

function toScope(value: unknown): "write" | "runtime" | "computer_observe" | null {
  if (value === "write" || value === "runtime" || value === "computer_observe") {
    return value;
  }
  return null;
}

function toByToolSnapshot(value: unknown): Record<string, RuntimeToolExecutionByToolSnapshot> {
  const record = asRecord(value);
  if (!record) {
    return {};
  }
  const byTool: Record<string, RuntimeToolExecutionByToolSnapshot> = {};
  for (const [key, entry] of Object.entries(record)) {
    const totals = toTotalsSnapshot(entry);
    const entryRecord = asRecord(entry);
    const toolName =
      entryRecord && typeof entryRecord.toolName === "string" ? entryRecord.toolName.trim() : "";
    const scope = toScope(entryRecord?.scope);
    if (!totals || toolName.length === 0 || scope === null) {
      continue;
    }
    byTool[key] = {
      ...totals,
      toolName,
      scope,
    };
  }
  return byTool;
}

export function extractRuntimeToolExecutionMetricsSnapshot(
  response: unknown
): RuntimeToolExecutionMetricsSnapshot | null {
  const payload = asRecord(response);
  const data = asRecord(payload?.data);
  const metrics = asRecord(data?.metrics);
  const metricsSummary = asRecord(data?.metricsSummary);
  if (!metrics) {
    return null;
  }
  const totals = toTotalsSnapshot(metrics.totals);
  const updatedAt = asFiniteNumber(metrics.updatedAt);
  const windowSize = asFiniteNumber(metrics.windowSize);
  if (!totals || updatedAt === null || windowSize === null) {
    return null;
  }
  return {
    totals,
    byTool: toByToolSnapshot(metrics.byTool),
    updatedAt,
    windowSize,
    effectiveLimitsByProfile: readEffectiveLimitsByProfile(
      metricsSummary?.effectiveLimitsByProfile
    ),
  };
}

export function extractRuntimeToolExecutionDiagnosticsPayload(
  response: unknown
): { metrics: unknown; guardrails: unknown } | null {
  const payload = asRecord(response);
  const data = asRecord(payload?.data);
  if (!data) {
    return null;
  }
  return {
    metrics: data.metrics ?? null,
    guardrails: data.guardrails ?? null,
  };
}

function computeSuccessRate(input: {
  successTotal: number;
  validationFailedTotal: number;
  runtimeFailedTotal: number;
  timeoutTotal: number;
}): number | null {
  const denominator =
    input.successTotal +
    input.validationFailedTotal +
    input.runtimeFailedTotal +
    input.timeoutTotal;
  if (denominator <= 0) {
    return null;
  }
  return input.successTotal / denominator;
}

export function summarizeRuntimeToolExecutionMetrics(
  snapshot: RuntimeToolExecutionMetricsSnapshot | null
): RuntimeToolExecutionMetricsSummary {
  if (!snapshot) {
    return {
      overallSuccessRate: null,
      blockedTotal: 0,
      windowSize: null,
      updatedAt: null,
      scopeSuccessRates: [
        { scope: "write", successRate: null, blockedTotal: 0 },
        { scope: "runtime", successRate: null, blockedTotal: 0 },
        { scope: "computer_observe", successRate: null, blockedTotal: 0 },
      ],
      topFailedTools: [],
      effectiveLimitsByProfile: {
        default: {
          payloadLimitBytes: null,
          computerObserveRateLimitPerMinute: null,
        },
        soloMax: {
          payloadLimitBytes: null,
          computerObserveRateLimitPerMinute: null,
        },
      },
    };
  }

  const scopeTotals: Record<
    "write" | "runtime" | "computer_observe",
    RuntimeToolExecutionTotalsSnapshot
  > = {
    write: {
      attemptedTotal: 0,
      startedTotal: 0,
      completedTotal: 0,
      successTotal: 0,
      validationFailedTotal: 0,
      runtimeFailedTotal: 0,
      timeoutTotal: 0,
      blockedTotal: 0,
    },
    runtime: {
      attemptedTotal: 0,
      startedTotal: 0,
      completedTotal: 0,
      successTotal: 0,
      validationFailedTotal: 0,
      runtimeFailedTotal: 0,
      timeoutTotal: 0,
      blockedTotal: 0,
    },
    computer_observe: {
      attemptedTotal: 0,
      startedTotal: 0,
      completedTotal: 0,
      successTotal: 0,
      validationFailedTotal: 0,
      runtimeFailedTotal: 0,
      timeoutTotal: 0,
      blockedTotal: 0,
    },
  };

  for (const entry of Object.values(snapshot.byTool)) {
    const scopeTotalsEntry = scopeTotals[entry.scope];
    scopeTotalsEntry.attemptedTotal += entry.attemptedTotal;
    scopeTotalsEntry.startedTotal += entry.startedTotal;
    scopeTotalsEntry.completedTotal += entry.completedTotal;
    scopeTotalsEntry.successTotal += entry.successTotal;
    scopeTotalsEntry.validationFailedTotal += entry.validationFailedTotal;
    scopeTotalsEntry.runtimeFailedTotal += entry.runtimeFailedTotal;
    scopeTotalsEntry.timeoutTotal += entry.timeoutTotal;
    scopeTotalsEntry.blockedTotal += entry.blockedTotal;
  }

  const topFailedTools = Object.values(snapshot.byTool)
    .map((entry) => ({
      toolName: entry.toolName,
      scope: entry.scope,
      failures: entry.validationFailedTotal + entry.runtimeFailedTotal + entry.timeoutTotal,
      blockedTotal: entry.blockedTotal,
    }))
    .filter((entry) => entry.failures > 0 || entry.blockedTotal > 0)
    .sort((left, right) => {
      if (right.failures !== left.failures) {
        return right.failures - left.failures;
      }
      if (right.blockedTotal !== left.blockedTotal) {
        return right.blockedTotal - left.blockedTotal;
      }
      return left.toolName.localeCompare(right.toolName);
    })
    .slice(0, 5);

  return {
    overallSuccessRate: computeSuccessRate(snapshot.totals),
    blockedTotal: snapshot.totals.blockedTotal,
    windowSize: snapshot.windowSize,
    updatedAt: snapshot.updatedAt,
    scopeSuccessRates: [
      {
        scope: "write",
        successRate: computeSuccessRate(scopeTotals.write),
        blockedTotal: scopeTotals.write.blockedTotal,
      },
      {
        scope: "runtime",
        successRate: computeSuccessRate(scopeTotals.runtime),
        blockedTotal: scopeTotals.runtime.blockedTotal,
      },
      {
        scope: "computer_observe",
        successRate: computeSuccessRate(scopeTotals.computer_observe),
        blockedTotal: scopeTotals.computer_observe.blockedTotal,
      },
    ],
    topFailedTools,
    effectiveLimitsByProfile: snapshot.effectiveLimitsByProfile,
  };
}

export function formatSuccessRate(rate: number | null): string {
  if (rate === null) {
    return "n/a";
  }
  return `${(rate * 100).toFixed(1)}%`;
}
