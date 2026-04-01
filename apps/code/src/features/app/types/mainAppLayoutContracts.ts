import type { AtlasDetailLevel, AtlasLongTermMemoryDigest } from "../../atlas/utils/atlasContext";
import type { InvocationDescriptor } from "@ku0/code-runtime-host-contract";
import type { useAutoDriveController } from "../../autodrive/hooks/useAutoDriveController";
import type { useDebugLog } from "../../debug/hooks/useDebugLog";
import type { ReviewPackSelectionRequest } from "../../review/utils/reviewPackSurfaceModel";
import type { useThreads } from "../../threads/hooks/useThreads";
import type { AccountCenterState } from "../hooks/useAccountCenterState";
import type { useGitCommitController } from "../hooks/useGitCommitController";
import type { useGitHubPanelController } from "../hooks/useGitHubPanelController";
import type { useGitPanelController } from "../hooks/useGitPanelController";
import type { useLayoutController } from "../hooks/useLayoutController";
import type { useMainAppConversationState } from "../hooks/useMainAppConversationState";
import type { useMainAppHandlers } from "../hooks/useMainAppHandlers";
import type { useMainAppLayoutNodesBridge } from "../hooks/useMainAppLayoutNodesBridge";
import type { useThreadCodexControls } from "../hooks/useThreadCodexControls";
import type { useUpdaterController } from "../hooks/useUpdaterController";

type BridgeParams = Parameters<typeof useMainAppLayoutNodesBridge>[0];

export type MainAppConversationState = Pick<
  ReturnType<typeof useMainAppConversationState>,
  | "homeState"
  | "fileListingState"
  | "processingState"
  | "composerState"
  | "canInsertComposerText"
  | "handleInsertComposerText"
>;

export type MainAppTerminalControls = {
  terminalTabs: BridgeParams["terminalTabs"];
  activeTerminalId: BridgeParams["activeTerminalId"];
  onSelectTerminal: BridgeParams["onSelectTerminal"];
  onNewTerminal: BridgeParams["onNewTerminal"];
  onCloseTerminal: BridgeParams["onCloseTerminal"];
  terminalState: BridgeParams["terminalState"];
  canControlActiveTerminal: boolean;
  handleClearActiveTerminal: BridgeParams["onClearTerminal"];
  handleRestartActiveTerminal: BridgeParams["onRestartTerminal"];
  handleInterruptActiveTerminal: BridgeParams["onInterruptTerminal"];
};

export type MainAppReviewPackControllerReady =
  | ((openReviewPack: (request: ReviewPackSelectionRequest) => void) => void)
  | null;

export type MainAppLayoutShellParams = {
  mainAppHandlers: ReturnType<typeof useMainAppHandlers>;
  appSettings: BridgeParams["appSettings"];
  workspaceGroupsCount: BridgeParams["workspaceGroupsCount"];
  handleSetThreadListSortKey: BridgeParams["handleSetThreadListSortKey"];
  handleRefreshAllWorkspaceThreads: BridgeParams["handleRefreshAllWorkspaceThreads"];
  onOpenSettings: BridgeParams["onOpenSettings"];
  clearDraftState: BridgeParams["clearDraftState"];
  clearDraftStateIfDifferentWorkspace: BridgeParams["clearDraftStateIfDifferentWorkspace"];
  selectHome: BridgeParams["selectHome"];
  selectWorkspace: BridgeParams["selectWorkspace"];
  connectWorkspace: BridgeParams["connectWorkspace"];
  setActiveWorkspaceId: (workspaceId: string | null) => void;
  setActiveTab: BridgeParams["setActiveTab"];
  workspacesById: BridgeParams["workspacesById"];
  updateWorkspaceSettings: BridgeParams["updateWorkspaceSettings"];
  handleRenameThread: BridgeParams["handleRenameThread"];
  removeWorkspace: BridgeParams["removeWorkspace"];
  removeWorktree: BridgeParams["removeWorktree"];
  launchScriptState: BridgeParams["launchScriptState"];
  sidebarToggleProps: BridgeParams["sidebarToggleProps"];
  exitDiffView: BridgeParams["exitDiffView"];
  activeTab: BridgeParams["activeTab"];
  showPollingFetchStatus: boolean;
  pollingIntervalMs: number;
  workspaces: BridgeParams["workspaces"];
  groupedWorkspaces: BridgeParams["groupedWorkspaces"];
  hasLoadedWorkspaces: BridgeParams["hasLoadedWorkspaces"];
  workspaceLoadError: BridgeParams["workspaceLoadError"];
  deletingWorktreeIds: BridgeParams["deletingWorktreeIds"];
  newAgentDraftWorkspaceId: BridgeParams["newAgentDraftWorkspaceId"];
  startingDraftThreadWorkspaceId: BridgeParams["startingDraftThreadWorkspaceId"];
  threadListSortKey: BridgeParams["threadListSortKey"];
  activeWorkspaceId: BridgeParams["activeWorkspaceId"];
  openAppIconById: BridgeParams["openAppIconById"];
  activeWorkspace: BridgeParams["activeWorkspace"];
  onOpenBranchSwitcher: BridgeParams["onOpenBranchSwitcher"];
  handleBranchSelection: BridgeParams["onSelectBranchWorkflowSelection"];
  refreshGitStatus: BridgeParams["onRefreshGitStatus"];
  handleCopyThread: BridgeParams["onCopyThread"];
  launchScriptsState: BridgeParams["launchScriptsState"];
  activeAtlasDriverOrder: string[] | null;
  activeAtlasEnabled: boolean;
  activeAtlasDetailLevel: AtlasDetailLevel;
  activeAtlasLongTermMemoryDigest: AtlasLongTermMemoryDigest | null;
  onActiveAtlasDriverOrderChange: (order: string[]) => void;
  onActiveAtlasEnabledChange: (enabled: boolean) => void;
  onActiveAtlasDetailLevelChange: (detailLevel: AtlasDetailLevel) => void;
  fileStatus: BridgeParams["fileStatus"];
  gitRemoteUrl: BridgeParams["gitRemoteUrl"];
  gitRootCandidates: BridgeParams["gitRootCandidates"];
  gitRootScanDepth: BridgeParams["gitRootScanDepth"];
  gitRootScanLoading: BridgeParams["gitRootScanLoading"];
  gitRootScanError: BridgeParams["gitRootScanError"];
  gitRootScanHasScanned: BridgeParams["gitRootScanHasScanned"];
  setGitRootScanDepth: BridgeParams["onGitRootScanDepthChange"];
  scanGitRoots: BridgeParams["onScanGitRoots"];
  handlePickGitRoot: BridgeParams["onPickGitRoot"];
  handleStageGitAll: BridgeParams["onStageGitAll"];
  handleStageGitFile: BridgeParams["onStageGitFile"];
  handleUnstageGitFile: BridgeParams["onUnstageGitFile"];
  handleRevertGitFile: BridgeParams["onRevertGitFile"];
  handleRevertAllGitChanges: BridgeParams["onRevertAllGitChanges"];
};

export type MainAppConversationBridgeParams = {
  threadsState: ReturnType<typeof useThreads>;
  conversationState: MainAppConversationState;
  threadCodexState: ReturnType<typeof useThreadCodexControls>;
  autoDriveState: ReturnType<typeof useAutoDriveController>;
  skills: BridgeParams["skills"];
  prompts: BridgeParams["prompts"];
  slashInvocationItems?: InvocationDescriptor[];
  composerInputRef: BridgeParams["textareaRef"];
  composerEditorSettings: BridgeParams["composerEditorSettings"];
  composerEditorExpanded: BridgeParams["composerEditorExpanded"];
  toggleComposerEditorExpanded: BridgeParams["onToggleComposerEditorExpanded"];
};

export type MainAppGitReviewBridgeParams = {
  activeGitRoot: BridgeParams["activeGitRoot"];
  gitRemoteUrl: BridgeParams["gitRemoteUrl"];
  handleSetGitRoot: BridgeParams["handleSetGitRoot"];
  defaultRemoteExecutionBackendId: BridgeParams["appSettings"]["defaultRemoteExecutionBackendId"];
  worktreeApplyLoading: boolean;
  worktreeApplyError: string | null;
  worktreeApplySuccess: boolean;
  handleApplyWorktreeChanges: BridgeParams["handleApplyWorktreeChanges"];
  gitPanelState: ReturnType<typeof useGitPanelController>;
  gitHubPanelState: ReturnType<typeof useGitHubPanelController>;
  gitCommitState: ReturnType<typeof useGitCommitController>;
  onStartTaskFromGitHubIssue: BridgeParams["onStartTaskFromGitHubIssue"];
  getGitHubIssueFollowUpPreview: BridgeParams["getGitHubIssueFollowUpPreview"];
  onStartTaskFromGitHubIssueFollowUp: BridgeParams["onStartTaskFromGitHubIssueFollowUp"];
  onStartTaskFromGitHubPullRequest: BridgeParams["onStartTaskFromGitHubPullRequest"];
  getGitHubPullRequestFollowUpPreview: BridgeParams["getGitHubPullRequestFollowUpPreview"];
  onStartTaskFromGitHubPullRequestReviewFollowUp: BridgeParams["onStartTaskFromGitHubPullRequestReviewFollowUp"];
  getGitHubPullRequestReviewFollowUpPreview: BridgeParams["getGitHubPullRequestReviewFollowUpPreview"];
  onReviewPackControllerReady?: MainAppReviewPackControllerReady;
};

export type MainAppRuntimeBridgeParams = {
  activeAccount: BridgeParams["activeAccount"];
  handleSwitchAccount: BridgeParams["handleSwitchAccount"];
  handleSelectLoggedInCodexAccount: BridgeParams["handleSelectLoggedInCodexAccount"];
  handleCancelSwitchAccount: BridgeParams["handleCancelSwitchAccount"];
  accountSwitchError: BridgeParams["accountSwitchError"];
  accountCenter: AccountCenterState;
  onConnectLocalRuntimePort: NonNullable<BridgeParams["onConnectLocalRuntimePort"]>;
  accountSwitching: BridgeParams["accountSwitching"];
  onRefreshCurrentUsage: BridgeParams["onRefreshCurrentUsage"];
  onRefreshAllUsage: BridgeParams["onRefreshAllUsage"];
  canRefreshCurrentUsage: BridgeParams["canRefreshCurrentUsage"];
  canRefreshAllUsage: BridgeParams["canRefreshAllUsage"];
  currentUsageRefreshLoading: BridgeParams["currentUsageRefreshLoading"];
  allUsageRefreshLoading: BridgeParams["allUsageRefreshLoading"];
  handleSelectOpenAppId: BridgeParams["onSelectOpenAppId"];
  errorToasts: BridgeParams["errorToasts"];
  dismissErrorToast: BridgeParams["onDismissErrorToast"];
  debugState: ReturnType<typeof useDebugLog>;
  layoutState: ReturnType<typeof useLayoutController>;
  updaterController: ReturnType<typeof useUpdaterController>;
  terminalControls: MainAppTerminalControls;
};

export type UseMainAppLayoutNodesStateLayoutParams = Pick<
  MainAppLayoutShellParams,
  | "workspaceGroupsCount"
  | "sidebarToggleProps"
  | "activeTab"
  | "showPollingFetchStatus"
  | "pollingIntervalMs"
> &
  Pick<MainAppRuntimeBridgeParams, "layoutState" | "updaterController" | "terminalControls"> &
  Pick<MainAppGitReviewBridgeParams, "gitPanelState" | "gitHubPanelState" | "gitCommitState"> &
  Pick<MainAppConversationBridgeParams, "conversationState" | "composerEditorExpanded">;

export type UseMainAppLayoutNodesStateActionParams = Pick<
  MainAppLayoutShellParams,
  | "handleSetThreadListSortKey"
  | "handleRefreshAllWorkspaceThreads"
  | "onOpenSettings"
  | "clearDraftState"
  | "clearDraftStateIfDifferentWorkspace"
  | "selectHome"
  | "selectWorkspace"
  | "connectWorkspace"
  | "setActiveWorkspaceId"
  | "setActiveTab"
  | "updateWorkspaceSettings"
  | "handleRenameThread"
  | "removeWorkspace"
  | "removeWorktree"
  | "exitDiffView"
  | "refreshGitStatus"
  | "handleCopyThread"
  | "onActiveAtlasDriverOrderChange"
  | "onActiveAtlasEnabledChange"
  | "onActiveAtlasDetailLevelChange"
  | "setGitRootScanDepth"
  | "scanGitRoots"
  | "handlePickGitRoot"
  | "handleStageGitAll"
  | "handleStageGitFile"
  | "handleUnstageGitFile"
  | "handleRevertGitFile"
  | "handleRevertAllGitChanges"
> &
  Pick<
    MainAppRuntimeBridgeParams,
    | "handleSwitchAccount"
    | "handleSelectLoggedInCodexAccount"
    | "handleCancelSwitchAccount"
    | "onConnectLocalRuntimePort"
    | "onRefreshCurrentUsage"
    | "onRefreshAllUsage"
    | "handleSelectOpenAppId"
    | "dismissErrorToast"
  > &
  Pick<
    MainAppGitReviewBridgeParams,
    | "handleSetGitRoot"
    | "handleApplyWorktreeChanges"
    | "onStartTaskFromGitHubIssue"
    | "getGitHubIssueFollowUpPreview"
    | "onStartTaskFromGitHubIssueFollowUp"
    | "onStartTaskFromGitHubPullRequest"
    | "getGitHubPullRequestFollowUpPreview"
    | "onStartTaskFromGitHubPullRequestReviewFollowUp"
    | "getGitHubPullRequestReviewFollowUpPreview"
  > &
  Pick<MainAppConversationBridgeParams, "toggleComposerEditorExpanded">;

export type MainAppLayoutShellContextParams = Pick<
  MainAppLayoutShellParams,
  | "mainAppHandlers"
  | "appSettings"
  | "workspacesById"
  | "launchScriptState"
  | "workspaces"
  | "groupedWorkspaces"
  | "hasLoadedWorkspaces"
  | "workspaceLoadError"
  | "deletingWorktreeIds"
  | "newAgentDraftWorkspaceId"
  | "startingDraftThreadWorkspaceId"
  | "threadListSortKey"
  | "activeWorkspaceId"
  | "openAppIconById"
  | "activeWorkspace"
  | "onOpenBranchSwitcher"
  | "handleBranchSelection"
  | "launchScriptsState"
  | "activeAtlasDriverOrder"
  | "activeAtlasEnabled"
  | "activeAtlasDetailLevel"
  | "activeAtlasLongTermMemoryDigest"
  | "fileStatus"
  | "gitRemoteUrl"
  | "gitRootCandidates"
  | "gitRootScanDepth"
  | "gitRootScanLoading"
  | "gitRootScanError"
  | "gitRootScanHasScanned"
>;

export type MainAppConversationBridgeContextParams = Pick<
  MainAppConversationBridgeParams,
  | "threadsState"
  | "threadCodexState"
  | "autoDriveState"
  | "skills"
  | "prompts"
  | "slashInvocationItems"
  | "composerInputRef"
  | "composerEditorSettings"
>;

export type MainAppGitReviewBridgeContextParams = Pick<
  MainAppGitReviewBridgeParams,
  | "activeGitRoot"
  | "gitRemoteUrl"
  | "defaultRemoteExecutionBackendId"
  | "worktreeApplyLoading"
  | "worktreeApplyError"
  | "worktreeApplySuccess"
>;

export type MainAppRuntimeBridgeContextParams = Pick<
  MainAppRuntimeBridgeParams,
  | "activeAccount"
  | "accountSwitchError"
  | "accountCenter"
  | "accountSwitching"
  | "canRefreshCurrentUsage"
  | "canRefreshAllUsage"
  | "currentUsageRefreshLoading"
  | "allUsageRefreshLoading"
  | "errorToasts"
  | "debugState"
  | "layoutState"
>;

export type UseMainAppLayoutNodesStateContextParams = MainAppLayoutShellContextParams &
  MainAppConversationBridgeContextParams &
  MainAppGitReviewBridgeContextParams &
  MainAppRuntimeBridgeContextParams;

export type UseMainAppLayoutNodesStateParams = {
  shell: {
    state: Pick<
      UseMainAppLayoutNodesStateLayoutParams,
      | "workspaceGroupsCount"
      | "sidebarToggleProps"
      | "activeTab"
      | "showPollingFetchStatus"
      | "pollingIntervalMs"
    > &
      MainAppLayoutShellContextParams &
      Pick<MainAppConversationBridgeContextParams, "threadsState"> &
      Pick<
        MainAppGitReviewBridgeContextParams,
        "activeGitRoot" | "worktreeApplyLoading" | "worktreeApplyError" | "worktreeApplySuccess"
      > & {
        conversationState: MainAppConversationState;
        gitPanelState: ReturnType<typeof useGitPanelController>;
        gitHubPanelState: ReturnType<typeof useGitHubPanelController>;
        layoutState: ReturnType<typeof useLayoutController>;
      };
    actions: Pick<
      UseMainAppLayoutNodesStateActionParams,
      | "handleSetThreadListSortKey"
      | "handleRefreshAllWorkspaceThreads"
      | "onOpenSettings"
      | "clearDraftState"
      | "clearDraftStateIfDifferentWorkspace"
      | "selectHome"
      | "selectWorkspace"
      | "connectWorkspace"
      | "setActiveWorkspaceId"
      | "setActiveTab"
      | "updateWorkspaceSettings"
      | "handleRenameThread"
      | "removeWorkspace"
      | "removeWorktree"
      | "exitDiffView"
      | "refreshGitStatus"
      | "handleCopyThread"
      | "onActiveAtlasDriverOrderChange"
      | "onActiveAtlasEnabledChange"
      | "onActiveAtlasDetailLevelChange"
      | "setGitRootScanDepth"
      | "scanGitRoots"
      | "handlePickGitRoot"
      | "handleSetGitRoot"
      | "handleApplyWorktreeChanges"
      | "handleStageGitAll"
      | "handleStageGitFile"
      | "handleUnstageGitFile"
      | "handleRevertGitFile"
      | "handleRevertAllGitChanges"
    >;
  };
  conversation: {
    state: MainAppConversationBridgeContextParams & {
      conversationState: MainAppConversationState;
      activeWorkspace: BridgeParams["activeWorkspace"];
      composerEditorExpanded: BridgeParams["composerEditorExpanded"];
    };
    actions: Pick<UseMainAppLayoutNodesStateActionParams, "toggleComposerEditorExpanded">;
  };
  gitReview: {
    state: Pick<
      UseMainAppLayoutNodesStateLayoutParams,
      "gitPanelState" | "gitHubPanelState" | "gitCommitState"
    > &
      MainAppGitReviewBridgeContextParams & {
        activeWorkspaceId: BridgeParams["activeWorkspaceId"];
        activeWorkspace: BridgeParams["activeWorkspace"];
        setActiveWorkspaceId: (workspaceId: string | null) => void;
        setActiveTab: MainAppLayoutShellParams["setActiveTab"];
        conversationState: MainAppConversationState;
      };
    actions: Pick<
      UseMainAppLayoutNodesStateActionParams,
      | "onStartTaskFromGitHubIssue"
      | "getGitHubIssueFollowUpPreview"
      | "onStartTaskFromGitHubIssueFollowUp"
      | "onStartTaskFromGitHubPullRequest"
      | "getGitHubPullRequestFollowUpPreview"
      | "onStartTaskFromGitHubPullRequestReviewFollowUp"
      | "getGitHubPullRequestReviewFollowUpPreview"
    >;
    reviewPackControllerReady?: MainAppReviewPackControllerReady;
  };
  runtime: {
    state: Pick<UseMainAppLayoutNodesStateLayoutParams, "updaterController" | "terminalControls"> &
      MainAppRuntimeBridgeContextParams;
    actions: Pick<
      UseMainAppLayoutNodesStateActionParams,
      | "handleSwitchAccount"
      | "handleSelectLoggedInCodexAccount"
      | "handleCancelSwitchAccount"
      | "onConnectLocalRuntimePort"
      | "onRefreshCurrentUsage"
      | "onRefreshAllUsage"
      | "handleSelectOpenAppId"
      | "dismissErrorToast"
    >;
  };
};
