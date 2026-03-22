import { lazy, Suspense } from "react";
import { Button, Tabs, TabsList, TabsTrigger } from "../../../../design-system";
import { resolveActivePlanArtifact } from "../../../messages/utils/planArtifact";
import { isInspectableRightPanelDetailItem } from "../../../right-panel/rightPanelModels";
import {
  flattenLayoutNodesOptions,
  type LayoutNodesOptions,
  type LayoutNodesResult,
} from "./types";
import * as compactEmptyStyles from "./CompactEmptyState.css";

type SecondaryLayoutNodes = Pick<
  LayoutNodesResult,
  | "planPanelNode"
  | "rightPanelInterruptNode"
  | "rightPanelDetailsNode"
  | "hasRightPanelDetailContent"
  | "debugPanelNode"
  | "terminalDockNode"
  | "compactEmptyCodexNode"
  | "compactEmptyGitNode"
  | "compactGitBackNode"
>;

const LazyDebugPanel = lazy(async () => {
  const module = await import("../../../debug/components/DebugPanel");
  return { default: module.DebugPanel };
});
const LazyPlanPanel = lazy(async () => {
  const module = await import("../../../plan/components/PlanPanel");
  return { default: module.PlanPanel };
});
const LazyThreadRightPanelDetails = lazy(async () => {
  const module = await import("../../../right-panel/ThreadRightPanelDetails");
  return { default: module.ThreadRightPanelDetails };
});
const LazyTerminalDock = lazy(async () => {
  const module = await import("../../../terminal/components/TerminalDock");
  return { default: module.TerminalDock };
});
const LazyTerminalPanel = lazy(async () => {
  const module = await import("../../../terminal/components/TerminalPanel");
  return { default: module.TerminalPanel };
});

export function buildSecondaryNodes(options: LayoutNodesOptions): SecondaryLayoutNodes {
  const input = flattenLayoutNodesOptions(options);
  const activePlanArtifact = resolveActivePlanArtifact({
    threadId: input.activeThreadId,
    items: input.activeItems,
    isThinking: input.isProcessing,
    hasBlockingSurface: false,
  });
  const shouldLoadDesktopRightRail = !input.isPhone && !input.rightPanelCollapsed;
  const shouldLoadPlanPanel =
    shouldLoadDesktopRightRail && Boolean(input.plan ?? activePlanArtifact);
  const rightPanelSharedProps = shouldLoadDesktopRightRail
    ? {
        items: input.activeItems,
        threadId: input.activeThreadId,
        workspaceLoadError: input.workspaceLoadError ?? null,
        selectedDiffPath: input.selectedDiffPath,
        gitDiffs: input.gitDiffs,
        turnDiff: input.activeThreadId
          ? (input.turnDiffByThread[input.activeThreadId] ?? null)
          : null,
        approvalRequests: input.activeWorkspaceId
          ? input.approvals.filter((request) => request.workspace_id === input.activeWorkspaceId)
          : [],
        userInputRequests: input.activeThreadId
          ? input.userInputRequests.filter(
              (request) => request.params.thread_id === input.activeThreadId
            )
          : [],
        toolCallRequests: input.activeThreadId
          ? input.toolCallRequests.filter(
              (request) => request.params.thread_id === input.activeThreadId
            )
          : [],
      }
    : null;
  const planPanelNode = shouldLoadPlanPanel ? (
    <Suspense fallback={null}>
      <LazyPlanPanel
        plan={input.plan}
        isProcessing={input.isProcessing}
        activeArtifact={activePlanArtifact}
      />
    </Suspense>
  ) : null;
  const hasRightPanelInterruptSurface = Boolean(
    rightPanelSharedProps &&
    (rightPanelSharedProps.approvalRequests.length > 0 ||
      rightPanelSharedProps.userInputRequests.length > 0 ||
      rightPanelSharedProps.toolCallRequests.length > 0 ||
      rightPanelSharedProps.workspaceLoadError)
  );
  const hasRightPanelDetailContent = Boolean(
    rightPanelSharedProps &&
    (rightPanelSharedProps.selectedDiffPath ||
      rightPanelSharedProps.turnDiff?.trim() ||
      rightPanelSharedProps.items.some(isInspectableRightPanelDetailItem))
  );
  const rightPanelDetailsNode = shouldLoadDesktopRightRail ? (
    <Suspense fallback={null}>
      {rightPanelSharedProps ? (
        <LazyThreadRightPanelDetails section="detail" {...rightPanelSharedProps} />
      ) : null}
    </Suspense>
  ) : null;
  const rightPanelInterruptNode =
    shouldLoadDesktopRightRail && hasRightPanelInterruptSurface ? (
      <Suspense fallback={null}>
        {rightPanelSharedProps ? (
          <LazyThreadRightPanelDetails section="interrupt" {...rightPanelSharedProps} />
        ) : null}
      </Suspense>
    ) : null;

  const shouldLoadTerminalDock = input.terminalOpen;
  const terminalPanelNode =
    shouldLoadTerminalDock && input.terminalState ? (
      <Suspense fallback={null}>
        <LazyTerminalPanel
          containerRef={input.terminalState.containerRef}
          status={input.terminalState.status}
          message={input.terminalState.message}
        />
      </Suspense>
    ) : null;

  const terminalDockNode = shouldLoadTerminalDock ? (
    <Suspense fallback={null}>
      <LazyTerminalDock
        isOpen={input.terminalOpen}
        terminals={input.terminalTabs}
        activeTerminalId={input.activeTerminalId}
        onSelectTerminal={input.onSelectTerminal}
        onNewTerminal={input.onNewTerminal}
        onCloseTerminal={input.onCloseTerminal}
        onClearActiveTerminal={input.onClearTerminal}
        onRestartActiveTerminal={input.onRestartTerminal}
        onInterruptActiveTerminal={input.onInterruptTerminal}
        canClearActiveTerminal={input.canClearTerminal}
        canRestartActiveTerminal={input.canRestartTerminal}
        canInterruptActiveTerminal={input.canInterruptTerminal}
        sessionStatus={input.terminalState?.status ?? "idle"}
        onResizeStart={input.onResizeTerminal}
        terminalNode={terminalPanelNode}
      />
    </Suspense>
  ) : null;

  const debugPanelNode = input.debugOpen ? (
    <Suspense fallback={null}>
      <LazyDebugPanel
        entries={input.debugEntries}
        isOpen
        workspaceId={input.activeWorkspaceId}
        onClear={input.onClearDebug}
        onCopy={input.onCopyDebug}
        onResizeStart={input.onResizeDebug}
      />
    </Suspense>
  ) : null;

  const compactEmptyCodexNode = (
    <div className={compactEmptyStyles.root} data-compact-empty="true">
      <div className={compactEmptyStyles.kicker}>Codex</div>
      <div className={compactEmptyStyles.title}>Connect a workspace</div>
      <div className={compactEmptyStyles.copy}>
        Pick a project to start a new Codex thread and keep edits grounded in real files.
      </div>
      <div className={compactEmptyStyles.actions}>
        <Button type="button" variant="ghost" size="sm" onClick={input.onGoProjects}>
          Open Projects
        </Button>
      </div>
    </div>
  );

  const compactEmptyGitNode = (
    <div className={compactEmptyStyles.root} data-compact-empty="true">
      <div className={compactEmptyStyles.kicker}>Git</div>
      <div className={compactEmptyStyles.title}>Choose a workspace first</div>
      <div className={compactEmptyStyles.copy}>
        Select a project to inspect diffs, branches, and staged changes without leaving the app.
      </div>
      <div className={compactEmptyStyles.actions}>
        <Button type="button" variant="ghost" size="sm" onClick={input.onGoProjects}>
          Open Projects
        </Button>
      </div>
    </div>
  );

  const compactGitDiffActive = input.centerMode === "diff" && Boolean(input.selectedDiffPath);
  const compactGitBackNode = (
    <div className="compact-git-back">
      <Tabs
        value={compactGitDiffActive ? "diff" : "files"}
        onValueChange={(value) => {
          if (value === "diff") {
            input.onShowSelectedDiff();
            return;
          }
          input.onBackFromDiff();
        }}
      >
        <TabsList className="compact-git-tabs" aria-label="Compact Git panel mode">
          <TabsTrigger value="files" className="compact-git-switch-button">
            Files
          </TabsTrigger>
          <TabsTrigger
            value="diff"
            className="compact-git-switch-button"
            disabled={!input.selectedDiffPath}
          >
            Diff
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );

  return {
    planPanelNode,
    rightPanelInterruptNode,
    rightPanelDetailsNode,
    hasRightPanelDetailContent,
    debugPanelNode,
    terminalDockNode,
    compactEmptyCodexNode,
    compactEmptyGitNode,
    compactGitBackNode,
  };
}
