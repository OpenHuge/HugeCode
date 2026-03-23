import { toSafeExternalUrl } from "@ku0/shared";
import { openUrl as openTauriPluginUrl, revealItemInDir } from "@tauri-apps/plugin-opener";

type TauriOpenerLoader = () => Promise<TauriOpenerModule>;

export async function revealTauriItemInDir(path: string) {
  await revealItemInDir(path);
  return true;
}

export async function openTauriUrl(url: string) {
  const safeUrl = toSafeExternalUrl(url);
  if (!safeUrl) {
    return false;
  }

  await openTauriPluginUrl(safeUrl);
  return true;
}

export async function openUrl(url: string) {
  const safeUrl = toSafeExternalUrl(url);
  if (!safeUrl) {
    throw new Error("Blocked unsafe external URL.");
  }

  await openTauriPluginUrl(safeUrl);
  return true;
}
