import type { AutoDriveRunRecord } from "../../../application/runtime/types/autoDrive";
import type { AutoDriveRuntimeRunRecord } from "./autoDriveRuntimeSnapshotAdapter";

export type AutoDriveActivityKind =
  | "control"
  | "status"
  | "stage"
  | "waypoint"
  | "reroute"
  | "stop";

export type AutoDriveActivityEntry = {
  id: string;
  kind: AutoDriveActivityKind;
  title: string;
  detail: string;
  iteration: number | null;
  timestamp: number;
};

const MAX_ACTIVITY_ENTRIES = 10;

function formatRunStatusLabel(status: AutoDriveRuntimeRunRecord["status"]): string {
  switch (status) {
    case "created":
      return "Route created";
    case "running":
      return "Route running";
    case "paused":
      return "Route paused";
    case "review_ready":
      return "Review ready";
    case "cancelled":
      return "Route cancelled";
    case "failed":
      return "Route failed";
    case "completed":
      return "Destination reached";
    case "stopped":
      return "Route stopped";
    default:
      return "Route updated";
  }
}

function formatRunStageLabel(stage: AutoDriveRunRecord["stage"]): string {
  return stage.replaceAll("_", " ");
}

export function appendActivityEntries(
  current: AutoDriveActivityEntry[],
  entries: AutoDriveActivityEntry[]
): AutoDriveActivityEntry[] {
  let next = current;
  for (const entry of entries) {
    const lastEntry = next[0] ?? null;
    if (
      lastEntry &&
      lastEntry.kind === entry.kind &&
      lastEntry.title === entry.title &&
      lastEntry.detail === entry.detail &&
      lastEntry.iteration === entry.iteration
    ) {
      continue;
    }
    next = [entry, ...next].slice(0, MAX_ACTIVITY_ENTRIES);
  }
  return next;
}

export function buildRunActivityEntries(params: {
  previousRun: AutoDriveRuntimeRunRecord | null;
  nextRun: AutoDriveRuntimeRunRecord;
  now: number;
}): AutoDriveActivityEntry[] {
  const { previousRun, nextRun, now } = params;
  const entries: AutoDriveActivityEntry[] = [];

  if (!previousRun || previousRun.runId !== nextRun.runId) {
    entries.push({
      id: `${nextRun.runId}:status:${now}`,
      kind: "status",
      title: formatRunStatusLabel(nextRun.status),
      detail: `Run ${nextRun.runId} is now ${nextRun.status} in ${formatRunStageLabel(nextRun.stage)}.`,
      iteration: nextRun.iteration,
      timestamp: now,
    });
    return entries;
  }

  if (previousRun.status !== nextRun.status) {
    entries.push({
      id: `${nextRun.runId}:status:${nextRun.status}:${now}`,
      kind: "status",
      title: formatRunStatusLabel(nextRun.status),
      detail: `Route changed from ${previousRun.status} to ${nextRun.status}.`,
      iteration: nextRun.iteration,
      timestamp: now,
    });
  }

  if (previousRun.stage !== nextRun.stage && nextRun.status === "running") {
    entries.push({
      id: `${nextRun.runId}:stage:${nextRun.stage}:${now}`,
      kind: "stage",
      title: `Stage: ${formatRunStageLabel(nextRun.stage)}`,
      detail: `AutoDrive advanced into ${formatRunStageLabel(nextRun.stage)}.`,
      iteration: nextRun.iteration,
      timestamp: now,
    });
  }

  if (previousRun.navigation.currentWaypointTitle !== nextRun.navigation.currentWaypointTitle) {
    const nextWaypointTitle = nextRun.navigation.currentWaypointTitle;
    if (nextWaypointTitle) {
      entries.push({
        id: `${nextRun.runId}:waypoint:${nextWaypointTitle}:${now}`,
        kind: "waypoint",
        title: `Waypoint: ${nextWaypointTitle}`,
        detail:
          nextRun.navigation.currentWaypointObjective ??
          "AutoDrive selected a new waypoint for the active route.",
        iteration: nextRun.iteration,
        timestamp: now,
      });
    }
  }

  if (
    previousRun.latestReroute?.createdAt !== nextRun.latestReroute?.createdAt &&
    nextRun.latestReroute
  ) {
    entries.push({
      id: `${nextRun.runId}:reroute:${nextRun.latestReroute.createdAt}`,
      kind: "reroute",
      title: "Route rerouted",
      detail: `${nextRun.latestReroute.reason} Trigger: ${nextRun.latestReroute.trigger}`,
      iteration: nextRun.iteration,
      timestamp: nextRun.latestReroute.createdAt,
    });
  }

  if (
    previousRun.lastStopReason?.detail !== nextRun.lastStopReason?.detail &&
    nextRun.lastStopReason?.detail
  ) {
    entries.push({
      id: `${nextRun.runId}:stop:${nextRun.lastStopReason.code}:${now}`,
      kind: "stop",
      title:
        nextRun.lastStopReason.code === "goal_reached" ? "Arrival confirmed" : "Route decision",
      detail: nextRun.lastStopReason.detail,
      iteration: nextRun.iteration,
      timestamp: now,
    });
  }

  return entries;
}
