import { useCallback } from "react";
import type { AppSettings, WorkspaceInfo } from "../../../types";

type UseCloneProjectContextParams = {
  appSettings: AppSettings;
  queueSaveSettings: (settings: AppSettings) => Promise<unknown>;
};

export function useCloneProjectContext({
  appSettings,
  queueSaveSettings,
}: UseCloneProjectContextParams) {
  const resolveCloneProjectContext = useCallback(
    (workspace: WorkspaceInfo) => {
      const groupId = workspace.settings.groupId ?? null;
      const group = groupId
        ? appSettings.workspaceGroups.find((entry) => entry.id === groupId)
        : null;
      return {
        groupId,
        copiesFolder: group?.copiesFolder ?? null,
      };
    },
    [appSettings.workspaceGroups]
  );

  const persistProjectCopiesFolder = useCallback(
    async (groupId: string, copiesFolder: string) => {
      await queueSaveSettings({
        ...appSettings,
        workspaceGroups: appSettings.workspaceGroups.map((entry) =>
          entry.id === groupId ? { ...entry, copiesFolder } : entry
        ),
      });
    },
    [appSettings, queueSaveSettings]
  );

  return {
    resolveCloneProjectContext,
    persistProjectCopiesFolder,
  };
}
