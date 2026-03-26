import type { AppSettings, WorkspaceSettings } from "../../../types";
import { useMainAppSettingsProps } from "./useMainAppSettingsProps";

type UseMainAppSettingsSectionPropsParams = {
  workspaceGroups: Parameters<typeof useMainAppSettingsProps>[0]["workspaceGroups"];
  groupedWorkspaces: Parameters<typeof useMainAppSettingsProps>[0]["groupedWorkspaces"];
  ungroupedLabel: Parameters<typeof useMainAppSettingsProps>[0]["ungroupedLabel"];
  onMoveWorkspace: Parameters<typeof useMainAppSettingsProps>[0]["onMoveWorkspace"];
  removeWorkspace: (workspaceId: string) => Promise<unknown>;
  renameWorkspace: (workspaceId: string, name: string) => Promise<boolean | null>;
  createWorkspaceGroup: Parameters<typeof useMainAppSettingsProps>[0]["onCreateWorkspaceGroup"];
  renameWorkspaceGroup: Parameters<typeof useMainAppSettingsProps>[0]["onRenameWorkspaceGroup"];
  moveWorkspaceGroup: Parameters<typeof useMainAppSettingsProps>[0]["onMoveWorkspaceGroup"];
  deleteWorkspaceGroup: Parameters<typeof useMainAppSettingsProps>[0]["onDeleteWorkspaceGroup"];
  assignWorkspaceGroup: Parameters<typeof useMainAppSettingsProps>[0]["onAssignWorkspaceGroup"];
  reduceTransparency: boolean;
  setReduceTransparency: (value: boolean) => void;
  appSettings: AppSettings;
  openAppIconById: Record<string, string>;
  setAppSettings: (updater: (current: AppSettings) => AppSettings) => void;
  queueSaveSettings: (next: AppSettings) => Promise<AppSettings>;
  doctor: Parameters<typeof useMainAppSettingsProps>[0]["onRunDoctor"];
  codexUpdate: Parameters<typeof useMainAppSettingsProps>[0]["onRunCodexUpdate"];
  updateWorkspaceCodexBin: (id: string, codexBin: string | null) => Promise<unknown>;
  updateWorkspaceSettings: (id: string, settings: Partial<WorkspaceSettings>) => Promise<unknown>;
  scaleShortcutTitle: string;
  scaleShortcutText: string;
  onTestNotificationSound: () => void;
  onTestSystemNotification: () => void;
  handleMobileConnectSuccess: Parameters<
    typeof useMainAppSettingsProps
  >[0]["onMobileConnectSuccess"];
  onOpenMissionTarget: Parameters<typeof useMainAppSettingsProps>[0]["onOpenMissionTarget"];
};

export function useMainAppSettingsSectionProps({
  workspaceGroups,
  groupedWorkspaces,
  ungroupedLabel,
  onMoveWorkspace,
  removeWorkspace,
  renameWorkspace,
  createWorkspaceGroup,
  renameWorkspaceGroup,
  moveWorkspaceGroup,
  deleteWorkspaceGroup,
  assignWorkspaceGroup,
  reduceTransparency,
  setReduceTransparency,
  appSettings,
  openAppIconById,
  setAppSettings,
  queueSaveSettings,
  doctor,
  codexUpdate,
  updateWorkspaceCodexBin,
  updateWorkspaceSettings,
  scaleShortcutTitle,
  scaleShortcutText,
  onTestNotificationSound,
  onTestSystemNotification,
  handleMobileConnectSuccess,
  onOpenMissionTarget,
}: UseMainAppSettingsSectionPropsParams) {
  return useMainAppSettingsProps({
    workspaceGroups,
    groupedWorkspaces,
    ungroupedLabel,
    onMoveWorkspace,
    onDeleteWorkspace: (workspaceId) => {
      void removeWorkspace(workspaceId);
    },
    onRenameWorkspace: (workspaceId, name) => renameWorkspace(workspaceId, name),
    onCreateWorkspaceGroup: createWorkspaceGroup,
    onRenameWorkspaceGroup: renameWorkspaceGroup,
    onMoveWorkspaceGroup: moveWorkspaceGroup,
    onDeleteWorkspaceGroup: deleteWorkspaceGroup,
    onAssignWorkspaceGroup: assignWorkspaceGroup,
    reduceTransparency,
    onToggleTransparency: setReduceTransparency,
    appSettings,
    openAppIconById,
    onUpdateAppSettings: async (next) => {
      setAppSettings(() => next);
      await queueSaveSettings(next);
    },
    onRunDoctor: doctor,
    onRunCodexUpdate: codexUpdate,
    onUpdateWorkspaceCodexBin: async (id, codexBin) => {
      await updateWorkspaceCodexBin(id, codexBin);
    },
    onUpdateWorkspaceSettings: async (id, settings) => {
      await updateWorkspaceSettings(id, settings);
    },
    scaleShortcutTitle,
    scaleShortcutText,
    onTestNotificationSound,
    onTestSystemNotification,
    onMobileConnectSuccess: handleMobileConnectSuccess,
    onOpenMissionTarget,
  });
}
