import { WorkspaceHeaderAction } from "../../../design-system";
import { PanelSplitToggleIcon } from "./PanelSplitToggleIcon";

export type SidebarToggleProps = {
  isCompact: boolean;
  sidebarCollapsed: boolean;
  rightPanelCollapsed: boolean;
  onCollapseSidebar: () => void;
  onExpandSidebar: () => void;
  onCollapseRightPanel: () => void;
  onExpandRightPanel: () => void;
};

export function SidebarCollapseButton({
  isCompact,
  sidebarCollapsed,
  onCollapseSidebar,
}: SidebarToggleProps) {
  if (isCompact || sidebarCollapsed) {
    return null;
  }
  return (
    <WorkspaceHeaderAction
      type="button"
      onClick={onCollapseSidebar}
      data-desktop-drag-region="false"
      aria-label="Hide sidebar"
      title="Hide sidebar"
      segment="icon"
      className="sidebar-toggle-button"
      icon={<PanelSplitToggleIcon side="left" active title="Hide sidebar" />}
    />
  );
}

export function SidebarExpandButton({
  isCompact,
  sidebarCollapsed,
  onExpandSidebar,
}: SidebarToggleProps) {
  if (isCompact || !sidebarCollapsed) {
    return null;
  }
  return (
    <WorkspaceHeaderAction
      type="button"
      onClick={onExpandSidebar}
      data-desktop-drag-region="false"
      aria-label="Show sidebar"
      title="Show sidebar"
      segment="icon"
      className="sidebar-toggle-button"
      icon={<PanelSplitToggleIcon side="left" title="Show sidebar" />}
    />
  );
}

export function RightPanelCollapseButton({
  isCompact,
  rightPanelCollapsed,
  onCollapseRightPanel,
}: SidebarToggleProps) {
  if (isCompact || rightPanelCollapsed) {
    return null;
  }
  return (
    <WorkspaceHeaderAction
      type="button"
      onClick={onCollapseRightPanel}
      data-desktop-drag-region="false"
      aria-label="Hide context rail"
      title="Hide context rail"
      aria-pressed="true"
      active
      segment="icon"
      className="sidebar-toggle-button"
      icon={<PanelSplitToggleIcon side="right" active title="Hide context rail" />}
    />
  );
}

export function RightPanelExpandButton({
  isCompact,
  rightPanelCollapsed,
  onExpandRightPanel,
}: SidebarToggleProps) {
  if (isCompact || !rightPanelCollapsed) {
    return null;
  }
  return (
    <WorkspaceHeaderAction
      type="button"
      onClick={onExpandRightPanel}
      data-desktop-drag-region="false"
      aria-label="Show context rail"
      title="Show context rail"
      segment="icon"
      className="sidebar-toggle-button"
      icon={<PanelSplitToggleIcon side="right" title="Show context rail" />}
    />
  );
}
