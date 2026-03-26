#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadRootEnvLocal } from "./lib/load-env.mjs";
import { isPortAvailable, resolveAvailablePort } from "./lib/ports.mjs";

const HOST = "127.0.0.1";
const DEFAULT_RUNTIME_PORT = 8788;
// Bind the UI dev server on dual-stack localhost so Chrome can reach `http://localhost:5187`
// even when it prefers `::1` before `127.0.0.1`.
const DEFAULT_WEB_HOST = "::";
const DEFAULT_WEB_PORT = 5187;
// Cold Rust builds can spend most of the initial budget compiling the runtime
// before the health endpoint exists. Give the first launch more headroom by default.
const DEFAULT_RUNTIME_READY_TIMEOUT_MS = 240_000;
const CI_DEFAULT_RUNTIME_READY_TIMEOUT_MS = 900_000;
const MAX_PORT_SCAN = 200;
const HEALTHCHECK_TIMEOUT_MS = 1_200;
const RUNTIME_CAPABILITIES_TIMEOUT_MS = 1_500;
const RUNTIME_READY_TIMEOUT_MS = parseRuntimeReadyTimeout(
  process.env.CODE_RUNTIME_SERVICE_READY_TIMEOUT_MS
);
const RUNTIME_READY_POLL_MS = 300;
const CHILD_SHUTDOWN_GRACE_MS = 2_000;
const RUNTIME_REUSE_REQUIRED_METHODS_FALLBACK = [
  "code_rpc_capabilities",
  "code_workspaces_list",
  "code_threads_list",
  "code_turn_send",
  "code_cli_sessions_list",
];
const RUNTIME_DEV_SCRIPT_PATH = fileURLToPath(
  new URL("../packages/code-runtime-service-rs/scripts/dev.mjs", import.meta.url)
);
const CODE_APP_DIR = fileURLToPath(new URL("../apps/code", import.meta.url));
const CODE_APP_VITE_ENTRY_PATH = fileURLToPath(
  new URL("../apps/code/node_modules/vite/bin/vite.js", import.meta.url)
);

export function resolveCodeAppViteEntryPath() {
  return CODE_APP_VITE_ENTRY_PATH;
}

loadRootEnvLocal(import.meta.url);

export function resolveDefaultRuntimeReadyTimeout(env = process.env) {
  const ciValue = env.CI?.trim().toLowerCase();
  return ciValue && ciValue !== "0" && ciValue !== "false"
    ? CI_DEFAULT_RUNTIME_READY_TIMEOUT_MS
    : DEFAULT_RUNTIME_READY_TIMEOUT_MS;
}

function parseRuntimePort(rawPort) {
  const parsed = Number(rawPort ?? DEFAULT_RUNTIME_PORT);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65_535) {
    return DEFAULT_RUNTIME_PORT;
  }
  return parsed;
}

export function parseRuntimeReadyTimeout(rawTimeoutMs, env = process.env) {
  const defaultTimeoutMs = resolveDefaultRuntimeReadyTimeout(env);
  const parsed = Number(rawTimeoutMs ?? defaultTimeoutMs);
  if (!Number.isInteger(parsed) || parsed < 10_000 || parsed > 10 * 60_000) {
    return defaultTimeoutMs;
  }
  return parsed;
}

function parseWebPort(rawPort) {
  const parsed = Number(rawPort ?? DEFAULT_WEB_PORT);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65_535) {
    return DEFAULT_WEB_PORT;
  }
  return parsed;
}

function resolveWebDevHost() {
  const rawHost =
    process.env.WEB_E2E_HOST?.trim() ||
    process.env.CODE_RUNTIME_WEB_HOST?.trim() ||
    DEFAULT_WEB_HOST;
  return rawHost.length > 0 ? rawHost : DEFAULT_WEB_HOST;
}

function resolveWebDevPort() {
  return parseWebPort(process.env.WEB_E2E_PORT ?? process.env.CODE_RUNTIME_WEB_PORT);
}

function runtimeRpcEndpoint(port) {
  return `http://${HOST}:${port}/rpc`;
}

function runtimeEventsEndpoint(port) {
  return `http://${HOST}:${port}/events`;
}

function runtimeWsEndpoint(port) {
  return `ws://${HOST}:${port}/ws`;
}

function runtimeHealthEndpoint(port) {
  return `http://${HOST}:${port}/health`;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readNonEmptyString(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeWorkspacePathForReuse(workspacePath) {
  const normalizedInput = readNonEmptyString(workspacePath);
  if (!normalizedInput) {
    return null;
  }

  let normalized = normalizedInput.replace(/^\\\\\?\\UNC\\/i, "\\\\").replace(/^\\\\\?\\/i, "");
  normalized = path.normalize(normalized);
  const looksLikeWindowsPath = /^[a-z]:[\\/]/i.test(normalized) || normalized.startsWith("\\\\");
  if (process.platform === "win32" || looksLikeWindowsPath) {
    normalized = normalized.replace(/\\/g, "/").toLowerCase();
  }
  if (normalized.length > 1) {
    normalized = normalized.replace(/[\\/]+$/, "");
  }
  return normalized;
}

export function findDefaultWorkspacePath(workspaces) {
  if (!Array.isArray(workspaces)) {
    return null;
  }
  const defaultWorkspace = workspaces.find((entry) => {
    if (!isRecord(entry)) {
      return false;
    }
    return entry.id === "workspace-web" || entry.displayName === "Web Workspace";
  });
  return readNonEmptyString(defaultWorkspace?.path);
}

export function runtimeDefaultWorkspaceMatchesExpected(workspaces, expectedWorkspacePath) {
  const normalizedExpected = normalizeWorkspacePathForReuse(expectedWorkspacePath);
  if (!normalizedExpected) {
    return true;
  }
  const runtimeDefaultWorkspacePath = findDefaultWorkspacePath(workspaces);
  if (!runtimeDefaultWorkspacePath) {
    return false;
  }
  return normalizeWorkspacePathForReuse(runtimeDefaultWorkspacePath) === normalizedExpected;
}

export async function loadLocalRuntimeContractFingerprint() {
  try {
    const specsDirUrl = new URL("../docs/runtime/spec/", import.meta.url);
    const specFiles = (await readdir(specsDirUrl)).filter((entry) =>
      /^code-runtime-rpc-spec\..+\.json$/i.test(entry)
    );
    if (specFiles.length === 0) {
      return null;
    }

    specFiles.sort((left, right) => right.localeCompare(left));
    const latestSpecUrl = new URL(specFiles[0], specsDirUrl);
    const latestSpecRaw = await readFile(latestSpecUrl, "utf8");
    const latestSpec = JSON.parse(latestSpecRaw);
    const rpc = isRecord(latestSpec?.rpc) ? latestSpec.rpc : null;
    if (!rpc) {
      return null;
    }

    const methodSetHash = readNonEmptyString(rpc.methodSetHash);
    if (!methodSetHash) {
      return null;
    }

    const methods = Array.isArray(rpc.methods)
      ? rpc.methods.filter((entry) => typeof entry === "string")
      : [];
    const requiredMethods = RUNTIME_REUSE_REQUIRED_METHODS_FALLBACK.filter((method) =>
      methods.includes(method)
    );

    return {
      methodSetHash,
      requiredMethods:
        requiredMethods.length > 0 ? requiredMethods : RUNTIME_REUSE_REQUIRED_METHODS_FALLBACK,
    };
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url, timeoutMs, init = undefined) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function isRuntimeServiceListening(port) {
  try {
    const response = await fetchWithTimeout(runtimeHealthEndpoint(port), HEALTHCHECK_TIMEOUT_MS);
    if (!response.ok) {
      return false;
    }
    const payload = await response.json().catch(() => null);
    return payload?.app === "code-runtime-service-rs";
  } catch {
    return false;
  }
}

async function probeRuntimeReuseCompatibility(port, localFingerprint, expectedWorkspacePath) {
  try {
    const response = await fetchWithTimeout(
      runtimeRpcEndpoint(port),
      RUNTIME_CAPABILITIES_TIMEOUT_MS,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          method: "code_rpc_capabilities",
          params: {},
        }),
      }
    );
    if (!response.ok) {
      return {
        compatible: false,
        reason: `rpc status ${response.status}`,
        missingMethods: [],
      };
    }

    const payload = await response.json().catch(() => null);
    if (!isRecord(payload)) {
      return {
        compatible: false,
        reason: "rpc payload is not an object",
        missingMethods: [],
      };
    }

    const result = isRecord(payload.result) ? payload.result : null;
    if (!result) {
      return {
        compatible: false,
        reason: "rpc capabilities payload missing `result` object",
        missingMethods: [],
      };
    }

    const runtimeMethodSetHash = readNonEmptyString(result.methodSetHash);
    if (localFingerprint?.methodSetHash) {
      if (!runtimeMethodSetHash) {
        return {
          compatible: false,
          reason: "rpc capabilities payload missing `methodSetHash`",
          missingMethods: [],
        };
      }
      if (runtimeMethodSetHash !== localFingerprint.methodSetHash) {
        return {
          compatible: false,
          reason: `methodSetHash mismatch (runtime=${runtimeMethodSetHash}, local=${localFingerprint.methodSetHash})`,
          missingMethods: [],
        };
      }
    }

    const methods = Array.isArray(result.methods)
      ? result.methods.filter((method) => typeof method === "string")
      : [];
    if (methods.length === 0) {
      return {
        compatible: false,
        reason: "rpc capabilities payload missing `methods`",
        missingMethods: [],
      };
    }

    const requiredMethods =
      localFingerprint?.requiredMethods ?? RUNTIME_REUSE_REQUIRED_METHODS_FALLBACK;
    const missingMethods = requiredMethods.filter((method) => !methods.includes(method));
    if (missingMethods.length > 0) {
      return {
        compatible: false,
        reason: "missing required methods",
        missingMethods,
      };
    }

    if (normalizeWorkspacePathForReuse(expectedWorkspacePath)) {
      const workspaceListResponse = await fetchWithTimeout(
        runtimeRpcEndpoint(port),
        RUNTIME_CAPABILITIES_TIMEOUT_MS,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            method: "code_workspaces_list",
            params: {},
          }),
        }
      );
      if (!workspaceListResponse.ok) {
        return {
          compatible: false,
          reason: `workspace list status ${workspaceListResponse.status}`,
          missingMethods: [],
        };
      }

      const workspaceListPayload = await workspaceListResponse.json().catch(() => null);
      const workspaces = Array.isArray(workspaceListPayload?.result)
        ? workspaceListPayload.result
        : [];
      if (!runtimeDefaultWorkspaceMatchesExpected(workspaces, expectedWorkspacePath)) {
        return {
          compatible: false,
          reason: `default workspace path mismatch (runtime=${findDefaultWorkspacePath(workspaces) ?? "unknown"}, local=${expectedWorkspacePath})`,
          missingMethods: [],
        };
      }
    }

    return {
      compatible: true,
      reason: "ok",
      missingMethods: [],
    };
  } catch (error) {
    return {
      compatible: false,
      reason: error instanceof Error ? error.message : String(error),
      missingMethods: [],
    };
  }
}

function spawnManagedCommand(command, args, options = {}) {
  const { cwd = process.cwd(), envOverrides = {} } = options;
  return spawn(command, args, {
    cwd,
    env: { ...process.env, ...envOverrides },
    stdio: "inherit",
    detached: false,
    shell: process.platform === "win32" && command.endsWith(".cmd"),
  });
}

function writeStderrLine(message) {
  process.stderr.write(`${message}\n`);
}

function writeStderrError(prefix, error) {
  const detail =
    error instanceof Error ? (error.stack ?? error.message) : String(error ?? "Unknown error");
  writeStderrLine(`${prefix}${detail ? `\n${detail}` : ""}`);
}

function toExitCode(code, signal) {
  if (typeof code === "number") {
    return code;
  }
  if (signal) {
    return 1;
  }
  return 0;
}

async function waitForRuntimeReady(port, runtimeProcess) {
  const start = Date.now();
  while (Date.now() - start < RUNTIME_READY_TIMEOUT_MS) {
    if (runtimeProcess.exitCode !== null || runtimeProcess.signalCode !== null) {
      const exitCode = toExitCode(runtimeProcess.exitCode, runtimeProcess.signalCode);
      throw new Error(`Runtime service exited before becoming ready (exit ${exitCode}).`);
    }
    if (await isRuntimeServiceListening(port)) {
      return;
    }
    await delay(RUNTIME_READY_POLL_MS);
  }
  throw new Error(
    `Runtime service did not become ready on ${HOST}:${port} within ${RUNTIME_READY_TIMEOUT_MS}ms.`
  );
}

function createShutdownState() {
  return {
    shuttingDown: false,
    completed: false,
    runtimeManaged: false,
    runtimeProcess: null,
    webProcess: null,
  };
}

function terminateChild(child, signal = "SIGTERM") {
  if (!child) {
    return;
  }
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  const escalateKill = () => {
    if (child.exitCode !== null || child.signalCode !== null) {
      return;
    }
    if (process.platform !== "win32" && typeof child.pid === "number" && child.pid > 0) {
      try {
        process.kill(-child.pid, "SIGKILL");
        return;
      } catch {
        // Fallback to single-process kill below.
      }
    }
    child.kill("SIGKILL");
  };

  if (process.platform !== "win32" && typeof child.pid === "number" && child.pid > 0) {
    try {
      process.kill(-child.pid, signal);
    } catch {
      child.kill(signal);
    }
    setTimeout(escalateKill, CHILD_SHUTDOWN_GRACE_MS).unref();
    return;
  }

  child.kill(signal);
  setTimeout(escalateKill, CHILD_SHUTDOWN_GRACE_MS).unref();
}

function shutdown(state, signal = "SIGTERM") {
  if (state.shuttingDown) {
    return;
  }
  state.shuttingDown = true;
  terminateChild(state.webProcess, signal);
  if (state.runtimeManaged) {
    terminateChild(state.runtimeProcess, signal);
  }
}

function finalize(state, code) {
  if (state.completed) {
    return;
  }
  state.completed = true;
  shutdown(state);
  process.exitCode = code;
  // Ensure the parent process exits even if a child ignores SIGTERM.
  setTimeout(() => {
    process.exit(code);
  }, 120).unref();
}

async function main() {
  const state = createShutdownState();
  const preferredPort = parseRuntimePort(process.env.CODE_RUNTIME_SERVICE_PORT);
  const defaultWorkspacePath =
    process.env.CODE_RUNTIME_SERVICE_DEFAULT_WORKSPACE_PATH ?? process.cwd();
  const localFingerprint = await loadLocalRuntimeContractFingerprint();

  process.on("SIGINT", () => finalize(state, 130));
  process.on("SIGTERM", () => finalize(state, 143));
  process.on("SIGHUP", () => finalize(state, 129));

  try {
    let runtimePort = preferredPort;
    let shouldSpawnRuntime = true;
    const preferredPortAvailable = await isPortAvailable(preferredPort, { host: HOST });

    if (!preferredPortAvailable) {
      if (await isRuntimeServiceListening(preferredPort)) {
        const compatibility = await probeRuntimeReuseCompatibility(
          preferredPort,
          localFingerprint,
          defaultWorkspacePath
        );
        if (compatibility.compatible) {
          shouldSpawnRuntime = false;
          state.runtimeManaged = false;
        } else {
          runtimePort = await resolveAvailablePort(preferredPort + 1, {
            host: HOST,
            maxAttempts: MAX_PORT_SCAN,
          });
          const methodDetail =
            compatibility.missingMethods.length > 0
              ? `missing methods: ${compatibility.missingMethods.join(", ")}`
              : compatibility.reason;
          writeStderrLine(
            `[dev:code] Existing runtime on ${HOST}:${preferredPort} is incompatible; starting a new runtime on ${HOST}:${runtimePort} (${methodDetail}).`
          );
        }
      } else {
        runtimePort = await resolveAvailablePort(preferredPort + 1, {
          host: HOST,
          maxAttempts: MAX_PORT_SCAN,
        });
      }
    }

    if (shouldSpawnRuntime) {
      state.runtimeManaged = true;

      state.runtimeProcess = spawnManagedCommand(process.execPath, [RUNTIME_DEV_SCRIPT_PATH], {
        envOverrides: {
          CODE_RUNTIME_SERVICE_PORT: String(runtimePort),
          CODE_RUNTIME_SERVICE_TURNS_USE_LOCAL_CODEX_EXEC:
            process.env.CODE_RUNTIME_SERVICE_TURNS_USE_LOCAL_CODEX_EXEC ?? "0",
          CODE_RUNTIME_SERVICE_DEFAULT_WORKSPACE_PATH: defaultWorkspacePath,
        },
      });

      state.runtimeProcess.once("exit", (code, signal) => {
        if (state.completed) {
          return;
        }
        const exitCode = toExitCode(code, signal);

        finalize(state, exitCode === 0 ? 1 : exitCode);
      });
      state.runtimeProcess.once("error", (error) => {
        if (state.completed) {
          return;
        }
        writeStderrError("[dev:code] Runtime process failed to start.", error);

        finalize(state, 1);
      });

      await waitForRuntimeReady(runtimePort, state.runtimeProcess);
    }

    const endpoint = runtimeRpcEndpoint(runtimePort);
    const eventsEndpoint = runtimeEventsEndpoint(runtimePort);
    const wsEndpoint = runtimeWsEndpoint(runtimePort);
    writeStderrLine(
      `[dev:code] Runtime endpoints rpc=${endpoint} health=${runtimeHealthEndpoint(runtimePort)} events=${eventsEndpoint} ws=${wsEndpoint}`
    );
    const webHost = resolveWebDevHost();
    const preferredWebPort = resolveWebDevPort();
    let webPort = preferredWebPort;
    if (!(await isPortAvailable(preferredWebPort, { host: webHost }))) {
      webPort = await resolveAvailablePort(preferredWebPort + 1, {
        host: webHost,
        maxAttempts: MAX_PORT_SCAN,
      });
      writeStderrLine(
        `[dev:code] Web dev port ${webHost}:${preferredWebPort} is busy; starting on ${webHost}:${webPort}.`
      );
    }

    state.webProcess = spawnManagedCommand(
      process.execPath,
      [resolveCodeAppViteEntryPath(), "--host", webHost, "--port", String(webPort), "--strictPort"],
      {
        cwd: CODE_APP_DIR,
        envOverrides: {
          VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT: endpoint,
          VITE_CODE_RUNTIME_GATEWAY_WEB_EVENTS_ENDPOINT: eventsEndpoint,
          VITE_CODE_RUNTIME_GATEWAY_WEB_WS_ENDPOINT: wsEndpoint,
        },
      }
    );
    state.webProcess.once("error", (error) => {
      if (state.completed) {
        return;
      }
      writeStderrError("[dev:code] Web dev server failed to start.", error);

      finalize(state, 1);
    });

    state.webProcess.once("exit", (code, signal) => {
      if (state.completed) {
        return;
      }
      finalize(state, toExitCode(code, signal));
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeStderrLine(`[dev:code] Startup failed: ${message}`);

    finalize(state, 1);
  }
}

const isDirectExecution =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirectExecution) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    writeStderrLine(`[dev:code] Unhandled startup failure: ${message}`);

    process.exit(1);
  });
}
