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
    const pluginRegistry = { listInstalledPackages: vi.fn() };
    const compositionRuntime = { getActiveResolution: vi.fn() };
    const extensionActivation = { readSnapshot: vi.fn() };
    const invocationCatalog = { readSnapshot: vi.fn() };
    const invocationPlane = { listHosts: vi.fn(), dispatch: vi.fn() };
    const createAgentControl = vi.fn(() => runtimeAgentControl);
    const createSessionCommands = vi.fn(() => runtimeSessionCommands);
    const createPluginRegistry = vi.fn(() => pluginRegistry);
    const createCompositionRuntime = vi.fn(() => compositionRuntime);
    const createExtensionActivation = vi.fn(() => extensionActivation);
    const createInvocationCatalog = vi.fn(() => invocationCatalog);
    const createInvocationPlane = vi.fn(() => invocationPlane);
    const capabilityProviders: WorkspaceRuntimeCapabilityProvider[] = [
      {
        key: RUNTIME_KERNEL_CAPABILITY_KEYS.agentControl,
        createCapability: createAgentControl as never,
      },
      {
        key: RUNTIME_KERNEL_CAPABILITY_KEYS.sessionCommands,
        createCapability: createSessionCommands as never,
      },
      {
        key: RUNTIME_KERNEL_CAPABILITY_KEYS.pluginRegistry,
        createCapability: createPluginRegistry as never,
      },
      {
        key: RUNTIME_KERNEL_CAPABILITY_KEYS.compositionRuntime,
        createCapability: createCompositionRuntime as never,
      },
      {
        key: RUNTIME_KERNEL_CAPABILITY_KEYS.extensionActivation,
        createCapability: createExtensionActivation as never,
      },
      {
        key: RUNTIME_KERNEL_CAPABILITY_KEYS.invocationCatalog,
        createCapability: createInvocationCatalog as never,
      },
      {
        key: RUNTIME_KERNEL_CAPABILITY_KEYS.invocationPlane,
        createCapability: createInvocationPlane as never,
      },
    ];

    const scope = createWorkspaceRuntimeScope({
      workspaceId: "ws-1",
      runtimeGateway: runtimeGateway as never,
      capabilityProviders,
    });

    expect(scope.hasCapability(RUNTIME_KERNEL_CAPABILITY_KEYS.agentControl)).toBe(true);
    expect(scope.hasCapability(RUNTIME_KERNEL_CAPABILITY_KEYS.sessionCommands)).toBe(true);
    expect(scope.hasCapability(RUNTIME_KERNEL_CAPABILITY_KEYS.pluginRegistry)).toBe(true);
    expect(scope.hasCapability(RUNTIME_KERNEL_CAPABILITY_KEYS.compositionRuntime)).toBe(true);
    expect(scope.hasCapability(RUNTIME_KERNEL_CAPABILITY_KEYS.extensionActivation)).toBe(true);
    expect(scope.hasCapability(RUNTIME_KERNEL_CAPABILITY_KEYS.invocationCatalog)).toBe(true);
    expect(scope.hasCapability(RUNTIME_KERNEL_CAPABILITY_KEYS.invocationPlane)).toBe(true);
    expect(scope.listCapabilities()).toEqual([
      RUNTIME_KERNEL_CAPABILITY_KEYS.agentControl,
      RUNTIME_KERNEL_CAPABILITY_KEYS.sessionCommands,
      RUNTIME_KERNEL_CAPABILITY_KEYS.pluginRegistry,
      RUNTIME_KERNEL_CAPABILITY_KEYS.compositionRuntime,
      RUNTIME_KERNEL_CAPABILITY_KEYS.extensionActivation,
      RUNTIME_KERNEL_CAPABILITY_KEYS.invocationCatalog,
      RUNTIME_KERNEL_CAPABILITY_KEYS.invocationPlane,
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
    expect(scope.getCapability(RUNTIME_KERNEL_CAPABILITY_KEYS.pluginRegistry)).toBe(pluginRegistry);
    expect(scope.getCapability(RUNTIME_KERNEL_CAPABILITY_KEYS.compositionRuntime)).toBe(
      compositionRuntime
    );
    expect(scope.getCapability(RUNTIME_KERNEL_CAPABILITY_KEYS.extensionActivation)).toBe(
      extensionActivation
    );
    expect(scope.getCapability(RUNTIME_KERNEL_CAPABILITY_KEYS.invocationCatalog)).toBe(
      invocationCatalog
    );
    expect(scope.getCapability(RUNTIME_KERNEL_CAPABILITY_KEYS.invocationPlane)).toBe(
      invocationPlane
    );
    expect(createAgentControl).toHaveBeenCalledTimes(1);
    expect(createSessionCommands).toHaveBeenCalledTimes(1);
    expect(createPluginRegistry).toHaveBeenCalledTimes(1);
    expect(createCompositionRuntime).toHaveBeenCalledTimes(1);
    expect(createExtensionActivation).toHaveBeenCalledTimes(1);
    expect(createInvocationCatalog).toHaveBeenCalledTimes(1);
    expect(createInvocationPlane).toHaveBeenCalledTimes(1);
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

  it("throws clear errors for missing registry and composition capabilities", () => {
    const scope = createWorkspaceRuntimeScope({
      workspaceId: "ws-1",
      runtimeGateway: {} as never,
      capabilityProviders: [],
    });

    expect(() => scope.getCapability(RUNTIME_KERNEL_CAPABILITY_KEYS.pluginRegistry)).toThrow(
      /Missing workspace runtime capability `plugins\.registry`/
    );
    expect(() => scope.getCapability(RUNTIME_KERNEL_CAPABILITY_KEYS.compositionRuntime)).toThrow(
      /Missing workspace runtime capability `composition\.runtime`/
    );
  });
});
