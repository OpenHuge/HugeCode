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

    expect(merged).toEqual([
      expect.objectContaining({
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
        }),
      }),
    ]);
  });
});
