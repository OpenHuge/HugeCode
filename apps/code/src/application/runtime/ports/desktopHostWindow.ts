import * as tauriWindow from "@tauri-apps/api/window";
import { getDesktopHostBridge } from "./desktopHostBridge";

type WindowEffectInput = {
  effects?: string[];
  radius?: number;
  state?: string;
};

type WindowListener = (payload: unknown) => void;

function readTauriWindowExport(key: "Effect" | "EffectState" | "getCurrentWindow") {
  try {
    return Object.prototype.hasOwnProperty.call(tauriWindow, key)
      ? Reflect.get(tauriWindow, key)
      : undefined;
  } catch {
    return undefined;
  }
}

export const Effect =
  readTauriWindowExport("Effect") ??
  ({
    HudWindow: "hudWindow",
  } as const);

export const EffectState =
  readTauriWindowExport("EffectState") ??
  ({
    Active: "active",
  } as const);

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
  if (getDesktopHostBridge()?.kind === "electron") {
    return compatWindowHandle;
  }

  try {
    const getCurrentWindowExport = readTauriWindowExport("getCurrentWindow");
    return typeof getCurrentWindowExport === "function"
      ? (getCurrentWindowExport() as CompatWindowHandle)
      : compatWindowHandle;
  } catch {
    return compatWindowHandle;
  }
}
