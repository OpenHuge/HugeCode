import type {
  AutoDriveContextSnapshot,
  AutoDriveRouteEvidence,
  AutoDriveRouteMilestone,
  AutoDriveRouteProposal,
  AutoDriveProposalReview,
  AutoDriveRiskLevel,
  AutoDriveRunRecord,
  AutoDriveWaypointProposal,
} from "../types/autoDrive";
import {
  getBrowserReproFixVerifyGuidance,
  isBrowserReproFixVerifyScenario,
} from "./runtimeScenarioProfiles";

function dedupe(values: string[], limit = values.length): string[] {
  return [
    ...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)),
  ].slice(0, limit);
}

function isBrowserFixLoop(input: {
  run: AutoDriveRunRecord;
  context: AutoDriveContextSnapshot;
}): boolean {
  return (
    isBrowserReproFixVerifyScenario(input.run.runtimeScenarioProfile ?? null) ||
    (input.context.repo.evaluation?.scenarioKeys ?? []).includes("browser_repro_fix_verify")
  );
}

function buildEvidence(context: AutoDriveContextSnapshot): AutoDriveRouteEvidence[] {
  const evidence: AutoDriveRouteEvidence[] = [
    {
      kind: "destination",
      detail: context.destination.title,
    },
  ];
  for (const signal of context.intent.signals.slice(0, 2)) {
    evidence.push({
      kind: "intent_signal",
      detail: signal.summary,
      source: signal.source,
    });
  }
  for (const hypothesis of context.intent.directionHypotheses.slice(0, 1)) {
    evidence.push({
      kind: "direction_hypothesis",
      detail: hypothesis.summary,
    });
  }
  for (const rule of context.repo.ruleEvidence.slice(0, 2)) {
    evidence.push({
      kind: "repo_rule",
      detail: rule.summary,
      source: rule.path,
    });
  }
  for (const doc of context.repo.relevantDocs.slice(0, 2)) {
    evidence.push({
      kind: "doc",
      detail: doc.summary,
      source: doc.path,
    });
  }
  for (const commit of context.git.recentCommits.slice(0, 2)) {
    evidence.push({
      kind: "git",
      detail: `${commit.summary} by ${commit.author}`,
      source: commit.sha,
    });
  }
  if (context.previousSummary) {
    evidence.push({
      kind: "summary",
      detail: context.previousSummary.summaryText,
    });
  }
  evidence.push({
    kind: "collaborator_intent",
    detail: context.collaboratorIntent.probableIntent,
  });
  for (const research of context.externalResearch.slice(0, 1)) {
    evidence.push({
      kind: "external",
      detail: research.summary,
      source: research.sources[0] ?? null,
    });
  }
  if (
    (context.repo.evaluation?.representativeCommands.length ?? 0) > 0 ||
    (context.repo.evaluation?.samplePaths.length ?? 0) > 0
  ) {
    evidence.push({
      kind: "evaluation",
      detail: [
        context.repo.evaluation?.representativeCommands.length
          ? `Representative lane ${context.repo.evaluation.representativeCommands.join(" | ")}`
          : null,
        context.repo.evaluation?.samplePaths.length
          ? `Samples ${context.repo.evaluation.samplePaths.join(" | ")}`
          : null,
      ]
        .filter((value): value is string => Boolean(value))
        .join("; "),
    });
  }
  return evidence;
}

function buildResponseFormat(): string {
  return [
    "Respond with concise sections using these exact headings:",
    "Outcome:",
    "Changed Files:",
    "Validation:",
    "Blockers:",
    "Waypoint Status: arrived|missed|blocked",
    "Arrival Criteria Met:",
    "Arrival Criteria Missed:",
    "Progress:",
    "Off Route: yes|no",
    "Reroute Reason:",
    "Human Checkpoint: yes|no",
    "Goal reached: yes|no",
  ].join("\n");
}

function pickValidationPlan(context: AutoDriveContextSnapshot): string[] {
  if ((context.repo.evaluation?.representativeCommands.length ?? 0) > 0) {
    return context.repo.evaluation?.representativeCommands ?? [];
  }
  return context.executionTuning.validationCommandPreference === "full" &&
    context.repo.scripts.validate
    ? ["pnpm validate"]
    : context.repo.scripts.validateFast
      ? ["pnpm validate:fast"]
      : context.repo.scripts.validate
        ? ["pnpm validate"]
        : [];
}

function resolveHistoricalValidationPlan(context: AutoDriveContextSnapshot): string[] {
  const commands = context.publishHistory.bestCorridor?.validationCommands ?? [];
  if (commands.length === 0) {
    return [];
  }
  return dedupe(
    commands.map((command) => {
      if (
        context.executionTuning.validationCommandPreference === "full" &&
        context.repo.scripts.validate &&
        command === context.repo.scripts.validateFast
      ) {
        return context.repo.scripts.validate;
      }
      if (
        context.executionTuning.validationCommandPreference === "fast" &&
        context.repo.scripts.validateFast &&
        command === context.repo.scripts.validate
      ) {
        return context.repo.scripts.validateFast;
      }
      return command;
    })
  );
}

function buildContinuationFocus(params: {
  previousSummary: AutoDriveContextSnapshot["previousSummary"];
  validationPlan: string[];
}): string[] {
  const previousSummary = params.previousSummary;
  if (!previousSummary?.goalReached) {
    return [];
  }

  const focus: string[] = [];
  const validationPlanSummary = params.validationPlan.join(" | ");

  if (previousSummary.validation.success === false) {
    const validationFailure =
      previousSummary.validation.failures[0] ?? previousSummary.validation.summary;
    focus.push(`Repair the failing verification lane: ${validationFailure}`);
  } else if (previousSummary.validation.success !== true) {
    focus.push(
      validationPlanSummary.length > 0
        ? `Run the required validation lane and close failures: ${validationPlanSummary}`
        : `Close the open validation gap: ${previousSummary.validation.summary}`
    );
  }

  for (const missedCriterion of previousSummary.waypoint.arrivalCriteriaMissed.slice(0, 2)) {
    focus.push(`Satisfy the missed arrival criterion: ${missedCriterion}`);
  }

  for (const blocker of previousSummary.blockers.slice(0, 2)) {
    focus.push(`Resolve the active blocker: ${blocker}`);
  }

  if (previousSummary.routeHealth.offRoute || previousSummary.routeHealth.rerouteRecommended) {
    focus.push(
      `Re-anchor the route before continuing: ${
        previousSummary.routeHealth.rerouteReason ??
        previousSummary.routeHealth.triggerSignals[0] ??
        "The previous waypoint drifted from plan."
      }`
    );
  }

  for (const unresolvedItem of previousSummary.unresolvedItems.slice(0, 1)) {
    focus.push(`Close the remaining unresolved item: ${unresolvedItem}`);
  }

  if (focus.length === 0) {
    focus.push("Gather stronger verification evidence and avoid reopening already completed work.");
  }

  return dedupe(focus, 4);
}

function buildMilestones(params: {
  run: AutoDriveRunRecord;
  context: AutoDriveContextSnapshot;
  repoAreas: string[];
  validationPlan: string[];
}): AutoDriveRouteMilestone[] {
  const implementationAreas = params.repoAreas;
  const previousProgress = params.context.previousSummary?.progress;
  const completedWaypoints = previousProgress?.completedWaypoints ?? 0;
  const offRoute = params.context.startState.routeHealth.offRoute;

  return [
    {
      id: "baseline",
      title: "Map the current start state and hard boundaries",
      description: "Lock the route to the current repo, budget, and policy context.",
      status: completedWaypoints >= 1 ? "completed" : "active",
      arrivalCriteria: [
        "Summarize the current branch, blockers, and budget pressure.",
        "Confirm the route stays within the approved runtime boundary.",
      ],
      repoAreas: implementationAreas.slice(0, 2),
    },
    {
      id: "implement",
      title: "Advance the current waypoint in the target surface",
      description: "Make the smallest safe code change toward the destination.",
      status:
        completedWaypoints >= 2 ? "completed" : completedWaypoints >= 1 ? "active" : "remaining",
      arrivalCriteria: [
        "Update only the waypoint repo areas or adjacent boundary plumbing.",
        "Keep manual composer mode intact while advancing the destination.",
      ],
      repoAreas: implementationAreas,
    },
    {
      id: "validate",
      title: "Validate the route and decide whether to arrive or reroute",
      description: "Run the narrowest checks and decide whether the destination is reached.",
      status: offRoute ? "blocked" : "remaining",
      arrivalCriteria: params.validationPlan.length
        ? params.validationPlan
        : ["Explain why no validation command is available in this workspace."],
      repoAreas: implementationAreas,
    },
  ];
}

function resolveRouteSummary(params: {
  context: AutoDriveContextSnapshot;
  milestones: AutoDriveRouteMilestone[];
}) {
  const milestoneTitles = params.milestones.map((milestone) => milestone.title).join(" -> ");
  return [
    `Start from ${params.context.startState.summary}`,
    `Navigate toward ${params.context.destination.title}.`,
    `Route: ${milestoneTitles}.`,
  ].join(" ");
}

function buildWaypoint(params: {
  run: AutoDriveRunRecord;
  context: AutoDriveContextSnapshot;
  repoAreas: string[];
  routeSummary: string;
  milestones: AutoDriveRouteMilestone[];
  validationPlan: string[];
}): AutoDriveWaypointProposal {
  const browserFixLoop = isBrowserFixLoop({
    run: params.run,
    context: params.context,
  });
  const remainingIterations = params.context.startState.system.remainingIterations;
  const remainingTokens = params.context.startState.system.remainingTokensEstimate;
  const lowBudget =
    remainingIterations <= 1 || (remainingTokens !== null && remainingTokens <= 1200);
  const previousSummary = params.context.previousSummary;
  const priorFailedValidation = previousSummary?.validation.success === false;
  const priorOffRoute = params.context.startState.routeHealth.offRoute;
  const continuationFocus = buildContinuationFocus({
    previousSummary,
    validationPlan: params.validationPlan,
  });
  const needsContinuationFollowUp =
    params.run.continuationPolicy?.enabled !== false &&
    previousSummary?.goalReached === true &&
    continuationFocus.length > 0;

  let title = "Establish the route baseline";
  let objective =
    "Inspect the current repo state, destination, and boundaries before making changes.";
  let whyNow = "The controller needs a trustworthy start-state model before driving further.";
  let arrivalCriteria = [
    "Summarize the current state, destination, and approved route in the target surfaces.",
    "Name the next implementation milestone without broadening scope.",
  ];
  let rerouteTriggers = [
    "The target surfaces exceed the per-iteration file budget.",
    "The repo rules conflict with the current route.",
  ];
  let commandsToRun: string[] = [];
  let samplePaths = params.context.repo.evaluation?.samplePaths ?? [];
  let heldOutGuidance = params.context.repo.evaluation?.heldOutGuidance ?? [];
  let scenarioKeys = params.context.repo.evaluation?.scenarioKeys ?? [];
  let estimatedRisk: AutoDriveRiskLevel = "low";

  if (previousSummary && !priorFailedValidation && !priorOffRoute) {
    title = lowBudget
      ? "Validate and close the shortest safe route"
      : "Advance the current waypoint";
    objective = lowBudget
      ? "Use the shortest route to validate progress and decide whether to arrive or stop safely."
      : "Make the smallest safe code change toward the destination while staying on route.";
    whyNow = lowBudget
      ? "Budget pressure is high, so the route should favor validation and safe stopping."
      : "The baseline is known, so the route should move into the highest-leverage waypoint.";
    arrivalCriteria = [
      "Advance the current milestone without touching forbidden route areas.",
      "Leave behind a clear progress signal or a concrete blocker for the next decision.",
      ...params.validationPlan,
    ];
    rerouteTriggers = [
      "Validation fails for the current waypoint.",
      "The waypoint cannot be completed without widening scope.",
      "A new blocker or boundary rule invalidates the route.",
    ];
    commandsToRun = params.validationPlan;
    estimatedRisk = lowBudget ? "medium" : "low";
  }

  if (priorFailedValidation) {
    title = "Repair the route after validation drift";
    objective = "Recover from the failed validation without widening the route.";
    whyNow = "Validation failure means the current route is no longer trustworthy.";
    arrivalCriteria = [
      "Resolve the reported validation failure in the touched waypoint areas.",
      ...params.validationPlan,
    ];
    rerouteTriggers = [
      "Fixing validation requires a broader refactor.",
      "The remaining budget is too small for a safe repair.",
    ];
    commandsToRun = params.validationPlan;
    estimatedRisk = "high";
  }

  if (priorOffRoute) {
    title = "Reroute back to the destination corridor";
    objective =
      "Stabilize the route and pick the smallest waypoint that restores destination alignment.";
    whyNow =
      params.context.startState.routeHealth.rerouteReason ??
      "The previous result drifted away from the current route.";
    arrivalCriteria = [
      "Explain the route change and re-anchor the next waypoint.",
      "Keep the new route inside hard boundaries and budget.",
    ];
    rerouteTriggers = [
      "The new route still fails to satisfy the current waypoint arrival criteria.",
      "A human checkpoint is required before continuing.",
    ];
    estimatedRisk = "high";
  }

  if (needsContinuationFollowUp) {
    title = browserFixLoop
      ? "Close the remaining browser verification gap"
      : "Close the remaining verification gap";
    objective = browserFixLoop
      ? "Reuse the current route, avoid repeating already completed work, and close the highest-priority remaining real-browser verification or blocker gap."
      : "Reuse the current route, avoid repeating already completed work, and close the highest-priority remaining validation or blocker gap.";
    whyNow =
      continuationFocus[0] ??
      "The destination is close, but the route still needs stronger verification before arrival.";
    arrivalCriteria = dedupe([
      ...continuationFocus,
      ...(browserFixLoop
        ? [
            "Confirm the target repro or final assertion in the real browser.",
            "Attach screenshot or browser evidence before declaring arrival.",
          ]
        : []),
      "Leave behind explicit verification evidence or a concrete blocker for the next decision.",
    ]);
    rerouteTriggers = dedupe([
      "The remaining gap requires broadening scope or reopening settled work.",
      "The current route drifts away from the unresolved verification target.",
      ...params.validationPlan.map(
        (command) => `The continuation loop cannot make ${command} pass without a wider reroute.`
      ),
    ]);
    commandsToRun = params.validationPlan;
    estimatedRisk =
      previousSummary?.validation.success === false || previousSummary?.routeHealth.offRoute
        ? "high"
        : "medium";
  }

  if (browserFixLoop) {
    heldOutGuidance = dedupe([...heldOutGuidance, ...getBrowserReproFixVerifyGuidance()]);
    scenarioKeys = dedupe([...scenarioKeys, "browser_repro_fix_verify"]);
    if (!needsContinuationFollowUp) {
      arrivalCriteria = dedupe([
        ...arrivalCriteria,
        "Confirm the target repro or user-visible assertion in the real browser.",
        "Return to the real browser after editing and capture browser evidence.",
      ]);
    }
    rerouteTriggers = dedupe([
      ...rerouteTriggers,
      "The browser session is unavailable, blocked, or no longer matches the target repro path.",
    ]);
    samplePaths = dedupe(samplePaths, samplePaths.length);
  }

  return {
    id: `waypoint-${params.context.iteration}`,
    title,
    objective,
    whyNow,
    repoAreas: params.repoAreas,
    commandsToRun,
    validationPlan: params.validationPlan,
    samplePaths,
    heldOutGuidance,
    scenarioKeys,
    arrivalCriteria,
    stopIf: [
      "The change requires destructive edits or dependency churn.",
      ...params.context.destination.hardBoundaries,
    ],
    rerouteTriggers,
    expectedOutput: [
      "A concise route-aware execution summary.",
      "A waypoint arrival decision with progress and off-route signals.",
    ],
    estimatedCost: {
      tokens: Math.max(400, params.repoAreas.join("\n").length * 8),
      iterations: 1,
      durationMs: 5 * 60 * 1000,
      risk: estimatedRisk,
    },
    confidence:
      params.context.startState.system.stopRisk === "high" || estimatedRisk === "high"
        ? "low"
        : "medium",
  };
}

function buildPromptText(params: {
  run: AutoDriveRunRecord;
  context: AutoDriveContextSnapshot;
  routeSummary: string;
  waypoint: AutoDriveWaypointProposal;
  milestones: AutoDriveRouteMilestone[];
}) {
  const browserFixLoop = isBrowserFixLoop({
    run: params.run,
    context: params.context,
  });
  const continuationPolicy = params.run.continuationPolicy;
  const continuationState = params.run.continuationState;
  const selectedOpportunity =
    params.context.opportunities.candidates.find(
      (candidate) => candidate.id === params.context.opportunities.selectedCandidateId
    ) ?? null;
  const selectedScoreBreakdown =
    selectedOpportunity?.scoreBreakdown
      ?.map((entry) => `${entry.reasonCode}:${entry.delta >= 0 ? "+" : ""}${entry.delta}`)
      .join(" | ") ?? "none";
  const continuationFocus = buildContinuationFocus({
    previousSummary: params.context.previousSummary,
    validationPlan: params.waypoint.validationPlan,
  });
  const previousSummary = params.context.previousSummary;
  const latestGapSummary = previousSummary
    ? [
        previousSummary.validation.success === true
          ? "Validation currently green."
          : previousSummary.validation.success === false
            ? `Validation failing: ${previousSummary.validation.summary}`
            : `Validation still pending: ${previousSummary.validation.summary}`,
        previousSummary.waypoint.arrivalCriteriaMissed.length > 0
          ? `Missed criteria ${previousSummary.waypoint.arrivalCriteriaMissed.join(" | ")}`
          : null,
        previousSummary.blockers.length > 0
          ? `Blockers ${previousSummary.blockers.join(" | ")}`
          : null,
      ]
        .filter((value): value is string => Boolean(value))
        .join("; ")
    : "No previous summary available.";
  return [
    `Destination: ${params.context.destination.title}`,
    `Desired end state: ${params.context.destination.desiredEndState.join(" | ")}`,
    `Done definition: ${params.context.destination.doneDefinition.arrivalCriteria.join(" | ")}`,
    `Required validation for arrival: ${params.context.destination.doneDefinition.requiredValidation.join(" | ") || "none"}`,
    `Hard boundaries: ${params.context.destination.hardBoundaries.join(" | ") || "none"}`,
    `Route preference: ${params.context.destination.routePreference}`,
    `Start state: ${params.context.startState.summary}`,
    `Intent summary: ${params.context.intent.summary}`,
    `Direction hypothesis: ${params.context.intent.directionHypotheses[0]?.summary ?? "No direction hypothesis available."}`,
    `Selected opportunity: ${selectedOpportunity?.summary ?? "No ranked opportunity selected."}`,
    `Opportunity decision: ${params.context.opportunities.selectionSummary ?? "No decision summary available."}`,
    `Opportunity score breakdown: ${selectedScoreBreakdown}`,
    `Execution tuning: ${params.context.executionTuning.summary} Preference ${params.context.executionTuning.validationCommandPreference}, caution ${params.context.executionTuning.cautionLevel}, publish ${params.context.executionTuning.publishPriority}.`,
    `Publish readiness: ${params.context.publishReadiness.summary} Reasons: ${params.context.publishReadiness.reasonCodes.join(" | ") || "none"}`,
    `Historical publish corridor: ${params.context.publishHistory.bestCorridor?.summaryText ?? "none"}`,
    `Historical publish caution: ${params.context.publishHistory.latestFailureSummary ?? "none"}`,
    `System pressure: remaining iterations ${params.context.startState.system.remainingIterations}, remaining tokens ${params.context.startState.system.remainingTokensEstimate ?? "n/a"}, reroutes ${params.context.startState.system.rerouteCount}/${params.run.budget.maxReroutes}`,
    continuationPolicy?.enabled !== false
      ? `Continuation policy: Keep iterating until validation is green and confidence reaches ${continuationPolicy?.minimumConfidenceToStop ?? "high"}, capped at ${continuationPolicy?.maxAutomaticFollowUps ?? 2} automatic follow-ups.`
      : "Continuation policy: Do not auto-append follow-up prompts.",
    continuationPolicy?.enabled !== false
      ? `Continuation state: used ${continuationState?.automaticFollowUpCount ?? 0}/${continuationPolicy?.maxAutomaticFollowUps ?? 2} automatic follow-ups. Last reason: ${continuationState?.lastContinuationReason ?? "none"}.`
      : null,
    continuationFocus.length > 0 ? `Continuation focus: ${continuationFocus.join(" | ")}` : null,
    browserFixLoop ? "Browser scenario: browser_repro_fix_verify" : null,
    `Latest verification gap: ${latestGapSummary}`,
    `Route summary: ${params.routeSummary}`,
    `Current waypoint: ${params.waypoint.title}`,
    `Waypoint objective: ${params.waypoint.objective}`,
    `Why now: ${params.waypoint.whyNow}`,
    `Evaluation strategy: ${params.waypoint.validationPlan.join(" | ") || "No representative evaluation lane available."}`,
    `Representative samples: ${params.waypoint.samplePaths.join(" | ") || "none"}`,
    `Held-out guidance: ${params.waypoint.heldOutGuidance.join(" | ") || "none"}`,
    browserFixLoop
      ? "Browser execution rule: Confirm the repro in the real browser before editing, then return for final verification and screenshot evidence."
      : null,
    `Arrival criteria: ${params.waypoint.arrivalCriteria.join(" | ")}`,
    `Reroute triggers: ${params.waypoint.rerouteTriggers.join(" | ")}`,
    `Milestones: ${params.milestones.map((milestone) => `${milestone.status}:${milestone.title}`).join(" | ")}`,
    `Collaborator intent: ${params.context.collaboratorIntent.probableIntent}`,
    "Execution rule: Reuse the current route/session state, do not redo completed work, close the highest-priority unresolved gap first, then verify again before declaring arrival.",
    buildResponseFormat(),
  ].join("\n\n");
}

export function buildNextTaskProposal(params: {
  run: AutoDriveRunRecord;
  context: AutoDriveContextSnapshot;
  previousSummary: AutoDriveContextSnapshot["previousSummary"];
}): AutoDriveRouteProposal {
  const selectedOpportunity =
    params.context.opportunities.candidates.find(
      (candidate) => candidate.id === params.context.opportunities.selectedCandidateId
    ) ??
    params.context.opportunities.candidates[0] ??
    null;
  const historicalRepoAreas =
    selectedOpportunity?.id === "push_publish_candidate"
      ? (params.context.publishHistory.bestCorridor?.changedFiles ?? [])
      : [];
  const validationPlan =
    selectedOpportunity?.id === "push_publish_candidate"
      ? resolveHistoricalValidationPlan(params.context)
      : pickValidationPlan(params.context);
  const repoAreas = dedupe(
    selectedOpportunity?.repoAreas.length
      ? [...selectedOpportunity.repoAreas, ...historicalRepoAreas]
      : params.context.intent.directionHypotheses[0]?.suggestedAreas.length
        ? params.context.intent.directionHypotheses[0].suggestedAreas
        : params.context.previousSummary?.suggestedNextAreas.length
          ? params.context.previousSummary.suggestedNextAreas
          : params.context.repo.relevantFiles,
    Math.min(
      params.run.budget.maxFilesPerIteration ?? 6,
      params.context.executionTuning.effectiveMaxFilesPerIteration
    )
  );
  const milestones = buildMilestones({
    run: params.run,
    context: params.context,
    repoAreas,
    validationPlan,
  });
  const routeSummary = resolveRouteSummary({
    context: params.context,
    milestones,
  });
  const currentWaypoint = buildWaypoint({
    run: params.run,
    context: params.context,
    repoAreas,
    routeSummary,
    milestones,
    validationPlan,
  });
  const routeConfidence =
    params.context.startState.system.stopRisk === "high" ||
    params.context.startState.routeHealth.rerouteRecommended
      ? "low"
      : currentWaypoint.confidence;
  const promptText = buildPromptText({
    run: params.run,
    context: params.context,
    routeSummary,
    waypoint: currentWaypoint,
    milestones,
  });

  return {
    schemaVersion: "autodrive-route-proposal/v2",
    runId: params.run.runId,
    iteration: params.context.iteration,
    routeSummary,
    routeSelectionReason: [
      `Route preference ${params.run.destination.routePreference.replace(/_/g, " ")} is active.`,
      `Direction hypothesis: ${params.context.intent.directionHypotheses[0]?.summary ?? "none"}.`,
      `Selected opportunity: ${selectedOpportunity?.id ?? "none"} (${selectedOpportunity?.title ?? "none"}).`,
      `Execution tuning: ${params.context.executionTuning.summary}`,
      params.context.publishHistory.bestCorridor
        ? `Historical publish corridor: ${params.context.publishHistory.bestCorridor.summaryText}`
        : "No historical publish corridor is active.",
      params.context.publishHistory.latestFailureSummary
        ? `Historical publish caution: ${params.context.publishHistory.latestFailureSummary}`
        : "No historical publish caution is active.",
      params.context.startState.routeHealth.rerouteRecommended
        ? `Reroute signal detected: ${params.context.startState.routeHealth.rerouteReason ?? "unknown trigger"}.`
        : "No reroute signal is active.",
    ].join(" "),
    whyThisWaypointNow: currentWaypoint.whyNow,
    evidence: buildEvidence(params.context),
    evidenceSummary: [
      params.context.intent.summary,
      ...params.context.repo.ruleEvidence.slice(0, 2).map((entry) => entry.summary),
      ...params.context.destination.doneDefinition.arrivalCriteria.slice(0, 2),
    ].join(" "),
    collaboratorIntentSummary: params.context.collaboratorIntent.probableIntent,
    milestones,
    currentWaypoint,
    remainingMilestones: milestones
      .filter((milestone) => milestone.status === "remaining" || milestone.status === "blocked")
      .map((milestone) => milestone.title),
    routeConfidence,
    promptText,
  };
}

export function reviewNextTaskProposal(params: {
  proposal: AutoDriveRouteProposal;
  context: AutoDriveContextSnapshot;
  run: AutoDriveRunRecord;
}): AutoDriveProposalReview {
  const { proposal, context, run } = params;
  const issues: AutoDriveProposalReview["issues"] = [];

  if ((run.budget.maxFilesPerIteration ?? 8) < proposal.currentWaypoint.repoAreas.length) {
    issues.push({
      code: "scope_too_large",
      detail: `Waypoint touches ${proposal.currentWaypoint.repoAreas.length} areas, exceeding the configured per-iteration budget.`,
    });
  }
  if (
    proposal.currentWaypoint.repoAreas.some(
      (area) =>
        area.startsWith("apps/code-tauri/") || area.startsWith("packages/code-runtime-service-rs/")
    ) &&
    !/tauri|rust|runtime host/i.test(run.destination.title)
  ) {
    issues.push({
      code: "desktop_web_mixup",
      detail:
        "The route mixes desktop or Rust runtime surfaces into a destination that currently reads like a web-app slice.",
    });
  }
  if (
    proposal.currentWaypoint.validationPlan.length === 0 &&
    proposal.currentWaypoint.repoAreas.length > 0
  ) {
    issues.push({
      code: "missing_validation",
      detail: "Mutating waypoints should include at least one explicit validation step.",
    });
  }
  if (
    context.collaboratorIntent.conflictRisk === "high" &&
    context.collaboratorIntent.confidence !== "low"
  ) {
    issues.push({
      code: "protected_boundary_conflict",
      detail:
        "Recent collaborator signals suggest a high conflict risk against current boundary changes.",
    });
  }
  if (
    context.collaboratorIntent.confidence === "low" &&
    /mainline|team intends|clearly|definitely/i.test(proposal.collaboratorIntentSummary)
  ) {
    issues.push({
      code: "low_evidence_inference",
      detail: "The route overstates collaborator intent despite limited evidence.",
    });
  }
  if (!proposal.promptText.includes("Destination:")) {
    issues.push({
      code: "proposal_drift",
      detail: "The rendered route prompt does not restate the destination.",
    });
  }
  if (
    context.startState.system.stopRisk === "high" ||
    context.startState.system.remainingIterations <= 0
  ) {
    issues.push({
      code: "route_budget_pressure",
      detail:
        "The current start state is already at a high stop risk or has no remaining iteration budget.",
    });
  }
  if (
    context.startState.routeHealth.rerouteRecommended &&
    !/reroute/i.test(proposal.currentWaypoint.title)
  ) {
    issues.push({
      code: "reroute_required",
      detail:
        "The route health recommends rerouting, but the current waypoint does not acknowledge it.",
    });
  }

  const confidence = issues.some(
    (issue) =>
      issue.code === "scope_too_large" ||
      issue.code === "protected_boundary_conflict" ||
      issue.code === "route_budget_pressure"
  )
    ? "low"
    : proposal.routeConfidence;

  return {
    approved:
      issues.length === 0 ||
      issues.every(
        (issue) => issue.code === "reroute_required" || issue.code === "route_budget_pressure"
      ),
    issues,
    confidence,
    shouldReroute: issues.some((issue) => issue.code === "reroute_required"),
    rerouteReason:
      issues.find((issue) => issue.code === "reroute_required")?.detail ??
      (context.startState.routeHealth.rerouteReason || null),
  };
}
