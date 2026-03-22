// @vitest-environment jsdom

import { ask, open } from "@tauri-apps/plugin-dialog";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, vi } from "vitest";
import {
  type SettingsShellFraming,
  type WorkspaceClientBindings,
  WorkspaceClientBindingsProvider,
} from "@ku0/code-workspace-client";
import {
  applyOAuthPool,
  getAccountInfo,
  getOAuthPrimaryAccount,
  getProvidersCatalog,
  listOAuthAccounts,
  listOAuthPoolMembers,
  listOAuthPools,
  replaceOAuthPoolMembers,
  setOAuthPrimaryAccount,
  upsertOAuthAccount,
  upsertOAuthPool,
} from "../../../application/runtime/ports/tauriOauth";
import { getModelList } from "../../../application/runtime/ports/tauriModels";
import { listWorkspaces } from "../../../application/runtime/ports/tauriWorkspaceCatalog";
import {
  acpIntegrationProbe,
  acpIntegrationsList,
  acpIntegrationRemove,
  acpIntegrationSetState,
  acpIntegrationUpsert,
  cancelNativeScheduleRun,
  createNativeSchedule,
  getRuntimeCapabilitiesSummary,
  listNativeSchedules,
  runtimeBackendRemove,
  runtimeBackendSetState,
  runtimeBackendsList,
  runtimeBackendUpsert,
  runNativeScheduleNow,
  tailscaleDaemonCommandPreview,
  tailscaleDaemonStatus,
  tailscaleStatus,
  updateNativeSchedule,
} from "../../../application/runtime/ports/tauriRemoteServers";
import type { AppSettings, RemoteBackendProfile, WorkspaceInfo } from "../../../types";
import { DEFAULT_COMMIT_MESSAGE_PROMPT } from "../../../utils/commitMessagePrompt";
import { SettingsView } from "./SettingsView";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  ask: vi.fn(),
  open: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/tauriAppSettings", () => ({
  getAppSettings: vi.fn(),
  updateAppSettings: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/tauriModels", async () => {
  const actual = await vi.importActual<
    typeof import("../../../application/runtime/ports/tauriModels")
  >("../../../application/runtime/ports/tauriModels");
  return {
    ...actual,
    getModelList: vi.fn(),
  };
});

vi.mock("../../../application/runtime/ports/tauriOauth", async () => {
  const actual = await vi.importActual<
    typeof import("../../../application/runtime/ports/tauriOauth")
  >("../../../application/runtime/ports/tauriOauth");
  return {
    ...actual,
    getAccountInfo: vi.fn(),
    getOAuthPrimaryAccount: vi.fn(),
    getProvidersCatalog: vi.fn(),
    listOAuthAccounts: vi.fn(),
    listOAuthPoolMembers: vi.fn(),
    listOAuthPools: vi.fn(),
    applyOAuthPool: vi.fn(),
    setOAuthPrimaryAccount: vi.fn(),
    upsertOAuthAccount: vi.fn(),
    upsertOAuthPool: vi.fn(),
    replaceOAuthPoolMembers: vi.fn(),
    removeOAuthAccount: vi.fn(),
    removeOAuthPool: vi.fn(),
  };
});

vi.mock("../../../application/runtime/ports/tauriWorkspaceCatalog", () => ({
  listWorkspaces: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/tauriRemoteServers", async () => {
  const actual = await vi.importActual<
    typeof import("../../../application/runtime/ports/tauriRemoteServers")
  >("../../../application/runtime/ports/tauriRemoteServers");
  return {
    ...actual,
    acpIntegrationProbe: vi.fn(),
    acpIntegrationsList: vi.fn(),
    acpIntegrationRemove: vi.fn(),
    acpIntegrationSetState: vi.fn(),
    acpIntegrationUpsert: vi.fn(),
    cancelNativeScheduleRun: vi.fn(),
    createNativeSchedule: vi.fn(),
    getRuntimeCapabilitiesSummary: vi.fn(),
    listNativeSchedules: vi.fn(),
    listWorkspaces: vi.fn(),
    runtimeBackendsList: vi.fn(),
    runtimeBackendSetState: vi.fn(),
    runtimeBackendRemove: vi.fn(),
    runtimeBackendUpsert: vi.fn(),
    runNativeScheduleNow: vi.fn(),
    tailscaleStatus: vi.fn(),
    tailscaleDaemonCommandPreview: vi.fn(),
    tailscaleDaemonStatus: vi.fn(),
    tailscaleDaemonStart: vi.fn(),
    tailscaleDaemonStop: vi.fn(),
    updateNativeSchedule: vi.fn(),
    orbitConnectTest: vi.fn(),
    orbitRunnerStart: vi.fn(),
    orbitRunnerStatus: vi.fn(),
    orbitRunnerStop: vi.fn(),
    orbitSignInPoll: vi.fn(),
    orbitSignInStart: vi.fn(),
    orbitSignOut: vi.fn(),
  };
});

export const getModelListMock = vi.mocked(getModelList);
export const getRuntimeCapabilitiesSummaryMock = vi.mocked(getRuntimeCapabilitiesSummary);
export const getAccountInfoMock = vi.mocked(getAccountInfo);
export const getOAuthPrimaryAccountMock = vi.mocked(getOAuthPrimaryAccount);
export const getProvidersCatalogMock = vi.mocked(getProvidersCatalog);
export const listOAuthAccountsMock = vi.mocked(listOAuthAccounts);
export const listOAuthPoolMembersMock = vi.mocked(listOAuthPoolMembers);
export const listOAuthPoolsMock = vi.mocked(listOAuthPools);
export const applyOAuthPoolMock = vi.mocked(applyOAuthPool);
export const acpIntegrationProbeMock = vi.mocked(acpIntegrationProbe);
export const acpIntegrationsListMock = vi.mocked(acpIntegrationsList);
export const acpIntegrationRemoveMock = vi.mocked(acpIntegrationRemove);
export const acpIntegrationSetStateMock = vi.mocked(acpIntegrationSetState);
export const acpIntegrationUpsertMock = vi.mocked(acpIntegrationUpsert);
export const cancelNativeScheduleRunMock = vi.mocked(cancelNativeScheduleRun);
export const createNativeScheduleMock = vi.mocked(createNativeSchedule);
export const replaceOAuthPoolMembersMock = vi.mocked(replaceOAuthPoolMembers);
export const setOAuthPrimaryAccountMock = vi.mocked(setOAuthPrimaryAccount);
export const listNativeSchedulesMock = vi.mocked(listNativeSchedules);
export const runtimeBackendsListMock = vi.mocked(runtimeBackendsList);
export const runtimeBackendSetStateMock = vi.mocked(runtimeBackendSetState);
export const runtimeBackendRemoveMock = vi.mocked(runtimeBackendRemove);
export const runtimeBackendUpsertMock = vi.mocked(runtimeBackendUpsert);
export const runNativeScheduleNowMock = vi.mocked(runNativeScheduleNow);
export const tailscaleStatusMock = vi.mocked(tailscaleStatus);
export const tailscaleDaemonCommandPreviewMock = vi.mocked(tailscaleDaemonCommandPreview);
export const tailscaleDaemonStatusMock = vi.mocked(tailscaleDaemonStatus);
export const updateNativeScheduleMock = vi.mocked(updateNativeSchedule);
export const upsertOAuthAccountMock = vi.mocked(upsertOAuthAccount);
export const upsertOAuthPoolMock = vi.mocked(upsertOAuthPool);
export const listWorkspacesMock = vi.mocked(listWorkspaces);
export const askMock = vi.mocked(ask);
export const openMock = vi.mocked(open);

import { getAppSettings } from "../../../application/runtime/ports/tauriAppSettings";
export const getAppSettingsMock = vi.mocked(getAppSettings);

const desktopSettingsShellFraming: SettingsShellFraming = {
  kickerLabel: "Preferences",
  contextLabel: "Desktop app",
  title: "Settings",
  subtitle: "Workspace settings",
};

function createWorkspaceClientBindings(): WorkspaceClientBindings {
  return {
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
        getAppSettings: async () => getAppSettingsMock(),
        updateAppSettings: async (settings) => settings,
        syncRuntimeGatewayProfileFromAppSettings: () => undefined,
      },
      oauth: {
        listAccounts: async (provider) => listOAuthAccountsMock(provider ?? null),
        listPools: async (provider) => listOAuthPoolsMock(provider ?? null),
        listPoolMembers: async (poolId) => listOAuthPoolMembersMock(poolId),
        getPrimaryAccount: async (provider) => getOAuthPrimaryAccountMock(provider),
        setPrimaryAccount: async (input) => setOAuthPrimaryAccountMock(input),
        applyPool: async (input) => applyOAuthPoolMock(input),
        bindPoolAccount: async () => undefined,
        runLogin: async () => ({ authUrl: "", immediateSuccess: false }),
        getAccountInfo: async (workspaceId) => getAccountInfoMock(workspaceId),
        getProvidersCatalog: async () => getProvidersCatalogMock(),
      },
      models: {
        getModelList: async (workspaceId) => getModelListMock(workspaceId),
        getConfigModel: async () => null,
      },
      workspaceCatalog: {
        listWorkspaces: async () =>
          (await listWorkspacesMock())?.map((workspace) => ({
            id: workspace.id,
            name: workspace.name,
            connected: workspace.connected,
          })) ?? [],
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
        startRuntimeJob: async () => {
          throw new Error("not implemented");
        },
        cancelRuntimeJob: async () => {
          throw new Error("not implemented");
        },
        resumeRuntimeJob: async () => {
          throw new Error("not implemented");
        },
        interveneRuntimeJob: async () => {
          throw new Error("not implemented");
        },
        subscribeRuntimeJob: async () => null,
        listRuntimeJobs: async () => [],
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
      WorkspaceRuntimeShell: () => null,
      WorkspaceApp: () => null,
      renderWorkspaceHost: (children) => children,
      settingsShellFraming: desktopSettingsShellFraming,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("codex_accounts_tab_v1");
    window.localStorage.removeItem("codex_accounts_provider_filter_v1");
    window.localStorage.removeItem("codex_accounts_status_filter_v1");
    window.localStorage.removeItem("codex_accounts_search_query_v1");
    window.localStorage.removeItem("codex_pools_provider_filter_v1");
  }
  getAppSettingsMock.mockResolvedValue(baseSettings);
  getModelListMock.mockResolvedValue({ result: { data: [] } });
  getRuntimeCapabilitiesSummaryMock.mockResolvedValue({
    mode: "tauri",
    methods: [],
    features: [],
    wsEndpointPath: null,
    error: null,
  });
  getAccountInfoMock.mockResolvedValue({
    result: {
      requiresOpenaiAuth: false,
      account: null,
      requires_openai_auth: false,
    },
  });
  getProvidersCatalogMock.mockResolvedValue([]);
  getOAuthPrimaryAccountMock.mockResolvedValue({
    provider: "codex",
    accountId: null,
    account: null,
    defaultPoolId: "pool-codex",
    routeAccountId: null,
    inSync: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  listOAuthAccountsMock.mockResolvedValue([]);
  listOAuthPoolMembersMock.mockResolvedValue([]);
  listOAuthPoolsMock.mockResolvedValue([]);
  applyOAuthPoolMock.mockImplementation(async (input) => {
    const now = Date.now();
    return {
      pool: {
        ...input.pool,
        strategy: input.pool.strategy ?? "round_robin",
        stickyMode: input.pool.stickyMode ?? "cache_first",
        preferredAccountId: input.pool.preferredAccountId ?? null,
        enabled: input.pool.enabled ?? true,
        metadata: input.pool.metadata ?? {},
        createdAt: now,
        updatedAt: now,
      },
      members: input.members.map((member, index) => ({
        poolId: input.pool.poolId,
        accountId: member.accountId,
        weight: member.weight ?? 1,
        priority: member.priority ?? index,
        position: member.position ?? index,
        enabled: member.enabled ?? true,
        createdAt: now,
        updatedAt: now,
      })),
    };
  });
  runtimeBackendsListMock.mockResolvedValue(null);
  listNativeSchedulesMock.mockResolvedValue([]);
  acpIntegrationsListMock.mockResolvedValue([]);
  acpIntegrationProbeMock.mockResolvedValue({
    integrationId: "acp-seed",
    backendId: "acp:acp-seed",
    displayName: "ACP Seed",
    state: "active",
    transport: "stdio",
    transportConfig: {
      transport: "stdio",
      command: "codex",
      args: [],
    },
    healthy: true,
    lastError: null,
    lastProbeAt: Date.now(),
    capabilities: [],
    maxConcurrency: 1,
    costTier: "standard",
    latencyClass: "standard",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  acpIntegrationRemoveMock.mockResolvedValue(true);
  acpIntegrationSetStateMock.mockResolvedValue({
    integrationId: "acp-seed",
    backendId: "acp:acp-seed",
    displayName: "ACP Seed",
    state: "active",
    transport: "stdio",
    transportConfig: {
      transport: "stdio",
      command: "codex",
      args: [],
    },
    healthy: true,
    lastError: null,
    lastProbeAt: Date.now(),
    capabilities: [],
    maxConcurrency: 1,
    costTier: "standard",
    latencyClass: "standard",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  acpIntegrationUpsertMock.mockResolvedValue({
    integrationId: "acp-new",
    backendId: "acp:acp-new",
    displayName: "ACP New",
    state: "active",
    transport: "stdio",
    transportConfig: {
      transport: "stdio",
      command: "codex",
      args: [],
    },
    healthy: true,
    lastError: null,
    lastProbeAt: Date.now(),
    capabilities: [],
    maxConcurrency: 1,
    costTier: "standard",
    latencyClass: "standard",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  runtimeBackendSetStateMock.mockResolvedValue({
    backendId: "backend-seed",
    displayName: "Backend Seed",
    capabilities: [],
    maxConcurrency: 1,
    costTier: "standard",
    latencyClass: "regional",
    rolloutState: "current",
    status: "active",
    healthy: true,
    healthScore: 1,
    failures: 0,
    queueDepth: 0,
    runningTasks: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastHeartbeatAt: Date.now(),
  });
  runtimeBackendRemoveMock.mockResolvedValue(true);
  runtimeBackendUpsertMock.mockResolvedValue({
    backendId: "backend-new",
    displayName: "Backend New",
    capabilities: [],
    maxConcurrency: 1,
    costTier: "standard",
    latencyClass: "regional",
    rolloutState: "current",
    status: "active",
    healthy: true,
    healthScore: 1,
    failures: 0,
    queueDepth: 0,
    runningTasks: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastHeartbeatAt: Date.now(),
  });
  tailscaleStatusMock.mockResolvedValue({
    installed: false,
    running: false,
    version: null,
    dnsName: null,
    hostName: null,
    tailnetName: null,
    ipv4: [],
    ipv6: [],
    suggestedRemoteHost: null,
    message: "Tailscale not installed.",
  });
  tailscaleDaemonCommandPreviewMock.mockResolvedValue({
    command: "tailscaled",
    daemonPath: "/usr/bin/tailscaled",
    args: ["--tun=userspace-networking"],
    tokenConfigured: false,
  });
  tailscaleDaemonStatusMock.mockResolvedValue({
    state: "stopped",
    pid: null,
    startedAtMs: null,
    lastError: null,
    listenAddr: null,
  });
  createNativeScheduleMock.mockResolvedValue({
    id: "schedule-new",
    enabled: true,
    name: "New automation",
    status: "idle",
    cron: "Every weekday at 09:00",
    updatedAt: Date.now(),
    lastActionAt: null,
  });
  updateNativeScheduleMock.mockResolvedValue({
    id: "schedule-seed",
    enabled: true,
    name: "Seed automation",
    status: "idle",
    cron: "Every weekday at 09:00",
    updatedAt: Date.now(),
    lastActionAt: Date.now(),
  });
  runNativeScheduleNowMock.mockResolvedValue({
    id: "schedule-seed",
    enabled: true,
    name: "Seed automation",
    status: "running",
    cron: "Every weekday at 09:00",
    updatedAt: Date.now(),
    lastActionAt: Date.now(),
  });
  cancelNativeScheduleRunMock.mockResolvedValue({
    id: "schedule-seed",
    enabled: true,
    name: "Seed automation",
    status: "cancelled",
    cron: "Every weekday at 09:00",
    updatedAt: Date.now(),
    lastActionAt: Date.now(),
  });
  replaceOAuthPoolMembersMock.mockResolvedValue([]);
  setOAuthPrimaryAccountMock.mockResolvedValue({
    provider: "codex",
    accountId: null,
    account: null,
    defaultPoolId: "pool-codex",
    routeAccountId: null,
    inSync: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  upsertOAuthAccountMock.mockResolvedValue({
    accountId: "acc-seed",
    provider: "codex",
    externalAccountId: null,
    email: "user@example.com",
    displayName: "User",
    status: "enabled",
    disabledReason: null,
    metadata: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  upsertOAuthPoolMock.mockResolvedValue({
    poolId: "codex-default",
    provider: "codex",
    name: "Default pool",
    strategy: "round_robin",
    stickyMode: "cache_first",
    preferredAccountId: null,
    enabled: true,
    metadata: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  askMock.mockResolvedValue(false);
  openMock.mockResolvedValue(null);
  listWorkspacesMock.mockResolvedValue([
    {
      id: "workspace-1",
      connected: true,
    },
  ] as Awaited<ReturnType<typeof listWorkspaces>>);
});

export function createDefaultRemoteProfile(
  overrides: Partial<RemoteBackendProfile> = {}
): RemoteBackendProfile {
  return {
    id: "remote-backend-primary",
    label: "Primary remote backend",
    provider: "tcp",
    tcpOverlay: "tailscale",
    host: "127.0.0.1:4732",
    token: null,
    gatewayConfig: null,
    orbitWsUrl: null,
    orbitAuthUrl: null,
    orbitRunnerName: null,
    orbitUseAccess: false,
    orbitAccessClientId: null,
    orbitAccessClientSecretRef: null,
    ...overrides,
  };
}

export function withDefaultRemoteProfile(
  settings: AppSettings,
  overrides: Partial<RemoteBackendProfile> = {}
): AppSettings {
  const profile = createDefaultRemoteProfile({
    ...settings.remoteBackendProfiles?.[0],
    ...overrides,
  });
  return {
    ...settings,
    remoteBackendProfiles: [profile],
    defaultRemoteBackendProfileId: profile.id,
  };
}

export const baseSettings: AppSettings = {
  codexBin: null,
  codexArgs: null,
  backendMode: "local",
  remoteBackendProfiles: [createDefaultRemoteProfile()],
  defaultRemoteBackendProfileId: "remote-backend-primary",
  defaultRemoteExecutionBackendId: null,
  orbitAutoStartRunner: false,
  keepDaemonRunningAfterAppClose: false,
  defaultAccessMode: "full-access",
  reviewDeliveryMode: "inline",
  composerModelShortcut: null,
  composerAccessShortcut: null,
  composerReasoningShortcut: null,
  composerCollaborationShortcut: null,
  interruptShortcut: null,
  newAgentShortcut: null,
  newWorktreeAgentShortcut: null,
  newCloneAgentShortcut: null,
  archiveThreadShortcut: null,
  toggleProjectsSidebarShortcut: null,
  toggleGitSidebarShortcut: null,
  branchSwitcherShortcut: null,
  toggleDebugPanelShortcut: null,
  toggleTerminalShortcut: null,
  cycleAgentNextShortcut: null,
  cycleAgentPrevShortcut: null,
  cycleWorkspaceNextShortcut: null,
  cycleWorkspacePrevShortcut: null,
  lastComposerModelId: null,
  lastComposerReasoningEffort: null,
  uiScale: 1,
  theme: "system",
  usageShowRemaining: false,
  showMessageFilePath: true,
  showInternalRuntimeDiagnostics: false,
  threadTitleAutogenerationEnabled: false,
  uiFontFamily:
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  codeFontFamily:
    'ui-monospace, "Cascadia Mono", "Segoe UI Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  codeFontSize: 11,
  notificationSoundsEnabled: true,
  systemNotificationsEnabled: true,
  splitChatDiffView: false,
  preloadGitDiffs: true,
  gitDiffIgnoreWhitespaceChanges: false,
  commitMessagePrompt: DEFAULT_COMMIT_MESSAGE_PROMPT,
  experimentalCollabEnabled: false,
  collaborationModesEnabled: true,
  steerEnabled: true,
  unifiedExecEnabled: true,
  personality: "friendly",
  composerEditorPreset: "default",
  composerFenceExpandOnSpace: false,
  composerFenceExpandOnEnter: false,
  composerFenceLanguageTags: false,
  composerFenceWrapSelection: false,
  composerFenceAutoWrapPasteMultiline: false,
  composerFenceAutoWrapPasteCodeLike: false,
  composerListContinuation: false,
  composerCodeBlockCopyUseModifier: false,
  workspaceGroups: [],
  openAppTargets: [
    {
      id: "vscode",
      label: "VS Code",
      kind: "app",
      appName: "Visual Studio Code",
      command: null,
      args: [],
    },
  ],
  selectedOpenAppId: "vscode",
};

export const createDoctorResult = () => ({
  ok: true,
  codexBin: null,
  version: null,
  appServerOk: true,
  details: null,
  path: null,
  nodeOk: true,
  nodeVersion: null,
  nodeDetails: null,
});

export const createUpdateResult = () => ({
  ok: true,
  method: "brew_formula" as const,
  package: "codex",
  beforeVersion: "codex 0.0.0",
  afterVersion: "codex 0.0.1",
  upgraded: true,
  output: null,
  details: null,
});

export async function settleSettingsViewRender(iterations = 4) {
  for (let index = 0; index < iterations; index += 1) {
    await act(async () => {
      await Promise.resolve();
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    });
  }
}

export async function renderSettled(ui: Parameters<typeof render>[0]) {
  const bindings = createWorkspaceClientBindings();
  const wrap = (element: Parameters<typeof render>[0]) => (
    <WorkspaceClientBindingsProvider bindings={bindings}>{element}</WorkspaceClientBindingsProvider>
  );
  const rendered = render(wrap(ui));
  await settleSettingsViewRender();

  return {
    ...rendered,
    rerender(nextUi: Parameters<typeof render>[0]) {
      rendered.rerender(wrap(nextUi));
    },
  };
}

export async function actAndFlush(action: () => void | Promise<void>, iterations?: number) {
  await act(async () => {
    await action();
  });
  await settleSettingsViewRender(iterations);
}

type SelectScope = Pick<typeof screen, "getByRole">;

export async function chooseSelectOption(
  scope: SelectScope,
  label: string | RegExp,
  optionName: string | RegExp
) {
  await act(async () => {
    fireEvent.click(scope.getByRole("button", { name: label }));
  });
  await act(async () => {
    fireEvent.click(await screen.findByRole("option", { name: optionName }));
  });
}

export const renderDisplaySection = (
  options: {
    appSettings?: Partial<AppSettings>;
    reduceTransparency?: boolean;
    onUpdateAppSettings?: ComponentProps<typeof SettingsView>["onUpdateAppSettings"];
    onToggleTransparency?: ComponentProps<typeof SettingsView>["onToggleTransparency"];
  } = {}
) => {
  cleanup();
  const onUpdateAppSettings = options.onUpdateAppSettings ?? vi.fn().mockResolvedValue(undefined);
  const onToggleTransparency = options.onToggleTransparency ?? vi.fn();
  const props: ComponentProps<typeof SettingsView> = {
    reduceTransparency: options.reduceTransparency ?? false,
    onToggleTransparency,
    appSettings: { ...baseSettings, ...options.appSettings },
    openAppIconById: {},
    onUpdateAppSettings,
    workspaceGroups: [],
    groupedWorkspaces: [],
    ungroupedLabel: "Ungrouped",
    onClose: vi.fn(),
    onMoveWorkspace: vi.fn(),
    onDeleteWorkspace: vi.fn(),
    onCreateWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onRenameWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onMoveWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onDeleteWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onAssignWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onRunDoctor: vi.fn().mockResolvedValue(createDoctorResult()),
    onUpdateWorkspaceCodexBin: vi.fn().mockResolvedValue(undefined),
    onUpdateWorkspaceSettings: vi.fn().mockResolvedValue(undefined),
    scaleShortcutTitle: "Scale shortcut",
    scaleShortcutText: "Use Command +/-",
    onTestNotificationSound: vi.fn(),
    onTestSystemNotification: vi.fn(),
  };

  return renderSettled(<SettingsView {...props} />).then(() => {
    fireEvent.click(screen.getByRole("button", { name: "Display & Sound" }));
    return screen
      .findByLabelText("Theme", undefined, { timeout: 5_000 })
      .then(() => ({ onUpdateAppSettings, onToggleTransparency }));
  });
};

export const renderFeaturesSection = (
  options: {
    appSettings?: Partial<AppSettings>;
    onUpdateAppSettings?: ComponentProps<typeof SettingsView>["onUpdateAppSettings"];
  } = {}
) => {
  cleanup();
  const onUpdateAppSettings = options.onUpdateAppSettings ?? vi.fn().mockResolvedValue(undefined);
  const props: ComponentProps<typeof SettingsView> = {
    reduceTransparency: false,
    onToggleTransparency: vi.fn(),
    appSettings: { ...baseSettings, ...options.appSettings },
    openAppIconById: {},
    onUpdateAppSettings,
    workspaceGroups: [],
    groupedWorkspaces: [],
    ungroupedLabel: "Ungrouped",
    onClose: vi.fn(),
    onMoveWorkspace: vi.fn(),
    onDeleteWorkspace: vi.fn(),
    onCreateWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onRenameWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onMoveWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onDeleteWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onAssignWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onRunDoctor: vi.fn().mockResolvedValue(createDoctorResult()),
    onUpdateWorkspaceCodexBin: vi.fn().mockResolvedValue(undefined),
    onUpdateWorkspaceSettings: vi.fn().mockResolvedValue(undefined),
    scaleShortcutTitle: "Scale shortcut",
    scaleShortcutText: "Use Command +/-",
    onTestNotificationSound: vi.fn(),
    onTestSystemNotification: vi.fn(),
    initialSection: "features",
  };

  return renderSettled(<SettingsView {...props} />).then(() =>
    screen.findByRole("button", { name: "Personality" }, { timeout: 5_000 }).then(() => ({
      onUpdateAppSettings,
    }))
  );
};

export const renderComposerSection = (
  options: {
    appSettings?: Partial<AppSettings>;
    onUpdateAppSettings?: ComponentProps<typeof SettingsView>["onUpdateAppSettings"];
  } = {}
) => {
  cleanup();
  const onUpdateAppSettings = options.onUpdateAppSettings ?? vi.fn().mockResolvedValue(undefined);
  const props: ComponentProps<typeof SettingsView> = {
    reduceTransparency: false,
    onToggleTransparency: vi.fn(),
    appSettings: { ...baseSettings, ...options.appSettings },
    openAppIconById: {},
    onUpdateAppSettings,
    workspaceGroups: [],
    groupedWorkspaces: [],
    ungroupedLabel: "Ungrouped",
    onClose: vi.fn(),
    onMoveWorkspace: vi.fn(),
    onDeleteWorkspace: vi.fn(),
    onCreateWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onRenameWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onMoveWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onDeleteWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onAssignWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onRunDoctor: vi.fn().mockResolvedValue(createDoctorResult()),
    onUpdateWorkspaceCodexBin: vi.fn().mockResolvedValue(undefined),
    onUpdateWorkspaceSettings: vi.fn().mockResolvedValue(undefined),
    scaleShortcutTitle: "Scale shortcut",
    scaleShortcutText: "Use Command +/-",
    onTestNotificationSound: vi.fn(),
    onTestSystemNotification: vi.fn(),
    initialSection: "composer",
  };

  return renderSettled(<SettingsView {...props} />).then(() =>
    screen.findByRole("button", { name: "Preset" }, { timeout: 5_000 }).then(() => ({
      onUpdateAppSettings,
    }))
  );
};

export const renderServerSection = (
  options: {
    appSettings?: Partial<AppSettings>;
    initialSection?: ComponentProps<typeof SettingsView>["initialSection"];
  } = {}
) => {
  cleanup();
  const props: ComponentProps<typeof SettingsView> = {
    reduceTransparency: false,
    onToggleTransparency: vi.fn(),
    appSettings: { ...baseSettings, ...options.appSettings },
    openAppIconById: {},
    onUpdateAppSettings: vi.fn().mockResolvedValue(undefined),
    workspaceGroups: [],
    groupedWorkspaces: [],
    ungroupedLabel: "Ungrouped",
    onClose: vi.fn(),
    onMoveWorkspace: vi.fn(),
    onDeleteWorkspace: vi.fn(),
    onCreateWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onRenameWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onMoveWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onDeleteWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onAssignWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onRunDoctor: vi.fn().mockResolvedValue(createDoctorResult()),
    onUpdateWorkspaceCodexBin: vi.fn().mockResolvedValue(undefined),
    onUpdateWorkspaceSettings: vi.fn().mockResolvedValue(undefined),
    scaleShortcutTitle: "Scale shortcut",
    scaleShortcutText: "Use Command +/-",
    onTestNotificationSound: vi.fn(),
    onTestSystemNotification: vi.fn(),
    initialSection: options.initialSection ?? "server",
  };

  return renderSettled(<SettingsView {...props} />).then(() =>
    screen
      .findByText(
        "Remote backend",
        {
          selector: '[data-settings-field-group-title="true"]',
        },
        { timeout: 5_000 }
      )
      .then(() => undefined)
  );
};

export const workspace = (
  overrides: Omit<Partial<WorkspaceInfo>, "settings"> &
    Pick<WorkspaceInfo, "id" | "name"> & {
      settings?: Partial<WorkspaceInfo["settings"]>;
    }
): WorkspaceInfo => ({
  id: overrides.id,
  name: overrides.name,
  path: overrides.path ?? `/tmp/${overrides.id}`,
  connected: overrides.connected ?? false,
  codex_bin: overrides.codex_bin ?? null,
  kind: overrides.kind ?? "main",
  parentId: overrides.parentId ?? null,
  worktree: overrides.worktree ?? null,
  settings: {
    sidebarCollapsed: false,
    sortOrder: null,
    groupId: null,
    gitRoot: null,
    codexHome: null,
    codexArgs: null,
    launchScript: null,
    launchScripts: null,
    worktreeSetupScript: null,
    ...overrides.settings,
  },
});

export const renderEnvironmentsSection = (
  options: {
    groupedWorkspaces?: ComponentProps<typeof SettingsView>["groupedWorkspaces"];
    onUpdateWorkspaceSettings?: ComponentProps<typeof SettingsView>["onUpdateWorkspaceSettings"];
  } = {}
) => {
  cleanup();
  const onUpdateWorkspaceSettings =
    options.onUpdateWorkspaceSettings ?? vi.fn().mockResolvedValue(undefined);

  const props: ComponentProps<typeof SettingsView> = {
    reduceTransparency: false,
    onToggleTransparency: vi.fn(),
    appSettings: baseSettings,
    openAppIconById: {},
    onUpdateAppSettings: vi.fn().mockResolvedValue(undefined),
    workspaceGroups: [],
    groupedWorkspaces: options.groupedWorkspaces ?? [
      {
        id: null,
        name: "Ungrouped",
        workspaces: [
          workspace({
            id: "w1",
            name: "Project One",
            settings: {
              sidebarCollapsed: false,
              worktreeSetupScript: "echo one",
            },
          }),
        ],
      },
    ],
    ungroupedLabel: "Ungrouped",
    onClose: vi.fn(),
    onMoveWorkspace: vi.fn(),
    onDeleteWorkspace: vi.fn(),
    onCreateWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onRenameWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onMoveWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onDeleteWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onAssignWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onRunDoctor: vi.fn().mockResolvedValue(createDoctorResult()),
    onUpdateWorkspaceCodexBin: vi.fn().mockResolvedValue(undefined),
    onUpdateWorkspaceSettings,
    scaleShortcutTitle: "Scale shortcut",
    scaleShortcutText: "Use Command +/-",
    onTestNotificationSound: vi.fn(),
    onTestSystemNotification: vi.fn(),
    initialSection: "environments",
  };

  const hasProjects = (options.groupedWorkspaces ?? props.groupedWorkspaces).some(
    (group) => group.workspaces.length > 0
  );

  return renderSettled(<SettingsView {...props} />).then(() => {
    if (!hasProjects) {
      return screen.findByText("No projects yet.", undefined, { timeout: 5_000 }).then(() => ({
        onUpdateWorkspaceSettings,
      }));
    }

    return screen
      .findByPlaceholderText("pnpm install", undefined, {
        timeout: 5_000,
      })
      .then(() => ({ onUpdateWorkspaceSettings }));
  });
};

type SharedSettingsViewProps = ComponentProps<typeof SettingsView> & {
  dictationModelStatus?: unknown;
  onDownloadDictationModel?: () => void;
  onCancelDictationDownload?: () => void;
  onRemoveDictationModel?: () => void;
};

export function SharedSettingsView({
  dictationModelStatus: _dictationModelStatus,
  onDownloadDictationModel: _onDownloadDictationModel,
  onCancelDictationDownload: _onCancelDictationDownload,
  onRemoveDictationModel: _onRemoveDictationModel,
  ...props
}: SharedSettingsViewProps) {
  return <SettingsView {...props} />;
}
