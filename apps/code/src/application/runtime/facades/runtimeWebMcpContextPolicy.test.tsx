// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeRunPrepareV2Response } from "@ku0/code-runtime-host-contract";
import {
  __resetRuntimeWebMcpContextPolicyCacheForTests,
  buildRuntimeWebMcpContextPrepareRequest,
  useRuntimeWebMcpContextPolicy,
} from "./runtimeWebMcpContextPolicy";
import { prepareRuntimeRunV2 } from "../ports/runtimeJobs";
import { recordSentryMetric } from "../../../features/shared/sentry";

const { runtimeUpdatedListeners, subscribeScopedRuntimeUpdatedEventsMock } = vi.hoisted(() => {
  const listeners: Array<(event: unknown) => void> = [];
  return {
    runtimeUpdatedListeners: listeners,
    subscribeScopedRuntimeUpdatedEventsMock: vi.fn((_options, listener) => {
      listeners.push(listener as (event: unknown) => void);
      return () => {
        const index = listeners.indexOf(listener as (event: unknown) => void);
        if (index >= 0) {
          listeners.splice(index, 1);
        }
      };
    }),
  };
});

vi.mock("../ports/runtimeJobs", () => ({
  prepareRuntimeRunV2: vi.fn(),
}));

vi.mock("../../../features/shared/sentry", () => ({
  recordSentryMetric: vi.fn(),
}));

vi.mock("../ports/runtimeUpdatedEvents", () => ({
  subscribeScopedRuntimeUpdatedEvents: subscribeScopedRuntimeUpdatedEventsMock,
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
    __resetRuntimeWebMcpContextPolicyCacheForTests();
    runtimeUpdatedListeners.splice(0, runtimeUpdatedListeners.length);
  });

  it("builds runtime prepare requests from command-center intent", () => {
    const request = buildRuntimeWebMcpContextPrepareRequest({
      workspaceId: "ws-1",
      activeModelContext: {
        provider: "openai",
        modelId: "gpt-5.4",
      },
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
      provider: "openai",
      modelId: "gpt-5.4",
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
    expect(result.current.resolutionKind).toBe("runtime");
    expect(result.current.resolvedAt).not.toBeNull();
    expect(result.current.expiresAt).not.toBeNull();
    expect(result.current.truthSourceLabel).toBe("Runtime kernel v2 prepare");
    expect(recordSentryMetric).toHaveBeenCalledWith(
      "runtime_webmcp_context_policy",
      1,
      expect.objectContaining({
        attributes: expect.objectContaining({
          result: "runtime",
          provider: "unknown",
          model_id: "unknown",
          tool_profile: "minimal",
        }),
      })
    );
  });

  it("clears policy state when the command-center objective is empty", async () => {
    vi.mocked(prepareRuntimeRunV2).mockResolvedValue(buildPrepareResponse("slim"));

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

  it("reuses cached runtime prepare truth for repeated WebMCP policy requests", async () => {
    vi.mocked(prepareRuntimeRunV2).mockResolvedValue(buildPrepareResponse("full"));

    const first = renderHook(() =>
      useRuntimeWebMcpContextPolicy({
        workspaceId: "ws-1",
        enabled: true,
        activeModelContext: {
          provider: "anthropic",
          modelId: "claude-sonnet-4-5",
        },
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
      expect(first.result.current.selectionPolicy?.toolExposureProfile).toBe("full");
    });

    first.unmount();

    const second = renderHook(() =>
      useRuntimeWebMcpContextPolicy({
        workspaceId: "ws-1",
        enabled: true,
        activeModelContext: {
          provider: "anthropic",
          modelId: "claude-sonnet-4-5",
        },
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
      expect(second.result.current.selectionPolicy?.toolExposureProfile).toBe("full");
    });

    expect(vi.mocked(prepareRuntimeRunV2)).toHaveBeenCalledTimes(1);
    expect(second.result.current.resolutionKind).toBe("cache");
    expect(second.result.current.truthSourceLabel).toBe("Runtime kernel v2 prepare (cached)");
    expect(recordSentryMetric).toHaveBeenCalledWith(
      "runtime_webmcp_context_policy",
      1,
      expect.objectContaining({
        attributes: expect.objectContaining({
          result: "cache",
          provider: "anthropic",
          model_id: "claude-sonnet-4-5",
        }),
      })
    );
  });

  it("invalidates cached WebMCP policy truth after relevant runtime updates", async () => {
    vi.mocked(prepareRuntimeRunV2)
      .mockResolvedValueOnce(buildPrepareResponse("full"))
      .mockResolvedValueOnce(buildPrepareResponse("minimal"));

    const { result } = renderHook(() =>
      useRuntimeWebMcpContextPolicy({
        workspaceId: "ws-1",
        enabled: true,
        activeModelContext: {
          provider: "anthropic",
          modelId: "claude-sonnet-4-5",
        },
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
      expect(result.current.selectionPolicy?.toolExposureProfile).toBe("full");
    });

    expect(vi.mocked(prepareRuntimeRunV2)).toHaveBeenCalledTimes(1);

    act(() => {
      for (const listener of runtimeUpdatedListeners) {
        listener({});
      }
    });

    await waitFor(() => {
      expect(result.current.selectionPolicy?.toolExposureProfile).toBe("minimal");
    });

    expect(vi.mocked(prepareRuntimeRunV2)).toHaveBeenCalledTimes(2);
    expect(result.current.resolutionKind).toBe("runtime");
    expect(result.current.truthSourceLabel).toBe("Runtime kernel v2 prepare");
  });

  it("revalidates cached WebMCP policy truth after the freshness window expires", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-03-24T00:00:00Z"));
      vi.mocked(prepareRuntimeRunV2)
        .mockResolvedValueOnce(buildPrepareResponse("full"))
        .mockResolvedValueOnce(buildPrepareResponse("minimal"));

      const first = renderHook(() =>
        useRuntimeWebMcpContextPolicy({
          workspaceId: "ws-1",
          enabled: true,
          activeModelContext: {
            provider: "anthropic",
            modelId: "claude-sonnet-4-5",
          },
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

      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      expect(first.result.current.selectionPolicy?.toolExposureProfile).toBe("full");
      first.unmount();

      const second = renderHook(() =>
        useRuntimeWebMcpContextPolicy({
          workspaceId: "ws-1",
          enabled: true,
          activeModelContext: {
            provider: "anthropic",
            modelId: "claude-sonnet-4-5",
          },
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

      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      expect(second.result.current.selectionPolicy?.toolExposureProfile).toBe("full");
      expect(second.result.current.resolutionKind).toBe("cache");
      expect(vi.mocked(prepareRuntimeRunV2)).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_001);
      });

      expect(second.result.current.selectionPolicy?.toolExposureProfile).toBe("minimal");
      expect(second.result.current.resolutionKind).toBe("runtime");
      expect(vi.mocked(prepareRuntimeRunV2)).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
