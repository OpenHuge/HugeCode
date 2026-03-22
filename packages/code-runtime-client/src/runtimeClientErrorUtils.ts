import {
  CODE_RUNTIME_RPC_ERROR_CODES,
  type CodeRuntimeRpcError,
  inferCodeRuntimeRpcMethodNotFoundCodeFromMessage,
} from "@ku0/code-runtime-host-contract";

type RuntimeErrorLike = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
  error?: {
    code?: unknown;
    message?: unknown;
    details?: unknown;
  };
};

export class RuntimeRpcInvocationError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(error: CodeRuntimeRpcError) {
    super(error.message);
    this.name = "RuntimeRpcInvocationError";
    this.code = error.code;
    this.details = error.details;
  }
}

function normalizeRuntimeRpcError(errorLike: RuntimeErrorLike): RuntimeRpcInvocationError | null {
  const message =
    typeof errorLike.message === "string" && errorLike.message.trim().length > 0
      ? errorLike.message.trim()
      : null;

  if (!message) {
    return null;
  }

  const explicitCode =
    typeof errorLike.code === "string" && errorLike.code.trim().length > 0
      ? errorLike.code.trim()
      : null;
  const inferredCode = inferCodeRuntimeRpcMethodNotFoundCodeFromMessage(message);
  const code = explicitCode ?? inferredCode ?? CODE_RUNTIME_RPC_ERROR_CODES.INTERNAL_ERROR;

  return new RuntimeRpcInvocationError({
    code,
    message,
    details: errorLike.details,
  });
}

export function toRuntimeRpcInvocationError(cause: unknown): RuntimeRpcInvocationError | null {
  if (typeof cause === "string") {
    return normalizeRuntimeRpcError({ message: cause });
  }

  if (cause instanceof Error) {
    const typedError = cause as Error & {
      code?: unknown;
      details?: unknown;
      error?: RuntimeErrorLike["error"];
    };
    const fromNested = typedError.error ? normalizeRuntimeRpcError(typedError.error) : null;
    if (fromNested) {
      return fromNested;
    }
    return normalizeRuntimeRpcError({
      code: typedError.code,
      message: typedError.message,
      details: typedError.details,
    });
  }

  if (typeof cause === "object" && cause !== null) {
    const candidate = cause as RuntimeErrorLike;
    if (candidate.error) {
      const fromNested = normalizeRuntimeRpcError(candidate.error);
      if (fromNested) {
        return fromNested;
      }
    }
    return normalizeRuntimeRpcError(candidate);
  }

  return null;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }
  return "";
}
