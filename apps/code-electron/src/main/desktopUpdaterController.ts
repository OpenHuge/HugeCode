import type { DesktopUpdateState } from "../shared/ipc.js";

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
  autoUpdateAvailable?: boolean;
  autoUpdater: AutoUpdaterLike;
  configureAutoUpdates?: () => boolean | void;
  isPackaged: boolean;
  platform: NodeJS.Platform;
  repoUrl: string;
};

function createReleaseUrl(repoUrl: string) {
  const trimmedRepoUrl = repoUrl.trim().replace(/\/+$/, "");
  return trimmedRepoUrl.length > 0 ? `${trimmedRepoUrl}/releases` : null;
}

function resolveUpdateCapability(
  input: Pick<
    CreateDesktopUpdaterControllerInput,
    "autoUpdateAvailable" | "isPackaged" | "platform"
  >
) {
  if (input.platform !== "darwin" && input.platform !== "win32") {
    return "manual" as const;
  }

  return input.isPackaged && input.autoUpdateAvailable
    ? ("automatic" as const)
    : ("manual" as const);
}

export function createDesktopUpdaterController(input: CreateDesktopUpdaterControllerInput) {
  const releaseUrl = createReleaseUrl(input.repoUrl);
  const capability = resolveUpdateCapability(input);
  let configured = false;
  let state: DesktopUpdateState = {
    capability,
    releaseUrl,
    stage: "idle",
    version: input.appVersion,
  };

  input.autoUpdater.on("checking-for-update", () => {
    state = { ...state, stage: "checking" };
  });
  input.autoUpdater.on("update-available", (info) => {
    const updateInfo = (info ?? {}) as AutoUpdaterInfo;
    state = {
      ...state,
      stage: "available",
      version: updateInfo.version ?? state.version ?? null,
    };
  });
  input.autoUpdater.on("download-progress", (progress) => {
    const updateProgress = progress as AutoUpdaterProgress;
    state = {
      ...state,
      downloadedBytes: updateProgress.transferred,
      stage: "downloading",
      totalBytes: updateProgress.total,
    };
  });
  input.autoUpdater.on("update-downloaded", (info) => {
    const updateInfo = (info ?? {}) as AutoUpdaterInfo;
    state = {
      ...state,
      stage: "downloaded",
      version: updateInfo.version ?? state.version ?? null,
    };
  });
  input.autoUpdater.on("update-not-available", () => {
    state = {
      ...state,
      stage: "latest",
    };
  });
  input.autoUpdater.on("error", (error) => {
    const updateError = error instanceof Error ? error : new Error(String(error));
    state = {
      ...state,
      error: updateError.message,
      stage: "error",
    };
  });

  function ensureConfigured() {
    if (configured || capability !== "automatic") {
      return;
    }

    configured = true;
    input.configureAutoUpdates?.();
  }

  return {
    initialize() {
      ensureConfigured();
      return state;
    },
    checkForUpdates() {
      if (capability !== "automatic") {
        return state;
      }

      ensureConfigured();
      state = {
        ...state,
        stage: "checking",
      };
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
