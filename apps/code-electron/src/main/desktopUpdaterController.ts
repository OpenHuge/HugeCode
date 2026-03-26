import type { DesktopUpdateState } from "../shared/ipc.js";
import type { DesktopAutoUpdateStrategy } from "./desktopAutoUpdateConfigurator.js";

type AutoUpdaterInfo = {
  version?: string;
};

type AutoUpdaterProgress = {
  total: number;
  transferred: number;
};

type AutoUpdaterLike = {
  checkForUpdates(): void;
  on(event: string, listener: (...args: unknown[]) => void): void;
  quitAndInstall(): void;
};

export type CreateDesktopUpdaterControllerInput = {
  appVersion: string | null;
  autoUpdater: AutoUpdaterLike;
  configureAutoUpdates?: () => boolean | void;
  onStateChange?: (state: DesktopUpdateState) => void;
  repoUrl: string;
  strategy: DesktopAutoUpdateStrategy;
};

function createReleaseUrl(repoUrl: string) {
  const trimmedRepoUrl = repoUrl.trim().replace(/\/+$/, "");
  return trimmedRepoUrl.length > 0 ? `${trimmedRepoUrl}/releases` : null;
}

export function createDesktopUpdaterController(input: CreateDesktopUpdaterControllerInput) {
  const releaseUrl = createReleaseUrl(input.repoUrl);
  let configured = false;
  let state: DesktopUpdateState = {
    capability: input.strategy.capability,
    message: input.strategy.message,
    mode: input.strategy.mode,
    provider: input.strategy.provider,
    releaseUrl,
    stage: "idle",
    version: input.appVersion,
  };

  function setState(nextState: DesktopUpdateState) {
    state = nextState;
    input.onStateChange?.(state);
    return state;
  }

  input.autoUpdater.on("checking-for-update", () => {
    setState({ ...state, stage: "checking" });
  });
  input.autoUpdater.on("update-available", (info) => {
    const updateInfo = (info ?? {}) as AutoUpdaterInfo;
    setState({
      ...state,
      stage: "available",
      version: updateInfo.version ?? state.version ?? null,
    });
  });
  input.autoUpdater.on("download-progress", (progress) => {
    const updateProgress = progress as AutoUpdaterProgress;
    setState({
      ...state,
      downloadedBytes: updateProgress.transferred,
      stage: "downloading",
      totalBytes: updateProgress.total,
    });
  });
  input.autoUpdater.on("update-downloaded", (info) => {
    const updateInfo = (info ?? {}) as AutoUpdaterInfo;
    setState({
      ...state,
      stage: "downloaded",
      version: updateInfo.version ?? state.version ?? null,
    });
  });
  input.autoUpdater.on("update-not-available", () => {
    setState({
      ...state,
      stage: "latest",
    });
  });
  input.autoUpdater.on("error", (error) => {
    const updateError = error instanceof Error ? error : new Error(String(error));
    setState({
      ...state,
      error: updateError.message,
      stage: "error",
    });
  });

  function ensureConfigured() {
    if (configured || state.capability !== "automatic") {
      return;
    }

    configured = true;
    try {
      const configuredResult = input.configureAutoUpdates?.();
      if (configuredResult === false) {
        setState({
          ...state,
          capability: "manual",
          message:
            "Automatic desktop updates are unavailable because the updater provider could not be initialized for this build.",
          mode: "misconfigured",
          provider: "none",
          stage: "idle",
        });
      }
    } catch (error) {
      setState({
        ...state,
        capability: "manual",
        message:
          "Automatic desktop updates are unavailable because the updater provider could not be initialized for this build.",
        mode: "misconfigured",
        provider: "none",
        error: error instanceof Error ? error.message : String(error),
        stage: "idle",
      });
    }
  }

  return {
    initialize() {
      ensureConfigured();
      return state;
    },
    checkForUpdates() {
      if (state.capability !== "automatic") {
        return state;
      }

      ensureConfigured();
      setState({
        ...state,
        stage: "checking",
      });
      input.autoUpdater.checkForUpdates();
      return state;
    },
    getState() {
      return state;
    },
    restartToApplyUpdate() {
      if (state.stage !== "downloaded") {
        return false;
      }

      input.autoUpdater.quitAndInstall();
      return true;
    },
  };
}
