// @vitest-environment jsdom

import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { subscribeAppServerEvents } from "../../../../application/runtime/ports/events";
import {
  subscribeScopedRuntimeUpdatedEvents,
  type RuntimeUpdatedEvent,
  type ScopedRuntimeUpdatedEventSnapshot,
  useScopedRuntimeUpdatedEvent,
} from "../../../../application/runtime/ports/runtimeUpdatedEvents";
import {
  detectRuntimeMode,
  getRuntimeClient,
} from "../../../../application/runtime/ports/runtimeClient";
import {
  applyOAuthPool,
  getAccountInfo,
  getOAuthPrimaryAccount,
  getProvidersCatalog,
  importCodexAccountsFromCockpitTools,
  listOAuthAccounts,
  listOAuthPoolMembers,
  listOAuthPools,
  removeOAuthAccount,
  reportOAuthRateLimit,
  runCodexLogin,
  selectOAuthPoolAccount,
  setOAuthPrimaryAccount,
  upsertOAuthAccount,
} from "../../../../application/runtime/ports/tauriOauth";
import { listWorkspaces } from "../../../../application/runtime/ports/tauriWorkspaceCatalog";
import type { AppServerEvent } from "../../../../types";
import {
  readActiveOauthPopupLoginId,
  setActiveOauthPopupLoginId,
} from "./settings-codex-accounts-card/oauthHelpers";
import { SettingsCodexAccountsCard } from "./SettingsCodexAccountsCard";

vi.mock("../../../../application/runtime/ports/events", () => ({
  subscribeAppServerEvents: vi.fn(),
}));

vi.mock("../../../../application/runtime/ports/runtimeUpdatedEvents", () => ({
  subscribeScopedRuntimeUpdatedEvents: vi.fn(),
  useScopedRuntimeUpdatedEvent: vi.fn(),
}));

vi.mock("../../../../application/runtime/ports/runtimeClient", () => ({
  detectRuntimeMode: vi.fn(() => "unavailable"),
  getRuntimeClient: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
}));

vi.mock("../../../../application/runtime/ports/tauriOauth", async () => {
  const actual = await vi.importActual<
    typeof import("../../../../application/runtime/ports/tauriOauth")
  >("../../../../application/runtime/ports/tauriOauth");
  return {
    ...actual,
    getAccountInfo: vi.fn(),
    getOAuthPrimaryAccount: vi.fn(),
    getProvidersCatalog: vi.fn(),
    importCodexAccountsFromCockpitTools: vi.fn(),
    listOAuthAccounts: vi.fn(),
    listOAuthPoolMembers: vi.fn(),
    listOAuthPools: vi.fn(),
    applyOAuthPool: vi.fn(),
    reportOAuthRateLimit: vi.fn(),
    runCodexLogin: vi.fn(),
    removeOAuthAccount: vi.fn(),
    selectOAuthPoolAccount: vi.fn(),
    setOAuthPrimaryAccount: vi.fn(),
    upsertOAuthAccount: vi.fn(),
  };
});

vi.mock("../../../../application/runtime/ports/tauriWorkspaceCatalog", () => ({
  listWorkspaces: vi.fn(),
}));

let listener: ((event: AppServerEvent) => void) | null = null;
let runtimeUpdatedListener: ((event: RuntimeUpdatedEvent) => void) | null = null;
const unlisten = vi.fn();
const EMPTY_RUNTIME_UPDATED_SNAPSHOT: ScopedRuntimeUpdatedEventSnapshot = {
  revision: 0,
  lastEvent: null,
};
let runtimeUpdatedRevisionCounter = 0;
const getProvidersCatalogMock = vi.mocked(getProvidersCatalog);
const getAccountInfoMock = vi.mocked(getAccountInfo);
const getOAuthPrimaryAccountMock = vi.mocked(getOAuthPrimaryAccount);
const importCodexAccountsFromCockpitToolsMock = vi.mocked(importCodexAccountsFromCockpitTools);
const listOAuthAccountsMock = vi.mocked(listOAuthAccounts);
const listOAuthPoolMembersMock = vi.mocked(listOAuthPoolMembers);
const listOAuthPoolsMock = vi.mocked(listOAuthPools);
const applyOAuthPoolMock = vi.mocked(applyOAuthPool);
const listWorkspacesMock = vi.mocked(listWorkspaces);
const removeOAuthAccountMock = vi.mocked(removeOAuthAccount);
const reportOAuthRateLimitMock = vi.mocked(reportOAuthRateLimit);
const runCodexLoginMock = vi.mocked(runCodexLogin);
const selectOAuthPoolAccountMock = vi.mocked(selectOAuthPoolAccount);
const setOAuthPrimaryAccountMock = vi.mocked(setOAuthPrimaryAccount);
const upsertOAuthAccountMock = vi.mocked(upsertOAuthAccount);
const openUrlMock = vi.mocked(openUrl);
const detectRuntimeModeMock = vi.mocked(detectRuntimeMode);
const getRuntimeClientMock = vi.mocked(getRuntimeClient);
const runtimeOauthAccountsMock = vi.fn().mockResolvedValue([]);
const runtimeOauthPoolsMock = vi.fn().mockResolvedValue([]);
const SETTINGS_CODEX_ACCOUNTS_ASYNC_TIMEOUT_MS = 5_000;
const SETTINGS_CODEX_ACCOUNTS_TEST_TIMEOUT_MS = 15_000;

async function flushEffectTurn() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function emitOauthPopupMessage(loginId: string, success: boolean) {
  window.dispatchEvent(
    new window.MessageEvent("message", {
      data: { type: "fastcode:oauth:codex", success, loginId },
      origin: window.location.origin,
    })
  );
}

async function selectAccountOption(label: string, optionName: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: label }));
  });
  await act(async () => {
    fireEvent.click(await screen.findByRole("option", { name: optionName }));
  });
}

beforeEach(() => {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("codex_accounts_tab_v1");
    window.localStorage.removeItem("codex_accounts_provider_filter_v1");
    window.localStorage.removeItem("codex_accounts_status_filter_v1");
    window.localStorage.removeItem("codex_accounts_search_query_v1");
    window.localStorage.removeItem("codex_pools_provider_filter_v1");
  }
  setActiveOauthPopupLoginId(null);
  listener = null;
  runtimeUpdatedListener = null;
  runtimeUpdatedRevisionCounter = 0;
  unlisten.mockReset();
  vi.mocked(subscribeAppServerEvents).mockImplementation((callback) => {
    listener = callback;
    return unlisten;
  });
  vi.mocked(subscribeScopedRuntimeUpdatedEvents).mockImplementation((_options, callback) => {
    runtimeUpdatedListener = callback;
    return unlisten;
  });
  vi.mocked(useScopedRuntimeUpdatedEvent).mockImplementation(() => {
    const [snapshot, setSnapshot] = useState<ScopedRuntimeUpdatedEventSnapshot>(
      EMPTY_RUNTIME_UPDATED_SNAPSHOT
    );

    useEffect(() => {
      const currentListener = (event: RuntimeUpdatedEvent) => {
        runtimeUpdatedRevisionCounter += 1;
        setSnapshot({
          revision: runtimeUpdatedRevisionCounter,
          lastEvent: event,
        });
      };
      runtimeUpdatedListener = currentListener;
      return () => {
        if (runtimeUpdatedListener === currentListener) {
          runtimeUpdatedListener = null;
        }
      };
    }, []);

    return snapshot;
  });
  getProvidersCatalogMock.mockResolvedValue([]);
  getAccountInfoMock.mockResolvedValue({
    result: {
      account: null,
      requiresOpenaiAuth: false,
      requires_openai_auth: false,
    },
  });
  getOAuthPrimaryAccountMock.mockResolvedValue({
    provider: "codex",
    accountId: null,
    account: null,
    defaultPoolId: "pool-codex",
    routeAccountId: null,
    inSync: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  importCodexAccountsFromCockpitToolsMock.mockResolvedValue({
    scanned: 3,
    imported: 2,
    updated: 1,
    skipped: 0,
    failed: 0,
    sourcePath: "/tmp/cockpit-tools",
    message: "Imported 2 accounts and updated 1 from cockpit-tools.",
  });
  listOAuthAccountsMock.mockResolvedValue([]);
  listOAuthPoolMembersMock.mockResolvedValue([]);
  listOAuthPoolsMock.mockResolvedValue([]);
  applyOAuthPoolMock.mockImplementation(async (input) => {
    const now = Date.now();
    return {
      pool: {
        ...input.pool,
        strategy: input.pool.strategy ?? "round_robin",
        stickyMode: input.pool.stickyMode ?? "cache_first",
        preferredAccountId: input.pool.preferredAccountId ?? null,
        enabled: input.pool.enabled ?? true,
        metadata: input.pool.metadata ?? {},
        createdAt: now,
        updatedAt: now,
      },
      members: [],
    };
  });
  listWorkspacesMock.mockResolvedValue([]);
  runCodexLoginMock.mockResolvedValue({
    loginId: "login-default",
    authUrl: "",
    immediateSuccess: true,
  });
  reportOAuthRateLimitMock.mockResolvedValue(true);
  removeOAuthAccountMock.mockResolvedValue(true);
  selectOAuthPoolAccountMock.mockResolvedValue(null);
  setOAuthPrimaryAccountMock.mockResolvedValue({
    provider: "codex",
    accountId: null,
    account: null,
    defaultPoolId: "pool-codex",
    routeAccountId: null,
    inSync: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  detectRuntimeModeMock.mockReturnValue("unavailable");
  runtimeOauthAccountsMock.mockResolvedValue([]);
  runtimeOauthPoolsMock.mockResolvedValue([]);
  getRuntimeClientMock.mockReturnValue({
    oauthAccounts: runtimeOauthAccountsMock,
    oauthPools: runtimeOauthPoolsMock,
  } as unknown as ReturnType<typeof getRuntimeClient>);
  upsertOAuthAccountMock.mockResolvedValue({
    accountId: "account-default",
    provider: "codex",
    externalAccountId: null,
    email: "demo@example.com",
    displayName: "Demo",
    status: "enabled",
    disabledReason: null,
    metadata: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  openUrlMock.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  setActiveOauthPopupLoginId(null);
});

describe("SettingsCodexAccountsCard", () => {
  const chooseSelectOption = async (label: string | RegExp, optionName: string | RegExp) => {
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: label }));
    });
    await act(async () => {
      fireEvent.click(await screen.findByRole("option", { name: optionName }));
    });
  };

  const emitRuntimeUpdatedOauth = (revision: string, params: Record<string, unknown> = {}) => {
    const mergedParams = {
      revision,
      scope: ["oauth"],
      reason: "oauth_sync",
      ...params,
    };
    runtimeUpdatedListener?.({
      event: {
        workspace_id: "workspace-1",
        message: {
          method: "runtime/updated",
          params: mergedParams,
        },
      },
      params: mergedParams,
      scope: Array.isArray(mergedParams.scope) ? (mergedParams.scope as string[]) : ["oauth"],
      reason:
        typeof mergedParams.reason === "string" && mergedParams.reason.trim().length > 0
          ? mergedParams.reason
          : "",
      eventWorkspaceId: "workspace-1",
      paramsWorkspaceId: null,
      isWorkspaceLocalEvent: false,
    });
  };

  const confirmRemoveAccountDialog = async () => {
    const dialog = await screen.findByRole("dialog", { name: "Remove account" });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
    });
  };

  it("refreshes when runtime/updated includes oauth scope", async () => {
    render(<SettingsCodexAccountsCard />);

    await waitFor(
      () => {
        expect(listOAuthAccountsMock.mock.calls.length).toBeGreaterThanOrEqual(1);
        expect(listOAuthPoolsMock.mock.calls.length).toBeGreaterThanOrEqual(1);
      },
      { timeout: SETTINGS_CODEX_ACCOUNTS_ASYNC_TIMEOUT_MS }
    );

    act(() => {
      emitRuntimeUpdatedOauth("11", {
        scope: ["oauth", "workspaces"],
        reason: "code_oauth_pool_upsert",
      });
    });

    await waitFor(() => {
      expect(listOAuthAccountsMock).toHaveBeenCalledTimes(2);
      expect(listOAuthPoolsMock).toHaveBeenCalledTimes(2);
    });
  });

  it("deduplicates runtime/updated oauth events with the same revision", async () => {
    render(<SettingsCodexAccountsCard />);

    await waitFor(() => {
      expect(listOAuthAccountsMock.mock.calls.length).toBeGreaterThanOrEqual(1);
      expect(listOAuthPoolsMock.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    act(() => {
      emitRuntimeUpdatedOauth("31");
      emitRuntimeUpdatedOauth("31");
    });

    await waitFor(() => {
      expect(listOAuthAccountsMock).toHaveBeenCalledTimes(2);
      expect(listOAuthPoolsMock).toHaveBeenCalledTimes(2);
    });
  });

  it("refreshes for newer runtime/updated oauth revisions", async () => {
    render(<SettingsCodexAccountsCard />);

    await waitFor(() => {
      expect(listOAuthAccountsMock.mock.calls.length).toBeGreaterThanOrEqual(1);
      expect(listOAuthPoolsMock.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    act(() => {
      emitRuntimeUpdatedOauth("41");
    });

    await waitFor(() => {
      expect(listOAuthAccountsMock).toHaveBeenCalledTimes(2);
      expect(listOAuthPoolsMock).toHaveBeenCalledTimes(2);
    });

    act(() => {
      emitRuntimeUpdatedOauth("42");
    });

    await waitFor(() => {
      expect(listOAuthAccountsMock).toHaveBeenCalledTimes(3);
      expect(listOAuthPoolsMock).toHaveBeenCalledTimes(3);
    });
  });

  it("refreshes when account/login/completed reports success", async () => {
    render(<SettingsCodexAccountsCard />);

    await waitFor(() => {
      expect(listOAuthAccountsMock).toHaveBeenCalledTimes(1);
      expect(listOAuthPoolsMock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      listener?.({
        workspace_id: "workspace-1",
        message: {
          method: "account/login/completed",
          params: {
            loginId: "login-1",
            success: true,
          },
        },
      });
    });

    await waitFor(() => {
      expect(listOAuthAccountsMock).toHaveBeenCalledTimes(2);
      expect(listOAuthPoolsMock).toHaveBeenCalledTimes(2);
    });
  });

  it("ignores unrelated runtime and login events", async () => {
    render(<SettingsCodexAccountsCard />);

    await waitFor(() => {
      expect(listOAuthAccountsMock).toHaveBeenCalledTimes(1);
      expect(listOAuthPoolsMock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      listener?.({
        workspace_id: "workspace-1",
        message: {
          method: "account/login/completed",
          params: {
            loginId: "login-1",
            success: false,
          },
        },
      });
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(useScopedRuntimeUpdatedEvent).toHaveBeenCalledWith({
      scopes: ["oauth"],
    });
    expect(listOAuthAccountsMock).toHaveBeenCalledTimes(1);
    expect(listOAuthPoolsMock).toHaveBeenCalledTimes(1);
  });

  it("shows runtime oauth failure error without triggering refresh", async () => {
    render(<SettingsCodexAccountsCard />);

    await waitFor(() => {
      expect(listOAuthAccountsMock).toHaveBeenCalledTimes(1);
      expect(listOAuthPoolsMock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      emitRuntimeUpdatedOauth("23", {
        oauthLoginSuccess: false,
        oauthLoginError: "Failed to exchange OAuth id_token for API key.",
      });
    });

    expect(screen.queryByText("Failed to exchange OAuth id_token for API key.")).not.toBeNull();
    expect(listOAuthAccountsMock).toHaveBeenCalledTimes(1);
    expect(listOAuthPoolsMock).toHaveBeenCalledTimes(1);
  });

  it("queues a second refresh when runtime oauth update arrives during in-flight refresh", async () => {
    let resolveAccounts: ((value: Awaited<ReturnType<typeof listOAuthAccounts>>) => void) | null =
      null;
    const firstAccounts = new Promise<Awaited<ReturnType<typeof listOAuthAccounts>>>((resolve) => {
      resolveAccounts = resolve;
    });
    listOAuthAccountsMock.mockImplementationOnce(() => firstAccounts).mockResolvedValue([]);
    listOAuthPoolsMock.mockResolvedValue([]);

    render(<SettingsCodexAccountsCard />);

    await waitFor(() => {
      expect(listOAuthAccountsMock).toHaveBeenCalledTimes(1);
      expect(listOAuthPoolsMock).toHaveBeenCalledTimes(0);
    });

    act(() => {
      emitRuntimeUpdatedOauth("24", {
        reason: "oauth_codex_login_completed",
      });
    });

    await act(async () => {
      resolveAccounts?.([]);
    });

    await waitFor(() => {
      expect(listOAuthAccountsMock).toHaveBeenCalledTimes(2);
      expect(listOAuthPoolsMock).toHaveBeenCalledTimes(2);
    });
  });

  it("starts codex OAuth flow when adding a codex account", async () => {
    listWorkspacesMock.mockResolvedValue([
      {
        id: "workspace-1",
        name: "Workspace 1",
        path: "/tmp/workspace-1",
        connected: true,
        settings: { sidebarCollapsed: false },
      },
    ]);
    runCodexLoginMock.mockResolvedValue({
      loginId: "login-codex-1",
      authUrl: "https://example.com/oauth/codex",
      immediateSuccess: false,
    });
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);

    render(<SettingsCodexAccountsCard />);

    await waitFor(() => {
      expect(listOAuthAccountsMock).toHaveBeenCalledTimes(1);
      expect(listOAuthPoolsMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Sign in with OAuth" }));

    await waitFor(() => {
      expect(runCodexLoginMock).toHaveBeenCalledWith("workspace-1", { forceOAuth: true });
    });

    expect(upsertOAuthAccountMock).not.toHaveBeenCalled();
    expect(openUrlMock).toHaveBeenCalledWith("https://example.com/oauth/codex");
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  }, 30_000);

  it("shows explicit OpenAI auth prompt when codex account requires auth", async () => {
    getAccountInfoMock.mockResolvedValue({
      result: {
        account: null,
        requiresOpenaiAuth: true,
        requires_openai_auth: true,
      },
    });
    listWorkspacesMock.mockResolvedValue([
      {
        id: "workspace-1",
        name: "Workspace 1",
        path: "/tmp/workspace-1",
        connected: true,
        settings: { sidebarCollapsed: false },
      },
    ]);

    render(<SettingsCodexAccountsCard />);

    await waitFor(() => {
      expect(getAccountInfoMock).toHaveBeenCalledWith("workspace-1");
    });
    expect(screen.queryByText(/requires OpenAI auth/i)).not.toBeNull();
  });

  it("falls back to window.open when opener plugin fails", async () => {
    listWorkspacesMock.mockResolvedValue([
      {
        id: "workspace-1",
        name: "Workspace 1",
        path: "/tmp/workspace-1",
        connected: true,
        settings: { sidebarCollapsed: false },
      },
    ]);
    runCodexLoginMock.mockResolvedValue({
      loginId: "login-codex-1",
      authUrl: "https://example.com/oauth/codex",
      immediateSuccess: false,
    });
    openUrlMock.mockRejectedValue(new Error("openUrl failed"));
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);

    render(<SettingsCodexAccountsCard />);

    await waitFor(() => {
      expect(listOAuthAccountsMock).toHaveBeenCalledTimes(1);
      expect(listOAuthPoolsMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Sign in with OAuth" }));

    await waitFor(() => {
      expect(runCodexLoginMock).toHaveBeenCalledWith("workspace-1", { forceOAuth: true });
      expect(openUrlMock).toHaveBeenCalledWith("https://example.com/oauth/codex");
    });

    expect(openSpy).toHaveBeenCalledWith(
      "https://example.com/oauth/codex",
      "_blank",
      "noopener,noreferrer"
    );
    openSpy.mockRestore();
  });

  it("refreshes OAuth state when codex OAuth succeeds immediately", async () => {
    listWorkspacesMock.mockResolvedValue([
      {
        id: "workspace-1",
        name: "Workspace 1",
        path: "/tmp/workspace-1",
        connected: true,
        settings: { sidebarCollapsed: false },
      },
    ]);
    runCodexLoginMock.mockResolvedValue({
      loginId: "login-codex-1",
      authUrl: "",
      immediateSuccess: true,
    });
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);

    render(<SettingsCodexAccountsCard />);

    await waitFor(() => {
      expect(listOAuthAccountsMock.mock.calls.length).toBeGreaterThanOrEqual(1);
      expect(listOAuthPoolsMock.mock.calls.length).toBeGreaterThanOrEqual(1);
    });
    const accountCallsBeforeLogin = listOAuthAccountsMock.mock.calls.length;
    const poolCallsBeforeLogin = listOAuthPoolsMock.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "Sign in with OAuth" }));

    await waitFor(() => {
      expect(runCodexLoginMock).toHaveBeenCalledWith("workspace-1", { forceOAuth: true });
      expect(listOAuthAccountsMock.mock.calls.length).toBeGreaterThan(accountCallsBeforeLogin);
      expect(listOAuthPoolsMock.mock.calls.length).toBeGreaterThan(poolCallsBeforeLogin);
    });

    expect(openSpy).not.toHaveBeenCalled();
    expect(upsertOAuthAccountMock).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it("imports cockpit-tools Codex accounts from the explicit entry", async () => {
    render(<SettingsCodexAccountsCard />);

    await waitFor(() => {
      expect(listOAuthAccountsMock).toHaveBeenCalledTimes(1);
      expect(listOAuthPoolsMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Import from cockpit-tools" }));

    await waitFor(() => {
      expect(importCodexAccountsFromCockpitToolsMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(listOAuthAccountsMock.mock.calls.length).toBeGreaterThan(1);
      expect(listOAuthPoolsMock.mock.calls.length).toBeGreaterThan(1);
    });

    await waitFor(() => {
      expect(
        screen.queryAllByText("Imported 2 accounts and updated 1 from cockpit-tools.").length
      ).toBeGreaterThan(0);
    });
  }, 60_000);

  it("creates the canonical default pool for the first non-codex account", async () => {
    const geminiAccount = {
      accountId: "gemini-a1",
      provider: "gemini" as const,
      externalAccountId: null,
      email: "gemini@example.com",
      displayName: "Gemini Main",
      status: "enabled" as const,
      disabledReason: null,
      metadata: {},
      createdAt: 30,
      updatedAt: 40,
    };
    listOAuthAccountsMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([geminiAccount])
      .mockResolvedValue([geminiAccount]);
    listOAuthPoolsMock.mockResolvedValue([]);
    upsertOAuthAccountMock.mockResolvedValue(geminiAccount);

    render(<SettingsCodexAccountsCard />);

    await waitFor(() => {
      expect(listOAuthAccountsMock).toHaveBeenCalledTimes(1);
      expect(listOAuthPoolsMock).toHaveBeenCalledTimes(1);
    });

    await selectAccountOption("Account provider", "Gemini");
    fireEvent.change(screen.getByLabelText("Account display name"), {
      target: { value: "Gemini Main" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Add account" }));

    await waitFor(() => {
      expect(applyOAuthPoolMock).toHaveBeenCalledWith(
        expect.objectContaining({
          pool: expect.objectContaining({
            poolId: "pool-gemini",
            provider: "gemini",
            name: "Default pool",
            preferredAccountId: null,
          }),
        })
      );
    });
  });

  it(
    "queues a refresh when oauth popup posts success during an in-flight refresh",
    async () => {
      let resolveAccounts: ((value: Awaited<ReturnType<typeof listOAuthAccounts>>) => void) | null =
        null;
      const firstAccounts = new Promise<Awaited<ReturnType<typeof listOAuthAccounts>>>(
        (resolve) => {
          resolveAccounts = resolve;
        }
      );
      listOAuthAccountsMock
        .mockImplementationOnce(() => firstAccounts)
        .mockResolvedValue([
          {
            accountId: "codex-popup-1",
            provider: "codex",
            externalAccountId: null,
            email: "popup@example.com",
            displayName: "Popup Success Account",
            status: "enabled",
            disabledReason: null,
            metadata: {},
            createdAt: 100,
            updatedAt: 200,
          },
        ]);
      listOAuthPoolsMock.mockResolvedValueOnce([]).mockResolvedValue([
        {
          poolId: "pool-popup-1",
          provider: "codex",
          name: "Popup Success Pool",
          strategy: "round_robin",
          stickyMode: "cache_first",
          preferredAccountId: "codex-popup-1",
          enabled: true,
          metadata: {},
          createdAt: 100,
          updatedAt: 200,
        },
      ]);
      setActiveOauthPopupLoginId("login-popup-1");

      render(<SettingsCodexAccountsCard />);

      await waitFor(() => {
        expect(listOAuthAccountsMock).toHaveBeenCalledTimes(1);
        expect(listOAuthPoolsMock).toHaveBeenCalledTimes(0);
      });
      const accountsTab = screen.getByRole("tab", { name: /Accounts/i });
      const poolsTab = screen.getByRole("tab", { name: /Pools/i });
      expect(accountsTab.textContent ?? "").toContain("0");
      expect(poolsTab.textContent ?? "").toContain("0");

      await flushEffectTurn();

      act(() => {
        window.dispatchEvent(
          new window.MessageEvent("message", {
            data: { type: "fastcode:oauth:codex", success: true, loginId: "login-popup-1" },
            origin: window.location.origin,
          })
        );
      });

      expect(readActiveOauthPopupLoginId()).toBeNull();
      const accountCallsBeforeQueuedRefresh = listOAuthAccountsMock.mock.calls.length;
      const poolCallsBeforeQueuedRefresh = listOAuthPoolsMock.mock.calls.length;

      await act(async () => {
        resolveAccounts?.([]);
      });

      await waitFor(
        () => {
          expect(listOAuthAccountsMock.mock.calls.length).toBeGreaterThanOrEqual(
            accountCallsBeforeQueuedRefresh + 1
          );
          expect(listOAuthPoolsMock.mock.calls.length).toBeGreaterThanOrEqual(
            poolCallsBeforeQueuedRefresh + 1
          );
        },
        { timeout: SETTINGS_CODEX_ACCOUNTS_ASYNC_TIMEOUT_MS }
      );

      fireEvent.click(poolsTab);
      await screen.findByText("Popup Success Pool");
      await waitFor(
        () => {
          expect(accountsTab.textContent ?? "").toContain("1");
          expect(poolsTab.textContent ?? "").toContain("1");
        },
        { timeout: SETTINGS_CODEX_ACCOUNTS_ASYNC_TIMEOUT_MS }
      );
    },
    SETTINGS_CODEX_ACCOUNTS_TEST_TIMEOUT_MS
  );

  it(
    "shows callback verification error when oauth popup posts failure message",
    async () => {
      render(<SettingsCodexAccountsCard />);

      await waitFor(
        () => {
          expect(listOAuthAccountsMock.mock.calls.length).toBeGreaterThanOrEqual(1);
          expect(listOAuthPoolsMock.mock.calls.length).toBeGreaterThanOrEqual(1);
        },
        { timeout: SETTINGS_CODEX_ACCOUNTS_ASYNC_TIMEOUT_MS }
      );
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Refresh" })).toBeTruthy();
      });
      const accountCallsBeforePopupFailure = listOAuthAccountsMock.mock.calls.length;
      const poolCallsBeforePopupFailure = listOAuthPoolsMock.mock.calls.length;
      setActiveOauthPopupLoginId("login-popup-2");
      expect(readActiveOauthPopupLoginId()).toBe("login-popup-2");

      await act(async () => {
        await new Promise((resolve) => {
          window.setTimeout(resolve, 0);
        });
      });

      act(() => {
        emitOauthPopupMessage("login-popup-2", false);
      });

      await waitFor(() => {
        expect(readActiveOauthPopupLoginId()).toBeNull();
      });

      await waitFor(
        () => {
          expect(
            screen.getByText(
              "Codex OAuth failed during callback verification. Check the OAuth popup for details.",
              {
                selector: ".apm-error",
              }
            )
          ).toBeTruthy();
        },
        { timeout: SETTINGS_CODEX_ACCOUNTS_ASYNC_TIMEOUT_MS }
      );
      expect(listOAuthAccountsMock.mock.calls.length).toBe(accountCallsBeforePopupFailure);
      expect(listOAuthPoolsMock.mock.calls.length).toBe(poolCallsBeforePopupFailure);
    },
    SETTINGS_CODEX_ACCOUNTS_TEST_TIMEOUT_MS
  );

  it("allows setting account and pool filters to the same provider", async () => {
    getProvidersCatalogMock.mockResolvedValue([
      {
        providerId: "openai",
        oauthProviderId: "codex",
        displayName: "Codex",
        pool: "native",
        aliases: [],
        defaultModelId: "gpt-5.4",
        available: true,
        supportsNative: true,
        supportsOpenaiCompat: true,
      },
      {
        providerId: "google",
        oauthProviderId: "gemini",
        displayName: "Gemini",
        pool: "native",
        aliases: [],
        defaultModelId: "gemini-2.5-pro",
        available: true,
        supportsNative: true,
        supportsOpenaiCompat: true,
      },
    ]);
    listOAuthAccountsMock.mockResolvedValue([
      {
        accountId: "codex-a1",
        provider: "codex",
        externalAccountId: null,
        email: "codex@example.com",
        displayName: "Codex Main",
        status: "enabled",
        disabledReason: null,
        metadata: {},
        createdAt: 10,
        updatedAt: 20,
      },
      {
        accountId: "gemini-a1",
        provider: "gemini",
        externalAccountId: null,
        email: "gemini@example.com",
        displayName: "Gemini Main",
        status: "enabled",
        disabledReason: null,
        metadata: {},
        createdAt: 30,
        updatedAt: 40,
      },
    ]);
    listOAuthPoolsMock.mockResolvedValue([
      {
        poolId: "codex-default",
        provider: "codex",
        name: "Codex Pool",
        strategy: "round_robin",
        stickyMode: "cache_first",
        preferredAccountId: null,
        enabled: true,
        metadata: {},
        createdAt: 50,
        updatedAt: 60,
      },
      {
        poolId: "gemini-default",
        provider: "gemini",
        name: "Gemini Pool",
        strategy: "round_robin",
        stickyMode: "cache_first",
        preferredAccountId: null,
        enabled: true,
        metadata: {},
        createdAt: 70,
        updatedAt: 80,
      },
    ]);

    render(<SettingsCodexAccountsCard />);

    await waitFor(() => {
      expect(screen.queryByLabelText("Filter accounts by provider")).not.toBeNull();
    });

    await selectAccountOption("Filter accounts by provider", "Gemini");
    expect(
      screen.getByRole("button", { name: "Filter accounts by provider" }).textContent ?? ""
    ).toContain("Gemini");

    fireEvent.click(screen.getByRole("tab", { name: /Pools/i }));

    await waitFor(() => {
      expect(screen.queryByLabelText("Filter pools by provider")).not.toBeNull();
    });

    await selectAccountOption("Filter pools by provider", "Gemini");
    expect(
      screen.getByRole("button", { name: "Filter pools by provider" }).textContent ?? ""
    ).toContain("Gemini");
  });

  it("handles pool save conflict by code even without legacy message prefix", async () => {
    listOAuthAccountsMock.mockResolvedValue([
      {
        accountId: "codex-a1",
        provider: "codex",
        externalAccountId: null,
        email: "codex@example.com",
        displayName: "Codex Main",
        status: "enabled",
        disabledReason: null,
        metadata: {},
        createdAt: 10,
        updatedAt: 20,
      },
    ]);
    listOAuthPoolsMock.mockResolvedValue([
      {
        poolId: "pool-codex",
        provider: "codex",
        name: "Codex Pool",
        strategy: "round_robin",
        stickyMode: "cache_first",
        preferredAccountId: "codex-a1",
        enabled: true,
        metadata: {},
        createdAt: 50,
        updatedAt: 60,
      },
    ]);
    listOAuthPoolMembersMock.mockImplementation(async (poolId: string) => {
      if (poolId !== "pool-codex") {
        return [];
      }
      return [
        {
          poolId: "pool-codex",
          accountId: "codex-a1",
          weight: 1,
          priority: 0,
          position: 0,
          enabled: true,
          createdAt: 61,
          updatedAt: 62,
        },
      ];
    });
    applyOAuthPoolMock.mockRejectedValueOnce(
      Object.assign(new Error("Pool revision mismatch"), {
        code: "runtime.approval.pool.version_mismatch",
      })
    );

    render(<SettingsCodexAccountsCard />);

    await waitFor(
      () => {
        expect(listOAuthAccountsMock.mock.calls.length).toBeGreaterThanOrEqual(1);
        expect(listOAuthPoolsMock.mock.calls.length).toBeGreaterThanOrEqual(1);
      },
      { timeout: SETTINGS_CODEX_ACCOUNTS_ASYNC_TIMEOUT_MS }
    );

    fireEvent.click(screen.getByRole("tab", { name: /Pools/i }));
    await screen.findByLabelText("Name for pool pool-codex");

    await selectAccountOption("Session binding for pool pool-codex", "balance");

    await waitFor(() => {
      expect(applyOAuthPoolMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.queryByText("Remote pool updated. Reloaded latest version.")).not.toBeNull();
    });
  });

  it("disables remove action for local Codex CLI managed account", async () => {
    listOAuthAccountsMock.mockResolvedValue([
      {
        accountId: "codex-local-cli",
        provider: "codex",
        externalAccountId: null,
        email: "managed@example.com",
        displayName: "Local Codex CLI",
        status: "enabled",
        disabledReason: null,
        metadata: {
          source: "local_codex_cli_auth",
          localCliManaged: true,
          credentialAvailable: true,
        },
        createdAt: 10,
        updatedAt: 20,
      },
    ]);
    listOAuthPoolsMock.mockResolvedValue([]);

    render(<SettingsCodexAccountsCard />);

    const removeButton = await screen.findByRole("button", { name: "Remove" });
    expect((removeButton as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.queryByText(
        "Managed by local Codex CLI. Sign out in Codex CLI to remove this account."
      )
    ).not.toBeNull();

    fireEvent.click(removeButton);
    expect(removeOAuthAccountMock).not.toHaveBeenCalled();
  });

  it("removes regular account from accounts tab", async () => {
    listOAuthAccountsMock.mockResolvedValue([
      {
        accountId: "codex-a1",
        provider: "codex",
        externalAccountId: null,
        email: "codex-a1@example.com",
        displayName: "Codex A1",
        status: "enabled",
        disabledReason: null,
        metadata: {},
        createdAt: 10,
        updatedAt: 20,
      },
    ]);
    listOAuthPoolsMock.mockResolvedValue([]);

    render(<SettingsCodexAccountsCard />);

    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
    await confirmRemoveAccountDialog();

    await waitFor(() => {
      expect(removeOAuthAccountMock).toHaveBeenCalledWith("codex-a1");
    });
  });

  it("shows explicit error when remove account request is rejected", async () => {
    removeOAuthAccountMock.mockResolvedValueOnce(false);
    listOAuthAccountsMock.mockResolvedValue([
      {
        accountId: "codex-a1",
        provider: "codex",
        externalAccountId: null,
        email: "codex-a1@example.com",
        displayName: "Codex A1",
        status: "enabled",
        disabledReason: null,
        metadata: {},
        createdAt: 10,
        updatedAt: 20,
      },
    ]);
    listOAuthPoolsMock.mockResolvedValue([]);

    render(<SettingsCodexAccountsCard />);

    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
    await confirmRemoveAccountDialog();

    await waitFor(() => {
      expect(screen.queryByText(/Unable to remove account codex-a1/)).not.toBeNull();
    });
  });

  it("bulk remove skips local CLI managed accounts", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    listOAuthAccountsMock.mockResolvedValue([
      {
        accountId: "codex-user-1",
        provider: "codex",
        externalAccountId: null,
        email: "codex-user-1@example.com",
        displayName: "Codex User 1",
        status: "enabled",
        disabledReason: null,
        metadata: {},
        createdAt: 10,
        updatedAt: 20,
      },
      {
        accountId: "codex-local-cli",
        provider: "codex",
        externalAccountId: null,
        email: "managed@example.com",
        displayName: "Local Codex CLI",
        status: "enabled",
        disabledReason: null,
        metadata: {
          source: "local_codex_cli_auth",
          localCliManaged: true,
          credentialAvailable: true,
        },
        createdAt: 30,
        updatedAt: 40,
      },
    ]);
    listOAuthPoolsMock.mockResolvedValue([]);

    render(<SettingsCodexAccountsCard />);

    await screen.findByLabelText("Filter accounts by provider");
    fireEvent.click(screen.getByRole("button", { name: "Select all" }));

    const toolbar = screen.getByLabelText("Filter accounts by provider").closest(".apm-toolbar");
    expect(toolbar).not.toBeNull();
    fireEvent.click(within(toolbar as HTMLElement).getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(removeOAuthAccountMock).toHaveBeenCalledTimes(1);
      expect(removeOAuthAccountMock).toHaveBeenCalledWith("codex-user-1");
    });
    await waitFor(() => {
      expect(screen.queryByText(/Skipped 1 local CLI managed account/)).not.toBeNull();
    });

    confirmSpy.mockRestore();
  });

  it("uses bridge oauth reads in runtime-gateway-web mode", async () => {
    detectRuntimeModeMock.mockReturnValue("runtime-gateway-web");
    listOAuthAccountsMock.mockResolvedValue([
      {
        accountId: "codex-bridge-1",
        provider: "codex",
        externalAccountId: null,
        email: "bridge@example.com",
        displayName: "Bridge Account",
        status: "enabled",
        disabledReason: null,
        metadata: {},
        createdAt: 10,
        updatedAt: 20,
      },
    ]);
    listOAuthPoolsMock.mockResolvedValue([]);

    render(<SettingsCodexAccountsCard />);

    await waitFor(() => {
      expect(listOAuthAccountsMock).toHaveBeenCalledWith(null);
      expect(listOAuthPoolsMock).toHaveBeenCalledWith(null);
    });

    expect(runtimeOauthAccountsMock).not.toHaveBeenCalled();
    expect(runtimeOauthPoolsMock).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Select account codex-bridge-1")).not.toBeNull();
  });

  it("ignores runtime oauth client errors and continues using bridge reads in runtime-gateway-web mode", async () => {
    detectRuntimeModeMock.mockReturnValue("runtime-gateway-web");
    runtimeOauthAccountsMock.mockRejectedValue(new Error("runtime strict read failed"));
    runtimeOauthPoolsMock.mockRejectedValue(new Error("runtime strict read failed"));
    listOAuthAccountsMock.mockResolvedValue([
      {
        accountId: "codex-bridge-1",
        provider: "codex",
        externalAccountId: null,
        email: "bridge@example.com",
        displayName: "Bridge Account",
        status: "enabled",
        disabledReason: null,
        metadata: {},
        createdAt: 10,
        updatedAt: 20,
      },
    ]);
    listOAuthPoolsMock.mockResolvedValue([]);

    render(<SettingsCodexAccountsCard />);

    await waitFor(() => {
      expect(listOAuthAccountsMock).toHaveBeenCalledWith(null);
      expect(listOAuthPoolsMock).toHaveBeenCalledWith(null);
    });

    expect(runtimeOauthAccountsMock).not.toHaveBeenCalled();
    expect(runtimeOauthPoolsMock).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Select account codex-bridge-1")).not.toBeNull();
  });

  it("probes pool account selection via runtime bridge", async () => {
    const now = Date.now();
    listOAuthAccountsMock.mockResolvedValue([
      {
        accountId: "codex-a1",
        provider: "codex",
        externalAccountId: null,
        email: "codex-a1@example.com",
        displayName: "Codex A1",
        status: "enabled",
        disabledReason: null,
        metadata: {},
        createdAt: now - 200,
        updatedAt: now - 100,
      },
    ]);
    listOAuthPoolsMock.mockResolvedValue([
      {
        poolId: "pool-codex",
        provider: "codex",
        name: "Codex Pool",
        strategy: "round_robin",
        stickyMode: "cache_first",
        preferredAccountId: "codex-a1",
        enabled: true,
        metadata: {},
        createdAt: now - 100,
        updatedAt: now,
      },
    ]);
    selectOAuthPoolAccountMock.mockResolvedValue({
      poolId: "pool-codex",
      account: {
        accountId: "codex-a1",
        provider: "codex",
        externalAccountId: null,
        email: "codex-a1@example.com",
        displayName: "Codex A1",
        status: "enabled",
        disabledReason: null,
        metadata: {},
        createdAt: now - 200,
        updatedAt: now - 100,
      },
      reason: "sticky_binding",
    });

    render(<SettingsCodexAccountsCard />);

    fireEvent.click(screen.getByRole("tab", { name: /Pools/i }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Probe" })).not.toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Probe" }));

    await waitFor(() => {
      expect(selectOAuthPoolAccountMock).toHaveBeenCalledWith({
        poolId: "pool-codex",
        sessionId: "settings-probe-pool-codex",
      });
    });

    expect(screen.queryByText(/Last probe: codex-a1 \(sticky_binding\)/)).not.toBeNull();
  });

  it("reports and clears pool rate limit via runtime bridge", async () => {
    const now = Date.now();
    listOAuthAccountsMock.mockResolvedValue([
      {
        accountId: "codex-a1",
        provider: "codex",
        externalAccountId: null,
        email: "codex-a1@example.com",
        displayName: "Codex A1",
        status: "enabled",
        disabledReason: null,
        metadata: {},
        createdAt: now - 200,
        updatedAt: now - 100,
      },
    ]);
    listOAuthPoolsMock.mockResolvedValue([
      {
        poolId: "pool-codex",
        provider: "codex",
        name: "Codex Pool",
        strategy: "round_robin",
        stickyMode: "cache_first",
        preferredAccountId: "codex-a1",
        enabled: true,
        metadata: {},
        createdAt: now - 100,
        updatedAt: now,
      },
    ]);

    render(<SettingsCodexAccountsCard />);

    fireEvent.click(screen.getByRole("tab", { name: /Pools/i }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Mark limited" })).not.toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Mark limited" }));

    await waitFor(() => {
      expect(reportOAuthRateLimitMock).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: "codex-a1",
          success: false,
          retryAfterSec: 60,
          errorCode: "rate_limit_exceeded",
        })
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Clear limit" }));

    await waitFor(() => {
      expect(reportOAuthRateLimitMock).toHaveBeenCalledWith({
        accountId: "codex-a1",
        success: true,
      });
    });
  });

  it("filters accounts by status and search query", async () => {
    const now = Date.now();
    listOAuthAccountsMock.mockResolvedValue([
      {
        accountId: "codex-enabled-1",
        provider: "codex",
        externalAccountId: null,
        email: "enabled@example.com",
        displayName: "Enabled Codex",
        status: "enabled",
        disabledReason: null,
        metadata: {},
        createdAt: now - 3_000,
        updatedAt: now - 3_000,
      },
      {
        accountId: "gemini-disabled-1",
        provider: "gemini",
        externalAccountId: null,
        email: "gemini-disabled@example.com",
        displayName: "Gemini Disabled",
        status: "disabled",
        disabledReason: "manual_toggle",
        metadata: {},
        createdAt: now - 2_000,
        updatedAt: now - 2_000,
      },
      {
        accountId: "claude-disabled-1",
        provider: "claude_code",
        externalAccountId: null,
        email: "claude-disabled@example.com",
        displayName: "Claude Disabled",
        status: "disabled",
        disabledReason: "manual_toggle",
        metadata: {},
        createdAt: now - 1_000,
        updatedAt: now - 1_000,
      },
    ]);
    listOAuthPoolsMock.mockResolvedValue([]);

    render(<SettingsCodexAccountsCard />);

    await waitFor(() => {
      expect(screen.queryByLabelText("Select account codex-enabled-1")).not.toBeNull();
      expect(screen.queryByLabelText("Select account gemini-disabled-1")).not.toBeNull();
      expect(screen.queryByLabelText("Select account claude-disabled-1")).not.toBeNull();
    });

    await chooseSelectOption("Filter accounts by status", /disabled/i);
    fireEvent.change(screen.getByLabelText("Search accounts"), {
      target: { value: "gemini" },
    });

    expect(screen.queryByLabelText("Select account codex-enabled-1")).toBeNull();
    expect(screen.queryByLabelText("Select account gemini-disabled-1")).not.toBeNull();
    expect(screen.queryByLabelText("Select account claude-disabled-1")).toBeNull();
  });

  it("re-authenticates codex account from the row action", async () => {
    const now = Date.now();
    listOAuthAccountsMock.mockResolvedValue([
      {
        accountId: "codex-auth-1",
        provider: "codex",
        externalAccountId: "ws-codex",
        email: "codex-auth@example.com",
        displayName: "Codex Auth",
        status: "enabled",
        disabledReason: null,
        metadata: {},
        createdAt: now - 1_000,
        updatedAt: now - 500,
      },
    ]);
    listOAuthPoolsMock.mockResolvedValue([]);
    listWorkspacesMock.mockResolvedValue([
      {
        id: "ws-fallback",
        name: "Fallback",
        path: "/tmp/fallback",
        connected: true,
        settings: { sidebarCollapsed: false },
      },
      {
        id: "ws-codex",
        name: "Codex",
        path: "/tmp/codex",
        connected: false,
        settings: { sidebarCollapsed: false },
      },
    ]);
    runCodexLoginMock.mockResolvedValue({
      loginId: "login-reauth",
      authUrl: "",
      immediateSuccess: true,
    });

    render(<SettingsCodexAccountsCard />);

    fireEvent.click(await screen.findByRole("button", { name: "Re-authenticate" }));

    await waitFor(() => {
      expect(runCodexLoginMock).toHaveBeenCalledWith("ws-codex", { forceOAuth: true });
    });
    await waitFor(() => {
      expect(listOAuthAccountsMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("autosaves renamed pool names", async () => {
    const now = Date.now();
    listOAuthAccountsMock.mockResolvedValue([
      {
        accountId: "codex-member-1",
        provider: "codex",
        externalAccountId: null,
        email: "member@example.com",
        displayName: "Member",
        status: "enabled",
        disabledReason: null,
        metadata: {},
        createdAt: now - 2_000,
        updatedAt: now - 1_500,
      },
    ]);
    listOAuthPoolsMock.mockResolvedValue([
      {
        poolId: "pool-codex-rename",
        provider: "codex",
        name: "Codex Rename",
        strategy: "round_robin",
        stickyMode: "cache_first",
        preferredAccountId: "codex-member-1",
        enabled: true,
        metadata: {},
        createdAt: now - 1_000,
        updatedAt: now - 1_000,
      },
    ]);
    listOAuthPoolMembersMock.mockResolvedValue([
      {
        poolId: "pool-codex-rename",
        accountId: "codex-member-1",
        weight: 1,
        priority: 0,
        position: 0,
        enabled: true,
        createdAt: now - 900,
        updatedAt: now - 900,
      },
    ]);

    render(<SettingsCodexAccountsCard />);
    fireEvent.click(screen.getByRole("tab", { name: /Pools/i }));

    const nameInput = await screen.findByLabelText("Name for pool pool-codex-rename");
    fireEvent.change(nameInput, { target: { value: "Codex Renamed Pool" } });
    fireEvent.blur(nameInput);

    await waitFor(() => {
      expect(applyOAuthPoolMock).toHaveBeenCalledWith(
        expect.objectContaining({
          pool: expect.objectContaining({
            poolId: "pool-codex-rename",
            name: "Codex Renamed Pool",
          }),
        })
      );
    });
  });

  it("routes pool-codex preferred account changes through oauth primary account", async () => {
    const now = Date.now();
    getOAuthPrimaryAccountMock.mockResolvedValue({
      provider: "codex",
      accountId: "codex-a1",
      account: null,
      defaultPoolId: "pool-codex",
      routeAccountId: "codex-a1",
      inSync: true,
      createdAt: now - 2_000,
      updatedAt: now - 1_000,
    });
    setOAuthPrimaryAccountMock.mockResolvedValue({
      provider: "codex",
      accountId: "codex-a2",
      account: null,
      defaultPoolId: "pool-codex",
      routeAccountId: "codex-a2",
      inSync: true,
      createdAt: now - 2_000,
      updatedAt: now,
    });
    listOAuthAccountsMock.mockResolvedValue([
      {
        accountId: "codex-a1",
        provider: "codex",
        externalAccountId: null,
        email: "codex-a1@example.com",
        displayName: "Codex A1",
        status: "enabled",
        disabledReason: null,
        metadata: {},
        createdAt: now - 2_000,
        updatedAt: now - 1_500,
      },
      {
        accountId: "codex-a2",
        provider: "codex",
        externalAccountId: null,
        email: "codex-a2@example.com",
        displayName: "Codex A2",
        status: "enabled",
        disabledReason: null,
        metadata: {},
        createdAt: now - 1_900,
        updatedAt: now - 1_400,
      },
    ]);
    listOAuthPoolsMock.mockResolvedValue([
      {
        poolId: "pool-codex",
        provider: "codex",
        name: "Codex Pool",
        strategy: "round_robin",
        stickyMode: "cache_first",
        preferredAccountId: "codex-a1",
        enabled: true,
        metadata: {},
        createdAt: now - 1_000,
        updatedAt: now - 1_000,
      },
    ]);
    listOAuthPoolMembersMock.mockResolvedValue([
      {
        poolId: "pool-codex",
        accountId: "codex-a1",
        weight: 1,
        priority: 0,
        position: 0,
        enabled: true,
        createdAt: now - 900,
        updatedAt: now - 900,
      },
      {
        poolId: "pool-codex",
        accountId: "codex-a2",
        weight: 1,
        priority: 1,
        position: 1,
        enabled: true,
        createdAt: now - 890,
        updatedAt: now - 890,
      },
    ]);

    render(<SettingsCodexAccountsCard />);
    await waitFor(() => {
      expect(listOAuthAccountsMock).toHaveBeenCalledTimes(1);
      expect(listOAuthPoolsMock).toHaveBeenCalledTimes(1);
    });
    fireEvent.click(screen.getByRole("tab", { name: /Pools/i }));
    await screen.findByLabelText("Name for pool pool-codex");

    await selectAccountOption("Preferred account for pool pool-codex", "Codex A2");

    await waitFor(() => {
      expect(setOAuthPrimaryAccountMock).toHaveBeenCalledWith({
        provider: "codex",
        accountId: "codex-a2",
      });
    });
    await waitFor(() => {
      expect(applyOAuthPoolMock).toHaveBeenCalledWith(
        expect.objectContaining({
          pool: expect.objectContaining({
            poolId: "pool-codex",
            preferredAccountId: "codex-a2",
          }),
        })
      );
    });
  });

  it("renders runtime usage snapshot and supports account usage refresh", async () => {
    const now = Date.now();
    listOAuthAccountsMock.mockResolvedValue([
      {
        accountId: "codex-usage-1",
        provider: "codex",
        externalAccountId: "ext-codex-usage-1",
        email: "usage@example.com",
        displayName: "Usage Account",
        status: "enabled",
        disabledReason: null,
        metadata: {
          planType: "pro",
          usageCheckedAt: now - 15_000,
          rateLimits: {
            primary: {
              usedPercent: 42,
              resetsAt: now + 120_000,
            },
            secondary: {
              usedPercent: 68,
              resetsAt: now + 3600_000,
            },
            credits: {
              hasCredits: true,
              unlimited: false,
              balance: "15",
            },
          },
        },
        createdAt: now - 60_000,
        updatedAt: now - 5_000,
      },
    ]);
    listOAuthPoolsMock.mockResolvedValue([]);

    render(<SettingsCodexAccountsCard />);

    expect(await screen.findByText("Session")).toBeTruthy();
    expect(screen.getByText("Weekly")).toBeTruthy();
    expect(screen.getByText("Credits: 15 credits")).toBeTruthy();
    expect(screen.getByText("pro")).toBeTruthy();
    expect(
      screen.getByRole("progressbar", { name: /session quota/i }).getAttribute("aria-valuenow")
    ).toBe("42");
    expect(
      screen.getByRole("progressbar", { name: /weekly quota/i }).getAttribute("aria-valuenow")
    ).toBe("68");

    fireEvent.click(
      screen.getByRole("button", { name: "Refresh usage for account codex-usage-1" })
    );

    await waitFor(() => {
      expect(listOAuthAccountsMock.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(listOAuthPoolsMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });
});
