import type { RuntimeKernelCompositionFacade } from "../kernel/runtimeKernelComposition";
import type { RuntimeKernelPluginRegistryFacade } from "../kernel/runtimeKernelPluginRegistry";
import { useRuntimeKernel } from "../kernel/RuntimeKernelContext";
import {
  RUNTIME_KERNEL_CAPABILITY_KEYS,
  resolveWorkspaceRuntimeCapability,
} from "../kernel/runtimeKernelCapabilities";

export function useWorkspaceRuntimePluginRegistry(
  workspaceId: string | null
): RuntimeKernelPluginRegistryFacade | null {
  const runtimeKernel = useRuntimeKernel();
  if (!workspaceId) {
    return null;
  }
  return resolveWorkspaceRuntimeCapability(
    runtimeKernel.getWorkspaceScope(workspaceId),
    RUNTIME_KERNEL_CAPABILITY_KEYS.pluginRegistry
  );
}

export function useWorkspaceRuntimeComposition(
  workspaceId: string | null
): RuntimeKernelCompositionFacade | null {
  const runtimeKernel = useRuntimeKernel();
  if (!workspaceId) {
    return null;
  }
  return resolveWorkspaceRuntimeCapability(
    runtimeKernel.getWorkspaceScope(workspaceId),
    RUNTIME_KERNEL_CAPABILITY_KEYS.compositionRuntime
  );
}
