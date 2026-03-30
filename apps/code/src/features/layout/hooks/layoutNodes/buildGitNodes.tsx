import { lazy, Suspense } from "react";
import { Text } from "../../../../design-system";
import { GitDiffViewerPlaceholder } from "../../../git/components/GitDiffViewerPlaceholder";
import { resolveBranchDisplayLabel } from "../../../git/utils/branchLabels";
import { type MissionNavigationTarget } from "../../../missions/utils/missionControlPresentation";
import { openMissionTargetFromDesktopShell } from "../../../missions/utils/missionNavigation";
import type {
  ReviewPackSelectionRequest,
  ReviewPackSelectionSource,
} from "../../../review/utils/reviewPackSurfaceModel";
import {
  flattenLayoutNodesOptions,
  type LayoutNodesOptions,
  type LayoutNodesResult,
} from "./types";
import * as loadingStyles from "./buildGitNodesLoading.css";

type GitLayoutNodes = Pick<
  LayoutNodesResult,
  | "gitDiffPanelNode"
  | "gitDiffViewerNode"
  | "hasGitDiffViewerContent"
  | "rightPanelGitNode"
  | "rightPanelFilesNode"
  | "rightPanelPromptsNode"
>;
const LazyFileTreePanel = lazy(async () => {
  const module = await import("../../../files/components/FileTreePanel");
  return { default: module.FileTreePanel };
});
const LazyPromptPanel = lazy(async () => {
  const module = await import("../../../prompts/components/PromptPanel");
  return { default: module.PromptPanel };
});
const LazyGitDiffPanel = lazy(async () => {
  const module = await import("../../../git/components/GitDiffPanel");
  return { default: module.GitDiffPanel };
});

const LazyGitDiffViewer = lazy(async () => {
  const module = await import("../../../git/components/GitDiffViewer");
  return { default: module.GitDiffViewer };
});
const LazyReviewQueuePanel = lazy(async () => {
  const module = await import("../../../review/components/ReviewQueuePanelFromProjection");
  return { default: module.ReviewQueuePanelFromProjection };
});
const LazyReviewPackSurface = lazy(async () => {
  const module = await import("../../../review/components/ReviewPackSurfaceFromProjection");
  return { default: module.ReviewPackSurfaceFromProjection };
});

export function buildReviewSurfaceSelectionRequest(input: {
  workspaceId: string;
  taskId: string;
  runId: string;
  reviewPackId: string;
}): ReviewPackSelectionRequest {
  return {
    workspaceId: input.workspaceId,
    taskId: input.taskId,
    runId: input.runId,
    reviewPackId: input.reviewPackId,
    source: "review_surface",
  };
}

function GitPanelLoadingFallback() {
  return (
    <RailLoadingState
      title="Loading Git workspace"
      subtitle="Preparing branch status, staged changes, commits, issues, and pull requests."
    />
  );
}

function GitDiffViewerLoadingFallback() {
  return (
    <RailLoadingState
      title="Loading diff review"
      subtitle="Resolving selected file patches and inline review context."
    />
  );
}

function GitSidePanelLoadingFallback() {
  return (
    <RailLoadingState
      title="Loading workspace surface"
      subtitle="Collecting files, prompt commands, and repo-adjacent context."
    />
  );
}

function ReviewPanelLoadingFallback() {
  return (
    <RailLoadingState
      title="Loading review surface"
      subtitle="Hydrating queued review packs and decision context."
    />
  );
}

function RailLoadingState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className={loadingStyles.shell} aria-live="polite" aria-busy="true">
      <div className={loadingStyles.header}>
        <Text as="div" className={loadingStyles.eyebrow}>
          Loading
        </Text>
        <div className={loadingStyles.copy}>
          <Text as="div" className={loadingStyles.title}>
            {title}
          </Text>
          <Text as="div" className={loadingStyles.subtitle}>
            {subtitle}
          </Text>
        </div>
      </div>
      <div className={loadingStyles.block}>
        <div className={loadingStyles.heroLine} aria-hidden />
        <div className={loadingStyles.metaRow} aria-hidden>
          <div className={loadingStyles.metaPill} />
          <div className={`${loadingStyles.metaPill} ${loadingStyles.metaPillWide}`} />
          <div className={loadingStyles.metaPill} />
        </div>
        <div className={loadingStyles.rowList}>
          <div className={loadingStyles.row}>
            <div className={loadingStyles.dot} aria-hidden />
            <div className={`${loadingStyles.line} ${loadingStyles.lineWidth.long}`} aria-hidden />
          </div>
          <div className={loadingStyles.row}>
            <div className={loadingStyles.dot} aria-hidden />
            <div
              className={`${loadingStyles.line} ${loadingStyles.lineWidth.medium}`}
              aria-hidden
            />
          </div>
          <div className={loadingStyles.row}>
            <div className={loadingStyles.dot} aria-hidden />
            <div className={`${loadingStyles.line} ${loadingStyles.lineWidth.short}`} aria-hidden />
          </div>
        </div>
        <div className={loadingStyles.footer}>
          <div className={`${loadingStyles.line} ${loadingStyles.lineWidth.medium}`} aria-hidden />
          <div className={`${loadingStyles.line} ${loadingStyles.lineWidth.short}`} aria-hidden />
        </div>
      </div>
    </div>
  );
}

export function buildGitNodes(options: LayoutNodesOptions): GitLayoutNodes {
  const input = flattenLayoutNodesOptions(options);
  const isReviewSurfaceActive = input.activeTab === "review";
  const sidebarSelectedDiffPath = input.centerMode === "diff" ? input.selectedDiffPath : null;
  const openMissionTarget = (
    target: MissionNavigationTarget,
    source: Exclude<
      ReviewPackSelectionSource,
      "home" | "missions" | "sidebar" | "approval_toast" | "system"
    >
  ) => {
    openMissionTargetFromDesktopShell({
      target,
      source,
      onOpenReviewPack: input.onOpenReviewPack,
      onSelectWorkspace: input.onSelectWorkspace,
      onSelectThread: input.onSelectThread,
      onSelectReviewTab: () => input.onSelectTab("review"),
      onSelectThreadTab: () => input.onSelectTab("missions"),
    });
  };
  const reviewQueueNode =
    input.missionControlProjection && input.activeWorkspace ? (
      <Suspense fallback={<ReviewPanelLoadingFallback />}>
        <LazyReviewQueuePanel
          workspaceName={input.activeWorkspace.name}
          projection={input.missionControlProjection}
          workspaceId={input.activeWorkspace.id}
          repositoryExecutionContract={input.activeRepositoryExecutionContract ?? null}
          limit={8}
          freshness={input.missionControlFreshness ?? null}
          onRefresh={input.onRefreshMissionControl}
          onOpenMissionTarget={(target) => openMissionTarget(target, "review_queue")}
        />
      </Suspense>
    ) : null;

  const reviewSurfaceNode = input.activeWorkspace ? (
    <Suspense fallback={<ReviewPanelLoadingFallback />}>
      <LazyReviewPackSurface
        workspaceName={input.activeWorkspace.name}
        projection={input.missionControlProjection ?? null}
        workspaceId={input.activeWorkspace.id}
        selection={input.reviewPackSelection}
        repositoryExecutionContract={input.activeRepositoryExecutionContract ?? null}
        runtimeReviewPack={input.runtimeReviewPack ?? null}
        freshness={input.missionControlFreshness ?? null}
        onRefresh={input.onRefreshMissionControl}
        decisionSubmission={input.reviewPackDecisionSubmission ?? null}
        onSelectReviewPack={(entry) => {
          input.onOpenReviewPack(
            buildReviewSurfaceSelectionRequest({
              workspaceId: entry.workspaceId,
              taskId: entry.taskId,
              runId: entry.runId,
              reviewPackId: entry.id,
            })
          );
        }}
        onOpenMissionTarget={(target) => openMissionTarget(target, "review_surface")}
        onSubmitDecisionAction={input.onSubmitReviewPackDecision}
        interventionBackendOptions={input.reviewInterventionBackendOptions ?? []}
        defaultInterventionBackendId={input.reviewInterventionDefaultBackendId ?? null}
        interventionLaunchError={input.reviewInterventionLaunchError ?? null}
        onLaunchInterventionDraft={input.onLaunchReviewInterventionDraft}
        onRunReviewAgent={input.onRunReviewAgent}
        onApplyReviewAutofix={input.onApplyReviewAutofix}
      />
    </Suspense>
  ) : null;

  const buildModifiedFiles = () => [
    ...new Set([
      ...input.gitStatus.stagedFiles.map((file) => file.path),
      ...input.gitStatus.unstagedFiles.map((file) => file.path),
    ]),
  ];

  const renderFilesPanel = () =>
    input.activeWorkspace ? (
      <Suspense fallback={<GitSidePanelLoadingFallback />}>
        <LazyFileTreePanel
          workspaceId={input.activeWorkspace.id}
          workspacePath={input.activeWorkspace.path}
          files={input.files}
          modifiedFiles={buildModifiedFiles()}
          isLoading={input.fileTreeLoading}
          filePanelMode="files"
          onFilePanelModeChange={input.onFilePanelModeChange}
          showPanelTabs={false}
          onInsertText={input.onInsertComposerText}
          canInsertText={input.canInsertComposerText}
          openTargets={input.openAppTargets}
          openAppIconById={input.openAppIconById}
          selectedOpenAppId={input.selectedOpenAppId}
          onSelectOpenAppId={input.onSelectOpenAppId}
        />
      </Suspense>
    ) : null;

  const renderPromptsPanel = () => (
    <Suspense fallback={<GitSidePanelLoadingFallback />}>
      <LazyPromptPanel
        prompts={input.prompts}
        workspacePath={input.activeWorkspace?.path ?? null}
        filePanelMode="prompts"
        onFilePanelModeChange={input.onFilePanelModeChange}
        showPanelTabs={false}
        onSendPrompt={input.onSendPrompt}
        onSendPromptToNewAgent={input.onSendPromptToNewAgent}
        onCreatePrompt={input.onCreatePrompt}
        onUpdatePrompt={input.onUpdatePrompt}
        onDeletePrompt={input.onDeletePrompt}
        onMovePrompt={input.onMovePrompt}
        onRevealWorkspacePrompts={input.onRevealWorkspacePrompts}
        onRevealGeneralPrompts={input.onRevealGeneralPrompts}
        canRevealGeneralPrompts={input.canRevealGeneralPrompts}
      />
    </Suspense>
  );

  const renderGitPanel = () => (
    <Suspense fallback={<GitPanelLoadingFallback />}>
      <LazyGitDiffPanel
        workspaceId={input.activeWorkspace?.id ?? null}
        workspacePath={input.activeWorkspace?.path ?? null}
        mode="diff"
        onModeChange={input.onGitPanelModeChange}
        filePanelMode="git"
        onFilePanelModeChange={input.onFilePanelModeChange}
        showPanelTabs={false}
        showModeSelect={false}
        integratedRail
        worktreeApplyLabel={input.worktreeApplyLabel}
        worktreeApplyTitle={input.worktreeApplyTitle}
        worktreeApplyLoading={input.worktreeApplyLoading}
        worktreeApplyError={input.worktreeApplyError}
        worktreeApplySuccess={input.worktreeApplySuccess}
        onApplyWorktreeChanges={input.onApplyWorktreeChanges}
        branchName={resolveBranchDisplayLabel({
          branchName: input.gitStatus.branchName,
          hasBranchContext: Boolean(input.activeWorkspace?.connected) && !input.gitStatus.error,
          context: "panel",
        })}
        totalAdditions={input.gitStatus.totalAdditions}
        totalDeletions={input.gitStatus.totalDeletions}
        fileStatus={input.fileStatus}
        error={input.gitStatus.error}
        logError={input.gitLogError}
        logLoading={input.gitLogLoading}
        stagedFiles={input.gitStatus.stagedFiles}
        unstagedFiles={input.gitStatus.unstagedFiles}
        onSelectFile={input.onSelectDiff}
        selectedPath={sidebarSelectedDiffPath}
        logEntries={input.gitLogEntries}
        logTotal={input.gitLogTotal}
        logAhead={input.gitLogAhead}
        logBehind={input.gitLogBehind}
        logAheadEntries={input.gitLogAheadEntries}
        logBehindEntries={input.gitLogBehindEntries}
        logUpstream={input.gitLogUpstream}
        selectedCommitSha={input.selectedCommitSha}
        onSelectCommit={input.onSelectCommit}
        issues={input.gitIssues}
        issuesTotal={input.gitIssuesTotal}
        issuesLoading={input.gitIssuesLoading}
        issuesError={input.gitIssuesError}
        onStartTaskFromGitHubIssue={input.onStartTaskFromGitHubIssue}
        getGitHubIssueFollowUpPreview={input.getGitHubIssueFollowUpPreview}
        onStartTaskFromGitHubIssueFollowUp={input.onStartTaskFromGitHubIssueFollowUp}
        onDelegateGitHubIssue={input.onDelegateGitHubIssue}
        pullRequests={input.gitPullRequests}
        pullRequestsTotal={input.gitPullRequestsTotal}
        pullRequestsLoading={input.gitPullRequestsLoading}
        pullRequestsError={input.gitPullRequestsError}
        onStartTaskFromGitHubPullRequest={input.onStartTaskFromGitHubPullRequest}
        getGitHubPullRequestFollowUpPreview={input.getGitHubPullRequestFollowUpPreview}
        selectedPullRequest={input.selectedPullRequestNumber}
        onSelectPullRequest={input.onSelectPullRequest}
        onDelegateGitHubPullRequest={input.onDelegateGitHubPullRequest}
        gitRemoteUrl={input.gitRemoteUrl}
        gitRoot={input.gitRoot}
        gitRootCandidates={input.gitRootCandidates}
        gitRootScanDepth={input.gitRootScanDepth}
        gitRootScanLoading={input.gitRootScanLoading}
        gitRootScanError={input.gitRootScanError}
        gitRootScanHasScanned={input.gitRootScanHasScanned}
        onGitRootScanDepthChange={input.onGitRootScanDepthChange}
        onScanGitRoots={input.onScanGitRoots}
        onSelectGitRoot={input.onSelectGitRoot}
        onClearGitRoot={input.onClearGitRoot}
        onPickGitRoot={input.onPickGitRoot}
        onStageAllChanges={input.onStageGitAll}
        onStageFile={input.onStageGitFile}
        onUnstageFile={input.onUnstageGitFile}
        onRevertFile={input.onRevertGitFile}
        onRevertAllChanges={input.onRevertAllGitChanges}
        commitMessage={input.commitMessage}
        commitMessageLoading={input.commitMessageLoading}
        commitMessageError={input.commitMessageError}
        onCommitMessageChange={input.onCommitMessageChange}
        onGenerateCommitMessage={input.onGenerateCommitMessage}
        onCommit={input.onCommit}
        onCommitAndPush={input.onCommitAndPush}
        onCommitAndSync={input.onCommitAndSync}
        onPull={input.onPull}
        onFetch={input.onFetch}
        onPush={input.onPush}
        onSync={input.onSync}
        commitLoading={input.commitLoading}
        pullLoading={input.pullLoading}
        fetchLoading={input.fetchLoading}
        pushLoading={input.pushLoading}
        syncLoading={input.syncLoading}
        commitError={input.commitError}
        pullError={input.pullError}
        fetchError={input.fetchError}
        pushError={input.pushError}
        syncError={input.syncError}
        commitsAhead={input.commitsAhead}
      />
    </Suspense>
  );

  let gitDiffPanelNode: GitLayoutNodes["gitDiffPanelNode"];
  let rightPanelGitNode: GitLayoutNodes["rightPanelGitNode"] = null;
  let rightPanelFilesNode: GitLayoutNodes["rightPanelFilesNode"] = null;
  let rightPanelPromptsNode: GitLayoutNodes["rightPanelPromptsNode"] = null;
  if (isReviewSurfaceActive) {
    gitDiffPanelNode = reviewSurfaceNode;
    rightPanelGitNode = reviewSurfaceNode;
  } else if (input.filePanelMode === "files" && input.activeWorkspace) {
    gitDiffPanelNode = renderFilesPanel();
  } else if (input.filePanelMode === "prompts") {
    gitDiffPanelNode = renderPromptsPanel();
  } else {
    gitDiffPanelNode = (
      <>
        {reviewQueueNode}
        {renderGitPanel()}
      </>
    );
  }

  if (!isReviewSurfaceActive) {
    rightPanelGitNode = renderGitPanel();
    rightPanelFilesNode = renderFilesPanel();
    rightPanelPromptsNode = renderPromptsPanel();
  }

  const hasDiffViewerPayload = input.gitDiffs.length > 0 || Boolean(input.selectedPullRequest);
  const hasGitDiffViewerContent = !isReviewSurfaceActive && hasDiffViewerPayload;
  const gitDiffViewerNode = isReviewSurfaceActive ? null : hasDiffViewerPayload ? (
    <Suspense fallback={<GitDiffViewerLoadingFallback />}>
      <LazyGitDiffViewer
        diffs={input.gitDiffs}
        selectedPath={input.selectedDiffPath}
        scrollRequestId={input.diffScrollRequestId}
        isLoading={input.gitDiffLoading}
        error={input.gitDiffError}
        hasRepositoryContext={Boolean(input.gitRoot)}
        diffStyle={input.isPhone ? "unified" : input.gitDiffViewStyle}
        ignoreWhitespaceChanges={input.gitDiffIgnoreWhitespaceChanges}
        pullRequest={input.selectedPullRequest}
        pullRequestComments={input.selectedPullRequestComments}
        pullRequestCommentsLoading={input.selectedPullRequestCommentsLoading}
        pullRequestCommentsError={input.selectedPullRequestCommentsError}
        onStartTaskFromGitHubPullRequestReviewFollowUp={
          input.onStartTaskFromGitHubPullRequestReviewFollowUp
        }
        getGitHubPullRequestReviewFollowUpPreview={input.getGitHubPullRequestReviewFollowUpPreview}
        canRevert={input.diffSource === "local"}
        onRevertFile={input.onRevertGitFile}
        onActivePathChange={input.onDiffActivePathChange}
      />
    </Suspense>
  ) : (
    <GitDiffViewerPlaceholder
      isLoading={input.gitDiffLoading}
      error={input.gitDiffError}
      hasRepositoryContext={Boolean(input.gitRoot)}
    />
  );

  return {
    gitDiffPanelNode,
    gitDiffViewerNode,
    hasGitDiffViewerContent,
    rightPanelGitNode,
    rightPanelFilesNode,
    rightPanelPromptsNode,
  };
}
