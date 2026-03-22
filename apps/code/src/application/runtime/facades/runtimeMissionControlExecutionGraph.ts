import type {
  AgentTaskSummary,
  HugeCodeCheckpointSummary,
  HugeCodeExecutionGraphSummary,
  HugeCodeExecutionNodeSummary,
  HugeCodeReviewActionabilityAction,
  HugeCodeReviewActionabilitySummary,
} from "@ku0/code-runtime-host-contract";

const REVIEW_ACTIONABILITY_ACTIONS = new Set<HugeCodeReviewActionabilityAction>([
  "accept_result",
  "reject_result",
  "retry",
  "continue_with_clarification",
  "narrow_scope",
  "relax_validation",
  "switch_profile_and_retry",
  "escalate_to_pair_mode",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readNullableBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function readNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeStringArray(value: string[] | null | undefined): string[] | undefined {
  const normalized = (value ?? [])
    .map((entry) => readNonEmptyString(entry))
    .filter((entry): entry is string => entry !== null);
  return normalized.length > 0 ? normalized : undefined;
}

function isReviewActionabilityAction(value: unknown): value is HugeCodeReviewActionabilityAction {
  return (
    typeof value === "string" &&
    REVIEW_ACTIONABILITY_ACTIONS.has(value as HugeCodeReviewActionabilityAction)
  );
}

function projectCheckpointSummary(
  checkpoint: AgentTaskSummary["checkpointState"] | Record<string, unknown> | null | undefined
): HugeCodeCheckpointSummary | null {
  const checkpointRecord = asRecord(checkpoint);
  if (!checkpointRecord) {
    return null;
  }
  const state = readNonEmptyString(checkpointRecord.state);
  if (!state) {
    return null;
  }
  return {
    state,
    lifecycleState: readNonEmptyString(checkpointRecord.lifecycleState),
    checkpointId: readNonEmptyString(checkpointRecord.checkpointId),
    traceId: readNonEmptyString(checkpointRecord.traceId),
    recovered: checkpointRecord.recovered === true,
    updatedAt: readNullableNumber(checkpointRecord.updatedAt),
    resumeReady: readNullableBoolean(checkpointRecord.resumeReady),
    recoveredAt: readNullableNumber(checkpointRecord.recoveredAt),
    summary: readNonEmptyString(checkpointRecord.summary),
  };
}

function projectReviewActionabilitySummary(
  actionability:
    | AgentTaskSummary["reviewActionability"]
    | Record<string, unknown>
    | null
    | undefined
): HugeCodeReviewActionabilitySummary | null {
  const actionabilityRecord = asRecord(actionability);
  if (!actionabilityRecord) {
    return null;
  }
  const state = readNonEmptyString(actionabilityRecord.state);
  const summary = readNonEmptyString(actionabilityRecord.summary);
  if ((state !== "ready" && state !== "degraded" && state !== "blocked") || summary === null) {
    return null;
  }
  return {
    state,
    summary,
    degradedReasons: Array.isArray(actionabilityRecord.degradedReasons)
      ? actionabilityRecord.degradedReasons
          .map((entry) => readNonEmptyString(entry))
          .filter((entry): entry is string => entry !== null)
      : [],
    actions: Array.isArray(actionabilityRecord.actions)
      ? actionabilityRecord.actions.flatMap((entry) => {
          const actionEntry = asRecord(entry);
          if (!actionEntry) {
            return [];
          }
          const action = readNonEmptyString(actionEntry.action);
          if (!isReviewActionabilityAction(action)) {
            return [];
          }
          return [
            {
              action: action as HugeCodeReviewActionabilityAction,
              enabled: actionEntry.enabled === true,
              supported: actionEntry.supported === true,
              reason: readNonEmptyString(actionEntry.reason),
            },
          ];
        })
      : [],
  };
}

function projectExecutionNode(
  node: NonNullable<AgentTaskSummary["executionGraph"]>["nodes"][number]
): HugeCodeExecutionNodeSummary {
  return {
    id: node.id,
    kind: readNonEmptyString(node.kind) ?? "plan",
    status: readNonEmptyString(node.status) ?? undefined,
    executorKind: readNonEmptyString(node.executorKind),
    executorSessionId: readNonEmptyString(node.executorSessionId),
    preferredBackendIds: normalizeStringArray(node.preferredBackendIds),
    resolvedBackendId: readNonEmptyString(node.resolvedBackendId),
    placementLifecycleState: readNonEmptyString(node.placementLifecycleState),
    placementResolutionSource: readNonEmptyString(node.placementResolutionSource),
    checkpoint: projectCheckpointSummary(node.checkpoint),
    reviewActionability: projectReviewActionabilitySummary(node.reviewActionability),
  };
}

export function projectRuntimeExecutionGraphSummary(
  executionGraph: AgentTaskSummary["executionGraph"] | null | undefined
): HugeCodeExecutionGraphSummary | null {
  const graphId = readNonEmptyString(executionGraph?.graphId);
  if (!graphId) {
    return null;
  }
  return {
    graphId,
    nodes: (executionGraph?.nodes ?? []).map(projectExecutionNode),
    edges: (executionGraph?.edges ?? []).flatMap((edge) => {
      const fromNodeId = readNonEmptyString(edge.fromNodeId);
      const toNodeId = readNonEmptyString(edge.toNodeId);
      const kind = readNonEmptyString(edge.kind);
      if (!fromNodeId || !toNodeId || !kind) {
        return [];
      }
      return [
        {
          fromNodeId,
          toNodeId,
          kind,
        },
      ];
    }),
  };
}

export function resolveExecutionGraphRootNode(
  executionGraph: HugeCodeExecutionGraphSummary | null | undefined
): HugeCodeExecutionNodeSummary | null {
  return executionGraph?.nodes[0] ?? null;
}

export function resolveExecutionGraphCheckpoint(
  executionGraph: HugeCodeExecutionGraphSummary | null | undefined
): HugeCodeCheckpointSummary | null {
  return resolveExecutionGraphRootNode(executionGraph)?.checkpoint ?? null;
}

export function resolveExecutionGraphReviewActionability(
  executionGraph: HugeCodeExecutionGraphSummary | null | undefined
): HugeCodeReviewActionabilitySummary | null {
  return resolveExecutionGraphRootNode(executionGraph)?.reviewActionability ?? null;
}
