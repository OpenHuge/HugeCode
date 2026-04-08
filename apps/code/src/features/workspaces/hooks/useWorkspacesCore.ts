import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import {
  readPersistedActiveWorkspaceId,
  writePersistedActiveWorkspaceId,
} from "../../../application/runtime/ports/threadSnapshots";
import { detectRuntimeMode } from "../../../application/runtime/ports/runtimeClientMode";
import {
  addClone as addCloneService,
  addWorkspace as addWorkspaceService,
  addWorktree as addWorktreeService,
  updateWorkspaceCodexBin as updateWorkspaceCodexBinService,
  updateWorkspaceSettings as updateWorkspaceSettingsService,
} from "../../../application/runtime/ports/workspaceMutations";
import {
  isWorkspacePathDir as isWorkspacePathDirService,
  pickWorkspacePaths,
} from "../../../application/runtime/ports/workspaceDialogs";
import type { AppSettings, DebugEntry, WorkspaceInfo, WorkspaceSettings } from "../../../types";
import { useWorkspaceCollectionState } from "./useWorkspaceCollectionState";
import { useWorkspaceGrouping } from "./useWorkspaceGrouping";
import { useWorkspaceGroupMutations } from "./useWorkspaceGroupMutations";
import { useWorkspaceItemMutations } from "./useWorkspaceItemMutations";
import {
  desktopWorkspaceNavigation,
  setWorkspaceRouteRestoreSelection,
  useDesktopMissionHomeRoute,
  useWorkspaceRouteSelection,
} from "./workspaceRoute";
import {
  applyWebRuntimeWorkspaceSidebarCollapseState,
  isWorkspacePathValidationUnavailableError,
  messageWithFallback,
  normalizeWorkspacePathKey,
  supportsWorkspacePathValidation,
  writeWebRuntimeWorkspaceSidebarCollapsed,
  writeWebRuntimeWorkspaceSortOrder,
} from "./useWorkspaces.helpers";
import { recordSentryMetric } from "../../shared/sentry";

type UseWorkspacesOptions = {
  onDebug?: (entry: DebugEntry) => void;
  defaultCodexBin?: string | null;
  appSettings?: AppSettings;
  appSettingsLoading?: boolean;
  onUpdateAppSettings?: (next: AppSettings) => Promise<AppSettings>;
};

function resolveRouteWorkspaceId(
  workspaces: WorkspaceInfo[],
  routeWorkspaceId: string
): string | null {
  const exactMatch = workspaces.find((workspace) => workspace.id === routeWorkspaceId);
  if (exactMatch) {
    return exactMatch.id;
  }

  const normalizedRouteWorkspaceId = routeWorkspaceId.trim().toLowerCase();
  if (!normalizedRouteWorkspaceId) {
    return null;
  }

  const nameMatches = workspaces.filter(
    (workspace) => workspace.name.trim().toLowerCase() === normalizedRouteWorkspaceId
  );
  if (nameMatches.length !== 1) {
    return null;
  }

  return nameMatches[0]?.id ?? null;
}

export function useWorkspaces(options: UseWorkspacesOptions = {}) {
  const {
    workspaces,
    setWorkspaces,
    hasLoaded,
    workspaceLoadError,
    deletingWorktreeIds,
    setDeletingWorktreeIds,
    workspaceSettingsRef,
    workspaceById,
    refreshWorkspaces,
  } = useWorkspaceCollectionState();
  const {
    onDebug,
    defaultCodexBin,
    appSettings,
    appSettingsLoading = false,
    onUpdateAppSettings,
  } = options;
  const {
    workspaceGroups,
    workspaceGroupById,
    groupedWorkspaces,
    getWorkspaceGroupName,
    ungroupedLabel,
  } = useWorkspaceGrouping({
    appSettings,
    workspaces,
    workspaceById,
  });
  const [persistedActiveWorkspaceReady, setPersistedActiveWorkspaceReady] = useState(false);
  const [nativePersistedActiveWorkspaceId, setNativePersistedActiveWorkspaceId] = useState<
    string | null
  >(null);
  const persistedActiveWorkspaceIdRef = useRef<string | null>(
    appSettings?.lastActiveWorkspaceId ?? null
  );
  const routeSelection = useWorkspaceRouteSelection();
  const showMissionHomeRoute = useDesktopMissionHomeRoute();
  const hasWorkspaceRouteSelection = routeSelection.kind === "workspace";
  const isWebRuntimeLocalWorkspaceSettingsPatch = useCallback(
    (patch: Partial<WorkspaceSettings>) => {
      const patchKeys = Object.keys(patch);
      return (
        patchKeys.length > 0 &&
        patchKeys.every((key) => key === "sidebarCollapsed" || key === "sortOrder")
      );
    },
    []
  );
  const activeWorkspaceId = useMemo(() => {
    if (routeSelection.kind !== "workspace") {
      return null;
    }
    return resolveRouteWorkspaceId(workspaces, routeSelection.workspaceId);
  }, [routeSelection, workspaces]);

  useEffect(() => {
    if (routeSelection.kind !== "workspace" || activeWorkspaceId === null) {
      return;
    }
    if (routeSelection.workspaceId === activeWorkspaceId) {
      return;
    }
    void desktopWorkspaceNavigation.navigateToWorkspace(activeWorkspaceId, { replace: true });
  }, [activeWorkspaceId, routeSelection]);

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null,
    [activeWorkspaceId, workspaces]
  );

  const setActiveWorkspaceId = useCallback(
    (nextWorkspaceId: SetStateAction<string | null>) => {
      const resolvedWorkspaceId =
        typeof nextWorkspaceId === "function"
          ? nextWorkspaceId(activeWorkspaceId)
          : nextWorkspaceId;
      if (resolvedWorkspaceId === null) {
        void desktopWorkspaceNavigation.navigateHome({ replace: true });
        return;
      }
      void desktopWorkspaceNavigation.navigateToWorkspace(resolvedWorkspaceId, { replace: true });
    },
    [activeWorkspaceId]
  );

  useEffect(() => {
    persistedActiveWorkspaceIdRef.current = appSettings?.lastActiveWorkspaceId ?? null;
  }, [appSettings?.lastActiveWorkspaceId]);

  useEffect(() => {
    let cancelled = false;
    void readPersistedActiveWorkspaceId()
      .then((workspaceId) => {
        if (cancelled) {
          return;
        }
        setNativePersistedActiveWorkspaceId(workspaceId);
        setPersistedActiveWorkspaceReady(true);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        onDebug?.({
          id: `${Date.now()}-client-restore-active-workspace-error`,
          timestamp: Date.now(),
          source: "error",
          label: "workspace/active/restore error",
          payload: error instanceof Error ? error.message : String(error),
        });
        setPersistedActiveWorkspaceReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [onDebug]);

  useEffect(() => {
    if (!persistedActiveWorkspaceReady || appSettingsLoading) {
      return;
    }
    const persistedWorkspaceId =
      nativePersistedActiveWorkspaceId ?? appSettings?.lastActiveWorkspaceId ?? null;
    if (
      persistedWorkspaceId &&
      !workspaces.some((workspace) => workspace.id === persistedWorkspaceId)
    ) {
      setWorkspaceRouteRestoreSelection(null);
      return;
    }
    setWorkspaceRouteRestoreSelection(persistedWorkspaceId);
  }, [
    nativePersistedActiveWorkspaceId,
    appSettings?.lastActiveWorkspaceId,
    appSettingsLoading,
    persistedActiveWorkspaceReady,
    workspaces,
  ]);

  useEffect(() => {
    if (
      !hasLoaded ||
      !persistedActiveWorkspaceReady ||
      appSettingsLoading ||
      routeSelection.kind === "none"
    ) {
      return;
    }
    const nextActiveWorkspaceId = activeWorkspaceId ?? null;
    if (persistedActiveWorkspaceIdRef.current === nextActiveWorkspaceId) {
      return;
    }
    persistedActiveWorkspaceIdRef.current = nextActiveWorkspaceId;
    void writePersistedActiveWorkspaceId(nextActiveWorkspaceId).catch((error) => {
      onDebug?.({
        id: `${Date.now()}-client-persist-native-active-workspace-error`,
        timestamp: Date.now(),
        source: "error",
        label: "workspace/active/native persist error",
        payload: error instanceof Error ? error.message : String(error),
      });
    });
  }, [
    activeWorkspaceId,
    appSettingsLoading,
    hasLoaded,
    onDebug,
    persistedActiveWorkspaceReady,
    routeSelection.kind,
  ]);

  const addWorkspaceFromPath = useCallback(
    async (path: string, options?: { activate?: boolean }) => {
      const selection = path.trim();
      if (!selection) {
        return null;
      }
      const shouldActivate = options?.activate !== false;
      const selectionKey = normalizeWorkspacePathKey(selection);
      const existingWorkspace = workspaces.find(
        (entry) => normalizeWorkspacePathKey(entry.path) === selectionKey
      );
      if (existingWorkspace) {
        if (shouldActivate) {
          setActiveWorkspaceId(existingWorkspace.id);
        }
        return existingWorkspace;
      }
      onDebug?.({
        id: `${Date.now()}-client-add-workspace`,
        timestamp: Date.now(),
        source: "client",
        label: "workspace/add",
        payload: { path: selection },
      });
      try {
        const workspace = await addWorkspaceService(selection, defaultCodexBin ?? null);
        const workspaceKey = normalizeWorkspacePathKey(workspace.path);
        let resolvedWorkspace = workspace;
        setWorkspaces((prev) => {
          const duplicateWorkspace = prev.find((entry) => {
            const entryKey = normalizeWorkspacePathKey(entry.path);
            return entryKey === selectionKey || entryKey === workspaceKey;
          });
          if (duplicateWorkspace) {
            resolvedWorkspace = duplicateWorkspace;
            return prev;
          }
          return [...prev, workspace];
        });
        if (shouldActivate) {
          setActiveWorkspaceId(resolvedWorkspace.id);
        }
        recordSentryMetric("workspace_added", 1, {
          attributes: {
            workspace_id: resolvedWorkspace.id,
            workspace_kind: resolvedWorkspace.kind ?? "main",
          },
        });
        return resolvedWorkspace;
      } catch (error) {
        onDebug?.({
          id: `${Date.now()}-client-add-workspace-error`,
          timestamp: Date.now(),
          source: "error",
          label: "workspace/add error",
          payload: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    [defaultCodexBin, onDebug, setActiveWorkspaceId, setWorkspaces, workspaces]
  );

  const addWorkspacesFromPaths = useCallback(
    async (paths: string[]) => {
      const existingPaths = new Set(
        workspaces.map((entry) => normalizeWorkspacePathKey(entry.path))
      );
      const skippedExisting: string[] = [];
      const skippedInvalid: string[] = [];
      const failures: { path: string; message: string }[] = [];
      const added: WorkspaceInfo[] = [];

      const seenSelections = new Set<string>();
      const selections = paths
        .map((path) => path.trim())
        .filter(Boolean)
        .filter((path) => {
          const key = normalizeWorkspacePathKey(path);
          if (seenSelections.has(key)) {
            return false;
          }
          seenSelections.add(key);
          return true;
        });

      for (const selection of selections) {
        const key = normalizeWorkspacePathKey(selection);
        if (existingPaths.has(key)) {
          skippedExisting.push(selection);
          continue;
        }

        let isDir = true;
        if (supportsWorkspacePathValidation()) {
          try {
            isDir = await isWorkspacePathDirService(selection);
          } catch (error) {
            if (isWorkspacePathValidationUnavailableError(error)) {
              // Degrade to best-effort add and let workspaceCreate return the source-of-truth error.
              isDir = true;
            } else {
              failures.push({
                path: selection,
                message: error instanceof Error ? error.message : String(error),
              });
              continue;
            }
          }
        }

        if (!isDir) {
          skippedInvalid.push(selection);
          continue;
        }

        try {
          const workspace = await addWorkspaceFromPath(selection, {
            activate: added.length === 0,
          });
          if (workspace) {
            added.push(workspace);
            existingPaths.add(key);
            existingPaths.add(normalizeWorkspacePathKey(workspace.path));
          }
        } catch (error) {
          failures.push({
            path: selection,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const hasIssues =
        skippedExisting.length > 0 || skippedInvalid.length > 0 || failures.length > 0;
      if (hasIssues) {
        const lines: string[] = [];
        lines.push(`Added ${added.length} workspace${added.length === 1 ? "" : "s"}.`);
        if (skippedExisting.length > 0) {
          lines.push(
            `Skipped ${skippedExisting.length} already added workspace${
              skippedExisting.length === 1 ? "" : "s"
            }.`
          );
        }
        if (skippedInvalid.length > 0) {
          lines.push(
            `Skipped ${skippedInvalid.length} invalid path${
              skippedInvalid.length === 1 ? "" : "s"
            } (not a folder).`
          );
        }
        if (failures.length > 0) {
          lines.push(
            `Failed to add ${failures.length} workspace${failures.length === 1 ? "" : "s"}.`
          );
          const details = failures.slice(0, 3).map(({ path, message }) => `- ${path}: ${message}`);
          if (failures.length > 3) {
            details.push(`- …and ${failures.length - 3} more`);
          }
          lines.push("");
          lines.push("Failures:");
          lines.push(...details);
        }

        const summary = lines.join("\n");
        const title =
          failures.length > 0 ? "Some workspaces failed to add" : "Some workspaces were skipped";
        messageWithFallback(summary, {
          title,
          kind: failures.length > 0 ? "error" : "warning",
        });
      }

      return added[0] ?? null;
    },
    [addWorkspaceFromPath, workspaces]
  );

  const addWorkspace = useCallback(async () => {
    const selection = await pickWorkspacePaths();
    if (selection.length === 0) {
      return null;
    }
    return addWorkspacesFromPaths(selection);
  }, [addWorkspacesFromPaths]);

  const filterWorkspacePaths = useCallback(async (paths: string[]) => {
    const trimmed = paths.map((path) => path.trim()).filter(Boolean);
    if (trimmed.length === 0) {
      return [];
    }
    if (!supportsWorkspacePathValidation()) {
      return trimmed;
    }
    const checks = await Promise.all(
      trimmed.map(async (path) => ({
        path,
        isDir: await isWorkspacePathDirService(path),
      }))
    );
    return checks.filter((entry) => entry.isDir).map((entry) => entry.path);
  }, []);

  async function addWorktreeAgent(
    parent: WorkspaceInfo,
    branch: string,
    options?: {
      activate?: boolean;
      baseRef?: string | null;
      displayName?: string | null;
      copyAgentsMd?: boolean;
    }
  ) {
    const trimmed = branch.trim();
    if (!trimmed) {
      return null;
    }
    const trimmedName = options?.displayName?.trim() || null;
    const copyAgentsMd = options?.copyAgentsMd ?? true;
    const baseRef = options?.baseRef?.trim() || null;
    onDebug?.({
      id: `${Date.now()}-client-add-worktree`,
      timestamp: Date.now(),
      source: "client",
      label: "worktree/add",
      payload: {
        parentId: parent.id,
        branch: trimmed,
        name: trimmedName,
        copyAgentsMd,
        baseRef,
      },
    });
    try {
      const workspace = await addWorktreeService(
        parent.id,
        trimmed,
        trimmedName,
        copyAgentsMd,
        baseRef
      );
      setWorkspaces((prev) => [...prev, workspace]);
      if (options?.activate !== false) {
        setActiveWorkspaceId(workspace.id);
      }
      recordSentryMetric("worktree_agent_created", 1, {
        attributes: {
          workspace_id: workspace.id,
          parent_id: parent.id,
        },
      });
      return workspace;
    } catch (error) {
      onDebug?.({
        id: `${Date.now()}-client-add-worktree-error`,
        timestamp: Date.now(),
        source: "error",
        label: "worktree/add error",
        payload: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async function addCloneAgent(source: WorkspaceInfo, copyName: string, copiesFolder: string) {
    const trimmedName = copyName.trim();
    if (!trimmedName) {
      return null;
    }
    const trimmedFolder = copiesFolder.trim();
    if (!trimmedFolder) {
      throw new Error("Copies folder is required.");
    }
    onDebug?.({
      id: `${Date.now()}-client-add-clone`,
      timestamp: Date.now(),
      source: "client",
      label: "clone/add",
      payload: {
        sourceWorkspaceId: source.id,
        copyName: trimmedName,
        copiesFolder: trimmedFolder,
      },
    });
    try {
      const workspace = await addCloneService(source.id, trimmedFolder, trimmedName);
      setWorkspaces((prev) => [...prev, workspace]);
      setActiveWorkspaceId(workspace.id);
      recordSentryMetric("clone_agent_created", 1, {
        attributes: {
          workspace_id: workspace.id,
          parent_id: source.id,
        },
      });
      return workspace;
    } catch (error) {
      onDebug?.({
        id: `${Date.now()}-client-add-clone-error`,
        timestamp: Date.now(),
        source: "error",
        label: "clone/add error",
        payload: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  const updateWorkspaceSettings = useCallback(
    async (workspaceId: string, patch: Partial<WorkspaceSettings>) => {
      onDebug?.({
        id: `${Date.now()}-client-update-workspace-settings`,
        timestamp: Date.now(),
        source: "client",
        label: "workspace/settings",
        payload: { workspaceId, patch },
      });
      const currentWorkspace = workspaces.find((entry) => entry.id === workspaceId) ?? null;
      const currentSettings =
        workspaceSettingsRef.current.get(workspaceId) ?? currentWorkspace?.settings ?? null;
      const runtimeMode = detectRuntimeMode();
      if (runtimeMode === "runtime-gateway-web" && isWebRuntimeLocalWorkspaceSettingsPatch(patch)) {
        let localWorkspace: WorkspaceInfo | null = null;
        setWorkspaces((prev) => {
          const next = prev.map((entry) => {
            if (entry.id !== workspaceId) {
              return entry;
            }
            const nextSettings = { ...entry.settings, ...patch };
            if (typeof patch.sidebarCollapsed === "boolean") {
              writeWebRuntimeWorkspaceSidebarCollapsed(workspaceId, nextSettings.sidebarCollapsed);
            }
            if ("sortOrder" in patch) {
              writeWebRuntimeWorkspaceSortOrder(workspaceId, nextSettings.sortOrder);
            }
            localWorkspace = applyWebRuntimeWorkspaceSidebarCollapseState(
              [{ ...entry, settings: nextSettings }],
              runtimeMode
            )[0];
            workspaceSettingsRef.current.set(workspaceId, localWorkspace.settings);
            return localWorkspace;
          });
          return next;
        });
        if (localWorkspace) {
          return localWorkspace;
        }
        if (currentWorkspace && currentSettings) {
          const nextSettings = { ...currentSettings, ...patch };
          if (typeof patch.sidebarCollapsed === "boolean") {
            writeWebRuntimeWorkspaceSidebarCollapsed(workspaceId, nextSettings.sidebarCollapsed);
          }
          if ("sortOrder" in patch) {
            writeWebRuntimeWorkspaceSortOrder(workspaceId, nextSettings.sortOrder);
          }
          workspaceSettingsRef.current.set(workspaceId, nextSettings);
          return applyWebRuntimeWorkspaceSidebarCollapseState(
            [{ ...currentWorkspace, settings: nextSettings }],
            runtimeMode
          )[0];
        }
        throw new Error("workspace not found");
      }
      if (!currentWorkspace || !currentSettings) {
        throw new Error("workspace not found");
      }
      const previousSettings = currentSettings;
      const nextSettings = { ...currentSettings, ...patch };
      workspaceSettingsRef.current.set(workspaceId, nextSettings);
      setWorkspaces((prev) =>
        prev.map((entry) => {
          if (entry.id !== workspaceId) {
            return entry;
          }
          return { ...entry, settings: nextSettings };
        })
      );
      try {
        const updated = await updateWorkspaceSettingsService(workspaceId, nextSettings);
        workspaceSettingsRef.current.set(workspaceId, updated.settings);
        setWorkspaces((prev) => prev.map((entry) => (entry.id === workspaceId ? updated : entry)));
        return updated;
      } catch (error) {
        workspaceSettingsRef.current.set(workspaceId, previousSettings);
        setWorkspaces((prev) =>
          prev.map((entry) =>
            entry.id === workspaceId ? { ...entry, settings: previousSettings } : entry
          )
        );
        onDebug?.({
          id: `${Date.now()}-client-update-workspace-settings-error`,
          timestamp: Date.now(),
          source: "error",
          label: "workspace/settings error",
          payload: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    [
      isWebRuntimeLocalWorkspaceSettingsPatch,
      onDebug,
      setWorkspaces,
      workspaceSettingsRef,
      workspaces,
    ]
  );

  async function updateWorkspaceCodexBin(workspaceId: string, codexBin: string | null) {
    onDebug?.({
      id: `${Date.now()}-client-update-workspace-codex-bin`,
      timestamp: Date.now(),
      source: "client",
      label: "workspace/codexBin",
      payload: { workspaceId, codexBin },
    });
    const previous = workspaces.find((entry) => entry.id === workspaceId) ?? null;
    if (previous) {
      setWorkspaces((prev) =>
        prev.map((entry) => (entry.id === workspaceId ? { ...entry, codex_bin: codexBin } : entry))
      );
    }
    try {
      const updated = await updateWorkspaceCodexBinService(workspaceId, codexBin);
      setWorkspaces((prev) => prev.map((entry) => (entry.id === workspaceId ? updated : entry)));
      return updated;
    } catch (error) {
      if (previous) {
        setWorkspaces((prev) => prev.map((entry) => (entry.id === workspaceId ? previous : entry)));
      }
      onDebug?.({
        id: `${Date.now()}-client-update-workspace-codex-bin-error`,
        timestamp: Date.now(),
        source: "error",
        label: "workspace/codexBin error",
        payload: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  const {
    createWorkspaceGroup,
    renameWorkspaceGroup,
    moveWorkspaceGroup,
    deleteWorkspaceGroup,
    assignWorkspaceGroup,
  } = useWorkspaceGroupMutations({
    appSettings,
    onUpdateAppSettings,
    workspaceGroups,
    workspaceGroupById,
    workspaces,
    updateWorkspaceSettings,
  });
  const {
    connectWorkspace,
    markWorkspaceConnected,
    removeWorkspace,
    removeWorktree,
    renameWorktree,
    renameWorkspace,
    renameWorktreeUpstream,
  } = useWorkspaceItemMutations({
    onDebug,
    workspaces,
    setWorkspaces,
    setActiveWorkspaceId,
    setDeletingWorktreeIds,
  });

  return {
    workspaces,
    workspaceGroups,
    groupedWorkspaces,
    getWorkspaceGroupName,
    ungroupedLabel,
    activeWorkspace,
    activeWorkspaceId,
    hasWorkspaceRouteSelection,
    showMissionHomeRoute,
    setActiveWorkspaceId,
    addWorkspace,
    addWorkspaceFromPath,
    addWorkspacesFromPaths,
    filterWorkspacePaths,
    addCloneAgent,
    addWorktreeAgent,
    connectWorkspace,
    markWorkspaceConnected,
    updateWorkspaceSettings,
    updateWorkspaceCodexBin,
    createWorkspaceGroup,
    renameWorkspaceGroup,
    moveWorkspaceGroup,
    deleteWorkspaceGroup,
    assignWorkspaceGroup,
    renameWorkspace,
    removeWorkspace,
    removeWorktree,
    renameWorktree,
    renameWorktreeUpstream,
    deletingWorktreeIds,
    hasLoaded,
    workspaceLoadError,
    refreshWorkspaces,
  };
}
