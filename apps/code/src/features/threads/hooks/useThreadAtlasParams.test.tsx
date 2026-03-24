// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  STORAGE_KEY_THREAD_ATLAS_MEMORY_DIGESTS,
  STORAGE_KEY_THREAD_ATLAS_PARAMS,
} from "../utils/threadStorage";
import { useThreadAtlasParams } from "./useThreadAtlasParams";

const readPersistedThreadAtlasMemoryDigestsMock = vi.hoisted(() => vi.fn());
const writePersistedThreadAtlasMemoryDigestsMock = vi.hoisted(() => vi.fn());

vi.mock("../../../application/runtime/ports/threadAtlasMemory", () => ({
  readPersistedThreadAtlasMemoryDigests: readPersistedThreadAtlasMemoryDigestsMock,
  writePersistedThreadAtlasMemoryDigests: writePersistedThreadAtlasMemoryDigestsMock,
}));

describe("useThreadAtlasParams", () => {
  beforeEach(() => {
    window.localStorage.clear();
    readPersistedThreadAtlasMemoryDigestsMock.mockResolvedValue({});
    writePersistedThreadAtlasMemoryDigestsMock.mockResolvedValue(true);
  });

  it("patches and retrieves thread-scoped atlas params", () => {
    const { result } = renderHook(() => useThreadAtlasParams());

    act(() => {
      result.current.patchThreadAtlasParams("ws-1", "thread-1", {
        driverOrder: ["token_budget", "plan", "plan"],
      });
    });

    expect(result.current.getThreadAtlasParams("ws-1", "thread-1")).toEqual(
      expect.objectContaining({
        driverOrder: [
          "token_budget",
          "plan",
          "recent_messages",
          "context_compaction",
          "long_term_memory",
          "execution_state",
        ],
        enabled: true,
        detailLevel: "balanced",
      })
    );

    const persisted = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY_THREAD_ATLAS_PARAMS) ?? "{}"
    );
    expect(persisted["ws-1:thread-1"]).toBeTruthy();
  });

  it("sanitizes malformed persisted entries", () => {
    window.localStorage.setItem(
      STORAGE_KEY_THREAD_ATLAS_PARAMS,
      JSON.stringify({
        "ws-1:thread-2": {
          driverOrder: ["plan", 7, "invalid", "recent_messages"],
          updatedAt: "never",
        },
      })
    );

    const { result } = renderHook(() => useThreadAtlasParams());

    expect(result.current.getThreadAtlasParams("ws-1", "thread-2")).toEqual({
      driverOrder: [
        "plan",
        "recent_messages",
        "context_compaction",
        "long_term_memory",
        "token_budget",
        "execution_state",
      ],
      enabled: true,
      detailLevel: "balanced",
      updatedAt: 0,
    });
  });

  it("syncs from storage events", async () => {
    const { result } = renderHook(() => useThreadAtlasParams());

    window.localStorage.setItem(
      STORAGE_KEY_THREAD_ATLAS_PARAMS,
      JSON.stringify({
        "ws-1:thread-3": {
          driverOrder: ["context_compaction", "plan"],
          updatedAt: 42,
        },
      })
    );

    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY_THREAD_ATLAS_PARAMS }));
    });

    await waitFor(() => {
      expect(result.current.version).toBe(1);
    });

    expect(result.current.getThreadAtlasParams("ws-1", "thread-3")).toEqual({
      driverOrder: [
        "context_compaction",
        "plan",
        "recent_messages",
        "long_term_memory",
        "token_budget",
        "execution_state",
      ],
      enabled: true,
      detailLevel: "balanced",
      updatedAt: 42,
    });
  });

  it("patches atlas enabled toggle", () => {
    const { result } = renderHook(() => useThreadAtlasParams());

    act(() => {
      result.current.patchThreadAtlasParams("ws-1", "thread-5", {
        enabled: false,
      });
    });

    expect(result.current.getThreadAtlasParams("ws-1", "thread-5")).toEqual(
      expect.objectContaining({
        enabled: false,
        detailLevel: "balanced",
      })
    );
  });

  it("patches atlas detail level", () => {
    const { result } = renderHook(() => useThreadAtlasParams());

    act(() => {
      result.current.patchThreadAtlasParams("ws-1", "thread-detail", {
        detailLevel: "detailed",
      });
    });

    expect(result.current.getThreadAtlasParams("ws-1", "thread-detail")).toEqual(
      expect.objectContaining({
        detailLevel: "detailed",
      })
    );
  });

  it("upserts and reads long-term memory digest", () => {
    const { result } = renderHook(() => useThreadAtlasParams());

    act(() => {
      result.current.upsertThreadAtlasMemoryDigest("ws-1", "thread-memory", {
        summary: "Remembered summary",
        updatedAt: 1234,
      });
    });

    expect(result.current.getThreadAtlasMemoryDigest("ws-1", "thread-memory")).toEqual({
      summary: "Remembered summary",
      updatedAt: 1234,
    });

    const persisted = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY_THREAD_ATLAS_MEMORY_DIGESTS) ?? "{}"
    );
    expect(persisted["ws-1:thread-memory"]).toEqual({
      summary: "Remembered summary",
      updatedAt: 1234,
    });
    expect(writePersistedThreadAtlasMemoryDigestsMock).toHaveBeenCalledWith({
      "ws-1:thread-memory": {
        summary: "Remembered summary",
        updatedAt: 1234,
      },
    });
  });

  it("hydrates runtime-backed memory digests and mirrors newer local digests back to runtime", async () => {
    window.localStorage.setItem(
      STORAGE_KEY_THREAD_ATLAS_MEMORY_DIGESTS,
      JSON.stringify({
        "ws-1:thread-local": {
          summary: "Local digest",
          updatedAt: 200,
        },
      })
    );
    readPersistedThreadAtlasMemoryDigestsMock.mockResolvedValue({
      "ws-1:thread-runtime": {
        summary: "Runtime digest",
        updatedAt: 100,
      },
    });

    const { result } = renderHook(() => useThreadAtlasParams());

    await waitFor(() => {
      expect(result.current.getThreadAtlasMemoryDigest("ws-1", "thread-runtime")).toEqual({
        summary: "Runtime digest",
        updatedAt: 100,
      });
    });

    expect(result.current.getThreadAtlasMemoryDigest("ws-1", "thread-local")).toEqual({
      summary: "Local digest",
      updatedAt: 200,
    });
    expect(writePersistedThreadAtlasMemoryDigestsMock).toHaveBeenCalledWith({
      "ws-1:thread-local": {
        summary: "Local digest",
        updatedAt: 200,
      },
      "ws-1:thread-runtime": {
        summary: "Runtime digest",
        updatedAt: 100,
      },
    });
  });

  it("deletes per-thread atlas params", () => {
    const { result } = renderHook(() => useThreadAtlasParams());

    act(() => {
      result.current.patchThreadAtlasParams("ws-1", "thread-4", {
        driverOrder: ["plan"],
      });
    });

    expect(result.current.getThreadAtlasParams("ws-1", "thread-4")).not.toBeNull();

    act(() => {
      result.current.deleteThreadAtlasParams("ws-1", "thread-4");
    });

    expect(result.current.getThreadAtlasParams("ws-1", "thread-4")).toBeNull();
  });
});
