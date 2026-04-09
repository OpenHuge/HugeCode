import type { RuntimeReviewGetV2Response } from "@ku0/code-runtime-host-contract";
import type { MissionControlProjection } from "./runtimeMissionControlFacade";
import type { ReviewPackSelectionState } from "@ku0/code-application/runtimeReviewPackSurfaceModel";
import { useRuntimeReviewTruth } from "./runtimeRunTruthStore";

export type RuntimeReviewPackRuntimeTruthState = {
  reviewPack: RuntimeReviewGetV2Response;
  loading: boolean;
  error: string | null;
};

export function useRuntimeReviewPackRuntimeTruth(input: {
  projection: MissionControlProjection | null;
  selection: ReviewPackSelectionState;
}): RuntimeReviewPackRuntimeTruthState {
  const runId = input.selection.selectedRunId;
  const reviewTruth = useRuntimeReviewTruth({
    runId,
    workspaceId: input.selection.selectedWorkspaceId,
    enabled: Boolean(input.projection),
  });

  return {
    reviewPack: reviewTruth.reviewPack,
    loading: reviewTruth.loading,
    error: reviewTruth.error,
  };
}
