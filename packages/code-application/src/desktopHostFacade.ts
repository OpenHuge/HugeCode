import type {
  DesktopAppInfo,
  DesktopDiagnosticsInfo,
  DesktopHostBridge,
  DesktopLaunchIntent,
  DesktopNotificationInput,
  DesktopRuntimeHost,
  DesktopSessionInfo,
  DesktopUpdateState,
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

const DEFAULT_UNSUPPORTED_UPDATE_STATE: DesktopUpdateState = {
  capability: "unsupported",
  message: "Automatic desktop updates are unavailable in this environment.",
  mode: "unsupported_platform",
  provider: "none",
  stage: "idle",
};

export type DesktopNotificationFallbacks = {
  desktopHostBridge: DesktopHostBridge | null;
};

export type DesktopDiagnosticsFallbacks = {
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

export async function resolveDesktopAppInfo(
  desktopHostBridge: DesktopHostBridge | null
): Promise<DesktopAppInfo | null> {
  try {
    const appInfo = await desktopHostBridge?.app?.getInfo?.();
    if (!appInfo) {
      return null;
    }

    if (typeof appInfo.version === "string" || appInfo.version === null) {
      return appInfo;
    }
  } catch {
    // App info is optional.
  }

  return null;
}

export async function resolveDesktopDiagnosticsInfo(
  input: DesktopDiagnosticsFallbacks
): Promise<DesktopDiagnosticsInfo | null> {
  try {
    const diagnosticsInfo = await input.desktopHostBridge?.diagnostics?.getInfo?.();
    if (!diagnosticsInfo) {
      return null;
    }

    if (typeof diagnosticsInfo.recentIncidentCount === "number") {
      return diagnosticsInfo;
    }
  } catch {
    // Diagnostics info is optional.
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

export async function consumeDesktopLaunchIntent(
  desktopHostBridge: DesktopHostBridge | null
): Promise<DesktopLaunchIntent | null> {
  try {
    const launchIntent = await desktopHostBridge?.launch?.consumePendingIntent?.();
    if (launchIntent && typeof launchIntent.kind === "string") {
      return launchIntent;
    }
  } catch {
    // Launch intents are optional.
  }

  return null;
}

export function subscribeDesktopLaunchIntents(
  desktopHostBridge: DesktopHostBridge | null,
  listener: (intent: DesktopLaunchIntent) => void
): () => void {
  try {
    const unsubscribe = desktopHostBridge?.launch?.onIntent?.(listener);
    return typeof unsubscribe === "function" ? unsubscribe : () => undefined;
  } catch {
    return () => undefined;
  }
}

export function subscribeDesktopUpdateState(
  desktopHostBridge: DesktopHostBridge | null,
  listener: (state: DesktopUpdateState) => void
): () => void {
  try {
    const unsubscribe = desktopHostBridge?.updater?.onState?.(listener);
    return typeof unsubscribe === "function" ? unsubscribe : () => undefined;
  } catch {
    return () => undefined;
  }
}

export async function resolveDesktopUpdateState(
  desktopHostBridge: DesktopHostBridge | null
): Promise<DesktopUpdateState> {
  try {
    const updateState = await desktopHostBridge?.updater?.getState?.();
    if (updateState && typeof updateState.stage === "string") {
      return updateState;
    }
  } catch {
    // Updater state is optional.
  }

  return DEFAULT_UNSUPPORTED_UPDATE_STATE;
}

export async function checkDesktopForUpdates(
  desktopHostBridge: DesktopHostBridge | null
): Promise<DesktopUpdateState> {
  try {
    const updateState = await desktopHostBridge?.updater?.checkForUpdates?.();
    if (updateState && typeof updateState.stage === "string") {
      return updateState;
    }
  } catch {
    // Updater checks are optional.
  }

  return DEFAULT_UNSUPPORTED_UPDATE_STATE;
}

export async function restartDesktopToApplyUpdate(
  desktopHostBridge: DesktopHostBridge | null
): Promise<boolean> {
  try {
    const restartResult = await desktopHostBridge?.updater?.restartToApplyUpdate?.();
    if (desktopHostBridge?.updater?.restartToApplyUpdate) {
      return restartResult !== false;
    }
  } catch {
    // Updater restarts are optional.
  }

  return false;
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
