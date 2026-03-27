import { Button, Icon } from "../../../design-system";
import Folder from "lucide-react/dist/esm/icons/folder";
import Plus from "lucide-react/dist/esm/icons/plus";
import { useEffect, useRef, useState, type DragEvent, type MouseEvent } from "react";
import type { WorkspaceInfo } from "../../../types";
import { SidebarRow, SidebarSection } from "./SidebarScaffold";

type WorkspaceCardProps = {
  workspace: WorkspaceInfo;
  workspaceName?: React.ReactNode;
  isActive: boolean;
  isCollapsed: boolean;
  collapseLocked?: boolean;
  addMenuOpen: boolean;
  addMenuWidth: number;
  onShowWorkspaceMenu: (event: MouseEvent, workspaceId: string) => void;
  onToggleWorkspaceCollapse: (workspaceId: string, collapsed: boolean) => void;
  onConnectWorkspace: (workspace: WorkspaceInfo) => void;
  onAddAgent: (workspace: WorkspaceInfo) => void;
  draggable?: boolean;
  isDragging?: boolean;
  dropPosition?: "before" | "after" | null;
  onDragStart?: (event: DragEvent<HTMLElement>, workspaceId: string) => void;
  onDragOver?: (event: DragEvent<HTMLElement>, workspaceId: string) => void;
  onDragLeave?: (event: DragEvent<HTMLElement>, workspaceId: string) => void;
  onDrop?: (event: DragEvent<HTMLElement>, workspaceId: string) => void;
  onDragEnd?: () => void;
  onToggleAddMenu: (
    anchor: {
      workspaceId: string;
      top: number;
      left: number;
      width: number;
    } | null
  ) => void;
  children?: React.ReactNode;
};

export function WorkspaceCard({
  workspace,
  workspaceName,
  isActive,
  isCollapsed,
  collapseLocked = false,
  addMenuOpen,
  addMenuWidth,
  onShowWorkspaceMenu,
  onToggleWorkspaceCollapse,
  onConnectWorkspace,
  onAddAgent,
  draggable = false,
  isDragging = false,
  dropPosition = null,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onToggleAddMenu,
  children,
}: WorkspaceCardProps) {
  const [optimisticCollapsed, setOptimisticCollapsed] = useState(isCollapsed);
  const suppressClickUntilRef = useRef(0);
  const suppressClickAfterDrag = () => {
    suppressClickUntilRef.current = Date.now() + 250;
  };

  useEffect(() => {
    setOptimisticCollapsed(isCollapsed);
  }, [isCollapsed]);

  const contentCollapsedClass = optimisticCollapsed ? " collapsed" : "";
  const openAddMenu = (button: HTMLElement) => {
    const rect = button.getBoundingClientRect();
    const left = Math.min(Math.max(rect.left, 12), window.innerWidth - addMenuWidth - 12);
    const top = rect.bottom + 8;
    onToggleAddMenu(
      addMenuOpen
        ? null
        : {
            workspaceId: workspace.id,
            top,
            left,
            width: addMenuWidth,
          }
    );
  };
  const handleWorkspaceRowActivate = () => {
    if (Date.now() < suppressClickUntilRef.current) {
      return;
    }
    if (collapseLocked) {
      return;
    }
    const nextCollapsed = !optimisticCollapsed;
    setOptimisticCollapsed(nextCollapsed);
    onToggleWorkspaceCollapse(workspace.id, nextCollapsed);
  };

  return (
    <SidebarSection
      className="workspace-card"
      data-workspace-id={workspace.id}
      data-drop-position={dropPosition ?? undefined}
      section="workspace"
    >
      <SidebarRow
        className={`workspace-row ${isActive ? "active" : ""}${isDragging ? " is-dragging" : ""}`}
        role="treeitem"
        tabIndex={0}
        aria-selected={isActive}
        aria-expanded={!optimisticCollapsed}
        data-workspace-id={workspace.id}
        data-draggable={draggable ? "true" : undefined}
        draggable={draggable}
        onClick={handleWorkspaceRowActivate}
        onContextMenu={(event) => onShowWorkspaceMenu(event, workspace.id)}
        onDragStartCapture={(event) => {
          const target = event.target;
          if (
            target instanceof HTMLElement &&
            target.closest('[data-workspace-drag-ignore="true"]')
          ) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        onDragStart={(event) => {
          suppressClickAfterDrag();
          onDragStart?.(event, workspace.id);
        }}
        onDragOver={(event) => onDragOver?.(event, workspace.id)}
        onDragLeave={(event) => onDragLeave?.(event, workspace.id)}
        onDrop={(event) => onDrop?.(event, workspace.id)}
        onDragEnd={() => {
          suppressClickAfterDrag();
          onDragEnd?.();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleWorkspaceRowActivate();
          }
        }}
      >
        <div className="workspace-name-row">
          <div className="workspace-row-title">
            <span className="workspace-name">
              <Icon icon={Folder} size={17} className="workspace-name-icon" />
              <span className="workspace-name-text">{workspaceName ?? workspace.name}</span>
            </span>
          </div>
          <div className="workspace-row-actions" data-workspace-drag-ignore="true">
            <Button
              variant="ghost"
              size="sm"
              className="workspace-add"
              draggable={false}
              data-workspace-drag-ignore="true"
              onClick={(event) => {
                event.stopPropagation();
                onAddAgent(workspace);
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openAddMenu(event.currentTarget as HTMLElement);
              }}
              data-desktop-drag-region="false"
              aria-label="New agent"
              title="New agent"
              aria-expanded={addMenuOpen}
            >
              <Icon icon={Plus} size={15} />
            </Button>
          </div>
        </div>
        {!workspace.connected && (
          <button
            type="button"
            className="connect"
            draggable={false}
            data-workspace-drag-ignore="true"
            onClick={(event) => {
              event.stopPropagation();
              onConnectWorkspace(workspace);
            }}
          >
            connect
          </button>
        )}
      </SidebarRow>
      <div
        className={`workspace-card-content${contentCollapsedClass}`}
        aria-hidden={optimisticCollapsed}
        inert={optimisticCollapsed ? true : undefined}
      >
        <div className="workspace-card-content-inner">{children}</div>
      </div>
    </SidebarSection>
  );
}
