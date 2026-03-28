import type { RuntimeGateway } from "../facades/RuntimeGateway";
import type { RuntimeWorkspaceId } from "../types/runtimeIds";
import type { WorkspaceRuntimeScope } from "./runtimeKernelTypes";
import { resolveRuntimeKernelCapabilityKey } from "./runtimeKernelCapabilities";
import type {
  RuntimeKernelCanonicalCapabilityKey,
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
  const providerByKey = new Map<
    RuntimeKernelCanonicalCapabilityKey,
    WorkspaceRuntimeCapabilityProvider
  >(capabilityProviders.map((provider) => [provider.key, provider] as const));
  const capabilityCache = new Map<RuntimeKernelCanonicalCapabilityKey, unknown>();

  function getCapability<K extends RuntimeKernelCapabilityKey>(
    key: K
  ): RuntimeKernelCapabilityMap[K] {
    const resolvedKey = resolveRuntimeKernelCapabilityKey(key);
    const provider = providerByKey.get(resolvedKey) as
      | WorkspaceRuntimeCapabilityProvider<RuntimeKernelCanonicalCapabilityKey>
      | undefined;
    if (!provider) {
      throw new Error(`Missing workspace runtime capability \`${key}\`.`);
    }
    if (capabilityCache.has(resolvedKey)) {
      return capabilityCache.get(resolvedKey) as RuntimeKernelCapabilityMap[K];
    }
    const capability = provider.createCapability({
      workspaceId,
      runtimeGateway,
    }) as RuntimeKernelCapabilityMap[K];
    capabilityCache.set(resolvedKey, capability);
    return capability;
  }

  return {
    workspaceId,
    runtimeGateway,
    getCapability,
    hasCapability: (key) =>
      providerByKey.has(resolveRuntimeKernelCapabilityKey(key as RuntimeKernelCapabilityKey)),
    listCapabilities: () => [...providerByKey.keys()],
  };
}
