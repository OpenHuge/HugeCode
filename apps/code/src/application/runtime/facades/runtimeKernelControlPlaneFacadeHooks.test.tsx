// @vitest-environment jsdom

import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RuntimeKernelProvider } from "../kernel/RuntimeKernelContext";
import { RUNTIME_KERNEL_CAPABILITY_KEYS } from "../kernel/runtimeKernelCapabilities";
import { useWorkspaceRuntimeControlPlaneOperatorState } from "./runtimeKernelControlPlaneFacadeHooks";
import type { RuntimeControlPlaneOperatorAction } from "./runtimeKernelControlPlaneOperatorModel";

function createRuntimeKernelValue() {
  const installPackage = vi.fn(async () => ({
    package: {} as never,
    installed: true,
    blockedReason: null,
  }));
  const updatePackage = vi.fn(async () => ({
    package: null,
    updated: false,
    blockedReason: null,
  }));
  const uninstallPackage = vi.fn(async () => ({
    packageRef: "hugecode.mcp.search@1.0.0",
    removed: true,
    blockedReason: null,
  }));
  const previewResolution = vi.fn(async () => ({
    selectedPlugins: [],
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
  }));
  const applyProfile = vi.fn(async () => ({
    selectedPlugins: [],
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
  }));

  const workspaceScope = {
    workspaceId: "workspace-1",
    runtimeGateway: {} as never,
    getCapability: (key: string) => {
      if (key === RUNTIME_KERNEL_CAPABILITY_KEYS.pluginRegistry) {
        return {
          installPackage,
          updatePackage,
          uninstallPackage,
        };
      }
      if (key === RUNTIME_KERNEL_CAPABILITY_KEYS.compositionRuntime) {
        return {
          previewResolution,
          applyProfile,
        };
      }
      throw new Error(`Unsupported capability: ${key}`);
    },
    hasCapability: () => true,
    listCapabilities: () => [
      RUNTIME_KERNEL_CAPABILITY_KEYS.pluginRegistry,
      RUNTIME_KERNEL_CAPABILITY_KEYS.compositionRuntime,
    ],
  };

  return {
    runtimeGateway: {} as never,
    workspaceClientRuntimeGateway: {} as never,
    workspaceClientRuntime: {
      kernelProjection: null,
    } as never,
    desktopHost: {} as never,
    getWorkspaceScope: vi.fn(() => workspaceScope),
    installPackage,
    updatePackage,
    uninstallPackage,
    previewResolution,
    applyProfile,
  };
}

describe("runtimeKernelControlPlaneFacadeHooks", () => {
  it("runs install and apply/preview actions through the control-plane controller and refreshes mutations", async () => {
    const refresh = vi.fn(async () => undefined);
    const kernelValue = createRuntimeKernelValue();
    const { result } = renderHook(
      () =>
        useWorkspaceRuntimeControlPlaneOperatorState({
          workspaceId: "workspace-1",
          refresh,
        }),
      {
        wrapper: ({ children }) => (
          <RuntimeKernelProvider value={kernelValue as never}>{children}</RuntimeKernelProvider>
        ),
      }
    );

    const installAction = {
      id: "pkg.search.remote:install",
      kind: "install",
      label: "Install",
      detail: null,
      tone: "primary",
      disabledReason: null,
      packageRef: "hugecode.mcp.search@1.0.0",
      pluginId: "pkg.search.remote",
      profileId: null,
    } satisfies RuntimeControlPlaneOperatorAction;

    await act(async () => {
      await result.current.runAction(installAction);
    });

    expect(kernelValue.installPackage).toHaveBeenCalledWith({
      packageRef: "hugecode.mcp.search@1.0.0",
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(result.current.info).toContain("Installed runtime plugin package");

    const previewAction = {
      id: "profile:workspace-default:preview",
      kind: "preview_profile",
      label: "Preview profile",
      detail: null,
      tone: "neutral",
      disabledReason: null,
      packageRef: null,
      pluginId: null,
      profileId: "workspace-default",
    } satisfies RuntimeControlPlaneOperatorAction;

    await act(async () => {
      await result.current.runAction(previewAction);
    });

    await waitFor(() => {
      expect(result.current.previewProfileId).toBe("workspace-default");
      expect(result.current.previewResolution?.selectedBackendCandidates).toHaveLength(1);
    });

    const applyAction = {
      ...previewAction,
      id: "profile:workspace-default:apply",
      kind: "apply_profile",
      label: "Apply profile",
      tone: "primary",
    } satisfies RuntimeControlPlaneOperatorAction;

    await act(async () => {
      await result.current.runAction(applyAction);
    });

    expect(kernelValue.applyProfile).toHaveBeenCalledWith({
      profileId: "workspace-default",
    });
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(result.current.info).toContain("Applied runtime composition profile");
  });
});
