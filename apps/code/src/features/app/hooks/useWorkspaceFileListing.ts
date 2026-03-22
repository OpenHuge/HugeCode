import { useEffect, useState } from "react";
import type { DebugEntry, WorkspaceInfo } from "../../../types";
import type { AppTab } from "../../shell/types/shellRoute";
import { useWorkspaceFiles } from "../../workspaces/hooks/useWorkspaceFiles";

type FilePanelMode = "git" | "files" | "atlas" | "prompts";

type UseWorkspaceFileListingArgs = {
  activeWorkspace: WorkspaceInfo | null;
  activeWorkspaceId: string | null;
  filePanelMode: FilePanelMode;
  isCompact: boolean;
  activeTab: AppTab;
  rightPanelCollapsed: boolean;
  hasComposerSurface: boolean;
  onDebug?: (entry: DebugEntry) => void;
};

type UseWorkspaceFileListingResult = {
  files: string[];
  isLoading: boolean;
  setFileAutocompleteActive: (active: boolean) => void;
};

export function useWorkspaceFileListing({
  activeWorkspace,
  activeWorkspaceId,
  filePanelMode,
  isCompact,
  activeTab,
  rightPanelCollapsed,
  hasComposerSurface,
  onDebug,
}: UseWorkspaceFileListingArgs): UseWorkspaceFileListingResult {
  const [fileAutocompleteActive, setFileAutocompleteActive] = useState(false);

  const filePanelVisible =
    filePanelMode === "files" && (isCompact ? activeTab === "review" : !rightPanelCollapsed);
  const shouldFetchFiles =
    Boolean(activeWorkspace) && (filePanelMode === "files" || fileAutocompleteActive);

  useEffect(() => {
    if (!activeWorkspaceId) {
      setFileAutocompleteActive(false);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (!hasComposerSurface) {
      setFileAutocompleteActive(false);
    }
  }, [hasComposerSurface]);

  const { files, isLoading } = useWorkspaceFiles({
    activeWorkspace,
    onDebug,
    enabled: shouldFetchFiles,
    pollingEnabled: filePanelVisible,
  });

  return { files, isLoading, setFileAutocompleteActive };
}
