/**
 * Compatibility shim. Shared runtime-client infrastructure now lives in
 * `@ku0/code-runtime-client/runtimeEventStateMachine`.
 */
export type {
  RuntimeEventStateTransition,
  RuntimeEventStateMachine,
} from "@ku0/code-runtime-client/runtimeEventStateMachine";
export {
  subscribeRuntimeEventStateChannel,
  createRuntimeEventStateMachine,
} from "@ku0/code-runtime-client/runtimeEventStateMachine";
