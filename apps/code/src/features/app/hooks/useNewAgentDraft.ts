import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WorkspaceInfo } from "../../../types";

const STARTING_DRAFT_CLEAR_MS = 1500;
const STARTING_DRAFT_FALLBACK_MS = 4000;
const DRAFT_START_POLL_MS = 50;

type UseNewAgentDraftOptions = {
  activeWorkspace: WorkspaceInfo | null;
  activeWorkspaceId: string | null;
  activeThreadId: string | null;
};

export function useNewAgentDraft({
  activeWorkspace,
  activeWorkspaceId,
  activeThreadId,
}: UseNewAgentDraftOptions) {
  const clearStartingTimeoutRef = useRef<number | null>(null);
  const draftStartChainByWorkspaceRef = useRef<Record<string, Promise<unknown>>>({});
  const latestActiveWorkspaceIdRef = useRef<string | null>(activeWorkspaceId);
  const latestActiveThreadIdRef = useRef<string | null>(activeThreadId);
  const [newAgentDraftWorkspaceId, setNewAgentDraftWorkspaceId] = useState<string | null>(null);
  const [startingDraftThreadWorkspaceId, setStartingDraftThreadWorkspaceId] = useState<
    string | null
  >(null);

  useEffect(() => {
    latestActiveWorkspaceIdRef.current = activeWorkspaceId;
    latestActiveThreadIdRef.current = activeThreadId;
  }, [activeThreadId, activeWorkspaceId]);

  const clearStartingTimeout = useCallback(() => {
    if (clearStartingTimeoutRef.current !== null) {
      window.clearTimeout(clearStartingTimeoutRef.current);
      clearStartingTimeoutRef.current = null;
    }
  }, []);

  const clearDraftState = useCallback(() => {
    clearStartingTimeout();
    setNewAgentDraftWorkspaceId(null);
    setStartingDraftThreadWorkspaceId(null);
  }, [clearStartingTimeout]);

  useEffect(() => () => clearStartingTimeout(), [clearStartingTimeout]);

  useEffect(() => {
    if (!activeWorkspaceId) {
      clearDraftState();
      return;
    }
    if (activeThreadId && newAgentDraftWorkspaceId === activeWorkspaceId) {
      setNewAgentDraftWorkspaceId(null);
      clearStartingTimeout();
      clearStartingTimeoutRef.current = window.setTimeout(() => {
        clearStartingTimeoutRef.current = null;
        setStartingDraftThreadWorkspaceId((current) =>
          current === activeWorkspaceId ? null : current
        );
      }, STARTING_DRAFT_CLEAR_MS);
    }
  }, [
    activeThreadId,
    activeWorkspaceId,
    clearDraftState,
    clearStartingTimeout,
    newAgentDraftWorkspaceId,
  ]);

  const isDraftModeForActiveWorkspace = useMemo(
    () =>
      Boolean(
        activeWorkspaceId && !activeThreadId && newAgentDraftWorkspaceId === activeWorkspaceId
      ),
    [activeThreadId, activeWorkspaceId, newAgentDraftWorkspaceId]
  );

  const startNewAgentDraft = useCallback(
    (workspaceId: string) => {
      clearStartingTimeout();
      setNewAgentDraftWorkspaceId(workspaceId);
      setStartingDraftThreadWorkspaceId(null);
    },
    [clearStartingTimeout]
  );

  const clearDraftStateIfDifferentWorkspace = useCallback(
    (workspaceId: string) => {
      if (workspaceId !== newAgentDraftWorkspaceId) {
        clearDraftState();
      }
    },
    [clearDraftState, newAgentDraftWorkspaceId]
  );

  const waitForDraftThreadActivation = useCallback((workspaceId: string) => {
    return new Promise<boolean>((resolve) => {
      const finish = (activated: boolean, intervalId?: number) => {
        if (typeof intervalId === "number") {
          window.clearInterval(intervalId);
        }
        resolve(activated);
      };
      if (
        latestActiveWorkspaceIdRef.current === workspaceId &&
        latestActiveThreadIdRef.current !== null
      ) {
        finish(true);
        return;
      }
      const startedAt = Date.now();
      const intervalId = window.setInterval(() => {
        if (
          latestActiveWorkspaceIdRef.current === workspaceId &&
          latestActiveThreadIdRef.current !== null
        ) {
          finish(true, intervalId);
          return;
        }
        if (Date.now() - startedAt >= STARTING_DRAFT_FALLBACK_MS) {
          finish(false, intervalId);
        }
      }, DRAFT_START_POLL_MS);
    });
  }, []);

  const runWithDraftStart = useCallback(
    async <T>(runner: () => Promise<T>): Promise<T> => {
      const shouldMarkStarting = Boolean(activeWorkspace && !activeThreadId);
      const draftWorkspaceId = activeWorkspace?.id ?? null;
      if (shouldMarkStarting && draftWorkspaceId) {
        clearStartingTimeout();
        setStartingDraftThreadWorkspaceId(draftWorkspaceId);
        const previous =
          draftStartChainByWorkspaceRef.current[draftWorkspaceId] ?? Promise.resolve();
        const runnerPromise = previous
          .catch(() => {
            // Keep the chain alive even if a previous send fails.
          })
          .then(() => runner());
        const current = runnerPromise
          .then(async (result) => {
            try {
              const activated = await waitForDraftThreadActivation(draftWorkspaceId);
              if (activated) {
                return result;
              }
              clearStartingTimeout();
              setStartingDraftThreadWorkspaceId((value) =>
                value === draftWorkspaceId ? null : value
              );
              return result;
            } catch (error) {
              clearStartingTimeout();
              setStartingDraftThreadWorkspaceId((value) =>
                value === draftWorkspaceId ? null : value
              );
              throw error;
            }
          })
          .finally(() => {
            if (draftStartChainByWorkspaceRef.current[draftWorkspaceId] === current) {
              delete draftStartChainByWorkspaceRef.current[draftWorkspaceId];
            }
          });
        draftStartChainByWorkspaceRef.current[draftWorkspaceId] = current;
        try {
          return await runnerPromise;
        } catch (error) {
          clearStartingTimeout();
          setStartingDraftThreadWorkspaceId((value) => (value === draftWorkspaceId ? null : value));
          throw error;
        }
      }

      return await runner();
    },
    [activeThreadId, activeWorkspace, clearStartingTimeout, waitForDraftThreadActivation]
  );

  return {
    newAgentDraftWorkspaceId,
    startingDraftThreadWorkspaceId,
    isDraftModeForActiveWorkspace,
    startNewAgentDraft,
    clearDraftState,
    clearDraftStateIfDifferentWorkspace,
    runWithDraftStart,
  };
}
