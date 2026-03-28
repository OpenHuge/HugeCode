// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RuntimeKernelProvider } from "../../../application/runtime/kernel/RuntimeKernelContext";
import { RUNTIME_KERNEL_CAPABILITY_KEYS } from "../../../application/runtime/kernel/runtimeKernelCapabilities";
import { useDebugRuntimePlugins } from "./useDebugRuntimePlugins";

function createRuntimeKernelValue() {
  return {
    runtimeGateway: {} as never,
    workspaceClientRuntimeGateway: {} as never,
    workspaceClientRuntime: {
      kernelProjection: {
        bootstrap: vi.fn(async () => ({
          revision: 1,
          sliceRevisions: { extensions: 1 },
          slices: {
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
    getWorkspaceScope: vi.fn(() => ({
      workspaceId: "workspace-1",
      runtimeGateway: {} as never,
      getCapability: (key: string) => {
        if (key === RUNTIME_KERNEL_CAPABILITY_KEYS.extensionsCatalog) {
          return {
            listPlugins: vi.fn(async () => [
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
                },
                metadata: null,
                permissionDecision: "allow",
                health: null,
              },
            ]),
            readPluginResource: vi.fn(),
            executePlugin: vi.fn(),
            evaluatePluginPermissions: vi.fn(),
          };
        }
        throw new Error(`Unsupported capability: ${key}`);
      },
      hasCapability: () => true,
      listCapabilities: () => [RUNTIME_KERNEL_CAPABILITY_KEYS.extensionsCatalog],
    })),
  };
}

describe("useDebugRuntimePlugins", () => {
  it("merges projection extension bundles with the workspace plugin catalog", async () => {
    const { result } = renderHook(
      () =>
        useDebugRuntimePlugins({
          workspaceId: "workspace-1",
          enabled: true,
        }),
      {
        wrapper: ({ children }) => (
          <RuntimeKernelProvider value={createRuntimeKernelValue() as never}>
            {children}
          </RuntimeKernelProvider>
        ),
      }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.plugins).toHaveLength(1);
    });

    expect(result.current.projectionBacked).toBe(true);
    expect(result.current.plugins[0]).toMatchObject({
      id: "ext-1",
      name: "Projection Name",
      version: "9.9.9",
      permissions: ["network"],
      capabilities: [{ id: "tool:bash", enabled: true }],
      metadata: {
        kernelExtensionBundle: {
          toolCount: 2,
        },
      },
    });
  });
});
