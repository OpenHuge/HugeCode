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
