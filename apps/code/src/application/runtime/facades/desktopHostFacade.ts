import {
  checkDesktopForUpdates,
  consumeDesktopLaunchIntent,
  detectDesktopRuntimeHost as detectDesktopRuntimeHostWithCapabilities,
  openDesktopExternalUrl,
  resolveDesktopAppInfo,
  resolveDesktopDiagnosticsInfo as resolveDesktopDiagnosticsInfoWithCapabilities,
  resolveDesktopAppVersion,
  resolveDesktopSessionInfo,
  resolveDesktopUpdateState,
  resolveDesktopWindowLabel,
  restartDesktopToApplyUpdate,
  revealDesktopItemInDir,
  showDesktopNotification as showDesktopNotificationWithCapabilities,
  subscribeDesktopLaunchIntents as subscribeDesktopLaunchIntentsWithCapabilities,
  subscribeDesktopUpdateState as subscribeDesktopUpdateStateWithCapabilities,
} from "@ku0/code-application";
import type {
  DesktopAppInfo,
  DesktopDiagnosticsInfo,
  DesktopLaunchIntent,
  DesktopNotificationInput,
  DesktopSessionInfo,
  DesktopUpdateState,
} from "@ku0/code-platform-interfaces";
import { getDesktopHostBridge } from "../ports/desktopHostBridge";
import {
  detectTauriRuntime,
  readTauriAppVersion,
  readTauriWindowLabel,
} from "../ports/tauriEnvironment";
import { openTauriUrl, revealTauriItemInDir } from "../ports/tauriOpener";

function openBrowserUrl(url: string) {
  if (typeof window === "undefined" || typeof window.open !== "function") {
    return false;
  }

  return window.open(url, "_blank", "noopener,noreferrer") !== null;
}

export async function detectDesktopRuntimeHost() {
  return detectDesktopRuntimeHostWithCapabilities({
    desktopHostBridge: getDesktopHostBridge(),
    tauriRuntimeAvailable: (await detectTauriRuntime()) === true,
  });
}

export async function resolveWindowLabel(defaultLabel = "main") {
  return resolveDesktopWindowLabel({
    desktopHostBridge: getDesktopHostBridge(),
    defaultLabel,
    getTauriWindowLabel: readTauriWindowLabel,
  });
}

export async function resolveAppVersion() {
  return resolveDesktopAppVersion({
    desktopHostBridge: getDesktopHostBridge(),
    getTauriAppVersion: readTauriAppVersion,
  });
}

export async function resolveAppInfo(): Promise<DesktopAppInfo | null> {
  return resolveDesktopAppInfo(getDesktopHostBridge());
}

export async function resolveDesktopDiagnosticsInfo(): Promise<DesktopDiagnosticsInfo | null> {
  return resolveDesktopDiagnosticsInfoWithCapabilities({
    desktopHostBridge: getDesktopHostBridge(),
  });
}

export async function resolveCurrentDesktopSession(): Promise<DesktopSessionInfo | null> {
  return resolveDesktopSessionInfo(getDesktopHostBridge());
}

export async function consumePendingDesktopLaunchIntent(): Promise<DesktopLaunchIntent | null> {
  return consumeDesktopLaunchIntent(getDesktopHostBridge());
}

export function subscribeToDesktopLaunchIntents(
  listener: (intent: DesktopLaunchIntent) => void
): () => void {
  return subscribeDesktopLaunchIntentsWithCapabilities(getDesktopHostBridge(), listener);
}

export async function resolveDesktopUpdaterState(): Promise<DesktopUpdateState> {
  return resolveDesktopUpdateState(getDesktopHostBridge());
}

export async function checkForDesktopUpdates(): Promise<DesktopUpdateState> {
  return checkDesktopForUpdates(getDesktopHostBridge());
}

export function subscribeToDesktopUpdateState(
  listener: (state: DesktopUpdateState) => void
): () => void {
  return subscribeDesktopUpdateStateWithCapabilities(getDesktopHostBridge(), listener);
}

export async function restartDesktopUpdate(): Promise<boolean> {
  return restartDesktopToApplyUpdate(getDesktopHostBridge());
}

export async function openUrl(url: string) {
  return openDesktopExternalUrl(
    {
      desktopHostBridge: getDesktopHostBridge(),
      openBrowserUrl,
      openTauriUrl,
    },
    url
  );
}

export async function revealItemInDir(path: string) {
  return revealDesktopItemInDir(
    {
      desktopHostBridge: getDesktopHostBridge(),
      revealTauriItem: revealTauriItemInDir,
    },
    path
  );
}

export async function showDesktopNotification(input: DesktopNotificationInput) {
  return showDesktopNotificationWithCapabilities(
    {
      desktopHostBridge: getDesktopHostBridge(),
    },
    input
  );
}
