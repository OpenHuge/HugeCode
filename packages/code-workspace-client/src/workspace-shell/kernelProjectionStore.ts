import type {
  HugeCodeMissionControlSnapshot,
  KernelCapabilitiesSlice,
  KernelContinuitySlice,
  KernelDiagnosticsSlice,
  KernelExtensionBundle,
  KernelProjectionDelta,
  KernelProjectionOp,
  KernelProjectionScope,
  KernelProjectionSlices,
} from "@ku0/code-runtime-host-contract";
import type { WorkspaceClientRuntimeBindings } from "../workspace/bindings";

export type KernelProjectionLoadState = "idle" | "loading" | "ready" | "error";

export type KernelProjectionState = {
  revision: number;
  sliceRevisions: Partial<Record<KernelProjectionScope, number>>;
  slices: KernelProjectionSlices;
  loadState: KernelProjectionLoadState;
  error: string | null;
};

const INITIAL_KERNEL_PROJECTION_STATE: KernelProjectionState = {
  revision: 0,
  sliceRevisions: {},
  slices: {},
  loadState: "idle",
  error: null,
};

type Listener = () => void;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function updateSliceWithKey(
  currentValue: unknown,
  op: Extract<KernelProjectionOp, { key?: string | null }>
) {
  const key = typeof op.key === "string" ? op.key.trim() : "";
  if (!key) {
    if (op.type === "remove") {
      return undefined;
    }
    if (op.type === "patch") {
      const currentRecord = asRecord(currentValue) ?? {};
      const patch = asRecord(op.patch) ?? {};
      return {
        ...currentRecord,
        ...patch,
      };
    }
    return op.value;
  }

  if (Array.isArray(currentValue)) {
    const currentArray = [...currentValue];
    const existingIndex = currentArray.findIndex((entry) => {
      const record = asRecord(entry);
      return typeof record?.id === "string" && record.id === key;
    });
    if (op.type === "remove") {
      return existingIndex >= 0
        ? currentArray.filter((_entry, index) => index !== existingIndex)
        : currentArray;
    }
    if (op.type === "patch" && existingIndex >= 0) {
      const currentRecord = asRecord(currentArray[existingIndex]) ?? {};
      currentArray[existingIndex] = {
        ...currentRecord,
        ...(asRecord(op.patch) ?? {}),
      };
      return currentArray;
    }
    if (existingIndex >= 0) {
      currentArray[existingIndex] = op.value;
      return currentArray;
    }
    return [...currentArray, op.value];
  }

  const currentRecord = asRecord(currentValue) ?? {};
  if (op.type === "remove") {
    const nextRecord = { ...currentRecord };
    delete nextRecord[key];
    return nextRecord;
  }
  if (op.type === "patch") {
    const existingRecord = asRecord(currentRecord[key]) ?? {};
    return {
      ...currentRecord,
      [key]: {
        ...existingRecord,
        ...(asRecord(op.patch) ?? {}),
      },
    };
  }
  return {
    ...currentRecord,
    [key]: op.value,
  };
}

function applyProjectionOp(
  slices: KernelProjectionSlices,
  sliceRevisions: Partial<Record<KernelProjectionScope, number>>,
  op: KernelProjectionOp
) {
  if (op.type === "resync_required") {
    return {
      slices,
      sliceRevisions,
      requiresResync: true,
    };
  }

  const nextSlices: KernelProjectionSlices = { ...slices };
  const nextSliceRevisions = { ...sliceRevisions };
  const currentValue = nextSlices[op.scope];

  switch (op.type) {
    case "replace":
      nextSlices[op.scope] = op.value;
      break;
    case "upsert":
    case "remove":
    case "patch": {
      const nextValue = updateSliceWithKey(currentValue, op);
      if (nextValue === undefined) {
        delete nextSlices[op.scope];
      } else {
        nextSlices[op.scope] = nextValue;
      }
      break;
    }
  }

  if (typeof op.revision === "number" && Number.isFinite(op.revision)) {
    nextSliceRevisions[op.scope] = op.revision;
  }

  return {
    slices: nextSlices,
    sliceRevisions: nextSliceRevisions,
    requiresResync: false,
  };
}

function applyProjectionDelta(
  state: KernelProjectionState,
  delta: KernelProjectionDelta
): KernelProjectionState {
  let slices = state.slices;
  let sliceRevisions = state.sliceRevisions;
  let requiresResync = false;

  for (const op of delta.ops) {
    const next = applyProjectionOp(slices, sliceRevisions, op);
    slices = next.slices;
    sliceRevisions = next.sliceRevisions;
    if (next.requiresResync) {
      requiresResync = true;
    }
  }

  return {
    revision: delta.revision,
    sliceRevisions,
    slices,
    loadState: requiresResync ? "loading" : "ready",
    error: requiresResync
      ? delta.ops.find((op) => op.type === "resync_required")?.reason?.trim() ||
        "Kernel projection resync required."
      : null,
  };
}

function readRequestedScopes(scopes: readonly KernelProjectionScope[]) {
  return [...new Set(scopes)];
}

export function readMissionControlProjectionSlice(
  state: Pick<KernelProjectionState, "slices">
): HugeCodeMissionControlSnapshot | null {
  const missionControl = state.slices.mission_control;
  return missionControl && typeof missionControl === "object"
    ? (missionControl as HugeCodeMissionControlSnapshot)
    : null;
}

export function readCapabilitiesProjectionSlice(
  state: Pick<KernelProjectionState, "slices">
): KernelCapabilitiesSlice | null {
  const capabilities = state.slices.capabilities;
  return Array.isArray(capabilities) ? (capabilities as KernelCapabilitiesSlice) : null;
}

export function readContinuityProjectionSlice(
  state: Pick<KernelProjectionState, "slices">
): KernelContinuitySlice | null {
  const continuity = state.slices.continuity;
  const record = asRecord(continuity);
  const summary = asRecord(record?.summary);
  return record &&
    Array.isArray(record.items) &&
    summary &&
    typeof summary.recoverableRunCount === "number" &&
    typeof summary.reviewBlockedCount === "number" &&
    typeof summary.itemCount === "number"
    ? (continuity as KernelContinuitySlice)
    : null;
}

export function readDiagnosticsProjectionSlice(
  state: Pick<KernelProjectionState, "slices">
): KernelDiagnosticsSlice | null {
  const diagnostics = state.slices.diagnostics;
  const record = asRecord(diagnostics);
  return record &&
    typeof record.revision === "number" &&
    "runtime" in record &&
    asRecord(record.toolMetrics) &&
    asRecord(record.toolGuardrails)
    ? (diagnostics as KernelDiagnosticsSlice)
    : null;
}

export function readExtensionsProjectionSlice(
  state: Pick<KernelProjectionState, "slices">
): KernelExtensionBundle[] | null {
  const extensions = state.slices.extensions;
  return Array.isArray(extensions) ? (extensions as KernelExtensionBundle[]) : null;
}

class KernelProjectionStore {
  private projectionState: KernelProjectionState = INITIAL_KERNEL_PROJECTION_STATE;
  private readonly listeners = new Set<Listener>();
  private requestedScopes = new Set<KernelProjectionScope>();
  private unsubscribeProjection: (() => void) | null = null;
  private hasStarted = false;
  private requestId = 0;

  constructor(private readonly runtime: WorkspaceClientRuntimeBindings) {}

  getSnapshot = () => this.projectionState;

  ensureScopes = (scopes: readonly KernelProjectionScope[]) => {
    let changed = false;
    for (const scope of scopes) {
      if (!this.requestedScopes.has(scope)) {
        this.requestedScopes.add(scope);
        changed = true;
      }
    }
    if (changed && this.hasStarted) {
      void this.refresh(scopes).finally(() => {
        if (this.listeners.size > 0) {
          this.subscribeToProjection();
        }
      });
    }
  };

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

  refresh = async (scopes?: readonly KernelProjectionScope[]) => {
    if (!this.runtime.kernelProjection) {
      return;
    }
    const requestedScopes = readRequestedScopes(scopes ?? [...this.requestedScopes]);
    if (requestedScopes.length === 0) {
      return;
    }
    requestedScopes.forEach((scope) => this.requestedScopes.add(scope));
    this.requestId += 1;
    const requestId = this.requestId;
    this.updateProjectionState({
      ...this.projectionState,
      loadState: "loading",
      error: null,
    });
    try {
      const bootstrap = await this.runtime.kernelProjection.bootstrap({
        scopes: requestedScopes,
      });
      if (requestId !== this.requestId) {
        return;
      }
      this.updateProjectionState({
        revision: bootstrap.revision,
        sliceRevisions: { ...bootstrap.sliceRevisions },
        slices: { ...this.projectionState.slices, ...bootstrap.slices },
        loadState: "ready",
        error: null,
      });
    } catch (error) {
      if (requestId !== this.requestId) {
        return;
      }
      this.updateProjectionState({
        ...this.projectionState,
        loadState: "error",
        error:
          error instanceof Error ? error.message : "Unable to bootstrap kernel projection state.",
      });
    }
  };

  private start() {
    this.hasStarted = true;
    if (!this.runtime.kernelProjection || this.requestedScopes.size === 0) {
      return;
    }
    void this.startProjection();
  }

  private stop() {
    this.unsubscribeProjection?.();
    this.unsubscribeProjection = null;
  }

  private subscribeToProjection() {
    this.unsubscribeProjection?.();
    if (!this.runtime.kernelProjection || this.requestedScopes.size === 0) {
      return;
    }
    this.unsubscribeProjection = this.runtime.kernelProjection.subscribe(
      {
        scopes: [...this.requestedScopes],
        lastRevision:
          this.projectionState.revision > 0 && Number.isFinite(this.projectionState.revision)
            ? this.projectionState.revision
            : undefined,
      },
      (delta) => {
        const nextState = applyProjectionDelta(this.projectionState, delta);
        this.updateProjectionState(nextState);
        if (delta.ops.some((op) => op.type === "resync_required")) {
          void this.refresh();
        }
      }
    );
  }

  private async startProjection() {
    await this.refresh();
    if (this.listeners.size === 0 || !this.runtime.kernelProjection) {
      return;
    }
    this.subscribeToProjection();
  }

  private updateProjectionState(nextProjectionState: KernelProjectionState) {
    this.projectionState = nextProjectionState;
    for (const listener of this.listeners) {
      listener();
    }
  }
}

const kernelProjectionStoreCache = new WeakMap<
  WorkspaceClientRuntimeBindings,
  KernelProjectionStore
>();

export function getKernelProjectionStore(runtime: WorkspaceClientRuntimeBindings) {
  let store = kernelProjectionStoreCache.get(runtime);
  if (!store) {
    store = new KernelProjectionStore(runtime);
    kernelProjectionStoreCache.set(runtime, store);
  }
  return store;
}
