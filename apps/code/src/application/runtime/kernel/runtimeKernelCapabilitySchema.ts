import type { RuntimeAgentControlFacade } from "../facades/runtimeAgentControlFacade";
import type { RuntimeSessionCommandFacade } from "../facades/runtimeSessionCommandFacade";
import type { RuntimeGateway } from "../facades/RuntimeGateway";
import type { RuntimeWorkspaceId } from "../types/runtimeIds";
import type { RuntimeKernelCompositionFacade } from "./runtimeKernelComposition";
import type { RuntimeKernelPluginCatalogFacade } from "./runtimeKernelPlugins";
import type { RuntimeKernelPluginRegistryFacade } from "./runtimeKernelPluginRegistry";

export const RUNTIME_KERNEL_CAPABILITY_KEYS = {
  agentControl: "control.agent",
  sessionCommands: "session.commands",
  pluginCatalog: "plugins.catalog",
  pluginRegistry: "plugins.registry",
  compositionRuntime: "composition.runtime",
} as const;

export type RuntimeKernelCapabilityMap = {
  [RUNTIME_KERNEL_CAPABILITY_KEYS.agentControl]: RuntimeAgentControlFacade;
  [RUNTIME_KERNEL_CAPABILITY_KEYS.sessionCommands]: RuntimeSessionCommandFacade;
  [RUNTIME_KERNEL_CAPABILITY_KEYS.pluginCatalog]: RuntimeKernelPluginCatalogFacade;
  [RUNTIME_KERNEL_CAPABILITY_KEYS.pluginRegistry]: RuntimeKernelPluginRegistryFacade;
  [RUNTIME_KERNEL_CAPABILITY_KEYS.compositionRuntime]: RuntimeKernelCompositionFacade;
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
