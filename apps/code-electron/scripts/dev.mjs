import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { createDevServerUrl, resolveAvailableDevServerPort } from "./dev-server.mjs";

const scriptDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
const packageDir = resolve(scriptDir, "..");
const electronEntrypoint = resolve(packageDir);
const electronBinary = resolve(packageDir, "../../node_modules/.bin/electron");
const children = [];

function spawnProcess(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: packageDir,
    stdio: "inherit",
    shell: false,
    ...options,
  });
  children.push(child);
  return child;
}

async function waitForDevServer(url, attempts = 60) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until the renderer dev server becomes reachable.
    }

    await delay(1_000);
  }

  throw new Error(`Timed out waiting for renderer dev server at ${url}`);
}

function terminateChildren() {
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
}

process.on("SIGINT", () => {
  terminateChildren();
  process.exit(130);
});

process.on("SIGTERM", () => {
  terminateChildren();
  process.exit(143);
});

const rendererPort = await resolveAvailableDevServerPort();
const devServerUrl = createDevServerUrl(rendererPort);

const rendererProcess = spawnProcess("pnpm", [
  "-C",
  "../code",
  "exec",
  "vite",
  "--host",
  "127.0.0.1",
  "--port",
  String(rendererPort),
  "--strictPort",
]);

rendererProcess.once("exit", (code) => {
  if (code !== 0) {
    terminateChildren();
    process.exit(code ?? 1);
  }
});

await waitForDevServer(devServerUrl);

const mainBuildProcess = spawnProcess("pnpm", ["run", "build:main"]);
const mainBuildExitCode = await new Promise((resolveExitCode) => {
  mainBuildProcess.once("exit", (code) => {
    resolveExitCode(code ?? 1);
  });
});

if (mainBuildExitCode !== 0) {
  terminateChildren();
  process.exit(mainBuildExitCode);
}

const electronEnv = {
  ...process.env,
  HUGECODE_ELECTRON_DEV_SERVER_URL: devServerUrl,
};
delete electronEnv.ELECTRON_RUN_AS_NODE;

const electronProcess = spawnProcess(electronBinary, [electronEntrypoint], {
  env: electronEnv,
});

const electronExitCode = await new Promise((resolveExitCode) => {
  electronProcess.once("exit", (code) => {
    resolveExitCode(code ?? 0);
  });
});

terminateChildren();
process.exit(electronExitCode);
