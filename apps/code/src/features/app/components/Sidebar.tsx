import { Icon } from "../../../design-system";
import Copy from "lucide-react/dist/esm/icons/copy";
import FolderOpen from "lucide-react/dist/esm/icons/folder-open";
import GitBranch from "lucide-react/dist/esm/icons/git-branch";
import Plus from "lucide-react/dist/esm/icons/plus";
import ServerCog from "lucide-react/dist/esm/icons/server-cog";
import X from "lucide-react/dist/esm/icons/x";
import {
  Fragment,
  memo,
  type DragEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { PopoverMenuItem, PopoverSurface } from "../../../design-system";
import type { MissionControlProjection } from "../../../application/runtime/facades/runtimeMissionControlFacade";
import { pushErrorToast } from "../../../application/runtime/ports/toasts";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import type {
  AccountSnapshot,
  RateLimitSnapshot,
  ThreadListSortKey,
  ThreadSummary,
  WorkspaceInfo,
} from "../../../types";
import { formatRelativeTimeShort } from "../../../utils/time";
import type { ThreadStatusSummary } from "../../threads/utils/threadExecutionState";
import type { AccountCenterState } from "../hooks/useAccountCenterState";
import { useCollapsedGroups } from "../hooks/useCollapsedGroups";
import { useDismissibleMenu } from "../hooks/useDismissibleMenu";
import {
  type SidebarWebContextMenuAction,
  type SidebarWebContextMenuPayload,
  useSidebarMenus,
} from "../hooks/useSidebarMenus";
import { useSidebarScrollFade } from "../hooks/useSidebarScrollFade";
import { useThreadRows } from "../hooks/useThreadRows";
import { getUsageLabels } from "../utils/usageLabels";
import {
  buildMissionOverviewItemsFromProjection,
  buildLatestMissionRunsFromProjection,
  type MissionNavigationTarget,
  describeMissionRunRouteDetail,
} from "../../missions/utils/missionControlPresentation";
import { PinnedThreadList } from "./PinnedThreadList";
import { SidebarHeader } from "./SidebarHeader";
import { SidebarMissionQueue } from "./SidebarMissionQueue";
import { SidebarBody, SidebarFooter, SidebarFrame, SidebarSection } from "./SidebarScaffold";
import { SidebarUserNav } from "./SidebarUserNav";
import { ThreadList } from "./ThreadList";
import { ThreadLoading } from "./ThreadLoading";
import { WorkspaceCard } from "./WorkspaceCard";
import { WorkspaceGroup } from "./WorkspaceGroup";
import { WorktreeSection } from "./WorktreeSection";
import * as emptyStateStyles from "./SidebarEmptyState.css";
import type { CodexSection } from "../../settings/components/settingsTypes";

const COLLAPSED_GROUPS_STORAGE_KEY = "codexmonitor.collapsedGroups";
const UNGROUPED_COLLAPSE_ID = "__ungrouped__";
const ADD_MENU_WIDTH = 200;
const CONTEXT_MENU_WIDTH = 220;
const CONTEXT_MENU_ITEM_HEIGHT = 32;
const CONTEXT_MENU_PADDING = 8;
const WORKSPACE_REORDER_DATA_KEY = "application/x-hugecode-workspace-id";

type SidebarContextMenuState = {
  title: string;
  actions: SidebarWebContextMenuAction[];
  top: number;
  left: number;
};

type WorkspaceGroupSection = {
  id: string | null;
  name: string;
  workspaces: WorkspaceInfo[];
};

type SidebarProps = {
  workspaces: WorkspaceInfo[];
  groupedWorkspaces: WorkspaceGroupSection[];
  hasLoadedWorkspaces?: boolean;
  workspaceLoadError?: string | null;
  missionControlProjection?: MissionControlProjection | null;
  hasWorkspaceGroups: boolean;
  deletingWorktreeIds: Set<string>;
  newAgentDraftWorkspaceId?: string | null;
  startingDraftThreadWorkspaceId?: string | null;
  threadsByWorkspace: Record<string, ThreadSummary[]>;
  threadParentById: Record<string, string>;
  threadStatusById: Record<string, ThreadStatusSummary>;
  threadListLoadingByWorkspace: Record<string, boolean>;
  threadListPagingByWorkspace: Record<string, boolean>;
  threadListCursorByWorkspace: Record<string, string | null>;
  threadListSortKey: ThreadListSortKey;
  onSetThreadListSortKey: (sortKey: ThreadListSortKey) => void;
  onRefreshAllThreads: () => void;
  activeWorkspaceId: string | null;
  activeThreadId: string | null;
  accountRateLimits: RateLimitSnapshot | null;
  usageShowRemaining: boolean;
  accountInfo: AccountSnapshot | null;
  onRefreshCurrentUsage: () => void;
  onRefreshAllUsage: () => void;
  canRefreshCurrentUsage: boolean;
  canRefreshAllUsage: boolean;
  currentUsageRefreshLoading: boolean;
  allUsageRefreshLoading: boolean;
  onSwitchAccount: () => void;
  onSelectLoggedInCodexAccount: (accountId: string) => Promise<void>;
  onCancelSwitchAccount: () => void;
  accountSwitching: boolean;
  accountSwitchError: string | null;
  accountCenter: AccountCenterState;
  onOpenSettings: (section?: CodexSection) => void;
  onOpenDebug: () => void;
  showDebugButton: boolean;
  onSelectHome: () => void;
  onCollapseSidebar?: (() => void) | undefined;
  onAddWorkspace: () => void;
  onSelectWorkspace: (id: string) => void;
  onConnectWorkspace: (workspace: WorkspaceInfo) => void;
  onAddAgent: (workspace: WorkspaceInfo) => void;
  onAddWorktreeAgent: (workspace: WorkspaceInfo) => void;
  onAddCloneAgent: (workspace: WorkspaceInfo) => void;
  onToggleWorkspaceCollapse: (workspaceId: string, collapsed: boolean) => void;
  onReorderWorkspace: (
    sourceWorkspaceId: string,
    targetWorkspaceId: string,
    position: "before" | "after"
  ) => void | Promise<void>;
  onSelectThread: (workspaceId: string, threadId: string) => void;
  onDeleteThread: (workspaceId: string, threadId: string) => void;
  onSyncThread: (workspaceId: string, threadId: string) => void;
  onOpenMissionTarget?: (target: MissionNavigationTarget) => void;
  pinThread: (workspaceId: string, threadId: string) => boolean;
  unpinThread: (workspaceId: string, threadId: string) => void;
  isThreadPinned: (workspaceId: string, threadId: string) => boolean;
  getPinTimestamp: (workspaceId: string, threadId: string) => number | null;
  onRenameThread: (workspaceId: string, threadId: string) => void;
  onDeleteWorkspace: (workspaceId: string) => void;
  onDeleteWorktree: (workspaceId: string) => void;
  onLoadOlderThreads: (workspaceId: string) => void;
  onReloadWorkspaceThreads: (workspaceId: string) => void;
  workspaceDropTargetRef: RefObject<HTMLElement | null>;
  isWorkspaceDropActive: boolean;
  workspaceDropText: string;
  onWorkspaceDragOver: (event: React.DragEvent<HTMLElement>) => void;
  onWorkspaceDragEnter: (event: React.DragEvent<HTMLElement>) => void;
  onWorkspaceDragLeave: (event: React.DragEvent<HTMLElement>) => void;
  onWorkspaceDrop: (event: React.DragEvent<HTMLElement>) => void;
};

export const Sidebar = memo(function Sidebar({
  workspaces,
  groupedWorkspaces,
  hasLoadedWorkspaces = true,
  workspaceLoadError = null,
  missionControlProjection = null,
  hasWorkspaceGroups,
  deletingWorktreeIds,
  newAgentDraftWorkspaceId = null,
  startingDraftThreadWorkspaceId = null,
  threadsByWorkspace,
  threadParentById,
  threadStatusById,
  threadListLoadingByWorkspace,
  threadListPagingByWorkspace,
  threadListCursorByWorkspace,
  threadListSortKey,
  onSetThreadListSortKey,
  onRefreshAllThreads,
  activeWorkspaceId,
  activeThreadId,
  accountRateLimits,
  usageShowRemaining,
  accountInfo,
  onSwitchAccount,
  onSelectLoggedInCodexAccount,
  onCancelSwitchAccount,
  accountSwitching,
  accountSwitchError,
  accountCenter: _accountCenter,
  onOpenSettings,
  onOpenDebug,
  showDebugButton,
  onSelectHome,
  onCollapseSidebar,
  onAddWorkspace,
  onSelectWorkspace,
  onConnectWorkspace,
  onAddAgent,
  onAddWorktreeAgent,
  onAddCloneAgent,
  onToggleWorkspaceCollapse,
  onReorderWorkspace,
  onSelectThread,
  onDeleteThread,
  onSyncThread,
  onOpenMissionTarget,
  pinThread,
  unpinThread,
  isThreadPinned,
  getPinTimestamp,
  onRenameThread,
  onDeleteWorkspace,
  onDeleteWorktree,
  onLoadOlderThreads,
  onReloadWorkspaceThreads,
  workspaceDropTargetRef,
  isWorkspaceDropActive,
  workspaceDropText,
  onWorkspaceDragOver,
  onWorkspaceDragEnter,
  onWorkspaceDragLeave,
  onWorkspaceDrop,
}: SidebarProps) {
  const runtimeUnavailable =
    workspaceLoadError !== null &&
    /runtime unavailable|code runtime is unavailable/i.test(workspaceLoadError);
  const headerPrimaryAction = runtimeUnavailable
    ? {
        label: "Open runtime settings",
        title: "Open runtime settings",
        onClick: () => onOpenSettings(),
        icon: <Icon icon={ServerCog} size={16} />,
      }
    : workspaceLoadError
      ? {
          label: "Open project settings",
          title: "Open project settings",
          onClick: () => onOpenSettings(),
          icon: <Icon icon={ServerCog} size={16} />,
        }
      : {
          label: "New project",
          title: "New project",
          onClick: onAddWorkspace,
          icon: <Icon icon={Plus} size={16} />,
        };
  const emptyState = runtimeUnavailable
    ? {
        kicker: "Runtime offline",
        title: "Connect the runtime",
        body: "Desktop runtime or the web gateway is unavailable, so projects cannot load yet.",
        cta: "Open settings",
        icon: ServerCog,
        action: () => onOpenSettings(),
        ariaLabel: "Open settings to connect runtime.",
      }
    : workspaceLoadError
      ? {
          kicker: "Connection issue",
          title: "Could not load projects",
          body: workspaceLoadError,
          cta: "Open settings",
          icon: ServerCog,
          action: () => onOpenSettings(),
          ariaLabel: "Open settings after project load failure.",
        }
      : {
          kicker: "Start here",
          title: "Add a workspace",
          body: "Connect a repo or local folder to unlock threads, diffs, and runtime tools.",
          cta: "Choose a project",
          icon: FolderOpen,
          action: onAddWorkspace,
          ariaLabel: "Add a workspace to start.",
        };

  const [expandedWorkspaces, setExpandedWorkspaces] = useState(new Set<string>());
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [draggedWorkspaceId, setDraggedWorkspaceId] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<{
    workspaceId: string;
    position: "before" | "after";
  } | null>(null);
  const [addMenuAnchor, setAddMenuAnchor] = useState<{
    workspaceId: string;
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [contextMenuState, setContextMenuState] = useState<SidebarContextMenuState | null>(null);
  const addMenuRef = useRef<HTMLDivElement | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const { collapsedGroups, toggleGroupCollapse } = useCollapsedGroups(COLLAPSED_GROUPS_STORAGE_KEY);
  const { getThreadRows } = useThreadRows(threadParentById);
  const handleOpenWebContextMenu = useCallback(
    ({ title, actions, x, y }: SidebarWebContextMenuPayload) => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const menuHeight =
        CONTEXT_MENU_PADDING * 2 + Math.max(actions.length, 1) * CONTEXT_MENU_ITEM_HEIGHT;
      const left = Math.min(Math.max(x, 8), Math.max(8, viewportWidth - CONTEXT_MENU_WIDTH - 8));
      const top = Math.min(Math.max(y, 8), Math.max(8, viewportHeight - menuHeight - 8));

      setAddMenuAnchor(null);
      setContextMenuState({ title, actions, left, top });
    },
    []
  );

  const { showThreadMenu, showWorkspaceMenu, showWorktreeMenu } = useSidebarMenus({
    onDeleteThread,
    onSyncThread,
    onPinThread: pinThread,
    onUnpinThread: unpinThread,
    isThreadPinned,
    onRenameThread,
    onReloadWorkspaceThreads,
    onDeleteWorkspace,
    onDeleteWorktree,
    onOpenWebContextMenu: handleOpenWebContextMenu,
  });
  const {
    usageTitle,
    sessionLabel,
    weeklyLabel,
    sessionPercent,
    weeklyPercent,
    sessionResetLabel,
    weeklyResetLabel,
    creditsLabel,
  } = getUsageLabels(accountRateLimits, usageShowRemaining);
  const debouncedQuery = useDebouncedValue(searchQuery, 150);
  const normalizedQuery = debouncedQuery.trim().toLowerCase();
  const isSearchActive = Boolean(normalizedQuery);

  const worktreesByParent = useMemo(() => {
    const worktrees = new Map<string, WorkspaceInfo[]>();
    workspaces
      .filter((entry) => (entry.kind ?? "main") === "worktree" && entry.parentId)
      .forEach((entry) => {
        const parentId = entry.parentId as string;
        const list = worktrees.get(parentId) ?? [];
        list.push(entry);
        worktrees.set(parentId, list);
      });
    worktrees.forEach((entries) => {
      entries.sort((a, b) => a.name.localeCompare(b.name));
    });
    return worktrees;
  }, [workspaces]);

  const workspaceNameMatchesById = useMemo(() => {
    const matches = new Map<string, boolean>();
    workspaces.forEach((workspace) => {
      matches.set(
        workspace.id,
        !normalizedQuery || workspace.name.toLowerCase().includes(normalizedQuery)
      );
    });
    return matches;
  }, [normalizedQuery, workspaces]);

  const matchingThreadIdsByWorkspace = useMemo(() => {
    const matches = new Map<string, Set<string>>();
    if (!normalizedQuery) {
      return matches;
    }
    workspaces.forEach((workspace) => {
      const matchingThreads = (threadsByWorkspace[workspace.id] ?? []).filter((thread) =>
        thread.name.toLowerCase().includes(normalizedQuery)
      );
      if (matchingThreads.length === 0) {
        return;
      }
      matches.set(workspace.id, new Set(matchingThreads.map((thread) => thread.id)));
    });
    return matches;
  }, [normalizedQuery, threadsByWorkspace, workspaces]);

  const isWorkspaceNameMatch = useCallback(
    (workspace: WorkspaceInfo) => workspaceNameMatchesById.get(workspace.id) ?? true,
    [workspaceNameMatchesById]
  );

  const hasMatchingThreadIds = useCallback(
    (workspaceId: string) => (matchingThreadIdsByWorkspace.get(workspaceId)?.size ?? 0) > 0,
    [matchingThreadIdsByWorkspace]
  );

  const renderHighlightedText = useCallback(
    (text: string) => {
      if (!normalizedQuery) {
        return text;
      }
      const lower = text.toLowerCase();
      const parts: React.ReactNode[] = [];
      let cursor = 0;
      let matchIndex = lower.indexOf(normalizedQuery, cursor);

      while (matchIndex !== -1) {
        if (matchIndex > cursor) {
          parts.push(text.slice(cursor, matchIndex));
        }
        parts.push(
          <span key={`${matchIndex}-${cursor}`} className="workspace-name-match">
            {text.slice(matchIndex, matchIndex + normalizedQuery.length)}
          </span>
        );
        cursor = matchIndex + normalizedQuery.length;
        matchIndex = lower.indexOf(normalizedQuery, cursor);
      }

      if (cursor < text.length) {
        parts.push(text.slice(cursor));
      }

      return parts.length ? parts : text;
    },
    [normalizedQuery]
  );

  const runtimeManagedMissionItemsByWorkspace = useMemo(() => {
    const itemsByWorkspace = new Map<
      string,
      ReturnType<typeof buildMissionOverviewItemsFromProjection>
    >();
    if (!missionControlProjection) {
      return itemsByWorkspace;
    }

    workspaces.forEach((workspace) => {
      const missionItems = buildMissionOverviewItemsFromProjection(missionControlProjection, {
        workspaceId: workspace.id,
        activeThreadId,
        limit: missionControlProjection.tasks.length,
      }).filter((item) => item.navigationTarget.kind !== "thread");

      if (missionItems.length > 0) {
        itemsByWorkspace.set(workspace.id, missionItems);
      }
    });

    return itemsByWorkspace;
  }, [activeThreadId, missionControlProjection, workspaces]);

  const matchingMissionItemsByWorkspace = useMemo(() => {
    const matches = new Map<string, ReturnType<typeof buildMissionOverviewItemsFromProjection>>();
    if (!normalizedQuery) {
      return matches;
    }

    runtimeManagedMissionItemsByWorkspace.forEach((items, workspaceId) => {
      const matchingItems = items.filter((item) =>
        [
          item.title,
          item.summary,
          item.operatorSignal,
          item.governanceSummary,
          item.routeDetail,
          item.operatorActionLabel,
          item.operatorActionDetail,
          item.attentionSignals.join(" "),
        ]
          .filter((value): value is string => Boolean(value))
          .some((value) => value.toLowerCase().includes(normalizedQuery))
      );

      if (matchingItems.length > 0) {
        matches.set(workspaceId, matchingItems);
      }
    });

    return matches;
  }, [normalizedQuery, runtimeManagedMissionItemsByWorkspace]);

  const hasMatchingMissionItems = useCallback(
    (workspaceId: string) => (matchingMissionItemsByWorkspace.get(workspaceId)?.length ?? 0) > 0,
    [matchingMissionItemsByWorkspace]
  );

  const isWorkspaceSelfVisible = useCallback(
    (workspace: WorkspaceInfo) =>
      !isSearchActive ||
      isWorkspaceNameMatch(workspace) ||
      hasMatchingThreadIds(workspace.id) ||
      hasMatchingMissionItems(workspace.id),
    [hasMatchingMissionItems, hasMatchingThreadIds, isSearchActive, isWorkspaceNameMatch]
  );

  const isRootWorkspaceVisible = useCallback(
    (workspace: WorkspaceInfo) => {
      if (isWorkspaceSelfVisible(workspace)) {
        return true;
      }
      const worktrees = worktreesByParent.get(workspace.id) ?? [];
      return worktrees.some((worktree) => isWorkspaceSelfVisible(worktree));
    },
    [isWorkspaceSelfVisible, worktreesByParent]
  );

  const missionThreadDetailsById = useMemo(() => {
    if (!missionControlProjection) {
      return new Map<string, { statusLabel: string; routeDetail: string | null }>();
    }
    return new Map(
      buildLatestMissionRunsFromProjection(missionControlProjection, {
        getWorkspaceGroupName: () => null,
        limit: missionControlProjection.tasks.length,
      }).map((entry) => [
        entry.threadId,
        {
          statusLabel: entry.statusLabel,
          routeDetail: describeMissionRunRouteDetail(missionControlProjection, entry.runId),
        },
      ])
    );
  }, [missionControlProjection]);

  const renderThreadSubline = useCallback(
    (thread: ThreadSummary) => {
      const details = missionThreadDetailsById.get(thread.id);
      if (!details) {
        return null;
      }
      return (
        <>
          <span className="thread-secondary-meta">{details.statusLabel}</span>
          {details.routeDetail ? (
            <>
              <span className="thread-secondary-separator" aria-hidden>
                ·
              </span>
              <span className="thread-secondary-meta">{details.routeDetail}</span>
            </>
          ) : null}
        </>
      );
    },
    [missionThreadDetailsById]
  );

  // const accountEmail = ... (removed)

  const refreshDisabled =
    workspaces.length === 0 || workspaces.every((workspace) => !workspace.connected);
  const refreshInProgress = workspaces.some(
    (workspace) => threadListLoadingByWorkspace[workspace.id] ?? false
  );

  const pinnedThreadRows = useMemo(() => {
    type ThreadRow = { thread: ThreadSummary; depth: number };
    const groups: Array<{
      pinTime: number;
      workspaceId: string;
      rows: ThreadRow[];
    }> = [];

    workspaces.forEach((workspace) => {
      if (!isWorkspaceSelfVisible(workspace)) {
        return;
      }
      const threads = threadsByWorkspace[workspace.id] ?? [];
      if (!threads.length) {
        return;
      }
      const matchingThreadIds = isWorkspaceNameMatch(workspace)
        ? null
        : (matchingThreadIdsByWorkspace.get(workspace.id) ?? null);
      const { pinnedRows } = getThreadRows(threads, true, workspace.id, getPinTimestamp, {
        matchingThreadIds,
      });
      if (!pinnedRows.length) {
        return;
      }
      let currentRows: ThreadRow[] = [];
      let currentPinTime: number | null = null;

      pinnedRows.forEach((row) => {
        if (row.depth === 0) {
          if (currentRows.length && currentPinTime !== null) {
            groups.push({
              pinTime: currentPinTime,
              workspaceId: workspace.id,
              rows: currentRows,
            });
          }
          currentRows = [row];
          currentPinTime = getPinTimestamp(workspace.id, row.thread.id);
        } else {
          currentRows.push(row);
        }
      });

      if (currentRows.length && currentPinTime !== null) {
        groups.push({
          pinTime: currentPinTime,
          workspaceId: workspace.id,
          rows: currentRows,
        });
      }
    });

    return groups
      .sort((a, b) => a.pinTime - b.pinTime)
      .flatMap((group) =>
        group.rows.map((row) => ({
          ...row,
          workspaceId: group.workspaceId,
        }))
      );
  }, [
    getPinTimestamp,
    getThreadRows,
    isWorkspaceNameMatch,
    isWorkspaceSelfVisible,
    matchingThreadIdsByWorkspace,
    threadsByWorkspace,
    workspaces,
  ]);

  const scrollFadeDeps = useMemo(
    () => [groupedWorkspaces, threadsByWorkspace, expandedWorkspaces, normalizedQuery],
    [groupedWorkspaces, threadsByWorkspace, expandedWorkspaces, normalizedQuery]
  );
  const { sidebarBodyRef, scrollFade, updateScrollFade } = useSidebarScrollFade(scrollFadeDeps);

  const filteredGroupedWorkspaces = useMemo(
    () =>
      groupedWorkspaces
        .map((group) => ({
          ...group,
          workspaces: group.workspaces.filter(isRootWorkspaceVisible),
        }))
        .filter((group) => group.workspaces.length > 0),
    [groupedWorkspaces, isRootWorkspaceVisible]
  );

  const workspaceGroupIdById = useMemo(() => {
    const mapping = new Map<string, string | null>();
    groupedWorkspaces.forEach((group) => {
      group.workspaces.forEach((workspace) => {
        mapping.set(workspace.id, group.id ?? null);
      });
    });
    return mapping;
  }, [groupedWorkspaces]);

  const canReorderWorkspacePair = useCallback(
    (sourceWorkspaceId: string, targetWorkspaceId: string) => {
      if (!sourceWorkspaceId || !targetWorkspaceId || sourceWorkspaceId === targetWorkspaceId) {
        return false;
      }
      return (
        workspaceGroupIdById.get(sourceWorkspaceId) === workspaceGroupIdById.get(targetWorkspaceId)
      );
    },
    [workspaceGroupIdById]
  );

  const clearWorkspaceDragState = useCallback(() => {
    setDraggedWorkspaceId(null);
    setDragTarget(null);
  }, []);

  const handleWorkspaceDragStart = useCallback(
    (event: DragEvent<HTMLElement>, workspaceId: string) => {
      if (isSearchActive) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(WORKSPACE_REORDER_DATA_KEY, workspaceId);
      setDraggedWorkspaceId(workspaceId);
      setDragTarget(null);
    },
    [isSearchActive]
  );

  const handleWorkspaceDragOver = useCallback(
    (event: DragEvent<HTMLElement>, workspaceId: string) => {
      if (isSearchActive) {
        return;
      }
      const sourceWorkspaceId =
        draggedWorkspaceId || event.dataTransfer.getData(WORKSPACE_REORDER_DATA_KEY);
      if (!canReorderWorkspacePair(sourceWorkspaceId, workspaceId)) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      const rect = event.currentTarget.getBoundingClientRect();
      const position = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
      setDragTarget((previous) =>
        previous?.workspaceId === workspaceId && previous.position === position
          ? previous
          : { workspaceId, position }
      );
    },
    [canReorderWorkspacePair, draggedWorkspaceId, isSearchActive]
  );

  const handleWorkspaceDragLeave = useCallback(
    (event: DragEvent<HTMLElement>, workspaceId: string, position?: "before" | "after") => {
      const nextTarget = event.relatedTarget;
      if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
        return;
      }
      setDragTarget((previous) => {
        if (!previous || previous.workspaceId !== workspaceId) {
          return previous;
        }
        if (position && previous.position !== position) {
          return previous;
        }
        return null;
      });
    },
    []
  );

  const handleWorkspaceDropTargetDragOver = useCallback(
    (event: DragEvent<HTMLElement>, workspaceId: string, position: "before" | "after") => {
      if (isSearchActive) {
        return;
      }
      const sourceWorkspaceId =
        draggedWorkspaceId || event.dataTransfer.getData(WORKSPACE_REORDER_DATA_KEY);
      if (!canReorderWorkspacePair(sourceWorkspaceId, workspaceId)) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDragTarget((previous) =>
        previous?.workspaceId === workspaceId && previous.position === position
          ? previous
          : { workspaceId, position }
      );
    },
    [canReorderWorkspacePair, draggedWorkspaceId, isSearchActive]
  );

  const handleWorkspaceDrop = useCallback(
    (event: DragEvent<HTMLElement>, targetWorkspaceId: string) => {
      const sourceWorkspaceId =
        draggedWorkspaceId || event.dataTransfer.getData(WORKSPACE_REORDER_DATA_KEY);
      const target = dragTarget;
      clearWorkspaceDragState();
      if (!target || target.workspaceId !== targetWorkspaceId) {
        return;
      }
      if (!canReorderWorkspacePair(sourceWorkspaceId, targetWorkspaceId)) {
        return;
      }
      event.preventDefault();
      void onReorderWorkspace(sourceWorkspaceId, targetWorkspaceId, target.position);
    },
    [
      canReorderWorkspacePair,
      clearWorkspaceDragState,
      dragTarget,
      draggedWorkspaceId,
      onReorderWorkspace,
    ]
  );

  const handleWorkspaceDropOnTarget = useCallback(
    (event: DragEvent<HTMLElement>, targetWorkspaceId: string, position: "before" | "after") => {
      const sourceWorkspaceId =
        draggedWorkspaceId || event.dataTransfer.getData(WORKSPACE_REORDER_DATA_KEY);
      clearWorkspaceDragState();
      if (!canReorderWorkspacePair(sourceWorkspaceId, targetWorkspaceId)) {
        return;
      }
      event.preventDefault();
      void onReorderWorkspace(sourceWorkspaceId, targetWorkspaceId, position);
    },
    [canReorderWorkspacePair, clearWorkspaceDragState, draggedWorkspaceId, onReorderWorkspace]
  );

  const handleToggleExpanded = useCallback((workspaceId: string) => {
    setExpandedWorkspaces((prev) => {
      const next = new Set(prev);
      if (next.has(workspaceId)) {
        next.delete(workspaceId);
      } else {
        next.add(workspaceId);
      }
      return next;
    });
  }, []);

  const getThreadTime = useCallback((thread: ThreadSummary) => {
    const timestamp = thread.updatedAt ?? null;
    return timestamp ? formatRelativeTimeShort(timestamp) : null;
  }, []);

  const runContextMenuAction = useCallback(async (action: SidebarWebContextMenuAction) => {
    setContextMenuState(null);
    try {
      await action.run();
    } catch (error) {
      pushErrorToast({
        title: "Couldn't run menu action",
        message: error instanceof Error ? error.message : "Unexpected sidebar menu error.",
      });
    }
  }, []);

  useDismissibleMenu({
    isOpen: Boolean(addMenuAnchor),
    containerRef: addMenuRef,
    onClose: () => setAddMenuAnchor(null),
  });

  useDismissibleMenu({
    isOpen: Boolean(contextMenuState),
    containerRef: contextMenuRef,
    onClose: () => setContextMenuState(null),
  });

  useEffect(() => {
    if (!addMenuAnchor) {
      return;
    }
    if (addMenuRef.current) {
      addMenuRef.current.style.setProperty("--workspace-add-menu-top", `${addMenuAnchor.top}px`);
      addMenuRef.current.style.setProperty("--workspace-add-menu-left", `${addMenuAnchor.left}px`);
      addMenuRef.current.style.setProperty(
        "--workspace-add-menu-width",
        `${addMenuAnchor.width}px`
      );
    }
    function handleScroll() {
      setAddMenuAnchor(null);
    }
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [addMenuAnchor]);

  useEffect(() => {
    if (!contextMenuState) {
      return;
    }
    if (contextMenuRef.current) {
      contextMenuRef.current.style.setProperty(
        "--sidebar-context-menu-top",
        `${contextMenuState.top}px`
      );
      contextMenuRef.current.style.setProperty(
        "--sidebar-context-menu-left",
        `${contextMenuState.left}px`
      );
    }
    function handleScroll() {
      setContextMenuState(null);
    }
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [contextMenuState]);

  useEffect(() => {
    if (!isSearchOpen && searchQuery) {
      setSearchQuery("");
    }
  }, [isSearchOpen, searchQuery]);

  return (
    <SidebarFrame
      className={`sidebar${isSearchOpen ? " search-open" : ""}`}
      data-sidebar-surface="kanna-card"
      ref={workspaceDropTargetRef}
      onDragOver={onWorkspaceDragOver}
      onDragEnter={onWorkspaceDragEnter}
      onDragLeave={onWorkspaceDragLeave}
      onDrop={onWorkspaceDrop}
    >
      <SidebarHeader
        onSelectHome={onSelectHome}
        onPrimaryAction={headerPrimaryAction.onClick}
        onCollapseSidebar={onCollapseSidebar}
        onToggleSearch={() => setIsSearchOpen((prev) => !prev)}
        isSearchOpen={isSearchOpen}
        threadListSortKey={threadListSortKey}
        onSetThreadListSortKey={onSetThreadListSortKey}
        onRefreshAllThreads={onRefreshAllThreads}
        refreshDisabled={refreshDisabled || refreshInProgress}
        refreshInProgress={refreshInProgress}
        primaryActionLabel={headerPrimaryAction.label}
        primaryActionTitle={headerPrimaryAction.title}
        primaryActionIcon={headerPrimaryAction.icon}
      />
      <div className={`sidebar-search${isSearchOpen ? " is-open" : ""}`}>
        {isSearchOpen && (
          <input
            className="sidebar-search-input"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search projects and threads"
            aria-label="Search projects and threads"
            data-desktop-drag-region="false"
            data-testid="sidebar-search-input"
          />
        )}
        {isSearchOpen && searchQuery.length > 0 && (
          <button
            type="button"
            className="sidebar-search-clear"
            onClick={() => setSearchQuery("")}
            aria-label="Clear search"
            data-desktop-drag-region="false"
            data-testid="sidebar-search-clear"
          >
            <Icon icon={X} size={12} aria-hidden />
          </button>
        )}
      </div>
      <div
        className={`workspace-drop-overlay${isWorkspaceDropActive ? " is-active" : ""}`}
        aria-hidden
      >
        <div
          className={`workspace-drop-overlay-text${
            workspaceDropText === "Adding Project..." ? " is-busy" : ""
          }`}
        >
          {workspaceDropText === "Drop Project Here" && (
            <Icon icon={FolderOpen} className="workspace-drop-overlay-icon" aria-hidden />
          )}
          {workspaceDropText}
        </div>
      </div>
      <SidebarBody
        className={`sidebar-body${scrollFade.top ? " fade-top" : ""}${
          scrollFade.bottom ? " fade-bottom" : ""
        }`}
        onScroll={updateScrollFade}
        ref={sidebarBodyRef}
      >
        <div
          className="workspace-list"
          data-workspace-dragging={draggedWorkspaceId ? "true" : undefined}
        >
          {pinnedThreadRows.length > 0 && (
            <SidebarSection className="pinned-section" section="pinned">
              <div className="workspace-group-header">
                <div className="workspace-group-label">Pinned</div>
              </div>
              <PinnedThreadList
                rows={pinnedThreadRows}
                activeWorkspaceId={activeWorkspaceId}
                activeThreadId={activeThreadId}
                threadStatusById={threadStatusById}
                getThreadTime={getThreadTime}
                isThreadPinned={isThreadPinned}
                onSelectThread={onSelectThread}
                onShowThreadMenu={showThreadMenu}
                onPinThread={pinThread}
                onUnpinThread={unpinThread}
                onArchiveThread={onDeleteThread}
                renderThreadName={(thread) => renderHighlightedText(thread.name)}
                renderThreadSubline={renderThreadSubline}
              />
            </SidebarSection>
          )}
          {filteredGroupedWorkspaces.map((group) => {
            const groupId = group.id;
            const showGroupHeader = Boolean(groupId) || hasWorkspaceGroups;
            const toggleId = groupId ?? (showGroupHeader ? UNGROUPED_COLLAPSE_ID : null);
            const isGroupCollapsed = isSearchActive
              ? false
              : Boolean(toggleId && collapsedGroups.has(toggleId));

            return (
              <WorkspaceGroup
                key={group.id ?? "ungrouped"}
                toggleId={toggleId}
                name={group.name}
                showHeader={showGroupHeader}
                isCollapsed={isGroupCollapsed}
                onToggleCollapse={toggleGroupCollapse}
              >
                {group.workspaces.map((entry, index) => {
                  const threads = threadsByWorkspace[entry.id] ?? [];
                  const isCollapsed = isSearchActive ? false : entry.settings.sidebarCollapsed;
                  const isExpanded = expandedWorkspaces.has(entry.id);
                  const shouldShowEntryThreads = isWorkspaceSelfVisible(entry);
                  const matchingThreadIds = matchingThreadIdsByWorkspace.get(entry.id) ?? null;
                  const searchMatchingThreadIds =
                    isSearchActive && shouldShowEntryThreads && !isWorkspaceNameMatch(entry)
                      ? matchingThreadIds
                      : null;
                  const {
                    pinnedRows,
                    unpinnedRows,
                    totalRoots: totalThreadRoots,
                    hasMoreRoots,
                  } = getThreadRows(threads, isExpanded, entry.id, getPinTimestamp, {
                    matchingThreadIds: searchMatchingThreadIds,
                  });
                  const nextCursor = threadListCursorByWorkspace[entry.id] ?? null;
                  const showThreadList =
                    shouldShowEntryThreads &&
                    (threads.length > 0 || (!isSearchActive && Boolean(nextCursor)));
                  const isLoadingThreads = threadListLoadingByWorkspace[entry.id] ?? false;
                  const showThreadLoader =
                    shouldShowEntryThreads && isLoadingThreads && threads.length === 0;
                  const isPaging = threadListPagingByWorkspace[entry.id] ?? false;
                  const worktrees =
                    isSearchActive && !isWorkspaceNameMatch(entry)
                      ? (worktreesByParent.get(entry.id) ?? []).filter(isWorkspaceSelfVisible)
                      : (worktreesByParent.get(entry.id) ?? []);
                  const runtimeManagedMissionItems =
                    isSearchActive && !isWorkspaceNameMatch(entry)
                      ? (matchingMissionItemsByWorkspace.get(entry.id) ?? [])
                      : (runtimeManagedMissionItemsByWorkspace.get(entry.id) ?? []);
                  const addMenuOpen = addMenuAnchor?.workspaceId === entry.id;
                  const isDraftNewAgent = newAgentDraftWorkspaceId === entry.id;
                  const isDraftRowActive =
                    isDraftNewAgent && entry.id === activeWorkspaceId && !activeThreadId;
                  const draftStatusClass =
                    startingDraftThreadWorkspaceId === entry.id ? "processing" : "ready";

                  return (
                    <Fragment key={entry.id}>
                      <div
                        className="workspace-drop-slot"
                        data-active={
                          dragTarget?.workspaceId === entry.id && dragTarget.position === "before"
                        }
                        data-testid={`workspace-drop-slot-${entry.id}-before`}
                        onDragOver={(event) =>
                          handleWorkspaceDropTargetDragOver(event, entry.id, "before")
                        }
                        onDragLeave={(event) => handleWorkspaceDragLeave(event, entry.id, "before")}
                        onDrop={(event) => handleWorkspaceDropOnTarget(event, entry.id, "before")}
                      />
                      <WorkspaceCard
                        workspace={entry}
                        workspaceName={renderHighlightedText(entry.name)}
                        isActive={entry.id === activeWorkspaceId}
                        isCollapsed={isCollapsed}
                        collapseLocked={isSearchActive}
                        draggable={!isSearchActive}
                        addMenuOpen={addMenuOpen}
                        addMenuWidth={ADD_MENU_WIDTH}
                        isDragging={draggedWorkspaceId === entry.id}
                        dropPosition={
                          dragTarget?.workspaceId === entry.id ? dragTarget.position : null
                        }
                        onDragStart={handleWorkspaceDragStart}
                        onDragOver={handleWorkspaceDragOver}
                        onDragLeave={(event) => handleWorkspaceDragLeave(event, entry.id)}
                        onDrop={handleWorkspaceDrop}
                        onDragEnd={clearWorkspaceDragState}
                        onShowWorkspaceMenu={showWorkspaceMenu}
                        onToggleWorkspaceCollapse={onToggleWorkspaceCollapse}
                        onConnectWorkspace={onConnectWorkspace}
                        onAddAgent={onAddAgent}
                        onToggleAddMenu={setAddMenuAnchor}
                      >
                        {addMenuOpen &&
                          addMenuAnchor &&
                          createPortal(
                            <PopoverSurface className="workspace-add-menu" ref={addMenuRef}>
                              <PopoverMenuItem
                                className="workspace-add-option"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setAddMenuAnchor(null);
                                  onAddAgent(entry);
                                }}
                                icon={<Icon icon={Plus} aria-hidden />}
                              >
                                New agent
                              </PopoverMenuItem>
                              <PopoverMenuItem
                                className="workspace-add-option"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setAddMenuAnchor(null);
                                  onAddWorktreeAgent(entry);
                                }}
                                icon={<Icon icon={GitBranch} aria-hidden />}
                              >
                                New worktree agent
                              </PopoverMenuItem>
                              <PopoverMenuItem
                                className="workspace-add-option"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setAddMenuAnchor(null);
                                  onAddCloneAgent(entry);
                                }}
                                icon={<Icon icon={Copy} aria-hidden />}
                              >
                                New clone agent
                              </PopoverMenuItem>
                            </PopoverSurface>,
                            document.body
                          )}
                        {isDraftNewAgent && (
                          <button
                            type="button"
                            className={`thread-row thread-row-draft${
                              isDraftRowActive ? " active" : ""
                            }`}
                            onClick={() => onSelectWorkspace(entry.id)}
                          >
                            <span className="thread-leading">
                              <span className={`thread-status ${draftStatusClass}`} aria-hidden />
                            </span>
                            <span className="thread-name">New Agent</span>
                          </button>
                        )}
                        {runtimeManagedMissionItems.length > 0 && onOpenMissionTarget ? (
                          <SidebarMissionQueue
                            items={runtimeManagedMissionItems.slice(0, 3)}
                            renderMissionTitle={renderHighlightedText}
                            onOpenMissionTarget={onOpenMissionTarget}
                          />
                        ) : null}
                        {worktrees.length > 0 && (
                          <WorktreeSection
                            worktrees={worktrees}
                            deletingWorktreeIds={deletingWorktreeIds}
                            threadsByWorkspace={threadsByWorkspace}
                            threadStatusById={threadStatusById}
                            threadListLoadingByWorkspace={threadListLoadingByWorkspace}
                            threadListPagingByWorkspace={threadListPagingByWorkspace}
                            threadListCursorByWorkspace={threadListCursorByWorkspace}
                            expandedWorkspaces={expandedWorkspaces}
                            activeWorkspaceId={activeWorkspaceId}
                            activeThreadId={activeThreadId}
                            getThreadRows={getThreadRows}
                            getThreadTime={getThreadTime}
                            isThreadPinned={isThreadPinned}
                            getPinTimestamp={getPinTimestamp}
                            searchActive={isSearchActive}
                            matchingThreadIdsByWorkspace={matchingThreadIdsByWorkspace}
                            renderHighlightedName={renderHighlightedText}
                            renderThreadName={(thread) => renderHighlightedText(thread.name)}
                            renderThreadSubline={renderThreadSubline}
                            onSelectWorkspace={onSelectWorkspace}
                            onConnectWorkspace={onConnectWorkspace}
                            onToggleWorkspaceCollapse={onToggleWorkspaceCollapse}
                            onSelectThread={onSelectThread}
                            onShowThreadMenu={showThreadMenu}
                            onPinThread={pinThread}
                            onUnpinThread={unpinThread}
                            onArchiveThread={onDeleteThread}
                            onShowWorktreeMenu={showWorktreeMenu}
                            onToggleExpanded={handleToggleExpanded}
                            onLoadOlderThreads={onLoadOlderThreads}
                          />
                        )}
                        {showThreadList && (
                          <ThreadList
                            workspaceId={entry.id}
                            pinnedRows={pinnedRows}
                            unpinnedRows={unpinnedRows}
                            totalThreadRoots={totalThreadRoots}
                            hasMoreRoots={hasMoreRoots}
                            isExpanded={isExpanded}
                            nextCursor={nextCursor}
                            isPaging={isPaging}
                            showLoadOlder={!isSearchActive}
                            activeWorkspaceId={activeWorkspaceId}
                            activeThreadId={activeThreadId}
                            threadStatusById={threadStatusById}
                            getThreadTime={getThreadTime}
                            isThreadPinned={isThreadPinned}
                            onToggleExpanded={handleToggleExpanded}
                            onLoadOlderThreads={onLoadOlderThreads}
                            onSelectThread={onSelectThread}
                            onShowThreadMenu={showThreadMenu}
                            onPinThread={pinThread}
                            onUnpinThread={unpinThread}
                            onArchiveThread={onDeleteThread}
                            renderThreadName={(thread) => renderHighlightedText(thread.name)}
                            renderThreadSubline={renderThreadSubline}
                          />
                        )}
                        {showThreadLoader && <ThreadLoading />}
                      </WorkspaceCard>
                      {index === group.workspaces.length - 1 ? (
                        <div
                          className="workspace-drop-slot"
                          data-active={
                            dragTarget?.workspaceId === entry.id && dragTarget.position === "after"
                          }
                          data-testid={`workspace-drop-slot-${entry.id}-after`}
                          onDragOver={(event) =>
                            handleWorkspaceDropTargetDragOver(event, entry.id, "after")
                          }
                          onDragLeave={(event) =>
                            handleWorkspaceDragLeave(event, entry.id, "after")
                          }
                          onDrop={(event) => handleWorkspaceDropOnTarget(event, entry.id, "after")}
                        />
                      ) : null}
                    </Fragment>
                  );
                })}
              </WorkspaceGroup>
            );
          })}
          {!filteredGroupedWorkspaces.length &&
            (isSearchActive ? (
              <div className="empty" data-testid="sidebar-search-empty-state">
                No projects or threads match your search.
              </div>
            ) : hasLoadedWorkspaces ? (
              <button
                type="button"
                className="sidebar-empty-action"
                onClick={() => emptyState.action()}
                data-desktop-drag-region="false"
                aria-label={emptyState.ariaLabel}
                data-testid="sidebar-empty-state-action"
              >
                <span
                  className={emptyStateStyles.card}
                  data-state={
                    runtimeUnavailable ? "runtime" : workspaceLoadError ? "error" : "default"
                  }
                  data-testid="sidebar-empty-state"
                >
                  <span className={emptyStateStyles.icon} aria-hidden>
                    <Icon icon={emptyState.icon} size={16} />
                  </span>
                  <span className={emptyStateStyles.copy}>
                    <span className={emptyStateStyles.kicker}>{emptyState.kicker}</span>
                    <span className={emptyStateStyles.title}>{emptyState.title}</span>
                    <span className={emptyStateStyles.body}>{emptyState.body}</span>
                  </span>
                  <span className={emptyStateStyles.cta}>{emptyState.cta}</span>
                </span>
              </button>
            ) : null)}
        </div>
      </SidebarBody>
      {contextMenuState &&
        createPortal(
          <PopoverSurface
            className="sidebar-context-menu"
            ref={contextMenuRef}
            role="menu"
            aria-label={contextMenuState.title}
            onContextMenu={(event) => event.preventDefault()}
          >
            {contextMenuState.actions.map((action, index) => (
              <PopoverMenuItem
                key={`${action.label}-${index}`}
                className="sidebar-context-option"
                onClick={(event) => {
                  event.stopPropagation();
                  void runContextMenuAction(action);
                }}
              >
                {action.label}
              </PopoverMenuItem>
            ))}
          </PopoverSurface>,
          document.body
        )}
      <SidebarFooter className="sidebar-footer">
        <div data-sidebar-footer-surface="kanna-card">
          <SidebarUserNav
            accountInfo={accountInfo}
            accountCenter={_accountCenter}
            onOpenSettings={onOpenSettings}
            onOpenDebug={onOpenDebug}
            showDebugButton={showDebugButton}
            onSwitchAccount={onSwitchAccount}
            onSelectLoggedInCodexAccount={onSelectLoggedInCodexAccount}
            onCancelSwitchAccount={onCancelSwitchAccount}
            accountSwitching={accountSwitching}
            accountSwitchError={accountSwitchError}
            usage={{
              usageTitle,
              sessionLabel,
              weeklyLabel,
              sessionPercent,
              weeklyPercent,
              sessionResetLabel,
              weeklyResetLabel,
              creditsLabel,
            }}
          />
        </div>
      </SidebarFooter>
    </SidebarFrame>
  );
});

Sidebar.displayName = "Sidebar";
