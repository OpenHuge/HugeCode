// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearLegacyThreadSnapshots,
  loadCustomNames,
  loadLegacyThreadSnapshots,
  loadPinnedThreads,
  loadThreadActivity,
  STORAGE_KEY_CUSTOM_NAMES,
  STORAGE_KEY_PINNED_THREADS,
  savePinnedThreads,
  saveThreadActivity,
} from "../utils/threadStorage";
import {
  readPersistedThreadStorageState,
  writePersistedThreadStorageState,
} from "../../../application/runtime/ports/tauriThreadSnapshots";
import { logger } from "../../../application/runtime/ports/logger";
import { useThreadStorage } from "./useThreadStorage";

vi.mock("../utils/threadStorage", () => ({
  MAX_PINS_SOFT_LIMIT: 2,
  STORAGE_KEY_CUSTOM_NAMES: "custom-names",
  STORAGE_KEY_PINNED_THREADS: "pinned-threads",
  loadLegacyThreadSnapshots: vi.fn(() => ({})),
  clearLegacyThreadSnapshots: vi.fn(),
  loadCustomNames: vi.fn(),
  loadPinnedThreads: vi.fn(),
  loadThreadActivity: vi.fn(),
  makeCustomNameKey: (workspaceId: string, threadId: string) => `${workspaceId}:${threadId}`,
  makePinKey: (workspaceId: string, threadId: string) => `${workspaceId}:${threadId}`,
  makeThreadSnapshotKey: (workspaceId: string, threadId: string) => `${workspaceId}:${threadId}`,
  savePinnedThreads: vi.fn(),
  saveThreadActivity: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/tauriThreadSnapshots", () => ({
  readPersistedPendingInterruptThreadIds: vi.fn(() => []),
  readPersistedThreadStorageState: vi.fn(),
  writePersistedPendingInterruptThreadIds: vi.fn(),
  writePersistedThreadStorageState: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/logger", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

describe("useThreadStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadLegacyThreadSnapshots).mockReturnValue({});
  });

  it("loads initial data and updates custom names on storage events", async () => {
    vi.mocked(loadThreadActivity).mockReturnValue({
      "ws-1": { "thread-1": 101 },
    });
    vi.mocked(loadPinnedThreads).mockReturnValue({ "ws-1:thread-1": 202 });
    vi.mocked(readPersistedThreadStorageState).mockResolvedValue({
      snapshots: {},
      pendingDraftMessagesByWorkspace: {},
    });
    vi.mocked(loadCustomNames)
      .mockReturnValueOnce({ "ws-1:thread-1": "Custom" })
      .mockReturnValueOnce({ "ws-1:thread-1": "Updated" });

    const { result } = renderHook(() => useThreadStorage());

    expect(result.current.threadActivityRef.current).toEqual({
      "ws-1": { "thread-1": 101 },
    });
    expect(result.current.pinnedThreadsRef.current).toEqual({
      "ws-1:thread-1": 202,
    });
    await waitFor(() => {
      expect(readPersistedThreadStorageState).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(result.current.getCustomName("ws-1", "thread-1")).toBe("Custom");
    });

    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY_CUSTOM_NAMES }));
    });

    await waitFor(() => {
      expect(result.current.getCustomName("ws-1", "thread-1")).toBe("Updated");
    });
  });

  it("records thread activity and persists updates", async () => {
    vi.mocked(loadThreadActivity).mockReturnValue({});
    vi.mocked(loadPinnedThreads).mockReturnValue({});
    vi.mocked(readPersistedThreadStorageState).mockResolvedValue({
      snapshots: {},
      pendingDraftMessagesByWorkspace: {},
    });
    vi.mocked(loadCustomNames).mockReturnValue({});

    const { result } = renderHook(() => useThreadStorage());

    await waitFor(() => {
      expect(result.current.threadSnapshotsReady).toBe(true);
    });

    act(() => {
      result.current.recordThreadActivity("ws-2", "thread-9", 999);
    });

    expect(result.current.threadActivityRef.current).toEqual({
      "ws-2": { "thread-9": 999 },
    });
    expect(saveThreadActivity).toHaveBeenCalledWith({
      "ws-2": { "thread-9": 999 },
    });
  });

  it("pins and unpins threads while updating persistence", async () => {
    vi.mocked(loadThreadActivity).mockReturnValue({});
    vi.mocked(loadPinnedThreads).mockReturnValue({});
    vi.mocked(readPersistedThreadStorageState).mockResolvedValue({
      snapshots: {},
      pendingDraftMessagesByWorkspace: {},
    });
    vi.mocked(loadCustomNames).mockReturnValue({});

    const { result } = renderHook(() => useThreadStorage());

    await waitFor(() => {
      expect(result.current.threadSnapshotsReady).toBe(true);
    });

    let pinResult = false;
    act(() => {
      pinResult = result.current.pinThread("ws-1", "thread-1");
    });

    expect(pinResult).toBe(true);
    expect(result.current.isThreadPinned("ws-1", "thread-1")).toBe(true);
    expect(savePinnedThreads).toHaveBeenCalledWith({
      "ws-1:thread-1": expect.any(Number),
    });

    const versionAfterPin = result.current.pinnedThreadsVersion;

    act(() => {
      result.current.unpinThread("ws-1", "thread-1");
    });

    expect(result.current.isThreadPinned("ws-1", "thread-1")).toBe(false);
    expect(savePinnedThreads).toHaveBeenCalledWith({});
    expect(result.current.pinnedThreadsVersion).toBe(versionAfterPin + 1);
  });

  it("ignores duplicate pins and reacts to pinned storage changes", async () => {
    vi.mocked(loadThreadActivity).mockReturnValue({});
    vi.mocked(loadPinnedThreads).mockReturnValue({ "ws-1:thread-1": 123 });
    vi.mocked(readPersistedThreadStorageState).mockResolvedValue({
      snapshots: {},
      pendingDraftMessagesByWorkspace: {},
    });
    vi.mocked(loadCustomNames).mockReturnValue({});

    const { result } = renderHook(() => useThreadStorage());

    let pinResult = true;
    act(() => {
      pinResult = result.current.pinThread("ws-1", "thread-1");
    });

    expect(pinResult).toBe(false);
    expect(savePinnedThreads).not.toHaveBeenCalled();

    const versionBefore = result.current.pinnedThreadsVersion;

    vi.mocked(loadPinnedThreads).mockReturnValue({ "ws-1:thread-2": 456 });
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY_PINNED_THREADS }));
    });

    await waitFor(() => {
      expect(result.current.pinnedThreadsVersion).toBe(versionBefore + 1);
    });
    expect(result.current.isThreadPinned("ws-1", "thread-2")).toBe(true);
  });

  it("syncs and removes thread snapshots through native persistence", async () => {
    vi.mocked(loadThreadActivity).mockReturnValue({});
    vi.mocked(loadPinnedThreads).mockReturnValue({});
    vi.mocked(loadCustomNames).mockReturnValue({});
    vi.mocked(readPersistedThreadStorageState).mockResolvedValue({
      snapshots: {},
      pendingDraftMessagesByWorkspace: {},
    });

    const { result } = renderHook(() => useThreadStorage());

    act(() => {
      result.current.syncThreadSnapshots(
        {
          "ws-1": [{ id: "thread-1", name: "Persisted thread", updatedAt: 123 }],
        },
        {
          "thread-1": [{ id: "msg-1", kind: "message", role: "user", text: "hello" }],
        },
        {
          "thread-1": {
            isProcessing: false,
            hasUnread: false,
            isReviewing: false,
            executionState: "idle",
            processingStartedAt: null,
            lastDurationMs: 480,
          },
        }
      );
    });

    await waitFor(() => {
      expect(writePersistedThreadStorageState).toHaveBeenCalledWith({
        snapshots: {
          "ws-1:thread-1": {
            workspaceId: "ws-1",
            threadId: "thread-1",
            name: "Persisted thread",
            updatedAt: 123,
            items: [{ id: "msg-1", kind: "message", role: "user", text: "hello" }],
            lastDurationMs: 480,
          },
        },
        pendingDraftMessagesByWorkspace: {},
        lastActiveThreadIdByWorkspace: {},
      });
    });

    act(() => {
      result.current.removeThreadSnapshot("ws-1", "thread-1");
    });

    await waitFor(() => {
      expect(result.current.listThreadSnapshots("ws-1")).toEqual([]);
      expect(writePersistedThreadStorageState).toHaveBeenLastCalledWith({
        snapshots: {},
        pendingDraftMessagesByWorkspace: {},
        lastActiveThreadIdByWorkspace: {},
      });
    });
  });

  it("persists pending draft user messages through native persistence", async () => {
    vi.mocked(loadThreadActivity).mockReturnValue({});
    vi.mocked(loadPinnedThreads).mockReturnValue({});
    vi.mocked(loadCustomNames).mockReturnValue({});
    vi.mocked(readPersistedThreadStorageState).mockResolvedValue({
      snapshots: {},
      pendingDraftMessagesByWorkspace: {
        "ws-1": [{ id: "draft-0", kind: "message", role: "user", text: "restored draft" }],
      },
    });

    const { result } = renderHook(() => useThreadStorage());

    await waitFor(() => {
      expect(result.current.getPersistedPendingDraftMessages("ws-1")).toEqual([
        { id: "draft-0", kind: "message", role: "user", text: "restored draft" },
      ]);
    });

    act(() => {
      result.current.persistPendingDraftMessages("ws-1", [
        { id: "draft-1", kind: "message", role: "user", text: "keep me pending" },
        { id: "assistant-ignored", kind: "message", role: "assistant", text: "ignore me" },
      ]);
    });

    await waitFor(() => {
      expect(writePersistedThreadStorageState).toHaveBeenLastCalledWith({
        snapshots: {},
        pendingDraftMessagesByWorkspace: {
          "ws-1": [{ id: "draft-1", kind: "message", role: "user", text: "keep me pending" }],
        },
        lastActiveThreadIdByWorkspace: {},
      });
    });

    act(() => {
      result.current.persistPendingDraftMessages("ws-1", []);
    });

    await waitFor(() => {
      expect(writePersistedThreadStorageState).toHaveBeenLastCalledWith({
        snapshots: {},
        pendingDraftMessagesByWorkspace: {},
        lastActiveThreadIdByWorkspace: {},
      });
    });
  });

  it("persists active thread ids by workspace through native persistence", async () => {
    vi.mocked(loadThreadActivity).mockReturnValue({});
    vi.mocked(loadPinnedThreads).mockReturnValue({});
    vi.mocked(loadCustomNames).mockReturnValue({});
    vi.mocked(readPersistedThreadStorageState).mockResolvedValue({
      snapshots: {},
      pendingDraftMessagesByWorkspace: {},
      lastActiveThreadIdByWorkspace: {
        "ws-1": "thread-restored",
      },
    });

    const { result } = renderHook(() => useThreadStorage());

    await waitFor(() => {
      expect(result.current.getPersistedActiveThreadId("ws-1")).toBe("thread-restored");
    });

    act(() => {
      result.current.persistActiveThreadId("ws-1", "thread-next");
    });

    await waitFor(() => {
      expect(writePersistedThreadStorageState).toHaveBeenLastCalledWith({
        snapshots: {},
        pendingDraftMessagesByWorkspace: {},
        lastActiveThreadIdByWorkspace: {
          "ws-1": "thread-next",
        },
      });
    });

    act(() => {
      result.current.persistActiveThreadId("ws-1", null);
    });

    await waitFor(() => {
      expect(writePersistedThreadStorageState).toHaveBeenLastCalledWith({
        snapshots: {},
        pendingDraftMessagesByWorkspace: {},
        lastActiveThreadIdByWorkspace: {},
      });
    });
  });

  it("does not persist empty placeholder threads and prunes stale placeholder snapshots", async () => {
    vi.mocked(loadThreadActivity).mockReturnValue({});
    vi.mocked(loadPinnedThreads).mockReturnValue({});
    vi.mocked(loadCustomNames).mockReturnValue({});
    vi.mocked(readPersistedThreadStorageState).mockResolvedValue({
      snapshots: {
        "ws-1:thread-empty": {
          workspaceId: "ws-1",
          threadId: "thread-empty",
          name: "New Agent",
          updatedAt: 55,
          items: [],
        },
      },
      pendingDraftMessagesByWorkspace: {},
    });

    const { result } = renderHook(() => useThreadStorage());

    act(() => {
      result.current.syncThreadSnapshots(
        {
          "ws-1": [{ id: "thread-empty", name: "New Agent", updatedAt: 56 }],
        },
        {},
        {}
      );
    });

    await waitFor(() => {
      expect(result.current.listThreadSnapshots("ws-1")).toEqual([]);
      expect(writePersistedThreadStorageState).toHaveBeenCalledWith({
        snapshots: {},
        pendingDraftMessagesByWorkspace: {},
        lastActiveThreadIdByWorkspace: {},
      });
    });
  });

  it("treats New thread as a placeholder name for snapshot persistence", async () => {
    vi.mocked(loadThreadActivity).mockReturnValue({});
    vi.mocked(loadPinnedThreads).mockReturnValue({});
    vi.mocked(loadCustomNames).mockReturnValue({});
    vi.mocked(readPersistedThreadStorageState).mockResolvedValue({
      snapshots: {
        "ws-1:thread-empty": {
          workspaceId: "ws-1",
          threadId: "thread-empty",
          name: "New thread",
          updatedAt: 55,
          items: [],
        },
      },
      pendingDraftMessagesByWorkspace: {},
    });

    const { result } = renderHook(() => useThreadStorage());

    act(() => {
      result.current.syncThreadSnapshots(
        {
          "ws-1": [{ id: "thread-empty", name: "New thread", updatedAt: 56 }],
        },
        {},
        {}
      );
    });

    await waitFor(() => {
      expect(result.current.listThreadSnapshots("ws-1")).toEqual([]);
      expect(writePersistedThreadStorageState).toHaveBeenCalledWith({
        snapshots: {},
        pendingDraftMessagesByWorkspace: {},
        lastActiveThreadIdByWorkspace: {},
      });
    });
  });

  it("does not persist summary-only threads that have no local items yet", async () => {
    vi.mocked(loadThreadActivity).mockReturnValue({});
    vi.mocked(loadPinnedThreads).mockReturnValue({});
    vi.mocked(loadCustomNames).mockReturnValue({});
    vi.mocked(readPersistedThreadStorageState).mockResolvedValue({
      snapshots: {},
      pendingDraftMessagesByWorkspace: {},
    });

    const { result } = renderHook(() => useThreadStorage());

    act(() => {
      result.current.syncThreadSnapshots(
        {
          "ws-1": [{ id: "thread-summary-only", name: "Meaningful title", updatedAt: 56 }],
        },
        {},
        {}
      );
    });

    await waitFor(() => {
      expect(result.current.listThreadSnapshots("ws-1")).toEqual([]);
      expect(writePersistedThreadStorageState).not.toHaveBeenCalled();
    });
  });

  it("cleans empty persisted snapshots from native storage on load", async () => {
    vi.mocked(loadThreadActivity).mockReturnValue({});
    vi.mocked(loadPinnedThreads).mockReturnValue({});
    vi.mocked(loadCustomNames).mockReturnValue({});
    vi.mocked(readPersistedThreadStorageState).mockResolvedValue({
      snapshots: {
        "ws-1:thread-summary-only": {
          workspaceId: "ws-1",
          threadId: "thread-summary-only",
          name: "Meaningful title",
          updatedAt: 56,
          items: [],
        },
      },
      pendingDraftMessagesByWorkspace: {},
    });

    const { result } = renderHook(() => useThreadStorage());

    await waitFor(() => {
      expect(result.current.listThreadSnapshots("ws-1")).toEqual([]);
      expect(writePersistedThreadStorageState).toHaveBeenCalledWith({
        snapshots: {},
        pendingDraftMessagesByWorkspace: {},
        lastActiveThreadIdByWorkspace: {},
      });
    });
  });

  it("does not fall back to legacy snapshots when native thread storage cannot be read", async () => {
    vi.mocked(loadThreadActivity).mockReturnValue({});
    vi.mocked(loadPinnedThreads).mockReturnValue({});
    vi.mocked(loadCustomNames).mockReturnValue({});
    vi.mocked(loadLegacyThreadSnapshots).mockReturnValue({
      "ws-1:thread-legacy": {
        workspaceId: "ws-1",
        threadId: "thread-legacy",
        name: "Legacy thread",
        updatedAt: 91,
        items: [{ id: "msg-legacy", kind: "message", role: "user", text: "restore legacy" }],
      },
    });
    vi.mocked(readPersistedThreadStorageState).mockRejectedValue(new Error("runtime unavailable"));

    const { result } = renderHook(() => useThreadStorage());

    await waitFor(() => {
      expect(result.current.threadSnapshotsReady).toBe(true);
    });

    expect(result.current.listThreadSnapshots("ws-1")).toEqual([]);
    expect(writePersistedThreadStorageState).not.toHaveBeenCalled();
    expect(clearLegacyThreadSnapshots).not.toHaveBeenCalled();
  });

  it("migrates legacy snapshots only after native storage responds successfully", async () => {
    vi.mocked(loadThreadActivity).mockReturnValue({});
    vi.mocked(loadPinnedThreads).mockReturnValue({});
    vi.mocked(loadCustomNames).mockReturnValue({});
    vi.mocked(loadLegacyThreadSnapshots).mockReturnValue({
      "ws-1:thread-legacy": {
        workspaceId: "ws-1",
        threadId: "thread-legacy",
        name: "Legacy thread",
        updatedAt: 91,
        items: [{ id: "msg-legacy", kind: "message", role: "user", text: "restore legacy" }],
      },
    });
    vi.mocked(readPersistedThreadStorageState).mockResolvedValue({
      snapshots: {},
      pendingDraftMessagesByWorkspace: {},
    });
    vi.mocked(writePersistedThreadStorageState).mockResolvedValue(false);

    const { result } = renderHook(() => useThreadStorage());

    await waitFor(() => {
      expect(result.current.listThreadSnapshots("ws-1")).toEqual([
        {
          workspaceId: "ws-1",
          threadId: "thread-legacy",
          name: "Legacy thread",
          updatedAt: 91,
          items: [{ id: "msg-legacy", kind: "message", role: "user", text: "restore legacy" }],
        },
      ]);
    });

    await waitFor(() => {
      expect(writePersistedThreadStorageState).toHaveBeenCalledWith({
        snapshots: {
          "ws-1:thread-legacy": {
            workspaceId: "ws-1",
            threadId: "thread-legacy",
            name: "Legacy thread",
            updatedAt: 91,
            items: [{ id: "msg-legacy", kind: "message", role: "user", text: "restore legacy" }],
          },
        },
        pendingDraftMessagesByWorkspace: {},
        lastActiveThreadIdByWorkspace: {},
      });
    });

    expect(logger.warn).toHaveBeenCalledWith(
      "Hydrating legacy local thread snapshots as a temporary non-authoritative fallback.",
      expect.objectContaining({
        snapshotCount: 1,
        persistToNative: true,
      })
    );

    expect(clearLegacyThreadSnapshots).not.toHaveBeenCalled();
  });

  it("clears ignored legacy local snapshots once native thread storage is authoritative", async () => {
    vi.mocked(loadThreadActivity).mockReturnValue({});
    vi.mocked(loadPinnedThreads).mockReturnValue({});
    vi.mocked(loadCustomNames).mockReturnValue({});
    vi.mocked(loadLegacyThreadSnapshots).mockReturnValue({
      "ws-1:thread-legacy": {
        workspaceId: "ws-1",
        threadId: "thread-legacy",
        name: "Legacy thread",
        updatedAt: 91,
        items: [{ id: "msg-legacy", kind: "message", role: "user", text: "legacy residue" }],
      },
    });
    vi.mocked(readPersistedThreadStorageState).mockResolvedValue({
      snapshots: {
        "ws-1:thread-native": {
          workspaceId: "ws-1",
          threadId: "thread-native",
          name: "Native thread",
          updatedAt: 101,
          items: [{ id: "msg-native", kind: "message", role: "user", text: "runtime truth" }],
        },
      },
      pendingDraftMessagesByWorkspace: {},
      lastActiveThreadIdByWorkspace: {},
    });

    const { result } = renderHook(() => useThreadStorage());

    await waitFor(() => {
      expect(result.current.listThreadSnapshots("ws-1")).toEqual([
        {
          workspaceId: "ws-1",
          threadId: "thread-native",
          name: "Native thread",
          updatedAt: 101,
          items: [{ id: "msg-native", kind: "message", role: "user", text: "runtime truth" }],
        },
      ]);
    });

    expect(clearLegacyThreadSnapshots).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      "Ignoring legacy local thread snapshots because runtime-backed thread storage is available.",
      expect.objectContaining({
        snapshotCount: 1,
        migrationOnly: true,
      })
    );
  });

  it("does not overwrite persisted thread items with an empty summary-only refresh", async () => {
    vi.mocked(loadThreadActivity).mockReturnValue({});
    vi.mocked(loadPinnedThreads).mockReturnValue({});
    vi.mocked(loadCustomNames).mockReturnValue({});
    vi.mocked(readPersistedThreadStorageState).mockResolvedValue({
      snapshots: {
        "ws-1:thread-keep-items": {
          workspaceId: "ws-1",
          threadId: "thread-keep-items",
          name: "Keep items",
          updatedAt: 55,
          items: [{ id: "msg-1", kind: "message", role: "user", text: "keep me" }],
        },
      },
      pendingDraftMessagesByWorkspace: {},
    });

    const { result } = renderHook(() => useThreadStorage());

    act(() => {
      result.current.syncThreadSnapshots(
        {
          "ws-1": [{ id: "thread-keep-items", name: "Keep items", updatedAt: 56 }],
        },
        {},
        {}
      );
    });

    await waitFor(() => {
      expect(result.current.listThreadSnapshots("ws-1")).toEqual([
        {
          workspaceId: "ws-1",
          threadId: "thread-keep-items",
          name: "Keep items",
          updatedAt: 56,
          items: [{ id: "msg-1", kind: "message", role: "user", text: "keep me" }],
          lastDurationMs: null,
        },
      ]);
      expect(writePersistedThreadStorageState).toHaveBeenCalledWith({
        snapshots: {
          "ws-1:thread-keep-items": {
            workspaceId: "ws-1",
            threadId: "thread-keep-items",
            name: "Keep items",
            updatedAt: 56,
            items: [{ id: "msg-1", kind: "message", role: "user", text: "keep me" }],
            lastDurationMs: null,
          },
        },
        pendingDraftMessagesByWorkspace: {},
        lastActiveThreadIdByWorkspace: {},
      });
    });
  });

  it("persists restored thread duration metadata with snapshots", async () => {
    vi.mocked(loadThreadActivity).mockReturnValue({});
    vi.mocked(loadPinnedThreads).mockReturnValue({});
    vi.mocked(loadCustomNames).mockReturnValue({});
    vi.mocked(readPersistedThreadStorageState).mockResolvedValue({
      snapshots: {},
      pendingDraftMessagesByWorkspace: {},
    });

    const { result } = renderHook(() => useThreadStorage());

    act(() => {
      result.current.syncThreadSnapshots(
        {
          "ws-1": [{ id: "thread-duration", name: "Duration thread", updatedAt: 321 }],
        },
        {
          "thread-duration": [{ id: "msg-1", kind: "message", role: "user", text: "probe" }],
        },
        {
          "thread-duration": {
            isProcessing: false,
            hasUnread: false,
            isReviewing: false,
            executionState: "idle",
            processingStartedAt: null,
            lastDurationMs: 150,
          },
        }
      );
    });

    await waitFor(() => {
      expect(result.current.listThreadSnapshots("ws-1")).toEqual([
        {
          workspaceId: "ws-1",
          threadId: "thread-duration",
          name: "Duration thread",
          updatedAt: 321,
          items: [{ id: "msg-1", kind: "message", role: "user", text: "probe" }],
          lastDurationMs: 150,
        },
      ]);
    });
  });
});
