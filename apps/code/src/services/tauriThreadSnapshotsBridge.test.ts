import { beforeEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import { detectRuntimeMode, getRuntimeClient } from "./runtimeClient";
import {
  getErrorMessage,
  isRuntimeMethodUnsupportedError,
  isWebRuntimeConnectionError,
} from "./tauriRuntimeTransport";
import { logRuntimeWarning } from "./tauriRuntimeTurnHelpers";
import {
  __resetPersistedThreadStorageCacheForTests,
  type PersistedThreadStorageState,
  readPersistedThreadStorageState,
  readPersistedActiveThreadIdsByWorkspace,
  readPersistedThreadAtlasMemoryDigests,
  readPersistedPendingInterruptThreadIds,
  readPersistedActiveWorkspaceId,
  writePersistedActiveWorkspaceId,
  writePersistedThreadAtlasMemoryDigests,
  writePersistedPendingInterruptThreadIds,
  writePersistedThreadStorageState,
} from "./tauriThreadSnapshotsBridge";

vi.mock("./runtimeClient", () => ({
  detectRuntimeMode: vi.fn(),
  getRuntimeClient: vi.fn(),
}));

vi.mock("./tauriRuntimeTransport", () => ({
  getErrorMessage: vi.fn((error: unknown) =>
    error instanceof Error ? error.message : String(error)
  ),
  isRuntimeMethodUnsupportedError: vi.fn(() => false),
  isWebRuntimeConnectionError: vi.fn(() => false),
}));

vi.mock("./tauriRuntimeTurnHelpers", () => ({
  logRuntimeWarning: vi.fn(),
}));

describe("tauriThreadSnapshotsBridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    __resetPersistedThreadStorageCacheForTests();
    sessionStorage.clear();
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    vi.mocked(isRuntimeMethodUnsupportedError).mockReturnValue(false);
    vi.mocked(isWebRuntimeConnectionError).mockImplementation(
      (error) => error instanceof Error && error.message === "runtime booting"
    );
    vi.mocked(getErrorMessage).mockImplementation((error) =>
      error instanceof Error ? error.message : String(error)
    );
  });

  it("retries startup reads until native thread storage becomes available", async () => {
    vi.useFakeTimers();
    const threadSnapshotsGetV1 = vi
      .fn()
      .mockRejectedValueOnce(new Error("runtime booting"))
      .mockResolvedValueOnce({
        snapshots: {
          __last_active_workspace_v1: {
            workspaceId: "ws-playground",
          },
        },
      });
    vi.mocked(getRuntimeClient).mockReturnValue({
      threadSnapshotsGetV1,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    const workspaceIdPromise = readPersistedActiveWorkspaceId();
    await vi.runAllTimersAsync();

    await expect(workspaceIdPromise).resolves.toBe("ws-playground");
    expect(threadSnapshotsGetV1).toHaveBeenCalledTimes(2);
    expect(logRuntimeWarning).not.toHaveBeenCalled();
  });

  it("does not cache an empty fallback when startup reads fail before the web runtime is ready", async () => {
    vi.useFakeTimers();
    const threadSnapshotsGetV1 = vi.fn().mockRejectedValue(new Error("runtime booting"));
    vi.mocked(getRuntimeClient).mockReturnValue({
      threadSnapshotsGetV1,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    const firstWorkspaceIdPromise = readPersistedActiveWorkspaceId();
    await vi.runAllTimersAsync();

    await expect(firstWorkspaceIdPromise).resolves.toBeNull();
    expect(threadSnapshotsGetV1).toHaveBeenCalledTimes(5);
    expect(logRuntimeWarning).toHaveBeenCalledTimes(1);

    threadSnapshotsGetV1.mockReset().mockResolvedValueOnce({
      snapshots: {
        __last_active_workspace_v1: {
          workspaceId: "ws-playground",
        },
      },
    });

    const secondWorkspaceIdPromise = readPersistedActiveWorkspaceId();
    await vi.runAllTimersAsync();

    await expect(secondWorkspaceIdPromise).resolves.toBe("ws-playground");
    expect(threadSnapshotsGetV1).toHaveBeenCalledTimes(1);
  });

  it("prefers the same-tab session workspace fallback during fast reloads", async () => {
    sessionStorage.setItem("codexmonitor.activeWorkspaceSession", "workspace-web");
    const threadSnapshotsGetV1 = vi.fn().mockResolvedValue({
      snapshots: {
        __last_active_workspace_v1: {
          workspaceId: "demo",
        },
      },
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      threadSnapshotsGetV1,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(readPersistedActiveWorkspaceId()).resolves.toBe("workspace-web");
    expect(threadSnapshotsGetV1).not.toHaveBeenCalled();
  });

  it("serializes concurrent thread storage writes so active workspace updates are not reverted", async () => {
    let releaseFirstWrite: VoidFunction = () => undefined;
    const writes: Array<Record<string, Record<string, unknown>>> = [];
    const threadSnapshotsGetV1 = vi.fn().mockResolvedValue({
      snapshots: {
        __last_active_workspace_v1: {
          workspaceId: "demo",
        },
      },
    });
    const threadSnapshotsSetV1 = vi
      .fn()
      .mockImplementationOnce(
        async ({ snapshots }: { snapshots: Record<string, Record<string, unknown>> }) => {
          writes.push(snapshots);
          await new Promise<void>((resolve) => {
            releaseFirstWrite = resolve;
          });
          return { ok: true };
        }
      )
      .mockImplementation(
        async ({ snapshots }: { snapshots: Record<string, Record<string, unknown>> }) => {
          writes.push(snapshots);
          return { ok: true };
        }
      );
    vi.mocked(getRuntimeClient).mockReturnValue({
      threadSnapshotsGetV1,
      threadSnapshotsSetV1,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    const activeWorkspaceWrite = writePersistedActiveWorkspaceId("workspace-web");
    await waitFor(() => {
      expect(threadSnapshotsSetV1).toHaveBeenCalledTimes(1);
    });

    const threadSnapshotWrite = writePersistedThreadStorageState({
      snapshots: {
        "workspace-web:thread-1": {
          workspaceId: "workspace-web",
          threadId: "thread-1",
          name: "Thread 1",
          updatedAt: 1,
          items: [
            {
              id: "message-1",
              kind: "message",
              role: "user",
              text: "hello",
            },
          ],
          lastDurationMs: null,
        },
      },
      pendingDraftMessagesByWorkspace: {},
    });

    await Promise.resolve();
    expect(threadSnapshotsSetV1).toHaveBeenCalledTimes(1);

    releaseFirstWrite();
    await activeWorkspaceWrite;
    await threadSnapshotWrite;

    expect(threadSnapshotsSetV1).toHaveBeenCalledTimes(2);
    expect(writes[0]?.__last_active_workspace_v1).toEqual({
      workspaceId: "workspace-web",
    });
    expect(writes[1]?.__last_active_workspace_v1).toEqual({
      workspaceId: "workspace-web",
    });
  });

  it("mirrors active workspace writes into session storage before the native write resolves", async () => {
    let releaseWrite: VoidFunction = () => undefined;
    const threadSnapshotsGetV1 = vi.fn().mockResolvedValue({
      snapshots: {},
    });
    const threadSnapshotsSetV1 = vi.fn().mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        releaseWrite = resolve;
      });
      return { ok: true };
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      threadSnapshotsGetV1,
      threadSnapshotsSetV1,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    const writePromise = writePersistedActiveWorkspaceId("workspace-web");

    expect(sessionStorage.getItem("codexmonitor.activeWorkspaceSession")).toBe("workspace-web");
    await waitFor(() => {
      expect(threadSnapshotsSetV1).toHaveBeenCalledTimes(1);
    });

    releaseWrite();
    await expect(writePromise).resolves.toBe(true);
  });

  it("clears session thread snapshot fallback state after runtime-backed persistence succeeds", async () => {
    const threadSnapshotsGetV1 = vi.fn().mockResolvedValue({
      snapshots: {},
    });
    const threadSnapshotsSetV1 = vi.fn().mockResolvedValue({
      ok: true,
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      threadSnapshotsGetV1,
      threadSnapshotsSetV1,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(
      writePersistedThreadStorageState({
        snapshots: {
          "workspace-web:thread-1": {
            workspaceId: "workspace-web",
            threadId: "thread-1",
            name: "Thread 1",
            updatedAt: 1,
            items: [
              {
                id: "message-1",
                kind: "message",
                role: "user",
                text: "hello",
              },
            ],
            lastDurationMs: null,
          },
        },
        pendingDraftMessagesByWorkspace: {},
        lastActiveWorkspaceId: "workspace-web",
        lastActiveThreadIdByWorkspace: {
          "workspace-web": "thread-1",
        },
      })
    ).resolves.toBe(true);

    expect(sessionStorage.getItem("codexmonitor.threadStorageSession")).toBeNull();
    expect(sessionStorage.getItem("codexmonitor.threadStorageRecoverySession")).toBeNull();
    expect(sessionStorage.getItem("codexmonitor.activeWorkspaceSession")).toBe("workspace-web");
    expect(sessionStorage.getItem("codexmonitor.activeThreadIdsSession")).toBe(
      JSON.stringify({ "workspace-web": "thread-1" })
    );
  });

  it("keeps session thread snapshot fallback state when runtime persistence is unavailable", async () => {
    vi.mocked(isRuntimeMethodUnsupportedError).mockImplementation(
      (error) => error instanceof Error && error.message === "unsupported"
    );
    const threadSnapshotsGetV1 = vi.fn().mockResolvedValue({
      snapshots: {},
    });
    const threadSnapshotsSetV1 = vi.fn().mockRejectedValue(new Error("unsupported"));
    vi.mocked(getRuntimeClient).mockReturnValue({
      threadSnapshotsGetV1,
      threadSnapshotsSetV1,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(
      writePersistedThreadStorageState({
        snapshots: {
          "workspace-web:thread-1": {
            workspaceId: "workspace-web",
            threadId: "thread-1",
            name: "Thread 1",
            updatedAt: 1,
            items: [
              {
                id: "message-1",
                kind: "message",
                role: "user",
                text: "hello",
              },
            ],
            lastDurationMs: null,
          },
        },
        pendingDraftMessagesByWorkspace: {},
      })
    ).resolves.toBe(false);

    expect(sessionStorage.getItem("codexmonitor.threadStorageSession")).not.toBeNull();
    expect(sessionStorage.getItem("codexmonitor.threadStorageRecoverySession")).not.toBeNull();
  });

  it("restores session-mirrored thread snapshots during a fast same-tab reload before native persistence resolves", async () => {
    let releaseWrite: VoidFunction = () => undefined;
    const persistedState: PersistedThreadStorageState = {
      snapshots: {
        "workspace-web:thread-1": {
          workspaceId: "workspace-web",
          threadId: "thread-1",
          name: "restore thread",
          updatedAt: 1,
          items: [
            {
              id: "optimistic-user-1",
              kind: "message",
              role: "user",
              text: "restore the in-flight user message",
            },
          ],
          lastDurationMs: null,
        },
      },
      pendingDraftMessagesByWorkspace: {},
      lastActiveWorkspaceId: "workspace-web",
      lastActiveThreadIdByWorkspace: {
        "workspace-web": "thread-1",
      },
    };
    const threadSnapshotsGetV1 = vi.fn().mockResolvedValue({
      snapshots: {},
    });
    const threadSnapshotsSetV1 = vi.fn().mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        releaseWrite = resolve;
      });
      return { ok: true };
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      threadSnapshotsGetV1,
      threadSnapshotsSetV1,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    const writePromise = writePersistedThreadStorageState(persistedState);
    await waitFor(() => {
      expect(threadSnapshotsSetV1).toHaveBeenCalledTimes(1);
    });

    __resetPersistedThreadStorageCacheForTests();

    await expect(readPersistedThreadStorageState()).resolves.toMatchObject(persistedState);
    expect(logRuntimeWarning).toHaveBeenCalledWith(
      "Using session thread snapshot fallback until runtime-published thread state is available.",
      expect.objectContaining({
        snapshotCount: 1,
      })
    );

    releaseWrite();
    await expect(writePromise).resolves.toBe(true);
  });

  it("keeps runtime-published snapshots canonical and only merges client-owned session state", async () => {
    sessionStorage.setItem(
      "codexmonitor.threadStorageSession",
      JSON.stringify({
        snapshots: {
          "workspace-web:thread-session": {
            workspaceId: "workspace-web",
            threadId: "thread-session",
            name: "session thread",
            updatedAt: 2,
            items: [
              {
                id: "message-session",
                kind: "message",
                role: "user",
                text: "session copy",
              },
            ],
            lastDurationMs: null,
          },
        },
        pendingDraftMessagesByWorkspace: {
          "workspace-session": [
            {
              id: "draft-session",
              kind: "message",
              role: "user",
              text: "session draft",
            },
          ],
        },
        lastActiveThreadIdByWorkspace: {
          "workspace-session": "thread-session",
        },
      })
    );
    const threadSnapshotsGetV1 = vi.fn().mockResolvedValue({
      snapshots: {
        "workspace-native:thread-native": {
          workspaceId: "workspace-native",
          threadId: "thread-native",
          name: "native thread",
          updatedAt: 1,
          items: [
            {
              id: "message-native",
              kind: "message",
              role: "user",
              text: "native copy",
            },
          ],
          lastDurationMs: null,
        },
        __pending_workspace_drafts_v1: {
          "workspace-native": [
            {
              id: "draft-native",
              kind: "message",
              role: "user",
              text: "native draft",
            },
          ],
        },
        __active_thread_ids_v1: {
          "workspace-native": {
            threadId: "thread-native",
          },
        },
      },
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      threadSnapshotsGetV1,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(readPersistedThreadStorageState()).resolves.toEqual({
      snapshots: {
        "workspace-native:thread-native": {
          workspaceId: "workspace-native",
          threadId: "thread-native",
          name: "native thread",
          updatedAt: 1,
          items: [
            {
              id: "message-native",
              kind: "message",
              role: "user",
              text: "native copy",
            },
          ],
          lastDurationMs: null,
        },
      },
      pendingDraftMessagesByWorkspace: {
        "workspace-native": [
          {
            id: "draft-native",
            kind: "message",
            role: "user",
            text: "native draft",
          },
        ],
        "workspace-session": [
          {
            id: "draft-session",
            kind: "message",
            role: "user",
            text: "session draft",
          },
        ],
      },
      lastActiveWorkspaceId: null,
      lastActiveThreadIdByWorkspace: {
        "workspace-native": "thread-native",
        "workspace-session": "thread-session",
      },
    });
    expect(logRuntimeWarning).toHaveBeenCalledWith(
      "Ignoring session thread snapshot fallback because runtime-published thread state is available.",
      expect.objectContaining({
        runtimeSnapshotCount: 1,
        sessionSnapshotCount: 1,
      })
    );
  });

  it("ignores stale session thread snapshots when runtime responds empty outside the recovery window", async () => {
    sessionStorage.setItem(
      "codexmonitor.threadStorageSession",
      JSON.stringify({
        snapshots: {
          "workspace-session:thread-session": {
            workspaceId: "workspace-session",
            threadId: "thread-session",
            name: "stale session thread",
            updatedAt: 2,
            items: [
              {
                id: "message-session",
                kind: "message",
                role: "user",
                text: "stale session copy",
              },
            ],
            lastDurationMs: null,
          },
        },
        atlasMemoryDigests: {
          "workspace-session:thread-session": {
            summary: "stale digest",
            updatedAt: 3,
          },
        },
        pendingDraftMessagesByWorkspace: {
          "workspace-session": [
            {
              id: "draft-session",
              kind: "message",
              role: "user",
              text: "session draft",
            },
          ],
        },
        lastActiveThreadIdByWorkspace: {
          "workspace-session": "thread-session",
        },
      })
    );
    sessionStorage.setItem(
      "codexmonitor.threadStorageRecoverySession",
      JSON.stringify({
        updatedAt: Date.now() - 60_000,
      })
    );
    const threadSnapshotsGetV1 = vi.fn().mockResolvedValue({
      snapshots: {},
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      threadSnapshotsGetV1,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(readPersistedThreadStorageState()).resolves.toEqual({
      snapshots: {},
      pendingDraftMessagesByWorkspace: {
        "workspace-session": [
          {
            id: "draft-session",
            kind: "message",
            role: "user",
            text: "session draft",
          },
        ],
      },
      lastActiveWorkspaceId: null,
      lastActiveThreadIdByWorkspace: {
        "workspace-session": "thread-session",
      },
    });
    expect(logRuntimeWarning).toHaveBeenCalledWith(
      "Ignoring session thread snapshot fallback because runtime-published thread state is empty outside the temporary recovery window.",
      expect.objectContaining({
        runtimeSnapshotCount: 0,
        sessionSnapshotCount: 1,
        recoveryWindowState: "expired",
      })
    );
  });

  it("does not treat session atlas digests as thread snapshot fallback truth", async () => {
    sessionStorage.setItem(
      "codexmonitor.threadStorageSession",
      JSON.stringify({
        atlasMemoryDigests: {
          "workspace-session:thread-session": {
            summary: "session atlas digest",
            updatedAt: 7,
          },
        },
        pendingDraftMessagesByWorkspace: {},
      })
    );
    sessionStorage.setItem(
      "codexmonitor.threadStorageRecoverySession",
      JSON.stringify({
        updatedAt: Date.now(),
      })
    );
    const threadSnapshotsGetV1 = vi.fn().mockResolvedValue({
      snapshots: {},
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      threadSnapshotsGetV1,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(readPersistedThreadAtlasMemoryDigests()).resolves.toEqual({});
    expect(logRuntimeWarning).not.toHaveBeenCalledWith(
      "Using session thread snapshot fallback until runtime-published thread state is available.",
      expect.anything()
    );
  });

  it("prefers the same-tab session active thread ids during fast reloads", async () => {
    sessionStorage.setItem(
      "codexmonitor.activeThreadIdsSession",
      JSON.stringify({ "workspace-web": "thread-session" })
    );
    const threadSnapshotsGetV1 = vi.fn().mockResolvedValue({
      snapshots: {
        __active_thread_ids_v1: {
          "workspace-web": "thread-native",
        },
      },
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      threadSnapshotsGetV1,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(readPersistedActiveThreadIdsByWorkspace()).resolves.toEqual({
      "workspace-web": "thread-session",
    });
    expect(threadSnapshotsGetV1).not.toHaveBeenCalled();
  });

  it("persists queued interrupt thread ids in same-tab session storage", () => {
    writePersistedPendingInterruptThreadIds(["thread-1", "thread-2", "thread-1", "   "]);

    expect(readPersistedPendingInterruptThreadIds()).toEqual(["thread-1", "thread-2"]);
    expect(sessionStorage.getItem("codexmonitor.pendingInterruptThreadIdsSession")).toBe(
      JSON.stringify(["thread-1", "thread-2"])
    );

    writePersistedPendingInterruptThreadIds([]);

    expect(readPersistedPendingInterruptThreadIds()).toEqual([]);
    expect(sessionStorage.getItem("codexmonitor.pendingInterruptThreadIdsSession")).toBeNull();
  });

  it("persists atlas memory digests through runtime-backed thread snapshots", async () => {
    const threadSnapshotsGetV1 = vi.fn().mockResolvedValue({
      snapshots: {
        __atlas_memory_digests_v1: {
          "workspace-web:thread-1": {
            summary: "Runtime continuity summary",
            updatedAt: 123,
          },
        },
      },
    });
    const threadSnapshotsSetV1 = vi.fn().mockResolvedValue({
      snapshotCount: 1,
      updatedAt: 456,
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      threadSnapshotsGetV1,
      threadSnapshotsSetV1,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(readPersistedThreadAtlasMemoryDigests()).resolves.toEqual({
      "workspace-web:thread-1": {
        summary: "Runtime continuity summary",
        updatedAt: 123,
      },
    });

    await expect(
      writePersistedThreadAtlasMemoryDigests({
        "workspace-web:thread-1": {
          summary: "Updated runtime continuity summary",
          updatedAt: 789,
        },
      })
    ).resolves.toBe(true);

    expect(threadSnapshotsSetV1).toHaveBeenCalledWith({
      snapshots: {
        __atlas_memory_digests_v1: {
          "workspace-web:thread-1": {
            summary: "Updated runtime continuity summary",
            updatedAt: 789,
          },
        },
      },
    });
  });
});
