import type { RuntimeKernelPluginCatalogFacade } from "../kernel/runtimeKernelPlugins";
import { useRuntimeKernel } from "../kernel/RuntimeKernelContext";
import { RUNTIME_KERNEL_CAPABILITY_KEYS } from "../kernel/runtimeKernelCapabilities";

export function useWorkspaceRuntimePluginCatalog(
  workspaceId: string | null
): RuntimeKernelPluginCatalogFacade | null {
  const runtimeKernel = useRuntimeKernel();
  if (!workspaceId) {
    return null;
  }
  return runtimeKernel
    .getWorkspaceScope(workspaceId)
    .getCapability(RUNTIME_KERNEL_CAPABILITY_KEYS.pluginCatalog);
}
