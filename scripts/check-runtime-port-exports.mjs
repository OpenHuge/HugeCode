#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const RUNTIME_PORTS_DIR = "apps/code/src/application/runtime/ports";
const RUNTIME_APP_DIR = "apps/code/src/application/runtime";
const CODE_RUNTIME_HOST_CONTRACT_DIR = "packages/code-runtime-host-contract/src";
const NATIVE_RUNTIME_HOST_CONTRACT_DIR = "packages/native-runtime-host-contract/src";
const TARGET_PATTERN = /^[A-Za-z0-9]+\.ts$/u;
const GUARDED_PORT_FILES = new Set([
  "dragDrop.ts",
  "events.ts",
  "logger.ts",
  "retryScheduler.ts",
  "runtimeClient.ts",
  "runtimeClientMode.ts",
  "runtimeErrorClassifier.ts",
  "runtimeEventChannelDiagnostics.ts",
  "runtimeSessionCommands.ts",
  "runtimeEventStabilityMetrics.ts",
  "runtimeEventStateMachine.ts",
  "runtimeMessageCodes.ts",
  "runtimeToolLifecycle.ts",
  "runtimeToolExecutionMetrics.ts",
  "runtimeUpdatedEvents.ts",
  "desktopAppSettings.ts",
  "desktopApps.ts",
  "desktopDpi.ts",
  "desktopHostCore.ts",
  "desktopHostDialogs.ts",
  "desktopHostEnvironment.ts",
  "desktopHostEvent.ts",
  "desktopHostWindow.ts",
  "desktopFiles.ts",
  "desktopMenu.ts",
  "desktopNotifications.ts",
  "desktopProcess.ts",
  "desktopStateFabric.ts",
  "desktopUpdater.ts",
  "desktopWebview.ts",
  "tauri.ts",
  "tauriCodex.ts",
  "tauriCodexConfig.ts",
  "tauriCollaboration.ts",
  "tauriDictation.ts",
  "tauriFiles.ts",
  "tauriMenu.ts",
  "tauriModels.ts",
  "tauriNotifications.ts",
  "tauriOauth.ts",
  "tauriPrompts.ts",
  "tauriRemoteServers.ts",
  "tauriRuntime.ts",
  "tauriRuntimeActionRequired.ts",
  "tauriRuntimeAutomation.ts",
  "tauriRuntimeCatalog.ts",
  "tauriRuntimeExtensions.ts",
  "runtimeJobs.ts",
  "tauriRuntimeOperations.ts",
  "tauriRuntimePolicy.ts",
  "tauriRuntimePrompts.ts",
  "tauriRuntimeSkills.ts",
  "tauriRuntimeSubAgents.ts",
  "tauriRuntimeTerminal.ts",
  "tauriSkills.ts",
  "tauriTerminal.ts",
  "tauriThreads.ts",
  "tauriUsage.ts",
  "tauriWorkspaceCatalog.ts",
  "tauriWorkspaceDialogs.ts",
  "tauriWorkspaceFiles.ts",
  "tauriWorkspaceMutations.ts",
  "toasts.ts",
  "webMcpBridge.ts",
  "webMcpInputSchemaValidationError.ts",
  "webMcpModelInputSchemas.ts",
  "webMcpToolInputSchemaValidation.ts",
]);
const RETIRED_RUNTIME_PORT_FILES = new Set([
  "tauriAppSettings.ts",
  "tauriApps.ts",
  "tauriCodex.ts",
  "tauriGit.ts",
  "tauriRuntimeDiagnostics.ts",
  "tauriRuntimeRuns.ts",
  "tauriThreadSnapshots.ts",
  "tauriSettings.ts",
  "tauriWorkspaces.ts",
]);
const GUARDED_APP_FILES = new Set([
  "dragDrop.ts",
  "events.ts",
  "index.ts",
  "logger.ts",
  "retryScheduler.ts",
  "runtimeClient.ts",
  "runtimeClientMode.ts",
  "runtimeErrorClassifier.ts",
  "runtimeEventChannelDiagnostics.ts",
  "runtimeEventStabilityMetrics.ts",
  "runtimeEventStateMachine.ts",
  "runtimeToolExecutionMetrics.ts",
  "runtimeUpdatedEvents.ts",
  "desktopHost.ts",
  "toasts.ts",
  "webMcpBridge.ts",
]);
const GUARDED_CODE_RUNTIME_HOST_CONTRACT_FILES = new Set(["index.ts"]);
const GUARDED_NATIVE_RUNTIME_HOST_CONTRACT_FILES = new Set(["index.ts"]);
const NO_RAW_TAURI_AGGREGATION_PORT_FILES = new Set([
  "tauriCollaboration.ts",
  "tauriCodexOperations.ts",
  "tauriFiles.ts",
  "tauriMenu.ts",
  "tauriMissionControl.ts",
  "tauriModels.ts",
  "tauriNotifications.ts",
  "tauriOauth.ts",
  "tauriRuntime.ts",
  "tauriRuntimeActionRequired.ts",
  "tauriRuntimeAutomation.ts",
  "tauriRuntimeCatalog.ts",
  "tauriRuntimeDiagnostics.ts",
  "tauriRuntimeExtensions.ts",
  "runtimeJobs.ts",
  "tauriRuntimeOperations.ts",
  "tauriRuntimePolicy.ts",
  "tauriRuntimePrompts.ts",
  "tauriRuntimeSchedules.ts",
  "tauriRuntimeSkills.ts",
  "tauriRuntimeSubAgents.ts",
  "tauriRuntimeTerminal.ts",
  "tauriSkills.ts",
  "tauriUsage.ts",
  "tauriWorkspaceDialogs.ts",
  "tauriWorkspaceCatalog.ts",
]);
const NO_LEGACY_TAURI_SERVICE_IMPORT_PORT_FILES = new Set([
  "tauriRuntimeGit.ts",
  "tauriRuntimeWorkspaceFiles.ts",
]);
const GUARD_TARGETS = [
  { dir: RUNTIME_PORTS_DIR, guardedFiles: GUARDED_PORT_FILES },
  { dir: RUNTIME_APP_DIR, guardedFiles: GUARDED_APP_FILES },
  {
    dir: CODE_RUNTIME_HOST_CONTRACT_DIR,
    guardedFiles: GUARDED_CODE_RUNTIME_HOST_CONTRACT_FILES,
  },
  {
    dir: NATIVE_RUNTIME_HOST_CONTRACT_DIR,
    guardedFiles: GUARDED_NATIVE_RUNTIME_HOST_CONTRACT_FILES,
  },
];
const WILDCARD_EXPORT_PATTERN = /^\s*export\s+\*\s+from\s+["'][^"']+["'];?\s*$/mu;
const RAW_TAURI_AGGREGATION_IMPORT_PATTERN =
  /^\s*(?:export|import)[\s\S]*from\s+["']\.\/tauri["'];?\s*$/mu;
const LEGACY_TAURI_SERVICE_IMPORT_PATTERN =
  /^\s*import[\s\S]*from\s+["']\.\.\/\.\.\/\.\.\/services\/tauri["'];?\s*$/mu;
const RUNTIME_SESSION_COMMANDS_PORT_PATH = `${RUNTIME_PORTS_DIR}/runtimeSessionCommands.ts`;
const RUNTIME_TOOL_LIFECYCLE_PORT_PATH = `${RUNTIME_PORTS_DIR}/runtimeToolLifecycle.ts`;
const RUNTIME_TOOL_LIFECYCLE_FORBIDDEN_EXPORT_PATTERN =
  /\b(?:getRuntimeToolLifecycleSnapshot|subscribeRuntimeToolLifecycleEvents|subscribeRuntimeToolLifecycleSnapshot|filterRuntimeToolLifecycleSnapshot|runtimeToolLifecycleEventMatchesWorkspace)\b/u;
const RUNTIME_SESSION_COMMANDS_ALLOWED_EXPORTS = new Set([
  "useRuntimeSessionCommandsResolver",
  "useWorkspaceRuntimeSessionCommands",
]);
const RUNTIME_TOOL_LIFECYCLE_ALLOWED_EXPORTS = new Set([
  "RuntimeToolLifecycleEvent",
  "RuntimeToolLifecycleHookCheckpoint",
  "RuntimeToolLifecycleHookCheckpointStatus",
  "RuntimeToolLifecycleHookPoint",
  "RuntimeToolLifecycleSnapshot",
  "RuntimeToolLifecycleSource",
  "RuntimeToolLifecycleStatus",
  "RuntimeToolLifecyclePresentationTone",
  "RuntimeToolLifecyclePresentationSummary",
  "buildRuntimeToolLifecyclePresentationSummary",
  "describeRuntimeToolLifecycleEvent",
  "describeRuntimeToolLifecycleHookCheckpoint",
  "formatRuntimeToolLifecycleStatusLabel",
  "formatRuntimeToolLifecycleEventKey",
  "formatRuntimeToolLifecycleHookCheckpointKey",
  "getRuntimeToolLifecycleEventTone",
  "getRuntimeToolLifecycleHookCheckpointTone",
  "getWorkspaceRuntimeToolLifecycleSnapshot",
  "sortRuntimeToolLifecycleEventsByRecency",
  "sortRuntimeToolLifecycleHookCheckpointsByRecency",
  "subscribeWorkspaceRuntimeToolLifecycleEvents",
  "subscribeWorkspaceRuntimeToolLifecycleSnapshot",
]);

function collectNamedExports(content) {
  const names = new Set();
  const exportBlockPattern = /export(?:\s+type)?\s*\{([\s\S]*?)\}\s*from\s+["'][^"']+["'];?/gu;

  for (const match of content.matchAll(exportBlockPattern)) {
    const block = match[1] ?? "";
    const specifiers = block
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    for (const specifier of specifiers) {
      const normalized = specifier.replace(/^type\s+/u, "");
      const aliasMatch = normalized.match(/\bas\s+([A-Za-z0-9_]+)$/u);
      if (aliasMatch?.[1]) {
        names.add(aliasMatch[1]);
        continue;
      }
      names.add(normalized);
    }
  }

  return names;
}

function toPosixPath(input) {
  return input.split(path.sep).join("/");
}

function repoFileExists(filePath) {
  return fs.existsSync(path.join(repoRoot, filePath));
}

function listFilesFromEnv() {
  const raw = process.env.VALIDATE_CHANGED_FILES_JSON;
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((entry) => toPosixPath(String(entry)));
  } catch {
    return [];
  }
}

function listFilesForTarget(target, changedFiles) {
  const fromEnv = changedFiles
    .filter((filePath) => filePath.startsWith(`${target.dir}/`))
    .filter((filePath) => repoFileExists(filePath))
    .filter((filePath) => {
      const baseName = path.posix.basename(filePath);
      return TARGET_PATTERN.test(baseName) && target.guardedFiles.has(baseName);
    });
  if (fromEnv.length > 0) {
    return fromEnv;
  }

  const absoluteDir = path.join(repoRoot, target.dir);
  if (!fs.existsSync(absoluteDir)) {
    return [];
  }

  const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => TARGET_PATTERN.test(name))
    .filter((name) => target.guardedFiles.has(name))
    .map((name) => `${target.dir}/${name}`)
    .sort((a, b) => a.localeCompare(b));
}

function listRetiredRuntimePortFiles(changedFiles) {
  const fromEnv = changedFiles
    .filter((filePath) => filePath.startsWith(`${RUNTIME_PORTS_DIR}/`))
    .filter((filePath) => repoFileExists(filePath))
    .filter((filePath) => RETIRED_RUNTIME_PORT_FILES.has(path.posix.basename(filePath)));
  if (fromEnv.length > 0) {
    return fromEnv.sort((a, b) => a.localeCompare(b));
  }

  const absoluteDir = path.join(repoRoot, RUNTIME_PORTS_DIR);
  if (!fs.existsSync(absoluteDir)) {
    return [];
  }

  return fs
    .readdirSync(absoluteDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => RETIRED_RUNTIME_PORT_FILES.has(name))
    .map((name) => `${RUNTIME_PORTS_DIR}/${name}`)
    .sort((a, b) => a.localeCompare(b));
}

function listCandidateFiles() {
  const changedFiles = listFilesFromEnv();
  const files = [];
  for (const target of GUARD_TARGETS) {
    files.push(...listFilesForTarget(target, changedFiles));
  }
  files.push(...listRetiredRuntimePortFiles(changedFiles));
  return [...new Set(files)].sort((a, b) => a.localeCompare(b));
}
const files = listCandidateFiles();

if (files.length === 0) {
  process.exit(0);
}

const violations = [];
for (const filePath of files) {
  const absolutePath = path.join(repoRoot, filePath);
  let content = "";
  try {
    content = fs.readFileSync(absolutePath, "utf8");
  } catch (error) {
    violations.push(`${filePath}: failed to read file (${String(error)})`);
    continue;
  }

  if (WILDCARD_EXPORT_PATTERN.test(content)) {
    violations.push(`${filePath}: wildcard re-export is forbidden; use explicit exports instead`);
  }

  const baseName = path.posix.basename(filePath);
  if (
    NO_RAW_TAURI_AGGREGATION_PORT_FILES.has(baseName) &&
    RAW_TAURI_AGGREGATION_IMPORT_PATTERN.test(content)
  ) {
    violations.push(
      `${filePath}: runtime port must not import ./tauri; import a dedicated service bridge instead`
    );
  }
  if (
    NO_LEGACY_TAURI_SERVICE_IMPORT_PORT_FILES.has(baseName) &&
    LEGACY_TAURI_SERVICE_IMPORT_PATTERN.test(content)
  ) {
    violations.push(
      `${filePath}: raw kernel port must not import legacy services/tauri types; use runtimeClient or runtime contract types instead`
    );
  }
  if (RETIRED_RUNTIME_PORT_FILES.has(baseName)) {
    violations.push(
      `${filePath}: retired runtime bridge port must not exist; use narrower domain ports instead`
    );
  }
  if (
    filePath === RUNTIME_TOOL_LIFECYCLE_PORT_PATH &&
    RUNTIME_TOOL_LIFECYCLE_FORBIDDEN_EXPORT_PATTERN.test(content)
  ) {
    violations.push(
      `${filePath}: runtime tool lifecycle port must stay workspace-scoped; export only scoped read/subscribe primitives`
    );
  }
  if (filePath === RUNTIME_TOOL_LIFECYCLE_PORT_PATH) {
    const exportedNames = collectNamedExports(content);
    const unexpectedExports = [...exportedNames]
      .filter((name) => !RUNTIME_TOOL_LIFECYCLE_ALLOWED_EXPORTS.has(name))
      .sort((left, right) => left.localeCompare(right));
    const missingExports = [...RUNTIME_TOOL_LIFECYCLE_ALLOWED_EXPORTS]
      .filter((name) => !exportedNames.has(name))
      .sort((left, right) => left.localeCompare(right));

    if (unexpectedExports.length > 0 || missingExports.length > 0) {
      const details = [
        unexpectedExports.length > 0 ? `unexpected: ${unexpectedExports.join(", ")}` : null,
        missingExports.length > 0 ? `missing: ${missingExports.join(", ")}` : null,
      ]
        .filter(Boolean)
        .join("; ");
      violations.push(
        `${filePath}: runtime tool lifecycle port must keep the approved export surface; ${details}`
      );
    }
  }
  if (filePath === RUNTIME_SESSION_COMMANDS_PORT_PATH) {
    const exportedNames = collectNamedExports(content);
    const unexpectedExports = [...exportedNames]
      .filter((name) => !RUNTIME_SESSION_COMMANDS_ALLOWED_EXPORTS.has(name))
      .sort((left, right) => left.localeCompare(right));
    const missingExports = [...RUNTIME_SESSION_COMMANDS_ALLOWED_EXPORTS]
      .filter((name) => !exportedNames.has(name))
      .sort((left, right) => left.localeCompare(right));

    if (unexpectedExports.length > 0 || missingExports.length > 0) {
      const details = [
        unexpectedExports.length > 0 ? `unexpected: ${unexpectedExports.join(", ")}` : null,
        missingExports.length > 0 ? `missing: ${missingExports.join(", ")}` : null,
      ]
        .filter(Boolean)
        .join("; ");
      violations.push(
        `${filePath}: runtime session commands port must keep the approved facade-hook export surface; ${details}`
      );
    }
  }
}

if (violations.length > 0) {
  for (const violation of violations) {
    process.stderr.write(`${violation}\n`);
  }
  process.exit(1);
}
