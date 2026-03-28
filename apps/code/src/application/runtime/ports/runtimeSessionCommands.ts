// Compatibility shim. Feature code should import workspace-scoped session command hooks
// from `application/runtime/facades/runtimeSessionCommandFacadeHooks`.
export {
  useRuntimeSessionCommandsResolver,
  useWorkspaceRuntimeSessionCommands,
} from "../facades/runtimeSessionCommandFacadeHooks";
