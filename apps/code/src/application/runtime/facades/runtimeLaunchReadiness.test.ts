import type { HealthResponse } from "../../../contracts/runtime";
import type { RuntimeRunPrepareV2Response } from "@ku0/code-runtime-host-contract";
import type { RuntimeCapabilitiesSummary } from "@ku0/code-runtime-client/runtimeClientTypes";
import { describe, expect, it } from "vitest";
import {
  buildRuntimeLaunchReadiness,
  mergeRuntimeLaunchPreparationIntoLaunchReadiness,
  type RuntimeLaunchReadinessRoute,
} from "./runtimeLaunchReadiness";
import type { RuntimeExecutionReliabilitySummary } from "./runtimeExecutionReliability";

function buildCapabilitiesSummary(
  overrides: Partial<RuntimeCapabilitiesSummary> = {}
): RuntimeCapabilitiesSummary {
  return {
    mode: "tauri",
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
    ready: true,
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

function buildPreparation(
  overrides: Partial<RuntimeRunPrepareV2Response> = {}
): RuntimeRunPrepareV2Response {
  return {
    preparedAt: 1_700_000_000_000,
    runIntent: {
      title: "Inspect runtime launch path",
      objective: "Inspect runtime launch path",
      summary: "Runtime clarified the launch objective.",
      taskSource: null,
      accessMode: "on-request",
      executionMode: "single",
      executionProfileId: "balanced-delegate",
      reviewProfileId: null,
      validationPresetId: "standard",
      preferredBackendIds: [],
      requiredCapabilities: [],
      riskLevel: "medium",
      clarified: true,
      missingContext: [],
    },
    contextWorkingSet: {
      summary: "Runtime prepared the working set.",
      workspaceRoot: "/workspaces/HugeCode",
      layers: [],
    },
    executionGraph: {
      graphId: "graph-1",
      summary: "Inspect, validate, review.",
      nodes: [],
    },
    approvalBatches: [],
    validationPlan: {
      required: true,
      summary: "Run the narrow validation lane.",
      commands: ["pnpm validate:fast"],
    },
    reviewFocus: ["runtime truth"],
    autonomyProfile: "night_operator",
    wakePolicy: {
      mode: "auto_queue",
      safeFollowUp: true,
      allowAutomaticContinuation: true,
      allowedActions: ["continue", "approve", "clarify", "reroute", "pair", "hold"],
      stopGates: ["validation_failure_requires_review"],
      queueBudget: {
        maxQueuedActions: 2,
        maxAutoContinuations: 2,
      },
    },
    intentSnapshot: {
      summary: "Runtime synthesized the launch intent.",
      primaryGoal: "Inspect runtime launch path",
      dominantDirection: "Inspect runtime launch path",
      confidence: "high",
      signals: [],
    },
    opportunityQueue: {
      selectedOpportunityId: "opportunity-primary",
      selectionSummary: "Runtime selected the closest bounded opportunity.",
      candidates: [],
    },
    researchTrace: {
      mode: "repository_only",
      stage: "repository",
      summary: "Research remains repository-only at launch.",
      citations: [],
      sensitiveContextMixed: false,
    },
    executionEligibility: {
      eligible: true,
      summary: "Runtime can begin bounded execution without waking the operator first.",
      wakeState: "ready",
      nextEligibleAction: "continue",
      blockingReasons: [],
    },
    wakePolicySummary: {
      summary: "Runtime will use Auto Queue and stop only at explicit wake gates.",
      safeFollowUp: true,
      allowedActions: ["continue", "approve", "clarify", "reroute", "pair", "hold"],
      queueBudget: {
        maxQueuedActions: 2,
        maxAutoContinuations: 2,
      },
    },
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
        ready: false,
        detail: "Enable at least one pool for this provider.",
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
      }),
      pendingApprovalCount: 0,
      stalePendingApprovalCount: 0,
    });

    expect(summary.state).toBe("blocked");
    expect(summary.launchAllowed).toBe(false);
    expect(summary.blockingReason).toContain("80.0%");
    expect(summary.recommendedAction).toContain("recover top failed tools");
  });

  it("keeps selected route as the first blocking reason when route and reliability both block", () => {
    const summary = buildRuntimeLaunchReadiness({
      capabilities: buildCapabilitiesSummary(),
      health: buildHealthResponse(),
      healthError: null,
      selectedRoute: buildRoute({
        value: "openai",
        label: "OpenAI",
        ready: false,
        detail: "Enable at least one pool for this provider.",
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

  it("blocks launch when runtime prepare_v2 says execution is not eligible", () => {
    const summary = mergeRuntimeLaunchPreparationIntoLaunchReadiness(
      buildRuntimeLaunchReadiness({
        capabilities: buildCapabilitiesSummary(),
        health: buildHealthResponse(),
        healthError: null,
        selectedRoute: buildRoute(),
        executionReliability: buildExecutionReliability(),
        pendingApprovalCount: 0,
        stalePendingApprovalCount: 0,
      }),
      {
        hasLaunchRequest: true,
        preparation: buildPreparation({
          runIntent: {
            ...buildPreparation().runIntent,
            clarified: false,
            missingContext: ["execution_profile"],
          },
          executionEligibility: {
            eligible: false,
            summary: "Runtime should clarify missing context before chaining further.",
            wakeState: "blocked",
            nextEligibleAction: "clarify",
            blockingReasons: ["Missing execution_profile"],
          },
        }),
        preparationLoading: false,
        preparationError: null,
      }
    );

    expect(summary.state).toBe("blocked");
    expect(summary.launchAllowed).toBe(false);
    expect(summary.blockingReason).toBe("Missing execution_profile");
    expect(summary.preparation.state).toBe("blocked");
    expect(summary.recommendedAction).toContain("execution_profile");
  });

  it("keeps launch at attention while runtime is still preparing the launch plan", () => {
    const summary = mergeRuntimeLaunchPreparationIntoLaunchReadiness(
      buildRuntimeLaunchReadiness({
        capabilities: buildCapabilitiesSummary(),
        health: buildHealthResponse(),
        healthError: null,
        selectedRoute: buildRoute(),
        executionReliability: buildExecutionReliability(),
        pendingApprovalCount: 0,
        stalePendingApprovalCount: 0,
      }),
      {
        hasLaunchRequest: true,
        preparation: null,
        preparationLoading: true,
        preparationError: null,
      }
    );

    expect(summary.state).toBe("attention");
    expect(summary.launchAllowed).toBe(true);
    expect(summary.preparation.loading).toBe(true);
    expect(summary.recommendedAction).toContain("launch plan");
  });
});
