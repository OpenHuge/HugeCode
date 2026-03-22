/**
 * Compatibility shim. Shared runtime-client infrastructure now lives in
 * `@ku0/code-runtime-client/runtimeClientErrorUtils`.
 */
export {
  RuntimeRpcInvocationError,
  toRuntimeRpcInvocationError,
  getErrorMessage,
} from "@ku0/code-runtime-client/runtimeClientErrorUtils";
