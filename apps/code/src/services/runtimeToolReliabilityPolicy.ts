import { RUNTIME_MESSAGE_CODES } from "./runtimeMessageCodes";
import {
  type RuntimeToolExecutionScope,
  type RuntimeToolExecutionSnapshot,
  type RuntimeToolExecutionStatus,
  readRuntimeToolExecutionMetrics,
} from "./runtimeToolExecutionMetrics";
import { RUNTIME_TOOL_DEFAULT_PAYLOAD_MAX_BYTES } from "./webMcpBridgeRuntimeToolGuards";

export const RUNTIME_TOOL_MAX_INPUT_BYTES = RUNTIME_TOOL_DEFAULT_PAYLOAD_MAX_BYTES;
export const COMPUTER_OBSERVE_RATE_LIMIT_PER_MINUTE = 12;
export const COMPUTER_OBSERVE_RATE_WINDOW_MS = 60 * 1000;
export const RUNTIME_TOOL_CIRCUIT_OPEN_MS = 10 * 60 * 1000;
export const RUNTIME_TOOL_CIRCUIT_RECENT_WINDOW = 50;
export const RUNTIME_TOOL_CIRCUIT_MIN_COMPLETED = 20;
export const RUNTIME_TOOL_CIRCUIT_MIN_SUCCESS_RATE = 0.8;
export const RUNTIME_TOOL_HALF_OPEN_MAX_PROBES = 3;
export const RUNTIME_TOOL_HALF_OPEN_REQUIRED_SUCCESSES = 2;

type RuntimeToolCircuitStateValue = "closed" | "open" | "half_open";

export type RuntimeToolCircuitState = {
  state: RuntimeToolCircuitStateValue;
  openedAt: number | null;
  updatedAt: number;
  halfOpenProbeAttempts: number;
  halfOpenProbeSuccesses: number;
};

export type RuntimeToolReliabilityBlockReason =
  | "payload_too_large"
  | "rate_limited"
  | "circuit_open"
  | "metrics_unhealthy";

export type RuntimeToolReliabilityDecision =
  | {
      allowed: true;
      scope: RuntimeToolExecutionScope;
    }
  | {
      allowed: false;
      scope: RuntimeToolExecutionScope;
      reason: RuntimeToolReliabilityBlockReason;
      code: string;
      message: string;
    };

type EvaluateRuntimeToolReliabilityInput = {
  toolName: string;
  scope: RuntimeToolExecutionScope;
  workspaceId?: string | null;
  payload: Record<string, unknown>;
  nowMs?: number;
  snapshotOverride?: RuntimeToolExecutionSnapshot;
};

type CompleteRuntimeToolReliabilityInput = {
  scope: RuntimeToolExecutionScope;
  status: RuntimeToolExecutionStatus;
  nowMs?: number;
};

const circuitStateByScope: Record<RuntimeToolExecutionScope, RuntimeToolCircuitState> = {
  write: createClosedCircuitState(0),
  runtime: createClosedCircuitState(0),
  computer_observe: createClosedCircuitState(0),
};

const computerObserveCallsByWorkspace = new Map<string, number[]>();

function createClosedCircuitState(nowMs: number): RuntimeToolCircuitState {
  return {
    state: "closed",
    openedAt: null,
    updatedAt: nowMs,
    halfOpenProbeAttempts: 0,
    halfOpenProbeSuccesses: 0,
  };
}

function createOpenCircuitState(nowMs: number): RuntimeToolCircuitState {
  return {
    state: "open",
    openedAt: nowMs,
    updatedAt: nowMs,
    halfOpenProbeAttempts: 0,
    halfOpenProbeSuccesses: 0,
  };
}

function toPayloadBytes(payload: Record<string, unknown>): number {
  try {
    return new TextEncoder().encode(JSON.stringify(payload)).length;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

function isHealthyRecentSuccessRate(
  scope: RuntimeToolExecutionScope,
  snapshot: RuntimeToolExecutionSnapshot
): boolean {
  const recent = snapshot.recent
    .filter((entry) => entry.scope === scope)
    .slice(0, RUNTIME_TOOL_CIRCUIT_RECENT_WINDOW);
  if (recent.length < RUNTIME_TOOL_CIRCUIT_MIN_COMPLETED) {
    return true;
  }
  let success = 0;
  let denominator = 0;
  for (const entry of recent) {
    if (entry.status === "success") {
      success += 1;
      denominator += 1;
      continue;
    }
    if (
      entry.status === "validation_failed" ||
      entry.status === "runtime_failed" ||
      entry.status === "timeout"
    ) {
      denominator += 1;
    }
  }
  if (denominator <= 0) {
    return true;
  }
  return success / denominator >= RUNTIME_TOOL_CIRCUIT_MIN_SUCCESS_RATE;
}

function transitionCircuitToHalfOpen(
  scope: RuntimeToolExecutionScope,
  nowMs: number
): RuntimeToolCircuitState {
  const next: RuntimeToolCircuitState = {
    state: "half_open",
    openedAt: null,
    updatedAt: nowMs,
    halfOpenProbeAttempts: 0,
    halfOpenProbeSuccesses: 0,
  };
  circuitStateByScope[scope] = next;
  return next;
}

function transitionCircuitToClosed(scope: RuntimeToolExecutionScope, nowMs: number): void {
  circuitStateByScope[scope] = createClosedCircuitState(nowMs);
}

function transitionCircuitToOpen(scope: RuntimeToolExecutionScope, nowMs: number): void {
  circuitStateByScope[scope] = createOpenCircuitState(nowMs);
}

function blockDecision(
  scope: RuntimeToolExecutionScope,
  reason: RuntimeToolReliabilityBlockReason,
  message: string
): RuntimeToolReliabilityDecision {
  let code: string = RUNTIME_MESSAGE_CODES.runtime.validation.metricsUnavailable;
  if (reason === "payload_too_large") {
    code = RUNTIME_MESSAGE_CODES.runtime.validation.payloadTooLargeStrict;
  } else if (reason === "rate_limited") {
    code = RUNTIME_MESSAGE_CODES.runtime.validation.rateLimited;
  } else if (reason === "circuit_open") {
    code = RUNTIME_MESSAGE_CODES.runtime.validation.circuitOpen;
  } else if (reason === "metrics_unhealthy") {
    code = RUNTIME_MESSAGE_CODES.runtime.validation.metricsUnhealthy;
  }
  return {
    allowed: false,
    scope,
    reason,
    code,
    message,
  };
}

export function evaluateRuntimeToolReliability(
  input: EvaluateRuntimeToolReliabilityInput
): RuntimeToolReliabilityDecision {
  const nowMs =
    typeof input.nowMs === "number" && Number.isFinite(input.nowMs) ? input.nowMs : Date.now();
  const payloadBytes = toPayloadBytes(input.payload);
  if (payloadBytes > RUNTIME_TOOL_MAX_INPUT_BYTES) {
    return blockDecision(
      input.scope,
      "payload_too_large",
      `Tool ${input.toolName} blocked because input payload is ${payloadBytes} bytes (limit ${RUNTIME_TOOL_MAX_INPUT_BYTES} bytes).`
    );
  }

  const snapshot = input.snapshotOverride ?? readRuntimeToolExecutionMetrics();
  if (!snapshot || !Array.isArray(snapshot.recent)) {
    return blockDecision(
      input.scope,
      "metrics_unhealthy",
      `Tool ${input.toolName} blocked because runtime metrics are unavailable.`
    );
  }

  if (!isHealthyRecentSuccessRate(input.scope, snapshot)) {
    transitionCircuitToOpen(input.scope, nowMs);
  }

  const currentCircuit = circuitStateByScope[input.scope];
  if (currentCircuit.state === "open") {
    const openedAt = currentCircuit.openedAt ?? currentCircuit.updatedAt;
    if (nowMs - openedAt < RUNTIME_TOOL_CIRCUIT_OPEN_MS) {
      return blockDecision(
        input.scope,
        "circuit_open",
        `Tool ${input.toolName} blocked by reliability circuit (${input.scope}); cooldown in progress.`
      );
    }
    transitionCircuitToHalfOpen(input.scope, nowMs);
  }

  if (input.scope === "computer_observe") {
    const workspaceKey = (input.workspaceId ?? "").trim() || "__workspace_unknown__";
    const existing = computerObserveCallsByWorkspace.get(workspaceKey) ?? [];
    const lowerBound = nowMs - COMPUTER_OBSERVE_RATE_WINDOW_MS;
    const withinWindow = existing.filter((timestamp) => timestamp >= lowerBound);
    if (withinWindow.length >= COMPUTER_OBSERVE_RATE_LIMIT_PER_MINUTE) {
      computerObserveCallsByWorkspace.set(workspaceKey, withinWindow);
      return blockDecision(
        input.scope,
        "rate_limited",
        `Tool ${input.toolName} blocked by computer-observe rate limit (${COMPUTER_OBSERVE_RATE_LIMIT_PER_MINUTE}/min per workspace).`
      );
    }
    withinWindow.push(nowMs);
    computerObserveCallsByWorkspace.set(workspaceKey, withinWindow);
  }

  const nextCircuit = circuitStateByScope[input.scope];
  if (nextCircuit.state === "half_open") {
    nextCircuit.halfOpenProbeAttempts += 1;
    nextCircuit.updatedAt = nowMs;
  }

  return {
    allowed: true,
    scope: input.scope,
  };
}

export function recordRuntimeToolReliabilityOutcome(
  input: CompleteRuntimeToolReliabilityInput
): void {
  const nowMs =
    typeof input.nowMs === "number" && Number.isFinite(input.nowMs) ? input.nowMs : Date.now();
  const circuit = circuitStateByScope[input.scope];
  if (circuit.state !== "half_open") {
    return;
  }
  if (input.status === "success") {
    circuit.halfOpenProbeSuccesses += 1;
  }
  circuit.updatedAt = nowMs;
  if (circuit.halfOpenProbeAttempts < RUNTIME_TOOL_HALF_OPEN_MAX_PROBES) {
    return;
  }
  if (circuit.halfOpenProbeSuccesses >= RUNTIME_TOOL_HALF_OPEN_REQUIRED_SUCCESSES) {
    transitionCircuitToClosed(input.scope, nowMs);
    return;
  }
  transitionCircuitToOpen(input.scope, nowMs);
}

export function readRuntimeToolReliabilityCircuitState(
  scope: RuntimeToolExecutionScope
): RuntimeToolCircuitState {
  return { ...circuitStateByScope[scope] };
}

export function __resetRuntimeToolReliabilityPolicyForTests(): void {
  circuitStateByScope.write = createClosedCircuitState(0);
  circuitStateByScope.runtime = createClosedCircuitState(0);
  circuitStateByScope.computer_observe = createClosedCircuitState(0);
  computerObserveCallsByWorkspace.clear();
}
