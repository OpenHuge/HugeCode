// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useWorkspaceUsageRefresh } from "./useWorkspaceUsageRefresh";

describe("useWorkspaceUsageRefresh", () => {
  it("allows refreshing current usage for the active workspace even when disconnected", async () => {
    const refreshAccountInfo = vi.fn().mockResolvedValue(undefined);
    const refreshAccountRateLimitsBatch = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useWorkspaceUsageRefresh({
        activeWorkspaceId: "ws-1",
        hasLoaded: true,
        workspaces: [
          {
            id: "ws-1",
            name: "Workspace 1",
            path: "/tmp/ws-1",
            connected: false,
            settings: {
              sidebarCollapsed: false,
            },
          },
        ],
        refreshAccountInfo,
        refreshAccountRateLimitsBatch,
      })
    );

    expect(result.current.canRefreshCurrentUsage).toBe(true);

    await act(async () => {
      result.current.handleRefreshCurrentUsage();
      await Promise.resolve();
    });

    expect(refreshAccountRateLimitsBatch).toHaveBeenCalledWith(["ws-1"]);
    expect(refreshAccountInfo).toHaveBeenCalledWith("ws-1");
  });
});
