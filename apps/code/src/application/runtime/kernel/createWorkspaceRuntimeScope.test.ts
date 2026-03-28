import { describe, expect, it, vi } from "vitest";
import { createWorkspaceRuntimeScope } from "./createWorkspaceRuntimeScope";
import {
  RUNTIME_KERNEL_CAPABILITY_KEYS,
  resolveWorkspaceRuntimeCapability,
} from "./runtimeKernelCapabilities";
import type { WorkspaceRuntimeCapabilityProvider } from "./runtimeKernelCapabilities";

describe("createWorkspaceRuntimeScope", () => {
  it("assembles workspace-scoped capabilities through the registry", () => {
    const runtimeGateway = { detectMode: vi.fn() };
    const runtimeAgentControl = { listTasks: vi.fn() };
    const runtimeSessionCommands = { sendMessage: vi.fn() };
    const createAgentControl = vi.fn(() => runtimeAgentControl);
    const createSessionCommands = vi.fn(() => runtimeSessionCommands);
    const capabilityProviders: WorkspaceRuntimeCapabilityProvider[] = [
      {
        key: RUNTIME_KERNEL_CAPABILITY_KEYS.agentControl,
        createCapability: createAgentControl as never,
      },
      {
        key: RUNTIME_KERNEL_CAPABILITY_KEYS.sessionCommands,
        createCapability: createSessionCommands as never,
      },
    ];

    const scope = createWorkspaceRuntimeScope({
      workspaceId: "ws-1",
      runtimeGateway: runtimeGateway as never,
      capabilityProviders,
    });

    expect(scope.hasCapability(RUNTIME_KERNEL_CAPABILITY_KEYS.agentControl)).toBe(true);
    expect(scope.hasCapability(RUNTIME_KERNEL_CAPABILITY_KEYS.sessionCommands)).toBe(true);
    expect(scope.listCapabilities()).toEqual([
      RUNTIME_KERNEL_CAPABILITY_KEYS.agentControl,
      RUNTIME_KERNEL_CAPABILITY_KEYS.sessionCommands,
    ]);
    expect(scope.getCapability(RUNTIME_KERNEL_CAPABILITY_KEYS.agentControl)).toBe(
      runtimeAgentControl
    );
    expect(scope.getCapability(RUNTIME_KERNEL_CAPABILITY_KEYS.agentControl)).toBe(
      runtimeAgentControl
    );
    expect(scope.getCapability(RUNTIME_KERNEL_CAPABILITY_KEYS.sessionCommands)).toBe(
      runtimeSessionCommands
    );
    expect(createAgentControl).toHaveBeenCalledTimes(1);
    expect(createSessionCommands).toHaveBeenCalledTimes(1);
    expect(scope).toMatchObject({
      workspaceId: "ws-1",
      runtimeGateway,
    });
  });

  it("throws a clear error when a capability is missing", () => {
    const scope = createWorkspaceRuntimeScope({
      workspaceId: "ws-1",
      runtimeGateway: {} as never,
      capabilityProviders: [],
    });

    expect(scope.hasCapability(RUNTIME_KERNEL_CAPABILITY_KEYS.pluginCatalog)).toBe(false);
    expect(() => scope.getCapability(RUNTIME_KERNEL_CAPABILITY_KEYS.pluginCatalog)).toThrow(
      /Missing workspace runtime capability `plugins\.catalog`/
    );
    expect(() =>
      resolveWorkspaceRuntimeCapability(scope, RUNTIME_KERNEL_CAPABILITY_KEYS.pluginCatalog)
    ).toThrow(/Missing workspace runtime capability `plugins\.catalog`/);
  });

  it("does not expose the removed extensions catalog alias", () => {
    const pluginCatalog = { listPlugins: vi.fn() };
    const scope = createWorkspaceRuntimeScope({
      workspaceId: "ws-1",
      runtimeGateway: {} as never,
      capabilityProviders: [
        {
          key: RUNTIME_KERNEL_CAPABILITY_KEYS.pluginCatalog,
          createCapability: vi.fn(() => pluginCatalog) as never,
        },
      ],
    });

    expect(scope.hasCapability("extensions.catalog")).toBe(false);
    expect(scope.getCapability(RUNTIME_KERNEL_CAPABILITY_KEYS.pluginCatalog)).toBe(pluginCatalog);
    expect(() => scope.getCapability("extensions.catalog" as never)).toThrow(
      /Missing workspace runtime capability `extensions\.catalog`/
    );
    expect(scope.listCapabilities()).toEqual([RUNTIME_KERNEL_CAPABILITY_KEYS.pluginCatalog]);
  });
});
