/** @vitest-environment jsdom */

import { createElement, type ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  createRuntimeSessionCommandFacade,
  useRuntimeSessionCommandsResolver,
  useWorkspaceRuntimeSessionCommands,
  type RuntimeSessionCommandDependencies,
} from "./runtimeSessionCommandFacade";
import { RuntimeKernelProvider } from "../kernel/RuntimeKernelContext";
import type { RuntimeKernel } from "../kernel/runtimeKernelTypes";

function createDependencies(): RuntimeSessionCommandDependencies {
  return {
    sendUserMessage: vi.fn(async () => ({ result: { turn: { id: "turn-1" } } })),
    steerTurn: vi.fn(async () => ({ result: { turnId: "turn-1" } })),
    interruptTurn: vi.fn(async () => ({ result: { interrupted: true } })),
    startReview: vi.fn(async () => ({ result: { threadId: "review-1" } })),
    compactThread: vi.fn(async () => ({ result: { accepted: true } })),
    listMcpServerStatus: vi.fn(async () => ({ result: { data: [] } })),
    respondToServerRequest: vi.fn(async () => undefined),
    respondToUserInputRequest: vi.fn(async () => undefined),
    respondToToolCallRequest: vi.fn(async () => undefined),
    detectRuntimeMode: vi.fn(() => "runtime-gateway-web" as const),
    reviewStartDesktopOnlyMessage: "Review start is only available in the desktop app.",
  } as unknown as RuntimeSessionCommandDependencies;
}

describe("createRuntimeSessionCommandFacade", () => {
  it("binds workspace-scoped command calls", async () => {
    const deps = createDependencies();
    const facade = createRuntimeSessionCommandFacade("ws-1", deps);

    await facade.sendMessage({
      threadId: "thread-1",
      text: "hello",
      options: { model: "gpt-5.4", contextPrefix: "ctx" },
    });
    await facade.steerTurn({
      threadId: "thread-1",
      turnId: "turn-1",
      text: "continue",
      images: ["img-1"],
      contextPrefix: "ctx",
      options: { executionMode: "runtime" },
    });
    await facade.interruptTurn({ threadId: "thread-1", turnId: "turn-1" });
    await facade.startReview({
      threadId: "thread-1",
      target: { type: "baseBranch", branch: "main" },
      delivery: "inline",
    });
    await facade.compactThread({ threadId: "thread-1" });
    await facade.listMcpServerStatus({ cursor: null, limit: 20 });
    await facade.respondToApproval({ requestId: 7, decision: "accept" });
    await facade.respondToUserInput({
      requestId: 8,
      answers: { prompt: { answers: ["yes"] } },
    });
    await facade.respondToToolCall({
      requestId: 9,
      response: { success: true, contentItems: [] },
    });

    expect(deps.sendUserMessage).toHaveBeenCalledWith("ws-1", "thread-1", "hello", {
      model: "gpt-5.4",
      contextPrefix: "ctx",
    });
    expect(deps.steerTurn).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "turn-1",
      "continue",
      ["img-1"],
      "ctx",
      { executionMode: "runtime" }
    );
    expect(deps.interruptTurn).toHaveBeenCalledWith("ws-1", "thread-1", "turn-1");
    expect(deps.startReview).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      { type: "baseBranch", branch: "main" },
      "inline"
    );
    expect(deps.compactThread).toHaveBeenCalledWith("ws-1", "thread-1");
    expect(deps.listMcpServerStatus).toHaveBeenCalledWith("ws-1", null, 20);
    expect(deps.respondToServerRequest).toHaveBeenCalledWith("ws-1", 7, "accept");
    expect(deps.respondToUserInputRequest).toHaveBeenCalledWith("ws-1", 8, {
      prompt: { answers: ["yes"] },
    });
    expect(deps.respondToToolCallRequest).toHaveBeenCalledWith("ws-1", 9, {
      success: true,
      contentItems: [],
    });
  });

  it("uses runtime mode gating for review availability", () => {
    const deps = createDependencies();
    const facade = createRuntimeSessionCommandFacade("ws-1", deps);

    expect(facade.canStartReviewInCurrentHost()).toBe(false);
    expect(facade.reviewStartDesktopOnlyMessage).toBe(
      "Review start is only available in the desktop app."
    );

    vi.mocked(deps.detectRuntimeMode).mockReturnValue("runtime-gateway-web");

    expect(facade.canStartReviewInCurrentHost()).toBe(false);

    vi.mocked(deps.detectRuntimeMode).mockReturnValue("tauri");

    expect(facade.canStartReviewInCurrentHost()).toBe(true);
  });
});

describe("runtime session command facade hooks", () => {
  function createWrapper(kernel: RuntimeKernel) {
    return function Wrapper({ children }: { children: ReactNode }) {
      return createElement(RuntimeKernelProvider, { value: kernel }, children);
    };
  }

  it("returns workspace-scoped session commands from the runtime scope hook", () => {
    const runtimeSessionCommands = {
      sendMessage: vi.fn(),
      steerTurn: vi.fn(),
      interruptTurn: vi.fn(),
      startReview: vi.fn(),
      compactThread: vi.fn(),
      listMcpServerStatus: vi.fn(),
      respondToApproval: vi.fn(),
      respondToUserInput: vi.fn(),
      respondToToolCall: vi.fn(),
      canStartReviewInCurrentHost: vi.fn(() => true),
      reviewStartDesktopOnlyMessage: "desktop-only",
    };
    const kernel = {
      getWorkspaceScope: vi.fn(() => ({
        workspaceId: "ws-1",
        runtimeGateway: {} as RuntimeKernel["runtimeGateway"],
        runtimeAgentControl: {} as never,
        runtimeSessionCommands,
      })),
    } as unknown as RuntimeKernel;

    const { result } = renderHook(() => useWorkspaceRuntimeSessionCommands("ws-1"), {
      wrapper: createWrapper(kernel),
    });

    expect(result.current).toBe(runtimeSessionCommands);
    expect(kernel.getWorkspaceScope).toHaveBeenCalledWith("ws-1");
  });

  it("resolves workspace-scoped session commands from the runtime kernel", () => {
    const workspaceSessionCommands = {
      sendMessage: vi.fn(),
      steerTurn: vi.fn(),
      interruptTurn: vi.fn(),
      startReview: vi.fn(),
      compactThread: vi.fn(),
      listMcpServerStatus: vi.fn(),
      respondToApproval: vi.fn(),
      respondToUserInput: vi.fn(),
      respondToToolCall: vi.fn(),
      canStartReviewInCurrentHost: vi.fn(() => true),
      reviewStartDesktopOnlyMessage: "desktop-only",
    };
    const kernel = {
      getWorkspaceScope: vi.fn((workspaceId: string) => ({
        workspaceId,
        runtimeGateway: {} as RuntimeKernel["runtimeGateway"],
        runtimeAgentControl: {} as never,
        runtimeSessionCommands: workspaceSessionCommands,
      })),
    } as unknown as RuntimeKernel;

    const { result } = renderHook(() => useRuntimeSessionCommandsResolver(), {
      wrapper: createWrapper(kernel),
    });

    expect(result.current("ws-2")).toBe(workspaceSessionCommands);
    expect(kernel.getWorkspaceScope).toHaveBeenCalledWith("ws-2");
  });
});
