import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { LocalChromeDebuggerEndpointDescriptor } from "@ku0/code-platform-interfaces";

type BrowserUserDataRoot = {
  browserName: string;
  rootPath: string;
};

const PROFILE_DIRECTORY_PATTERN = /^(Default|Profile \d+|Guest Profile|System Profile)$/;

function readDevToolsActivePortFile(
  browserName: string,
  profileLabel: string | null,
  filePath: string
): (LocalChromeDebuggerEndpointDescriptor & { updatedAt: number }) | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const raw = readFileSync(filePath, "utf8");
    const [portLine, browserPathLine] = raw
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    const port = Number.parseInt(portLine ?? "", 10);
    if (!Number.isInteger(port) || port <= 0) {
      return null;
    }
    const browserPath =
      typeof browserPathLine === "string" && browserPathLine.startsWith("/devtools/browser/")
        ? browserPathLine
        : null;
    if (!browserPath) {
      return null;
    }

    return {
      browserName,
      discoverySource: "devtools-active-port",
      httpBaseUrl: `http://127.0.0.1:${port}`,
      profileLabel,
      webSocketDebuggerUrl: `ws://127.0.0.1:${port}${browserPath}`,
      updatedAt: statSync(filePath).mtimeMs,
    };
  } catch {
    return null;
  }
}

function buildBrowserUserDataRoots(platform: NodeJS.Platform): BrowserUserDataRoot[] {
  const home = homedir();
  if (!home) {
    return [];
  }

  if (platform === "darwin") {
    const applicationSupport = join(home, "Library", "Application Support");
    return [
      { browserName: "Google Chrome", rootPath: join(applicationSupport, "Google", "Chrome") },
      {
        browserName: "Google Chrome Beta",
        rootPath: join(applicationSupport, "Google", "Chrome Beta"),
      },
      {
        browserName: "Google Chrome Dev",
        rootPath: join(applicationSupport, "Google", "Chrome Dev"),
      },
      {
        browserName: "Google Chrome Canary",
        rootPath: join(applicationSupport, "Google", "Chrome Canary"),
      },
      { browserName: "Chromium", rootPath: join(applicationSupport, "Chromium") },
      {
        browserName: "Microsoft Edge",
        rootPath: join(applicationSupport, "Microsoft Edge"),
      },
      {
        browserName: "Microsoft Edge Beta",
        rootPath: join(applicationSupport, "Microsoft Edge Beta"),
      },
      {
        browserName: "Microsoft Edge Dev",
        rootPath: join(applicationSupport, "Microsoft Edge Dev"),
      },
      {
        browserName: "Brave",
        rootPath: join(applicationSupport, "BraveSoftware", "Brave-Browser"),
      },
    ];
  }

  if (platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA?.trim() || "";
    if (localAppData.length === 0) {
      return [];
    }
    return [
      {
        browserName: "Google Chrome",
        rootPath: join(localAppData, "Google", "Chrome", "User Data"),
      },
      { browserName: "Chromium", rootPath: join(localAppData, "Chromium", "User Data") },
      {
        browserName: "Microsoft Edge",
        rootPath: join(localAppData, "Microsoft", "Edge", "User Data"),
      },
      {
        browserName: "Brave",
        rootPath: join(localAppData, "BraveSoftware", "Brave-Browser", "User Data"),
      },
    ];
  }

  const configRoot = join(home, ".config");
  return [
    { browserName: "Google Chrome", rootPath: join(configRoot, "google-chrome") },
    { browserName: "Google Chrome Beta", rootPath: join(configRoot, "google-chrome-beta") },
    { browserName: "Google Chrome Dev", rootPath: join(configRoot, "google-chrome-unstable") },
    { browserName: "Chromium", rootPath: join(configRoot, "chromium") },
    { browserName: "Microsoft Edge", rootPath: join(configRoot, "microsoft-edge") },
    { browserName: "Microsoft Edge Beta", rootPath: join(configRoot, "microsoft-edge-beta") },
    { browserName: "Microsoft Edge Dev", rootPath: join(configRoot, "microsoft-edge-dev") },
    { browserName: "Brave", rootPath: join(configRoot, "BraveSoftware", "Brave-Browser") },
  ];
}

export function listLocalChromeDebuggerEndpoints(
  platform: NodeJS.Platform = process.platform
): LocalChromeDebuggerEndpointDescriptor[] {
  const results: Array<LocalChromeDebuggerEndpointDescriptor & { updatedAt: number }> = [];

  for (const { browserName, rootPath } of buildBrowserUserDataRoots(platform)) {
    results.push(
      ...[
        readDevToolsActivePortFile(browserName, null, join(rootPath, "DevToolsActivePort")),
        ...(existsSync(rootPath)
          ? readdirSync(rootPath, { withFileTypes: true })
              .filter((entry) => entry.isDirectory() && PROFILE_DIRECTORY_PATTERN.test(entry.name))
              .map((entry) =>
                readDevToolsActivePortFile(
                  browserName,
                  entry.name,
                  join(rootPath, entry.name, "DevToolsActivePort")
                )
              )
          : []),
      ].filter(
        (entry): entry is LocalChromeDebuggerEndpointDescriptor & { updatedAt: number } =>
          entry !== null
      )
    );
  }

  const deduped = new Map<string, LocalChromeDebuggerEndpointDescriptor & { updatedAt: number }>();
  for (const result of results) {
    const existing = deduped.get(result.webSocketDebuggerUrl);
    if (!existing || existing.updatedAt < result.updatedAt) {
      deduped.set(result.webSocketDebuggerUrl, result);
    }
  }

  return Array.from(deduped.values())
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .map(({ updatedAt: _updatedAt, ...result }) => result);
}
