// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationItem, RateLimitSnapshot, TurnPlan } from "../../../types";
import { normalizePlanUpdate } from "../../../application/runtime/facades/runtimeTurnPlanProjection";
import { normalizeRateLimits, normalizeTokenUsage } from "../utils/threadNormalize";
import { useThreadTurnEvents } from "./useThreadTurnEvents";

const interruptTurn = vi.hoisted(() => vi.fn());

vi.mock("../../../application/runtime/facades/runtimeTurnPlanProjection", () => ({
  normalizePlanUpdate: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/runtimeSessionCommands", () => ({
  useRuntimeSessionCommandsResolver: () => (workspaceId: string) => ({
    interruptTurn: ({ threadId, turnId }: Record<string, unknown>) =>
      interruptTurn(workspaceId, threadId, turnId),
  }),
}));

vi.mock("../utils/threadNormalize", () => ({
  asString: (value: unknown) => (typeof value === "string" ? value : value ? String(value) : ""),
  normalizeRateLimits: vi.fn(),
  normalizeTokenUsage: vi.fn(),
}));

type SetupOverrides = {
  pendingInterrupts?: string[];
  planByThread?: Record<string, TurnPlan | null>;
  itemsByThread?: Record<string, ConversationItem[]>;
  getCurrentRateLimits?: (workspaceId: string) => RateLimitSnapshot | null;
  refreshThreadSnapshot?: (workspaceId: string, threadId: string) => Promise<unknown> | unknown;
};

const makeOptions = (overrides: SetupOverrides = {}) => {
  const dispatch = vi.fn();
  const getCustomName = vi.fn();
  const isThreadHidden = vi.fn(() => false);
  const markProcessing = vi.fn();
  const markReviewing = vi.fn();
  const setActiveTurnId = vi.fn();
  const getCurrentRateLimits = vi.fn(overrides.getCurrentRateLimits ?? (() => null));
  const refreshThreadSnapshot = overrides.refreshThreadSnapshot
    ? vi.fn(overrides.refreshThreadSnapshot)
    : undefined;
  const pushThreadErrorMessage = vi.fn();
  const safeMessageActivity = vi.fn();
  const recordThreadActivity = vi.fn();
  const pendingInterruptsRef = {
    current: new Set(overrides.pendingInterrupts ?? []),
  };
  const itemsByThreadRef = {
    current: overrides.itemsByThread ?? {},
  };
  const planByThreadRef = {
    current: overrides.planByThread ?? {},
  };

  const { result } = renderHook(() =>
    useThreadTurnEvents({
      dispatch,
      planByThreadRef,
      itemsByThreadRef,
      ...(refreshThreadSnapshot ? { refreshThreadSnapshot } : {}),
      getCurrentRateLimits,
      getCustomName,
      isThreadHidden,
      markProcessing,
      markReviewing,
      setActiveTurnId,
      pendingInterruptsRef,
      pushThreadErrorMessage,
      safeMessageActivity,
      recordThreadActivity,
    })
  );

  return {
    result,
    dispatch,
    getCustomName,
    isThreadHidden,
    markProcessing,
    markReviewing,
    setActiveTurnId,
    getCurrentRateLimits,
    refreshThreadSnapshot,
    pushThreadErrorMessage,
    safeMessageActivity,
    recordThreadActivity,
    pendingInterruptsRef,
    itemsByThreadRef,
    planByThreadRef,
  };
};

describe("useThreadTurnEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("upserts thread summaries when a thread starts", () => {
    const { result, dispatch, recordThreadActivity, safeMessageActivity } = makeOptions();

    act(() => {
      result.current.onThreadStarted("ws-1", {
        id: "thread-1",
        preview: "A brand new thread",
        updatedAt: 1_700_000_000_000,
      });
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "ensureThread",
      workspaceId: "ws-1",
      threadId: "thread-1",
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadTimestamp",
      workspaceId: "ws-1",
      threadId: "thread-1",
      timestamp: 1_700_000_000_000,
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadName",
      workspaceId: "ws-1",
      threadId: "thread-1",
      name: "A brand new thread",
    });
    expect(recordThreadActivity).toHaveBeenCalledWith("ws-1", "thread-1", 1_700_000_000_000);
    expect(safeMessageActivity).toHaveBeenCalled();
  });

  it("does not override custom thread names on thread started", () => {
    const { result, dispatch, getCustomName } = makeOptions();
    getCustomName.mockReturnValue("Custom name");

    act(() => {
      result.current.onThreadStarted("ws-1", {
        id: "thread-2",
        preview: "Preview text",
        updatedAt: 1_700_000_000_100,
      });
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "ensureThread",
      workspaceId: "ws-1",
      threadId: "thread-2",
    });
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: "setThreadName",
        workspaceId: "ws-1",
        threadId: "thread-2",
      })
    );
  });

  it("ignores placeholder preview names on thread started", () => {
    const { result, dispatch } = makeOptions();

    act(() => {
      result.current.onThreadStarted("ws-1", {
        id: "thread-placeholder",
        preview: "New thread",
        updatedAt: 1_700_000_000_150,
      });
    });

    expect(dispatch).not.toHaveBeenCalledWith({
      type: "setThreadName",
      workspaceId: "ws-1",
      threadId: "thread-placeholder",
      name: "New thread",
    });
  });

  it("ignores thread started events for hidden threads", () => {
    const { result, dispatch, isThreadHidden, recordThreadActivity, safeMessageActivity } =
      makeOptions();
    isThreadHidden.mockReturnValue(true);

    act(() => {
      result.current.onThreadStarted("ws-1", {
        id: "thread-hidden",
        preview: "Hidden thread",
        updatedAt: 1_700_000_000_200,
      });
    });

    expect(dispatch).not.toHaveBeenCalled();
    expect(recordThreadActivity).not.toHaveBeenCalled();
    expect(safeMessageActivity).not.toHaveBeenCalled();
  });

  it("applies thread name updates when no custom name exists", () => {
    const { result, dispatch, getCustomName } = makeOptions();
    getCustomName.mockReturnValue(undefined);

    act(() => {
      result.current.onThreadNameUpdated("ws-1", {
        threadId: "thread-3",
        threadName: "Server Rename",
      });
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadName",
      workspaceId: "ws-1",
      threadId: "thread-3",
      name: "Server Rename",
    });
  });

  it("does not override custom thread names on thread name updated", () => {
    const { result, dispatch, getCustomName } = makeOptions();
    getCustomName.mockReturnValue("Custom Name");

    act(() => {
      result.current.onThreadNameUpdated("ws-1", {
        threadId: "thread-3",
        threadName: "Server Rename",
      });
    });

    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: "setThreadName",
        workspaceId: "ws-1",
        threadId: "thread-3",
      })
    );
  });

  it("marks processing and active turn on turn started", () => {
    const { result, dispatch, markProcessing, setActiveTurnId } = makeOptions();

    act(() => {
      result.current.onTurnStarted("ws-1", "thread-1", "turn-1");
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "ensureThread",
      workspaceId: "ws-1",
      threadId: "thread-1",
    });
    expect(markProcessing).toHaveBeenCalledWith("thread-1", true, "running");
    expect(setActiveTurnId).toHaveBeenCalledWith("thread-1", "turn-1");
    expect(interruptTurn).not.toHaveBeenCalled();
  });

  it("interrupts immediately when a pending interrupt is queued", () => {
    const { result, markProcessing, setActiveTurnId, pendingInterruptsRef } = makeOptions({
      pendingInterrupts: ["thread-1"],
    });
    vi.mocked(interruptTurn).mockResolvedValue({
      result: {
        interrupted: true,
      },
    });

    act(() => {
      result.current.onTurnStarted("ws-1", "thread-1", "turn-2");
    });

    expect(pendingInterruptsRef.current.has("thread-1")).toBe(false);
    expect(interruptTurn).toHaveBeenCalledWith("ws-1", "thread-1", "turn-2");
    expect(markProcessing).not.toHaveBeenCalled();
    expect(setActiveTurnId).not.toHaveBeenCalled();
  });

  it("clears pending interrupt and active turn on turn completed", () => {
    const { result, dispatch, markProcessing, setActiveTurnId, pendingInterruptsRef } = makeOptions(
      {
        pendingInterrupts: ["thread-1"],
      }
    );

    act(() => {
      result.current.onTurnCompleted("ws-1", "thread-1", "turn-1");
    });

    expect(markProcessing).toHaveBeenCalledWith("thread-1", false, "idle");
    expect(setActiveTurnId).toHaveBeenCalledWith("thread-1", null);
    expect(pendingInterruptsRef.current.has("thread-1")).toBe(false);
    expect(dispatch).toHaveBeenCalledWith({
      type: "completePendingTurnItems",
      threadId: "thread-1",
    });
  });

  it("pushes a fallback assistant message when a turn completes without visible output", () => {
    vi.useFakeTimers();
    const { result, pushThreadErrorMessage, safeMessageActivity } = makeOptions({
      itemsByThread: {
        "thread-1": [
          {
            id: "user-1",
            kind: "message",
            role: "user",
            text: "检查当前 agent 是否可以正常工作",
          },
        ],
      },
    });

    act(() => {
      result.current.onTurnCompleted("ws-1", "thread-1", "turn-1");
    });
    act(() => {
      vi.runAllTimers();
    });

    expect(pushThreadErrorMessage).toHaveBeenCalledWith(
      "thread-1",
      "Turn completed without any visible response or tool output. The agent may not have produced output. Check runtime logs and retry."
    );
    expect(safeMessageActivity).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("does not push a fallback assistant message when assistant output exists", () => {
    vi.useFakeTimers();
    const { result, pushThreadErrorMessage } = makeOptions({
      itemsByThread: {
        "thread-1": [
          {
            id: "user-1",
            kind: "message",
            role: "user",
            text: "检查当前 agent 是否可以正常工作",
          },
          {
            id: "assistant-1",
            kind: "message",
            role: "assistant",
            text: "当前 agent 工作正常。",
          },
        ],
      },
    });

    act(() => {
      result.current.onTurnCompleted("ws-1", "thread-1", "turn-1");
    });
    act(() => {
      vi.runAllTimers();
    });

    expect(pushThreadErrorMessage).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("does not push a fallback assistant message when tool output exists", () => {
    vi.useFakeTimers();
    const { result, pushThreadErrorMessage } = makeOptions({
      itemsByThread: {
        "thread-1": [
          {
            id: "user-1",
            kind: "message",
            role: "user",
            text: "检查当前 agent 是否可以正常工作",
          },
          {
            id: "tool-1",
            kind: "tool",
            toolType: "commandExecution",
            title: "check status",
            detail: "pwd",
            output: "/workspace",
          },
        ],
      },
    });

    act(() => {
      result.current.onTurnCompleted("ws-1", "thread-1", "turn-1");
    });
    act(() => {
      vi.runAllTimers();
    });

    expect(pushThreadErrorMessage).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("pushes a fallback assistant message when only placeholder tool chrome exists", () => {
    vi.useFakeTimers();
    const { result, pushThreadErrorMessage } = makeOptions({
      itemsByThread: {
        "thread-1": [
          {
            id: "user-1",
            kind: "message",
            role: "user",
            text: "Inspect example.com",
          },
          {
            id: "tool-1",
            kind: "tool",
            toolType: "webSearch",
            title: "Web search",
            detail: "example.com",
            output: "",
            status: "completed",
          },
        ],
      },
    });

    act(() => {
      result.current.onTurnCompleted("ws-1", "thread-1", "turn-1");
    });
    act(() => {
      vi.runAllTimers();
    });

    expect(pushThreadErrorMessage).toHaveBeenCalledWith(
      "thread-1",
      "Turn completed without any visible response or tool output. The agent may not have produced output. Check runtime logs and retry."
    );
    vi.useRealTimers();
  });

  it("pushes a fallback assistant message when the latest assistant message is empty", () => {
    vi.useFakeTimers();
    const { result, pushThreadErrorMessage } = makeOptions({
      itemsByThread: {
        "thread-1": [
          {
            id: "user-1",
            kind: "message",
            role: "user",
            text: "Reply with OK",
          },
          {
            id: "assistant-1",
            kind: "message",
            role: "assistant",
            text: "   ",
          },
        ],
      },
    });

    act(() => {
      result.current.onTurnCompleted("ws-1", "thread-1", "turn-1");
    });
    act(() => {
      vi.runAllTimers();
    });

    expect(pushThreadErrorMessage).toHaveBeenCalledWith(
      "thread-1",
      "Turn completed without any visible response or tool output. The agent may not have produced output. Check runtime logs and retry."
    );
    vi.useRealTimers();
  });

  it("does not push a fallback message when visible output arrives shortly after turn completion", () => {
    vi.useFakeTimers();
    const { result, itemsByThreadRef, pushThreadErrorMessage } = makeOptions({
      itemsByThread: {
        "thread-1": [
          {
            id: "user-1",
            kind: "message",
            role: "user",
            text: "Use browser tools to inspect example.com",
          },
        ],
      },
    });

    act(() => {
      result.current.onTurnCompleted("ws-1", "thread-1", "turn-1");
    });

    itemsByThreadRef.current["thread-1"] = [
      {
        id: "user-1",
        kind: "message",
        role: "user",
        text: "Use browser tools to inspect example.com",
      },
      {
        id: "tool-1",
        kind: "tool",
        toolType: "mcpToolCall",
        title: "Tool: runtime / browser",
        detail: '{\n  "url": "https://example.com"\n}',
        output: "Example Domain",
        status: "completed",
      },
    ];

    act(() => {
      vi.runAllTimers();
    });

    expect(pushThreadErrorMessage).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("refreshes the settled thread snapshot before pushing a fallback assistant message", async () => {
    vi.useFakeTimers();
    const { result, itemsByThreadRef, pushThreadErrorMessage, refreshThreadSnapshot } = makeOptions(
      {
        itemsByThread: {
          "thread-1": [
            {
              id: "user-1",
              kind: "message",
              role: "user",
              text: "Read chain-check.txt and reply with its exact marker.",
            },
          ],
        },
        refreshThreadSnapshot: async (_workspaceId, threadId) => {
          itemsByThreadRef.current[threadId] = [
            {
              id: "user-1",
              kind: "message",
              role: "user",
              text: "Read chain-check.txt and reply with its exact marker.",
            },
            {
              id: "assistant-1",
              kind: "message",
              role: "assistant",
              text: "AGENT_BROWSER_CHAIN_OK",
            },
          ];
        },
      }
    );

    act(() => {
      result.current.onTurnCompleted("ws-1", "thread-1", "turn-1");
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(refreshThreadSnapshot).toHaveBeenCalledWith("ws-1", "thread-1");
    expect(pushThreadErrorMessage).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("clears the active plan when all plan steps are completed", () => {
    const { result, dispatch } = makeOptions({
      planByThread: {
        "thread-1": {
          turnId: "turn-1",
          explanation: "Done",
          steps: [{ step: "Finish task", status: "completed" }],
        },
      },
    });

    act(() => {
      result.current.onTurnCompleted("ws-1", "thread-1", "turn-1");
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "clearThreadPlan",
      threadId: "thread-1",
    });
  });

  it("does not clear a completed plan for a different turn", () => {
    const { result, dispatch } = makeOptions({
      planByThread: {
        "thread-1": {
          turnId: "turn-2",
          explanation: "Done",
          steps: [{ step: "Finish task", status: "completed" }],
        },
      },
    });

    act(() => {
      result.current.onTurnCompleted("ws-1", "thread-1", "turn-1");
    });

    expect(dispatch).not.toHaveBeenCalledWith({
      type: "clearThreadPlan",
      threadId: "thread-1",
    });
  });

  it("keeps the active plan when at least one step is not completed", () => {
    const { result, dispatch } = makeOptions({
      planByThread: {
        "thread-1": {
          turnId: "turn-1",
          explanation: "Still working",
          steps: [
            { step: "Finish task", status: "completed" },
            { step: "Verify output", status: "inProgress" },
          ],
        },
      },
    });

    act(() => {
      result.current.onTurnCompleted("ws-1", "thread-1", "turn-1");
    });

    expect(dispatch).not.toHaveBeenCalledWith({
      type: "clearThreadPlan",
      threadId: "thread-1",
    });
  });

  it("keeps onTurnCompleted stable while plan content changes", () => {
    const dispatch = vi.fn();
    const getCustomName = vi.fn();
    const isThreadHidden = vi.fn(() => false);
    const markProcessing = vi.fn();
    const markReviewing = vi.fn();
    const setActiveTurnId = vi.fn();
    const pushThreadErrorMessage = vi.fn();
    const safeMessageActivity = vi.fn();
    const recordThreadActivity = vi.fn();
    const pendingInterruptsRef = { current: new Set<string>() };
    const itemsByThreadRef = { current: {} as Record<string, ConversationItem[]> };
    const planByThreadRef = {
      current: {} as Record<string, TurnPlan | null>,
    };

    const { result, rerender } = renderHook(() =>
      useThreadTurnEvents({
        dispatch,
        planByThreadRef,
        itemsByThreadRef,
        getCustomName,
        isThreadHidden,
        markProcessing,
        markReviewing,
        setActiveTurnId,
        pendingInterruptsRef,
        pushThreadErrorMessage,
        safeMessageActivity,
        recordThreadActivity,
      })
    );

    const originalHandler = result.current.onTurnCompleted;
    planByThreadRef.current = {
      "thread-1": {
        turnId: "turn-1",
        explanation: "Updated",
        steps: [{ step: "Done", status: "completed" }],
      },
    };
    rerender();

    expect(result.current.onTurnCompleted).toBe(originalHandler);
  });

  it("dispatches normalized plan updates", () => {
    const { result, dispatch } = makeOptions();
    const normalized = { id: "turn-3", steps: [] };

    vi.mocked(normalizePlanUpdate).mockReturnValue(normalized as never);

    act(() => {
      result.current.onTurnPlanUpdated("ws-1", "thread-1", "turn-3", {
        explanation: "Plan",
        plan: [{ id: "step-1" }],
      });
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "ensureThread",
      workspaceId: "ws-1",
      threadId: "thread-1",
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadPlan",
      threadId: "thread-1",
      plan: normalized,
    });
  });

  it("dispatches turn diff updates", () => {
    const { result, dispatch } = makeOptions();

    act(() => {
      result.current.onTurnDiffUpdated("ws-1", "thread-1", "diff --git a/file b/file");
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "ensureThread",
      workspaceId: "ws-1",
      threadId: "thread-1",
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadTurnDiff",
      threadId: "thread-1",
      diff: "diff --git a/file b/file",
    });
  });

  it("dispatches normalized token usage updates", () => {
    const { result, dispatch } = makeOptions();
    const normalized = { total: 123 };

    vi.mocked(normalizeTokenUsage).mockReturnValue(normalized as never);

    act(() => {
      result.current.onThreadTokenUsageUpdated("ws-1", "thread-1", {
        total: 123,
      });
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "ensureThread",
      workspaceId: "ws-1",
      threadId: "thread-1",
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadTokenUsage",
      threadId: "thread-1",
      tokenUsage: normalized,
    });
  });

  it("dispatches normalized rate limits updates", () => {
    const previousRateLimits: RateLimitSnapshot = {
      primary: { usedPercent: 10, windowDurationMins: null, resetsAt: null },
      secondary: null,
      credits: null,
      planType: null,
    };
    const { result, dispatch, getCurrentRateLimits } = makeOptions({
      getCurrentRateLimits: () => previousRateLimits,
    });
    const normalized = { primary: { usedPercent: 10 } };

    vi.mocked(normalizeRateLimits).mockReturnValue(normalized as never);

    act(() => {
      result.current.onAccountRateLimitsUpdated("ws-1", { primary: {} });
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "setRateLimits",
      workspaceId: "ws-1",
      rateLimits: normalized,
    });
    expect(getCurrentRateLimits).toHaveBeenCalledWith("ws-1");
    expect(normalizeRateLimits).toHaveBeenCalledWith({ primary: {} }, previousRateLimits);
  });

  it("resolves codex rate limits from rate_limits_by_limit_id updates", () => {
    const previousRateLimits: RateLimitSnapshot = {
      primary: { usedPercent: 10, windowDurationMins: null, resetsAt: null },
      secondary: null,
      credits: null,
      planType: null,
    };
    const { result } = makeOptions({
      getCurrentRateLimits: () => previousRateLimits,
    });
    const normalized = { primary: { usedPercent: 58 } };
    vi.mocked(normalizeRateLimits).mockReturnValue(normalized as never);

    act(() => {
      result.current.onAccountRateLimitsUpdated("ws-1", {
        rate_limits_by_limit_id: {
          claude: { primary: { usedPercent: 12 } },
          codex: {
            primary: { usedPercent: 58 },
            limit_id: "codex",
            limit_name: "Codex",
          },
        },
      });
    });

    expect(normalizeRateLimits).toHaveBeenCalledWith(
      {
        primary: { usedPercent: 58 },
        limitId: "codex",
        limitName: "Codex",
        limit_id: "codex",
        limit_name: "Codex",
      },
      previousRateLimits
    );
  });

  it("handles turn errors when retries are disabled", () => {
    const {
      result,
      dispatch,
      markProcessing,
      markReviewing,
      setActiveTurnId,
      pushThreadErrorMessage,
      safeMessageActivity,
    } = makeOptions();

    act(() => {
      result.current.onTurnError("ws-1", "thread-1", "turn-1", {
        message: "boom",
        willRetry: false,
      });
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "ensureThread",
      workspaceId: "ws-1",
      threadId: "thread-1",
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "completePendingTurnItems",
      threadId: "thread-1",
    });
    expect(markProcessing).toHaveBeenCalledWith("thread-1", false, "idle");
    expect(markReviewing).toHaveBeenCalledWith("thread-1", false);
    expect(setActiveTurnId).toHaveBeenCalledWith("thread-1", null);
    expect(pushThreadErrorMessage).toHaveBeenCalledWith("thread-1", "Turn failed: boom");
    expect(safeMessageActivity).toHaveBeenCalled();
  });

  it("ignores turn errors that will retry", () => {
    const { result, dispatch, markProcessing } = makeOptions();

    act(() => {
      result.current.onTurnError("ws-1", "thread-1", "turn-1", {
        message: "boom",
        willRetry: true,
      });
    });

    expect(dispatch).not.toHaveBeenCalled();
    expect(markProcessing).not.toHaveBeenCalled();
  });

  it("uses structured error code when turn error message is empty", () => {
    const { result, pushThreadErrorMessage } = makeOptions();

    act(() => {
      result.current.onTurnError("ws-1", "thread-1", "turn-1", {
        message: "",
        code: "runtime.turn.provider.rejected",
        willRetry: false,
      });
    });

    expect(pushThreadErrorMessage).toHaveBeenCalledWith(
      "thread-1",
      "Turn failed: runtime.turn.provider.rejected"
    );
  });

  it("normalizes usage-limit failures into concise guidance", () => {
    const { result, pushThreadErrorMessage } = makeOptions();

    act(() => {
      result.current.onTurnError("ws-1", "thread-1", "turn-1", {
        message:
          "codex exec failed: ERROR: You've hit your usage limit. provider fallback failed: The usage limit has been reached",
        willRetry: false,
      });
    });

    expect(pushThreadErrorMessage).toHaveBeenCalledWith(
      "thread-1",
      "Turn failed: Local Codex CLI and provider fallback both hit usage limits. Check your account quota and retry."
    );
  });

  it("truncates oversized failure text for readability", () => {
    const { result, pushThreadErrorMessage } = makeOptions();
    const veryLongMessage = `prefix ${"x".repeat(800)}`;

    act(() => {
      result.current.onTurnError("ws-1", "thread-1", "turn-1", {
        message: veryLongMessage,
        willRetry: false,
      });
    });

    const lastCall = pushThreadErrorMessage.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe("thread-1");
    expect(lastCall?.[1]).toContain("Turn failed: prefix");
    expect(lastCall?.[1]).toContain("truncated; see runtime logs for full details");
    expect(lastCall?.[1].length ?? 0).toBeLessThan(560);
  });
});
