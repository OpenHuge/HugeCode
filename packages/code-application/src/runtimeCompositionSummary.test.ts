import { describe, expect, it } from "vitest";
import type { RuntimeCompositionResolution } from "@ku0/code-runtime-host-contract";
import {
  buildRuntimeCompositionAuthoritySummary,
  buildRuntimeCompositionResolutionSummary,
} from "./runtimeCompositionSummary";

function createResolution(
  overrides: Partial<RuntimeCompositionResolution> = {}
): RuntimeCompositionResolution {
  return {
    selectedPlugins: [],
    selectedRouteCandidates: [],
    selectedBackendCandidates: [],
    blockedPlugins: [],
    trustDecisions: [],
    provenance: {
      activeProfileId: "workspace-default",
      activeProfileName: "Workspace Default",
      appliedLayerOrder: ["built_in", "user", "workspace", "launch_override"],
      selectorDecisions: {},
    },
    ...overrides,
  };
}

describe("runtimeCompositionSummary", () => {
  it("summarizes backend candidates, layer order, and selection counts", () => {
    expect(
      buildRuntimeCompositionResolutionSummary(
        createResolution({
          selectedPlugins: [
            { pluginId: "plugin-a", source: "runtime", reason: null },
            { pluginId: "plugin-b", source: "workspace", reason: null },
          ],
          blockedPlugins: [{ pluginId: "plugin-c", reason: "blocked", stage: "trust" }],
          selectedRouteCandidates: [{ pluginId: "route:default" }],
          selectedBackendCandidates: [
            { backendId: "backend-a", sourcePluginId: null },
            { backendId: "backend-b", sourcePluginId: "route:default" },
            { backendId: "backend-a", sourcePluginId: "route:default" },
          ],
        })
      )
    ).toEqual({
      selectedPluginCount: 2,
      blockedPluginCount: 1,
      routeCandidateCount: 1,
      selectedBackendCount: 2,
      preferredBackendIds: ["backend-a", "backend-b"],
      backendSummary: "backend-a, backend-b",
      layerSummary: "built_in -> user -> workspace -> launch_override",
      countsSummary: "Selected plugins 2, blocked plugins 1, route candidates 1.",
    });
  });

  it("falls back to runtime defaults when no resolution exists", () => {
    expect(buildRuntimeCompositionResolutionSummary(null)).toEqual({
      selectedPluginCount: 0,
      blockedPluginCount: 0,
      routeCandidateCount: 0,
      selectedBackendCount: 0,
      preferredBackendIds: [],
      backendSummary: "runtime fallback",
      layerSummary: "runtime default",
      countsSummary: "Selected plugins 0, blocked plugins 0, route candidates 0.",
    });
    expect(buildRuntimeCompositionAuthoritySummary(null)).toBe("unavailable");
  });

  it("summarizes authority state from runtime snapshots", () => {
    expect(
      buildRuntimeCompositionAuthoritySummary({
        authorityState: "published",
        freshnessState: "current",
      })
    ).toBe("published / current");
  });
});
