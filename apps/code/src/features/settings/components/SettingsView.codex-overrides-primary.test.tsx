// @vitest-environment jsdom

import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  askMock,
  baseSettings,
  chooseSelectOption,
  createDoctorResult,
  createUpdateResult,
  openMock,
  renderSettled,
  SharedSettingsView,
  withDefaultRemoteProfile,
} from "./SettingsView.test.shared";

describe("SettingsView Codex overrides", () => {
  it("updates workspace Codex args override on blur", async () => {
    const onUpdateWorkspaceSettings = vi.fn().mockResolvedValue(undefined);
    const workspace: WorkspaceInfo = {
      id: "w1",
      name: "Workspace",
      path: "/tmp/workspace",
      connected: false,
      codex_bin: null,
      kind: "main",
      parentId: null,
      worktree: null,
      settings: { sidebarCollapsed: false, codexArgs: null },
    };

    await renderSettled(
      <SharedSettingsView
        workspaceGroups={[]}
        groupedWorkspaces={[{ id: null, name: "Ungrouped", workspaces: [workspace] }]}
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
        onUpdateWorkspaceSettings={onUpdateWorkspaceSettings}
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

    expect(
      await screen.findByText(
        "Workspace overrides",
        {
          selector: '[data-settings-field-group-title="true"]',
        },
        { timeout: 5_000 }
      )
    ).toBeTruthy();
    const input = await screen.findByLabelText("Codex args override for Workspace", undefined, {
      timeout: 5_000,
    });
    fireEvent.change(input, { target: { value: "--profile dev" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(onUpdateWorkspaceSettings).toHaveBeenCalledWith("w1", {
        codexArgs: "--profile dev",
      });
    });
  });

  it("shows a group error when delete confirmation fails", async () => {
    cleanup();
    askMock.mockRejectedValueOnce(new Error("dialog bridge unavailable"));
    const onDeleteWorkspaceGroup = vi.fn().mockResolvedValue(null);

    await renderSettled(
      <SharedSettingsView
        workspaceGroups={[{ id: "group-1", name: "Backend", copiesFolder: null }]}
        groupedWorkspaces={[{ id: "group-1", name: "Backend", workspaces: [] }]}
        ungroupedLabel="Ungrouped"
        onClose={vi.fn()}
        onMoveWorkspace={vi.fn()}
        onDeleteWorkspace={vi.fn()}
        onCreateWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onRenameWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onMoveWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onDeleteWorkspaceGroup={onDeleteWorkspaceGroup}
        onAssignWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        reduceTransparency={false}
        onToggleTransparency={vi.fn()}
        appSettings={baseSettings}
        openAppIconById={{}}
        onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
        onRunDoctor={vi.fn().mockResolvedValue(createDoctorResult())}
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
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete group" }));

    await waitFor(() => {
      expect(screen.getByText("dialog bridge unavailable")).toBeTruthy();
    });
    expect(onDeleteWorkspaceGroup).not.toHaveBeenCalled();
  }, 15_000);

  it("shows a group error when choosing copies folder fails", async () => {
    cleanup();
    openMock.mockRejectedValueOnce(new Error("picker unavailable"));
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);

    await renderSettled(
      <SharedSettingsView
        workspaceGroups={[{ id: "group-1", name: "Backend", copiesFolder: null }]}
        groupedWorkspaces={[{ id: "group-1", name: "Backend", workspaces: [] }]}
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
        onUpdateAppSettings={onUpdateAppSettings}
        onRunDoctor={vi.fn().mockResolvedValue(createDoctorResult())}
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
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Choose/ }));

    await waitFor(() => {
      expect(screen.getByText("picker unavailable")).toBeTruthy();
    });
    expect(onUpdateAppSettings).not.toHaveBeenCalled();
  });

  it("updates review mode in codex section", async () => {
    cleanup();
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    await renderSettled(
      <SharedSettingsView
        workspaceGroups={[]}
        groupedWorkspaces={[]}
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
        onUpdateAppSettings={onUpdateAppSettings}
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

    await chooseSelectOption(screen, "Review mode", "Detached (new review thread)");

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ reviewDeliveryMode: "detached" })
      );
    });
  });

  it("renders Orbit controls for Orbit provider even in local backend mode", async () => {
    cleanup();
    await renderSettled(
      <SharedSettingsView
        workspaceGroups={[]}
        groupedWorkspaces={[]}
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
        appSettings={withDefaultRemoteProfile(
          {
            ...baseSettings,
            backendMode: "local",
          },
          {
            provider: "orbit",
            host: null,
            orbitWsUrl: "wss://orbit.example/ws",
          }
        )}
        openAppIconById={{}}
        onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
        onRunDoctor={vi.fn().mockResolvedValue(createDoctorResult())}
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
        initialSection="server"
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Orbit websocket URL")).toBeTruthy();
      expect(screen.getByLabelText("Orbit auth URL")).toBeTruthy();
      expect(screen.getByLabelText("Orbit runner name")).toBeTruthy();
      expect(screen.getByLabelText("Orbit access client ID")).toBeTruthy();
      expect(screen.getByLabelText("Orbit access client secret ref")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Connect test" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Sign In" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Sign Out" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Start Runner" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Stop Runner" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Refresh Status" })).toBeTruthy();
    });
  }, 20_000);

  it("renders mobile daemon controls in local backend mode for TCP provider", async () => {
    cleanup();
    await renderSettled(
      <SharedSettingsView
        workspaceGroups={[]}
        groupedWorkspaces={[]}
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
        appSettings={withDefaultRemoteProfile(
          {
            ...baseSettings,
            backendMode: "local",
          },
          {
            provider: "tcp",
            host: "127.0.0.1:4732",
          }
        )}
        openAppIconById={{}}
        onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
        onRunDoctor={vi.fn().mockResolvedValue(createDoctorResult())}
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
        initialSection="server"
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Start daemon" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Stop daemon" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Refresh status" })).toBeTruthy();
      expect(screen.getByLabelText("Remote backend host")).toBeTruthy();
      expect(screen.getByLabelText("Remote backend token")).toBeTruthy();
    });
  }, 20_000);

  it("shows mobile-only server controls on iOS runtime", async () => {
    cleanup();
    const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(
      window.navigator,
      "platform"
    );
    const originalUserAgentDescriptor = Object.getOwnPropertyDescriptor(
      window.navigator,
      "userAgent"
    );
    const originalTouchPointsDescriptor = Object.getOwnPropertyDescriptor(
      window.navigator,
      "maxTouchPoints"
    );

    Object.defineProperty(window.navigator, "platform", {
      configurable: true,
      value: "iPhone",
    });
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
    });
    Object.defineProperty(window.navigator, "maxTouchPoints", {
      configurable: true,
      value: 5,
    });

    try {
      await renderSettled(
        <SharedSettingsView
          workspaceGroups={[]}
          groupedWorkspaces={[]}
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
          appSettings={withDefaultRemoteProfile(
            {
              ...baseSettings,
              backendMode: "local",
            },
            {
              provider: "orbit",
              host: null,
              orbitWsUrl: "wss://orbit.example/ws",
            }
          )}
          openAppIconById={{}}
          onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
          onRunDoctor={vi.fn().mockResolvedValue(createDoctorResult())}
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
          initialSection="server"
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText("Connection type")).toBeTruthy();
        expect(screen.getByLabelText("Orbit websocket URL")).toBeTruthy();
        expect(screen.getByLabelText("Remote backend token")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Connect & test" })).toBeTruthy();
      });

      expect(screen.queryByLabelText("Backend mode")).toBeNull();
      expect(screen.queryByRole("button", { name: "Start daemon" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Detect Tailscale" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Connect test" })).toBeNull();
      expect(screen.queryByLabelText("Remote backend host")).toBeNull();
      expect(screen.queryByRole("button", { name: "Sign In" })).toBeNull();
      expect(screen.getByText(/use the orbit websocket url and token configured/i)).toBeTruthy();
    } finally {
      if (originalPlatformDescriptor) {
        Object.defineProperty(window.navigator, "platform", originalPlatformDescriptor);
      } else {
        Reflect.deleteProperty(window.navigator, "platform");
      }
      if (originalUserAgentDescriptor) {
        Object.defineProperty(window.navigator, "userAgent", originalUserAgentDescriptor);
      } else {
        Reflect.deleteProperty(window.navigator, "userAgent");
      }
      if (originalTouchPointsDescriptor) {
        Object.defineProperty(window.navigator, "maxTouchPoints", originalTouchPointsDescriptor);
      } else {
        Reflect.deleteProperty(window.navigator, "maxTouchPoints");
      }
    }
  });
});
