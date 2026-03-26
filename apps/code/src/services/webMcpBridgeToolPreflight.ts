import { logger } from "./logger";
import {
  isTimeoutLikeError,
  readRuntimeErrorCode,
} from "@ku0/code-runtime-client/runtimeErrorClassifier";
import { RUNTIME_MESSAGE_CODES } from "@ku0/code-runtime-client/runtimeMessageCodes";
import { createRuntimeError } from "@ku0/code-runtime-client/runtimeMessageEnvelope";
import {
  type RuntimeToolExecutionScope,
  recordRuntimeToolExecutionAttempt,
  recordRuntimeToolExecutionEnd,
  recordRuntimeToolExecutionStart,
} from "./runtimeToolExecutionMetrics";
import {
  evaluateRuntimeToolGuardrail,
  reportRuntimeToolExecutionAttempted,
  reportRuntimeToolExecutionCompleted,
  reportRuntimeToolExecutionStarted,
  reportRuntimeToolGuardrailOutcome,
} from "./runtimeToolExecutionMetricsReporter";
import type { WebMcpAgent } from "@ku0/code-runtime-webmcp-client/webMcpBridgeTypes";
import { WebMcpInputSchemaValidationError } from "@ku0/code-runtime-client/webMcpInputSchemaValidationError";
import { validateToolInputAgainstSchema } from "@ku0/code-runtime-client/webMcpToolInputSchemaValidation";
import {
  createDefaultRuntimeToolExecutionHooks,
  mergeRuntimeToolExecutionAnnotationCodes,
  runRuntimeToolExecutionFailureHooks,
  runRuntimeToolExecutionPreflightHooks,
  runRuntimeToolExecutionSuccessHooks,
} from "../application/runtime/facades/runtimeToolExecutionHooks";

type JsonRecord = Record<string, unknown>;

type WebMcpToolDescriptor = {
  name: string;
  inputSchema: JsonRecord;
  execute: (input: JsonRecord, agent: WebMcpAgent | null) => unknown;
};

type RuntimeToolEventMetadata = {
  traceId?: string | null;
  spanId?: string | null;
  parentSpanId?: string | null;
  attempt?: number | null;
  requestId?: string | null;
  plannerStepKey?: string | null;
  workspaceId?: string | null;
  capabilityProfile?: "default" | "solo-max" | null;
};

const DEFAULT_RUNTIME_TOOL_EXECUTION_HOOKS = [createDefaultRuntimeToolExecutionHooks()];

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readToolOutputTruncatedFlag(result: unknown): boolean {
  if (!isRecord(result)) {
    return false;
  }
  const data = isRecord(result.data) ? result.data : null;
  if (!data) {
    return false;
  }
  const toolOutput = isRecord(data.toolOutput) ? data.toolOutput : null;
  return toolOutput?.truncated === true;
}

function toOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toOptionalAttempt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const normalized = Math.trunc(value);
  return normalized >= 0 ? normalized : null;
}

function buildEventMetadataFromInput(input: JsonRecord): {
  traceId?: string | null;
  spanId?: string | null;
  parentSpanId?: string | null;
  attempt?: number | null;
  requestId?: string | null;
  plannerStepKey?: string | null;
  workspaceId?: string | null;
  capabilityProfile?: "default" | "solo-max" | null;
} {
  const explicitCapabilityProfile = toOptionalString(input.capabilityProfile);
  const accessMode = toOptionalString(input.accessMode);
  const inferredCapabilityProfile =
    explicitCapabilityProfile === "solo-max" || explicitCapabilityProfile === "default"
      ? explicitCapabilityProfile
      : accessMode === "full-access"
        ? "solo-max"
        : null;
  return {
    traceId: toOptionalString(input.traceId),
    spanId: toOptionalString(input.spanId),
    parentSpanId: toOptionalString(input.parentSpanId),
    attempt: toOptionalAttempt(input.attempt),
    requestId: toOptionalString(input.requestId),
    plannerStepKey: toOptionalString(input.plannerStepKey),
    workspaceId: toOptionalString(input.workspaceId),
    capabilityProfile: inferredCapabilityProfile,
  };
}

function toOptionalWorkspaceId(input: JsonRecord): string | null {
  return toOptionalString(input.workspaceId);
}

function toMetricsScope(scope: "write" | "runtime", toolName: string): RuntimeToolExecutionScope {
  if (scope === "runtime" && toolName === "run-runtime-computer-observe") {
    return "computer_observe";
  }
  return scope;
}

function isRuntimeMetricsDiagnosticsTool(toolName: string): boolean {
  return (
    toolName === "get-runtime-tool-execution-metrics" ||
    toolName === "get-runtime-tool-guardrail-state"
  );
}

function toPayloadBytes(input: JsonRecord): number {
  try {
    return new TextEncoder().encode(JSON.stringify(input)).length;
  } catch {
    return 0;
  }
}

function isRuntimeWorkspaceDryRun(toolName: string, input: JsonRecord): boolean {
  if (
    toolName !== "execute-workspace-command" &&
    toolName !== "write-workspace-file" &&
    toolName !== "edit-workspace-file"
  ) {
    return false;
  }
  return input.dryRun === true;
}

function buildGuardrailEffectiveLimitsSuffix(decision: {
  effectivePayloadLimitBytes?: number | null;
  effectiveComputerObserveRateLimitPerMinute?: number | null;
}): string {
  const payloadLimit =
    typeof decision.effectivePayloadLimitBytes === "number" &&
    Number.isFinite(decision.effectivePayloadLimitBytes)
      ? Math.max(0, Math.trunc(decision.effectivePayloadLimitBytes))
      : null;
  const computerObserveRateLimit =
    typeof decision.effectiveComputerObserveRateLimitPerMinute === "number" &&
    Number.isFinite(decision.effectiveComputerObserveRateLimitPerMinute)
      ? Math.max(0, Math.trunc(decision.effectiveComputerObserveRateLimitPerMinute))
      : null;
  if (payloadLimit === null || computerObserveRateLimit === null) {
    return "";
  }
  return ` (effective limits: payload<=${payloadLimit}B, computer_observe<=${computerObserveRateLimit}/min)`;
}

function toGuardrailRequired(
  isMetricsGateExemptTool: boolean,
  isWorkspaceDryRun: boolean
): boolean {
  return !isMetricsGateExemptTool && !isWorkspaceDryRun;
}

async function reportToolAttempted(input: {
  toolName: string;
  scope: RuntimeToolExecutionScope;
  metadata: RuntimeToolEventMetadata;
  exempt: boolean;
}): Promise<void> {
  if (input.exempt) {
    return;
  }
  await reportRuntimeToolExecutionAttempted({
    toolName: input.toolName,
    scope: input.scope,
    metadata: input.metadata,
  });
}

async function reportToolStarted(input: {
  toolName: string;
  scope: RuntimeToolExecutionScope;
  metadata: RuntimeToolEventMetadata;
  exempt: boolean;
}): Promise<void> {
  if (input.exempt) {
    return;
  }
  await reportRuntimeToolExecutionStarted({
    toolName: input.toolName,
    scope: input.scope,
    metadata: input.metadata,
  });
}

async function reportToolCompleted(input: {
  toolName: string;
  scope: RuntimeToolExecutionScope;
  status: "success" | "validation_failed" | "runtime_failed" | "timeout" | "blocked";
  errorCode?: string | null;
  durationMs: number;
  metadata: RuntimeToolEventMetadata;
  exempt: boolean;
}): Promise<void> {
  if (input.exempt) {
    return;
  }
  await reportRuntimeToolExecutionCompleted({
    toolName: input.toolName,
    scope: input.scope,
    status: input.status,
    errorCode: input.errorCode ?? null,
    durationMs: input.durationMs,
    metadata: input.metadata,
  });
}

function toRuntimeFailureStatus(error: unknown): {
  status: "runtime_failed" | "timeout" | "blocked";
  errorCode: string | null;
} {
  const errorCode = readRuntimeErrorCode(error);
  if (
    errorCode === RUNTIME_MESSAGE_CODES.runtime.validation.requestBlocked ||
    errorCode === RUNTIME_MESSAGE_CODES.runtime.validation.commandRestricted
  ) {
    return { status: "blocked", errorCode };
  }
  if (isTimeoutLikeError(error)) {
    return { status: "timeout", errorCode };
  }
  return { status: "runtime_failed", errorCode };
}

export function wrapToolsWithInputSchemaPreflight<TTool extends WebMcpToolDescriptor>(
  tools: TTool[],
  scope: "write" | "runtime"
): TTool[] {
  return tools.map((tool) => ({
    ...tool,
    execute: async (input, agent) => {
      const metricScope = toMetricsScope(scope, tool.name);
      const metadata = buildEventMetadataFromInput(input);
      const workspaceId = toOptionalWorkspaceId(input);
      const isMetricsGateExemptTool = isRuntimeMetricsDiagnosticsTool(tool.name);
      const isWorkspaceDryRun = isRuntimeWorkspaceDryRun(tool.name, input);
      const guardrailRequired = toGuardrailRequired(isMetricsGateExemptTool, isWorkspaceDryRun);
      await reportToolAttempted({
        toolName: tool.name,
        scope: metricScope,
        metadata,
        exempt: isMetricsGateExemptTool,
      });
      recordRuntimeToolExecutionAttempt(tool.name, metricScope);
      if (guardrailRequired) {
        const guardrailDecision = await evaluateRuntimeToolGuardrail({
          toolName: tool.name,
          scope: metricScope,
          payloadBytes: toPayloadBytes(input),
          workspaceId,
          metadata,
        });
        if (!guardrailDecision.allowed) {
          const preflightAnnotations = await runRuntimeToolExecutionPreflightHooks(
            DEFAULT_RUNTIME_TOOL_EXECUTION_HOOKS,
            {
              toolName: tool.name,
              scope: metricScope,
              workspaceId,
              isMetricsDiagnosticsTool: isMetricsGateExemptTool,
              isWorkspaceDryRun,
              guardrailRequired,
              validationWarnings: [],
              validationExtraFields: [],
            }
          );
          const guardrailCode =
            typeof guardrailDecision.errorCode === "string" &&
            guardrailDecision.errorCode.trim().length > 0
              ? guardrailDecision.errorCode.trim()
              : RUNTIME_MESSAGE_CODES.runtime.validation.requestBlocked;
          const guardrailMessage =
            typeof guardrailDecision.message === "string" &&
            guardrailDecision.message.trim().length > 0
              ? guardrailDecision.message.trim()
              : `Tool ${tool.name} blocked by runtime guardrail.`;
          const guardrailMessageWithLimits = `${guardrailMessage}${buildGuardrailEffectiveLimitsSuffix(
            guardrailDecision
          )}`;
          const failureAnnotations = await runRuntimeToolExecutionFailureHooks(
            DEFAULT_RUNTIME_TOOL_EXECUTION_HOOKS,
            {
              toolName: tool.name,
              scope: metricScope,
              workspaceId,
              status: "blocked",
              errorCode: guardrailCode,
              durationMs: 0,
            }
          );
          const annotations = mergeRuntimeToolExecutionAnnotationCodes(
            preflightAnnotations,
            failureAnnotations
          );
          await reportToolCompleted({
            toolName: tool.name,
            scope: metricScope,
            status: "blocked",
            errorCode: guardrailCode,
            durationMs: 0,
            metadata,
            exempt: isMetricsGateExemptTool,
          });
          recordRuntimeToolExecutionEnd({
            toolName: tool.name,
            scope: metricScope,
            status: "blocked",
            errorCode: guardrailCode,
            durationMs: 0,
            annotations,
          });
          await reportRuntimeToolGuardrailOutcome({
            toolName: tool.name,
            scope: metricScope,
            status: "blocked",
            workspaceId,
            errorCode: guardrailCode,
            durationMs: 0,
            metadata,
          });
          throw createRuntimeError({
            code: guardrailCode,
            message: guardrailMessageWithLimits,
          });
        }
      }
      const validation = validateToolInputAgainstSchema(input, tool.inputSchema);
      const preflightAnnotations = await runRuntimeToolExecutionPreflightHooks(
        DEFAULT_RUNTIME_TOOL_EXECUTION_HOOKS,
        {
          toolName: tool.name,
          scope: metricScope,
          workspaceId,
          isMetricsDiagnosticsTool: isMetricsGateExemptTool,
          isWorkspaceDryRun,
          guardrailRequired,
          validationWarnings: validation.warnings,
          validationExtraFields: validation.extraFields,
        }
      );
      if (validation.extraFields.length > 0) {
        logger.warn(
          `[webmcp][${scope}] ${tool.name} received unexpected input fields: ${validation.extraFields.join(
            ", "
          )}`,
          {
            scope,
            toolName: tool.name,
            extraFields: validation.extraFields,
            warnings: validation.warnings,
          }
        );
      } else if (validation.warnings.length > 0) {
        logger.warn(
          `[webmcp][${scope}] ${tool.name} input warnings: ${validation.warnings.join("; ")}`,
          {
            scope,
            toolName: tool.name,
            warnings: validation.warnings,
          }
        );
      }
      if (validation.errors.length > 0) {
        const failureAnnotations = await runRuntimeToolExecutionFailureHooks(
          DEFAULT_RUNTIME_TOOL_EXECUTION_HOOKS,
          {
            toolName: tool.name,
            scope: metricScope,
            workspaceId,
            status: "validation_failed",
            errorCode: "INPUT_SCHEMA_VALIDATION_FAILED",
            durationMs: 0,
          }
        );
        const annotations = mergeRuntimeToolExecutionAnnotationCodes(
          preflightAnnotations,
          failureAnnotations
        );
        await reportToolCompleted({
          toolName: tool.name,
          scope: metricScope,
          status: "validation_failed",
          errorCode: "INPUT_SCHEMA_VALIDATION_FAILED",
          durationMs: 0,
          metadata,
          exempt: isMetricsGateExemptTool,
        });
        recordRuntimeToolExecutionEnd({
          toolName: tool.name,
          scope: metricScope,
          status: "validation_failed",
          errorCode: "INPUT_SCHEMA_VALIDATION_FAILED",
          durationMs: 0,
          annotations,
        });
        if (!isMetricsGateExemptTool) {
          await reportRuntimeToolGuardrailOutcome({
            toolName: tool.name,
            scope: metricScope,
            status: "validation_failed",
            workspaceId,
            errorCode: "INPUT_SCHEMA_VALIDATION_FAILED",
            durationMs: 0,
            metadata,
          });
        }
        throw new WebMcpInputSchemaValidationError({
          toolName: tool.name,
          scope,
          validation,
        });
      }
      await reportToolStarted({
        toolName: tool.name,
        scope: metricScope,
        metadata,
        exempt: isMetricsGateExemptTool,
      });
      recordRuntimeToolExecutionStart(tool.name, metricScope);
      const startedAt = Date.now();
      try {
        const result = await tool.execute(input, agent);
        const truncatedOutput = readToolOutputTruncatedFlag(result);
        const successAnnotations = await runRuntimeToolExecutionSuccessHooks(
          DEFAULT_RUNTIME_TOOL_EXECUTION_HOOKS,
          {
            toolName: tool.name,
            scope: metricScope,
            workspaceId,
            truncatedOutput,
            durationMs: Date.now() - startedAt,
          }
        );
        const annotations = mergeRuntimeToolExecutionAnnotationCodes(
          preflightAnnotations,
          successAnnotations
        );
        await reportToolCompleted({
          toolName: tool.name,
          scope: metricScope,
          status: "success",
          durationMs: Date.now() - startedAt,
          metadata,
          exempt: isMetricsGateExemptTool,
        });
        recordRuntimeToolExecutionEnd({
          toolName: tool.name,
          scope: metricScope,
          status: "success",
          durationMs: Date.now() - startedAt,
          truncatedOutput,
          annotations,
        });
        if (!isMetricsGateExemptTool) {
          await reportRuntimeToolGuardrailOutcome({
            toolName: tool.name,
            scope: metricScope,
            status: "success",
            workspaceId,
            durationMs: Date.now() - startedAt,
            metadata,
          });
        }
        return result;
      } catch (error) {
        const failure = toRuntimeFailureStatus(error);
        const failureAnnotations = await runRuntimeToolExecutionFailureHooks(
          DEFAULT_RUNTIME_TOOL_EXECUTION_HOOKS,
          {
            toolName: tool.name,
            scope: metricScope,
            workspaceId,
            status: failure.status,
            errorCode: failure.errorCode,
            durationMs: Date.now() - startedAt,
          }
        );
        const annotations = mergeRuntimeToolExecutionAnnotationCodes(
          preflightAnnotations,
          failureAnnotations
        );
        await reportToolCompleted({
          toolName: tool.name,
          scope: metricScope,
          status: failure.status,
          errorCode: failure.errorCode,
          durationMs: Date.now() - startedAt,
          metadata,
          exempt: isMetricsGateExemptTool,
        });
        recordRuntimeToolExecutionEnd({
          toolName: tool.name,
          scope: metricScope,
          status: failure.status,
          errorCode: failure.errorCode,
          durationMs: Date.now() - startedAt,
          annotations,
        });
        if (!isMetricsGateExemptTool) {
          await reportRuntimeToolGuardrailOutcome({
            toolName: tool.name,
            scope: metricScope,
            status: failure.status,
            workspaceId,
            errorCode: failure.errorCode,
            durationMs: Date.now() - startedAt,
            metadata,
          });
        }
        throw error;
      }
    },
  }));
}
