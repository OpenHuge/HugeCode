import type {
  HugeCodeNextOperatorAction,
  HugeCodeTaskSourceLinkage,
  HugeCodeTaskSourceSummary,
} from "@ku0/code-runtime-host-contract";

export type TaskSourceProvenanceDetail = {
  summary: string;
  details: string[];
};

function readOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function inferReference(
  source: HugeCodeTaskSourceSummary | HugeCodeTaskSourceLinkage
): string | null {
  if (source.reference?.trim()) {
    return source.reference.trim();
  }
  if (typeof source.issueNumber === "number") {
    return `#${source.issueNumber}`;
  }
  if (typeof source.pullRequestNumber === "number") {
    return `#${source.pullRequestNumber}`;
  }
  return null;
}

function buildGitHubTaskSourceLabels(input: {
  labelPrefix: string;
  shortPrefix: string;
  reference: string | null;
  repo: string | null;
}): Pick<HugeCodeTaskSourceLinkage, "label" | "shortLabel"> {
  return {
    label: input.reference
      ? input.repo
        ? `${input.labelPrefix} ${input.reference} · ${input.repo}`
        : `${input.labelPrefix} ${input.reference}`
      : input.repo
        ? `${input.labelPrefix} · ${input.repo}`
        : input.labelPrefix,
    shortLabel: input.reference ? `${input.shortPrefix} ${input.reference}` : input.labelPrefix,
  };
}

function buildTaskSourceLabels(
  source: HugeCodeTaskSourceSummary | HugeCodeTaskSourceLinkage
): Pick<HugeCodeTaskSourceLinkage, "label" | "shortLabel"> {
  const reference = inferReference(source);
  const repo = readOptionalText(source.repo?.fullName);
  switch (source.kind) {
    case "manual_thread":
      return {
        label: "Manual thread",
        shortLabel: "Manual",
      };
    case "schedule":
      return {
        label: "Scheduled task",
        shortLabel: "Schedule",
      };
    case "external_runtime":
      return {
        label: "External runtime",
        shortLabel: "External",
      };
    case "github_issue":
      return buildGitHubTaskSourceLabels({
        labelPrefix: "GitHub issue",
        shortPrefix: "Issue",
        reference,
        repo,
      });
    case "github_pr_followup":
      return buildGitHubTaskSourceLabels({
        labelPrefix: "PR follow-up",
        shortPrefix: "PR",
        reference,
        repo,
      });
    case "github_discussion":
      return buildGitHubTaskSourceLabels({
        labelPrefix: "GitHub discussion",
        shortPrefix: "Discussion",
        reference,
        repo,
      });
    case "note":
      return {
        label: "Operator note",
        shortLabel: "Note",
      };
    case "customer_feedback":
      return {
        label: "Customer feedback",
        shortLabel: "Feedback",
      };
    case "doc":
      return {
        label: "Document brief",
        shortLabel: "Doc",
      };
    case "call_summary":
      return {
        label: "Call summary",
        shortLabel: "Call",
      };
    case "external_ref":
      return {
        label: "External reference",
        shortLabel: "Reference",
      };
    case "manual":
      return {
        label: "Manual request",
        shortLabel: "Manual",
      };
    default:
      return {
        label: "Task source",
        shortLabel: "Source",
      };
  }
}

export function normalizeTaskSourceLinkage(
  source: HugeCodeTaskSourceLinkage | HugeCodeTaskSourceSummary | null | undefined
): HugeCodeTaskSourceLinkage | null {
  if (!source) {
    return null;
  }
  const labels = buildTaskSourceLabels(source);
  return {
    kind: source.kind,
    label: readOptionalText("label" in source ? source.label : null) ?? labels.label,
    shortLabel:
      readOptionalText("shortLabel" in source ? source.shortLabel : null) ?? labels.shortLabel,
    title: readOptionalText(source.title),
    reference: inferReference(source),
    url: readOptionalText(source.url) ?? readOptionalText(source.canonicalUrl),
    issueNumber: typeof source.issueNumber === "number" ? source.issueNumber : null,
    pullRequestNumber:
      typeof source.pullRequestNumber === "number" ? source.pullRequestNumber : null,
    repo: source.repo ?? null,
    workspaceId: readOptionalText(source.workspaceId),
    workspaceRoot: readOptionalText(source.workspaceRoot),
    externalId: readOptionalText(source.externalId),
    canonicalUrl: readOptionalText(source.canonicalUrl),
    threadId: readOptionalText(source.threadId),
    requestId: readOptionalText(source.requestId),
    sourceTaskId: readOptionalText(source.sourceTaskId),
    sourceRunId: readOptionalText(source.sourceRunId),
    githubSource: source.githubSource ?? null,
  };
}

export function resolveTaskSourceSecondaryLabel(
  source: HugeCodeTaskSourceLinkage | HugeCodeTaskSourceSummary | null | undefined
): string | null {
  return normalizeTaskSourceLinkage(source)?.shortLabel ?? null;
}

function buildGitHubEventLabel(
  source: NonNullable<HugeCodeTaskSourceSummary["githubSource"]>
): string {
  return source.event.action
    ? `${source.event.eventName}.${source.event.action}`
    : source.event.eventName;
}

function formatLaunchHandshakeState(
  state: NonNullable<HugeCodeTaskSourceSummary["githubSource"]>["launchHandshake"]["state"]
) {
  switch (state) {
    case "prepared":
      return "Prepared";
    case "started":
      return "Started";
    case "intervened":
      return "Attached to active run";
    case "deduped":
      return "Deduped";
    case "blocked":
      return "Blocked";
    case "failed":
      return "Failed";
    default:
      return "Runtime-owned";
  }
}

function formatNextOperatorAction(
  nextOperatorAction: HugeCodeNextOperatorAction | null | undefined
): string | null {
  if (!nextOperatorAction?.label) {
    return null;
  }
  return nextOperatorAction.detail
    ? `${nextOperatorAction.label}: ${nextOperatorAction.detail}`
    : nextOperatorAction.label;
}

export function buildTaskSourceProvenanceDetail(input: {
  source: HugeCodeTaskSourceLinkage | HugeCodeTaskSourceSummary | null | undefined;
  nextOperatorAction?: HugeCodeNextOperatorAction | null | undefined;
}): TaskSourceProvenanceDetail | undefined {
  const normalized = normalizeTaskSourceLinkage(input.source);
  const githubSource = normalized?.githubSource;
  if (!normalized || !githubSource) {
    return undefined;
  }
  const repoLabel = readOptionalText(githubSource.repo.fullName) ?? "GitHub repository";
  const eventLabel = buildGitHubEventLabel(githubSource);
  const handshakeLabel = formatLaunchHandshakeState(githubSource.launchHandshake.state);
  const nextOperatorAction = formatNextOperatorAction(input.nextOperatorAction);
  const details = [
    `Source repo: ${repoLabel}`,
    `Source ref: ${githubSource.ref.label}`,
    `GitHub event: ${eventLabel}`,
    githubSource.comment?.commentId
      ? `Source comment: #${githubSource.comment.commentId}${githubSource.comment.author?.login ? ` by ${githubSource.comment.author.login}` : ""}`
      : null,
    `Source record: ${githubSource.sourceRecordId}`,
    `Launch handshake: ${handshakeLabel}`,
    githubSource.launchHandshake.preparedPlanVersion
      ? `Prepared plan version: ${githubSource.launchHandshake.preparedPlanVersion}`
      : null,
    githubSource.launchHandshake.approvedPlanVersion
      ? `Approved plan version: ${githubSource.launchHandshake.approvedPlanVersion}`
      : null,
    githubSource.launchHandshake.summary,
    nextOperatorAction ? `Next operator action: ${nextOperatorAction}` : null,
  ].filter((value): value is string => Boolean(value));
  return {
    summary: `${normalized.label} started from ${eventLabel} in ${repoLabel}.`,
    details,
  };
}

export function buildTaskSourceProvenanceSummary(input: {
  source: HugeCodeTaskSourceLinkage | HugeCodeTaskSourceSummary | null | undefined;
  nextOperatorAction?: HugeCodeNextOperatorAction | null | undefined;
}) {
  const detail = buildTaskSourceProvenanceDetail(input);
  if (!detail) {
    return null;
  }
  const githubSource = normalizeTaskSourceLinkage(input.source)?.githubSource;
  if (!githubSource) {
    return null;
  }
  return [
    `Launch source: ${githubSource.repo.fullName ?? "GitHub"}`,
    githubSource.ref.label,
    buildGitHubEventLabel(githubSource),
    `record ${githubSource.sourceRecordId}`,
    `handshake ${formatLaunchHandshakeState(githubSource.launchHandshake.state).toLowerCase()}`,
  ].join(" | ");
}

export function buildTaskSourceLineageDetails(
  source: HugeCodeTaskSourceLinkage | HugeCodeTaskSourceSummary | null | undefined
): string[] {
  const normalized = normalizeTaskSourceLinkage(source);
  if (!normalized) {
    return [];
  }
  const details = [`Task source: ${normalized.label}`];
  if (normalized.title) {
    details.push(`Source title: ${normalized.title}`);
  }
  if (normalized.url) {
    details.push(`Source link: ${normalized.url}`);
  }
  return details;
}
