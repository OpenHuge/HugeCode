import { describe, expect, it } from "vitest";
import type {
  RuntimeCompositionProfile,
  RuntimeCompositionResolution,
} from "@ku0/code-runtime-host-contract";
import {
  normalizeRuntimePreferredBackendIds,
  readRuntimeCompositionPreferredBackendIds,
  readRuntimeCompositionResolvedBackendId,
  resolveRuntimeCompositionSelectedBackendCandidates,
  resolveRuntimePreferredBackendIdsInput,
} from "./runtimeBackendPreferences";
import { buildDefaultRuntimeCompositionProfiles } from "./runtimeCompositionProfiles";

function createWorkspaceProfile(): RuntimeCompositionProfile {
  const profile = buildDefaultRuntimeCompositionProfiles().find(
    (entry): entry is RuntimeCompositionProfile => entry.scope === "workspace"
  );
  if (!profile) {
    throw new Error("Expected workspace profile.");
  }
  return profile;
}

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
      appliedLayerOrder: ["built_in", "user", "workspace", "launch_override"],
      selectorDecisions: {},
    },
    ...overrides,
  };
}

describe("runtimeBackendPreferences", () => {
  it("normalizes preferred backend ids and removes blanks and duplicates", () => {
    expect(
      normalizeRuntimePreferredBackendIds([" backend-a ", "", "backend-a", "backend-b"])
    ).toEqual(["backend-a", "backend-b"]);
    expect(normalizeRuntimePreferredBackendIds([])).toBeUndefined();
    expect(normalizeRuntimePreferredBackendIds(null)).toBeUndefined();
  });

  it("resolves explicit, launch-default, and fallback backend ids in priority order", () => {
    expect(
      resolveRuntimePreferredBackendIdsInput({
        preferredBackendIds: ["backend-explicit", "backend-explicit", "backend-next"],
        defaultBackendId: "backend-launch",
        fallbackDefaultBackendId: "backend-fallback",
      })
    ).toEqual(["backend-explicit", "backend-next"]);

    expect(
      resolveRuntimePreferredBackendIdsInput({
        preferredBackendIds: [],
        defaultBackendId: " backend-launch ",
        fallbackDefaultBackendId: "backend-fallback",
      })
    ).toEqual(["backend-launch"]);

    expect(
      resolveRuntimePreferredBackendIdsInput({
        fallbackDefaultBackendId: " backend-fallback ",
      })
    ).toEqual(["backend-fallback"]);
  });

  it("collects backend candidates from profile defaults, selected routes, and resolved backends", () => {
    const profile = createWorkspaceProfile();
    profile.backendPolicy.preferredBackendIds = ["backend-primary"];
    profile.backendPolicy.resolvedBackendId = "backend-profile";

    expect(
      resolveRuntimeCompositionSelectedBackendCandidates({
        effectiveProfile: profile,
        selectedRouteCandidates: [
          {
            pluginId: "route:alpha",
            preferredBackendIds: ["backend-route", "backend-primary"],
            resolvedBackendId: "backend-route-resolved",
          },
        ],
      })
    ).toEqual([
      { backendId: "backend-primary", sourcePluginId: null },
      { backendId: "backend-route", sourcePluginId: "route:alpha" },
      { backendId: "backend-route-resolved", sourcePluginId: "route:alpha" },
      { backendId: "backend-profile", sourcePluginId: null },
    ]);
  });

  it("reads preferred and resolved backend details from runtime composition state", () => {
    const profile = createWorkspaceProfile();
    profile.backendPolicy.resolvedBackendId = "backend-profile";

    const resolution = createResolution({
      selectedRouteCandidates: [
        {
          pluginId: "route:default",
          preferredBackendIds: ["backend-route-a", "backend-route-b", "backend-route-a"],
          resolvedBackendId: "backend-route-resolved",
        },
      ],
      selectedBackendCandidates: [
        { backendId: "backend-route-a", sourcePluginId: "route:default" },
        { backendId: "backend-route-b", sourcePluginId: "route:default" },
        { backendId: "backend-route-a", sourcePluginId: "route:default" },
      ],
    });

    expect(readRuntimeCompositionPreferredBackendIds(resolution)).toEqual([
      "backend-route-a",
      "backend-route-b",
    ]);
    expect(
      readRuntimeCompositionResolvedBackendId({
        selectedRoute: "default",
        activeProfile: profile,
        resolution,
      })
    ).toBe("backend-route-resolved");
    expect(
      readRuntimeCompositionResolvedBackendId({
        selectedRoute: "other",
        activeProfile: profile,
        resolution,
      })
    ).toBe("backend-profile");
  });
});
