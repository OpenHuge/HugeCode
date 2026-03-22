import type { LayoutMode } from "../../layout/hooks/useLayoutMode";
import { usePanelShortcuts } from "../../layout/hooks/usePanelShortcuts";
import { usePanelVisibility } from "../../layout/hooks/usePanelVisibility";
import { useResizablePanels } from "../../layout/hooks/useResizablePanels";
import { useSidebarToggles } from "../../layout/hooks/useSidebarToggles";
import type { AppTab } from "../../shell/types/shellRoute";

export function useLayoutController({
  activeWorkspaceId,
  layoutMode,
  activeTab,
  setActiveTab,
  setDebugOpen,
  toggleDebugPanelShortcut,
  toggleTerminalShortcut,
}: {
  activeWorkspaceId: string | null;
  layoutMode: LayoutMode;
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  setDebugOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  toggleDebugPanelShortcut: string | null;
  toggleTerminalShortcut: string | null;
}) {
  const {
    sidebarWidth,
    rightPanelWidth,
    onSidebarResizeStart,
    onRightPanelResizeStart,
    planPanelHeight,
    onPlanPanelResizeStart,
    terminalPanelHeight,
    onTerminalPanelResizeStart,
    debugPanelHeight,
    onDebugPanelResizeStart,
  } = useResizablePanels();

  const isCompact = layoutMode !== "desktop";
  const isPhone = layoutMode === "phone";

  const {
    sidebarCollapsed,
    rightPanelCollapsed,
    collapseSidebar,
    expandSidebar,
    collapseRightPanel,
    expandRightPanel,
  } = useSidebarToggles({ isCompact });

  const {
    terminalOpen,
    onToggleDebug: handleDebugClick,
    onToggleTerminal: handleToggleTerminal,
    openTerminal,
    closeTerminal,
  } = usePanelVisibility({
    isCompact,
    activeWorkspaceId,
    activeTab,
    setActiveTab,
    setDebugOpen,
  });

  usePanelShortcuts({
    toggleDebugPanelShortcut,
    toggleTerminalShortcut,
    onToggleDebug: handleDebugClick,
    onToggleTerminal: handleToggleTerminal,
  });

  return {
    layoutMode,
    isCompact,
    isPhone,
    sidebarWidth,
    rightPanelWidth,
    planPanelHeight,
    terminalPanelHeight,
    debugPanelHeight,
    onSidebarResizeStart,
    onRightPanelResizeStart,
    onPlanPanelResizeStart,
    onTerminalPanelResizeStart,
    onDebugPanelResizeStart,
    sidebarCollapsed,
    rightPanelCollapsed,
    collapseSidebar,
    expandSidebar,
    collapseRightPanel,
    expandRightPanel,
    terminalOpen,
    handleDebugClick,
    handleToggleTerminal,
    openTerminal,
    closeTerminal,
  };
}
