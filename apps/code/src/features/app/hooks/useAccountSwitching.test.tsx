// @vitest-environment jsdom

import { openUrl } from "@tauri-apps/plugin-opener";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { subscribeAppServerEvents } from "../../../application/runtime/ports/events";
import {
  subscribeScopedRuntimeUpdatedEvents,
  type RuntimeUpdatedEvent,
} from "../../../application/runtime/ports/runtimeUpdatedEvents";
import {
  bindOAuthPoolAccount,
  cancelCodexLogin,
  runCodexLogin,
  type OAuthAccountSummary,
} from "../../../application/runtime/ports/tauriOauth";
import type { AccountSnapshot, AppServerEvent } from "../../../types";
import { useAccountSwitching } from "./useAccountSwitching";

vi.mock("../../../application/runtime/ports/tauriOauth", () => ({
  bindOAuthPoolAccount: vi.fn(),
  runCodexLogin: vi.fn(),
  cancelCodexLogin: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/events", () => ({
  subscribeAppServerEvents: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/runtimeUpdatedEvents", () => ({
  subscribeScopedRuntimeUpdatedEvents: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
}));

type Handlers = Parameters<typeof useAccountSwitching>[0];
type HookResult = ReturnType<typeof useAccountSwitching>;

function Harness(props: Handlers & { onChange: (value: HookResult) => void }) {
  const result = useAccountSwitching(props);
  props.onChange(result);
  return null;
}

let listener: ((event: AppServerEvent) => void) | null = null;
let runtimeUpdatedListener: ((event: RuntimeUpdatedEvent) => void) | null = null;
const unlisten = vi.fn();
let latest: HookResult | null = null;

beforeEach(() => {
  listener = null;
  runtimeUpdatedListener = null;
  latest = null;
  unlisten.mockReset();
  vi.mocked(bindOAuthPoolAccount).mockReset();
  vi.mocked(subscribeAppServerEvents).mockImplementation((cb) => {
    listener = cb;
    return unlisten;
  });
  vi.mocked(subscribeScopedRuntimeUpdatedEvents).mockImplementation((_options, cb) => {
    runtimeUpdatedListener = cb;
    return unlisten;
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

async function mount(props: Handlers) {
  const container = document.createElement("div");
  const root = createRoot(container);
  const render = async (nextProps: Handlers) => {
    await act(async () => {
      root.render(
        <Harness
          {...nextProps}
          onChange={(value) => {
            latest = value;
          }}
        />
      );
    });
  };
  await render(props);
  return { root, render };
}

function makeAccount(): AccountSnapshot {
  return {
    type: "chatgpt",
    email: "user@example.com",
    planType: "pro",
    requiresOpenaiAuth: true,
  };
}

function emitRuntimeUpdatedOauth(params: Record<string, unknown>, workspaceId = "ws-1") {
  runtimeUpdatedListener?.({
    event: {
      workspace_id: workspaceId,
      message: {
        method: "runtime/updated",
        params,
      },
    },
    params,
    scope: Array.isArray(params.scope)
      ? params.scope.filter((entry): entry is string => typeof entry === "string")
      : [],
    reason: typeof params.reason === "string" ? params.reason : "",
    eventWorkspaceId: workspaceId,
    paramsWorkspaceId: null,
    isWorkspaceLocalEvent: workspaceId === "workspace-local",
  });
}

describe("useAccountSwitching", () => {
  it("binds a logged-in Codex account to the active project workspace", async () => {
    const account: OAuthAccountSummary = {
      accountId: "codex-a2",
      provider: "codex",
      externalAccountId: null,
      email: null,
      displayName: "Codex A2",
      status: "enabled",
      disabledReason: null,
      routeConfig: null,
      routingState: null,
      chatgptWorkspaces: null,
      defaultChatgptWorkspaceId: null,
      metadata: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    vi.mocked(bindOAuthPoolAccount).mockResolvedValue({
      poolId: "pool-codex",
      account,
      reason: "manual_binding",
    });

    const refreshAccountInfo = vi.fn();
    const refreshAccountRateLimits = vi.fn();
    const alertError = vi.fn();

    const { root } = await mount({
      activeWorkspaceId: "ws-1",
      accountByWorkspace: { "ws-1": makeAccount() },
      refreshAccountInfo,
      refreshAccountRateLimits,
      alertError,
    });

    await act(async () => {
      await latest?.handleSelectLoggedInCodexAccount("codex-a2");
    });

    expect(bindOAuthPoolAccount).toHaveBeenCalledWith({
      poolId: "pool-codex",
      sessionId: "ws-1",
      accountId: "codex-a2",
    });
    expect(refreshAccountInfo).toHaveBeenCalledWith("ws-1");
    expect(refreshAccountRateLimits).toHaveBeenCalledWith("ws-1");
    expect(alertError).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });

  it("uses fallback workspace account when no active workspace is selected", async () => {
    const refreshAccountInfo = vi.fn();
    const refreshAccountRateLimits = vi.fn();
    const alertError = vi.fn();

    const { root } = await mount({
      activeWorkspaceId: null,
      fallbackWorkspaceId: "ws-1",
      accountByWorkspace: { "ws-1": makeAccount() },
      refreshAccountInfo,
      refreshAccountRateLimits,
      alertError,
    });

    expect(latest?.activeAccount?.email).toBe("user@example.com");
    expect(refreshAccountInfo).not.toHaveBeenCalled();
    expect(refreshAccountRateLimits).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });

  it("refreshes fallback workspace account on home when no account snapshot exists", async () => {
    const refreshAccountInfo = vi.fn();
    const refreshAccountRateLimits = vi.fn();
    const alertError = vi.fn();

    const { root } = await mount({
      activeWorkspaceId: null,
      fallbackWorkspaceId: "ws-1",
      accountByWorkspace: {},
      refreshAccountInfo,
      refreshAccountRateLimits,
      alertError,
    });

    expect(refreshAccountInfo).toHaveBeenCalledWith("ws-1");
    expect(refreshAccountRateLimits).toHaveBeenCalledWith("ws-1");
    expect(refreshAccountInfo).toHaveBeenCalledTimes(1);
    expect(refreshAccountRateLimits).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it("starts account switching from fallback workspace when active workspace is null", async () => {
    vi.mocked(runCodexLogin).mockResolvedValue({
      loginId: "login-fallback-workspace",
      authUrl: "https://example.com/auth-fallback-workspace",
    });

    const refreshAccountInfo = vi.fn();
    const refreshAccountRateLimits = vi.fn();
    const alertError = vi.fn();

    const { root } = await mount({
      activeWorkspaceId: null,
      fallbackWorkspaceId: "ws-1",
      accountByWorkspace: { "ws-1": makeAccount() },
      refreshAccountInfo,
      refreshAccountRateLimits,
      alertError,
    });

    await act(async () => {
      await latest?.handleSwitchAccount();
    });

    expect(runCodexLogin).toHaveBeenCalledWith("ws-1", { forceOAuth: true });

    await act(async () => {
      root.unmount();
    });
  });

  it("opens the auth URL and refreshes after account/login/completed", async () => {
    vi.mocked(runCodexLogin).mockResolvedValue({
      loginId: "login-1",
      authUrl: "https://example.com/auth",
    });

    const refreshAccountInfo = vi.fn();
    const refreshAccountRateLimits = vi.fn();
    const alertError = vi.fn();

    const { root } = await mount({
      activeWorkspaceId: "ws-1",
      accountByWorkspace: { "ws-1": makeAccount() },
      refreshAccountInfo,
      refreshAccountRateLimits,
      alertError,
    });

    expect(listener).toBeTypeOf("function");

    await act(async () => {
      await latest?.handleSwitchAccount();
    });

    expect(runCodexLogin).toHaveBeenCalledWith("ws-1", { forceOAuth: true });
    expect(openUrl).toHaveBeenCalledWith("https://example.com/auth");
    expect(refreshAccountInfo).not.toHaveBeenCalled();
    expect(refreshAccountRateLimits).not.toHaveBeenCalled();
    expect(latest?.accountSwitching).toBe(true);

    act(() => {
      listener?.({
        workspace_id: "ws-1",
        message: {
          method: "account/login/completed",
          params: { loginId: "login-1", success: true, error: null },
        },
      });
    });

    expect(refreshAccountInfo).toHaveBeenCalledWith("ws-1");
    expect(refreshAccountRateLimits).toHaveBeenCalledWith("ws-1");
    expect(alertError).not.toHaveBeenCalled();
    expect(latest?.accountSwitching).toBe(false);

    await act(async () => {
      root.unmount();
    });
    expect(unlisten).toHaveBeenCalledTimes(2);
  });

  it("falls back to window.open when openUrl fails", async () => {
    vi.mocked(runCodexLogin).mockResolvedValue({
      loginId: "login-fallback",
      authUrl: "https://example.com/fallback-auth",
    });
    vi.mocked(openUrl).mockRejectedValueOnce(new Error("openUrl unavailable"));
    const openSpy = vi
      .spyOn(window, "open")
      .mockReturnValue({ closed: false } as unknown as Window);

    const refreshAccountInfo = vi.fn();
    const refreshAccountRateLimits = vi.fn();
    const alertError = vi.fn();

    const { root } = await mount({
      activeWorkspaceId: "ws-1",
      accountByWorkspace: { "ws-1": makeAccount() },
      refreshAccountInfo,
      refreshAccountRateLimits,
      alertError,
    });

    await act(async () => {
      await latest?.handleSwitchAccount();
    });

    expect(openUrl).toHaveBeenCalledWith("https://example.com/fallback-auth");
    expect(openSpy).toHaveBeenCalledWith(
      "https://example.com/fallback-auth",
      "_blank",
      "noopener,noreferrer"
    );
    expect(alertError).not.toHaveBeenCalled();
    expect(latest?.accountSwitching).toBe(true);

    await act(async () => {
      root.unmount();
    });
    openSpy.mockRestore();
  });

  it("refreshes immediately for web local login flows", async () => {
    vi.mocked(runCodexLogin).mockResolvedValue({
      loginId: "login-local-1",
      authUrl: "",
      immediateSuccess: true,
    });

    const refreshAccountInfo = vi.fn();
    const refreshAccountRateLimits = vi.fn();
    const alertError = vi.fn();

    const { root } = await mount({
      activeWorkspaceId: "ws-1",
      accountByWorkspace: { "ws-1": makeAccount() },
      refreshAccountInfo,
      refreshAccountRateLimits,
      alertError,
    });

    await act(async () => {
      await latest?.handleSwitchAccount();
    });

    expect(runCodexLogin).toHaveBeenCalledWith("ws-1", { forceOAuth: true });
    expect(openUrl).not.toHaveBeenCalled();
    expect(refreshAccountInfo).toHaveBeenCalledWith("ws-1");
    expect(refreshAccountRateLimits).toHaveBeenCalledWith("ws-1");
    expect(alertError).not.toHaveBeenCalled();
    expect(latest?.accountSwitching).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });

  it("cancels and ignores a failed completion event", async () => {
    vi.mocked(runCodexLogin).mockResolvedValue({
      loginId: "login-2",
      authUrl: "https://example.com/auth-2",
    });
    vi.mocked(cancelCodexLogin).mockResolvedValue({ canceled: true, status: "canceled" });

    const refreshAccountInfo = vi.fn();
    const refreshAccountRateLimits = vi.fn();
    const alertError = vi.fn();

    const { root } = await mount({
      activeWorkspaceId: "ws-1",
      accountByWorkspace: { "ws-1": makeAccount() },
      refreshAccountInfo,
      refreshAccountRateLimits,
      alertError,
    });

    await act(async () => {
      await latest?.handleSwitchAccount();
    });
    expect(latest?.accountSwitching).toBe(true);

    await act(async () => {
      await latest?.handleCancelSwitchAccount();
    });
    expect(cancelCodexLogin).toHaveBeenCalledWith("ws-1");
    expect(latest?.accountSwitching).toBe(false);

    act(() => {
      listener?.({
        workspace_id: "ws-1",
        message: {
          method: "account/login/completed",
          params: { loginId: "login-2", success: false, error: "boom" },
        },
      });
    });

    expect(refreshAccountInfo).not.toHaveBeenCalled();
    expect(refreshAccountRateLimits).not.toHaveBeenCalled();
    expect(alertError).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });

  it("does not open the auth URL when canceled while login is pending", async () => {
    let resolveLogin: ((value: { loginId: string; authUrl: string }) => void) | null = null;
    vi.mocked(runCodexLogin).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        })
    );
    vi.mocked(cancelCodexLogin).mockResolvedValue({ canceled: true, status: "canceled" });

    const refreshAccountInfo = vi.fn();
    const refreshAccountRateLimits = vi.fn();
    const alertError = vi.fn();

    const { root } = await mount({
      activeWorkspaceId: "ws-1",
      accountByWorkspace: { "ws-1": makeAccount() },
      refreshAccountInfo,
      refreshAccountRateLimits,
      alertError,
    });

    await act(async () => {
      void latest?.handleSwitchAccount();
    });
    expect(latest?.accountSwitching).toBe(true);

    await act(async () => {
      await latest?.handleCancelSwitchAccount();
    });
    expect(latest?.accountSwitching).toBe(false);

    await act(async () => {
      resolveLogin?.({ loginId: "login-pending", authUrl: "https://example.com/pending" });
      await Promise.resolve();
    });

    expect(openUrl).not.toHaveBeenCalled();
    expect(cancelCodexLogin).toHaveBeenCalledWith("ws-1");
    expect(refreshAccountInfo).not.toHaveBeenCalled();
    expect(refreshAccountRateLimits).not.toHaveBeenCalled();
    expect(alertError).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });

  it("resets switching state when login fails with a cancellation-shaped error", async () => {
    vi.mocked(runCodexLogin).mockRejectedValue(new Error("request canceled"));

    const refreshAccountInfo = vi.fn();
    const refreshAccountRateLimits = vi.fn();
    const alertError = vi.fn();

    const { root } = await mount({
      activeWorkspaceId: "ws-1",
      accountByWorkspace: { "ws-1": makeAccount() },
      refreshAccountInfo,
      refreshAccountRateLimits,
      alertError,
    });

    await act(async () => {
      await latest?.handleSwitchAccount();
    });

    expect(latest?.accountSwitching).toBe(false);
    expect(alertError).not.toHaveBeenCalled();
    expect(openUrl).not.toHaveBeenCalled();
    expect(cancelCodexLogin).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });

  it("clears switching state on workspace change and still completes the original login", async () => {
    vi.mocked(runCodexLogin).mockResolvedValue({
      loginId: "login-ws-1",
      authUrl: "https://example.com/ws-1",
    });

    const refreshAccountInfo = vi.fn();
    const refreshAccountRateLimits = vi.fn();
    const alertError = vi.fn();

    const { root, render } = await mount({
      activeWorkspaceId: "ws-1",
      accountByWorkspace: { "ws-1": makeAccount() },
      refreshAccountInfo,
      refreshAccountRateLimits,
      alertError,
    });

    await act(async () => {
      await latest?.handleSwitchAccount();
    });
    expect(latest?.accountSwitching).toBe(true);

    await render({
      activeWorkspaceId: "ws-2",
      accountByWorkspace: { "ws-1": makeAccount(), "ws-2": makeAccount() },
      refreshAccountInfo,
      refreshAccountRateLimits,
      alertError,
    });
    expect(latest?.accountSwitching).toBe(false);

    act(() => {
      listener?.({
        workspace_id: "ws-1",
        message: {
          method: "account/login/completed",
          params: { loginId: "login-ws-1", success: true, error: null },
        },
      });
    });

    expect(refreshAccountInfo).toHaveBeenCalledWith("ws-1");
    expect(refreshAccountRateLimits).toHaveBeenCalledWith("ws-1");
    expect(alertError).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });

  it("treats runtime/updated oauth scope as account refresh completion", async () => {
    vi.mocked(runCodexLogin).mockResolvedValue({
      loginId: "login-oauth-runtime",
      authUrl: "https://example.com/oauth-runtime",
    });

    const refreshAccountInfo = vi.fn();
    const refreshAccountRateLimits = vi.fn();
    const alertError = vi.fn();

    const { root } = await mount({
      activeWorkspaceId: "ws-1",
      accountByWorkspace: { "ws-1": makeAccount() },
      refreshAccountInfo,
      refreshAccountRateLimits,
      alertError,
    });

    await act(async () => {
      await latest?.handleSwitchAccount();
    });
    expect(latest?.accountSwitching).toBe(true);

    act(() => {
      emitRuntimeUpdatedOauth({
        revision: "72",
        scope: ["oauth", "bootstrap"],
        reason: "code_oauth_pool_upsert",
      });
    });

    expect(refreshAccountInfo).toHaveBeenCalledWith("ws-1");
    expect(refreshAccountRateLimits).toHaveBeenCalledWith("ws-1");
    expect(alertError).not.toHaveBeenCalled();
    expect(latest?.accountSwitching).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });

  it("treats workspace-local runtime/updated oauth scope as account refresh completion", async () => {
    vi.mocked(runCodexLogin).mockResolvedValue({
      loginId: "login-oauth-runtime-local",
      authUrl: "https://example.com/oauth-runtime-local",
    });

    const refreshAccountInfo = vi.fn();
    const refreshAccountRateLimits = vi.fn();
    const alertError = vi.fn();

    const { root } = await mount({
      activeWorkspaceId: "ws-1",
      accountByWorkspace: { "ws-1": makeAccount() },
      refreshAccountInfo,
      refreshAccountRateLimits,
      alertError,
    });

    await act(async () => {
      await latest?.handleSwitchAccount();
    });
    expect(latest?.accountSwitching).toBe(true);

    act(() => {
      emitRuntimeUpdatedOauth(
        {
          revision: "72-local",
          scope: ["oauth", "bootstrap"],
          reason: "code_oauth_pool_upsert",
        },
        "workspace-local"
      );
    });

    expect(refreshAccountInfo).toHaveBeenCalledWith("ws-1");
    expect(refreshAccountRateLimits).toHaveBeenCalledWith("ws-1");
    expect(alertError).not.toHaveBeenCalled();
    expect(latest?.accountSwitching).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });

  it("ignores stream_reconnected runtime/updated while login is still in-flight", async () => {
    vi.mocked(runCodexLogin).mockResolvedValue({
      loginId: "login-oauth-runtime-reconnect",
      authUrl: "https://example.com/oauth-runtime-reconnect",
    });

    const refreshAccountInfo = vi.fn();
    const refreshAccountRateLimits = vi.fn();
    const alertError = vi.fn();

    const { root } = await mount({
      activeWorkspaceId: "ws-1",
      accountByWorkspace: { "ws-1": makeAccount() },
      refreshAccountInfo,
      refreshAccountRateLimits,
      alertError,
    });

    await act(async () => {
      await latest?.handleSwitchAccount();
    });
    expect(latest?.accountSwitching).toBe(true);

    act(() => {
      emitRuntimeUpdatedOauth(
        {
          revision: "72-reconnect",
          scope: ["oauth", "bootstrap"],
          reason: "stream_reconnected",
        },
        "workspace-local"
      );
    });

    expect(refreshAccountInfo).not.toHaveBeenCalled();
    expect(refreshAccountRateLimits).not.toHaveBeenCalled();
    expect(alertError).not.toHaveBeenCalled();
    expect(latest?.accountSwitching).toBe(true);

    await act(async () => {
      root.unmount();
    });
  });

  it("ignores runtime/updated oauth events for a different login id", async () => {
    vi.mocked(runCodexLogin).mockResolvedValue({
      loginId: "login-oauth-current",
      authUrl: "https://example.com/oauth-runtime-current",
    });

    const refreshAccountInfo = vi.fn();
    const refreshAccountRateLimits = vi.fn();
    const alertError = vi.fn();

    const { root } = await mount({
      activeWorkspaceId: "ws-1",
      accountByWorkspace: { "ws-1": makeAccount() },
      refreshAccountInfo,
      refreshAccountRateLimits,
      alertError,
    });

    await act(async () => {
      await latest?.handleSwitchAccount();
    });
    expect(latest?.accountSwitching).toBe(true);

    act(() => {
      emitRuntimeUpdatedOauth({
        revision: "74",
        scope: ["oauth", "bootstrap"],
        reason: "oauth_codex_login_completed",
        oauthLoginSuccess: true,
        oauthLoginId: "login-oauth-other",
      });
    });

    expect(refreshAccountInfo).not.toHaveBeenCalled();
    expect(refreshAccountRateLimits).not.toHaveBeenCalled();
    expect(alertError).not.toHaveBeenCalled();
    expect(latest?.accountSwitching).toBe(true);

    act(() => {
      emitRuntimeUpdatedOauth({
        revision: "75",
        scope: ["oauth", "bootstrap"],
        reason: "oauth_codex_login_completed",
        oauthLoginSuccess: true,
        oauthLoginId: "login-oauth-current",
      });
    });

    expect(refreshAccountInfo).toHaveBeenCalledWith("ws-1");
    expect(refreshAccountRateLimits).toHaveBeenCalledWith("ws-1");
    expect(alertError).not.toHaveBeenCalled();
    expect(latest?.accountSwitching).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });

  it("surfaces runtime/updated oauth login failures without refreshing account data", async () => {
    vi.mocked(runCodexLogin).mockResolvedValue({
      loginId: "login-oauth-failed",
      authUrl: "https://example.com/oauth-runtime-failed",
    });

    const refreshAccountInfo = vi.fn();
    const refreshAccountRateLimits = vi.fn();
    const alertError = vi.fn();

    const { root } = await mount({
      activeWorkspaceId: "ws-1",
      accountByWorkspace: { "ws-1": makeAccount() },
      refreshAccountInfo,
      refreshAccountRateLimits,
      alertError,
    });

    await act(async () => {
      await latest?.handleSwitchAccount();
    });
    expect(latest?.accountSwitching).toBe(true);

    act(() => {
      emitRuntimeUpdatedOauth({
        revision: "73",
        scope: ["oauth", "bootstrap"],
        reason: "oauth_codex_login_failed",
        oauthLoginSuccess: false,
        oauthLoginId: "login-oauth-failed",
        oauthLoginError: "OAuth token exchange failed.",
      });
    });

    expect(refreshAccountInfo).not.toHaveBeenCalled();
    expect(refreshAccountRateLimits).not.toHaveBeenCalled();
    expect(alertError).toHaveBeenCalledWith("OAuth token exchange failed.");
    expect(latest?.accountSwitching).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });
});
