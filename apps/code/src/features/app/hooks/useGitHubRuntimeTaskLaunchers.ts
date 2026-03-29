import { useCallback } from "react";
import { useRuntimeWorkspaceExecutionPolicy } from "../../../application/runtime/facades/runtimeWorkspaceExecutionPolicyFacade";
import {
  assertGovernedGitHubLaunchReady,
  buildGovernedGitHubIssueCommentCommandLaunchRequest,
  buildGovernedGitHubIssueLaunchRequest,
  buildGovernedGitHubPullRequestLaunchRequest,
  buildGovernedGitHubPullRequestReviewCommentLaunchRequest,
  launchGovernedGitHubRun,
} from "../../../application/runtime/facades/githubSourceGovernedLaunch";
import { pushErrorToast } from "../../../application/runtime/ports/toasts";
import type { GitHubIssue, GitHubPullRequest, WorkspaceInfo } from "../../../types";

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

  const handleStartTaskFromGitHubIssue = useCallback(
    async (issue: GitHubIssue) => {
      if (!activeWorkspace) {
        return;
      }
      try {
        assertGovernedGitHubLaunchReady({
          policyStatus: repositoryExecutionContractStatus,
          policyError: repositoryExecutionContractError,
        });
        const { launch, request } = buildGovernedGitHubIssueLaunchRequest({
          issue,
          workspace: {
            workspaceId: activeWorkspace.id,
            workspaceRoot: activeWorkspace.path,
            gitRemoteUrl,
          },
          options: {
            repositoryExecutionContract,
            preferredBackendIds: selectedRemoteBackendId ? [selectedRemoteBackendId] : undefined,
          },
        });
        await launchGovernedGitHubRun({
          launch,
          request,
          onRefresh: refreshMissionControl,
        });
      } catch (error) {
        pushErrorToast({
          title: "Couldn't start issue task",
          message:
            error instanceof Error
              ? error.message
              : "Unable to start a runtime-managed task from this GitHub issue.",
        });
      }
    },
    [
      activeWorkspace,
      gitRemoteUrl,
      repositoryExecutionContract,
      repositoryExecutionContractError,
      repositoryExecutionContractStatus,
      refreshMissionControl,
      selectedRemoteBackendId,
    ]
  );

  const handleStartTaskFromGitHubPullRequest = useCallback(
    async (pullRequest: GitHubPullRequest) => {
      if (!activeWorkspace) {
        return;
      }
      try {
        assertGovernedGitHubLaunchReady({
          policyStatus: repositoryExecutionContractStatus,
          policyError: repositoryExecutionContractError,
        });
        const { launch, request } = buildGovernedGitHubPullRequestLaunchRequest({
          pullRequest,
          workspace: {
            workspaceId: activeWorkspace.id,
            workspaceRoot: activeWorkspace.path,
            gitRemoteUrl,
          },
          options: {
            repositoryExecutionContract,
            preferredBackendIds: selectedRemoteBackendId ? [selectedRemoteBackendId] : undefined,
          },
        });
        await launchGovernedGitHubRun({
          launch,
          request,
          onRefresh: refreshMissionControl,
        });
      } catch (error) {
        pushErrorToast({
          title: "Couldn't start PR follow-up task",
          message:
            error instanceof Error
              ? error.message
              : "Unable to start a runtime-managed task from this pull request.",
        });
      }
    },
    [
      activeWorkspace,
      gitRemoteUrl,
      repositoryExecutionContract,
      repositoryExecutionContractError,
      repositoryExecutionContractStatus,
      refreshMissionControl,
      selectedRemoteBackendId,
    ]
  );

  const handleStartTaskFromGitHubIssueCommentCommand = useCallback(
    async (input: GitHubIssueCommentCommandLaunchParams) => {
      if (!activeWorkspace) {
        return;
      }
      try {
        assertGovernedGitHubLaunchReady({
          policyStatus: repositoryExecutionContractStatus,
          policyError: repositoryExecutionContractError,
        });
        const { launch, request } = buildGovernedGitHubIssueCommentCommandLaunchRequest({
          ...input,
          workspace: {
            workspaceId: activeWorkspace.id,
            workspaceRoot: activeWorkspace.path,
            gitRemoteUrl,
          },
          options: {
            repositoryExecutionContract,
            preferredBackendIds: selectedRemoteBackendId ? [selectedRemoteBackendId] : undefined,
          },
        });
        await launchGovernedGitHubRun({
          launch,
          request,
          onRefresh: refreshMissionControl,
        });
      } catch (error) {
        pushErrorToast({
          title: "Couldn't start issue follow-up task",
          message:
            error instanceof Error
              ? error.message
              : "Unable to start a runtime-managed follow-up from this GitHub issue comment.",
        });
      }
    },
    [
      activeWorkspace,
      gitRemoteUrl,
      repositoryExecutionContract,
      repositoryExecutionContractError,
      repositoryExecutionContractStatus,
      refreshMissionControl,
      selectedRemoteBackendId,
    ]
  );

  const handleStartTaskFromGitHubPullRequestReviewCommentCommand = useCallback(
    async (input: GitHubPullRequestReviewCommentLaunchParams) => {
      if (!activeWorkspace) {
        return;
      }
      try {
        assertGovernedGitHubLaunchReady({
          policyStatus: repositoryExecutionContractStatus,
          policyError: repositoryExecutionContractError,
        });
        const { launch, request } = buildGovernedGitHubPullRequestReviewCommentLaunchRequest({
          ...input,
          workspace: {
            workspaceId: activeWorkspace.id,
            workspaceRoot: activeWorkspace.path,
            gitRemoteUrl,
          },
          options: {
            repositoryExecutionContract,
            preferredBackendIds: selectedRemoteBackendId ? [selectedRemoteBackendId] : undefined,
          },
        });
        await launchGovernedGitHubRun({
          launch,
          request,
          onRefresh: refreshMissionControl,
        });
      } catch (error) {
        pushErrorToast({
          title: "Couldn't start review-comment follow-up task",
          message:
            error instanceof Error
              ? error.message
              : "Unable to start a runtime-managed follow-up from this GitHub review comment.",
        });
      }
    },
    [
      activeWorkspace,
      gitRemoteUrl,
      repositoryExecutionContract,
      repositoryExecutionContractError,
      repositoryExecutionContractStatus,
      refreshMissionControl,
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
