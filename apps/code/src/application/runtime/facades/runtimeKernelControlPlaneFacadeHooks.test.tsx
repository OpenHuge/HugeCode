// @vitest-environment jsdom

import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  resolveRuntimeControlPlaneOperatorActionPresentation,
  type RuntimeControlPlaneOperatorAction,
} from "@ku0/code-application";
import type { SettingsShellFraming } from "@ku0/code-workspace-client/settings-shell";
import type { WorkspaceClientBindings } from "@ku0/code-workspace-client/workspace-bindings";
import { WorkspaceClientBindingsProvider } from "../../../../../../packages/code-workspace-client/src/workspace/WorkspaceClientBindingsProvider";
import { RuntimeKernelProvider } from "../kernel/RuntimeKernelContext";
import { RUNTIME_KERNEL_CAPABILITY_KEYS } from "../kernel/runtimeKernelCapabilities";
import {
  useWorkspaceRuntimeComposition,
  useWorkspaceRuntimeControlPlaneOperatorState,
  useWorkspaceRuntimePluginRegistry,
} from "./runtimeKernelControlPlaneFacadeHooks";

const desktopSettingsShellFraming: SettingsShellFraming = {
  kickerLabel: "Preferences",
  contextLabel: "Desktop app",
  title: "Settings",
  subtitle: "Workspace settings",
};

function createRuntimeKernelValue() {
  let compositionSettings = {
    selection: {
      profileId: "workspace-default",
      preferredBackendIds: ["backend-primary"],
    },
    launchOverride: null,
    persistence: {
      publisherSessionId: null,
      lastAcceptedAuthorityRevision: 4,
      lastPublishAttemptAt: null,
      lastPublishedAt: null,
    },
  };
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
    authorityState: "published",
    freshnessState: "current",
    authorityRevision: 1,
    lastAcceptedRevision: 1,
    lastPublishAttemptAt: 1,
    publishedAt: 1,
    publisherSessionId: "session-1",
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
    authorityState: "published",
    freshnessState: "current",
    authorityRevision: 2,
    lastAcceptedRevision: 2,
    lastPublishAttemptAt: 2,
    publishedAt: 2,
    publisherSessionId: "session-1",
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
  const publishActiveResolutionV1 = vi.fn(async () => ({
    activeProfile: null,
    authorityState: "published",
    freshnessState: "current",
    authorityRevision: 3,
    lastAcceptedRevision: 3,
    lastPublishAttemptAt: 3,
    publishedAt: 3,
    publisherSessionId: "session-1",
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
  const listProfilesV2 = vi.fn(async () => [
    {
      id: "workspace-default",
      name: "Workspace Default",
      scope: "workspace",
      enabled: true,
      active: true,
    },
  ]);
  const getProfileV2 = vi.fn(async () => ({
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
  }));
  const resolveV2 = vi.fn(async (input: { profileId?: string | null }) => ({
    ...createRuntimeKernelValueSnapshot(),
    activeProfile: await getProfileV2(),
    provenance: {
      activeProfileId: input.profileId ?? "workspace-default",
      activeProfileName: "Workspace Default",
      appliedLayerOrder: ["built_in", "user", "workspace", "launch_override"],
      selectorDecisions: {},
    },
    authorityRevision: 5,
    lastAcceptedRevision: 5,
    lastPublishAttemptAt: 50,
    publishedAt: 50,
  }));
  const publishSnapshotV1 = vi.fn(
    async (input: { authorityRevision: number; publisherSessionId?: string | null }) => ({
      authorityState: "published",
      freshnessState: "current",
      authorityRevision: input.authorityRevision,
      lastAcceptedRevision: input.authorityRevision,
      lastPublishAttemptAt: 60,
      publishedAt: 61,
      publisherSessionId: input.publisherSessionId ?? "session-1",
    })
  );
  const getSettings = vi.fn(async () => compositionSettings);
  const updateSettings = vi.fn(async (_workspaceId: string, next: typeof compositionSettings) => {
    compositionSettings = next;
    return compositionSettings;
  });

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
          publishActiveResolutionV1,
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
      surface: "shared-workspace-client",
      settings: {
        getAppSettings: async () => ({}),
        updateAppSettings: async (settings: Record<string, unknown>) => settings,
        syncRuntimeGatewayProfileFromAppSettings: () => undefined,
      },
      oauth: {
        listAccounts: async () => [],
        listPools: async () => [],
        listPoolMembers: async () => [],
        getPrimaryAccount: async () => null,
        setPrimaryAccount: async () => {
          throw new Error("not implemented");
        },
        applyPool: async () => undefined,
        bindPoolAccount: async () => undefined,
        runLogin: async () => ({ authUrl: "", immediateSuccess: false }),
        getAccountInfo: async () => null,
        getProvidersCatalog: async () => [],
      },
      models: {
        getModelList: async () => [],
        getConfigModel: async () => null,
      },
      workspaceCatalog: {
        listWorkspaces: async () => [],
      },
      missionControl: {
        readMissionControlSnapshot: async () => ({
          source: "runtime_snapshot_v1",
          generatedAt: 0,
          workspaces: [],
          tasks: [],
          runs: [],
          reviewPacks: [],
        }),
      },
      agentControl: {
        prepareRuntimeRun: async () => {
          throw new Error("not implemented");
        },
        startRuntimeRun: async () => {
          throw new Error("not implemented");
        },
        cancelRuntimeRun: async () => {
          throw new Error("not implemented");
        },
        resumeRuntimeRun: async () => {
          throw new Error("not implemented");
        },
        interveneRuntimeRun: async () => {
          throw new Error("not implemented");
        },
        submitRuntimeJobApprovalDecision: async () => {
          throw new Error("not implemented");
        },
      },
      threads: {
        listThreads: async () => [],
        createThread: async () => ({
          id: "thread-1",
          workspaceId: "workspace-1",
          title: "Thread",
          unread: false,
          running: false,
          createdAt: 0,
          updatedAt: 0,
          provider: "openai",
          modelId: null,
        }),
        resumeThread: async () => null,
        archiveThread: async () => true,
      },
      git: {
        listChanges: async () => ({ staged: [], unstaged: [] }),
        readDiff: async () => null,
        listBranches: async () => ({ currentBranch: "main", branches: [] }),
        createBranch: async () => ({ ok: true, error: null }),
        checkoutBranch: async () => ({ ok: true, error: null }),
        readLog: async () => ({
          total: 0,
          entries: [],
          ahead: 0,
          behind: 0,
          aheadEntries: [],
          behindEntries: [],
          upstream: null,
        }),
        stageChange: async () => ({ ok: true, error: null }),
        stageAll: async () => ({ ok: true, error: null }),
        unstageChange: async () => ({ ok: true, error: null }),
        revertChange: async () => ({ ok: true, error: null }),
        commit: async () => ({ committed: false, committedCount: 0, error: null }),
      },
      workspaceFiles: {
        listWorkspaceFileEntries: async () => [],
        readWorkspaceFile: async () => null,
      },
      review: {
        listReviewPacks: async () => [],
      },
      composition: {
        listProfilesV2,
        getProfileV2,
        resolveV2,
        publishSnapshotV1,
        getSettings,
        updateSettings,
      },
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
    publishActiveResolutionV1,
    listProfilesV2,
    getProfileV2,
    resolveV2,
    publishSnapshotV1,
    getSettings,
    updateSettings,
  };
}

function createRuntimeKernelValueSnapshot() {
  return {
    authorityState: "published" as const,
    freshnessState: "current" as const,
    authorityRevision: 1,
    lastAcceptedRevision: 1,
    lastPublishAttemptAt: 1,
    publishedAt: 1,
    publisherSessionId: "session-1",
    pluginEntries: [],
    selectedRouteCandidates: [],
    selectedBackendCandidates: [{ backendId: "backend-primary", sourcePluginId: null }],
    blockedPlugins: [],
    trustDecisions: [],
  };
}

function wrapper(kernelValue: ReturnType<typeof createRuntimeKernelValue>) {
  const bindings: WorkspaceClientBindings = {
    navigation: {
      readRouteSelection: () => ({ kind: "home" }),
      subscribeRouteSelection: () => () => undefined,
      navigateToWorkspace: () => undefined,
      navigateToSection: () => undefined,
      navigateHome: () => undefined,
    },
    runtimeGateway: {
      readRuntimeMode: () => "connected",
      subscribeRuntimeMode: () => () => undefined,
      discoverLocalRuntimeGatewayTargets: async () => [],
      configureManualWebRuntimeGatewayTarget: () => undefined,
    },
    runtime: kernelValue.workspaceClientRuntime as never,
    host: {
      platform: "desktop",
      intents: {
        openOauthAuthorizationUrl: async () => undefined,
        createOauthPopupWindow: () => null,
        waitForOauthBinding: async () => false,
      },
      notifications: {
        testSound: () => undefined,
        testSystemNotification: () => undefined,
      },
      shell: {
        platformHint: "desktop",
      },
    },
    platformUi: {
      WorkspaceRuntimeShell: function TestRuntimeShell() {
        return null;
      },
      WorkspaceApp: function TestWorkspaceApp() {
        return null;
      },
      renderWorkspaceHost: (children) => children,
      settingsShellFraming: desktopSettingsShellFraming,
    },
  };

  return ({ children }: { children: ReactNode }) => (
    <WorkspaceClientBindingsProvider bindings={bindings}>
      <RuntimeKernelProvider value={kernelValue as never}>{children}</RuntimeKernelProvider>
    </WorkspaceClientBindingsProvider>
  );
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
        wrapper: wrapper(kernelValue),
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
    expect(kernelValue.publishSnapshotV1).toHaveBeenCalledTimes(1);
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
    expect(kernelValue.applyProfileV2).not.toHaveBeenCalled();
    expect(kernelValue.updateSettings).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(result.current.info).toContain("Applied runtime composition profile");
  });

  it("reuses workspace-scoped registry and composition facades across rerenders", () => {
    const kernelValue = createRuntimeKernelValue();

    const { rerender } = renderHook(
      ({ workspaceId }) => ({
        registry: useWorkspaceRuntimePluginRegistry(workspaceId),
        composition: useWorkspaceRuntimeComposition(workspaceId),
      }),
      {
        initialProps: { workspaceId: "workspace-1" as string | null },
        wrapper: wrapper(kernelValue),
      }
    );

    rerender({ workspaceId: "workspace-1" });
    rerender({ workspaceId: "workspace-1" });

    expect(kernelValue.getWorkspaceScope).toHaveBeenCalledTimes(2);
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
        wrapper: wrapper(kernelValue),
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
    expect(kernelValue.publishSnapshotV1).toHaveBeenCalledTimes(3);
    expect(refresh).toHaveBeenCalledTimes(3);
    expect(result.current.previewProfileId).toBeNull();
    expect(result.current.previewResolution).toBeNull();
    expect(result.current.previewSnapshot).toBeNull();
    expect(result.current.info).toContain("Uninstalled runtime plugin package");
  });
});
