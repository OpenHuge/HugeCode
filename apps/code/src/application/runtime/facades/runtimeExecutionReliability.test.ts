import { describe, expect, it } from "vitest";
import {
  buildRuntimeExecutionReliability,
  DEFAULT_RUNTIME_EXECUTION_SUCCESS_MIN_RATE,
} from "./runtimeExecutionReliability";

function buildMetricsSnapshot(
  overrides: Partial<Record<string, unknown>> = {}
): Record<string, unknown> {
  return {
    totals: {
      attemptedTotal: 12,
      startedTotal: 12,
      completedTotal: 12,
      successTotal: 12,
      validationFailedTotal: 0,
      runtimeFailedTotal: 0,
      timeoutTotal: 0,
      blockedTotal: 0,
    },
    byTool: {},
    recent: [],
    updatedAt: 1_700_000_000_000,
    windowSize: 500,
    channelHealth: {
      status: "healthy",
      reason: null,
      lastErrorCode: null,
      updatedAt: 1_700_000_000_000,
    },
    scopeRates: [],
    errorCodeTopK: [],
    circuitBreakers: [],
    ...overrides,
  };
}

function buildGuardrailSnapshot(
  overrides: Partial<Record<string, unknown>> = {}
): Record<string, unknown> {
  return {
    payloadLimitBytes: 65_536,
    computerObserveRateLimitPerMinute: 12,
    channelHealth: {
      status: "healthy",
      reason: null,
      lastErrorCode: null,
      updatedAt: 1_700_000_000_000,
    },
    circuitBreakers: [],
    ...overrides,
  };
}

describe("buildRuntimeExecutionReliability", () => {
  it("blocks when the metrics channel is unavailable", () => {
    const summary = buildRuntimeExecutionReliability({
      metrics: buildMetricsSnapshot({
        channelHealth: {
          status: "unavailable",
          reason: "Metrics store unavailable.",
          lastErrorCode: "runtime.validation.metrics.unavailable",
          updatedAt: 1_700_000_000_000,
        },
      }),
      guardrails: buildGuardrailSnapshot(),
    });

    expect(summary.state).toBe("blocked");
    expect(summary.blockingReason).toContain("Metrics store unavailable");
    expect(summary.channelHealth.status).toBe("unavailable");
    expect(summary.gate.passed).toBe(true);
  });

  it("keeps launch at attention when channel health is degraded but the gate passes", () => {
    const summary = buildRuntimeExecutionReliability({
      metrics: buildMetricsSnapshot({
        channelHealth: {
          status: "degraded",
          reason: "Recent runtime tool failures elevated guardrail pressure.",
          lastErrorCode: "runtime.validation.metrics_unhealthy",
          updatedAt: 1_700_000_000_000,
        },
      }),
      guardrails: buildGuardrailSnapshot(),
    });

    expect(summary.state).toBe("attention");
    expect(summary.blockingReason).toBeNull();
    expect(summary.channelHealth.status).toBe("degraded");
    expect(summary.recommendedAction).toContain("Inspect runtime tool metrics");
  });

  it("blocks when the overall success gate fails", () => {
    const summary = buildRuntimeExecutionReliability({
      metrics: buildMetricsSnapshot({
        totals: {
          attemptedTotal: 20,
          startedTotal: 20,
          completedTotal: 20,
          successTotal: 16,
          validationFailedTotal: 1,
          runtimeFailedTotal: 2,
          timeoutTotal: 1,
          blockedTotal: 1,
        },
        errorCodeTopK: [{ errorCode: "REQUEST_TIMEOUT", count: 1 }],
      }),
      guardrails: buildGuardrailSnapshot(),
    });

    expect(summary.state).toBe("blocked");
    expect(summary.gate.minSuccessRate).toBe(DEFAULT_RUNTIME_EXECUTION_SUCCESS_MIN_RATE);
    expect(summary.gate.successRate).toBe(0.8);
    expect(summary.gate.passed).toBe(false);
    expect(summary.blockingReason).toContain("80.0%");
  });

  it("blocks when any circuit breaker is open", () => {
    const summary = buildRuntimeExecutionReliability({
      metrics: buildMetricsSnapshot(),
      guardrails: buildGuardrailSnapshot({
        circuitBreakers: [
          {
            scope: "runtime",
            state: "open",
            openedAt: 1_700_000_000_000,
            updatedAt: 1_700_000_000_000,
          },
        ],
      }),
    });

    expect(summary.state).toBe("blocked");
    expect(summary.blockingReason).toContain("circuit breaker");
    expect(summary.circuitBreakers.some((entry) => entry.state === "open")).toBe(true);
  });

  it("does not block when there is no success-rate denominator but the channel is healthy", () => {
    const summary = buildRuntimeExecutionReliability({
      metrics: buildMetricsSnapshot({
        totals: {
          attemptedTotal: 0,
          startedTotal: 0,
          completedTotal: 0,
          successTotal: 0,
          validationFailedTotal: 0,
          runtimeFailedTotal: 0,
          timeoutTotal: 0,
          blockedTotal: 0,
        },
      }),
      guardrails: buildGuardrailSnapshot(),
    });

    expect(summary.state).toBe("ready");
    expect(summary.blockingReason).toBeNull();
    expect(summary.gate.successRate).toBeNull();
    expect(summary.gate.passed).toBeNull();
  });
});
