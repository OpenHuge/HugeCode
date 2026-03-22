// @vitest-environment jsdom

import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  actAndFlush,
  baseSettings,
  chooseSelectOption,
  createDoctorResult,
  createUpdateResult,
  listOAuthAccountsMock,
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

  const switchToHealthTab = async () => {
    fireEvent.click(await screen.findByRole("tab", { name: /Health/i }));
    await waitFor(() => {
      expect(screen.queryByText("Pool Routing Health")).not.toBeNull();
    });
  };

  it(
    "supports bulk pool session binding strategy updates",
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
          createdAt: now - 1_000,
          updatedAt: now - 1_000,
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

      const poolToolbar = screen.getByLabelText("Filter pools by provider").closest(".apm-toolbar");
      expect(poolToolbar).not.toBeNull();
      fireEvent.click(
        within(poolToolbar as HTMLElement).getByRole("button", { name: "Select all" })
      );
      upsertOAuthPoolMock.mockClear();
      await chooseSelectOption(screen, "Bulk session binding strategy", "performance_first");
      await actAndFlush(() => {
        fireEvent.click(screen.getByRole("button", { name: "Apply binding" }));
      });

      await waitFor(() => {
        expect(upsertOAuthPoolMock).toHaveBeenCalledWith(
          expect.objectContaining({
            poolId: "gemini-default",
            stickyMode: "performance_first",
          })
        );
        expect(upsertOAuthPoolMock).toHaveBeenCalledWith(
          expect.objectContaining({
            poolId: "gemini-backup",
            stickyMode: "performance_first",
          })
        );
      });
    },
    CODEX_ACCOUNTS_TIMEOUT_MS
  );

  it("shows pool routing health recommendation when enabled accounts lack credentials", async () => {
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
        createdAt: now - 1_000,
        updatedAt: now - 1_000,
      },
    ]);
    listOAuthPoolsMock.mockResolvedValue([
      {
        poolId: "codex-default",
        provider: "codex",
        name: "Codex Default",
        strategy: "round_robin",
        stickyMode: "cache_first",
        preferredAccountId: null,
        enabled: true,
        metadata: {},
        createdAt: now - 800,
        updatedAt: now - 800,
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

    await switchToHealthTab();

    await waitFor(() => {
      expect(
        screen.queryByText("Sign in or configure credentials for at least one enabled account.")
      ).not.toBeNull();
    });
  });

  it(
    "filters account and pool lists by provider",
    async () => {
      cleanup();
      const now = Date.now();
      listOAuthAccountsMock.mockResolvedValue([
        {
          accountId: "codex-account-1",
          provider: "codex",
          externalAccountId: null,
          email: "codex@example.com",
          displayName: "Codex One",
          status: "enabled",
          disabledReason: null,
          metadata: { apiKeyConfigured: true },
          createdAt: now - 1_000,
          updatedAt: now - 1_000,
        },
        {
          accountId: "gemini-account-1",
          provider: "gemini",
          externalAccountId: null,
          email: "gemini@example.com",
          displayName: "Gemini One",
          status: "enabled",
          disabledReason: null,
          metadata: { apiKeyConfigured: true },
          createdAt: now - 900,
          updatedAt: now - 900,
        },
      ]);
      listOAuthPoolsMock.mockResolvedValue([
        {
          poolId: "codex-default",
          provider: "codex",
          name: "Codex Default",
          strategy: "round_robin",
          stickyMode: "cache_first",
          preferredAccountId: null,
          enabled: true,
          metadata: {},
          createdAt: now - 800,
          updatedAt: now - 800,
        },
        {
          poolId: "gemini-default",
          provider: "gemini",
          name: "Gemini Default",
          strategy: "round_robin",
          stickyMode: "cache_first",
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

      await waitFor(() => {
        expect(screen.queryByLabelText("Select account codex-account-1")).not.toBeNull();
        expect(screen.queryByLabelText("Select account gemini-account-1")).not.toBeNull();
      });

      await chooseSelectOption(screen, "Filter accounts by provider", /gemini/i);
      await waitFor(() => {
        expect(screen.queryByLabelText("Select account codex-account-1")).toBeNull();
        expect(screen.queryByLabelText("Select account gemini-account-1")).not.toBeNull();
      });

      await switchToPoolsTab();

      await chooseSelectOption(screen, "Filter pools by provider", /codex/i);
      await waitFor(() => {
        expect(screen.queryByLabelText("Select pool codex-default")).not.toBeNull();
        expect(screen.queryByLabelText("Select pool gemini-default")).toBeNull();
      });
    },
    CODEX_ACCOUNTS_TIMEOUT_MS
  );

  it("clears hidden selected accounts before bulk status updates", async () => {
    cleanup();
    const now = Date.now();
    listOAuthAccountsMock.mockResolvedValue([
      {
        accountId: "codex-account-1",
        provider: "codex",
        externalAccountId: null,
        email: "codex@example.com",
        displayName: "Codex One",
        status: "enabled",
        disabledReason: null,
        metadata: { apiKeyConfigured: true },
        createdAt: now - 1_000,
        updatedAt: now - 1_000,
      },
      {
        accountId: "gemini-account-1",
        provider: "gemini",
        externalAccountId: null,
        email: "gemini@example.com",
        displayName: "Gemini One",
        status: "enabled",
        disabledReason: null,
        metadata: { apiKeyConfigured: true },
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

    fireEvent.click(await screen.findByRole("button", { name: "Select all" }));
    await chooseSelectOption(screen, "Filter accounts by provider", /gemini/i);
    fireEvent.click(await screen.findByRole("button", { name: /^Clear 1 hidden$/ }));
    const accountToolbar = screen
      .getByLabelText("Filter accounts by provider")
      .closest(".apm-toolbar");
    expect(accountToolbar).not.toBeNull();
    upsertOAuthAccountMock.mockClear();
    await actAndFlush(() => {
      fireEvent.click(
        within(accountToolbar as HTMLElement).getByRole("button", { name: "Disable" })
      );
    });

    await waitFor(() => {
      expect(upsertOAuthAccountMock).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: "gemini-account-1",
          status: "disabled",
        })
      );
    });
    expect(upsertOAuthAccountMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "codex-account-1",
      })
    );
  }, 20_000);

  it("clears hidden selected pools before bulk pool updates", async () => {
    cleanup();
    const now = Date.now();
    listOAuthAccountsMock.mockResolvedValue([
      {
        accountId: "codex-account-1",
        provider: "codex",
        externalAccountId: null,
        email: "codex@example.com",
        displayName: "Codex One",
        status: "enabled",
        disabledReason: null,
        metadata: { apiKeyConfigured: true },
        createdAt: now - 1_000,
        updatedAt: now - 1_000,
      },
    ]);
    listOAuthPoolsMock.mockResolvedValue([
      {
        poolId: "codex-default",
        provider: "codex",
        name: "Codex Default",
        strategy: "round_robin",
        stickyMode: "cache_first",
        preferredAccountId: null,
        enabled: true,
        metadata: {},
        createdAt: now - 800,
        updatedAt: now - 800,
      },
      {
        poolId: "gemini-default",
        provider: "gemini",
        name: "Gemini Default",
        strategy: "round_robin",
        stickyMode: "cache_first",
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

    const poolToolbar = screen.getByLabelText("Filter pools by provider").closest(".apm-toolbar");
    expect(poolToolbar).not.toBeNull();
    fireEvent.click(within(poolToolbar as HTMLElement).getByRole("button", { name: "Select all" }));
    await chooseSelectOption(screen, "Filter pools by provider", /codex/i);
    fireEvent.click(await screen.findByRole("button", { name: /^Clear 1 hidden$/ }));
    upsertOAuthPoolMock.mockClear();
    await actAndFlush(() => {
      fireEvent.click(within(poolToolbar as HTMLElement).getByRole("button", { name: "Disable" }));
    });

    await waitFor(() => {
      expect(upsertOAuthPoolMock).toHaveBeenCalledWith(
        expect.objectContaining({
          poolId: "codex-default",
          enabled: false,
        })
      );
    });
    expect(upsertOAuthPoolMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        poolId: "gemini-default",
      })
    );
  }, 20_000);

  it("keeps validation-blocked accounts read-only", async () => {
    cleanup();
    const now = Date.now();
    listOAuthAccountsMock.mockResolvedValue([
      {
        accountId: "blocked-account-1",
        provider: "codex",
        externalAccountId: null,
        email: null,
        displayName: null,
        status: "validation_blocked",
        disabledReason: "service_validation_failed",
        metadata: {},
        createdAt: now - 1_000,
        updatedAt: now - 500,
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

    const accountLabel = await screen.findByText("blocked-account-1");
    const accountRow = accountLabel.closest(".apm-row");
    expect(accountRow).not.toBeNull();
    const toggleButton = within(accountRow as HTMLElement).getByRole("button", { name: "Enable" });
    expect((toggleButton as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/validation_blocked \(service_validation_failed\)/)).toBeTruthy();
  });
});
