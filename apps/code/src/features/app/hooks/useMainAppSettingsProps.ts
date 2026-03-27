import { useMemo } from "react";
import type { AppSettings, WorkspaceGroup, WorkspaceInfo, WorkspaceSettings } from "../../../types";
import type { SettingsViewProps } from "../../settings/components/SettingsView";

type SettingsProps = Omit<SettingsViewProps, "initialSection" | "onClose">;

type UseMainAppSettingsPropsParams = {
  workspaceGroups: WorkspaceGroup[];
  groupedWorkspaces: Array<{
    id: string | null;
    name: string;
    workspaces: WorkspaceInfo[];
  }>;
  ungroupedLabel: string;
  onMoveWorkspace: (id: string, direction: "up" | "down") => void;
  onDeleteWorkspace: (workspaceId: string) => void;
  onRenameWorkspace?: (workspaceId: string, name: string) => Promise<boolean | null>;
  onCreateWorkspaceGroup: (name: string) => Promise<WorkspaceGroup | null>;
  onRenameWorkspaceGroup: (id: string, name: string) => Promise<boolean | null>;
  onMoveWorkspaceGroup: (id: string, direction: "up" | "down") => Promise<boolean | null>;
  onDeleteWorkspaceGroup: (id: string) => Promise<boolean | null>;
  onAssignWorkspaceGroup: (workspaceId: string, groupId: string | null) => Promise<boolean | null>;
  reduceTransparency: boolean;
  onToggleTransparency: (value: boolean) => void;
  appSettings: AppSettings;
  openAppIconById: Record<string, string>;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
  onRunDoctor: (
    codexBin: string | null,
    codexArgs: string | null
  ) => Promise<Awaited<ReturnType<NonNullable<SettingsViewProps["onRunDoctor"]>>>>;
  onRunCodexUpdate: SettingsViewProps["onRunCodexUpdate"];
  onUpdateWorkspaceCodexBin: (id: string, codexBin: string | null) => Promise<void>;
  onUpdateWorkspaceSettings: (id: string, settings: Partial<WorkspaceSettings>) => Promise<void>;
  scaleShortcutTitle: string;
  scaleShortcutText: string;
  onTestNotificationSound: () => void;
  onTestSystemNotification: () => void;
  onMobileConnectSuccess: SettingsViewProps["onMobileConnectSuccess"];
  onOpenMissionTarget: SettingsViewProps["onOpenMissionTarget"];
};

export function useMainAppSettingsProps({
  workspaceGroups,
  groupedWorkspaces,
  ungroupedLabel,
  onMoveWorkspace,
  onDeleteWorkspace,
  onRenameWorkspace,
  onCreateWorkspaceGroup,
  onRenameWorkspaceGroup,
  onMoveWorkspaceGroup,
  onDeleteWorkspaceGroup,
  onAssignWorkspaceGroup,
  reduceTransparency,
  onToggleTransparency,
  appSettings,
  openAppIconById,
  onUpdateAppSettings,
  onRunDoctor,
  onRunCodexUpdate,
  onUpdateWorkspaceCodexBin,
  onUpdateWorkspaceSettings,
  scaleShortcutTitle,
  scaleShortcutText,
  onTestNotificationSound,
  onTestSystemNotification,
  onMobileConnectSuccess,
  onOpenMissionTarget,
}: UseMainAppSettingsPropsParams): SettingsProps {
  return useMemo(
    () => ({
      workspaceGroups,
      groupedWorkspaces,
      ungroupedLabel,
      onMoveWorkspace,
      onDeleteWorkspace,
      onRenameWorkspace,
      onCreateWorkspaceGroup,
      onRenameWorkspaceGroup,
      onMoveWorkspaceGroup,
      onDeleteWorkspaceGroup,
      onAssignWorkspaceGroup,
      reduceTransparency,
      onToggleTransparency,
      appSettings,
      openAppIconById,
      onUpdateAppSettings,
      onRunDoctor,
      onRunCodexUpdate,
      onUpdateWorkspaceCodexBin,
      onUpdateWorkspaceSettings,
      scaleShortcutTitle,
      scaleShortcutText,
      onTestNotificationSound,
      onTestSystemNotification,
      onMobileConnectSuccess,
      onOpenMissionTarget,
    }),
    [
      workspaceGroups,
      groupedWorkspaces,
      ungroupedLabel,
      onMoveWorkspace,
      onDeleteWorkspace,
      onRenameWorkspace,
      onCreateWorkspaceGroup,
      onRenameWorkspaceGroup,
      onMoveWorkspaceGroup,
      onDeleteWorkspaceGroup,
      onAssignWorkspaceGroup,
      reduceTransparency,
      onToggleTransparency,
      appSettings,
      openAppIconById,
      onUpdateAppSettings,
      onRunDoctor,
      onRunCodexUpdate,
      onUpdateWorkspaceCodexBin,
      onUpdateWorkspaceSettings,
      scaleShortcutTitle,
      scaleShortcutText,
      onTestNotificationSound,
      onTestSystemNotification,
      onMobileConnectSuccess,
      onOpenMissionTarget,
    ]
  );
}
