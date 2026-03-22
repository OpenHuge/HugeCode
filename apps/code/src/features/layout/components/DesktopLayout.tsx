import { type MouseEvent, type ReactNode, useEffect } from "react";
import { onOpenPlanPanel } from "../../plan/utils/planPanelSurface";
import { RightPanelResizeHandle } from "../../right-panel/RightPanelPrimitives";
import { ThreadRightPanel } from "../../right-panel/ThreadRightPanel";
import {
  RightPanelCollapseButton,
  RightPanelExpandButton,
  SidebarExpandButton,
} from "./SidebarToggleControls";
import * as styles from "./DesktopLayout.css";

type DesktopLayoutProps = {
  sidebarNode: ReactNode;
  updateToastNode: ReactNode;
  approvalToastsNode: ReactNode;
  errorToastsNode: ReactNode;
  homeNode: ReactNode;
  showHome: boolean;
  showWorkspace: boolean;
  topbarLeftNode: ReactNode;
  centerMode: "chat" | "diff";
  preloadGitDiffs: boolean;
  splitChatDiffView: boolean;
  sidebarCollapsed: boolean;
  onExpandSidebar: () => void;
  rightPanelInterruptNode: ReactNode;
  rightPanelDetailsNode: ReactNode;
  hasRightPanelDetailContent: boolean;
  rightPanelGitNode: ReactNode;
  rightPanelFilesNode: ReactNode;
  rightPanelPromptsNode: ReactNode;
  messagesNode: ReactNode;
  gitDiffViewerNode: ReactNode;
  hasGitDiffViewerContent?: boolean;
  planPanelNode: ReactNode;
  composerNode: ReactNode;
  terminalDockNode: ReactNode;
  debugPanelNode: ReactNode;
  hasActivePlan: boolean;
  rightPanelCollapsed: boolean;
  onCollapseRightPanel: () => void;
  onExpandRightPanel: () => void;
  onSidebarResizeStart: (event: MouseEvent<HTMLDivElement>) => void;
  onRightPanelResizeStart: (event: MouseEvent<HTMLDivElement>) => void;
  onPlanPanelResizeStart: (event: MouseEvent<HTMLDivElement>) => void;
};

export function DesktopLayout({
  sidebarNode,
  updateToastNode,
  approvalToastsNode,
  errorToastsNode,
  homeNode,
  showHome,
  showWorkspace,
  topbarLeftNode,
  rightPanelInterruptNode,
  rightPanelDetailsNode,
  hasRightPanelDetailContent,
  rightPanelGitNode,
  rightPanelFilesNode,
  rightPanelPromptsNode,
  sidebarCollapsed,
  onExpandSidebar,
  messagesNode,
  gitDiffViewerNode,
  hasGitDiffViewerContent = gitDiffViewerNode != null,
  planPanelNode,
  composerNode,
  terminalDockNode,
  debugPanelNode,
  hasActivePlan,
  rightPanelCollapsed,
  onCollapseRightPanel,
  onExpandRightPanel,
  onSidebarResizeStart,
  onRightPanelResizeStart,
}: DesktopLayoutProps) {
  useEffect(
    () =>
      onOpenPlanPanel(() => {
        if (!hasActivePlan || !rightPanelCollapsed) {
          return;
        }
        onExpandRightPanel();
      }),
    [hasActivePlan, onExpandRightPanel, rightPanelCollapsed]
  );

  return (
    <div className={styles.desktopShell} data-desktop-shell="kanna-frame">
      <div className={styles.sidebarPane} data-desktop-sidebar-pane="true">
        {sidebarNode}
      </div>
      <hr
        className={`sidebar-resizer ${styles.sidebarResizeHandle}`}
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={50}
        tabIndex={0}
        onMouseDown={onSidebarResizeStart}
      />

      <div className={styles.mainPane} data-desktop-main-pane="true">
        <section
          className={`main ${styles.mainShell[rightPanelCollapsed ? "collapsed" : "expanded"]} ${
            showWorkspace ? styles.workspaceShell : ""
          }`}
        >
          {updateToastNode}
          {errorToastsNode}
          {approvalToastsNode}
          {showHome ? homeNode : null}
          {showWorkspace ? (
            <>
              {sidebarCollapsed ? (
                <div className={styles.sidebarExpandToggle} data-desktop-sidebar-expand="true">
                  <SidebarExpandButton
                    isCompact={false}
                    sidebarCollapsed
                    rightPanelCollapsed={rightPanelCollapsed}
                    onCollapseSidebar={() => undefined}
                    onExpandSidebar={onExpandSidebar}
                    onCollapseRightPanel={() => undefined}
                    onExpandRightPanel={onExpandRightPanel}
                  />
                </div>
              ) : null}
              <div className={styles.rightPanelExpandToggle} data-desktop-right-rail-toggle="true">
                {rightPanelCollapsed ? (
                  <RightPanelExpandButton
                    isCompact={false}
                    sidebarCollapsed={sidebarCollapsed}
                    rightPanelCollapsed
                    onCollapseSidebar={() => undefined}
                    onExpandSidebar={onExpandSidebar}
                    onCollapseRightPanel={() => undefined}
                    onExpandRightPanel={onExpandRightPanel}
                  />
                ) : (
                  <RightPanelCollapseButton
                    isCompact={false}
                    sidebarCollapsed={sidebarCollapsed}
                    rightPanelCollapsed={false}
                    onCollapseSidebar={() => undefined}
                    onExpandSidebar={onExpandSidebar}
                    onCollapseRightPanel={onCollapseRightPanel}
                    onExpandRightPanel={onExpandRightPanel}
                  />
                )}
              </div>
              {topbarLeftNode}
              <div className={styles.timelineSurface}>{messagesNode}</div>
              {!rightPanelCollapsed ? (
                <>
                  <RightPanelResizeHandle
                    aria-label="Resize right panel"
                    className={styles.rightRailResizeHandle}
                    onMouseDown={(event) =>
                      onRightPanelResizeStart(event as unknown as MouseEvent<HTMLDivElement>)
                    }
                  />
                  <aside className={styles.rightRail} data-right-rail="true">
                    <ThreadRightPanel
                      interruptNode={rightPanelInterruptNode}
                      detailNode={rightPanelDetailsNode}
                      hasDetailContent={hasRightPanelDetailContent}
                      gitNode={rightPanelGitNode}
                      filesNode={rightPanelFilesNode}
                      promptsNode={rightPanelPromptsNode}
                      planNode={planPanelNode}
                      diffNode={gitDiffViewerNode}
                      hasDiffContent={hasGitDiffViewerContent}
                      hasActivePlan={hasActivePlan}
                    />
                  </aside>
                </>
              ) : null}
              <div className={styles.composerDock}>{composerNode}</div>
            </>
          ) : null}
          {terminalDockNode}
          {debugPanelNode}
        </section>
      </div>
    </div>
  );
}
