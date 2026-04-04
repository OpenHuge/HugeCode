import {
  resolveCanonicalRuntimeTruth,
  type AgentTaskSummary,
  type HugeCodeMissionLineage,
  type HugeCodeReviewPackSummary,
  type HugeCodeReviewStatus,
  type HugeCodeRunLedger,
  type HugeCodeRunState,
  type HugeCodeRunSummary,
  type HugeCodeTaskMode,
  type HugeCodeValidationOutcome,
} from "@ku0/code-runtime-host-contract";

export type RuntimeMissionControlReviewPackProjectionHelpers = {
  deriveTaskMode: (run: Pick<HugeCodeRunSummary, "executionProfile">) => {
    mode: HugeCodeTaskMode | null;
  };
  deriveValidationOutcome: (
    validations: HugeCodeRunSummary["validations"]
  ) => HugeCodeValidationOutcome;
  buildMissionLineage: (input: {
    objective: string | null;
    taskSource?: HugeCodeRunSummary["taskSource"] | null;
    executionProfileId?: string | null;
    taskMode?: HugeCodeTaskMode | null;
    autoDrive?: HugeCodeRunSummary["autoDrive"] | null;
    reviewDecision?: HugeCodeRunSummary["reviewDecision"] | null;
  }) => HugeCodeMissionLineage;
  buildRunWorkspaceEvidence: (input: {
    run: HugeCodeRunSummary;
  }) => HugeCodeRunSummary["workspaceEvidence"];
  buildGovernanceSummary: (input: {
    runState: HugeCodeRunState;
    approval: NonNullable<HugeCodeRunSummary["approval"]>;
    reviewDecision: HugeCodeRunSummary["reviewDecision"];
    intervention: NonNullable<HugeCodeRunSummary["intervention"]>;
    nextAction: NonNullable<HugeCodeRunSummary["nextAction"]>;
    completionReason: string | null;
    subAgents: HugeCodeRunSummary["subAgents"];
  }) => HugeCodeRunSummary["governance"];
  buildRuntimeContinuationDescriptor: (input: {
    runState: HugeCodeRunState;
    checkpoint: HugeCodeRunSummary["checkpoint"];
    continuation: HugeCodeRunSummary["continuation"];
    missionLinkage: HugeCodeRunSummary["missionLinkage"];
    actionability: HugeCodeRunSummary["actionability"];
    publishHandoff: HugeCodeRunSummary["publishHandoff"];
    takeoverBundle: HugeCodeRunSummary["takeoverBundle"];
    nextAction: HugeCodeRunSummary["nextAction"];
    reviewPackId: string;
  }) => {
    state: "ready" | "attention" | "blocked" | "missing";
    summary: string;
    detail: string | null;
    recommendedAction: string | null;
    continuePathLabel: string | null;
    truthSourceLabel: string | null;
    continuityOverview: string | null;
    checkpointDurabilityState: string | null;
    hasHandoffPath: boolean;
    canSafelyContinue: boolean;
    reviewFollowUpActionable: boolean;
  };
  buildReviewPackAssumptions: (
    run: HugeCodeRunSummary,
    reviewStatus: HugeCodeReviewStatus
  ) => string[];
  buildReviewPackBackendAudit: (
    run: HugeCodeRunSummary
  ) => HugeCodeReviewPackSummary["backendAudit"];
  buildReviewPackEvidenceRefs: (input: {
    ledger: HugeCodeRunSummary["ledger"];
    artifacts: HugeCodeRunSummary["artifacts"];
    checkpoint: HugeCodeRunSummary["checkpoint"];
  }) => HugeCodeReviewPackSummary["evidenceRefs"];
  buildReviewPackFileChanges: (
    changedPaths: HugeCodeRunSummary["changedPaths"]
  ) => HugeCodeReviewPackSummary["fileChanges"];
  buildReviewPackReproductionGuidance: (
    validations: HugeCodeRunSummary["validations"],
    checksPerformed: string[],
    artifacts: HugeCodeRunSummary["artifacts"]
  ) => string[];
  buildReviewPackRollbackGuidance: (
    run: HugeCodeRunSummary,
    artifacts: HugeCodeRunSummary["artifacts"]
  ) => string[];
  isTerminalRunState: (state: HugeCodeRunState) => boolean;
};

function buildReviewStatus(
  run: HugeCodeRunSummary,
  validationOutcome: HugeCodeValidationOutcome,
  evidenceState: HugeCodeRunLedger["evidenceState"]
): HugeCodeReviewStatus {
  if (run.state === "failed" || run.state === "cancelled" || validationOutcome === "failed") {
    return "action_required";
  }
  if (evidenceState === "incomplete") {
    return "incomplete_evidence";
  }
  return "ready";
}

function deriveFailureClass(input: {
  runState: HugeCodeRunSummary["state"];
  approval: HugeCodeRunSummary["approval"];
  relaunchContext: AgentTaskSummary["relaunchContext"] | HugeCodeRunSummary["relaunchContext"];
}): HugeCodeReviewPackSummary["failureClass"] {
  const failureClass = input.relaunchContext?.failureClass ?? null;
  if (failureClass) {
    return failureClass;
  }
  if (input.approval?.status === "pending_decision" || input.approval?.status === "rejected") {
    return "approval_required";
  }
  if (input.runState === "cancelled") {
    return "cancelled";
  }
  if (input.runState === "failed") {
    return "runtime_failed";
  }
  return null;
}

function buildReviewPackRelaunchOptions(
  run: Pick<
    HugeCodeRunSummary,
    "id" | "taskId" | "missionBrief" | "relaunchContext" | "intervention"
  >
): HugeCodeReviewPackSummary["relaunchOptions"] {
  const availableActions = (run.intervention?.actions ?? []).filter((action) =>
    [
      "retry",
      "continue_with_clarification",
      "switch_profile_and_retry",
      "escalate_to_pair_mode",
    ].includes(action.action)
  );
  const recommendedActions = Array.from(
    new Set(
      [
        ...(run.relaunchContext?.recommendedActions ?? []),
        ...availableActions
          .filter((action) => action.enabled && action.supported)
          .map((action) => action.action),
      ].filter((action) =>
        [
          "retry",
          "continue_with_clarification",
          "switch_profile_and_retry",
          "escalate_to_pair_mode",
        ].includes(action)
      )
    )
  );
  const primaryAction =
    run.intervention?.primaryAction &&
    [
      "retry",
      "continue_with_clarification",
      "switch_profile_and_retry",
      "escalate_to_pair_mode",
    ].includes(run.intervention.primaryAction)
      ? run.intervention.primaryAction
      : null;

  if (!run.relaunchContext && recommendedActions.length === 0 && availableActions.length === 0) {
    return null;
  }

  return {
    sourceTaskId: run.relaunchContext?.sourceTaskId ?? run.taskId,
    sourceRunId: run.relaunchContext?.sourceRunId ?? run.id,
    sourceReviewPackId: run.relaunchContext?.sourceReviewPackId ?? `review-pack:${run.id}`,
    sourcePlanVersion:
      run.relaunchContext?.sourcePlanVersion ?? run.missionBrief?.planVersion ?? null,
    summary:
      run.relaunchContext?.summary ??
      (availableActions.length > 0
        ? "Structured relaunch options are available from the recorded run context."
        : null),
    failureClass: run.relaunchContext?.failureClass ?? null,
    recommendedActions: recommendedActions.length > 0 ? recommendedActions : null,
    planChangeSummary: run.relaunchContext?.planChangeSummary ?? null,
    primaryAction,
    availableActions: availableActions.length > 0 ? availableActions : null,
  };
}

function buildReviewPackPublishHandoff(
  run: Pick<HugeCodeRunSummary, "publishHandoff">
): HugeCodeReviewPackSummary["publishHandoff"] {
  return run.publishHandoff ?? null;
}

export function buildRunPublishHandoff(
  task: Pick<AgentTaskSummary, "taskId" | "publishHandoff" | "autoDrive">
): HugeCodeRunSummary["publishHandoff"] {
  if (task.publishHandoff) {
    return task.publishHandoff;
  }
  const stop = task.autoDrive?.stop;
  if (!stop) {
    return null;
  }
  return {
    jsonPath: `.hugecode/runs/${task.taskId}/publish/handoff.json`,
    markdownPath: `.hugecode/runs/${task.taskId}/publish/handoff.md`,
    reason: stop.reason,
    summary: stop.summary ?? null,
    at: stop.at ?? null,
  };
}

export function projectCompletedRunToReviewPackSummary(
  run: HugeCodeRunSummary,
  helpers: RuntimeMissionControlReviewPackProjectionHelpers
): HugeCodeReviewPackSummary | null {
  if (!helpers.isTerminalRunState(run.state)) {
    return null;
  }

  const warnings = run.warnings ?? [];
  const validations = run.validations ?? [];
  const artifacts = run.artifacts ?? [];
  const changedPaths = run.changedPaths ?? [];
  const evidenceState =
    run.ledger?.evidenceState ??
    (validations.length > 0 || warnings.length > 0 || artifacts.length > 0
      ? "confirmed"
      : "incomplete");
  const validationOutcome = helpers.deriveValidationOutcome(validations);
  const reviewStatus = buildReviewStatus(run, validationOutcome, evidenceState);
  const canonicalTruth = resolveCanonicalRuntimeTruth({
    workspaceId: run.workspaceId,
    taskId: run.taskId,
    runId: run.id,
    reviewPackId: run.reviewPackId ?? `review-pack:${run.id}`,
    state: run.state,
    reviewStatus,
    approval: run.approval ?? null,
    reviewDecision: run.reviewDecision ?? null,
    nextAction: run.nextAction ?? null,
    checkpoint: run.checkpoint ?? null,
    missionLinkage: run.missionLinkage ?? null,
    actionability: run.actionability ?? null,
    publishHandoff: run.publishHandoff ?? null,
    takeoverBundle: run.takeoverBundle ?? null,
    sessionBoundary: run.sessionBoundary ?? null,
    continuation: run.continuation ?? null,
    nextOperatorAction: run.nextOperatorAction ?? null,
  });
  const reviewPackId = run.reviewPackId ?? `review-pack:${run.id}`;
  const continuationDescriptor = helpers.buildRuntimeContinuationDescriptor({
    runState: run.state,
    checkpoint: run.checkpoint ?? null,
    continuation: canonicalTruth.continuation,
    missionLinkage: run.missionLinkage ?? null,
    actionability: run.actionability ?? null,
    publishHandoff: run.publishHandoff ?? null,
    takeoverBundle: run.takeoverBundle ?? null,
    nextAction: run.nextAction ?? null,
    reviewPackId,
  });
  const hasCanonicalContinuationTruth = canonicalTruth.continuation !== null;
  const reviewDecision =
    run.reviewDecision ??
    (run.reviewPackId
      ? {
          status: "pending" as const,
          reviewPackId: run.reviewPackId,
          label: "Decision pending",
          summary: "Accept or reject this result from the review surface.",
          decidedAt: null,
        }
      : null);
  const sessionBoundary = canonicalTruth.sessionBoundary;
  const continuation = canonicalTruth.continuation;
  const nextOperatorAction = canonicalTruth.nextOperatorAction;
  const checksPerformed = validations.map((validation) => validation.label);
  const fileChanges = helpers.buildReviewPackFileChanges(changedPaths);
  const assumptions = helpers.buildReviewPackAssumptions(run, reviewStatus);
  const reproductionGuidance = helpers.buildReviewPackReproductionGuidance(
    validations,
    checksPerformed,
    artifacts
  );
  const rollbackGuidance = helpers.buildReviewPackRollbackGuidance(run, artifacts);
  const backendAudit = helpers.buildReviewPackBackendAudit(run);
  const evidenceRefs = helpers.buildReviewPackEvidenceRefs({
    ledger: run.ledger ?? null,
    artifacts,
    checkpoint: run.checkpoint ?? null,
  });
  const ledger: HugeCodeRunLedger = {
    ...(run.ledger ?? {
      traceId: null,
      checkpointId: null,
      recovered: false,
      stepCount: 0,
      completedStepCount: 0,
      warningCount: warnings.length,
      validationCount: validations.length,
      artifactCount: artifacts.length,
      evidenceState,
      backendId: run.routing?.backendId ?? null,
      routeLabel: run.routing?.routeLabel ?? null,
      completionReason: run.completionReason ?? null,
      lastProgressAt: run.updatedAt,
    }),
    warningCount: warnings.length,
    validationCount: validations.length,
    artifactCount: artifacts.length,
    evidenceState,
  };

  return {
    id: reviewPackId,
    runId: run.id,
    taskId: run.taskId,
    workspaceId: run.workspaceId,
    summary:
      run.summary ??
      run.title ??
      run.completionReason ??
      (run.state === "failed" ? "Run failed without a recorded summary." : "Review-ready result"),
    reviewStatus: reviewDecision?.status === "rejected" ? "action_required" : reviewStatus,
    evidenceState,
    validationOutcome,
    warningCount: warnings.length,
    warnings,
    validations,
    artifacts,
    checksPerformed,
    recommendedNextAction:
      nextOperatorAction?.detail ??
      nextOperatorAction?.label ??
      continuationDescriptor?.recommendedAction ??
      (reviewDecision?.status === "accepted"
        ? "Accepted in review. No further action is required unless follow-up work is needed."
        : reviewDecision?.status === "rejected"
          ? "Rejected in review. Open the mission thread to retry or reroute with operator feedback."
          : ((hasCanonicalContinuationTruth ? continuationDescriptor?.recommendedAction : null) ??
            run.nextAction?.label ??
            (reviewStatus === "ready"
              ? "Review the evidence and accept or retry."
              : reviewStatus === "action_required"
                ? "Inspect warnings or failures before retrying."
                : "Review the available evidence before accepting this run."))),
    fileChanges,
    evidenceRefs,
    assumptions,
    reproductionGuidance,
    rollbackGuidance,
    backendAudit,
    reviewDecision,
    createdAt: run.finishedAt ?? run.updatedAt,
    taskSource: run.taskSource ?? null,
    lineage:
      run.lineage ??
      helpers.buildMissionLineage({
        objective: run.title ?? run.summary ?? null,
        taskSource: run.taskSource ?? null,
        executionProfileId: run.executionProfile?.id ?? null,
        taskMode: helpers.deriveTaskMode(run).mode,
        autoDrive: run.autoDrive ?? null,
        reviewDecision,
      }),
    ledger,
    checkpoint: run.checkpoint ?? null,
    missionLinkage: run.missionLinkage ?? null,
    actionability: run.actionability ?? null,
    sessionBoundary,
    continuation,
    nextOperatorAction,
    reviewProfileId: run.reviewProfileId ?? null,
    reviewGate: run.reviewGate ?? null,
    reviewFindings: run.reviewFindings ?? null,
    reviewRunId: run.reviewRunId ?? null,
    skillUsage: run.skillUsage ?? null,
    autofixCandidate: run.autofixCandidate ?? null,
    governance:
      run.governance ??
      helpers.buildGovernanceSummary({
        runState: run.state,
        approval: run.approval ?? {
          status: "not_required",
          approvalId: null,
          label: "No pending approval",
          summary: "This run does not currently require an approval decision.",
        },
        reviewDecision,
        intervention: run.intervention ?? {
          actions: [],
          primaryAction: null,
        },
        nextAction: run.nextAction ?? {
          label: "Inspect run state",
          action: "review",
          detail: run.completionReason ?? null,
        },
        completionReason: run.completionReason ?? null,
        subAgents: run.subAgents ?? undefined,
      }),
    placement: run.placement ?? null,
    workspaceEvidence: run.workspaceEvidence ?? helpers.buildRunWorkspaceEvidence({ run }),
    failureClass: deriveFailureClass({
      runState: run.state,
      approval: run.approval ?? null,
      relaunchContext: run.relaunchContext ?? null,
    }),
    relaunchOptions: buildReviewPackRelaunchOptions(run),
    subAgentSummary: run.subAgents ?? [],
    publishHandoff: buildReviewPackPublishHandoff(run),
  };
}
