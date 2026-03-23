import type { DesktopTrayState } from "@ku0/code-platform-interfaces";
import { Menu, Tray, nativeImage } from "electron";
import type { MenuItemConstructorOptions, NativeImage } from "electron";
import type { DesktopSessionDescriptor, DesktopWindowDescriptor } from "./desktopShellState.js";
import { buildTrayMenuTemplate, getTrayMenuStateSignature } from "./trayMenu.js";

type TrayStateSnapshot = {
  recentSessions: DesktopSessionDescriptor[];
  trayEnabled: boolean;
  windows: DesktopWindowDescriptor[];
};

type MenuLike = object;

type TrayLike = {
  destroy(): void;
  on(event: "double-click", listener: () => void): void;
  setContextMenu(menu: MenuLike | null): void;
  setToolTip(toolTip: string): void;
};

type DesktopTrayControllerDependencies = {
  createImageFromDataUrl?: (
    dataUrl: string
  ) => NativeImage | { setTemplateImage?: (flag: boolean) => void };
  createMenuFromTemplate?: (template: MenuItemConstructorOptions[]) => MenuLike;
  createTray?: (image: NativeImage | { setTemplateImage?: (flag: boolean) => void }) => TrayLike;
};

export type CreateDesktopTrayControllerInput = {
  dependencies?: DesktopTrayControllerDependencies;
  isSupported: boolean;
  onFocusWindow(windowId: number): void;
  onNewWindow(): void;
  onQuit(): void;
  onReopenSession(sessionId: string): void;
  onSetTrayEnabled(enabled: boolean): void;
  platform: NodeJS.Platform;
  readState(): TrayStateSnapshot;
  restoreVisibleWindow(): boolean;
  trayIconDataUrl: string;
};

export type DesktopTrayController = {
  dispose(): void;
  getState(): DesktopTrayState;
  update(): void;
};

export function createDesktopTrayController(
  input: CreateDesktopTrayControllerInput
): DesktopTrayController {
  const createImageFromDataUrl =
    input.dependencies?.createImageFromDataUrl ?? nativeImage.createFromDataURL;
  const createMenuFromTemplate =
    input.dependencies?.createMenuFromTemplate ?? ((template) => Menu.buildFromTemplate(template));
  const createTray = input.dependencies?.createTray ?? ((image) => new Tray(image as NativeImage));

  let tray: TrayLike | null = null;
  let trayMenu: MenuLike | null = null;
  let trayMenuSignature: string | null = null;

  function getState(): DesktopTrayState {
    const state = input.readState();
    return {
      enabled: input.isSupported && state.trayEnabled,
      supported: input.isSupported,
    };
  }

  function destroyTray() {
    tray?.setContextMenu(null);
    tray?.destroy();
    tray = null;
    trayMenu = null;
    trayMenuSignature = null;
  }

  function ensureTray() {
    if (tray) {
      return tray;
    }

    const image = createImageFromDataUrl(input.trayIconDataUrl);
    if (input.platform === "darwin" && "setTemplateImage" in image) {
      image.setTemplateImage?.(true);
    }

    const nextTray = createTray(image);
    nextTray.setToolTip("HugeCode");
    nextTray.on("double-click", () => {
      if (!input.restoreVisibleWindow()) {
        input.onNewWindow();
      }
    });

    tray = nextTray;
    return nextTray;
  }

  function update() {
    if (!input.isSupported) {
      return;
    }

    const state = input.readState();
    if (!state.trayEnabled) {
      destroyTray();
      return;
    }

    const nextTray = ensureTray();
    const nextTrayMenuSignature = getTrayMenuStateSignature(state);
    if (trayMenuSignature === nextTrayMenuSignature && trayMenu) {
      return;
    }

    trayMenu = createMenuFromTemplate(
      buildTrayMenuTemplate(state, {
        onFocusWindow: input.onFocusWindow,
        onNewWindow: input.onNewWindow,
        onQuit: input.onQuit,
        onReopenSession: input.onReopenSession,
        onToggleTray: (enabled) => {
          input.onSetTrayEnabled(enabled);
          update();
        },
      })
    );
    trayMenuSignature = nextTrayMenuSignature;
    nextTray.setContextMenu(trayMenu);
  }

  return {
    dispose() {
      destroyTray();
    },
    getState,
    update,
  };
}
