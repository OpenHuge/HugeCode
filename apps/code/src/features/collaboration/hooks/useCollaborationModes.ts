import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getFallbackCollaborationModes,
  loadRuntimeCollaborationModes,
  pickDefaultCollaborationModeId,
} from "../../../application/runtime/ports/runtimeCollaborationModes";
import type { CollaborationModeOption, DebugEntry, WorkspaceInfo } from "../../../types";
type UseCollaborationModesOptions = {
  activeWorkspace: WorkspaceInfo | null;
  enabled: boolean;
  preferredModeId?: string | null;
  selectionKey?: string | null;
  onDebug?: (entry: DebugEntry) => void;
};

export function useCollaborationModes({
  activeWorkspace,
  enabled,
  preferredModeId = null,
  selectionKey = null,
  onDebug,
}: UseCollaborationModesOptions) {
  const [modes, setModes] = useState<CollaborationModeOption[]>([]);
  const [selectedModeId, setSelectedModeId] = useState<string | null>(null);
  const lastFetchedWorkspaceId = useRef<string | null>(null);
  const previousWorkspaceId = useRef<string | null>(null);
  const inFlight = useRef(false);
  const refreshQueued = useRef(false);
  const latestWorkspaceIdRef = useRef<string | null>(null);
  const refreshModesRef = useRef<() => Promise<void>>(async () => undefined);
  const selectedModeIdRef = useRef<string | null>(null);
  const lastSelectionKey = useRef<string | null>(null);
  const lastEnabled = useRef(enabled);

  const workspaceId = activeWorkspace?.id ?? null;
  const isConnected = Boolean(activeWorkspace?.connected);
  const fallbackModes = useMemo(() => getFallbackCollaborationModes(), []);

  useEffect(() => {
    latestWorkspaceIdRef.current = workspaceId;
    if (!enabled || !isConnected) {
      lastFetchedWorkspaceId.current = null;
    }
  }, [enabled, isConnected, workspaceId]);

  const selectedMode = useMemo(
    () => modes.find((mode) => mode.id === selectedModeId) ?? null,
    [modes, selectedModeId]
  );

  const refreshModes = useCallback(async () => {
    if (!workspaceId || !isConnected || !enabled) {
      return;
    }
    if (inFlight.current) {
      refreshQueued.current = true;
      return;
    }
    inFlight.current = true;
    const workspaceIdAtRequest = workspaceId;
    onDebug?.({
      id: `${Date.now()}-client-collaboration-mode-list`,
      timestamp: Date.now(),
      source: "client",
      label: "collaborationMode/list",
      payload: { workspaceId },
    });
    try {
      const data = await loadRuntimeCollaborationModes(workspaceId);
      onDebug?.({
        id: `${Date.now()}-server-collaboration-mode-list`,
        timestamp: Date.now(),
        source: "server",
        label: "collaborationMode/list response",
        payload: data,
      });
      if (latestWorkspaceIdRef.current !== workspaceIdAtRequest) {
        return;
      }
      setModes(data);
      lastFetchedWorkspaceId.current = workspaceIdAtRequest;
      const workspaceDefaultModeId = pickDefaultCollaborationModeId(data);
      setSelectedModeId((currentSelection) => {
        const selection = currentSelection ?? selectedModeIdRef.current;
        if (!selection) {
          return workspaceDefaultModeId;
        }
        if (!data.some((mode) => mode.id === selection)) {
          return workspaceDefaultModeId;
        }
        return selection;
      });
    } catch (error) {
      if (latestWorkspaceIdRef.current !== workspaceIdAtRequest) {
        return;
      }
      const fallbackModes = getFallbackCollaborationModes();
      setModes(fallbackModes);
      lastFetchedWorkspaceId.current = workspaceIdAtRequest;
      const workspaceDefaultModeId = pickDefaultCollaborationModeId(fallbackModes);
      setSelectedModeId((currentSelection) => currentSelection ?? workspaceDefaultModeId);
      onDebug?.({
        id: `${Date.now()}-client-collaboration-mode-list-error`,
        timestamp: Date.now(),
        source: "error",
        label: "collaborationMode/list error",
        payload: error instanceof Error ? error.message : String(error),
      });
    } finally {
      inFlight.current = false;
      if (refreshQueued.current) {
        refreshQueued.current = false;
        void refreshModesRef.current();
      }
    }
  }, [enabled, isConnected, onDebug, workspaceId]);

  useEffect(() => {
    refreshModesRef.current = refreshModes;
  }, [refreshModes]);

  useEffect(() => {
    selectedModeIdRef.current = selectedModeId;
  }, [selectedModeId]);

  useEffect(() => {
    const wasEnabled = lastEnabled.current;
    lastEnabled.current = enabled;
    if (!enabled) {
      return;
    }
    const enabledJustReenabled = !wasEnabled;
    if (!enabledJustReenabled && selectionKey === lastSelectionKey.current) {
      return;
    }
    lastSelectionKey.current = selectionKey;
    // When switching threads, prefer the per-thread override. If there is no stored override,
    // reset to the workspace default instead of carrying over the previous thread's selection.
    // Also validate that a stored override still exists; otherwise fall back to the workspace default
    // so collaboration payload generation remains enabled.
    setSelectedModeId(() => {
      if (!modes.length) {
        // If modes aren't loaded yet, keep the preferred ID (if any) until refresh validates it.
        return preferredModeId;
      }
      if (preferredModeId && modes.some((mode) => mode.id === preferredModeId)) {
        return preferredModeId;
      }
      return pickDefaultCollaborationModeId(modes);
    });
  }, [enabled, modes, preferredModeId, selectionKey]);

  useEffect(() => {
    if (previousWorkspaceId.current !== workspaceId) {
      previousWorkspaceId.current = workspaceId;
      setModes([]);
      lastFetchedWorkspaceId.current = null;
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!enabled) {
      setModes([]);
      setSelectedModeId(null);
      lastFetchedWorkspaceId.current = null;
      return;
    }
    if (!workspaceId || !isConnected) {
      setModes(fallbackModes);
      setSelectedModeId((currentSelection) => {
        const selection = currentSelection ?? preferredModeId;
        if (selection && fallbackModes.some((mode) => mode.id === selection)) {
          return selection;
        }
        return pickDefaultCollaborationModeId(fallbackModes);
      });
      lastFetchedWorkspaceId.current = null;
      return;
    }
    const alreadyFetchedForWorkspace = lastFetchedWorkspaceId.current === workspaceId;
    if (alreadyFetchedForWorkspace) {
      return;
    }
    refreshModes();
  }, [enabled, fallbackModes, isConnected, preferredModeId, refreshModes, workspaceId]);

  return {
    collaborationModes: modes,
    selectedCollaborationMode: selectedMode,
    selectedCollaborationModeId: selectedModeId,
    setSelectedCollaborationModeId: setSelectedModeId,
    refreshCollaborationModes: refreshModes,
  };
}
