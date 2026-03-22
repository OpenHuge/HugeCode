// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSharedAccountCenterState } from "@ku0/code-workspace-client";
import { useAccountCenterState } from "./useAccountCenterState";

vi.mock("@ku0/code-workspace-client", () => ({
  useSharedAccountCenterState: vi.fn(() => ({
    loading: false,
    error: null,
    codex: {
      defaultPoolName: null,
      defaultRouteAccountId: null,
      defaultRouteAccountLabel: "No default route account",
      connectedAccounts: [],
      defaultRouteBusyAccountId: null,
      reauthenticatingAccountId: null,
    },
    providers: [],
    workspaceAccounts: [],
    refresh: vi.fn(async () => undefined),
    setCodexDefaultRouteAccount: vi.fn(),
    reauthenticateCodexAccount: vi.fn(),
  })),
}));

const useSharedAccountCenterStateMock = vi.mocked(useSharedAccountCenterState);

describe("useAccountCenterState", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("delegates state to the shared account-center hook", async () => {
    const { result } = renderHook(() => useAccountCenterState());

    await waitFor(() => {
      expect(useSharedAccountCenterStateMock).toHaveBeenCalledTimes(1);
      expect(result.current.codex.defaultRouteAccountLabel).toBe("No default route account");
    });
  });

  it("omits refresh from the shared account-center hook result", () => {
    const { result } = renderHook(() => useAccountCenterState());

    expect("refresh" in result.current).toBe(false);
  });
});
