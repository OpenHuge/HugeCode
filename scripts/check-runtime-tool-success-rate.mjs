#!/usr/bin/env node

import process from "node:process";
import {
  CANONICAL_RUNTIME_TOOL_SCOPES,
  DEFAULT_RUNTIME_TOOL_METRICS_EXPECTED_WINDOW_SIZE,
  DEFAULT_RUNTIME_TOOL_METRICS_FILE,
  formatRuntimeToolPercent,
  loadRuntimeToolMetricsSnapshot,
  readFirstNumber,
  readRuntimeToolChannelHealth,
  readRuntimeToolCircuitBreakers,
  readRuntimeToolScopeTotals,
  readRuntimeToolTopFailedReasons,
} from "./lib/runtime-tool-metrics-snapshot.mjs";

const DEFAULT_MIN_SUCCESS_RATE = 0.95;
const DEFAULT_METRICS_FILE = DEFAULT_RUNTIME_TOOL_METRICS_FILE;
const DEFAULT_EXPECTED_WINDOW_SIZE = DEFAULT_RUNTIME_TOOL_METRICS_EXPECTED_WINDOW_SIZE;
const DEFAULT_TOP_FAILED_LIMIT = 5;
const DEFAULT_TOP_FAILED_REASONS_LIMIT = 5;

function parseMinSuccessRate(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error("--min-success-rate must be a number between 0 and 1.");
  }
  return parsed;
}

function parseExpectedWindowSize(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("--expected-window-size must be a positive number.");
  }
  return Math.floor(parsed);
}

function readFlagValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

const ARG_SETTERS = {
  "--min-success-rate": (args, value) => {
    args.minSuccessRate = parseMinSuccessRate(value);
  },
  "--metrics-file": (args, value) => {
    args.metricsFile = value;
  },
  "--expected-window-size": (args, value) => {
    args.expectedWindowSize = parseExpectedWindowSize(value);
  },
};

function parseArgs(argv) {
  const args = {
    minSuccessRate: DEFAULT_MIN_SUCCESS_RATE,
    metricsFile: DEFAULT_METRICS_FILE,
    expectedWindowSize: DEFAULT_EXPECTED_WINDOW_SIZE,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const setter = ARG_SETTERS[token];
    if (!setter) {
      continue;
    }
    const value = readFlagValue(argv, index, token);
    setter(args, value);
    index += 1;
  }

  return args;
}

function buildTopFailedTools(snapshot, limit = DEFAULT_TOP_FAILED_LIMIT) {
  const byTool = snapshot?.byTool && typeof snapshot.byTool === "object" ? snapshot.byTool : {};
  const rows = [];
  for (const entry of Object.values(byTool)) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const scope = typeof entry.scope === "string" ? entry.scope : "unknown";
    const toolName = typeof entry.toolName === "string" ? entry.toolName : "<unknown>";
    const validationFailed = readFirstNumber(entry, [
      "validationFailedTotal",
      "validation_failed_total",
    ]);
    const runtimeFailed = readFirstNumber(entry, ["runtimeFailedTotal", "runtime_failed_total"]);
    const timeout = readFirstNumber(entry, ["timeoutTotal", "timeout_total"]);
    const blocked = readFirstNumber(entry, ["blockedTotal", "blocked_total"]);
    const failed = validationFailed + runtimeFailed + timeout;
    if (failed <= 0 && blocked <= 0) {
      continue;
    }
    rows.push({
      scope,
      toolName,
      failed,
      validationFailed,
      runtimeFailed,
      timeout,
      blocked,
    });
  }
  rows.sort((left, right) => {
    if (right.failed !== left.failed) {
      return right.failed - left.failed;
    }
    if (right.blocked !== left.blocked) {
      return right.blocked - left.blocked;
    }
    const scopeCmp = left.scope.localeCompare(right.scope);
    if (scopeCmp !== 0) {
      return scopeCmp;
    }
    return left.toolName.localeCompare(right.toolName);
  });
  return rows.slice(0, limit);
}

function printScopeDiagnostics(scopedTotals) {
  for (const scope of CANONICAL_RUNTIME_TOOL_SCOPES) {
    const bucket = scopedTotals[scope];
    const denominator =
      bucket.success + bucket.validationFailed + bucket.runtimeFailed + bucket.timeout;
    if (denominator <= 0) {
      continue;
    }
    const successRate = bucket.success / denominator;
  }
}

function printTopFailedTools(snapshot) {
  const top = buildTopFailedTools(snapshot);
  if (top.length === 0) {
    return;
  }

  for (const row of top) {
  }
}

function printTopFailedReasons(topFailedReasons) {
  if (topFailedReasons.length === 0) {
    return;
  }

  for (const row of topFailedReasons) {
  }
}

function printCircuitBreakers(circuitBreakers) {
  if (circuitBreakers.length === 0) {
    return;
  }

  for (const breaker of circuitBreakers) {
  }
}

function main() {
  const { minSuccessRate, metricsFile, expectedWindowSize } = parseArgs(process.argv.slice(2));
  const { snapshot } = loadRuntimeToolMetricsSnapshot({ metricsFile });
  const windowSize = readFirstNumber(snapshot, ["windowSize", "window_size"]);
  if (windowSize <= 0) {
    throw new Error("Metrics snapshot windowSize is missing or invalid.");
  }
  if (windowSize !== expectedWindowSize) {
    throw new Error(
      `Metrics snapshot windowSize ${windowSize} does not match required rolling window ${expectedWindowSize}.`
    );
  }
  const totals = snapshot.totals && typeof snapshot.totals === "object" ? snapshot.totals : {};

  const success = readFirstNumber(totals, ["successTotal", "success_total"]);
  const validationFailed = readFirstNumber(totals, [
    "validationFailedTotal",
    "validation_failed_total",
  ]);
  const runtimeFailed = readFirstNumber(totals, ["runtimeFailedTotal", "runtime_failed_total"]);
  const timeout = readFirstNumber(totals, ["timeoutTotal", "timeout_total"]);
  const blocked = readFirstNumber(totals, ["blockedTotal", "blocked_total"]);

  const denominator = success + validationFailed + runtimeFailed + timeout;

  if (denominator <= 0) {
    throw new Error(
      `Runtime tool success rate denominator is 0 (success=${success}, validation_failed=${validationFailed}, runtime_failed=${runtimeFailed}, timeout=${timeout}, blocked=${blocked}). Run runtime tool executions first, or use 'pnpm run runtime:tool-metrics:probe' for baseline probe events.`
    );
  }

  const successRate = success / denominator;
  const scopedTotals = readRuntimeToolScopeTotals(snapshot);
  const channelHealth = readRuntimeToolChannelHealth(snapshot);
  const circuitBreakers = readRuntimeToolCircuitBreakers(snapshot);
  const topFailedReasons = readRuntimeToolTopFailedReasons(
    snapshot,
    DEFAULT_TOP_FAILED_REASONS_LIMIT
  );

  printScopeDiagnostics(scopedTotals);
  printCircuitBreakers(circuitBreakers);
  printTopFailedTools(snapshot);
  printTopFailedReasons(topFailedReasons);

  if (channelHealth.status !== "healthy") {
    throw new Error(
      `Runtime metrics channel health must be healthy for gate evaluation (actual: ${channelHealth.status}).`
    );
  }

  if (successRate < minSuccessRate) {
    throw new Error(
      `Runtime tool success rate ${formatRuntimeToolPercent(successRate)} is below required ${formatRuntimeToolPercent(minSuccessRate)}.`
    );
  }
}

try {
  main();
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${detail}\n`);
  process.exit(1);
}
