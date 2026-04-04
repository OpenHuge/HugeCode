import { useMemo } from "react";
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
  const workspaceScope = useMemo(
    () => (workspaceId ? runtimeKernel.getWorkspaceScope(workspaceId) : null),
    [runtimeKernel, workspaceId]
  );

  return useMemo(
    () =>
      workspaceScope
        ? resolveWorkspaceRuntimeCapability(
            workspaceScope,
            RUNTIME_KERNEL_CAPABILITY_KEYS.pluginCatalog
          )
        : null,
    [workspaceScope]
  );
}
