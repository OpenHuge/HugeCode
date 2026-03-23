#!/usr/bin/env node

import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { resolveAvailablePort } from "./lib/ports.mjs";
import {
  buildRuntimeReplayReport,
  compileRuntimeReplayFixture,
  createRuntimeReplaySelection,
  loadRuntimeReplayDataset,
  parseRuntimeReplayFilters,
  selectRuntimeReplaySamples,
  validateRuntimeReplayDataset,
  writeJson,
} from "./lib/runtimeReplayDataset.mjs";

const repoRoot = process.cwd();
const playwrightBin = path.join(
  repoRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "playwright.cmd" : "playwright"
);
const DEFAULT_WEB_E2E_PORT = 5187;
const DEFAULT_RUNTIME_PORT = 8788;
const LOCAL_HOST = "127.0.0.1";
const DEFAULT_REPORT_PATH = path.join(
  repoRoot,
  "artifacts",
  "runtime-replay",
  "runtime-core-report.json"
);
const DEFAULT_RUNTIME_READY_TIMEOUT_MS = 240_000;
const DEFAULT_REPLAY_CARGO_TARGET_DIR = path.join(os.tmpdir(), "hypecode-runtime-replay-cargo");

function parseTimeoutMs(rawValue, fallbackMs) {
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed < 10_000 || parsed > 10 * 60_000) {
    return fallbackMs;
  }
  return parsed;
}

export function resolveManagedWebReadyTimeoutMs(env = process.env) {
  const runtimeReadyTimeoutMs = parseTimeoutMs(
    env.CODE_RUNTIME_SERVICE_READY_TIMEOUT_MS,
    DEFAULT_RUNTIME_READY_TIMEOUT_MS
  );
  const explicitWebReadyTimeoutMs = env.CODE_RUNTIME_REPLAY_WEB_READY_TIMEOUT_MS;
  if (explicitWebReadyTimeoutMs) {
    return parseTimeoutMs(explicitWebReadyTimeoutMs, runtimeReadyTimeoutMs + 30_000);
  }
  // The managed launcher waits for the Rust runtime to compile and become healthy
  // before it even spawns the Vite server. Keep the parent budget above that cold-start path.
  return Math.max(180_000, runtimeReadyTimeoutMs + 30_000);
}

const DEFAULT_WEB_READY_TIMEOUT_MS = resolveManagedWebReadyTimeoutMs();

function writeStdout(text) {
  if (text) {
    process.stdout.write(text);
  }
}

function writeStderr(text) {
  if (text) {
    process.stderr.write(text);
  }
}

export function buildRuntimeReplayExecutionEnv({
  runtimePort,
  webPort,
  compiledFixturePath,
  selectionPath,
  workspaceRoot,
  playwrightJsonPath,
  baseEnv,
}) {
  const inheritedEnv = baseEnv ?? process.env;
  const replayCargoTargetDir =
    inheritedEnv.CODE_RUNTIME_REPLAY_CARGO_TARGET_DIR ??
    inheritedEnv.CARGO_TARGET_DIR ??
    DEFAULT_REPLAY_CARGO_TARGET_DIR;
  const env = {
    ...inheritedEnv,
    WEB_E2E_HOST: LOCAL_HOST,
    CODE_RUNTIME_WEB_HOST: LOCAL_HOST,
    WEB_E2E_PORT: String(webPort),
    CODE_RUNTIME_SERVICE_PORT: String(runtimePort),
    CARGO_TARGET_DIR: replayCargoTargetDir,
    CODE_RUNTIME_SERVICE_PROVIDER_REPLAY_FILE: compiledFixturePath,
    CODE_RUNTIME_SERVICE_PROVIDER_REPLAY_MAX_DELAY_MS:
      inheritedEnv.CODE_RUNTIME_SERVICE_PROVIDER_REPLAY_MAX_DELAY_MS ?? "250",
    CODE_RUNTIME_DIAGNOSTICS_EXPORT_ENABLED:
      inheritedEnv.CODE_RUNTIME_DIAGNOSTICS_EXPORT_ENABLED ?? "1",
    CODE_RUNTIME_SERVICE_TURN_DELTA_COALESCE_ENABLED:
      inheritedEnv.CODE_RUNTIME_SERVICE_TURN_DELTA_COALESCE_ENABLED ?? "0",
    CODE_RUNTIME_SERVICE_DEFAULT_WORKSPACE_PATH: workspaceRoot,
    CODE_RUNTIME_REPLAY_SELECTION_FILE: selectionPath,
    CODE_RUNTIME_REPLAY_WORKSPACE_ROOT: workspaceRoot,
    CODE_RUNTIME_REPLAY_RPC_ENDPOINT: `http://${LOCAL_HOST}:${runtimePort}/rpc`,
    CODE_RUNTIME_REPLAY_HEALTH_ENDPOINT: `http://${LOCAL_HOST}:${runtimePort}/health`,
    PW_SKIP_WEBSERVER: "1",
    PW_REUSE_WEBSERVER: "0",
    VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT: `http://${LOCAL_HOST}:${runtimePort}/rpc`,
    PLAYWRIGHT_JSON_OUTPUT_NAME: playwrightJsonPath,
  };
  if (env.FORCE_COLOR) {
    delete env.NO_COLOR;
  }
  return env;
}

async function requestStatus(url, timeoutMs) {
  const target = new URL(url);
  const transport = target.protocol === "https:" ? https : http;
  return await new Promise((resolve, reject) => {
    const request = transport.request(
      target,
      {
        method: "GET",
        timeout: timeoutMs,
      },
      (response) => {
        const statusCode = response.statusCode ?? 0;
        response.resume();
        resolve(statusCode);
      }
    );
    request.on("timeout", () => {
      request.destroy(new Error(`Timed out requesting ${url}`));
    });
    request.on("error", reject);
    request.end();
  });
}

async function requestJson(url, timeoutMs) {
  const response = await fetch(url, {
    method: "GET",
    signal: AbortSignal.timeout(timeoutMs),
  });
  return {
    ok: response.ok,
    status: response.status,
    json: await response.json().catch(() => null),
  };
}

function createManagedWebServerState(child, expectedUrl) {
  const state = {
    ready: false,
    observedUrl: null,
  };
  const expected = expectedUrl.replace(/\/$/u, "");

  const handleText = (text) => {
    const match = text.match(/Local:\s+(https?:\/\/[^\s]+)/u);
    if (!match) {
      return;
    }
    state.observedUrl = match[1].replace(/\/$/u, "");
    if (state.observedUrl === expected) {
      state.ready = true;
    }
  };

  child.stdout?.on("data", (chunk) => {
    const text = chunk.toString();
    writeStdout(text);
    handleText(text);
  });
  child.stderr?.on("data", (chunk) => {
    const text = chunk.toString();
    writeStderr(text);
    handleText(text);
  });

  return state;
}

async function waitForWebServer(url, child, state, timeoutMs = DEFAULT_WEB_READY_TIMEOUT_MS) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Managed runtime replay web server exited before ${url} became ready.`);
    }
    if (state.ready) {
      return;
    }
    try {
      const status = await requestStatus(url, 1_500);
      if (status > 0 && status < 500) {
        return;
      }
    } catch {
      // Keep polling until timeout.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Timed out waiting for managed runtime replay web server at ${url}.`);
}

async function waitForRuntimeHealth(url, timeoutMs = 30_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await requestJson(url, 1_500);
      if (response.ok && response.json?.app === "code-runtime-service-rs") {
        return;
      }
    } catch {
      // keep polling until timeout
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Timed out waiting for runtime replay health endpoint at ${url}.`);
}

async function stopManagedWebServer(child) {
  if (!child) {
    return;
  }
  await new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      child.stdout?.destroy();
      child.stderr?.destroy();
      resolve(undefined);
    };
    child.once("exit", finish);
    child.kill("SIGTERM");
    setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
      }
      setTimeout(finish, 500);
    }, 2_000);
  });
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const separatorIndex = rawArgs.indexOf("--");
  const datasetArgs = separatorIndex >= 0 ? rawArgs.slice(0, separatorIndex) : rawArgs;
  const playwrightArgs = separatorIndex >= 0 ? rawArgs.slice(separatorIndex + 1) : [];
  const filters = parseRuntimeReplayFilters(datasetArgs);
  if (filters.families.length === 0) {
    filters.families.push("runtime-core");
  }
  if (filters.stabilities.length === 0) {
    filters.stabilities.push("golden");
  }

  const dataset = loadRuntimeReplayDataset({ manifestPath: filters.manifestPath });
  const validation = validateRuntimeReplayDataset(dataset, {
    requireRecorded: filters.requireRecorded,
    requireCoverageMatrixSatisfaction: true,
  });
  if (validation.errors.length > 0) {
    for (const error of validation.errors) {
      writeStderr(`error: ${error}\n`);
    }
    process.exit(1);
  }
  for (const warning of validation.warnings) {
    writeStdout(`warning: ${warning}\n`);
  }

  const selectedSamples = selectRuntimeReplaySamples(dataset, filters);
  if (selectedSamples.length === 0) {
    writeStderr("error: No runtime replay samples matched the requested filters.\n");
    process.exit(1);
  }

  const fixture = compileRuntimeReplayFixture(dataset, selectedSamples);
  const selection = createRuntimeReplaySelection(selectedSamples);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "runtime-replay-"));
  const compiledFixturePath = path.join(tempDir, "compiled-provider-replay.json");
  const selectionPath = path.join(tempDir, "selection.json");
  const playwrightJsonPath = path.join(tempDir, "playwright.json");
  const workspaceRoot = path.join(tempDir, "workspace");
  const reportPath = path.isAbsolute(filters.outputReportPath ?? DEFAULT_REPORT_PATH)
    ? (filters.outputReportPath ?? DEFAULT_REPORT_PATH)
    : path.resolve(repoRoot, filters.outputReportPath ?? DEFAULT_REPORT_PATH);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.mkdirSync(workspaceRoot, { recursive: true });
  writeJson(compiledFixturePath, fixture);
  writeJson(selectionPath, selection);

  const runtimePort = await resolveAvailablePort(DEFAULT_RUNTIME_PORT, {
    host: LOCAL_HOST,
    maxAttempts: 200,
  });
  const webPort = await resolveAvailablePort(DEFAULT_WEB_E2E_PORT, {
    host: LOCAL_HOST,
    maxAttempts: 200,
  });

  const env = buildRuntimeReplayExecutionEnv({
    runtimePort,
    webPort,
    compiledFixturePath,
    selectionPath,
    workspaceRoot,
    playwrightJsonPath,
    baseEnv: process.env,
  });

  const managedWebServer = spawn("node", ["scripts/dev-code-runtime-gateway-web-all.mjs"], {
    cwd: repoRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
    shell: process.platform === "win32",
  });
  const managedWebServerState = createManagedWebServerState(
    managedWebServer,
    `http://${LOCAL_HOST}:${webPort}`
  );

  let result;
  try {
    await waitForWebServer(
      `http://${LOCAL_HOST}:${webPort}`,
      managedWebServer,
      managedWebServerState
    );
    await waitForRuntimeHealth(env.CODE_RUNTIME_REPLAY_HEALTH_ENDPOINT);
    result = spawnSync(
      playwrightBin,
      ["test", "src/code/runtime-core-replay.spec.ts", "--reporter=line,json", ...playwrightArgs],
      {
        cwd: path.join(repoRoot, "tests", "e2e"),
        env,
        encoding: "utf8",
        shell: process.platform === "win32",
      }
    );
  } finally {
    await stopManagedWebServer(managedWebServer);
  }

  writeStdout(result.stdout);
  writeStderr(result.stderr);

  const playwrightJson = fs.existsSync(playwrightJsonPath)
    ? JSON.parse(fs.readFileSync(playwrightJsonPath, "utf8"))
    : null;
  const combinedLogs = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const report = buildRuntimeReplayReport({
    dataset,
    selectedSamples,
    playwrightJson,
    combinedLogs,
  });
  writeJson(reportPath, report);
  writeStdout(`Runtime replay report: ${reportPath}\n`);

  const hardFailure = !report.hardAssertions.passed;
  if (hardFailure) {
    for (const failure of report.hardAssertions.failures) {
      writeStderr(`hard-failure: ${failure}\n`);
    }
  }
  for (const warning of report.softAssertions.warnings) {
    writeStdout(`soft-warning: ${warning}\n`);
  }

  if (result.error) {
    process.exit(1);
  }
  if ((result.status ?? 1) !== 0 || hardFailure) {
    process.exit((result.status ?? 1) || 1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
