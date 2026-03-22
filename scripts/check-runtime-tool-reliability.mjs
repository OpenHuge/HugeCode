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

const DEFAULT_METRICS_FILE = DEFAULT_RUNTIME_TOOL_METRICS_FILE;
const DEFAULT_MIN_SUCCESS_RATE = 0.95;
const DEFAULT_MIN_SCOPE_SUCCESS_RATE = 0.92;
const DEFAULT_MAX_TIMEOUT_RATE = 0.03;
const DEFAULT_EXPECTED_WINDOW_SIZE = DEFAULT_RUNTIME_TOOL_METRICS_EXPECTED_WINDOW_SIZE;

function parseRate(value, flag) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`${flag} must be a number between 0 and 1.`);
  }
  return parsed;
}

function parsePositiveInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive number.`);
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

function parseArgs(argv) {
  const args = {
    metricsFile: DEFAULT_METRICS_FILE,
    minSuccessRate: DEFAULT_MIN_SUCCESS_RATE,
    minScopeSuccessRate: DEFAULT_MIN_SCOPE_SUCCESS_RATE,
    maxTimeoutRate: DEFAULT_MAX_TIMEOUT_RATE,
    expectedWindowSize: DEFAULT_EXPECTED_WINDOW_SIZE,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    switch (token) {
      case "--metrics-file":
        args.metricsFile = readFlagValue(argv, index, token);
        index += 1;
        break;
      case "--min-success-rate":
        args.minSuccessRate = parseRate(readFlagValue(argv, index, token), token);
        index += 1;
        break;
      case "--min-scope-success-rate":
        args.minScopeSuccessRate = parseRate(readFlagValue(argv, index, token), token);
        index += 1;
        break;
      case "--max-timeout-rate":
        args.maxTimeoutRate = parseRate(readFlagValue(argv, index, token), token);
        index += 1;
        break;
      case "--expected-window-size":
        args.expectedWindowSize = parsePositiveInteger(readFlagValue(argv, index, token), token);
        index += 1;
        break;
      default:
        break;
    }
  }

  return args;
}

function printScopeDiagnostics(scopeTotals) {
  for (const scope of CANONICAL_RUNTIME_TOOL_SCOPES) {
    const bucket = scopeTotals[scope];
    const denominator =
      bucket.success + bucket.validationFailed + bucket.runtimeFailed + bucket.timeout;
    if (denominator <= 0) {
      continue;
    }
    const successRate = bucket.success / denominator;
  }
}

function printCircuitBreakers(circuitBreakers) {
  if (circuitBreakers.length === 0) {
    return;
  }

  for (const breaker of circuitBreakers) {
  }
}

function printTopFailedReasons(topFailedReasons) {
  if (topFailedReasons.length === 0) {
    return;
  }

  for (const row of topFailedReasons) {
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const { snapshot } = loadRuntimeToolMetricsSnapshot({ metricsFile: args.metricsFile });
  const windowSize = readFirstNumber(snapshot, ["windowSize", "window_size"]);
  if (windowSize !== args.expectedWindowSize) {
    throw new Error(
      `Window size mismatch: expected=${args.expectedWindowSize}, actual=${windowSize}.`
    );
  }

  const totals = snapshot?.totals && typeof snapshot.totals === "object" ? snapshot.totals : {};
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
    throw new Error("Reliability gate denominator is 0. Run runtime tool executions first.");
  }

  const successRate = success / denominator;
  const timeoutRate = timeout / denominator;
  const scopeTotals = readRuntimeToolScopeTotals(snapshot);
  const channelHealth = readRuntimeToolChannelHealth(snapshot);
  const circuitBreakers = readRuntimeToolCircuitBreakers(snapshot);
  const topFailedReasons = readRuntimeToolTopFailedReasons(snapshot);

  printScopeDiagnostics(scopeTotals);
  printCircuitBreakers(circuitBreakers);
  printTopFailedReasons(topFailedReasons);

  const failures = [];
  if (successRate < args.minSuccessRate) {
    failures.push(
      `overall success rate ${formatRuntimeToolPercent(successRate)} is below ${formatRuntimeToolPercent(args.minSuccessRate)}`
    );
  }
  if (timeoutRate > args.maxTimeoutRate) {
    failures.push(
      `timeout rate ${formatRuntimeToolPercent(timeoutRate)} exceeds ${formatRuntimeToolPercent(args.maxTimeoutRate)}`
    );
  }
  if (channelHealth.status !== "healthy") {
    failures.push(`metrics channel health must be healthy (actual: ${channelHealth.status})`);
  }

  for (const scope of CANONICAL_RUNTIME_TOOL_SCOPES) {
    const bucket = scopeTotals[scope];
    const scopeDenominator =
      bucket.success + bucket.validationFailed + bucket.runtimeFailed + bucket.timeout;
    if (scopeDenominator <= 0) {
      failures.push(`scope ${scope} has no completed outcomes`);
      continue;
    }
    const scopeSuccessRate = bucket.success / scopeDenominator;
    if (scopeSuccessRate < args.minScopeSuccessRate) {
      failures.push(
        `scope ${scope} success rate ${formatRuntimeToolPercent(scopeSuccessRate)} is below ${formatRuntimeToolPercent(args.minScopeSuccessRate)}`
      );
    }
  }

  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

try {
  main();
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${detail}\n`);
  process.exit(1);
}
