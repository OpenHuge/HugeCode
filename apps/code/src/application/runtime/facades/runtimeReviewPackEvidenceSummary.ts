import type { MissionControlProjection } from "./runtimeMissionControlFacade";

type ResearchSourceAssessmentStatus = "trusted" | "mixed" | "insufficient";

export type BrowserEvidenceSummary = {
  status: "passed" | "gap" | "blocked" | "unavailable";
  targetUrl: string | null;
  summary: string;
  artifacts: string[];
  blockingReason: string | null;
};

export type ResearchTraceSummary = {
  status: "selected" | "gap" | "blocked" | "in_progress";
  summary: string;
  blockingReason: string | null;
};

function dedupeDomains(domains: string[]): string[] {
  return [...new Set(domains.map((value) => value.trim()).filter((value) => value.length > 0))];
}

function inferResearchSourceQualityStatus(params: {
  status: ResearchSourceAssessmentStatus | null | undefined;
  trustedSourceCount: number;
  totalSourceCount: number;
}): ResearchSourceAssessmentStatus | null {
  if (
    params.status === "trusted" ||
    params.status === "mixed" ||
    params.status === "insufficient"
  ) {
    return params.status;
  }
  if (params.totalSourceCount <= 0) {
    return null;
  }
  if (params.trustedSourceCount <= 0) {
    return "insufficient";
  }
  if (params.trustedSourceCount >= params.totalSourceCount) {
    return "trusted";
  }
  return "mixed";
}

export function formatResearchSourceQualitySummary(input: {
  status?: ResearchSourceAssessmentStatus | null;
  trustedSourceCount?: number | null;
  totalSourceCount?: number | null;
  domains?: string[] | null;
}): string | null {
  const trustedSourceCount = Math.max(0, input.trustedSourceCount ?? 0);
  const totalSourceCount = Math.max(
    input.totalSourceCount ?? trustedSourceCount,
    trustedSourceCount
  );
  const domains = dedupeDomains(input.domains ?? []);
  const status = inferResearchSourceQualityStatus({
    status: input.status ?? null,
    trustedSourceCount,
    totalSourceCount,
  });
  if (!status && domains.length === 0) {
    return null;
  }
  const domainSummary = domains.slice(0, 2).join(", ");
  if (status === "trusted") {
    return `${trustedSourceCount} trusted source${trustedSourceCount === 1 ? "" : "s"}${domainSummary ? ` · ${domainSummary}` : ""}`;
  }
  if (status === "mixed") {
    return `${trustedSourceCount} trusted of ${totalSourceCount} sources${domainSummary ? ` · ${domainSummary}` : ""}`;
  }
  if (status === "insufficient") {
    return `${trustedSourceCount} trusted of ${totalSourceCount} source${totalSourceCount === 1 ? "" : "s"}${domainSummary ? ` · ${domainSummary}` : ""}`;
  }
  return domainSummary.length > 0 ? domainSummary : null;
}

export function buildResearchSourceQuality(
  autoDrive: MissionControlProjection["runs"][number]["autoDrive"] | null | undefined
): string | null {
  const researchSession = autoDrive?.researchSession;
  const sourceAssessment = autoDrive?.lastChatgptResearchRouteLab?.sourceAssessment;
  return formatResearchSourceQualitySummary({
    status: sourceAssessment?.status ?? null,
    trustedSourceCount:
      researchSession?.trustedSourceCount ?? sourceAssessment?.trustedSourceCount ?? 0,
    totalSourceCount: researchSession?.totalSourceCount ?? sourceAssessment?.totalSourceCount ?? 0,
    domains:
      researchSession?.sourceDomains ??
      sourceAssessment?.domains ??
      autoDrive?.researchSources?.map((source) => source.domain ?? "").filter(Boolean) ??
      [],
  });
}

export function buildResearchCoverageGaps(
  autoDrive: MissionControlProjection["runs"][number]["autoDrive"] | null | undefined
): string[] {
  return (
    autoDrive?.researchSession?.coverageGaps ??
    autoDrive?.lastChatgptResearchRouteLab?.coverageGaps ??
    []
  ).filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

export function buildBrowserEvidenceSummary(input: {
  artifacts:
    | MissionControlProjection["reviewPacks"][number]["artifacts"]
    | MissionControlProjection["runs"][number]["artifacts"];
  warnings: string[];
  reproductionGuidance?: string[];
  autoDrive?: MissionControlProjection["runs"][number]["autoDrive"] | null;
}): BrowserEvidenceSummary | null {
  const artifacts = input.artifacts ?? [];
  const browserArtifacts = artifacts
    .filter(
      (artifact) =>
        artifact.kind === "evidence" &&
        /browser|screenshot|chatgpt|inspect|page|ui/i.test(
          `${artifact.label} ${artifact.uri ?? ""}`
        )
    )
    .map((artifact) => artifact.label);
  const targetUrl =
    artifacts.find(
      (artifact) => artifact.kind === "evidence" && /^https?:\/\//i.test(artifact.uri ?? "")
    )?.uri ?? null;
  const blockingReason =
    input.warnings.find((warning) =>
      /browser session blocked|chatgpt login|browser unavailable/i.test(warning)
    ) ??
    (input.autoDrive?.continuationState?.lastContinuationReason &&
    /browser/i.test(input.autoDrive.continuationState.lastContinuationReason)
      ? input.autoDrive.continuationState.lastContinuationReason
      : null);

  if (browserArtifacts.length === 0 && !blockingReason && !input.reproductionGuidance?.length) {
    return null;
  }

  if (blockingReason) {
    return {
      status: "blocked",
      targetUrl,
      summary:
        "Browser session blocked before the runtime could publish complete browser evidence.",
      artifacts: browserArtifacts,
      blockingReason,
    };
  }

  if (browserArtifacts.length === 0) {
    return {
      status: "gap",
      targetUrl,
      summary:
        "Browser verification is still required before this result can be treated as complete.",
      artifacts: [],
      blockingReason: null,
    };
  }

  return {
    status: "passed",
    targetUrl,
    summary: "Runtime attached browser evidence for the target repro and final verification path.",
    artifacts: browserArtifacts,
    blockingReason: null,
  };
}

export function buildResearchTraceSummary(
  autoDrive: MissionControlProjection["runs"][number]["autoDrive"] | null | undefined
): ResearchTraceSummary | null {
  const trace = autoDrive?.researchTrace;
  if (!trace?.summary && !trace?.blockingReason && !autoDrive?.lastChatgptResearchRouteLab) {
    return null;
  }
  return {
    status: trace?.status ?? (trace?.blockingReason ? "blocked" : "gap"),
    summary:
      trace?.summary ??
      autoDrive?.lastChatgptResearchRouteLab?.decisionMemo ??
      "Research route data is available but incomplete.",
    blockingReason:
      trace?.blockingReason ?? autoDrive?.lastChatgptResearchRouteLab?.blockedReason ?? null,
  };
}

export function buildResearchSourceList(
  autoDrive: MissionControlProjection["runs"][number]["autoDrive"] | null | undefined
): string[] {
  const sources =
    autoDrive?.researchSources ?? autoDrive?.lastChatgptResearchRouteLab?.sources ?? [];
  return sources
    .map((source) => {
      const label = typeof source.label === "string" ? source.label.trim() : "";
      if (label.length === 0) {
        return null;
      }
      const domain = typeof source.domain === "string" ? source.domain.trim() : "";
      const url = typeof source.url === "string" ? source.url.trim() : "";
      return [domain || null, label, url || null]
        .filter((value): value is string => Boolean(value))
        .join(" - ");
    })
    .filter((value): value is string => Boolean(value));
}
