import { spawn } from "node:child_process";
import { once } from "node:events";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildElectron } from "./build-electron.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(scriptDir, "..");
const workspaceDir = resolve(appDir, "../..");
const desktopPort = Number.parseInt(process.env.HUGECODE_T3_DESKTOP_PORT ?? "5297", 10);
const rendererUrl = `http://localhost:${desktopPort}/`;
const defaultRuntimeRpcEndpoint = "http://127.0.0.1:8788/rpc";
const pnpmBin = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

let runtimeProcess = null;

function writeDevServerError(error) {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
}

function writeDevServerWarning(message) {
  process.stderr.write(`${message}\n`);
}

function spawnChild(command, args, env = {}, cwd = appDir) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: "inherit",
  });

  child.on("error", writeDevServerError);

  return child;
}

function resolveRuntimeRpcEndpoint() {
  return process.env.HUGECODE_T3_RUNTIME_RPC_ENDPOINT?.trim() || defaultRuntimeRpcEndpoint;
}

function shouldManageRuntimeService(endpoint) {
  if (process.env.HUGECODE_T3_RUNTIME_RPC_ENDPOINT?.trim()) {
    return false;
  }
  try {
    const url = new URL(endpoint);
    return (
      url.protocol === "http:" &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost") &&
      url.port === "8788"
    );
  } catch {
    return false;
  }
}

async function probeRuntimeEndpoint(endpoint, timeoutMs = 1_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(endpoint, {
      method: "GET",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForRuntimeEndpoint(endpoint) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (await probeRuntimeEndpoint(endpoint)) {
      return;
    }
    await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 500));
  }

  throw new Error(`Timed out waiting for runtime service at ${endpoint}`);
}

async function ensureRuntimeService() {
  const endpoint = resolveRuntimeRpcEndpoint();
  if (await probeRuntimeEndpoint(endpoint)) {
    return;
  }
  if (!shouldManageRuntimeService(endpoint)) {
    writeDevServerWarning(`Runtime service is not reachable at ${endpoint}.`);
    return;
  }

  runtimeProcess = spawnChild(
    pnpmBin,
    ["--filter", "@ku0/code-runtime-service-rs", "dev"],
    {},
    workspaceDir
  );
  await waitForRuntimeEndpoint(endpoint);
}

async function waitForRenderer(url) {
  const deadline = Date.now() + 30_000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 250));
  }

  throw new Error(`Timed out waiting for ${url}: ${String(lastError)}`);
}

const viteProcess = spawnChild("node", [
  "./node_modules/vite/bin/vite.js",
  "--host",
  "::",
  "--port",
  String(desktopPort),
  "--strictPort",
]);

const shutdown = () => {
  if (!viteProcess.killed) {
    viteProcess.kill("SIGTERM");
  }
  if (runtimeProcess && !runtimeProcess.killed) {
    runtimeProcess.kill("SIGTERM");
  }
};

process.on("SIGINT", () => {
  shutdown();
  process.exit(130);
});

process.on("SIGTERM", () => {
  shutdown();
  process.exit(143);
});

try {
  const runtimeReady = ensureRuntimeService();
  await buildElectron();
  await runtimeReady;
  await waitForRenderer(rendererUrl);

  const electronProcess = spawnChild(pnpmBin, ["exec", "electron", "dist-electron/main.cjs"], {
    HUGECODE_T3_DESKTOP_DEV_SERVER_URL: rendererUrl,
  });

  const [exitCode] = await once(electronProcess, "exit");
  shutdown();
  process.exit(typeof exitCode === "number" ? exitCode : 0);
} catch (error) {
  shutdown();
  writeDevServerError(error);
  process.exit(1);
}
