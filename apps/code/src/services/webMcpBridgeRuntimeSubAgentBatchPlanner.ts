import { resolveRuntimeSubAgentBatchPolicy } from "../application/runtime/facades/runtimeToolExecutionPolicy";

export type RuntimeSubAgentBatchExecutionMode = "parallel" | "sequential";

export type RuntimeSubAgentBatchPlannerTask = {
  index: number;
  taskKey: string;
  dependsOn: string[];
  requiresApproval?: boolean;
};

export type RuntimeSubAgentBatchPlan = {
  executionMode: RuntimeSubAgentBatchExecutionMode;
  maxParallel: number;
  order: string[];
  waves: string[][];
  policy: ReturnType<typeof resolveRuntimeSubAgentBatchPolicy>;
};

type RuntimeSubAgentBatchPlannerOptions = {
  executionMode: RuntimeSubAgentBatchExecutionMode;
  maxParallel: number | null;
  provider?: string | null;
  modelId?: string | null;
  tasks: RuntimeSubAgentBatchPlannerTask[];
};

const DEFAULT_MAX_PARALLEL = 6;
const MIN_MAX_PARALLEL = 1;
const MAX_MAX_PARALLEL = 6;

function clampMaxParallel(value: number): number {
  return Math.min(MAX_MAX_PARALLEL, Math.max(MIN_MAX_PARALLEL, value));
}

function resolveMaxParallel(
  executionMode: RuntimeSubAgentBatchExecutionMode,
  maxParallel: number | null
): number {
  if (executionMode === "sequential") {
    return 1;
  }
  if (typeof maxParallel !== "number" || !Number.isFinite(maxParallel)) {
    return DEFAULT_MAX_PARALLEL;
  }
  return clampMaxParallel(Math.trunc(maxParallel));
}

export function planRuntimeSubAgentBatch(
  options: RuntimeSubAgentBatchPlannerOptions
): RuntimeSubAgentBatchPlan {
  const { tasks } = options;
  const policy = resolveRuntimeSubAgentBatchPolicy({
    provider: options.provider,
    modelId: options.modelId,
    requestedExecutionMode: options.executionMode,
    requestedMaxParallel: options.maxParallel,
    taskCount: tasks.length,
    hasApprovalSensitiveTasks: tasks.some((task) => task.requiresApproval === true),
  });
  const executionMode = policy.effectiveExecutionMode;
  const maxParallel = resolveMaxParallel(executionMode, policy.effectiveMaxParallel);

  const taskByKey = new Map<string, RuntimeSubAgentBatchPlannerTask>();
  for (const task of tasks) {
    if (taskByKey.has(task.taskKey)) {
      throw new Error(`Duplicate taskKey: ${task.taskKey}. taskKey values must be unique.`);
    }
    taskByKey.set(task.taskKey, {
      ...task,
      dependsOn: Array.from(new Set(task.dependsOn)),
    });
  }

  for (const task of taskByKey.values()) {
    for (const dependencyKey of task.dependsOn) {
      if (!taskByKey.has(dependencyKey)) {
        throw new Error(`Task ${task.taskKey} depends on missing taskKey ${dependencyKey}.`);
      }
    }
  }

  const dependentsByTaskKey = new Map<string, string[]>();
  const indegreeByTaskKey = new Map<string, number>();
  for (const taskKey of taskByKey.keys()) {
    dependentsByTaskKey.set(taskKey, []);
  }
  for (const task of taskByKey.values()) {
    indegreeByTaskKey.set(task.taskKey, task.dependsOn.length);
    for (const dependencyKey of task.dependsOn) {
      const dependents = dependentsByTaskKey.get(dependencyKey);
      if (dependents) {
        dependents.push(task.taskKey);
      }
    }
  }

  const compareByInputOrder = (left: string, right: string): number => {
    const leftTask = taskByKey.get(left);
    const rightTask = taskByKey.get(right);
    return (leftTask?.index ?? 0) - (rightTask?.index ?? 0);
  };

  let ready = Array.from(taskByKey.values())
    .filter((task) => (indegreeByTaskKey.get(task.taskKey) ?? 0) === 0)
    .sort((left, right) => left.index - right.index)
    .map((task) => task.taskKey);
  const order: string[] = [];
  const waves: string[][] = [];

  while (ready.length > 0) {
    const wave = [...ready];
    waves.push(wave);
    const nextReady: string[] = [];

    for (const taskKey of wave) {
      order.push(taskKey);
      const dependents = dependentsByTaskKey.get(taskKey) ?? [];
      for (const dependentTaskKey of dependents) {
        const nextInDegree = (indegreeByTaskKey.get(dependentTaskKey) ?? 0) - 1;
        indegreeByTaskKey.set(dependentTaskKey, nextInDegree);
        if (nextInDegree === 0) {
          nextReady.push(dependentTaskKey);
        }
      }
    }

    ready = Array.from(new Set(nextReady)).sort(compareByInputOrder);
  }

  if (order.length !== tasks.length) {
    const unresolved = tasks
      .map((task) => task.taskKey)
      .filter((taskKey) => !order.includes(taskKey));
    throw new Error(`Dependency cycle detected across task keys: ${unresolved.join(", ")}.`);
  }

  return {
    executionMode,
    maxParallel,
    order,
    waves,
    policy,
  };
}
