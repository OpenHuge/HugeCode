// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RuntimeKernelProvider } from "../kernel/RuntimeKernelContext";
import { RUNTIME_KERNEL_CAPABILITY_KEYS } from "../kernel/runtimeKernelCapabilities";
import { useWorkspaceRuntimePluginProjection } from "./runtimeKernelPluginProjectionHooks";

function createCatalogPlugins() {
  return [
    {
      id: "ext-1",
      name: "Catalog Name",
      version: "9.9.9",
      summary: null,
      source: "runtime_extension",
      transport: "runtime_extension",
      hostProfile: {
        kind: "runtime",
        executionBoundaries: ["runtime"],
      },
      workspaceId: null,
      enabled: false,
      runtimeBacked: true,
      capabilities: [{ id: "tool:bash", enabled: true }],
      permissions: ["network"],
      resources: [],
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
      metadata: null,
      permissionDecision: "allow",
      health: null,
    },
  ];
}

function createRuntimeKernelValue(input?: { projectionEnabled?: boolean }) {
  const listPlugins = vi.fn(async () => createCatalogPlugins());
  const pluginCatalogFacade = {
    listPlugins,
    readPluginResource: vi.fn(),
    executePlugin: vi.fn(),
    evaluatePluginPermissions: vi.fn(),
  };
  const pluginRegistryFacade = {
    listInstalledPackages: vi.fn(async () => [
      {
        packageRef: "hugecode.mcp.search@1.0.0",
        packageId: "hugecode.mcp.search",
        version: "1.0.0",
        publisher: "HugeCode Labs",
        summary: "Registry package",
        transport: "mcp_remote",
        source: "installed",
        installed: true,
        installedPluginId: "pkg.search.remote",
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
    ]),
  };
  const compositionFacade = {
    listProfiles: vi.fn(async () => [
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
    ]),
    getActiveResolution: vi.fn(async () => ({
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
    })),
  };
  const workspaceScope = {
    workspaceId: "workspace-1",
    runtimeGateway: {} as never,
    getCapability: (key: string) => {
      if (key === RUNTIME_KERNEL_CAPABILITY_KEYS.pluginCatalog) {
        return pluginCatalogFacade;
      }
      if (key === RUNTIME_KERNEL_CAPABILITY_KEYS.pluginRegistry) {
        return pluginRegistryFacade;
      }
      if (key === RUNTIME_KERNEL_CAPABILITY_KEYS.compositionRuntime) {
        return compositionFacade;
      }
      throw new Error(`Unsupported capability: ${key}`);
    },
    hasCapability: () => true,
    listCapabilities: () => [
      RUNTIME_KERNEL_CAPABILITY_KEYS.pluginCatalog,
      RUNTIME_KERNEL_CAPABILITY_KEYS.pluginRegistry,
      RUNTIME_KERNEL_CAPABILITY_KEYS.compositionRuntime,
    ],
  };

  return {
    runtimeGateway: {} as never,
    workspaceClientRuntimeGateway: {} as never,
    workspaceClientRuntime: {
      kernelProjection:
        input?.projectionEnabled === false
          ? undefined
          : {
              bootstrap: vi.fn(async () => ({
                revision: 1,
                sliceRevisions: { extensions: 1, capabilities: 1 },
                slices: {
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
                  extensions: [
                    {
                      id: "ext-1",
                      name: "Projection Name",
                      enabled: true,
                      transport: "mcp-stdio",
                      workspaceId: "workspace-1",
                      toolCount: 2,
                      resourceCount: 1,
                      surfaces: ["debug"],
                      installedAt: 10,
                      updatedAt: 20,
                      metadata: {
                        version: "1.0.0",
                      },
                    },
                  ],
                },
              })),
              subscribe: vi.fn(() => () => undefined),
            },
    } as never,
    desktopHost: {} as never,
    getWorkspaceScope: vi.fn(() => workspaceScope),
    listPlugins,
    listInstalledPackages: pluginRegistryFacade.listInstalledPackages,
    listProfiles: compositionFacade.listProfiles,
    getActiveResolution: compositionFacade.getActiveResolution,
  };
}

describe("runtimeKernelPluginProjectionHooks", () => {
  it("treats kernel projection as the only first-party plugin truth when slices are available", async () => {
    const runtimeKernelValue = createRuntimeKernelValue();
    const { result } = renderHook(
      () =>
        useWorkspaceRuntimePluginProjection({
          workspaceId: "workspace-1",
          enabled: true,
        }),
      {
        wrapper: ({ children }) => (
          <RuntimeKernelProvider value={runtimeKernelValue as never}>
            {children}
          </RuntimeKernelProvider>
        ),
      }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.plugins).toHaveLength(3);
    });

    expect(result.current.projectionBacked).toBe(true);
    expect(result.current.registry.installedCount).toBe(1);
    expect(result.current.composition.activeProfileId).toBe("workspace-default");
    expect(result.current.plugins[0]).toMatchObject({
      id: "ext-1",
      name: "Projection Name",
      version: "1.0.0",
      permissions: [],
      capabilities: [],
      metadata: {
        kernelExtensionBundle: {
          toolCount: 2,
        },
        composition: {
          activeProfileId: "workspace-default",
        },
      },
    });
    expect(result.current.plugins[1]).toMatchObject({
      id: "host:wasi",
      source: "wasi_host",
      runtimeBacked: true,
      binding: {
        state: "unbound",
        contractFormat: "wit",
        contractBoundary: "world-imports",
        interfaceId: "wasi:*/*",
        surfaces: [
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
            summary: "Semver-qualified WIT interface imports published by the runtime host binder.",
          },
        ],
      },
    });
    expect(result.current.plugins[2]).toMatchObject({
      id: "pkg.search.remote",
      source: "mcp_remote",
      metadata: {
        pluginRegistry: {
          packageRef: "hugecode.mcp.search@1.0.0",
        },
        composition: {
          activeProfileId: "workspace-default",
        },
      },
    });
    expect(runtimeKernelValue.listPlugins).not.toHaveBeenCalled();
  });

  it("falls back to the workspace plugin catalog when kernel projection is unavailable", async () => {
    const runtimeKernelValue = createRuntimeKernelValue({ projectionEnabled: false });
    const { result } = renderHook(
      () =>
        useWorkspaceRuntimePluginProjection({
          workspaceId: "workspace-1",
          enabled: true,
        }),
      {
        wrapper: ({ children }) => (
          <RuntimeKernelProvider value={runtimeKernelValue as never}>
            {children}
          </RuntimeKernelProvider>
        ),
      }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.plugins).toHaveLength(2);
    });

    expect(result.current.projectionBacked).toBe(false);
    expect(result.current.registry.installedCount).toBe(1);
    expect(result.current.composition.activeProfileId).toBe("workspace-default");
    expect(result.current.plugins[0]).toMatchObject({
      id: "ext-1",
      name: "Catalog Name",
      version: "9.9.9",
      permissions: ["network"],
      capabilities: [{ id: "tool:bash", enabled: true }],
    });
    expect(result.current.plugins[1]).toMatchObject({
      id: "pkg.search.remote",
      source: "mcp_remote",
    });
    expect(runtimeKernelValue.listPlugins).toHaveBeenCalledOnce();
  });

  it("refreshes plugin catalog, registry, and composition state through the shared boundary hook", async () => {
    const kernelValue = createRuntimeKernelValue({ projectionEnabled: false });
    const { result } = renderHook(
      () =>
        useWorkspaceRuntimePluginProjection({
          workspaceId: "workspace-1",
          enabled: true,
        }),
      {
        wrapper: ({ children }) => (
          <RuntimeKernelProvider value={kernelValue as never}>{children}</RuntimeKernelProvider>
        ),
      }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const initialCalls = {
      listPlugins: kernelValue.listPlugins.mock.calls.length,
      listInstalledPackages: kernelValue.listInstalledPackages.mock.calls.length,
      listProfiles: kernelValue.listProfiles.mock.calls.length,
      getActiveResolution: kernelValue.getActiveResolution.mock.calls.length,
    };

    await result.current.refresh();

    expect(kernelValue.listPlugins).toHaveBeenCalledTimes(initialCalls.listPlugins + 1);
    expect(kernelValue.listInstalledPackages).toHaveBeenCalledTimes(
      initialCalls.listInstalledPackages + 1
    );
    expect(kernelValue.listProfiles).toHaveBeenCalledTimes(initialCalls.listProfiles + 1);
    expect(kernelValue.getActiveResolution).toHaveBeenCalledTimes(
      initialCalls.getActiveResolution + 1
    );
  });
});
