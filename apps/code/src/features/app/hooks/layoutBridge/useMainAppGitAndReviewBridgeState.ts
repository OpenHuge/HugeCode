import { useCallback, useEffect, useState } from "react";
import { useRuntimeWorkspaceExecutionPolicy } from "../../../../application/runtime/facades/runtimeWorkspaceExecutionPolicyFacade";
import {
  applyReviewAutofix,
  runReviewAgent,
} from "../../../../application/runtime/facades/runtimeReviewIntelligenceActions";
import { useRuntimeReviewPackRuntimeTruth } from "../../../../application/runtime/facades/runtimeReviewPackRuntimeTruth";
import type { MissionInterventionDraft } from "../../../../application/runtime/facades/runtimeTaskInterventionDraftFacade";
import { useWorkspaceRuntimeAgentControl } from "../../../../application/runtime/ports/runtimeAgentControl";
import {
  getGitHubIssueDetails,
  getGitHubPullRequestComments,
  getGitHubPullRequestDiff,
} from "../../../../application/runtime/ports/git";
import { pushErrorToast } from "../../../../application/runtime/ports/toasts";
import { DEFAULT_RUNTIME_WORKSPACE_ID } from "../../../../utils/runtimeWorkspaceIds";
import type { MissionNavigationTarget } from "../../../missions/utils/missionControlPresentation";
import { useReviewPackDecisionActions } from "../../../review/hooks/useReviewPackDecisionActions";
import { useReviewPackSelectionState } from "../../../review/hooks/useReviewPackSelectionState";
import type { ReviewPackSelectionRequest } from "../../../review/utils/reviewPackSurfaceModel";
import { launchReviewInterventionDraft } from "../reviewInterventionLauncher";
import type { MainAppLayoutGitReviewBridgeDomainInput } from "./types";

type GitHubSourceGovernedLaunchModule =
  typeof import("../../../../application/runtime/facades/githubSourceGovernedLaunch");

type ReviewInterventionBackendOption = {
  value: string;
  label: string;
};

type ReviewInterventionLaunchAck = Awaited<ReturnType<typeof launchReviewInterventionDraft>>;

type GovernedGitHubLaunchRequest =
  | ReturnType<GitHubSourceGovernedLaunchModule["buildGovernedGitHubIssueLaunchRequest"]>
  | ReturnType<GitHubSourceGovernedLaunchModule["buildGovernedGitHubPullRequestLaunchRequest"]>;

async function loadGitHubSourceGovernedLaunch() {
  return import("../../../../application/runtime/facades/githubSourceGovernedLaunch");
}

export function resolveReviewInterventionFollowUpSelection(input: {
  workspaceId: string;
  navigationTarget: MissionNavigationTarget | null;
  ack: ReviewInterventionLaunchAck;
}): ReviewPackSelectionRequest | null {
  const spawnedTaskId = input.ack.spawnedTaskId?.trim() || null;
  if (spawnedTaskId) {
    return {
      workspaceId: input.workspaceId,
      taskId: spawnedTaskId,
      source: "review_surface",
    };
  }
  if (input.navigationTarget?.kind !== "review") {
    return null;
  }
  return {
    workspaceId: input.navigationTarget.workspaceId,
    taskId: input.navigationTarget.taskId,
    runId: input.navigationTarget.runId,
    reviewPackId: input.navigationTarget.reviewPackId,
    source: "review_surface",
  };
}

function resolveReviewAgentSelection(input: {
  workspaceId: string;
  taskId: string;
}): ReviewPackSelectionRequest {
  return {
    workspaceId: input.workspaceId,
    taskId: input.taskId,
    source: "review_surface",
  };
}

export function normalizeReviewInterventionBackendOptions(
  value: unknown
): ReviewInterventionBackendOption[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }
    const record = entry as Record<string, unknown>;
    const backendId =
      typeof record.backendId === "string"
        ? record.backendId.trim()
        : typeof record.backend_id === "string"
          ? record.backend_id.trim()
          : "";
    if (!backendId) {
      return [];
    }
    const label =
      typeof record.displayName === "string"
        ? record.displayName.trim()
        : typeof record.display_name === "string"
          ? record.display_name.trim()
          : typeof record.label === "string"
            ? record.label.trim()
            : "";
    return [
      {
        value: backendId,
        label: label || backendId,
      },
    ];
  });
}

export function useMainAppGitAndReviewBridgeState(input: MainAppLayoutGitReviewBridgeDomainInput) {
  const {
    state: {
      activeWorkspaceId,
      activeWorkspace,
      setActiveWorkspaceId,
      setActiveTab,
      defaultRemoteExecutionBackendId,
      gitRemoteUrl,
      conversationState: { homeState, fileListingState },
      gitPanelState,
      gitHubPanelState,
      gitCommitState,
    },
    actions: {
      onStartTaskFromGitHubIssue,
      getGitHubIssueFollowUpPreview,
      onStartTaskFromGitHubIssueFollowUp,
      onStartTaskFromGitHubPullRequest,
      getGitHubPullRequestFollowUpPreview,
      onStartTaskFromGitHubPullRequestReviewFollowUp,
      getGitHubPullRequestReviewFollowUpPreview,
    },
    reviewPackControllerReady: onReviewPackControllerReady = null,
  } = input;

  const [reviewInterventionBackendOptions, setReviewInterventionBackendOptions] = useState<
    ReviewInterventionBackendOption[]
  >([]);
  const [reviewInterventionLaunchError, setReviewInterventionLaunchError] = useState<string | null>(
    null
  );

  const reviewRuntimeControl = useWorkspaceRuntimeAgentControl(
    (activeWorkspaceId ?? DEFAULT_RUNTIME_WORKSPACE_ID) as Parameters<
      typeof useWorkspaceRuntimeAgentControl
    >[0]
  );
  const {
    repositoryExecutionContract: activeRepositoryExecutionContract,
    repositoryExecutionContractError: activeRepositoryExecutionContractError,
    repositoryExecutionContractStatus: activeRepositoryExecutionContractStatus,
  } = useRuntimeWorkspaceExecutionPolicy(activeWorkspaceId);
  const { reviewPackSelection, openReviewPack } = useReviewPackSelectionState({
    projection: homeState.missionControlProjection ?? null,
    activeWorkspaceId,
  });
  const runtimeReviewPackTruth = useRuntimeReviewPackRuntimeTruth({
    projection: homeState.missionControlProjection ?? null,
    selection: reviewPackSelection,
  });

  useEffect(() => {
    onReviewPackControllerReady?.(openReviewPack);
    return () => {
      onReviewPackControllerReady?.(() => undefined);
    };
  }, [onReviewPackControllerReady, openReviewPack]);

  const { submission: reviewPackDecisionSubmission, submitDecision: submitReviewPackDecision } =
    useReviewPackDecisionActions({
      workspaceId: activeWorkspaceId,
      onRefresh: homeState.refreshMissionControl,
    });

  useEffect(() => {
    const listRuntimeBackends = reviewRuntimeControl.runtimeBackendsList;
    if (!listRuntimeBackends || !activeWorkspaceId) {
      setReviewInterventionBackendOptions([]);
      return;
    }
    let cancelled = false;
    void listRuntimeBackends(activeWorkspaceId)
      .then((result) => {
        if (!cancelled) {
          setReviewInterventionBackendOptions(normalizeReviewInterventionBackendOptions(result));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReviewInterventionBackendOptions([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, reviewRuntimeControl]);

  const handleLaunchReviewInterventionDraft = useCallback(
    async (launchInput: {
      workspaceId: string;
      navigationTarget: MissionNavigationTarget | null;
      draft: MissionInterventionDraft;
    }) => {
      setReviewInterventionLaunchError(null);
      try {
        const ack = await launchReviewInterventionDraft({
          draft: launchInput.draft,
          runtimeControl: reviewRuntimeControl,
          onRefresh: homeState.refreshMissionControl,
        });
        const followUpSelection = resolveReviewInterventionFollowUpSelection({
          workspaceId: launchInput.workspaceId,
          navigationTarget: launchInput.navigationTarget,
          ack,
        });
        if (followUpSelection) {
          openReviewPack(followUpSelection);
          setActiveWorkspaceId(followUpSelection.workspaceId);
          setActiveTab("review");
        }
      } catch (error) {
        setReviewInterventionLaunchError(error instanceof Error ? error.message : String(error));
        throw error;
      }
    },
    [
      homeState.refreshMissionControl,
      openReviewPack,
      reviewRuntimeControl,
      setActiveTab,
      setActiveWorkspaceId,
    ]
  );

  const handleRunReviewAgent = useCallback(
    async (runInput: {
      workspaceId: string;
      taskId: string;
      runId: string;
      reviewPackId?: string | null;
    }) => {
      const projection = homeState.missionControlProjection;
      const run =
        projection?.runs.find(
          (entry) =>
            entry.workspaceId === runInput.workspaceId &&
            entry.taskId === runInput.taskId &&
            entry.id === runInput.runId
        ) ?? null;
      if (!run) {
        throw new Error("Runtime review target is unavailable in the current mission projection.");
      }
      const reviewPack =
        projection?.reviewPacks.find(
          (entry) =>
            entry.workspaceId === runInput.workspaceId &&
            entry.taskId === runInput.taskId &&
            entry.runId === runInput.runId &&
            (runInput.reviewPackId ? entry.id === runInput.reviewPackId : true)
        ) ?? null;
      const task = await runReviewAgent({
        runtimeControl: reviewRuntimeControl,
        workspaceId: runInput.workspaceId,
        run,
        reviewPack,
        repositoryExecutionContract: activeRepositoryExecutionContract ?? null,
      });
      await homeState.refreshMissionControl?.();
      const followUpSelection = resolveReviewAgentSelection({
        workspaceId: runInput.workspaceId,
        taskId: task.taskId,
      });
      openReviewPack(followUpSelection);
      setActiveWorkspaceId(followUpSelection.workspaceId);
      setActiveTab("review");
    },
    [
      activeRepositoryExecutionContract,
      homeState.missionControlProjection,
      homeState.refreshMissionControl,
      openReviewPack,
      reviewRuntimeControl,
      setActiveTab,
      setActiveWorkspaceId,
    ]
  );

  const handleApplyReviewAutofix = useCallback(
    async (autofixInput: {
      workspaceId: string;
      taskId: string;
      runId: string;
      reviewPackId?: string | null;
      autofixCandidate: {
        id: string;
        summary: string;
        status: "available" | "applied" | "blocked";
      };
    }) => {
      await applyReviewAutofix({
        runtimeControl: reviewRuntimeControl,
        taskId: autofixInput.taskId,
        autofixCandidate: autofixInput.autofixCandidate,
      });
      await homeState.refreshMissionControl?.();
      openReviewPack({
        workspaceId: autofixInput.workspaceId,
        taskId: autofixInput.taskId,
        runId: autofixInput.runId,
        reviewPackId: autofixInput.reviewPackId ?? undefined,
        source: "review_surface",
      });
      setActiveWorkspaceId(autofixInput.workspaceId);
      setActiveTab("review");
    },
    [
      homeState.refreshMissionControl,
      openReviewPack,
      reviewRuntimeControl,
      setActiveTab,
      setActiveWorkspaceId,
    ]
  );

  const handleDelegateGitHubIssue = useCallback(
    async (issue: (typeof gitHubPanelState.gitIssues)[number]) => {
      const workspace = activeWorkspace;
      if (!workspace) {
        pushErrorToast({
          title: "No active workspace",
          message: "Select a workspace before delegating GitHub work.",
        });
        return;
      }
      try {
        const githubLaunch = await loadGitHubSourceGovernedLaunch();
        githubLaunch.assertGovernedGitHubLaunchReady({
          policyStatus: activeRepositoryExecutionContractStatus,
          policyError: activeRepositoryExecutionContractError,
        });
        const issueDetail = (await getGitHubIssueDetails(workspace.id, issue.number)) ?? issue;
        const { launch, request }: GovernedGitHubLaunchRequest =
          githubLaunch.buildGovernedGitHubIssueLaunchRequest({
            issue: issueDetail,
            workspace: {
              workspaceId: workspace.id,
              workspaceRoot: workspace.path,
              gitRemoteUrl,
            },
            options: {
              repositoryExecutionContract: activeRepositoryExecutionContract ?? null,
              preferredBackendIds: defaultRemoteExecutionBackendId
                ? [defaultRemoteExecutionBackendId]
                : undefined,
            },
          });
        await githubLaunch.launchGovernedGitHubRun({
          launch,
          request,
          onRefresh: homeState.refreshMissionControl,
        });
        setActiveTab("workspaces");
      } catch (error) {
        pushErrorToast({
          title: "Couldn't delegate GitHub issue",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [
      activeWorkspace,
      activeRepositoryExecutionContract,
      activeRepositoryExecutionContractError,
      activeRepositoryExecutionContractStatus,
      defaultRemoteExecutionBackendId,
      gitRemoteUrl,
      gitHubPanelState.gitIssues,
      homeState.refreshMissionControl,
      setActiveTab,
    ]
  );

  const handleDelegateGitHubPullRequest = useCallback(
    async (pullRequest: (typeof gitHubPanelState.gitPullRequests)[number]) => {
      const workspace = activeWorkspace;
      if (!workspace) {
        pushErrorToast({
          title: "No active workspace",
          message: "Select a workspace before delegating GitHub work.",
        });
        return;
      }
      try {
        const githubLaunch = await loadGitHubSourceGovernedLaunch();
        githubLaunch.assertGovernedGitHubLaunchReady({
          policyStatus: activeRepositoryExecutionContractStatus,
          policyError: activeRepositoryExecutionContractError,
        });
        const [diffs, comments] = await Promise.all([
          getGitHubPullRequestDiff(workspace.id, pullRequest.number),
          getGitHubPullRequestComments(workspace.id, pullRequest.number),
        ]);
        const { launch, request }: GovernedGitHubLaunchRequest =
          githubLaunch.buildGovernedGitHubPullRequestLaunchRequest({
            pullRequest,
            diffs,
            comments,
            workspace: {
              workspaceId: workspace.id,
              workspaceRoot: workspace.path,
              gitRemoteUrl,
            },
            options: {
              repositoryExecutionContract: activeRepositoryExecutionContract ?? null,
              preferredBackendIds: defaultRemoteExecutionBackendId
                ? [defaultRemoteExecutionBackendId]
                : undefined,
            },
          });
        await githubLaunch.launchGovernedGitHubRun({
          launch,
          request,
          onRefresh: homeState.refreshMissionControl,
        });
        setActiveTab("workspaces");
      } catch (error) {
        pushErrorToast({
          title: "Couldn't delegate GitHub PR follow-up",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [
      activeWorkspace,
      activeRepositoryExecutionContract,
      activeRepositoryExecutionContractError,
      activeRepositoryExecutionContractStatus,
      defaultRemoteExecutionBackendId,
      gitRemoteUrl,
      gitHubPanelState.gitPullRequests,
      homeState.refreshMissionControl,
      setActiveTab,
    ]
  );

  return {
    missionControlProjection: homeState.missionControlProjection,
    activeRepositoryExecutionContract,
    missionControlFreshness: homeState.missionControlFreshness,
    onRefreshMissionControl: homeState.refreshMissionControl,
    reviewPackSelection,
    runtimeReviewPack: runtimeReviewPackTruth.reviewPack,
    onOpenReviewPack: openReviewPack,
    reviewPackDecisionSubmission,
    onSubmitReviewPackDecision: submitReviewPackDecision,
    reviewInterventionBackendOptions,
    reviewInterventionDefaultBackendId: defaultRemoteExecutionBackendId ?? null,
    reviewInterventionLaunchError,
    onLaunchReviewInterventionDraft: handleLaunchReviewInterventionDraft,
    onRunReviewAgent: handleRunReviewAgent,
    onApplyReviewAutofix: handleApplyReviewAutofix,
    fileTreeLoading: fileListingState.isFilesLoading,
    centerMode: gitPanelState.centerMode,
    filePanelMode: gitPanelState.filePanelMode,
    onFilePanelModeChange: gitPanelState.setFilePanelMode,
    gitPanelMode: gitPanelState.gitPanelMode,
    onGitPanelModeChange: gitPanelState.handleGitPanelModeChange,
    gitDiffViewStyle: gitPanelState.gitDiffViewStyle,
    gitStatus: gitPanelState.gitStatus,
    selectedDiffPath: gitPanelState.selectedDiffPath,
    diffScrollRequestId: gitPanelState.diffScrollRequestId,
    onSelectDiff: gitPanelState.handleSelectDiff,
    diffSource: gitPanelState.diffSource,
    gitLogEntries: gitPanelState.gitLogEntries,
    gitLogTotal: gitPanelState.gitLogTotal,
    gitLogAhead: gitPanelState.gitLogAhead,
    gitLogBehind: gitPanelState.gitLogBehind,
    gitLogAheadEntries: gitPanelState.gitLogAheadEntries,
    gitLogBehindEntries: gitPanelState.gitLogBehindEntries,
    gitLogUpstream: gitPanelState.gitLogUpstream,
    gitLogError: gitPanelState.gitLogError,
    gitLogLoading: gitPanelState.gitLogLoading,
    selectedCommitSha: gitPanelState.selectedCommitSha,
    gitIssues: gitHubPanelState.gitIssues,
    gitIssuesTotal: gitHubPanelState.gitIssuesTotal,
    gitIssuesLoading: gitHubPanelState.gitIssuesLoading,
    gitIssuesError: gitHubPanelState.gitIssuesError,
    onStartTaskFromGitHubIssue,
    getGitHubIssueFollowUpPreview,
    onStartTaskFromGitHubIssueFollowUp,
    onDelegateGitHubIssue: handleDelegateGitHubIssue,
    gitPullRequests: gitHubPanelState.gitPullRequests,
    gitPullRequestsTotal: gitHubPanelState.gitPullRequestsTotal,
    gitPullRequestsLoading: gitHubPanelState.gitPullRequestsLoading,
    gitPullRequestsError: gitHubPanelState.gitPullRequestsError,
    onStartTaskFromGitHubPullRequest,
    getGitHubPullRequestFollowUpPreview,
    onStartTaskFromGitHubPullRequestReviewFollowUp,
    getGitHubPullRequestReviewFollowUpPreview,
    onDelegateGitHubPullRequest: handleDelegateGitHubPullRequest,
    selectedPullRequestCommentsLoading: gitHubPanelState.gitPullRequestCommentsLoading,
    selectedPullRequestCommentsError: gitHubPanelState.gitPullRequestCommentsError,
    gitDiffs: gitPanelState.activeDiffs,
    gitDiffLoading: gitPanelState.activeDiffLoading,
    gitDiffError: gitPanelState.activeDiffError,
    onDiffActivePathChange: gitPanelState.handleActiveDiffPath,
    ...gitCommitState,
  };
}
