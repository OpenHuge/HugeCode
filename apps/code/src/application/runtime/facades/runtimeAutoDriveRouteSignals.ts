import type {
  AutoDriveCommitEvidence,
  AutoDriveExecutionTuning,
  AutoDriveIterationSummary,
  AutoDriveRunRecord,
  AutoDriveThreadContext,
} from "../types/autoDrive";

export type CommitMomentumSignal = {
  topAreas: string[];
  alignedSummaries: string[];
  alignmentScore: number;
  hasHighDivergence: boolean;
};

export type RouteStagnationSignal = {
  repeatedAreas: string[];
  repeatedBlockers: string[];
  isStagnating: boolean;
  summary: string | null;
};

type PublishCorridorSignal = {
  stableValidationStreak: number;
  corridorReadyForPush: boolean;
  summary: string | null;
};

const INTENT_TOKEN_STOPWORDS = new Set(
  "this that with from into through before after while when where which what should could would have been will project route summary state area areas work update refine fixes files file apps code src".split(
    " "
  )
);

function summarizeArea(path: string): string {
  if (!path.includes("/")) {
    return path;
  }
  const segments = path.split("/").filter(Boolean);
  if (segments[0] === "apps" && segments.length >= 5) {
    if (segments[3] === "features" || segments[3] === "application") {
      return segments.slice(0, 5).join("/");
    }
    return segments.slice(0, 4).join("/");
  }
  if (segments[0] === "packages" && segments.length >= 2) {
    return segments.slice(0, 2).join("/");
  }
  if (segments[0] === "docs" && segments.length >= 2) {
    return segments.slice(0, 2).join("/");
  }
  return segments.slice(0, Math.min(3, segments.length)).join("/");
}

function rankPaths(paths: string[], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const path of paths) {
    const area = summarizeArea(path);
    counts.set(area, (counts.get(area) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([area]) => area);
}

function tokenizeIntentText(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, " ")
    .split(/[\s/_-]+/)
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length >= 4 &&
        !INTENT_TOKEN_STOPWORDS.has(token) &&
        !/^\d+$/.test(token) &&
        !token.startsWith("http")
    );
}

export function buildCommitMomentum(input: {
  run: AutoDriveRunRecord;
  commits: AutoDriveCommitEvidence[];
  previousSummary: AutoDriveIterationSummary | null;
  threadContext: AutoDriveThreadContext | null;
}): CommitMomentumSignal {
  if (input.commits.length === 0) {
    return {
      topAreas: [],
      alignedSummaries: [],
      alignmentScore: 0,
      hasHighDivergence: false,
    };
  }

  const intentTokens = new Set(
    [
      input.run.destination.title,
      ...input.run.destination.desiredEndState,
      ...input.run.destination.doneDefinition.arrivalCriteria,
      ...input.run.destination.hardBoundaries,
      input.previousSummary?.summaryText ?? null,
      ...(input.previousSummary?.suggestedNextAreas ?? []),
      input.threadContext?.summary ?? null,
      input.threadContext?.longTermMemorySummary ?? null,
      ...(input.threadContext?.recentUserPrompts ?? []),
    ].flatMap((value) => tokenizeIntentText(value))
  );
  const areaWeights = new Map<string, number>();
  let totalRecencyWeight = 0;
  let alignedRecencyWeight = 0;
  const alignedCommitSummaries: string[] = [];

  for (const [index, commit] of input.commits.entries()) {
    const recencyWeight = (input.commits.length - index) / Math.max(1, input.commits.length);
    totalRecencyWeight += recencyWeight;
    const uniqueAreas = [...new Set(commit.touchedPaths.map((path) => summarizeArea(path)))];
    const summaryOverlap = tokenizeIntentText(commit.summary).filter((token) =>
      intentTokens.has(token)
    ).length;
    const areaOverlap = uniqueAreas.filter((area) =>
      tokenizeIntentText(area).some((token) => intentTokens.has(token))
    ).length;
    const hasAlignment = summaryOverlap > 0 || areaOverlap > 0;

    if (hasAlignment) {
      alignedRecencyWeight += recencyWeight;
      alignedCommitSummaries.push(commit.summary);
    }

    const weightedAreaSignal = recencyWeight * (1 + Math.min(3, summaryOverlap + areaOverlap));
    for (const area of uniqueAreas) {
      areaWeights.set(
        area,
        (areaWeights.get(area) ?? 0) +
          (hasAlignment ? weightedAreaSignal * 1.2 : weightedAreaSignal)
      );
    }
  }

  const topAreas = [...areaWeights.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 4)
    .map(([area]) => area);
  const alignmentScore = totalRecencyWeight > 0 ? alignedRecencyWeight / totalRecencyWeight : 0;
  const alignedSummaries = [...new Set(alignedCommitSummaries.map((summary) => summary.trim()))]
    .filter((summary) => summary.length > 0)
    .slice(0, 3);

  return {
    topAreas,
    alignedSummaries,
    alignmentScore,
    hasHighDivergence:
      input.commits.length >= 6 && alignmentScore < 0.35 && alignedSummaries.length <= 2,
  };
}

export function buildRouteStagnationSignal(input: {
  run: AutoDriveRunRecord;
  previousSummary: AutoDriveIterationSummary | null;
}): RouteStagnationSignal {
  const history = [...input.run.summaries];
  if (
    input.previousSummary &&
    !history.some((summary) => summary.iteration === input.previousSummary?.iteration)
  ) {
    history.push(input.previousSummary);
  }
  if (history.length === 0) {
    return {
      repeatedAreas: [],
      repeatedBlockers: [],
      isStagnating: false,
      summary: null,
    };
  }

  const recentSummaries = history.sort((left, right) => left.iteration - right.iteration).slice(-4);
  const repeatedAreas = [
    ...new Set(
      rankPaths(
        recentSummaries.flatMap((summary) => summary.suggestedNextAreas),
        3
      )
    ),
  ]
    .filter(
      (area) =>
        recentSummaries.filter((summary) =>
          summary.suggestedNextAreas.map((path) => summarizeArea(path)).includes(area)
        ).length >= 2
    )
    .slice(0, 3);

  const blockerCounts = new Map<string, number>();
  for (const summary of recentSummaries) {
    for (const blocker of summary.blockers) {
      const normalized = blocker.trim();
      if (!normalized) {
        continue;
      }
      blockerCounts.set(normalized, (blockerCounts.get(normalized) ?? 0) + 1);
    }
  }
  const repeatedBlockers = [...blockerCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([blocker]) => blocker)
    .slice(0, 3);

  const topArea = repeatedAreas[0] ?? null;
  const topAreaRepeatCount =
    topArea === null
      ? 0
      : recentSummaries.filter((summary) =>
          summary.suggestedNextAreas.map((path) => summarizeArea(path)).includes(topArea)
        ).length;
  const progressTrend = recentSummaries.map((summary) => summary.progress.overallProgress);
  const nonIncreasingProgress = progressTrend.every(
    (value, index) => index === 0 || value <= progressTrend[index - 1] + 2
  );
  const isStagnating =
    recentSummaries.length >= 3 &&
    !recentSummaries.some((summary) => summary.goalReached) &&
    topAreaRepeatCount >= 3 &&
    nonIncreasingProgress;

  return {
    repeatedAreas,
    repeatedBlockers,
    isStagnating,
    summary: isStagnating
      ? `Route stagnation detected around ${topArea ?? "repeated surfaces"} over the last ${recentSummaries.length} iterations.`
      : repeatedBlockers.length > 0
        ? `Repeated blockers: ${repeatedBlockers.join(" | ")}`
        : null,
  };
}

function buildPublishCorridorSignal(input: {
  run: AutoDriveRunRecord;
  previousSummary: AutoDriveIterationSummary | null;
}): PublishCorridorSignal {
  const history = [...input.run.summaries];
  if (
    input.previousSummary &&
    !history.some((summary) => summary.iteration === input.previousSummary?.iteration)
  ) {
    history.push(input.previousSummary);
  }
  const recentSummaries = history.sort((left, right) => left.iteration - right.iteration).slice(-4);

  let stableValidationStreak = 0;
  for (const summary of [...recentSummaries].reverse()) {
    const isStableValidation =
      summary.validation.success === true &&
      summary.blockers.length === 0 &&
      !summary.routeHealth.offRoute &&
      !summary.routeHealth.rerouteRecommended;
    if (!isStableValidation) {
      break;
    }
    stableValidationStreak += 1;
  }

  const corridorReadyForPush =
    input.run.latestPublishOutcome?.status === "completed" &&
    input.run.latestPublishOutcome.mode === "branch_only" &&
    input.run.latestPublishOutcome.pushed === false &&
    stableValidationStreak >= 2;

  return {
    stableValidationStreak,
    corridorReadyForPush,
    summary: corridorReadyForPush
      ? `Validation stayed green for ${stableValidationStreak} consecutive iterations after preparing a branch-only publish candidate.`
      : null,
  };
}

export function buildExecutionFeedbackSignal(input: {
  run: AutoDriveRunRecord;
  previousSummary: AutoDriveIterationSummary | null;
  routeStagnation: RouteStagnationSignal;
  hasHistoricalPublishedCorridor?: boolean;
  historicalPublishFailureSummary?: string | null;
}): AutoDriveExecutionTuning {
  const publishCorridor = buildPublishCorridorSignal(input);
  const reasons: string[] = [];
  let effectiveMaxFilesPerIteration = input.run.budget.maxFilesPerIteration ?? 6;
  let validationCommandPreference: AutoDriveExecutionTuning["validationCommandPreference"] = "fast";
  let publishPriority: AutoDriveExecutionTuning["publishPriority"] = "none";
  let cautionLevel: AutoDriveExecutionTuning["cautionLevel"] = "normal";

  if (input.previousSummary?.validation.success === false) {
    reasons.push("validation_failed");
    effectiveMaxFilesPerIteration = Math.min(effectiveMaxFilesPerIteration, 2);
    validationCommandPreference = "full";
    cautionLevel = "high";
  }
  if (
    input.previousSummary?.reroute !== null ||
    input.previousSummary?.routeHealth.rerouteRecommended ||
    input.run.latestReroute !== null
  ) {
    reasons.push("recent_reroute");
    effectiveMaxFilesPerIteration = Math.min(effectiveMaxFilesPerIteration, 2);
    cautionLevel = "high";
  }
  if (input.routeStagnation.isStagnating) {
    reasons.push("route_stagnation");
    effectiveMaxFilesPerIteration = Math.min(effectiveMaxFilesPerIteration, 2);
    cautionLevel = cautionLevel === "normal" ? "elevated" : cautionLevel;
  }
  if (input.run.latestPublishOutcome?.status === "failed") {
    reasons.push("publish_failed");
    publishPriority = "prepare_branch";
    effectiveMaxFilesPerIteration = Math.min(effectiveMaxFilesPerIteration, 3);
    cautionLevel = cautionLevel === "normal" ? "elevated" : cautionLevel;
  } else if (
    input.run.latestPublishOutcome?.status === "completed" &&
    input.run.latestPublishOutcome.mode === "branch_only" &&
    input.run.latestPublishOutcome.pushed === false
  ) {
    reasons.push("branch_only_publish_ready");
    if (publishCorridor.corridorReadyForPush || input.hasHistoricalPublishedCorridor) {
      reasons.push(
        publishCorridor.corridorReadyForPush
          ? "publish_corridor_stable"
          : "historical_publish_corridor"
      );
      publishPriority = "push_candidate";
    } else {
      publishPriority = "prepare_branch";
    }
    if (input.historicalPublishFailureSummary) {
      reasons.push("historical_publish_failure");
      cautionLevel = "high";
    }
    effectiveMaxFilesPerIteration = Math.min(effectiveMaxFilesPerIteration, 3);
    cautionLevel = cautionLevel === "normal" ? "elevated" : cautionLevel;
  } else if (
    input.run.latestPublishOutcome?.status === "completed" &&
    input.run.latestPublishOutcome.mode === "push_candidate" &&
    input.run.latestPublishOutcome.pushed === true
  ) {
    reasons.push("publish_candidate_pushed");
    publishPriority = "push_candidate";
  }

  return {
    summary:
      reasons.length === 0
        ? "No adaptive feedback adjustments are active."
        : [
            reasons.includes("validation_failed")
              ? "Recent validation failed; narrow scope and use the stronger validation gate."
              : null,
            reasons.includes("recent_reroute")
              ? "A recent reroute was recorded; keep the next waypoint narrowly scoped."
              : null,
            reasons.includes("route_stagnation")
              ? "Iteration history is stagnating; prefer a corrective route over repeated expansion."
              : null,
            reasons.includes("publish_failed")
              ? "The last publish attempt failed; restore a stable publish corridor before broadening scope."
              : null,
            reasons.includes("branch_only_publish_ready")
              ? "A branch-only publish candidate exists; favor corridor preparation over new scope."
              : null,
            reasons.includes("publish_corridor_stable")
              ? (publishCorridor.summary ??
                "Recent iterations kept validation stable, so the publish corridor is ready for an isolated push.")
              : null,
            reasons.includes("historical_publish_corridor")
              ? "Prior AutoDrive runs already pushed a matching corridor, so this branch-only candidate can reuse that publish path."
              : null,
            reasons.includes("historical_publish_failure")
              ? `Prior matching publish attempts failed: ${input.historicalPublishFailureSummary}`
              : null,
            reasons.includes("publish_candidate_pushed")
              ? "A push candidate already landed; keep follow-up work scoped to the published corridor."
              : null,
          ]
            .filter((value): value is string => Boolean(value))
            .join(" "),
    reasons,
    effectiveMaxFilesPerIteration,
    validationCommandPreference,
    publishPriority,
    cautionLevel,
  };
}
