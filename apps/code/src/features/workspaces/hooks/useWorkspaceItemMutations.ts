import { useCallback } from "react";
import {
  connectWorkspace as connectWorkspaceService,
  removeWorkspace as removeWorkspaceService,
  removeWorktree as removeWorktreeService,
  renameWorkspace as renameWorkspaceService,
  renameWorktree as renameWorktreeService,
  renameWorktreeUpstream as renameWorktreeUpstreamService,
} from "../../../application/runtime/ports/tauriWorkspaceMutations";
import type { DebugEntry, WorkspaceInfo } from "../../../types";
import { askWithFallback, messageWithFallback } from "./useWorkspaces.helpers";

type UseWorkspaceItemMutationsParams = {
  onDebug?: (entry: DebugEntry) => void;
  workspaces: WorkspaceInfo[];
  setWorkspaces: React.Dispatch<React.SetStateAction<WorkspaceInfo[]>>;
  setActiveWorkspaceId: React.Dispatch<React.SetStateAction<string | null>>;
  setDeletingWorktreeIds: React.Dispatch<React.SetStateAction<Set<string>>>;
};

export function useWorkspaceItemMutations({
  onDebug,
  workspaces,
  setWorkspaces,
  setActiveWorkspaceId,
  setDeletingWorktreeIds,
}: UseWorkspaceItemMutationsParams) {
  const connectWorkspace = useCallback(
    async (entry: WorkspaceInfo) => {
      onDebug?.({
        id: `${Date.now()}-client-connect-workspace`,
        timestamp: Date.now(),
        source: "client",
        label: "workspace/connect",
        payload: { workspaceId: entry.id, path: entry.path },
      });
      try {
        await connectWorkspaceService(entry.id);
      } catch (error) {
        onDebug?.({
          id: `${Date.now()}-client-connect-workspace-error`,
          timestamp: Date.now(),
          source: "error",
          label: "workspace/connect error",
          payload: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    [onDebug]
  );

  const markWorkspaceConnected = useCallback(
    (id: string) => {
      setWorkspaces((prev) =>
        prev.map((entry) => (entry.id === id ? { ...entry, connected: true } : entry))
      );
    },
    [setWorkspaces]
  );

  const removeWorkspace = useCallback(
    async (workspaceId: string) => {
      const workspace = workspaces.find((entry) => entry.id === workspaceId);
      const workspaceName = workspace?.name || "this workspace";
      const worktreeCount = workspaces.filter((entry) => entry.parentId === workspaceId).length;
      const childIds = new Set(
        workspaces.filter((entry) => entry.parentId === workspaceId).map((entry) => entry.id)
      );
      const detail =
        worktreeCount > 0
          ? `\n\nThis will also delete ${worktreeCount} worktree${
              worktreeCount === 1 ? "" : "s"
            } on disk.`
          : "";

      const confirmed = await askWithFallback(
        `Are you sure you want to delete "${workspaceName}"?\n\nThis will remove the workspace from CodexMonitor.${detail}`,
        {
          title: "Delete Workspace",
          kind: "warning",
          okLabel: "Delete",
          cancelLabel: "Cancel",
        }
      );

      if (!confirmed) {
        return;
      }

      onDebug?.({
        id: `${Date.now()}-client-remove-workspace`,
        timestamp: Date.now(),
        source: "client",
        label: "workspace/remove",
        payload: { workspaceId },
      });
      try {
        await removeWorkspaceService(workspaceId);
        setWorkspaces((prev) =>
          prev.filter((entry) => entry.id !== workspaceId && entry.parentId !== workspaceId)
        );
        setActiveWorkspaceId((prev) =>
          prev && (prev === workspaceId || childIds.has(prev)) ? null : prev
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        onDebug?.({
          id: `${Date.now()}-client-remove-workspace-error`,
          timestamp: Date.now(),
          source: "error",
          label: "workspace/remove error",
          payload: errorMessage,
        });
        messageWithFallback(errorMessage, {
          title: "Delete workspace failed",
          kind: "error",
        });
      }
    },
    [onDebug, setActiveWorkspaceId, setWorkspaces, workspaces]
  );

  const removeWorktree = useCallback(
    async (workspaceId: string) => {
      const workspace = workspaces.find((entry) => entry.id === workspaceId);
      const workspaceName = workspace?.name || "this worktree";

      const confirmed = await askWithFallback(
        `Are you sure you want to delete "${workspaceName}"?\n\nThis will close the agent, remove its worktree, and delete it from CodexMonitor.`,
        {
          title: "Delete Worktree",
          kind: "warning",
          okLabel: "Delete",
          cancelLabel: "Cancel",
        }
      );

      if (!confirmed) {
        return;
      }

      setDeletingWorktreeIds((prev) => {
        const next = new Set(prev);
        next.add(workspaceId);
        return next;
      });
      onDebug?.({
        id: `${Date.now()}-client-remove-worktree`,
        timestamp: Date.now(),
        source: "client",
        label: "worktree/remove",
        payload: { workspaceId },
      });
      try {
        await removeWorktreeService(workspaceId);
        setWorkspaces((prev) => prev.filter((entry) => entry.id !== workspaceId));
        setActiveWorkspaceId((prev) => (prev === workspaceId ? null : prev));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        onDebug?.({
          id: `${Date.now()}-client-remove-worktree-error`,
          timestamp: Date.now(),
          source: "error",
          label: "worktree/remove error",
          payload: errorMessage,
        });
        messageWithFallback(errorMessage, {
          title: "Delete worktree failed",
          kind: "error",
        });
      } finally {
        setDeletingWorktreeIds((prev) => {
          const next = new Set(prev);
          next.delete(workspaceId);
          return next;
        });
      }
    },
    [onDebug, setActiveWorkspaceId, setDeletingWorktreeIds, setWorkspaces, workspaces]
  );

  const renameWorktree = useCallback(
    async (workspaceId: string, branch: string) => {
      const trimmed = branch.trim();
      onDebug?.({
        id: `${Date.now()}-client-rename-worktree`,
        timestamp: Date.now(),
        source: "client",
        label: "worktree/rename",
        payload: { workspaceId, branch: trimmed },
      });
      let previous: WorkspaceInfo | null = null;
      if (trimmed) {
        setWorkspaces((prev) =>
          prev.map((entry) => {
            if (entry.id !== workspaceId) {
              return entry;
            }
            previous = entry;
            return {
              ...entry,
              name: trimmed,
              worktree: entry.worktree
                ? { ...entry.worktree, branch: trimmed }
                : { branch: trimmed },
            };
          })
        );
      }
      try {
        const updated = await renameWorktreeService(workspaceId, trimmed);
        setWorkspaces((prev) => prev.map((entry) => (entry.id === workspaceId ? updated : entry)));
        return updated;
      } catch (error) {
        if (previous) {
          const restore = previous;
          setWorkspaces((prev) =>
            prev.map((entry) => (entry.id === workspaceId ? restore : entry))
          );
        }
        onDebug?.({
          id: `${Date.now()}-client-rename-worktree-error`,
          timestamp: Date.now(),
          source: "error",
          label: "worktree/rename error",
          payload: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    [onDebug, setWorkspaces]
  );

  const renameWorkspace = useCallback(
    async (workspaceId: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        throw new Error("Workspace name is required.");
      }
      onDebug?.({
        id: `${Date.now()}-client-rename-workspace`,
        timestamp: Date.now(),
        source: "client",
        label: "workspace/rename",
        payload: { workspaceId, name: trimmed },
      });
      const existing = workspaces.find((entry) => entry.id === workspaceId) ?? null;
      if (!existing) {
        throw new Error("Workspace not found.");
      }
      if ((existing.kind ?? "main") === "worktree") {
        throw new Error("Worktree rename is not supported from project settings.");
      }

      setWorkspaces((prev) =>
        prev.map((entry) => (entry.id === workspaceId ? { ...entry, name: trimmed } : entry))
      );
      try {
        const renamed = await renameWorkspaceService(workspaceId, trimmed);
        setWorkspaces((prev) =>
          prev.map((entry) =>
            entry.id === workspaceId
              ? {
                  ...entry,
                  name: renamed.name,
                  path: renamed.path,
                  connected: renamed.connected,
                }
              : entry
          )
        );
        return true;
      } catch (error) {
        setWorkspaces((prev) =>
          prev.map((entry) =>
            entry.id === workspaceId ? { ...entry, name: existing.name } : entry
          )
        );
        onDebug?.({
          id: `${Date.now()}-client-rename-workspace-error`,
          timestamp: Date.now(),
          source: "error",
          label: "workspace/rename error",
          payload: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    [onDebug, setWorkspaces, workspaces]
  );

  const renameWorktreeUpstream = useCallback(
    async (workspaceId: string, oldBranch: string, newBranch: string) => {
      onDebug?.({
        id: `${Date.now()}-client-rename-worktree-upstream`,
        timestamp: Date.now(),
        source: "client",
        label: "worktree/rename-upstream",
        payload: { workspaceId, oldBranch, newBranch },
      });
      try {
        await renameWorktreeUpstreamService(workspaceId, oldBranch, newBranch);
      } catch (error) {
        onDebug?.({
          id: `${Date.now()}-client-rename-worktree-upstream-error`,
          timestamp: Date.now(),
          source: "error",
          label: "worktree/rename-upstream error",
          payload: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    [onDebug]
  );

  return {
    connectWorkspace,
    markWorkspaceConnected,
    removeWorkspace,
    removeWorktree,
    renameWorktree,
    renameWorkspace,
    renameWorktreeUpstream,
  };
}
