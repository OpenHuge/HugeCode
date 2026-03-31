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
    return new PredefinedMenuItem(options);
  }
}

export class Menu implements MenuInstance {
  readonly items: Array<MenuInstance | MenuItemInstance | PredefinedMenuItemInstance>;

  constructor(options: MenuOptions) {
    this.items = options.items;
  }

  static async new(options: MenuOptions): Promise<MenuInstance> {
    return new Menu(options);
  }

  async popup(_position?: unknown, _window?: unknown) {}
}
