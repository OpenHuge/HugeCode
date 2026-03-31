import { rmSync, type PathLike } from "node:fs";
import type { MenuItemConstructorOptions } from "electron";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateDesktopMainCompositionInput } from "./createDesktopMainComposition.js";

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

  type TestMocks = {
    appOn: ReturnType<typeof vi.fn>;
    appWhenReady: ReturnType<typeof vi.fn>;
    browserWindowCreate: ReturnType<typeof vi.fn>;
    protocolHandle: ReturnType<typeof vi.fn>;
  };

  type LaunchIntentDependencies = NonNullable<
    CreateDesktopMainCompositionInput["launchIntentDependencies"]
  >;
  type LaunchIntentStatResult = ReturnType<NonNullable<LaunchIntentDependencies["statSync"]>>;

  type TestInput = CreateDesktopMainCompositionInput & {
    __mocks: TestMocks;
  };

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
        executeJavaScript: vi.fn(),
        on: vi.fn(),
        send: vi.fn(),
        setWindowOpenHandler: vi.fn(),
      },
    };
  }

  function createMockStats(kind: "directory" | "file"): LaunchIntentStatResult {
    return {
      isDirectory: () => kind === "directory",
      isFile: () => kind === "file",
    } as unknown as LaunchIntentStatResult;
  }

  function createExistsSyncMock(expectedPath: string) {
    return vi.fn((path: PathLike) => String(path) === expectedPath) as NonNullable<
      LaunchIntentDependencies["existsSync"]
    >;
  }

  function createStatSyncMock(kind: "directory" | "file") {
    return vi.fn((_path: PathLike) => createMockStats(kind)) as NonNullable<
      LaunchIntentDependencies["statSync"]
    >;
  }

  function readMenuSubmenu(
    item: MenuItemConstructorOptions | undefined
  ): MenuItemConstructorOptions[] {
    return Array.isArray(item?.submenu) ? item.submenu : [];
  }

  function createInput(overrides: Partial<CreateDesktopMainCompositionInput> = {}): TestInput {
    const fakeWindow = createFakeWindow();
    const userDataPath = `${process.cwd()}/node_modules/.cache/hugecode-electron-tests-${Math.random()
      .toString(36)
      .slice(2)}`;
    createdUserDataPaths.add(userDataPath);
    const appOn = vi.fn();
    const appWhenReady = vi.fn(() => Promise.resolve());
    const browserWindowCreate = vi.fn(() => fakeWindow);
    const protocolHandle = vi.fn();

    return {
      __mocks: {
        appOn,
        appWhenReady,
        browserWindowCreate,
        protocolHandle,
      },
      app: {
        addRecentDocument: vi.fn(),
        enableSandbox: vi.fn(),
        getPath: vi.fn(() => userDataPath),
        getVersion: vi.fn(() => "0.1.0"),
        isPackaged: true,
        on: appOn,
        quit: vi.fn(),
        requestSingleInstanceLock: vi.fn(() => true),
        setAsDefaultProtocolClient: vi.fn(() => true),
        whenReady: appWhenReady,
      },
      autoUpdater: {
        checkForUpdates: vi.fn(),
        on: vi.fn(),
        quitAndInstall: vi.fn(),
      },
      arch: "x64" as const,
      browserWindow: {
        create: browserWindowCreate,
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
        statSync: createStatSyncMock("file"),
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
            handle: protocolHandle,
            isProtocolHandled: vi.fn(() => false),
          },
          setPermissionCheckHandler: vi.fn(),
          setPermissionRequestHandler: vi.fn(),
        },
      },
      shell: {
        openPath: vi.fn(async () => ""),
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
    await input.__mocks.appWhenReady.mock.results[0]?.value;
    await Promise.resolve();
    await Promise.resolve();

    const fakeWindow = input.__mocks.browserWindowCreate.mock.results[0]?.value;
    expect(input.protocol.registerSchemesAsPrivileged).toHaveBeenCalledTimes(1);
    expect(input.__mocks.protocolHandle).toHaveBeenCalledTimes(1);
    expect(fakeWindow.loadURL).toHaveBeenCalledWith("hugecode-app://app/index.html");
    expect(fakeWindow.loadFile).not.toHaveBeenCalled();
  });

  it("opens startup workspace launches through the window controller when argv contains a workspace path", async () => {
    const { createDesktopMainComposition } = await import("./createDesktopMainComposition.js");
    const input = createInput({
      launchIntentDependencies: {
        currentWorkingDirectory: () => "/workspace",
        existsSync: createExistsSyncMock("/workspace/demo"),
        statSync: createStatSyncMock("directory"),
      },
      processArgv: ["HugeCode", "demo"],
    });

    createDesktopMainComposition(input).start();
    await input.__mocks.appWhenReady.mock.results[0]?.value;
    await Promise.resolve();
    await Promise.resolve();

    expect(input.__mocks.browserWindowCreate).toHaveBeenCalledTimes(1);
    expect(input.__mocks.browserWindowCreate.mock.calls[0]?.[0]).toMatchObject({
      title: "HugeCode - demo",
    });
  });

  it("treats actionable hugecode workspace deep links as workspace launches during startup", async () => {
    const { createDesktopMainComposition } = await import("./createDesktopMainComposition.js");
    const input = createInput({
      launchIntentDependencies: {
        currentWorkingDirectory: () => "/workspace",
        existsSync: createExistsSyncMock("/workspace/demo"),
        statSync: createStatSyncMock("directory"),
      },
      processArgv: ["HugeCode", "hugecode://workspace/open?path=%2Fworkspace%2Fdemo"],
    });

    createDesktopMainComposition(input).start();
    await input.__mocks.appWhenReady.mock.results[0]?.value;
    await Promise.resolve();
    await Promise.resolve();

    expect(input.__mocks.browserWindowCreate).toHaveBeenCalledTimes(1);
    expect(input.__mocks.browserWindowCreate.mock.calls[0]?.[0]).toMatchObject({
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
        existsSync: createExistsSyncMock("/workspace/demo/src/main.ts"),
        statSync: createStatSyncMock("file"),
      },
    });

    createDesktopMainComposition(input).start();
    await input.__mocks.appWhenReady.mock.results[0]?.value;
    await Promise.resolve();
    await Promise.resolve();

    const { Menu } = await import("electron");
    const lastTemplate = (vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)?.[0] ??
      []) as MenuItemConstructorOptions[];
    const fileMenu = lastTemplate.find((item) => item.label === "File");
    const openFileItem = readMenuSubmenu(fileMenu).find((item) => item.label === "Open File...");

    openFileItem?.click?.({} as never, undefined as never, {} as never);
    await Promise.resolve();
    await Promise.resolve();

    expect(input.dialog.showOpenDialog).toHaveBeenCalledWith({
      buttonLabel: "Open File",
      properties: ["openFile"],
      title: "Open File",
    });
    expect(input.__mocks.browserWindowCreate).toHaveBeenCalledTimes(2);
    expect(input.__mocks.browserWindowCreate.mock.calls[1]?.[0]).toMatchObject({
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
        existsSync: createExistsSyncMock("/workspace/demo"),
        statSync: createStatSyncMock("directory"),
      },
    });

    createDesktopMainComposition(input).start();
    await input.__mocks.appWhenReady.mock.results[0]?.value;
    await Promise.resolve();
    await Promise.resolve();

    const { Menu } = await import("electron");
    const lastTemplate = (vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)?.[0] ??
      []) as MenuItemConstructorOptions[];
    const fileMenu = lastTemplate.find((item) => item.label === "File");
    const openFolderItem = readMenuSubmenu(fileMenu).find(
      (item) => item.label === "Open Folder..."
    );

    openFolderItem?.click?.({} as never, undefined as never, {} as never);
    await Promise.resolve();
    await Promise.resolve();

    expect(input.dialog.showOpenDialog).toHaveBeenCalledWith({
      buttonLabel: "Open Folder",
      properties: ["openDirectory"],
      title: "Open Folder",
    });
    expect(input.__mocks.browserWindowCreate).toHaveBeenCalledTimes(2);
    expect(input.__mocks.browserWindowCreate.mock.calls[1]?.[0]).toMatchObject({
      title: "HugeCode - demo",
    });
  });

  it("preserves file launch targets and records them as recent documents during startup", async () => {
    const { createDesktopMainComposition } = await import("./createDesktopMainComposition.js");
    const input = createInput({
      launchIntentDependencies: {
        currentWorkingDirectory: () => "/workspace",
        existsSync: createExistsSyncMock("/workspace/demo/src/main.ts"),
        statSync: createStatSyncMock("file"),
      },
      processArgv: ["HugeCode", "demo/src/main.ts"],
    });

    createDesktopMainComposition(input).start();
    await input.__mocks.appWhenReady.mock.results[0]?.value;
    await Promise.resolve();
    await Promise.resolve();

    expect(input.app.addRecentDocument).toHaveBeenCalledWith("/workspace/demo/src/main.ts");
    expect(input.__mocks.browserWindowCreate.mock.calls[0]?.[0]).toMatchObject({
      title: "HugeCode - src",
    });
  });

  it("delivers live macOS open-url workspace launches to an existing window", async () => {
    const { createDesktopMainComposition } = await import("./createDesktopMainComposition.js");
    const input = createInput({
      launchIntentDependencies: {
        currentWorkingDirectory: () => "/workspace",
        existsSync: createExistsSyncMock("/workspace/demo"),
        statSync: createStatSyncMock("directory"),
      },
      processArgv: ["HugeCode", "demo"],
    });

    createDesktopMainComposition(input).start();
    await input.__mocks.appWhenReady.mock.results[0]?.value;
    await Promise.resolve();
    await Promise.resolve();

    const openUrlListener = input.__mocks.appOn.mock.calls.find(
      (call) => call[0] === "open-url"
    )?.[1] as ((event: { preventDefault(): void }, url: string) => void) | undefined;
    const fakeWindow = input.__mocks.browserWindowCreate.mock.results[0]?.value;
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
    await input.__mocks.appWhenReady.mock.results[0]?.value;
    await Promise.resolve();
    await Promise.resolve();

    const menuTemplate = (vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)?.[0] ??
      []) as MenuItemConstructorOptions[];
    const helpMenu = menuTemplate.find((item) => item.label === "Help");
    const checkForUpdatesItem = readMenuSubmenu(helpMenu).find(
      (item) => "label" in item && item.label === "Check for Updates..."
    );

    checkForUpdatesItem?.click?.({} as never, undefined as never, {} as never);

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
    await input.__mocks.appWhenReady.mock.results[0]?.value;
    await Promise.resolve();
    await Promise.resolve();

    const menuTemplate = (vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)?.[0] ??
      []) as MenuItemConstructorOptions[];
    const helpMenu = menuTemplate.find((item) => item.label === "Help");
    const checkForUpdatesItem = readMenuSubmenu(helpMenu).find(
      (item) => "label" in item && item.label === "Check for Updates..."
    );

    checkForUpdatesItem?.click?.({} as never, undefined as never, {} as never);

    expect(input.autoUpdater.checkForUpdates).not.toHaveBeenCalled();
    expect(input.shell.openExternal).toHaveBeenCalledWith(
      "https://github.com/OpenHuge/HugeCode/releases"
    );
  });
});
