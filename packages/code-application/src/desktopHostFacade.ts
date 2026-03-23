import type {
  DesktopHostBridge,
  DesktopNotificationInput,
  DesktopRuntimeHost,
  DesktopSessionInfo,
} from "@ku0/code-platform-interfaces";
import { toSafeExternalUrl } from "@ku0/shared";

export type DesktopRuntimeDetectionInput = {
  desktopHostBridge: DesktopHostBridge | null;
  tauriRuntimeAvailable: boolean;
};

export type DesktopWindowLabelFallbacks = {
  defaultLabel?: string;
  desktopHostBridge: DesktopHostBridge | null;
  getTauriWindowLabel?: () => Promise<string | null | undefined>;
};

export type DesktopVersionFallbacks = {
  desktopHostBridge: DesktopHostBridge | null;
  getTauriAppVersion?: () => Promise<string | null | undefined>;
};

export type DesktopNotificationFallbacks = {
  desktopHostBridge: DesktopHostBridge | null;
};

export type DesktopExternalUrlFallbacks = {
  desktopHostBridge: DesktopHostBridge | null;
  openBrowserUrl?: (url: string) => boolean;
  openTauriUrl?: (url: string) => Promise<boolean>;
};

export type DesktopItemRevealFallbacks = {
  desktopHostBridge: DesktopHostBridge | null;
  revealTauriItem?: (path: string) => Promise<boolean>;
};

export function detectDesktopRuntimeHost(input: DesktopRuntimeDetectionInput): DesktopRuntimeHost {
  if (input.desktopHostBridge) {
    return input.desktopHostBridge.kind;
  }

  return input.tauriRuntimeAvailable ? "tauri" : "browser";
}

export async function resolveDesktopWindowLabel(
  input: DesktopWindowLabelFallbacks
): Promise<string> {
  const defaultLabel = input.defaultLabel ?? "main";

  try {
    const label = await input.desktopHostBridge?.window?.getLabel?.();
    if (typeof label === "string" && label.length > 0) {
      return label;
    }
  } catch {
    // Fall through to the Tauri loader and then the default value.
  }

  try {
    const tauriLabel = await input.getTauriWindowLabel?.();
    if (typeof tauriLabel === "string" && tauriLabel.length > 0) {
      return tauriLabel;
    }
  } catch {
    // Fall through to the default value.
  }

  return defaultLabel;
}

export async function resolveDesktopAppVersion(
  input: DesktopVersionFallbacks
): Promise<string | null> {
  try {
    const version = await input.desktopHostBridge?.app?.getVersion?.();
    if (typeof version === "string" && version.length > 0) {
      return version;
    }
  } catch {
    // Fall through to the Tauri loader and then the null fallback.
  }

  try {
    const tauriVersion = await input.getTauriAppVersion?.();
    if (typeof tauriVersion === "string" && tauriVersion.length > 0) {
      return tauriVersion;
    }
  } catch {
    // Fall through to null.
  }

  return null;
}

export async function resolveDesktopSessionInfo(
  desktopHostBridge: DesktopHostBridge | null
): Promise<DesktopSessionInfo | null> {
  try {
    const session = await desktopHostBridge?.session?.getCurrentSession?.();
    if (session && typeof session.id === "string" && session.id.length > 0) {
      return session;
    }
  } catch {
    // Desktop session lookup is optional.
  }

  return null;
}

export async function showDesktopNotification(
  input: DesktopNotificationFallbacks,
  notification: DesktopNotificationInput
): Promise<boolean> {
  try {
    const showResult = await input.desktopHostBridge?.notifications?.show?.(notification);
    if (input.desktopHostBridge?.notifications?.show) {
      return showResult !== false;
    }
  } catch {
    // Notification support is optional.
  }

  return false;
}

export async function openDesktopExternalUrl(
  input: DesktopExternalUrlFallbacks,
  url: string
): Promise<boolean> {
  const safeUrl = toSafeExternalUrl(url);
  if (!safeUrl) {
    return false;
  }

  try {
    const openResult = await input.desktopHostBridge?.shell?.openExternalUrl?.(safeUrl);
    if (input.desktopHostBridge?.shell?.openExternalUrl) {
      return openResult !== false;
    }
  } catch {
    // Fall through to Tauri and browser fallbacks.
  }

  try {
    const tauriOpened = await input.openTauriUrl?.(safeUrl);
    if (tauriOpened) {
      return true;
    }
  } catch {
    // Fall through to browser fallback.
  }

  return input.openBrowserUrl?.(safeUrl) === true;
}

export async function revealDesktopItemInDir(
  input: DesktopItemRevealFallbacks,
  path: string
): Promise<boolean> {
  try {
    const revealResult = await input.desktopHostBridge?.shell?.revealItemInDir?.(path);
    if (input.desktopHostBridge?.shell?.revealItemInDir) {
      return revealResult !== false;
    }
  } catch {
    // Fall through to Tauri fallback.
  }

  try {
    return (await input.revealTauriItem?.(path)) === true;
  } catch {
    return false;
  }
}
