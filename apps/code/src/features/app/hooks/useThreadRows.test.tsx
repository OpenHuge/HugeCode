// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ThreadSummary } from "../../../types";
import { useThreadRows } from "./useThreadRows";

const getPinTimestamp = (_workspaceId: string, threadId: string) => {
  if (threadId === "pinned-root-1" || threadId === "pinned-root-2") {
    return threadId === "pinned-root-1" ? 1 : 2;
  }
  return null;
};

describe("useThreadRows", () => {
  it("keeps a matching thread and its ancestor chain while hiding unrelated siblings", () => {
    const threads: ThreadSummary[] = [
      { id: "root-1", name: "Planning Root", updatedAt: 1000 },
      { id: "child-1", name: "Deploy Fix", updatedAt: 900 },
      { id: "child-2", name: "Sibling Thread", updatedAt: 800 },
      { id: "root-2", name: "Other Root", updatedAt: 700 },
    ];
    const { result } = renderHook(() =>
      useThreadRows({
        "child-1": "root-1",
        "child-2": "root-1",
      })
    );

    const rows = result.current.getThreadRows(threads, false, "ws-1", getPinTimestamp, {
      matchingThreadIds: new Set(["child-1"]),
    });

    expect(rows.unpinnedRows.map((row) => row.thread.id)).toEqual(["root-1", "child-1"]);
    expect(rows.totalRoots).toBe(1);
    expect(rows.hasMoreRoots).toBe(false);
  });

  it("shows every matching root in search mode without the default three-root truncation", () => {
    const threads: ThreadSummary[] = [
      { id: "root-1", name: "Alpha", updatedAt: 1000 },
      { id: "root-2", name: "Beta", updatedAt: 900 },
      { id: "root-3", name: "Gamma", updatedAt: 800 },
      { id: "root-4", name: "Delta", updatedAt: 700 },
    ];
    const { result } = renderHook(() => useThreadRows({}));

    const rows = result.current.getThreadRows(threads, false, "ws-1", getPinTimestamp, {
      matchingThreadIds: new Set(["root-2", "root-4"]),
    });

    expect(rows.unpinnedRows.map((row) => row.thread.id)).toEqual(["root-2", "root-4"]);
    expect(rows.totalRoots).toBe(2);
    expect(rows.hasMoreRoots).toBe(false);
  });

  it("filters pinned roots to the matching chain during search", () => {
    const threads: ThreadSummary[] = [
      { id: "pinned-root-1", name: "Pinned One", updatedAt: 1000 },
      { id: "pinned-child", name: "Pinned Match", updatedAt: 900 },
      { id: "pinned-root-2", name: "Pinned Two", updatedAt: 800 },
    ];
    const { result } = renderHook(() =>
      useThreadRows({
        "pinned-child": "pinned-root-1",
      })
    );

    const rows = result.current.getThreadRows(threads, false, "ws-1", getPinTimestamp, {
      matchingThreadIds: new Set(["pinned-child"]),
    });

    expect(rows.pinnedRows.map((row) => row.thread.id)).toEqual(["pinned-root-1", "pinned-child"]);
    expect(rows.unpinnedRows).toEqual([]);
  });
});
