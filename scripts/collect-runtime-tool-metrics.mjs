#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { DEFAULT_RUNTIME_TOOL_METRICS_OUTPUT_PATH } from "./lib/runtime-tool-metrics-path.mjs";

const DEFAULT_RPC_ENDPOINT = "http://127.0.0.1:8788/rpc";
const DEFAULT_OUTPUT_PATH = DEFAULT_RUNTIME_TOOL_METRICS_OUTPUT_PATH;
const DEFAULT_TIMEOUT_MS = 10_000;

const RPC_METHODS = {
  RECORD: "code_runtime_tool_metrics_record",
  READ: "code_runtime_tool_metrics_read",
  RESET: "code_runtime_tool_metrics_reset",
  GUARDRAIL_READ: "code_runtime_tool_guardrail_read",
};

function readArgValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

function parseTimeoutMs(value) {
  const timeoutMs = Number(value);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("--timeout-ms must be a positive number.");
  }
  return Math.floor(timeoutMs);
}

function parseArgs(argv) {
  const args = {
    endpoint:
      process.env.CODE_RUNTIME_GATEWAY_WEB_ENDPOINT ||
      process.env.VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT ||
      DEFAULT_RPC_ENDPOINT,
    outputPath: DEFAULT_OUTPUT_PATH,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    reset: false,
    probe: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    switch (token) {
      case "--endpoint":
        args.endpoint = readArgValue(argv, index, "--endpoint");
        index += 1;
        break;
      case "--output":
        args.outputPath = readArgValue(argv, index, "--output");
        index += 1;
        break;
      case "--timeout-ms":
        args.timeoutMs = parseTimeoutMs(readArgValue(argv, index, "--timeout-ms"));
        index += 1;
        break;
      case "--reset":
        args.reset = true;
        break;
      case "--probe":
        args.probe = true;
        break;
      default:
        break;
    }
  }

  return args;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function serializeUnknown(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

async function rpcCall(endpoint, method, timeoutMs, params = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        method,
        params,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`RPC request failed with HTTP ${response.status}.`);
    }

    const payload = await response.json().catch(() => null);
    if (!isRecord(payload)) {
      throw new Error("RPC response payload is not an object.");
    }

    if (payload.ok === false) {
      const error = isRecord(payload.error) ? payload.error : null;
      const code = typeof error?.code === "string" ? error.code.trim() : "";
      const message = typeof error?.message === "string" ? error.message.trim() : "";
      throw new Error(
        code.length > 0 || message.length > 0
          ? `${code.length > 0 ? `${code}: ` : ""}${message}`
          : `RPC method '${method}' returned an unknown error payload: ${serializeUnknown(
              payload.error
            )}`
      );
    }

    if ("result" in payload) {
      return payload.result;
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function buildProbeEvents() {
  const baseAt = Date.now();
  const scopes = [
    {
      scope: "write",
      toolName: "__runtime_tool_metrics_probe_write__",
    },
    {
      scope: "runtime",
      toolName: "__runtime_tool_metrics_probe_runtime__",
    },
    {
      scope: "computer_observe",
      toolName: "__runtime_tool_metrics_probe_computer_observe__",
    },
  ];

  return scopes.flatMap((entry, index) => {
    const at = baseAt + index * 3;
    return [
      {
        toolName: entry.toolName,
        scope: entry.scope,
        phase: "attempted",
        at,
      },
      {
        toolName: entry.toolName,
        scope: entry.scope,
        phase: "started",
        at: at + 1,
      },
      {
        toolName: entry.toolName,
        scope: entry.scope,
        phase: "completed",
        at: at + 2,
        status: "success",
        durationMs: 1,
      },
    ];
  });
}

function writeSnapshot(outputPath, payload) {
  const absolutePath = path.resolve(process.cwd(), outputPath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    JSON.stringify(
      {
        collectedAt: new Date().toISOString(),
        source: "runtime_rpc",
        ...payload,
      },
      null,
      2
    )
  );
  return absolutePath;
}

function mergeMetricsAndGuardrails(metricsSnapshot, guardrailSnapshot) {
  if (!isRecord(metricsSnapshot)) {
    return metricsSnapshot;
  }
  const merged = {
    ...metricsSnapshot,
  };
  if (isRecord(guardrailSnapshot)) {
    const channelHealth = guardrailSnapshot.channelHealth ?? guardrailSnapshot.channel_health;
    const circuitBreakers = guardrailSnapshot.circuitBreakers ?? guardrailSnapshot.circuit_breakers;
    if (channelHealth) {
      merged.channelHealth = channelHealth;
    }
    if (Array.isArray(circuitBreakers)) {
      merged.circuitBreakers = circuitBreakers;
    }
    if (
      typeof guardrailSnapshot.updatedAt === "number" &&
      Number.isFinite(guardrailSnapshot.updatedAt) &&
      (!merged.updatedAt ||
        (typeof merged.updatedAt === "number" && guardrailSnapshot.updatedAt > merged.updatedAt))
    ) {
      merged.updatedAt = Math.trunc(guardrailSnapshot.updatedAt);
    }
  }
  return merged;
}

async function main() {
  const { endpoint, outputPath, timeoutMs, reset, probe } = parseArgs(process.argv.slice(2));
  let method = RPC_METHODS.READ;
  let params = {};
  if (reset) {
    method = RPC_METHODS.RESET;
  } else if (probe) {
    method = RPC_METHODS.RECORD;
    params = {
      events: buildProbeEvents(),
    };
  }

  if (method !== RPC_METHODS.READ) {
    await rpcCall(endpoint, method, timeoutMs, params);
  }

  const metricsSnapshot = await rpcCall(endpoint, RPC_METHODS.READ, timeoutMs, {});
  const guardrailSnapshot = await rpcCall(endpoint, RPC_METHODS.GUARDRAIL_READ, timeoutMs, {});
  const snapshot = mergeMetricsAndGuardrails(metricsSnapshot, guardrailSnapshot);
  const output = writeSnapshot(outputPath, {
    snapshot,
    metricsSnapshot,
    guardrailSnapshot,
  });
  const action = reset ? "Reset" : probe ? "Probed" : "Collected";
  process.stdout.write(`${action} runtime tool metrics snapshot -> ${output}\n`);
}

main().catch((error) => {
  const detail = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${detail}\n`);
  process.exit(1);
});
