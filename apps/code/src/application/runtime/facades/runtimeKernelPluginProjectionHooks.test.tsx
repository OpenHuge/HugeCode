// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RuntimeKernelProvider } from "../kernel/RuntimeKernelContext";
import { RUNTIME_KERNEL_CAPABILITY_KEYS } from "../kernel/runtimeKernelCapabilities";
import { useWorkspaceRuntimePluginProjection } from "./runtimeKernelPluginProjectionHooks";

function createRuntimeKernelValue() {
  return {
    runtimeGateway: {} as never,
    workspaceClientRuntimeGateway: {} as never,
    workspaceClientRuntime: {
      kernelProjection: {
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
    getWorkspaceScope: vi.fn(() => ({
      workspaceId: "workspace-1",
      runtimeGateway: {} as never,
      getCapability: (key: string) => {
        if (key === RUNTIME_KERNEL_CAPABILITY_KEYS.pluginCatalog) {
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
                  surfaces: [
                    {
                      id: "ext-1",
                      kind: "extension",
                      direction: "export",
                      summary:
                        "Runtime extension record exported through the kernel plugin catalog.",
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
            ]),
            readPluginResource: vi.fn(),
            executePlugin: vi.fn(),
            evaluatePluginPermissions: vi.fn(),
          };
        }
        throw new Error(`Unsupported capability: ${key}`);
      },
      hasCapability: () => true,
      listCapabilities: () => [RUNTIME_KERNEL_CAPABILITY_KEYS.pluginCatalog],
    })),
  };
}

describe("runtimeKernelPluginProjectionHooks", () => {
  it("merges projection extension bundles with the workspace plugin catalog", async () => {
    const { result } = renderHook(
      () =>
        useWorkspaceRuntimePluginProjection({
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
      expect(result.current.plugins).toHaveLength(2);
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
  });
});
