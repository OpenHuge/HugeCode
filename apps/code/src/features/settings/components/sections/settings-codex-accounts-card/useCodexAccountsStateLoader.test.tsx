// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OAuthAccountSummary } from "../../../../../application/runtime/ports/oauth";
import {
  getAccountInfo,
  getOAuthPrimaryAccount,
  getProvidersCatalog,
  listOAuthAccounts,
  listOAuthPoolMembers,
  listOAuthPools,
} from "../../../../../application/runtime/ports/oauth";
import { listWorkspacesForOauth } from "./oauthHelpers";
import { useCodexAccountsStateLoader } from "./useCodexAccountsStateLoader";

vi.mock("../../../../../application/runtime/ports/oauth", async () => {
  const actual = await vi.importActual<
    typeof import("../../../../../application/runtime/ports/oauth")
  >("../../../../../application/runtime/ports/oauth");
  return {
    ...actual,
    getAccountInfo: vi.fn(),
    getOAuthPrimaryAccount: vi.fn(),
    getProvidersCatalog: vi.fn(),
    listOAuthAccounts: vi.fn(),
    listOAuthPoolMembers: vi.fn(),
    listOAuthPools: vi.fn(),
  };
});

vi.mock("./oauthHelpers", async () => {
  const actual = await vi.importActual<typeof import("./oauthHelpers")>("./oauthHelpers");
  return {
    ...actual,
    listWorkspacesForOauth: vi.fn(),
  };
});

function createDeferred<T>() {
  let resolve: ((value: T | PromiseLike<T>) => void) | null = null;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return {
    promise,
    resolve(value: T) {
      resolve?.(value);
    },
  };
}

function createAccounts(accountId: string): OAuthAccountSummary[] {
  return [
    {
      accountId,
      provider: "codex",
      externalAccountId: null,
      email: `${accountId}@example.com`,
      displayName: accountId,
      status: "enabled",
      disabledReason: null,
      metadata: {},
      createdAt: 100,
      updatedAt: 200,
    },
  ];
}

describe("useCodexAccountsStateLoader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listOAuthPools).mockResolvedValue([]);
    vi.mocked(listOAuthPoolMembers).mockResolvedValue([]);
    vi.mocked(getOAuthPrimaryAccount).mockResolvedValue(null);
    vi.mocked(getProvidersCatalog).mockResolvedValue([]);
    vi.mocked(getAccountInfo).mockResolvedValue(null);
    vi.mocked(listWorkspacesForOauth).mockResolvedValue([]);
  });

  it("keeps queued refresh callers pending until the queued cycle finishes", async () => {
    const firstAccounts = createDeferred<OAuthAccountSummary[]>();
    const secondAccounts = createDeferred<OAuthAccountSummary[]>();
    vi.mocked(listOAuthAccounts)
      .mockImplementationOnce(() => firstAccounts.promise)
      .mockImplementationOnce(() => secondAccounts.promise);

    const isMountedRef = { current: true };
    const poolSaveStateByIdRef = { current: {} };
    const { result } = renderHook(() =>
      useCodexAccountsStateLoader({
        isMountedRef,
        poolSaveStateByIdRef,
        setBusyAction: vi.fn(),
        setError: vi.fn(),
        setAccounts: vi.fn(),
        setPools: vi.fn(),
        setCodexPrimaryAccount: vi.fn(),
        setPoolDrafts: vi.fn(),
        setPoolSaveStateById: vi.fn(),
        setSelectedAccountIds: vi.fn(),
        setSelectedPoolIds: vi.fn(),
        setPoolSelectionPreviewById: vi.fn(),
        setProviderOptions: vi.fn(),
        setCodexAuthRequired: vi.fn(),
      })
    );

    let firstResolved = false;
    let secondResolved = false;
    const firstRefresh = result.current.refreshOAuthState().then(() => {
      firstResolved = true;
    });

    await waitFor(() => {
      expect(listOAuthAccounts).toHaveBeenCalledTimes(1);
    });

    const queuedRefresh = result.current.refreshOAuthState({ usageRefresh: "force" }).then(() => {
      secondResolved = true;
    });

    await act(async () => {
      firstAccounts.resolve(createAccounts("account-initial"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(listOAuthAccounts).toHaveBeenCalledTimes(2);
      expect(listOAuthAccounts).toHaveBeenNthCalledWith(2, null, { usageRefresh: "force" });
    });

    expect(firstResolved).toBe(false);
    expect(secondResolved).toBe(false);

    await act(async () => {
      secondAccounts.resolve(createAccounts("account-updated"));
      await Promise.all([firstRefresh, queuedRefresh]);
    });

    expect(firstResolved).toBe(true);
    expect(secondResolved).toBe(true);
  });
});
