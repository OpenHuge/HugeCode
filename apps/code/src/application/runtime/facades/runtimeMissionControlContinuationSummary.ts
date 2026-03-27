import type { HugeCodeReviewPackSummary } from "@ku0/code-runtime-host-contract";
import type { MissionControlProjection } from "./runtimeMissionControlFacade";
import { summarizeReviewContinuationActionability } from "./runtimeReviewContinuationFacade";

export type MissionReviewContinuation = ReturnType<
  typeof summarizeReviewContinuationActionability
> | null;

export function resolveLegacyReviewPackNextAction(reviewPack: HugeCodeReviewPackSummary | null) {
  return reviewPack?.recommendedNextAction?.trim() || null;
}

export function resolveCanonicalMissionReviewContinuation(input: {
  reviewPack: HugeCodeReviewPackSummary | null;
  run: MissionControlProjection["runs"][number] | null;
}): MissionReviewContinuation {
  const continuation = summarizeReviewContinuationActionability({
    takeoverBundle: input.reviewPack?.takeoverBundle ?? input.run?.takeoverBundle ?? null,
    actionability: input.reviewPack?.actionability ?? input.run?.actionability ?? null,
    missionLinkage: input.reviewPack?.missionLinkage ?? input.run?.missionLinkage ?? null,
    publishHandoff: input.reviewPack?.publishHandoff ?? input.run?.publishHandoff ?? null,
  });
  return continuation.state === "missing" ? null : continuation;
}

export function resolveMissionReviewContinuationData(input: {
  reviewPack: HugeCodeReviewPackSummary | null;
  run: MissionControlProjection["runs"][number] | null;
}) {
  const continuation = summarizeReviewContinuationActionability({
    takeoverBundle: input.reviewPack?.takeoverBundle ?? input.run?.takeoverBundle ?? null,
    actionability: input.reviewPack?.actionability ?? input.run?.actionability ?? null,
    missionLinkage: input.reviewPack?.missionLinkage ?? input.run?.missionLinkage ?? null,
    publishHandoff: input.reviewPack?.publishHandoff ?? input.run?.publishHandoff ?? null,
  });
  return {
    continuation,
    canonicalContinuation: continuation.state === "missing" ? null : continuation,
  };
}

export function buildMissionOverviewOperatorSignal(input: {
  reviewPack: HugeCodeReviewPackSummary | null;
  run: MissionControlProjection["runs"][number] | null;
  continuation: MissionReviewContinuation;
}): string | null {
  return (
    input.run?.operatorSnapshot?.currentActivity?.trim() ||
    input.run?.operatorSnapshot?.blocker?.trim() ||
    input.run?.approval?.summary?.trim() ||
    input.run?.nextAction?.detail?.trim() ||
    input.continuation?.summary ||
    resolveLegacyReviewPackNextAction(input.reviewPack) ||
    null
  );
}
