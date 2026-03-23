import { BrowserWindow } from "electron";
import type { BrowserWindowConstructorOptions } from "electron";
import type { OpenDesktopWindowInput } from "../shared/ipc.js";
import {
  createDesktopShellState,
  resolveCloseBehavior,
  type DesktopSessionDescriptor,
  type DesktopWindowBounds,
  type DesktopWindowDescriptor,
} from "./desktopShellState.js";

type WindowOpenHandlerResult = {
  action: "deny";
};

type BrowserWindowLike = {
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
    on(
      event: "will-navigate",
      listener: (event: { preventDefault(): void }, url: string) => void
    ): void;
    setWindowOpenHandler(handler: (details: { url: string }) => WindowOpenHandlerResult): void;
  };
};

type BrowserWindowFacade = {
  create(options: BrowserWindowConstructorOptions): BrowserWindowLike;
  fromWebContents(webContents: unknown): BrowserWindowLike | null;
  getAllWindows(): BrowserWindowLike[];
};

type DesktopShellStateLike = Pick<
  ReturnType<typeof createDesktopShellState>,
  | "attachWindow"
  | "detachWindow"
  | "getSessionById"
  | "getSessionByWindowId"
  | "listWindows"
  | "resolveSession"
  | "trayEnabled"
>;

export type CreateDesktopWindowControllerInput = {
  browserWindow?: BrowserWindowFacade;
  defaultWindowBounds: DesktopWindowBounds;
  isSafeExternalUrl(url: string): boolean;
  isQuitting(): boolean;
  isTrustedRendererUrl(url: string): boolean;
  loadRenderer(window: BrowserWindowLike): void;
  notifyWindowsChanged(): void;
  openExternalUrl(url: string): Promise<void> | void;
  persistState(): void;
  preloadPath: string;
  shellState: DesktopShellStateLike;
};

export type DesktopWindowController = {
  closeWindow(windowId: number): boolean;
  createWindowForSession(session: DesktopSessionDescriptor): DesktopWindowDescriptor | null;
  focusWindow(windowId: number): boolean;
  hasWindowForWebContents(webContents: unknown): boolean;
  getSessionForWebContents(webContents: unknown): DesktopSessionDescriptor | null;
  getWindowLabelForWebContents(webContents: unknown): DesktopSessionDescriptor["windowLabel"];
  listWindows(): DesktopWindowDescriptor[];
  openWindow(input?: OpenDesktopWindowInput): DesktopWindowDescriptor | null;
  reopenSession(sessionId: string): boolean;
  restoreVisibleWindow(): boolean;
};

function getWindowTitle(session: DesktopSessionDescriptor) {
  if (session.windowLabel === "about") {
    return "HugeCode About";
  }

  if (session.workspaceLabel) {
    return `HugeCode - ${session.workspaceLabel}`;
  }

  return "HugeCode";
}

export function createDesktopWindowController(
  input: CreateDesktopWindowControllerInput
): DesktopWindowController {
  const browserWindow = input.browserWindow ?? {
    create(options) {
      return new BrowserWindow(options);
    },
    fromWebContents(webContents) {
      return BrowserWindow.fromWebContents(webContents as Electron.WebContents);
    },
    getAllWindows() {
      return BrowserWindow.getAllWindows();
    },
  };
  const activeWindows = new Map<number, BrowserWindowLike>();

  function notifyWindowsChanged() {
    input.notifyWindowsChanged();
  }

  function describeWindow(windowId: number): DesktopWindowDescriptor | null {
    const windowDescriptor = input.shellState
      .listWindows()
      .find((item) => item.windowId === windowId);
    if (!windowDescriptor) {
      return null;
    }

    const targetWindow = activeWindows.get(windowId);
    return {
      ...windowDescriptor,
      focused: targetWindow?.isFocused() ?? false,
      hidden: targetWindow?.isVisible() === false,
    };
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
      const session = input.shellState.getSessionByWindowId(windowId);
      if (session?.id === sessionId) {
        return activeWindows.get(windowId) ?? null;
      }
    }

    return null;
  }

  function createWindowForSession(session: DesktopSessionDescriptor) {
    const windowState = session.windowBounds ?? input.defaultWindowBounds;
    const nextWindow = browserWindow.create({
      width: windowState.width,
      height: windowState.height,
      x: windowState.x,
      y: windowState.y,
      show: false,
      title: getWindowTitle(session),
      backgroundColor: "#0f1115",
      webPreferences: {
        preload: input.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    nextWindow.once("ready-to-show", () => {
      nextWindow.show();
    });

    nextWindow.on("focus", () => {
      const activeSession = input.shellState.getSessionByWindowId(nextWindow.id);
      if (!activeSession) {
        return;
      }

      input.shellState.attachWindow(activeSession, nextWindow.id);
      input.persistState();
      notifyWindowsChanged();
    });

    nextWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (input.isSafeExternalUrl(url) && !input.isTrustedRendererUrl(url)) {
        void input.openExternalUrl(url);
      }
      return { action: "deny" };
    });

    nextWindow.webContents.on("will-navigate", (event, url) => {
      if (input.isTrustedRendererUrl(url)) {
        return;
      }

      event.preventDefault();
      if (input.isSafeExternalUrl(url)) {
        void input.openExternalUrl(url);
      }
    });

    input.loadRenderer(nextWindow);

    nextWindow.on("close", (event) => {
      if (!input.isQuitting() && resolveCloseBehavior(input.shellState, nextWindow.id) === "hide") {
        event.preventDefault();
        nextWindow.hide();
        notifyWindowsChanged();
        return;
      }

      input.shellState.detachWindow(nextWindow.id, nextWindow.getBounds());
      input.persistState();
      activeWindows.delete(nextWindow.id);
      notifyWindowsChanged();
    });

    nextWindow.on("closed", () => {
      activeWindows.delete(nextWindow.id);
      notifyWindowsChanged();
    });

    input.shellState.attachWindow(session, nextWindow.id);
    activeWindows.set(nextWindow.id, nextWindow);
    input.persistState();
    notifyWindowsChanged();

    return describeWindow(nextWindow.id);
  }

  function getSessionForWebContents(webContents: unknown) {
    const sourceWindow = browserWindow.fromWebContents(webContents);
    if (!sourceWindow) {
      return null;
    }

    return input.shellState.getSessionByWindowId(sourceWindow.id);
  }

  function hasWindowForWebContents(webContents: unknown) {
    return browserWindow.fromWebContents(webContents) !== null;
  }

  return {
    closeWindow(windowId) {
      const targetWindow = activeWindows.get(windowId);
      if (!targetWindow || targetWindow.isDestroyed()) {
        return false;
      }

      targetWindow.close();
      return true;
    },
    createWindowForSession,
    focusWindow,
    hasWindowForWebContents,
    getSessionForWebContents,
    getWindowLabelForWebContents(webContents) {
      return getSessionForWebContents(webContents)?.windowLabel ?? "main";
    },
    listWindows() {
      return input.shellState.listWindows().map((windowDescriptor) => ({
        ...windowDescriptor,
        focused: activeWindows.get(windowDescriptor.windowId)?.isFocused() ?? false,
        hidden: activeWindows.get(windowDescriptor.windowId)?.isVisible() === false,
      }));
    },
    openWindow(openWindowInput = {}) {
      const session = input.shellState.resolveSession(openWindowInput);
      const existingWindow = findWindowBySessionId(session.id);
      if (existingWindow) {
        focusWindow(existingWindow.id);
        return describeWindow(existingWindow.id);
      }

      return createWindowForSession(session);
    },
    reopenSession(sessionId) {
      const session = input.shellState.getSessionById(sessionId);
      if (!session) {
        return false;
      }

      const existingWindow = findWindowBySessionId(session.id);
      if (existingWindow) {
        return focusWindow(existingWindow.id);
      }

      createWindowForSession(session);
      return true;
    },
    restoreVisibleWindow() {
      const visibleWindow = browserWindow.getAllWindows().find((window) => !window.isDestroyed());
      if (!visibleWindow) {
        return false;
      }

      if (visibleWindow.isMinimized()) {
        visibleWindow.restore();
      }
      visibleWindow.show();
      visibleWindow.focus();
      return true;
    },
  };
}
