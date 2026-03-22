import type { SchemaValidationResult } from "./webMcpToolInputSchemaValidation";

export type WebMcpInputSchemaValidationScope =
  | "write"
  | "runtime"
  | "createMessage"
  | "elicitInput";

type WebMcpInputSchemaValidationErrorParams = {
  toolName: string;
  scope: WebMcpInputSchemaValidationScope;
  validation: SchemaValidationResult;
};

const EMPTY_SCHEMA_VALIDATION_RESULT: SchemaValidationResult = {
  errors: [],
  warnings: [],
  missingRequired: [],
  typeMismatches: [],
  extraFields: [],
};

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

export function cloneSchemaValidationResult(
  value: SchemaValidationResult | null | undefined
): SchemaValidationResult {
  if (!value) {
    return { ...EMPTY_SCHEMA_VALIDATION_RESULT };
  }
  return {
    errors: [...value.errors],
    warnings: [...value.warnings],
    missingRequired: [...value.missingRequired],
    typeMismatches: [...value.typeMismatches],
    extraFields: [...value.extraFields],
  };
}

function isValidationScope(value: unknown): value is WebMcpInputSchemaValidationScope {
  return (
    value === "write" || value === "runtime" || value === "createMessage" || value === "elicitInput"
  );
}

function isSchemaValidationResultLike(value: unknown): value is SchemaValidationResult {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    Array.isArray(record.errors) &&
    Array.isArray(record.warnings) &&
    Array.isArray(record.missingRequired) &&
    Array.isArray(record.typeMismatches) &&
    Array.isArray(record.extraFields)
  );
}

export function normalizeSchemaValidationResult(value: unknown): SchemaValidationResult {
  if (!isSchemaValidationResultLike(value)) {
    return cloneSchemaValidationResult(EMPTY_SCHEMA_VALIDATION_RESULT);
  }
  const record = value as Record<string, unknown>;
  return {
    errors: toStringArray(record.errors),
    warnings: toStringArray(record.warnings),
    missingRequired: toStringArray(record.missingRequired),
    typeMismatches: toStringArray(record.typeMismatches),
    extraFields: toStringArray(record.extraFields),
  };
}

function extractSchemaValidationResultFromRecord(
  value: Record<string, unknown>,
  seen: Set<unknown>
): SchemaValidationResult | null {
  if (isSchemaValidationResultLike(value.validation)) {
    return normalizeSchemaValidationResult(value.validation);
  }

  const details = value.details;
  if (details && typeof details === "object" && !seen.has(details)) {
    seen.add(details);
    const fromDetails = extractSchemaValidationResultFromRecord(
      details as Record<string, unknown>,
      seen
    );
    if (fromDetails) {
      return fromDetails;
    }
  }

  const nestedError = value.error;
  if (nestedError && typeof nestedError === "object" && !seen.has(nestedError)) {
    seen.add(nestedError);
    const fromError = extractSchemaValidationResultFromRecord(
      nestedError as Record<string, unknown>,
      seen
    );
    if (fromError) {
      return fromError;
    }
  }

  const cause = value.cause;
  if (cause && typeof cause === "object" && !seen.has(cause)) {
    seen.add(cause);
    return extractSchemaValidationResultFromRecord(cause as Record<string, unknown>, seen);
  }

  return null;
}

export function extractSchemaValidationResult(value: unknown): SchemaValidationResult | null {
  if (isWebMcpInputSchemaValidationError(value)) {
    return cloneSchemaValidationResult(value.validation);
  }
  if (!value || typeof value !== "object") {
    return null;
  }
  const seen = new Set<unknown>([value]);
  return extractSchemaValidationResultFromRecord(value as Record<string, unknown>, seen);
}

export function extractSchemaValidationFromLegacyMessage(
  message: string
): SchemaValidationResult | null {
  const marker = ": ";
  if (!message.startsWith("Input schema validation failed for ") || !message.includes(marker)) {
    return null;
  }
  const details = message
    .slice(message.indexOf(marker) + marker.length)
    .split("; ")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (details.length === 0) {
    return null;
  }
  return {
    errors: details,
    warnings: [],
    missingRequired: [],
    typeMismatches: [],
    extraFields: [],
  };
}

export function resolveWebMcpErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object") {
    const record = error as { message?: unknown; code?: unknown };
    if (typeof record.message === "string" && record.message.trim().length > 0) {
      return record.message;
    }
    if (typeof record.code === "string" && record.code.trim().length > 0) {
      return `Request failed (${record.code}).`;
    }
  }
  return "Request failed.";
}

export class WebMcpInputSchemaValidationError extends Error {
  readonly code = "INPUT_SCHEMA_VALIDATION_FAILED";
  readonly toolName: string;
  readonly scope: WebMcpInputSchemaValidationScope;
  readonly validation: SchemaValidationResult;

  constructor(params: WebMcpInputSchemaValidationErrorParams) {
    const details =
      params.validation.errors.length > 0
        ? params.validation.errors.join("; ")
        : "Unknown schema validation error.";
    super(`Input schema validation failed for ${params.toolName}: ${details}`);
    this.name = "WebMcpInputSchemaValidationError";
    this.toolName = params.toolName;
    this.scope = params.scope;
    this.validation = cloneSchemaValidationResult(params.validation);
  }
}

export function isWebMcpInputSchemaValidationError(
  value: unknown
): value is WebMcpInputSchemaValidationError {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    record.name === "WebMcpInputSchemaValidationError" &&
    typeof record.toolName === "string" &&
    isValidationScope(record.scope) &&
    isSchemaValidationResultLike(record.validation)
  );
}
