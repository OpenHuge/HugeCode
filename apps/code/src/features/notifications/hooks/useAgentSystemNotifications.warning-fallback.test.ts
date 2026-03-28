// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendNotification } from "../../../application/runtime/ports/desktopNotifications";
import { useAgentSystemNotifications } from "./useAgentSystemNotifications";

const useAppServerEventsMock = vi.fn();
const pushErrorToastMock = vi.hoisted(() => vi.fn());

vi.mock("../../../application/runtime/ports/desktopNotifications", () => ({
  sendNotification: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/toasts", () => ({
  pushErrorToast: (...args: unknown[]) => pushErrorToastMock(...args),
}));

vi.mock("../../app/hooks/useAppServerEvents", () => ({
  useAppServerEvents: (handlers: unknown) => useAppServerEventsMock(handlers),
}));

type AgentSystemHandlers = {
  onModelRerouted?: (
    workspaceId: string,
    payload: {
      threadId: string;
      turnId: string;
      fromModel: string;
      toModel: string;
      reason: string | null;
    }
  ) => void;
  onConfigWarning?: (
    workspaceId: string,
    payload: { summary: string; details: string | null; path: string | null }
  ) => void;
};

function getHandlers(): AgentSystemHandlers {
  const lastCall = useAppServerEventsMock.mock.calls[useAppServerEventsMock.mock.calls.length - 1];
  return (lastCall?.[0] ?? {}) as AgentSystemHandlers;
}

describe("useAgentSystemNotifications warning toast fallback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useAppServerEventsMock.mockReset();
    pushErrorToastMock.mockReset();
    vi.mocked(sendNotification).mockReset();
    vi.mocked(sendNotification).mockResolvedValue();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("pushes in-app warning toasts even when system notifications are disabled", async () => {
    renderHook(() =>
      useAgentSystemNotifications({
        enabled: false,
        isWindowFocused: false,
      })
    );

    const handlers = getHandlers();
    act(() => {
      handlers.onConfigWarning?.("ws-1", {
        summary: "Unknown key",
        details: "ignored",
        path: "/tmp/codex/config.toml",
      });
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(pushErrorToastMock).toHaveBeenCalledTimes(1);
    expect(pushErrorToastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Config warning",
        message: "Unknown key · /tmp/codex/config.toml",
      })
    );
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("pushes in-app warning toasts when window is focused", async () => {
    renderHook(() =>
      useAgentSystemNotifications({
        enabled: true,
        isWindowFocused: true,
      })
    );

    const handlers = getHandlers();
    act(() => {
      handlers.onModelRerouted?.("ws-1", {
        threadId: "thread-1",
        turnId: "turn-1",
        fromModel: "gpt-5",
        toModel: "gpt-5-mini",
        reason: "highRiskCyberActivity",
      });
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(pushErrorToastMock).toHaveBeenCalledTimes(1);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("keeps warning toast throttling aligned with notification throttling", async () => {
    renderHook(() =>
      useAgentSystemNotifications({
        enabled: false,
        isWindowFocused: false,
      })
    );

    const handlers = getHandlers();
    act(() => {
      handlers.onConfigWarning?.("ws-1", {
        summary: "Unknown key",
        details: null,
        path: "/tmp/codex/config.toml",
      });
      handlers.onConfigWarning?.("ws-1", {
        summary: "Unknown key",
        details: null,
        path: "/tmp/codex/config.toml",
      });
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(pushErrorToastMock).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1_600);
      handlers.onConfigWarning?.("ws-1", {
        summary: "Unknown key",
        details: null,
        path: "/tmp/codex/config.toml",
      });
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(pushErrorToastMock).toHaveBeenCalledTimes(2);
    expect(sendNotification).not.toHaveBeenCalled();
  });
});
