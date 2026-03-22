import type { MissionNavigationTarget } from "../../../missions/utils/missionControlPresentation";
import { deriveSidebarThreadStatusMap } from "../../../app/components/SidebarThreadStatus.logic";
import { Sidebar } from "../../../app/components/Sidebar";
import { flattenLayoutNodesOptions, type LayoutNodesOptions } from "./types";

type SidebarNodeProps = {
  options: LayoutNodesOptions;
  onOpenMissionTarget: (target: MissionNavigationTarget) => void;
};

export function SidebarNode({ options, onOpenMissionTarget }: SidebarNodeProps) {
  const input = flattenLayoutNodesOptions(options);
  const sidebarThreadStatusById = deriveSidebarThreadStatusMap({
    threadsByWorkspace: input.threadsByWorkspace,
    baseStatusById: input.threadStatusById,
    approvals: input.approvals,
    userInputRequests: input.userInputRequests,
    toolCallRequests: input.toolCallRequests,
    itemsByThread: input.itemsByThread,
    missionControlProjection: input.missionControlProjection ?? null,
  });

  return (
    <Sidebar
      workspaces={input.workspaces}
      groupedWorkspaces={input.groupedWorkspaces}
      hasLoadedWorkspaces={input.hasLoadedWorkspaces}
      missionControlProjection={input.missionControlProjection ?? null}
      hasWorkspaceGroups={input.hasWorkspaceGroups}
      deletingWorktreeIds={input.deletingWorktreeIds}
      newAgentDraftWorkspaceId={input.newAgentDraftWorkspaceId}
      startingDraftThreadWorkspaceId={input.startingDraftThreadWorkspaceId}
      threadsByWorkspace={input.threadsByWorkspace}
      threadParentById={input.threadParentById}
      threadStatusById={sidebarThreadStatusById}
      threadListLoadingByWorkspace={input.threadListLoadingByWorkspace}
      threadListPagingByWorkspace={input.threadListPagingByWorkspace}
      threadListCursorByWorkspace={input.threadListCursorByWorkspace}
      threadListSortKey={input.threadListSortKey}
      onSetThreadListSortKey={input.onSetThreadListSortKey}
      onRefreshAllThreads={input.onRefreshAllThreads}
      activeWorkspaceId={input.activeWorkspaceId}
      activeThreadId={input.activeThreadId}
      accountRateLimits={input.activeRateLimits}
      usageShowRemaining={input.usageShowRemaining}
      accountInfo={input.accountInfo}
      onRefreshCurrentUsage={input.onRefreshCurrentUsage}
      onRefreshAllUsage={input.onRefreshAllUsage}
      canRefreshCurrentUsage={input.canRefreshCurrentUsage}
      canRefreshAllUsage={input.canRefreshAllUsage}
      currentUsageRefreshLoading={input.currentUsageRefreshLoading}
      allUsageRefreshLoading={input.allUsageRefreshLoading}
      onSwitchAccount={input.onSwitchAccount}
      onSelectLoggedInCodexAccount={input.onSelectLoggedInCodexAccount}
      onCancelSwitchAccount={input.onCancelSwitchAccount}
      accountSwitching={input.accountSwitching}
      accountSwitchError={input.accountSwitchError}
      accountCenter={input.accountCenter}
      onOpenSettings={input.onOpenSettings}
      onOpenDebug={input.onOpenDebug}
      showDebugButton={input.showDebugButton}
      onSelectHome={input.onSelectHome}
      onCollapseSidebar={input.onCollapseSidebar}
      onAddWorkspace={input.onAddWorkspace}
      onSelectWorkspace={input.onSelectWorkspace}
      onConnectWorkspace={input.onConnectWorkspace}
      onAddAgent={input.onAddAgent}
      onAddWorktreeAgent={input.onAddWorktreeAgent}
      onAddCloneAgent={input.onAddCloneAgent}
      onToggleWorkspaceCollapse={input.onToggleWorkspaceCollapse}
      onReorderWorkspace={input.onReorderWorkspace}
      onSelectThread={input.onSelectThread}
      onDeleteThread={input.onDeleteThread}
      onSyncThread={input.onSyncThread}
      onOpenMissionTarget={onOpenMissionTarget}
      pinThread={input.pinThread}
      unpinThread={input.unpinThread}
      isThreadPinned={input.isThreadPinned}
      getPinTimestamp={input.getPinTimestamp}
      onRenameThread={input.onRenameThread}
      onDeleteWorkspace={input.onDeleteWorkspace}
      onDeleteWorktree={input.onDeleteWorktree}
      onLoadOlderThreads={input.onLoadOlderThreads}
      onReloadWorkspaceThreads={input.onReloadWorkspaceThreads}
      workspaceDropTargetRef={input.workspaceDropTargetRef}
      isWorkspaceDropActive={input.isWorkspaceDropActive}
      workspaceDropText={input.workspaceDropText}
      onWorkspaceDragOver={input.onWorkspaceDragOver}
      onWorkspaceDragEnter={input.onWorkspaceDragEnter}
      onWorkspaceDragLeave={input.onWorkspaceDragLeave}
      onWorkspaceDrop={input.onWorkspaceDrop}
    />
  );
}
