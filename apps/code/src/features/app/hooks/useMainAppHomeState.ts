import type { MissionControlSnapshotState } from "@ku0/code-workspace-client";
import { getMissionControlSnapshotStore } from "@ku0/code-workspace-client";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRuntimeDistributedTaskGraphSupport } from "../../../application/runtime/facades/useRuntimeDistributedTaskGraphSupport";
import { useRuntimeKernel } from "../../../application/runtime/kernel/RuntimeKernelContext";
import type { RateLimitSnapshot, ThreadTokenUsage, TurnPlan, WorkspaceInfo } from "../../../types";
import { useLocalUsage } from "../../home/hooks/useLocalUsage";
import type {
  MissionControlFreshnessState,
  MissionLatestRunEntry,
} from "@ku0/code-application/runtimeMissionControlSurfaceModel";
import { buildLatestMissionRunsFromProjection } from "@ku0/code-application/runtimeMissionControlSurfaceModel";
import type { AppTab } from "../../shell/types/shellRoute";
import type { ThreadStatusSummary } from "../../threads/utils/threadExecutionState";

type ThreadSummary = {
  id: string;
  name: string;
  updatedAt: number;
};

type AgentMessageSummary = {
  text: string;
  timestamp: number;
};

type UseMainAppHomeStateParams = {
  activeWorkspace: WorkspaceInfo | null;
  activeWorkspaceId: string | null;
  hasWorkspaceRouteSelection: boolean;
  showMissionHomeRoute: boolean;
  activeThreadId: string | null;
  startingDraftThreadWorkspaceId: string | null;
  hasPendingDraftUserMessages: boolean;
  hasLoaded: boolean;
  isCompact: boolean;
  isNewAgentDraftMode: boolean;
  activeTab: AppTab;
  centerMode: "chat" | "diff";
  getWorkspaceGroupName: (workspaceId: string) => string | null;
  workspaces: WorkspaceInfo[];
  workspacesById: Map<string, WorkspaceInfo>;
  threadsByWorkspace: Record<string, ThreadSummary[]>;
  threadListLoadingByWorkspace: Record<string, boolean>;
  lastAgentMessageByThread: Record<string, AgentMessageSummary | undefined>;
  threadStatusById: Record<string, ThreadStatusSummary | undefined>;
  rateLimitsByWorkspace: Record<string, RateLimitSnapshot | null | undefined>;
  tokenUsageByThread: Record<string, ThreadTokenUsage | undefined>;
  planByThread: Record<string, TurnPlan | null | undefined>;
};

const RECENT_THREAD_LIMIT = 8;
type UsageMetric = "tokens" | "time";

type LatestAgentRun = MissionLatestRunEntry;

const EMPTY_MISSION_CONTROL_STATE: MissionControlSnapshotState = {
  snapshot: null,
  loadState: "idle",
  error: null,
};

export function useMainAppHomeState({
  activeWorkspaceId,
  hasWorkspaceRouteSelection,
  showMissionHomeRoute,
  activeThreadId,
  startingDraftThreadWorkspaceId,
  hasPendingDraftUserMessages,
  hasLoaded,
  isCompact,
  activeTab,
  getWorkspaceGroupName,
  workspaces,
  workspacesById,
  threadsByWorkspace,
  threadListLoadingByWorkspace,
  threadStatusById,
  rateLimitsByWorkspace,
  tokenUsageByThread,
  planByThread,
}: UseMainAppHomeStateParams) {
  const runtimeKernel = useRuntimeKernel();
  const missionControlStore = useMemo(
    () => getMissionControlSnapshotStore(runtimeKernel.workspaceClientRuntime),
    [runtimeKernel.workspaceClientRuntime]
  );
  const hasMissionControlContext = workspaces.length > 0;
  const missionControlState = useSyncExternalStore(
    hasMissionControlContext ? missionControlStore.subscribe : () => () => {},
    hasMissionControlContext ? missionControlStore.getSnapshot : () => EMPTY_MISSION_CONTROL_STATE,
    hasMissionControlContext ? missionControlStore.getSnapshot : () => EMPTY_MISSION_CONTROL_STATE
  );
  const missionControlProjection = hasMissionControlContext ? missionControlState.snapshot : null;
  const lastMissionControlUpdatedAt = missionControlProjection?.generatedAt ?? null;
  const isLoadingMissionControl =
    hasMissionControlContext && missionControlState.loadState === "loading";
  const missionControlFreshness = useMemo<MissionControlFreshnessState>(() => {
    if (!hasMissionControlContext) {
      return {
        status: "idle",
        isStale: false,
        error: null,
        lastUpdatedAt: null,
      };
    }
    if (missionControlState.loadState === "ready") {
      return {
        status: "ready",
        isStale: false,
        error: null,
        lastUpdatedAt: lastMissionControlUpdatedAt,
      };
    }
    if (missionControlState.loadState === "loading") {
      return {
        status: lastMissionControlUpdatedAt === null ? "loading" : "refreshing",
        isStale: lastMissionControlUpdatedAt !== null,
        error: null,
        lastUpdatedAt: lastMissionControlUpdatedAt,
      };
    }
    if (missionControlState.loadState === "error") {
      return {
        status: "error",
        isStale: lastMissionControlUpdatedAt !== null,
        error: missionControlState.error,
        lastUpdatedAt: lastMissionControlUpdatedAt,
      };
    }
    return {
      status: "idle",
      isStale: false,
      error: null,
      lastUpdatedAt: lastMissionControlUpdatedAt,
    };
  }, [
    hasMissionControlContext,
    lastMissionControlUpdatedAt,
    missionControlState.error,
    missionControlState.loadState,
  ]);

  const refreshMissionControl = useCallback(async () => {
    if (!hasMissionControlContext) {
      return;
    }
    await missionControlStore.refresh();
  }, [hasMissionControlContext, missionControlStore]);

  const runtimeTasks: [] = [];

  const latestAgentRuns = useMemo(() => {
    if (!missionControlProjection) {
      return [] as LatestAgentRun[];
    }
    return buildLatestMissionRunsFromProjection(missionControlProjection, {
      getWorkspaceGroupName,
      limit: 3,
    });
  }, [getWorkspaceGroupName, missionControlProjection]);

  const isLoadingLatestAgents = useMemo(
    () =>
      !hasLoaded ||
      workspaces.some((workspace) => threadListLoadingByWorkspace[workspace.id] ?? false) ||
      (isLoadingMissionControl && latestAgentRuns.length === 0),
    [
      hasLoaded,
      isLoadingMissionControl,
      latestAgentRuns.length,
      threadListLoadingByWorkspace,
      workspaces,
    ]
  );

  const activeRateLimits = activeWorkspaceId
    ? (rateLimitsByWorkspace[activeWorkspaceId] ?? null)
    : null;
  const activeTokenUsage = activeThreadId ? (tokenUsageByThread[activeThreadId] ?? null) : null;
  const activePlan = activeThreadId ? (planByThread[activeThreadId] ?? null) : null;
  const distributedTaskGraphSupport = useRuntimeDistributedTaskGraphSupport();
  const distributedPlanSurfaceEnabled = distributedTaskGraphSupport.capabilityEnabled;

  const hasActivePlan =
    activePlan && (activePlan.steps.length > 0 || activePlan.explanation)
      ? true
      : distributedPlanSurfaceEnabled;

  const isStartingDraftThread =
    Boolean(activeWorkspaceId) &&
    !activeThreadId &&
    startingDraftThreadWorkspaceId === activeWorkspaceId;
  const showHome = isCompact
    ? activeTab === "home"
    : showMissionHomeRoute &&
      !activeWorkspaceId &&
      !hasWorkspaceRouteSelection &&
      !isStartingDraftThread &&
      !hasPendingDraftUserMessages;
  const shouldRenderCompactComposer = activeTab === "missions";
  const canRenderComposerForWorkspace =
    Boolean(activeWorkspaceId) || isStartingDraftThread || hasPendingDraftUserMessages;
  const showComposer = !isCompact ? canRenderComposerForWorkspace : shouldRenderCompactComposer;

  const [usageMetric, setUsageMetric] = useState<UsageMetric>("tokens");
  const [usageWorkspaceId, setUsageWorkspaceId] = useState<string | null>(null);

  const usageWorkspaceOptions = useMemo(
    () =>
      workspaces.map((workspace) => {
        const groupName = getWorkspaceGroupName(workspace.id);
        const label = groupName ? `${groupName} / ${workspace.name}` : workspace.name;
        return { id: workspace.id, label };
      }),
    [getWorkspaceGroupName, workspaces]
  );

  const usageWorkspacePath = useMemo(() => {
    if (!usageWorkspaceId) {
      return null;
    }
    return workspacesById.get(usageWorkspaceId)?.path ?? null;
  }, [usageWorkspaceId, workspacesById]);

  useEffect(() => {
    if (!usageWorkspaceId) {
      return;
    }
    if (workspaces.some((workspace) => workspace.id === usageWorkspaceId)) {
      return;
    }
    setUsageWorkspaceId(null);
  }, [usageWorkspaceId, workspaces]);

  const {
    snapshot: localUsageSnapshot,
    isLoading: isLoadingLocalUsage,
    error: localUsageError,
    refresh: refreshLocalUsage,
  } = useLocalUsage(showHome, usageWorkspacePath);

  const canInterrupt = activeThreadId
    ? (threadStatusById[activeThreadId]?.isProcessing ?? false)
    : false;

  const { recentThreadInstances, recentThreadsUpdatedAt } = useMemo(() => {
    if (!activeWorkspaceId) {
      return { recentThreadInstances: [], recentThreadsUpdatedAt: null };
    }
    const threads = threadsByWorkspace[activeWorkspaceId] ?? [];
    if (threads.length === 0) {
      return { recentThreadInstances: [], recentThreadsUpdatedAt: null };
    }
    const sorted = [...threads].sort((a, b) => b.updatedAt - a.updatedAt);
    const slice = sorted.slice(0, RECENT_THREAD_LIMIT);
    const updatedAt = slice.reduce(
      (max, thread) => (thread.updatedAt > max ? thread.updatedAt : max),
      0
    );
    const instances = slice.map((thread, index) => ({
      id: `recent-${thread.id}`,
      workspaceId: activeWorkspaceId,
      threadId: thread.id,
      modelId: null,
      modelLabel: thread.name?.trim() || "Untitled thread",
      sequence: index + 1,
    }));
    return {
      recentThreadInstances: instances,
      recentThreadsUpdatedAt: updatedAt > 0 ? updatedAt : null,
    };
  }, [activeWorkspaceId, threadsByWorkspace]);

  return {
    runtimeTasks,
    missionControlProjection,
    missionControlFreshness,
    isLoadingMissionControl,
    refreshMissionControl,
    latestAgentRuns,
    isLoadingLatestAgents,
    activeRateLimits,
    activeTokenUsage,
    activePlan,
    hasActivePlan,
    isStartingDraftThread,
    showHome,
    showComposer,
    usageMetric,
    setUsageMetric,
    usageWorkspaceId,
    setUsageWorkspaceId,
    usageWorkspaceOptions,
    localUsageSnapshot,
    isLoadingLocalUsage,
    localUsageError,
    refreshLocalUsage,
    canInterrupt,
    recentThreadInstances,
    recentThreadsUpdatedAt,
  };
}
