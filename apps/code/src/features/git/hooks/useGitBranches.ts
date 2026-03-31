import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildGitWorkflowBranchInfo,
  ensureGitWorkflowLocalBranch,
} from "../../../application/runtime/facades/gitWorkflowFacade";
import { createGitBranch, listGitBranches } from "../../../application/runtime/ports/git";
import type { BranchInfo, DebugEntry, WorkspaceInfo } from "../../../types";

type UseGitBranchesOptions = {
  activeWorkspace: WorkspaceInfo | null;
  onDebug?: (entry: DebugEntry) => void;
};

type GitBranchesResponse = {
  currentBranch?: unknown;
  branches?: unknown;
  result?: {
    currentBranch?: unknown;
    branches?: unknown;
  } | null;
};

export function useGitBranches({ activeWorkspace, onDebug }: UseGitBranchesOptions) {
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const lastFetchedWorkspaceId = useRef<string | null>(null);
  const inFlight = useRef(false);
  const refreshQueued = useRef(false);
  const latestWorkspaceIdRef = useRef<string | null>(null);
  const refreshBranchesRef = useRef<() => Promise<void>>(async () => undefined);

  const workspaceId = activeWorkspace?.id ?? null;
  const isConnected = Boolean(activeWorkspace?.connected);

  useEffect(() => {
    latestWorkspaceIdRef.current = workspaceId;
    if (!isConnected) {
      lastFetchedWorkspaceId.current = null;
      setError(null);
    }
  }, [isConnected, workspaceId]);

  const refreshBranches = useCallback(async () => {
    if (!workspaceId || !isConnected) {
      setBranches([]);
      setError(null);
      return;
    }
    if (inFlight.current) {
      refreshQueued.current = true;
      return;
    }
    inFlight.current = true;
    const workspaceIdAtRequest = workspaceId;
    onDebug?.({
      id: `${Date.now()}-client-branches-list`,
      timestamp: Date.now(),
      source: "client",
      label: "git/branches/list",
      payload: { workspaceId },
    });
    try {
      const response = await listGitBranches(workspaceId);
      const typedResponse = response as GitBranchesResponse;
      onDebug?.({
        id: `${Date.now()}-server-branches-list`,
        timestamp: Date.now(),
        source: "server",
        label: "git/branches/list response",
        payload: response,
      });
      const data =
        typedResponse.branches ?? typedResponse.result?.branches ?? (response as unknown) ?? [];
      const normalized = Array.isArray(data)
        ? buildGitWorkflowBranchInfo(
            {
              currentBranch:
                typeof typedResponse.currentBranch === "string"
                  ? typedResponse.currentBranch
                  : typeof typedResponse.result?.currentBranch === "string"
                    ? typedResponse.result.currentBranch
                    : null,
              branches: data.map((item) => {
                const record = (item ?? {}) as {
                  name?: unknown;
                  lastCommit?: unknown;
                  last_commit?: unknown;
                };
                return {
                  name: String(record.name ?? ""),
                  lastUsedAt: Number(record.lastCommit ?? record.last_commit ?? 0),
                };
              }),
            },
            []
          )
        : [];
      if (latestWorkspaceIdRef.current !== workspaceIdAtRequest) {
        return;
      }
      setBranches(normalized.filter((branch) => branch.name));
      lastFetchedWorkspaceId.current = workspaceIdAtRequest;
      setError(null);
    } catch (err) {
      if (latestWorkspaceIdRef.current !== workspaceIdAtRequest) {
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
      onDebug?.({
        id: `${Date.now()}-client-branches-list-error`,
        timestamp: Date.now(),
        source: "error",
        label: "git/branches/list error",
        payload: err instanceof Error ? err.message : String(err),
      });
    } finally {
      inFlight.current = false;
      if (refreshQueued.current) {
        refreshQueued.current = false;
        void refreshBranchesRef.current();
      }
    }
  }, [isConnected, onDebug, workspaceId]);

  useEffect(() => {
    refreshBranchesRef.current = refreshBranches;
  }, [refreshBranches]);

  useEffect(() => {
    if (!workspaceId || !isConnected) {
      return;
    }
    if (lastFetchedWorkspaceId.current === workspaceId && branches.length > 0) {
      return;
    }
    refreshBranches();
  }, [branches.length, isConnected, refreshBranches, workspaceId]);

  const recentBranches = useMemo(
    () =>
      branches.slice().sort((a, b) => {
        if ((a.current ?? false) !== (b.current ?? false)) {
          return a.current ? -1 : 1;
        }
        return b.lastCommit - a.lastCommit;
      }),
    [branches]
  );

  const checkoutBranch = useCallback(
    async (name: string) => {
      if (!workspaceId || !name) {
        return;
      }
      onDebug?.({
        id: `${Date.now()}-client-branch-checkout`,
        timestamp: Date.now(),
        source: "client",
        label: "git/branch/checkout",
        payload: { workspaceId, name },
      });
      await ensureGitWorkflowLocalBranch(workspaceId, name);
      void refreshBranches();
    },
    [onDebug, refreshBranches, workspaceId]
  );

  const createBranch = useCallback(
    async (name: string) => {
      if (!workspaceId || !name) {
        return;
      }
      onDebug?.({
        id: `${Date.now()}-client-branch-create`,
        timestamp: Date.now(),
        source: "client",
        label: "git/branch/create",
        payload: { workspaceId, name },
      });
      await createGitBranch(workspaceId, name);
      void refreshBranches();
    },
    [onDebug, refreshBranches, workspaceId]
  );

  return {
    branches: recentBranches,
    error,
    refreshBranches,
    checkoutBranch,
    createBranch,
  };
}
