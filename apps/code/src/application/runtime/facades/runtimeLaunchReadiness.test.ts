import type { HealthResponse } from "../../../contracts/runtime";
import type { RuntimeCapabilitiesSummary } from "@ku0/code-runtime-client/runtimeClientTypes";
import { describe, expect, it } from "vitest";
import {
  buildRuntimeLaunchReadiness,
  type RuntimeLaunchReadinessRoute,
} from "./runtimeLaunchReadiness";
import type { RuntimeExecutionReliabilitySummary } from "./runtimeExecutionReliability";

function buildCapabilitiesSummary(
  overrides: Partial<RuntimeCapabilitiesSummary> = {}
): RuntimeCapabilitiesSummary {
  return {
    mode: "desktop-compat",
    methods: ["code_health"],
    features: ["distributed_subtask_graph"],
    wsEndpointPath: "/ws",
    error: null,
    ...overrides,
  };
}

function buildHealthResponse(overrides: Partial<HealthResponse> = {}): HealthResponse {
  return {
    app: "hugecode-runtime",
    version: "1.0.0",
    status: "ok",
    ...overrides,
  };
}

function buildRoute(
  overrides: Partial<RuntimeLaunchReadinessRoute> = {}
): RuntimeLaunchReadinessRoute {
  return {
    value: "auto",
    label: "Automatic workspace routing",
    state: "ready",
    ready: true,
    launchAllowed: true,
    detail: "2/3 provider routes ready.",
    ...overrides,
  };
}

function buildExecutionReliability(
  overrides: Partial<RuntimeExecutionReliabilitySummary> = {}
): RuntimeExecutionReliabilitySummary {
  return {
    state: "ready",
    blockingReason: null,
    recommendedAction: "Runtime execution reliability looks healthy for another launch.",
    gate: {
      minSuccessRate: 0.95,
      successRate: 1,
      denominator: 10,
      passed: true,
    },
    channelHealth: {
      status: "healthy",
      reason: null,
      lastErrorCode: null,
      updatedAt: 1_700_000_000_000,
      source: "guardrails",
    },
    blockedTotal: 0,
    topFailedReason: null,
    circuitBreakers: [],
    ...overrides,
  };
}

describe("buildRuntimeLaunchReadiness", () => {
  it("blocks launch when runtime capabilities are unavailable", () => {
    const summary = buildRuntimeLaunchReadiness({
      capabilities: buildCapabilitiesSummary({
        mode: "unavailable",
        methods: [],
        features: [],
        error: "Runtime capabilities unavailable.",
      }),
      health: null,
      healthError: null,
      selectedRoute: buildRoute(),
      executionReliability: buildExecutionReliability(),
      pendingApprovalCount: 0,
      stalePendingApprovalCount: 0,
    });

    expect(summary.state).toBe("blocked");
    expect(summary.launchAllowed).toBe(false);
    expect(summary.blockingReason).toContain("Runtime capabilities unavailable");
    expect(summary.recommendedAction).toContain("Reconnect");
  });

  it("blocks launch when the selected provider route is not ready", () => {
    const summary = buildRuntimeLaunchReadiness({
      capabilities: buildCapabilitiesSummary(),
      health: buildHealthResponse(),
      healthError: null,
      selectedRoute: buildRoute({
        value: "openai",
        label: "OpenAI",
        state: "blocked",
        ready: false,
        launchAllowed: false,
        detail: "Enable at least one pool for this provider.",
        blockingReason: "Enable at least one pool for this provider.",
      }),
      executionReliability: buildExecutionReliability(),
      pendingApprovalCount: 0,
      stalePendingApprovalCount: 0,
    });

    expect(summary.state).toBe("blocked");
    expect(summary.launchAllowed).toBe(false);
    expect(summary.blockingReason).toBe("Enable at least one pool for this provider.");
    expect(summary.route.state).toBe("blocked");
  });

  it("keeps launch available but warns when approvals are piling up", () => {
    const summary = buildRuntimeLaunchReadiness({
      capabilities: buildCapabilitiesSummary(),
      health: buildHealthResponse(),
      healthError: null,
      selectedRoute: buildRoute(),
      executionReliability: buildExecutionReliability(),
      pendingApprovalCount: 3,
      stalePendingApprovalCount: 0,
    });

    expect(summary.state).toBe("attention");
    expect(summary.launchAllowed).toBe(true);
    expect(summary.blockingReason).toBeNull();
    expect(summary.recommendedAction).toContain("approval");
    expect(summary.approvalPressure.state).toBe("attention");
  });

  it("keeps launch available when routing falls back to local/native execution but surfaces attention", () => {
    const summary = buildRuntimeLaunchReadiness({
      capabilities: buildCapabilitiesSummary(),
      health: buildHealthResponse(),
      healthError: null,
      selectedRoute: buildRoute({
        state: "attention",
        ready: false,
        launchAllowed: true,
        detail:
          "No OAuth-backed provider routes are ready, so automatic routing will fall back to local/native execution.",
        recommendedAction:
          "Launch can continue on local/native routing, or restore a ready remote provider route before launching.",
        fallbackDetail:
          "No OAuth-backed provider routes are ready, so automatic routing will fall back to local/native execution.",
        provenanceLabel: "Workspace auto route",
      }),
      executionReliability: buildExecutionReliability(),
      pendingApprovalCount: 0,
      stalePendingApprovalCount: 0,
    });

    expect(summary.state).toBe("attention");
    expect(summary.launchAllowed).toBe(true);
    expect(summary.recommendedAction).toContain("local/native routing");
    expect(summary.route.fallbackDetail).toContain("fall back to local/native execution");
    expect(summary.route.provenanceLabel).toBe("Workspace auto route");
  });

  it("prioritizes stale approvals as the first operator action", () => {
    const summary = buildRuntimeLaunchReadiness({
      capabilities: buildCapabilitiesSummary(),
      health: buildHealthResponse(),
      healthError: null,
      selectedRoute: buildRoute(),
      executionReliability: buildExecutionReliability(),
      pendingApprovalCount: 4,
      stalePendingApprovalCount: 2,
    });

    expect(summary.state).toBe("attention");
    expect(summary.launchAllowed).toBe(true);
    expect(summary.recommendedAction).toContain("stale input");
    expect(summary.approvalPressure.detail).toContain("2 stale");
  });

  it("reports ready when runtime, route, and approval pressure are healthy", () => {
    const summary = buildRuntimeLaunchReadiness({
      capabilities: buildCapabilitiesSummary(),
      health: buildHealthResponse(),
      healthError: null,
      selectedRoute: buildRoute(),
      executionReliability: buildExecutionReliability(),
      pendingApprovalCount: 0,
      stalePendingApprovalCount: 0,
    });

    expect(summary.state).toBe("ready");
    expect(summary.launchAllowed).toBe(true);
    expect(summary.blockingReason).toBeNull();
    expect(summary.recommendedAction).toContain("launch");
  });

  it("blocks launch when execution reliability is blocked", () => {
    const summary = buildRuntimeLaunchReadiness({
      capabilities: buildCapabilitiesSummary(),
      health: buildHealthResponse(),
      healthError: null,
      selectedRoute: buildRoute(),
      executionReliability: buildExecutionReliability({
        state: "blocked",
        blockingReason: "Runtime tool success rate is 80.0%, below the 95.0% launch threshold.",
        recommendedAction:
          "Inspect runtime tool metrics and recover top failed tools before launching.",
        blockedTotal: 2,
        topFailedReason: "REQUEST_TIMEOUT (1)",
      }),
      pendingApprovalCount: 0,
      stalePendingApprovalCount: 0,
    });

    expect(summary.state).toBe("blocked");
    expect(summary.launchAllowed).toBe(false);
    expect(summary.blockingReason).toContain("80.0%");
    expect(summary.recommendedAction).toContain("recover top failed tools");
    expect(summary.executionReliability.blockedTotal).toBe(2);
    expect(summary.executionReliability.topFailedReason).toBe("REQUEST_TIMEOUT (1)");
  });

  it("carries circuit breaker scopes into the execution reliability signal", () => {
    const summary = buildRuntimeLaunchReadiness({
      capabilities: buildCapabilitiesSummary(),
      health: buildHealthResponse(),
      healthError: null,
      selectedRoute: buildRoute(),
      executionReliability: buildExecutionReliability({
        state: "blocked",
        blockingReason: "The runtime runtime tool circuit breaker is open.",
        recommendedAction: "Wait for the runtime tool circuit breaker to close before launching.",
        circuitBreakers: [
          {
            scope: "runtime",
            state: "open",
            openedAt: 1_700_000_000_000,
            updatedAt: 1_700_000_000_000,
          },
          {
            scope: "write",
            state: "closed",
            openedAt: null,
            updatedAt: 1_700_000_000_001,
          },
        ],
      }),
      pendingApprovalCount: 0,
      stalePendingApprovalCount: 0,
    });

    expect(summary.executionReliability.openCircuitBreakerScopes).toEqual(["runtime"]);
  });

  it("keeps selected route as the first blocking reason when route and reliability both block", () => {
    const summary = buildRuntimeLaunchReadiness({
      capabilities: buildCapabilitiesSummary(),
      health: buildHealthResponse(),
      healthError: null,
      selectedRoute: buildRoute({
        value: "openai",
        label: "OpenAI",
        state: "blocked",
        ready: false,
        launchAllowed: false,
        detail: "Enable at least one pool for this provider.",
        blockingReason: "Enable at least one pool for this provider.",
      }),
      executionReliability: buildExecutionReliability({
        state: "blocked",
        blockingReason: "Runtime tool success rate is 80.0%, below the 95.0% launch threshold.",
        recommendedAction:
          "Inspect runtime tool metrics and recover top failed tools before launching.",
      }),
      pendingApprovalCount: 0,
      stalePendingApprovalCount: 0,
    });

    expect(summary.state).toBe("blocked");
    expect(summary.blockingReason).toBe("Enable at least one pool for this provider.");
  });
});
