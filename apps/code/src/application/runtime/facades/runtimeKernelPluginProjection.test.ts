import { describe, expect, it } from "vitest";
import {
  mergeRuntimeKernelProjectionPlugins,
  normalizeKernelExtensionBundlePluginDescriptor,
} from "./runtimeKernelPluginProjection";

describe("runtimeKernelPluginProjection", () => {
  it("normalizes kernel extension bundles into runtime plugin descriptors", () => {
    expect(
      normalizeKernelExtensionBundlePluginDescriptor({
        id: "ext-1",
        name: "Extension One",
        enabled: true,
        transport: "mcp-stdio",
        workspaceId: "workspace-1",
        toolCount: 2,
        resourceCount: 1,
        surfaces: ["debug"],
        installedAt: 10,
        updatedAt: 20,
        metadata: {
          version: "1.2.3",
          summary: "Projection-backed extension.",
        },
      })
    ).toMatchObject({
      id: "ext-1",
      name: "Extension One",
      version: "1.2.3",
      summary: "Projection-backed extension.",
      source: "runtime_extension",
      transport: "runtime_extension",
      runtimeBacked: true,
      enabled: true,
      binding: {
        state: "bound",
        contractFormat: "runtime_extension",
        contractBoundary: "kernel-extension-bundle",
        interfaceId: "ext-1",
        surfaces: [
          {
            id: "ext-1",
            kind: "extension",
            direction: "export",
            summary: "Kernel projection export for a runtime extension bundle.",
          },
        ],
      },
      metadata: {
        kernelExtensionBundle: {
          toolCount: 2,
          resourceCount: 1,
          surfaces: ["debug"],
        },
      },
    });
  });

  it("merges projection bundles into runtime extension catalog entries without losing catalog details", () => {
    const merged = mergeRuntimeKernelProjectionPlugins({
      extensionBundles: [
        {
          id: "ext-1",
          name: "Projection Name",
          enabled: false,
          transport: "mcp-http",
          workspaceId: "workspace-1",
          toolCount: 3,
          resourceCount: 4,
          surfaces: ["mission_control"],
          installedAt: 10,
          updatedAt: 20,
          metadata: {
            summary: "projection summary",
          },
        },
      ],
      capabilities: [
        {
          id: "host:wasi",
          name: "WASI host binder",
          kind: "host",
          enabled: false,
          health: "blocked",
          executionProfile: {
            placement: "local",
            interactivity: "background",
            isolation: "host",
            network: "restricted",
            authority: "service",
          },
          tags: ["component-model", "wit", "host"],
          metadata: {
            pluginSource: "wasi_host",
            bindingState: "unbound",
            contractFormat: "wit",
            contractBoundary: "world-imports",
            interfaceId: "wasi:*/*",
            worldId: "hugecode:runtime/plugin-host",
            contractSurfaces: [
              {
                id: "hugecode:runtime/plugin-host",
                kind: "world",
                direction: "import",
                summary:
                  "Reserved component-model world that the runtime host binder is expected to satisfy.",
              },
              {
                id: "wasi:*/*",
                kind: "interface",
                direction: "import",
                summary:
                  "Semver-qualified WIT interface imports published by the runtime host binder.",
              },
            ],
            summary:
              "Runtime-published component-model host slot reserved for future WIT/world bindings.",
            reason: "Runtime host binder is not currently connected.",
          },
        },
      ],
      registryPackages: [
        {
          packageRef: "hugecode.mcp.search@1.0.0",
          packageId: "hugecode.mcp.search",
          version: "1.0.0",
          publisher: "HugeCode Labs",
          summary: "Registry package",
          transport: "mcp_remote",
          source: "installed",
          installed: true,
          installedPluginId: null,
          manifest: {
            packageId: "hugecode.mcp.search",
            version: "1.0.0",
            publisher: "HugeCode Labs",
            transport: "mcp_remote",
            entry: {
              pluginId: "pkg.search.remote",
              displayName: "Remote Search Tools",
              summary: "Registry package",
              interfaceId: "pkg.search.remote",
            },
            contractSurfaces: [
              {
                id: "pkg.search.remote.routes",
                kind: "route",
                direction: "export",
                summary: "Remote route",
              },
            ],
            compatibility: {
              status: "compatible",
              minimumHostContractVersion: "2026-03-25",
              supportedRuntimeProtocolVersions: ["2026-03-25"],
              supportedCapabilityKeys: ["plugins.catalog", "plugins.registry"],
              optionalTransportFeatures: [],
              blockers: [],
            },
            dependencies: [],
            permissions: ["network"],
            defaultConfig: {},
            attestations: [],
          },
          compatibility: {
            status: "compatible",
            minimumHostContractVersion: "2026-03-25",
            supportedRuntimeProtocolVersions: ["2026-03-25"],
            supportedCapabilityKeys: ["plugins.catalog", "plugins.registry"],
            optionalTransportFeatures: [],
            blockers: [],
          },
          trust: {
            status: "verified",
            verificationStatus: "verified",
            publisher: "HugeCode Labs",
            attestationSource: "sigstore",
            blockedReason: null,
            packageRef: "hugecode.mcp.search@1.0.0",
            pluginId: "pkg.search.remote",
          },
        },
      ],
      compositionResolution: {
        selectedPlugins: [
          {
            pluginId: "ext-1",
            packageRef: null,
            source: "runtime_extension",
            reason: null,
          },
        ],
        selectedRouteCandidates: [],
        selectedBackendCandidates: [{ backendId: "backend-primary", sourcePluginId: null }],
        blockedPlugins: [],
        trustDecisions: [],
        provenance: {
          activeProfileId: "workspace-default",
          activeProfileName: "Workspace Default",
          appliedLayerOrder: ["built_in", "user", "workspace", "launch_override"],
          selectorDecisions: {},
        },
      },
      capabilityPlugins: [
        {
          id: "ext-1",
          name: "Catalog Name",
          version: "9.9.9",
          summary: "catalog summary",
          source: "runtime_extension",
          transport: "runtime_extension",
          hostProfile: {
            kind: "runtime",
            executionBoundaries: ["runtime"],
          },
          workspaceId: null,
          enabled: true,
          runtimeBacked: true,
          capabilities: [{ id: "tool:bash", enabled: true }],
          permissions: ["network"],
          resources: [{ id: "resource-1", contentType: "application/json" }],
          executionBoundaries: ["runtime"],
          binding: {
            state: "bound",
            contractFormat: "runtime_extension",
            contractBoundary: "runtime-extension-record",
            interfaceId: "ext-1",
            surfaces: [
              {
                id: "ext-1",
                kind: "extension",
                direction: "export",
                summary: "Runtime extension record exported through the kernel plugin catalog.",
              },
            ],
          },
          operations: {
            execution: {
              executable: false,
              mode: "none",
              reason:
                "Plugin `ext-1` is bound for catalog/resource access only and does not expose an execution provider.",
            },
            resources: {
              readable: true,
              mode: "runtime_extension_resource",
              reason: null,
            },
            permissions: {
              evaluable: true,
              mode: "runtime_extension_permissions",
              reason: null,
            },
          },
          metadata: {
            distribution: "workspace",
          },
          permissionDecision: "allow",
          health: {
            state: "healthy",
            checkedAt: 99,
            warnings: [],
          },
        },
      ],
    });

    expect(merged).toHaveLength(3);
    expect(merged[0]).toMatchObject({
      id: "ext-1",
      name: "Projection Name",
      version: "9.9.9",
      enabled: false,
      workspaceId: "workspace-1",
      permissions: ["network"],
      capabilities: [{ id: "tool:bash", enabled: true }],
      metadata: expect.objectContaining({
        distribution: "workspace",
        kernelExtensionBundle: expect.objectContaining({
          toolCount: 3,
          resourceCount: 4,
          surfaces: ["mission_control"],
        }),
        composition: expect.objectContaining({
          activeProfileId: "workspace-default",
          selectedInActiveProfile: true,
        }),
      }),
    });
    expect(merged[1]).toMatchObject({
      id: "host:wasi",
      source: "wasi_host",
      runtimeBacked: true,
      binding: expect.objectContaining({
        state: "unbound",
        contractFormat: "wit",
      }),
    });
    expect(merged[2]).toMatchObject({
      id: "pkg:hugecode.mcp.search@1.0.0",
      source: "mcp_remote",
      metadata: expect.objectContaining({
        pluginRegistry: expect.objectContaining({
          packageRef: "hugecode.mcp.search@1.0.0",
          transport: "mcp_remote",
        }),
        composition: expect.objectContaining({
          activeProfileId: "workspace-default",
        }),
      }),
    });
  });
});
