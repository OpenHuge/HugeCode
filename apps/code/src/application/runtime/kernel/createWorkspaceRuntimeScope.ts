import type { RuntimeGateway } from "../facades/RuntimeGateway";
import type { RuntimeWorkspaceId } from "../types/runtimeIds";
import type { WorkspaceRuntimeScope } from "./runtimeKernelTypes";
import type {
  RuntimeKernelCapabilityKey,
  RuntimeKernelCapabilityMap,
  WorkspaceRuntimeCapabilityProvider,
} from "./runtimeKernelCapabilities";

type CreateWorkspaceRuntimeScopeInput = {
  workspaceId: RuntimeWorkspaceId;
  runtimeGateway: RuntimeGateway;
  capabilityProviders: WorkspaceRuntimeCapabilityProvider[];
};

export function createWorkspaceRuntimeScope({
  workspaceId,
  runtimeGateway,
  capabilityProviders,
}: CreateWorkspaceRuntimeScopeInput): WorkspaceRuntimeScope {
  const providerByKey = new Map<RuntimeKernelCapabilityKey, WorkspaceRuntimeCapabilityProvider>(
    capabilityProviders.map((provider) => [provider.key, provider] as const)
  );
  const capabilityCache = new Map<RuntimeKernelCapabilityKey, unknown>();

  function getCapability<K extends RuntimeKernelCapabilityKey>(
    key: K
  ): RuntimeKernelCapabilityMap[K] {
    const provider = providerByKey.get(key) as WorkspaceRuntimeCapabilityProvider<K> | undefined;
    if (!provider) {
      throw new Error(`Missing workspace runtime capability \`${key}\`.`);
    }
    if (capabilityCache.has(key)) {
      return capabilityCache.get(key) as RuntimeKernelCapabilityMap[K];
    }
    const capability = provider.createCapability({
      workspaceId,
      runtimeGateway,
    });
    capabilityCache.set(key, capability);
    return capability;
  }

  return {
    workspaceId,
    runtimeGateway,
    getCapability,
    hasCapability: (key) => providerByKey.has(key as RuntimeKernelCapabilityKey),
    listCapabilities: () => [...providerByKey.keys()],
  };
}
