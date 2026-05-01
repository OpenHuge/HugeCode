import { describe, expect, it } from "vitest";
import {
  RUNTIME_COMPOSITION_BUILT_IN_CODEX_BACKEND_ID,
  RUNTIME_COMPOSITION_BUILT_IN_CODEX_ROUTE_PLUGIN_ID,
} from "@ku0/code-platform-interfaces";
import type { RuntimeCompositionProfile } from "@ku0/code-runtime-host-contract";
import {
  applyRuntimeCompositionProfileUpdates,
  buildDefaultRuntimeCompositionProfiles,
  cloneRuntimeCompositionProfile,
  mergeRuntimeCompositionProfiles,
  type RuntimeCompositionProfileUpdates,
} from "./runtimeCompositionProfiles";

describe("runtimeCompositionProfiles", () => {
  it("builds stable default profiles without sharing mutable references", () => {
    const first = buildDefaultRuntimeCompositionProfiles();
    const second = buildDefaultRuntimeCompositionProfiles();

    expect(first.map((profile) => profile.scope)).toEqual(["built_in", "user", "workspace"]);
    expect(first[0]?.pluginSelectors).toEqual([
      expect.objectContaining({
        action: "prefer",
        matchBy: "pluginId",
        matchValue: RUNTIME_COMPOSITION_BUILT_IN_CODEX_ROUTE_PLUGIN_ID,
      }),
    ]);
    expect(first[0]?.routePolicy.preferredRoutePluginIds).toEqual([
      RUNTIME_COMPOSITION_BUILT_IN_CODEX_ROUTE_PLUGIN_ID,
    ]);
    expect(first[1]?.backendPolicy.preferredBackendIds).toEqual([
      RUNTIME_COMPOSITION_BUILT_IN_CODEX_BACKEND_ID,
    ]);
    expect(second).toEqual(first);

    first[0]?.trustPolicy.blockedPublishers?.push("Mutated Publisher");

    expect(second[0]?.trustPolicy.blockedPublishers).toEqual([]);
  });

  it("merges built-in, user, workspace, and launch override layers deterministically", () => {
    const profiles = buildDefaultRuntimeCompositionProfiles();
    const workspaceProfile = profiles.find(
      (profile): profile is RuntimeCompositionProfile => profile.scope === "workspace"
    );

    if (!workspaceProfile) {
      throw new Error("Expected workspace profile.");
    }

    const merged = mergeRuntimeCompositionProfiles(profiles, workspaceProfile.id, {
      pluginSelectors: [
        {
          matchBy: "pluginId",
          matchValue: "plugin.launch",
          action: "include",
          reason: "Launch-scoped include.",
        },
      ],
      routePolicy: {
        preferredRoutePluginIds: ["route.launch"],
      },
      backendPolicy: {
        resolvedBackendId: "backend-launch",
      },
      trustPolicy: {
        blockedPublishers: ["Launch Publisher"],
      },
      executionPolicyRefs: ["launch/override"],
      observabilityPolicy: {
        emitStableEvents: false,
      },
      configLayers: [
        {
          id: "launch-override",
          source: "workspace",
          summary: "Launch-only layer should be normalized.",
        },
      ],
    });

    expect(merged.id).toBe(workspaceProfile.id);
    expect(merged.scope).toBe("workspace");
    expect(merged.pluginSelectors.map((selector) => selector.matchValue)).toContain(
      "plugin.launch"
    );
    expect(merged.routePolicy.preferredRoutePluginIds).toEqual(["route.launch"]);
    expect(merged.backendPolicy.resolvedBackendId).toBe("backend-launch");
    expect(merged.trustPolicy.blockedPublishers).toEqual(["Launch Publisher"]);
    expect(merged.executionPolicyRefs).toContain("launch/override");
    expect(merged.observabilityPolicy.emitStableEvents).toBe(false);
    expect(merged.configLayers.at(-1)).toEqual({
      id: "launch-override",
      source: "launch_override",
      summary: "Launch-only layer should be normalized.",
    });

    expect(workspaceProfile.configLayers.at(-1)?.source).toBe("workspace");
  });

  it("applies profile updates without mutating protected identity fields", () => {
    const workspaceProfile = buildDefaultRuntimeCompositionProfiles().find(
      (profile): profile is RuntimeCompositionProfile => profile.scope === "workspace"
    );

    if (!workspaceProfile) {
      throw new Error("Expected workspace profile.");
    }

    const updated = applyRuntimeCompositionProfileUpdates(workspaceProfile, {
      name: "Workspace Override",
      enabled: false,
      pluginSelectors: [
        {
          matchBy: "pluginId",
          matchValue: "plugin.test",
          action: "exclude",
          reason: "Workspace blocklist",
        },
      ],
      routePolicy: {
        providerPreference: ["anthropic"],
      },
      backendPolicy: {
        preferredBackendIds: ["backend-custom"],
      },
      trustPolicy: {
        blockedPublishers: ["Blocked Publisher"],
      },
      executionPolicyRefs: ["workspace/custom"],
      observabilityPolicy: {
        emitOtelAlignedTelemetry: false,
      },
      configLayers: [
        {
          id: "workspace-custom",
          source: "workspace",
          summary: "Workspace override layer.",
        },
      ],
    } satisfies RuntimeCompositionProfileUpdates);

    expect(updated.id).toBe(workspaceProfile.id);
    expect(updated.scope).toBe("workspace");
    expect(updated.name).toBe("Workspace Override");
    expect(updated.enabled).toBe(false);
    expect(updated.pluginSelectors).toEqual([
      expect.objectContaining({
        matchValue: "plugin.test",
      }),
    ]);
    expect(updated.routePolicy.providerPreference).toEqual(["anthropic"]);
    expect(updated.backendPolicy.preferredBackendIds).toEqual(["backend-custom"]);
    expect(updated.trustPolicy.blockedPublishers).toEqual(["Blocked Publisher"]);
    expect(updated.executionPolicyRefs).toEqual(["workspace/custom"]);
    expect(updated.observabilityPolicy.emitOtelAlignedTelemetry).toBe(false);
    expect(updated.configLayers).toEqual([
      {
        id: "workspace-custom",
        source: "workspace",
        summary: "Workspace override layer.",
      },
    ]);
    expect(workspaceProfile.name).toBe("Workspace Default");
  });

  it("clones profiles deeply enough for array and nested policy isolation", () => {
    const profile = buildDefaultRuntimeCompositionProfiles()[0];
    if (!profile) {
      throw new Error("Expected built-in profile.");
    }

    const cloned = cloneRuntimeCompositionProfile(profile);
    cloned.executionPolicyRefs.push("mutated/ref");
    cloned.trustPolicy.blockedPublishers?.push("Mutated Publisher");

    expect(profile.executionPolicyRefs).toEqual(["built-in/runtime-default"]);
    expect(profile.trustPolicy.blockedPublishers).toEqual([]);
  });
});
