// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createLayoutNodesOptions,
  type LayoutNodesFieldRegistry,
  type LayoutNodesOptions,
} from "./types";

const GIT_NODES_LAZY_BOUNDARY_TIMEOUT_MS = 60_000;

function mockGitDiffViewerChunk() {
  vi.doMock("../../../utils/diffsWorker", () => ({
    workerFactory: () =>
      ({
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        postMessage: vi.fn(),
        terminate: vi.fn(),
      }) satisfies Partial<Worker>,
  }));

  vi.doMock("../../../git/components/GitDiffViewer", () => ({
    GitDiffViewer: () => <div data-testid="git-diff-viewer-chunk" />,
  }));
}

function createGitOptions(overrides: Partial<LayoutNodesFieldRegistry> = {}): LayoutNodesOptions {
  return createLayoutNodesOptions({
    activeTab: "missions",
    centerMode: "chat",
    activeWorkspace: null,
    missionControlProjection: null,
    activeRepositoryExecutionContract: null,
    missionControlFreshness: null,
    reviewPackSelection: null,
    reviewPackDecisionSubmission: null,
    reviewInterventionBackendOptions: [],
    reviewInterventionDefaultBackendId: null,
    reviewInterventionLaunchError: null,
    gitStatus: {
      branchName: "main",
      stagedFiles: [],
      unstagedFiles: [],
      totalAdditions: 0,
      totalDeletions: 0,
      error: null,
    },
    fileTreeLoading: false,
    files: [],
    openAppTargets: [],
    openAppIconById: {},
    selectedOpenAppId: "",
    prompts: [],
    canRevealGeneralPrompts: false,
    filePanelMode: "git",
    gitPanelMode: "diff",
    fileStatus: null,
    selectedDiffPath: null,
    diffScrollRequestId: 0,
    gitLogEntries: [],
    gitLogTotal: 0,
    gitLogAhead: 0,
    gitLogBehind: 0,
    gitLogAheadEntries: [],
    gitLogBehindEntries: [],
    gitLogUpstream: null,
    selectedCommitSha: null,
    gitLogError: null,
    gitLogLoading: false,
    gitIssues: [],
    gitIssuesTotal: 0,
    gitIssuesLoading: false,
    gitIssuesError: null,
    gitPullRequests: [],
    gitPullRequestsTotal: 0,
    gitPullRequestsLoading: false,
    gitPullRequestsError: null,
    selectedPullRequestNumber: null,
    selectedPullRequest: null,
    selectedPullRequestComments: [],
    selectedPullRequestCommentsLoading: false,
    selectedPullRequestCommentsError: null,
    gitRemoteUrl: null,
    gitRoot: null,
    gitRootCandidates: [],
    gitRootScanDepth: 2,
    gitRootScanLoading: false,
    gitRootScanError: null,
    gitRootScanHasScanned: false,
    diffSource: "local",
    gitDiffs: [],
    gitDiffLoading: false,
    gitDiffError: null,
    gitDiffViewStyle: "split",
    gitDiffIgnoreWhitespaceChanges: false,
    isPhone: false,
    commitsAhead: 0,
    commitMessage: "",
    commitMessageLoading: false,
    commitMessageError: null,
    worktreeApplyTitle: null,
    worktreeApplyLoading: false,
    worktreeApplyError: null,
    worktreeApplySuccess: false,
    onSelectWorkspace: vi.fn(),
    onSelectThread: vi.fn(),
    onSelectTab: vi.fn(),
    onOpenReviewPack: vi.fn(),
    onRefreshMissionControl: vi.fn(),
    onSubmitReviewPackDecision: vi.fn(),
    onLaunchReviewInterventionDraft: vi.fn(),
    onRunReviewAgent: vi.fn(),
    onApplyReviewAutofix: vi.fn(),
    onInsertComposerText: vi.fn(),
    canInsertComposerText: false,
    onSelectOpenAppId: vi.fn(),
    onFilePanelModeChange: vi.fn(),
    onSendPrompt: vi.fn(),
    onSendPromptToNewAgent: vi.fn(),
    onCreatePrompt: vi.fn(),
    onUpdatePrompt: vi.fn(),
    onDeletePrompt: vi.fn(),
    onMovePrompt: vi.fn(),
    onRevealWorkspacePrompts: vi.fn(),
    onRevealGeneralPrompts: vi.fn(),
    onGitPanelModeChange: vi.fn(),
    onApplyWorktreeChanges: vi.fn(),
    onSelectDiff: vi.fn(),
    onSelectCommit: vi.fn(),
    onStartTaskFromGitHubIssue: vi.fn(),
    onDelegateGitHubIssue: vi.fn(),
    onStartTaskFromGitHubPullRequest: vi.fn(),
    onSelectPullRequest: vi.fn(),
    onDelegateGitHubPullRequest: vi.fn(),
    onGitRootScanDepthChange: vi.fn(),
    onScanGitRoots: vi.fn(),
    onSelectGitRoot: vi.fn(),
    onClearGitRoot: vi.fn(),
    onPickGitRoot: vi.fn(),
    onStageGitAll: vi.fn(),
    onStageGitFile: vi.fn(),
    onUnstageGitFile: vi.fn(),
    onRevertGitFile: vi.fn(),
    onRevertAllGitChanges: vi.fn(),
    onDiffActivePathChange: vi.fn(),
    onCommitMessageChange: vi.fn(),
    onGenerateCommitMessage: vi.fn(),
    onCommit: vi.fn(),
    onCommitAndPush: vi.fn(),
    onCommitAndSync: vi.fn(),
    onPull: vi.fn(),
    onFetch: vi.fn(),
    onPush: vi.fn(),
    onSync: vi.fn(),
    ...overrides,
  } as unknown as LayoutNodesFieldRegistry);
}

async function importBuildGitNodes() {
  const { buildGitNodes: importedBuildGitNodes } = await import("./buildGitNodes");
  return importedBuildGitNodes;
}

describe("buildGitNodes diff lazy boundary", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(async () => {
    cleanup();
    vi.clearAllMocks();
    vi.doUnmock("../../../git/components/GitDiffViewer");
    vi.doUnmock("../../../utils/diffsWorker");
    await vi.dynamicImportSettled();
  });

  it(
    "keeps the lightweight placeholder on empty diff state without loading the viewer chunk",
    async () => {
      const buildGitNodesImpl = await importBuildGitNodes();
      const nodes = buildGitNodesImpl(createGitOptions());

      expect(nodes.hasGitDiffViewerContent).toBe(false);
      render(<div>{nodes.gitDiffViewerNode}</div>);

      expect(screen.getByText("Repository not selected")).toBeTruthy();
      expect(screen.queryByTestId("git-diff-viewer-chunk")).toBeNull();
    },
    GIT_NODES_LAZY_BOUNDARY_TIMEOUT_MS
  );

  it(
    "loads the viewer chunk once actual diff payload exists",
    async () => {
      mockGitDiffViewerChunk();

      const buildGitNodesImpl = await importBuildGitNodes();
      const nodes = buildGitNodesImpl(
        createGitOptions({
          gitRoot: "/tmp/repo",
          gitDiffs: [
            {
              path: "src/app.ts",
              status: "modified",
              diff: "diff --git a/src/app.ts b/src/app.ts\n--- a/src/app.ts\n+++ b/src/app.ts\n@@ -1 +1 @@\n-old\n+new",
            },
          ],
        })
      );

      expect(nodes.hasGitDiffViewerContent).toBe(true);
      render(<div>{nodes.gitDiffViewerNode}</div>);

      expect(
        await screen.findByTestId("git-diff-viewer-chunk", undefined, {
          timeout: GIT_NODES_LAZY_BOUNDARY_TIMEOUT_MS,
        })
      ).toBeTruthy();
    },
    GIT_NODES_LAZY_BOUNDARY_TIMEOUT_MS
  );

  it("builds review-surface selections with the review_surface source", async () => {
    const { buildReviewSurfaceSelectionRequest } = await import("./buildGitNodes");

    expect(
      buildReviewSurfaceSelectionRequest({
        workspaceId: "workspace-1",
        taskId: "task-1",
        runId: "run-1",
        reviewPackId: "review-pack-1",
      })
    ).toEqual({
      workspaceId: "workspace-1",
      taskId: "task-1",
      runId: "run-1",
      reviewPackId: "review-pack-1",
      source: "review_surface",
    });
  });
});
