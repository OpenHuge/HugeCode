import { describe, expect, it } from "vitest";
import {
  buildRuntimeKernelPluginReadinessEntries,
  buildRuntimeKernelPluginReadinessSections,
} from "./runtime-control-plane/runtimeKernelPluginReadiness";
import type {
  RuntimeMissionControlActivationRecord,
  RuntimeMissionControlPluginDescriptor,
} from "./runtime-control-plane/runtimeMissionControlPluginCatalogTypes";

function buildPlugin(
  overrides: Partial<RuntimeMissionControlPluginDescriptor> = {}
): RuntimeMissionControlPluginDescriptor {
  return {
    id: "ext.shell",
    name: "Shell Tools",
    version: "1.0.0",
    source: "runtime_extension",
    enabled: true,
    runtimeBacked: true,
    capabilities: [],
    permissions: ["network"],
    binding: {
      state: "bound",
      surfaces: [],
    },
    operations: {
      execution: {
        executable: true,
        reason: null,
      },
      resources: {
        readable: false,
        reason: null,
      },
      permissions: {
        evaluable: true,
        reason: null,
      },
    },
    metadata: null,
    permissionDecision: "allow",
    health: {
      state: "healthy",
      warnings: [],
    },
    ...overrides,
  };
}

describe("runtimeKernelPluginReadiness", () => {
  it("places ready selected plugins into the selected-now section", () => {
    const entries = buildRuntimeKernelPluginReadinessEntries([
      buildPlugin({
        metadata: {
          composition: {
            activeProfileId: "workspace-default",
            activeProfileName: "Workspace Default",
            selectedInActiveProfile: true,
            blockedInActiveProfile: false,
            blockedReason: null,
            selectedRouteCandidate: false,
            selectedBackendCandidateIds: [],
            layerOrder: ["built_in", "workspace"],
          },
        },
      }),
    ]);

    expect(entries).toEqual([
      expect.objectContaining({
        id: "ext.shell",
        readiness: expect.objectContaining({
          state: "ready",
        }),
        selectionState: expect.objectContaining({
          kind: "selected_in_active_profile",
          label: "Selected in active profile",
          state: "ready",
        }),
        trustState: expect.objectContaining({
          kind: "runtime_published",
          label: "Runtime-published",
        }),
      }),
    ]);
    expect(buildRuntimeKernelPluginReadinessSections(entries)[1]).toEqual(
      expect.objectContaining({
        id: "selected_now",
        entries: [expect.objectContaining({ id: "ext.shell" })],
      })
    );
  });

  it("treats incompatible registry packages as blocked readiness, not mere attention", () => {
    const entries = buildRuntimeKernelPluginReadinessEntries([
      buildPlugin({
        id: "pkg.future.wasi",
        name: "Future WASI Host",
        source: "wasi_component",
        runtimeBacked: false,
        enabled: false,
        binding: {
          state: "declaration_only",
          surfaces: [],
        },
        operations: {
          execution: {
            executable: false,
            reason: "Installed package is not runtime-bound.",
          },
          resources: {
            readable: false,
            reason: "Installed package is not runtime-bound.",
          },
          permissions: {
            evaluable: false,
            reason:
              "Installed package does not publish runtime-evaluable permissions until activation.",
          },
        },
        permissionDecision: "unsupported",
        metadata: {
          pluginRegistry: {
            packageRef: "hugecode.wasi.future-host@2.0.0",
            transport: "wasi_component",
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
              packageRef: "hugecode.wasi.future-host@2.0.0",
              pluginId: "pkg.future.wasi",
            },
            compatibility: {
              status: "incompatible",
              minimumHostContractVersion: "999.0.0",
              supportedRuntimeProtocolVersions: ["1.0.0"],
              supportedCapabilityKeys: ["plugins.catalog"],
              optionalTransportFeatures: [],
              blockers: [
                "Requires a newer host contract version than the current runtime exposes.",
              ],
            },
          },
        },
        health: {
          state: "unknown",
          warnings: [],
        },
      }),
    ]);

    expect(entries).toEqual([
      expect.objectContaining({
        id: "pkg.future.wasi",
        readiness: expect.objectContaining({
          state: "blocked",
        }),
        trustState: expect.objectContaining({
          kind: "incompatible",
          label: "Incompatible",
          state: "blocked",
        }),
        remediationSummary:
          "Install a package version compatible with the current runtime host contract before launch.",
      }),
    ]);
    expect(buildRuntimeKernelPluginReadinessSections(entries)[0]).toEqual(
      expect.objectContaining({
        id: "needs_action",
        entries: [expect.objectContaining({ id: "pkg.future.wasi" })],
      })
    );
  });

  it("keeps repository declarations in the needs-action section with repository-local trust context", () => {
    const entries = buildRuntimeKernelPluginReadinessEntries([
      buildPlugin({
        id: "repo.skill",
        name: "Repository Skill",
        source: "repo_manifest",
        runtimeBacked: false,
        binding: {
          state: "declaration_only",
          surfaces: [],
        },
        operations: {
          execution: {
            executable: false,
            reason: "Runtime has not published a bound provider for this manifest yet.",
          },
          resources: {
            readable: false,
            reason: "Manifest does not publish readable resources yet.",
          },
          permissions: {
            evaluable: false,
            reason: "Runtime has not published a permission evaluation path for this manifest yet.",
          },
        },
        permissionDecision: "unsupported",
        health: {
          state: "unknown",
          warnings: [],
        },
      }),
    ]);

    expect(entries).toEqual([
      expect.objectContaining({
        id: "repo.skill",
        readiness: expect.objectContaining({
          state: "attention",
        }),
        selectionState: expect.objectContaining({
          kind: "repository_declaration",
          label: "Repository declaration",
        }),
        trustState: expect.objectContaining({
          kind: "repository_local",
          label: "Repository-local",
          state: "attention",
        }),
      }),
    ]);
    expect(buildRuntimeKernelPluginReadinessSections(entries)[0]).toEqual(
      expect.objectContaining({
        id: "needs_action",
        entries: [expect.objectContaining({ id: "repo.skill" })],
      })
    );
  });

  it("treats plugins blocked by the active profile as blocked readiness with profile remediation", () => {
    const entries = buildRuntimeKernelPluginReadinessEntries([
      buildPlugin({
        id: "ext.blocked",
        name: "Blocked Extension",
        metadata: {
          composition: {
            activeProfileId: "workspace-default",
            activeProfileName: "Workspace Default",
            selectedInActiveProfile: false,
            blockedInActiveProfile: true,
            blockedReason: "Workspace Default currently excludes this plugin from launch.",
            selectedRouteCandidate: false,
            selectedBackendCandidateIds: [],
            layerOrder: ["built_in", "workspace"],
          },
        },
      }),
    ]);

    expect(entries).toEqual([
      expect.objectContaining({
        id: "ext.blocked",
        readiness: expect.objectContaining({
          state: "blocked",
          detail: "Workspace Default currently excludes this plugin from launch.",
        }),
        selectionState: expect.objectContaining({
          kind: "blocked_in_active_profile",
          label: "Blocked in active profile",
          state: "blocked",
        }),
        remediationSummary:
          "Adjust the active runtime profile or remove the blocking rule before relying on this plugin.",
      }),
    ]);
    expect(buildRuntimeKernelPluginReadinessSections(entries)[0]).toEqual(
      expect.objectContaining({
        id: "needs_action",
        entries: [expect.objectContaining({ id: "ext.blocked" })],
      })
    );
  });

  it("promotes repository declarations to ready when activation truth says the behavior asset is active", () => {
    const activationRecords: RuntimeMissionControlActivationRecord[] = [
      {
        activationId: "behavior:workspace:repo.skill",
        state: "active",
        readiness: {
          detail: "Compiled behavior asset published live runtime contributions.",
        },
      },
    ];

    const entries = buildRuntimeKernelPluginReadinessEntries(
      [
        buildPlugin({
          id: "repo.skill",
          name: "Repository Skill",
          source: "repo_manifest",
          runtimeBacked: false,
          binding: {
            state: "declaration_only",
            surfaces: [],
          },
          operations: {
            execution: {
              executable: false,
              reason: "Repository declaration only.",
            },
            resources: {
              readable: false,
              reason: "Repository declaration only.",
            },
            permissions: {
              evaluable: false,
              reason: "Repository declaration only.",
            },
          },
          permissionDecision: "unsupported",
          health: {
            state: "unknown",
            warnings: [],
          },
        }),
      ],
      activationRecords
    );

    expect(entries).toEqual([
      expect.objectContaining({
        id: "repo.skill",
        readiness: expect.objectContaining({
          state: "ready",
          detail: "Compiled behavior asset published live runtime contributions.",
        }),
        activationState: expect.objectContaining({
          lifecycle: "active",
          label: "Active",
          state: "ready",
        }),
        remediationSummary: "No operator action required.",
      }),
    ]);
    expect(buildRuntimeKernelPluginReadinessSections(entries)[2]).toEqual(
      expect.objectContaining({
        id: "inventory",
        entries: [expect.objectContaining({ id: "repo.skill" })],
      })
    );
  });
});
