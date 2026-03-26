import type { HugeCodeMissionControlSnapshot } from "@ku0/code-runtime-host-contract";
import { useCallback, useEffect, useRef } from "react";
import type { ConversationItem, DebugEntry, WorkspaceInfo } from "../../../types";
import { trackProductAnalyticsEvent } from "../../shared/productAnalytics";
import type { AppTab } from "../../shell/types/shellRoute";
import type { ReviewPackSelectionRequest } from "../../review/utils/reviewPackSurfaceModel";
import { useMissionControlAttentionNotificationsController } from "./useMissionControlAttentionNotificationsController";
import { useMissionControlCompletionNotificationsController } from "./useMissionControlCompletionNotificationsController";
import { useMainAppAutoDriveState } from "./useMainAppAutoDriveState";
import { useSystemNotificationThreadLinks } from "./useSystemNotificationThreadLinks";
import type { ThreadCodexParamsPatch } from "../../threads/hooks/useThreadCodexParams";

type Params = {
  activeWorkspace: WorkspaceInfo | null;
  activeThreadId: string | null;
  missionControlProjection: HugeCodeMissionControlSnapshot | null;
  refreshMissionControl?: (() => Promise<void> | void) | null;
  systemNotificationsEnabled: boolean;
  getWorkspaceName?: (workspaceId: string) => string | undefined;
  hasLoadedWorkspaces: boolean;
  workspacesById: Map<string, WorkspaceInfo>;
  refreshWorkspaces: () => Promise<WorkspaceInfo[] | undefined>;
  connectWorkspace: (workspace: WorkspaceInfo) => Promise<void>;
  setActiveTab: (tab: AppTab) => void;
  setCenterMode: (mode: "chat" | "diff") => void;
  setSelectedDiffPath: (path: string | null) => void;
  setActiveWorkspaceId: (workspaceId: string | null) => void;
  setActiveThreadId: (threadId: string | null, workspaceId?: string) => void;
  onDebug?: ((entry: DebugEntry) => void) | undefined;
  threadCodexState: {
    accessMode: "read-only" | "on-request" | "full-access";
    selectedModelId: string | null;
    selectedEffort: string | null;
  };
  threadCodexParamsVersion: number;
  getThreadCodexParams: (
    workspaceId: string,
    threadId: string
  ) => {
    autoDriveDraft?: ReturnType<typeof useMainAppAutoDriveState>["draft"] | null;
  } | null;
  activeItems: ConversationItem[];
  threadStatusById: Record<string, { isProcessing: boolean } | undefined>;
  sendUserMessageToThread: (
    workspace: WorkspaceInfo,
    threadId: string,
    text: string,
    images?: string[],
    options?: { skipPromptExpansion?: boolean }
  ) => Promise<void>;
  patchThreadCodexParams: (
    workspaceId: string,
    threadId: string,
    patch: ThreadCodexParamsPatch
  ) => void;
  preferredBackendIds?: string[] | null;
};

type RunAnalyticsSnapshot = {
  backendId: string | null;
  approvalWaiting: boolean;
};

function isApprovalWaiting(projectionRun: HugeCodeMissionControlSnapshot["runs"][number]): boolean {
  return (
    projectionRun.approval?.status === "pending_decision" || projectionRun.state === "needs_input"
  );
}

function resolveConfirmedPlacementBackendId(
  placement: HugeCodeMissionControlSnapshot["runs"][number]["placement"] | null | undefined
): string | null {
  if (
    !placement ||
    placement.lifecycleState !== "confirmed" ||
    placement.readiness !== "ready" ||
    typeof placement.resolvedBackendId !== "string"
  ) {
    return null;
  }
  const backendId = placement.resolvedBackendId.trim();
  return backendId.length > 0 ? backendId : null;
}

function isFallbackPlacement(
  placement: HugeCodeMissionControlSnapshot["runs"][number]["placement"] | null | undefined
): boolean {
  if (!placement) {
    return false;
  }
  return (
    placement.lifecycleState !== "confirmed" ||
    placement.readiness !== "ready" ||
    placement.resolutionSource === "runtime_fallback" ||
    placement.resolutionSource === "provider_route" ||
    placement.resolutionSource === "unresolved"
  );
}

export function useMainAppMissionControlState({
  activeWorkspace,
  activeThreadId,
  missionControlProjection,
  refreshMissionControl = null,
  systemNotificationsEnabled,
  getWorkspaceName,
  hasLoadedWorkspaces,
  workspacesById,
  refreshWorkspaces,
  connectWorkspace,
  setActiveTab,
  setCenterMode,
  setSelectedDiffPath,
  setActiveWorkspaceId,
  setActiveThreadId,
  onDebug,
  threadCodexState,
  threadCodexParamsVersion,
  getThreadCodexParams,
  activeItems,
  threadStatusById,
  sendUserMessageToThread,
  patchThreadCodexParams,
  preferredBackendIds,
}: Params) {
  const openReviewPackRef = useRef<(request: ReviewPackSelectionRequest) => void>(() => undefined);
  const previousRunsRef = useRef<Record<string, RunAnalyticsSnapshot>>({});
  const seenReviewPackIdsRef = useRef<Set<string>>(new Set());

  const autoDriveState = useMainAppAutoDriveState(
    activeWorkspace,
    activeThreadId,
    missionControlProjection,
    threadCodexState,
    threadCodexParamsVersion,
    getThreadCodexParams,
    activeItems,
    threadStatusById,
    sendUserMessageToThread,
    patchThreadCodexParams,
    preferredBackendIds,
    refreshMissionControl
  );

  const { recordPendingThreadLink, recordPendingMissionTarget, openMissionTarget } =
    useSystemNotificationThreadLinks({
      hasLoadedWorkspaces,
      workspacesById,
      refreshWorkspaces,
      connectWorkspace,
      openReviewPack: (request) => openReviewPackRef.current(request),
      setActiveTab,
      setCenterMode,
      setSelectedDiffPath,
      setActiveWorkspaceId,
      setActiveThreadId,
    });

  useMissionControlCompletionNotificationsController({
    systemNotificationsEnabled,
    missionControlProjection,
    getWorkspaceName,
    onThreadNotificationSent: recordPendingThreadLink,
    onMissionNotificationSent: recordPendingMissionTarget,
    onDebug,
  });

  useMissionControlAttentionNotificationsController({
    systemNotificationsEnabled,
    missionControlProjection,
    getWorkspaceName,
    onThreadNotificationSent: recordPendingThreadLink,
    onMissionNotificationSent: recordPendingMissionTarget,
    onDebug,
  });

  useEffect(() => {
    if (!missionControlProjection) {
      previousRunsRef.current = {};
      seenReviewPackIdsRef.current.clear();
      return;
    }

    const tasksById = new Map(missionControlProjection.tasks.map((task) => [task.id, task]));
    const nextRuns: Record<string, RunAnalyticsSnapshot> = {};

    for (const run of missionControlProjection.runs) {
      const backendId = resolveConfirmedPlacementBackendId(run.placement);
      const approvalWaiting = isApprovalWaiting(run);
      const previousRun = previousRunsRef.current[run.id];
      const task = tasksById.get(run.taskId) ?? null;

      if (backendId && previousRun?.backendId !== backendId) {
        void trackProductAnalyticsEvent("placement_confirmed", {
          workspaceId: run.workspaceId,
          taskId: run.taskId,
          runId: run.id,
          executionProfileId: run.executionProfile?.id ?? null,
          backendId,
          runState: run.state,
          eventSource: "mission_control",
          isFallbackPlacement: isFallbackPlacement(run.placement),
        });
      }

      if (approvalWaiting && !previousRun?.approvalWaiting) {
        void trackProductAnalyticsEvent("approval_wait_started", {
          workspaceId: run.workspaceId,
          taskId: run.taskId,
          runId: run.id,
          executionProfileId: run.executionProfile?.id ?? null,
          backendId,
          runState: run.state,
          approvalStatus: run.approval?.status ?? null,
          eventSource: "mission_control",
        });
      }

      nextRuns[run.id] = {
        backendId,
        approvalWaiting,
      };

      if (task?.latestRunId === run.id && task.latestRunState !== run.state) {
        nextRuns[run.id].approvalWaiting = approvalWaiting;
      }
    }

    for (const reviewPack of missionControlProjection.reviewPacks) {
      if (seenReviewPackIdsRef.current.has(reviewPack.id)) {
        continue;
      }
      seenReviewPackIdsRef.current.add(reviewPack.id);
      const run = missionControlProjection.runs.find(
        (candidate) => candidate.id === reviewPack.runId
      );
      void trackProductAnalyticsEvent("review_pack_ready", {
        workspaceId: reviewPack.workspaceId,
        taskId: reviewPack.taskId,
        runId: reviewPack.runId,
        reviewPackId: reviewPack.id,
        executionProfileId: run?.executionProfile?.id ?? null,
        backendId:
          resolveConfirmedPlacementBackendId(reviewPack.placement) ??
          resolveConfirmedPlacementBackendId(run?.placement),
        runState: run?.state ?? null,
        reviewStatus: reviewPack.reviewStatus,
        eventSource: "mission_control",
      });
    }

    previousRunsRef.current = nextRuns;
  }, [missionControlProjection]);

  const onReviewPackControllerReady = useCallback(
    (openReviewPack: (request: ReviewPackSelectionRequest) => void) => {
      openReviewPackRef.current = openReviewPack;
    },
    []
  );

  return {
    autoDriveState,
    openMissionTarget,
    onReviewPackControllerReady,
    onThreadNotificationSent: recordPendingThreadLink,
  };
}
