import Archive from "lucide-react/dist/esm/icons/archive";
import Pin from "lucide-react/dist/esm/icons/pin";
import type { MouseEvent, ReactNode } from "react";
import { useState } from "react";
import { Icon } from "../../../design-system";
import type { ThreadSummary } from "../../../types";
import { joinClassNames } from "../../../utils/classNames";
import type { ThreadVisualState } from "../../threads/utils/threadExecutionState";
import { SidebarRow } from "./SidebarScaffold";
import * as threadStatusStyles from "./ThreadStatus.css";

type SidebarThreadRowProps = {
  workspaceId: string;
  thread: ThreadSummary;
  canPin: boolean;
  depth: number;
  isActive: boolean;
  isPinned: boolean;
  relativeTime: string | null;
  statusClass: ThreadVisualState;
  renderThreadName?: (thread: ThreadSummary) => ReactNode;
  renderThreadSubline?: (thread: ThreadSummary) => ReactNode;
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
};

export function SidebarThreadRow({
  workspaceId,
  thread,
  canPin,
  depth,
  isActive,
  isPinned,
  relativeTime,
  statusClass,
  renderThreadName,
  renderThreadSubline,
  onSelectThread,
  onShowThreadMenu,
  onPinThread,
  onUnpinThread,
  onArchiveThread,
}: SidebarThreadRowProps) {
  const [confirmArchive, setConfirmArchive] = useState(false);
  const subline = renderThreadSubline?.(thread) ?? null;
  const openThreadLabel = `Open thread ${thread.name}`;
  const pinThreadLabel = `${isPinned ? "Unpin" : "Pin"} thread ${thread.name}`;
  const archiveThreadLabel = `Archive thread ${thread.name}`;
  const confirmArchiveLabel = `Confirm archive thread ${thread.name}`;

  return (
    <SidebarRow
      className={`thread-row ${isActive ? "active" : ""}${confirmArchive ? " is-confirming" : ""}`}
      onContextMenu={(event) => onShowThreadMenu(event, workspaceId, thread.id, canPin)}
      data-thread-state={statusClass}
      data-thread-depth={depth}
      aria-current={isActive ? "true" : undefined}
      title={thread.name}
    >
      {canPin ? (
        <button
          type="button"
          className={`thread-leading-control${isPinned ? " is-pinned" : ""}`}
          aria-label={pinThreadLabel}
          onClick={(event) => {
            event.stopPropagation();
            setConfirmArchive(false);
            if (isPinned) {
              onUnpinThread(workspaceId, thread.id);
              return;
            }
            onPinThread(workspaceId, thread.id);
          }}
        >
          <span className="thread-leading-visual" aria-hidden>
            <span
              className={joinClassNames("thread-status", threadStatusStyles.tone[statusClass])}
              aria-hidden
            />
          </span>
          <span className="thread-leading-action-icon" aria-hidden>
            <Icon icon={Pin} size={12} />
          </span>
        </button>
      ) : (
        <span className="thread-leading" aria-hidden>
          <span
            className={joinClassNames("thread-status", threadStatusStyles.tone[statusClass])}
            aria-hidden
          />
        </span>
      )}
      <button
        type="button"
        className="thread-row-main"
        aria-label={openThreadLabel}
        onClick={() => onSelectThread(workspaceId, thread.id)}
      >
        <div className="thread-content">
          <div className="thread-mainline">
            <span className="thread-name">{renderThreadName?.(thread) ?? thread.name}</span>
          </div>
          {subline ? <div className="thread-subline">{subline}</div> : null}
        </div>
      </button>
      {confirmArchive ? (
        <button
          type="button"
          className="thread-trailing-confirm"
          aria-label={confirmArchiveLabel}
          onClick={(event) => {
            event.stopPropagation();
            onArchiveThread(workspaceId, thread.id);
            setConfirmArchive(false);
          }}
        >
          Confirm
        </button>
      ) : (
        <button
          type="button"
          className="thread-trailing-control"
          aria-label={archiveThreadLabel}
          onClick={(event) => {
            event.stopPropagation();
            setConfirmArchive(true);
          }}
        >
          {relativeTime ? (
            <span className="thread-trailing-time" aria-hidden>
              {relativeTime}
            </span>
          ) : null}
          <span className="thread-trailing-action-icon" aria-hidden>
            <Icon icon={Archive} size={14} />
          </span>
        </button>
      )}
    </SidebarRow>
  );
}
