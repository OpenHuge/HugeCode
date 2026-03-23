import type { MutableRefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AutoDriveControllerHookDraft } from "../../../application/runtime/types/autoDrive";
import { pickWorkspacePath } from "../../../application/runtime/ports/tauriWorkspaceDialogs";
import type { AppMention, ComposerExecutionMode, WorkspaceInfo } from "../../../types";
import { usePullRequestComposer } from "../../git/hooks/usePullRequestComposer";
import { useWindowDrag } from "../../layout/hooks/useWindowDrag";
import type { AppTab } from "../../shell/types/shellRoute";
import {
  createPendingThreadSeed,
  type PendingNewThreadSeed,
} from "../../threads/utils/threadCodexParamsSeed";
import { useWorkspaceDropZone } from "../../workspaces/hooks/useWorkspaceDropZone";
import { useWorkspaceRefreshOnFocus } from "../../workspaces/hooks/useWorkspaceRefreshOnFocus";
import { useWorkspaceRestore } from "../../workspaces/hooks/useWorkspaceRestore";
import { useAppMenuEvents } from "./useAppMenuEvents";
import { useArchiveShortcut } from "./useArchiveShortcut";
import { useInterruptShortcut } from "./useInterruptShortcut";
import { useMenuAcceleratorController } from "./useMenuAcceleratorController";
import { usePlanReadyActions } from "./usePlanReadyActions";
import { usePromptLibraryActions } from "./usePromptLibraryActions";
import { useRemoteThreadRefreshOnFocus } from "./useRemoteThreadRefreshOnFocus";
import { useWorkspaceActions } from "./useWorkspaceActions";
import { useWorkspaceCycling } from "./useWorkspaceCycling";
import type { CodexSection } from "../../settings/components/settingsTypes";

type PromptLibraryActionsParams = Parameters<typeof usePromptLibraryActions>[0];
type WorkspaceRestoreParams = Parameters<typeof useWorkspaceRestore>[0];
type WorkspaceRefreshOnFocusParams = Parameters<typeof useWorkspaceRefreshOnFocus>[0];
type RemoteThreadRefreshOnFocusParams = Parameters<typeof useRemoteThreadRefreshOnFocus>[0];
type WorkspaceActionsParams = Parameters<typeof useWorkspaceActions>[0];
type PullRequestComposerParams = Parameters<typeof usePullRequestComposer>[0];
type PlanReadyActionsParams = Parameters<typeof usePlanReadyActions>[0];
type WorkspaceCyclingParams = Parameters<typeof useWorkspaceCycling>[0];
type AppMenuEventsParams = Parameters<typeof useAppMenuEvents>[0];
type MenuAcceleratorControllerParams = Parameters<typeof useMenuAcceleratorController>[0];
type AccessMode = Parameters<typeof createPendingThreadSeed>[0]["accessMode"];
type SendUserMessageOptions = {
  model?: string | null;
  effort?: string | null;
  appMentions?: AppMention[];
  collaborationMode?: Record<string, unknown> | null;
};
type SendUserMessageToThread = (
  workspace: WorkspaceInfo,
  threadId: string,
  text: string,
  images?: string[],
  options?: SendUserMessageOptions
) => Promise<void>;

type RenameWorktreePromptState = {
  workspaceId: string;
  name: string;
  originalName: string;
  error: string | null;
  isSubmitting: boolean;
};

type RenameWorktreeUpstreamPromptState = {
  workspaceId: string;
  oldBranch: string;
  newBranch: string;
  error: string | null;
  isSubmitting: boolean;
};

type PendingHomeWorkspaceSubmit = {
  id: string;
  mode: "send" | "queue";
  workspaceId: string;
  text: string;
  images: string[];
  appMentions?: AppMention[];
};

type UseMainAppHandlersParams = {
  activeWorkspace: PullRequestComposerParams["activeWorkspace"];
  activeWorkspaceId: string | null;
  activeThreadId: string | null;
  activeThreadIsProcessing: boolean;
  connectWorkspace: PullRequestComposerParams["connectWorkspace"];
  startThreadForWorkspace: PullRequestComposerParams["startThreadForWorkspace"];
  sendUserMessageToThread: SendUserMessageToThread;
  createPrompt: PromptLibraryActionsParams["createPrompt"];
  updatePrompt: PromptLibraryActionsParams["updatePrompt"];
  deletePrompt: PromptLibraryActionsParams["deletePrompt"];
  movePrompt: PromptLibraryActionsParams["movePrompt"];
  getWorkspacePromptsDir: PromptLibraryActionsParams["getWorkspacePromptsDir"];
  getGlobalPromptsDir: PromptLibraryActionsParams["getGlobalPromptsDir"];
  alertError: PromptLibraryActionsParams["onError"];
  workspacesById: Map<string, WorkspaceInfo>;
  renameWorktreePrompt: RenameWorktreePromptState | null;
  renameWorktreeNotice: string | null;
  renameWorktreeUpstreamPrompt: RenameWorktreeUpstreamPromptState | null;
  confirmRenameWorktreeUpstream: () => Promise<void>;
  handleOpenRenameWorktree: () => void;
  handleRenameWorktreeChange: (value: string) => void;
  handleRenameWorktreeCancel: () => void;
  handleRenameWorktreeConfirm: () => Promise<void>;
  isPhone: boolean;
  setActiveTab: (tab: AppTab) => void;
  workspaces: WorkspaceRestoreParams["workspaces"];
  hasLoaded: WorkspaceRestoreParams["hasLoaded"];
  listThreadsForWorkspace: WorkspaceRestoreParams["listThreadsForWorkspace"];
  refreshWorkspaces: WorkspaceRefreshOnFocusParams["refreshWorkspaces"];
  refreshThread: RemoteThreadRefreshOnFocusParams["refreshThread"];
  appSettings: MenuAcceleratorControllerParams["appSettings"];
  suspendRemoteThreadPolling?: boolean;
  isCompact: WorkspaceActionsParams["isCompact"];
  addWorkspace: WorkspaceActionsParams["addWorkspace"];
  addWorkspaceFromPath: WorkspaceActionsParams["addWorkspaceFromPath"];
  addWorkspacesFromPaths: WorkspaceActionsParams["addWorkspacesFromPaths"];
  setActiveThreadId: WorkspaceActionsParams["setActiveThreadId"];
  exitDiffView: WorkspaceActionsParams["exitDiffView"];
  selectWorkspace: WorkspaceActionsParams["selectWorkspace"];
  startNewAgentDraft: WorkspaceActionsParams["onStartNewAgentDraft"];
  openWorktreePrompt: WorkspaceActionsParams["openWorktreePrompt"];
  openClonePrompt: WorkspaceActionsParams["openClonePrompt"];
  composerInputRef: WorkspaceActionsParams["composerInputRef"];
  addDebugEntry: WorkspaceActionsParams["onDebug"];
  removeThread: (workspaceId: string, threadId: string) => void;
  clearDraftForThread: (threadId: string) => void;
  removeImagesForThread: (threadId: string) => void;
  canInterrupt: boolean;
  interruptTurn: () => Promise<void> | void;
  selectedPullRequest: PullRequestComposerParams["selectedPullRequest"];
  gitPullRequestDiffs: PullRequestComposerParams["gitPullRequestDiffs"];
  filePanelMode: PullRequestComposerParams["filePanelMode"];
  gitPanelMode: PullRequestComposerParams["gitPanelMode"];
  centerMode: PullRequestComposerParams["centerMode"];
  setSelectedPullRequest: PullRequestComposerParams["setSelectedPullRequest"];
  setDiffSource: PullRequestComposerParams["setDiffSource"];
  setSelectedDiffPath: PullRequestComposerParams["setSelectedDiffPath"];
  setCenterMode: PullRequestComposerParams["setCenterMode"];
  setGitPanelMode: PullRequestComposerParams["setGitPanelMode"];
  setPrefillDraft: PullRequestComposerParams["setPrefillDraft"];
  clearActiveImages: PullRequestComposerParams["clearActiveImages"];
  handleSend: PullRequestComposerParams["handleSend"];
  queueMessage: PullRequestComposerParams["queueMessage"];
  pendingNewThreadSeedRef: MutableRefObject<PendingNewThreadSeed | null>;
  pendingNewThreadAutoDriveDraftRef: MutableRefObject<AutoDriveControllerHookDraft | null>;
  selectedCollaborationModeId: string | null;
  accessMode: AccessMode;
  executionMode: ComposerExecutionMode;
  fastModeEnabled: boolean;
  runWithDraftStart: (runner: () => Promise<void>) => Promise<void>;
  clearDraftState: () => void;
  collaborationModes: PlanReadyActionsParams["collaborationModes"];
  setSelectedCollaborationModeId: PlanReadyActionsParams["setSelectedCollaborationModeId"];
  showComposer: boolean;
  selectedDiffPath: string | null;
  groupedWorkspaces: WorkspaceCyclingParams["groupedWorkspaces"];
  threadsByWorkspace: WorkspaceCyclingParams["threadsByWorkspace"];
  getThreadRows: WorkspaceCyclingParams["getThreadRows"];
  getPinTimestamp: WorkspaceCyclingParams["getPinTimestamp"];
  activeWorkspaceIdRef: WorkspaceCyclingParams["activeWorkspaceIdRef"];
  activeThreadIdRef: WorkspaceCyclingParams["activeThreadIdRef"];
  activeWorkspaceRef: AppMenuEventsParams["activeWorkspaceRef"];
  openSettings: (section?: CodexSection) => void;
  handleDebugClick: () => void;
  handleToggleTerminal: () => void;
  sidebarCollapsed: AppMenuEventsParams["sidebarCollapsed"];
  rightPanelCollapsed: AppMenuEventsParams["rightPanelCollapsed"];
  expandSidebar: AppMenuEventsParams["onExpandSidebar"];
  collapseSidebar: AppMenuEventsParams["onCollapseSidebar"];
  expandRightPanel: AppMenuEventsParams["onExpandRightPanel"];
  collapseRightPanel: AppMenuEventsParams["onCollapseRightPanel"];
  updateWorkspaceSettings: (
    workspaceId: string,
    settings: {
      sortOrder?: number;
    }
  ) => Promise<unknown>;
};

export function useMainAppHandlers({
  activeWorkspace,
  activeWorkspaceId,
  activeThreadId,
  activeThreadIsProcessing,
  connectWorkspace,
  startThreadForWorkspace,
  sendUserMessageToThread,
  createPrompt,
  updatePrompt,
  deletePrompt,
  movePrompt,
  getWorkspacePromptsDir,
  getGlobalPromptsDir,
  alertError,
  workspacesById,
  renameWorktreePrompt,
  renameWorktreeNotice,
  renameWorktreeUpstreamPrompt,
  confirmRenameWorktreeUpstream,
  handleOpenRenameWorktree,
  handleRenameWorktreeChange,
  handleRenameWorktreeCancel,
  handleRenameWorktreeConfirm,
  isPhone,
  setActiveTab,
  workspaces,
  hasLoaded,
  listThreadsForWorkspace,
  refreshWorkspaces,
  refreshThread,
  appSettings,
  suspendRemoteThreadPolling = false,
  isCompact,
  addWorkspace,
  addWorkspaceFromPath,
  addWorkspacesFromPaths,
  setActiveThreadId,
  exitDiffView,
  selectWorkspace,
  startNewAgentDraft,
  openWorktreePrompt,
  openClonePrompt,
  composerInputRef,
  addDebugEntry,
  removeThread,
  clearDraftForThread,
  removeImagesForThread,
  canInterrupt,
  interruptTurn,
  selectedPullRequest,
  gitPullRequestDiffs,
  filePanelMode,
  gitPanelMode,
  centerMode,
  setSelectedPullRequest,
  setDiffSource,
  setSelectedDiffPath,
  setCenterMode,
  setGitPanelMode,
  setPrefillDraft,
  clearActiveImages,
  handleSend,
  queueMessage,
  pendingNewThreadSeedRef,
  pendingNewThreadAutoDriveDraftRef,
  selectedCollaborationModeId,
  accessMode,
  executionMode,
  fastModeEnabled,
  runWithDraftStart,
  clearDraftState,
  collaborationModes,
  setSelectedCollaborationModeId,
  showComposer,
  selectedDiffPath,
  groupedWorkspaces,
  threadsByWorkspace,
  getThreadRows,
  getPinTimestamp,
  activeWorkspaceIdRef,
  activeThreadIdRef,
  activeWorkspaceRef,
  openSettings,
  handleDebugClick,
  handleToggleTerminal,
  sidebarCollapsed,
  rightPanelCollapsed,
  expandSidebar,
  collapseSidebar,
  expandRightPanel,
  collapseRightPanel,
  updateWorkspaceSettings,
}: UseMainAppHandlersParams) {
  const [pendingHomeWorkspaceSubmits, setPendingHomeWorkspaceSubmits] = useState<
    PendingHomeWorkspaceSubmit[]
  >([]);
  const activePendingHomeWorkspaceSubmitRef = useRef<string | null>(null);

  const handleSendPromptToNewAgent = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!activeWorkspace || !trimmed) {
        return;
      }
      if (!activeWorkspace.connected) {
        await connectWorkspace(activeWorkspace);
      }
      const threadId = await startThreadForWorkspace(activeWorkspace.id, {
        activate: false,
      });
      if (!threadId) {
        return;
      }
      await sendUserMessageToThread(activeWorkspace, threadId, trimmed, []);
    },
    [activeWorkspace, connectWorkspace, sendUserMessageToThread, startThreadForWorkspace]
  );

  const {
    handleCreatePrompt,
    handleUpdatePrompt,
    handleDeletePrompt,
    handleMovePrompt,
    handleRevealWorkspacePrompts,
    handleRevealGeneralPrompts,
  } = usePromptLibraryActions({
    createPrompt,
    updatePrompt,
    deletePrompt,
    movePrompt,
    getWorkspacePromptsDir,
    getGlobalPromptsDir,
    onError: alertError,
  });

  const isWorktreeWorkspace = activeWorkspace?.kind === "worktree";
  const activeParentWorkspace = isWorktreeWorkspace
    ? (workspacesById.get(activeWorkspace?.parentId ?? "") ?? null)
    : null;
  const worktreeLabel = isWorktreeWorkspace
    ? ((activeWorkspace?.name?.trim() || activeWorkspace?.worktree?.branch) ?? null)
    : null;
  const activeRenamePrompt =
    renameWorktreePrompt?.workspaceId === activeWorkspace?.id ? renameWorktreePrompt : null;
  const worktreeRename =
    isWorktreeWorkspace && activeWorkspace
      ? {
          name: activeRenamePrompt?.name ?? worktreeLabel ?? "",
          error: activeRenamePrompt?.error ?? null,
          notice: renameWorktreeNotice,
          isSubmitting: activeRenamePrompt?.isSubmitting ?? false,
          isDirty: activeRenamePrompt
            ? activeRenamePrompt.name.trim() !== activeRenamePrompt.originalName.trim()
            : false,
          upstream:
            renameWorktreeUpstreamPrompt?.workspaceId === activeWorkspace.id
              ? {
                  oldBranch: renameWorktreeUpstreamPrompt.oldBranch,
                  newBranch: renameWorktreeUpstreamPrompt.newBranch,
                  error: renameWorktreeUpstreamPrompt.error,
                  isSubmitting: renameWorktreeUpstreamPrompt.isSubmitting,
                  onConfirm: confirmRenameWorktreeUpstream,
                }
              : null,
          onFocus: handleOpenRenameWorktree,
          onChange: handleRenameWorktreeChange,
          onCancel: handleRenameWorktreeCancel,
          onCommit: handleRenameWorktreeConfirm,
        }
      : null;
  const baseWorkspaceRef = useRef(activeParentWorkspace ?? activeWorkspace);

  useEffect(() => {
    baseWorkspaceRef.current = activeParentWorkspace ?? activeWorkspace;
  }, [activeParentWorkspace, activeWorkspace]);

  useWindowDrag("titlebar");
  useWorkspaceRestore({
    workspaces,
    hasLoaded,
    connectWorkspace,
    listThreadsForWorkspace,
  });
  useWorkspaceRefreshOnFocus({
    workspaces,
    refreshWorkspaces,
    listThreadsForWorkspace,
  });

  useRemoteThreadRefreshOnFocus({
    backendMode: appSettings.backendMode,
    activeWorkspace,
    activeThreadId,
    activeThreadIsProcessing,
    suspendPolling: suspendRemoteThreadPolling,
    reconnectWorkspace: connectWorkspace,
    refreshThread,
  });

  const {
    handleAddWorkspace,
    handleAddWorkspaceFromPath,
    handleAddWorkspacesFromPaths,
    handleAddAgent,
    handleAddWorktreeAgent,
    handleAddCloneAgent,
  } = useWorkspaceActions({
    isCompact,
    addWorkspace,
    addWorkspaceFromPath,
    addWorkspacesFromPaths,
    setActiveThreadId,
    setActiveTab,
    exitDiffView,
    selectWorkspace,
    onStartNewAgentDraft: startNewAgentDraft,
    openWorktreePrompt,
    openClonePrompt,
    composerInputRef,
    onDebug: addDebugEntry,
  });

  const handleOpenProject = useCallback(async () => {
    const selectedPath = await pickWorkspacePath();
    if (!selectedPath) {
      return;
    }
    await handleAddWorkspaceFromPath(selectedPath);
  }, [handleAddWorkspaceFromPath]);

  const handleDropWorkspacePaths = useCallback(
    async (paths: string[]) => {
      const uniquePaths = Array.from(new Set(paths.filter((path) => path.length > 0)));
      if (uniquePaths.length === 0) {
        return;
      }
      void handleAddWorkspacesFromPaths(uniquePaths);
    },
    [handleAddWorkspacesFromPaths]
  );

  const {
    dropTargetRef: workspaceDropTargetRef,
    isDragOver: isWorkspaceDropActive,
    handleDragOver: handleWorkspaceDragOver,
    handleDragEnter: handleWorkspaceDragEnter,
    handleDragLeave: handleWorkspaceDragLeave,
    handleDrop: handleWorkspaceDrop,
  } = useWorkspaceDropZone({
    onDropPaths: handleDropWorkspacePaths,
  });

  const handleArchiveActiveThread = useCallback(() => {
    if (!activeWorkspaceId || !activeThreadId) {
      return;
    }
    removeThread(activeWorkspaceId, activeThreadId);
    clearDraftForThread(activeThreadId);
    removeImagesForThread(activeThreadId);
  }, [activeThreadId, activeWorkspaceId, clearDraftForThread, removeImagesForThread, removeThread]);

  useInterruptShortcut({
    isEnabled: canInterrupt,
    shortcut: appSettings.interruptShortcut,
    onTrigger: () => {
      void interruptTurn();
    },
  });

  const {
    handleSelectPullRequest,
    resetPullRequestSelection,
    composerSendLabel,
    handleComposerSend,
    handleComposerQueue,
  } = usePullRequestComposer({
    activeWorkspace,
    selectedPullRequest,
    gitPullRequestDiffs,
    filePanelMode,
    gitPanelMode,
    centerMode,
    isCompact,
    setSelectedPullRequest,
    setDiffSource,
    setSelectedDiffPath,
    setCenterMode,
    setGitPanelMode,
    setPrefillDraft,
    setActiveTab,
    connectWorkspace,
    startThreadForWorkspace,
    sendUserMessageToThread,
    clearActiveImages,
    handleSend,
    queueMessage,
  });
  const latestComposerSendRef = useRef(handleComposerSend);
  const latestComposerQueueRef = useRef(handleComposerQueue);
  latestComposerSendRef.current = handleComposerSend;
  latestComposerQueueRef.current = handleComposerQueue;

  const rememberPendingNewThreadSeed = useCallback(() => {
    pendingNewThreadSeedRef.current = createPendingThreadSeed({
      activeThreadId: activeThreadId ?? null,
      activeWorkspaceId: activeWorkspaceId ?? null,
      selectedCollaborationModeId,
      accessMode,
      executionMode,
      fastMode: fastModeEnabled,
      autoDriveDraft: pendingNewThreadAutoDriveDraftRef.current,
    });
  }, [
    accessMode,
    activeThreadId,
    activeWorkspaceId,
    executionMode,
    fastModeEnabled,
    pendingNewThreadAutoDriveDraftRef,
    selectedCollaborationModeId,
    pendingNewThreadSeedRef,
  ]);

  const handleComposerSendWithDraftStart = useCallback(
    (text: string, images: string[], appMentions?: AppMention[]) => {
      if (isCompact) {
        setActiveTab("missions");
      }
      rememberPendingNewThreadSeed();
      return runWithDraftStart(async () => {
        if (appMentions && appMentions.length > 0) {
          await latestComposerSendRef.current(text, images, appMentions);
          return;
        }
        await latestComposerSendRef.current(text, images);
      }).catch((error) => {
        clearDraftState();
        alertError(error);
      });
    },
    [
      alertError,
      clearDraftState,
      isCompact,
      rememberPendingNewThreadSeed,
      runWithDraftStart,
      setActiveTab,
    ]
  );
  const handleComposerQueueWithDraftStart = useCallback(
    (text: string, images: string[], appMentions?: AppMention[]) => {
      if (isCompact) {
        setActiveTab("missions");
      }
      // Queueing without an active thread would no-op; bootstrap through send so user input is not lost.
      const runner = activeThreadId
        ? async () => {
            if (appMentions && appMentions.length > 0) {
              await latestComposerQueueRef.current(text, images, appMentions);
              return;
            }
            await latestComposerQueueRef.current(text, images);
          }
        : async () => {
            if (appMentions && appMentions.length > 0) {
              await latestComposerSendRef.current(text, images, appMentions);
              return;
            }
            await latestComposerSendRef.current(text, images);
          };
      if (!activeThreadId) {
        rememberPendingNewThreadSeed();
      }
      return runWithDraftStart(runner).catch((error) => {
        clearDraftState();
        alertError(error);
      });
    },
    [
      activeThreadId,
      alertError,
      clearDraftState,
      rememberPendingNewThreadSeed,
      runWithDraftStart,
      isCompact,
      setActiveTab,
    ]
  );

  const handleSendPromptToWorkspace = useCallback(
    (workspaceId: string, text: string, images: string[], appMentions?: AppMention[]) => {
      const trimmed = text.trim();
      if (!trimmed && images.length === 0) {
        return;
      }
      if (!workspacesById.has(workspaceId)) {
        return;
      }
      if (isCompact) {
        setActiveTab("missions");
      }
      exitDiffView();
      resetPullRequestSelection();
      setPendingHomeWorkspaceSubmits((current) => [
        ...current,
        {
          id: `home-workspace-submit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          mode: "send",
          workspaceId,
          text: trimmed,
          images: [...images],
          appMentions,
        },
      ]);
      selectWorkspace(workspaceId);
    },
    [
      exitDiffView,
      isCompact,
      resetPullRequestSelection,
      selectWorkspace,
      setActiveTab,
      workspacesById,
    ]
  );

  const handleComposerQueueToWorkspace = useCallback(
    (workspaceId: string, text: string, images: string[], appMentions?: AppMention[]) => {
      const trimmed = text.trim();
      if (!trimmed && images.length === 0) {
        return;
      }
      if (!workspacesById.has(workspaceId)) {
        return;
      }
      if (isCompact) {
        setActiveTab("missions");
      }
      exitDiffView();
      resetPullRequestSelection();
      setPendingHomeWorkspaceSubmits((current) => [
        ...current,
        {
          id: `home-workspace-submit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          mode: "queue",
          workspaceId,
          text: trimmed,
          images: [...images],
          appMentions,
        },
      ]);
      selectWorkspace(workspaceId);
    },
    [
      exitDiffView,
      isCompact,
      resetPullRequestSelection,
      selectWorkspace,
      setActiveTab,
      workspacesById,
    ]
  );

  useEffect(() => {
    const nextSubmit = pendingHomeWorkspaceSubmits[0] ?? null;
    if (!nextSubmit) {
      activePendingHomeWorkspaceSubmitRef.current = null;
      return;
    }
    if (activeWorkspaceId !== nextSubmit.workspaceId) {
      selectWorkspace(nextSubmit.workspaceId);
      return;
    }
    if (activePendingHomeWorkspaceSubmitRef.current === nextSubmit.id) {
      return;
    }
    activePendingHomeWorkspaceSubmitRef.current = nextSubmit.id;
    const run =
      nextSubmit.mode === "queue"
        ? () =>
            handleComposerQueueWithDraftStart(
              nextSubmit.text,
              nextSubmit.images,
              nextSubmit.appMentions
            )
        : () =>
            handleComposerSendWithDraftStart(
              nextSubmit.text,
              nextSubmit.images,
              nextSubmit.appMentions
            );
    void Promise.resolve(run())
      .catch((error) => {
        clearDraftState();
        alertError(error);
      })
      .finally(() => {
        setPendingHomeWorkspaceSubmits((current) => {
          if (current[0]?.id === nextSubmit.id) {
            return current.slice(1);
          }
          return current.filter((entry) => entry.id !== nextSubmit.id);
        });
        if (activePendingHomeWorkspaceSubmitRef.current === nextSubmit.id) {
          activePendingHomeWorkspaceSubmitRef.current = null;
        }
      });
  }, [
    activeWorkspaceId,
    alertError,
    clearDraftState,
    handleComposerQueueWithDraftStart,
    handleComposerSendWithDraftStart,
    pendingHomeWorkspaceSubmits,
    selectWorkspace,
  ]);

  const handleSelectWorkspaceInstance = useCallback(
    (workspaceId: string, threadId: string) => {
      exitDiffView();
      resetPullRequestSelection();
      clearDraftState();
      selectWorkspace(workspaceId);
      setActiveThreadId(threadId, workspaceId);
      if (isCompact) {
        setActiveTab("missions");
      }
    },
    [
      clearDraftState,
      exitDiffView,
      isCompact,
      resetPullRequestSelection,
      selectWorkspace,
      setActiveThreadId,
      setActiveTab,
    ]
  );

  const handleOpenThreadLink = useCallback(
    (threadId: string) => {
      if (!activeWorkspaceId) {
        return;
      }
      exitDiffView();
      resetPullRequestSelection();
      clearDraftState();
      setActiveThreadId(threadId, activeWorkspaceId);
    },
    [activeWorkspaceId, clearDraftState, exitDiffView, resetPullRequestSelection, setActiveThreadId]
  );

  const { handlePlanAccept, handlePlanSubmitChanges } = usePlanReadyActions({
    activeWorkspace,
    activeThreadId,
    collaborationModes,
    connectWorkspace,
    sendUserMessageToThread,
    setSelectedCollaborationModeId,
  });

  const handleMoveWorkspace = useCallback(
    async (workspaceId: string, direction: "up" | "down") => {
      const target = workspacesById.get(workspaceId);
      if (!target || (target.kind ?? "main") === "worktree") {
        return;
      }
      const targetGroupId = target.settings.groupId ?? null;
      const ordered = workspaces
        .filter(
          (entry) =>
            (entry.kind ?? "main") !== "worktree" &&
            (entry.settings.groupId ?? null) === targetGroupId
        )
        .slice()
        .sort((a, b) => {
          const orderA =
            typeof a.settings.sortOrder === "number"
              ? a.settings.sortOrder
              : Number.MAX_SAFE_INTEGER;
          const orderB =
            typeof b.settings.sortOrder === "number"
              ? b.settings.sortOrder
              : Number.MAX_SAFE_INTEGER;
          const orderDiff = orderA - orderB;
          if (orderDiff !== 0) {
            return orderDiff;
          }
          return a.name.localeCompare(b.name);
        });
      const index = ordered.findIndex((entry) => entry.id === workspaceId);
      if (index === -1) {
        return;
      }
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= ordered.length) {
        return;
      }
      const next = ordered.slice();
      const temp = next[index];
      next[index] = next[nextIndex];
      next[nextIndex] = temp;
      await Promise.all(
        next.map((entry, idx) =>
          updateWorkspaceSettings(entry.id, {
            sortOrder: idx,
          })
        )
      );
    },
    [updateWorkspaceSettings, workspaces, workspacesById]
  );

  const showGitDetail = Boolean(selectedDiffPath) && isPhone && centerMode === "diff";
  const isThreadOpen = Boolean(activeThreadId && showComposer);

  useArchiveShortcut({
    isEnabled: isThreadOpen,
    shortcut: appSettings.archiveThreadShortcut,
    onTrigger: handleArchiveActiveThread,
  });

  const { handleCycleAgent, handleCycleWorkspace } = useWorkspaceCycling({
    workspaces,
    groupedWorkspaces,
    threadsByWorkspace,
    getThreadRows,
    getPinTimestamp,
    activeWorkspaceIdRef,
    activeThreadIdRef,
    exitDiffView,
    resetPullRequestSelection,
    selectWorkspace,
    setActiveThreadId,
  });

  useAppMenuEvents({
    activeWorkspaceRef,
    baseWorkspaceRef,
    onAddWorkspace: () => {
      void handleAddWorkspace();
    },
    onAddAgent: (workspace) => {
      void handleAddAgent(workspace);
    },
    onAddWorktreeAgent: (workspace) => {
      void handleAddWorktreeAgent(workspace);
    },
    onAddCloneAgent: (workspace) => {
      void handleAddCloneAgent(workspace);
    },
    onOpenSettings: (section) => openSettings(section),
    onCycleAgent: handleCycleAgent,
    onCycleWorkspace: handleCycleWorkspace,
    onToggleDebug: handleDebugClick,
    onToggleTerminal: handleToggleTerminal,
    sidebarCollapsed,
    rightPanelCollapsed,
    onExpandSidebar: expandSidebar,
    onCollapseSidebar: collapseSidebar,
    onExpandRightPanel: expandRightPanel,
    onCollapseRightPanel: collapseRightPanel,
  });

  useMenuAcceleratorController({ appSettings, onDebug: addDebugEntry });

  return useMemo(
    () => ({
      handleSendPromptToNewAgent,
      handleCreatePrompt,
      handleUpdatePrompt,
      handleDeletePrompt,
      handleMovePrompt,
      handleRevealWorkspacePrompts,
      handleRevealGeneralPrompts,
      isWorktreeWorkspace,
      activeParentWorkspace,
      worktreeLabel,
      worktreeRename,
      handleAddWorkspace,
      handleAddAgent,
      handleAddWorktreeAgent,
      handleAddCloneAgent,
      handleOpenProject,
      workspaceDropTargetRef,
      isWorkspaceDropActive,
      handleWorkspaceDragOver,
      handleWorkspaceDragEnter,
      handleWorkspaceDragLeave,
      handleWorkspaceDrop,
      handleSelectPullRequest,
      resetPullRequestSelection,
      composerSendLabel,
      handleComposerSendWithDraftStart,
      handleComposerQueueWithDraftStart,
      handleComposerSendToWorkspace: handleSendPromptToWorkspace,
      handleComposerQueueToWorkspace,
      handleSelectWorkspaceInstance,
      handleOpenThreadLink,
      handlePlanAccept,
      handlePlanSubmitChanges,
      handleMoveWorkspace,
      showGitDetail,
    }),
    [
      activeParentWorkspace,
      composerSendLabel,
      handleAddAgent,
      handleAddCloneAgent,
      handleAddWorkspace,
      handleAddWorktreeAgent,
      handleComposerQueueWithDraftStart,
      handleComposerQueueToWorkspace,
      handleComposerSendWithDraftStart,
      handleSendPromptToWorkspace,
      handleCreatePrompt,
      handleDeletePrompt,
      handleMovePrompt,
      handleMoveWorkspace,
      handleOpenProject,
      handleOpenThreadLink,
      handlePlanAccept,
      handlePlanSubmitChanges,
      handleRevealGeneralPrompts,
      handleRevealWorkspacePrompts,
      handleSelectPullRequest,
      handleSelectWorkspaceInstance,
      handleSendPromptToNewAgent,
      handleUpdatePrompt,
      handleWorkspaceDragEnter,
      handleWorkspaceDragLeave,
      handleWorkspaceDragOver,
      handleWorkspaceDrop,
      isWorktreeWorkspace,
      isWorkspaceDropActive,
      resetPullRequestSelection,
      showGitDetail,
      workspaceDropTargetRef,
      worktreeLabel,
      worktreeRename,
    ]
  );
}
