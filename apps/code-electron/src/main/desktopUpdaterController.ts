import type { DesktopReleaseChannel, DesktopUpdateState } from "../shared/ipc.js";

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
  channel: DesktopReleaseChannel;
  configureAutoUpdates?: (input: { baseUrl: string; channel: DesktopReleaseChannel }) => void;
  isPackaged: boolean;
  platform: NodeJS.Platform;
  repoUrl: string;
  staticUpdateBaseUrl?: string | null;
};

function createReleaseUrl(repoUrl: string) {
  const trimmedRepoUrl = repoUrl.trim().replace(/\/+$/, "");
  return trimmedRepoUrl.length > 0 ? `${trimmedRepoUrl}/releases` : null;
}

function resolveUpdateCapability(
  input: Pick<
    CreateDesktopUpdaterControllerInput,
    "channel" | "configureAutoUpdates" | "isPackaged" | "platform" | "staticUpdateBaseUrl"
  >
) {
  if (input.platform !== "darwin" && input.platform !== "win32") {
    return "manual" as const;
  }

  if (input.channel === "beta") {
    return input.configureAutoUpdates &&
      input.isPackaged &&
      (input.staticUpdateBaseUrl?.trim().length ?? 0) > 0
      ? ("automatic" as const)
      : ("manual" as const);
  }

  return input.isPackaged ? ("automatic" as const) : ("manual" as const);
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
    const baseUrl = input.staticUpdateBaseUrl?.trim();
    if (input.channel === "beta" && baseUrl) {
      input.configureAutoUpdates?.({
        baseUrl,
        channel: input.channel,
      });
    }
  }

  return {
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
