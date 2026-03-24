import { join } from "node:path";
import type { IpcMainInvokeEvent } from "electron";
import { DESKTOP_HOST_IPC_CHANNELS } from "../shared/ipc.js";
import type {
  DesktopBrowserDebugSessionInfo,
  DesktopBrowserDebugSessionInput,
  DesktopBrowserWorkspaceSessionInfo,
  DesktopBrowserWorkspaceSessionInput,
  DesktopBrowserWorkspaceSessionQuery,
  DesktopBrowserWorkspaceSetAgentAttachedInput,
  DesktopBrowserWorkspaceSetDevtoolsOpenInput,
  DesktopBrowserWorkspaceSetHostInput,
  DesktopBrowserWorkspaceSetPreviewServerStatusInput,
  DesktopBrowserWorkspaceSetProfileModeInput,
} from "../shared/ipc.js";
import { createDesktopHostHandlers } from "./createDesktopHostHandlers.js";
import { registerDesktopAppLifecycle } from "./desktopAppLifecycle.js";
import { createDesktopRendererTrust } from "./desktopRendererTrust.js";
import { createDesktopShellState, type DesktopWindowBounds } from "./desktopShellState.js";
import { createDesktopNotificationController } from "./desktopNotificationController.js";
import { createDesktopStateStore } from "./desktopStateStore.js";
import { createDesktopTrayController } from "./desktopTrayController.js";
import { createDesktopWindowController } from "./desktopWindowController.js";
import { registerDesktopHostIpc } from "./registerDesktopHostIpc.js";

const DEFAULT_WINDOW_STATE: DesktopWindowBounds = {
  width: 1440,
  height: 960,
};

const DEFAULT_TRAY_ICON_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAK0lEQVR42mP8z8AARMBEw0AEYBxVSFUBQwqGQYQmGmKagjYwNAxMDAwMDAwAAABEgQJkzJYGQAAAABJRU5ErkJggg==";

type BrowserDebugController = {
  ensureBrowserDebugSession(
    input?: DesktopBrowserDebugSessionInput
  ): Promise<DesktopBrowserDebugSessionInfo | null> | DesktopBrowserDebugSessionInfo | null;
  getBrowserDebugSession():
    | Promise<DesktopBrowserDebugSessionInfo | null>
    | DesktopBrowserDebugSessionInfo
    | null;
};

type BrowserWorkspaceController = {
  ensureBrowserWorkspaceSession(
    input?: DesktopBrowserWorkspaceSessionInput
  ): Promise<DesktopBrowserWorkspaceSessionInfo | null> | DesktopBrowserWorkspaceSessionInfo | null;
  getBrowserWorkspaceSession(
    query?: DesktopBrowserWorkspaceSessionQuery
  ): Promise<DesktopBrowserWorkspaceSessionInfo | null> | DesktopBrowserWorkspaceSessionInfo | null;
  listBrowserWorkspaceSessions():
    | Promise<DesktopBrowserWorkspaceSessionInfo[]>
    | DesktopBrowserWorkspaceSessionInfo[];
  setBrowserWorkspaceAgentAttached(
    input: DesktopBrowserWorkspaceSetAgentAttachedInput
  ): Promise<DesktopBrowserWorkspaceSessionInfo | null> | DesktopBrowserWorkspaceSessionInfo | null;
  setBrowserWorkspaceDevtoolsOpen(
    input: DesktopBrowserWorkspaceSetDevtoolsOpenInput
  ): Promise<DesktopBrowserWorkspaceSessionInfo | null> | DesktopBrowserWorkspaceSessionInfo | null;
  setBrowserWorkspaceHost(
    input: DesktopBrowserWorkspaceSetHostInput
  ): Promise<DesktopBrowserWorkspaceSessionInfo | null> | DesktopBrowserWorkspaceSessionInfo | null;
  setBrowserWorkspacePreviewServerStatus(
    input: DesktopBrowserWorkspaceSetPreviewServerStatusInput
  ): Promise<DesktopBrowserWorkspaceSessionInfo | null> | DesktopBrowserWorkspaceSessionInfo | null;
  setBrowserWorkspaceProfileMode(
    input: DesktopBrowserWorkspaceSetProfileModeInput
  ): Promise<DesktopBrowserWorkspaceSessionInfo | null> | DesktopBrowserWorkspaceSessionInfo | null;
};

export type CreateDesktopMainCompositionInput = {
  app: {
    enableSandbox(): void;
    getPath(name: "userData"): string;
    getVersion(): string;
    on(event: "activate", listener: () => void): void;
    on(event: "before-quit", listener: () => void): void;
    on(event: "second-instance", listener: () => void): void;
    on(event: "window-all-closed", listener: () => void): void;
    quit(): void;
    requestSingleInstanceLock(): boolean;
    whenReady(): Promise<unknown>;
  };
  browserDebugController: BrowserDebugController;
  browserWorkspaceController: BrowserWorkspaceController;
  browserWindow: {
    getAllWindows(): Array<{
      focus(): void;
      isDestroyed(): boolean;
      isMinimized(): boolean;
      restore(): void;
      show(): void;
    }>;
  };
  enableAppSandbox?: boolean;
  ipcMain: {
    handle(
      channel: string,
      listener: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown
    ): void;
  };
  platform: NodeJS.Platform;
  preloadPath: string;
  rendererDevServerUrl?: string | null;
  shell: {
    openExternal(url: string): Promise<void>;
    showItemInFolder(path: string): void;
  };
  sourceDirectory: string;
  trayIconDataUrl?: string;
};

export function createDesktopMainComposition(input: CreateDesktopMainCompositionInput) {
  let isQuitting = false;

  const rendererTrust = createDesktopRendererTrust({
    rendererDevServerUrl: input.rendererDevServerUrl ?? null,
  });
  const stateStore = createDesktopStateStore({
    statePath: join(input.app.getPath("userData"), "desktop-state.json"),
  });
  const shellState = createDesktopShellState({
    persistedState: stateStore.read(),
  });

  function persistDesktopState() {
    stateStore.write(shellState.toPersistedState());
  }

  const windowController = createDesktopWindowController({
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

      void window.loadFile(join(input.sourceDirectory, "../renderer/index.html"));
    },
    notifyWindowsChanged() {
      trayController.update();
    },
    openExternalUrl(url) {
      return input.shell.openExternal(url);
    },
    persistState: persistDesktopState,
    preloadPath: input.preloadPath,
    shellState,
    webPreferences: {
      // Electron only enables the current ESM preload bridge on unsandboxed windows.
      sandbox: false,
    },
  });
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

  const desktopHostHandlers = createDesktopHostHandlers({
    appVersion: (() => {
      const version = input.app.getVersion();
      return typeof version === "string" && version.length > 0 ? version : null;
    })(),
    browserDebugController: input.browserDebugController,
    browserWorkspaceController: input.browserWorkspaceController,
    listRecentSessions() {
      return shellState.recentSessions;
    },
    notificationController,
    openExternalUrl: async (url) => {
      await input.shell.openExternal(url);
      return true;
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
    if (input.enableAppSandbox === true) {
      input.app.enableSandbox();
    }

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
      isTrayEnabled() {
        return shellState.trayEnabled;
      },
      onBeforeQuit() {
        isQuitting = true;
        trayController.dispose();
      },
      openWindow: windowController.openWindow,
      updateTray() {
        trayController.update();
      },
    });
  }

  return {
    start,
  };
}
