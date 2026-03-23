import type { ComponentProps, ReactNode } from "react";
import {
  RightPanelCollapseButton,
  RightPanelExpandButton,
  SidebarExpandButton,
} from "../../layout/components/SidebarToggleControls";
import { MainAppCompactThreadConnectionChip } from "../components/MainAppCompactThreadConnectionChip";

type SidebarToggleProps = ComponentProps<typeof SidebarExpandButton>;

type BuildTopbarChromeNodesOptions = {
  isCompact: boolean;
  sidebarToggleProps: SidebarToggleProps;
  desktopTopbarLeftNode: ReactNode;
  desktopTopbarRightNode: ReactNode;
  showCompactCodexThreadActions: boolean;
  hasActiveThread: boolean;
  isActiveWorkspaceConnected: boolean;
  threadLiveConnectionState: "live" | "syncing" | "fallback" | "offline";
};

export function buildTopbarChromeNodes({
  isCompact,
  sidebarToggleProps,
  desktopTopbarLeftNode,
  desktopTopbarRightNode,
  showCompactCodexThreadActions,
  hasActiveThread,
  isActiveWorkspaceConnected,
  threadLiveConnectionState,
}: BuildTopbarChromeNodesOptions) {
  return {
    desktopTopbarLeftNodeWithToggle: desktopTopbarLeftNode,
    titlebarControlsNode: !isCompact ? (
      <div className="titlebar-controls">
        <div className="titlebar-toggle titlebar-toggle-left">
          <SidebarExpandButton {...sidebarToggleProps} />
        </div>
        <div
          className="titlebar-toggle titlebar-toggle-right titlebar-control-group titlebar-control-group-right"
          data-titlebar-right-controls="true"
        >
          {desktopTopbarRightNode}
          {sidebarToggleProps.rightPanelCollapsed ? (
            <RightPanelExpandButton {...sidebarToggleProps} />
          ) : (
            <RightPanelCollapseButton {...sidebarToggleProps} />
          )}
        </div>
      </div>
    ) : null,
    codexTopbarActionsNode: (
      <MainAppCompactThreadConnectionChip
        show={showCompactCodexThreadActions}
        hasActiveThread={hasActiveThread}
        connectionState={
          !isActiveWorkspaceConnected || !hasActiveThread ? "offline" : threadLiveConnectionState
        }
      />
    ),
  };
}
