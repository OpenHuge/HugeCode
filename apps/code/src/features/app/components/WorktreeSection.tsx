import Layers from "lucide-react/dist/esm/icons/layers";
import type { MouseEvent, ReactNode } from "react";

import type { ThreadSummary, WorkspaceInfo } from "../../../types";
import type { ThreadRowResult } from "../hooks/useThreadRows";
import type { ThreadStatusSummary } from "../../threads/utils/threadExecutionState";
import { ThreadList } from "./ThreadList";
import { ThreadLoading } from "./ThreadLoading";
import { WorktreeCard } from "./WorktreeCard";

type ThreadStatusMap = Record<string, ThreadStatusSummary>;

type WorktreeSectionProps = {
  worktrees: WorkspaceInfo[];
  deletingWorktreeIds: Set<string>;
  threadsByWorkspace: Record<string, ThreadSummary[]>;
  threadStatusById: ThreadStatusMap;
  threadListLoadingByWorkspace: Record<string, boolean>;
  threadListPagingByWorkspace: Record<string, boolean>;
  threadListCursorByWorkspace: Record<string, string | null>;
  expandedWorkspaces: Set<string>;
  activeWorkspaceId: string | null;
  activeThreadId: string | null;
  getThreadRows: (
    threads: ThreadSummary[],
    isExpanded: boolean,
    workspaceId: string,
    getPinTimestamp: (workspaceId: string, threadId: string) => number | null,
    options?: { matchingThreadIds?: ReadonlySet<string> | null }
  ) => ThreadRowResult;
  getThreadTime: (thread: ThreadSummary) => string | null;
  isThreadPinned: (workspaceId: string, threadId: string) => boolean;
  getPinTimestamp: (workspaceId: string, threadId: string) => number | null;
  searchActive?: boolean;
  matchingThreadIdsByWorkspace?: ReadonlyMap<string, ReadonlySet<string>>;
  renderHighlightedName?: (name: string) => ReactNode;
  renderThreadName?: (thread: ThreadSummary) => ReactNode;
  renderThreadSubline?: (thread: ThreadSummary) => ReactNode;
  onSelectWorkspace: (id: string) => void;
  onConnectWorkspace: (workspace: WorkspaceInfo) => void;
  onToggleWorkspaceCollapse: (workspaceId: string, collapsed: boolean) => void;
  onSelectThread: (workspaceId: string, threadId: string) => void;
  onShowThreadMenu: (
    event: MouseEvent,
    workspaceId: string,
    threadId: string,
    canPin: boolean
  ) => void;
  onPinThread: (workspaceId: string, threadId: string) => boolean;
  onUnpinThread: (workspaceId: string, threadId: string) => void;
  onArchiveThread: (workspaceId: string, threadId: string) => void;
  onShowWorktreeMenu: (event: MouseEvent, worktree: WorkspaceInfo) => void;
  onToggleExpanded: (workspaceId: string) => void;
  onLoadOlderThreads: (workspaceId: string) => void;
};

export function WorktreeSection({
  worktrees,
  deletingWorktreeIds,
  threadsByWorkspace,
  threadStatusById,
  threadListLoadingByWorkspace,
  threadListPagingByWorkspace,
  threadListCursorByWorkspace,
  expandedWorkspaces,
  activeWorkspaceId,
  activeThreadId,
  getThreadRows,
  getThreadTime,
  isThreadPinned,
  getPinTimestamp,
  searchActive = false,
  matchingThreadIdsByWorkspace,
  renderHighlightedName,
  renderThreadName,
  renderThreadSubline,
  onSelectWorkspace,
  onConnectWorkspace,
  onToggleWorkspaceCollapse,
  onSelectThread,
  onShowThreadMenu,
  onPinThread,
  onUnpinThread,
  onArchiveThread,
  onShowWorktreeMenu,
  onToggleExpanded,
  onLoadOlderThreads,
}: WorktreeSectionProps) {
  if (!worktrees.length) {
    return null;
  }

  return (
    <div className="worktree-section">
      <div className="worktree-header">
        <Layers className="worktree-header-icon" aria-hidden />
        Worktrees
      </div>
      <div className="worktree-list">
        {worktrees.map((worktree) => {
          const worktreeThreads = threadsByWorkspace[worktree.id] ?? [];
          const isLoadingWorktreeThreads = threadListLoadingByWorkspace[worktree.id] ?? false;
          const showWorktreeLoader = isLoadingWorktreeThreads && worktreeThreads.length === 0;
          const worktreeNextCursor = threadListCursorByWorkspace[worktree.id] ?? null;
          const matchingThreadIds = matchingThreadIdsByWorkspace?.get(worktree.id) ?? null;
          const showWorktreeThreadList =
            worktreeThreads.length > 0 || (!searchActive && Boolean(worktreeNextCursor));
          const isWorktreePaging = threadListPagingByWorkspace[worktree.id] ?? false;
          const isWorktreeExpanded = expandedWorkspaces.has(worktree.id);
          const {
            pinnedRows: pinnedWorktreeRows,
            unpinnedRows: worktreeThreadRows,
            totalRoots: totalWorktreeRoots,
            hasMoreRoots: hasMoreWorktreeRoots,
          } = getThreadRows(worktreeThreads, isWorktreeExpanded, worktree.id, getPinTimestamp, {
            matchingThreadIds,
          });

          return (
            <WorktreeCard
              key={worktree.id}
              worktree={worktree}
              worktreeName={renderHighlightedName?.(worktree.name)}
              isActive={worktree.id === activeWorkspaceId}
              isCollapsed={searchActive ? false : worktree.settings.sidebarCollapsed}
              collapseLocked={searchActive}
              isDeleting={deletingWorktreeIds.has(worktree.id)}
              onSelectWorkspace={onSelectWorkspace}
              onShowWorktreeMenu={onShowWorktreeMenu}
              onToggleWorkspaceCollapse={onToggleWorkspaceCollapse}
              onConnectWorkspace={onConnectWorkspace}
            >
              {showWorktreeThreadList && (
                <ThreadList
                  workspaceId={worktree.id}
                  pinnedRows={pinnedWorktreeRows}
                  unpinnedRows={worktreeThreadRows}
                  totalThreadRoots={totalWorktreeRoots}
                  hasMoreRoots={hasMoreWorktreeRoots}
                  isExpanded={isWorktreeExpanded}
                  nextCursor={worktreeNextCursor}
                  isPaging={isWorktreePaging}
                  nested
                  showLoadOlder={false}
                  activeWorkspaceId={activeWorkspaceId}
                  activeThreadId={activeThreadId}
                  threadStatusById={threadStatusById}
                  getThreadTime={getThreadTime}
                  isThreadPinned={isThreadPinned}
                  onToggleExpanded={onToggleExpanded}
                  onLoadOlderThreads={onLoadOlderThreads}
                  onSelectThread={onSelectThread}
                  onShowThreadMenu={onShowThreadMenu}
                  onPinThread={onPinThread}
                  onUnpinThread={onUnpinThread}
                  onArchiveThread={onArchiveThread}
                  renderThreadName={renderThreadName}
                  renderThreadSubline={renderThreadSubline}
                />
              )}
              {showWorktreeLoader && <ThreadLoading nested />}
            </WorktreeCard>
          );
        })}
      </div>
    </div>
  );
}
