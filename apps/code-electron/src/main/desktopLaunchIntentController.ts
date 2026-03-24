import { existsSync, statSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import type { OpenDesktopWindowInput } from "../shared/ipc.js";
import type { DesktopLaunchIntent } from "../shared/ipc.js";

type OpenUrlEventLike = {
  preventDefault(): void;
};

type OpenFileEventLike = {
  preventDefault(): void;
};

type ElectronAppLike = {
  addRecentDocument?(path: string): void;
  on(event: "open-file", listener: (event: OpenFileEventLike, path: string) => void): void;
  on(event: "open-url", listener: (event: OpenUrlEventLike, url: string) => void): void;
  setAsDefaultProtocolClient(protocol: string): boolean;
};

type LaunchIntentControllerDependencies = {
  currentWorkingDirectory?: () => string;
  existsSync?: typeof existsSync;
  statSync?: typeof statSync;
};

export type CreateDesktopLaunchIntentControllerInput = {
  app: ElectronAppLike;
  dependencies?: LaunchIntentControllerDependencies;
  initialArgv?: string[];
  platform: NodeJS.Platform;
  protocol: string;
};

function buildProtocolPrefix(protocol: string) {
  return `${protocol.toLowerCase()}://`;
}

function createProtocolLaunchIntent(url: string): DesktopLaunchIntent {
  return {
    kind: "protocol",
    receivedAt: new Date().toISOString(),
    url,
  };
}

function createWorkspaceLaunchIntent(
  workspacePath: string,
  workspaceLabel: string | null,
  launchPath?: string | null,
  launchPathKind?: "directory" | "file" | null
): DesktopLaunchIntent {
  return {
    kind: "workspace",
    launchPath: launchPath ?? null,
    launchPathKind: launchPathKind ?? null,
    receivedAt: new Date().toISOString(),
    workspaceLabel,
    workspacePath,
  };
}

function findProtocolUrl(argv: string[] | undefined, protocol: string) {
  const protocolPrefix = buildProtocolPrefix(protocol);
  for (const arg of argv ?? []) {
    if (typeof arg === "string" && arg.toLowerCase().startsWith(protocolPrefix)) {
      return arg;
    }
  }

  return null;
}

function toWorkspaceLabel(workspacePath: string) {
  const label = basename(workspacePath).trim();
  return label.length > 0 ? label : null;
}

export function createDesktopLaunchIntentController(
  input: CreateDesktopLaunchIntentControllerInput
) {
  const currentWorkingDirectory =
    input.dependencies?.currentWorkingDirectory ?? (() => process.cwd());
  const pathExists = input.dependencies?.existsSync ?? existsSync;
  const readPathStat = input.dependencies?.statSync ?? statSync;

  function resolveProtocolIntent(argv: string[] | undefined) {
    const protocolUrl = findProtocolUrl(argv, input.protocol);
    return protocolUrl ? createProtocolLaunchIntent(protocolUrl) : null;
  }

  function resolveWorkspaceTarget(candidatePath: string) {
    const trimmedPath = candidatePath.trim();
    if (trimmedPath.length === 0 || trimmedPath.startsWith("-")) {
      return null;
    }

    const resolvedPath = resolve(currentWorkingDirectory(), trimmedPath);
    if (!pathExists(resolvedPath)) {
      return null;
    }

    try {
      const pathStat = readPathStat(resolvedPath);
      if (pathStat.isDirectory()) {
        return {
          launchPath: resolvedPath,
          launchPathKind: "directory" as const,
          workspacePath: resolvedPath,
        };
      }

      if (pathStat.isFile()) {
        return {
          launchPath: resolvedPath,
          launchPathKind: "file" as const,
          workspacePath: dirname(resolvedPath),
        };
      }
    } catch {
      return null;
    }

    return null;
  }

  function resolveWorkspaceIntent(argv: string[] | undefined) {
    for (const arg of argv ?? []) {
      if (typeof arg !== "string") {
        continue;
      }

      const workspaceTarget = resolveWorkspaceTarget(arg);
      if (!workspaceTarget) {
        continue;
      }

      return createWorkspaceLaunchIntent(
        workspaceTarget.workspacePath,
        toWorkspaceLabel(workspaceTarget.workspacePath),
        workspaceTarget.launchPath,
        workspaceTarget.launchPathKind
      );
    }

    return null;
  }

  function resolveInitialIntent(argv: string[] | undefined) {
    return resolveProtocolIntent(argv) ?? resolveWorkspaceIntent(argv);
  }

  function rememberRecentDocument(intent: DesktopLaunchIntent | null) {
    if (intent?.kind !== "workspace" || intent.launchPathKind !== "file" || !intent.launchPath) {
      return;
    }

    input.app.addRecentDocument?.(intent.launchPath);
  }

  let pendingIntent = resolveInitialIntent(input.initialArgv);
  rememberRecentDocument(pendingIntent);

  function queueProtocolUrl(url: string) {
    if (!url.toLowerCase().startsWith(buildProtocolPrefix(input.protocol))) {
      return null;
    }

    const nextIntent = createProtocolLaunchIntent(url);
    pendingIntent = nextIntent;
    return nextIntent;
  }

  function queueWorkspacePath(path: string) {
    const workspaceTarget = resolveWorkspaceTarget(path);
    if (!workspaceTarget) {
      return null;
    }

    const nextIntent = createWorkspaceLaunchIntent(
      workspaceTarget.workspacePath,
      toWorkspaceLabel(workspaceTarget.workspacePath),
      workspaceTarget.launchPath,
      workspaceTarget.launchPathKind
    );
    rememberRecentDocument(nextIntent);
    pendingIntent = nextIntent;
    return nextIntent;
  }

  return {
    consumePendingIntent() {
      const nextIntent = pendingIntent;
      pendingIntent = null;
      return nextIntent;
    },
    getPendingOpenWindowInput(): OpenDesktopWindowInput | null {
      if (pendingIntent?.kind !== "workspace" || !pendingIntent.workspacePath) {
        return null;
      }

      return {
        launchPath: pendingIntent.launchPath ?? null,
        launchPathKind: pendingIntent.launchPathKind ?? null,
        workspaceLabel: pendingIntent.workspaceLabel ?? null,
        workspacePath: pendingIntent.workspacePath,
      };
    },
    peekPendingIntent() {
      return pendingIntent ? { ...pendingIntent } : null;
    },
    queueArgv(argv: string[]) {
      const nextIntent = resolveInitialIntent(argv);
      if (!nextIntent) {
        return null;
      }

      rememberRecentDocument(nextIntent);
      pendingIntent = nextIntent;
      return nextIntent;
    },
    registerAppHandlers() {
      if (input.platform !== "darwin") {
        return;
      }

      input.app.on("open-url", (event, url) => {
        const queuedIntent = queueProtocolUrl(url);
        if (!queuedIntent) {
          return;
        }

        event.preventDefault();
      });

      input.app.on("open-file", (event, path) => {
        const queuedIntent = queueWorkspacePath(path);
        if (!queuedIntent) {
          return;
        }

        event.preventDefault();
      });
    },
    registerProtocolClient() {
      return input.app.setAsDefaultProtocolClient(input.protocol);
    },
    queueProtocolUrl,
    queueWorkspacePath,
  };
}
