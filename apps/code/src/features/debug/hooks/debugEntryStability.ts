import type { DebugEntry } from "../../../types";

export function areDebugEntriesStable(
  previousEntries: DebugEntry[] | null,
  nextEntries: DebugEntry[]
): previousEntries is DebugEntry[] {
  if (previousEntries === null || previousEntries.length !== nextEntries.length) {
    return false;
  }

  return nextEntries.every((entry, index) => {
    const previous = previousEntries[index];
    return (
      previous !== undefined &&
      previous.id === entry.id &&
      previous.timestamp === entry.timestamp &&
      previous.source === entry.source &&
      previous.label === entry.label &&
      previous.payload === entry.payload
    );
  });
}
