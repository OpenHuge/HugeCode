// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import type { InvocationDescriptor } from "@ku0/code-runtime-host-contract";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { useQueuedSend } from "./useQueuedSend";

const publishInvocationCatalog = vi.hoisted(() => vi.fn());
const invokeRuntimeInvocation = vi.hoisted(() => vi.fn());
const pushErrorToast = vi.hoisted(() => vi.fn());

vi.mock("../../../application/runtime/facades/runtimeInvocationCatalogFacadeHooks", () => ({
  useRuntimeInvocationCatalogResolver: () => (workspaceId: string) => ({
    publishActiveCatalog: (input: Record<string, unknown>) =>
      publishInvocationCatalog(workspaceId, input),
  }),
}));

vi.mock("../../../application/runtime/facades/runtimeInvocationExecuteFacadeHooks", () => ({
  useRuntimeInvocationExecuteResolver: () => (workspaceId: string) => ({
    invoke: (input: Record<string, unknown>) => invokeRuntimeInvocation(workspaceId, input),
  }),
}));

vi.mock("../../../application/runtime/ports/toasts", () => ({
  pushErrorToast,
}));

const workspace: WorkspaceInfo = {
  id: "workspace-1",
  name: "CodexMonitor",
  path: "/tmp/codex",
  connected: true,
  settings: { sidebarCollapsed: false },
};

const makeOptions = (overrides: Partial<Parameters<typeof useQueuedSend>[0]> = {}) => ({
  activeThreadId: "thread-1",
  activeTurnId: "turn-1",
  isProcessing: false,
  isReviewing: false,
  steerEnabled: false,
  activeWorkspace: workspace,
  connectWorkspace: vi.fn().mockResolvedValue(undefined),
  startThreadForWorkspace: vi.fn().mockResolvedValue("thread-1"),
  sendUserMessage: vi.fn().mockResolvedValue(undefined),
  sendUserMessageToThread: vi.fn().mockResolvedValue(undefined),
  startFork: vi.fn().mockResolvedValue(undefined),
  startReview: vi.fn().mockResolvedValue(undefined),
  startResume: vi.fn().mockResolvedValue(undefined),
  startCompact: vi.fn().mockResolvedValue(undefined),
  startMcp: vi.fn().mockResolvedValue(undefined),
  startStatus: vi.fn().mockResolvedValue(undefined),
  clearActiveImages: vi.fn(),
  onComposePatchResolved: vi.fn(),
  ...overrides,
});

describe("useQueuedSend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    publishInvocationCatalog.mockResolvedValue({ items: [] });
  });

  it("sends queued messages one at a time after processing completes", async () => {
    const options = makeOptions();
    const { result, rerender } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.queueMessage("First");
      await result.current.queueMessage("Second");
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(options.sendUserMessage).toHaveBeenCalledTimes(1);
    expect(options.sendUserMessage).toHaveBeenCalledWith("First", []);

    await act(async () => {
      rerender({ ...options, isProcessing: true });
    });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      rerender({ ...options, isProcessing: false });
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(options.sendUserMessage).toHaveBeenCalledTimes(2);
    expect(options.sendUserMessage).toHaveBeenLastCalledWith("Second", []);
  });

  it("waits for processing to start before sending the next queued message", async () => {
    const options = makeOptions();
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.queueMessage("Alpha");
      await result.current.queueMessage("Beta");
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(options.sendUserMessage).toHaveBeenCalledTimes(1);
    expect(options.sendUserMessage).toHaveBeenCalledWith("Alpha", []);
  });

  it("queues send while processing when steer is disabled", async () => {
    const options = makeOptions({ isProcessing: true, steerEnabled: false });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.handleSend("Queued");
    });

    expect(options.sendUserMessage).not.toHaveBeenCalled();
    expect(result.current.activeQueue).toHaveLength(1);
    expect(result.current.activeQueue[0]?.text).toBe("Queued");
  });

  it("sends immediately while processing when steer is enabled", async () => {
    const options = makeOptions({ isProcessing: true, steerEnabled: true });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.handleSend("Steer");
    });

    expect(options.sendUserMessage).toHaveBeenCalledTimes(1);
    expect(options.sendUserMessage).toHaveBeenCalledWith("Steer", []);
    expect(result.current.activeQueue).toHaveLength(0);
  });

  it("queues a rapid second send before processing state catches up", async () => {
    const options = makeOptions();
    const { result, rerender } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.handleSend("First");
      await result.current.handleSend("Second");
    });

    expect(options.sendUserMessage).toHaveBeenCalledTimes(1);
    expect(options.sendUserMessage).toHaveBeenCalledWith("First", []);
    expect(result.current.activeQueue).toHaveLength(1);
    expect(result.current.activeQueue[0]?.text).toBe("Second");

    await act(async () => {
      rerender({ ...options, isProcessing: true });
    });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      rerender({ ...options, isProcessing: false });
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(options.sendUserMessage).toHaveBeenCalledTimes(2);
    expect(options.sendUserMessage).toHaveBeenLastCalledWith("Second", []);
  });

  it("sends immediately while processing when steer is enabled even if turn id is unavailable", async () => {
    const options = makeOptions({
      isProcessing: true,
      steerEnabled: true,
      activeTurnId: null,
    });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.handleSend("Wait for turn");
    });

    expect(options.sendUserMessage).toHaveBeenCalledTimes(1);
    expect(options.sendUserMessage).toHaveBeenCalledWith("Wait for turn", []);
    expect(result.current.activeQueue).toHaveLength(0);
  });

  it("retries queued send after failure", async () => {
    const options = makeOptions({
      sendUserMessage: vi
        .fn()
        .mockRejectedValueOnce(new Error("boom"))
        .mockResolvedValueOnce(undefined),
    });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.queueMessage("Retry");
    });

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(options.sendUserMessage).toHaveBeenCalledTimes(2);
    expect(options.sendUserMessage).toHaveBeenLastCalledWith("Retry", []);
  });

  it("queues messages per thread and only flushes the active thread", async () => {
    const options = makeOptions({ isProcessing: true });
    const { result, rerender } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.queueMessage("Thread-1");
    });

    await act(async () => {
      rerender({ ...options, activeThreadId: "thread-2", isProcessing: false });
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(options.sendUserMessage).not.toHaveBeenCalled();

    await act(async () => {
      rerender({ ...options, activeThreadId: "thread-1", isProcessing: false });
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(options.sendUserMessage).toHaveBeenCalledTimes(1);
    expect(options.sendUserMessage).toHaveBeenCalledWith("Thread-1", []);
  });

  it("connects workspace before sending when disconnected", async () => {
    const connectWorkspace = vi.fn().mockResolvedValue(undefined);
    const options = makeOptions({
      activeWorkspace: { ...workspace, connected: false },
      connectWorkspace,
    });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.handleSend("Connect");
    });

    expect(connectWorkspace).toHaveBeenCalledWith({
      ...workspace,
      connected: false,
    });
    expect(options.sendUserMessage).toHaveBeenCalledWith("Connect", []);
  });

  it("ignores images for queued review messages and blocks while reviewing", async () => {
    const options = makeOptions();
    const { result, rerender } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.queueMessage("/review check this", ["img-1"]);
      await result.current.queueMessage("After review");
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(options.startReview).toHaveBeenCalledTimes(1);
    expect(options.startReview).toHaveBeenCalledWith("/review check this");
    expect(options.sendUserMessage).not.toHaveBeenCalled();

    await act(async () => {
      rerender({ ...options, isReviewing: true });
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(options.sendUserMessage).not.toHaveBeenCalled();

    await act(async () => {
      rerender({ ...options, isReviewing: false });
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(options.sendUserMessage).toHaveBeenCalledTimes(1);
    expect(options.sendUserMessage).toHaveBeenCalledWith("After review", []);
  });

  it("returns false and preserves attached images when review start is blocked", async () => {
    const clearActiveImages = vi.fn();
    const options = makeOptions({
      startReview: vi.fn().mockResolvedValue(false),
      clearActiveImages,
    });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    let sendResult: Awaited<ReturnType<typeof result.current.handleSend>> | undefined;
    await act(async () => {
      sendResult = await result.current.handleSend("/review", ["img-1"]);
    });

    expect(sendResult).toBe(false);
    expect(options.startReview).toHaveBeenCalledWith("/review");
    expect(clearActiveImages).not.toHaveBeenCalled();
    expect(options.sendUserMessage).not.toHaveBeenCalled();
  });

  it("starts a new thread for /new and sends the remaining text there", async () => {
    const startThreadForWorkspace = vi.fn().mockResolvedValue("thread-2");
    const sendUserMessageToThread = vi.fn().mockResolvedValue(undefined);
    const options = makeOptions({ startThreadForWorkspace, sendUserMessageToThread });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.handleSend("/new hello there", ["img-1"]);
    });

    expect(startThreadForWorkspace).toHaveBeenCalledWith("workspace-1");
    expect(sendUserMessageToThread).toHaveBeenCalledWith(workspace, "thread-2", "hello there", []);
    expect(options.sendUserMessage).not.toHaveBeenCalled();
  });

  it("starts a new thread for bare /new without sending a message", async () => {
    const startThreadForWorkspace = vi.fn().mockResolvedValue("thread-3");
    const sendUserMessageToThread = vi.fn().mockResolvedValue(undefined);
    const options = makeOptions({ startThreadForWorkspace, sendUserMessageToThread });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.handleSend("/new");
    });

    expect(startThreadForWorkspace).toHaveBeenCalledWith("workspace-1");
    expect(sendUserMessageToThread).not.toHaveBeenCalled();
    expect(options.sendUserMessage).not.toHaveBeenCalled();
  });

  it("routes /status to the local status handler", async () => {
    const startStatus = vi.fn().mockResolvedValue(undefined);
    const options = makeOptions({ startStatus });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.handleSend("/status now", ["img-1"]);
    });

    expect(startStatus).toHaveBeenCalledWith("/status now");
    expect(options.sendUserMessage).not.toHaveBeenCalled();
    expect(options.startReview).not.toHaveBeenCalled();
  });

  it("routes /mcp to the MCP handler", async () => {
    const startMcp = vi.fn().mockResolvedValue(undefined);
    const options = makeOptions({ startMcp });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.handleSend("/mcp now", ["img-1"]);
    });

    expect(startMcp).toHaveBeenCalledWith("/mcp now");
    expect(options.sendUserMessage).not.toHaveBeenCalled();
    expect(options.startReview).not.toHaveBeenCalled();
  });

  it("treats /apps as plain text", async () => {
    const options = makeOptions();
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.handleSend("/apps now", ["img-1"]);
    });

    expect(options.sendUserMessage).toHaveBeenCalledWith("/apps now", ["img-1"]);
  });

  it("routes /resume to the resume handler", async () => {
    const startResume = vi.fn().mockResolvedValue(undefined);
    const options = makeOptions({ startResume });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.handleSend("/resume now", ["img-1"]);
    });

    expect(startResume).toHaveBeenCalledWith("/resume now");
    expect(options.sendUserMessage).not.toHaveBeenCalled();
    expect(options.startReview).not.toHaveBeenCalled();
  });

  it("routes /compact to the compact handler", async () => {
    const startCompact = vi.fn().mockResolvedValue(undefined);
    const options = makeOptions({ startCompact });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.handleSend("/compact now", ["img-1"]);
    });

    expect(startCompact).toHaveBeenCalledWith("/compact now");
    expect(options.sendUserMessage).not.toHaveBeenCalled();
    expect(options.startReview).not.toHaveBeenCalled();
  });

  it("routes /fork to the fork handler", async () => {
    const startFork = vi.fn().mockResolvedValue(undefined);
    const options = makeOptions({ startFork });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.handleSend("/fork branch here", ["img-1"]);
    });

    expect(startFork).toHaveBeenCalledWith("/fork branch here");
    expect(options.sendUserMessage).not.toHaveBeenCalled();
    expect(options.startReview).not.toHaveBeenCalled();
  });

  it("does not send when reviewing even if steer is enabled", async () => {
    const options = makeOptions({ isReviewing: true, steerEnabled: true });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.handleSend("Blocked");
    });

    expect(options.sendUserMessage).not.toHaveBeenCalled();
    expect(result.current.activeQueue).toHaveLength(0);
  });

  it("preserves images for queued messages", async () => {
    const options = makeOptions();
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.queueMessage("Images", ["img-1", "img-2"]);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(options.sendUserMessage).toHaveBeenCalledTimes(1);
    expect(options.sendUserMessage).toHaveBeenCalledWith("Images", ["img-1", "img-2"]);
  });

  it("does not flush queued messages while response is required", async () => {
    const options = makeOptions({ queueFlushPaused: true });
    const { result, rerender } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.queueMessage("Held");
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(options.sendUserMessage).not.toHaveBeenCalled();

    await act(async () => {
      rerender({ ...options, queueFlushPaused: false });
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(options.sendUserMessage).toHaveBeenCalledTimes(1);
    expect(options.sendUserMessage).toHaveBeenCalledWith("Held", []);
  });

  it("routes runtime prompt overlay slash commands through invocation execute", async () => {
    const onComposePatchResolved = vi.fn();
    const options = makeOptions({ onComposePatchResolved });
    const invocation: InvocationDescriptor = {
      id: "session:prompt:prompt.summarize",
      title: "summarize",
      summary: "Summarize a target",
      description: "Summarize a target",
      kind: "session_command",
      source: {
        kind: "session_command",
        contributionType: "session_scoped",
        authority: "workspace",
        label: "Runtime prompt library",
        sourceId: "prompt.summarize",
        workspaceId: "workspace-1",
        provenance: null,
      },
      runtimeTool: null,
      argumentSchema: null,
      aliases: [],
      tags: ["prompt_overlay"],
      safety: {
        level: "read",
        readOnly: true,
        destructive: false,
        openWorld: false,
        idempotent: true,
      },
      exposure: {
        operatorVisible: true,
        modelVisible: false,
        requiresReadiness: false,
        hiddenReason: null,
      },
      readiness: {
        state: "ready",
        available: true,
        reason: null,
        warnings: [],
        checkedAt: null,
      },
      metadata: {
        promptOverlay: {
          promptId: "prompt.summarize",
          scope: "workspace",
        },
        slashCommand: {
          primaryTrigger: "/summarize",
          legacyAliases: [],
          insertText: 'summarize TARGET=""',
          cursorOffset: 18,
          hint: "TARGET=",
          shadowedByBuiltin: false,
        },
      },
    };
    publishInvocationCatalog.mockResolvedValue({ items: [invocation] });
    invokeRuntimeInvocation.mockResolvedValue({
      ok: true,
      kind: "compose_patch_resolved",
      payload: {
        text: "Summarize src/features",
      },
      message: null,
      evidence: null,
    });

    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    let sendResult: Awaited<ReturnType<typeof result.current.handleSend>> | undefined;
    await act(async () => {
      sendResult = await result.current.handleSend('/summarize TARGET="src/features"', ["img-1"]);
    });

    expect(sendResult).toBe(false);
    expect(invokeRuntimeInvocation).toHaveBeenCalledWith("workspace-1", {
      invocationId: "session:prompt:prompt.summarize",
      arguments: {
        TARGET: "src/features",
      },
      context: {
        threadId: "thread-1",
        turnId: "turn-1",
        telemetrySource: "thread_slash_command",
      },
      caller: "operator",
    });
    expect(onComposePatchResolved).toHaveBeenCalledWith({
      invocationId: "session:prompt:prompt.summarize",
      text: "Summarize src/features",
    });
    expect(options.sendUserMessage).not.toHaveBeenCalled();
    expect(options.clearActiveImages).toHaveBeenCalled();
  });

  it("surfaces blocked runtime slash commands without sending raw text", async () => {
    const options = makeOptions();
    const invocation: InvocationDescriptor = {
      id: "session:prompt:prompt.review",
      title: "summarize",
      summary: "Summarize a target",
      description: "Summarize a target",
      kind: "session_command",
      source: {
        kind: "session_command",
        contributionType: "session_scoped",
        authority: "workspace",
        label: "Runtime prompt library",
        sourceId: "prompt.review",
        workspaceId: "workspace-1",
        provenance: null,
      },
      runtimeTool: null,
      argumentSchema: null,
      aliases: [],
      tags: ["prompt_overlay"],
      safety: {
        level: "read",
        readOnly: true,
        destructive: false,
        openWorld: false,
        idempotent: true,
      },
      exposure: {
        operatorVisible: true,
        modelVisible: false,
        requiresReadiness: false,
        hiddenReason: null,
      },
      readiness: {
        state: "ready",
        available: true,
        reason: null,
        warnings: [],
        checkedAt: null,
      },
      metadata: {
        promptOverlay: {
          promptId: "prompt.review",
          scope: "workspace",
        },
        slashCommand: {
          primaryTrigger: "/summarize",
          legacyAliases: [],
          insertText: 'summarize TARGET=""',
          cursorOffset: 18,
          hint: "TARGET=",
          shadowedByBuiltin: false,
        },
      },
    };
    publishInvocationCatalog.mockResolvedValue({ items: [invocation] });
    invokeRuntimeInvocation.mockResolvedValue({
      ok: false,
      kind: "blocked",
      payload: null,
      message: "Missing required args for prompt `summarize`: TARGET.",
      evidence: null,
    });

    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    let sendResult: Awaited<ReturnType<typeof result.current.handleSend>> | undefined;
    await act(async () => {
      sendResult = await result.current.handleSend("/summarize", ["img-1"]);
    });

    expect(sendResult).toBe(false);
    expect(options.sendUserMessage).not.toHaveBeenCalled();
    expect(pushErrorToast).toHaveBeenCalledWith({
      title: "Slash command blocked",
      message: "Missing required args for prompt `summarize`: TARGET.",
    });
    expect(options.clearActiveImages).not.toHaveBeenCalled();
  });

  it("flushes queued runtime prompt overlays through invocation execute", async () => {
    const onComposePatchResolved = vi.fn();
    const options = makeOptions({
      isProcessing: true,
      steerEnabled: false,
      onComposePatchResolved,
    });
    const invocation: InvocationDescriptor = {
      id: "session:prompt:prompt.summarize",
      title: "summarize",
      summary: "Summarize a target",
      description: "Summarize a target",
      kind: "session_command",
      source: {
        kind: "session_command",
        contributionType: "session_scoped",
        authority: "workspace",
        label: "Runtime prompt library",
        sourceId: "prompt.summarize",
        workspaceId: "workspace-1",
        provenance: null,
      },
      runtimeTool: null,
      argumentSchema: null,
      aliases: [],
      tags: ["prompt_overlay"],
      safety: {
        level: "read",
        readOnly: true,
        destructive: false,
        openWorld: false,
        idempotent: true,
      },
      exposure: {
        operatorVisible: true,
        modelVisible: false,
        requiresReadiness: false,
        hiddenReason: null,
      },
      readiness: {
        state: "ready",
        available: true,
        reason: null,
        warnings: [],
        checkedAt: null,
      },
      metadata: {
        promptOverlay: {
          promptId: "prompt.summarize",
          scope: "workspace",
        },
        slashCommand: {
          primaryTrigger: "/summarize",
          legacyAliases: [],
          insertText: 'summarize TARGET=""',
          cursorOffset: 18,
          hint: "TARGET=",
          shadowedByBuiltin: false,
        },
      },
    };
    publishInvocationCatalog.mockResolvedValue({ items: [invocation] });
    invokeRuntimeInvocation.mockResolvedValue({
      ok: true,
      kind: "compose_patch_resolved",
      payload: {
        text: "Summarize src/features",
      },
      message: null,
      evidence: null,
    });

    const { result, rerender } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.handleSend('/summarize TARGET="src/features"');
    });

    expect(result.current.activeQueue).toHaveLength(1);

    await act(async () => {
      rerender({ ...options, isProcessing: false });
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(onComposePatchResolved).toHaveBeenCalledWith({
      invocationId: "session:prompt:prompt.summarize",
      text: "Summarize src/features",
    });
    expect(options.sendUserMessage).not.toHaveBeenCalled();
    expect(result.current.activeQueue).toHaveLength(0);
  });
});
