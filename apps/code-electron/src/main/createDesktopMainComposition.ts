import { join } from "node:path";
import type { BrowserWindowConstructorOptions, IpcMainInvokeEvent } from "electron";
import type {
  DesktopLaunchIntent,
  DesktopReleaseChannel,
  DesktopUpdateState,
} from "../shared/ipc.js";
import { DESKTOP_HOST_IPC_CHANNELS } from "../shared/ipc.js";
import { createDesktopHostHandlers } from "./createDesktopHostHandlers.js";
import {
  createDesktopAppRendererUrl,
  registerDesktopAppProtocolHandler,
  registerDesktopAppProtocolScheme,
} from "./desktopAppProtocol.js";
import { createDesktopApplicationMenuController } from "./desktopApplicationMenu.js";
import { createDesktopAutoUpdateConfigurator } from "./desktopAutoUpdateConfigurator.js";
import { registerDesktopAppLifecycle } from "./desktopAppLifecycle.js";
import {
  buildDesktopIssueReporterUrl,
  buildDesktopSupportSnapshotText,
  resolveDesktopDiagnosticsPaths,
  startDesktopLocalCrashReporter,
} from "./desktopDiagnostics.js";
import { createDesktopIncidentStore } from "./desktopIncidentStore.js";
import { createDesktopLaunchIntentController } from "./desktopLaunchIntentController.js";
import type { CreateDesktopLaunchIntentControllerInput } from "./desktopLaunchIntentController.js";
import { createDesktopRendererTrust } from "./desktopRendererTrust.js";
import { registerDesktopSessionSecurity } from "./desktopSessionSecurity.js";
import { createDesktopShellState, type DesktopWindowBounds } from "./desktopShellState.js";
import { createDesktopNotificationController } from "./desktopNotificationController.js";
import { createDesktopPlatformLauncherController } from "./desktopPlatformLauncherController.js";
import { createDesktopResilienceController } from "./desktopResilienceController.js";
import { createDesktopStateStore } from "./desktopStateStore.js";
import { createDesktopTrayController } from "./desktopTrayController.js";
import { createDesktopUpdaterController } from "./desktopUpdaterController.js";
import { createDesktopWindowController } from "./desktopWindowController.js";
import { registerDesktopHostIpc } from "./registerDesktopHostIpc.js";

const DEFAULT_WINDOW_STATE: DesktopWindowBounds = {
  width: 1440,
  height: 960,
};

const DEFAULT_TRAY_ICON_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAK0lEQVR42mP8z8AARMBEw0AEYBxVSFUBQwqGQYQmGmKagjYwNAxMDAwMDAwAAABEgQJkzJYGQAAAABJRU5ErkJggg==";

type DesktopBrowserWindowLike = {
  close(): void;
  destroy?(): void;
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
  on(event: "responsive", listener: () => void): void;
  on(event: "unresponsive", listener: () => void): void;
  restore(): void;
  show(): void;
  webContents: {
    send(channel: string, payload: DesktopLaunchIntent | DesktopUpdateState): void;
    on(
      event: "render-process-gone",
      listener: (
        _event: unknown,
        details: {
          exitCode: number;
          reason: string;
        }
      ) => void
    ): void;
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
    getPath(name: "crashDumps" | "logs" | "userData"): string;
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
      event: "child-process-gone",
      listener: (
        _event: unknown,
        details: {
          exitCode: number;
          name?: string;
          reason: string;
          serviceName?: string;
          type: string;
        }
      ) => void
    ): void;
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
    setAppLogsPath?(path?: string): void;
    setJumpList?(categories: unknown[] | null): string;
    whenReady(): Promise<unknown>;
  };
  autoUpdater: {
    checkForUpdates(): void;
    on(event: string, listener: (...args: unknown[]) => void): void;
    quitAndInstall(): void;
  };
  clipboard: {
    writeText(text: string): void;
  };
  crashReporter?: {
    start(options: {
      companyName?: string;
      compress?: boolean;
      ignoreSystemCrashHandler?: boolean;
      productName?: string;
      submitURL?: string;
      uploadToServer: boolean;
    }): void;
  } | null;
  arch: NodeJS.Architecture;
  browserWindow: DesktopBrowserWindowFacade;
  dialog: {
    showOpenDialog(options: {
      buttonLabel?: string;
      properties: Array<"openDirectory" | "openFile">;
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
  const userDataPath = input.app.getPath("userData");
  const diagnosticsPaths = resolveDesktopDiagnosticsPaths({
    app: input.app,
    logger: console,
  });
  const incidentStore = createDesktopIncidentStore({
    incidentLogPath: diagnosticsPaths.incidentLogPath,
  });

  const rendererTrust = createDesktopRendererTrust({
    rendererDevServerUrl: input.rendererDevServerUrl ?? null,
  });
  const stateStore = createDesktopStateStore({
    statePath: join(userDataPath, "desktop-state.json"),
  });
  const shellState = createDesktopShellState({
    persistedState: stateStore.read(),
  });
  const notificationController = createDesktopNotificationController();
  const windowControllerRef: {
    current: ReturnType<typeof createDesktopWindowController> | null;
  } = {
    current: null,
  };
  const resilienceController = createDesktopResilienceController({
    isQuitting() {
      return isQuitting;
    },
    logIncident(incident) {
      incidentStore.record(incident);
    },
    logger: console,
    notificationController,
    recoverWindow(windowId) {
      return windowControllerRef.current?.recoverWindow(windowId) ?? null;
    },
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
    onRenderProcessGone(payload) {
      resilienceController.handleRenderProcessGone(payload);
    },
    onWindowResponsive(payload) {
      resilienceController.handleWindowResponsive(payload);
    },
    onWindowUnresponsive(payload) {
      resilienceController.handleWindowUnresponsive(payload);
    },
    openExternalUrl(url) {
      return input.shell.openExternal(url);
    },
    persistState: persistDesktopState,
    preloadPath: join(input.sourceDirectory, "../preload/preload.js"),
    shellState,
  });
  windowControllerRef.current = windowController;
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

  if (
    !startDesktopLocalCrashReporter({
      channel: input.releaseChannel ?? "beta",
      crashReporter: input.crashReporter ?? null,
      logger: console,
      version: appVersion,
    }) &&
    input.crashReporter
  ) {
    incidentStore.record({
      details: {
        channel: input.releaseChannel ?? "beta",
        version: appVersion,
      },
      event: "desktop_crash_reporter_init_failed",
      level: "warn",
      message: "HugeCode desktop could not start the local crash reporter.",
    });
  }

  function getDiagnosticsInfo() {
    const diagnosticsSummary = incidentStore.getSummary();
    const updateState = updaterController.getState();
    const supportSnapshotText = buildDesktopSupportSnapshotText({
      arch: input.arch,
      channel: input.releaseChannel ?? "beta",
      crashDumpsDirectoryPath: diagnosticsPaths.crashDumpsDirectoryPath,
      diagnosticsSummary,
      platform: input.platform,
      updateState,
      version: appVersion,
    });
    return {
      crashDumpsDirectoryPath: diagnosticsPaths.crashDumpsDirectoryPath,
      ...diagnosticsSummary,
      reportIssueUrl:
        buildDesktopIssueReporterUrl({
          arch: input.arch,
          channel: input.releaseChannel ?? "beta",
          crashDumpsDirectoryPath: diagnosticsPaths.crashDumpsDirectoryPath,
          diagnosticsSummary,
          platform: input.platform,
          repoUrl: input.repositoryUrl ?? "https://github.com/OpenHuge/HugeCode",
          updateState,
          version: appVersion,
        }) ?? null,
      supportSnapshotText,
    };
  }

  function copySupportSnapshot() {
    const diagnosticsInfo = getDiagnosticsInfo();
    if (!diagnosticsInfo.supportSnapshotText) {
      incidentStore.record({
        details: {
          version: appVersion,
        },
        event: "desktop_support_snapshot_unavailable",
        level: "warn",
        message: "HugeCode desktop could not build a support snapshot for clipboard copy.",
      });
      notificationController.showDesktopNotification({
        body: "HugeCode could not prepare desktop support details for copying.",
        title: "HugeCode Couldn’t Copy Support Snapshot",
      });
      return false;
    }

    try {
      input.clipboard.writeText(diagnosticsInfo.supportSnapshotText);
      notificationController.showDesktopNotification({
        body: "Desktop support details were copied to the clipboard.",
        title: "Support Snapshot Copied",
      });
      return true;
    } catch (error) {
      incidentStore.record({
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
        event: "desktop_support_snapshot_copy_failed",
        level: "warn",
        message: "HugeCode desktop could not copy the support snapshot to the clipboard.",
      });
      notificationController.showDesktopNotification({
        body: "HugeCode could not copy desktop support details to the clipboard.",
        title: "HugeCode Couldn’t Copy Support Snapshot",
      });
      return false;
    }
  }

  async function openDesktopPath(
    path: string | null,
    options?: {
      failureEvent: string;
      failureMessage: string;
      notificationBody: string;
      notificationTitle: string;
      revealFallbackPath?: string | null;
    }
  ) {
    if (!path) {
      return false;
    }

    try {
      const error = await input.shell.openPath(path);
      if (error === "") {
        return true;
      }

      incidentStore.record({
        details: {
          error,
          path,
        },
        event: options?.failureEvent ?? "desktop_open_path_failed",
        level: "warn",
        message: options?.failureMessage ?? "HugeCode desktop could not open a local path.",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      incidentStore.record({
        details: {
          error: errorMessage,
          path,
        },
        event: options?.failureEvent ?? "desktop_open_path_failed",
        level: "warn",
        message: options?.failureMessage ?? "HugeCode desktop could not open a local path.",
      });
    }

    if (options?.revealFallbackPath) {
      input.shell.showItemInFolder(options.revealFallbackPath);
      return true;
    }

    notificationController.showDesktopNotification({
      body: options?.notificationBody ?? "HugeCode could not open the requested path.",
      title: options?.notificationTitle ?? "HugeCode Couldn’t Open a Path",
    });
    return false;
  }

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

  function persistDesktopState() {
    stateStore.write(shellState.toPersistedState());
  }

  function updateDesktopChrome() {
    platformLauncherController.update();
    trayController.update();
    applicationMenuController.update();
  }

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
    onCopySupportSnapshot: () => {
      copySupportSnapshot();
    },
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
    onOpenCrashDumpsFolder: () => {
      const diagnosticsInfo = getDiagnosticsInfo();
      if (!diagnosticsInfo.crashDumpsDirectoryPath) {
        notificationController.showDesktopNotification({
          body: "No local crash-dumps directory is currently available for this build.",
          title: "Crash Dumps Unavailable",
        });
        return;
      }

      void openDesktopPath(diagnosticsInfo.crashDumpsDirectoryPath, {
        failureEvent: "desktop_open_crash_dumps_failed",
        failureMessage: "HugeCode desktop could not open the crash-dumps directory.",
        notificationBody: "HugeCode could not open the local crash-dumps directory.",
        notificationTitle: "HugeCode Couldn’t Open Crash Dumps",
      });
    },
    onOpenIncidentLog: () => {
      const diagnosticsInfo = getDiagnosticsInfo();
      void openDesktopPath(
        diagnosticsInfo.recentIncidentCount > 0
          ? diagnosticsInfo.incidentLogPath
          : diagnosticsInfo.logsDirectoryPath,
        diagnosticsInfo.recentIncidentCount > 0
          ? {
              failureEvent: "desktop_open_incident_log_failed",
              failureMessage: "HugeCode desktop could not open the incident log.",
              notificationBody:
                "HugeCode could not open the incident log directly. The file was revealed in the logs folder instead.",
              notificationTitle: "HugeCode Couldn’t Open the Incident Log",
              revealFallbackPath: diagnosticsInfo.incidentLogPath,
            }
          : {
              failureEvent: "desktop_open_logs_directory_failed",
              failureMessage: "HugeCode desktop could not open the logs directory.",
              notificationBody: "HugeCode could not open the logs directory.",
              notificationTitle: "HugeCode Couldn’t Open the Logs Folder",
            }
      );
    },
    onOpenLogsFolder: () => {
      const diagnosticsInfo = getDiagnosticsInfo();
      void openDesktopPath(diagnosticsInfo.logsDirectoryPath, {
        failureEvent: "desktop_open_logs_directory_failed",
        failureMessage: "HugeCode desktop could not open the logs directory.",
        notificationBody: "HugeCode could not open the logs directory.",
        notificationTitle: "HugeCode Couldn’t Open the Logs Folder",
      });
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
    onReportIssue: () => {
      const diagnosticsInfo = getDiagnosticsInfo();
      if (diagnosticsInfo.reportIssueUrl) {
        void input.shell.openExternal(diagnosticsInfo.reportIssueUrl);
      }
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
    listRecentSessions() {
      return shellState.recentSessions;
    },
    notificationController,
    openExternalUrl: async (url) => {
      await input.shell.openExternal(url);
      return true;
    },
    openPath(path) {
      return openDesktopPath(path, {
        failureEvent: "desktop_open_path_failed",
        failureMessage: "HugeCode desktop could not open a local path.",
        notificationBody: "HugeCode could not open the requested path.",
        notificationTitle: "HugeCode Couldn’t Open a Path",
      });
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
    input.app.on("child-process-gone", (_event, details) => {
      resilienceController.handleChildProcessGone(details);
    });

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
