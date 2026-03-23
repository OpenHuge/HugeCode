import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  shell,
  Tray,
} from "electron";
import type { Event as ElectronEvent, HandlerDetails } from "electron";
import type { OpenDesktopWindowInput } from "../shared/ipc.js";
import { DESKTOP_HOST_IPC_CHANNELS } from "../shared/ipc.js";
import {
  createDesktopShellState,
  resolveCloseBehavior,
  type DesktopSessionDescriptor,
  type DesktopWindowBounds,
} from "./desktopShellState.js";
import {
  ensureBrowserDebugSession,
  getBrowserDebugSession,
  resolveBrowserDebugPort,
} from "./browserDebugSession.js";
import { createDesktopStateStore } from "./desktopStateStore.js";
import { registerDesktopHostIpc } from "./registerDesktopHostIpc.js";
import { buildTrayMenuTemplate, getTrayMenuStateSignature } from "./trayMenu.js";

const DEFAULT_WINDOW_STATE: DesktopWindowBounds = {
  width: 1440,
  height: 960,
};
const __dirname = dirname(fileURLToPath(import.meta.url));
const rendererDevServerUrl = process.env.HUGECODE_ELECTRON_DEV_SERVER_URL?.trim() ?? "";
const enableAppSandbox = process.env.HUGECODE_ELECTRON_ENABLE_SANDBOX === "1";
const isTraySupported = process.platform === "darwin" || process.platform === "win32";
const trayIconDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAK0lEQVR42mP8z8AARMBEw0AEYBxVSFUBQwqGQYQmGmKagjYwNAxMDAwMDAwAAABEgQJkzJYGQAAAABJRU5ErkJggg==";

let isQuitting = false;
let tray: Tray | null = null;
let trayMenu: Menu | null = null;
let trayMenuSignature: string | null = null;
const activeWindows = new Map<number, BrowserWindow>();

if (enableAppSandbox) {
  app.enableSandbox();
}
app.commandLine.appendSwitch("remote-debugging-address", "127.0.0.1");
app.commandLine.appendSwitch("remote-debugging-port", String(resolveBrowserDebugPort()));

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

function getWindowTitle(session: DesktopSessionDescriptor) {
  if (session.windowLabel === "about") {
    return "HugeCode About";
  }

  if (session.workspaceLabel) {
    return `HugeCode - ${session.workspaceLabel}`;
  }

  return "HugeCode";
}

function createBrowserWindowForSession(session: DesktopSessionDescriptor) {
  const windowState = session.windowBounds ?? DEFAULT_WINDOW_STATE;
  const nextWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    show: false,
    title: getWindowTitle(session),
    backgroundColor: "#0f1115",
    webPreferences: {
      preload: join(__dirname, "../preload/preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      // Electron only enables ESM preload entrypoints on unsandboxed windows.
      sandbox: false,
    },
  });

  nextWindow.once("ready-to-show", () => {
    nextWindow.show();
  });

  nextWindow.on("focus", () => {
    const activeSession = desktopShellState.getSessionByWindowId(nextWindow.id);
    if (activeSession) {
      desktopShellState.attachWindow(activeSession, nextWindow.id);
      persistDesktopState();
      updateTray();
    }
  });

  nextWindow.webContents.setWindowOpenHandler(({ url }: HandlerDetails) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (rendererDevServerUrl.length > 0) {
    void nextWindow.loadURL(rendererDevServerUrl);
  } else {
    void nextWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  nextWindow.on("close", (event: ElectronEvent) => {
    if (!isQuitting && resolveCloseBehavior(desktopShellState, nextWindow.id) === "hide") {
      event.preventDefault();
      nextWindow.hide();
      updateTray();
      return;
    }

    desktopShellState.detachWindow(nextWindow.id, nextWindow.getBounds());
    persistDesktopState();
    activeWindows.delete(nextWindow.id);
    updateTray();
  });

  nextWindow.on("closed", () => {
    activeWindows.delete(nextWindow.id);
    updateTray();
  });

  desktopShellState.attachWindow(session, nextWindow.id);
  activeWindows.set(nextWindow.id, nextWindow);
  persistDesktopState();
  updateTray();

  return nextWindow;
}

function focusWindow(windowId: number) {
  const targetWindow = activeWindows.get(windowId);
  if (!targetWindow || targetWindow.isDestroyed()) {
    return false;
  }

  if (targetWindow.isMinimized()) {
    targetWindow.restore();
  }
  targetWindow.show();
  targetWindow.focus();
  return true;
}

function findWindowBySessionId(sessionId: string) {
  for (const [windowId] of activeWindows) {
    const session = desktopShellState.getSessionByWindowId(windowId);
    if (session?.id === sessionId) {
      return activeWindows.get(windowId) ?? null;
    }
  }

  return null;
}

function openWindow(input: OpenDesktopWindowInput = {}) {
  const session = desktopShellState.resolveSession(input);
  const existingWindow = findWindowBySessionId(session.id);
  if (existingWindow) {
    focusWindow(existingWindow.id);
    return existingWindow;
  }

  return createBrowserWindowForSession(session);
}

function reopenSession(sessionId: string) {
  const session = desktopShellState.getSessionById(sessionId);
  if (!session) {
    return false;
  }

  const existingWindow = findWindowBySessionId(session.id);
  if (existingWindow) {
    return focusWindow(existingWindow.id);
  }

  createBrowserWindowForSession(session);
  return true;
}

function listWindows() {
  return desktopShellState.listWindows().map((windowDescriptor) => ({
    ...windowDescriptor,
    focused: activeWindows.get(windowDescriptor.windowId)?.isFocused() ?? false,
    hidden: activeWindows.get(windowDescriptor.windowId)?.isVisible() === false,
  }));
}

function getTrayState() {
  return {
    supported: isTraySupported,
    enabled: isTraySupported && desktopShellState.trayEnabled,
  };
}

function createTrayIcon() {
  const image = nativeImage.createFromDataURL(trayIconDataUrl);
  if (process.platform === "darwin") {
    image.setTemplateImage(true);
  }
  return image;
}

function updateTray() {
  if (!isTraySupported) {
    return;
  }

  if (!desktopShellState.trayEnabled) {
    tray?.setContextMenu(null);
    tray?.destroy();
    tray = null;
    trayMenu = null;
    trayMenuSignature = null;
    return;
  }

  if (!tray) {
    tray = new Tray(createTrayIcon());
    tray.setToolTip("HugeCode");
    tray.on("double-click", () => {
      const visibleWindow = BrowserWindow.getAllWindows().find((window) => !window.isDestroyed());
      if (visibleWindow) {
        visibleWindow.show();
        visibleWindow.focus();
      } else {
        openWindow();
      }
    });
  }

  const trayMenuState = {
    trayEnabled: desktopShellState.trayEnabled,
    windows: listWindows(),
    recentSessions: desktopShellState.recentSessions,
  };
  const nextTrayMenuSignature = getTrayMenuStateSignature(trayMenuState);
  if (trayMenuSignature === nextTrayMenuSignature && trayMenu) {
    return;
  }

  trayMenu = Menu.buildFromTemplate(
    buildTrayMenuTemplate(trayMenuState, {
      onFocusWindow: (windowId) => {
        focusWindow(windowId);
      },
      onNewWindow: () => {
        openWindow();
      },
      onQuit: () => {
        isQuitting = true;
        app.quit();
      },
      onReopenSession: (sessionId) => {
        reopenSession(sessionId);
      },
      onToggleTray: (enabled) => {
        desktopShellState.setTrayEnabled(enabled);
        persistDesktopState();
        updateTray();
      },
    })
  );
  trayMenuSignature = nextTrayMenuSignature;
  tray.setContextMenu(trayMenu);
}

registerDesktopHostIpc({
  channels: DESKTOP_HOST_IPC_CHANNELS,
  handlers: {
    closeWindow(windowId) {
      const targetWindow = activeWindows.get(windowId);
      if (!targetWindow || targetWindow.isDestroyed()) {
        return false;
      }
      targetWindow.close();
      return true;
    },
    ensureBrowserDebugSession,
    focusWindow,
    getAppVersion() {
      const version = app.getVersion();
      return typeof version === "string" && version.length > 0 ? version : null;
    },
    getBrowserDebugSession,
    getCurrentSession(event) {
      const sourceWindow = BrowserWindow.fromWebContents(event.sender);
      if (!sourceWindow) {
        return null;
      }
      return desktopShellState.getSessionByWindowId(sourceWindow.id);
    },
    getTrayState,
    getWindowLabel(event) {
      const sourceWindow = BrowserWindow.fromWebContents(event.sender);
      if (!sourceWindow) {
        return "main";
      }
      return desktopShellState.getSessionByWindowId(sourceWindow.id)?.windowLabel ?? "main";
    },
    listRecentSessions() {
      return desktopShellState.recentSessions;
    },
    listWindows,
    async openExternalUrl(url) {
      await shell.openExternal(url);
      return true;
    },
    openWindow(input) {
      const window = openWindow(input);
      const session = desktopShellState.getSessionByWindowId(window.id);
      if (!session) {
        return null;
      }
      return {
        windowId: window.id,
        sessionId: session.id,
        windowLabel: session.windowLabel,
        workspaceLabel: session.workspaceLabel,
        focused: window.isFocused(),
        hidden: window.isVisible() === false,
      };
    },
    reopenSession,
    revealItemInDir(path) {
      shell.showItemInFolder(path);
      return true;
    },
    setTrayEnabled(enabled) {
      desktopShellState.setTrayEnabled(enabled === true);
      persistDesktopState();
      updateTray();
      return getTrayState();
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
    openWindow();
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
      createBrowserWindowForSession(session);
    }
  } else {
    openWindow();
  }
  updateTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const latestSession = desktopShellState.recentSessions[0];
      if (latestSession) {
        createBrowserWindowForSession(latestSession);
      } else {
        openWindow();
      }
    }
  });
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && !desktopShellState.trayEnabled) {
    app.quit();
  }
});
