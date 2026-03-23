import type { MouseEvent, ReactNode } from "react";

import type { ThreadSummary } from "../../../types";
import type { ThreadRow } from "../hooks/useThreadRows";
import {
  resolveThreadVisualState,
  type ThreadStatusSummary,
} from "../../threads/utils/threadExecutionState";
import { SidebarSection } from "./SidebarScaffold";
import { SidebarThreadRow } from "./SidebarThreadRow";

type ThreadStatusMap = Record<string, ThreadStatusSummary>;

type ThreadListProps = {
  workspaceId: string;
  pinnedRows: ThreadRow[];
  unpinnedRows: ThreadRow[];
  totalThreadRoots: number;
  hasMoreRoots?: boolean;
  isExpanded: boolean;
  nextCursor: string | null;
  isPaging: boolean;
  nested?: boolean;
  showLoadOlder?: boolean;
  activeWorkspaceId: string | null;
  activeThreadId: string | null;
  threadStatusById: ThreadStatusMap;
  getThreadTime: (thread: ThreadSummary) => string | null;
  isThreadPinned: (workspaceId: string, threadId: string) => boolean;
  onToggleExpanded: (workspaceId: string) => void;
  onLoadOlderThreads: (workspaceId: string) => void;
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
  renderThreadName?: (thread: ThreadSummary) => ReactNode;
  renderThreadSubline?: (thread: ThreadSummary) => ReactNode;
};

export function ThreadList({
  workspaceId,
  pinnedRows,
  unpinnedRows,
  totalThreadRoots,
  hasMoreRoots,
  isExpanded,
  nextCursor,
  isPaging,
  nested,
  showLoadOlder = true,
  activeWorkspaceId,
  activeThreadId,
  threadStatusById,
  getThreadTime,
  isThreadPinned,
  onToggleExpanded,
  onLoadOlderThreads,
  onSelectThread,
  onShowThreadMenu,
  onPinThread,
  onUnpinThread,
  onArchiveThread,
  renderThreadName,
  renderThreadSubline,
}: ThreadListProps) {
  const hiddenRootCount = Math.max(0, totalThreadRoots - 3);
  const shouldShowMoreButton = hasMoreRoots ?? totalThreadRoots > 3;

  const renderThreadRow = ({ thread, depth }: ThreadRow) => {
    const relativeTime = getThreadTime(thread);
    const status = threadStatusById[thread.id];
    const statusClass = resolveThreadVisualState(status);
    const isActive = workspaceId === activeWorkspaceId && thread.id === activeThreadId;
    const canPin = depth === 0;
    const isPinned = canPin && isThreadPinned(workspaceId, thread.id);
    return (
      <SidebarThreadRow
        key={thread.id}
        workspaceId={workspaceId}
        thread={thread}
        canPin={canPin}
        depth={depth}
        isActive={isActive}
        isPinned={isPinned}
        relativeTime={relativeTime}
        statusClass={statusClass}
        renderThreadName={renderThreadName}
        renderThreadSubline={renderThreadSubline}
        onSelectThread={onSelectThread}
        onShowThreadMenu={onShowThreadMenu}
        onPinThread={onPinThread}
        onUnpinThread={onUnpinThread}
        onArchiveThread={onArchiveThread}
      />
    );
  };

  return (
    <SidebarSection
      className={`thread-list${nested ? " thread-list-nested" : ""}`}
      section="threads"
    >
      {pinnedRows.map((row) => renderThreadRow(row))}
      {pinnedRows.length > 0 && unpinnedRows.length > 0 && (
        <div className="thread-list-separator" aria-hidden="true" />
      )}
      {unpinnedRows.map((row) => renderThreadRow(row))}
      {shouldShowMoreButton && (
        <button
          className="thread-more"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleExpanded(workspaceId);
          }}
        >
          {isExpanded ? "Show less" : `Show ${hiddenRootCount} more`}
        </button>
      )}
      {showLoadOlder && nextCursor && (isExpanded || !shouldShowMoreButton) && (
        <button
          className="thread-more"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onLoadOlderThreads(workspaceId);
          }}
          disabled={isPaging}
        >
          {isPaging ? "Loading..." : totalThreadRoots === 0 ? "Search older..." : "Load older..."}
        </button>
      )}
    </SidebarSection>
  );
}
