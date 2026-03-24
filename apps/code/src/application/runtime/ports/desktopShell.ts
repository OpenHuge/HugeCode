import { getDesktopHostBridge } from "./desktopHostBridge";

export async function openDesktopExternalUrl(url: string) {
  const bridge = getDesktopHostBridge();
  try {
    const opened = await bridge?.shell?.openExternalUrl?.(url);
    return opened === true;
  } catch {
    return false;
  }
}
