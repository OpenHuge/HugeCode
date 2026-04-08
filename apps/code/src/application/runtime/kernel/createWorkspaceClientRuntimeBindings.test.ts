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
  });
});
