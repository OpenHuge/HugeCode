import { describe, expect, it, vi } from "vitest";
import { DESKTOP_HOST_IPC_CHANNELS } from "../shared/ipc.js";
import { registerDesktopHostIpc } from "./registerDesktopHostIpc.js";

describe("registerDesktopHostIpc", () => {
  it("registers all desktop host IPC handlers", () => {
    const handleMock = vi.fn();

    registerDesktopHostIpc({
      channels: DESKTOP_HOST_IPC_CHANNELS,
      handlers: {
        closeWindow: vi.fn(),
        checkForUpdates: vi.fn(),
        consumePendingLaunchIntent: vi.fn(),
        focusWindow: vi.fn(),
        getAppInfo: vi.fn(),
        getDiagnosticsInfo: vi.fn(),
        getAppVersion: vi.fn(),
        getCurrentSession: vi.fn(),
        getTrayState: vi.fn(),
        getUpdateState: vi.fn(),
        getWindowLabel: vi.fn(),
        listRecentSessions: vi.fn(),
        listWindows: vi.fn(),
        openExternalUrl: vi.fn(),
        openPath: vi.fn(),
        openWindow: vi.fn(),
        reopenSession: vi.fn(),
        revealItemInDir: vi.fn(),
        restartToApplyUpdate: vi.fn(),
        setTrayEnabled: vi.fn(),
        showNotification: vi.fn(),
      },
      ipcMain: {
        handle: handleMock,
      },
      isTrustedSender: () => true,
    });

    expect(handleMock).toHaveBeenCalledTimes(21);
    expect(handleMock.mock.calls.map(([channel]) => channel)).toEqual([
      DESKTOP_HOST_IPC_CHANNELS.getAppInfo,
      DESKTOP_HOST_IPC_CHANNELS.getAppVersion,
      DESKTOP_HOST_IPC_CHANNELS.getDiagnosticsInfo,
      DESKTOP_HOST_IPC_CHANNELS.consumePendingLaunchIntent,
      DESKTOP_HOST_IPC_CHANNELS.getCurrentSession,
      DESKTOP_HOST_IPC_CHANNELS.listRecentSessions,
      DESKTOP_HOST_IPC_CHANNELS.reopenSession,
      DESKTOP_HOST_IPC_CHANNELS.getWindowLabel,
      DESKTOP_HOST_IPC_CHANNELS.listWindows,
      DESKTOP_HOST_IPC_CHANNELS.openWindow,
      DESKTOP_HOST_IPC_CHANNELS.focusWindow,
      DESKTOP_HOST_IPC_CHANNELS.closeWindow,
      DESKTOP_HOST_IPC_CHANNELS.getTrayState,
      DESKTOP_HOST_IPC_CHANNELS.setTrayEnabled,
      DESKTOP_HOST_IPC_CHANNELS.showNotification,
      DESKTOP_HOST_IPC_CHANNELS.getUpdateState,
      DESKTOP_HOST_IPC_CHANNELS.checkForUpdates,
      DESKTOP_HOST_IPC_CHANNELS.restartToApplyUpdate,
      DESKTOP_HOST_IPC_CHANNELS.openExternalUrl,
      DESKTOP_HOST_IPC_CHANNELS.openPath,
      DESKTOP_HOST_IPC_CHANNELS.revealItemInDir,
    ]);
  });

  it("blocks untrusted IPC senders before handler execution", async () => {
    const handleMock = vi.fn();
    const getAppVersion = vi.fn(() => "41.0.3");

    registerDesktopHostIpc({
      channels: DESKTOP_HOST_IPC_CHANNELS,
      handlers: {
        closeWindow: vi.fn(),
        checkForUpdates: vi.fn(),
        consumePendingLaunchIntent: vi.fn(),
        focusWindow: vi.fn(),
        getAppInfo: vi.fn(),
        getDiagnosticsInfo: vi.fn(),
        getAppVersion,
        getCurrentSession: vi.fn(),
        getTrayState: vi.fn(),
        getUpdateState: vi.fn(),
        getWindowLabel: vi.fn(),
        listRecentSessions: vi.fn(),
        listWindows: vi.fn(),
        openExternalUrl: vi.fn(),
        openPath: vi.fn(),
        openWindow: vi.fn(),
        reopenSession: vi.fn(),
        revealItemInDir: vi.fn(),
        restartToApplyUpdate: vi.fn(),
        setTrayEnabled: vi.fn(),
        showNotification: vi.fn(),
      },
      ipcMain: {
        handle: handleMock,
      },
      isTrustedSender: () => false,
    });

    const registeredHandler = handleMock.mock.calls.find(
      ([channel]) => channel === DESKTOP_HOST_IPC_CHANNELS.getAppVersion
    )?.[1];

    await expect(
      registeredHandler?.({
        sender: {},
        senderFrame: {
          url: "https://example.com",
        },
      })
    ).rejects.toThrow("Blocked untrusted desktop IPC sender.");
    expect(getAppVersion).not.toHaveBeenCalled();
  });
});
