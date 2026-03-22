import { useCallback, useEffect, useRef, useState } from "react";
import { isTauri } from "../../../application/runtime/ports/tauriCore";
import { ask } from "../../../application/runtime/ports/tauriDialogs";
import {
  applyWorktreeChanges as applyWorktreeChangesService,
  revertGitAll,
  revertGitFile as revertGitFileService,
  stageGitAll as stageGitAllService,
  stageGitFile as stageGitFileService,
  unstageGitFile as unstageGitFileService,
} from "../../../application/runtime/ports/tauriGit";
import type { WorkspaceInfo } from "../../../types";

type UseGitActionsOptions = {
  activeWorkspace: WorkspaceInfo | null;
  onRefreshGitStatus: () => void;
  onRefreshGitDiffs: () => void;
  onError?: (error: unknown) => void;
};

export function useGitActions({
  activeWorkspace,
  onRefreshGitStatus,
  onRefreshGitDiffs,
  onError,
}: UseGitActionsOptions) {
  const [worktreeApplyError, setWorktreeApplyError] = useState<string | null>(null);
  const [worktreeApplyLoading, setWorktreeApplyLoading] = useState(false);
  const [worktreeApplySuccess, setWorktreeApplySuccess] = useState(false);
  const worktreeApplyTimerRef = useRef<number | null>(null);
  const workspaceIdRef = useRef<string | null>(activeWorkspace?.id ?? null);
  const workspaceId = activeWorkspace?.id ?? null;
  const isWorktree = activeWorkspace?.kind === "worktree";

  const confirmWarning = useCallback(async (message: string, title: string) => {
    if (isTauri()) {
      try {
        return await ask(message, { title, kind: "warning" });
      } catch {
        // Fall back to browser confirm when native dialog bridge is unavailable.
      }
    }
    if (typeof window === "undefined" || typeof window.confirm !== "function") {
      return false;
    }
    return window.confirm(message);
  }, []);

  useEffect(() => {
    workspaceIdRef.current = workspaceId;
  }, [workspaceId]);

  // oxlint-disable-next-line react/exhaustive-deps -- reset transient worktree UI state only when workspace identity changes.
  useEffect(() => {
    setWorktreeApplyError(null);
    setWorktreeApplyLoading(false);
    setWorktreeApplySuccess(false);
    if (worktreeApplyTimerRef.current) {
      window.clearTimeout(worktreeApplyTimerRef.current);
      worktreeApplyTimerRef.current = null;
    }
  }, [workspaceId]);

  const refreshGitData = useCallback(() => {
    onRefreshGitStatus();
    onRefreshGitDiffs();
  }, [onRefreshGitDiffs, onRefreshGitStatus]);

  const isStaleGitChangePathError = useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    return message.toLowerCase().includes("git change not found for path");
  }, []);

  const runGitFileAction = useCallback(
    async (actionWorkspaceId: string, action: () => Promise<void>) => {
      try {
        await action();
      } catch (error) {
        if (!isStaleGitChangePathError(error) || workspaceIdRef.current !== actionWorkspaceId) {
          throw error;
        }
        refreshGitData();
        await action();
      }
    },
    [isStaleGitChangePathError, refreshGitData]
  );

  const stageGitFile = useCallback(
    async (path: string) => {
      if (!workspaceId) {
        return;
      }
      const actionWorkspaceId = workspaceId;
      try {
        await runGitFileAction(actionWorkspaceId, () =>
          stageGitFileService(actionWorkspaceId, path)
        );
      } catch (error) {
        onError?.(error);
      } finally {
        if (workspaceIdRef.current === actionWorkspaceId) {
          refreshGitData();
        }
      }
    },
    [onError, refreshGitData, runGitFileAction, workspaceId]
  );

  const stageGitAll = useCallback(async () => {
    if (!workspaceId) {
      return;
    }
    const actionWorkspaceId = workspaceId;
    try {
      await stageGitAllService(actionWorkspaceId);
    } catch (error) {
      onError?.(error);
    } finally {
      if (workspaceIdRef.current === actionWorkspaceId) {
        refreshGitData();
      }
    }
  }, [onError, refreshGitData, workspaceId]);

  const unstageGitFile = useCallback(
    async (path: string) => {
      if (!workspaceId) {
        return;
      }
      const actionWorkspaceId = workspaceId;
      try {
        await runGitFileAction(actionWorkspaceId, () =>
          unstageGitFileService(actionWorkspaceId, path)
        );
      } catch (error) {
        onError?.(error);
      } finally {
        if (workspaceIdRef.current === actionWorkspaceId) {
          refreshGitData();
        }
      }
    },
    [onError, refreshGitData, runGitFileAction, workspaceId]
  );

  const revertGitFile = useCallback(
    async (path: string) => {
      if (!workspaceId) {
        return;
      }
      const actionWorkspaceId = workspaceId;
      try {
        await runGitFileAction(actionWorkspaceId, () =>
          revertGitFileService(actionWorkspaceId, path)
        );
      } catch (error) {
        onError?.(error);
      } finally {
        if (workspaceIdRef.current === actionWorkspaceId) {
          refreshGitData();
        }
      }
    },
    [onError, refreshGitData, runGitFileAction, workspaceId]
  );

  const revertAllGitChanges = useCallback(async () => {
    if (!workspaceId) {
      return;
    }
    const confirmed = await confirmWarning(
      "Revert all changes in this repo?\n\nThis will discard all staged and unstaged changes, including untracked files.",
      "Revert all changes"
    );
    if (!confirmed) {
      return;
    }
    try {
      await revertGitAll(workspaceId);
      refreshGitData();
    } catch (error) {
      onError?.(error);
    }
  }, [confirmWarning, onError, refreshGitData, workspaceId]);

  const applyWorktreeChanges = useCallback(async () => {
    if (!workspaceId || !isWorktree) {
      return;
    }
    const applyWorkspaceId = workspaceId;
    setWorktreeApplyError(null);
    setWorktreeApplySuccess(false);
    setWorktreeApplyLoading(true);
    try {
      await applyWorktreeChangesService(applyWorkspaceId);
      if (workspaceIdRef.current !== applyWorkspaceId) {
        return;
      }
      if (worktreeApplyTimerRef.current) {
        window.clearTimeout(worktreeApplyTimerRef.current);
      }
      setWorktreeApplySuccess(true);
      worktreeApplyTimerRef.current = window.setTimeout(() => {
        if (workspaceIdRef.current !== applyWorkspaceId) {
          return;
        }
        setWorktreeApplySuccess(false);
        worktreeApplyTimerRef.current = null;
      }, 2500);
    } catch (error) {
      if (workspaceIdRef.current !== applyWorkspaceId) {
        return;
      }
      setWorktreeApplyError(error instanceof Error ? error.message : String(error));
    } finally {
      if (workspaceIdRef.current === applyWorkspaceId) {
        setWorktreeApplyLoading(false);
      }
    }
  }, [isWorktree, workspaceId]);

  return {
    applyWorktreeChanges,
    revertAllGitChanges,
    revertGitFile,
    stageGitAll,
    stageGitFile,
    unstageGitFile,
    worktreeApplyError,
    worktreeApplyLoading,
    worktreeApplySuccess,
  };
}
