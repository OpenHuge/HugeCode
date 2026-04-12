// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeRunPrepareV2Response } from "@ku0/code-runtime-host-contract";
import { prepareRuntimeRunV2 } from "../ports/runtimeJobs";
import { listRuntimeInvocationHostsV1 } from "../ports/runtimeInvocationPlane";
import {
  buildRuntimeContextPlane,
  buildRuntimeContextTruth,
  buildRuntimeDelegationContract,
  buildRuntimeEvalPlane,
  buildRuntimeGuidanceStack,
  buildRuntimeToolingPlane,
  buildRuntimeTriageSummary,
} from "./runtimeContextTruth";
import { useRuntimeMissionLaunchPreview } from "./runtimeMissionLaunchPreparation";

vi.mock("../../../hooks/useDebouncedValue", () => ({
  useDebouncedValue: <T,>(value: T) => value,
}));

vi.mock("../ports/runtimeJobs", () => ({
  prepareRuntimeRunV2: vi.fn(),
}));

vi.mock("../ports/runtimeInvocationPlane", () => ({
  listRuntimeInvocationHostsV1: vi.fn(),
}));
vi.mock("./runtimeContextTruth", async () => {
  const actual =
    await vi.importActual<typeof import("./runtimeContextTruth")>("./runtimeContextTruth");
  return {
    ...actual,
    buildRuntimeContextTruth: vi.fn(actual.buildRuntimeContextTruth),
    buildRuntimeGuidanceStack: vi.fn(actual.buildRuntimeGuidanceStack),
    buildRuntimeContextPlane: vi.fn(actual.buildRuntimeContextPlane),
    buildRuntimeToolingPlane: vi.fn(actual.buildRuntimeToolingPlane),
    buildRuntimeEvalPlane: vi.fn(actual.buildRuntimeEvalPlane),
    buildRuntimeTriageSummary: vi.fn(actual.buildRuntimeTriageSummary),
    buildRuntimeDelegationContract: vi.fn(actual.buildRuntimeDelegationContract),
  };
});

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
      layers: [
        {
          id: "repo-layer",
          label: "Repo guidance",
          scope: "repo",
          summary: "Repo guidance layer",
          entries: [
            {
              id: "repo-instruction-surfaces",
              label: "Repo guidance",
              detail: "Runtime detected AGENTS.md as hot repo guidance surfaces.",
              priority: 10,
            },
          ],
        },
      ],
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
      layers: [
        {
          id: "repo-instructions",
          scope: "repo",
          summary: "Repo instructions remain the baseline contract.",
          source: "AGENTS.md",
          priority: 10,
          instructions: ["Prefer runtime-owned truth over page-local heuristics."],
          skillIds: [],
        },
      ],
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

function buildLaunchInput() {
  return {
    workspaceId: "ws-1",
    draftTitle: "Ship runtime truth",
    draftInstruction: "Ship runtime truth safely.",
    selectedExecutionProfile: {
      id: "balanced-delegate",
      name: "Balanced Delegate",
      accessMode: "on-request" as const,
      networkPolicy: "default" as const,
      toolPosture: "workspace_safe",
      approvalSensitivity: "standard",
      validationPresetId: "standard",
    },
    repositoryLaunchDefaults: {
      contract: null,
      sourceMappingKind: null,
      executionProfileId: "balanced-delegate",
      accessMode: "on-request" as const,
      reviewProfileId: null,
      reviewProfile: null,
      validationPresetId: "standard",
      validationPresetLabel: "Standard",
      validationCommands: [],
      repoInstructions: [],
      repoSkillIds: [],
      sourceInstructions: [],
      sourceSkillIds: [],
      owner: null,
      triagePriority: null,
      triageRiskLevel: null,
      triageTags: [],
    },
    runtimeSourceDraft: null,
    routedProvider: null,
    preferredBackendIds: null,
    defaultBackendId: null,
  };
}

describe("runtimeMissionLaunchPreparation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listRuntimeInvocationHostsV1).mockResolvedValue({
      registryVersion: "runtime-invocation-host-registry-v1",
      generatedAt: 1,
      workspaceId: "workspace-1",
      summary: {
        total: 1,
        executable: 1,
        resolveOnly: 0,
        reserved: 0,
        unsupported: 0,
        ready: 1,
        attention: 0,
        blocked: 0,
      },
      hosts: [
        {
          hostId: "runtime:built-in-tools",
          category: "built_in_runtime_tool",
          label: "Runtime built-in tools",
          summary: "Runtime-native execution host",
          authority: "runtime",
          dispatchMode: "execute",
          readiness: {
            state: "ready",
            available: true,
            reason: null,
            checkedAt: 1,
          },
          requirementKeys: ["runtime_service"],
          dispatchMethods: ["code_runtime_invocation_dispatch_v1"],
          provenance: {
            source: "runtime_host_registry",
            registryVersion: "runtime-invocation-host-registry-v1",
            workspaceId: "workspace-1",
          },
        },
      ],
    });
  });

  it("uses runtime prepare truth directly when kernel v2 returns a complete surface", async () => {
    vi.mocked(prepareRuntimeRunV2).mockResolvedValue(buildPrepareResponse());

    const { result } = renderHook(() => useRuntimeMissionLaunchPreview(buildLaunchInput()));

    await waitFor(() => {
      expect(result.current.truthSourceLabel).toBe("Runtime kernel v2 prepare");
    });

    expect(result.current.preparation?.toolingPlane?.summary).toBe("Tooling ready.");
    expect(result.current.repoGuidanceSummary).toBe("Repo guidance: AGENTS.md");
    expect(result.current.selectedInvocationHostLabel).toBe("Runtime built-in tools");
    expect(result.current.runtimeDispatchMode).toBe("execute");
    expect(result.current.usesCanonicalRuntimeDispatch).toBe(true);
    expect(result.current.usesCompatibilityFallback).toBe(false);
    expect(result.current.error).toBeNull();
    expect(vi.mocked(buildRuntimeContextTruth)).not.toHaveBeenCalled();
    expect(vi.mocked(buildRuntimeGuidanceStack)).not.toHaveBeenCalled();
    expect(vi.mocked(buildRuntimeContextPlane)).not.toHaveBeenCalled();
    expect(vi.mocked(buildRuntimeToolingPlane)).not.toHaveBeenCalled();
    expect(vi.mocked(buildRuntimeEvalPlane)).not.toHaveBeenCalled();
    expect(vi.mocked(buildRuntimeTriageSummary)).not.toHaveBeenCalled();
    expect(vi.mocked(buildRuntimeDelegationContract)).not.toHaveBeenCalled();
  });

  it("falls back as a whole degraded prepare surface when prepare_v2 is unavailable", async () => {
    vi.mocked(prepareRuntimeRunV2).mockRejectedValue(
      new Error("Code runtime is unavailable for prepare runtime run v2.")
    );

    const { result } = renderHook(() => useRuntimeMissionLaunchPreview(buildLaunchInput()));

    await waitFor(() => {
      expect(result.current.truthSourceLabel).toBe("App fallback prepare");
    });

    expect(result.current.preparation).toBeNull();
    expect(result.current.contextTruth).not.toBeNull();
    expect(result.current.toolingPlane).not.toBeNull();
    expect(result.current.selectedInvocationHostLabel).toBe("Runtime built-in tools");
    expect(result.current.runtimeDispatchMode).toBe("execute");
    expect(result.current.error).toBe("Code runtime is unavailable for prepare runtime run v2.");
    expect(vi.mocked(buildRuntimeContextTruth)).toHaveBeenCalled();
    expect(vi.mocked(buildRuntimeGuidanceStack)).toHaveBeenCalled();
    expect(vi.mocked(buildRuntimeContextPlane)).toHaveBeenCalled();
    expect(vi.mocked(buildRuntimeToolingPlane)).toHaveBeenCalled();
    expect(vi.mocked(buildRuntimeEvalPlane)).toHaveBeenCalled();
    expect(vi.mocked(buildRuntimeTriageSummary)).toHaveBeenCalled();
    expect(vi.mocked(buildRuntimeDelegationContract)).toHaveBeenCalled();
  });

  it("surfaces a contract error when runtime prepare succeeds without required planes", async () => {
    const incomplete = buildPrepareResponse();
    incomplete.toolingPlane = null;
    vi.mocked(prepareRuntimeRunV2).mockResolvedValue(incomplete);

    const { result } = renderHook(() => useRuntimeMissionLaunchPreview(buildLaunchInput()));

    await waitFor(() => {
      expect(result.current.error).toContain("missing toolingPlane");
    });

    expect(result.current.preparation).toBeNull();
    expect(result.current.contextTruth).toBeNull();
    expect(result.current.toolingPlane).toBeNull();
    expect(result.current.selectedInvocationHostLabel).toBe("Runtime built-in tools");
    expect(result.current.truthSourceLabel).toBeNull();
    expect(vi.mocked(buildRuntimeContextTruth)).not.toHaveBeenCalled();
    expect(vi.mocked(buildRuntimeGuidanceStack)).not.toHaveBeenCalled();
    expect(vi.mocked(buildRuntimeContextPlane)).not.toHaveBeenCalled();
    expect(vi.mocked(buildRuntimeToolingPlane)).not.toHaveBeenCalled();
    expect(vi.mocked(buildRuntimeEvalPlane)).not.toHaveBeenCalled();
    expect(vi.mocked(buildRuntimeTriageSummary)).not.toHaveBeenCalled();
    expect(vi.mocked(buildRuntimeDelegationContract)).not.toHaveBeenCalled();
  });
});
