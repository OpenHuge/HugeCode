// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  archiveThread,
  forkThread,
  listThreads,
  resumeThread,
  startThread,
} from "../../../application/runtime/ports/tauriThreads";
import type { ConversationItem, WorkspaceInfo } from "../../../types";
import {
  buildItemsFromThread,
  getThreadCreatedTimestamp,
  getThreadTimestamp,
  isReviewingFromThread,
  mergeThreadItems,
  previewThreadName,
} from "../../../utils/threadItems";
import { saveThreadActivity } from "../utils/threadStorage";
import { useThreadActions } from "./useThreadActions";

vi.mock("../../../application/runtime/ports/tauriThreads", () => ({
  startThread: vi.fn(),
  forkThread: vi.fn(),
  resumeThread: vi.fn(),
  listThreads: vi.fn(),
  archiveThread: vi.fn(),
}));

vi.mock("../../../utils/threadItems", () => ({
  buildItemsFromThread: vi.fn(),
  getThreadCreatedTimestamp: vi.fn(),
  getThreadTimestamp: vi.fn(),
  isReviewingFromThread: vi.fn(),
  mergeThreadItems: vi.fn(),
  previewThreadName: vi.fn(),
}));

vi.mock("../utils/threadStorage", () => ({
  saveThreadActivity: vi.fn(),
}));

type ResumeThreadResult = Awaited<ReturnType<typeof resumeThread>>;

describe("useThreadActions", () => {
  const workspace: WorkspaceInfo = {
    id: "ws-1",
    name: "CodexMonitor",
    path: "/tmp/codex",
    connected: true,
    settings: { sidebarCollapsed: false },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getThreadCreatedTimestamp).mockReturnValue(0);
  });

  function renderActions(overrides?: Partial<Parameters<typeof useThreadActions>[0]>) {
    const dispatch = vi.fn();
    const loadedThreadsRef = { current: {} as Record<string, boolean> };
    const replaceOnResumeRef = { current: {} as Record<string, boolean> };
    const threadActivityRef = {
      current: {} as Record<string, Record<string, number>>,
    };
    const itemsByThreadRef = {
      current: (overrides?.itemsByThread ?? {}) as Record<string, ConversationItem[]>,
    };
    const applyCollabThreadLinksFromThread = vi.fn();
    const updateThreadParent = vi.fn();

    const args: Parameters<typeof useThreadActions>[0] = {
      dispatch,
      itemsByThread: {},
      itemsByThreadRef,
      activeTurnIdByThread: {},
      threadsByWorkspace: {},
      activeThreadIdByWorkspace: {},
      threadListCursorByWorkspace: {},
      threadStatusById: {},
      threadSortKey: "updated_at",
      getCustomName: () => undefined,
      getPersistedThreadName: () => undefined,
      threadActivityRef,
      loadedThreadsRef,
      replaceOnResumeRef,
      applyCollabThreadLinksFromThread,
      updateThreadParent,
      ...overrides,
    };

    const utils = renderHook(() => useThreadActions(args));

    return {
      dispatch,
      loadedThreadsRef: args.loadedThreadsRef,
      replaceOnResumeRef: args.replaceOnResumeRef,
      itemsByThreadRef: args.itemsByThreadRef,
      threadActivityRef: args.threadActivityRef,
      applyCollabThreadLinksFromThread: args.applyCollabThreadLinksFromThread,
      updateThreadParent: args.updateThreadParent,
      ...utils,
    };
  }

  it("starts a thread and activates it by default", async () => {
    vi.mocked(startThread).mockResolvedValue({
      result: { thread: { id: "thread-1" } },
    });

    const { result, dispatch, loadedThreadsRef } = renderActions();

    let threadId: string | null = null;
    await act(async () => {
      threadId = await result.current.startThreadForWorkspace("ws-1");
    });

    expect(threadId).toBe("thread-1");
    expect(startThread).toHaveBeenCalledWith("ws-1", {
      telemetrySource: "thread_actions",
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "ensureThread",
      workspaceId: "ws-1",
      threadId: "thread-1",
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setActiveThreadId",
      workspaceId: "ws-1",
      threadId: "thread-1",
    });
    expect(loadedThreadsRef.current["thread-1"]).toBe(true);
  });

  it("forks a thread and activates the fork", async () => {
    vi.mocked(forkThread).mockResolvedValue({
      result: { thread: { id: "thread-fork-1" } },
    });
    vi.mocked(resumeThread).mockResolvedValue({
      result: { thread: { id: "thread-fork-1", updated_at: 1 } },
    } as unknown as ResumeThreadResult);
    vi.mocked(buildItemsFromThread).mockReturnValue([]);

    const { result, dispatch, loadedThreadsRef } = renderActions();

    let threadId: string | null = null;
    await act(async () => {
      threadId = await result.current.forkThreadForWorkspace("ws-1", "thread-1");
    });

    expect(threadId).toBe("thread-fork-1");
    expect(forkThread).toHaveBeenCalledWith("ws-1", "thread-1");
    expect(dispatch).toHaveBeenCalledWith({
      type: "ensureThread",
      workspaceId: "ws-1",
      threadId: "thread-fork-1",
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setActiveThreadId",
      workspaceId: "ws-1",
      threadId: "thread-fork-1",
    });
    expect(loadedThreadsRef.current["thread-fork-1"]).toBe(true);
  });

  it("starts a thread without activating when requested", async () => {
    vi.mocked(startThread).mockResolvedValue({
      result: { thread: { id: "thread-2" } },
    });

    const { result, dispatch } = renderActions();

    await act(async () => {
      await result.current.startThreadForWorkspace("ws-1", { activate: false });
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "ensureThread",
      workspaceId: "ws-1",
      threadId: "thread-2",
    });
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "setActiveThreadId" })
    );
  });

  it("skips resume when already loaded", async () => {
    const loadedThreadsRef = { current: { "thread-1": true } };
    const { result } = renderActions({ loadedThreadsRef });

    let threadId: string | null = null;
    await act(async () => {
      threadId = await result.current.resumeThreadForWorkspace("ws-1", "thread-1");
    });

    expect(threadId).toBe("thread-1");
    expect(resumeThread).not.toHaveBeenCalled();
  });

  it("skips resume while processing unless forced", async () => {
    const options = {
      loadedThreadsRef: { current: { "thread-1": true } },
      threadStatusById: {
        "thread-1": {
          isProcessing: true,
          hasUnread: false,
          isReviewing: false,
          processingStartedAt: 123,
          lastDurationMs: null,
        },
      },
    };
    const { result: skipResult } = renderActions(options);

    await act(async () => {
      await skipResult.current.resumeThreadForWorkspace("ws-1", "thread-1");
    });

    expect(resumeThread).not.toHaveBeenCalled();

    vi.mocked(resumeThread).mockResolvedValue({
      result: { thread: { id: "thread-1", updated_at: 1 } },
    });

    const { result: forceResult } = renderActions(options);

    await act(async () => {
      await forceResult.current.resumeThreadForWorkspace("ws-1", "thread-1", true);
    });

    expect(resumeThread).toHaveBeenCalledWith("ws-1", "thread-1", {
      telemetrySource: "thread_actions",
    });
  });

  it("returns null and keeps the thread unloadable when resume returns no thread payload", async () => {
    vi.mocked(resumeThread).mockResolvedValue(null as unknown as ResumeThreadResult);

    const { result, loadedThreadsRef, dispatch } = renderActions();

    let threadId: string | null = "sentinel";
    await act(async () => {
      threadId = await result.current.resumeThreadForWorkspace("ws-1", "thread-missing");
    });

    expect(threadId).toBeNull();
    expect(loadedThreadsRef.current["thread-missing"]).toBeUndefined();
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ensureThread",
        workspaceId: "ws-1",
        threadId: "thread-missing",
      })
    );
  });

  it("resumes thread, sets items, status, name, and last message", async () => {
    const assistantItem: ConversationItem = {
      id: "assistant-1",
      kind: "message",
      role: "assistant",
      text: "Hello!",
    };

    vi.mocked(resumeThread).mockResolvedValue({
      result: {
        thread: { id: "thread-2", preview: "preview", updated_at: 555 },
      },
    });
    vi.mocked(buildItemsFromThread).mockReturnValue([assistantItem]);
    vi.mocked(isReviewingFromThread).mockReturnValue(true);
    vi.mocked(previewThreadName).mockReturnValue("Preview Name");
    vi.mocked(getThreadTimestamp).mockReturnValue(999);
    vi.mocked(mergeThreadItems).mockReturnValue([assistantItem]);

    const { result, dispatch, applyCollabThreadLinksFromThread } = renderActions();

    await act(async () => {
      await result.current.resumeThreadForWorkspace("ws-1", "thread-2");
    });

    expect(resumeThread).toHaveBeenCalledWith("ws-1", "thread-2", {
      telemetrySource: "thread_actions",
    });
    expect(applyCollabThreadLinksFromThread).toHaveBeenCalledWith(
      "thread-2",
      expect.objectContaining({ id: "thread-2" })
    );
    expect(dispatch).toHaveBeenCalledWith({
      type: "ensureThread",
      workspaceId: "ws-1",
      threadId: "thread-2",
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadItems",
      threadId: "thread-2",
      items: [assistantItem],
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "markReviewing",
      threadId: "thread-2",
      isReviewing: true,
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadName",
      workspaceId: "ws-1",
      threadId: "thread-2",
      name: "Preview Name",
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setLastAgentMessage",
      threadId: "thread-2",
      text: "Hello!",
      timestamp: 999,
    });
  });

  it("links resumed spawn subagent to its parent from thread source", async () => {
    vi.mocked(resumeThread).mockResolvedValue({
      result: {
        thread: {
          id: "child-thread",
          source: {
            subAgent: {
              thread_spawn: {
                parent_thread_id: "parent-thread",
                depth: 1,
              },
            },
          },
        },
      },
    });
    vi.mocked(buildItemsFromThread).mockReturnValue([]);
    vi.mocked(isReviewingFromThread).mockReturnValue(false);

    const { result, updateThreadParent } = renderActions();

    await act(async () => {
      await result.current.resumeThreadForWorkspace("ws-1", "child-thread", true);
    });

    expect(updateThreadParent).toHaveBeenCalledWith("parent-thread", ["child-thread"]);
  });

  it("does not hydrate status from resume when local items are preserved", async () => {
    const localItem: ConversationItem = {
      id: "local-assistant-1",
      kind: "message",
      role: "assistant",
      text: "Local snapshot",
    };
    vi.mocked(resumeThread).mockResolvedValue({
      result: {
        thread: {
          id: "thread-1",
          preview: "Stale remote preview",
          updated_at: 1000,
          turns: [{ id: "turn-stale", status: "inProgress", items: [] }],
        },
      },
    });
    vi.mocked(buildItemsFromThread).mockReturnValue([]);
    vi.mocked(isReviewingFromThread).mockReturnValue(true);

    const { result, dispatch } = renderActions({
      itemsByThread: { "thread-1": [localItem] },
    });

    await act(async () => {
      await result.current.resumeThreadForWorkspace("ws-1", "thread-1", true);
    });

    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: "markProcessing",
        threadId: "thread-1",
      })
    );
    expect(dispatch).not.toHaveBeenCalledWith({
      type: "setActiveTurnId",
      threadId: "thread-1",
      turnId: "turn-stale",
    });
    expect(dispatch).not.toHaveBeenCalledWith({
      type: "markReviewing",
      threadId: "thread-1",
      isReviewing: true,
    });
  });

  it("clears processing state from resume when latest turns are completed", async () => {
    const localItem: ConversationItem = {
      id: "local-assistant-1",
      kind: "message",
      role: "assistant",
      text: "Local snapshot",
    };
    vi.mocked(resumeThread).mockResolvedValue({
      result: {
        thread: {
          id: "thread-1",
          preview: "Done thread",
          updated_at: 1000,
          turns: [
            { id: "turn-1", status: "completed", items: [] },
            { id: "turn-2", status: "completed", items: [] },
          ],
        },
      },
    });
    vi.mocked(buildItemsFromThread).mockReturnValue([]);
    vi.mocked(isReviewingFromThread).mockReturnValue(false);

    const { result, dispatch } = renderActions({
      itemsByThread: { "thread-1": [localItem] },
      threadStatusById: {
        "thread-1": {
          isProcessing: true,
          hasUnread: false,
          isReviewing: false,
          processingStartedAt: 10,
          lastDurationMs: null,
        },
      },
    });

    await act(async () => {
      await result.current.resumeThreadForWorkspace("ws-1", "thread-1", true, true);
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "markProcessing",
      threadId: "thread-1",
      isProcessing: false,
      executionState: "idle",
      timestamp: expect.any(Number),
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setActiveTurnId",
      threadId: "thread-1",
      turnId: null,
    });
  });

  it("preserves local in-flight turn state when forced refresh returns an idle snapshot without turn details", async () => {
    const localItem: ConversationItem = {
      id: "local-user-1",
      kind: "message",
      role: "user",
      text: "Keep the current turn alive",
    };
    vi.mocked(resumeThread).mockResolvedValue({
      result: {
        thread: {
          id: "thread-1",
          preview: "Lagging runtime summary",
          updated_at: 1000,
          status: "idle",
        },
      },
    });
    vi.mocked(buildItemsFromThread).mockReturnValue([]);
    vi.mocked(isReviewingFromThread).mockReturnValue(false);

    const { result, dispatch } = renderActions({
      itemsByThread: { "thread-1": [localItem] },
      activeTurnIdByThread: { "thread-1": "turn-live-1" },
      threadStatusById: {
        "thread-1": {
          isProcessing: true,
          hasUnread: false,
          isReviewing: false,
          executionState: "running",
          processingStartedAt: 10,
          lastDurationMs: null,
        },
      },
    });

    await act(async () => {
      await result.current.resumeThreadForWorkspace("ws-1", "thread-1", true, true);
    });

    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: "markProcessing",
        threadId: "thread-1",
        isProcessing: false,
      })
    );
    expect(dispatch).not.toHaveBeenCalledWith({
      type: "setActiveTurnId",
      threadId: "thread-1",
      turnId: null,
    });
  });

  it("keeps local optimistic items when refresh is requested without replacing local state", async () => {
    const remoteItems: ConversationItem[] = [
      {
        id: "server-user-1",
        kind: "message",
        role: "user",
        text: "Server canonical message",
      },
    ];
    const localItems: ConversationItem[] = [
      {
        id: "optimistic-user-1",
        kind: "message",
        role: "user",
        text: "Optimistic local message",
      },
    ];
    const mergedItems: ConversationItem[] = [...remoteItems, ...localItems];

    vi.mocked(resumeThread).mockResolvedValue({
      result: {
        thread: {
          id: "thread-1",
          preview: "Merged thread",
          updated_at: 1000,
          turns: [],
        },
      },
    });
    vi.mocked(buildItemsFromThread).mockReturnValue(remoteItems);
    vi.mocked(mergeThreadItems).mockReturnValue(mergedItems);
    vi.mocked(isReviewingFromThread).mockReturnValue(false);

    const { result, dispatch, replaceOnResumeRef, itemsByThreadRef } = renderActions({
      itemsByThread: {},
    });
    itemsByThreadRef.current = { "thread-1": localItems };

    await act(async () => {
      await result.current.refreshThread("ws-1", "thread-1", { replaceLocal: false });
    });

    expect(mergeThreadItems).toHaveBeenCalledWith(remoteItems, localItems);
    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadItems",
      threadId: "thread-1",
      items: mergedItems,
    });
    expect(replaceOnResumeRef.current["thread-1"]).not.toBe(true);
  });

  it("reconciles stale processing to idle on non-replacing refresh when remote items prove completion", async () => {
    const remoteItems: ConversationItem[] = [
      {
        id: "server-assistant-1",
        kind: "message",
        role: "assistant",
        text: "Completed remotely",
      },
    ];
    const localItems: ConversationItem[] = [
      {
        id: "optimistic-user-1",
        kind: "message",
        role: "user",
        text: "Still looks in flight locally",
      },
    ];
    const mergedItems: ConversationItem[] = [...remoteItems, ...localItems];

    vi.mocked(resumeThread).mockResolvedValue({
      result: {
        thread: {
          id: "thread-1",
          preview: "Completed thread",
          updated_at: 1000,
          turns: [],
        },
      },
    });
    vi.mocked(buildItemsFromThread).mockReturnValue(remoteItems);
    vi.mocked(mergeThreadItems).mockReturnValue(mergedItems);
    vi.mocked(isReviewingFromThread).mockReturnValue(false);

    const { result, dispatch, itemsByThreadRef } = renderActions({
      itemsByThread: {},
      threadStatusById: {
        "thread-1": {
          isProcessing: true,
          hasUnread: false,
          isReviewing: false,
          executionState: "running",
          processingStartedAt: 10,
          lastDurationMs: null,
        },
      },
    });
    itemsByThreadRef.current = { "thread-1": localItems };

    await act(async () => {
      await result.current.refreshThread("ws-1", "thread-1", { replaceLocal: false });
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "markProcessing",
      threadId: "thread-1",
      isProcessing: false,
      executionState: "idle",
      timestamp: expect.any(Number),
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setActiveTurnId",
      threadId: "thread-1",
      turnId: null,
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadItems",
      threadId: "thread-1",
      items: mergedItems,
    });
  });

  it("keeps local in-flight state when non-replacing resume only echoes the user message", async () => {
    const remoteItems: ConversationItem[] = [
      {
        id: "server-user-1",
        kind: "message",
        role: "user",
        text: "Still pending remotely",
      },
    ];
    const localItems: ConversationItem[] = [
      {
        id: "optimistic-user-1",
        kind: "message",
        role: "user",
        text: "Still pending remotely",
      },
    ];

    vi.mocked(resumeThread).mockResolvedValue({
      result: {
        thread: {
          id: "thread-1",
          preview: "Still pending",
          updated_at: 1000,
          turns: [],
        },
      },
    });
    vi.mocked(buildItemsFromThread).mockReturnValue(remoteItems);
    vi.mocked(mergeThreadItems).mockReturnValue(localItems);
    vi.mocked(isReviewingFromThread).mockReturnValue(false);

    const { result, dispatch, itemsByThreadRef } = renderActions({
      activeTurnIdByThread: { "thread-1": "turn-live-1" },
      threadStatusById: {
        "thread-1": {
          isProcessing: true,
          hasUnread: false,
          isReviewing: false,
          executionState: "running",
          processingStartedAt: 10,
          lastDurationMs: null,
        },
      },
    });
    itemsByThreadRef.current = { "thread-1": localItems };

    await act(async () => {
      await result.current.refreshThread("ws-1", "thread-1", { replaceLocal: false });
    });

    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: "markProcessing",
        threadId: "thread-1",
        isProcessing: false,
      })
    );
    expect(dispatch).not.toHaveBeenCalledWith({
      type: "setActiveTurnId",
      threadId: "thread-1",
      turnId: null,
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadItems",
      threadId: "thread-1",
      items: localItems,
    });
  });

  it("hydrates processing state from in-progress turns on resume", async () => {
    vi.mocked(resumeThread).mockResolvedValue({
      result: {
        thread: {
          id: "thread-3",
          preview: "Working thread",
          updated_at: 1000,
          turns: [
            { id: "turn-1", status: "completed", items: [] },
            { id: "turn-2", status: "inProgress", items: [] },
          ],
        },
      },
    });
    vi.mocked(buildItemsFromThread).mockReturnValue([]);
    vi.mocked(isReviewingFromThread).mockReturnValue(false);

    const { result, dispatch } = renderActions();

    await act(async () => {
      await result.current.resumeThreadForWorkspace("ws-1", "thread-3", true);
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "markProcessing",
      threadId: "thread-3",
      isProcessing: true,
      executionState: "running",
      timestamp: expect.any(Number),
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setActiveTurnId",
      threadId: "thread-3",
      turnId: "turn-2",
    });
  });

  it("hydrates awaiting approval execution state from resumed turns", async () => {
    vi.mocked(resumeThread).mockResolvedValue({
      result: {
        thread: {
          id: "thread-4",
          preview: "Needs approval",
          updated_at: 1000,
          turns: [
            { id: "turn-old", status: "completed", items: [] },
            { id: "turn-awaiting", status: "awaiting_approval", items: [] },
          ],
        },
      },
    });
    vi.mocked(buildItemsFromThread).mockReturnValue([]);
    vi.mocked(isReviewingFromThread).mockReturnValue(false);

    const { result, dispatch } = renderActions();

    await act(async () => {
      await result.current.resumeThreadForWorkspace("ws-1", "thread-4", true);
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "markProcessing",
      threadId: "thread-4",
      isProcessing: true,
      executionState: "awaitingApproval",
      timestamp: expect.any(Number),
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setActiveTurnId",
      threadId: "thread-4",
      turnId: "turn-awaiting",
    });
  });

  it("keeps resume loading true until overlapping resumes finish", async () => {
    let resolveFirst: ((value: unknown) => void) | null = null;
    let resolveSecond: ((value: unknown) => void) | null = null;
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    const secondPromise = new Promise((resolve) => {
      resolveSecond = resolve;
    });
    vi.mocked(resumeThread)
      .mockReturnValueOnce(firstPromise as Promise<ResumeThreadResult>)
      .mockReturnValueOnce(secondPromise as Promise<ResumeThreadResult>);
    vi.mocked(buildItemsFromThread).mockReturnValue([]);
    vi.mocked(isReviewingFromThread).mockReturnValue(false);
    vi.mocked(getThreadTimestamp).mockReturnValue(0);

    const { result, dispatch } = renderActions();

    let callOne: Promise<string | null> | null = null;
    let callTwo: Promise<string | null> | null = null;
    await act(async () => {
      callOne = result.current.resumeThreadForWorkspace("ws-1", "thread-3", true);
      callTwo = result.current.resumeThreadForWorkspace("ws-1", "thread-3", true);
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadResumeLoading",
      threadId: "thread-3",
      isLoading: true,
    });

    await act(async () => {
      resolveFirst?.({ result: { thread: { id: "thread-3" } } });
      await firstPromise;
    });

    expect(dispatch).not.toHaveBeenCalledWith({
      type: "setThreadResumeLoading",
      threadId: "thread-3",
      isLoading: false,
    });

    await act(async () => {
      resolveSecond?.({ result: { thread: { id: "thread-3" } } });
      await Promise.all([callOne, callTwo]);
    });

    const loadingFalseCalls = dispatch.mock.calls.filter(
      ([action]) =>
        action?.type === "setThreadResumeLoading" &&
        action?.threadId === "thread-3" &&
        action?.isLoading === false
    );
    expect(loadingFalseCalls).toHaveLength(1);
  });

  it("hydrates stale processing to idle from thread list summaries when no active turn remains", async () => {
    vi.mocked(listThreads).mockResolvedValue({
      result: {
        data: [
          {
            id: "thread-1",
            cwd: "/tmp/codex",
            preview: "Remote preview",
            updated_at: 5000,
            running: false,
            status: "idle",
          },
        ],
        nextCursor: null,
      },
    });
    vi.mocked(getThreadTimestamp).mockImplementation((thread) => {
      const value = (thread as Record<string, unknown>).updated_at as number;
      return value ?? 0;
    });

    const { result, dispatch } = renderActions({
      threadStatusById: {
        "thread-1": {
          isProcessing: true,
          hasUnread: false,
          isReviewing: false,
          executionState: "running",
          processingStartedAt: 10,
          lastDurationMs: null,
        },
      },
    });

    await act(async () => {
      await result.current.listThreadsForWorkspace(workspace, { preserveState: true });
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "markProcessing",
      threadId: "thread-1",
      isProcessing: false,
      executionState: "idle",
      timestamp: expect.any(Number),
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setActiveTurnId",
      threadId: "thread-1",
      turnId: null,
    });
  });

  it("keeps local active turn state when thread list summaries lag behind", async () => {
    vi.mocked(listThreads).mockResolvedValue({
      result: {
        data: [
          {
            id: "thread-1",
            cwd: "/tmp/codex",
            preview: "Lagging preview",
            updated_at: 5000,
            running: false,
            status: "idle",
          },
        ],
        nextCursor: null,
      },
    });
    vi.mocked(getThreadTimestamp).mockImplementation((thread) => {
      const value = (thread as Record<string, unknown>).updated_at as number;
      return value ?? 0;
    });

    const { result, dispatch } = renderActions({
      activeTurnIdByThread: { "thread-1": "turn-live-1" },
      threadStatusById: {
        "thread-1": {
          isProcessing: true,
          hasUnread: false,
          isReviewing: false,
          executionState: "running",
          processingStartedAt: 10,
          lastDurationMs: null,
        },
      },
    });

    await act(async () => {
      await result.current.listThreadsForWorkspace(workspace, { preserveState: true });
    });

    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: "markProcessing",
        threadId: "thread-1",
        isProcessing: false,
      })
    );
    expect(dispatch).not.toHaveBeenCalledWith({
      type: "setActiveTurnId",
      threadId: "thread-1",
      turnId: null,
    });
  });

  it("lists threads for a workspace and persists activity", async () => {
    vi.mocked(listThreads).mockResolvedValue({
      result: {
        data: [
          {
            id: "thread-1",
            cwd: "/tmp/codex",
            preview: "Remote preview",
            updated_at: 5000,
          },
          {
            id: "thread-2",
            cwd: "/other",
            preview: "Ignore",
            updated_at: 7000,
          },
        ],
        nextCursor: "cursor-1",
      },
    });
    vi.mocked(getThreadTimestamp).mockImplementation((thread) => {
      const value = (thread as Record<string, unknown>).updated_at as number;
      return value ?? 0;
    });

    const { result, dispatch, threadActivityRef } = renderActions({
      getCustomName: (workspaceId, threadId) =>
        workspaceId === "ws-1" && threadId === "thread-1" ? "Custom" : undefined,
      threadActivityRef: { current: {} },
    });

    await act(async () => {
      await result.current.listThreadsForWorkspace(workspace);
    });

    expect(listThreads).toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadListLoading",
      workspaceId: "ws-1",
      isLoading: true,
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreads",
      workspaceId: "ws-1",
      sortKey: "updated_at",
      threads: [
        {
          id: "thread-1",
          name: "Custom",
          updatedAt: 5000,
        },
      ],
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadListCursor",
      workspaceId: "ws-1",
      cursor: "cursor-1",
    });
    expect(saveThreadActivity).toHaveBeenCalledWith({
      "ws-1": { "thread-1": 5000 },
    });
    expect(threadActivityRef.current).toEqual({
      "ws-1": { "thread-1": 5000 },
    });
  });

  it("ignores placeholder previews when listing threads", async () => {
    vi.mocked(listThreads).mockResolvedValue({
      result: {
        data: [
          {
            id: "thread-1",
            cwd: "/tmp/codex",
            preview: "New thread",
            updated_at: 5000,
          },
        ],
        nextCursor: null,
      },
    });
    vi.mocked(getThreadTimestamp).mockImplementation((thread) => {
      const value = (thread as Record<string, unknown>).updated_at as number;
      return value ?? 0;
    });

    const { result, dispatch } = renderActions({
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-1", name: "Meaningful local title", updatedAt: 4000 }],
      },
    });

    await act(async () => {
      await result.current.listThreadsForWorkspace(workspace);
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreads",
      workspaceId: "ws-1",
      sortKey: "updated_at",
      threads: [{ id: "thread-1", name: "Meaningful local title", updatedAt: 5000 }],
    });
    expect(dispatch).not.toHaveBeenCalledWith({
      type: "setLastAgentMessage",
      threadId: "thread-1",
      text: "New thread",
      timestamp: 5000,
    });
  });

  it("restores parent-child links from thread/list source metadata", async () => {
    vi.mocked(listThreads).mockResolvedValue({
      result: {
        data: [
          {
            id: "parent-thread",
            cwd: "/tmp/codex",
            preview: "Parent",
            updated_at: 5000,
            source: "vscode",
          },
          {
            id: "child-thread",
            cwd: "/tmp/codex",
            preview: "Child",
            updated_at: 4500,
            source: {
              subAgent: {
                thread_spawn: {
                  parent_thread_id: "parent-thread",
                  depth: 1,
                },
              },
            },
          },
        ],
        nextCursor: null,
      },
    });
    vi.mocked(getThreadTimestamp).mockImplementation((thread) => {
      const value = (thread as Record<string, unknown>).updated_at as number;
      return value ?? 0;
    });

    const { result, updateThreadParent } = renderActions();

    await act(async () => {
      await result.current.listThreadsForWorkspace(workspace);
    });

    expect(updateThreadParent).toHaveBeenCalledWith("parent-thread", ["child-thread"]);
  });

  it("preserves list state when requested", async () => {
    vi.mocked(listThreads).mockResolvedValue({
      result: {
        data: [],
        nextCursor: null,
      },
    });

    const { result, dispatch } = renderActions();

    await act(async () => {
      await result.current.listThreadsForWorkspace(workspace, {
        preserveState: true,
      });
    });

    expect(dispatch).not.toHaveBeenCalledWith({
      type: "setThreadListLoading",
      workspaceId: "ws-1",
      isLoading: true,
    });
  });

  it("requests created_at sorting when provided", async () => {
    vi.mocked(listThreads).mockResolvedValue({
      result: {
        data: [],
        nextCursor: null,
      },
    });

    const { result } = renderActions({ threadSortKey: "created_at" });

    await act(async () => {
      await result.current.listThreadsForWorkspace(workspace);
    });

    expect(listThreads).toHaveBeenCalledWith("ws-1", null, 100, "created_at");
  });

  it("loads older threads when a cursor is available", async () => {
    vi.mocked(listThreads).mockResolvedValue({
      result: {
        data: [
          {
            id: "thread-2",
            cwd: "/tmp/codex",
            preview: "Older preview",
            updated_at: 4000,
          },
        ],
        nextCursor: null,
      },
    });
    vi.mocked(getThreadTimestamp).mockImplementation((thread) => {
      const value = (thread as Record<string, unknown>).updated_at as number;
      return value ?? 0;
    });

    const { result, dispatch } = renderActions({
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-1", name: "Agent 1", updatedAt: 6000 }],
      },
      threadListCursorByWorkspace: { "ws-1": "cursor-1" },
    });

    await act(async () => {
      await result.current.loadOlderThreadsForWorkspace(workspace);
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadListPaging",
      workspaceId: "ws-1",
      isLoading: true,
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreads",
      workspaceId: "ws-1",
      sortKey: "updated_at",
      threads: [
        { id: "thread-1", name: "Agent 1", updatedAt: 6000 },
        { id: "thread-2", name: "Older preview", updatedAt: 4000 },
      ],
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadListCursor",
      workspaceId: "ws-1",
      cursor: null,
    });
  });

  it("does not overwrite thread metadata from placeholder resume previews", async () => {
    vi.mocked(resumeThread).mockResolvedValue({
      result: {
        thread: { id: "thread-2", preview: "New thread", updated_at: 555 },
      },
    });
    vi.mocked(buildItemsFromThread).mockReturnValue([]);
    vi.mocked(isReviewingFromThread).mockReturnValue(false);
    vi.mocked(getThreadTimestamp).mockReturnValue(555);

    const { result, dispatch } = renderActions();

    await act(async () => {
      await result.current.resumeThreadForWorkspace("ws-1", "thread-2");
    });

    expect(dispatch).not.toHaveBeenCalledWith({
      type: "setThreadName",
      workspaceId: "ws-1",
      threadId: "thread-2",
      name: "New thread",
    });
    expect(dispatch).not.toHaveBeenCalledWith({
      type: "setLastAgentMessage",
      threadId: "thread-2",
      text: "New thread",
      timestamp: 555,
    });
  });

  it("archives threads and reports errors", async () => {
    vi.mocked(archiveThread).mockRejectedValue(new Error("nope"));
    const onDebug = vi.fn();
    const { result } = renderActions({ onDebug });

    await act(async () => {
      await result.current.archiveThread("ws-1", "thread-9");
    });

    expect(archiveThread).toHaveBeenCalledWith("ws-1", "thread-9", {
      telemetrySource: "thread_actions",
    });
    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "error",
        label: "thread/archive error",
        payload: "nope",
      })
    );
  });
});
