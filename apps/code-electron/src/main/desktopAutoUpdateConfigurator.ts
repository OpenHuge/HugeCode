import type {
  DesktopReleaseChannel,
  DesktopUpdateCapability,
  DesktopUpdateMode,
  DesktopUpdateProvider,
} from "@ku0/code-platform-interfaces";
import { UpdateSourceType, updateElectronApp } from "update-electron-app";

type UpdateElectronAppOptions = Parameters<typeof updateElectronApp>[0];
type UpdateElectronAppLike = (options: UpdateElectronAppOptions) => unknown;

type DesktopUpdateLogger = Pick<Console, "info" | "warn">;

export type DesktopAutoUpdateStrategy = {
  capability: DesktopUpdateCapability;
  message: string;
  mode: DesktopUpdateMode;
  provider: DesktopUpdateProvider;
};

export type CreateDesktopAutoUpdateConfiguratorInput = {
  arch: NodeJS.Architecture;
  channel: DesktopReleaseChannel;
  isPackaged: boolean;
  logger?: DesktopUpdateLogger;
  platform: NodeJS.Platform;
  processArgv?: string[];
  repoUrl: string;
  staticUpdateBaseUrl?: string | null;
  updateElectronAppImpl?: UpdateElectronAppLike;
};

const SQUIRREL_FIRST_RUN_FLAG = "--squirrel-firstrun";

function isHttpUrl(url: URL) {
  return url.protocol === "https:" || url.protocol === "http:";
}

export function resolveGitHubRepositorySlug(repoUrl: string) {
  try {
    const url = new URL(repoUrl);
    if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
      return null;
    }

    const [owner, rawRepository] = url.pathname.split("/").filter(Boolean);
    if (!owner || !rawRepository) {
      return null;
    }

    return `${owner}/${rawRepository.replace(/\.git$/u, "")}`;
  } catch {
    return null;
  }
}

export function normalizeStaticUpdateBaseUrlRoot(staticUpdateBaseUrl: string | null | undefined) {
  const trimmed = staticUpdateBaseUrl?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    if (!isHttpUrl(url)) {
      return null;
    }

    return trimmed.replace(/\/+$/u, "");
  } catch {
    return null;
  }
}

export function buildStaticUpdateBaseUrl(
  rootBaseUrl: string,
  platform: NodeJS.Platform,
  arch: NodeJS.Architecture
) {
  return `${rootBaseUrl.replace(/\/+$/u, "")}/${platform}/${arch}`;
}

function hasSquirrelFirstRunLock(argv: string[] | undefined) {
  return argv?.some((arg) => arg === SQUIRREL_FIRST_RUN_FLAG) === true;
}

function createUpdateSelectionLogPayload(
  input: CreateDesktopAutoUpdateConfiguratorInput,
  strategy: DesktopAutoUpdateStrategy
) {
  return {
    arch: input.arch,
    capability: strategy.capability,
    channel: input.channel,
    event: "desktop_updater_mode_selected",
    hasStaticUpdateBaseUrl:
      normalizeStaticUpdateBaseUrlRoot(input.staticUpdateBaseUrl ?? null) !== null,
    isPackaged: input.isPackaged,
    mode: strategy.mode,
    platform: input.platform,
    provider: strategy.provider,
    repo: resolveGitHubRepositorySlug(input.repoUrl),
  };
}

function createUpdateInitializationFailureLogPayload(
  input: CreateDesktopAutoUpdateConfiguratorInput,
  strategy: DesktopAutoUpdateStrategy,
  error: unknown
) {
  return {
    ...createUpdateSelectionLogPayload(input, strategy),
    error: error instanceof Error ? error.message : String(error),
    event: "desktop_updater_initialization_failed",
  };
}

export function resolveDesktopAutoUpdateStrategy(
  input: Pick<
    CreateDesktopAutoUpdateConfiguratorInput,
    | "arch"
    | "channel"
    | "isPackaged"
    | "platform"
    | "processArgv"
    | "repoUrl"
    | "staticUpdateBaseUrl"
  >
): DesktopAutoUpdateStrategy & {
  githubRepo?: string;
  staticFeedBaseUrl?: string;
} {
  if (input.platform !== "darwin" && input.platform !== "win32") {
    return {
      capability: "unsupported",
      message: "Automatic desktop updates are unavailable on this platform.",
      mode: "unsupported_platform",
      provider: "none",
    };
  }

  if (!input.isPackaged) {
    return {
      capability: "manual",
      message: "Automatic desktop updates are disabled in unpackaged development builds.",
      mode: "disabled_unpacked",
      provider: "none",
    };
  }

  if (input.platform === "win32" && hasSquirrelFirstRunLock(input.processArgv)) {
    return {
      capability: "manual",
      message:
        "Automatic desktop updates are temporarily disabled while the Windows installer finishes first-run setup.",
      mode: "disabled_first_run_lock",
      provider: "none",
    };
  }

  if (input.channel === "beta") {
    const configuredRootBaseUrl = normalizeStaticUpdateBaseUrlRoot(
      input.staticUpdateBaseUrl ?? null
    );
    if (!configuredRootBaseUrl) {
      if (input.staticUpdateBaseUrl?.trim()) {
        return {
          capability: "manual",
          message:
            "Beta auto-update is disabled because HUGECODE_ELECTRON_UPDATE_BASE_URL must be an absolute http(s) URL.",
          mode: "misconfigured",
          provider: "none",
        };
      }

      return {
        capability: "manual",
        message:
          "Beta builds update manually from GitHub Releases unless HUGECODE_ELECTRON_UPDATE_BASE_URL is configured.",
        mode: "disabled_beta_manual",
        provider: "none",
      };
    }

    return {
      capability: "automatic",
      message: "Automatic beta updates are enabled from the configured static feed.",
      mode: "enabled_beta_static_feed",
      provider: "static-storage",
      staticFeedBaseUrl: buildStaticUpdateBaseUrl(
        configuredRootBaseUrl,
        input.platform,
        input.arch
      ),
    };
  }

  if (input.channel === "stable") {
    const repo = resolveGitHubRepositorySlug(input.repoUrl);
    if (!repo) {
      return {
        capability: "manual",
        message:
          "Stable auto-update is disabled because repository metadata must point to a public GitHub repository.",
        mode: "misconfigured",
        provider: "none",
      };
    }

    return {
      capability: "automatic",
      githubRepo: repo,
      message: "Automatic stable updates are enabled through the public Electron update service.",
      mode: "enabled_stable_public_service",
      provider: "public-github",
    };
  }

  return {
    capability: "manual",
    message: "The dev release channel does not support automatic desktop updates.",
    mode: "misconfigured",
    provider: "none",
  };
}

export function createDesktopAutoUpdateConfigurator(
  input: CreateDesktopAutoUpdateConfiguratorInput
) {
  const updateElectronAppImpl = input.updateElectronAppImpl ?? updateElectronApp;
  const logger = input.logger ?? console;
  const strategy = resolveDesktopAutoUpdateStrategy(input);
  let initialized = false;

  return {
    initialize() {
      if (initialized) {
        return strategy.capability === "automatic";
      }

      initialized = true;
      const logPayload = createUpdateSelectionLogPayload(input, strategy);
      const logLine = `[HugeCode][desktop-updater] ${JSON.stringify(logPayload)}`;
      if (strategy.mode === "misconfigured") {
        logger.warn(logLine);
      } else {
        logger.info(logLine);
      }

      if (strategy.capability !== "automatic") {
        return false;
      }

      try {
        if (strategy.provider === "static-storage") {
          const baseUrl = "staticFeedBaseUrl" in strategy ? strategy.staticFeedBaseUrl : null;
          if (!baseUrl) {
            throw new Error("Static-storage update mode requires a concrete baseUrl.");
          }
          updateElectronAppImpl({
            notifyUser: false,
            updateSource: {
              baseUrl,
              type: UpdateSourceType.StaticStorage,
            },
          });
          return true;
        }

        const repo = "githubRepo" in strategy ? strategy.githubRepo : null;
        if (!repo) {
          throw new Error("Public-service update mode requires a concrete GitHub repository.");
        }

        updateElectronAppImpl({
          notifyUser: false,
          updateSource: {
            repo,
            type: UpdateSourceType.ElectronPublicUpdateService,
          },
        });
        return true;
      } catch (error) {
        logger.warn(
          `[HugeCode][desktop-updater] ${JSON.stringify(
            createUpdateInitializationFailureLogPayload(input, strategy, error)
          )}`
        );
        return false;
      }
    },
    strategy,
  };
}
