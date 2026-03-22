import type { Dispatch, SetStateAction } from "react";
import { ask, open } from "../../../application/runtime/ports/tauriDialogs";
import type { AppSettings, WorkspaceGroup, WorkspaceInfo } from "../../../types";

type UseSettingsWorkspaceGroupActionsOptions = {
  appSettings: AppSettings;
  groupedWorkspaces: Array<{
    id: string | null;
    name: string;
    workspaces: WorkspaceInfo[];
  }>;
  groupDrafts: Record<string, string>;
  newGroupName: string;
  onCreateWorkspaceGroup: (name: string) => Promise<WorkspaceGroup | null>;
  onDeleteWorkspaceGroup: (id: string) => Promise<boolean | null>;
  onRenameWorkspaceGroup: (id: string, name: string) => Promise<boolean | null>;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
  setGroupDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  setGroupError: Dispatch<SetStateAction<string | null>>;
  setNewGroupName: Dispatch<SetStateAction<string>>;
  ungroupedLabel: string;
  formatErrorMessage: (error: unknown, fallback: string) => string;
};

export function useSettingsWorkspaceGroupActions({
  appSettings,
  groupedWorkspaces,
  groupDrafts,
  newGroupName,
  onCreateWorkspaceGroup,
  onDeleteWorkspaceGroup,
  onRenameWorkspaceGroup,
  onUpdateAppSettings,
  setGroupDrafts,
  setGroupError,
  setNewGroupName,
  ungroupedLabel,
  formatErrorMessage,
}: UseSettingsWorkspaceGroupActionsOptions) {
  const trimmedGroupName = newGroupName.trim();
  const canCreateGroup = Boolean(trimmedGroupName);

  const handleCreateGroup = async () => {
    setGroupError(null);
    try {
      const created = await onCreateWorkspaceGroup(newGroupName);
      if (created) {
        setNewGroupName("");
      }
    } catch (error) {
      setGroupError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleRenameGroup = async (group: WorkspaceGroup) => {
    const draft = groupDrafts[group.id] ?? "";
    const trimmed = draft.trim();
    if (!trimmed || trimmed === group.name) {
      setGroupDrafts((prev) => ({
        ...prev,
        [group.id]: group.name,
      }));
      return;
    }
    setGroupError(null);
    try {
      await onRenameWorkspaceGroup(group.id, trimmed);
    } catch (error) {
      setGroupError(error instanceof Error ? error.message : String(error));
      setGroupDrafts((prev) => ({
        ...prev,
        [group.id]: group.name,
      }));
    }
  };

  const updateGroupCopiesFolder = async (groupId: string, copiesFolder: string | null) => {
    setGroupError(null);
    try {
      await onUpdateAppSettings({
        ...appSettings,
        workspaceGroups: appSettings.workspaceGroups.map((entry) =>
          entry.id === groupId ? { ...entry, copiesFolder } : entry
        ),
      });
    } catch (error) {
      setGroupError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleChooseGroupCopiesFolder = async (group: WorkspaceGroup) => {
    setGroupError(null);
    try {
      const selection = await open({ multiple: false, directory: true });
      if (!selection || Array.isArray(selection)) {
        return;
      }
      await updateGroupCopiesFolder(group.id, selection);
    } catch (error) {
      setGroupError(formatErrorMessage(error, "Unable to choose copies folder."));
    }
  };

  const handleClearGroupCopiesFolder = async (group: WorkspaceGroup) => {
    if (!group.copiesFolder) {
      return;
    }
    await updateGroupCopiesFolder(group.id, null);
  };

  const handleDeleteGroup = async (group: WorkspaceGroup) => {
    const groupProjects =
      groupedWorkspaces.find((entry) => entry.id === group.id)?.workspaces ?? [];
    const detail =
      groupProjects.length > 0
        ? `\n\nProjects in this group will move to "${ungroupedLabel}".`
        : "";
    try {
      const confirmed = await ask(`Delete "${group.name}"?${detail}`, {
        title: "Delete Group",
        kind: "warning",
        okLabel: "Delete",
        cancelLabel: "Cancel",
      });
      if (!confirmed) {
        return;
      }
      setGroupError(null);
      await onDeleteWorkspaceGroup(group.id);
    } catch (error) {
      setGroupError(formatErrorMessage(error, "Unable to delete group."));
    }
  };

  return {
    canCreateGroup,
    handleChooseGroupCopiesFolder,
    handleClearGroupCopiesFolder,
    handleCreateGroup,
    handleDeleteGroup,
    handleRenameGroup,
  };
}
