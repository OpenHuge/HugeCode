// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { subscribeAppServerEvents } from "../../../application/runtime/ports/events";
import type { AppServerEvent } from "../../../types";
import { useAppServerEvents } from "./useAppServerEvents";

vi.mock("../../../application/runtime/ports/events", () => ({
  subscribeAppServerEvents: vi.fn(),
}));

type Handlers = Parameters<typeof useAppServerEvents>[0];

function TestHarness({ handlers }: { handlers: Handlers }) {
  useAppServerEvents(handlers);
  return null;
}

let listener: ((event: AppServerEvent) => void) | null = null;
const unlisten = vi.fn();

beforeEach(() => {
  listener = null;
  unlisten.mockReset();
  vi.mocked(subscribeAppServerEvents).mockImplementation((cb) => {
    listener = cb;
    return unlisten;
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

async function mount(handlers: Handlers) {
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(TestHarness, { handlers }));
  });
  return { root };
}

describe("useAppServerEvents legacy notification method compatibility", () => {
  it("maps authStatusChange to account updated handler", async () => {
    const handlers: Handlers = {
      onAccountUpdated: vi.fn(),
    };
    const { root } = await mount(handlers);

    act(() => {
      listener?.({
        workspace_id: "ws-1",
        message: {
          method: "authStatusChange",
          params: { authMethod: "apikey" },
        },
      });
    });

    expect(handlers.onAccountUpdated).toHaveBeenCalledWith("ws-1", "apikey");

    await act(async () => {
      root.unmount();
    });
  });

  it("routes sessionConfigured payloads to handler", async () => {
    const handlers: Handlers = {
      onSessionConfigured: vi.fn(),
    };
    const { root } = await mount(handlers);

    act(() => {
      listener?.({
        workspace_id: "ws-1",
        message: {
          method: "sessionConfigured",
          params: {
            sessionId: "thread-7",
            model: "gpt-5.2-codex",
            reasoningEffort: "high",
            historyLogId: "123456",
            historyEntryCount: 42,
            initialMessages: [{ type: "message", role: "assistant" }],
            rolloutPath: "/tmp/rollout.jsonl",
          },
        },
      });
    });

    expect(handlers.onSessionConfigured).toHaveBeenCalledWith("ws-1", {
      sessionId: "thread-7",
      model: "gpt-5.2-codex",
      reasoningEffort: "high",
      historyLogId: "123456",
      historyEntryCount: 42,
      initialMessages: [{ type: "message", role: "assistant" }],
      rolloutPath: "/tmp/rollout.jsonl",
    });

    await act(async () => {
      root.unmount();
    });
  });
});
