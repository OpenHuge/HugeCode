import type { HugeCodeMissionControlSnapshot } from "@ku0/code-runtime-host-contract";
import type { WorkspaceClientRuntimeBindings } from "../workspace/bindings";
import {
  getKernelProjectionStore,
  readMissionControlProjectionSlice,
} from "./kernelProjectionStore";

export type MissionControlLoadState = "idle" | "loading" | "refreshing" | "ready" | "error";

export type MissionControlSnapshotState = {
  snapshot: HugeCodeMissionControlSnapshot | null;
  loadState: MissionControlLoadState;
  error: string | null;
};

const INITIAL_SNAPSHOT_STATE: MissionControlSnapshotState = {
  snapshot: null,
  loadState: "idle",
  error: null,
};

type Listener = () => void;

class MissionControlSnapshotStore {
  private snapshotState: MissionControlSnapshotState = INITIAL_SNAPSHOT_STATE;
  private listeners = new Set<Listener>();
  private unsubscribeRuntimeUpdated: (() => void) | null = null;
  private unsubscribeKernelProjection: (() => void) | null = null;
  private hasStarted = false;
  private requestId = 0;

  constructor(private readonly runtime: WorkspaceClientRuntimeBindings) {}

  getSnapshot = () => this.snapshotState;

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
    this.updateSnapshotState({
      snapshot: this.snapshotState.snapshot,
      loadState: "loading",
      error: null,
    });
    try {
      const snapshot = await this.runtime.missionControl.readMissionControlSnapshot();
      if (requestId !== this.requestId) {
        return;
      }
      this.updateSnapshotState({
        snapshot,
        loadState: "ready",
        error: null,
      });
    } catch (error) {
      if (requestId !== this.requestId) {
        return;
      }
      this.updateSnapshotState({
        snapshot: null,
        loadState: "error",
        error: error instanceof Error ? error.message : "Unable to load mission control.",
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
        { scopes: ["bootstrap", "workspaces", "agents"] },
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
    const snapshot = readMissionControlProjectionSlice(projectionState);
    if (snapshot) {
      this.updateSnapshotState({
        snapshot,
        loadState: "ready",
        error: null,
      });
      return;
    }
    this.updateSnapshotState({
      snapshot: null,
      loadState: projectionState.loadState,
      error: projectionState.error,
    });
  }

  private updateSnapshotState(nextSnapshotState: MissionControlSnapshotState) {
    this.snapshotState = nextSnapshotState;
    for (const listener of this.listeners) {
      listener();
    }
  }
}

const missionControlSnapshotStoreCache = new WeakMap<
  WorkspaceClientRuntimeBindings,
  MissionControlSnapshotStore
>();

export function getMissionControlSnapshotStore(runtime: WorkspaceClientRuntimeBindings) {
  let store = missionControlSnapshotStoreCache.get(runtime);
  if (!store) {
    store = new MissionControlSnapshotStore(runtime);
    missionControlSnapshotStoreCache.set(runtime, store);
  }
  return store;
}
