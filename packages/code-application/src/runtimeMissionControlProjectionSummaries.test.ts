import { describe, expect, it } from "vitest";
import type { RuntimePolicySnapshot } from "@ku0/code-runtime-host-contract";
import {
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
