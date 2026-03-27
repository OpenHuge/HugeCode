type InvokePayload = Record<string, unknown> | undefined;

type CompatInvokeFunction = <Result>(
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
  };
}

function resolveCompatInvoke(): CompatInvokeFunction | null {
  const compatWindow = getCompatWindow();
  if (!compatWindow) {
    return null;
  }

  if (isRecord(compatWindow.__TAURI_INTERNALS__)) {
    const invoke = compatWindow.__TAURI_INTERNALS__.invoke;
    if (typeof invoke === "function") {
      return invoke as CompatInvokeFunction;
    }
  }

  if (isRecord(compatWindow.__TAURI__)) {
    const core = compatWindow.__TAURI__.core;
    if (isRecord(core) && typeof core.invoke === "function") {
      return core.invoke as CompatInvokeFunction;
    }
  }

  return null;
}

export function isTauri() {
  return resolveCompatInvoke() !== null;
}

export async function invoke<Result>(command: string, payload?: InvokePayload): Promise<Result> {
  const invokeCompat = resolveCompatInvoke();
  if (!invokeCompat) {
    throw new TypeError("Cannot read properties of undefined (reading 'invoke')");
  }

  if (payload === undefined) {
    return await invokeCompat<Result>(command);
  }

  return await invokeCompat<Result>(command, payload);
}
