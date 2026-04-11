import { describe, expect, it } from "vitest";
import type { RuntimeRunPrepareV2Response } from "./code-runtime-rpc/runtimeRunsAndSubAgents";
import {
  isRuntimeRunPrepareV2DegradedCompatibleError,
  resolveCanonicalRuntimeRunPrepareSurface,
} from "./runtimeRunPrepareCompat";

function buildPrepareResponse(): RuntimeRunPrepareV2Response {
  return {
    preparedAt: 1_710_000_000_000,
    runIntent: {
      title: "Ship runtime truth",
      objective: "Ship runtime truth",
      summary: "Intent ready.",
      taskSource: {
        kind: "manual",
        title: "Ship runtime truth",
      },
      accessMode: "on-request",
      executionMode: "single",
      executionProfileId: "balanced-delegate",
      reviewProfileId: "review-default",
      validationPresetId: "standard",
      preferredBackendIds: [],
      requiredCapabilities: [],
      riskLevel: "low",
      clarified: true,
      missingContext: [],
    },
    contextWorkingSet: {
      summary: "Runtime prepared command-center context.",
      workspaceRoot: "/workspaces/HugeCode",
      selectionPolicy: {
        strategy: "balanced",
        tokenBudgetTarget: 1400,
        toolExposureProfile: "slim",
        preferColdFetch: true,
      },
      contextFingerprint: "ctx-123",
      stablePrefixFingerprint: "stable-123",
      layers: [],
    },
    contextTruth: {
      sourceFamily: "manual",
      sources: [],
      executionProfileId: "balanced-delegate",
      reviewProfileId: "review-default",
      validationPresetId: "standard",
      reviewIntent: "execute",
      ownerSummary: "Human owner remains accountable.",
      sourceMetadata: [],
      consumers: ["run", "review_pack"],
    },
    contextPlane: {
      summary: "Runtime can preserve context through stable memory and artifact references.",
      memoryRefs: [],
      artifactRefs: [],
      workingSetPolicy: {
        selectionStrategy: "balanced",
        toolExposureProfile: "slim",
        tokenBudgetTarget: 1400,
        refreshMode: "on_prepare",
        retentionMode: "window_only",
        preferColdFetch: true,
        compactBeforeDelegation: true,
      },
      compactionSummary: {
        triggered: false,
        executed: false,
        source: "runtime_prepare_v2",
      },
    },
    toolingPlane: {
      summary: "Tooling ready.",
      capabilityCatalog: {
        summary: "Capabilities ready.",
        catalogId: "launch:balanced-delegate",
        generatedAt: 1_710_000_000_000,
        capabilities: [],
      },
      invocationCatalogRef: {
        catalogId: "launch:balanced-delegate",
        summary: "Invocation catalog ready.",
        generatedAt: 1_710_000_000_000,
        execution: {
          bindings: [],
          requirements: [],
        },
        provenance: ["runtime_prepare"],
      },
      sandboxRef: {
        id: "sandbox:balanced-delegate",
        label: "Balanced Delegate sandbox",
        summary: "Sandbox ready.",
        accessMode: "on-request",
        executionProfileId: "balanced-delegate",
        preferredBackendIds: [],
        routedProvider: null,
        networkPolicy: "default",
        filesystemPolicy: "workspace_scoped",
        toolPosture: "workspace_safe",
        approvalSensitivity: "standard",
      },
      mcpSources: [],
      toolCallRefs: [],
      toolResultRefs: [],
    },
    evalPlane: {
      summary: "Eval ready.",
      evalCases: [],
      modelReleasePlaybook: [],
    },
    guidanceStack: {
      summary: "Guidance ready.",
      precedence: ["repo"],
      layers: [],
    },
    triageSummary: {
      owner: "Operator",
      priority: "medium",
      riskLevel: "low",
      tags: [],
      dedupeKey: null,
      summary: "Owner Operator",
    },
    delegationContract: {
      mode: "single_owner",
      summary: "Delegation ready.",
      accountability: {
        owner: "Operator",
        operatorRole: "approver",
        executionRole: "runtime_agent",
      },
      approvalPressure: "normal",
      missingContext: [],
      guidance: [],
      continuePathLabel: "Mission run",
      continuationSummary: "Continue in mission run.",
      nextOperatorAction: "Review when ready.",
      blocked: false,
    },
    delegationPlan: null,
    executionGraph: {
      graphId: "graph-1",
      summary: "Execution graph ready.",
      nodes: [],
    },
    approvalBatches: [],
    validationPlan: {
      required: false,
      summary: "Validation ready.",
      commands: [],
    },
    reviewFocus: [],
    plan: {
      planVersion: "plan-1",
      summary: "Plan ready.",
      currentMilestoneId: null,
      estimatedDurationMinutes: 5,
      estimatedWorkerRuns: 1,
      parallelismHint: "sequential",
      clarifyingQuestions: [],
      milestones: [],
      validationLanes: [],
      skillPlan: [],
    },
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
      summary: "Intent aligned.",
      primaryGoal: "Ship runtime truth",
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
    auxiliaryExecutionPolicy: null,
  };
}

describe("runtimeRunPrepareCompat", () => {
  it("accepts a complete runtime prepare response as canonical launch truth", () => {
    const resolution = resolveCanonicalRuntimeRunPrepareSurface(buildPrepareResponse());

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) {
      return;
    }
    expect(resolution.surface.contextPlane.summary).toContain("stable memory");
    expect(resolution.surface.toolingPlane.invocationCatalogRef?.catalogId).toBe(
      "launch:balanced-delegate"
    );
    expect(resolution.surface.evalPlane.summary).toBe("Eval ready.");
  });

  it("rejects successful prepare responses that omit required launch planes", () => {
    const response = buildPrepareResponse();
    response.toolingPlane = null;

    const resolution = resolveCanonicalRuntimeRunPrepareSurface(response);

    expect(resolution.ok).toBe(false);
    if (resolution.ok) {
      return;
    }
    expect(resolution.reason).toBe("missing_tooling_plane");
    expect(resolution.missingFields).toEqual(["toolingPlane"]);
    expect(resolution.message).toContain("missing toolingPlane");
  });

  it("treats method-not-found style prepare errors as degraded-compatible", () => {
    expect(
      isRuntimeRunPrepareV2DegradedCompatibleError({
        code: "method_not_found",
        message: "unsupported rpc method: code_runtime_run_prepare_v2",
      })
    ).toBe(true);
  });

  it("treats runtime-unavailable prepare errors as degraded-compatible", () => {
    expect(
      isRuntimeRunPrepareV2DegradedCompatibleError(
        new Error("Code runtime is unavailable for prepare runtime run v2.")
      )
    ).toBe(true);
  });

  it("treats dotted runtime-unavailable codes as degraded-compatible", () => {
    expect(
      isRuntimeRunPrepareV2DegradedCompatibleError({
        code: "runtime.validation.method.unavailable",
        message: "prepare_v2 is unavailable",
      })
    ).toBe(true);
  });

  it("does not treat arbitrary prepare failures as degraded-compatible", () => {
    expect(
      isRuntimeRunPrepareV2DegradedCompatibleError({
        code: "internal_error",
        message: "prepare pipeline exploded",
      })
    ).toBe(false);
  });
});
