import {
  RUNTIME_CONTEXT_BUDGET_PREVIEW_MAX_BYTES,
  RUNTIME_CONTEXT_BUDGET_PREVIEW_MAX_CHARS,
} from "./runtimeContextBudget";
import { RUNTIME_MESSAGE_CODES } from "@ku0/code-runtime-client/runtimeMessageCodes";
import { createRuntimeError } from "@ku0/code-runtime-client/runtimeMessageEnvelope";

export const RUNTIME_TOOL_OUTPUT_MAX_BYTES = RUNTIME_CONTEXT_BUDGET_PREVIEW_MAX_BYTES;
export const RUNTIME_TOOL_OUTPUT_MAX_CHARS = RUNTIME_CONTEXT_BUDGET_PREVIEW_MAX_CHARS;

export type RuntimeToolOutputSpoolReference = {
  uri: string;
  byteCount: number;
  previewCharCount: number;
};

export type RuntimeToolOutputSummary = {
  truncated: boolean;
  preview: string;
  byteCount: number;
  previewByteCount: number;
  spoolReference: RuntimeToolOutputSpoolReference | null;
};

function toUtf8ByteLength(value: string): number {
  if (typeof TextEncoder === "function") {
    return new TextEncoder().encode(value).byteLength;
  }
  return value.length;
}

function sanitizeToolNameForSpoolUri(toolName: string): string {
  const normalized = toolName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  return normalized.length > 0 ? normalized.replace(/^-+|-+$/g, "") : "runtime-tool";
}

function hashText(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function summarizeRuntimeToolOutput(input: {
  toolName: string;
  output: string;
  maxBytes?: number;
  maxChars?: number;
}): RuntimeToolOutputSummary {
  const maxBytes =
    typeof input.maxBytes === "number" && Number.isFinite(input.maxBytes) && input.maxBytes > 0
      ? Math.floor(input.maxBytes)
      : RUNTIME_TOOL_OUTPUT_MAX_BYTES;
  const maxChars =
    typeof input.maxChars === "number" && Number.isFinite(input.maxChars) && input.maxChars > 0
      ? Math.floor(input.maxChars)
      : RUNTIME_TOOL_OUTPUT_MAX_CHARS;
  const byteCount = toUtf8ByteLength(input.output);
  const truncated = input.output.length > maxChars || byteCount > maxBytes;
  const preview = truncated ? input.output.slice(0, maxChars) : input.output;
  const previewByteCount = toUtf8ByteLength(preview);
  if (!truncated) {
    return {
      truncated,
      preview,
      byteCount,
      previewByteCount,
      spoolReference: null,
    };
  }
  const spoolFileName = `${sanitizeToolNameForSpoolUri(input.toolName)}-${hashText(input.output)}.txt`;
  return {
    truncated: true,
    preview,
    byteCount,
    previewByteCount,
    spoolReference: {
      uri: `.code-runtime/spool/${spoolFileName}`,
      byteCount,
      previewCharCount: preview.length,
    },
  };
}

export function toOptionalBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export function toNonNegativeInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const parsed = Math.floor(value);
  return parsed < 0 ? null : parsed;
}

export function methodUnavailableError(
  toolName: string,
  methodName: string,
  customMessage?: string
): Error {
  return createRuntimeError({
    code: RUNTIME_MESSAGE_CODES.runtime.validation.methodUnavailable,
    message:
      customMessage ??
      `Tool ${toolName} is unavailable because runtime control method ${methodName} is not implemented.`,
  });
}

export function requiredInputError(message: string): Error {
  return createRuntimeError({
    code: RUNTIME_MESSAGE_CODES.runtime.validation.inputRequired,
    message,
  });
}

export function invalidInputError(message: string): Error {
  return createRuntimeError({
    code: RUNTIME_MESSAGE_CODES.runtime.validation.inputInvalid,
    message,
  });
}

export function pathOutsideWorkspaceError(message: string): Error {
  return createRuntimeError({
    code: RUNTIME_MESSAGE_CODES.runtime.validation.pathOutsideWorkspace,
    message,
  });
}

export function payloadTooLargeError(message: string): Error {
  return createRuntimeError({
    code: RUNTIME_MESSAGE_CODES.runtime.validation.payloadTooLargeStrict,
    message,
  });
}

export function commandRestrictedError(message: string): Error {
  return createRuntimeError({
    code: RUNTIME_MESSAGE_CODES.runtime.validation.commandRestricted,
    message,
  });
}

export function resourceNotFoundError(message: string): Error {
  return createRuntimeError({
    code: RUNTIME_MESSAGE_CODES.runtime.validation.resourceNotFound,
    message,
  });
}

export function blockedRequestError(message: string): Error {
  return createRuntimeError({
    code: RUNTIME_MESSAGE_CODES.runtime.validation.requestBlocked,
    message,
  });
}
