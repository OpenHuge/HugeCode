import {
  buildRuntimeSourceLaunchSummary as buildSourceLaunchSummary,
  readRuntimeSourceLaunchText as readOptionalText,
} from "@ku0/code-application/runtimeSourceLaunchNormalization";
import type {
  RuntimeNormalizedSourceLaunchSummary,
  RuntimeSourceLaunchSharedFields as SharedSourceLaunchFields,
} from "@ku0/code-application/runtimeSourceLaunchNormalization";
import type {
  GitHubIssue,
  GitHubPullRequest,
  GitHubPullRequestComment,
  GitHubPullRequestDiff,
} from "../../../types";
import {
  buildGitHubIssueCommentCommandInstruction,
  buildGitHubIssueInstruction,
  buildGitHubPullRequestInstruction,
  buildGitHubPullRequestReviewCommentInstruction,
} from "./githubSourceLaunchInstructionShared";
import {
  buildGitHubIssueTaskSource,
  buildGitHubPullRequestFollowUpTaskSource,
  type GitHubTaskSourceCommentInput,
  type GitHubTaskSourceProvenanceInput,
} from "./runtimeTaskSourceFacade";

export {
  normalizeCallSummarySourceLaunchInput,
  normalizeCustomerFeedbackSourceLaunchInput,
  normalizeDocumentSourceLaunchInput,
  normalizeExternalReferenceSourceLaunchInput,
  normalizeGitHubDiscussionSourceLaunchInput,
  normalizeNoteSourceLaunchInput,
} from "@ku0/code-application/runtimeSourceLaunchNormalization";
export type {
  CallSummarySourceLaunchInput,
  CustomerFeedbackSourceLaunchInput,
  DocumentSourceLaunchInput,
  ExternalReferenceSourceLaunchInput,
  GitHubDiscussionSourceLaunchInput,
  NoteSourceLaunchInput,
  RuntimeNormalizedSourceLaunchSummary,
} from "@ku0/code-application/runtimeSourceLaunchNormalization";

export type GitHubIssueSourceLaunchInput = SharedSourceLaunchFields & {
  issue: Pick<GitHubIssue, "number" | "title" | "url" | "body" | "author" | "labels">;
};

export type GitHubPullRequestFollowUpSourceLaunchInput = SharedSourceLaunchFields & {
  pullRequest: Pick<
    GitHubPullRequest,
    "number" | "title" | "url" | "body" | "headRefName" | "baseRefName" | "isDraft" | "author"
  >;
  diffs?: GitHubPullRequestDiff[] | null;
  comments?: GitHubPullRequestComment[] | null;
};

export type GitHubIssueCommentCommandSourceLaunchInput = SharedSourceLaunchFields & {
  issue: Pick<GitHubIssue, "number" | "title" | "url" | "body" | "author" | "labels">;
  event: GitHubTaskSourceProvenanceInput["event"];
  command: Omit<GitHubTaskSourceProvenanceInput, "event"> & {
    comment?: GitHubTaskSourceCommentInput | null;
  };
};

export type GitHubPullRequestReviewCommentCommandSourceLaunchInput = SharedSourceLaunchFields & {
  pullRequest: Pick<
    GitHubPullRequest,
    "number" | "title" | "url" | "body" | "headRefName" | "baseRefName" | "isDraft" | "author"
  >;
  diffs?: GitHubPullRequestDiff[] | null;
  comments?: GitHubPullRequestComment[] | null;
  event: GitHubTaskSourceProvenanceInput["event"];
  command: Omit<GitHubTaskSourceProvenanceInput, "event"> & {
    comment?: GitHubTaskSourceCommentInput | null;
  };
};

export function normalizeGitHubIssueSourceLaunchInput(
  input: GitHubIssueSourceLaunchInput
): RuntimeNormalizedSourceLaunchSummary {
  const title = readOptionalText(input.issue.title) ?? `GitHub issue #${input.issue.number}`;
  return buildSourceLaunchSummary({
    kind: "github_issue",
    label: `GitHub issue #${input.issue.number}`,
    title,
    instruction: buildGitHubIssueInstruction({
      issue: input.issue,
    }),
    reference: `#${input.issue.number}`,
    url: input.issue.url,
    externalId: input.issue.url,
    canonicalUrl: input.issue.url,
    issueNumber: input.issue.number,
    preferredBackendIds: input.preferredBackendIds,
    sourceTaskId: input.sourceTaskId,
    sourceRunId: input.sourceRunId,
  });
}

export function normalizeGitHubIssueCommentCommandSourceLaunchInput(
  input: GitHubIssueCommentCommandSourceLaunchInput
): RuntimeNormalizedSourceLaunchSummary {
  const title = readOptionalText(input.issue.title) ?? `GitHub issue #${input.issue.number}`;
  return buildSourceLaunchSummary({
    kind: "github_issue",
    label: `GitHub issue #${input.issue.number}`,
    title,
    instruction: buildGitHubIssueCommentCommandInstruction({
      issue: input.issue,
      event: input.event,
      command: input.command,
    }),
    reference: `#${input.issue.number}`,
    url: input.issue.url,
    externalId: input.issue.url,
    canonicalUrl: input.issue.url,
    issueNumber: input.issue.number,
    preferredBackendIds: input.preferredBackendIds,
    sourceTaskId: input.sourceTaskId,
    sourceRunId: input.sourceRunId,
    taskSource: buildGitHubIssueTaskSource({
      issue: input.issue as GitHubIssue,
      sourceTaskId: input.sourceTaskId,
      sourceRunId: input.sourceRunId,
      githubSource: {
        ...input.command,
        event: input.event,
      },
    }),
  });
}

export function normalizeGitHubPullRequestFollowUpSourceLaunchInput(
  input: GitHubPullRequestFollowUpSourceLaunchInput
): RuntimeNormalizedSourceLaunchSummary {
  const title =
    readOptionalText(input.pullRequest.title) ?? `GitHub PR follow-up #${input.pullRequest.number}`;
  return buildSourceLaunchSummary({
    kind: "github_pr_followup",
    label: `GitHub PR follow-up #${input.pullRequest.number}`,
    title,
    instruction: buildGitHubPullRequestInstruction({
      pullRequest: input.pullRequest,
      diffs: input.diffs,
      comments: input.comments,
    }),
    reference: `#${input.pullRequest.number}`,
    url: input.pullRequest.url,
    externalId: input.pullRequest.url,
    canonicalUrl: input.pullRequest.url,
    pullRequestNumber: input.pullRequest.number,
    preferredBackendIds: input.preferredBackendIds,
    sourceTaskId: input.sourceTaskId,
    sourceRunId: input.sourceRunId,
  });
}

export function normalizeGitHubPullRequestReviewCommentCommandSourceLaunchInput(
  input: GitHubPullRequestReviewCommentCommandSourceLaunchInput
): RuntimeNormalizedSourceLaunchSummary {
  const title =
    readOptionalText(input.pullRequest.title) ?? `GitHub PR follow-up #${input.pullRequest.number}`;

  return buildSourceLaunchSummary({
    kind: "github_pr_followup",
    label: `GitHub PR follow-up #${input.pullRequest.number}`,
    title,
    instruction: buildGitHubPullRequestReviewCommentInstruction({
      pullRequest: input.pullRequest,
      diffs: input.diffs,
      comments: input.comments,
      event: input.event,
      command: input.command,
    }),
    reference: `#${input.pullRequest.number}`,
    url: input.pullRequest.url,
    externalId: input.pullRequest.url,
    canonicalUrl: input.pullRequest.url,
    pullRequestNumber: input.pullRequest.number,
    preferredBackendIds: input.preferredBackendIds,
    sourceTaskId: input.sourceTaskId,
    sourceRunId: input.sourceRunId,
    taskSource: buildGitHubPullRequestFollowUpTaskSource({
      pullRequest: input.pullRequest as GitHubPullRequest,
      sourceTaskId: input.sourceTaskId,
      sourceRunId: input.sourceRunId,
      githubSource: {
        ...input.command,
        event: input.event,
      },
    }),
  });
}
