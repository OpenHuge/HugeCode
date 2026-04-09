// TODO(runtime-control-plane): remove this compatibility re-export once app surfaces
// import plugin catalog readiness helpers from @ku0/code-application directly.
export {
  buildRuntimeKernelPluginReadinessEntries,
  buildRuntimeKernelPluginReadinessSections,
} from "@ku0/code-application/runtimeMissionControlPluginCatalog";

export type {
  RuntimeKernelPluginReadinessBadge,
  RuntimeKernelPluginReadinessEntry,
  RuntimeKernelPluginReadinessSection,
  RuntimeKernelPluginReadinessState,
  RuntimeKernelPluginReadinessTone,
} from "@ku0/code-application/runtimeMissionControlPluginCatalog";
