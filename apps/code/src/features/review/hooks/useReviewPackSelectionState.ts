import { useCallback, useEffect, useMemo, useState } from "react";
import type { HugeCodeMissionControlSnapshot as MissionControlProjection } from "@ku0/code-runtime-host-contract";
import {
  resolveReviewPackSelection,
  type ReviewPackSelectionRequest,
} from "@ku0/code-application/runtimeReviewPackSurfaceModel";

type UseReviewPackSelectionStateParams = {
  projection: MissionControlProjection | null;
  activeWorkspaceId: string | null;
};

export function useReviewPackSelectionState({
  projection,
  activeWorkspaceId,
}: UseReviewPackSelectionStateParams) {
  const [request, setRequest] = useState<ReviewPackSelectionRequest | null>(null);

  useEffect(() => {
    if (!activeWorkspaceId) {
      return;
    }
    setRequest((current) => {
      if (current?.workspaceId === activeWorkspaceId) {
        return current;
      }
      return {
        workspaceId: activeWorkspaceId,
        source: "system",
      };
    });
  }, [activeWorkspaceId]);

  const selection = useMemo(
    () =>
      resolveReviewPackSelection({
        projection,
        workspaceId: activeWorkspaceId,
        request,
      }),
    [activeWorkspaceId, projection, request]
  );

  const openReviewPack = useCallback((next: ReviewPackSelectionRequest) => {
    setRequest(next);
  }, []);

  return {
    reviewPackSelection: selection,
    openReviewPack,
    reviewPackSelectionRequest: request,
  };
}
