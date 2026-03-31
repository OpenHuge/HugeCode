import type {
  RuntimeDiagnosticsExportRequest,
  RuntimeDiagnosticsExportResponse,
  RuntimeDiagnosticsRedactionLevel,
} from "@ku0/code-runtime-host-contract";
import { isCodeRuntimeRpcMethodNotFoundErrorCode } from "@ku0/code-runtime-host-contract/codeRuntimeRpcCompat";

import { logger } from "./logger";
import { toRuntimeRpcInvocationError } from "@ku0/code-runtime-client/runtimeClientErrorUtils";
import type { RuntimeClient } from "./runtimeClient";

const SUPPORTED_DIAGNOSTICS_SOURCES: ReadonlySet<RuntimeDiagnosticsExportResponse["source"]> =
  // The shared RPC contract still publishes the legacy desktop-export source as
  // "tauri". Keep accepting it here until that contract is revised.
  new Set(["runtime-service", "tauri"]);
const SUPPORTED_REDACTION_LEVELS: ReadonlySet<RuntimeDiagnosticsRedactionLevel> = new Set([
  "strict",
  "balanced",
  "minimal",
]);

export class RuntimeDiagnosticsExportPayloadInvalidError extends Error {
  readonly details: string;

  constructor(details: string) {
    super(`Runtime diagnostics export payload is invalid: ${details}`);
    this.name = "RuntimeDiagnosticsExportPayloadInvalidError";
    this.details = details;
  }
}

function isMethodUnsupported(error: unknown): boolean {
  const normalized = toRuntimeRpcInvocationError(error);
  return Boolean(normalized && isCodeRuntimeRpcMethodNotFoundErrorCode(normalized.code));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isRuntimeDiagnosticsRedactionLevel(
  value: unknown
): value is RuntimeDiagnosticsRedactionLevel {
  return (
    typeof value === "string" &&
    SUPPORTED_REDACTION_LEVELS.has(value as RuntimeDiagnosticsRedactionLevel)
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validateRedactionStats(
  value: unknown
): RuntimeDiagnosticsExportResponse["redactionStats"] | null {
  if (!isRecord(value)) {
    return null;
  }

  const redactedKeys = value.redactedKeys;
  const redactedValues = value.redactedValues;
  const hashedPaths = value.hashedPaths;
  const hashedEmails = value.hashedEmails;
  const hashedSecrets = value.hashedSecrets;

  if (
    !isNonNegativeFiniteNumber(redactedKeys) ||
    !isNonNegativeFiniteNumber(redactedValues) ||
    !isNonNegativeFiniteNumber(hashedPaths) ||
    !isNonNegativeFiniteNumber(hashedEmails) ||
    !isNonNegativeFiniteNumber(hashedSecrets)
  ) {
    return null;
  }

  return {
    redactedKeys,
    redactedValues,
    hashedPaths,
    hashedEmails,
    hashedSecrets,
  };
}

function validateRuntimeDiagnosticsExportResponse(
  value: unknown
): RuntimeDiagnosticsExportResponse | RuntimeDiagnosticsExportPayloadInvalidError {
  if (!isRecord(value)) {
    return new RuntimeDiagnosticsExportPayloadInvalidError("response must be an object");
  }

  if (value.schemaVersion !== "runtime-diagnostics-export/v1") {
    return new RuntimeDiagnosticsExportPayloadInvalidError(
      "schemaVersion must be runtime-diagnostics-export/v1"
    );
  }

  if (!isNonNegativeFiniteNumber(value.exportedAt)) {
    return new RuntimeDiagnosticsExportPayloadInvalidError(
      "exportedAt must be a non-negative number"
    );
  }

  if (
    typeof value.source !== "string" ||
    !SUPPORTED_DIAGNOSTICS_SOURCES.has(value.source as RuntimeDiagnosticsExportResponse["source"])
  ) {
    return new RuntimeDiagnosticsExportPayloadInvalidError(
      "source must be runtime-service or tauri"
    );
  }

  if (!isRuntimeDiagnosticsRedactionLevel(value.redactionLevel)) {
    return new RuntimeDiagnosticsExportPayloadInvalidError(
      "redactionLevel must be strict, balanced, or minimal"
    );
  }

  if (typeof value.filename !== "string" || value.filename.trim().length === 0) {
    return new RuntimeDiagnosticsExportPayloadInvalidError("filename must be a non-empty string");
  }

  if (value.mimeType !== "application/zip") {
    return new RuntimeDiagnosticsExportPayloadInvalidError("mimeType must be application/zip");
  }

  if (!isNonNegativeFiniteNumber(value.sizeBytes)) {
    return new RuntimeDiagnosticsExportPayloadInvalidError(
      "sizeBytes must be a non-negative number"
    );
  }

  const zipBase64 =
    value.zipBase64 === null
      ? null
      : typeof value.zipBase64 === "string" && value.zipBase64.trim().length > 0
        ? value.zipBase64
        : undefined;
  if (zipBase64 === undefined) {
    return new RuntimeDiagnosticsExportPayloadInvalidError(
      "zipBase64 must be a non-empty string or null"
    );
  }

  if (!isStringArray(value.sections)) {
    return new RuntimeDiagnosticsExportPayloadInvalidError("sections must be a string[]");
  }

  if (!isStringArray(value.warnings)) {
    return new RuntimeDiagnosticsExportPayloadInvalidError("warnings must be a string[]");
  }

  const redactionStats = validateRedactionStats(value.redactionStats);
  if (!redactionStats) {
    return new RuntimeDiagnosticsExportPayloadInvalidError("redactionStats has invalid shape");
  }

  const source = value.source as RuntimeDiagnosticsExportResponse["source"];

  return {
    schemaVersion: "runtime-diagnostics-export/v1",
    exportedAt: value.exportedAt,
    source,
    redactionLevel: value.redactionLevel,
    filename: value.filename,
    mimeType: "application/zip",
    sizeBytes: value.sizeBytes,
    zipBase64,
    sections: [...value.sections],
    warnings: [...value.warnings],
    redactionStats,
  };
}

function normalizeRequest(
  request?: RuntimeDiagnosticsExportRequest
): RuntimeDiagnosticsExportRequest {
  return {
    workspaceId: request?.workspaceId ?? null,
    redactionLevel: request?.redactionLevel ?? "strict",
    includeTaskSummaries: request?.includeTaskSummaries ?? false,
    includeEventTail: request?.includeEventTail ?? true,
    includeZipBase64: request?.includeZipBase64 ?? true,
  };
}

export async function exportRuntimeDiagnosticsWithFallback(
  client: RuntimeClient,
  request?: RuntimeDiagnosticsExportRequest
): Promise<RuntimeDiagnosticsExportResponse | null> {
  try {
    const rawResponse = (await client.runtimeDiagnosticsExportV1(
      normalizeRequest(request)
    )) as unknown;
    const validated = validateRuntimeDiagnosticsExportResponse(rawResponse);
    if (validated instanceof RuntimeDiagnosticsExportPayloadInvalidError) {
      logger.warn("Runtime diagnostics export schema validation failed.", {
        reason: validated.details,
      });
      throw validated;
    }
    return validated;
  } catch (error) {
    if (isMethodUnsupported(error)) {
      return null;
    }
    throw error;
  }
}

export {
  normalizeRequest as normalizeRuntimeDiagnosticsExportRequest,
  validateRuntimeDiagnosticsExportResponse,
};
