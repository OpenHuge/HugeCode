import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useThreadListSortKey } from "./useThreadListSortKey";

describe("useThreadListSortKey", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads stored sort key", () => {
    window.localStorage.setItem("codexmonitor.threadListSortKey", "created_at");
    const { result } = renderHook(() => useThreadListSortKey());
    expect(result.current.threadListSortKey).toBe("created_at");
  });

  it("falls back safely when localStorage access throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("localStorage blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("localStorage blocked");
    });

    const { result } = renderHook(() => useThreadListSortKey());
    expect(result.current.threadListSortKey).toBe("updated_at");

    act(() => {
      result.current.setThreadListSortKey("created_at");
    });
    expect(result.current.threadListSortKey).toBe("created_at");
  });
});
