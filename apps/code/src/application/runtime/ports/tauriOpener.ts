import { toSafeExternalUrl } from "@ku0/shared";
import { openUrl as openTauriUrl, revealItemInDir } from "@tauri-apps/plugin-opener";

export { revealItemInDir };

export async function openUrl(url: string) {
  const safeUrl = toSafeExternalUrl(url);
  if (!safeUrl) {
    throw new Error("Blocked unsafe external URL.");
  }

  await openTauriUrl(safeUrl);
}
