import { useSyncExternalStore } from "react";
import { startRuntimeRunWithRemoteSelection } from "./runtimeRemoteExecutionFacade";
import {
  loadRuntimeParallelDispatchDocumentRuntime,
  resetRuntimeParallelDispatchDocumentRuntimeForTests,
  type RuntimeParallelDispatchDoc,
  type RuntimeParallelDispatchDocumentRuntime,
  type RuntimeParallelDispatchList,
  type RuntimeParallelDispatchMap,
} from "./runtimeParallelDispatchDocumentRuntime";
import {
  createBrowserRuntimeParallelDispatchPersistence,
  type RuntimeParallelDispatchPersistence,
} from "./runtimeParallelDispatchPersistence";
import type { RuntimeRunStartRequest, RuntimeRunStartV2Response } from "../ports/runtimeClient";
import type { RuntimeAgentTaskSummary } from "../types/webMcpBridge";

type RuntimeParallelDispatchFailurePolicy = "halt" | "continue" | "skip";
type RuntimeParallelDispatchChunkStatus =
  | "pending"
  | "launching"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "blocked";
type RuntimeParallelDispatchSessionState = "running" | "completed" | "failed";
type SnapshotListener = () => void;

export type RuntimeParallelDispatchTaskPlan = {
  taskKey: string;
  title: string;
  instruction: string | null;
  preferredBackendIds: string[] | null;
  dependsOn: string[];
  maxRetries: number;
  onFailure: RuntimeParallelDispatchFailurePolicy;
};

export type RuntimeParallelDispatchPlan = {
  enabled: boolean;
  maxParallel: number;
  tasks: RuntimeParallelDispatchTaskPlan[];
  duplicateTaskKeyHints: string[];
  dependencyHints: string[];
  cycleHint: string | null;
  parseError: string | null;
};

export type RuntimeParallelDispatchChunkSnapshot = {
  taskKey: string;
  title: string;
  instruction: string | null;
  preferredBackendIds: string[] | null;
  resolvedBackendId: string | null;
  dependsOn: string[];
  maxRetries: number;
  attemptCount: number;
  onFailure: RuntimeParallelDispatchFailurePolicy;
  status: RuntimeParallelDispatchChunkStatus;
  taskId: string | null;
  runId: string | null;
  errorMessage: string | null;
  launchedAt: number | null;
  updatedAt: number;
};

export type RuntimeParallelDispatchSessionSnapshot = {
  sessionId: string;
  workspaceId: string;
  objective: string;
  state: RuntimeParallelDispatchSessionState;
  maxParallel: number;
  createdAt: number;
  updatedAt: number;
  counts: {
    total: number;
    pending: number;
    launching: number;
    running: number;
    completed: number;
    failed: number;
    skipped: number;
    blocked: number;
  };
  tasks: RuntimeParallelDispatchChunkSnapshot[];
};

export type RuntimeParallelDispatchWorkspaceSnapshot = {
  activeSessionCount: number;
  sessions: RuntimeParallelDispatchSessionSnapshot[];
};

export type StartRuntimeParallelDispatchInput = {
  workspaceId: string;
  objective: string;
  launchRequest: RuntimeRunStartRequest;
  plan: RuntimeParallelDispatchPlan;
};

export type StartRuntimeParallelDispatchResult = {
  sessionId: string;
};

type RuntimeParallelDispatchManagerDependencies = {
  launchRun: (request: RuntimeRunStartRequest) => Promise<RuntimeRunStartV2Response>;
  loadDocumentRuntime?: () => Promise<RuntimeParallelDispatchDocumentRuntime>;
  now?: () => number;
  persistence?: RuntimeParallelDispatchPersistence;
};

type RuntimeParallelDispatchChunkRuntime = RuntimeParallelDispatchTaskPlan & {
  attemptCount: number;
  taskId: string | null;
  runId: string | null;
};

type RuntimeParallelDispatchSessionRuntime = {
  workspaceId: string;
  objective: string;
  maxParallel: number;
  baseLaunchRequest: RuntimeRunStartRequest;
  taskOrder: string[];
  tasks: Map<string, RuntimeParallelDispatchChunkRuntime>;
  halted: boolean;
};

type RuntimeParallelDispatchWorkspaceStore = {
  workspaceId: string;
  doc: RuntimeParallelDispatchDoc | null;
  runtime: RuntimeParallelDispatchDocumentRuntime | null;
  hydrated: boolean;
  hydrationPromise: Promise<void> | null;
  listeners: Set<SnapshotListener>;
  sessions: Map<string, RuntimeParallelDispatchSessionRuntime>;
  pendingRuntimeTasks: RuntimeAgentTaskSummary[] | null;
  snapshot: RuntimeParallelDispatchWorkspaceSnapshot;
};

const EMPTY_WORKSPACE_SNAPSHOT: RuntimeParallelDispatchWorkspaceSnapshot = {
  activeSessionCount: 0,
  sessions: [],
};

function readOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toPositiveInteger(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.trunc(value));
}

function toNonNegativeInteger(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.trunc(value));
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const values: string[] = [];
  for (const entry of value) {
    const normalized = readOptionalText(entry);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    values.push(normalized);
  }
  return values;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readOptionalBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function normalizeTaskPlan(value: unknown, index: number): RuntimeParallelDispatchTaskPlan {
  const record = isRecord(value) ? value : {};
  const taskKey = readOptionalText(record.taskKey) ?? `task-${index + 1}`;
  const title = readOptionalText(record.title) ?? taskKey;
  const dependsOn = normalizeStringArray(record.dependsOn);
  const preferredBackendIds = normalizeStringArray(record.preferredBackendIds);
  return {
    taskKey,
    title,
    instruction: readOptionalText(record.instruction),
    preferredBackendIds: preferredBackendIds.length > 0 ? preferredBackendIds : null,
    dependsOn,
    maxRetries: toNonNegativeInteger(record.maxRetries, 0),
    onFailure:
      record.onFailure === "continue" || record.onFailure === "skip" ? record.onFailure : "halt",
  };
}

function findCycleHint(tasks: RuntimeParallelDispatchTaskPlan[]): string | null {
  const knownTaskKeys = new Set(tasks.map((task) => task.taskKey));
  const dependencies = new Map(
    tasks.map((task) => [
      task.taskKey,
      task.dependsOn.filter((dependency) => knownTaskKeys.has(dependency)),
    ])
  );
  const visited = new Set<string>();
  const activeSet = new Set<string>();
  const activePath: string[] = [];

  const walk = (taskKey: string): string[] | null => {
    visited.add(taskKey);
    activeSet.add(taskKey);
    activePath.push(taskKey);
    for (const dependency of dependencies.get(taskKey) ?? []) {
      if (!visited.has(dependency)) {
        const nested = walk(dependency);
        if (nested) {
          return nested;
        }
        continue;
      }
      if (activeSet.has(dependency)) {
        const cycleStart = activePath.indexOf(dependency);
        return [...activePath.slice(cycleStart), dependency];
      }
    }
    activeSet.delete(taskKey);
    activePath.pop();
    return null;
  };

  for (const task of tasks) {
    if (visited.has(task.taskKey)) {
      continue;
    }
    const cycle = walk(task.taskKey);
    if (cycle) {
      return cycle.join(" -> ");
    }
  }

  return null;
}

export function parseRuntimeParallelDispatchPlan(rawConfig: string): RuntimeParallelDispatchPlan {
  const trimmed = rawConfig.trim();
  if (trimmed.length === 0) {
    return {
      enabled: false,
      maxParallel: 1,
      tasks: [],
      duplicateTaskKeyHints: [],
      dependencyHints: [],
      cycleHint: null,
      parseError: null,
    };
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (!isRecord(parsed)) {
      return {
        enabled: false,
        maxParallel: 1,
        tasks: [],
        duplicateTaskKeyHints: [],
        dependencyHints: [],
        cycleHint: null,
        parseError: "Parallel dispatch config must be a JSON object.",
      };
    }

    const tasks = Array.isArray(parsed.tasks)
      ? parsed.tasks.map((task, index) => normalizeTaskPlan(task, index))
      : [];
    const keyCounts = new Map<string, number>();
    for (const task of tasks) {
      keyCounts.set(task.taskKey, (keyCounts.get(task.taskKey) ?? 0) + 1);
    }
    const duplicateTaskKeyHints = Array.from(keyCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([taskKey, count]) => `Duplicate task key hint: "${taskKey}" appears ${count} times.`);
    const knownTaskKeys = new Set(tasks.map((task) => task.taskKey));
    const dependencyHints: string[] = [];
    for (const task of tasks) {
      for (const dependency of task.dependsOn) {
        if (!knownTaskKeys.has(dependency)) {
          dependencyHints.push(
            `Dependency hint: "${task.taskKey}" depends on missing task "${dependency}".`
          );
        }
      }
    }

    return {
      enabled: parsed.enabled === true,
      maxParallel: toPositiveInteger(parsed.maxParallel, 1),
      tasks,
      duplicateTaskKeyHints,
      dependencyHints,
      cycleHint: findCycleHint(tasks),
      parseError: null,
    };
  } catch {
    return {
      enabled: false,
      maxParallel: 1,
      tasks: [],
      duplicateTaskKeyHints: [],
      dependencyHints: [],
      cycleHint: null,
      parseError: "Parallel dispatch config must be valid JSON.",
    };
  }
}

function mapRuntimeTaskStatus(
  status: RuntimeAgentTaskSummary["status"]
): RuntimeParallelDispatchChunkStatus {
  switch (status) {
    case "queued":
    case "running":
    case "awaiting_approval":
    case "paused":
      return "running";
    case "completed":
      return "completed";
    case "failed":
    case "cancelled":
    case "interrupted":
      return "failed";
    default:
      return "pending";
  }
}

export function readRuntimeParallelDispatchPlanLaunchError(
  plan: RuntimeParallelDispatchPlan
): string | null {
  if (!plan.enabled) {
    return "Parallel dispatch must be enabled before it can be started.";
  }
  if (plan.parseError) {
    return plan.parseError;
  }
  if (plan.tasks.length === 0) {
    return "Enabled parallel dispatch must include at least one task.";
  }
  if (plan.duplicateTaskKeyHints.length > 0) {
    return plan.duplicateTaskKeyHints[0] ?? "Parallel dispatch task keys must be unique.";
  }
  if (plan.dependencyHints.length > 0) {
    return plan.dependencyHints[0] ?? "Parallel dispatch dependencies must reference known tasks.";
  }
  if (plan.cycleHint) {
    return `Cycle hint: ${plan.cycleHint}.`;
  }
  return null;
}

function buildChildLaunchRequest(input: {
  base: RuntimeRunStartRequest;
  objective: string;
  chunk: RuntimeParallelDispatchTaskPlan;
}): RuntimeRunStartRequest {
  const preferredBackendIds =
    input.chunk.preferredBackendIds ??
    input.base.preferredBackendIds ??
    input.base.missionBrief?.preferredBackendIds ??
    null;
  const title = readOptionalText(input.chunk.title) ?? input.chunk.taskKey;
  const instruction =
    input.chunk.instruction ?? input.base.steps[0]?.input ?? input.base.title ?? input.objective;
  const taskSource = input.base.taskSource
    ? {
        ...input.base.taskSource,
        title,
      }
    : undefined;

  return {
    ...input.base,
    ...(title ? { title } : {}),
    ...(taskSource ? { taskSource } : {}),
    executionMode: "distributed",
    ...(preferredBackendIds ? { preferredBackendIds } : {}),
    ...(preferredBackendIds?.[0] ? { defaultBackendId: preferredBackendIds[0] } : {}),
    missionBrief: {
      ...(input.base.missionBrief ?? { objective: input.objective }),
      objective: title,
      preferredBackendIds,
      parallelismHint: "parallel_dispatch",
      maxSubtasks: 1,
    },
    steps:
      input.base.steps.length > 0
        ? input.base.steps.map((step, index) =>
            index === 0 && step.kind === "read" ? { ...step, input: instruction } : step
          )
        : [
            {
              kind: "read",
              input: instruction,
            },
          ],
  };
}

function createWorkspaceStore(
  workspaceId: string,
  listeners: Set<SnapshotListener>
): RuntimeParallelDispatchWorkspaceStore {
  return {
    workspaceId,
    doc: null,
    runtime: null,
    hydrated: false,
    hydrationPromise: null,
    listeners,
    sessions: new Map(),
    pendingRuntimeTasks: null,
    snapshot: EMPTY_WORKSPACE_SNAPSHOT,
  };
}

function requireStoreRuntime(
  store: RuntimeParallelDispatchWorkspaceStore
): RuntimeParallelDispatchDocumentRuntime {
  if (!store.runtime) {
    throw new Error("Parallel dispatch document runtime is not ready.");
  }
  return store.runtime;
}

function createStoreMap(store: RuntimeParallelDispatchWorkspaceStore): RuntimeParallelDispatchMap {
  return requireStoreRuntime(store).createMap();
}

function createStoreList<T>(
  store: RuntimeParallelDispatchWorkspaceStore
): RuntimeParallelDispatchList<T> {
  return requireStoreRuntime(store).createList<T>();
}

function ensureStoreDoc(store: RuntimeParallelDispatchWorkspaceStore): RuntimeParallelDispatchDoc {
  if (!store.doc) {
    store.doc = requireStoreRuntime(store).createDoc();
  }
  return store.doc;
}

function ensureRootSessionsMap(store: RuntimeParallelDispatchWorkspaceStore) {
  const root = ensureStoreDoc(store).getMap("parallel_dispatch");
  return root.getOrCreateContainer("sessions", createStoreMap(store));
}

function ensureSessionContainers(store: RuntimeParallelDispatchWorkspaceStore, sessionId: string) {
  const sessions = ensureRootSessionsMap(store);
  const session = sessions.getOrCreateContainer(sessionId, createStoreMap(store));
  const tasks = session.getOrCreateContainer("tasks", createStoreMap(store));
  const taskOrder = session.getOrCreateContainer("taskOrder", createStoreList<string>(store));
  return {
    session,
    tasks,
    taskOrder,
  };
}

function notifyWorkspaceListeners(store: RuntimeParallelDispatchWorkspaceStore) {
  for (const listener of store.listeners) {
    listener();
  }
}

function persistWorkspaceStore(
  store: RuntimeParallelDispatchWorkspaceStore,
  persistence: RuntimeParallelDispatchPersistence | undefined
) {
  if (!persistence || !store.doc) {
    return;
  }
  if (store.snapshot.sessions.length === 0) {
    persistence.clearSnapshot(store.workspaceId);
    return;
  }
  persistence.saveSnapshot(store.workspaceId, store.doc.export({ mode: "snapshot" }));
}

function commitStore(
  store: RuntimeParallelDispatchWorkspaceStore,
  origin: string,
  persistence: RuntimeParallelDispatchPersistence | undefined
) {
  ensureStoreDoc(store).commit({ origin });
  store.snapshot = readWorkspaceSnapshot(store);
  persistWorkspaceStore(store, persistence);
  notifyWorkspaceListeners(store);
}

function readWorkspaceSnapshot(
  store: RuntimeParallelDispatchWorkspaceStore
): RuntimeParallelDispatchWorkspaceSnapshot {
  if (!store.doc) {
    return EMPTY_WORKSPACE_SNAPSHOT;
  }
  const root = (
    store.doc.toJSON() as { parallel_dispatch?: { sessions?: Record<string, unknown> } }
  ).parallel_dispatch;
  const sessionsRecord = root?.sessions;
  if (!sessionsRecord || typeof sessionsRecord !== "object") {
    return EMPTY_WORKSPACE_SNAPSHOT;
  }

  const sessions: RuntimeParallelDispatchSessionSnapshot[] = [];

  for (const [sessionId, rawSession] of Object.entries(sessionsRecord)) {
    const session = isRecord(rawSession) ? rawSession : {};
    const taskOrder = Array.isArray(session.taskOrder)
      ? session.taskOrder.filter((taskKey): taskKey is string => typeof taskKey === "string")
      : [];
    const taskRecord = isRecord(session.tasks) ? session.tasks : {};
    const tasks: RuntimeParallelDispatchChunkSnapshot[] = [];

    for (const taskKey of taskOrder) {
      const rawTask = taskRecord[taskKey];
      if (!isRecord(rawTask)) {
        continue;
      }

      const preferredBackendIds = normalizeStringArray(rawTask.preferredBackendIds);
      const status: RuntimeParallelDispatchChunkStatus =
        rawTask.status === "launching" ||
        rawTask.status === "running" ||
        rawTask.status === "completed" ||
        rawTask.status === "failed" ||
        rawTask.status === "skipped" ||
        rawTask.status === "blocked"
          ? rawTask.status
          : "pending";

      tasks.push({
        taskKey,
        title: readOptionalText(rawTask.title) ?? taskKey,
        instruction: readOptionalText(rawTask.instruction),
        preferredBackendIds: preferredBackendIds.length > 0 ? preferredBackendIds : null,
        resolvedBackendId: readOptionalText(rawTask.resolvedBackendId),
        dependsOn: normalizeStringArray(rawTask.dependsOn),
        maxRetries: toNonNegativeInteger(rawTask.maxRetries, 0),
        attemptCount: toNonNegativeInteger(rawTask.attemptCount, 0),
        onFailure:
          rawTask.onFailure === "continue" || rawTask.onFailure === "skip"
            ? rawTask.onFailure
            : "halt",
        status,
        taskId: readOptionalText(rawTask.taskId),
        runId: readOptionalText(rawTask.runId),
        errorMessage: readOptionalText(rawTask.errorMessage),
        launchedAt:
          typeof rawTask.launchedAt === "number" && Number.isFinite(rawTask.launchedAt)
            ? rawTask.launchedAt
            : null,
        updatedAt:
          typeof rawTask.updatedAt === "number" && Number.isFinite(rawTask.updatedAt)
            ? rawTask.updatedAt
            : 0,
      });
    }

    const counts: RuntimeParallelDispatchSessionSnapshot["counts"] = {
      total: 0,
      pending: 0,
      launching: 0,
      running: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      blocked: 0,
    };
    for (const task of tasks) {
      counts.total += 1;
      counts[task.status] += 1;
    }
    const state: RuntimeParallelDispatchSessionState =
      counts.failed > 0 || counts.blocked > 0
        ? "failed"
        : counts.pending > 0 || counts.launching > 0 || counts.running > 0
          ? "running"
          : "completed";

    sessions.push({
      sessionId,
      workspaceId: readOptionalText(session.workspaceId) ?? "workspace",
      objective: readOptionalText(session.objective) ?? "Parallel dispatch",
      state,
      maxParallel: toPositiveInteger(session.maxParallel, 1),
      createdAt:
        typeof session.createdAt === "number" && Number.isFinite(session.createdAt)
          ? session.createdAt
          : 0,
      updatedAt:
        typeof session.updatedAt === "number" && Number.isFinite(session.updatedAt)
          ? session.updatedAt
          : 0,
      counts,
      tasks,
    });
  }

  sessions.sort((left, right) => right.createdAt - left.createdAt);

  return {
    activeSessionCount: sessions.filter((session) => session.state === "running").length,
    sessions,
  };
}

function createSessionId(now: () => number) {
  return `dispatch-${now()}`;
}

function buildFallbackLaunchRequest(
  workspaceId: string,
  objective: string,
  preferredBackendIds: string[] | null = null
): RuntimeRunStartRequest {
  return {
    workspaceId,
    title: objective,
    executionMode: "distributed",
    accessMode: "on-request",
    ...(preferredBackendIds ? { preferredBackendIds } : {}),
    ...(preferredBackendIds?.[0] ? { defaultBackendId: preferredBackendIds[0] } : {}),
    missionBrief: {
      objective,
      preferredBackendIds,
      parallelismHint: "parallel_dispatch",
      maxSubtasks: 1,
    },
    steps: [
      {
        kind: "read",
        input: objective,
      },
    ],
  };
}

function restoreLaunchRequest(
  serialized: string | null,
  workspaceId: string,
  objective: string,
  preferredBackendIds: string[] | null = null
): RuntimeRunStartRequest {
  if (!serialized) {
    return buildFallbackLaunchRequest(workspaceId, objective, preferredBackendIds);
  }
  try {
    const parsed = JSON.parse(serialized);
    if (!isRecord(parsed) || !Array.isArray(parsed.steps)) {
      return buildFallbackLaunchRequest(workspaceId, objective, preferredBackendIds);
    }
    return {
      ...parsed,
      workspaceId,
      steps: parsed.steps as RuntimeRunStartRequest["steps"],
    } as RuntimeRunStartRequest;
  } catch {
    return buildFallbackLaunchRequest(workspaceId, objective, preferredBackendIds);
  }
}

function rebuildRuntimeSessionsFromStore(
  store: RuntimeParallelDispatchWorkspaceStore
): Map<string, RuntimeParallelDispatchSessionRuntime> {
  if (!store.doc) {
    return new Map();
  }
  const root = (
    store.doc.toJSON() as { parallel_dispatch?: { sessions?: Record<string, unknown> } }
  ).parallel_dispatch;
  const sessionsRecord = root?.sessions;
  if (!sessionsRecord || typeof sessionsRecord !== "object") {
    return new Map();
  }

  const sessions = new Map<string, RuntimeParallelDispatchSessionRuntime>();

  for (const [sessionId, rawSession] of Object.entries(sessionsRecord)) {
    const session = isRecord(rawSession) ? rawSession : {};
    const workspaceId = readOptionalText(session.workspaceId) ?? store.workspaceId;
    const objective = readOptionalText(session.objective) ?? "Parallel dispatch";
    const taskOrder = Array.isArray(session.taskOrder)
      ? session.taskOrder.filter((taskKey): taskKey is string => typeof taskKey === "string")
      : [];
    const taskRecord = isRecord(session.tasks) ? session.tasks : {};
    const taskEntries = taskOrder
      .map((taskKey, index) => {
        const rawTask = isRecord(taskRecord[taskKey]) ? taskRecord[taskKey] : null;
        if (!rawTask) {
          return null;
        }
        const preferredBackendIds = normalizeStringArray(rawTask.preferredBackendIds);
        const taskPlan = normalizeTaskPlan(
          {
            taskKey,
            title: readOptionalText(rawTask.title) ?? taskKey,
            instruction: readOptionalText(rawTask.instruction),
            preferredBackendIds,
            dependsOn: normalizeStringArray(rawTask.dependsOn),
            maxRetries: toNonNegativeInteger(rawTask.maxRetries, 0),
            onFailure: rawTask.onFailure,
          },
          index
        );
        return [
          taskKey,
          {
            ...taskPlan,
            attemptCount: toNonNegativeInteger(rawTask.attemptCount, 0),
            taskId: readOptionalText(rawTask.taskId),
            runId: readOptionalText(rawTask.runId),
          },
        ] as const;
      })
      .filter(
        (entry): entry is readonly [string, RuntimeParallelDispatchChunkRuntime] => entry !== null
      );

    const firstPreferredBackendIds = taskEntries[0]?.[1].preferredBackendIds ?? null;

    sessions.set(sessionId, {
      workspaceId,
      objective,
      maxParallel: toPositiveInteger(session.maxParallel, 1),
      baseLaunchRequest: restoreLaunchRequest(
        readOptionalText(session.baseLaunchRequestJson),
        workspaceId,
        objective,
        firstPreferredBackendIds
      ),
      taskOrder,
      tasks: new Map(taskEntries),
      halted: readOptionalBoolean(session.halted) === true,
    });
  }

  return sessions;
}

export function createRuntimeParallelDispatchManager(
  deps: RuntimeParallelDispatchManagerDependencies
) {
  const stores = new Map<string, RuntimeParallelDispatchWorkspaceStore>();
  const workspaceListeners = new Map<string, Set<SnapshotListener>>();
  const loadDocumentRuntime =
    deps.loadDocumentRuntime ?? loadRuntimeParallelDispatchDocumentRuntime;
  const now = deps.now ?? Date.now;
  let documentRuntimePromise: Promise<RuntimeParallelDispatchDocumentRuntime> | null = null;
  let sessionSequence = 0;

  const ensureDocumentRuntime = () => {
    if (!documentRuntimePromise) {
      documentRuntimePromise = loadDocumentRuntime().catch(async () => {
        const { createFallbackRuntimeParallelDispatchDocumentRuntime } =
          await import("./runtimeParallelDispatchFallbackRuntime");
        return createFallbackRuntimeParallelDispatchDocumentRuntime();
      });
    }
    return documentRuntimePromise;
  };

  const getWorkspaceListeners = (workspaceId: string) => {
    const existing = workspaceListeners.get(workspaceId);
    if (existing) {
      return existing;
    }
    const created = new Set<SnapshotListener>();
    workspaceListeners.set(workspaceId, created);
    return created;
  };

  const getStore = (workspaceId: string) => {
    const existing = stores.get(workspaceId);
    if (existing) {
      return existing;
    }
    const created = createWorkspaceStore(workspaceId, getWorkspaceListeners(workspaceId));
    stores.set(workspaceId, created);
    return created;
  };

  const applyRuntimeReconcile = (
    store: RuntimeParallelDispatchWorkspaceStore,
    workspaceId: string,
    runtimeTasks: RuntimeAgentTaskSummary[]
  ) => {
    const runtimeTaskById = new Map(runtimeTasks.map((task) => [task.taskId, task]));
    for (const [sessionId, runtime] of store.sessions.entries()) {
      const sessionSnapshot = store.snapshot.sessions.find(
        (session) => session.sessionId === sessionId
      );
      let needsCommit = false;
      for (const taskKey of runtime.taskOrder) {
        const chunk = runtime.tasks.get(taskKey);
        if (!chunk?.taskId) {
          continue;
        }
        const runtimeTask = runtimeTaskById.get(chunk.taskId);
        if (!runtimeTask) {
          continue;
        }
        const { tasks, session } = ensureSessionContainers(store, sessionId);
        const taskMap = tasks.getOrCreateContainer(taskKey, createStoreMap(store));
        const nextStatus = mapRuntimeTaskStatus(runtimeTask.status);
        const nextResolvedBackendId = runtimeTask.backendId ?? null;
        const nextErrorMessage = runtimeTask.errorMessage ?? null;
        const currentTaskSnapshot = sessionSnapshot?.tasks.find((task) => task.taskKey === taskKey);
        if (nextStatus === "failed") {
          const shouldRetryRuntimeFailure =
            runtimeTask.status === "failed" && chunk.attemptCount <= chunk.maxRetries;
          const terminalStatus: RuntimeParallelDispatchChunkStatus =
            chunk.onFailure === "skip" ? "skipped" : "failed";
          if (
            currentTaskSnapshot?.status === terminalStatus &&
            currentTaskSnapshot.resolvedBackendId === nextResolvedBackendId &&
            currentTaskSnapshot.errorMessage === nextErrorMessage &&
            !shouldRetryRuntimeFailure
          ) {
            continue;
          }
          const updatedAt = now();
          if (shouldRetryRuntimeFailure) {
            chunk.taskId = null;
            chunk.runId = null;
            retryChunkAfterFailure({
              store,
              sessionId,
              taskKey,
              updatedAt,
              errorMessage: nextErrorMessage ?? "Runtime chunk failed.",
              origin: "parallel_dispatch_runtime_retry_pending",
            });
          } else {
            finalizeChunkFailure({
              store,
              runtime,
              sessionId,
              taskKey,
              updatedAt,
              errorMessage:
                nextErrorMessage ??
                (runtimeTask.status === "failed"
                  ? "Runtime chunk failed."
                  : `Runtime chunk ${runtimeTask.status}.`),
              task: chunk,
              origin: "parallel_dispatch_runtime_reconcile_failed",
            });
          }
          continue;
        }
        if (
          currentTaskSnapshot?.status === nextStatus &&
          currentTaskSnapshot.resolvedBackendId === nextResolvedBackendId &&
          currentTaskSnapshot.errorMessage === nextErrorMessage
        ) {
          continue;
        }
        const updatedAt = now();
        taskMap.set("status", nextStatus);
        taskMap.set("resolvedBackendId", nextResolvedBackendId);
        taskMap.set("updatedAt", updatedAt);
        taskMap.set("errorMessage", nextErrorMessage);
        session.set("updatedAt", updatedAt);
        needsCommit = true;
      }
      if (needsCommit) {
        commitStore(store, "parallel_dispatch_runtime_reconcile", deps.persistence);
      }
      void maybeFlushSession(workspaceId, sessionId);
    }
  };

  const applyQueuedRuntimeReconcile = (
    workspaceId: string,
    store: RuntimeParallelDispatchWorkspaceStore
  ) => {
    const pendingRuntimeTasks = store.pendingRuntimeTasks;
    if (!pendingRuntimeTasks) {
      return;
    }
    store.pendingRuntimeTasks = null;
    applyRuntimeReconcile(store, workspaceId, pendingRuntimeTasks);
  };

  const hydrateWorkspaceStore = async (workspaceId: string) => {
    const store = getStore(workspaceId);
    if (store.hydrated) {
      return store;
    }
    if (store.hydrationPromise) {
      await store.hydrationPromise;
      return store;
    }

    store.hydrationPromise = ensureDocumentRuntime()
      .then((runtime) => {
        store.runtime = runtime;
        if (!store.doc) {
          store.doc = runtime.createDoc();
        }
        const persistedSnapshot = deps.persistence?.loadSnapshot(workspaceId) ?? null;
        if (persistedSnapshot) {
          try {
            store.doc.import(persistedSnapshot);
          } catch {
            store.doc = runtime.createDoc();
            deps.persistence?.clearSnapshot(workspaceId);
          }
        }
        store.sessions = rebuildRuntimeSessionsFromStore(store);
        store.snapshot = readWorkspaceSnapshot(store);
        store.hydrated = true;
      })
      .finally(() => {
        store.hydrationPromise = null;
      });

    await store.hydrationPromise;
    notifyWorkspaceListeners(store);
    applyQueuedRuntimeReconcile(workspaceId, store);
    return store;
  };

  const blockPendingTasksForSession = (
    store: RuntimeParallelDispatchWorkspaceStore,
    sessionId: string,
    updatedAt: number
  ) => {
    const { tasks } = ensureSessionContainers(store, sessionId);
    const tasksJson = tasks.toJSON() as Record<string, unknown>;
    for (const [taskKey, rawTask] of Object.entries(tasksJson)) {
      if (!isRecord(rawTask) || rawTask.status !== "pending") {
        continue;
      }
      const taskMap = tasks.getOrCreateContainer(taskKey, createStoreMap(store));
      taskMap.set("status", "blocked");
      taskMap.set("updatedAt", updatedAt);
      taskMap.set("errorMessage", "Dispatch halted after an upstream chunk failure.");
    }
  };

  const retryChunkAfterFailure = (input: {
    store: RuntimeParallelDispatchWorkspaceStore;
    sessionId: string;
    taskKey: string;
    updatedAt: number;
    errorMessage: string;
    origin: string;
  }) => {
    const { tasks, session } = ensureSessionContainers(input.store, input.sessionId);
    const taskMap = tasks.getOrCreateContainer(input.taskKey, createStoreMap(input.store));
    taskMap.set("status", "pending");
    taskMap.set("taskId", null);
    taskMap.set("runId", null);
    taskMap.set("resolvedBackendId", null);
    taskMap.set("launchedAt", null);
    taskMap.set("updatedAt", input.updatedAt);
    taskMap.set("errorMessage", input.errorMessage);
    session.set("updatedAt", input.updatedAt);
    commitStore(input.store, input.origin, deps.persistence);
  };

  const finalizeChunkFailure = (input: {
    store: RuntimeParallelDispatchWorkspaceStore;
    runtime: RuntimeParallelDispatchSessionRuntime;
    sessionId: string;
    taskKey: string;
    updatedAt: number;
    errorMessage: string;
    task: RuntimeParallelDispatchChunkRuntime;
    origin: string;
  }) => {
    const { tasks, session } = ensureSessionContainers(input.store, input.sessionId);
    const taskMap = tasks.getOrCreateContainer(input.taskKey, createStoreMap(input.store));
    const terminalStatus: RuntimeParallelDispatchChunkStatus =
      input.task.onFailure === "skip" ? "skipped" : "failed";
    taskMap.set("status", terminalStatus);
    taskMap.set("updatedAt", input.updatedAt);
    taskMap.set("errorMessage", input.errorMessage);
    session.set("updatedAt", input.updatedAt);
    if (input.task.onFailure === "halt") {
      input.runtime.halted = true;
      session.set("halted", true);
      blockPendingTasksForSession(input.store, input.sessionId, input.updatedAt);
    }
    commitStore(input.store, input.origin, deps.persistence);
  };

  const maybeFlushSession = async (workspaceId: string, sessionId: string): Promise<void> => {
    const store = await hydrateWorkspaceStore(workspaceId);
    const runtime = store.sessions.get(sessionId);
    if (!runtime) {
      return;
    }
    const snapshot = store.snapshot.sessions.find((session) => session.sessionId === sessionId);
    if (!snapshot) {
      return;
    }
    const activeCount = snapshot.tasks.filter(
      (task) => task.status === "launching" || task.status === "running"
    ).length;
    let availableSlots = Math.max(0, runtime.maxParallel - activeCount);
    if (runtime.halted || availableSlots === 0) {
      return;
    }

    for (const taskKey of runtime.taskOrder) {
      if (availableSlots === 0) {
        break;
      }
      const task = runtime.tasks.get(taskKey);
      const taskSnapshot = snapshot.tasks.find((entry) => entry.taskKey === taskKey);
      if (!task || !taskSnapshot || taskSnapshot.status !== "pending") {
        continue;
      }
      const dependencySnapshots = task.dependsOn.map((dependency) =>
        snapshot.tasks.find((entry) => entry.taskKey === dependency)
      );
      if (dependencySnapshots.some((dependency) => !dependency)) {
        continue;
      }
      if (
        dependencySnapshots.some(
          (dependency) =>
            dependency?.status === "failed" ||
            dependency?.status === "blocked" ||
            dependency?.status === "skipped"
        )
      ) {
        const { tasks, session } = ensureSessionContainers(store, sessionId);
        const taskMap = tasks.getOrCreateContainer(taskKey, createStoreMap(store));
        const updatedAt = now();
        taskMap.set("status", "skipped");
        taskMap.set("updatedAt", updatedAt);
        taskMap.set("errorMessage", "A dependency did not complete successfully.");
        session.set("updatedAt", updatedAt);
        commitStore(store, "parallel_dispatch_dependency_blocked", deps.persistence);
        continue;
      }
      if (dependencySnapshots.some((dependency) => dependency?.status !== "completed")) {
        continue;
      }

      availableSlots -= 1;
      task.attemptCount += 1;
      const request = buildChildLaunchRequest({
        base: runtime.baseLaunchRequest,
        objective: runtime.objective,
        chunk: task,
      });
      const { tasks, session } = ensureSessionContainers(store, sessionId);
      const taskMap = tasks.getOrCreateContainer(taskKey, createStoreMap(store));
      const launchedAt = now();
      taskMap.set("status", "launching");
      taskMap.set("attemptCount", task.attemptCount);
      taskMap.set("launchedAt", launchedAt);
      taskMap.set("updatedAt", launchedAt);
      taskMap.set("errorMessage", null);
      session.set("updatedAt", launchedAt);
      commitStore(store, "parallel_dispatch_launching", deps.persistence);

      void deps
        .launchRun(request)
        .then((response) => {
          const runId = readOptionalText(response.missionRun.id) ?? response.run.taskId;
          const resolvedBackendId = readOptionalText(response.run.backendId);
          task.taskId = response.run.taskId;
          task.runId = runId;
          const { tasks: nextTasks, session: nextSession } = ensureSessionContainers(
            store,
            sessionId
          );
          const nextTaskMap = nextTasks.getOrCreateContainer(taskKey, createStoreMap(store));
          const updatedAt = now();
          nextTaskMap.set("status", mapRuntimeTaskStatus(response.run.status));
          nextTaskMap.set("taskId", response.run.taskId);
          nextTaskMap.set("runId", runId);
          nextTaskMap.set("resolvedBackendId", resolvedBackendId);
          nextTaskMap.set("updatedAt", updatedAt);
          nextSession.set("updatedAt", updatedAt);
          commitStore(store, "parallel_dispatch_launched", deps.persistence);
          void maybeFlushSession(workspaceId, sessionId);
        })
        .catch((error) => {
          const updatedAt = now();
          const errorMessage = error instanceof Error ? error.message : String(error);
          task.taskId = null;
          task.runId = null;
          if (task.attemptCount <= task.maxRetries) {
            retryChunkAfterFailure({
              store,
              sessionId,
              taskKey,
              updatedAt,
              errorMessage,
              origin: "parallel_dispatch_launch_retry_pending",
            });
          } else {
            finalizeChunkFailure({
              store,
              runtime,
              sessionId,
              taskKey,
              updatedAt,
              errorMessage,
              task,
              origin: "parallel_dispatch_launch_failed",
            });
          }
          void maybeFlushSession(workspaceId, sessionId);
        });
    }
  };

  return {
    async startDispatch(
      input: StartRuntimeParallelDispatchInput
    ): Promise<StartRuntimeParallelDispatchResult> {
      if (!input.plan.enabled) {
        throw new Error("Parallel dispatch must be enabled before it can be started.");
      }
      const planError = readRuntimeParallelDispatchPlanLaunchError(input.plan);
      if (planError) {
        throw new Error(planError);
      }
      const store = await hydrateWorkspaceStore(input.workspaceId);
      const sessionId = `${createSessionId(now)}-${++sessionSequence}`;
      const createdAt = now();
      const runtime: RuntimeParallelDispatchSessionRuntime = {
        workspaceId: input.workspaceId,
        objective: input.objective,
        maxParallel: input.plan.maxParallel,
        baseLaunchRequest: input.launchRequest,
        taskOrder: input.plan.tasks.map((task) => task.taskKey),
        tasks: new Map(
          input.plan.tasks.map((task) => [
            task.taskKey,
            {
              ...task,
              attemptCount: 0,
              taskId: null,
              runId: null,
            },
          ])
        ),
        halted: false,
      };
      store.sessions.set(sessionId, runtime);

      const { session, tasks, taskOrder } = ensureSessionContainers(store, sessionId);
      session.set("workspaceId", input.workspaceId);
      session.set("objective", input.objective);
      session.set("maxParallel", input.plan.maxParallel);
      session.set("halted", false);
      session.set("baseLaunchRequestJson", JSON.stringify(input.launchRequest));
      session.set("createdAt", createdAt);
      session.set("updatedAt", createdAt);
      for (const task of input.plan.tasks) {
        taskOrder.push(task.taskKey);
        const taskMap = tasks.getOrCreateContainer(task.taskKey, createStoreMap(store));
        taskMap.set("taskKey", task.taskKey);
        taskMap.set("title", task.title);
        taskMap.set("instruction", task.instruction);
        taskMap.set("preferredBackendIds", task.preferredBackendIds ?? []);
        taskMap.set("resolvedBackendId", null);
        taskMap.set("dependsOn", task.dependsOn);
        taskMap.set("maxRetries", task.maxRetries);
        taskMap.set("attemptCount", 0);
        taskMap.set("onFailure", task.onFailure);
        taskMap.set("status", "pending");
        taskMap.set("taskId", null);
        taskMap.set("runId", null);
        taskMap.set("errorMessage", null);
        taskMap.set("launchedAt", null);
        taskMap.set("updatedAt", createdAt);
      }
      commitStore(store, "parallel_dispatch_start", deps.persistence);
      await maybeFlushSession(input.workspaceId, sessionId);
      return { sessionId };
    },

    reconcileRuntimeTasks(workspaceId: string, runtimeTasks: RuntimeAgentTaskSummary[]) {
      const store = getStore(workspaceId);
      if (!store.hydrated) {
        store.pendingRuntimeTasks = runtimeTasks;
        void hydrateWorkspaceStore(workspaceId);
        return;
      }
      applyRuntimeReconcile(store, workspaceId, runtimeTasks);
    },

    getWorkspaceSnapshot(workspaceId: string): RuntimeParallelDispatchWorkspaceSnapshot {
      const store = getStore(workspaceId);
      if (!store.hydrated && !store.hydrationPromise) {
        void hydrateWorkspaceStore(workspaceId);
      }
      return store.snapshot;
    },

    subscribeWorkspace(workspaceId: string, listener: SnapshotListener) {
      const listeners = getWorkspaceListeners(workspaceId);
      listeners.add(listener);
      void hydrateWorkspaceStore(workspaceId);
      return () => {
        listeners.delete(listener);
      };
    },

    resetForTests() {
      stores.clear();
      workspaceListeners.clear();
      documentRuntimePromise = null;
      resetRuntimeParallelDispatchDocumentRuntimeForTests();
      sessionSequence = 0;
    },
  };
}

const runtimeParallelDispatchManager = createRuntimeParallelDispatchManager({
  launchRun: (request) => startRuntimeRunWithRemoteSelection(request),
  persistence: createBrowserRuntimeParallelDispatchPersistence(),
});

export function startRuntimeParallelDispatch(input: StartRuntimeParallelDispatchInput) {
  return runtimeParallelDispatchManager.startDispatch(input);
}

export function reconcileRuntimeParallelDispatchTasks(
  workspaceId: string,
  runtimeTasks: RuntimeAgentTaskSummary[]
) {
  runtimeParallelDispatchManager.reconcileRuntimeTasks(workspaceId, runtimeTasks);
}

export function useRuntimeParallelDispatchWorkspace(
  workspaceId: string
): RuntimeParallelDispatchWorkspaceSnapshot {
  return useSyncExternalStore(
    (listener) => runtimeParallelDispatchManager.subscribeWorkspace(workspaceId, listener),
    () => runtimeParallelDispatchManager.getWorkspaceSnapshot(workspaceId),
    () => EMPTY_WORKSPACE_SNAPSHOT
  );
}

export function resetRuntimeParallelDispatchManagerForTests() {
  runtimeParallelDispatchManager.resetForTests();
}
