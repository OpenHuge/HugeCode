export const DISTRIBUTED_SUBTASK_GRAPH_CAPABILITY = "distributed_subtask_graph_v1";
export type DistributedExecutionMode = "runtime" | "local-cli" | "hybrid";

export type DistributedTaskNodeStatus =
  | "pending"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "blocked"
  | "canceled"
  | "unknown";

export type DistributedTaskGraphNode = {
  id: string;
  title: string;
  status: DistributedTaskNodeStatus;
  backendId?: string | null;
  backendLabel?: string | null;
  group?: string | null;
  queueDepth?: number | null;
  attempt?: number | null;
  maxAttempts?: number | null;
  startedAt?: number | null;
  finishedAt?: number | null;
  parentId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type DistributedTaskGraphEdge = {
  fromId: string;
  toId: string;
  kind?: string | null;
};

export type DistributedTaskGraphSummary = {
  totalNodes: number;
  runningNodes: number;
  completedNodes: number;
  failedNodes: number;
  queueDepth: number | null;
  placementFailuresTotal: number | null;
  accessMode: string | null;
  routedProvider: string | null;
  executionMode: DistributedExecutionMode | null;
  reason: string | null;
};

export type DistributedTaskGraphSnapshot = {
  graphId?: string | null;
  updatedAt?: number | null;
  nodes: DistributedTaskGraphNode[];
  edges: DistributedTaskGraphEdge[];
  summary?: DistributedTaskGraphSummary;
};

export type DistributedTaskGraphGroup = {
  id: string;
  label: string;
  nodes: DistributedTaskGraphNode[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => asString(entry)).filter((entry): entry is string => Boolean(entry));
}

function normalizeExecutionMode(value: unknown): DistributedExecutionMode | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "runtime") {
    return "runtime";
  }
  if (normalized === "local-cli" || normalized === "local_cli") {
    return "local-cli";
  }
  if (normalized === "hybrid") {
    return "hybrid";
  }
  return null;
}

function normalizeNodeStatus(value: unknown): DistributedTaskNodeStatus {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!raw) {
    return "unknown";
  }
  if (raw === "in_progress" || raw === "in-progress" || raw === "inprogress") {
    return "running";
  }
  if (raw === "done" || raw === "success") {
    return "completed";
  }
  if (raw === "cancelled") {
    return "canceled";
  }
  if (
    raw === "pending" ||
    raw === "queued" ||
    raw === "running" ||
    raw === "completed" ||
    raw === "failed" ||
    raw === "blocked" ||
    raw === "canceled"
  ) {
    return raw;
  }
  return "unknown";
}

function normalizeGraphNode(entry: unknown, index: number): DistributedTaskGraphNode | null {
  const record = asRecord(entry);
  if (!record) {
    return null;
  }

  const id =
    asString(record.id) ??
    asString(record.nodeId) ??
    asString(record.node_id) ??
    asString(record.taskId) ??
    asString(record.task_id) ??
    `node-${index + 1}`;
  const title =
    asString(record.title) ??
    asString(record.label) ??
    asString(record.name) ??
    asString(record.role) ??
    asString(record.id) ??
    asString(record.taskId) ??
    id;

  return {
    id,
    title,
    status: normalizeNodeStatus(record.status),
    backendId: asString(record.backendId ?? record.backend_id),
    backendLabel: asString(record.backendLabel ?? record.backend_label),
    group: asString(record.group),
    queueDepth: asNumber(record.queueDepth ?? record.queue_depth),
    attempt: asNumber(record.attempt),
    maxAttempts: asNumber(record.maxAttempts ?? record.max_attempts),
    startedAt: asNumber(record.startedAt ?? record.started_at),
    finishedAt: asNumber(record.finishedAt ?? record.finished_at),
    parentId: asString(
      record.parentId ?? record.parent_id ?? record.parentTaskId ?? record.parent_task_id
    ),
    metadata: asRecord(record.metadata),
  };
}

function normalizeGraphEdge(entry: unknown): DistributedTaskGraphEdge | null {
  const record = asRecord(entry);
  if (!record) {
    return null;
  }

  const fromId = asString(record.fromId ?? record.from_id ?? record.sourceId ?? record.source_id);
  const toId = asString(record.toId ?? record.to_id ?? record.targetId ?? record.target_id);
  const fromTaskId = asString(record.fromTaskId ?? record.from_task_id);
  const toTaskId = asString(record.toTaskId ?? record.to_task_id);
  const resolvedFrom = fromId ?? fromTaskId;
  const resolvedTo = toId ?? toTaskId;
  if (!resolvedFrom || !resolvedTo) {
    return null;
  }

  return {
    fromId: resolvedFrom,
    toId: resolvedTo,
    kind: asString(record.kind ?? record.type),
  };
}

function normalizeSummary(
  rawSummary: Record<string, unknown> | null,
  nodes: DistributedTaskGraphNode[]
): DistributedTaskGraphSummary {
  const totalNodes = asNumber(rawSummary?.totalNodes ?? rawSummary?.total_nodes) ?? nodes.length;
  const runningNodes =
    asNumber(rawSummary?.runningNodes ?? rawSummary?.running_nodes) ??
    nodes.filter((node) => node.status === "running").length;
  const completedNodes =
    asNumber(rawSummary?.completedNodes ?? rawSummary?.completed_nodes) ??
    nodes.filter((node) => node.status === "completed").length;
  const failedNodes =
    asNumber(rawSummary?.failedNodes ?? rawSummary?.failed_nodes) ??
    nodes.filter((node) => node.status === "failed").length;
  const queueDepth =
    asNumber(rawSummary?.queueDepth ?? rawSummary?.queue_depth) ??
    nodes.reduce<number | null>((total, node) => {
      if (node.queueDepth === null || node.queueDepth === undefined) {
        return total;
      }
      return (total ?? 0) + node.queueDepth;
    }, null);
  const placementFailuresTotal = asNumber(
    rawSummary?.placementFailuresTotal ?? rawSummary?.placement_failures_total
  );
  const accessMode = asString(rawSummary?.accessMode ?? rawSummary?.access_mode);
  const routedProvider = asString(rawSummary?.routedProvider ?? rawSummary?.routed_provider);
  const executionMode = normalizeExecutionMode(
    rawSummary?.executionMode ?? rawSummary?.execution_mode
  );
  const reason = asString(rawSummary?.reason);

  return {
    totalNodes,
    runningNodes,
    completedNodes,
    failedNodes,
    queueDepth,
    placementFailuresTotal,
    accessMode,
    routedProvider,
    executionMode,
    reason,
  };
}

function readNodes(input: Record<string, unknown>): unknown[] {
  const candidates = [
    input.nodes,
    input.tasks,
    input.vertices,
    input.items,
    input.graph,
    input.subtasks,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }
  return [];
}

function readEdges(input: Record<string, unknown>): unknown[] {
  const candidates = [input.edges, input.links, input.dependencies, input.arcs];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }
  return [];
}

export function normalizeDistributedTaskGraphSnapshot(
  value: unknown
): DistributedTaskGraphSnapshot | null {
  if (Array.isArray(value)) {
    const nodes = value
      .map((entry, index) => normalizeGraphNode(entry, index))
      .filter((entry): entry is DistributedTaskGraphNode => Boolean(entry));
    if (nodes.length === 0) {
      return null;
    }
    return {
      nodes,
      edges: [],
      summary: normalizeSummary(null, nodes),
    };
  }

  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const nodes = readNodes(record)
    .map((entry, index) => normalizeGraphNode(entry, index))
    .filter((entry): entry is DistributedTaskGraphNode => Boolean(entry));
  const edges = readEdges(record)
    .map((entry) => normalizeGraphEdge(entry))
    .filter((entry): entry is DistributedTaskGraphEdge => Boolean(entry));

  if (nodes.length === 0 && edges.length === 0) {
    return null;
  }

  const summaryRecord = asRecord(record.summary) ?? asRecord(record.stats) ?? null;

  return {
    graphId: asString(
      record.graphId ??
        record.graph_id ??
        record.taskId ??
        record.task_id ??
        record.rootTaskId ??
        record.root_task_id
    ),
    updatedAt: asNumber(record.updatedAt ?? record.updated_at),
    nodes,
    edges,
    summary: normalizeSummary(summaryRecord, nodes),
  };
}

export function groupDistributedTaskGraphNodesByBackend(
  nodes: DistributedTaskGraphNode[]
): DistributedTaskGraphGroup[] {
  const map = new Map<string, DistributedTaskGraphGroup>();

  for (const node of nodes) {
    const groupKey = node.group ?? node.backendId ?? "ungrouped";
    const existing = map.get(groupKey);
    if (existing) {
      existing.nodes.push(node);
      continue;
    }

    map.set(groupKey, {
      id: groupKey,
      label: node.backendLabel ?? node.backendId ?? node.group ?? "Ungrouped",
      nodes: [node],
    });
  }

  const groups = [...map.values()];
  groups.sort((left, right) =>
    left.label.localeCompare(right.label, undefined, { sensitivity: "base" })
  );
  return groups;
}

export function collectDistributedTaskGraphNodeDependencies(
  node: DistributedTaskGraphNode
): string[] {
  return asStringList(
    node.metadata?.dependencies ?? node.metadata?.dependsOn ?? node.metadata?.depends_on
  );
}
