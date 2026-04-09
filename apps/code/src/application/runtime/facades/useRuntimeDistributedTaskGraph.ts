import { useCallback, useEffect, useMemo, useState } from "react";
import {
  interruptRuntimeDistributedTaskGraphTasks,
  readNormalizedRuntimeDistributedTaskGraph,
  retryRuntimeDistributedTaskGraphNode,
} from "./runtimeDistributedTaskGraphFacade";
import {
  collectDistributedTaskGraphSubtreeTaskIds,
  type DistributedTaskGraphSnapshot,
} from "../types/distributedTaskGraph";
import { useRuntimeDistributedTaskGraphSupport } from "./useRuntimeDistributedTaskGraphSupport";

type UseRuntimeDistributedTaskGraphOptions = {
  graphId?: string | null;
  fallbackGraph?: DistributedTaskGraphSnapshot | null;
};

function readRuntimeDistributedTaskGraphFailureMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "Distributed graph request failed.";
}

async function loadRuntimeDistributedTaskGraphSnapshot(taskId: string) {
  return readNormalizedRuntimeDistributedTaskGraph(taskId);
}

export function useRuntimeDistributedTaskGraph({
  graphId,
  fallbackGraph = null,
}: UseRuntimeDistributedTaskGraphOptions) {
  const support = useRuntimeDistributedTaskGraphSupport();
  const [graphSnapshot, setGraphSnapshot] = useState<DistributedTaskGraphSnapshot | null>(null);
  const [graphReadOnlyReason, setGraphReadOnlyReason] = useState<string | null>(null);
  const normalizedGraphId = graphId?.trim() ?? "";

  const refreshGraph = useCallback(
    async (taskIdOverride?: string) => {
      const refreshTaskId = taskIdOverride?.trim() || normalizedGraphId;
      if (!refreshTaskId) {
        return;
      }
      try {
        const nextGraph = await loadRuntimeDistributedTaskGraphSnapshot(refreshTaskId);
        setGraphSnapshot(nextGraph);
        setGraphReadOnlyReason(null);
      } catch (error) {
        const message = readRuntimeDistributedTaskGraphFailureMessage(error);
        setGraphSnapshot(null);
        setGraphReadOnlyReason(message);
        throw error;
      }
    },
    [normalizedGraphId]
  );

  useEffect(() => {
    if (!support.capabilityEnabled || !normalizedGraphId) {
      setGraphSnapshot(null);
      setGraphReadOnlyReason(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const nextGraph = await loadRuntimeDistributedTaskGraphSnapshot(normalizedGraphId);
        if (cancelled) {
          return;
        }
        setGraphSnapshot(nextGraph);
        setGraphReadOnlyReason(null);
      } catch (error) {
        if (cancelled) {
          return;
        }
        const message = readRuntimeDistributedTaskGraphFailureMessage(error);
        setGraphSnapshot(null);
        setGraphReadOnlyReason(message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [normalizedGraphId, support.capabilityEnabled]);

  const graph = support.capabilityEnabled ? (graphSnapshot ?? fallbackGraph) : null;
  const disabledReason =
    graphReadOnlyReason ??
    support.readOnlyReason ??
    "Control actions are unavailable in current runtime.";

  const interruptTasks = useCallback(
    async (taskIds: string[]) => {
      const normalizedTaskIds = [...new Set(taskIds.map((taskId) => taskId.trim()))].filter(
        (taskId) => taskId.length > 0
      );
      if (normalizedTaskIds.length === 0) {
        return;
      }

      await interruptRuntimeDistributedTaskGraphTasks(normalizedTaskIds);
      await refreshGraph();
    },
    [refreshGraph]
  );

  const handleInterruptNode = useCallback(
    async (nodeId: string) => {
      await interruptTasks([nodeId]);
    },
    [interruptTasks]
  );

  const handleInterruptSubtree = useCallback(
    async (nodeId: string) => {
      const subtreeTaskIds = collectDistributedTaskGraphSubtreeTaskIds(graph, nodeId);
      await interruptTasks(subtreeTaskIds.length > 0 ? subtreeTaskIds : [nodeId]);
    },
    [graph, interruptTasks]
  );

  const handleRetryNode = useCallback(
    async (nodeId: string) => {
      const acknowledgement = await retryRuntimeDistributedTaskGraphNode(nodeId);
      if (!acknowledgement.accepted) {
        throw new Error(`Runtime declined retry for node '${nodeId}'.`);
      }
      await refreshGraph(acknowledgement.spawnedRunId || nodeId);
    },
    [refreshGraph]
  );

  return useMemo(
    () => ({
      graph,
      capabilityEnabled: support.capabilityEnabled,
      actionsEnabled: support.actionsEnabled,
      retryEnabled: support.retryEnabled,
      disabledReason,
      refreshGraph,
      interruptNode: support.interruptEnabled ? handleInterruptNode : undefined,
      interruptSubtree: support.interruptEnabled ? handleInterruptSubtree : undefined,
      retryNode: support.retryEnabled ? handleRetryNode : undefined,
    }),
    [
      disabledReason,
      graph,
      handleInterruptNode,
      handleInterruptSubtree,
      handleRetryNode,
      refreshGraph,
      support.actionsEnabled,
      support.capabilityEnabled,
      support.interruptEnabled,
      support.retryEnabled,
    ]
  );
}
