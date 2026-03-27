export type UnlistenFn = () => void;

type TauriEventListener = <TPayload>(
  eventName: string,
  listener: (event: { payload: TPayload }) => void
) => Promise<UnlistenFn>;

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

function resolveLegacyTauriEventListener(): TauriEventListener | null {
  const compatWindow = getCompatWindow();
  if (!compatWindow) {
    return null;
  }

  if (isRecord(compatWindow.__TAURI_INTERNALS__)) {
    const event = compatWindow.__TAURI_INTERNALS__.event;
    if (isRecord(event) && typeof event.listen === "function") {
      return event.listen as TauriEventListener;
    }
  }

  if (isRecord(compatWindow.__TAURI__)) {
    const event = compatWindow.__TAURI__.event;
    if (isRecord(event) && typeof event.listen === "function") {
      return event.listen as TauriEventListener;
    }
  }

  return null;
}

export function listen<T>(
  eventName: string,
  listener: (event: { payload: T }) => void
): Promise<UnlistenFn> {
  const tauriListen = resolveLegacyTauriEventListener();
  if (!tauriListen) {
    return Promise.reject(new Error(`Tauri event listener "${eventName}" is unavailable.`));
  }
  return tauriListen<T>(eventName, listener);
}
