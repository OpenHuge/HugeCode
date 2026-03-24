// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeRunPrepareV2Response } from "@ku0/code-runtime-host-contract";
import {
  buildRuntimeWebMcpContextPrepareRequest,
  useRuntimeWebMcpContextPolicy,
} from "./runtimeWebMcpContextPolicy";
import { prepareRuntimeRunV2 } from "../ports/tauriRuntimeJobs";

vi.mock("../ports/tauriRuntimeJobs", () => ({
  prepareRuntimeRunV2: vi.fn(),
}));

function buildPrepareResponse(
  toolExposureProfile: "minimal" | "slim" | "full"
): RuntimeRunPrepareV2Response {
  return {
    preparedAt: Date.now(),
    contextWorkingSet: {
      summary: "Runtime prepared command-center context.",
      workspaceRoot: "/workspaces/HugeCode",
      selectionPolicy: {
        strategy: "balanced",
        tokenBudgetTarget: 1400,
        toolExposureProfile,
        preferColdFetch: true,
      },
      contextFingerprint: "ctx-123",
      stablePrefixFingerprint: "stable-123",
      layers: [],
    },
    runIntent: {
      title: "Coordinate the next runtime launch",
      objective: "Coordinate the next runtime launch",
      summary: "Intent ready.",
      taskSource: {
        kind: "manual",
        title: "Coordinate the next runtime launch",
      },
      accessMode: "on-request",
      executionMode: "single",
      executionProfileId: null,
      reviewProfileId: null,
      validationPresetId: null,
      preferredBackendIds: [],
      requiredCapabilities: [],
      riskLevel: "low",
      clarified: true,
      missingContext: [],
    },
    executionGraph: {
      graphId: "graph-1",
      summary: "Execution plan ready.",
      nodes: [],
    },
    approvalBatches: [],
    validationPlan: {
      required: false,
      summary: "Validation ready.",
      commands: [],
    },
    reviewFocus: [],
    autonomyProfile: "supervised",
    wakePolicy: {
      mode: "review_queue",
      safeFollowUp: true,
      allowAutomaticContinuation: false,
      allowedActions: ["continue"],
      stopGates: [],
      queueBudget: null,
    },
    intentSnapshot: {
      summary: "Operator intent aligned.",
      primaryGoal: "Coordinate the next runtime launch",
      dominantDirection: "Ship the runtime improvement",
      confidence: "high",
      signals: [],
    },
    opportunityQueue: {
      selectedOpportunityId: null,
      selectionSummary: null,
      candidates: [],
    },
    researchTrace: {
      mode: "repository_only",
      stage: "repository",
      summary: "Repository-only context.",
      citations: [],
      sensitiveContextMixed: false,
    },
    executionEligibility: {
      eligible: true,
      summary: "Ready to execute.",
      wakeState: "ready",
      nextEligibleAction: "continue",
      blockingReasons: [],
    },
    wakePolicySummary: {
      summary: "Review queue only.",
      safeFollowUp: true,
      allowedActions: ["continue"],
      queueBudget: null,
    },
  };
}

describe("runtimeWebMcpContextPolicy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds runtime prepare requests from command-center intent", () => {
    const request = buildRuntimeWebMcpContextPrepareRequest({
      workspaceId: "ws-1",
      intent: {
        objective: "Coordinate the next runtime launch",
        constraints: "Avoid wide file rewrites",
        successCriteria: "Ship a validated patch",
        deadline: "2026-03-25",
        priority: "high",
        managerNotes: "Prefer remote execution",
      },
    });

    expect(request).toMatchObject({
      workspaceId: "ws-1",
      title: "Coordinate the next runtime launch",
      accessMode: "on-request",
      executionMode: "single",
      steps: expect.arrayContaining([
        expect.objectContaining({
          kind: "read",
          input: "Coordinate the next runtime launch",
        }),
        expect.objectContaining({
          kind: "read",
          input: "Constraints: Avoid wide file rewrites",
        }),
        expect.objectContaining({
          kind: "read",
          input: "Priority: high",
        }),
      ]),
    });
  });

  it("hydrates tool exposure policy from runtime prepare truth", async () => {
    vi.mocked(prepareRuntimeRunV2).mockResolvedValue(buildPrepareResponse("minimal"));

    const { result } = renderHook(() =>
      useRuntimeWebMcpContextPolicy({
        workspaceId: "ws-1",
        enabled: true,
        intent: {
          objective: "Coordinate the next runtime launch",
          constraints: "",
          successCriteria: "",
          deadline: null,
          priority: "medium",
          managerNotes: "",
        },
      })
    );

    await waitFor(() => {
      expect(result.current.selectionPolicy?.toolExposureProfile).toBe("minimal");
    });

    expect(result.current.contextFingerprint).toBe("ctx-123");
    expect(result.current.truthSourceLabel).toBe("Runtime kernel v2 prepare");
  });

  it("clears policy state when the command-center objective is empty", async () => {
    const { result, rerender } = renderHook(
      ({ objective }) =>
        useRuntimeWebMcpContextPolicy({
          workspaceId: "ws-1",
          enabled: true,
          intent: {
            objective,
            constraints: "",
            successCriteria: "",
            deadline: null,
            priority: "medium",
            managerNotes: "",
          },
        }),
      {
        initialProps: { objective: "Plan runtime work" },
      }
    );

    vi.mocked(prepareRuntimeRunV2).mockResolvedValue(buildPrepareResponse("slim"));

    await waitFor(() => {
      expect(result.current.selectionPolicy?.toolExposureProfile).toBe("slim");
    });

    await act(async () => {
      rerender({ objective: "   " });
    });

    await waitFor(() => {
      expect(result.current.selectionPolicy).toBeNull();
    });
  });

  it("stays idle when runtime WebMCP context policy is disabled", async () => {
    const { result } = renderHook(() =>
      useRuntimeWebMcpContextPolicy({
        workspaceId: "ws-1",
        enabled: false,
        intent: {
          objective: "Plan runtime work",
          constraints: "",
          successCriteria: "",
          deadline: null,
          priority: "medium",
          managerNotes: "",
        },
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(vi.mocked(prepareRuntimeRunV2)).not.toHaveBeenCalled();
    expect(result.current.selectionPolicy).toBeNull();
    expect(result.current.truthSourceLabel).toBeNull();
  });
});
