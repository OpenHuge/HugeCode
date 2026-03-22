import { canonicalizeModelProvider } from "@ku0/code-runtime-host-contract/codeRuntimeRpcCompat";

export type RuntimeExecutionProvider = "openai" | "anthropic" | "google" | "local" | "unknown";

export type RuntimeExecutionPolicyReasonCode =
  | "requested-sequential"
  | "single-task"
  | "approval-sensitive-tasks"
  | "provider-allows-parallelism"
  | "provider-capped-parallelism"
  | "provider-unknown-defaults-to-parallel"
  | "provider-unsupported-for-parallel"
  | "network-disabled-by-risk-policy"
  | "no-freshness-signal"
  | "research-search-content"
  | "research-search-only";

export type RuntimeSubAgentBatchPolicyDecision = {
  provider: RuntimeExecutionProvider;
  requestedExecutionMode: "parallel" | "sequential";
  requestedMaxParallel: number | null;
  effectiveExecutionMode: "parallel" | "sequential";
  effectiveMaxParallel: number;
  parallelToolCallsAllowed: boolean;
  reasonCodes: RuntimeExecutionPolicyReasonCode[];
};

export type AutoDriveExternalResearchPolicyDecision = {
  provider: RuntimeExecutionProvider;
  enabled: boolean;
  strategy: "disabled" | "search-only" | "search+content";
  fetchPageContent: boolean;
  query: string | null;
  recencyDays: number | null;
  reasonCodes: RuntimeExecutionPolicyReasonCode[];
};

const DEFAULT_MAX_PARALLEL = 6;
const ANTHROPIC_MAX_PARALLEL = 2;
const MIN_MAX_PARALLEL = 1;
const MAX_MAX_PARALLEL = 6;
const FRESHNESS_SIGNAL_PATTERN =
  /(latest|upstream|framework|api|sdk|standard|docs|documentation|version|dependency|release|changelog|breaking)/i;

function clampMaxParallel(value: number): number {
  return Math.min(MAX_MAX_PARALLEL, Math.max(MIN_MAX_PARALLEL, value));
}

function normalizeRequestedMaxParallel(value: number | null): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_MAX_PARALLEL;
  }
  return clampMaxParallel(Math.trunc(value));
}

function inferProviderFromModelId(
  modelId: string | null | undefined
): RuntimeExecutionProvider | null {
  const normalized = modelId?.trim().toLowerCase() ?? "";
  if (!normalized) {
    return null;
  }
  if (
    normalized.startsWith("gpt-") ||
    normalized.startsWith("o1") ||
    normalized.startsWith("o3") ||
    normalized.startsWith("o4") ||
    normalized.includes("codex")
  ) {
    return "openai";
  }
  if (normalized.includes("claude")) {
    return "anthropic";
  }
  if (normalized.includes("gemini")) {
    return "google";
  }
  if (normalized.includes("local")) {
    return "local";
  }
  return null;
}

export function normalizeRuntimeExecutionProvider(input: {
  provider?: string | null;
  modelId?: string | null;
}): RuntimeExecutionProvider {
  const canonicalProvider = canonicalizeModelProvider(input.provider ?? null);
  if (
    canonicalProvider === "openai" ||
    canonicalProvider === "anthropic" ||
    canonicalProvider === "google"
  ) {
    return canonicalProvider;
  }
  if (canonicalProvider === "local") {
    return "local";
  }
  const inferredProvider = inferProviderFromModelId(input.modelId);
  return inferredProvider ?? "unknown";
}

export function resolveRuntimeSubAgentBatchPolicy(input: {
  provider?: string | null;
  modelId?: string | null;
  requestedExecutionMode: "parallel" | "sequential";
  requestedMaxParallel: number | null;
  taskCount: number;
  hasApprovalSensitiveTasks: boolean;
}): RuntimeSubAgentBatchPolicyDecision {
  const provider = normalizeRuntimeExecutionProvider(input);
  const requestedMaxParallel = input.requestedMaxParallel;
  const normalizedRequestedMaxParallel = normalizeRequestedMaxParallel(requestedMaxParallel);
  const reasonCodes: RuntimeExecutionPolicyReasonCode[] = [];

  if (input.requestedExecutionMode === "sequential") {
    reasonCodes.push("requested-sequential");
    return {
      provider,
      requestedExecutionMode: input.requestedExecutionMode,
      requestedMaxParallel,
      effectiveExecutionMode: "sequential",
      effectiveMaxParallel: 1,
      parallelToolCallsAllowed: false,
      reasonCodes,
    };
  }

  if (input.hasApprovalSensitiveTasks) {
    reasonCodes.push("approval-sensitive-tasks");
    return {
      provider,
      requestedExecutionMode: input.requestedExecutionMode,
      requestedMaxParallel,
      effectiveExecutionMode: "sequential",
      effectiveMaxParallel: 1,
      parallelToolCallsAllowed: false,
      reasonCodes,
    };
  }

  if (provider === "anthropic") {
    reasonCodes.push("provider-capped-parallelism");
    return {
      provider,
      requestedExecutionMode: input.requestedExecutionMode,
      requestedMaxParallel,
      effectiveExecutionMode: "parallel",
      effectiveMaxParallel: Math.min(normalizedRequestedMaxParallel, ANTHROPIC_MAX_PARALLEL),
      parallelToolCallsAllowed: true,
      reasonCodes,
    };
  }

  if (provider === "local") {
    reasonCodes.push("provider-unsupported-for-parallel");
    return {
      provider,
      requestedExecutionMode: input.requestedExecutionMode,
      requestedMaxParallel,
      effectiveExecutionMode: "sequential",
      effectiveMaxParallel: 1,
      parallelToolCallsAllowed: false,
      reasonCodes,
    };
  }

  if (provider === "unknown") {
    reasonCodes.push("provider-unknown-defaults-to-parallel");
    return {
      provider,
      requestedExecutionMode: input.requestedExecutionMode,
      requestedMaxParallel,
      effectiveExecutionMode: "parallel",
      effectiveMaxParallel: normalizedRequestedMaxParallel,
      parallelToolCallsAllowed: true,
      reasonCodes,
    };
  }

  reasonCodes.push("provider-allows-parallelism");
  return {
    provider,
    requestedExecutionMode: input.requestedExecutionMode,
    requestedMaxParallel,
    effectiveExecutionMode: "parallel",
    effectiveMaxParallel: normalizedRequestedMaxParallel,
    parallelToolCallsAllowed: true,
    reasonCodes,
  };
}

export function resolveAutoDriveExternalResearchPolicy(input: {
  allowNetworkAnalysis: boolean;
  provider?: string | null;
  modelId?: string | null;
  destinationTitle: string;
  desiredEndState: string[];
  arrivalCriteria: string[];
  hardBoundaries: string[];
  previousSummaryText?: string | null;
}): AutoDriveExternalResearchPolicyDecision {
  const provider = normalizeRuntimeExecutionProvider(input);
  const sourceText = [
    input.destinationTitle,
    ...input.desiredEndState,
    ...input.arrivalCriteria,
    ...input.hardBoundaries,
    input.previousSummaryText ?? "",
  ].join("\n");

  if (!input.allowNetworkAnalysis) {
    return {
      provider,
      enabled: false,
      strategy: "disabled",
      fetchPageContent: false,
      query: null,
      recencyDays: null,
      reasonCodes: ["network-disabled-by-risk-policy"],
    };
  }

  if (!FRESHNESS_SIGNAL_PATTERN.test(sourceText)) {
    return {
      provider,
      enabled: false,
      strategy: "disabled",
      fetchPageContent: false,
      query: null,
      recencyDays: null,
      reasonCodes: ["no-freshness-signal"],
    };
  }

  const strategy =
    provider === "openai" || provider === "google" ? "search+content" : "search-only";
  return {
    provider,
    enabled: true,
    strategy,
    fetchPageContent: strategy === "search+content",
    query: `${input.destinationTitle} relevant framework or API guidance`,
    recencyDays: 30,
    reasonCodes: [
      strategy === "search+content" ? "research-search-content" : "research-search-only",
    ],
  };
}
