import { useEffect, useSyncExternalStore } from "react";
import {
  DEFAULT_RUNTIME_DISTRIBUTED_TASK_GRAPH_SUPPORT,
  type RuntimeDistributedTaskGraphSupport,
  readRuntimeDistributedTaskGraphSupport,
} from "./runtimeDistributedTaskGraphFacade";

type RuntimeDistributedTaskGraphSupportSnapshot = {
  support: RuntimeDistributedTaskGraphSupport;
};

const DEFAULT_SNAPSHOT: RuntimeDistributedTaskGraphSupportSnapshot = {
  support: DEFAULT_RUNTIME_DISTRIBUTED_TASK_GRAPH_SUPPORT,
};

let runtimeDistributedTaskGraphSupportSnapshot = DEFAULT_SNAPSHOT;
let runtimeDistributedTaskGraphSupportInflight: Promise<void> | null = null;
const runtimeDistributedTaskGraphSupportListeners = new Set<() => void>();

function emitRuntimeDistributedTaskGraphSupportSnapshot() {
  for (const listener of runtimeDistributedTaskGraphSupportListeners) {
    listener();
  }
}

function setRuntimeDistributedTaskGraphSupport(
  support: RuntimeDistributedTaskGraphSupport
): RuntimeDistributedTaskGraphSupport {
  runtimeDistributedTaskGraphSupportSnapshot = { support };
  emitRuntimeDistributedTaskGraphSupportSnapshot();
  return support;
}

export async function ensureRuntimeDistributedTaskGraphSupport() {
  if (runtimeDistributedTaskGraphSupportInflight) {
    return runtimeDistributedTaskGraphSupportInflight;
  }

  runtimeDistributedTaskGraphSupportInflight = (async () => {
    try {
      const support = await readRuntimeDistributedTaskGraphSupport();
      setRuntimeDistributedTaskGraphSupport(support);
    } catch {
      setRuntimeDistributedTaskGraphSupport(DEFAULT_RUNTIME_DISTRIBUTED_TASK_GRAPH_SUPPORT);
    } finally {
      runtimeDistributedTaskGraphSupportInflight = null;
    }
  })();

  return runtimeDistributedTaskGraphSupportInflight;
}

export function useRuntimeDistributedTaskGraphSupport() {
  const snapshot = useSyncExternalStore(
    (listener) => {
      runtimeDistributedTaskGraphSupportListeners.add(listener);
      return () => {
        runtimeDistributedTaskGraphSupportListeners.delete(listener);
      };
    },
    () => runtimeDistributedTaskGraphSupportSnapshot,
    () => runtimeDistributedTaskGraphSupportSnapshot
  );

  useEffect(() => {
    void ensureRuntimeDistributedTaskGraphSupport();
  }, []);

  return snapshot.support;
}

export function resetRuntimeDistributedTaskGraphSupportStoreForTests() {
  runtimeDistributedTaskGraphSupportSnapshot = DEFAULT_SNAPSHOT;
  runtimeDistributedTaskGraphSupportInflight = null;
  runtimeDistributedTaskGraphSupportListeners.clear();
}
