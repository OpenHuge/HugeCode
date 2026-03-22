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

  const tryNavigateToLink = useCallback(async () => {
    const link = pendingLinkRef.current;
    if (!link) {
      return;
    }
    if (Date.now() - link.notifiedAt > maxAgeMs) {
      pendingLinkRef.current = null;
      return;
    }

    setCenterMode("chat");
    setSelectedDiffPath(null);

    const workspaceId = link.kind === "thread" ? link.workspaceId : link.target.workspaceId;
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
      pendingLinkRef.current = null;
      return;
    }

    if (!workspace.connected) {
      try {
        await connectWorkspace(workspace);
      } catch {
        // Ignore connect failures; user can retry manually.
      }
    }

    if (link.kind === "thread") {
      setActiveTab("missions");
      setActiveWorkspaceId(link.workspaceId);
      setActiveThreadId(link.threadId, link.workspaceId);
      pendingLinkRef.current = null;
      return;
    }

    if (link.target.kind === "thread") {
      setActiveTab("missions");
      setActiveWorkspaceId(link.target.workspaceId);
      setActiveThreadId(link.target.threadId, link.target.workspaceId);
      pendingLinkRef.current = null;
      return;
    }

    openReviewPack({
      workspaceId: link.target.workspaceId,
      taskId: link.target.taskId,
      runId: link.target.runId,
      reviewPackId: link.target.reviewPackId,
      source: "system",
    });
    setActiveWorkspaceId(link.target.workspaceId);
    setActiveTab("review");
    pendingLinkRef.current = null;
  }, [
    connectWorkspace,
    hasLoadedWorkspaces,
    maxAgeMs,
    openReviewPack,
    refreshWorkspaces,
    setActiveTab,
    setActiveThreadId,
    setActiveWorkspaceId,
    setCenterMode,
    setSelectedDiffPath,
    workspacesById,
  ]);

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

  return { recordPendingThreadLink, recordPendingMissionTarget };
}
