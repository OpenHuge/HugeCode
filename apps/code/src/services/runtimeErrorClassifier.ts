/**
 * Compatibility shim. Shared runtime-client infrastructure now lives in
 * `@ku0/code-runtime-client/runtimeErrorClassifier`.
 */
export {
  getErrorMessage,
  readRuntimeErrorCode,
  readRuntimeErrorMessage,
  isMissingTauriInvokeError,
  isMissingTauriCommandError,
  isMissingTextFileError,
  isWebRuntimeConnectionError,
  isTimeoutLikeError,
  isRuntimeMethodUnsupportedError,
} from "@ku0/code-runtime-client/runtimeErrorClassifier";
