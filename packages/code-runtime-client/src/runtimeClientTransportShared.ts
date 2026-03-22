import {
  CODE_RUNTIME_RPC_ERROR_CODES,
  type CodeRuntimeRpcMethod,
  type CodeRuntimeRpcRequestPayloadByMethod,
  type CodeRuntimeRpcResponsePayloadByMethod,
} from "@ku0/code-runtime-host-contract";

const RUNTIME_UNAVAILABLE_GUIDANCE =
  "Run desktop runtime (`pnpm dev:code:desktop`), or configure `VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT` for web runtime gateway.";

export class RuntimeUnavailableError extends Error {
  constructor(operation: string) {
    super(`Code runtime is unavailable for ${operation}. ${RUNTIME_UNAVAILABLE_GUIDANCE}`);
    this.name = "RuntimeUnavailableError";
  }
}

export class RuntimeRpcMethodUnsupportedError extends Error {
  readonly method: CodeRuntimeRpcMethod;
  readonly candidates: readonly string[];
  readonly code = CODE_RUNTIME_RPC_ERROR_CODES.METHOD_NOT_FOUND;

  constructor(method: CodeRuntimeRpcMethod, candidates: readonly string[], message?: string) {
    super(message ?? `Runtime does not support RPC method '${method}'.`);
    this.name = "RuntimeRpcMethodUnsupportedError";
    this.method = method;
    this.candidates = [...candidates];
  }
}

export type RuntimeRpcParams = Record<string, unknown>;

export type RuntimeRpcRawInvoker = <Result>(
  method: string,
  params: RuntimeRpcParams
) => Promise<Result>;

export type RuntimeRpcCandidateResolver = (
  method: CodeRuntimeRpcMethod
) => readonly string[] | Promise<readonly string[]>;

export type RuntimeRpcInvoker = <Method extends CodeRuntimeRpcMethod>(
  method: Method,
  params: CodeRuntimeRpcRequestPayloadByMethod[Method]
) => Promise<CodeRuntimeRpcResponsePayloadByMethod[Method]>;

function createUnavailableError(operation: string): RuntimeUnavailableError {
  return new RuntimeUnavailableError(operation);
}

export async function rejectUnavailable<T>(operation: string): Promise<T> {
  throw createUnavailableError(operation);
}
