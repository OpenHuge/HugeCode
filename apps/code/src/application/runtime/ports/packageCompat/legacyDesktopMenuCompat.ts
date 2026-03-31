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
  items: Array<Menu | MenuItem | PredefinedMenuItem>;
};

export class MenuItem {
  readonly action?: MenuAction;
  readonly enabled: boolean;
  readonly text: string;

  constructor(options: MenuItemOptions) {
    this.action = options.action;
    this.enabled = options.enabled !== false;
    this.text = options.text;
  }

  static async new(options: MenuItemOptions) {
    return new MenuItem(options);
  }
}

export class PredefinedMenuItem {
  readonly enabled = false;
  readonly item: string;
  readonly text: string;

  constructor(options: PredefinedMenuItemOptions) {
    this.item = options.item;
    this.text = options.item;
  }

  static async new(options: PredefinedMenuItemOptions) {
    return new PredefinedMenuItem(options);
  }
}

export class Menu {
  readonly items: Array<Menu | MenuItem | PredefinedMenuItem>;

  constructor(options: MenuOptions) {
    this.items = options.items;
  }

  static async new(options: MenuOptions) {
    return new Menu(options);
  }

  async popup(_position?: unknown, _window?: unknown) {}
}
