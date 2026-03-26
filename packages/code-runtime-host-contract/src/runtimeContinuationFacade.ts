import type {
  HugeCodeCheckpointSummary,
  HugeCodeMissionLinkageSummary,
  HugeCodeMissionNavigationTarget,
  HugeCodePublishHandoffReference,
  HugeCodeReviewActionabilitySummary,
  HugeCodeRunNextAction,
  HugeCodeRunState,
  HugeCodeTakeoverBundle,
  HugeCodeTakeoverPathKind,
  HugeCodeTakeoverPrimaryAction,
  HugeCodeTakeoverTarget,
} from "./hugeCodeMissionControl.js";

export type RuntimeContinuationPathLabel =
  | "Mission thread"
  | "Mission run"
  | "Review Pack"
  | "Sub-agent session";
export type RuntimeContinuationState = "ready" | "attention" | "blocked" | "missing";
export type RuntimeContinuationPathKind = Extract<
  HugeCodeTakeoverPathKind,
  "approval" | "resume" | "review" | "handoff" | "missing"
>;
export type RuntimeContinuationTruthSource =
  | "takeover_bundle"
  | "review_actionability"
  | "mission_linkage"
  | "publish_handoff"
  | "checkpoint"
  | "next_action"
  | "missing";
export type RuntimeCanonicalNextActionKind =
  | "continue"
  | "resume"
  | "review"
  | "takeover"
  | "follow_up"
  | "blocked";

export type RuntimeCanonicalNavigationTarget =
  | HugeCodeMissionNavigationTarget
  | HugeCodeTakeoverTarget
  | null;

export type RuntimeCanonicalNextAction = {
  kind: RuntimeCanonicalNextActionKind;
  label: string;
  detail: string;
  blockedReason: string | null;
  navigationTarget: RuntimeCanonicalNavigationTarget;
};

export type RuntimeContinuationDescriptor = {
  state: RuntimeContinuationState;
  pathKind: RuntimeContinuationPathKind;
  continuePathLabel: RuntimeContinuationPathLabel;
  summary: string;
  details: string[];
  blockingReason: string | null;
  recommendedAction: string;
  truthSource: RuntimeContinuationTruthSource;
  truthSourceLabel: string;
  navigationTarget: RuntimeCanonicalNavigationTarget;
  canonicalNextAction: RuntimeCanonicalNextAction;
};

export type RuntimeContinuationAggregateCandidate = {
  runId: string;
  taskId: string;
  runState?: HugeCodeRunState | null;
  checkpoint?: HugeCodeCheckpointSummary | null;
  missionLinkage?: HugeCodeMissionLinkageSummary | null;
  actionability?: HugeCodeReviewActionabilitySummary | null;
  publishHandoff?: HugeCodePublishHandoffReference | null;
  takeoverBundle?: HugeCodeTakeoverBundle | null;
  nextAction?: HugeCodeRunNextAction | null;
  reviewPackId?: string | null;
};

export type RuntimeContinuationAggregateItem = RuntimeContinuationDescriptor & {
  runId: string;
  taskId: string;
};

export type RuntimeContinuationAggregate = {
  state: "ready" | "attention" | "blocked";
  blockingReason: string | null;
  recommendedAction: string;
  recoverableRunCount: number;
  handoffReadyCount: number;
  reviewReadyCount: number;
  reviewBlockedCount: number;
  missingPathCount: number;
  attentionCount: number;
  blockedCount: number;
  items: RuntimeContinuationAggregateItem[];
};

type RuntimeContinuationDescriptorInput = Omit<
  RuntimeContinuationAggregateCandidate,
  "runId" | "taskId"
>;

function mapActionabilityState(
  state: HugeCodeReviewActionabilitySummary["state"] | null | undefined
): RuntimeContinuationState {
  if (state === "ready") {
    return "ready";
  }
  if (state === "degraded") {
    return "attention";
  }
  if (state === "blocked") {
    return "blocked";
  }
  return "missing";
}

function mapTakeoverState(
  state: HugeCodeTakeoverBundle["state"] | null | undefined
): RuntimeContinuationState {
  if (state === "ready") {
    return "ready";
  }
  if (state === "attention") {
    return "attention";
  }
  if (state === "blocked") {
    return "blocked";
  }
  return "missing";
}

function maxState(
  left: Exclude<RuntimeContinuationAggregate["state"], "missing">,
  right: Exclude<RuntimeContinuationAggregate["state"], "missing">
): RuntimeContinuationAggregate["state"] {
  if (left === "blocked" || right === "blocked") {
    return "blocked";
  }
  if (left === "attention" || right === "attention") {
    return "attention";
  }
  return "ready";
}

function sortState(state: RuntimeContinuationState): number {
  return state === "blocked" ? 4 : state === "attention" ? 3 : state === "ready" ? 2 : 1;
}

function hasNavigationTarget(linkage: HugeCodeMissionLinkageSummary | null | undefined): boolean {
  return Boolean(linkage?.navigationTarget);
}

function hasRecoveryPath(linkage: HugeCodeMissionLinkageSummary | null | undefined): boolean {
  return Boolean(linkage?.recoveryPath) && hasNavigationTarget(linkage);
}

function mapNextActionKind(
  action: HugeCodeRunNextAction["action"] | HugeCodeTakeoverPrimaryAction
): RuntimeCanonicalNextActionKind {
  switch (action) {
    case "resume":
      return "resume";
    case "review":
    case "open_review_pack":
      return "review";
    case "approve":
    case "open_handoff":
    case "open_sub_agent_session":
      return "takeover";
    case "inspect_runtime":
      return "blocked";
    default:
      return "follow_up";
  }
}

function buildContinueLabel(pathLabel: RuntimeContinuationPathLabel): string {
  switch (pathLabel) {
    case "Mission thread":
      return "Continue in mission thread";
    case "Mission run":
      return "Continue in mission run";
    case "Review Pack":
      return "Open Review Pack";
    case "Sub-agent session":
      return "Take over sub-agent session";
    default: {
      const exhaustiveCheck: never = pathLabel;
      return exhaustiveCheck;
    }
  }
}

function buildDefaultRecommendedAction(input: {
  state: RuntimeContinuationState;
  pathKind: RuntimeContinuationPathKind;
  continuePathLabel: RuntimeContinuationPathLabel;
}): string {
  const pathLabel = input.continuePathLabel.toLowerCase();
  if (input.pathKind === "resume") {
    if (input.state === "blocked") {
      return "Restore the runtime-published resume path before continuing.";
    }
    return "Resume this run from its runtime-published checkpoint.";
  }
  if (input.pathKind === "review") {
    const reviewPathActionLabel =
      input.continuePathLabel === "Review Pack" ? "Review Pack" : `the ${pathLabel}`;
    switch (input.state) {
      case "blocked":
        return `Open ${reviewPathActionLabel} and resolve the runtime-blocked follow-up before continuing.`;
      case "attention":
        return `Open ${reviewPathActionLabel} and inspect the degraded runtime follow-up guidance before continuing.`;
      case "ready":
        return input.continuePathLabel === "Review Pack"
          ? "Continue from the Review Pack using the runtime-published follow-up actions."
          : `Continue from the ${pathLabel} using the runtime-published follow-up actions.`;
      default:
        return input.continuePathLabel === "Review Pack"
          ? "Inspect Review Pack before continuing this follow-up."
          : `Inspect the ${pathLabel} before continuing this follow-up.`;
    }
  }
  if (input.pathKind === "handoff") {
    if (input.state === "blocked") {
      return "Restore a canonical runtime continue path before handing this run off.";
    }
    return "Use the runtime-published handoff or navigation target instead of rebuilding recovery locally.";
  }
  if (input.pathKind === "approval") {
    return "Take over this run from the runtime-published approval path.";
  }
  return "Inspect runtime continuity truth before continuing this run.";
}

function resolveNavigationTarget(input: {
  takeoverBundle?: HugeCodeTakeoverBundle | null;
  missionLinkage?: HugeCodeMissionLinkageSummary | null;
}): RuntimeCanonicalNavigationTarget {
  if (input.takeoverBundle?.target) {
    return input.takeoverBundle.target;
  }
  return input.missionLinkage?.navigationTarget ?? null;
}

export function resolvePreferredReviewActionability({
  takeoverBundle,
  actionability,
}: Pick<RuntimeContinuationDescriptorInput, "takeoverBundle" | "actionability">) {
  return takeoverBundle?.reviewActionability ?? actionability ?? null;
}

export function resolvePreferredPublishHandoff({
  takeoverBundle,
  publishHandoff,
}: Pick<RuntimeContinuationDescriptorInput, "takeoverBundle" | "publishHandoff">) {
  return takeoverBundle?.publishHandoff ?? publishHandoff ?? null;
}

export function formatRuntimeContinuationTruthSourceLabel(
  source: RuntimeContinuationTruthSource
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
    case "next_action":
      return "Runtime next action";
    default:
      return "Runtime truth unavailable";
  }
}

export function resolveContinuationTruthSource({
  takeoverBundle,
  actionability,
  missionLinkage,
  publishHandoff,
  checkpoint,
  nextAction,
}: RuntimeContinuationDescriptorInput): RuntimeContinuationTruthSource {
  if (takeoverBundle) {
    return "takeover_bundle";
  }
  if (actionability) {
    return "review_actionability";
  }
  if (missionLinkage) {
    return "mission_linkage";
  }
  if (publishHandoff) {
    return "publish_handoff";
  }
  if (checkpoint) {
    return "checkpoint";
  }
  if (nextAction) {
    return "next_action";
  }
  return "missing";
}

export function resolveContinuationPathLabel({
  takeoverBundle,
  missionLinkage,
  reviewPackId,
}: Pick<
  RuntimeContinuationDescriptorInput,
  "takeoverBundle" | "missionLinkage" | "reviewPackId"
>): RuntimeContinuationPathLabel {
  const takeoverTargetKind = takeoverBundle?.target?.kind;
  if (takeoverTargetKind === "review_pack" || takeoverBundle?.pathKind === "review") {
    return "Review Pack";
  }
  if (takeoverTargetKind === "thread") {
    return "Mission thread";
  }
  if (takeoverTargetKind === "run") {
    return "Mission run";
  }
  if (takeoverTargetKind === "sub_agent_session") {
    return "Sub-agent session";
  }
  if (reviewPackId) {
    return "Review Pack";
  }
  if (missionLinkage?.navigationTarget.kind === "thread") {
    return "Mission thread";
  }
  if (missionLinkage?.navigationTarget.kind === "run" || missionLinkage?.recoveryPath === "run") {
    return "Mission run";
  }
  return "Review Pack";
}

export function projectTakeoverBundleToContinuation(
  takeoverBundle: HugeCodeTakeoverBundle | null | undefined
) {
  return buildRuntimeContinuationDescriptor({
    takeoverBundle: takeoverBundle ?? null,
  });
}

function buildDetails(input: {
  summary: string;
  takeoverBundle?: HugeCodeTakeoverBundle | null;
  missionLinkage?: HugeCodeMissionLinkageSummary | null;
  publishHandoff?: HugeCodePublishHandoffReference | null;
  actionability?: HugeCodeReviewActionabilitySummary | null;
  continuePathLabel: RuntimeContinuationPathLabel;
  truthSourceLabel: string;
}): string[] {
  const details: string[] = [];
  const pushUnique = (value: string | null | undefined) => {
    if (typeof value !== "string" || value.trim().length === 0 || details.includes(value)) {
      return;
    }
    details.push(value);
  };

  pushUnique(input.takeoverBundle?.summary);
  pushUnique(input.missionLinkage?.summary);
  pushUnique(input.publishHandoff?.summary ?? null);
  pushUnique(input.summary);
  pushUnique(`Canonical continue path: ${input.continuePathLabel}.`);
  pushUnique(`Follow-up source: ${input.truthSourceLabel}.`);
  for (const degradedReason of input.actionability?.degradedReasons ?? []) {
    pushUnique(degradedReason);
  }
  return details;
}

function buildCanonicalNextActionFromTakeover(input: {
  takeoverBundle: HugeCodeTakeoverBundle;
  summary: string;
  blockingReason: string | null;
  navigationTarget: RuntimeCanonicalNavigationTarget;
  continuePathLabel: RuntimeContinuationPathLabel;
}): RuntimeCanonicalNextAction {
  const kind =
    input.takeoverBundle.state === "blocked"
      ? "blocked"
      : mapNextActionKind(input.takeoverBundle.primaryAction);
  return {
    kind,
    label:
      input.takeoverBundle.pathKind === "resume"
        ? "Resume mission"
        : input.takeoverBundle.pathKind === "review"
          ? "Open review"
          : buildContinueLabel(input.continuePathLabel),
    detail: input.takeoverBundle.recommendedAction || input.summary,
    blockedReason: kind === "blocked" ? (input.blockingReason ?? input.summary) : null,
    navigationTarget: input.navigationTarget,
  };
}

function buildCanonicalNextActionFromRuntimeActionability(input: {
  state: RuntimeContinuationState;
  continuePathLabel: RuntimeContinuationPathLabel;
  summary: string;
  blockingReason: string | null;
  navigationTarget: RuntimeCanonicalNavigationTarget;
  nextAction?: HugeCodeRunNextAction | null;
  sourceKind: "review" | "resume" | "handoff" | "fallback";
}): RuntimeCanonicalNextAction {
  if (input.state === "blocked") {
    return {
      kind: "blocked",
      label: "Inspect blocked follow-up",
      detail: input.summary,
      blockedReason: input.blockingReason ?? input.summary,
      navigationTarget: input.navigationTarget,
    };
  }

  if (input.sourceKind === "resume") {
    return {
      kind: "resume",
      label: "Resume mission",
      detail: input.summary,
      blockedReason: null,
      navigationTarget: input.navigationTarget,
    };
  }

  if (input.sourceKind === "review") {
    return {
      kind: "review",
      label: "Open review",
      detail: input.summary,
      blockedReason: null,
      navigationTarget: input.navigationTarget,
    };
  }

  if (input.sourceKind === "handoff") {
    return {
      kind: input.navigationTarget ? "continue" : "follow_up",
      label: buildContinueLabel(input.continuePathLabel),
      detail: input.summary,
      blockedReason: null,
      navigationTarget: input.navigationTarget,
    };
  }

  if (input.nextAction) {
    return {
      kind: mapNextActionKind(input.nextAction.action),
      label: input.nextAction.label,
      detail: input.nextAction.detail ?? input.summary,
      blockedReason: null,
      navigationTarget: input.navigationTarget,
    };
  }

  return {
    kind: "follow_up",
    label: buildContinueLabel(input.continuePathLabel),
    detail: input.summary,
    blockedReason: null,
    navigationTarget: input.navigationTarget,
  };
}

export function buildRuntimeContinuationDescriptor(
  input: RuntimeContinuationDescriptorInput
): RuntimeContinuationDescriptor | null {
  const continuePathLabel = resolveContinuationPathLabel({
    takeoverBundle: input.takeoverBundle ?? null,
    missionLinkage: input.missionLinkage ?? null,
    reviewPackId: input.reviewPackId ?? null,
  });
  const actionability = input.actionability ?? null;
  const publishHandoff = resolvePreferredPublishHandoff({
    takeoverBundle: input.takeoverBundle ?? null,
    publishHandoff: input.publishHandoff ?? null,
  });
  const truthSource = resolveContinuationTruthSource({
    takeoverBundle: input.takeoverBundle ?? null,
    actionability: actionability,
    missionLinkage: input.missionLinkage ?? null,
    publishHandoff,
    checkpoint: input.checkpoint ?? null,
    nextAction: input.nextAction ?? null,
  });
  const truthSourceLabel = formatRuntimeContinuationTruthSourceLabel(truthSource);
  const navigationTarget = resolveNavigationTarget({
    takeoverBundle: input.takeoverBundle ?? null,
    missionLinkage: input.missionLinkage ?? null,
  });

  if (input.takeoverBundle) {
    const takeoverBundle = input.takeoverBundle;
    const takeoverActionability = takeoverBundle.reviewActionability ?? null;
    const state =
      takeoverBundle.pathKind === "review"
        ? takeoverActionability
          ? mapActionabilityState(takeoverActionability.state)
          : mapTakeoverState(takeoverBundle.state)
        : mapTakeoverState(takeoverBundle.state);
    const summary =
      takeoverBundle.pathKind === "review"
        ? (takeoverActionability?.summary ?? takeoverBundle.summary)
        : (takeoverBundle.blockingReason ?? takeoverBundle.summary);
    const blockingReason =
      state === "blocked"
        ? (takeoverBundle.blockingReason ?? takeoverActionability?.summary ?? summary)
        : null;
    const recommendedAction =
      takeoverBundle.recommendedAction ||
      buildDefaultRecommendedAction({
        state,
        pathKind: takeoverBundle.pathKind,
        continuePathLabel,
      });
    return {
      state,
      pathKind: takeoverBundle.pathKind,
      continuePathLabel,
      summary,
      details: buildDetails({
        summary,
        takeoverBundle,
        missionLinkage: input.missionLinkage ?? null,
        publishHandoff,
        actionability: takeoverActionability,
        continuePathLabel,
        truthSourceLabel,
      }),
      blockingReason,
      recommendedAction,
      truthSource,
      truthSourceLabel,
      navigationTarget,
      canonicalNextAction: buildCanonicalNextActionFromTakeover({
        takeoverBundle,
        summary,
        blockingReason,
        navigationTarget,
        continuePathLabel,
      }),
    };
  }

  if (actionability) {
    const state = mapActionabilityState(actionability.state);
    const summary = actionability.summary;
    const blockingReason = state === "blocked" ? summary : null;
    const recommendedAction = buildDefaultRecommendedAction({
      state,
      pathKind: "review",
      continuePathLabel,
    });
    return {
      state,
      pathKind: "review",
      continuePathLabel,
      summary,
      details: buildDetails({
        summary,
        missionLinkage: input.missionLinkage ?? null,
        publishHandoff,
        actionability,
        continuePathLabel,
        truthSourceLabel,
      }),
      blockingReason,
      recommendedAction,
      truthSource,
      truthSourceLabel,
      navigationTarget,
      canonicalNextAction: buildCanonicalNextActionFromRuntimeActionability({
        state,
        continuePathLabel,
        summary,
        blockingReason,
        navigationTarget:
          navigationTarget ??
          (input.reviewPackId
            ? {
                kind: "review_pack",
                workspaceId: input.missionLinkage?.workspaceId ?? "",
                taskId: input.missionLinkage?.taskId ?? "",
                runId: input.missionLinkage?.runId ?? "",
                reviewPackId: input.reviewPackId,
              }
            : null),
        nextAction: input.nextAction ?? null,
        sourceKind: "review",
      }),
    };
  }

  const hasResume = input.checkpoint?.resumeReady === true;
  const hasHandoff = Boolean(publishHandoff) || hasRecoveryPath(input.missionLinkage ?? null);
  const recoverable =
    hasResume ||
    input.checkpoint?.recovered === true ||
    input.runState === "paused" ||
    input.runState === "needs_input";

  if (input.runState === "review_ready") {
    const summary =
      "Runtime marked this run review-ready, but review actionability was not published.";
    return {
      state: "attention",
      pathKind: "missing",
      continuePathLabel,
      summary,
      details: buildDetails({
        summary,
        missionLinkage: input.missionLinkage ?? null,
        publishHandoff,
        continuePathLabel,
        truthSourceLabel,
      }),
      blockingReason: null,
      recommendedAction:
        "Inspect runtime review truth before continuing from this review-ready run.",
      truthSource: "missing",
      truthSourceLabel: formatRuntimeContinuationTruthSourceLabel("missing"),
      navigationTarget,
      canonicalNextAction: {
        kind: "blocked",
        label: "Inspect blocked follow-up",
        detail: summary,
        blockedReason: summary,
        navigationTarget,
      },
    };
  }

  if (hasResume) {
    const summary =
      input.checkpoint?.summary ??
      "Runtime published a canonical checkpoint path and this run is ready to resume.";
    return {
      state: "ready",
      pathKind: "resume",
      continuePathLabel,
      summary,
      details: buildDetails({
        summary,
        missionLinkage: input.missionLinkage ?? null,
        publishHandoff,
        continuePathLabel,
        truthSourceLabel,
      }),
      blockingReason: null,
      recommendedAction: buildDefaultRecommendedAction({
        state: "ready",
        pathKind: "resume",
        continuePathLabel,
      }),
      truthSource,
      truthSourceLabel,
      navigationTarget,
      canonicalNextAction: buildCanonicalNextActionFromRuntimeActionability({
        state: "ready",
        continuePathLabel,
        summary,
        blockingReason: null,
        navigationTarget,
        nextAction: input.nextAction ?? null,
        sourceKind: "resume",
      }),
    };
  }

  if (hasHandoff) {
    const summary =
      publishHandoff?.summary ??
      input.missionLinkage?.summary ??
      "Runtime published a canonical handoff path for this run.";
    const state: RuntimeContinuationState = recoverable ? "ready" : "attention";
    return {
      state,
      pathKind: "handoff",
      continuePathLabel,
      summary,
      details: buildDetails({
        summary,
        missionLinkage: input.missionLinkage ?? null,
        publishHandoff,
        continuePathLabel,
        truthSourceLabel,
      }),
      blockingReason: null,
      recommendedAction: buildDefaultRecommendedAction({
        state,
        pathKind: "handoff",
        continuePathLabel,
      }),
      truthSource,
      truthSourceLabel,
      navigationTarget,
      canonicalNextAction: buildCanonicalNextActionFromRuntimeActionability({
        state,
        continuePathLabel,
        summary,
        blockingReason: null,
        navigationTarget,
        nextAction: input.nextAction ?? null,
        sourceKind: "handoff",
      }),
    };
  }

  if (recoverable) {
    const summary =
      input.checkpoint?.summary ??
      "This run looks recoverable, but runtime did not publish a canonical continue path.";
    return {
      state: "blocked",
      pathKind: "missing",
      continuePathLabel,
      summary,
      details: buildDetails({
        summary,
        missionLinkage: input.missionLinkage ?? null,
        publishHandoff,
        continuePathLabel,
        truthSourceLabel,
      }),
      blockingReason: summary,
      recommendedAction: buildDefaultRecommendedAction({
        state: "blocked",
        pathKind: "missing",
        continuePathLabel,
      }),
      truthSource,
      truthSourceLabel,
      navigationTarget,
      canonicalNextAction: buildCanonicalNextActionFromRuntimeActionability({
        state: "blocked",
        continuePathLabel,
        summary,
        blockingReason: summary,
        navigationTarget,
        nextAction: input.nextAction ?? null,
        sourceKind: "fallback",
      }),
    };
  }

  if (input.nextAction && !input.checkpoint && !input.missionLinkage && !publishHandoff) {
    const summary = input.nextAction.detail ?? input.nextAction.label;
    return {
      state: "missing",
      pathKind: "missing",
      continuePathLabel,
      summary,
      details: buildDetails({
        summary,
        continuePathLabel,
        truthSourceLabel,
      }),
      blockingReason: null,
      recommendedAction: summary,
      truthSource: "next_action",
      truthSourceLabel: formatRuntimeContinuationTruthSourceLabel("next_action"),
      navigationTarget,
      canonicalNextAction: buildCanonicalNextActionFromRuntimeActionability({
        state: "missing",
        continuePathLabel,
        summary,
        blockingReason: null,
        navigationTarget,
        nextAction: input.nextAction,
        sourceKind: "fallback",
      }),
    };
  }

  if (input.checkpoint || input.missionLinkage || publishHandoff || input.nextAction) {
    const summary =
      input.checkpoint?.summary ??
      input.missionLinkage?.summary ??
      publishHandoff?.summary ??
      input.nextAction?.detail ??
      "Continuity signals are incomplete for this run even though runtime published partial recovery truth.";
    return {
      state: "attention",
      pathKind: "missing",
      continuePathLabel,
      summary,
      details: buildDetails({
        summary,
        missionLinkage: input.missionLinkage ?? null,
        publishHandoff,
        continuePathLabel,
        truthSourceLabel,
      }),
      blockingReason: null,
      recommendedAction: buildDefaultRecommendedAction({
        state: "attention",
        pathKind: "missing",
        continuePathLabel,
      }),
      truthSource,
      truthSourceLabel,
      navigationTarget,
      canonicalNextAction: buildCanonicalNextActionFromRuntimeActionability({
        state: "attention",
        continuePathLabel,
        summary,
        blockingReason: null,
        navigationTarget,
        nextAction: input.nextAction ?? null,
        sourceKind: "fallback",
      }),
    };
  }

  return null;
}

export function buildRuntimeContinuationAggregate(input: {
  candidates: RuntimeContinuationAggregateCandidate[];
  durabilityDegraded?: boolean | null;
}): RuntimeContinuationAggregate {
  const items = input.candidates
    .map((candidate) => {
      const descriptor = buildRuntimeContinuationDescriptor(candidate);
      return descriptor
        ? {
            runId: candidate.runId,
            taskId: candidate.taskId,
            ...descriptor,
          }
        : null;
    })
    .filter((item): item is RuntimeContinuationAggregateItem => item !== null)
    .sort((left, right) => sortState(right.state) - sortState(left.state));

  const recoverableRunCount = items.filter(
    (item) => item.pathKind === "resume" && item.state === "ready"
  ).length;
  const handoffReadyCount = items.filter((item) => item.pathKind === "handoff").length;
  const reviewReadyCount = items.filter(
    (item) => item.pathKind === "review" && item.state === "ready"
  ).length;
  const reviewBlockedCount = items.filter(
    (item) => item.pathKind === "review" && item.state === "blocked"
  ).length;
  const missingPathCount = items.filter((item) => item.pathKind === "missing").length;
  const attentionCount = items.filter((item) => item.state === "attention").length;
  const blockedCount = items.filter((item) => item.state === "blocked").length;

  let state: RuntimeContinuationAggregate["state"] = "ready";
  for (const item of items) {
    if (item.state === "missing") {
      continue;
    }
    state = maxState(state, item.state);
  }
  if (state === "ready" && input.durabilityDegraded) {
    state = "attention";
  }

  const topProblem = items.find((item) => item.state === "blocked" || item.state === "attention");
  return {
    state,
    blockingReason: topProblem?.state === "blocked" ? topProblem.blockingReason : null,
    recommendedAction:
      topProblem?.recommendedAction ??
      (input.durabilityDegraded
        ? "Inspect checkpoint durability before relying on recovery or handoff."
        : "Runtime continuity truth is ready for resume, handoff, or review follow-up."),
    recoverableRunCount,
    handoffReadyCount,
    reviewReadyCount,
    reviewBlockedCount,
    missingPathCount,
    attentionCount,
    blockedCount,
    items,
  };
}
