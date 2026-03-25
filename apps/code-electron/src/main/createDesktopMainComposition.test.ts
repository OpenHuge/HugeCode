import { rmSync } from "node:fs";
import type { PathLike } from "node:fs";
import type { MenuItemConstructorOptions } from "electron";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

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
        getPath: vi.fn((name: "crashDumps" | "logs" | "userData") => {
          switch (name) {
            case "logs":
              return `${userDataPath}/logs`;
            case "crashDumps":
              return `${userDataPath}/crashDumps`;
            case "userData":
            default:
              return userDataPath;
          }
        }),
        getVersion: vi.fn(() => "0.1.0"),
        isPackaged: true,
        on: vi.fn(),
        quit: vi.fn(),
        requestSingleInstanceLock: vi.fn(() => true),
        setAsDefaultProtocolClient: vi.fn(() => true),
        setAppLogsPath: vi.fn(),
        whenReady: vi.fn(() => Promise.resolve()),
      },
      autoUpdater: {
        checkForUpdates: vi.fn(),
        on: vi.fn(),
        quitAndInstall: vi.fn(),
      },
      crashReporter: {
        start: vi.fn(),
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
        openPath: vi.fn(async () => ""),
        openExternal: vi.fn(async () => undefined),
        showItemInFolder: vi.fn(),
      },
      sourceDirectory: "/tmp/hugecode-electron/main",
      staticUpdateBaseUrl: null,
      ...overrides,
    };
  }

  function getWhenReadyMock(input: ReturnType<typeof createInput>) {
    return input.app.whenReady as Mock<() => Promise<unknown>>;
  }

  function getAppOnMock(input: ReturnType<typeof createInput>) {
    return input.app.on as Mock;
  }

  function getWindowCreateMock(input: ReturnType<typeof createInput>) {
    return input.browserWindow.create as Mock;
  }

  function getDefaultSession(input: ReturnType<typeof createInput>) {
    return input.session.defaultSession!;
  }

  function createDirectoryStatMock() {
    return vi.fn(
      (_path: PathLike) =>
        ({
          isDirectory: () => true,
          isFile: () => false,
        }) as unknown as import("node:fs").Stats
    ) as unknown as NonNullable<
      NonNullable<ReturnType<typeof createInput>["launchIntentDependencies"]>["statSync"]
    >;
  }

  function createFileStatMock() {
    return vi.fn(
      (_path: PathLike) =>
        ({
          isDirectory: () => false,
          isFile: () => true,
        }) as unknown as import("node:fs").Stats
    ) as unknown as NonNullable<
      NonNullable<ReturnType<typeof createInput>["launchIntentDependencies"]>["statSync"]
    >;
  }

  function getMenuSubmenuItems(menuItem: MenuItemConstructorOptions | undefined) {
    return Array.isArray(menuItem?.submenu) ? menuItem.submenu : [];
  }

  function clickMenuItem(menuItem: MenuItemConstructorOptions | undefined) {
    menuItem?.click?.(undefined as never, undefined as never, undefined as never);
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

  it("starts local crash reporting and resolves canonical logs paths during startup", async () => {
    const { createDesktopMainComposition } = await import("./createDesktopMainComposition.js");
    const input = createInput();

    createDesktopMainComposition(input).start();

    expect(input.app.setAppLogsPath).toHaveBeenCalledTimes(1);
    expect(input.crashReporter?.start).toHaveBeenCalledWith(
      expect.objectContaining({
        companyName: "OpenHuge",
        productName: "HugeCode",
        uploadToServer: false,
      })
    );
  });

  it("loads packaged renderer windows from the internal app protocol instead of file urls", async () => {
    const { createDesktopMainComposition } = await import("./createDesktopMainComposition.js");
    const input = createInput();

    createDesktopMainComposition(input).start();
    await getWhenReadyMock(input).mock.results[0]?.value;
    await Promise.resolve();
    await Promise.resolve();

    const fakeWindow = getWindowCreateMock(input).mock.results[0]?.value;
    expect(input.protocol.registerSchemesAsPrivileged).toHaveBeenCalledTimes(1);
    expect(getDefaultSession(input).protocol.handle).toHaveBeenCalledTimes(1);
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
        existsSync: vi.fn((path: PathLike) => String(path) === "/workspace/demo"),
        statSync: createDirectoryStatMock(),
      },
      processArgv: ["HugeCode", "demo"],
    });

    createDesktopMainComposition(input).start();
    await getWhenReadyMock(input).mock.results[0]?.value;
    await Promise.resolve();
    await Promise.resolve();

    expect(input.browserWindow.create).toHaveBeenCalledTimes(1);
    expect(getWindowCreateMock(input).mock.calls[0]?.[0]).toMatchObject({
      title: "HugeCode - demo",
    });
  });

  it("treats actionable hugecode workspace deep links as workspace launches during startup", async () => {
    const { createDesktopMainComposition } = await import("./createDesktopMainComposition.js");
    const input = createInput({
      launchIntentDependencies: {
        currentWorkingDirectory: () => "/workspace",
        existsSync: vi.fn((path: PathLike) => String(path) === "/workspace/demo"),
        statSync: createDirectoryStatMock(),
      },
      processArgv: ["HugeCode", "hugecode://workspace/open?path=%2Fworkspace%2Fdemo"],
    });

    createDesktopMainComposition(input).start();
    await getWhenReadyMock(input).mock.results[0]?.value;
    await Promise.resolve();
    await Promise.resolve();

    expect(input.browserWindow.create).toHaveBeenCalledTimes(1);
    expect(getWindowCreateMock(input).mock.calls[0]?.[0]).toMatchObject({
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
        existsSync: vi.fn((path: PathLike) => String(path) === "/workspace/demo/src/main.ts"),
        statSync: createFileStatMock(),
      },
    });

    createDesktopMainComposition(input).start();
    await getWhenReadyMock(input).mock.results[0]?.value;
    await Promise.resolve();
    await Promise.resolve();

    const { Menu } = await import("electron");
    const lastTemplate = (vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)?.[0] ??
      []) as MenuItemConstructorOptions[];
    const fileMenu = lastTemplate.find((item) => item.label === "File");
    const openFileItem = getMenuSubmenuItems(fileMenu).find(
      (item: MenuItemConstructorOptions) => item.label === "Open File..."
    );

    clickMenuItem(openFileItem);
    await Promise.resolve();
    await Promise.resolve();

    expect(input.dialog.showOpenDialog).toHaveBeenCalledWith({
      buttonLabel: "Open File",
      properties: ["openFile"],
      title: "Open File",
    });
    expect(input.browserWindow.create).toHaveBeenCalledTimes(2);
    expect(getWindowCreateMock(input).mock.calls[1]?.[0]).toMatchObject({
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
        existsSync: vi.fn((path: PathLike) => String(path) === "/workspace/demo"),
        statSync: createDirectoryStatMock(),
      },
    });

    createDesktopMainComposition(input).start();
    await getWhenReadyMock(input).mock.results[0]?.value;
    await Promise.resolve();
    await Promise.resolve();

    const { Menu } = await import("electron");
    const lastTemplate = (vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)?.[0] ??
      []) as MenuItemConstructorOptions[];
    const fileMenu = lastTemplate.find((item) => item.label === "File");
    const openFolderItem = getMenuSubmenuItems(fileMenu).find(
      (item: MenuItemConstructorOptions) => item.label === "Open Folder..."
    );

    clickMenuItem(openFolderItem);
    await Promise.resolve();
    await Promise.resolve();

    expect(input.dialog.showOpenDialog).toHaveBeenCalledWith({
      buttonLabel: "Open Folder",
      properties: ["openDirectory"],
      title: "Open Folder",
    });
    expect(input.browserWindow.create).toHaveBeenCalledTimes(2);
    expect(getWindowCreateMock(input).mock.calls[1]?.[0]).toMatchObject({
      title: "HugeCode - demo",
    });
  });

  it("preserves file launch targets and records them as recent documents during startup", async () => {
    const { createDesktopMainComposition } = await import("./createDesktopMainComposition.js");
    const input = createInput({
      launchIntentDependencies: {
        currentWorkingDirectory: () => "/workspace",
        existsSync: vi.fn((path: PathLike) => String(path) === "/workspace/demo/src/main.ts"),
        statSync: createFileStatMock(),
      },
      processArgv: ["HugeCode", "demo/src/main.ts"],
    });

    createDesktopMainComposition(input).start();
    await getWhenReadyMock(input).mock.results[0]?.value;
    await Promise.resolve();
    await Promise.resolve();

    expect(input.app.addRecentDocument).toHaveBeenCalledWith("/workspace/demo/src/main.ts");
    expect(getWindowCreateMock(input).mock.calls[0]?.[0]).toMatchObject({
      title: "HugeCode - src",
    });
  });

  it("delivers live macOS open-url workspace launches to an existing window", async () => {
    const { createDesktopMainComposition } = await import("./createDesktopMainComposition.js");
    const input = createInput({
      launchIntentDependencies: {
        currentWorkingDirectory: () => "/workspace",
        existsSync: vi.fn((path: PathLike) => String(path) === "/workspace/demo"),
        statSync: createDirectoryStatMock(),
      },
      processArgv: ["HugeCode", "demo"],
    });

    createDesktopMainComposition(input).start();
    await getWhenReadyMock(input).mock.results[0]?.value;
    await Promise.resolve();
    await Promise.resolve();

    const openUrlListener = getAppOnMock(input).mock.calls.find(
      ([event]) => event === "open-url"
    )?.[1] as ((event: { preventDefault(): void }, url: string) => void) | undefined;
    const fakeWindow = getWindowCreateMock(input).mock.results[0]?.value;
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
    await getWhenReadyMock(input).mock.results[0]?.value;
    await Promise.resolve();
    await Promise.resolve();

    const menuTemplate = vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)?.[0] as
      | MenuItemConstructorOptions[]
      | undefined;
    const helpMenu = menuTemplate?.find((item) => item.label === "Help");
    const helpMenuItems = getMenuSubmenuItems(helpMenu);
    const checkForUpdatesItem = helpMenuItems.find(
      (item: MenuItemConstructorOptions) => item.label === "Check for Updates..."
    );

    clickMenuItem(checkForUpdatesItem);

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
    await getWhenReadyMock(input).mock.results[0]?.value;
    await Promise.resolve();
    await Promise.resolve();

    const menuTemplate = vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)?.[0] as
      | MenuItemConstructorOptions[]
      | undefined;
    const helpMenu = menuTemplate?.find((item) => item.label === "Help");
    const helpMenuItems = getMenuSubmenuItems(helpMenu);
    const checkForUpdatesItem = helpMenuItems.find(
      (item: MenuItemConstructorOptions) => item.label === "Check for Updates..."
    );

    clickMenuItem(checkForUpdatesItem);

    expect(input.autoUpdater.checkForUpdates).not.toHaveBeenCalled();
    expect(input.shell.openExternal).toHaveBeenCalledWith(
      "https://github.com/OpenHuge/HugeCode/releases"
    );
  });
});
