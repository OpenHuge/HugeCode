import type {
  HugeCodeReviewPackSummary,
  RuntimeContinuationDescriptor,
  HugeCodeRunSummary,
} from "@ku0/code-runtime-host-contract";
import {
  buildRunPublishHandoff,
  projectCompletedRunToReviewPackSummary as projectCompletedRunToReviewPackSummaryWithHelpers,
} from "@ku0/code-application/runtimeMissionControlReviewPackProjection";
import { buildGovernanceSummary } from "./runtimeMissionControlRunState";
import { buildRuntimeContinuationDescriptor } from "./runtimeContinuationTruth";
import {
  buildReviewPackAssumptions,
  buildReviewPackBackendAudit,
  buildReviewPackEvidenceRefs,
  buildReviewPackFileChanges,
  buildReviewPackReproductionGuidance,
  buildReviewPackRollbackGuidance,
  deriveValidationOutcome,
} from "./runtimeMissionControlReviewPack";
import { buildRunWorkspaceEvidence } from "./runtimeMissionControlRuntimeTruth";
import {
  buildMissionLineage,
  deriveTaskMode,
  isTerminalRunState,
} from "./runtimeMissionControlProjectionHelpers";

export { buildRunPublishHandoff };

function mapRuntimeContinuationDescriptor(descriptor: RuntimeContinuationDescriptor | null): {
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
} {
  if (!descriptor) {
    return {
      state: "missing",
      summary: "Runtime continuation guidance is unavailable.",
      detail: null,
      recommendedAction: null,
      continuePathLabel: null,
      truthSourceLabel: null,
      continuityOverview: null,
      checkpointDurabilityState: "unknown",
      hasHandoffPath: false,
      canSafelyContinue: false,
      reviewFollowUpActionable: false,
    };
  }
  const canSafelyContinue = descriptor.state === "ready" && descriptor.pathKind !== "missing";
  const hasHandoffPath = descriptor.pathKind === "handoff";
  const reviewFollowUpActionable = descriptor.pathKind === "review" && descriptor.state === "ready";
  const checkpointDurabilityState =
    descriptor.truthSource === "checkpoint"
      ? descriptor.state === "ready"
        ? "ready"
        : descriptor.state === "attention"
          ? "attention"
          : descriptor.state === "blocked"
            ? "blocked"
            : "unknown"
      : "unknown";
  const continuityOverview =
    descriptor.state === "missing"
      ? null
      : [
          descriptor.summary,
          canSafelyContinue ? "Continuation path is ready." : "Continuation path needs attention.",
          hasHandoffPath ? "Handoff path available." : "No handoff path recorded.",
          reviewFollowUpActionable
            ? "Review follow-up is actionable."
            : "Review follow-up is not yet actionable.",
        ].join(" ");

  return {
    state: descriptor.state,
    summary: descriptor.summary,
    detail: descriptor.details[0] ?? descriptor.blockingReason,
    recommendedAction: descriptor.recommendedAction,
    continuePathLabel: descriptor.continuePathLabel,
    truthSourceLabel: descriptor.truthSourceLabel,
    continuityOverview,
    checkpointDurabilityState,
    hasHandoffPath,
    canSafelyContinue,
    reviewFollowUpActionable,
  };
}

export function projectCompletedRunToReviewPackSummary(
  run: HugeCodeRunSummary
): HugeCodeReviewPackSummary | null {
  return projectCompletedRunToReviewPackSummaryWithHelpers(run, {
    deriveTaskMode,
    deriveValidationOutcome: (validations) => deriveValidationOutcome(validations ?? []),
    buildMissionLineage,
    buildRunWorkspaceEvidence,
    buildGovernanceSummary: (input) =>
      buildGovernanceSummary({
        ...input,
        approval: input.approval ?? {
          status: "not_required",
          approvalId: null,
          label: "No pending approval",
          summary: "This run does not currently require an approval decision.",
        },
        reviewDecision: input.reviewDecision ?? null,
        intervention: input.intervention ?? {
          actions: [],
          primaryAction: null,
        },
        nextAction: input.nextAction ?? {
          label: "Inspect run state",
          action: "review",
          detail: input.completionReason ?? null,
        },
        subAgents: input.subAgents ?? [],
      }),
    buildRuntimeContinuationDescriptor: (input) =>
      mapRuntimeContinuationDescriptor(
        buildRuntimeContinuationDescriptor({
          runState: input.runState,
          checkpoint: input.checkpoint ?? null,
          continuation: input.continuation ?? null,
          missionLinkage: input.missionLinkage ?? null,
          actionability: input.actionability ?? null,
          publishHandoff: input.publishHandoff ?? null,
          takeoverBundle: input.takeoverBundle ?? null,
          nextAction: input.nextAction ?? null,
          reviewPackId: input.reviewPackId,
        })
      ),
    buildReviewPackAssumptions,
    buildReviewPackBackendAudit,
    buildReviewPackEvidenceRefs,
    buildReviewPackFileChanges: (changedPaths) => buildReviewPackFileChanges(changedPaths ?? []),
    buildReviewPackReproductionGuidance: (validations, checksPerformed, artifacts) =>
      buildReviewPackReproductionGuidance(validations ?? [], checksPerformed, artifacts ?? []),
    buildReviewPackRollbackGuidance: (currentRun, artifacts) =>
      buildReviewPackRollbackGuidance(currentRun, artifacts ?? []),
    isTerminalRunState,
  });
}
