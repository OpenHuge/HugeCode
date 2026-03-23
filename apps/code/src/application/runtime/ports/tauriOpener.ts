import { toSafeExternalUrl } from "@ku0/shared";
import type { DesktopShellCapability } from "@ku0/code-platform-interfaces";
import { getDesktopHostBridge } from "./desktopHostBridge";

type TauriOpenerModule = {
  openUrl: (url: string) => Promise<void>;
  revealItemInDir: (path: string) => Promise<void>;
};

type TauriOpenerLoader = () => Promise<TauriOpenerModule>;

async function defaultTauriOpenerLoader(): Promise<TauriOpenerModule> {
  return import("@tauri-apps/plugin-opener");
}

let cachedTauriOpenerPromise: Promise<TauriOpenerModule | null> | null = null;
let tauriOpenerLoader: TauriOpenerLoader = defaultTauriOpenerLoader;

async function loadTauriOpener() {
  if (cachedTauriOpenerPromise) {
    return cachedTauriOpenerPromise;
  }

  cachedTauriOpenerPromise = tauriOpenerLoader().catch(() => null);
  return cachedTauriOpenerPromise;
}

function resolveDesktopShellCapability(): DesktopShellCapability | null {
  return getDesktopHostBridge()?.shell ?? null;
}

export async function openUrl(url: string) {
  const safeUrl = toSafeExternalUrl(url);
  if (!safeUrl) {
    throw new Error("Blocked unsafe external URL.");
  }

  try {
    const desktopShell = resolveDesktopShellCapability();
    const openResult = await desktopShell?.openExternalUrl?.(safeUrl);
    if (desktopShell?.openExternalUrl && openResult !== false) {
      return;
    }
  } catch {
    // Fall through to the Tauri loader and browser fallback.
  }

  const opener = await loadTauriOpener();
  if (opener?.openUrl) {
    await opener.openUrl(safeUrl);
    return;
  }

  if (typeof window !== "undefined" && typeof window.open === "function") {
    const popup = window.open(safeUrl, "_blank", "noopener,noreferrer");
    if (popup !== null) {
      return;
    }
  }

  throw new Error("Desktop external-url opener unavailable.");
}

export async function revealItemInDir(path: string) {
  try {
    const desktopShell = resolveDesktopShellCapability();
    const revealResult = await desktopShell?.revealItemInDir?.(path);
    if (desktopShell?.revealItemInDir && revealResult !== false) {
      return;
    }
  } catch {
    // Fall through to the Tauri loader.
  }

  const opener = await loadTauriOpener();
  if (opener?.revealItemInDir) {
    await opener.revealItemInDir(path);
    return;
  }

  throw new Error("Desktop reveal-in-directory bridge unavailable.");
}

export function __setTauriOpenerLoaderForTests(loader: TauriOpenerLoader) {
  tauriOpenerLoader = loader;
  cachedTauriOpenerPromise = null;
}

export function __resetTauriOpenerForTests() {
  tauriOpenerLoader = defaultTauriOpenerLoader;
  cachedTauriOpenerPromise = null;
}
