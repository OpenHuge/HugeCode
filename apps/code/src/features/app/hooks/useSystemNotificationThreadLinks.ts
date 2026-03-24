import { useCallback, useEffect, useMemo, useRef } from "react";
import type { WorkspaceInfo } from "../../../types";
import type { AppTab } from "../../shell/types/shellRoute";
import type { MissionNavigationTarget } from "../../missions/utils/missionControlPresentation";
import type { ReviewPackSelectionRequest } from "../../review/utils/reviewPackSurfaceModel";

type ThreadDeepLink = {
  kind: "thread";
  workspaceId: string;
  threadId: string;
  notifiedAt: number;
};

type MissionDeepLink = {
  kind: "mission";
  target: MissionNavigationTarget;
  notifiedAt: number;
};

type PendingDeepLink = ThreadDeepLink | MissionDeepLink;

type Params = {
  hasLoadedWorkspaces: boolean;
  workspacesById: Map<string, WorkspaceInfo>;
  refreshWorkspaces: () => Promise<WorkspaceInfo[] | undefined>;
  connectWorkspace: (workspace: WorkspaceInfo) => Promise<void>;
  openReviewPack: (request: ReviewPackSelectionRequest) => void;
  setActiveTab: (tab: AppTab) => void;
  setCenterMode: (mode: "chat" | "diff") => void;
  setSelectedDiffPath: (path: string | null) => void;
  setActiveWorkspaceId: (workspaceId: string | null) => void;
  setActiveThreadId: (threadId: string | null, workspaceId?: string) => void;
  maxAgeMs?: number;
};

type Result = {
  recordPendingThreadLink: (workspaceId: string, threadId: string) => void;
  recordPendingMissionTarget: (target: MissionNavigationTarget) => void;
  openMissionTarget: (target: MissionNavigationTarget) => Promise<void>;
};

export function useSystemNotificationThreadLinks({
  hasLoadedWorkspaces,
  workspacesById,
  refreshWorkspaces,
  connectWorkspace,
  openReviewPack,
  setActiveTab,
  setCenterMode,
  setSelectedDiffPath,
  setActiveWorkspaceId,
  setActiveThreadId,
  maxAgeMs = 120_000,
}: Params): Result {
  const pendingLinkRef = useRef<PendingDeepLink | null>(null);
  const refreshInFlightRef = useRef(false);

  const recordPendingThreadLink = useCallback((workspaceId: string, threadId: string) => {
    pendingLinkRef.current = { kind: "thread", workspaceId, threadId, notifiedAt: Date.now() };
  }, []);
  const recordPendingMissionTarget = useCallback((target: MissionNavigationTarget) => {
    pendingLinkRef.current = {
      kind: "mission",
      target,
      notifiedAt: Date.now(),
    };
  }, []);

  const navigateToTarget = useCallback(
    async (target: ThreadDeepLink | MissionNavigationTarget) => {
      setCenterMode("chat");
      setSelectedDiffPath(null);

      const workspaceId = target.workspaceId;
      let workspace = workspacesById.get(workspaceId) ?? null;
      if (!workspace && hasLoadedWorkspaces && !refreshInFlightRef.current) {
        refreshInFlightRef.current = true;
        try {
          const refreshed = await refreshWorkspaces();
          workspace = refreshed?.find((entry) => entry.id === workspaceId) ?? null;
        } finally {
          refreshInFlightRef.current = false;
        }
      }

      if (!workspace) {
        return;
      }

      if (!workspace.connected) {
        try {
          await connectWorkspace(workspace);
        } catch {
          // Ignore connect failures; user can retry manually.
        }
      }

      if (target.kind === "thread") {
        setActiveTab("missions");
        setActiveWorkspaceId(target.workspaceId);
        setActiveThreadId(target.threadId, target.workspaceId);
        return;
      }

      openReviewPack({
        workspaceId: target.workspaceId,
        taskId: target.taskId,
        runId: target.runId,
        reviewPackId: target.reviewPackId,
        source: "system",
      });
      setActiveWorkspaceId(target.workspaceId);
      setActiveTab("review");
    },
    [
      connectWorkspace,
      hasLoadedWorkspaces,
      openReviewPack,
      refreshWorkspaces,
      setActiveTab,
      setActiveThreadId,
      setActiveWorkspaceId,
      setCenterMode,
      setSelectedDiffPath,
      workspacesById,
    ]
  );

  const openMissionTarget = useCallback(
    async (target: MissionNavigationTarget) => {
      await navigateToTarget(target);
    },
    [navigateToTarget]
  );

  const tryNavigateToLink = useCallback(async () => {
    const link = pendingLinkRef.current;
    if (!link) {
      return;
    }
    if (Date.now() - link.notifiedAt > maxAgeMs) {
      pendingLinkRef.current = null;
      return;
    }

    if (link.kind === "thread") {
      await navigateToTarget(link);
      pendingLinkRef.current = null;
      return;
    }

    await navigateToTarget(link.target);
    pendingLinkRef.current = null;
  }, [maxAgeMs, navigateToTarget]);

  const focusHandler = useMemo(() => () => void tryNavigateToLink(), [tryNavigateToLink]);

  useEffect(() => {
    window.addEventListener("focus", focusHandler);
    return () => window.removeEventListener("focus", focusHandler);
  }, [focusHandler]);

  useEffect(() => {
    if (!pendingLinkRef.current) {
      return;
    }
    if (!hasLoadedWorkspaces) {
      return;
    }
    void tryNavigateToLink();
  }, [hasLoadedWorkspaces, tryNavigateToLink]);

  return { recordPendingThreadLink, recordPendingMissionTarget, openMissionTarget };
}
