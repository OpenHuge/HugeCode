import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain, Notification, shell } from "electron";
import { DESKTOP_HOST_IPC_CHANNELS } from "../shared/ipc.js";
import { createDesktopShellState, type DesktopWindowBounds } from "./desktopShellState.js";
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

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
}

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
      if (!Notification.isSupported()) {
        return false;
      }

      const sourceWindow = BrowserWindow.fromWebContents(event.sender);
      const notification = new Notification({
        title: input.title,
        body: input.body ?? "",
      });
      notification.on("click", () => {
        if (sourceWindow && !sourceWindow.isDestroyed()) {
          sourceWindow.show();
          sourceWindow.focus();
        }
      });
      notification.show();
      return true;
    },
  },
  ipcMain,
});

app.on("second-instance", () => {
  const openWindows = BrowserWindow.getAllWindows();
  const nextWindow = openWindows[0];
  if (!nextWindow) {
    windowController.openWindow();
    return;
  }
  if (nextWindow.isMinimized()) {
    nextWindow.restore();
  }
  nextWindow.show();
  nextWindow.focus();
});

app.whenReady().then(() => {
  const persistedSessions = desktopShellState.recentSessions;
  if (persistedSessions.length > 0) {
    for (const session of persistedSessions) {
      windowController.createWindowForSession(session);
    }
  } else {
    windowController.openWindow();
  }
  updateTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const latestSession = desktopShellState.recentSessions[0];
      if (latestSession) {
        windowController.createWindowForSession(latestSession);
      } else {
        windowController.openWindow();
      }
    }
  });
});

app.on("before-quit", () => {
  isQuitting = true;
  trayController.dispose();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && !desktopShellState.trayEnabled) {
    app.quit();
  }
});
