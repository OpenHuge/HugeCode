import { useCallback } from "react";
import type { RuntimeWorkspaceId } from "../types/runtimeIds";
import type { RuntimeInvocationCatalogFacade } from "../kernel/runtimeInvocationCatalog";
import { useRuntimeKernel } from "../kernel/RuntimeKernelContext";
import { RUNTIME_KERNEL_CAPABILITY_KEYS } from "../kernel/runtimeKernelCapabilities";
import {
  resolveWorkspaceRuntimeCapability,
  useWorkspaceRuntimeCapability,
} from "../hooks/useWorkspaceRuntimeCapability";

export function useWorkspaceRuntimeInvocationCatalog(
  workspaceId: RuntimeWorkspaceId
): RuntimeInvocationCatalogFacade {
  return useWorkspaceRuntimeCapability(
    workspaceId,
    RUNTIME_KERNEL_CAPABILITY_KEYS.invocationCatalog
  );
}

export function useRuntimeInvocationCatalogResolver(): (
  workspaceId: RuntimeWorkspaceId
) => RuntimeInvocationCatalogFacade {
  const kernel = useRuntimeKernel();

  return useCallback(
    (workspaceId: RuntimeWorkspaceId) =>
      resolveWorkspaceRuntimeCapability(
        kernel,
        workspaceId,
        RUNTIME_KERNEL_CAPABILITY_KEYS.invocationCatalog
      ),
    [kernel]
  );
}
