// Compatibility shim. Feature code should import workspace-scoped session command hooks
// from `application/runtime/facades/runtimeSessionCommandFacade`.
export {
  useRuntimeSessionCommandsResolver,
  useWorkspaceRuntimeSessionCommands,
} from "../facades/runtimeSessionCommandFacade";
