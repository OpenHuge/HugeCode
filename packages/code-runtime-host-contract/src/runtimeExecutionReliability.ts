import type {
  RuntimeToolExecutionChannelHealth,
  RuntimeToolExecutionCircuitBreakerEntry,
  RuntimeToolExecutionMetricsSnapshot,
  RuntimeToolGuardrailStateSnapshot,
} from "./code-runtime-rpc/runtimeLiveSkillsAndTooling.js";

export const DEFAULT_RUNTIME_EXECUTION_SUCCESS_MIN_RATE = 0.95;

export type RuntimeExecutionReliabilityState = "ready" | "attention" | "blocked";

export type RuntimeExecutionReliabilityGate = {
  minSuccessRate: number;
  successRate: number | null;
  denominator: number;
  passed: boolean | null;
};

export type RuntimeExecutionReliabilityChannel = {
  status: "healthy" | "degraded" | "unavailable" | "unknown";
  reason: string | null;
  lastErrorCode: string | null;
  updatedAt: number | null;
  source: "guardrails" | "metrics" | "unavailable";
};

export type RuntimeExecutionReliabilityCircuitBreaker = {
  scope: "write" | "runtime" | "computer_observe";
  state: "closed" | "open" | "half_open";
  openedAt: number | null;
  updatedAt: number | null;
};

export type RuntimeExecutionReliabilitySummary = {
  state: RuntimeExecutionReliabilityState;
  blockingReason: string | null;
  recommendedAction: string;
  gate: RuntimeExecutionReliabilityGate;
  channelHealth: RuntimeExecutionReliabilityChannel;
  blockedTotal: number;
  topFailedReason: string | null;
  circuitBreakers: RuntimeExecutionReliabilityCircuitBreaker[];
};

type BuildRuntimeExecutionReliabilityOptions = {
  metrics: unknown;
  guardrails: unknown;
  minSuccessRate?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isChannelHealth(value: unknown): value is RuntimeToolExecutionChannelHealth {
  if (!isRecord(value)) {
    return false;
  }
  return (
    value.status === "healthy" || value.status === "degraded" || value.status === "unavailable"
  );
}

function isCircuitBreakerEntry(value: unknown): value is RuntimeToolExecutionCircuitBreakerEntry {
  if (!isRecord(value)) {
    return false;
  }
  return (
    (value.scope === "write" || value.scope === "runtime" || value.scope === "computer_observe") &&
    (value.state === "closed" || value.state === "open" || value.state === "half_open") &&
    asFiniteNumber(value.updatedAt) !== null
  );
}

function isMetricsSnapshot(value: unknown): value is RuntimeToolExecutionMetricsSnapshot {
  if (!isRecord(value) || !isRecord(value.totals) || !isChannelHealth(value.channelHealth)) {
    return false;
  }
  const totals = value.totals as Record<string, unknown>;
  return (
    asFiniteNumber(totals.successTotal) !== null &&
    asFiniteNumber(totals.validationFailedTotal) !== null &&
    asFiniteNumber(totals.runtimeFailedTotal) !== null &&
    asFiniteNumber(totals.timeoutTotal) !== null &&
    asFiniteNumber(totals.blockedTotal) !== null &&
    Array.isArray(value.circuitBreakers)
  );
}

function isGuardrailSnapshot(value: unknown): value is RuntimeToolGuardrailStateSnapshot {
  if (!isRecord(value) || !isChannelHealth(value.channelHealth)) {
    return false;
  }
  return (
    asFiniteNumber(value.payloadLimitBytes) !== null &&
    asFiniteNumber(value.computerObserveRateLimitPerMinute) !== null &&
    Array.isArray(value.circuitBreakers)
  );
}

function computeGate(
  metrics: RuntimeToolExecutionMetricsSnapshot | null,
  minSuccessRate: number
): RuntimeExecutionReliabilityGate {
  const totals = metrics?.totals;
  const successTotal = totals?.successTotal ?? 0;
  const validationFailedTotal = totals?.validationFailedTotal ?? 0;
  const runtimeFailedTotal = totals?.runtimeFailedTotal ?? 0;
  const timeoutTotal = totals?.timeoutTotal ?? 0;
  const denominator = successTotal + validationFailedTotal + runtimeFailedTotal + timeoutTotal;
  if (denominator <= 0) {
    return {
      minSuccessRate,
      successRate: null,
      denominator,
      passed: null,
    };
  }
  const successRate = successTotal / denominator;
  return {
    minSuccessRate,
    successRate,
    denominator,
    passed: successRate >= minSuccessRate,
  };
}

function normalizeChannelHealth(input: {
  metrics: RuntimeToolExecutionMetricsSnapshot | null;
  guardrails: RuntimeToolGuardrailStateSnapshot | null;
}): RuntimeExecutionReliabilityChannel {
  const guardrailsChannel = input.guardrails?.channelHealth;
  const metricsChannel = input.metrics?.channelHealth;
  const candidates: RuntimeExecutionReliabilityChannel[] = [];
  if (guardrailsChannel) {
    candidates.push({
      status: guardrailsChannel.status,
      reason: asString(guardrailsChannel.reason),
      lastErrorCode: asString(guardrailsChannel.lastErrorCode),
      updatedAt: asFiniteNumber(guardrailsChannel.updatedAt),
      source: "guardrails",
    });
  }
  if (metricsChannel) {
    candidates.push({
      status: metricsChannel.status,
      reason: asString(metricsChannel.reason),
      lastErrorCode: asString(metricsChannel.lastErrorCode),
      updatedAt: asFiniteNumber(metricsChannel.updatedAt),
      source: "metrics",
    });
  }
  if (candidates.length > 0) {
    const rank = (status: RuntimeExecutionReliabilityChannel["status"]) =>
      status === "unavailable" ? 3 : status === "degraded" ? 2 : status === "healthy" ? 1 : 0;
    return candidates.sort((left, right) => rank(right.status) - rank(left.status))[0];
  }
  return {
    status: "unknown",
    reason: "Runtime execution reliability diagnostics are unavailable.",
    lastErrorCode: null,
    updatedAt: null,
    source: "unavailable",
  };
}

function normalizeCircuitBreakers(input: {
  metrics: RuntimeToolExecutionMetricsSnapshot | null;
  guardrails: RuntimeToolGuardrailStateSnapshot | null;
}): RuntimeExecutionReliabilityCircuitBreaker[] {
  const source =
    input.guardrails?.circuitBreakers && input.guardrails.circuitBreakers.length > 0
      ? input.guardrails.circuitBreakers
      : (input.metrics?.circuitBreakers ?? []);
  return source.filter(isCircuitBreakerEntry).map((entry) => ({
    scope: entry.scope,
    state: entry.state,
    openedAt: entry.openedAt,
    updatedAt: entry.updatedAt,
  }));
}

function readTopFailedReason(metrics: RuntimeToolExecutionMetricsSnapshot | null): string | null {
  const first = Array.isArray(metrics?.errorCodeTopK) ? metrics.errorCodeTopK[0] : null;
  if (!first || !isRecord(first)) {
    return null;
  }
  const errorCode = asString(first.errorCode);
  const count = asFiniteNumber(first.count);
  if (!errorCode || count === null) {
    return null;
  }
  return `${errorCode} (${count})`;
}

function formatSuccessRate(successRate: number | null): string {
  if (successRate === null) {
    return "n/a";
  }
  return `${(successRate * 100).toFixed(1)}%`;
}

export function buildRuntimeExecutionReliability({
  metrics,
  guardrails,
  minSuccessRate = DEFAULT_RUNTIME_EXECUTION_SUCCESS_MIN_RATE,
}: BuildRuntimeExecutionReliabilityOptions): RuntimeExecutionReliabilitySummary {
  const normalizedMetrics = isMetricsSnapshot(metrics) ? metrics : null;
  const normalizedGuardrails = isGuardrailSnapshot(guardrails) ? guardrails : null;
  const gate = computeGate(normalizedMetrics, minSuccessRate);
  const channelHealth = normalizeChannelHealth({
    metrics: normalizedMetrics,
    guardrails: normalizedGuardrails,
  });
  const circuitBreakers = normalizeCircuitBreakers({
    metrics: normalizedMetrics,
    guardrails: normalizedGuardrails,
  });
  const blockedTotal = normalizedMetrics?.totals.blockedTotal ?? 0;
  const topFailedReason = readTopFailedReason(normalizedMetrics);
  const openCircuitBreaker = circuitBreakers.find((entry) => entry.state === "open") ?? null;
  const failedCount =
    (normalizedMetrics?.totals.validationFailedTotal ?? 0) +
    (normalizedMetrics?.totals.runtimeFailedTotal ?? 0) +
    (normalizedMetrics?.totals.timeoutTotal ?? 0);

  if (channelHealth.status === "unavailable") {
    return {
      state: "blocked",
      blockingReason:
        channelHealth.reason ??
        "Runtime execution reliability diagnostics are unavailable or unhealthy.",
      recommendedAction:
        "Restore runtime diagnostics or reconnect to the runtime tool metrics channel before launching.",
      gate,
      channelHealth,
      blockedTotal,
      topFailedReason,
      circuitBreakers,
    };
  }

  if (openCircuitBreaker) {
    return {
      state: "blocked",
      blockingReason: `The ${openCircuitBreaker.scope} runtime tool circuit breaker is open.`,
      recommendedAction: "Wait for the runtime tool circuit breaker to close before launching.",
      gate,
      channelHealth,
      blockedTotal,
      topFailedReason,
      circuitBreakers,
    };
  }

  if (gate.passed === false) {
    return {
      state: "blocked",
      blockingReason: `Runtime tool success rate is ${formatSuccessRate(gate.successRate)}, below the ${formatSuccessRate(gate.minSuccessRate)} launch threshold.`,
      recommendedAction:
        "Inspect runtime tool metrics and recover top failed tools before launching.",
      gate,
      channelHealth,
      blockedTotal,
      topFailedReason,
      circuitBreakers,
    };
  }

  if (channelHealth.status === "degraded") {
    return {
      state: "attention",
      blockingReason: null,
      recommendedAction:
        "Inspect runtime tool metrics and recover top failed tools before launching.",
      gate,
      channelHealth,
      blockedTotal,
      topFailedReason,
      circuitBreakers,
    };
  }

  if (!normalizedMetrics || !normalizedGuardrails) {
    return {
      state: "attention",
      blockingReason: null,
      recommendedAction:
        "Runtime execution reliability could not be fully confirmed. Inspect diagnostics before launching.",
      gate,
      channelHealth,
      blockedTotal,
      topFailedReason,
      circuitBreakers,
    };
  }

  if (failedCount > 0 || blockedTotal > 0) {
    return {
      state: "attention",
      blockingReason: null,
      recommendedAction:
        "Inspect runtime tool metrics and recover top failed tools before launching.",
      gate,
      channelHealth,
      blockedTotal,
      topFailedReason,
      circuitBreakers,
    };
  }

  return {
    state: "ready",
    blockingReason: null,
    recommendedAction: "Runtime execution reliability looks healthy for another launch.",
    gate,
    channelHealth,
    blockedTotal,
    topFailedReason,
    circuitBreakers,
  };
}
