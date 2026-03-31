import * as legacyDesktopCore from "./packageCompat/legacyDesktopCoreCompat";

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
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
    __TAURI_IPC__?: unknown;
    hugeCodeDesktopHost?: { kind?: unknown };
  };
}

function resolveLegacyDesktopInvoke(): DesktopHostInvokeFunction | null {
  const compatWindow = getCompatWindow();
  if (!compatWindow) {
    return null;
  }

  if (isRecord(compatWindow.__TAURI_INTERNALS__)) {
    const invoke = compatWindow.__TAURI_INTERNALS__.invoke;
    if (typeof invoke === "function") {
      return invoke as DesktopHostInvokeFunction;
    }
  }

  if (isRecord(compatWindow.__TAURI__)) {
    const core = compatWindow.__TAURI__.core;
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

function isLegacyDesktopCompatibilityRuntime(): boolean {
  try {
    return (
      typeof legacyDesktopCore.isLegacyDesktopCompatActive === "function" &&
      legacyDesktopCore.isLegacyDesktopCompatActive() === true
    );
  } catch {
    return false;
  }
}

function resolveLegacyDesktopCompatInvoke(): DesktopHostInvokeFunction | null {
  return typeof legacyDesktopCore.invokeLegacyDesktopCompat === "function"
    ? (legacyDesktopCore.invokeLegacyDesktopCompat as DesktopHostInvokeFunction)
    : null;
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
  return (
    hasElectronDesktopHostBridge() ||
    resolveLegacyDesktopInvoke() !== null ||
    isLegacyDesktopCompatibilityRuntime()
  );
}

export const isTauri = isDesktopHostRuntime;

export async function invokeDesktopCommand<Result>(
  command: string,
  payload?: InvokePayload
): Promise<Result> {
  const invokeCompat = resolveLegacyDesktopInvoke();
  if (invokeCompat) {
    return await invokeWithOptionalPayload<Result>(invokeCompat, command, payload);
  }

  if (!hasElectronDesktopHostBridge()) {
    const invokeLegacyCompat = resolveLegacyDesktopCompatInvoke();
    if (invokeLegacyCompat) {
      return await invokeWithOptionalPayload<Result>(invokeLegacyCompat, command, payload);
    }
  }

  throw new DesktopCommandUnavailableError(command);
}

export const invoke = invokeDesktopCommand;
