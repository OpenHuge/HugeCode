import { useCallback } from "react";
import type { AppSettings, DebugEntry, WorkspaceInfo, WorkspaceSettings } from "../../../types";
import { writeSafeLocalStorageItem } from "../../../utils/safeLocalStorage";
import { useBranchSwitcher } from "../../git/hooks/useBranchSwitcher";
import { useBranchSwitcherShortcut } from "../../git/hooks/useBranchSwitcherShortcut";
import type { AppTab } from "../../shell/types/shellRoute";
import { useTerminalController } from "../../terminal/hooks/useTerminalController";
import { useThreads } from "../../threads/hooks/useThreads";
import { useClonePrompt } from "../../workspaces/hooks/useClonePrompt";
import { useRenameWorktreePrompt } from "../../workspaces/hooks/useRenameWorktreePrompt";
import { useWorkspaceSelection } from "../../workspaces/hooks/useWorkspaceSelection";
import { useWorktreePrompt } from "../../workspaces/hooks/useWorktreePrompt";
import { OPEN_APP_STORAGE_KEY } from "../constants";
import { useCloneProjectContext } from "../hooks/useCloneProjectContext";
import { useMainAppShellBootstrap } from "../hooks/useMainAppShellBootstrap";
import { useMainAppTerminalControls } from "../hooks/useMainAppTerminalControls";
import { useOpenAppIcons } from "../hooks/useOpenAppIcons";
import { useWorkspaceLaunchScript } from "../hooks/useWorkspaceLaunchScript";
import { useWorkspaceLaunchScripts } from "../hooks/useWorkspaceLaunchScripts";
import { useWorktreeSetupScript } from "../hooks/useWorktreeSetupScript";

type MainAppBootstrapState = ReturnType<typeof useMainAppShellBootstrap>;
type ThreadsState = ReturnType<typeof useThreads>;

type UseDesktopWorkspaceProjectDomainOptions = {
  workspaceState: MainAppBootstrapState["workspaceState"];
  layoutState: MainAppBootstrapState["layoutState"];
  activeTab: AppTab;
  setActiveTab: MainAppBootstrapState["setActiveTab"];
  gitBranchState: MainAppBootstrapState["gitBranchState"];
  debugState: MainAppBootstrapState["debugState"];
  appSettings: AppSettings;
  queueSaveSettings: MainAppBootstrapState["queueSaveSettings"];
  setAppSettings: MainAppBootstrapState["setAppSettings"];
  setCenterMode: (mode: "chat" | "diff") => void;
  setSelectedDiffPath: (path: string | null) => void;
  activeThreadId: ThreadsState["activeThreadId"];
  resetWorkspaceThreads: ThreadsState["resetWorkspaceThreads"];
  listThreadsForWorkspace: ThreadsState["listThreadsForWorkspace"];
  refreshThread: ThreadsState["refreshThread"];
};

type WorkspaceSettingsUpdate = (
  workspaceId: string,
  settings: Partial<WorkspaceSettings>
) => Promise<WorkspaceInfo>;

function addProjectDomainDebugEntry(
  addDebugEntry: (entry: DebugEntry) => void,
  label: "worktree/add error" | "clone/add error",
  payload: string
) {
  addDebugEntry({
    id: `${Date.now()}-client-${label.replace("/", "-").replaceAll(" ", "-")}`,
    timestamp: Date.now(),
    source: "error",
    label,
    payload,
  });
}

export function useDesktopWorkspaceProjectDomain({
  workspaceState,
  layoutState,
  activeTab,
  setActiveTab,
  gitBranchState,
  debugState,
  appSettings,
  queueSaveSettings,
  setAppSettings,
  setCenterMode,
  setSelectedDiffPath,
  activeThreadId,
  resetWorkspaceThreads,
  listThreadsForWorkspace,
  refreshThread,
}: UseDesktopWorkspaceProjectDomainOptions) {
  const {
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    setActiveWorkspaceId,
    addCloneAgent,
    addWorktreeAgent,
    connectWorkspace,
    updateWorkspaceSettings,
    renameWorktree,
    renameWorktreeUpstream,
  } = workspaceState;
  const { checkoutBranchInWorkspace, alertError } = gitBranchState;

  const {
    renamePrompt: renameWorktreePrompt,
    notice: renameWorktreeNotice,
    upstreamPrompt: renameWorktreeUpstreamPrompt,
    confirmUpstream: confirmRenameWorktreeUpstream,
    openRenamePrompt: openRenameWorktreePrompt,
    handleRenameChange: handleRenameWorktreeChange,
    handleRenameCancel: handleRenameWorktreeCancel,
    handleRenameConfirm: handleRenameWorktreeConfirm,
  } = useRenameWorktreePrompt({
    workspaces,
    activeWorkspaceId,
    renameWorktree,
    renameWorktreeUpstream,
    onRenameSuccess: (workspace) => {
      resetWorkspaceThreads(workspace.id);
      void listThreadsForWorkspace(workspace);
      if (activeThreadId && activeWorkspaceId === workspace.id) {
        void refreshThread(workspace.id, activeThreadId);
      }
    },
  });

  const {
    terminalTabs,
    activeTerminalId,
    onSelectTerminal,
    onNewTerminal,
    onCloseTerminal,
    terminalState,
    ensureTerminalWithTitle,
    restartTerminalSession,
  } = useTerminalController({
    activeWorkspaceId,
    activeWorkspace,
    terminalOpen: layoutState.terminalOpen,
    onCloseTerminalPanel: layoutState.closeTerminal,
    onDebug: debugState.addDebugEntry,
  });

  const ensureLaunchTerminal = useCallback(
    (workspaceId: string) => ensureTerminalWithTitle(workspaceId, "launch", "Launch"),
    [ensureTerminalWithTitle]
  );

  const launchScriptState = useWorkspaceLaunchScript({
    activeWorkspace,
    updateWorkspaceSettings: updateWorkspaceSettings as WorkspaceSettingsUpdate,
    openTerminal: layoutState.openTerminal,
    ensureLaunchTerminal,
    restartLaunchSession: restartTerminalSession,
    terminalState,
    activeTerminalId,
  });

  const launchScriptsState = useWorkspaceLaunchScripts({
    activeWorkspace,
    updateWorkspaceSettings: updateWorkspaceSettings as WorkspaceSettingsUpdate,
    openTerminal: layoutState.openTerminal,
    ensureLaunchTerminal: (workspaceId, entry, title) => {
      const label = entry.label?.trim() || entry.icon;
      return ensureTerminalWithTitle(workspaceId, `launch:${entry.id}`, title || `Launch ${label}`);
    },
    restartLaunchSession: restartTerminalSession,
    terminalState,
    activeTerminalId,
  });

  const worktreeSetupScriptState = useWorktreeSetupScript({
    ensureTerminalWithTitle,
    restartTerminalSession,
    openTerminal: layoutState.openTerminal,
    onDebug: debugState.addDebugEntry,
  });

  const {
    canControlActiveTerminal,
    handleClearActiveTerminal,
    handleRestartActiveTerminal,
    handleInterruptActiveTerminal,
  } = useMainAppTerminalControls({
    activeWorkspaceId,
    activeTerminalId,
    terminalHasSession: Boolean(terminalState?.hasSession),
    terminalReadyKey: terminalState?.readyKey ?? null,
    restartTerminalSession,
    addDebugEntry: debugState.addDebugEntry,
  });

  const handleWorktreeCreated = useCallback(
    async (worktree: WorkspaceInfo, _parentWorkspace?: WorkspaceInfo) => {
      await worktreeSetupScriptState.maybeRunWorktreeSetupScript(worktree);
    },
    [worktreeSetupScriptState]
  );

  const { exitDiffView, selectWorkspace, selectHome } = useWorkspaceSelection({
    workspaces,
    isCompact: layoutState.isCompact,
    activeTab,
    activeWorkspaceId,
    setActiveTab,
    setActiveWorkspaceId,
    collapseRightPanel: layoutState.collapseRightPanel,
    updateWorkspaceSettings: updateWorkspaceSettings as WorkspaceSettingsUpdate,
    setCenterMode,
    setSelectedDiffPath,
  });

  const worktreePromptState = useWorktreePrompt({
    addWorktreeAgent,
    updateWorkspaceSettings: updateWorkspaceSettings as WorkspaceSettingsUpdate,
    connectWorkspace,
    onSelectWorkspace: selectWorkspace,
    onWorktreeCreated: handleWorktreeCreated,
    onCompactActivate: layoutState.isCompact ? () => setActiveTab("missions") : undefined,
    onError: (message) => {
      addProjectDomainDebugEntry(debugState.addDebugEntry, "worktree/add error", message);
    },
  });

  const {
    branchSwitcher,
    branchSwitcherWorkspace,
    openBranchSwitcher,
    closeBranchSwitcher,
    handleBranchSelection,
  } = useBranchSwitcher({
    activeWorkspace,
    workspaces,
    checkoutBranch: checkoutBranchInWorkspace,
    openWorktreePrompt: worktreePromptState.openPrompt,
    setActiveWorkspaceId,
    onError: alertError,
  });

  useBranchSwitcherShortcut({
    shortcut: appSettings.branchSwitcherShortcut,
    isEnabled: Boolean(activeWorkspace?.connected) && Boolean(branchSwitcherWorkspace),
    onTrigger: openBranchSwitcher,
  });

  const { resolveCloneProjectContext, persistProjectCopiesFolder } = useCloneProjectContext({
    appSettings,
    queueSaveSettings,
  });

  const handleSelectOpenAppId = useCallback(
    (id: string) => {
      writeSafeLocalStorageItem(OPEN_APP_STORAGE_KEY, id);
      setAppSettings((current) => {
        if (current.selectedOpenAppId === id) {
          return current;
        }
        const nextSettings = {
          ...current,
          selectedOpenAppId: id,
        };
        void queueSaveSettings(nextSettings);
        return nextSettings;
      });
    },
    [queueSaveSettings, setAppSettings]
  );

  const openAppIconById = useOpenAppIcons(appSettings.openAppTargets);

  const clonePromptState = useClonePrompt({
    addCloneAgent,
    connectWorkspace,
    onSelectWorkspace: selectWorkspace,
    resolveProjectContext: resolveCloneProjectContext,
    persistProjectCopiesFolder,
    onCompactActivate: layoutState.isCompact ? () => setActiveTab("missions") : undefined,
    onError: (message) => {
      addProjectDomainDebugEntry(debugState.addDebugEntry, "clone/add error", message);
    },
  });

  return {
    renameWorktreePrompt,
    renameWorktreeNotice,
    renameWorktreeUpstreamPrompt,
    confirmRenameWorktreeUpstream,
    openRenameWorktreePrompt,
    handleRenameWorktreeChange,
    handleRenameWorktreeCancel,
    handleRenameWorktreeConfirm,
    terminalTabs,
    activeTerminalId,
    onSelectTerminal,
    onNewTerminal,
    onCloseTerminal,
    terminalState,
    canControlActiveTerminal,
    handleClearActiveTerminal,
    handleRestartActiveTerminal,
    handleInterruptActiveTerminal,
    launchScriptState,
    launchScriptsState,
    exitDiffView,
    selectWorkspace,
    selectHome,
    worktreePromptState,
    branchSwitcher,
    branchSwitcherWorkspace,
    openBranchSwitcher,
    closeBranchSwitcher,
    handleBranchSelection,
    handleSelectOpenAppId,
    openAppIconById,
    clonePromptState,
  };
}
