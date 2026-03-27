import type { MutableRefObject } from "react";
import type { ComposerEditorSettings, ThreadListSortKey } from "../../../types";
import type { useCustomPrompts } from "../../prompts/hooks/useCustomPrompts";
import type { useSkills } from "../../skills/hooks/useSkills";
import type { useMainAppShellBootstrap } from "../hooks/useMainAppShellBootstrap";
import type { useThreadCodexControls } from "../hooks/useThreadCodexControls";
import type { useDesktopWorkspaceConversationDomain } from "./useDesktopWorkspaceConversationDomain";
import type { useDesktopWorkspaceMissionDomain } from "./useDesktopWorkspaceMissionDomain";
import type { useDesktopWorkspaceProjectDomain } from "./useDesktopWorkspaceProjectDomain";
import type { useDesktopWorkspaceThreadDomain } from "./useDesktopWorkspaceThreadDomain";

type MainAppBootstrapState = ReturnType<typeof useMainAppShellBootstrap>;

export type DesktopWorkspaceProjectContract = Pick<
  ReturnType<typeof useDesktopWorkspaceProjectDomain>,
  | "activeTerminalId"
  | "branchSwitcher"
  | "branchSwitcherWorkspace"
  | "canControlActiveTerminal"
  | "clonePromptState"
  | "closeBranchSwitcher"
  | "exitDiffView"
  | "handleBranchSelection"
  | "handleClearActiveTerminal"
  | "handleInterruptActiveTerminal"
  | "handleRestartActiveTerminal"
  | "handleSelectOpenAppId"
  | "launchScriptState"
  | "launchScriptsState"
  | "onCloseTerminal"
  | "onNewTerminal"
  | "onSelectTerminal"
  | "openAppIconById"
  | "openBranchSwitcher"
  | "selectHome"
  | "selectWorkspace"
  | "terminalState"
  | "terminalTabs"
  | "worktreePromptState"
>;

export type DesktopWorkspaceThreadContract = Pick<
  ReturnType<typeof useDesktopWorkspaceThreadDomain>,
  | "accountControls"
  | "activeThreadId"
  | "atlasControls"
  | "draftState"
  | "handleCopyThread"
  | "handleRefreshAllWorkspaceThreads"
  | "handleSetThreadListSortKey"
  | "renamePromptState"
  | "threadLiveConnectionState"
  | "threadsState"
  | "usageRefresh"
  | "visibleActiveItems"
>;

export type DesktopWorkspaceConversationContract = Pick<
  ReturnType<typeof useDesktopWorkspaceConversationDomain>,
  "conversationState" | "mainAppHandlers"
>;

export type DesktopWorkspaceMissionContract = Pick<
  ReturnType<typeof useDesktopWorkspaceMissionDomain>,
  | "gitCommitState"
  | "handleStartTaskFromGitHubIssue"
  | "handleStartTaskFromGitHubPullRequest"
  | "missionControlState"
>;

export type DesktopWorkspaceChromeBootstrapContract = Pick<
  MainAppBootstrapState,
  | "activeTab"
  | "appSettings"
  | "closeSettings"
  | "codexUpdate"
  | "debugState"
  | "dismissErrorToast"
  | "doctor"
  | "errorToasts"
  | "gitBranchState"
  | "gitHubPanelState"
  | "gitPanelState"
  | "gitRemoteUrl"
  | "handleConnectLocalRuntimePort"
  | "layoutState"
  | "mobileState"
  | "openSettings"
  | "queueSaveSettings"
  | "reduceTransparency"
  | "scaleShortcutText"
  | "scaleShortcutTitle"
  | "setActiveTab"
  | "setAppSettings"
  | "setReduceTransparency"
  | "settingsOpen"
  | "settingsSection"
  | "shouldReduceTransparency"
  | "sidebarToggleProps"
  | "updaterController"
  | "workspaceState"
  | "workspacesById"
>;

export type DesktopWorkspaceChromeShellContract = {
  threadCodexState: ReturnType<typeof useThreadCodexControls>;
  threadListSortKey: ThreadListSortKey;
  composerEditorExpanded: boolean;
  toggleComposerEditorExpanded: () => void;
  composerEditorSettings: ComposerEditorSettings;
  skills: ReturnType<typeof useSkills>["skills"];
  prompts: ReturnType<typeof useCustomPrompts>["prompts"];
  composerInputRef: MutableRefObject<HTMLTextAreaElement | null>;
  gitActions: {
    handleStageGitAll: () => void | Promise<void>;
    handleStageGitFile: (path: string) => void | Promise<void>;
    handleUnstageGitFile: (path: string) => void | Promise<void>;
    handleRevertGitFile: (path: string) => void | Promise<void>;
    handleRevertAllGitChanges: () => void | Promise<void>;
  };
  activeGitRoot: string | null;
  handleSetGitRoot: (root: string | null) => void;
  handlePickGitRoot: () => void | Promise<void>;
  handleApplyWorktreeChanges: () => void | Promise<void>;
  worktreeApplyLoading: boolean;
  worktreeApplyError: string | null;
  worktreeApplySuccess: boolean;
  gitRootScanDepth: number;
  gitRootScanLoading: boolean;
  gitRootScanError: string | null;
  gitRootScanHasScanned: boolean;
  gitRootCandidates: string[];
  setGitRootScanDepth: (depth: number) => void;
  scanGitRoots: () => void | Promise<void>;
};

export type DesktopWorkspaceChromeDomainContracts = {
  bootstrap: DesktopWorkspaceChromeBootstrapContract;
  domains: {
    project: DesktopWorkspaceProjectContract;
    thread: DesktopWorkspaceThreadContract;
    conversation: DesktopWorkspaceConversationContract;
    mission: DesktopWorkspaceMissionContract;
  };
  shell: DesktopWorkspaceChromeShellContract;
};
