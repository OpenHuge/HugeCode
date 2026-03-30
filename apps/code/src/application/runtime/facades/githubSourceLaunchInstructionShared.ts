import type {
  GitHubIssue,
  GitHubPullRequest,
  GitHubPullRequestComment,
  GitHubPullRequestDiff,
} from "../../../types";
import type {
  GitHubTaskSourceCommentInput,
  GitHubTaskSourceProvenanceInput,
} from "./runtimeTaskSourceFacade";

export function readOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeOptionalTextList(
  value: readonly string[] | null | undefined
): string[] | null {
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

function readCommentId(comment: GitHubTaskSourceCommentInput | null | undefined): number | null {
  if (typeof comment?.commentId === "number") {
    return comment.commentId;
  }
  return typeof comment?.id === "number" ? comment.id : null;
}

function buildGitHubEventLabel(event: GitHubTaskSourceProvenanceInput["event"]): string {
  return readOptionalText(event.action)
    ? `${event.eventName}.${readOptionalText(event.action)}`
    : event.eventName;
}

export function buildGitHubIssueInstruction(input: {
  issue: Pick<GitHubIssue, "number" | "title" | "url" | "body" | "author" | "labels">;
  heading?: string | null;
}): string {
  const title = readOptionalText(input.issue.title) ?? `GitHub issue #${input.issue.number}`;
  const lines = [
    input.heading ?? `GitHub issue #${input.issue.number}: ${title}`,
    `URL: ${input.issue.url}`,
  ];
  const author = readOptionalText(input.issue.author?.login);
  if (author) {
    lines.push(`Author: @${author}`);
  }
  const labels = normalizeOptionalTextList(input.issue.labels);
  if (labels) {
    lines.push(`Labels: ${labels.join(", ")}`);
  }
  const body = readOptionalText(input.issue.body);
  lines.push("");
  if (body) {
    lines.push("Issue body:", body);
  } else {
    lines.push("Issue body unavailable.");
  }
  return lines.join("\n");
}

export function buildGitHubPullRequestInstruction(input: {
  pullRequest: Pick<
    GitHubPullRequest,
    "number" | "title" | "url" | "body" | "headRefName" | "baseRefName" | "isDraft" | "author"
  >;
  diffs?: GitHubPullRequestDiff[] | null;
  comments?: GitHubPullRequestComment[] | null;
  heading?: string | null;
}): string {
  const title =
    readOptionalText(input.pullRequest.title) ?? `GitHub PR follow-up #${input.pullRequest.number}`;
  const lines = [
    input.heading ?? `GitHub PR follow-up #${input.pullRequest.number}: ${title}`,
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

export function buildIssueCommentCommandContextLines(input: {
  event: GitHubTaskSourceProvenanceInput["event"];
  command: {
    triggerMode?: GitHubTaskSourceProvenanceInput["triggerMode"];
    commandKind?: GitHubTaskSourceProvenanceInput["commandKind"];
    comment?: GitHubTaskSourceCommentInput | null;
  };
}): string[] {
  const lines = ["", "Comment command context:"];
  lines.push(`GitHub event: ${buildGitHubEventLabel(input.event)}`);
  const triggerMode = readOptionalText(input.command.triggerMode);
  if (triggerMode) {
    lines.push(`Trigger mode: ${triggerMode}`);
  }
  const commandKind = readOptionalText(input.command.commandKind);
  if (commandKind) {
    lines.push(`Command: ${commandKind}`);
  }
  const commentAuthor = readOptionalText(input.command.comment?.author?.login);
  if (commentAuthor) {
    lines.push(`Comment author: @${commentAuthor}`);
  }
  const commentUrl = readOptionalText(input.command.comment?.url);
  if (commentUrl) {
    lines.push(`Comment URL: ${commentUrl}`);
  }
  const commentBody = readOptionalText(input.command.comment?.body);
  const commentId = readCommentId(input.command.comment);
  if (commentBody) {
    lines.push(`Command comment summary: ${commentBody}`);
  } else if (commentId !== null || commentUrl || commentAuthor) {
    lines.push("Command comment summary unavailable.");
  } else {
    lines.push("Command comment context unavailable.");
  }
  lines.push(
    "Follow-up defaults: Stay anchored to the linked GitHub command, issue, and repository evidence."
  );
  return lines;
}

export function buildGitHubIssueCommentCommandInstruction(input: {
  issue: Pick<GitHubIssue, "number" | "title" | "url" | "body" | "author" | "labels">;
  event: GitHubTaskSourceProvenanceInput["event"];
  command: {
    triggerMode?: GitHubTaskSourceProvenanceInput["triggerMode"];
    commandKind?: GitHubTaskSourceProvenanceInput["commandKind"];
    comment?: GitHubTaskSourceCommentInput | null;
  };
}): string {
  const title = readOptionalText(input.issue.title) ?? `GitHub issue #${input.issue.number}`;
  const lines = buildGitHubIssueInstruction({
    issue: input.issue,
    heading: `GitHub issue follow-up from issue comment #${input.issue.number}: ${title}`,
  }).split("\n");
  lines.push(
    ...buildIssueCommentCommandContextLines({
      event: input.event,
      command: input.command,
    })
  );
  return lines.join("\n");
}

export function buildReviewCommentCommandContextLines(input: {
  event: GitHubTaskSourceProvenanceInput["event"];
  command: {
    triggerMode?: GitHubTaskSourceProvenanceInput["triggerMode"];
    commandKind?: GitHubTaskSourceProvenanceInput["commandKind"];
    comment?: GitHubTaskSourceCommentInput | null;
  };
}): string[] {
  const lines = ["", "Review comment context:"];
  lines.push(`GitHub event: ${buildGitHubEventLabel(input.event)}`);
  const triggerMode = readOptionalText(input.command.triggerMode);
  if (triggerMode) {
    lines.push(`Trigger mode: ${triggerMode}`);
  }
  const commandKind = readOptionalText(input.command.commandKind);
  if (commandKind) {
    lines.push(`Command: ${commandKind}`);
  }
  const commentAuthor = readOptionalText(input.command.comment?.author?.login);
  if (commentAuthor) {
    lines.push(`Review comment author: @${commentAuthor}`);
  }
  const commentUrl = readOptionalText(input.command.comment?.url);
  if (commentUrl) {
    lines.push(`Review comment URL: ${commentUrl}`);
  }
  const commentBody = readOptionalText(input.command.comment?.body);
  const commentId = readCommentId(input.command.comment);
  if (commentBody) {
    lines.push(`Review comment summary: ${commentBody}`);
  } else if (commentId !== null || commentUrl || commentAuthor) {
    lines.push("Review comment summary unavailable.");
  } else {
    lines.push("Review comment context unavailable.");
  }
  lines.push(
    "Follow-up defaults: Stay anchored to the linked GitHub review command, pull request, and repository evidence."
  );
  return lines;
}

export function buildGitHubPullRequestReviewCommentInstruction(input: {
  pullRequest: Pick<
    GitHubPullRequest,
    "number" | "title" | "url" | "body" | "headRefName" | "baseRefName" | "isDraft" | "author"
  >;
  diffs?: GitHubPullRequestDiff[] | null;
  comments?: GitHubPullRequestComment[] | null;
  event: GitHubTaskSourceProvenanceInput["event"];
  command: {
    triggerMode?: GitHubTaskSourceProvenanceInput["triggerMode"];
    commandKind?: GitHubTaskSourceProvenanceInput["commandKind"];
    comment?: GitHubTaskSourceCommentInput | null;
  };
}): string {
  const title =
    readOptionalText(input.pullRequest.title) ?? `GitHub PR follow-up #${input.pullRequest.number}`;
  const lines = buildGitHubPullRequestInstruction({
    pullRequest: input.pullRequest,
    diffs: input.diffs,
    comments: input.comments,
    heading: `GitHub PR review-comment follow-up #${input.pullRequest.number}: ${title}`,
  }).split("\n");
  lines.push(
    ...buildReviewCommentCommandContextLines({
      event: input.event,
      command: input.command,
    })
  );
  return lines.join("\n");
}
