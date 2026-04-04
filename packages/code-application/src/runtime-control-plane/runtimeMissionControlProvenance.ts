import type { HugeCodeMissionControlSnapshot as MissionControlProjection } from "@ku0/code-runtime-host-contract";

function summarizeCitationLabels(labels: string[], limit = 3): string {
  if (labels.length <= limit) {
    return labels.join(", ");
  }
  return `${labels.slice(0, limit).join(", ")} +${labels.length - limit} more`;
}

export function buildMissionProvenanceSummary(
  citations:
    | Array<
        | NonNullable<MissionControlProjection["runs"][number]["sourceCitations"]>[number]
        | NonNullable<MissionControlProjection["reviewPacks"][number]["sourceCitations"]>[number]
      >
    | null
    | undefined
): string | null {
  if (!Array.isArray(citations) || citations.length === 0) {
    return null;
  }

  const seen = new Set<string>();
  const repoGuidance: string[] = [];
  const sourceEvidence: string[] = [];

  for (const citation of citations) {
    const label = citation.label.trim();
    if (label.length === 0 || seen.has(`${citation.sourceKind}:${label}`)) {
      continue;
    }
    seen.add(`${citation.sourceKind}:${label}`);
    if (citation.sourceKind === "repo_doc") {
      repoGuidance.push(label);
      continue;
    }
    if (citation.sourceKind === "task_source") {
      sourceEvidence.push(label);
    }
  }

  const segments = [
    repoGuidance.length > 0 ? `Repo guidance: ${summarizeCitationLabels(repoGuidance)}` : null,
    sourceEvidence.length > 0
      ? `Source evidence: ${summarizeCitationLabels(sourceEvidence, 2)}`
      : null,
  ].filter((value): value is string => Boolean(value));

  return segments.length > 0 ? segments.join(" | ") : null;
}
