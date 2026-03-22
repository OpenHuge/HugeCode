type TerminalErrorLike = {
  code?: unknown;
  error?: unknown;
  cause?: unknown;
  details?: unknown;
};

const RUNTIME_RESOURCE_NOT_FOUND_CODE = "runtime.validation.resource.not_found";

const TERMINAL_TRANSPORT_MESSAGE_TOKENS = [
  "broken pipe",
  "input/output error",
  "os error 5",
  "eio",
  "not connected",
  "closed",
] as const;

function normalizeErrorCode(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s.-]+/g, "_");
}

function readTerminalErrorCode(error: unknown): string {
  const queue: unknown[] = [error];
  const seen = new Set<unknown>();

  while (queue.length > 0) {
    const candidate = queue.shift();
    if (!candidate || typeof candidate !== "object" || seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);
    const record = candidate as TerminalErrorLike;

    if (typeof record.code === "string" && record.code.trim().length > 0) {
      return record.code.trim();
    }
    if (record.error && typeof record.error === "object") {
      queue.push(record.error);
    }
    if (record.cause && typeof record.cause === "object") {
      queue.push(record.cause);
    }
    if (record.details && typeof record.details === "object") {
      const details = record.details as Record<string, unknown>;
      if (details.error && typeof details.error === "object") {
        queue.push(details.error);
      }
    }
  }

  return "";
}

function readTerminalErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.toLowerCase();
  }
  return String(error).toLowerCase();
}

function isTerminalResourceNotFoundCode(error: unknown): boolean {
  const code = normalizeErrorCode(readTerminalErrorCode(error));
  if (code === normalizeErrorCode(RUNTIME_RESOURCE_NOT_FOUND_CODE)) {
    return true;
  }
  return code.includes("terminal_session_not_found");
}

export function shouldIgnoreTerminalCloseError(error: unknown): boolean {
  if (isTerminalResourceNotFoundCode(error)) {
    return true;
  }
  return readTerminalErrorMessage(error).includes("terminal session not found");
}

export function shouldIgnoreTerminalTransportError(error: unknown): boolean {
  if (shouldIgnoreTerminalCloseError(error)) {
    return true;
  }
  const message = readTerminalErrorMessage(error);
  return TERMINAL_TRANSPORT_MESSAGE_TOKENS.some((token) => message.includes(token));
}
