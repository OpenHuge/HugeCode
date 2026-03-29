/**
 * Compatibility-only DI/context barrel.
 * New code should import concrete `ports/*` modules directly.
 */
export { RuntimePortsContext, RuntimePortsProvider } from "./RuntimePortsContext";
export type { DesktopRuntimePorts, RuntimePorts } from "./runtimePorts";
export type { RuntimeInfrastructure } from "./runtimeInfrastructure";
export type {
  RuntimeBrowserReadinessSource,
  RuntimeBrowserReadinessState,
  RuntimeBrowserReadinessSummary,
} from "./browserCapability";
export { readBrowserReadiness } from "./browserCapability";
export { createRuntimeInfrastructure, runtimeInfrastructure } from "./runtimeInfrastructure";
export { createRuntimePorts, runtimePorts } from "./runtimePorts";
export { useRuntimePorts } from "./useRuntimePorts";
