import type { DesktopLaunchIntent } from "../shared/ipc.js";

type OpenUrlEventLike = {
  preventDefault(): void;
};

type ElectronAppLike = {
  on(event: "open-url", listener: (event: OpenUrlEventLike, url: string) => void): void;
  setAsDefaultProtocolClient(protocol: string): boolean;
};

export type CreateDesktopLaunchIntentControllerInput = {
  app: ElectronAppLike;
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

function findProtocolUrl(argv: string[] | undefined, protocol: string) {
  const protocolPrefix = buildProtocolPrefix(protocol);
  for (const arg of argv ?? []) {
    if (typeof arg === "string" && arg.toLowerCase().startsWith(protocolPrefix)) {
      return arg;
    }
  }

  return null;
}

export function createDesktopLaunchIntentController(
  input: CreateDesktopLaunchIntentControllerInput
) {
  function resolveProtocolIntent(argv: string[] | undefined) {
    const protocolUrl = findProtocolUrl(argv, input.protocol);
    return protocolUrl ? createProtocolLaunchIntent(protocolUrl) : null;
  }

  let pendingIntent = resolveProtocolIntent(input.initialArgv);

  function queueProtocolUrl(url: string) {
    if (!url.toLowerCase().startsWith(buildProtocolPrefix(input.protocol))) {
      return null;
    }

    const nextIntent = createProtocolLaunchIntent(url);
    pendingIntent = nextIntent;
    return nextIntent;
  }

  return {
    consumePendingIntent() {
      const nextIntent = pendingIntent;
      pendingIntent = null;
      return nextIntent;
    },
    queueArgv(argv: string[]) {
      const nextIntent = resolveProtocolIntent(argv);
      if (!nextIntent) {
        return null;
      }

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
    },
    registerProtocolClient() {
      return input.app.setAsDefaultProtocolClient(input.protocol);
    },
    queueProtocolUrl,
  };
}
