// @vitest-environment jsdom

import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RuntimeKernelProvider } from "../kernel/RuntimeKernelContext";
import { RUNTIME_KERNEL_CAPABILITY_KEYS } from "../kernel/runtimeKernelCapabilities";
import { useWorkspaceRuntimeControlPlaneOperatorState } from "./runtimeKernelControlPlaneFacadeHooks";
import { resolveRuntimeControlPlaneOperatorActionPresentation } from "./runtimeKernelControlPlaneOperatorPresentation";
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
  const previewResolutionV2 = vi.fn(async () => ({
    activeProfile: {
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
    provenance: {
      activeProfileId: "workspace-default",
      activeProfileName: "Workspace Default",
      appliedLayerOrder: ["built_in", "user", "workspace", "launch_override"],
      selectorDecisions: {},
    },
    pluginEntries: [],
    selectedRouteCandidates: [],
    selectedBackendCandidates: [{ backendId: "backend-primary", sourcePluginId: null }],
    blockedPlugins: [],
    trustDecisions: [],
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
  const applyProfileV2 = vi.fn(async () => ({
    activeProfile: {
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
    provenance: {
      activeProfileId: "workspace-default",
      activeProfileName: "Workspace Default",
      appliedLayerOrder: ["built_in", "user", "workspace", "launch_override"],
      selectorDecisions: {},
    },
    pluginEntries: [],
    selectedRouteCandidates: [],
    selectedBackendCandidates: [{ backendId: "backend-primary", sourcePluginId: null }],
    blockedPlugins: [],
    trustDecisions: [],
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
          previewResolutionV2,
          applyProfile,
          applyProfileV2,
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
    previewResolutionV2,
    applyProfile,
    applyProfileV2,
  };
}

describe("runtimeKernelControlPlaneFacadeHooks", () => {
  it("derives button presentation from runtime loading, busy action, and action metadata", () => {
    const action = {
      id: "pkg.search.remote:install",
      kind: "install",
      label: "Install",
      detail: "Install this package into the runtime plugin registry.",
      tone: "primary",
      disabledReason: null,
      packageRef: "hugecode.mcp.search@1.0.0",
      pluginId: "pkg.search.remote",
      profileId: null,
    } satisfies RuntimeControlPlaneOperatorAction;

    expect(
      resolveRuntimeControlPlaneOperatorActionPresentation({
        action,
        busyActionId: action.id,
        runtimeLoading: false,
      })
    ).toMatchObject({
      busy: true,
      disabled: true,
      label: "Working...",
      title: "Install this package into the runtime plugin registry.",
    });

    expect(
      resolveRuntimeControlPlaneOperatorActionPresentation({
        action: {
          ...action,
          disabledReason: "Package trust requirements are not satisfied.",
        },
        busyActionId: null,
        runtimeLoading: false,
      })
    ).toMatchObject({
      busy: false,
      disabled: true,
      label: "Install",
      title: "Package trust requirements are not satisfied.",
    });
  });

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
      expect(result.current.previewSnapshot?.selectedBackendCandidates).toHaveLength(1);
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

    expect(kernelValue.applyProfile).not.toHaveBeenCalled();
    expect(kernelValue.applyProfileV2).toHaveBeenCalledWith({
      profileId: "workspace-default",
    });
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(result.current.info).toContain("Applied runtime composition profile");
  });

  it("runs trust override, update, and uninstall actions through the runtime facade", async () => {
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
    const devOverrideAction = {
      id: "pkg.unsigned.remote:install-with-dev-override",
      kind: "install_with_dev_override",
      label: "Install with dev trust override",
      detail: "Allow an unsigned local-dev package for this workspace profile.",
      tone: "warning",
      disabledReason: null,
      packageRef: "hugecode.mcp.unsigned-lab@0.3.0",
      pluginId: "pkg.unsigned.remote",
      profileId: "workspace-default",
    } satisfies RuntimeControlPlaneOperatorAction;
    const updateAction = {
      id: "pkg.search.remote:update",
      kind: "update",
      label: "Check for update",
      detail: null,
      tone: "neutral",
      disabledReason: null,
      packageRef: "hugecode.mcp.search@1.0.0",
      pluginId: "pkg.search.remote",
      profileId: null,
    } satisfies RuntimeControlPlaneOperatorAction;
    const uninstallAction = {
      id: "pkg.search.remote:uninstall",
      kind: "uninstall",
      label: "Uninstall",
      detail: null,
      tone: "danger",
      disabledReason: null,
      packageRef: "hugecode.mcp.search@1.0.0",
      pluginId: "pkg.search.remote",
      profileId: null,
    } satisfies RuntimeControlPlaneOperatorAction;

    await act(async () => {
      await result.current.runAction(previewAction);
    });

    expect(result.current.previewProfileId).toBe("workspace-default");
    expect(result.current.previewSnapshot).not.toBeNull();

    await act(async () => {
      await result.current.runAction(devOverrideAction);
      await result.current.runAction(updateAction);
      await result.current.runAction(uninstallAction);
    });

    expect(kernelValue.installPackage).toHaveBeenCalledWith({
      packageRef: "hugecode.mcp.unsigned-lab@0.3.0",
      trustOverride: "allow_unsigned_local_dev",
    });
    expect(kernelValue.updatePackage).toHaveBeenCalledWith("hugecode.mcp.search@1.0.0");
    expect(kernelValue.uninstallPackage).toHaveBeenCalledWith("pkg.search.remote");
    expect(refresh).toHaveBeenCalledTimes(3);
    expect(result.current.previewProfileId).toBeNull();
    expect(result.current.previewResolution).toBeNull();
    expect(result.current.previewSnapshot).toBeNull();
    expect(result.current.info).toContain("Uninstalled runtime plugin package");
  });
});
