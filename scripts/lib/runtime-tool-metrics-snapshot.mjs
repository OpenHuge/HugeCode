import fs from "node:fs";

import {
  DEFAULT_RUNTIME_TOOL_METRICS_OUTPUT_PATH,
  resolveRuntimeToolMetricsInputPath,
} from "./runtime-tool-metrics-path.mjs";

export const DEFAULT_RUNTIME_TOOL_METRICS_FILE = DEFAULT_RUNTIME_TOOL_METRICS_OUTPUT_PATH;
export const DEFAULT_RUNTIME_TOOL_METRICS_EXPECTED_WINDOW_SIZE = 500;
export const CANONICAL_RUNTIME_TOOL_SCOPES = ["write", "runtime", "computer_observe"];

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasSnapshotShape(value) {
  return isRecord(value) && isRecord(value.totals);
}

export function formatRuntimeToolPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

export function toNonNegativeNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}

export function readFirstNumber(source, keys) {
  for (const key of keys) {
    if (isRecord(source) && Object.hasOwn(source, key)) {
      return toNonNegativeNumber(source[key]);
    }
  }
  return 0;
}

export function resolveRuntimeToolMetricsSnapshot(payload) {
  if (hasSnapshotShape(payload)) {
    return payload;
  }
  if (!isRecord(payload)) {
    throw new Error("Metrics payload is not an object.");
  }
  if (hasSnapshotShape(payload.metrics)) {
    return payload.metrics;
  }
  if (hasSnapshotShape(payload.snapshot)) {
    return payload.snapshot;
  }
  if (isRecord(payload.data)) {
    if (hasSnapshotShape(payload.data.metrics)) {
      return payload.data.metrics;
    }
    if (hasSnapshotShape(payload.data.snapshot)) {
      return payload.data.snapshot;
    }
  }
  throw new Error("Unable to resolve runtime tool execution snapshot from metrics payload.");
}

export function loadRuntimeToolMetricsSnapshot({ metricsFile } = {}) {
  const metricsPath = resolveRuntimeToolMetricsInputPath({
    metricsFile: metricsFile === DEFAULT_RUNTIME_TOOL_METRICS_FILE ? null : metricsFile,
  });
  if (!fs.existsSync(metricsPath)) {
    throw new Error(
      `Metrics snapshot file not found: ${metricsPath}. Run 'pnpm run runtime:tool-metrics:collect' before running this gate.`
    );
  }

  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(metricsPath, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse metrics snapshot: ${detail}`);
  }

  return {
    metricsPath,
    payload,
    snapshot: resolveRuntimeToolMetricsSnapshot(payload),
  };
}

export function buildRuntimeToolScopeTotals() {
  return {
    success: 0,
    validationFailed: 0,
    runtimeFailed: 0,
    timeout: 0,
    blocked: 0,
  };
}

export function readRuntimeToolScopeTotals(snapshot) {
  const byTool = isRecord(snapshot.byTool) ? snapshot.byTool : {};
  const scopeTotals = {
    write: buildRuntimeToolScopeTotals(),
    runtime: buildRuntimeToolScopeTotals(),
    computer_observe: buildRuntimeToolScopeTotals(),
  };

  for (const entry of Object.values(byTool)) {
    if (!isRecord(entry) || typeof entry.scope !== "string") {
      continue;
    }
    if (!CANONICAL_RUNTIME_TOOL_SCOPES.includes(entry.scope)) {
      continue;
    }
    const bucket = scopeTotals[entry.scope];
    bucket.success += readFirstNumber(entry, ["successTotal", "success_total"]);
    bucket.validationFailed += readFirstNumber(entry, [
      "validationFailedTotal",
      "validation_failed_total",
    ]);
    bucket.runtimeFailed += readFirstNumber(entry, ["runtimeFailedTotal", "runtime_failed_total"]);
    bucket.timeout += readFirstNumber(entry, ["timeoutTotal", "timeout_total"]);
    bucket.blocked += readFirstNumber(entry, ["blockedTotal", "blocked_total"]);
  }

  return scopeTotals;
}

export function readRuntimeToolChannelHealth(snapshot) {
  const channelHealth = isRecord(snapshot.channelHealth)
    ? snapshot.channelHealth
    : isRecord(snapshot.channel_health)
      ? snapshot.channel_health
      : null;
  if (!channelHealth) {
    throw new Error("Metrics snapshot channelHealth is required and cannot be missing.");
  }
  const status =
    typeof channelHealth.status === "string" && channelHealth.status.trim().length > 0
      ? channelHealth.status.trim()
      : null;
  if (status !== "healthy" && status !== "degraded" && status !== "unavailable") {
    throw new Error("Metrics snapshot channelHealth.status must be healthy|degraded|unavailable.");
  }
  return {
    status,
    reason:
      typeof channelHealth.reason === "string" && channelHealth.reason.trim().length > 0
        ? channelHealth.reason.trim()
        : null,
    lastErrorCode:
      typeof channelHealth.lastErrorCode === "string" &&
      channelHealth.lastErrorCode.trim().length > 0
        ? channelHealth.lastErrorCode.trim()
        : typeof channelHealth.last_error_code === "string" &&
            channelHealth.last_error_code.trim().length > 0
          ? channelHealth.last_error_code.trim()
          : null,
  };
}

export function readRuntimeToolCircuitBreakers(snapshot) {
  const source = Array.isArray(snapshot.circuitBreakers)
    ? snapshot.circuitBreakers
    : Array.isArray(snapshot.circuit_breakers)
      ? snapshot.circuit_breakers
      : null;
  if (!source) {
    throw new Error("Metrics snapshot circuitBreakers is required and cannot be missing.");
  }
  return source
    .filter((entry) => isRecord(entry))
    .map((entry) => ({
      scope: typeof entry.scope === "string" ? entry.scope : "unknown",
      state: typeof entry.state === "string" ? entry.state : "unknown",
      openedAt: readFirstNumber(entry, ["openedAt", "opened_at"]),
      updatedAt: readFirstNumber(entry, ["updatedAt", "updated_at"]),
    }));
}

export function readRuntimeToolTopFailedReasons(snapshot, limit = 5) {
  const source = Array.isArray(snapshot.errorCodeTopK)
    ? snapshot.errorCodeTopK
    : Array.isArray(snapshot.error_code_top_k)
      ? snapshot.error_code_top_k
      : null;
  if (!source) {
    return [];
  }
  return source
    .filter((entry) => isRecord(entry))
    .map((entry) => ({
      errorCode:
        typeof entry.errorCode === "string" && entry.errorCode.trim().length > 0
          ? entry.errorCode.trim()
          : typeof entry.error_code === "string" && entry.error_code.trim().length > 0
            ? entry.error_code.trim()
            : "<unknown>",
      count: readFirstNumber(entry, ["count"]),
    }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.errorCode.localeCompare(right.errorCode);
    })
    .slice(0, limit);
}
