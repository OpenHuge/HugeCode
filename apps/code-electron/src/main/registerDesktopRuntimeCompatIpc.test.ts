import { describe, expect, it, vi } from "vitest";
import {
  DESKTOP_RUNTIME_COMPAT_IPC_CHANNELS,
  registerDesktopRuntimeCompatIpc,
} from "./registerDesktopRuntimeCompatIpc.js";

function createCodexCommandMock() {
  return {
    exec: vi.fn(async () => ({ finalMessage: "codex done" })),
    probe: vi.fn(() => ({ available: true, version: "codex-cli 0.121.0" })),
  };
}

function registerForTest(isTrustedSender = true) {
  const handle = vi.fn();
  const codexCommand = createCodexCommandMock();
  registerDesktopRuntimeCompatIpc({
    codexCommand,
    ipcMain: { handle },
    isTrustedSender: () => isTrustedSender,
    nowMs: () => 42,
    workspaceRoot: "/repo",
  });
  return { codexCommand, handle };
}

describe("registerDesktopRuntimeCompatIpc", () => {
  it("registers the t3 runtime bridge channels used by the Electron renderer", async () => {
    const { handle } = registerForTest();

    expect(handle.mock.calls.map(([channel]) => channel).sort()).toEqual(
      [
        DESKTOP_RUNTIME_COMPAT_IPC_CHANNELS.ACTION_REQUIRED_SUBMIT_V2,
        DESKTOP_RUNTIME_COMPAT_IPC_CHANNELS.MODELS_POOL,
        DESKTOP_RUNTIME_COMPAT_IPC_CHANNELS.RUNTIME_BACKENDS_LIST,
        DESKTOP_RUNTIME_COMPAT_IPC_CHANNELS.TURN_INTERRUPT,
        DESKTOP_RUNTIME_COMPAT_IPC_CHANNELS.TURN_SEND,
      ].sort()
    );
  });

  it("returns provider-picker backend and model data without requiring a runtime gateway", async () => {
    const { handle } = registerForTest();
    const backendHandler = handle.mock.calls.find(
      ([channel]) => channel === DESKTOP_RUNTIME_COMPAT_IPC_CHANNELS.RUNTIME_BACKENDS_LIST
    )?.[1];
    const modelHandler = handle.mock.calls.find(
      ([channel]) => channel === DESKTOP_RUNTIME_COMPAT_IPC_CHANNELS.MODELS_POOL
    )?.[1];

    await expect(backendHandler?.({ sender: {} })).resolves.toEqual([
      expect.objectContaining({
        backendId: "local-codex-cli",
        capabilities: ["codex", "code"],
        readiness: expect.objectContaining({
          authState: "verified",
          state: "ready",
        }),
      }),
      expect.objectContaining({
        backendId: "local-claude-code-cli",
        capabilities: ["claude", "code"],
      }),
    ]);
    await expect(modelHandler?.({ sender: {} })).resolves.toEqual([
      expect.objectContaining({ id: "gpt-5.4", pool: "codex" }),
      expect.objectContaining({ id: "gpt-5.3-codex", pool: "codex" }),
      expect.objectContaining({ id: "claude-sonnet-4.5", pool: "claude" }),
      expect.objectContaining({ id: "claude-opus-4-6", pool: "claude" }),
    ]);
  });

  it("runs local Codex CLI for t3 composer launches routed to the Codex backend", async () => {
    const { codexCommand, handle } = registerForTest();
    const turnSendHandler = handle.mock.calls.find(
      ([channel]) => channel === DESKTOP_RUNTIME_COMPAT_IPC_CHANNELS.TURN_SEND
    )?.[1];

    await expect(
      turnSendHandler?.(
        { sender: {} },
        {
          payload: {
            accessMode: "read-only",
            content: "Explain this repo in one sentence.",
            modelId: "gpt-5.4",
            preferredBackendIds: ["local-codex-cli"],
            provider: "openai",
            threadId: "thread-1",
          },
        }
      )
    ).resolves.toEqual(
      expect.objectContaining({
        accepted: true,
        backendId: "local-codex-cli",
        routedModelId: "gpt-5.4",
        routedProvider: "openai",
        threadId: "thread-1",
        turnId: "electron-t3-compat-turn-42",
        message: "Local Codex CLI completed: codex done",
      })
    );
    expect(codexCommand.exec).toHaveBeenCalledWith({
      accessMode: "read-only",
      modelId: "gpt-5.4",
      prompt: "Explain this repo in one sentence.",
      workspaceRoot: "/repo",
    });
  });

  it("keeps non-Codex launches as compatibility acknowledgements", async () => {
    const { codexCommand, handle } = registerForTest();
    const turnSendHandler = handle.mock.calls.find(
      ([channel]) => channel === DESKTOP_RUNTIME_COMPAT_IPC_CHANNELS.TURN_SEND
    )?.[1];

    await expect(
      turnSendHandler?.(
        { sender: {} },
        {
          payload: {
            content: "Use Claude.",
            modelId: "claude-sonnet-4.5",
            preferredBackendIds: ["local-claude-code-cli"],
            provider: "anthropic",
            threadId: "thread-2",
          },
        }
      )
    ).resolves.toEqual(
      expect.objectContaining({
        accepted: true,
        backendId: "local-claude-code-cli",
        routedModelId: "claude-sonnet-4.5",
        routedProvider: "anthropic",
        threadId: "thread-2",
      })
    );
    expect(codexCommand.exec).not.toHaveBeenCalled();
  });

  it("blocks untrusted runtime IPC senders", async () => {
    const { handle } = registerForTest(false);
    const backendHandler = handle.mock.calls.find(
      ([channel]) => channel === DESKTOP_RUNTIME_COMPAT_IPC_CHANNELS.RUNTIME_BACKENDS_LIST
    )?.[1];

    await expect(backendHandler?.({ sender: {} })).rejects.toThrow(
      "Blocked untrusted desktop runtime IPC sender."
    );
  });
});
