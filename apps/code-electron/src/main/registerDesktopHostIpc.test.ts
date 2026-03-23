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
        ensureBrowserDebugSession: vi.fn(),
        focusWindow: vi.fn(),
        getAppVersion: vi.fn(),
        getBrowserDebugSession: vi.fn(),
        getCurrentSession: vi.fn(),
        getTrayState: vi.fn(),
        getWindowLabel: vi.fn(),
        listRecentSessions: vi.fn(),
        listWindows: vi.fn(),
        openExternalUrl: vi.fn(),
        openWindow: vi.fn(),
        reopenSession: vi.fn(),
        revealItemInDir: vi.fn(),
        setTrayEnabled: vi.fn(),
        showNotification: vi.fn(),
      },
      ipcMain: {
        handle: handleMock,
      },
    });

    expect(handleMock).toHaveBeenCalledTimes(Object.keys(DESKTOP_HOST_IPC_CHANNELS).length);
    expect(handleMock.mock.calls.map(([channel]) => channel)).toEqual(
      Object.values(DESKTOP_HOST_IPC_CHANNELS)
    );
  });
});
