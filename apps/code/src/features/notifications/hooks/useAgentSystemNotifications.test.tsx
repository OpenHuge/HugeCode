// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendNotification } from "../../../application/runtime/ports/desktopNotifications";
import { useAgentSystemNotifications } from "./useAgentSystemNotifications";

const useAppServerEventsMock = vi.fn();

vi.mock("../../../application/runtime/ports/desktopNotifications", () => ({
  sendNotification: vi.fn(),
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
  onWindowsSandboxSetupCompleted?: (
    workspaceId: string,
    payload: { mode: string; success: boolean; error: string | null }
  ) => void;
  onConfigWarning?: (
    workspaceId: string,
    payload: { summary: string; details: string | null; path: string | null }
  ) => void;
  onMcpServerOauthLoginCompleted?: (
    workspaceId: string,
    payload: { name: string; success: boolean; error: string | null }
  ) => void;
};

function getHandlers(): AgentSystemHandlers {
  const lastCall = useAppServerEventsMock.mock.calls[useAppServerEventsMock.mock.calls.length - 1];
  return (lastCall?.[0] ?? {}) as AgentSystemHandlers;
}

describe("useAgentSystemNotifications", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useAppServerEventsMock.mockReset();
    vi.mocked(sendNotification).mockReset();
    vi.mocked(sendNotification).mockResolvedValue();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("notifies model reroutes when notifications are enabled in background", async () => {
    renderHook(() =>
      useAgentSystemNotifications({
        enabled: true,
        isWindowFocused: false,
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

    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendNotification).mock.calls[0]?.[0]).toContain("Model rerouted");
    expect(vi.mocked(sendNotification).mock.calls[0]?.[2]).toMatchObject({
      extra: { type: "model_rerouted", workspaceId: "ws-1", threadId: "thread-1" },
    });
  });

  it("suppresses warning notifications while window is focused", async () => {
    renderHook(() =>
      useAgentSystemNotifications({
        enabled: true,
        isWindowFocused: true,
      })
    );

    const handlers = getHandlers();
    act(() => {
      handlers.onConfigWarning?.("ws-1", {
        summary: "Unknown key",
        details: "ignored",
        path: "/tmp/codex/config.toml",
      });
      handlers.onMcpServerOauthLoginCompleted?.("ws-1", {
        name: "github",
        success: false,
        error: "OAuth callback canceled",
      });
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("only notifies windows sandbox setup failures", async () => {
    renderHook(() =>
      useAgentSystemNotifications({
        enabled: true,
        isWindowFocused: false,
      })
    );

    const handlers = getHandlers();
    act(() => {
      handlers.onWindowsSandboxSetupCompleted?.("ws-1", {
        mode: "elevated",
        success: true,
        error: null,
      });
      handlers.onWindowsSandboxSetupCompleted?.("ws-1", {
        mode: "elevated",
        success: false,
        error: "missing privileges",
      });
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendNotification).mock.calls[0]?.[2]).toMatchObject({
      extra: { type: "windows_sandbox_setup_failed", workspaceId: "ws-1", mode: "elevated" },
    });
  });

  it("throttles duplicate config warnings within the minimum spacing window", async () => {
    renderHook(() =>
      useAgentSystemNotifications({
        enabled: true,
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

    expect(sendNotification).toHaveBeenCalledTimes(1);

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

    expect(sendNotification).toHaveBeenCalledTimes(2);
  });
});
