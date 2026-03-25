import type {
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

export type RuntimeNormalizedSourceLaunchSummary = {
  title: string;
  instruction: string;
  missionBrief: AgentTaskMissionBrief;
  taskSource: AgentTaskSourceSummary;
};

type SharedSourceLaunchFields = {
  preferredBackendIds?: string[] | null;
  sourceTaskId?: string | null;
  sourceRunId?: string | null;
};

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

export type GitHubDiscussionSourceLaunchInput = SharedSourceLaunchFields & {
  discussion: {
    number: number;
    title: string;
    url: string;
    body?: string | null;
    category?: string | null;
    author?: { login?: string | null } | null;
  };
};

export type NoteSourceLaunchInput = SharedSourceLaunchFields & {
  note: {
    title: string;
    body?: string | null;
    sourceId?: string | null;
    canonicalUrl?: string | null;
  };
};

export type CustomerFeedbackSourceLaunchInput = SharedSourceLaunchFields & {
  feedback: {
    customer: string;
    title: string;
    body?: string | null;
    sourceId?: string | null;
    canonicalUrl?: string | null;
    priority?: string | null;
  };
};

export type DocumentSourceLaunchInput = SharedSourceLaunchFields & {
  document: {
    title: string;
    url: string;
    excerpt?: string | null;
  };
};

export type CallSummarySourceLaunchInput = SharedSourceLaunchFields & {
  callSummary: {
    title: string;
    summary: string;
    attendees?: string[] | null;
    sourceId?: string | null;
    canonicalUrl?: string | null;
  };
};

export type ExternalReferenceSourceLaunchInput = SharedSourceLaunchFields & {
  reference: {
    title: string;
    url: string;
    summary?: string | null;
  };
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

function summarizeSourceId(urlOrSourceId: string, fallbackId?: string | null): string {
  return readOptionalText(fallbackId) ?? urlOrSourceId;
}

function buildSourceTaskSource(input: {
  kind: AgentTaskSourceSummary["kind"];
  label: string;
  title: string;
  reference?: string | null;
  url?: string | null;
  externalId: string;
  canonicalUrl: string | null;
  issueNumber?: number | null;
  pullRequestNumber?: number | null;
  sourceTaskId?: string | null;
  sourceRunId?: string | null;
}): AgentTaskSourceSummary {
  const sourceTaskId = summarizeSourceId(input.externalId, input.sourceTaskId);
  const sourceRunId = summarizeSourceId(input.externalId, input.sourceRunId);
  return {
    kind: input.kind,
    label: input.label,
    title: input.title,
    ...(readOptionalText(input.reference) ? { reference: readOptionalText(input.reference) } : {}),
    ...(readOptionalText(input.url) ? { url: readOptionalText(input.url) } : {}),
    ...(typeof input.issueNumber === "number" ? { issueNumber: input.issueNumber } : {}),
    ...(typeof input.pullRequestNumber === "number"
      ? { pullRequestNumber: input.pullRequestNumber }
      : {}),
    externalId: input.externalId,
    canonicalUrl: input.canonicalUrl,
    threadId: null,
    requestId: null,
    sourceTaskId,
    sourceRunId,
  };
}

function buildSourceLaunchSummary(input: {
  kind: AgentTaskSourceSummary["kind"];
  label: string;
  title: string;
  instruction: string;
  reference?: string | null;
  url?: string | null;
  externalId: string;
  canonicalUrl: string | null;
  issueNumber?: number | null;
  pullRequestNumber?: number | null;
  preferredBackendIds?: string[] | null;
  sourceTaskId?: string | null;
  sourceRunId?: string | null;
}): RuntimeNormalizedSourceLaunchSummary {
  const title = readOptionalText(input.title) ?? input.label;
  const preferredBackendIds = normalizeOptionalTextList(input.preferredBackendIds);
  return {
    title,
    instruction: input.instruction,
    missionBrief: buildAgentTaskMissionBrief({
      objective: title,
      accessMode: null,
      preferredBackendIds,
    }),
    taskSource: buildSourceTaskSource({
      kind: input.kind,
      label: input.label,
      title,
      reference: input.reference,
      url: input.url,
      externalId: input.externalId,
      canonicalUrl: input.canonicalUrl,
      issueNumber: input.issueNumber,
      pullRequestNumber: input.pullRequestNumber,
      sourceTaskId: input.sourceTaskId,
      sourceRunId: input.sourceRunId,
    }),
  };
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

export function normalizeGitHubIssueSourceLaunchInput(
  input: GitHubIssueSourceLaunchInput
): RuntimeNormalizedSourceLaunchSummary {
  const title = readOptionalText(input.issue.title) ?? `GitHub issue #${input.issue.number}`;
  const author = readOptionalText(input.issue.author?.login);
  const labels = normalizeOptionalTextList(input.issue.labels);
  const body = readOptionalText(input.issue.body);
  const lines = [`GitHub issue #${input.issue.number}: ${title}`, `URL: ${input.issue.url}`];
  if (author) {
    lines.push(`Author: @${author}`);
  }
  if (labels) {
    lines.push(`Labels: ${labels.join(", ")}`);
  }
  lines.push("");
  if (body) {
    lines.push("Issue body:", body);
  } else {
    lines.push("Issue body unavailable.");
  }
  return buildSourceLaunchSummary({
    kind: "github_issue",
    label: `GitHub issue #${input.issue.number}`,
    title,
    instruction: lines.join("\n"),
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

export function normalizeGitHubPullRequestFollowUpSourceLaunchInput(
  input: GitHubPullRequestFollowUpSourceLaunchInput
): RuntimeNormalizedSourceLaunchSummary {
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

  return buildSourceLaunchSummary({
    kind: "github_pr_followup",
    label: `GitHub PR follow-up #${input.pullRequest.number}`,
    title,
    instruction: lines.join("\n"),
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

export function normalizeGitHubDiscussionSourceLaunchInput(
  input: GitHubDiscussionSourceLaunchInput
): RuntimeNormalizedSourceLaunchSummary {
  const title =
    readOptionalText(input.discussion.title) ?? `GitHub discussion #${input.discussion.number}`;
  const lines = [
    `GitHub discussion #${input.discussion.number}: ${title}`,
    `URL: ${input.discussion.url}`,
  ];
  const category = readOptionalText(input.discussion.category);
  if (category) {
    lines.push(`Category: ${category}`);
  }
  const author = readOptionalText(input.discussion.author?.login);
  if (author) {
    lines.push(`Author: @${author}`);
  }
  const body = readOptionalText(input.discussion.body);
  lines.push("");
  if (body) {
    lines.push("Discussion summary:", body);
  } else {
    lines.push("Discussion summary unavailable.");
  }
  return buildSourceLaunchSummary({
    kind: "github_discussion",
    label: `GitHub discussion #${input.discussion.number}`,
    title,
    instruction: lines.join("\n"),
    reference: `#${input.discussion.number}`,
    url: input.discussion.url,
    externalId: input.discussion.url,
    canonicalUrl: input.discussion.url,
    preferredBackendIds: input.preferredBackendIds,
    sourceTaskId: input.sourceTaskId,
    sourceRunId: input.sourceRunId,
  });
}

export function normalizeNoteSourceLaunchInput(
  input: NoteSourceLaunchInput
): RuntimeNormalizedSourceLaunchSummary {
  const title = readOptionalText(input.note.title) ?? "Source note";
  const body = readOptionalText(input.note.body);
  const canonicalUrl = readOptionalText(input.note.canonicalUrl);
  const sourceId = readOptionalText(input.note.sourceId) ?? canonicalUrl ?? title;
  return buildSourceLaunchSummary({
    kind: "note",
    label: "Operator note",
    title,
    instruction: [`Operator note: ${title}`, body ?? "Note body unavailable."].join("\n\n"),
    externalId: sourceId,
    canonicalUrl,
    url: canonicalUrl,
    preferredBackendIds: input.preferredBackendIds,
    sourceTaskId: input.sourceTaskId,
    sourceRunId: input.sourceRunId,
  });
}

export function normalizeCustomerFeedbackSourceLaunchInput(
  input: CustomerFeedbackSourceLaunchInput
): RuntimeNormalizedSourceLaunchSummary {
  const title = readOptionalText(input.feedback.title) ?? "Customer feedback";
  const body = readOptionalText(input.feedback.body);
  const canonicalUrl = readOptionalText(input.feedback.canonicalUrl);
  const priority = readOptionalText(input.feedback.priority);
  const sourceId =
    readOptionalText(input.feedback.sourceId) ?? canonicalUrl ?? input.feedback.customer;
  const lines = [`Customer feedback: ${title}`, `Customer: ${input.feedback.customer}`];
  if (priority) {
    lines.push(`Priority: ${priority}`);
  }
  lines.push("");
  lines.push(body ?? "Feedback body unavailable.");
  return buildSourceLaunchSummary({
    kind: "customer_feedback",
    label: "Customer feedback",
    title,
    instruction: lines.join("\n"),
    externalId: sourceId,
    canonicalUrl,
    url: canonicalUrl,
    preferredBackendIds: input.preferredBackendIds,
    sourceTaskId: input.sourceTaskId,
    sourceRunId: input.sourceRunId,
  });
}

export function normalizeDocumentSourceLaunchInput(
  input: DocumentSourceLaunchInput
): RuntimeNormalizedSourceLaunchSummary {
  const title = readOptionalText(input.document.title) ?? "Source document";
  const excerpt = readOptionalText(input.document.excerpt);
  return buildSourceLaunchSummary({
    kind: "doc",
    label: "Document brief",
    title,
    instruction: [
      `Document context: ${title}`,
      `URL: ${input.document.url}`,
      "",
      excerpt ?? "Document excerpt unavailable.",
    ].join("\n"),
    url: input.document.url,
    externalId: input.document.url,
    canonicalUrl: input.document.url,
    preferredBackendIds: input.preferredBackendIds,
    sourceTaskId: input.sourceTaskId,
    sourceRunId: input.sourceRunId,
  });
}

export function normalizeCallSummarySourceLaunchInput(
  input: CallSummarySourceLaunchInput
): RuntimeNormalizedSourceLaunchSummary {
  const title = readOptionalText(input.callSummary.title) ?? "Call summary";
  const attendees = normalizeOptionalTextList(input.callSummary.attendees);
  const canonicalUrl = readOptionalText(input.callSummary.canonicalUrl);
  const sourceId = readOptionalText(input.callSummary.sourceId) ?? canonicalUrl ?? title;
  const lines = [`Call summary: ${title}`];
  if (attendees) {
    lines.push(`Attendees: ${attendees.join(", ")}`);
  }
  lines.push("", input.callSummary.summary.trim());
  return buildSourceLaunchSummary({
    kind: "call_summary",
    label: "Call summary",
    title,
    instruction: lines.join("\n"),
    externalId: sourceId,
    canonicalUrl,
    url: canonicalUrl,
    preferredBackendIds: input.preferredBackendIds,
    sourceTaskId: input.sourceTaskId,
    sourceRunId: input.sourceRunId,
  });
}

export function normalizeExternalReferenceSourceLaunchInput(
  input: ExternalReferenceSourceLaunchInput
): RuntimeNormalizedSourceLaunchSummary {
  const title = readOptionalText(input.reference.title) ?? "External reference";
  const summary = readOptionalText(input.reference.summary);
  return buildSourceLaunchSummary({
    kind: "external_ref",
    label: "External reference",
    title,
    instruction: [
      `External reference: ${title}`,
      `URL: ${input.reference.url}`,
      "",
      summary ?? "Reference summary unavailable.",
    ].join("\n"),
    url: input.reference.url,
    externalId: input.reference.url,
    canonicalUrl: input.reference.url,
    preferredBackendIds: input.preferredBackendIds,
    sourceTaskId: input.sourceTaskId,
    sourceRunId: input.sourceRunId,
  });
}
