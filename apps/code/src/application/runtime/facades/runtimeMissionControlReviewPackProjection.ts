import type {
  AgentTaskSummary,
  HugeCodeMissionLineage,
  HugeCodeReviewPackSummary,
  HugeCodeReviewStatus,
  HugeCodeRunLedger,
  HugeCodeRunState,
  HugeCodeRunSummary,
  HugeCodeTaskMode,
  HugeCodeValidationOutcome,
} from "@ku0/code-runtime-host-contract";
import {
  resolveRuntimeContinuation,
  resolveRuntimeNextOperatorAction,
  resolveRuntimeSessionBoundary,
} from "@ku0/code-runtime-host-contract";
import { buildGovernanceSummary } from "./runtimeMissionControlRunState";
import {
  buildReviewPackAssumptions,
  buildReviewPackBackendAudit,
  buildReviewPackEvidenceRefs,
  buildReviewPackFileChanges,
  buildReviewPackReproductionGuidance,
  buildReviewPackRollbackGuidance,
  deriveValidationOutcome,
} from "./runtimeMissionControlReviewPack";

type ReviewPackProjectionHelpers = {
  deriveTaskMode(run: Pick<HugeCodeRunSummary, "executionProfile">): {
    mode: HugeCodeTaskMode | null;
  };
  buildMissionLineage(input: {
    objective: string | null;
    taskSource?: HugeCodeRunSummary["taskSource"] | null;
    executionProfileId?: string | null;
    taskMode?: HugeCodeTaskMode | null;
    autoDrive?: HugeCodeRunSummary["autoDrive"] | null;
    reviewDecision?: HugeCodeRunSummary["reviewDecision"] | null;
  }): HugeCodeMissionLineage;
  buildRunWorkspaceEvidence(input: {
    run: HugeCodeRunSummary;
  }): HugeCodeRunSummary["workspaceEvidence"];
  isTerminalRunState(state: HugeCodeRunState): boolean;
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
  helpers: ReviewPackProjectionHelpers
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
  const validationOutcome = deriveValidationOutcome(validations);
  const reviewStatus = buildReviewStatus(run, validationOutcome, evidenceState);
  const hasCanonicalContinuationTruth = Boolean(
    run.checkpoint ??
    run.missionLinkage ??
    run.actionability ??
    run.publishHandoff ??
    run.takeoverBundle
  );
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
  const sessionBoundary =
    run.sessionBoundary ??
    resolveRuntimeSessionBoundary({
      workspaceId: run.workspaceId,
      taskId: run.taskId,
      runId: run.id,
      reviewPackId: run.reviewPackId ?? null,
      checkpoint: run.checkpoint ?? null,
      missionLinkage: run.missionLinkage ?? null,
      sessionBoundary: null,
    });
  const continuation =
    run.continuation ??
    resolveRuntimeContinuation({
      workspaceId: run.workspaceId,
      taskId: run.taskId,
      runId: run.id,
      reviewPackId: run.reviewPackId ?? null,
      state: run.state,
      checkpoint: run.checkpoint ?? null,
      missionLinkage: run.missionLinkage ?? null,
      actionability: run.actionability ?? null,
      publishHandoff: run.publishHandoff ?? null,
      takeoverBundle: run.takeoverBundle ?? null,
      sessionBoundary,
    });
  const nextOperatorAction =
    run.nextOperatorAction ??
    resolveRuntimeNextOperatorAction({
      workspaceId: run.workspaceId,
      taskId: run.taskId,
      runId: run.id,
      reviewPackId: run.reviewPackId ?? null,
      state: run.state,
      reviewStatus,
      approval: run.approval ?? null,
      reviewDecision,
      nextAction: run.nextAction ?? null,
      checkpoint: run.checkpoint ?? null,
      missionLinkage: run.missionLinkage ?? null,
      actionability: run.actionability ?? null,
      publishHandoff: run.publishHandoff ?? null,
      takeoverBundle: run.takeoverBundle ?? null,
      sessionBoundary,
      continuation,
    });
  const checksPerformed = validations.map((validation) => validation.label);
  const fileChanges = buildReviewPackFileChanges(changedPaths);
  const assumptions = buildReviewPackAssumptions(run, reviewStatus);
  const reproductionGuidance = buildReviewPackReproductionGuidance(
    validations,
    checksPerformed,
    artifacts
  );
  const rollbackGuidance = buildReviewPackRollbackGuidance(run, artifacts);
  const backendAudit = buildReviewPackBackendAudit(run);
  const evidenceRefs = buildReviewPackEvidenceRefs({
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
    id: run.reviewPackId ?? `review-pack:${run.id}`,
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
      continuation?.recommendedAction ??
      (reviewDecision?.status === "accepted"
        ? "Accepted in review. No further action is required unless follow-up work is needed."
        : reviewDecision?.status === "rejected"
          ? "Rejected in review. Open the mission thread to retry or reroute with operator feedback."
          : ((hasCanonicalContinuationTruth ? continuation?.recommendedAction : null) ??
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
      buildGovernanceSummary({
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
        subAgents: run.subAgents ?? null,
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
