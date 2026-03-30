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
  githubSource?: AgentTaskSourceSummary["githubSource"];
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
    githubSource: input.githubSource ?? null,
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
  taskSource?: AgentTaskSourceSummary;
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
    taskSource:
      input.taskSource ??
      buildSourceTaskSource({
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
