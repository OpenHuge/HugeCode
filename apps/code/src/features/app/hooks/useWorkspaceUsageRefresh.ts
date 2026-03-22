import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WorkspaceInfo } from "../../../types";

type UseWorkspaceUsageRefreshParams = {
  activeWorkspaceId: string | null;
  hasLoaded: boolean;
  workspaces: WorkspaceInfo[];
  refreshAccountInfo: (workspaceId: string) => Promise<unknown> | unknown;
  refreshAccountRateLimitsBatch: (
    workspaceIds: ReadonlyArray<string>
  ) => Promise<unknown> | unknown;
};

type UseWorkspaceUsageRefreshResult = {
  connectedWorkspaceIds: string[];
  currentUsageRefreshLoading: boolean;
  allUsageRefreshLoading: boolean;
  handleRefreshCurrentUsage: () => void;
  handleRefreshAllUsage: () => void;
  canRefreshCurrentUsage: boolean;
  canRefreshAllUsage: boolean;
};

export function useWorkspaceUsageRefresh({
  activeWorkspaceId,
  hasLoaded,
  workspaces,
  refreshAccountInfo,
  refreshAccountRateLimitsBatch,
}: UseWorkspaceUsageRefreshParams): UseWorkspaceUsageRefreshResult {
  const [currentUsageRefreshLoading, setCurrentUsageRefreshLoading] = useState(false);
  const [allUsageRefreshLoading, setAllUsageRefreshLoading] = useState(false);
  const startupUsageRefreshWorkspaceIdsRef = useRef<Set<string>>(new Set());

  const connectedWorkspaceIds = useMemo(
    () => workspaces.filter((workspace) => workspace.connected).map((workspace) => workspace.id),
    [workspaces]
  );

  const refreshUsageForWorkspaces = useCallback(
    async (workspaceIds: ReadonlyArray<string>) => {
      const targetIds = Array.from(
        new Set(workspaceIds.map((workspaceId) => workspaceId.trim()).filter(Boolean))
      );
      if (targetIds.length === 0) {
        return;
      }
      await Promise.allSettled([
        Promise.resolve(refreshAccountRateLimitsBatch(targetIds)),
        ...targetIds.map((workspaceId) => Promise.resolve(refreshAccountInfo(workspaceId))),
      ]);
    },
    [refreshAccountInfo, refreshAccountRateLimitsBatch]
  );

  const handleRefreshCurrentUsage = useCallback(() => {
    if (!activeWorkspaceId) {
      return;
    }
    setCurrentUsageRefreshLoading(true);
    void refreshUsageForWorkspaces([activeWorkspaceId]).finally(() => {
      setCurrentUsageRefreshLoading(false);
    });
  }, [activeWorkspaceId, refreshUsageForWorkspaces]);

  const handleRefreshAllUsage = useCallback(() => {
    if (connectedWorkspaceIds.length === 0) {
      return;
    }
    setAllUsageRefreshLoading(true);
    void refreshUsageForWorkspaces(connectedWorkspaceIds).finally(() => {
      setAllUsageRefreshLoading(false);
    });
  }, [connectedWorkspaceIds, refreshUsageForWorkspaces]);

  useEffect(() => {
    if (!hasLoaded || connectedWorkspaceIds.length === 0) {
      return;
    }
    const pendingWorkspaceIds = connectedWorkspaceIds.filter(
      (workspaceId) => !startupUsageRefreshWorkspaceIdsRef.current.has(workspaceId)
    );
    if (pendingWorkspaceIds.length === 0) {
      return;
    }

    pendingWorkspaceIds.forEach((workspaceId) => {
      startupUsageRefreshWorkspaceIdsRef.current.add(workspaceId);
    });
    const timer = setTimeout(() => {
      void refreshUsageForWorkspaces(pendingWorkspaceIds);
    }, 0);
    return () => {
      clearTimeout(timer);
    };
  }, [connectedWorkspaceIds, hasLoaded, refreshUsageForWorkspaces]);

  useEffect(() => {
    const workspaceIdSet = new Set(workspaces.map((workspace) => workspace.id));
    for (const workspaceId of startupUsageRefreshWorkspaceIdsRef.current) {
      if (!workspaceIdSet.has(workspaceId)) {
        startupUsageRefreshWorkspaceIdsRef.current.delete(workspaceId);
      }
    }
  }, [workspaces]);

  return {
    connectedWorkspaceIds,
    currentUsageRefreshLoading,
    allUsageRefreshLoading,
    handleRefreshCurrentUsage,
    handleRefreshAllUsage,
    canRefreshCurrentUsage: Boolean(activeWorkspaceId),
    canRefreshAllUsage: connectedWorkspaceIds.length > 0,
  };
}
