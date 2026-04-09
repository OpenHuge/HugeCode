import { describe, expect, it, vi } from "vitest";
import type { HugeCodeMissionControlSnapshot } from "@ku0/code-runtime-host-contract";

const getAppSettings = vi.fn(async () => ({
  defaultRemoteExecutionBackendId: "backend-default",
  runtimeCompositionSettingsByWorkspaceId: {},
}));
const updateAppSettings = vi.fn(async (settings: Record<string, unknown>) => settings);

vi.mock("../ports/desktopAppSettings", () => ({
  getAppSettings,
  updateAppSettings,
  syncRuntimeGatewayProfileFromAppSettings: vi.fn(),
}));

vi.mock("../ports/oauth", () => ({
  applyOAuthPool: vi.fn(),
  bindOAuthPoolAccount: vi.fn(),
  getAccountInfo: vi.fn(),
  getOAuthPrimaryAccount: vi.fn(),
  getProvidersCatalog: vi.fn(),
  listOAuthAccounts: vi.fn(),
  listOAuthPoolMembers: vi.fn(),
  listOAuthPools: vi.fn(),
  runCodexLogin: vi.fn(),
  setOAuthPrimaryAccount: vi.fn(),
}));

vi.mock("../ports/models", () => ({
  getConfigModel: vi.fn(),
  getModelList: vi.fn(),
}));

vi.mock("../ports/workspaceCatalog", () => ({
  listWorkspaces: vi.fn(async () => []),
}));

vi.mock("../ports/runtimeUpdatedEvents", () => ({
  subscribeScopedRuntimeUpdatedEvents: vi.fn(() => () => undefined),
}));

vi.mock("../ports/runtimeJobs", () => ({
  cancelRuntimeRun: vi.fn(),
  interveneRuntimeRun: vi.fn(),
  prepareRuntimeRunV2: vi.fn(),
  resumeRuntimeRun: vi.fn(),
  startRuntimeRunV2: vi.fn(),
  submitRuntimeJobApprovalDecision: vi.fn(),
}));

vi.mock("../ports/runtimeSubAgents", () => ({
  closeSubAgentSession: vi.fn(async (input) => ({ closed: true, sessionId: input.sessionId })),
  getSubAgentSessionStatus: vi.fn(async () => null),
  interruptSubAgentSession: vi.fn(async (input) => ({
    accepted: true,
    sessionId: input.sessionId,
  })),
  sendSubAgentInstruction: vi.fn(async (input) => ({
    session: { sessionId: input.sessionId },
    task: null,
  })),
  spawnSubAgentSession: vi.fn(async (input) => ({ sessionId: "session-1", ...input })),
  waitSubAgentSession: vi.fn(async (input) => ({
    session: { sessionId: input.sessionId },
    task: null,
    done: true,
    timedOut: false,
  })),
}));

vi.mock("../ports/runtimeThreads", () => ({
  archiveRuntimeThread: vi.fn(),
  createRuntimeThread: vi.fn(),
  listRuntimeThreads: vi.fn(),
  resumeRuntimeThread: vi.fn(),
}));

vi.mock("../ports/runtimeGit", () => ({
  checkoutRuntimeGitBranch: vi.fn(),
  commitRuntimeGit: vi.fn(),
  createRuntimeGitBranch: vi.fn(),
  listRuntimeGitBranches: vi.fn(),
  listRuntimeGitChanges: vi.fn(),
  readRuntimeGitDiff: vi.fn(),
  readRuntimeGitLog: vi.fn(),
  revertRuntimeGitChange: vi.fn(),
  stageAllRuntimeGitChanges: vi.fn(),
  stageRuntimeGitChange: vi.fn(),
  unstageRuntimeGitChange: vi.fn(),
}));

vi.mock("../ports/runtimeWorkspaceFiles", () => ({
  listRuntimeWorkspaceFileEntries: vi.fn(),
  readRuntimeWorkspaceFile: vi.fn(),
}));

vi.mock("../ports/missionControl", () => ({
  getMissionControlSnapshot: vi.fn(
    async () =>
      ({
        source: "runtime_snapshot_v1",
        generatedAt: 0,
        workspaces: [],
        tasks: [],
        runs: [],
        reviewPacks: [],
      }) satisfies HugeCodeMissionControlSnapshot
  ),
}));

vi.mock("../ports/runtimeComposition", () => ({
  getRuntimeCompositionProfileV2: vi.fn(async () => ({
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
      preferredBackendIds: ["backend-default"],
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
  })),
  listRuntimeCompositionProfilesV2: vi.fn(async () => [
    {
      id: "workspace-default",
      name: "Workspace Default",
      scope: "workspace",
      enabled: true,
      active: true,
    },
  ]),
  publishRuntimeCompositionSnapshotV1: vi.fn(async () => ({
    authorityState: "published",
    freshnessState: "current",
    authorityRevision: 1,
    lastAcceptedRevision: 1,
    lastPublishAttemptAt: 1,
    publishedAt: 1,
    publisherSessionId: "session-1",
  })),
  resolveRuntimeCompositionV2: vi.fn(async () => ({
    activeProfile: null,
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
    selectedBackendCandidates: [],
    blockedPlugins: [],
    trustDecisions: [],
  })),
}));

vi.mock("../ports/runtime", () => ({
  runRuntimeLiveSkill: vi.fn(),
}));

vi.mock("../ports/runtimeExtensions", () => ({
  invokeRuntimeExtensionTool: vi.fn(),
  listRuntimeExtensionTools: vi.fn(),
}));

vi.mock("../ports/runtimePrompts", () => ({
  listRuntimePrompts: vi.fn(),
}));

vi.mock("../facades/RuntimeGateway", () => ({
  createRuntimeGateway: vi.fn(() => ({
    detectMode: () => "runtime-gateway-web",
    discoverLocalTargets: vi.fn(),
    configureManualWebTarget: vi.fn(),
    readCapabilitiesSummary: vi.fn(),
    readMissionControlSnapshot: vi.fn(),
  })),
}));

vi.mock("../adapters/DesktopHostAdapter", () => ({
  createDesktopHostAdapter: vi.fn(() => ({})),
}));

vi.mock("../facades/discoverLocalRuntimeGatewayTargets", () => ({
  discoverLocalRuntimeGatewayTargets: vi.fn(async () => []),
}));

vi.mock("../../../services/runtimeWebGatewayConfig", () => ({
  subscribeConfiguredWebRuntimeGatewayProfile: vi.fn(() => () => undefined),
}));

vi.mock("../../../services/runtimeKernelProjectionTransport", () => ({
  bootstrapRuntimeKernelProjection: vi.fn(),
  subscribeRuntimeKernelProjection: vi.fn(),
}));

vi.mock("./createWorkspaceRuntimeScope", () => ({
  createWorkspaceRuntimeScope: vi.fn(() => ({
    workspaceId: "workspace-1",
    runtimeGateway: {},
    getCapability: () => null,
    hasCapability: () => false,
    listCapabilities: () => [],
  })),
}));

vi.mock("./createRuntimeAgentControlDependencies", () => ({
  createRuntimeAgentControlDependencies: vi.fn(),
}));

vi.mock("./runtimeExtensionActivation", () => ({
  createRuntimeExtensionActivationService: vi.fn(() => ({})),
}));

vi.mock("./runtimeInvocationCatalog", () => ({
  createRuntimeInvocationCatalogFacade: vi.fn(() => ({})),
}));

vi.mock("./runtimeInvocationExecute", () => ({
  createRuntimeInvocationExecuteFacade: vi.fn(() => ({})),
}));

vi.mock("./runtimeKernelComposition", () => ({
  createRuntimeKernelCompositionFacade: vi.fn(() => ({
    listProfiles: vi.fn(),
    listProfilesV2: vi.fn(),
    getProfile: vi.fn(),
    getProfileV2: vi.fn(),
    previewResolution: vi.fn(),
    previewResolutionV2: vi.fn(),
    applyProfile: vi.fn(),
    applyProfileV2: vi.fn(),
    getActiveResolution: vi.fn(),
    getActiveResolutionV2: vi.fn(),
    publishActiveResolutionV1: vi.fn(),
  })),
}));

vi.mock("./runtimeKernelPluginRegistry", () => ({
  createRuntimeKernelPluginRegistryFacade: vi.fn(() => ({
    listInstalledPackages: vi.fn(async () => []),
    installPackage: vi.fn(),
    updatePackage: vi.fn(),
    uninstallPackage: vi.fn(),
  })),
}));

vi.mock("./runtimeKernelPlugins", () => ({
  createRuntimeKernelPluginCatalogFacade: vi.fn(() => ({ listPlugins: vi.fn(async () => []) })),
  createRuntimeKernelPluginExecutionProvider: vi.fn(() => ({})),
}));

vi.mock("./runtimeWorkspaceSkillManifests", () => ({
  readRuntimeWorkspaceSkillManifests: vi.fn(),
}));

describe("createWorkspaceClientRuntimeBindings", () => {
  it("exposes shared sub-agent bindings through the runtime workspace client surface", async () => {
    const { createWorkspaceClientRuntimeBindings } =
      await import("./createWorkspaceClientRuntimeBindings");
    const {
      spawnSubAgentSession,
      sendSubAgentInstruction,
      waitSubAgentSession,
      getSubAgentSessionStatus,
      interruptSubAgentSession,
      closeSubAgentSession,
    } = await import("../ports/runtimeSubAgents");

    const runtime = createWorkspaceClientRuntimeBindings({
      readMissionControlSnapshot: async () =>
        ({
          source: "runtime_snapshot_v1",
          generatedAt: 0,
          workspaces: [],
          tasks: [],
          runs: [],
          reviewPacks: [],
        }) satisfies HugeCodeMissionControlSnapshot,
      bootstrapKernelProjection: vi.fn(),
      subscribeKernelProjection: vi.fn(() => () => undefined),
    });

    await runtime.subAgents.spawn({ workspaceId: "workspace-1" });
    await runtime.subAgents.send({ sessionId: "session-1", instruction: "Inspect runtime truth." });
    await runtime.subAgents.wait({ sessionId: "session-1" });
    await runtime.subAgents.status({ sessionId: "session-1" });
    await runtime.subAgents.interrupt({ sessionId: "session-1" });
    await runtime.subAgents.close({ sessionId: "session-1" });

    expect(spawnSubAgentSession).toHaveBeenCalledWith({ workspaceId: "workspace-1" });
    expect(sendSubAgentInstruction).toHaveBeenCalledWith({
      sessionId: "session-1",
      instruction: "Inspect runtime truth.",
    });
    expect(waitSubAgentSession).toHaveBeenCalledWith({ sessionId: "session-1" });
    expect(getSubAgentSessionStatus).toHaveBeenCalledWith({ sessionId: "session-1" });
    expect(interruptSubAgentSession).toHaveBeenCalledWith({ sessionId: "session-1" });
    expect(closeSubAgentSession).toHaveBeenCalledWith({ sessionId: "session-1" });
  });

  it("exposes composition bindings and workspace-scoped composition settings", async () => {
    const { createWorkspaceClientRuntimeBindings } =
      await import("./createWorkspaceClientRuntimeBindings");

    const runtime = createWorkspaceClientRuntimeBindings({
      readMissionControlSnapshot: async () =>
        ({
          source: "runtime_snapshot_v1",
          generatedAt: 0,
          workspaces: [],
          tasks: [],
          runs: [],
          reviewPacks: [],
        }) satisfies HugeCodeMissionControlSnapshot,
      bootstrapKernelProjection: vi.fn(),
      subscribeKernelProjection: vi.fn(() => () => undefined),
    });

    expect(runtime.composition).toBeDefined();
    const settings = await runtime.composition?.getSettings("workspace-1");
    expect(settings?.selection.preferredBackendIds).toEqual(["backend-default"]);
    expect(getAppSettings).toHaveBeenCalled();

    await runtime.composition?.updateSettings("workspace-1", {
      selection: {
        profileId: "workspace-default",
        preferredBackendIds: ["backend-primary"],
      },
      launchOverride: null,
      persistence: {
        publisherSessionId: "session-1",
        lastAcceptedAuthorityRevision: 3,
        lastPublishAttemptAt: 5,
        lastPublishedAt: 6,
      },
    });

    expect(updateAppSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultRemoteExecutionBackendId: "backend-default",
        runtimeCompositionSettingsByWorkspaceId: expect.objectContaining({
          "workspace-1": expect.objectContaining({
            selection: expect.objectContaining({
              profileId: "workspace-default",
              preferredBackendIds: ["backend-primary"],
            }),
          }),
        }),
      })
    );
    expect(
      (await runtime.composition?.getSettings("workspace-2"))?.selection.preferredBackendIds
    ).toEqual(["backend-default"]);
  });
});
