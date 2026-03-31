import { describe, expect, it, vi } from "vitest";
import { launchAutoDriveThread } from "./runtimeAutoDriveThreadLaunch";
import { createRuntimeSessionCommandFacade } from "./runtimeSessionCommandFacade";

const sendMessage = vi.fn(async () => ({ result: { turn: { id: "turn-1" } } }));

vi.mock("./runtimeSessionCommandFacade", () => ({
  createRuntimeSessionCommandFacade: vi.fn(() => ({
    sendMessage,
  })),
}));

describe("launchAutoDriveThread", () => {
  it("routes through the session command facade with explicit compat telemetry source", async () => {
    await launchAutoDriveThread({
      workspaceId: "ws-1",
      threadId: "thread-1",
      instruction: "Investigate the flaky test.",
      modelId: "gpt-5.4",
      reasonEffort: "high",
      accessMode: "on-request",
      preferredBackendIds: ["backend-a"],
      autoDrive: { enabled: true } as never,
      autonomyRequest: null,
    });

    expect(createRuntimeSessionCommandFacade).toHaveBeenCalledWith("ws-1");
    expect(sendMessage).toHaveBeenCalledWith({
      threadId: "thread-1",
      text: "Investigate the flaky test.",
      options: expect.objectContaining({
        model: "gpt-5.4",
        effort: "high",
        executionMode: "runtime",
        missionMode: "delegate",
        preferredBackendIds: ["backend-a"],
        telemetrySource: "runtime_autodrive_thread_launch",
      }),
    });
  });
});
