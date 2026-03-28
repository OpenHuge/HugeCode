import type { RuntimeAgentControlFacade } from "../facades/runtimeAgentControlFacade";
import type { RuntimeSessionCommandFacade } from "../facades/runtimeSessionCommandFacade";
import type { RuntimeWorkspaceId } from "../types/runtimeIds";
import type { RuntimeGateway } from "../facades/RuntimeGateway";
import type { WorkspaceRuntimeScope } from "./runtimeKernelTypes";
import type { RuntimeKernelPluginCatalogFacade } from "./runtimeKernelPlugins";

export const RUNTIME_KERNEL_CAPABILITY_KEYS = {
  agentControl: "control.agent",
  sessionCommands: "session.commands",
  pluginCatalog: "plugins.catalog",
  extensionsCatalog: "extensions.catalog",
} as const;

export type RuntimeKernelCanonicalCapabilityMap = {
  [RUNTIME_KERNEL_CAPABILITY_KEYS.agentControl]: RuntimeAgentControlFacade;
  [RUNTIME_KERNEL_CAPABILITY_KEYS.sessionCommands]: RuntimeSessionCommandFacade;
  [RUNTIME_KERNEL_CAPABILITY_KEYS.pluginCatalog]: RuntimeKernelPluginCatalogFacade;
};

export type RuntimeKernelCapabilityMap = RuntimeKernelCanonicalCapabilityMap & {
  [RUNTIME_KERNEL_CAPABILITY_KEYS.extensionsCatalog]: RuntimeKernelPluginCatalogFacade;
};

export type RuntimeKernelCanonicalCapabilityKey = keyof RuntimeKernelCanonicalCapabilityMap;
export type RuntimeKernelCapabilityKey = keyof RuntimeKernelCapabilityMap;

export type WorkspaceRuntimeCapabilityProviderContext = {
  workspaceId: RuntimeWorkspaceId;
  runtimeGateway: RuntimeGateway;
};

export type WorkspaceRuntimeCapabilityProvider<
  K extends RuntimeKernelCanonicalCapabilityKey = RuntimeKernelCanonicalCapabilityKey,
> = {
  key: K;
  createCapability: (
    context: WorkspaceRuntimeCapabilityProviderContext
  ) => RuntimeKernelCapabilityMap[K];
};

export function resolveRuntimeKernelCapabilityKey(
  key: RuntimeKernelCapabilityKey
): RuntimeKernelCanonicalCapabilityKey {
  if (key === RUNTIME_KERNEL_CAPABILITY_KEYS.extensionsCatalog) {
    return RUNTIME_KERNEL_CAPABILITY_KEYS.pluginCatalog;
  }
  return key;
}

export function resolveWorkspaceRuntimeCapability<K extends RuntimeKernelCapabilityKey>(
  scope: WorkspaceRuntimeScope,
  key: K
): RuntimeKernelCapabilityMap[K] {
  return scope.getCapability(key);
}
