import { useCallback, useMemo } from "react";
import type { AtlasDetailLevel } from "../../atlas/utils/atlasContext";
import type { ThreadAtlasParamsPatch } from "../../threads/hooks/useThreadAtlasParams";
import type { ThreadAtlasMemoryDigest } from "../../threads/utils/threadStorage";

type UseMainAppAtlasControlsOptions = {
  activeWorkspaceId: string | null;
  activeThreadId: string | null;
  resolveThreadAtlasDriverOrder: (workspaceId: string, threadId: string) => string[] | null;
  resolveThreadAtlasEnabled: (workspaceId: string, threadId: string) => boolean;
  resolveThreadAtlasDetailLevel: (workspaceId: string, threadId: string) => AtlasDetailLevel;
  getThreadAtlasMemoryDigest: (
    workspaceId: string,
    threadId: string
  ) => ThreadAtlasMemoryDigest | null;
  patchThreadAtlasParams: (
    workspaceId: string,
    threadId: string,
    patch: ThreadAtlasParamsPatch
  ) => void;
};

export function useMainAppAtlasControls({
  activeWorkspaceId,
  activeThreadId,
  resolveThreadAtlasDriverOrder,
  resolveThreadAtlasEnabled,
  resolveThreadAtlasDetailLevel,
  getThreadAtlasMemoryDigest,
  patchThreadAtlasParams,
}: UseMainAppAtlasControlsOptions) {
  const activeAtlasDriverOrder =
    activeWorkspaceId && activeThreadId
      ? resolveThreadAtlasDriverOrder(activeWorkspaceId, activeThreadId)
      : null;

  const activeAtlasEnabled =
    !activeWorkspaceId || !activeThreadId
      ? true
      : resolveThreadAtlasEnabled(activeWorkspaceId, activeThreadId);

  const activeAtlasDetailLevel =
    !activeWorkspaceId || !activeThreadId
      ? "balanced"
      : resolveThreadAtlasDetailLevel(activeWorkspaceId, activeThreadId);

  const activeAtlasLongTermMemoryDigest =
    !activeWorkspaceId || !activeThreadId
      ? null
      : getThreadAtlasMemoryDigest(activeWorkspaceId, activeThreadId);

  const onActiveAtlasDriverOrderChange = useCallback(
    (order: string[]) => {
      if (!activeWorkspaceId || !activeThreadId) {
        return;
      }
      patchThreadAtlasParams(activeWorkspaceId, activeThreadId, { driverOrder: order });
    },
    [activeThreadId, activeWorkspaceId, patchThreadAtlasParams]
  );

  const onActiveAtlasEnabledChange = useCallback(
    (enabled: boolean) => {
      if (!activeWorkspaceId || !activeThreadId) {
        return;
      }
      patchThreadAtlasParams(activeWorkspaceId, activeThreadId, { enabled });
    },
    [activeThreadId, activeWorkspaceId, patchThreadAtlasParams]
  );

  const onActiveAtlasDetailLevelChange = useCallback(
    (detailLevel: AtlasDetailLevel) => {
      if (!activeWorkspaceId || !activeThreadId) {
        return;
      }
      patchThreadAtlasParams(activeWorkspaceId, activeThreadId, { detailLevel });
    },
    [activeThreadId, activeWorkspaceId, patchThreadAtlasParams]
  );

  return useMemo(
    () => ({
      activeAtlasDriverOrder,
      activeAtlasEnabled,
      activeAtlasDetailLevel,
      activeAtlasLongTermMemoryDigest,
      onActiveAtlasDriverOrderChange,
      onActiveAtlasEnabledChange,
      onActiveAtlasDetailLevelChange,
    }),
    [
      activeAtlasDriverOrder,
      activeAtlasEnabled,
      activeAtlasDetailLevel,
      activeAtlasLongTermMemoryDigest,
      onActiveAtlasDriverOrderChange,
      onActiveAtlasEnabledChange,
      onActiveAtlasDetailLevelChange,
    ]
  );
}
