// Thin compatibility port for the unified invocation catalog capability.
// New feature code should prefer the workspace-scoped hooks in
// `application/runtime/facades/runtimeInvocationCatalogFacadeHooks`.
export {
  useRuntimeInvocationCatalogResolver,
  useWorkspaceRuntimeInvocationCatalog,
} from "../facades/runtimeInvocationCatalogFacadeHooks";
