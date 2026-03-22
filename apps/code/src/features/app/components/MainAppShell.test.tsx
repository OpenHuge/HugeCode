import type { ReactNode } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppSettings } from "../../../types";
import { createDefaultRemoteServerProfile } from "../../../application/runtime/facades/runtimeRemoteServerProfilesFacade";
import type { GitHubPanelDataProps } from "../../git/components/GitHubPanelData";
import type { AppLayoutProps } from "./AppLayout";
import type { AppModalsProps } from "./AppModals";

function createDeferredModule<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function createAppLayoutProps(): AppLayoutProps {
  return {
    isPhone: false,
    showHome: false,
    showGitDetail: false,
    activeTab: "missions",
    activeThreadId: null,
    centerMode: "chat",
    preloadGitDiffs: false,
    splitChatDiffView: false,
    hasActivePlan: false,
    sidebarCollapsed: false,
    onExpandSidebar: vi.fn(),
    rightPanelCollapsed: false,
    onCollapseRightPanel: vi.fn(),
    onExpandRightPanel: vi.fn(),
    activeWorkspace: true,
    sidebarNode: <div>sidebar</div>,
    messagesNode: <div>messages</div>,
    composerNode: <div>composer</div>,
    approvalToastsNode: <div>approval</div>,
    updateToastNode: <div>update</div>,
    errorToastsNode: <div>errors</div>,
    homeNode: <div>home</div>,
    missionOverviewNode: <div>mission</div>,
    mainHeaderNode: <div>header</div>,
    desktopTopbarLeftNode: <div>topbar-left</div>,
    codexTopbarActionsNode: <div>topbar-actions</div>,
    tabBarNode: <div>tab-bar</div>,
    rightPanelInterruptNode: <div>interrupt</div>,
    rightPanelDetailsNode: <div>details</div>,
    hasRightPanelDetailContent: true,
    rightPanelGitNode: <div>right-panel-git</div>,
    rightPanelFilesNode: <div>right-panel-files</div>,
    rightPanelPromptsNode: <div>right-panel-prompts</div>,
    gitDiffPanelNode: <div>git-diff-panel</div>,
    gitDiffViewerNode: <div>git-diff-viewer</div>,
    planPanelNode: <div>plan-panel</div>,
    debugPanelNode: <div>debug-panel</div>,
    terminalDockNode: <div>terminal-dock</div>,
    compactEmptyCodexNode: <div>compact-codex</div>,
    compactEmptyGitNode: <div>compact-git</div>,
    compactGitBackNode: <div>compact-git-back</div>,
    onSidebarResizeStart: vi.fn(),
    onRightPanelResizeStart: vi.fn(),
    onPlanPanelResizeStart: vi.fn(),
  };
}

function createAppModalsProps(overrides?: Partial<AppModalsProps>): AppModalsProps {
  return {
    renamePrompt: null,
    onRenamePromptChange: vi.fn(),
    onRenamePromptCancel: vi.fn(),
    onRenamePromptConfirm: vi.fn(),
    worktreePrompt: null,
    onWorktreePromptNameChange: vi.fn(),
    onWorktreePromptChange: vi.fn(),
    onWorktreePromptCopyAgentsMdChange: vi.fn(),
    onWorktreeSetupScriptChange: vi.fn(),
    onWorktreePromptCancel: vi.fn(),
    onWorktreePromptConfirm: vi.fn(),
    clonePrompt: null,
    onClonePromptCopyNameChange: vi.fn(),
    onClonePromptChooseCopiesFolder: vi.fn(),
    onClonePromptUseSuggestedFolder: vi.fn(),
    onClonePromptClearCopiesFolder: vi.fn(),
    onClonePromptCancel: vi.fn(),
    onClonePromptConfirm: vi.fn(),
    branchSwitcher: null,
    workspaces: [],
    activeWorkspace: null,
    branchSwitcherWorkspace: null,
    currentBranch: null,
    onBranchSwitcherSubmit: vi.fn(),
    onBranchSwitcherCancel: vi.fn(),
    settingsOpen: false,
    settingsSection: null,
    onCloseSettings: vi.fn(),
    settingsProps: {
      workspaceGroups: [],
      ungroupedLabel: "Ungrouped",
      groupedWorkspaces: [],
      onMoveWorkspace: vi.fn(),
      onDeleteWorkspace: vi.fn(),
      onRenameWorkspace: vi.fn(),
      onCreateWorkspaceGroup: vi.fn(),
      onRenameWorkspaceGroup: vi.fn(),
      onMoveWorkspaceGroup: vi.fn(),
      onDeleteWorkspaceGroup: vi.fn(),
      onAssignWorkspaceGroup: vi.fn(),
      reduceTransparency: false,
      onToggleTransparency: vi.fn(),
      appSettings: createAppSettings(),
      openAppIconById: {},
      onUpdateAppSettings: vi.fn(),
      onRunDoctor: vi.fn(),
      onRunCodexUpdate: vi.fn(),
      onUpdateWorkspaceCodexBin: vi.fn(),
      onUpdateWorkspaceSettings: vi.fn(),
      scaleShortcutTitle: "Scale shortcut",
      scaleShortcutText: "Use Command +/-",
      onTestNotificationSound: vi.fn(),
      onTestSystemNotification: vi.fn(),
    },
    ...overrides,
  };
}

function createAppSettings(): AppSettings {
  return {
    codexBin: null,
    codexArgs: null,
    backendMode: "local",
    remoteBackendProfiles: [createDefaultRemoteServerProfile()],
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
    lastComposerExecutionMode: null,
    uiScale: 1,
    theme: "system",
    usageShowRemaining: false,
    showMessageFilePath: true,
    showInternalRuntimeDiagnostics: false,
    threadTitleAutogenerationEnabled: true,
    uiFontFamily: "system-ui",
    codeFontFamily: "ui-monospace",
    codeFontSize: 14,
    notificationSoundsEnabled: true,
    systemNotificationsEnabled: true,
    splitChatDiffView: false,
    preloadGitDiffs: true,
    gitDiffIgnoreWhitespaceChanges: false,
    commitMessagePrompt: "prompt",
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
    openAppTargets: [],
    selectedOpenAppId: "default-open-app",
    lastActiveWorkspaceId: null,
  };
}

function createGitHubPanelDataProps(): GitHubPanelDataProps {
  return {
    activeWorkspace: null,
    gitPanelMode: "diff",
    shouldLoadDiffs: false,
    diffSource: "local",
    selectedPullRequestNumber: null,
    onIssuesChange: vi.fn(),
    onPullRequestsChange: vi.fn(),
    onPullRequestDiffsChange: vi.fn(),
    onPullRequestCommentsChange: vi.fn(),
  };
}

function createShellProps({
  appModalsProps,
  showMobileSetupWizard = false,
}: {
  appModalsProps?: Partial<AppModalsProps>;
  showMobileSetupWizard?: boolean;
} = {}) {
  return {
    appClassName: "app-shell",
    appStyle: {},
    shouldLoadGitHubPanelData: false,
    gitHubPanelDataProps: createGitHubPanelDataProps(),
    appLayoutProps: createAppLayoutProps(),
    appModalsProps: createAppModalsProps(appModalsProps),
    showMobileSetupWizard,
    mobileSetupWizardProps: {
      provider: "tcp" as const,
      remoteHostDraft: "",
      orbitWsUrlDraft: "",
      remoteTokenDraft: "",
      busy: false,
      checking: false,
      statusMessage: null,
      statusError: false,
      canSaveValidatedConnection: false,
      onProviderChange: vi.fn(),
      onRemoteHostChange: vi.fn(),
      onOrbitWsUrlChange: vi.fn(),
      onRemoteTokenChange: vi.fn(),
      onConnectTest: vi.fn(),
      onSaveConnection: vi.fn(),
      onContinueLimitedMode: vi.fn(),
    },
  };
}

describe("MainAppShell", () => {
  afterEach(() => {
    cleanup();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("does not require the app modals chunk when no modal is open", async () => {
    const appModalsModule = createDeferredModule<{
      AppModals: (props: { children?: ReactNode }) => ReactNode;
    }>();

    vi.doMock("./AppLayout", () => ({
      AppLayout: () => <div data-testid="app-layout" />,
    }));
    vi.doMock("./AppModals", () => appModalsModule.promise);
    vi.doMock("../../mobile/components/MobileServerSetupWizard", () => ({
      MobileServerSetupWizard: () => <div data-testid="mobile-setup" />,
    }));

    const { MainAppShell } = await import("./MainAppShell");

    render(<MainAppShell {...createShellProps()} />);

    expect(screen.getByTestId("app-layout")).toBeTruthy();
    expect(screen.queryByTestId("app-modals")).toBeNull();
  });

  it("loads the app modals chunk when a modal is open", async () => {
    const appModalsModule = createDeferredModule<{
      AppModals: () => ReactNode;
    }>();

    vi.doMock("./AppLayout", () => ({
      AppLayout: () => <div data-testid="app-layout" />,
    }));
    vi.doMock("./AppModals", () => appModalsModule.promise);
    vi.doMock("../../mobile/components/MobileServerSetupWizard", () => ({
      MobileServerSetupWizard: () => <div data-testid="mobile-setup" />,
    }));

    const { MainAppShell } = await import("./MainAppShell");

    render(<MainAppShell {...createShellProps({ appModalsProps: { settingsOpen: true } })} />);
    expect(screen.getByTestId("app-layout")).toBeTruthy();
    expect(screen.queryByTestId("app-modals")).toBeNull();

    await act(async () => {
      appModalsModule.resolve({
        AppModals: () => <div data-testid="app-modals" />,
      });
      await Promise.resolve();
    });

    expect(await screen.findByTestId("app-modals")).toBeTruthy();
  });

  it("does not require the mobile setup wizard chunk when it is hidden", async () => {
    const mobileSetupModule = createDeferredModule<{
      MobileServerSetupWizard: () => ReactNode;
    }>();

    vi.doMock("./AppLayout", () => ({
      AppLayout: () => <div data-testid="app-layout" />,
    }));
    vi.doMock("./AppModals", () => ({
      AppModals: () => <div data-testid="app-modals" />,
    }));
    vi.doMock("../../mobile/components/MobileServerSetupWizard", () => mobileSetupModule.promise);

    const { MainAppShell } = await import("./MainAppShell");

    render(<MainAppShell {...createShellProps()} />);

    expect(screen.getByTestId("app-layout")).toBeTruthy();
    expect(screen.queryByTestId("mobile-setup")).toBeNull();
  });

  it("loads the mobile setup wizard chunk when it is shown", async () => {
    const mobileSetupModule = createDeferredModule<{
      MobileServerSetupWizard: () => ReactNode;
    }>();

    vi.doMock("./AppLayout", () => ({
      AppLayout: () => <div data-testid="app-layout" />,
    }));
    vi.doMock("./AppModals", () => ({
      AppModals: () => <div data-testid="app-modals" />,
    }));
    vi.doMock("../../mobile/components/MobileServerSetupWizard", () => mobileSetupModule.promise);

    const { MainAppShell } = await import("./MainAppShell");

    render(<MainAppShell {...createShellProps({ showMobileSetupWizard: true })} />);

    expect(screen.getByTestId("app-layout")).toBeTruthy();
    expect(screen.queryByTestId("mobile-setup")).toBeNull();

    await act(async () => {
      mobileSetupModule.resolve({
        MobileServerSetupWizard: () => <div data-testid="mobile-setup" />,
      });
      await Promise.resolve();
    });

    expect(await screen.findByTestId("mobile-setup")).toBeTruthy();
  });
});
