import type { MutableRefObject } from "react";
import type { AppSettings, CustomPromptOption, WorkspaceInfo } from "../../../types";
import { useCollaborationModeSelection } from "../../collaboration/hooks/useCollaborationModeSelection";
import { useCopyThread } from "../../threads/hooks/useCopyThread";
import { useRenameThreadPrompt } from "../../threads/hooks/useRenameThreadPrompt";
import { useThreadAtlasParams } from "../../threads/hooks/useThreadAtlasParams";
import { useThreadCodexControls } from "../hooks/useThreadCodexControls";
import { useThreadCodexParams } from "../../threads/hooks/useThreadCodexParams";
import { useThreadLiveSubscription } from "../../threads/hooks/useThreadLiveSubscription";
import { useThreads } from "../../threads/hooks/useThreads";
import type { PendingNewThreadSeed } from "../../threads/utils/threadCodexParamsSeed";
import { useMainAppAccountControls } from "../hooks/useMainAppAccountControls";
import { useMainAppAtlasControls } from "../hooks/useMainAppAtlasControls";
import { useMainAppShellBootstrap } from "../hooks/useMainAppShellBootstrap";
import { useNewAgentDraft } from "../hooks/useNewAgentDraft";
import { useResponseRequiredNotificationsController } from "../hooks/useResponseRequiredNotificationsController";
import { useThreadCodexSync } from "../hooks/useThreadCodexSync";
import { useThreadListActions } from "../hooks/useThreadListActions";
import { useThreadListSortKey } from "../hooks/useThreadListSortKey";
import { useThreadRows } from "../hooks/useThreadRows";
import { useWorkspaceUsageRefresh } from "../hooks/useWorkspaceUsageRefresh";
import { resolveVisibleActiveItems } from "../utils/visibleActiveItems";

type MainAppBootstrapState = ReturnType<typeof useMainAppShellBootstrap>;
type ThreadCodexState = ReturnType<typeof useThreadCodexControls>;
type ThreadAtlasParamsState = ReturnType<typeof useThreadAtlasParams>;
type ThreadCodexParamsState = ReturnType<typeof useThreadCodexParams>;
type ThreadListSortState = ReturnType<typeof useThreadListSortKey>;

type UseDesktopWorkspaceThreadDomainOptions = {
  activeWorkspace: WorkspaceInfo | null;
  activeWorkspaceId: string | null;
  workspaces: WorkspaceInfo[];
  hasLoaded: boolean;
  markWorkspaceConnected: MainAppBootstrapState["workspaceState"]["markWorkspaceConnected"];
  appSettings: AppSettings;
  debugState: MainAppBootstrapState["debugState"];
  getWorkspaceName: MainAppBootstrapState["getWorkspaceName"];
  threadCodexWorkspaceContext: MainAppBootstrapState["threadCodexWorkspaceContext"];
  queueGitStatusRefresh: MainAppBootstrapState["gitPanelState"]["queueGitStatusRefresh"];
  alertError: MainAppBootstrapState["gitBranchState"]["alertError"];
  threadCodexState: ThreadCodexState;
  threadCodexParamsVersion: ThreadCodexParamsState["version"];
  getThreadCodexParams: ThreadCodexParamsState["getThreadCodexParams"];
  patchThreadCodexParams: ThreadCodexParamsState["patchThreadCodexParams"];
  getThreadAtlasParams: ThreadAtlasParamsState["getThreadAtlasParams"];
  getThreadAtlasMemoryDigest: ThreadAtlasParamsState["getThreadAtlasMemoryDigest"];
  patchThreadAtlasParams: ThreadAtlasParamsState["patchThreadAtlasParams"];
  upsertThreadAtlasMemoryDigest: ThreadAtlasParamsState["upsertThreadAtlasMemoryDigest"];
  threadListSortKey: ThreadListSortState["threadListSortKey"];
  setThreadListSortKey: ThreadListSortState["setThreadListSortKey"];
  prompts: CustomPromptOption[];
  activeThreadIdRef: MutableRefObject<string | null>;
  pendingNewThreadSeedRef: MutableRefObject<PendingNewThreadSeed | null>;
};

export function useDesktopWorkspaceThreadDomain({
  activeWorkspace,
  activeWorkspaceId,
  workspaces,
  hasLoaded,
  markWorkspaceConnected,
  appSettings,
  debugState,
  getWorkspaceName,
  threadCodexWorkspaceContext,
  queueGitStatusRefresh,
  alertError,
  threadCodexState,
  threadCodexParamsVersion,
  getThreadCodexParams,
  patchThreadCodexParams,
  getThreadAtlasParams,
  getThreadAtlasMemoryDigest,
  patchThreadAtlasParams,
  upsertThreadAtlasMemoryDigest,
  threadListSortKey,
  setThreadListSortKey,
  prompts,
  activeThreadIdRef,
  pendingNewThreadSeedRef,
}: UseDesktopWorkspaceThreadDomainOptions) {
  const { collaborationModePayload } = useCollaborationModeSelection({
    selectedCollaborationMode: threadCodexState.selectedCollaborationMode,
    selectedCollaborationModeId: threadCodexState.selectedCollaborationModeId,
  });

  const resolveThreadAtlasDriverOrder = (workspaceId: string, threadId: string) =>
    getThreadAtlasParams(workspaceId, threadId)?.driverOrder ?? null;
  const resolveThreadAtlasEnabled = (workspaceId: string, threadId: string) =>
    getThreadAtlasParams(workspaceId, threadId)?.enabled !== false;
  const resolveThreadAtlasDetailLevel = (workspaceId: string, threadId: string) =>
    getThreadAtlasParams(workspaceId, threadId)?.detailLevel ?? "balanced";

  const threadsState = useThreads({
    activeWorkspace,
    onWorkspaceConnected: markWorkspaceConnected,
    onDebug: debugState.addDebugEntry,
    hasAvailableModel: threadCodexState.hasAvailableModel,
    model: threadCodexState.resolvedModel,
    effort: threadCodexState.resolvedEffort,
    fastMode: threadCodexState.fastModeEnabled,
    collaborationMode: collaborationModePayload,
    accessMode: threadCodexState.accessMode,
    executionMode: threadCodexState.executionMode,
    missionMode: threadCodexState.missionMode,
    executionProfileId: threadCodexState.executionProfileId,
    preferredBackendIds: threadCodexState.preferredBackendIds,
    defaultCodexBin: appSettings.codexBin,
    defaultCodexArgs: appSettings.codexArgs,
    reviewDeliveryMode: appSettings.reviewDeliveryMode,
    steerEnabled: appSettings.steerEnabled,
    threadTitleAutogenerationEnabled: appSettings.threadTitleAutogenerationEnabled,
    customPrompts: prompts,
    onMessageActivity: queueGitStatusRefresh,
    threadSortKey: threadListSortKey,
    getAtlasDriverOrder: resolveThreadAtlasDriverOrder,
    getAtlasEnabled: resolveThreadAtlasEnabled,
    getAtlasDetailLevel: resolveThreadAtlasDetailLevel,
    getAtlasLongTermMemoryDigest: getThreadAtlasMemoryDigest,
    upsertThreadAtlasMemoryDigest,
  });

  const {
    activeThreadId,
    activeItems,
    hasPendingDraftUserMessages,
    approvals,
    userInputRequests,
    threadsByWorkspace,
    threadParentById,
    threadStatusById,
    threadListLoadingByWorkspace,
    activeTurnIdByThread,
    tokenUsageByThread,
    rateLimitsByWorkspace,
    accountByWorkspace,
    planByThread,
    lastAgentMessageByThread,
    renameThread,
    listThreadsForWorkspace,
    resetWorkspaceThreads,
    refreshThread,
    refreshAccountInfo,
    refreshAccountRateLimits,
    refreshAccountRateLimitsBatch,
  } = threadsState;

  const atlasControls = useMainAppAtlasControls({
    activeWorkspaceId,
    activeThreadId,
    resolveThreadAtlasDriverOrder,
    resolveThreadAtlasEnabled,
    resolveThreadAtlasDetailLevel,
    getThreadAtlasMemoryDigest,
    patchThreadAtlasParams,
  });

  const threadLiveConnectionState = useThreadLiveSubscription({
    activeWorkspace,
    activeThreadId,
    activeTurnId: activeThreadId ? (activeTurnIdByThread[activeThreadId] ?? null) : null,
    isThreadProcessing: activeThreadId
      ? (threadStatusById[activeThreadId]?.isProcessing ?? false)
      : false,
    refreshThread,
    listThreadsForWorkspace,
    onDebug: debugState.addDebugEntry,
  });

  useThreadCodexSync({
    activeThreadId,
    activeThreadIdRef,
    activeWorkspaceId,
    appDefaultAccessMode: appSettings.defaultAccessMode,
    lastComposerModelId: appSettings.lastComposerModelId,
    lastComposerReasoningEffort: appSettings.lastComposerReasoningEffort,
    lastComposerFastMode: appSettings.lastComposerFastMode,
    lastComposerExecutionMode: appSettings.lastComposerExecutionMode,
    threadCodexParamsVersion,
    getThreadCodexParams,
    patchThreadCodexParams,
    pendingNewThreadSeedRef,
    ...threadCodexState,
  });

  const { handleSetThreadListSortKey, handleRefreshAllWorkspaceThreads } = useThreadListActions({
    threadListSortKey,
    setThreadListSortKey,
    workspaces,
    listThreadsForWorkspace,
    resetWorkspaceThreads,
  });

  useResponseRequiredNotificationsController({
    systemNotificationsEnabled: appSettings.systemNotificationsEnabled,
    approvals,
    userInputRequests,
    getWorkspaceName,
    onDebug: debugState.addDebugEntry,
  });

  const accountControls = useMainAppAccountControls({
    activeWorkspaceId,
    fallbackWorkspaceId: threadCodexWorkspaceContext?.id ?? null,
    accountByWorkspace,
    refreshAccountInfo,
    refreshAccountRateLimits,
    alertError,
  });

  const usageRefresh = useWorkspaceUsageRefresh({
    activeWorkspaceId,
    hasLoaded,
    workspaces,
    refreshAccountInfo,
    refreshAccountRateLimitsBatch,
  });

  const draftState = useNewAgentDraft({
    activeWorkspace,
    activeWorkspaceId,
    activeThreadId,
  });

  const visibleActiveItems = resolveVisibleActiveItems({
    activeItems,
    activeThreadId,
    isNewAgentDraftMode: draftState.isDraftModeForActiveWorkspace,
  });

  const { getThreadRows } = useThreadRows(threadParentById);
  const { handleCopyThread } = useCopyThread({
    activeItems: visibleActiveItems,
    onDebug: debugState.addDebugEntry,
  });
  const renamePromptState = useRenameThreadPrompt({
    threadsByWorkspace,
    renameThread,
  });

  return {
    threadsState,
    activeThreadId,
    approvals,
    userInputRequests,
    threadListLoadingByWorkspace,
    activeTurnIdByThread,
    tokenUsageByThread,
    rateLimitsByWorkspace,
    planByThread,
    lastAgentMessageByThread,
    threadsByWorkspace,
    threadStatusById,
    activeItems,
    hasPendingDraftUserMessages,
    visibleActiveItems,
    listThreadsForWorkspace,
    resetWorkspaceThreads,
    refreshThread,
    refreshAccountInfo,
    refreshAccountRateLimits,
    handleSetThreadListSortKey,
    handleRefreshAllWorkspaceThreads,
    accountControls,
    usageRefresh,
    draftState,
    atlasControls,
    threadLiveConnectionState,
    getThreadRows,
    handleCopyThread,
    renamePromptState,
  };
}
