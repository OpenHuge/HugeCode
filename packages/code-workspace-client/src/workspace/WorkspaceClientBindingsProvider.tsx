import { createContext, type ReactNode, useContext, useMemo, useSyncExternalStore } from "react";
import {
  createWorkspaceClientStore,
  type WorkspaceClientBindings,
  type WorkspaceClientStore,
} from "./bindings";

const WorkspaceClientBindingsContext = createContext<WorkspaceClientStore | null>(null);

export function WorkspaceClientBindingsProvider({
  bindings,
  children,
}: {
  bindings: WorkspaceClientBindings;
  children: ReactNode;
}) {
  const store = useMemo(() => createWorkspaceClientStore(bindings), [bindings]);
  return (
    <WorkspaceClientBindingsContext.Provider value={store}>
      {children}
    </WorkspaceClientBindingsContext.Provider>
  );
}

export function useWorkspaceClientBindings(): WorkspaceClientBindings {
  const store = useContext(WorkspaceClientBindingsContext);
  if (!store) {
    throw new Error("WorkspaceClientBindingsProvider is required for WorkspaceClientApp.");
  }
  return store.bindings;
}

export function useMaybeWorkspaceClientBindings(): WorkspaceClientBindings | null {
  return useContext(WorkspaceClientBindingsContext)?.bindings ?? null;
}

export function useWorkspaceClientRuntimeBindings() {
  return useWorkspaceClientBindings().runtime;
}

export function useWorkspaceClientNavigation() {
  return useWorkspaceClientBindings().navigation;
}

export function useWorkspaceClientHostBindings() {
  return useWorkspaceClientBindings().host;
}

export function useMaybeWorkspaceClientRuntimeBindings() {
  return useMaybeWorkspaceClientBindings()?.runtime ?? null;
}

export function useMaybeWorkspaceClientHostBindings() {
  return useMaybeWorkspaceClientBindings()?.host ?? null;
}

export function useWorkspaceClientRuntimeMode() {
  const runtimeGateway = useWorkspaceClientBindings().runtimeGateway;
  return useSyncExternalStore(
    runtimeGateway.subscribeRuntimeMode,
    runtimeGateway.readRuntimeMode,
    runtimeGateway.readRuntimeMode
  );
}

export { createWorkspaceClientStore } from "./bindings";
