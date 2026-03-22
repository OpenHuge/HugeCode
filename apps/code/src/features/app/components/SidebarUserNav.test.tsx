// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { preloadSettingsViewMock } = vi.hoisted(() => ({
  preloadSettingsViewMock: vi.fn(),
}));

vi.mock("../../settings/components/settingsViewLoader", () => ({
  preloadSettingsView: preloadSettingsViewMock,
}));

import { SidebarUserNav } from "./SidebarUserNav";

function renderSidebarUserNav(overrides: Partial<ComponentProps<typeof SidebarUserNav>> = {}) {
  const props: ComponentProps<typeof SidebarUserNav> = {
    accountInfo: {
      type: "chatgpt",
      email: "user@example.com",
      planType: "Pro",
      requiresOpenaiAuth: false,
      provider: "codex",
      accountId: "codex-a1",
      externalAccountId: "sample-handle",
      displayName: "sample-handle",
      authMode: "chatgpt",
      localCliManaged: false,
    },
    accountCenter: {
      loading: false,
      error: null,
      codex: {
        defaultPoolName: "Codex Default",
        defaultRouteAccountId: "codex-a1",
        defaultRouteAccountLabel: "user@example.com",
        connectedAccounts: [
          {
            accountId: "codex-a1",
            label: "user@example.com",
            status: "enabled",
            isDefaultRoute: true,
            canReauthenticate: true,
            updatedAtLabel: "Updated just now",
          },
          {
            accountId: "codex-a2",
            label: "other@example.com",
            status: "enabled",
            isDefaultRoute: false,
            canReauthenticate: true,
            updatedAtLabel: "Updated just now",
          },
        ],
        defaultRouteBusyAccountId: null,
        reauthenticatingAccountId: null,
      },
      providers: [],
      setCodexDefaultRouteAccount: vi.fn(),
      reauthenticateCodexAccount: vi.fn(),
    },
    onOpenSettings: vi.fn(),
    onOpenDebug: vi.fn(),
    showDebugButton: false,
    onSwitchAccount: vi.fn(),
    onSelectLoggedInCodexAccount: vi.fn(),
    onCancelSwitchAccount: vi.fn(),
    accountSwitching: false,
    accountSwitchError: null,
    usage: {
      usageTitle: "Rate limits used",
      sessionLabel: "Session",
      weeklyLabel: "Weekly",
      sessionPercent: 12,
      weeklyPercent: 34,
      sessionResetLabel: null,
      weeklyResetLabel: null,
      creditsLabel: null,
    },
    ...overrides,
  };
  return render(<SidebarUserNav {...props} />);
}

describe("SidebarUserNav", () => {
  beforeEach(() => {
    cleanup();
    preloadSettingsViewMock.mockClear();
  });

  afterEach(() => {
    if (vi.isFakeTimers()) {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    }
  });

  it("renders usage and account actions in the simplified menu", async () => {
    vi.useFakeTimers();
    const onSwitchAccount = vi.fn();
    const onOpenSettings = vi.fn();
    const onSelectLoggedInCodexAccount = vi.fn().mockResolvedValue(undefined);
    renderSidebarUserNav({
      onSwitchAccount,
      onOpenSettings,
      onSelectLoggedInCodexAccount,
      accountCenter: {
        loading: false,
        error: null,
        codex: {
          defaultPoolName: "Codex Default",
          defaultRouteAccountId: "codex-a1",
          defaultRouteAccountLabel: "user@example.com",
          connectedAccounts: [
            {
              accountId: "codex-a1",
              label: "user@example.com",
              status: "enabled",
              isDefaultRoute: true,
              canReauthenticate: true,
              updatedAtLabel: "Updated just now",
            },
            {
              accountId: "codex-a2",
              label: "other@example.com",
              status: "enabled",
              isDefaultRoute: false,
              canReauthenticate: true,
              updatedAtLabel: "Updated just now",
            },
          ],
          defaultRouteBusyAccountId: null,
          reauthenticatingAccountId: null,
        },
        providers: [],
        setCodexDefaultRouteAccount: vi.fn(),
        reauthenticateCodexAccount: vi.fn(),
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "User menu" }));

    expect(screen.getByText("Rate limits used")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Manage Accounts & Billing" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Manage Accounts & Billing" }));
    act(() => {
      vi.runAllTimers();
    });
    expect(onOpenSettings).toHaveBeenCalledWith("codex");

    fireEvent.click(screen.getByRole("button", { name: "User menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Switch Codex account" }));
    expect(screen.getByText("Choose from logged-in Codex accounts")).toBeTruthy();
    expect(
      screen.getByText(
        "Project workspace routing is separate from ChatGPT workspace membership. Manage ChatGPT workspaces in Accounts & Billing."
      )
    ).toBeTruthy();
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Use logged-in Codex account other@example.com" })
      );
    });
    expect(onSelectLoggedInCodexAccount).toHaveBeenCalledWith("codex-a2");
    expect(onSwitchAccount).not.toHaveBeenCalled();
  });

  it("keeps oauth login as an explicit secondary action", () => {
    const onSwitchAccount = vi.fn();
    renderSidebarUserNav({ onSwitchAccount });

    fireEvent.click(screen.getByRole("button", { name: "User menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Switch Codex account" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign in another account" }));

    expect(onSwitchAccount).toHaveBeenCalledTimes(1);
  });

  it("shows usage reset and credits details when provided", () => {
    renderSidebarUserNav({
      usage: {
        usageTitle: "Rate limits remaining",
        sessionLabel: "Session remaining",
        weeklyLabel: "Weekly remaining",
        sessionPercent: 12,
        weeklyPercent: 34,
        sessionResetLabel: "Resets in 10m",
        weeklyResetLabel: "Resets in 2d",
        creditsLabel: "Credits: 123 credits",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "User menu" }));

    expect(screen.getByText("Rate limits remaining")).toBeTruthy();
    expect(screen.getByText("Session remaining")).toBeTruthy();
    expect(screen.getByText("Resets in 10m")).toBeTruthy();
    expect(screen.getByText("Weekly remaining 34%")).toBeTruthy();
    expect(screen.getByText("Credits: 123 credits")).toBeTruthy();
  });

  it("shows the oauth identity in the trigger and does not coerce missing usage to 0%", () => {
    renderSidebarUserNav({
      usage: {
        usageTitle: "Rate limits remaining",
        sessionLabel: "Session remaining",
        weeklyLabel: "Weekly remaining",
        sessionPercent: null,
        weeklyPercent: null,
        sessionResetLabel: null,
        weeklyResetLabel: null,
        creditsLabel: null,
      },
    });

    expect(screen.getByText("sample-handle")).toBeTruthy();
    const avatar = document.querySelector(".sidebar-user-avatar[data-family='avatar']");
    expect(avatar?.getAttribute("data-size")).toBe("sm");
    expect(avatar?.getAttribute("data-shape")).toBe("circle");

    fireEvent.click(screen.getByRole("button", { name: "User menu" }));

    expect(screen.getByText("Usage data unavailable.")).toBeTruthy();
    expect(screen.queryByText("0%")).toBeNull();
  });

  it("prefers the default ChatGPT workspace title over account ids in the trigger", () => {
    renderSidebarUserNav({
      accountInfo: {
        type: "chatgpt",
        email: "nitian12345@gmail.com",
        planType: "Pro",
        requiresOpenaiAuth: false,
        provider: "codex",
        accountId: "acct-codex-1",
        externalAccountId: "MarcosSauerkraoqpq",
        displayName: "MarcosSauerkraoqpq",
        defaultChatgptWorkspaceTitle: "Marcos Sauer",
      },
    });

    expect(screen.getByText("Marcos Sauer")).toBeTruthy();
    expect(screen.queryByText("acct-codex-1")).toBeNull();
  });

  it("falls back to external account id when display name is unavailable", () => {
    renderSidebarUserNav({
      accountInfo: {
        type: "chatgpt",
        email: "sample-user@example.com",
        planType: null,
        requiresOpenaiAuth: false,
        provider: "codex",
        accountId: "cli-account-1",
        externalAccountId: "sample-handle",
        displayName: null,
        authMode: "api_key",
        localCliManaged: true,
      },
    });

    expect(screen.getByText("sample-user@example.com")).toBeTruthy();
    expect(screen.getByText("sample-handle")).toBeTruthy();
  });

  it("shows a connect-account state instead of Guest when no account is available", () => {
    renderSidebarUserNav({
      accountInfo: null,
      accountCenter: {
        loading: false,
        error: null,
        codex: {
          defaultPoolName: "Codex Default",
          defaultRouteAccountId: null,
          defaultRouteAccountLabel: "No default route account",
          connectedAccounts: [],
          defaultRouteBusyAccountId: null,
          reauthenticatingAccountId: null,
        },
        providers: [],
        setCodexDefaultRouteAccount: vi.fn(),
        reauthenticateCodexAccount: vi.fn(),
      },
    });

    expect(screen.getByText("Connect account")).toBeTruthy();
    expect(screen.getByText("No Codex account connected")).toBeTruthy();
    expect(screen.queryByText("Guest")).toBeNull();
  });

  it("shows an account-picker state when accounts are ready but none is routed", () => {
    renderSidebarUserNav({
      accountInfo: null,
    });

    expect(screen.getByText("Choose account")).toBeTruthy();
    expect(screen.getByText("2 Codex accounts ready")).toBeTruthy();
  });

  it("opens settings and debug actions", () => {
    vi.useFakeTimers();
    const onOpenSettings = vi.fn();
    const onOpenDebug = vi.fn();

    renderSidebarUserNav({
      onOpenSettings,
      onOpenDebug,
      showDebugButton: true,
    });

    fireEvent.click(screen.getByRole("button", { name: "User menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    act(() => {
      vi.runAllTimers();
    });

    expect(onOpenSettings).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "User menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Open debug log" }));
    act(() => {
      vi.runAllTimers();
    });

    expect(onOpenDebug).toHaveBeenCalledTimes(1);
  });

  it("preloads settings when the user menu becomes likely to open settings", () => {
    renderSidebarUserNav();

    fireEvent.pointerEnter(screen.getByRole("button", { name: "User menu" }));
    fireEvent.click(screen.getByRole("button", { name: "User menu" }));
    fireEvent.pointerEnter(screen.getByRole("button", { name: "Open settings" }));

    expect(preloadSettingsViewMock).toHaveBeenCalledTimes(3);
  });

  it("shows cancel action while codex account switching is in progress", () => {
    const onCancelSwitchAccount = vi.fn();
    renderSidebarUserNav({
      accountSwitching: true,
      onCancelSwitchAccount,
    });

    fireEvent.click(screen.getByRole("button", { name: "User menu" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Cancel project workspace Codex account switch" })
    );

    expect(
      screen.getByText("Switching the routed Codex account for this project workspace")
    ).toBeTruthy();
    expect(onCancelSwitchAccount).toHaveBeenCalledTimes(1);
  });

  it("labels the routed account section as project-workspace specific", () => {
    renderSidebarUserNav();

    fireEvent.click(screen.getByRole("button", { name: "User menu" }));

    expect(screen.getByText("Current project workspace Codex route")).toBeTruthy();
    expect(
      screen.getByText(
        "This is the Codex account currently routed into the active project workspace."
      )
    ).toBeTruthy();
    expect(
      document.querySelector(
        '.sidebar-account-card-badge[data-status-tone="default"][data-shape="chip"]'
      )
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Switch Codex account" }));
    expect(
      document.querySelector(
        '.sidebar-account-choice-badge[data-status-tone="default"][data-shape="chip"]'
      )
    ).toBeTruthy();
  });

  it("renders current and switching route markers through shared badges", () => {
    renderSidebarUserNav({
      accountCenter: {
        loading: false,
        error: null,
        codex: {
          defaultPoolName: "Codex Default",
          defaultRouteAccountId: "codex-a1",
          defaultRouteAccountLabel: "user@example.com",
          connectedAccounts: [
            {
              accountId: "codex-a1",
              label: "user@example.com",
              status: "enabled",
              isDefaultRoute: true,
              canReauthenticate: true,
              updatedAtLabel: "Updated just now",
            },
            {
              accountId: "codex-a2",
              label: "other@example.com",
              status: "enabled",
              isDefaultRoute: false,
              canReauthenticate: true,
              updatedAtLabel: "Updated just now",
            },
          ],
          defaultRouteBusyAccountId: "codex-a2",
          reauthenticatingAccountId: null,
        },
        providers: [],
        setCodexDefaultRouteAccount: vi.fn(),
        reauthenticateCodexAccount: vi.fn(),
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "User menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Switch Codex account" }));

    expect(
      document.querySelector(
        '.sidebar-account-choice-badge[data-status-tone="progress"][data-shape="chip"]'
      )
    ).toBeTruthy();
    expect(
      document.querySelector(
        '.sidebar-account-choice-badge[data-status-tone="warning"][data-shape="chip"]'
      )
    ).toBeTruthy();
  });
});
