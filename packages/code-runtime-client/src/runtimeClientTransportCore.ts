import {
  CODE_RUNTIME_RPC_ERROR_CODES,
  type CodeRuntimeRpcMethod,
  type CodeRuntimeRpcRequestPayloadByMethod,
  type CodeRuntimeRpcResponsePayloadByMethod,
} from "@ku0/code-runtime-host-contract";
import { isCodeRuntimeRpcMethodNotFoundErrorCode } from "@ku0/code-runtime-host-contract/codeRuntimeRpcCompat";
import { RuntimeRpcInvocationError, toRuntimeRpcInvocationError } from "./runtimeClientErrorUtils";
import type {
  RuntimeRpcCandidateResolver,
  RuntimeRpcInvoker,
  RuntimeRpcParams,
  RuntimeRpcRawInvoker,
} from "./runtimeClientTransportShared";
import { RuntimeRpcMethodUnsupportedError } from "./runtimeClientTransportShared";
import { invokeWebRuntimeRawAttempt } from "./runtimeClientWebHttpTransport";

function classifyRuntimeRpcFailure(cause: unknown): {
  error: unknown;
  methodNotFoundMessage: string | null;
} {
  const runtimeError = toRuntimeRpcInvocationError(cause);
  const error = runtimeError ?? cause;
  const methodNotFoundMessage =
    runtimeError !== null && isCodeRuntimeRpcMethodNotFoundErrorCode(runtimeError.code)
      ? runtimeError.message
      : null;
  return {
    error,
    methodNotFoundMessage,
  };
}

export async function invokeRuntimeRpcAcrossCandidates<Result>(
  invokeRaw: RuntimeRpcRawInvoker,
  method: CodeRuntimeRpcMethod,
  params: RuntimeRpcParams,
  resolveCandidates: RuntimeRpcCandidateResolver = (rpcMethod) => [rpcMethod]
): Promise<Result> {
  const candidates = await resolveCandidates(method);
  let lastError: unknown = null;
  let lastMethodNotFoundMessage: string | null = null;
  let observedMethodNotFound = false;

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    try {
      return await invokeRaw<Result>(candidate, params);
    } catch (cause) {
      const classified = classifyRuntimeRpcFailure(cause);
      lastError = classified.error;
      if (classified.methodNotFoundMessage !== null) {
        observedMethodNotFound = true;
        lastMethodNotFoundMessage = classified.methodNotFoundMessage;
        continue;
      }
      throw lastError;
    }
  }

  if (observedMethodNotFound) {
    throw new RuntimeRpcMethodUnsupportedError(
      method,
      candidates,
      lastMethodNotFoundMessage ?? undefined
    );
  }

  throw lastError ?? new Error(`Runtime method invocation failed for ${method}.`);
}

export function createRuntimeRpcInvokerWithCandidates(
  invokeRaw: RuntimeRpcRawInvoker,
  resolveCandidates: RuntimeRpcCandidateResolver = (rpcMethod) => [rpcMethod]
): RuntimeRpcInvoker {
  return async <Method extends CodeRuntimeRpcMethod>(
    method: Method,
    params: CodeRuntimeRpcRequestPayloadByMethod[Method]
  ): Promise<CodeRuntimeRpcResponsePayloadByMethod[Method]> => {
    return invokeRuntimeRpcAcrossCandidates<CodeRuntimeRpcResponsePayloadByMethod[Method]>(
      invokeRaw,
      method,
      params as RuntimeRpcParams,
      resolveCandidates
    );
  };
}

export async function invokeDesktopHostRaw<Result>(
  invokeRuntime: <Value>(method: string, params: RuntimeRpcParams) => Promise<Value>,
  method: string,
  params: RuntimeRpcParams
): Promise<Result> {
  try {
    return await invokeRuntime<Result>(method, params);
  } catch (cause) {
    throw (
      toRuntimeRpcInvocationError(cause) ??
      new RuntimeRpcInvocationError({
        code: CODE_RUNTIME_RPC_ERROR_CODES.INTERNAL_ERROR,
        message: `Electron bridge runtime ${method} failed.`,
      })
    );
  }
}

export { invokeWebRuntimeRawAttempt };
