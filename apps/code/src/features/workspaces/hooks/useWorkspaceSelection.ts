import { startTransition, useCallback } from "react";
import type { WorkspaceInfo, WorkspaceSettings } from "../../../types";
import type { AppTab } from "../../shell/types/shellRoute";
import { recordSentryMetric } from "../../shared/sentry";

type UseWorkspaceSelectionOptions = {
  workspaces: WorkspaceInfo[];
  isCompact: boolean;
  activeTab: AppTab;
  activeWorkspaceId: string | null;
  setActiveTab: (tab: AppTab) => void;
  setActiveWorkspaceId: (workspaceId: string | null) => void;
  collapseRightPanel: () => void;
  updateWorkspaceSettings: (
    workspaceId: string,
    settings: Partial<WorkspaceSettings>
  ) => Promise<WorkspaceInfo>;
  setCenterMode: (mode: "chat" | "diff") => void;
  setSelectedDiffPath: (path: string | null) => void;
};

type UseWorkspaceSelectionResult = {
  exitDiffView: () => void;
  selectWorkspace: (workspaceId: string) => void;
  selectHome: () => void;
};

export function useWorkspaceSelection({
  workspaces,
  isCompact,
  activeTab,
  activeWorkspaceId,
  setActiveTab,
  setActiveWorkspaceId,
  collapseRightPanel,
  updateWorkspaceSettings,
  setCenterMode,
  setSelectedDiffPath,
}: UseWorkspaceSelectionOptions): UseWorkspaceSelectionResult {
  const exitDiffView = useCallback(() => {
    setCenterMode("chat");
    setSelectedDiffPath(null);
  }, [setCenterMode, setSelectedDiffPath]);

  const selectWorkspace = useCallback(
    (workspaceId: string) => {
      setSelectedDiffPath(null);
      const target = workspaces.find((entry) => entry.id === workspaceId);
      const didSwitch = activeWorkspaceId !== workspaceId;
      if (activeWorkspaceId === null) {
        collapseRightPanel();
      }
      if (target?.settings.sidebarCollapsed) {
        void updateWorkspaceSettings(workspaceId, {
          sidebarCollapsed: false,
        });
      }
      startTransition(() => {
        setActiveWorkspaceId(workspaceId);
        if (isCompact) {
          setActiveTab("missions");
          return;
        }
        if (activeTab === "home") {
          setActiveTab("codex");
        }
      });
      if (didSwitch) {
        recordSentryMetric("workspace_switched", 1, {
          attributes: {
            workspace_id: workspaceId,
            workspace_kind: target?.kind ?? "main",
            reason: "select",
          },
        });
      }
    },
    [
      activeWorkspaceId,
      activeTab,
      collapseRightPanel,
      isCompact,
      setActiveTab,
      setActiveWorkspaceId,
      setSelectedDiffPath,
      updateWorkspaceSettings,
      workspaces,
    ]
  );

  const selectHome = useCallback(() => {
    exitDiffView();
    setSelectedDiffPath(null);
    setActiveWorkspaceId(null);
    if (isCompact) {
      setActiveTab("home");
    }
  }, [exitDiffView, isCompact, setActiveTab, setActiveWorkspaceId, setSelectedDiffPath]);

  return { exitDiffView, selectWorkspace, selectHome };
}
