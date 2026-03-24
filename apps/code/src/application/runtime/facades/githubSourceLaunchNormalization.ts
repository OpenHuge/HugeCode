import type {
  AccessMode,
  AgentTaskMissionBrief,
  AgentTaskSourceSummary,
} from "@ku0/code-runtime-host-contract";
import type {
  GitHubIssue,
  GitHubPullRequest,
  GitHubPullRequestComment,
  GitHubPullRequestDiff,
} from "../../../types";
import { buildAgentTaskMissionBrief } from "./runtimeMissionDraftFacade";
import {
  resolveRepositoryExecutionDefaults,
  type RepositoryExecutionContract,
} from "./runtimeRepositoryExecutionContract";

export type GitHubSourceLaunchSummary = {
  title: string;
  instruction: string;
  missionBrief: AgentTaskMissionBrief;
  taskSource: AgentTaskSourceSummary;
  executionProfileId: string | null;
  reviewProfileId: string | null;
  validationPresetId: string | null;
  accessMode: AccessMode | null;
  preferredBackendIds: string[] | null;
};

export type GitHubIssueSourceLaunchInput = {
  issue: Pick<GitHubIssue, "number" | "title" | "url" | "body" | "author" | "labels">;
  repositoryExecutionContract?: RepositoryExecutionContract | null;
  preferredBackendIds?: string[] | null;
  sourceTaskId?: string | null;
  sourceRunId?: string | null;
};

export type GitHubPullRequestFollowUpSourceLaunchInput = {
  pullRequest: Pick<
    GitHubPullRequest,
    "number" | "title" | "url" | "body" | "headRefName" | "baseRefName" | "isDraft" | "author"
  >;
  diffs?: GitHubPullRequestDiff[] | null;
  comments?: GitHubPullRequestComment[] | null;
  repositoryExecutionContract?: RepositoryExecutionContract | null;
  preferredBackendIds?: string[] | null;
  sourceTaskId?: string | null;
  sourceRunId?: string | null;
};

function readOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalTextList(value: readonly string[] | null | undefined): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const seen = new Set<string>();
  const items: string[] = [];
  for (const entry of value) {
    const normalized = readOptionalText(entry);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    items.push(normalized);
  }
  return items.length > 0 ? items : null;
}

function summarizeSourceId(url: string, fallbackId?: string | null): string {
  return readOptionalText(fallbackId) ?? url;
}

function summarizeGitHubPullRequestComments(
  comments: GitHubPullRequestComment[] | null | undefined
): string[] {
  if (!Array.isArray(comments)) {
    return [];
  }
  const summary: string[] = [];
  for (const comment of comments) {
    const body = readOptionalText(comment.body);
    if (!body) {
      continue;
    }
    const author = readOptionalText(comment.author?.login);
    summary.push(author ? `@${author}: ${body}` : body);
    if (summary.length >= 3) {
      break;
    }
  }
  return summary;
}

function summarizeGitHubPullRequestDiffs(
  diffs: GitHubPullRequestDiff[] | null | undefined
): string[] {
  if (!Array.isArray(diffs)) {
    return [];
  }
  const seen = new Set<string>();
  const paths: string[] = [];
  for (const diff of diffs) {
    const path = readOptionalText(diff.path);
    if (!path || seen.has(path)) {
      continue;
    }
    seen.add(path);
    paths.push(path);
    if (paths.length >= 8) {
      break;
    }
  }
  return paths;
}

function buildGitHubIssueInstruction(input: GitHubIssueSourceLaunchInput["issue"]): string {
  const title = readOptionalText(input.title) ?? `GitHub issue #${input.number}`;
  const lines = [`GitHub issue #${input.number}: ${title}`, `URL: ${input.url}`];
  const author = readOptionalText(input.author?.login);
  if (author) {
    lines.push(`Author: @${author}`);
  }
  const labels = normalizeOptionalTextList(input.labels);
  if (labels) {
    lines.push(`Labels: ${labels.join(", ")}`);
  }
  const body = readOptionalText(input.body);
  lines.push("");
  if (body) {
    lines.push("Issue body:", body);
  } else {
    lines.push("Issue body unavailable.");
  }
  return lines.join("\n");
}

function buildGitHubPullRequestFollowUpInstruction(
  input: GitHubPullRequestFollowUpSourceLaunchInput
): string {
  const title =
    readOptionalText(input.pullRequest.title) ?? `GitHub PR follow-up #${input.pullRequest.number}`;
  const lines = [
    `GitHub PR follow-up #${input.pullRequest.number}: ${title}`,
    `URL: ${input.pullRequest.url}`,
    `Branches: ${input.pullRequest.baseRefName} <- ${input.pullRequest.headRefName}`,
  ];
  const author = readOptionalText(input.pullRequest.author?.login);
  if (author) {
    lines.push(`Author: @${author}`);
  }
  if (input.pullRequest.isDraft) {
    lines.push("State: draft");
  }
  const body = readOptionalText(input.pullRequest.body);
  lines.push("");
  if (body) {
    lines.push("Pull request body:", body);
  } else {
    lines.push("Pull request body unavailable.");
  }

  const changedFiles = summarizeGitHubPullRequestDiffs(input.diffs);
  lines.push("");
  if (changedFiles.length > 0) {
    lines.push(`Changed files (${changedFiles.length}):`);
    lines.push(...changedFiles.map((path) => `- ${path}`));
  } else {
    lines.push("Changed files unavailable.");
  }

  const discussionNotes = summarizeGitHubPullRequestComments(input.comments);
  lines.push("");
  if (discussionNotes.length > 0) {
    lines.push("Discussion notes:");
    lines.push(...discussionNotes.map((note) => `- ${note}`));
  } else {
    lines.push("Discussion notes unavailable.");
  }

  return lines.join("\n");
}

function buildGitHubSourceTaskSource(input: {
  kind: AgentTaskSourceSummary["kind"];
  label: string;
  title: string;
  externalId: string;
  canonicalUrl: string;
  sourceTaskId?: string | null;
  sourceRunId?: string | null;
}): AgentTaskSourceSummary {
  const sourceTaskId = summarizeSourceId(input.externalId, input.sourceTaskId);
  const sourceRunId = summarizeSourceId(input.externalId, input.sourceRunId);
  return {
    kind: input.kind,
    label: input.label,
    title: input.title,
    externalId: input.externalId,
    canonicalUrl: input.canonicalUrl,
    threadId: null,
    requestId: null,
    sourceTaskId,
    sourceRunId,
  };
}

function buildGitHubSourceLaunchSummary(input: {
  kind: AgentTaskSourceSummary["kind"];
  label: string;
  title: string;
  externalId: string;
  canonicalUrl: string;
  instruction: string;
  repositoryExecutionContract?: RepositoryExecutionContract | null;
  preferredBackendIds?: string[] | null;
  sourceTaskId?: string | null;
  sourceRunId?: string | null;
}): GitHubSourceLaunchSummary {
  const title = readOptionalText(input.title) ?? input.label;
  const explicitPreferredBackendIds = normalizeOptionalTextList(input.preferredBackendIds);
  const taskSource = buildGitHubSourceTaskSource({
    kind: input.kind,
    label: input.label,
    title,
    externalId: input.externalId,
    canonicalUrl: input.canonicalUrl,
    sourceTaskId: input.sourceTaskId,
    sourceRunId: input.sourceRunId,
  });
  const launchDefaults = resolveRepositoryExecutionDefaults({
    contract: input.repositoryExecutionContract ?? null,
    taskSource,
    explicitLaunchInput: explicitPreferredBackendIds
      ? { preferredBackendIds: explicitPreferredBackendIds }
      : undefined,
  });
  const preferredBackendIds = launchDefaults.preferredBackendIds ?? null;
  return {
    title,
    instruction: input.instruction,
    missionBrief: buildAgentTaskMissionBrief({
      objective: title,
      accessMode: launchDefaults.accessMode,
      preferredBackendIds,
    }),
    taskSource,
    executionProfileId: launchDefaults.executionProfileId,
    reviewProfileId: launchDefaults.reviewProfileId,
    validationPresetId: launchDefaults.validationPresetId,
    accessMode: launchDefaults.accessMode,
    preferredBackendIds,
  };
}

export function normalizeGitHubIssueLaunchInput(
  input: GitHubIssueSourceLaunchInput
): GitHubSourceLaunchSummary {
  const title = readOptionalText(input.issue.title) ?? `GitHub issue #${input.issue.number}`;
  return buildGitHubSourceLaunchSummary({
    kind: "github_issue",
    label: `GitHub issue #${input.issue.number}`,
    title,
    externalId: input.issue.url,
    canonicalUrl: input.issue.url,
    instruction: buildGitHubIssueInstruction(input.issue),
    repositoryExecutionContract: input.repositoryExecutionContract,
    preferredBackendIds: input.preferredBackendIds,
    sourceTaskId: input.sourceTaskId,
    sourceRunId: input.sourceRunId,
  });
}

export function normalizeGitHubPullRequestFollowUpLaunchInput(
  input: GitHubPullRequestFollowUpSourceLaunchInput
): GitHubSourceLaunchSummary {
  const title =
    readOptionalText(input.pullRequest.title) ?? `GitHub PR follow-up #${input.pullRequest.number}`;
  return buildGitHubSourceLaunchSummary({
    kind: "github_pr_followup",
    label: `GitHub PR follow-up #${input.pullRequest.number}`,
    title,
    externalId: input.pullRequest.url,
    canonicalUrl: input.pullRequest.url,
    instruction: buildGitHubPullRequestFollowUpInstruction(input),
    repositoryExecutionContract: input.repositoryExecutionContract,
    preferredBackendIds: input.preferredBackendIds,
    sourceTaskId: input.sourceTaskId,
    sourceRunId: input.sourceRunId,
  });
}
