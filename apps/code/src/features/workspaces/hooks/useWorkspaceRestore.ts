import { useEffect, useRef } from "react";
import type { WorkspaceInfo } from "../../../types";

type WorkspaceRestoreOptions = {
  workspaces: WorkspaceInfo[];
  hasLoaded: boolean;
  connectWorkspace: (workspace: WorkspaceInfo) => Promise<void>;
  listThreadsForWorkspace: (
    workspace: WorkspaceInfo,
    options?: { preserveState?: boolean }
  ) => Promise<void>;
};

export function useWorkspaceRestore({
  workspaces,
  hasLoaded,
  connectWorkspace,
  listThreadsForWorkspace,
}: WorkspaceRestoreOptions) {
  const restoredWorkspaces = useRef(new Set<string>());
  const restoringWorkspaces = useRef(new Set<string>());

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }
    workspaces.forEach((workspace) => {
      if (
        restoredWorkspaces.current.has(workspace.id) ||
        restoringWorkspaces.current.has(workspace.id)
      ) {
        return;
      }
      restoringWorkspaces.current.add(workspace.id);
      void (async () => {
        try {
          if (!workspace.connected) {
            await connectWorkspace(workspace);
          }
          await listThreadsForWorkspace(workspace);
          restoredWorkspaces.current.add(workspace.id);
        } catch {
          // Silent: connection errors show in debug panel.
        } finally {
          restoringWorkspaces.current.delete(workspace.id);
        }
      })();
    });
  }, [connectWorkspace, hasLoaded, listThreadsForWorkspace, workspaces]);
}
