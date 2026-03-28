import type {
  HugeCodeReviewPackSummary,
  HugeCodeRunSummary,
} from "@ku0/code-runtime-host-contract";
import { resolveMissionControlReviewPresentation } from "@ku0/code-runtime-host-contract";

export function formatMissionOverviewStateLabel(
  state: "running" | "needsAction" | "reviewReady" | "ready"
): string {
  switch (state) {
    case "running":
      return "Running";
    case "needsAction":
      return "Waiting";
    case "reviewReady":
      return "Review ready";
    case "ready":
      return "Ready";
    default: {
      const exhaustiveCheck: never = state;
      return exhaustiveCheck;
    }
  }
}

export function formatMissionControlFreshnessLabel(freshness: {
  status: "idle" | "loading" | "refreshing" | "ready" | "error";
  isStale: boolean;
}): string {
  if (freshness.status === "loading") {
    return "Syncing mission control";
  }
  if (freshness.status === "refreshing") {
    return "Refreshing mission control";
  }
  if (freshness.status === "error") {
    return "Mission control degraded";
  }
  if (freshness.isStale) {
    return "Mission control stale";
  }
  return "Mission control live";
}

export function formatMissionLatestRunReviewStatus(input: {
  reviewPack: HugeCodeReviewPackSummary | null;
  run: HugeCodeRunSummary;
  continuationState?: "ready" | "attention" | "degraded" | "blocked" | "missing" | null;
  hasBlockedSubAgents?: boolean;
}) {
  const presentation = resolveMissionControlReviewPresentation({
    reviewPack: input.reviewPack,
    run: input.run,
    continuationState: input.continuationState,
    hasBlockedSubAgents: input.hasBlockedSubAgents,
  });
  return {
    statusLabel: presentation.reviewStatusLabel,
    statusKind: presentation.tone === "ready" ? "review_ready" : "attention",
  } as const;
}
