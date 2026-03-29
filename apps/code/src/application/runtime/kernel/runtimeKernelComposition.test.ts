import { describe, expect, it, vi } from "vitest";
import { createRuntimeKernelCompositionFacade } from "./runtimeKernelComposition";
import { createRuntimeKernelPluginRegistryFacade } from "./runtimeKernelPluginRegistry";
import type { RuntimeKernelPluginDescriptor } from "./runtimeKernelPlugins";

function createRuntimePluginCatalog() {
  const plugins: RuntimeKernelPluginDescriptor[] = [
    {
      id: "route.openai",
      name: "OpenAI Route",
      version: "1.0.0",
      summary: null,
      source: "provider_route",
      transport: "provider_route",
      hostProfile: {
        kind: "routing",
        executionBoundaries: ["runtime"],
      },
      workspaceId: "workspace-1",
      enabled: true,
      runtimeBacked: true,
      capabilities: [],
      permissions: [],
      resources: [],
      executionBoundaries: ["runtime"],
      binding: {
        state: "bound",
        contractFormat: "route",
        contractBoundary: "provider-routing",
        interfaceId: "route.openai",
        surfaces: [
          {
            id: "route.openai",
            kind: "route",
            direction: "export",
            summary: "OpenAI provider route.",
          },
        ],
      },
      operations: {
        execution: {
          executable: true,
          mode: "provider_route",
          reason: null,
        },
        resources: {
          readable: false,
          mode: "none",
          reason: "n/a",
        },
        permissions: {
          evaluable: false,
          mode: "none",
          reason: "n/a",
        },
      },
      metadata: {
        routeKind: "provider_family",
        routeValue: "openai",
        readiness: "ready",
        launchAllowed: true,
        providerId: "openai",
        preferredBackendIds: ["backend-openai", "backend-fallback"],
      },
      permissionDecision: null,
      health: {
        state: "healthy",
        checkedAt: 1,
        warnings: [],
      },
    },
    {
      id: "ext.runtime",
      name: "Runtime Extension",
      version: "1.0.0",
      summary: null,
      source: "runtime_extension",
      transport: "runtime_extension",
      hostProfile: {
        kind: "runtime",
        executionBoundaries: ["runtime"],
      },
      workspaceId: "workspace-1",
      enabled: true,
      runtimeBacked: true,
      capabilities: [],
      permissions: ["network"],
      resources: [],
      executionBoundaries: ["runtime"],
      binding: {
        state: "bound",
        contractFormat: "runtime_extension",
        contractBoundary: "runtime-extension-record",
        interfaceId: "ext.runtime",
        surfaces: [
          {
            id: "ext.runtime",
            kind: "extension",
            direction: "export",
            summary: "Runtime extension.",
          },
        ],
      },
      operations: {
        execution: {
          executable: false,
          mode: "none",
          reason: "n/a",
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
      health: {
        state: "healthy",
        checkedAt: 1,
        warnings: [],
      },
    },
  ];
  return {
    listPlugins: vi.fn(async () => plugins),
  };
}

describe("runtimeKernelComposition", () => {
  it("applies profile layers deterministically", async () => {
    const pluginCatalog = createRuntimePluginCatalog();
    const pluginRegistry = createRuntimeKernelPluginRegistryFacade({
      workspaceId: "workspace-1",
      pluginCatalog,
    });
    await pluginRegistry.installPackage({ packageRef: "hugecode.mcp.search@1.0.0" });
    const composition = createRuntimeKernelCompositionFacade({
      workspaceId: "workspace-1",
      pluginCatalog,
      pluginRegistry,
    });

    const resolution = await composition.getActiveResolution();

    expect(resolution.provenance.activeProfileId).toBe("workspace-default");
    expect(resolution.provenance.appliedLayerOrder).toEqual([
      "built_in",
      "user",
      "workspace",
      "launch_override",
    ]);
    expect(resolution.selectedBackendCandidates.map((entry) => entry.backendId)).toEqual(
      expect.arrayContaining(["backend-primary", "backend-fallback", "backend-openai"])
    );
  });

  it("uses first-match selector resolution and does not mutate stored profiles during preview", async () => {
    const pluginCatalog = createRuntimePluginCatalog();
    const pluginRegistry = createRuntimeKernelPluginRegistryFacade({
      workspaceId: "workspace-1",
      pluginCatalog,
    });
    const composition = createRuntimeKernelCompositionFacade({
      workspaceId: "workspace-1",
      pluginCatalog,
      pluginRegistry,
    });

    const preview = await composition.previewResolution({
      launchOverride: {
        pluginSelectors: [
          {
            matchBy: "source",
            matchValue: "runtime_extension",
            action: "exclude",
            reason: "Launch override excludes runtime extensions.",
          },
          {
            matchBy: "pluginId",
            matchValue: "ext.runtime",
            action: "include",
            reason: "This should be ignored because first match wins.",
          },
        ],
      },
    });

    expect(preview.blockedPlugins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pluginId: "ext.runtime",
          stage: "selector",
        }),
      ])
    );
    const storedProfile = await composition.getProfile("workspace-default");
    expect(storedProfile?.pluginSelectors).toEqual([]);
  });

  it("can exclude verified packages through trust policy", async () => {
    const pluginCatalog = createRuntimePluginCatalog();
    const pluginRegistry = createRuntimeKernelPluginRegistryFacade({
      workspaceId: "workspace-1",
      pluginCatalog,
    });
    await pluginRegistry.installPackage({ packageRef: "hugecode.mcp.search@1.0.0" });
    const composition = createRuntimeKernelCompositionFacade({
      workspaceId: "workspace-1",
      pluginCatalog,
      pluginRegistry,
    });

    const resolution = await composition.applyProfile({
      profileId: "workspace-default",
      updates: {
        trustPolicy: {
          requireVerifiedSignatures: true,
          allowDevOverrides: false,
          blockedPublishers: ["HugeCode Labs"],
        },
      },
    });

    expect(resolution.blockedPlugins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pluginId: "pkg.search.remote",
          stage: "trust",
        }),
      ])
    );
  });
});
