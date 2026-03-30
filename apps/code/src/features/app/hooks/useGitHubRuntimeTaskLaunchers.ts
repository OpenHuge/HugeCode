import { useCallback } from "react";
import {
  assertGovernedGitHubLaunchReady,
  buildGovernedGitHubIssueLaunchRequest,
  buildGovernedGitHubPullRequestLaunchRequest,
  launchGovernedGitHubRun,
} from "../../../application/runtime/facades/githubSourceGovernedLaunch";
import { useRuntimeWorkspaceExecutionPolicy } from "../../../application/runtime/facades/runtimeWorkspaceExecutionPolicyFacade";
import { pushErrorToast } from "../../../application/runtime/ports/toasts";
import type { GitHubIssue, GitHubPullRequest, WorkspaceInfo } from "../../../types";

type GitHubCommentSourceGovernedLaunchModule =
  typeof import("../../../application/runtime/facades/githubCommentSourceGovernedLaunch");

type GovernedGitHubLaunchRequest =
  | ReturnType<typeof buildGovernedGitHubIssueLaunchRequest>
  | ReturnType<typeof buildGovernedGitHubPullRequestLaunchRequest>
  | ReturnType<
      GitHubCommentSourceGovernedLaunchModule["buildGovernedGitHubIssueCommentCommandLaunchRequest"]
    >
  | ReturnType<
      GitHubCommentSourceGovernedLaunchModule["buildGovernedGitHubPullRequestReviewCommentLaunchRequest"]
    >;

type UseGitHubRuntimeTaskLaunchersParams = {
  activeWorkspace: WorkspaceInfo | null;
  activeWorkspaceId: string | null;
  gitRemoteUrl: string | null;
  selectedRemoteBackendId: string | null;
  refreshMissionControl: () => Promise<void>;
};

type GitHubIssueCommentCommandLaunchParams = Omit<
  Parameters<
    GitHubCommentSourceGovernedLaunchModule["buildGovernedGitHubIssueCommentCommandLaunchRequest"]
  >[0],
  "workspace" | "options"
>;

type GitHubPullRequestReviewCommentLaunchParams = Omit<
  Parameters<
    GitHubCommentSourceGovernedLaunchModule["buildGovernedGitHubPullRequestReviewCommentLaunchRequest"]
  >[0],
  "workspace" | "options"
>;

async function loadGitHubCommentSourceGovernedLaunch() {
  return import("../../../application/runtime/facades/githubCommentSourceGovernedLaunch");
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

  const handleStartTaskFromGitHubIssueCommentCommand = useCallback(
    async (input: GitHubIssueCommentCommandLaunchParams) => {
      const workspace = activeWorkspace;
      if (!workspace) {
        return;
      }
      const githubLaunch = await loadGitHubCommentSourceGovernedLaunch();
      await launchGovernedTask({
        prepare: () =>
          githubLaunch.buildGovernedGitHubIssueCommentCommandLaunchRequest({
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

  const handleStartTaskFromGitHubPullRequestReviewCommentCommand = useCallback(
    async (input: GitHubPullRequestReviewCommentLaunchParams) => {
      const workspace = activeWorkspace;
      if (!workspace) {
        return;
      }
      const githubLaunch = await loadGitHubCommentSourceGovernedLaunch();
      await launchGovernedTask({
        prepare: () =>
          githubLaunch.buildGovernedGitHubPullRequestReviewCommentLaunchRequest({
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

  return {
    handleStartTaskFromGitHubIssue,
    handleStartTaskFromGitHubPullRequest,
    handleStartTaskFromGitHubIssueCommentCommand,
    handleStartTaskFromGitHubPullRequestReviewCommentCommand,
  };
}
