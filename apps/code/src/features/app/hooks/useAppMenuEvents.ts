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
import { useTauriEvent } from "./useTauriEvent";

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

  useTauriEvent(subscribeMenuNewAgent, () => {
    const workspace = activeWorkspaceRef.current;
    if (workspace) {
      onAddAgent(workspace);
    }
  });

  useTauriEvent(subscribeMenuNewWorktreeAgent, () => {
    const workspace = baseWorkspaceRef.current;
    if (workspace) {
      onAddWorktreeAgent(workspace);
    }
  });

  useTauriEvent(subscribeMenuNewCloneAgent, () => {
    const workspace = baseWorkspaceRef.current;
    if (workspace) {
      onAddCloneAgent(workspace);
    }
  });

  useTauriEvent(subscribeMenuAddWorkspace, () => {
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

  useTauriEvent(subscribeMenuOpenSettings, () => {
    onOpenSettings();
  });

  useTauriEvent(subscribeMenuNextAgent, () => {
    onCycleAgent("next");
  });

  useTauriEvent(subscribeMenuPrevAgent, () => {
    onCycleAgent("prev");
  });

  useTauriEvent(subscribeMenuNextWorkspace, () => {
    onCycleWorkspace("next");
  });

  useTauriEvent(subscribeMenuPrevWorkspace, () => {
    onCycleWorkspace("prev");
  });

  useTauriEvent(subscribeMenuToggleDebugPanel, () => {
    onToggleDebug();
  });

  useTauriEvent(subscribeMenuToggleTerminal, () => {
    onToggleTerminal();
  });

  useTauriEvent(subscribeMenuToggleProjectsSidebar, () => {
    if (sidebarCollapsed) {
      onExpandSidebar();
    } else {
      onCollapseSidebar();
    }
  });

  useTauriEvent(subscribeMenuToggleGitSidebar, () => {
    if (rightPanelCollapsed) {
      onExpandRightPanel();
    } else {
      onCollapseRightPanel();
    }
  });
}
