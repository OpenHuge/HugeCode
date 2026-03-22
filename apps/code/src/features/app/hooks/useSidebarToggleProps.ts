import { useMemo } from "react";
import type { SidebarToggleProps } from "../../layout/components/SidebarToggleControls";

type SidebarToggleState = Pick<
  SidebarToggleProps,
  | "isCompact"
  | "sidebarCollapsed"
  | "rightPanelCollapsed"
  | "onCollapseSidebar"
  | "onExpandSidebar"
  | "onCollapseRightPanel"
  | "onExpandRightPanel"
>;

export function useSidebarToggleProps(layoutState: SidebarToggleState): SidebarToggleProps {
  return useMemo(
    () => ({
      isCompact: layoutState.isCompact,
      sidebarCollapsed: layoutState.sidebarCollapsed,
      rightPanelCollapsed: layoutState.rightPanelCollapsed,
      onCollapseSidebar: layoutState.onCollapseSidebar,
      onExpandSidebar: layoutState.onExpandSidebar,
      onCollapseRightPanel: layoutState.onCollapseRightPanel,
      onExpandRightPanel: layoutState.onExpandRightPanel,
    }),
    [
      layoutState.isCompact,
      layoutState.sidebarCollapsed,
      layoutState.rightPanelCollapsed,
      layoutState.onCollapseSidebar,
      layoutState.onExpandSidebar,
      layoutState.onCollapseRightPanel,
      layoutState.onExpandRightPanel,
    ]
  );
}
