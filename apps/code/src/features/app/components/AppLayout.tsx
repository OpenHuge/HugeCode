import {
  cloneElement,
  isValidElement,
  lazy,
  memo,
  Suspense,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import type { AppTab } from "../../shell/types/shellRoute";

const DesktopLayout = lazy(() =>
  import("../../layout/components/DesktopLayout").then((module) => ({
    default: module.DesktopLayout,
  }))
);
const PhoneLayout = lazy(() =>
  import("../../layout/components/PhoneLayout").then((module) => ({
    default: module.PhoneLayout,
  }))
);

export type AppLayoutProps = {
  isPhone: boolean;
  showHome: boolean;
  showGitDetail: boolean;
  activeTab: AppTab;
  activeThreadId: string | null;
  centerMode: "chat" | "diff";
  preloadGitDiffs: boolean;
  splitChatDiffView: boolean;
  hasActivePlan: boolean;
  sidebarCollapsed: boolean;
  onExpandSidebar: () => void;
  rightPanelCollapsed: boolean;
  onCollapseRightPanel: () => void;
  onExpandRightPanel: () => void;
  activeWorkspace: boolean;
  sidebarNode: ReactNode;
  messagesNode: ReactNode;
  composerNode: ReactNode;
  approvalToastsNode: ReactNode;
  updateToastNode: ReactNode;
  errorToastsNode: ReactNode;
  homeNode: ReactNode;
  missionOverviewNode?: ReactNode;
  mainHeaderNode: ReactNode;
  desktopTopbarLeftNode: ReactNode;
  codexTopbarActionsNode?: ReactNode;
  tabBarNode: ReactNode;
  rightPanelInterruptNode: ReactNode;
  rightPanelDetailsNode: ReactNode;
  hasRightPanelDetailContent: boolean;
  rightPanelGitNode: ReactNode;
  rightPanelFilesNode: ReactNode;
  rightPanelPromptsNode: ReactNode;
  gitDiffPanelNode: ReactNode;
  gitDiffViewerNode: ReactNode;
  hasGitDiffViewerContent?: boolean;
  planPanelNode: ReactNode;
  debugPanelNode: ReactNode;
  terminalDockNode: ReactNode;
  compactEmptyCodexNode: ReactNode;
  compactEmptyGitNode: ReactNode;
  compactGitBackNode: ReactNode;
  onSidebarResizeStart: (event: MouseEvent<HTMLDivElement>) => void;
  onRightPanelResizeStart: (event: MouseEvent<HTMLDivElement>) => void;
  onPlanPanelResizeStart: (event: MouseEvent<HTMLDivElement>) => void;
};

export const AppLayout = memo(function AppLayout({
  isPhone,
  showHome,
  showGitDetail,
  activeTab,
  activeThreadId,
  centerMode,
  preloadGitDiffs,
  splitChatDiffView,
  hasActivePlan,
  sidebarCollapsed,
  onExpandSidebar,
  rightPanelCollapsed,
  onCollapseRightPanel,
  onExpandRightPanel,
  activeWorkspace,
  sidebarNode,
  messagesNode,
  composerNode,
  approvalToastsNode,
  updateToastNode,
  errorToastsNode,
  homeNode,
  missionOverviewNode,
  mainHeaderNode,
  desktopTopbarLeftNode,
  codexTopbarActionsNode,
  tabBarNode,
  rightPanelInterruptNode,
  rightPanelDetailsNode,
  hasRightPanelDetailContent,
  rightPanelGitNode,
  rightPanelFilesNode,
  rightPanelPromptsNode,
  gitDiffPanelNode,
  gitDiffViewerNode,
  hasGitDiffViewerContent = gitDiffViewerNode != null,
  planPanelNode,
  debugPanelNode,
  terminalDockNode,
  compactEmptyCodexNode,
  compactEmptyGitNode,
  compactGitBackNode,
  onSidebarResizeStart,
  onRightPanelResizeStart,
  onPlanPanelResizeStart,
}: AppLayoutProps) {
  const compactMainHeaderNode =
    codexTopbarActionsNode &&
    isValidElement(mainHeaderNode) &&
    typeof mainHeaderNode.type !== "string"
      ? cloneElement(mainHeaderNode as ReactElement<{ extraActionsNode?: ReactNode }>, {
          extraActionsNode: (
            <>
              {(mainHeaderNode.props as { extraActionsNode?: ReactNode }).extraActionsNode ?? null}
              {codexTopbarActionsNode}
            </>
          ),
        })
      : mainHeaderNode;

  if (isPhone) {
    return (
      <Suspense fallback={null}>
        <PhoneLayout
          approvalToastsNode={approvalToastsNode}
          updateToastNode={updateToastNode}
          errorToastsNode={errorToastsNode}
          tabBarNode={tabBarNode}
          homeNode={homeNode}
          sidebarNode={sidebarNode}
          activeTab={activeTab}
          activeWorkspace={activeWorkspace}
          activeThreadId={activeThreadId}
          showGitDetail={showGitDetail}
          compactEmptyCodexNode={compactEmptyCodexNode}
          compactEmptyGitNode={compactEmptyGitNode}
          compactGitBackNode={compactGitBackNode}
          topbarLeftNode={compactMainHeaderNode}
          missionOverviewNode={missionOverviewNode}
          messagesNode={messagesNode}
          composerNode={composerNode}
          gitDiffPanelNode={gitDiffPanelNode}
          gitDiffViewerNode={gitDiffViewerNode}
          debugPanelNode={debugPanelNode}
        />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={null}>
      <DesktopLayout
        sidebarNode={sidebarNode}
        updateToastNode={updateToastNode}
        approvalToastsNode={approvalToastsNode}
        errorToastsNode={errorToastsNode}
        homeNode={homeNode}
        showHome={showHome}
        showWorkspace={activeWorkspace && !showHome}
        topbarLeftNode={desktopTopbarLeftNode}
        centerMode={centerMode}
        preloadGitDiffs={preloadGitDiffs}
        splitChatDiffView={splitChatDiffView}
        rightPanelInterruptNode={rightPanelInterruptNode}
        rightPanelDetailsNode={rightPanelDetailsNode}
        hasRightPanelDetailContent={hasRightPanelDetailContent}
        rightPanelGitNode={rightPanelGitNode}
        rightPanelFilesNode={rightPanelFilesNode}
        rightPanelPromptsNode={rightPanelPromptsNode}
        sidebarCollapsed={sidebarCollapsed}
        onExpandSidebar={onExpandSidebar}
        messagesNode={messagesNode}
        gitDiffViewerNode={gitDiffViewerNode}
        hasGitDiffViewerContent={hasGitDiffViewerContent}
        planPanelNode={planPanelNode}
        composerNode={composerNode}
        terminalDockNode={terminalDockNode}
        debugPanelNode={debugPanelNode}
        hasActivePlan={hasActivePlan}
        rightPanelCollapsed={rightPanelCollapsed}
        onCollapseRightPanel={onCollapseRightPanel}
        onExpandRightPanel={onExpandRightPanel}
        onSidebarResizeStart={onSidebarResizeStart}
        onRightPanelResizeStart={onRightPanelResizeStart}
        onPlanPanelResizeStart={onPlanPanelResizeStart}
      />
    </Suspense>
  );
});
