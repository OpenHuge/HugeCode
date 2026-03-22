import type {
  HugeCodeTaskSourceLinkage,
  HugeCodeTaskSourceSummary,
} from "@ku0/code-runtime-host-contract";

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
      return {
        label:
          reference && repo
            ? `GitHub issue ${reference} · ${repo}`
            : reference
              ? `GitHub issue ${reference}`
              : repo
                ? `GitHub issue · ${repo}`
                : "GitHub issue",
        shortLabel: reference ? `Issue ${reference}` : "GitHub issue",
      };
    case "github_pr_followup":
      return {
        label:
          reference && repo
            ? `PR follow-up ${reference} · ${repo}`
            : reference
              ? `PR follow-up ${reference}`
              : repo
                ? `PR follow-up · ${repo}`
                : "PR follow-up",
        shortLabel: reference ? `PR ${reference}` : "PR follow-up",
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
  };
}

export function resolveTaskSourceSecondaryLabel(
  source: HugeCodeTaskSourceLinkage | HugeCodeTaskSourceSummary | null | undefined
): string | null {
  return normalizeTaskSourceLinkage(source)?.shortLabel ?? null;
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
