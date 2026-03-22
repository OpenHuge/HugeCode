import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { loadLocalRuntimeContractFingerprint } from "./dev-code-runtime-gateway-web-all.mjs";
import { loadE2EMapConfig, ruleMatchesPath } from "./lib/e2e-map.mjs";
import { isPortAvailable } from "./lib/ports.mjs";
import { spawnPnpm, spawnPnpmSync } from "./lib/spawn-pnpm.mjs";

const category = process.argv[2]?.trim().toLowerCase();
const rawArgs = process.argv.slice(3);
const separatorIndex = rawArgs.indexOf("--");
const playwrightArgs = separatorIndex >= 0 ? rawArgs.slice(separatorIndex + 1) : rawArgs;

if (!category) {
  process.exit(1);
}

const DEFAULT_WEB_E2E_PORT = "5187";
const CATEGORY_PORT_OFFSET = {
  core: 0,
  blocks: 20,
  collab: 40,
  annotations: 60,
  features: 80,
  smoke: 100,
  a11y: 120,
};
const PORT_LOCK_DIR = path.join(".tmp", "e2e-port-locks");
const PORT_LOCK_STALE_MS = 60 * 60 * 1000;
const PERSISTENT_SERVER_METADATA_DIR = path.join(".tmp", "e2e-dev-servers");
const WEB_E2E_HOST = "127.0.0.1";
const DEFAULT_PERSISTENT_SERVER_TIMEOUT_MS = 120_000;
const DEFAULT_CODE_PERSISTENT_SERVER_TIMEOUT_MS = 300_000;
const PERSISTENT_SERVER_LOG_DIR = path.join(PERSISTENT_SERVER_METADATA_DIR, "logs");
const MAX_PERSISTENT_SERVER_LOG_TAIL_BYTES = 32 * 1024;
const RUNTIME_ENDPOINT_LOG_PATTERN =
  /\[dev:code\] Runtime endpoints rpc=(\S+) health=(\S+) events=(\S+) ws=(\S+)/g;
const activePortReleases = new Set();
const usePersistentDevServer = !process.env.CI && process.env.E2E_PERSIST_DEV_SERVER !== "false";

function toPosixPath(filePath) {
  return filePath.split(path.sep).join("/");
}

function releaseAllPortReservations() {
  for (const release of Array.from(activePortReleases)) {
    try {
      release();
    } catch {
      // Best effort cleanup on process teardown.
    } finally {
      activePortReleases.delete(release);
    }
  }
}

function registerPortReservationCleanupHooks() {
  const handleSignal = (exitCode) => {
    releaseAllPortReservations();
    process.exit(exitCode);
  };

  process.on("exit", () => {
    releaseAllPortReservations();
  });
  process.on("SIGINT", () => {
    handleSignal(130);
  });
  process.on("SIGTERM", () => {
    handleSignal(143);
  });
}

registerPortReservationCleanupHooks();

function hasPlaywrightWorkersOverride(args) {
  return args.some((arg) => arg === "--workers" || arg === "-j" || arg.startsWith("--workers="));
}

function resolvePlaywrightArgsForCategory(categoryName, args) {
  if (
    (categoryName !== "core" && categoryName !== "features" && categoryName !== "smoke") ||
    hasPlaywrightWorkersOverride(args)
  ) {
    return args;
  }
  // Keep live-runtime categories deterministic by default.
  return [...args, "--workers=1"];
}

const repoRoot = process.cwd();
const e2eRoot = path.join(repoRoot, "tests", "e2e");
const e2eSrc = path.join(e2eRoot, "src");
const e2eConfig = loadE2EMapConfig({ repoRoot });
const categoryRules = e2eConfig.rules.filter((rule) => rule.category === category);

if (!e2eConfig.categories.includes(category)) {
  process.exit(1);
}

if (!fs.existsSync(e2eSrc)) {
  process.exit(1);
}

const specFiles = collectSpecFiles(e2eSrc);
const matchingSpecs = specFiles.filter((filePath) => {
  const normalizedRelativePath = path
    .relative(e2eSrc, filePath)
    .split(path.sep)
    .join("/")
    .toLowerCase();
  return categoryRules.some((rule) => ruleMatchesPath(rule, normalizedRelativePath));
});

if (matchingSpecs.length === 0) {
  process.exit(0);
}

const runsByTarget = groupSpecsByTarget(matchingSpecs, e2eSrc);
const resolvedPlaywrightArgs = resolvePlaywrightArgsForCategory(category, playwrightArgs);
for (const [target, specs] of runsByTarget) {
  await ensureCodeE2EPrerequisites();

  const args = [
    "--filter",
    "@ku0/e2e-tests",
    "exec",
    "playwright",
    "test",
    ...resolvedPlaywrightArgs,
    ...specs.map((filePath) => toPosixPath(path.relative(e2eRoot, filePath))),
  ];
  const env = {
    ...process.env,
    WEB_E2E_APP: target,
  };
  let releasePortReservation = null;
  const canUsePersistentServer =
    usePersistentDevServer && category !== "smoke" && !resolvedPlaywrightArgs.includes("--ui");
  if (!env.WEB_E2E_PORT) {
    const basePort = Number.parseInt(DEFAULT_WEB_E2E_PORT, 10);
    const categoryOffset = CATEGORY_PORT_OFFSET[category] ?? 0;
    const preferredPort = (Number.isNaN(basePort) ? 5187 : basePort) + categoryOffset;
    if (canUsePersistentServer) {
      env.WEB_E2E_PORT = String(preferredPort);
    } else {
      const reservation = await reserveAvailablePort(preferredPort, {
        host: WEB_E2E_HOST,
        maxAttempts: 200,
      });
      env.WEB_E2E_PORT = String(reservation.port);
      releasePortReservation = reservation.release;
      activePortReleases.add(releasePortReservation);
    }
  }
  if (target === "code" && !env.VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT) {
    env.VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT = "http://127.0.0.1:8788/rpc";
  }
  if (canUsePersistentServer) {
    const port = Number.parseInt(env.WEB_E2E_PORT, 10);
    await ensurePersistentWebE2EDevServer({
      target,
      host: WEB_E2E_HOST,
      port,
      env,
      repoRoot,
    });
    applyResolvedCodeRuntimeGatewayEnv({ target, env, host: WEB_E2E_HOST, port });
    env.PW_SKIP_WEBSERVER = "1";
  } else {
    env.PW_SKIP_WEBSERVER = "0";
  }

  const result = spawnPnpmSync(args, { stdio: "inherit", env });
  if (releasePortReservation) {
    try {
      releasePortReservation();
    } finally {
      activePortReleases.delete(releasePortReservation);
    }
    releasePortReservation = null;
  }
  if (result.error) {
    process.exit(1);
  }
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

process.exit(0);

async function ensureCodeE2EPrerequisites() {
  const fingerprint = await loadLocalRuntimeContractFingerprint();
  if (fingerprint) {
    return;
  }

  process.stderr.write(
    "[e2e] Unable to resolve the local runtime contract fingerprint from the frozen runtime spec.\n"
  );
  process.exit(1);
}

function collectSpecFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === "node_modules") {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSpecFiles(fullPath));
      continue;
    }

    if (entry.isFile() && (entry.name.endsWith(".spec.ts") || entry.name.endsWith(".spec.tsx"))) {
      files.push(fullPath);
    }
  }

  return files;
}

function resolveSpecTarget(filePath, e2eSrcPath) {
  const relativePath = toPosixPath(path.relative(e2eSrcPath, filePath));
  if (relativePath.length === 0) {
    return "code";
  }
  return "code";
}

function groupSpecsByTarget(specs, e2eSrcPath) {
  const grouped = new Map();
  for (const specPath of specs) {
    const target = resolveSpecTarget(specPath, e2eSrcPath);
    const group = grouped.get(target) ?? [];
    group.push(specPath);
    grouped.set(target, group);
  }
  return grouped;
}

function toSafeHostToken(host) {
  return host.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function getPersistentServerMetadataPath({ target, host, port }) {
  const safeHost = toSafeHostToken(host);
  return path.join(
    process.cwd(),
    PERSISTENT_SERVER_METADATA_DIR,
    `${target}-${safeHost}-${port}.json`
  );
}

function getPersistentServerLogPath({ target, host, port }) {
  const safeHost = toSafeHostToken(host);
  return path.join(process.cwd(), PERSISTENT_SERVER_LOG_DIR, `${target}-${safeHost}-${port}.log`);
}

function readPersistentServerMetadata(metadataPath) {
  try {
    const content = fs.readFileSync(metadataPath, "utf8");
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writePersistentServerMetadata(metadataPath, value) {
  fs.mkdirSync(path.dirname(metadataPath), { recursive: true });
  fs.writeFileSync(metadataPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function clearPersistentServerMetadata(metadataPath) {
  try {
    fs.unlinkSync(metadataPath);
  } catch {
    // Best effort metadata cleanup.
  }
}

function clearPersistentServerLog(logPath) {
  try {
    fs.unlinkSync(logPath);
  } catch {
    // Best effort log cleanup.
  }
}

function readPersistentServerLogTail(logPath, maxBytes = MAX_PERSISTENT_SERVER_LOG_TAIL_BYTES) {
  try {
    const stats = fs.statSync(logPath);
    if (!stats.isFile() || stats.size <= 0) {
      return "";
    }

    const bytesToRead = Math.min(stats.size, maxBytes);
    const buffer = Buffer.alloc(bytesToRead);
    const offset = stats.size - bytesToRead;
    const fd = fs.openSync(logPath, "r");
    try {
      fs.readSync(fd, buffer, 0, bytesToRead, offset);
    } finally {
      fs.closeSync(fd);
    }
    return buffer.toString("utf8").trim();
  } catch {
    return "";
  }
}

function readPersistentServerLog(logPath) {
  try {
    return fs.readFileSync(logPath, "utf8");
  } catch {
    return "";
  }
}

function readRuntimeEndpointsFromLog(logPath) {
  const log = readPersistentServerLog(logPath);
  if (log.length === 0) {
    return null;
  }

  let match = null;
  for (const candidate of log.matchAll(RUNTIME_ENDPOINT_LOG_PATTERN)) {
    match = candidate;
  }
  if (!match) {
    return null;
  }

  const [, rpc, health, events, ws] = match;
  return {
    rpc,
    health,
    events,
    ws,
  };
}

function isLikelyStaleRustMetadataFailure(logTail) {
  if (typeof logTail !== "string" || logTail.length === 0) {
    return false;
  }
  const normalized = logTail.toLowerCase();
  return (
    normalized.includes("couldn't read metadata for file") ||
    normalized.includes("error[e0463]: can't find crate for")
  );
}

function runCodeRuntimeCargoClean(repoRoot) {
  const runtimeManifestPath = path.join(
    repoRoot,
    "packages",
    "code-runtime-service-rs",
    "Cargo.toml"
  );
  const clean = spawnSync("cargo", ["clean", "--manifest-path", runtimeManifestPath], {
    cwd: repoRoot,
    stdio: "inherit",
  });
  return !clean.error && clean.status === 0;
}

function terminateProcessTree(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return;
  }
  if (process.platform === "win32") {
    try {
      spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
        stdio: "ignore",
      });
    } catch {
      // Process may already be gone.
    }
    return;
  }
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    // Process group may not exist; fallback to direct kill below.
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // Process may already be gone.
  }
}

async function isHttpServerReady(baseUrl, timeoutMs = 1200) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  try {
    const response = await fetch(baseUrl, {
      method: "GET",
      signal: controller.signal,
      headers: { accept: "text/html,*/*" },
    });
    return response.ok || response.status === 404;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function resolveRuntimeHealthEndpoint(runtimeGatewayEndpoint) {
  const fallback = "http://127.0.0.1:8788/health";
  if (typeof runtimeGatewayEndpoint !== "string" || runtimeGatewayEndpoint.trim().length === 0) {
    return fallback;
  }
  try {
    const parsed = new URL(runtimeGatewayEndpoint.trim());
    parsed.pathname = "/health";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return fallback;
  }
}

async function probeCodeRuntimeGatewayCompatibility(runtimeGatewayEndpoint, localFingerprint) {
  if (!runtimeGatewayEndpoint || !localFingerprint?.methodSetHash) {
    return true;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, 1500);
  try {
    const response = await fetch(runtimeGatewayEndpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "e2e-runtime-capabilities",
        method: "code_rpc_capabilities",
        params: {},
      }),
    });
    if (!response.ok) {
      return false;
    }
    const payload = await response.json().catch(() => null);
    const result =
      payload && typeof payload === "object" && !Array.isArray(payload) && payload.result
        ? payload.result
        : null;
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      return false;
    }

    const methodSetHash =
      typeof result.methodSetHash === "string" ? result.methodSetHash.trim() : "";
    if (methodSetHash.length === 0 || methodSetHash !== localFingerprint.methodSetHash) {
      return false;
    }

    const methods = Array.isArray(result.methods)
      ? result.methods.filter((method) => typeof method === "string")
      : [];
    return localFingerprint.requiredMethods.every((method) => methods.includes(method));
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function isCodeRuntimeGatewayReady(runtimeGatewayEndpoint, timeoutMs = 1200) {
  const healthEndpoint = resolveRuntimeHealthEndpoint(runtimeGatewayEndpoint);
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  try {
    const response = await fetch(healthEndpoint, {
      method: "GET",
      signal: controller.signal,
      headers: { accept: "application/json,*/*" },
    });
    if (!response.ok) {
      return false;
    }
    const payload = await response.json().catch(() => null);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return true;
    }
    if ("app" in payload) {
      return payload.app === "code-runtime-service-rs";
    }
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function waitForCodeRuntimeGatewayReady(runtimeGatewayEndpoint, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isCodeRuntimeGatewayReady(runtimeGatewayEndpoint, 1200)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function waitForHttpServerReady(baseUrl, timeoutMs = DEFAULT_PERSISTENT_SERVER_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isHttpServerReady(baseUrl, 1200)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

function resolvePersistentDevServerCommand() {
  return "pnpm dev:code:runtime-gateway-web:all";
}

function resolveCodeRuntimeGatewayEndpoint(target, env) {
  if (target !== "code") {
    return null;
  }
  return env.VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT || "http://127.0.0.1:8788/rpc";
}

function resolvePersistentCodeRuntimeGatewayEndpoint({ target, env, host, port }) {
  const fallback = resolveCodeRuntimeGatewayEndpoint(target, env);
  if (target !== "code") {
    return fallback;
  }
  const logPath = getPersistentServerLogPath({ target, host, port });
  return readRuntimeEndpointsFromLog(logPath)?.rpc ?? fallback;
}

function applyResolvedCodeRuntimeGatewayEnv({ target, env, host, port }) {
  if (target !== "code") {
    return;
  }
  const runtimeGatewayEndpoint = resolvePersistentCodeRuntimeGatewayEndpoint({
    target,
    env,
    host,
    port,
  });
  if (!runtimeGatewayEndpoint) {
    return;
  }
  env.VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT = runtimeGatewayEndpoint;
  env.CODE_RUNTIME_REPLAY_RPC_ENDPOINT = runtimeGatewayEndpoint;
  env.CODE_RUNTIME_REPLAY_HEALTH_ENDPOINT = resolveRuntimeHealthEndpoint(runtimeGatewayEndpoint);
}

function readPersistentServerMetadataPid(metadata) {
  return Number.parseInt(String(metadata?.pid ?? ""), 10);
}

async function waitForPersistentServerReady({
  target,
  baseUrl,
  runtimeGatewayEndpoint,
  pid,
  timeoutMs,
}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const readiness = await readPersistentServerReadiness({
      target,
      baseUrl,
      runtimeGatewayEndpoint,
      runtimeReadyTimeoutMs: 1_500,
    });
    if (readiness.webReady && readiness.runtimeReady) {
      return { ready: true, processExited: false };
    }
    if (!isProcessAlive(pid)) {
      return { ready: false, processExited: true };
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return {
    ready: false,
    processExited: !isProcessAlive(pid),
  };
}

async function readPersistentServerReadiness({
  target,
  baseUrl,
  runtimeGatewayEndpoint,
  runtimeReadyTimeoutMs = 10_000,
}) {
  const webReady = await isHttpServerReady(baseUrl, 1500);
  if (!webReady) {
    return { webReady: false, runtimeReady: false };
  }
  if (target !== "code") {
    return { webReady: true, runtimeReady: true };
  }
  const runtimeReady = await waitForCodeRuntimeGatewayReady(
    runtimeGatewayEndpoint,
    runtimeReadyTimeoutMs
  );
  return { webReady: true, runtimeReady };
}

function assertNoUnmanagedCodeWebRuntimeDrift({
  target,
  webReady,
  runtimeReady,
  metadataPid,
  baseUrl,
  runtimeHealthEndpoint,
}) {
  if (target !== "code" || !webReady || runtimeReady || isProcessAlive(metadataPid)) {
    return;
  }
  throw new Error(
    `Code E2E web server on ${baseUrl} is reachable but runtime is unhealthy at ${runtimeHealthEndpoint}. Stop the stale server and retry.`
  );
}

function resolvePersistentServerStartupPolicy(target) {
  return {
    startupTimeoutMs:
      target === "code"
        ? DEFAULT_CODE_PERSISTENT_SERVER_TIMEOUT_MS
        : DEFAULT_PERSISTENT_SERVER_TIMEOUT_MS,
    maxStartupAttempts: target === "code" ? 2 : 1,
  };
}

async function tryReuseWarmingPersistentServer({
  metadata,
  metadataPid,
  target,
  baseUrl,
  runtimeGatewayEndpoint,
  metadataPath,
}) {
  if (!metadata || !isProcessAlive(metadataPid)) {
    return false;
  }

  const warmingWebReady = await waitForHttpServerReady(baseUrl, 10_000);
  const warmingRuntimeReady =
    target === "code" ? await waitForCodeRuntimeGatewayReady(runtimeGatewayEndpoint, 10_000) : true;
  if (warmingWebReady && warmingRuntimeReady) {
    return true;
  }

  terminateProcessTree(metadataPid);
  clearPersistentServerMetadata(metadataPath);
  return false;
}

function spawnPersistentServerProcess({ repoRoot, env, logPath }) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  clearPersistentServerLog(logPath);
  const logFd = fs.openSync(logPath, "a");
  const child = spawnPnpm(["dev:code:runtime-gateway-web:all"], {
    cwd: repoRoot,
    env,
    detached: true,
    stdio: ["ignore", logFd, logFd],
  });
  fs.closeSync(logFd);
  child.unref();
  return child;
}

function shouldRetryCodeStartupWithCargoClean({
  target,
  attempt,
  maxStartupAttempts,
  startupResult,
  logTail,
}) {
  return (
    target === "code" &&
    attempt < maxStartupAttempts &&
    startupResult.processExited &&
    isLikelyStaleRustMetadataFailure(logTail)
  );
}

function createPersistentServerStartupError({
  target,
  baseUrl,
  startupTimeoutMs,
  startupResult,
  repoRoot,
  logPath,
  logTail,
}) {
  const failureReason = startupResult.processExited
    ? "exited before it became ready"
    : `timed out after ${startupTimeoutMs}ms`;
  const relativeLogPath = path.relative(repoRoot, logPath) || logPath;
  const logContext =
    logTail.length > 0
      ? `\nRecent persistent server logs (${relativeLogPath}):\n${logTail}`
      : `\nNo persistent server logs were captured at ${relativeLogPath}.`;
  return new Error(
    `Persistent ${target} E2E dev server at ${baseUrl} ${failureReason}.${logContext}`
  );
}

function handlePersistentServerStartupFailure({
  target,
  attempt,
  maxStartupAttempts,
  startupResult,
  childPid,
  metadataPath,
  logPath,
  baseUrl,
  startupTimeoutMs,
  repoRoot,
}) {
  const logTail = readPersistentServerLogTail(logPath);
  terminateProcessTree(childPid);
  clearPersistentServerMetadata(metadataPath);

  if (
    shouldRetryCodeStartupWithCargoClean({
      target,
      attempt,
      maxStartupAttempts,
      startupResult,
      logTail,
    })
  ) {
    const cleaned = runCodeRuntimeCargoClean(repoRoot);
    if (cleaned) {
      return { shouldRetry: true };
    }
  }

  return {
    shouldRetry: false,
    error: createPersistentServerStartupError({
      target,
      baseUrl,
      startupTimeoutMs,
      startupResult,
      repoRoot,
      logPath,
      logTail,
    }),
  };
}

async function startPersistentServerWithRetries({
  target,
  host,
  port,
  env,
  repoRoot,
  baseUrl,
  metadataPath,
  runtimeGatewayEndpoint,
  logPath,
}) {
  const command = resolvePersistentDevServerCommand();
  const { startupTimeoutMs, maxStartupAttempts } = resolvePersistentServerStartupPolicy(target);

  for (let attempt = 1; attempt <= maxStartupAttempts; attempt += 1) {
    const child = spawnPersistentServerProcess({
      repoRoot,
      env: {
        ...env,
        WEB_E2E_HOST: host,
        WEB_E2E_PORT: String(port),
      },
      logPath,
    });

    writePersistentServerMetadata(metadataPath, {
      pid: child.pid,
      target,
      host,
      port,
      command,
      logPath,
      startedAt: new Date().toISOString(),
    });

    const startupResult = await waitForPersistentServerReady({
      target,
      baseUrl,
      runtimeGatewayEndpoint,
      pid: child.pid,
      timeoutMs: startupTimeoutMs,
    });
    if (startupResult.ready) {
      return;
    }

    const failure = handlePersistentServerStartupFailure({
      target,
      attempt,
      maxStartupAttempts,
      startupResult,
      childPid: child.pid,
      metadataPath,
      logPath,
      baseUrl,
      startupTimeoutMs,
      repoRoot,
    });
    if (failure.shouldRetry) {
      continue;
    }
    throw failure.error;
  }
}

async function ensurePersistentWebE2EDevServer({ target, host, port, env, repoRoot }) {
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error(`Invalid WEB_E2E_PORT for persistent server: ${String(port)}`);
  }

  const baseUrl = `http://${host}:${port}`;
  const metadataPath = getPersistentServerMetadataPath({ target, host, port });
  const metadata = readPersistentServerMetadata(metadataPath);
  const metadataPid = readPersistentServerMetadataPid(metadata);
  const logPath = getPersistentServerLogPath({ target, host, port });
  const runtimeGatewayEndpoint = resolvePersistentCodeRuntimeGatewayEndpoint({
    target,
    env,
    host,
    port,
  });
  const runtimeHealthEndpoint =
    target === "code" ? resolveRuntimeHealthEndpoint(runtimeGatewayEndpoint) : "";
  const initialReadiness = await readPersistentServerReadiness({
    target,
    baseUrl,
    runtimeGatewayEndpoint,
  });

  const localFingerprint = target === "code" ? await loadLocalRuntimeContractFingerprint() : null;
  const runtimeCompatible =
    target === "code"
      ? await probeCodeRuntimeGatewayCompatibility(runtimeGatewayEndpoint, localFingerprint)
      : true;

  if (initialReadiness.webReady && initialReadiness.runtimeReady && runtimeCompatible) {
    applyResolvedCodeRuntimeGatewayEnv({ target, env, host, port });
    return;
  }

  if (
    target === "code" &&
    initialReadiness.webReady &&
    initialReadiness.runtimeReady &&
    !runtimeCompatible
  ) {
    if (isProcessAlive(metadataPid)) {
      terminateProcessTree(metadataPid);
    }
    clearPersistentServerMetadata(metadataPath);
  }

  assertNoUnmanagedCodeWebRuntimeDrift({
    target,
    webReady: initialReadiness.webReady,
    runtimeReady: initialReadiness.runtimeReady,
    metadataPid,
    baseUrl,
    runtimeHealthEndpoint,
  });

  const reusedWarmingServer = await tryReuseWarmingPersistentServer({
    metadata,
    metadataPid,
    target,
    baseUrl,
    runtimeGatewayEndpoint,
    metadataPath,
  });
  if (reusedWarmingServer) {
    applyResolvedCodeRuntimeGatewayEnv({ target, env, host, port });
    return;
  }

  await startPersistentServerWithRetries({
    target,
    host,
    port,
    env,
    repoRoot,
    baseUrl,
    metadataPath,
    runtimeGatewayEndpoint,
    logPath,
  });
  applyResolvedCodeRuntimeGatewayEnv({ target, env, host, port });
}

function getPortLockPath(port, host) {
  const safeHost = toSafeHostToken(host);
  return path.join(process.cwd(), PORT_LOCK_DIR, `${safeHost}-${port}.lock`);
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "EPERM") {
        return true;
      }
      if (error.code === "ESRCH") {
        return false;
      }
    }
    return false;
  }
}

function clearStalePortLock(lockPath) {
  let stat = null;
  try {
    stat = fs.statSync(lockPath);
  } catch {
    return;
  }

  const lockAgeMs = Date.now() - stat.mtimeMs;
  let lockPid = null;
  try {
    const content = fs.readFileSync(lockPath, "utf8");
    const parsed = JSON.parse(content);
    lockPid = Number.parseInt(String(parsed.pid ?? ""), 10);
  } catch {
    lockPid = null;
  }

  const shouldClear = lockAgeMs > PORT_LOCK_STALE_MS || !isProcessAlive(lockPid);
  if (!shouldClear) {
    return;
  }

  try {
    fs.unlinkSync(lockPath);
  } catch {
    // Best effort stale lock cleanup.
  }
}

function tryAcquirePortLock(lockPath) {
  try {
    fs.writeFileSync(lockPath, `${JSON.stringify({ pid: process.pid, createdAt: Date.now() })}\n`, {
      flag: "wx",
      encoding: "utf8",
    });
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") {
      clearStalePortLock(lockPath);
      try {
        fs.writeFileSync(
          lockPath,
          `${JSON.stringify({ pid: process.pid, createdAt: Date.now() })}\n`,
          {
            flag: "wx",
            encoding: "utf8",
          }
        );
        return true;
      } catch {
        return false;
      }
    }
    throw error;
  }
}

function releasePortLock(lockPath) {
  try {
    fs.unlinkSync(lockPath);
  } catch {
    // Best effort lock release.
  }
}

async function reserveAvailablePort(startPort, { host = "127.0.0.1", maxAttempts = 200 } = {}) {
  const lockDir = path.join(process.cwd(), PORT_LOCK_DIR);
  fs.mkdirSync(lockDir, { recursive: true });

  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const candidate = startPort + offset;
    if (candidate <= 0 || candidate > 65_535) {
      break;
    }

    const available = await isPortAvailable(candidate, { host });
    if (!available) {
      continue;
    }

    const lockPath = getPortLockPath(candidate, host);
    const locked = tryAcquirePortLock(lockPath);
    if (!locked) {
      continue;
    }

    const stillAvailable = await isPortAvailable(candidate, { host });
    if (!stillAvailable) {
      releasePortLock(lockPath);
      continue;
    }

    return {
      port: candidate,
      release: () => releasePortLock(lockPath),
    };
  }

  throw new Error(
    `Failed to reserve an available E2E port from ${startPort} (host=${host}, maxAttempts=${maxAttempts}).`
  );
}
