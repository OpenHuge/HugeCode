import type { GitHubIssue, GitHubPullRequest } from "../../../types";
import {
  buildGitHubIssueCommentCommandInstruction,
  buildGitHubPullRequestReviewCommentInstruction,
  readOptionalText,
} from "./githubSourceLaunchInstructionShared";
import {
  buildGitHubIssueTaskSource,
  buildGitHubPullRequestFollowUpTaskSource,
  type GitHubTaskSourceCommentInput,
  type GitHubTaskSourceProvenanceInput,
} from "./runtimeTaskSourceFacade";
import type {
  GitHubIssueSourceLaunchInput,
  GitHubPullRequestFollowUpSourceLaunchInput,
  GitHubSourceLaunchSummary,
} from "./githubSourceLaunchNormalization";

export type GitHubIssueCommentCommandLaunchInput = Omit<
  GitHubIssueSourceLaunchInput,
  "githubSource"
> & {
  event: GitHubTaskSourceProvenanceInput["event"];
  command: Omit<GitHubTaskSourceProvenanceInput, "event"> & {
    comment?: GitHubTaskSourceCommentInput | null;
  };
};

export type GitHubPullRequestReviewCommentCommandLaunchInput = Omit<
  GitHubPullRequestFollowUpSourceLaunchInput,
  "githubSource"
> & {
  event: GitHubTaskSourceProvenanceInput["event"];
  command: Omit<GitHubTaskSourceProvenanceInput, "event"> & {
    comment?: GitHubTaskSourceCommentInput | null;
  };
};

export function normalizeGitHubIssueCommentCommandLaunchInput(
  input: GitHubIssueCommentCommandLaunchInput
): GitHubSourceLaunchSummary {
  const title = readOptionalText(input.issue.title) ?? `GitHub issue #${input.issue.number}`;

  return {
    title,
    instruction: buildGitHubIssueCommentCommandInstruction({
      issue: input.issue,
      event: input.event,
      command: input.command,
    }),
    taskSource: buildGitHubIssueTaskSource({
      issue: input.issue as GitHubIssue,
      workspaceId: input.workspaceId,
      workspaceRoot: input.workspaceRoot,
      gitRemoteUrl: input.gitRemoteUrl,
      sourceTaskId: input.sourceTaskId,
      sourceRunId: input.sourceRunId,
      githubSource: {
        ...input.command,
        event: input.event,
      },
    }),
  };
}

export function normalizeGitHubPullRequestReviewCommentCommandLaunchInput(
  input: GitHubPullRequestReviewCommentCommandLaunchInput
): GitHubSourceLaunchSummary {
  const title =
    readOptionalText(input.pullRequest.title) ?? `GitHub PR follow-up #${input.pullRequest.number}`;

  return {
    title,
    instruction: buildGitHubPullRequestReviewCommentInstruction({
      pullRequest: input.pullRequest,
      diffs: input.diffs,
      comments: input.comments,
      event: input.event,
      command: input.command,
    }),
    taskSource: buildGitHubPullRequestFollowUpTaskSource({
      pullRequest: input.pullRequest as GitHubPullRequest,
      workspaceId: input.workspaceId,
      workspaceRoot: input.workspaceRoot,
      gitRemoteUrl: input.gitRemoteUrl,
      sourceTaskId: input.sourceTaskId,
      sourceRunId: input.sourceRunId,
      githubSource: {
        ...input.command,
        event: input.event,
      },
    }),
  };
}
