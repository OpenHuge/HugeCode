import type { DebugEntry } from "../../../types";
import { collectDebugEntryDiagnostics } from "../utils/debugEntryDiagnostics";
import { useCachedDebugEntriesValue } from "./useCachedDebugEntriesValue";

const EMPTY_DIAGNOSTICS_SNAPSHOT: ReturnType<typeof collectDebugEntryDiagnostics> = {
  distributedDiagnostics: null,
  agentTaskDurabilityDiagnostics: null,
  hasRemoteExecutionDiagnostics: false,
};

export function useDebugEntryDiagnostics(
  entries: DebugEntry[],
  observabilityCapabilityEnabled: boolean,
  isVisible: boolean
) {
  return useCachedDebugEntriesValue({
    entries,
    initialValue: EMPTY_DIAGNOSTICS_SNAPSHOT,
    isVisible,
    reuseKey: observabilityCapabilityEnabled,
    computeValue: (currentEntries) =>
      collectDebugEntryDiagnostics(currentEntries, {
        includeDistributedDiagnostics: observabilityCapabilityEnabled,
      }),
  });
}
