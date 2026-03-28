// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RuntimeKernelProvider } from "../kernel/RuntimeKernelContext";
import { RUNTIME_KERNEL_CAPABILITY_KEYS } from "../kernel/runtimeKernelCapabilities";
import { useWorkspaceRuntimePluginCatalog } from "./runtimeKernelPluginCatalogFacadeHooks";

describe("useWorkspaceRuntimePluginCatalog", () => {
  it("returns the workspace-scoped plugin catalog facade", () => {
    const pluginCatalog = {
      listPlugins: vi.fn(),
      readPluginResource: vi.fn(),
      executePlugin: vi.fn(),
      evaluatePluginPermissions: vi.fn(),
    };
    const runtimeKernel = {
      runtimeGateway: {} as never,
      workspaceClientRuntimeGateway: {} as never,
      workspaceClientRuntime: {} as never,
      desktopHost: {} as never,
      getWorkspaceScope: vi.fn(() => ({
        workspaceId: "workspace-1",
        runtimeGateway: {} as never,
        getCapability: (key: string) => {
          if (key === RUNTIME_KERNEL_CAPABILITY_KEYS.extensionsCatalog) {
            return pluginCatalog;
          }
          throw new Error(`Unsupported capability: ${key}`);
        },
        hasCapability: () => true,
        listCapabilities: () => [RUNTIME_KERNEL_CAPABILITY_KEYS.extensionsCatalog],
      })),
    };

    const { result } = renderHook(() => useWorkspaceRuntimePluginCatalog("workspace-1"), {
      wrapper: ({ children }) => (
        <RuntimeKernelProvider value={runtimeKernel as never}>{children}</RuntimeKernelProvider>
      ),
    });

    expect(result.current).toBe(pluginCatalog);
  });

  it("returns null when no workspace is selected", () => {
    const runtimeKernel = {
      runtimeGateway: {} as never,
      workspaceClientRuntimeGateway: {} as never,
      workspaceClientRuntime: {} as never,
      desktopHost: {} as never,
      getWorkspaceScope: vi.fn(),
    };

    const { result } = renderHook(() => useWorkspaceRuntimePluginCatalog(null), {
      wrapper: ({ children }) => (
        <RuntimeKernelProvider value={runtimeKernel as never}>{children}</RuntimeKernelProvider>
      ),
    });

    expect(result.current).toBeNull();
    expect(runtimeKernel.getWorkspaceScope).not.toHaveBeenCalled();
  });
});
