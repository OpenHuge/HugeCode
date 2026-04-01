import { getDesktopHostBridge } from "./desktopHostBridge";

export type UnlistenFn = () => void;

export async function listen<T>(
  eventName: string,
  listener: (event: { payload: T }) => void
): Promise<UnlistenFn> {
  const desktopListen = getDesktopHostBridge()?.event?.listen;
  if (typeof desktopListen !== "function") {
    throw new Error(`Electron bridge event listener "${eventName}" is unavailable.`);
  }
  return (await desktopListen<T>(eventName, listener)) ?? (() => undefined);
}
