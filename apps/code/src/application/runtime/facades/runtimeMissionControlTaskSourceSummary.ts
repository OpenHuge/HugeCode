import type {
  AgentTaskSourceSummary,
  AgentTaskSummary,
  HugeCodeTaskSourceSummary,
} from "@ku0/code-runtime-host-contract";

const KNOWN_TASK_SOURCE_KINDS = new Set([
  "manual",
  "manual_thread",
  "github_issue",
  "github_pr_followup",
  "github_discussion",
  "note",
  "customer_feedback",
  "doc",
  "call_summary",
  "external_ref",
  "schedule",
  "external_runtime",
] as const);

export type MissionControlThreadTaskSourceInput = {
  id: string;
  workspaceId: string;
};

export function normalizeMissionTaskSource(
  taskSource: AgentTaskSourceSummary | HugeCodeTaskSourceSummary | null | undefined
): HugeCodeTaskSourceSummary | null {
  if (!taskSource) {
    return null;
  }
  const kind = KNOWN_TASK_SOURCE_KINDS.has(taskSource.kind as never)
    ? taskSource.kind
    : "external_runtime";
  const normalized: HugeCodeTaskSourceSummary = {
    kind,
    label: taskSource.label ?? null,
    title: taskSource.title ?? null,
    externalId: taskSource.externalId ?? null,
    canonicalUrl: taskSource.canonicalUrl ?? null,
    threadId: taskSource.threadId ?? null,
    requestId: taskSource.requestId ?? null,
    sourceTaskId: taskSource.sourceTaskId ?? null,
    sourceRunId: taskSource.sourceRunId ?? null,
    githubSource: taskSource.githubSource ?? null,
  };
  if ("shortLabel" in taskSource) {
    normalized.shortLabel = taskSource.shortLabel ?? null;
  }
  if ("reference" in taskSource) {
    normalized.reference = taskSource.reference ?? null;
  }
  if ("url" in taskSource) {
    normalized.url = taskSource.url ?? null;
  }
  if ("issueNumber" in taskSource) {
    normalized.issueNumber = taskSource.issueNumber ?? null;
  }
  if ("pullRequestNumber" in taskSource) {
    normalized.pullRequestNumber = taskSource.pullRequestNumber ?? null;
  }
  if ("repo" in taskSource) {
    normalized.repo = taskSource.repo ?? null;
  }
  if ("workspaceId" in taskSource) {
    normalized.workspaceId = taskSource.workspaceId ?? null;
  }
  if ("workspaceRoot" in taskSource) {
    normalized.workspaceRoot = taskSource.workspaceRoot ?? null;
  }
  return normalized;
}

export function deriveThreadTaskSource(
  thread: MissionControlThreadTaskSourceInput,
  title: string
): HugeCodeTaskSourceSummary {
  return {
    kind: "manual_thread",
    label: "Manual thread",
    title,
    externalId: null,
    canonicalUrl: null,
    threadId: thread.id,
    requestId: null,
    sourceTaskId: null,
    sourceRunId: null,
  };
}

export function deriveRuntimeTaskSource(
  task: AgentTaskSummary,
  title: string | null
): HugeCodeTaskSourceSummary {
  const explicit = normalizeMissionTaskSource(task.taskSource);
  if (explicit) {
    return {
      ...explicit,
      title: explicit.title ?? title ?? null,
      threadId: explicit.threadId ?? task.threadId ?? null,
      requestId: explicit.requestId ?? task.requestId ?? null,
      sourceTaskId: explicit.sourceTaskId ?? task.rootTaskId ?? null,
      sourceRunId: explicit.sourceRunId ?? task.taskId,
      githubSource: explicit.githubSource ?? null,
    };
  }
  if (task.threadId) {
    return {
      kind: "manual_thread",
      label: "Manual thread",
      title,
      externalId: null,
      canonicalUrl: null,
      threadId: task.threadId,
      requestId: task.requestId ?? null,
      sourceTaskId: null,
      sourceRunId: task.taskId,
      githubSource: null,
    };
  }
  return {
    kind: "external_runtime",
    label: "External runtime",
    title,
    externalId: null,
    canonicalUrl: null,
    threadId: null,
    requestId: task.requestId ?? null,
    sourceTaskId: task.taskId,
    sourceRunId: task.taskId,
    githubSource: null,
  };
}
