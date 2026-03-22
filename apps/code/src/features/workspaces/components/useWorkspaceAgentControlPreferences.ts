import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { subscribeScopedRuntimeUpdatedEvents } from "../../../application/runtime/ports/runtimeUpdatedEvents";
import {
  getAppSettings,
  updateAppSettings,
} from "../../../application/runtime/ports/tauriAppSettings";
import type { AppSettings, WorkspaceAgentControlPersistedState } from "../../../types";
import {
  DEFAULT_PERSISTED_AGENT_CONTROLS,
  readCachedState,
  resolvePersistedAgentControls,
  type WorkspaceAgentControlPersistedControls,
} from "./workspaceHomeAgentControlState";

export type WorkspaceAgentControlPreferencesStatus = "loading" | "ready" | "saving" | "error";

export type WorkspaceAgentControlPatch = Partial<WorkspaceAgentControlPersistedControls>;

type WorkspaceAgentControlPreferencesResult = {
  controls: WorkspaceAgentControlPersistedControls;
  status: WorkspaceAgentControlPreferencesStatus;
  error: string | null;
  applyPatch: (
    patch: WorkspaceAgentControlPatch
  ) => Promise<WorkspaceAgentControlPersistedControls>;
};

function getWorkspaceAgentControlEntry(
  settings: AppSettings,
  workspaceId: string
): WorkspaceAgentControlPersistedState | null {
  return settings.workspaceAgentControlByWorkspaceId?.[workspaceId] ?? null;
}

function resolveErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "Unable to persist workspace agent control preferences.";
}

export function useWorkspaceAgentControlPreferences(
  workspaceId: string
): WorkspaceAgentControlPreferencesResult {
  const cachedState = useMemo(() => readCachedState(workspaceId), [workspaceId]);
  const cachedControls =
    cachedState?.lastKnownPersistedControls ?? DEFAULT_PERSISTED_AGENT_CONTROLS;
  const [controls, setControls] = useState<WorkspaceAgentControlPersistedControls>(cachedControls);
  const [status, setStatus] = useState<WorkspaceAgentControlPreferencesStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const lastLoadIdRef = useRef(0);

  useEffect(() => {
    setControls(cachedControls);
    setStatus("loading");
    setError(null);
  }, [cachedControls, workspaceId]);

  const refreshFromRuntime = useCallback(
    async (markLoading: boolean) => {
      const loadId = lastLoadIdRef.current + 1;
      lastLoadIdRef.current = loadId;
      if (markLoading) {
        setStatus("loading");
      }
      try {
        const settings = await getAppSettings();
        if (lastLoadIdRef.current !== loadId) {
          return;
        }
        setControls(
          resolvePersistedAgentControls(getWorkspaceAgentControlEntry(settings, workspaceId))
        );
        setStatus("ready");
        setError(null);
      } catch (loadError) {
        if (lastLoadIdRef.current !== loadId) {
          return;
        }
        setStatus("error");
        setError(resolveErrorMessage(loadError));
      }
    },
    [workspaceId]
  );

  useEffect(() => {
    void refreshFromRuntime(true);
    return subscribeScopedRuntimeUpdatedEvents(
      {
        workspaceId,
        scopes: ["bootstrap", "workspaces"],
      },
      () => {
        void refreshFromRuntime(false);
      }
    );
  }, [refreshFromRuntime, workspaceId]);

  const applyPatch = useCallback(
    async (patch: WorkspaceAgentControlPatch) => {
      setStatus("saving");
      setError(null);
      try {
        const settings = await getAppSettings();
        const currentControls = resolvePersistedAgentControls(
          getWorkspaceAgentControlEntry(settings, workspaceId)
        );
        const nextControls = {
          ...currentControls,
          ...patch,
        };
        const saved = await updateAppSettings({
          ...settings,
          workspaceAgentControlByWorkspaceId: {
            ...(settings.workspaceAgentControlByWorkspaceId ?? {}),
            [workspaceId]: nextControls,
          },
        });
        const persistedControls = resolvePersistedAgentControls(
          getWorkspaceAgentControlEntry(saved, workspaceId)
        );
        setControls(persistedControls);
        setStatus("ready");
        return persistedControls;
      } catch (saveError) {
        const errorMessage = resolveErrorMessage(saveError);
        setStatus((currentStatus) => (currentStatus === "saving" ? "ready" : currentStatus));
        setError(errorMessage);
        await Promise.resolve();
        throw saveError;
      }
    },
    [workspaceId]
  );

  return {
    controls,
    status,
    error,
    applyPatch,
  };
}
