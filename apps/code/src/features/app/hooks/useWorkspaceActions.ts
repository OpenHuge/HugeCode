import * as Sentry from "@sentry/react";
import type { RefObject } from "react";
import { useCallback, useRef } from "react";
import type { DebugEntry, WorkspaceInfo } from "../../../types";
import type { AppTab } from "../../shell/types/shellRoute";

type Params = {
  isCompact: boolean;
  addWorkspace: () => Promise<WorkspaceInfo | null>;
  addWorkspaceFromPath: (path: string) => Promise<WorkspaceInfo | null>;
  addWorkspacesFromPaths: (paths: string[]) => Promise<WorkspaceInfo | null>;
  setActiveThreadId: (threadId: string | null, workspaceId: string) => void;
  setActiveTab: (tab: AppTab) => void;
  exitDiffView: () => void;
  selectWorkspace: (workspaceId: string) => void;
  onStartNewAgentDraft: (workspaceId: string) => void;
  openWorktreePrompt: (workspace: WorkspaceInfo) => void;
  openClonePrompt: (workspace: WorkspaceInfo) => void;
  composerInputRef: RefObject<HTMLTextAreaElement | null>;
  onDebug: (entry: DebugEntry) => void;
};

export function useWorkspaceActions({
  isCompact,
  addWorkspace,
  addWorkspaceFromPath,
  addWorkspacesFromPaths,
  setActiveThreadId,
  setActiveTab,
  exitDiffView,
  selectWorkspace,
  onStartNewAgentDraft,
  openWorktreePrompt,
  openClonePrompt,
  composerInputRef,
  onDebug,
}: Params) {
  const addWorkspaceInFlightRef = useRef(false);

  const handleWorkspaceAdded = useCallback(
    (workspace: WorkspaceInfo) => {
      setActiveThreadId(null, workspace.id);
      if (isCompact) {
        setActiveTab("missions");
      }
    },
    [isCompact, setActiveTab, setActiveThreadId]
  );

  const handleAddWorkspace = useCallback(async () => {
    if (addWorkspaceInFlightRef.current) {
      return;
    }
    addWorkspaceInFlightRef.current = true;
    try {
      const workspace = await addWorkspace();
      if (workspace) {
        handleWorkspaceAdded(workspace);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onDebug({
        id: `${Date.now()}-client-add-workspace-error`,
        timestamp: Date.now(),
        source: "error",
        label: "workspace/add error",
        payload: message,
      });
      alert(`Failed to add workspace.\n\n${message}`);
    } finally {
      addWorkspaceInFlightRef.current = false;
    }
  }, [addWorkspace, handleWorkspaceAdded, onDebug]);

  const handleAddWorkspacesFromPaths = useCallback(
    async (paths: string[]) => {
      try {
        const workspace = await addWorkspacesFromPaths(paths);
        if (workspace) {
          handleWorkspaceAdded(workspace);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onDebug({
          id: `${Date.now()}-client-add-workspace-error`,
          timestamp: Date.now(),
          source: "error",
          label: "workspace/add error",
          payload: message,
        });
        alert(`Failed to add workspaces.\n\n${message}`);
      }
    },
    [addWorkspacesFromPaths, handleWorkspaceAdded, onDebug]
  );

  const handleAddWorkspaceFromPath = useCallback(
    async (path: string) => {
      try {
        const workspace = await addWorkspaceFromPath(path);
        if (workspace) {
          handleWorkspaceAdded(workspace);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onDebug({
          id: `${Date.now()}-client-add-workspace-error`,
          timestamp: Date.now(),
          source: "error",
          label: "workspace/add error",
          payload: message,
        });
        alert(`Failed to add workspace.\n\n${message}`);
      }
    },
    [addWorkspaceFromPath, handleWorkspaceAdded, onDebug]
  );

  const handleAddAgent = useCallback(
    async (workspace: WorkspaceInfo) => {
      exitDiffView();
      selectWorkspace(workspace.id);
      setActiveThreadId(null, workspace.id);
      onStartNewAgentDraft(workspace.id);
      Sentry.metrics.count("agent_created", 1, {
        attributes: {
          workspace_id: workspace.id,
          thread_id: "draft",
        },
      });
      if (isCompact) {
        setActiveTab("missions");
      }
      setTimeout(() => composerInputRef.current?.focus(), 0);
    },
    [
      composerInputRef,
      exitDiffView,
      isCompact,
      onStartNewAgentDraft,
      selectWorkspace,
      setActiveThreadId,
      setActiveTab,
    ]
  );

  const handleAddWorktreeAgent = useCallback(
    async (workspace: WorkspaceInfo) => {
      exitDiffView();
      openWorktreePrompt(workspace);
    },
    [exitDiffView, openWorktreePrompt]
  );

  const handleAddCloneAgent = useCallback(
    async (workspace: WorkspaceInfo) => {
      exitDiffView();
      openClonePrompt(workspace);
    },
    [exitDiffView, openClonePrompt]
  );

  return {
    handleAddWorkspace,
    handleAddWorkspacesFromPaths,
    handleAddWorkspaceFromPath,
    handleAddAgent,
    handleAddWorktreeAgent,
    handleAddCloneAgent,
  };
}
