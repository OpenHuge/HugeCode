import type {
  AgentTaskMissionBrief,
  AgentTaskSourceSummary,
} from "@ku0/code-runtime-host-contract";

export type RuntimeNormalizedSourceLaunchSummary = {
  title: string;
  instruction: string;
  missionBrief: AgentTaskMissionBrief;
  taskSource: AgentTaskSourceSummary;
};

export type RuntimeSourceLaunchSharedFields = {
  preferredBackendIds?: string[] | null;
  sourceTaskId?: string | null;
  sourceRunId?: string | null;
};

export type GitHubDiscussionSourceLaunchInput = RuntimeSourceLaunchSharedFields & {
  discussion: {
    number: number;
    title: string;
    url: string;
    body?: string | null;
    category?: string | null;
    author?: { login?: string | null } | null;
  };
};

export type NoteSourceLaunchInput = RuntimeSourceLaunchSharedFields & {
  note: {
    title: string;
    body?: string | null;
    sourceId?: string | null;
    canonicalUrl?: string | null;
  };
};

export type CustomerFeedbackSourceLaunchInput = RuntimeSourceLaunchSharedFields & {
  feedback: {
    customer: string;
    title: string;
    body?: string | null;
    sourceId?: string | null;
    canonicalUrl?: string | null;
    priority?: string | null;
  };
};

export type DocumentSourceLaunchInput = RuntimeSourceLaunchSharedFields & {
  document: {
    title: string;
    url: string;
    excerpt?: string | null;
  };
};

export type CallSummarySourceLaunchInput = RuntimeSourceLaunchSharedFields & {
  callSummary: {
    title: string;
    summary: string;
    attendees?: string[] | null;
    sourceId?: string | null;
    canonicalUrl?: string | null;
  };
};

export type ExternalReferenceSourceLaunchInput = RuntimeSourceLaunchSharedFields & {
  reference: {
    title: string;
    url: string;
    summary?: string | null;
  };
};

export function readRuntimeSourceLaunchText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeRuntimeSourceLaunchTextList(
  value: readonly string[] | null | undefined
): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const seen = new Set<string>();
  const items: string[] = [];
  for (const entry of value) {
    const normalized = readRuntimeSourceLaunchText(entry);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    items.push(normalized);
  }
  return items.length > 0 ? items : null;
}

function summarizeSourceId(urlOrSourceId: string, fallbackId?: string | null): string {
  return readRuntimeSourceLaunchText(fallbackId) ?? urlOrSourceId;
}

export function buildRuntimeSourceTaskSource(input: {
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
  const reference = readRuntimeSourceLaunchText(input.reference);
  const url = readRuntimeSourceLaunchText(input.url);
  return {
    kind: input.kind,
    label: input.label,
    title: input.title,
    ...(reference ? { reference } : {}),
    ...(url ? { url } : {}),
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

function buildRuntimeSourceMissionBrief(input: {
  objective: string;
  preferredBackendIds?: string[] | null;
}): AgentTaskMissionBrief {
  return {
    objective: input.objective,
    doneDefinition: null,
    constraints: null,
    riskLevel: "low",
    requiredCapabilities: null,
    maxSubtasks: null,
    preferredBackendIds: normalizeRuntimeSourceLaunchTextList(input.preferredBackendIds),
    permissionSummary: null,
  };
}

export function buildRuntimeSourceLaunchSummary(input: {
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
  const title = readRuntimeSourceLaunchText(input.title) ?? input.label;
  return {
    title,
    instruction: input.instruction,
    missionBrief: buildRuntimeSourceMissionBrief({
      objective: title,
      preferredBackendIds: input.preferredBackendIds,
    }),
    taskSource:
      input.taskSource ??
      buildRuntimeSourceTaskSource({
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

export function normalizeGitHubDiscussionSourceLaunchInput(
  input: GitHubDiscussionSourceLaunchInput
): RuntimeNormalizedSourceLaunchSummary {
  const title =
    readRuntimeSourceLaunchText(input.discussion.title) ??
    `GitHub discussion #${input.discussion.number}`;
  const lines = [
    `GitHub discussion #${input.discussion.number}: ${title}`,
    `URL: ${input.discussion.url}`,
  ];
  const category = readRuntimeSourceLaunchText(input.discussion.category);
  if (category) {
    lines.push(`Category: ${category}`);
  }
  const author = readRuntimeSourceLaunchText(input.discussion.author?.login);
  if (author) {
    lines.push(`Author: @${author}`);
  }
  const body = readRuntimeSourceLaunchText(input.discussion.body);
  lines.push("");
  if (body) {
    lines.push("Discussion summary:", body);
  } else {
    lines.push("Discussion summary unavailable.");
  }
  return buildRuntimeSourceLaunchSummary({
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
  const title = readRuntimeSourceLaunchText(input.note.title) ?? "Source note";
  const body = readRuntimeSourceLaunchText(input.note.body);
  const canonicalUrl = readRuntimeSourceLaunchText(input.note.canonicalUrl);
  const sourceId = readRuntimeSourceLaunchText(input.note.sourceId) ?? canonicalUrl ?? title;
  return buildRuntimeSourceLaunchSummary({
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
  const title = readRuntimeSourceLaunchText(input.feedback.title) ?? "Customer feedback";
  const body = readRuntimeSourceLaunchText(input.feedback.body);
  const canonicalUrl = readRuntimeSourceLaunchText(input.feedback.canonicalUrl);
  const priority = readRuntimeSourceLaunchText(input.feedback.priority);
  const sourceId =
    readRuntimeSourceLaunchText(input.feedback.sourceId) ?? canonicalUrl ?? input.feedback.customer;
  const lines = [`Customer feedback: ${title}`, `Customer: ${input.feedback.customer}`];
  if (priority) {
    lines.push(`Priority: ${priority}`);
  }
  lines.push("");
  lines.push(body ?? "Feedback body unavailable.");
  return buildRuntimeSourceLaunchSummary({
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
  const title = readRuntimeSourceLaunchText(input.document.title) ?? "Source document";
  const excerpt = readRuntimeSourceLaunchText(input.document.excerpt);
  return buildRuntimeSourceLaunchSummary({
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
  const title = readRuntimeSourceLaunchText(input.callSummary.title) ?? "Call summary";
  const attendees = normalizeRuntimeSourceLaunchTextList(input.callSummary.attendees);
  const canonicalUrl = readRuntimeSourceLaunchText(input.callSummary.canonicalUrl);
  const sourceId = readRuntimeSourceLaunchText(input.callSummary.sourceId) ?? canonicalUrl ?? title;
  const summary = readRuntimeSourceLaunchText(input.callSummary.summary);
  const lines = [`Call summary: ${title}`];
  if (attendees) {
    lines.push(`Attendees: ${attendees.join(", ")}`);
  }
  lines.push("", summary ?? "Call summary unavailable.");
  return buildRuntimeSourceLaunchSummary({
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
  const title = readRuntimeSourceLaunchText(input.reference.title) ?? "External reference";
  const summary = readRuntimeSourceLaunchText(input.reference.summary);
  return buildRuntimeSourceLaunchSummary({
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
