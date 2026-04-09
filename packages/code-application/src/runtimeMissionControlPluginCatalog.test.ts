import { describe, expect, it } from "vitest";
import {
  buildRuntimeKernelPluginReadinessEntries,
  buildRuntimeKernelPluginReadinessSections,
  buildRuntimeMissionControlPluginCatalogSummary,
  type RuntimeMissionControlPluginDescriptor,
} from "./runtime-control-plane/runtimeMissionControlPluginCatalog";

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

describe("runtimeMissionControlPluginCatalog", () => {
  it("builds a shared plugin catalog summary from runtime truth", () => {
    const summary = buildRuntimeMissionControlPluginCatalogSummary({
      plugins: [
        buildPlugin({
          id: "route:preferred",
          name: "Preferred Route",
          source: "provider_route",
          metadata: {
            routeKind: "provider_family",
            routeValue: "preferred",
            readiness: "ready",
            launchAllowed: true,
            providerId: "openai",
            providerLabel: "OpenAI",
            provenance: "backend_preference",
            preferredBackendIds: ["backend-a"],
            pluginRegistry: {
              packageRef: "registry://route",
              transport: "mcp_remote",
              source: "catalog",
              installed: true,
              installedPluginId: "route:preferred",
              publisher: "HugeCode",
              trust: {
                status: "verified",
                verificationStatus: "verified",
                publisher: "HugeCode",
                attestationSource: "sigstore",
                blockedReason: null,
                packageRef: "registry://route",
                pluginId: "route:preferred",
              },
              compatibility: {
                status: "compatible",
                minimumHostContractVersion: null,
                supportedRuntimeProtocolVersions: [],
                supportedCapabilityKeys: [],
                optionalTransportFeatures: [],
                blockers: [],
              },
            },
            composition: {
              activeProfileId: "workspace-default",
              activeProfileName: "Workspace Default",
              selectedInActiveProfile: true,
              blockedInActiveProfile: false,
              blockedReason: null,
              selectedRouteCandidate: true,
              selectedBackendCandidateIds: ["backend-a"],
              layerOrder: ["built_in", "workspace"],
            },
          },
        }),
      ],
      error: null,
      projectionBacked: true,
      registryPackages: [
        {
          source: "catalog",
        },
      ],
    });

    expect(summary).toMatchObject({
      total: 1,
      routingCount: 1,
      providerRouteCount: 1,
      readyRouteCount: 1,
      externalPackageCount: 1,
      verifiedPackageCount: 1,
      selectedInActiveProfileCount: 1,
      projectionBacked: true,
      status: {
        label: "Ready",
        tone: "success",
      },
    });
    expect(summary.readinessSections[1]).toEqual(
      expect.objectContaining({
        id: "selected_now",
        entries: [expect.objectContaining({ id: "route:preferred" })],
      })
    );
  });

  it("treats incompatible registry packages as blocked readiness", () => {
    const entries = buildRuntimeKernelPluginReadinessEntries([
      buildPlugin({
        id: "pkg.future.wasi",
        name: "Future WASI Host",
        source: "wasi_component",
        enabled: false,
        runtimeBacked: false,
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
            packageRef: "registry://future-wasi",
            transport: "wasi_component",
            source: "catalog",
            installed: true,
            installedPluginId: "pkg.future.wasi",
            publisher: "Future Labs",
            trust: {
              status: "verified",
              verificationStatus: "verified",
              publisher: "Future Labs",
              attestationSource: "sigstore",
              blockedReason: null,
              packageRef: "registry://future-wasi",
              pluginId: "pkg.future.wasi",
            },
            compatibility: {
              status: "incompatible",
              minimumHostContractVersion: null,
              supportedRuntimeProtocolVersions: [],
              supportedCapabilityKeys: [],
              optionalTransportFeatures: [],
              blockers: ["Requires a newer host contract."],
            },
          },
        },
        health: {
          state: "unsupported",
          warnings: ["Requires a newer host contract."],
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
          state: "blocked",
        }),
      }),
    ]);
    expect(buildRuntimeKernelPluginReadinessSections(entries)[0]).toEqual(
      expect.objectContaining({
        id: "needs_action",
        entries: [expect.objectContaining({ id: "pkg.future.wasi" })],
      })
    );
  });
});
