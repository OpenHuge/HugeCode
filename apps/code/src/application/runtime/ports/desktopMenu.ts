import * as tauriMenu from "@tauri-apps/api/menu";
import { getDesktopHostBridge } from "./desktopHostBridge";

export { setMenuAccelerators } from "../../../services/desktopHostCommands";

type MenuAction = () => void | Promise<void>;

type MenuItemOptions = {
  action?: MenuAction;
  enabled?: boolean;
  text: string;
};

type PredefinedMenuItemOptions = {
  item: string;
};

type MenuOptions = {
  items: Array<MenuInstance | MenuItemInstance | PredefinedMenuItemInstance>;
};

type MenuItemInstance = {
  action?: MenuAction;
  enabled: boolean;
  text: string;
};

type PredefinedMenuItemInstance = {
  enabled: boolean;
  item: string;
  text: string;
};

type MenuInstance = {
  items: Array<MenuInstance | MenuItemInstance | PredefinedMenuItemInstance>;
  popup: (_position?: unknown, _window?: unknown) => Promise<void>;
};

function shouldUseCompatibilityMenu() {
  return getDesktopHostBridge()?.kind === "electron";
}

export class MenuItem implements MenuItemInstance {
  readonly action?: MenuAction;
  readonly enabled: boolean;
  readonly text: string;

  constructor(options: MenuItemOptions) {
    this.action = options.action;
    this.enabled = options.enabled !== false;
    this.text = options.text;
  }

  static async new(options: MenuItemOptions): Promise<MenuItemInstance> {
    if (!shouldUseCompatibilityMenu() && typeof tauriMenu.MenuItem?.new === "function") {
      return tauriMenu.MenuItem.new(options);
    }

    return new MenuItem(options);
  }
}

export class PredefinedMenuItem implements PredefinedMenuItemInstance {
  readonly enabled = false;
  readonly item: string;
  readonly text: string;

  constructor(options: PredefinedMenuItemOptions) {
    this.item = options.item;
    this.text = options.item;
  }

  static async new(options: PredefinedMenuItemOptions): Promise<PredefinedMenuItemInstance> {
    if (!shouldUseCompatibilityMenu() && typeof tauriMenu.PredefinedMenuItem?.new === "function") {
      return tauriMenu.PredefinedMenuItem.new(options);
    }

    return new PredefinedMenuItem(options);
  }
}

export class Menu implements MenuInstance {
  readonly items: Array<MenuInstance | MenuItemInstance | PredefinedMenuItemInstance>;

  constructor(options: MenuOptions) {
    this.items = options.items;
  }

  static async new(options: MenuOptions): Promise<MenuInstance> {
    if (!shouldUseCompatibilityMenu() && typeof tauriMenu.Menu?.new === "function") {
      return tauriMenu.Menu.new(options);
    }

    return new Menu(options);
  }

  async popup(_position?: unknown, _window?: unknown) {}
}
