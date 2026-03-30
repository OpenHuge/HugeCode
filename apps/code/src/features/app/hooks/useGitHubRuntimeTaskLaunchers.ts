import { useCallback } from "react";
import type {
  GitHubIssue,
  GitHubPullRequest,
  GitHubPullRequestComment,
  WorkspaceInfo,
} from "../../../types";
import {
  buildGovernedGitHubFollowUpPreview,
  type GovernedGitHubFollowUpPreview,
  type GovernedGitHubFollowUpPreviewBackendOrigin,
} from "../../../application/runtime/facades/githubSourceLaunchPreview";
import {
  assertGovernedGitHubLaunchReady,
  buildGovernedGitHubIssueLaunchRequest,
  buildGovernedGitHubPullRequestLaunchRequest,
  evaluateGovernedGitHubLaunchPreflight,
  launchGovernedGitHubRun,
} from "../../../application/runtime/facades/githubSourceGovernedLaunch";
import {
  buildGovernedGitHubIssueCommentCommandLaunchRequest,
  buildGovernedGitHubPullRequestReviewCommentLaunchRequest,
} from "../../../application/runtime/facades/githubCommentSourceGovernedLaunch";
import {
  buildGitHubIssueCommentCommandEvidenceDetail,
  buildGitHubIssueEvidenceDetail,
  buildGitHubPullRequestEvidenceDetail,
  buildGitHubPullRequestReviewCommentEvidenceDetail,
} from "../../../application/runtime/facades/githubSourceLaunchInstructionShared";
import {
  normalizeGitHubIssueCommentCommandLaunchInput,
  normalizeGitHubPullRequestReviewCommentCommandLaunchInput,
} from "../../../application/runtime/facades/githubCommentSourceLaunchNormalization";
import {
  normalizeGitHubIssueLaunchInput,
  normalizeGitHubPullRequestFollowUpLaunchInput,
  type GitHubSourceLaunchSummary,
} from "../../../application/runtime/facades/githubSourceLaunchNormalization";
import { useRuntimeWorkspaceExecutionPolicy } from "../../../application/runtime/facades/runtimeWorkspaceExecutionPolicyFacade";
import { pushErrorToast } from "../../../application/runtime/ports/toasts";

type GovernedGitHubLaunchRequest =
  | ReturnType<typeof buildGovernedGitHubIssueLaunchRequest>
  | ReturnType<typeof buildGovernedGitHubPullRequestLaunchRequest>
  | ReturnType<typeof buildGovernedGitHubIssueCommentCommandLaunchRequest>
  | ReturnType<typeof buildGovernedGitHubPullRequestReviewCommentLaunchRequest>;

type UseGitHubRuntimeTaskLaunchersParams = {
  activeWorkspace: WorkspaceInfo | null;
  activeWorkspaceId: string | null;
  gitRemoteUrl: string | null;
  selectedRemoteBackendId: string | null;
  refreshMissionControl: () => Promise<void>;
};

type GitHubIssueCommentCommandLaunchParams = Omit<
  Parameters<typeof buildGovernedGitHubIssueCommentCommandLaunchRequest>[0],
  "workspace" | "options"
>;

type GitHubPullRequestReviewCommentLaunchParams = Omit<
  Parameters<typeof buildGovernedGitHubPullRequestReviewCommentLaunchRequest>[0],
  "workspace" | "options"
>;

function buildMissingWorkspacePreviewReason() {
  return "Select a workspace before starting a governed GitHub follow-up.";
}

function buildReviewCommentLaunchParams(
  pullRequest: GitHubPullRequest,
  comment: GitHubPullRequestComment
): GitHubPullRequestReviewCommentLaunchParams {
  return {
    pullRequest,
    event: {
      eventName: "pull_request_review_comment",
      action: "created",
    },
    command: {
      triggerMode: "pull_request_review_comment_command",
      comment: {
        commentId: comment.id,
        body: comment.body,
        url: comment.url,
        author: comment.author,
      },
    },
  };
}

export function useGitHubRuntimeTaskLaunchers({
  activeWorkspace,
  activeWorkspaceId,
  gitRemoteUrl,
  selectedRemoteBackendId,
  refreshMissionControl,
}: UseGitHubRuntimeTaskLaunchersParams) {
  const {
    repositoryExecutionContract,
    repositoryExecutionContractError,
    repositoryExecutionContractStatus,
  } = useRuntimeWorkspaceExecutionPolicy(activeWorkspaceId);

  const launchGovernedTask = useCallback(
    async (input: {
      prepare: () => GovernedGitHubLaunchRequest;
      errorTitle: string;
      fallbackMessage: string;
    }) => {
      try {
        assertGovernedGitHubLaunchReady({
          policyStatus: repositoryExecutionContractStatus,
          policyError: repositoryExecutionContractError,
        });
        const { launch, request } = input.prepare();
        await launchGovernedGitHubRun({
          launch,
          request,
          onRefresh: refreshMissionControl,
        });
      } catch (error) {
        pushErrorToast({
          title: input.errorTitle,
          message: error instanceof Error ? error.message : input.fallbackMessage,
        });
      }
    },
    [repositoryExecutionContractError, repositoryExecutionContractStatus, refreshMissionControl]
  );

  const buildPreview = useCallback(
    (input: {
      launch: GitHubSourceLaunchSummary;
      prepare?: (() => GovernedGitHubLaunchRequest) | null;
      sourceEvidenceDetail: string;
    }): GovernedGitHubFollowUpPreview => {
      const preflight = activeWorkspace
        ? evaluateGovernedGitHubLaunchPreflight({
            policyStatus: repositoryExecutionContractStatus,
            policyError: repositoryExecutionContractError,
          })
        : {
            state: "blocked" as const,
            reason: buildMissingWorkspacePreviewReason(),
          };

      if (preflight.state === "blocked") {
        return buildGovernedGitHubFollowUpPreview({
          launch: input.launch,
          state: "blocked",
          blockedReason: preflight.reason,
          backendOrigin: selectedRemoteBackendId ? "operator_selected" : "runtime_default",
          preferredBackendIds: selectedRemoteBackendId ? [selectedRemoteBackendId] : null,
          sourceEvidenceDetail: input.sourceEvidenceDetail,
        });
      }

      try {
        const prepared = input.prepare?.() ?? null;
        const backendOrigin: GovernedGitHubFollowUpPreviewBackendOrigin =
          selectedRemoteBackendId !== null
            ? "operator_selected"
            : (prepared?.request.preferredBackendIds?.length ?? 0) > 0
              ? "repository_policy"
              : "runtime_default";
        return buildGovernedGitHubFollowUpPreview({
          launch: prepared?.launch ?? input.launch,
          request: prepared?.request ?? null,
          state: "ready",
          backendOrigin,
          preferredBackendIds: selectedRemoteBackendId ? [selectedRemoteBackendId] : null,
          sourceEvidenceDetail: input.sourceEvidenceDetail,
        });
      } catch (error) {
        return buildGovernedGitHubFollowUpPreview({
          launch: input.launch,
          state: "blocked",
          blockedReason: error instanceof Error ? error.message : String(error),
          backendOrigin: selectedRemoteBackendId ? "operator_selected" : "runtime_default",
          preferredBackendIds: selectedRemoteBackendId ? [selectedRemoteBackendId] : null,
          sourceEvidenceDetail: input.sourceEvidenceDetail,
        });
      }
    },
    [
      activeWorkspace,
      repositoryExecutionContractError,
      repositoryExecutionContractStatus,
      selectedRemoteBackendId,
    ]
  );

  const handleStartTaskFromGitHubIssue = useCallback(
    async (issue: GitHubIssue) => {
      const workspace = activeWorkspace;
      if (!workspace) {
        return;
      }
      await launchGovernedTask({
        prepare: () =>
          buildGovernedGitHubIssueLaunchRequest({
            issue,
            workspace: {
              workspaceId: workspace.id,
              workspaceRoot: workspace.path,
              gitRemoteUrl,
            },
            options: {
              repositoryExecutionContract,
              preferredBackendIds: selectedRemoteBackendId ? [selectedRemoteBackendId] : undefined,
            },
          }),
        errorTitle: "Couldn't start issue task",
        fallbackMessage: "Unable to start a runtime-managed task from this GitHub issue.",
      });
    },
    [
      activeWorkspace,
      gitRemoteUrl,
      launchGovernedTask,
      repositoryExecutionContract,
      selectedRemoteBackendId,
    ]
  );

  const getGitHubIssueFollowUpPreview = useCallback(
    (issue: GitHubIssue) =>
      buildPreview({
        launch: normalizeGitHubIssueLaunchInput({
          issue,
          workspaceId: activeWorkspace?.id,
          workspaceRoot: activeWorkspace?.path,
          gitRemoteUrl,
        }),
        prepare:
          activeWorkspace === null
            ? null
            : () =>
                buildGovernedGitHubIssueLaunchRequest({
                  issue,
                  workspace: {
                    workspaceId: activeWorkspace.id,
                    workspaceRoot: activeWorkspace.path,
                    gitRemoteUrl,
                  },
                  options: {
                    repositoryExecutionContract,
                    preferredBackendIds: selectedRemoteBackendId
                      ? [selectedRemoteBackendId]
                      : undefined,
                  },
                }),
        sourceEvidenceDetail: buildGitHubIssueEvidenceDetail({
          issue,
        }),
      }),
    [
      activeWorkspace,
      buildPreview,
      gitRemoteUrl,
      repositoryExecutionContract,
      selectedRemoteBackendId,
    ]
  );

  const handleStartTaskFromGitHubPullRequest = useCallback(
    async (pullRequest: GitHubPullRequest) => {
      const workspace = activeWorkspace;
      if (!workspace) {
        return;
      }
      await launchGovernedTask({
        prepare: () =>
          buildGovernedGitHubPullRequestLaunchRequest({
            pullRequest,
            workspace: {
              workspaceId: workspace.id,
              workspaceRoot: workspace.path,
              gitRemoteUrl,
            },
            options: {
              repositoryExecutionContract,
              preferredBackendIds: selectedRemoteBackendId ? [selectedRemoteBackendId] : undefined,
            },
          }),
        errorTitle: "Couldn't start PR follow-up task",
        fallbackMessage: "Unable to start a runtime-managed task from this pull request.",
      });
    },
    [
      activeWorkspace,
      gitRemoteUrl,
      launchGovernedTask,
      repositoryExecutionContract,
      selectedRemoteBackendId,
    ]
  );

  const getGitHubPullRequestFollowUpPreview = useCallback(
    (pullRequest: GitHubPullRequest) =>
      buildPreview({
        launch: normalizeGitHubPullRequestFollowUpLaunchInput({
          pullRequest,
          workspaceId: activeWorkspace?.id,
          workspaceRoot: activeWorkspace?.path,
          gitRemoteUrl,
        }),
        prepare:
          activeWorkspace === null
            ? null
            : () =>
                buildGovernedGitHubPullRequestLaunchRequest({
                  pullRequest,
                  workspace: {
                    workspaceId: activeWorkspace.id,
                    workspaceRoot: activeWorkspace.path,
                    gitRemoteUrl,
                  },
                  options: {
                    repositoryExecutionContract,
                    preferredBackendIds: selectedRemoteBackendId
                      ? [selectedRemoteBackendId]
                      : undefined,
                  },
                }),
        sourceEvidenceDetail: buildGitHubPullRequestEvidenceDetail({
          pullRequest,
        }),
      }),
    [
      activeWorkspace,
      buildPreview,
      gitRemoteUrl,
      repositoryExecutionContract,
      selectedRemoteBackendId,
    ]
  );

  const handleStartTaskFromGitHubIssueCommentCommand = useCallback(
    async (input: GitHubIssueCommentCommandLaunchParams) => {
      const workspace = activeWorkspace;
      if (!workspace) {
        return;
      }
      await launchGovernedTask({
        prepare: () =>
          buildGovernedGitHubIssueCommentCommandLaunchRequest({
            ...input,
            workspace: {
              workspaceId: workspace.id,
              workspaceRoot: workspace.path,
              gitRemoteUrl,
            },
            options: {
              repositoryExecutionContract,
              preferredBackendIds: selectedRemoteBackendId ? [selectedRemoteBackendId] : undefined,
            },
          }),
        errorTitle: "Couldn't start issue follow-up task",
        fallbackMessage:
          "Unable to start a runtime-managed follow-up from this GitHub issue comment.",
      });
    },
    [
      activeWorkspace,
      gitRemoteUrl,
      launchGovernedTask,
      repositoryExecutionContract,
      selectedRemoteBackendId,
    ]
  );

  const getGitHubIssueCommentCommandFollowUpPreview = useCallback(
    (input: GitHubIssueCommentCommandLaunchParams) =>
      buildPreview({
        launch: normalizeGitHubIssueCommentCommandLaunchInput({
          ...input,
          workspaceId: activeWorkspace?.id,
          workspaceRoot: activeWorkspace?.path,
          gitRemoteUrl,
        }),
        prepare:
          activeWorkspace === null
            ? null
            : () =>
                buildGovernedGitHubIssueCommentCommandLaunchRequest({
                  ...input,
                  workspace: {
                    workspaceId: activeWorkspace.id,
                    workspaceRoot: activeWorkspace.path,
                    gitRemoteUrl,
                  },
                  options: {
                    repositoryExecutionContract,
                    preferredBackendIds: selectedRemoteBackendId
                      ? [selectedRemoteBackendId]
                      : undefined,
                  },
                }),
        sourceEvidenceDetail: buildGitHubIssueCommentCommandEvidenceDetail({
          issue: input.issue,
          command: input.command,
        }),
      }),
    [
      activeWorkspace,
      buildPreview,
      gitRemoteUrl,
      repositoryExecutionContract,
      selectedRemoteBackendId,
    ]
  );

  const handleStartTaskFromGitHubPullRequestReviewCommentCommand = useCallback(
    async (input: GitHubPullRequestReviewCommentLaunchParams) => {
      const workspace = activeWorkspace;
      if (!workspace) {
        return;
      }
      await launchGovernedTask({
        prepare: () =>
          buildGovernedGitHubPullRequestReviewCommentLaunchRequest({
            ...input,
            workspace: {
              workspaceId: workspace.id,
              workspaceRoot: workspace.path,
              gitRemoteUrl,
            },
            options: {
              repositoryExecutionContract,
              preferredBackendIds: selectedRemoteBackendId ? [selectedRemoteBackendId] : undefined,
            },
          }),
        errorTitle: "Couldn't start review-comment follow-up task",
        fallbackMessage:
          "Unable to start a runtime-managed follow-up from this GitHub review comment.",
      });
    },
    [
      activeWorkspace,
      gitRemoteUrl,
      launchGovernedTask,
      repositoryExecutionContract,
      selectedRemoteBackendId,
    ]
  );

  const handleStartTaskFromGitHubPullRequestReviewFollowUp = useCallback(
    async (pullRequest: GitHubPullRequest, comment: GitHubPullRequestComment) => {
      await handleStartTaskFromGitHubPullRequestReviewCommentCommand(
        buildReviewCommentLaunchParams(pullRequest, comment)
      );
    },
    [handleStartTaskFromGitHubPullRequestReviewCommentCommand]
  );

  const getGitHubPullRequestReviewCommentCommandFollowUpPreview = useCallback(
    (input: GitHubPullRequestReviewCommentLaunchParams) =>
      buildPreview({
        launch: normalizeGitHubPullRequestReviewCommentCommandLaunchInput({
          ...input,
          workspaceId: activeWorkspace?.id,
          workspaceRoot: activeWorkspace?.path,
          gitRemoteUrl,
        }),
        prepare:
          activeWorkspace === null
            ? null
            : () =>
                buildGovernedGitHubPullRequestReviewCommentLaunchRequest({
                  ...input,
                  workspace: {
                    workspaceId: activeWorkspace.id,
                    workspaceRoot: activeWorkspace.path,
                    gitRemoteUrl,
                  },
                  options: {
                    repositoryExecutionContract,
                    preferredBackendIds: selectedRemoteBackendId
                      ? [selectedRemoteBackendId]
                      : undefined,
                  },
                }),
        sourceEvidenceDetail: buildGitHubPullRequestReviewCommentEvidenceDetail({
          pullRequest: input.pullRequest,
          diffs: input.diffs,
          comments: input.comments,
          command: input.command,
        }),
      }),
    [
      activeWorkspace,
      buildPreview,
      gitRemoteUrl,
      repositoryExecutionContract,
      selectedRemoteBackendId,
    ]
  );

  const getGitHubPullRequestReviewFollowUpPreview = useCallback(
    (pullRequest: GitHubPullRequest, comment: GitHubPullRequestComment) =>
      getGitHubPullRequestReviewCommentCommandFollowUpPreview(
        buildReviewCommentLaunchParams(pullRequest, comment)
      ),
    [getGitHubPullRequestReviewCommentCommandFollowUpPreview]
  );

  return {
    handleStartTaskFromGitHubIssue,
    handleStartTaskFromGitHubPullRequest,
    handleStartTaskFromGitHubIssueCommentCommand,
    handleStartTaskFromGitHubPullRequestReviewCommentCommand,
    handleStartTaskFromGitHubPullRequestReviewFollowUp,
    getGitHubIssueFollowUpPreview,
    getGitHubPullRequestFollowUpPreview,
    getGitHubIssueCommentCommandFollowUpPreview,
    getGitHubPullRequestReviewCommentCommandFollowUpPreview,
    getGitHubPullRequestReviewFollowUpPreview,
  };
}
