// @vitest-environment jsdom

import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  actAndFlush,
  applyOAuthPoolMock,
  baseSettings,
  chooseSelectOption,
  createDoctorResult,
  createUpdateResult,
  getProvidersCatalogMock,
  listOAuthAccountsMock,
  listOAuthPoolMembersMock,
  listOAuthPoolsMock,
  renderSettled,
  SharedSettingsView,
  upsertOAuthAccountMock,
  upsertOAuthPoolMock,
  workspace,
} from "./SettingsView.test.shared";

const CODEX_ACCOUNTS_TIMEOUT_MS = 30_000;

describe("SettingsView Codex accounts", () => {
  const switchToPoolsTab = async () => {
    fireEvent.click(await screen.findByRole("tab", { name: /Pools/i }));
    await waitFor(() => {
      expect(screen.queryByLabelText("Filter pools by provider")).not.toBeNull();
    });
  };

  const _switchToHealthTab = async () => {
    fireEvent.click(await screen.findByRole("tab", { name: /Health/i }));
    await waitFor(() => {
      expect(screen.queryByText("Pool Routing Health")).not.toBeNull();
    });
  };

  it(
    "disables add actions when selected provider is unavailable",
    async () => {
      cleanup();
      getProvidersCatalogMock.mockResolvedValue([
        {
          oauthProviderId: "codex",
          displayName: "Codex",
          available: false,
          supportsNative: false,
          supportsOpenaiCompat: true,
        },
      ]);

      await renderSettled(
        <SharedSettingsView
          workspaceGroups={[]}
          groupedWorkspaces={[
            {
              id: null,
              name: "Ungrouped",
              workspaces: [workspace({ id: "w1", name: "Workspace", connected: true })],
            },
          ]}
          ungroupedLabel="Ungrouped"
          onClose={vi.fn()}
          onMoveWorkspace={vi.fn()}
          onDeleteWorkspace={vi.fn()}
          onCreateWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onRenameWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onMoveWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onDeleteWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onAssignWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          reduceTransparency={false}
          onToggleTransparency={vi.fn()}
          appSettings={baseSettings}
          openAppIconById={{}}
          onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
          onRunDoctor={vi.fn().mockResolvedValue(createDoctorResult())}
          onRunCodexUpdate={vi.fn().mockResolvedValue(createUpdateResult())}
          onUpdateWorkspaceCodexBin={vi.fn().mockResolvedValue(undefined)}
          onUpdateWorkspaceSettings={vi.fn().mockResolvedValue(undefined)}
          scaleShortcutTitle="Scale shortcut"
          scaleShortcutText="Use Command +/-"
          onTestNotificationSound={vi.fn()}
          onTestSystemNotification={vi.fn()}
          dictationModelStatus={null}
          onDownloadDictationModel={vi.fn()}
          onCancelDictationDownload={vi.fn()}
          onRemoveDictationModel={vi.fn()}
          initialSection="codex"
        />
      );

      expect(document.querySelector('[data-settings-section-frame="true"]')).toBeTruthy();
      expect(
        screen.getByText("Accounts", {
          selector: '[data-settings-field-group-title="true"]',
        })
      ).toBeTruthy();

      await waitFor(
        () => {
          expect(
            (screen.getByRole("button", { name: "Sign in with OAuth" }) as HTMLButtonElement)
              .disabled
          ).toBe(true);
        },
        { timeout: 5_000 }
      );

      await switchToPoolsTab();

      expect((screen.getByRole("button", { name: "Add pool" }) as HTMLButtonElement).disabled).toBe(
        true
      );
      expect(
        screen.getByText("Codex is unavailable until provider catalog reports it healthy.")
      ).toBeTruthy();
    },
    CODEX_ACCOUNTS_TIMEOUT_MS
  );

  it(
    "adds a provider account from the Codex section",
    async () => {
      cleanup();
      await renderSettled(
        <SharedSettingsView
          workspaceGroups={[]}
          groupedWorkspaces={[
            {
              id: null,
              name: "Ungrouped",
              workspaces: [workspace({ id: "w1", name: "Workspace", connected: true })],
            },
          ]}
          ungroupedLabel="Ungrouped"
          onClose={vi.fn()}
          onMoveWorkspace={vi.fn()}
          onDeleteWorkspace={vi.fn()}
          onCreateWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onRenameWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onMoveWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onDeleteWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onAssignWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          reduceTransparency={false}
          onToggleTransparency={vi.fn()}
          appSettings={baseSettings}
          openAppIconById={{}}
          onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
          onRunDoctor={vi.fn().mockResolvedValue(createDoctorResult())}
          onRunCodexUpdate={vi.fn().mockResolvedValue(createUpdateResult())}
          onUpdateWorkspaceCodexBin={vi.fn().mockResolvedValue(undefined)}
          onUpdateWorkspaceSettings={vi.fn().mockResolvedValue(undefined)}
          scaleShortcutTitle="Scale shortcut"
          scaleShortcutText="Use Command +/-"
          onTestNotificationSound={vi.fn()}
          onTestSystemNotification={vi.fn()}
          dictationModelStatus={null}
          onDownloadDictationModel={vi.fn()}
          onCancelDictationDownload={vi.fn()}
          onRemoveDictationModel={vi.fn()}
          initialSection="codex"
        />
      );

      await chooseSelectOption(screen, "Account provider", "Gemini");
      fireEvent.change(screen.getByLabelText("Account email"), {
        target: { value: "gemini@example.com" },
      });
      fireEvent.change(screen.getByLabelText("Account display name"), {
        target: { value: "Gem Account" },
      });
      fireEvent.change(screen.getByLabelText("Account plan type"), {
        target: { value: "team" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Add account" }));

      await waitFor(() => {
        expect(upsertOAuthAccountMock).toHaveBeenCalledWith(
          expect.objectContaining({
            provider: "gemini",
            email: "gemini@example.com",
            displayName: "Gem Account",
            status: "enabled",
          })
        );
      });
    },
    CODEX_ACCOUNTS_TIMEOUT_MS
  );

  it(
    "updates pool settings and syncs pool members",
    async () => {
      cleanup();

      const now = Date.now();
      listOAuthAccountsMock.mockResolvedValue([
        {
          accountId: "gemini-account-1",
          provider: "gemini",
          externalAccountId: null,
          email: "gemini1@example.com",
          displayName: "Gem One",
          status: "enabled",
          disabledReason: null,
          metadata: {},
          createdAt: now - 1000,
          updatedAt: now - 1000,
        },
        {
          accountId: "gemini-account-2",
          provider: "gemini",
          externalAccountId: null,
          email: "gemini2@example.com",
          displayName: "Gem Two",
          status: "disabled",
          disabledReason: "manual_toggle",
          metadata: {},
          createdAt: now - 900,
          updatedAt: now - 900,
        },
      ]);
      listOAuthPoolsMock.mockResolvedValue([
        {
          poolId: "gemini-default",
          provider: "gemini",
          name: "Gemini Pool",
          strategy: "round_robin",
          stickyMode: "cache_first",
          preferredAccountId: null,
          enabled: true,
          metadata: {},
          createdAt: now - 800,
          updatedAt: now - 800,
        },
      ]);
      listOAuthPoolMembersMock.mockResolvedValue([
        {
          poolId: "gemini-default",
          accountId: "gemini-account-1",
          weight: 1,
          priority: 0,
          position: 0,
          enabled: true,
          createdAt: now - 800,
          updatedAt: now - 800,
        },
        {
          poolId: "gemini-default",
          accountId: "gemini-account-2",
          weight: 1,
          priority: 1,
          position: 1,
          enabled: false,
          createdAt: now - 790,
          updatedAt: now - 790,
        },
      ]);

      await renderSettled(
        <SharedSettingsView
          workspaceGroups={[]}
          groupedWorkspaces={[
            {
              id: null,
              name: "Ungrouped",
              workspaces: [workspace({ id: "w1", name: "Workspace", connected: true })],
            },
          ]}
          ungroupedLabel="Ungrouped"
          onClose={vi.fn()}
          onMoveWorkspace={vi.fn()}
          onDeleteWorkspace={vi.fn()}
          onCreateWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onRenameWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onMoveWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onDeleteWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onAssignWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          reduceTransparency={false}
          onToggleTransparency={vi.fn()}
          appSettings={baseSettings}
          openAppIconById={{}}
          onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
          onRunDoctor={vi.fn().mockResolvedValue(createDoctorResult())}
          onRunCodexUpdate={vi.fn().mockResolvedValue(createUpdateResult())}
          onUpdateWorkspaceCodexBin={vi.fn().mockResolvedValue(undefined)}
          onUpdateWorkspaceSettings={vi.fn().mockResolvedValue(undefined)}
          scaleShortcutTitle="Scale shortcut"
          scaleShortcutText="Use Command +/-"
          onTestNotificationSound={vi.fn()}
          onTestSystemNotification={vi.fn()}
          dictationModelStatus={null}
          onDownloadDictationModel={vi.fn()}
          onCancelDictationDownload={vi.fn()}
          onRemoveDictationModel={vi.fn()}
          initialSection="codex"
        />
      );

      await switchToPoolsTab();
      await screen.findByLabelText("Name for pool gemini-default");

      await actAndFlush(async () => {
        await chooseSelectOption(screen, "Strategy for pool gemini-default", "p2c");
      });
      await actAndFlush(async () => {
        await chooseSelectOption(
          screen,
          "Session binding for pool gemini-default",
          "performance_first"
        );
      });
      await actAndFlush(async () => {
        await chooseSelectOption(screen, "Preferred account for pool gemini-default", "Gem One");
      });

      await waitFor(() => {
        expect(
          applyOAuthPoolMock.mock.calls.some(([payload]) => {
            const pool = payload.pool;
            return (
              pool.poolId === "gemini-default" &&
              pool.provider === "gemini" &&
              pool.name === "Gemini Pool" &&
              pool.strategy === "p2c" &&
              pool.stickyMode === "performance_first" &&
              pool.preferredAccountId === "gemini-account-1"
            );
          })
        ).toBe(true);
      });

      await actAndFlush(() => {
        fireEvent.click(screen.getByRole("button", { name: "Disable" }));
      });

      await waitFor(() => {
        expect(
          applyOAuthPoolMock.mock.calls.some(([payload]) => {
            const pool = payload.pool;
            return (
              pool.poolId === "gemini-default" &&
              pool.provider === "gemini" &&
              pool.name === "Gemini Pool" &&
              pool.strategy === "p2c" &&
              pool.stickyMode === "performance_first" &&
              pool.preferredAccountId === "gemini-account-1" &&
              pool.enabled === false
            );
          })
        ).toBe(true);
      });

      const applyCallsBeforeSync = applyOAuthPoolMock.mock.calls.length;
      fireEvent.click(screen.getByRole("button", { name: "Sync" }));

      await waitFor(() => {
        expect(applyOAuthPoolMock.mock.calls.length).toBeGreaterThan(applyCallsBeforeSync);
      });
      const syncPayload = applyOAuthPoolMock.mock.calls.at(-1)?.[0];
      expect(syncPayload?.members).toEqual([
        {
          accountId: "gemini-account-1",
          weight: 1,
          priority: 0,
          position: 0,
          enabled: true,
        },
        {
          accountId: "gemini-account-2",
          weight: 1,
          priority: 1,
          position: 1,
          enabled: false,
        },
      ]);
    },
    CODEX_ACCOUNTS_TIMEOUT_MS
  );

  it(
    "applies multi-selected pool members on autosave",
    async () => {
      cleanup();

      const now = Date.now();
      listOAuthAccountsMock.mockResolvedValue([
        {
          accountId: "gemini-account-1",
          provider: "gemini",
          externalAccountId: null,
          email: "gemini1@example.com",
          displayName: "Gem One",
          status: "enabled",
          disabledReason: null,
          metadata: {},
          createdAt: now - 1000,
          updatedAt: now - 1000,
        },
        {
          accountId: "gemini-account-2",
          provider: "gemini",
          externalAccountId: null,
          email: "gemini2@example.com",
          displayName: "Gem Two",
          status: "disabled",
          disabledReason: "manual_toggle",
          metadata: {},
          createdAt: now - 900,
          updatedAt: now - 900,
        },
      ]);
      listOAuthPoolsMock.mockResolvedValue([
        {
          poolId: "gemini-default",
          provider: "gemini",
          name: "Gemini Pool",
          strategy: "round_robin",
          stickyMode: "cache_first",
          preferredAccountId: null,
          enabled: true,
          metadata: {},
          createdAt: now - 800,
          updatedAt: now - 800,
        },
      ]);
      listOAuthPoolMembersMock.mockResolvedValue([
        {
          poolId: "gemini-default",
          accountId: "gemini-account-1",
          weight: 1,
          priority: 0,
          position: 0,
          enabled: true,
          createdAt: now - 800,
          updatedAt: now - 800,
        },
        {
          poolId: "gemini-default",
          accountId: "gemini-account-2",
          weight: 1,
          priority: 1,
          position: 1,
          enabled: false,
          createdAt: now - 790,
          updatedAt: now - 790,
        },
      ]);

      await renderSettled(
        <SharedSettingsView
          workspaceGroups={[]}
          groupedWorkspaces={[
            {
              id: null,
              name: "Ungrouped",
              workspaces: [workspace({ id: "w1", name: "Workspace", connected: true })],
            },
          ]}
          ungroupedLabel="Ungrouped"
          onClose={vi.fn()}
          onMoveWorkspace={vi.fn()}
          onDeleteWorkspace={vi.fn()}
          onCreateWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onRenameWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onMoveWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onDeleteWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onAssignWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          reduceTransparency={false}
          onToggleTransparency={vi.fn()}
          appSettings={baseSettings}
          openAppIconById={{}}
          onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
          onRunDoctor={vi.fn().mockResolvedValue(createDoctorResult())}
          onRunCodexUpdate={vi.fn().mockResolvedValue(createUpdateResult())}
          onUpdateWorkspaceCodexBin={vi.fn().mockResolvedValue(undefined)}
          onUpdateWorkspaceSettings={vi.fn().mockResolvedValue(undefined)}
          scaleShortcutTitle="Scale shortcut"
          scaleShortcutText="Use Command +/-"
          onTestNotificationSound={vi.fn()}
          onTestSystemNotification={vi.fn()}
          dictationModelStatus={null}
          onDownloadDictationModel={vi.fn()}
          onCancelDictationDownload={vi.fn()}
          onRemoveDictationModel={vi.fn()}
          initialSection="codex"
        />
      );

      await switchToPoolsTab();

      fireEvent.click(await screen.findByRole("button", { name: /members/i }));
      const popover = document.querySelector(".ds-popover");
      expect(popover).not.toBeNull();
      fireEvent.click(within(popover as HTMLElement).getByLabelText(/Gem One/i));

      await waitFor(() => {
        expect(
          applyOAuthPoolMock.mock.calls.some(([payload]) => {
            if (payload.pool.poolId !== "gemini-default") {
              return false;
            }
            return (
              payload.members.length === 1 &&
              payload.members[0]?.accountId === "gemini-account-2" &&
              payload.members[0]?.priority === 1 &&
              payload.members[0]?.position === 0 &&
              payload.members[0]?.enabled === false
            );
          })
        ).toBe(true);
      });
    },
    CODEX_ACCOUNTS_TIMEOUT_MS
  );

  it("supports bulk account status updates from multi-select", async () => {
    cleanup();
    const now = Date.now();
    listOAuthAccountsMock.mockResolvedValue([
      {
        accountId: "codex-account-1",
        provider: "codex",
        externalAccountId: null,
        email: "codex1@example.com",
        displayName: "Codex One",
        status: "enabled",
        disabledReason: null,
        metadata: {},
        createdAt: now - 1000,
        updatedAt: now - 1000,
      },
      {
        accountId: "codex-account-2",
        provider: "codex",
        externalAccountId: null,
        email: "codex2@example.com",
        displayName: "Codex Two",
        status: "enabled",
        disabledReason: null,
        metadata: {},
        createdAt: now - 900,
        updatedAt: now - 900,
      },
    ]);

    await renderSettled(
      <SharedSettingsView
        workspaceGroups={[]}
        groupedWorkspaces={[
          {
            id: null,
            name: "Ungrouped",
            workspaces: [workspace({ id: "w1", name: "Workspace", connected: true })],
          },
        ]}
        ungroupedLabel="Ungrouped"
        onClose={vi.fn()}
        onMoveWorkspace={vi.fn()}
        onDeleteWorkspace={vi.fn()}
        onCreateWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onRenameWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onMoveWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onDeleteWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onAssignWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        reduceTransparency={false}
        onToggleTransparency={vi.fn()}
        appSettings={baseSettings}
        openAppIconById={{}}
        onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
        onRunDoctor={vi.fn().mockResolvedValue(createDoctorResult())}
        onRunCodexUpdate={vi.fn().mockResolvedValue(createUpdateResult())}
        onUpdateWorkspaceCodexBin={vi.fn().mockResolvedValue(undefined)}
        onUpdateWorkspaceSettings={vi.fn().mockResolvedValue(undefined)}
        scaleShortcutTitle="Scale shortcut"
        scaleShortcutText="Use Command +/-"
        onTestNotificationSound={vi.fn()}
        onTestSystemNotification={vi.fn()}
        dictationModelStatus={null}
        onDownloadDictationModel={vi.fn()}
        onCancelDictationDownload={vi.fn()}
        onRemoveDictationModel={vi.fn()}
        initialSection="codex"
      />
    );

    fireEvent.click(await screen.findByLabelText("Select account codex-account-1"));
    fireEvent.click(screen.getByLabelText("Select account codex-account-2"));
    const accountToolbar = screen
      .getByLabelText("Filter accounts by provider")
      .closest(".apm-toolbar");
    expect(accountToolbar).not.toBeNull();
    await actAndFlush(() => {
      fireEvent.click(
        within(accountToolbar as HTMLElement).getByRole("button", { name: "Disable" })
      );
    });

    await waitFor(() => {
      expect(upsertOAuthAccountMock).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: "codex-account-1",
          status: "disabled",
          disabledReason: "manual_toggle",
        })
      );
      expect(upsertOAuthAccountMock).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: "codex-account-2",
          status: "disabled",
          disabledReason: "manual_toggle",
        })
      );
    });
  });

  it("supports bulk pool status updates from multi-select", async () => {
    cleanup();
    const now = Date.now();
    listOAuthAccountsMock.mockResolvedValue([
      {
        accountId: "gemini-account-1",
        provider: "gemini",
        externalAccountId: null,
        email: "gemini1@example.com",
        displayName: "Gem One",
        status: "enabled",
        disabledReason: null,
        metadata: {},
        createdAt: now - 1_000,
        updatedAt: now - 1_000,
      },
      {
        accountId: "gemini-account-2",
        provider: "gemini",
        externalAccountId: null,
        email: "gemini2@example.com",
        displayName: "Gem Two",
        status: "enabled",
        disabledReason: null,
        metadata: {},
        createdAt: now - 900,
        updatedAt: now - 900,
      },
    ]);
    listOAuthPoolsMock.mockResolvedValue([
      {
        poolId: "gemini-default",
        provider: "gemini",
        name: "Gemini Default",
        strategy: "round_robin",
        stickyMode: "cache_first",
        preferredAccountId: null,
        enabled: true,
        metadata: {},
        createdAt: now - 800,
        updatedAt: now - 800,
      },
      {
        poolId: "gemini-backup",
        provider: "gemini",
        name: "Gemini Backup",
        strategy: "p2c",
        stickyMode: "balance",
        preferredAccountId: null,
        enabled: true,
        metadata: {},
        createdAt: now - 700,
        updatedAt: now - 700,
      },
    ]);

    await renderSettled(
      <SharedSettingsView
        workspaceGroups={[]}
        groupedWorkspaces={[
          {
            id: null,
            name: "Ungrouped",
            workspaces: [workspace({ id: "w1", name: "Workspace", connected: true })],
          },
        ]}
        ungroupedLabel="Ungrouped"
        onClose={vi.fn()}
        onMoveWorkspace={vi.fn()}
        onDeleteWorkspace={vi.fn()}
        onCreateWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onRenameWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onMoveWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onDeleteWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onAssignWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        reduceTransparency={false}
        onToggleTransparency={vi.fn()}
        appSettings={baseSettings}
        openAppIconById={{}}
        onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
        onRunDoctor={vi.fn().mockResolvedValue(createDoctorResult())}
        onRunCodexUpdate={vi.fn().mockResolvedValue(createUpdateResult())}
        onUpdateWorkspaceCodexBin={vi.fn().mockResolvedValue(undefined)}
        onUpdateWorkspaceSettings={vi.fn().mockResolvedValue(undefined)}
        scaleShortcutTitle="Scale shortcut"
        scaleShortcutText="Use Command +/-"
        onTestNotificationSound={vi.fn()}
        onTestSystemNotification={vi.fn()}
        dictationModelStatus={null}
        onDownloadDictationModel={vi.fn()}
        onCancelDictationDownload={vi.fn()}
        onRemoveDictationModel={vi.fn()}
        initialSection="codex"
      />
    );

    await switchToPoolsTab();

    fireEvent.click(await screen.findByLabelText("Select pool gemini-default"));
    fireEvent.click(screen.getByLabelText("Select pool gemini-backup"));
    const poolToolbar = screen.getByLabelText("Filter pools by provider").closest(".apm-toolbar");
    expect(poolToolbar).not.toBeNull();
    await actAndFlush(() => {
      fireEvent.click(within(poolToolbar as HTMLElement).getByRole("button", { name: "Disable" }));
    });

    await waitFor(() => {
      expect(upsertOAuthPoolMock).toHaveBeenCalledWith(
        expect.objectContaining({
          poolId: "gemini-default",
          enabled: false,
        })
      );
      expect(upsertOAuthPoolMock).toHaveBeenCalledWith(
        expect.objectContaining({
          poolId: "gemini-backup",
          enabled: false,
        })
      );
    });
  }, 20_000);
});
