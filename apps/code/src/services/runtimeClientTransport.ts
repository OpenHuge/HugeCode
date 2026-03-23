import {
  CODE_RUNTIME_RPC_ERROR_CODES,
  type CodeRuntimeRpcMethod,
  type CodeRuntimeRpcRequestPayloadByMethod,
  type CodeRuntimeRpcResponsePayloadByMethod,
} from "@ku0/code-runtime-host-contract";
import { isCodeRuntimeRpcMethodNotFoundErrorCode } from "@ku0/code-runtime-host-contract/codeRuntimeRpcCompat";
import { invoke } from "@tauri-apps/api/core";
import {
  getErrorMessage,
  RuntimeRpcInvocationError,
  toRuntimeRpcInvocationError,
} from "@ku0/code-runtime-client/runtimeClientErrorUtils";
import { detectRuntimeMode } from "./runtimeClientMode";
import { createRpcRuntimeClient } from "./runtimeClientRpcClient";
import {
  resolveCapabilitiesSnapshotByMode,
  resolveTauriRuntimeRpcMethodCandidates,
  resolveWebRuntimeRpcMethodCandidates,
} from "./runtimeClientCapabilitiesProbe";
import {
  RuntimeRpcMethodUnsupportedError,
  RuntimeUnavailableError,
  rejectUnavailable,
  type RuntimeRpcCandidateResolver,
  type RuntimeRpcInvoker,
  type RuntimeRpcParams,
  type RuntimeRpcRawInvoker,
} from "@ku0/code-runtime-client/runtimeClientTransportShared";
export {
  RuntimeRpcMethodUnsupportedError,
  RuntimeUnavailableError,
} from "@ku0/code-runtime-client/runtimeClientTransportShared";
import type {
  RuntimeCapabilitiesSummary,
  RuntimeClient as SharedRuntimeClient,
} from "@ku0/code-runtime-client/runtimeClientTypes";
import type { AppSettings } from "../types";
import { createUnavailableRuntimeClient } from "./runtimeClientUnavailable";
import { invokeWebRuntimeRaw } from "./runtimeClientWebTransport";

type RuntimeClient = SharedRuntimeClient<AppSettings>;

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

async function invokeRuntimeRpcAcrossCandidates<Result>(
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

function createRuntimeRpcInvokerWithCandidates(
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

async function invokeTauriRaw<Result>(method: string, params: RuntimeRpcParams): Promise<Result> {
  try {
    return await invoke<Result>(method, params);
  } catch (cause) {
    throw (
      toRuntimeRpcInvocationError(cause) ??
      new RuntimeRpcInvocationError({
        code: CODE_RUNTIME_RPC_ERROR_CODES.INTERNAL_ERROR,
        message: `Tauri runtime ${method} failed.`,
      })
    );
  }
}

export async function readRuntimeCapabilitiesSummary(): Promise<RuntimeCapabilitiesSummary> {
  const mode = detectRuntimeMode();
  if (mode === "unavailable") {
    return {
      mode,
      methods: [],
      features: [],
      wsEndpointPath: null,
      error: null,
    };
  }

  try {
    const snapshot = await resolveCapabilitiesSnapshotByMode(mode);
    return {
      mode,
      methods: snapshot ? [...snapshot.methods] : [],
      features: snapshot ? [...snapshot.features] : [],
      wsEndpointPath: snapshot?.wsEndpointPath ?? null,
      error: null,
    };
  } catch (error) {
    return {
      mode,
      methods: [],
      features: [],
      wsEndpointPath: null,
      error: getErrorMessage(error) || "Runtime capabilities unavailable.",
    };
  }
}

const unavailableClient = createUnavailableRuntimeClient(rejectUnavailable);

const webRuntimeClient = createRpcRuntimeClient(
  createRuntimeRpcInvokerWithCandidates(invokeWebRuntimeRaw, resolveWebRuntimeRpcMethodCandidates)
);

const tauriClient = createRpcRuntimeClient(
  createRuntimeRpcInvokerWithCandidates(invokeTauriRaw, resolveTauriRuntimeRpcMethodCandidates)
);

export function getRuntimeClient(): RuntimeClient {
  const mode = detectRuntimeMode();

  if (mode === "tauri") {
    return tauriClient;
  }
  if (mode === "runtime-gateway-web") {
    return webRuntimeClient;
  }
  return unavailableClient;
}
