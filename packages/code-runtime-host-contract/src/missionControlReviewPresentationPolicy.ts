import type {
  HugeCodeMissionControlActivityTone,
  HugeCodeReviewFindingSeverity,
  HugeCodeReviewPackSummary,
  HugeCodeReviewStatus,
  HugeCodeRunSummary,
  HugeCodeValidationOutcome,
} from "./hugeCodeMissionControl.js";

export type MissionControlReviewContinuationState =
  | "ready"
  | "attention"
  | "degraded"
  | "blocked"
  | "missing"
  | null;

export type MissionControlReviewPresentationInput = {
  reviewPack: HugeCodeReviewPackSummary | null;
  run: HugeCodeRunSummary | null;
  continuationState?: MissionControlReviewContinuationState;
  hasBlockedSubAgents?: boolean;
};

export type MissionControlReviewPresentation = {
  triagePriority: number;
  tone: HugeCodeMissionControlActivityTone;
  reviewStatusLabel: string;
};

function formatReviewStatusLabel(reviewStatus: HugeCodeReviewStatus) {
  if (reviewStatus === "ready") {
    return "Review ready";
  }
  return reviewStatus.replace(/_/g, " ");
}

function resolveValidationOutcome(
  reviewPack: HugeCodeReviewPackSummary | null
): HugeCodeValidationOutcome | null {
  return reviewPack?.validationOutcome ?? null;
}

function resolveWarningCount(
  reviewPack: HugeCodeReviewPackSummary | null,
  run: HugeCodeRunSummary | null
) {
  return reviewPack?.warningCount ?? run?.warnings?.length ?? 0;
}

function resolveHighestReviewSeverity(
  reviewPack: HugeCodeReviewPackSummary | null,
  run: HugeCodeRunSummary | null
): HugeCodeReviewFindingSeverity | null {
  return (
    reviewPack?.reviewGate?.highestSeverity ??
    reviewPack?.reviewFindings?.[0]?.severity ??
    run?.reviewGate?.highestSeverity ??
    run?.reviewFindings?.[0]?.severity ??
    null
  );
}

function resolveReviewGateState(
  reviewPack: HugeCodeReviewPackSummary | null,
  run: HugeCodeRunSummary | null
) {
  return reviewPack?.reviewGate?.state ?? run?.reviewGate?.state ?? null;
}

function resolveReviewStatus(
  reviewPack: HugeCodeReviewPackSummary | null,
  run: HugeCodeRunSummary | null
): HugeCodeReviewStatus | null {
  if (reviewPack) {
    return reviewPack.reviewStatus;
  }
  return run?.state === "review_ready" ? "ready" : null;
}

function resolveContinuationState(
  input: MissionControlReviewPresentationInput
): "blocked" | "degraded" | null {
  if (input.continuationState === "blocked") {
    return "blocked";
  }
  if (input.continuationState === "attention" || input.continuationState === "degraded") {
    return "degraded";
  }
  if (input.hasBlockedSubAgents) {
    return "blocked";
  }
  const takeoverState = input.reviewPack?.takeoverBundle?.state ?? input.run?.takeoverBundle?.state;
  if (
    takeoverState === "blocked" ||
    input.reviewPack?.actionability?.state === "blocked" ||
    input.run?.actionability?.state === "blocked" ||
    input.reviewPack?.continuation?.state === "blocked" ||
    input.run?.continuation?.state === "blocked"
  ) {
    return "blocked";
  }
  if (
    input.reviewPack?.actionability?.state === "degraded" ||
    input.run?.actionability?.state === "degraded" ||
    input.reviewPack?.continuation?.state === "attention" ||
    input.run?.continuation?.state === "attention"
  ) {
    return "degraded";
  }
  return null;
}

function hasFallbackRouting(input: MissionControlReviewPresentationInput) {
  const placement = input.reviewPack?.placement ?? input.run?.placement ?? null;
  return (
    placement?.resolutionSource === "runtime_fallback" || placement?.lifecycleState === "fallback"
  );
}

function hasPlacementBlocked(input: MissionControlReviewPresentationInput) {
  const placement = input.reviewPack?.placement ?? input.run?.placement ?? null;
  return placement?.healthSummary === "placement_blocked";
}

function hasPlacementAttention(input: MissionControlReviewPresentationInput) {
  const placement = input.reviewPack?.placement ?? input.run?.placement ?? null;
  return placement?.healthSummary === "placement_attention";
}

function hasReviewReadyPath(input: MissionControlReviewPresentationInput) {
  return (
    input.reviewPack?.takeoverBundle?.state === "ready" ||
    input.run?.takeoverBundle?.state === "ready"
  );
}

function hasPendingApproval(run: HugeCodeRunSummary | null) {
  return run?.approval?.status === "pending_decision";
}

function hasRunBlocker(run: HugeCodeRunSummary | null) {
  return Boolean(run?.operatorSnapshot?.blocker?.trim());
}

function runNeedsInput(run: HugeCodeRunSummary | null) {
  return Boolean(run && ["needs_input", "failed", "cancelled"].includes(run.state));
}

function warningLabel(warningCount: number) {
  return `Warnings: ${warningCount}`;
}

export function resolveMissionControlReviewPresentation(
  input: MissionControlReviewPresentationInput
): MissionControlReviewPresentation {
  const validationOutcome = resolveValidationOutcome(input.reviewPack);
  const warningCount = resolveWarningCount(input.reviewPack, input.run);
  const reviewGateState = resolveReviewGateState(input.reviewPack, input.run);
  const highestReviewSeverity = resolveHighestReviewSeverity(input.reviewPack, input.run);
  const reviewStatus = resolveReviewStatus(input.reviewPack, input.run);
  const continuationState = resolveContinuationState(input);
  const validationFailed = validationOutcome === "failed";
  const reviewDecisionRejected =
    input.reviewPack?.reviewDecision?.status === "rejected" ||
    input.run?.reviewDecision?.status === "rejected";
  const needsInput =
    hasPendingApproval(input.run) || hasRunBlocker(input.run) || runNeedsInput(input.run);
  const criticalReview =
    reviewDecisionRejected ||
    reviewStatus === "action_required" ||
    reviewGateState === "fail" ||
    reviewGateState === "blocked" ||
    highestReviewSeverity === "critical";
  const autofixAvailable =
    input.reviewPack?.autofixCandidate?.status === "available" ||
    input.run?.autofixCandidate?.status === "available";
  const attentionSignals =
    reviewStatus === "incomplete_evidence" ||
    validationOutcome === "warning" ||
    hasFallbackRouting(input) ||
    hasPlacementAttention(input) ||
    hasPlacementBlocked(input);

  let triagePriority = 0;
  if (validationFailed || criticalReview || needsInput) {
    triagePriority = 4;
  } else if (continuationState === "blocked" || continuationState === "degraded") {
    triagePriority = 3;
  } else if (autofixAvailable) {
    triagePriority = 2;
  } else if (attentionSignals) {
    triagePriority = 1;
  }

  if (validationFailed) {
    return {
      triagePriority,
      tone: "blocked",
      reviewStatusLabel: "Validation failed",
    };
  }
  if (reviewDecisionRejected) {
    return {
      triagePriority,
      tone: "blocked",
      reviewStatusLabel: "Critical review",
    };
  }
  if (reviewStatus === "action_required") {
    return {
      triagePriority,
      tone: "attention",
      reviewStatusLabel: warningCount > 0 ? warningLabel(warningCount) : "Action required",
    };
  }
  if (needsInput) {
    return {
      triagePriority,
      tone: "attention",
      reviewStatusLabel: "Needs input",
    };
  }
  if (criticalReview) {
    return {
      triagePriority,
      tone: "blocked",
      reviewStatusLabel: "Critical review",
    };
  }
  if (continuationState === "blocked") {
    return {
      triagePriority,
      tone: "blocked",
      reviewStatusLabel: "Blocked follow-up",
    };
  }
  if (continuationState === "degraded") {
    return {
      triagePriority,
      tone: "attention",
      reviewStatusLabel: "Follow-up degraded",
    };
  }
  if (autofixAvailable) {
    return {
      triagePriority,
      tone: "attention",
      reviewStatusLabel: "Autofix ready",
    };
  }
  if (reviewStatus === "incomplete_evidence") {
    return {
      triagePriority,
      tone: "attention",
      reviewStatusLabel: "Evidence incomplete",
    };
  }
  if (attentionSignals) {
    return {
      triagePriority,
      tone: "attention",
      reviewStatusLabel: warningCount > 0 ? warningLabel(warningCount) : "Needs attention",
    };
  }
  if (hasReviewReadyPath(input) && reviewStatus !== "ready") {
    return {
      triagePriority,
      tone: "ready",
      reviewStatusLabel: "Review path ready",
    };
  }
  if (reviewStatus === "ready") {
    return {
      triagePriority,
      tone: "ready",
      reviewStatusLabel: "Review ready",
    };
  }
  if (reviewStatus) {
    return {
      triagePriority,
      tone: "neutral",
      reviewStatusLabel: formatReviewStatusLabel(reviewStatus),
    };
  }
  return {
    triagePriority,
    tone: "neutral",
    reviewStatusLabel: "Needs attention",
  };
}
