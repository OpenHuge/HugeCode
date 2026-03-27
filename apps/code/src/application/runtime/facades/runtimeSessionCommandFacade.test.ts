import { describe, expect, it, vi } from "vitest";
import {
  createRuntimeSessionCommandFacade,
  type RuntimeSessionCommandDependencies,
} from "./runtimeSessionCommandFacade";

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
    detectRuntimeMode: vi.fn(() => "tauri" as const),
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
  });
});
