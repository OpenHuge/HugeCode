import type { ReactNode } from "react";
import { MissionCenter } from "../../missions/components/MissionCenter";
import { ReviewCenter } from "../../review/components/ReviewCenter";
import type { AppTab } from "../../shell/types/shellRoute";

type PhoneLayoutProps = {
  approvalToastsNode: ReactNode;
  updateToastNode: ReactNode;
  errorToastsNode: ReactNode;
  tabBarNode: ReactNode;
  homeNode: ReactNode;
  sidebarNode: ReactNode;
  missionOverviewNode?: ReactNode;
  activeTab: AppTab;
  activeWorkspace: boolean;
  activeThreadId: string | null;
  showGitDetail: boolean;
  compactEmptyCodexNode: ReactNode;
  compactEmptyGitNode: ReactNode;
  compactGitBackNode: ReactNode;
  topbarLeftNode: ReactNode;
  messagesNode: ReactNode;
  composerNode: ReactNode;
  gitDiffPanelNode: ReactNode;
  gitDiffViewerNode: ReactNode;
  debugPanelNode: ReactNode;
};

export function PhoneLayout({
  approvalToastsNode,
  updateToastNode,
  errorToastsNode,
  tabBarNode,
  homeNode,
  sidebarNode,
  missionOverviewNode,
  activeTab,
  activeWorkspace,
  activeThreadId,
  showGitDetail: _showGitDetail,
  compactEmptyCodexNode,
  compactEmptyGitNode,
  compactGitBackNode,
  topbarLeftNode,
  messagesNode,
  composerNode,
  gitDiffPanelNode,
  gitDiffViewerNode,
  debugPanelNode: _debugPanelNode,
}: PhoneLayoutProps) {
  return (
    <div className="compact-shell">
      {approvalToastsNode}
      {updateToastNode}
      {errorToastsNode}
      {activeTab === "home" && <div className="compact-panel">{homeNode}</div>}
      {activeTab === "workspaces" && <div className="compact-panel">{sidebarNode}</div>}
      {activeTab === "missions" && (
        <>
          <div className="compact-panel">
            <MissionCenter
              activeWorkspace={activeWorkspace}
              activeThreadId={activeThreadId}
              scrollMessagesToBottomOnThreadChange
              topbarLeftNode={topbarLeftNode}
              missionOverviewNode={activeThreadId ? null : missionOverviewNode}
              contentClassName="content compact-content"
              messagesNode={messagesNode}
              composerNode={null}
              emptyNode={compactEmptyCodexNode}
            />
          </div>
          {activeWorkspace ? composerNode : null}
        </>
      )}
      {activeTab === "review" && (
        <div className="compact-panel">
          <ReviewCenter
            activeWorkspace={activeWorkspace}
            showDetail={false}
            topbarLeftNode={topbarLeftNode}
            diffListNode={<div className="compact-git-list">{gitDiffPanelNode}</div>}
            diffViewerNode={gitDiffViewerNode}
            backNode={compactGitBackNode}
            listWrapperClassName="compact-git"
            viewerWrapperClassName="compact-git-viewer"
            emptyNode={compactEmptyGitNode}
          />
        </div>
      )}
      {activeTab === "settings" && <div className="compact-panel">{homeNode}</div>}
      {tabBarNode}
    </div>
  );
}
