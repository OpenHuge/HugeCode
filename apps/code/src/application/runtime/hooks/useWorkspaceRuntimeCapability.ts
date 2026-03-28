import { useMemo } from "react";
import { useWorkspaceRuntimeScope } from "../kernel/WorkspaceRuntimeScope";
import type {
  RuntimeKernelCapabilityKey,
  RuntimeKernelCapabilityMap,
} from "../kernel/runtimeKernelCapabilities";
import type { RuntimeKernel } from "../kernel/runtimeKernelTypes";
import type { RuntimeWorkspaceId } from "../types/runtimeIds";

export function resolveWorkspaceRuntimeCapability<K extends RuntimeKernelCapabilityKey>(
  runtimeKernel: RuntimeKernel,
  workspaceId: RuntimeWorkspaceId,
  key: K
): RuntimeKernelCapabilityMap[K] {
  return runtimeKernel.getWorkspaceScope(workspaceId).getCapability(key);
}

export function useWorkspaceRuntimeCapability<K extends RuntimeKernelCapabilityKey>(
  workspaceId: RuntimeWorkspaceId,
  key: K
): RuntimeKernelCapabilityMap[K] {
  const runtimeScope = useWorkspaceRuntimeScope(workspaceId);

  return useMemo(() => runtimeScope.getCapability(key), [key, runtimeScope]);
}
