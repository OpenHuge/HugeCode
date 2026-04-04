import { describe, expect, it } from "vitest";
import type {
  RuntimeCompositionProfile,
  RuntimeCompositionResolution,
} from "@ku0/code-runtime-host-contract";
import { buildRuntimeControlPlaneOperatorModel } from "./runtimeKernelControlPlaneOperatorModel";
import type { RuntimeKernelPluginDescriptor } from "../kernel/runtimeKernelPlugins";

function buildProfile(
  overrides: Partial<RuntimeCompositionProfile> = {}
): RuntimeCompositionProfile {
  return {
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
    ...overrides,
  };
}

function buildResolution(
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

function buildPlugin(
  overrides: Partial<RuntimeKernelPluginDescriptor> = {}
): RuntimeKernelPluginDescriptor {
  return {
    id: "pkg.search.remote",
    name: "Remote Search Tools",
    version: "1.0.0",
    summary: "Registry package",
    source: "mcp_remote",
    transport: "mcp_remote",
    hostProfile: {
      kind: "remote",
      executionBoundaries: ["registry"],
    },
    workspaceId: null,
    enabled: true,
    runtimeBacked: false,
    capabilities: [],
    permissions: ["network"],
    resources: [],
    executionBoundaries: ["registry"],
    binding: {
      state: "declaration_only",
      contractFormat: "mcp",
      contractBoundary: "registry:mcp_remote",
      interfaceId: "pkg.search.remote",
      surfaces: [],
    },
    operations: {
      execution: {
        executable: false,
        mode: "none",
        reason: "Registry package is not runtime-bound.",
      },
      resources: {
        readable: false,
        mode: "none",
        reason: "Registry package is not runtime-bound.",
      },
      permissions: {
        evaluable: false,
        mode: "none",
        reason: "Registry package is not runtime-bound.",
      },
    },
    metadata: null,
    permissionDecision: null,
    health: null,
    ...overrides,
  };
}

describe("runtimeKernelControlPlaneOperatorModel", () => {
  it("surfaces install, profile preview, and apply actions from catalog and composition state", () => {
    const model = buildRuntimeControlPlaneOperatorModel({
      plugins: [
        buildPlugin({
          metadata: {
            pluginRegistry: {
              packageRef: "hugecode.mcp.search@1.0.0",
              transport: "mcp_remote",
              source: "catalog",
              installed: false,
              installedPluginId: null,
              publisher: "HugeCode Labs",
              trust: {
                status: "verified",
                verificationStatus: "verified",
                publisher: "HugeCode Labs",
                attestationSource: "sigstore",
                blockedReason: null,
                packageRef: "hugecode.mcp.search@1.0.0",
                pluginId: "pkg.search.remote",
              },
              compatibility: {
                status: "compatible",
                minimumHostContractVersion: "2026-03-25",
                supportedRuntimeProtocolVersions: ["2026-03-25"],
                supportedCapabilityKeys: ["plugins.catalog", "plugins.registry"],
                optionalTransportFeatures: [],
                blockers: [],
              },
            },
          },
        }),
      ],
      profiles: [buildProfile()],
      activeProfile: buildProfile(),
      activeProfileId: "workspace-default",
      resolution: buildResolution(),
    });

    expect(model.counts.needsAction).toBe(1);
    expect(model.needsAction[0]?.actions.map((action) => action.kind)).toContain("install");
    expect(model.profiles[0]?.actions.map((action) => action.kind)).toEqual([
      "preview_profile",
      "apply_profile",
    ]);
    expect(model.profiles[0]?.actions[1]?.disabledReason).toContain("already active");
  });

  it("offers a disabled dev trust override when the active profile forbids it", () => {
    const activeProfile = buildProfile({
      trustPolicy: {
        requireVerifiedSignatures: true,
        allowDevOverrides: false,
        blockedPublishers: [],
      },
    });
    const model = buildRuntimeControlPlaneOperatorModel({
      plugins: [
        buildPlugin({
          id: "pkg.unsigned.remote",
          name: "Unsigned Remote Lab",
          metadata: {
            pluginRegistry: {
              packageRef: "hugecode.mcp.unsigned-lab@0.3.0",
              transport: "mcp_remote",
              source: "catalog",
              installed: false,
              installedPluginId: null,
              publisher: "local-dev",
              trust: {
                status: "blocked",
                verificationStatus: "missing_signature",
                publisher: "local-dev",
                attestationSource: "manifest",
                blockedReason: "Unsigned local-dev package.",
                packageRef: "hugecode.mcp.unsigned-lab@0.3.0",
                pluginId: "pkg.unsigned.remote",
              },
              compatibility: {
                status: "compatible",
                minimumHostContractVersion: "2026-03-25",
                supportedRuntimeProtocolVersions: ["2026-03-25"],
                supportedCapabilityKeys: ["plugins.catalog", "plugins.registry"],
                optionalTransportFeatures: [],
                blockers: [],
              },
            },
            composition: {
              activeProfileId: "workspace-default",
              activeProfileName: "Workspace Default",
              selectedInActiveProfile: false,
              blockedInActiveProfile: false,
              blockedReason: null,
              selectedRouteCandidate: false,
              selectedBackendCandidateIds: [],
              layerOrder: ["built_in", "user", "workspace", "launch_override"],
            },
          },
        }),
      ],
      profiles: [activeProfile],
      activeProfile,
      activeProfileId: activeProfile.id,
      resolution: buildResolution(),
    });

    expect(model.needsAction[0]?.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "install_with_dev_override",
          disabledReason:
            "The active composition profile does not allow development trust overrides.",
        }),
      ])
    );
  });

  it("keeps ordinary installed plugins out of the needs-action bucket", () => {
    const activeProfile = buildProfile();
    const model = buildRuntimeControlPlaneOperatorModel({
      plugins: [
        buildPlugin({
          metadata: {
            pluginRegistry: {
              packageRef: "hugecode.mcp.search@1.0.0",
              transport: "mcp_remote",
              source: "installed",
              installed: true,
              installedPluginId: "pkg.search.remote",
              publisher: "HugeCode Labs",
              trust: {
                status: "verified",
                verificationStatus: "verified",
                publisher: "HugeCode Labs",
                attestationSource: "sigstore",
                blockedReason: null,
                packageRef: "hugecode.mcp.search@1.0.0",
                pluginId: "pkg.search.remote",
              },
              compatibility: {
                status: "compatible",
                minimumHostContractVersion: "2026-03-25",
                supportedRuntimeProtocolVersions: ["2026-03-25"],
                supportedCapabilityKeys: ["plugins.catalog", "plugins.registry"],
                optionalTransportFeatures: [],
                blockers: [],
              },
            },
            composition: {
              activeProfileId: activeProfile.id,
              activeProfileName: activeProfile.name,
              selectedInActiveProfile: true,
              blockedInActiveProfile: false,
              blockedReason: null,
              selectedRouteCandidate: false,
              selectedBackendCandidateIds: [],
              layerOrder: ["built_in", "user", "workspace", "launch_override"],
            },
          },
        }),
      ],
      profiles: [activeProfile],
      activeProfile,
      activeProfileId: activeProfile.id,
      resolution: buildResolution({
        selectedPlugins: [
          {
            pluginId: "pkg.search.remote",
            packageRef: "hugecode.mcp.search@1.0.0",
            source: "catalog",
            reason: null,
          },
        ],
      }),
    });

    expect(model.counts.needsAction).toBe(0);
    expect(model.needsAction).toEqual([]);
    expect(model.counts.selectedNow).toBe(1);
    expect(model.selectedNow[0]?.actions.map((action) => action.kind)).toEqual([
      "update",
      "uninstall",
    ]);
  });

  it("distinguishes declaration-only publication from binding", () => {
    const activeProfile = buildProfile();
    const model = buildRuntimeControlPlaneOperatorModel({
      plugins: [
        buildPlugin({
          id: "repo.skill",
          name: "Repo Skill",
          source: "repo_manifest",
          transport: "repo_manifest",
          metadata: {
            composition: {
              activeProfileId: activeProfile.id,
              activeProfileName: activeProfile.name,
              selectedInActiveProfile: false,
              blockedInActiveProfile: false,
              blockedReason: null,
              selectedRouteCandidate: false,
              selectedBackendCandidateIds: [],
              layerOrder: ["built_in", "user", "workspace", "launch_override"],
              bindingState: "unbound",
              publicationState: "declaration_only",
              trustStatus: "runtime_managed",
              compatibilityStatus: "compatible",
              bindingDiagnostics: [],
            },
          },
        }),
      ],
      profiles: [activeProfile],
      activeProfile,
      activeProfileId: activeProfile.id,
      resolution: buildResolution(),
    });

    expect(model.inventory[0]).toMatchObject({
      statusLabel: "Declared",
      bindingState: "unbound",
      publicationState: "declaration_only",
    });
    expect(model.inventory[0]?.stateSummary).toContain("Publish declaration_only");
  });

  it("surfaces authority-unavailable composition state as operator attention", () => {
    const activeProfile = buildProfile();
    const model = buildRuntimeControlPlaneOperatorModel({
      plugins: [
        buildPlugin({
          metadata: {
            composition: {
              activeProfileId: activeProfile.id,
              activeProfileName: activeProfile.name,
              authorityState: "unavailable",
              authorityRevision: null,
              selectedInActiveProfile: false,
              blockedInActiveProfile: false,
              blockedReason: null,
              selectedRouteCandidate: false,
              selectedBackendCandidateIds: [],
              layerOrder: ["built_in", "user", "workspace", "launch_override"],
            },
          },
        }),
      ],
      profiles: [activeProfile],
      activeProfile,
      activeProfileId: activeProfile.id,
      resolution: buildResolution(),
    });

    expect(model.inventory[0]?.statusLabel).toBe("Authority unavailable");
    expect(model.inventory[0]?.stateSummary).toContain("Authority unavailable");
    expect(model.inventory[0]?.attentionReason).toContain("has not published");
  });
});
