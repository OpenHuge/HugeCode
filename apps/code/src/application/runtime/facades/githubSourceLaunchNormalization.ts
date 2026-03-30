import type { AgentTaskSourceSummary } from "@ku0/code-runtime-host-contract";
import type { GitHubIssue, GitHubPullRequest } from "../../../types";
import {
  buildGitHubIssueInstruction,
  buildGitHubPullRequestInstruction,
  readOptionalText,
} from "./githubSourceLaunchInstructionShared";
import {
  buildGitHubIssueTaskSource,
  buildGitHubPullRequestFollowUpTaskSource,
  type GitHubTaskSourceProvenanceInput,
} from "./runtimeTaskSourceFacade";

export type GitHubSourceLaunchSummary = {
  title: string;
  instruction: string;
  taskSource: AgentTaskSourceSummary;
};

export type GitHubIssueSourceLaunchInput = {
  issue: Pick<GitHubIssue, "number" | "title" | "url" | "body" | "author" | "labels">;
  workspaceId?: string | null;
  workspaceRoot?: string | null;
  gitRemoteUrl?: string | null;
  sourceTaskId?: string | null;
  sourceRunId?: string | null;
  githubSource?: GitHubTaskSourceProvenanceInput | null;
};

export type GitHubPullRequestFollowUpSourceLaunchInput = {
  pullRequest: Pick<
    GitHubPullRequest,
    "number" | "title" | "url" | "body" | "headRefName" | "baseRefName" | "isDraft" | "author"
  >;
  diffs?: Parameters<typeof buildGitHubPullRequestInstruction>[0]["diffs"];
  comments?: Parameters<typeof buildGitHubPullRequestInstruction>[0]["comments"];
  workspaceId?: string | null;
  workspaceRoot?: string | null;
  gitRemoteUrl?: string | null;
  sourceTaskId?: string | null;
  sourceRunId?: string | null;
  githubSource?: GitHubTaskSourceProvenanceInput | null;
};

export function normalizeGitHubIssueLaunchInput(
  input: GitHubIssueSourceLaunchInput
): GitHubSourceLaunchSummary {
  const title = readOptionalText(input.issue.title) ?? `GitHub issue #${input.issue.number}`;
  return {
    title,
    instruction: buildGitHubIssueInstruction({
      issue: input.issue,
    }),
    taskSource: buildGitHubIssueTaskSource({
      issue: input.issue as GitHubIssue,
      workspaceId: input.workspaceId,
      workspaceRoot: input.workspaceRoot,
      gitRemoteUrl: input.gitRemoteUrl,
      sourceTaskId: input.sourceTaskId,
      sourceRunId: input.sourceRunId,
      githubSource: input.githubSource ?? null,
    }),
  };
}

export function normalizeGitHubPullRequestFollowUpLaunchInput(
  input: GitHubPullRequestFollowUpSourceLaunchInput
): GitHubSourceLaunchSummary {
  const title =
    readOptionalText(input.pullRequest.title) ?? `GitHub PR follow-up #${input.pullRequest.number}`;
  return {
    title,
    instruction: buildGitHubPullRequestInstruction({
      pullRequest: input.pullRequest,
      diffs: input.diffs,
      comments: input.comments,
    }),
    taskSource: buildGitHubPullRequestFollowUpTaskSource({
      pullRequest: input.pullRequest as GitHubPullRequest,
      workspaceId: input.workspaceId,
      workspaceRoot: input.workspaceRoot,
      gitRemoteUrl: input.gitRemoteUrl,
      sourceTaskId: input.sourceTaskId,
      sourceRunId: input.sourceRunId,
      githubSource: input.githubSource ?? null,
    }),
  };
}
