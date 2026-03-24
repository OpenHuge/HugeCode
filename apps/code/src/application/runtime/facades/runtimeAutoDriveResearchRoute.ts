import type { RuntimeBrowserDebugRunResponse } from "@ku0/code-runtime-host-contract";
import type { AutoDriveContextSnapshot, AutoDriveRunRecord } from "../types/autoDrive";

type ResearchSourceRecord = {
  label: string;
  url: string | null;
  domain: string | null;
};

const BASE_TRUSTED_DOMAINS = [
  "openai.com",
  "platform.openai.com",
  "developers.openai.com",
  "developer.chrome.com",
];

const TRUSTED_DOMAIN_HINTS = [
  {
    keywords: ["react", "jsx", "hooks", "react compiler"],
    domains: ["react.dev"],
  },
  {
    keywords: ["vite", "vitest"],
    domains: ["vite.dev", "vitest.dev"],
  },
  {
    keywords: ["electron", "browserwindow", "ipcmain"],
    domains: ["electronjs.org"],
  },
  {
    keywords: ["tauri", "invoke", "tauri command"],
    domains: ["tauri.app"],
  },
  {
    keywords: ["playwright", "browser snapshot", "browser automation"],
    domains: ["playwright.dev"],
  },
  {
    keywords: ["typescript", "tsconfig", "tsx"],
    domains: ["typescriptlang.org"],
  },
  {
    keywords: ["node", "node.js", "npm", "pnpm"],
    domains: ["nodejs.org", "pnpm.io"],
  },
  {
    keywords: ["github actions", "workflow", "pull request", "github"],
    domains: ["docs.github.com"],
  },
  {
    keywords: ["anthropic", "claude"],
    domains: ["anthropic.com", "docs.anthropic.com"],
  },
] as const;

export type AutoDriveResearchRouteOutcome = {
  status: "in_progress" | "selected" | "gap" | "blocked";
  summary: string;
  blockingReason: string | null;
  recommendedCandidateId: string | null;
  recommendedCandidateTitle: string | null;
};

function dedupe(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function collectResearchIntentText(params: {
  run: AutoDriveRunRecord;
  context: AutoDriveContextSnapshot;
}): string {
  const parts = [
    params.run.destination.title,
    ...params.run.destination.desiredEndState,
    ...params.run.destination.doneDefinition.arrivalCriteria,
    ...params.run.destination.doneDefinition.requiredValidation,
    ...params.run.destination.doneDefinition.waypointIndicators,
    params.run.navigation.destinationSummary,
    ...params.run.destination.hardBoundaries,
    ...(params.run.runtimeScenarioProfile?.sourceSignals ?? []),
    ...(params.context.repo.evaluation?.sourceSignals ?? []),
    ...params.context.opportunities.candidates.flatMap((candidate) => [
      candidate.title,
      candidate.summary,
      candidate.rationale,
      ...candidate.repoAreas,
    ]),
  ];
  return parts
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n")
    .toLowerCase();
}

export function buildResearchTrustedDomains(params: {
  run: AutoDriveRunRecord;
  context: AutoDriveContextSnapshot;
}): string[] {
  const intentText = collectResearchIntentText(params);
  const hintedDomains = TRUSTED_DOMAIN_HINTS.flatMap((entry) =>
    entry.keywords.some((keyword) => intentText.includes(keyword)) ? entry.domains : []
  );
  return dedupe([...BASE_TRUSTED_DOMAINS, ...hintedDomains]);
}

function summarizeTrustedDomains(researchSources: ResearchSourceRecord[]): string {
  const uniqueDomains = dedupe(
    researchSources
      .map((source) => source.domain?.trim() ?? "")
      .filter((domain) => domain.length > 0)
  );
  if (uniqueDomains.length === 0) {
    return "";
  }
  if (uniqueDomains.length <= 3) {
    return ` across ${uniqueDomains.join(", ")}`;
  }
  return ` across ${uniqueDomains.slice(0, 3).join(", ")} and ${uniqueDomains.length - 3} more`;
}

export function formatResearchRouteBlockingReason(reason: string | null): string | null {
  if (!reason) {
    return null;
  }
  if (reason === "missing_trusted_sources") {
    return "ChatGPT did not cite any trusted sources.";
  }
  if (reason === "missing_recommended_route") {
    return "ChatGPT did not recommend a concrete route.";
  }
  if (reason.startsWith("untrusted_source_domains:")) {
    const domains = reason
      .slice("untrusted_source_domains:".length)
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    return domains.length > 0
      ? `ChatGPT cited sources outside the trusted allowlist: ${domains.join(", ")}.`
      : "ChatGPT cited sources outside the trusted allowlist.";
  }
  if (reason.startsWith("invalid_recommended_route:")) {
    const route = reason.slice("invalid_recommended_route:".length).trim();
    return route.length > 0
      ? `ChatGPT recommended route ${route} outside the current candidate set.`
      : "ChatGPT recommended a route outside the current candidate set.";
  }
  return reason;
}

export function resolveResearchRouteOutcome(params: {
  result: RuntimeBrowserDebugRunResponse;
  context: AutoDriveContextSnapshot;
  researchSources: ResearchSourceRecord[];
}): AutoDriveResearchRouteOutcome {
  const { result, context, researchSources } = params;
  if (result.available === false || result.status === "blocked" || result.status === "failed") {
    const blockingReason =
      result.message.trim() ||
      result.warnings.find((entry) => entry.trim().length > 0)?.trim() ||
      "ChatGPT research route lab is unavailable.";
    return {
      status: "blocked",
      summary: `Research blocked: ${blockingReason}`,
      blockingReason,
      recommendedCandidateId: null,
      recommendedCandidateTitle: null,
    };
  }

  const research = result.researchRouteLab;
  const recommendedRoute = research?.recommendedRoute?.trim() || null;
  const normalizedBlockingReason = formatResearchRouteBlockingReason(
    research?.blockedReason ?? null
  );
  const recommendedCandidate =
    context.opportunities.candidates.find((candidate) => candidate.id === recommendedRoute) ?? null;

  if (normalizedBlockingReason) {
    return {
      status: "gap",
      summary: `Research gap remains: ${normalizedBlockingReason}`,
      blockingReason: normalizedBlockingReason,
      recommendedCandidateId: null,
      recommendedCandidateTitle: null,
    };
  }
  if (!recommendedRoute) {
    const blockingReason = "ChatGPT did not recommend a concrete route.";
    return {
      status: "gap",
      summary: `Research gap remains: ${blockingReason}`,
      blockingReason,
      recommendedCandidateId: null,
      recommendedCandidateTitle: null,
    };
  }
  if (!recommendedCandidate) {
    const blockingReason = `ChatGPT recommended route ${recommendedRoute} outside the current candidate set.`;
    return {
      status: "gap",
      summary: `Research gap remains: ${blockingReason}`,
      blockingReason,
      recommendedCandidateId: null,
      recommendedCandidateTitle: null,
    };
  }

  const trustedSourceSummary = `${researchSources.length} trusted source${researchSources.length === 1 ? "" : "s"}${summarizeTrustedDomains(researchSources)}`;
  const summary = [
    `Research selected route ${recommendedCandidate.title} from ${trustedSourceSummary}.`,
    research?.decisionMemo?.trim() || null,
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ");

  return {
    status: "selected",
    summary,
    blockingReason: null,
    recommendedCandidateId: recommendedCandidate.id,
    recommendedCandidateTitle: recommendedCandidate.title,
  };
}
