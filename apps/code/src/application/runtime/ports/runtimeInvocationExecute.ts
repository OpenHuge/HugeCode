// Thin compatibility port for the unified invocation execute capability.
// New feature code should prefer the workspace-scoped hooks in
// `application/runtime/facades/runtimeInvocationExecuteFacadeHooks`.
export {
  useRuntimeInvocationExecuteResolver,
  useWorkspaceRuntimeInvocationExecute,
} from "../facades/runtimeInvocationExecuteFacadeHooks";
