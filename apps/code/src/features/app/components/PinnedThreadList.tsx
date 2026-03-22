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

type PinnedThreadRow = ThreadRow & {
  workspaceId: string;
};

type PinnedThreadListProps = {
  rows: PinnedThreadRow[];
  activeWorkspaceId: string | null;
  activeThreadId: string | null;
  threadStatusById: ThreadStatusMap;
  getThreadTime: (thread: ThreadSummary) => string | null;
  isThreadPinned: (workspaceId: string, threadId: string) => boolean;
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

export function PinnedThreadList({
  rows,
  activeWorkspaceId,
  activeThreadId,
  threadStatusById,
  getThreadTime,
  isThreadPinned,
  onSelectThread,
  onShowThreadMenu,
  onPinThread,
  onUnpinThread,
  onArchiveThread,
  renderThreadName,
  renderThreadSubline,
}: PinnedThreadListProps) {
  return (
    <SidebarSection className="thread-list pinned-thread-list" section="pinned-threads">
      {rows.map(({ thread, depth, workspaceId }) => {
        const relativeTime = getThreadTime(thread);
        const status = threadStatusById[thread.id];
        const statusClass = resolveThreadVisualState(status);
        const isActive = workspaceId === activeWorkspaceId && thread.id === activeThreadId;
        const canPin = depth === 0;
        const isPinned = canPin && isThreadPinned(workspaceId, thread.id);

        return (
          <SidebarThreadRow
            key={`${workspaceId}:${thread.id}`}
            workspaceId={workspaceId}
            thread={thread}
            canPin={canPin}
            depth={depth}
            indentUnit={14}
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
      })}
    </SidebarSection>
  );
}
