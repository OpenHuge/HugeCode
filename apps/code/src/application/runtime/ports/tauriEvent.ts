import { listen as tauriListen } from "@tauri-apps/api/event";

export type UnlistenFn = () => void;

export function listen<T>(
  eventName: string,
  listener: (event: { payload: T }) => void
): Promise<UnlistenFn> {
  return tauriListen<T>(eventName, listener);
}
