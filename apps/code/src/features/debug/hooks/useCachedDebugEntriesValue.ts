import { useMemo, useRef } from "react";
import type { DebugEntry } from "../../../types";
import { areDebugEntriesStable } from "./debugEntryStability";

type UseCachedDebugEntriesValueParams<T, TReuseKey> = {
  entries: DebugEntry[];
  initialValue: T;
  isVisible: boolean;
  reuseKey: TReuseKey;
  computeValue: (entries: DebugEntry[]) => T;
};

// Shared cache policy for debug entry-derived values:
// before the first visible computation we surface the latest fallback,
// afterwards hidden renders keep returning the last visible snapshot until
// either the entry set or the explicit reuse key invalidates the cache.
export function useCachedDebugEntriesValue<T, TReuseKey>({
  entries,
  initialValue,
  isVisible,
  reuseKey,
  computeValue,
}: UseCachedDebugEntriesValueParams<T, TReuseKey>): T {
  const computeValueRef = useRef(computeValue);
  const hasCachedValueRef = useRef(false);
  const previousEntriesRef = useRef<DebugEntry[] | null>(null);
  const previousReuseKeyRef = useRef<TReuseKey | null>(null);
  const previousValueRef = useRef(initialValue);

  computeValueRef.current = computeValue;

  return useMemo(() => {
    if (!isVisible) {
      return hasCachedValueRef.current ? previousValueRef.current : initialValue;
    }

    if (
      hasCachedValueRef.current &&
      previousReuseKeyRef.current === reuseKey &&
      areDebugEntriesStable(previousEntriesRef.current, entries)
    ) {
      return previousValueRef.current;
    }

    const nextValue = computeValueRef.current(entries);
    hasCachedValueRef.current = true;
    previousEntriesRef.current = entries;
    previousReuseKeyRef.current = reuseKey;
    previousValueRef.current = nextValue;
    return nextValue;
  }, [entries, initialValue, isVisible, reuseKey]);
}
