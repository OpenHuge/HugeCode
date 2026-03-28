import type { RuntimeAgentControlFacade } from "../facades/runtimeAgentControlFacade";
import type { RuntimeSessionCommandFacade } from "../facades/runtimeSessionCommandFacade";
import type { RuntimeWorkspaceId } from "../types/runtimeIds";
import type { RuntimeGateway } from "../facades/RuntimeGateway";
import type { WorkspaceRuntimeScope } from "./runtimeKernelTypes";
import type { RuntimeKernelPluginCatalogFacade } from "./runtimeKernelPlugins";

export const RUNTIME_KERNEL_CAPABILITY_KEYS = {
  agentControl: "control.agent",
  sessionCommands: "session.commands",
  extensionsCatalog: "extensions.catalog",
} as const;

export type RuntimeKernelCapabilityMap = {
  [RUNTIME_KERNEL_CAPABILITY_KEYS.agentControl]: RuntimeAgentControlFacade;
  [RUNTIME_KERNEL_CAPABILITY_KEYS.sessionCommands]: RuntimeSessionCommandFacade;
  [RUNTIME_KERNEL_CAPABILITY_KEYS.extensionsCatalog]: RuntimeKernelPluginCatalogFacade;
};

export type RuntimeKernelCapabilityKey = keyof RuntimeKernelCapabilityMap;

export type WorkspaceRuntimeCapabilityProviderContext = {
  workspaceId: RuntimeWorkspaceId;
  runtimeGateway: RuntimeGateway;
};

export type WorkspaceRuntimeCapabilityProvider<
  K extends RuntimeKernelCapabilityKey = RuntimeKernelCapabilityKey,
> = {
  key: K;
  createCapability: (
    context: WorkspaceRuntimeCapabilityProviderContext
  ) => RuntimeKernelCapabilityMap[K];
};

export function resolveWorkspaceRuntimeCapability<K extends RuntimeKernelCapabilityKey>(
  scope: WorkspaceRuntimeScope,
  key: K
): RuntimeKernelCapabilityMap[K] {
  return scope.getCapability(key);
}
