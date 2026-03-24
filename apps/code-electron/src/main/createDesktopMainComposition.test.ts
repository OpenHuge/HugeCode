import { rmSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const updateElectronApp = vi.fn();

vi.mock("electron", () => ({
  Menu: {
    buildFromTemplate: vi.fn(() => ({ popup: vi.fn() })),
    setApplicationMenu: vi.fn(),
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
  const createdUserDataPaths = new Set<string>();

  beforeEach(async () => {
    updateElectronApp.mockReset();
    const { Menu } = await import("electron");
    vi.mocked(Menu.buildFromTemplate).mockClear();
    vi.mocked(Menu.setApplicationMenu).mockClear();
    const { resetDesktopAppProtocolSchemeRegistrationForTests } =
      await import("./desktopAppProtocol.js");
    resetDesktopAppProtocolSchemeRegistrationForTests();
  });

  afterEach(() => {
    for (const userDataPath of createdUserDataPaths) {
      rmSync(userDataPath, { force: true, recursive: true });
    }
    createdUserDataPaths.clear();
  });

  function createFakeWindow() {
    return {
      close: vi.fn(),
      focus: vi.fn(),
      getBounds: vi.fn(() => ({
        height: 960,
        width: 1440,
      })),
      hide: vi.fn(),
      id: 101,
      isDestroyed: vi.fn(() => false),
      isFocused: vi.fn(() => false),
      isMinimized: vi.fn(() => false),
      isVisible: vi.fn(() => true),
      loadFile: vi.fn(),
      loadURL: vi.fn(),
      once: vi.fn((event: "ready-to-show", listener: () => void) => {
        if (event === "ready-to-show") {
          listener();
        }
      }),
      on: vi.fn(),
      restore: vi.fn(),
      show: vi.fn(),
      webContents: {
        on: vi.fn(),
        send: vi.fn(),
        setWindowOpenHandler: vi.fn(),
      },
    };
  }

  function createInput(
    overrides: Partial<
      Parameters<typeof import("./createDesktopMainComposition.js").createDesktopMainComposition>[0]
    > = {}
  ) {
    const fakeWindow = createFakeWindow();
    const userDataPath = `${process.cwd()}/node_modules/.cache/hugecode-electron-tests-${Math.random()
      .toString(36)
      .slice(2)}`;
    createdUserDataPaths.add(userDataPath);

    return {
      app: {
        addRecentDocument: vi.fn(),
        enableSandbox: vi.fn(),
        getPath: vi.fn(() => userDataPath),
        getVersion: vi.fn(() => "0.1.0"),
        isPackaged: true,
        on: vi.fn(),
        quit: vi.fn(),
        requestSingleInstanceLock: vi.fn(() => true),
        setAsDefaultProtocolClient: vi.fn(() => true),
        whenReady: vi.fn(() => Promise.resolve()),
      },
      autoUpdater: {
        checkForUpdates: vi.fn(),
        on: vi.fn(),
        quitAndInstall: vi.fn(),
      },
      arch: "x64" as const,
      browserWindow: {
        create: vi.fn(() => fakeWindow),
        fromWebContents: vi.fn(() => fakeWindow),
        getAllWindows: vi.fn(() => []),
      },
      dialog: {
        showOpenDialog: vi.fn(async () => ({
          canceled: true,
          filePaths: [],
        })),
      },
      ipcMain: {
        handle: vi.fn(),
      },
      launchIntentDependencies: {
        currentWorkingDirectory: () => "/workspace",
        existsSync: vi.fn(() => false),
        statSync: vi.fn(),
      },
      platform: "darwin" as const,
      protocol: {
        registerSchemesAsPrivileged: vi.fn(),
      },
      processArgv: [],
      releaseChannel: "beta" as const,
      rendererDevServerUrl: null,
      repositoryUrl: "https://github.com/OpenHuge/HugeCode",
      session: {
        defaultSession: {
          protocol: {
            handle: vi.fn(),
            isProtocolHandled: vi.fn(() => false),
          },
          setPermissionCheckHandler: vi.fn(),
          setPermissionRequestHandler: vi.fn(),
        },
      },
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

  it("initializes the static beta update feed when configured", async () => {
    const { createDesktopMainComposition } = await import("./createDesktopMainComposition.js");

    createDesktopMainComposition(
      createInput({
        releaseChannel: "beta",
        staticUpdateBaseUrl: "https://downloads.example.com/hugecode/beta",
      })
    ).start();

    expect(updateElectronApp).toHaveBeenCalledWith({
      notifyUser: false,
      updateSource: {
        baseUrl: "https://downloads.example.com/hugecode/beta/darwin/x64",
        type: "StaticStorage",
      },
    });
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

  it("loads packaged renderer windows from the internal app protocol instead of file urls", async () => {
    const { createDesktopMainComposition } = await import("./createDesktopMainComposition.js");
    const input = createInput();

    createDesktopMainComposition(input).start();
    await input.app.whenReady.mock.results[0]?.value;
    await Promise.resolve();
    await Promise.resolve();

    const fakeWindow = input.browserWindow.create.mock.results[0]?.value;
    expect(input.protocol.registerSchemesAsPrivileged).toHaveBeenCalledTimes(1);
    expect(input.session.defaultSession.protocol.handle).toHaveBeenCalledTimes(1);
    expect(fakeWindow.loadURL).toHaveBeenCalledWith("hugecode-app://app/index.html");
    expect(fakeWindow.loadFile).not.toHaveBeenCalled();
  });

  it("registers child-process resilience handling during startup", async () => {
    const { createDesktopMainComposition } = await import("./createDesktopMainComposition.js");
    const childProcessGoneListeners: Array<
      (
        _event: unknown,
        details: {
          exitCode: number;
          name?: string;
          reason: string;
          serviceName?: string;
          type: string;
        }
      ) => void
    > = [];
    const input = createInput();
    input.app.on = vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      if (event === "child-process-gone") {
        childProcessGoneListeners.push(
          listener as (
            _event: unknown,
            details: {
              exitCode: number;
              name?: string;
              reason: string;
              serviceName?: string;
              type: string;
            }
          ) => void
        );
      }
    });

    createDesktopMainComposition(input).start();

    expect(childProcessGoneListeners).toHaveLength(1);
    expect(() =>
      childProcessGoneListeners[0]?.(
        {},
        {
          exitCode: 9,
          reason: "crashed",
          serviceName: "GPU",
          type: "GPU",
        }
      )
    ).not.toThrow();
  });

  it("opens startup workspace launches through the window controller when argv contains a workspace path", async () => {
    const { createDesktopMainComposition } = await import("./createDesktopMainComposition.js");
    const input = createInput({
      launchIntentDependencies: {
        currentWorkingDirectory: () => "/workspace",
        existsSync: vi.fn((path: string) => path === "/workspace/demo"),
        statSync: vi.fn(() => ({
          isDirectory: () => true,
          isFile: () => false,
        })),
      },
      processArgv: ["HugeCode", "demo"],
    });

    createDesktopMainComposition(input).start();
    await input.app.whenReady.mock.results[0]?.value;
    await Promise.resolve();
    await Promise.resolve();

    expect(input.browserWindow.create).toHaveBeenCalledTimes(1);
    expect(input.browserWindow.create.mock.calls[0]?.[0]).toMatchObject({
      title: "HugeCode - demo",
    });
  });

  it("treats actionable hugecode workspace deep links as workspace launches during startup", async () => {
    const { createDesktopMainComposition } = await import("./createDesktopMainComposition.js");
    const input = createInput({
      launchIntentDependencies: {
        currentWorkingDirectory: () => "/workspace",
        existsSync: vi.fn((path: string) => path === "/workspace/demo"),
        statSync: vi.fn(() => ({
          isDirectory: () => true,
          isFile: () => false,
        })),
      },
      processArgv: ["HugeCode", "hugecode://workspace/open?path=%2Fworkspace%2Fdemo"],
    });

    createDesktopMainComposition(input).start();
    await input.app.whenReady.mock.results[0]?.value;
    await Promise.resolve();
    await Promise.resolve();

    expect(input.browserWindow.create).toHaveBeenCalledTimes(1);
    expect(input.browserWindow.create.mock.calls[0]?.[0]).toMatchObject({
      title: "HugeCode - demo",
    });
  });

  it("opens a workspace file from the native menu chooser", async () => {
    const { createDesktopMainComposition } = await import("./createDesktopMainComposition.js");
    const input = createInput({
      dialog: {
        showOpenDialog: vi.fn(async () => ({
          canceled: false,
          filePaths: ["/workspace/demo/src/main.ts"],
        })),
      },
      launchIntentDependencies: {
        currentWorkingDirectory: () => "/workspace",
        existsSync: vi.fn((path: string) => path === "/workspace/demo/src/main.ts"),
        statSync: vi.fn(() => ({
          isDirectory: () => false,
          isFile: () => true,
        })),
      },
    });

    createDesktopMainComposition(input).start();
    await input.app.whenReady.mock.results[0]?.value;
    await Promise.resolve();
    await Promise.resolve();

    const { Menu } = await import("electron");
    const lastTemplate = vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)?.[0] ?? [];
    const fileMenu = lastTemplate.find((item) => item.label === "File");
    const openFileItem = fileMenu?.submenu?.find((item) => item.label === "Open File...");

    openFileItem?.click?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(input.dialog.showOpenDialog).toHaveBeenCalledWith({
      buttonLabel: "Open File",
      properties: ["openFile"],
      title: "Open File",
    });
    expect(input.browserWindow.create).toHaveBeenCalledTimes(2);
    expect(input.browserWindow.create.mock.calls[1]?.[0]).toMatchObject({
      title: "HugeCode - src",
    });
  });

  it("opens a workspace directory from the native menu chooser", async () => {
    const { createDesktopMainComposition } = await import("./createDesktopMainComposition.js");
    const input = createInput({
      dialog: {
        showOpenDialog: vi.fn(async () => ({
          canceled: false,
          filePaths: ["/workspace/demo"],
        })),
      },
      launchIntentDependencies: {
        currentWorkingDirectory: () => "/workspace",
        existsSync: vi.fn((path: string) => path === "/workspace/demo"),
        statSync: vi.fn(() => ({
          isDirectory: () => true,
          isFile: () => false,
        })),
      },
    });

    createDesktopMainComposition(input).start();
    await input.app.whenReady.mock.results[0]?.value;
    await Promise.resolve();
    await Promise.resolve();

    const { Menu } = await import("electron");
    const lastTemplate = vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)?.[0] ?? [];
    const fileMenu = lastTemplate.find((item) => item.label === "File");
    const openFolderItem = fileMenu?.submenu?.find((item) => item.label === "Open Folder...");

    openFolderItem?.click?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(input.dialog.showOpenDialog).toHaveBeenCalledWith({
      buttonLabel: "Open Folder",
      properties: ["openDirectory"],
      title: "Open Folder",
    });
    expect(input.browserWindow.create).toHaveBeenCalledTimes(2);
    expect(input.browserWindow.create.mock.calls[1]?.[0]).toMatchObject({
      title: "HugeCode - demo",
    });
  });

  it("preserves file launch targets and records them as recent documents during startup", async () => {
    const { createDesktopMainComposition } = await import("./createDesktopMainComposition.js");
    const input = createInput({
      launchIntentDependencies: {
        currentWorkingDirectory: () => "/workspace",
        existsSync: vi.fn((path: string) => path === "/workspace/demo/src/main.ts"),
        statSync: vi.fn(() => ({
          isDirectory: () => false,
          isFile: () => true,
        })),
      },
      processArgv: ["HugeCode", "demo/src/main.ts"],
    });

    createDesktopMainComposition(input).start();
    await input.app.whenReady.mock.results[0]?.value;
    await Promise.resolve();
    await Promise.resolve();

    expect(input.app.addRecentDocument).toHaveBeenCalledWith("/workspace/demo/src/main.ts");
    expect(input.browserWindow.create.mock.calls[0]?.[0]).toMatchObject({
      title: "HugeCode - src",
    });
  });

  it("delivers live macOS open-url workspace launches to an existing window", async () => {
    const { createDesktopMainComposition } = await import("./createDesktopMainComposition.js");
    const input = createInput({
      launchIntentDependencies: {
        currentWorkingDirectory: () => "/workspace",
        existsSync: vi.fn((path: string) => path === "/workspace/demo"),
        statSync: vi.fn(() => ({
          isDirectory: () => true,
          isFile: () => false,
        })),
      },
      processArgv: ["HugeCode", "demo"],
    });

    createDesktopMainComposition(input).start();
    await input.app.whenReady.mock.results[0]?.value;
    await Promise.resolve();
    await Promise.resolve();

    const openUrlListener = input.app.on.mock.calls.find(([event]) => event === "open-url")?.[1] as
      | ((event: { preventDefault(): void }, url: string) => void)
      | undefined;
    const fakeWindow = input.browserWindow.create.mock.results[0]?.value;
    const preventDefault = vi.fn();

    openUrlListener?.({ preventDefault }, "hugecode://workspace/open?path=%2Fworkspace%2Fdemo");

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(fakeWindow.focus).toHaveBeenCalled();
    expect(fakeWindow.webContents.send).toHaveBeenCalledWith(
      "hugecode:desktop-host:push-launch-intent",
      expect.objectContaining({
        kind: "workspace",
        workspacePath: "/workspace/demo",
      })
    );
  });

  it("routes the native menu update action through the real automatic updater path", async () => {
    const { Menu } = await import("electron");
    const { createDesktopMainComposition } = await import("./createDesktopMainComposition.js");
    const input = createInput({
      releaseChannel: "stable",
    });

    createDesktopMainComposition(input).start();
    await input.app.whenReady.mock.results[0]?.value;
    await Promise.resolve();
    await Promise.resolve();

    const menuTemplate = vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)?.[0];
    const helpMenu = menuTemplate?.find((item) => item.label === "Help");
    const checkForUpdatesItem = helpMenu?.submenu?.find(
      (item) => "label" in item && item.label === "Check for Updates..."
    );

    checkForUpdatesItem?.click?.();

    expect(input.autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it("opens releases from the native menu when beta updates are intentionally manual", async () => {
    const { Menu } = await import("electron");
    const { createDesktopMainComposition } = await import("./createDesktopMainComposition.js");
    const input = createInput({
      releaseChannel: "beta",
      staticUpdateBaseUrl: null,
    });

    createDesktopMainComposition(input).start();
    await input.app.whenReady.mock.results[0]?.value;
    await Promise.resolve();
    await Promise.resolve();

    const menuTemplate = vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)?.[0];
    const helpMenu = menuTemplate?.find((item) => item.label === "Help");
    const checkForUpdatesItem = helpMenu?.submenu?.find(
      (item) => "label" in item && item.label === "Check for Updates..."
    );

    checkForUpdatesItem?.click?.();

    expect(input.autoUpdater.checkForUpdates).not.toHaveBeenCalled();
    expect(input.shell.openExternal).toHaveBeenCalledWith(
      "https://github.com/OpenHuge/HugeCode/releases"
    );
  });
});
