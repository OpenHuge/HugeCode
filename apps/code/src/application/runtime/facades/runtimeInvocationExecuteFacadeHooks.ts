import { useCallback } from "react";
import type { RuntimeWorkspaceId } from "../types/runtimeIds";
import type { RuntimeInvocationExecuteFacade } from "../kernel/runtimeInvocationExecute";
import { useRuntimeKernel } from "../kernel/RuntimeKernelContext";
import { RUNTIME_KERNEL_CAPABILITY_KEYS } from "../kernel/runtimeKernelCapabilities";
import {
  resolveWorkspaceRuntimeCapability,
  useWorkspaceRuntimeCapability,
} from "../hooks/useWorkspaceRuntimeCapability";

export function useWorkspaceRuntimeInvocationExecute(
  workspaceId: RuntimeWorkspaceId
): RuntimeInvocationExecuteFacade {
  return useWorkspaceRuntimeCapability(
    workspaceId,
    RUNTIME_KERNEL_CAPABILITY_KEYS.invocationExecute
  );
}

export function useRuntimeInvocationExecuteResolver(): (
  workspaceId: RuntimeWorkspaceId
) => RuntimeInvocationExecuteFacade {
  const kernel = useRuntimeKernel();

  return useCallback(
    (workspaceId: RuntimeWorkspaceId) =>
      resolveWorkspaceRuntimeCapability(
        kernel,
        workspaceId,
        RUNTIME_KERNEL_CAPABILITY_KEYS.invocationExecute
      ),
    [kernel]
  );
}
