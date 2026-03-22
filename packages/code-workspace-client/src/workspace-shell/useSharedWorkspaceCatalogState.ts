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

  const activeWorkspaceId = useMemo(() => {
    if (routeSelection.kind !== "workspace") {
      return null;
    }
    return catalogState.workspaces.some((entry) => entry.id === routeSelection.workspaceId)
      ? routeSelection.workspaceId
      : null;
  }, [catalogState.workspaces, routeSelection]);

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

  return {
    workspaces: catalogState.workspaces,
    activeWorkspaceId,
    activeWorkspace,
    loadState: catalogState.loadState,
    error: catalogState.error,
    refresh,
    selectWorkspace,
  };
}
