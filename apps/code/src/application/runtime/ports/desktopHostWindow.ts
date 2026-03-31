import { getDesktopHostBridge } from "./desktopHostBridge";

type WindowEffectInput = {
  effects?: string[];
  radius?: number;
  state?: string;
};

type WindowListener = (payload: unknown) => void;

export const Effect = {
  HudWindow: "hudWindow",
} as const;

export const EffectState = {
  Active: "active",
} as const;

type CompatWindowHandle = {
  listen: (_eventName: string, _listener: WindowListener) => Promise<() => void>;
  onDragDropEvent: (_listener: WindowListener) => Promise<() => void>;
  startDragging: () => Promise<void>;
  setEffects: (_input: WindowEffectInput) => Promise<void>;
};

const emptyUnlisten = () => undefined;

const compatWindowHandle: CompatWindowHandle = {
  async listen() {
    return emptyUnlisten;
  },
  async onDragDropEvent() {
    return emptyUnlisten;
  },
  async startDragging() {},
  async setEffects() {},
};

export function getCurrentWindow(): CompatWindowHandle {
  void getDesktopHostBridge();
  return compatWindowHandle;
}
