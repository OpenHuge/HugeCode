import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import type { AppTab } from "../../shell/types/shellRoute";

type UsePanelVisibilityOptions = {
  isCompact: boolean;
  activeWorkspaceId: string | null;
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  setDebugOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
};

export function usePanelVisibility({
  isCompact,
  activeWorkspaceId,
  activeTab,
  setActiveTab,
  setDebugOpen,
}: UsePanelVisibilityOptions) {
  const [terminalOpen, setTerminalOpen] = useState(false);
  const previousCompactTabRef = useRef<Exclude<AppTab, "settings">>("missions");

  useEffect(() => {
    if (!isCompact || activeTab === "settings") {
      return;
    }
    previousCompactTabRef.current = activeTab;
  }, [activeTab, isCompact]);

  const onToggleDebug = useCallback(() => {
    startTransition(() => {
      if (isCompact) {
        if (activeTab === "settings") {
          setActiveTab(previousCompactTabRef.current);
          return;
        }
        previousCompactTabRef.current = activeTab;
        setActiveTab("settings");
        return;
      }
      setDebugOpen((prev) => !prev);
    });
  }, [activeTab, isCompact, setActiveTab, setDebugOpen]);

  const onToggleTerminal = useCallback(() => {
    if (!activeWorkspaceId) {
      return;
    }
    setTerminalOpen((prev) => !prev);
  }, [activeWorkspaceId]);

  const openTerminal = useCallback(() => {
    if (!activeWorkspaceId) {
      return;
    }
    setTerminalOpen(true);
  }, [activeWorkspaceId]);

  const closeTerminal = useCallback(() => {
    setTerminalOpen(false);
  }, []);

  return {
    terminalOpen,
    onToggleDebug,
    onToggleTerminal,
    openTerminal,
    closeTerminal,
  };
}
