import type { RuntimeKernelPluginCatalogFacade } from "../kernel/runtimeKernelPlugins";
import { useRuntimeKernel } from "../kernel/RuntimeKernelContext";
import {
  RUNTIME_KERNEL_CAPABILITY_KEYS,
  resolveWorkspaceRuntimeCapability,
} from "../kernel/runtimeKernelCapabilities";

export function useWorkspaceRuntimePluginCatalog(
  workspaceId: string | null
): RuntimeKernelPluginCatalogFacade | null {
  const runtimeKernel = useRuntimeKernel();
  if (!workspaceId) {
    return null;
  }
  return resolveWorkspaceRuntimeCapability(
    runtimeKernel.getWorkspaceScope(workspaceId),
    RUNTIME_KERNEL_CAPABILITY_KEYS.pluginCatalog
  );
}
