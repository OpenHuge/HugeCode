import { describe, expect, it } from "vitest";
import type {
  RuntimeContextPlaneV2,
  RuntimeEvalPlaneV2,
  RuntimePolicySnapshot,
  RuntimeToolingPlaneV2,
} from "@ku0/code-runtime-host-contract";
import {
  buildRuntimeLaunchPreparationContextPlaneSummary,
  buildRuntimeLaunchPreparationEvalPlaneSummary,
  buildRuntimeLaunchPreparationInvocationSummary,
  buildRuntimeLaunchPreparationToolingPlaneSummary,
  buildRuntimeMissionControlCompositionSummary,
  buildRuntimeMissionControlPolicyIndicator,
  buildRuntimeMissionControlSummaryCounts,
} from "./runtime-control-plane/runtimeMissionControlProjectionSummaries";

describe("runtimeMissionControlProjectionSummaries", () => {
  it("counts runtime task states into mission-control summary buckets", () => {
    const summary = buildRuntimeMissionControlSummaryCounts([
      { status: "running" },
      { status: "queued" },
      { status: "awaiting_approval" },
      { status: "completed" },
      { status: "failed" },
    ] as never);

    expect(summary).toEqual({
      total: 5,
      running: 1,
      queued: 1,
      awaitingApproval: 1,
      finished: 2,
    });
  });

  it("summarizes composition provenance without app-local helpers", () => {
    const summary = buildRuntimeMissionControlCompositionSummary({
      profiles: [
        {
          id: "workspace-default",
          name: "Workspace Default",
          scope: "workspace",
          enabled: true,
          pluginSelectors: [],
          routePolicy: {
            preferredRoutePluginIds: [],
            providerPreference: [],
            allowRuntimeFallback: true,
          },
          backendPolicy: {
            preferredBackendIds: ["backend-primary"],
            resolvedBackendId: null,
          },
          trustPolicy: {
            requireVerifiedSignatures: true,
            allowDevOverrides: false,
            blockedPublishers: [],
          },
          executionPolicyRefs: [],
          observabilityPolicy: {
            emitStableEvents: true,
            emitOtelAlignedTelemetry: true,
          },
          configLayers: [],
        },
      ],
      activeProfile: {
        id: "workspace-default",
        name: "Workspace Default",
        scope: "workspace",
        enabled: true,
        pluginSelectors: [],
        routePolicy: {
          preferredRoutePluginIds: [],
          providerPreference: [],
          allowRuntimeFallback: true,
        },
        backendPolicy: {
          preferredBackendIds: ["backend-primary"],
          resolvedBackendId: null,
        },
        trustPolicy: {
          requireVerifiedSignatures: true,
          allowDevOverrides: false,
          blockedPublishers: [],
        },
        executionPolicyRefs: [],
        observabilityPolicy: {
          emitStableEvents: true,
          emitOtelAlignedTelemetry: true,
        },
        configLayers: [],
      },
      activeProfileId: "workspace-default",
      resolution: {
        selectedPlugins: [],
        selectedRouteCandidates: [{ pluginId: "route-1" }],
        selectedBackendCandidates: [{ backendId: "backend-primary", sourcePluginId: null }],
        blockedPlugins: [
          {
            pluginId: "pkg.blocked",
            reason: "blocked",
            stage: "trust",
          },
        ],
        trustDecisions: [
          {
            status: "verified",
            verificationStatus: "verified",
            publisher: "HugeCode Labs",
            attestationSource: "sigstore",
            blockedReason: null,
            packageRef: "hugecode.mcp.search@1.0.0",
            pluginId: "pkg.search.remote",
          },
        ],
        provenance: {
          activeProfileId: "workspace-default",
          activeProfileName: "Workspace Default",
          appliedLayerOrder: ["built_in", "user", "workspace", "launch_override"],
          selectorDecisions: {},
        },
      },
      error: null,
    });

    expect(summary).toEqual({
      profileCount: 1,
      activeProfileId: "workspace-default",
      activeProfileName: "Workspace Default",
      verifiedPluginCount: 1,
      blockedPluginCount: 1,
      selectedRouteCount: 1,
      selectedBackendCount: 1,
      error: null,
    });
  });

  it("projects runtime policy truth into a shared governance indicator", () => {
    const summary = buildRuntimeMissionControlPolicyIndicator({
      runtimePolicy: {
        mode: "strict",
        updatedAt: 1_700_000_001_000,
        state: {
          readiness: "attention",
          summary: "Runtime policy is active in Strict mode with 2 operator-visible constraints.",
          activeConstraintCount: 2,
          blockedCapabilityCount: 1,
          capabilities: [
            {
              capabilityId: "tool_preflight",
              label: "Tool preflight",
              readiness: "attention",
              effect: "approval",
              activeConstraint: true,
              summary: "Strict mode gates medium and high-risk actions.",
              detail: "Operator approval is required before risky tool execution can continue.",
            },
            {
              capabilityId: "network_analysis",
              label: "Network analysis",
              readiness: "attention",
              effect: "blocked",
              activeConstraint: true,
              summary: "Network-backed analysis is disabled by runtime policy.",
              detail: "Enable live-skills network access to restore remote search and fetch paths.",
            },
          ],
        },
      } satisfies RuntimePolicySnapshot,
      runtimePolicyError: null,
    });

    expect(summary.statusLabel).toBe("Attention");
    expect(summary.mode).toBe("Strict");
    expect(summary.activeConstraintCount).toBe(2);
    expect(summary.blockedCapabilityCount).toBe(1);
    expect(summary.capabilities[0]?.effectLabel).toBe("Approval gated");
    expect(summary.capabilities[1]?.effectLabel).toBe("Blocked");
  });

  it("builds launch-preparation summaries from runtime-owned planes", () => {
    const contextPlane = {
      summary: "Context remains runtime-owned.",
      memoryRefs: [
        {
          id: "memory:repo",
          label: "Repo rules",
          kind: "repo_instruction_surface",
          summary: "Repo rules",
          storage: "workspace_manifest",
          persistenceScope: "workspace",
        },
      ],
      artifactRefs: [
        {
          id: "artifact:validation-plan",
          label: "Validation plan",
          kind: "validation_plan",
          summary: "Validation defaults",
        },
        {
          id: "artifact:review-pack",
          label: "Review pack",
          kind: "review_pack",
          summary: "Review evidence",
        },
      ],
      workingSetPolicy: {
        selectionStrategy: "balanced",
        toolExposureProfile: "slim",
        tokenBudgetTarget: 4096,
        refreshMode: "on_prepare",
        retentionMode: "window_and_memory",
        preferColdFetch: true,
        compactBeforeDelegation: true,
      },
      compactionSummary: {
        triggered: true,
        executed: true,
        source: "runtime_prepare_v2",
        compressedSteps: 2,
        bytesReduced: 640,
      },
    } satisfies RuntimeContextPlaneV2;
    const toolingPlane = {
      summary: "Tooling remains runtime-owned.",
      capabilityCatalog: {
        summary: "Stable launch capabilities.",
        catalogId: "launch:balanced-delegate",
        generatedAt: null,
        capabilities: [
          {
            id: "runtime.launch",
            label: "Runtime launch",
            summary: "Prepare and launch governed runs.",
            kind: "workspace_write",
            readiness: "ready",
            safetyLevel: "write",
            source: "runtime",
          },
          {
            id: "runtime.tooling",
            label: "Runtime tooling",
            summary: "Publish tooling posture.",
            kind: "runtime_tool",
            readiness: "ready",
            safetyLevel: "read",
            source: "runtime",
          },
        ],
      },
      invocationCatalogRef: {
        catalogId: "launch:balanced-delegate",
        summary: "Launch-scoped invocation catalog.",
        generatedAt: null,
        execution: {
          bindings: [
            {
              bindingKind: "runtime_run",
              host: "runtime",
              count: 2,
              readyCount: 1,
              blockedCount: 1,
              notRequiredCount: 0,
              requirementKeys: ["runtime_service"],
            },
          ],
          requirements: [{ key: "runtime_service", count: 1 }],
        },
        provenance: ["runtime_prepare"],
      },
      sandboxRef: {
        id: "sandbox:balanced-delegate",
        label: "Balanced Delegate sandbox",
        summary: "Runtime will route this launch through the selected provider.",
        accessMode: "on-request",
        executionProfileId: "balanced-delegate",
        preferredBackendIds: ["backend-primary"],
        routedProvider: "openai",
        networkPolicy: "default",
        filesystemPolicy: "workspace_scoped",
        toolPosture: "workspace_safe",
        approvalSensitivity: "standard",
      },
      mcpSources: [
        {
          id: "workspace-skill:repo-guidance",
          label: "repo-guidance",
          kind: "workspace_skill",
          authority: "workspace",
          availability: "ready",
          summary: "Repo guidance",
        },
      ],
      toolCallRefs: [],
      toolResultRefs: [],
    } satisfies RuntimeToolingPlaneV2;
    const evalPlane = {
      summary: "Eval remains runtime-owned.",
      evalCases: [
        {
          id: "launch:balanced-delegate",
          label: "Balanced Delegate launch baseline",
          taskFamily: "github_issue",
          summary: "Keep launch stable.",
          successEnvelope: "Keep launch stable.",
          modelBaseline: "Balanced Delegate execution profile",
          regressionBudget: "No regression.",
          source: "runtime_prepare",
          trackedWorkarounds: [],
        },
      ],
      modelReleasePlaybook: ["Re-run governed eval cases."],
    } satisfies RuntimeEvalPlaneV2;

    expect(
      buildRuntimeLaunchPreparationInvocationSummary(toolingPlane.invocationCatalogRef)
    ).toEqual({
      bindingCount: 2,
      readyBindingCount: 1,
      blockedBindingCount: 1,
      notRequiredBindingCount: 0,
      requirementCount: 1,
    });
    expect(buildRuntimeLaunchPreparationContextPlaneSummary(contextPlane)).toBe(
      "Memory refs: 1 | Artifacts: 2 | Retention: window_and_memory | Compaction: executed, 2 step(s), 640B reduced"
    );
    expect(buildRuntimeLaunchPreparationToolingPlaneSummary(toolingPlane)).toBe(
      "Capabilities: 2 | Invocation bindings: 2 (1 ready, 1 blocked) | Invocation requirements: 1 | Tool posture: workspace_safe | Approval sensitivity: standard | MCP sources: 1"
    );
    expect(buildRuntimeLaunchPreparationEvalPlaneSummary(evalPlane)).toBe(
      "Eval cases: 1 | Baseline: Balanced Delegate execution profile | Playbook steps: 1"
    );
  });

  it("surfaces policy read failures without inventing runtime policy truth", () => {
    const summary = buildRuntimeMissionControlPolicyIndicator({
      runtimePolicy: null,
      runtimePolicyError: "Runtime policy RPC unavailable.",
    });

    expect(summary.statusLabel).toBe("Attention");
    expect(summary.error).toBe("Runtime policy RPC unavailable.");
    expect(summary.capabilities).toEqual([]);
    expect(summary.headline).toContain("waiting for runtime truth");
  });
});
