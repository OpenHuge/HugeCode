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
};

export type DesktopWindowLabelFallbacks = {
  defaultLabel?: string;
  desktopHostBridge: DesktopHostBridge | null;
  getWindowLabel?: () => Promise<string | null | undefined>;
};

export type DesktopVersionFallbacks = {
  desktopHostBridge: DesktopHostBridge | null;
  getAppVersion?: () => Promise<string | null | undefined>;
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
  openDesktopUrl?: (url: string) => Promise<boolean>;
};

export type DesktopItemRevealFallbacks = {
  desktopHostBridge: DesktopHostBridge | null;
  revealDesktopItem?: (path: string) => Promise<boolean>;
};

export type DesktopPathOpenFallbacks = {
  desktopHostBridge: DesktopHostBridge | null;
  openDesktopPath?: (path: string) => Promise<boolean>;
};

export function detectDesktopRuntimeHost(input: DesktopRuntimeDetectionInput): DesktopRuntimeHost {
  if (input.desktopHostBridge) {
    return input.desktopHostBridge.kind;
  }

  return "browser";
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
    // Fall through to the compatibility loader and then the default value.
  }

  try {
    const fallbackLabel = await input.getWindowLabel?.();
    if (typeof fallbackLabel === "string" && fallbackLabel.length > 0) {
      return fallbackLabel;
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
    // Fall through to the compatibility loader and then the null fallback.
  }

  try {
    const fallbackVersion = await input.getAppVersion?.();
    if (typeof fallbackVersion === "string" && fallbackVersion.length > 0) {
      return fallbackVersion;
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

export async function copyDesktopSupportSnapshot(
  input: DesktopDiagnosticsFallbacks
): Promise<boolean> {
  try {
    const copyResult = await input.desktopHostBridge?.diagnostics?.copySupportSnapshot?.();
    if (input.desktopHostBridge?.diagnostics?.copySupportSnapshot) {
      return copyResult !== false;
    }
  } catch {
    // Support snapshot copy is optional.
  }

  return false;
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
    // Fall through to desktop compatibility and browser fallbacks.
  }

  try {
    const desktopOpened = await input.openDesktopUrl?.(safeUrl);
    if (desktopOpened) {
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
    // Fall through to desktop compatibility fallback.
  }

  try {
    return (await input.revealDesktopItem?.(path)) === true;
  } catch {
    return false;
  }
}

export async function openDesktopPath(
  input: DesktopPathOpenFallbacks,
  path: string
): Promise<boolean> {
  try {
    const openResult = await input.desktopHostBridge?.shell?.openPath?.(path);
    if (input.desktopHostBridge?.shell?.openPath) {
      return openResult !== false;
    }
  } catch {
    // Fall through to desktop compatibility fallback.
  }

  try {
    return (await input.openDesktopPath?.(path)) === true;
  } catch {
    return false;
  }
}
