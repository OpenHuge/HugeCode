import type { MouseEvent } from "react";

import type { WorkspaceInfo } from "../../../types";

type WorktreeCardProps = {
  worktree: WorkspaceInfo;
  worktreeName?: React.ReactNode;
  isActive: boolean;
  isCollapsed: boolean;
  collapseLocked?: boolean;
  isDeleting?: boolean;
  onSelectWorkspace: (id: string) => void;
  onShowWorktreeMenu: (event: MouseEvent, worktree: WorkspaceInfo) => void;
  onToggleWorkspaceCollapse: (workspaceId: string, collapsed: boolean) => void;
  onConnectWorkspace: (workspace: WorkspaceInfo) => void;
  children?: React.ReactNode;
};

export function WorktreeCard({
  worktree,
  worktreeName,
  isActive,
  isCollapsed,
  collapseLocked = false,
  isDeleting = false,
  onSelectWorkspace,
  onShowWorktreeMenu,
  onToggleWorkspaceCollapse,
  onConnectWorkspace,
  children,
}: WorktreeCardProps) {
  const worktreeBranch = worktree.worktree?.branch ?? "";
  const worktreeLabel = worktree.name?.trim() || worktreeBranch;
  const contentCollapsedClass = isCollapsed ? " collapsed" : "";

  return (
    <div className={`worktree-card${isDeleting ? " deleting" : ""}`}>
      <div
        className={`worktree-row ${isActive ? "active" : ""}${isDeleting ? " deleting" : ""}`}
        role="treeitem"
        tabIndex={isDeleting ? -1 : 0}
        aria-selected={isActive}
        aria-disabled={isDeleting}
        onClick={() => {
          if (!isDeleting) {
            onSelectWorkspace(worktree.id);
          }
        }}
        onContextMenu={(event) => {
          if (!isDeleting) {
            onShowWorktreeMenu(event, worktree);
          }
        }}
        onKeyDown={(event) => {
          if (isDeleting) {
            return;
          }
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelectWorkspace(worktree.id);
          }
        }}
      >
        <div className="worktree-label">{worktreeName ?? worktreeLabel}</div>
        <div className="worktree-actions">
          {isDeleting ? (
            <div className="worktree-deleting" aria-live="polite">
              <span className="worktree-deleting-spinner" aria-hidden />
              <span className="worktree-deleting-label">Deleting</span>
            </div>
          ) : (
            <>
              <button
                className={`worktree-toggle ${isCollapsed ? "" : "expanded"}`}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  if (collapseLocked) {
                    return;
                  }
                  onToggleWorkspaceCollapse(worktree.id, !isCollapsed);
                }}
                data-desktop-drag-region="false"
                aria-label={isCollapsed ? "Show agents" : "Hide agents"}
                aria-expanded={!isCollapsed}
                aria-disabled={collapseLocked}
              >
                <span className="worktree-toggle-icon">›</span>
              </button>
              {!worktree.connected && (
                <button
                  type="button"
                  className="connect"
                  onClick={(event) => {
                    event.stopPropagation();
                    onConnectWorkspace(worktree);
                  }}
                >
                  connect
                </button>
              )}
            </>
          )}
        </div>
      </div>
      <div
        className={`worktree-card-content${contentCollapsedClass}`}
        aria-hidden={isCollapsed}
        inert={isCollapsed ? true : undefined}
      >
        <div className="worktree-card-content-inner">{children}</div>
      </div>
    </div>
  );
}
