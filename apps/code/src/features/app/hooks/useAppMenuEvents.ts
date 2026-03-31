import type { MutableRefObject } from "react";
import { useRef } from "react";
import {
  subscribeMenuAddWorkspace,
  subscribeMenuNewAgent,
  subscribeMenuNewCloneAgent,
  subscribeMenuNewWorktreeAgent,
  subscribeMenuNextAgent,
  subscribeMenuNextWorkspace,
  subscribeMenuOpenSettings,
  subscribeMenuPrevAgent,
  subscribeMenuPrevWorkspace,
  subscribeMenuToggleDebugPanel,
  subscribeMenuToggleGitSidebar,
  subscribeMenuToggleProjectsSidebar,
  subscribeMenuToggleTerminal,
} from "../../../application/runtime/ports/events";
import type { WorkspaceInfo } from "../../../types";
import type { CodexSection } from "../../settings/components/settingsTypes";
import { useDesktopHostEvent } from "./useDesktopHostEvent";

type Params = {
  activeWorkspaceRef: MutableRefObject<WorkspaceInfo | null>;
  baseWorkspaceRef: MutableRefObject<WorkspaceInfo | null>;
  onAddWorkspace: () => void;
  onAddAgent: (workspace: WorkspaceInfo) => void;
  onAddWorktreeAgent: (workspace: WorkspaceInfo) => void;
  onAddCloneAgent: (workspace: WorkspaceInfo) => void;
  onOpenSettings: (section?: CodexSection) => void;
  onCycleAgent: (direction: "next" | "prev") => void;
  onCycleWorkspace: (direction: "next" | "prev") => void;
  onToggleDebug: () => void;
  onToggleTerminal: () => void;
  sidebarCollapsed: boolean;
  rightPanelCollapsed: boolean;
  onExpandSidebar: () => void;
  onCollapseSidebar: () => void;
  onExpandRightPanel: () => void;
  onCollapseRightPanel: () => void;
};

const MENU_ADD_WORKSPACE_DEBOUNCE_MS = 1200;

export function useAppMenuEvents({
  activeWorkspaceRef,
  baseWorkspaceRef,
  onAddWorkspace,
  onAddAgent,
  onAddWorktreeAgent,
  onAddCloneAgent,
  onOpenSettings,
  onCycleAgent,
  onCycleWorkspace,
  onToggleDebug,
  onToggleTerminal,
  sidebarCollapsed,
  rightPanelCollapsed,
  onExpandSidebar,
  onCollapseSidebar,
  onExpandRightPanel,
  onCollapseRightPanel,
}: Params) {
  const lastMenuAddWorkspaceAtRef = useRef(0);

  useDesktopHostEvent(subscribeMenuNewAgent, () => {
    const workspace = activeWorkspaceRef.current;
    if (workspace) {
      onAddAgent(workspace);
    }
  });

  useDesktopHostEvent(subscribeMenuNewWorktreeAgent, () => {
    const workspace = baseWorkspaceRef.current;
    if (workspace) {
      onAddWorktreeAgent(workspace);
    }
  });

  useDesktopHostEvent(subscribeMenuNewCloneAgent, () => {
    const workspace = baseWorkspaceRef.current;
    if (workspace) {
      onAddCloneAgent(workspace);
    }
  });

  useDesktopHostEvent(subscribeMenuAddWorkspace, () => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      return;
    }
    const now = Date.now();
    if (now - lastMenuAddWorkspaceAtRef.current < MENU_ADD_WORKSPACE_DEBOUNCE_MS) {
      return;
    }
    lastMenuAddWorkspaceAtRef.current = now;
    onAddWorkspace();
  });

  useDesktopHostEvent(subscribeMenuOpenSettings, () => {
    onOpenSettings();
  });

  useDesktopHostEvent(subscribeMenuNextAgent, () => {
    onCycleAgent("next");
  });

  useDesktopHostEvent(subscribeMenuPrevAgent, () => {
    onCycleAgent("prev");
  });

  useDesktopHostEvent(subscribeMenuNextWorkspace, () => {
    onCycleWorkspace("next");
  });

  useDesktopHostEvent(subscribeMenuPrevWorkspace, () => {
    onCycleWorkspace("prev");
  });

  useDesktopHostEvent(subscribeMenuToggleDebugPanel, () => {
    onToggleDebug();
  });

  useDesktopHostEvent(subscribeMenuToggleTerminal, () => {
    onToggleTerminal();
  });

  useDesktopHostEvent(subscribeMenuToggleProjectsSidebar, () => {
    if (sidebarCollapsed) {
      onExpandSidebar();
    } else {
      onCollapseSidebar();
    }
  });

  useDesktopHostEvent(subscribeMenuToggleGitSidebar, () => {
    if (rightPanelCollapsed) {
      onExpandRightPanel();
    } else {
      onCollapseRightPanel();
    }
  });
}
