import type { HugeCodeReviewPackSummary } from "@ku0/code-runtime-host-contract";
import type { MissionControlProjection } from "./runtimeMissionControlFacade";
import {
  summarizeReviewContinuationActionability,
  type ReviewContinuationActionabilitySummary,
} from "./runtimeReviewContinuationFacade";

export function resolveMissionContinuationActionability(input: {
  reviewPack: HugeCodeReviewPackSummary | null;
  run: MissionControlProjection["runs"][number] | null;
}): ReviewContinuationActionabilitySummary {
  return summarizeReviewContinuationActionability({
    runState: input.run?.state ?? null,
    checkpoint: input.reviewPack?.checkpoint ?? input.run?.checkpoint ?? null,
    takeoverBundle: input.reviewPack?.takeoverBundle ?? input.run?.takeoverBundle ?? null,
    actionability: input.reviewPack?.actionability ?? input.run?.actionability ?? null,
    missionLinkage: input.reviewPack?.missionLinkage ?? input.run?.missionLinkage ?? null,
    publishHandoff: input.reviewPack?.publishHandoff ?? input.run?.publishHandoff ?? null,
    reviewPackId: input.reviewPack?.id ?? input.run?.reviewPackId ?? null,
    continuation: input.reviewPack?.continuation ?? input.run?.continuation ?? null,
  });
}
