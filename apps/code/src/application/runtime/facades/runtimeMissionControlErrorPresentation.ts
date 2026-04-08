import { readRuntimeErrorCode, readRuntimeErrorMessage } from "../ports/runtimeErrorClassifier";

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function formatRuntimeError(error: unknown): string {
  const message = readRuntimeErrorMessage(error);
  const code = readRuntimeErrorCode(error);
  if (message && code) {
    return `${message} (${code})`;
  }
  if (message) {
    return message;
  }
  if (code) {
    return code;
  }
  if (error instanceof Error) {
    const fallbackMessage = readNonEmptyString(error.message);
    if (fallbackMessage) {
      return fallbackMessage;
    }
  }
  const fallbackMessage = readNonEmptyString(error);
  return fallbackMessage ?? "Unknown runtime error.";
}

export function resolveRuntimeErrorLabel(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  return readNonEmptyString(record.code) ?? readNonEmptyString(record.message);
}
