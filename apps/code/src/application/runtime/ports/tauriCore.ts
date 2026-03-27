type InvokePayload = Record<string, unknown> | undefined;

type TauriInvokeFunction = <Result>(
  command: string,
  payload?: InvokePayload
) => Promise<Result> | Result;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getCompatWindow() {
  if (typeof window === "undefined") {
    return null;
  }

  return window as Window & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
    __TAURI_IPC__?: unknown;
    hugeCodeDesktopHost?: { kind?: unknown };
  };
}

function resolveLegacyTauriInvoke(): TauriInvokeFunction | null {
  const compatWindow = getCompatWindow();
  if (!compatWindow) {
    return null;
  }

  if (isRecord(compatWindow.__TAURI_INTERNALS__)) {
    const invoke = compatWindow.__TAURI_INTERNALS__.invoke;
    if (typeof invoke === "function") {
      return invoke as TauriInvokeFunction;
    }
  }

  if (isRecord(compatWindow.__TAURI__)) {
    const core = compatWindow.__TAURI__.core;
    if (isRecord(core) && typeof core.invoke === "function") {
      return core.invoke as TauriInvokeFunction;
    }
  }

  return null;
}

function hasElectronDesktopHostBridge(): boolean {
  const compatWindow = getCompatWindow();
  return compatWindow?.hugeCodeDesktopHost?.kind === "electron";
}

export class DesktopCommandUnavailableError extends Error {
  constructor(command: string) {
    super(`Desktop command "${command}" is unavailable in the Electron renderer.`);
    this.name = "DesktopCommandUnavailableError";
  }
}

export function isTauri() {
  return hasElectronDesktopHostBridge() || resolveLegacyTauriInvoke() !== null;
}

export async function invoke<Result>(command: string, payload?: InvokePayload): Promise<Result> {
  const invokeCompat = resolveLegacyTauriInvoke();
  if (invokeCompat) {
    return await invokeCompat<Result>(command, payload);
  }

  throw new DesktopCommandUnavailableError(command);
}
