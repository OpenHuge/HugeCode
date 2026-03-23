import { useCallback, useEffect, useState } from "react";
import type { WorkspaceInfo } from "../../../types";
import type { LayoutMode } from "../../layout/hooks/useLayoutMode";
import { coerceShellTab } from "../state/shellSelectors";
import type { AppTab } from "../types/shellRoute";

type UseShellNavigationOptions = {
  activeWorkspace: WorkspaceInfo | null;
  layoutMode: LayoutMode;
  initialTab?: AppTab;
};

export function useShellNavigation({
  activeWorkspace,
  layoutMode,
  initialTab = "workspaces",
}: UseShellNavigationOptions) {
  const isPhone = layoutMode === "phone";
  const hasActiveWorkspace = activeWorkspace !== null;

  const normalizeTab = useCallback(
    (tab: AppTab) => coerceShellTab(tab, { isPhone, hasActiveWorkspace }),
    [hasActiveWorkspace, isPhone]
  );

  const [activeTab, setActiveTabState] = useState<AppTab>(() =>
    coerceShellTab(initialTab, { isPhone, hasActiveWorkspace })
  );

  useEffect(() => {
    setActiveTabState((previousTab) => {
      const nextTab = normalizeTab(previousTab);
      return nextTab === previousTab ? previousTab : nextTab;
    });
  }, [normalizeTab]);

  const setActiveTab = useCallback(
    (nextTab: AppTab) => {
      setActiveTabState((previousTab) => {
        const normalizedTab = normalizeTab(nextTab);
        return normalizedTab === previousTab ? previousTab : normalizedTab;
      });
    },
    [normalizeTab]
  );

  return {
    activeTab,
    setActiveTab,
  };
}
