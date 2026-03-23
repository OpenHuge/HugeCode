import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain, shell } from "electron";
import { DESKTOP_HOST_IPC_CHANNELS } from "../shared/ipc.js";
import { registerDesktopAppLifecycle } from "./desktopAppLifecycle.js";
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
const __dirname = dirname(fileURLToPath(import.meta.url));
const rendererDevServerUrl = process.env.HUGECODE_ELECTRON_DEV_SERVER_URL?.trim() ?? "";
const isTraySupported = process.platform === "darwin" || process.platform === "win32";
const trayIconDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAK0lEQVR42mP8z8AARMBEw0AEYBxVSFUBQwqGQYQmGmKagjYwNAxMDAwMDAwAAABEgQJkzJYGQAAAABJRU5ErkJggg==";

let isQuitting = false;

app.enableSandbox();

function getWindowStatePath() {
  return join(app.getPath("userData"), "desktop-state.json");
}

const desktopStateStore = createDesktopStateStore({
  statePath: getWindowStatePath(),
});

const desktopShellState = createDesktopShellState({
  persistedState: desktopStateStore.read(),
});

function persistDesktopState() {
  desktopStateStore.write(desktopShellState.toPersistedState());
}

function updateTray() {
  trayController.update();
}

const windowController = createDesktopWindowController({
  defaultWindowBounds: DEFAULT_WINDOW_STATE,
  isQuitting() {
    return isQuitting;
  },
  loadRenderer(window) {
    if (rendererDevServerUrl.length > 0) {
      void window.loadURL(rendererDevServerUrl);
    } else {
      void window.loadFile(join(__dirname, "../renderer/index.html"));
    }
  },
  notifyWindowsChanged() {
    updateTray();
  },
  openExternalUrl(url) {
    return shell.openExternal(url);
  },
  persistState: persistDesktopState,
  preloadPath: join(__dirname, "../preload/preload.js"),
  shellState: desktopShellState,
});
const notificationController = createDesktopNotificationController();

const trayController = createDesktopTrayController({
  isSupported: isTraySupported,
  onFocusWindow: windowController.focusWindow,
  onNewWindow: () => {
    windowController.openWindow();
  },
  onQuit: () => {
    isQuitting = true;
    app.quit();
  },
  onReopenSession: windowController.reopenSession,
  onSetTrayEnabled: (enabled) => {
    desktopShellState.setTrayEnabled(enabled);
    persistDesktopState();
  },
  platform: process.platform,
  readState() {
    return {
      recentSessions: desktopShellState.recentSessions,
      trayEnabled: desktopShellState.trayEnabled,
      windows: windowController.listWindows(),
    };
  },
  restoreVisibleWindow: windowController.restoreVisibleWindow,
  trayIconDataUrl,
});

registerDesktopHostIpc({
  channels: DESKTOP_HOST_IPC_CHANNELS,
  handlers: {
    closeWindow: windowController.closeWindow,
    focusWindow: windowController.focusWindow,
    getAppVersion() {
      const version = app.getVersion();
      return typeof version === "string" && version.length > 0 ? version : null;
    },
    getCurrentSession(event) {
      return windowController.getSessionForWebContents(event.sender);
    },
    getTrayState() {
      return trayController.getState();
    },
    getWindowLabel(event) {
      return windowController.getWindowLabelForWebContents(event.sender);
    },
    listRecentSessions() {
      return desktopShellState.recentSessions;
    },
    listWindows: windowController.listWindows,
    async openExternalUrl(url) {
      await shell.openExternal(url);
      return true;
    },
    openWindow: windowController.openWindow,
    reopenSession: windowController.reopenSession,
    revealItemInDir(path) {
      shell.showItemInFolder(path);
      return true;
    },
    setTrayEnabled(enabled) {
      desktopShellState.setTrayEnabled(enabled);
      persistDesktopState();
      trayController.update();
      return trayController.getState();
    },
    showNotification(event, input) {
      return notificationController.showNotification(event, input);
    },
  },
  ipcMain,
});

registerDesktopAppLifecycle({
  app,
  browserWindow: {
    getAllWindows() {
      return BrowserWindow.getAllWindows();
    },
  },
  createWindowForSession: windowController.createWindowForSession,
  getLatestSession() {
    return desktopShellState.recentSessions[0] ?? null;
  },
  getPersistedSessions() {
    return desktopShellState.recentSessions;
  },
  isTrayEnabled() {
    return desktopShellState.trayEnabled;
  },
  onBeforeQuit() {
    isQuitting = true;
    trayController.dispose();
  },
  openWindow: windowController.openWindow,
  updateTray,
});
