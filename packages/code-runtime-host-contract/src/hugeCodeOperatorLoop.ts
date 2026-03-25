import type {
  HugeCodeCheckpointSummary,
  HugeCodeMissionLinkageSummary,
  HugeCodePublishHandoffReference,
  HugeCodeReviewActionabilityAction,
  HugeCodeReviewActionabilitySummary,
  HugeCodeReviewStatus,
  HugeCodeRunState,
  HugeCodeTakeoverBundle,
  HugeCodeTakeoverTarget,
} from "./hugeCodeMissionControl";

export type HugeCodeOperatorTruthSource =
  | "takeover_bundle"
  | "review_actionability"
  | "mission_linkage"
  | "publish_handoff"
  | "checkpoint"
  | "missing";

export type HugeCodeOperatorContinuationState = "ready" | "degraded" | "blocked" | "missing";
export type HugeCodeOperatorContinuationPathKind = "resume" | "handoff" | "review" | "missing";
export type HugeCodeOperatorContinuationPathLabel =
  | "Mission thread"
  | "Mission run"
  | "Review Pack";
export type HugeCodeOperatorTargetKind =
  | "thread"
  | "run"
  | "review_pack"
  | "sub_agent_session"
  | "missing";

export type HugeCodeOperatorContinuationSummary = {
  state: HugeCodeOperatorContinuationState;
  pathKind: HugeCodeOperatorContinuationPathKind;
  summary: string;
  details: string[];
  recommendedAction: string;
  blockingReason: string | null;
  continuePathLabel: HugeCodeOperatorContinuationPathLabel;
  truthSource: HugeCodeOperatorTruthSource;
  truthSourceLabel: string;
  target: HugeCodeTakeoverTarget | HugeCodeMissionLinkageSummary["navigationTarget"] | null;
  targetKind: HugeCodeOperatorTargetKind;
};

export type HugeCodeOperatorActionId =
  | "open_approval"
  | "resume_run"
  | "take_over"
  | "open_review"
  | "continue_follow_up"
  | "continue_execution"
  | "inspect";

export type HugeCodeOperatorAction = {
  actionId: HugeCodeOperatorActionId;
  label: string;
  detail: string | null;
  recommendedAction: string;
  blockingReason: string | null;
  target: HugeCodeOperatorContinuationSummary["target"];
  targetKind: HugeCodeOperatorTargetKind;
  truthSource: HugeCodeOperatorTruthSource;
  continuationState: HugeCodeOperatorContinuationState;
  pathKind: HugeCodeOperatorContinuationPathKind;
};

type ReviewActionLike = {
  action: string;
  enabled: boolean;
  supported: boolean;
  reason: string | null;
};

export type HugeCodeReviewActionAvailabilityResolution = {
  action: string;
  enabled: boolean;
  supported: boolean;
  reason: string | null;
  source: "review_actionability" | "legacy_fallback";
} | null;

export type HugeCodeOperatorLoopInput = {
  runState?: HugeCodeRunState | null;
  reviewStatus?: HugeCodeReviewStatus | null;
  approvalStatus?: string | null;
  approvalSummary?: string | null;
  checkpoint?: HugeCodeCheckpointSummary | null;
  takeoverBundle?: HugeCodeTakeoverBundle | null;
  reviewActionability?: HugeCodeReviewActionabilitySummary | null;
  missionLinkage?: HugeCodeMissionLinkageSummary | null;
  publishHandoff?: HugeCodePublishHandoffReference | null;
  fallbackDetail?: string | null;
};

function readOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function pushUnique(target: string[], value: string | null | undefined) {
  const normalized = readOptionalText(value);
  if (!normalized || target.includes(normalized)) {
    return;
  }
  target.push(normalized);
}

function mapActionabilityState(
  state: HugeCodeReviewActionabilitySummary["state"] | null | undefined
): HugeCodeOperatorContinuationState {
  if (state === "ready") {
    return "ready";
  }
  if (state === "degraded") {
    return "degraded";
  }
  if (state === "blocked") {
    return "blocked";
  }
  return "missing";
}

function mapTakeoverState(
  state: HugeCodeTakeoverBundle["state"] | null | undefined
): HugeCodeOperatorContinuationState {
  if (state === "ready") {
    return "ready";
  }
  if (state === "attention") {
    return "degraded";
  }
  if (state === "blocked") {
    return "blocked";
  }
  return "missing";
}

function resolveTargetKind(
  target: HugeCodeTakeoverTarget | HugeCodeMissionLinkageSummary["navigationTarget"] | null
): HugeCodeOperatorTargetKind {
  if (!target) {
    return "missing";
  }
  switch (target.kind) {
    case "thread":
      return "thread";
    case "run":
      return "run";
    case "review_pack":
      return "review_pack";
    case "sub_agent_session":
      return "sub_agent_session";
    default:
      return "missing";
  }
}

function buildReviewPackTarget(input: {
  takeoverBundle: HugeCodeTakeoverBundle;
  missionLinkage: HugeCodeMissionLinkageSummary | null | undefined;
}): HugeCodeTakeoverTarget | null {
  if (input.takeoverBundle.pathKind !== "review" || !input.takeoverBundle.reviewPackId) {
    return null;
  }
  if (!input.missionLinkage) {
    return null;
  }
  return {
    kind: "review_pack",
    workspaceId: input.missionLinkage.workspaceId,
    taskId: input.missionLinkage.taskId,
    runId: input.missionLinkage.runId,
    reviewPackId: input.takeoverBundle.reviewPackId,
    checkpointId: input.takeoverBundle.checkpointId ?? input.missionLinkage.checkpointId ?? null,
    traceId: input.takeoverBundle.traceId ?? input.missionLinkage.traceId ?? null,
  };
}

function buildRecommendedAction(input: {
  state: HugeCodeOperatorContinuationState;
  continuePathLabel: HugeCodeOperatorContinuationPathLabel;
}): string {
  const pathLabel = input.continuePathLabel.toLowerCase();
  switch (input.state) {
    case "blocked":
      return `Open the ${pathLabel} and resolve the runtime-blocked follow-up.`;
    case "degraded":
      return `Open the ${pathLabel} and inspect the degraded runtime follow-up guidance.`;
    case "ready":
      return `Continue from the ${pathLabel} using the runtime-published follow-up actions.`;
    default:
      return `Inspect the ${pathLabel} before continuing this follow-up.`;
  }
}

function buildFallbackSummary(
  input: HugeCodeOperatorLoopInput
): HugeCodeOperatorContinuationSummary {
  const target = resolveHugeCodeOperatorTarget(input);
  const targetKind = resolveTargetKind(target);
  if (input.checkpoint?.resumeReady) {
    const summary =
      readOptionalText(input.checkpoint.summary) ??
      "Runtime published a canonical checkpoint path and this run is ready to resume.";
    return {
      state: "ready",
      pathKind: "resume",
      summary,
      details: [
        summary,
        "Canonical continue path: Mission run.",
        "Follow-up source: Runtime checkpoint.",
      ],
      recommendedAction: "Resume this run from its runtime-published checkpoint.",
      blockingReason: null,
      continuePathLabel: "Mission run",
      truthSource: "checkpoint",
      truthSourceLabel: formatHugeCodeOperatorTruthSourceLabel("checkpoint"),
      target,
      targetKind,
    };
  }

  if (input.missionLinkage || input.publishHandoff) {
    const continuePathLabel = resolveHugeCodeOperatorContinuePathLabel(input);
    const truthSource = resolveHugeCodeOperatorTruthSource(input);
    const summary =
      readOptionalText(input.publishHandoff?.summary) ??
      readOptionalText(input.missionLinkage?.summary) ??
      "Runtime published a canonical handoff path for this run.";
    return {
      state: "ready",
      pathKind: "handoff",
      summary,
      details: [
        summary,
        `Canonical continue path: ${continuePathLabel}.`,
        `Follow-up source: ${formatHugeCodeOperatorTruthSourceLabel(truthSource)}.`,
      ],
      recommendedAction:
        "Use the runtime-published handoff or navigation target instead of rebuilding recovery locally.",
      blockingReason: null,
      continuePathLabel,
      truthSource,
      truthSourceLabel: formatHugeCodeOperatorTruthSourceLabel(truthSource),
      target,
      targetKind,
    };
  }

  const recoverableWithoutPath =
    input.checkpoint?.recovered === true ||
    input.runState === "paused" ||
    input.runState === "needs_input" ||
    input.runState === "failed" ||
    input.runState === "cancelled";
  if (recoverableWithoutPath) {
    const summary =
      readOptionalText(input.checkpoint?.summary) ??
      "This run looks recoverable, but runtime did not publish a canonical continue path.";
    return {
      state: "blocked",
      pathKind: "missing",
      summary,
      details: [summary, "Runtime did not publish a canonical continue path."],
      recommendedAction:
        "Inspect runtime continuity truth and restore a canonical resume or handoff path before continuing.",
      blockingReason: summary,
      continuePathLabel: "Mission run",
      truthSource: input.checkpoint ? "checkpoint" : "missing",
      truthSourceLabel: formatHugeCodeOperatorTruthSourceLabel(
        input.checkpoint ? "checkpoint" : "missing"
      ),
      target,
      targetKind,
    };
  }

  if (input.runState === "review_ready" || input.reviewStatus) {
    return {
      state: "missing",
      pathKind: "missing",
      summary: "Runtime marked this run review-ready, but continuation truth was not published.",
      details: ["Runtime marked this run review-ready, but continuation truth was not published."],
      recommendedAction:
        "Inspect runtime review truth before continuing from this review-ready run.",
      blockingReason: null,
      continuePathLabel: "Review Pack",
      truthSource: "missing",
      truthSourceLabel: formatHugeCodeOperatorTruthSourceLabel("missing"),
      target,
      targetKind,
    };
  }

  return {
    state: "missing",
    pathKind: "missing",
    summary: "Runtime continuation guidance is unavailable.",
    details: ["Runtime continuation guidance is unavailable."],
    recommendedAction: "Inspect runtime mission truth before continuing.",
    blockingReason: null,
    continuePathLabel: "Mission run",
    truthSource: "missing",
    truthSourceLabel: formatHugeCodeOperatorTruthSourceLabel("missing"),
    target,
    targetKind,
  };
}

function labelForTarget(targetKind: HugeCodeOperatorTargetKind): string {
  if (targetKind === "review_pack") {
    return "Open review";
  }
  if (targetKind === "thread") {
    return "Open mission";
  }
  return "Open action center";
}

export function resolvePreferredHugeCodeReviewActionability(input: {
  takeoverBundle?: HugeCodeTakeoverBundle | null;
  reviewActionability?: HugeCodeReviewActionabilitySummary | null;
}) {
  if (input.takeoverBundle) {
    return input.takeoverBundle.reviewActionability ?? null;
  }
  return input.reviewActionability ?? null;
}

export function resolvePreferredHugeCodePublishHandoff(input: {
  takeoverBundle?: HugeCodeTakeoverBundle | null;
  publishHandoff?: HugeCodePublishHandoffReference | null;
}) {
  if (input.takeoverBundle) {
    return input.takeoverBundle.publishHandoff ?? null;
  }
  return input.publishHandoff ?? null;
}

export function formatHugeCodeOperatorTruthSourceLabel(
  source: HugeCodeOperatorTruthSource
): string {
  switch (source) {
    case "takeover_bundle":
      return "Runtime takeover bundle";
    case "review_actionability":
      return "Runtime review actionability";
    case "mission_linkage":
      return "Runtime mission linkage";
    case "publish_handoff":
      return "Runtime publish handoff";
    case "checkpoint":
      return "Runtime checkpoint";
    default:
      return "Runtime truth unavailable";
  }
}

export function resolveHugeCodeOperatorTruthSource(
  input: Pick<
    HugeCodeOperatorLoopInput,
    "takeoverBundle" | "reviewActionability" | "missionLinkage" | "publishHandoff" | "checkpoint"
  >
): HugeCodeOperatorTruthSource {
  if (input.takeoverBundle) {
    return "takeover_bundle";
  }
  if (input.reviewActionability) {
    return "review_actionability";
  }
  if (input.missionLinkage) {
    return "mission_linkage";
  }
  if (input.publishHandoff) {
    return "publish_handoff";
  }
  if (input.checkpoint) {
    return "checkpoint";
  }
  return "missing";
}

export function resolveHugeCodeOperatorTarget(
  input: Pick<HugeCodeOperatorLoopInput, "takeoverBundle" | "missionLinkage">
) {
  if (input.takeoverBundle?.target) {
    return input.takeoverBundle.target;
  }
  const derivedReviewPackTarget = input.takeoverBundle
    ? buildReviewPackTarget({
        takeoverBundle: input.takeoverBundle,
        missionLinkage: input.missionLinkage,
      })
    : null;
  if (derivedReviewPackTarget) {
    return derivedReviewPackTarget;
  }
  return input.missionLinkage?.navigationTarget ?? null;
}

export function resolveHugeCodeOperatorContinuePathLabel(
  input: Pick<HugeCodeOperatorLoopInput, "takeoverBundle" | "missionLinkage">
): HugeCodeOperatorContinuationPathLabel {
  const target = resolveHugeCodeOperatorTarget(input);
  switch (target?.kind) {
    case "thread":
      return "Mission thread";
    case "review_pack":
      return "Review Pack";
    case "run":
    case "sub_agent_session":
      return "Mission run";
    default:
      return input.takeoverBundle?.pathKind === "review" ? "Review Pack" : "Mission run";
  }
}

export function summarizeHugeCodeOperatorContinuation(
  input: HugeCodeOperatorLoopInput
): HugeCodeOperatorContinuationSummary {
  const reviewActionability = resolvePreferredHugeCodeReviewActionability({
    takeoverBundle: input.takeoverBundle ?? null,
    reviewActionability: input.reviewActionability ?? null,
  });
  const publishHandoff = resolvePreferredHugeCodePublishHandoff({
    takeoverBundle: input.takeoverBundle ?? null,
    publishHandoff: input.publishHandoff ?? null,
  });
  const truthSource = resolveHugeCodeOperatorTruthSource({
    takeoverBundle: input.takeoverBundle ?? null,
    reviewActionability: input.reviewActionability ?? null,
    missionLinkage: input.missionLinkage ?? null,
    publishHandoff: input.publishHandoff ?? null,
    checkpoint: input.checkpoint ?? null,
  });
  const truthSourceLabel = formatHugeCodeOperatorTruthSourceLabel(truthSource);
  const continuePathLabel = resolveHugeCodeOperatorContinuePathLabel({
    takeoverBundle: input.takeoverBundle ?? null,
    missionLinkage: input.missionLinkage ?? null,
  });
  const target = resolveHugeCodeOperatorTarget({
    takeoverBundle: input.takeoverBundle ?? null,
    missionLinkage: input.missionLinkage ?? null,
  });
  const targetKind = resolveTargetKind(target);

  if (!input.takeoverBundle && !reviewActionability) {
    return buildFallbackSummary(input);
  }

  const details: string[] = [];
  pushUnique(details, input.takeoverBundle?.summary);
  pushUnique(details, input.missionLinkage?.summary);
  pushUnique(details, `Canonical continue path: ${continuePathLabel}.`);
  pushUnique(details, `Follow-up source: ${truthSourceLabel}.`);
  pushUnique(details, publishHandoff?.summary);
  for (const degradedReason of reviewActionability?.degradedReasons ?? []) {
    pushUnique(details, degradedReason);
  }

  const state =
    reviewActionability !== null
      ? mapActionabilityState(reviewActionability.state)
      : mapTakeoverState(input.takeoverBundle?.state);
  const summary =
    readOptionalText(reviewActionability?.summary) ??
    readOptionalText(input.takeoverBundle?.summary) ??
    readOptionalText(input.missionLinkage?.summary) ??
    readOptionalText(publishHandoff?.summary) ??
    "Runtime continuation guidance is unavailable.";
  const recommendedAction =
    readOptionalText(input.takeoverBundle?.recommendedAction) ??
    buildRecommendedAction({
      state,
      continuePathLabel,
    });
  const pathKind =
    input.takeoverBundle?.pathKind === "resume"
      ? "resume"
      : input.takeoverBundle?.pathKind === "handoff"
        ? "handoff"
        : input.takeoverBundle?.pathKind === "review" || reviewActionability
          ? "review"
          : "missing";

  return {
    state,
    pathKind,
    summary,
    details,
    recommendedAction,
    blockingReason:
      state === "blocked"
        ? (readOptionalText(input.takeoverBundle?.blockingReason) ?? summary)
        : null,
    continuePathLabel,
    truthSource,
    truthSourceLabel,
    target,
    targetKind,
  };
}

export function resolveHugeCodeOperatorAction(
  input: HugeCodeOperatorLoopInput
): HugeCodeOperatorAction {
  const continuation = summarizeHugeCodeOperatorContinuation(input);
  const inspectLabel = labelForTarget(continuation.targetKind);
  if (input.approvalStatus === "pending_decision") {
    return {
      actionId: "open_approval",
      label: "Open approval",
      detail:
        readOptionalText(input.approvalSummary) ??
        readOptionalText(input.fallbackDetail) ??
        continuation.summary,
      recommendedAction:
        readOptionalText(input.approvalSummary) ??
        "Open the action center and record an approval decision before continuing.",
      blockingReason: continuation.blockingReason,
      target: continuation.target,
      targetKind: continuation.targetKind,
      truthSource: continuation.truthSource,
      continuationState: continuation.state,
      pathKind: continuation.pathKind,
    };
  }

  if (continuation.pathKind === "resume" && continuation.state === "ready") {
    return {
      actionId: "resume_run",
      label: "Resume run",
      detail: continuation.summary,
      recommendedAction: continuation.recommendedAction,
      blockingReason: continuation.blockingReason,
      target: continuation.target,
      targetKind: continuation.targetKind,
      truthSource: continuation.truthSource,
      continuationState: continuation.state,
      pathKind: continuation.pathKind,
    };
  }

  if (continuation.pathKind === "handoff" && continuation.state === "ready") {
    return {
      actionId: "take_over",
      label: continuation.targetKind === "sub_agent_session" ? "Take over session" : "Take over",
      detail: continuation.summary,
      recommendedAction: continuation.recommendedAction,
      blockingReason: continuation.blockingReason,
      target: continuation.target,
      targetKind: continuation.targetKind,
      truthSource: continuation.truthSource,
      continuationState: continuation.state,
      pathKind: continuation.pathKind,
    };
  }

  if (continuation.pathKind === "review") {
    return {
      actionId:
        continuation.state === "ready" && continuation.targetKind === "review_pack"
          ? "open_review"
          : "continue_follow_up",
      label:
        continuation.state === "ready" && continuation.targetKind === "review_pack"
          ? "Open review"
          : inspectLabel,
      detail: continuation.summary,
      recommendedAction: continuation.recommendedAction,
      blockingReason: continuation.blockingReason,
      target: continuation.target,
      targetKind: continuation.targetKind,
      truthSource: continuation.truthSource,
      continuationState: continuation.state,
      pathKind: continuation.pathKind,
    };
  }

  if (input.reviewStatus || input.runState === "review_ready") {
    return {
      actionId: "open_review",
      label: "Open review",
      detail:
        readOptionalText(input.fallbackDetail) ??
        (continuation.summary !== "Runtime continuation guidance is unavailable."
          ? continuation.summary
          : "Review Pack is ready for operator review."),
      recommendedAction:
        readOptionalText(input.fallbackDetail) ??
        "Open the review surface and inspect runtime evidence before deciding.",
      blockingReason: continuation.blockingReason,
      target: continuation.target,
      targetKind: continuation.targetKind,
      truthSource: continuation.truthSource,
      continuationState: continuation.state,
      pathKind: continuation.pathKind,
    };
  }

  if (
    input.runState === "running" ||
    input.runState === "queued" ||
    input.runState === "preparing" ||
    input.runState === "validating"
  ) {
    return {
      actionId: "continue_execution",
      label: inspectLabel,
      detail: readOptionalText(input.fallbackDetail),
      recommendedAction:
        readOptionalText(input.fallbackDetail) ??
        "Open the action center to inspect execution progress and operator controls.",
      blockingReason: continuation.blockingReason,
      target: continuation.target,
      targetKind: continuation.targetKind,
      truthSource: continuation.truthSource,
      continuationState: continuation.state,
      pathKind: continuation.pathKind,
    };
  }

  if (
    input.runState === "needs_input" ||
    input.runState === "failed" ||
    input.runState === "cancelled" ||
    continuation.state === "blocked"
  ) {
    return {
      actionId: "continue_follow_up",
      label: inspectLabel,
      detail:
        continuation.summary !== "Runtime continuation guidance is unavailable."
          ? continuation.summary
          : readOptionalText(input.fallbackDetail),
      recommendedAction:
        continuation.summary !== "Runtime continuation guidance is unavailable."
          ? continuation.recommendedAction
          : (readOptionalText(input.fallbackDetail) ??
            "Open the action center and inspect the blocked operator path."),
      blockingReason: continuation.blockingReason,
      target: continuation.target,
      targetKind: continuation.targetKind,
      truthSource: continuation.truthSource,
      continuationState: continuation.state,
      pathKind: continuation.pathKind,
    };
  }

  return {
    actionId: "inspect",
    label: inspectLabel,
    detail: readOptionalText(input.fallbackDetail),
    recommendedAction:
      readOptionalText(input.fallbackDetail) ??
      "Open the runtime-backed surface and inspect the latest operator state.",
    blockingReason: continuation.blockingReason,
    target: continuation.target,
    targetKind: continuation.targetKind,
    truthSource: continuation.truthSource,
    continuationState: continuation.state,
    pathKind: continuation.pathKind,
  };
}

export function getHugeCodeReviewActionAvailability(input: {
  reviewActionability?: HugeCodeReviewActionabilitySummary | null;
  legacyFallbackActions?: ReviewActionLike[] | null;
  actionIds: Array<HugeCodeReviewActionabilityAction | string>;
}): HugeCodeReviewActionAvailabilityResolution {
  const reviewActionabilityMatch =
    input.reviewActionability?.actions.find(
      (action) => input.actionIds.includes(action.action) && action.supported && action.enabled
    ) ??
    input.reviewActionability?.actions.find(
      (action) => input.actionIds.includes(action.action) && action.supported
    ) ??
    null;
  if (reviewActionabilityMatch) {
    return {
      ...reviewActionabilityMatch,
      source: "review_actionability",
    };
  }

  if ((input.reviewActionability?.actions.length ?? 0) > 0 || !input.legacyFallbackActions) {
    return null;
  }

  const legacyMatch =
    input.legacyFallbackActions.find(
      (action) => input.actionIds.includes(action.action) && action.supported && action.enabled
    ) ??
    input.legacyFallbackActions.find(
      (action) => input.actionIds.includes(action.action) && action.supported
    ) ??
    null;
  if (!legacyMatch) {
    return null;
  }
  return {
    ...legacyMatch,
    source: "legacy_fallback",
  };
}
