import {
  checkDesktopForUpdates,
  consumeDesktopLaunchIntent,
  detectDesktopRuntimeHost as detectDesktopRuntimeHostWithCapabilities,
  openDesktopExternalUrl,
  resolveDesktopAppInfo,
  resolveDesktopAppVersion,
  resolveDesktopSessionInfo,
  resolveDesktopUpdateState,
  resolveDesktopWindowLabel,
  restartDesktopToApplyUpdate,
  revealDesktopItemInDir,
  showDesktopNotification as showDesktopNotificationWithCapabilities,
} from "@ku0/code-application";
import type {
  DesktopAppInfo,
  DesktopLaunchIntent,
  DesktopNotificationInput,
  DesktopRuntimeHost,
  DesktopSessionInfo,
  DesktopUpdateState,
} from "@ku0/code-platform-interfaces";
import type { WorkspaceClientHostStartupStatus } from "@ku0/code-workspace-client/workspace-bindings";
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

export async function resolveCurrentDesktopSession(): Promise<DesktopSessionInfo | null> {
  return resolveDesktopSessionInfo(getDesktopHostBridge());
}

export async function consumePendingDesktopLaunchIntent(): Promise<DesktopLaunchIntent | null> {
  return consumeDesktopLaunchIntent(getDesktopHostBridge());
}

export async function resolveDesktopUpdaterState(): Promise<DesktopUpdateState> {
  return resolveDesktopUpdateState(getDesktopHostBridge());
}

function buildDesktopShellStartupStatus(input: {
  runtimeHost: DesktopRuntimeHost;
  updateState: DesktopUpdateState;
}): WorkspaceClientHostStartupStatus | null {
  const hostLabel =
    input.runtimeHost === "electron"
      ? "Electron host"
      : input.runtimeHost === "tauri"
        ? "Tauri host"
        : null;

  if (!hostLabel) {
    return null;
  }

  if (input.updateState.capability === "automatic") {
    if (
      input.updateState.stage === "available" ||
      input.updateState.stage === "downloading" ||
      input.updateState.stage === "downloaded" ||
      input.updateState.stage === "checking"
    ) {
      return {
        tone: "attention",
        label: `${hostLabel} update active`,
        detail:
          input.updateState.message ??
          "Desktop update checks are active while the shell stays interactive.",
      };
    }

    if (input.updateState.stage === "error") {
      return {
        tone: "attention",
        label: `${hostLabel} update attention`,
        detail: input.updateState.error ?? "The desktop updater reported an error.",
      };
    }

    return {
      tone: "ready",
      label: `${hostLabel} ready`,
      detail:
        input.updateState.message ??
        "Desktop startup completed and automatic update capability is available.",
    };
  }

  if (
    input.updateState.mode === "misconfigured" ||
    input.updateState.mode === "disabled_first_run_lock"
  ) {
    return {
      tone: "blocked",
      label: `${hostLabel} startup blocked`,
      detail:
        input.updateState.message ??
        "Resolve desktop updater configuration before relying on this host for managed updates.",
    };
  }

  return {
    tone: "attention",
    label: `${hostLabel} manual updates`,
    detail:
      input.updateState.message ??
      "Desktop startup completed, but this host requires manual update handling.",
  };
}

export async function resolveDesktopShellStartupStatus(): Promise<WorkspaceClientHostStartupStatus | null> {
  const runtimeHost = await detectDesktopRuntimeHost();
  if (runtimeHost !== "electron" && runtimeHost !== "tauri") {
    return null;
  }

  const updateState = await resolveDesktopUpdaterState();
  return buildDesktopShellStartupStatus({
    runtimeHost,
    updateState,
  });
}

export async function checkForDesktopUpdates(): Promise<DesktopUpdateState> {
  return checkDesktopForUpdates(getDesktopHostBridge());
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
