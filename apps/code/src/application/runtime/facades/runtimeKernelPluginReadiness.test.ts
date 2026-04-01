import { describe, expect, it } from "vitest";
import type { RuntimeKernelPluginDescriptor } from "../kernel/runtimeKernelPluginTypes";
import type { RuntimeExtensionActivationRecord } from "../kernel/runtimeExtensionActivation";
import {
  buildRuntimeKernelPluginReadinessEntries,
  buildRuntimeKernelPluginReadinessSections,
} from "./runtimeKernelPluginReadiness";

function buildPlugin(
  overrides: Partial<RuntimeKernelPluginDescriptor> = {}
): RuntimeKernelPluginDescriptor {
  return {
    id: "ext.shell",
    name: "Shell Tools",
    version: "1.0.0",
    summary: "Runtime shell helpers",
    source: "runtime_extension",
    transport: "runtime_extension",
    hostProfile: {
      kind: "runtime",
      executionBoundaries: ["runtime"],
    },
    workspaceId: null,
    enabled: true,
    runtimeBacked: true,
    capabilities: [],
    permissions: ["network"],
    resources: [],
    executionBoundaries: ["runtime"],
    binding: {
      state: "bound",
      contractFormat: "runtime_extension",
      contractBoundary: "runtime-extension",
      interfaceId: "ext.shell",
      surfaces: [],
    },
    operations: {
      execution: {
        executable: true,
        mode: "none",
        reason: null,
      },
      resources: {
        readable: false,
        mode: "none",
        reason: null,
      },
      permissions: {
        evaluable: true,
        mode: "runtime_extension_permissions",
        reason: null,
      },
    },
    metadata: null,
    permissionDecision: "allow",
    health: {
      state: "healthy",
      checkedAt: null,
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
        transport: "wasi_component",
        runtimeBacked: false,
        enabled: false,
        binding: {
          state: "declaration_only",
          contractFormat: "wasi_component",
          contractBoundary: "registry:wasi_component",
          interfaceId: "hugecode:plugin/future-host",
          surfaces: [],
        },
        operations: {
          execution: {
            executable: false,
            mode: "none",
            reason: "Installed package is not runtime-bound.",
          },
          resources: {
            readable: false,
            mode: "none",
            reason: "Installed package is not runtime-bound.",
          },
          permissions: {
            evaluable: false,
            mode: "none",
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
          checkedAt: null,
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
        transport: "repo_manifest",
        runtimeBacked: false,
        binding: {
          state: "declaration_only",
          contractFormat: "manifest",
          contractBoundary: "repository",
          interfaceId: "repo.skill",
          surfaces: [],
        },
        operations: {
          execution: {
            executable: false,
            mode: "none",
            reason: "Runtime has not published a bound provider for this manifest yet.",
          },
          resources: {
            readable: false,
            mode: "repo_manifest_resource",
            reason: "Manifest does not publish readable resources yet.",
          },
          permissions: {
            evaluable: false,
            mode: "repo_manifest_permissions",
            reason: "Runtime has not published a permission evaluation path for this manifest yet.",
          },
        },
        permissionDecision: "unsupported",
        health: {
          state: "unknown",
          checkedAt: null,
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
    const activationRecords: RuntimeExtensionActivationRecord[] = [
      {
        activationId: "behavior:workspace:repo.skill",
        sourceType: "behavior_asset",
        sourceScope: "workspace",
        sourceRef: "repo.skill",
        pluginId: "repo.skill",
        packageRef: null,
        overlayId: null,
        sessionId: null,
        name: "Repository Skill",
        version: "1.0.0",
        state: "active",
        readiness: {
          state: "ready",
          summary: "Behavior asset is active.",
          detail: "Compiled behavior asset published live runtime contributions.",
        },
        diagnostics: [],
        contributions: [],
        transitionHistory: [],
        metadata: null,
      },
    ];

    const entries = buildRuntimeKernelPluginReadinessEntries(
      [
        buildPlugin({
          id: "repo.skill",
          name: "Repository Skill",
          source: "repo_manifest",
          transport: "repo_manifest",
          runtimeBacked: false,
          binding: {
            state: "declaration_only",
            contractFormat: "manifest",
            contractBoundary: "repository",
            interfaceId: "repo.skill",
            surfaces: [],
          },
          operations: {
            execution: {
              executable: false,
              mode: "none",
              reason: "Repository declaration only.",
            },
            resources: {
              readable: false,
              mode: "none",
              reason: "Repository declaration only.",
            },
            permissions: {
              evaluable: false,
              mode: "none",
              reason: "Repository declaration only.",
            },
          },
          permissionDecision: "unsupported",
          health: {
            state: "unknown",
            checkedAt: null,
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
