import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  useWorkspaceClientNavigation,
  useWorkspaceClientRuntimeBindings,
} from "../workspace/WorkspaceClientBindingsProvider";
import { getWorkspaceCatalogStore } from "./workspaceCatalogStore";

export function useSharedWorkspaceCatalogState() {
  const navigation = useWorkspaceClientNavigation();
  const runtime = useWorkspaceClientRuntimeBindings();
  const catalogStore = useMemo(() => getWorkspaceCatalogStore(runtime), [runtime]);
  const catalogState = useSyncExternalStore(
    catalogStore.subscribe,
    catalogStore.getSnapshot,
    catalogStore.getSnapshot
  );
  const routeSelection = useSyncExternalStore(
    navigation.subscribeRouteSelection,
    navigation.readRouteSelection,
    navigation.readRouteSelection
  );
  const refresh = useCallback(() => catalogStore.refresh(), [catalogStore]);
  const routeWorkspaceId = routeSelection.kind === "workspace" ? routeSelection.workspaceId : null;

  const activeWorkspaceId = useMemo(() => {
    if (routeWorkspaceId === null) {
      return null;
    }
    if (catalogState.workspaces.some((entry) => entry.id === routeWorkspaceId)) {
      return routeWorkspaceId;
    }
    return catalogState.loadState === "idle" ||
      catalogState.loadState === "loading" ||
      catalogState.loadState === "refreshing"
      ? routeWorkspaceId
      : null;
  }, [catalogState.loadState, catalogState.workspaces, routeWorkspaceId]);

  const selectWorkspace = useCallback(
    (workspaceId: string | null) => {
      if (workspaceId === null) {
        void navigation.navigateHome();
        return;
      }
      void navigation.navigateToWorkspace(workspaceId);
    },
    [navigation]
  );

  const activeWorkspace = useMemo(
    () => catalogState.workspaces.find((entry) => entry.id === activeWorkspaceId) ?? null,
    [activeWorkspaceId, catalogState.workspaces]
  );
  const hasPendingWorkspaceSelection =
    activeWorkspaceId !== null &&
    activeWorkspace === null &&
    (catalogState.loadState === "idle" ||
      catalogState.loadState === "loading" ||
      catalogState.loadState === "refreshing");

  return {
    workspaces: catalogState.workspaces,
    activeWorkspaceId,
    activeWorkspace,
    hasPendingWorkspaceSelection,
    loadState: catalogState.loadState,
    error: catalogState.error,
    refresh,
    selectWorkspace,
  };
}
