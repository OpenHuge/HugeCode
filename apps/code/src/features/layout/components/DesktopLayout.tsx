import { type MouseEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { onOpenPlanPanel } from "../../plan/utils/planPanelSurface";
import { RightPanelResizeHandle } from "../../right-panel/RightPanelPrimitives";
import { ThreadRightPanel } from "../../right-panel/ThreadRightPanel";
import { RIGHT_RAIL_ENTER_SETTLE_MS, RIGHT_RAIL_EXIT_MS } from "./DesktopLayout.motion";
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
          className={`main ${styles.mainShell[rightRailVisible ? "expanded" : "collapsed"]} ${
            showWorkspace ? styles.workspaceShell : ""
          }`}
        >
          {updateToastNode}
          {errorToastsNode}
          {approvalToastsNode}
          {showHome ? homeNode : null}
          {showWorkspace ? (
            <>
              {topbarLeftNode}
              <div className={styles.timelineSurface}>{messagesNode}</div>
              {rightRailVisible ? (
                <>
                  <RightPanelResizeHandle
                    aria-label="Resize right panel"
                    className={`${styles.rightRailResizeHandle} ${styles.rightRailResizeHandleMotion[rightRailMotionState]}`}
                    onMouseDown={(event) =>
                      onRightPanelResizeStart(event as unknown as MouseEvent<HTMLDivElement>)
                    }
                  />
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
