#!/usr/bin/env node

import { spawn } from "node:child_process";
import net from "node:net";
import { fileURLToPath } from "node:url";

const BASE_PORT = 5197;
const PORT_HOST = "127.0.0.1";
const PORT_MAX_ATTEMPTS = 20;
const PLAYWRIGHT_ARGS = [
  "-C",
  "tests/e2e",
  "exec",
  "playwright",
  "test",
  "src/code/design-system-fixture-smoke.spec.ts",
  "--project",
  "chromium",
  "--reporter=line",
];

export function parseFixtureSmokePort(rawPort) {
  if (!rawPort) {
    return null;
  }

  const trimmed = rawPort.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (Number.isNaN(parsed) || parsed <= 0 || parsed > 65_535) {
    return null;
  }

  return parsed;
}

export function buildFixtureSmokePortErrorMessage(startPort, error) {
  const nestedError =
    error && typeof error === "object" && "cause" in error && error.cause ? error.cause : error;
  const code =
    nestedError && typeof nestedError === "object" && "code" in nestedError
      ? String(nestedError.code)
      : "UNKNOWN";
  const detail =
    nestedError && typeof nestedError === "object" && "message" in nestedError
      ? String(nestedError.message)
      : String(nestedError);

  if (code === "EPERM") {
    return [
      `Design-system fixture smoke could not probe a local port near ${startPort}.`,
      `The current host denied local listen checks (${code}: ${detail}).`,
      "Set WEB_E2E_PORT to an already running dev server, or run the fixture smoke in an environment that allows localhost listeners.",
    ].join(" ");
  }

  return `Could not find a free port for the design-system fixture smoke near ${startPort} (${code}: ${detail}).`;
}

export function claimFixtureSmokePort(port, { host = PORT_HOST } = {}) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", (error) => {
      server.close();
      reject(error);
    });

    server.listen(port, host, () => {
      server.close(() => resolve(port));
    });
  });
}

export async function resolveFixtureSmokePort({
  env = process.env,
  basePort = BASE_PORT,
  maxAttempts = PORT_MAX_ATTEMPTS,
  claimPort = claimFixtureSmokePort,
  resolveAvailablePort: resolveAvailablePortImpl,
} = {}) {
  const configuredPort = parseFixtureSmokePort(env.WEB_E2E_PORT);
  if (configuredPort !== null) {
    return configuredPort;
  }

  try {
    if (resolveAvailablePortImpl) {
      return await resolveAvailablePortImpl(basePort, {
        host: PORT_HOST,
        maxAttempts,
      });
    }

    let lastError = null;
    for (let offset = 0; offset < maxAttempts; offset += 1) {
      const candidate = basePort + offset;
      if (candidate <= 0 || candidate > 65_535) {
        break;
      }

      try {
        return await claimPort(candidate, { host: PORT_HOST });
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error(`Failed to find an available port from ${basePort}.`);
  } catch (error) {
    throw new Error(buildFixtureSmokePortErrorMessage(basePort, error), {
      cause: error,
    });
  }
}

export async function main() {
  const port = await resolveFixtureSmokePort();

  const child = spawn("pnpm", PLAYWRIGHT_ARGS, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      WEB_E2E_PORT: String(port),
    },
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
}

const isEntrypoint = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;

if (isEntrypoint) {
  await main();
}
