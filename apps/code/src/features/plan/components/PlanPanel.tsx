import { CODE_RUNTIME_RPC_METHODS } from "@ku0/code-runtime-host-contract";
import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "../../../design-system";
import { distributedTaskGraph } from "../../../application/runtime/ports/tauriThreads";
import { getRuntimeCapabilitiesSummary } from "../../../application/runtime/ports/tauriRuntime";
import { cancelRuntimeJob } from "../../../application/runtime/ports/tauriRuntimeJobs";
import type { TurnPlan } from "../../../types";
import type { ResolvedPlanArtifact } from "../../messages/utils/planArtifact";
import {
  DISTRIBUTED_SUBTASK_GRAPH_CAPABILITY,
  type DistributedTaskGraphSnapshot,
  normalizeDistributedTaskGraphSnapshot,
} from "../types/distributedGraph";
import { DistributedTaskGraphPanel } from "./DistributedTaskGraphPanel";
import {
  InspectorSection,
  InspectorSectionBody,
  InspectorSectionGroup,
  InspectorSectionHeader,
  RightPanelEmptyState,
} from "../../right-panel/RightPanelPrimitives";
import { joinClassNames } from "../../../utils/classNames";
import * as styles from "./PlanPanel.css";
import { getPlanStepStatusLabel, getPlanStepStatusTone } from "./planStepStatus";

type PlanPanelProps = {
  plan: TurnPlan | null;
  isProcessing: boolean;
  activeArtifact?: ResolvedPlanArtifact | null;
};

function formatProgress(plan: TurnPlan) {
  const total = plan.steps.length;
  if (!total) {
    return "";
  }
  const completed = plan.steps.filter((step) => step.status === "completed").length;
  return `${completed}/${total}`;
}

function buildDistributedDiagnosticsMessage(
  graph: DistributedTaskGraphSnapshot | null
): string | null {
  const summary = graph?.summary;
  if (!summary) {
    return null;
  }

  const details: string[] = [];
  if ((summary.placementFailuresTotal ?? 0) > 0) {
    details.push(
      `Placement failures detected (${summary.placementFailuresTotal}). Runtime keeps remote-provider routing until capacity recovers.`
    );
  }
  if (summary.executionMode === "runtime") {
    details.push(
      "Runtime is in runtime-only execution mode and cannot directly access your local machine unless execution mode is switched to hybrid or local CLI."
    );
  }

  const hasRemoteContext =
    summary.accessMode !== null ||
    summary.routedProvider !== null ||
    summary.executionMode !== null;
  if (hasRemoteContext) {
    const accessMode = summary.accessMode ?? "unknown";
    const routedProvider = summary.routedProvider ?? "unknown";
    const executionMode = summary.executionMode ?? "unknown";
    details.push(
      `Remote-provider execution context: access_mode=${accessMode}, routed_provider=${routedProvider}, execution_mode=${executionMode}.`
    );
  }

  if (summary.reason) {
    details.push(summary.reason);
  }

  if (details.length === 0) {
    return null;
  }
  return details.join(" ");
}

function collectSubtreeTaskIds(
  graph: DistributedTaskGraphSnapshot | null,
  nodeId: string
): string[] {
  const trimmedNodeId = nodeId.trim();
  if (!trimmedNodeId) {
    return [];
  }

  if (!graph) {
    return [trimmedNodeId];
  }

  const adjacency = new Map<string, Set<string>>();
  const link = (parentId: string, childId: string) => {
    const normalizedParentId = parentId.trim();
    const normalizedChildId = childId.trim();
    if (!normalizedParentId || !normalizedChildId) {
      return;
    }
    const children = adjacency.get(normalizedParentId) ?? new Set<string>();
    children.add(normalizedChildId);
    adjacency.set(normalizedParentId, children);
  };

  for (const node of graph.nodes) {
    if (node.parentId) {
      link(node.parentId, node.id);
    }
  }

  for (const edge of graph.edges) {
    link(edge.fromId, edge.toId);
  }

  const visited = new Set<string>();
  const queue: string[] = [trimmedNodeId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) {
      continue;
    }
    visited.add(current);
    const children = adjacency.get(current);
    if (!children) {
      continue;
    }
    for (const childId of children) {
      if (!visited.has(childId)) {
        queue.push(childId);
      }
    }
  }

  return [...visited];
}

export function PlanPanel({ plan, isProcessing, activeArtifact = null }: PlanPanelProps) {
  const [distributedGraphCapabilityEnabled, setDistributedGraphCapabilityEnabled] = useState(false);
  const [distributedGraphInterruptEnabled, setDistributedGraphInterruptEnabled] = useState(false);
  const [distributedGraphRetryEnabled, setDistributedGraphRetryEnabled] = useState(false);
  const [distributedGraphActionsEnabled, setDistributedGraphActionsEnabled] = useState(false);
  const [distributedGraphSnapshot, setDistributedGraphSnapshot] =
    useState<DistributedTaskGraphSnapshot | null>(null);
  const [distributedGraphReadOnlyReason, setDistributedGraphReadOnlyReason] = useState<
    string | null
  >(null);

  const readDistributedTaskGraphSnapshot = useCallback(async (taskId: string) => {
    const snapshot = await distributedTaskGraph({ taskId, includeDiagnostics: false });
    return normalizeDistributedTaskGraphSnapshot(snapshot);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const summary = await getRuntimeCapabilitiesSummary();
      if (cancelled) {
        return;
      }
      const hasCapability = summary.features.includes(DISTRIBUTED_SUBTASK_GRAPH_CAPABILITY);
      const supportsGraphMethod = summary.methods.includes(
        CODE_RUNTIME_RPC_METHODS.DISTRIBUTED_TASK_GRAPH
      );
      const supportsInterruptMethod = summary.methods.includes(
        CODE_RUNTIME_RPC_METHODS.KERNEL_JOB_CANCEL_V3
      );
      const supportsRetryMethod = summary.methods.includes(
        CODE_RUNTIME_RPC_METHODS.KERNEL_JOB_INTERVENE_V3
      );
      setDistributedGraphCapabilityEnabled(hasCapability && supportsGraphMethod);
      setDistributedGraphInterruptEnabled(
        hasCapability && supportsGraphMethod && supportsInterruptMethod
      );
      setDistributedGraphRetryEnabled(hasCapability && supportsGraphMethod && supportsRetryMethod);
      setDistributedGraphActionsEnabled(
        hasCapability && supportsGraphMethod && (supportsInterruptMethod || supportsRetryMethod)
      );
      if (!hasCapability) {
        setDistributedGraphReadOnlyReason(null);
        return;
      }
      if (summary.error) {
        setDistributedGraphReadOnlyReason(summary.error);
      } else if (!supportsGraphMethod) {
        setDistributedGraphReadOnlyReason(
          "Distributed graph RPC is unavailable in current runtime."
        );
      } else if (!supportsInterruptMethod && !supportsRetryMethod) {
        setDistributedGraphReadOnlyReason(
          "Distributed graph control RPC is unavailable in current runtime."
        );
      } else {
        setDistributedGraphReadOnlyReason(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const taskId = plan?.distributedGraph?.graphId?.trim() ?? "";
    if (!distributedGraphCapabilityEnabled || !taskId) {
      setDistributedGraphSnapshot(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const nextSnapshot = await readDistributedTaskGraphSnapshot(taskId);
        if (cancelled) {
          return;
        }
        setDistributedGraphSnapshot(nextSnapshot);
      } catch (error) {
        if (cancelled) {
          return;
        }
        const message =
          error instanceof Error ? error.message : "Distributed graph request failed.";
        setDistributedGraphReadOnlyReason(message);
        setDistributedGraphSnapshot(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    distributedGraphCapabilityEnabled,
    plan?.distributedGraph?.graphId,
    readDistributedTaskGraphSnapshot,
  ]);

  const graph = distributedGraphSnapshot ?? plan?.distributedGraph ?? null;
  const graphId = plan?.distributedGraph?.graphId?.trim() ?? "";
  const refreshDistributedGraph = useCallback(
    async (taskIdOverride?: string) => {
      const refreshTaskId = taskIdOverride?.trim() || graphId;
      if (!refreshTaskId) {
        return;
      }
      const nextSnapshot = await readDistributedTaskGraphSnapshot(refreshTaskId);
      setDistributedGraphSnapshot(nextSnapshot);
    },
    [graphId, readDistributedTaskGraphSnapshot]
  );

  const interruptTasks = useCallback(
    async (taskIds: string[]) => {
      const normalizedTaskIds = [...new Set(taskIds.map((taskId) => taskId.trim()))].filter(
        (taskId) => taskId.length > 0
      );
      if (normalizedTaskIds.length === 0) {
        return;
      }

      const acknowledgements = await Promise.all(
        normalizedTaskIds.map((taskId) =>
          cancelRuntimeJob({
            runId: taskId,
            reason: "ui:distributed_control_interrupt",
          })
        )
      );

      const rejected = acknowledgements.find((ack) => !ack.accepted);
      if (rejected) {
        const rejectedTaskId = rejected.runId.trim();
        throw new Error(
          rejected.message || `Runtime rejected interrupt for task '${rejectedTaskId}'.`
        );
      }

      await refreshDistributedGraph();
    },
    [refreshDistributedGraph]
  );

  const handleInterruptNode = useCallback(
    async (nodeId: string) => {
      await interruptTasks([nodeId]);
    },
    [interruptTasks]
  );

  const handleInterruptSubtree = useCallback(
    async (nodeId: string) => {
      const subtreeTaskIds = collectSubtreeTaskIds(graph, nodeId);
      await interruptTasks(subtreeTaskIds.length > 0 ? subtreeTaskIds : [nodeId]);
    },
    [graph, interruptTasks]
  );

  const progress = plan ? formatProgress(plan) : "";
  const steps = plan?.steps ?? [];
  const showEmpty = !steps.length && !plan?.explanation && !activeArtifact;
  const emptyLabel = isProcessing ? "Waiting on a plan..." : "No active plan.";
  const disabledReason =
    distributedGraphReadOnlyReason ?? "Control actions are unavailable in current runtime.";
  const distributedDiagnosticsMessage = buildDistributedDiagnosticsMessage(graph);
  const panelSubtitle = showEmpty
    ? isProcessing
      ? "Plan generation is in progress."
      : "No active plan is attached to this thread."
    : "Execution steps and distributed task state stay visible beside the thread.";

  return (
    <aside className={joinClassNames(styles.panel, "plan-panel")}>
      <InspectorSection>
        <InspectorSectionGroup>
          <InspectorSectionHeader
            title="Plan"
            subtitle={panelSubtitle}
            actions={progress ? <StatusBadge>{progress}</StatusBadge> : null}
          />
          <InspectorSectionBody className={styles.sectionBody}>
            {activeArtifact ? (
              <section className={styles.artifactCard} data-testid="plan-active-artifact">
                <div className={styles.artifactHeader}>
                  <span className={styles.artifactKicker}>Plan artifact</span>
                  <StatusBadge tone={activeArtifact.awaitingFollowup ? "progress" : "default"}>
                    {activeArtifact.awaitingFollowup ? "Next step" : "Summary"}
                  </StatusBadge>
                </div>
                <div className={styles.artifactTitle}>{activeArtifact.title}</div>
                <div className={styles.artifactPreview}>{activeArtifact.preview}</div>
                {!plan?.explanation && steps.length === 0 ? (
                  <div className={styles.artifactBody}>{activeArtifact.body}</div>
                ) : null}
              </section>
            ) : null}

            {plan?.explanation ? (
              <div className={styles.explanation}>{plan.explanation}</div>
            ) : null}

            {showEmpty ? (
              <RightPanelEmptyState
                title={isProcessing ? "Plan in progress" : "No active plan"}
                body={emptyLabel}
              />
            ) : steps.length > 0 ? (
              <ol className={styles.stepList}>
                {steps.map((step, index) => (
                  <li key={`${step.step}-${index}`} className={styles.stepRow}>
                    <span
                      className={joinClassNames(
                        styles.stepStatus,
                        styles.stepStatusTone[getPlanStepStatusTone(step.status)]
                      )}
                      aria-hidden
                    >
                      {getPlanStepStatusLabel(step.status)}
                    </span>
                    <span className={styles.stepText}>{step.step}</span>
                  </li>
                ))}
              </ol>
            ) : null}

            {distributedDiagnosticsMessage ? (
              <div className={styles.warning} data-testid="plan-distributed-warning">
                {distributedDiagnosticsMessage}
              </div>
            ) : null}
          </InspectorSectionBody>
        </InspectorSectionGroup>
      </InspectorSection>

      <DistributedTaskGraphPanel
        graph={distributedGraphCapabilityEnabled ? graph : null}
        capabilityEnabled={distributedGraphCapabilityEnabled}
        actionsEnabled={distributedGraphActionsEnabled}
        retryEnabled={distributedGraphRetryEnabled}
        disabledReason={disabledReason}
        diagnosticsMessage={distributedDiagnosticsMessage}
        onRefreshGraph={refreshDistributedGraph}
        onInterruptNode={distributedGraphInterruptEnabled ? handleInterruptNode : undefined}
        onInterruptSubtree={distributedGraphInterruptEnabled ? handleInterruptSubtree : undefined}
      />
    </aside>
  );
}
