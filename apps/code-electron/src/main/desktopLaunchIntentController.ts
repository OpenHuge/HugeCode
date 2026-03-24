import { existsSync, statSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import type { OpenDesktopWindowInput } from "../shared/ipc.js";
import type { DesktopLaunchIntent } from "../shared/ipc.js";
import { hasDesktopNewWindowArg } from "./desktopLaunchCommands.js";

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
  onQueuedIntent?: (intent: DesktopLaunchIntent) => void;
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

function toProtocolPathCandidate(url: URL) {
  const candidate =
    url.searchParams.get("path") ??
    url.searchParams.get("workspacePath") ??
    url.searchParams.get("target") ??
    null;
  if (typeof candidate !== "string") {
    return null;
  }

  const trimmedCandidate = candidate.trim();
  return trimmedCandidate.length > 0 ? trimmedCandidate : null;
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

  function resolveWorkspaceIntentFromProtocolUrl(url: string) {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== `${input.protocol}:`) {
        return null;
      }

      const hostname = parsedUrl.hostname.trim().toLowerCase();
      const pathname = parsedUrl.pathname.trim();
      if (hostname !== "workspace" || pathname !== "/open") {
        return null;
      }

      const pathCandidate = toProtocolPathCandidate(parsedUrl);
      if (!pathCandidate) {
        return null;
      }

      const workspaceTarget = resolveWorkspaceTarget(pathCandidate);
      if (!workspaceTarget) {
        return null;
      }

      return createWorkspaceLaunchIntent(
        workspaceTarget.workspacePath,
        toWorkspaceLabel(workspaceTarget.workspacePath),
        workspaceTarget.launchPath,
        workspaceTarget.launchPathKind
      );
    } catch {
      return null;
    }
  }

  function resolveProtocolIntent(argv: string[] | undefined) {
    const protocolUrl = findProtocolUrl(argv, input.protocol);
    if (!protocolUrl) {
      return null;
    }

    return (
      resolveWorkspaceIntentFromProtocolUrl(protocolUrl) ?? createProtocolLaunchIntent(protocolUrl)
    );
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

  function resolveDirectOpenWindowInput(argv: string[] | undefined): OpenDesktopWindowInput | null {
    if (!hasDesktopNewWindowArg(argv)) {
      return null;
    }

    return {
      duplicate: true,
    };
  }

  function rememberRecentDocument(intent: DesktopLaunchIntent | null) {
    if (intent?.kind !== "workspace" || intent.launchPathKind !== "file" || !intent.launchPath) {
      return;
    }

    input.app.addRecentDocument?.(intent.launchPath);
  }

  const pendingIntents: DesktopLaunchIntent[] = [];
  const pendingOpenWindowInputs: OpenDesktopWindowInput[] = [];
  const initialIntent = resolveInitialIntent(input.initialArgv);
  if (initialIntent) {
    pendingIntents.push(initialIntent);
    rememberRecentDocument(initialIntent);
  } else {
    const initialOpenWindowInput = resolveDirectOpenWindowInput(input.initialArgv);
    if (initialOpenWindowInput) {
      pendingOpenWindowInputs.push(initialOpenWindowInput);
    }
  }

  function removePendingIntent(intent: DesktopLaunchIntent) {
    const pendingIntentIndex = pendingIntents.indexOf(intent);
    if (pendingIntentIndex >= 0) {
      pendingIntents.splice(pendingIntentIndex, 1);
      return true;
    }

    const matchingIndex = pendingIntents.findIndex((candidate) => {
      return (
        candidate.kind === intent.kind &&
        candidate.receivedAt === intent.receivedAt &&
        candidate.url === intent.url &&
        candidate.workspacePath === intent.workspacePath &&
        candidate.launchPath === intent.launchPath
      );
    });
    if (matchingIndex < 0) {
      return false;
    }

    pendingIntents.splice(matchingIndex, 1);
    return true;
  }

  function toOpenWindowInput(intent: DesktopLaunchIntent | null) {
    if (intent?.kind !== "workspace" || !intent.workspacePath) {
      return null;
    }

    return {
      launchPath: intent.launchPath ?? null,
      launchPathKind: intent.launchPathKind ?? null,
      workspaceLabel: intent.workspaceLabel ?? null,
      workspacePath: intent.workspacePath,
    };
  }

  function queueProtocolUrl(url: string) {
    if (!url.toLowerCase().startsWith(buildProtocolPrefix(input.protocol))) {
      return null;
    }

    const nextIntent =
      resolveWorkspaceIntentFromProtocolUrl(url) ?? createProtocolLaunchIntent(url);
    pendingIntents.push(nextIntent);
    input.onQueuedIntent?.(nextIntent);
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
    pendingIntents.push(nextIntent);
    input.onQueuedIntent?.(nextIntent);
    return nextIntent;
  }

  return {
    consumePendingIntent() {
      return pendingIntents.shift() ?? null;
    },
    clearPendingIntent(intent?: DesktopLaunchIntent) {
      if (intent) {
        removePendingIntent(intent);
        return;
      }

      pendingIntents.splice(0, pendingIntents.length);
    },
    getPendingOpenWindowInput(): OpenDesktopWindowInput | null {
      return toOpenWindowInput(pendingIntents[0] ?? null) ?? pendingOpenWindowInputs[0] ?? null;
    },
    getOpenWindowInput(intent: DesktopLaunchIntent | null): OpenDesktopWindowInput | null {
      return toOpenWindowInput(intent);
    },
    peekPendingIntent() {
      const pendingIntent = pendingIntents[0];
      return pendingIntent ? { ...pendingIntent } : null;
    },
    queueArgv(argv: string[]) {
      const nextIntent = resolveInitialIntent(argv);
      if (nextIntent) {
        rememberRecentDocument(nextIntent);
        pendingIntents.push(nextIntent);
        return nextIntent;
      }

      const nextOpenWindowInput = resolveDirectOpenWindowInput(argv);
      if (nextOpenWindowInput) {
        pendingOpenWindowInputs.push(nextOpenWindowInput);
        return nextOpenWindowInput;
      }

      return null;
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
