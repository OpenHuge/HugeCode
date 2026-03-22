import type { ComponentProps, ReactNode } from "react";
import { SidebarExpandButton } from "../../layout/components/SidebarToggleControls";
import { MainAppCompactThreadConnectionChip } from "../components/MainAppCompactThreadConnectionChip";

type SidebarToggleProps = ComponentProps<typeof SidebarExpandButton>;

type BuildTopbarChromeNodesOptions = {
  isCompact: boolean;
  sidebarToggleProps: SidebarToggleProps;
  desktopTopbarLeftNode: ReactNode;
  showCompactCodexThreadActions: boolean;
  hasActiveThread: boolean;
  isActiveWorkspaceConnected: boolean;
  threadLiveConnectionState: "live" | "syncing" | "fallback" | "offline";
};

export function buildTopbarChromeNodes({
  isCompact: _isCompact,
  desktopTopbarLeftNode,
  showCompactCodexThreadActions,
  hasActiveThread,
  isActiveWorkspaceConnected,
  threadLiveConnectionState,
}: BuildTopbarChromeNodesOptions) {
  return {
    desktopTopbarLeftNodeWithToggle: desktopTopbarLeftNode,
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
