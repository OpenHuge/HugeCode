import type {
  HugeCodeMissionLinkageSummary,
  HugeCodePublishHandoffReference,
  HugeCodeReviewActionabilitySummary,
  HugeCodeTakeoverBundle,
} from "@ku0/code-runtime-host-contract";
import {
  formatHugeCodeOperatorTruthSourceLabel as formatSharedTruthSourceLabel,
  resolveHugeCodeOperatorContinuePathLabel,
  resolveHugeCodeOperatorTruthSource,
  resolvePreferredHugeCodePublishHandoff,
  resolvePreferredHugeCodeReviewActionability,
  summarizeHugeCodeOperatorContinuation,
} from "@ku0/code-runtime-host-contract/hugeCodeOperatorLoop";

export type RuntimeContinuationPathLabel = "Mission thread" | "Mission run" | "Review Pack";
export type RuntimeContinuationState = "ready" | "attention" | "blocked" | "missing";
export type RuntimeContinuationPathKind = "approval" | "resume" | "handoff" | "review" | "missing";
export type RuntimeContinuationTruthSource =
  | "takeover_bundle"
  | "review_actionability"
  | "mission_linkage"
  | "publish_handoff"
  | "checkpoint"
  | "missing";

export type RuntimeContinuationProjection = {
  state: RuntimeContinuationState;
  pathKind: RuntimeContinuationPathKind;
  detail: string;
  recommendedAction: string;
  truthSource: RuntimeContinuationTruthSource;
  truthSourceLabel: string;
};

type RuntimeContinuationSourceInput = {
  takeoverBundle?: HugeCodeTakeoverBundle | null;
  actionability?: HugeCodeReviewActionabilitySummary | null;
  missionLinkage?: HugeCodeMissionLinkageSummary | null;
  publishHandoff?: HugeCodePublishHandoffReference | null;
};

function mapSharedState(
  state: "ready" | "degraded" | "blocked" | "missing"
): RuntimeContinuationState {
  if (state === "degraded") {
    return "attention";
  }
  return state;
}

export function resolvePreferredReviewActionability({
  takeoverBundle,
  actionability,
}: Pick<RuntimeContinuationSourceInput, "takeoverBundle" | "actionability">) {
  return resolvePreferredHugeCodeReviewActionability({
    takeoverBundle,
    reviewActionability: actionability,
  });
}

export function resolvePreferredPublishHandoff({
  takeoverBundle,
  publishHandoff,
}: Pick<RuntimeContinuationSourceInput, "takeoverBundle" | "publishHandoff">) {
  return resolvePreferredHugeCodePublishHandoff({
    takeoverBundle,
    publishHandoff,
  });
}

export function formatRuntimeContinuationTruthSourceLabel(
  source: RuntimeContinuationTruthSource
): string {
  return formatSharedTruthSourceLabel(source);
}

export function resolveContinuationTruthSource({
  takeoverBundle,
  actionability,
  missionLinkage,
  publishHandoff,
}: RuntimeContinuationSourceInput): RuntimeContinuationTruthSource {
  return resolveHugeCodeOperatorTruthSource({
    takeoverBundle,
    reviewActionability: actionability,
    missionLinkage,
    publishHandoff,
  });
}

export function resolveContinuationPathLabel({
  takeoverBundle,
  missionLinkage,
}: Pick<
  RuntimeContinuationSourceInput,
  "takeoverBundle" | "missionLinkage"
>): RuntimeContinuationPathLabel {
  return resolveHugeCodeOperatorContinuePathLabel({
    takeoverBundle,
    missionLinkage,
  });
}

export function projectTakeoverBundleToContinuation(
  takeoverBundle: HugeCodeTakeoverBundle | null | undefined
): RuntimeContinuationProjection | null {
  if (!takeoverBundle) {
    return null;
  }

  if (takeoverBundle.pathKind === "approval") {
    return {
      state: takeoverBundle.state === "ready" ? "attention" : takeoverBundle.state,
      pathKind: "approval",
      detail: takeoverBundle.blockingReason ?? takeoverBundle.summary,
      recommendedAction: takeoverBundle.recommendedAction,
      truthSource: "takeover_bundle",
      truthSourceLabel: formatRuntimeContinuationTruthSourceLabel("takeover_bundle"),
    };
  }
  const shared = summarizeHugeCodeOperatorContinuation({
    takeoverBundle,
  });
  return {
    state: mapSharedState(shared.state),
    pathKind: shared.pathKind,
    detail: shared.summary,
    recommendedAction: shared.recommendedAction,
    truthSource: shared.truthSource,
    truthSourceLabel: shared.truthSourceLabel,
  };
}
