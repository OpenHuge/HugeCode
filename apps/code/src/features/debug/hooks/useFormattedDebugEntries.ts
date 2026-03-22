import type { DebugEntry } from "../../../types";
import type { FormattedDebugEntry } from "../components/DebugEntriesList";
import { formatDebugPayload } from "../utils/formatDebugPayload";
import { useCachedDebugEntriesValue } from "./useCachedDebugEntriesValue";

const EMPTY_FORMATTED_ENTRIES: FormattedDebugEntry[] = [];

export function useFormattedDebugEntries(entries: DebugEntry[], isVisible: boolean) {
  return useCachedDebugEntriesValue({
    entries,
    initialValue: EMPTY_FORMATTED_ENTRIES,
    isVisible,
    reuseKey: "formatted",
    computeValue: (currentEntries) =>
      currentEntries.map((entry) => ({
        ...entry,
        timeLabel: new Date(entry.timestamp).toLocaleTimeString(),
        payloadText: entry.payload !== undefined ? formatDebugPayload(entry.payload) : undefined,
      })),
  });
}
