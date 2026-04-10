import {
  buildRuntimeTruthCompatInputFromRunReviewPair,
  type HugeCodeReviewPackSummary,
} from "@ku0/code-runtime-host-contract";
import type { HugeCodeMissionControlSnapshot as MissionControlProjection } from "@ku0/code-runtime-host-contract";
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
  const compatInput = buildRuntimeTruthCompatInputFromRunReviewPair(input);
  const continuation = summarizeReviewContinuationActionability({
    runState: compatInput.state ?? null,
    checkpoint: compatInput.checkpoint ?? null,
    takeoverBundle: compatInput.takeoverBundle ?? null,
    actionability: compatInput.actionability ?? null,
    missionLinkage: compatInput.missionLinkage ?? null,
    publishHandoff: compatInput.publishHandoff ?? null,
    reviewPackId: compatInput.reviewPackId ?? null,
    continuation: compatInput.continuation ?? null,
  });
  return continuation.state === "missing" ? null : continuation;
}

export function resolveMissionReviewContinuationData(input: {
  reviewPack: HugeCodeReviewPackSummary | null;
  run: MissionControlProjection["runs"][number] | null;
}) {
  const compatInput = buildRuntimeTruthCompatInputFromRunReviewPair(input);
  const continuation = summarizeReviewContinuationActionability({
    runState: compatInput.state ?? null,
    checkpoint: compatInput.checkpoint ?? null,
    takeoverBundle: compatInput.takeoverBundle ?? null,
    actionability: compatInput.actionability ?? null,
    missionLinkage: compatInput.missionLinkage ?? null,
    publishHandoff: compatInput.publishHandoff ?? null,
    reviewPackId: compatInput.reviewPackId ?? null,
    continuation: compatInput.continuation ?? null,
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
