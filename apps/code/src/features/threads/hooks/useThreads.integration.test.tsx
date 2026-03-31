// @vitest-environment jsdom
import { useEffect, useState } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  compactThread,
  interruptTurn,
  listThreads,
  listMcpServerStatus,
  resolveChatgptAuthTokensRefreshResponse,
  respondToServerRequest,
  respondToServerRequestResult,
  respondToToolCallRequest,
  respondToUserInputRequest,
  resumeThread,
  sendUserMessage as sendUserMessageService,
  setThreadName,
  startReview,
  startThread,
  steerTurn,
} from "../../../application/runtime/ports/threads";
import {
  subscribeScopedRuntimeUpdatedEvents,
  type ScopedRuntimeUpdatedEventSnapshot,
  type RuntimeUpdatedEvent,
} from "../../../application/runtime/ports/runtimeUpdatedEvents";
import { createRuntimeUpdatedEventFixture } from "../../../test/runtimeUpdatedEventFixtures";
import type { WorkspaceInfo } from "../../../types";
import type { useAppServerEvents } from "../../app/hooks/useAppServerEvents";
import { useThreadRows } from "../../app/hooks/useThreadRows";
import { STORAGE_KEY_DETACHED_REVIEW_LINKS } from "../utils/threadStorage";
import {
  readPersistedPendingInterruptThreadIds,
  readPersistedThreadStorageState,
  writePersistedPendingInterruptThreadIds,
  writePersistedThreadStorageState,
} from "../../../application/runtime/ports/threadSnapshots";
import { useThreads } from "./useThreads";

type AppServerHandlers = Parameters<typeof useAppServerEvents>[0];
type PersistedThreadStorageState = Awaited<ReturnType<typeof readPersistedThreadStorageState>>;

let handlers: AppServerHandlers | null = null;
let runtimeUpdatedListener: ((event: RuntimeUpdatedEvent) => void) | null = null;
let persistedThreadStorageState: PersistedThreadStorageState = {
  snapshots: {},
  pendingDraftMessagesByWorkspace: {},
  lastActiveWorkspaceId: null,
  lastActiveThreadIdByWorkspace: {},
};
let persistedPendingInterruptThreadIds: string[] = [];
const EMPTY_RUNTIME_UPDATED_SNAPSHOT: ScopedRuntimeUpdatedEventSnapshot = {
  revision: 0,
  lastEvent: null,
};
let runtimeUpdatedRevisionCounter = 0;

vi.mock("../../app/hooks/useAppServerEvents", () => ({
  useAppServerEvents: (incoming: AppServerHandlers) => {
    handlers = incoming;
  },
}));

vi.mock("../../../application/runtime/ports/runtimeUpdatedEvents", () => ({
  subscribeScopedRuntimeUpdatedEvents: vi.fn(
    (_, listener: (event: RuntimeUpdatedEvent) => void) => {
      runtimeUpdatedListener = listener;
      return () => {
        if (runtimeUpdatedListener === listener) {
          runtimeUpdatedListener = null;
        }
      };
    }
  ),
  useScopedRuntimeUpdatedEvent: vi.fn(() => {
    const [snapshot, setSnapshot] = useState<ScopedRuntimeUpdatedEventSnapshot>(
      EMPTY_RUNTIME_UPDATED_SNAPSHOT
    );

    useEffect(() => {
      const listener = (event: RuntimeUpdatedEvent) => {
        runtimeUpdatedRevisionCounter += 1;
        setSnapshot({
          revision: runtimeUpdatedRevisionCounter,
          lastEvent: event,
        });
      };
      runtimeUpdatedListener = listener;
      return () => {
        if (runtimeUpdatedListener === listener) {
          runtimeUpdatedListener = null;
        }
      };
    }, []);

    return snapshot;
  }),
}));

vi.mock("../../../application/runtime/ports/threadSnapshots", () => ({
  readPersistedThreadStorageState: vi.fn(async () => persistedThreadStorageState),
  writePersistedThreadStorageState: vi.fn(async (state: PersistedThreadStorageState) => {
    persistedThreadStorageState = state;
    return true;
  }),
  readPersistedPendingInterruptThreadIds: vi.fn(() => persistedPendingInterruptThreadIds),
  writePersistedPendingInterruptThreadIds: vi.fn((threadIds: string[]) => {
    persistedPendingInterruptThreadIds = threadIds;
  }),
  readPersistedThreadSnapshots: vi.fn(async () => persistedThreadStorageState.snapshots),
  writePersistedThreadSnapshots: vi.fn(
    async (snapshots: PersistedThreadStorageState["snapshots"]) => {
      persistedThreadStorageState = {
        ...persistedThreadStorageState,
        snapshots,
      };
      return true;
    }
  ),
}));

vi.mock("../../../application/runtime/ports/runtimeClientMode", () => ({
  detectRuntimeMode: vi.fn(() => "desktop-compat"),
}));

vi.mock("../../../application/runtime/facades/runtimeSessionCommandFacadeHooks", () => ({
  useRuntimeSessionCommandsResolver: () => (workspaceId: string) => ({
    sendMessage: ({ threadId, text, options }: Record<string, unknown>) => {
      const { telemetrySource: _telemetrySource, ...restOptions } = ((options as
        | Record<string, unknown>
        | undefined) ?? {}) as Record<string, unknown>;
      return sendUserMessageService(
        workspaceId,
        String(threadId),
        String(text),
        restOptions as never
      );
    },
    steerTurn: ({
      threadId,
      turnId,
      text,
      images,
      contextPrefix,
      options,
    }: Record<string, unknown>) => {
      const { telemetrySource: _telemetrySource, ...restOptions } = ((options as
        | Record<string, unknown>
        | undefined) ?? {}) as Record<string, unknown>;
      return steerTurn(
        workspaceId,
        String(threadId),
        String(turnId),
        String(text),
        images as string[] | undefined,
        (contextPrefix as string | null | undefined) ?? undefined,
        restOptions as never
      );
    },
    interruptTurn: ({ threadId, turnId }: Record<string, unknown>) =>
      interruptTurn(workspaceId, String(threadId), String(turnId)),
    startReview: ({ threadId, target, delivery }: Record<string, unknown>) =>
      startReview(workspaceId, String(threadId), target as never, delivery as never),
    compactThread: ({ threadId }: Record<string, unknown>) =>
      compactThread(workspaceId, String(threadId)),
    listMcpServerStatus: (input?: { cursor?: string | null; limit?: number | null }) =>
      listMcpServerStatus(workspaceId, input?.cursor ?? null, input?.limit ?? null),
    respondToApproval: ({ requestId, decision }: Record<string, unknown>) =>
      respondToServerRequest(workspaceId, requestId as never, decision as never),
    respondToUserInput: ({ requestId, answers }: Record<string, unknown>) =>
      respondToUserInputRequest(workspaceId, requestId as never, answers as never),
    respondToToolCall: ({ requestId, response }: Record<string, unknown>) =>
      respondToToolCallRequest(workspaceId, requestId as never, response as never),
    canStartReviewInCurrentHost: () => true,
    reviewStartDesktopOnlyMessage: "Review start is only available in the desktop app.",
  }),
}));

vi.mock("../../../application/runtime/ports/threads", () => ({
  REVIEW_START_DESKTOP_ONLY_MESSAGE: "Review start is only available in the desktop app.",
  respondToServerRequest: vi.fn(),
  respondToServerRequestResult: vi.fn(),
  submitTaskApprovalDecision: vi.fn(),
  respondToToolCallRequest: vi.fn(),
  respondToUserInputRequest: vi.fn(),
  resolveChatgptAuthTokensRefreshResponse: vi.fn(),
  rememberApprovalRule: vi.fn(),
  sendUserMessage: vi.fn(),
  steerTurn: vi.fn(),
  startReview: vi.fn(),
  startThread: vi.fn(),
  listThreads: vi.fn(),
  listMcpServerStatus: vi.fn(),
  resumeThread: vi.fn(),
  archiveThread: vi.fn(),
  compactThread: vi.fn(),
  setThreadName: vi.fn(),
  getAccountRateLimits: vi.fn(),
  getAccountInfo: vi.fn(),
  interruptTurn: vi.fn(),
}));

const workspace: WorkspaceInfo = {
  id: "ws-1",
  name: "CodexMonitor",
  path: "/tmp/codex",
  connected: true,
  settings: { sidebarCollapsed: false },
};

const webWorkspace: WorkspaceInfo = {
  id: "ws-web",
  name: "Web Workspace",
  path: "/tmp/workspace-web",
  connected: true,
  settings: { sidebarCollapsed: false },
};

describe("useThreads UX integration", () => {
  let now: number;
  let nowSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    handlers = null;
    runtimeUpdatedListener = null;
    runtimeUpdatedRevisionCounter = 0;
    localStorage.clear();
    persistedThreadStorageState = {
      snapshots: {},
      pendingDraftMessagesByWorkspace: {},
      lastActiveWorkspaceId: null,
      lastActiveThreadIdByWorkspace: {},
    };
    persistedPendingInterruptThreadIds = [];
    vi.resetAllMocks();
    vi.mocked(resumeThread).mockImplementation(
      async (_workspaceId, threadId) =>
        ({
          result: {
            thread: {
              id: threadId,
              updated_at: Date.now(),
            },
          },
        }) as unknown as Awaited<ReturnType<typeof resumeThread>>
    );
    vi.mocked(subscribeScopedRuntimeUpdatedEvents).mockImplementation(
      (_, listener: (event: RuntimeUpdatedEvent) => void) => {
        runtimeUpdatedListener = listener;
        return () => {
          if (runtimeUpdatedListener === listener) {
            runtimeUpdatedListener = null;
          }
        };
      }
    );
    vi.mocked(readPersistedThreadStorageState).mockImplementation(
      async () => persistedThreadStorageState
    );
    vi.mocked(writePersistedThreadStorageState).mockImplementation(
      async (state: PersistedThreadStorageState) => {
        persistedThreadStorageState = state;
        return true;
      }
    );
    vi.mocked(readPersistedPendingInterruptThreadIds).mockImplementation(
      () => persistedPendingInterruptThreadIds
    );
    vi.mocked(writePersistedPendingInterruptThreadIds).mockImplementation((threadIds: string[]) => {
      persistedPendingInterruptThreadIds = threadIds;
    });
    now = 1000;
    nowSpy = vi.spyOn(Date, "now").mockImplementation(() => now++);
  });

  afterEach(() => {
    cleanup();
    nowSpy.mockRestore();
  });

  it("resumes selected threads when no local items exist", async () => {
    vi.mocked(resumeThread).mockResolvedValue({
      result: {
        thread: {
          id: "thread-2",
          preview: "Remote preview",
          updated_at: 9999,
          turns: [
            {
              items: [
                {
                  type: "userMessage",
                  id: "server-user-1",
                  content: [{ type: "text", text: "Hello" }],
                },
                {
                  type: "agentMessage",
                  id: "assistant-1",
                  text: "Hello world",
                },
                {
                  type: "enteredReviewMode",
                  id: "review-1",
                },
              ],
            },
          ],
        },
      },
    });

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    expect(handlers).not.toBeNull();

    act(() => {
      result.current.setActiveThreadId("thread-2");
    });

    await waitFor(() => {
      expect(vi.mocked(resumeThread)).toHaveBeenCalledWith("ws-1", "thread-2", {
        telemetrySource: "thread_actions",
      });
    });

    await waitFor(() => {
      expect(result.current.threadStatusById["thread-2"]?.isReviewing).toBe(true);
    });

    const activeItems = result.current.activeItems;
    const assistantMerged = activeItems.find(
      (item) => item.kind === "message" && item.role === "assistant" && item.id === "assistant-1"
    );
    expect(assistantMerged?.kind).toBe("message");
    if (assistantMerged?.kind === "message") {
      expect(assistantMerged.text).toBe("Hello world");
    }
  });

  it("reselects the freshest listed thread when resume fails for a stale active thread", async () => {
    vi.mocked(resumeThread).mockRejectedValue(new Error("thread missing remotely"));
    vi.mocked(listThreads)
      .mockResolvedValueOnce({
        result: {
          data: [
            {
              id: "thread-stale",
              cwd: workspace.path,
              preview: "Older remote thread",
              updated_at: 100,
            },
            {
              id: "thread-backup",
              cwd: workspace.path,
              preview: "Backup remote thread",
              updated_at: 90,
            },
          ],
          nextCursor: null,
        },
      } as unknown as Awaited<ReturnType<typeof listThreads>>)
      .mockResolvedValueOnce({
        result: {
          data: [
            {
              id: "thread-fresh",
              cwd: workspace.path,
              preview: "Fresh remote thread",
              updated_at: 200,
            },
          ],
          nextCursor: null,
        },
      } as unknown as Awaited<ReturnType<typeof listThreads>>);

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.listThreadsForWorkspace(workspace);
    });

    await waitFor(() => {
      expect(result.current.threadsByWorkspace["ws-1"]?.map((thread) => thread.id)).toEqual([
        "thread-stale",
        "thread-backup",
      ]);
    });

    act(() => {
      result.current.setActiveThreadId("thread-stale");
    });

    await waitFor(() => {
      expect(vi.mocked(resumeThread)).toHaveBeenCalledWith("ws-1", "thread-stale", {
        telemetrySource: "thread_actions",
      });
    });

    await waitFor(() => {
      expect(vi.mocked(listThreads)).toHaveBeenCalledTimes(2);
      expect(result.current.threadsByWorkspace["ws-1"]?.map((thread) => thread.id)).toEqual([
        "thread-fresh",
      ]);
      expect(result.current.activeThreadId).toBe("thread-fresh");
    });
  });

  it("shows the first user message immediately while thread creation is pending", async () => {
    type PendingStartThreadResult = {
      result: {
        thread: {
          id: string;
        };
      };
    };
    let resolveStartThread: (value: PendingStartThreadResult) => void = () => {
      throw new Error("Expected startThread resolver to be initialized.");
    };
    vi.mocked(startThread).mockImplementation(
      () =>
        new Promise<PendingStartThreadResult>((resolve) => {
          resolveStartThread = resolve;
        }) as unknown as ReturnType<typeof startThread>
    );
    vi.mocked(sendUserMessageService).mockResolvedValue({
      result: {
        turn: { id: "turn-1" },
      },
    } as unknown as Awaited<ReturnType<typeof sendUserMessageService>>);

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    let sendPromise: Promise<void> | null = null;
    act(() => {
      sendPromise = result.current.sendUserMessage("hello", []);
    });

    await waitFor(() => {
      expect(
        result.current.activeItems.some(
          (item) => item.kind === "message" && item.role === "user" && item.text === "hello"
        )
      ).toBe(true);
    });

    resolveStartThread({
      result: {
        thread: { id: "thread-1" },
      },
    });
    if (!sendPromise) {
      throw new Error("Expected send promise to be set.");
    }
    await act(async () => {
      await sendPromise;
    });
  });

  it("starts a fresh thread when the restored active thread can no longer be resumed", async () => {
    persistedThreadStorageState = {
      snapshots: {
        "ws-1:thread-stale": {
          workspaceId: "ws-1",
          threadId: "thread-stale",
          name: "Stale thread",
          updatedAt: 500,
          items: [
            {
              id: "stale-user",
              kind: "message",
              role: "user",
              text: "old prompt",
            },
            {
              id: "stale-assistant",
              kind: "message",
              role: "assistant",
              text: "old reply",
            },
          ],
          lastDurationMs: null,
        },
      },
      pendingDraftMessagesByWorkspace: {},
      lastActiveThreadIdByWorkspace: {
        "ws-1": "thread-stale",
      },
    };
    vi.mocked(resumeThread).mockResolvedValue(
      null as unknown as Awaited<ReturnType<typeof resumeThread>>
    );
    vi.mocked(startThread).mockResolvedValue({
      result: {
        thread: { id: "thread-fresh-after-stale" },
      },
    } as unknown as Awaited<ReturnType<typeof startThread>>);
    vi.mocked(sendUserMessageService).mockResolvedValue({
      result: {
        turn: { id: "turn-fresh" },
      },
    } as unknown as Awaited<ReturnType<typeof sendUserMessageService>>);

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    await waitFor(() => {
      expect(result.current.activeThreadId).toBe("thread-stale");
    });

    await act(async () => {
      await result.current.sendUserMessage("recover from stale thread", []);
    });

    expect(vi.mocked(resumeThread)).toHaveBeenCalledWith("ws-1", "thread-stale", {
      telemetrySource: "thread_actions",
    });
    expect(vi.mocked(startThread)).toHaveBeenCalledWith("ws-1", {
      telemetrySource: "thread_actions",
    });
    expect(vi.mocked(sendUserMessageService)).toHaveBeenCalledWith(
      "ws-1",
      "thread-fresh-after-stale",
      "recover from stale thread",
      expect.anything()
    );
    await waitFor(() => {
      expect(result.current.activeThreadId).toBe("thread-fresh-after-stale");
    });
  });

  it("restores the first pending user message after a cold remount before thread creation completes", async () => {
    type PendingStartThreadResult = {
      result: {
        thread: {
          id: string;
        };
      };
    };
    let resolveStartThread: (value: PendingStartThreadResult) => void = () => {
      throw new Error("Expected startThread resolver to be initialized.");
    };
    vi.mocked(startThread).mockImplementation(
      () =>
        new Promise<PendingStartThreadResult>((resolve) => {
          resolveStartThread = resolve;
        }) as unknown as ReturnType<typeof startThread>
    );
    vi.mocked(sendUserMessageService).mockResolvedValue({
      result: {
        turn: { id: "turn-pending-reload" },
      },
    } as unknown as Awaited<ReturnType<typeof sendUserMessageService>>);

    const first = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    act(() => {
      void first.result.current.sendUserMessage("persist me across reload", []);
    });

    await waitFor(() => {
      expect(first.result.current.activeItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "message",
            role: "user",
            text: "persist me across reload",
          }),
        ])
      );
      expect(writePersistedThreadStorageState).toHaveBeenCalledWith(
        expect.objectContaining({
          snapshots: {},
          pendingDraftMessagesByWorkspace: {
            "ws-1": [
              expect.objectContaining({
                kind: "message",
                role: "user",
                text: "persist me across reload",
              }),
            ],
          },
          lastActiveThreadIdByWorkspace: {},
        })
      );
    });

    first.unmount();

    const restored = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    await waitFor(() => {
      expect(restored.result.current.activeThreadId).toBeNull();
      expect(restored.result.current.hasPendingDraftUserMessages).toBe(true);
      expect(restored.result.current.activeItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "message",
            role: "user",
            text: "persist me across reload",
          }),
        ])
      );
    });

    resolveStartThread({
      result: {
        thread: { id: "thread-pending-reload" },
      },
    });
  });

  it("hydrates pending draft messages when the user switches back into the target workspace after bootstrap", async () => {
    persistedThreadStorageState = {
      snapshots: {},
      pendingDraftMessagesByWorkspace: {
        "ws-1": [
          {
            id: "pending-draft-1",
            kind: "message",
            role: "user",
            text: "restore me after switching back",
          },
        ],
      },
    };

    const { result, rerender } = renderHook(
      ({ activeWorkspace }: { activeWorkspace: WorkspaceInfo | null }) =>
        useThreads({
          activeWorkspace,
          onWorkspaceConnected: vi.fn(),
        }),
      {
        initialProps: {
          activeWorkspace: webWorkspace,
        },
      }
    );

    await waitFor(() => {
      expect(result.current.threadSnapshotsReady).toBe(true);
      expect(result.current.activeItems).toEqual([]);
    });

    rerender({ activeWorkspace: workspace });

    await waitFor(() => {
      expect(result.current.hasPendingDraftUserMessages).toBe(true);
      expect(result.current.activeItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "message",
            role: "user",
            text: "restore me after switching back",
          }),
        ])
      );
    });
  });

  it("does not append workspace pending drafts into a restored active thread timeline", async () => {
    persistedThreadStorageState = {
      snapshots: {
        "ws-1:thread-restored": {
          workspaceId: "ws-1",
          threadId: "thread-restored",
          name: "Restored thread",
          updatedAt: 10,
          items: [
            {
              id: "restored-user",
              kind: "message",
              role: "user",
              text: "Inspect the current thread timeline",
            },
            {
              id: "restored-assistant",
              kind: "message",
              role: "assistant",
              text: "Here is the restored response.",
            },
          ],
          lastDurationMs: 1_000,
        },
      },
      pendingDraftMessagesByWorkspace: {
        "ws-1": [
          {
            id: "pending-draft-user-1",
            kind: "message",
            role: "user",
            text: "Reply with exactly: SHOULD_NOT_OVERLAY_ACTIVE_THREAD",
          },
        ],
      },
    };

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    await waitFor(() => {
      expect(result.current.threadSnapshotsReady).toBe(true);
      expect(result.current.activeThreadId).toBe("thread-restored");
    });

    expect(result.current.hasPendingDraftUserMessages).toBe(true);
    expect(result.current.activeItems).toEqual([
      expect.objectContaining({
        id: "restored-user",
        kind: "message",
        role: "user",
        text: "Inspect the current thread timeline",
      }),
      expect.objectContaining({
        id: "restored-assistant",
        kind: "message",
        role: "assistant",
        text: "Here is the restored response.",
      }),
    ]);
    expect(
      result.current.activeItems.some(
        (item) =>
          item.kind === "message" &&
          item.role === "user" &&
          item.text === "Reply with exactly: SHOULD_NOT_OVERLAY_ACTIVE_THREAD"
      )
    ).toBe(false);
  });

  it("keeps optimistic processing feedback when thread status updates arrive as status objects", async () => {
    vi.mocked(sendUserMessageService).mockResolvedValue({
      result: {
        turn: { id: "turn-1" },
      },
    } as unknown as Awaited<ReturnType<typeof sendUserMessageService>>);

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    act(() => {
      result.current.setActiveThreadId("thread-1");
    });

    await act(async () => {
      await result.current.sendUserMessage("hello", []);
    });

    await waitFor(() => {
      expect(result.current.threadStatusById["thread-1"]?.isProcessing).toBe(true);
    });

    act(() => {
      handlers?.onThreadStatusChanged?.("ws-1", {
        threadId: "thread-1",
        status: { status: "active" },
      });
    });

    expect(result.current.threadStatusById["thread-1"]?.isProcessing).toBe(true);

    act(() => {
      handlers?.onThreadStatusChanged?.("ws-1", {
        threadId: "thread-1",
        status: { status: "idle" },
      });
    });

    expect(result.current.threadStatusById["thread-1"]?.isProcessing).toBe(false);
  });

  it("shows the second user message immediately and restores processing feedback for follow-up sends", async () => {
    vi.mocked(sendUserMessageService).mockResolvedValue({
      result: {
        turn: { id: "turn-1" },
      },
    } as unknown as Awaited<ReturnType<typeof sendUserMessageService>>);

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    act(() => {
      result.current.setActiveThreadId("thread-1");
    });

    await act(async () => {
      await result.current.sendUserMessage("first message", []);
    });

    await waitFor(() => {
      expect(result.current.threadStatusById["thread-1"]?.isProcessing).toBe(true);
    });
    expect(
      result.current.activeItems.some(
        (item) => item.kind === "message" && item.role === "user" && item.text === "first message"
      )
    ).toBe(true);

    act(() => {
      handlers?.onTurnCompleted?.("ws-1", "thread-1", "turn-1", {});
    });

    await waitFor(() => {
      expect(result.current.threadStatusById["thread-1"]?.isProcessing).toBe(false);
    });

    await act(async () => {
      await result.current.sendUserMessage("second message", []);
    });

    expect(
      result.current.activeItems.some(
        (item) => item.kind === "message" && item.role === "user" && item.text === "second message"
      )
    ).toBe(true);
    expect(result.current.threadStatusById["thread-1"]?.isProcessing).toBe(true);
  });

  it("reuses the activated thread even when a stale send callback is invoked again", async () => {
    vi.mocked(startThread)
      .mockResolvedValueOnce({
        result: {
          thread: { id: "thread-1" },
        },
      } as Awaited<ReturnType<typeof startThread>>)
      .mockResolvedValueOnce({
        result: {
          thread: { id: "thread-2" },
        },
      } as Awaited<ReturnType<typeof startThread>>);
    vi.mocked(sendUserMessageService).mockResolvedValue({
      result: {
        turn: { id: "turn-1" },
      },
    } as unknown as Awaited<ReturnType<typeof sendUserMessageService>>);

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    const staleSend = result.current.sendUserMessage;

    await act(async () => {
      await staleSend("first message", []);
    });

    await waitFor(() => {
      expect(result.current.activeThreadId).toBe("thread-1");
    });

    act(() => {
      handlers?.onTurnCompleted?.("ws-1", "thread-1", "turn-1", {});
    });

    await act(async () => {
      await staleSend("second message", []);
    });

    expect(vi.mocked(startThread)).toHaveBeenCalledTimes(1);
    expect(
      result.current.activeItems.some(
        (item) => item.kind === "message" && item.role === "user" && item.text === "second message"
      )
    ).toBe(true);
    expect(result.current.threadStatusById["thread-1"]?.isProcessing).toBe(true);
  });

  it("restores persisted thread snapshots with name and messages on a fresh hook instance", async () => {
    vi.mocked(startThread).mockResolvedValue({
      result: {
        thread: { id: "thread-restore-1" },
      },
    });
    vi.mocked(sendUserMessageService).mockResolvedValue({
      result: {
        threadId: "thread-restore-1",
        turn: { id: "turn-restore-1" },
      },
    } as unknown as Awaited<ReturnType<typeof sendUserMessageService>>);
    vi.mocked(resumeThread).mockResolvedValue({
      result: {
        thread: { id: "thread-restore-1" },
      },
    });

    const first = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    await act(async () => {
      await first.result.current.sendUserMessage("restore this thread", []);
    });

    await waitFor(() => {
      expect(first.result.current.threadsByWorkspace["ws-1"]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "thread-restore-1",
            name: "restore this thread",
          }),
        ])
      );
    });

    await waitFor(() => {
      expect(writePersistedThreadStorageState).toHaveBeenCalled();
      expect(JSON.stringify(persistedThreadStorageState.snapshots)).toContain("thread-restore-1");
      expect(JSON.stringify(persistedThreadStorageState.snapshots)).toContain(
        "restore this thread"
      );
    });

    first.unmount();

    const restored = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    await waitFor(() => {
      expect(restored.result.current.threadsByWorkspace["ws-1"]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "thread-restore-1",
            name: "restore this thread",
          }),
        ])
      );
    });

    await waitFor(() => {
      expect(restored.result.current.activeThreadId).toBe("thread-restore-1");
    });

    await waitFor(() => {
      expect(restored.result.current.activeItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "message",
            role: "user",
            text: "restore this thread",
          }),
        ])
      );
    });
  });

  it("prefers the freshest persisted snapshot over a list-default thread during cold restore", async () => {
    let resolveDeferredPersistedThreadStorageState!: (state: PersistedThreadStorageState) => void;
    const deferredPersistedThreadStorageState = new Promise<PersistedThreadStorageState>(
      (resolve) => {
        resolveDeferredPersistedThreadStorageState = resolve;
      }
    );
    vi.mocked(readPersistedThreadStorageState).mockImplementationOnce(
      async () => await deferredPersistedThreadStorageState
    );
    vi.mocked(listThreads).mockResolvedValue({
      result: {
        data: [
          {
            id: "thread-old-default",
            preview: "Older server thread",
            updated_at: 100,
            cwd: workspace.path,
          },
        ],
        nextCursor: null,
      },
    });

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.listThreadsForWorkspace(workspace);
    });

    await waitFor(() => {
      expect(result.current.threadsByWorkspace["ws-1"]?.map((thread) => thread.id)).toEqual([
        "thread-old-default",
      ]);
    });

    act(() => {
      result.current.setActiveThreadId("thread-old-default");
    });

    await waitFor(() => {
      expect(result.current.activeThreadId).toBe("thread-old-default");
    });

    resolveDeferredPersistedThreadStorageState({
      snapshots: {
        "ws-1:thread-fresh-restore": {
          workspaceId: "ws-1",
          threadId: "thread-fresh-restore",
          name: "Fresh restore thread",
          updatedAt: 9_999,
          items: [
            {
              id: "fresh-user",
              kind: "message",
              role: "user",
              text: "restore the newest thread",
            },
            {
              id: "fresh-assistant",
              kind: "message",
              role: "assistant",
              text: "fresh restore reply",
            },
          ],
          lastDurationMs: null,
        },
      },
      pendingDraftMessagesByWorkspace: {},
      lastActiveWorkspaceId: null,
    });

    await act(async () => {
      await deferredPersistedThreadStorageState;
    });

    await waitFor(() => {
      expect(result.current.activeThreadId).toBe("thread-fresh-restore");
      expect(result.current.activeItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "message",
            role: "assistant",
            text: "fresh restore reply",
          }),
        ])
      );
    });
  });

  it("prefers the persisted active thread id over a newer snapshot during cold restore", async () => {
    persistedThreadStorageState = {
      snapshots: {
        "ws-1:thread-selected": {
          workspaceId: "ws-1",
          threadId: "thread-selected",
          name: "Selected thread",
          updatedAt: 5_000,
          items: [
            {
              id: "selected-user",
              kind: "message",
              role: "user",
              text: "selected thread prompt",
            },
            {
              id: "selected-assistant",
              kind: "message",
              role: "assistant",
              text: "selected thread reply",
            },
          ],
          lastDurationMs: null,
        },
        "ws-1:thread-fresher": {
          workspaceId: "ws-1",
          threadId: "thread-fresher",
          name: "Fresher thread",
          updatedAt: 9_999,
          items: [
            {
              id: "fresher-user",
              kind: "message",
              role: "user",
              text: "fresher prompt",
            },
            {
              id: "fresher-assistant",
              kind: "message",
              role: "assistant",
              text: "fresher reply",
            },
          ],
          lastDurationMs: null,
        },
      },
      pendingDraftMessagesByWorkspace: {},
      lastActiveThreadIdByWorkspace: {
        "ws-1": "thread-selected",
      },
    };

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    await waitFor(() => {
      expect(result.current.activeThreadId).toBe("thread-selected");
      expect(result.current.activeItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "message",
            role: "assistant",
            text: "selected thread reply",
          }),
        ])
      );
    });
  });

  it("hydrates persisted lastDurationMs for restored thread snapshots", async () => {
    persistedThreadStorageState = {
      snapshots: {
        "ws-1:thread-empty-turn": {
          workspaceId: "ws-1",
          threadId: "thread-empty-turn",
          name: "Browser debug empty turn",
          updatedAt: 4_200,
          items: [
            {
              id: "user-empty-turn",
              kind: "message",
              role: "user",
              text: "Use browser debugging tools to inspect the current page",
            },
          ],
          lastDurationMs: 240,
        },
      },
      pendingDraftMessagesByWorkspace: {},
    };

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    await waitFor(() => {
      expect(result.current.activeThreadId).toBe("thread-empty-turn");
      expect(result.current.threadStatusById["thread-empty-turn"]).toEqual(
        expect.objectContaining({
          isProcessing: false,
          executionState: "idle",
          processingStartedAt: null,
          lastDurationMs: 240,
        })
      );
    });
  });

  it("can continue sending after restoring a persisted thread snapshot", async () => {
    vi.mocked(startThread).mockResolvedValue({
      result: {
        thread: { id: "thread-restore-2" },
      },
    });
    vi.mocked(sendUserMessageService).mockResolvedValue({
      result: {
        threadId: "thread-restore-2",
        turn: { id: "turn-restore-2" },
      },
    } as unknown as Awaited<ReturnType<typeof sendUserMessageService>>);
    vi.mocked(resumeThread).mockResolvedValue({
      result: {
        thread: {
          id: "thread-restore-2",
          turns: [
            {
              items: [
                {
                  type: "userMessage",
                  id: "server-user-restore-2",
                  content: [{ type: "text", text: "restore this thread" }],
                },
                {
                  type: "agentMessage",
                  id: "server-assistant-restore-2",
                  text: "restored response",
                },
              ],
            },
          ],
        },
      },
    });

    const first = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    await act(async () => {
      await first.result.current.sendUserMessage("restore this thread", []);
    });

    first.unmount();

    const restored = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    act(() => {
      restored.result.current.setActiveThreadId("thread-restore-2");
    });

    await waitFor(() => {
      expect(restored.result.current.activeItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "message",
            role: "assistant",
            text: "restored response",
          }),
        ])
      );
    });

    await act(async () => {
      await restored.result.current.sendUserMessage("follow up after restore", []);
    });

    expect(vi.mocked(sendUserMessageService)).toHaveBeenLastCalledWith(
      "ws-1",
      "thread-restore-2",
      "follow up after restore",
      expect.any(Object)
    );
    expect(restored.result.current.activeItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "message",
          role: "user",
          text: "follow up after restore",
        }),
      ])
    );
  });

  it("restores the most recently active persisted thread when local activity is newer than thread.updatedAt", async () => {
    persistedThreadStorageState = {
      snapshots: {
        "ws-1:thread-old": {
          workspaceId: "ws-1",
          threadId: "thread-old",
          name: "Older thread",
          updatedAt: 5_000,
          items: [
            {
              kind: "message",
              id: "old-user",
              role: "user",
              text: "older thread",
            },
          ],
        },
      },
      pendingDraftMessagesByWorkspace: {},
      lastActiveWorkspaceId: null,
    };
    now = 10_000;
    vi.mocked(startThread).mockResolvedValue({
      result: {
        thread: { id: "thread-new" },
      },
    });
    vi.mocked(sendUserMessageService).mockResolvedValue({
      result: {
        threadId: "thread-new",
        turn: { id: "turn-new" },
      },
    } as unknown as Awaited<ReturnType<typeof sendUserMessageService>>);

    const first = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    await act(async () => {
      await first.result.current.sendUserMessage("new thread should restore", []);
    });

    await waitFor(() => {
      expect(
        (persistedThreadStorageState.snapshots as Record<string, unknown>)["ws-1:thread-new"]
      ).toBeTruthy();
    });

    first.unmount();

    const restored = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    await waitFor(() => {
      expect(restored.result.current.activeThreadId).toBe("thread-new");
      expect(restored.result.current.activeItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "message",
            role: "user",
            text: "new thread should restore",
          }),
        ])
      );
    });
  });

  it("does not auto-restore empty persisted snapshots as the active thread", async () => {
    persistedThreadStorageState = {
      snapshots: {
        "ws-1:thread-empty-restore": {
          workspaceId: "ws-1",
          threadId: "thread-empty-restore",
          name: "Empty restore",
          updatedAt: 5000,
          items: [],
        },
      },
      pendingDraftMessagesByWorkspace: {},
    };

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    await waitFor(() => {
      expect(result.current.activeThreadId).toBeNull();
      expect(result.current.activeItems).toEqual([]);
      expect(result.current.threadsByWorkspace["ws-1"] ?? []).toEqual([]);
    });
  });

  it("keeps persisted thread names when runtime thread list has no meaningful preview", async () => {
    persistedThreadStorageState = {
      snapshots: {
        "ws-1:thread-list-restore-1": {
          workspaceId: "ws-1",
          threadId: "thread-list-restore-1",
          name: "restore this thread",
          updatedAt: 5000,
          items: [
            {
              id: "user-restore-1",
              kind: "message",
              role: "user",
              text: "restore this thread",
            },
          ],
        },
      },
      pendingDraftMessagesByWorkspace: {},
    };
    vi.mocked(listThreads).mockResolvedValue({
      result: {
        data: [
          {
            id: "thread-list-restore-1",
            cwd: "/tmp/codex",
            preview: "",
            updated_at: 5000,
          },
        ],
        nextCursor: null,
      },
    } as unknown as Awaited<ReturnType<typeof listThreads>>);

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    await waitFor(() => {
      expect(result.current.threadsByWorkspace["ws-1"]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "thread-list-restore-1",
            name: "restore this thread",
          }),
        ])
      );
    });

    await act(async () => {
      await result.current.listThreadsForWorkspace(workspace);
    });

    await waitFor(() => {
      expect(result.current.threadsByWorkspace["ws-1"]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "thread-list-restore-1",
            name: "restore this thread",
          }),
        ])
      );
    });
  });

  it("keeps restored local-history threads visible when the runtime list omits them", async () => {
    persistedThreadStorageState = {
      snapshots: {
        "ws-1:thread-local-1": {
          workspaceId: "ws-1",
          threadId: "thread-local-1",
          name: "Local history one",
          updatedAt: 5000,
          items: [
            {
              id: "user-local-1",
              kind: "message",
              role: "user",
              text: "restore local thread one",
            },
          ],
        },
        "ws-1:thread-local-2": {
          workspaceId: "ws-1",
          threadId: "thread-local-2",
          name: "Local history two",
          updatedAt: 4000,
          items: [
            {
              id: "user-local-2",
              kind: "message",
              role: "user",
              text: "restore local thread two",
            },
          ],
        },
      },
      pendingDraftMessagesByWorkspace: {},
      lastActiveThreadIdByWorkspace: {
        "ws-1": "thread-local-1",
      },
    };
    vi.mocked(listThreads).mockResolvedValue({
      result: {
        data: [
          {
            id: "thread-remote",
            cwd: workspace.path,
            preview: "Remote thread",
            updated_at: 6000,
          },
        ],
        nextCursor: null,
      },
    } as unknown as Awaited<ReturnType<typeof listThreads>>);

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    await waitFor(() => {
      expect(result.current.threadsByWorkspace["ws-1"]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "thread-local-1", name: "Local history one" }),
          expect.objectContaining({ id: "thread-local-2", name: "Local history two" }),
        ])
      );
    });

    await act(async () => {
      await result.current.listThreadsForWorkspace(workspace);
    });

    await waitFor(() => {
      expect(result.current.threadsByWorkspace["ws-1"]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "thread-remote", name: "Remote thread" }),
          expect.objectContaining({ id: "thread-local-1", name: "Local history one" }),
          expect.objectContaining({ id: "thread-local-2", name: "Local history two" }),
        ])
      );
    });
  });

  it("refreshes thread list on runtime/updated threads scope events", async () => {
    vi.mocked(listThreads).mockResolvedValue({
      result: {
        data: [],
        nextCursor: null,
      },
    });

    renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    const callsBefore = vi.mocked(listThreads).mock.calls.length;

    act(() => {
      runtimeUpdatedListener?.(
        createRuntimeUpdatedEventFixture({
          revision: "threads-refresh-1",
          scope: ["threads", "bootstrap"],
          reason: "code_thread_archive",
        })
      );
    });

    await waitFor(() => {
      expect(vi.mocked(listThreads).mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  it("refreshes thread list on runtime/updated agents scope events", async () => {
    vi.mocked(listThreads).mockResolvedValue({
      result: {
        data: [],
        nextCursor: null,
      },
    });

    renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    const callsBefore = vi.mocked(listThreads).mock.calls.length;

    act(() => {
      runtimeUpdatedListener?.(
        createRuntimeUpdatedEventFixture({
          revision: "threads-refresh-2",
          scope: ["agents"],
          reason: "code_runtime_run_start_v2",
        })
      );
    });

    await waitFor(() => {
      expect(vi.mocked(listThreads).mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  it("does not refresh thread list for durability degraded runtime diagnostics events", async () => {
    vi.mocked(listThreads).mockResolvedValue({
      result: {
        data: [],
        nextCursor: null,
      },
    });

    renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    const callsBefore = vi.mocked(listThreads).mock.calls.length;

    act(() => {
      runtimeUpdatedListener?.(
        createRuntimeUpdatedEventFixture({
          revision: "threads-refresh-skip-1",
          scope: ["agents"],
          reason: "agent_task_durability_degraded",
        })
      );
    });

    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 280);
      });
    });

    expect(vi.mocked(listThreads).mock.calls.length).toBe(callsBefore);
  });

  it("keeps the latest plan visible when a new turn starts", async () => {
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    await act(async () => {
      handlers?.onTurnPlanUpdated?.("ws-1", "thread-1", "turn-1", {
        explanation: " Plan note ",
        plan: [{ step: "Do it", status: "in_progress" }],
      });
    });

    expect(result.current.planByThread["thread-1"]).toEqual({
      turnId: "turn-1",
      explanation: "Plan note",
      steps: [{ step: "Do it", status: "inProgress" }],
      distributedGraph: null,
    });

    await act(async () => {
      handlers?.onTurnStarted?.("ws-1", "thread-1", "turn-2");
    });

    expect(result.current.planByThread["thread-1"]).toEqual({
      turnId: "turn-1",
      explanation: "Plan note",
      steps: [{ step: "Do it", status: "inProgress" }],
      distributedGraph: null,
    });
  });

  it("stores turn diff updates from app-server events", async () => {
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    await act(async () => {
      handlers?.onTurnDiffUpdated?.("ws-1", "thread-1", "diff --git a/src/a.ts b/src/a.ts");
    });

    expect(result.current.turnDiffByThread["thread-1"]).toBe("diff --git a/src/a.ts b/src/a.ts");
  });

  it("responds to chatgpt token refresh requests with resolved oauth tokens", async () => {
    vi.mocked(resolveChatgptAuthTokensRefreshResponse).mockResolvedValue({
      accessToken: "chatgpt-access-token-1",
      chatgptAccountId: "chatgpt-account-1",
      chatgptPlanType: "pro",
      sourceAccountId: "codex-account-1",
    });

    renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    act(() => {
      handlers?.onChatgptAuthTokensRefreshRequest?.({
        workspace_id: "ws-1",
        request_id: 91,
        params: {
          reason: "unauthorized",
          previous_account_id: "chatgpt-account-1",
        },
      });
    });

    await waitFor(() => {
      expect(resolveChatgptAuthTokensRefreshResponse).toHaveBeenCalledWith({
        chatgptWorkspaceId: null,
        previousAccountId: "chatgpt-account-1",
      });
    });
    await waitFor(() => {
      expect(respondToServerRequestResult).toHaveBeenCalledWith("ws-1", 91, {
        accessToken: "chatgpt-access-token-1",
        chatgptAccountId: "chatgpt-account-1",
        chatgptPlanType: "pro",
      });
    });
  });

  it("returns an empty refresh payload and logs when oauth tokens are unavailable", async () => {
    const onDebug = vi.fn();
    vi.mocked(resolveChatgptAuthTokensRefreshResponse).mockResolvedValue(null);

    renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
        onDebug,
      })
    );

    act(() => {
      handlers?.onChatgptAuthTokensRefreshRequest?.({
        workspace_id: "ws-1",
        request_id: "refresh-92",
        params: {
          reason: "unauthorized",
          previous_account_id: null,
        },
      });
    });

    await waitFor(() => {
      expect(respondToServerRequestResult).toHaveBeenCalledWith("ws-1", "refresh-92", {});
    });
    await waitFor(() => {
      expect(onDebug).toHaveBeenCalledWith(
        expect.objectContaining({
          label: "account/chatgptAuthTokens/refresh unavailable",
        })
      );
    });
  });

  it("merges remote history when resume response does not overlap local items", async () => {
    vi.mocked(resumeThread).mockResolvedValue({
      result: {
        thread: {
          id: "thread-3",
          preview: "Remote preview",
          updated_at: 9999,
          turns: [
            {
              items: [
                {
                  type: "userMessage",
                  id: "server-user-1",
                  content: [{ type: "text", text: "Remote hello" }],
                },
                {
                  type: "agentMessage",
                  id: "server-assistant-1",
                  text: "Remote response",
                },
              ],
            },
          ],
        },
      },
    });

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    expect(handlers).not.toBeNull();

    act(() => {
      handlers?.onAgentMessageCompleted?.({
        workspaceId: "ws-1",
        threadId: "thread-3",
        itemId: "local-assistant-1",
        text: "Local response",
      });
    });

    act(() => {
      result.current.setActiveThreadId("thread-3");
    });

    await waitFor(() => {
      expect(vi.mocked(resumeThread)).toHaveBeenCalledWith("ws-1", "thread-3", {
        telemetrySource: "thread_actions",
      });
    });

    await waitFor(() => {
      const activeItems = result.current.activeItems;
      const hasLocal = activeItems.some(
        (item) =>
          item.kind === "message" && item.role === "assistant" && item.id === "local-assistant-1"
      );
      const hasRemote = activeItems.some(
        (item) => item.kind === "message" && item.id === "server-user-1"
      );
      expect(hasLocal).toBe(true);
      expect(hasRemote).toBe(true);
    });
  });

  it("keeps local tool items in execution order when resume history overlaps surrounding messages", async () => {
    vi.mocked(resumeThread).mockResolvedValue({
      result: {
        thread: {
          id: "thread-4",
          preview: "Remote preview",
          updated_at: 10001,
          turns: [
            {
              items: [
                {
                  type: "userMessage",
                  id: "server-user-1",
                  content: [{ type: "text", text: "Check ordering" }],
                },
                {
                  type: "agentMessage",
                  id: "assistant-1",
                  text: "Finished",
                },
              ],
            },
          ],
        },
      },
    });

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    expect(handlers).not.toBeNull();

    act(() => {
      handlers?.onItemCompleted?.("ws-1", "thread-4", {
        type: "userMessage",
        id: "server-user-1",
        content: [{ type: "text", text: "Check ordering" }],
      });
      handlers?.onItemCompleted?.("ws-1", "thread-4", {
        type: "commandExecution",
        id: "tool-1",
        command: ["bash", "-lc", "pnpm validate:fast"],
        cwd: "/repo",
        status: "completed",
      });
      handlers?.onAgentMessageCompleted?.({
        workspaceId: "ws-1",
        threadId: "thread-4",
        itemId: "assistant-1",
        text: "Finished",
      });
    });

    act(() => {
      result.current.setActiveThreadId("thread-4");
    });

    await waitFor(() => {
      expect(vi.mocked(resumeThread)).toHaveBeenCalledWith("ws-1", "thread-4", {
        telemetrySource: "thread_actions",
      });
    });

    await waitFor(() => {
      expect(result.current.activeItems.map((item) => item.id)).toEqual([
        "server-user-1",
        "tool-1",
        "assistant-1",
      ]);
    });
  });

  it("clears empty plan updates to null", async () => {
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    await act(async () => {
      handlers?.onTurnPlanUpdated?.("ws-1", "thread-1", "turn-1", {
        explanation: "   ",
        plan: [],
      });
    });

    expect(result.current.planByThread["thread-1"]).toBeNull();
  });

  it("normalizes plan step status values", async () => {
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    await act(async () => {
      handlers?.onTurnPlanUpdated?.("ws-1", "thread-1", "turn-1", {
        explanation: "",
        plan: [
          { step: "Step 1", status: "in_progress" },
          { step: "Step 2", status: "in-progress" },
          { step: "Step 3", status: "in progress" },
          { step: "Step 4", status: "completed" },
          { step: "Step 5", status: "unknown" },
        ],
      });
    });

    expect(result.current.planByThread["thread-1"]).toEqual({
      turnId: "turn-1",
      explanation: null,
      steps: [
        { step: "Step 1", status: "inProgress" },
        { step: "Step 2", status: "inProgress" },
        { step: "Step 3", status: "inProgress" },
        { step: "Step 4", status: "completed" },
        { step: "Step 5", status: "pending" },
      ],
      distributedGraph: null,
    });
  });

  it("replaces the plan when a new turn updates it", async () => {
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    await act(async () => {
      handlers?.onTurnPlanUpdated?.("ws-1", "thread-1", "turn-1", {
        explanation: "First plan",
        plan: [{ step: "Step 1", status: "pending" }],
      });
      handlers?.onTurnPlanUpdated?.("ws-1", "thread-1", "turn-2", {
        explanation: "Next plan",
        plan: [{ step: "Step 2", status: "completed" }],
      });
    });

    expect(result.current.planByThread["thread-1"]).toEqual({
      turnId: "turn-2",
      explanation: "Next plan",
      steps: [{ step: "Step 2", status: "completed" }],
      distributedGraph: null,
    });
  });

  it("keeps plans isolated per thread", async () => {
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    await act(async () => {
      handlers?.onTurnPlanUpdated?.("ws-1", "thread-1", "turn-1", {
        explanation: "Thread 1 plan",
        plan: [{ step: "Step 1", status: "pending" }],
      });
      handlers?.onTurnPlanUpdated?.("ws-1", "thread-2", "turn-2", {
        explanation: "Thread 2 plan",
        plan: [{ step: "Step 2", status: "completed" }],
      });
    });

    expect(result.current.planByThread["thread-1"]).toEqual({
      turnId: "turn-1",
      explanation: "Thread 1 plan",
      steps: [{ step: "Step 1", status: "pending" }],
      distributedGraph: null,
    });
    expect(result.current.planByThread["thread-2"]).toEqual({
      turnId: "turn-2",
      explanation: "Thread 2 plan",
      steps: [{ step: "Step 2", status: "completed" }],
      distributedGraph: null,
    });
  });

  it("clears completed plans when a turn finishes", async () => {
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    await act(async () => {
      handlers?.onTurnPlanUpdated?.("ws-1", "thread-1", "turn-1", {
        explanation: "All done",
        plan: [{ step: "Step 1", status: "completed" }],
      });
    });

    expect(result.current.planByThread["thread-1"]).toEqual({
      turnId: "turn-1",
      explanation: "All done",
      steps: [{ step: "Step 1", status: "completed" }],
      distributedGraph: null,
    });

    await act(async () => {
      handlers?.onTurnCompleted?.("ws-1", "thread-1", "turn-1", {});
    });

    expect(result.current.planByThread["thread-1"]).toBeNull();
  });

  it("keeps plans visible on turn completion when steps remain", async () => {
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    await act(async () => {
      handlers?.onTurnPlanUpdated?.("ws-1", "thread-1", "turn-1", {
        explanation: "Still in progress",
        plan: [{ step: "Step 1", status: "in_progress" }],
      });
    });

    await act(async () => {
      handlers?.onTurnCompleted?.("ws-1", "thread-1", "turn-1", {});
    });

    expect(result.current.planByThread["thread-1"]).toEqual({
      turnId: "turn-1",
      explanation: "Still in progress",
      steps: [{ step: "Step 1", status: "inProgress" }],
      distributedGraph: null,
    });
  });

  it("interrupts immediately even before a turn id is available", async () => {
    const interruptMock = vi.mocked(interruptTurn);
    interruptMock.mockResolvedValue({ result: { interrupted: true } });

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    act(() => {
      result.current.setActiveThreadId("thread-1");
    });

    await act(async () => {
      await result.current.interruptTurn();
    });

    expect(interruptMock).toHaveBeenCalledWith("ws-1", "thread-1", "pending");

    act(() => {
      handlers?.onTurnStarted?.("ws-1", "thread-1", "turn-1");
    });

    await waitFor(() => {
      expect(interruptMock).toHaveBeenCalledWith("ws-1", "thread-1", "turn-1");
    });
    expect(interruptMock).toHaveBeenCalledTimes(2);
  });

  it("restores a queued interrupt after reload before the turn starts", async () => {
    const interruptMock = vi.mocked(interruptTurn);
    interruptMock.mockResolvedValue({ result: { interrupted: true } });

    const firstHook = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    act(() => {
      firstHook.result.current.setActiveThreadId("thread-1");
    });

    await act(async () => {
      await firstHook.result.current.interruptTurn();
    });

    expect(interruptMock).toHaveBeenCalledWith("ws-1", "thread-1", "pending");
    expect(persistedPendingInterruptThreadIds).toEqual(["thread-1"]);

    firstHook.unmount();

    const secondHook = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    act(() => {
      secondHook.result.current.setActiveThreadId("thread-1");
      handlers?.onTurnStarted?.("ws-1", "thread-1", "turn-1");
    });

    await waitFor(() => {
      expect(interruptMock).toHaveBeenCalledWith("ws-1", "thread-1", "turn-1");
    });
    expect(persistedPendingInterruptThreadIds).toEqual([]);
    expect(interruptMock).toHaveBeenCalledTimes(2);
  });

  it("does not auto-interrupt a future turn when pending interrupt request fails", async () => {
    const interruptMock = vi.mocked(interruptTurn);
    interruptMock.mockRejectedValueOnce(new Error("interrupt unavailable"));

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    act(() => {
      result.current.setActiveThreadId("thread-1");
    });

    await act(async () => {
      await result.current.interruptTurn();
    });

    expect(interruptMock).toHaveBeenCalledWith("ws-1", "thread-1", "pending");
    expect(interruptMock).toHaveBeenCalledTimes(1);

    act(() => {
      handlers?.onTurnStarted?.("ws-1", "thread-1", "turn-1");
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(interruptMock).toHaveBeenCalledTimes(1);
    expect(result.current.itemsByThread["thread-1"] ?? []).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "message",
          role: "assistant",
          text: "Session stopped.",
        }),
      ])
    );
    expect(result.current.itemsByThread["thread-1"] ?? []).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "message",
          role: "assistant",
          text: "Failed to stop session: interrupt unavailable",
        }),
      ])
    );
  });

  it("keeps an active turn running when interrupting it fails", async () => {
    const interruptMock = vi.mocked(interruptTurn);
    interruptMock.mockRejectedValueOnce(new Error("interrupt unavailable"));
    vi.mocked(resumeThread).mockResolvedValue({
      result: {
        thread: {
          id: "thread-1",
          updated_at: Date.now(),
          turns: [{ id: "turn-1", status: "running" }],
        },
      },
    } as unknown as Awaited<ReturnType<typeof resumeThread>>);

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    act(() => {
      result.current.setActiveThreadId("thread-1");
      handlers?.onTurnStarted?.("ws-1", "thread-1", "turn-1");
    });

    await waitFor(() => {
      expect(result.current.threadStatusById["thread-1"]?.isProcessing).toBe(true);
      expect(result.current.activeTurnIdByThread["thread-1"]).toBe("turn-1");
    });

    await act(async () => {
      await result.current.interruptTurn();
    });

    expect(interruptMock).toHaveBeenCalledWith("ws-1", "thread-1", "turn-1");
    expect(result.current.threadStatusById["thread-1"]?.isProcessing).toBe(true);
    expect(result.current.activeTurnIdByThread["thread-1"]).toBe("turn-1");
    expect(result.current.itemsByThread["thread-1"] ?? []).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "message",
          role: "assistant",
          text: "Session stopped.",
        }),
      ])
    );
  });

  it("links detached review thread to its parent", async () => {
    vi.mocked(startReview).mockResolvedValue({
      result: { reviewThreadId: "thread-review-1" },
    });

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
        reviewDeliveryMode: "detached",
      })
    );

    act(() => {
      result.current.setActiveThreadId("thread-parent");
    });

    await act(async () => {
      await result.current.startReview("/review check this");
    });

    await waitFor(() => {
      expect(vi.mocked(startReview)).toHaveBeenCalledWith(
        "ws-1",
        "thread-parent",
        expect.any(Object),
        "detached"
      );
    });

    expect(result.current.threadParentById["thread-review-1"]).toBe("thread-parent");
  });

  it("keeps detached collab review threads under the original parent", async () => {
    vi.mocked(startReview).mockResolvedValue({
      result: { reviewThreadId: "thread-review-1" },
    });

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
        reviewDeliveryMode: "detached",
      })
    );

    act(() => {
      result.current.setActiveThreadId("thread-parent");
    });

    await act(async () => {
      await result.current.startReview("/review check this");
    });

    expect(result.current.threadParentById["thread-review-1"]).toBe("thread-parent");

    act(() => {
      handlers?.onItemCompleted?.("ws-1", "thread-parent", {
        type: "collabToolCall",
        id: "item-collab-1",
        senderThreadId: "thread-review-1",
        newThreadId: "thread-review-2",
      });
    });

    expect(result.current.threadParentById["thread-review-2"]).toBe("thread-review-1");

    const { result: threadRowsResult } = renderHook(() =>
      useThreadRows(result.current.threadParentById)
    );
    const rows = threadRowsResult.current.getThreadRows(
      [
        { id: "thread-parent", name: "Parent", updatedAt: 3 },
        { id: "thread-review-2", name: "Review Child", updatedAt: 2 },
      ],
      true,
      "ws-1",
      () => null
    );
    expect(rows.unpinnedRows.map((row) => [row.thread.id, row.depth])).toEqual([
      ["thread-parent", 0],
      ["thread-review-2", 1],
    ]);
  });

  it("keeps parent unlocked and pings parent when detached child exits", async () => {
    vi.mocked(startReview).mockResolvedValue({
      result: { reviewThreadId: "thread-review-1" },
    });

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
        reviewDeliveryMode: "detached",
      })
    );

    act(() => {
      result.current.setActiveThreadId("thread-parent");
    });

    await act(async () => {
      await result.current.startReview("/review check this");
    });

    expect(result.current.threadStatusById["thread-parent"]?.isReviewing).toBe(false);
    expect(result.current.threadStatusById["thread-parent"]?.isProcessing).toBe(false);
    expect(
      result.current.activeItems.some(
        (item) =>
          item.kind === "message" &&
          item.role === "assistant" &&
          item.text.includes("Detached review started.") &&
          item.text.includes("[Open review thread](/thread/thread-review-1)")
      )
    ).toBe(true);

    act(() => {
      handlers?.onItemCompleted?.("ws-1", "thread-review-1", {
        type: "exitedReviewMode",
        id: "review-exit-1",
      });
    });

    expect(result.current.threadStatusById["thread-parent"]?.isReviewing).toBe(false);
    expect(result.current.threadStatusById["thread-parent"]?.isProcessing).toBe(false);
    expect(
      result.current.activeItems.some(
        (item) =>
          item.kind === "message" &&
          item.role === "assistant" &&
          item.text.includes("Detached review completed.") &&
          item.text.includes("[Open review thread](/thread/thread-review-1)")
      )
    ).toBe(true);
  });

  it("preserves parent turn state when detached child exits", async () => {
    vi.mocked(startReview).mockResolvedValue({
      result: { reviewThreadId: "thread-review-1" },
    });

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
        reviewDeliveryMode: "detached",
      })
    );

    act(() => {
      result.current.setActiveThreadId("thread-parent");
    });

    await act(async () => {
      await result.current.startReview("/review check this");
    });

    await waitFor(() => {
      expect(
        result.current.activeItems.some(
          (item) =>
            item.kind === "message" &&
            item.role === "assistant" &&
            item.text.includes("Detached review started.") &&
            item.text.includes("[Open review thread](/thread/thread-review-1)")
        )
      ).toBe(true);
    });

    act(() => {
      handlers?.onTurnStarted?.("ws-1", "thread-parent", "turn-parent-1");
    });

    await waitFor(() => {
      expect(result.current.threadStatusById["thread-parent"]?.isProcessing).toBe(true);
    });
    await waitFor(() => {
      expect(result.current.activeTurnIdByThread["thread-parent"]).toBe("turn-parent-1");
    });

    act(() => {
      handlers?.onItemCompleted?.("ws-1", "thread-review-1", {
        type: "exitedReviewMode",
        id: "review-exit-1",
      });
    });

    await waitFor(() => {
      expect(result.current.threadStatusById["thread-parent"]?.isProcessing).toBe(true);
    });
    await waitFor(() => {
      expect(result.current.activeTurnIdByThread["thread-parent"]).toBe("turn-parent-1");
    });
  });

  it("preserves an in-flight active turn when a forced refresh returns an idle summary without turn details", async () => {
    vi.mocked(sendUserMessageService).mockResolvedValue({
      result: {
        turn: { id: "turn-1" },
      },
    } as unknown as Awaited<ReturnType<typeof sendUserMessageService>>);
    vi.mocked(resumeThread).mockResolvedValue({
      result: {
        thread: {
          id: "thread-1",
          preview: "Lagging runtime summary",
          updated_at: 1000,
          status: "idle",
        },
      },
    } as unknown as Awaited<ReturnType<typeof resumeThread>>);

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    act(() => {
      result.current.setActiveThreadId("thread-1");
    });

    await act(async () => {
      await result.current.sendUserMessage("keep this turn active", []);
    });

    await waitFor(() => {
      expect(result.current.activeTurnIdByThread["thread-1"]).toBe("turn-1");
      expect(result.current.threadStatusById["thread-1"]?.isProcessing).toBe(true);
    });

    await act(async () => {
      await result.current.refreshThread("ws-1", "thread-1");
    });

    expect(result.current.activeTurnIdByThread["thread-1"]).toBe("turn-1");
    expect(result.current.threadStatusById["thread-1"]?.isProcessing).toBe(true);
  });

  it("does not stack detached completion messages when exit is emitted multiple times", async () => {
    vi.mocked(startReview).mockResolvedValue({
      result: { reviewThreadId: "thread-review-1" },
    });

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
        reviewDeliveryMode: "detached",
      })
    );

    act(() => {
      result.current.setActiveThreadId("thread-parent");
    });

    await act(async () => {
      await result.current.startReview("/review check this");
    });

    act(() => {
      handlers?.onItemCompleted?.("ws-1", "thread-review-1", {
        type: "exitedReviewMode",
        id: "review-exit-1",
      });
      handlers?.onItemCompleted?.("ws-1", "thread-review-1", {
        type: "exitedReviewMode",
        id: "review-exit-1",
      });
    });

    const notices = result.current.activeItems.filter(
      (item) =>
        item.kind === "message" &&
        item.role === "assistant" &&
        item.text.includes("Detached review completed.") &&
        item.text.includes("[Open review thread](/thread/thread-review-1)")
    );
    expect(notices).toHaveLength(1);
  });

  it("does not post detached completion notice for generic linked child reviews", async () => {
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
        reviewDeliveryMode: "detached",
      })
    );

    await act(async () => {
      result.current.setActiveThreadId("thread-parent");
    });

    await act(async () => {
      handlers?.onItemCompleted?.("ws-1", "thread-parent", {
        type: "collabToolCall",
        id: "item-collab-link-1",
        senderThreadId: "thread-parent",
        newThreadId: "thread-linked-1",
      });
    });

    await act(async () => {
      handlers?.onItemCompleted?.("ws-1", "thread-linked-1", {
        type: "exitedReviewMode",
        id: "review-exit-linked-1",
      });
    });

    expect(
      result.current.activeItems.some(
        (item) =>
          item.kind === "message" &&
          item.role === "assistant" &&
          item.text.includes("[Open review thread](/thread/thread-linked-1)")
      )
    ).toBe(false);
  });

  it("restores detached review parent links after relaunch", async () => {
    vi.mocked(startReview).mockResolvedValue({
      result: { reviewThreadId: "thread-review-1" },
    });
    vi.mocked(listThreads).mockResolvedValue({
      result: {
        data: [
          {
            id: "thread-parent",
            preview: "Parent",
            updated_at: 10,
            cwd: workspace.path,
          },
          {
            id: "thread-review-1",
            preview: "Detached review",
            updated_at: 9,
            cwd: workspace.path,
          },
        ],
        nextCursor: null,
      },
    });

    const first = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
        reviewDeliveryMode: "detached",
      })
    );

    act(() => {
      first.result.current.setActiveThreadId("thread-parent");
    });

    await act(async () => {
      await first.result.current.startReview("/review check this");
    });

    expect(first.result.current.threadParentById["thread-review-1"]).toBe("thread-parent");
    expect(localStorage.getItem(STORAGE_KEY_DETACHED_REVIEW_LINKS)).toContain("thread-review-1");

    first.unmount();

    const second = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    await act(async () => {
      await second.result.current.listThreadsForWorkspace(workspace);
    });

    await waitFor(() => {
      expect(second.result.current.threadParentById["thread-review-1"]).toBe("thread-parent");
    });
  });

  it("does not create a parent link for inline reviews", async () => {
    vi.mocked(startReview).mockResolvedValue({
      result: { reviewThreadId: "thread-parent" },
    });

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
        reviewDeliveryMode: "inline",
      })
    );

    act(() => {
      result.current.setActiveThreadId("thread-parent");
    });

    await act(async () => {
      await result.current.startReview("/review check this");
    });

    await waitFor(() => {
      expect(vi.mocked(startReview)).toHaveBeenCalledWith(
        "ws-1",
        "thread-parent",
        expect.any(Object),
        "inline"
      );
    });

    expect(result.current.threadParentById["thread-parent"]).toBeUndefined();
    expect(localStorage.getItem(STORAGE_KEY_DETACHED_REVIEW_LINKS)).toBeNull();
  });

  it("orders thread lists, applies custom names, and keeps pin ordering stable", async () => {
    const listThreadsMock = vi.mocked(listThreads);
    listThreadsMock.mockResolvedValue({
      result: {
        data: [
          {
            id: "thread-a",
            preview: "Alpha",
            updated_at: 1000,
            cwd: workspace.path,
          },
          {
            id: "thread-b",
            preview: "Beta",
            updated_at: 3000,
            cwd: workspace.path,
          },
          {
            id: "thread-c",
            preview: "Gamma",
            updated_at: 2000,
            cwd: workspace.path,
          },
        ],
        nextCursor: null,
      },
    });

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    const { result: threadRowsResult } = renderHook(() =>
      useThreadRows(result.current.threadParentById)
    );

    await act(async () => {
      await result.current.listThreadsForWorkspace(workspace);
    });

    await waitFor(() => {
      const initialOrder =
        result.current.threadsByWorkspace["ws-1"]?.map((thread) => thread.id) ?? [];
      expect(initialOrder).toEqual(["thread-b", "thread-c", "thread-a"]);
    });

    act(() => {
      result.current.renameThread("ws-1", "thread-b", "Custom Beta");
    });
    expect(vi.mocked(setThreadName)).toHaveBeenCalledWith("ws-1", "thread-b", "Custom Beta");

    await act(async () => {
      await result.current.listThreadsForWorkspace(workspace);
    });

    await waitFor(() => {
      const renamed = result.current.threadsByWorkspace["ws-1"]?.find(
        (thread) => thread.id === "thread-b"
      );
      expect(renamed?.name).toBe("Custom Beta");
    });

    now = 5000;
    act(() => {
      result.current.pinThread("ws-1", "thread-c");
    });
    now = 6000;
    act(() => {
      result.current.pinThread("ws-1", "thread-a");
    });

    await waitFor(() => {
      const { pinnedRows, unpinnedRows } = threadRowsResult.current.getThreadRows(
        result.current.threadsByWorkspace["ws-1"] ?? [],
        true,
        "ws-1",
        result.current.getPinTimestamp
      );

      expect(pinnedRows.map((row) => row.thread.id)).toEqual(["thread-c", "thread-a"]);
      expect(unpinnedRows.map((row) => row.thread.id)).toEqual(["thread-b"]);
    });
  });

  it("keeps parent rows anchored when refresh only returns subagent children", async () => {
    vi.mocked(listThreads)
      .mockResolvedValueOnce({
        result: {
          data: [
            {
              id: "thread-parent-anchor",
              preview: "Parent",
              updated_at: 2000,
              cwd: workspace.path,
            },
            {
              id: "thread-child-anchor",
              preview: "Child",
              updated_at: 3000,
              cwd: workspace.path,
              source: {
                subAgent: {
                  thread_spawn: {
                    parent_thread_id: "thread-parent-anchor",
                    depth: 1,
                  },
                },
              },
            },
          ],
          nextCursor: null,
        },
      })
      .mockResolvedValueOnce({
        result: {
          data: [
            {
              id: "thread-child-anchor",
              preview: "Child",
              updated_at: 3500,
              cwd: workspace.path,
              source: {
                subAgent: {
                  thread_spawn: {
                    parent_thread_id: "thread-parent-anchor",
                    depth: 1,
                  },
                },
              },
            },
          ],
          nextCursor: null,
        },
      });

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.listThreadsForWorkspace(workspace);
    });

    await waitFor(() => {
      expect(result.current.threadParentById["thread-child-anchor"]).toBe("thread-parent-anchor");
    });

    await act(async () => {
      await result.current.listThreadsForWorkspace(workspace);
    });

    expect(vi.mocked(listThreads)).toHaveBeenCalledTimes(2);
    expect(result.current.threadsByWorkspace["ws-1"]?.map((thread) => thread.id)).toEqual([
      "thread-child-anchor",
      "thread-parent-anchor",
    ]);

    const { result: threadRowsResult } = renderHook(() =>
      useThreadRows(result.current.threadParentById)
    );
    const rows = threadRowsResult.current.getThreadRows(
      result.current.threadsByWorkspace["ws-1"] ?? [],
      true,
      "ws-1",
      () => null
    );
    expect(rows.unpinnedRows.map((row) => [row.thread.id, row.depth])).toEqual([
      ["thread-parent-anchor", 0],
      ["thread-child-anchor", 1],
    ]);
  });
});
