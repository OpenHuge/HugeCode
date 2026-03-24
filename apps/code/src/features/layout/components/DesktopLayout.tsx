import { type MouseEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { WorkspaceChromeLayout } from "@ku0/code-application";
import { onOpenPlanPanel } from "../../plan/utils/planPanelSurface";
import { RightPanelResizeHandle } from "../../right-panel/RightPanelPrimitives";
import { ThreadRightPanel } from "../../right-panel/ThreadRightPanel";
import { RIGHT_RAIL_ENTER_SETTLE_MS, RIGHT_RAIL_EXIT_MS } from "./DesktopLayout.motion";
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

type RightRailMotionState = "hidden" | "entering" | "open" | "exiting";

export function DesktopLayout({
  sidebarNode,
  updateToastNode,
  approvalToastsNode,
  errorToastsNode,
  homeNode,
  showHome,
  showWorkspace,
  topbarLeftNode,
  sidebarCollapsed,
  onExpandSidebar,
  rightPanelInterruptNode,
  rightPanelDetailsNode,
  hasRightPanelDetailContent,
  rightPanelGitNode,
  rightPanelFilesNode,
  rightPanelPromptsNode,
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
  const [rightRailMotionState, setRightRailMotionState] = useState<RightRailMotionState>(() =>
    rightPanelCollapsed ? "hidden" : "open"
  );
  const rightRailMotionStateRef = useRef(rightRailMotionState);
  const enterTimerRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);
  rightRailMotionStateRef.current = rightRailMotionState;

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

  useEffect(() => {
    const clearTimers = () => {
      if (enterTimerRef.current != null) {
        window.clearTimeout(enterTimerRef.current);
        enterTimerRef.current = null;
      }
      if (exitTimerRef.current != null) {
        window.clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
    };

    clearTimers();
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!rightPanelCollapsed) {
      if (prefersReducedMotion) {
        setRightRailMotionState("open");
        return clearTimers;
      }
      if (rightRailMotionStateRef.current === "hidden") {
        setRightRailMotionState("entering");
        enterTimerRef.current = window.setTimeout(() => {
          setRightRailMotionState("open");
          enterTimerRef.current = null;
        }, RIGHT_RAIL_ENTER_SETTLE_MS);
        return clearTimers;
      }
      setRightRailMotionState("open");
      return clearTimers;
    }

    if (prefersReducedMotion || rightRailMotionStateRef.current === "hidden") {
      setRightRailMotionState("hidden");
      return clearTimers;
    }

    setRightRailMotionState("exiting");
    exitTimerRef.current = window.setTimeout(() => {
      setRightRailMotionState("hidden");
      exitTimerRef.current = null;
    }, RIGHT_RAIL_EXIT_MS);
    return clearTimers;
  }, [rightPanelCollapsed]);

  const rightRailVisible = rightRailMotionState !== "hidden";

  return (
    <WorkspaceChromeLayout
      sidebarNode={sidebarNode}
      sidebarResizeHandleNode={
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
      }
      toastNodes={
        <>
          {updateToastNode}
          {errorToastsNode}
          {approvalToastsNode}
        </>
      }
      homeNode={homeNode}
      showHome={showHome}
      showWorkspace={showWorkspace}
      shellOverlaysNode={
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
        </>
      }
      topbarNode={topbarLeftNode}
      timelineNode={<div className={styles.timelineSurface}>{messagesNode}</div>}
      rightRailResizeHandleNode={
        rightRailVisible ? (
          <RightPanelResizeHandle
            aria-label="Resize right panel"
            className={`${styles.rightRailResizeHandle} ${styles.rightRailResizeHandleMotion[rightRailMotionState]}`}
            onMouseDown={(event) =>
              onRightPanelResizeStart(event as unknown as MouseEvent<HTMLDivElement>)
            }
          />
        ) : null
      }
      rightRailNode={
        rightRailVisible ? (
          <aside
            className={`${styles.rightRail} ${styles.rightRailMotion[rightRailMotionState]}`}
            data-right-rail="true"
            data-right-rail-motion={rightRailMotionState}
          >
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
        ) : null
      }
      composerNode={<div className={styles.composerDock}>{composerNode}</div>}
      terminalDockNode={terminalDockNode}
      debugPanelNode={debugPanelNode}
      desktopShellClassName={styles.desktopShell}
      sidebarPaneClassName={styles.sidebarPane}
      mainPaneClassName={styles.mainPane}
      mainShellClassName={`${styles.mainShell[rightRailVisible ? "expanded" : "collapsed"]} ${
        showWorkspace ? styles.workspaceShell : ""
      }`}
    />
  );
}
