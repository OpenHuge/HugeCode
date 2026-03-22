import { describe, expect, it, vi } from "vitest";
import type { OAuthAccountSummary } from "../../../../../application/runtime/ports/tauriOauth";
import {
  CodexOAuthPopupBlockedError,
  CodexOAuthSyncNotDetectedError,
  launchCodexOAuthFlow,
  resolveCodexOAuthWorkspaceId,
} from "./codexOauthFlow";

function createCodexAccount(overrides: Partial<OAuthAccountSummary> = {}): OAuthAccountSummary {
  return {
    accountId: "codex-account-1",
    provider: "codex",
    externalAccountId: null,
    email: "codex@example.com",
    displayName: "Codex",
    status: "enabled",
    disabledReason: null,
    metadata: {},
    createdAt: 1,
    updatedAt: 2,
    ...overrides,
  };
}

describe("codexOauthFlow", () => {
  it("prefers the re-authentication workspace binding before connected workspace", () => {
    const workspaceId = resolveCodexOAuthWorkspaceId({
      action: {
        kind: "reauth",
        account: createCodexAccount({ externalAccountId: "ws-codex" }),
      },
      workspaces: [
        { id: "ws-connected", connected: true },
        { id: "ws-codex", connected: false },
      ],
      defaultWorkspaceId: "ws-default",
    });

    expect(workspaceId).toBe("ws-codex");
  });

  it("falls back to the connected workspace for add flow", () => {
    const workspaceId = resolveCodexOAuthWorkspaceId({
      action: { kind: "add" },
      workspaces: [
        { id: "ws-first", connected: false },
        { id: "ws-connected", connected: true },
      ],
      defaultWorkspaceId: "ws-default",
    });

    expect(workspaceId).toBe("ws-connected");
  });

  it("refreshes immediately when runtime login completes without external OAuth", async () => {
    const popup = { closed: false, close: vi.fn() } as unknown as Window;
    const refreshOAuthState = vi.fn().mockResolvedValue(undefined);

    const result = await launchCodexOAuthFlow(
      {
        shouldUseWebOAuthPopup: () => true,
        openOAuthPopupWindow: () => popup,
        listWorkspacesForOauth: async () => [{ id: "ws-connected", connected: true }],
        runCodexLogin: async () => ({
          loginId: "login-1",
          authUrl: "",
          immediateSuccess: true,
        }),
        openOAuthUrl: vi.fn(),
        waitForCodexOauthBinding: vi.fn(),
        refreshOAuthState,
      },
      {
        action: { kind: "add" },
        defaultWorkspaceId: "ws-default",
        baselineUpdatedAt: 10,
      }
    );

    expect(result.workspaceId).toBe("ws-connected");
    expect(result.pendingSync).toBeNull();
    expect(refreshOAuthState).toHaveBeenCalledTimes(1);
    expect(popup.close).toHaveBeenCalledTimes(1);
  });

  it("returns a pending sync promise after opening the OAuth URL", async () => {
    const popup = { closed: false, close: vi.fn() } as unknown as Window;
    const openOAuthUrl = vi.fn().mockResolvedValue(undefined);
    const waitForCodexOauthBinding = vi.fn().mockResolvedValue(true);
    const refreshOAuthState = vi.fn().mockResolvedValue(undefined);

    const result = await launchCodexOAuthFlow(
      {
        shouldUseWebOAuthPopup: () => true,
        openOAuthPopupWindow: () => popup,
        listWorkspacesForOauth: async () => [{ id: "ws-connected", connected: true }],
        runCodexLogin: async () => ({
          loginId: "login-1",
          authUrl: "https://example.com/oauth",
          immediateSuccess: false,
        }),
        openOAuthUrl,
        waitForCodexOauthBinding,
        refreshOAuthState,
      },
      {
        action: { kind: "add" },
        defaultWorkspaceId: "ws-default",
        baselineUpdatedAt: 10,
      }
    );

    expect(result.pendingSync).not.toBeNull();
    await result.pendingSync;

    expect(openOAuthUrl).toHaveBeenCalledWith("https://example.com/oauth", popup);
    expect(waitForCodexOauthBinding).toHaveBeenCalledWith("ws-connected", 10);
    expect(refreshOAuthState).toHaveBeenCalledTimes(1);
    expect(popup.close).not.toHaveBeenCalled();
  });

  it("throws an explicit popup-blocked error before starting OAuth", async () => {
    await expect(
      launchCodexOAuthFlow(
        {
          shouldUseWebOAuthPopup: () => true,
          openOAuthPopupWindow: () => null,
          listWorkspacesForOauth: async () => [{ id: "ws-connected", connected: true }],
          runCodexLogin: vi.fn(),
          openOAuthUrl: vi.fn(),
          waitForCodexOauthBinding: vi.fn(),
          refreshOAuthState: vi.fn(),
        },
        {
          action: { kind: "add" },
          defaultWorkspaceId: "ws-default",
          baselineUpdatedAt: 10,
        }
      )
    ).rejects.toBeInstanceOf(CodexOAuthPopupBlockedError);
  });

  it("surfaces an explicit sync error when OAuth callback never materializes", async () => {
    const popup = { closed: false, close: vi.fn() } as unknown as Window;

    const result = await launchCodexOAuthFlow(
      {
        shouldUseWebOAuthPopup: () => true,
        openOAuthPopupWindow: () => popup,
        listWorkspacesForOauth: async () => [{ id: "ws-connected", connected: true }],
        runCodexLogin: async () => ({
          loginId: "login-1",
          authUrl: "https://example.com/oauth",
          immediateSuccess: false,
        }),
        openOAuthUrl: vi.fn().mockResolvedValue(undefined),
        waitForCodexOauthBinding: vi.fn().mockResolvedValue(false),
        refreshOAuthState: vi.fn(),
      },
      {
        action: { kind: "add" },
        defaultWorkspaceId: "ws-default",
        baselineUpdatedAt: 10,
      }
    );

    await expect(result.pendingSync).rejects.toBeInstanceOf(CodexOAuthSyncNotDetectedError);
  });

  it("does not treat account churn as success without workspace binding verification", async () => {
    const popup = { closed: false, close: vi.fn() } as unknown as Window;
    const waitForCodexOauthBinding = vi.fn().mockResolvedValue(false);

    const result = await launchCodexOAuthFlow(
      {
        shouldUseWebOAuthPopup: () => true,
        openOAuthPopupWindow: () => popup,
        listWorkspacesForOauth: async () => [{ id: "ws-connected", connected: true }],
        runCodexLogin: async () => ({
          loginId: "login-1",
          authUrl: "https://example.com/oauth",
          immediateSuccess: false,
        }),
        openOAuthUrl: vi.fn().mockResolvedValue(undefined),
        waitForCodexOauthBinding,
        refreshOAuthState: vi.fn(),
      },
      {
        action: { kind: "add" },
        defaultWorkspaceId: "ws-default",
        baselineUpdatedAt: 10,
      }
    );

    await expect(result.pendingSync).rejects.toBeInstanceOf(CodexOAuthSyncNotDetectedError);
    expect(waitForCodexOauthBinding).toHaveBeenCalledWith("ws-connected", 10);
  });
});
