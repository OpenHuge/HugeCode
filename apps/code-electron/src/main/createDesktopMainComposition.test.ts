import { beforeEach, describe, expect, it, vi } from "vitest";

const updateElectronApp = vi.fn();

vi.mock("electron", () => ({
  Menu: {
    buildFromTemplate: vi.fn(() => ({ popup: vi.fn() })),
  },
  nativeImage: {
    createFromDataURL: vi.fn(() => ({
      resize: vi.fn(() => ({})),
    })),
  },
  Notification: vi.fn(() => ({
    on: vi.fn(),
    show: vi.fn(),
  })),
  Tray: vi.fn(() => ({
    destroy: vi.fn(),
    on: vi.fn(),
    popUpContextMenu: vi.fn(),
    setContextMenu: vi.fn(),
    setToolTip: vi.fn(),
  })),
}));

vi.mock("update-electron-app", () => ({
  UpdateSourceType: {
    ElectronPublicUpdateService: "ElectronPublicUpdateService",
    StaticStorage: "StaticStorage",
  },
  updateElectronApp,
}));

describe("createDesktopMainComposition", () => {
  beforeEach(() => {
    updateElectronApp.mockReset();
  });

  function createInput(
    overrides: Partial<
      Parameters<typeof import("./createDesktopMainComposition.js").createDesktopMainComposition>[0]
    > = {}
  ) {
    return {
      app: {
        enableSandbox: vi.fn(),
        getPath: vi.fn(() => "/Users/test/Library/Application Support/HugeCode"),
        getVersion: vi.fn(() => "0.1.0"),
        isPackaged: true,
        on: vi.fn(),
        quit: vi.fn(),
        requestSingleInstanceLock: vi.fn(() => true),
        setAsDefaultProtocolClient: vi.fn(() => true),
        whenReady: vi.fn(() => new Promise(() => {})),
      },
      autoUpdater: {
        checkForUpdates: vi.fn(),
        on: vi.fn(),
        quitAndInstall: vi.fn(),
      },
      browserWindow: {
        getAllWindows: vi.fn(() => []),
      },
      ipcMain: {
        handle: vi.fn(),
      },
      platform: "darwin" as const,
      processArgv: [],
      releaseChannel: "beta" as const,
      rendererDevServerUrl: null,
      repositoryUrl: "https://github.com/OpenHuge/HugeCode",
      shell: {
        openExternal: vi.fn(async () => undefined),
        showItemInFolder: vi.fn(),
      },
      sourceDirectory: "/tmp/hugecode-electron/main",
      staticUpdateBaseUrl: null,
      ...overrides,
    };
  }

  it("does not initialize beta public auto-updates without a static feed", async () => {
    const { createDesktopMainComposition } = await import("./createDesktopMainComposition.js");

    createDesktopMainComposition(createInput()).start();

    expect(updateElectronApp).not.toHaveBeenCalled();
  });

  it("initializes the public GitHub update service for stable builds during startup", async () => {
    const { createDesktopMainComposition } = await import("./createDesktopMainComposition.js");

    createDesktopMainComposition(
      createInput({
        releaseChannel: "stable",
      })
    ).start();

    expect(updateElectronApp).toHaveBeenCalledWith({
      notifyUser: false,
      updateSource: {
        repo: "OpenHuge/HugeCode",
        type: "ElectronPublicUpdateService",
      },
    });
  });
});
