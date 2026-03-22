import type { AutoDriveIterationSummary, AutoDriveRunRecord } from "../types/autoDrive";

export function renderAutoDriveFinalReport(params: {
  run: AutoDriveRunRecord;
  latestSummary: AutoDriveIterationSummary | null;
}): string {
  const latestSummary = params.latestSummary;
  const operatorActions = params.run.latestPublishOutcome?.operatorActions ?? [];

  return [
    "# AutoDrive Final Report",
    "",
    `Run ID: ${params.run.runId}`,
    `Status: ${params.run.status}`,
    `Stage: ${params.run.stage}`,
    `Destination: ${params.run.destination.title}`,
    `Route summary: ${params.run.navigation.routeSummary ?? "none"}`,
    `Current waypoint: ${params.run.navigation.currentWaypointTitle ?? "none"}`,
    `Iterations: ${params.run.iteration}`,
    `Estimated tokens: ${params.run.totals.consumedTokensEstimate}`,
    `Reroutes: ${params.run.totals.rerouteCount}`,
    `Stop reason: ${params.run.lastStopReason?.code ?? "none"}`,
    `Latest publish outcome: ${params.run.latestPublishOutcome?.summary ?? "none"}`,
    ...(operatorActions.length > 0
      ? ["", "## Publish Recovery Actions", "", ...operatorActions.map((item) => `- ${item}`)]
      : []),
    "",
    "## Latest Summary",
    "",
    latestSummary?.summaryText ?? "No summary available.",
  ].join("\n");
}
