import { useMemo } from "react";
import type { AppLayoutProps } from "../components/AppLayout";

type MainAppLayoutNodes = Pick<
  AppLayoutProps,
  | "sidebarNode"
  | "composerNode"
  | "approvalToastsNode"
  | "updateToastNode"
  | "errorToastsNode"
  | "homeNode"
  | "missionOverviewNode"
  | "mainHeaderNode"
  | "tabBarNode"
  | "rightPanelInterruptNode"
  | "rightPanelDetailsNode"
  | "hasRightPanelDetailContent"
  | "rightPanelGitNode"
  | "rightPanelFilesNode"
  | "rightPanelPromptsNode"
  | "gitDiffPanelNode"
  | "gitDiffViewerNode"
  | "hasGitDiffViewerContent"
  | "planPanelNode"
  | "debugPanelNode"
  | "terminalDockNode"
  | "compactEmptyCodexNode"
  | "compactEmptyGitNode"
  | "compactGitBackNode"
>;

type UseMainAppLayoutPropsParams = {
  isPhone: AppLayoutProps["isPhone"];
  showHome: AppLayoutProps["showHome"];
  showGitDetail: AppLayoutProps["showGitDetail"];
  activeTab: AppLayoutProps["activeTab"];
  activeThreadId: AppLayoutProps["activeThreadId"];
  centerMode: AppLayoutProps["centerMode"];
  preloadGitDiffs: AppLayoutProps["preloadGitDiffs"];
  splitChatDiffView: AppLayoutProps["splitChatDiffView"];
  hasActivePlan: AppLayoutProps["hasActivePlan"];
  sidebarCollapsed: AppLayoutProps["sidebarCollapsed"];
  onExpandSidebar: AppLayoutProps["onExpandSidebar"];
  rightPanelCollapsed: AppLayoutProps["rightPanelCollapsed"];
  onCollapseRightPanel: AppLayoutProps["onCollapseRightPanel"];
  onExpandRightPanel: AppLayoutProps["onExpandRightPanel"];
  hasActiveWorkspace: boolean;
  layoutNodes: MainAppLayoutNodes;
  messagesNode: AppLayoutProps["messagesNode"];
  desktopTopbarLeftNode: AppLayoutProps["desktopTopbarLeftNode"];
  codexTopbarActionsNode: AppLayoutProps["codexTopbarActionsNode"];
  onSidebarResizeStart: AppLayoutProps["onSidebarResizeStart"];
  onRightPanelResizeStart: AppLayoutProps["onRightPanelResizeStart"];
  onPlanPanelResizeStart: AppLayoutProps["onPlanPanelResizeStart"];
};

export function useMainAppLayoutProps({
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
  hasActiveWorkspace,
  layoutNodes,
  messagesNode,
  desktopTopbarLeftNode,
  codexTopbarActionsNode,
  onSidebarResizeStart,
  onRightPanelResizeStart,
  onPlanPanelResizeStart,
}: UseMainAppLayoutPropsParams): AppLayoutProps {
  return useMemo(
    () => ({
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
      activeWorkspace: hasActiveWorkspace,
      ...layoutNodes,
      messagesNode,
      desktopTopbarLeftNode,
      codexTopbarActionsNode,
      onSidebarResizeStart,
      onRightPanelResizeStart,
      onPlanPanelResizeStart,
    }),
    [
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
      hasActiveWorkspace,
      layoutNodes,
      messagesNode,
      desktopTopbarLeftNode,
      codexTopbarActionsNode,
      onSidebarResizeStart,
      onRightPanelResizeStart,
      onPlanPanelResizeStart,
    ]
  );
}
