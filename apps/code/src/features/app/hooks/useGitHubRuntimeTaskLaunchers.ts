import { useCallback } from "react";
import {
  buildGitHubIssueTaskSource,
  buildGitHubPullRequestFollowUpTaskSource,
} from "../../../application/runtime/facades/runtimeTaskSourceFacade";
import { useWorkspaceRuntimeAgentControl } from "../../../application/runtime/ports/runtimeAgentControl";
import { pushErrorToast } from "../../../application/runtime/ports/toasts";
import type {
  ComposerExecutionMode,
  GitHubIssue,
  GitHubPullRequest,
  WorkspaceInfo,
} from "../../../types";
import { DEFAULT_RUNTIME_WORKSPACE_ID } from "../../../utils/runtimeWorkspaceIds";

type UseGitHubRuntimeTaskLaunchersParams = {
  activeWorkspace: WorkspaceInfo | null;
  activeWorkspaceId: string | null;
  gitRemoteUrl: string | null;
  accessMode: "read-only" | "on-request" | "full-access";
  executionMode: ComposerExecutionMode;
  selectedRemoteBackendId: string | null;
  refreshMissionControl: () => Promise<void>;
};

export function useGitHubRuntimeTaskLaunchers({
  activeWorkspace,
  activeWorkspaceId,
  gitRemoteUrl,
  accessMode,
  executionMode,
  selectedRemoteBackendId,
  refreshMissionControl,
}: UseGitHubRuntimeTaskLaunchersParams) {
  const runtimeControl = useWorkspaceRuntimeAgentControl(
    (activeWorkspaceId ?? DEFAULT_RUNTIME_WORKSPACE_ID) as Parameters<
      typeof useWorkspaceRuntimeAgentControl
    >[0]
  );

  const handleStartTaskFromGitHubIssue = useCallback(
    async (issue: GitHubIssue) => {
      if (!activeWorkspace) {
        return;
      }
      try {
        await runtimeControl.startTask({
          workspaceId: activeWorkspace.id,
          title: issue.title,
          taskSource: buildGitHubIssueTaskSource({
            issue,
            workspaceId: activeWorkspace.id,
            workspaceRoot: activeWorkspace.path,
            gitRemoteUrl,
          }),
          instruction: `Address GitHub issue #${issue.number}: ${issue.title}. Start from the linked issue context, inspect the current repository state, implement the required change, validate it, and return a review-ready result.`,
          stepKind: "read",
          accessMode,
          executionMode: executionMode === "runtime" ? "distributed" : "single",
          preferredBackendIds: selectedRemoteBackendId ? [selectedRemoteBackendId] : undefined,
        });
        await refreshMissionControl();
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
      accessMode,
      activeWorkspace,
      executionMode,
      gitRemoteUrl,
      refreshMissionControl,
      runtimeControl,
      selectedRemoteBackendId,
    ]
  );

  const handleStartTaskFromGitHubPullRequest = useCallback(
    async (pullRequest: GitHubPullRequest) => {
      if (!activeWorkspace) {
        return;
      }
      try {
        await runtimeControl.startTask({
          workspaceId: activeWorkspace.id,
          title: pullRequest.title,
          taskSource: buildGitHubPullRequestFollowUpTaskSource({
            pullRequest,
            workspaceId: activeWorkspace.id,
            workspaceRoot: activeWorkspace.path,
            gitRemoteUrl,
          }),
          instruction: `Follow up on GitHub pull request #${pullRequest.number}: ${pullRequest.title}. Review the PR context and repository state, address the required follow-up work, validate the result, and return a review-ready update.`,
          stepKind: "read",
          accessMode,
          executionMode: executionMode === "runtime" ? "distributed" : "single",
          preferredBackendIds: selectedRemoteBackendId ? [selectedRemoteBackendId] : undefined,
        });
        await refreshMissionControl();
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
      accessMode,
      activeWorkspace,
      executionMode,
      gitRemoteUrl,
      refreshMissionControl,
      runtimeControl,
      selectedRemoteBackendId,
    ]
  );

  return {
    handleStartTaskFromGitHubIssue,
    handleStartTaskFromGitHubPullRequest,
  };
}
