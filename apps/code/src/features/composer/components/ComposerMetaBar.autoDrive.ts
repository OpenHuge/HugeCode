type AutoDriveRerouteSummaryInput = {
  latestReroute: {
    mode: "soft" | "hard";
    reason: string;
    trigger: string;
  } | null;
  rerouteReason: string | null;
  rerouting: boolean;
  offRoute: boolean;
};

export function formatDecisionLabel(
  decision: string | null,
  stopReasonCode: string | null
): string {
  const source = stopReasonCode ?? decision;
  switch (source) {
    case "missing_human_input":
      return "Awaiting operator input";
    case "manual_stop":
      return "Stopped by operator";
    case "goal_reached":
      return "Arrival confirmed";
    case "token_budget_exhausted":
      return "Budget limit reached";
    case "max_iterations_reached":
      return "Iteration limit reached";
    case "repeated_validation_failures":
      return "Validation review required";
    case "no_meaningful_progress":
      return "No progress detected";
    case "duration_budget_exhausted":
      return "Duration limit reached";
    case "reroute_limit_reached":
      return "Reroute limit reached";
    case "reroute":
      return "Rerouting";
    case "resume":
      return "Resuming route";
    case "continue":
    case null:
      return "Monitoring current route";
    default:
      break;
  }
  return source.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatWaypointStatusLabel(status: string | null | undefined): string | null {
  if (!status) {
    return null;
  }
  return `Waypoint ${status}`;
}

export function buildRerouteSummary(run: AutoDriveRerouteSummaryInput): {
  title: string;
  detail: string;
} {
  if (run.latestReroute) {
    return {
      title: `${run.latestReroute.mode} reroute`,
      detail: `${run.latestReroute.reason} Trigger: ${run.latestReroute.trigger}`,
    };
  }
  if (run.rerouteReason && run.rerouting) {
    return {
      title: "Active reroute",
      detail: run.rerouteReason,
    };
  }
  if (run.rerouteReason && run.offRoute) {
    return {
      title: "Off-route reason",
      detail: run.rerouteReason,
    };
  }
  return {
    title: "No reroute recorded",
    detail: "The current route has not required a course correction yet.",
  };
}
