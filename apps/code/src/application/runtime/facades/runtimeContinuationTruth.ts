import type {
  HugeCodeMissionLinkageSummary,
  HugeCodePublishHandoffReference,
  HugeCodeReviewActionabilitySummary,
  HugeCodeTakeoverBundle,
} from "@ku0/code-runtime-host-contract";

export type RuntimeContinuationPathLabel = "Mission thread" | "Mission run" | "Review Pack";
export type RuntimeContinuationState = "ready" | "attention" | "blocked" | "missing";
export type RuntimeContinuationPathKind = "resume" | "handoff" | "review" | "missing";

export type RuntimeContinuationProjection = {
  state: RuntimeContinuationState;
  pathKind: RuntimeContinuationPathKind;
  detail: string;
  recommendedAction: string;
};

type RuntimeContinuationSourceInput = {
  takeoverBundle?: HugeCodeTakeoverBundle | null;
  actionability?: HugeCodeReviewActionabilitySummary | null;
  missionLinkage?: HugeCodeMissionLinkageSummary | null;
  publishHandoff?: HugeCodePublishHandoffReference | null;
};

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

export function resolvePreferredReviewActionability({
  takeoverBundle,
  actionability,
}: Pick<RuntimeContinuationSourceInput, "takeoverBundle" | "actionability">) {
  return takeoverBundle?.reviewActionability ?? actionability ?? null;
}

export function resolvePreferredPublishHandoff({
  takeoverBundle,
  publishHandoff,
}: Pick<RuntimeContinuationSourceInput, "takeoverBundle" | "publishHandoff">) {
  return takeoverBundle?.publishHandoff ?? publishHandoff ?? null;
}

export function resolveContinuationPathLabel({
  takeoverBundle,
  missionLinkage,
}: Pick<
  RuntimeContinuationSourceInput,
  "takeoverBundle" | "missionLinkage"
>): RuntimeContinuationPathLabel {
  const takeoverTargetKind = takeoverBundle?.target?.kind;
  if (takeoverTargetKind === "thread") {
    return "Mission thread";
  }
  if (takeoverTargetKind === "run") {
    return "Mission run";
  }
  if (takeoverTargetKind === "review_pack") {
    return "Review Pack";
  }
  if (takeoverBundle?.pathKind === "review") {
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
): RuntimeContinuationProjection | null {
  if (!takeoverBundle) {
    return null;
  }

  if (takeoverBundle.pathKind === "resume" || takeoverBundle.pathKind === "handoff") {
    return {
      state: takeoverBundle.state,
      pathKind: takeoverBundle.pathKind,
      detail: takeoverBundle.summary,
      recommendedAction: takeoverBundle.recommendedAction,
    };
  }

  if (takeoverBundle.pathKind === "review") {
    const actionability = resolvePreferredReviewActionability({
      takeoverBundle,
      actionability: null,
    });
    return {
      state:
        actionability !== null ? mapActionabilityState(actionability.state) : takeoverBundle.state,
      pathKind: "review",
      detail: actionability?.summary ?? takeoverBundle.summary,
      recommendedAction: takeoverBundle.recommendedAction,
    };
  }

  return {
    state: takeoverBundle.state,
    pathKind: "missing",
    detail: takeoverBundle.blockingReason ?? takeoverBundle.summary,
    recommendedAction: takeoverBundle.recommendedAction,
  };
}
