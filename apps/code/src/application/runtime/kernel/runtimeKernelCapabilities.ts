import type { WorkspaceRuntimeScope } from "./runtimeKernelTypes";
import {
  type RuntimeKernelCapabilityKey,
  type RuntimeKernelCapabilityMap,
  RUNTIME_KERNEL_CAPABILITY_KEYS,
  type WorkspaceRuntimeCapabilityProvider,
  type WorkspaceRuntimeCapabilityProviderContext,
} from "./runtimeKernelCapabilitySchema";

export {
  RUNTIME_KERNEL_CAPABILITY_KEYS,
  type RuntimeKernelCapabilityKey,
  type RuntimeKernelCapabilityMap,
  type WorkspaceRuntimeCapabilityProvider,
  type WorkspaceRuntimeCapabilityProviderContext,
} from "./runtimeKernelCapabilitySchema";

export function resolveWorkspaceRuntimeCapability<K extends RuntimeKernelCapabilityKey>(
  scope: WorkspaceRuntimeScope,
  key: K
): RuntimeKernelCapabilityMap[K] {
  return scope.getCapability(key);
}
