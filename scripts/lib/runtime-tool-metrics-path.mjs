import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const DEFAULT_RUNTIME_TOOL_METRICS_OUTPUT_PATH = ".tmp/runtime-tool-execution-metrics.json";
export const DEFAULT_RUNTIME_TOOL_METRICS_FILE_NAME = "runtime-tool-execution-metrics.json";
export const DEFAULT_RUNTIME_TOOL_METRICS_DIR_NAME = ".hugecode";

function readNonEmptyEnv(env, key) {
  const value = env[key];
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveRuntimeToolMetricsPersistedPath(env = process.env) {
  const explicitPath = readNonEmptyEnv(env, "CODE_RUNTIME_TOOL_METRICS_PATH");
  if (explicitPath) {
    return explicitPath;
  }

  return path.join(
    os.homedir(),
    DEFAULT_RUNTIME_TOOL_METRICS_DIR_NAME,
    DEFAULT_RUNTIME_TOOL_METRICS_FILE_NAME
  );
}

export function resolveRuntimeToolMetricsInputPath({
  metricsFile,
  cwd = process.cwd(),
  env = process.env,
} = {}) {
  if (typeof metricsFile === "string" && metricsFile.trim().length > 0) {
    return path.resolve(cwd, metricsFile);
  }

  const repoSnapshotPath = path.resolve(cwd, DEFAULT_RUNTIME_TOOL_METRICS_OUTPUT_PATH);
  if (fs.existsSync(repoSnapshotPath)) {
    return repoSnapshotPath;
  }

  const persistedPath = resolveRuntimeToolMetricsPersistedPath(env);
  if (fs.existsSync(persistedPath)) {
    return persistedPath;
  }

  return repoSnapshotPath;
}
