import type { SettingsShellFraming } from "../settings-shell/settingsShellTypes";
import type { WorkspaceClientBindings } from "../workspace/bindings";
import type { SharedWorkspaceRouteSelection } from "./workspaceNavigation";

export type MissionControlSnapshot = Awaited<
  ReturnType<WorkspaceClientBindings["runtime"]["missionControl"]["readMissionControlSnapshot"]>
>;

export const desktopSettingsShellFraming: SettingsShellFraming = {
  kickerLabel: "Preferences",
  contextLabel: "Desktop app",
  title: "Settings",
  subtitle: "Appearance, projects, runtime, and Codex defaults for this app.",
};

export function createDefaultMissionControlSnapshot() {
  return {
    source: "runtime_snapshot_v1",
    generatedAt: 0,
    workspaces: [
      {
        id: "workspace-1",
        name: "Alpha",
        rootPath: "/alpha",
        connected: true,
        defaultProfileId: null,
      },
      {
        id: "workspace-2",
        name: "Beta",
        rootPath: "/beta",
        connected: false,
        defaultProfileId: null,
      },
    ],
    tasks: [
      {
        id: "task-1",
        workspaceId: "workspace-1",
        title: "Launch",
        objective: null,
        origin: {
          kind: "run",
          threadId: null,
          runId: "run-1",
          requestId: null,
        },
        taskSource: null,
        mode: null,
        modeSource: "missing",
        status: "running",
        createdAt: 0,
        updatedAt: 0,
        currentRunId: "run-1",
        latestRunId: "run-1",
        latestRunState: "running",
      },
    ],
    runs: [
      {
        id: "run-1",
        workspaceId: "workspace-1",
        taskId: "task-1",
        state: "running",
        title: "Launch",
        summary: null,
        taskSource: null,
        startedAt: 0,
        finishedAt: null,
        updatedAt: 0,
        currentStepIndex: null,
        placement: {
          resolvedBackendId: "backend-1",
          requestedBackendIds: [],
          resolutionSource: "explicit_preference",
          lifecycleState: "confirmed",
          readiness: "ready",
          healthSummary: "placement_ready",
          attentionReasons: [],
          summary: "Ready",
          rationale: "Healthy",
        },
        approval: {
          status: "pending_decision",
          approvalId: "approval-1",
          label: "Approval pending",
          summary: "Waiting for approval.",
        },
        checkpoint: {
          state: "ready",
          lifecycleState: "active",
          checkpointId: "checkpoint-1",
          traceId: "trace-1",
          recovered: false,
          updatedAt: 0,
          resumeReady: true,
          summary: "Ready to resume",
        },
      },
    ],
    reviewPacks: [
      {
        id: "review-1",
        runId: "run-1",
        taskId: "task-1",
        workspaceId: "workspace-1",
        summary: "Ready for review",
        reviewStatus: "ready",
        evidenceState: "complete",
        validationOutcome: "passed",
        warningCount: 0,
        warnings: [],
        validations: [],
        artifacts: [],
        checksPerformed: [],
        recommendedNextAction: null,
        createdAt: 0,
      },
    ],
  } as unknown as MissionControlSnapshot;
}

export function createBindings(options?: {
  workspaceCatalogError?: string;
  missionControlError?: string;
  readMissionControlSnapshot?: () => Promise<MissionControlSnapshot>;
  hostPlatform?: WorkspaceClientBindings["host"]["platform"];
  readStartupStatus?: WorkspaceClientBindings["host"]["shell"]["readStartupStatus"];
  initialSelection?: SharedWorkspaceRouteSelection;
  listWorkspaces?: WorkspaceClientBindings["runtime"]["workspaceCatalog"]["listWorkspaces"];
}): WorkspaceClientBindings {
  const listeners = new Set<() => void>();
  let selection: SharedWorkspaceRouteSelection = options?.initialSelection ?? { kind: "home" };

  return {
    navigation: {
      readRouteSelection: () => selection,
      subscribeRouteSelection: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      navigateToWorkspace: (workspaceId) => {
        selection = { kind: "workspace", workspaceId };
        listeners.forEach((listener) => listener());
      },
      navigateHome: () => {
        selection = { kind: "home" };
        listeners.forEach((listener) => listener());
      },
      navigateToSection: (section) => {
        selection = { kind: section };
        listeners.forEach((listener) => listener());
      },
      getAccountCenterHref: () => "/account",
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
        importCodexAuthJson: async () => ({
          accountId: null,
          displayName: null,
          email: null,
          imported: false,
          updated: false,
          sourceLabel: null,
          formats: [],
          message: null,
        }),
        runLogin: async () => ({ authUrl: "", immediateSuccess: false }),
        getAccountInfo: async () => null,
        getProvidersCatalog: async () => [],
      },
      models: {
        getModelList: async () => [],
        getConfigModel: async () => null,
      },
      workspaceCatalog: {
        listWorkspaces: async () => {
          if (options?.listWorkspaces) {
            return options.listWorkspaces();
          }
          if (options?.workspaceCatalogError) {
            throw new Error(options.workspaceCatalogError);
          }
          return [
            { id: "workspace-1", name: "Alpha", connected: true },
            { id: "workspace-2", name: "Beta", connected: false },
          ];
        },
      },
      missionControl: {
        readMissionControlSnapshot: async () => {
          if (options?.readMissionControlSnapshot) {
            return options.readMissionControlSnapshot();
          }
          if (options?.missionControlError) {
            throw new Error(options.missionControlError);
          }
          return createDefaultMissionControlSnapshot();
        },
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
      subAgents: {
        spawn: async () => {
          throw new Error("not implemented");
        },
        send: async () => {
          throw new Error("not implemented");
        },
        wait: async () => {
          throw new Error("not implemented");
        },
        status: async () => {
          throw new Error("not implemented");
        },
        interrupt: async () => {
          throw new Error("not implemented");
        },
        close: async () => {
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
      platform: options?.hostPlatform ?? "web",
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
        platformHint: options?.hostPlatform ?? "web",
        readStartupStatus: options?.readStartupStatus,
      },
    },
    platformUi: {
      WorkspaceRuntimeShell: function RuntimeShell() {
        return <div>Runtime shell</div>;
      },
      WorkspaceApp: function WorkspaceSurface() {
        return <div>Workspace surface</div>;
      },
      renderWorkspaceHost: (children) => children,
      settingsShellFraming: desktopSettingsShellFraming,
    },
  };
}
