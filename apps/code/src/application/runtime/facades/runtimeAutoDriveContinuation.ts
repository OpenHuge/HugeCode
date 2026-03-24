import {
  isBrowserReproFixVerifyScenario,
  isResearchRouteDecideScenario,
} from "./runtimeScenarioProfiles";
import type {
  AutoDriveConfidence,
  AutoDriveIterationSummary,
  AutoDriveRunRecord,
} from "../types/autoDrive";

export function buildContinuationReason(
  run: AutoDriveRunRecord,
  summary: AutoDriveIterationSummary
): string {
  const browserFixLoop = isBrowserReproFixVerifyScenario(run.runtimeScenarioProfile ?? null);
  const researchRouteLoop = isResearchRouteDecideScenario(run.runtimeScenarioProfile ?? null);
  const researchPhase = run.runtimeResearchSession?.phase ?? null;
  const researchGap =
    run.runtimeResearchSession?.blockingReason ??
    run.runtimeResearchSession?.coverageGaps[0] ??
    run.runtimeResearchTrace?.blockingReason ??
    run.runtimeResearchTrace?.summary ??
    null;
  if (researchRouteLoop && researchPhase === "blocked") {
    return `Research blocked: ${researchGap ?? "ChatGPT research could not complete in the current browser session."}`;
  }
  if (researchRouteLoop && researchPhase === "gap") {
    return `Research evidence gap: ${researchGap ?? "Trusted route evidence is still incomplete."}`;
  }

  const validationCommands = summary.validation.commands.join(" | ");
  const browserGap = summary.waypoint.arrivalCriteriaMissed.find(
    (criterion) =>
      /browser|screenshot|repro|page|ui|visual/i.test(criterion) && !/validation/i.test(criterion)
  );
  if (browserFixLoop && browserGap) {
    return `Browser verification gap remains: ${browserGap}`;
  }
  if (
    researchRouteLoop &&
    summary.waypoint.arrivalCriteriaMissed.some((criterion) =>
      /source|research|official|route/i.test(criterion)
    )
  ) {
    return `Research gap remains: ${summary.waypoint.arrivalCriteriaMissed.find((criterion) => /source|research|official|route/i.test(criterion))}`;
  }
  if (
    (run.continuationPolicy?.requireValidationSuccessToStop ?? true) &&
    summary.validation.success !== true
  ) {
    if (summary.validation.success === false) {
      if (browserFixLoop) {
        return `Browser verification gap remains: ${summary.validation.failures[0] ?? summary.validation.summary}`;
      }
      return `Validation is still failing: ${
        summary.validation.failures[0] ?? summary.validation.summary
      }`;
    }
    if (browserFixLoop) {
      return validationCommands.length > 0
        ? `Browser verification gap remains: rerun ${validationCommands} and confirm the real browser path.`
        : `Browser verification gap remains: ${summary.validation.summary}`;
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
