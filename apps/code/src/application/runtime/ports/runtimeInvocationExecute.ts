// Migration shim for the unified invocation execute capability.
// Remove this port once all callers use the workspace-scoped hooks in
// `application/runtime/facades/runtimeInvocationExecuteFacadeHooks` directly.
export {
  useRuntimeInvocationExecuteResolver,
  useWorkspaceRuntimeInvocationExecute,
} from "../facades/runtimeInvocationExecuteFacadeHooks";
