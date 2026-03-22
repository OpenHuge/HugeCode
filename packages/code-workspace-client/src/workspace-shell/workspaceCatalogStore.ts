import type { WorkspaceCatalogEntry, WorkspaceClientRuntimeBindings } from "../workspace/bindings";
import {
  getKernelProjectionStore,
  readMissionControlProjectionSlice,
} from "./kernelProjectionStore";

export type WorkspaceCatalogLoadState = "idle" | "loading" | "ready" | "error";

export type WorkspaceCatalogSnapshot = {
  workspaces: WorkspaceCatalogEntry[];
  loadState: WorkspaceCatalogLoadState;
  error: string | null;
};

const INITIAL_SNAPSHOT: WorkspaceCatalogSnapshot = {
  workspaces: [],
  loadState: "idle",
  error: null,
};

type Listener = () => void;

class WorkspaceCatalogStore {
  private snapshot: WorkspaceCatalogSnapshot = INITIAL_SNAPSHOT;
  private listeners = new Set<Listener>();
  private unsubscribeRuntimeUpdated: (() => void) | null = null;
  private unsubscribeKernelProjection: (() => void) | null = null;
  private hasStarted = false;
  private requestId = 0;

  constructor(private readonly runtime: WorkspaceClientRuntimeBindings) {}

  getSnapshot = () => this.snapshot;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) {
      this.start();
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.stop();
      }
    };
  };

  refresh = async () => {
    if (this.runtime.kernelProjection) {
      const kernelProjectionStore = getKernelProjectionStore(this.runtime);
      kernelProjectionStore.ensureScopes(["mission_control"]);
      await kernelProjectionStore.refresh(["mission_control"]);
      this.syncFromKernelProjection();
      return;
    }
    this.requestId += 1;
    const requestId = this.requestId;
    this.updateSnapshot({
      workspaces: this.snapshot.workspaces,
      loadState: "loading",
      error: null,
    });
    try {
      const entries = await this.runtime.workspaceCatalog.listWorkspaces();
      if (requestId !== this.requestId) {
        return;
      }
      this.updateSnapshot({
        workspaces: entries.map((entry) => ({ ...entry })),
        loadState: "ready",
        error: null,
      });
    } catch (error) {
      if (requestId !== this.requestId) {
        return;
      }
      this.updateSnapshot({
        workspaces: [],
        loadState: "error",
        error: error instanceof Error ? error.message : "Unable to load workspaces.",
      });
    }
  };

  private start() {
    if (this.runtime.kernelProjection) {
      const kernelProjectionStore = getKernelProjectionStore(this.runtime);
      kernelProjectionStore.ensureScopes(["mission_control"]);
      if (!this.hasStarted) {
        this.hasStarted = true;
        void this.refresh();
      }
      if (this.unsubscribeKernelProjection) {
        return;
      }
      this.unsubscribeKernelProjection = kernelProjectionStore.subscribe(() => {
        this.syncFromKernelProjection();
      });
      this.syncFromKernelProjection();
      return;
    }
    if (!this.hasStarted) {
      this.hasStarted = true;
      void this.refresh();
    }
    if (this.unsubscribeRuntimeUpdated || !this.runtime.runtimeUpdated) {
      return;
    }
    this.unsubscribeRuntimeUpdated =
      this.runtime.runtimeUpdated.subscribeScopedRuntimeUpdatedEvents(
        { scopes: ["bootstrap", "workspaces"] },
        () => {
          void this.refresh();
        }
      );
  }

  private stop() {
    this.unsubscribeKernelProjection?.();
    this.unsubscribeKernelProjection = null;
    this.unsubscribeRuntimeUpdated?.();
    this.unsubscribeRuntimeUpdated = null;
  }

  private syncFromKernelProjection() {
    if (!this.runtime.kernelProjection) {
      return;
    }
    const projectionState = getKernelProjectionStore(this.runtime).getSnapshot();
    const missionControl = readMissionControlProjectionSlice(projectionState);
    if (missionControl) {
      this.updateSnapshot({
        workspaces: missionControl.workspaces.map((workspace) => ({
          id: workspace.id,
          name: workspace.name,
          connected: workspace.connected,
        })),
        loadState: "ready",
        error: null,
      });
      return;
    }
    this.updateSnapshot({
      workspaces: [],
      loadState: projectionState.loadState,
      error: projectionState.error,
    });
  }

  private updateSnapshot(nextSnapshot: WorkspaceCatalogSnapshot) {
    this.snapshot = nextSnapshot;
    for (const listener of this.listeners) {
      listener();
    }
  }
}

const workspaceCatalogStoreCache = new WeakMap<
  WorkspaceClientRuntimeBindings,
  WorkspaceCatalogStore
>();

export function getWorkspaceCatalogStore(runtime: WorkspaceClientRuntimeBindings) {
  let store = workspaceCatalogStoreCache.get(runtime);
  if (!store) {
    store = new WorkspaceCatalogStore(runtime);
    workspaceCatalogStoreCache.set(runtime, store);
  }
  return store;
}
