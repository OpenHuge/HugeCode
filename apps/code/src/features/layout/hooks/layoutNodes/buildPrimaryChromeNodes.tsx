import { Suspense, lazy } from "react";
import { Button } from "../../../../design-system";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import { ApprovalToasts } from "../../../app/components/ApprovalToasts";
import { deriveSidebarThreadStatusMap } from "../../../app/components/SidebarThreadStatus.logic";
import { TabBar } from "../../../app/components/TabBar";
import {
  buildMissionOverviewCountsFromProjection,
  buildMissionOverviewItemsFromProjection,
  mapThreadVisualStateToMissionOverviewState,
  type MissionNavigationTarget,
} from "../../../missions/utils/missionControlPresentation";
import { openMissionTargetFromDesktopShell } from "../../../missions/utils/missionNavigation";
import { ErrorToasts } from "../../../notifications/components/ErrorToasts";
import { UpdateToast } from "../../../update/components/UpdateToast";
import { partitionApprovalsForTimeline } from "../../../messages/utils/timelineSurface";
import { resolveThreadVisualState } from "../../../threads/utils/threadExecutionState";
import { MainHeaderRightActions } from "../../../app/components/MainHeaderRightActions";
import type { LayoutNodesOptions, LayoutNodesResult } from "./types";
import { normalizeRecentThreadStatus, resolveApprovalMissionTarget } from "./primaryNodeHelpers";
import { flattenLayoutNodesOptions } from "./types";

type PrimaryChromeNodes = Pick<
  LayoutNodesResult,
  | "approvalToastsNode"
  | "updateToastNode"
  | "errorToastsNode"
  | "homeNode"
  | "missionOverviewNode"
  | "mainHeaderNode"
  | "desktopTopbarLeftNode"
  | "desktopTopbarRightNode"
  | "tabBarNode"
>;

const LazyHome = lazy(async () => {
  const module = await import("../../../home/components/Home");
  return { default: module.Home };
});

const LazyMainHeader = lazy(async () => {
  const module = await import("../../../app/components/MainHeader");
  return { default: module.MainHeader };
});

const LazyMissionOverviewPanel = lazy(async () => {
  const module = await import("../../../missions/components/MissionOverviewPanel");
  return { default: module.MissionOverviewPanel };
});

export function buildPrimaryChromeNodes(options: LayoutNodesOptions): PrimaryChromeNodes {
  const input = flattenLayoutNodesOptions(options);
  const sidebarThreadStatusById = deriveSidebarThreadStatusMap({
    threadsByWorkspace: input.threadsByWorkspace,
    baseStatusById: input.threadStatusById,
    approvals: input.approvals,
    userInputRequests: input.userInputRequests,
    toolCallRequests: input.toolCallRequests,
    itemsByThread: input.itemsByThread,
  });
  const activeWorkspace = input.activeWorkspace;
  const recentThreads = activeWorkspace
    ? (input.threadsByWorkspace[activeWorkspace.id] ?? [])
        .slice()
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .slice(0, 8)
        .map((thread) => ({
          thread,
          status: normalizeRecentThreadStatus(
            resolveThreadVisualState(sidebarThreadStatusById[thread.id])
          ),
          isActive: thread.id === input.activeThreadId,
        }))
    : [];
  const { timelineApprovals, floatingApprovals } = partitionApprovalsForTimeline({
    approvals: input.approvals,
    threadId: input.activeThreadId,
    workspaceId: input.activeWorkspace?.id ?? null,
  });
  const openMissionTarget = (
    target: MissionNavigationTarget,
    source: "home" | "missions" | "approval_toast"
  ) => {
    openMissionTargetFromDesktopShell({
      target,
      source,
      onOpenReviewPack: input.onOpenReviewPack,
      onSelectWorkspace: input.onSelectWorkspace,
      onSelectThread: input.onSelectThread,
      onSelectReviewTab: () => input.onSelectTab("review"),
    });
  };

  const approvalToastsNode = (
    <ApprovalToasts
      approvals={floatingApprovals}
      workspaces={input.workspaces}
      onDecision={input.handleApprovalDecision}
      onRemember={input.handleApprovalRemember}
      onOpenThread={input.onOpenThreadLink}
      onOpenMissionTarget={(target) => openMissionTarget(target, "approval_toast")}
      resolveMissionTarget={(request) =>
        resolveApprovalMissionTarget(request, input.missionControlProjection)
      }
      enablePrimaryHotkey={timelineApprovals.length === 0}
    />
  );

  const updateToastNode = (
    <UpdateToast
      state={input.updaterState}
      onUpdate={input.onUpdate}
      onDismiss={input.onDismissUpdate}
      postUpdateNotice={input.postUpdateNotice}
      onDismissPostUpdateNotice={input.onDismissPostUpdateNotice}
    />
  );

  const errorToastsNode = (
    <ErrorToasts toasts={input.errorToasts} onDismiss={input.onDismissErrorToast} />
  );

  const homeNode = (
    <Suspense fallback={null}>
      <LazyHome
        onOpenProject={input.onOpenProject}
        onOpenSettings={input.onOpenSettings}
        onConnectLocalRuntimePort={input.onConnectLocalRuntimePort}
        latestAgentRuns={input.latestAgentRuns}
        missionControlProjection={input.missionControlProjection ?? null}
        missionControlFreshness={input.missionControlFreshness ?? null}
        isLoadingLatestAgents={input.isLoadingLatestAgents}
        localUsageSnapshot={input.localUsageSnapshot}
        isLoadingLocalUsage={input.isLoadingLocalUsage}
        localUsageError={input.localUsageError}
        onRefreshLocalUsage={input.onRefreshLocalUsage}
        onRefreshMissionControl={input.onRefreshMissionControl}
        usageMetric={input.usageMetric}
        onUsageMetricChange={input.onUsageMetricChange}
        usageWorkspaceId={input.usageWorkspaceId}
        usageWorkspaceOptions={input.usageWorkspaceOptions}
        onUsageWorkspaceChange={input.onUsageWorkspaceChange}
        onSelectThread={input.onSelectHomeThread}
        onOpenMissionTarget={(target) => openMissionTarget(target, "home")}
        onSend={input.onSend}
        onQueue={input.onQueue}
        onSendToWorkspace={input.onSendToWorkspace}
        onQueueToWorkspace={input.onQueueToWorkspace}
        workspaces={input.workspaces}
        activeWorkspaceId={input.activeWorkspaceId}
        onSelectWorkspace={input.onSelectWorkspace}
        steerEnabled={input.steerEnabled}
        collaborationModes={input.collaborationModes}
        selectedCollaborationModeId={input.selectedCollaborationModeId}
        onSelectCollaborationMode={input.onSelectCollaborationMode}
        models={input.models}
        selectedModelId={input.selectedModelId}
        onSelectModel={(modelId) => input.onSelectModel(modelId)}
        reasoningOptions={input.reasoningOptions}
        selectedEffort={input.selectedEffort}
        onSelectEffort={(effort) => input.onSelectEffort(effort)}
        fastModeEnabled={input.fastModeEnabled}
        onToggleFastMode={input.onToggleFastMode}
        reasoningSupported={input.reasoningSupported}
        accessMode={input.accessMode}
        onSelectAccessMode={input.onSelectAccessMode}
        executionOptions={input.executionOptions}
        selectedExecutionMode={input.selectedExecutionMode}
        onSelectExecutionMode={input.onSelectExecutionMode}
        remoteBackendOptions={input.remoteBackendOptions}
        selectedRemoteBackendId={input.selectedRemoteBackendId}
        onSelectRemoteBackendId={input.onSelectRemoteBackendId}
        resolvedRemotePlacement={input.resolvedRemotePlacement}
        autoDrive={input.autoDrive ?? null}
        skills={input.skills}
        prompts={input.prompts}
        files={input.files}
        reviewPrompt={input.reviewPrompt}
        onReviewPromptClose={input.onReviewPromptClose}
        onReviewPromptShowPreset={input.onReviewPromptShowPreset}
        onReviewPromptChoosePreset={input.onReviewPromptChoosePreset}
        highlightedPresetIndex={input.highlightedPresetIndex}
        onReviewPromptHighlightPreset={input.onReviewPromptHighlightPreset}
        highlightedBranchIndex={input.highlightedBranchIndex}
        onReviewPromptHighlightBranch={input.onReviewPromptHighlightBranch}
        highlightedCommitIndex={input.highlightedCommitIndex}
        onReviewPromptHighlightCommit={input.onReviewPromptHighlightCommit}
        onReviewPromptKeyDown={input.onReviewPromptKeyDown}
        onReviewPromptSelectBranch={input.onReviewPromptSelectBranch}
        onReviewPromptSelectBranchAtIndex={input.onReviewPromptSelectBranchAtIndex}
        onReviewPromptConfirmBranch={input.onReviewPromptConfirmBranch}
        onReviewPromptSelectCommit={input.onReviewPromptSelectCommit}
        onReviewPromptSelectCommitAtIndex={input.onReviewPromptSelectCommitAtIndex}
        onReviewPromptConfirmCommit={input.onReviewPromptConfirmCommit}
        onReviewPromptUpdateCustomInstructions={input.onReviewPromptUpdateCustomInstructions}
        onReviewPromptConfirmCustom={input.onReviewPromptConfirmCustom}
        approvals={input.approvals}
        userInputRequests={input.userInputRequests}
        sidebarCollapsed={input.sidebarCollapsed}
        onExpandSidebar={input.onExpandSidebar}
      />
    </Suspense>
  );

  const missionLatestMessageByThread = new Map(
    input.latestAgentRuns.map((run) => [run.threadId, run.message])
  );
  const missionThreads = activeWorkspace
    ? (input.threadsByWorkspace[activeWorkspace.id] ?? [])
        .slice()
        .sort((left, right) => right.updatedAt - left.updatedAt)
    : [];
  const missionOverviewCounts =
    activeWorkspace && input.missionControlProjection
      ? buildMissionOverviewCountsFromProjection(input.missionControlProjection, activeWorkspace.id)
      : missionThreads.reduce(
          (counts, thread) => {
            const state = mapThreadVisualStateToMissionOverviewState(
              resolveThreadVisualState(sidebarThreadStatusById[thread.id])
            );
            if (state === "running") counts.active += 1;
            else if (state === "needsAction") counts.needsAction += 1;
            else if (state === "reviewReady") counts.reviewReady += 1;
            else counts.ready += 1;
            return counts;
          },
          { active: 0, needsAction: 0, reviewReady: 0, ready: 0 }
        );
  const missionOverviewNode = activeWorkspace ? (
    <Suspense fallback={null}>
      <LazyMissionOverviewPanel
        workspaceName={activeWorkspace.name}
        counts={missionOverviewCounts}
        items={
          input.missionControlProjection
            ? buildMissionOverviewItemsFromProjection(input.missionControlProjection, {
                workspaceId: activeWorkspace.id,
                activeThreadId: input.activeThreadId,
                limit: 6,
              })
            : missionThreads.slice(0, 6).map((thread) => ({
                threadId: thread.id,
                title: thread.name?.trim() || "Untitled mission",
                summary: missionLatestMessageByThread.get(thread.id) ?? null,
                operatorSignal: null,
                governanceSummary: null,
                routeDetail: null,
                operatorActionLabel: "Open mission",
                operatorActionDetail: null,
                operatorActionTarget: {
                  kind: "thread" as const,
                  workspaceId: activeWorkspace.id,
                  threadId: thread.id,
                },
                attentionSignals: [],
                updatedAt: thread.updatedAt,
                state: mapThreadVisualStateToMissionOverviewState(
                  resolveThreadVisualState(sidebarThreadStatusById[thread.id])
                ),
                isActive: thread.id === input.activeThreadId,
                navigationTarget: {
                  kind: "thread" as const,
                  workspaceId: activeWorkspace.id,
                  threadId: thread.id,
                },
                secondaryLabel: null,
              }))
        }
        freshness={input.missionControlFreshness ?? null}
        onRefresh={input.onRefreshMissionControl}
        onSelectMission={(threadId) => input.onSelectThread(activeWorkspace.id, threadId)}
        onOpenMissionTarget={(target) => openMissionTarget(target, "missions")}
      />
    </Suspense>
  ) : null;

  const desktopHeaderActionsNode = activeWorkspace ? (
    <MainHeaderRightActions
      path={activeWorkspace.path}
      openTargets={input.openAppTargets}
      openAppIconById={input.openAppIconById}
      selectedOpenAppId={input.selectedOpenAppId}
      onSelectOpenAppId={input.onSelectOpenAppId}
      canCopyThread={input.activeItems.length > 0}
      onCopyThread={input.onCopyThread}
      onToggleTerminal={input.onToggleTerminal}
      isTerminalOpen={input.terminalOpen}
      showTerminalButton={input.showTerminalButton}
      showWorkspaceTools={input.showWorkspaceTools}
      launchScript={input.launchScript}
      launchScriptEditorOpen={input.launchScriptEditorOpen}
      launchScriptDraft={input.launchScriptDraft}
      launchScriptSaving={input.launchScriptSaving}
      launchScriptError={input.launchScriptError}
      onRunLaunchScript={input.onRunLaunchScript}
      onOpenLaunchScriptEditor={input.onOpenLaunchScriptEditor}
      onCloseLaunchScriptEditor={input.onCloseLaunchScriptEditor}
      onLaunchScriptDraftChange={input.onLaunchScriptDraftChange}
      onSaveLaunchScript={input.onSaveLaunchScript}
      launchScriptsState={input.launchScriptsState}
      extraActionsNode={input.mainHeaderActionsNode}
    />
  ) : null;

  const mainHeaderNode = activeWorkspace ? (
    <Suspense fallback={null}>
      <LazyMainHeader
        workspace={activeWorkspace}
        worktreeLabel={input.worktreeLabel}
        worktreeRename={input.worktreeRename}
        disableBranchMenu={input.isWorktreeWorkspace}
        parentPath={input.activeParentWorkspace?.path ?? null}
        worktreePath={input.isWorktreeWorkspace ? activeWorkspace.path : null}
        openTargets={input.openAppTargets}
        openAppIconById={input.openAppIconById}
        selectedOpenAppId={input.selectedOpenAppId}
        onSelectOpenAppId={input.onSelectOpenAppId}
        branchName={input.branchName}
        canManageBranches={Boolean(input.activeWorkspace?.connected) && !input.gitStatus.error}
        onRefreshGitStatus={input.onRefreshGitStatus}
        canCopyThread={input.activeItems.length > 0}
        onCopyThread={input.onCopyThread}
        onToggleTerminal={input.onToggleTerminal}
        isTerminalOpen={input.terminalOpen}
        showTerminalButton={input.showTerminalButton}
        showWorkspaceTools={input.showWorkspaceTools}
        launchScript={input.launchScript}
        launchScriptEditorOpen={input.launchScriptEditorOpen}
        launchScriptDraft={input.launchScriptDraft}
        launchScriptSaving={input.launchScriptSaving}
        launchScriptError={input.launchScriptError}
        onRunLaunchScript={input.onRunLaunchScript}
        onOpenLaunchScriptEditor={input.onOpenLaunchScriptEditor}
        onCloseLaunchScriptEditor={input.onCloseLaunchScriptEditor}
        onLaunchScriptDraftChange={input.onLaunchScriptDraftChange}
        onSaveLaunchScript={input.onSaveLaunchScript}
        launchScriptsState={input.launchScriptsState}
        recentThreads={recentThreads}
        onSelectRecentThread={(threadId) => input.onSelectThread(activeWorkspace.id, threadId)}
        extraActionsNode={input.mainHeaderActionsNode}
        renderHeaderActions={input.isPhone}
      />
    </Suspense>
  ) : null;

  const desktopTopbarRightNode = desktopHeaderActionsNode;

  const desktopTopbarLeftNode = (
    <>
      {input.centerMode === "diff" && (
        <Button
          variant="ghost"
          size="icon"
          className="back-button"
          onClick={input.onExitDiff}
          aria-label="Back to chat"
        >
          <ArrowLeft aria-hidden />
        </Button>
      )}
      {mainHeaderNode}
    </>
  );

  const tabBarNode = (
    <TabBar
      activeTab={input.activeTab}
      hasActiveWorkspace={Boolean(input.activeWorkspace)}
      onSelect={input.onSelectTab}
    />
  );

  return {
    approvalToastsNode,
    updateToastNode,
    errorToastsNode,
    homeNode,
    missionOverviewNode,
    mainHeaderNode,
    desktopTopbarLeftNode,
    desktopTopbarRightNode,
    tabBarNode,
  };
}
