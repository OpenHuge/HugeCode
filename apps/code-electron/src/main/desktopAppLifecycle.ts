import type { DesktopSessionDescriptor } from "./desktopShellState.js";
import type { OpenDesktopWindowInput } from "../shared/ipc.js";

type BrowserWindowLike = {
  focus(): void;
  isMinimized(): boolean;
  restore(): void;
  show(): void;
};

type BrowserWindowFacade = {
  getAllWindows(): BrowserWindowLike[];
};

type ElectronAppLike = {
  on(event: "activate", listener: () => void): void;
  on(event: "before-quit", listener: () => void): void;
  on(event: "open-file", listener: (event: { preventDefault(): void }, path: string) => void): void;
  on(event: "second-instance", listener: (_event: unknown, argv: string[]) => void): void;
  on(event: "window-all-closed", listener: () => void): void;
  quit(): void;
  requestSingleInstanceLock(): boolean;
  whenReady(): Promise<unknown>;
};

export type RegisterDesktopAppLifecycleInput = {
  app: ElectronAppLike;
  browserWindow: BrowserWindowFacade;
  createWindowForSession(session: DesktopSessionDescriptor): unknown;
  getInitialOpenWindowInput?(): OpenDesktopWindowInput | null;
  getLatestSession(): DesktopSessionDescriptor | null;
  getPersistedSessions(): DesktopSessionDescriptor[];
  isTrayEnabled(): boolean;
  onReady?(): Promise<void> | void;
  onBeforeQuit(): void;
  onSecondInstance?(argv: string[]): OpenDesktopWindowInput | null | void;
  openWindow(input?: OpenDesktopWindowInput): unknown;
  platform?: NodeJS.Platform;
  updateTray(): void;
};

export function registerDesktopAppLifecycle(input: RegisterDesktopAppLifecycleInput) {
  const platform =
    input.platform ?? (input.app as { platform?: NodeJS.Platform }).platform ?? process.platform;
  const hasSingleInstanceLock = input.app.requestSingleInstanceLock();
  if (!hasSingleInstanceLock) {
    input.app.quit();
    return false;
  }

  input.app.on("second-instance", (_event, argv) => {
    const requestedWindowInput = input.onSecondInstance?.(argv);
    if (requestedWindowInput) {
      input.openWindow(requestedWindowInput);
      return;
    }

    const nextWindow = input.browserWindow.getAllWindows()[0];
    if (!nextWindow) {
      input.openWindow();
      return;
    }

    if (nextWindow.isMinimized()) {
      nextWindow.restore();
    }
    nextWindow.show();
    nextWindow.focus();
  });

  void input.app.whenReady().then(async () => {
    await input.onReady?.();

    const persistedSessions = input.getPersistedSessions();
    const initialOpenWindowInput = input.getInitialOpenWindowInput?.() ?? null;
    if (persistedSessions.length > 0) {
      for (const session of persistedSessions) {
        input.createWindowForSession(session);
      }
      if (initialOpenWindowInput) {
        input.openWindow(initialOpenWindowInput);
      }
    } else {
      input.openWindow(initialOpenWindowInput ?? undefined);
    }
    input.updateTray();

    input.app.on("activate", () => {
      if (input.browserWindow.getAllWindows().length > 0) {
        return;
      }

      const latestSession = input.getLatestSession();
      if (latestSession) {
        input.createWindowForSession(latestSession);
      } else {
        input.openWindow();
      }
    });
  });

  input.app.on("before-quit", () => {
    input.onBeforeQuit();
  });

  input.app.on("window-all-closed", () => {
    if (platform !== "darwin" && !input.isTrayEnabled()) {
      input.app.quit();
    }
  });

  return true;
}
