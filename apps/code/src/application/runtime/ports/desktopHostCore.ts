type InvokePayload = Record<string, unknown> | undefined;

type DesktopHostInvokeFunction = <Result>(
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
    __HUGE_CODE_DESKTOP_HOST__?: unknown;
    __HUGE_CODE_DESKTOP_HOST_INTERNALS__?: unknown;
    __HUGE_CODE_DESKTOP_HOST_IPC__?: unknown;
    hugeCodeDesktopHost?: { kind?: unknown };
  };
}

function resolveLegacyDesktopInvoke(): DesktopHostInvokeFunction | null {
  const compatWindow = getCompatWindow();
  if (!compatWindow) {
    return null;
  }

  if (isRecord(compatWindow.__HUGE_CODE_DESKTOP_HOST_INTERNALS__)) {
    const invoke = compatWindow.__HUGE_CODE_DESKTOP_HOST_INTERNALS__.invoke;
    if (typeof invoke === "function") {
      return invoke as DesktopHostInvokeFunction;
    }
  }

  if (isRecord(compatWindow.__HUGE_CODE_DESKTOP_HOST__)) {
    const core = compatWindow.__HUGE_CODE_DESKTOP_HOST__.core;
    if (isRecord(core) && typeof core.invoke === "function") {
      return core.invoke as DesktopHostInvokeFunction;
    }
  }

  return null;
}

function hasElectronDesktopHostBridge(): boolean {
  const compatWindow = getCompatWindow();
  return compatWindow?.hugeCodeDesktopHost?.kind === "electron";
}

async function invokeWithOptionalPayload<Result>(
  invokeFn: DesktopHostInvokeFunction,
  command: string,
  payload?: InvokePayload
): Promise<Result> {
  if (payload === undefined) {
    return await invokeFn<Result>(command);
  }
  return await invokeFn<Result>(command, payload);
}

export class DesktopCommandUnavailableError extends Error {
  constructor(command: string) {
    super(`Desktop command "${command}" is unavailable in the Electron renderer.`);
    this.name = "DesktopCommandUnavailableError";
  }
}

export function isDesktopHostRuntime() {
  return hasElectronDesktopHostBridge() || resolveLegacyDesktopInvoke() !== null;
}

export async function invokeDesktopCommand<Result>(
  command: string,
  payload?: InvokePayload
): Promise<Result> {
  const invokeCompat = resolveLegacyDesktopInvoke();
  if (invokeCompat) {
    return await invokeWithOptionalPayload<Result>(invokeCompat, command, payload);
  }

  throw new DesktopCommandUnavailableError(command);
}

export const invoke = invokeDesktopCommand;
