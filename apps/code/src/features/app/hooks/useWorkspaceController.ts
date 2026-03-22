import type { AppSettings, DebugEntry } from "../../../types";
import { useWorkspaces } from "../../workspaces/hooks/useWorkspaces";

type WorkspaceControllerOptions = {
  appSettings: AppSettings;
  appSettingsLoading: boolean;
  addDebugEntry: (entry: DebugEntry) => void;
  queueSaveSettings: (next: AppSettings) => Promise<AppSettings>;
};

export function useWorkspaceController({
  appSettings,
  appSettingsLoading,
  addDebugEntry,
  queueSaveSettings,
}: WorkspaceControllerOptions) {
  return useWorkspaces({
    onDebug: addDebugEntry,
    defaultCodexBin: appSettings.codexBin,
    appSettings,
    appSettingsLoading,
    onUpdateAppSettings: queueSaveSettings,
  });
}
