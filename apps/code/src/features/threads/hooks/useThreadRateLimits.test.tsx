// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAccountRateLimits } from "../../../application/runtime/ports/threads";
import { normalizeRateLimits } from "../utils/threadNormalize";
import { useThreadRateLimits } from "./useThreadRateLimits";

vi.mock("../../../application/runtime/ports/threads", () => ({
  getAccountRateLimits: vi.fn(),
}));

describe("useThreadRateLimits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refreshes rate limits on connect and dispatches normalized data", async () => {
    const dispatch = vi.fn();
    const onDebug = vi.fn();
    const rawRateLimits = {
      primary: {
        used_percent: "25",
        window_duration_mins: 60,
        resets_at: 12345,
      },
    };

    vi.mocked(getAccountRateLimits).mockResolvedValue({
      result: { rate_limits: rawRateLimits },
    });

    renderHook(() =>
      useThreadRateLimits({
        activeWorkspaceId: "ws-1",
        activeWorkspaceConnected: true,
        dispatch,
        onDebug,
      })
    );

    await waitFor(() => {
      expect(getAccountRateLimits).toHaveBeenCalledWith("ws-1");
    });

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith({
        type: "setRateLimits",
        workspaceId: "ws-1",
        rateLimits: normalizeRateLimits(rawRateLimits),
      });
    });

    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "client",
        label: "account/rateLimits/read",
        payload: { workspaceId: "ws-1" },
      })
    );
    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "server",
        label: "account/rateLimits/read response",
        payload: { result: { rate_limits: rawRateLimits } },
      })
    );
  });

  it("refreshes rate limits for the active workspace even when it is not connected", async () => {
    const dispatch = vi.fn();
    vi.mocked(getAccountRateLimits).mockResolvedValue({
      result: {
        rate_limits: {
          primary: { usedPercent: 25 },
        },
      },
    });

    renderHook(() =>
      useThreadRateLimits({
        activeWorkspaceId: "ws-1",
        activeWorkspaceConnected: false,
        dispatch,
      })
    );

    await waitFor(() => {
      expect(getAccountRateLimits).toHaveBeenCalledWith("ws-1");
    });
  });

  it("allows manual refresh with an explicit workspace id", async () => {
    const dispatch = vi.fn();
    const rawRateLimits = {
      primary: { usedPercent: 10, windowDurationMins: 30, resetsAt: 777 },
    };

    vi.mocked(getAccountRateLimits).mockResolvedValue({
      rateLimits: rawRateLimits,
    });

    const { result } = renderHook(() =>
      useThreadRateLimits({
        activeWorkspaceId: "ws-1",
        activeWorkspaceConnected: false,
        dispatch,
      })
    );

    await act(async () => {
      await result.current.refreshAccountRateLimits("ws-2");
    });

    expect(getAccountRateLimits).toHaveBeenCalledWith("ws-2");
    expect(dispatch).toHaveBeenCalledWith({
      type: "setRateLimits",
      workspaceId: "ws-2",
      rateLimits: normalizeRateLimits(rawRateLimits),
    });
  });

  it("merges fetched payloads with the current snapshot when provided", async () => {
    const dispatch = vi.fn();
    const previousRateLimits = {
      primary: { usedPercent: 20, windowDurationMins: 60, resetsAt: 111 },
      secondary: { usedPercent: 5, windowDurationMins: 30, resetsAt: 222 },
      credits: { hasCredits: true, unlimited: false, balance: "12.00" },
      planType: "pro",
    };
    const rawRateLimits = {
      primary: { remaining_percent: 30 },
      credits: { balance: "9.50" },
    };

    vi.mocked(getAccountRateLimits).mockResolvedValue({
      rateLimits: rawRateLimits,
    });

    const { result } = renderHook(() =>
      useThreadRateLimits({
        activeWorkspaceId: "ws-1",
        activeWorkspaceConnected: false,
        getCurrentRateLimits: (workspaceId) => (workspaceId === "ws-1" ? previousRateLimits : null),
        dispatch,
      })
    );

    await act(async () => {
      await result.current.refreshAccountRateLimits("ws-1");
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "setRateLimits",
      workspaceId: "ws-1",
      rateLimits: normalizeRateLimits(rawRateLimits, previousRateLimits),
    });
  });

  it("prefers codex bucket from rate_limits_by_limit_id responses", async () => {
    const dispatch = vi.fn();
    const codexRateLimits = {
      primary: { usedPercent: 58, windowDurationMins: 60, resetsAt: 321 },
      planType: "pro",
      limit_id: "codex",
      limit_name: "Codex",
    };
    vi.mocked(getAccountRateLimits).mockResolvedValue({
      result: {
        rate_limits_by_limit_id: {
          claude: {
            primary: { usedPercent: 12 },
            planType: "team",
            limit_id: "claude",
            limit_name: "Claude",
          },
          codex: codexRateLimits,
        },
      },
    });

    const { result } = renderHook(() =>
      useThreadRateLimits({
        activeWorkspaceId: "ws-1",
        activeWorkspaceConnected: false,
        dispatch,
      })
    );

    await act(async () => {
      await result.current.refreshAccountRateLimits("ws-1");
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "setRateLimits",
      workspaceId: "ws-1",
      rateLimits: normalizeRateLimits({
        ...codexRateLimits,
        limitId: "codex",
        limitName: "Codex",
      }),
    });
  });

  it("reports errors via debug callback without dispatching", async () => {
    const dispatch = vi.fn();
    const onDebug = vi.fn();

    vi.mocked(getAccountRateLimits).mockRejectedValue(new Error("Nope"));

    const { result } = renderHook(() =>
      useThreadRateLimits({
        activeWorkspaceId: "ws-1",
        dispatch,
        onDebug,
      })
    );

    await act(async () => {
      await result.current.refreshAccountRateLimits();
    });

    expect(dispatch).not.toHaveBeenCalled();
    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "error",
        label: "account/rateLimits/read error",
        payload: "Nope",
      })
    );
  });

  it("dedupes concurrent refresh requests for the same workspace", async () => {
    const dispatch = vi.fn();
    let resolveRefresh: (value: {
      rateLimits: { primary: { usedPercent: number } };
    }) => void = () => {
      throw new Error("Expected refresh resolver to be initialized.");
    };
    vi.mocked(getAccountRateLimits).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        })
    );

    const { result } = renderHook(() =>
      useThreadRateLimits({
        activeWorkspaceId: "ws-1",
        activeWorkspaceConnected: false,
        dispatch,
      })
    );

    const first = result.current.refreshAccountRateLimits("ws-1");
    const second = result.current.refreshAccountRateLimits("ws-1");

    expect(getAccountRateLimits).toHaveBeenCalledTimes(1);

    resolveRefresh({ rateLimits: { primary: { usedPercent: 32 } } });

    await act(async () => {
      await Promise.all([first, second]);
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("supports batch refresh for multiple workspaces", async () => {
    const dispatch = vi.fn();
    vi.mocked(getAccountRateLimits).mockResolvedValue({
      rateLimits: {
        primary: { usedPercent: 40 },
      },
    });

    const { result } = renderHook(() =>
      useThreadRateLimits({
        activeWorkspaceId: "ws-1",
        activeWorkspaceConnected: false,
        dispatch,
      })
    );

    await act(async () => {
      await result.current.refreshAccountRateLimitsBatch(["ws-1", "ws-2", "ws-1"]);
    });

    expect(getAccountRateLimits).toHaveBeenCalledTimes(2);
    expect(getAccountRateLimits).toHaveBeenCalledWith("ws-1");
    expect(getAccountRateLimits).toHaveBeenCalledWith("ws-2");
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it("normalizes raw wham usage payload responses", async () => {
    const dispatch = vi.fn();
    vi.mocked(getAccountRateLimits).mockResolvedValue({
      plan_type: "pro",
      rate_limit: {
        primary_window: {
          used_percent: 44,
          reset_at: 1_735_401_600,
          limit_window_seconds: 18_000,
        },
        secondary_window: {
          used_percent: 11,
          reset_at: 1_735_920_000,
          limit_window_seconds: 604_800,
        },
      },
      credits: {
        has_credits: true,
        unlimited: false,
        balance: 120.5,
      },
    });

    const { result } = renderHook(() =>
      useThreadRateLimits({
        activeWorkspaceId: "ws-1",
        activeWorkspaceConnected: false,
        dispatch,
      })
    );

    await act(async () => {
      await result.current.refreshAccountRateLimits("ws-1");
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "setRateLimits",
      workspaceId: "ws-1",
      rateLimits: normalizeRateLimits({
        primary: {
          usedPercent: 44,
          resetsAt: 1_735_401_600_000,
          windowDurationMins: 300,
        },
        secondary: {
          usedPercent: 11,
          resetsAt: 1_735_920_000_000,
          windowDurationMins: 10_080,
        },
        credits: {
          hasCredits: true,
          unlimited: false,
          balance: "120.5",
        },
        planType: "pro",
      }),
    });
  });
});
