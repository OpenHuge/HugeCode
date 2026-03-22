type ReviewReadyCandidate = {
  navigationTarget?: { kind: "review" | "mission" | "thread" } | null;
};

type MissionControlSignalCounts = {
  reviewReadyCount: number;
  needsActionCount: number;
  routingAttentionCount: number;
  routingBlockedCount: number;
};

export function resolveHomeMissionSignals<T extends ReviewReadyCandidate>(input: {
  missionControlSignals: MissionControlSignalCounts | null;
  latestAgentRuns: T[];
  approvalsCount: number;
  userInputRequestCount: number;
  isReviewReadyMission: (run: T) => boolean;
}) {
  return {
    reviewReadyCount: input.missionControlSignals
      ? input.missionControlSignals.reviewReadyCount
      : input.latestAgentRuns.filter(input.isReviewReadyMission).length,
    awaitingActionCount: input.missionControlSignals
      ? Math.max(
          input.approvalsCount + input.userInputRequestCount,
          input.missionControlSignals.needsActionCount
        )
      : input.approvalsCount + input.userInputRequestCount,
  };
}

export function resolveHomeRoutingSignal(input: {
  routingAttentionCount: number;
  routingBlockedCount: number;
  hasActiveRun: boolean;
  hasWorkspaces: boolean;
}) {
  if (input.routingBlockedCount > 0) {
    return {
      value: "Blocked",
      detail: `${input.routingBlockedCount} mission ${input.routingBlockedCount === 1 ? "route is" : "routes are"} blocked and need operator recovery.`,
      action: "Mission control",
      tone: "warning" as const,
      ariaLabel: "Open mission control routing detail",
      prefersMissionControl: true,
    };
  }
  if (input.routingAttentionCount > 0) {
    return {
      value: "Attention",
      detail: `${input.routingAttentionCount} mission ${input.routingAttentionCount === 1 ? "route needs" : "routes need"} placement review or fallback confirmation.`,
      action: "Mission control",
      tone: "warning" as const,
      ariaLabel: "Open mission control routing detail",
      prefersMissionControl: true,
    };
  }
  if (input.hasActiveRun) {
    return {
      value: "Active",
      detail: "An active mission is running now.",
      action: "Resume",
      tone: "accent" as const,
      ariaLabel: "Resume active mission",
      prefersMissionControl: false,
    };
  }
  if (input.hasWorkspaces) {
    return {
      value: "Ready",
      detail: "Accounts, profiles, and runtime defaults are ready to review.",
      action: "Settings",
      tone: "neutral" as const,
      ariaLabel: "Open execution settings",
      prefersMissionControl: false,
    };
  }
  return {
    value: "Setup",
    detail: "Connect a workspace before launching the next mission.",
    action: "Settings",
    tone: "neutral" as const,
    ariaLabel: "Open execution settings",
    prefersMissionControl: false,
  };
}
