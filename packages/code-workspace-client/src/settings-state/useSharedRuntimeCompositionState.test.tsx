// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { SettingsShellFraming } from "../settings-shell/settingsShellTypes";
import type { WorkspaceClientBindings } from "../workspace/bindings";
import { WorkspaceClientBindingsProvider } from "../workspace/WorkspaceClientBindingsProvider";
import { useSharedRuntimeCompositionState } from "./useSharedRuntimeCompositionState";

const desktopSettingsShellFraming: SettingsShellFraming = {
  kickerLabel: "Preferences",
  contextLabel: "Desktop app",
  title: "Settings",
  subtitle: "Workspace settings",
};

function createCompositionSnapshot(profileId: string | null, authorityRevision = 1) {
  return {
    activeProfile: profileId
      ? {
          id: profileId,
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
        }
      : null,
    authorityState: "published",
    freshnessState: "current",
    authorityRevision,
    lastAcceptedRevision: authorityRevision,
    lastPublishAttemptAt: authorityRevision * 10,
    publishedAt: authorityRevision * 10,
    publisherSessionId: "session-1",
    provenance: {
      activeProfileId: profileId,
      activeProfileName: profileId ? "Workspace Default" : undefined,
      appliedLayerOrder: ["built_in", "user", "workspace", "launch_override"],
      selectorDecisions: {},
    },
    pluginEntries: [],
    selectedRouteCandidates: [],
    selectedBackendCandidates: [{ backendId: "backend-primary", sourcePluginId: null }],
    blockedPlugins: [],
    trustDecisions: [],
  } as const;
}

function createBindings() {
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
  const composition = {
    listProfilesV2: vi.fn(async () => [
      {
        id: "workspace-default",
        name: "Workspace Default",
        scope: "workspace",
        enabled: true,
        active: true,
      },
    ]),
    getProfileV2: vi.fn(async () => createCompositionSnapshot("workspace-default").activeProfile),
    resolveV2: vi.fn(async (input: { profileId?: string | null }) =>
      createCompositionSnapshot(input.profileId ?? "workspace-default", 5)
    ),
    publishSnapshotV1: vi.fn(
      async (input: { authorityRevision: number; publisherSessionId?: string | null }) => ({
        authorityState: "published",
        freshnessState: "current",
        authorityRevision: input.authorityRevision,
        lastAcceptedRevision: input.authorityRevision,
        lastPublishAttemptAt: 88,
        publishedAt: 89,
        publisherSessionId: input.publisherSessionId ?? "session-2",
      })
    ),
    getSettings: vi.fn(async () => compositionSettings),
    updateSettings: vi.fn(async (_workspaceId: string, next: typeof compositionSettings) => {
      compositionSettings = next;
      return compositionSettings;
    }),
  };

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
    runtime: {
      surface: "shared-workspace-client",
      settings: {
        getAppSettings: async () => ({}),
        updateAppSettings: async (settings) => settings,
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
      composition,
    },
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
  return { bindings, composition };
}

function wrapper(bindings: WorkspaceClientBindings) {
  return ({ children }: { children: ReactNode }) => (
    <WorkspaceClientBindingsProvider bindings={bindings}>
      {children}
    </WorkspaceClientBindingsProvider>
  );
}

describe("useSharedRuntimeCompositionState", () => {
  it("loads runtime composition settings, profiles, and snapshot-backed resolution", async () => {
    const { bindings, composition } = createBindings();
    const { result } = renderHook(
      () => useSharedRuntimeCompositionState({ workspaceId: "workspace-1" }),
      { wrapper: wrapper(bindings) }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.activeProfileId).toBe("workspace-default");
      expect(result.current.profiles).toHaveLength(1);
      expect(result.current.snapshot?.authorityRevision).toBe(5);
    });

    expect(composition.getSettings).toHaveBeenCalledWith("workspace-1");
    expect(composition.resolveV2).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      profileId: "workspace-default",
      launchOverride: {
        backendPolicy: {
          preferredBackendIds: ["backend-primary"],
        },
      },
    });
  });

  it("persists applied profile selection and advances publish authority metadata", async () => {
    const { bindings, composition } = createBindings();
    const { result } = renderHook(
      () => useSharedRuntimeCompositionState({ workspaceId: "workspace-1" }),
      { wrapper: wrapper(bindings) }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.applyProfile("workspace-default");
      await result.current.publishActiveResolution();
    });

    expect(composition.updateSettings).toHaveBeenCalled();
    expect(result.current.settings?.selection.profileId).toBe("workspace-default");
    expect(composition.publishSnapshotV1).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        authorityRevision: 6,
      })
    );
    expect(result.current.settings?.persistence.lastAcceptedAuthorityRevision).toBe(6);
    expect(result.current.snapshot?.publishedAt).toBe(89);
  });
});
