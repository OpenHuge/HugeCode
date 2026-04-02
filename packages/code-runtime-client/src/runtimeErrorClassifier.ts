import { getErrorMessage } from "./runtimeClientErrorUtils";

export { getErrorMessage };

type RuntimeErrorLike = {
  code?: unknown;
  name?: unknown;
  message?: unknown;
  method?: unknown;
  error?: unknown;
  cause?: unknown;
  details?: unknown;
};

function toNonEmptyString(value: unknown): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "";
}

function collectErrorChain(error: unknown): RuntimeErrorLike[] {
  const queue: unknown[] = [error];
  const seen = new Set<unknown>();
  const chain: RuntimeErrorLike[] = [];

  while (queue.length > 0) {
    const candidate = queue.shift();
    if (!candidate || typeof candidate !== "object" || seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);
    const record = candidate as RuntimeErrorLike;
    chain.push(record);

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

  return chain;
}

function readErrorField(error: unknown, field: keyof RuntimeErrorLike): string {
  for (const candidate of collectErrorChain(error)) {
    const value = toNonEmptyString(candidate[field]);
    if (value.length > 0) {
      return value;
    }
  }
  return "";
}

function readErrorCode(error: unknown): string {
  return readErrorField(error, "code");
}

function readErrorName(error: unknown): string {
  return readErrorField(error, "name");
}

function readErrorMethod(error: unknown): string {
  return readErrorField(error, "method");
}

export function readRuntimeErrorCode(error: unknown): string | null {
  const code = readErrorCode(error);
  return code.length > 0 ? code : null;
}

export function readRuntimeErrorMessage(error: unknown): string | null {
  const message = readErrorField(error, "message");
  return message.length > 0 ? message : null;
}

function hasMessageToken(message: string, tokens: readonly string[]): boolean {
  return tokens.some((token) => message.includes(token));
}

function normalizeErrorCodeToken(code: string): string {
  return code
    .trim()
    .toLowerCase()
    .replace(/[\s.-]+/g, "_");
}

export function isMissingDesktopHostInvokeError(error: unknown): boolean {
  const code = readErrorCode(error).toLowerCase();
  if (code.includes("invoke_unavailable") || code.includes("desktop_host_invoke_unavailable")) {
    return true;
  }

  const message = getErrorMessage(error);
  if (!message) {
    return false;
  }
  return (
    message.includes("reading 'invoke'") ||
    message.includes('reading "invoke"') ||
    message.includes(".invoke is not a function") ||
    message.includes("Electron bridge command") ||
    message.includes("hugeCodeDesktopHost")
  );
}

export function isMissingDesktopHostCommandError(error: unknown, command: string): boolean {
  const normalizedCommand = command.trim().toLowerCase();
  const code = readErrorCode(error).toLowerCase();
  const method = readErrorMethod(error).toLowerCase();
  const hasMethodNotFoundCode =
    code === "method_not_found" ||
    code === "method_not_found_error" ||
    code === "method_unavailable";
  if (hasMethodNotFoundCode && method.length > 0 && method === normalizedCommand) {
    return true;
  }

  const message = getErrorMessage(error);
  if (!message) {
    return false;
  }
  const normalized = message.toLowerCase();
  if (!normalized.includes(normalizedCommand)) {
    return false;
  }
  return (
    normalized.includes("unknown command") ||
    normalized.includes("command not found") ||
    normalized.includes("method not found") ||
    normalized.includes("does not exist")
  );
}

export function isMissingTextFileError(error: unknown): boolean {
  const code = readErrorCode(error).toLowerCase();
  if (code.includes("enoent") || code.includes("os_error_2")) {
    return true;
  }

  const message = getErrorMessage(error);
  if (!message) {
    return false;
  }
  const normalized = message.toLowerCase();
  return (
    normalized.includes("no such file") ||
    normalized.includes("os error 2") ||
    normalized.includes("enoent")
  );
}

export function isWebRuntimeConnectionError(error: unknown): boolean {
  const code = readErrorCode(error).toLowerCase();
  if (
    code.includes("network") ||
    code.includes("fetch") ||
    code.includes("connection") ||
    code.includes("runtime_unavailable")
  ) {
    return true;
  }

  const name = readErrorName(error).toLowerCase();
  if (name === "typeerror" || name === "networkerror" || name === "aborterror") {
    return true;
  }

  const message = getErrorMessage(error).trim().toLowerCase();
  if (!message) {
    return false;
  }
  return hasMessageToken(message, [
    "failed to fetch",
    "networkerror",
    "network request failed",
    "fetch failed",
    "runtime is unavailable",
  ]);
}

export function isTimeoutLikeError(error: unknown): boolean {
  const code = readErrorCode(error).toLowerCase();
  if (code.includes("timeout") || code.includes("timed_out")) {
    return true;
  }

  const name = readErrorName(error).toLowerCase();
  if (name === "timeouterror" || name === "aborterror") {
    return true;
  }

  const message = getErrorMessage(error).trim().toLowerCase();
  if (!message) {
    return false;
  }
  return hasMessageToken(message, ["timed out", "timeout", "aborterror", "aborted"]);
}

export function isRuntimeMethodUnsupportedError(error: unknown, method?: string): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const name = readErrorName(error).toLowerCase();
  const code = normalizeErrorCodeToken(readErrorCode(error));
  if (name === "runtimerpcmethodunsupportederror") {
    return true;
  }
  if (code.includes("method_not_found") || code.includes("method_unavailable")) {
    const methodFromError = readErrorMethod(error).toLowerCase();
    if (!method) {
      return true;
    }
    return methodFromError.length > 0
      ? methodFromError === method.toLowerCase()
      : getErrorMessage(error).trim().toLowerCase().includes(method.toLowerCase());
  }
  const message = getErrorMessage(error).trim().toLowerCase();
  if (!message) {
    return false;
  }
  if (method && !message.includes(method.toLowerCase())) {
    return false;
  }
  return (
    message.includes("unsupported rpc method") ||
    message.includes("method not found") ||
    message.includes("unknown command") ||
    message.includes("command not found") ||
    message.includes("does not exist") ||
    message.includes("does not support rpc method")
  );
}
