import type {
  AutoDriveConfidence,
  AutoDriveIterationSummary,
  AutoDriveRunRecord,
} from "../types/autoDrive";

export function buildContinuationReason(
  run: AutoDriveRunRecord,
  summary: AutoDriveIterationSummary
): string {
  const validationCommands = summary.validation.commands.join(" | ");
  if (
    (run.continuationPolicy?.requireValidationSuccessToStop ?? true) &&
    summary.validation.success !== true
  ) {
    if (summary.validation.success === false) {
      return `Validation is still failing: ${
        summary.validation.failures[0] ?? summary.validation.summary
      }`;
    }
    return validationCommands.length > 0
      ? `Validation is still pending for ${validationCommands}.`
      : `Validation is still pending: ${summary.validation.summary}`;
  }
  if (summary.waypoint.arrivalCriteriaMissed.length > 0) {
    return `A required arrival criterion is still open: ${summary.waypoint.arrivalCriteriaMissed[0]}`;
  }
  if (summary.blockers.length > 0) {
    return `An active blocker still needs resolution: ${summary.blockers[0]}`;
  }
  if (summary.routeHealth.offRoute || summary.routeHealth.rerouteRecommended) {
    return `The route still needs re-anchoring: ${
      summary.routeHealth.rerouteReason ?? summary.routeHealth.triggerSignals[0] ?? "route drift"
    }`;
  }
  const minimumConfidence = run.continuationPolicy?.minimumConfidenceToStop ?? "high";
  const confidenceRank: Record<AutoDriveConfidence, number> = {
    low: 0,
    medium: 1,
    high: 2,
  };
  if (confidenceRank[summary.progress.arrivalConfidence] < confidenceRank[minimumConfidence]) {
    return `Confidence is still below the stop target of ${minimumConfidence}.`;
  }
  return "The route needs one more verification pass before stopping.";
}

export function advanceContinuationState(params: {
  run: AutoDriveRunRecord;
  summary: AutoDriveIterationSummary;
  now: number;
}): AutoDriveRunRecord {
  const automaticFollowUpCount = (params.run.continuationState?.automaticFollowUpCount ?? 0) + 1;
  return {
    ...params.run,
    continuationState: {
      automaticFollowUpCount,
      status: "continuing",
      lastContinuationAt: params.now,
      lastContinuationReason: buildContinuationReason(params.run, params.summary),
    },
  };
}

export function resolveStoppedContinuationState(
  run: AutoDriveRunRecord,
  now: number
): AutoDriveRunRecord["continuationState"] {
  if (!run.continuationState && !run.continuationPolicy) {
    return run.continuationState ?? null;
  }
  return {
    automaticFollowUpCount: run.continuationState?.automaticFollowUpCount ?? 0,
    status: "stopped",
    lastContinuationAt: run.continuationState?.lastContinuationAt ?? now,
    lastContinuationReason: run.continuationState?.lastContinuationReason ?? "finalized",
  };
}
