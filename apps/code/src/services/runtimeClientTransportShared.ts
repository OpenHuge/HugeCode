/**
 * Compatibility shim. Shared runtime-client infrastructure now lives in
 * `@ku0/code-runtime-client/runtimeClientTransportShared`.
 */
export type {
  RuntimeRpcParams,
  RuntimeRpcRawInvoker,
  RuntimeRpcCandidateResolver,
  RuntimeRpcInvoker,
} from "@ku0/code-runtime-client/runtimeClientTransportShared";
export {
  RuntimeUnavailableError,
  RuntimeRpcMethodUnsupportedError,
  rejectUnavailable,
} from "@ku0/code-runtime-client/runtimeClientTransportShared";
