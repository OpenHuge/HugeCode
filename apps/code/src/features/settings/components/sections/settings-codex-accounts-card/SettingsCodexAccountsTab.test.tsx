// @vitest-environment jsdom

import { createRef, type ComponentProps } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsCodexAccountsTab } from "./SettingsCodexAccountsTab";
import type { ProviderOption } from "../settingsCodexAccountsCardUtils";
import type { OAuthAccountSummary } from "../../../../../application/runtime/ports/oauth";

const providerOptions: ProviderOption[] = [
  {
    id: "codex",
    routeProviderId: "codex",
    label: "Codex",
    available: true,
    supportsNative: true,
    supportsOpenaiCompat: true,
  },
];

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
    chatgptWorkspaces: null,
    defaultChatgptWorkspaceId: null,
    metadata: {},
    createdAt: 100,
    updatedAt: 200,
    ...overrides,
  };
}

function renderTab(
  accounts: OAuthAccountSummary[],
  overrides: Partial<ComponentProps<typeof SettingsCodexAccountsTab>> = {}
) {
  const noop = () => undefined;
  const setString = vi.fn();
  const setIds = vi.fn();
  const setProvider = vi.fn();
  const setStatus = vi.fn();
  const onUpdateDefaultChatgptWorkspace = vi.fn();
  render(
    <SettingsCodexAccountsTab
      onRefresh={noop}
      importSummary={null}
      busyAction={null}
      accountCreateSectionRef={createRef<HTMLElement>()}
      providerOptions={providerOptions}
      selectedAccountProvider={providerOptions[0]}
      accountProviderDraft="codex"
      setAccountProviderDraft={setString}
      codexProviderSelected
      codexAuthRequired={false}
      accountEmailDraft=""
      setAccountEmailDraft={setString}
      accountDisplayNameDraft=""
      setAccountDisplayNameDraft={setString}
      accountPlanDraft=""
      setAccountPlanDraft={setString}
      accountCompatBaseUrlDraft=""
      setAccountCompatBaseUrlDraft={setString}
      accountProxyIdDraft=""
      setAccountProxyIdDraft={setString}
      onAddAccount={noop}
      onImportCockpitTools={noop}
      accountProviderFilter="all"
      setAccountProviderFilter={setProvider}
      accountStatusFilter="all"
      setAccountStatusFilter={setStatus}
      accountSearchQuery=""
      setAccountSearchQuery={setString}
      accounts={accounts}
      visibleAccounts={accounts}
      selectedAccountIds={[]}
      setSelectedAccountIds={setIds}
      selectedAccounts={[]}
      selectedAccountIdSet={new Set()}
      hiddenSelectedAccountsCount={0}
      onClearHiddenSelectedAccounts={noop}
      onBulkAccountStatus={noop}
      onBulkRemoveAccounts={noop}
      onRefreshUsage={noop}
      onToggleAccountStatus={noop}
      onUpdateDefaultChatgptWorkspace={onUpdateDefaultChatgptWorkspace}
      onReauthenticateAccount={noop}
      onRemoveAccount={noop}
      subscriptionPersistenceCapability={{
        hostMode: "electron-bridge",
        persistenceKind: "runtime-backed",
        runtimeBacked: true,
        durableStorage: true,
        workspaceAwareSessionBinding: true,
        summary:
          "Runtime-backed subscription persistence is active. ChatGPT workspace memberships and workspace-aware session bindings are durably stored.",
      }}
      {...overrides}
    />
  );
  return { onUpdateDefaultChatgptWorkspace };
}

describe("SettingsCodexAccountsTab", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders a default ChatGPT workspace selector when an account belongs to multiple workspaces", () => {
    const account = createAccount({
      chatgptWorkspaces: [
        { workspaceId: "org-a", title: "Org A", role: "member", isDefault: true },
        { workspaceId: "org-b", title: "Org B", role: "owner", isDefault: false },
      ],
      defaultChatgptWorkspaceId: "org-a",
    });

    renderTab([account]);

    const select = screen.getByRole("button", {
      name: "Default ChatGPT workspace for account acct-codex-1",
    });
    expect(select.textContent).toContain("Org A (member)");
    fireEvent.click(select);
    expect(screen.getByRole("option", { name: "Org A (member)" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Org B (owner)" })).toBeTruthy();
    expect(
      screen.getAllByText("ChatGPT workspaces are separate from project workspaces.").length
    ).toBeGreaterThan(0);
  });

  it("sends the selected default ChatGPT workspace without hiding the account memberships", () => {
    const account = createAccount({
      chatgptWorkspaces: [
        { workspaceId: "org-a", title: "Org A", role: "member", isDefault: true },
        { workspaceId: "org-b", title: "Org B", role: "owner", isDefault: false },
      ],
      defaultChatgptWorkspaceId: "org-a",
    });

    const { onUpdateDefaultChatgptWorkspace } = renderTab([account]);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Default ChatGPT workspace for account acct-codex-1",
      })
    );
    fireEvent.click(screen.getByRole("option", { name: "Org B (owner)" }));

    expect(onUpdateDefaultChatgptWorkspace).toHaveBeenCalledWith(account, "org-b");
    expect(screen.getByText(/ChatGPT workspaces Org A \(member\), Org B \(owner\)/)).toBeTruthy();
  });

  it("keeps single-workspace accounts in simplified read-only mode", () => {
    const account = createAccount({
      chatgptWorkspaces: [
        { workspaceId: "org-single", title: "Solo Org", role: null, isDefault: true },
      ],
      defaultChatgptWorkspaceId: "org-single",
    });

    renderTab([account]);

    expect(
      screen.queryByLabelText("Default ChatGPT workspace for account acct-codex-1")
    ).toBeNull();
    expect(screen.getByText(/Default ChatGPT workspace org-single/)).toBeTruthy();
  });

  it("shows runtime-backed subscription persistence status separately from project workspace messaging", () => {
    renderTab([createAccount()]);

    expect(
      screen.getByText(
        /Runtime-backed subscription persistence is active\. ChatGPT workspace memberships and workspace-aware session bindings are durably stored\./
      )
    ).toBeTruthy();
    expect(
      screen.getByText(/ChatGPT workspaces are separate from project workspaces\./)
    ).toBeTruthy();
  });

  it("shows unavailable subscription persistence status when the host is not durably persisting oauth subscriptions", () => {
    renderTab([createAccount()], {
      subscriptionPersistenceCapability: {
        hostMode: "runtime-gateway-web",
        persistenceKind: "runtime-unavailable",
        runtimeBacked: false,
        durableStorage: false,
        workspaceAwareSessionBinding: false,
        summary:
          "Web runtime durable OAuth persistence is unavailable. Authentication is not complete, no durable account or workspace binding has been written, and the UI must remain disconnected until runtime-backed OAuth recovers.",
      },
    });

    expect(
      screen.getByText(
        /Web runtime durable OAuth persistence is unavailable\. Authentication is not complete, no durable account or workspace binding has been written, and the UI must remain disconnected until runtime-backed OAuth recovers\./
      )
    ).toBeTruthy();
  });

  it("renders the cockpit-tools import entry for Codex and invokes the handler", () => {
    const onImportCockpitTools = vi.fn();

    renderTab([createAccount()], {
      onImportCockpitTools,
      importSummary: "Imported 3 accounts from cockpit-tools.",
    });

    fireEvent.click(screen.getByRole("button", { name: "Import from cockpit-tools" }));

    expect(onImportCockpitTools).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Imported 3 accounts from cockpit-tools.")).toBeTruthy();
  });

  it("renders account identity metadata and quota progress sections in the card layout", () => {
    renderTab([
      createAccount({
        email: "nitian12345@gmail.com",
        metadata: {
          authProvider: "google",
          userId: "usr_google_123",
          rateLimits: {
            primary: {
              usedPercent: 100,
              resetsAt: Date.UTC(2026, 2, 15, 19, 37),
            },
            secondary: {
              usedPercent: 56,
              resetsAt: Date.UTC(2026, 2, 20, 0, 19),
            },
            planType: "team",
          },
          usageCheckedAt: Date.UTC(2026, 2, 15, 11, 37),
        },
        chatgptWorkspaces: [
          {
            workspaceId: "team-marcos",
            title: "MarcosSauerkadkpq",
            role: "owner",
            isDefault: true,
          },
        ],
        defaultChatgptWorkspaceId: "team-marcos",
      }),
    ]);

    expect(screen.getByText("Team Name")).toBeTruthy();
    expect(screen.getByText("MarcosSauerkadkpq")).toBeTruthy();
    expect(screen.getByText(/Signed in with Google/i)).toBeTruthy();
    expect(screen.getByText(/User ID: usr_google_123/i)).toBeTruthy();
    const avatar = document.querySelector(".apm-row-avatar[data-family='avatar']");
    expect(avatar?.getAttribute("data-size")).toBe("lg");
    expect(avatar?.getAttribute("data-shape")).toBe("rounded");
    expect(avatar?.textContent).toBe("NI");
    const chips = Array.from(document.querySelectorAll(".apm-row-pills [data-shape='chip']"));
    expect(chips.length).toBeGreaterThanOrEqual(1);
    expect(document.querySelector(".apm-plan-chip[data-status-tone='progress']")).toBeTruthy();
    expect(document.querySelector(".apm-status-chip[data-status-tone='success']")).toBeTruthy();
    expect(
      document.querySelector(".apm-row-support-chip[data-status-tone='default']")
    ).toBeTruthy();
    expect(screen.getByText("Session")).toBeTruthy();
    expect(screen.getByText("Weekly")).toBeTruthy();
    expect(
      screen.getByRole("progressbar", { name: /session quota/i }).getAttribute("aria-valuenow")
    ).toBe("100");
    expect(
      screen.getByRole("progressbar", { name: /weekly quota/i }).getAttribute("aria-valuenow")
    ).toBe("56");
  });
});
