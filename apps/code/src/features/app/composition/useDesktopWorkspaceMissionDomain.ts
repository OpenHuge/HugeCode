import { useEffect, type MutableRefObject } from "react";
import { useDesktopWorkspaceThreadDomain } from "./useDesktopWorkspaceThreadDomain";
import { useMainAppConversationState } from "../hooks/useMainAppConversationState";
import { useMainAppMissionControlState } from "../hooks/useMainAppMissionControlState";
import { useMainAppShellBootstrap } from "../hooks/useMainAppShellBootstrap";
import { useThreadCodexControls } from "../hooks/useThreadCodexControls";
import { useGitCommitController } from "../hooks/useGitCommitController";
import { useGitHubRuntimeTaskLaunchers } from "../hooks/useGitHubRuntimeTaskLaunchers";

type MainAppBootstrapState = ReturnType<typeof useMainAppShellBootstrap>;
type ThreadDomainState = ReturnType<typeof useDesktopWorkspaceThreadDomain>;
type ThreadCodexState = ReturnType<typeof useThreadCodexControls>;
type ConversationState = ReturnType<typeof useMainAppConversationState>;

export type DesktopWorkspaceMissionDomainInput = {
  workspaceState: MainAppBootstrapState["workspaceState"];
  gitPanelState: MainAppBootstrapState["gitPanelState"];
  gitRemoteUrl: MainAppBootstrapState["gitRemoteUrl"];
  appSettings: MainAppBootstrapState["appSettings"];
  debugState: MainAppBootstrapState["debugState"];
  workspacesById: MainAppBootstrapState["workspacesById"];
  getWorkspaceName: MainAppBootstrapState["getWorkspaceName"];
  setActiveTab: MainAppBootstrapState["setActiveTab"];
  threadCodexState: ThreadCodexState;
  threadCodexParamsVersion: number;
  getThreadCodexParams: Parameters<typeof useMainAppMissionControlState>[0]["getThreadCodexParams"];
  patchThreadCodexParams: Parameters<
    typeof useMainAppMissionControlState
  >[0]["patchThreadCodexParams"];
  threadDomain: ThreadDomainState;
  conversationState: ConversationState;
  recordPendingThreadLinkRef: MutableRefObject<(workspaceId: string, threadId: string) => void>;
};

export type DesktopWorkspaceMissionDomainOutput = {
  missionControlState: ReturnType<typeof useMainAppMissionControlState>;
  gitCommitState: ReturnType<typeof useGitCommitController>;
  handleStartTaskFromGitHubIssue: ReturnType<
    typeof useGitHubRuntimeTaskLaunchers
  >["handleStartTaskFromGitHubIssue"];
  handleStartTaskFromGitHubPullRequest: ReturnType<
    typeof useGitHubRuntimeTaskLaunchers
  >["handleStartTaskFromGitHubPullRequest"];
};

export function useDesktopWorkspaceMissionDomain({
  workspaceState,
  gitPanelState,
  gitRemoteUrl,
  appSettings,
  debugState,
  workspacesById,
  getWorkspaceName,
  setActiveTab,
  threadCodexState,
  threadCodexParamsVersion,
  getThreadCodexParams,
  patchThreadCodexParams,
  threadDomain,
  conversationState,
  recordPendingThreadLinkRef,
}: DesktopWorkspaceMissionDomainInput): DesktopWorkspaceMissionDomainOutput {
  const { activeWorkspace, activeWorkspaceId, hasLoaded, refreshWorkspaces, connectWorkspace } =
    workspaceState;
  const { activeThreadId, activeItems, threadStatusById, visibleActiveItems, threadsState } =
    threadDomain;
  const { handleStartTaskFromGitHubIssue, handleStartTaskFromGitHubPullRequest } =
    useGitHubRuntimeTaskLaunchers({
      activeWorkspace,
      activeWorkspaceId,
      gitRemoteUrl,
      selectedRemoteBackendId: threadCodexState.selectedRemoteBackendId,
      refreshMissionControl: conversationState.homeState.refreshMissionControl,
    });

  const missionControlState = useMainAppMissionControlState({
    activeWorkspace,
    activeThreadId,
    missionControlProjection: conversationState.homeState.missionControlProjection,
    refreshMissionControl: conversationState.homeState.refreshMissionControl,
    systemNotificationsEnabled: appSettings.systemNotificationsEnabled,
    getWorkspaceName,
    hasLoadedWorkspaces: hasLoaded,
    workspacesById,
    refreshWorkspaces,
    connectWorkspace,
    setActiveTab,
    setCenterMode: gitPanelState.setCenterMode,
    setSelectedDiffPath: gitPanelState.setSelectedDiffPath,
    setActiveWorkspaceId: workspaceState.setActiveWorkspaceId,
    setActiveThreadId: threadsState.setActiveThreadId,
    onDebug: debugState.addDebugEntry,
    threadCodexState: {
      accessMode: threadCodexState.accessMode,
      selectedModelId: threadCodexState.selectedModelId,
      selectedEffort: threadCodexState.selectedEffort,
    },
    threadCodexParamsVersion,
    getThreadCodexParams,
    activeItems: visibleActiveItems.length > 0 ? visibleActiveItems : activeItems,
    threadStatusById,
    sendUserMessageToThread: threadsState.sendUserMessageToThread,
    patchThreadCodexParams,
    preferredBackendIds: threadCodexState.preferredBackendIds,
  });

  useEffect(() => {
    recordPendingThreadLinkRef.current = missionControlState.onThreadNotificationSent;
    return () => {
      recordPendingThreadLinkRef.current = () => undefined;
    };
  }, [missionControlState.onThreadNotificationSent, recordPendingThreadLinkRef]);

  const gitCommitState = useGitCommitController({
    activeWorkspace,
    activeWorkspaceId,
    activeWorkspaceIdRef: gitPanelState.activeWorkspaceIdRef,
    gitStatus: gitPanelState.gitStatus,
    refreshGitStatus: gitPanelState.refreshGitStatus,
    refreshGitLog: gitPanelState.refreshGitLog,
  });

  return {
    missionControlState,
    gitCommitState,
    handleStartTaskFromGitHubIssue,
    handleStartTaskFromGitHubPullRequest,
  };
}
