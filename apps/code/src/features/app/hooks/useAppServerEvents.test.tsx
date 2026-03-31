// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { subscribeAppServerEvents } from "../../../application/runtime/ports/events";
import {
  subscribeScopedRuntimeUpdatedEvents,
  type RuntimeUpdatedEvent,
} from "../../../application/runtime/ports/runtimeUpdatedEvents";
import type { AppServerEvent } from "../../../types";
import { useAppServerEvents } from "./useAppServerEvents";

vi.mock("../../../application/runtime/ports/events", () => ({
  subscribeAppServerEvents: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/runtimeUpdatedEvents", () => ({
  subscribeScopedRuntimeUpdatedEvents: vi.fn(),
}));

type Handlers = Parameters<typeof useAppServerEvents>[0];

function TestHarness({ handlers }: { handlers: Handlers }) {
  useAppServerEvents(handlers);
  return null;
}

let listener: ((event: AppServerEvent) => void) | null = null;
let runtimeUpdatedListener: ((event: RuntimeUpdatedEvent) => void) | null = null;
const unlistenAppServer = vi.fn();
const unlistenRuntimeUpdated = vi.fn();

beforeEach(() => {
  listener = null;
  runtimeUpdatedListener = null;
  unlistenAppServer.mockReset();
  unlistenRuntimeUpdated.mockReset();
  vi.mocked(subscribeAppServerEvents).mockImplementation((cb) => {
    listener = cb;
    return unlistenAppServer;
  });
  vi.mocked(subscribeScopedRuntimeUpdatedEvents).mockImplementation((_options, cb) => {
    runtimeUpdatedListener = cb;
    return unlistenRuntimeUpdated;
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

async function mount(handlers: Handlers) {
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => {
    root.render(<TestHarness handlers={handlers} />);
  });
  return { root };
}

describe("useAppServerEvents", () => {
  it("routes app-server events to handlers", async () => {
    const handlers: Handlers = {
      onAppServerEvent: vi.fn(),
      onWorkspaceConnected: vi.fn(),
      onThreadStarted: vi.fn(),
      onThreadNameUpdated: vi.fn(),
      onBackgroundThreadAction: vi.fn(),
      onAgentMessageDelta: vi.fn(),
      onReasoningSummaryBoundary: vi.fn(),
      onPlanDelta: vi.fn(),
      onApprovalRequest: vi.fn(),
      onApprovalResolved: vi.fn(),
      onRequestUserInput: vi.fn(),
      onToolCallRequest: vi.fn(),
      onItemCompleted: vi.fn(),
      onAgentMessageCompleted: vi.fn(),
      onAccountUpdated: vi.fn(),
      onThreadCompacted: vi.fn(),
      onMcpServerOauthLoginCompleted: vi.fn(),
      onModelRerouted: vi.fn(),
      onDeprecationNotice: vi.fn(),
      onConfigWarning: vi.fn(),
      onFuzzyFileSearchSessionUpdated: vi.fn(),
      onFuzzyFileSearchSessionCompleted: vi.fn(),
      onWindowsWorldWritableWarning: vi.fn(),
      onWindowsSandboxSetupCompleted: vi.fn(),
      onChatgptAuthTokensRefreshRequest: vi.fn(),
    };
    const { root } = await mount(handlers);

    expect(listener).toBeTypeOf("function");

    act(() => {
      listener?.({
        workspace_id: "ws-1",
        message: {
          method: "item/agentMessage/delta",
          params: { threadId: "thread-1", itemId: "item-1", delta: "Hello" },
        },
      });
    });
    expect(handlers.onAgentMessageDelta).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "item-1",
      delta: "Hello",
    });

    act(() => {
      listener?.({
        workspace_id: "ws-1",
        message: {
          method: "item/reasoning/summaryPartAdded",
          params: { threadId: "thread-1", itemId: "reasoning-1", summaryIndex: 1 },
        },
      });
    });
    expect(handlers.onReasoningSummaryBoundary).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "reasoning-1"
    );

    act(() => {
      listener?.({
        workspace_id: "ws-1",
        message: {
          method: "item/plan/delta",
          params: { threadId: "thread-1", itemId: "plan-1", delta: "- Step 1" },
        },
      });
    });
    expect(handlers.onPlanDelta).toHaveBeenCalledWith("ws-1", "thread-1", "plan-1", "- Step 1");

    act(() => {
      listener?.({
        workspace_id: "ws-1",
        message: {
          method: "thread/started",
          params: { thread: { id: "thread-2", preview: "New thread" } },
        },
      });
    });
    expect(handlers.onThreadStarted).toHaveBeenCalledWith("ws-1", {
      id: "thread-2",
      preview: "New thread",
    });

    act(() => {
      listener?.({
        workspace_id: "ws-1",
        message: {
          method: "thread/name/updated",
          params: { threadId: "thread-2", threadName: "Renamed from server" },
        },
      });
    });
    expect(handlers.onThreadNameUpdated).toHaveBeenCalledWith("ws-1", {
      threadId: "thread-2",
      threadName: "Renamed from server",
    });

    act(() => {
      listener?.({
        workspace_id: "ws-1",
        message: {
          method: "workspace/requestApproval",
          id: 7,
          params: { mode: "full" },
        },
      });
    });
    expect(handlers.onApprovalRequest).toHaveBeenCalledWith({
      workspace_id: "ws-1",
      request_id: 7,
      method: "workspace/requestApproval",
      params: { mode: "full" },
    });

    act(() => {
      listener?.({
        workspace_id: "ws-1",
        message: {
          method: "runtime/approvalResolved",
          params: {
            approvalId: "approval-7",
            threadId: "thread-1",
            turnId: "turn-1",
            status: "approved",
          },
        },
      });
    });
    expect(handlers.onApprovalResolved).toHaveBeenCalledWith("ws-1", {
      approvalId: "approval-7",
      threadId: "thread-1",
      turnId: "turn-1",
      status: "approved",
    });

    act(() => {
      listener?.({
        workspace_id: "ws-1",
        message: {
          method: "item/tool/requestUserInput",
          id: 11,
          params: {
            thread_id: "thread-1",
            turn_id: "turn-1",
            item_id: "call-1",
            questions: [
              {
                id: "confirm_path",
                header: "Confirm",
                question: "Proceed?",
                options: [
                  { label: "Yes", description: "Continue." },
                  { label: "No", description: "Stop." },
                ],
              },
            ],
          },
        },
      });
    });
    expect(handlers.onRequestUserInput).toHaveBeenCalledWith({
      workspace_id: "ws-1",
      request_id: 11,
      params: {
        thread_id: "thread-1",
        turn_id: "turn-1",
        item_id: "call-1",
        questions: [
          {
            id: "confirm_path",
            header: "Confirm",
            question: "Proceed?",
            isOther: false,
            isSecret: false,
            options: [
              { label: "Yes", description: "Continue." },
              { label: "No", description: "Stop." },
            ],
          },
        ],
      },
    });

    act(() => {
      listener?.({
        workspace_id: "ws-1",
        message: {
          method: "item/tool/call",
          id: 17,
          params: {
            threadId: "thread-1",
            turnId: "turn-1",
            callId: "call-77",
            tool: "lookup_ticket",
            arguments: { id: "ABC-123" },
          },
        },
      });
    });
    expect(handlers.onToolCallRequest).toHaveBeenCalledWith({
      workspace_id: "ws-1",
      request_id: 17,
      params: {
        thread_id: "thread-1",
        turn_id: "turn-1",
        call_id: "call-77",
        tool: "lookup_ticket",
        arguments: { id: "ABC-123" },
      },
    });

    act(() => {
      listener?.({
        workspace_id: "ws-1",
        message: {
          method: "item/completed",
          params: {
            threadId: "thread-1",
            item: { type: "agentMessage", id: "item-2", text: "Done" },
          },
        },
      });
    });
    expect(handlers.onItemCompleted).toHaveBeenCalledWith("ws-1", "thread-1", {
      type: "agentMessage",
      id: "item-2",
      text: "Done",
    });
    expect(handlers.onAgentMessageCompleted).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "item-2",
      text: "Done",
    });

    act(() => {
      listener?.({
        workspace_id: "ws-1",
        message: {
          method: "account/updated",
          params: { authMode: "chatgpt" },
        },
      });
    });
    expect(handlers.onAccountUpdated).toHaveBeenCalledWith("ws-1", "chatgpt");

    act(() => {
      runtimeUpdatedListener?.({
        event: {
          workspace_id: "ws-1",
          message: {
            method: "runtime/updated",
            params: {
              revision: "21",
              scope: ["oauth", "workspaces"],
              reason: "code_oauth_pool_upsert",
            },
          },
        },
        eventWorkspaceId: "ws-1",
        paramsWorkspaceId: null,
        isWorkspaceLocalEvent: false,
        params: {
          revision: "21",
          scope: ["oauth", "workspaces"],
          reason: "code_oauth_pool_upsert",
        },
        reason: "code_oauth_pool_upsert",
        scope: ["oauth", "workspaces"],
      });
    });
    expect(handlers.onWorkspaceConnected).toHaveBeenCalledTimes(1);
    expect(handlers.onAccountUpdated).toHaveBeenCalledWith("ws-1", null);

    act(() => {
      runtimeUpdatedListener?.({
        event: {
          workspace_id: "workspace-local",
          message: {
            method: "runtime/updated",
            params: {
              revision: "22",
              scope: ["oauth", "workspaces"],
              reason: "event_stream_lagged",
            },
          },
        },
        eventWorkspaceId: "workspace-local",
        paramsWorkspaceId: null,
        isWorkspaceLocalEvent: true,
        params: {
          revision: "22",
          scope: ["oauth", "workspaces"],
          reason: "event_stream_lagged",
        },
        reason: "event_stream_lagged",
        scope: ["oauth", "workspaces"],
      });
    });
    expect(handlers.onWorkspaceConnected).toHaveBeenCalledTimes(1);
    expect(handlers.onAccountUpdated).not.toHaveBeenCalledWith("workspace-local", null);

    act(() => {
      listener?.({
        workspace_id: "ws-1",
        message: {
          method: "account/chatgptAuthTokens/refresh",
          id: 88,
          params: {
            reason: "unauthorized",
            previousAccountId: "acct-123",
            chatgptWorkspaceId: "org-selected",
          },
        },
      });
    });
    expect(handlers.onChatgptAuthTokensRefreshRequest).toHaveBeenCalledWith({
      workspace_id: "ws-1",
      request_id: 88,
      params: {
        reason: "unauthorized",
        previous_account_id: "acct-123",
        chatgpt_workspace_id: "org-selected",
      },
    });

    act(() => {
      listener?.({
        workspace_id: "ws-1",
        message: {
          method: "thread/compacted",
          params: { threadId: "thread-1", turnId: "turn-1" },
        },
      });
    });
    expect(handlers.onThreadCompacted).toHaveBeenCalledWith("ws-1", {
      threadId: "thread-1",
      turnId: "turn-1",
    });

    act(() => {
      listener?.({
        workspace_id: "ws-1",
        message: {
          method: "mcpServer/oauthLogin/completed",
          params: { name: "github", success: false, error: "OAuth callback cancelled" },
        },
      });
    });
    expect(handlers.onMcpServerOauthLoginCompleted).toHaveBeenCalledWith("ws-1", {
      name: "github",
      success: false,
      error: "OAuth callback cancelled",
    });

    act(() => {
      listener?.({
        workspace_id: "ws-1",
        message: {
          method: "model/rerouted",
          params: {
            threadId: "thread-1",
            turnId: "turn-1",
            fromModel: "gpt-5",
            toModel: "gpt-5-mini",
            reason: "highRiskCyberActivity",
          },
        },
      });
    });
    expect(handlers.onModelRerouted).toHaveBeenCalledWith("ws-1", {
      threadId: "thread-1",
      turnId: "turn-1",
      fromModel: "gpt-5",
      toModel: "gpt-5-mini",
      reason: "highRiskCyberActivity",
    });

    act(() => {
      listener?.({
        workspace_id: "ws-1",
        message: {
          method: "deprecationNotice",
          params: {
            summary: "thread/compacted is deprecated",
            details: "Use contextCompaction item type instead.",
          },
        },
      });
    });
    expect(handlers.onDeprecationNotice).toHaveBeenCalledWith("ws-1", {
      summary: "thread/compacted is deprecated",
      details: "Use contextCompaction item type instead.",
    });

    act(() => {
      listener?.({
        workspace_id: "ws-1",
        message: {
          method: "configWarning",
          params: {
            summary: "Unknown config key",
            details: "The key `foo` is ignored.",
            path: "/tmp/codex/config.toml",
            range: {
              start: { line: 4, column: 3 },
              end: { line: 4, column: 9 },
            },
          },
        },
      });
    });
    expect(handlers.onConfigWarning).toHaveBeenCalledWith("ws-1", {
      summary: "Unknown config key",
      details: "The key `foo` is ignored.",
      path: "/tmp/codex/config.toml",
      range: {
        start: { line: 4, column: 3 },
        end: { line: 4, column: 9 },
      },
    });

    act(() => {
      listener?.({
        workspace_id: "ws-1",
        message: {
          method: "fuzzyFileSearch/sessionUpdated",
          params: {
            sessionId: "session-1",
            query: "app server",
            files: [
              {
                root: "/repo",
                path: "apps/code/src/utils/appServerEvents.ts",
                fileName: "appServerEvents.ts",
                score: 92,
                indices: [0, 1, 2],
              },
            ],
          },
        },
      });
    });
    expect(handlers.onFuzzyFileSearchSessionUpdated).toHaveBeenCalledWith("ws-1", {
      sessionId: "session-1",
      query: "app server",
      files: [
        {
          root: "/repo",
          path: "apps/code/src/utils/appServerEvents.ts",
          fileName: "appServerEvents.ts",
          score: 92,
          indices: [0, 1, 2],
        },
      ],
    });

    act(() => {
      listener?.({
        workspace_id: "ws-1",
        message: {
          method: "fuzzyFileSearch/sessionCompleted",
          params: {
            sessionId: "session-1",
            query: "app server",
          },
        },
      });
    });
    expect(handlers.onFuzzyFileSearchSessionCompleted).toHaveBeenCalledWith("ws-1", {
      sessionId: "session-1",
      query: "app server",
    });

    act(() => {
      listener?.({
        workspace_id: "ws-1",
        message: {
          method: "windows/worldWritableWarning",
          params: {
            samplePaths: ["C:\\temp", "C:\\Users\\Public"],
            extraCount: 2,
            failedScan: false,
          },
        },
      });
    });
    expect(handlers.onWindowsWorldWritableWarning).toHaveBeenCalledWith("ws-1", {
      samplePaths: ["C:\\temp", "C:\\Users\\Public"],
      extraCount: 2,
      failedScan: false,
    });

    act(() => {
      listener?.({
        workspace_id: "ws-1",
        message: {
          method: "windowsSandbox/setupCompleted",
          params: { mode: "elevated", success: true, error: null },
        },
      });
    });
    expect(handlers.onWindowsSandboxSetupCompleted).toHaveBeenCalledWith("ws-1", {
      mode: "elevated",
      success: true,
      error: null,
    });

    await act(async () => {
      root.unmount();
    });
    expect(unlistenAppServer).toHaveBeenCalledTimes(1);
    expect(unlistenRuntimeUpdated).toHaveBeenCalledTimes(1);
  });

  it("normalizes request user input questions and options", async () => {
    const handlers: Handlers = {
      onRequestUserInput: vi.fn(),
    };
    const { root } = await mount(handlers);

    act(() => {
      listener?.({
        workspace_id: "ws-9",
        message: {
          method: "item/tool/requestUserInput",
          id: 55,
          params: {
            threadId: "thread-9",
            turnId: "turn-9",
            itemId: "item-9",
            questions: [
              {
                id: "",
                header: "",
                question: "",
                options: [
                  { label: "", description: "" },
                  { label: "  ", description: " " },
                ],
              },
              {
                id: "q-1",
                header: "",
                question: "Choose",
                options: [
                  { label: "", description: "" },
                  { label: "Yes", description: "" },
                  { label: "", description: "No label" },
                ],
              },
            ],
          },
        },
      });
    });

    expect(handlers.onRequestUserInput).toHaveBeenCalledWith({
      workspace_id: "ws-9",
      request_id: 55,
      params: {
        thread_id: "thread-9",
        turn_id: "turn-9",
        item_id: "item-9",
        questions: [
          {
            id: "q-1",
            header: "",
            question: "Choose",
            isOther: false,
            isSecret: false,
            options: [
              { label: "Yes", description: "" },
              { label: "", description: "No label" },
            ],
          },
        ],
      },
    });

    await act(async () => {
      root.unmount();
    });
  });

  it("forwards rate_limits_by_limit_id account updates when direct rate limits are absent", async () => {
    const handlers: Handlers = {
      onAccountRateLimitsUpdated: vi.fn(),
    };
    const { root } = await mount(handlers);

    act(() => {
      listener?.({
        workspace_id: "ws-1",
        message: {
          method: "account/rateLimits/updated",
          params: {
            rate_limits_by_limit_id: {
              codex: {
                primary: { usedPercent: 44 },
                limit_id: "codex",
              },
            },
          },
        },
      });
    });

    expect(handlers.onAccountRateLimitsUpdated).toHaveBeenCalledWith("ws-1", {
      rate_limits_by_limit_id: {
        codex: {
          primary: { usedPercent: 44 },
          limit_id: "codex",
        },
      },
    });

    await act(async () => {
      root.unmount();
    });
  });

  it("ignores delta events missing required fields", async () => {
    const handlers: Handlers = {
      onAgentMessageDelta: vi.fn(),
    };
    const { root } = await mount(handlers);

    act(() => {
      listener?.({
        workspace_id: "ws-1",
        message: {
          method: "item/agentMessage/delta",
          params: { threadId: "", itemId: "item-1", delta: "Hello" },
        },
      });
    });
    act(() => {
      listener?.({
        workspace_id: "ws-1",
        message: {
          method: "item/agentMessage/delta",
          params: { threadId: "thread-1", itemId: "", delta: "Hello" },
        },
      });
    });
    act(() => {
      listener?.({
        workspace_id: "ws-1",
        message: {
          method: "item/agentMessage/delta",
          params: { threadId: "thread-1", itemId: "item-1", delta: "" },
        },
      });
    });

    expect(handlers.onAgentMessageDelta).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });

  it("forwards optional turn metadata on delta events", async () => {
    const handlers: Handlers = {
      onAgentMessageDelta: vi.fn(),
    };
    const { root } = await mount(handlers);

    act(() => {
      listener?.({
        workspace_id: "ws-1",
        message: {
          method: "item/agentMessage/delta",
          params: {
            threadId: "thread-1",
            turnId: "turn-1",
            itemId: "item-1",
            stepIndex: 3,
            transient: true,
            delta: "heartbeat",
          },
        },
      });
    });

    expect(handlers.onAgentMessageDelta).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      threadId: "thread-1",
      turnId: "turn-1",
      itemId: "item-1",
      stepIndex: 3,
      transient: true,
      delta: "heartbeat",
    });

    await act(async () => {
      root.unmount();
    });
  });

  it("routes error events with missing threadId by resolving from prior turn metadata", async () => {
    const handlers: Handlers = {
      onTurnStarted: vi.fn(),
      onTurnError: vi.fn(),
    };
    const { root } = await mount(handlers);

    act(() => {
      listener?.({
        workspace_id: "ws-1",
        message: {
          method: "turn/started",
          params: {
            threadId: "thread-1",
            turn: { id: "turn-1", threadId: "thread-1" },
          },
        },
      });
    });

    act(() => {
      listener?.({
        workspace_id: "ws-1",
        message: {
          method: "error",
          params: {
            turnId: "turn-1",
            error: { message: "Provider rejected request" },
            willRetry: false,
          },
        },
      });
    });

    expect(handlers.onTurnStarted).toHaveBeenCalledWith("ws-1", "thread-1", "turn-1");
    expect(handlers.onTurnError).toHaveBeenCalledWith("ws-1", "thread-1", "turn-1", {
      message: "Provider rejected request",
      code: undefined,
      willRetry: false,
    });

    await act(async () => {
      root.unmount();
    });
  });

  it("forwards structured turn error code from nested error payload", async () => {
    const handlers: Handlers = {
      onTurnStarted: vi.fn(),
      onTurnError: vi.fn(),
    };
    const { root } = await mount(handlers);

    act(() => {
      listener?.({
        workspace_id: "ws-1",
        message: {
          method: "turn/started",
          params: {
            threadId: "thread-1",
            turn: { id: "turn-2", threadId: "thread-1" },
          },
        },
      });
    });

    act(() => {
      listener?.({
        workspace_id: "ws-1",
        message: {
          method: "error",
          params: {
            turnId: "turn-2",
            error: {
              details: {
                error: {
                  code: "runtime.turn.provider.rejected",
                  message: "Rejected by provider policy.",
                },
              },
            },
            willRetry: false,
          },
        },
      });
    });

    expect(handlers.onTurnError).toHaveBeenCalledWith("ws-1", "thread-1", "turn-2", {
      message: "Rejected by provider policy.",
      code: "runtime.turn.provider.rejected",
      willRetry: false,
    });

    await act(async () => {
      root.unmount();
    });
  });

  it("derives thread context for item lifecycle events when only turnId is present", async () => {
    const handlers: Handlers = {
      onItemStarted: vi.fn(),
      onItemCompleted: vi.fn(),
      onAgentMessageCompleted: vi.fn(),
    };
    const { root } = await mount(handlers);

    act(() => {
      listener?.({
        workspace_id: "ws-1",
        message: {
          method: "turn/started",
          params: {
            threadId: "thread-ctx-1",
            turnId: "turn-ctx-1",
          },
        },
      });
    });

    act(() => {
      listener?.({
        workspace_id: "ws-1",
        message: {
          method: "item/started",
          params: {
            turnId: "turn-ctx-1",
            item: { id: "plan-ctx-1", type: "plan", status: "inProgress" },
          },
        },
      });
    });

    expect(handlers.onItemStarted).toHaveBeenCalledWith("ws-1", "thread-ctx-1", {
      id: "plan-ctx-1",
      type: "plan",
      status: "inProgress",
    });

    act(() => {
      listener?.({
        workspace_id: "ws-1",
        message: {
          method: "item/completed",
          params: {
            turnId: "turn-ctx-1",
            item: {
              id: "plan-ctx-1",
              type: "plan",
              status: "completed",
              text: "Execution plan\n1. Verify persistence",
            },
          },
        },
      });
    });

    expect(handlers.onItemCompleted).toHaveBeenCalledWith("ws-1", "thread-ctx-1", {
      id: "plan-ctx-1",
      type: "plan",
      status: "completed",
      text: "Execution plan\n1. Verify persistence",
    });

    await act(async () => {
      root.unmount();
    });
  });
});
