// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAccountInfo } from "../../../application/runtime/ports/tauriThreads";
import { useThreadAccountInfo } from "./useThreadAccountInfo";

vi.mock("../../../application/runtime/ports/tauriThreads", () => ({
  getAccountInfo: vi.fn(),
}));

describe("useThreadAccountInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refreshes account info on connect and dispatches snapshot", async () => {
    vi.mocked(getAccountInfo).mockResolvedValue({
      result: {
        account: {
          type: "chatgpt",
          email: "user@example.com",
          planType: "pro",
          provider: "codex",
          accountId: "codex-account-1",
          externalAccountId: "sample-handle",
          displayName: "Primary Codex",
          defaultChatgptWorkspaceTitle: "MarcosSauerkraoqpq",
          authMode: "chatgpt",
          localCliManaged: false,
        },
        requiresOpenaiAuth: false,
      },
    });

    const dispatch = vi.fn();

    renderHook(() =>
      useThreadAccountInfo({
        activeWorkspaceId: "ws-1",
        activeWorkspaceConnected: true,
        dispatch,
      })
    );

    await waitFor(() => {
      expect(getAccountInfo).toHaveBeenCalledWith("ws-1");
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "setAccountInfo",
      workspaceId: "ws-1",
      account: {
        type: "chatgpt",
        email: "user@example.com",
        planType: "pro",
        requiresOpenaiAuth: false,
        provider: "codex",
        accountId: "codex-account-1",
        externalAccountId: "sample-handle",
        displayName: "Primary Codex",
        defaultChatgptWorkspaceTitle: "MarcosSauerkraoqpq",
        authMode: "chatgpt",
        localCliManaged: false,
      },
    });
  });

  it("refreshes account info for the active workspace even when it is not connected", async () => {
    vi.mocked(getAccountInfo).mockResolvedValue({
      result: {
        account: { type: "chatgpt", email: "user@example.com", planType: "pro" },
        requiresOpenaiAuth: false,
      },
    });

    const dispatch = vi.fn();

    renderHook(() =>
      useThreadAccountInfo({
        activeWorkspaceId: "ws-1",
        activeWorkspaceConnected: false,
        dispatch,
      })
    );

    await waitFor(() => {
      expect(getAccountInfo).toHaveBeenCalledWith("ws-1");
    });
  });
});
