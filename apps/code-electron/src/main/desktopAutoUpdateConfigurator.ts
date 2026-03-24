import type { DesktopReleaseChannel } from "../shared/ipc.js";
import { UpdateSourceType, updateElectronApp } from "update-electron-app";

type UpdateElectronAppOptions = Parameters<typeof updateElectronApp>[0];

type UpdateElectronAppLike = (options: UpdateElectronAppOptions) => unknown;

export type DesktopAutoUpdateConfiguration =
  | {
      baseUrl: string;
      kind: "static-storage";
    }
  | {
      kind: "public-github";
      repo: string;
    };

export type CreateDesktopAutoUpdateConfiguratorInput = {
  channel: DesktopReleaseChannel;
  repoUrl: string;
  staticUpdateBaseUrl?: string | null;
  updateElectronAppImpl?: UpdateElectronAppLike;
};

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

export function resolveDesktopAutoUpdateConfiguration(
  input: Pick<
    CreateDesktopAutoUpdateConfiguratorInput,
    "channel" | "repoUrl" | "staticUpdateBaseUrl"
  >
): DesktopAutoUpdateConfiguration | null {
  const staticUpdateBaseUrl = input.staticUpdateBaseUrl?.trim();
  if (staticUpdateBaseUrl) {
    return {
      baseUrl: staticUpdateBaseUrl,
      kind: "static-storage",
    };
  }

  if (input.channel !== "stable") {
    return null;
  }

  const repo = resolveGitHubRepositorySlug(input.repoUrl);
  return repo
    ? {
        kind: "public-github",
        repo,
      }
    : null;
}

export function createDesktopAutoUpdateConfigurator(
  input: CreateDesktopAutoUpdateConfiguratorInput
) {
  const updateElectronAppImpl = input.updateElectronAppImpl ?? updateElectronApp;
  const configuration = resolveDesktopAutoUpdateConfiguration(input);

  return {
    initialize() {
      if (!configuration) {
        return false;
      }

      if (configuration.kind === "static-storage") {
        updateElectronAppImpl({
          notifyUser: false,
          updateSource: {
            baseUrl: configuration.baseUrl,
            type: UpdateSourceType.StaticStorage,
          },
        });
        return true;
      }

      updateElectronAppImpl({
        notifyUser: false,
        updateSource: {
          repo: configuration.repo,
          type: UpdateSourceType.ElectronPublicUpdateService,
        },
      });
      return true;
    },
    isAvailable: configuration !== null,
  };
}
