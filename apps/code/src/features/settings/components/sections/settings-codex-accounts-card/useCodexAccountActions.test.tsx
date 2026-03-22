// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  removeOAuthAccount,
  upsertOAuthAccount,
  type OAuthAccountSummary,
} from "../../../../../application/runtime/ports/tauriOauth";
import { useCodexAccountActions } from "./useCodexAccountActions";

vi.mock("../../../../../application/runtime/ports/tauriOauth", () => ({
  removeOAuthAccount: vi.fn(),
  upsertOAuthAccount: vi.fn(),
}));

const upsertOAuthAccountMock = vi.mocked(upsertOAuthAccount);
const removeOAuthAccountMock = vi.mocked(removeOAuthAccount);

function createAccount(overrides: Partial<OAuthAccountSummary> = {}): OAuthAccountSummary {
  return {
    accountId: "acct-codex-1",
    provider: "codex",
    externalAccountId: "chatgpt-acct-1",
    email: "coder@example.com",
    displayName: "Coder",
    status: "enabled",
    disabledReason: null,
    routeConfig: null,
    routingState: null,
    chatgptWorkspaces: [
      { workspaceId: "org-a", title: "Org A", role: "member", isDefault: true },
      { workspaceId: "org-b", title: "Org B", role: "owner", isDefault: false },
    ],
    defaultChatgptWorkspaceId: "org-a",
    metadata: { chatgptPlanType: "business" },
    createdAt: 100,
    updatedAt: 200,
    ...overrides,
  };
}

describe("useCodexAccountActions", () => {
  beforeEach(() => {
    upsertOAuthAccountMock.mockReset().mockResolvedValue(createAccount());
    removeOAuthAccountMock.mockReset().mockResolvedValue(true);
  });

  it("preserves ChatGPT workspace memberships when toggling account status", async () => {
    const refreshOAuthState = vi.fn().mockResolvedValue(undefined);
    const syncProviderPoolMembers = vi.fn().mockResolvedValue(undefined);
    const setBusyAction = vi.fn();
    const setError = vi.fn();
    const setSelectedAccountIds = vi.fn();
    const account = createAccount();

    const { result } = renderHook(() =>
      useCodexAccountActions({
        accounts: [account],
        selectedAccountIds: [],
        refreshOAuthState,
        syncProviderPoolMembers,
        setBusyAction,
        setError,
        setSelectedAccountIds,
      })
    );

    await act(async () => {
      await result.current.handleToggleAccountStatus(account);
    });

    expect(upsertOAuthAccountMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "acct-codex-1",
        status: "disabled",
        chatgptWorkspaces: [
          expect.objectContaining({ workspaceId: "org-a", isDefault: true }),
          expect.objectContaining({ workspaceId: "org-b", isDefault: false }),
        ],
        defaultChatgptWorkspaceId: "org-a",
      })
    );
  });

  it("updates the default ChatGPT workspace without dropping memberships", async () => {
    const refreshOAuthState = vi.fn().mockResolvedValue(undefined);
    const syncProviderPoolMembers = vi.fn().mockResolvedValue(undefined);
    const setBusyAction = vi.fn();
    const setError = vi.fn();
    const setSelectedAccountIds = vi.fn();
    const account = createAccount();

    const { result } = renderHook(() =>
      useCodexAccountActions({
        accounts: [account],
        selectedAccountIds: [],
        refreshOAuthState,
        syncProviderPoolMembers,
        setBusyAction,
        setError,
        setSelectedAccountIds,
      })
    );

    await act(async () => {
      await result.current.handleUpdateAccountDefaultChatgptWorkspace(account, "org-b");
    });

    expect(upsertOAuthAccountMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "acct-codex-1",
        defaultChatgptWorkspaceId: "org-b",
        chatgptWorkspaces: [
          expect.objectContaining({ workspaceId: "org-a", isDefault: false }),
          expect.objectContaining({ workspaceId: "org-b", isDefault: true }),
        ],
      })
    );
  });

  it("preserves ChatGPT workspace memberships during bulk status updates", async () => {
    const refreshOAuthState = vi.fn().mockResolvedValue(undefined);
    const syncProviderPoolMembers = vi.fn().mockResolvedValue(undefined);
    const setBusyAction = vi.fn();
    const setError = vi.fn();
    const setSelectedAccountIds = vi.fn();
    const account = createAccount({ accountId: "acct-codex-2" });

    const { result } = renderHook(() =>
      useCodexAccountActions({
        accounts: [account],
        selectedAccountIds: ["acct-codex-2"],
        refreshOAuthState,
        syncProviderPoolMembers,
        setBusyAction,
        setError,
        setSelectedAccountIds,
      })
    );

    await act(async () => {
      await result.current.handleBulkAccountStatus("disabled");
    });

    expect(upsertOAuthAccountMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "acct-codex-2",
        status: "disabled",
        defaultChatgptWorkspaceId: "org-a",
        chatgptWorkspaces: [
          expect.objectContaining({ workspaceId: "org-a", isDefault: true }),
          expect.objectContaining({ workspaceId: "org-b", isDefault: false }),
        ],
      })
    );
  });
});
