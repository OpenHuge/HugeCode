export type RuntimeToolExecutionStatus =
  | "success"
  | "validation_failed"
  | "runtime_failed"
  | "timeout"
  | "blocked";

export type RuntimeToolExecutionScope = "write" | "runtime" | "computer_observe";

export type RuntimeToolExecutionRecentEntry = {
  toolName: string;
  scope: RuntimeToolExecutionScope;
  status: RuntimeToolExecutionStatus;
  errorCode: string | null;
  durationMs: number | null;
  truncatedOutput: boolean;
  at: number;
};

export type RuntimeToolExecutionTotals = {
  attemptedTotal: number;
  startedTotal: number;
  completedTotal: number;
  successTotal: number;
  validationFailedTotal: number;
  runtimeFailedTotal: number;
  timeoutTotal: number;
  blockedTotal: number;
  truncatedTotal: number;
};

export type RuntimeToolExecutionByToolEntry = RuntimeToolExecutionTotals & {
  toolName: string;
  scope: RuntimeToolExecutionScope;
  lastStatus: RuntimeToolExecutionStatus | null;
  lastErrorCode: string | null;
  lastDurationMs: number | null;
  updatedAt: number;
};

export type RuntimeToolExecutionSnapshot = {
  totals: RuntimeToolExecutionTotals;
  byTool: Record<string, RuntimeToolExecutionByToolEntry>;
  recent: RuntimeToolExecutionRecentEntry[];
  updatedAt: number;
};

type RuntimeToolExecutionListener = (snapshot: RuntimeToolExecutionSnapshot) => void;

const MAX_RECENT_RECORDS = 80;

const listeners = new Set<RuntimeToolExecutionListener>();

function createEmptyTotals(): RuntimeToolExecutionTotals {
  return {
    attemptedTotal: 0,
    startedTotal: 0,
    completedTotal: 0,
    successTotal: 0,
    validationFailedTotal: 0,
    runtimeFailedTotal: 0,
    timeoutTotal: 0,
    blockedTotal: 0,
    truncatedTotal: 0,
  };
}

function createEmptySnapshot(): RuntimeToolExecutionSnapshot {
  return {
    totals: createEmptyTotals(),
    byTool: {},
    recent: [],
    updatedAt: Date.now(),
  };
}

let snapshot: RuntimeToolExecutionSnapshot = createEmptySnapshot();

function toToolKey(toolName: string, scope: RuntimeToolExecutionScope): string {
  return `${scope}:${toolName}`;
}

function toNonNegativeInteger(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const parsed = Math.floor(value);
  return parsed < 0 ? null : parsed;
}

function cloneTotals(value: RuntimeToolExecutionTotals): RuntimeToolExecutionTotals {
  return {
    attemptedTotal: value.attemptedTotal,
    startedTotal: value.startedTotal,
    completedTotal: value.completedTotal,
    successTotal: value.successTotal,
    validationFailedTotal: value.validationFailedTotal,
    runtimeFailedTotal: value.runtimeFailedTotal,
    timeoutTotal: value.timeoutTotal,
    blockedTotal: value.blockedTotal,
    truncatedTotal: value.truncatedTotal,
  };
}

function cloneByTool(
  value: Record<string, RuntimeToolExecutionByToolEntry>
): Record<string, RuntimeToolExecutionByToolEntry> {
  const cloned: Record<string, RuntimeToolExecutionByToolEntry> = {};
  for (const [key, entry] of Object.entries(value)) {
    cloned[key] = {
      ...entry,
      ...cloneTotals(entry),
    };
  }
  return cloned;
}

function cloneRecent(value: RuntimeToolExecutionRecentEntry[]): RuntimeToolExecutionRecentEntry[] {
  return value.map((entry) => ({ ...entry }));
}

function emitSnapshot(): void {
  const current = readRuntimeToolExecutionMetrics();
  for (const listener of listeners) {
    listener(current);
  }
}

function ensureByToolEntry(
  state: RuntimeToolExecutionSnapshot,
  toolName: string,
  scope: RuntimeToolExecutionScope
): RuntimeToolExecutionByToolEntry {
  const key = toToolKey(toolName, scope);
  const existing = state.byTool[key];
  if (existing) {
    return existing;
  }
  const created: RuntimeToolExecutionByToolEntry = {
    toolName,
    scope,
    ...createEmptyTotals(),
    lastStatus: null,
    lastErrorCode: null,
    lastDurationMs: null,
    updatedAt: Date.now(),
  };
  state.byTool[key] = created;
  return created;
}

function incrementStatusTotals(
  totals: RuntimeToolExecutionTotals,
  status: RuntimeToolExecutionStatus
): void {
  if (status === "success") {
    totals.successTotal += 1;
    return;
  }
  if (status === "validation_failed") {
    totals.validationFailedTotal += 1;
    return;
  }
  if (status === "timeout") {
    totals.timeoutTotal += 1;
    return;
  }
  if (status === "blocked") {
    totals.blockedTotal += 1;
    return;
  }
  totals.runtimeFailedTotal += 1;
}

function patchSnapshot(
  mutator: (draft: RuntimeToolExecutionSnapshot) => void
): RuntimeToolExecutionSnapshot {
  const next: RuntimeToolExecutionSnapshot = {
    totals: cloneTotals(snapshot.totals),
    byTool: cloneByTool(snapshot.byTool),
    recent: cloneRecent(snapshot.recent),
    updatedAt: Date.now(),
  };
  mutator(next);
  next.updatedAt = Date.now();
  snapshot = next;
  emitSnapshot();
  return readRuntimeToolExecutionMetrics();
}

export function readRuntimeToolExecutionMetrics(): RuntimeToolExecutionSnapshot {
  return {
    totals: cloneTotals(snapshot.totals),
    byTool: cloneByTool(snapshot.byTool),
    recent: cloneRecent(snapshot.recent),
    updatedAt: snapshot.updatedAt,
  };
}

export function subscribeRuntimeToolExecutionMetrics(
  listener: RuntimeToolExecutionListener
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function recordRuntimeToolExecutionAttempt(
  toolName: string,
  scope: RuntimeToolExecutionScope
): RuntimeToolExecutionSnapshot {
  return patchSnapshot((draft) => {
    draft.totals.attemptedTotal += 1;
    const byTool = ensureByToolEntry(draft, toolName, scope);
    byTool.attemptedTotal += 1;
    byTool.updatedAt = Date.now();
  });
}

export function recordRuntimeToolExecutionStart(
  toolName: string,
  scope: RuntimeToolExecutionScope
): RuntimeToolExecutionSnapshot {
  return patchSnapshot((draft) => {
    draft.totals.startedTotal += 1;
    const byTool = ensureByToolEntry(draft, toolName, scope);
    byTool.startedTotal += 1;
    byTool.updatedAt = Date.now();
  });
}

export function recordRuntimeToolExecutionEnd(input: {
  toolName: string;
  scope: RuntimeToolExecutionScope;
  status: RuntimeToolExecutionStatus;
  errorCode?: string | null;
  durationMs?: number | null;
  truncatedOutput?: boolean;
  at?: number;
}): RuntimeToolExecutionSnapshot {
  return patchSnapshot((draft) => {
    const at = typeof input.at === "number" && Number.isFinite(input.at) ? input.at : Date.now();
    const durationMs = toNonNegativeInteger(input.durationMs);
    const errorCode =
      typeof input.errorCode === "string" && input.errorCode.trim().length > 0
        ? input.errorCode.trim()
        : null;
    const truncatedOutput = input.truncatedOutput === true;

    draft.totals.completedTotal += 1;
    incrementStatusTotals(draft.totals, input.status);
    if (truncatedOutput) {
      draft.totals.truncatedTotal += 1;
    }

    const byTool = ensureByToolEntry(draft, input.toolName, input.scope);
    byTool.completedTotal += 1;
    incrementStatusTotals(byTool, input.status);
    if (truncatedOutput) {
      byTool.truncatedTotal += 1;
    }
    byTool.lastStatus = input.status;
    byTool.lastErrorCode = errorCode;
    byTool.lastDurationMs = durationMs;
    byTool.updatedAt = at;

    draft.recent = [
      {
        toolName: input.toolName,
        scope: input.scope,
        status: input.status,
        errorCode,
        durationMs,
        truncatedOutput,
        at,
      },
      ...draft.recent,
    ].slice(0, MAX_RECENT_RECORDS);
  });
}

export function __resetRuntimeToolExecutionMetricsForTests(): void {
  snapshot = createEmptySnapshot();
  emitSnapshot();
}
