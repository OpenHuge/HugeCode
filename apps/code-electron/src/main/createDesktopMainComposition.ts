import { spawn } from "node:child_process";
import { join } from "node:path";
import type { BrowserWindowConstructorOptions, IpcMainInvokeEvent } from "electron";
import type {
  DesktopDiagnosticsInfo,
  DesktopLaunchIntent,
  DesktopOpenDialogInput,
  DesktopOpenDialogResult,
  DesktopOpenPathInInput,
  DesktopReleaseChannel,
  DesktopUpdateState,
} from "@ku0/code-platform-interfaces";
import { DESKTOP_HOST_IPC_CHANNELS } from "@ku0/code-platform-interfaces";
import { createDesktopHostHandlers } from "./createDesktopHostHandlers.js";
import {
  createDesktopAppRendererUrl,
  registerDesktopAppProtocolHandler,
  registerDesktopAppProtocolScheme,
} from "./desktopAppProtocol.js";
import { createDesktopApplicationMenuController } from "./desktopApplicationMenu.js";
import { createDesktopAutoUpdateConfigurator } from "./desktopAutoUpdateConfigurator.js";
import { registerDesktopAppLifecycle } from "./desktopAppLifecycle.js";
import { createDesktopLaunchIntentController } from "./desktopLaunchIntentController.js";
import type { CreateDesktopLaunchIntentControllerInput } from "./desktopLaunchIntentController.js";
import { createDesktopRendererTrust } from "./desktopRendererTrust.js";
import { registerDesktopSessionSecurity } from "./desktopSessionSecurity.js";
import { createDesktopShellState, type DesktopWindowBounds } from "./desktopShellState.js";
import { createDesktopNotificationController } from "./desktopNotificationController.js";
import { createDesktopPlatformLauncherController } from "./desktopPlatformLauncherController.js";
import { createDesktopStateStore } from "./desktopStateStore.js";
import { createDesktopTrayController } from "./desktopTrayController.js";
import { createDesktopUpdaterController } from "./desktopUpdaterController.js";
import { createDesktopWindowController } from "./desktopWindowController.js";
import { listLocalChromeDebuggerEndpoints } from "./localChromeDebuggerDiscovery.js";
import { registerDesktopHostIpc } from "./registerDesktopHostIpc.js";

const DEFAULT_WINDOW_STATE: DesktopWindowBounds = {
  width: 1440,
  height: 960,
};

const DEFAULT_TRAY_ICON_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAK0lEQVR42mP8z8AARMBEw0AEYBxVSFUBQwqGQYQmGmKagjYwNAxMDAwMDAwAAABEgQJkzJYGQAAAABJRU5ErkJggg==";

type DesktopBrowserWindowLike = {
  close(): void;
  focus(): void;
  getBounds(): DesktopWindowBounds;
  hide(): void;
  id: number;
  isDestroyed(): boolean;
  isFocused(): boolean;
  isMinimized(): boolean;
  isVisible(): boolean;
  loadFile(path: string): Promise<unknown> | unknown;
  loadURL(url: string): Promise<unknown> | unknown;
  once(event: "ready-to-show", listener: () => void): void;
  on(event: "focus", listener: () => void): void;
  on(event: "closed", listener: () => void): void;
  on(event: "close", listener: (event: { preventDefault(): void }) => void): void;
  restore(): void;
  show(): void;
  webContents: {
    send(channel: string, payload: DesktopLaunchIntent | DesktopUpdateState): void;
    on(
      event: "will-navigate",
      listener: (event: { preventDefault(): void }, url: string) => void
    ): void;
    setWindowOpenHandler(handler: (details: { url: string }) => { action: "deny" }): void;
  };
};

type DesktopBrowserWindowFacade = {
  create(options: BrowserWindowConstructorOptions): DesktopBrowserWindowLike;
  fromWebContents(webContents: unknown): DesktopBrowserWindowLike | null;
  getAllWindows(): DesktopBrowserWindowLike[];
};

export type CreateDesktopMainCompositionInput = {
  app: {
    addRecentDocument?(path: string): void;
    dock?: {
      setMenu(menu: object | null): void;
    } | null;
    enableSandbox(): void;
    getPath(name: "userData"): string;
    getJumpListSettings?(): {
      minItems: number;
      removedItems: Array<{
        args?: string;
        title?: string;
        type?: "file" | "separator" | "task";
      }>;
    };
    getVersion(): string;
    isPackaged: boolean;
    on(event: "activate", listener: () => void): void;
    on(event: "before-quit", listener: () => void): void;
    on(
      event: "open-file",
      listener: (event: { preventDefault(): void }, path: string) => void
    ): void;
    on(event: "open-url", listener: (event: { preventDefault(): void }, url: string) => void): void;
    on(event: "second-instance", listener: (_event: unknown, argv: string[]) => void): void;
    on(event: "window-all-closed", listener: () => void): void;
    quit(): void;
    requestSingleInstanceLock(): boolean;
    setAsDefaultProtocolClient(protocol: string): boolean;
    setJumpList?(categories: unknown[] | null): string;
    whenReady(): Promise<unknown>;
  };
  autoUpdater: {
    checkForUpdates(): void;
    on(event: string, listener: (...args: unknown[]) => void): void;
    quitAndInstall(): void;
  };
  arch: NodeJS.Architecture;
  browserWindow: DesktopBrowserWindowFacade;
  dialog: {
    showOpenDialog(options: {
      buttonLabel?: string;
      properties: Array<"multiSelections" | "openDirectory" | "openFile">;
      title?: string;
    }): Promise<{
      canceled: boolean;
      filePaths: string[];
    }>;
  };
  ipcMain: {
    handle(
      channel: string,
      listener: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown
    ): void;
  };
  platform: NodeJS.Platform;
  launchIntentDependencies?: CreateDesktopLaunchIntentControllerInput["dependencies"];
  protocol: {
    registerSchemesAsPrivileged(
      customSchemes: Array<{
        privileges: {
          secure: boolean;
          standard: boolean;
          stream: boolean;
          supportFetchAPI: boolean;
        };
        scheme: string;
      }>
    ): void;
  };
  processArgv?: string[];
  releaseChannel?: DesktopReleaseChannel;
  rendererDevServerUrl?: string | null;
  repositoryUrl?: string;
  session: {
    defaultSession: {
      protocol: {
        handle(
          scheme: string,
          handler: (request: { url: string }) => Promise<Response> | Response
        ): void;
        isProtocolHandled?(scheme: string): boolean;
      };
      setPermissionCheckHandler(
        handler: (
          webContents: unknown,
          permission: string,
          requestingOrigin: string,
          details?: unknown
        ) => boolean
      ): void;
      setPermissionRequestHandler(
        handler: (
          webContents: unknown,
          permission: string,
          callback: (granted: boolean) => void,
          details?: unknown
        ) => void
      ): void;
    } | null;
  };
  shell: {
    openPath(path: string): Promise<string>;
    openExternal(url: string): Promise<void>;
    showItemInFolder(path: string): void;
  };
  sourceDirectory: string;
  staticUpdateBaseUrl?: string | null;
  trayIconDataUrl?: string;
};

export function createDesktopMainComposition(input: CreateDesktopMainCompositionInput) {
  let isQuitting = false;
  let desktopReady = false;
  const rendererRoot = join(input.sourceDirectory, "../renderer");

  const rendererTrust = createDesktopRendererTrust({
    rendererDevServerUrl: input.rendererDevServerUrl ?? null,
  });
  const stateStore = createDesktopStateStore({
    statePath: join(input.app.getPath("userData"), "desktop-state.json"),
  });
  const shellState = createDesktopShellState({
    persistedState: stateStore.read(),
  });
  const windowController = createDesktopWindowController({
    browserWindow: input.browserWindow,
    defaultWindowBounds: DEFAULT_WINDOW_STATE,
    isSafeExternalUrl: rendererTrust.isSafeExternalUrl,
    isQuitting() {
      return isQuitting;
    },
    isTrustedRendererUrl: rendererTrust.isTrustedRendererUrl,
    loadRenderer(window) {
      const rendererDevServerUrl = input.rendererDevServerUrl?.trim() ?? "";
      if (rendererDevServerUrl.length > 0) {
        void window.loadURL(rendererDevServerUrl);
        return;
      }

      void window.loadURL(createDesktopAppRendererUrl());
    },
    notifyWindowsChanged() {
      updateDesktopChrome();
    },
    openExternalUrl(url) {
      return input.shell.openExternal(url);
    },
    persistState: persistDesktopState,
    preloadPath: join(input.sourceDirectory, "../preload/preload.js"),
    shellState,
  });
  const launchIntentController = createDesktopLaunchIntentController({
    app: input.app,
    dependencies: input.launchIntentDependencies,
    initialArgv: input.processArgv,
    onQueuedIntent(intent) {
      if (!desktopReady) {
        return;
      }

      const openWindowInput = launchIntentController.getOpenWindowInput(intent);
      if (!openWindowInput) {
        const focusedWindow = windowController.listWindows().find((window) => window.focused);
        if (focusedWindow && windowController.deliverLaunchIntent(focusedWindow.windowId, intent)) {
          launchIntentController.clearPendingIntent(intent);
          return;
        }

        if (windowController.restoreVisibleWindow()) {
          const visibleWindow = windowController.listWindows()[0];
          if (
            visibleWindow &&
            windowController.deliverLaunchIntent(visibleWindow.windowId, intent)
          ) {
            launchIntentController.clearPendingIntent(intent);
          }
        }
        return;
      }

      const targetSession = shellState.resolveSession(openWindowInput);
      const existingWindow = windowController
        .listWindows()
        .find((window) => window.sessionId === targetSession.id);
      const windowDescriptor = windowController.openWindow(openWindowInput);
      if (existingWindow && windowDescriptor) {
        if (windowController.deliverLaunchIntent(windowDescriptor.windowId, intent)) {
          launchIntentController.clearPendingIntent(intent);
        }
      }
    },
    platform: input.platform,
    protocol: "hugecode",
  });
  const autoUpdateConfigurator = createDesktopAutoUpdateConfigurator({
    arch: input.arch,
    channel: input.releaseChannel ?? "beta",
    isPackaged: input.app.isPackaged,
    logger: console,
    platform: input.platform,
    processArgv: input.processArgv,
    repoUrl: input.repositoryUrl ?? "https://github.com/OpenHuge/HugeCode",
    staticUpdateBaseUrl: input.staticUpdateBaseUrl ?? null,
  });
  const updaterController = createDesktopUpdaterController({
    appVersion: (() => {
      const version = input.app.getVersion();
      return typeof version === "string" && version.length > 0 ? version : null;
    })(),
    autoUpdater: input.autoUpdater,
    configureAutoUpdates: autoUpdateConfigurator.initialize,
    onStateChange(state) {
      windowController.broadcastUpdateState(state);
    },
    repoUrl: input.repositoryUrl ?? "https://github.com/OpenHuge/HugeCode",
    strategy: autoUpdateConfigurator.strategy,
  });
  const appVersion = (() => {
    const version = input.app.getVersion();
    return typeof version === "string" && version.length > 0 ? version : null;
  })();

  async function openPathSelectionDialog(kind: "directory" | "file") {
    const result = await input.dialog.showOpenDialog({
      buttonLabel: kind === "file" ? "Open File" : "Open Folder",
      properties: kind === "file" ? ["openFile"] : ["openDirectory"],
      title: kind === "file" ? "Open File" : "Open Folder",
    });
    if (result.canceled) {
      return;
    }

    const selectedPath = result.filePaths[0];
    if (typeof selectedPath !== "string" || selectedPath.trim().length === 0) {
      return;
    }

    launchIntentController.queueWorkspacePath(selectedPath);
  }

  async function openDesktopDialog(
    dialogInput?: DesktopOpenDialogInput
  ): Promise<DesktopOpenDialogResult> {
    const directory = dialogInput?.directory === true;
    const multiple = dialogInput?.multiple === true;
    const properties: Array<"multiSelections" | "openDirectory" | "openFile"> = [
      directory ? "openDirectory" : "openFile",
      ...(multiple ? (["multiSelections"] as const) : []),
    ];
    const result = await input.dialog.showOpenDialog({
      buttonLabel: directory ? "Open Folder" : "Open File",
      properties,
      title: directory ? "Open Folder" : "Open File",
    });
    if (result.canceled) {
      return null;
    }
    if (multiple) {
      return result.filePaths;
    }
    return result.filePaths[0] ?? null;
  }

  function spawnDetachedCommand(command: string, args: string[]) {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
  }

  async function openPathIn(inputValue: DesktopOpenPathInInput): Promise<boolean> {
    const targetPath = inputValue.path.trim();
    if (!targetPath) {
      return false;
    }

    const command = inputValue.command?.trim() ?? "";
    const appName = inputValue.appName?.trim() ?? "";
    const args = Array.isArray(inputValue.args)
      ? inputValue.args.filter((entry): entry is string => typeof entry === "string")
      : [];

    if (command) {
      spawnDetachedCommand(command, [...args, targetPath]);
      return true;
    }

    if (appName) {
      if (input.platform === "darwin") {
        spawnDetachedCommand("open", [
          "-a",
          appName,
          targetPath,
          ...(args.length > 0 ? ["--args", ...args] : []),
        ]);
        return true;
      }

      spawnDetachedCommand(appName, [...args, targetPath]);
      return true;
    }

    const errorMessage = await input.shell.openPath(targetPath);
    return errorMessage.length === 0;
  }

  function persistDesktopState() {
    stateStore.write(shellState.toPersistedState());
  }

  function updateDesktopChrome() {
    platformLauncherController.update();
    trayController.update();
    applicationMenuController.update();
  }

  const notificationController = createDesktopNotificationController();
  const trayController = createDesktopTrayController({
    isSupported: input.platform === "darwin" || input.platform === "win32",
    onFocusWindow: windowController.focusWindow,
    onNewWindow: () => {
      windowController.openWindow();
    },
    onQuit: () => {
      isQuitting = true;
      input.app.quit();
    },
    onReopenSession: windowController.reopenSession,
    onSetTrayEnabled: (enabled) => {
      shellState.setTrayEnabled(enabled);
      persistDesktopState();
    },
    platform: input.platform,
    readState() {
      return {
        recentSessions: shellState.recentSessions,
        trayEnabled: shellState.trayEnabled,
        windows: windowController.listWindows(),
      };
    },
    restoreVisibleWindow: windowController.restoreVisibleWindow,
    trayIconDataUrl: input.trayIconDataUrl ?? DEFAULT_TRAY_ICON_DATA_URL,
  });
  const applicationMenuController = createDesktopApplicationMenuController({
    onCheckForUpdates: () => {
      const updateState = updaterController.checkForUpdates();
      if (updateState.capability === "automatic") {
        return;
      }

      if (updateState.releaseUrl) {
        void input.shell.openExternal(updateState.releaseUrl);
      }
    },
    onNewWindow: () => {
      windowController.openWindow();
    },
    onOpenFile: () => {
      void openPathSelectionDialog("file");
    },
    onOpenFolder: () => {
      void openPathSelectionDialog("directory");
    },
    onOpenAbout: () => {
      windowController.openWindow({
        windowLabel: "about",
      });
    },
    onQuit: () => {
      isQuitting = true;
      input.app.quit();
    },
    onReopenSession: windowController.reopenSession,
    platform: input.platform,
    readState() {
      return {
        recentSessions: shellState.recentSessions,
      };
    },
  });
  const platformLauncherController = createDesktopPlatformLauncherController({
    app: input.app,
    dependencies: {
      logger: console,
    },
    onNewWindow: () => {
      windowController.openWindow({
        duplicate: true,
      });
    },
    onReopenSession: windowController.reopenSession,
    platform: input.platform,
    readState() {
      return {
        recentSessions: shellState.recentSessions,
      };
    },
  });

  function getDiagnosticsInfo(): DesktopDiagnosticsInfo {
    return {
      crashDumpsDirectoryPath: null,
      incidentLogPath: null,
      lastIncidentAt: null,
      logsDirectoryPath: null,
      recentIncidentCount: 0,
      reportIssueUrl: null,
      supportSnapshotText: null,
    };
  }

  function copySupportSnapshot() {
    return false;
  }

  const desktopHostHandlers = createDesktopHostHandlers({
    appVersion,
    copySupportSnapshot,
    consumePendingLaunchIntent: launchIntentController.consumePendingIntent,
    getAppInfo() {
      const updateState = updaterController.getState();
      return {
        channel: input.releaseChannel ?? "beta",
        platform: input.platform,
        updateCapability: updateState.capability,
        updateMessage: updateState.message ?? null,
        updateMode: updateState.mode,
        version: appVersion,
      };
    },
    getDiagnosticsInfo,
    listLocalChromeDebuggerEndpoints,
    listRecentSessions() {
      return shellState.recentSessions;
    },
    notificationController,
    openDialog: openDesktopDialog,
    openExternalUrl: async (url) => {
      await input.shell.openExternal(url);
      return true;
    },
    openPathIn,
    async openPath(path) {
      const errorMessage = await input.shell.openPath(path);
      return errorMessage.length === 0;
    },
    persistTrayEnabled(enabled) {
      shellState.setTrayEnabled(enabled);
      persistDesktopState();
    },
    revealItemInDir(path) {
      input.shell.showItemInFolder(path);
      return true;
    },
    trayController,
    updaterController,
    windowController,
  });

  function isTrustedIpcSender(event: {
    sender: unknown;
    senderFrame?: { url?: string | undefined } | null;
  }) {
    if (!windowController.hasWindowForWebContents(event.sender)) {
      return false;
    }

    const senderFrameUrl = event.senderFrame?.url;
    if (typeof senderFrameUrl !== "string" || senderFrameUrl.length === 0) {
      return true;
    }

    return rendererTrust.isTrustedRendererUrl(senderFrameUrl);
  }

  function start() {
    input.app.enableSandbox();
    registerDesktopAppProtocolScheme(input.protocol);
    updaterController.initialize();
    launchIntentController.registerAppHandlers();
    launchIntentController.registerProtocolClient();

    registerDesktopHostIpc({
      channels: DESKTOP_HOST_IPC_CHANNELS,
      handlers: desktopHostHandlers,
      ipcMain: input.ipcMain,
      isTrustedSender: isTrustedIpcSender,
    });

    registerDesktopAppLifecycle({
      app: input.app,
      browserWindow: {
        getAllWindows() {
          return input.browserWindow.getAllWindows();
        },
      },
      createWindowForSession: windowController.createWindowForSession,
      getLatestSession() {
        return shellState.recentSessions[0] ?? null;
      },
      getPersistedSessions() {
        return shellState.recentSessions;
      },
      getInitialOpenWindowInput() {
        return launchIntentController.getPendingOpenWindowInput();
      },
      isTrayEnabled() {
        return shellState.trayEnabled;
      },
      onReady() {
        const defaultSession = input.session.defaultSession;
        if (!defaultSession) {
          throw new Error("Electron defaultSession is unavailable for HugeCode desktop startup.");
        }

        registerDesktopAppProtocolHandler({
          rendererRoot,
          session: defaultSession,
        });
        registerDesktopSessionSecurity(defaultSession);
        desktopReady = true;
        updateDesktopChrome();
      },
      onBeforeQuit() {
        isQuitting = true;
        applicationMenuController.dispose();
        platformLauncherController.dispose();
        trayController.dispose();
      },
      onSecondInstance(argv) {
        launchIntentController.queueArgv(argv);
        return launchIntentController.getPendingOpenWindowInput();
      },
      openWindow: windowController.openWindow,
      updateTray() {
        updateDesktopChrome();
      },
    });
  }

  return {
    start,
  };
}
