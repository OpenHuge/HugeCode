import type {
  RuntimeToolExecutionEvent,
  RuntimeToolExecutionScope,
  RuntimeToolExecutionStatus,
  RuntimeToolGuardrailEvaluateRequest,
  RuntimeToolGuardrailEvaluateResult,
  RuntimeToolGuardrailOutcomeEvent,
} from "@ku0/code-runtime-host-contract";
import { logger } from "./logger";
import { getErrorMessage } from "@ku0/code-runtime-client/runtimeClientErrorUtils";
import { readRuntimeErrorCode } from "@ku0/code-runtime-client/runtimeErrorClassifier";
import { RUNTIME_MESSAGE_CODES } from "@ku0/code-runtime-client/runtimeMessageCodes";
import { createRuntimeError } from "@ku0/code-runtime-client/runtimeMessageEnvelope";
import {
  runtimeToolGuardrailEvaluate,
  runtimeToolGuardrailRecordOutcome,
  runtimeToolMetricsRecord,
} from "./runtimeControlBridge";

type RuntimeToolMetricsRecordFn = (events: RuntimeToolExecutionEvent[]) => Promise<unknown>;
type RuntimeToolGuardrailEvaluateFn = (
  request: RuntimeToolGuardrailEvaluateRequest
) => Promise<RuntimeToolGuardrailEvaluateResult>;
type RuntimeToolGuardrailRecordOutcomeFn = (
  event: RuntimeToolGuardrailOutcomeEvent
) => Promise<unknown>;

const RUNTIME_TOOL_EXECUTION_TELEMETRY_RECENT_LIMIT = 40;

let runtimeToolMetricsRecordOverride: RuntimeToolMetricsRecordFn | null = null;
let runtimeToolGuardrailEvaluateOverride: RuntimeToolGuardrailEvaluateFn | null = null;
let runtimeToolGuardrailRecordOutcomeOverride: RuntimeToolGuardrailRecordOutcomeFn | null = null;

type RuntimeToolExecutionEventMetadata = {
  traceId?: string | null;
  spanId?: string | null;
  parentSpanId?: string | null;
  attempt?: number | null;
  requestId?: string | null;
  plannerStepKey?: string | null;
  workspaceId?: string | null;
  capabilityProfile?: "default" | "solo-max" | null;
};

export type RuntimeToolExecutionTelemetryEvent =
  | ({ kind: "execution" } & RuntimeToolExecutionEvent)
  | {
      kind: "guardrail_evaluated";
      toolName: string;
      scope: RuntimeToolExecutionScope;
      at: number;
      workspaceId: string | null;
      status: "allowed" | "blocked";
      errorCode: string | null;
      requestId: string | null;
      traceId: string | null;
      spanId: string | null;
      parentSpanId: string | null;
      plannerStepKey: string | null;
      attempt: number | null;
      result: RuntimeToolGuardrailEvaluateResult;
    }
  | ({
      kind: "guardrail_outcome";
    } & RuntimeToolGuardrailOutcomeEvent);

export type RuntimeToolExecutionTelemetrySnapshot = {
  revision: number;
  lastEvent: RuntimeToolExecutionTelemetryEvent | null;
  recentEvents: RuntimeToolExecutionTelemetryEvent[];
};

const runtimeToolExecutionTelemetryListeners = new Set<
  (event: RuntimeToolExecutionTelemetryEvent) => void
>();
const runtimeToolExecutionTelemetrySnapshotListeners = new Set<() => void>();

let runtimeToolExecutionTelemetrySnapshot: RuntimeToolExecutionTelemetrySnapshot = {
  revision: 0,
  lastEvent: null,
  recentEvents: [],
};

function notifyRuntimeToolExecutionTelemetryListener(
  listener: (event: RuntimeToolExecutionTelemetryEvent) => void,
  event: RuntimeToolExecutionTelemetryEvent
): void {
  try {
    listener(event);
  } catch (error) {
    logger.error("[runtime][tool-metrics] telemetry listener failed", error);
  }
}

function notifyRuntimeToolExecutionTelemetrySnapshotListener(listener: () => void): void {
  try {
    listener();
  } catch (error) {
    logger.error("[runtime][tool-metrics] telemetry snapshot listener failed", error);
  }
}

function publishRuntimeToolExecutionTelemetry(event: RuntimeToolExecutionTelemetryEvent): void {
  runtimeToolExecutionTelemetrySnapshot = {
    revision: runtimeToolExecutionTelemetrySnapshot.revision + 1,
    lastEvent: event,
    recentEvents: [...runtimeToolExecutionTelemetrySnapshot.recentEvents, event].slice(
      -RUNTIME_TOOL_EXECUTION_TELEMETRY_RECENT_LIMIT
    ),
  };

  for (const listener of runtimeToolExecutionTelemetryListeners) {
    notifyRuntimeToolExecutionTelemetryListener(listener, event);
  }
  for (const listener of runtimeToolExecutionTelemetrySnapshotListeners) {
    notifyRuntimeToolExecutionTelemetrySnapshotListener(listener);
  }
}

function resolveRuntimeToolMetricsRecordFn(): RuntimeToolMetricsRecordFn {
  if (runtimeToolMetricsRecordOverride) {
    return runtimeToolMetricsRecordOverride;
  }
  return async (events) => runtimeToolMetricsRecord(events);
}

function resolveRuntimeToolGuardrailEvaluateFn(): RuntimeToolGuardrailEvaluateFn {
  if (runtimeToolGuardrailEvaluateOverride) {
    return runtimeToolGuardrailEvaluateOverride;
  }
  return async (request) => runtimeToolGuardrailEvaluate(request);
}

function resolveRuntimeToolGuardrailRecordOutcomeFn(): RuntimeToolGuardrailRecordOutcomeFn {
  if (runtimeToolGuardrailRecordOutcomeOverride) {
    return runtimeToolGuardrailRecordOutcomeOverride;
  }
  return async (event) => runtimeToolGuardrailRecordOutcome(event);
}

function toMetricsUnavailableError(input: {
  toolName: string;
  phase: "attempted" | "started" | "guardrail_evaluate";
  cause: unknown;
}): Error {
  const causeCode = readRuntimeErrorCode(input.cause);
  const causeMessage = getErrorMessage(input.cause);
  if (causeCode === "INVALID_PARAMS") {
    const details = causeMessage.length > 0 ? ` Cause: ${causeMessage}` : "";
    return createRuntimeError({
      code: "INVALID_PARAMS",
      message: `Runtime tool telemetry payload is invalid while recording ${input.phase} for ${input.toolName}.${details}`,
    });
  }
  const details = causeMessage.length > 0 ? ` Cause: ${causeMessage}` : "";
  return createRuntimeError({
    code: RUNTIME_MESSAGE_CODES.runtime.validation.metricsUnavailable,
    message: `Runtime tool metrics channel is unavailable while recording ${input.phase} for ${input.toolName}.${details}`,
  });
}

async function recordStrict(
  event: RuntimeToolExecutionEvent & { phase: "attempted" | "started" }
): Promise<void> {
  try {
    await resolveRuntimeToolMetricsRecordFn()([event]);
    publishRuntimeToolExecutionTelemetry({
      kind: "execution",
      ...event,
    });
  } catch (error) {
    throw toMetricsUnavailableError({
      toolName: event.toolName,
      phase: event.phase,
      cause: error,
    });
  }
}

async function recordBestEffort(event: RuntimeToolExecutionEvent): Promise<void> {
  try {
    await resolveRuntimeToolMetricsRecordFn()([event]);
  } catch (error) {
    logger.warn(
      `[runtime][tool-metrics] failed to record ${event.phase} event for ${event.toolName}: ${getErrorMessage(
        error
      )}`
    );
  } finally {
    publishRuntimeToolExecutionTelemetry({
      kind: "execution",
      ...event,
    });
  }
}

export async function reportRuntimeToolExecutionAttempted(input: {
  toolName: string;
  scope: RuntimeToolExecutionScope;
  at?: number;
  metadata?: RuntimeToolExecutionEventMetadata;
}): Promise<void> {
  await recordStrict({
    toolName: input.toolName,
    scope: input.scope,
    phase: "attempted",
    at: typeof input.at === "number" && Number.isFinite(input.at) ? input.at : Date.now(),
    ...input.metadata,
  });
}

export async function reportRuntimeToolExecutionStarted(input: {
  toolName: string;
  scope: RuntimeToolExecutionScope;
  at?: number;
  metadata?: RuntimeToolExecutionEventMetadata;
}): Promise<void> {
  await recordStrict({
    toolName: input.toolName,
    scope: input.scope,
    phase: "started",
    at: typeof input.at === "number" && Number.isFinite(input.at) ? input.at : Date.now(),
    ...input.metadata,
  });
}

export async function reportRuntimeToolExecutionCompleted(input: {
  toolName: string;
  scope: RuntimeToolExecutionScope;
  status: RuntimeToolExecutionStatus;
  errorCode?: string | null;
  durationMs?: number | null;
  at?: number;
  metadata?: RuntimeToolExecutionEventMetadata;
}): Promise<void> {
  await recordBestEffort({
    toolName: input.toolName,
    scope: input.scope,
    phase: "completed",
    at: typeof input.at === "number" && Number.isFinite(input.at) ? input.at : Date.now(),
    status: input.status,
    errorCode: input.errorCode ?? null,
    durationMs: input.durationMs ?? null,
    ...input.metadata,
  });
}

export async function evaluateRuntimeToolGuardrail(input: {
  toolName: string;
  scope: RuntimeToolExecutionScope;
  payloadBytes: number;
  workspaceId?: string | null;
  at?: number;
  metadata?: RuntimeToolExecutionEventMetadata;
}): Promise<RuntimeToolGuardrailEvaluateResult> {
  const payloadBytes = Number.isFinite(input.payloadBytes)
    ? Math.max(0, Math.trunc(input.payloadBytes))
    : 0;
  try {
    const request = {
      toolName: input.toolName,
      scope: input.scope,
      workspaceId: input.workspaceId ?? null,
      payloadBytes,
      at: typeof input.at === "number" && Number.isFinite(input.at) ? input.at : Date.now(),
      requestId: input.metadata?.requestId ?? null,
      traceId: input.metadata?.traceId ?? null,
      spanId: input.metadata?.spanId ?? null,
      parentSpanId: input.metadata?.parentSpanId ?? null,
      plannerStepKey: input.metadata?.plannerStepKey ?? null,
      attempt: input.metadata?.attempt ?? null,
      capabilityProfile: input.metadata?.capabilityProfile ?? null,
    };
    const result = await resolveRuntimeToolGuardrailEvaluateFn()(request);
    publishRuntimeToolExecutionTelemetry({
      kind: "guardrail_evaluated",
      toolName: request.toolName,
      scope: request.scope,
      workspaceId: request.workspaceId ?? null,
      at: request.at ?? Date.now(),
      status: result.allowed ? "allowed" : "blocked",
      errorCode: result.errorCode ?? null,
      requestId: request.requestId ?? null,
      traceId: request.traceId ?? null,
      spanId: request.spanId ?? null,
      parentSpanId: request.parentSpanId ?? null,
      plannerStepKey: request.plannerStepKey ?? null,
      attempt: request.attempt ?? null,
      result,
    });
    return result;
  } catch (error) {
    throw toMetricsUnavailableError({
      toolName: input.toolName,
      phase: "guardrail_evaluate",
      cause: error,
    });
  }
}

export async function reportRuntimeToolGuardrailOutcome(input: {
  toolName: string;
  scope: RuntimeToolExecutionScope;
  status: RuntimeToolExecutionStatus;
  workspaceId?: string | null;
  errorCode?: string | null;
  durationMs?: number | null;
  at?: number;
  metadata?: RuntimeToolExecutionEventMetadata;
}): Promise<void> {
  const event: RuntimeToolGuardrailOutcomeEvent = {
    toolName: input.toolName,
    scope: input.scope,
    status: input.status,
    at: typeof input.at === "number" && Number.isFinite(input.at) ? input.at : Date.now(),
    workspaceId: input.workspaceId ?? null,
    durationMs: input.durationMs ?? null,
    errorCode: input.errorCode ?? null,
    requestId: input.metadata?.requestId ?? null,
    traceId: input.metadata?.traceId ?? null,
    spanId: input.metadata?.spanId ?? null,
    parentSpanId: input.metadata?.parentSpanId ?? null,
    plannerStepKey: input.metadata?.plannerStepKey ?? null,
    attempt: input.metadata?.attempt ?? null,
  };
  try {
    await resolveRuntimeToolGuardrailRecordOutcomeFn()(event);
  } catch (error) {
    logger.warn(
      `[runtime][tool-guardrail] failed to record outcome event for ${input.toolName}: ${getErrorMessage(
        error
      )}`
    );
  } finally {
    publishRuntimeToolExecutionTelemetry({
      kind: "guardrail_outcome",
      ...event,
    });
  }
}

export function getRuntimeToolExecutionTelemetrySnapshot(): RuntimeToolExecutionTelemetrySnapshot {
  return runtimeToolExecutionTelemetrySnapshot;
}

export function subscribeRuntimeToolExecutionTelemetryEvents(
  listener: (event: RuntimeToolExecutionTelemetryEvent) => void
): () => void {
  runtimeToolExecutionTelemetryListeners.add(listener);
  return () => {
    runtimeToolExecutionTelemetryListeners.delete(listener);
  };
}

export function subscribeRuntimeToolExecutionTelemetrySnapshot(listener: () => void): () => void {
  runtimeToolExecutionTelemetrySnapshotListeners.add(listener);
  return () => {
    runtimeToolExecutionTelemetrySnapshotListeners.delete(listener);
  };
}

export function __setRuntimeToolMetricsRecordOverrideForTests(
  override: RuntimeToolMetricsRecordFn | null
): void {
  runtimeToolMetricsRecordOverride = override;
}

export function __resetRuntimeToolMetricsRecordOverrideForTests(): void {
  runtimeToolMetricsRecordOverride = null;
}

export function __setRuntimeToolGuardrailEvaluateOverrideForTests(
  override: RuntimeToolGuardrailEvaluateFn | null
): void {
  runtimeToolGuardrailEvaluateOverride = override;
}

export function __resetRuntimeToolGuardrailEvaluateOverrideForTests(): void {
  runtimeToolGuardrailEvaluateOverride = null;
}

export function __setRuntimeToolGuardrailRecordOutcomeOverrideForTests(
  override: RuntimeToolGuardrailRecordOutcomeFn | null
): void {
  runtimeToolGuardrailRecordOutcomeOverride = override;
}

export function __resetRuntimeToolGuardrailRecordOutcomeOverrideForTests(): void {
  runtimeToolGuardrailRecordOutcomeOverride = null;
}

export function __resetRuntimeToolExecutionMetricsReporterObserversForTests(): void {
  runtimeToolExecutionTelemetryListeners.clear();
  runtimeToolExecutionTelemetrySnapshotListeners.clear();
  runtimeToolExecutionTelemetrySnapshot = {
    revision: 0,
    lastEvent: null,
    recentEvents: [],
  };
}

export function __resetRuntimeToolGuardrailOverridesForTests(): void {
  runtimeToolGuardrailEvaluateOverride = null;
  runtimeToolGuardrailRecordOutcomeOverride = null;
}
