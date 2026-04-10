import {
  buildRuntimeTruthCompatInputFromRunReviewPair,
  type HugeCodeReviewPackSummary,
} from "@ku0/code-runtime-host-contract";
import type { HugeCodeMissionControlSnapshot as MissionControlProjection } from "@ku0/code-runtime-host-contract";
import {
  summarizeReviewContinuationActionability,
  type ReviewContinuationActionabilitySummary,
} from "./runtimeReviewContinuationFacade";

export function resolveMissionContinuationActionability(input: {
  reviewPack: HugeCodeReviewPackSummary | null;
  run: MissionControlProjection["runs"][number] | null;
}): ReviewContinuationActionabilitySummary {
  const compatInput = buildRuntimeTruthCompatInputFromRunReviewPair(input);
  return summarizeReviewContinuationActionability({
    runState: compatInput.state ?? null,
    checkpoint: compatInput.checkpoint ?? null,
    takeoverBundle: compatInput.takeoverBundle ?? null,
    actionability: compatInput.actionability ?? null,
    missionLinkage: compatInput.missionLinkage ?? null,
    publishHandoff: compatInput.publishHandoff ?? null,
    reviewPackId: compatInput.reviewPackId ?? null,
    continuation: compatInput.continuation ?? null,
  });
}
