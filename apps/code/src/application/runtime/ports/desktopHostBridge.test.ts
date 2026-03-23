import { describe, expect, it } from "vitest";
import { getDesktopHostBridge } from "./desktopHostBridge";

describe("desktopHostBridge", () => {
  it("returns null when the bridge is unavailable", () => {
    delete window.hugeCodeDesktopHost;
    expect(getDesktopHostBridge()).toBeNull();
  });

  it("returns null for unsupported bridge kinds", () => {
    window.hugeCodeDesktopHost = {
      kind: "electron-legacy",
    } as unknown as Window["hugeCodeDesktopHost"];

    expect(getDesktopHostBridge()).toBeNull();
  });

  it("returns the electron bridge when it is present", () => {
    const bridge = {
      kind: "electron" as const,
      session: {
        getCurrentSession: async () => ({
          id: "session-a",
          windowLabel: "main" as const,
          workspacePath: "/workspace/alpha",
          workspaceLabel: "alpha",
          preferredBackendId: null,
          runtimeMode: "local" as const,
          lastActiveAt: "2026-03-23T03:00:00.000Z",
        }),
        listRecentSessions: async () => [],
        reopenSession: async () => true,
      },
      windowing: {
        listWindows: async () => [],
        openWindow: async () => ({
          windowId: 1,
          sessionId: "session-a",
          windowLabel: "main" as const,
          workspaceLabel: "alpha",
          focused: true,
        }),
      },
      tray: {
        getState: async () => ({ supported: true, enabled: false }),
        setEnabled: async () => ({ supported: true, enabled: true }),
      },
      notifications: {
        show: async () => true,
      },
      shell: {
        openExternalUrl: async () => true,
      },
    };
    window.hugeCodeDesktopHost = bridge;

    expect(getDesktopHostBridge()).toBe(bridge);
  });
});
