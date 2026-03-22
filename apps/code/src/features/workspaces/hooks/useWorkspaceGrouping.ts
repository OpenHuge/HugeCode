import { useCallback, useMemo } from "react";
import type { AppSettings, WorkspaceGroup, WorkspaceInfo } from "../../../types";
import { getSortOrderValue, RESERVED_WORKSPACE_GROUP_NAME } from "./useWorkspaces.helpers";

type WorkspaceGroupSection = {
  id: string | null;
  name: string;
  workspaces: WorkspaceInfo[];
};

type UseWorkspaceGroupingParams = {
  appSettings?: AppSettings;
  workspaces: WorkspaceInfo[];
  workspaceById: Map<string, WorkspaceInfo>;
};

export function useWorkspaceGrouping({
  appSettings,
  workspaces,
  workspaceById,
}: UseWorkspaceGroupingParams) {
  const workspaceGroups = useMemo(() => {
    const groups = appSettings?.workspaceGroups ?? [];
    return groups.slice().sort((a, b) => {
      const orderDiff = getSortOrderValue(a.sortOrder) - getSortOrderValue(b.sortOrder);
      if (orderDiff !== 0) {
        return orderDiff;
      }
      return a.name.localeCompare(b.name);
    });
  }, [appSettings?.workspaceGroups]);

  const workspaceGroupById = useMemo(() => {
    const map = new Map<string, WorkspaceGroup>();
    workspaceGroups.forEach((group) => {
      map.set(group.id, group);
    });
    return map;
  }, [workspaceGroups]);

  const getWorkspaceGroupId = useCallback(
    (workspace: WorkspaceInfo) => {
      if ((workspace.kind ?? "main") === "worktree" && workspace.parentId) {
        const parent = workspaceById.get(workspace.parentId);
        return parent?.settings.groupId ?? null;
      }
      return workspace.settings.groupId ?? null;
    },
    [workspaceById]
  );

  const groupedWorkspaces = useMemo(() => {
    const rootWorkspaces = workspaces.filter(
      (entry) => (entry.kind ?? "main") !== "worktree" && !entry.parentId
    );
    const buckets = new Map<string | null, WorkspaceInfo[]>();
    workspaceGroups.forEach((group) => {
      buckets.set(group.id, []);
    });
    const ungrouped: WorkspaceInfo[] = [];
    rootWorkspaces.forEach((workspace) => {
      const groupId = workspace.settings.groupId ?? null;
      const bucket = groupId ? buckets.get(groupId) : null;
      if (bucket) {
        bucket.push(workspace);
      } else {
        ungrouped.push(workspace);
      }
    });

    const sortWorkspaces = (list: WorkspaceInfo[]) =>
      list.slice().sort((a, b) => {
        const orderDiff =
          getSortOrderValue(a.settings.sortOrder) - getSortOrderValue(b.settings.sortOrder);
        if (orderDiff !== 0) {
          return orderDiff;
        }
        return a.name.localeCompare(b.name);
      });

    const sections: WorkspaceGroupSection[] = workspaceGroups.map((group) => ({
      id: group.id,
      name: group.name,
      workspaces: sortWorkspaces(buckets.get(group.id) ?? []),
    }));

    if (ungrouped.length > 0) {
      sections.push({
        id: null,
        name: RESERVED_WORKSPACE_GROUP_NAME,
        workspaces: sortWorkspaces(ungrouped),
      });
    }

    return sections.filter((section) => section.workspaces.length > 0);
  }, [workspaces, workspaceGroups]);

  const getWorkspaceGroupName = useCallback(
    (workspaceId: string) => {
      const workspace = workspaceById.get(workspaceId);
      if (!workspace) {
        return null;
      }
      const groupId = getWorkspaceGroupId(workspace);
      if (!groupId) {
        return null;
      }
      return workspaceGroupById.get(groupId)?.name ?? null;
    },
    [getWorkspaceGroupId, workspaceById, workspaceGroupById]
  );

  return {
    workspaceGroups,
    workspaceGroupById,
    groupedWorkspaces,
    getWorkspaceGroupName,
    ungroupedLabel: RESERVED_WORKSPACE_GROUP_NAME,
  };
}
