import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  detectDesktopRuntimeHost,
  openUrl,
  resolveAppVersion,
  resolveCurrentDesktopSession,
  resolveWindowLabel,
  revealItemInDir,
  showDesktopNotification,
} from "./desktopHostFacade";

const {
  detectTauriRuntimeMock,
  getDesktopHostBridgeMock,
  openTauriUrlMock,
  readTauriAppVersionMock,
  readTauriWindowLabelMock,
  revealTauriItemInDirMock,
} = vi.hoisted(() => ({
  detectTauriRuntimeMock: vi.fn(),
  getDesktopHostBridgeMock: vi.fn(),
  openTauriUrlMock: vi.fn(),
  readTauriAppVersionMock: vi.fn(),
  readTauriWindowLabelMock: vi.fn(),
  revealTauriItemInDirMock: vi.fn(),
}));

vi.mock("../ports/desktopHostBridge", () => ({
  getDesktopHostBridge: getDesktopHostBridgeMock,
}));

vi.mock("../ports/tauriEnvironment", () => ({
  detectTauriRuntime: detectTauriRuntimeMock,
  readTauriAppVersion: readTauriAppVersionMock,
  readTauriWindowLabel: readTauriWindowLabelMock,
}));

vi.mock("../ports/tauriOpener", () => ({
  openTauriUrl: openTauriUrlMock,
  revealTauriItemInDir: revealTauriItemInDirMock,
}));

describe("desktopHostFacade", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getDesktopHostBridgeMock.mockReturnValue(null);
    detectTauriRuntimeMock.mockResolvedValue(false);
    readTauriWindowLabelMock.mockResolvedValue(null);
    readTauriAppVersionMock.mockResolvedValue(null);
    openTauriUrlMock.mockResolvedValue(false);
    revealTauriItemInDirMock.mockResolvedValue(false);
    window.open = vi.fn(() => window) as typeof window.open;
  });

  it("prefers the electron bridge when it is present", async () => {
    getDesktopHostBridgeMock.mockReturnValue({
      kind: "electron",
      app: {
        getVersion: async () => "41.0.3",
      },
      session: {
        getCurrentSession: async () => ({
          id: "session-review",
          windowLabel: "main",
          workspacePath: "/workspace/review",
          workspaceLabel: "review",
          preferredBackendId: "backend-1",
          runtimeMode: "remote",
          lastActiveAt: "2026-03-23T03:00:00.000Z",
        }),
      },
      window: {
        getLabel: async () => "review",
      },
      notifications: {
        show: async () => true,
      },
      shell: {
        openExternalUrl: async () => true,
        revealItemInDir: async () => true,
      },
    });

    await expect(detectDesktopRuntimeHost()).resolves.toBe("electron");
    await expect(resolveAppVersion()).resolves.toBe("41.0.3");
    await expect(resolveCurrentDesktopSession()).resolves.toMatchObject({
      id: "session-review",
      workspaceLabel: "review",
    });
    await expect(resolveWindowLabel("main")).resolves.toBe("review");
    await expect(showDesktopNotification({ title: "Build complete" })).resolves.toBe(true);
    await expect(openUrl("https://example.com")).resolves.toBe(true);
    await expect(revealItemInDir("/tmp/workspace")).resolves.toBe(true);
    expect(window.open).not.toHaveBeenCalled();
  });

  it("falls back to tauri and browser helpers when no bridge is present", async () => {
    detectTauriRuntimeMock.mockResolvedValue(true);
    readTauriWindowLabelMock.mockResolvedValue("about");
    readTauriAppVersionMock.mockResolvedValue("9.9.9");
    openTauriUrlMock.mockResolvedValue(true);
    revealTauriItemInDirMock.mockResolvedValue(true);

    await expect(detectDesktopRuntimeHost()).resolves.toBe("tauri");
    await expect(resolveAppVersion()).resolves.toBe("9.9.9");
    await expect(resolveCurrentDesktopSession()).resolves.toBeNull();
    await expect(resolveWindowLabel("main")).resolves.toBe("about");
    await expect(showDesktopNotification({ title: "No bridge" })).resolves.toBe(false);
    await expect(openUrl("https://example.com")).resolves.toBe(true);
    await expect(revealItemInDir("/tmp/workspace")).resolves.toBe(true);
    expect(window.open).not.toHaveBeenCalled();
  });

  it("uses browser fallback when native openers fail", async () => {
    openTauriUrlMock.mockResolvedValue(false);
    window.open = vi.fn(() => null) as typeof window.open;

    await expect(openUrl("https://example.com")).resolves.toBe(false);
  });
});
