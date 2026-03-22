// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DebugEntry } from "../../../types";
import { useCachedDebugEntriesValue } from "./useCachedDebugEntriesValue";

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

describe("useCachedDebugEntriesValue", () => {
  it("returns the initial value while hidden before the first visible render", () => {
    const computeValue = vi.fn(() => ["computed"]);

    const { result } = renderHook(() =>
      useCachedDebugEntriesValue({
        entries: [],
        initialValue: [],
        isVisible: false,
        reuseKey: "stable",
        computeValue,
      })
    );

    expect(result.current).toEqual([]);
    expect(computeValue).not.toHaveBeenCalled();
  });

  it("uses the latest initial value while hidden before any visible render", () => {
    const computeValue = vi.fn(() => ["computed"]);

    const { result, rerender } = renderHook(
      ({ initialValue }: { initialValue: string[] }) =>
        useCachedDebugEntriesValue({
          entries: [],
          initialValue,
          isVisible: false,
          reuseKey: "stable",
          computeValue,
        }),
      {
        initialProps: {
          initialValue: ["first"],
        },
      }
    );

    rerender({
      initialValue: ["second"],
    });

    expect(result.current).toEqual(["second"]);
    expect(computeValue).not.toHaveBeenCalled();
  });

  it("keeps the cached visible value while hidden after fallback updates", () => {
    const payload = { ok: true };
    const entries = createEntries(payload);
    const computeValue = vi.fn<[DebugEntry[]], string[]>((currentEntries) =>
      currentEntries.map((entry) => entry.label)
    );

    const { result, rerender } = renderHook(
      ({ initialValue, isVisible }: { initialValue: string[]; isVisible: boolean }) =>
        useCachedDebugEntriesValue({
          entries,
          initialValue,
          isVisible,
          reuseKey: "stable",
          computeValue,
        }),
      {
        initialProps: {
          initialValue: ["fallback"],
          isVisible: true,
        },
      }
    );

    expect(result.current).toEqual(["runtime.updated"]);

    rerender({
      initialValue: ["new-fallback"],
      isVisible: false,
    });

    expect(result.current).toEqual(["runtime.updated"]);
    expect(computeValue).toHaveBeenCalledTimes(1);
  });

  it("reuses the cached visible value after toggling hidden and back to visible", () => {
    const payload = { ok: true };
    const entries = createEntries(payload);
    const computeValue = vi.fn<[DebugEntry[]], string[]>((currentEntries) =>
      currentEntries.map((entry) => entry.label)
    );

    const { result, rerender } = renderHook(
      ({ initialValue, isVisible }: { initialValue: string[]; isVisible: boolean }) =>
        useCachedDebugEntriesValue({
          entries,
          initialValue,
          isVisible,
          reuseKey: "stable",
          computeValue,
        }),
      {
        initialProps: {
          initialValue: ["fallback"],
          isVisible: true,
        },
      }
    );

    const firstSnapshot = result.current;

    rerender({
      initialValue: ["new-fallback"],
      isVisible: false,
    });

    rerender({
      initialValue: ["another-fallback"],
      isVisible: true,
    });

    expect(result.current).toBe(firstSnapshot);
    expect(computeValue).toHaveBeenCalledTimes(1);
  });

  it("reuses the previous visible value for equivalent entries and the same reuse key", () => {
    const payload = { ok: true };
    const firstEntries = createEntries(payload);
    const nextEntries = firstEntries.map((entry) => ({ ...entry, payload }));
    const computeValue = vi.fn<[DebugEntry[]], string[]>((entries) =>
      entries.map((entry) => entry.label)
    );

    const { result, rerender } = renderHook(
      ({ entries, reuseKey }: { entries: DebugEntry[]; reuseKey: string }) =>
        useCachedDebugEntriesValue({
          entries,
          initialValue: [],
          isVisible: true,
          reuseKey,
          computeValue,
        }),
      {
        initialProps: {
          entries: firstEntries,
          reuseKey: "stable",
        },
      }
    );

    const firstSnapshot = result.current;

    rerender({
      entries: nextEntries,
      reuseKey: "stable",
    });

    expect(result.current).toBe(firstSnapshot);
    expect(computeValue).toHaveBeenCalledTimes(1);
  });

  it("recomputes when the reuse key changes for the same entries", () => {
    const entries = createEntries({ ok: true });
    const computeValue = vi.fn<[DebugEntry[]], string[]>((currentEntries) =>
      currentEntries.map((entry) => entry.label)
    );

    const { result, rerender } = renderHook(
      ({ reuseKey }: { reuseKey: string }) =>
        useCachedDebugEntriesValue({
          entries,
          initialValue: [],
          isVisible: true,
          reuseKey,
          computeValue,
        }),
      {
        initialProps: {
          reuseKey: "first",
        },
      }
    );

    const firstSnapshot = result.current;

    rerender({
      reuseKey: "second",
    });

    expect(result.current).not.toBe(firstSnapshot);
    expect(computeValue).toHaveBeenCalledTimes(2);
  });
});
