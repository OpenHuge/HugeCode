import { useCallback } from "react";
import { useRuntimeWorkspaceExecutionPolicy } from "../../../application/runtime/facades/runtimeWorkspaceExecutionPolicyFacade";
import {
  buildGovernedGitHubIssueLaunchRequest,
  buildGovernedGitHubPullRequestLaunchRequest,
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

export function useGitHubRuntimeTaskLaunchers({
  activeWorkspace,
  activeWorkspaceId,
  gitRemoteUrl,
  selectedRemoteBackendId,
  refreshMissionControl,
}: UseGitHubRuntimeTaskLaunchersParams) {
  const { repositoryExecutionContract } = useRuntimeWorkspaceExecutionPolicy(activeWorkspaceId);

  const handleStartTaskFromGitHubIssue = useCallback(
    async (issue: GitHubIssue) => {
      if (!activeWorkspace) {
        return;
      }
      try {
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
      refreshMissionControl,
      selectedRemoteBackendId,
    ]
  );

  return {
    handleStartTaskFromGitHubIssue,
    handleStartTaskFromGitHubPullRequest,
  };
}
