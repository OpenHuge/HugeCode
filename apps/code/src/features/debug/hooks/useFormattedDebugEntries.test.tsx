// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DebugEntry } from "../../../types";
import { useFormattedDebugEntries } from "./useFormattedDebugEntries";

function createEntries(): DebugEntry[] {
  return [
    {
      id: "entry-1",
      timestamp: 1_771_331_696_000,
      source: "event",
      label: "runtime.updated",
      payload: { ok: true },
    },
  ];
}

describe("useFormattedDebugEntries", () => {
  it("formats payloads when visible", () => {
    const { result } = renderHook(() => useFormattedDebugEntries(createEntries(), true));

    expect(result.current).toHaveLength(1);
    expect(result.current[0]?.payloadText).toContain('"ok": true');
    expect(result.current[0]?.timeLabel.length).toBeGreaterThan(0);
  });

  it("returns cached entries while hidden", () => {
    const entries = createEntries();
    const { result, rerender } = renderHook(
      ({ nextEntries, visible }) => useFormattedDebugEntries(nextEntries, visible),
      {
        initialProps: {
          nextEntries: entries,
          visible: true,
        },
      }
    );

    const visibleEntries = result.current;
    rerender({ nextEntries: [], visible: false });

    expect(result.current).toBe(visibleEntries);
  });

  it("reuses formatted entries for equivalent visible snapshots", () => {
    const payload = { ok: true };
    const firstEntries = [
      {
        id: "entry-1",
        timestamp: 1_771_331_696_000,
        source: "event" as const,
        label: "runtime.updated",
        payload,
      },
    ];
    const nextEntries = firstEntries.map((entry) => ({ ...entry, payload }));

    const { result, rerender } = renderHook(
      ({ currentEntries }) => useFormattedDebugEntries(currentEntries, true),
      {
        initialProps: { currentEntries: firstEntries },
      }
    );

    const firstSnapshot = result.current;

    rerender({ currentEntries: nextEntries });

    expect(result.current).toBe(firstSnapshot);
  });
});
