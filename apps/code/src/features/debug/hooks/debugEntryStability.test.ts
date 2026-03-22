import { describe, expect, it } from "vitest";
import type { DebugEntry } from "../../../types";
import { areDebugEntriesStable } from "./debugEntryStability";

function createEntries(payload: object): DebugEntry[] {
  return [
    {
      id: "entry-1",
      timestamp: 1_771_331_696_000,
      source: "event",
      label: "runtime.updated",
      payload,
    },
  ];
}

describe("areDebugEntriesStable", () => {
  it("returns true for equivalent entries that reuse the same payload reference", () => {
    const payload = { ok: true };
    const previousEntries = createEntries(payload);
    const nextEntries = previousEntries.map((entry) => ({ ...entry, payload }));

    expect(areDebugEntriesStable(previousEntries, nextEntries)).toBe(true);
  });

  it("returns false when payload references change", () => {
    const previousEntries = createEntries({ ok: true });
    const nextEntries = createEntries({ ok: true });

    expect(areDebugEntriesStable(previousEntries, nextEntries)).toBe(false);
  });
});
