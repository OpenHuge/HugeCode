import {
  detectDesktopRuntimeHost as detectDesktopRuntimeHostWithCapabilities,
  openDesktopExternalUrl,
  resolveDesktopAppVersion,
  resolveDesktopSessionInfo,
  resolveDesktopWindowLabel,
  revealDesktopItemInDir,
  showDesktopNotification as showDesktopNotificationWithCapabilities,
} from "@ku0/code-application";
import type { DesktopNotificationInput, DesktopSessionInfo } from "@ku0/code-platform-interfaces";
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

export async function resolveCurrentDesktopSession(): Promise<DesktopSessionInfo | null> {
  return resolveDesktopSessionInfo(getDesktopHostBridge());
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
