import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { logger } from "../../../application/runtime/ports/logger";
import { RuntimeUnavailableError } from "../../../application/runtime/ports/runtimeClient";
import { detectRuntimeMode } from "../../../application/runtime/ports/runtimeClientMode";
import { useScopedRuntimeUpdatedEvent } from "../../../application/runtime/ports/runtimeUpdatedEvents";
import { listWorkspaces } from "../../../application/runtime/ports/workspaceCatalog";
import type { WorkspaceInfo, WorkspaceSettings } from "../../../types";
import { normalizeWorkspaceLoadError } from "./useWorkspaces.helpers";
import { applyWebRuntimeWorkspaceSidebarCollapseState } from "./useWorkspaces.helpers";

const WORKSPACE_LOAD_ERROR_LOG_THROTTLE_MS = 15_000;
const WORKSPACE_RUNTIME_REFRESH_DEBOUNCE_MS = 200;
const WORKSPACE_RUNTIME_REFRESH_SKIP_REASONS = new Set([
  "event_replay_gap",
  "event_stream_lagged",
  "stream_reconnected",
]);

type WorkspaceLoadErrorLogState = {
  key: string | null;
  lastLoggedAt: number;
  suppressed: number;
};

export function useWorkspaceCollectionState() {
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [workspaceLoadError, setWorkspaceLoadError] = useState<string | null>(null);
  const [deletingWorktreeIds, setDeletingWorktreeIds] = useState<Set<string>>(() => new Set());
  const workspaceSettingsRef = useRef<Map<string, WorkspaceSettings>>(new Map());
  const workspacesRuntimeUpdatedEvent = useScopedRuntimeUpdatedEvent({
    scopes: ["workspaces"],
  });
  const workspaceLoadErrorLogRef = useRef<WorkspaceLoadErrorLogState>({
    key: null,
    lastLoggedAt: 0,
    suppressed: 0,
  });

  const logWorkspaceLoadError = useCallback((error: unknown) => {
    const message = normalizeWorkspaceLoadError(error);
    const key = message.toLowerCase();
    const now = Date.now();
    const previous = workspaceLoadErrorLogRef.current;

    if (
      previous.key === key &&
      now - previous.lastLoggedAt < WORKSPACE_LOAD_ERROR_LOG_THROTTLE_MS
    ) {
      workspaceLoadErrorLogRef.current = {
        ...previous,
        suppressed: previous.suppressed + 1,
      };
      return;
    }

    if (previous.suppressed > 0 && previous.key) {
      logger.warn(
        `[workspaces] Suppressed ${previous.suppressed} repeated workspace load errors: ${previous.key}`
      );
    }

    logger.error(`Failed to load workspaces: ${message}`);
    workspaceLoadErrorLogRef.current = {
      key,
      lastLoggedAt: now,
      suppressed: 0,
    };
  }, []);

  const refreshWorkspaces = useCallback(async () => {
    if (detectRuntimeMode() === "unavailable") {
      setWorkspaces([]);
      setWorkspaceLoadError(
        normalizeWorkspaceLoadError(new RuntimeUnavailableError("list workspaces"))
      );
      setHasLoaded(true);
      workspaceLoadErrorLogRef.current = {
        key: null,
        lastLoggedAt: 0,
        suppressed: 0,
      };
      return [];
    }

    try {
      const runtimeMode = detectRuntimeMode();
      const entries = applyWebRuntimeWorkspaceSidebarCollapseState(
        await listWorkspaces(),
        runtimeMode
      );
      setWorkspaces(entries);
      setWorkspaceLoadError(null);
      setHasLoaded(true);
      workspaceLoadErrorLogRef.current = {
        key: null,
        lastLoggedAt: 0,
        suppressed: 0,
      };
      return entries;
    } catch (err) {
      logWorkspaceLoadError(err);
      setWorkspaceLoadError(normalizeWorkspaceLoadError(err));
      setHasLoaded(true);
      return undefined;
    }
  }, [logWorkspaceLoadError]);

  useEffect(() => {
    void refreshWorkspaces();
  }, [refreshWorkspaces]);

  const refreshWorkspacesRef = useRef(refreshWorkspaces);
  useEffect(() => {
    refreshWorkspacesRef.current = refreshWorkspaces;
  }, [refreshWorkspaces]);

  useEffect(() => {
    const runtimeUpdatedEvent = workspacesRuntimeUpdatedEvent.lastEvent;
    if (!runtimeUpdatedEvent) {
      return;
    }
    if (WORKSPACE_RUNTIME_REFRESH_SKIP_REASONS.has(runtimeUpdatedEvent.reason)) {
      return;
    }
    const debounceTimer = setTimeout(() => {
      void refreshWorkspacesRef.current();
    }, WORKSPACE_RUNTIME_REFRESH_DEBOUNCE_MS);
    return () => {
      clearTimeout(debounceTimer);
    };
  }, [workspacesRuntimeUpdatedEvent]);

  useEffect(() => {
    const next = new Map<string, WorkspaceSettings>();
    workspaces.forEach((entry) => {
      next.set(entry.id, entry.settings);
    });
    workspaceSettingsRef.current = next;
  }, [workspaces]);

  const workspaceById = useMemo(() => {
    const map = new Map<string, WorkspaceInfo>();
    workspaces.forEach((entry) => {
      map.set(entry.id, entry);
    });
    return map;
  }, [workspaces]);

  return {
    workspaces,
    setWorkspaces,
    hasLoaded,
    workspaceLoadError,
    deletingWorktreeIds,
    setDeletingWorktreeIds,
    workspaceSettingsRef,
    workspaceById,
    refreshWorkspaces,
  };
}
